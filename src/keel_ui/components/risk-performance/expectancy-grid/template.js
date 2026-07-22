var PREFIX = '{{ instance_id }}';
var grid = document.getElementById(PREFIX + '-grid');
var readout = document.getElementById(PREFIX + '-readout');
var WRs = {{ win_rates|to_json }};
var RRs = {{ rr_ratios|to_json }};
function ev(wr, rr){ return (wr/100) * rr * 100 - (1 - wr/100) * 100; }
function rgb(theme){
    return theme === 'dark'
        ? {pos: '94,226,154', neg: '255,139,157'}
        : {pos: '22,163,74',  neg: '220,38,38'};
}
function detect(){
    var dark = (window.cpTheme && window.cpTheme.isDark && window.cpTheme.isDark())
        || document.documentElement.classList.contains('dark')
        || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return dark ? 'dark' : 'light';
}
function color(e, theme){
    var r = rgb(theme), max = 80;
    var t = Math.max(-1, Math.min(1, e/max));
    var alpha = (theme === 'dark' ? 0.22 : 0.18) + Math.abs(t) * (theme === 'dark' ? 0.65 : 0.7);
    return 'rgba(' + (t >= 0 ? r.pos : r.neg) + ',' + alpha.toFixed(2) + ')';
}
function paint(){
    var theme = detect();
    var html = '<div class="cp-heatmap-axis" style="font-size:0.66rem">R:R ↓ / WR →</div>';
    WRs.forEach(function(wr){ html += '<div class="cp-heatmap-axis">' + wr + '%</div>'; });
    RRs.slice().reverse().forEach(function(rr){
        html += '<div class="cp-heatmap-axis">1:' + rr + '</div>';
        WRs.forEach(function(wr){
            var e = ev(wr, rr);
            html += '<div class="cp-heatmap-cell" data-wr="' + wr + '" data-rr="' + rr + '"'
                  + ' data-ev="' + e.toFixed(1) + '" style="background:' + color(e, theme) + '">'
                  + (e >= 0 ? '+' : '') + e.toFixed(0) + '</div>';
        });
    });
    grid.innerHTML = html;
}
paint();
if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) { mq.addEventListener('change', paint); }
    else if (mq.addListener) { mq.addListener(paint); }
}
grid.addEventListener('mouseover', function(e){
    var c = e.target;
    if (!c.classList || !c.classList.contains('cp-heatmap-cell')) return;
    var wr = c.dataset.wr, rr = c.dataset.rr, val = parseFloat(c.dataset.ev);
    readout.innerHTML = '<strong>' + wr + '% win rate</strong> × <strong>1:' + rr + ' R:R</strong> → EV = '
        + (val >= 0 ? '<span class="cp-success-text">+$' : '<span class="cp-danger-text">-$')
        + Math.abs(val).toFixed(2) + '</span> per $100 risked / trade';
});
