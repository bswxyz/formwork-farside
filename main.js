/* ==================================================================
   FARSIDE — the weather engine + terrain control + pitch stepper
   Vanilla JS, no dependencies. Everything degrades without it.
   ================================================================== */
(() => {
  const root = document.documentElement;
  root.classList.add('js'); // gate the JS-only enhancements
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- nav backdrop on scroll ---------- */
  const nav = document.getElementById('nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- scramble-in text (weather-radio static) ---------- */
  const GLYPHS = '▪/\\<>-_0123456789';
  function scramble(el, dur = 600) {
    const final = el.dataset.final ?? el.textContent;
    el.dataset.final = final;
    if (reduce) { el.textContent = final; return; }
    const len = final.length;
    const start = performance.now();
    (function step(now) {
      const p = clamp((now - start) / dur, 0, 1);
      const shown = p * len;
      let out = '';
      for (let i = 0; i < len; i++) {
        const c = final[i];
        if (c === ' ') { out += ' '; continue; }
        out += (i < shown) ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = final;
    })(start);
  }
  // fire each scramble once when it scrolls into view
  const scrambleEls = [...document.querySelectorAll('[data-scramble]')];
  if ('IntersectionObserver' in window && !reduce) {
    const sio = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (e.isIntersecting) { scramble(e.target); sio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    scrambleEls.forEach(el => sio.observe(el));
  } else {
    scrambleEls.forEach(el => { el.dataset.final = el.textContent; });
  }

  /* ---------- reveal-on-scroll ---------- */
  const reveals = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window) {
    const rio = new IntersectionObserver((ents) => {
      ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); rio.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => rio.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-in'));
  }

  /* ================================================================
     THE WEATHER ENGINE — canvas particle field bound to terrain
     ================================================================ */
  const weather = (() => {
    const canvas = document.getElementById('weather');
    const api = { setRegime() {} };
    if (!canvas || !canvas.getContext) return api;
    const ctx = canvas.getContext('2d');
    if (!ctx) return api;

    // regime presets — the crossfade interpolates between these
    const REGIMES = {
      alpine:  { color: [236, 240, 236], speed: 46,  angle: 1.94, streak: 5,  sMin: 0.7, sMax: 1.9, turb: 1.1,  density: 0.62, shimmer: 0, gust: 0 },
      desert:  { color: [226, 178, 122], speed: 20,  angle: 0.24, streak: 0,  sMin: 0.7, sMax: 2.6, turb: 0.6,  density: 0.5,  shimmer: 1, gust: 0 },
      coastal: { color: [176, 206, 216], speed: 168, angle: 2.16, streak: 20, sMin: 0.7, sMax: 1.5, turb: 0.28, density: 0.92, shimmer: 0, gust: 1 }
    };
    const KEYS = ['speed', 'angle', 'streak', 'sMin', 'sMax', 'turb', 'density', 'shimmer', 'gust'];
    function mixState(a, b, t) {
      const o = { color: [lerp(a.color[0], b.color[0], t), lerp(a.color[1], b.color[1], t), lerp(a.color[2], b.color[2], t)] };
      for (const k of KEYS) o[k] = lerp(a[k], b[k], t);
      return o;
    }
    const easeIO = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    let cur = mixState(REGIMES.alpine, REGIMES.alpine, 0);
    let from = cur, to = REGIMES.alpine, tt = 1;

    const dpr = Math.min(devicePixelRatio || 1, 2);
    const MAX = 260;
    let w = 0, h = 0, parts = [];
    const wind = { x: 0, tx: 0 };

    function makeParts() {
      parts = [];
      for (let i = 0; i < MAX; i++) {
        parts.push({
          x: Math.random() * w, y: Math.random() * h,
          sf: 0.5 + Math.random() * 0.9,
          sizeF: Math.random(),
          alpha: 0.28 + Math.random() * 0.6,
          phase: Math.random() * TAU,
          freq: 0.6 + Math.random() * 1.6
        });
      }
    }
    function resize() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!parts.length) makeParts();
      if (reduce) staticFrame(); // reduced motion never runs the loop — repaint the scatter
    }
    resize();
    addEventListener('resize', resize);

    const nudgeZone = canvas.closest('.hero') || canvas.parentElement;
    if (finePointer) {
      nudgeZone.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        wind.tx = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5);
      }, { passive: true });
    }

    let time = 0;

    function drawFrame(dt) {
      ctx.clearRect(0, 0, w, h);
      wind.x += (wind.tx - wind.x) * Math.min(1, dt * 3);

      // coastal gust envelope — periodic density + speed surge
      const gp = (time % 3.4) / 3.4;
      const env = gp < 0.18 ? Math.sin((gp / 0.18) * Math.PI) : 0;
      const gustSpeed = 1 + env * 0.85 * cur.gust;
      const gustDensity = 1 + env * 0.4 * cur.gust;

      // desert heat-shimmer bands (warm, drawn behind particles)
      if (cur.shimmer > 0.02) {
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 3; b++) {
          const by = (0.5 + b * 0.16) * h + Math.sin(time * 0.7 + b * 1.7) * 12;
          const grd = ctx.createLinearGradient(0, by - 26, 0, by + 26);
          const a = 0.05 * cur.shimmer;
          grd.addColorStop(0, 'rgba(255,138,80,0)');
          grd.addColorStop(0.5, `rgba(255,150,90,${a})`);
          grd.addColorStop(1, 'rgba(255,138,80,0)');
          ctx.fillStyle = grd;
          ctx.fillRect(0, by - 26, w, 52);
        }
      }

      const active = Math.round(MAX * clamp(cur.density * gustDensity, 0, 1));
      const [r, g, bl] = cur.color;
      const ang = cur.angle + wind.x * 0.5;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < active; i++) {
        const p = parts[i];
        const drift = Math.sin(time * p.freq + p.phase) * cur.turb;
        let vx = (ca * cur.speed * p.sf + drift * 24 + wind.x * 46) * gustSpeed;
        let vy = (sa * cur.speed * p.sf + Math.cos(time * p.freq * 0.7 + p.phase) * cur.turb * 10) * gustSpeed;
        p.x += vx * dt; p.y += vy * dt;

        // wrap
        if (p.y > h + 24) { p.y = -20; p.x = Math.random() * w; }
        else if (p.y < -24) { p.y = h + 20; }
        if (p.x > w + 24) p.x = -20; else if (p.x < -24) p.x = w + 20;

        const size = lerp(cur.sMin, cur.sMax, p.sizeF);
        const alpha = p.alpha;
        if (cur.streak > 1) {
          const mag = Math.hypot(vx, vy) || 1;
          const len = cur.streak * (0.5 + p.sf * 0.7);
          const ux = vx / mag, uy = vy / mag;
          ctx.strokeStyle = `rgba(${r|0},${g|0},${bl|0},${alpha})`;
          ctx.lineWidth = size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - ux * len, p.y - uy * len);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(${r|0},${g|0},${bl|0},${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // one static scatter frame (reduced motion / paused init)
    function staticFrame() {
      cur = mixState(to, to, 0);
      time = 8;
      // give everyone a settled position spread across the field
      for (const p of parts) { p.x = Math.random() * w; p.y = Math.random() * h; }
      drawFrame(0);
    }

    let raf = null, last = 0, running = false;
    function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      time += dt;
      if (tt < 1) { tt = Math.min(1, tt + dt / 0.8); cur = mixState(from, to, easeIO(tt)); }
      drawFrame(dt);
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || reduce) return;
      running = true; last = performance.now();
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf), raf = null;
    }

    // pause when the hero scrolls out of view
    if ('IntersectionObserver' in window) {
      const vio = new IntersectionObserver((ents) => {
        ents.forEach(e => { if (e.isIntersecting) start(); else stop(); });
      }, { threshold: 0.02 });
      vio.observe(canvas);
    } else { start(); }

    if (reduce) staticFrame();

    api.setRegime = (name) => {
      const target = REGIMES[name];
      if (!target) return;
      if (reduce) { to = target; staticFrame(); return; }
      from = cur; to = target; tt = 0;
    };
    return api;
  })();

  /* ================================================================
     TERRAIN — segmented control (tablist) drives the whole panel
     ================================================================ */
  (() => {
    const seg = document.querySelector('.seg');
    if (!seg) return;
    const tabs = [...seg.querySelectorAll('[role="tab"]')];
    const panel = document.getElementById('terrain-panel');
    const envs = [...document.querySelectorAll('.env')];
    const configs = [...document.querySelectorAll('.tent-config')];
    const specDds = [...document.querySelectorAll('[data-spec]')];
    const capLabel = document.querySelector('[data-config-label]');

    const DATA = {
      alpine:  { i: 0, label: 'Alpine — low geodesic dome',
        spec: { poles: '4 × DAC crossing', anchors: '8 stakes + 2 storm guys', tension: 'HIGH / storm-taut', vent: 'Sealed / low intake' } },
      desert:  { i: 1, label: 'Desert — extended shade awning',
        spec: { poles: '3 × arch + awning spar', anchors: '6 wide-sand stakes', tension: 'LOW / shade-slack', vent: 'Max / elevated gap' } },
      coastal: { i: 2, label: 'Coastal — aerodynamic low tail',
        spec: { poles: '4 × swept aero arch', anchors: '12 doubled + storm skirt', tension: 'HIGH / windward', vent: 'Leeward only' } }
    };

    let current = 'alpine';
    // sync the JS-managed initial state (CSS default already shows alpine)
    envs.forEach(el => el.classList.toggle('is-active', el.dataset.env === 'alpine'));
    configs.forEach(el => el.classList.toggle('is-active', el.dataset.config === 'alpine'));

    function redrawDiagram(name) {
      const g = configs.find(c => c.dataset.config === name);
      if (!g) return;
      configs.forEach(c => c.classList.remove('is-active'));
      // force reflow so the stroke-dashoffset transition replays
      void g.getBoundingClientRect();
      g.classList.add('is-active');
    }

    function select(name, { focus = true } = {}) {
      if (!DATA[name]) return;
      current = name;
      const d = DATA[name];
      tabs.forEach(t => {
        const on = t.dataset.terrain === name;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (on && focus) t.focus();
      });
      seg.style.setProperty('--seg-i', d.i);
      panel.setAttribute('aria-labelledby', 'tab-' + name);
      envs.forEach(el => el.classList.toggle('is-active', el.dataset.env === name));
      redrawDiagram(name);
      if (capLabel) capLabel.textContent = d.label;
      specDds.forEach(dd => {
        const v = d.spec[dd.dataset.spec];
        if (v == null) return;
        dd.textContent = v;
        scramble(dd, 500);
      });
      weather.setRegime(name);
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => select(tab.dataset.terrain, { focus: false }));
      tab.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(tab);
        let ni = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = tabs.length - 1;
        if (ni != null) { e.preventDefault(); select(tabs[ni].dataset.terrain); }
      });
    });

    seg.style.setProperty('--seg-i', 0);
  })();

  /* ================================================================
     PITCH — numbered stepper with auto-advance progress bar
     ================================================================ */
  (() => {
    const rig = document.querySelector('.pitch-rig');
    if (!rig) return;
    const steps = [...rig.querySelectorAll('.rail-step')];
    const panels = [...rig.querySelectorAll('.step-panel')];
    const fill = rig.querySelector('.rail-progress-fill');
    const N = steps.length;
    const STEP_MS = 6000;

    let index = 0, elapsed = 0;
    const state = { hover: false, focus: false, offscreen: false };
    const isPaused = () => reduce || state.hover || state.focus || state.offscreen;

    // JS collapses the stacked panels down to one; show step 0
    function render() {
      steps.forEach((s, i) => {
        const active = i === index;
        s.classList.toggle('is-active', active);
        s.classList.toggle('is-done', i < index);
        s.tabIndex = active ? 0 : -1;
        if (active) s.setAttribute('aria-current', 'step');
        else s.removeAttribute('aria-current');
      });
      panels.forEach((p, i) => p.classList.toggle('is-active', i === index));
    }
    function setStep(i, { focus = false, resetTimer = true } = {}) {
      index = (i + N) % N;
      if (resetTimer) { elapsed = 0; if (fill) fill.style.transform = 'scaleX(0)'; }
      render();
      if (focus) steps[index].focus();
    }

    steps.forEach((step, i) => {
      step.addEventListener('click', () => setStep(i));
      step.addEventListener('keydown', (e) => {
        let ni = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') ni = index + 1;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ni = index - 1;
        else if (e.key === 'Home') ni = 0;
        else if (e.key === 'End') ni = N - 1;
        if (ni != null) { e.preventDefault(); setStep(ni, { focus: true }); }
      });
    });

    // pause on hover / focus within the rig
    rig.addEventListener('pointerenter', () => { state.hover = true; });
    rig.addEventListener('pointerleave', () => { state.hover = false; });
    rig.addEventListener('focusin', () => { state.focus = true; });
    rig.addEventListener('focusout', () => { state.focus = false; });

    // pause when offscreen
    if ('IntersectionObserver' in window) {
      const pio = new IntersectionObserver((ents) => {
        ents.forEach(e => { state.offscreen = !e.isIntersecting; });
      }, { threshold: 0.25 });
      pio.observe(rig);
    }

    render();

    // delta-timed progress loop
    if (!reduce) {
      let last = performance.now();
      (function tick(now) {
        const dt = now - last; last = now;
        if (!isPaused()) {
          elapsed += dt;
          if (fill) fill.style.transform = `scaleX(${clamp(elapsed / STEP_MS, 0, 1)})`;
          if (elapsed >= STEP_MS) setStep(index + 1, { resetTimer: true });
        }
        requestAnimationFrame(tick);
      })(last);
    }
  })();
})();
