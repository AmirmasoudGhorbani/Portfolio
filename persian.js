/* =================================================================
   Persian motifs: Shamseh medallion behind the portrait, the hero name
   in Old Persian cuneiform, a Kashan-style rug border, lachak card
   frames and the tomb of Cyrus in the footer.
   ================================================================= */
(function () {
  "use strict";

  const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const f = (n) => n.toFixed(1);
  const pt = (r, a) => { const p = P(r, a); return f(p[0]) + "," + f(p[1]); };
  const TAU = Math.PI * 2;

  /* ---------- Shamseh: carpet sun-medallion (toranj) ---------- */
  function medallionSVG() {
    const s = [];
    const circle = (r, w, o) => s.push('<circle r="' + r + '" stroke-width="' + (w || 2) + '"' + (o ? ' opacity="' + o + '"' : "") + "/>");
    circle(497, 2.4); circle(486, 1.2, .7);
    // pearl ring
    for (let i = 0; i < 90; i++) { const p = P(472, i / 90 * TAU); s.push('<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="3.2" class="fill"/>'); }
    // crown of 32 ogee petals with inner petal
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * TAU, d = Math.PI / 32 * .94;
      s.push('<path d="M' + pt(372, a - d) + " C" + pt(430, a - d * 1.05) + " " + pt(440, a - d * .1) + " " + pt(462, a) +
        " C" + pt(440, a + d * .1) + " " + pt(430, a + d * 1.05) + " " + pt(372, a + d) + '"/>');
      s.push('<path d="M' + pt(386, a - d * .45) + " C" + pt(420, a - d * .5) + " " + pt(428, a - d * .05) + " " + pt(440, a) +
        " C" + pt(428, a + d * .05) + " " + pt(420, a + d * .5) + " " + pt(386, a + d * .45) + '" opacity=".6"/>');
    }
    circle(366, 2.2); circle(356, 1.2, .7);
    // 16-point girih star with interlace
    let star = "";
    for (let i = 0; i < 32; i++) star += (i ? "L" : "M") + pt(i % 2 ? 268 : 348, i / 32 * TAU);
    s.push('<path d="' + star + 'Z" stroke-width="2.2"/>');
    let lace = "";
    for (let i = 0; i < 16; i++) lace += "M" + pt(348, i / 16 * TAU) + "L" + pt(348, (i + 6) / 16 * TAU);
    s.push('<path d="' + lace + '" opacity=".28"/>');
    circle(258, 2); circle(248, 1, .7);
    // 12 palmettes (lotus) with curled tips
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + Math.PI / 12, d = Math.PI / 12 * .8;
      s.push('<path d="M' + pt(150, a) + " C" + pt(180, a - d) + " " + pt(232, a - d * .9) + " " + pt(240, a) +
        " C" + pt(232, a + d * .9) + " " + pt(180, a + d) + " " + pt(150, a) + 'Z"/>');
      s.push('<path d="M' + pt(168, a) + " C" + pt(190, a - d * .45) + " " + pt(212, a - d * .4) + " " + pt(218, a) +
        " C" + pt(212, a + d * .4) + " " + pt(190, a + d * .45) + " " + pt(168, a) + 'Z" class="fill" opacity=".35"/>');
    }
    // khatam: eight-pointed star of two squares
    let k1 = "", k2 = "";
    for (let i = 0; i < 4; i++) { k1 += (i ? "L" : "M") + pt(142, i / 4 * TAU); k2 += (i ? "L" : "M") + pt(142, i / 4 * TAU + Math.PI / 4); }
    s.push('<path d="' + k1 + 'Z' + k2 + 'Z" stroke-width="2.2"/>');
    circle(100, 1.8);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + Math.PI / 8, d = Math.PI / 8 * .7;
      s.push('<path d="M' + pt(30, a) + " Q" + pt(70, a - d) + " " + pt(92, a) + " Q" + pt(70, a + d) + " " + pt(30, a) + 'Z"/>');
    }
    circle(24, 2); s.push('<circle r="9" class="fill"/>');
    return '<svg viewBox="-500 -500 1000 1000" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="currentColor" stroke-width="1.6">' + s.join("") + "</g></svg>";
  }

  /* ---------- Carpet border strip: Kashan-style main border between guard stripes ---------- */
  function borderTile() {
    const RED = "#b3141f", NAVY = "#0e1020", IVORY = "#ead9a8", GOLD = "#d4a23e", BLUE = "#4d6fc2", PINK = "#df7896", TEAL = "#3f8f84";
    const W = 140, H = 80, cy = 40;
    const o = [];
    // ground
    o.push('<rect width="' + W + '" height="' + H + '" fill="' + RED + '"/>');
    // minor guards: red ground with alternating blue / ivory four-petal flowers
    const guard = (y) => {
      for (let x = 7; x < W; x += 14) {
        const c = (x / 14 | 0) % 2 ? BLUE : IVORY;
        o.push('<g transform="translate(' + x + "," + y + ')"><path d="M0,-3.6 Q1.6,-1.6 0,0 Q-1.6,-1.6 0,-3.6ZM0,3.6 Q1.6,1.6 0,0 Q-1.6,1.6 0,3.6ZM-3.6,0 Q-1.6,1.6 0,0 Q-1.6,-1.6 -3.6,0ZM3.6,0 Q1.6,1.6 0,0 Q1.6,-1.6 3.6,0Z" fill="' + c + '"/><circle r="1" fill="' + GOLD + '"/></g>');
      }
    };
    guard(7); guard(H - 7);
    // ivory bands with a red reciprocal zigzag
    const band = (y) => {
      o.push('<rect y="' + y + '" width="' + W + '" height="5" fill="' + IVORY + '"/>');
      let d = "M0," + (y + 5);
      for (let x = 0; x <= W; x += 7) d += "L" + (x + 3.5) + "," + (y + 1) + "L" + (x + 7) + "," + (y + 5);
      o.push('<path d="' + d + '" fill="none" stroke="' + RED + '" stroke-width="1"/>');
    };
    band(13); band(H - 18);
    o.push('<path d="M0,12.5H' + W + "M0," + (H - 12.5) + "H" + W + '" stroke="' + NAVY + '" stroke-width="1"/>');
    // main border on navy
    o.push('<rect y="19" width="' + W + '" height="' + (H - 38) + '" fill="' + NAVY + '"/>');
    o.push('<path d="M0,19.5H' + W + "M0," + (H - 19.5) + "H" + W + '" stroke="' + GOLD + '" stroke-width="1"/>');
    // meandering gold vine with leaves
    o.push('<path d="M0,' + cy + " C17,25 53,25 70," + cy + " S123,55 140," + cy + '" fill="none" stroke="' + GOLD + '" stroke-width="1.5"/>');
    [[18, 30.5, -30], [52, 30.5, 30], [88, 49.5, 30], [122, 49.5, -30]].forEach((l) =>
      o.push('<ellipse cx="' + l[0] + '" cy="' + l[1] + '" rx="5" ry="2" transform="rotate(' + l[2] + " " + l[0] + " " + l[1] + ')" fill="' + TEAL + '"/>'));
    // Shah Abbasi palmette at x=35: fans of pointed petals in three layers,
    // a pointed crown and gold side curls, rising from a gold cup
    const fan = (r, w, n, spread, fill) => {
      let g = "";
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k / (n - 1) - .5) * spread, c = Math.cos(a), sn = Math.sin(a);
        const tip = [r * c, r * sn], l = [w * Math.cos(a - 1.2), w * Math.sin(a - 1.2)], rr = [w * Math.cos(a + 1.2), w * Math.sin(a + 1.2)];
        g += '<path d="M0,0 Q' + f(l[0] + tip[0] * .55) + "," + f(l[1] + tip[1] * .55) + " " + f(tip[0]) + "," + f(tip[1]) + " Q" + f(rr[0] + tip[0] * .55) + "," + f(rr[1] + tip[1] * .55) + ' 0,0Z" fill="' + fill + '" stroke="' + IVORY + '" stroke-width=".55"/>';
      }
      return g;
    };
    o.push('<g transform="translate(35,' + (cy + 6) + ')">' +
      '<path d="M-9,-2 C-15,-4 -16,-11 -11,-12 C-8,-12 -8,-9 -10,-8M9,-2 C15,-4 16,-11 11,-12 C8,-12 8,-9 10,-8" fill="none" stroke="' + GOLD + '" stroke-width="1.2"/>' +
      fan(17, 5.5, 5, 2.3, RED) +
      '<path d="M0,-14 Q3,-19 0,-24 Q-3,-19 0,-14Z" fill="' + RED + '" stroke="' + IVORY + '" stroke-width=".55"/>' +
      fan(11.5, 4, 4, 1.9, BLUE) + fan(7, 3, 3, 1.5, PINK) +
      '<path d="M-6,0 Q0,7 6,0Z" fill="' + GOLD + '"/><circle cy="-3" r="1.8" fill="' + IVORY + '"/><circle cy="-3" r=".8" fill="' + RED + '"/></g>');
    // rosette at x=105
    let ros = '<g transform="translate(105,' + cy + ')">';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ros += '<circle cx="' + f(7.2 * Math.cos(a)) + '" cy="' + f(7.2 * Math.sin(a)) + '" r="3.6" fill="' + RED + '" stroke="' + IVORY + '" stroke-width=".6"/>'; }
    ros += '<circle r="5.2" fill="' + GOLD + '"/><circle r="3.4" fill="' + BLUE + '"/><circle r="1.5" fill="' + IVORY + '"/></g>';
    o.push(ros);
    // small red buds on the vine between the two main flowers
    [[70, cy, 1], [0, cy, 1], [140, cy, 1]].forEach((b) =>
      o.push('<g transform="translate(' + b[0] + "," + b[1] + ')"><ellipse rx="2.6" ry="3.6" fill="' + RED + '" stroke="' + IVORY + '" stroke-width=".5"/><circle r="1" fill="' + GOLD + '"/></g>'));
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' + o.join("") + "</svg>";
  }

  /* ---------- Pasargadae: the tomb of Cyrus the Great, engraved elevation ---------- */
  function tombSVG() {
    const out = [], G = 200;
    // six-stepped plinth: [left, right, height] from the ground up
    const steps = [[18, 282, 27], [33, 267, 21], [45, 255, 18], [56, 244, 14], [66, 234, 12], [75, 225, 10]];
    let y = G;
    steps.forEach((st, i) => {
      const top = y - st[2];
      out.push('<rect x="' + st[0] + '" y="' + top + '" width="' + (st[1] - st[0]) + '" height="' + st[2] + '" class="t-face"/>');
      out.push('<path d="M' + st[0] + ',' + (top + 1.5) + 'H' + st[1] + '" class="t-lit"/>');
      // ashlar joints, staggered course to course
      const blk = 34 - i * 2, off = i % 2 ? blk / 2 : 0;
      let d = "";
      for (let xx = st[0] + blk - off; xx < st[1] - 6; xx += blk) d += "M" + f(xx) + "," + (top + 2) + "V" + y;
      out.push('<path d="' + d + '" class="t-joint"/>');
      y = top;
    });
    // chamber, cornice and gabled roof
    out.push('<rect x="104" y="' + (y - 46) + '" width="92" height="46" class="t-face"/>');
    let j = "";
    for (let k = 1; k < 3; k++) j += "M104," + (y - k * 15.3) + "H196";
    j += "M127," + (y - 15.3) + "V" + y + "M173," + (y - 15.3) + "V" + y + "M150," + (y - 30.6) + "V" + (y - 15.3) + "M127," + (y - 46) + "V" + (y - 30.6) + "M173," + (y - 46) + "V" + (y - 30.6);
    out.push('<path d="' + j + '" class="t-joint"/>');
    out.push('<rect x="141" y="' + (y - 30) + '" width="18" height="30" class="t-door"/><path d="M137,' + (y - 32) + 'H163" class="t-line"/>');
    out.push('<rect x="99" y="' + (y - 51) + '" width="102" height="5" class="t-face"/>');
    out.push('<path d="M96,' + (y - 51) + 'L150,' + (y - 79) + 'L204,' + (y - 51) + 'Z" class="t-face"/><path d="M110,' + (y - 54) + 'L150,' + (y - 74) + 'L190,' + (y - 54) + 'Z" class="t-joint"/>');
    out.push('<path d="M150,' + (y - 79) + 'V' + (y - 85) + '" class="t-line"/>');
    // ground line
    out.push('<path d="M0,' + G + 'H300" class="t-line"/><path d="M8,' + (G + 5) + 'H292" class="t-joint"/>');
    return '<svg viewBox="0 6 300 204" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tomb of Cyrus the Great at Pasargadae">' +
      out.join("") + "</svg>";
  }

  /* ---------- Hero name: English <-> Old Persian cuneiform, scrambling on a loop ---------- */
  function nameLoop() {
    const el = document.querySelector(".hero-name");
    if (!el) return;
    const latin = Array.from("AMIR GHORBANI");
    const cune = Array.from("\u{103A0}\u{103B7}\u{103A1}\u{103BC}\u{103D0}\u{103A6}\u{103A2}\u{103BC}\u{103B2}\u{103A0}\u{103B4}\u{103A1}");
    const pool = Array.from("\u{103A3}\u{103A7}\u{103AB}\u{103AD}\u{103B1}\u{103B3}\u{103B6}\u{103B9}\u{103BA}\u{103BF}\u{103C1}\u{103C3}ABDEGHKMNRSTVXZ");
    const label = document.createElement("span");
    label.className = "sr-only";
    label.textContent = "Amir Ghorbani";
    const out = document.createElement("span");
    out.className = "hero-name-glyphs";
    out.setAttribute("aria-hidden", "true");
    el.textContent = "";
    el.appendChild(label);
    el.appendChild(out);
    const isCune = (g) => g.codePointAt(0) > 0xffff;
    const show = (arr) => {
      out.textContent = "";
      arr.forEach((g) => {
        if (!g) return;
        if (!isCune(g)) { out.appendChild(document.createTextNode(g)); return; }
        const sp = document.createElement("span"); sp.className = "cu"; sp.textContent = g; out.appendChild(sp);
      });
    };
    // the two spellings differ in width; the box glides between them so the
    // rest of the line slides instead of jumping
    show(latin); const wl = Math.ceil(out.getBoundingClientRect().width);
    show(cune); const wc = Math.ceil(out.getBoundingClientRect().width);
    const W = { latin: wl, cune: wc };
    const measure = () => Math.ceil(out.getBoundingClientRect().width);
    show(latin);
    el.style.width = wl + "px";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const HOLD = { latin: 4200, cune: 3200 }, MIX = 1300, n = Math.max(latin.length, cune.length);
    let from = latin, to = cune, state = "latin", t0 = performance.now(), plan = [], lastStep = 0;
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (document.hidden) return;
      const el2 = now - t0;
      if (state !== "mix" && el2 > HOLD[state]) {
        state = "mix"; t0 = now;
        el.style.width = Math.max(W.latin, W.cune) + "px";
        plan = Array.from({ length: n }, () => ({ d: Math.random() * 520, len: 380 + Math.random() * 380 }));
        return;
      }
      if (state !== "mix") return;
      if (el2 > MIX) { show(to); state = to === latin ? "latin" : "cune"; W[state] = measure(); el.style.width = W[state] + "px"; t0 = now; const f0 = from; from = to; to = f0; return; }
      if (now - lastStep < 55) return;
      lastStep = now;
      const cur = [];
      for (let i = 0; i < n; i++) {
        const k = plan[i], a = el2 - k.d;
        if (a < 0) cur.push(from[i] || "");
        else if (a < k.len) cur.push(to[i] === " " || to[i] === "\u{103D0}" ? to[i] : pool[(Math.random() * pool.length) | 0]);
        else cur.push(to[i] || "");
      }
      show(cur);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Lachak: carpet corner-piece (a quarter medallion) for card frames ---------- */
  function lachakSVG() {
    const s = [], C = (r, a) => pt(r, a);
    // scalloped quarter-medallion edge: ogee lobes between r 30 and 40
    let edge = "M40,0";
    const lobes = 5;
    for (let i = 0; i < lobes; i++) {
      const a0 = i / lobes * Math.PI / 2, a1 = (i + 1) / lobes * Math.PI / 2, am = (a0 + a1) / 2;
      edge += " Q" + C(46, a0 + (a1 - a0) * .2) + " " + C(43, am) + " Q" + C(46, a1 - (a1 - a0) * .2) + " " + C(40, a1);
    }
    s.push('<path d="' + edge + ' L0,0Z" class="lk-fill"/>');
    s.push('<path d="' + edge + '" class="lk-line"/>');
    // inner arc, quarter eight-pointed star and a central palmette
    s.push('<path d="M30,0 A30,30 0 0 1 0,30" class="lk-line lk-thin"/>');
    let star = "";
    for (let i = 0; i <= 4; i++) star += (i ? "L" : "M") + C(i % 2 ? 13 : 22, i / 4 * Math.PI / 2);
    s.push('<path d="' + star + 'L0,0Z" class="lk-line"/>');
    s.push('<path d="M' + C(22, Math.PI / 4) + ' Q' + C(29, Math.PI / 4 - .16) + ' ' + C(35, Math.PI / 4) + ' Q' + C(29, Math.PI / 4 + .16) + ' ' + C(22, Math.PI / 4) + 'Z" class="lk-dot"/>');
    // islimi tendrils running out along both rules
    s.push('<path d="M44,3 C52,3 56,8 54,12 C52,15 47,13 49,10" class="lk-line lk-thin"/><path d="M3,44 C3,52 8,56 12,54 C15,52 13,47 10,49" class="lk-line lk-thin"/>');
    s.push('<circle cx="60" cy="3" r="1.4" class="lk-dot"/><circle cx="3" cy="60" r="1.4" class="lk-dot"/>');
    return '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' + s.join("") + "</svg>";
  }

  function frameCards() {
    const svg = lachakSVG();
    document.querySelectorAll(".work-card, .service-card").forEach((card) => {
      const f = document.createElement("span");
      f.className = "persian-frame";
      f.setAttribute("aria-hidden", "true");
      f.innerHTML = ["tl", "tr", "bl", "br"].map((k) => '<span class="lk lk-' + k + '">' + svg + "</span>").join("");
      card.appendChild(f);
    });
  }

  function build() {
    const frame = document.querySelector(".hero-portrait-frame");
    if (frame) {
      const m = document.createElement("div");
      m.className = "persian-medallion";
      m.setAttribute("aria-hidden", "true");
      m.innerHTML = '<div class="persian-medallion-spin">' + medallionSVG() + "</div>";
      frame.insertBefore(m, frame.firstChild);
    }
    // the cuneiform font is only fetched once its characters are used, so load it
    // explicitly before measuring the two spellings
    const fontsReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.ready, document.fonts.load('16px "Noto Sans Old Persian"', "\u{103A0}\u{103B7}\u{103A1}\u{103BC}\u{103D0}\u{103A6}\u{103A2}\u{103B2}\u{103B4}")]).catch(() => null)
      : Promise.resolve();
    fontsReady.then(nameLoop);
    frameCards();
    const top = document.querySelector(".footer-top");
    if (top) {
      const t = document.createElement("figure");
      t.className = "footer-tomb";
      t.innerHTML = tombSVG() + '<figcaption>Pasargadae &middot; Tomb of Cyrus</figcaption>';
      top.appendChild(t);
    }
    const hero = document.querySelector(".hero");
    if (hero) {
      const b = document.createElement("div");
      b.className = "persian-border";
      b.setAttribute("aria-hidden", "true");
      b.style.backgroundImage = 'url("data:image/svg+xml,' + encodeURIComponent(borderTile()) + '")';
      hero.after(b);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
