/* ==========================================================================
   Command palette — Ctrl/⌘ + K (or "/") opens a searchable list of
   sections, actions (call, email, map, fire, sound), theme, language and
   guides. Keyboard-first combobox + listbox; searches PL and EN labels.
   ========================================================================== */
(() => {
  'use strict';

  const dlg = document.querySelector('.palette');
  if (!dlg || typeof dlg.showModal !== 'function') return;

  const input = dlg.querySelector('.palette__input');
  const list = dlg.querySelector('.palette__list');
  const empty = dlg.querySelector('.palette__empty');
  const t = (k) => (window.KS ? window.KS.t(k) : k);
  const D = window.I18N || {};
  const BASE = document.body.dataset.base || '';
  const isMac = /Mac|iPhone|iPad/i.test(navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform || navigator.userAgent);

  document.querySelectorAll('[data-kbd]').forEach((k) => (k.textContent = isMac ? '⌘K' : 'Ctrl K'));

  const go = (id) => () => {
    if (document.getElementById(id) && window.KS) window.KS.scrollTo(id);
    else location.href = `${BASE}index.html#${id}`;
  };
  const click = (sel) => () => { const el = document.querySelector(sel); el && el.click(); };
  const href = (url) => () => { location.href = url; };
  const ext = (url) => () => window.open(url, '_blank', 'noopener');
  const theme = (m) => () => { window.KS_TOD && window.KS_TOD.set(m); window.KS && window.KS.toast(t('theme.' + m)); };
  const here = (sel) => !!document.querySelector(sel);

  const ITEMS = [
    { g: 'pal.nav', key: 'nav.offer', icon: 'i-flame', run: go('oferta') },
    { g: 'pal.nav', key: 'nav.calc', icon: 'i-calc', words: 'moc kw power', run: go('kalkulator') },
    { g: 'pal.nav', key: 'nav.work', icon: 'i-image', words: 'galeria gallery zdjecia', run: go('realizacje') },
    { g: 'pal.nav', key: 'nav.about', icon: 'i-users', run: go('o-nas') },
    { g: 'pal.nav', key: 'nav.blog', icon: 'i-book', words: 'blog', run: go('porady') },
    { g: 'pal.nav', key: 'nav.contact', icon: 'i-mail', run: go('kontakt') },
    { g: 'pal.nav', key: 'pal.top', icon: 'i-arrow-up', run: go('top') },

    { g: 'pal.actions', key: 'pal.callR', icon: 'i-phone', hint: '693 836 137', words: 'telefon phone roman', run: () => window.KS ? window.KS.call('+48693836137') : href('tel:+48693836137')() },
    { g: 'pal.actions', key: 'pal.callP', icon: 'i-phone', hint: '695 516 353', words: 'telefon phone przemyslaw', run: () => window.KS ? window.KS.call('+48695516353') : href('tel:+48695516353')() },
    { g: 'pal.actions', key: 'pal.mail', icon: 'i-mail', hint: 'biuro@kominkisrem.pl', words: 'email', run: href('mailto:biuro@kominkisrem.pl') },
    { g: 'pal.actions', key: 'pal.copy', icon: 'i-copy', words: 'email kopiuj', run: () => window.KS && window.KS.copyEmail() },
    {
      g: 'pal.actions', key: 'pal.form', icon: 'i-arrow-r', words: 'formularz form wiadomosc',
      run: () => { go('kontakt')(); setTimeout(() => { const i = document.getElementById('f-name'); i && i.focus({ preventScroll: true }); }, 1400); },
    },
    {
      g: 'pal.actions', key: 'pal.map', icon: 'i-map', words: 'mapa dojazd google maps adres address',
      run: () => { if (!here('[data-map]')) return go('kontakt')(); go('kontakt')(); setTimeout(() => window.KS && window.KS.loadMap(), 900); },
    },
    { g: 'pal.actions', key: 'pal.route', icon: 'i-nav', hint: '↗', words: 'trasa directions nawigacja mapa maps dojazd', run: ext('https://www.google.com/maps/dir/?api=1&destination=Lipowa+2%2C+Psarskie%2C+63-100+%C5%9Arem') },

    { g: 'pal.actions', key: 'pal.fb', icon: 'i-facebook', hint: '↗', words: 'fb social media profil zdjecia realizacje', run: ext('https://www.facebook.com/people/Kominki-%C5%9Arem/100063482743323/') },
    { g: 'pal.fire', key: 'pal.blaze', icon: 'i-flame', words: 'rozpal ogien fire stoke', when: () => here('.bg__video'), run: () => window.KS && window.KS.blaze() },
    { g: 'pal.fire', key: 'pal.video', icon: 'i-pause', words: 'pauza stop play wideo video animacja', when: () => here('.video-toggle'), run: click('.video-toggle') },
    { g: 'pal.fire', key: 'pal.sound', icon: 'i-volume', words: 'dzwiek audio mute wycisz', when: () => here('.sound-toggle'), run: click('.sound-toggle') },

    { g: 'pal.theme', key: 'pal.auto', icon: 'i-auto', words: 'pora dnia auto motyw theme', run: theme('auto') },
    { g: 'pal.theme', key: 'pal.light', icon: 'i-sun', words: 'jasny light dzien', run: theme('light') },
    { g: 'pal.theme', key: 'pal.dark', icon: 'i-moon', words: 'ciemny dark noc', run: theme('dark') },

    { g: 'pal.lang', label: 'Polski', icon: 'i-globe', hint: 'PL', words: 'polish', run: click('.lang__btn[data-lang="pl"]') },
    { g: 'pal.lang', label: 'English', icon: 'i-globe', hint: 'EN', words: 'angielski', run: click('.lang__btn[data-lang="en"]') },

    { g: 'pal.posts', key: 'post1.t', icon: 'i-book', words: 'moc kw', run: href(`${BASE}porady/jak-dobrac-moc-kominka.html`) },
    { g: 'pal.posts', key: 'post2.t', icon: 'i-book', words: 'drewno wood', run: href(`${BASE}porady/jakim-drewnem-palic-w-kominku.html`) },
    { g: 'pal.posts', key: 'post3.t', icon: 'i-book', words: 'plaszcz water', run: href(`${BASE}porady/kominek-z-plaszczem-wodnym.html`) },
    { g: 'pal.posts', key: 'post4.t', icon: 'i-book', words: 'rozpalanie lighting', run: href(`${BASE}porady/jak-rozpalic-w-kominku.html`) },
  ];

  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  const label = (it) => (it.key ? t(it.key) : it.label);
  const haystack = (it) => norm([it.key ? ['pl', 'en'].map((l) => (D[l] && D[l][it.key]) || '').join(' ') : it.label, it.words || '', it.hint || ''].join(' '));

  function score(it, q) {
    if (!q) return 1;
    const l = norm(label(it));
    if (l.startsWith(q)) return 4;
    if (l.split(/\s+/).some((w) => w.startsWith(q))) return 3;
    if (haystack(it).includes(q)) return 2;
    let i = 0;
    for (const c of l) if (c === q[i]) i++;
    return i === q.length ? 0.5 : 0;
  }

  let shown = [];
  let active = 0;

  function render() {
    const q = norm(input.value.trim());
    const groups = [];
    ITEMS.forEach((it) => {
      if (it.when && !it.when()) return;
      const s = score(it, q);
      if (s <= 0) return;
      let g = groups.find((x) => x.g === it.g);
      if (!g) groups.push((g = { g: it.g, items: [] }));
      g.items.push({ it, s });
    });
    if (q) {
      groups.forEach((g) => g.items.sort((a, b) => b.s - a.s));
      groups.sort((a, b) => b.items[0].s - a.items[0].s);
    }
    shown = [];
    list.innerHTML = groups.map((g) => {
      const rows = g.items.map(({ it }) => {
        const i = shown.push(it) - 1;
        return `<li class="palette__item" role="option" id="pal-opt-${i}" data-i="${i}" aria-selected="false">
          <span class="palette__icon"><svg class="ico" aria-hidden="true"><use href="#${it.icon}"/></svg></span>
          <span class="palette__label">${label(it)}</span>
          ${it.hint ? `<span class="palette__hint">${it.hint}</span>` : ''}
          <kbd class="palette__enter" aria-hidden="true">↵</kbd>
        </li>`;
      }).join('');
      return `<li role="presentation" class="palette__group">${t(g.g)}</li>${rows}`;
    }).join('');
    empty.hidden = shown.length > 0;
    setActive(0, false);
  }

  function setActive(i, scroll = true) {
    if (!shown.length) { input.removeAttribute('aria-activedescendant'); return; }
    active = (i + shown.length) % shown.length;
    list.querySelectorAll('[role="option"]').forEach((el) => {
      const on = +el.dataset.i === active;
      el.setAttribute('aria-selected', String(on));
      el.classList.toggle('is-active', on);
      if (on && scroll) el.scrollIntoView({ block: 'nearest' });
    });
    input.setAttribute('aria-activedescendant', `pal-opt-${active}`);
  }

  function runActive(i = active) {
    const it = shown[i];
    if (!it) return;
    close(() => requestAnimationFrame(it.run));
  }

  function openPalette() {
    if (dlg.open) return;
    input.value = '';
    render();
    dlg.classList.remove('is-closing');
    dlg.showModal();
    input.focus();
    window.KS && window.KS.lenis && window.KS.lenis.stop();
  }
  function close(after) {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    dlg.classList.add('is-closing');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      dlg.close();
      dlg.classList.remove('is-closing');
      window.KS && window.KS.lenis && window.KS.lenis.start();
      if (after) after();
    }, reduced ? 0 : 150);
  }

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home' && !input.value) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && !input.value) { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); runActive(); }
    else if (e.key === 'Tab') e.preventDefault();
  });
  list.addEventListener('pointermove', (e) => {
    const el = e.target.closest('[role="option"]');
    if (el && +el.dataset.i !== active) setActive(+el.dataset.i, false);
  });
  list.addEventListener('click', (e) => {
    const el = e.target.closest('[role="option"]');
    if (el) runActive(+el.dataset.i);
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      dlg.open ? close() : openPalette();
      return;
    }
    const a = document.activeElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable;
    if (e.key === '/' && !typing && !dlg.open) { e.preventDefault(); openPalette(); }
  });
  document.querySelectorAll('.nav__kbd, [data-open-palette]').forEach((b) => b.addEventListener('click', () => setTimeout(openPalette, b.closest('.sheet') ? 300 : 0)));
  document.addEventListener('ks:lang', () => { if (dlg.open) render(); });
})();
