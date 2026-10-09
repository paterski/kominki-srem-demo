/* ==========================================================================
   Kominki Śrem — interactions & motion
   GSAP + ScrollTrigger for choreography, Lenis for smooth wheel scrolling.
   Degrades gracefully: no JS / no GSAP / reduced motion.
   Also runs on the article pages (porady/*), where there is no hero.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const motion = !!(gsap && ST) && !reduced;
  if (gsap && ST) gsap.registerPlugin(ST);

  const EMAIL = 'biuro@kominkisrem.pl';

  /* ------------------------------------------------------------------------
     i18n
     ------------------------------------------------------------------------ */
  const dict = window.I18N || { pl: {} };
  let lang = (() => {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && dict[q]) return q;
    try {
      const saved = localStorage.getItem('ks-lang');
      if (saved && dict[saved]) return saved;
    } catch (_) {}
    return (navigator.language || 'pl').toLowerCase().startsWith('pl') ? 'pl' : 'en';
  })();
  const t = (k) => (dict[lang] && dict[lang][k]) ?? (dict.pl && dict.pl[k]) ?? k;
  const fmt = (k, vars) => t(k).replace(/\{(\w+)\}/g, (_, n) => (vars[n] ?? ''));

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function splitChars(el) {
    const text = el.textContent.trim();
    el.innerHTML = text.split(/\s+/).map((w) =>
      `<span class="w" aria-hidden="true">${Array.from(w).map((c) => `<span class="ch">${esc(c)}</span>`).join('')}</span>`
    ).join(' ') + `<span class="sr-only">${esc(text)}</span>`;
  }
  function splitWords(el) {
    el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="wd">${esc(w)}</span>`).join(' ');
  }
  function splitAll() {
    $$('[data-split] [data-i18n]').forEach(splitChars);
    $$('[data-words]').forEach(splitWords);
  }

  function applyLang(next) {
    lang = dict[next] ? next : 'pl';
    root.lang = lang;
    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
    $$('.lang__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $$('.lang').forEach((seg) => (seg.dataset.active = lang));
    if (!document.body.classList.contains('page-article')) document.title = t('meta.title');
    syncFireLabel();
    renderHours();
    syncTodLabel();
    splitAll();
    try { localStorage.setItem('ks-lang', lang); } catch (_) {}
    document.dispatchEvent(new CustomEvent('ks:lang', { detail: lang }));
  }

  /* ------------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------------ */
  const toastEl = $('.toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 3200);
  }

  /* ------------------------------------------------------------------------
     Background video — two copies cross-fade at the loop point so the seam
     (and the slight jump in the wall texture) is never seen as a cut.
     ------------------------------------------------------------------------ */
  const bg = $('.bg');
  const vids = $$('.bg__video');
  const vToggle = $('.video-toggle');
  const XF = 1.4;             // seconds of overlap
  let front = 0;
  let swapping = false;
  let fireOn = !reduced;      // reduced motion: poster frame until the visitor presses play

  function syncFireLabel() {
    if (!vToggle) return;
    vToggle.setAttribute('aria-pressed', String(!fireOn));
    vToggle.setAttribute('aria-label', t(fireOn ? 'video.pause' : 'video.play'));
    vToggle.dataset.i18nAria = fireOn ? 'video.pause' : 'video.play';
  }
  function safePlay(v) { const p = v.play(); return p && p.catch ? p.catch(() => {}) : Promise.resolve(); }

  vids.forEach((v, i) => {
    v.style.opacity = i === 0 ? '1' : '0';
    v.style.zIndex = '1';
  });

  function crossfade() {
    const a = vids[front], b = vids[1 - front];
    swapping = true;
    b.currentTime = 0;
    safePlay(b).then(() => {
      b.style.zIndex = '2';
      b.style.transition = `opacity ${XF}s linear`;
      requestAnimationFrame(() => { b.style.opacity = '1'; });
      setTimeout(() => {
        a.pause();
        a.style.transition = 'none';
        a.style.opacity = '0';
        a.style.zIndex = '1';
        b.style.zIndex = '1';
        front = 1 - front;
        swapping = false;
      }, XF * 1000 + 60);
    });
  }
  function loopWatch() {
    const a = vids[front];
    if (fireOn && !swapping && a && a.duration && a.currentTime >= a.duration - XF - 0.05) crossfade();
    requestAnimationFrame(loopWatch);
  }
  function setFire(on, silent) {
    fireOn = on;
    root.classList.toggle('is-fire-paused', !on);
    if (on) safePlay(vids[front]);
    else vids.forEach((v) => v.pause());
    syncFireLabel();
    if (!silent) document.dispatchEvent(new CustomEvent('ks:fire', { detail: on }));
  }
  if (vids.length) {
    if (vids.length > 1) requestAnimationFrame(loopWatch);
    else vids[0].loop = true;
    setFire(fireOn, true);
    vToggle && vToggle.addEventListener('click', () => setFire(!fireOn));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) vids.forEach((v) => v.pause());
      else if (fireOn) safePlay(vids[front]);
    });
  }

  /* "Rozpal" — stoke the fire: brighter glow, a burst of embers, louder crackle */
  function blaze() {
    if (!fireOn) setFire(true);
    document.dispatchEvent(new CustomEvent('ks:blaze'));
    const flash = $('.blaze-flash');
    if (flash) { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); }
    if (bg) {
      if (gsap) gsap.fromTo(bg, { '--blaze': 1 }, { '--blaze': 0, duration: 3.2, ease: 'power2.out' });
      else { bg.style.setProperty('--blaze', 1); setTimeout(() => bg.style.setProperty('--blaze', 0), 1600); }
    }
  }
  $$('[data-blaze]').forEach((b) => b.addEventListener('click', blaze));

  /* ------------------------------------------------------------------------
     Time-of-day label (tod.js)
     ------------------------------------------------------------------------ */
  function syncTodLabel() {
    const el = $('[data-tod-label]');
    if (!el || !window.KS_TOD) return;
    const time = new Intl.DateTimeFormat(lang === 'pl' ? 'pl-PL' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' }).format(window.KS_TOD.state.date || new Date());
    el.textContent = `${t('tod.' + window.KS_TOD.state.phase)} · ${time}`;
  }
  document.addEventListener('ks:tod', syncTodLabel);
  setInterval(syncTodLabel, 20000);

  /* ------------------------------------------------------------------------
     Opening hours + live open/closed badge (Europe/Warsaw)
     DO POTWIERDZENIA Z KLIENTEM — godziny poglądowe, edytuj tutaj.
     ------------------------------------------------------------------------ */
  const HOURS = { 1: ['9:00', '17:00'], 2: ['9:00', '17:00'], 3: ['9:00', '17:00'], 4: ['9:00', '17:00'], 5: ['9:00', '17:00'], 6: ['9:00', '13:00'], 0: null };
  const DAYKEYS = ['d.sun', 'd.mon', 'd.tue', 'd.wed', 'd.thu', 'd.fri', 'd.sat'];
  function warsawNow() {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Warsaw', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const g = (ty) => p.find((x) => x.type === ty).value;
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')), min: +g('hour') * 60 + +g('minute') };
  }
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  function renderHours() {
    const list = $('[data-hours]');
    const badge = $('[data-open-badge]');
    if (!list) return;
    const now = warsawNow();
    const sameWeek = [1, 2, 3, 4, 5].every((d) => String(HOURS[d]) === String(HOURS[1]));
    const rows = [];
    if (sameWeek) rows.push({ k: 'd.monfri', h: HOURS[1], today: now.day >= 1 && now.day <= 5 });
    else [1, 2, 3, 4, 5].forEach((d) => rows.push({ k: DAYKEYS[d], h: HOURS[d], today: now.day === d }));
    rows.push({ k: 'd.sat', h: HOURS[6], today: now.day === 6 });
    rows.push({ k: 'd.sun', h: HOURS[0], today: now.day === 0 });
    list.innerHTML = rows.map((r) => `<dt class="${r.today ? 'is-today' : ''}">${t(r.k)}</dt><dd class="${r.today ? 'is-today' : ''}">${r.h ? `${r.h[0]} – ${r.h[1]}` : t('c.closedDay')}</dd>`).join('');
    if (badge) {
      const h = HOURS[now.day];
      const open = !!h && now.min >= toMin(h[0]) && now.min < toMin(h[1]);
      badge.textContent = t(open ? 'c.open' : 'c.closed');
      badge.className = `open-badge ${open ? 'is-open' : 'is-closed'}`;
    }
  }
  setInterval(renderHours, 60000);

  /* Footer wordmark: scale the font so the whole word always fits its box
     (heavy negative tracking makes a pure vw size unreliable across widths). */
  const word = $('.footer__word');
  function fitWord() {
    if (!word) return;
    word.style.fontSize = '';
    const cs = getComputedStyle(word);
    const avail = word.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const r = document.createRange();
    r.selectNodeContents(word);
    const need = r.getBoundingClientRect().width; // real content width, wherever it overflows
    if (need > avail) word.style.fontSize = `${(parseFloat(getComputedStyle(word).fontSize) * avail) / need * 0.985}px`;
  }
  fitWord();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);
  let fitTimer;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitWord, 120); }, { passive: true });

  const yearEl = $('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------------------
     Initial language
     ------------------------------------------------------------------------ */
  applyLang(lang);
  if (!motion) {
    root.classList.remove('js');
    $$('[data-split]').forEach((h) => (h.dataset.shown = '1'));
    $$('.step').forEach((s) => s.classList.add('is-on'));
    $$('.steps__line span').forEach((s) => s.style.setProperty('--lp', 1));
    $('.loader') && $('.loader').remove();
  }

  /* ------------------------------------------------------------------------
     Smooth scroll (Lenis) + anchors
     ------------------------------------------------------------------------ */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollToTarget(target) {
    if (!target) return;
    if (lenis) lenis.scrollTo(target, { duration: 1.5, easing: (x) => 1 - Math.pow(1 - x, 4) });
    else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.getElementById(id.slice(1));
    if (!target) return;
    e.preventDefault();
    if (sheetOpen) closeSheet(false);
    scrollToTarget(target);
    history.replaceState(null, '', id === '#top' ? location.pathname : id);
  });

  window.KS = {
    t, fmt, toast, blaze, setFire,
    get lang() { return lang; },
    get lenis() { return lenis; },
    get fireOn() { return fireOn; },
    scrollTo: (id) => scrollToTarget(document.getElementById(id)),
    loadMap: () => loadMap(),
  };

  /* ------------------------------------------------------------------------
     Language switch
     ------------------------------------------------------------------------ */
  $$('.lang__btn').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.lang === lang) return;
      const swap = () => {
        applyLang(btn.dataset.lang);
        if (motion) {
          $$('[data-split][data-shown]').forEach((h) => revealChars(h, 0.018, 0.8));
          paintWords();
          ST.refresh();
        }
      };
      if (motion) {
        gsap.to('main, .footer', { opacity: 0.35, duration: 0.18, ease: 'power1.out', overwrite: true });
        setTimeout(() => {
          swap();
          gsap.to('main, .footer', { opacity: 1, duration: 0.5, ease: 'power2.out', overwrite: true, clearProps: 'opacity' });
        }, 180);
      } else swap();
    })
  );

  /* ------------------------------------------------------------------------
     Mobile sheet
     ------------------------------------------------------------------------ */
  const burger = $('.nav__burger');
  const sheet = $('#sheet');
  let sheetOpen = false;
  function openSheet() {
    sheetOpen = true;
    sheet.hidden = false;
    burger.setAttribute('aria-expanded', 'true');
    lenis && lenis.stop();
    document.body.style.overflow = 'hidden';
    if (motion) {
      gsap.fromTo(sheet, { clipPath: 'circle(0% at calc(100% - 44px) 40px)' }, { clipPath: 'circle(150% at calc(100% - 44px) 40px)', duration: 0.9, ease: 'expo.out' });
      gsap.fromTo($$('.sheet__nav a, .sheet__foot', sheet), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.05, delay: 0.1 });
    }
    const first = $('.sheet__nav a', sheet);
    first && first.focus({ preventScroll: true });
  }
  function closeSheet(returnFocus = true) {
    sheetOpen = false;
    burger.setAttribute('aria-expanded', 'false');
    lenis && lenis.start();
    document.body.style.overflow = '';
    const done = () => { if (!sheetOpen) sheet.hidden = true; };
    if (motion) gsap.to(sheet, { clipPath: 'circle(0% at calc(100% - 44px) 40px)', duration: 0.5, ease: 'expo.in', onComplete: done });
    else done();
    if (returnFocus) burger.focus();
  }
  if (burger && sheet) {
    burger.addEventListener('click', () => (sheetOpen ? closeSheet() : openSheet()));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetOpen) closeSheet(); });
    matchMedia('(min-width: 1040px)').addEventListener('change', (e) => { if (e.matches && sheetOpen) closeSheet(false); });
    $$('[data-open-palette]', sheet).forEach((b) => b.addEventListener('click', () => closeSheet(false)));
  }

  /* ------------------------------------------------------------------------
     Copy email
     ------------------------------------------------------------------------ */
  async function copyText(value) {
    try { await navigator.clipboard.writeText(value); }
    catch (_) {
      const ta = Object.assign(document.createElement('textarea'), { value });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast(t('copied'));
  }
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', () => copyText(btn.dataset.copy)));
  window.KS.copyEmail = () => copyText(EMAIL);

  /* ------------------------------------------------------------------------
     "Zadzwoń" — on a phone every tel: link dials straight away. A computer
     usually has no dialer, so the click would silently do nothing; there we
     open a call card instead: the number, a QR code that dials it from the
     visitor's phone, a "call via app" button (Phone Link, Teams, Skype…)
     and copy-to-clipboard.
     ------------------------------------------------------------------------ */
  const PEOPLE = {
    '+48693836137': { name: 'Roman Rączkiewicz', gen: 'Romana', genEn: 'Roman', ini: 'RR', disp: '+48 693 836 137' },
    '+48695516353': { name: 'Przemysław Woroch', gen: 'Przemysława', genEn: 'Przemysław', ini: 'PW', disp: '+48 695 516 353' },
  };
  const callDlg = $('.call');
  const canDial = () => matchMedia('(hover: none), (pointer: coarse)').matches;
  let callNum = null;
  let qrLib = null;
  function loadQR() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLib) {
      qrLib = new Promise((res, rej) => {
        const s = Object.assign(document.createElement('script'), { src: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', async: true });
        s.onload = () => res(window.qrcode);
        s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    return qrLib;
  }
  function fillCall(num) {
    const p = PEOPLE[num];
    callNum = num;
    $('.call__avatar', callDlg).textContent = p.ini;
    $('.call__name', callDlg).textContent = p.name;
    const big = $('.call__num', callDlg);
    big.textContent = p.disp;
    $$('[data-direct]', callDlg).forEach((a) => (a.href = `tel:${num}`));
    const other = Object.keys(PEOPLE).find((k) => k !== num);
    $('[data-call-switch]', callDlg).textContent = fmt('call.switch', { name: lang === 'pl' ? PEOPLE[other].gen : PEOPLE[other].genEn });
    const box = $('.call__qr', callDlg);
    box.innerHTML = '';
    loadQR().then((qrcode) => {
      if (callNum !== num) return;
      const qr = qrcode(0, 'M');
      qr.addData(`tel:${num}`);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    }).catch(() => box.closest('.call__qr-wrap').remove());
  }
  function openCall(num) {
    if (!callDlg || typeof callDlg.showModal !== 'function') { location.href = `tel:${num}`; return; }
    fillCall(num);
    if (!callDlg.open) {
      callDlg.classList.remove('is-closing');
      callDlg.showModal();
      lenis && lenis.stop();
    }
    $('.call__dial', callDlg).focus();
  }
  function closeCall() {
    if (!callDlg.open || callDlg.classList.contains('is-closing')) return;
    callDlg.classList.add('is-closing');
    setTimeout(() => { callDlg.close(); callDlg.classList.remove('is-closing'); lenis && lenis.start(); }, reduced ? 0 : 160);
  }
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="tel:"]');
    if (!a || a.hasAttribute('data-direct') || canDial()) return; // phones: let it dial
    const num = a.getAttribute('href').slice(4);
    if (!PEOPLE[num]) return;
    e.preventDefault();
    openCall(num);
  });
  if (callDlg) {
    $('[data-call-close]', callDlg).addEventListener('click', closeCall);
    $('[data-call-switch]', callDlg).addEventListener('click', () => fillCall(Object.keys(PEOPLE).find((k) => k !== callNum)));
    // Feedback stays in the button: the modal sits in the top layer, above the toast.
    const copyBtn = $('[data-call-copy]', callDlg);
    let copyTimer;
    copyBtn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(PEOPLE[callNum].disp); } catch (_) {}
      const label = $('span', copyBtn);
      label.textContent = t('call.copied');
      $('use', copyBtn).setAttribute('href', '#i-check');
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { label.textContent = t('call.copy'); $('use', copyBtn).setAttribute('href', '#i-copy'); }, 2200);
    });
    callDlg.addEventListener('cancel', (e) => { e.preventDefault(); closeCall(); });
    callDlg.addEventListener('click', (e) => { if (e.target === callDlg) closeCall(); });
    document.addEventListener('ks:lang', () => { if (callDlg.open) fillCall(callNum); });
  }
  window.KS.call = (num = '+48693836137') => (canDial() ? (location.href = `tel:${num}`) : openCall(num));

  /* ------------------------------------------------------------------------
     Google map — loaded only on request (privacy + performance)
     ------------------------------------------------------------------------ */
  const mapFrame = $('[data-map]');
  function loadMap() {
    if (!mapFrame || mapFrame.querySelector('iframe')) return;
    const iframe = document.createElement('iframe');
    iframe.src = 'https://maps.google.com/maps?q=' + encodeURIComponent('Lipowa 2, Psarskie, 63-100 Śrem') + '&z=14&output=embed&hl=' + lang;
    iframe.title = 'Mapa dojazdu — Kominki Śrem, ul. Lipowa 2, Psarskie';
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    iframe.allowFullscreen = true;
    mapFrame.appendChild(iframe);
    const ph = mapFrame.querySelector('.map__ph');
    if (ph) setTimeout(() => ph.remove(), 400);
  }
  $$('[data-map-load]').forEach((b) => b.addEventListener('click', loadMap));

  /* ------------------------------------------------------------------------
     Contact form — validation on blur; POST to data-endpoint if configured
     (e.g. Formspree), otherwise hand over to the mail app.
     ------------------------------------------------------------------------ */
  const form = $('form.form');
  if (form) {
    const rules = {
      name: (v) => v.trim().length >= 2 || t('err.name'),
      email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || t('err.email'),
      phone: (v) => !v.trim() || v.replace(/\D/g, '').length >= 9 || t('err.phone'),
      message: (v) => v.trim().length >= 10 || t('err.msg'),
      consent: (_, el) => el.checked || t('err.consent'),
    };
    if (form.elements.t) form.elements.t.value = String(Date.now());
    const fieldOf = (input) => input.closest('.field');
    const validate = (input) => {
      const res = rules[input.name](input.value, input);
      const field = fieldOf(input);
      const err = $('.field__err', field);
      const ok = res === true;
      field.classList.toggle('is-invalid', !ok);
      input.setAttribute('aria-invalid', String(!ok));
      err.textContent = ok ? '' : res;
      return ok;
    };
    const inputs = Object.keys(rules).map((n) => form.elements[n]).filter(Boolean);
    inputs.forEach((input) => {
      const ev = input.type === 'checkbox' ? 'change' : 'blur';
      input.addEventListener(ev, () => { if (input.type === 'checkbox' || input.value) validate(input); });
      input.addEventListener('input', () => { if (fieldOf(input).classList.contains('is-invalid')) validate(input); });
    });
    document.addEventListener('ks:lang', () => inputs.forEach((i) => { if (fieldOf(i).classList.contains('is-invalid')) validate(i); }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const bad = inputs.filter((i) => !validate(i));
      if (bad.length) {
        bad[0].focus({ preventScroll: true });
        if (lenis) lenis.scrollTo(bad[0], { offset: -160, duration: 0.8 });
        else bad[0].scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
        return;
      }
      const alertBox = $('.form__alert', form);
      alertBox.hidden = true;
      form.classList.add('is-loading');
      const data = new FormData(form);
      const topic = $('input[name="topic"]:checked + span', form);
      const endpoint = form.dataset.endpoint;
      const mailto = () => {
        const body = `${data.get('message')}\n\n— ${data.get('name')}\n${data.get('email')}${data.get('phone') ? '\n' + data.get('phone') : ''}\n${t('mail.topic')}: ${topic ? topic.textContent : '-'}`;
        return `mailto:${EMAIL}?subject=${encodeURIComponent(t('mail.subject'))}&body=${encodeURIComponent(body)}`;
      };
      const finish = () => {
        form.classList.remove('is-loading');
        form.classList.add('is-done');
        $('.form__done', form).focus({ preventScroll: true });
        document.dispatchEvent(new CustomEvent('ks:form-sent', { detail: { topic: data.get('topic') } }));
      };
      const fail = (key, withMail) => {
        form.classList.remove('is-loading');
        alertBox.innerHTML = `<p>${esc(t(key))}</p>` + (withMail ? `<a class="btn btn--glass glass btn--sm" href="${mailto().replace(/"/g, '&quot;')}"><svg class="ico" aria-hidden="true"><use href="#i-mail"/></svg><span>${esc(t('f.mailApp'))}</span></a>` : '');
        alertBox.hidden = false;
        document.dispatchEvent(new CustomEvent('ks:form-error', { detail: { reason: key } }));
      };
      // No endpoint configured: hand the message over to the mail app.
      if (!endpoint) {
        setTimeout(() => { finish(); window.location.href = mailto(); }, 600);
        return;
      }
      let res, json = {};
      try {
        res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        json = await res.json().catch(() => ({}));
      } catch (_) {
        fail('f.errSend', true);
        return;
      }
      if (res.ok && json.ok) { finish(); return; }
      if (res.status === 422 && json.errors) {
        // The server disagreed with a field: show it exactly like the browser-side check does.
        form.classList.remove('is-loading');
        const badFields = Object.keys(json.errors).map((n) => form.elements[n]).filter(Boolean);
        badFields.forEach((input) => {
          const field = fieldOf(input);
          field.classList.add('is-invalid');
          input.setAttribute('aria-invalid', 'true');
          $('.field__err', field).textContent = t('err.' + json.errors[input.name]);
        });
        if (badFields[0]) badFields[0].focus();
        return;
      }
      fail(res.status === 429 ? 'f.errRate' : 'f.errSend', res.status !== 429);
    });
  }

  /* ------------------------------------------------------------------------
     Pointer light on glass
     ------------------------------------------------------------------------ */
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest && e.target.closest('[data-sheen]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  if (!motion) return; // ───────── choreography below ─────────

  function revealChars(h, stagger = 0.022, duration = 1.15, delay = 0) {
    h.dataset.shown = '1';
    return gsap.fromTo($$('.ch', h),
      { yPercent: 115, rotate: 6, opacity: 0 },
      { yPercent: 0, rotate: 0, opacity: 1, duration, delay, ease: 'expo.out', stagger, overwrite: true });
  }

  /* ------------------------------------------------------------------------
     Preloader → intro
     ------------------------------------------------------------------------ */
  const loader = $('.loader');
  const nav = $('.nav');
  const hero = $('.hero');
  if (hero) {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (!location.hash) window.scrollTo(0, 0);
  }
  lenis && loader && lenis.stop();

  const videoReady = new Promise((res) => {
    const v = vids[0];
    if (!v || v.readyState >= 3) return res();
    v.addEventListener('canplay', res, { once: true });
    v.addEventListener('error', res, { once: true });
    setTimeout(res, 2600);
  });

  function intro() {
    const tl = gsap.timeline();
    nav && tl.fromTo(nav, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', clearProps: 'transform' });
    const title = $('.hero__title') || $('.article__title[data-split]');
    title && tl.add(revealChars(title, 0.026, 1.3), 0.05);
    tl.fromTo('[data-hero-fade]', { y: 30, opacity: 0, filter: 'blur(8px)' },
      { y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.2, ease: 'expo.out', stagger: 0.09, clearProps: 'filter' }, 0.35);
  }

  if (loader) {
    const bar = $('.loader__bar span');
    const prog = { v: 0 };
    gsap.to(prog, { v: 0.85, duration: 1, ease: 'power2.out', onUpdate: () => bar.style.setProperty('--lp', prog.v) });
    Promise.all([videoReady, new Promise((r) => setTimeout(r, 1000))]).then(() => {
      gsap.timeline({ onComplete: () => { loader.remove(); lenis && lenis.start(); } })
        .to(prog, { v: 1, duration: 0.3, onUpdate: () => bar.style.setProperty('--lp', prog.v) })
        .to('.loader__inner', { scale: 0.9, opacity: 0, duration: 0.45, ease: 'power3.in' })
        .to(loader, { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
        .fromTo(bg, { scale: 1.16 }, { scale: 1, duration: 2.2, ease: 'expo.out', clearProps: 'transform' }, '<')
        .add(intro, '-=0.75');
    });
  } else intro();

  /* ------------------------------------------------------------------------
     Background: blur + tint grow as the hero scrolls away
     ------------------------------------------------------------------------ */
  const sparks = $('.sparks');
  if (hero && bg) {
    ST.create({
      trigger: hero, start: 'top top', end: 'bottom top', scrub: true,
      onUpdate: (s) => {
        bg.style.setProperty('--p', s.progress.toFixed(4));
        sparks && sparks.classList.toggle('is-over-hero', s.progress < 0.5);
      },
    });
    sparks && sparks.classList.add('is-over-hero');
    gsap.to('.hero__inner', { yPercent: -16, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 20%', scrub: true } });
    gsap.to('.hero__scroll', { opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: '20% top', scrub: true } });
  }

  /* ------------------------------------------------------------------------
     Nav: hide on scroll down, progress line, active section
     ------------------------------------------------------------------------ */
  const pill = $('.nav__pill');
  if (pill) {
    ST.create({
      start: 0, end: 'max',
      onUpdate: (s) => {
        pill.style.setProperty('--sp', s.progress.toFixed(4));
        const down = s.direction === 1 && s.scroll() > window.innerHeight * 0.6;
        nav.classList.toggle('is-hidden', down && !sheetOpen && !nav.contains(document.activeElement));
      },
    });
  }
  $$('.nav__links a[href^="#"]').forEach((a) => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (!sec) return;
    ST.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });

  /* ------------------------------------------------------------------------
     Marquee: infinite, follows scroll direction + velocity
     ------------------------------------------------------------------------ */
  const mTrack = $('.marquee__track');
  if (mTrack) {
    const list = $('.marquee__list', mTrack);
    const clone = list.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('[data-i18n]').forEach((el) => el.removeAttribute('data-i18n'));
    mTrack.appendChild(clone);
    document.addEventListener('ks:lang', () => { clone.innerHTML = list.innerHTML; clone.querySelectorAll('[data-i18n]').forEach((el) => el.removeAttribute('data-i18n')); });
    const loop = gsap.to(mTrack, { xPercent: -50, duration: 34, ease: 'none', repeat: -1 });
    ST.create({
      start: 0, end: 'max',
      onUpdate: (s) => {
        const boost = clamp(Math.abs(s.getVelocity()) / 250, 0, 6);
        gsap.to(loop, { timeScale: s.direction * (1 + boost), duration: 0.25, overwrite: true });
        gsap.to(loop, { timeScale: s.direction, duration: 1.2, delay: 0.25, ease: 'power2.out' });
      },
    });
    gsap.fromTo('.marquee__band', { rotate: -4, yPercent: 30 }, { rotate: 2, yPercent: -30, ease: 'none', scrollTrigger: { trigger: '.marquee', start: 'top bottom', end: 'bottom top', scrub: true } });
  }

  /* ------------------------------------------------------------------------
     Headings: char reveal on enter
     ------------------------------------------------------------------------ */
  $$('[data-split]').forEach((h) => {
    if (h.classList.contains('hero__title') || h.classList.contains('article__title')) return;
    ST.create({ trigger: h, start: 'top 86%', once: true, onEnter: () => revealChars(h) });
  });

  /* ------------------------------------------------------------------------
     About: word-by-word light-up, scrubbed
     ------------------------------------------------------------------------ */
  const statement = $('.about__statement');
  let wordsST = null;
  function paintWords() {
    if (!statement) return;
    const p = wordsST ? wordsST.progress : 0;
    const ws = $$('.wd', statement);
    ws.forEach((w, i) => {
      const v = clamp(p * (ws.length + 6) - i, 0, 1);
      w.style.opacity = (0.16 + 0.84 * v).toFixed(3);
    });
  }
  if (statement) {
    wordsST = ST.create({ trigger: statement, start: 'top 82%', end: 'bottom 45%', scrub: true, onUpdate: paintWords });
    paintWords();
  }

  /* Counters */
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const o = { v: 0 };
    el.textContent = '0';
    ST.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(o, { v: end, duration: 2, ease: 'expo.out', onUpdate: () => (el.textContent = Math.round(o.v)) }) });
  });

  /* Generic reveals */
  gsap.set('[data-reveal]', { y: 48, opacity: 0 });
  ST.batch('[data-reveal]', {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true }),
  });

  /* ------------------------------------------------------------------------
     Realizacje: pinned horizontal gallery on desktop
     ------------------------------------------------------------------------ */
  const work = $('.work');
  const track = $('.work__track');
  if (work && track) {
    const workBar = $('.work__progress span');
    const mm = gsap.matchMedia();
    mm.add('(min-width: 1024px) and (min-height: 640px)', () => {
      work.classList.add('is-horizontal');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: '.work__pin', start: 'top top', end: () => '+=' + dist(),
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: (s) => workBar && (workBar.style.transform = `scaleX(${s.progress})`),
        },
      });
      $$('.shot', track).forEach((card) => {
        gsap.fromTo(card, { rotateY: -10, scale: 0.92, transformPerspective: 1200 }, {
          rotateY: 0, scale: 1, ease: 'none',
          scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 100%', end: 'left 60%', scrub: true },
        });
      });
      return () => { work.classList.remove('is-horizontal'); gsap.set(track, { clearProps: 'transform' }); };
    });
    mm.add('(max-width: 1023px), (max-height: 639px)', () => {
      const cards = $$('.shot', track);
      gsap.set(cards, { y: 70, opacity: 0, scale: 0.96 });
      const b = ST.batch(cards, { start: 'top 92%', once: true, onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out', stagger: 0.1 }) });
      return () => { b.forEach((s) => s.kill()); gsap.set(cards, { clearProps: 'all' }); };
    });
  }

  /* Process: progress line + steps */
  const lineFill = $('.steps__line span');
  if (lineFill) ST.create({ trigger: '.steps', start: 'top 62%', end: 'bottom 62%', scrub: true, onUpdate: (s) => lineFill.style.setProperty('--lp', s.progress.toFixed(4)) });
  $$('.step').forEach((step) => ST.create({ trigger: step, start: 'top 66%', onEnter: () => step.classList.add('is-on'), onLeaveBack: () => step.classList.remove('is-on') }));

  /* Footer wordmark */
  if ($('.footer__word')) {
    gsap.fromTo('.footer__word > *', { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.4, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.footer', start: 'top 92%', once: true } });
  }

  /* ------------------------------------------------------------------------
     Desktop: ember cursor, magnetic buttons, 3D tilt
     ------------------------------------------------------------------------ */
  if (finePointer) {
    root.classList.add('has-cursor');
    const cursor = $('.cursor');
    const dot = $('.cursor__dot');
    const ring = $('.cursor__ring');
    if (cursor) {
      const dotX = gsap.quickSetter(dot, 'x', 'px');
      const dotY = gsap.quickSetter(dot, 'y', 'px');
      const ringX = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3.out' });
      const ringY = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3.out' });
      gsap.set([dot, ring], { x: -100, y: -100 });
      window.addEventListener('pointermove', (e) => {
        dotX(e.clientX); dotY(e.clientY); ringX(e.clientX); ringY(e.clientY);
        cursor.classList.remove('is-hidden');
      }, { passive: true });
      document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
      document.addEventListener('pointerover', (e) => {
        cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, input, textarea, [data-magnetic], [role="option"]'));
      });
      // A modal <dialog> sits in the browser's top layer, above everything in the page —
      // including this cursor. While one is open, the cursor moves inside it; on close it comes back.
      const home = cursor.parentNode;
      const follow = () => {
        const open = $$('dialog[open]').pop();
        const target = open || home;
        if (cursor.parentNode !== target) target.appendChild(cursor);
      };
      $$('dialog').forEach((d) => new MutationObserver(follow).observe(d, { attributes: true, attributeFilter: ['open'] }));
    }
    $$('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.26);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.34);
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' }));
    });
    $$('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 1000 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.8, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.8, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        rx(-((e.clientY - r.top) / r.height - 0.5) * 6);
        ry(((e.clientX - r.left) / r.width - 0.5) * 8);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ST.refresh());
  window.addEventListener('load', () => ST.refresh());
})();
