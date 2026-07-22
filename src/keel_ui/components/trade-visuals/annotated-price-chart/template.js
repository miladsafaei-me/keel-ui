(function () {
  var ROOT = document.getElementById("{{ instance_id }}-root");
  if (!ROOT) return;
  var STAGE = document.getElementById("{{ instance_id }}-stage");
  if (!STAGE) return;

  var SVGNS = "http://www.w3.org/2000/svg";

  function readJSON(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var raw = (el.textContent || "").trim();
    if (!raw || raw === '""') return fallback;
    try {
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  var series = readJSON("{{ instance_id }}-series", []);
  var levels = readJSON("{{ instance_id }}-levels", []);
  var zones = readJSON("{{ instance_id }}-zones", []);
  var callouts = readJSON("{{ instance_id }}-callouts", []);
  if (!Array.isArray(series) || series.length < 2) return;
  if (!Array.isArray(levels)) levels = [];
  if (!Array.isArray(zones)) zones = [];
  if (!Array.isArray(callouts)) callouts = [];

  var type = ROOT.getAttribute("data-cp-type") === "line" ? "line" : "candles";
  var dec = parseInt(ROOT.getAttribute("data-cp-dec"), 10);
  if (isNaN(dec) || dec < 0) dec = 4;
  var showLegend = ROOT.getAttribute("data-cp-legend") === "1";

  function num(x) {
    var n = typeof x === "number" ? x : parseFloat(x);
    return isFinite(n) ? n : 0;
  }

  // Normalize series into OHLC records (line mode synthesizes flat OHLC from close).
  var ohlc = series.map(function (pt) {
    if (pt && typeof pt === "object") {
      return { o: num(pt.o), h: num(pt.h), l: num(pt.l), c: num(pt.c) };
    }
    var v = num(pt);
    return { o: v, h: v, l: v, c: v };
  });

  // Geometry. A wider canvas plus a dedicated right-hand gutter gives every
  // level pill its own column, so labels never sit on top of the price action.
  var W = 880, H = 380;
  var GUTTER = 168;            // reserved width on the right for level pills
  var LEADER = 14;             // gap between plot edge and the gutter pills
  var padT = 30, padB = 30, padL = 14;
  var plotT = padT, plotB = H - padB, plotL = padL;
  var plotR = W - GUTTER - LEADER;
  var gutterX = plotR + LEADER; // left edge of the pill column
  var plotH = plotB - plotT, plotW = plotR - plotL;

  // Price domain: include candle highs/lows, every level price, every zone edge.
  var lo = Infinity, hi = -Infinity;
  ohlc.forEach(function (d) { if (d.l < lo) lo = d.l; if (d.h > hi) hi = d.h; });
  levels.forEach(function (lv) { var p = num(lv.price); if (p < lo) lo = p; if (p > hi) hi = p; });
  zones.forEach(function (z) {
    [num(z.from), num(z.to)].forEach(function (p) { if (p < lo) lo = p; if (p > hi) hi = p; });
  });
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) { hi = lo + 1; }
  var span = hi - lo;
  var margin = span * 0.08;
  lo -= margin; hi += margin; span = hi - lo;

  function yOf(price) { return plotB - ((price - lo) / span) * plotH; }
  var n = ohlc.length;
  var step = n > 1 ? plotW / (n - 1) : plotW;
  function xOf(i) { return plotL + i * step; }
  function fmt(p) { return Number(p).toFixed(dec); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  // Approximate text width for pill sizing (no DOM measuring needed before paint).
  function textW(s, size) { return (s ? s.length : 0) * size * 0.56; }

  function el(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    return e;
  }
  function txt(cls, x, y, anchor, content) {
    var t = el("text", { "class": cls, "x": x, "y": y });
    if (anchor) t.setAttribute("text-anchor", anchor);
    t.textContent = content;
    return t;
  }

  var svg = el("svg", {
    "class": "cp-aprice__svg",
    "viewBox": "0 0 " + W + " " + H,
    "preserveAspectRatio": "xMidYMid meet"
  });
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");

  var gGrid = el("g", { "class": "cp-aprice__g-grid" });
  var gZones = el("g", { "class": "cp-aprice__g-zones" });
  var gPrice = el("g", { "class": "cp-aprice__g-price" });
  var gLevels = el("g", { "class": "cp-aprice__g-levels" });
  var gCallouts = el("g", { "class": "cp-aprice__g-callouts" });
  svg.appendChild(gGrid);
  svg.appendChild(gZones);
  svg.appendChild(gPrice);
  svg.appendChild(gLevels);
  svg.appendChild(gCallouts);

  // Plot frame + evenly spaced horizontal grid lines (span the gutter too, faintly).
  gGrid.appendChild(el("line", {
    "class": "cp-aprice__divider", "x1": plotR + LEADER / 2, "x2": plotR + LEADER / 2,
    "y1": plotT - 6, "y2": plotB + 6
  }));
  for (var gi = 1; gi <= 4; gi++) {
    var gy = plotT + (plotH * gi) / 5;
    gGrid.appendChild(el("line", {
      "class": "cp-aprice__grid", "x1": plotL, "x2": plotR, "y1": gy, "y2": gy
    }));
  }

  // Shaded price zones (drawn behind price), with a tag pinned to the left edge.
  zones.forEach(function (z) {
    var a = yOf(num(z.from)), b = yOf(num(z.to));
    var top = Math.min(a, b), bot = Math.max(a, b);
    var tone = (z.tone || "neutral");
    gZones.appendChild(el("rect", {
      "class": "cp-aprice__zone cp-aprice__zone--" + tone,
      "x": plotL, "y": top, "width": plotW, "height": Math.max(1, bot - top)
    }));
    if (z.label) {
      var ty = clamp(top + (bot - top) / 2, plotT + 12, plotB - 6);
      var tagW = textW(z.label, 11) + 14;
      gZones.appendChild(el("rect", {
        "class": "cp-aprice__zone-chip cp-aprice__zone-chip--" + tone,
        "x": plotL + 8, "y": ty - 9, "width": tagW, "height": 18, "rx": 4
      }));
      gZones.appendChild(txt(
        "cp-aprice__zone-tag cp-aprice__zone-tag--" + tone,
        plotL + 8 + tagW / 2, ty + 3.8, "middle", z.label
      ));
    }
  });

  // Price rendering.
  if (type === "line") {
    var dArea = "M " + xOf(0) + " " + plotB;
    var dLine = "";
    ohlc.forEach(function (d, i) {
      var x = xOf(i), y = yOf(d.c);
      dLine += (i === 0 ? "M " : " L ") + x + " " + y;
      dArea += " L " + x + " " + y;
    });
    dArea += " L " + xOf(n - 1) + " " + plotB + " Z";
    gPrice.appendChild(el("path", { "class": "cp-aprice__area", "d": dArea }));
    gPrice.appendChild(el("path", { "class": "cp-aprice__line", "d": dLine }));
    gPrice.appendChild(el("circle", {
      "class": "cp-aprice__dot", "cx": xOf(n - 1), "cy": yOf(ohlc[n - 1].c), "r": 3.6
    }));
  } else {
    var bw = Math.max(3, Math.min(15, step * 0.62));
    ohlc.forEach(function (d, i) {
      var x = xOf(i);
      var up = d.c >= d.o;
      var cls = up ? "cp-aprice__candle--up" : "cp-aprice__candle--down";
      gPrice.appendChild(el("line", {
        "class": "cp-aprice__wick " + cls, "x1": x, "x2": x, "y1": yOf(d.h), "y2": yOf(d.l)
      }));
      var yo = yOf(d.o), yc = yOf(d.c);
      var top = Math.min(yo, yc);
      var hgt = Math.max(1.5, Math.abs(yc - yo));
      gPrice.appendChild(el("rect", {
        "class": "cp-aprice__body " + cls,
        "x": x - bw / 2, "y": top, "width": bw, "height": hgt, "rx": 1
      }));
    });
  }

  // Horizontal annotation levels. The line spans the plot; the price pill lives
  // in the right gutter and is vertically staggered so pills never overlap, with
  // a short leader connecting the line's true y to the (possibly shifted) pill.
  var PILL_H = 24;
  var PILL_GAP = 6;            // minimum vertical gap between stacked pills
  var FS_PILL = 13;

  // Build pill descriptors first, sorted by price ascending (top of chart first
  // once mapped to y, since higher price = smaller y).
  var pills = levels.map(function (lv) {
    var price = num(lv.price);
    var lineY = clamp(yOf(price), plotT, plotB);
    var tone = lv.tone || "neutral";
    var style = lv.style || "dashed";
    var label = (lv.label || "");
    var priceStr = fmt(price);
    var w = Math.max(
      textW(label, FS_PILL) ,
      textW(priceStr, FS_PILL - 0.5)
    ) + 22;
    w = Math.min(w, GUTTER - 8);
    return {
      price: price, lineY: lineY, tone: tone, style: style,
      label: label, priceStr: priceStr, w: w, y: lineY
    };
  }).sort(function (a, b) { return a.lineY - b.lineY; });

  // Vertical collision resolution: push each pill below the previous one if it
  // would overlap, then if the stack overflows the bottom, relax upward.
  var minTop = plotT;
  var maxBot = plotB;
  var nextTop = minTop;
  pills.forEach(function (p) {
    var desired = p.lineY - PILL_H / 2;
    if (desired < nextTop) desired = nextTop;
    p.top = desired;
    nextTop = p.top + PILL_H + PILL_GAP;
  });
  // If we ran past the bottom, shift the whole stack up by the overflow,
  // then re-clamp downward from the top so it stays inside the plot.
  var lastBot = pills.length ? (pills[pills.length - 1].top + PILL_H) : 0;
  if (lastBot > maxBot) {
    var shift = lastBot - maxBot;
    for (var pi = pills.length - 1; pi >= 0; pi--) {
      pills[pi].top -= shift;
      if (pi > 0) {
        var prevBotLimit = pills[pi].top - PILL_GAP - PILL_H;
        if (pills[pi - 1].top > prevBotLimit) pills[pi - 1].top = prevBotLimit;
      }
    }
    if (pills.length && pills[0].top < minTop) pills[0].top = minTop;
  }

  pills.forEach(function (p) {
    var g = el("g", { "class": "cp-aprice__level cp-aprice__level--" + p.tone });

    // The annotation line across the plot.
    g.appendChild(el("line", {
      "class": "cp-aprice__level-line cp-aprice__level-line--" + p.style,
      "x1": plotL, "x2": plotR, "y1": p.lineY, "y2": p.lineY
    }));

    var pillY = p.top;
    var pillCenterY = pillY + PILL_H / 2;
    var px = gutterX;

    // Leader from the line's true y at the plot edge to the pill's center.
    g.appendChild(el("path", {
      "class": "cp-aprice__leader",
      "d": "M " + plotR + " " + p.lineY +
           " L " + (plotR + LEADER * 0.55) + " " + p.lineY +
           " L " + (px - 4) + " " + pillCenterY +
           " L " + px + " " + pillCenterY
    }));
    // Tick dot where the line meets the plot edge.
    g.appendChild(el("circle", {
      "class": "cp-aprice__level-tick", "cx": plotR, "cy": p.lineY, "r": 2.6
    }));

    // The pill itself: a two-row chip (label on top, price below) for clarity.
    g.appendChild(el("rect", {
      "class": "cp-aprice__pill",
      "x": px, "y": pillY, "width": p.w, "height": PILL_H, "rx": 6
    }));
    // Tone accent bar on the pill's left edge.
    g.appendChild(el("rect", {
      "class": "cp-aprice__pill-bar",
      "x": px, "y": pillY + 4, "width": 3, "height": PILL_H - 8, "rx": 1.5
    }));
    g.appendChild(txt(
      "cp-aprice__pill-label", px + 11, pillY + 10.5, "start", p.label
    ));
    g.appendChild(txt(
      "cp-aprice__pill-price", px + 11, pillY + 20.5, "start", p.priceStr
    ));
    gLevels.appendChild(g);
  });

  // Free-floating callouts pinned to a candle index. Boxes are collision-checked
  // against each other horizontally; vertically they get a clear stem + gap.
  var placedBoxes = [];
  function overlaps(a, b) {
    return !(a.x + a.w < b.x - 6 || a.x > b.x + b.w + 6 ||
             a.y + a.h < b.y - 4 || a.y > b.y + b.h + 4);
  }
  callouts.forEach(function (co) {
    var i = parseInt(co.index, 10);
    if (isNaN(i) || i < 0 || i >= n) return;
    var d = ohlc[i];
    var anchor = co.anchor === "below" ? "below" : "above";
    var tone = co.tone || "accent";
    var x = xOf(i);
    var anchorY = anchor === "below" ? yOf(d.l) : yOf(d.h);
    var fs = 12.5;
    var w = textW(co.text, fs) + 18;
    var hh = 22;
    var stem = 26;

    // Initial box position.
    var by = anchor === "below" ? anchorY + stem : anchorY - stem - hh;
    var bx = clamp(x - w / 2, plotL + 1, plotR - w - 1);

    // Nudge vertically away from other callouts that would collide.
    var guard = 0;
    var box = { x: bx, y: by, w: w, h: hh };
    while (guard < 6) {
      var hit = false;
      for (var b = 0; b < placedBoxes.length; b++) {
        if (overlaps(box, placedBoxes[b])) { hit = true; break; }
      }
      if (!hit) break;
      box.y += anchor === "below" ? (hh + 8) : -(hh + 8);
      guard++;
    }
    box.y = clamp(box.y, plotT + 1, plotB - hh - 1);
    bx = box.x; by = box.y;

    var g = el("g", { "class": "cp-aprice__callout cp-aprice__callout--" + tone });
    var dotY = anchorY;
    var labelEdgeY = anchor === "below" ? by : by + hh;

    g.appendChild(el("line", {
      "class": "cp-aprice__callout-stem", "x1": x, "x2": x, "y1": dotY, "y2": labelEdgeY
    }));
    g.appendChild(el("circle", { "class": "cp-aprice__callout-dot", "cx": x, "cy": dotY, "r": 3.8 }));
    g.appendChild(el("rect", {
      "class": "cp-aprice__callout-box", "x": bx, "y": by, "width": w, "height": hh, "rx": 6
    }));
    g.appendChild(txt(
      "cp-aprice__callout-text", bx + w / 2, by + hh / 2 + 4.3, "middle", co.text
    ));
    gCallouts.appendChild(g);
    placedBoxes.push({ x: bx, y: by, w: w, h: hh });
  });

  // Swap skeleton for the finished chart.
  var skel = STAGE.querySelector(".cp-aprice__skeleton");
  if (skel) skel.parentNode.removeChild(skel);
  STAGE.appendChild(svg);

  // Build legend from the levels actually present (entry/stop/target only).
  if (showLegend) {
    var legendEl = document.getElementById("{{ instance_id }}-legend");
    if (legendEl) {
      var labelMap = { entry: "Entry", stop: "Stop-loss", target: "Take-profit" };
      var order = ["entry", "stop", "target"];
      var present = {};
      levels.forEach(function (lv) { if (labelMap[lv.tone]) present[lv.tone] = true; });
      var frag = document.createDocumentFragment();
      order.forEach(function (tone) {
        if (!present[tone]) return;
        var item = document.createElement("span");
        item.className = "cp-aprice__legend-item cp-aprice__legend-item--" + tone;
        var sw = document.createElement("span");
        sw.className = "cp-aprice__legend-swatch";
        var lab = document.createElement("span");
        lab.textContent = labelMap[tone];
        item.appendChild(sw);
        item.appendChild(lab);
        frag.appendChild(item);
      });
      if (frag.childNodes.length) {
        legendEl.appendChild(frag);
        legendEl.hidden = false;
      }
    }
  }
})();
