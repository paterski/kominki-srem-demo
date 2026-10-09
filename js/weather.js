/* ==========================================================================
   Weather at the showroom (Psarskie k. Śremu) from Open-Meteo — free,
   keyless, CORS-enabled; cached per session for 20 minutes.
   Below 15 °C the tile turns into a "time to light the fire" moment:
   the thermometer drops, the flame mark ignites and a "Rozpal" button
   stokes the fire on the page. Preview with ?temp=7 (any number).
   If the request fails the tile quietly hides its weather part.
   ========================================================================== */
(() => {
  'use strict';

  const tile = document.querySelector('.weather');
  if (!tile) return;
  const t = (k) => (window.KS ? window.KS.t(k) : k);
  const fmt = (k, v) => (window.KS ? window.KS.fmt(k, v) : k);
  const LAT = 52.0745, LON = 17.0353;
  const COLD = 15;
  const CACHE = 'ks-weather';
  const TTL = 20 * 60 * 1000;

  const CLOUD_TOP = '<path class="wx-cloud" d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.24"/>';
  const ICONS = {
    sun: '<circle cx="12" cy="12" r="4"/><g class="wx-rays"><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></g>',
    moon: '<path class="wx-moon" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    partly: '<g class="wx-rays"><path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41"/></g><path d="M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path class="wx-cloud" d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    partlyNight: '<path class="wx-moon" d="M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6Z"/><path d="M18.38 3.64a5 5 0 0 0 1.98 7.86 5 5 0 0 1-5.95 1.38"/>',
    cloud: '<path class="wx-cloud" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    fog: CLOUD_TOP + '<path class="wx-fog" d="M16 17H7"/><path class="wx-fog" d="M17 21H9"/>',
    rain: CLOUD_TOP + '<path class="wx-drop" d="M8 14v4"/><path class="wx-drop" d="M12 16v4"/><path class="wx-drop" d="M16 14v4"/>',
    snow: CLOUD_TOP + '<path class="wx-drop" d="M8 16h.01"/><path class="wx-drop" d="M12 18h.01"/><path class="wx-drop" d="M16 16h.01"/>',
    storm: CLOUD_TOP + '<path class="wx-bolt" d="m13 12-3 5h4l-3 5"/>',
  };
  function classify(code, isDay) {
    if (code === 0) return [isDay ? 'sun' : 'moon', 'w.clear'];
    if (code === 1) return [isDay ? 'sun' : 'moon', 'w.mainly'];
    if (code === 2) return [isDay ? 'partly' : 'partlyNight', 'w.partly'];
    if (code === 3) return ['cloud', 'w.overcast'];
    if (code === 45 || code === 48) return ['fog', 'w.fog'];
    if (code >= 51 && code <= 57) return ['rain', 'w.drizzle'];
    if (code >= 61 && code <= 67) return ['rain', 'w.rain'];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['snow', 'w.snow'];
    if (code >= 80 && code <= 82) return ['rain', 'w.showers'];
    if (code >= 95) return ['storm', 'w.storm'];
    return ['cloud', 'w.overcast'];
  }

  function readCache() {
    try { const c = JSON.parse(sessionStorage.getItem(CACHE)); if (c && Date.now() - c.ts < TTL) return c; } catch (_) {}
    return null;
  }
  function writeCache(d) { try { sessionStorage.setItem(CACHE, JSON.stringify({ ...d, ts: Date.now() })); } catch (_) {} }

  let data = null;

  async function load() {
    data = readCache();
    if (!data) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day&timezone=Europe%2FWarsaw`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(res.status);
        const w = await res.json();
        if (!w.current) throw new Error('no data');
        data = { temp: Math.round(w.current.temperature_2m), code: w.current.weather_code, day: w.current.is_day === 1 };
        writeCache(data);
      } finally { clearTimeout(timer); }
    }
    const q = parseFloat(new URLSearchParams(location.search).get('temp'));
    if (!Number.isNaN(q)) data = { ...data, temp: Math.round(q) };
    render(true);
  }

  function render(first) {
    if (!data) return;
    const [icon, key] = classify(data.code, data.day);
    const temp = `${data.temp}°C`;
    tile.querySelector('.weather__icon').innerHTML = `<svg viewBox="0 0 24 24">${ICONS[icon]}</svg>`;
    tile.querySelector('.weather__temp').textContent = temp;
    tile.querySelector('.weather__desc').textContent = t(key);
    tile.classList.remove('is-loading');

    const ignite = tile.querySelector('.ignite');
    const warm = tile.querySelector('.weather__warm');
    if (data.temp < COLD) {
      ignite.hidden = false;
      warm.hidden = true;
      tile.classList.add('is-cold');
      const dark = window.KS_TOD ? window.KS_TOD.state.elev < 0 : !data.day;
      const k = data.temp <= 0 ? 'w.cold.freeze' : dark ? 'w.cold.night' : 'w.cold.day';
      ignite.querySelector('.ignite__text').textContent = fmt(k, { t: temp });
      // Mercury: -15 °C → 6 %, +15 °C → 70 %; starts high and drops on reveal.
      const merc = Math.max(6, Math.min(70, 38 + data.temp * 2.13));
      const m = ignite.querySelector('.ignite__mercury');
      if (first) {
        m.style.setProperty('--merc', '92%');
        setTimeout(() => m.style.setProperty('--merc', merc.toFixed(0) + '%'), 900);
        setTimeout(() => tile.classList.add('is-lit'), 2000);
      } else m.style.setProperty('--merc', merc.toFixed(0) + '%');
    } else {
      ignite.hidden = true;
      tile.classList.remove('is-cold', 'is-lit');
      warm.hidden = false;
      warm.textContent = fmt('w.warm', { t: temp });
    }
  }

  document.addEventListener('ks:lang', () => render(false));

  load().catch(() => {
    tile.classList.remove('is-loading');
    const now = tile.querySelector('.weather__now');
    now && now.remove();
  });
})();
