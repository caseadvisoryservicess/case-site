/* Слой «F&B» в автономной геоаналитике: рестораны, кафе, фастфуд, чайханы.

   Запрос владельца: «данные по F&B локациям собери как ты собрал по образованию».
   Собрать их из песочницы разработки нельзя — там нет интернета, поэтому слой устроен
   так же, как образование: страница сама идёт в OpenStreetMap из браузера пользователя,
   плюс принимает GeoJSON из overpass-turbo и master-CSV коллектора.

   Проверяем: разбор всех трёх источников, определение типов (особенно чайханы — OSM
   не размечает её отдельным тегом), легенду, фильтр по типу и аналитику.

   Запуск: node geo_standalone_fnb.js [файл.html] */
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path');

const FILE = process.argv[2] || '/home/user/case-site/case-site/docs/standalone/CASE_OS_Geo_Analytics.html';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let failed = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) failed++; };

/* Ответ Overpass: обычные точки, контур здания (way с center), чайхана под тегом
   ресторана, объект без координат и посторонний магазин — всё как в жизни. */
const OVERPASS = { elements: [
  { type: 'node', id: 1, lat: 41.3200, lon: 69.2800, tags: { amenity: 'restaurant', name: 'Афсона', cuisine: 'uzbek' } },
  { type: 'node', id: 2, lat: 41.3210, lon: 69.2810, tags: { amenity: 'restaurant', name: 'Чайхана Навруз' } },
  { type: 'node', id: 3, lat: 41.3220, lon: 69.2820, tags: { amenity: 'cafe', name: 'Coffee House' } },
  { type: 'node', id: 4, lat: 41.3230, lon: 69.2830, tags: { amenity: 'fast_food', name: 'Evos' } },
  { type: 'way',  id: 5, center: { lat: 41.3240, lon: 69.2840 }, tags: { amenity: 'bar', name: 'Steam Pub' } },
  { type: 'node', id: 6, lat: 41.3250, lon: 69.2850, tags: { shop: 'bakery', name: 'Нон' } },
  { type: 'node', id: 7, tags: { amenity: 'cafe', name: 'Без координат' } },
  { type: 'node', id: 8, lat: 41.3260, lon: 69.2860, tags: { shop: 'clothes', name: 'Магазин одежды' } }
]};

const GEOJSON = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { amenity: 'restaurant', name: 'Sette' }, geometry: { type: 'Point', coordinates: [69.2790, 41.3190] } },
  { type: 'Feature', properties: { amenity: 'restaurant', name: "Choyxona Bahor" },
    geometry: { type: 'Polygon', coordinates: [[[69.2870, 41.3450], [69.2872, 41.3450], [69.2872, 41.3452], [69.2870, 41.3452], [69.2870, 41.3450]]] } },
  { type: 'Feature', properties: { amenity: 'canteen', name: 'Ошхона' }, geometry: { type: 'Point', coordinates: [69.2880, 41.3460] } },
  { type: 'Feature', properties: { office: 'company', name: 'Не общепит' }, geometry: { type: 'Point', coordinates: [69.2890, 41.3470] } }
]};

const CSV = 'main_category,canonical_name,canonical_lat,canonical_lng,subcategory,primary_source\n'
  + 'restaurants,"Ресторан Зарафшан, зал 2",41.3200,69.2800,Ресторан,2GIS\n'
  + 'restaurants,Чайхана Регистан,41.3205,69.2805,Чайхана,2GIS\n'
  + 'cafes,Кофейня Sana,41.3210,69.2810,Кофейня,Google\n'
  + 'fast_food,Lavash Time,41.3215,69.2815,Фастфуд,Яндекс\n'
  + 'education,Школа №110,41.3220,69.2820,Школа,OSM\n';

(async () => {
  const html = fs.readFileSync(FILE, 'utf8');
  let overpassHits = 0, lastBody = '';
  const srv = http.createServer((q, s) => {
    if (/\.json$/.test(q.url)) { s.writeHead(404); return s.end('no'); }
    s.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); s.end(html);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;

  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  /* Overpass отвечаем сами: интернета в песочнице нет. Первый сервер отдаёт 429 —
     проверяем, что страница переходит к следующему зеркалу, как и задумано. */
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (u.startsWith(base)) return r.continue();
    if (/interpreter/.test(u)) {
      overpassHits++;
      lastBody = r.request().postData() || '';
      if (overpassHits === 1) return r.fulfill({ status: 429, contentType: 'text/plain', body: 'too many requests' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OVERPASS) });
    }
    return r.fulfill({ status: 200, contentType: 'image/png', body: TILE });
  });

  await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  ck('страница без ошибок сценария', errs.length === 0, errs[0] || 'ошибок нет');
  ck('переключатель слоя есть', await pg.evaluate(() => !!document.getElementById('lFnb')));
  ck('фильтр по типу есть', await pg.evaluate(() => {
    const s = document.getElementById('fnbT'); return !!s && s.options.length >= 8; }));

  /* 1. Данных нет — слой честно объясняет, что делать */
  const empty = await pg.evaluate(async () => {
    const cb = document.getElementById('lFnb'); cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    return { note: (document.getElementById('fnbNote') || {}).innerHTML || '', layers: gFnb.getLayers().length };
  });
  ck('без данных слой пуст и не падает', empty.layers === 0, 'слоёв: ' + empty.layers);
  ck('подсказка ведёт к кнопке скачивания', /Скачать из OpenStreetMap/i.test(empty.note), empty.note.slice(0, 70));

  /* 2. Скачивание из OpenStreetMap прямо со страницы */
  const osm = await pg.evaluate(async () => {
    await fnbFetchOsm();
    await new Promise(r => setTimeout(r, 600));
    return { n: FNB.length, src: FNB_SRC, types: FNB.map(p => p.t),
             names: FNB.map(p => p.n), layers: gFnb.getLayers().length,
             saved: !!localStorage.getItem('caseos_fnb') };
  });
  ck('страница сама скачала данные из OpenStreetMap', osm.n === 6, 'точек: ' + osm.n + ' (' + osm.src + ')');
  ck('отказ первого сервера пережит — взят следующий', overpassHits >= 2, 'обращений к серверам: ' + overpassHits);
  ck('запрос уходит методом POST с телом', /^data=/.test(lastBody), lastBody.slice(0, 40));
  ck('запрос охватывает кафе, фастфуд и пекарни',
    /amenity%22%3D%22cafe/.test(lastBody) && /amenity%22%3D%22fast_food/.test(lastBody) && /shop%22%3D%22bakery/.test(lastBody));
  ck('чайхана распознана по названию, а не по тегу ресторана',
    osm.types[osm.names.indexOf('Чайхана Навруз')] === 'teahouse',
    osm.names.map((n, i) => n + '=' + osm.types[i]).join(' | '));
  ck('обычный ресторан остался рестораном', osm.types[osm.names.indexOf('Афсона')] === 'restaurant');
  ck('контур (way) взят по центру', osm.names.indexOf('Steam Pub') >= 0 && osm.types[osm.names.indexOf('Steam Pub')] === 'bar');
  ck('пекарня из shop=bakery попала в слой', osm.types[osm.names.indexOf('Нон')] === 'bakery');
  ck('объект без координат пропущен', osm.names.indexOf('Без координат') < 0);
  ck('посторонний магазин в слой не попал', osm.names.indexOf('Магазин одежды') < 0, osm.names.join(' | '));
  ck('точки сразу на карте', osm.layers === 6, 'на карте: ' + osm.layers);
  ck('загруженное запомнено в браузере', osm.saved);

  /* 3. Легенда */
  const lgd = await pg.evaluate(() => {
    const el = document.getElementById('mlgd');
    const rows = [...el.querySelectorAll('.li')].filter(x => /lgdFilterFnb/.test(x.getAttribute('onclick') || ''));
    return { txt: el.innerText.replace(/\s+/g, ' '), rows: rows.map(x => x.textContent.trim()),
             col: rows.length ? getComputedStyle(rows[0].querySelector('.dot')).backgroundColor : '' };
  });
  ck('в легенде появился блок F&B', /F&B · 6/.test(lgd.txt), lgd.txt.slice(0, 160));
  ck('в легенде разбивка по типам', lgd.rows.length >= 5, lgd.rows.join(' | '));
  ck('названия типов человеческие', /Чайхана/.test(lgd.txt) && !/teahouse/.test(lgd.txt));

  /* 4. Фильтр по типу — из легенды и из панели */
  const filt = await pg.evaluate(async () => {
    const el = document.getElementById('mlgd');
    const li = [...el.querySelectorAll('.li')].find(x => /lgdFilterFnb\('teahouse'\)/.test(x.getAttribute('onclick') || ''));
    li.click();
    await new Promise(r => setTimeout(r, 400));
    return { sel: document.getElementById('fnbT').value, layers: gFnb.getLayers().length,
             txt: document.getElementById('mlgd').innerText.replace(/\s+/g, ' ') };
  });
  ck('клик по строке легенды фильтрует', filt.sel === 'teahouse' && filt.layers === 1,
    `фильтр «${filt.sel}», на карте ${filt.layers}`);
  ck('есть строка снятия фильтра', /снять фильтр типа/.test(filt.txt));

  /* 5. Аналитика */
  const anal = await pg.evaluate(async () => {
    document.getElementById('fnbT').value = '';
    const la = 41.3215, ln = 69.2820;
    const r1 = fnbR(la, ln, 1000), r3 = fnbR(la, ln, 3000);
    document.getElementById('fnbT').value = 'teahouse';
    const only = fnbR(la, ln, 3000);
    document.getElementById('fnbT').value = '';
    return { r1, r3, only, zc: zCompCount(la, ln, 1000, 'fnb'),
             biz: [...document.querySelectorAll('#sZBiz option')].map(o => o.value) };
  });
  ck('счёт F&B в радиусе работает', anal.r3 > 0 && anal.r3 >= anal.r1, `1 км: ${anal.r1}, 3 км: ${anal.r3}`);
  ck('фильтр типа влияет на счёт конкурентов', anal.only < anal.r3, `все: ${anal.r3}, чайханы: ${anal.only}`);
  ck('F&B есть в модели зон пригодности', anal.biz.indexOf('fnb') >= 0, anal.biz.join(', '));
  ck('модель зон считает F&B конкурентами', anal.zc === anal.r1, `zCompCount ${anal.zc}, прямой счёт ${anal.r1}`);

  const rep = await pg.evaluate(async () => {
    await probeAt(41.3215, 69.2820);
    await new Promise(r => setTimeout(r, 1000));
    const t = (document.getElementById('probe') || {}).innerText || '';
    return { block: /F&B \(конкуренция\)/i.test(t), score: /Потенциал заведения F&B/i.test(t),
             byType: /В 1 км:/.test(t),
             scoreFnb: (typeof LASTPROBE === 'object' && LASTPROBE) ? LASTPROBE.scoreFnb : undefined,
             scoreMed: (typeof LASTPROBE === 'object' && LASTPROBE) ? LASTPROBE.scoreMed : undefined };
  });
  ck('в отчёте по точке есть блок F&B', rep.block);
  ck('в отчёте есть разбивка по типам', rep.byType);
  ck('в отчёте есть потенциал заведения F&B', rep.score);
  ck('оценка F&B ведёт себя как оценка клиники',
    (rep.scoreFnb === null) === (rep.scoreMed === null),
    `F&B: ${rep.scoreFnb}, клиника: ${rep.scoreMed}`);

  /* 6. Импорт файлов: GeoJSON и master-CSV */
  const gj = await pg.evaluate(async g => {
    const r = fnbFromGeoJson(g);
    return r ? { n: r.points.length, types: r.points.map(p => p.t), names: r.points.map(p => p.n),
                 la: r.points[1] ? r.points[1].la : null } : null;
  }, GEOJSON);
  ck('GeoJSON из overpass читается', gj && gj.n === 3, gj ? 'точек: ' + gj.n : 'не прочитан');
  ck('латиница «Choyxona» тоже опознана чайханой',
    gj && gj.types[gj.names.indexOf('Choyxona Bahor')] === 'teahouse', gj ? gj.types.join(', ') : '');
  ck('контур здания превращён в точку по центру', gj && Math.abs(gj.la - 41.3451) < 0.001, gj ? gj.la : '');
  ck('не-общепит из GeoJSON отброшен', gj && gj.names.indexOf('Не общепит') < 0);

  const csv = await pg.evaluate(async t => {
    const r = fnbFromCsv(t);
    return r ? { n: r.points.length, names: r.points.map(p => p.n), types: r.points.map(p => p.t) } : null;
  }, CSV);
  ck('master-CSV коллектора читается напрямую', csv && csv.n === 4, csv ? 'точек: ' + csv.n : 'не прочитан');
  ck('школа из CSV в F&B не попала', csv && csv.names.every(n => !/Школа/.test(n)), csv ? csv.names.join(' | ') : '');
  ck('запятая внутри кавычек не порвала строку',
    csv && csv.names.indexOf('Ресторан Зарафшан, зал 2') >= 0, csv ? csv.names[0] : '');
  ck('чайхана из CSV не уехала в рестораны',
    csv && csv.types[csv.names.indexOf('Чайхана Регистан')] === 'teahouse', csv ? csv.types.join(', ') : '');

  ck('ошибок за весь прогон нет', errs.length === 0, errs[0] || 'ошибок нет');

  await b.close(); srv.close();
  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
