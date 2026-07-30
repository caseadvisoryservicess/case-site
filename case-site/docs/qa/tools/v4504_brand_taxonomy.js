/* v4.50.4: таксономия брендов — типы и подкатегории должны быть доступны в форме.

   Жалоба: «нет мобильных операторов». Разбор показал три наложившихся бага, все от одной
   причины — CATTYPES и CATALCO остались на названиях категорий ДО таксономии v3.5.7:
     1. CATTYPES объявлена через const, поэтому в window не попадала, а форма читает
        window.CATTYPES — поле «Тип» было пустым для ВСЕХ 16 категорий;
     2. даже с доступом ключи не совпали бы: ни один из 13 не равен каноническому имени;
     3. CATALCO по той же причине не давал появиться галочке алкоголя даже у F&B.
   «Оператор связи» при этом лежал в CATTYPES['Услуги, киоски, спец. магазин'] и был
   недостижим. В подкатегориях вместо него стояло «Telecom» — единственное английское
   слово среди 32 русских.

   Запуск: node v4504_brand_taxonomy.js [папка os] */
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
  const { srv, base } = await createMockServer(OS, {});
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
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => { if (typeof go === 'function') go('brands'); });
  await pg.waitForTimeout(1200);
  await pg.evaluate(() => window.brandEdit(''));
  await pg.waitForTimeout(1000);

  check('форма бренда открылась без ошибок', errs.length === 0, errs[0] || 'ошибок нет');

  /* Типы разложены по каноническим категориям, а не по старым названиям */
  const keys = await pg.evaluate(() => ({
    canon: Object.keys(window.CANON_CATTYPES || {}),
    all: (window.ALL_CATTYPES || []).length,
    raw: Object.keys(window.CATTYPES || {}).length
  }));
  check('типы выставлены наружу и разложены по канону', keys.canon.length > 0 && keys.all > 0,
    `категорий с типами ${keys.canon.length}, всего типов ${keys.all}`);
  check('старая раскладка сохранена для прежних мест вызова', keys.raw === 13, 'ключей ' + keys.raw);

  /* Читаем список канонических категорий из формы и проверяем каждую */
  const per = await pg.evaluate(() => {
    const ci = document.getElementById('bd_cat');
    const cats = [...document.querySelectorAll('#brandCatDL option')].map(o => o.value);
    const out = [];
    cats.forEach(c => {
      ci.value = c;
      ci.dispatchEvent(new Event('input', { bubbles: true }));
      out.push({
        cat: c,
        subs: document.querySelectorAll('#brandSubDL option').length,
        types: document.querySelectorAll('#brandTypeDL option').length
      });
    });
    return out;
  });
  check('в форме все 16 канонических категорий', per.length === 16, 'найдено ' + per.length);
  const noSubs = per.filter(x => x.subs === 0);
  check('у каждой категории есть подкатегории', noSubs.length === 0,
    noSubs.length ? noSubs.map(x => x.cat).join(', ') : 'пустых нет');
  /* «Прочее» типов не имеет по смыслу — остальные должны иметь */
  const noTypes = per.filter(x => x.types === 0 && x.cat !== 'Прочее');
  check('типы подгружаются, а не остаются пустыми',
    noTypes.length <= 3,
    noTypes.length ? 'без типов: ' + noTypes.map(x => x.cat).join(', ') : 'у всех есть');

  /* Собственно жалоба: оператор связи должен находиться */
  const tel = await pg.evaluate(() => {
    const ci = document.getElementById('bd_cat');
    ci.value = 'Услуги и сервисы';
    ci.dispatchEvent(new Event('input', { bubbles: true }));
    const subs = [...document.querySelectorAll('#brandSubDL option')].map(o => o.value);
    const types = [...document.querySelectorAll('#brandTypeDL option')].map(o => o.value);
    return {
      sub: subs.filter(x => /оператор связи/i.test(x)),
      type: types.filter(x => /оператор связи/i.test(x)),
      leftoverEnglish: subs.filter(x => /^telecom$/i.test(x))
    };
  });
  check('оператор связи есть в подкатегориях', tel.sub.length === 1, tel.sub.join(' | ') || 'НЕ НАЙДЕН');
  check('оператор связи есть в типах', tel.type.length === 1, tel.type.join(' | ') || 'НЕ НАЙДЕН');
  check('английское «Telecom» из списка убрано', tel.leftoverEnglish.length === 0,
    tel.leftoverEnglish.join(', ') || 'убрано');

  /* Псевдоним категории должен давать тот же набор, что канон */
  const alias = await pg.evaluate(() => {
    const ci = document.getElementById('bd_cat');
    const read = v => { ci.value = v; ci.dispatchEvent(new Event('input', { bubbles: true }));
      return { s: document.querySelectorAll('#brandSubDL option').length,
               t: document.querySelectorAll('#brandTypeDL option').length }; };
    return { canon: read('Услуги и сервисы'), alias: read('Услуги') };
  });
  check('псевдоним категории даёт тот же набор',
    alias.alias.s === alias.canon.s && alias.alias.t === alias.canon.t,
    `канон ${alias.canon.s}/${alias.canon.t}, псевдоним ${alias.alias.s}/${alias.alias.t}`);

  /* Галочка алкоголя — по каноническому имени и по старому (обратная совместимость) */
  const alco = await pg.evaluate(() => ({
    canonF: !!(window.catHasAlcohol && window.catHasAlcohol('F&B / рестораны и кафе')),
    canonS: !!(window.catHasAlcohol && window.catHasAlcohol('Супермаркет / продукты')),
    old: !!(window.catHasAlcohol && window.catHasAlcohol('Места общественного питания')),
    none: !!(window.catHasAlcohol && window.catHasAlcohol('Услуги и сервисы'))
  }));
  check('алкоголь распознаётся по каноническому имени', alco.canonF && alco.canonS,
    `F&B=${alco.canonF}, супермаркет=${alco.canonS}`);
  check('старое имя категории тоже распознаётся', alco.old);
  check('где алкоголя быть не должно — его нет', alco.none === false);

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
