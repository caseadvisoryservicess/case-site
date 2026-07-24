/* CASE OS v4.42.0 — сценарные проверки релиза:
   1) «Версии планировок» не сворачивает меню (+ 6 регрессионных сценариев аккордеона)
   2) страница «Пользователи»: права ролей внутри карточки матрицы, отдельной таблицы нет
   3) таблицы data-grid растянуты на ширину карточки
   4) миграция BRJ: сохранённый шаблон роли дополняется гео/брендами
   5) мини-тест: бейдж справа над чатом, скрыт на мобильной ширине; AGX external
   Запуск: node v4420_scenarios.js /path/to/os */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || '.');
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv', '.xlsx': 'application/octet-stream' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end('404'); return; }
      const f = path.join(OS_DIR, p);
      if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('404'); return; }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}
const results = [];
function rec(name, okv, extra) { results.push({ test: name, status: okv ? 'PASS' : 'FAIL', ...(extra ? { info: String(extra).slice(0, 300) } : {}) }); if (!okv) process.exitCode = 1; }

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  async function login(role) {
    await page.evaluate(rl => { const s = document.getElementById('luser'); s.value = rl; doLogin(); }, role);
    await page.waitForTimeout(400);
  }

  await page.goto(base + '/index.html?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await login('ASH');

  /* ---------- 1. Меню: «Версии планировок» ---------- */
  const nav0 = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('#nav .nav-group')];
    return { n: groups.length, open: groups.filter(g => g.classList.contains('open')).length };
  });
  rec('nav: группы построены', nav0.n >= 5, 'групп: ' + nav0.n);

  // открыть постороннюю группу (последнюю), затем клик по «Версии планировок»
  const menuRes = await page.evaluate(() => {
    const groups = [...document.querySelectorAll('#nav .nav-group')];
    const planA = document.querySelector('#nav a[data-v="plan_master"]');
    if (!planA) return { err: 'нет пункта plan_master' };
    const planG = planA.closest('.nav-group');
    const other = groups.find(g => g !== planG && !g.classList.contains('open'));
    if (other) other.querySelector('.nav-group-btn').click();
    const openedBefore = groups.filter(g => g.classList.contains('open')).length;
    planA.click(); // caseNavGo → go('plan_master') → v417 go-обёртка (ранний return + caseNavSync)
    const openAfter = groups.filter(g => g.classList.contains('open')).length;
    return {
      openedBefore, openAfter,
      planOpen: planG.classList.contains('open'),
      planActive: planG.classList.contains('has-active'),
      activeV: (document.querySelector('#nav a.active') || {}).dataset ? document.querySelector('#nav a.active').dataset.v : '',
      otherStillOpen: other ? other.classList.contains('open') : true,
      view: (typeof S !== 'undefined' && S.view) || ''
    };
  });
  rec('nav: клик «Версии планировок» — меню НЕ свернулось', !menuRes.err && menuRes.openAfter >= menuRes.openedBefore, JSON.stringify(menuRes));
  rec('nav: группа «Версий планировок» открыта и активна', menuRes.planOpen && menuRes.planActive && menuRes.activeV === 'plan_master' && menuRes.view === 'plan_master');
  rec('nav: посторонняя открытая группа осталась открытой', menuRes.otherStillOpen);

  /* 6 регрессионных сценариев аккордеона */
  const acc = await page.evaluate(() => {
    const out = {};
    const groups = () => [...document.querySelectorAll('#nav .nav-group')];
    const openN = () => groups().filter(g => g.classList.contains('open')).length;
    const gA = groups().find(g => g.classList.contains('has-active'));
    const gB = groups().find(g => g !== gA && !g.classList.contains('open')) || groups().find(g => g !== gA);
    // 1: открыть чужую группу — активная не закрылась
    gB.querySelector('.nav-group-btn').click();
    out.s1 = gB.classList.contains('open') && gA.classList.contains('open');
    // 2: повторный клик — закрылась только она
    gB.querySelector('.nav-group-btn').click();
    out.s2 = !gB.classList.contains('open') && gA.classList.contains('open');
    // 3: переход в другой раздел — его группа открыта, счётчик открытых не уменьшился
    gB.querySelector('.nav-group-btn').click();
    const before = openN();
    const link = gB.querySelector('a[data-v]');
    link.click();
    out.s3 = gB.classList.contains('has-active') && openN() >= before;
    // 4: перерисовка того же экрана — меню не тронуто
    const snap = groups().map(g => g.classList.contains('open')).join(',');
    go(S.view);
    out.s4 = groups().map(g => g.classList.contains('open')).join(',') === snap;
    // 5: устаревший caseNavClose — no-op
    const beforeClose = openN();
    caseNavClose();
    out.s5 = openN() === beforeClose;
    // 6: caseNavSync — has-active только у группы активного пункта
    caseNavSync();
    out.s6 = groups().filter(g => g.classList.contains('has-active')).length === 1;
    return out;
  });
  for (const k of Object.keys(acc)) rec('nav: аккордеон сценарий ' + k, acc[k]);

  /* ---------- 2+3. «Пользователи»: карточка с правами, без отдельной таблицы; ширина таблиц ---------- */
  await page.evaluate(() => go('users'));
  await page.waitForTimeout(600);
  const users = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#main .card h3')].map(h => (h.textContent || '').trim());
    const ws = document.getElementById('wsAdminCard');
    const rights = ws ? [...ws.querySelectorAll('.ws-group-title')].map(x => x.textContent.trim()) : [];
    const rightBtns = ws ? ws.querySelectorAll('.ws-modules .ws-module').length : 0;
    const sepMatrix = cards.some(t => /^Права ролей/.test(t));
    const foot = document.querySelector('#main .foot');
    const wsBeforeFoot = ws && foot ? !!(ws.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING) : false;
    return { sepMatrix, hasWs: !!ws, rights, rightBtns, wsBeforeFoot, footText: foot ? foot.textContent.slice(0, 60) : '', appVer: (typeof APP_VERSION!=='undefined')?APP_VERSION:'' };
  });
  rec('users: отдельной таблицы «Права ролей» больше нет', !users.sepMatrix);
  rec('users: карточка доступа есть и содержит «Права на действия»', users.hasWs && users.rights.some(t => /Права на действия/.test(t)), JSON.stringify(users.rights));
  rec('users: тумблеров прав ≥ 9', users.rightBtns >= 9, users.rightBtns);
  rec('users: карточка стоит до нижней подписи', users.wsBeforeFoot);
  rec('users: footNote показывает текущую версию (APP_VERSION)', users.footText.includes(users.appVer||'@'), users.footText);

  // тумблер права: выключаем и возвращаем «Финансы» у роли BA
  const toggle = await page.evaluate(async () => {
    const before = !!ROLES.BA.finance;
    const btn = [...document.querySelectorAll('#wsAdminCard .ws-module')].find(b => /Финансы/.test(b.textContent));
    if (!btn) return { err: 'кнопка не найдена' };
    btn.click();
    await new Promise(r => setTimeout(r, 300));
    const mid = !!ROLES.BA.finance;
    const btn2 = [...document.querySelectorAll('#wsAdminCard .ws-module')].find(b => /Финансы/.test(b.textContent));
    btn2.click();
    await new Promise(r => setTimeout(r, 300));
    return { before, mid, after: !!ROLES.BA.finance };
  });
  rec('users: тумблер права работает (переключил и вернул)', !toggle.err && toggle.mid === !toggle.before && toggle.after === toggle.before, JSON.stringify(toggle));

  // ширины таблиц: на «Пользователи» и «Реестре» таблица не уже своей карточки
  async function tableFill(view) {
    await page.evaluate(v => go(v), view);
    await page.waitForTimeout(700);
    return page.evaluate(() => {
      const t = document.querySelector('#main table.case-grid') || document.querySelector('#main .tbl-scroll table');
      if (!t) return { skip: true };
      const wrap = t.closest('.tbl-scroll,.geo-table-wrap,.geo-obj-tblwrap') || t.parentElement;
      return { tw: Math.round(t.getBoundingClientRect().width), ww: Math.round(wrap.clientWidth) };
    });
  }
  const fUsers = await tableFill('users');
  rec('tables: «Пользователи» — таблица не уже карточки', fUsers.skip || fUsers.tw >= fUsers.ww - 4, JSON.stringify(fUsers));
  const fReg = await tableFill('registry');
  rec('tables: «Реестр» — таблица не уже карточки', fReg.skip || fReg.tw >= fReg.ww - 4, JSON.stringify(fReg));

  /* ---------- 4. Миграция BRJ ---------- */
  const seeded = await page.evaluate(() => {
    ROLE_WORKSPACES = { __caseSchema: 492, BRJ: ['dash', 'brands', 'work_tasks'] };
    persist();
    return JSON.parse(JSON.stringify(ROLE_WORKSPACES));
  });
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await login('ASH');
  const healed = await page.evaluate(() => ({
    schema: ROLE_WORKSPACES.__caseSchema,
    brj: (ROLE_WORKSPACES.BRJ || []).slice()
  }));
  rec('BRJ: миграция дополнила сохранённый шаблон (geoanalytics)', (healed.brj || []).includes('geoanalytics'), JSON.stringify(healed));
  rec('BRJ: registry и brands в шаблоне', healed.brj.includes('registry') && healed.brj.includes('brands'));
  rec('BRJ: схема поднята до 4420', +healed.schema >= 4420, healed.schema);
  // и меню младшего админа реально содержит гео/бренды
  await page.evaluate(() => { ROLE_WORKSPACES.__caseSchema = 4420;  });
  await page.evaluate(() => { try { logout(); } catch (e) { location.reload(); } });
  await page.waitForTimeout(700);
  const hasLogin = await page.evaluate(() => !!document.getElementById('luser'));
  if (!hasLogin) { await page.goto(base + '/index.html?demo=1', { waitUntil: 'networkidle' }); await page.waitForTimeout(500); }
  await login('BRJ');
  const brjMenu = await page.evaluate(() => [...document.querySelectorAll('#nav a[data-v]')].map(a => a.dataset.v));
  rec('BRJ: в меню младшего админа есть гео и бренды', brjMenu.includes('geoanalytics') && brjMenu.includes('brands') && brjMenu.includes('registry'), brjMenu.join(','));

  /* ---------- 5. Мини-тест ---------- */
  const quiz = await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<button id="quizPop" class="quizpop-badge">🎓</button>');
    const cs = getComputedStyle(document.getElementById('quizPop'));
    const chat = document.getElementById('chatFab');
    const ccs = chat ? getComputedStyle(chat) : null;
    return { right: cs.right, bottom: cs.bottom, left: cs.left, chatBottom: ccs ? ccs.bottom : '', agxExternal: !!(ROLES.AGX && ROLES.AGX.external) };
  });
  rec('quiz: бейдж справа (right 18px, bottom 86px)', quiz.right === '18px' && quiz.bottom === '86px', JSON.stringify(quiz));
  rec('quiz: не перекрывает кнопку чата (бейдж выше)', parseInt(quiz.bottom) > parseInt(quiz.chatBottom || '20') + 54 - 1, quiz.chatBottom);
  rec('quiz: AGX помечен как внешний (гейт по роли активен)', quiz.agxExternal);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForTimeout(200);
  const quizMob = await page.evaluate(() => getComputedStyle(document.getElementById('quizPop')).display);
  rec('quiz: на мобильной ширине бейдж скрыт', quizMob === 'none', quizMob);
  await page.evaluate(() => document.getElementById('quizPop').remove());
  await page.setViewportSize({ width: 1440, height: 900 });

  /* ---------- ошибки страницы ---------- */
  const realErr = errors.filter(e => !/favicon|404|Failed to load resource/.test(e));
  rec('нет JS-ошибок на страницах', realErr.length === 0, realErr.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();
  console.log(JSON.stringify({ summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1));
})().catch(e => { console.error('FATAL', e); process.exit(2); });
