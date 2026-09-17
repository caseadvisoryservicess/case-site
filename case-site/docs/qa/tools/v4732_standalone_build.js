/* CASE Geo Analytics одним файлом: сборка из студии и работа с диска без сервера CASE OS.

   Владелец: «give me geo analytics as a separate product with all functions as an html file».
   Файл собирается из тех же исходников, что экран CASE OS, а сервер заменён браузером.
   Что проверяется:

     1. Сборка: один файл, ни одного внешнего <script src>, шапка «CASE Geo Analytics», шим и
        данные встроены, версия совпадает с APP_VERSION, в шиме нет длинных тире.
     2. Открытие С ДИСКА (file://), рядом ничего нет; сеть только к Overpass и Nominatim,
        и та подменена фикстурами: к серверу CASE OS не уходит ни одного запроса.
        Карта, районы из файла, мастер-геобаза из файла, гео-агент: точка, радиус, население,
        здания и дороги через Overpass (тот же разбор, что на сервере), адрес через Nominatim,
        слой POI и транспорт с маршрутами через Overpass, «Связь», «не понял» без модели,
        отчёт по точке кликом, выгрузка на месте, правка сохраняется в localStorage.
     3. Полностью без сети: карта, районы, население, радиусы и агент работают, а слои из
        интернета честно говорят, что сети нет.

   Запуск: NODE_PATH=... node v4732_standalone_build.js [папка os] */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { build } = require('./build_geo_standalone.js');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
  const tmp = path.join(__dirname, 'indep_v4732'); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const OUT = path.join(tmp, 'CASE_Geo_Analytics.html');

  console.log('--- 1. Сборка');
  const r = build(OS, OUT);
  const html = fs.readFileSync(OUT, 'utf8');
  const appVer = (fs.readFileSync(path.join(OS, 'index.html'), 'utf8').match(/APP_VERSION='([\d.]+)'/) || [])[1];
  ck('один файл, рядом ничего нет', fs.readdirSync(tmp).length === 1, fs.readdirSync(tmp).join(', '));
  ck('размер разумный (2-8 МБ)', r.bytes > 2e6 && r.bytes < 8e6, (r.bytes / 1048576).toFixed(2) + ' МБ');
  ck('внешних скриптов нет, все двенадцать встроены (с v4.76.0 ещё бизнес-центры и права студии)', !/<script src=/.test(html) && r.inlined.length === 12 && r.inlined.indexOf('geo-direct.js') >= 0 && r.inlined.indexOf('v4740-geo-tree.js') >= 0 && r.inlined.indexOf('v4750-geo-layout.js') >= 0 && r.inlined.indexOf('v4750-geo-tools.js') >= 0 && r.inlined.indexOf('v4760-geo-bc.js') >= 0 && r.inlined.indexOf('v4760-geo-caps.js') >= 0, r.inlined.join(', '));
  ck('версия равна APP_VERSION платформы', r.version === appVer && html.indexOf("version: '" + appVer + "'") > 0, r.version + ' / ' + appVer);
  ck('шапка «CASE Geo Analytics», данные и шим на месте', /<b>CASE<\/b> Geo Analytics/.test(html) && /CASE_STANDALONE_DATA=/.test(html) && /window\.CASE_STANDALONE =/.test(html) && /<title>CASE Geo Analytics/.test(html));
  ck('районов 12, мастер-база с БЦ, медициной и аптеками', r.districts === 12 && r.master.bc > 100 && r.master.medicine > 1000 && r.master.pharmacies > 500, JSON.stringify(r.master));
  const shim = fs.readFileSync(path.join(__dirname, '..', '..', 'standalone', 'standalone-shim.js'), 'utf8');
  ck('в шиме и сборщике нет длинных тире', !new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(shim + fs.readFileSync(__filename, 'utf8').split('/* CASE Geo Analytics')[0]));

  /* фикстуры Overpass и Nominatim, разбираются по тексту запроса */
  const ring = (la, ln, d) => [[la - d, ln - d], [la + d, ln - d], [la + d, ln + d], [la - d, ln + d], [la - d, ln - d]].map(p => ({ lat: p[0], lon: p[1] }));
  const OVERPASS = ql => {
    if (/way\["building"\]/.test(ql)) return { elements: [
      { type: 'way', id: 1, tags: { building: 'apartments', 'building:levels': '12', name: 'Дом 1' }, geometry: ring(41.3115, 69.2800, 0.0002) },
      { type: 'way', id: 2, tags: { building: 'commercial', 'building:levels': '5' }, geometry: ring(41.3130, 69.2797, 0.0002) },
      { type: 'way', id: 3, tags: { building: 'yes' }, geometry: ring(41.3300, 69.2797, 0.0002) },
      { type: 'node', id: 4, lat: 41.31, lon: 69.28, tags: {} }] };
    if (/way\["highway"~/.test(ql)) return { elements: [
      { type: 'way', id: 11, tags: { highway: 'primary', name: 'Проспект', oneway: 'yes', lanes: '4' }, geometry: [{ lat: 41.3050, lon: 69.2700 }, { lat: 41.3170, lon: 69.2900 }] },
      { type: 'way', id: 12, tags: { highway: 'residential', name: 'Далёкая' }, geometry: [{ lat: 41.3400, lon: 69.2700 }, { lat: 41.3400, lon: 69.2900 }] }] };
    if (/rel\(bn\.n\)/.test(ql)) return { elements: [
      { type: 'node', id: 501, lat: 41.3120, lon: 69.2790, tags: { highway: 'bus_stop', 'addr:street': 'Амира Темура' } },
      { type: 'node', id: 502, lat: 41.3140, lon: 69.2810, tags: { highway: 'bus_stop', name: 'Сквер' } },
      { type: 'node', id: 503, lat: 41.3160, lon: 69.2830, tags: { public_transport: 'platform' } },
      { type: 'relation', id: 900, tags: { type: 'route', route: 'bus', ref: '12', name: 'Автобус 12' }, members: [{ type: 'node', ref: 501 }, { type: 'node', ref: 502 }] },
      { type: 'relation', id: 901, tags: { type: 'route', route: 'bus', ref: '3' }, members: [{ type: 'node', ref: 501 }] }] };
    if (/fast_food/.test(ql)) return { elements: [
      { type: 'node', id: 21, lat: 41.3118, lon: 69.2801, tags: { amenity: 'fast_food', name: 'Плов-центр', 'addr:street': 'Ц-1', 'addr:housenumber': '5' } },
      { type: 'way', id: 22, center: { lat: 41.3125, lon: 69.2811 }, tags: { amenity: 'fast_food', name: 'Чайхана Навват' } },
      { type: 'node', id: 23, lat: 41.3128, lon: 69.2815, tags: { amenity: 'fast_food' } },
      { type: 'node', id: 24, lat: 41.3118, lon: 69.2801, tags: { amenity: 'fast_food', name: 'Плов-центр' } }] };
    return { elements: [] };
  };
  const NOMINATIM = [{ display_name: 'улица Амира Темура, 15, Ташкент, Узбекистан', lat: '41.3123', lon: '69.2801', type: 'house' }, { display_name: 'мусор' }];

  console.log('\n--- 2. Открытие с диска, сервера CASE OS нет');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [], requested = [], dialogs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  pg.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await pg.route('**/*', r => {
    const u = r.request().url(); requested.push(u);
    if (/^(file|data|blob):/.test(u)) return r.continue();
    if (/overpass-api\.de\/api\/interpreter/.test(u)) { const ql = new URL(u).searchParams.get('data') || ''; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OVERPASS(ql)) }); }
    if (/overpass-api\.de\/api\/status/.test(u)) return r.fulfill({ status: 200, contentType: 'text/plain', body: 'Connected as: 1\nCurrent time: now' });
    if (/nominatim\.openstreetmap\.org\/search/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM) });
    if (/nominatim\.openstreetmap\.org\/status/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":0,"message":"OK"}' });
    return r.abort();
  });
  await pg.goto('file://' + OUT, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.CASE_GEO_AGENT && document.getElementById('gaPanel') && typeof window.caseGeoSetPoint === 'function' && window.ASAAS_GEO_MASTER_READY === true, null, { timeout: 30000 });
  await pg.waitForTimeout(2500);
  const s = await pg.evaluate(() => ({ standalone: !!window.CASE_STANDALONE, ver: window.CASE_STANDALONE.version, pending: document.body.classList.contains('geo-auth-pending'),
    denied: /доступ закрыт|Защищённый модуль/.test(document.body.innerText), header: (document.querySelector('header.top .lg') || {}).textContent || '',
    L: typeof L !== 'undefined', map: (() => { try { return !!map; } catch (e) { return false; } })(), bc: BC.length, master: !!window.ASAAS_GEO_MASTER_READY, med: MEDPTS.length,
    edit: (document.getElementById('geoAccess') || {}).textContent || '', tabs: [...document.querySelectorAll('.tabs button')].filter(b => getComputedStyle(b).display !== 'none').map(b => b.textContent) }));
  ck('файл открылся с диска, гейт входа пройден без сервера', s.standalone && !s.pending && !s.denied && s.ver === appVer, JSON.stringify({ pending: s.pending, denied: s.denied }));
  ck('шапка «CASE Geo Analytics», карта и Leaflet из файла', /Geo Analytics/.test(s.header) && s.L && s.map, s.header);
  ck('мастер-геобаза из файла: БЦ и медицина', s.master && s.bc > 100 && s.med > 1000, 'БЦ ' + s.bc + ', медицина ' + s.med);
  ck('правка разрешена локально, вкладок про проект и «Сравнения стран» нет (v4.76.0)', /РЕДАКТИРОВАНИЕ/.test(s.edit) && s.tabs.length === 3, s.edit + ' / ' + s.tabs.join(','));
  ck('ошибок сценария при открытии нет', errs.length === 0, errs[0] || 'нет');

  const dist = await pg.evaluate(async () => { const cb = document.getElementById('lDist'); cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    for (let i = 0; i < 40; i++) { try { if (gDist && gDist.getLayers().length) break; } catch (e) {} await new Promise(r => setTimeout(r, 250)); }
    return { n: DISTGEO && DISTGEO.features ? DISTGEO.features.length : 0, layers: (() => { try { return gDist.getLayers().length; } catch (e) { return -1; } })() }; });
  ck('границы районов взялись из файла и нарисованы', dist.n === 12 && dist.layers > 0, JSON.stringify(dist));

  const ask = t => pg.evaluate(async t => { const A = window.CASE_GEO_AGENT, n0 = A.state.log.length; await A.ask(t); return A.state.log.slice(n0).map(m => m.who + ':' + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }, t);
  const has = (log, who, re) => log.some(l => l.indexOf(who + ':') === 0 && re.test(l));
  let log = await ask('41.3111, 69.2797');
  const pt = await pg.evaluate(() => window.caseGeoPoint());
  ck('агент ставит точку анализа, район найден по встроенным границам', !pt.pending && near(pt.lat, 41.3111, 1e-6) && !!pt.district, JSON.stringify(pt));
  log = await ask('радиус 500 м и 1 км и население 1 км');
  const pop = +(((log.find(l => /^fact:Население/.test(l)) || '').match(/(\d[\d\s ]*)\s+жителей/) || ['', '0'])[1].replace(/\D/g, ''));
  ck('население по встроенной сетке с калибровкой', pop > 1000 && has(log, 'fact', /расчёт/), pop + ' жителей');
  log = await ask('здания 500 м');
  const bld = await pg.evaluate(() => ({ n: (window.CASE_GEO_AGENT.state.data.buildings || []).length, first: (window.CASE_GEO_AGENT.state.data.buildings || [])[0] }));
  ck('здания через Overpass из браузера, разбор как на сервере (2 из 3 в круге, этажность, площадь)', bld.n === 2 && bld.first && bld.first.levels === 12 && bld.first.area > 100 && bld.first.kind === 'apartments' && has(log, 'fact', /OpenStreetMap contributors/), JSON.stringify(bld));
  log = await ask('дороги 500 м');
  const rd = await pg.evaluate(() => (window.CASE_GEO_AGENT.state.data.roads || []).map(w => w.cls + ':' + w.name + ':' + w.oneway + ':' + w.lanes));
  ck('дороги через Overpass: проспект по отрезку, далёкая отброшена, полосы и односторонность', rd.length === 1 && rd[0] === 'primary:Проспект:true:4', rd.join(' | '));
  log = await ask('адрес: Амира Темура 15');
  const geo = await pg.evaluate(() => window.caseGeoPoint());
  ck('адрес через Nominatim из браузера, мусор без координат отброшен', near(geo.lat, 41.3123, 1e-6) && /Амира Темура/.test(geo.name) && has(log, 'fact', /наблюдение/), JSON.stringify(geo));
  log = await ask('проверь связь');
  ck('«Связь» проверяет Overpass и Nominatim из браузера и говорит, что сервера нет', has(log, 'fact', /Overpass API .* доступен/) && has(log, 'fact', /Nominatim/) && has(log, 'fact', /сервера CASE OS нет/), log.join(' | ').slice(0, 300));
  log = await ask('расскажи анекдот');
  ck('без своей модели агент честно говорит «не понял»', has(log, 'ai', /Не понял/), log.join(' | ').slice(0, 200));

  const poi = await pg.evaluate(async () => {
    const cb = document.getElementById('geoLayer-fast_food'); if (!cb) return { nocb: true };
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    const P = window.CASE_GEO_POI;
    for (let i = 0; i < 40 && !(P.rows('fast_food') || []).some(r => r.provider === 'OSM'); i++) await new Promise(r => setTimeout(r, 250));
    const rows = (P.rows('fast_food') || []).filter(r => r.provider === 'OSM');
    return { n: rows.length, names: rows.map(r => r.name).join(','), addr: (rows.find(r => /Плов/.test(r.name)) || {}).address };
  });
  ck('слой POI (фастфуд, в мастер-базе пуст) грузится из Overpass: с именами, без дублей, с адресом', poi.n === 2 && /Плов-центр/.test(poi.names) && /Навват/.test(poi.names) && poi.addr === 'Ц-1 5', JSON.stringify(poi));
  const tr = await pg.evaluate(async () => {
    const cb = document.getElementById('geoLayer-transport_hubs'); if (!cb) return { nocb: true };
    cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true }));
    const P = window.CASE_GEO_POI;
    for (let i = 0; i < 40 && !(P.rows('transport_hubs') || []).length; i++) await new Promise(r => setTimeout(r, 250));
    return (P.rows('transport_hubs') || []).map(r => r.name + '|' + r.routes + '|' + r.routesCount);
  });
  ck('транспорт: остановки без имени названы по улице, маршруты из отношений, платформа без признака отброшена', tr.length === 2 && tr.some(x => /Автобусная остановка - Амира Темура\|автобус: 3, 12\|2/.test(x)) && tr.some(x => /^Сквер\|автобус: 12\|1$/.test(x)), tr.join(' ; '));

  const probe = await pg.evaluate(async () => { await probeAt(41.3111, 69.2797); await new Promise(r => setTimeout(r, 1200));
    return { open: document.getElementById('probe').classList.contains('open'), la: typeof LASTPROBE === 'object' && LASTPROBE ? LASTPROBE.la : null, exportBtn: !!document.getElementById('btnProjExport'), settings: typeof window.caseGeoExportSettings === 'function', sun: typeof window.caseSunOpen === 'function', huff: typeof window.caseHuffOpen === 'function' }; });
  ck('отчёт по точке, выгрузка, солнце и Хафф на месте', probe.open && near(probe.la, 41.3111, 1e-4) && probe.exportBtn && probe.settings && probe.sun && probe.huff, JSON.stringify(probe));
  await pg.evaluate(() => closeProbe());
  const saved = await pg.evaluate(() => { try { return !!localStorage.getItem('asaas_geo_v1') && JSON.parse(localStorage.getItem('asaas_geo_v1')).datasets !== undefined; } catch (e) { return false; } });
  ck('правки (загруженный слой) сохранены в localStorage браузера', saved);
  const leaks = requested.filter(u => /api\/[a-z_]+\.php|data\/tashkent/.test(u));
  ck('ни одного запроса к серверу CASE OS: все перехвачены в браузере', leaks.length === 0, leaks[0] || 'нет');
  const shimLog = await pg.evaluate(() => window.CASE_STANDALONE.log.slice(0, 6).join(' ; '));
  ck('шим видел запросы студии к «серверу»', /api\/auth\.php/.test(shimLog) && /geo_master/.test(shimLog), shimLog);
  ck('ошибок сценария нет', errs.length === 0, errs[0] || 'нет');
  await pg.close();

  console.log('\n--- 3. Совсем без сети');
  const off = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs3 = [];
  off.on('pageerror', e => errs3.push(e.message.slice(0, 160)));
  await off.route('**/*', r => /^(file|data|blob):/.test(r.request().url()) ? r.continue() : r.abort());
  await off.goto('file://' + OUT, { waitUntil: 'domcontentloaded' });
  await off.waitForFunction(() => window.CASE_GEO_AGENT && document.getElementById('gaPanel') && window.ASAAS_GEO_MASTER_READY === true, null, { timeout: 30000 });
  await off.waitForTimeout(2000);
  const o = await off.evaluate(async () => {
    const A = window.CASE_GEO_AGENT, n0 = A.state.log.length;
    await A.ask('41.3111, 69.2797'); await A.ask('радиус 1 км и население'); await A.ask('здания 500 м'); await A.ask('проверь связь');
    const log = A.state.log.slice(n0).map(m => m.who + ':' + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return { log, bc: BC.length, zone: A.state.zone.length, dist: DISTGEO && DISTGEO.features ? DISTGEO.features.length : 0 };
  });
  const real3 = errs3.filter(e => !/Failed to fetch|net::|NetworkError|Load failed/i.test(e));
  ck('без сети: карта, районы, БЦ и население из файла работают', o.bc > 100 && o.dist === 12 && o.zone === 1 && o.log.some(l => /^fact:Население/.test(l)), o.log.filter(l => /Население/.test(l)).join(' | ').slice(0, 160));
  ck('без сети: здания честно недоступны, «Связь» объясняет причину', o.log.some(l => /^err:Здания/.test(l)) && o.log.some(l => /интернета нет|не отвечает из браузера/.test(l)), o.log.filter(l => /Здания|Итог/.test(l)).join(' | ').slice(0, 240));
  ck('без сети: ошибок сценария нет', real3.length === 0, real3[0] || 'нет');

  await b.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nCASE Geo Analytics собирается одним файлом и работает с диска без сервера');
  process.exit(bad ? 1 : 0);
})();
