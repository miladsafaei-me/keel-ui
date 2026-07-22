var root = document.getElementById('{{ instance_id }}-root');
if (root && root.tagName === 'DETAILS') {
    var summary = root.querySelector('.cp-ecard__toggle');

    function syncState() {
        var open = root.hasAttribute('open');
        root.classList.toggle('is-open', open);
        if (summary) {
            summary.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    root.addEventListener('toggle', syncState);
    syncState();
}
