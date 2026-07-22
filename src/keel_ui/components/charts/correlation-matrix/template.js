var PREFIX = '{{ instance_id }}';
var data = JSON.parse(document.getElementById(PREFIX + '-data').textContent);
var grid = document.getElementById(PREFIX + '-grid');
if (grid && data && data.symbols && data.matrix) {
    var n = data.symbols.length;

    function classFor(c, isDiag) {
        if (isDiag) { return 'cp-corr__cell--diag'; }
        var a = Math.abs(c);
        var dir = c >= 0 ? 'pos' : 'neg';
        var strength;
        if (a < 0.20) { strength = 'weak'; }
        else if (a < 0.50) { strength = 'mod'; }
        else if (a < 0.80) { strength = 'high'; }
        else { strength = 'max'; }
        return 'cp-corr__cell--val cp-corr__cell--' + dir + ' cp-corr__cell--' + strength;
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function render() {
        var html = '<div class="cp-corr__cell cp-corr__cell--corner"></div>';
        data.symbols.forEach(function (s, j) {
            html += '<div class="cp-corr__cell cp-corr__cell--colhead" data-col="' + j + '" title="' + esc(s) + '">' + esc(s) + '</div>';
        });
        data.matrix.forEach(function (row, i) {
            html += '<div class="cp-corr__cell cp-corr__cell--rowhead" data-row="' + i + '" title="' + esc(data.symbols[i]) + '">' + esc(data.symbols[i]) + '</div>';
            row.forEach(function (c, j) {
                var isDiag = i === j;
                var v = Math.max(-1, Math.min(1, Number(c)));
                var w = Math.abs(v).toFixed(3);
                var label = isDiag ? '1.00' : (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2);
                html += '<div class="cp-corr__cell ' + classFor(v, isDiag) +
                    '" data-row="' + i + '" data-col="' + j +
                    '" style="--w:' + w + '" title="' + esc(data.symbols[i]) + ' × ' + esc(data.symbols[j]) + ': ' + label + '">' +
                    label + '</div>';
            });
        });
        grid.innerHTML = html;
    }

    render();

    function setHi(r, c, on) {
        var sel = grid.querySelectorAll('[data-row="' + r + '"],[data-col="' + c + '"]');
        for (var i = 0; i < sel.length; i++) {
            sel[i].classList.toggle('cp-corr__cell--hi', on);
        }
    }

    grid.addEventListener('mouseover', function (e) {
        var cell = e.target.closest('.cp-corr__cell--val,.cp-corr__cell--diag');
        if (!cell) { return; }
        setHi(cell.getAttribute('data-row'), cell.getAttribute('data-col'), true);
    });
    grid.addEventListener('mouseout', function (e) {
        var cell = e.target.closest('.cp-corr__cell--val,.cp-corr__cell--diag');
        if (!cell) { return; }
        setHi(cell.getAttribute('data-row'), cell.getAttribute('data-col'), false);
    });
}
