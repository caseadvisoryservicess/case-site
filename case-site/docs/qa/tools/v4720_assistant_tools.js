/* Гео-ассистент: инструменты и локальный разбор команд в настоящем браузере.

   Студия открывается отдельным окном (не внутри CASE OS), поэтому модели здесь нет и
   ассистент работает в режиме команд. Это ровно тот режим, в котором он окажется у
   клиента, если ключ API не настроен, и он обязан быть полноценным.

   Что проверяется и почему это, а не «панель появилась»:

     1. Разбор фраз: русский, английский, узбекский; несколько радиусов в одной фразе;
        цвет в самой команде; фраза-мусор даёт null, а не случайный вызов.
     2. Математика населения: доля площади ячейки внутри круга. На равномерной сетке
        плотностью p человек на ячейку жителей в круге радиуса R должно быть p·πR²/S.
        Счёт по центроидам на той же сетке отклоняется на десятки процентов - и это как
        раз то, что тест отличает.
     3. Здания и дороги приходят с прокси (здесь подменён), режутся по кругу, рисуются,
        выделяются по этажности и типу, перекрашиваются, и всё это с происхождением:
        у OSM уверенность «наблюдение», у населения «расчёт» с примечанием.
     4. Изохрона без маршрутизатора не молчит, а объясняет и предлагает радиус.
     5. Зонд студии (клик по карте) считает по КАЛИБРОВАННОЙ сетке. До v4.72.0 проверка
        стояла на переменной, которая никогда не была пустой, и калибровка не запускалась.

   Запуск: NODE_PATH=<...>/node_modules node v4720_assistant_tools.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { chromium } = require('playwright-core');

const OS_DIR = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.geojson': 'application/json', '.csv': 'text/csv', '.svg': 'image/svg+xml', '.png': 'image/png' };
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let bad = 0;
function ck(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail == null ? '' : ' - ' + detail));
  if (!cond) bad++;
}

/* Участок и синтетическая застройка вокруг него: 36 квадратов 40x40 м на сетке с шагом
   150 м, этажность от 2 до 16, типы чередуются. Дороги: 5 линий разных классов. */
const SITE = { lat: 41.3485, lon: 69.3166 };
function fixtureBuildings() {
  const out = []; let id = 1;
  for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) {
    const la = SITE.lat + (i * 150 + 75) / 111320, lo = SITE.lon + (j * 150 + 75) / (111320 * Math.cos(SITE.lat * Math.PI / 180));
    const d = 20 / 111320, dl = 20 / (111320 * Math.cos(SITE.lat * Math.PI / 180));
    const levels = 2 + ((i + 3) * 6 + (j + 3)) % 15;
    const kinds = ['apartments', 'residential', 'commercial', 'retail', 'house', ''];
    out.push({ id: id++, c: [la, lo], ring: [[la - d, lo - dl], [la + d, lo - dl], [la + d, lo + dl], [la - d, lo + dl]],
      kind: kinds[(i + 3 + j + 3) % 6], levels: levels, name: 'Дом ' + id, addr: 'ул. Тестовая ' + id, area: 1600 });
  }
  return out;
}
function fixtureRoads() {
  const k = 1 / 111320, kl = 1 / (111320 * Math.cos(SITE.lat * Math.PI / 180));
  const mk = (cls, name, pts) => ({ id: cls.length, line: pts.map(p => [SITE.lat + p[0] * k, SITE.lon + p[1] * kl]), cls, name, oneway: false, lanes: null });
  return [
    mk('primary', 'пр. Главный', [[-1200, 0], [1200, 0]]),
    mk('secondary', 'ул. Вторая', [[0, -1200], [0, 1200]]),
    mk('residential', 'ул. Жилая', [[-300, -300], [300, -300]]),
    mk('residential', '', [[-300, 300], [300, 300]]),
    mk('tertiary', 'ул. Третья', [[2500, 2500], [2600, 2600]]),   /* далеко: должна отсечься кругом */
  ];
}
const proxyCalls = [];

const srv = http.createServer((q, r) => {
  const url = new URL(q.url, 'http://x');
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/api/gis_proxy.php') {
    const mode = url.searchParams.get('mode');
    proxyCalls.push({ mode, radius: +url.searchParams.get('radius_m'), classes: url.searchParams.get('classes') || '' });
    const rows = mode === 'buildings' ? fixtureBuildings() : mode === 'roads' ? fixtureRoads() : null;
    r.writeHead(200, { 'Content-Type': 'application/json' });
    if (!rows) { r.end(JSON.stringify({ ok: false, message: 'нет такого режима' })); return; }
    r.end(JSON.stringify({ ok: true, provider: 'osm', mode, rows, truncated: false,
      provenance: { source: 'OpenStreetMap', licence: 'ODbL 1.0', attribution: '© OpenStreetMap contributors', method: 'Overpass', fetched_at: '2026-09-16T10:00:00+05:00', cached: false, conf: 'asking' } }));
    return;
  }
  /* Студия при загрузке проверяет вход и рабочую область; без положительного ответа она
     заменяет всю страницу заглушкой «доступ закрыт», и проверять было бы нечего. */
  if (p === '/api/auth.php') { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ auth: true, user: { id: 'u1', name: 'QA', role_key: 'ASH', admin: true, edit: true }, csrf: 't' })); return; }
  if (p === '/api/workspace_access.php') { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ allowed: true, can_edit: true })); return; }
  if (p.startsWith('/api/')) { r.writeHead(404); r.end('{}'); return; }
  const f = path.join(OS_DIR, p);
  if (!f.startsWith(OS_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

srv.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  /* Внешний мир недоступен: тайлы подменяем, маршрутизатор и всё прочее отвечают пусто. */
  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (/\.png|tiles?|\/vt\//i.test(u)) return route.fulfill({ status: 200, contentType: 'image/png', body: TILE });
    return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });

  await page.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.CASE_GEO_ASSIST && typeof map !== 'undefined' && map, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  /* Родитель прислал контекст: как при открытии из CASE OS. Проект стоит ровно на участке. */
  await page.evaluate(s => {
    window.postMessage({ source: 'asaas-os-v4', type: 'asaas-geo-context', context: {
      lang: 'ru', theme: 'light', editable: true, adminEdit: true, external: false,
      projects: [{ id: 'p1', name: 'Тест Плаза', lat: s.lat, lng: s.lon }], activeProjectId: 'p1' } }, location.origin);
  }, SITE);
  await page.waitForTimeout(2500);

  console.log('--- 0. Модуль и панель');
  const panel = await page.evaluate(() => {
    const p = document.getElementById('gaPanel');
    return { present: !!p, inLeft: !!(p && p.closest('.left')), afterProject: !!(p && p.previousElementSibling && /Проект/.test(p.previousElementSibling.textContent)),
      input: !!document.getElementById('gaInput'), chips: document.querySelectorAll('#gaPanel .ga-chip').length, colors: document.querySelectorAll('#gaPanel input[type=color]').length,
      version: (window.CASE_MODULE_VERSIONS || {})['v4720-geo-assistant'], osm: /OpenStreetMap/.test(p ? p.textContent : '') };
  });
  ck('панель ассистента в левой колонке сразу после «Проекта»', panel.present && panel.inLeft && panel.afterProject);
  ck('поле ввода, подсказки-чипы и три цветовых поля', panel.input && panel.chips >= 6 && panel.colors === 3, JSON.stringify(panel));
  ck('версия модуля зарегистрирована', panel.version === '4.72.0', panel.version);
  ck('атрибуция OSM видна в панели', panel.osm);

  console.log('\n--- 1. Локальный разбор команд');
  const parses = await page.evaluate(() => {
    const P = CASE_GEO_ASSIST.parseLocal;
    const names = t => (P(t) || []).map(c => c.name + ':' + JSON.stringify(c.input));
    return {
      radii: names('радиус 500 м и 1 км'),
      pop: names('население 1 км'),
      popEn: names('population within 1 km'),
      popUz: names('1 km ichida aholi'),
      bld: names('здания 500 м'),
      bldRed: names('покажи здания 500 м красным'),
      roads: names('дороги 1 км'),
      major: names('покажи только магистрали'),
      sel9: names('выдели дома выше 9 этажей'),
      selRes: names('выдели только жилые дома'),
      blue: names('сделай здания синими'),
      hex: names('покрась дороги в #123abc'),
      clear: names('очистить'),
      coords: names('участок 41.3485, 69.3166'),
      iso: names('за 10 минут на авто'),
      comp: names('конкуренты 2 км'),
      combo: names('радиус 1 км, население и здания'),
      junk: P('как дела?'),
    };
  });
  ck('«радиус 500 м и 1 км» -> два радиуса одним вызовом', parses.radii.join() === 'draw_radius:{"radii_m":[500,1000]}', parses.radii.join());
  ck('«население 1 км» -> count_population 1000', parses.pop.join() === 'count_population:{"radius_m":1000}', parses.pop.join());
  ck('английский', parses.popEn.join() === 'count_population:{"radius_m":1000}', parses.popEn.join());
  ck('узбекский', parses.popUz.join() === 'count_population:{"radius_m":1000}', parses.popUz.join());
  ck('«здания 500 м»', parses.bld.join() === 'load_buildings:{"radius_m":500}', parses.bld.join());
  ck('цвет в команде загрузки уходит в сам вызов', /load_buildings:\{"radius_m":500,"color":"#c0392b"\}/.test(parses.bldRed.join()), parses.bldRed.join());
  ck('«дороги 1 км»', parses.roads.join() === 'load_roads:{"radius_m":1000}', parses.roads.join());
  ck('«только магистрали» -> выделение дорог по классам', /select_features:\{"layer":"roads","classes":\["motorway","trunk","primary","secondary"\]\}/.test(parses.major.join()), parses.major.join());
  ck('«дома выше 9 этажей» -> выделение с min_levels', /select_features:\{"layer":"buildings","min_levels":9\}/.test(parses.sel9.join()), parses.sel9.join());
  ck('«только жилые» -> kind residential', /"kind":"residential"/.test(parses.selRes.join()), parses.selRes.join());
  ck('«сделай здания синими» -> style_layer', parses.blue.join() === 'style_layer:{"layer":"buildings","color":"#2e86de"}', parses.blue.join());
  ck('hex-цвет распознаётся', parses.hex.join() === 'style_layer:{"layer":"roads","color":"#123abc"}', parses.hex.join());
  ck('«очистить» -> clear_layers', parses.clear.join() === 'clear_layers:{}', parses.clear.join());
  ck('координаты в тексте -> set_site', /set_site:\{"lat":41.3485,"lon":69.3166\}/.test(parses.coords.join()), parses.coords.join());
  ck('«за 10 минут на авто» -> изохрона', parses.iso.join() === 'draw_isochrone:{"minutes":10}', parses.iso.join());
  ck('«конкуренты 2 км»', parses.comp.join() === 'count_competitors:{"radius_m":2000}', parses.comp.join());
  ck('составная фраза -> три вызова в осмысленном порядке', parses.combo.join(' | ') === 'draw_radius:{"radii_m":[1000]} | load_buildings:{"radius_m":1000} | count_population:{"radius_m":1000}', parses.combo.join(' | '));
  ck('фраза-мусор -> null, а не случайный инструмент', parses.junk === null);

  console.log('\n--- 2. Население: доля площади ячейки, не центроид');
  const math = await page.evaluate(() => {
    const A = CASE_GEO_ASSIST;
    const R = 1000, r = 484;
    const lensTests = {
      full: A.lens(R, r, 0) / (Math.PI * r * r),
      none: A.lens(R, r, R + r + 1),
      half: A.lens(R, r, R) / (Math.PI * r * r),
      sym: Math.abs(A.lens(R, r, 700) - A.lens(r, R, 700)) < 1e-6,
    };
    /* Шестиугольная решётка с шагом 900 м между соседями, как у настоящей сетки H3:
       ряды через d·√3/2, каждый второй ряд сдвинут на d/2. По 100 человек в ячейке. */
    const grid = [];
    const step = 900, kx = 1 / 111320, ky = 1 / (111320 * Math.cos(41.3 * Math.PI / 180));
    for (let i = -10; i <= 10; i++) for (let j = -10; j <= 10; j++) grid.push([41.3 + i * step * Math.sqrt(3) / 2 * kx, 69.3 + (j + (i & 1 ? 0.5 : 0)) * step * ky, 100]);
    A.state.cellArea = null;
    const res = A.popInRadius(41.3 + 0.37 * step * kx, 69.3 + 0.21 * step * ky, 1000, grid);
    const area = A.cellAreaM2(grid);
    const expected = 100 * Math.PI * 1000 * 1000 / area;
    let centroid = 0; grid.forEach(h => { const d = Math.hypot((h[0] - (41.3 + 0.37 * step * kx)) / kx, (h[1] - (69.3 + 0.21 * step * ky)) / ky); if (d <= 1000) centroid += h[2]; });
    /* Второй центр: у одной точки центроидный счёт может случайно попасть в цель. */
    const res2 = A.popInRadius(41.3 + 0.11 * step * kx, 69.3 + 0.63 * step * ky, 1000, grid);
    let centroid2 = 0; grid.forEach(h => { const d = Math.hypot((h[0] - (41.3 + 0.11 * step * kx)) / kx, (h[1] - (69.3 + 0.63 * step * ky)) / ky); if (d <= 1000) centroid2 += h[2]; });
    A.state.cellArea = null;
    return { lensTests, area, got: res.population, expected, centroid, got2: res2.population, centroid2, cells: res.cells };
  });
  ck('ячейка целиком в круге -> доля 1', Math.abs(math.lensTests.full - 1) < 1e-9);
  ck('ячейка вне круга -> 0', math.lensTests.none === 0);
  /* Центр малого диска на границе большого: доля меньше половины, потому что граница
     большого круга выпукла и «срезает» больше половины малого диска. Для r=484, R=1000
     точное значение около 0.45. */
  ck('центр ячейки на границе круга -> доля около 0.45', Math.abs(math.lensTests.half - 0.45) < 0.03, math.lensTests.half.toFixed(3));
  ck('пересечение симметрично', math.lensTests.sym);
  ck('площадь ячейки оценена по сетке (шаг 900 м -> (√3/2)·d² ≈ 0.70 км²)', Math.abs(math.area - Math.sqrt(3) / 2 * 900 * 900) / math.area < 0.02, String(math.area));
  const errAreal = Math.max(Math.abs(math.got - math.expected), Math.abs(math.got2 - math.expected)) / math.expected;
  const errCentroid = Math.max(Math.abs(math.centroid - math.expected), Math.abs(math.centroid2 - math.expected)) / math.expected;
  ck('счёт по долям площади в пределах 8% от плотность·πR² в двух точках', errAreal < 0.08, `получено ${math.got} и ${math.got2}, ожидалось ${Math.round(math.expected)}, ошибка до ${(errAreal * 100).toFixed(1)}%`);
  ck('счёт по центроидам на той же сетке хуже (тест различает методы)', errCentroid > errAreal, `центроиды: ${math.centroid} и ${math.centroid2}, ошибка до ${(errCentroid * 100).toFixed(1)}%`);

  console.log('\n--- 3. Зонд студии считает по калиброванной сетке');
  /* Внутри CASE OS студия калибрует сетку сама при получении контекста, поэтому здесь
     проверяется не «до/после», а два факта: защита в зонде теперь смотрит на CAL, а не на
     POP (по исходнику), и после клика калибровка есть. */
  const guard = fs.readFileSync(path.join(OS_DIR, 'geoanalytics-studio.html'), 'utf8');
  ck('зонд проверяет калибровку по CAL, а не по всегда непустому POP', /if\(typeof CAL==='undefined'\|\|!CAL\)\{await ensureGeo\(\);calibrate\(\);\}/.test(guard) && !/if\(!POP\)\{await ensureGeo\(\);calibrate\(\);\}/.test(guard));
  const probe = await page.evaluate(async () => {
    await probeAt(41.3485, 69.3166);
    await new Promise(r => setTimeout(r, 300));
    const after = (typeof CAL !== 'undefined' && !!CAL);
    const t = document.getElementById('probe').textContent;
    return { after, opened: document.getElementById('probe').classList.contains('open'), hasPop: /Население/.test(t) };
  });
  ck('после клика по карте сетка откалибрована (раньше этот шаг не запускался никогда)', probe.after === true);
  ck('отчёт по точке открылся с населением', probe.opened && probe.hasPop);
  await page.evaluate(() => closeProbe());

  console.log('\n--- 4. Инструменты на карте');
  const t1 = await page.evaluate(async () => {
    const A = CASE_GEO_ASSIST, out = {};
    out.site = await A.run('set_site', { lat: 41.3485, lon: 69.3166, name: 'тест' });
    out.radius = await A.run('draw_radius', { radii_m: [500, 1000] });
    let n = 0; A.state.groups.radius.eachLayer(() => n++); out.circles = n;
    out.pop = await A.run('count_population', { radius_m: 1000 });
    out.popDirect = A.popInRadius(41.3485, 69.3166, 1000, CASE_GEO_DATA.POP).population;
    return out;
  });
  ck('участок задан', t1.site.ok && t1.site.site.name === 'тест');
  ck('два круга нарисованы в слое radius', t1.circles === 2);
  ck('население посчитано, число совпадает с прямым вызовом функции', t1.pop.ok && t1.pop.population === t1.popDirect && t1.pop.population > 0, String(t1.pop.population));
  ck('уверенность населения - расчёт, с калибровкой и примечанием', t1.pop.provenance.conf === 'modelled' && /откалибрована/.test(t1.pop.provenance.source) && /проверить/.test(t1.pop.provenance.note), t1.pop.provenance.source);

  const t2 = await page.evaluate(async () => {
    const A = CASE_GEO_ASSIST, out = {};
    out.b = await A.run('load_buildings', { radius_m: 500 });
    let n = 0; A.state.groups.buildings.eachLayer(() => n++); out.drawn = n;
    out.sel = await A.run('select_features', { layer: 'buildings', min_levels: 9 });
    let m = 0; A.state.groups.selection.eachLayer(() => m++); out.selDrawn = m;
    out.expectSel = A.state.data.buildings.filter(x => x.levels != null && x.levels >= 9).length;
    out.selRes = await A.run('select_features', { layer: 'buildings', kind: 'residential' });
    out.expectRes = A.state.data.buildings.filter(x => /^(residential|apartments|house)$/.test(x.kind)).length;
    out.style = await A.run('style_layer', { layer: 'buildings', color: '#2e86de', opacity: 0.6 });
    const first = []; A.state.groups.buildings.eachLayer(l => first.push(l.options.color + '/' + l.options.fillOpacity)); out.firstStyle = first[0];
    out.colorInput = document.querySelector('#gaPanel input[data-layer=buildings]').value;
    return out;
  });
  const within500 = fixtureBuildings().filter(b => { const dy = (b.c[0] - SITE.lat) * 111320, dx = (b.c[1] - SITE.lon) * 111320 * Math.cos(SITE.lat * Math.PI / 180); return Math.hypot(dx, dy) <= 500; }).length;
  ck('здания режутся по кругу: в 500 м столько, сколько в фикстуре', t2.b.ok && t2.b.count === within500, `${t2.b.count} против ${within500}`);
  ck('столько же полигонов нарисовано', t2.drawn === t2.b.count);
  ck('площадь застройки просуммирована', t2.b.footprint_area_m2 === t2.b.count * 1600, String(t2.b.footprint_area_m2));
  ck('происхождение зданий: наблюдение OSM с атрибуцией', t2.b.provenance.conf === 'asking' && /OpenStreetMap/.test(t2.b.provenance.source) && /contributors/.test(t2.b.provenance.attribution));
  ck('выделение по этажности >= 9 совпадает с данными', t2.sel.matched === t2.expectSel && t2.selDrawn === t2.expectSel, `${t2.sel.matched}/${t2.expectSel}`);
  ck('выделение жилых по группе типов', t2.selRes.matched === t2.expectRes, `${t2.selRes.matched}/${t2.expectRes}`);
  ck('перекраска слоя меняет нарисованные полигоны', t2.firstStyle === '#2e86de/0.6', t2.firstStyle);
  ck('цветовое поле в панели синхронизировано', t2.colorInput === '#2e86de', t2.colorInput);

  const t3 = await page.evaluate(async () => {
    const A = CASE_GEO_ASSIST, out = {};
    out.r = await A.run('load_roads', { radius_m: 1000 });
    let n = 0; A.state.groups.roads.eachLayer(() => n++); out.drawn = n;
    out.major = await A.run('select_features', { layer: 'roads', classes: ['motorway', 'trunk', 'primary', 'secondary'] });
    out.comp = await A.run('count_competitors', { radius_m: 3000 });
    try { out.iso = await A.run('draw_isochrone', { minutes: 10 }); } catch (e) { out.isoErr = String(e.message); }
    try { await A.run('style_layer', { layer: 'nope', color: '#000000' }); } catch (e) { out.badLayer = String(e.message); }
    out.clear = await A.run('clear_layers', { layers: ['all'] });
    let m = 0; ['buildings', 'roads', 'radius', 'selection'].forEach(k => { if (A.state.groups[k]) A.state.groups[k].eachLayer(() => m++); }); out.left = m;
    return out;
  });
  ck('дорог в 1 км: четыре из пяти (дальняя отсечена)', t3.r.ok && t3.r.count === 4, String(t3.r.count));
  ck('линии нарисованы', t3.drawn === 4);
  ck('класс и длина посчитаны', t3.r.length_km > 4 && t3.r.by_class.some(c => c.cls === 'primary'), JSON.stringify(t3.r.by_class));
  ck('«только магистрали» выделяет primary и secondary', t3.major.matched === 2, String(t3.major.matched));
  ck('конкуренты из базы БЦ с происхождением «наблюдение»', t3.comp.ok && t3.comp.business_centers > 0 && t3.comp.provenance.conf === 'asking', String(t3.comp.business_centers));
  ck('изохрона без маршрутизатора объясняет и предлагает радиус', !!t3.isoErr && /радиус/i.test(t3.isoErr), t3.isoErr);
  ck('неизвестный слой отклоняется с подсказкой', /Доступны/.test(t3.badLayer || ''), t3.badLayer);
  ck('очистка убирает всё', t3.clear.cleared.length === 5 && t3.left === 0, String(t3.left));
  ck('прокси вызывался с нужными радиусами', proxyCalls.some(c => c.mode === 'buildings' && c.radius === 500) && proxyCalls.some(c => c.mode === 'roads' && c.radius === 1000), JSON.stringify(proxyCalls));

  console.log('\n--- 5. Диалог через панель');
  const ui = await page.evaluate(async () => {
    const inp = document.getElementById('gaInput');
    inp.value = 'радиус 1 км и население 1 км';
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));
    const log = document.getElementById('gaLog');
    return { you: log.querySelectorAll('.ga-you').length, facts: log.querySelectorAll('.ga-fact').length, chips: log.querySelectorAll('.ga-prov.ga-m').length,
      sysNote: [...log.querySelectorAll('.ga-sys')].map(x => x.textContent).join(' | '), num: (log.querySelector('.ga-num') || {}).textContent, cleared: inp.value === '' };
  });
  ck('реплика пользователя и два факта в журнале', ui.you === 1 && ui.facts === 2, JSON.stringify({ you: ui.you, facts: ui.facts }));
  ck('у населения плашка «расчёт»', ui.chips >= 1);
  ck('без ответа платформы сказано, что команды исполняются без модели', /без модели/.test(ui.sysNote), ui.sysNote);
  ck('число выведено', !!ui.num && /\d/.test(ui.num), ui.num);
  ck('поле ввода очищено', ui.cleared);
  const junk = await page.evaluate(async () => { await CASE_GEO_ASSIST.ask('как дела?'); const s = [...document.querySelectorAll('#gaLog .ga-sys')].pop(); return s ? s.textContent : ''; });
  ck('нераспознанная фраза получает подсказку с примерами', /Примеры/.test(junk), junk.slice(0, 60));

  ck('ошибок страницы за прогон нет', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close(); srv.close();
  console.log('\n' + (bad ? `ПРОВАЛЕНО проверок: ${bad}\n` : 'Инструменты гео-ассистента ведут себя верно\n'));
  process.exit(bad ? 1 : 0);
});
