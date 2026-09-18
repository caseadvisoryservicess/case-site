/* v4.77.0: студия: махалли и демография, сторона дороги, профили и «Что рядом» (мок-бэкенд).

   Что проверяется:
     1. Три новых модуля 4.77.0 зарегистрированы, разделы «Махалли и демография» и «Сторона
        дороги» вставлены в левую панель, переключатель профиля на вкладках, блок «Что рядом»
        в «Точке анализа», разделы размечены ключами; демография загружена из
        data/demography_tashkent.json.
     2. Махалли: список по району (Юнусабадский: 64 махалли, «из ~64 заявленных»), оценки
        населения по сетке в сумме равны официальному населению района, сортировка, выбор
        махалли рисует подпись на карте, ручное население сохраняется и учитывается в сумме,
        сброс возвращает оценку.
     3. Карточка «Демография и рынок»: охваты (город, 12 районов, зона охвата точки), население
        города по последнему факту, домохозяйства, пол, три группы, пирамида из 16 групп в
        полутоне (допущение подписано), КИПЦ 13 разделов, RDE, таблица трендов и прогноз на
        десять лет с методом, допущения, требуемые входные данные, источники; structure() и
        trendOf() как числа; CSV выгружается.
     4. Сторона дороги: дороги из стаба прокси; двусторонняя улица к центру: точка на стороне
        «в центр», для офиса «подходит», для супермаркета «встречная», смена типа без нового
        запроса; односторонняя из центра: сторона «из центра»; поперечная дорога: «неопределима»,
        для клиники «не критична»; стрелки и подпись на карте; факт в журнале агента; фраза
        агенту «с какой стороны дороги аптека» запускает расчёт с типом «Аптека».
     5. «Что рядом»: 12 позиций по загруженным слоям, радиус 300/500/800 запоминается,
        бизнес-центры и аптеки считаются по встроенной базе.
     6. Профили: «Ищу офис» прячет анализ локации, сторону дороги, махалли и итог; «Девелопер»
        показывает всё; выбор запоминается, установка из кабинета его сбрасывает; демо-доступ
        стартует с «Ищу офис».
     7. Ошибок страницы нет, длинных тире в новых модулях и данных нет.

   Запуск: NODE_PATH=... node v4770_geo.js [папка os] */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
const digits = s => +String(s).replace(/[^\d]/g, '');

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base } = await createMockServer(OS, { initialState: {} });
  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  let roads = [], roadHits = 0;
  await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await pg.route('**/api/gis_proxy.php**', r => {
    const u = new URL(r.request().url()); const mode = u.searchParams.get('mode');
    const j = body => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (mode === 'roads') { roadHits++; return j({ ok: true, rows: roads, provenance: { source: 'OpenStreetMap', licence: 'ODbL 1.0', attribution: '© OpenStreetMap contributors', method: 'Overpass API', fetched_at: '2026-09-18T10:00:00+05:00', conf: 'asking' }, truncated: false }); }
    return j({ ok: true, rows: [], provenance: { source: 'OpenStreetMap', conf: 'asking' }, truncated: false });
  });
  const open = async (q) => {
    await pg.goto(base + '/geoanalytics-studio.html?embedded=1' + (q || ''), { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => window.CASE_GEO_DEMO && window.CASE_GEO_DEMO.ready && window.CASE_GEO_ROADSIDE && window.CASE_GEO_PROFILES && window.CASE_GEO_PROFILES.current && window.CASE_GEO_CAPS && window.CASE_GEO_CAPS.caps && document.getElementById('mahSect') && document.getElementById('rsSect') && document.getElementById('geoProfile') && document.getElementById('amen') && typeof CAL !== 'undefined' && CAL && document.getElementById('mahDist').options.length > 2, null, { timeout: 40000 });
    await pg.waitForTimeout(800);
  };
  await open();

  console.log('--- 1. Модули, разделы, данные');
  const v = await pg.evaluate(() => { const M = window.CASE_MODULE_VERSIONS || {}; return { mah: M['v4770-geo-mahalla'], rs: M['v4770-geo-roadside'], pr: M['v4770-geo-profiles'], sects: [...document.querySelectorAll('.left>.sect')].map(s => s.dataset.sect || '?'), schema: window.CASE_GEO_DEMO.data.schema, pts: window.CASE_GEO_DEMO.data.city.population_series.length, tabsSel: !!document.querySelector('.tabs>#geoProfile'), amenIn: !!document.querySelector('#projInfo + #amen'), poi: window.CASE_GEO_POI.total('mahallas'), distOpts: document.getElementById('mahDist').options.length }; });
  ck('модули 4.78.0 и 4.77.0, восемь размеченных разделов, профиль на вкладках, «Что рядом» под точкой, демография загружена, 545 махаллей, 12 районов', v.mah === '4.78.0' && v.rs === '4.77.0' && v.pr === '4.77.0' && v.sects.join(',') === 'point,analysis,road,rings,bc,mah,layers,catch' && v.schema === 'case-demography/v1' && v.pts >= 12 && v.tabsSel && v.amenIn && v.poi === 545 && v.distOpts === 13, JSON.stringify(v));

  console.log('--- 2. Махалли по районам');
  await pg.selectOption('#mahDist', 'Yunusabad'); await pg.waitForTimeout(400);
  const m1 = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#mahList .mah-row')]; const e = window.CASE_GEO_DEMO.estimateDistrict('Yunusabad'); const sum = e.rows.reduce((s, r) => s + (r.pop || 0), 0); return { n: rows.length, sum, total: e.total, txt: document.getElementById('mahSum').textContent, first: rows[0] ? rows[0].textContent : '', desc: rows.length > 1 ? (+rows[0].querySelector('.p').textContent.replace(/[^\d]/g, '')) >= (+rows[1].querySelector('.p').textContent.replace(/[^\d]/g, '')) : false, allEst: e.rows.every(r => r.pop != null && (r.conf === 'modelled' || r.conf === 'asking')), bounded: e.boundedN, official: e.official, matched: e.matched, calibrated: e.calibrated }; });
  ck('Юнусабадский: 64 махалли, сумма оценок = 396 800 (Toshstat 01.07.2026), реестр Etirof 64 и 40 полигонов кадастра, все 64 сопоставлены, 40 с границами (asking), остальные по сетке, порядок по населению', m1.n === 64 && near(m1.sum, 396800, 5) && m1.total === 396800 && /в реестре Etirof 64 махаллей, полигонов в кадастре 40/.test(m1.txt) && /в базе 64 \(сопоставлено с реестром 64\)/.test(m1.txt) && /396 800/.test(m1.txt.replace(/\u00a0/g, ' ')) && m1.desc && m1.allEst && m1.bounded === 40 && m1.official === 64 && m1.matched === 64 && m1.calibrated, JSON.stringify({ n: m1.n, sum: Math.round(m1.sum), txt: m1.txt.slice(0, 160), desc: m1.desc, allEst: m1.allEst, bounded: m1.bounded, matched: m1.matched }));
  await pg.click('#mahSort button[data-s="name"]'); await pg.waitForTimeout(200);
  const m2 = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#mahList .mah-row .n')].map(x => x.textContent); return { sorted: rows.slice(0, 5).join('|') === rows.slice(0, 5).sort((a, b) => a.localeCompare(b, 'ru')).join('|'), first: rows[0] }; });
  ck('сортировка по имени', m2.sorted, JSON.stringify(m2));
  await pg.click('#mahList .mah-row'); await pg.waitForTimeout(400);
  const m3 = await pg.evaluate(() => ({ sel: document.querySelectorAll('#mahList .mah-row.sel').length, lbl: !!document.querySelector('.mah-lbl'), edit: !document.getElementById('mahEdit').hidden, name: document.getElementById('mahEditName').textContent, cur: window.CASE_GEO_DEMO.current().mahalla && window.CASE_GEO_DEMO.current().mahalla.name, layers: window.CASE_GEO_DEMO.layerCount() }));
  ck('клик по махалле: выделена, подпись на карте, слой района из 64 кружков, 40 полигонов и подписи, поле ручного населения открыто', m3.sel === 1 && m3.lbl && m3.edit && m3.name.replace(':', '') === m3.cur && m3.layers === 105, JSON.stringify(m3));
  await pg.fill('#mahPop', '12000'); await pg.click('#mahPopSave'); await pg.waitForTimeout(300);
  const m4 = await pg.evaluate(() => { const e = window.CASE_GEO_DEMO.estimateDistrict('Yunusabad'); const k = window.CASE_GEO_DEMO.current().mahalla.key; const r = e.rows.find(x => x.key === k); const sum = e.rows.reduce((s, x) => s + (x.pop || 0), 0); return { pop: r.pop, manual: r.manual, conf: r.conf, sum, manualN: e.manualN, saved: JSON.parse(localStorage.getItem('caseos_mahalla_pop_v1') || '{}')[k], green: !!document.querySelector('#mahList .mah-row.sel .p.man'), txt: document.getElementById('mahSum').textContent }; });
  ck('ручное население 12 000: приоритет, помечено зелёным, сумма по району прежняя, запомнено', m4.pop === 12000 && m4.manual && m4.conf === 'verified' && near(m4.sum, 396800, 5) && m4.manualN === 1 && m4.saved === 12000 && m4.green && /вручную: 1/.test(m4.txt), JSON.stringify(m4));
  await pg.click('#mahPopClear'); await pg.waitForTimeout(300);
  const m5 = await pg.evaluate(() => { const e = window.CASE_GEO_DEMO.estimateDistrict('Yunusabad'); return { manualN: e.manualN, saved: Object.keys(JSON.parse(localStorage.getItem('caseos_mahalla_pop_v1') || '{}')).length }; });
  ck('сброс ручного значения возвращает оценку', m5.manualN === 0 && m5.saved === 0, JSON.stringify(m5));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'geo_mahalla.png') });

  console.log('--- 3. Демография и рынок');
  const s1 = await pg.evaluate(() => { const D = window.CASE_GEO_DEMO, st = D.structure(100000), tr = D.trendOf(D.data.city.population_series); return { female: Math.round(st.female), hh: Math.round(st.households), age3: st.age3 ? Math.round(st.age3.under + st.age3.work + st.age3.over) : null, work: st.age3 && st.age3.workShare, age5n: st.age5 ? st.age5.length : 0, age5sum: st.age5 ? Math.round(st.age5.reduce((s, r) => s + r.m + r.f, 0)) : 0, age5conf: st.age5conf, rde: st.rde && st.rde.total, kipc: st.kipc.length, kipcW: st.kipc.reduce((s, r) => s + r.w, 0), income: st.income && st.income.uzs, usd: st.income && Math.round(st.income.usd), as: st.assumptions.length, cagr: tr.cagr, fc: tr.forecast.length, fcLast: tr.forecast.length ? tr.forecast[tr.forecast.length - 1].t : null, last: tr.last && tr.last.v }; });
  ck('structure(100 000): женщины 50 850 (Toshstat 01.07.2026), домохозяйств 23 256, три группы в сумме 100 000 (59% трудоспособных), 16 групп пирамиды в сумме 100 000 (допущение), RDE 441 млрд сум, КИПЦ 13 разделов (сумма ≈ 1), доход 73,91 млн сум ≈ $5 866, допущений ≥ 2', s1.female === 50850 && s1.hh === 23256 && s1.age3 === 100000 && s1.work === 0.59 && s1.age5n === 16 && near(s1.age5sum, 100000, 2) && s1.age5conf === 'modelled' && s1.rde === 4.41e11 && s1.kipc === 13 && near(s1.kipcW, 1, 0.01) && s1.income === 73910000 && near(s1.usd, 5866, 2) && s1.as >= 2, JSON.stringify(s1));
  ck('trendOf(город): темп > 2% в год, прогноз на 10 лет до 2036, последний факт 3 212 200', s1.cagr > 0.02 && s1.cagr < 0.06 && s1.fc === 10 && s1.fcLast === 2036 && s1.last === 3212200, JSON.stringify({ cagr: s1.cagr, fc: s1.fc, fcLast: s1.fcLast, last: s1.last }));
  await pg.evaluate(() => window.CASE_GEO_DEMO.open('city')); await pg.waitForTimeout(400);
  const s2 = await pg.evaluate(() => { const c = document.getElementById('card'); const t = c.textContent.replace(/\u00a0/g, ' '); return { open: c.classList.contains('open') && c.classList.contains('dm-open'), scopes: [...document.querySelectorAll('#dmScope option')].map(o => o.value), pop: /3 212 200/.test(t), hh: /747 023/.test(t), fem: /50,8%/.test(t), pyr: document.querySelectorAll('#dmBody .dm-pyr rect').length, mod: document.querySelectorAll('#dmBody .dm-pyr .dm-mod').length, bars: document.querySelectorAll('#dmBody .dm-bar').length, rdeBars: document.querySelectorAll('#dmBody .dm-bar.rde').length, trRows: document.querySelectorAll('#dmBody .dm-tr tbody tr').length, fc2036: /2036 · прогноз/.test(t), method: /CAGR/.test(t), lines: document.querySelectorAll('#dmBody .dm-line').length, need: /Требуемые входные данные/.test(t) && /Пятилетние возрастные группы/.test(t), src: /Источники/.test(t) && /stat\.uz/.test(t), as: /Допущения/.test(t) && /национальной пропорции/.test(t), kipc2025: /КИПЦ, 2025/.test(t) }; });
  ck('карточка по городу: охваты город + 12 районов + выбранная махалля, население 3 212 200, домохозяйств 747 023, женщин 50,8%, пирамида 32 столбца в полутоне, 13 разделов КИПЦ (4 RDE), пять рядов тренда, прогноз 2036 с методом CAGR, три диаграммы, допущения, входные данные, источники', s2.open && s2.scopes.length === 14 && s2.scopes[0] === 'city' && s2.scopes.filter(s => /^d:/.test(s)).length === 12 && s2.scopes.filter(s => /^m:/.test(s)).length === 1 && s2.pop && s2.hh && s2.fem && s2.pyr === 32 && s2.mod === 32 && s2.bars === 13 && s2.rdeBars === 4 && s2.trRows === 5 && s2.fc2036 && s2.method && s2.lines === 3 && s2.need && s2.src && s2.as && s2.kipc2025, JSON.stringify(s2));
  await pg.selectOption('#dmScope', 'd:Yunusabad'); await pg.waitForTimeout(300);
  const s3 = await pg.evaluate(() => { const t = document.getElementById('dmBody').textContent.replace(/\u00a0/g, ' '); return { pop: /396 800/.test(t), scope: /Юнусабадский район/.test(t), hh: /92 279/.test(t), facts: /Район: факты Toshstat/.test(t) && /Средняя зарплата/.test(t) && /15 038 500/.test(t) && /Оборот розницы/.test(t) && /SOATO 1726266/.test(t), own: /факты Toshstat по району/.test(t) }; });
  ck('охват «Юнусабадский район»: 396 800 жителей, 92 279 домохозяйств, факты Toshstat (зарплата 15 038 500 сум, розница, SOATO), тренд по ряду района', s3.pop && s3.scope && s3.hh && s3.facts && s3.own, JSON.stringify(s3));
  const dl = pg.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await pg.click('#dmCsv'); const dlf = await dl;
  let csvTxt = ''; if (dlf) { try { csvTxt = fs.readFileSync(await dlf.path(), 'utf8'); } catch (e) {} }
  ck('CSV выгружен: охват, население, группы, КИПЦ, прогноз, допущения', !!dlf && /Юнусабадский/.test(csvTxt) && /"население";"396800"/.test(csvTxt) && /возраст 0-4 мужчины/.test(csvTxt) && /КИПЦ 01/.test(csvTxt) && /прогноз/.test(csvTxt) && /допущение/.test(csvTxt), dlf ? csvTxt.slice(0, 80) : 'нет скачивания');
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'geo_demography.png') });
  await pg.click('#dmX'); await pg.waitForTimeout(200);
  ck('карточка закрыта', await pg.evaluate(() => !document.getElementById('card').classList.contains('open')));

  console.log('--- 4. Сторона дороги');
  /* улица север-юг к центру (центр южнее): точка западнее на 50 м, движение правостороннее */
  roads = [{ line: [[41.3350, 69.2856], [41.3250, 69.2856]], cls: 'secondary', name: 'улица Тестовая', oneway: false }, { line: [[41.3320, 69.2800], [41.3320, 69.2830]], cls: 'service', name: '', oneway: false }];
  await pg.evaluate(() => window.CASE_GEO_AGENT.run('set_site', { lat: 41.3300, lon: 69.2850, name: 'тест' })); await pg.waitForTimeout(500);
  await pg.selectOption('#rsType', 'office'); await pg.click('#rsGo');
  await pg.waitForFunction(() => window.CASE_GEO_ROADSIDE.last && document.getElementById('rsOut').querySelector('.rs-verdict'), null, { timeout: 15000 });
  const r1 = await pg.evaluate(() => { const R = window.CASE_GEO_ROADSIDE.last; return { side: R.geom.side, verdict: R.verdict.code, name: R.best.w.name, dist: R.geom.distRoadM, out: document.getElementById('rsOut').textContent, arrows: document.querySelectorAll('.rs-arrow').length, lbl: (document.querySelector('.rs-lbl') || {}).textContent, log: window.CASE_GEO_AGENT.state.log.slice(-1)[0], weak: R.geom.weak, angle: R.geom.angleDeg }; });
  ck('двусторонняя улица к центру, точка справа от потока «в центр»: сторона «в центр», офису подходит, ближайшая проезжая (не служебный проезд), ~50 м, две стрелки, подпись, факт в журнале', r1.side === 'in' && r1.verdict === 'match' && r1.name === 'улица Тестовая' && near(r1.dist, 50, 6) && /сторона «в центр»/.test(r1.out) && /сторона подходит/.test(r1.out) && /утренний поток/.test(r1.out) && r1.arrows === 2 && /в центр/.test(r1.lbl) && r1.log.who === 'fact' && /Сторона дороги/.test(r1.log.html) && !r1.weak && r1.angle < 25 && roadHits === 1, JSON.stringify({ side: r1.side, verdict: r1.verdict, name: r1.name, dist: r1.dist, arrows: r1.arrows, weak: r1.weak, angle: r1.angle, hits: roadHits }));
  await pg.selectOption('#rsType', 'retail'); await pg.waitForTimeout(200);
  const r2 = await pg.evaluate(() => ({ verdict: window.CASE_GEO_ROADSIDE.last.verdict.code, out: document.getElementById('rsOut').textContent }));
  ck('смена типа на супермаркет без нового запроса: сторона встречная, совет про разворот', r2.verdict === 'miss' && /сторона встречная/.test(r2.out) && /разворот/.test(r2.out) && roadHits === 1, JSON.stringify({ v: r2.verdict, hits: roadHits }));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'geo_roadside.png') });
  /* односторонняя от центра (юг -> север): обе стороны обслуживает поток «из центра» */
  roads = [{ line: [[41.3250, 69.2856], [41.3350, 69.2856]], cls: 'primary', name: 'проспект Односторонний', oneway: true }];
  await pg.evaluate(() => { window.CASE_GEO_AGENT.state.data.roads = null; });
  await pg.selectOption('#rsType', 'office'); await pg.click('#rsGo');
  await pg.waitForFunction(() => window.CASE_GEO_ROADSIDE.last && window.CASE_GEO_ROADSIDE.last.best.w.name === 'проспект Односторонний', null, { timeout: 15000 });
  const r3 = await pg.evaluate(() => { const R = window.CASE_GEO_ROADSIDE.last; return { side: R.geom.side, oneway: R.geom.oneway, verdict: R.verdict.code, arrows: document.querySelectorAll('.rs-arrow').length, out: document.getElementById('rsOut').textContent }; });
  ck('односторонняя от центра: сторона «из центра», для офиса встречная, одна стрелка, подписано «одностороннее»', r3.side === 'out' && r3.oneway && r3.verdict === 'miss' && r3.arrows === 1 && /одностороннее/.test(r3.out), JSON.stringify(r3));
  /* поперечная улица (восток-запад) севернее точки: направление на центр почти перпендикулярно */
  roads = [{ line: [[41.3305, 69.2800], [41.3305, 69.2900]], cls: 'tertiary', name: 'улица Поперечная', oneway: false }];
  await pg.evaluate(() => { window.CASE_GEO_AGENT.state.data.roads = null; });
  await pg.click('#rsGo');
  await pg.waitForFunction(() => window.CASE_GEO_ROADSIDE.last && window.CASE_GEO_ROADSIDE.last.best.w.name === 'улица Поперечная', null, { timeout: 15000 });
  const r4 = await pg.evaluate(() => { const R = window.CASE_GEO_ROADSIDE.last; return { weak: R.geom.weak, tang: R.geom.tangential, verdict: R.verdict.code, angle: R.geom.angleDeg, out: document.getElementById('rsOut').textContent }; });
  await pg.selectOption('#rsType', 'clinic'); await pg.waitForTimeout(200);
  const r5 = await pg.evaluate(() => ({ verdict: window.CASE_GEO_ROADSIDE.last.verdict.code, out: document.getElementById('rsOut').textContent }));
  ck('поперечная улица: для офиса «неопределима» (угол > 65°, пояснение), для клиники «не критична» с параметрами (парковка, подъезд)', r4.weak && r4.tang && r4.verdict === 'weak' && r4.angle > 65 && /кольцевая или поперечная/.test(r4.out) && r5.verdict === 'any' && /сторона не критична/.test(r5.out) && /парковка/i.test(r5.out), JSON.stringify({ r4: { weak: r4.weak, v: r4.verdict, angle: r4.angle }, r5: r5.verdict }));
  roads = [{ line: [[41.3350, 69.2856], [41.3250, 69.2856]], cls: 'secondary', name: 'улица Тестовая', oneway: false }];
  await pg.evaluate(() => { window.CASE_GEO_AGENT.state.data.roads = null; return window.CASE_GEO_AGENT.ask('с какой стороны дороги стоит аптека'); }); await pg.waitForTimeout(800);
  const r6 = await pg.evaluate(() => ({ type: document.getElementById('rsType').value, last: window.CASE_GEO_ROADSIDE.last.type.id, ai: window.CASE_GEO_AGENT.state.log.filter(m => m.who === 'ai').slice(-1)[0], you: window.CASE_GEO_AGENT.state.log.filter(m => m.who === 'you').slice(-1)[0] }));
  ck('фраза агенту про аптеку: тип «Аптека», расчёт выполнен, ответ агента с выводом', r6.type === 'pharmacy' && r6.last === 'pharmacy' && r6.ai && /сторон/.test(r6.ai.html) && /Аптека/.test(r6.ai.html) && r6.you && /аптека/.test(r6.you.html), JSON.stringify({ type: r6.type, ai: r6.ai && r6.ai.html.slice(0, 100) }));
  await pg.click('#rsClear'); ck('✕ убирает стрелки', await pg.evaluate(() => document.querySelectorAll('.rs-arrow').length === 0 && !window.CASE_GEO_ROADSIDE.last));

  console.log('--- 5. «Что рядом»');
  await pg.evaluate(() => window.CASE_GEO_PROFILES.renderAmenities()); await pg.waitForTimeout(100);
  const a1 = await pg.evaluate(() => { const items = [...document.querySelectorAll('#amen .amen-i')].map(i => ({ k: i.dataset.k, ok: !i.classList.contains('off'), n: i.querySelector('b').textContent, sub: (i.querySelector('small') || {}).textContent })); return { n: items.length, bc: items.find(i => i.k === 'bc'), ph: items.find(i => i.k === 'pharm'), med: items.find(i => i.k === 'med'), metro: items.find(i => i.k === 'metro'), note: (document.querySelector('#amen .amen-note') || {}).textContent, api: window.CASE_GEO_PROFILES.amenities({ lat: 41.3111, lng: 69.2797 }, 800), point: window.caseGeoPoint() }; });
  const metroApi = a1.api.find(i => i.k === 'metro');
  ck('12 позиций; бизнес-центры, аптеки и клиники по встроенной базе считаются; метро: ближайшая станция с расстоянием; радиус 500 м', a1.n === 12 && a1.bc && a1.bc.ok && a1.ph && a1.ph.ok && a1.med && a1.med.ok && a1.metro && a1.metro.ok && /м$/.test(a1.metro.sub) && /500 м/.test(a1.note) && a1.api.length === 12 && metroApi.n >= 1 && /Сквер Амира Темура/.test(metroApi.sub), JSON.stringify({ n: a1.n, bc: a1.bc, ph: a1.ph, med: a1.med, metro: a1.metro, metroApi, point: a1.point && a1.point.name }));
  await pg.click('#amen .amen-r button[data-r="800"]'); await pg.waitForTimeout(200);
  const a2 = await pg.evaluate(() => ({ r: localStorage.getItem('caseos_amen_r'), on: document.querySelector('#amen .amen-r button.on').dataset.r, note: document.querySelector('#amen .amen-note').textContent, bc: +document.querySelector('#amen .amen-i[data-k="bc"] b').textContent }));
  const a1bc = +(a1.bc ? a1.bc.n : 0);
  ck('радиус 800 м: запомнен, пересчёт (БЦ не меньше, чем в 500 м)', a2.r === '800' && a2.on === '800' && /800 м/.test(a2.note) && a2.bc >= a1bc, JSON.stringify({ a2, a1bc }));

  console.log('--- 6. Профили');
  const p0 = await pg.evaluate(() => ({ cur: window.CASE_GEO_PROFILES.current, sel: document.getElementById('geoProfile').value, list: window.CASE_GEO_PROFILES.list().map(x => x.id).join(',') }));
  ck('по умолчанию профиль «Всё» (полный доступ), шесть профилей', p0.cur === 'full' && p0.sel === 'full' && p0.list === 'office,developer,asset,consulting,leasing,full', JSON.stringify(p0));
  await pg.selectOption('#geoProfile', 'office'); await pg.waitForTimeout(200);
  const vis = () => pg.evaluate(() => { const o = {}; document.querySelectorAll('.left>.sect[data-sect]').forEach(s => { o[s.dataset.sect] = getComputedStyle(s).display !== 'none'; }); return o; });
  const p1 = await vis();
  ck('«Ищу офис»: скрыты анализ локации, сторона дороги, махалли, итог; видны точка, зона охвата, БЦ, слои; запомнено', await pg.evaluate(() => document.body.classList.contains('prof-office') && localStorage.getItem('caseos_geo_profile') === 'office') && !p1.analysis && !p1.road && !p1.mah && !p1.catch && p1.point && p1.rings && p1.bc && p1.layers, JSON.stringify(p1));
  await pg.evaluate(() => window.CASE_GEO_PROFILES.set('developer', true)); await pg.waitForTimeout(200);
  const p2 = await vis();
  ck('установка «Девелопер» из кабинета: все разделы видны, локальный выбор сброшен', Object.keys(p2).every(k => p2[k]) && await pg.evaluate(() => document.body.classList.contains('prof-developer') && localStorage.getItem('caseos_geo_profile') === null && document.getElementById('geoProfile').value === 'developer'), JSON.stringify(p2));
  await pg.selectOption('#geoProfile', 'leasing'); await pg.waitForTimeout(100);
  const p3 = await vis();
  ck('«Лизинг и продажи»: без анализа локации, махаллей и стороны дороги', !p3.analysis && !p3.mah && !p3.road && p3.bc && p3.catch, JSON.stringify(p3));
  if (process.env.SHOTS) { await pg.selectOption('#geoProfile', 'office'); await pg.waitForTimeout(200); await pg.screenshot({ path: path.join(process.env.SHOTS, 'geo_profile_office.png') }); }
  await pg.evaluate(() => localStorage.removeItem('caseos_geo_profile'));
  await open('&demo=1');
  const p4 = await pg.evaluate(() => ({ cur: window.CASE_GEO_PROFILES.current, demo: document.body.classList.contains('geo-demo'), stored: localStorage.getItem('caseos_geo_profile'), sel: document.getElementById('geoProfile').value }));
  ck('демо-доступ стартует с профиля «Ищу офис» (из прав, без записи в память)', p4.cur === 'office' && p4.demo && p4.stored === null && p4.sel === 'office', JSON.stringify(p4));

  console.log('--- 7. Итог');
  ck('ошибок страницы нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  const read = f => fs.readFileSync(path.join(OS, f), 'utf8');
  const dashed = ['v4770-geo-mahalla.js', 'v4770-geo-roadside.js', 'v4770-geo-profiles.js', 'data/demography_tashkent.json'].filter(f => DASH.test(read(f)));
  ck('длинных тире в новых модулях и данных нет', dashed.length === 0, dashed.join(', ') || 'нет');
  await b.close(); srv.close();
  console.log(bad ? '\nПРОВАЛЕНО проверок: ' + bad : '\nВсе проверки v4.77.0 (студия) прошли');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(1); });
