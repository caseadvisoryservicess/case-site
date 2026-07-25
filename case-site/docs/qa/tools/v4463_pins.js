/* CASE OS v4.48.0 — закрепление столбцов и НАТИВНАЯ прилипшая шапка (без клона):
   1) шапка (оба ряда) прилипает вместе с телом закреплённых столбцов при гор. скролле;
   2) незакреплённые th без паразитных сдвигов;
   3) вертикальная прокрутка: настоящий thead остаётся видимым (sticky), клон-слоёв в DOM нет;
   4) линии столбцов шапки совпадают с телом (один элемент — по построению);
   5) резайзер работает в прилипшем состоянии;
   6) снятие закрепления.
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

  /* закрепляем 3 столбца через панель «Столбцы» */
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
    const strays = [...tb.tHead.querySelectorAll('th:not(.case-grid-pin)')].filter(c => c.style.left && c.style.left !== '' && c.style.left !== '0px').length;
    const grpPin = [...tb.tHead.rows[0].cells].filter(c => c.classList.contains('case-grid-pin'));
    const grpOk = grpPin.every(c => getComputedStyle(c).position === 'sticky');
    return { thInfo, tdInfo, aligned, strays, grpPinN: grpPin.length, grpOk };
  });
  rec('гор. скролл: шапка закреплённых столбцов прилипает вместе с телом', h.aligned, JSON.stringify(h));
  rec('незакреплённые th без паразитных left-сдвигов', h.strays === 0, 'сдвигов: ' + h.strays);
  rec('групповой ряд шапки: закреплённые ячейки sticky', h.grpOk, JSON.stringify({ n: h.grpPinN, ok: h.grpOk }));

  /* 3. вертикальная прокрутка: настоящий thead виден (native sticky), клонов нет */
  const v = await page.evaluate(async () => {
    const wrap = document.querySelector('#main .tbl-scroll');
    wrap.scrollTop = 300; wrap.scrollLeft = 400; wrap.dispatchEvent(new Event('scroll')); window.dispatchEvent(new Event('scroll'));
    await new Promise(r => setTimeout(r, 450));
    const tb = document.querySelector('#main table.case-grid');
    const wr = wrap.getBoundingClientRect();
    const leaf = tb.tHead.rows[tb.tHead.rows.length - 1];
    const leafR = leaf.getBoundingClientRect();
    const grpR = tb.tHead.rows[0].getBoundingClientRect();
    const layers = document.querySelectorAll('.case-sticky-head-layer').length;
    /* шапка прилипла: верх группового ряда у верхней кромки обёртки */
    const headStuck = Math.abs(grpR.top - wr.top) <= 3 && leafR.top > grpR.top && leafR.bottom < wr.top + 120;
    /* линии: границы th совпадают с границами td (один элемент — but проверим) */
    const edges = row => [...row.cells].filter(c => getComputedStyle(c).display !== 'none').map(c => c.getBoundingClientRect().right);
    const bodyRow = [...tb.tBodies[0].rows].find(r => r.cells.length > 5 && r.getBoundingClientRect().height > 5);
    const thE = edges(leaf), tdE = edges(bodyRow);
    const badLines = thE.map((x, i) => Math.abs(x - (tdE[i] != null ? tdE[i] : NaN))).filter(d => !isNaN(d) && d > 1).length;
    /* закреплённые: th и td на одном x */
    const pinTh = [...leaf.cells].filter(c => c.classList.contains('case-grid-pin'));
    const pinTd = [...bodyRow.cells].filter(c => c.classList.contains('case-grid-pin'));
    const pinAligned = pinTh.length === 3 && pinTh.every((c, i) => pinTd[i] && Math.abs(c.getBoundingClientRect().x - pinTd[i].getBoundingClientRect().x) <= 1);
    return { layers, headStuck, badLines, pinAligned, grpTop: Math.round(grpR.top - wr.top), scrollTop: wrap.scrollTop };
  });
  rec('верт. прокрутка: настоящий thead прилип (клона нет в DOM)', v.layers === 0 && v.headStuck, JSON.stringify(v));
  rec('верт.+гор.: линии шапки совпадают с телом (±1px)', v.badLines === 0, 'плохих линий: ' + v.badLines);
  rec('верт.+гор.: закреплённые столбцы шапки на одном x с телом', v.pinAligned, JSON.stringify({ pinAligned: v.pinAligned }));

  /* 4. резайзер в прилипшем состоянии: тянем ширину из шапки */
  const rz = await page.evaluate(async () => {
    const tb = document.querySelector('#main table.case-grid');
    const leaf = tb.tHead.rows[tb.tHead.rows.length - 1];
    const r = [...leaf.querySelectorAll('.case-grid-resizer')].find(x => x.dataset.caseColId && x.dataset.caseColId !== '_select' && x.closest('th').getBoundingClientRect().width > 0 && !x.closest('th').classList.contains('case-grid-pin'));
    if (!r) return { err: 'нет видимого резайзера' };
    const id = r.dataset.caseColId;
    const col = [...tb.querySelector('colgroup').children].find(c => c.dataset.caseColId === id);
    const w0 = parseFloat(col.style.width);
    const b = r.getBoundingClientRect();
    r.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: b.x + 2, clientY: b.y + 5, bubbles: true, pointerId: 7 }));
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: b.x + 60, clientY: b.y + 5, bubbles: true, pointerId: 7 }));
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: b.x + 60, clientY: b.y + 5, bubbles: true, pointerId: 7 }));
    await new Promise(x => setTimeout(x, 400));
    return { id, w0, w1: parseFloat(col.style.width) };
  });
  rec('резайзер работает в прилипшей шапке', !rz.err && rz.w1 > rz.w0 + 40, JSON.stringify(rz));

  /* 5. снятие закрепления */
  await page.evaluate(() => { const w = document.querySelector('#main .tbl-scroll'); w.scrollTop = 0; w.scrollLeft = 0; w.dispatchEvent(new Event('scroll')); });
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
