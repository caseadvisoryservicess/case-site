/* CASE OS v4.42.0 — проверка контролов БЦ в гео-студии (mock-авторизация).
   Запуск: node v4420_studio_bc.js /path/to/os */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || '.');
const CHROME = process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      /* студия открывается только с авторизацией — мокаем auth + права рабочей области */
      if (p === '/api/auth.php') { rsp.writeHead(200, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify({ auth: true, user: { id: 'u1', name: 'QA', role_key: 'ASH', admin: true, edit: true }, csrf: 't' })); return; }
      if (p === '/api/workspace_access.php') { rsp.writeHead(200, { 'Content-Type': 'application/json' }); rsp.end(JSON.stringify({ allowed: true, can_edit: true })); return; }
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
function rec(name, okv, extra) { results.push({ test: name, status: okv ? 'PASS' : 'FAIL', ...(extra ? { info: String(extra).slice(0, 250) } : {}) }); if (!okv) process.exitCode = 1; }

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(base + '/geoanalytics-studio.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const ctl = await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    return {
      bcLS: !!$('bcLS'), bcClu: !!$('bcClu'), bcNa: !!$('bcNa'), bcLab: !!$('bcLab'),
      bcR: !!$('bcR'), bcO: !!$('bcO'), labZ: !!$('labZ'),
      lsMin: $('bcLS') && $('bcLS').min, lsMax: $('bcLS') && $('bcLS').max,
      cluster: typeof L !== 'undefined' && typeof L.markerClusterGroup === 'function',
      bcCount: (typeof BC !== 'undefined' && Array.isArray(BC)) ? BC.length : -1
    };
  });
  rec('БЦ: есть все контролы HORECA-набора (цвет/размер/прозр/подписи/размер подписи/кластеры)',
    ctl.bcNa && ctl.bcR && ctl.bcO && ctl.bcLab && ctl.bcLS && ctl.bcClu, JSON.stringify(ctl));
  rec('БЦ: диапазон размера подписи как у POI (8–20)', ctl.lsMin === '8' && ctl.lsMax === '20');
  rec('студия: markerClusterGroup доступен', ctl.cluster);
  rec('студия: данные БЦ загружены', ctl.bcCount > 0, 'BC: ' + ctl.bcCount);

  /* включаем кластеры → должны появиться кластер-иконки; выключаем → исчезнуть */
  const clu = await page.evaluate(async () => {
    const $ = id => document.getElementById(id);
    $('bcClu').checked = true; $('bcClu').dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 700));
    const withClu = document.querySelectorAll('.marker-cluster').length;
    $('bcClu').checked = false; $('bcClu').dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 700));
    const withoutClu = document.querySelectorAll('.marker-cluster').length;
    return { withClu, withoutClu };
  });
  rec('БЦ: кластеры включаются', clu.withClu > 0, JSON.stringify(clu));
  rec('БЦ: кластеры выключаются', clu.withoutClu === 0, JSON.stringify(clu));

  /* размер подписи применяется к стилю подписей БЦ */
  const lab = await page.evaluate(async () => {
    const $ = id => document.getElementById(id);
    $('bcLab').checked = true; $('bcLS').value = '18'; $('bcLS').dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 500));
    const st = document.getElementById('labStyle');
    return st ? st.textContent : '';
  });
  rec('БЦ: ползунок размера подписи меняет стиль', /bclab\{font-size:18(\.0)?px\}/.test(lab), lab);

  const realErr = errors.filter(e => !/favicon|404|Failed to load resource|Invalid API key|yandex/i.test(e));
  rec('студия: нет JS-ошибок', realErr.length === 0, realErr.slice(0, 3).join(' | '));

  await browser.close(); srv.close();
  console.log(JSON.stringify({ summary: { pass: results.filter(r => r.status === 'PASS').length, fail: results.filter(r => r.status === 'FAIL').length }, results }, null, 1));
})().catch(e => { console.error('FATAL', e); process.exit(2); });
