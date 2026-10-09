/* ==========================================================================
   Pora dnia — the page follows the real sun over Śrem.
   Sun elevation (NOAA approximation) drives a continuous grade on the video
   (warm golden hour, cool blue night, darkness) and the colour theme:
   light while the sun is up, dark after sunset. Because it follows the sun
   rather than fixed hours, it is right in December and in June alike.
   Runs in <head> (before paint) so the theme never flashes.
   Preview any hour with ?tod=HH (e.g. ?tod=20.5). Manual override is kept
   in localStorage ('ks-theme': auto | light | dark).
   ========================================================================== */
(() => {
  'use strict';

  const LAT = 52.0745, LON = 17.0353; // salon, Psarskie k. Śremu
  const root = document.documentElement;
  const STORE = 'ks-theme';
  const rad = Math.PI / 180;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

  let mode = 'auto';
  try { mode = localStorage.getItem(STORE) || 'auto'; } catch (_) {}

  /* "Now", or today at ?tod=HH in Warsaw time. */
  function moment() {
    const now = new Date();
    const q = parseFloat(new URLSearchParams(location.search).get('tod'));
    if (Number.isNaN(q)) return now;
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const wh = +p.find((x) => x.type === 'hour').value + +p.find((x) => x.type === 'minute').value / 60;
    return new Date(now.getTime() + (((q % 24) + 24) % 24 - wh) * 3600e3);
  }

  /* Solar elevation in degrees + whether it is before solar noon. */
  function sun(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const n = Math.floor((d.getTime() - start) / 864e5);
    const hUTC = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
    const g = (2 * Math.PI / 365) * (n - 1 + (hUTC - 12) / 24);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const tst = hUTC * 60 + eq + 4 * LON;
    const ha = (tst / 4 - 180) * rad;
    const cz = Math.sin(LAT * rad) * Math.sin(decl) + Math.cos(LAT * rad) * Math.cos(decl) * Math.cos(ha);
    return { elev: 90 - Math.acos(clamp(cz, -1, 1)) / rad, morning: ha < 0 };
  }

  function phaseOf(e, morning) {
    if (e < -12) return 'night';
    if (e < -0.8) return morning ? 'dawn' : 'dusk';
    if (e < 10) return morning ? 'morning' : 'golden';
    return 'day';
  }

  const state = { elev: 0, phase: 'day', theme: 'dark', mode };
  let first = true;

  function apply() {
    const now = moment();
    const { elev: e, morning } = sun(now);
    const daylight = smooth(-5, 8, e);
    // Video grade: golden hour peaks near the horizon, blue + darkness at night.
    const warm = clamp(1 - Math.abs(e - 3) / 11, 0, 1) * 0.42;
    const cool = smooth(-1, -14, e) * 0.5;
    const dark = smooth(4, -16, e) * 0.34;
    const s = root.style;
    s.setProperty('--tod-warm', warm.toFixed(3));
    s.setProperty('--tod-cool', cool.toFixed(3));
    s.setProperty('--tod-dark', dark.toFixed(3));
    s.setProperty('--daylight', daylight.toFixed(3));
    // The fire reads stronger when it's dark outside.
    s.setProperty('--glow', (0.18 + 0.5 * (1 - daylight)).toFixed(3));

    const theme = mode === 'auto' ? (e > 0 ? 'light' : 'dark') : mode;
    if (theme !== root.dataset.theme) {
      if (!first) {
        root.classList.add('theme-anim');
        setTimeout(() => root.classList.remove('theme-anim'), 1400);
      }
      root.dataset.theme = theme;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.content = theme === 'light' ? '#F3EFEA' : '#171412';
    }
    root.dataset.phase = phaseOf(e, morning);
    Object.assign(state, { date: now, elev: e, phase: root.dataset.phase, theme, mode });
    first = false;
    document.dispatchEvent(new CustomEvent('ks:tod', { detail: state }));
  }

  function set(next) {
    mode = ['light', 'dark'].includes(next) ? next : 'auto';
    try { localStorage.setItem(STORE, mode); } catch (_) {}
    apply();
  }

  window.KS_TOD = { state, set, apply };
  apply();
  setInterval(apply, 60 * 1000);
})();
