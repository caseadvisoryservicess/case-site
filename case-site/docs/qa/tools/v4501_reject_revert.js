/* v4.50.1: сервер отклонил правку помещения — значение возвращается на экране.

   Зачем. unit_patch.php жёстко закрывает LCR для ролей AGX, BSH и BRJ (строка 7),
   при этом в интерфейсе у них право «правка» есть, и поля редактируются. Раньше при
   отказе 403 введённое значение оставалось в памяти и на экране: сотрудник видел,
   что «сохранилось», обновлял страницу — и значение исчезало. Ровно так и выглядела
   жалоба «ввёл данные, обновил — пропали».

   Проверяем: при 403 поле возвращается к прежнему значению, на сервер ничего
   не записывается, и правка не переживает перезагрузку (потому что её и не было).

   Запуск: node v4501_reject_revert.js */
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
  const units = [{ id: 'L1_1', code: 'L1-1', obj: 'ca', floor: '1', area: 100, cat: 'Мода',
                   status: 'vac', rate: 0, budget: 7, vars: [], dates: [], hist: [], comments: [] }];
  const { srv, base, state } = await createMockServer(OS, {
    initialState: { OBJECTS: [{ id: 'ca', name: 'CASE Mall' }], U: units, CHANGES: [], TRASH: [] }
  });
  /* роль без права на LCR: сервер отвечает 403 на любой unit_patch */
  state.failMode = 'reject-units';

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage();
  const toasts = [];
  pg.on('pageerror', e => { console.log('!!  ошибка страницы: ' + e.message); failed++; });

  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => { if (typeof go === 'function') go('registry'); });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { if (typeof toggleRegEdit === 'function') toggleRegEdit(); });
  await pg.waitForTimeout(1500);

  const typed = await pg.evaluate(() => {
    const tr = document.querySelector('#main tr[data-uid="L1_1"]');
    if (!tr) return 'нет строки';
    const inp = [...tr.querySelectorAll('input')]
      .find(i => /budget/.test(i.getAttribute('onchange') || i.getAttribute('onblur') || ''));
    if (!inp) return 'нет поля бюджета';
    inp.value = '999';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.dispatchEvent(new Event('blur', { bubbles: true }));
    return 'ok';
  });
  check('поле бюджета заполнено значением 999', typed === 'ok', typed);
  await pg.waitForTimeout(3500);

  const mem = await pg.evaluate(() => { const u = U.find(x => x.id === 'L1_1'); return u ? u.budget : null; });
  check('значение на экране возвращено к прежнему (7)', Number(mem) === 7,
    'в памяти budget=' + mem + (Number(mem) === 999 ? ' — осталось несохранённое!' : ''));

  const srvVal = (state.appState.data.U.find(x => x.id === 'L1_1') || {}).budget;
  check('на сервере ничего не изменилось', Number(srvVal) === 7, 'budget=' + srvVal);

  const txt = await pg.evaluate(() => document.body.innerText);
  check('сотрудник предупреждён об отказе', /отклонил правку|НЕ сохранена|возвращено/i.test(txt),
    /отклонил/.test(txt) ? 'сообщение показано' : 'сообщения нет');

  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);
  const after = await pg.evaluate(() => { const u = U.find(x => x.id === 'L1_1'); return u ? u.budget : null; });
  check('после перезагрузки то же самое, без сюрпризов', Number(after) === 7, 'budget=' + after);

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
