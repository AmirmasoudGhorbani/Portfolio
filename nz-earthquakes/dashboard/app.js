/* =================================================================
   NZ Earthquakes dashboard: hand-built SVG charts, no dependencies.
   Data: data.json (exported by pipeline/build.py) plus GeoNet's live API.
   ================================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = (ym) => MONTHS[+ym.slice(5, 7) - 1] + " " + ym.slice(0, 4);
  const int = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-NZ"));
  const num = (v, d = 1) => (v == null ? "–" : (+v).toLocaleString("en-NZ", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const API = "https://api.geonet.org.nz";

  const DEPTHS = [
    { key: "d1", label: "Shallow, under 40 km", short: "< 40 km", max: 40 },
    { key: "d2", label: "40–100 km", short: "40–100", max: 100 },
    { key: "d3", label: "100–200 km", short: "100–200", max: 200 },
    { key: "d4", label: "200 km or deeper", short: "200 +", max: Infinity },
  ];
  const depthIdx = (d) => DEPTHS.findIndex((b) => d < b.max);
  const depthColor = (d) => css("--" + DEPTHS[depthIdx(d)].key);

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function niceTicks(min, max, count) {
    const span = max - min || 1;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }
  function responsive(el, draw) {
    let w = 0;
    const run = () => { const nw = el.clientWidth; if (nw && nw !== w) { w = nw; draw(); } };
    if ("ResizeObserver" in window) new ResizeObserver(run).observe(el); else window.addEventListener("resize", run);
    run();
    return () => { w = 0; run(); };
  }
  const chartH = (el) => parseFloat(getComputedStyle(el).getPropertyValue("--h")) || 280;
  const logTickLabel = (v) => (v >= 1000 ? (v / 1000) + "k" : v >= 1 ? String(v) : String(v));

  /* ---------- tooltip ---------- */
  const tip = document.getElementById("tooltip");
  function showTip(evt, title, rows) {
    tip.innerHTML = '<div class="tt-title">' + title + "</div>" + rows.map((r) =>
      '<div class="tt-row"><span>' + (r.color ? '<i style="--c:' + r.color + '"></i>' : "") + r.name + "</span><b>" + r.value + "</b></div>").join("");
    tip.hidden = false;
    const pad = 14, tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + tw > innerWidth - 8) x = evt.clientX - tw - pad;
    if (y + th > innerHeight - 8) y = evt.clientY - th - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------- map of New Zealand ---------- */
  const BOUNDS = { lon0: 165.6, lon1: 179.9, lat0: -47.6, lat1: -34.1 };
  const KX = Math.cos((41 * Math.PI) / 180);       // equirectangular, true scale at 41°S
  const MAP_ASPECT = (BOUNDS.lat1 - BOUNDS.lat0) / ((BOUNDS.lon1 - BOUNDS.lon0) * KX);
  const CITY_LABELS = [["Auckland", -36.85, 174.76], ["Wellington", -41.29, 174.78], ["Christchurch", -43.53, 172.64], ["Dunedin", -45.87, 170.5], ["Gisborne", -38.66, 178.02]];

  function mapFrame(el, coast) {
    const W = el.clientWidth;
    const H = Math.min(Math.round(W * MAP_ASPECT), chartH(el));
    const s = Math.min(W / ((BOUNDS.lon1 - BOUNDS.lon0) * KX), H / (BOUNDS.lat1 - BOUNDS.lat0));
    const ox = (W - (BOUNDS.lon1 - BOUNDS.lon0) * KX * s) / 2;
    const P = (lon, lat) => [ox + (lon - BOUNDS.lon0) * KX * s, (BOUNDS.lat1 - lat) * s];
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` });
    const land = svgEl("g", {}, svg);
    coast.forEach((ring) => {
      let d = "";
      ring.forEach(([lo, la], i) => { const [x, y] = P(lo, la); d += (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1); });
      svgEl("path", { d: d + "Z", class: "land" }, land);
    });
    return { svg, P, W, H, scale: s / 60 };
  }
  function cityLabels(svg, P, W) {
    const g = svgEl("g", { "pointer-events": "none" }, svg);
    CITY_LABELS.forEach(([name, la, lo]) => {
      const [x, y] = P(lo, la);
      svgEl("circle", { cx: x, cy: y, r: 2.2, class: "city-dot" }, g);
      const left = x > W * 0.62;
      svgEl("text", { x: left ? x - 6 : x + 6, y: y + 4, "text-anchor": left ? "end" : "start", class: "city-lbl" }, g).textContent = name;
    });
  }
  // hover: nearest visible point within reach
  function nearestHover(svg, pts, toTip) {
    const ring = svgEl("circle", { class: "hl-ring", r: 0, visibility: "hidden", "pointer-events": "none" }, svg);
    const pt = svg.createSVGPoint();
    svg.addEventListener("pointermove", (evt) => {
      pt.x = evt.clientX; pt.y = evt.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      let best = null, bd = 14 * 14;
      for (const q of pts) {
        const dx = q.x - p.x, dy = q.y - p.y, d = dx * dx + dy * dy - q.r * q.r;
        if (d < bd) { bd = d; best = q; }
      }
      if (!best) { ring.setAttribute("visibility", "hidden"); hideTip(); return; }
      ring.setAttribute("cx", best.x); ring.setAttribute("cy", best.y); ring.setAttribute("r", best.r + 3);
      ring.setAttribute("visibility", "visible");
      const t = toTip(best);
      showTip(evt, t.title, t.rows);
    });
    svg.addEventListener("pointerleave", () => { ring.setAttribute("visibility", "hidden"); hideTip(); });
  }
  const magRadius = (m, k) => Math.max(1.3, 1.5 * Math.pow(1.75, m - 4)) * k;

  /* ---------- generic line chart (shared x of labels) ---------- */
  function lineChart(el, opt) {
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = chartH(el), narrow = W < 520;
      const x = opt.x, series = opt.series;
      const events = (opt.events || []).filter((e) => !(narrow && e.wideOnly)).map((e) => ({ ...e, i: x.indexOf(e.at) })).filter((e) => e.i >= 0);
      const m = { t: events.length ? 40 : 12, r: 14, b: 26, l: opt.yWidth || 46 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opt.aria });
      let hi = -Infinity, lo = opt.yMin != null ? opt.yMin : Infinity;
      series.forEach((s) => s.values.forEach((v) => { if (v != null) { hi = Math.max(hi, v); lo = Math.min(lo, v); } }));
      const ticks = niceTicks(lo, hi, narrow ? 4 : 5), y0 = ticks[0], y1 = ticks[ticks.length - 1];
      const X = (i) => m.l + (i / (x.length - 1)) * iw;
      const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      ticks.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: opt.ref === t ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = int(t);
      });
      const tickIdx = x.map((d, i) => (opt.isTick(d) ? i : -1)).filter((i) => i >= 0);
      const step = Math.ceil(tickIdx.length / Math.max(2, Math.floor(iw / (narrow ? 56 : 70))));
      tickIdx.forEach((i, k) => { if (!(k % step)) svgEl("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, g).textContent = opt.tickFmt(x[i]); });
      if (opt.shadeFrom) {
        const i = x.indexOf(opt.shadeFrom);
        svgEl("rect", { x: X(i), y: m.t, width: m.l + iw - X(i), height: ih, class: "shade" }, svg);
        svgEl("text", { x: X(i) + 6, y: m.t + 14, class: "lbl" }, svg).textContent = opt.shadeLabel;
      }
      let rowEnd = [-Infinity, -Infinity];
      events.forEach((e) => {
        const ex = X(e.i), text = narrow ? e.short : e.label, w = text.length * 6.2;
        svgEl("line", { x1: ex, x2: ex, y1: m.t - 4, y2: m.t + ih, class: "event-line" }, svg);
        let row = ex - w / 2 > rowEnd[0] + 8 ? 0 : 1;
        const anchor = ex + w / 2 > W - 4 ? "end" : ex - w / 2 < m.l ? "start" : "middle";
        const left = anchor === "end" ? ex - w : anchor === "start" ? ex : ex - w / 2;
        rowEnd[row] = left + w;
        svgEl("text", { x: ex, y: row ? m.t - 20 : m.t - 8, "text-anchor": anchor, class: "event-lbl" }, svg).textContent = text;
      });
      series.forEach((s) => {
        let d = "", pen = false;
        s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true; });
        svgEl("path", { d, class: "series", stroke: s.color, "stroke-width": s.width || 2 }, svg);
      });
      const hover = svgEl("g", { "pointer-events": "none", visibility: "hidden" }, svg);
      const cross = svgEl("line", { y1: m.t, y2: m.t + ih, class: "crosshair" }, hover);
      const dots = series.map((s) => svgEl("circle", { r: 4, fill: s.color, class: "dot" }, hover));
      const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
      const pt = svg.createSVGPoint();
      hit.addEventListener("pointermove", (evt) => {
        pt.x = evt.clientX; pt.y = evt.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const i = Math.max(0, Math.min(x.length - 1, Math.round(((p.x - m.l) / iw) * (x.length - 1))));
        cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i));
        series.forEach((s, k) => {
          const v = s.values[i];
          dots[k].setAttribute("visibility", v == null ? "hidden" : "visible");
          if (v != null) { dots[k].setAttribute("cx", X(i)); dots[k].setAttribute("cy", Y(v)); }
        });
        hover.setAttribute("visibility", "visible");
        showTip(evt, opt.tipTitle(x[i]), series.map((s) => ({ name: s.name, value: s.values[i] == null ? "–" : opt.tipFmt(s.values[i]), color: s.color })));
      });
      hit.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); hideTip(); });
      el.appendChild(svg);
    };
    return responsive(el, draw);
  }

  /* ---------- 24-hour column chart ---------- */
  function hourColumns(el, values, color, unit) {
    responsive(el, () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = chartH(el), m = { t: 8, r: 6, b: 22, l: 40 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": unit + " by hour of day" });
      const ticks = niceTicks(0, Math.max(...values), 3), top = ticks[ticks.length - 1];
      const Y = (v) => m.t + ih - (v / top) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      ticks.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = int(t);
      });
      const bw = iw / 24, gap = Math.min(2, bw * 0.2);
      values.forEach((v, h) => {
        const x = m.l + h * bw + gap / 2, y = Y(v), hgt = Math.max(0, m.t + ih - y);
        const r = Math.min(3, (bw - gap) / 2, hgt);
        const d = `M${x},${m.t + ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - gap - r}Q${x + bw - gap},${y} ${x + bw - gap},${y + r}V${m.t + ih}Z`;
        if (v > 0) svgEl("path", { d, fill: color }, svg);
        if (h % 3 === 0) svgEl("text", { x: x + (bw - gap) / 2, y: H - 6, "text-anchor": "middle" }, g).textContent = (h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? h + "am" : h - 12 + "pm");
        const hit = svgEl("rect", { x: m.l + h * bw, y: m.t, width: bw, height: ih, fill: "transparent" }, svg);
        const lbl = String(h).padStart(2, "0") + ":00–" + String(h).padStart(2, "0") + ":59";
        hit.addEventListener("pointermove", (evt) => showTip(evt, lbl, [{ name: unit, value: int(v), color }]));
        hit.addEventListener("pointerleave", hideTip);
      });
      el.appendChild(svg);
    });
  }

  /* ---------- log-axis helpers ---------- */
  function logTicks(lo, hi) {
    const out = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) out.push(Math.pow(10, e));
    return out;
  }
  const logFmt = (v) => (v >= 1000 ? int(v / 1000) + "k" : v >= 1 ? int(v) : String(+v.toPrecision(1)));

  /* ===================================================================
     LIVE PANEL
     =================================================================== */
  function timeAgo(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  const nzTime = (iso) => new Date(iso).toLocaleString("en-NZ", { timeZone: "Pacific/Auckland", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  async function live(coast) {
    const tiles = document.getElementById("live-tiles"), list = document.getElementById("live-list");
    const note = document.getElementById("live-note");
    const getJSON = (path) => fetch(API + path).then((r) => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    });
    let quakes, stats;
    try {
      [quakes, stats] = await Promise.all([getJSON("/quake?MMI=-1"), getJSON("/quake/stats")]);
    } catch (e) {
      list.innerHTML = '<li class="muted-li">GeoNet\'s live feed couldn\'t be reached just now. The historical analysis below doesn\'t depend on it.</li>';
      tiles.innerHTML = "";
      document.getElementById("live-map").innerHTML = "";
      document.getElementById("live-daily").innerHTML = "";
      return;
    }
    const feats = quakes.features.filter((f) => f.properties.quality !== "deleted")
      .map((f) => ({ ...f.properties, lon: (f.geometry.coordinates[0] + 360) % 360, lat: f.geometry.coordinates[1] }));

    // this week vs a typical week over the past year (GeoNet bins magnitudes by whole number, rounded down)
    const mc = stats.magnitudeCount;
    const sum = (o, min) => Object.entries(o).reduce((a, [k, v]) => a + (+k >= min ? v : 0), 0);
    const wk = sum(mc.days7, -9), wkAvg = sum(mc.days365, -9) / (365 / 7);
    const wk4 = sum(mc.days7, 4), wk4Avg = sum(mc.days365, 4) / (365 / 7);
    const biggest = feats.reduce((a, f) => (!a || f.magnitude > a.magnitude ? f : a), null);
    const cmp = (v, avg) => {
      const r = v / avg;
      return r > 1.3 ? "busier than usual" : r < 0.7 ? "quieter than usual" : "about normal";
    };
    tiles.innerHTML = [
      { label: "Quakes located, last 7 days", value: int(wk), sub: "Weekly average: " + int(wkAvg) + " · " + cmp(wk, wkAvg) },
      { label: "Magnitude 4+, last 7 days", value: int(wk4), sub: "Weekly average: " + num(wk4Avg) + " · " + cmp(wk4, wk4Avg) },
      { label: "Located in the past year", value: int(sum(mc.days365, -9)), sub: int(sum(mc.days365, 5)) + " of them M5+" },
    ].map((t) => `<div class="tile"><span class="tile-label">${t.label}</span><span class="tile-value">${t.value}</span><span class="tile-sub">${t.sub}</span></div>`).join("");

    const span = feats.length ? (Date.now() - new Date(feats[feats.length - 1].time).getTime()) / 3600000 : 0;
    document.getElementById("live-sub").textContent = `The ${feats.length} most recent quakes GeoNet has located (the last ${span < 48 ? Math.round(span) + " hours" : Math.round(span / 24) + " days"}), loaded straight from its public API when you opened this page.`;

    list.innerHTML = feats.slice(0, 8).map((f) => `<li><span class="mag"><i style="--c:${depthColor(f.depth)}"></i>${num(f.magnitude)}</span>
      <a href="https://www.geonet.org.nz/earthquake/${f.publicID}" target="_blank" rel="noreferrer"><span class="where">${f.locality}<small>${num(f.depth, 0)} km deep · ${nzTime(f.time)}</small></span></a>
      <span class="when">${timeAgo(f.time)}</span></li>`).join("");

    const mapEl = document.getElementById("live-map");
    responsive(mapEl, () => {
      mapEl.innerHTML = "";
      const { svg, P, W } = mapFrame(mapEl, coast);
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", "Map of the " + feats.length + " most recent New Zealand earthquakes");
      cityLabels(svg, P, W);
      const k = Math.max(0.8, W / 520), pts = [];
      [...feats].sort((a, b) => a.magnitude - b.magnitude).forEach((f) => {
        const [x, y] = P(f.lon, f.lat);
        if (x < 0 || x > W || y < 0) return;
        const r = Math.max(2.4, 2.2 * Math.pow(1.6, f.magnitude - 2)) * k;
        svgEl("circle", { cx: x, cy: y, r, fill: depthColor(f.depth), "fill-opacity": 0.85, class: "quake" }, svg);
        pts.push({ x, y, r, f });
      });
      if (feats[0]) {
        const [x, y] = P(feats[0].lon, feats[0].lat);
        svgEl("circle", { cx: x, cy: y, r: 11, fill: "none", stroke: css("--live"), "stroke-width": 1.5 }, svg);
      }
      nearestHover(svg, pts, (q) => ({
        title: nzTime(q.f.time) + " · " + timeAgo(q.f.time),
        rows: [{ name: q.f.locality, value: "" }, { name: "Magnitude", value: num(q.f.magnitude) }, { name: "Depth", value: num(q.f.depth, 0) + " km", color: depthColor(q.f.depth) }],
      }));
      mapEl.appendChild(svg);
      const key = document.createElement("div");
      key.className = "depth-key";
      key.innerHTML = DEPTHS.map((d) => `<span><i style="--c:var(--${d.key})"></i>${d.short}${d.key === "d1" ? "" : " km"}</span>`).join("") + '<span><i style="--c:transparent;box-shadow:inset 0 0 0 1.5px var(--live)"></i>Latest</span>';
      mapEl.appendChild(key);
    });

    // quakes per day, past year
    const days = Object.keys(stats.rate.perDay).sort();
    const vals = days.map((d) => stats.rate.perDay[d]);
    const daily = document.getElementById("live-daily");
    responsive(daily, () => {
      daily.innerHTML = "";
      const W = daily.clientWidth, H = chartH(daily), m = { t: 8, r: 6, b: 22, l: 40 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Quakes located per day over the past year" });
      const ticks = niceTicks(0, Math.max(...vals), 3), top = ticks[ticks.length - 1];
      const Y = (v) => m.t + ih - (v / top) * ih, bw = iw / vals.length;
      const g = svgEl("g", { class: "axis" }, svg);
      ticks.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = int(t);
      });
      let path = "";
      vals.forEach((v, i) => { path += `M${(m.l + i * bw + bw / 2).toFixed(1)},${m.t + ih}V${Y(v).toFixed(1)}`; });
      svgEl("path", { d: path, stroke: css("--s1"), "stroke-width": Math.max(1, bw * 0.7), fill: "none" }, svg);
      days.forEach((d, i) => {
        if (d.slice(8, 10) === "01" && +d.slice(5, 7) % 2 === 1) svgEl("text", { x: m.l + i * bw, y: H - 6, "text-anchor": "middle" }, g).textContent = MONTHS[+d.slice(5, 7) - 1];
      });
      const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
      const pt = svg.createSVGPoint();
      hit.addEventListener("pointermove", (evt) => {
        pt.x = evt.clientX; pt.y = evt.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const i = Math.max(0, Math.min(vals.length - 1, Math.floor((p.x - m.l) / bw)));
        const dt = new Date(days[i].slice(0, 10) + "T00:00:00Z");
        showTip(evt, dt.toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }), [{ name: "Quakes located", value: int(vals[i]), color: css("--s1") }]);
      });
      hit.addEventListener("pointerleave", hideTip);
      daily.appendChild(svg);
    });
    const peak = vals.indexOf(Math.max(...vals));
    note.textContent = `Most days GeoNet locates ${int(median(vals))} quakes, almost all too small to feel. The busiest day in the past year had ${int(vals[peak])}, on ${new Date(days[peak].slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "long", timeZone: "UTC" })}. Days are UTC, as GeoNet reports them.`;
  }
  function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; }

  /* ===================================================================
     HISTORICAL
     =================================================================== */
  fetch("data.json").then((r) => r.json()).then((D) => {
    const latest = new Date(D.meta.latest + "T00:00:00Z");
    document.querySelectorAll("[data-latest]").forEach((e) => { e.textContent = MONTHS[latest.getUTCMonth()] + " " + latest.getUTCFullYear(); });
    document.querySelectorAll("[data-source]").forEach((e) => { e.textContent = D.meta.source; });
    const lastMonth = D.declustered.monthly[D.declustered.monthly.length - 1].month;
    document.querySelectorAll("[data-latest-month]").forEach((e) => { e.textContent = monthLabel(lastMonth); });

    live(D.coast);

    /* ---------- headline tiles ---------- */
    const m5 = D.freqMag.find((r) => Math.abs(r.m - 5) < 1e-6).per_year_at_least;
    const m6 = D.freqMag.find((r) => Math.abs(r.m - 6) < 1e-6).per_year_at_least;
    const shallow = D.depthBands.find((r) => r.depth_band.startsWith("Shallow"));
    document.getElementById("tiles").innerHTML = [
      { label: "Quakes analysed (M2.5+)", value: int(D.meta.events), sub: "New Zealand region, 2000 to " + MONTHS[latest.getUTCMonth()] + " " + latest.getUTCFullYear() },
      { label: "Magnitude 5+ a year", value: num(m5, 0), sub: "and about " + num(m6, 0) + " of M6+ (2012–2025 average)" },
      { label: "Largest since 2000", value: "7.8", sub: "Dusky Sound 2009 and Kaikōura 2016" },
      { label: "Shallower than 40 km", value: num(shallow.pct, 0) + "<small>%</small>", sub: "of M3+ quakes, the kind most likely to be felt" },
    ].map((t) => `<div class="tile"><span class="tile-label">${t.label}</span><span class="tile-value">${t.value}</span><span class="tile-sub">${t.sub}</span></div>`).join("");

    /* ---------- map of M4+ since 2000 ---------- */
    const mapEl = document.getElementById("chart-map");
    const state = { minMag: 4, depths: new Set(DEPTHS.map((d, i) => i)) };
    const chipBox = document.getElementById("map-depth");
    DEPTHS.forEach((d, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "true");
      b.style.setProperty("--c", `var(--${d.key})`);
      b.innerHTML = `<span class="sw"></span>${d.label}`;
      b.addEventListener("click", () => {
        if (state.depths.has(i) && state.depths.size === 1) return;
        state.depths.has(i) ? state.depths.delete(i) : state.depths.add(i);
        b.setAttribute("aria-pressed", state.depths.has(i));
        redrawMap();
      });
      chipBox.appendChild(b);
    });
    document.querySelectorAll("#map-mag button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#map-mag button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      state.minMag = +b.dataset.v; redrawMap();
    }));
    const big = D.largest.slice(0, 6);
    const redrawMap = responsive(mapEl, () => {
      mapEl.innerHTML = "";
      const { svg, P, W, H } = mapFrame(mapEl, D.coast);
      const shown = D.map.filter((p) => p[3] >= state.minMag && state.depths.has(depthIdx(p[2])));
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", `Map of ${shown.length} New Zealand earthquakes of magnitude ${state.minMag} or more since 2000, coloured by depth`);
      const k = Math.max(0.75, W / 600), pts = [];
      const colors = DEPTHS.map((d) => css("--" + d.key));
      const g = svgEl("g", {}, svg);
      shown.forEach(([lon, lat, depth, mag, yr]) => {
        const [x, y] = P(lon, lat);
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) return;
        const r = magRadius(mag, k);
        svgEl("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), fill: colors[depthIdx(depth)], "fill-opacity": mag >= 6 ? 0.9 : 0.62, class: "quake" }, g);
        pts.push({ x, y, r, mag, depth, yr });
      });
      // the cross-section line
      const [a, b] = D.section.line.map(([lo, la]) => P(lo, la));
      svgEl("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: "section-line" }, svg);
      cityLabels(svg, P, W);
      // label the biggest few
      if (W > 420) big.filter((q) => q.mag >= state.minMag && state.depths.has(depthIdx(q.depth_km))).slice(0, 4).forEach((q) => {
        const [x, y] = P(q.lon, q.lat), left = x > W * 0.35;
        svgEl("text", { x: left ? x - 12 : x + 12, y: y + 4, "text-anchor": left ? "end" : "start", class: "big-lbl" }, svg).textContent = "M" + q.mag + " · " + q.day.slice(0, 4);
      });
      nearestHover(svg, pts, (q) => ({
        title: "Magnitude " + num(q.mag) + " · " + q.yr,
        rows: [{ name: "Depth", value: int(q.depth) + " km", color: colors[depthIdx(q.depth)] }],
      }));
      mapEl.appendChild(svg);
    });

    /* ---------- cross-section ---------- */
    const secEl = document.getElementById("chart-section");
    responsive(secEl, () => {
      secEl.innerHTML = "";
      const W = secEl.clientWidth, H = chartH(secEl), m = { t: 34, r: 12, b: 30, l: 52 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cross-section of earthquake depths across the central North Island" });
      const maxD = 400;
      const X = (v) => m.l + (v / 500) * iw, Y = (d) => m.t + (d / maxD) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      [0, 100, 200, 300, 400].forEach((d) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(d), y2: Y(d), class: d === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(d) + 4, "text-anchor": "end" }, g).textContent = d + " km";
      });
      [0, 100, 200, 300, 400, 500].forEach((v) => { svgEl("text", { x: X(v), y: H - 8, "text-anchor": "middle" }, g).textContent = v + (v === 500 ? " km" : ""); });
      const marks = [{ name: "Trench", along: 0 }, ...D.section.marks];
      marks.forEach((mk, i) => {
        svgEl("line", { x1: X(mk.along), x2: X(mk.along), y1: m.t - 6, y2: m.t + ih, class: "mark-line" }, svg);
        svgEl("text", { x: X(mk.along), y: m.t - 12, "text-anchor": i === 0 ? "start" : "middle", class: "mark-lbl" }, svg).textContent = W < 420 && mk.name.length > 8 ? mk.name.split(" ")[0] : mk.name;
      });
      const pts = [];
      D.section.points.forEach(([al, d, mag]) => {
        if (d > maxD) return;
        const x = X(al), y = Y(d), r = Math.max(1.6, 1.3 * Math.pow(1.6, mag - 3));
        svgEl("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: r.toFixed(1), fill: depthColor(d), "fill-opacity": 0.7, class: "quake" }, svg);
        pts.push({ x, y, r, al, d, mag });
      });
      nearestHover(svg, pts, (q) => ({ title: "Magnitude " + num(q.mag), rows: [{ name: "From the trench", value: int(q.al) + " km" }, { name: "Depth", value: int(q.d) + " km", color: depthColor(q.d) }] }));
      secEl.appendChild(svg);
    });

    /* ---------- largest table ---------- */
    document.getElementById("table-largest").innerHTML = "<thead><tr><th>Date</th><th class=\"num\">Mag</th><th class=\"num\">Depth</th><th>Where</th></tr></thead><tbody>" +
      D.largest.map((q) => `<tr><td>${new Date(q.day + "T00:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</td><td class="num">${num(q.mag)}</td><td class="num">${int(q.depth_km)} km</td><td>${q.place}</td></tr>`).join("") + "</tbody>";

    /* ---------- Gutenberg-Richter ---------- */
    const grEl = document.getElementById("chart-gr"), gr = D.gr;
    responsive(grEl, () => {
      grEl.innerHTML = "";
      const W = grEl.clientWidth, H = chartH(grEl), m = { t: 12, r: 14, b: 30, l: 52 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Quakes per year at or above each magnitude, log scale" });
      const pts = D.freqMag.filter((r) => r.per_year_at_least > 0);
      const xMin = 2.5, xMax = 8, yTicks = logTicks(0.05, 10000).filter((v) => v >= 0.1 && v <= 10000);
      const ly0 = Math.log10(0.05), ly1 = Math.log10(10000);
      const X = (v) => m.l + ((v - xMin) / (xMax - xMin)) * iw, Y = (v) => m.t + ih - ((Math.log10(v) - ly0) / (ly1 - ly0)) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      yTicks.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = logFmt(t);
      });
      [3, 4, 5, 6, 7, 8].forEach((v) => { svgEl("text", { x: X(v), y: H - 8, "text-anchor": "middle" }, g).textContent = "M" + v; });
      const fitY = (mm) => Math.pow(10, gr.a - gr.b * mm);
      const fx0 = gr.mc, fx1 = Math.min(8, (gr.a - Math.log10(0.05)) / gr.b);
      svgEl("path", { d: `M${X(fx0)},${Y(fitY(fx0))}L${X(fx1)},${Y(fitY(fx1))}`, class: "fit" }, svg);
      svgEl("text", { x: X(6.4), y: Y(fitY(6.4)) - 10, class: "lbl" }, svg).textContent = "b = " + num(gr.b, 2);
      const blue = css("--s1"), hp = [];
      pts.forEach((r) => {
        const x = X(r.m), y = Y(r.per_year_at_least);
        svgEl("circle", { cx: x, cy: y, r: 3.2, fill: blue, class: "dot" }, svg);
        hp.push({ x, y, r: 3.2, row: r });
      });
      nearestHover(svg, hp, (q) => {
        const n = q.row.per_year_at_least;
        const every = n >= 52 ? int(n / 52) + " a week" : n >= 12 ? num(n / 12) + " a month" : n >= 1 ? "one every " + num(12 / n, 0) + " months" : "one every " + num(1 / n) + " years";
        return { title: "Magnitude " + num(q.row.m) + " or more", rows: [{ name: "Per year", value: n >= 10 ? int(n) : num(n, 2), color: blue }, { name: "About", value: every }] };
      });
      grEl.appendChild(svg);
    });
    document.getElementById("gr-note").textContent = `A straight line on a log scale: each whole magnitude up is ${num(Math.pow(10, gr.b), 1)} times rarer (b = ${num(gr.b, 2)}, 95% interval ${num(gr.b_lo, 2)}–${num(gr.b_hi, 2)}, fitted to ${int(gr.n)} quakes of M${num(gr.mc)}+). Below M3 the points fall under the line because the network misses some small quakes. The largest few sit off the line simply because 14 years holds only a handful.`;

    /* ---------- Omori ---------- */
    const omEl = document.getElementById("chart-omori");
    let seq = "kaikoura";
    const drawOmori = responsive(omEl, () => {
      omEl.innerHTML = "";
      const S = D.aftershocks[seq];
      const W = omEl.clientWidth, H = chartH(omEl), m = { t: 12, r: 14, b: 30, l: 52 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Aftershocks per day after the " + S.name + ", log-log" });
      const lx0 = Math.log10(0.03), lx1 = Math.log10(400), ly0 = Math.log10(0.01), ly1 = Math.log10(3000);
      const X = (t) => m.l + ((Math.log10(t) - lx0) / (lx1 - lx0)) * iw, Y = (v) => m.t + ih - ((Math.log10(v) - ly0) / (ly1 - ly0)) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      [0.01, 0.1, 1, 10, 100, 1000].forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = logFmt(t);
      });
      [[1 / 24, "1 hour"], [1, "1 day"], [7, "1 week"], [30, "1 month"], [365, "1 year"]].forEach(([t, l]) => {
        svgEl("line", { x1: X(t), x2: X(t), y1: m.t, y2: m.t + ih, class: "gridline" }, g);
        svgEl("text", { x: X(t), y: H - 8, "text-anchor": "middle" }, g).textContent = W < 420 && l === "1 week" ? "" : l;
      });
      svgEl("path", { d: S.fit.map((p, i) => (i ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p.rate).toFixed(1)).join(""), class: "fit" }, svg);
      const blue = css("--s1"), hp = [];
      S.obs.forEach((p) => {
        const x = X(p.t), y = Y(p.rate);
        svgEl("circle", { cx: x, cy: y, r: 4, fill: blue, class: "dot" }, svg);
        hp.push({ x, y, r: 4, p });
      });
      nearestHover(svg, hp, (q) => {
        const t = q.p.t, when = t < 1 ? num(t * 24) + " hours" : t < 60 ? num(t) + " days" : int(t) + " days";
        return { title: "About " + when + " after", rows: [{ name: "Aftershocks per day", value: q.p.rate >= 10 ? int(q.p.rate) : num(q.p.rate, 2), color: blue }] };
      });
      omEl.appendChild(svg);
      const ratio = Math.pow((S.c + 30) / (S.c + 1), S.p);
      document.getElementById("omori-note").textContent = `${S.name}: ${int(S.n)} aftershocks of M${num(S.mmin)}+ in ${S.days} days, ${int(S.day1)} of them in the first day. Fitted decay exponent p = ${num(S.p, 2)}${S.p > 1.15 ? ", faster than the typical value of about 1.1" : S.p < 1.05 ? ", close to the textbook value of 1" : ""}. A month after the mainshock the daily rate was about 1/${int(ratio)} of what it was a day after.`;
    });
    document.querySelectorAll("#omori-seq button").forEach((b) => b.addEventListener("click", () => {
      document.querySelectorAll("#omori-seq button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      seq = b.dataset.v; drawOmori();
    }));

    /* ---------- declustered monthly ---------- */
    const mon = D.declustered.monthly;
    const cAll = css("--nz"), cMain = css("--s1");
    lineChart(document.getElementById("chart-decl"), {
      aria: "Quakes per month, all events and mainshocks only",
      x: mon.map((r) => r.month.slice(0, 7)),
      series: [
        { name: "All M3+ quakes", values: mon.map((r) => r.all_events), color: cAll, width: 1.5 },
        { name: "Mainshocks only", values: mon.map((r) => r.mainshocks), color: cMain },
      ],
      yMin: 0, ref: 0,
      isTick: (d) => d.slice(5) === "01", tickFmt: (d) => d.slice(0, 4),
      tipTitle: monthLabel, tipFmt: int,
      events: [
        { at: "2013-07", label: "Cook Strait M6.5", short: "Cook Str." },
        { at: "2016-09", label: "East Cape M7.1", short: "E. Cape", wideOnly: true },
        { at: "2016-11", label: "Kaikōura M7.8", short: "Kaikōura" },
        { at: "2021-03", label: "East Cape M7.2", short: "E. Cape" },
      ],
    });
    document.getElementById("legend-decl").innerHTML = `<span><i style="--c:${cAll}"></i>All M3+ quakes</span><span><i style="--c:${cMain}"></i>Mainshocks only (${num(100 * D.declustered.share_main, 0)}% of all)</span>`;

    /* ---------- cities ---------- */
    const cityCols = [
      { key: "city", label: "City" },
      { key: "m4_main", label: "M4+ mainshocks", num: true },
      { key: "m4_all", label: "M4+ incl. aftershocks", num: true },
      { key: "m5_main", label: "M5+ mainshocks", num: true },
      { key: "every_years", label: "One M5+ every", num: true, fmt: (v) => (v == null ? "none in 14 yrs" : "~" + num(v) + " yrs") },
    ];
    let citySort = { key: "m4_main", dir: -1 };
    const cityTable = document.getElementById("table-cities");
    function drawCities() {
      const rowsC = [...D.cities].sort((a, b) => {
        let va = a[citySort.key], vb = b[citySort.key];
        if (citySort.key === "every_years") { va = va == null ? 1e9 : va; vb = vb == null ? 1e9 : vb; }
        return (va > vb ? 1 : va < vb ? -1 : 0) * citySort.dir;
      });
      cityTable.innerHTML = "<thead><tr>" + cityCols.map((c) => `<th class="${c.num ? "num" : ""}" aria-sort="${citySort.key === c.key ? (citySort.dir > 0 ? "ascending" : "descending") : "none"}"><button type="button" data-k="${c.key}">${c.label}</button></th>`).join("") + "</tr></thead><tbody>" +
        rowsC.map((r) => "<tr>" + cityCols.map((c) => c.num ? `<td class="num">${c.fmt ? c.fmt(r[c.key]) : int(r[c.key])}</td>` : `<td>${r[c.key]}</td>`).join("") + "</tr>").join("") + "</tbody>";
      cityTable.querySelectorAll("th button").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.k;
        citySort = { key: k, dir: citySort.key === k ? -citySort.dir : k === "city" || k === "every_years" ? 1 : -1 };
        drawCities();
        cityTable.querySelector(`th button[data-k="${k}"]`).focus();
      }));
    }
    drawCities();

    /* ---------- the 2012 scale change ---------- */
    const ann = D.annual.filter((r) => r.yr <= 2025);
    const pre = (k) => ann.filter((r) => r.yr <= 2011).reduce((a, r) => a + r[k], 0) / 12;
    const p3 = pre("m3"), p5 = pre("m5"), c3 = css("--s2"), c5 = css("--s1");
    lineChart(document.getElementById("chart-scale"), {
      aria: "Yearly quake counts at M3+ and M5+, indexed to 2000–2011",
      x: ann.map((r) => String(r.yr)),
      series: [
        { name: "M3+", values: ann.map((r) => (100 * r.m3) / p3), color: c3 },
        { name: "M5+", values: ann.map((r) => (100 * r.m5) / p5), color: c5 },
      ],
      yMin: 0, ref: 100, yWidth: 40,
      isTick: () => true, tickFmt: (d) => d,
      tipTitle: (d) => d, tipFmt: (v) => int(v),
      shadeFrom: "2012", shadeLabel: "New system",
    });
    document.getElementById("legend-scale").innerHTML = `<span><i style="--c:${c3}"></i>M3+ (2000–2011 average ${int(p3)} a year = 100)</span><span><i style="--c:${c5}"></i>M5+ (average ${int(p5)} a year = 100)</span>`;
    const eq = (o) => D.scaleEquiv.find((r) => Math.abs(r.old - o) < 1e-6).modern;
    document.getElementById("scale-note").textContent = `In 2012 GeoNet replaced its old processing system with SeisComP, and with it the way small magnitudes are calculated. M3+ counts dropped by half overnight and stayed there, outside the big sequences, while M5+ counts didn't move. Matching yearly rates gives the translation: an old M3.0 is about a modern M${num(eq(3), 2)}, an old M4.0 about M${num(eq(4), 2)}, and the scales agree by M5. So every rate and fit here uses 2012 onwards only. A naive trend line across 2012 would report that New Zealand got calmer.`;

    /* ---------- hours ---------- */
    hourColumns(document.getElementById("chart-hours-q"), D.hours.map((r) => r.small_quakes), css("--s1"), "Small quakes");
    hourColumns(document.getElementById("chart-hours-b"), D.hours.map((r) => r.quarry_blasts), css("--s2"), "Quarry blasts");
    const hq = D.hours.map((r) => r.small_quakes);
    const night = hq.filter((v, h) => h <= 4 || h >= 22), day = hq.filter((v, h) => h >= 9 && h <= 17);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const blasts = D.hours.map((r) => r.quarry_blasts), totalB = blasts.reduce((a, b) => a + b, 0);
    document.getElementById("hours-note").textContent = `Small quakes should be spread evenly over the day, but about ${num(100 * (1 - avg(day) / avg(night)), 0)}% fewer are detected during working hours than at night: traffic and machinery add noise that hides the faintest ones. Quarry blasts are the opposite: ${num(100 * (blasts[12] + blasts[15]) / totalB, 0)}% of them go off at noon or 3pm. GeoNet labels blasts it identifies, and they're excluded here, but it's a reminder to check a catalogue before trusting it.`;

    /* ---------- event types ---------- */
    const LABEL = { "outside of network interest": "Outside NZ's area", "not locatable": "Not locatable", "volcano-tectonic": "Volcano-tectonic", "quarry blast": "Quarry blast" };
    const cap = (s) => LABEL[s] || s.charAt(0).toUpperCase() + s.slice(1);
    document.getElementById("table-types").innerHTML = '<thead><tr><th>Type</th><th class="num">Events</th><th class="num">Largest</th><th>Largest of its type</th></tr></thead><tbody>' +
      D.eventTypes.map((r) => `<tr><td>${cap(r.event_type)}</td><td class="num">${int(r.events)}</td><td class="num">M${num(r.largest_mag)}</td><td>${r.largest_place}, ${new Date(r.largest_date + "T00:00:00Z").toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</td></tr>`).join("") + "</tbody>";
  }).catch((e) => {
    console.error(e);
    document.getElementById("tiles").innerHTML = '<p class="note">The data failed to load. Please refresh the page.</p>';
  });
})();
