/* v4.50.5: закрытые для роли разделы не должны уходить на сервер.

   Жалоба: при каждом сохранении всплывало «⚠ НЕ сохранено: USERS, Бенчмарки, ROLES,
   AUDIT, Геоаналитика, CASE_PARTNERS», и сотрудник решил, что не сохраняется ничего.

   Разбор: сервер при чтении вырезает разделы, недоступные роли, — клиент их не получает.
   Но у клиента для них есть ВСТРОЕННЫЕ значения по умолчанию, и они непустые, поэтому
   фильтр пустых разделов из v4.50.0 их не отсекал. Они уходили на сервер, тот их честно
   отклонял и перечислял в ответе. Своя правка при этом сохранялась: сервер пишет
   разрешённые разделы и лишь возвращает закрытые как были.

   Проверяем: закрытые разделы больше не отправляются, предупреждения нет, а правка
   в РАЗРЕШЁННОМ разделе доезжает до сервера и переживает перезагрузку.

   Запуск: node v4505_restricted_keys.js */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.env.CASE_OS_DIR || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const RESTRICTED = ['USERS', 'ROLES', 'AUDIT', 'BENCH', 'GEO_DATA', 'CASE_PARTNERS'];

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const { srv, base, state } = await createMockServer(OS, {
    initialState: { OBJECTS: [{ id: 'ca', name: 'CASE Mall' }], U: [], CHANGES: [], TRASH: [] }
  });
  state.restrictedKeys = RESTRICTED.slice();

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2600);

  check('вход прошёл без ошибок сценария', errs.length === 0, errs[0] || 'ошибок нет');

  /* Правка в РАЗРЕШЁННОМ разделе — она обязана сохраниться */
  await pg.evaluate(() => {
    if (typeof OBJECTS !== 'undefined' && OBJECTS[0]) OBJECTS[0].name = 'CASE Mall — проверка';
    if (typeof persist === 'function') persist();
  });
  await pg.waitForTimeout(3000);

  const posts = state.statePosts || [];
  const sentRestricted = [...new Set([].concat(...posts))].filter(k => RESTRICTED.includes(k));
  check('закрытые разделы вообще не отправлялись', sentRestricted.length === 0,
    sentRestricted.length ? 'ушли: ' + sentRestricted.join(', ') : 'ни одного из ' + RESTRICTED.length);
  check('сохранения при этом были', posts.length > 0, 'запросов: ' + posts.length);

  const saved = (state.appState.data.OBJECTS || [])[0];
  check('правка в разрешённом разделе доехала до сервера',
    saved && saved.name === 'CASE Mall — проверка', saved ? saved.name : 'нет данных');

  const txt = await pg.evaluate(() => document.body.innerText);
  check('предупреждения «НЕ сохранено» нет', !/НЕ сохранено/i.test(txt),
    /НЕ сохранено/i.test(txt) ? 'предупреждение показано' : 'чисто');

  /* Клиент должен был получить список закрытых разделов от сервера */
  const got = await pg.evaluate(() => {
    try { return typeof _restrictedKeys !== 'undefined' && _restrictedKeys ? _restrictedKeys.length : -1; }
    catch (e) { return -2; }
  });
  check('клиент принял список закрытых разделов', got === RESTRICTED.length,
    'получено ' + got + ' из ' + RESTRICTED.length);

  /* Старый сервер без restricted_keys — поведение не должно ломаться */
  state.restrictedKeys = undefined;
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2600);
  const after = await pg.evaluate(() => (typeof OBJECTS !== 'undefined' && OBJECTS[0]) ? OBJECTS[0].name : null);
  check('со старым сервером вход и данные в порядке', after === 'CASE Mall — проверка', String(after));
  check('ошибок сценария по-прежнему нет', errs.length === 0, errs[0] || 'ошибок нет');

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
