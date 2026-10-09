/* ==========================================================================
   Measurement — counts the actions that matter to the owner: calls, e-mails,
   enquiries, calculator use, map / directions, Facebook. Cookieless by design
   (Plausible), so no consent banner is needed.

   Turn it on in <head>:  <meta name="ks-analytics" content="plausible" data-domain="kominkisrem.pl">
   (create the site at plausible.io first). Leave content="" to switch it off.
   Also understands GA4 (gtag) or Umami if one of them is already on the page.
   Preview events in the console with ?debug-analytics.
   ========================================================================== */
(() => {
  'use strict';

  const meta = document.querySelector('meta[name="ks-analytics"]');
  const provider = meta ? meta.content.trim() : '';
  const debug = new URLSearchParams(location.search).has('debug-analytics');

  if (provider === 'plausible' && meta.dataset.domain) {
    // Queue events sent before the script arrives.
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.domain = meta.dataset.domain;
    s.src = meta.dataset.src || 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  }

  /* Where on the page did it happen? (hero, oferta, kontakt, nav, stopka, okno…) */
  function place(el) {
    if (!el || !el.closest) return '';
    if (el.closest('.call')) return 'okno-telefonu';
    if (el.closest('.palette')) return 'paleta';
    if (el.closest('.nav')) return 'menu';
    if (el.closest('.sheet')) return 'menu-mobilne';
    if (el.closest('.footer')) return 'stopka';
    const sec = el.closest('section[id], article.article');
    if (sec && sec.id === 'top') return 'hero';
    return sec ? (sec.id || 'artykul') : location.pathname.replace(/^\//, '') || 'strona';
  }

  function track(name, props = {}) {
    const p = { ...props, strona: location.pathname };
    if (debug) console.info('[analytics]', name, p);
    try {
      if (typeof window.plausible === 'function') window.plausible(name, { props: p });
      else if (typeof window.gtag === 'function') window.gtag('event', name.toLowerCase().replace(/\s+/g, '_'), p);
      else if (window.umami && typeof window.umami.track === 'function') window.umami.track(name, p);
    } catch (_) { /* never break the page for statistics */ }
  }
  window.ksTrack = track;

  const PEOPLE = { '+48693836137': 'Roman', '+48695516353': 'Przemysław' };
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.startsWith('tel:')) {
      const who = PEOPLE[href.slice(4)] || href.slice(4);
      // From the call card it is an actual dial; elsewhere on a phone it dials, on a computer it opens the card.
      const action = a.closest('.call') ? 'aplikacja' : touch ? 'telefon' : 'okno';
      track('Telefon', { osoba: who, sposob: action, miejsce: place(a) });
    } else if (href.startsWith('mailto:')) {
      track('E-mail', { miejsce: place(a) });
    } else if (href.includes('facebook.com')) {
      track('Facebook', { miejsce: place(a) });
    } else if (href.includes('google.com/maps/dir')) {
      track('Trasa do salonu', { miejsce: place(a) });
    } else if (a.matches('[data-map-load]')) {
      track('Mapa', { miejsce: place(a) });
    } else if (a.matches('[data-call-copy]')) {
      track('Telefon skopiowany', { miejsce: 'okno-telefonu' });
    } else if (a.matches('[data-copy]')) {
      track('E-mail skopiowany', { miejsce: place(a) });
    } else if (a.matches('[data-calc-cta]')) {
      track('Kalkulator → kontakt', { kw: (document.querySelector('[data-out="kw"]') || {}).textContent || '' });
    } else if (a.matches('[data-blaze]')) {
      track('Rozpal', { miejsce: place(a) });
    } else if (a.matches('.lang__btn')) {
      track('Język', { jezyk: a.dataset.lang });
    } else if (a.matches('.sound-toggle')) {
      // capture phase: aria-pressed still holds the state *before* this click
      track('Dźwięk', { stan: a.getAttribute('aria-pressed') === 'true' ? 'wylaczony' : 'wlaczony' });
    } else if (a.matches('.video-toggle')) {
      track('Ogień pauza', { stan: a.getAttribute('aria-pressed') === 'true' ? 'wznowiony' : 'zatrzymany' });
    }
  }, true);

  document.addEventListener('ks:form-sent', (e) => track('Formularz wysłany', { temat: (e.detail && e.detail.topic) || '' }));
  document.addEventListener('ks:form-error', (e) => track('Formularz błąd', { powod: (e.detail && e.detail.reason) || '' }));
  document.addEventListener('ks:calc-used', (e) => track('Kalkulator', e.detail || {}));

  // The command palette counts as used when it opens.
  const pal = document.querySelector('.palette');
  if (pal) new MutationObserver(() => { if (pal.open) track('Paleta poleceń'); }).observe(pal, { attributes: true, attributeFilter: ['open'] });

  // Reading depth on guides: 75 % of an article scrolled.
  const art = document.querySelector(`[data-lang-block="${document.documentElement.lang}"] .prose`) || document.querySelector('.article .prose');
  if (art && 'IntersectionObserver' in window) {
    const mark = document.createElement('span');
    mark.style.cssText = 'display:block;height:1px';
    const blocks = art.children;
    art.insertBefore(mark, blocks[Math.floor(blocks.length * 0.75)] || null);
    const io = new IntersectionObserver((en) => {
      if (en.some((x) => x.isIntersecting)) { track('Artykuł przeczytany', { tytul: document.title }); io.disconnect(); }
    });
    io.observe(mark);
  }
})();
