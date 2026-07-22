var root = document.getElementById('{{ instance_id }}-root');
if (root) {
  var canvas = document.getElementById('{{ instance_id }}');
  var legendEl = document.getElementById('{{ instance_id }}-legend');
  var totalEl = document.getElementById('{{ instance_id }}-total');

  var labels = [], values = [];
  try { labels = JSON.parse(canvas.getAttribute('data-cp-doughnut-labels')) || []; } catch (e) {}
  try { values = JSON.parse(canvas.getAttribute('data-cp-doughnut-values')) || []; } catch (e) {}
  var prefix = canvas.getAttribute('data-cp-doughnut-prefix') || '';
  var suffix = canvas.getAttribute('data-cp-doughnut-suffix') || '';

  var theme = window.cpTheme || null;
  var BRAND = ['#2563eb', '#0891b2', '#a78bfa', '#d97706', '#ec4899', '#14b8a6'];
  var colors = (theme && typeof theme.series === 'function') ? theme.series() : BRAND;
  var dark = !!(theme && typeof theme.isDark === 'function' && theme.isDark());

  function colorAt(i) { return colors[i % colors.length]; }

  var total = values.reduce(function (a, b) { return a + (Number(b) || 0); }, 0);

  function fmtNum(n) {
    var r = Math.round(n);
    return r.toLocaleString('en-US');
  }
  function fmtValue(n) { return prefix + fmtNum(n) + suffix; }
  function fmtShare(n) {
    if (!total) return '0%';
    var pct = (n / total) * 100;
    return (pct >= 9.95 ? Math.round(pct) : Math.round(pct * 10) / 10) + '%';
  }

  // Center total in the doughnut hole.
  if (totalEl) totalEl.textContent = total ? fmtValue(total) : '0';

  // Custom HTML legend: swatch + label + value + share. Far more legible than the
  // canvas legend, and the swatch reuses the exact slice palette so they match.
  // Built as real DOM nodes so each swatch colour is fed to a CSS custom property
  // at runtime — the colour is applied by the .cp-doughnut__swatch rule, not by an
  // inline colour declaration in markup.
  if (legendEl) {
    for (var i = 0; i < labels.length; i++) {
      var v = Number(values[i]) || 0;
      var li = document.createElement('li');
      li.className = 'cp-doughnut__item';

      var sw = document.createElement('span');
      sw.className = 'cp-doughnut__swatch';
      sw.style.setProperty('--cp-d-swatch', colorAt(i));

      var name = document.createElement('span');
      name.className = 'cp-doughnut__name';
      name.textContent = labels[i];

      var val = document.createElement('span');
      val.className = 'cp-doughnut__val';
      val.textContent = fmtValue(v);

      var pct = document.createElement('span');
      pct.className = 'cp-doughnut__pct';
      pct.textContent = fmtShare(v);

      li.appendChild(sw);
      li.appendChild(name);
      li.appendChild(val);
      li.appendChild(pct);
      legendEl.appendChild(li);
    }
  }

  // Plugin: gentle inner ring so the hole reads as a deliberate well, not a gap.
  var ringPlugin = {
    id: 'cpDoughnutRing-{{ instance_id }}',
    beforeDraw: function (chart) {
      var ca = chart.chartArea;
      if (!ca) return;
      var meta = chart.getDatasetMeta(0);
      var arc = meta && meta.data && meta.data[0];
      if (!arc) return;
      var ctx = chart.ctx;
      var cx = arc.x, cy = arc.y;
      var r = arc.innerRadius - 1;
      if (r <= 0) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, 2 * Math.PI);
      ctx.lineWidth = 1;
      ctx.strokeStyle = dark ? 'rgba(180,196,224,0.22)' : 'rgba(100,116,139,0.20)';
      ctx.stroke();
      ctx.restore();
    }
  };

  function build() {
    if (!window.Chart) return false;
    var C = window.Chart;
    var bg = labels.map(function (_l, i) { return colorAt(i); });
    var border = dark ? 'rgba(19,28,48,0.9)' : '#ffffff';

    new C(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 3,
          hoverBorderColor: border,
          hoverOffset: 8,
          spacing: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '66%',
        layout: { padding: 4 },
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          title: { display: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (ctx) {
                var v = Number(ctx.parsed) || 0;
                return '  ' + fmtValue(v) + '  ·  ' + fmtShare(v) + ' of total';
              }
            }
          }
        }
      },
      plugins: [ringPlugin]
    });
    return true;
  }

  // The shared content-pipeline.js loads Chart.js when it sees any <canvas>.
  // Poll for the global the same way hand-authored pipeline charts do.
  if (!build()) {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (build() || tries > 80) clearInterval(timer);
    }, 60);
  }
}
