var root = document.getElementById("{{ instance_id }}-root");
if (root) {
  var holder = root.querySelector(".cp-ihero__spark-data");
  var svg = root.querySelector(".cp-ihero__spark-svg");
  if (holder && svg) {
    var W = 220, H = 90, PAD_X = 2, PAD_TOP = 8, PAD_BOT = 6;
    var raw = (holder.getAttribute("data-spark") || "").split(",");
    var vals = [];
    for (var i = 0; i < raw.length; i++) {
      var n = parseFloat(raw[i]);
      if (!isNaN(n) && isFinite(n)) { vals.push(n); }
    }
    if (vals.length >= 2) {
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
      var poly = svg.querySelector(".cp-ihero__spark-line");
      if (poly) { poly.setAttribute("points", lineStr); }

      var areaD = "M" + pts[0][0] + "," + pts[0][1];
      for (var a = 1; a < pts.length; a++) { areaD += " L" + pts[a][0] + "," + pts[a][1]; }
      areaD += " L" + pts[pts.length - 1][0] + "," + (H - 0.5);
      areaD += " L" + pts[0][0] + "," + (H - 0.5) + " Z";
      var fill = svg.querySelector(".cp-ihero__spark-fill");
      if (fill) { fill.setAttribute("d", areaD); }

      var last = pts[pts.length - 1];
      var dot = svg.querySelector(".cp-ihero__spark-dot");
      if (dot) {
        dot.setAttribute("cx", last[0]);
        dot.setAttribute("cy", last[1]);
      }
      svg.classList.add("cp-ihero__spark-svg--drawn");
    }
  }
}
