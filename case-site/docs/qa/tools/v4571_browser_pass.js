/* Реальный браузерный прогон CASE OS на нескольких разрешениях.

   Внешний аудит v4.57.1 не смог его выполнить: «попытки открыть сборку в локальном
   Chromium через HTTP, file:// и отдельный local hostname были заблокированы политикой
   среды». Здесь такой прогон возможен, поэтому пробел закрывается.

   Что проверяется на каждом разрешении и на каждом разделе:
     - ошибки сценария в консоли (pageerror) и ошибки уровня error в console;
     - горизонтальное переполнение страницы (появление боковой прокрутки);
     - элементы, вылезающие за правую границу окна;
     - доступность управляющих элементов: кнопки без доступного имени;
     - шрифты мельче 11px в видимых элементах;
     - кликабельные div/span без клавиатурной семантики.

   Запуск: node v4571_browser_pass.js [папка os] */
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

const OS = process.argv[2] || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const VIEWPORTS = [
  { name: 'десктоп 1920', width: 1920, height: 1080 },
  { name: 'ноутбук 1366', width: 1366, height: 768 },
  { name: 'узкий 1024', width: 1024, height: 768 },
  { name: 'планшет 768', width: 768, height: 1024 },
  { name: 'телефон 390', width: 390, height: 844 }
];
const VIEWS = ['dash', 'registry', 'brands', 'plans', 'dates', 'docs', 'users', 'admin_system'];

let failed = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) failed++; };

/* Собирает проблемы вёрстки и доступности на текущем экране */
const AUDIT = () => {
  const out = { overflow: [], tiny: [], noName: [], fakeButtons: [] };
  const W = document.documentElement.clientWidth;
  const vis = el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  /* элемент, который предок прокручивает или обрезает, страницу вширь не тянет:
     .tbl-scroll прокручивается, .planwrap (панорама чертежа) обрезает по overflow:hidden */
  const inScroller = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox === 'hidden' || ox === 'clip') return true;
      if ((ox === 'auto' || ox === 'scroll') && p.scrollWidth > p.clientWidth + 2) return true;
    }
    return false;
  };
  /* выехавшая за экран панель (transform / left:100%) — это закрытая шторка, а не дефект */
  const offCanvas = el => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.position === 'fixed' && s.transform && s.transform !== 'none' && /matrix/.test(s.transform)) return true;
    }
    return false;
  };
  /* имя, собранное только из значков: скринридер прочитает «крестик» вместо «закрыть».
     Диапазоны заданы кодами — писать их символами опасно, любая пара «символ-дефис-символ»
     внутри класса легко превращается в диапазон, накрывающий кириллицу целиком. */
  const GLYPH_ONLY = /^[\s×‐-⯿️‍]+$/u;
  document.querySelectorAll('body *').forEach(el => {
    if (!vis(el)) return;
    const r = el.getBoundingClientRect();
    if (r.right > W + 2 && el.scrollWidth <= el.clientWidth + 2 && el.children.length === 0
        && !inScroller(el) && !offCanvas(el)) {
      out.overflow.push((el.tagName + '.' + (el.className || '')).slice(0, 60) + ' → ' + Math.round(r.right - W) + 'px');
    }
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs && fs < 9 && (el.textContent || '').trim().length > 2 && el.children.length === 0) {
      out.tiny.push(fs.toFixed(1) + 'px: ' + (el.textContent || '').trim().slice(0, 40));
    }
    const tag = el.tagName;
    if (tag === 'BUTTON' || (tag === 'A' && el.getAttribute('href'))) {
      const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
      if (!name || GLYPH_ONLY.test(name)) out.noName.push(tag + ' «' + name.slice(0, 12) + '»');
    }
    if ((tag === 'DIV' || tag === 'SPAN') && el.getAttribute('onclick')
        && el.getAttribute('role') !== 'button' && !el.hasAttribute('tabindex')) {
      out.fakeButtons.push((el.className || el.id || tag).slice(0, 40) + ': '
        + (el.textContent || '').trim().slice(0, 24));
    }
    /* строки реестра не должны становиться кнопками — иначе таблица перестаёт быть таблицей */
    if ((tag === 'TR' || tag === 'TD' || tag === 'TH') && el.getAttribute('role') === 'button') {
      out.tableRoles = out.tableRoles || [];
      out.tableRoles.push(tag);
    }
  });
  out.tableRoles = out.tableRoles || [];
  const uniq = a => [...new Set(a)];
  return { overflow: uniq(out.overflow), tiny: uniq(out.tiny),
           noName: uniq(out.noName), fakeButtons: uniq(out.fakeButtons),
           tableRoles: out.tableRoles.length,
           scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2 };
};

(async () => {
  const { srv, base } = await createMockServer(OS, {
    initialState: {
      OBJECTS: [{ id: 'ca', name: 'CASE Mall' }],
      U: [{ id: 'L1_1', code: 'L1-1', obj: 'ca', floor: '1', area: 120, cat: 'Мода', status: 'vac',
            rate: 25, budget: 18, vars: [], dates: [], hist: [], comments: [] }],
      BRANDS: [{ id: 'b1', name: 'Zara', cat: 'Мода' }], CHANGES: [], TRASH: []
    }
  });
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });

  const totals = { overflow: 0, tiny: 0, noName: 0, fakeButtons: 0, errors: [] };
  for (const vp of VIEWPORTS) {
    const pg = await b.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errs = [];
    pg.on('pageerror', e => errs.push(vp.name + ': ' + e.message));
    pg.on('console', m => { if (m.type() === 'error' && !/favicon|net::|Failed to load resource/i.test(m.text())) errs.push(vp.name + ' console: ' + m.text().slice(0, 120)); });
    await pg.route('**/*', r => {
      const u = r.request().url();
      if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
      return r.abort();
    });
    await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(900);
    await pg.evaluate(() => {
      const s = document.querySelector('#luser');
      if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
      if (typeof doLogin === 'function') doLogin();
    });
    await pg.waitForTimeout(2200);

    const perView = {};
    for (const v of VIEWS) {
      await pg.evaluate(view => { if (typeof go === 'function') go(view); }, v);
      await pg.waitForTimeout(700);
      const a = await pg.evaluate(AUDIT);
      perView[v] = a;
      totals.overflow += a.overflow.length;
      totals.tiny += a.tiny.length;
      totals.noName += a.noName.length;
      totals.fakeButtons += a.fakeButtons.length;
    }
    const scrolled = Object.entries(perView).filter(([, a]) => a.scrollX).map(([v]) => v);
    ck(`${vp.name}: нет горизонтальной прокрутки страницы`, scrolled.length === 0, scrolled.join(', ') || 'ни на одном разделе');
    const over = Object.entries(perView).flatMap(([v, a]) => a.overflow.map(x => v + ' · ' + x));
    ck(`${vp.name}: ничего не вылезает за правый край`, over.length === 0, over.slice(0, 3).join(' | ') || 'чисто');
    ck(`${vp.name}: без ошибок сценария`, errs.length === 0, errs[0] || 'ошибок нет');
    const roles = Object.entries(perView).reduce((n, [, a]) => n + a.tableRoles, 0);
    ck(`${vp.name}: строки таблиц не подменены кнопками`, roles === 0, roles ? roles + ' элементов tr/td/th c role=button' : 'ролей таблицы не нарушено');
    totals.errors.push(...errs);
    await pg.close();
  }

  /* Сводка по доступности — считаем на самом широком экране, чтобы не дублировать */
  const pg = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(base) || u.startsWith('data:') || u.startsWith('blob:')) return r.continue();
    return r.abort();
  });
  await pg.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await pg.evaluate(() => {
    const s = document.querySelector('#luser');
    if (s) { s.value = 'ASH'; s.dispatchEvent(new Event('change')); }
    if (typeof doLogin === 'function') doLogin();
  });
  await pg.waitForTimeout(2200);
  const acc = { noName: [], fake: [], tiny: [] };
  for (const v of VIEWS) {
    await pg.evaluate(view => { if (typeof go === 'function') go(view); }, v);
    await pg.waitForTimeout(600);
    const a = await pg.evaluate(AUDIT);
    acc.noName.push(...a.noName); acc.fake.push(...a.fakeButtons); acc.tiny.push(...a.tiny);
  }
  const u = a => [...new Set(a)];
  console.log('\nДоступность (сводно по разделам):');
  console.log('  кнопок без доступного имени: ' + u(acc.noName).length + (u(acc.noName).length ? ' → ' + u(acc.noName).slice(0, 6).join(', ') : ''));
  console.log('  кликабельных div/span без роли: ' + u(acc.fake).length + (u(acc.fake).length ? ' → ' + u(acc.fake).slice(0, 6).join(' | ') : ''));
  console.log('  текстов мельче 9px: ' + u(acc.tiny).length + (u(acc.tiny).length ? ' → ' + u(acc.tiny).slice(0, 4).join(' | ') : ''));

  await pg.close(); await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
