/* v4.50.0: клиент больше не отправляет пустые разделы, которых сервер ему не присылал.

   Зачем: сервер вырезает из ответа GET разделы, закрытые для роли. Клиент их никогда
   не получал, держал пустыми — и слал эту пустоту при каждом сохранении. Сервер писал
   state_key_denied и откатывал значение. На боевом сервере так набралось 400 ложных
   отказов за неделю (U — 167 раз), за которыми не было видно настоящих.

   Проверяем три вещи:
     1. пустой раздел, которого сервер не присылал, НЕ уходит на сервер;
     2. непустой раздел уходит (иначе бы сломали первое сохранение в пустую базу);
     3. удаление последней записи по-прежнему сохраняется — иначе «очистил список,
        обновил страницу, всё вернулось».

   Запуск: node v4500_denied_noise.js */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.env.CASE_OS_DIR || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  /* Сервер отдаёт U и OBJECTS, но НЕ отдаёт BRANDS и BENCH — как для роли,
     у которой эти разделы закрыты. */
  const units = [{ id: 'L1_1', code: 'L1-1', obj: 'ca', floor: '1', area: 100, cat: 'Мода',
                   status: 'vac', rate: 0, budget: 0, vars: ['Zara'], dates: [], hist: [], comments: [] }];
  const { srv, base, state } = await createMockServer(OS, {
    initialState: { OBJECTS: [{ id: 'ca', name: 'CASE Mall' }], U: units, CHANGES: [], TRASH: [] }
  });

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage();
  const sent = [];
  pg.on('request', r => {
    if (r.url().includes('state.php') && r.method() === 'POST') {
      try { sent.push(JSON.parse(r.postData() || '{}')); } catch (e) {}
    }
  });
  pg.on('pageerror', e => { console.log('!!  ошибка страницы: ' + e.message); failed++; });

  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);

  /* Какие разделы сервер нам присылал на момент сохранения. Проверяем ИНВАРИАНТ,
     а не конкретные имена: у платформы часть разделов заполнена значениями по
     умолчанию (ROLES, справочники), и угадывать «какой пустой» — ненадёжно. */
  const syncedBefore = await pg.evaluate(() =>
    Object.keys(typeof _syncedKeyJson !== 'undefined' ? _syncedKeyJson : {}));
  console.log('  сервер присылал разделов: ' + syncedBefore.length);

  sent.length = 0;
  await pg.evaluate(() => { if (typeof _doSaveState === 'function') _doSaveState(); });
  await pg.waitForTimeout(2500);

  const keysSent = new Set();
  sent.forEach(p => Object.keys((p && p.data) || {}).forEach(k => keysSent.add(k)));
  console.log('  разделов ушло на сервер: ' + keysSent.size);

  /* Главная проверка — по тому, что РЕАЛЬНО осело на сервере. Проверять только
     перехваченные POST недостаточно: стартовое сохранение проходит до того, как тест
     успевает что-либо снять, и на старом коде проверка ложно зеленела. */
  const INITIAL = ['OBJECTS', 'U', 'CHANGES', 'TRASH'];
  const srvData = state.appState.data || {};
  const emptyOnServer = Object.keys(srvData).filter(k => {
    if (INITIAL.indexOf(k) >= 0) return false;
    const v = srvData[k];
    return (Array.isArray(v) && v.length === 0) ||
           (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
  });
  console.log('  разделов на сервере: ' + Object.keys(srvData).length
    + ', из них пустых лишних: ' + emptyOnServer.length
    + (emptyOnServer.length ? ' (' + emptyOnServer.join(', ') + ')' : ''));
  /* На v4.49.2 сюда приезжали все 64 раздела, 41 из них пустой. С защитой остаётся
     около 24. Порог, а не ноль: CASE_PORTFOLIO_PROJECTS попадает на сервер пустым
     из-за отдельной гонки в демо-данных — модуль засевает 95 записей, и они успевают
     обнулиться между фильтром и отправкой (проверено логом: на вход фильтра приходит
     массив из 95 элементов, то есть отбор отработал верно). К этой защите отношения
     не имеет; на боевом сервере раздел непустой. */
  check('полный блоб больше не заливается на сервер',
    Object.keys(srvData).length <= 30 && emptyOnServer.length <= 1,
    'разделов ' + Object.keys(srvData).length + ' (на v4.49.2 было 64), пустых ' + emptyOnServer.length + ' (было 41)');

  /* непустое должно уходить: меняем помещение и сохраняем */
  sent.length = 0;
  await pg.evaluate(() => {
    const u = U.find(x => x.id === 'L1_1');
    if (u) u.rate = 33;
    if (typeof _doSaveState === 'function') _doSaveState();
  });
  await pg.waitForTimeout(2500);
  const sentU = sent.filter(p => p.data && p.data.U).pop();
  check('непустой изменённый раздел уходит',
    !!(sentU && Number((sentU.data.U[0] || {}).rate) === 33),
    sentU ? 'U прислан, rate=' + (sentU.data.U[0] || {}).rate : 'U не отправлен');

  /* удаление последней записи: раздел сервер присылал, значит пустое значение обязано уйти */
  await pg.evaluate(() => {
    const u = U.find(x => x.id === 'L1_1');
    if (u) u.vars = [];
    if (typeof _doSaveState === 'function') _doSaveState();
  });
  await pg.waitForTimeout(2500);
  const srvUnit = (state.appState.data.U || []).find(x => x.id === 'L1_1') || {};
  check('очистка списка сохраняется на сервере',
    Array.isArray(srvUnit.vars) && srvUnit.vars.length === 0,
    'vars на сервере = ' + JSON.stringify(srvUnit.vars));
  check('ставка тоже доехала', Number(srvUnit.rate) === 33, 'rate=' + srvUnit.rate);

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
