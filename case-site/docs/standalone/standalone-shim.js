/* CASE Geo Analytics, автономная версия: сервер CASE OS заменён браузером.
 *
 * Студия геоаналитики написана как экран CASE OS: она ходит за данными и правами в PHP-API
 * (api/*.php) и берёт границы районов из папки data/. В одном файле, который открывают с
 * диска или кладут на любой статический хостинг, ничего этого нет. Этот сценарий загружается
 * первым и перехватывает fetch: всё, что раньше делал сервер, делает браузер.
 *
 *   api/auth.php, api/workspace_access.php  -> вход не нужен, правка разрешена (данные живут
 *                                              в localStorage этого браузера)
 *   api/geo_master.php?file=runtime.json    -> мастер-геобаза, встроенная в файл при сборке
 *   data/tashkent_districts.geojson         -> границы районов, встроенные при сборке
 *   api/gis_proxy.php (poi, buildings, roads, geocode, ping)
 *                                           -> os/geo-direct.js: Overpass API и Nominatim
 *                                              напрямую из браузера, тот же разбор, что на
 *                                              сервере (с v4.74.0 библиотека общая с платформой)
 *   api/llm.php                             -> своей модели нет, агент честно говорит об этом
 *   остальное api/*                         -> «сервера нет», без падений
 *
 * Условия использования: OpenStreetMap по ODbL, атрибуция сохранена во всех ответах;
 * Overpass и Nominatim - общедоступные серверы с ограничением частоты, файл не спамит:
 * здания и дороги кэшируются в памяти на полчаса, адреса - на время сеанса.
 * Никаких ключей и платных сервисов внутри нет. Длинных тире в тексте нет намеренно.
 */
(function () {
  'use strict';
  if (window.CASE_STANDALONE) return;
  var DATA = window.CASE_STANDALONE_DATA || {};
  var S = window.CASE_STANDALONE = { version: '%VERSION%', built: '%BUILT%', log: [] };
  var realFetch = window.fetch.bind(window);

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  function fail(message, status) { return jsonResponse({ ok: false, error: message, message: message }, status || 400); }

  /* Маршрутизация запросов */
  function handle(path, qs) {
    if (path === 'api/auth.php') return jsonResponse({ auth: true, mode: 'geo', user: { id: 'standalone', name: 'Пользователь', role: 'GEO', role_label: 'Автономная версия', edit: true }, rights: { edit: 1 }, csrf: '', pass_login: false, code_login: false });
    if (path === 'api/workspace_access.php') return jsonResponse({ allowed: true, can_edit: true, mode: 'geo' });
    if (path === 'api/geo_master.php') { if (qs.get('file') === 'runtime.json' && DATA.master) return jsonResponse(DATA.master); return fail('В автономной версии есть только встроенная мастер-база', 404); }
    if (path === 'data/tashkent_districts.geojson') return DATA.districts ? jsonResponse(DATA.districts) : fail('нет границ районов', 404);
    if (path === 'data/tashkent_region_districts.geojson') return fail('границы области в файл не встроены', 404);
    if (path === 'api/llm.php') return jsonResponse({ ok: false, needs_llm: true, message: 'В автономной версии своей модели нет: команды работают без неё.' });
    if (path === 'api/gis_proxy.php') {
      var D = window.CASE_GEO_DIRECT;
      if (!D) return fail('В файл не встроена библиотека geo-direct.js: пересоберите автономную версию', 500);
      var mode = qs.get('mode') || '';
      return D.handle(mode, qs).then(function (o) { o = o || { ok: false, message: 'пустой ответ' }; o._via = 'browser'; return jsonResponse(o, o.ok === false && o.status ? o.status : 200); });
    }
    return fail('Сервера CASE OS в автономной версии нет', 404);
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var clean = url.split('#')[0];
    var m = /(^|\/)(api\/[a-z_]+\.php|data\/[a-z_]+\.geojson)(\?[^]*)?$/.exec(clean);
    var foreign = /^https?:\/\//i.test(clean) && (function () { try { return new URL(clean).origin !== location.origin; } catch (e) { return true; } })();
    if (!m || foreign) return realFetch(input, init);
    var path = m[2], qs = new URLSearchParams((m[3] || '').slice(1));
    S.log.push(path + (m[3] || ''));
    try { return Promise.resolve(handle(path, qs)); } catch (e) { return Promise.resolve(fail(String(e && e.message || e), 500)); }
  };

  /* Ссылки на файлы мастер-базы (master.csv и т. п.) ведут на сервер, которого нет */
  try {
    document.documentElement.classList.add('geo-standalone');
    var st = document.createElement('style'); st.textContent = '.geo-standalone a[href*="geo_master.php"]{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
})();
