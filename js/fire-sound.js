/* ==========================================================================
   Crackling wood fire — synthesised live with the Web Audio API (no files).
   Deliberately subtle: only the crackle of burning logs and the odd soft
   pop of resin, quiet in the background — no roar or hiss (they read as wind).
   On by default. Browsers only allow audio after the visitor's first click,
   tap or key press, so playback begins on that first interaction.
   A visitor who switches it off stays muted on later visits.
   ========================================================================== */
(() => {
  'use strict';

  const btn = document.querySelector('.sound-toggle');
  if (!btn) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { btn.hidden = true; return; }

  const t = (k) => (window.KS ? window.KS.t(k) : k);
  const rand = (a, b) => a + Math.random() * (b - a);
  const VOLUME = 0.22;
  const STORE = 'ks-sound';

  let ctx, master, crackBus, popBus;
  let bursts = [];
  let on = false, running = false;
  let crackTimer, popTimer, suspendTimer;
  let heat = 1; // 1 = normal, >1 right after "Rozpal"

  const prefersOff = () => { try { return localStorage.getItem(STORE) === 'off'; } catch (_) { return false; } };
  const remember = (v) => { try { localStorage.setItem(STORE, v); } catch (_) {} };

  /* A tiny decaying noise impulse — the raw material of a crackle. */
  function impulse(ms, sharp) {
    const len = Math.max(32, Math.floor(ctx.sampleRate * ms / 1000));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.exp(-i / (len * (sharp ? 0.12 : 0.3)));
      d[i] = (Math.random() * 2 - 1) * env;
    }
    return buf;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 10; comp.ratio.value = 5;
    // Soften the top end so crackles sound warm and a little distant, not clicky
    const top = ctx.createBiquadFilter(); top.type = 'lowpass'; top.frequency.value = 5200; top.Q.value = 0.3;
    master.connect(top).connect(comp).connect(ctx.destination);

    // Crackles and pops share a short "firebox" echo
    crackBus = ctx.createGain(); crackBus.gain.value = 1;
    popBus = ctx.createGain(); popBus.gain.value = 1;
    const delay = ctx.createDelay(0.2); delay.delayTime.value = 0.045;
    const fb = ctx.createGain(); fb.gain.value = 0.22;
    const wet = ctx.createGain(); wet.gain.value = 0.25;
    [crackBus, popBus].forEach((b) => { b.connect(master); b.connect(delay); });
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(master);

    bursts = [];
    for (let i = 0; i < 24; i++) bursts.push(impulse(rand(1.5, 9), true));
    for (let i = 0; i < 6; i++) bursts.push(impulse(rand(14, 40), false));
  }

  function pan(dest) {
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
    if (p.pan) p.pan.value = rand(-0.55, 0.55);
    p.connect(dest);
    return p;
  }

  /* One crackle: a filtered impulse with random colour and level. */
  function crackle(at, vol, low) {
    const src = ctx.createBufferSource();
    src.buffer = bursts[Math.floor(Math.random() * (low ? bursts.length : 24))];
    src.playbackRate.value = rand(0.7, 1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = low ? rand(450, 1100) : rand(1100, 4200);
    f.Q.value = rand(0.8, 3.5);
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(pan(low ? popBus : crackBus));
    src.start(at);
  }

  /* Crackles arrive in irregular clusters, like real logs. */
  function crackleStep() {
    const now = ctx.currentTime + 0.02;
    const n = Math.random() < 0.22 * heat ? Math.floor(rand(2, 6)) : 1;
    let at = now;
    for (let i = 0; i < n; i++) {
      crackle(at, rand(0.03, 0.14) * (n > 1 ? 0.75 : 1) * Math.min(heat, 1.5), false);
      at += rand(0.01, 0.07);
    }
    crackTimer = setTimeout(crackleStep, rand(90, 520) / heat);
  }
  /* The odd soft pop of resin. */
  function popStep() {
    const now = ctx.currentTime + 0.02;
    crackle(now, rand(0.18, 0.34), true);
    if (Math.random() < 0.4) crackle(now + rand(0.02, 0.07), rand(0.06, 0.14), false);
    popTimer = setTimeout(popStep, rand(2500, 8000) / heat);
  }

  function syncButton() {
    btn.setAttribute('aria-pressed', String(on));
    const key = on ? 'sound.off' : 'sound.on';
    btn.dataset.i18nAria = key;
    btn.setAttribute('aria-label', t(key));
  }

  async function play() {
    if (!ctx) build();
    clearTimeout(suspendTimer);
    try { await ctx.resume(); } catch (_) {}
    if (ctx.state !== 'running' || !on) return false;
    if (running) return true;
    running = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(VOLUME, ctx.currentTime, 0.8);
    clearTimeout(crackTimer); clearTimeout(popTimer);
    crackTimer = setTimeout(crackleStep, 300);
    popTimer = setTimeout(popStep, 1500);
    return true;
  }
  function silence() {
    running = false;
    clearTimeout(crackTimer); clearTimeout(popTimer);
    if (ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      suspendTimer = setTimeout(() => ctx.suspend(), 1200);
    }
  }

  btn.addEventListener('click', () => {
    on = !on;
    remember(on ? 'on' : 'off');
    syncButton();
    if (on) play(); else silence();
  });

  /* "Rozpal" stokes the sound for a few seconds */
  document.addEventListener('ks:blaze', () => {
    if (!running) return;
    heat = 2;
    const cool = () => { heat = Math.max(1, heat - 0.15); if (heat > 1) setTimeout(cool, 400); };
    setTimeout(cool, 1800);
  });

  const UNLOCK = ['pointerdown', 'keydown', 'touchend'];
  function unlock(e) {
    if (e && e.target && e.target.closest && e.target.closest('.sound-toggle')) return;
    if (!on) return;
    play().then((ok) => { if (ok) UNLOCK.forEach((ev) => window.removeEventListener(ev, unlock, true)); });
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx || !running) return;
    if (document.hidden) { clearTimeout(crackTimer); clearTimeout(popTimer); ctx.suspend(); }
    else { ctx.resume(); crackTimer = setTimeout(crackleStep, 300); popTimer = setTimeout(popStep, 1500); }
  });
  document.addEventListener('ks:lang', syncButton);

  on = !prefersOff();
  syncButton();
  if (on) {
    UNLOCK.forEach((ev) => window.addEventListener(ev, unlock, true));
    const policy = navigator.getAutoplayPolicy && navigator.getAutoplayPolicy('audiocontext');
    if (policy === 'allowed' || (navigator.userActivation && navigator.userActivation.hasBeenActive)) play();
  }
})();
