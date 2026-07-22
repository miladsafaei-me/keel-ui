var PREFIX = '{{ instance_id }}';
var root = document.getElementById(PREFIX + '-root');
if (root) {
  var DEC = parseInt(root.getAttribute('data-cp-dec'), 10);
  if (!isFinite(DEC)) DEC = 4;
  var MINUS = '−';

  function el(s) { return document.getElementById(PREFIX + s); }
  function v(s) { return parseFloat(el(s).value); }
  function fmt(n) { return n.toFixed(DEC); }

  function render() {
    var entry = v('-e'), sl = v('-sl'), tp = v('-tp');
    if (!isFinite(entry) || !isFinite(sl) || !isFinite(tp)) return;

    var isLong = tp >= entry;
    var risk = Math.abs(entry - sl);
    var reward = Math.abs(tp - entry);
    var rr = risk > 0 ? reward / risk : 0;
    var beWR = rr > 0 ? (1 / (rr + 1)) * 100 : 100;

    var top = Math.max(tp, sl, entry);
    var bot = Math.min(tp, sl, entry);
    var range = top - bot;
    function pos(price) { return range > 0 ? ((top - price) / range) * 100 : 50; }

    var entryPct = pos(entry);

    var rewardTop = isLong ? pos(tp) : entryPct;
    var rewardH = isLong ? (entryPct - pos(tp)) : (pos(tp) - entryPct);
    var riskTop = isLong ? entryPct : pos(sl);
    var riskH = isLong ? (pos(sl) - entryPct) : (entryPct - pos(sl));

    var bands = el('-bands');
    bands.innerHTML =
        '<div class="cp-rrv__band cp-rrv__band--reward" style="top:' + rewardTop.toFixed(3) + '%;height:' + Math.max(rewardH, 0).toFixed(3) + '%">'
      +   '<span class="cp-rrv__band-tag">Reward zone</span>'
      +   '<span class="cp-rrv__band-amt">+' + fmt(reward) + '</span>'
      + '</div>'
      + '<div class="cp-rrv__band cp-rrv__band--risk" style="top:' + riskTop.toFixed(3) + '%;height:' + Math.max(riskH, 0).toFixed(3) + '%">'
      +   '<span class="cp-rrv__band-tag">Risk zone</span>'
      +   '<span class="cp-rrv__band-amt">' + MINUS + fmt(risk) + '</span>'
      + '</div>';

    var lines = [
      { p: tp,    cls: 'tp',    label: 'TP ' + fmt(tp) },
      { p: entry, cls: 'entry', label: 'Entry ' + fmt(entry) },
      { p: sl,    cls: 'sl',    label: 'SL ' + fmt(sl) }
    ];
    el('-ladder').innerHTML = lines.map(function (l) {
      return '<div class="cp-rrv__line cp-rrv__line--' + l.cls + '" style="top:' + pos(l.p).toFixed(3) + '%">'
           +   '<span class="cp-rrv__pill">' + l.label + '</span>'
           + '</div>';
    }).join('');

    el('-risk').textContent = fmt(risk);
    el('-reward').textContent = fmt(reward);
    el('-rr').textContent = '1 : ' + rr.toFixed(2);
    el('-be').textContent = beWR.toFixed(1) + '%';

    var dir = el('-dir');
    dir.textContent = isLong ? 'Long setup' : 'Short setup';
    dir.setAttribute('data-dir', isLong ? 'long' : 'short');

    var note = el('-note');
    if (rr >= 1) {
      note.textContent = 'You aim for ' + rr.toFixed(2) + 'x what you risk';
    } else if (rr > 0) {
      note.textContent = 'Reward is smaller than risk';
    } else {
      note.textContent = 'Set a stop to define risk';
    }
    el('-ratiowrap').setAttribute('data-good', rr >= 1 ? 'true' : 'false');
  }

  root.querySelectorAll('input').forEach(function (n) { n.addEventListener('input', render); });
  render();
}
