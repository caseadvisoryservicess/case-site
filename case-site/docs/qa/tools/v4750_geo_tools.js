/* v4.75.0: панель инструментов карты, контекстное меню, компоновка студии и зоны охвата.

   Замечания владельца после v4.74.0 (десять пунктов, скриншоты Felt и Google Earth):
     1. Левый клик по карте ничего не открывает: «отчёт по точке» больше не всплывает.
     2. Внизу по центру панель как в Felt: отмена, повтор | пин P | полигон O | полигон от
        руки F | круг C | маршрут R | комментарий M | стиль карты.
     3. Правый клик: метка здесь, круг отсюда, маршрут отсюда, переместиться сюда, сведения,
        скопировать координаты, вставить из буфера обмена.
     4. Гео-агент в правой выдвижной панели с одной кнопкой.
     5. В «Анализ локации» нет кнопок «Зона: рисовать / Замкнуть / ✕».
     6. «Зона охвата»: свои радиусы (любые км), плюс зоны полигоном и кругом.
     7. Агент сам считает зоны охвата по методике CASE (PTA / STA / TTA).
     8. В дереве слоёв нет узла «Подложка карты» (кнопка у карты осталась).
     9. У атрибуции нет флага Украины.
    10. «Легенда» ушла из левой панели в плашку «На экране».

   Запуск: NODE_PATH=... node v4750_geo_tools.js [папка os] */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base } = await createMockServer(OS, { initialState: {} });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  const hits = { route: 0, table: 0, reverse: 0 };
  let tableMode = 'ok';

  await pg.route('**/*', r => {
    const u = r.request().url();
    const j = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.startsWith(base) || /^(data|blob):/.test(u)) return r.continue();
    if (/router\.project-osrm\.org\/route\/v1\/driving\//.test(u)) {
      hits.route++;
      const m = u.match(/driving\/(-?[\d.]+),(-?[\d.]+);(-?[\d.]+),(-?[\d.]+)/);
      const a = [+m[1], +m[2]], c = [+m[3], +m[4]];
      return j({ code: 'Ok', routes: [{ distance: 1500, duration: 300, geometry: { type: 'LineString', coordinates: [a, [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2 + 0.002], c] } }] });
    }
    if (/router\.project-osrm\.org\/table\/v1\/driving\//.test(u)) {
      hits.table++;
      if (tableMode === 'down') return r.abort();
      /* длительность = расстояние от источника при 20 км/ч: 10 мин = 3,3 км, 20 мин = 6,7 км, 30 мин = 10 км */
      const co = decodeURIComponent(u.split('/driving/')[1].split('?')[0]).split(';').map(s => s.split(',').map(Number));
      const src = co[0], R = 6371, rad = x => x * Math.PI / 180;
      const dist = c => { const s = Math.pow(Math.sin(rad(c[1] - src[1]) / 2), 2) + Math.cos(rad(src[1])) * Math.cos(rad(c[1])) * Math.pow(Math.sin(rad(c[0] - src[0]) / 2), 2); return R * 2 * Math.asin(Math.sqrt(s)); };
      return j({ code: 'Ok', durations: [co.map(c => dist(c) / 20 * 3600)] });
    }
    if (/nominatim\.openstreetmap\.org\/reverse/.test(u)) { hits.reverse++; return j({ display_name: 'проспект Амира Темура, 15, Ташкент', type: 'house' }); }
    return r.abort();
  });
  await pg.route('**/api/gis_proxy.php**', r => {
    const u = new URL(r.request().url()); const mode = u.searchParams.get('mode');
    const j = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (mode === 'ping') return j({ ok: true, facts: { env: { curl: true } }, advice: [] });
    return j({ ok: true, rows: [], provenance: { source: 'OpenStreetMap', licence: 'ODbL 1.0', attribution: '© OpenStreetMap contributors', method: 'Overpass API', fetched_at: '2026-09-17T10:00:00+05:00', cached: false, conf: 'asking' }, truncated: false });
  });

  await pg.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.CASE_GEO_AGENT && window.CASE_GEO_TOOLS && window.CASE_GEO_LAYOUT && document.getElementById('geoTb') && document.getElementById('gaToggle') && document.querySelector('.geo-cat'), null, { timeout: 30000 });
  await pg.waitForTimeout(2000);
  const S = () => pg.evaluate(() => { const A = window.CASE_GEO_AGENT, T = window.CASE_GEO_TOOLS; return { tool: T.state.tool, pts: T.state.pts.length, undo: T.state.undo.length, redo: T.state.redo.length, site: A.state.site, zone: A.state.zone.map(z => ({ kind: z.kind, r: z.r, n: z.ring ? z.ring.length : 0 })), drawerOpen: document.getElementById('gaDrawer').classList.contains('open'), hint: document.getElementById('geoTbHint').textContent, log: A.state.log.length }; });
  const lastLog = n => pg.evaluate(n => window.CASE_GEO_AGENT.state.log.slice(-n).map(m => m.who + ':' + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()), n);
  const has = (log, who, re) => log.some(l => l.indexOf(who + ':') === 0 && re.test(l));
  const click = (lat, lon) => pg.evaluate(p => { map.fire('click', { latlng: L.latLng(p[0], p[1]), containerPoint: map.latLngToContainerPoint(L.latLng(p[0], p[1])), originalEvent: new MouseEvent('click') }); }, [lat, lon]);

  console.log('--- 1. Версии, компоновка, атрибуция, легенда');
  const v = await pg.evaluate(() => {
    const M = window.CASE_MODULE_VERSIONS || {}, DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
    const attr = document.querySelector('.leaflet-control-attribution'), flag = attr ? /svg|flag|ukr|🇺/i.test(attr.innerHTML) : true;
    const cats = [...document.querySelectorAll('.geo-cat')].map(c => c.getAttribute('data-cat'));
    const left = document.querySelector('.left'), leftTxt = left ? left.textContent : '';
    const lgd = document.getElementById('mlgd'), stat = lgd && lgd.querySelector('.ga-static-legend');
    const drawer = document.getElementById('gaDrawer'), toggle = document.getElementById('gaToggle');
    const anaSect = [...document.querySelectorAll('.left .sect')].find(s => /Анализ локации/.test(s.textContent));
    return { tools: M['v4750-geo-tools'], layout: M['v4750-geo-layout'], agent: M['v4730-geo-agent'], tree: M['v4740-geo-tree'], direct: M['geo-direct'],
      attrHtml: attr ? attr.innerHTML : '', flag, attrLeaflet: attr ? /Leaflet/.test(attr.textContent) : false,
      baseNode: cats.some(c => /подложка/i.test(c)), basectl: !!document.querySelector('.geo-basectl-btn'),
      legendSectLeft: [...document.querySelectorAll('.left .sect h3')].some(h => /^Легенда$/.test(h.textContent.trim())),
      legendInPlate: !!stat && /бизнес-центр/.test(stat.textContent) && /точка анализа/.test(stat.textContent),
      probeCb: !!document.getElementById('lProbe'), zoneBtns: !!document.getElementById('btnZone') || /Зона: рисовать|Замкнуть/.test(anaSect ? anaSect.textContent : ''),
      anaKept: !document.querySelector('.left>.sect[data-sect="analysis"]') && !!document.getElementById('tzMode') && !!document.getElementById('szBox'),
      drawer: !!drawer && !!toggle && drawer.contains(document.getElementById('gaPanel')) && !drawer.classList.contains('open'), gaInLeft: !!left && left.contains(document.getElementById('gaPanel')),
      ringKm: !!document.getElementById('ringKm') && !!document.getElementById('ringApply'), rings: document.querySelectorAll('#rings label').length,
      dash: DASH.test(document.getElementById('geoTb').outerHTML) || DASH.test(document.getElementById('geoToolsCss').textContent) || DASH.test(document.getElementById('geoLayoutCss') ? document.getElementById('geoLayoutCss').textContent : '') || DASH.test(leftTxt) };
  });
  ck('модули зарегистрированы: инструменты, компоновка и агент 4.79.0, дерево, geo-direct 4.75.0', v.tools === '4.79.0' && v.layout === '4.79.0' && v.agent === '4.79.0' && v.tree === '4.75.0' && v.direct === '4.75.0', JSON.stringify([v.tools, v.layout, v.agent, v.tree, v.direct]));
  ck('атрибуция без флага, ссылка Leaflet осталась', !v.flag && v.attrLeaflet, v.attrHtml.slice(0, 120));
  ck('в дереве нет узла «Подложка карты», кнопка подложки у карты есть', !v.baseNode && v.basectl);
  ck('«Легенда» ушла из левой панели в плашку «На экране» (обозначения: БЦ, точка анализа)', !v.legendSectLeft && v.legendInPlate);
  ck('флажка «клик = отчёт по точке» нет, кнопок «Зона: рисовать / Замкнуть» нет; раздела «Анализ локации» нет, изохроны и модель зон живут в «Зоне охвата» (v4.79.0)', !v.probeCb && !v.zoneBtns && v.anaKept);
  ck('гео-агент в правом ящике (закрыт), в левой панели его нет', v.drawer && !v.gaInLeft);
  ck('«Зона охвата»: поле радиусов и кнопка применить, три кольца по умолчанию', v.ringKm && v.rings === 3, v.rings + ' колец');
  ck('длинных тире в панели инструментов, стилях и левой панели нет', !v.dash);

  console.log('--- 2. Левый клик ничего не открывает');
  await click(41.3111, 69.2797);
  await pg.waitForTimeout(800);
  const c2 = await pg.evaluate(() => ({ probe: document.getElementById('probe').classList.contains('open'), site: window.CASE_GEO_AGENT.state.site, tool: window.CASE_GEO_TOOLS.state.tool, menu: !!document.querySelector('.geo-cmenu') }));
  ck('клик по карте без инструмента: отчёт не открылся, точка не поставлена, меню нет', !c2.probe && !c2.site && !c2.tool && !c2.menu, JSON.stringify(c2));

  console.log('--- 3. Панель инструментов и хоткеи');
  const tb = await pg.evaluate(() => {
    const tb = document.getElementById('geoTb'), r = tb.getBoundingClientRect(), mr = document.getElementById('map').getBoundingClientRect();
    const btns = [...tb.querySelectorAll('button[data-a]')].map(b => b.getAttribute('data-a')), keys = [...tb.querySelectorAll('button kbd')].map(k => k.textContent);
    const cs = getComputedStyle(tb);
    return { btns, keys, centered: Math.abs((r.left + r.width / 2) - (mr.left + mr.width / 2)) < 40, bottom: mr.bottom - r.bottom, radius: cs.borderRadius, basectl: !!tb.querySelector('.geo-basectl-btn'), undoOff: tb.querySelector('[data-a=undo]').disabled, redoOff: tb.querySelector('[data-a=redo]').disabled, tips: [...tb.querySelectorAll('button[data-a]')].every(b => b.getAttribute('data-tip')) };
  });
  ck('панель внизу по центру карты: отмена, повтор | пин, полигон, от руки, круг, маршрут, комментарий, линейка | подложка, полный экран', tb.btns.join() === 'undo,redo,pin,poly,free,circle,route,note,measure,full' && tb.basectl && tb.centered && tb.bottom > 5 && tb.bottom < 60 && tb.tips, JSON.stringify(tb));
  ck('хоткеи на кнопках: P O F C R M L; отмена и повтор пока недоступны', tb.keys.join('') === 'POFCRML' && tb.undoOff && tb.redoOff, tb.keys.join(''));
  await pg.keyboard.press('p');
  let s = await S();
  ck('клавиша P включает пин, подсказка появилась', s.tool === 'pin' && /точку анализа/i.test(s.hint), JSON.stringify({ tool: s.tool, hint: s.hint }));
  const onBtn = await pg.evaluate(() => document.querySelector('#geoTb [data-a=pin]').classList.contains('on') && getComputedStyle(document.querySelector('#geoTb [data-a=pin]')).backgroundColor === 'rgb(158, 0, 0)');
  ck('активная кнопка подсвечена оксбладом CASE', onBtn);
  await pg.keyboard.press('p');
  s = await S();
  ck('повторное P выключает инструмент', s.tool === null && s.hint === '');
  await pg.keyboard.press('o'); s = await S(); const o = s.tool;
  await pg.keyboard.press('Escape'); s = await S();
  ck('O включает полигон, Esc выключает', o === 'poly' && s.tool === null);
  const inInput = await pg.evaluate(() => { const i = document.getElementById('geoSearch') || document.querySelector('input[type=text]'); i.focus(); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true })); const t = window.CASE_GEO_TOOLS.state.tool; i.blur(); return t; });
  ck('в текстовом поле хоткеи не срабатывают', inInput === null);

  console.log('--- 4. Пин: точка анализа, отмена и повтор');
  await pg.click('#geoTb [data-a=pin]');
  await click(41.3200, 69.2900);
  await pg.waitForTimeout(600);
  s = await S();
  ck('клик с пином задаёт точку анализа агента, инструмент выключился, отмена стала доступна', s.site && near(s.site.lat, 41.32, 1e-6) && s.tool === null && s.undo === 1, JSON.stringify({ site: s.site, tool: s.tool, undo: s.undo }));
  let log = await lastLog(4); /* v4.78.0: после точки агент пишет и факт «Генплан (НГИС)», смотрим последние четыре записи */
  ck('в журнале агента факт о точке и ответ', has(log, 'fact', /41\.32/) && log.some(l => /^ai:/.test(l)), log.join(' | '));
  await pg.click('#geoTb [data-a=pin]');
  await click(41.3000, 69.2500);
  await pg.waitForTimeout(600);
  await pg.keyboard.press('Control+z');
  await pg.waitForTimeout(500);
  s = await S();
  ck('Ctrl+Z возвращает прежнюю точку, повтор доступен', s.site && near(s.site.lat, 41.32, 1e-6) && s.undo === 1 && s.redo === 1, JSON.stringify({ site: s.site, undo: s.undo, redo: s.redo }));
  await pg.click('#geoTb [data-a=redo]');
  await pg.waitForTimeout(500);
  s = await S();
  ck('кнопка «повторить» снова ставит вторую точку', s.site && near(s.site.lat, 41.30, 1e-6) && s.undo === 2 && s.redo === 0, JSON.stringify(s.site));
  const toast = await pg.evaluate(() => document.getElementById('geoToast').textContent);
  ck('всплывающее уведомление о повторе', /Повторено/.test(toast), toast);

  console.log('--- 5. Полигон по точкам, Enter, агент открылся');
  await pg.evaluate(() => window.CASE_GEO_AGENT.run('set_site', { lat: 41.3111, lon: 69.2797, name: 'тест' }));
  await pg.keyboard.press('o');
  for (const p of [[41.3105, 69.2790], [41.3140, 69.2790], [41.3140, 69.2810], [41.3105, 69.2810]]) await click(p[0], p[1]);
  s = await S();
  ck('четыре клика: четыре вершины, подсказка со счётчиком, отчёт не открылся', s.pts === 4 && /Вершин: 4/.test(s.hint) && !(await pg.evaluate(() => document.getElementById('probe').classList.contains('open'))), JSON.stringify({ pts: s.pts, hint: s.hint }));
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(1500);
  s = await S();
  ck('Enter замыкает полигон: фигура ушла в зону агента, ящик агента открылся, инструмент выключен', s.zone.some(z => z.kind === 'polygon' && z.n === 4) && s.drawerOpen && s.tool === null, JSON.stringify(s.zone));
  log = await lastLog(6);
  ck('агент сразу посчитал площадь и население зоны', has(log, 'fact', /Площадь|площад/i) && has(log, 'fact', /Население|жител/i), log.join(' | ').slice(0, 300));
  await pg.evaluate(() => window.CASE_GEO_TOOLS.undo());
  s = await S();
  const undonePoly = !s.zone.some(z => z.kind === 'polygon');
  await pg.evaluate(() => window.CASE_GEO_TOOLS.redo());
  s = await S();
  ck('отмена убирает полигон из зоны, повтор возвращает', undonePoly && s.zone.some(z => z.kind === 'polygon'), JSON.stringify(s.zone));
  await pg.keyboard.press('o');
  await click(41.30, 69.27); await click(41.30, 69.28);
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(200);
  s = await S();
  const t2 = await pg.evaluate(() => document.getElementById('geoToast').textContent);
  ck('Enter при двух вершинах: подсказка «минимум три точки», рисование продолжается', s.tool === 'poly' && s.pts === 2 && /три точки/i.test(t2), t2);
  await pg.keyboard.press('Escape');

  console.log('--- 6. Полигон от руки: упрощение');
  const simp = await pg.evaluate(() => { const T = window.CASE_GEO_TOOLS, pts = []; for (let i = 0; i < 200; i++) { const th = i / 200 * 2 * Math.PI; pts.push([41.3111 + 0.004 * Math.cos(th), 69.2797 + 0.005 * Math.sin(th)]); } return { n: T.simplify(pts, 15).length, n0: pts.length }; });
  ck('Дугласа-Пекера: 200 точек окружности упрощены, но форма сохранена (от 12 до 120 вершин)', simp.n >= 12 && simp.n <= 120, simp.n + ' из ' + simp.n0);
  await pg.keyboard.press('f');
  const freeRes = await pg.evaluate(async () => {
    const T = window.CASE_GEO_TOOLS, S = ms => new Promise(r => setTimeout(r, ms));
    const drag = map.dragging.enabled(), dbl = map.doubleClickZoom.enabled();
    const ev = (t, la, ln) => map.fire(t, { latlng: L.latLng(la, ln), containerPoint: map.latLngToContainerPoint(L.latLng(la, ln)), originalEvent: new MouseEvent(t) });
    ev('mousedown', 41.3200, 69.2700);
    for (let i = 1; i <= 60; i++) { const th = i / 60 * 2 * Math.PI; ev('mousemove', 41.3200 + 0.003 * Math.cos(th) - 0.003, 69.2700 + 0.004 * Math.sin(th)); }
    ev('mouseup', 41.3200, 69.2700);
    await S(1500);
    return { drag, dbl, dragAfter: map.dragging.enabled(), tool: T.state.tool, zone: window.CASE_GEO_AGENT.state.zone.map(z => z.kind) };
  });
  ck('от руки: перетаскивание карты на время выключено, после отпускания полигон в зоне, карта снова таскается', freeRes.drag === false && freeRes.dbl === false && freeRes.dragAfter === true && freeRes.tool === null && freeRes.zone.filter(k => k === 'polygon').length === 2, JSON.stringify(freeRes));

  console.log('--- 7. Круг заданного радиуса');
  await pg.keyboard.press('c');
  await click(41.3111, 69.2797);
  await pg.evaluate(() => map.fire('mousemove', { latlng: L.latLng(41.3200, 69.2797) }));
  s = await S();
  ck('после центра подсказка показывает радиус при движении мыши', /Радиус/.test(s.hint) && /км|м/.test(s.hint), s.hint);
  await click(41.3200, 69.2797);
  const circ = await pg.evaluate(() => ({ inp: !!document.getElementById('geoCircleKm'), val: +document.getElementById('geoCircleKm').value }));
  ck('второй клик фиксирует круг и предлагает уточнить радиус (около 1 км)', circ.inp && circ.val > 0.9 && circ.val < 1.1, JSON.stringify(circ));
  await pg.fill('#geoCircleKm', '2.5');
  await pg.keyboard.press('Enter');
  await pg.waitForTimeout(1500);
  s = await S();
  const circle = s.zone.find(z => z.kind === 'circle' && z.r === 2500);
  ck('радиус, введённый вручную (2,5 км), стал кругом зоны агента', !!circle && s.tool === null, JSON.stringify(s.zone));
  log = await lastLog(6);
  ck('в журнале факт о круге с площадью', has(log, 'fact', /Круг|круг/) && has(log, 'fact', /км²|м²/), log.join(' | ').slice(0, 240));

  console.log('--- 8. Маршрут через OSRM и запасной путь');
  await pg.keyboard.press('r');
  await click(41.3111, 69.2797); await click(41.3200, 69.2900);
  await pg.waitForTimeout(1200);
  const rt = await pg.evaluate(() => { let n = 0, tip = ''; map.eachLayer(l => { if (l instanceof L.Polyline && !(l instanceof L.Polygon) && l.options.color === '#1565c0') { n++; tip = l.getTooltip() ? l.getTooltip().getContent() : ''; } }); return { n, tip, toast: document.getElementById('geoToast').textContent, tool: window.CASE_GEO_TOOLS.state.tool }; });
  ck('маршрут по дорогам нарисован: 1,5 км, 5 мин, источник OSRM подписан', hits.route === 1 && rt.n === 1 && /1\.5 км/.test(rt.tip) && /5 мин/.test(rt.tip) && /OSRM/.test(rt.tip) && rt.tool === null, JSON.stringify(rt));
  log = await lastLog(2);
  ck('факт о маршруте попал в журнал агента с пометкой «расчёт»', has(log, 'fact', /Маршрут/) && has(log, 'fact', /расчёт/), log.join(' | '));
  await pg.evaluate(() => window.CASE_GEO_TOOLS.undo());
  const rtGone = await pg.evaluate(() => { let n = 0; map.eachLayer(l => { if (l instanceof L.Polyline && !(l instanceof L.Polygon) && l.options.color === '#1565c0') n++; }); return n; });
  ck('отмена убирает маршрут с карты', rtGone === 0);
  await pg.route('**/router.project-osrm.org/route/**', r => r.abort());
  await pg.keyboard.press('r');
  await click(41.3111, 69.2797); await click(41.3200, 69.2797);
  await pg.waitForTimeout(1200);
  const fb = await pg.evaluate(() => document.getElementById('geoToast').textContent);
  ck('маршрутизатор недоступен: честно сказано, дано расстояние по прямой (около 1 км)', /недоступен/.test(fb) && /по прямой/.test(fb) && /(1|0\.9|1\.0) км|9\d\d м/.test(fb), fb);
  await pg.unroute('**/router.project-osrm.org/route/**');

  console.log('--- 9. Комментарии');
  await pg.keyboard.press('m');
  await click(41.3150, 69.2850);
  await pg.waitForTimeout(300);
  const form = await pg.evaluate(() => !!document.querySelector('.geo-note-form textarea'));
  ck('клик с инструментом «комментарий» открывает форму', form);
  await pg.fill('.geo-note-form textarea', 'Здесь строится ЖК, проверить срок');
  await pg.click('.geo-note-form button.pri');
  await pg.waitForTimeout(300);
  const notes = await pg.evaluate(() => ({ n: window.CASE_GEO_TOOLS.notes().length, saved: JSON.parse(localStorage.getItem('caseos_geo_notes_v1') || '[]').length, icon: document.querySelectorAll('.geo-note-ic').length, tool: window.CASE_GEO_TOOLS.state.tool }));
  ck('комментарий сохранён в localStorage и показан меткой, инструмент выключен', notes.n === 1 && notes.saved === 1 && notes.icon === 1 && notes.tool === null, JSON.stringify(notes));
  await pg.evaluate(() => window.CASE_GEO_TOOLS.undo());
  const notes2 = await pg.evaluate(() => ({ n: window.CASE_GEO_TOOLS.notes().length, icon: document.querySelectorAll('.geo-note-ic').length }));
  ck('отмена убирает комментарий', notes2.n === 0 && notes2.icon === 0, JSON.stringify(notes2));
  await pg.evaluate(() => window.CASE_GEO_TOOLS.redo());
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.CASE_GEO_TOOLS && document.getElementById('geoTb') && document.getElementById('gaToggle'), null, { timeout: 30000 });
  await pg.waitForTimeout(1500);
  const notes3 = await pg.evaluate(() => ({ n: window.CASE_GEO_TOOLS.notes().length, icon: document.querySelectorAll('.geo-note-ic').length, text: (window.CASE_GEO_TOOLS.notes()[0] || {}).text, drawer: document.getElementById('gaDrawer').classList.contains('open') }));
  ck('после перезагрузки комментарий на месте, состояние ящика агента запомнено (открыт)', notes3.n === 1 && notes3.icon === 1 && /ЖК/.test(notes3.text) && notes3.drawer, JSON.stringify(notes3));
  await pg.click('#gaDrawerClose');
  await pg.waitForTimeout(300);
  ck('крестик закрывает ящик агента', !(await pg.evaluate(() => document.getElementById('gaDrawer').classList.contains('open'))));

  console.log('--- 10. Контекстное меню по правому клику');
  const rc = (lat, lon) => pg.evaluate(p => { const ll = L.latLng(p[0], p[1]); map.fire('contextmenu', { latlng: ll, containerPoint: map.latLngToContainerPoint(ll), originalEvent: new MouseEvent('contextmenu') }); }, [lat, lon]);
  await rc(41.3111, 69.2797);
  const menu = await pg.evaluate(() => { const m = document.querySelector('.geo-cmenu'); return m ? { items: [...m.querySelectorAll('button')].map(b => b.textContent.replace(b.querySelector('.ic').textContent, '').trim()), xy: m.querySelector('.geo-cmenu-xy').textContent, inMap: !!m.closest('#map') } : null; });
  ck('меню: метка здесь, круг отсюда, маршрут отсюда, переместиться, сведения, скопировать координаты, вставить из буфера', !!menu && menu.items.length === 7 && /метку здесь/i.test(menu.items[0]) && /Круг/.test(menu.items[1]) && /Маршрут/.test(menu.items[2]) && /Переместиться/.test(menu.items[3]) && /сведения/i.test(menu.items[4]) && /координаты/i.test(menu.items[5]) && /буфера/i.test(menu.items[6]) && /41\.3111/.test(menu.xy) && menu.inMap, JSON.stringify(menu));
  await pg.keyboard.press('Escape');
  ck('Esc закрывает меню', !(await pg.evaluate(() => !!document.querySelector('.geo-cmenu'))));
  await rc(41.3250, 69.2950);
  await pg.click('.geo-cmenu [data-a=pin]');
  await pg.waitForTimeout(600);
  s = await S();
  ck('«Добавить метку здесь» ставит точку анализа, меню закрылось', s.site && near(s.site.lat, 41.325, 1e-6) && !(await pg.evaluate(() => !!document.querySelector('.geo-cmenu'))), JSON.stringify(s.site));
  await rc(41.3000, 69.2600);
  await pg.click('.geo-cmenu [data-a=center]');
  await pg.waitForTimeout(400);
  const center = await pg.evaluate(() => { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; });
  ck('«Переместиться сюда» центрирует карту', near(center.lat, 41.30, 2e-3) && near(center.lng, 69.26, 2e-3), JSON.stringify(center));
  await rc(41.3111, 69.2797);
  await pg.click('.geo-cmenu [data-a=copy]');
  await pg.waitForTimeout(300);
  const clip = await pg.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  const toastCopy = await pg.evaluate(() => document.getElementById('geoToast').textContent);
  ck('«Скопировать координаты» кладёт «41.311100, 69.279700» в буфер обмена', clip === '41.311100, 69.279700' && /Скопировано/.test(toastCopy), clip + ' / ' + toastCopy);
  await pg.evaluate(() => navigator.clipboard.writeText('41.3333, 69.2222'));
  await rc(41.3111, 69.2797);
  await pg.click('.geo-cmenu [data-a=paste]');
  await pg.waitForTimeout(700);
  s = await S();
  ck('«Вставить объект из буфера» с координатами ставит точку анализа', s.site && near(s.site.lat, 41.3333, 1e-6) && near(s.site.lon, 69.2222, 1e-6), JSON.stringify(s.site));
  await rc(41.3111, 69.2797);
  await pg.click('.geo-cmenu [data-a=info]');
  await pg.waitForTimeout(900);
  const info = await pg.evaluate(() => { const p = document.querySelector('.leaflet-popup-content .geo-info'); return p ? p.textContent : ''; });
  ck('«Получить сведения»: координаты, район, ближайший БЦ, расстояние до точки, адрес из OSM', /41\.31110, 69\.27970/.test(info) && /Район:/.test(info) && /Ближайший БЦ:/.test(info) && /До точки анализа:/.test(info) && /Амира Темура/.test(info) && hits.reverse === 1, info.replace(/\s+/g, ' '));
  await pg.evaluate(() => { map.closePopup(); return null; });
  await rc(41.3111, 69.2797);
  await pg.click('.geo-cmenu [data-a=circle]');
  s = await S();
  ck('«Круг охвата отсюда» включает инструмент круга с центром в точке меню', s.tool === 'circle' && /расстоянии/.test(s.hint), s.hint);
  await pg.keyboard.press('Escape');
  await rc(41.3111, 69.2797);
  await pg.click('.geo-cmenu [data-a=route]');
  s = await S();
  ck('«Маршрут отсюда» включает маршрут с началом в точке меню', s.tool === 'route' && s.pts === 1 && /конец маршрута/.test(s.hint), s.hint);
  await pg.keyboard.press('Escape');

  console.log('--- 11. Свои радиусы охвата');
  await pg.evaluate(() => window.CASE_GEO_AGENT.run('set_site', { lat: 41.3111, lon: 69.2797, name: 'тест' }));
  /* секция «Зона охвата» может быть свёрнута (память браузера): раскрываем, как сделал бы пользователь */
  await pg.evaluate(() => { const sect = document.getElementById('ringKm').closest('.sect'); if (sect && sect.classList.contains('closed')) sect.querySelector('h3').click(); document.getElementById('ringKm').scrollIntoView(); return null; });
  await pg.fill('#ringKm', '0.7, 2, 4.5, 7');
  await pg.click('#ringApply');
  await pg.waitForTimeout(500);
  const rings = await pg.evaluate(() => ({ radii: RADII.map(r => r.km), labels: [...document.querySelectorAll('#rings label')].map(l => l.textContent.trim()), saved: (JSON.parse(localStorage.getItem('caseos_rings_v2') || '[]')).map(r => r.km + ':' + (r.on ? 1 : 0)).join(), circles: (() => { const out = []; gRing.eachLayer(l => { if (l instanceof L.Circle) out.push(l.getRadius()); }); return out.sort((a, b) => a - b); })() }));
  ck('радиусы «0.7, 2, 4.5, 7» применены: четыре кольца нарисованы вокруг точки, выбор запомнен', rings.radii.join() === '0.7,2,4.5,7' && rings.labels.length === 4 && /0\.7 км/.test(rings.labels[0]) && rings.circles.join() === '700,2000,4500,7000' && rings.saved === '0.7:1,2:1,4.5:1,7:1', JSON.stringify(rings));
  await pg.evaluate(() => { const cb = document.querySelector('#rings label input'); cb.click(); });
  await pg.waitForTimeout(300);
  const rings2 = await pg.evaluate(() => { const out = []; gRing.eachLayer(l => { if (l instanceof L.Circle) out.push(l.getRadius()); }); return out.sort((a, b) => a - b); });
  ck('галочка кольца выключает его на карте', rings2.join() === '2000,4500,7000', rings2.join());
  await pg.fill('#ringKm', 'abc');
  await pg.click('#ringApply');
  const badInput = await pg.evaluate(() => ({ v: document.getElementById('ringKm').value, radii: RADII.map(r => r.km).join() }));
  ck('мусор в поле не ломает радиусы: поле возвращено к текущим', badInput.radii === '0.7,2,4.5,7' && badInput.v === '0.7, 2, 4.5, 7', JSON.stringify(badInput));

  console.log('--- 12. Зоны охвата по методике CASE');
  const P = await pg.evaluate(() => { const A = window.CASE_GEO_AGENT; const j = t => (A.parse(t) || []).map(c => c.name + ':' + JSON.stringify(c.input)).join(';'); return { a: j('зона охвата по методике'), b: j('catchment 5 10 15 minutes community'), c: j('зона охвата, GLA 20000, ставка $25'), d: j('торговая зона 10/20/30 мин') }; });
  ck('разбор: «зона охвата по методике» и «catchment» дают инструмент catchment с минутами, форматом, GLA и ставкой', /^catchment:/.test(P.a) && /"minutes":\[5,10,15\]/.test(P.b) && /"format":"community"/.test(P.b) && /"gla_m2":20000/.test(P.c) && /"rent_usd_m2_month":25/.test(P.c) && /"minutes":\[10,20,30\]/.test(P.d), JSON.stringify(P));
  await pg.evaluate(() => window.CASE_GEO_AGENT.run('clear_layers', { what: 'all' }).catch(() => null));
  await pg.evaluate(() => window.CASE_GEO_AGENT.run('set_site', { lat: 41.3111, lon: 69.2797, name: 'тест' }));
  const ask = t => pg.evaluate(async t => { const A = window.CASE_GEO_AGENT, n0 = A.state.log.length; await A.ask(t); return A.state.log.slice(n0).map(m => m.who + ':' + m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()); }, t);
  log = await ask('зона охвата по методике, GLA 20000, ставка $25');
  const cm = await pg.evaluate(() => { const A = window.CASE_GEO_AGENT, r = (A.state.lastResults || {}).catchment || null; let polys = 0; map.eachLayer(l => { if (l instanceof L.Polygon && /^#(6B0000|A32316|D4735E)$/i.test(l.options.color) && l.getTooltip && l.getTooltip() && /PTA|STA|TTA/.test(String(l.getTooltip().getContent()))) polys++; }); return { polys, r }; });
  const r = cm.r;
  ck('изохроны OSRM за 10/20/30 мин: три полигона PTA / STA / TTA нарисованы', hits.table > 0 && cm.polys === 3, JSON.stringify({ table: hits.table, polys: cm.polys }));
  ck('результат: режим «изохрона», население по поясам растёт с расстоянием, д/х = население / 4,5, RDE = население × $349', !!r && r.mode === 'isochrone' && r.zones.length === 3 && r.zones[0].population > 0 && r.zones[1].cum_population > r.zones[0].cum_population && r.zones.every(z => near(z.households, z.population / 4.5, 1) && near(z.rde_usd, z.population * 349, 1)), r ? JSON.stringify(r.zones) : 'нет');
  ck('capture rate: требуемый оборот = GLA × ставка × 12 / 0,15 = $40 млн, доли 75/20/5, ставка захвата по PTA рассчитана', !!r && r.required_turnover_usd === 40000000 && r.captures && r.captures.length === 3 && near(r.captures[0].required_usd, 30000000, 1) && near(r.captures[1].required_usd, 8000000, 1) && r.captures[0].capture_rate > 0, r ? JSON.stringify(r.captures) : 'нет');
  ck('происхождение: «расчёт» с методикой CASE и списком требуемых входных данных без пункта про GLA', !!r && r.provenance.conf === 'modelled' && /Методика CASE/.test(r.provenance.source) && r.inputs_needed.length === 3 && !r.inputs_needed.some(x => /GLA/.test(x)), r ? r.inputs_needed.join('; ') : 'нет');
  ck('в журнале таблица зон (PTA, STA, TTA, capture) и честная оговорка «Оценка, не факт»', has(log, 'fact', /PTA/) && has(log, 'fact', /TTA/) && has(log, 'fact', /capture/i) && has(log, 'ai', /Оценка, не факт/), log.join(' | ').slice(0, 400));
  const tbl = await pg.evaluate(() => { const t = [...document.querySelectorAll('#gaLog table.ga-tbl')].pop(); return t ? { rows: t.querySelectorAll('tr').length, dash: new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(t.textContent) } : null; });
  ck('таблица в журнале: заголовок и три строки, без длинных тире', !!tbl && tbl.rows === 4 && !tbl.dash, JSON.stringify(tbl));
  tableMode = 'down';
  log = await ask('зона охвата 5 10 15 мин');
  const r2 = await pg.evaluate(() => (window.CASE_GEO_AGENT.state.lastResults || {}).catchment || null);
  ck('маршрутизатор недоступен: запасной путь по радиусам 0,4 км на минуту (2/4/6 км), это сказано явно', !!r2 && r2.mode === 'radius' && r2.minutes.join() === '5,10,15' && /2\.0\/4\.0\/6\.0 км/.test(r2.provenance.method) && has(log, 'ai', /маршрутизатор недоступен/i), r2 ? r2.provenance.method : 'нет');
  const clr = await pg.evaluate(async () => { await window.CASE_GEO_AGENT.run('clear_layers', { what: 'all' }); let n = 0; map.eachLayer(l => { if (l instanceof L.Polygon && l.getTooltip && l.getTooltip() && /PTA|STA|TTA/.test(String(l.getTooltip().getContent()))) n++; }); return n; });
  ck('«очистить всё» убирает и зоны охвата', clr === 0, String(clr));
  const chip = await pg.evaluate(() => (document.querySelector('#gaPanel .ga-chip') || {}).textContent);
  ck('первый чип агента: «зона охвата по методике»', /зона охвата по методике/.test(chip || ''), chip);

  console.log('--- 13. Итог');
  ck('ошибок страницы нет', errs.length === 0, errs.join(' | ').slice(0, 300) || 'нет');
  const src = ['v4750-geo-tools.js', 'v4750-geo-layout.js', 'v4730-geo-agent.js'].map(f => fs.readFileSync(path.join(OS, f), 'utf8'));
  ck('в исходниках новых модулей нет длинных тире', !src.some(t => DASH.test(t)));
  await b.close(); srv.close();
  console.log('\n' + (bad ? bad + ' проблем' : 'Инструменты карты, контекстное меню, компоновка и зоны охвата работают'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
