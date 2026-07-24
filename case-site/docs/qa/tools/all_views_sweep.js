/* CASE OS — полный обход ВСЕХ экранов (?demo=1, роль админа): JS-ошибки, пустоты,
   многословие (абзацы >180 симв.), английские остатки, заглушки. Скриншот каждого экрана.
   Запуск: node all_views_sweep.js /path/to/os outdir */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || '.');
const OUT = path.resolve(process.argv[3] || './sweep');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.geojson': 'application/json', '.csv': 'text/csv', '.png': 'image/png' };
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
  let viewErrors = [];
  page.on('pageerror', e => viewErrors.push(String(e && e.message || e).slice(0, 140)));
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = s.options[0].value; doLogin(); });
  await page.waitForTimeout(900);

  const views = await page.evaluate(() => (window.CASE_OS_MODULES || []).filter(m => m.v !== 'chat').map(m => ({ v: m.v, ru: m.ru, future: !!m.future })));
  const report = [];
  for (const m of views) {
    viewErrors = [];
    const r = await page.evaluate(async mv => {
      try { go(mv); } catch (e) { return { fail: 'go() бросил: ' + String(e && e.message || e).slice(0, 120) }; }
      await new Promise(rs => setTimeout(rs, 450));
      const main = document.getElementById('main');
      if (!main) return { fail: 'нет #main' };
      const txt = (main.innerText || '').trim();
      const longPs = [...main.querySelectorAll('p,.sub,.hint,.case49-note,.mut')].map(p => (p.innerText || '').trim()).filter(t => t.length > 180);
      const latin = (txt.match(/\b[A-Za-z]{4,}(?:\s+[A-Za-z]{2,}){2,}\b/g) || []).filter(s => !/CASE|Kanban|Scope|Advisory|LCR|SCR|MEP|NOI|CAPEX|NDA|DD|SPA|LOI|QSR|POI|Facility|Asset|Management|Excel|CSV|PDF|SVG|PNG|GIS|API/i.test(s)).slice(0, 3);
      return {
        landed: S.view, chars: txt.length,
        longParagraphs: longPs.length, longSample: (longPs[0] || '').slice(0, 110),
        latinRuns: latin,
        placeholder: /в разработке|скоро|coming soon|план\b/i.test(txt.slice(0, 400)) && txt.length < 900
      };
    }, m.v);
    try { await page.screenshot({ path: path.join(OUT, m.v + '.png') }); } catch (e) {}
    report.push({ view: m.v, ru: m.ru, future: m.future, ...r, jsErrors: viewErrors.slice(0, 2) });
  }
  await browser.close(); srv.close();
  const flagged = report.filter(r => r.fail || (r.jsErrors && r.jsErrors.length) || r.landed !== r.view || (r.chars < 120 && !r.future) || r.longParagraphs > 0);
  console.log(JSON.stringify({ total: report.length, flagged: flagged.length, flaggedList: flagged, all: report.map(r => ({ v: r.view, chars: r.chars, lp: r.longParagraphs })) }, null, 1));
  process.exit(0);
});
