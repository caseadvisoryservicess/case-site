/* v4.75.0: режим «только геоаналитика» в браузере.

   Решение владельца: на хостинге остаётся только геоаналитика, остальные отделы отключаются,
   данные в базе сохраняются. Режим приходит с сервера (auth.php -> mode). Что проверяется:

     1. Режим geo (администратор): меню состоит из «Геоаналитика» (рынок и POI,
        наши проекты) и «Администрирование»; главный экран = студия; шапка без переключателя
        объектов, поиска, чата и квиза; подпись бренда «Geo Analytics Platform».
     2. Переход в чужой раздел (go('registry')) уводит в геоаналитику; Geo Platform открывается
        в iframe geo-platform.html и переживает перезагрузку страницы.
     3. Страницы «Модули» и «Доступ» показывают только оставшиеся разделы и объясняют, что
        остальное отключено на сервере.
     4. Режим full: меню прежнее (много групп), пункта Geo Platform нет, реестр открывается, после «Гео: рынок
        и POI», реестр открывается.
     5. Ошибок сценария нет ни в одном режиме.

   Запуск: NODE_PATH=... node v4740_geo_only.js [папка os] */
'use strict';
const path = require('path');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base, state } = await createMockServer(OS, { initialState: {} });
  state.mode = 'geo';
  state.user = { id: 'u-ash', name: 'Aziz Sharipov', role: 'ASH', role_key: 'ASH', role_label: 'Генеральный директор', admin: true, edit: true, leasing: true, finance: true, csrf: 't0k3n' };
  state.rights = { leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, admin: 1, own_only: 0, project_scope: 0 };
  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const open = async (viewport) => {
    const ctx = await b.newContext({ viewport: viewport || { width: 1440, height: 900 } });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
    await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
    await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => typeof go === 'function' && document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof S === 'object' && S.view, null, { timeout: 30000 });
    await wait(1200);
    return { pg, errs, ctx };
  };

  console.log('--- 1. Режим geo: меню, главный экран, шапка');
  let { pg, errs } = await open();
  const s1 = await pg.evaluate(() => ({
    mode: window.CASE_PLATFORM_MODE, geoOnly: document.body.classList.contains('case-geo-only'), view: S.view,
    links: [...document.querySelectorAll('#nav a[data-v]')].map(a => a.dataset.v), groups: [...document.querySelectorAll('#nav .nav-group-btn>span:first-child')].map(x => x.textContent),
    frame: !!document.getElementById('geoFrame'), objSel: getComputedStyle(document.getElementById('objSel')).display, search: getComputedStyle(document.querySelector('.gsearch')).display,
    chat: (() => { const f = document.getElementById('chatFab'); return !f || getComputedStyle(f).display === 'none'; })(), brand: document.querySelector('.brand .tag').textContent, title: document.title,
    ver: document.getElementById('appVer').textContent
  }));
  ck('режим geo пришёл с сервера, тело помечено, главный экран = студия геоаналитики', s1.mode === 'geo' && s1.geoOnly && s1.view === 'geoanalytics' && s1.frame, JSON.stringify({ mode: s1.mode, view: s1.view, frame: s1.frame }));
  ck('меню: только гео и администрирование; экрана Geo Platform нет (v4.76.0)', s1.links.join() === 'geoanalytics,map,users,admin_modules,admin_system' && s1.groups.length === 2 && /Геоаналитика/.test(s1.groups[0]) && /Администрирование/.test(s1.groups[1]), s1.links.join() + ' | ' + s1.groups.join(' / '));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'geo_only_studio.png') });
  ck('шапка без переключателя объектов, поиска и чата; подпись бренда и заголовок про геоаналитику', s1.objSel === 'none' && s1.search === 'none' && s1.chat && /Geo Analytics Platform/.test(s1.brand) && /Геоаналитика/.test(s1.title) && /v4\.77\.0/.test(s1.ver), JSON.stringify({ obj: s1.objSel, search: s1.search, chat: s1.chat, brand: s1.brand, title: s1.title, ver: s1.ver }));

  console.log('--- 2. Чужой раздел, прежний экран Geo Platform, перезагрузка');
  const s2 = await pg.evaluate(async () => { go('registry'); await new Promise(r => setTimeout(r, 300)); const afterReg = S.view; go('dash'); await new Promise(r => setTimeout(r, 300)); const afterDash = S.view; go('geo_platform'); await new Promise(r => setTimeout(r, 400)); return { afterReg, afterDash, view: S.view, frame: !!document.getElementById('geoPlatformFrame'), studio: !!document.getElementById('geoFrame'), active: [...document.querySelectorAll('#nav a.active')].map(a => a.dataset.v) }; });
  ck('реестр, главный экран и прежний экран Geo Platform уводят в студию геоаналитики', s2.afterReg === 'geoanalytics' && s2.afterDash === 'geoanalytics' && s2.view === 'geoanalytics' && !s2.frame && s2.studio && s2.active.join() === 'geoanalytics', JSON.stringify(s2));
  const noFile = await pg.evaluate(async () => { const r = await fetch('geo-platform.html'); return r.status; });
  ck('файла geo-platform.html в платформе больше нет (404)', noFile === 404, String(noFile));
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => typeof S === 'object' && S.view && document.getElementById('app') && !document.getElementById('app').classList.contains('hidden'), null, { timeout: 30000 });
  /* iframe студии строится после boot; ждём его, а не фиксированную паузу (плавало на медленной машине) */
  await pg.waitForFunction(() => !!document.getElementById('geoFrame'), null, { timeout: 15000 }).catch(() => {});
  const s3 = await pg.evaluate(() => ({ view: S.view, frame: !!document.getElementById('geoFrame') }));
  ck('после перезагрузки открыта студия', s3.view === 'geoanalytics' && s3.frame, JSON.stringify(s3));

  console.log('--- 3. Страницы администрирования');
  const s4 = await pg.evaluate(async () => { go('admin_modules'); await new Promise(r => setTimeout(r, 900)); const rows = [...document.querySelectorAll('.ff-row[data-v]')]; const vis = rows.filter(r => !r.classList.contains('geo-only-off')).map(r => r.dataset.v); const hidden = rows.filter(r => r.classList.contains('geo-only-off')).length; const banner = document.getElementById('geoOnlyBanner'); return { total: rows.length, vis, hidden, banner: banner ? banner.textContent : '' }; });
  ck('«Модули»: скрыты чужие разделы, видны только гео и администрирование, баннер объясняет режим', s4.total > 40 && s4.hidden > 30 && s4.vis.every(v => ['geoanalytics', 'map', 'analytics_hub', 'users', 'admin_modules', 'admin_system', 'dash', 'geo_platform'].includes(v)) && s4.vis.includes('geoanalytics') && /только геоаналитика/.test(s4.banner) && /mode\.php/.test(s4.banner), JSON.stringify({ total: s4.total, vis: s4.vis, hidden: s4.hidden }));
  const s5 = await pg.evaluate(async () => { go('users'); await new Promise(r => setTimeout(r, 1200)); const id = b => ((b.getAttribute('onclick') || '').match(/wsToggle(?:Role|User)View\([^,]+,'([^']+)'\)/) || [])[1] || ''; const mods = [...document.querySelectorAll('#wsAdminCard .ws-module')].filter(id); const shown = mods.filter(m => !m.classList.contains('geo-only-off')).map(id); const stray = shown.filter(v => !['geoanalytics', 'map', 'analytics_hub', 'users', 'admin_modules', 'admin_system'].includes(v)); return { card: !!document.getElementById('wsAdminCard'), mods: mods.length, shown, stray, banner: !!document.getElementById('geoOnlyBanner') }; });
  ck('«Доступ»: матрица рабочих областей показывает только гео и админ-разделы', s5.card && s5.mods > 40 && s5.shown.length >= 6 && s5.stray.length === 0 && s5.shown.includes('geoanalytics') && s5.banner, JSON.stringify({ mods: s5.mods, shown: s5.shown, stray: s5.stray }));
  ck('ошибок сценария в режиме geo нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  await pg.context().close();

  console.log('--- 4. Телефон в режиме geo');
  ({ pg, errs } = await open({ width: 390, height: 844 }));
  const s6 = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, links: document.querySelectorAll('#nav a[data-v]').length, frame: !!document.getElementById('geoFrame') }));
  ck('телефон: без горизонтальной прокрутки, меню гео построено, студия открыта', s6.sw <= s6.iw && s6.links === 5 && s6.frame, JSON.stringify(s6));
  await pg.context().close();

  console.log('--- 5. Режим full: ничего не потеряно');
  state.mode = 'full';
  ({ pg, errs } = await open());
  const s7 = await pg.evaluate(async () => { const links = [...document.querySelectorAll('#nav a[data-v]')].map(a => a.dataset.v); go('registry'); await new Promise(r => setTimeout(r, 400)); return { mode: window.CASE_PLATFORM_MODE, geoOnly: document.body.classList.contains('case-geo-only'), groups: document.querySelectorAll('#nav .nav-group-btn').length, links: links.length, noPlatform: links.indexOf('geo_platform') < 0, view: S.view, brand: document.querySelector('.brand .tag').textContent }; });
  ck('full: тело без пометки, групп меню много, пункта Geo Platform нет, реестр открывается, подпись бренда прежняя', s7.mode === 'full' && !s7.geoOnly && s7.groups >= 5 && s7.links > 20 && s7.noPlatform && s7.view === 'registry' && !/Geo Analytics Platform/.test(s7.brand), JSON.stringify(s7));
  ck('ошибок сценария в режиме full нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  await pg.context().close();

  await b.close(); srv.close();
  console.log(bad ? '\nПРОВАЛЕНО: ' + bad : '\nРежим «только геоаналитика» работает, полный режим не пострадал');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(2); });
