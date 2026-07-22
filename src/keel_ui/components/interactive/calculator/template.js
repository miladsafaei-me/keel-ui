var PREFIX = '{{ instance_id }}';
var root = document.getElementById(PREFIX + '-root');
if (!root) { return; }
var cfgEl = document.getElementById(PREFIX + '-cfg');
var outputs = [];
try { outputs = JSON.parse((cfgEl && cfgEl.textContent) || '[]'); } catch (e) { outputs = []; }

var FUNCS = {
    min: Math.min, max: Math.max, abs: Math.abs, round: Math.round,
    floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, pow: Math.pow,
    clamp: function (x, a, b) { return Math.min(Math.max(x, a), b); }
};

// Safe arithmetic evaluator (recursive descent, no eval -> CSP-safe).
function evaluate(expr, vars) {
    var s = String(expr), i = 0;
    function ws() { while (i < s.length && (s[i] === ' ' || s[i] === '\t')) { i++; } }
    function pExpr() {
        var v = pTerm(); ws();
        while (i < s.length && (s[i] === '+' || s[i] === '-')) {
            var op = s[i++]; var r = pTerm(); v = op === '+' ? v + r : v - r; ws();
        }
        return v;
    }
    function pTerm() {
        var v = pFac(); ws();
        while (i < s.length && (s[i] === '*' || s[i] === '/' || s[i] === '%')) {
            var op = s[i++]; var r = pFac();
            v = op === '*' ? v * r : op === '/' ? (r === 0 ? 0 : v / r) : (r === 0 ? 0 : v % r);
            ws();
        }
        return v;
    }
    function pFac() {
        ws();
        if (s[i] === '-') { i++; return -pFac(); }
        if (s[i] === '+') { i++; return pFac(); }
        return pPrim();
    }
    function pPrim() {
        ws();
        var c = s[i];
        if (c === '(') { i++; var v = pExpr(); ws(); if (s[i] === ')') { i++; } return v; }
        if ((c >= '0' && c <= '9') || c === '.') {
            var j = i; while (j < s.length && ((s[j] >= '0' && s[j] <= '9') || s[j] === '.')) { j++; }
            var n = parseFloat(s.slice(i, j)); i = j; return n;
        }
        if (/[a-zA-Z_]/.test(c)) {
            var k = i; while (k < s.length && /[a-zA-Z0-9_]/.test(s[k])) { k++; }
            var name = s.slice(i, k); i = k; ws();
            if (s[i] === '(') {
                i++; var args = []; ws();
                if (s[i] !== ')') { args.push(pExpr()); ws(); while (s[i] === ',') { i++; args.push(pExpr()); ws(); } }
                if (s[i] === ')') { i++; }
                var fn = FUNCS[name]; return fn ? fn.apply(null, args) : 0;
            }
            var val = vars[name];
            return (val === undefined || val === null || isNaN(val)) ? 0 : Number(val);
        }
        i++; return 0;
    }
    var res = pExpr();
    return (typeof res === 'number' && isFinite(res)) ? res : 0;
}

function group(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function fmtNumber(n, dec) {
    var neg = n < 0, x = Math.abs(n);
    var s = dec > 0 ? x.toFixed(dec) : String(Math.round(x));
    var p = s.split('.'); p[0] = group(p[0]);
    return (neg ? '-' : '') + p.join('.');
}
function stepDecimals(stepStr) {
    var p = String(stepStr || '').split('.');
    return p[1] ? Math.min(p[1].length, 2) : 0;
}
function fmtOutput(n, o) {
    var fmt = o.format || 'number';
    var dec = (o.decimals != null) ? o.decimals
        : (fmt === 'currency' ? 0 : fmt === 'percent' ? 1 : fmt === 'ratio' ? 2 : 0);
    var core;
    if (fmt === 'currency') { core = (n < 0 ? '-$' : '$') + fmtNumber(Math.abs(n), dec); }
    else if (fmt === 'percent') { core = fmtNumber(n, dec) + '%'; }
    else if (fmt === 'ratio') { core = '1:' + fmtNumber(Math.abs(n), dec); }
    else { core = fmtNumber(n, dec); }
    return (o.prefix || '') + core + (o.suffix || '');
}
function fmtInput(val, prefix, unit, dec) {
    var core = fmtNumber(val, dec);
    var u = unit ? (unit === '%' ? '%' : ' ' + unit) : '';
    return (prefix || '') + core + u;
}

var keyed = root.querySelectorAll('[data-cp-key]');
function gather() {
    var vars = {};
    keyed.forEach(function (node) {
        var key = node.getAttribute('data-cp-key');
        var type = node.getAttribute('data-cp-type');
        if (type === 'segmented') {
            var sel = node.querySelector('input:checked');
            vars[key] = sel ? (parseFloat(sel.value) || 0) : 0;
        } else if (type === 'toggle') {
            vars[key] = node.checked
                ? (parseFloat(node.getAttribute('data-cp-on')) || 0)
                : (parseFloat(node.getAttribute('data-cp-off')) || 0);
        } else {
            vars[key] = parseFloat(node.value) || 0;
        }
    });
    return vars;
}
function refreshSliders() {
    keyed.forEach(function (node) {
        if (node.getAttribute('data-cp-type') !== 'slider') { return; }
        var lbl = document.getElementById(node.id.replace('-in-', '-inv-'));
        if (lbl) {
            lbl.textContent = fmtInput(
                parseFloat(node.value) || 0,
                node.getAttribute('data-cp-prefix'),
                node.getAttribute('data-cp-unit'),
                stepDecimals(node.getAttribute('step'))
            );
        }
    });
}
function recompute() {
    refreshSliders();
    var vars = gather();
    for (var k = 0; k < outputs.length; k++) {
        var o = outputs[k];
        var node = document.getElementById(PREFIX + '-out-' + k);
        if (!node) { continue; }
        var val = evaluate(o.expr, vars);
        node.textContent = fmtOutput(val, o);
        if (o.sign_color) {
            node.className = 'cp-calc__output-value ' + (val >= 0 ? 'cp-calc__output-value--success' : 'cp-calc__output-value--danger');
        }
    }
}
root.querySelectorAll('input').forEach(function (n) {
    n.addEventListener('input', recompute);
    n.addEventListener('change', recompute);
});
root.querySelectorAll('.cp-calc__stepper-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
        var wrap = btn.closest('.cp-calc__stepper');
        var inp = wrap.querySelector('input');
        var dir = parseFloat(btn.getAttribute('data-cp-step')) || 1;
        var stepSize = parseFloat(inp.step) || 1;
        var next = (parseFloat(inp.value) || 0) + dir * stepSize;
        var mn = inp.min !== '' ? parseFloat(inp.min) : -Infinity;
        var mx = inp.max !== '' ? parseFloat(inp.max) : Infinity;
        inp.value = Math.min(Math.max(next, mn), mx);
        recompute();
    });
});
recompute();
