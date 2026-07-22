var root = document.getElementById('{{ instance_id }}-root');
var codeEl = document.getElementById('{{ instance_id }}-code');
var copyBtn = document.getElementById('{{ instance_id }}-copy');

if (root && codeEl) {
    var raw = codeEl.textContent.replace(/\s+$/, '');

    // Optional line-number gutter, built from the rendered source so the
    // numbers always match exactly what the reader sees.
    if (root.getAttribute('data-cp-linenums') === '1') {
        var lines = raw.split('\n');
        var gutter = document.createElement('span');
        gutter.className = 'cp-codeblock__gutter';
        gutter.setAttribute('aria-hidden', 'true');
        var frag = '';
        for (var i = 0; i < lines.length; i++) {
            frag += '<span class="cp-codeblock__ln">' + (i + 1) + '</span>';
        }
        gutter.innerHTML = frag;
        var pre = root.querySelector('.cp-codeblock__pre');
        if (pre) {
            pre.classList.add('cp-codeblock__pre--numbered');
            pre.insertBefore(gutter, pre.firstChild);
        }
    }

    if (copyBtn) {
        var resetTimer = null;
        copyBtn.addEventListener('click', function () {
            var done = function (ok) {
                copyBtn.classList.toggle('is-copied', ok);
                copyBtn.classList.toggle('is-failed', !ok);
                var label = copyBtn.querySelector('.cp-codeblock__copy-label');
                if (label) { label.textContent = ok ? 'Copied' : 'Press Ctrl+C'; }
                if (resetTimer) { clearTimeout(resetTimer); }
                resetTimer = setTimeout(function () {
                    copyBtn.classList.remove('is-copied', 'is-failed');
                    if (label) { label.textContent = 'Copy'; }
                }, 1800);
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(raw).then(function () { done(true); }, function () { done(false); });
            } else {
                try {
                    var ta = document.createElement('textarea');
                    ta.value = raw;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'absolute';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    var ok = document.execCommand('copy');
                    document.body.removeChild(ta);
                    done(ok);
                } catch (e) {
                    done(false);
                }
            }
        });
    }
}
