"""Per-component split of content-pipeline.css, and the picker for a page.

content-pipeline.css styles every cp-* component (about 80 of them) in one
274 KB sheet, so an article that draws a handful of components downloads the
rest unused (PageSpeed "Reduce unused CSS": 23 KiB on a SignalBots post). The
build step splits it into ``static/keel_ui/css/cp/``:

- ``base.css``: rules that name no component (tokens, keyframes, globals) and
  the components keel-ui's own scripts add at runtime (ALWAYS);
- ``<block>.css``: every rule of one component block (``cp-steps__title`` and
  ``cp-steps--wide`` belong to ``cp-steps``), in source order. A selector
  naming several blocks goes to the block that first appears latest in the
  source, so it still loads after the rules it was written to follow; a
  selector list spanning several blocks is shared, and goes to base.css;
- ``manifest.json``: the files in load order (base, then blocks by where
  they first appear in the source) and the block each file serves.

``stylesheets_for(html)`` returns the files a rendered body needs, in that
order. content-pipeline.css stays the single source of truth: edit it, then
run ``python -m keel_ui.cp_css build`` (``check`` fails when the split is
stale). The monolith is still shipped for pages that cannot name their body.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from functools import lru_cache
from pathlib import Path

STATIC = Path(__file__).resolve().parent / "static" / "keel_ui"
SOURCE = STATIC / "css" / "content-pipeline.css"
OUT = STATIC / "css" / "cp"
STATIC_PREFIX = "keel_ui/css/cp/"

# Blocks keel-ui's own scripts add or toggle at runtime (js/content-pipeline.js);
# a server-rendered body never names them, so they ride in base.css.
ALWAYS = {"cp-chart", "cp-figure", "cp-figure-seq", "cp-html-block", "cp-reveal", "cp-revealed", "cp-token"}
# The shared wrapper every component sits in: it decides a rule's block only
# when the rule names no other component.
WRAPPER = "cp-html-block"

_CLASS = re.compile(r"\.(cp-[a-z0-9_-]+)")
_TOKEN = re.compile(r"cp-[a-z0-9]+(?:-[a-z0-9]+)*")


def block_of(cls: str) -> str:
    return re.split(r"__|--", cls, maxsplit=1)[0]


def _statements(css: str):
    """Yield (prelude, body, start) for each top-level statement; at-rules
    with a block yield their body unparsed. Comments are dropped."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    i, n, start = 0, len(css), 0
    while i < n:
        c = css[i]
        if c in "\"'":
            j = i + 1
            while j < n and css[j] != c:
                j += 2 if css[j] == "\\" else 1
            i = j + 1
            continue
        if c == ";" and css[start:i].strip().startswith("@"):
            yield css[start:i].strip(), None, start
            i += 1
            start = i
            continue
        if c == "{":
            depth, j = 1, i + 1
            while j < n and depth:
                if css[j] in "\"'":
                    q = css[j]
                    j += 1
                    while j < n and css[j] != q:
                        j += 2 if css[j] == "\\" else 1
                elif css[j] == "{":
                    depth += 1
                elif css[j] == "}":
                    depth -= 1
                j += 1
            yield css[start:i].strip(), css[i + 1 : j - 1], start
            i = j
            start = i
            continue
        i += 1


def _rules(css: str, media: str | None = None):
    """Flatten to (media, selector, body, position), keeping @media/@supports
    context; other at-rules come back whole with selector None."""
    for prelude, body, pos in _statements(css):
        if body is None:
            yield media, None, prelude + ";", pos
        elif prelude.startswith(("@media", "@supports", "@container")):
            for m, sel, b, p in _rules(body, prelude):
                yield m, sel, b, pos + p
        elif prelude.startswith("@"):
            yield media, None, f"{prelude}{{{body}}}", pos
        else:
            yield media, prelude, body, pos


def _part_blocks(part: str) -> set[str]:
    blocks = {block_of(c) for c in _CLASS.findall(part)}
    return blocks - {WRAPPER} or blocks


def _assign(rules):
    first: dict[str, int] = {}
    parsed = []
    for media, sel, body, pos in rules:
        parts = [_part_blocks(p) for p in sel.split(",")] if sel else []
        for blocks in parts:
            for b in blocks:
                first.setdefault(b, pos)
        parsed.append((media, sel, body, parts))
    out = []
    for media, sel, body, parts in parsed:
        # Each selector in the list belongs to one block: the one among those
        # it names that first appears latest (a descendant selector such as
        # .cp-x .cp-y__z is written to follow both). A list whose selectors
        # belong to different blocks is shared by all of them (the colour
        # tokens on .cp-figure, .cp-html-block, .cp-table ...), so it goes to
        # base.css, which every page loads.
        homes = set()
        for named in parts:
            if not named or named <= ALWAYS:
                homes.add("base")
            else:
                homes.add(max(named - ALWAYS or named, key=lambda b: first[b]))
        home = homes.pop() if len(homes) == 1 else "base"
        out.append((home, media, sel, body))
    return out, first


def _render(items) -> str:
    chunks, cur_media, buf = [], None, []

    def flush():
        if buf:
            inner = "\n".join(buf)
            chunks.append(f"{cur_media}{{\n{inner}\n}}" if cur_media else inner)
            buf.clear()

    for media, sel, body in items:
        if media != cur_media:
            flush()
            cur_media = media
        buf.append(body if sel is None else f"{sel}{{{body.strip()}}}")
    flush()
    return "\n".join(chunks) + "\n"


def build(check: bool = False) -> int:
    css = SOURCE.read_text(encoding="utf-8")
    assigned, first = _assign(list(_rules(css)))
    files: dict[str, list] = {}
    for home, media, sel, body in assigned:
        files.setdefault(home, []).append((media, sel, body))
    order = ["base"] + sorted((b for b in files if b != "base"), key=lambda b: first[b])
    rendered = {name: _render(files[name]) for name in order}
    digest = hashlib.sha256(css.encode()).hexdigest()[:16]
    manifest = {"source_sha": digest, "order": [f"{n}.css" for n in order], "blocks": sorted(b for b in order if b != "base")}
    if check:
        try:
            current = json.loads((OUT / "manifest.json").read_text())
        except OSError:
            current = {}
        stale = current.get("source_sha") != digest
        if stale:
            print("keel_ui cp split is stale: run python -m keel_ui.cp_css build", file=sys.stderr)
        return 1 if stale else 0
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.css"):
        if old.stem not in rendered:
            old.unlink()
    header = "/* generated by keel_ui.cp_css from content-pipeline.css - do not edit */\n"
    for name, text in rendered.items():
        (OUT / f"{name}.css").write_text(header + text, encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    print(f"{len(rendered)} files, base {len(rendered['base'])} bytes")
    return 0


@lru_cache(maxsize=1)
def _manifest() -> dict:
    return json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))


def stylesheets_for(html: str) -> list[str]:
    """Static paths of the split sheets a rendered body needs, in load order.
    Falls back to the monolith when the split has not been built."""
    try:
        manifest = _manifest()
    except OSError:
        return ["keel_ui/css/content-pipeline.css"]
    used = {block_of(t) for t in _TOKEN.findall(html or "")}
    blocks = set(manifest["blocks"])
    return [
        STATIC_PREFIX + name
        for name in manifest["order"]
        if name == "base.css" or (name[:-4] in blocks and name[:-4] in used)
    ]


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "build"
    sys.exit(build(check=(cmd == "check")))
