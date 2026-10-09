/* ==========================================================================
   Printable calculator report (raport.html). Reads the calculator inputs from
   the URL, recomputes everything with the shared model (calc-model.js), fills
   the A4 sheet and opens the print dialog so the visitor can "Save as PDF".
   ========================================================================== */
(() => {
  'use strict';

  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') === 'en' ? 'en' : 'pl';
  const D = (window.I18N && window.I18N[lang]) || {};
  const loc = lang === 'pl' ? 'pl-PL' : 'en-GB';
  const M = window.KSCalc;

  /* Report-only copy */
  const R = {
    pl: {
      save: 'Zapisz jako PDF', hint: 'W oknie drukowania wybierz „Zapisz jako PDF” jako drukarkę.', back: 'Wróć do kalkulatora',
      kicker: 'Wstępny dobór', title: 'Twój kominek — moc i koszt ciepła', no: 'Nr',
      house: 'Twój dom', area: 'Powierzchnia do ogrzania', height: 'Wysokość sufitu', vol: 'Kubatura', ins: 'Ocieplenie', ind: 'Przyjęty wskaźnik',
      need: 'Zalecana moc nominalna wkładu', range: 'Zapotrzebowanie', costT: 'Koszt ciepła w sezonie', zl: 'zł',
      nextT: 'Co dalej?',
      s1: 'Zadzwoń lub przyjedź do salonu', s1p: 'Pokażemy wkłady i okładziny na żywo — w Psarskiem k. Śremu.',
      s2: 'Weź rzut domu lub zdjęcia salonu', s2p: 'Sprawdzimy komin, miejsce na kominek i rozprowadzenie ciepła.',
      s3: 'Otrzymasz projekt i wycenę', s3p: 'Dobierzemy wkład dokładnie do Twojego domu — bez przewymiarowania.',
      call: 'Zadzwoń', qr: 'Zeskanuj telefonem, aby od razu zadzwonić.',
      disc: 'Wynik ma charakter orientacyjny (metoda wskaźnikowa) i nie zastępuje bilansu cieplnego budynku ani oferty handlowej. Koszty liczone bez opłat stałych; ceny energii i drewna zmieniają się — przy wycenie przeliczymy je na aktualnych stawkach.',
      share: { evenings: 'Kominek pokrywa ok. ¼ ciepła w sezonie (palenie wieczorami).', daily: 'Kominek pokrywa ok. ½ ciepła w sezonie (palenie codziennie).', main: 'Kominek pokrywa ok. 80% ciepła w sezonie (główne ogrzewanie).' },
      prices: 'Ceny: drewno {w} zł/mp, gaz {g} zł/kWh, prąd {e} zł/kWh.',
      file: 'Kominki-Srem-dobor-kominka-{kw}kW',
      bar: { wood: 'Drewno w kominku', gas: 'Gaz ziemny', pump: 'Pompa ciepła', electric: 'Grzejniki elektryczne' },
    },
    en: {
      save: 'Save as PDF', hint: 'In the print dialog choose “Save as PDF” as the printer.', back: 'Back to the calculator',
      kicker: 'Preliminary sizing', title: 'Your fireplace — power and heating cost', no: 'No.',
      house: 'Your home', area: 'Area to heat', height: 'Ceiling height', vol: 'Volume', ins: 'Insulation', ind: 'Indicator used',
      need: 'Recommended nominal insert power', range: 'Heat demand', costT: 'Heating cost per season', zl: 'PLN',
      nextT: 'Next steps',
      s1: 'Call us or visit the showroom', s1p: 'See inserts and cladding in person — in Psarskie near Śrem.',
      s2: 'Bring a floor plan or photos', s2p: 'We will check the chimney, the space and heat distribution.',
      s3: 'Get a design and a quote', s3p: 'We match the insert to your home — without oversizing.',
      call: 'Call', qr: 'Scan with your phone to call straight away.',
      disc: 'This is an estimate (indicator method) and does not replace a heat-loss calculation or a quote. Costs exclude fixed fees; energy and wood prices change — we recalculate them at current rates when quoting.',
      share: { evenings: 'The fireplace covers about ¼ of the season’s heat (evenings).', daily: 'The fireplace covers about ½ of the season’s heat (daily).', main: 'The fireplace covers about 80% of the season’s heat (main heating).' },
      prices: 'Prices: wood {w} PLN/stacked m³, gas {g} PLN/kWh, electricity {e} PLN/kWh.',
      file: 'Kominki-Srem-fireplace-sizing-{kw}kW',
      bar: { wood: 'Wood in the fireplace', gas: 'Natural gas', pump: 'Heat pump', electric: 'Electric heaters' },
    },
  }[lang];

  const fmt = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  const n = (v, d = 1) => new Intl.NumberFormat(loc, { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
  const zl = (v) => new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }).format(Math.round(v / 10) * 10);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const pos = (k, def, a, b) => { const v = parseFloat(q.get(k)); return Number.isFinite(v) ? clamp(v, a, b) : def; };
  const set = (k, v) => document.querySelectorAll(`[data-v="${k}"]`).forEach((el) => (el.textContent = v));

  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach((el) => { if (R[el.dataset.t]) el.textContent = R[el.dataset.t]; });

  /* Inputs (validated, same ranges as the on-page calculator) */
  const area = pos('a', 60, 10, 300);
  const height = pos('h', 2.6, 2.2, 5);
  const ins = ['a', 'b', 'c', 'd'].includes(q.get('i')) ? q.get('i') : 'b';
  const cur = ['gas', 'pump', 'electric'].includes(q.get('cur')) ? q.get('cur') : null;
  const share = ['evenings', 'daily', 'main'].includes(q.get('s')) ? q.get('s') : 'daily';
  const prices = { wood: pos('pw', M.DEFAULT_PRICES.wood, 50, 1500), gas: pos('pg', M.DEFAULT_PRICES.gas, 0.05, 2), power: pos('pe', M.DEFAULT_PRICES.power, 0.2, 3) };

  /* Power */
  const p = M.power(area, height, ins);
  const [lo, hi] = M.LEVELS[ins];
  set('area', `${area} m²`);
  set('height', `${n(height)} m`);
  set('vol', `${Math.round(p.vol)} m³`);
  set('ins', D[`ins.${ins}.t`] || ins);
  set('ind', `${lo}–${hi} W/m³`);
  set('kw', n(p.kw, p.kw % 1 ? 1 : 0));
  set('range', `${n(p.min)}–${n(p.max)} kW`);
  set('tip', D[p.kw < 5 ? 'tip.small' : p.kw <= 12 ? 'tip.mid' : p.kw <= 18 ? 'tip.big' : 'tip.huge'] || '');
  const pct = (v) => Math.min(100, (v / 25) * 100);
  const band = document.querySelector('.scale__band');
  band.style.left = pct(p.min) + '%';
  band.style.width = Math.max(1.5, pct(p.max) - pct(p.min)) + '%';
  document.querySelector('.scale__mark').style.left = pct(p.kw) + '%';

  /* Season cost (only when the visitor came from the cost calculator) */
  const costs = document.querySelector('[data-costs]');
  if (!cur) costs.remove();
  else {
    const r = M.season(area, height, ins, share, prices);
    const save = r.cost[cur] - r.cost.wood;
    const sp = Math.round((save / r.cost[cur]) * 100);
    const ok = sp >= 5;
    set('saveLabel', D[ok ? 'cost.saveLabel' : 'cost.evenLabel'] || '');
    set('save', zl(Math.max(0, save)));
    set('saveSub', ok ? fmt(D[`cost.vs.${cur}`] || '', { pct: sp }) : D['cost.even'] || '');
    set('share', R.share[share]);
    set('wood', fmt(D['cost.wood'] || '', { mp: n(r.woodMp), t: n(r.woodKg / 1000), kwh: zl(r.fromFire) }));
    set('prices', fmt(R.prices, { w: zl(prices.wood), g: n(prices.gas, 2), e: n(prices.power, 2) }));
    const max = Math.max(...Object.values(r.cost));
    document.querySelector('[data-v="bars"]').innerHTML = ['wood', 'gas', 'pump', 'electric'].map((k) =>
      `<li class="${k === 'wood' ? 'wood' : ''} ${k === cur ? 'cur' : ''}"><span>${R.bar[k]}${k === cur ? ` · ${D['cost.now'] || ''}` : ''}</span><b class="tabular">${zl(r.cost[k])} ${D['cost.perSeason'] || ''}</b><span class="track"><span class="fill" style="width:${((r.cost[k] / max) * 100).toFixed(1)}%"></span></span></li>`
    ).join('');
  }

  /* Number + date: same inputs on the same day → same number */
  const now = new Date();
  set('date', new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(now));
  let h = 0;
  for (const c of location.search) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  set('no', `KS-${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${(h % 9000) + 1000}`);
  // The saved PDF takes its file name from the title.
  document.title = fmt(R.file, { kw: n(p.kw, p.kw % 1 ? 1 : 0) });

  /* QR code that dials Roman */
  const qrBox = document.querySelector('[data-qr]');
  const qrReady = new Promise((res) => {
    const s = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js' });
    s.onload = () => {
      const qr = window.qrcode(0, 'M');
      qr.addData('tel:+48693836137');
      qr.make();
      qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
      res();
    };
    s.onerror = () => { qrBox.remove(); document.querySelector('.qr__hint').remove(); res(); };
    document.head.appendChild(s);
  });

  /* Print: button, and once automatically when everything has loaded */
  const doPrint = () => window.print();
  document.querySelector('[data-print]').addEventListener('click', doPrint);
  if (!q.has('noprint')) {
    Promise.all([document.fonts ? document.fonts.ready : null, qrReady, new Promise((r) => setTimeout(r, 400))]).then(() => setTimeout(doPrint, 200));
  }
})();
