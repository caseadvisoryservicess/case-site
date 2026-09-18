/* v4.78.0: студия: ручные границы махаллей, НГИС из браузера, демография во всех отчётах,
   тренды расходов, бесплатный ограниченный доступ (мок-бэкенд, стаб НГИС).

   Что проверяется:
     1. Версии 4.78.0 у студии, выгрузки, прав, махаллей и модуля НГИС; кнопки «Границы махаллей из
        НГИС» и блок «Генплан и налоговая зона (НГИС)» на месте.
     2. Граница махалли вручную: полигон, нарисованный инструментами карты, сохраняется в запись
        махалли мастер-базы (geoSetMahallaBoundary), население считается внутри границы (conf asking),
        на карте полигон, подпись «введена вручную»; удаление возвращает оценку по радиусу.
     3. НГИС: кнопка запрашивает слой махаллей Ташкента (стаб: два полигона Юнусабадского района по
        SOATO 1726266 с настоящими кодами 1726266012 и 1726266001), полигоны попадают в модуль махаллей
        (origin ngis, впереди 402 из файла, по коду), кэш в браузере, авто-загрузка помечена; генплан и
        налоговая зона в точке живым запросом (локальная выгрузка закрыта маршрутом), перевод функции,
        факт в журнале.
     4. Отчёт по точке: раздел «L. Демография и рынок» с числами и пирамидой, «M. Генплан», оба в
        LASTPROBE.html (уходят в PDF); вкладка «Аналитика»: «I. Демография и рынок» и «I2. Район точки».
     5. Тренды: пять рядов (население, домохозяйства, доход, расходы, RDE), три диаграммы, CSV с RDE;
        exportRows для Excel/PPTX: строки, слайд, подпись.
     5b. Генплан из локальной выгрузки без сети (источник local, махалля зоны, налоговая зона), слой
        генплана на карте с легендой, mahallaAt; реестр 585 / 402 загружен, кадастровых участков нет,
        Чиланзарский район: строки базы + махалли реестра, площади, плотность.
     6. Бесплатный ограниченный доступ (?limited=1): класс geo-limited, 40 БЦ, баннер, профиль «Ищу
        офис», без вкладки данных.
     7. Ошибок страницы нет, длинных тире в новых файлах нет.

   Запуск: NODE_PATH=... node v4780_studio.js [папка os] */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
/* две махалли Юнусабадского района из мастер-базы: UCH KAKHRAMON и ASTROBOD */
const M1 = { key: 'MAH-80ee0b8a6d32', lat: 41.381243, lng: 69.286248 }, M2 = { key: 'MAH-438004eb0b48', lat: 41.374329, lng: 69.271063 };
const sq = (c, d) => [[c.lng - d, c.lat - d], [c.lng + d, c.lat - d], [c.lng + d, c.lat + d], [c.lng - d, c.lat + d], [c.lng - d, c.lat - d]];

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base } = await createMockServer(OS, { initialState: {} });
  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  const ngis = { mahalla: 0, genplan: 0, nalog: 0 };
  await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await pg.route('**/api/gis_proxy.php**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows: [], provenance: { source: 'OpenStreetMap', conf: 'asking' }, truncated: false }) }));
  await pg.route('https://db.ngis.uz/**', r => {
    const u = r.request().url();
    const j = body => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (/MAHALLA_UZKAD_DB16\/FeatureServer\/0\/query/.test(u)) {
      ngis.mahalla++;
      return j({ type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [sq(M1, 0.004)] }, properties: { soato_region: '1726', soato_district: '1726266', mahalla_code: 'uuid-1', cadastral_number: '1726266012', name: 'Uch Qahramon MFY' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [sq(M2, 0.004)] }, properties: { soato_region: '1726', soato_district: '1726266', mahalla_code: 'uuid-2', cadastral_number: '1726266001', nomi: 'Astrobod MFY' } }] });
    }
    if (/TOSHKENT_GENPLAN_3857_MAP/.test(u)) { ngis.genplan++; return j({ features: [{ attributes: { OBJECTID: 7, funksiya: 'Ishbilarmonlik_markazi', hudud: 'Markaziy', strategiya: 'Rekonstruksiya', qavatlilik: '9-12', qurilish_maydonining_yer_maydon: 0.45, seysmologik_zonasi: '8', mahalla_id: 'uuid-1', Shape_Area: 1234.5 } }] }); }
    if (/TOSHKENT_NALOG_ZONE_MAP/.test(u)) { ngis.nalog++; return j({ features: [{ attributes: { OBJECTID: 2, ez_tashkent: 'ez_tashkent_2' } }] }); }
    return r.abort();
  });
  const open = async (q) => {
    await pg.goto(base + '/geoanalytics-studio.html?embedded=1' + (q || ''), { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.CASE_GEO_DEMO && window.CASE_GEO_DEMO.ready && window.CASE_GEO_NGIS && window.CASE_GEO_PROFILES && window.CASE_GEO_PROFILES.current && window.CASE_GEO_CAPS && window.CASE_GEO_CAPS.caps && document.getElementById('mahSect') && document.getElementById('ngisLoad') && document.getElementById('ngisPoint') && typeof CAL !== 'undefined' && CAL && document.getElementById('mahDist').options.length > 2, null, { timeout: 40000 });
    await pg.waitForTimeout(800);
    /* внутри платформы право правок приходит контекстом от родительского окна; здесь родителя нет, шлём сами */
    if (!/limited=1/.test(q || '')) { await pg.evaluate(() => window.postMessage({ source: 'asaas-os-v4', type: 'asaas-geo-context', context: { editable: true, adminEdit: true, user: { name: 'Проверяющий' } } }, location.origin)); await pg.waitForTimeout(400); }
  };
  /* локальная выгрузка генплана закрыта маршрутом до раздела 5b: точка проекта по умолчанию и точка теста
     уходят живым запросом к НГИС (стаб) */
  await pg.route('**/data/ngis_genplan_tashkent.geojson', r => r.abort());
  await open();

  console.log('--- 1. Версии и разметка');
  const v = await pg.evaluate(() => { const M = window.CASE_MODULE_VERSIONS || {}; return { studio: M['v420-geo-studio'], exp: M['v4530-geo-export'], caps: M['v4760-geo-caps'], mah: M['v4770-geo-mahalla'], ngis: M['v4780-geo-ngis'], btn: !!document.getElementById('ngisLoad'), pt: (document.getElementById('ngisPoint') || {}).textContent, bnd: !!document.getElementById('mahBndSet'), fn: typeof window.geoSetMahallaBoundary, mk: typeof window.CASE_GEO_DEMO.setBoundaries }; });
  ck('студия, выгрузка, права, махалли и НГИС версии 4.78.0; кнопки и блоки на месте', v.studio === '4.78.0' && v.exp === '4.78.0' && v.caps === '4.78.0' && v.mah === '4.78.0' && v.ngis === '4.78.0' && v.btn && /Поставьте точку/.test(v.pt) && v.bnd && v.fn === 'function' && v.mk === 'function', JSON.stringify(v));

  console.log('--- 2. Граница махалли вручную');
  await pg.evaluate(k => window.CASE_GEO_DEMO.select('Yunusabad', k), M1.key); await pg.waitForTimeout(300);
  const b0 = await pg.evaluate(() => ({ hidden: document.getElementById('mahBnd').hidden, info: document.getElementById('mahBndInfo').textContent, layers: window.CASE_GEO_DEMO.layerCount() }));
  ck('махалля выбрана: блок границы виден, «нет: население по радиусу»', !b0.hidden && /по радиусу/.test(b0.info), JSON.stringify(b0));
  await pg.click('#mahBndSet'); await pg.waitForTimeout(200);
  ck('без полигона: подсказка нарисовать', /Нарисуйте полигон/.test(await pg.evaluate(() => document.getElementById('geoToast').textContent)));
  await pg.evaluate(m => window.CASE_GEO_AGENT.run('draw_polygon', { points: [[m.lat + 0.004, m.lng - 0.005], [m.lat + 0.004, m.lng + 0.005], [m.lat - 0.004, m.lng + 0.005], [m.lat - 0.004, m.lng - 0.005]] }), M1); await pg.waitForTimeout(300);
  await pg.click('#mahBndSet'); await pg.waitForTimeout(500);
  const b1 = await pg.evaluate(k => { const e = window.CASE_GEO_DEMO.estimateDistrict('Yunusabad'), r = e.rows.find(x => x.key === k); const row = window.CASE_GEO_POI.rows('mahallas').find(x => x.master_id === k); const sum = e.rows.reduce((s, x) => s + (x.pop || 0), 0); return { poly: !!r.poly, manual: r.poly && r.poly.manual, conf: r.conf, src: r.src, pop: Math.round(r.pop), saved: !!(row && row.boundary), ring: row && row.boundary ? JSON.parse(row.boundary).length : 0, info: document.getElementById('mahBndInfo').textContent, sum, layers: window.CASE_GEO_DEMO.layerCount(), toast: document.getElementById('geoToast').textContent, listTxt: (document.querySelector('#mahList .mah-row.sel .s') || {}).textContent }; }, M1.key);
  ck('граница из полигона: сохранена в записи махалли (4 вершины), население внутри границы (asking), сумма по району прежняя, полигон на карте, подписи «введена вручную»', b1.poly && b1.manual && b1.conf === 'asking' && /вручную/.test(b1.src) && b1.pop > 0 && b1.saved && b1.ring === 4 && /введена вручную/.test(b1.info) && near(b1.sum, 396800, 5) && b1.layers === b0.layers + 1 && /общей базе/.test(b1.toast) && /граница вручную/.test(b1.listTxt), JSON.stringify(b1));
  await pg.click('#mahBndClear'); await pg.waitForTimeout(400);
  const b2 = await pg.evaluate(k => { const r = window.CASE_GEO_DEMO.estimateDistrict('Yunusabad').rows.find(x => x.key === k); const row = window.CASE_GEO_POI.rows('mahallas').find(x => x.master_id === k); return { poly: !!r.poly, conf: r.conf, saved: row.boundary, info: document.getElementById('mahBndInfo').textContent }; }, M1.key);
  ck('удаление границы: оценка по радиусу, запись очищена', !b2.poly && b2.conf === 'modelled' && b2.saved === '' && /по радиусу/.test(b2.info), JSON.stringify(b2));
  if (process.env.SHOTS) { await pg.click('#mahBndSet'); await pg.waitForTimeout(400); await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_boundary.png') }); await pg.click('#mahBndClear'); await pg.waitForTimeout(300); }

  console.log('--- 3. НГИС: границы и генплан');
  await pg.click('#ngisLoad');
  await pg.waitForFunction(() => /Границы из НГИС: 2 полигонов/.test(document.getElementById('ngisStatus').textContent), null, { timeout: 20000 }).catch(async () => { console.log('   статус НГИС: ' + await pg.evaluate(() => document.getElementById('ngisStatus').textContent)); });
  const n1 = await pg.evaluate(() => { const e = window.CASE_GEO_DEMO.estimateDistrict('Yunusabad'); const withNgis = e.rows.filter(r => r.poly && r.poly.origin === 'ngis'); const all = window.CASE_GEO_DEMO.boundaries() || [], bnd = all.filter(b => b.origin === 'ngis'); return { n: withNgis.length, names: withNgis.map(r => r.name), bnd: bnd.length, file: all.filter(b => b.origin === 'file').length, first: all[0] && all[0].origin, codes: bnd.map(b => b.props.mahalla_code), bndNames: bnd.map(b => b.name), districts: bnd.map(b => b.district), conf: withNgis.map(r => r.conf), sum: e.rows.reduce((s, x) => s + (x.pop || 0), 0), cache: !!localStorage.getItem('caseos_ngis_mahalla_v1'), auto: localStorage.getItem('caseos_ngis_auto'), status: document.getElementById('ngisStatus').textContent, info: document.getElementById('mahBndInfo').textContent }; });
  ck('НГИС: 2 полигона Юнусабадского района (район по SOATO, код = кадастровый номер), имена из name и nomi, живые полигоны впереди 402 из файла, UCH KAKHRAMON и ASTROBOD получили границу НГИС по коду (asking), сумма по району прежняя, кэш и авто-загрузка записаны', ngis.mahalla === 1 && n1.n === 2 && n1.names.sort().join('|') === 'ASTROBOD|UCH KAKHRAMON' && n1.bnd === 2 && n1.file === 402 && n1.first === 'ngis' && n1.codes.join('|') === '1726266012|1726266001' && n1.bndNames.join('|') === 'Uch Qahramon MFY|Astrobod MFY' && n1.districts.every(d => d === 'Yunusabad') && n1.conf.every(c => c === 'asking') && near(n1.sum, 396800, 5) && n1.cache && n1.auto === '1' && /из НГИС/.test(n1.info) && /2 полигонов по Ташкенту, 1 районов/.test(n1.status), JSON.stringify(n1));
  await pg.evaluate(m => window.CASE_GEO_AGENT.run('set_site', { lat: m.lat, lon: m.lng, name: 'тест НГИС' }), M1);
  await pg.waitForFunction(() => /деловой центр/.test((document.getElementById('ngisPoint') || {}).textContent || ''), null, { timeout: 20000 });
  const n2 = await pg.evaluate(() => ({ txt: document.getElementById('ngisPoint').textContent.replace(/\s+/g, ' '), fact: window.CASE_GEO_AGENT.state.log.filter(m => m.who === 'fact').slice(-1)[0], gp: window.CASE_GEO_NGIS.genplan }));
  ck('генплан в точке: функция переведена, этажность, стратегия, сейсмика, налоговая зона, атрибуция; факт в журнале агента', ngis.genplan >= 1 && ngis.nalog >= 1 && /деловой центр \(Ishbilarmonlik_markazi\)/.test(n2.txt) && /Этажность\s*9-12/.test(n2.txt) && /реконструкция/.test(n2.txt) && /Сейсмическая зона\s*8/.test(n2.txt) && /ez_tashkent_2/.test(n2.txt) && /open\.ngis\.uz/.test(n2.txt) && /не подтверждены/.test(n2.txt) && !/OBJECTID|Shape_Area/.test(n2.txt) && n2.fact && /Генплан \(НГИС\)/.test(n2.fact.html) && n2.gp && n2.gp.genplan && n2.gp.genplan.funksiya === 'Ishbilarmonlik_markazi' && n2.gp.source === 'live' && /запрос из вашего браузера/.test(n2.txt), JSON.stringify({ txt: n2.txt.slice(0, 200), hits: ngis, source: n2.gp && n2.gp.source }));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_ngis.png') });

  console.log('--- 4. Демография в отчёте по точке и на вкладке «Аналитика»');
  await pg.evaluate(() => window.caseGeoProjectReport(false));
  await pg.waitForFunction(() => document.getElementById('probe').classList.contains('open') && document.querySelector('#probe .dm-probe-wrap') && document.querySelector('#probe .ngis-probe'), null, { timeout: 30000 });
  const p1 = await pg.evaluate(() => { const w = document.querySelector('#probe .dm-probe-wrap'), t = w.textContent.replace(/ /g, ' '); return { h3: (w.querySelector('h3') || {}).textContent, kpi: w.querySelectorAll('.dm-k').length, pyr: w.querySelectorAll('.dm-pyr rect').length, rows: w.querySelectorAll('.dm-tr tbody tr').length, charts: w.querySelectorAll('.dm-line').length, pop: /Население/.test(t) && /Домохозяйств/.test(t), rde: /RDE/.test(t), share: /Рыночная доля проекта/.test(t), src: /Источники: stat\.uz/.test(t), noNeed: !/Требуемые входные данные/.test(t), inLast: /L\. Демография и рынок/.test(LASTPROBE.html) && /M\. Генплан Ташкента/.test(LASTPROBE.html) && /fill="#9E0000"/.test(LASTPROBE.html), gp: (document.querySelector('#probe .ngis-probe') || {}).textContent }; });
  ck('отчёт по точке: раздел L с показателями, пирамидой, пятью рядами тренда без диаграмм, долей рынка и краткими источниками; раздел M генплан; оба в LASTPROBE.html для PDF с инлайн-стилями', /L\. Демография и рынок: зона 3 км/.test(p1.h3) && p1.kpi >= 6 && p1.pyr === 32 && p1.rows === 5 && p1.charts === 0 && p1.pop && p1.rde && p1.share && p1.src && p1.noNeed && p1.inLast && /Ishbilarmonlik_markazi/.test(p1.gp), JSON.stringify({ h3: p1.h3, kpi: p1.kpi, pyr: p1.pyr, rows: p1.rows, charts: p1.charts, inLast: p1.inLast }));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_probe_demo.png') });
  await pg.evaluate(() => closeProbe());
  await pg.click('.tabs button[data-t="anaT"]'); await pg.waitForTimeout(500);
  const a1 = await pg.evaluate(() => { const a = document.querySelector('#anaT .dm-ana'); const t = a ? a.textContent.replace(/ /g, ' ') : ''; return { has: !!a, i: /I\. Демография и рынок/.test(t), i2: /I2\. Район точки анализа: Юнусабадский/.test(t), city: /3 212 200/.test(t), dist: /396 800/.test(t), market: /591 217 м² GLA/.test(t) && /CMWP/.test(t), once: document.querySelectorAll('#anaT .dm-ana').length }; });
  ck('вкладка «Аналитика»: раздел I (город 3 212 200, рынок CMWP) и I2 (Юнусабадский район 396 800), один раз', a1.has && a1.i && a1.i2 && a1.city && a1.dist && a1.market && a1.once === 1, JSON.stringify(a1));
  await pg.click('.tabs button[data-t="mapT"]'); await pg.waitForTimeout(200);

  console.log('--- 5. Тренды расходов и выгрузка');
  await pg.evaluate(() => window.CASE_GEO_DEMO.open('city')); await pg.waitForTimeout(400);
  const t1 = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#dmBody .dm-tr tbody tr')].map(r => r.children[0].textContent); const sr = window.CASE_GEO_DEMO.seriesFor(3212200); return { rows, charts: document.querySelectorAll('#dmBody .dm-line').length, method: /темпом дохода/.test(document.getElementById('dmBody').textContent), rde: sr.rde && sr.rde.forecast.length, rdeLast: sr.rde && Math.round(sr.rde.forecast[9].v / 1e12), sp: sr.spending && sr.spending.points.length, spCagr: sr.spending && sr.spending.cagr, market: /Рынок города/.test(document.getElementById('dmBody').textContent) }; });
  ck('таблица трендов: 5 рядов (население, домохозяйства, доход, расходы, RDE), 3 диаграммы, метод с темпом дохода, RDE 2036 в триллионах, рынок города', t1.rows.length === 5 && /Потребительские расходы/.test(t1.rows[3]) && /RDE/.test(t1.rows[4]) && t1.charts === 3 && t1.method && t1.rde === 10 && t1.rdeLast >= 20 && t1.sp === 13 && t1.spCagr > 0.1 && t1.market, JSON.stringify(t1));
  const dl = pg.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await pg.click('#dmCsv'); const dlf = await dl; let csvTxt = ''; if (dlf) { try { csvTxt = fs.readFileSync(await dlf.path(), 'utf8'); } catch (e) {} }
  ck('CSV содержит ряд RDE с прогнозом 2036', !!dlf && /"RDE 2036";/.test(csvTxt) && /"RDE 2019";/.test(csvTxt), dlf ? 'есть' : 'нет скачивания');
  await pg.click('#dmX');
  const x1 = await pg.evaluate(m => { const r = window.CASE_GEO_DEMO.exportRows(m.lat, m.lng, 1000); return { label: r.label, rows: r.rows.length, slide: r.slide.length, head: r.rows[0].join('|'), pop: r.rows.find(x => x[0] === 'Население'), rde: r.rows.find(x => /^RDE \(/.test(x[0])), fc: r.rows.find(x => /^Население, прогноз 2036/.test(x[0])), kipc: r.rows.filter(x => /^КИПЦ/.test(x[0])).length, as: r.rows.filter(x => x[0] === 'Допущение').length, note: r.note }; }, M1);
  ck('exportRows(1 км): охват «1 км», строки для Excel (население, RDE, прогноз 2036, 13 КИПЦ, допущения), слайд до 14 строк, подпись', /1 км/.test(x1.label) && x1.rows > 45 && x1.slide <= 14 && x1.slide >= 10 && x1.head === 'Показатель|Значение|Примечание' && x1.pop && x1.pop[1] > 0 && x1.rde && x1.fc && x1.kipc === 13 && x1.as >= 2 && /CAGR/.test(x1.note), JSON.stringify({ label: x1.label, rows: x1.rows, slide: x1.slide, kipc: x1.kipc }));

  console.log('--- 5b. Локальная выгрузка генплана и слой на карте');
  await pg.unroute('**/data/ngis_genplan_tashkent.geojson');
  const liveBefore = ngis.genplan;
  await open();
  await pg.evaluate(m => window.CASE_GEO_AGENT.run('set_site', { lat: m.lat, lon: m.lng, name: 'тест генплана' }), M1);
  await pg.waitForFunction(() => window.CASE_GEO_NGIS.genplan && !window.CASE_GEO_NGIS.genplan.loading && window.CASE_GEO_NGIS.genplan.source, null, { timeout: 30000 });
  const g1 = await pg.evaluate(() => { const gp = window.CASE_GEO_NGIS.genplan, t = document.getElementById('ngisPoint').textContent.replace(/\s+/g, ' '); return { source: gp.source, f: gp.genplan && gp.genplan.funksiya, m: gp.genplan && gp.genplan.mahalla, nalog: gp.nalog && gp.nalog.ez_tashkent, txt: t, live: 0, ma: window.CASE_GEO_DEMO.mahallaAt(41.381243, 69.286248) }; });
  ck('генплан из локальной выгрузки (без сети): функция и махалля зоны, налоговая зона, подпись «выгрузка владельца», живой запрос не ушёл; mahallaAt даёт махаллю точки', g1.source === 'local' && !!g1.f && /Функция зоны/.test(g1.txt) && /выгрузка владельца 18\.09\.2026/.test(g1.txt) && /Налоговая зона/.test(g1.txt) && /ez_tashkent_\d/.test(g1.nalog || '') && ngis.genplan === liveBefore && g1.ma && g1.ma.name && g1.ma.district === 'Yunusabad', JSON.stringify({ source: g1.source, f: g1.f, m: g1.m, nalog: g1.nalog, ma: g1.ma && g1.ma.name, hits: ngis }));
  await pg.click('#ngisLayer');
  await pg.waitForFunction(() => window.CASE_GEO_NGIS.layerOn === true, null, { timeout: 30000 });
  const g2 = await pg.evaluate(() => ({ on: window.CASE_GEO_NGIS.layerOn, legend: document.getElementById('ngisLegend').hidden === false && document.querySelectorAll('#ngisLegend span').length, canvas: document.querySelectorAll('.leaflet-overlay-pane canvas').length }));
  ck('слой генплана на карте: включён, легенда из 12 функций, canvas-слой', g2.on && g2.legend === 12 && g2.canvas >= 1, JSON.stringify(g2));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_genplan_layer.png') });
  await pg.click('#ngisLayer'); await pg.waitForTimeout(200);
  ck('слой генплана выключен', await pg.evaluate(() => window.CASE_GEO_NGIS.layerOn === false));
  const r1 = await pg.evaluate(() => { const D = window.CASE_GEO_DEMO, R = D.registry(), e = D.estimateDistrict('Chilanzar'); const reg = e.rows.filter(r => r.regOnly), sim = e.rows.filter(r => r.regHow === 'similar' || r.regHow === 'polygon'); return { total: R && R.total, poly: R && R.with_polygon, chil: e.rows.length, base: e.baseN, official: e.official, matched: e.matched, regOnly: reg.length, regNames: reg.slice(0, 3).map(r => r.name), missing: e.missing.length, how: sim.length, withArea: e.rows.filter(r => r.area_ha != null).length, noParcels: e.rows.every(r => r.parcels === undefined) && D.parcels === undefined, dens: e.rows.filter(r => r.density != null).length }; });
  ck('реестр 585 (402 с полигоном) загружен, кадастровых участков в студии нет (замечание владельца); Чиланзарский: строки базы + махалли реестра без точки в базе, площади и плотность у строк, список махаллей без границы и точки', r1.total === 585 && r1.poly === 402 && r1.noParcels && r1.chil === r1.base + r1.regOnly && r1.official === 55 && r1.matched >= 45 && r1.regOnly >= 1 && r1.withArea >= 50 && r1.dens >= 40, JSON.stringify(r1));

  console.log('--- 6. Бесплатный ограниченный доступ');
  await pg.evaluate(() => { localStorage.removeItem('caseos_geo_profile'); localStorage.removeItem('caseos_ngis_auto'); });
  await open('&limited=1');
  await pg.waitForFunction(() => document.body.classList.contains('geo-limited') && document.getElementById('geoCapsBanner'), null, { timeout: 20000 });
  const l1 = await pg.evaluate(() => ({ cls: document.body.className, n: BC.length, banner: document.getElementById('geoCapsBanner').textContent, prof: window.CASE_GEO_PROFILES.current, data: getComputedStyle(document.querySelector('.tabs button[data-t="dataT"]')).display, hdr: document.getElementById('hdrCount').textContent, caps: window.CASE_GEO_CAPS.caps }));
  ck('ограниченный доступ: geo-limited (не demo), 40 БЦ, баннер «Бесплатный доступ «Ищу офис»», профиль office, вкладка данных скрыта', /geo-limited/.test(l1.cls) && !/geo-demo/.test(l1.cls) && l1.n === 40 && /Бесплатный доступ «Ищу офис»/.test(l1.banner) && /Обратная связь/.test(l1.banner) && l1.prof === 'office' && l1.data === 'none' && l1.caps.limited === true && l1.caps.tier === 'free', JSON.stringify({ cls: l1.cls, n: l1.n, prof: l1.prof, hdr: l1.hdr }));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_limited.png') });

  console.log('--- 7. Итог');
  ck('ошибок страницы нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  const read = f => fs.readFileSync(path.join(OS, f), 'utf8');
  const dashed = ['v4780-geo-ngis.js', 'v4770-geo-mahalla.js', 'v4760-geo-caps.js', 'data/demography_tashkent.json'].filter(f => DASH.test(read(f)));
  ck('длинных тире в новых файлах нет', dashed.length === 0, dashed.join(', ') || 'нет');
  const st = read('v420-geo-studio.js'), ex = read('v4530-geo-export.js');
  ck('студия, её экран и выгрузка целиком без длинных тире (v4.78.0 вычистила прежние)', !DASH.test(st) && !DASH.test(ex) && !DASH.test(read('geoanalytics-studio.html')) && !DASH.test(read('sw.js')), [['v420-geo-studio.js', st], ['v4530-geo-export.js', ex]].filter(x => DASH.test(x[1])).map(x => x[0]).join(', ') || 'чисто');
  await b.close(); srv.close();
  console.log(bad ? '\nПРОВАЛЕНО проверок: ' + bad : '\nВсе проверки v4.78.0 (студия) прошли');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(1); });
