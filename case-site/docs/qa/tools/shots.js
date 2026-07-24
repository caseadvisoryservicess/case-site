/* Скриншоты CASE OS (?demo=1) для UX-ревизии. node shots.js /path/to/os outdir [views...] */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || '.');
const OUT = path.resolve(process.argv[3] || './shots');
const VIEWS = process.argv.slice(4);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv' };
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
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '00-login.png') });
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = s.options[0].value; doLogin(); });
  await page.waitForTimeout(1000);
  const views = VIEWS.length ? VIEWS : ['dash', 'registry', 'plans', 'plan_master', 'brands', 'docs'];
  let i = 1;
  for (const v of views) {
    try {
      await page.evaluate(vv => go(vv), v);
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, String(i).padStart(2, '0') + '-' + v + '.png') });
    } catch (e) { console.log('skip', v, String(e).slice(0, 120)); }
    i++;
  }
  /* панель навигации целиком (может скроллиться) */
  try {
    const nav = await page.$('#side');
    if (nav) await nav.screenshot({ path: path.join(OUT, '99-sidebar.png') });
  } catch (e) {}
  console.log('done', OUT);
  await browser.close(); srv.close(); process.exit(0);
});
