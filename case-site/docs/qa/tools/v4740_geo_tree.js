/* v4.74.0: дерево слоёв, кнопка подложки и OSM из браузера в студии геоаналитики.

   Замечания владельца: «пропала кнопка где можно менять карты», «левое боковое меню должно
   быть как фильтрация: ставим галочки и на карте появляются изменения, районы, хитмап,
   объекты по категориям и подкатегориям», а PHP хостинга не выпускают в интернет. Что
   проверяется на студии с мок-бэкендом:

     1. «Слои и стиль» стали деревом: первым узел «Границы и плотность» (с v4.75.0 узла
        «Подложка карты» в дереве нет, подложку меняет кнопка у карты), далее категории с
        общей галочкой и счётчиком; строки городских объектов, дорисованные позже, попали в
        свои категории.
     2. Общая галочка включает все слои категории (обработчики слоёв срабатывают: границы
        районов рисуются), счётчик и подсветка узла; повторный клик выключает.
     3. Узел сворачивается и помнится; поиск по слоям оставляет только подходящие категории.
     4. Кнопка подложки у карты: имя текущей карты, выбор Google меняет тайлы, выбор помнится,
        стандартный переключатель Leaflet скрыт; в дереве радио подложки больше нет.
     5. geo-direct: сервер отвечает «Overpass недоступен с сервера», здания и адрес приходят из
        браузера с пометкой; когда сервер отвечает сам, браузер не дёргается; «Связь» показывает
        оба пути.

   Запуск: NODE_PATH=... node v4740_geo_tree.js [папка os] */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base, state } = await createMockServer(OS, { initialState: {} });
  state.geo.data = { version: 2, projects: [], datasets: {}, meta: {} };
  const ring = (la, ln, d) => [[la - d, ln - d], [la + d, ln - d], [la + d, ln + d], [la - d, ln + d], [la - d, ln - d]].map(p => ({ lat: p[0], lon: p[1] }));
  const OVERPASS = ql => {
    if (/way\["building"\]/.test(ql)) return { elements: [
      { type: 'way', id: 1, tags: { building: 'apartments', 'building:levels': '12', name: 'Дом 1' }, geometry: ring(41.3115, 69.2800, 0.0002) },
      { type: 'way', id: 2, tags: { building: 'commercial', 'building:levels': '5' }, geometry: ring(41.3130, 69.2797, 0.0002) },
      { type: 'way', id: 3, tags: { building: 'yes' }, geometry: ring(41.3300, 69.2797, 0.0002) }] };
    return { elements: [] };
  };
  const NOMINATIM = [{ display_name: 'улица Амира Темура, 15, Ташкент, Узбекистан', lat: '41.3123', lon: '69.2801', type: 'house' }];
  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [], overpassCalls = [], proxyCalls = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await pg.route('**/*', r => {
    const u = r.request().url();
    if (/^(data|blob):/.test(u)) return r.continue();
    if (/api\/gis_proxy\.php/.test(u)) {
      const qs = new URL(u).searchParams, mode = qs.get('mode'); proxyCalls.push(mode);
      if (mode === 'roads') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, provider: 'osm', mode: 'roads', rows: [{ id: 11, line: [[41.305, 69.27], [41.317, 69.29]], cls: 'primary', name: 'Проспект с сервера', oneway: true, lanes: 4 }], provenance: { source: 'OpenStreetMap', method: 'сервер', attribution: '© OpenStreetMap contributors', count: 1, radius_m: 500 } }) });
      if (mode === 'ping') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, facts: { overpass: { status: 0 } }, advice: ['Overpass API недоступен с сервера (сеть закрыта): напишите в поддержку хостинга.'] }) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Overpass API недоступен с сервера (сеть/таймаут). Попробуйте меньший участок.' }) });
    }
    if (u.startsWith(base)) return r.continue();
    if (/overpass-api\.de\/api\/interpreter/.test(u)) { const ql = new URL(u).searchParams.get('data') || ''; overpassCalls.push(ql.slice(0, 60)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OVERPASS(ql)) }); }
    if (/overpass-api\.de\/api\/status/.test(u)) return r.fulfill({ status: 200, contentType: 'text/plain', body: 'Connected as: 1' });
    if (/nominatim\.openstreetmap\.org\/search/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(NOMINATIM) });
    if (/nominatim\.openstreetmap\.org\/status/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: '{"status":0,"message":"OK"}' });
    return r.abort();
  });
  await pg.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.CASE_GEO_AGENT && document.getElementById('gaPanel') && window.CASE_GEO_TREE && window.CASE_GEO_DIRECT && document.querySelector('.geo-cat'), null, { timeout: 30000 });
  await pg.waitForTimeout(2500);

  console.log('--- 1. Дерево');
  const t1 = await pg.evaluate(() => {
    const cats = [...document.querySelectorAll('.geo-cat')].map(c => c.getAttribute('data-cat'));
    const horeca = document.querySelector('#geoCatAnchor-horeca'), horecaCat = horeca && horeca.closest('.geo-cat');
    return { cats, first: cats[0], second: cats[1], built: window.CASE_GEO_TREE.built, baseRadios: document.querySelectorAll('#geoCatAnchor-horeca, .geo-cat input[name=geoBaseOpt]').length, q: !!document.querySelector('.geo-tree-q'), poiRows: horeca ? horeca.querySelectorAll('.geo-poi-row').length : -1, horecaCat: horecaCat ? horecaCat.getAttribute('data-cat') : '', horecaN: horecaCat ? horecaCat.querySelector('.geo-cat-n').textContent : '', bcN: (document.querySelector('.geo-cat[data-cat="Бизнес-центры"] .geo-cat-n') || {}).textContent, bcAct: !!document.querySelector('.geo-cat[data-cat="Бизнес-центры"].geo-cat-active') };
  });
  ck('категории стали узлами: первым «Границы и плотность», узла «Подложка карты» нет (v4.75.0), всего не меньше 9', t1.built && /границы/i.test(t1.first) && !t1.cats.some(c => /подложка/i.test(c)) && t1.baseRadios === 1 && t1.cats.length >= 9 && t1.q, JSON.stringify(t1.cats));
  ck('строки городских объектов (HoReCa) попали в свою категорию, счётчик «0 / 4»; «Бизнес-центры» выключены «0 / 2» (с v4.79.0 карта открывается чистой) и не подсвечены', t1.poiRows === 4 && t1.horecaCat === 'HoReCa' && t1.horecaN === '0 / 4' && t1.bcN === '0 / 2' && !t1.bcAct, JSON.stringify({ rows: t1.poiRows, cat: t1.horecaCat, n: t1.horecaN, bc: t1.bcN, act: t1.bcAct }));

  console.log('--- 2. Общая галочка');
  const t2 = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const cat = document.querySelector('.geo-cat[data-cat="Границы и плотность"]'), all = cat.querySelector('.geo-cat-all');
    all.click(); await S(300);
    const ids = ['lDist', 'lReg', 'lDens', 'lHeat', 'geoLayer-mahallas'].map(id => document.getElementById(id).checked);
    for (let i = 0; i < 40; i++) { try { if (gDist && gDist.getLayers().length) break; } catch (e) {} await S(250); }
    const distLayers = (() => { try { return gDist.getLayers().length; } catch (e) { return -1; } })();
    const n = cat.querySelector('.geo-cat-n').textContent, act = cat.classList.contains('geo-cat-active');
    all.click(); await S(300);
    const ids2 = ['lDist', 'lReg', 'lDens', 'lHeat', 'geoLayer-mahallas'].map(id => document.getElementById(id).checked), n2 = cat.querySelector('.geo-cat-n').textContent, act2 = cat.classList.contains('geo-cat-active');
    document.getElementById('lDist').click(); await S(200); const partial = { ind: all.indeterminate, n: cat.querySelector('.geo-cat-n').textContent };
    document.getElementById('lDist').click();
    return { ids, distLayers, n, act, ids2, n2, act2, partial };
  });
  ck('общая галочка включает районы, область, плотность, тепловую карту и махалли, районы нарисованы, счётчик «5 / 5»', t2.ids.every(Boolean) && t2.distLayers > 0 && t2.n === '5 / 5' && t2.act, JSON.stringify({ ids: t2.ids, d: t2.distLayers, n: t2.n }));
  ck('повторный клик выключает всё («0 / 5»), один слой даёт частичное состояние', t2.ids2.every(v => !v) && t2.n2 === '0 / 5' && !t2.act2 && t2.partial.ind && t2.partial.n === '1 / 5', JSON.stringify({ ids2: t2.ids2, n2: t2.n2, p: t2.partial }));

  console.log('--- 3. Сворачивание, память, поиск');
  const t3 = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const cat = document.querySelector('.geo-cat[data-cat="Бизнес-центры"]'), was = cat.classList.contains('open');
    cat.querySelector('.geo-cat-name').click(); await S(50);
    const now = cat.classList.contains('open'), saved = JSON.parse(localStorage.getItem('caseos_geo_tree_v1') || '{}');
    cat.querySelector('.geo-cat-name').click();
    window.CASE_GEO_TREE.filter('аптек'); await S(50);
    const vis = [...document.querySelectorAll('.geo-cat')].filter(c => !c.classList.contains('geo-tree-hide')).map(c => c.getAttribute('data-cat'));
    const pharmRow = document.getElementById('lPharm').closest('.lrow'), pharmVis = !pharmRow.classList.contains('geo-tree-hide'), medVis = !document.getElementById('lMed').closest('.lrow').classList.contains('geo-tree-hide');
    window.CASE_GEO_TREE.filter('нет такого слоя'); await S(50); const empty = !document.querySelector('.geo-tree-empty').classList.contains('geo-tree-hide');
    window.CASE_GEO_TREE.filter(''); await S(50); const restored = document.querySelectorAll('.geo-cat.geo-tree-hide').length;
    return { was, now, saved: saved.open && saved.open['Бизнес-центры'], vis, pharmVis, medVis, empty, restored };
  });
  ck('узел сворачивается и помнится в localStorage', t3.was && !t3.now && t3.saved === 0, JSON.stringify({ was: t3.was, now: t3.now, saved: t3.saved }));
  ck('поиск «аптек»: видна только категория медицины с аптеками, строка медицины скрыта; пустой запрос всё возвращает', t3.vis.length === 1 && /медицина/i.test(t3.vis[0]) && t3.pharmVis && !t3.medVis && t3.empty && t3.restored === 0, JSON.stringify(t3));

  console.log('--- 4. Подложка');
  const t4 = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    const ctl = document.querySelector('.geo-basectl'), btn = ctl && ctl.querySelector('.geo-basectl-btn'), leafletCtl = document.querySelector('.leaflet-control-layers');
    const hiddenLeaflet = !leafletCtl || getComputedStyle(leafletCtl).display === 'none';
    const name0 = document.querySelector('.geo-basectl-name').textContent;
    btn.click(); await S(50); const menuOpen = !ctl.querySelector('.geo-basectl-menu').classList.contains('hidden');
    ctl.querySelector('input[name=geoBaseMenuOpt][value="Google Карта"]').click(); await S(200);
    const cur = window.CASE_GEO_TREE.currentBase(), name1 = document.querySelector('.geo-basectl-name').textContent, saved = (JSON.parse(localStorage.getItem('caseos_geo_tree_v1') || '{}')).base;
    let tile = ''; map.eachLayer(l => { if (l instanceof L.TileLayer) tile = l._url; });
    const treeRadio = [...document.querySelectorAll('.geo-cat input[name=geoBaseOpt]')].filter(r => r.checked).map(r => r.value);
    const menuClosed = ctl.querySelector('.geo-basectl-menu').classList.contains('hidden');
    return { has: !!ctl, hiddenLeaflet, name0, menuOpen, cur, name1, saved, tile: /google/.test(tile), treeRadio, menuClosed };
  });
  ck('кнопка подложки у карты, стандартный переключатель скрыт, имя текущей карты показано', t4.has && t4.hiddenLeaflet && t4.name0.length > 3, JSON.stringify({ has: t4.has, h: t4.hiddenLeaflet, n: t4.name0 }));
  ck('выбор Google меняет тайлы, имя и память; радио в дереве нет; меню закрывается', t4.menuOpen && t4.cur === 'Google Карта' && t4.name1 === 'Google Карта' && t4.saved === 'Google Карта' && t4.tile && t4.treeRadio.length === 0 && t4.menuClosed, JSON.stringify(t4));

  console.log('--- 5. OSM из браузера');
  const ask = t => pg.evaluate(async t => { const A = window.CASE_GEO_AGENT, n0 = A.state.log.length; await A.ask(t); return A.state.log.slice(n0).map(m => m.who + ':' + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }, t);
  const has = (log, who, re) => log.some(l => l.indexOf(who + ':') === 0 && re.test(l));
  await ask('41.3111, 69.2797');
  let log = await ask('здания 500 м');
  const bld = await pg.evaluate(() => ({ n: (window.CASE_GEO_AGENT.state.data.buildings || []).length, via: window.CASE_GEO_DIRECT.lastVia.buildings, log: window.CASE_GEO_DIRECT.log.slice(-1)[0] || '' }));
  ck('сервер не вышел в сеть: здания пришли из браузера (2 из 3 в круге), путь помечен', bld.n === 2 && bld.via === 'browser' && /из браузера/.test(bld.log) && overpassCalls.some(q => /building/.test(q)) && has(log, 'fact', /OpenStreetMap contributors/), JSON.stringify({ n: bld.n, via: bld.via, log: bld.log, calls: overpassCalls.length }));
  const before = overpassCalls.length;
  log = await ask('дороги 500 м');
  const rd = await pg.evaluate(() => ({ rows: (window.CASE_GEO_AGENT.state.data.roads || []).map(w => w.name), via: window.CASE_GEO_DIRECT.lastVia.roads }));
  ck('сервер ответил сам: дороги с сервера, браузер не дёргался', rd.rows.join() === 'Проспект с сервера' && rd.via === 'server' && overpassCalls.length === before, JSON.stringify({ rd, calls: overpassCalls.length - before }));
  log = await ask('адрес: Амира Темура 15');
  const geo = await pg.evaluate(() => window.caseGeoPoint());
  ck('адрес: геокодер недоступен с сервера, точка найдена через Nominatim из браузера', near(geo.lat, 41.3123, 1e-6) && /Амира Темура/.test(geo.name), JSON.stringify(geo));
  log = await ask('проверь связь');
  ck('«Связь» показывает оба пути: сервер закрыт, из браузера доступно', has(log, 'fact', /недоступен с сервера/) && has(log, 'fact', /доступен из браузера/) && has(log, 'fact', /запрашиваются из браузера напрямую/), log.join(' | ').slice(0, 400));
  ck('прокси запрашивался для всех режимов (сервер первым)', ['buildings', 'roads', 'geocode', 'ping'].every(m => proxyCalls.includes(m)), proxyCalls.join(','));
  ck('ошибок сценария нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');

  await b.close(); srv.close();
  console.log(bad ? '\nПРОВАЛЕНО: ' + bad : '\nДерево слоёв, подложка и OSM из браузера работают');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(2); });
