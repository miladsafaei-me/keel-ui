var PREFIX = '{{ instance_id }}';
var canvas = document.getElementById(PREFIX + '-canvas');
var dataEl = document.getElementById(PREFIX + '-data');
if (!canvas || !dataEl) return;

var ROOT;
try {
  ROOT = JSON.parse(dataEl.textContent);
} catch (e) {
  return;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function toneClass(tone) {
  if (tone === 'success') return ' cp-dtree__card--success';
  if (tone === 'danger') return ' cp-dtree__card--danger';
  if (tone === 'warning') return ' cp-dtree__card--warning';
  return '';
}

function toneGlyph(tone) {
  if (tone === 'success') return '&#10003;';
  if (tone === 'danger') return '&#10005;';
  if (tone === 'warning') return '&#33;';
  return '&#8226;';
}

function cardHtml(node) {
  var isOutcome = node.kind === 'outcome';
  var cls = 'cp-dtree__card cp-dtree__card--' + (isOutcome ? 'outcome' : 'decision') + toneClass(node.tone);
  var html = '<div class="' + cls + '">';
  if (isOutcome) {
    html += '<span class="cp-dtree__badge" aria-hidden="true">' + toneGlyph(node.tone) + '</span>';
  } else {
    html += '<span class="cp-dtree__q" aria-hidden="true">?</span>';
  }
  html += '<span class="cp-dtree__card-body">';
  html += '<span class="cp-dtree__label">' + esc(node.label) + '</span>';
  if (node.detail) html += '<span class="cp-dtree__detail">' + esc(node.detail) + '</span>';
  html += '</span></div>';
  return html;
}

function renderNode(node, depth) {
  var html = '<div class="cp-dtree__node" data-depth="' + depth + '">';
  html += cardHtml(node);

  var kids = (node.kind === 'decision' && node.branches) ? node.branches : null;
  if (kids && kids.length) {
    var n = kids.length;
    html += '<div class="cp-dtree__trunk" aria-hidden="true"></div>';
    html += '<div class="cp-dtree__branches" data-count="' + n + '">';
    kids.forEach(function (b, i) {
      var pos = n === 1 ? 'only' : (i === 0 ? 'first' : (i === n - 1 ? 'last' : 'mid'));
      html += '<div class="cp-dtree__branch" data-pos="' + pos + '">';
      html += '<div class="cp-dtree__connector" aria-hidden="true"><span class="cp-dtree__edge-label">' + esc(b.label) + '</span></div>';
      html += renderNode(b.node || {}, depth + 1);
      html += '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

canvas.innerHTML = renderNode(ROOT, 0);
