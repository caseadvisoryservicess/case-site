/* CASE OS — проверка платформы со стороны браузера.

   ЗАЧЕМ: серверный скрипт server_check.php видит файлы и базу, но не видит,
   что реально загрузилось у сотрудника в браузере (старый кэш, недокачанный
   модуль, отсутствующее право). Этот скрипт проверяет именно это.

   КАК ЗАПУСТИТЬ:
   1. Откройте сайт и войдите под своей учётной записью.
   2. Нажмите F12 → вкладка Console (Консоль).
   3. Вставьте это содержимое целиком и нажмите Enter.
   4. Через пару секунд появится отчёт. Скопируйте его и пришлите.

   БЕЗОПАСНОСТЬ: скрипт только читает. Он ничего не сохраняет и не меняет.
   Пароли и токены не выводятся.                                              */

(async function () {
  var L = [];
  function say(s) { L.push(s); }
  function hr(t) { say(''); say('==================== ' + t + ' ===================='); }
  function ok(b) { return b ? 'OK  ' : '!!  '; }
  function n(v) { return (v && v.length !== undefined) ? v.length : 0; }

  say('CASE OS — ПРОВЕРКА ИЗ БРАУЗЕРА');
  say('дата: ' + new Date().toLocaleString());
  say('адрес: ' + location.href.split('?')[0]);
  say('браузер: ' + navigator.userAgent);
  say('экран: ' + innerWidth + '×' + innerHeight);

  /* ---- 1. версия и модули ---- */
  hr('1. ВЕРСИЯ И МОДУЛИ');
  var appv = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : '?';
  say('версия платформы: ' + appv);
  /* CASE_EXPECTED_MODULES объявлена как const в index.html: она видна по имени,
     но её НЕТ в window — обращение только через window вернуло бы пустую карту. */
  var exp = (typeof CASE_EXPECTED_MODULES !== 'undefined') ? CASE_EXPECTED_MODULES
          : (window.CASE_EXPECTED_MODULES || {});
  var got = window.CASE_MODULE_VERSIONS || {};
  var bad = 0, keys = Object.keys(exp);
  if (!keys.length) {
    say('!!  карта ожидаемых версий не найдена — версия платформы старше 4.46.4');
  } else {
    keys.forEach(function (k) {
      var want = exp[k], have = got[k] || 'НЕ ЗАГРУЖЕН';
      if (have !== want) bad++;
      say('  ' + ok(have === want) + k + ' — ждём ' + want + ', загружено ' + have);
    });
    say(bad ? '!!  Расхождений: ' + bad + '. У этого сотрудника старые файлы: нужен Ctrl+Shift+R, '
            + 'либо на сервер залита не вся папка os.'
            : 'Все модули загружены нужной версии.');
  }

  /* ---- 2. кэш и Service Worker ---- */
  hr('2. КЭШ И SERVICE WORKER');
  try {
    if (navigator.serviceWorker) {
      var regs = await navigator.serviceWorker.getRegistrations();
      say('регистраций SW: ' + regs.length);
      regs.forEach(function (r) {
        say('  область: ' + r.scope + ' | активен: ' + (r.active ? 'да' : 'нет')
          + ' | ожидает обновления: ' + (r.waiting ? 'ДА — нужен Ctrl+Shift+R' : 'нет'));
      });
    }
    if (window.caches) {
      var cn = await caches.keys();
      say('кэши: ' + (cn.join(', ') || '(пусто)'));
      var want = 'case-os-v' + String(appv).split('.').join('');
      var hit = cn.indexOf(want) >= 0;
      say(ok(hit || !cn.length) + 'ожидался кэш ' + want + (hit ? '' : ' — его нет, браузер держит старую версию'));
      var stale = cn.filter(function (x) { return /^case-os-v/.test(x) && x !== want; });
      if (stale.length) say('!!  старые кэши не удалены: ' + stale.join(', '));
    }
  } catch (e) { say('не удалось прочитать: ' + e.message); }

  /* ---- 3. пользователь и права ---- */
  hr('3. ПОЛЬЗОВАТЕЛЬ И ПРАВА');
  try {
    var u = (typeof S !== 'undefined' && S.user) ? S.user : null;
    /* S.role — это КЛЮЧ роли (строка), а сами права лежат в ROLES[ключ]. */
    var rk = (typeof S !== 'undefined') ? S.role : null;
    var r  = (rk && typeof ROLES !== 'undefined') ? ROLES[rk] : null;
    if (!u) say('!!  вход не выполнен — часть проверок пропущена');
    else {
      say('сотрудник: ' + (u.name || '?') + ' | почта: ' + (u.email || '—')
        + ' | роль: ' + (rk || u.role || '?') + (r && r.label ? ' (' + r.label + ')' : ''));
      if (!r) say('!!  описание прав роли не найдено');
      else {
        say('права роли:');
        ['edit', 'finance', 'admin', 'leasing', 'approve', 'plans', 'geoEdit', 'own_only']
          .forEach(function (k) { if (k in r) say('  ' + k + ': ' + (r[k] ? 'да' : 'НЕТ')); });
        if (!r.edit) say('!!  У этой роли НЕТ права на правку. Любое сохранение будет отклонено — '
                       + 'снаружи это выглядит как «данные пропали».');
        if (!r.geoEdit) say('!!  У этой роли НЕТ права на изменение геоданных.');
      }
    }
  } catch (e) { say('ошибка: ' + e.message); }

  /* ---- 4. данные в памяти ---- */
  hr('4. ДАННЫЕ, ЗАГРУЖЕННЫЕ В БРАУЗЕР');
  try {
    var U0 = (typeof U !== 'undefined') ? U : [];
    var O0 = (typeof OBJECTS !== 'undefined') ? OBJECTS : [];
    var B0 = (typeof BRANDS !== 'undefined') ? BRANDS : [];
    say('объекты: ' + n(O0) + ' | помещения: ' + n(U0) + ' | бренды: ' + n(B0));
    var wr = 0, wv = 0, vt = 0;
    (U0 || []).forEach(function (x) {
      if (x && x.rate) wr++;
      if (x && x.vars && x.vars.length) { wv++; vt += x.vars.length; }
    });
    say('помещений со ставкой: ' + wr + ' | с вариантами подбора: ' + wv + ' (всего вариантов ' + vt + ')');
    if (n(U0) && !wv) say('!!  Ни у одного помещения нет вариантов подбора.');
    var g = (typeof GEO_DATA !== 'undefined') ? GEO_DATA : (window.GEO_DATA || null);
    if (g && g.datasets) {
      var gn = 0, ps = [];
      Object.keys(g.datasets).forEach(function (k) {
        var c = (g.datasets[k] || []).length; gn += c; ps.push(k + '=' + c);
      });
      say('геоданные: ' + gn + ' записей (' + ps.join(', ') + ')');
      if (!gn) say('!!  Геоданные пустые.');
    } else if (g) say('!!  геоданные загружены, но набор datasets пуст');
    else say('геоданные: раздел не открывался в этой вкладке (откройте Геоаналитику и повторите)');
  } catch (e) { say('ошибка: ' + e.message); }

  /* ---- 5. связь с сервером ---- */
  hr('5. СВЯЗЬ С СЕРВЕРОМ');
  async function probe(url) {
    var t0 = performance.now();
    try {
      var res = await fetch(url, { credentials: 'same-origin' });
      var txt = await res.text();
      var ms = Math.round(performance.now() - t0);
      return { status: res.status, ms: ms, len: txt.length, body: txt };
    } catch (e) { return { status: 0, err: e.message }; }
  }
  var h = await probe('api/health.php');
  say(ok(h.status === 200) + 'api/health.php → ' + (h.status || h.err) + (h.ms ? ' (' + h.ms + ' мс)' : ''));
  var st = await probe('api/state.php');
  say(ok(st.status === 200) + 'api/state.php → ' + (st.status || st.err)
    + (st.ms ? ' (' + st.ms + ' мс, ' + Math.round(st.len / 1024) + ' КБ)' : ''));
  if (st.status === 401 || st.status === 403) say('!!  Сервер не признаёт сессию — сохранение работать не будет. Войдите заново.');
  if (st.status === 200) {
    try {
      var j = JSON.parse(st.body), dd = j.data || {};
      say('  ревизия на сервере: ' + (j.revision != null ? j.revision : '?')
        + ' | обновлено: ' + (j.updated_at || '?') + ' | кем: ' + (j.updated_by || '?'));
      say('  на сервере: помещений ' + n(dd.U) + ', объектов ' + n(dd.OBJECTS) + ', брендов ' + n(dd.BRANDS));
      var srvU = n(dd.U), memU = (typeof U !== 'undefined') ? n(U) : 0;
      if (srvU !== memU)
        say('!!  РАСХОЖДЕНИЕ: на сервере ' + srvU + ' помещений, в браузере ' + memU
          + '. Часть данных не долетела — обновите страницу и повторите проверку.');
      else say('  Данные в браузере совпадают с сервером.');
      var sg = dd.GEO_DATA && dd.GEO_DATA.datasets, sgn = 0;
      if (sg) Object.keys(sg).forEach(function (k) { sgn += (sg[k] || []).length; });
      say('  геоданных на сервере: ' + sgn);
    } catch (e) { say('  ответ сервера не разобрать: ' + e.message); }
  }

  /* ---- 6. таблицы: шапка и закреплённые столбцы ---- */
  hr('6. ТАБЛИЦЫ НА ЭКРАНЕ');
  try {
    var tabs = document.querySelectorAll('table.case-grid, table.reg-grp, .ux-table-viewport table');
    say('таблиц на странице: ' + tabs.length);
    var checked = 0, offscreen = 0;
    tabs.forEach(function (tb) {
      if (checked >= 3) return;
      var th = tb.querySelector('thead th');
      if (!th || !th.offsetParent) return;
      var cs = getComputedStyle(th);
      var rect = th.getBoundingClientRect();
      /* elementFromPoint работает ТОЛЬКО по видимой области окна: для таблицы,
         прокрученной за пределы экрана, он всегда вернёт null. Это не поломка
         шапки, поэтому такие таблицы просто пропускаем. */
      var inView = rect.top >= 0 && rect.top < innerHeight && rect.left >= 0 && rect.left < innerWidth;
      if (!inView) { offscreen++; return; }
      checked++;
      /* Chromium умеет отдавать корректный прямоугольник у ячейки, которая на самом
         деле не отрисована. Поэтому проверяем ещё и попадание точки — это
         единственный надёжный признак того, что шапку реально видно. */
      var hitEl = document.elementFromPoint(rect.left + Math.min(20, rect.width / 2), rect.top + rect.height / 2);
      var painted = !!(hitEl && (hitEl === th || th.contains(hitEl) || hitEl.contains(th)));
      say('  таблица ' + checked + ' («' + (th.textContent || '').trim().slice(0, 16) + '»): position='
        + cs.position + ', top=' + cs.top + ', шапка видна: ' + (painted ? 'да' : 'НЕТ'));
      if (!painted) say('  !!  Шапка не отрисована — её перекрывает <'
        + (hitEl ? hitEl.tagName.toLowerCase() + ' class="' + String(hitEl.className).slice(0, 40) + '"' : 'ничего')
        + '>. Пришлите скриншот этой таблицы.');
    });
    if (offscreen) say('  пропущено таблиц вне видимой области: ' + offscreen
      + ' (прокрутите к таблице и запустите проверку ещё раз)');
    if (!checked) say('  на видимой части экрана таблиц нет — откройте Реестр, прокрутите к таблице и повторите');
  } catch (e) { say('ошибка: ' + e.message); }

  /* ---- 7. ошибки ---- */
  hr('7. ОШИБКИ');
  var errs = window.__CASE_ERRS || [];
  if (!errs.length) say('перехваченных ошибок нет (счётчик включается этим скриптом на будущее)');
  else errs.slice(-10).forEach(function (e) { say('  ' + e); });
  if (!window.__CASE_ERR_HOOK) {
    window.__CASE_ERRS = errs;
    window.__CASE_ERR_HOOK = true;
    window.addEventListener('error', function (ev) {
      errs.push((ev.message || '?') + ' @ ' + (ev.filename || '') + ':' + (ev.lineno || ''));
    });
    window.addEventListener('unhandledrejection', function (ev) {
      errs.push('promise: ' + ((ev.reason && ev.reason.message) || ev.reason));
    });
    say('Счётчик ошибок включён. Поработайте 2–3 минуты и запустите скрипт ещё раз — '
      + 'здесь появятся ошибки, если они возникнут.');
  }

  hr('ГОТОВО');
  var out = L.join('\n');
  console.log(out);
  try { if (typeof copy === 'function') { copy(out); console.log('%cОтчёт скопирован в буфер обмена — вставьте его в ответ.', 'color:#0a0;font-weight:bold'); } }
  catch (e) {}
  return out;
})();
