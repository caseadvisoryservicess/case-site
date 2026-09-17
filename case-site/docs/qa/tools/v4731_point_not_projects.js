/* v4.73.1: в студии геоаналитики нет проектов CASE, есть точка анализа.

   Владелец: «take out CASE Projects» - студией пользуются клиенты, и список наших проектов
   над картой, секция «Проект», точки портфеля и вкладки про проект им не нужны. Вместо этого
   одна точка анализа, которую задаёт гео-агент (клик, координаты, адрес); по ней считаются
   отчёт, выгрузка, солнце и Хафф. Что проверяется:

     1. Родительское окно CASE OS: над студией нет списка проектов, есть подсказка и кнопки
        истории и обновления; в контекст студии проекты не передаются.
     2. Студия: даже если старый родитель прислал проекты, в PROJECTS только точка анализа;
        список #proj скрыт и содержит одну запись; галочки и слоя портфеля нет; вкладки
        «Профиль проекта», «Генплан / нормы», «Объекты на карте» скрыты; в легенде нет блока
        «Проекты портфеля»; незаданная точка на карте не рисуется.
     3. Сохранённые гео-профили проектов из geoData не теряются при сохранении, а точка
        анализа в них не попадает.
     4. «Аналитика по точке» без точки честно просит её поставить, а не считает центр города.
     5. Гео-агент ставит точку: студия показывает координаты и район, рисует одну метку
        (агент свою не дублирует), «Аналитика по точке» открывает отчёт именно там, имя
        точки уходит в выгрузку.

   Запуск: NODE_PATH=... node v4731_point_not_projects.js [папка os] */
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
  state.geo.data = { version: 2, projects: [{ id: 'zm', name: 'Zarafshon Mall', lat: 41.58165, lng: 64.21636, files: [] }], datasets: {}, meta: {} };
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
                                    args: ['--no-sandbox', '--no-proxy-server'] });

  console.log('--- 1. Родительское окно CASE OS');
  const pg = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message.slice(0, 160)));
  await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof go === 'function' && typeof geoV42Tab === 'function', null, { timeout: 30000 });
  await pg.waitForTimeout(1500);
  await pg.evaluate(() => { go('geoanalytics'); });
  await pg.waitForTimeout(800);
  await pg.evaluate(() => { geoV42Tab('market'); });
  await pg.waitForSelector('#geoFrame', { timeout: 20000 });
  const top = await pg.evaluate(() => ({ sel: !!document.getElementById('geoProject'), title: (document.querySelector('.geo-v42-title') || {}).textContent || '',
    hist: !!document.querySelector('.geo-v42-hist'), reload: !!document.querySelector('.geo-v42-reload'), recover: !!document.getElementById('geoRecoverBtn') }));
  ck('над студией нет списка проектов', !top.sel);
  ck('строки-подсказки над студией нет (v4.76.0), кнопки истории и обновления на месте', top.title.trim() === '' && top.hist && top.reload && top.recover, top.title);
  const fr = pg.frames().find(f => /geoanalytics-studio/.test(f.url()));
  ck('студия открылась во фрейме', !!fr);
  let inFrame = null;
  if (fr) {
    await fr.waitForFunction(() => window.CASE_GEO_AGENT && typeof window.caseGeoPoint === 'function' && typeof PROJECTS === 'object', null, { timeout: 30000 });
    await fr.waitForTimeout(2500);
    inFrame = await fr.evaluate(() => ({ keys: Object.keys(PROJECTS), opts: [...document.querySelectorAll('#proj option')].map(o => o.textContent), pending: window.caseGeoPoint().pending,
      savedProjects: window.caseGeoCollectState().projects.map(p => p.id) }));
    ck('в контекст из CASE OS проекты не передаются: в студии только точка анализа', inFrame.keys.length === 1 && inFrame.keys[0] === 'project' && inFrame.opts.length === 1, JSON.stringify(inFrame));
    ck('сохранённые гео-профили проектов из базы не потеряны и точка в них не попала', inFrame.savedProjects.join(',') === 'zm', inFrame.savedProjects.join(','));
  }
  ck('ошибок страницы CASE OS нет', errs.length === 0, errs[0] || 'нет');
  await pg.close();

  console.log('\n--- 2. Студия отдельно: старый родитель присылает проекты');
  const sp = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs2 = [];
  sp.on('pageerror', e => errs2.push(e.message.slice(0, 160)));
  const dialogs = [];
  sp.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  await sp.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await sp.route('**/api/gis_proxy.php**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows: [] }) }));
  await sp.goto(base + '/geoanalytics-studio.html?embedded=1', { waitUntil: 'domcontentloaded' });
  await sp.waitForFunction(() => window.CASE_GEO_AGENT && typeof window.caseGeoSetPoint === 'function' && document.getElementById('gaPanel'), null, { timeout: 30000 });
  await sp.waitForTimeout(1500);
  const s2 = await sp.evaluate(async () => {
    window.postMessage({ source: 'asaas-os-v4', type: 'asaas-geo-context', context: { lang: 'ru', editable: true, adminEdit: true, external: false, user: { name: 'QA' },
      projects: [{ id: 'zm', name: 'Zarafshon Mall', lat: 41.58165, lng: 64.21636 }, { id: 'p2', name: 'Проект Б', lat: 41.31, lng: 69.28 }], activeProjectId: 'zm', probeProjectId: '',
      geoData: { version: 2, projects: [{ id: 'zm', name: 'Zarafshon Mall', lat: 41.58165, lng: 64.21636, files: [] }], datasets: {}, meta: {} }, geoRevision: 3 } }, location.origin);
    await new Promise(r => setTimeout(r, 1200));
    const sel = document.getElementById('proj'), cs = getComputedStyle;
    const tabs = {}; document.querySelectorAll('.tabs button').forEach(bt => { tabs[bt.dataset.t] = cs(bt).display !== 'none'; });
    return { keys: Object.keys(PROJECTS), opts: [...sel.options].map(o => o.textContent), selHidden: cs(sel).display === 'none', lProj: !!document.getElementById('lProj'),
      tabs, legend: (document.getElementById('mlgd') || {}).innerText || '', info: document.getElementById('projInfo').innerText.replace(/\s+/g, ' '),
      drawn: gProj.getLayers().length, saved: window.caseGeoCollectState().projects.map(p => p.id + ':' + p.name), point: window.caseGeoPoint(),
      heading: document.getElementById('projH').textContent.trim(), pick: !!document.getElementById('btnPickPoint'),
      btnReport: (document.getElementById('btnProjReport') || {}).textContent || '' };
  });
  ck('присланные проекты отброшены: в студии одна точка анализа', s2.keys.length === 1 && s2.keys[0] === 'project' && s2.opts.length === 1 && s2.opts[0] === 'Точка анализа', JSON.stringify({ keys: s2.keys, opts: s2.opts }));
  ck('список проектов скрыт, галочки портфеля нет, секция называется «Точка анализа», кнопки «Точка на карте» нет (v4.76.0)', s2.selHidden && !s2.lProj && s2.heading === 'Точка анализа' && !s2.pick && /по точке/.test(s2.btnReport), s2.heading + ' / ' + s2.btnReport);
  ck('вкладки про проект скрыты, карта, аналитика и данные видны', s2.tabs.siteT === false && s2.tabs.planT === false && s2.tabs.objT === false && s2.tabs.mapT && s2.tabs.anaT && s2.tabs.dataT, JSON.stringify(s2.tabs));
  ck('в легенде нет проектов портфеля', !/Проекты портфеля|Проект портфеля/.test(s2.legend));
  ck('незаданная точка не нарисована на карте и названа незаданной', s2.drawn === 0 && /не задана/.test(s2.info) && s2.point.pending === true, s2.info + ' / меток ' + s2.drawn);
  ck('гео-профиль из geoData сохранится нетронутым, точка анализа в него не попадёт', s2.saved.join(',') === 'zm:Zarafshon Mall', s2.saved.join(','));

  console.log('\n--- 3. Аналитика по точке без точки');
  await sp.click('#btnProjReport');
  await sp.waitForTimeout(600);
  const noPoint = await sp.evaluate(() => ({ open: document.getElementById('probe').classList.contains('open'), probe: typeof LASTPROBE === 'object' && LASTPROBE ? LASTPROBE.la : null }));
  ck('без точки отчёт не считается, а просят поставить точку', dialogs.length === 1 && /укажите точку/i.test(dialogs[0]) && !noPoint.open, dialogs[0] || 'диалога не было');

  console.log('\n--- 4. Гео-агент ставит точку');
  const after = await sp.evaluate(async () => {
    const A = window.CASE_GEO_AGENT;
    await A.ask('41.3111, 69.2797');
    await new Promise(r => setTimeout(r, 500));
    const pt = window.caseGeoPoint();
    const tips = gProj.getLayers().map(l => (l.getTooltip && l.getTooltip()) ? String(l.getTooltip().getContent()) : '');
    return { pt, site: A.state.site, info: document.getElementById('projInfo').innerText.replace(/\s+/g, ' '), drawn: gProj.getLayers().length, tips,
      agentMarkers: A.state.groups.site ? A.state.groups.site.getLayers().length : 0, opt: document.querySelector('#proj option').textContent,
      lastFact: A.state.log.filter(m => m.who === 'fact').slice(-1).map(m => m.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())[0] || '' };
  });
  ck('точка агента стала точкой анализа студии', after.pt && !after.pt.pending && near(after.pt.lat, 41.3111, 1e-6) && near(after.pt.lng, 69.2797, 1e-6), JSON.stringify(after.pt));
  /* innerText отдаёт текст уже в верхнем регистре (CSS text-transform), поэтому регистр не важен */
  ck('студия показывает координаты и район точки', /41\.31110, 69\.27970/.test(after.info) && /район/i.test(after.info) && !/не определён/i.test(after.info) && after.pt.district, after.info);
  ck('одна метка на карте: звезда студии, агент свою не дублирует', after.drawn === 1 && after.tips.some(t => /★/.test(t)) && after.agentMarkers === 0, 'меток студии ' + after.drawn + ', агента ' + after.agentMarkers);
  ck('район попал в факт агента и в имя точки для выгрузки', after.lastFact.indexOf(after.pt.district) >= 0 && after.opt === after.site.name, after.lastFact + ' / ' + after.opt);
  await sp.click('#btnProjReport');
  await sp.waitForFunction(() => document.getElementById('probe').classList.contains('open'), null, { timeout: 20000 });
  await sp.waitForTimeout(800);
  const rep = await sp.evaluate(() => ({ la: LASTPROBE.la, ln: LASTPROBE.ln, project: LASTPROBE.project, pop: (document.getElementById('probe').innerText.match(/жител|населен/i) || [])[0] }));
  ck('«Аналитика по точке» считает отчёт именно в этой точке', near(rep.la, 41.3111, 1e-4) && near(rep.ln, 69.2797, 1e-4) && dialogs.length === 1, JSON.stringify(rep));
  ck('имя точки уходит в выгрузку вместо имени проекта', rep.project === after.site.name, rep.project);
  await sp.evaluate(() => closeProbe());

  /* адрес через геокодер: точка переезжает, имя точки - адрес */
  await sp.route('**/api/gis_proxy.php**', r => { const u = new URL(r.request().url()); if (u.searchParams.get('mode') === 'geocode') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, results: [{ name: 'улица Амира Темура, 15, Ташкент', lat: 41.3123, lon: 69.2801, type: 'house' }], cached: false, attribution: '© OpenStreetMap contributors' }) }); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows: [] }) }); });
  const addr = await sp.evaluate(async () => { await window.CASE_GEO_AGENT.ask('адрес: Амира Темура 15'); await new Promise(r => setTimeout(r, 400)); return { pt: window.caseGeoPoint(), opt: document.querySelector('#proj option').textContent }; });
  ck('адрес переставляет точку анализа и даёт ей имя', near(addr.pt.lat, 41.3123, 1e-6) && /Амира Темура/.test(addr.pt.name) && /Амира Темура/.test(addr.opt), JSON.stringify(addr));

  console.log('\n--- 5. Итог');
  const dash = await sp.evaluate(() => { const D = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']'); return D.test(document.querySelector('.left').innerText) || D.test(document.getElementById('projInfo').innerHTML); });
  ck('в панели нет длинных тире', !dash);
  ck('ошибок страницы студии нет', errs2.length === 0, errs2[0] || 'нет');

  await b.close(); srv.close();
  console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nПроектов CASE в студии нет, точка анализа ведёт себя верно');
  process.exit(bad ? 1 : 0);
})();
