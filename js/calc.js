/* ==========================================================================
   Fireplace power calculator — indicator method (W per m³ of heated volume).
   Indicators by insulation level, based on Polish industry guides
   (Murator: ~30 W/m³ new well-insulated, ~40 older insulation, ~80 none;
   Globenergia: 30–50 / 50–80 / 80–120 W/m² for 2.5–2.7 m rooms):
     a  energy-efficient (WT 2021)   20–30 W/m³
     b  well insulated               30–40 W/m³
     c  average / older insulation   40–55 W/m³
     d  poor / no insulation         60–80 W/m³
   The result is the demand range and a suggested nominal power (mid-range,
   rounded to 0.5 kW). It is an estimate, stated as such on the page.
   ========================================================================== */
(() => {
  'use strict';

  const form = document.querySelector('.calc__form');
  if (!form) return;
  const out = document.querySelector('.calc__out');
  const $o = (k) => document.querySelector(`[data-out="${k}"]`);
  const t = (k) => (window.KS ? window.KS.t(k) : k);
  const lang = () => (window.KS ? window.KS.lang : 'pl');
  const nf = (v, d = 1) => new Intl.NumberFormat(lang() === 'pl' ? 'pl-PL' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);

  const LEVELS = { a: [20, 30], b: [30, 40], c: [40, 55], d: [60, 80] };
  const LOOK = {          // wall stroke, colour, heat-leak count
    a: [15, '#F7C98B', 0],
    b: [11, '#F29A4A', 1],
    c: [7, '#C9361A', 3],
    d: [3.5, '#8A817A', 6],
  };
  const SCALE_MAX = 25;

  const area = form.elements.area;
  const height = form.elements.height;
  const svg = out.querySelector('.house');
  const shell = svg.querySelector('.house__shell');
  const inner = svg.querySelector('.house__inner');
  const clip = svg.querySelector('.house__clip');
  const fire = svg.querySelector('.house__fire');
  const flue = svg.querySelector('.house__flue');
  const stack = svg.querySelector('.house__stack');
  const flames = svg.querySelector('.hf-flames');
  const leaks = svg.querySelector('.house__leaks');
  const dimW = svg.querySelector('.house__dim--w');
  const dimH = svg.querySelector('.house__dim--h');
  const scale = out.querySelector('.scale');
  const numEl = $o('kw');
  let shown = 0;
  let current = null;

  function fill(input) {
    const p = (input.value - input.min) / (input.max - input.min) * 100;
    input.style.setProperty('--fill', p.toFixed(1) + '%');
  }

  function drawHouse(a, h, ins, kw) {
    const ground = 232;
    const w = 130 + Math.sqrt((a - 10) / 290) * 220;
    const wall = 46 + ((h - 2.2) / 2.8) * 72;
    const roof = 30 + w * 0.12;
    const x0 = 200 - w / 2, x1 = 200 + w / 2, top = ground - wall;
    const [sw, col, nLeaks] = LOOK[ins];
    shell.setAttribute('d', `M${x0} ${ground} L${x0} ${top} L200 ${top - roof} L${x1} ${top} L${x1} ${ground} Z`);
    const i = sw / 2 + 2;
    const innerD = `M${x0 + i} ${ground} L${x0 + i} ${top + i * 0.5} L200 ${top - roof + i * 1.4} L${x1 - i} ${top + i * 0.5} L${x1 - i} ${ground} Z`;
    inner.setAttribute('d', innerD);
    clip.setAttribute('d', innerD);
    svg.style.setProperty('--ins-w', sw);
    svg.style.setProperty('--ins-c', col);
    fire.setAttribute('transform', `translate(200 ${ground - 2})`);
    // Chimney: dashed flue from the fireplace up to the ridge, stack above the roof line
    const apex = top - roof;
    const roofY = (x) => apex + (Math.abs(x - 200) / (w / 2)) * roof;
    flue.setAttribute('d', `M200 ${ground - 52} V${apex + 4}`);
    stack.setAttribute('d', `M191 ${roofY(191)} V${apex - 20} H209 V${roofY(209)} Z`);
    svg.style.setProperty('--fs', (0.55 + Math.min(kw, SCALE_MAX) / SCALE_MAX * 1.05).toFixed(2));
    svg.style.setProperty('--heat', (0.35 + Math.min(kw, SCALE_MAX) / SCALE_MAX * 0.6).toFixed(2));

    // Heat escaping through poor walls/roof — wavy dashed lines heading outwards
    const spots = [
      [x0, top + wall * 0.35, -1, 0], [x1, top + wall * 0.55, 1, 0], [200 - w * 0.22, top - roof * 0.55, -0.4, -1],
      [x0, top + wall * 0.75, -1, 0], [200 + w * 0.25, top - roof * 0.45, 0.4, -1], [x1, top + wall * 0.25, 1, 0],
    ];
    leaks.innerHTML = spots.slice(0, nLeaks).map(([x, y, dx, dy], k) => {
      const len = 34, ox = dx * len, oy = dy * len;
      const nx = -dy * 6, ny = dx * 6;
      return `<path style="animation-delay:${-k * 0.23}s" d="M${x} ${y} q${ox / 3 + nx} ${oy / 3 + ny} ${ox / 2} ${oy / 2} t${ox / 2} ${oy / 2}"/>`;
    }).join('');

    dimW.setAttribute('x', 200); dimW.setAttribute('y', ground + 20);
    dimW.textContent = `${a} m²`;
    dimH.setAttribute('x', x0 - 12); dimH.setAttribute('y', top + wall / 2 + 4);
    dimH.setAttribute('text-anchor', 'end');
    dimH.textContent = `${nf(h)} m`;
  }

  function animateNumber(to) {
    const gsap = window.gsap;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!gsap || reduced) { shown = to; numEl.textContent = nf(to, to % 1 ? 1 : 0); return; }
    const o = { v: shown };
    gsap.to(o, {
      v: to, duration: 0.7, ease: 'power3.out', overwrite: true,
      onUpdate: () => { shown = o.v; numEl.textContent = nf(Math.round(o.v * 2) / 2, (Math.round(o.v * 2) / 2) % 1 ? 1 : 0); },
    });
  }

  function update() {
    const a = +area.value;
    const h = +height.value;
    const ins = (form.querySelector('input[name="ins"]:checked') || {}).value || 'b';
    const [lo, hi] = LEVELS[ins];
    const vol = a * h;
    const min = (vol * lo) / 1000;
    const max = (vol * hi) / 1000;
    const kw = Math.max(2, Math.round(((min + max) / 2) * 2) / 2);
    current = { a, h, ins, kw };

    fill(area); fill(height);
    $o('area').textContent = a;
    $o('height').textContent = nf(h);
    $o('range').textContent = `${nf(min)}–${nf(max)} kW`;
    $o('vol').textContent = `${Math.round(vol)} m³`;
    animateNumber(kw);

    const pct = (v) => Math.min(100, (v / SCALE_MAX) * 100);
    scale.style.setProperty('--b0', pct(min) + '%');
    scale.style.setProperty('--bw', Math.max(1.5, pct(max) - pct(min)) + '%');
    scale.style.setProperty('--m', pct(kw) + '%');

    const tip = kw < 5 ? 'tip.small' : kw <= 12 ? 'tip.mid' : kw <= 18 ? 'tip.big' : 'tip.huge';
    $o('tip').textContent = t(tip);
    drawHouse(a, h, ins, kw);
  }

  /* Flame tongues inside the glass, each flickering on its own rhythm. */
  const BASE = -15.5;
  flames.innerHTML = [[-22, 6, 7], [-14, 7, 10], [-6, 8, 12.5], [2, 7, 11], [10, 8, 13], [18, 6, 9], [24, 5, 6.5]].map(([cx, fw, h], k) => {
    const x0 = cx - fw / 2, x1 = cx + fw / 2;
    const tip = cx + (k % 2 ? 0.8 : -0.8);
    return `<path class="hf-f" style="animation-delay:${(-k * 0.37).toFixed(2)}s;animation-duration:${(1.1 + (k % 3) * 0.25).toFixed(2)}s" d="M${x0} ${BASE} C${x0} ${BASE - h * 0.45} ${cx - fw * 0.15} ${BASE - h * 0.62} ${tip} ${BASE - h} C${cx + fw * 0.2} ${BASE - h * 0.6} ${x1} ${BASE - h * 0.42} ${x1} ${BASE} Z"/>`;
  }).join('');

  form.addEventListener('input', update);
  // Statistics: one "Kalkulator" event per visit, once the visitor settles on values.
  let usedTimer, reported = false;
  form.addEventListener('input', () => {
    if (reported) return;
    clearTimeout(usedTimer);
    usedTimer = setTimeout(() => {
      reported = true;
      document.dispatchEvent(new CustomEvent('ks:calc-used', { detail: { m2: current.a, ocieplenie: current.ins, kw: current.kw } }));
    }, 2000);
  });
  document.addEventListener('ks:lang', update);
  update();

  /* "Dobierzmy wkład razem" — carry the result into the contact form */
  const cta = document.querySelector('[data-calc-cta]');
  cta && cta.addEventListener('click', () => {
    const msg = document.getElementById('f-msg');
    if (!msg || !current) return;
    const insLabel = t(`ins.${current.ins}.t`);
    const line = window.KS.fmt('calc.mail', { area: current.a, height: nf(current.h), ins: insLabel, kw: nf(current.kw, current.kw % 1 ? 1 : 0) });
    if (!msg.value.includes(line)) msg.value = msg.value ? `${msg.value}\n${line}` : `${line}\n`;
  });
})();
