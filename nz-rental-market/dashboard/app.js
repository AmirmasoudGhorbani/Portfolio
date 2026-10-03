/* =================================================================
   NZ Rental Market dashboard: hand-built SVG charts, no dependencies.
   Data: data.json, exported by pipeline/build.py from the SQL model.
   ================================================================= */
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthLabel = (ym) => MONTHS[+ym.slice(5, 7) - 1] + " " + ym.slice(0, 4);
  const quarterLabel = (ym) => ym.slice(0, 4) + " Q" + (Math.floor((+ym.slice(5, 7) - 1) / 3) + 1);
  const money = (v) => (v == null ? "–" : "$" + Math.round(v).toLocaleString("en-NZ"));
  const pct = (v, d = 1) => (v == null ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d) + "%");
  const int = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-NZ"));

  function svgEl(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function htmlEl(tag, attrs, html) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
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
  // Re-render a chart whenever its container changes size
  function responsive(el, draw) {
    let w = 0;
    const run = () => { const nw = el.clientWidth; if (nw && nw !== w) { w = nw; draw(); } };
    if ("ResizeObserver" in window) new ResizeObserver(run).observe(el); else window.addEventListener("resize", run);
    run();
    return () => { w = 0; run(); };
  }

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
  const chartH = (el) => parseFloat(getComputedStyle(el).getPropertyValue("--h")) || 280;

  /* ---------- line chart with crosshair tooltip ---------- */
  function lineChart(el, opt) {
    const draw = () => {
      el.innerHTML = "";
      const W = el.clientWidth, H = chartH(el);
      const x = opt.x(), series = opt.series().filter((s) => s.values);
      const narrow = W < 520;
      const endLabels = opt.endLabels && !narrow;
      const events = (opt.events ? opt.events() : []).map((e) => ({ ...e, i: x.indexOf(e.at) })).filter((e) => e.i >= 0);
      const m = { t: events.length ? 40 : 12, r: endLabels ? 112 : 14, b: 26, l: opt.yWidth || 46 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opt.aria });
      let lo = Infinity, hi = -Infinity;
      series.forEach((s) => s.values.forEach((v) => { if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }));
      if (opt.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
      if (opt.yMin != null) lo = Math.min(lo, opt.yMin);
      if (opt.yDomain) { lo = opt.yDomain[0]; hi = opt.yDomain[1]; }
      const ticks = niceTicks(lo, hi, narrow ? 4 : 5);
      const y0 = ticks[0], y1 = ticks[ticks.length - 1];
      const X = (i) => m.l + (x.length < 2 ? 0 : (i / (x.length - 1)) * iw);
      const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0)) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      ticks.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: opt.zero && t === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = opt.yFmt(t);
      });
      // x ticks: label years at a step that fits
      const years = [];
      x.forEach((d, i) => { if (d.slice(5, 7) === (opt.tickMonth || "01")) years.push(i); });
      const maxTicks = Math.max(2, Math.floor(iw / (narrow ? 64 : 80)));
      const stepY = Math.ceil(years.length / maxTicks) || 1;
      years.forEach((i, k) => {
        if (k % stepY) return;
        svgEl("text", { x: X(i), y: H - 6, "text-anchor": "middle" }, g).textContent = x[i].slice(0, 4);
      });
      if (opt.shadeFrom) {
        const i = x.indexOf(opt.shadeFrom);
        if (i >= 0) {
          svgEl("rect", { x: X(i), y: m.t, width: m.l + iw - X(i), height: ih, class: "shade" }, svg);
          svgEl("text", { x: X(i) + 6, y: m.t + 14, class: "lbl" }, svg).textContent = opt.shadeLabel || "";
        }
      }
      // dated events: dotted rule plus a label, staggered onto two rows when crowded
      let rowEnd = [-Infinity, -Infinity];
      events.forEach((e) => {
        const ex = X(e.i), text = narrow ? e.short || e.label : e.label;
        svgEl("line", { x1: ex, x2: ex, y1: m.t - 4, y2: m.t + ih, class: "event-line" }, svg);
        const w = text.length * 6.2;
        let row = ex - w / 2 > rowEnd[0] + 8 ? 0 : 1;
        if (row === 1 && ex - w / 2 <= rowEnd[1] + 8) row = 0;
        const anchor = ex + w / 2 > W - 4 ? "end" : ex - w / 2 < m.l ? "start" : "middle";
        const left = anchor === "end" ? ex - w : anchor === "start" ? ex : ex - w / 2;
        rowEnd[row] = left + w;
        svgEl("text", { x: ex, y: row ? m.t - 20 : m.t - 8, "text-anchor": anchor, class: "event-lbl" }, svg).textContent = text;
      });
      series.forEach((s) => {
        let d = "", pen = false;
        s.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true;
        });
        svgEl("path", { d, class: "series", stroke: s.color, "stroke-dasharray": s.dash ? "5 4" : null }, svg);
      });
      if (endLabels) {
        const labs = series.map((s) => {
          let i = s.values.length - 1; while (i > 0 && s.values[i] == null) i--;
          return { s, i, y: Y(s.values[i]) };
        }).sort((a, b) => a.y - b.y);
        for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 15) labs[k].y = labs[k - 1].y + 15;
        labs.forEach((l) => {
          svgEl("circle", { cx: X(l.i), cy: Y(l.s.values[l.i]), r: 3.5, fill: l.s.color, class: "dot" }, svg);
          const t = svgEl("text", { x: X(l.i) + 9, y: l.y + 4, class: "lbl-strong" }, svg);
          t.textContent = l.s.short || l.s.name;
        });
      }
      // hover layer
      const hover = svgEl("g", { "pointer-events": "none" }, svg);
      const hit = svgEl("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
      const move = (evt) => {
        const r = svg.getBoundingClientRect();
        const px = (evt.clientX - r.left) * (W / r.width);
        const i = Math.max(0, Math.min(x.length - 1, Math.round(((px - m.l) / iw) * (x.length - 1))));
        hover.innerHTML = "";
        svgEl("line", { x1: X(i), x2: X(i), y1: m.t, y2: m.t + ih, class: "crosshair" }, hover);
        const rows = [];
        series.forEach((s) => {
          const v = s.values[i]; if (v == null) return;
          svgEl("circle", { cx: X(i), cy: Y(v), r: 4.5, fill: s.color, class: "dot" }, hover);
          rows.push({ name: s.name, value: (opt.ttFmt || opt.yFmt)(v), color: s.color, v });
        });
        rows.sort((a, b) => b.v - a.v);
        if (rows.length) showTip(evt, (opt.ttTitle || monthLabel)(x[i]), rows); else hideTip();
      };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", () => { hover.innerHTML = ""; hideTip(); });
      el.appendChild(svg);
      if (opt.legend !== false && series.length > 1) {
        const lg = htmlEl("div", { class: "legend" });
        series.forEach((s) => lg.appendChild(htmlEl("span", {}, '<i class="' + (s.dash ? "dash" : "") + '" style="--c:' + s.color + '"></i>' + s.name)));
        el.appendChild(lg);
      }
    };
    return responsive(el, draw);
  }

  // A bar with a 4px rounded data-end and a square baseline end
  function barPath(xa, xb, y, h, r) {
    const left = Math.min(xa, xb), right = Math.max(xa, xb), w = right - left;
    r = Math.min(r, w / 2, h / 2);
    if (w < 0.5) return "";
    if (xb >= xa) return `M${left},${y}H${right - r}Q${right},${y} ${right},${y + r}V${y + h - r}Q${right},${y + h} ${right - r},${y + h}H${left}Z`;
    return `M${right},${y}H${left + r}Q${left},${y} ${left},${y + r}V${y + h - r}Q${left},${y + h} ${left + r},${y + h}H${right}Z`;
  }

  /* ---------- horizontal diverging bars ---------- */
  function barsH(el, opt) {
    const draw = () => {
      el.innerHTML = "";
      const rows = opt.rows();
      const W = el.clientWidth, rh = 26;
      const longest = Math.max(...rows.map((r) => r.label.length));
      const m = { t: 8, r: 58, b: 22, l: Math.min(longest * 7.2 + 14, W * 0.45) }; // fit the longest name
      const H = m.t + m.b + rows.length * rh;
      const neg = rows.some((r) => r.value < 0) ? 48 : 0; // room for labels left of negative bars
      const iw = W - m.l - m.r - neg;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opt.aria });
      let lo = Math.min(0, ...rows.map((r) => r.value)), hi = Math.max(0, ...rows.map((r) => r.value));
      const ticks = niceTicks(lo, hi, W < 520 ? 3 : 4);
      lo = ticks[0]; hi = ticks[ticks.length - 1];
      const X = (v) => m.l + neg + ((v - lo) / (hi - lo)) * iw;
      const g = svgEl("g", { class: "axis" }, svg);
      let lastX = -Infinity;
      ticks.forEach((t) => {
        svgEl("line", { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: t === 0 ? "zero" : "gridline" }, g);
        if (X(t) - lastX < 44) return; // skip a tick label that would collide
        lastX = X(t);
        svgEl("text", { x: X(t), y: H - 6, "text-anchor": "middle" }, g).textContent = opt.fmt(t, 0);
      });
      if (opt.ref != null) {
        svgEl("line", { x1: X(opt.ref.value), x2: X(opt.ref.value), y1: m.t - 4, y2: H - m.b, stroke: css("--nz"), "stroke-dasharray": "4 3", "stroke-width": 1.5 }, svg);
      }
      rows.forEach((r, k) => {
        const y = m.t + k * rh, bh = rh - 8;
        const color = r.value >= 0 ? css("--rise") : css("--fall");
        svgEl("text", { x: m.l - 10, y: y + bh / 2 + 4, "text-anchor": "end", class: r.strong ? "lbl-strong" : "lbl" }, svg).textContent = r.label;
        svgEl("path", { d: barPath(X(0), X(r.value), y, bh, 4), fill: color }, svg);
        const tx = r.value >= 0 ? X(r.value) + 6 : X(r.value) - 6;
        svgEl("text", { x: r.value >= 0 ? Math.max(tx, X(0) + 6) : Math.min(tx, X(0) - 6), y: y + bh / 2 + 4, "text-anchor": r.value >= 0 ? "start" : "end", class: "lbl" }, svg).textContent = opt.fmt(r.value);
        const hit = svgEl("rect", { x: 0, y: y - 4, width: W, height: rh, fill: "transparent" }, svg);
        hit.addEventListener("pointermove", (e) => showTip(e, r.label, opt.tip(r)));
        hit.addEventListener("pointerleave", hideTip);
      });
      el.appendChild(svg);
      if (opt.ref) {
        el.appendChild(htmlEl("div", { class: "legend" },
          '<span><i style="--c:' + css("--rise") + '"></i>Rent up</span><span><i style="--c:' + css("--fall") + '"></i>Rent down</span><span><i class="dash" style="--c:' + css("--nz") + '"></i>' + opt.ref.label + "</span>"));
      }
    };
    return responsive(el, draw);
  }

  /* ---------- vertical columns around zero ---------- */
  function columns(el, opt) {
    const draw = () => {
      el.innerHTML = "";
      const rows = opt.rows, W = el.clientWidth, H = chartH(el);
      const m = { t: 18, r: 8, b: 26, l: 46 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opt.aria });
      const ticks = niceTicks(Math.min(0, ...rows.map((r) => r.value)), Math.max(0, ...rows.map((r) => r.value)), 4);
      const lo = ticks[0], hi = ticks[ticks.length - 1];
      const Y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      ticks.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = opt.fmt(t, 0);
      });
      const bw = iw / rows.length, gap = 2;
      rows.forEach((r, k) => {
        const x0 = m.l + k * bw + gap, w = bw - gap * 2, ya = Y(0), yb = Y(r.value);
        const top = Math.min(ya, yb), h = Math.abs(yb - ya), rr = Math.min(4, w / 2, h);
        const d = r.value >= 0
          ? `M${x0},${ya}V${top + rr}Q${x0},${top} ${x0 + rr},${top}H${x0 + w - rr}Q${x0 + w},${top} ${x0 + w},${top + rr}V${ya}Z`
          : `M${x0},${ya}V${yb - rr}Q${x0},${yb} ${x0 + rr},${yb}H${x0 + w - rr}Q${x0 + w},${yb} ${x0 + w},${yb - rr}V${ya}Z`;
        if (h > 0.5) svgEl("path", { d, fill: r.value >= 0 ? css("--rise") : css("--fall") }, svg);
        svgEl("text", { x: x0 + w / 2, y: H - 6, "text-anchor": "middle", class: "lbl" }, g).textContent = W < 420 ? r.label[0] : r.label;
        if (r.mark) svgEl("text", { x: x0 + w / 2, y: (r.value >= 0 ? yb - 6 : ya - 6), "text-anchor": "middle", class: "lbl-strong" }, svg).textContent = opt.fmt(r.value, 0);
        const hit = svgEl("rect", { x: m.l + k * bw, y: m.t, width: bw, height: ih, fill: "transparent" }, svg);
        hit.addEventListener("pointermove", (e) => showTip(e, r.full, opt.tip(r)));
        hit.addEventListener("pointerleave", hideTip);
      });
      el.appendChild(svg);
    };
    return responsive(el, draw);
  }

  /* ---------- scatter with least-squares trend line ---------- */
  function scatter(el, opt) {
    const draw = () => {
      el.innerHTML = "";
      const pts = opt.points, W = el.clientWidth, H = chartH(el), narrow = W < 520;
      const m = { t: 28, r: 16, b: 44, l: 52 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opt.aria });
      const xt = niceTicks(Math.min(0, ...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.x)), narrow ? 4 : 6);
      const yt = niceTicks(Math.min(0, ...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.y)), 5);
      const X = (v) => m.l + ((v - xt[0]) / (xt[xt.length - 1] - xt[0])) * iw;
      const Y = (v) => m.t + ih - ((v - yt[0]) / (yt[yt.length - 1] - yt[0])) * ih;
      const g = svgEl("g", { class: "axis" }, svg);
      yt.forEach((t) => {
        svgEl("line", { x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t), class: t === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: m.l - 8, y: Y(t) + 4, "text-anchor": "end" }, g).textContent = opt.fmt(t, 0);
      });
      xt.forEach((t) => {
        svgEl("line", { x1: X(t), x2: X(t), y1: m.t, y2: m.t + ih, class: t === 0 ? "zero" : "gridline" }, g);
        svgEl("text", { x: X(t), y: m.t + ih + 18, "text-anchor": "middle" }, g).textContent = opt.fmt(t, 0);
      });
      svgEl("text", { x: m.l + iw, y: H - 4, "text-anchor": "end", class: "lbl" }, svg).textContent = opt.xLabel;
      svgEl("text", { x: m.l - 44, y: m.t - 14, "text-anchor": "start", class: "lbl" }, svg).textContent = opt.yLabel;
      // trend line across the data range
      const xa = Math.min(...pts.map((p) => p.x)), xb = Math.max(...pts.map((p) => p.x));
      svgEl("line", { x1: X(xa), y1: Y(opt.fit.intercept + opt.fit.slope * xa), x2: X(xb), y2: Y(opt.fit.intercept + opt.fit.slope * xb),
        stroke: css("--nz"), "stroke-width": 1.5, "stroke-dasharray": "5 4" }, svg);
      pts.forEach((p) => {
        const c = svgEl("circle", { cx: X(p.x), cy: Y(p.y), r: 5, fill: p.y >= 0 ? css("--rise") : css("--fall"), class: "dot" }, svg);
        c.addEventListener("pointermove", (e) => showTip(e, p.label, opt.tip(p)));
        c.addEventListener("pointerleave", hideTip);
      });
      // label the districts the story mentions
      pts.filter((p) => p.callout && !(narrow && p.callout === "wide")).forEach((p) => {
        const right = X(p.x) < m.l + iw * 0.8;
        svgEl("text", { x: X(p.x) + (right ? 9 : -9), y: Y(p.y) + 4, "text-anchor": right ? "start" : "end", class: "lbl-strong" }, svg).textContent = p.short || p.label;
      });
      el.appendChild(svg);
      el.appendChild(htmlEl("div", { class: "legend" },
        '<span><i style="--c:' + css("--rise") + '"></i>Rent up</span><span><i style="--c:' + css("--fall") + '"></i>Rent down</span><span><i class="dash" style="--c:' + css("--nz") + '"></i>Trend line (r = ' + opt.fit.correlation.toFixed(2) + ")</span>"));
    };
    return responsive(el, draw);
  }

  function tableHTML(head, rows) {
    return '<table class="mini-table"><thead><tr>' + head.map((h, i) => '<th scope="col"' + (i ? ' class="num"' : "") + ">" + h + "</th>").join("") +
      "</tr></thead><tbody>" + rows.map((r) => "<tr>" + r.map((c, i) => (i ? '<td class="num">' : "<td>") + c + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
  }

  /* ================================================================= */
  fetch("data.json").then((r) => r.json()).then(init).catch(() => {
    document.getElementById("tiles").innerHTML = '<p class="note">The data could not be loaded. Please refresh the page.</p>';
  });

  function init(D) {
    const latest = monthLabel(D.meta.latest);
    document.querySelectorAll("[data-latest]").forEach((e) => { e.textContent = latest; });
    document.querySelectorAll("[data-source]").forEach((e) => { e.textContent = D.meta.source; });
    const S = D.nzSummary, R = D.realSummary;
    const top = D.districts[0], akl = D.districts.find((d) => d.location === "Auckland");
    const arrow = (v) => (v > 0 ? "▲" : v < 0 ? "▼" : "■");

    /* ---------- tiles ---------- */
    document.getElementById("tiles").innerHTML = [
      { label: "Median weekly rent, New Zealand", value: money(S.median_12m_now), unit: "/wk", sub: `<span class="delta">${arrow(S.growth_1y_pct)} ${pct(S.growth_1y_pct)}</span> over 12 months` },
      { label: "Real rent change over 2 years", value: pct(R.real_2y_pct), sub: `<span class="delta">${pct(R.nominal_2y_pct)}</span> as paid, after <span class="delta">${pct(R.cpi_2y_pct)}</span> inflation` },
      { label: "Active tenancies", value: int(S.active_now), sub: `<span class="delta">${arrow(S.active_2y_pct)} ${pct(S.active_2y_pct)}</span> over 2 years` },
      { label: "Most expensive district", value: money(top.median_12m_now), unit: "/wk", sub: `${top.location.replace(" District", "")} · Auckland ${money(akl.median_12m_now)}` },
    ].map((t) => `<div class="tile"><span class="tile-label">${t.label}</span><span class="tile-value">${t.value}${t.unit ? "<small>" + t.unit + "</small>" : ""}</span><span class="tile-sub">${t.sub}</span></div>`).join("");

    /* ---------- dated context for the main chart ---------- */
    const EVENTS = [
      { at: "2008-09", label: "Global financial crisis", short: "GFC" },
      { at: "2011-02", label: "Christchurch earthquake", short: "Quake" },
      { at: "2020-03", label: "COVID-19 lockdown", short: "COVID" },
      { at: "2023-05", label: "Interest rates peak", short: "OCR peak" },
      { at: "2024-04", label: "Public-sector cuts", short: "Cuts" },
    ];

    /* ---------- trend chart with region chips ---------- */
    const slots = [css("--s1"), css("--s2"), css("--s3")];
    const chosen = new Map([["Wellington", 0], ["Auckland", 1], ["Southland", 2]]); // region -> colour slot
    let range = "all";
    const months = D.nz.months;
    const chips = document.getElementById("region-chips");
    const names = Object.keys(D.regions.series).sort();
    names.forEach((n) => {
      const b = htmlEl("button", { type: "button", class: "chip", "aria-pressed": chosen.has(n) ? "true" : "false" }, '<span class="sw"></span>' + n);
      b.addEventListener("click", () => {
        if (chosen.has(n)) chosen.delete(n);
        else if (chosen.size < 3) {
          const used = new Set(chosen.values());
          chosen.set(n, [0, 1, 2].find((s) => !used.has(s)));
        }
        syncChips(); redrawTrend();
      });
      chips.appendChild(b);
    });
    function syncChips() {
      [...chips.children].forEach((b) => {
        const n = b.textContent;
        const on = chosen.has(n);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.style.setProperty("--c", on ? slots[chosen.get(n)] : "transparent");
        b.disabled = !on && chosen.size >= 3;
      });
    }
    syncChips();
    const toggleRegion = (n) => {
      const chip = [...chips.children].find((b) => b.textContent === n);
      if (chip && !chip.disabled) chip.click();
    };
    const startIdx = () => (range === "all" ? 0 : Math.max(0, months.length - 12 * +range));
    const redrawTrend = lineChart(document.getElementById("chart-trend"), {
      aria: "Line chart of median weekly rent over time for New Zealand and selected regions",
      x: () => months.slice(startIdx()),
      series: () => [
        { name: "New Zealand", short: "NZ", color: css("--nz"), dash: true, values: D.nz.median12.slice(startIdx()) },
        ...[...chosen.entries()].map(([n, s]) => ({ name: n, color: slots[s], values: D.regions.series[n].slice(startIdx()) })),
      ],
      yFmt: (v) => "$" + v, ttFmt: money, endLabels: true,
      events: () => EVENTS,
    });
    const origRedraw = redrawTrend;
    function redrawTrendAll() { origRedraw(); renderTrendTable(); }
    // keep the data table in step with the chart
    const trendTable = document.getElementById("table-trend");
    function renderTrendTable() {
      const cols = ["New Zealand", ...chosen.keys()];
      const rows = [];
      months.forEach((m, i) => {
        if (m.slice(5, 7) !== "07" || D.nz.median12[i] == null) return;
        rows.push([m.slice(0, 4), money(D.nz.median12[i]), ...[...chosen.keys()].map((n) => money(D.regions.series[n][i]))]);
      });
      trendTable.innerHTML = tableHTML(["Year (July)", ...cols], rows.reverse());
    }
    renderTrendTable();
    chips.addEventListener("click", () => setTimeout(renderTrendTable));
    document.querySelectorAll("#range button").forEach((b) => b.addEventListener("click", () => {
      range = b.dataset.range;
      document.querySelectorAll("#range button").forEach((o) => o.setAttribute("aria-pressed", o === b ? "true" : "false"));
      redrawTrendAll();
    }));

    /* ---------- real rents (CPI-adjusted) ---------- */
    const rq = D.real.map((r) => r.quarter);
    lineChart(document.getElementById("chart-real"), {
      aria: "Line chart of nominal and inflation-adjusted median weekly rent since 2018",
      x: () => rq, tickMonth: "03", ttTitle: quarterLabel,
      series: () => [
        { name: "Real (June 2026 dollars)", short: "Real", color: css("--s1"), values: D.real.map((r) => r.real_rent) },
        { name: "Nominal (as paid)", short: "Nominal", color: css("--nz"), dash: true, values: D.real.map((r) => r.nominal_rent) },
      ],
      yFmt: (v) => "$" + v, ttFmt: money, endLabels: true,
    });
    lineChart(document.getElementById("chart-index"), {
      aria: "Line chart of rent and price indexes since June 2018",
      x: () => rq, tickMonth: "03", ttTitle: quarterLabel,
      series: () => [
        { name: "New tenancies", color: css("--s1"), values: D.real.map((r) => r.index_new_tenancies) },
        { name: "All tenants (CPI rentals)", short: "All tenants", color: css("--s2"), values: D.real.map((r) => r.index_all_tenants) },
        { name: "Prices overall (CPI)", short: "CPI", color: css("--nz"), dash: true, values: D.real.map((r) => r.index_cpi) },
      ],
      yFmt: (v) => String(v), ttFmt: (v) => v.toFixed(1), endLabels: true,
    });
    document.getElementById("index-note").textContent =
      `Since June 2018, rents for new tenancies rose ${pct(R.index_new_tenancies - 100, 0)}, ahead of inflation (${pct(R.index_cpi - 100, 0)}), while rents for all tenants rose ${pct(R.index_all_tenants - 100, 0)}, less than prices. All tenants' rents are now slowing too: ${pct(100 * (D.real[D.real.length - 1].index_all_tenants / D.real[D.real.length - 5].index_all_tenants - 1))} over the last year.`;

    /* ---------- small multiples: every region on one shared scale ---------- */
    const mStart = months.indexOf("2015-01");
    const mx = months.slice(mStart);
    let mlo = Infinity, mhi = -Infinity;
    Object.values(D.regions.series).forEach((v) => v.slice(mStart).forEach((x) => { if (x != null) { mlo = Math.min(mlo, x); mhi = Math.max(mhi, x); } }));
    const multWrap = document.getElementById("multiples");
    const nzMult = D.nz.median12.slice(mStart);
    D.regionSummary.slice().sort((a, b) => b.growth_2y_pct - a.growth_2y_pct).forEach((r) => {
      const card = htmlEl("button", { type: "button", class: "mult", "aria-pressed": "false",
        "aria-label": `${r.region}: ${money(r.median_12m_now)} a week, ${pct(r.growth_2y_pct)} over 2 years. Add to the chart above.` });
      card.innerHTML = `<span class="mult-top"><span class="mult-name">${r.region}</span><span class="mult-val">${money(r.median_12m_now)}</span></span>
        <span class="mult-chg"><i style="--c:${r.growth_2y_pct >= 0 ? css("--rise") : css("--fall")}"></i>${pct(r.growth_2y_pct)} in 2 yrs</span>`;
      const vals = D.regions.series[r.region].slice(mStart);
      const svg = svgEl("svg", { viewBox: "0 0 200 56", preserveAspectRatio: "none", "aria-hidden": "true" });
      const P = (arr) => arr.map((v, i) => (v == null ? "" : (i ? "L" : "M") + (i / (arr.length - 1) * 200).toFixed(1) + "," + (52 - (v - mlo) / (mhi - mlo) * 48).toFixed(1))).join("");
      svgEl("path", { d: P(nzMult), fill: "none", stroke: css("--nz"), "stroke-width": 1.2, "stroke-dasharray": "3 3", "vector-effect": "non-scaling-stroke" }, svg);
      svgEl("path", { d: P(vals), fill: "none", stroke: r.growth_2y_pct >= 0 ? css("--rise") : css("--fall"), "stroke-width": 2, "vector-effect": "non-scaling-stroke" }, svg);
      card.appendChild(svg);
      card.addEventListener("click", () => {
        toggleRegion(r.region);
        document.getElementById("trend-h").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      });
      card.addEventListener("pointermove", (e) => showTip(e, r.region, [
        { name: "Weekly rent now", value: money(r.median_12m_now) },
        { name: "Change, 2 years", value: pct(r.growth_2y_pct) },
        { name: "Change, 5 years", value: pct(r.growth_5y_pct) },
        { name: "Peak", value: money(r.peak_12m) + " (" + monthLabel(r.peak_month) + ")" },
      ]));
      card.addEventListener("pointerleave", hideTip);
      multWrap.appendChild(card);
    });
    const syncMultiples = () => [...multWrap.children].forEach((c) => {
      const n = c.querySelector(".mult-name").textContent;
      c.setAttribute("aria-pressed", chosen.has(n) ? "true" : "false");
      c.style.setProperty("--c", chosen.has(n) ? slots[chosen.get(n)] : "transparent");
    });
    syncMultiples();
    chips.addEventListener("click", () => setTimeout(syncMultiples));

    /* ---------- supply vs rent (YoY %) ---------- */
    const s0 = months.indexOf("2005-01");
    const rentYoy12 = D.nz.median12.map((v, i) => (i >= 12 && v != null && D.nz.median12[i - 12] != null ? 100 * (v / D.nz.median12[i - 12] - 1) : null));
    lineChart(document.getElementById("chart-supply"), {
      aria: "Line chart of year-on-year change in median rent and active tenancies since 2005",
      x: () => months.slice(s0),
      series: () => [
        { name: "Median rent", color: css("--s1"), values: rentYoy12.slice(s0) },
        { name: "Active tenancies", color: css("--s2"), values: D.nz.activeYoy.slice(s0) },
      ],
      yFmt: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) + "%", ttFmt: (v) => pct(v), zero: true, endLabels: true,
    });

    /* ---------- region growth bars ---------- */
    let period = "growth_2y_pct";
    const periodName = { growth_1y_pct: "1 year", growth_2y_pct: "2 years", growth_5y_pct: "5 years" };
    const redrawGrowth = barsH(document.getElementById("chart-growth"), {
      aria: "Bar chart of rent change by region",
      rows: () => D.regionSummary.map((r) => ({ label: r.region, value: r[period], r })).sort((a, b) => b.value - a.value),
      fmt: (v, d) => pct(v, d == null ? 1 : d),
      ref: { get value() { return S[period]; }, get label() { return "New Zealand " + pct(S[period]); } },
      tip: (row) => [
        { name: "Change over " + periodName[period], value: pct(row.value) },
        { name: "Weekly rent now", value: money(row.r.median_12m_now) },
        { name: "Active tenancies, 2 yrs", value: pct(row.r.active_2y_pct) },
      ],
    });
    document.querySelectorAll("#growth-period button").forEach((b) => b.addEventListener("click", () => {
      period = b.dataset.p;
      document.querySelectorAll("#growth-period button").forEach((o) => o.setAttribute("aria-pressed", o === b ? "true" : "false"));
      redrawGrowth();
    }));

    /* ---------- supply vs rent, by district ---------- */
    const CALLOUT = { "Wellington City": "Wellington", "Lower Hutt City": "Lower Hutt", "Selwyn District": "Selwyn", "Dunedin City": "Dunedin",
      "Auckland": "Auckland", "Timaru District": "Timaru", "Queenstown-Lakes District": "Queenstown-Lakes", "Kaipara District": "Kaipara" };
    const F = D.supplyFit;
    scatter(document.getElementById("chart-scatter"), {
      aria: "Scatter plot of 2-year tenancy growth against 2-year rent growth for 43 districts",
      points: D.districts.filter((d) => d.active_2y_pct != null && d.growth_2y_pct != null).map((d) => ({
        x: d.active_2y_pct, y: d.growth_2y_pct, label: d.location, short: CALLOUT[d.location],
        callout: CALLOUT[d.location] ? (["Kaipara District", "Queenstown-Lakes District"].includes(d.location) ? "wide" : "always") : null, d })),
      fit: F, fmt: (v, dg) => pct(v, dg == null ? 1 : dg), xLabel: "Growth in active tenancies, 2 years →", yLabel: "↑ Growth in median rent, 2 years",
      tip: (p) => [{ name: "Rent, 2 years", value: pct(p.y) }, { name: "Tenancies, 2 years", value: pct(p.x) }, { name: "Weekly rent", value: money(p.d.median_12m_now) }],
    });
    document.getElementById("scatter-note").textContent =
      `Across ${F.districts} districts the correlation is r = ${F.correlation.toFixed(2)}: essentially none. Selwyn added ${pct(D.districts.find((d) => d.location === "Selwyn District").active_2y_pct, 0)} more tenancies and rents still rose, while Wellington City added just ${pct(D.districts.find((d) => d.location === "Wellington City").active_2y_pct, 0)} and rents fell. Local supply doesn't explain local rents here, which points to nationwide drivers such as interest rates and migration, and to local demand, such as Wellington's public-sector job cuts. These are hypotheses this data can't test on its own.`;

    /* ---------- district table ---------- */
    const tbody = document.querySelector("#district-table tbody");
    let sortKey = "median_12m_now", sortDir = -1, filter = "";
    const chg = (v) => `<span class="chg"><i style="--c:${v >= 0 ? css("--rise") : css("--fall")}"></i>${pct(v)}</span>`;
    function renderDistricts() {
      const rows = D.districts
        .filter((d) => d.location.toLowerCase().includes(filter))
        .sort((a, b) => (sortKey === "location" ? a.location.localeCompare(b.location) : (a[sortKey] ?? -1e9) - (b[sortKey] ?? -1e9)) * sortDir);
      tbody.innerHTML = rows.length ? rows.map((d) => `<tr><td>${d.location}</td><td class="num">${money(d.median_12m_now)}</td><td class="num">${chg(d.growth_2y_pct)}</td><td class="num">${d.growth_5y_pct == null ? "–" : chg(d.growth_5y_pct)}</td><td class="num">${pct(d.active_2y_pct)}</td><td class="num">${int(d.bonds_per_month)}</td></tr>`).join("")
        : '<tr><td colspan="6">No district or city matches that search.</td></tr>';
    }
    document.querySelectorAll("#district-table th").forEach((th) => th.querySelector("button").addEventListener("click", () => {
      const k = th.dataset.k;
      sortDir = sortKey === k ? -sortDir : (k === "location" ? 1 : -1);
      sortKey = k;
      document.querySelectorAll("#district-table th").forEach((o) => o.setAttribute("aria-sort", o === th ? (sortDir > 0 ? "ascending" : "descending") : "none"));
      renderDistricts();
    }));
    document.getElementById("district-search").addEventListener("input", (e) => { filter = e.target.value.trim().toLowerCase(); renderDistricts(); });
    renderDistricts();

    /* ---------- seasonality ---------- */
    const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const season = D.seasonality.map((r) => ({ label: r.month_name, full: FULL[r.month_num - 1], value: r.lodgements_vs_trend_pct, rent: r.rent_vs_trend_pct }));
    const peak = season.reduce((a, b) => (b.value > a.value ? b : a)), low = season.reduce((a, b) => (b.value < a.value ? b : a));
    peak.mark = true; low.mark = true;
    columns(document.getElementById("chart-season"), {
      aria: "Column chart of new tenancies by calendar month relative to trend",
      rows: season, fmt: (v, d) => pct(v, d == null ? 1 : d),
      tip: (r) => [{ name: "New tenancies vs trend", value: pct(r.value) }, { name: "Rent vs trend", value: pct(r.rent, 1) }],
    });
    const rentPeak = season.reduce((a, b) => (b.rent > a.rent ? b : a)), rentLow = season.reduce((a, b) => (b.rent < a.rent ? b : a));
    document.getElementById("season-note").textContent =
      `${peak.full} sees ${pct(peak.value, 0)} more new tenancies than the trend, and ${low.full} ${pct(low.value, 0).replace("−", "")} fewer. Rents follow the same rhythm: ${pct(rentPeak.rent)} above trend in ${rentPeak.full}, ${pct(rentLow.rent)} in ${rentLow.full}, the cheapest time to sign a lease.`;

    /* ---------- spread ---------- */
    const ratio = D.spread.map((r) => r.ratio);
    const ratio12 = ratio.map((_, i) => (i < 11 ? null : ratio.slice(i - 11, i + 1).reduce((a, b) => a + b, 0) / 12));
    lineChart(document.getElementById("chart-spread"), {
      aria: "Line chart of the ratio of upper-quartile to lower-quartile rent since 1993",
      x: () => D.spread.map((r) => r.month),
      series: () => [{ name: "Upper ÷ lower quartile", color: css("--s1"), values: ratio12 }],
      yFmt: (v) => v.toFixed(2) + "×", ttFmt: (v) => v.toFixed(2) + "×", legend: false,
    });

    /* ---------- bedrooms ---------- */
    const qs = [...new Set(D.beds.map((r) => r.quarter))].sort();
    const bedSeries = ["1", "2", "3", "4"].map((b, k) => ({
      name: b + " bedroom" + (b === "1" ? "" : "s"), short: b + " bed", color: css(["--b1", "--b2", "--b3", "--b4"][k]),
      values: qs.map((q) => { const r = D.beds.find((x) => x.quarter === q && x.bedrooms === b); return r ? r.median_rent : null; }),
    })).reverse();
    lineChart(document.getElementById("chart-beds"), {
      aria: "Line chart of median weekly house rent by number of bedrooms, 2020 to 2024",
      x: () => qs, series: () => bedSeries, yFmt: (v) => "$" + v, ttFmt: money, ttTitle: quarterLabel, endLabels: true,
    });

    /* ---------- data quality ---------- */
    const cq = D.bedroomCoding.map((r) => r.quarter);
    lineChart(document.getElementById("chart-quality"), {
      aria: "Line chart of the share of bonds recorded as one bedroom or with no bedroom count",
      x: () => cq,
      series: () => [
        { name: "Recorded as 1 bedroom", short: "1 bedroom", color: css("--s2"), values: D.bedroomCoding.map((r) => r.pct_one_bed) },
        { name: "No bedroom count", short: "Unknown", color: css("--s1"), values: D.bedroomCoding.map((r) => r.pct_unknown_beds) },
      ],
      yFmt: (v) => v + "%", ttFmt: (v) => v.toFixed(1) + "%", ttTitle: quarterLabel, zero: true, endLabels: true,
      shadeFrom: "2024-10", shadeLabel: "Excluded",
    });
  }
})();
