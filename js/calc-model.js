/* ==========================================================================
   Shared calculation model — used by the on-page calculator (calc.js) and the
   printable PDF report (raport.js), so both always show the same numbers.

   1) Power: heated volume × indicator W/m³ by insulation (see calc.js header).
   2) Season cost: yearly useful heat for space heating, by insulation, scaled
      by ceiling height. Indicative values for Polish buildings:
        a 50 · b 80 · c 130 · d 200 kWh per m² per year (at 2.6 m).
      Share of that heat the fireplace provides is chosen by the visitor.
      Cost of 1 kWh of useful heat = price / (energy content × efficiency):
        wood   — 400 zł/mp seasoned hardwood, ~2000 kWh/mp (≈3100 kWh/m³ × 0.65), insert 75 %
        gas    — ~0.31 zł/kWh with distribution, condensing boiler 95 %
        heat pump — electricity 1.13 zł/kWh, seasonal COP 3.2
        electric heaters — 1.13 zł/kWh, 100 %
      Prices are editable on the page; fixed fees (subscriptions) are not included.
   ========================================================================== */
(() => {
  'use strict';

  const LEVELS = { a: [20, 30], b: [30, 40], c: [40, 55], d: [60, 80] };   // W/m³
  const YEARLY = { a: 50, b: 80, c: 130, d: 200 };                        // kWh/m²·year
  const SHARE = { evenings: 0.25, daily: 0.5, main: 0.8 };
  const DEFAULT_PRICES = { wood: 400, gas: 0.31, power: 1.13 };
  const WOOD_KWH_PER_MP = 2000;
  const WOOD_KG_PER_MP = 450;
  const EFF = { wood: 0.75, gas: 0.95, pump: 3.2, electric: 1 };

  function power(area, height, ins) {
    const [lo, hi] = LEVELS[ins] || LEVELS.b;
    const vol = area * height;
    const min = (vol * lo) / 1000;
    const max = (vol * hi) / 1000;
    const kw = Math.max(2, Math.round(((min + max) / 2) * 2) / 2);
    return { vol, min, max, kw };
  }

  function season(area, height, ins, shareKey, prices = DEFAULT_PRICES) {
    const p = { ...DEFAULT_PRICES, ...prices };
    const share = SHARE[shareKey] ?? SHARE.daily;
    const demand = area * (YEARLY[ins] || YEARLY.b) * (height / 2.6);   // kWh/year, whole area
    const fromFire = demand * share;                                     // kWh/year the fireplace covers
    const perKwh = {
      wood: p.wood / (WOOD_KWH_PER_MP * EFF.wood),
      gas: p.gas / EFF.gas,
      pump: p.power / EFF.pump,
      electric: p.power / EFF.electric,
    };
    const cost = Object.fromEntries(Object.entries(perKwh).map(([k, v]) => [k, fromFire * v]));
    const woodMp = fromFire / (WOOD_KWH_PER_MP * EFF.wood);
    return { demand, share, fromFire, perKwh, cost, woodMp, woodKg: woodMp * WOOD_KG_PER_MP, prices: p };
  }

  window.KSCalc = { LEVELS, YEARLY, SHARE, DEFAULT_PRICES, EFF, power, season };
})();
