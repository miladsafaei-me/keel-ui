(function () {
    'use strict';

    // Copy buttons next to each <pre> code block.
    var targets = {
        example: 'cl-example-code',
        schema: 'cl-schema-code',
        manifest: 'cl-manifest-code',
        html: 'cl-html-code'
    };

    document.querySelectorAll('[data-cl-copy]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var key = btn.getAttribute('data-cl-copy');
            var el = document.getElementById(targets[key]);
            if (!el) { return; }
            var text = el.innerText;
            (navigator.clipboard && navigator.clipboard.writeText
                ? navigator.clipboard.writeText(text)
                : Promise.reject('clipboard unavailable')
            ).then(function () {
                var prev = btn.textContent;
                btn.setAttribute('data-state', 'copied');
                btn.textContent = 'Copied';
                setTimeout(function () {
                    btn.removeAttribute('data-state');
                    btn.textContent = prev;
                }, 1400);
            }).catch(function () {
                // Fallback for browsers without clipboard API: select the text.
                var range = document.createRange();
                range.selectNodeContents(el);
                var sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            });
        });
    });
})();
