/* v4.78.0: платформа: цель доступа при регистрации, бесплатный клиент «Ищу офис», карточка
   «Мои данные», уровень доступа у администратора (мок-бэкенд).

   Что проверяется:
     1. Форма заявки: поле «Цель доступа» (4 варианта, по умолчанию «Ищу офис»); заявка с целью
        «ищу офис» открывает доступ сразу: сообщение «Доступ открыт», email подставлен в поле входа.
     2. Вход бесплатного клиента: права tier free / limited уходят в студию, студия в iframe
        показывает 40 БЦ и баннер «Бесплатный доступ», без вкладки данных, профиль «Ищу офис».
     3. Кабинет бесплатного клиента: «Доступ» с уровнем «бесплатный «Ищу офис»», карточка «Мои данные»
        со списком и счётчиками, «Скачать JSON» выгружает учётную запись и данные студии, «Очистить
        данные студии» удаляет ключи этого браузера (сервер не трогает).
     4. Администратор: в «Доступ, подписка и журнал» колонка «Уровень» с выбором для клиентов;
        перевод в полный уровень уходит в set_profile (settings.tier full); в заявках видна цель.
     5. Ошибок страницы нет, длинных тире в изменённых модулях нет.

   Запуск: NODE_PATH=... node v4780_platform.js [папка os] */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { createMockServer } = require('./mock_backend.js');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const DASH = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');

(async () => {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const { srv, base, state } = await createMockServer(OS, { initialState: {} });
  state.mode = 'geo'; state.offerVersion = '1.0';
  const ADMIN = { id: 'u-ash', name: 'Aziz Sharipov', role: 'ASH', role_key: 'ASH', role_label: 'Генеральный директор', admin: true, edit: true, leasing: true, finance: true, csrf: 't0k3n', type: 'admin', demo: false, days_left: null, expires_at: null, settings: { offer_accepted: { version: '1.0', at: '2026-09-18 09:00:00' } }, caps: { type: 'admin', demo: false, export: true, edit: true, days_left: null, expires_at: null, profile: '', offer_accepted: true, offer_version: '1.0', tier: 'full', limited: false } };
  const ADMIN_RIGHTS = { leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, admin: 1, own_only: 0, project_scope: 0 };
  const FREE = { id: 'u-free', name: 'Офис Искатель', email: 'office@seeker.uz', role: 'CL', role_key: 'CL', role_label: 'Клиент', admin: false, edit: false, csrf: 't0k3n', type: 'client', demo: false, days_left: null, expires_at: null, settings: { company: 'ИП Искатель', purpose: 'office', tier: 'free', profile: 'office', offer_accepted: { version: '1.0', at: '2026-09-18 10:00:00' } }, caps: { type: 'client', demo: false, export: false, edit: false, days_left: null, expires_at: null, profile: 'office', offer_accepted: true, offer_version: '1.0', tier: 'free', limited: true } };
  const CL_RIGHTS = { leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, admin: 0, own_only: 0, project_scope: 0 };
  state.users = [
    { id: 'u-ash', email: 'ceo@case.uz', name: 'Aziz Sharipov', title: 'CEO', role_key: 'ASH', active: 1, archived: 0, user_type: 'admin', expires_at: null, settings: {} },
    { id: 'u-free', email: 'office@seeker.uz', name: 'Офис Искатель', title: 'ИП', role_key: 'CL', active: 1, archived: 0, user_type: 'client', expires_at: null, settings: { tier: 'free', purpose: 'office', profile: 'office' } },
    { id: 'u-cl', email: 'client@firm.uz', name: 'Клиент Полный', title: 'Фирма', role_key: 'CL', active: 1, archived: 0, user_type: 'client', expires_at: '2026-12-31 23:59:59', settings: { tier: 'full', can_export: true } },
    { id: 'u-new', email: 'dev@firm.uz', name: 'Девелопер Заявитель', title: 'Новая фирма', role_key: 'CL', active: 0, archived: 0, user_type: 'client', expires_at: null, settings: { registration_pending: 1, company: 'Новая фирма', purpose: 'developer', registered_at: '2026-09-18 08:00:00' } }
  ];
  state.roles = [{ key: 'ASH', label: 'Генеральный директор', leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, own_only: 0, project_scope: 0, admin: 1 }, { key: 'CL', label: 'Клиент', leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, own_only: 0, project_scope: 0, admin: 0 }];
  state.myLog = [{ id: 1, action: 'Вход в систему', detail: 'роль: CL', at: '2026-09-18 09:00:00' }];

  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  pg.on('dialog', async d => { await d.accept(); });
  await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await pg.route('**/api/gis_proxy.php**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows: [], provenance: { source: 'OpenStreetMap', conf: 'asking' }, truncated: false }) }));
  const loginAs = async (user, rights, email) => {
    state.user = user; state.rights = rights; state.sessionValid = false;
    await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => document.getElementById('l_go') && document.getElementById('login') && !document.getElementById('login').classList.contains('hidden') && window.caseCabinet, null, { timeout: 30000 });
    await wait(300);
    await pg.fill('#lemail', email); await pg.fill('#lpass', 'password1'); await pg.click('#l_go');
    await pg.waitForFunction(t => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof S === 'object' && S.user && S.user.type === t, user.type, { timeout: 30000 });
    await wait(800);
  };

  console.log('--- 1. Регистрация с целью «ищу офис»');
  state.sessionValid = false; state.user = ADMIN; state.rights = ADMIN_RIGHTS;
  await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.getElementById('l_regBtn') && window.caseCabinet && window.caseAccess, null, { timeout: 30000 });
  await wait(500);
  await pg.click('#l_regBtn'); await wait(200);
  const r1 = await pg.evaluate(() => ({ opts: [...document.querySelectorAll('#r_purpose option')].map(o => o.value), def: document.getElementById('r_purpose').value, txt: document.querySelector('#r_purpose option').textContent, ver: window.caseAccess ? window.CASE_MODULE_VERSIONS['v4760-access'] : '' }));
  ck('поле «Цель доступа»: office, developer, asset, other; по умолчанию «Ищу офис: бесплатный ограниченный доступ сразу»; модуль доступа 4.78.0', r1.opts.join() === 'office,developer,asset,other' && r1.def === 'office' && /бесплатный ограниченный доступ сразу/.test(r1.txt) && r1.ver === '4.78.0', JSON.stringify(r1));
  await pg.fill('#r_name', 'Офис Искатель'); await pg.fill('#r_company', 'ИП'); await pg.fill('#r_email', 'office@seeker.uz'); await pg.fill('#r_pass', 'seeker123'); await pg.check('#r_offer');
  await pg.click('#r_go'); await wait(600);
  const r2 = await pg.evaluate(() => ({ hint: document.getElementById('r_hint').textContent, email: document.getElementById('lemail').value, back: document.getElementById('r_back').textContent, dis: document.getElementById('r_purpose').disabled }));
  ck('заявка «ищу офис» ушла с purpose office, доступ открыт сразу, email подставлен, кнопка «Войти»', (state.registrations || []).length === 1 && state.registrations[0].purpose === 'office' && /Доступ открыт/.test(r2.hint) && r2.email === 'office@seeker.uz' && r2.back === 'Войти' && r2.dis, JSON.stringify(r2));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_register_office.png') });

  console.log('--- 2. Вход бесплатного клиента: студия ограничена');
  await loginAs(FREE, CL_RIGHTS, 'office@seeker.uz');
  const f1 = await pg.evaluate(() => ({ caps: window.CASE_USER_CAPS, view: S.view, gate: !!document.getElementById('offerGate') }));
  ck('права бесплатного клиента ушли в студию (tier free, limited), оферта уже принята, открыта студия', f1.caps && f1.caps.tier === 'free' && f1.caps.limited === true && f1.caps.export === false && f1.view === 'geoanalytics' && !f1.gate, JSON.stringify(f1));
  const f2 = await pg.evaluate(async () => { const f = document.getElementById('geoFrame'); for (let i = 0; i < 100; i++) { try { const w = f.contentWindow; if (w && w.CASE_GEO_CAPS && w.CASE_GEO_CAPS.caps && w.document.body.classList.contains('geo-limited') && w.document.getElementById('geoCapsBanner') && w.CASE_GEO_PROFILES && w.CASE_GEO_PROFILES.current) { return { n: w.eval('BC.length'), banner: w.document.getElementById('geoCapsBanner').textContent, prof: w.CASE_GEO_PROFILES.current, data: w.getComputedStyle(w.document.querySelector('.tabs button[data-t="dataT"]')).display }; } } catch (e) {} await new Promise(r => setTimeout(r, 300)); } return null; });
  ck('студия в iframe: 40 БЦ, баннер «Бесплатный доступ «Ищу офис»», профиль office, вкладка данных скрыта', !!f2 && f2.n === 40 && /Бесплатный доступ «Ищу офис»/.test(f2.banner) && f2.prof === 'office' && f2.data === 'none', JSON.stringify(f2));

  console.log('--- 3. Кабинет: уровень и «Мои данные»');
  await pg.evaluate(() => { try { localStorage.setItem('caseos_geo_profile', 'developer'); localStorage.setItem('caseos_geo_notes_v1', JSON.stringify([{ id: 1, text: 'заметка' }, { id: 2, text: 'ещё' }])); localStorage.setItem('caseos_mahalla_pop_v1', JSON.stringify({ 'MAH-1': 12000 })); } catch (e) {} });
  await pg.evaluate(() => go('profile'));
  await pg.waitForFunction(() => document.getElementById('cabData') && document.getElementById('cabDataList').textContent.length > 20 && !/Загрузка/.test(document.getElementById('cabLogList').textContent), null, { timeout: 15000 });
  const c1 = await pg.evaluate(() => { const rows = [...document.querySelectorAll('#cabDataList tr')].map(r => [r.children[0].textContent, r.children[1].textContent]); return { access: document.getElementById('cabAccess').textContent.replace(/\s+/g, ' '), rows, notes: (rows.find(r => /Заметки/.test(r[0])) || [])[1], pop: (rows.find(r => /Население махаллей/.test(r[0])) || [])[1], prof: (rows.find(r => /Профиль панелей/.test(r[0])) || [])[1], fb: (rows.find(r => /Обращения на сервере/.test(r[0])) || [])[1], log: (rows.find(r => /Действия в журнале/.test(r[0])) || [])[1], acc: (rows.find(r => /Учётная запись/.test(r[0])) || [])[1] }; });
  ck('карточка «Доступ»: уровень «бесплатный «Ищу офис»» с пояснением; «Мои данные»: заметки 2, население махаллей 1, профиль developer, обращения 0, действия 1, учётная запись', /бесплатный «Ищу офис»/.test(c1.access) && /40 бизнес-центров/.test(c1.access) && c1.notes === '2 зап.' && c1.pop === '1 зап.' && c1.prof === 'developer' && c1.fb === '0' && c1.log === '1' && /office@seeker\.uz/.test(c1.acc), JSON.stringify(c1));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_cabinet_data.png'), fullPage: true });
  const dl = pg.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await pg.click('#cabDataDl'); const dlf = await dl; let js = null; if (dlf) { try { js = JSON.parse(fs.readFileSync(await dlf.path(), 'utf8')); } catch (e) {} }
  ck('«Скачать JSON»: учётная запись (email, tier free, профиль office) и данные студии (заметки, население махаллей, профиль)', !!js && js.account && js.account.email === 'office@seeker.uz' && js.account.tier === 'free' && js.account.profile === 'office' && js.studio && js.studio.caseos_geo_notes_v1 && js.studio.caseos_geo_notes_v1.value.length === 2 && js.studio.caseos_mahalla_pop_v1 && js.studio.caseos_geo_profile.value === 'developer', js ? Object.keys(js.studio).join(',') : 'нет файла');
  await pg.click('#cabDataClear'); await wait(600);
  const c2 = await pg.evaluate(() => ({ prof: localStorage.getItem('caseos_geo_profile'), notes: localStorage.getItem('caseos_geo_notes_v1'), pop: localStorage.getItem('caseos_mahalla_pop_v1'), row: (([...document.querySelectorAll('#cabDataList tr')].find(r => /Заметки/.test(r.children[0].textContent)) || {}).children || [{}, {}])[1].textContent }));
  ck('«Очистить данные студии»: ключи удалены, карточка обновлена', c2.prof === null && c2.notes === null && c2.pop === null && c2.row === 'нет', JSON.stringify(c2));
  await pg.evaluate(() => logout()); await wait(400);

  console.log('--- 4. Администратор: уровень доступа и цель заявки');
  await loginAs(ADMIN, ADMIN_RIGHTS, 'ceo@case.uz');
  await pg.evaluate(() => go('users'));
  await pg.waitForFunction(() => document.getElementById('accessCards') && document.getElementById('trashBody') && !/Загрузка/.test(document.getElementById('trashBody').textContent), null, { timeout: 30000 });
  await wait(300);
  const u1 = await pg.evaluate(() => ({ head: [...document.querySelectorAll('#accessCard thead th')].map(t => t.textContent), free: (document.querySelector('#accessCard tr[data-uid="u-free"] .ac-tier') || {}).value, full: (document.querySelector('#accessCard tr[data-uid="u-cl"] .ac-tier') || {}).value, adminTier: !!document.querySelector('#accessCard tr[data-uid="u-ash"] .ac-tier'), pending: (document.querySelector('#regCard tbody tr') || {}).textContent }));
  ck('колонка «Уровень»: бесплатный у искателя, полный у клиента, у администратора нет; в заявке видна цель «девелопер»', u1.head.findIndex(h => /^Уровень/.test(h)) === 2 && u1.free === 'free' && u1.full === 'full' && !u1.adminTier && /цель: девелопер/.test(u1.pending || ''), JSON.stringify(u1));
  await pg.selectOption('#accessCard tr[data-uid="u-free"] .ac-tier', 'full');
  await pg.click('#accessCard tr[data-uid="u-free"] .ac-save'); await wait(800);
  const sp = (state.userPosts || []).find(p => p.action === 'set_profile' && p.id === 'u-free');
  ck('«Сохранить»: set_profile с settings.tier full', !!sp && sp.settings && sp.settings.tier === 'full' && sp.user_type === 'client', JSON.stringify(sp));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'v4780_admin_tier.png'), fullPage: true });

  console.log('--- 5. Итог');
  ck('ошибок страницы нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  const read = f => fs.readFileSync(path.join(OS, f), 'utf8');
  const dashed = ['v4760-access.js', 'v4770-cabinet.js', 'v4760-geo-caps.js'].filter(f => DASH.test(read(f)));
  ck('длинных тире в изменённых модулях нет', dashed.length === 0, dashed.join(', ') || 'нет');
  const lib = read('api/lib.php'), auth = read('api/auth.php');
  ck('сервер: user_tier и free_office_access_enabled в lib.php, цель доступа в auth.php, без длинных тире в новых фрагментах', /function user_tier\(/.test(lib) && /function free_office_access_enabled\(/.test(lib) && /v4\.78\.0: цель доступа/.test(auth) && !DASH.test(lib.slice(lib.indexOf('v4.78.0: уровень доступа'), lib.indexOf('function free_office_access_enabled') + 200)) && !DASH.test(auth.slice(auth.indexOf('v4.78.0: цель доступа'), auth.indexOf("if ($a==='demo')"))));
  await b.close(); srv.close();
  console.log(bad ? '\nПРОВАЛЕНО проверок: ' + bad : '\nВсе проверки v4.78.0 (платформа) прошли');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(1); });
