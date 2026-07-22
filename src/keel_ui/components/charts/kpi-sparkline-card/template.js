var root = document.getElementById("{{ instance_id }}-root");
if (root) {
  var W = 100, H = 34, PAD_X = 1.5, PAD_TOP = 4, PAD_BOT = 3.5;
  var cards = root.querySelectorAll(".cp-kpi__card");
  for (var ci = 0; ci < cards.length; ci++) {
    var card = cards[ci];
    var holder = card.querySelector(".cp-kpi__spark-data");
    var svg = card.querySelector(".cp-kpi__svg");
    if (!holder || !svg) { continue; }
    var raw = (holder.getAttribute("data-spark") || "").split(",");
    var vals = [];
    for (var i = 0; i < raw.length; i++) {
      var n = parseFloat(raw[i]);
      if (!isNaN(n) && isFinite(n)) { vals.push(n); }
    }
    if (vals.length < 2) { continue; }

    var min = vals[0], max = vals[0];
    for (var k = 1; k < vals.length; k++) {
      if (vals[k] < min) { min = vals[k]; }
      if (vals[k] > max) { max = vals[k]; }
    }
    var span = max - min;
    var plotH = H - PAD_TOP - PAD_BOT;
    var step = (W - PAD_X * 2) / (vals.length - 1);

    var pts = [];
    for (var j = 0; j < vals.length; j++) {
      var x = PAD_X + step * j;
      var y;
      if (span === 0) {
        y = PAD_TOP + plotH / 2;
      } else {
        y = PAD_TOP + plotH * (1 - (vals[j] - min) / span);
      }
      pts.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    }

    var lineStr = "";
    for (var p = 0; p < pts.length; p++) {
      lineStr += (p ? " " : "") + pts[p][0] + "," + pts[p][1];
    }
    var poly = svg.querySelector(".cp-kpi__line");
    if (poly) { poly.setAttribute("points", lineStr); }

    var areaD = "M" + pts[0][0] + "," + pts[0][1];
    for (var a = 1; a < pts.length; a++) { areaD += " L" + pts[a][0] + "," + pts[a][1]; }
    areaD += " L" + pts[pts.length - 1][0] + "," + (H - 0.5);
    areaD += " L" + pts[0][0] + "," + (H - 0.5) + " Z";
    var area = svg.querySelector(".cp-kpi__area");
    if (area) { area.setAttribute("d", areaD); }

    var last = pts[pts.length - 1];
    var dot = svg.querySelector(".cp-kpi__dot");
    if (dot) {
      dot.setAttribute("cx", last[0]);
      dot.setAttribute("cy", last[1]);
    }
    svg.classList.add("cp-kpi__svg--drawn");
  }
}
