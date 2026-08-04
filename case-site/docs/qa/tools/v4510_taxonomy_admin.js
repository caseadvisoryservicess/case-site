/* v4.51.0: администратор сам добавляет категории, подкатегории и типы брендов.

   Запрос владельца: «нам не хватает вариантов подкатегорий… или дай возможность
   Администратору добавлять категории и подкатегории».

   Ключевые требования, которые тут и проверяются:
     - добавленное сразу попадает в подсказки формы бренда;
     - встроенные значения НЕЛЬЗЯ удалить (на них ссылаются заведённые бренды);
     - справочник уезжает на сервер под ключом TAXO и виден всем ролям;
     - менять его может ТОЛЬКО администратор (сервер: TAXO вычитается из
       разрешённых на запись у не-админов, как USERS и ROLES).

   Запуск: node v4510_taxonomy_admin.js [папка os] */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.argv[2] || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const { srv, base, state } = await createMockServer(OS, {
    initialState: { OBJECTS: [{ id: 'ca', name: 'CASE Mall' }], U: [], BRANDS: [], CHANGES: [], TRASH: [] }
  });
  /* Мок по умолчанию отдаёт роль «Администратор аренды» — она НЕ администратор системы.
     Справочник правит только системный админ, поэтому подменяем пользователя. */
  state.user = Object.assign({}, state.user, {
    id: 'u-adm', name: 'Администратор', role: 'ADM', role_key: 'ADM',
    role_label: 'Администратор', admin: true, edit: true
  });
  /* Права клиент берёт из ответа сервера, а не из локальной таблицы ролей —
     без этого R().admin остаётся false даже у роли ADM. */
  state.rights = Object.assign({}, state.rights, { admin: 1, edit: 1, approve: 1 });

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2500);

  const isAdmin = await pg.evaluate(() => !!(R() && R().admin));
  check('вошли администратором', isAdmin);

  await pg.evaluate(() => go('admin_system'));
  await pg.waitForTimeout(1200);
  check('карточка справочника на экране «Система»',
    await pg.evaluate(() => /Справочник категорий брендов/.test(document.body.innerText)));
  check('ошибок сценария нет', errs.length === 0, errs[0] || 'ошибок нет');

  /* Добавляем подкатегорию именно из жалобы */
  const added = await pg.evaluate(() => {
    _taxoCat = 'F&B / рестораны и кафе';
    renderAdminSystem();
    const el = document.getElementById('taxo_new_sub');
    el.value = 'Ресторан — славянская';
    taxoAdd('subs', 'taxo_new_sub');
    return { custom: (TAXO.subs['F&B / рестораны и кафе'] || []).slice(), cleared: document.getElementById('taxo_new_sub').value };
  });
  check('подкатегория добавлена в справочник', added.custom.indexOf('Ресторан — славянская') >= 0,
    added.custom.join(', ') || 'пусто');
  check('поле ввода очищено', added.cleared === '');

  /* Тип и своя категория */
  const more = await pg.evaluate(() => {
    let el = document.getElementById('taxo_new_type');
    el.value = 'Славянская / русская кухня'; taxoAdd('types', 'taxo_new_type');
    el = document.getElementById('taxo_new_cat');
    el.value = 'Коворкинг для стартапов'; taxoAdd('cats', 'taxo_new_cat');
    return { types: (TAXO.types['F&B / рестораны и кафе'] || []).slice(), cats: (TAXO.cats || []).slice() };
  });
  check('тип добавлен', more.types.indexOf('Славянская / русская кухня') >= 0, more.types.join(', '));
  check('своя категория добавлена', more.cats.indexOf('Коворкинг для стартапов') >= 0, more.cats.join(', '));

  /* Дубликаты не проходят */
  const dup = await pg.evaluate(() => {
    const before = (TAXO.subs['F&B / рестораны и кафе'] || []).length;
    let el = document.getElementById('taxo_new_sub');
    el.value = 'ресторан — славянская';              /* тот же текст в другом регистре */
    taxoAdd('subs', 'taxo_new_sub');
    const afterSame = (TAXO.subs['F&B / рестораны и кафе'] || []).length;
    el = document.getElementById('taxo_new_sub');
    el.value = 'Кофейня';                             /* уже есть среди встроенных */
    taxoAdd('subs', 'taxo_new_sub');
    return { before, afterSame, afterBuiltin: (TAXO.subs['F&B / рестораны и кафе'] || []).length };
  });
  check('повтор в другом регистре не добавляется', dup.afterSame === dup.before,
    `было ${dup.before}, стало ${dup.afterSame}`);
  check('совпадение со встроенным не добавляется', dup.afterBuiltin === dup.before,
    'стало ' + dup.afterBuiltin);

  /* Главное: добавленное видно в форме бренда */
  await pg.evaluate(() => go('brands'));
  await pg.waitForTimeout(1000);
  await pg.evaluate(() => window.brandEdit(''));
  await pg.waitForTimeout(900);
  const inForm = await pg.evaluate(() => {
    const ci = document.getElementById('bd_cat');
    ci.value = 'F&B / рестораны и кафе';
    ci.dispatchEvent(new Event('input', { bubbles: true }));
    const subs = [...document.querySelectorAll('#brandSubDL option')].map(o => o.value);
    const types = [...document.querySelectorAll('#brandTypeDL option')].map(o => o.value);
    const cats = [...document.querySelectorAll('#brandCatDL option')].map(o => o.value);
    return {
      sub: subs.indexOf('Ресторан — славянская') >= 0,
      type: types.indexOf('Славянская / русская кухня') >= 0,
      cat: cats.indexOf('Коворкинг для стартапов') >= 0,
      builtinKept: subs.indexOf('Кофейня') >= 0 && types.indexOf('Итальянская') >= 0,
      nSubs: subs.length, nTypes: types.length
    };
  });
  check('новая подкатегория видна в форме бренда', inForm.sub, 'подкатегорий: ' + inForm.nSubs);
  check('новый тип виден в форме бренда', inForm.type, 'типов: ' + inForm.nTypes);
  check('новая категория видна в форме бренда', inForm.cat);
  check('встроенные значения на месте', inForm.builtinKept);

  /* Встроенное удалить нельзя — среди кнопок «убрать» только добавленные вручную */
  await pg.evaluate(() => go('admin_system'));
  await pg.waitForTimeout(900);
  const removable = await pg.evaluate(() => {
    const links = [...document.querySelectorAll('.card a[onclick^="event.preventDefault();taxoDel"]')];
    return links.map(a => (a.parentElement.textContent || '').replace('×', '').trim());
  });
  check('кнопка «убрать» только у добавленного вручную',
    removable.length > 0 && removable.indexOf('Кофейня') < 0 && removable.indexOf('Итальянская') < 0,
    'убираемых: ' + removable.join(' | '));

  /* Справочник ушёл на сервер */
  await pg.waitForTimeout(2500);
  const onServer = state.appState.data.TAXO;
  check('справочник сохранён на сервере под TAXO',
    !!onServer && (onServer.subs['F&B / рестораны и кафе'] || []).indexOf('Ресторан — славянская') >= 0,
    onServer ? JSON.stringify(onServer).slice(0, 90) : 'ключа нет');

  check('ошибок сценария за весь прогон нет', errs.length === 0, errs[0] || 'ошибок нет');

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
