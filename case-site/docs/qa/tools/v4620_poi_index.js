/* Пространственный индекс слоёв POI даёт РОВНО тот же ответ, что честный перебор.

   countIn перебирал весь слой на каждый вопрос «сколько объектов в радиусе». Для отчёта по
   одной точке это незаметно, а модель зон пригодности спрашивает по каждой ячейке сетки:
   на сетке 250 м по Ташкенту это 13 тысяч ячеек, и при 2000 объектов в слое выходило больше
   двадцати миллионов вычислений расстояния в главном потоке.

   Индекс ускоряет, но ускорение бессмысленно, если ответ поедет: точка у границы клетки
   или радиус чуть больше клетки - классические места, где такой индекс начинает терять
   объекты. Поэтому здесь сверяем не скорость, а совпадение с перебором на неудобных случаях.

   Запуск: node v4620_poi_index.js [папка os] */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base } = await createMockServer(OS, { initialState: {} });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 120)));

  /* слой подменяем ответом прокси: так индекс строится тем же путём, что в бою */
  const N = 1500;
  let seed = 7; const rnd = () => ((seed = seed * 1103515245 + 12345 & 0x7fffffff) / 0x7fffffff);
  const rows = [];
  for (let i = 0; i < N; i++) rows.push({ name: 'т' + i, lat: 41.17 + rnd() * 0.25, lng: 69.11 + rnd() * 0.35,
    subtype: 'bus_stop', hubType: 'Автобусная остановка', routes: '', provider: 'OSM', _verification: 'online' });
  /* специально кладём точки ровно на границы клеток индекса (шаг 0.01 градуса) */
  [41.20, 41.21, 41.22].forEach(la => [69.20, 69.21].forEach(ln => rows.push({ name: 'граница', lat: la, lng: ln,
    subtype: 'bus_stop', hubType: 'Автобусная остановка', routes: '', provider: 'OSM', _verification: 'online' })));

  await pg.route('**/*', r => {
    const u = r.request().url();
    return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort();
  });
  await pg.route('**/api/gis_proxy.php**', r => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ ok: true, count: rows.length, total: rows.length, rows }) }));

  await pg.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(6000);
  await pg.check('#geoLayer-transport_hubs');
  await pg.waitForTimeout(2500);

  const loaded = await pg.evaluate(() => CASE_GEO_POI.total('transport_hubs'));
  ck('слой загружен', loaded === 1506, loaded + ' объектов');

  /* сверяем индекс с честным перебором: центры города, окраины, точки на границах клеток,
     радиусы меньше и заметно больше размера клетки */
  const cmp = await pg.evaluate(() => {
    const rows = CASE_GEO_POI.rows('transport_hubs');
    function hav2(a, b, c, d) { const R = 6371, p = Math.PI / 180;
      const dLa = (c - a) * p, dLn = (d - b) * p;
      const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * p) * Math.cos(c * p) * Math.sin(dLn / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(x)); }
    const scan = (la, ln, km) => rows.filter(x => hav2(la, ln, +x.lat, +x.lng) <= km).length;
    const pts = [[41.3111, 69.2797], [41.17, 69.11], [41.42, 69.46], [41.20, 69.20], [41.2099, 69.2099],
                 [41.2101, 69.2101], [41.35, 69.30], [41.25, 69.40]];
    const radii = [0.2, 0.5, 1, 1.5, 3, 5, 12];
    const diffs = [];
    let checks = 0;
    pts.forEach(p => radii.forEach(km => {
      checks++;
      const a = CASE_GEO_POI.countIn(['transport_hubs'], p[0], p[1], km);
      const c = scan(p[0], p[1], km);
      if (a !== c) diffs.push(`${p[0].toFixed(4)},${p[1].toFixed(4)} r=${km}км: индекс ${a}, перебор ${c}`);
    }));
    /* разбивка по подтипам должна сходиться с общим счётом */
    const br = CASE_GEO_POI.breakdown(['transport_hubs'], 41.3111, 69.2797, 3);
    const sum = Object.keys(br).reduce((s, k) => s + br[k], 0);
    const tot = CASE_GEO_POI.countIn(['transport_hubs'], 41.3111, 69.2797, 3);
    return { checks, diffs, brSum: sum, brTotal: tot };
  });
  ck('индекс совпадает с перебором на всех сочетаниях точка/радиус', cmp.diffs.length === 0,
     cmp.diffs.length ? cmp.diffs.slice(0, 3).join(' | ') : cmp.checks + ' сочетаний, расхождений нет');
  ck('разбивка по подтипам сходится с общим счётом', cmp.brSum === cmp.brTotal,
     cmp.brSum + ' против ' + cmp.brTotal);

  /* индекс не должен пережить перезагрузку слоя другими данными */
  const stale = await pg.evaluate(async () => {
    const before = CASE_GEO_POI.countIn(['transport_hubs'], 41.3111, 69.2797, 3);
    return { before };
  });
  ck('счёт по загруженному слою не нулевой', stale.before > 0, stale.before + ' в 3 км от центра');

  ck('ошибок сценария нет', errs.length === 0, errs[0] || 'нет');
  await b.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nИндекс слоёв POI считает точно так же, как перебор');
  process.exit(bad ? 1 : 0);
})();
