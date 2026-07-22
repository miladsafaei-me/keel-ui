var root = document.getElementById('{{ instance_id }}-root');
if (root) {
    var items = root.querySelectorAll('.cp-checklist__item');
    var progress = root.querySelector('[data-cp-progress]');
    var fill = root.querySelector('[data-cp-fill]');
    var track = root.querySelector('[role="progressbar"]');
    var total = items.length;

    function refresh() {
        var done = 0;
        items.forEach(function (i) {
            if (i.getAttribute('data-checked') === 'true') { done++; }
        });
        var pct = total ? Math.round((done / total) * 100) : 0;
        if (progress) { progress.textContent = done + ' / ' + total; }
        if (fill) { fill.style.width = pct + '%'; }
        if (track) { track.setAttribute('aria-valuenow', String(done)); }
        root.setAttribute('data-complete', done === total && total > 0 ? 'true' : 'false');
    }

    function toggle(i) {
        var next = i.getAttribute('data-checked') === 'true' ? 'false' : 'true';
        i.setAttribute('data-checked', next);
        i.setAttribute('aria-checked', next);
        refresh();
    }

    items.forEach(function (i) {
        i.addEventListener('click', function () { toggle(i); });
        i.addEventListener('keydown', function (e) {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggle(i);
            }
        });
    });

    refresh();
}
