/* CASE OS — ролевой QA (браузер, ?demo=1): вход под КАЖДОЙ ролью, проверка меню и запретных экранов.
   Запуск: node role_access_qa.js /path/to/os */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || '.');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.geojson': 'application/json', '.csv': 'text/csv' };
const results = [];
function rec(name, ok, extra) { results.push({ test: name, status: ok ? 'PASS' : 'FAIL', ...(extra ? { info: extra } : {}) }); if (!ok) process.exitCode = 1; }

const srv = http.createServer((req, rsp) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
  rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rsp);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e).slice(0, 160)));
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  const roles = await page.evaluate(() => Array.from(document.getElementById('luser').options).map(o => o.value));
  rec('демо: список ролей получен', roles.length >= 5, roles.join(','));

  for (const role of roles) {
    const r = await page.evaluate(async rl => {
      /* вход под ролью (или переключение) */
      try { if (S.user) logout(); } catch (e) {}
      await new Promise(rs => setTimeout(rs, 120));
      const s = document.getElementById('luser'); s.value = rl; doLogin();
      await new Promise(rs => setTimeout(rs, 350));
      const out = { role: rl, rights: null, navBad: [], probe: {}, appVisible: false, navCount: 0 };
      out.appVisible = !document.getElementById('app').classList.contains('hidden');
      if (!out.appVisible) return out;
      out.rights = { admin: !!R().admin, edit: !!R().edit, external: !!R().external, brandsOnly: !!R().brandsOnly };
      /* 1) каждый пункт меню обязан проходить canOpen роли */
      const links = Array.from(document.querySelectorAll('#nav a[data-v]'));
      out.navCount = links.length;
      links.forEach(a => {
        const v = a.dataset.v;
        try { if (typeof asaasWorkspaceCanOpen === 'function' && !asaasWorkspaceCanOpen(v)) out.navBad.push(v); } catch (e) {}
      });
      /* 2) запретные экраны: прямой go() не должен оставить роль на админ-экране */
      for (const v of ['users', 'admin_modules', 'admin_system']) {
        try {
          go(v); await new Promise(rs => setTimeout(rs, 200));
          const html = (document.getElementById('main') || {}).innerHTML || '';
          out.probe[v] = { landed: S.view, guarded: S.view !== v || /администратор|Только для/i.test(html) || out.rights.admin };
        } catch (e) { out.probe[v] = { landed: 'error', guarded: false }; }
      }
      /* 3) спец-роли */
      if (out.rights.external) {
        out.probe.externalNav = { guarded: !links.some(a => ['map', 'bench'].indexOf(a.dataset.v) >= 0) };
      }
      if (out.rights.brandsOnly) {
        out.probe.brandsOnlyNav = { guarded: links.every(a => a.dataset.v === 'brands') };
      }
      try { go('dash'); } catch (e) {}
      return out;
    }, role);

    if (!r.appVisible) { rec('роль ' + role + ': вход', false, 'app не показался'); continue; }
    rec('роль ' + role + ': вход выполнен, меню ' + r.navCount + ' пунктов', r.navCount > 0);
    rec('роль ' + role + ': все пункты меню разрешены её workspace', r.navBad.length === 0, r.navBad.join(','));
    for (const v of ['users', 'admin_modules', 'admin_system']) {
      const p = r.probe[v] || {};
      rec('роль ' + role + ': «' + v + '» ' + (r.rights.admin ? 'доступен админу' : 'закрыт'), !!p.guarded, 'landed=' + p.landed);
    }
    if (r.probe.externalNav) rec('роль ' + role + ' (внешний агент): map/bench скрыты', r.probe.externalNav.guarded);
    if (r.probe.brandsOnlyNav) rec('роль ' + role + ' (только бренды): в меню только «brands»', r.probe.brandsOnlyNav.guarded);
  }

  rec('console: нет ошибок страницы за весь прогон', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  await browser.close(); srv.close();
  const pass = results.filter(r => r.status === 'PASS').length;
  console.log(JSON.stringify({ suite: 'CASE OS role access QA (browser, все роли)', date: '2026-07-24', total: results.length, pass, fail: results.length - pass, results }, null, 2));
  process.exit(pass === results.length ? 0 : 1);
});
