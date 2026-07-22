var PREFIX = '{{ instance_id }}';
var root = document.getElementById(PREFIX + '-root');
if (root) {
  var CX = 200, CY = 200, R = 170;
  var SVGNS = 'http://www.w3.org/2000/svg';

  function num(attr, fallback) {
    var n = parseFloat(root.getAttribute(attr));
    return isFinite(n) ? n : fallback;
  }

  var min = num('data-cp-min', 0);
  var max = num('data-cp-max', 100);
  var value = num('data-cp-value', min);
  var unit = root.getAttribute('data-cp-unit') || '';

  var zones = [];
  var zonesEl = document.getElementById(PREFIX + '-zonesdata');
  if (zonesEl) {
    try {
      var parsed = JSON.parse(zonesEl.textContent || '[]');
      if (Array.isArray(parsed)) zones = parsed;
    } catch (e) { zones = []; }
  }

  if (max <= min) max = min + 1;
  var clamped = Math.min(max, Math.max(min, value));

  function frac(val) { return (val - min) / (max - min); }

  // Map a fraction (0..1) of the scale to an angle in degrees:
  // 0 -> 180deg (left edge), 1 -> 0deg (right edge), sweeping over the top.
  function angleAt(f) { return 180 - f * 180; }

  function pt(angleDeg) {
    var a = angleDeg * Math.PI / 180;
    return { x: CX + R * Math.cos(a), y: CY - R * Math.sin(a) };
  }

  // SVG arc path along the top semicircle from fraction f0 to f1.
  function arcPath(f0, f1) {
    var p0 = pt(angleAt(f0));
    var p1 = pt(angleAt(f1));
    return 'M ' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2) +
           ' A ' + R + ' ' + R + ' 0 0 1 ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2);
  }

  function fmtNum(n) {
    var r = Math.round(n * 100) / 100;
    if (r % 1 === 0) return String(r);
    return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  }

  // Resolve the band ranges once (lower, upper, tone, label) for reuse.
  var bands = [];
  if (zones.length) {
    var lower = min;
    for (var i = 0; i < zones.length; i++) {
      var upper = (i === zones.length - 1) ? max : zones[i].upTo;
      if (typeof upper !== 'number') upper = max;
      bands.push({ lower: lower, upper: upper, tone: zones[i].tone || 'accent', label: zones[i].label || '' });
      lower = upper;
    }
  }

  // Determine which band the value falls into (first band whose upper >= value).
  var activeTone = 'accent', activeLabel = '';
  for (var b = 0; b < bands.length; b++) {
    if (clamped <= bands[b].upper + 1e-9) { activeTone = bands[b].tone; activeLabel = bands[b].label; break; }
    if (b === bands.length - 1) { activeTone = bands[b].tone; activeLabel = bands[b].label; }
  }

  // Build zone band arcs.
  var zonesG = document.getElementById(PREFIX + '-zones');
  if (zonesG) {
    zonesG.innerHTML = '';
    if (bands.length) {
      for (var j = 0; j < bands.length; j++) {
        var bd = bands[j];
        if (bd.upper <= bd.lower) continue;
        var f0 = Math.max(0, Math.min(1, frac(bd.lower)));
        var f1 = Math.max(0, Math.min(1, frac(bd.upper)));
        var path = document.createElementNS(SVGNS, 'path');
        path.setAttribute('class', 'cp-gauge__zone cp-gauge__zone--' + bd.tone);
        path.setAttribute('d', arcPath(f0, f1));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', (j === 0 || j === bands.length - 1) ? 'round' : 'butt');
        zonesG.appendChild(path);
      }
    } else {
      var full = document.createElementNS(SVGNS, 'path');
      full.setAttribute('class', 'cp-gauge__zone cp-gauge__zone--accent');
      full.setAttribute('d', arcPath(0, 1));
      full.setAttribute('fill', 'none');
      full.setAttribute('stroke-linecap', 'round');
      zonesG.appendChild(full);
    }
  }

  // Tick marks at min, max, and each interior band boundary.
  var ticksG = document.getElementById(PREFIX + '-ticks');
  if (ticksG) {
    ticksG.innerHTML = '';
    var marks = [min, max];
    for (var t = 0; t < bands.length - 1; t++) marks.push(bands[t].upper);
    marks.forEach(function (m) {
      var f = Math.max(0, Math.min(1, frac(m)));
      var a = angleAt(f) * Math.PI / 180;
      var inner = R - 14, outer = R + 2;
      var line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('class', 'cp-gauge__tick');
      line.setAttribute('x1', (CX + inner * Math.cos(a)).toFixed(2));
      line.setAttribute('y1', (CY - inner * Math.sin(a)).toFixed(2));
      line.setAttribute('x2', (CX + outer * Math.cos(a)).toFixed(2));
      line.setAttribute('y2', (CY - outer * Math.sin(a)).toFixed(2));
      ticksG.appendChild(line);
    });
  }

  // Rotate the needle to the target (it sits vertical/up at rotate(0)).
  var needle = document.getElementById(PREFIX + '-needle');
  if (needle) {
    var deg = -90 + frac(clamped) * 180;
    needle.style.transformOrigin = CX + 'px ' + CY + 'px';
    requestAnimationFrame(function () {
      needle.style.transform = 'rotate(' + deg.toFixed(2) + 'deg)';
    });
  }

  // Value readout + active-zone tag.
  var valEl = document.getElementById(PREFIX + '-value');
  if (valEl) valEl.textContent = fmtNum(value) + unit;

  var tag = document.getElementById(PREFIX + '-zonetag');
  if (tag) {
    tag.setAttribute('data-tone', activeTone);
    if (activeLabel) { tag.textContent = activeLabel; tag.style.display = ''; }
    else { tag.textContent = ''; tag.style.display = 'none'; }
  }

  // Scale end labels.
  var smin = document.getElementById(PREFIX + '-smin');
  var smax = document.getElementById(PREFIX + '-smax');
  if (smin) smin.textContent = fmtNum(min);
  if (smax) smax.textContent = fmtNum(max);
}
