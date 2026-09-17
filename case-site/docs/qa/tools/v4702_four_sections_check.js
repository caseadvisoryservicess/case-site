/* Четыре раздела, которые в v4.70.2 привели к общему виду: проверка, что они не сломались.

   Пометить класс - дело одной секунды, и именно поэтому опасное: `.ph` тянет за собой
   правила системы (кегль заголовка, отступы, поведение на телефоне), а `tbl-scroll` отдаёт
   таблицу Базы брендов табличному ядру. Проверяем не наличие класса, а последствия:
   заголовок стоит слева, таблица не опустела, ядро её подхватило.

   Запуск: NODE_PATH=<...>/node_modules node v4702_four_sections_check.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };

let bad = 0;
function ck(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail == null ? '' : ' - ' + detail));
  if (!cond) bad++;
}

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
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#luser', { timeout: 20000 });
  await page.evaluate(() => { document.getElementById('luser').value = 'ASH'; doLogin(); });
  await page.waitForTimeout(1500);

  async function open(view, ms) {
    await page.evaluate(v => go(v), view);
    await page.waitForTimeout(ms || 900);
  }

  /* --- 1. Заголовок стоит слева, а не уехал в середину строки --------------------------
     Правило .ph>div{margin-left:auto} задумано для блока кнопок. Там, где заголовок сам
     лежит в <div>, оно раздвигало и его: свободное место делилось между двумя auto-полями,
     и заголовок оказывался не у левого края. Проверяем координатой, а не наличием правила. */
  console.log('\n--- 1. Заголовок прижат к левому краю');
  for (const [view, ru] of [['feasibility', 'Финансовая модель'], ['mep', 'MEP / техзадание'],
                            ['lift', 'Расчёт лифтов'], ['brands', 'База брендов'],
                            ['advisory_pipeline', 'Воронка Advisory']]) {
    await open(view, view === 'brands' ? 1600 : 900);
    const off = await page.evaluate(() => {
      const ph = document.querySelector('#main .ph');
      if (!ph) return null;
      const first = ph.querySelector(':scope > div');
      if (!first) return { noDiv: true };
      return Math.round(first.getBoundingClientRect().left - ph.getBoundingClientRect().left);
    });
    ck(`${ru}: заголовок у левого края`, off !== null && (off.noDiv || off <= 20), off && off.noDiv ? 'заголовок не в <div>' : off + 'px от края');
  }

  /* --- 2. Кегль заголовка одинаков во всех разделах ---------------------------------- */
  console.log('\n--- 2. Один кегль заголовка на все разделы');
  const sizes = {};
  for (const [view, ru] of [['registry', 'Реестр'], ['brands', 'База брендов'],
                            ['advisory_pipeline', 'Воронка Advisory'], ['feasibility', 'Финансовая модель']]) {
    await open(view, view === 'brands' ? 1600 : 900);
    sizes[ru] = await page.evaluate(() => {
      const t = document.querySelector('#main .ph h1, #main .ph h2');
      return t ? Math.round(parseFloat(getComputedStyle(t).fontSize)) : 0;
    });
  }
  const uniq = [...new Set(Object.values(sizes))];
  ck('кегль заголовка совпадает', uniq.length === 1,
     Object.entries(sizes).map(([k, v]) => k + ': ' + v + 'px').join('; '));

  /* --- 3. База брендов: таблица не опустела и подхвачена табличным ядром -------------
     Добавление tbl-scroll отдаёт таблицу v432: появляются панель «Столбцы / Вид» и
     закрепление столбцов. Если бы обёртка при этом схлопнулась, строки бы пропали. */
  console.log('\n--- 3. База брендов после передачи таблицы ядру');
  await open('brands', 1800);
  const b = await page.evaluate(() => {
    const wrap = document.querySelector('.asaas35-table-wrap');
    const tb = document.querySelector('table.asaas35-table');
    const thead = tb && tb.tHead;
    return {
      wrap: !!wrap,
      isScroll: !!(wrap && wrap.classList.contains('tbl-scroll')),
      rows: tb && tb.tBodies[0] ? tb.tBodies[0].rows.length : 0,
      cols: thead && thead.rows[0] ? thead.rows[0].cells.length : 0,
      inGrid: !!(tb && tb.classList.contains('case-grid')),
      seenByCore: !!(tb && tb.closest('.tbl-scroll')),
      toolbar: !!document.querySelector('.case-grid-toolbar[data-for="brands"]'),
      wrapH: wrap ? Math.round(wrap.getBoundingClientRect().height) : 0,
      overflowX: wrap ? getComputedStyle(wrap).overflowX : '',
      /* шапка обязана остаться прилипшей: у Базы брендов свой механизм из v3515 */
      theadSticky: thead && thead.rows[0] ? getComputedStyle(thead.rows[0].cells[0]).position : ''
    };
  });
  ck('обёртка на месте', b.wrap);
  ck('обёртка помечена как прокрутка системы', b.isScroll);
  ck('строки не пропали', b.rows > 0, b.rows + ' строк');
  ck('столбцы на месте', b.cols > 5, b.cols + ' столбцов');
  ck('таблица в общем ядре', b.inGrid);
  ck('ядро теперь видит её прокрутку', b.seenByCore);
  ck('появилась панель «Столбцы / Вид»', b.toolbar);
  ck('таблица не схлопнулась по высоте', b.wrapH > 200, b.wrapH + 'px');
  ck('горизонтальная прокрутка сохранена', b.overflowX === 'auto' || b.overflowX === 'scroll', b.overflowX);
  ck('шапка осталась прилипшей', b.theadSticky === 'sticky', b.theadSticky);

  /* --- 4. Студии в рамке: заголовок не съел саму рамку -------------------------------- */
  console.log('\n--- 4. Студии открываются, рамка на месте');
  for (const [view, ru, sel] of [['feasibility', 'Финансовая модель', '#feasFrame'],
                                 ['mep', 'MEP / техзадание', '#engFrame_mep'],
                                 ['lift', 'Расчёт лифтов', '#engFrame_lift']]) {
    await open(view, 1200);
    const r = await page.evaluate(s => {
      const f = document.querySelector(s);
      if (!f) return null;
      const box = f.getBoundingClientRect();
      return { w: Math.round(box.width), h: Math.round(box.height) };
    }, sel);
    ck(`${ru}: рамка студии имеет размер`, !!r && r.w > 400 && r.h > 300, r ? r.w + '×' + r.h : 'рамки нет');
  }

  /* --- 5. Читаемость: заголовок и кнопки не наехали друг на друга -------------------- */
  console.log('\n--- 5. Заголовок и правый блок не перекрываются');
  for (const [view, ru] of [['feasibility', 'Финансовая модель'], ['mep', 'MEP / техзадание'],
                            ['brands', 'База брендов']]) {
    await open(view, view === 'brands' ? 1600 : 1000);
    const ov = await page.evaluate(() => {
      const ph = document.querySelector('#main .ph');
      if (!ph) return null;
      const kids = Array.from(ph.children).filter(k => k.getBoundingClientRect().width > 0);
      if (kids.length < 2) return 0;
      const a = kids[0].getBoundingClientRect(), z = kids[kids.length - 1].getBoundingClientRect();
      if (Math.abs(a.top - z.top) > a.height) return 0; /* перенеслись на разные строки - это нормально */
      return Math.round(a.right - z.left);
    });
    ck(`${ru}: без наложения`, ov !== null && ov <= 0, ov > 0 ? 'перекрытие ' + ov + 'px' : 'зазор есть');
  }

  await browser.close(); srv.close();
  console.log('\n' + (bad ? `ПРОВАЛЕНО проверок: ${bad}\n` : 'Четыре раздела приведены к общему виду и работают\n'));
  process.exit(bad ? 1 : 0);
});
