/* CASE OS v4.46.2 — визуальная стабильность таблиц:
   1) контролы (селекты/инпуты) не выходят за границу столбца — ЛСР, включая узкие колонки;
   2) после точечной перерисовки (live-sync) таблица улучшена В ТОМ ЖЕ кадре — нет мигания «сырым» видом;
   3) тост «Данные обновлены» молчит для собственных правок (updated_by = я);
   4) у Администратора аренды (тыл, HO) есть «Столбцы» и «Вид» на таблицах ЛСР/брендов/корзины.
   Запуск: node v4462_visual.js /path/to/os */
'use strict';
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend');
const path = require('path'), fs = require('fs'), http = require('http');
const OS_DIR = path.resolve(process.argv[2] || '.');
const results = [];
const rec = (n, ok, i) => { results.push({ test: n, status: ok ? 'PASS' : 'FAIL', ...(i ? { info: String(i).slice(0, 300) } : {}) }); if (!ok) process.exitCode = 1; };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv' };

(async () => {
  /* ---------- часть А: demo-режим (оверфлоу + доступ HO) ---------- */
  const srvA = http.createServer((req, rsp) => { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html'; if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end(); return; } const f = path.join(OS_DIR, p); if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; } rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp); });
  await new Promise(r => srvA.listen(0, '127.0.0.1', r));
  const baseA = 'http://127.0.0.1:' + srvA.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  let page = await browser.newPage({ viewport: { width: 2000, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(baseA + '/index.html?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = 'ASH'; doLogin(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => go('registry'));
  await page.waitForTimeout(1200);

  /* 1. оверфлоу контролов в ЛСР (обычный + суженный столбец статуса) */
  const ov = await page.evaluate(async () => {
    const count = () => { let n = 0; document.querySelectorAll('#main table.case-grid').forEach(tb => { tb.querySelectorAll('tbody select,tbody input:not([type=checkbox])').forEach(el => { const r = el.getBoundingClientRect(), td = el.closest('td'); if (td && r.right - td.getBoundingClientRect().right > 1) n++; }); }); return n; };
    const before = count();
    // сузим столбец статуса до 90px через префы грида и переулучшим
    const tb = document.querySelector('#main table.case-grid');
    const key = tb.dataset.caseGridKey;
    const cg = tb.querySelector('colgroup');
    const last = cg.children[cg.children.length - 1]; last.style.width = '90px';
    if (window.case432EnhanceNow) case432EnhanceNow();
    await new Promise(r => setTimeout(r, 300));
    return { before, afterNarrow: count(), key };
  });
  rec('ЛСР: контролы не выходят за границу столбца', ov.before === 0, JSON.stringify(ov));
  rec('ЛСР: узкий столбец (90px) — селект зажат внутри', ov.afterNarrow === 0, JSON.stringify(ov));

  /* 2. синхронное улучшение после live-sync — нет кадра «сырой» таблицы */
  const sync = await page.evaluate(() => {
    CASE_LIVE_SYNC.withPreservedUi(() => { if (typeof renderRegistry === 'function') renderRegistry(); });
    // сразу же, ДО каких-либо таймеров/дебаунсов:
    const tb = document.querySelector('#main table');
    return { enhanced: !!(tb && tb.classList.contains('case-grid')), toolbar: !!document.querySelector('#main .case-grid-toolbar'), api: typeof window.case432EnhanceNow === 'function' };
  });
  rec('live-sync: таблица улучшена в том же кадре (case-grid сразу)', sync.api && sync.enhanced && sync.toolbar, JSON.stringify(sync));

  /* 3. HO (Администратор аренды — тыл): «Столбцы» и «Вид» доступны на основных таблицах */
  await page.evaluate(() => { logout(); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = 'HO'; doLogin(); });
  await page.waitForTimeout(600);
  for (const view of ['registry', 'brands', 'dates']) {
    await page.evaluate(v => go(v), view);
    await page.waitForTimeout(1000);
    const t = await page.evaluate(() => {
      const bars = [...document.querySelectorAll('#main .case-grid-toolbar')];
      if (!bars.length) return { none: true, tables: document.querySelectorAll('#main table').length };
      const b = bars[0];
      const cols = b.querySelector('[data-columns]'), viewB = b.querySelector('[data-view]');
      let panelOk = false;
      if (viewB) { viewB.click(); const p = document.querySelector('.case-grid-panel'); panelOk = !!(p && p.querySelector('[data-columns]') && p.querySelector('[data-unpin]')); const c = p && p.querySelector('[data-close]'); if (c) c.click(); }
      return { cols: !!cols, view: !!viewB, panelOk };
    });
    rec('HO «' + view + '»: кнопки «Столбцы» и «Вид» + полная панель', !t.none && t.cols && t.view && t.panelOk, JSON.stringify(t));
  }
  await page.close();

  /* ---------- часть Б: backend-режим (тост молчит на свои правки) ---------- */
  const seed = { OBJECTS: [{ id: 'ca', name: 'Creative Avenue', floors: 2 }], U: [
    { id: 'u1', obj: 'ca', code: 'T1_1', floor: '1 этаж', area: 50, terr: 0, cat: 'Услуги', sub: '', rate: 10, budget: 12, status: 'vac', broker: '', vars: [], comments: [], hist: [], dates: [] } ] };
  const { srv: srvB, base: baseB, state } = await createMockServer(OS_DIR, { initialState: seed });
  page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(baseB + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { S.obj = 'ca'; go('registry'); });
  await page.waitForTimeout(800);
  const selfName = await page.evaluate(() => S.user.name);
  // «свои» изменения: updated_by = я
  const dataSelf = JSON.parse(JSON.stringify(state.appState.data)); dataSelf.U[0].budget = 33;
  await page.evaluate(async b => { await fetch('/__ctl', { method: 'POST', body: JSON.stringify(b) }); }, { appState: { data: dataSelf, revision: 2, updatedAt: '2026-07-25 10:00:00' }, updatedBy: selfName });
  const t1 = await page.evaluate(async () => { _lastLocalMutationAt = 0; document.activeElement && document.activeElement.blur(); await pollServerState(); await new Promise(r => setTimeout(r, 400)); return { toasts: [...document.querySelectorAll('#toastBox div')].map(x => x.textContent), budget: U[0].budget }; });
  rec('свои правки (updated_by=я): тост «Данные обновлены» НЕ показан', t1.budget === 33 && !t1.toasts.some(t => /Данные обновлены/.test(t)), JSON.stringify(t1));
  // «чужие» изменения: updated_by = коллега
  const dataOther = JSON.parse(JSON.stringify(state.appState.data)); dataOther.U[0].budget = 44;
  await page.evaluate(async b => { await fetch('/__ctl', { method: 'POST', body: JSON.stringify(b) }); }, { appState: { data: dataOther, revision: 3, updatedAt: '2026-07-25 10:05:00' }, updatedBy: 'Коллега' });
  const t2 = await page.evaluate(async () => { _lastLocalMutationAt = 0; await pollServerState(); await new Promise(r => setTimeout(r, 400)); return { toasts: [...document.querySelectorAll('#toastBox div')].map(x => x.textContent), budget: U[0].budget }; });
  rec('чужие правки: тост показан', t2.budget === 44 && t2.toasts.some(t => /Данные обновлены/.test(t)), JSON.stringify(t2));

  const realErr = errs.filter(e => !/favicon|Failed to load/.test(e));
  rec('нет JS-ошибок', realErr.length === 0, realErr.slice(0, 3).join(' | '));
  console.log(JSON.stringify({ summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1));
  await browser.close(); srvA.close(); srvB.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
