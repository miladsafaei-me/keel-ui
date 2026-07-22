/* content_pipeline runtime: lazy-load Mermaid + Chart.js when their markers
 * appear in the rendered article body, then bootstrap each instance with the
 * right theme (prefers-color-scheme dark, or a class="dark" ancestor).
 *
 * Also exposes window.cpTheme — a small palette helper that ad-hoc widgets
 * (heatmaps, simulators) can read to color themselves theme-consistently:
 *
 *   var p = window.cpTheme.palette();   // { accent, success, danger, ... }
 *   var dark = window.cpTheme.isDark(); // true/false
 *
 * Loaded only on pages where post.is_pipeline_generated is True.
 */
(function () {
  'use strict';

  // Relative luminance (0..1) of an element's resolved background-color, or null
  // when fully transparent / unparseable.
  function bgLuminance(el) {
    if (!el) return null;
    var m = (getComputedStyle(el).backgroundColor || '').match(/[\d.]+/g);
    if (!m || m.length < 3) return null;
    if (m.length >= 4 && parseFloat(m[3]) === 0) return null;
    return (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) / 255;
  }

  function isDark() {
    // The marketing surface owns theme via <html data-sb-theme>: absent = dark
    // (the default), "light" = the user toggled light mode. This is the
    // authoritative signal — check it before OS preference so a manual toggle
    // that disagrees with the OS still themes the visuals correctly. Keep in
    // sync with the cp-token cascade in content-pipeline.css.
    var sbTheme = document.documentElement.getAttribute('data-sb-theme');
    if (sbTheme === 'light') return false;
    if (sbTheme === 'dark') return true;
    if (document.documentElement.classList.contains('dark')) return true;
    if (document.body.classList.contains('dark')) return true;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
    // Dark marketing surface fallback (e.g. the glossary): no explicit signal and
    // the OS may be light, but the page background is dark — match it so canvas/SVG
    // text (Chart.js titles/axes, Mermaid labels) stays legible, not dark-on-dark.
    var lum = bgLuminance(document.body);
    return lum !== null && lum < 0.4;
  }

  // Canonical palette per theme. Keep in sync with content-pipeline.css tokens.
  var LIGHT = {
    accent:        '#2563eb',
    accentSoft:    'rgba(37,99,235,0.20)',
    success:       '#16a34a',
    successSoft:   'rgba(22,163,74,0.18)',
    danger:        '#dc2626',
    dangerSoft:    'rgba(220,38,38,0.18)',
    warning:       '#d97706',
    warningSoft:   'rgba(217,119,6,0.18)',
    purple:        '#a78bfa',
    purpleSoft:    'rgba(167,139,250,0.18)',
    text:          '#0f172a',
    textMuted:     '#475569',
    border:        '#e2e8f0',
    grid:          'rgba(100,116,139,0.22)',
    tooltipBg:     'rgba(15,23,42,0.92)',
    // Categorical chart-series palette — harmonious, NOT the trade-semantic
    // buy/sell (those stay #3bb273 / #df2c53, chosen per-spec). For multi-series
    // charts so the fleet reads as one system.
    series: ['#2563eb', '#0891b2', '#a78bfa', '#d97706', '#ec4899', '#14b8a6']
  };
  var DARK = {
    accent:        '#7dd3fc',
    accentSoft:    'rgba(125,211,252,0.28)',
    success:       '#5ee29a',
    successSoft:   'rgba(94,226,154,0.30)',
    danger:        '#ff8b9d',
    dangerSoft:    'rgba(255,139,157,0.30)',
    warning:       '#fbbf24',
    warningSoft:   'rgba(251,191,36,0.30)',
    purple:        '#c4b5fd',
    purpleSoft:    'rgba(196,181,253,0.30)',
    text:          '#f1f5f9',
    textMuted:     '#d1d8e3',
    border:        '#3b4a6a',
    grid:          'rgba(180,196,224,0.24)',
    tooltipBg:     'rgba(40,52,85,0.96)',
    series: ['#7dd3fc', '#5eead4', '#c4b5fd', '#fbbf24', '#f9a8d4', '#6ee7b7']
  };

  function palette() { return isDark() ? DARK : LIGHT; }
  function series() { return palette().series.slice(); }

  // Parse a hex (#rgb / #rrggbb) or rgb()/rgba() color into an rgba() string at
  // the given alpha. Returns the input unchanged if it can't be parsed.
  function toRGBA(color, alpha) {
    if (typeof color !== 'string') return color;
    var c = color.trim();
    var h = c.replace('#', '');
    if (/^[0-9a-f]{3}$/i.test(h)) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (/^[0-9a-f]{6}$/i.test(h)) {
      return 'rgba(' + parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) +
        ',' + parseInt(h.slice(4, 6), 16) + ',' + alpha + ')';
    }
    var m = c.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var n = m[1].split(',').map(function (x) { return x.trim(); });
      return 'rgba(' + n[0] + ',' + n[1] + ',' + n[2] + ',' + alpha + ')';
    }
    return color;
  }

  window.cpTheme = { isDark: isDark, palette: palette, series: series, toRGBA: toRGBA };

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function bootMermaid() {
    var blocks = document.querySelectorAll('pre.mermaid');
    if (!blocks.length) return;
    // Generated diagrams sometimes hardcode a classDef text color tuned for one
    // theme (e.g. `color:#1d4ed8` / `color:#166534` — light-mode colors that are
    // unreadable on the dark surface). Strip the color: property from every
    // classDef so node text inherits the theme-correct primaryTextColor. Runs
    // before initialize() so Mermaid parses the corrected source.
    blocks.forEach(function (pre) {
      if (pre.dataset.cpStripped === '1') return;
      // Read innerHTML, not textContent: Mermaid line breaks ship as literal
      // <br/> tags inside the <pre>, and textContent would collapse them and
      // concatenate words. classDef lines never contain markup, so the per-line
      // regex below is safe on the raw HTML string.
      var src = pre.innerHTML;
      if (src.indexOf('classDef') !== -1 && /color\s*:/i.test(src)) {
        pre.innerHTML = src.split('\n').map(function (line) {
          if (!/^\s*classDef\b/.test(line)) return line;
          return line
            .replace(/\s*,?\s*color\s*:\s*#[0-9a-fA-F]{3,8}/gi, '')
            .replace(/classDef(\s+[\w-]+)\s*,/, 'classDef$1 ')
            .replace(/,\s*,/g, ',')
            .replace(/,\s*;/g, ';');
        }).join('\n');
      }
      // Force flowcharts top-down. A left-right (LR/RL) flowchart grows wide and
      // either crushes its text to fit the column or forces a horizontal scroll —
      // both are wrong. Top-down (TB) keeps the diagram within the column width and
      // reflows extra steps vertically, so it stays legible at natural size with no
      // sideways scroll. Only the leading direction token is rewritten; node/edge
      // syntax is untouched. Sequence/other diagram types have no LR token to match.
      var src2 = pre.innerHTML;
      if (/\b(?:flowchart|graph)\s+(?:LR|RL)\b/.test(src2)) {
        pre.innerHTML = src2.replace(/\b(flowchart|graph)\s+(?:LR|RL)\b/, '$1 TB');
      }
      pre.dataset.cpStripped = '1';
    });
    loadScript('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js')
      .then(function () {
        if (!window.mermaid || typeof window.mermaid.initialize !== 'function') return;
        var p = palette(), dark = isDark();
        // Font matches the site body (Mermaid's default is trebuchet ms, which
        // reads foreign next to Inter). Node fill is deliberately a value-step
        // ABOVE the card it sits on (dark: #27344f over the #131c30 card; light:
        // #f1f5f9 over the #ffffff card) so nodes separate from the background
        // instead of dissolving into a flat monochrome field. Stroke weight and
        // the elevation shadow are added in CSS (themeVariables can't set them).
        var FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        var themeVars = dark ? {
          background: 'transparent',
          fontFamily: FONT,
          fontSize: '15px',
          primaryColor: '#27344f',
          primaryTextColor: '#f1f5f9',
          primaryBorderColor: p.accent,
          lineColor: '#9fb0d4',
          secondaryColor: '#1b2740',
          tertiaryColor: '#27344f',
          mainBkg: '#27344f',
          textColor: '#f1f5f9',
          edgeLabelBackground: '#131c30',
          nodeBorder: p.accent,
          clusterBkg: '#182239',
          clusterBorder: '#5a6c8a',
          actorBkg: '#27344f',
          actorBorder: p.accent,
          actorTextColor: '#f1f5f9',
          actorLineColor: '#5a6c8a',
          signalColor: '#d1d8e3',
          signalTextColor: '#f1f5f9',
          labelTextColor: '#f1f5f9',
          loopTextColor: '#f1f5f9',
          noteBkgColor: '#283455',
          noteTextColor: '#f1f5f9',
          noteBorderColor: p.warning
        } : {
          background: 'transparent',
          fontFamily: FONT,
          fontSize: '15px',
          primaryColor: '#f1f5f9',
          primaryTextColor: '#0f172a',
          primaryBorderColor: p.accent,
          lineColor: '#64748b',
          secondaryColor: '#e2e8f0',
          tertiaryColor: '#f1f5f9',
          mainBkg: '#f1f5f9',
          textColor: '#0f172a',
          edgeLabelBackground: '#ffffff',
          nodeBorder: p.accent,
          clusterBkg: '#f8fafc',
          clusterBorder: '#cbd5e1',
          actorBkg: '#f1f5f9',
          actorBorder: p.accent,
          actorTextColor: '#0f172a',
          actorLineColor: '#94a3b8',
          signalColor: '#475569',
          signalTextColor: '#0f172a',
          labelTextColor: '#0f172a',
          loopTextColor: '#0f172a',
          noteBkgColor: '#fef3c7',
          noteTextColor: '#92400e',
          noteBorderColor: p.warning
        };
        window.mermaid.initialize({
          startOnLoad: true,
          theme: 'base',
          themeVariables: themeVars,
          // useMaxWidth:true — the SVG never exceeds the column. Flowcharts are
          // forced top-down above so they stay narrow and fit at natural size
          // (Mermaid won't upscale past the diagram's own width), which keeps text
          // legible without any horizontal scroll. The rare diagram still wider than
          // the column scales down to fit rather than overflowing.
          flowchart: { curve: 'basis', padding: 16, nodeSpacing: 44, rankSpacing: 52, htmlLabels: true, useMaxWidth: true },
          sequence: { mirrorActors: false, useMaxWidth: true, wrap: true },
          securityLevel: 'loose'
        });
        // initialize() alone does NOT render when Mermaid is loaded dynamically
        // after DOMContentLoaded (startOnLoad's listener already fired). Explicitly
        // run() to convert every <pre class="mermaid"> into its SVG.
        if (typeof window.mermaid.run === 'function') {
          var ran = window.mermaid.run();
          if (ran && typeof ran.then === 'function') ran.then(pinSeqWidths, pinSeqWidths);
          else pinSeqWidths();
        }
      })
      .catch(function (err) { console.warn('cp:', err.message); });
  }

  // Sequence diagrams emit their SVG as width="100%" + an inline max-width of the
  // diagram's natural width. Inside the centered horizontal-scroll container that
  // percentage width has no definite reference (the pre is shrink-to-fit), so the
  // SVG collapses to 0×0 and only the caption shows. Pin each sequence SVG to its
  // own natural width so it renders at full size and the container scrolls (rather
  // than squashing) when the column is narrower than the diagram.
  function pinSeqWidths() {
    document.querySelectorAll('.cp-figure-seq pre.mermaid svg').forEach(function (svg) {
      var natural = svg.style.maxWidth; // mermaid sets e.g. "650px"
      if (natural && natural !== 'none') {
        svg.style.width = natural;
        svg.style.maxWidth = 'none';
      }
    });
  }

  function applyChartjsDefaults(p) {
    var C = window.Chart;
    if (!C || !C.defaults) return;
    var d = C.defaults;
    // Global text color + base font
    d.color = p.text;
    d.borderColor = p.border;
    d.font = d.font || {};
    d.font.family = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    d.font.size = 13;
    // Plugin-level: title, legend, tooltip — Chart.js DOES NOT inherit color from
    // d.color for these on every version path, so set explicitly.
    var pl = d.plugins = d.plugins || {};
    pl.title = pl.title || {};
    pl.title.color = p.text;
    pl.title.font = pl.title.font || {};
    pl.title.font.size = 15;
    pl.title.font.weight = '600';
    pl.title.padding = { top: 4, bottom: 18 };
    pl.legend = pl.legend || {};
    pl.legend.labels = pl.legend.labels || {};
    pl.legend.labels.color = p.text;
    pl.legend.labels.padding = 14;
    pl.legend.labels.font = { size: 12 };
    pl.tooltip = pl.tooltip || {};
    pl.tooltip.titleColor = p.text;
    pl.tooltip.bodyColor = p.text;
    pl.tooltip.backgroundColor = p.tooltipBg;
    pl.tooltip.borderColor = p.border;
    pl.tooltip.borderWidth = 1;
    pl.tooltip.padding = 10;
    pl.tooltip.cornerRadius = 8;
    pl.tooltip.displayColors = false;
    // Element-level polish: smooth rounded lines, point halos, soft bars. These
    // are theme-wide so every chart inherits the editorial look without per-spec
    // edits; spec-supplied values still win (these are only Chart.js defaults).
    var el = d.elements = d.elements || {};
    el.line = el.line || {};
    el.line.tension = 0.4;
    el.line.borderCapStyle = 'round';
    el.line.borderJoinStyle = 'round';
    el.line.capBezierPoints = true;
    el.point = el.point || {};
    el.point.radius = 0;
    el.point.hoverRadius = 6;
    el.point.hoverBorderWidth = 3;
    el.point.hitRadius = 12;
    el.point.borderWidth = 2;
    el.bar = el.bar || {};
    el.bar.borderRadius = 6;
    el.bar.borderSkipped = false;
    d.animation = d.animation || {};
    d.animation.duration = 700;
    d.animation.easing = 'easeOutQuart';
    // Scales: ticks + grid + border + title color
    var s = d.scales || {};
    ['linear', 'category', 'logarithmic', 'radialLinear', 'time'].forEach(function (k) {
      var sc = s[k];
      if (!sc) return;
      sc.grid = sc.grid || {};
      sc.grid.color = p.grid;
      sc.grid.tickColor = p.grid;
      sc.grid.drawTicks = false;
      sc.ticks = sc.ticks || {};
      sc.ticks.color = p.textMuted;
      sc.ticks.font = { size: 11 };
      sc.ticks.padding = 8;
      // radialLinear (polar-area / radar) draws an opaque backdrop behind each
      // tick label by default; on the dark surface it renders as gray boxes.
      sc.ticks.showLabelBackdrop = false;
      sc.ticks.backdropColor = 'transparent';
      sc.border = sc.border || {};
      sc.border.color = p.border;
      sc.border.display = false;
      sc.title = sc.title || {};
      sc.title.color = p.text;
      sc.title.font = { size: 12, weight: '600' };
    });
  }

  // Re-map known light-mode hex / rgba color literals to theme palette so dataset
  // colors specified in the visual spec adapt to dark mode without per-chart edits.
  var HEX_MAP_LIGHT_TO_DARK = {
    '#2563eb': '#7dd3fc',
    '#1d4ed8': '#7dd3fc',
    '#dc2626': '#ff8b9d',
    '#991b1b': '#ff8b9d',
    '#16a34a': '#5ee29a',
    '#15803d': '#5ee29a',
    '#d97706': '#fbbf24',
    '#92400e': '#fbbf24',
    '#f59e0b': '#fbbf24',
    '#a78bfa': '#c4b5fd',
    '#7c3aed': '#c4b5fd',
    // Categorical slice palette (doughnut/pie/polar) -> dark siblings, matching
    // window.cpTheme series() so slice charts adapt like every other chart.
    '#0891b2': '#5eead4',
    '#ec4899': '#f9a8d4',
    '#14b8a6': '#6ee7b7',
    '#6366f1': '#a5b4fc',
    '#64748b': '#94a3b8'
  };
  // RGBA prefixes (case/space insensitive) → theme replacement prefix.
  var RGBA_RULES_LIGHT_TO_DARK = [
    [/rgba\(\s*37,\s*99,\s*235/g,  'rgba(125, 211, 252'],
    [/rgba\(\s*96,\s*165,\s*250/g, 'rgba(125, 211, 252'],
    [/rgba\(\s*220,\s*38,\s*38/g,  'rgba(255, 139, 157'],
    [/rgba\(\s*22,\s*163,\s*74/g,  'rgba(94, 226, 154'],
    [/rgba\(\s*217,\s*119,\s*6/g,  'rgba(251, 191, 36'],
    [/rgba\(\s*245,\s*158,\s*11/g, 'rgba(251, 191, 36'],
    [/rgba\(\s*167,\s*139,\s*250/g,'rgba(196, 181, 253']
  ];
  function patchColor(val, dark) {
    if (!dark) return val;
    if (typeof val !== 'string') return val;
    if (HEX_MAP_LIGHT_TO_DARK[val.toLowerCase()]) return HEX_MAP_LIGHT_TO_DARK[val.toLowerCase()];
    var out = val;
    RGBA_RULES_LIGHT_TO_DARK.forEach(function (pair) { out = out.replace(pair[0], pair[1]); });
    return out;
  }
  function patchColorArr(arr, dark) {
    if (!Array.isArray(arr)) return arr;
    return arr.map(function (v) { return patchColor(v, dark); });
  }
  function themeChartConfig(cfg, dark) {
    if (!cfg || !cfg.data || !cfg.data.datasets) return cfg;
    cfg.data.datasets.forEach(function (ds) {
      ['backgroundColor', 'borderColor', 'pointBackgroundColor', 'pointBorderColor', 'hoverBackgroundColor', 'hoverBorderColor'].forEach(function (k) {
        if (Array.isArray(ds[k])) ds[k] = patchColorArr(ds[k], dark);
        else ds[k] = patchColor(ds[k], dark);
      });
    });
    return cfg;
  }

  // Turn a flat fill under a filled line/area dataset into a vertical gradient
  // (border color at ~30% alpha near the curve → transparent away from it), so
  // every area chart reads as a polished wash instead of a solid block. Uses a
  // scriptable backgroundColor evaluated once the chart area is known.
  function applyGradientFills(cfg) {
    if (!cfg.data || !cfg.data.datasets) return;
    var isLine = cfg.type === 'line' || cfg.type === 'area';
    if (!isLine) return;
    cfg.data.datasets.forEach(function (ds) {
      if (!ds.fill || Array.isArray(ds.backgroundColor)) return;
      var base = ds.borderColor || ds.backgroundColor || palette().accent;
      ds.backgroundColor = function (ctx) {
        var chart = ctx.chart, area = chart.chartArea;
        if (!area) return toRGBA(base, 0.0);
        var g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, toRGBA(base, 0.32));
        g.addColorStop(1, toRGBA(base, 0.02));
        return g;
      };
    });
  }

  // Plugin: draw labelled peak/trough/recovery dots on a chart from
  // options.plugins.cpMarkers = [{ index, label, tone }]. tone maps to the theme
  // palette; buy/sell stay canonical green/red.
  var cpMarkersPlugin = {
    id: 'cpMarkers',
    afterDatasetsDraw: function (chart) {
      var opts = chart.options.plugins && chart.options.plugins.cpMarkers;
      if (!Array.isArray(opts) || !opts.length) return;
      var p = palette(), ctx = chart.ctx;
      var meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data) return;
      var toneColor = {
        buy: p.success, up: p.success, recovery: p.success,
        sell: p.danger, down: p.danger, trough: p.danger,
        accent: p.accent, peak: p.textMuted, neutral: p.textMuted, warning: p.warning
      };
      opts.forEach(function (m) {
        var pt = meta.data[m.index];
        if (!pt) return;
        var color = toneColor[m.tone] || p.accent;
        ctx.save();
        // halo + dot
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 6.5, 0, 2 * Math.PI);
        ctx.fillStyle = toRGBA(color, 0.22); ctx.fill();
        ctx.beginPath(); ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = color; ctx.fill();
        if (m.label) {
          // Always label above the dot: keeps trough labels off the x-axis ticks
          // and peak/recovery labels above the plot — never colliding with either.
          ctx.font = "600 11px Inter, -apple-system, 'Segoe UI', sans-serif";
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = color;
          ctx.fillText(m.label, pt.x, pt.y - 12);
        }
        ctx.restore();
      });
    }
  };

  // Plugin: a soft drop-shadow beneath line strokes for depth (skipped when the
  // user prefers reduced motion-equivalent restraint is not needed; purely visual).
  var cpLineShadowPlugin = {
    id: 'cpLineShadow',
    beforeDatasetDraw: function (chart, args) {
      var ds = chart.data.datasets[args.index];
      if (!ds || ds.fill === undefined || chart.config.type !== 'line') return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor = toRGBA(ds.borderColor || palette().accent, 0.35);
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
    },
    afterDatasetDraw: function (chart, args) {
      if (chart.config.type !== 'line') return;
      chart.ctx.restore();
    }
  };

  // Append the closing braces/brackets for any delimiters a truncated config
  // string left open, ignoring delimiters inside string literals. Salvages a
  // chart whose stored JSON lost its trailing closer(s) to a content-ingest bug.
  function balanceJson(s) {
    var stack = [], inStr = false, esc = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') stack.pop();
    }
    var out = s;
    while (stack.length) out += stack.pop();
    return out;
  }

  function bootChartjs() {
    var canvases = document.querySelectorAll('[data-cp-chart]');
    // Two kinds of chart ship in pipeline bodies and BOTH need window.Chart:
    //   1. declarative — <canvas data-cp-chart="{...}">, bootstrapped in the
    //      forEach below from the attribute config;
    //   2. hand-authored — the article ships its own <canvas> plus an inline
    //      <script> that calls `new Chart(...)` itself (and polls for the Chart
    //      global until it appears).
    // Kind #2 carries no data-cp-chart attribute, so the selector above misses
    // it. If a page has only kind #2, we used to bail here and never load
    // Chart.js — the inline script then polls forever for a global that never
    // arrives and the figure renders as a permanently empty box. Trigger the
    // Chart.js load whenever ANY <canvas> is present: Mermaid renders to SVG, so
    // a <canvas> on a pipeline page always means a chart that needs the library.
    var hasAnyCanvas = !!document.querySelector('canvas');
    if (!canvases.length && !hasAnyCanvas) return;
    loadScript('https://cdn.jsdelivr.net/npm/chart.js@4')
      .then(function () {
        if (!window.Chart) { console.warn('cp: Chart.js global missing'); return; }
        var p = palette(), dark = isDark();
        applyChartjsDefaults(p);
        canvases.forEach(function (canvas) {
          var raw = canvas.getAttribute('data-cp-chart');
          var cfg;
          try {
            cfg = JSON.parse(raw);
          } catch (e1) {
            try {
              cfg = JSON.parse(balanceJson(raw));
              console.warn('cp: chart JSON auto-balanced for', canvas.id);
            } catch (e2) {
              console.warn('cp: chart config invalid for', canvas.id, e1);
              return;
            }
          }
          try {
            cfg = themeChartConfig(cfg, dark);
            applyGradientFills(cfg);
            cfg.plugins = (cfg.plugins || []).concat([cpMarkersPlugin, cpLineShadowPlugin]);
            new window.Chart(canvas, cfg);
          } catch (e) {
            console.warn('cp: chart init failed for', canvas.id, e);
          }
        });
      })
      .catch(function (err) { console.warn('cp:', err.message); });
  }

  // Subtle scroll-reveal (fade + rise) for visuals as they enter the viewport.
  // FOUC-safe: only elements that start BELOW the fold are hidden+animated;
  // anything already on screen stays visible. Skipped entirely under
  // prefers-reduced-motion, and a no-op without IntersectionObserver.
  function bootReveal() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;
    var nodes = document.querySelectorAll('.tg-term__visual, .cp-figure, .cp-html-block');
    if (!nodes.length) return;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('cp-revealed'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    nodes.forEach(function (n) {
      if (n.getBoundingClientRect().top < vh * 0.92) return; // above/near fold: leave visible
      n.classList.add('cp-reveal');
      io.observe(n);
    });
  }

  function boot() { bootMermaid(); bootChartjs(); bootReveal(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
