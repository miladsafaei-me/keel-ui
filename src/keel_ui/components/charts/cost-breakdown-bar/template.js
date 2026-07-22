(function () {
  var root = document.getElementById("{{ instance_id }}-root");
  if (!root) return;

  var items = root.querySelectorAll(".cp-costbar__item");
  var total = 0;
  var vals = [];

  items.forEach(function (li) {
    var el = li.querySelector(".cp-costbar__item-value");
    if (!el) return;
    /* Strip the unit span text so we parse only the numeric part. */
    var raw = (el.firstChild && el.firstChild.nodeValue) || el.textContent || "";
    var n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
    if (!isFinite(n)) n = 0;
    vals.push({ li: li, n: n });
    total += n;
  });

  if (total <= 0) total = 1;

  /* Append a per-item percentage-of-total chip. */
  vals.forEach(function (v) {
    var pct = (v.n / total) * 100;
    var chip = v.li.querySelector(".cp-costbar__item-pct");
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "cp-costbar__item-pct";
      v.li.appendChild(chip);
    }
    chip.textContent = pct.toFixed(pct < 10 ? 1 : 0) + "%";
  });

  /* Fill the prominent total, preserving the unit span. */
  var totalEl = document.getElementById("{{ instance_id }}-total");
  if (totalEl) {
    var unitSpan = totalEl.querySelector(".cp-costbar__total-unit");
    var sumStr = (Math.round(total * 100) / 100).toString();
    totalEl.textContent = sumStr;
    if (unitSpan) totalEl.appendChild(unitSpan);
  }
})();
