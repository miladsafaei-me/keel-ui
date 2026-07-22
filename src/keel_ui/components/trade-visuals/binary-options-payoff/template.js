var PREFIX = '{{ instance_id }}';
var root = document.getElementById(PREFIX + '-root');
var svg = document.getElementById(PREFIX + '-svg');
if (root && svg) {
    var STRIKE = parseFloat(root.getAttribute('data-cp-strike'));
    var PAYOUT = parseFloat(root.getAttribute('data-cp-payout')) / 100;
    var STAKE = parseFloat(root.getAttribute('data-cp-stake'));
    var W = 600, H = 260, PADL = 54, PADR = 60, PADT = 34, PADB = 34;
    var xLo = STRIKE * 0.94, xHi = STRIKE * 1.06;
    var win = STAKE * PAYOUT, loss = -STAKE;
    var yLo = loss * 1.18, yHi = win * 1.28;
    function nx(p) { return PADL + (p - xLo) / (xHi - xLo) * (W - PADL - PADR); }
    function ny(p) { return PADT + (1 - (p - yLo) / (yHi - yLo)) * (H - PADT - PADB); }
    var sx = nx(STRIKE), xL = nx(xLo), xR = nx(xHi);
    var p = [];

    // ITM/OTM zones split by the strike — the single biggest clarity win.
    p.push('<rect x="' + xL + '" y="' + PADT + '" width="' + (sx - xL) + '" height="' + (H - PADT - PADB) + '" fill="var(--cp-danger)" opacity="0.05"/>');
    p.push('<rect x="' + sx + '" y="' + PADT + '" width="' + (xR - sx) + '" height="' + (H - PADT - PADB) + '" fill="var(--cp-success)" opacity="0.05"/>');
    p.push('<text x="' + ((xL + sx) / 2) + '" y="' + (PADT - 13) + '" fill="var(--cp-text-muted)" font-size="11" text-anchor="middle">Ends below strike</text>');
    p.push('<text x="' + ((sx + xR) / 2) + '" y="' + (PADT - 13) + '" fill="var(--cp-text-muted)" font-size="11" text-anchor="middle">Ends above strike</text>');

    // break-even (0) line + level labels on the value axis
    p.push('<line x1="' + xL + '" y1="' + ny(0) + '" x2="' + xR + '" y2="' + ny(0) + '" stroke="var(--cp-text-muted)" stroke-width="1.2"/>');
    p.push('<text x="' + (PADL - 9) + '" y="' + (ny(0) + 3) + '" fill="var(--cp-text-muted)" font-size="10" text-anchor="end">$0</text>');
    p.push('<text x="' + (PADL - 9) + '" y="' + (ny(win) + 3) + '" fill="var(--cp-success)" font-size="10" text-anchor="end">+$' + win.toFixed(0) + '</text>');
    p.push('<text x="' + (PADL - 9) + '" y="' + (ny(loss) + 3) + '" fill="var(--cp-danger)" font-size="10" text-anchor="end">-$' + STAKE.toFixed(0) + '</text>');

    // strike marker
    p.push('<line x1="' + sx + '" y1="' + PADT + '" x2="' + sx + '" y2="' + (H - PADB) + '" stroke="var(--cp-warning)" stroke-dasharray="4,3" stroke-width="1.3"/>');
    p.push('<text x="' + sx + '" y="' + (H - PADB + 17) + '" fill="var(--cp-warning)" font-size="11" text-anchor="middle">strike ' + STRIKE + '</text>');

    // a binary payoff is a single step: one level left of strike, another right,
    // joined by a dashed riser so the jump is explicit (offset risers so both read).
    function payoff(yLeft, yRight, color, riserX) {
        var yl = ny(yLeft), yr = ny(yRight);
        return '<line x1="' + xL + '" y1="' + yl + '" x2="' + sx + '" y2="' + yl + '" stroke="' + color + '" stroke-width="2.6"/>'
            + '<line x1="' + sx + '" y1="' + yr + '" x2="' + xR + '" y2="' + yr + '" stroke="' + color + '" stroke-width="2.6"/>'
            + '<line x1="' + riserX + '" y1="' + yl + '" x2="' + riserX + '" y2="' + yr + '" stroke="' + color + '" stroke-width="1.4" stroke-dasharray="3,3" opacity="0.6"/>';
    }
    // Call: loses below strike, wins above. Put: wins below, loses above.
    p.push(payoff(loss, win, 'var(--cp-success)', sx - 2));
    p.push(payoff(win, loss, 'var(--cp-danger)', sx + 2));

    // label each line where it WINS, so green vs red is never ambiguous
    p.push('<text x="' + (xR + 7) + '" y="' + (ny(win) + 4) + '" fill="var(--cp-success)" font-size="11" font-weight="700">Call</text>');
    p.push('<text x="' + (xR + 7) + '" y="' + (ny(loss) + 4) + '" fill="var(--cp-danger)" font-size="11" font-weight="700">Put</text>');

    svg.innerHTML = p.join('');
}
