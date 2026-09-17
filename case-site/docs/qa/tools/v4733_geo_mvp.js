/* Проверка Geo Platform MVP (docs/standalone/CASE_Geo_Platform_MVP.html): открывает собранный файл
   по file://, блокирует тайлы и сеть, прогоняет 10 пользовательских сценариев и 8 тестов Geo AI из
   брифа, редактор данных, localStorage, RU-интерфейс и мобильную вёрстку.
   Запуск: NODE_PATH=<путь к playwright-core> node docs/qa/tools/v4733_geo_mvp.js */
'use strict';
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..', '..', '..');
const FILE = path.join(ROOT, 'docs', 'standalone', 'CASE_Geo_Platform_MVP.html');
const SHOTS = process.env.SHOTS || '';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let bad = 0; const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const src = fs.readFileSync(FILE, 'utf8');
  ck('в файле нет длинных тире', !new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(src));
  ck('Leaflet, кластеризация и данные встроены', /L\.markerClusterGroup\s*=/.test(src) && /var SEED = \{/.test(src) && !/__LEAFLET_JS__|__DATA__/.test(src));
  ck('в шапке нейтральное имя продукта, без ZAKY', /Geo<\/b> Platform/.test(src) && !/ZAKY/i.test(src));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  pg.on('dialog', d => d.type() === 'prompt' ? d.accept('Renamed layer') : d.accept());
  const netReq = []; await pg.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob):/.test(u)) return r.continue(); netReq.push(u); return r.abort(); });
  await pg.goto('file://' + FILE, { waitUntil: 'load' });
  await wait(800);

  /* 1. Загрузка и карта */
  const s0 = await pg.evaluate(() => ({ n: Data.all().length, demo: Data.all().filter(r => r.meta.demo).length, count: document.getElementById('fCount').textContent, pins: document.querySelectorAll('.pin').length, clusters: document.querySelectorAll('.mc').length, districtsOnMap: document.querySelectorAll('.leaflet-overlay-pane path').length, legend: document.getElementById('mlegend').innerText, badge: document.getElementById('dqBadge').innerText, tiles: !!document.querySelector('.leaflet-tile-pane') }));
  ck('154 записи (148 реальных + 6 DEMO), счётчик совпадает', s0.n === 154 && s0.demo === 6 && s0.count === '154', JSON.stringify(s0));
  ck('маркеры и кластеры на карте, легенда классов, бейдж качества', s0.pins + s0.clusters > 10 && /A\+/.test(s0.legend) && /154 records/.test(s0.badge), s0.pins + '/' + s0.clusters + ' ' + s0.badge);
  ck('только OSM-тайлы уходили в сеть, всё остальное локально', netReq.every(u => /tile\.openstreetmap\.org/.test(u)), netReq.filter(u => !/openstreetmap/.test(u)).slice(0, 3).join(' '));
  const dl = await pg.evaluate(async () => { document.getElementById('lyDist').click(); await new Promise(r => setTimeout(r, 200)); const n = document.querySelectorAll('.leaflet-overlay-pane path').length; document.getElementById('lyDist').click(); return n; });
  ck('слой районов включается (12 полигонов)', dl >= 12, dl);

  /* 2. Фильтры */
  const f = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms)); const cnt = () => +document.getElementById('fCount').textContent;
    const chip = (box, v) => document.querySelector('#' + box + ' .chip[data-v="' + v + '"]').click();
    const exp1 = Data.all().filter(r => ['A', 'A+'].includes(r.class)).length; chip('fClass', 'A'); chip('fClass', 'A+'); await S(100); const c1 = cnt();
    const exp2 = Data.all().filter(r => ['A', 'A+'].includes(r.class) && r.district === 'Mirabad').length; chip('fDistrict', 'Mirabad'); await S(100); const c2 = cnt();
    document.getElementById('fReset').click(); await S(100); const c3 = cnt();
    document.getElementById('fMore').click(); const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); };
    set('fRentMax', 30); await S(100); const exp4 = Data.all().filter(r => typeof r.rent === 'number' && r.rent <= 30).length; const c4 = cnt();
    set('fRentMax', ''); set('fGlaMin', 10000); await S(100); const exp5 = Data.all().filter(r => typeof r.gla === 'number' && r.gla >= 10000).length; const c5 = cnt();
    set('fGlaMin', ''); document.getElementById('fDemo').click(); await S(100); const c6 = cnt(); document.getElementById('fDemo').click();
    document.getElementById('fStale').click(); await S(100); const exp7 = Data.all().filter(r => Quality.isStale(r)).length; const c7 = cnt(); document.getElementById('fStale').click();
    document.getElementById('fMissing').click(); await S(100); const exp8 = Data.all().filter(r => Quality.missing(r).length).length; const c8 = cnt(); document.getElementById('fMissing').click();
    chip('fConf', 'unknown'); await S(100); const exp9 = Data.all().filter(r => Quality.confidence(r) === 'unknown').length; const c9 = cnt();
    document.getElementById('fReset').click(); await S(100);
    return { c1, exp1, c2, exp2, c3, c4, exp4, c5, exp5, c6, c7, exp7, c8, exp8, c9, exp9, sub: document.getElementById('fCountSub').textContent };
  });
  ck('класс A/A+ и район сужают выборку; сброс возвращает 154', f.c1 === f.exp1 && f.c1 > 0 && f.c2 === f.exp2 && f.c2 < f.c1 && f.c3 === 154, JSON.stringify([f.c1, f.exp1, f.c2, f.exp2, f.c3]));
  ck('ставка ниже 30 и GLA от 10 000: пропуски не проходят числовой фильтр', f.c4 === f.exp4 && f.c4 > 0 && f.c5 === f.exp5 && f.c5 === 4, JSON.stringify([f.c4, f.exp4, f.c5, f.exp5]));
  ck('DEMO выключается (148), устаревшие и неполные записи фильтруются, уверенность unknown', f.c6 === 148 && f.c7 === f.exp7 && f.c7 > 0 && f.c8 === f.exp8 && f.c8 > 100 && f.c9 === f.exp9, JSON.stringify([f.c6, f.c7, f.exp7, f.c8, f.exp8, f.c9, f.exp9]));

  /* 3. Поиск и карточка объекта */
  await pg.fill('#gSearch', 'Trilliant'); await wait(200);
  const sr = await pg.evaluate(() => ({ shown: !document.getElementById('gSearchRes').classList.contains('hidden'), n: document.querySelectorAll('#gSearchRes div[data-id]').length }));
  await pg.click('#gSearchRes div[data-id]'); await wait(400);
  const dr = await pg.evaluate(() => ({ open: document.getElementById('drawer').classList.contains('open'), title: document.querySelector('#dProp .ptitle').textContent, zoom: MapM.map().getZoom(), h3: [...document.querySelectorAll('#dProp h3')].map(h => h.textContent), acts: ['actCompare', 'actLocation', 'actAsk', 'actCopy', 'actEdit'].map(id => !!document.getElementById(id)), badges: document.querySelector('#dProp .badges').innerText, quality: [...document.querySelectorAll('#dProp .note')].map(n => n.textContent).join(' | '), sources: document.querySelectorAll('#dProp .src').length, sel: document.querySelectorAll('.pin.sel').length }));
  ck('глобальный поиск находит Trilliant, выбирает и приближает карту', sr.shown && sr.n >= 1 && dr.open && dr.title === 'Trilliant' && dr.zoom >= 15, JSON.stringify({ sr, title: dr.title, zoom: dr.zoom }));
  ck('карточка: метрики, коммерческие условия, арендаторы, инфраструктура, локация, качество, источники; все действия', ['Key metrics', 'Commercial', 'Tenants', 'Amenities', 'Location', 'Data quality', 'Sources'].every(h => dr.h3.includes(h)) && dr.acts.every(Boolean) && dr.sources >= 1 && dr.sel === 1, dr.h3.join(',') + ' src=' + dr.sources);
  ck('карточка показывает класс, уверенность, дату проверки и следующую проверку', /Office class A\+/.test(dr.badges) && /confidence/.test(dr.badges) && /Last verified/.test(dr.quality) && /Next verification/.test(dr.quality), dr.badges + ' | ' + dr.quality.slice(0, 120));
  const demoCard = await pg.evaluate(() => { const d = Data.all().find(r => r.meta.demo); App.select(d.id); return { warn: !!document.querySelector('#dProp .note.warn'), badge: /DEMO/.test(document.querySelector('#dProp .badges').innerText), na: document.querySelectorAll('#dProp .kv .na').length }; });
  ck('DEMO-запись помечена предупреждением и бейджем', demoCard.warn && demoCard.badge, JSON.stringify(demoCard));
  const cp = await pg.evaluate(async () => { App.select(Data.all().find(r => r.name === 'Trilliant').id); document.getElementById('actCopy').click(); await new Promise(r => setTimeout(r, 300)); return document.getElementById('toast').textContent; });
  ck('копирование координат даёт тост или запрос (без ошибки)', errs.length === 0, cp);

  /* 4. Аналитика с честными знаменателями */
  await pg.click('#btnAnalytics'); await wait(200);
  const an = await pg.evaluate(() => ({ open: document.getElementById('anaPanel').classList.contains('open'), cards: document.querySelectorAll('#anCards .mcard').length, text: document.getElementById('anCards').innerText, charts: [...document.querySelectorAll('.charts .chart')].map(c => c.querySelectorAll('rect.bar').length), dens: [...document.querySelectorAll('.charts .den')].map(d => d.textContent) }));
  ck('7 карточек, знаменатели «Based on N of 154», 4 графика с барами', an.open && an.cards === 7 && /Based on 21 of 154 properties with known rent/.test(an.text) && /Based on 6 of 154 properties with known GLA/.test(an.text) && an.charts.every(n => n > 0), JSON.stringify({ cards: an.cards, charts: an.charts }) + ' ' + an.text.replace(/\n/g, ' ').slice(0, 160));
  const ins = await pg.evaluate(async () => { document.querySelector('#fDistrict .chip[data-v="Olmazor"]').click(); await new Promise(r => setTimeout(r, 150)); const t = document.getElementById('anCards').innerText, ins = document.querySelectorAll('#anCards .ins').length, ch = document.getElementById('chRent').innerText; document.getElementById('fReset').click(); await new Promise(r => setTimeout(r, 150)); return { ins, t: t.replace(/\n/g, ' '), ch }; });
  ck('малая выборка (Olmazor): «Insufficient verified data» вместо чисел, и в графике ставок тоже', ins.ins >= 4 && /Insufficient verified data/.test(ins.ch), ins.ins + ' ' + ins.t.slice(0, 120));
  await pg.click('#anaClose');

  /* 5. Сравнение 2..4 без победителя */
  const cmp = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms));
    document.getElementById('viewList').click(); await S(150);
    const cards = document.querySelectorAll('#listPanel .pcard'); const tg = i => document.querySelectorAll('#listPanel [data-cmp]')[i].click();
    document.getElementById('listPanel').scrollTop = 400; tg(0); tg(1); tg(2); await S(100);
    const scroll = document.getElementById('listPanel').scrollTop, marks = document.querySelectorAll('#listPanel .cmp.on').length;
    const n = document.getElementById('cmpN').textContent; document.querySelector('.dtabs [data-t=cmp]').click(); await S(100);
    const th = document.querySelectorAll('#dCmp table.cmp th').length, na = document.querySelectorAll('#dCmp td.na').length, note = document.querySelector('#dCmp .note').textContent;
    tg(3); tg(4); await S(100); const n5 = Compare.ids().length; const toast = document.getElementById('toast').textContent;
    document.getElementById('cmpClear').click(); await S(100); const cleared = Compare.ids().length, marks2 = document.querySelectorAll('#listPanel .cmp.on').length; document.getElementById('viewMap').click();
    return { cards: cards.length, scroll, marks, n, th, na, note, n5, toast, cleared, marks2, visible: !document.getElementById('dCmp').classList.contains('hidden') };
  });
  ck('список карточек, переключатель добавляет 3 объекта (список не теряет прокрутку), таблица 3 колонки, пропуски как n/a, победителя нет, максимум 4', cmp.cards === 154 && cmp.scroll === 400 && cmp.marks === 3 && cmp.n === '(3)' && cmp.th === 4 && cmp.na > 0 && /No winner/.test(cmp.note) && cmp.n5 === 4 && /up to 4/.test(cmp.toast) && cmp.cleared === 0 && cmp.marks2 === 0 && cmp.visible, JSON.stringify(cmp));

  /* 6. Анализ локации 1/3/5 км и конкурентный набор */
  const loc = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms)); const id = Data.all().find(r => r.name === 'Trilliant').id; App.select(id); document.getElementById('actLocation').click(); await S(200);
    let circles = 0; MapM.map().eachLayer(l => { if (l instanceof L.Circle) circles++; });
    const t = document.getElementById('dLoc').innerText, cbs = document.querySelectorAll('#dLoc [data-cs]'), checked = document.querySelectorAll('#dLoc [data-cs]:checked').length;
    const first = cbs[0]; first.click(); const after = Location.setIds().length; first.click();
    document.getElementById('csLayer').click(); await S(150); const layers = Layers.list().length, layN = document.getElementById('layN').textContent, layTab = !document.getElementById('dLay').classList.contains('hidden');
    document.querySelector('.dtabs [data-t=loc]').click(); document.getElementById('csCompare').click(); await S(150); const cmpN = Compare.ids().length;
    return { circles, t: t.replace(/\n/g, ' ').slice(0, 300), n: cbs.length, checked, after, layers, layN, layTab, cmpN, within: /within 1 km/i.test(t) && /within 3 km/i.test(t) && /within 5 km/i.test(t), den: /of \d+ with known rent/.test(t), note: /straight-line/.test(t) };
  });
  ck('радиусы 1/3/5 км на карте, счётчики, знаменатель ставки, примечание о прямой линии', loc.circles === 3 && loc.within && loc.den && loc.note, JSON.stringify({ c: loc.circles, w: loc.within, d: loc.den }) + ' ' + loc.t.slice(0, 160));
  ck('конкурентный набор редактируется, слой из набора, сравнение из набора', loc.n >= 3 && loc.checked >= 1 && loc.after !== loc.checked && loc.layers === 1 && loc.layN === '(1)' && loc.layTab && loc.cmpN >= 2 && loc.cmpN <= 4, JSON.stringify({ n: loc.n, checked: loc.checked, after: loc.after, layers: loc.layers, cmpN: loc.cmpN }));

  /* 7. Слои ИИ: показать/скрыть, переименовать, удалить */
  const lay = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms)); document.querySelector('.dtabs [data-t=lay]').click(); await S(100);
    const rings = () => { let n = 0; MapM.map().eachLayer(l => { if (l instanceof L.CircleMarker && !(l instanceof L.Circle)) n++; }); return n; };
    const before = rings(); document.querySelector('#dLay [data-a=vis]').click(); await S(100); const hidden = rings(), off = document.querySelectorAll('#dLay .layer.off').length;
    document.querySelector('#dLay [data-a=vis]').click(); await S(100); const shown = rings();
    document.querySelector('#dLay [data-a=ren]').click(); await S(100); const name = document.querySelector('#dLay .layer b').textContent;
    document.querySelector('#dLay [data-a=rm]').click(); await S(100); return { before, hidden, off, shown, name, left: Layers.list().length, empty: /No AI layers yet/.test(document.getElementById('dLay').innerText), layN: document.getElementById('layN').textContent };
  });
  ck('слой скрывается и показывается, переименовывается через prompt, удаляется', lay.before > 0 && lay.hidden === 0 && lay.off === 1 && lay.shown === lay.before && lay.name === 'Renamed layer' && lay.left === 0 && lay.empty && lay.layN === '', JSON.stringify(lay));

  /* 8. Geo AI: восемь тестов брифа (EN) */
  await pg.click('#btnAI'); await wait(150);
  const ask = q => pg.evaluate(async q => { const r = await AI.ask(q); return { intent: r.plan.intent, args: r.plan.args, answer: (r.parts.answer || '').replace(/<[^>]+>/g, ''), analysis: r.parts.analysis || '', limits: r.parts.limits || '', coverage: r.parts.coverage || '', actions: (r.parts.actions || '').replace(/<[^>]+>/g, ' '), state: JSON.parse(JSON.stringify(Filters.state())), count: +document.getElementById('fCount').textContent, chipsOn: [...document.querySelectorAll('#fClass .chip.on')].map(c => c.getAttribute('data-v')), layers: Layers.list().map(l => ({ name: l.name, n: l.ids.length, kind: l.kind, districts: l.districts })), msgs: document.querySelectorAll('#aiLog .msg.a').length, cmp: Compare.ids().length, loc: !document.getElementById('dLoc').classList.contains('hidden'), h5: [...document.querySelectorAll('#aiLog .msg.a:last-child h5')].map(h => h.textContent) }; }, q);
  const expA = await pg.evaluate(() => Data.all().filter(r => ['A', 'A+'].includes(r.class)).length);
  const t1 = await ask('Show Class A and A+ business centers');
  ck('AI 1: класс A и A+ -> фильтр применён, панель фильтров отражает, слой создан, разделы ответа', t1.intent === 'filter' && t1.state.classes.join() === 'A,A+' && t1.chipsOn.length === 2 && t1.count === expA && t1.layers.length === 1 && t1.h5.includes('Answer') && t1.h5.includes('Data coverage') && t1.h5.includes('Sources') && /Filters applied/.test(t1.answer), JSON.stringify({ i: t1.intent, cls: t1.state.classes, count: t1.count, exp: expA, h5: t1.h5 }));
  const expA5 = await pg.evaluate(() => Data.all().filter(r => ['A', 'A+'].includes(r.class) && typeof r.gla === 'number' && r.gla >= 5000).length);
  const t2 = await ask('Only buildings above 5,000 m2');
  ck('AI 2: «только больше 5000 м2» сужает прошлый результат (класс сохранён, GLA >= 5000), слой заменён', t2.intent === 'filter' && t2.args.only === true && t2.state.classes.join() === 'A,A+' && t2.state.glaMin === 5000 && t2.count === expA5 && t2.count === 3 && t2.layers.length === 1 && /Narrowed/.test(t2.answer) && /unknown GLA is excluded/.test(t2.limits), JSON.stringify({ i: t2.intent, only: t2.args.only, st: [t2.state.classes, t2.state.glaMin], count: t2.count, exp: expA5, layers: t2.layers.length }));
  const t3 = await ask('Which district has the most known Class A GLA?');
  ck('AI 3: GLA по районам -> таблица, лидер Shaykhantakhur, знаменатель «N of M», район подсвечен слоем', t3.intent === 'glaByDistrict' && /Shaykhantakhur leads with 17,600/.test(t3.answer) && /2 of \d+ properties have GLA/.test(t3.answer) && /<table/.test(t3.analysis) && /<svg/.test(t3.analysis) && t3.layers.some(l => l.kind === 'district' && (l.districts || []).includes('Shaykhantakhur')) && /Insufficient verified data/.test(t3.analysis) && /DEMO/.test(t3.limits), JSON.stringify({ i: t3.intent, a: t3.answer.slice(0, 140), lim: t3.limits.slice(0, 80) }));
  const trId = await pg.evaluate(() => { const id = Data.all().find(r => r.name === 'Trilliant').id; App.select(id); return id; });
  const t4 = await ask('Show its competitors within 3 km');
  ck('AI 4: конкуренты выбранного объекта в 3 км -> вкладка «Локация», радиус, слой, таблица с причинами', t4.intent === 'competitors' && t4.args.id === trId && t4.args.km === 3 && t4.loc && /Trilliant/.test(t4.answer) && /within 3 km/.test(t4.answer) && /<table/.test(t4.analysis) && /1\/3\/5 km/.test(t4.analysis) && t4.layers.some(l => /Trilliant/.test(l.name) && l.n > 0) && /asking rents/.test(t4.limits), JSON.stringify({ i: t4.intent, id: t4.args.id === trId, km: t4.args.km, a: t4.answer.slice(0, 120) }));
  const t4n = await ask('Competitors of Nova Plaza within 2 km');
  ck('AI 4b: объект по имени (Nova Plaza, не Nova Minor), радиус 2 км', t4n.intent === 'competitors' && t4n.args.km === 2 && /Nova Plaza/.test(t4n.answer), t4n.answer.slice(0, 100));
  const t5 = await ask('Show properties with poor data quality');
  ck('AI 5: слабое качество данных -> слой с флагами low/unknown, счёт «N of M», ничего не придумано', t5.intent === 'quality' && t5.args.kind === 'confidence' && /\d+ of \d+ properties flagged: low or unknown confidence/.test(t5.answer) && t5.layers.some(l => /Data quality/.test(l.name) && l.n > 0) && /nothing was invented/.test(t5.answer), t5.answer.slice(0, 120));
  const expStale = await pg.evaluate(() => App.visible().filter(r => daysSince(Quality.lastVerified(r)) > 180).length);
  const t6 = await ask('Which buildings need data verification?');
  ck('AI 6: «нужна проверка» -> устаревшие записи (старше 6 мес.), таблица с датами', t6.intent === 'quality' && t6.args.kind === 'stale' && new RegExp('^' + expStale + ' of \\d+ properties flagged').test(t6.answer) && expStale > 0 && /Last verified/.test(t6.analysis), JSON.stringify({ i: t6.intent, exp: expStale, a: t6.answer.slice(0, 100) }));
  const t7 = await ask('Compare the three largest properties on the map');
  ck('AI 7 (в текущей выборке класса A только 2 с GLA): честно сравнивает 2 и сообщает нехватку', t7.intent === 'compare' && t7.args.largest === 3 && t7.cmp === 2 && /2 of \d+ visible properties have GLA/.test(t7.analysis) && /Insufficient verified data/.test(t7.limits), JSON.stringify({ cmp: t7.cmp, an: t7.analysis.slice(0, 100), lim: t7.limits.slice(0, 80) }));
  const t8 = await ask('Remove this analysis and return to all business centers');
  const after8 = await pg.evaluate(() => { let c = 0; MapM.map().eachLayer(l => { if (l instanceof L.Circle) c++; }); return { circles: c, desc: Filters.describe(), demo: Filters.state().demo }; });
  ck('AI 8: «убрать анализ» -> слои, радиусы и фильтры очищены, 154 объекта, DEMO-переключатель сохранён', t8.intent === 'clear' && t8.layers.length === 0 && t8.count === 154 && after8.circles === 0 && after8.desc === '' && after8.demo === true && /cleared/.test(t8.answer), JSON.stringify({ i: t8.intent, layers: t8.layers.length, count: t8.count, after8 }));
  const t7b = await ask('Compare the three largest properties on the map');
  ck('AI 7b: на полной карте сравниваются 3 крупнейших по известной GLA (6 из 154 с GLA)', t7b.intent === 'compare' && t7b.cmp === 3 && /6 of 154 visible properties have GLA/.test(t7b.analysis) && /No winner/.test(t7b.limits), JSON.stringify({ cmp: t7b.cmp, an: t7b.analysis.slice(0, 100) }));
  const t9 = await ask('What is the density of employees around Trilliant?');
  ck('AI: недоступные данные (плотность сотрудников) -> честный отказ без оценки', t9.intent === 'unavailable' && /does not contain employee density/.test(t9.answer) && /No estimate/.test(t9.answer), t9.answer.slice(0, 120));
  const t10 = await ask('Office supply by district');
  ck('AI: предложение по районам -> гистограмма и таблица, слой районов', t10.intent === 'supplyByDistrict' && /<svg/.test(t10.analysis) && /Mirabad/.test(t10.analysis) && t10.layers.some(l => l.kind === 'district' && l.districts.length >= 8), JSON.stringify({ i: t10.intent, l: t10.layers.length }));
  const t11 = await ask('Average rent by district for Class A');
  ck('AI: средняя ставка по районам класса A -> только известные ставки, «known / all»', t11.intent === 'rentByDistrict' && /known \/ all/.test(t11.analysis) && /Only properties with known rent/.test(t11.answer) && /scope: Office class A/.test(t11.answer), t11.answer.slice(0, 140));
  const t12 = await ask('Buildings with rent below $25 in Yakkasaray');
  const exp12 = await pg.evaluate(() => Data.all().filter(r => r.district === 'Yakkasaray' && typeof r.rent === 'number' && r.rent <= 25).length);
  ck('AI: ставка ниже $25 в Яккасарае -> фильтр района и ставки', t12.intent === 'filter' && t12.state.rentMax === 25 && t12.state.districts.join() === 'Yakkasaray' && t12.count === exp12 && exp12 > 0, JSON.stringify({ st: [t12.state.rentMax, t12.state.districts], c: t12.count, e: exp12 }));
  const t13 = await ask('Open Trilliant');
  ck('AI: «открой Trilliant» -> выбор и приближение', t13.intent === 'select' && /Selected Trilliant/.test(t13.answer), t13.answer);
  const t14 = await ask('Tell me a joke');
  ck('AI: непонятный запрос -> подсказка с примерами', t14.intent === 'unknown' && /could not map/.test(t14.answer));
  const sess = await pg.evaluate(() => ({ log: JSON.parse(localStorage.getItem('geo_mvp_ai_session') || '[]').length, hist: AI.session().history.length }));
  ck('сеанс ИИ ведёт журнал (localStorage) и историю', sess.log >= 14 && sess.hist >= 28, JSON.stringify(sess));
  await pg.evaluate(async () => { await AI.ask('clear'); });
  const lay2 = await pg.evaluate(async () => { const S = ms => new Promise(r => setTimeout(r, ms)); App.select(Data.all().find(r => r.name === 'Trilliant').id); await S(300); const d = document.getElementById('drawer').getBoundingClientRect(), a = document.getElementById('aiPanel').getBoundingClientRect(), ad = document.getElementById('adminPanel'), adR = ad.getBoundingClientRect(); return { drawerRight: d.right, aiLeft: a.left, drawerW: d.width, adminHidden: getComputedStyle(ad).visibility === 'hidden' || adR.right <= 0, adminOpen: ad.classList.contains('open') }; });
  ck('карточка объекта и панель ИИ видны одновременно (карточка сдвинута левее ИИ), редактор данных скрыт целиком', Math.abs(lay2.drawerRight - lay2.aiLeft) <= 1 && lay2.drawerW >= 380 && lay2.adminHidden && !lay2.adminOpen, JSON.stringify(lay2));
  await pg.screenshot({ path: path.join(SHOTS || path.dirname(FILE), 'geo_mvp_desktop.png') });

  /* 9. RU-интерфейс и русские запросы */
  await pg.selectOption('#langSel', 'ru'); await wait(300);
  const ru = await pg.evaluate(() => ({ lang: document.documentElement.lang, found: document.querySelector('[data-i=found]').textContent, tabs: [...document.querySelectorAll('.dtabs button')].map(b => b.textContent.trim()), legend: document.getElementById('mlegend').innerText, prompts: document.querySelectorAll('#aiPrompts button').length, firstPrompt: document.querySelector('#aiPrompts button').textContent, chips: document.querySelector('#fDistrict .chip').textContent, sub: document.getElementById('hdrSub').textContent }));
  ck('переключение на RU: подписи, вкладки, легенда, подсказки ИИ, названия районов', ru.lang === 'ru' && ru.found === 'объектов найдено' && ru.tabs[0] === 'Объект' && /Неизвестно/.test(ru.legend) && ru.prompts === 8 && /класса/.test(ru.firstPrompt) && /ский$/.test(ru.chips) && /Ташкент/.test(ru.sub), JSON.stringify(ru));
  const r1 = await ask('Покажи офисы класса A и A+ в Мирабадском районе');
  const r2 = await ask('Только здания больше 5000 м2');
  const r3 = await ask('В каком районе больше всего известной GLA класса A?');
  const r4 = await ask('Какие здания нужно проверить?');
  const r5 = await ask('Убери анализ и покажи все бизнес-центры');
  ck('RU-запросы: класс+район, сужение, GLA по районам, проверка, очистка', r1.intent === 'filter' && r1.state.classes.join() === 'A,A+' && r1.state.districts.join() === 'Mirabad' && /Применены фильтры/.test(r1.answer) && r2.intent === 'filter' && r2.args.only === true && r2.state.glaMin === 5000 && r2.state.districts.join() === 'Mirabad' && r3.intent === 'glaByDistrict' && /Шайхантахурский/.test(r3.answer) && r4.intent === 'quality' && r4.args.kind === 'stale' && r5.intent === 'clear' && r5.count === 154 && /очищены/.test(r5.answer), JSON.stringify({ r1: [r1.intent, r1.state.classes, r1.state.districts], r2: [r2.intent, r2.args.only, r2.state.glaMin], r3: [r3.intent, r3.answer.slice(0, 80)], r4: [r4.intent, r4.args.kind], r5: [r5.intent, r5.count] }));
  await pg.selectOption('#langSel', 'en'); await wait(200);

  /* 10. Редактор данных: правка, добавление по координатам, удаление, экспорт/импорт, сохранение после перезагрузки, сброс */
  const ed = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms)); const id = Data.all().find(r => r.name === 'Trilliant').id;
    Admin.open(id); await S(100); const open = document.getElementById('adminPanel').classList.contains('open');
    document.getElementById('adGla').value = 12345; document.getElementById('adClass').value = 'A'; document.getElementById('ev_gla_source').value = 'Owner brochure'; document.getElementById('ev_gla_confidence').value = 'high'; document.getElementById('ev_gla_collected').value = '2026-09-10';
    document.getElementById('adSave').click(); await S(200);
    const r = Data.get(id); document.getElementById('btnAnalytics').click(); await S(100); const an = document.getElementById('anCards').innerText; document.getElementById('anaClose').click();
    const tip = MapM.map(); let pinA = 0; document.querySelectorAll('.pin span').forEach(s => { if (s.textContent === 'A') pinA++; });
    return { open, gla: r.gla, cls: r.class, ev: r.evidence.gla && r.evidence.gla.source + '/' + r.evidence.gla.confidence, local: Data.isLocal(), an: /Based on 7 of 154 properties with known GLA/.test(an), card: document.querySelector('#dProp .ptitle').textContent, cardGla: /12,345/.test(document.getElementById('dProp').innerText), toast: document.getElementById('toast').textContent };
  });
  ck('правка Trilliant (GLA, класс, источник поля) сохраняется локально и сразу видна в карточке и аналитике (7 из 154 с GLA)', ed.open && ed.gla === 12345 && ed.cls === 'A' && ed.ev === 'Owner brochure/high' && ed.local && ed.an && ed.card === 'Trilliant' && ed.cardGla && /Saved locally/.test(ed.toast), JSON.stringify(ed));
  const add = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms)); Admin.open(null); await S(100);
    document.getElementById('adName').value = 'Test Tower'; document.getElementById('adLat').value = '41.3201'; document.getElementById('adLng').value = '69.2810'; document.getElementById('adDistrict').value = 'Yunusabad'; document.getElementById('adClass').value = 'B+'; document.getElementById('adRent').value = '21';
    document.getElementById('adSave').click(); await S(200);
    const r = Data.all().find(x => x.name === 'Test Tower'); const n = Data.all().length, count = document.getElementById('fCount').textContent, selected = document.querySelector('#dProp .ptitle').textContent;
    const missing = []; document.getElementById('adName').value = ''; document.getElementById('adSave').click(); await S(100); missing.push(document.getElementById('toast').textContent);
    return { id: r && r.id, demo: r && r.meta.demo, n, count, selected, district: r && r.district, marker: !!MapM.map(), missing: missing[0] };
  });
  ck('новый объект по координатам добавляется (155), помечен DEMO по умолчанию, выбран; без имени не сохраняется', add.id && add.demo === true && add.n === 155 && add.count === '155' && add.selected === 'Test Tower' && add.district === 'Yunusabad' && /required/.test(add.missing), JSON.stringify(add));
  const exp = await pg.evaluate(() => { const j = JSON.parse(Data.exportJson()); return { schema: j.schema, n: j.properties.length, hasEv: !!j.properties[0].evidence, hasTest: j.properties.some(p => p.name === 'Test Tower') }; });
  ck('экспорт JSON: схема property/v1, 155 записей с provenance', exp.schema === 'geo-platform-mvp/property/v1' && exp.n === 155 && exp.hasEv && exp.hasTest, JSON.stringify(exp));
  await pg.reload({ waitUntil: 'load' }); await wait(700);
  const persisted = await pg.evaluate(() => ({ n: Data.all().length, gla: Data.all().find(r => r.name === 'Trilliant').gla, test: !!Data.all().find(r => r.name === 'Test Tower'), local: Data.isLocal() }));
  ck('после перезагрузки правки сохранены (localStorage): 155 записей, GLA Trilliant 12345', persisted.n === 155 && persisted.gla === 12345 && persisted.test && persisted.local, JSON.stringify(persisted));
  const del = await pg.evaluate(async () => { const S = ms => new Promise(r => setTimeout(r, ms)); const r = Data.all().find(x => x.name === 'Test Tower'); Admin.open(r.id); await S(100); document.getElementById('adDelete').click(); await S(150); return { n: Data.all().length, gone: !Data.all().find(x => x.name === 'Test Tower'), count: document.getElementById('fCount').textContent }; });
  ck('удаление записи (confirm принят) -> 154', del.n === 154 && del.gone && del.count === '154', JSON.stringify(del));
  const imp = await pg.evaluate(async () => { const S = ms => new Promise(r => setTimeout(r, ms)); const text = Data.exportJson(); const j = JSON.parse(text); j.properties = j.properties.slice(0, 20); const ok = Admin.importJson(JSON.stringify(j)); await S(150); const n = Data.all().length; const bad = Admin.importJson('{"x":1}'); const bad2 = Admin.importJson('[{"name":"no coords"}]'); return { ok, n, bad, bad2, count: document.getElementById('fCount').textContent }; });
  ck('импорт JSON (20 записей) заменяет набор; битый JSON и записи без координат отклоняются', imp.ok === true && imp.n === 20 && imp.count === '20' && imp.bad === false && imp.bad2 === false, JSON.stringify(imp));
  const rs = await pg.evaluate(async () => { const S = ms => new Promise(r => setTimeout(r, ms)); Admin.open(null); await S(50); document.getElementById('adReset').click(); await S(200); return { n: Data.all().length, local: Data.isLocal(), gla: Data.all().find(r => r.name === 'Trilliant').gla, count: document.getElementById('fCount').textContent }; });
  ck('сброс к базовому набору: 154, localStorage очищен, GLA Trilliant снова неизвестна', rs.n === 154 && !rs.local && rs.gla === null && rs.count === '154', JSON.stringify(rs));
  await pg.evaluate(() => document.getElementById('adClose').click());

  /* 11. Мобильная вёрстка */
  await pg.setViewportSize({ width: 390, height: 844 }); await wait(500);
  const mob = await pg.evaluate(async () => {
    const S = ms => new Promise(r => setTimeout(r, ms)); const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= window.innerWidth + 1; };
    const bar = document.getElementById('mobBar'), barVis = getComputedStyle(bar).display !== 'none';
    document.querySelector('#mobBar [data-m=filters]').click(); await S(250); const left = document.getElementById('left'), leftVis = vis(left) && left.getBoundingClientRect().width < window.innerWidth;
    document.querySelector('#mobBar [data-m=ai]').click(); await S(250); const ai = document.getElementById('aiPanel').getBoundingClientRect(), aiSheet = ai.width >= window.innerWidth - 2 && ai.top > 50;
    document.querySelector('#mobBar [data-m=list]').click(); await S(250); const listVis = vis(document.getElementById('listPanel'));
    document.querySelector('#mobBar [data-m=map]').click(); await S(250); App.select(Data.all().find(r => r.name === 'Trilliant').id); await S(250); const dr = document.getElementById('drawer').getBoundingClientRect(), drSheet = dr.width >= window.innerWidth - 2 && dr.top > 50;
    return { sw: document.documentElement.scrollWidth, iw: window.innerWidth, barVis, leftVis, aiSheet, listVis, drSheet, mapH: document.getElementById('map').getBoundingClientRect().height, searchW: document.getElementById('gSearch').getBoundingClientRect().width, aiClosed: !document.getElementById('aiPanel').classList.contains('open') };
  });
  ck('телефон 390px: без горизонтальной прокрутки, нижняя панель, фильтры/ИИ/список/карточка как выдвижные панели, поиск в шапке не сжат', mob.sw <= mob.iw && mob.barVis && mob.leftVis && mob.aiSheet && mob.listVis && mob.drSheet && mob.mapH > 300 && mob.searchW >= 140 && mob.aiClosed, JSON.stringify(mob));
  await pg.screenshot({ path: path.join(SHOTS || path.dirname(FILE), 'geo_mvp_mobile.png') });
  const dash = await pg.evaluate(() => new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']').test(document.body.innerText + document.getElementById('aiLog').innerText));
  ck('в интерфейсе нет длинных тире', !dash);
  ck('ошибок страницы нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  await b.close();
  console.log(bad ? 'ПРОВАЛЕНО: ' + bad : 'Geo Platform MVP: все сценарии работают');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(2); });
