/* CASE OS v4.46.1 — фоновая синхронизация без лишней перерисовки (мок-бэкенд):
   1) чужой раздел изменился на сервере → текущая таблица НЕ перерисовывается, позиция цела;
   2) свой раздел изменился → строка обновляется, прокрутка восстанавливается;
   3) пользователь занят (ввод в поле) → опрос не вмешивается; после — применяется;
   4) недавняя локальная правка (persist) → isUserBusy до 2.5с;
   5) сохранение карточки идёт через CASE_LIVE_SYNC (точечный ререндер);
   6) статика: sw кэш v4461 + модуль в ASSETS.
   Запуск: node v4461_poll_sync.js /path/to/os */
'use strict';
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend');
const path = require('path');
const fs = require('fs');
const OS_DIR = path.resolve(process.argv[2] || '.');
const results = [];
const rec = (n, ok, i) => { results.push({ test: n, status: ok ? 'PASS' : 'FAIL', ...(i ? { info: String(i).slice(0, 300) } : {}) }); if (!ok) process.exitCode = 1; };

(async () => {
  const seedUnits = [
    { id: 'u1', obj: 'ca', code: 'T1_1', floor: '1 этаж', area: 50, terr: 0, cat: 'Услуги', sub: '', rate: 10, budget: 12, status: 'vac', broker: '', vars: [], comments: [], hist: [], dates: [] },
    { id: 'u2', obj: 'ca', code: 'T1_2', floor: '1 этаж', area: 70, terr: 0, cat: 'Услуги', sub: '', rate: 8, budget: 9, status: 'vac', broker: '', vars: [], comments: [], hist: [], dates: [] },
  ];
  const seed = { OBJECTS: [{ id: 'ca', name: 'Creative Avenue', floors: 2 }], U: seedUnits };
  const { srv, base, state } = await createMockServer(OS_DIR, { initialState: seed });
  const ctl = async (page, body) => page.evaluate(async b => { await fetch('/__ctl', { method: 'POST', body: JSON.stringify(b) }); }, body);
  const serverChange = async (page, mut, at) => {
    // меняем состояние на сервере «чужой рукой»: свежие data + новый updated_at
    const data = JSON.parse(JSON.stringify(state.appState.data)); mut(data);
    await ctl(page, { appState: { data, revision: state.appState.revision + 1, updatedAt: at }, updatedBy: 'Коллега' });
  };

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { S.obj = 'ca'; go('registry'); });
  await page.waitForTimeout(900);

  const prep = await page.evaluate(() => {
    const sc = document.querySelector('#main .tbl-scroll'); sc.scrollLeft = 150;
    const tb = document.querySelector('#main table'); tb.dataset.qaMarker = 'keep';
    return { backend: BACKEND, live: !!window.CASE_LIVE_SYNC, scrollable: sc.scrollWidth > sc.clientWidth, left: sc.scrollLeft };
  });
  rec('подготовка: backend + CASE_LIVE_SYNC активен, таблица прокручиваема', prep.backend && prep.live && prep.scrollable && prep.left > 0, JSON.stringify(prep));

  /* 1. чужой раздел (CHAT) изменился → таблица НЕ перерисована, позиция цела */
  await serverChange(page, d => { d.CHAT = [{ id: 'c1', t: 'привет', by: 'Коллега' }]; }, '2026-07-25 09:00:00');
  const r1 = await page.evaluate(async () => {
    _lastLocalMutationAt = 0; document.activeElement && document.activeElement.blur();
    await pollServerState(); await new Promise(r => setTimeout(r, 700));
    const sc = document.querySelector('#main .tbl-scroll'), tb = document.querySelector('#main table');
    return { marker: tb.dataset.qaMarker || '', left: sc.scrollLeft, chatLen: (CHAT || []).length };
  });
  rec('чужое изменение (чат): экран НЕ перерисован (маркер на месте)', r1.marker === 'keep', JSON.stringify(r1));
  rec('чужое изменение: горизонтальная позиция таблицы цела (150)', r1.left === 150, r1.left);
  rec('чужое изменение: данные всё же применены (чат обновился)', r1.chatLen === 1, r1.chatLen);

  /* 2. свой раздел (U) изменился → строка обновилась, прокрутка восстановлена */
  await serverChange(page, d => { d.U.find(u => u.id === 'u1').budget = 77; }, '2026-07-25 09:05:00');
  const r2 = await page.evaluate(async () => {
    _lastLocalMutationAt = 0;
    await pollServerState(); await new Promise(r => setTimeout(r, 800));
    const sc = document.querySelector('#main .tbl-scroll'), tb = document.querySelector('#main table');
    return { marker: tb.dataset.qaMarker || '', left: sc.scrollLeft, budget: U.find(u => u.id === 'u1').budget, shown: tb.textContent.includes('77') };
  });
  rec('своё изменение (ЛСР): таблица перерисована с новым значением', r2.marker === '' && r2.budget === 77 && r2.shown, JSON.stringify(r2));
  rec('своё изменение: горизонтальная позиция восстановлена (150)', r2.left === 150, r2.left);

  /* 3. пользователь вводит данные → опрос не вмешивается; после снятия фокуса — применяется */
  await serverChange(page, d => { d.U.find(u => u.id === 'u1').budget = 88; }, '2026-07-25 09:10:00');
  const r3 = await page.evaluate(async () => {
    const inp = document.querySelector('#main input'); if (inp) inp.focus();
    _lastLocalMutationAt = 0;
    await pollServerState(); await new Promise(r => setTimeout(r, 400));
    const busyKept = U.find(u => u.id === 'u1').budget === 77;
    document.activeElement && document.activeElement.blur();
    _lastLocalMutationAt = 0;
    await pollServerState(); await new Promise(r => setTimeout(r, 700));
    return { busyKept, after: U.find(u => u.id === 'u1').budget, hadInput: !!inp };
  });
  rec('во время ввода: опрос не вмешался', r3.hadInput && r3.busyKept, JSON.stringify(r3));
  rec('после ввода: изменение применилось (88)', r3.after === 88, r3.after);

  /* 4. недавняя локальная правка блокирует опрос до 2.5с */
  const r4 = await page.evaluate(() => { persist(); const busy = isUserBusy(); _lastLocalMutationAt = 0; return { busy, freeNow: !isUserBusy() }; });
  rec('persist() → isUserBusy() ≈2.5с (гонка локальной правки и опроса закрыта)', r4.busy && r4.freeNow, JSON.stringify(r4));

  /* 5. сохранение карточки: точечный ререндер через CASE_LIVE_SYNC с сохранением позиции */
  const r5 = await page.evaluate(async () => {
    const sc = document.querySelector('#main .tbl-scroll'); sc.scrollLeft = 150;
    openUnit('u2'); await new Promise(r => setTimeout(r, 300));
    const btn = [...document.getElementById('drawer').querySelectorAll('button')].find(b => /Редактировать помещение/.test(b.textContent));
    if (btn) { btn.click(); await new Promise(r => setTimeout(r, 300)); }
    const e = document.getElementById('e_budget'); if (!e) return { err: 'нет e_budget' };
    e.value = '55'; unitSave('u2'); await new Promise(r => setTimeout(r, 700));
    const tb = document.querySelector('#main table');
    const left = document.querySelector('#main .tbl-scroll').scrollLeft;
    closeDrawer();
    return { budget: U.find(u => u.id === 'u2').budget, shown: tb.textContent.includes('55'), left };
  });
  rec('карточка: сохранение сразу в таблице (55) с позицией 150', !r5.err && r5.budget === 55 && r5.shown && r5.left === 150, JSON.stringify(r5));

  /* 6. статика: sw кэш соответствует APP_VERSION + live-sync в ASSETS */
  const sw = fs.readFileSync(path.join(OS_DIR, 'sw.js'), 'utf8');
  const appV = (fs.readFileSync(path.join(OS_DIR, 'index.html'), 'utf8').match(/APP_VERSION='([\d.]+)'/) || [])[1] || '';
  const expCache = 'case-os-v' + appV.replace(/\./g, '');
  rec('sw.js: кэш ' + expCache + ' и v4451-live-sync.js в ASSETS', sw.includes(expCache) && /v4451-live-sync\.js/.test(sw), expCache);

  const realErr = errs.filter(e => !/favicon|Failed to load/.test(e));
  rec('нет JS-ошибок', realErr.length === 0, realErr.slice(0, 3).join(' | '));
  console.log(JSON.stringify({ summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1));
  await browser.close(); srv.close();
})().catch(e => { console.error('FATAL', e); process.exit(2); });
