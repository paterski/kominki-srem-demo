/* ==========================================================================
   Embers — realistic sparks rising out of the firebox in the video and
   drifting across the page.
   Each spark is a tiny hot core drawn as a short motion streak, cooling over
   its life from white-yellow through amber and orange to a dull red before it
   winks out. Hot air carries them up and a turbulent flow field makes them
   curl; every so often the logs "crack" and throw a fast spray of sparks.
   Near the cursor (or a finger) they get knocked away at a slightly random
   angle and keep flying on their own momentum — they never spring back.
   Pauses with the fire button, when the tab is hidden, and is off entirely
   under prefers-reduced-motion. "Rozpal" (ks:blaze) throws a big burst.
   ========================================================================== */
(() => {
  'use strict';

  const canvas = document.querySelector('.sparks');
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) { canvas && canvas.remove(); return; }
  const ctx = canvas.getContext('2d');
  const bg = document.querySelector('.bg');
  const root = document.documentElement;
  const small = matchMedia('(max-width: 767px)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  const MAX = small ? 220 : 560;
  const rand = (a, b) => a + Math.random() * (b - a);

  // Firebox opening in the 1920×1080 clip (normalised video coordinates)
  const VW = 1920, VH = 1080;
  const FIRE = { u0: 0.37, u1: 0.63, v: 0.52 };

  let W = 0, H = 0;
  function resize() {
    W = window.innerWidth;
    H = Math.max(window.innerHeight, document.documentElement.clientHeight);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  /* A small, tight glow sprite — just enough bloom around a hot core. */
  const glow = (() => {
    const s = document.createElement('canvas');
    s.width = s.height = 32;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,190,110,0.55)');
    grd.addColorStop(0.35, 'rgba(255,120,40,0.18)');
    grd.addColorStop(1, 'rgba(255,90,20,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return s;
  })();

  /* Blackbody-ish cooling ramp: t = 1 (hottest) → 0 (cold). */
  const RAMP = [
    [0.0, 110, 26, 12],
    [0.25, 190, 52, 18],
    [0.5, 236, 104, 34],
    [0.75, 255, 170, 70],
    [0.92, 255, 222, 150],
    [1.0, 255, 246, 220],
  ];
  function heatColor(t) {
    for (let i = 1; i < RAMP.length; i++) {
      if (t <= RAMP[i][0]) {
        const a = RAMP[i - 1], b = RAMP[i];
        const k = (t - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
      }
    }
    return RAMP[RAMP.length - 1].slice(1);
  }

  /* Video-space point → screen point (object-fit: cover + CSS scale). */
  function toScreen(u, v) {
    const p = bg ? parseFloat(bg.style.getPropertyValue('--p')) || 0 : 0;
    const s0 = Math.max(W / VW, H / VH);
    const k = 1.06 + p * 0.08;
    const bx = (W - VW * s0) / 2 + u * VW * s0;
    const by = (H - VH * s0) / 2 + v * VH * s0;
    const ox = W * 0.5, oy = H * 0.46;
    return [ox + (bx - ox) * k, oy + (by - oy) * k, s0 * k];
  }

  const parts = [];
  /* kind: 0 = drifting ember, 1 = fast crackle spark */
  function spawn(fromFire, kind = 0, at = null) {
    if (parts.length >= MAX * (kind ? 1.25 : 1)) return;
    let x, y, sc = 1;
    if (at) { [x, y] = at; sc = at[2] || 1; }
    else if (fromFire) {
      const pt = toScreen(rand(FIRE.u0, FIRE.u1), FIRE.v + rand(-0.015, 0.03));
      x = pt[0]; y = pt[1]; sc = Math.max(0.7, Math.min(1.3, pt[2] * 1.4));
    } else { x = rand(-20, W + 20); y = H + rand(0, 30); }

    const fast = kind === 1;
    const ang = -Math.PI / 2 + (fast ? rand(-0.75, 0.75) : rand(-0.3, 0.3));
    const speed = fast ? rand(260, 560) : rand(70, 210) * (fromFire ? 1 : 0.6);
    parts.push({
      x, y, px: x, py: y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      kx: 0, ky: 0,
      age: 0,
      life: fast ? rand(0.5, 1.5) : rand(1.6, 4.4) * (fromFire ? 1 : 1.3),
      size: (fast ? rand(0.5, 1.1) : Math.random() < 0.1 ? rand(1.4, 2.1) : rand(0.55, 1.3)) * sc,
      heat: fast ? rand(0.9, 1) : rand(0.72, 1),   // starting temperature
      ph: rand(0, 1000),
      buoy: fast ? rand(40, 90) : rand(60, 150),
      flare: 0,
    });
  }

  /* Cheap smooth flow field (sum of sines) — curls the rising hot air. */
  function flow(x, y, t) {
    return Math.sin(x * 0.0105 + t * 0.9) + Math.sin(y * 0.0123 - t * 0.7) + Math.sin((x + y) * 0.0061 + t * 0.4);
  }

  /* Pointer — position + velocity, so a fast swipe throws sparks further. */
  const ptr = { x: -9999, y: -9999, vx: 0, vy: 0, t: 0, on: false };
  window.addEventListener('pointermove', (e) => {
    const now = performance.now();
    const dt = Math.max(now - ptr.t, 8) / 1000;
    if (ptr.on) { ptr.vx = (e.clientX - ptr.x) / dt; ptr.vy = (e.clientY - ptr.y) / dt; }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now; ptr.on = true;
  }, { passive: true });
  window.addEventListener('pointerdown', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true; ptr.t = performance.now(); }, { passive: true });
  document.addEventListener('pointerleave', () => { ptr.on = false; });
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') ptr.on = false; }, { passive: true });

  let running = false, raf = 0, last = 0, acc = 0, fireOn = true, time = 0, blazeT = 0, nextCrack = 0.8;
  const R = small ? 90 : 130;

  /* A log cracks: a spray of fast, hot sparks from one spot in the fire. */
  function crack(n) {
    const pt = toScreen(rand(FIRE.u0 + 0.03, FIRE.u1 - 0.03), FIRE.v + rand(0, 0.02));
    const sc = Math.max(0.7, Math.min(1.3, pt[2] * 1.4));
    for (let i = 0; i < n; i++) spawn(true, 1, [pt[0] + rand(-6, 6), pt[1] + rand(-3, 3), sc]);
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    const p = bg ? parseFloat(bg.style.getPropertyValue('--p')) || 0 : 1;
    const coal = root.dataset.theme === 'light' && p > 0.5;

    if (fireOn) {
      blazeT = Math.max(0, blazeT - dt);
      const rate = (small ? 24 : 52) * (1 - p * 0.5) + blazeT * 90;
      acc += rate * dt;
      while (acc >= 1) { acc -= 1; spawn(Math.random() < (1 - p * 0.8)); }
      // Crackle sprays — only while the firebox is on screen
      nextCrack -= dt * (blazeT > 0 ? 4 : 1);
      if (nextCrack <= 0 && p < 0.9) { crack(Math.floor(rand(5, small ? 10 : 16))); nextCrack = rand(0.5, 2.4); }
    }

    ptr.vx *= 0.9; ptr.vy *= 0.9;
    const pspeed = Math.hypot(ptr.vx, ptr.vy);

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = coal ? 'source-over' : 'lighter';
    ctx.lineCap = 'round';

    for (let i = parts.length - 1; i >= 0; i--) {
      const s = parts[i];
      s.age += dt;
      const k = s.age / s.life;
      if (k >= 1 || s.y < -40 || s.x < -60 || s.x > W + 60 || s.y > H + 60) { parts.splice(i, 1); continue; }

      // Hot air lifts the spark while it is hot; turbulence curls the path.
      const temp = s.heat * Math.pow(1 - k, 0.8);
      s.vy -= s.buoy * temp * dt;
      const a = flow(s.x, s.y, time + s.ph) * 1.2;
      s.vx += Math.cos(a) * 70 * dt;
      s.vy += Math.sin(a) * 40 * dt;
      s.vx *= Math.pow(0.45, dt);
      s.vy *= Math.pow(0.6, dt);
      s.vy += 14 * dt; // a whisper of gravity once the lift fades

      if (ptr.on) {
        const dx = s.x - ptr.x, dy = s.y - ptr.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) {
          const d = Math.sqrt(d2) || 1;
          const f = Math.pow(1 - d / R, 2);
          const ang = Math.atan2(dy, dx) + rand(-0.9, 0.9);
          const push = (300 + Math.min(pspeed, 2400) * 0.4) * f;
          s.kx += Math.cos(ang) * push * dt * 6;
          s.ky += Math.sin(ang) * push * dt * 6;
          s.flare = Math.min(1, s.flare + f * 0.8);   // fresh air makes it glow
          if (s.life - s.age < 1) s.life += 0.5 * f;
        }
      }
      s.kx *= Math.pow(0.35, dt);
      s.ky *= Math.pow(0.35, dt);
      s.flare *= Math.pow(0.15, dt);

      s.px = s.x; s.py = s.y;
      s.x += (s.vx + s.kx) * dt;
      s.y += (s.vy + s.ky) * dt;

      // Brightness: quick fade-in, irregular twinkle, cool-down to nothing
      const twinkle = 0.7 + 0.3 * Math.sin(time * (18 + (s.ph % 9)) + s.ph);
      const t = Math.min(1, temp + s.flare * 0.35);
      const alpha = Math.min(1, s.age * 12) * Math.min(1, (1 - k) * 2.2) * twinkle;
      if (alpha <= 0.02) continue;
      let [r, g, b] = heatColor(t);
      if (coal) { r *= 0.62; g *= 0.4; b *= 0.35; }

      // Motion streak: length follows speed (like a camera shutter)
      const vx = s.x - s.px, vy = s.y - s.py;
      const len = Math.min(4.2, 1 + Math.hypot(vx, vy) * 0.9);
      const w = s.size * (0.75 + t * 0.5);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(s.x - vx * len, s.y - vy * len);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      // Faint bloom only on the hot ones
      if (!coal && t > 0.45) {
        const gr = w * (4 + t * 4);
        ctx.globalAlpha = alpha * (t - 0.35) * 0.9;
        ctx.drawImage(glow, s.x - gr, s.y - gr, gr * 2, gr * 2);
      }
    }
    ctx.globalAlpha = 1;

    if (!fireOn && !parts.length) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }

  /* Phones & tablets: the canvas + glass blur together can make scrolling stutter,
     so the embers fade out as soon as the visitor starts scrolling and the loop
     stops completely; they come back only at the very top of the page. */
  const touch = small || matchMedia('(hover: none), (pointer: coarse)').matches;
  let parked = false, parkTimer;
  function park(on) {
    if (on === parked) return;
    parked = on;
    clearTimeout(parkTimer);
    canvas.style.opacity = on ? '0' : '';
    if (on) parkTimer = setTimeout(() => { stop(); parts.length = 0; }, 260);
    else start();
  }
  if (touch) {
    canvas.style.transition = 'opacity 250ms ease-out';
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (!parked && y > 24) park(true);
      else if (parked && y < 4) park(false);
    }, { passive: true });
  }

  function start() {
    if (running || document.hidden || parked) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, W, H);
  }

  document.addEventListener('ks:fire', (e) => {
    fireOn = !!e.detail;
    if (fireOn) start();
  });
  document.addEventListener('ks:blaze', () => {
    fireOn = true;
    blazeT = 2.4;
    for (let i = 0; i < 4; i++) setTimeout(() => crack(small ? 16 : 30), i * 160);
    start();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (fireOn || parts.length) start(); });

  fireOn = !(window.KS && window.KS.fireOn === false);
  if (touch && window.scrollY > 24) park(true); // opened mid-page, e.g. via #kontakt
  start();
})();
