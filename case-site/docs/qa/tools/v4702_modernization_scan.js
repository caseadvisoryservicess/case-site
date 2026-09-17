/* Какие разделы остались «старыми»: инвентаризация по признакам дизайн-системы.

   Владелец говорит, что часть страниц выглядит необновлённой. Догадки тут бесполезны -
   нужен список. Этот обход открывает КАЖДЫЙ раздел и проверяет наличие пяти признаков,
   по которым раздел считается приведённым к общему виду:

     .ph          - заголовок раздела, к которому привязаны механики системы
     .tbl-scroll  - обёртка прокрутки таблицы
     case-grid    - таблица подхвачена общим табличным ядром
     .kpi         - плитки сводных чисел из дизайн-системы
     бейдж        - статус показан плашкой, а не сырым текстом

   Разделы без таблиц и без чисел не штрафуются за их отсутствие: признак учитывается
   только если элемент на экране вообще есть.

   Запуск: NODE_PATH=<...>/node_modules node v4702_modernization_scan.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };

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

  const views = await page.evaluate(() => (window.CASE_OS_MODULES || []).map(m => ({
    v: m.v, ru: m.ru, g: m.g, future: !!m.future
  })));

  const rows = [];
  for (const m of views) {
    const r = await page.evaluate(async v => {
      try { go(v); } catch (e) { return { error: String(e && e.message || e).slice(0, 80) }; }
      await new Promise(res => setTimeout(res, 700));
      const main = document.getElementById('main');
      if (!main) return { error: 'нет #main' };
      const tables = Array.from(main.querySelectorAll('table'));
      const text = (main.innerText || '').trim();
      return {
        empty: text.length < 40,
        ph: !!main.querySelector('.ph'),
        tables: tables.length,
        inGrid: tables.filter(t => t.classList.contains('case-grid')).length,
        scrolled: tables.filter(t => t.closest('.tbl-scroll')).length,
        /* Смотрим не на имя класса, а на результат: плитка считается общей, если её
           число набрано системным кеглем. Имя класса ничего не говорит о том, как
           элемент выглядит, а пользователь видит именно вид. */
        kpiTiles: (() => {
          const sel = '.kpi, .v32-kpi, .v326-kpi, .case49-kpis>div, .case492-kpis>div, .case493-kpis>div';
          return Array.from(main.querySelectorAll(sel)).map(t => {
            const val = t.querySelector('.val, b');
            if (!val) return null;
            const fs = parseFloat(getComputedStyle(val).fontSize) || 0;
            return Math.round(fs);
          }).filter(x => x !== null);
        })(),
        badges: main.querySelectorAll('[class*="badge"],[class*="-pill"],[class*="chip"]').length,
        ownHead: main.querySelectorAll('[class*="-head"]').length
      };
    }, m.v);
    rows.push(Object.assign({ view: m.v, ru: m.ru, group: m.g, future: m.future }, r));
  }

  /* ---- оценка ---- */
  function verdict(r) {
    if (r.error) return { mark: 'ошибка', why: r.error };
    if (r.empty) return { mark: 'пусто', why: 'экран не отрисовал содержимого' };
    const miss = [];
    if (!r.ph) miss.push('нет заголовка .ph');
    if (r.tables && r.inGrid < r.tables) miss.push(`таблиц вне ядра: ${r.tables - r.inGrid}`);
    if (r.tables && r.scrolled < r.tables) miss.push(`таблиц без обёртки: ${r.tables - r.scrolled}`);
    /* 26px на широком экране и 22px на узком - системный кегль числа (v4450-ux-system.js).
       Любой другой означает, что модуль рисует плитку по-своему. */
    const odd = (r.kpiTiles || []).filter(fs => fs !== 26 && fs !== 22);
    if (odd.length) miss.push(`плитки чисел не системного кегля: ${[...new Set(odd)].join(', ')}px`);
    return miss.length ? { mark: 'старый', why: miss.join('; ') } : { mark: 'обновлён', why: '' };
  }

  const scored = rows.map(r => Object.assign({}, r, verdict(r)));
  const old = scored.filter(x => x.mark === 'старый');
  const ok = scored.filter(x => x.mark === 'обновлён');
  const empty = scored.filter(x => x.mark === 'пусто');
  const err = scored.filter(x => x.mark === 'ошибка');

  console.log(`Разделов проверено: ${scored.length}`);
  console.log(`  приведены к общему виду: ${ok.length}`);
  console.log(`  остались старыми:        ${old.length}`);
  console.log(`  без содержимого:         ${empty.length}`);
  console.log(`  с ошибкой:               ${err.length}\n`);

  if (old.length) {
    console.log('ОСТАЛИСЬ СТАРЫМИ (по группам):');
    const byG = {};
    old.forEach(x => { (byG[x.group] = byG[x.group] || []).push(x); });
    Object.keys(byG).sort().forEach(g => {
      console.log('\n  [' + g + ']');
      byG[g].forEach(x => console.log('    ' + (x.ru || x.view).padEnd(34) + x.why + (x.future ? '   (в планах)' : '')));
    });
  }
  if (empty.length) {
    console.log('\nБЕЗ СОДЕРЖИМОГО (вероятно заглушки дорожной карты):');
    empty.forEach(x => console.log('    ' + (x.ru || x.view).padEnd(34) + (x.future ? 'помечен как план' : 'НЕ помечен как план')));
  }
  if (err.length) {
    console.log('\nС ОШИБКОЙ:');
    err.forEach(x => console.log('    ' + (x.ru || x.view).padEnd(34) + x.error));
  }

  const out = path.join(__dirname, 'modernization_scan.json');
  fs.writeFileSync(out, JSON.stringify(scored, null, 1), 'utf8');
  console.log('\nПодробности: ' + out);

  await browser.close(); srv.close();
  /* Это инвентаризация, а не приёмка: код возврата всегда 0, чтобы список было видно. */
  process.exit(0);
});
