/* Проверка переключателя подложек в геоаналитике.

   В песочнице нет интернета, поэтому Leaflet и тайлы подставляем локально:
   без этого HASMAP=false, весь блок карты пропускается и переключатель
   остаётся непроверенным.

   Запуск: node geo_maps_test.js [файл.html] */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join(__dirname, 'geo2.html');
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const LJS = fs.readFileSync(path.join(__dirname, 'leaflet.js'), 'utf8');
const LCSS = fs.readFileSync(path.join(__dirname, 'leaflet.css'), 'utf8');
/* 1×1 прозрачный PNG — вместо настоящих тайлов */
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

(async () => {
  const html = fs.readFileSync(FILE, 'utf8');
  const srv = http.createServer((rq, rs) => {
    rs.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    rs.end(html);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));

  const tileHosts = new Set();
  await pg.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (/leaflet.*\.js/i.test(u)) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LJS });
    if (/leaflet.*\.css/i.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: LCSS });
    if (/\.png|tiles?\?|\/vt\/|MapServer/i.test(u)) { try { tileHosts.add(new URL(u).host); } catch (_) {} return route.fulfill({ status: 200, contentType: 'image/png', body: TILE }); }
    return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
  });

  await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(4000);

  check('страница загрузилась без ошибок сценария', errs.length === 0, errs[0] || 'ошибок нет');

  const hasMap = await pg.evaluate(() => typeof L !== 'undefined' && !!(window.map || map));
  check('Leaflet поднялся и карта создана', hasMap);

  /* Переключатель: количество подложек и положение */
  const ctl = await pg.evaluate(() => {
    const c = document.querySelector('.leaflet-control-layers');
    if (!c) return { err: 'переключателя нет' };
    const corner = c.closest('.leaflet-top.leaflet-right') ? 'верхний правый'
      : c.closest('.leaflet-top.leaflet-left') ? 'верхний левый'
      : c.closest('.leaflet-bottom.leaflet-right') ? 'нижний правый' : 'иной';
    const names = [...c.querySelectorAll('label span, label')].map(x => x.textContent.trim()).filter(Boolean);
    return { corner, count: Object.keys(window.BASES || {}).length, names: [...new Set(names)] };
  });
  check('переключатель карт в правом верхнем углу', ctl.corner === 'верхний правый', ctl.corner || ctl.err);
  check('подложек девять', ctl.count === 9, 'найдено ' + ctl.count);
  check('в списке есть спутник и Яндекс',
    (ctl.names || []).some(n => /Спутник/i.test(n)) && (ctl.names || []).some(n => /Яндекс/i.test(n)),
    (ctl.names || []).join(' · '));

  /* Переключение реально меняет слой */
  const sw = await pg.evaluate(async () => {
    const before = Object.keys(window.BASES).filter(k => map.hasLayer(window.BASES[k]));
    window.BASES['Google Спутник'].addTo(map);
    Object.keys(window.BASES).forEach(k => { if (k !== 'Google Спутник') { try { map.removeLayer(window.BASES[k]); } catch (_) {} } });
    await new Promise(r => setTimeout(r, 800));
    const after = Object.keys(window.BASES).filter(k => map.hasLayer(window.BASES[k]));
    return { before, after };
  });
  check('смена подложки работает', sw.after.length === 1 && sw.after[0] === 'Google Спутник',
    sw.before.join(',') + ' → ' + sw.after.join(','));

  check('тайлы запрашивались у провайдеров', tileHosts.size > 0, [...tileHosts].slice(0, 3).join(', '));

  /* Данные не тронуты */
  const bc = await pg.evaluate(() => ({ n: BC.length, first: BC[0].name }));
  /* 151 = 150 бенчмарков + наш проект Samsung BC, добавленный в конец списка */
  check('список БЦ на месте', bc.n === 151 && bc.first === 'Botanica BC', `${bc.n} шт., первый «${bc.first}»`);

  await pg.screenshot({ path: path.join(__dirname, 'maps_switcher.png'), clip: { x: 900, y: 0, width: 500, height: 420 } });

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
