/* i18n.js
   Язык выбирается только явно, ссылками в шапке. Автоматических редиректов нет:
   они ломают индексацию и раздражают тех, кто пришёл по прямой ссылке.
   Здесь мы лишь запоминаем выбор и отдаём событие в аналитику. */

const KEY = 'case.lang';

export function currentLang() {
  return document.documentElement.getAttribute('lang') || 'uz';
}

export function rememberLang(lang) {
  try { localStorage.setItem(KEY, lang); } catch (e) { /* приватный режим */ }
}

export function preferredLang() {
  try { return localStorage.getItem(KEY); } catch (e) { return null; }
}

export function initLangSwitcher(track) {
  const nav = document.querySelector('[data-lang-switcher]');
  if (!nav) return;
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a[hreflang]');
    if (!a) return;
    const lang = a.getAttribute('hreflang');
    rememberLang(lang);
    track('language_switch', { from: currentLang(), to: lang });
  });
  // Первый визит: фиксируем язык страницы, чтобы переключение считалось осознанным.
  if (!preferredLang()) rememberLang(currentLang());
}
