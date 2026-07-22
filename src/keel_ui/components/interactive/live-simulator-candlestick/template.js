var PREFIX = '{{ instance_id }}';
function el(suffix){ return document.getElementById(PREFIX + suffix); }
var svgEl = el('-svg'), playBtn = el('-play'), resetBtn = el('-reset'), speedEl = el('-speed');
var playLabel = el('-play-label'), playIc = playBtn ? playBtn.querySelector('.cp-sim__btn-ic') : null;
var statusEl = el('-status'), statusText = el('-status-text');
var N = {{ candles_total|default:80 }};
var W = 760, H = 280, PAD = {t:16, r:54, b:24, l:18};
var TP = {{ take_profit_pips|default:12 }};
var SL = {{ stop_loss_pips|default:8 }};
var MAX_HOLD = {{ max_hold_candles|default:10 }};
var PREVIEW = Math.min(N, 32);
var state = {i:0, prices:[], candles:[], trades:[], open:null, playing:false, started:false, timer:null, seed:0};

function rng(seed){
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function(){ s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
}
function genPrices(seed){
    var r = rng(seed), p = 1000, out = [];
    for (var i = 0; i < N; i++) { p += (r() - 0.5) * 8; out.push(p); }
    return out;
}
function genCandles(prices, seed){
    var r = rng(seed * 7 + 13), out = [];
    for (var i = 0; i < prices.length; i++) {
        var mid = prices[i];
        var rng2 = Math.abs((prices[i] - (i > 0 ? prices[i-1] : prices[i]))) * 1.2 + 1.5;
        var o = mid - (r() - 0.5) * rng2;
        var c = mid + (r() - 0.5) * rng2;
        var h = Math.max(o, c) + r() * rng2 * 0.5;
        var l = Math.min(o, c) - r() * rng2 * 0.5;
        out.push({o:o, h:h, l:l, c:c});
    }
    return out;
}
function scale(prices){
    var lo = Math.min.apply(null, prices), hi = Math.max.apply(null, prices);
    var pad = (hi - lo) * 0.10 || 1;
    lo -= pad; hi += pad;
    var pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    return {
        lo: lo, hi: hi,
        x: function(i){ return PAD.l + i/(N-1)*pw; },
        y: function(v){ return PAD.t + (1 - (v - lo)/(hi - lo)) * ph; }
    };
}
function shouldOpen(i){
    if (i < 6) return null;
    var p = state.prices, now = p[i], win5 = p.slice(i-5, i);
    var hi = Math.max.apply(null, win5), lo = Math.min.apply(null, win5);
    if (now < lo * 0.998) return 'long';
    if (now > hi * 1.002) return 'short';
    return null;
}
function maybeClose(i){
    if (!state.open) return;
    var hold = i - state.open.entryIdx, p = state.prices[i], e = state.open.entry;
    var move = p - e;
    if (state.open.side === 'short') move = -move;
    var pips = move, done = false;
    if (pips >= TP) done = true;
    else if (pips <= -SL) done = true;
    else if (hold >= MAX_HOLD) done = true;
    if (done) {
        state.open.exit = p;
        state.open.exitIdx = i;
        state.open.pips = pips;
        state.open.win = pips > 0;
        state.trades.push(state.open);
        state.open = null;
    }
}
function step(){
    if (state.i >= N) { pause(); setStatus('done'); return; }
    var i = state.i;
    maybeClose(i);
    if (!state.open) {
        var sig = shouldOpen(i);
        if (sig) state.open = {side:sig, entry:state.prices[i], entryIdx:i};
    }
    render();
    state.i++;
}
function candleSvg(c, i, s, ghost){
    var x = s.x(i), bw = Math.max(2, (W - PAD.l - PAD.r) / N * 0.66);
    var top = s.y(Math.max(c.o, c.c)), bot = s.y(Math.min(c.o, c.c));
    var bh = Math.max(1, bot - top);
    var dir = c.c >= c.o ? 'up' : 'down';
    var g = ghost ? ' cp-cdl--ghost' : '';
    var out = '<line class="cp-cdl-wick' + g + '" x1="' + x.toFixed(1) + '" y1="' + s.y(c.h).toFixed(1) + '" x2="' + x.toFixed(1) + '" y2="' + s.y(c.l).toFixed(1) + '"/>';
    out += '<rect class="cp-cdl-' + dir + g + '" x="' + (x - bw/2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="1"/>';
    return out;
}
function gridSvg(s){
    var svg = '';
    var x0 = PAD.l, x1 = W - PAD.r;
    for (var k = 0; k <= 4; k++) {
        var frac = k / 4;
        var y = PAD.t + frac * (H - PAD.t - PAD.b);
        var val = s.hi - frac * (s.hi - s.lo);
        svg += '<line class="cp-grid" x1="' + x0 + '" y1="' + y.toFixed(1) + '" x2="' + x1 + '" y2="' + y.toFixed(1) + '"/>';
        svg += '<text class="cp-axis-text" x="' + (x1 + 6) + '" y="' + (y + 3).toFixed(1) + '">' + val.toFixed(1) + '</text>';
    }
    return svg;
}
function render(){
    var s = scale(state.prices), svg = '';
    svg += gridSvg(s);

    if (!state.started) {
        for (var g = 0; g < PREVIEW; g++) {
            if (state.candles[g]) svg += candleSvg(state.candles[g], g, s, true);
        }
        var cx = (PAD.l + (W - PAD.r)) / 2, cy = (PAD.t + (H - PAD.b)) / 2;
        svg += '<g class="cp-sim__hint">'
             + '<circle class="cp-sim__hint-ring" cx="' + cx + '" cy="' + cy + '" r="22"/>'
             + '<path class="cp-sim__hint-tri" d="M' + (cx - 5) + ' ' + (cy - 8) + ' L' + (cx + 9) + ' ' + cy + ' L' + (cx - 5) + ' ' + (cy + 8) + ' Z"/>'
             + '<text class="cp-sim__hint-text" x="' + cx + '" y="' + (cy + 42) + '" text-anchor="middle">Press Play to run the bot</text>'
             + '</g>';
        svgEl.innerHTML = svg;
        return;
    }

    for (var i = 0; i < state.i; i++) {
        if (state.candles[i]) svg += candleSvg(state.candles[i], i, s, false);
    }

    if (state.open) {
        var oy = s.y(state.open.entry);
        var tpVal = state.open.side === 'long' ? state.open.entry + TP : state.open.entry - TP;
        var slVal = state.open.side === 'long' ? state.open.entry - SL : state.open.entry + SL;
        svg += '<line class="cp-sim__level cp-sim__level--tp" x1="' + PAD.l + '" y1="' + s.y(tpVal).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + s.y(tpVal).toFixed(1) + '"/>';
        svg += '<line class="cp-sim__level cp-sim__level--sl" x1="' + PAD.l + '" y1="' + s.y(slVal).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + s.y(slVal).toFixed(1) + '"/>';
        svg += '<line class="cp-sim__level cp-sim__level--entry" x1="' + PAD.l + '" y1="' + oy.toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + oy.toFixed(1) + '"/>';
    }

    state.trades.forEach(function(t){
        var x1 = s.x(t.entryIdx), x2 = s.x(t.exitIdx), y1 = s.y(t.entry), y2 = s.y(t.exit);
        svg += '<line class="' + (t.win ? 'cp-trade-link-win' : 'cp-trade-link-loss') + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
        var entryCls = t.side === 'long' ? 'cp-trade-entry-long' : 'cp-trade-entry-short';
        svg += '<circle class="' + entryCls + '" cx="' + x1.toFixed(1) + '" cy="' + y1.toFixed(1) + '" r="4.5"/>';
        svg += '<circle class="cp-trade-exit" cx="' + x2.toFixed(1) + '" cy="' + y2.toFixed(1) + '" r="3.5"/>';
    });

    if (state.open) {
        var ex = s.x(state.open.entryIdx), ey = s.y(state.open.entry);
        var entryCls = state.open.side === 'long' ? 'cp-trade-entry-long' : 'cp-trade-entry-short';
        svg += '<circle class="' + entryCls + '" cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="5.5">'
             + '<animate attributeName="r" values="5.5;8;5.5" dur="1.2s" repeatCount="indefinite"/></circle>';
    }

    var lastIdx = Math.max(0, state.i - 1);
    if (state.candles[lastIdx]) {
        var lc = state.candles[lastIdx], lx = s.x(lastIdx), ly = s.y(lc.c);
        var tagCls = lc.c >= lc.o ? 'cp-sim__last--up' : 'cp-sim__last--down';
        svg += '<line class="cp-sim__last-line" x1="' + lx.toFixed(1) + '" y1="' + ly.toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + ly.toFixed(1) + '"/>';
        svg += '<rect class="cp-sim__last-tag ' + tagCls + '" x="' + (W - PAD.r) + '" y="' + (ly - 8).toFixed(1) + '" width="50" height="16" rx="3"/>';
        svg += '<text class="cp-sim__last-text" x="' + (W - PAD.r + 25) + '" y="' + (ly + 3.5).toFixed(1) + '" text-anchor="middle">' + lc.c.toFixed(1) + '</text>';
    }

    svgEl.innerHTML = svg;
    updateStats();
}
function updateStats(){
    var n = state.trades.length;
    var wins = state.trades.filter(function(t){ return t.win; });
    var losses = state.trades.filter(function(t){ return !t.win; });
    var avgWin = wins.length ? wins.reduce(function(a, t){ return a + t.pips; }, 0) / wins.length : 0;
    var avgLoss = losses.length ? losses.reduce(function(a, t){ return a + t.pips; }, 0) / losses.length : 0;
    var pnl = state.trades.reduce(function(a, t){ return a + t.pips; }, 0);
    el('-trades').textContent = n;
    el('-wr').textContent = n ? (wins.length/n*100).toFixed(0) + '%' : '—';
    el('-aw').textContent = '+' + avgWin.toFixed(1);
    el('-al').textContent = avgLoss.toFixed(1);
    var pnlEl = el('-pnl');
    pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(1);
    pnlEl.className = 'cp-sim__stat-value ' + (pnl >= 0 ? 'cp-sim__stat-value--buy' : 'cp-sim__stat-value--sell');
}
function setStatus(s){
    if (!statusEl) return;
    statusEl.setAttribute('data-state', s);
    var labels = {idle:'Ready', live:'Live', paused:'Paused', done:'Run complete'};
    if (statusText) statusText.textContent = labels[s] || 'Ready';
}
function setPlayUi(playing){
    if (playIc) playIc.textContent = playing ? '⏸' : '▶';
    if (playLabel) playLabel.textContent = playing ? 'Pause' : 'Play';
}
function play(){
    if (state.playing) return;
    state.playing = true;
    state.started = true;
    setPlayUi(true);
    setStatus('live');
    schedule();
}
function pause(){
    state.playing = false;
    setPlayUi(false);
    if (state.i > 0 && state.i < N) setStatus('paused');
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
}
function schedule(){
    if (!state.playing) return;
    state.timer = setTimeout(function(){ step(); schedule(); }, parseInt(speedEl.value, 10));
}
function reset(){
    pause();
    state.seed = Math.floor(Math.random() * 1e6) + 1;
    state.prices = genPrices(state.seed);
    state.candles = genCandles(state.prices, state.seed);
    state.trades = [];
    state.open = null;
    state.i = 0;
    state.started = false;
    render();
    updateStats();
    setStatus('idle');
    setPlayUi(false);
}
playBtn.addEventListener('click', function(){
    if (state.playing) { pause(); }
    else { if (state.i >= N) reset(); play(); }
});
resetBtn.addEventListener('click', function(){ reset(); });
reset();
