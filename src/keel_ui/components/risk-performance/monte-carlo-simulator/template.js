var PREFIX = '{{ instance_id }}';
var root   = document.getElementById(PREFIX + '-root');
if (root) {
  var svg     = document.getElementById(PREFIX + '-svg');
  var runBtn  = document.getElementById(PREFIX + '-run');
  var resetBtn= document.getElementById(PREFIX + '-reset');
  var edgeEl  = document.getElementById(PREFIX + '-edge');

  var PATHS  = parseInt(root.getAttribute('data-cp-paths'),  10) || 200;
  var TRADES = parseInt(root.getAttribute('data-cp-trades'), 10) || 200;
  var WR     = (parseFloat(root.getAttribute('data-cp-wr'))   || 55) / 100;
  var RR     =  parseFloat(root.getAttribute('data-cp-rr'))   || 1.6;
  var RISK   = (parseFloat(root.getAttribute('data-cp-risk')) || 1) / 100;
  var RUIN   = (parseFloat(root.getAttribute('data-cp-ruin')) || 25) / 100; /* equity drop that counts as "ruin" */

  var W = 760, H = 300, PADL = 46, PADR = 12, PADT = 14, PADB = 26;
  var PLOTW = W - PADL - PADR, PLOTH = H - PADT - PADB;

  /* Seeded PRNG so the static load frame is deterministic and reproducible. */
  function makeRng(seed){
    var s = seed >>> 0;
    return function(){
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  function simulate(rng){
    var paths = [];
    for (var p = 0; p < PATHS; p++){
      var bal = 1, peak = 1, maxDD = 0, ruined = false;
      var pts = new Array(TRADES + 1);
      pts[0] = 1;
      for (var t = 0; t < TRADES; t++){
        if (rng() < WR) bal *= 1 + RR * RISK;
        else            bal *= 1 - RISK;
        if (bal > peak) peak = bal;
        var dd = 1 - bal / peak;
        if (dd > maxDD) maxDD = dd;
        if ((1 - bal) >= RUIN) ruined = true;
        pts[t + 1] = bal;
      }
      paths.push({ pts: pts, finalBal: bal, maxDD: maxDD, ruined: ruined });
    }
    return paths;
  }

  function percentile(sorted, q){
    var idx = (sorted.length - 1) * q;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  function analyze(paths){
    var n = TRADES + 1;
    var p10 = new Array(n), p50 = new Array(n), p90 = new Array(n);
    var col = new Array(paths.length);
    for (var i = 0; i < n; i++){
      for (var p = 0; p < paths.length; p++) col[p] = paths[p].pts[i];
      col.sort(function(a, b){ return a - b; });
      p10[i] = percentile(col, 0.10);
      p50[i] = percentile(col, 0.50);
      p90[i] = percentile(col, 0.90);
    }
    var lo = Infinity, hi = -Infinity;
    for (var k = 0; k < n; k++){
      if (p10[k] < lo) lo = p10[k];
      if (p90[k] > hi) hi = p90[k];
    }
    /* extend bounds slightly so paths outside the band still fit, with padding */
    paths.forEach(function(pa){
      if (pa.finalBal > hi) hi = pa.finalBal;
      var mn = Math.min.apply(null, pa.pts);
      if (mn < lo) lo = mn;
    });
    var span = hi - lo || 1;
    lo -= span * 0.04; hi += span * 0.04;
    return { p10: p10, p50: p50, p90: p90, lo: lo, hi: hi };
  }

  function makeScales(lo, hi){
    function nx(i){ return PADL + (i / TRADES) * PLOTW; }
    function ny(v){ return PADT + (1 - (v - lo) / (hi - lo)) * PLOTH; }
    return { nx: nx, ny: ny };
  }

  function gridSvg(s, lo, hi){
    /* equity gridlines at nice multiplier steps around 1.0 */
    var rangePct = (hi - lo);
    var step = rangePct > 1.2 ? 0.25 : (rangePct > 0.6 ? 0.1 : 0.05);
    var html = '';
    var start = Math.ceil(lo / step) * step;
    for (var v = start; v <= hi + 1e-9; v += step){
      var y = s.ny(v).toFixed(1);
      var isBase = Math.abs(v - 1) < 1e-9;
      html += '<line class="cp-mc__grid' + (isBase ? ' cp-mc__grid--base' : '') + '" x1="' + PADL + '" y1="' + y + '" x2="' + (W - PADR) + '" y2="' + y + '"/>';
      var pct = Math.round((v - 1) * 100);
      var lbl = (pct > 0 ? '+' : '') + pct + '%';
      html += '<text class="cp-mc__axis-lbl" x="' + (PADL - 8) + '" y="' + (parseFloat(y) + 3.5) + '" text-anchor="end">' + lbl + '</text>';
    }
    return html;
  }

  function bandPath(s, p10, p90){
    var up = [], dn = [];
    for (var i = 0; i <= TRADES; i++){
      up.push(s.nx(i).toFixed(1) + ',' + s.ny(p90[i]).toFixed(1));
    }
    for (var j = TRADES; j >= 0; j--){
      dn.push(s.nx(j).toFixed(1) + ',' + s.ny(p10[j]).toFixed(1));
    }
    return 'M' + up.join(' L') + ' L' + dn.join(' L') + ' Z';
  }

  function line(s, arr){
    var d = [];
    for (var i = 0; i <= TRADES; i++) d.push(s.nx(i).toFixed(1) + ',' + s.ny(arr[i]).toFixed(1));
    return d.join(' ');
  }

  function pathLine(s, pts){
    var d = [];
    for (var i = 0; i < pts.length; i++) d.push(s.nx(i).toFixed(1) + ',' + s.ny(pts[i]).toFixed(1));
    return d.join(' ');
  }

  var animTimer = null;

  function clearAnim(){ if (animTimer){ clearTimeout(animTimer); animTimer = null; } }

  function draw(paths, animate){
    clearAnim();
    var a = analyze(paths);
    var s = makeScales(a.lo, a.hi);

    var staticSvg = gridSvg(s, a.lo, a.hi);
    staticSvg += '<path class="cp-mc__band" d="' + bandPath(s, a.p10, a.p90) + '"/>';

    /* thin individual paths drawn first (under median) */
    var pathsSvg = '';
    paths.forEach(function(pa){
      var cls = pa.finalBal >= 1 ? 'cp-mc__path--win' : 'cp-mc__path--loss';
      pathsSvg += '<polyline class="cp-mc__path ' + cls + '" points="' + pathLine(s, pa.pts) + '"/>';
    });

    var medianSvg = '<polyline class="cp-mc__median" points="' + line(s, a.p50) + '"/>';
    var endDot = '<circle class="cp-mc__median-dot" cx="' + s.nx(TRADES).toFixed(1) + '" cy="' + s.ny(a.p50[TRADES]).toFixed(1) + '" r="3.6"/>';

    if (!animate){
      svg.innerHTML = staticSvg + '<g class="cp-mc__paths">' + pathsSvg + '</g>' + medianSvg + endDot;
      updateStats(paths, a);
      return;
    }

    /* animated reveal: band + grid instantly, paths fade in via class, median draws last */
    svg.innerHTML = staticSvg + '<g class="cp-mc__paths cp-mc__paths--enter">' + pathsSvg + '</g>';
    var pathsG = svg.querySelector('.cp-mc__paths');
    requestAnimationFrame(function(){ if (pathsG) pathsG.classList.remove('cp-mc__paths--enter'); });
    animTimer = setTimeout(function(){
      var med = svg.querySelector('.cp-mc__median');
      if (!med){
        svg.insertAdjacentHTML('beforeend', medianSvg + endDot);
      }
      updateStats(paths, a);
    }, 260);
    /* update stats immediately too so values never lag the visual */
    updateStats(paths, a);
  }

  function updateStats(paths, a){
    var finals = paths.map(function(p){ return p.finalBal; }).sort(function(x, y){ return x - y; });
    var medFinal = percentile(finals, 0.5);
    var winners = paths.filter(function(p){ return p.finalBal >= 1; }).length;
    var worstDD = paths.reduce(function(m, p){ return Math.max(m, p.maxDD); }, 0);
    var ruined  = paths.filter(function(p){ return p.ruined; }).length;

    var medPct = (medFinal - 1) * 100;
    set('-med', (medPct >= 0 ? '+' : '') + medPct.toFixed(0) + '%');
    set('-w', Math.round((winners / paths.length) * 100) + '%');
    set('-dd', '−' + (worstDD * 100).toFixed(0) + '%');
    set('-ruin', ((ruined / paths.length) * 100).toFixed(0) + '%');
  }

  function set(suffix, txt){
    var el = document.getElementById(PREFIX + suffix);
    if (el) el.textContent = txt;
  }

  if (edgeEl){
    edgeEl.textContent = Math.round(WR * 100) + '% win rate · 1:' + RR.toFixed(1) + ' R:R · ' + (RISK * 100).toFixed(0) + '% risk/trade';
  }

  var seedCounter = 0;
  function run(animate){
    seedCounter += 1;
    var rng = makeRng(0x9e3779b9 ^ (seedCounter * 2654435761));
    draw(simulate(rng), animate);
  }

  /* meaningful STATIC initial frame: deterministic seed, no animation */
  draw(simulate(makeRng(0x1f2e3d4c)), false);

  if (runBtn)   runBtn.addEventListener('click', function(){ run(true); });
  if (resetBtn) resetBtn.addEventListener('click', function(){ seedCounter = 0; draw(simulate(makeRng(0x1f2e3d4c)), false); });
}
