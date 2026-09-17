/* Планировки: данные из реестра не должны исполняться как разметка.

   Откуда взялось. Внешний аудит указал на 'unsafe-inline' в CSP, но саму дыру, ради
   которой этот 'unsafe-inline' опасен, не нашёл. А она была: planSVG подставлял код
   помещения и название бренда в <text> сырыми, тогда как ручная планировка Заравшана
   строкой ниже те же поля экранировала. То есть в одном файле одно место защищено,
   соседнее нет - признак недосмотра, а не решения.

   Почему это важнее обычного экранирования. Поля заполняет сотрудник с правом edit
   (правка в таблице, импорт CSV), значение уходит в общий app_state, и разметку
   получает УЖЕ ДРУГОЙ пользователь, открывший планировку. Это stored XSS: полезная
   нагрузка исполняется в чужой сессии, а CSP её не остановит, пока в ней есть
   'unsafe-inline'. Снять 'unsafe-inline' нельзя без переписывания фронтенда, значит
   единственный рубеж здесь - экранирование.

   Проверяется не наличие esc() в исходнике, а поведение: payload кладётся в данные,
   планировка открывается в настоящем браузере, и проверяется, что скрипт НЕ исполнился
   и что текст виден буквально.

   Запуск: NODE_PATH=<...>/node_modules node v4703_plan_xss.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.xlsx': 'application/octet-stream', '.md': 'text/markdown' };

let bad = 0;
function ck(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail == null ? '' : ' - ' + detail));
  if (!cond) bad++;
}

/* Четыре формы нагрузки: выход из <text>, событие на SVG-элементе, попытка через
   вложенный HTML и голый тег скрипта. Одной мало - экранирование может закрывать
   угловые скобки, но пропускать кавычки, и наоборот. */
const PAYLOADS = [
  { name: 'выход из <text> через image/onerror', s: '</text><image href="x" onerror="window.__xss1=1"/><text>' },
  { name: 'вложенный foreignObject с HTML', s: '</text><foreignObject><img src=x onerror="window.__xss2=1"></foreignObject><text>' },
  { name: 'тег скрипта внутри SVG', s: '</text><script>window.__xss3=1<\/script><text>' },
  { name: 'закрытие атрибута кавычкой', s: '"><image href=x onerror="window.__xss4=1"><text x="0' },
];

const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  if (p.startsWith('/api/')) { r.writeHead(404); r.end(); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });

  /* Диалог, открытый payload'ом, повесил бы прогон молча. */
  page.on('dialog', d => d.dismiss().catch(() => {}));

  await page.goto(base + '/index.html?demo=1', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#luser', { timeout: 20000 });
  await page.evaluate(() => { document.getElementById('luser').value = 'ASH'; doLogin(); });
  await page.waitForTimeout(1500);

  for (let i = 0; i < PAYLOADS.length; i++) {
    const { name, s } = PAYLOADS[i];
    const flag = '__xss' + (i + 1);

    const res = await page.evaluate(async ({ payload, flag }) => {
      delete window[flag];
      /* Кладём нагрузку ровно туда, куда её кладёт сотрудник: код помещения и
         название бренда. Берём первое помещение первого объекта. */
      const u = U[0];
      if (!u) return { error: 'в демо-данных нет помещений' };
      const objId = u.obj;
      u.code = payload;
      u.vars = [payload];
      u.sub = payload;
      S.obj = objId;
      try { go('plans'); } catch (e) { return { error: String(e && e.message || e).slice(0, 90) }; }
      await new Promise(r => setTimeout(r, 900));
      const main = document.getElementById('main');
      const svg = main ? main.querySelector('svg') : null;
      return {
        executed: window[flag] === 1,
        /* Текст должен присутствовать буквально: если экранирование съело значение,
           пользователь потеряет данные - это тоже дефект, просто другой. */
        literal: !!(main && (main.textContent || '').indexOf(payload.slice(0, 24)) >= 0),
        svgPresent: !!svg,
        /* Разметка не должна была появиться внутри SVG отдельными узлами. */
        injectedNodes: svg ? svg.querySelectorAll('image, foreignObject, script').length : 0,
      };
    }, { payload: s, flag });

    if (res.error) { ck(name, false, res.error); continue; }
    ck(`${name}: скрипт НЕ исполнился`, res.executed === false);
    ck(`${name}: планировка отрисовалась`, res.svgPresent === true);
    ck(`${name}: чужих узлов в SVG нет`, res.injectedNodes === 0, `узлов: ${res.injectedNodes}`);
    ck(`${name}: значение видно буквально, данные не потеряны`, res.literal === true);
  }

  /* Контроль осмысленности теста: если снять экранирование, он обязан покраснеть.
     Иначе это тест, который проходит всегда и не проверяет ничего. */
  const canary = await page.evaluate(async () => {
    delete window.__canary;
    const main = document.getElementById('main');
    if (!main) return null;
    main.innerHTML = '<svg><text>' + '</text><image href="x" onerror="window.__canary=1"/>' + '</svg>';
    await new Promise(r => setTimeout(r, 400));
    return window.__canary === 1;
  });
  ck('контроль: та же нагрузка БЕЗ экранирования исполняется', canary === true,
     canary === true ? 'тест способен поймать регресс' : 'тест бесполезен, нагрузка не срабатывает даже без защиты');

  await browser.close(); srv.close();
  console.log('\n' + (bad ? `ПРОВАЛЕНО проверок: ${bad}\n` : 'Данные реестра в планировках не исполняются\n'));
  process.exit(bad ? 1 : 0);
});
