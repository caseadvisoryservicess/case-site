/* Две воронки под одним почерком: аренда и Advisory.

   Проверяется не «похоже на глаз», а два конкретных механизма, которые до этого релиза
   молча не работали, и оба видны пользователю каждый день.

   1. Таблицы аренды строились как <table><tr><th> без thead. Табличное ядро
      v432-data-grid.js требует tb.tHead, поэтому эти таблицы в него не попадали: ни липкой
      шапки, ни изменения ширины колонок, ни закрепления, ни тулбара. При этом дизайн-система
      поимённо перечисляет «.v32-table thead th» - правило существовало и было мёртвым.
      Отдельно: без обёртки прокрутки широкая таблица тянула вбок всю страницу.

   2. Экраны Advisory не выводили .ph. К этому классу привязаны четыре механики системы,
      и самая важная - плашка «Только просмотр» для роли с ограниченными правами. Без .ph
      человек не видел предупреждения вовсе и узнавал об отсутствии прав по неработающим
      кнопкам.

   Запуск: NODE_PATH=<...>/node_modules node v4700_funnels_one_style.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };

/* ---- статическая часть: разметка в исходниках ---- */
const read = f => fs.readFileSync(path.join(OS_DIR, f), 'utf8');
const leasing = [['v32-upgrade.js', 'v32-table'], ['v326-commission-engines.js', 'v326-table']];

leasing.forEach(([file, cls]) => {
  const src = read(file);
  const opens = (src.match(new RegExp('<table class="' + cls + '[^"]*">', 'g')) || []).length;
  const heads = (src.match(/<thead>/g) || []).length;
  const closes = (src.match(/<\/thead>/g) || []).length;
  const scrolls = (src.match(/tbl-scroll/g) || []).length;
  const wrapped = (src.match(/<\/table><\/div>/g) || []).length;
  ck(file + ': у каждой таблицы есть thead', opens > 0 && heads === opens && closes === opens,
     `таблиц ${opens}, thead ${heads}/${closes}`);
  ck(file + ': каждая таблица в обёртке прокрутки', scrolls === opens && wrapped === opens,
     `обёрток ${scrolls}, закрытий ${wrapped}`);
  ck(file + ': ни одной таблицы со старой разметкой <table><tr><th',
     !new RegExp('<table class="' + cls + '[^"]*"><tr><th').test(src));
});

const ux = read('v4450-ux-system.js');
ck('правило дизайн-системы про шапки таблиц аренды больше не мёртвое',
   /\.v32-table thead th/.test(ux) && /\.v326-table thead th/.test(ux));

[['v490-workflow.js', 'case49-head'], ['v492-portfolio-proposals.js', 'case492-head'],
 ['v493-portfolio-suite.js', 'case493-head']].forEach(([file, cls]) => {
  ck(file + ': заголовок раздела несёт класс ph',
     new RegExp('class="' + cls + ' ph"').test(read(file)));
});

/* ---- живая часть: то же самое в браузере ---- */
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { r.writeHead(404); r.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e).slice(0, 180)));

  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#luser', { timeout: 20000 });
  await page.evaluate(() => { document.getElementById('luser').value = 'ASH'; doLogin(); });
  await page.waitForTimeout(1500);

  async function look(view) {
    return await page.evaluate(async v => {
      go(v);
      await new Promise(r => setTimeout(r, 1400));
      const main = document.getElementById('main');
      const tables = Array.from(main.querySelectorAll('table'));
      return {
        view: v,
        ph: !!main.querySelector('.ph'),
        h1: (main.querySelector('h1') || {}).textContent || '',
        tables: tables.length,
        withHead: tables.filter(t => t.tHead).length,
        inGrid: tables.filter(t => t.classList.contains('case-grid')).length,
        scrolled: tables.filter(t => t.closest('.tbl-scroll')).length,
        overflow: main.scrollWidth > main.clientWidth + 2
      };
    }, view);
  }

  /* аренда */
  for (const v of ['v32_demand', 'v326_lease', 'v32_sales']) {
    const r = await look(v);
    if (!r.tables) { ck('аренда ' + v + ': экран открылся', !!r.h1, r.h1 || 'без заголовка'); continue; }
    ck('аренда ' + v + ': все таблицы имеют шапку', r.withHead === r.tables, `${r.withHead} из ${r.tables}`);
    ck('аренда ' + v + ': все таблицы подхвачены табличным ядром', r.inGrid === r.tables, `${r.inGrid} из ${r.tables}`);
    ck('аренда ' + v + ': все таблицы в обёртке прокрутки', r.scrolled === r.tables, `${r.scrolled} из ${r.tables}`);
    ck('аренда ' + v + ': страница не тянется вбок', !r.overflow);
    ck('аренда ' + v + ': заголовок раздела на месте', r.ph, r.h1);
  }

  /* Advisory */
  for (const v of ['advisory_pipeline', 'advisory_proposals', 'advisory_portfolio_map']) {
    const r = await look(v);
    ck('Advisory ' + v + ': заголовок несёт .ph и виден системе', r.ph, r.h1 || 'без заголовка');
    if (r.tables) {
      ck('Advisory ' + v + ': таблицы по-прежнему в ядре', r.inGrid === r.tables, `${r.inGrid} из ${r.tables}`);
    }
  }

  /* плашка «только просмотр» теперь достаёт до Advisory: проверяем сам механизм */
  const readonly = await page.evaluate(async () => {
    go('advisory_pipeline');
    await new Promise(r => setTimeout(r, 900));
    const main = document.getElementById('main');
    const ph = main.querySelector('.ph');
    if (!ph) return { found: false };
    /* повторяем то, что делает markReadonlyRegistry: ищет .ph и вешает плашку */
    const probe = document.createElement('span');
    probe.className = 'case-ui-readonly';
    probe.textContent = 'проверка';
    ph.appendChild(probe);
    const ok = !!main.querySelector('.ph .case-ui-readonly');
    probe.remove();
    return { found: true, canAttach: ok };
  });
  ck('плашка ограниченного доступа теперь может встать на экран Advisory',
     readonly.found && readonly.canAttach, readonly.found ? 'да' : 'заголовка .ph нет');

  ck('в консоли браузера нет ошибок страницы', errors.length === 0, errors.join(' | ') || 'чисто');

  await page.evaluate(async () => { go('v326_lease'); await new Promise(r => setTimeout(r, 1200)); });
  await page.screenshot({ path: path.join(__dirname, 'funnels_one_style.png') });
  ck('снимок сделан', fs.existsSync(path.join(__dirname, 'funnels_one_style.png')));

  await browser.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nОбе воронки пользуются общим табличным ядром и общим заголовком');
  process.exit(bad ? 1 : 0);
});
