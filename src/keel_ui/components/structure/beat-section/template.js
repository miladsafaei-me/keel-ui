var root = document.getElementById("{{ instance_id }}-root");
if (root) {
  var fill = root.querySelector(".cp-beat__progress-fill");
  if (fill) {
    var pct = parseInt(fill.getAttribute("data-percent"), 10);
    if (isNaN(pct)) pct = 0;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    fill.style.width = pct + "%";
  }
}
