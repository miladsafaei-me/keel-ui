var PREFIX = '{{ instance_id }}';
var root = document.getElementById(PREFIX + '-root');
var marker = document.getElementById(PREFIX + '-marker');
var nowEl = document.getElementById(PREFIX + '-now');
if (!root || !marker || !nowEl) { return; }

var sessions = {{ sessions|to_json }};
if (!Array.isArray(sessions)) { sessions = []; }

function isOpen(h, start, end) {
    if (end > start) { return h >= start && h < end; }
    return h >= start || h < end;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }

function setLabel(text, state) {
    nowEl.textContent = '';
    var pulse = document.createElement('span');
    pulse.className = 'cp-fxsc__now-pulse';
    pulse.setAttribute('aria-hidden', 'true');
    nowEl.appendChild(pulse);
    nowEl.appendChild(document.createTextNode(text));
    nowEl.classList.add('cp-fxsc__now--live');
    nowEl.classList.remove('cp-fxsc__now--quiet', 'cp-fxsc__now--open', 'cp-fxsc__now--overlap');
    nowEl.classList.add('cp-fxsc__now--' + state);
}

function render() {
    var now = new Date();
    var h = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    var clock = pad(now.getUTCHours()) + ':' + pad(now.getUTCMinutes()) + ' UTC';
    var pct = h / 24 * 100;

    marker.style.left = pct + '%';
    marker.hidden = false;
    {% comment %} Keep the marker chip inside the track: clamp its text alignment near the edges. {% endcomment %}
    marker.classList.toggle('cp-fxsc__now-marker--near-start', pct < 12);
    marker.classList.toggle('cp-fxsc__now-marker--near-end', pct > 88);

    var open = [];
    sessions.forEach(function (s) {
        if (s && isOpen(h, s.start, s.end)) { open.push(s.name); }
    });

    var dot = marker.querySelector('.cp-fxsc__now-dot');
    if (dot) {
        dot.textContent = '';
        var chip = document.createElement('span');
        chip.className = 'cp-fxsc__now-chip';
        chip.textContent = clock;
        dot.appendChild(chip);
    }

    marker.classList.remove('cp-fxsc__now-marker--quiet', 'cp-fxsc__now-marker--open', 'cp-fxsc__now-marker--overlap');

    if (open.length === 0) {
        setLabel(clock + ' · markets quiet', 'quiet');
        marker.classList.add('cp-fxsc__now-marker--quiet');
    } else if (open.length === 1) {
        setLabel(clock + ' · ' + open[0] + ' open', 'open');
        marker.classList.add('cp-fxsc__now-marker--open');
    } else {
        setLabel(clock + ' · ' + open.join(' + ') + ' overlap', 'overlap');
        marker.classList.add('cp-fxsc__now-marker--overlap');
    }
}

render();
setInterval(render, 15000);
