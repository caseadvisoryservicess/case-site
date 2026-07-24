/* CASE OS v4.44.0 — надёжность сохранений (backend-режим на мок-сервере):
   1) базовое сохранение правки юнита доходит до сервера;
   2) истёкшая сессия: экран входа с счётчиком несохранённого, правки НЕ теряются;
   3) после повторного входа очередь дозаливается автоматически;
   4) 403 (нет прав): тревожный тост, без бесконечных повторов;
   5) один горизонтальный ползунок (не два);
   6) keepalive-пинг существует.
   Запуск: node v4440_reliability.js /path/to/os */
'use strict';
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend');
const path = require('path');
const OS_DIR = path.resolve(process.argv[2] || '.');
const results = [];
const rec = (n, ok, i) => { results.push({ test: n, status: ok ? 'PASS' : 'FAIL', ...(i ? { info: String(i).slice(0, 300) } : {}) }); if (!ok) process.exitCode = 1; };

(async () => {
  const seed = {
    OBJECTS: [{ id: 'ca', name: 'Creative Avenue', floors: 2 }],
    U: [
      { id: 'u1', obj: 'ca', code: 'T1_1', floor: '1 этаж', area: 50, terr: 0, cat: 'Услуги', sub: '', rate: 10, budget: 12, status: 'vac', broker: '', vars: [], comments: [], hist: [], dates: [] },
      { id: 'u2', obj: 'ca', code: 'T1_2', floor: '1 этаж', area: 70, terr: 0, cat: 'Услуги', sub: '', rate: 8, budget: 9, status: 'vac', broker: '', vars: [], comments: [], hist: [], dates: [] },
    ],
  };
  const { srv, base, state } = await createMockServer(OS_DIR, { initialState: seed });
  const ctl = async (page, body) => page.evaluate(async b => { await fetch('/__ctl', { method: 'POST', body: JSON.stringify(b) }); }, body);
  const inspect = async page => page.evaluate(async () => (await fetch('/__inspect')).json());

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));

  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const entered = await page.evaluate(() => ({ backend: BACKEND, user: S.user && S.user.name, appVisible: !document.getElementById('app').classList.contains('hidden') }));
  rec('backend: авто-вход по живой сессии', entered.backend && entered.appVisible, JSON.stringify(entered));

  /* 1. базовая правка юнита доходит до сервера */
  await page.evaluate(() => { S.obj = 'ca'; go('registry'); });
  await page.waitForTimeout(900);
  await page.evaluate(() => saveCellLive('u1', 'budget', '15'));
  await page.waitForTimeout(1500);
  let insp = await inspect(page);
  const gotPatch = insp.unitPatches.some(p => p.id === 'u1' && p.changes && +p.changes.budget === 15);
  rec('правка юнита дошла до сервера (unit_patch)', gotPatch, JSON.stringify(insp.unitPatches).slice(0, 200));

  /* 2. сессия истекла: правка не теряется, экран входа с счётчиком */
  await ctl(page, { sessionValid: false });
  await page.evaluate(() => saveCellLive('u2', 'rate', '22'));
  await page.waitForTimeout(1600);
  const expired = await page.evaluate(() => ({
    loginShown: !document.getElementById('login').classList.contains('hidden'),
    msg: (document.getElementById('l_hint') || {}).textContent || '',
    queued: typeof caseUnsyncedCount === 'function' ? caseUnsyncedCount() : -1,
  }));
  rec('истёкшая сессия: показан вход', expired.loginShown, JSON.stringify(expired));
  rec('истёкшая сессия: сообщение про несохранённые правки', /несохранённые правки \(\d+\)/.test(expired.msg), expired.msg);
  rec('истёкшая сессия: правка осталась в очереди', expired.queued >= 1, 'в очереди: ' + expired.queued);

  /* 3. повторный вход: очередь дозаливается автоматически */
  await ctl(page, { sessionValid: true });
  await page.evaluate(() => { document.getElementById('lemail').value = 'h@caseadvisory.uz'; document.getElementById('lpass').value = 'x'.repeat(10); doLogin(); });
  await page.waitForTimeout(2500);
  insp = await inspect(page);
  const resumed = insp.unitPatches.some(p => p.id === 'u2' && p.changes && +p.changes.rate === 22);
  const backIn = await page.evaluate(() => ({ appVisible: !document.getElementById('app').classList.contains('hidden'), queued: caseUnsyncedCount() }));
  rec('после входа: приложение открыто', backIn.appVisible, JSON.stringify(backIn));
  rec('после входа: отложенная правка ДОЗАЛИТА на сервер (rate=22)', resumed, JSON.stringify(insp.unitPatches.slice(-2)).slice(0, 250));
  rec('после входа: очередь пуста', backIn.queued === 0, backIn.queued);

  /* 4. 403 (нет прав): тревога и никаких вечных повторов */
  await ctl(page, { failMode: 'reject-units' });
  const patchesBefore = (await inspect(page)).unitPatches.length;
  await page.evaluate(() => { go('registry'); });
  await page.waitForTimeout(600);
  const toast403 = await page.evaluate(async () => {
    saveCellLive('u1', 'budget', '99');
    await new Promise(r => setTimeout(r, 1500));
    return { toasts: [...document.querySelectorAll('#toastBox div')].map(x => x.textContent), queued: caseUnsyncedCount() };
  });
  await page.waitForTimeout(6000); // ждём: не должно быть повторов
  const patchesAfter = (await inspect(page)).unitPatches.length;
  rec('403: показан тревожный тост «Сервер отклонил…»', toast403.toasts.some(t => /Сервер отклонил/.test(t)), JSON.stringify(toast403.toasts));
  rec('403: очередь очищена, вечных повторов нет', toast403.queued === 0 && patchesAfter === patchesBefore, 'queued=' + toast403.queued);
  await ctl(page, { failMode: null });

  /* 5. один горизонтальный ползунок */
  await page.evaluate(() => go('registry'));
  await page.waitForTimeout(1500);
  const strips = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#main .tbl-scroll').forEach(sc => {
      let n = 0, x = sc.previousElementSibling;
      while (x) { if (x.classList && x.classList.contains('tbl-scroll')) break; if (x.classList && x.classList.contains('tbl-scroll-top')) n++; x = x.previousElementSibling; }
      out.push(n);
    });
    return out;
  });
  rec('горизонтальный ползунок один на таблицу', strips.length > 0 && strips.every(n => n <= 1), JSON.stringify(strips));

  /* 6. keepalive-пинг заведён (статически) */
  const src = require('fs').readFileSync(path.join(OS_DIR, 'index.html'), 'utf8');
  rec('keepalive: пинг auth.php каждые 5 минут в коде', /keepalive/.test(src) && /5\*60\*1000/.test(src));
  rec('сервер: сессия 12 часов', /gc_maxlifetime', '43200'/.test(require('fs').readFileSync(path.join(OS_DIR, 'api/lib.php'), 'utf8')));

  const realErr = errs.filter(e => !/favicon|Failed to load/.test(e));
  rec('нет JS-ошибок', realErr.length === 0, realErr.slice(0, 3).join(' | '));

  console.log(JSON.stringify({ summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1));
  await browser.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
