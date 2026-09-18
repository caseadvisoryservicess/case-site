/* v4.76.0: модель доступа в браузере (мок-бэкенд).

   Что проверяется:
     1. Экран входа: ссылки «Регистрация» и «Демо-доступ»; форма заявки с полями, проверка
        полей, отправка заявки на сервер и ответ; возврат ко входу.
     2. Демо-вход: платформа открывается, права уходят в студию (window.CASE_USER_CAPS), студия в
        iframe показывает 40 бизнес-центров, баннер демо, без выгрузки и правок, без вкладки
        «Управление данными».
     3. Администратор с истекающим сроком видит предупреждение, оно закрывается и помнится.
     4. Страница «Доступ»: карточка заявок (подтвердить, отклонить), карточка «Доступ, подписка и
        журнал» (тип, срок, выгрузка, правки, заметка, сохранить, журнал), корзина геоданных
        (восстановить); запросы уходят на users.php и geo_state.php.
     5. Ошибок страницы нет, длинных тире в новых модулях нет.

   Запуск: NODE_PATH=... node v4760_access.js [папка os] */
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
  state.mode = 'geo';
  const ADMIN = { id: 'u-ash', name: 'Aziz Sharipov', role: 'ASH', role_key: 'ASH', role_label: 'Генеральный директор', admin: true, edit: true, leasing: true, finance: true, csrf: 't0k3n', type: 'admin', demo: false, days_left: 3, expires_at: '2026-09-20 23:59:59', settings: {}, caps: { type: 'admin', demo: false, export: true, edit: true, days_left: 3, expires_at: '2026-09-20 23:59:59' } };
  const ADMIN_RIGHTS = { leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, admin: 1, own_only: 0, project_scope: 0 };
  state.users = [
    { id: 'u-ash', email: 'ceo@case.uz', name: 'Aziz Sharipov', title: 'CEO', role_key: 'ASH', active: 1, archived: 0, user_type: 'employee', expires_at: null, settings: {} },
    { id: 'u-emp', email: 'emp@case.uz', name: 'Сотрудник Первый', title: 'аналитик', role_key: 'AG', active: 1, archived: 0, user_type: 'employee', expires_at: null, settings: { can_export: true } },
    { id: 'u-cl', email: 'client@firm.uz', name: 'Клиент Действующий', title: 'Фирма', role_key: 'CL', active: 1, archived: 0, user_type: 'client', expires_at: '2026-12-31 23:59:59', settings: { can_export: true, can_edit: false, company: 'Фирма' } },
    { id: 'u-old', email: 'old@firm.uz', name: 'Клиент Истёкший', title: '', role_key: 'CL', active: 1, archived: 0, user_type: 'client', expires_at: '2026-01-01 23:59:59', settings: {} },
    { id: 'u-new', email: 'new@firm.uz', name: 'Заявитель Новый', title: 'Новая фирма', role_key: 'CL', active: 0, archived: 0, user_type: 'client', expires_at: null, settings: { registration_pending: 1, company: 'Новая фирма', phone: '+998 90 123 45 67', registered_at: '2026-09-17 10:00:00' } }
  ];
  state.roles = [{ key: 'ASH', label: 'Генеральный директор', leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, own_only: 0, project_scope: 0, admin: 1 }, { key: 'AG', label: 'Агент', leasing: 1, finance: 0, edit: 1, approve: 0, plans: 0, own_only: 0, project_scope: 0, admin: 0 }, { key: 'CL', label: 'Клиент', leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, own_only: 0, project_scope: 0, admin: 0 }, { key: 'DEMO', label: 'Демо-доступ', leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, own_only: 0, project_scope: 0, admin: 0 }];
  state.userLog = { 'u-cl': [{ id: 3, at: '2026-09-17 09:00:00', action: 'Вход в систему', detail: 'роль: CL' }, { id: 2, at: '2026-09-16 18:00:00', action: 'Геоданные сохранены', detail: 'reason=правка' }] };
  state.trash = [{ id: 7, dataset: 'bc', row_key: 'master_id:BC-1', title: 'Удалённый БЦ', deleted_by: 'Сотрудник Первый', deleted_at: '2026-09-17 11:00:00', restored_at: null }, { id: 6, dataset: 'medicine', row_key: 'name:клиника', title: 'Клиника', deleted_by: 'Сотрудник Первый', deleted_at: '2026-09-16 11:00:00', restored_at: '2026-09-16 12:00:00', restored_by: 'Aziz Sharipov' }];

  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await pg.route('**/api/gis_proxy.php**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows: [], provenance: { source: 'OpenStreetMap', conf: 'asking' }, truncated: false }) }));

  console.log('--- 1. Экран входа: регистрация');
  state.sessionValid = false;
  await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.getElementById('l_extra') && typeof window.caseAccess === 'object' && document.getElementById('login') && !document.getElementById('login').classList.contains('hidden'), null, { timeout: 30000 });
  await wait(800);
  const l1 = await pg.evaluate(() => { const cs = e => e ? getComputedStyle(e).display : 'none'; return { reg: cs(document.getElementById('l_regBtn')), demo: cs(document.getElementById('l_demoBtn')), form: document.getElementById('regForm').hidden, ver: window.CASE_MODULE_VERSIONS['v4760-access'] }; });
  ck('ссылки «Регистрация» и «Демо-доступ» видны, форма скрыта, модуль 4.78.0', l1.reg !== 'none' && l1.demo !== 'none' && l1.form === true && l1.ver === '4.78.0', JSON.stringify(l1));
  await pg.click('#l_regBtn'); await wait(200);
  const l2 = await pg.evaluate(() => ({ form: !document.getElementById('regForm').hidden, loginHidden: getComputedStyle(document.getElementById('lemail')).display === 'none', fields: ['r_name', 'r_company', 'r_email', 'r_phone', 'r_pass', 'r_go', 'r_back'].every(id => !!document.getElementById(id)) }));
  ck('форма заявки открыта, поля входа скрыты', l2.form && l2.loginHidden && l2.fields, JSON.stringify(l2));
  await pg.click('#r_go'); await wait(200);
  ck('пустая форма: подсказка про имя', /имя/i.test(await pg.evaluate(() => document.getElementById('r_hint').textContent)));
  await pg.fill('#r_name', 'Иван Проверяющий'); await pg.fill('#r_company', 'ООО Проверка'); await pg.fill('#r_email', 'ivan@proverka.uz'); await pg.fill('#r_phone', '+998 90 000 00 00'); await pg.fill('#r_pass', 'secret123'); await pg.selectOption('#r_purpose', 'developer'); /* v4.78.0: цель «девелопер»: заявка ждёт одобрения (цель «ищу офис» открыла бы доступ сразу) */
  await pg.check('#r_offer'); /* v4.77.0: согласие с офертой обязательно */
  await pg.click('#r_go'); await wait(500);
  const l3 = await pg.evaluate(() => ({ hint: document.getElementById('r_hint').textContent, disabled: document.getElementById('r_email').disabled }));
  ck('заявка ушла на сервер и принята, поля заблокированы', state.registrations && state.registrations.length === 1 && state.registrations[0].email === 'ivan@proverka.uz' && state.registrations[0].company === 'ООО Проверка' && /Заявка принята/.test(l3.hint) && l3.disabled, JSON.stringify({ reg: state.registrations, hint: l3.hint }));
  await pg.click('#r_back'); await wait(200);
  ck('«Назад ко входу» возвращает поля входа', await pg.evaluate(() => document.getElementById('regForm').hidden && getComputedStyle(document.getElementById('lemail')).display !== 'none'));

  console.log('--- 2. Демо-вход и студия с ограничениями');
  await pg.click('#l_demoBtn');
  await pg.waitForFunction(() => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof S === 'object' && S.user && S.user.type === 'demo', null, { timeout: 30000 });
  await wait(1000);
  const d1 = await pg.evaluate(() => ({ caps: window.CASE_USER_CAPS, view: S.view, frame: !!document.getElementById('geoFrame'), links: [...document.querySelectorAll('#nav a[data-v]')].map(a => a.dataset.v) }));
  ck('демо вошёл: права demo без выгрузки и правок ушли в студию, открыта студия, меню без администрирования', d1.caps && d1.caps.demo === true && d1.caps.export === false && d1.caps.edit === false && d1.view === 'geoanalytics' && d1.frame && d1.links.indexOf('users') < 0, JSON.stringify(d1));
  /* BC объявлен в студии через const: снаружи он виден только через eval в её окне */
  const d2 = await pg.evaluate(async () => { const f = document.getElementById('geoFrame'); for (let i = 0; i < 80; i++) { try { const w = f.contentWindow; if (w && w.CASE_GEO_CAPS && w.CASE_GEO_CAPS.caps && w.CASE_GEO_BC && w.document.getElementById('bcSect') && w.document.getElementById('geoCapsBanner')) { const doc = w.document; return { n: w.eval('typeof BC !== "undefined" ? BC.length : null'), total: w.CASE_GEO_CAPS.demoTotal, banner: doc.getElementById('geoCapsBanner').textContent, cls: doc.body.className, exportHidden: getComputedStyle(doc.getElementById('btnProjExport')).display === 'none', dataTab: getComputedStyle(doc.querySelector('.tabs button[data-t="dataT"]')).display, found: doc.getElementById('bcTotal').textContent, save: typeof w.saveCard === 'function' ? w.saveCard(0) : 'нет', toast: doc.getElementById('geoToast').textContent }; } } catch (e) {} await new Promise(r => setTimeout(r, 250)); } return null; });
  ck('студия в демо: 40 БЦ из полной базы, баннер, выгрузка и вкладка данных скрыты, сохранение карточки отвечает отказом', !!d2 && d2.n === 40 && d2.total > 100 && /Демо-версия/.test(d2.banner) && /geo-demo/.test(d2.cls) && d2.exportHidden && d2.dataTab === 'none' && d2.found === '40' && d2.save === false && /Правки недоступны/.test(d2.toast), JSON.stringify(d2));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'access_demo.png') });
  await pg.evaluate(() => logout()); await wait(400);

  console.log('--- 3. Администратор: предупреждение о сроке');
  state.user = ADMIN; state.rights = ADMIN_RIGHTS; state.sessionValid = false;
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.getElementById('l_go') && document.getElementById('login') && !document.getElementById('login').classList.contains('hidden'), null, { timeout: 30000 });
  await wait(500);
  await pg.fill('#lemail', 'ceo@case.uz'); await pg.fill('#lpass', 'password1'); await pg.click('#l_go');
  await pg.waitForFunction(() => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof S === 'object' && S.user && S.user.type === 'admin', null, { timeout: 30000 });
  await wait(800);
  const a1 = await pg.evaluate(() => { const bn = document.getElementById('subBanner'); return { banner: bn ? bn.textContent : '', caps: window.CASE_USER_CAPS }; });
  ck('баннер: доступ истекает через 3 дня, дата, данные сохранятся', /через 3 дн/.test(a1.banner) && /20\.09\.2026/.test(a1.banner) && /Данные сохранятся/.test(a1.banner) && a1.caps.type === 'admin' && a1.caps.export === true, JSON.stringify(a1));
  await pg.click('#subBanner .sub-banner-x'); await wait(100);
  ck('крестик прячет баннер и запоминает это', !(await pg.evaluate(() => !!document.getElementById('subBanner'))) && (await pg.evaluate(() => sessionStorage.getItem('case_sub_banner_2026-09-20') === '1')));

  console.log('--- 4. Страница «Доступ»');
  await pg.evaluate(() => go('users'));
  await pg.waitForFunction(() => document.getElementById('accessCards') && document.getElementById('trashBody') && !/Загрузка/.test(document.getElementById('trashBody').textContent), null, { timeout: 30000 });
  await wait(300);
  const u1 = await pg.evaluate(() => {
    const rows = [...document.querySelectorAll('#accessCard tbody tr')].map(r => ({ uid: r.getAttribute('data-uid'), type: r.querySelector('.ac-type') ? r.querySelector('.ac-type').value : 'admin', st: r.querySelector('.ac-st').textContent, exp: r.querySelector('.ac-exp').value, canExp: r.querySelector('.ac-export').checked, canEdit: r.querySelector('.ac-edit').checked }));
    return { reg: document.querySelectorAll('#regCard tbody tr').length, regName: (document.querySelector('#regCard tbody tr td b') || {}).textContent, rows, trash: [...document.querySelectorAll('#trashCard tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()), trashCount: document.getElementById('trashCount').textContent };
  });
  const rowOf = id => u1.rows.find(r => r.uid === id) || {};
  ck('карточка заявок: одна заявка «Заявитель Новый»', u1.reg === 1 && u1.regName === 'Заявитель Новый', JSON.stringify({ reg: u1.reg, name: u1.regName }));
  ck('карточка доступа: 5 пользователей; администратор без селектора; клиент до 31.12.2026 с выгрузкой без правок; истёкший помечен; заявка помечена', u1.rows.length === 5 && rowOf('u-ash').type === 'admin' && rowOf('u-cl').type === 'client' && rowOf('u-cl').exp === '2026-12-31' && rowOf('u-cl').canExp && !rowOf('u-cl').canEdit && /до 31\.12\.2026/.test(rowOf('u-cl').st) && /срок истёк/.test(rowOf('u-old').st) && /заявка/.test(rowOf('u-new').st) && rowOf('u-emp').type === 'employee', JSON.stringify(u1.rows));
  ck('корзина: две записи, одна восстановлена, счётчик «1 в корзине»', u1.trash.length === 2 && /Удалённый БЦ/.test(u1.trash[0]) && /Восстановить/.test(u1.trash[0]) && /восстановлено/.test(u1.trash[1]) && u1.trashCount === '1 в корзине', JSON.stringify(u1.trash));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'access_admin.png'), fullPage: true });
  await pg.evaluate(() => { const r = document.querySelector('#regCard tbody tr'); r.querySelector('.ac-exp').value = '2026-10-31'; r.querySelector('.ac-exp-export').checked = true; });
  await pg.click('#regCard .ac-approve');
  await pg.waitForFunction(() => !document.getElementById('regCard'), null, { timeout: 15000 });
  await wait(300);
  const post = (state.userPosts || []).find(p => p.action === 'approve');
  ck('«Открыть доступ»: approve с датой и выгрузкой ушёл на сервер, заявка исчезла, пользователь стал активным клиентом', !!post && post.id === 'u-new' && post.expires_at === '2026-10-31' && post.can_export === 1 && +state.users.find(u => u.id === 'u-new').active === 1, JSON.stringify(post));
  const u2 = await pg.evaluate(() => { const r = document.querySelector('#accessCard tr[data-uid="u-new"]'); return { st: r.querySelector('.ac-st').textContent, exp: r.querySelector('.ac-exp').value }; });
  ck('после подтверждения строка заявителя: «до 31.10.2026»', /до 31\.10\.2026/.test(u2.st) && u2.exp === '2026-10-31', JSON.stringify(u2));
  await pg.evaluate(() => { const r = document.querySelector('#accessCard tr[data-uid="u-emp"]'); r.querySelector('.ac-type').value = 'client'; r.querySelector('.ac-exp').value = '2026-11-15'; r.querySelector('.ac-export').checked = false; r.querySelector('.ac-note').value = 'бывший сотрудник'; });
  await pg.click('#accessCard tr[data-uid="u-emp"] .ac-save');
  await pg.waitForFunction(() => (document.querySelector('#accessCard tr[data-uid="u-emp"] .ac-type') || {}).value === 'client' && /до 15\.11\.2026/.test((document.querySelector('#accessCard tr[data-uid="u-emp"] .ac-st') || {}).textContent || ''), null, { timeout: 15000 });
  const sp = (state.userPosts || []).find(p => p.action === 'set_profile');
  ck('«Сохранить»: set_profile с типом, сроком, выгрузкой и заметкой; таблица перерисована', !!sp && sp.id === 'u-emp' && sp.user_type === 'client' && sp.expires_at === '2026-11-15' && sp.settings.can_export === false && sp.settings.note === 'бывший сотрудник', JSON.stringify(sp));
  await pg.click('#accessCard tr[data-uid="u-cl"] .ac-log');
  await pg.waitForFunction(() => document.getElementById('rmodal'), null, { timeout: 10000 });
  const lg = await pg.evaluate(() => ({ text: document.getElementById('rmodal').textContent.replace(/\s+/g, ' '), rows: document.querySelectorAll('#rmodal tbody tr').length }));
  ck('«Журнал»: окно с действиями клиента (вход, сохранение)', lg.rows === 2 && /Клиент Действующий/.test(lg.text) && /Вход в систему/.test(lg.text) && /Геоданные сохранены/.test(lg.text), JSON.stringify(lg));
  await pg.evaluate(() => document.getElementById('rmodal').remove());
  await pg.click('#trashCard .ac-restore');
  await pg.waitForFunction(() => document.getElementById('trashCount').textContent === 'пусто', null, { timeout: 15000 });
  ck('«Восстановить»: запись восстановлена на сервере, корзина пуста', !!state.trash.find(t => t.id === 7 && t.restored_at), JSON.stringify(state.trash[0]));
  await pg.click('#accessCard tr[data-uid="u-new"] .ac-log'); await wait(300);
  await pg.evaluate(() => { const m = document.getElementById('rmodal'); if (m) m.remove(); });
  pg.once('dialog', dlg => dlg.accept());

  console.log('--- 5. Итог');
  ck('ошибок страницы нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  const read = f => fs.readFileSync(path.join(OS, f), 'utf8');
  const between = (t, a, b) => { const i = t.indexOf(a); const j = i >= 0 ? t.indexOf(b, i + 1) : -1; return (i >= 0 && j > i) ? t.slice(i, j) : 'НЕТ ФРАГМЕНТА ' + a; };
  /* в старых серверных файлах длинные тире были и раньше; проверяем новые модули целиком и новые фрагменты PHP по их границам */
  const jsMods = ['v4760-access.js', 'v4760-geo-caps.js', 'v4760-geo-bc.js', 'v4750-geo-layout.js', 'v4750-geo-tools.js'].filter(f => DASH.test(read(f)));
  const lib = read('api/lib.php'), auth = read('api/auth.php'), usersPhp = read('api/users.php'), geo = read('api/geo_state.php');
  const frags = [between(lib, '// v4.76.0: тип доступа', 'function current_user'), between(lib, '// Закрыть сеанс, но оставить', 'function demo_email'), between(lib, '/* v4.76.0: клиенты и демо', 'function asaas_workspace_can_view'),
    between(auth, '/* v4.76.0: регистрация', "if ($a==='verify_ceo')"), between(auth, 'function publicUser', 'function rightsOf'), between(usersPhp, '/* v4.76.0: настройки пользователя', "if ($a==='setpass')"),
    between(geo, '/* v4.76.0: корзина геоданных', 'function geo_is_list_array'), between(geo, "  if ($action === 'restore_trash')", "  if (!array_key_exists('data',$b)")];
  const badFrags = frags.filter(t => /^НЕТ ФРАГМЕНТА/.test(t) || DASH.test(t));
  ck('в новых модулях и новых серверных фрагментах нет длинных тире, фрагменты на месте', jsMods.length === 0 && badFrags.length === 0, (jsMods.join(', ') || 'js чисто') + ' / ' + (badFrags.map(t => t.slice(0, 40)).join(' | ') || 'php чисто'));
  await b.close(); srv.close();
  console.log('\n' + (bad ? bad + ' проблем' : 'Модель доступа в браузере работает: вход, регистрация, демо, срок, страница «Доступ»'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(2); });
