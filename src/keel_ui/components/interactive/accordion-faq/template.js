var root = document.getElementById('{{ instance_id }}-root');
if (root) {
    var items = Array.prototype.slice.call(root.querySelectorAll('.cp-accordion__item'));

    function setOpen(item, open) {
        var header = item.querySelector('.cp-accordion__header');
        item.classList.toggle('is-open', open);
        item.setAttribute('data-open', open ? 'true' : 'false');
        if (header) {
            header.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    items.forEach(function (item) {
        var header = item.querySelector('.cp-accordion__header');
        if (!header) { return; }
        header.addEventListener('click', function () {
            var willOpen = item.getAttribute('data-open') !== 'true';
            items.forEach(function (other) {
                if (other !== item) { setOpen(other, false); }
            });
            setOpen(item, willOpen);
        });
    });
}
