/* Регрессия: правка коммерческого поля в ЛСР доезжает до сервера и переживает перезагрузку.

   Появился после боевой диагностики 27.07.2026: на сервере обнаружились 62 помещения,
   у которых ни у одного не заполнены ставка, бюджет и CAPEX. Тест отвечает на вопрос,
   ломается ли сам путь сохранения ЛСР, или данные просто не вводили.

   ВАЖНО про мок: unit_patch.php на сервере делает UPDATE app_state. Мок обязан делать
   то же самое — иначе тест показывает «до сервера не доехало» на ровном месте.

   Запуск: node lcr_persist.js   (из папки с node_modules, где стоит playwright-core) */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.env.CASE_OS_DIR || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const units = [];
for (let i = 1; i <= 6; i++) units.push({
  id: 'L1_' + i, code: 'L1-' + i, obj: 'ca', floor: '1', area: 100 + i, cat: 'Мода',
  status: 'vac', rate: 0, budget: 0, vars: [], dates: [], hist: [], comments: []
});

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const { srv, base, state } = await createMockServer(OS, {
    initialState: { OBJECTS: [{ id: 'ca', name: 'CASE Mall' }], U: units, BRANDS: [], CHANGES: [], TRASH: [] }
  });
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage();
  pg.on('pageerror', e => { console.log('!!  ошибка страницы: ' + e.message); failed++; });

  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);

  /* Таблица ЛСР — это отдельный вид registry, а не reg: go('reg') рисует «План/бюджет»
     с планировками, и строк с data-uid там нет вовсе. */
  await pg.evaluate(() => { if (typeof go === 'function') go('registry'); });
  await pg.waitForTimeout(1500);
  /* Поля ввода появляются только в режиме «Правка в таблице». */
  await pg.evaluate(() => { if (typeof toggleRegEdit === 'function') toggleRegEdit(); });
  await pg.waitForTimeout(1800);

  const rows = await pg.evaluate(() => document.querySelectorAll('#main tr[data-uid]').length);
  check('строки реестра отрисованы', rows === 6, rows + ' из 6');

  const typed = await pg.evaluate(() => {
    const tr = document.querySelector('#main tr[data-uid="L1_1"]');
    if (!tr) return 'нет строки';
    const inp = [...tr.querySelectorAll('input')]
      .find(i => /budget/.test(i.getAttribute('onchange') || i.getAttribute('onblur') || ''));
    if (!inp) return 'нет поля бюджета';
    inp.value = '45';
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.dispatchEvent(new Event('blur', { bubbles: true }));
    return 'ok';
  });
  check('поле бюджета найдено и заполнено', typed === 'ok', typed);
  await pg.waitForTimeout(3000);

  const mem = await pg.evaluate(() => { const u = U.find(x => x.id === 'L1_1'); return u ? u.budget : null; });
  check('значение попало в память браузера', mem === 45, 'budget=' + mem);

  check('ушёл запрос unit_patch', state.unitPatches.length === 1, state.unitPatches.length + ' шт.');
  const patch = state.unitPatches[0];
  check('в запросе именно правка бюджета',
    !!(patch && patch.changes && Number(patch.changes.budget) === 45),
    patch ? JSON.stringify(patch.changes) : '—');

  const onSrv = (state.appState.data.U.find(x => x.id === 'L1_1') || {}).budget;
  check('сервер записал значение', Number(onSrv) === 45, 'budget=' + onSrv);

  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);
  const after = await pg.evaluate(() => { const u = U.find(x => x.id === 'L1_1'); return u ? u.budget : null; });
  check('значение пережило перезагрузку', Number(after) === 45, 'budget=' + after);

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены: путь ЛСР → сервер работает');
  process.exit(failed ? 1 : 0);
})();
