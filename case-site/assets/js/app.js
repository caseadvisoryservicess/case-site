/* app.js
   Поведение интерфейса. Всё здесь необязательно: без JavaScript страница
   остаётся полностью читаемой, формы отправляются обычным POST,
   ответы FAQ раскрыты, строки портфеля видны все.
   Задача скрипта: свернуть, отфильтровать, ускорить. */

import { initLangSwitcher } from './i18n.js';

/* --- Аналитика: тонкая обёртка, чтобы вызовы не падали без счётчика --- */
function track(name, props) {
  try {
    if (typeof window.plausible === 'function') window.plausible(name, { props });
    else if (typeof window.umami === 'object' && window.umami.track) window.umami.track(name, props);
    else if (typeof window.ym === 'function' && window.CASE_YM_ID) window.ym(window.CASE_YM_ID, 'reachGoal', name);
  } catch (e) { /* аналитика никогда не ломает страницу */ }
}
window.CASEtrack = track;

/* --- Шапка на узких экранах --- */
function initNav() {
  const nav = document.querySelector('[data-nav]');
  const btn = nav && nav.querySelector('[data-nav-toggle]');
  if (!nav || !btn) return;
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      nav.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
}

/* --- FAQ: в разметке ответы открыты, сворачиваем их только здесь --- */
function initFaq() {
  document.querySelectorAll('[data-faq] .faq__item').forEach((item, i) => {
    const q = item.querySelector('.faq__q');
    const a = item.querySelector('.faq__a');
    if (!q || !a) return;
    const open = i === 0;
    a.hidden = !open;
    q.setAttribute('aria-expanded', String(open));
    q.addEventListener('click', () => {
      const next = q.getAttribute('aria-expanded') !== 'true';
      q.setAttribute('aria-expanded', String(next));
      a.hidden = !next;
      if (next) track('faq_open', { q: q.textContent.trim().slice(0, 80) });
    });
  });
}

/* --- Фильтр списка проектов --- */
function initFilters() {
  const root = document.querySelector('[data-filters]');
  if (!root) return;
  const rows = Array.from(document.querySelectorAll('[data-project]'));
  const counter = document.querySelector('[data-project-count]');
  const buttons = Array.from(root.querySelectorAll('button[data-filter]'));

  function apply(value) {
    let shown = 0;
    rows.forEach((row) => {
      const hit = value === 'all' || (row.getAttribute('data-project') || '').split(' ').includes(value);
      row.hidden = !hit;
      if (hit) shown++;
    });
    if (counter) counter.textContent = String(shown);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === value)));
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-filter]');
    if (!b) return;
    apply(b.dataset.filter);
    track('projects_filter', { value: b.dataset.filter });
  });
  apply('all');
}

/* --- Формы: honeypot плюс проверка времени вместо капчи --- */
function initForms() {
  document.querySelectorAll('form[data-form]').forEach((form) => {
    const started = Date.now();
    const status = form.querySelector('[data-form-status]');
    const started_at = form.querySelector('input[name="started_at"]');
    if (started_at) started_at.value = String(started);

    form.addEventListener('submit', (e) => {
      const trap = form.querySelector('input[name="company_url"]');
      const tooFast = Date.now() - started < 3000;
      if ((trap && trap.value) || tooFast) {
        e.preventDefault();
        if (status) {
          status.dataset.state = 'err';
          status.textContent = form.dataset.msgSlow || '';
        }
        return;
      }
      const action = form.getAttribute('action') || '';
      // Пока endpoint не задан, отправка остаётся обычной: пользователь
      // увидит честную ошибку, а не молчаливую потерю заявки.
      if (!action || action.indexOf('{{') === 0) return;

      e.preventDefault();
      if (status) { status.dataset.state = ''; status.textContent = form.dataset.msgSending || ''; }
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;

      fetch(action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form)
      })
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          form.reset();
          if (status) { status.dataset.state = 'ok'; status.textContent = form.dataset.msgOk || ''; }
          track('consultation_request', { form: form.dataset.form });
        })
        .catch(() => {
          if (status) { status.dataset.state = 'err'; status.textContent = form.dataset.msgErr || ''; }
        })
        .finally(() => { if (btn) btn.disabled = false; });
    });
  });
}

/* --- Единственная курсорная деталь: магнитные кнопки и подсветка карточек --- */
function initPointer() {
  if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  let frame = 0;
  const magnets = document.querySelectorAll('.magnetic');
  magnets.forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        el.style.setProperty('--dx', dx.toFixed(1) + 'px');
        el.style.setProperty('--dy', dy.toFixed(1) + 'px');
      });
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--dx', '0px');
      el.style.setProperty('--dy', '0px');
    });
  });

  document.querySelectorAll('.card--lit').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  });
}

/* --- Отслеживаемые цели --- */
function initGoals() {
  document.querySelectorAll('[data-goal]').forEach((el) => {
    el.addEventListener('click', () => track(el.dataset.goal, { href: el.getAttribute('href') || '' }));
  });
  const deep = document.querySelector('[data-depth-goal]');
  if (deep && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { track(deep.dataset.depthGoal); io.disconnect(); }
      });
    }, { threshold: 0.4 });
    io.observe(deep);
  }
}

function boot() {
  initNav();
  initFaq();
  initFilters();
  initForms();
  initPointer();
  initGoals();
  initLangSwitcher(track);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
