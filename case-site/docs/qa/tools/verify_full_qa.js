/* CASE OS v4.33.0 — полный браузерный QA (Playwright + локальный статик-сервер, ?demo=1).
   Запуск: node verify_full_qa.js /path/to/os
   Поднимает http://127.0.0.1:PORT из папки os/, входит в демо-режим, проверяет смоук всех
   основных экранов и P0-1 (снапшоты версий планировок + генерация LCR из снапшота). */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || '.');
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv', '.xlsx': 'application/octet-stream', '.pdf': 'application/pdf' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end('404'); return; } /* демо-хостинг без PHP: api/ не исполняется */
      const f = path.join(OS_DIR, p);
      if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('404'); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const results = [];
function rec(name, okv, extra) { results.push({ test: name, status: okv ? 'PASS' : 'FAIL', ...(extra ? { info: extra } : {}) }); if (!okv) process.exitCode = 1; }

(async () => {
  /* статические проверки версии релиза */
  const idx = (function(){var i=fs.readFileSync(path.join(OS_DIR,'index.html'),'utf8');var c=path.join(OS_DIR,'core.js');return i+(fs.existsSync(c)?fs.readFileSync(c,'utf8'):'');})(); /* v4.49: index.html + core.js */
  const sw = fs.readFileSync(path.join(OS_DIR, 'sw.js'), 'utf8');
  const appVer = (idx.match(/const APP_VERSION='([^']+)'/) || [])[1];
  rec('static: APP_VERSION задан (x.y.z)', !!appVer && /^\d+\.\d+\.\d+$/.test(appVer), appVer);
  const cacheKey = 'case-os-v' + String(appVer || '').replace(/\./g, '');
  rec('static: sw.js кэш соответствует APP_VERSION', sw.includes("CACHE = '" + cacheKey + "'"), cacheKey);
  rec('static: v417-master-plan подключён с cache-busting ?v=', /v417-master-plan\.js\?v=\d+\.\d+\.\d+/.test(idx));
  rec('static: P0-1 ядро в index.html (planSnapshotBuild)', idx.includes('function planSnapshotBuild('));
  rec('static: PLAN_SNAPSHOT_SVGS в stateBlob', /stateBlob\(\)\{return \{[^}]*PLAN_SNAPSHOT_SVGS/.test(idx));
  rec('static: PLAN_SNAPSHOT_SVGS в _HEAVY_LOCAL_KEYS', /_HEAVY_LOCAL_KEYS=\[[^\]]*'PLAN_SNAPSHOT_SVGS'/.test(idx));

  const srv = await serve();
  const port = srv.address().port;
  const base = 'http://127.0.0.1:' + port;

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));

  /* 1. загрузка и демо-вход */
  const resp = await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
  rec('boot: страница отвечает 200', !!resp && resp.status() === 200, String(resp && resp.status()));
  await page.waitForTimeout(1200);
  rec('boot: экран входа показан', await page.evaluate(() => !document.getElementById('login').classList.contains('hidden')));
  const roles = await page.evaluate(() => Array.from(document.getElementById('luser').options).map(o => o.value));
  rec('boot: в демо-режиме доступен выбор ролей', roles.length > 3, roles.length + ' ролей');
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = s.options[0].value; doLogin(); });
  await page.waitForTimeout(800);
  rec('boot: вход выполнен, приложение видно', await page.evaluate(() => !document.getElementById('app').classList.contains('hidden')));
  const verLabel = await page.evaluate(() => (document.getElementById('appVer') || {}).textContent || '');
  rec('boot: шапка показывает DEMO · v' + appVer, verLabel.includes('v' + appVer) && verLabel.includes('DEMO'), verLabel);

  /* 2. смоук навигации по основным экранам */
  const views = ['dash', 'registry', 'plans', 'plan_master', 'brands', 'docs', 'audit'];
  for (const v of views) {
    const okv = await page.evaluate(async vv => {
      try { go(vv); await new Promise(r => setTimeout(r, 250)); const m = document.getElementById('main'); return !!(m && m.innerHTML.length > 200); }
      catch (e) { return false; }
    }, v);
    rec('nav: экран «' + v + '» рендерится', okv);
  }

  /* 3. P0-1: снапшоты версий и генерация LCR в реальном приложении */
  const p01 = await page.evaluate(async () => {
    const out = {};
    const pid = S.obj !== 'ALL' && S.obj ? S.obj : (OBJECTS[0] && OBJECTS[0].id);
    S.obj = pid;
    const U0 = U.filter(u => u.obj === pid).length;
    /* подготовка: тестовый «чертёж» проекта */
    PLAN_CODES[pid + '::QA-Т::99 этаж'] = [{ code: 'QA-901', area: 111 }, { code: 'QA-902', area: 55 }];
    PLANSVG[pid + '::QA-Т::99 этаж'] = '<svg id="qa">тест</svg>';
    out.checksumA = planCurrentChecksum(pid);
    /* версия из текущего чертежа */
    const v1 = planVersionForCurrent(pid);
    out.v1HasSnapshot = !!(v1.snapshot && v1.snapshot.checksum === out.checksumA);
    out.v1Frozen = Object.isFrozen(v1.snapshot) && Object.isFrozen(v1.snapshot.planCodes);
    out.svgStored = Object.values(PLAN_SNAPSHOT_SVGS).includes('<svg id="qa">тест</svg>');
    /* дрейф чертежа */
    PLAN_CODES[pid + '::QA-Т::99 этаж'] = [{ code: 'QA-901', area: 999 }, { code: 'QA-903', area: 77 }];
    out.checksumB = planCurrentChecksum(pid);
    out.snapshotSurvivedDrift = v1.snapshot.checksum === out.checksumA && v1.snapshot.planCodes[pid + '::QA-Т::99 этаж'][0].area === 111;
    /* генерация из снапшота v1 — должна создать юниты плана A, а не B */
    masterLcrApply(pid, { versionId: v1.id });
    const created = U.filter(u => u.obj === pid && u.layoutVersionId === v1.id);
    out.gen901 = created.some(u => u.code === 'QA-901' && u.area === 111);
    out.gen902 = created.some(u => u.code === 'QA-902');
    out.no903 = !U.some(u => u.obj === pid && u.code === 'QA-903');
    out.stamped = created.every(u => u.snapshotChecksum === v1.snapshot.checksum);
    /* новая версия из нового чертежа и генерация из неё */
    const v2 = planVersionForCurrent(pid);
    out.v2New = v2.id !== v1.id && v2.active === true && v1.active === false;
    masterLcrApply(pid, { versionId: v2.id });
    const u901 = U.find(u => u.obj === pid && u.code === 'QA-901');
    out.gen903 = U.some(u => u.obj === pid && u.code === 'QA-903' && u.layoutVersionId === v2.id);
    out.area901Updated = u901 && u901.area === 999 && u901.layoutVersionId === v2.id;
    /* сериализация: снапшот в stateBlob и заморозка после applyState */
    const blob = JSON.parse(JSON.stringify(stateBlob()));
    out.blobHasSnapshotStore = !!blob.PLAN_SNAPSHOT_SVGS;
    out.blobHasVersions = Array.isArray(blob.CASE_LAYOUT_VERSIONS) && blob.CASE_LAYOUT_VERSIONS.some(v => v.snapshot && v.snapshot.checksum === out.checksumA);
    applyState(blob);
    const reloaded = CASE_LAYOUT_VERSIONS.find(v => v.id === v1.id);
    out.frozenAfterApplyState = !!(reloaded && reloaded.snapshot && Object.isFrozen(reloaded.snapshot));
    /* UI мастер-модуля */
    go('plan_master'); await new Promise(r => setTimeout(r, 200));
    masterTab('versions'); await new Promise(r => setTimeout(r, 200));
    const mainHtml = document.getElementById('main').innerHTML;
    out.uiSnapshotShown = mainHtml.includes('🔒') && mainHtml.includes('Снапшот');
    masterTab('lcr'); await new Promise(r => setTimeout(r, 200));
    out.uiLcrSelector = document.getElementById('main').innerHTML.includes('Версия-источник');
    /* очистка тестовых данных */
    delete PLAN_CODES[pid + '::QA-Т::99 этаж']; delete PLANSVG[pid + '::QA-Т::99 этаж'];
    for (let i = U.length - 1; i >= 0; i--) if (U[i].obj === pid && /^QA-9/.test(U[i].code)) U.splice(i, 1);
    out.cleanupOk = U.filter(u => u.obj === pid).length === U0;
    return out;
  });
  rec('P0-1: версия получает снапшот текущего чертежа', p01.v1HasSnapshot);
  rec('P0-1: снапшот глубоко заморожен', p01.v1Frozen);
  rec('P0-1: SVG чертежа сохранён в дедуп-хранилище', p01.svgStored);
  rec('P0-1: изменение чертежа не меняет снапшот (drift)', p01.snapshotSurvivedDrift, p01.checksumA + ' ≠ ' + p01.checksumB);
  rec('P0-1: генерация LCR создаёт юниты ИЗ СНАПШОТА (площадь 111, не 999)', p01.gen901 && p01.gen902);
  rec('P0-1: юниты нового чертежа НЕ создаются из старого снапшота', p01.no903);
  rec('P0-1: юниты проштампованы layoutVersionId + snapshotChecksum', p01.stamped);
  rec('P0-1: новый чертёж ⇒ новая активная версия', p01.v2New);
  rec('P0-1: генерация из новой версии применяет новый чертёж', p01.gen903 && p01.area901Updated);
  rec('P0-1: снапшоты и SVG-хранилище сериализуются в stateBlob', p01.blobHasSnapshotStore && p01.blobHasVersions);
  rec('P0-1: applyState замораживает загруженные снапшоты', p01.frozenAfterApplyState);
  rec('P0-1 UI: вкладка «Версии» показывает 🔒 снапшоты', p01.uiSnapshotShown);
  rec('P0-1 UI: вкладка «Генерация LCR» показывает выбор версии-источника', p01.uiLcrSelector);
  rec('P0-1: тестовые данные вычищены', p01.cleanupOk);

  /* 4. персист в demo-режиме */
  const persistOk = await page.evaluate(() => { try { tryPersist(); return !!localStorage.getItem(STORAGE_KEY); } catch (e) { return false; } });
  rec('persist: tryPersist сохраняет состояние в demo-режиме', persistOk);

  /* 5. ошибки страницы */
  rec('console: нет необработанных ошибок страницы', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();

  const pass = results.filter(r => r.status === 'PASS').length;
  const out = { suite: 'CASE OS v4.33.0 · full QA (browser, ?demo=1)', date: '2026-07-24',
    env: 'playwright-core + chromium (' + CHROME + '), static http 127.0.0.1', total: results.length, pass, fail: results.length - pass, results };
  console.log(JSON.stringify(out, null, 2));
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
