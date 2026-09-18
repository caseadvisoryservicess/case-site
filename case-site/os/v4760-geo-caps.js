/* CASE OS v4.76.0: права пользователя внутри студии геоаналитики.
 *
 * Платформа (v4760-access.js) кладёт в window.CASE_USER_CAPS права вошедшего: тип доступа
 * (администратор, сотрудник, клиент, демо), можно ли выгружать и править. Студия в iframe
 * читает их у родителя и подстраивается:
 *   - без права выгрузки: кнопки PDF, Excel, PPTX, CSV скрыты, функции выгрузки отвечают отказом;
 *   - без права правок: карточка БЦ только для чтения;
 *   - демо: показаны 40 бизнес-центров из базы (ближайшие к центру города), вкладка «Управление
 *     данными» скрыта, выгрузка и правки отключены, вверху пояснение.
 * Автономный файл и прямое открытие студии без платформы работают как раньше (полные права).
 * Права здесь только для удобства: сервер проверяет их сам (роль без edit не пишет геоданные,
 * демо-пользователь не сохраняет ничего).
 */
(function () {
  'use strict';
  if (window.CASE_GEO_CAPS) return;
  var VERSION = '4.78.0', DEMO_N = 40, CENTER = [41.3111, 69.2797];
  var C = window.CASE_GEO_CAPS = { version: VERSION, caps: null, demoTotal: null };
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function readCaps() {
    var c = null;
    try { if (window.parent && window.parent !== window && window.parent.CASE_USER_CAPS) c = Object.assign({}, window.parent.CASE_USER_CAPS); } catch (e) {}
    var q = null; try { q = new URLSearchParams(location.search); } catch (e) {}
    if (q && q.get('demo') === '1') c = Object.assign({ type: 'demo' }, c || {}, { demo: true, export: false, edit: false });
    /* v4.78.0: бесплатный ограниченный доступ «Ищу офис»: как демо по данным, но своя учётная запись и кабинет */
    if (q && q.get('limited') === '1') c = Object.assign({ type: 'client', profile: 'office' }, c || {}, { limited: true, tier: 'free', export: false, edit: false });
    if (!c) c = { type: 'full', demo: false, export: true, edit: true };
    if (c.export == null) c.export = true; if (c.edit == null) c.edit = true; c.demo = !!c.demo; c.limited = !!c.limited && !c.demo;
    return c;
  }
  function css() {
    if ($('geoCapsCss')) return;
    var s = document.createElement('style'); s.id = 'geoCapsCss'; s.textContent =
      '.geo-caps-banner{display:flex;align-items:center;gap:10px;padding:7px 12px;background:#fff7e6;border-bottom:1px solid #f0d9a0;color:#7a5a00;font-size:12px}.geo-caps-banner b{color:#1b1b1b}.geo-caps-banner .sp{flex:1}'
      + '.geo-no-export #btnProjExport,.geo-no-export #btnExpCfg,.geo-no-export button[onclick^="exportProbe"],.geo-no-export button[onclick^="exportDB"],.geo-no-export button[onclick^="caseGeoExport"],.geo-no-export button[onclick^="geoExport"],.geo-no-export button[onclick^="geoPrintDataset"],.geo-no-export #bcCmpCsv{display:none!important}'
      + '.geo-no-edit .cbtns .btn.pri,.geo-no-edit button[onclick^="resetCard"],.geo-no-edit button[onclick^="geoAddRecord"],.geo-no-edit button[onclick^="geoDeleteSelected"]{display:none!important}'
      + '.geo-demo .tabs button[data-t="dataT"],.geo-limited .tabs button[data-t="dataT"]{display:none!important}';
    document.head.appendChild(s);
  }
  var toastT = null;
  function toast(msg) { var t = $('geoToast'); if (!t) { alert(msg); return; } t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3000); }
  function deny(msg) { return function () { toast(msg); return false; }; }
  function hav(a, b, c, d) { var R = 6371, r = function (x) { return x * Math.PI / 180; }; var s = Math.pow(Math.sin(r(c - a) / 2), 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.pow(Math.sin(r(d - b) / 2), 2); return R * 2 * Math.asin(Math.sqrt(s)); }
  function trimDemo() {
    var list = null; try { list = (typeof BC !== 'undefined' && Array.isArray(BC)) ? BC : null; } catch (e) {}
    if (!list) return;
    C.demoTotal = list.length;
    if (list.length > DEMO_N) {
      var keep = list.slice().filter(function (b) { return b.lat != null && b.lng != null; }).sort(function (a, b) { return hav(CENTER[0], CENTER[1], +a.lat, +a.lng) - hav(CENTER[0], CENTER[1], +b.lat, +b.lng); }).slice(0, DEMO_N);
      var ids = {}; keep.forEach(function (b) { ids[b.id] = 1; });
      for (var i = list.length - 1; i >= 0; i--) if (!ids[list[i].id]) list.splice(i, 1);
      list.forEach(function (b, i) { b.id = i; });
    }
    /* правки прошлых сеансов этого браузера привязаны к номерам записей полной базы: в демо они не применяются */
    try { if (typeof EDITS !== 'undefined' && EDITS) Object.keys(EDITS).forEach(function (k) { delete EDITS[k]; }); } catch (e) {}
    ['renderBC', 'catchSummary', 'analytics', 'dataTab'].forEach(function (n) { try { if (typeof window[n] === 'function') window[n](); } catch (e) {} });
    try { var hc = $('hdrCount'); if (hc) hc.textContent = list.length + ' БЦ · ' + (C.caps && C.caps.limited ? 'бесплатный доступ' : 'демо'); } catch (e) {}
    try { if (window.CASE_GEO_BC && window.CASE_GEO_BC.refresh) window.CASE_GEO_BC.refresh(); } catch (e) {}
  }
  function banner(caps) {
    if ($('geoCapsBanner')) return;
    var app = document.querySelector('.app') || document.body, tabs = document.querySelector('.tabs');
    var d = document.createElement('div'); d.id = 'geoCapsBanner'; d.className = 'geo-caps-banner';
    var txt = caps.limited
      ? '<b>Бесплатный доступ «Ищу офис».</b> Показаны ' + Math.min(DEMO_N, C.demoTotal || DEMO_N) + ' бизнес-центров из ' + (C.demoTotal || '') + ' ближе к центру, выгрузка и правки отключены. Полный доступ открывает CASE по запросу: меню профиля → «Обратная связь».'
      : caps.demo
      ? '<b>Демо-версия.</b> Показаны ' + Math.min(DEMO_N, C.demoTotal || DEMO_N) + ' бизнес-центров из ' + (C.demoTotal || '') + ', выгрузка и правки отключены. Полный доступ открывает CASE после заявки на регистрацию.'
      : (!caps.export && !caps.edit ? '<b>Просмотр.</b> Выгрузка и правки в вашем доступе отключены.' : !caps.export ? '<b>Выгрузка отключена</b> для вашего доступа.' : '<b>Только чтение:</b> правки записей отключены для вашего доступа.');
    d.innerHTML = '<span>' + txt + '</span><span class="sp"></span>' + (caps.days_left != null && caps.days_left <= 5 ? '<span>Доступ истекает ' + (caps.days_left <= 0 ? 'сегодня' : 'через ' + caps.days_left + ' дн.') + (caps.expires_at ? ' (' + esc(String(caps.expires_at).slice(0, 10)) + ')' : '') + '</span>' : '');
    if (tabs && tabs.parentNode) tabs.parentNode.insertBefore(d, tabs); else app.insertBefore(d, app.firstChild);
  }
  function apply(caps) {
    var body = document.body;
    if (!caps.export) {
      body.classList.add('geo-no-export');
      ['exportProbe', 'exportProbePdf', 'exportDB', 'caseGeoExportAll', 'caseGeoExportXlsx', 'geoExportProject', 'geoExportDataset', 'geoExportTableCSV', 'geoPrintDataset'].forEach(function (n) { window[n] = deny('Выгрузка недоступна для вашего доступа'); });
      var orig = window.caseGeoProjectReport; if (typeof orig === 'function') window.caseGeoProjectReport = function (exp) { if (exp) { toast('Выгрузка недоступна для вашего доступа'); return; } return orig.apply(this, arguments); };
    }
    if (!caps.edit) {
      body.classList.add('geo-no-edit');
      window.saveCard = deny('Правки недоступны для вашего доступа'); window.resetCard = deny('Правки недоступны для вашего доступа');
      ['geoAddRecord', 'geoDeleteSelected', 'geoDeleteMapRecord'].forEach(function (n) { window[n] = deny('Правки недоступны для вашего доступа'); });
    }
    if (caps.demo) { body.classList.add('geo-demo'); trimDemo(); }
    else if (caps.limited) { body.classList.add('geo-limited'); trimDemo(); }
    if (caps.demo || caps.limited || !caps.export || !caps.edit) banner(caps);
  }
  function embedded() { try { return !!(window.parent && window.parent !== window); } catch (e) { return false; } }
  function parentCapsReady() { try { return !embedded() || !!window.parent.CASE_USER_CAPS; } catch (e) { return true; } }
  function install() {
    css();
    /* внутри платформы права могут появиться на долю секунды позже загрузки студии: ждём до 8 с */
    var tries = 0;
    (function tick() {
      if (!parentCapsReady() && ++tries < 32) { setTimeout(tick, 250); return; }
      var caps = readCaps(); C.caps = caps;
      if (caps.type === 'full' && caps.export && caps.edit && !caps.demo && !caps.limited) return;
      /* модули студии, чьи функции здесь подменяются, уже загружены: этот файл подключён последним */
      apply(caps);
    })();
  }
  C.readCaps = readCaps; C.apply = apply;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4760-geo-caps'] = '4.78.0';
