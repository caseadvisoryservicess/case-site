/* CASE OS v4.46.3 — закрепление столбцов:
   1) шапка (оба ряда) прилипает ВМЕСТЕ с телом закреплённых столбцов;
   2) незакреплённые th без паразитных сдвигов («белые пятна»);
   3) при вертикальном прилипании (клон шапки) закреплённые столбцы клона совпадают с телом;
   4) снятие закрепления возвращает всё как было.
   Запуск: node v4463_pins.js /path/to/os */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs'), http = require('http');
const OS_DIR = path.resolve(process.argv[2] || '.');
const results = [];
const rec = (n, ok, i) => { results.push({ test: n, status: ok ? 'PASS' : 'FAIL', ...(i ? { info: String(i).slice(0, 300) } : {}) }); if (!ok) process.exitCode = 1; };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const srv = http.createServer((req, rsp) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end(); return; } const f = path.join(OS_DIR, p); if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp); });
srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = 'ASH'; doLogin(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => go('registry'));
  await page.waitForTimeout(1200);

  /* закрепляем 3 столбца через настоящую панель «Столбцы» */
  await page.evaluate(() => { document.querySelector('#main .case-grid-toolbar [data-columns]').click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('.case-grid-panel [data-pin]').value = '3'; document.querySelector('.case-grid-panel [data-save]').click(); });
  await page.waitForTimeout(1200);

  /* 1-2. горизонтальный скролл: шапка прилипает с телом, прочие th без сдвигов */
  const h = await page.evaluate(async () => {
    const wrap = document.querySelector('#main .tbl-scroll');
    wrap.scrollLeft = 400; wrap.dispatchEvent(new Event('scroll'));
    await new Promise(r => setTimeout(r, 400));
    const wrapX = wrap.getBoundingClientRect().x;
    const tb = document.querySelector('#main table.case-grid');
    const lastHead = tb.tHead.rows[tb.tHead.rows.length - 1];
    const pinTh = [...lastHead.cells].filter(c => c.classList.contains('case-grid-pin'));
    const row0 = tb.tBodies[0].rows[0];
    const pinTd = [...row0.cells].filter(c => c.classList.contains('case-grid-pin'));
    const thInfo = pinTh.map(c => ({ pos: getComputedStyle(c).position, x: Math.round(c.getBoundingClientRect().x - wrapX) }));
    const tdInfo = pinTd.map(c => ({ pos: getComputedStyle(c).position, x: Math.round(c.getBoundingClientRect().x - wrapX) }));
    const aligned = thInfo.length === 3 && thInfo.every((t, i) => tdInfo[i] && Math.abs(t.x - tdInfo[i].x) <= 1 && t.pos === 'sticky' && tdInfo[i].pos === 'sticky' && t.x >= -1);
    /* незакреплённые th: не должны иметь inline left (паразитные сдвиги = «белые пятна») */
    const strays = [...tb.tHead.querySelectorAll('th:not(.case-grid-pin)')].filter(c => c.style.left && c.style.left !== '' && c.style.left !== '0px').length;
    /* групповой ряд: закреплённые prefix-ячейки тоже sticky */
    const grpPin = [...tb.tHead.rows[0].cells].filter(c => c.classList.contains('case-grid-pin'));
    const grpOk = grpPin.every(c => getComputedStyle(c).position === 'sticky');
    return { thInfo, tdInfo, aligned, strays, grpPinN: grpPin.length, grpOk };
  });
  rec('гор. скролл: шапка закреплённых столбцов прилипает вместе с телом', h.aligned, JSON.stringify(h));
  rec('незакреплённые th без паразитных left-сдвигов (нет «белых пятен»)', h.strays === 0, 'сдвигов: ' + h.strays);
  rec('групповой ряд шапки: закреплённые ячейки sticky', h.grpOk, JSON.stringify({ n: h.grpPinN, ok: h.grpOk }));

  /* 3. вертикальное прилипание: клон шапки согласован с телом закреплённых столбцов */
  const v = await page.evaluate(async () => {
    const wrap = document.querySelector('#main .tbl-scroll');
    wrap.scrollTop = 300; wrap.scrollLeft = 400; wrap.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('scroll'));
    await new Promise(r => setTimeout(r, 450));
    const layer = document.querySelector('.case-sticky-head-layer');
    if (!layer || layer.style.display === 'none') return { err: 'клон не показан' };
    const src = layer._source;
    const lastHead = layer.querySelector('table').tHead;
    const clonePin = [...lastHead.rows[lastHead.rows.length - 1].cells].filter(c => c.classList.contains('case-grid-pin'));
    const bodyPin = [...src.tBodies[0].rows[0].cells].filter(c => c.classList.contains('case-grid-pin'));
    const pairs = clonePin.map((c, i) => ({ cloneX: Math.round(c.getBoundingClientRect().x), bodyX: bodyPin[i] ? Math.round(bodyPin[i].getBoundingClientRect().x) : null, pos: getComputedStyle(c).position }));
    const aligned = pairs.length === 3 && pairs.every(p => p.bodyX != null && Math.abs(p.cloneX - p.bodyX) <= 2 && p.pos === 'sticky');
    /* незакреплённая часть клона реально прокручена (совпадает с телом) */
    const cloneOther = [...lastHead.rows[lastHead.rows.length - 1].cells].find(c => !c.classList.contains('case-grid-pin') && c.textContent.trim());
    const idx = [...lastHead.rows[lastHead.rows.length - 1].cells].indexOf(cloneOther);
    const srcTd = src.tBodies[0].rows[0].cells[idx];
    const otherAligned = cloneOther && srcTd ? Math.abs(cloneOther.getBoundingClientRect().x - srcTd.getBoundingClientRect().x) <= 2 : false;
    return { pairs, aligned, otherAligned, layerScroll: layer.scrollLeft };
  });
  rec('клон шапки: закреплённые столбцы совпадают с телом', !v.err && v.aligned, JSON.stringify(v));
  rec('клон шапки: незакреплённые столбцы прокручены синхронно с телом', !v.err && v.otherAligned, JSON.stringify({ other: v.otherAligned, sl: v.layerScroll }));

  /* 3б. ЛИНИИ: каждая видимая граница столбца в клоне совпадает с границей в теле (±1px) */
  const lines = await page.evaluate(() => {
    const layer = document.querySelector('.case-sticky-head-layer');
    if (!layer || layer.style.display === 'none') return { err: 'клон не показан' };
    const ct = layer.querySelector('table'), src = layer._source;
    const edges = row => [...row.cells].filter(c => getComputedStyle(c).display !== 'none').map(c => c.getBoundingClientRect().right);
    const leaf = edges(ct.tHead.rows[ct.tHead.rows.length - 1]);
    const bodyRow = [...src.tBodies[0].rows].find(r => r.cells.length > 5);
    const body = edges(bodyRow);
    const bad = leaf.map((x, i) => Math.abs(x - (body[i] != null ? body[i] : NaN))).filter(d => !isNaN(d) && d > 1.5);
    const grp = edges(ct.tHead.rows[0]).filter(x => !leaf.some(y => Math.abs(x - y) <= 1.5));
    return { badN: bad.length, bad: bad.slice(0, 4), grpStray: grp.length };
  });
  rec('клон шапки: линии столбцов совпадают с телом (±1px)', !lines.err && lines.badN === 0, JSON.stringify(lines));
  rec('клон шапки: линии группового ряда не расходятся с колонками', !lines.err && lines.grpStray === 0, JSON.stringify(lines));

  /* 4. снятие закрепления */
  await page.evaluate(() => { window.scrollTo(0, 0); const w = document.querySelector('#main .tbl-scroll'); w.scrollTop = 0; w.dispatchEvent(new Event('scroll')); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('#main .case-grid-toolbar [data-columns]').click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('.case-grid-panel [data-pin]').value = '0'; document.querySelector('.case-grid-panel [data-save]').click(); });
  await page.waitForTimeout(1000);
  const off = await page.evaluate(() => document.querySelectorAll('#main table.case-grid .case-grid-pin').length);
  rec('снятие закрепления: pin-классов не осталось', off === 0, 'осталось: ' + off);

  const realErr = errs.filter(e => !/favicon/.test(e));
  rec('нет JS-ошибок', realErr.length === 0, realErr.slice(0, 3).join(' | '));
  console.log(JSON.stringify({ summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1));
  await browser.close(); srv.close();
});
