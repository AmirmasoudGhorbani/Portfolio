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

    if (!reduced) {
      initNeuralNoise();
      initBgParticles();
      initEmbers();
      initButtonFire();
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
    const setStatus = (msg, type) => {
      statusEl.textContent = msg;
      statusEl.className = "form-status" + (type ? " is-" + type : "");
    };
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (document.getElementById("f-name").value || "").trim();
      const email = (document.getElementById("f-email").value || "").trim();
      const message = (document.getElementById("f-message").value || "").trim();
      if (!name || !email || !message) {
        setStatus("Please fill in your name, email, and message.", "error");
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

  /* ---------- Button flame (WebGL domain-warped smoke on hover) ---------- */
  function initButtonFire() {
    const wraps = Array.from(document.querySelectorAll(".flame-btn"));
    if (!wraps.length) return;
    wraps.forEach((w) => {
      const el = w.querySelector("a, button") || w;
      el.style.transition = "transform .18s cubic-bezier(.16,1,.3,1)";
      const set = (s) => { el.style.transform = s; };
      w.addEventListener("pointerenter", () => set("translateY(-2px) scale(1.035)"));
      w.addEventListener("pointerleave", () => set(""));
      w.addEventListener("pointerdown", () => set("translateY(0) scale(0.96)"));
      w.addEventListener("pointerup", () => set("translateY(-2px) scale(1.035)"));
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vsrc = "attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }";
    const fsrc = [
      "precision highp float;",
      "uniform vec2 uRes; uniform float uTime; uniform float uHover; uniform float uEmit;",
      "vec2 hash22(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return -1.0+2.0*fract(sin(p)*43758.5453123); }",
      "float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);",
      "  return mix(mix(dot(hash22(i+vec2(0,0)),f-vec2(0,0)),dot(hash22(i+vec2(1,0)),f-vec2(1,0)),u.x),",
      "             mix(dot(hash22(i+vec2(0,1)),f-vec2(0,1)),dot(hash22(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y); }",
      "float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.02; a*=0.5; } return v; }",
      "void main(){",
      "  vec2 uv = gl_FragCoord.xy / uRes;",
      "  float ar = uRes.x / uRes.y;",
      "  float x = uv.x;",
      "  float above = (uv.y - uEmit) / max(0.001, 1.0 - uEmit);",
      "  if (above < 0.0) { gl_FragColor = vec4(0.0); return; }",
      "  float t = uTime * 0.3;",
      "  vec2 p = vec2(x * ar * 2.6, uv.y * 2.6);",
      "  vec2 q = vec2(fbm(p + vec2(0.0,-t)), fbm(p + vec2(3.1,-t*1.12)));",
      "  vec2 r = vec2(fbm(p + 2.4*q + vec2(1.7,-t*1.2)), fbm(p + 2.4*q + vec2(8.3,-t*1.05)));",
      "  float f = fbm(p + 2.4*r); f = f*0.5+0.5;",
      "  float ridge = fbm(p + 2.4*r + vec2(2.0)); ridge = 1.0 - abs(ridge);",
      // drift: reuse ridge noise so no extra fbm calls
      "  float cx = x - 0.5 + (ridge - 0.5) * 0.07;",
      // gaussian spread that widens as steam rises — no hard pillar edge
      "  float spread = 0.11 + above * 0.22;",
      "  float colmask = exp(-cx*cx / (2.0*spread*spread));",
      "  float vert = smoothstep(0.0, 0.14, above) * (1.0 - smoothstep(0.45, 1.0, above));",
      "  float density = f * colmask * vert * uHover;",
      "  density = clamp(density * 2.3 - 0.05, 0.0, 1.0);",
      // near-white steam instead of flat grey
      "  vec3 col = mix(vec3(0.88,0.86,0.84), vec3(0.97,0.97,1.0), pow(clamp(ridge,0.0,1.0),4.0));",
      "  gl_FragColor = vec4(col, density * 0.55);",
      "}"
    ].join("\n");

    const systems = wraps.map((wrap) => {
      const canvas = wrap.querySelector("canvas.btn-fire");
      if (!canvas) return null;
      const gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false }) || canvas.getContext("experimental-webgl");
      if (!gl) return null;
      const mk = (type, src) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
          console.warn("[btn-fire] shader compile error:", gl.getShaderInfoLog(s));
        return s;
      };
      const prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsrc));
      gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsrc));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn("[btn-fire] program link error:", gl.getProgramInfoLog(prog));
        return null;
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const u = {
        res: gl.getUniformLocation(prog, "uRes"),
        time: gl.getUniformLocation(prog, "uTime"),
        hover: gl.getUniformLocation(prog, "uHover"),
        emit: gl.getUniformLocation(prog, "uEmit"),
      };
      const sys = { wrap, canvas, gl, u, active: false, intensity: 0, padTop: 46, W: 0, H: 0, hadDraw: false };
      const resize = () => {
        const rct = canvas.getBoundingClientRect();
        sys.W = rct.width; sys.H = rct.height;
        canvas.width = Math.max(1, Math.round(rct.width * dpr));
        canvas.height = Math.max(1, Math.round(rct.height * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      sys._resize = resize;
      if (window.ResizeObserver) { sys._ro = new ResizeObserver(resize); sys._ro.observe(wrap); }
      wrap.addEventListener("mouseenter", () => { sys.active = true; });
      wrap.addEventListener("mouseleave", () => { sys.active = false; });
      wrap.addEventListener("focusin", () => { sys.active = true; });
      wrap.addEventListener("focusout", () => { sys.active = false; });
      return sys;
    }).filter(Boolean);

    window.addEventListener("resize", () => systems.forEach((s) => s._resize()), { passive: true });

    const t0 = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (document.hidden) return;
      for (const sys of systems) {
        const target = sys.active ? 1 : 0;
        sys.intensity += (target - sys.intensity) * (sys.active ? 0.09 : 0.05);
        if (sys.intensity < 0.004 && !sys.active) sys.intensity = 0;
        const gl = sys.gl;
        if (sys.intensity <= 0) {
          if (sys.hadDraw) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); sys.hadDraw = false; }
          continue;
        }
        sys.hadDraw = true;
        const emit = 1.0 - (sys.padTop / Math.max(1, sys.H));
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(sys.u.res, sys.canvas.width, sys.canvas.height);
        gl.uniform1f(sys.u.time, (now - t0) / 1000);
        gl.uniform1f(sys.u.hover, sys.intensity);
        gl.uniform1f(sys.u.emit, emit);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
    requestAnimationFrame(tick);
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
