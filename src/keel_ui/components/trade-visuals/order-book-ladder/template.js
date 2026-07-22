(function () {
  var ROOT = document.getElementById("{{ instance_id }}-root");
  if (!ROOT) return;

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  /* Decide price decimals from the magnitude of the values so a BTC book
     (64280.5) and an FX book (1.07412) both read cleanly. */
  function priceDecimals(values) {
    var maxAbs = 0;
    values.forEach(function (v) {
      var a = Math.abs(v);
      if (a > maxAbs) maxAbs = a;
    });
    if (maxAbs >= 1000) return 2;
    if (maxAbs >= 100) return 2;
    if (maxAbs >= 10) return 3;
    if (maxAbs >= 1) return 4;
    return 5;
  }

  function fmtPrice(v, dec) {
    return v.toLocaleString(undefined, {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  }

  /* Sizes: keep up to 4 sig decimals but trim trailing zeros, group thousands. */
  function fmtSize(v) {
    var dec = v >= 1000 ? 2 : v >= 1 ? 3 : 4;
    return v.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: dec,
    });
  }

  /* The ask side renders best-ask LAST (closest to mid) because rows print
     in reversed order in the DOM. Bids render best-bid FIRST. To make the
     cumulative column meaningful, walk each side from the row nearest the mid
     outward. */
  var askRows = [].slice.call(ROOT.querySelectorAll(".cp-obl__row--ask"));
  var bidRows = [].slice.call(ROOT.querySelectorAll(".cp-obl__row--bid"));
  if (!askRows.length || !bidRows.length) return;

  var allPrices = [];
  askRows.concat(bidRows).forEach(function (r) {
    allPrices.push(num(r.getAttribute("data-cp-price")));
  });
  var dec = priceDecimals(allPrices);

  /* best ask = lowest ask price; best bid = highest bid price. */
  var askPrices = askRows.map(function (r) { return num(r.getAttribute("data-cp-price")); });
  var bidPrices = bidRows.map(function (r) { return num(r.getAttribute("data-cp-price")); });
  var bestAsk = Math.min.apply(null, askPrices);
  var bestBid = Math.max.apply(null, bidPrices);

  /* Cumulative totals + global max for proportional depth bars. */
  var maxCum = 0;

  function applyCumulative(rows, nearestFirstIndex) {
    /* rows ordered as in DOM; cumulate starting from the row nearest the mid. */
    var ordered = nearestFirstIndex === "last" ? rows.slice().reverse() : rows.slice();
    var running = 0;
    var meta = [];
    ordered.forEach(function (r) {
      var size = num(r.getAttribute("data-cp-size"));
      running += size;
      if (running > maxCum) maxCum = running;
      meta.push({ row: r, size: size, cum: running });
    });
    return meta;
  }

  /* Asks: DOM is reversed (worst ask first, best ask last) → nearest is last. */
  var askMeta = applyCumulative(askRows, "last");
  /* Bids: DOM is best-first → nearest is first. */
  var bidMeta = applyCumulative(bidRows, "first");

  if (maxCum <= 0) maxCum = 1;

  function paint(meta) {
    meta.forEach(function (m) {
      var price = num(m.row.getAttribute("data-cp-price"));
      var p = m.row.querySelector(".cp-obl__cell--price");
      var s = m.row.querySelector(".cp-obl__cell--size");
      var t = m.row.querySelector(".cp-obl__cell--total");
      if (p) p.textContent = fmtPrice(price, dec);
      if (s) s.textContent = fmtSize(m.size);
      if (t) t.textContent = fmtSize(m.cum);
      /* depth fraction (0..1) drives the bar width via CSS calc. */
      m.row.style.setProperty("--cp-depth", (m.cum / maxCum).toFixed(4));
    });
  }
  paint(askMeta);
  paint(bidMeta);

  /* Mid price + spread. */
  var mid = (bestAsk + bestBid) / 2;
  var spreadAbs = bestAsk - bestBid;
  var spreadPct = mid > 0 ? (spreadAbs / mid) * 100 : 0;
  var spreadBps = spreadPct * 100;

  var midEl = document.getElementById("{{ instance_id }}-midprice");
  if (midEl) midEl.textContent = fmtPrice(mid, dec);

  var lastEl = document.getElementById("{{ instance_id }}-last");
  if (lastEl) {
    var lastVal = num(lastEl.getAttribute("data-cp-last"));
    lastEl.textContent = fmtPrice(lastVal, dec);
  }

  var spreadEl = document.getElementById("{{ instance_id }}-spread");
  if (spreadEl) {
    var valEl = spreadEl.querySelector(".cp-obl__spread-val");
    if (valEl) {
      var bpsTxt = spreadBps >= 1
        ? Math.round(spreadBps) + " bps"
        : spreadBps.toFixed(1) + " bps";
      valEl.textContent = fmtPrice(spreadAbs, dec) + " · " + bpsTxt;
    }
  }
})();
