/* =================================================================
   Amir Ghorbani — Portfolio interactions (vanilla JS)
   ================================================================= */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  let started = false;

  document.addEventListener("DOMContentLoaded", init);
  if (document.readyState !== "loading") init();

  function init() {
    if (started) return;
    started = true;
    // footer year
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();

    forwardPreviewToken();
    initHeader();
    initSmoothNav();
    initMobileNav();
    initReveal();
    initGlowCards();
    initStagger(document.getElementById("work-grid"), "[data-card]", 90);
    initStagger(document.getElementById("tech-wrap"), "[data-tech]", 45);
    initContactForm();
    initPortraitLight();

    if (!reduced) {
      initNeuralNoise();
      initBgParticles();
      initEmbers();
    }
  }

  /* ---------- Preview-sandbox asset token (no-op in production) ---------- */
  function forwardPreviewToken() {
    const qs = location.search;
    if (!qs) return;
    document.querySelectorAll('img[src^="./"], img[src^="images/"], a[href$=".pdf"]').forEach((el) => {
      const attr = el.tagName === "IMG" ? "src" : "href";
      const v = el.getAttribute(attr);
      if (v && v.indexOf("?") === -1) el.setAttribute(attr, v + qs);
    });
  }

  /* ---------- Header shadow on scroll ---------- */
  function initHeader() {
    const header = document.getElementById("site-header");
    if (!header) return;
    const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 30);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- Eased in-page navigation with header offset ---------- */
  function initSmoothNav() {
    const header = document.getElementById("site-header");
    let raf = 0;
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = id === "#top" ? document.body : document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (reduced) { target.scrollIntoView(); return; }
      const headerH = header ? header.offsetHeight : 74;
      const startY = window.scrollY;
      const endY = Math.max(0, startY + target.getBoundingClientRect().top - (id === "#top" ? 0 : headerH - 1));
      const dist = endY - startY;
      if (Math.abs(dist) < 2) return;
      const dur = Math.min(1100, Math.max(480, Math.abs(dist) * 0.5));
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      let t0 = null;
      if (raf) cancelAnimationFrame(raf);
      const step = (ts) => {
        if (t0 === null) t0 = ts;
        const p = Math.min(1, (ts - t0) / dur);
        window.scrollTo(0, startY + dist * ease(p));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
  }

  /* ---------- Mobile nav toggle ---------- */
  function initMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const menu = document.getElementById("mobile-nav");
    if (!toggle || !menu) return;
    const close = () => { menu.hidden = true; toggle.setAttribute("aria-expanded", "false"); };
    toggle.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
    });
    menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", close));
  }

  /* ---------- Scroll reveal ---------- */
  function initReveal() {
    const els = document.querySelectorAll("[data-reveal]");
    if (reduced || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -7% 0px" });
    els.forEach((el) => io.observe(el));
  }

  /* ---------- Cursor glow on cards + tech pills (eased, local coords) ---------- */
  function initGlowCards() {
    const pointer = { x: 0, y: 0, has: false };
    const state = new WeakMap();
    window.addEventListener("pointermove", (e) => {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.has = true;
    }, { passive: true });

    const EASE = 0.22;
    const tick = () => {
      requestAnimationFrame(tick);
      if (document.hidden || !pointer.has) return;
      document.querySelectorAll("[data-glow]").forEach((card) => {
        const r = card.getBoundingClientRect();
        const tx = pointer.x - r.left, ty = pointer.y - r.top;
        let s = state.get(card);
        if (!s) { s = { x: tx, y: ty }; state.set(card, s); }
        s.x += (tx - s.x) * EASE;
        s.y += (ty - s.y) * EASE;
        card.style.setProperty("--gx", s.x.toFixed(1));
        card.style.setProperty("--gy", s.y.toFixed(1));
        card.style.setProperty("--gxp", Math.max(0, Math.min(1, s.x / Math.max(1, r.width))).toFixed(3));
      });
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Stagger reveal for a grid of items + image hover zoom ---------- */
  function initStagger(wrap, selector, step) {
    if (!wrap) return;
    const els = Array.from(wrap.querySelectorAll(selector));
    if (!els.length) return;

    // image zoom on hover for work cards
    if (!reduced) {
      els.forEach((card) => {
        const img = card.querySelector(".card-media img");
        if (!img) return;
        card.addEventListener("pointerenter", () => { img.style.transform = "scale(1.06)"; });
        card.addEventListener("pointerleave", () => { img.style.transform = "scale(1)"; });
      });
    }
    if (reduced || !("IntersectionObserver" in window)) return;

    els.forEach((p) => { p.style.opacity = "0"; p.style.transform = "translateY(16px) scale(0.97)"; });
    let done = false;
    const reveal = () => {
      if (done) return; done = true;
      els.forEach((p, i) => {
        const d = i * step;
        p.style.transitionDelay = d + "ms";
        requestAnimationFrame(() => { p.style.opacity = "1"; p.style.transform = "translateY(0) scale(1)"; });
        setTimeout(() => { p.style.transitionDelay = "0ms"; p.style.transform = ""; }, d + 750);
      });
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { reveal(); io.disconnect(); } });
    }, { threshold: 0.15 });
    io.observe(wrap);
  }

  /* ---------- Contact form (Web3Forms) ---------- */
  function initContactForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const statusEl = document.getElementById("form-status");
    const nameEl = document.getElementById("f-name");
    const emailEl = document.getElementById("f-email");
    const messageEl = document.getElementById("f-message");

    // letters (any language) with single spaces/hyphens/apostrophes between words, 2-60 chars
    const namePattern = /^\p{L}[\p{L}'-]*(?: \p{L}[\p{L}'-]*)*$/u;
    // local@label(.label)*.tld — tld must be 2+ letters, no consecutive dots
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/;

    const setStatus = (msg, type) => {
      statusEl.textContent = msg;
      statusEl.className = "form-status" + (type ? " is-" + type : "");
    };
    const markInvalid = (el, invalid) => {
      el.classList.toggle("is-invalid", invalid);
      el.setAttribute("aria-invalid", invalid ? "true" : "false");
    };

    const validate = () => {
      const name = nameEl.value.trim();
      const email = emailEl.value.trim();
      const message = messageEl.value.trim();

      if (!name || !email || !message) {
        markInvalid(nameEl, !name);
        markInvalid(emailEl, !email);
        markInvalid(messageEl, !message);
        return { ok: false, msg: "Please fill in your name, email, and message." };
      }

      const nameOk = name.length >= 2 && name.length <= 60 && namePattern.test(name);
      markInvalid(nameEl, !nameOk);
      if (!nameOk) return { ok: false, msg: "Please enter a valid name (letters and spaces only)." };

      const emailOk = emailPattern.test(email) && !email.includes("..");
      markInvalid(emailEl, !emailOk);
      if (!emailOk) return { ok: false, msg: "Please enter a valid email address." };

      markInvalid(messageEl, false);
      return { ok: true, name, email, message };
    };

    [nameEl, emailEl].forEach((el) => {
      el.addEventListener("blur", validate);
      el.addEventListener("input", () => { if (el.classList.contains("is-invalid")) validate(); });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const result = validate();
      if (!result.ok) {
        setStatus(result.msg, "error");
        return;
      }
      try {
        setStatus("Sending…", "");
        const formData = new FormData(form);
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          setStatus("Message sent. I'll be in touch soon!", "success");
          form.reset();
          [nameEl, emailEl, messageEl].forEach((el) => markInvalid(el, false));
        } else {
          throw new Error(data.message || "Failed to send message.");
        }
      } catch (err) {
        setStatus(err.message || "Something went wrong. Please try again.", "error");
      }
    });
  }

  /* ---------- Interactive rising embers + smoke ---------- */
  function initEmbers() {
    const canvas = document.getElementById("bg-embers");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const makeSprite = (rgb, core) => {
      const N = 128, h = N / 2;
      const s = document.createElement("canvas"); s.width = s.height = N;
      const c = s.getContext("2d");
      const g = c.createRadialGradient(h, h, 0, h, h, h);
      g.addColorStop(0, "rgba(255,244,228," + core + ")");
      g.addColorStop(0.12, "rgba(" + rgb + ",0.95)");
      g.addColorStop(0.32, "rgba(" + rgb + ",0.42)");
      g.addColorStop(0.62, "rgba(" + rgb + ",0.1)");
      g.addColorStop(1, "rgba(" + rgb + ",0)");
      c.fillStyle = g; c.fillRect(0, 0, N, N);
      return s;
    };
    const ember = makeSprite("255,118,38", 0.8);
    const hot = makeSprite("255,178,88", 1);
    const smokeSprite = makeSprite("120,112,108", 0);

    const embers = [], smoke = [];
    const mouse = { x: -9999, y: -9999, px: -9999, py: -9999, active: false };

    const addEmber = (x, y, boost) => {
      if (embers.length > 150) return;
      embers.push({ x, y, vx: rand(-0.16, 0.16), vy: rand(-1.15, -0.5) * (boost || 1), life: 0, max: rand(130, 240), size: rand(1.2, 2.9), ph: rand(0, 6.28), hot: Math.random() < 0.28 });
    };
    const addSmoke = (x, y) => {
      if (smoke.length > 70) return;
      smoke.push({ x, y, vx: rand(-0.12, 0.12), vy: rand(-0.45, -0.18), life: 0, max: rand(120, 220), size: rand(10, 24) });
    };

    let last = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      let dt = (now - last) / 16.67; last = now;
      if (dt > 2.5) dt = 2.5; if (dt <= 0) dt = 1;

      let emit = (W > 760 ? 0.8 : 0.55) * dt;
      while (emit > 0) { if (emit >= 1 || Math.random() < emit) addEmber(rand(0, W), H + rand(0, 14)); emit -= 1; }

      if (mouse.active) {
        const sp = Math.hypot(mouse.x - mouse.px, mouse.y - mouse.py);
        const n = Math.min(3, 0.4 + sp * 0.06);
        for (let i = 0; i < n; i++) addEmber(mouse.x + rand(-14, 14), mouse.y + rand(-8, 8), 1.15);
      }
      mouse.px = mouse.x; mouse.py = mouse.y;

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      for (let i = smoke.length - 1; i >= 0; i--) {
        const s = smoke[i]; s.life += dt;
        if (s.life >= s.max) { smoke.splice(i, 1); continue; }
        const p = s.life / s.max;
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy *= 0.998;
        const sz = s.size * (0.7 + p * 1.8);
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.06;
        ctx.drawImage(smokeSprite, s.x - sz, s.y - sz, sz * 2, sz * 2);
      }

      ctx.globalCompositeOperation = "lighter";
      for (let i = embers.length - 1; i >= 0; i--) {
        const e = embers[i]; e.life += dt;
        if (e.life >= e.max) { if (Math.random() < 0.05) addSmoke(e.x, e.y); embers.splice(i, 1); continue; }
        const p = e.life / e.max;
        e.ph += 0.08 * dt;
        e.x += (e.vx + Math.sin(e.ph) * 0.32) * dt;
        e.vy *= 0.994;
        e.y += e.vy * dt;
        if (mouse.active) {
          const dx = e.x - mouse.x, dy = e.y - mouse.y, d2 = dx * dx + dy * dy;
          if (d2 < 9000) { const d = Math.sqrt(d2) || 1; const f = (1 - d / 95) * 0.7 * dt; e.x += dx / d * f; e.vy -= 0.05 * dt; }
        }
        const fade = p < 0.12 ? p / 0.12 : (1 - p) / 0.88;
        const alpha = Math.max(0, fade) * (0.65 + Math.sin(e.ph * 2) * 0.35);
        const r = e.size * (1 - p * 0.3) * 6.5;
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(e.hot ? hot : ember, e.x - r, e.y - r, r * 2, r * 2);
        const cr = e.size * (1 - p) * 1.5;
        if (cr > 0.3) { ctx.globalAlpha = Math.min(1, alpha * 1.15); ctx.drawImage(hot, e.x - cr, e.y - cr, cr * 2, cr * 2); }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };
    requestAnimationFrame(tick);

    window.addEventListener("pointermove", (ev) => {
      if (ev.pointerType === "touch") { mouse.active = false; return; }
      const r = canvas.getBoundingClientRect();
      const x = ev.clientX - r.left, y = ev.clientY - r.top;
      mouse.active = (x >= 0 && y >= 0 && x <= r.width && y <= r.height);
      if (mouse.active) { mouse.x = x; mouse.y = y; }
    }, { passive: true });
  }

  /* ---------- Hero portrait: real-time relighting (WebGL) ----------
     The statue photo is paired with a pre-baked normal/depth map
     (RG = surface normal, B = depth). A key light follows the cursor,
     gold dust gets a metallic glint, a warm ember rim light wraps the
     silhouette, and depth drives a few pixels of parallax so the head
     turns slightly with the pointer. Falls back to the plain <img>. */
  function initPortraitLight() {
    const frame = document.querySelector(".hero-portrait-frame");
    const img = document.getElementById("hero-portrait-img");
    if (!frame || !img) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: true });
    if (!gl) return;

    const vsrc = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
    const fsrc = [
      "precision highp float;",
      "uniform sampler2D uAlbedo, uNormal;",
      "uniform vec2 uRes, uTexel; uniform vec3 uLight; uniform vec2 uPar; uniform float uRim;",
      "vec3 toLin(vec3 c){ return c*c*(c*0.305306+0.682171)+c*0.012523; }",
      "vec3 toSrgb(vec3 c){ c=max(c,0.0); return max(1.055*pow(c,vec3(0.416667))-0.055,0.0); }",
      "void main(){",
      "  vec2 uv=vec2(gl_FragCoord.x/uRes.x, 1.0-gl_FragCoord.y/uRes.y);",
      // two-step parallax: near surfaces (nose, brow) shift more than ears/hair
      "  float d=texture2D(uNormal,uv).b;",
      "  vec2 uv1=uv-uPar*(d-0.7);",
      "  d=texture2D(uNormal,uv1).b;",
      "  vec2 st=clamp(uv-uPar*(d-0.7),0.0,1.0);",
      "  vec4 alb=texture2D(uAlbedo,st);",
      "  if(alb.a<0.003){ gl_FragColor=vec4(0.0); return; }",
      // fine surface normal (stone grain, gold dust) from the map ...
      "  vec3 nm=texture2D(uNormal,st).rgb;",
      "  vec3 nf=vec3(nm.rg*2.0-1.0,0.0); nf.z=sqrt(max(1.0-dot(nf.xy,nf.xy),0.0));",
      // ... and a smooth form normal (skull, cheek, brow) from the depth channel
      "  vec2 e=uTexel*3.0;",
      "  float dx=texture2D(uNormal,st+vec2(e.x,0.0)).b-texture2D(uNormal,st-vec2(e.x,0.0)).b;",
      "  float dy=texture2D(uNormal,st+vec2(0.0,e.y)).b-texture2D(uNormal,st-vec2(0.0,e.y)).b;",
      "  vec3 ns=normalize(vec3(-dx*22.0,-dy*22.0,1.0));",
      "  vec3 n=normalize(ns+vec3(nf.xy*0.45,0.0));",
      "  vec3 base=toLin(alb.rgb);",
      "  vec3 L=normalize(uLight); vec3 V=vec3(0.0,0.0,1.0); vec3 H=normalize(L+V);",
      "  float ndl=dot(n,L);",
      // modulate the photo's baked lighting rather than replace it:
      // a surface facing the viewer under the default light stays neutral
      "  float shade=0.5+0.78*max(ndl,0.0)+0.1*min(ndl,0.0);",
      "  shade=mix(1.0,shade,0.62);",
      "  float lum=dot(alb.rgb,vec3(0.2126,0.7152,0.0722));",
      "  float gold=smoothstep(0.05,0.18,(alb.r+alb.g)*0.5-alb.b)*smoothstep(0.08,0.3,lum);",
      // basalt-like stone: soft broad sheen on the form; gold dust: tight
      // metallic glints on each grain
      "  float ndh=max(dot(n,H),0.0), gdh=max(dot(normalize(ns+vec3(nf.xy*1.4,0.0)),H),0.0);",
      "  vec3 spec=vec3(0.95,0.93,0.9)*pow(ndh,16.0)*0.07*(0.4+lum*2.0)*(1.0-gold);",
      "  spec+=vec3(1.0,0.74,0.32)*pow(gdh,60.0)*1.8*gold*(0.3+lum);",
      "  spec+=vec3(1.0,0.82,0.48)*pow(ndh,8.0)*0.6*gold*base;",
      // warm ember bounce from below-left, only on the silhouette's form
      "  vec3 R=normalize(vec3(-0.85,0.45,0.25));",
      "  float fres=pow(1.0-ns.z,1.6);",
      "  vec3 rim=vec3(1.0,0.42,0.16)*max(dot(ns,R),0.0)*fres*uRim*(base*3.0+0.004);",
      "  vec3 col=base*shade+spec*smoothstep(-0.1,0.5,dot(ns,L))+rim;",
      "  col=toSrgb(col);",
      "  gl_FragColor=vec4(col*alb.a,alb.a);",
      "}"
    ].join("\n");

    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uLight = gl.getUniformLocation(prog, "uLight");
    const uPar = gl.getUniformLocation(prog, "uPar");
    const uRim = gl.getUniformLocation(prog, "uRim");
    gl.uniform1i(gl.getUniformLocation(prog, "uAlbedo"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "uNormal"), 1);

    const texFrom = (unit, source) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    };
    const loadImg = (el) => new Promise((res, rej) => {
      if (el.complete && el.naturalWidth) return res(el);
      el.addEventListener("load", () => res(el), { once: true });
      el.addEventListener("error", rej, { once: true });
    });
    const normalImg = new Image();
    normalImg.decoding = "async";
    normalImg.src = "images/portrait-statue-normal.jpg" + location.search;

    // Default light: high and to the left, matching the photo's own key light.
    const rest = { x: -0.42, y: -0.55 };
    const light = { x: rest.x, y: rest.y, tx: rest.x, ty: rest.y };
    let last = -1e9, visible = true, ready = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.max(1, Math.round(frame.clientWidth * dpr));
      const h = Math.max(1, Math.round(frame.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw = () => {
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform3f(uLight, light.x, light.y, 0.78);
      // the head leans a touch toward the light / pointer
      gl.uniform2f(uPar, (light.x - rest.x) * 0.006, (light.y - rest.y) * 0.004);
      gl.uniform1f(uRim, 0.9);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    Promise.all([loadImg(img), loadImg(normalImg)]).then(() => {
      texFrom(0, img);
      texFrom(1, normalImg);
      gl.uniform2f(gl.getUniformLocation(prog, "uTexel"), 1 / normalImg.naturalWidth, 1 / normalImg.naturalHeight);
      frame.appendChild(canvas);
      draw();
      ready = true;
      requestAnimationFrame(() => frame.classList.add("is-lit"));
      if (!reduced) requestAnimationFrame(tick);
    }).catch(() => { canvas.remove(); });

    if (reduced) {
      window.addEventListener("resize", () => { if (ready) draw(); }, { passive: true });
      return;
    }

    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const r = frame.getBoundingClientRect();
      const px = (e.clientX - (r.left + r.width * 0.55)) / (r.width * 0.9);
      const py = (e.clientY - (r.top + r.height * 0.42)) / (r.height * 0.6);
      light.tx = Math.max(-1.3, Math.min(1.3, px));
      light.ty = Math.max(-1.2, Math.min(1.2, py));
      last = performance.now();
    }, { passive: true });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(frame);
    }

    let prevX = NaN, prevY = NaN, prevW = 0, prevH = 0;
    function tick(now) {
      requestAnimationFrame(tick);
      if (document.hidden || !visible) return;
      // after a few idle seconds the light drifts slowly, like a passing flame
      if (now - last > 3500) {
        const t = now / 1000;
        light.tx = rest.x + Math.sin(t * 0.23) * 0.32 + Math.sin(t * 0.61) * 0.06;
        light.ty = rest.y + Math.cos(t * 0.17) * 0.18;
      }
      light.x += (light.tx - light.x) * 0.06;
      light.y += (light.ty - light.y) * 0.06;
      if (Math.abs(light.x - prevX) < 1e-4 && Math.abs(light.y - prevY) < 1e-4 &&
          frame.clientWidth === prevW && frame.clientHeight === prevH) return;
      prevX = light.x; prevY = light.y; prevW = frame.clientWidth; prevH = frame.clientHeight;
      draw();
    }
  }

  /* ---------- Site-wide neural-noise field (WebGL fbm) ---------- */
  function initNeuralNoise() {
    const canvas = document.getElementById("bg-noise");
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false }) || canvas.getContext("experimental-webgl");
    if (!gl) return;

    const vsrc = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
    const fsrc = [
      "precision highp float;",
      "uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform float uHover;",
      "vec2 hash22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123); }",
      "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);",
      "  return mix(mix(dot(hash22(i+vec2(0.0,0.0)),f-vec2(0.0,0.0)), dot(hash22(i+vec2(1.0,0.0)),f-vec2(1.0,0.0)),u.x),",
      "             mix(dot(hash22(i+vec2(0.0,1.0)),f-vec2(0.0,1.0)), dot(hash22(i+vec2(1.0,1.0)),f-vec2(1.0,1.0)),u.x),u.y); }",
      "float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02; a*=0.5; } return v; }",
      "void main(){",
      "  vec2 uv=(gl_FragCoord.xy-0.5*uRes)/uRes.y;",
      "  float t=uTime*0.035;",
      "  vec2 md=uv-uMouse;",
      "  float hd=length(md);",
      "  float heat=exp(-hd*hd*75.0)*uHover;",
      "  vec2 stir=md*heat*1.4;",
      "  vec2 q=vec2(fbm(uv*1.6-stir+vec2(0.0,t)), fbm(uv*1.6-stir+vec2(5.2,1.3)-t));",
      "  vec2 r=vec2(fbm(uv*1.6+3.5*q+vec2(1.7,9.2)+t*1.15), fbm(uv*1.6+3.5*q+vec2(8.3,2.8)-t*1.05));",
      "  float f=fbm(uv*1.6+3.5*r); f=f*0.5+0.5;",
      "  float ridge=fbm(uv*1.6+3.5*r+vec2(2.0)); ridge=1.0-abs(ridge);",
      "  vec3 base=vec3(0.02,0.02,0.022);",
      "  vec3 smoke=vec3(0.62,0.64,0.70);",
      "  vec3 hi=vec3(0.86,0.88,0.93);",
      "  vec3 col=base;",
      "  col += smoke*pow(f,2.4)*0.85;",
      "  col += hi*pow(clamp(ridge,0.0,1.0),5.5)*0.30*smoothstep(0.5,0.9,f);",
      "  col = mix(col, base, clamp(heat*1.25,0.0,1.0));",
      "  float vig=smoothstep(1.55,0.05,length(uv));",
      "  col*=vig;",
      "  gl_FragColor=vec4(col,1.0);",
      "}"
    ].join("\n");

    const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");
    const uHover = gl.getUniformLocation(prog, "uHover");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const mouse = { x: 0, y: 0, tx: 0, ty: 0, hv: 0, last: -1e9 };
    window.addEventListener("pointermove", (e) => {
      mouse.tx = (e.clientX - 0.5 * window.innerWidth) / window.innerHeight;
      mouse.ty = 0.5 - e.clientY / window.innerHeight;
      mouse.last = performance.now();
    }, { passive: true });

    const t0 = performance.now();
    const render = (now) => {
      requestAnimationFrame(render);
      if (document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * 0.10;
      mouse.y += (mouse.ty - mouse.y) * 0.10;
      const hvT = (now - mouse.last < 420) ? 1 : 0;
      mouse.hv += (hvT - mouse.hv) * (hvT > mouse.hv ? 0.12 : 0.045);
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uHover, mouse.hv);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    requestAnimationFrame(render);
  }

  /* ---------- Site-wide 3D particle network ---------- */
  function initBgParticles() {
    const canvas = document.getElementById("bg-network");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const N = W < 760 ? 46 : 88;
    const pts = [];
    for (let i = 0; i < N; i++) pts.push({ x: rand(-1, 1), y: rand(-1, 1), z: rand(-1, 1), ember: Math.random() < 0.34, tw: rand(0, 6.28), drift: rand(-0.04, 0.04) });

    const cam = 3.5;
    let ry = 0, rx = 0;
    const target = { mx: 0, my: 0 };
    window.addEventListener("pointermove", (e) => {
      target.mx = (e.clientX / window.innerWidth - 0.5);
      target.my = (e.clientY / window.innerHeight - 0.5);
    }, { passive: true });

    const LINK = 124, LINK2 = LINK * LINK;
    let last = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (document.hidden) { last = now; return; }
      let dt = (now - last) / 16.67; last = now; if (dt > 3) dt = 3; if (dt <= 0) dt = 1;

      ry += 0.0015 * dt;
      rx += ((target.my * 0.45) - rx) * 0.035 * dt;
      const ay = ry + target.mx * 0.6;
      const cY = Math.cos(ay), sY = Math.sin(ay), cX = Math.cos(rx), sX = Math.sin(rx);
      const S = Math.min(W, H) * 0.7;
      const cx = W / 2, cy = H / 2;

      const proj = new Array(N);
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        p.y += p.drift * 0.01 * dt;
        if (p.y > 1) p.y = -1; else if (p.y < -1) p.y = 1;
        const x1 = p.x * cY - p.z * sY;
        const z1 = p.x * sY + p.z * cY;
        const y2 = p.y * cX - z1 * sX;
        const z2 = p.y * sX + z1 * cX;
        const f = cam / (cam + z2);
        proj[i] = { sx: cx + x1 * f * S, sy: cy + y2 * f * S, f, ember: p.ember, p };
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < N; i++) {
        const a = proj[i];
        for (let j = i + 1; j < N; j++) {
          const b = proj[j];
          const dx = a.sx - b.sx, dy = a.sy - b.sy, d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            const al = (1 - Math.sqrt(d2) / LINK) * 0.085 * Math.min(a.f, b.f);
            if (al > 0.004) {
              ctx.strokeStyle = "rgba(238,118,58," + al.toFixed(3) + ")";
              ctx.lineWidth = 1;
              ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
            }
          }
        }
      }
      for (let i = 0; i < N; i++) {
        const a = proj[i];
        a.p.tw += 0.028 * dt;
        const r = Math.max(0.4, a.f * 1.7);
        const depth = Math.max(0, Math.min(0.72, (a.f - 0.55) * 1.25));
        const al = depth * (0.7 + Math.sin(a.p.tw) * 0.3);
        ctx.beginPath();
        ctx.fillStyle = a.ember ? "rgba(255,132,58," + al.toFixed(3) + ")" : "rgba(172,162,150," + (al * 0.66).toFixed(3) + ")";
        ctx.arc(a.sx, a.sy, r, 0, 6.2832); ctx.fill();
      }
    };
    requestAnimationFrame(tick);
  }
})();
