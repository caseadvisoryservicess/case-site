/* Гео-агент v4.73.0: свой движок внутри студии, без внешних сервисов ИИ.

   Владелец поставил условие: агент должен быть свой и бесплатный, без Anthropic и других
   платных моделей. Значит «понимание» запроса - детерминированный разбор в браузере, а
   числа считают инструменты по данным с происхождением. Здесь проверяется ровно это:

     0. Панель на месте, оформлена в палитре CASE, подложка по умолчанию OpenStreetMap
        (CARTO рисует «API KEY REQUIRED» поверх карты и помечен «нужен ключ»).
     1. Разбор фраз на русском, узбекском и английском даёт правильные команды: радиусы,
        население, здания, дороги, полигон (начать / готово / отмена), объединение, площадь
        зоны, «в зоне», адрес, координаты, выделение, цвет, изохрона, конкуренты, очистка,
        помощь, связь. «а 2 км?» - продолжение, а не справка.
     2. Геометрия: точка в кольце, площадь квадрата 1 км, объединение двух кругов между
        максимумом и суммой, счёт населения в зоне сходится со счётом в круге, дорога без
        вершин внутри зоны всё равно считается проходящей через неё.
     3. Поток инструментов на подменённом прокси: здания и дороги фильтруются по радиусу
        честно (центроид, ближайший отрезок), выделение по этажности, цвет слоя и «их»,
        конкуренты, продолжение «а 2 км?».
     4. Полигон кликами по карте с «готово», двойным кликом и отменой; выбор точки кликом.
        На время рисования флажок «клик = отчёт по точке» снят и потом возвращён.
     5. Зона: население, здания и дороги «в зоне», объединение, площадь.
     6. Адрес через геокодер прокси.
     7. Своя модель как запасной путь: вызывается только когда движок не разобрал фразу,
        лишние и запрещённые команды (ping, неизвестные) отбрасываются, без модели агент
        честно говорит «не понял» на языке пользователя.
     8. Проверка связи показывает советы сервера.
     9. Ошибок страницы нет, длинных тире в панели и журнале нет.

   Запуск: NODE_PATH=... node v4730_geo_agent.js [папка os] */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-9);

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base } = await createMockServer(OS, { initialState: {} });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));

  /* фикстуры прокси: прокси отдаёт всё в рамке, фильтрует по радиусу и зоне сам агент */
  const sq = (la, ln, d) => [[la - d, ln - d], [la + d, ln - d], [la + d, ln + d], [la - d, ln + d], [la - d, ln - d]];
  const BUILDINGS = [
    { id: 1, c: [41.3115, 69.2800], ring: sq(41.3115, 69.2800, 0.0002), kind: 'apartments', levels: 12, area: 800, name: 'Дом 1', addr: '' },   /* ~50 м */
    { id: 2, c: [41.3130, 69.2797], ring: sq(41.3130, 69.2797, 0.0002), kind: 'commercial', levels: 5, area: 500, name: 'Магазин', addr: '' }, /* ~210 м */
    { id: 3, c: [41.3200, 69.2797], ring: sq(41.3200, 69.2797, 0.0002), kind: 'residential', levels: null, area: 300, name: '', addr: '' },     /* ~990 м */
    { id: 4, c: [41.3300, 69.2797], ring: sq(41.3300, 69.2797, 0.0002), kind: 'house', levels: 2, area: 120, name: '', addr: '' }];             /* ~2.1 км */
  const ROADS = [
    { id: 11, line: [[41.3050, 69.2700], [41.3170, 69.2900]], cls: 'primary', name: 'Проспект', oneway: false },   /* вершины в 1 км, отрезок в 25 м от точки */
    { id: 12, line: [[41.3400, 69.2700], [41.3400, 69.2900]], cls: 'residential', name: 'Далёкая', oneway: false },
    { id: 13, line: [[41.3111, 69.2797], [41.3111, 69.2850]], cls: 'residential', name: '', oneway: true }];
  const prov = { source: 'OpenStreetMap', licence: 'ODbL 1.0', attribution: '© OpenStreetMap contributors', method: 'Overpass API', fetched_at: '2026-09-16T10:00:00+05:00', cached: false, conf: 'asking' };
  const hits = { buildings: 0, roads: 0, geocode: 0, ping: 0, llm: [] };
  let llmMode = 'ok';

  await pg.route('**/*', r => {
    const u = r.request().url();
    return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort();
  });
  await pg.route('**/api/gis_proxy.php**', r => {
    const u = new URL(r.request().url()); const mode = u.searchParams.get('mode');
    const j = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (mode === 'buildings') { hits.buildings++; return j({ ok: true, provider: 'osm', mode, rows: BUILDINGS, provenance: prov, truncated: false }); }
    if (mode === 'roads') { hits.roads++; return j({ ok: true, provider: 'osm', mode, rows: ROADS, provenance: prov, truncated: false }); }
    if (mode === 'geocode') { hits.geocode++; return j({ ok: true, results: [{ name: 'улица Амира Темура, 15, Ташкент', lat: 41.3123, lon: 69.2801, type: 'house' }, { name: 'другой вариант', lat: 41.3, lon: 69.3, type: 'street' }], cached: false, attribution: '© OpenStreetMap contributors' }); }
    if (mode === 'ping') { hits.ping++; return j({ ok: true, facts: { env: { curl: true } }, advice: ['Overpass API (здания и дороги OSM) доступен: HTTP 200 за 90 мс.', 'Своя модель не настроена: запросы разбираются детерминированным движком команд.'] }); }
    return j({ ok: true, rows: [] });
  });
  await pg.route('**/api/llm.php**', r => {
    const u = new URL(r.request().url()); hits.llm.push(u.searchParams.get('q'));
    const j = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (llmMode === 'ok') return j({ ok: true, calls: [{ name: 'draw_radius', input: { radii_m: [700] } }, { name: 'ping', input: {} }, { name: 'evil_tool', input: {} }, { name: 'count_population', input: { radius_m: 700 } }], used: 'llm', model: 'llama3', ms: 5 });
    return j({ ok: false, needs_llm: true, message: 'Своя модель не настроена' });
  });

  await pg.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.CASE_GEO_AGENT && document.getElementById('gaPanel') && document.getElementById('gaSend'), null, { timeout: 20000 });
  await pg.waitForTimeout(1500);

  const ask = t => pg.evaluate(async t => {
    const A = window.CASE_GEO_AGENT, n0 = A.state.log.length;
    await A.ask(t);
    return A.state.log.slice(n0).map(m => m.who + ':' + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }, t);
  const st = () => pg.evaluate(() => { const S = window.CASE_GEO_AGENT.state; return { site: S.site, zone: S.zone.map(z => ({ kind: z.kind, r: z.r, n: z.ring ? z.ring.length : 0 })), merged: S.merged, draw: S.draw ? S.draw.pts.length : null, pick: S.pick, b: S.data.buildings ? S.data.buildings.length : null, r: S.data.roads ? S.data.roads.length : null, styles: S.styles, lastLayer: S.lastLayer, probe: document.getElementById('lProbe').checked, done: document.getElementById('gaDone').disabled, lastIntents: S.lastIntents }; });
  const has = (log, who, re) => log.some(l => l.indexOf(who + ':') === 0 && re.test(l));

  console.log('--- 0. Панель, оформление, подложка');
  const s0 = await pg.evaluate(() => {
    const A = window.CASE_GEO_AGENT, p = document.getElementById('gaPanel'), h3 = p.querySelector('h3');
    const cs = getComputedStyle, rgb = s => (s.match(/\d+/g) || []).map(Number), DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
    const hb = rgb(cs(h3).backgroundColor), sb = rgb(cs(document.getElementById('gaSend')).backgroundColor);
    const first = document.querySelector('.left>.sect');
    return { ver: A.version, mod: (window.CASE_MODULE_VERSIONS || {})['v4730-geo-agent'], title: h3.textContent.trim(), badge: !!p.querySelector('.ga-badge'),
      radius: cs(p).borderRadius, sectRadius: cs(first).borderRadius, sectBg: cs(first).backgroundColor, leftBg: cs(document.querySelector('.left')).backgroundColor,
      h3dark: hb.length >= 3 && hb[0] < 60 && hb[1] < 60 && hb[2] < 60, sendRed: sb[0] === 158 && sb[1] === 0 && sb[2] === 0, sendRound: cs(document.getElementById('gaSend')).borderRadius,
      chips: p.querySelectorAll('.ga-chip').length, colors: p.querySelectorAll('input[type=color][data-layer]').length,
      ids: ['gaPick', 'gaPoly', 'gaDone', 'gaPing', 'gaInput', 'gaSend', 'gaLog', 'gaSite'].every(id => !!document.getElementById(id)),
      dash: DASH.test(p.innerHTML) || DASH.test(document.getElementById('gaCss').textContent),
      osmFirst: Object.keys(window.BASES || {})[0] === 'OpenStreetMap', cartoKeyed: Object.keys(window.BASES || {}).filter(k => /CARTO/.test(k)).every(k => /ключ/.test(k)),
      probe: document.getElementById('lProbe').checked, noAi: !/anthropic|claude|openai/i.test(p.textContent),
      tools: Object.keys(A.TOOLS).sort().join(',') };
  });
  ck('модуль 4.73.1 зарегистрирован', s0.ver === '4.73.1' && s0.mod === '4.73.1');
  ck('заголовок «Гео-агент» с меткой «свой движок»', /Гео-агент/.test(s0.title) && s0.badge, s0.title);
  ck('панель и секции - карточки со скруглением 12px на бумаге CASE', s0.radius === '12px' && s0.sectRadius === '12px' && s0.sectBg === 'rgb(255, 255, 255)' && s0.leftBg === 'rgb(250, 248, 245)', [s0.radius, s0.sectRadius, s0.sectBg, s0.leftBg].join(' / '));
  ck('шапка агента тёмная, кнопка отправки круглая и в оксбладе CASE', s0.h3dark && s0.sendRed && s0.sendRound === '50%');
  ck('элементы управления на месте: 12 чипов, 3 цвета, кнопки и поле', s0.ids && s0.chips === 12 && s0.colors === 3, s0.chips + ' чипов, ' + s0.colors + ' цветов');
  ck('в панели и её стилях нет длинных тире', !s0.dash);
  /* В тесте тайлы заблокированы, и студия честно переключает подложку по ошибкам загрузки,
     поэтому «какая подложка сейчас» здесь не показатель. Проверяем исходник: по умолчанию
     включается OpenStreetMap, и он же первый в порядке автозамены. */
  const studioSrc = require('fs').readFileSync(path.join(OS, 'geoanalytics-studio.html'), 'utf8');
  ck('подложка по умолчанию OpenStreetMap, CARTO помечен «нужен ключ»', s0.osmFirst && s0.cartoKeyed && studioSrc.includes("window.BASES['OpenStreetMap'].addTo(map)") && /order=\['OpenStreetMap'/.test(studioSrc) && !/BASES\['CARTO[^']*'\]\.addTo/.test(studioSrc));
  ck('в панели нет упоминаний внешних ИИ', s0.noAi);
  ck('набор инструментов полный', s0.tools === 'cancel_polygon,clear_layers,count_competitors,count_population,draw_isochrone,draw_polygon,draw_radius,finish_polygon,help,load_buildings,load_roads,merge_zones,ping,select_features,set_site,style_layer,zone_area', s0.tools);

  console.log('\n--- 1. Разбор фраз');
  const P = await pg.evaluate(() => {
    const A = window.CASE_GEO_AGENT;
    const n = t => (A.parse(t) || []).map(c => c.name + (c.input && c.input.zone ? '@zone' : '')).join(',');
    const i0 = (t, k) => { const c = A.parse(t) || []; return c.length ? c[0].input[k] : undefined; };
    const j0 = t => JSON.stringify(((A.parse(t) || [{}])[0] || {}).input || null);
    return {
      radiusPop: n('радиус 1 км и население'), radii: JSON.stringify(i0('радиус 500 м и 1 км', 'radii_m')),
      bld: n('здания 500 м'), bldR: i0('здания 500 м', 'radius_m'), roads: n('дороги 1 км'),
      en: n('buildings and roads within 500 m'), uz: n('500 m radiusda aholi'),
      poly: n('полигон'), polyPts: (A.parse('полигон 41.3100, 69.2790; 41.3120, 69.2790; 41.3120, 69.2810') || [{ input: {} }])[0].input.points,
      done: n('готово'), doneEn: n('done'), doneUz: n('tayyor'), cancel: n('отмена'), cancelEn: n('cancel'),
      merge: n('объедини'), mergeEn: n('merge zones'), mergeUz: n('birlashtir'), area: n('площадь зоны'),
      popZone: n('население в зоне'), bldZone: n('buildings in the zone'), roadsZoneUz: n('zonada yo‘llar'),
      addr: i0('адрес: Амира Темура 15', 'address'), addrEn: i0('address: Amir Temur 15', 'address'), coords: j0('41.3111, 69.2797'),
      help: n('помощь'), helpQ: n('что умеешь?'), ping: n('проверь связь'), pingEn: n('check connection'),
      styleOnly: n('сделай здания синими'), styleColor: i0('сделай здания синими', 'color'), styleEn: n('make roads red'), styleUz: n('binolarni ko‘k qil'),
      selLv: j0('выдели дома выше 9 этажей'), selLow: j0('выдели дома ниже 3 этажей'), selRoads: j0('выдели магистрали'), selRes: j0('выдели жилые дома'),
      comp: n('конкуренты 2 км'), compR: i0('конкуренты 2 км', 'radius_m'), clear: n('очистить'), clearEn: n('clear'),
      iso: n('изохрона 10 минут'), isoMin: i0('изохрона 10 минут', 'minutes'),
      loadColor: j0('покажи здания 500 м зелёным'), major: JSON.stringify(i0('магистрали 1 км', 'classes')),
      unknown: A.parse('расскажи анекдот') === null, empty: A.parse('') === null,
      lang: [A.detectLang('здания'), A.detectLang('buildings'), A.detectLang('binolar 500 m')].join(','),
      meters: JSON.stringify(A.metersIn('радиус 500 м и 1,5 км')), colorHex: A.colorIn('покрась в #ff0000'), colorWord: A.colorIn('ko‘k qil')
    };
  });
  ck('«радиус 1 км и население» -> круг и счёт', P.radiusPop === 'draw_radius,count_population', P.radiusPop);
  ck('два радиуса в одной фразе', P.radii === '[500,1000]', P.radii);
  ck('здания и дороги в радиусе', P.bld === 'load_buildings' && P.bldR === 500 && P.roads === 'load_roads');
  ck('английский: buildings and roads within 500 m', P.en === 'load_buildings,load_roads', P.en);
  ck('узбекский: 500 m radiusda aholi', P.uz === 'draw_radius,count_population', P.uz);
  ck('полигон: начать кликами, по координатам, готово/done/tayyor, отмена', P.poly === 'draw_polygon' && P.polyPts && P.polyPts.length === 3 && P.done === 'finish_polygon' && P.doneEn === 'finish_polygon' && P.doneUz === 'finish_polygon' && P.cancel === 'cancel_polygon' && P.cancelEn === 'cancel_polygon');
  ck('объединить и площадь зоны на трёх языках', P.merge === 'merge_zones' && P.mergeEn === 'merge_zones' && P.mergeUz === 'merge_zones' && P.area === 'zone_area');
  ck('«в зоне» переключает счёт на зону', P.popZone === 'count_population@zone' && P.bldZone === 'load_buildings@zone' && P.roadsZoneUz === 'load_roads@zone', [P.popZone, P.bldZone, P.roadsZoneUz].join(' / '));
  ck('адрес и координаты', P.addr === 'Амира Темура 15' && P.addrEn === 'Amir Temur 15' && P.coords === '{"lat":41.3111,"lon":69.2797}');
  ck('помощь и связь', P.help === 'help' && P.helpQ === 'help' && P.ping === 'ping' && P.pingEn === 'ping');
  ck('«сделай здания синими» - только цвет, без загрузки', P.styleOnly === 'style_layer' && P.styleColor === '#2e86de' && P.styleEn === 'style_layer' && P.styleUz === 'style_layer', [P.styleOnly, P.styleEn, P.styleUz].join(' / '));
  ck('выделение по этажности, типу и классу дорог', P.selLv === '{"layer":"buildings","min_levels":9}' && P.selLow === '{"layer":"buildings","max_levels":3}' && /"classes":\["motorway"/.test(P.selRoads) && /"kind":"residential"/.test(P.selRes), [P.selLv, P.selLow].join(' / '));
  ck('конкуренты, очистка, изохрона', P.comp === 'count_competitors' && P.compR === 2000 && P.clear === 'clear_layers' && P.clearEn === 'clear_layers' && P.iso === 'draw_isochrone' && P.isoMin === 10);
  ck('цвет в фразе с загрузкой уходит в загрузчик; магистрали дают классы', /"color":"#27ae60"/.test(P.loadColor) && /"radius_m":500/.test(P.loadColor) && /motorway/.test(P.major), P.loadColor);
  ck('неизвестная и пустая фраза -> null', P.unknown && P.empty);
  ck('язык, метры и цвета', P.lang === 'ru,en,uz' && P.meters === '[500,1500]' && P.colorHex === '#ff0000' && P.colorWord === '#2e86de', [P.lang, P.meters].join(' / '));

  console.log('\n--- 2. Геометрия');
  const G = await pg.evaluate(() => {
    const A = window.CASE_GEO_AGENT, lat = 41.3111, lon = 69.2797;
    const dLat = 1000 / 111320, dLon = 1000 / (111320 * Math.cos(lat * Math.PI / 180));
    const ring = [[lat - dLat / 2, lon - dLon / 2], [lat + dLat / 2, lon - dLon / 2], [lat + dLat / 2, lon + dLon / 2], [lat - dLat / 2, lon + dLon / 2]];
    const sqArea = A.zoneAreaM2([{ kind: 'polygon', ring }]);
    const c1 = { kind: 'circle', lat, lon, r: 500 }, c2 = { kind: 'circle', lat, lon: lon + 500 / (111320 * Math.cos(lat * Math.PI / 180)), r: 500 };
    const union = A.zoneAreaM2([c1, c2]);
    const lensA = A.lens(500, 500, 500), expected = 2 * Math.PI * 250000 - lensA;
    const POP = window.CASE_GEO_DATA.POP;
    const inR = A.popInRadius(lat, lon, 1000, POP).population, inZ = A.popInZone([{ kind: 'circle', lat, lon, r: 1000 }], POP).population;
    const crossing = A.lineInZone([[lat, lon - 0.05], [lat, lon + 0.05]], [{ kind: 'polygon', ring }]);
    const missing = A.lineInZone([[lat + 0.05, lon - 0.05], [lat + 0.05, lon + 0.05]], [{ kind: 'polygon', ring }]);
    const nearSeg = A.lineNearM([[41.3050, 69.2700], [41.3170, 69.2900]], lat, lon);
    return { inA: A.inRing(41.5, 69.5, [[41, 69], [42, 69], [42, 70], [41, 70]]), inB: A.inRing(40.5, 69.5, [[41, 69], [42, 69], [42, 70], [41, 70]]),
      sqArea, union, expected, inR, inZ, crossing, missing, nearSeg, cell: A.cellAreaM2(POP), pop: POP.length };
  });
  ck('точка в кольце и вне его', G.inA === true && G.inB === false);
  ck('площадь квадрата 1 км по сеточной выборке около 1 000 000 м²', near(G.sqArea, 1e6, 0.02), G.sqArea + ' м²');
  ck('объединение двух кругов 500 м на расстоянии 500 м близко к аналитике', near(G.union, G.expected, 0.03) && G.union > Math.PI * 250000 && G.union < 2 * Math.PI * 250000, Math.round(G.union) + ' против ' + Math.round(G.expected));
  ck('население в зоне-круге сходится со счётом в круге (в пределах 8%)', G.inR > 1000 && near(G.inZ, G.inR, 0.08), G.inZ + ' против ' + G.inR);
  ck('дорога без вершин внутри зоны считается проходящей; далёкая - нет', G.crossing === true && G.missing === false);
  ck('расстояние до отрезка, а не до вершин: проспект в 25 м, хотя вершины в 1 км', G.nearSeg < 60, Math.round(G.nearSeg) + ' м');
  ck('площадь ячейки сетки правдоподобна (0.3-1.5 км²)', G.cell > 300000 && G.cell < 1500000, G.cell + ' м², ячеек ' + G.pop);

  console.log('\n--- 3. Инструменты на подменённом прокси');
  let log = await ask('здания 500 м');
  ck('без точки агент просит точку, а не падает', has(log, 'err', /укажите точку/i), log.join(' | '));
  log = await ask('41.3111, 69.2797');
  let s = await st();
  ck('координаты в строке задают точку', s.site && near(s.site.lat, 41.3111, 1e-6) && has(log, 'fact', /Точка/), JSON.stringify(s.site));
  log = await ask('население 1 км');
  const pop1 = +(((log.find(l => /^fact:Население/.test(l)) || '').match(/(\d[\d\s ]*)\s+жителей/) || ['', '0'])[1].replace(/\D/g, ''));
  ck('население 1 км посчитано, помечено как расчёт с примечанием', pop1 > 1000 && has(log, 'fact', /расчёт/) && has(log, 'fact', /проверить/), pop1 + ' жителей');
  log = await ask('а 2 км?');
  const pop2 = +(((log.find(l => /^fact:Население/.test(l)) || '').match(/(\d[\d\s ]*)\s+жителей/) || ['', '0'])[1].replace(/\D/g, ''));
  ck('«а 2 км?» повторяет счёт с новым радиусом, и жителей больше', has(log, 'fact', /в радиусе 2 км/) && pop2 > pop1, pop2 + ' > ' + pop1);
  log = await ask('радиус 500 м и 1 км');
  s = await st();
  ck('два круга нарисованы', s.zone.filter(z => z.kind === 'circle').length === 2 && has(log, 'fact', /500 м, 1 км/), JSON.stringify(s.zone));
  log = await ask('здания 500 м');
  s = await st();
  ck('здания: из 4 в ответе прокси в круге 500 м остались 2 (по центроиду)', s.b === 2 && has(log, 'fact', /2 зданий/) && hits.buildings === 1, s.b + ' зданий, запросов ' + hits.buildings);
  ck('факт о зданиях - наблюдение с атрибуцией OSM', log.some(l => /^fact:Здания/.test(l) && /наблюдение/.test(l) && /OpenStreetMap contributors/.test(l)));
  log = await ask('здания 1 км');
  s = await st();
  ck('в 1 км - 3 здания', s.b === 3, s.b);
  log = await ask('дороги 500 м');
  s = await st();
  ck('дороги: проспект без вершин в круге и улица у точки; далёкая отброшена', s.r === 2 && has(log, 'fact', /2 участков/) && /primary 1/.test(log.join(' ')), s.r + ' / ' + log.join(' | '));
  log = await ask('выдели дома выше 9 этажей');
  ck('выделение по этажности: 1 из 3, с оговоркой про этажность OSM', has(log, 'fact', /1 из 3/) && has(log, 'fact', /этажность в OSM/i), log.join(' | '));
  const before = hits.buildings;
  log = await ask('сделай здания синими');
  s = await st();
  const inputColor = await pg.evaluate(() => document.querySelector('#gaPanel input[type=color][data-layer=buildings]').value);
  ck('«сделай здания синими» перекрашивает без повторной загрузки, ползунок цвета синхронизирован', s.styles.buildings.color === '#2e86de' && hits.buildings === before && inputColor === '#2e86de');
  log = await ask('сделай их зелёными');
  s = await st();
  ck('«их» - последний слой (здания)', s.styles.buildings.color === '#27ae60' && s.lastLayer === 'buildings');
  log = await ask('конкуренты 2 км');
  ck('конкуренты из базы БЦ, помечены как наблюдение', has(log, 'fact', /БЦ/) && has(log, 'fact', /наблюдение/), log.join(' | '));
  const colorInput = await pg.evaluate(() => { const i = document.querySelector('#gaPanel input[type=color][data-layer=roads]'); i.value = '#123456'; i.dispatchEvent(new Event('input', { bubbles: true })); return window.CASE_GEO_AGENT.state.styles.roads.color; });
  ck('ползунок цвета в панели меняет слой', colorInput === '#123456');

  console.log('\n--- 4. Полигон и точка кликами по карте');
  const probe0 = await pg.evaluate(() => { document.getElementById('lProbe').checked = true; return document.getElementById('lProbe').checked; });
  log = await ask('полигон');
  s = await st();
  ck('«полигон» включает рисование, снимает флажок отчёта по точке, включает «Готово»', s.draw === 0 && s.probe === false && s.done === false && has(log, 'ai', /кликайте/i), JSON.stringify({ draw: s.draw, probe: s.probe, done: s.done }));
  await pg.evaluate(() => { [[41.3105, 69.2790], [41.3140, 69.2790], [41.3140, 69.2810], [41.3105, 69.2810]].forEach(p => map.fire('click', { latlng: L.latLng(p[0], p[1]) })); });
  s = await st();
  ck('четыре клика - четыре вершины, отчёт по точке не открылся', s.draw === 4 && (await pg.evaluate(() => !document.getElementById('probe').classList.contains('open'))));
  log = await ask('готово');
  s = await st();
  ck('«готово» замыкает полигон из 4 точек, флажок отчёта возвращён', s.draw === null && s.zone.some(z => z.kind === 'polygon' && z.n === 4) && s.probe === probe0 && s.done === true && has(log, 'fact', /4 точек/), JSON.stringify(s.zone));
  log = await ask('полигон');
  await pg.evaluate(() => { [[41.300, 69.270], [41.302, 69.270], [41.302, 69.272]].forEach(p => map.fire('click', { latlng: L.latLng(p[0], p[1]) })); map.fire('dblclick', { latlng: L.latLng(41.302, 69.272), originalEvent: new MouseEvent('dblclick') }); });
  await pg.waitForTimeout(300);
  s = await st();
  ck('двойной клик замыкает полигон', s.draw === null && s.zone.filter(z => z.kind === 'polygon').length === 2, JSON.stringify(s.zone));
  log = await ask('полигон');
  await pg.evaluate(() => map.fire('click', { latlng: L.latLng(41.31, 69.28) }));
  log = await ask('отмена');
  s = await st();
  ck('«отмена» убирает незавершённый полигон, зона не изменилась, флажок возвращён', s.draw === null && s.zone.filter(z => z.kind === 'polygon').length === 2 && s.probe === probe0 && has(log, 'ai', /отменено/i));
  log = await ask('готово');
  ck('«готово» без рисования - понятная ошибка', has(log, 'err', /не рисуется/i), log.join(' | '));
  await pg.evaluate(() => window.CASE_GEO_AGENT.setPick(true));
  s = await st();
  ck('режим «Точка» снимает флажок отчёта', s.pick === true && s.probe === false);
  await pg.evaluate(() => map.fire('click', { latlng: L.latLng(41.3200, 69.2900) }));
  await pg.waitForTimeout(400);
  s = await st();
  ck('клик задаёт точку, режим выключается, флажок возвращён', s.pick === false && s.site && near(s.site.lat, 41.32, 1e-6) && s.probe === probe0, JSON.stringify(s.site));
  await ask('41.3111, 69.2797');

  console.log('\n--- 5. Зона: население, здания, дороги, объединение, площадь');
  await ask('очистить');
  s = await st();
  ck('«очистить» убирает фигуры и слои, точка остаётся', s.zone.length === 0 && s.b === null && s.r === null && !!s.site);
  await ask('радиус 1 км');
  await pg.evaluate(() => window.CASE_GEO_AGENT.run('draw_polygon', { points: [[41.3105, 69.2790], [41.3140, 69.2790], [41.3140, 69.2810], [41.3105, 69.2810]] }));
  log = await ask('здания в зоне');
  s = await st();
  ck('«в зоне» без объединения - последняя фигура (полигон): 2 здания из 4', s.b === 2 && has(log, 'fact', /в зоне/), s.b);
  log = await ask('население в зоне');
  ck('население в зоне посчитано и помечено как расчёт', has(log, 'fact', /Население/) && has(log, 'fact', /в зоне/) && has(log, 'fact', /расчёт/), log.join(' | '));
  log = await ask('объедини');
  s = await st();
  ck('«объедини» делает одну зону из круга и полигона', s.merged === true && has(log, 'fact', /2 фигур/), log.join(' | '));
  const areaLine = (await ask('площадь зоны')).find(l => /^fact:Площадь/.test(l)) || '';
  const areaKm = parseFloat((areaLine.match(/(\d+[.,]\d+)\s*км²/) || ['', '0'])[1].replace(',', '.'));
  ck('площадь объединённой зоны около круга 1 км (3.14 км²), полигон внутри него', near(areaKm, 3.14, 0.04), areaKm + ' км²');
  log = await ask('дороги в зоне');
  s = await st();
  ck('дороги в объединённой зоне: две из трёх', s.r === 2, s.r);
  log = await ask('здания в зоне');
  s = await st();
  ck('здания в объединённой зоне: три из четырёх', s.b === 3, s.b);

  console.log('\n--- 6. Адрес через геокодер');
  log = await ask('адрес: Амира Темура 15');
  s = await st();
  ck('адрес найден через прокси, точка переставлена, взят первый из двух', hits.geocode === 1 && s.site && near(s.site.lat, 41.3123, 1e-6) && /Амира Темура/.test(s.site.name) && has(log, 'ai', /первый из 2/), JSON.stringify(s.site));
  ck('факт об адресе помечен как наблюдение (Nominatim)', log.some(l => /^fact:Точка/.test(l) && /наблюдение/.test(l)));

  console.log('\n--- 7. Своя модель как запасной путь');
  const llm0 = hits.llm.length;
  log = await ask('покажи мне что-нибудь интересное вокруг');
  s = await st();
  ck('фразу движок не разобрал -> один запрос к своей модели', hits.llm.length === llm0 + 1, hits.llm.length - llm0);
  ck('исполнены только разрешённые команды; ping и неизвестная отброшены', has(log, 'sys', /Понято своей моделью: draw_radius, count_population$/) && s.zone.some(z => z.kind === 'circle' && z.r === 700) && has(log, 'fact', /в радиусе 700 м/) && hits.ping === 0, log.join(' | '));
  llmMode = 'needs';
  log = await ask('blah blah nonsense');
  ck('без модели агент честно говорит «не понял» на языке пользователя', has(log, 'ai', /^ai:Not understood/), log.join(' | '));
  const llm1 = hits.llm.length;
  await ask('здания 500 м');
  ck('разобранная движком фраза к модели не ходит', hits.llm.length === llm1);

  console.log('\n--- 8. Проверка связи');
  log = await ask('проверь связь');
  ck('советы сервера показаны в панели', hits.ping === 1 && has(log, 'fact', /Overpass API/) && has(log, 'fact', /движком команд/), log.join(' | '));
  await pg.click('#gaPing');
  await pg.waitForTimeout(300);
  ck('кнопка «Связь» делает то же самое', hits.ping === 2);

  console.log('\n--- 9. Итог');
  const tail = await pg.evaluate(() => { const S = window.CASE_GEO_AGENT.state, DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']'); return { dash: S.log.some(m => DASH.test(m.html)), n: S.log.length, siteLabel: document.getElementById('gaSite').textContent, on: document.getElementById('gaSite').classList.contains('on') }; });
  ck('в журнале нет длинных тире', !tail.dash, tail.n + ' записей');
  ck('строка точки показывает адрес и число фигур', /Амира Темура/.test(tail.siteLabel) && /фигур в зоне/.test(tail.siteLabel) && tail.on, tail.siteLabel);
  ck('ошибок страницы нет', errs.length === 0, errs[0] || 'нет');

  await b.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nГео-агент: свой движок, полигоны, зона и подменённый прокси ведут себя верно');
  process.exit(bad ? 1 : 0);
})();
