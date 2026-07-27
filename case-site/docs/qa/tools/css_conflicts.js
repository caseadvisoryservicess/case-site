/* CASE OS — аудитор конфликтов CSS между модулями.

   Зачем: половина табличных багов v4.46–v4.48 была из-за того, что правило одного модуля молча
   перебивало правило другого. Классика — `.ux-table-viewport thead th{top:0!important}` из
   v3515-ux глушило вертикальные смещения шапки из v432-data-grid; искали три релиза.

   Принцип (важный): конфликт засчитывается ТОЛЬКО если в живом DOM есть элемент, попадающий
   ПОД ОБА правила сразу. Совпадения «оба про th, но в разных таблицах» отсекаются. Это тот же
   подход, что и с проверкой отрисовки: доверяем факту, а не теории.

   Ещё: декларации читаются из авторского cssText, а не из развёрнутого style-объекта — иначе
   один `background:` превращается в девять мнимых конфликтов.

   Запуск: node css_conflicts.js /path/to/os [--all]
     без флага — только конфликты с !important (то, что реально ломает вёрстку);
     --all      — включая обычные переопределения. */
'use strict';
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs'), http = require('http');
const OS_DIR = path.resolve(process.argv[2] || '.');
const SHOW_ALL = process.argv.includes('--all');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.geojson': 'application/json', '.csv': 'text/csv' };

const srv = http.createServer((req, rsp) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { rsp.writeHead(404); rsp.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
  rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(rsp);
});

/* выполняется В БРАУЗЕРЕ: собрать правила и найти пары, реально сталкивающиеся на элементах */
function auditInPage(onlyImportant) {
  const sheets = [];
  [...document.styleSheets].forEach(sh => {
    let rules = []; try { rules = [...sh.cssRules]; } catch (e) { return; }
    const owner = (sh.ownerNode && sh.ownerNode.id) || (sh.href ? sh.href.split('/').pop() : 'inline-в-index.html');
    const walk = (list, media) => list.forEach(r => {
      if (r.cssRules && !r.selectorText) { walk([...r.cssRules], r.conditionText || (r.media && r.media.mediaText) || media); return; }
      if (!r.selectorText || !r.cssText) return;
      /* авторские декларации: то, что реально написано между { } */
      const body = r.cssText.slice(r.cssText.indexOf('{') + 1, r.cssText.lastIndexOf('}'));
      const decls = [];
      body.split(';').forEach(d => {
        const i = d.indexOf(':'); if (i < 1) return;
        const prop = d.slice(0, i).trim().toLowerCase();
        let val = d.slice(i + 1).trim();
        const important = /!\s*important$/i.test(val);
        val = val.replace(/!\s*important$/i, '').trim();
        if (prop && !prop.startsWith('--')) decls.push({ prop, val: val.slice(0, 46), important });
      });
      if (decls.length) sheets.push({ owner, media: media || '', selector: r.selectorText, decls });
    });
    walk(rules, '');
  });

  /* кандидаты: свойство, которое задают ≥2 разных источника (и есть !important) */
  const byProp = new Map();
  sheets.forEach((r, ri) => r.decls.forEach(d => {
    if (!byProp.has(d.prop)) byProp.set(d.prop, []);
    byProp.get(d.prop).push({ ri, ...d });
  }));

  const matchCache = new Map();
  const matchSet = sel => {
    if (matchCache.has(sel)) return matchCache.get(sel);
    let set = null;
    try { set = new Set(document.querySelectorAll(sel)); } catch (e) { set = new Set(); }
    matchCache.set(sel, set); return set;
  };

  const found = [];
  for (const [prop, list] of byProp) {
    const owners = new Set(list.map(x => sheets[x.ri].owner));
    if (owners.size < 2) continue;
    if (onlyImportant && !list.some(x => x.important)) continue;
    /* попарно ищем реальное пересечение по элементам */
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = sheets[list[i].ri], B = sheets[list[j].ri];
        if (A.owner === B.owner) continue;
        if (onlyImportant && !list[i].important && !list[j].important) continue;
        if (list[i].val === list[j].val && list[i].important === list[j].important) continue; // одинаковое — не конфликт
        let hit = 0, sample = '';
        for (const sa of A.selector.split(',')) {
          const setA = matchSet(sa.trim()); if (!setA.size) continue;
          for (const sb of B.selector.split(',')) {
            const setB = matchSet(sb.trim()); if (!setB.size) continue;
            for (const el of setA) if (setB.has(el)) { hit++; if (!sample) sample = (el.tagName + (el.className ? '.' + String(el.className).trim().split(/\s+/).slice(0, 2).join('.') : '')).slice(0, 44); }
          }
        }
        if (!hit) continue;
        found.push({
          prop, elements: hit, sample,
          a: { owner: A.owner, selector: A.selector.slice(0, 90), val: list[i].val, important: list[i].important, media: A.media },
          b: { owner: B.owner, selector: B.selector.slice(0, 90), val: list[j].val, important: list[j].important, media: B.media },
        });
      }
    }
  }
  return { rulesRead: sheets.length, owners: [...new Set(sheets.map(s => s.owner))], found };
}

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(base + '/index.html?demo=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.evaluate(() => { const s = document.getElementById('luser'); s.value = 'ASH'; doLogin(); });
  await page.waitForTimeout(600);

  /* модули вставляют стили лениво — обходим разделы и проверяем на каждом */
  const views = ['registry', 'brands', 'plans', 'dates', 'docs', 'v32_sales', 'users', 'dash'];
  const all = new Map(); let rulesRead = 0, owners = new Set();
  for (const v of views) {
    try { await page.evaluate(x => go(x), v); } catch (e) { continue; }
    await page.waitForTimeout(700);
    const res = await page.evaluate(auditInPage, !SHOW_ALL);
    rulesRead = Math.max(rulesRead, res.rulesRead); res.owners.forEach(o => owners.add(o));
    res.found.forEach(f => {
      const key = [f.prop, f.a.owner, f.a.selector, f.b.owner, f.b.selector].join('||');
      const prev = all.get(key);
      if (!prev || prev.elements < f.elements) all.set(key, { ...f, view: v });
    });
  }
  await browser.close(); srv.close();

  const list = [...all.values()].sort((x, y) =>
    ((y.a.important + y.b.important) - (x.a.important + x.b.important)) || (y.elements - x.elements) || x.prop.localeCompare(y.prop));

  console.log('=============== АУДИТ КОНФЛИКТОВ CSS ===============');
  console.log(`правил считано: ${rulesRead} | источников стилей: ${owners.size} | разделов пройдено: ${views.length}`);
  console.log(`режим: ${SHOW_ALL ? 'все переопределения' : 'только с !important'}`);
  console.log(`конфликтов, подтверждённых на реальных элементах: ${list.length}\n`);
  list.slice(0, 30).forEach((c, i) => {
    console.log(`${i + 1}. «${c.prop}» — сталкиваются на ${c.elements} элем. (${c.sample}), раздел «${c.view}»`);
    console.log(`     [${c.a.owner}] ${c.a.selector}`);
    console.log(`        → ${c.prop}: ${c.a.val}${c.a.important ? ' !important' : ''}${c.a.media ? '  @' + c.a.media : ''}`);
    console.log(`     [${c.b.owner}] ${c.b.selector}`);
    console.log(`        → ${c.prop}: ${c.b.val}${c.b.important ? ' !important' : ''}${c.b.media ? '  @' + c.b.media : ''}`);
    console.log('');
  });
  if (list.length > 30) console.log(`… и ещё ${list.length - 30} (показаны первые 30)`);
  const outFile = path.join(process.env.CSS_AUDIT_OUT || '/tmp', 'css_conflicts.json');
  try { fs.writeFileSync(outFile, JSON.stringify({ total: list.length, conflicts: list }, null, 1)); console.log('\nJSON-отчёт: ' + outFile); } catch (e) { }
});
