/* v4.77.0: оферта, личный кабинет и обратная связь в браузере (мок-бэкенд).

   Что проверяется:
     1. Регистрация: галочка «принимаю условия оферты» со ссылкой на offer.html обязательна;
        без неё заявка не уходит; с ней в заявке offer_accepted: true.
     2. Клиент, не принявший текущую версию оферты, видит окно согласия с текстом оферты
        (iframe offer.html), кнопка «Принимаю» доступна только после галочки, согласие уходит
        на сервер (accept_offer), окно закрывается; администратор окно не видит.
     3. Меню профиля: «Личный кабинет», «Обратная связь», «Публичная оферта», у администратора
        «Обращения» со счётчиком новых.
     4. Личный кабинет: профиль (имя, компания, телефон, профиль панелей студии) сохраняется
        (update_profile), смена пароля проверяет длину и совпадение, неверный текущий пароль
        показывает ошибку, верный меняет; карточки доступа и оферты; «Мои обращения» и
        «Последние входы и действия» из сервера.
     5. Обратная связь: форма отправляет тип и текст (send), обращение появляется в кабинете;
        у администратора на странице «Доступ» карточка «Обращения»: «Просмотрено», «Ответить»
        (status с reply), счётчик в меню обновляется.
     6. Демо-доступ: окно оферты принимается на сеанс (без запроса на сервер), кабинет без
        полей профиля и пароля.
     7. Ошибок страницы нет, длинных тире в новых файлах нет; offer.html содержит версию и
        ключевые условия (нет юридической силы, рекомендация, запрет распространения).

   Запуск: NODE_PATH=... node v4770_cabinet.js [папка os] */
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
  const ADMIN = { id: 'u-ash', name: 'Aziz Sharipov', role: 'ASH', role_key: 'ASH', role_label: 'Генеральный директор', admin: true, edit: true, leasing: true, finance: true, csrf: 't0k3n', type: 'admin', demo: false, days_left: null, expires_at: null, settings: {}, caps: { type: 'admin', demo: false, export: true, edit: true, days_left: null, expires_at: null, profile: '', offer_accepted: false, offer_version: '1.0' } };
  const ADMIN_RIGHTS = { leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, admin: 1, own_only: 0, project_scope: 0 };
  const CLIENT = { id: 'u-cl', name: 'Клиент Действующий', email: 'client@firm.uz', role: 'CL', role_key: 'CL', role_label: 'Клиент', admin: false, edit: false, csrf: 't0k3n', type: 'client', demo: false, days_left: 104, expires_at: '2026-12-31 23:59:59', settings: { company: 'Фирма', phone: '+998 90 111 22 33' }, caps: { type: 'client', demo: false, export: true, edit: false, days_left: 104, expires_at: '2026-12-31 23:59:59', profile: '', offer_accepted: false, offer_version: '1.0' } };
  const CL_RIGHTS = { leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, admin: 0, own_only: 0, project_scope: 0 };
  state.users = [{ id: 'u-ash', email: 'ceo@case.uz', name: 'Aziz Sharipov', title: 'CEO', role_key: 'ASH', active: 1, archived: 0, user_type: 'admin', expires_at: null, settings: {} }, { id: 'u-cl', email: 'client@firm.uz', name: 'Клиент Действующий', title: 'Фирма', role_key: 'CL', active: 1, archived: 0, user_type: 'client', expires_at: '2026-12-31 23:59:59', settings: {} }];
  state.roles = [{ key: 'ASH', label: 'Генеральный директор', leasing: 1, finance: 1, edit: 1, approve: 1, plans: 1, own_only: 0, project_scope: 0, admin: 1 }, { key: 'CL', label: 'Клиент', leasing: 0, finance: 0, edit: 0, approve: 0, plans: 0, own_only: 0, project_scope: 0, admin: 0 }];
  state.myLog = [{ id: 2, action: 'Вход в систему', detail: 'роль: CL', at: '2026-09-18 09:00:00' }, { id: 1, action: 'Обращение отправлено', detail: '#1 idea', at: '2026-09-17 18:00:00' }];

  const b = await chromium.launch({ executablePath: process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--no-proxy-server'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message.slice(0, 200)));
  pg.on('dialog', async d => { if (d.type() === 'prompt') await d.accept('Спасибо, добавим в план'); else await d.accept(); });
  await pg.route('**/*', r => { const u = r.request().url(); return (u.startsWith(base) || /^(data|blob):/.test(u)) ? r.continue() : r.abort(); });
  await pg.route('**/api/gis_proxy.php**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, rows: [], provenance: { source: 'OpenStreetMap', conf: 'asking' }, truncated: false }) }));
  const loginAs = async (user, rights, email, pass) => {
    state.user = user; state.rights = rights; state.sessionValid = false;
    await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => document.getElementById('l_go') && document.getElementById('login') && !document.getElementById('login').classList.contains('hidden') && window.caseCabinet, null, { timeout: 30000 });
    await wait(300);
    await pg.fill('#lemail', email); await pg.fill('#lpass', pass || 'password1'); await pg.click('#l_go');
    await pg.waitForFunction(t => document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && typeof S === 'object' && S.user && S.user.type === t, user.type, { timeout: 30000 });
    await wait(800);
  };

  console.log('--- 1. Регистрация с согласием');
  state.sessionValid = false; state.user = ADMIN; state.rights = ADMIN_RIGHTS;
  await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.getElementById('l_regBtn') && window.caseCabinet && window.caseAccess, null, { timeout: 30000 });
  await wait(500);
  await pg.click('#l_regBtn'); await wait(200);
  const g1 = await pg.evaluate(() => ({ ck: !!document.getElementById('r_offer'), checked: document.getElementById('r_offer').checked, link: (document.querySelector('.l-offer a') || {}).getAttribute('href'), target: (document.querySelector('.l-offer a') || {}).getAttribute('target'), ver: window.caseCabinet.version }));
  ck('в форме заявки галочка оферты со ссылкой offer.html (новая вкладка), снята; модуль кабинета 4.78.0', g1.ck && !g1.checked && g1.link === 'offer.html' && g1.target === '_blank' && g1.ver === '4.78.0', JSON.stringify(g1));
  await pg.fill('#r_name', 'Иван Проверяющий'); await pg.fill('#r_company', 'ООО Проверка'); await pg.fill('#r_email', 'ivan@proverka.uz'); await pg.fill('#r_phone', '+998 90 000 00 00'); await pg.fill('#r_pass', 'secret123'); await pg.selectOption('#r_purpose', 'developer'); /* v4.78.0: цель «девелопер»: заявка ждёт одобрения (цель «ищу офис» открыла бы доступ сразу) */
  await pg.click('#r_go'); await wait(300);
  const g2 = await pg.evaluate(() => document.getElementById('r_hint').textContent);
  ck('без галочки заявка не уходит, подсказка про оферту', /оферт/i.test(g2) && !(state.registrations || []).length, g2);
  await pg.check('#r_offer'); await pg.click('#r_go'); await wait(500);
  ck('с галочкой заявка ушла с offer_accepted: true', (state.registrations || []).length === 1 && state.registrations[0].offer_accepted === true && /Заявка принята/.test(await pg.evaluate(() => document.getElementById('r_hint').textContent)), JSON.stringify(state.registrations));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'cabinet_register.png') });

  console.log('--- 2. Окно согласия у клиента');
  await loginAs(CLIENT, CL_RIGHTS, 'client@firm.uz');
  await pg.waitForFunction(() => document.getElementById('offerGate'), null, { timeout: 15000 });
  const o1 = await pg.evaluate(() => ({ frame: (document.querySelector('#offerGate iframe') || {}).getAttribute('src'), disabled: document.getElementById('offerAccept').disabled, ver: document.querySelector('#offerGate .offer-head .mut').textContent, needs: window.caseCabinet.needsOffer(), items: ['pm_cabinet', 'pm_feedback', 'pm_offer'].every(id => document.getElementById(id)), inbox: !!document.getElementById('pm_inbox') }));
  ck('окно оферты: iframe offer.html, «Принимаю» недоступна, версия 1.0, пункты меню без «Обращений» у клиента', /offer\.html/.test(o1.frame) && o1.disabled && /1\.0/.test(o1.ver) && o1.needs && o1.items && !o1.inbox, JSON.stringify(o1));
  await pg.waitForFunction(() => { try { const f = document.querySelector('#offerGate iframe'); return f && f.contentDocument && /публичная оферта/i.test(f.contentDocument.body.textContent); } catch (e) { return false; } }, null, { timeout: 15000 });
  ck('текст оферты загружен в окно', true);
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'cabinet_offer_gate.png') });
  await pg.check('#offerCk'); ck('галочка открывает «Принимаю»', !(await pg.evaluate(() => document.getElementById('offerAccept').disabled)));
  await pg.click('#offerAccept');
  await pg.waitForFunction(() => !document.getElementById('offerGate'), null, { timeout: 10000 });
  ck('согласие ушло на сервер, окно закрыто, права обновлены', state.offerAccepts === 1 && await pg.evaluate(() => S.user.caps.offer_accepted === true && S.user.settings.offer_accepted.version === '1.0' && !window.caseCabinet.needsOffer()));

  console.log('--- 3. Личный кабинет клиента');
  await pg.evaluate(() => go('profile'));
  await pg.waitForFunction(() => document.getElementById('cabProfile') && document.getElementById('cabLogList') && !/Загрузка/.test(document.getElementById('cabLogList').textContent) && !/Загрузка/.test(document.getElementById('cabFbList').textContent), null, { timeout: 15000 });
  const c1 = await pg.evaluate(() => ({ cards: ['cabProfile', 'cabAccess', 'cabOffer', 'cabPass', 'cabFeedback', 'cabLog'].every(id => document.getElementById(id)), name: document.getElementById('cabName').value, company: document.getElementById('cabCompany').value, phones: document.getElementById('cabPhone').value, access: document.getElementById('cabAccess').textContent.replace(/\s+/g, ' '), offer: document.getElementById('cabOffer').textContent.replace(/\s+/g, ' '), log: document.querySelectorAll('#cabLogList tbody tr').length, fb: document.getElementById('cabFbList').textContent, profOpts: document.querySelectorAll('#cabProfileSel option').length, view: S.view }));
  ck('шесть карточек; профиль заполнен; доступ: клиент до 31.12.2026, выгрузка разрешена, правки отключены; оферта принята 1.0; журнал 2 записи; обращений нет; 7 профилей', c1.cards && c1.name === 'Клиент Действующий' && c1.company === 'Фирма' && /клиент/.test(c1.access) && /до 31\.12\.2026/.test(c1.access) && /осталось 104 дн/.test(c1.access) && /Выгрузка\s*разрешена/.test(c1.access) && /Правки\s*отключены/.test(c1.access) && /Принята: версия 1\.0/.test(c1.offer) && c1.log === 2 && /Обращений пока нет/.test(c1.fb) && c1.profOpts === 7 && c1.view === 'profile', JSON.stringify(c1));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'cabinet_client.png'), fullPage: true });
  await pg.fill('#cabCompany', 'Фирма Новая'); await pg.selectOption('#cabProfileSel', 'developer'); await pg.click('#cabSave');
  await pg.waitForFunction(() => document.getElementById('cabHint').textContent === 'Сохранено', null, { timeout: 10000 });
  const pp = (state.profilePosts || [])[0];
  ck('«Сохранить»: update_profile с компанией и профилем «developer», права обновлены', !!pp && pp.company === 'Фирма Новая' && pp.profile === 'developer' && pp.name === 'Клиент Действующий' && await pg.evaluate(() => S.user.caps.profile === 'developer' && S.user.settings.company === 'Фирма Новая'), JSON.stringify(pp));
  await pg.fill('#cabOld', 'wrong'); await pg.fill('#cabNew', 'short'); await pg.fill('#cabNew2', 'short'); await pg.click('#cabPassBtn'); await wait(100);
  ck('пароль короче 8 символов отклонён на месте', /минимум 8/.test(await pg.evaluate(() => document.getElementById('cabPassHint').textContent)) && !(state.passwordPosts || []).length);
  await pg.fill('#cabNew', 'newpass123'); await pg.fill('#cabNew2', 'newpass124'); await pg.click('#cabPassBtn'); await wait(100);
  ck('несовпадение паролей отклонено на месте', /не совпадают/.test(await pg.evaluate(() => document.getElementById('cabPassHint').textContent)));
  await pg.fill('#cabNew2', 'newpass123'); await pg.click('#cabPassBtn');
  await pg.waitForFunction(() => /Ошибка/.test(document.getElementById('cabPassHint').textContent), null, { timeout: 10000 });
  const pw1 = await pg.evaluate(() => document.getElementById('cabPassHint').textContent);
  /* apiPOST ядра повторяет запрос после 403 (обновление CSRF), поэтому неверная попытка уходит дважды */
  ck('неверный текущий пароль: ошибка сервера показана', /неверн/i.test(pw1) && (state.passwordPosts || []).length >= 1 && state.passwordPosts.every(p => p.old_password === 'wrong'), JSON.stringify({ hint: pw1, posts: state.passwordPosts }));
  await pg.fill('#cabOld', 'password1'); await pg.click('#cabPassBtn');
  await pg.waitForFunction(() => document.getElementById('cabPassHint').textContent === 'Пароль изменён', null, { timeout: 10000 });
  const pwPosts = state.passwordPosts || [], pwLast = pwPosts[pwPosts.length - 1];
  ck('верный текущий пароль: изменён, поля очищены', pwLast && pwLast.password === 'newpass123' && pwLast.old_password === 'password1' && pwPosts.filter(p => p.old_password === 'password1').length === 1 && await pg.evaluate(() => document.getElementById('cabOld').value === '' && document.getElementById('cabNew').value === ''), JSON.stringify(pwPosts));

  console.log('--- 4. Обратная связь');
  await pg.click('#cabFbNew');
  await pg.waitForFunction(() => document.getElementById('fbText'), null, { timeout: 10000 });
  await pg.click('#fbSend'); await wait(100);
  ck('пустое сообщение не уходит', /Напишите сообщение/.test(await pg.evaluate(() => document.getElementById('fbHint').textContent)) && !(state.feedback || []).length);
  await pg.selectOption('#fbKind', 'problem'); await pg.fill('#fbText', 'Не открывается карточка БЦ в Сергели'); await pg.click('#fbSend');
  await pg.waitForFunction(() => !document.getElementById('rmodal') && document.querySelectorAll('#cabFbList tbody tr').length === 1, null, { timeout: 10000 });
  const f1 = state.feedback[0];
  ck('обращение отправлено (problem, текст, страница profile) и показано в кабинете со статусом «новое»', f1.kind === 'problem' && /Сергели/.test(f1.text) && f1.page === 'profile' && f1.user_id === 'u-cl' && /новое/.test(await pg.evaluate(() => document.querySelector('#cabFbList .fb-st').textContent)), JSON.stringify(f1));
  await pg.evaluate(() => logout()); await wait(400);

  console.log('--- 5. Администратор: обращения');
  ADMIN.caps.offer_accepted = false;
  await loginAs(ADMIN, ADMIN_RIGHTS, 'ceo@case.uz');
  const ad1 = await pg.evaluate(() => ({ gate: !!document.getElementById('offerGate'), inbox: (document.getElementById('pm_inbox') || {}).textContent, needs: window.caseCabinet.needsOffer() }));
  ck('администратор без окна оферты; пункт «Обращения (1)» со счётчиком', !ad1.gate && !ad1.needs && ad1.inbox === 'Обращения (1)', JSON.stringify(ad1));
  await pg.evaluate(() => go('users'));
  await pg.waitForFunction(() => document.getElementById('feedbackCard') && document.querySelectorAll('#feedbackCard tbody tr').length === 1, null, { timeout: 30000 });
  const ad2 = await pg.evaluate(() => ({ cnt: document.getElementById('fbCount').textContent, row: document.querySelector('#feedbackCard tbody tr').textContent.replace(/\s+/g, ' '), btns: [...document.querySelectorAll('#feedbackCard tbody button')].map(b => b.textContent) }));
  ck('карточка «Обращения»: 1 новое, строка клиента с типом «Проблема», кнопки Просмотрено / Ответить / Готово', /1 новых из 1/.test(ad2.cnt) && /Клиент Действующий/.test(ad2.row) && /Проблема/.test(ad2.row) && /Сергели/.test(ad2.row) && ad2.btns.join('|') === 'Просмотрено|Ответить|Готово', JSON.stringify(ad2));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'cabinet_admin_feedback.png'), fullPage: true });
  await pg.click('#feedbackCard .fb-seen');
  await pg.waitForFunction(() => /просмотрено/.test((document.querySelector('#feedbackCard .fb-st') || {}).textContent || '') && document.getElementById('pm_inbox').textContent === 'Обращения', null, { timeout: 10000 });
  ck('«Просмотрено»: статус seen, счётчик в меню без числа', state.feedback[0].status === 'seen');
  await pg.click('#feedbackCard .fb-reply');
  await pg.waitForFunction(() => /добавим в план/.test(document.getElementById('feedbackCard').textContent), null, { timeout: 10000 });
  ck('«Ответить»: ответ сохранён со статусом done и автором', state.feedback[0].status === 'done' && state.feedback[0].reply === 'Спасибо, добавим в план' && state.feedback[0].replied_by === 'Aziz Sharipov');
  await pg.evaluate(() => logout()); await wait(400);

  console.log('--- 6. Демо-доступ');
  state.sessionValid = false; state.user = ADMIN;
  await pg.goto(base + '/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => document.getElementById('l_demoBtn') && window.caseCabinet, null, { timeout: 30000 });
  await wait(300); await pg.click('#l_demoBtn');
  await pg.waitForFunction(() => typeof S === 'object' && S.user && S.user.type === 'demo' && document.getElementById('offerGate'), null, { timeout: 30000 });
  const before = state.offerAccepts;
  await pg.check('#offerCk'); await pg.click('#offerAccept');
  await pg.waitForFunction(() => !document.getElementById('offerGate'), null, { timeout: 10000 });
  ck('демо: согласие на сеанс без запроса на сервер', state.offerAccepts === before && await pg.evaluate(() => sessionStorage.getItem('case_offer_demo_1.0') === '1' && !window.caseCabinet.needsOffer()));
  await pg.evaluate(() => go('profile'));
  await pg.waitForFunction(() => document.getElementById('cabProfile'), null, { timeout: 15000 });
  const d1 = await pg.evaluate(() => ({ pass: !!document.getElementById('cabPass'), save: !!document.getElementById('cabSave'), disabled: document.getElementById('cabName').disabled && document.getElementById('cabProfileSel').disabled, txt: document.getElementById('cabProfile').textContent, offer: document.getElementById('cabOffer').textContent }));
  ck('кабинет демо: без смены пароля и сохранения, поля заблокированы, пояснение про демо, оферта «на этот сеанс»', !d1.pass && !d1.save && d1.disabled && /Демо-доступ общий/.test(d1.txt) && /на этот сеанс/.test(d1.offer), JSON.stringify({ pass: d1.pass, save: d1.save, disabled: d1.disabled }));

  console.log('--- 7. Итог');
  ck('ошибок страницы нет', errs.length === 0, errs.slice(0, 3).join(' | ') || 'нет');
  const read = f => fs.readFileSync(path.join(OS, f), 'utf8');
  const dashed = ['v4770-cabinet.js', 'v4760-access.js', 'offer.html', 'api/feedback.php'].filter(f => DASH.test(read(f)));
  ck('длинных тире в новых файлах нет', dashed.length === 0, dashed.join(', ') || 'нет');
  const offer = read('offer.html');
  ck('offer.html: версия 1.0, нет юридической силы, рекомендательный характер, запрет передачи без разрешения, согласие галочкой', /case-offer-version" content="1\.0"/.test(offer) && /не имеют юридической силы/.test(offer) && /рекомендательный характер/.test(offer) && /без письменного разрешения CASE/.test(offer) && /принимаю условия/.test(offer));
  const lib = read('api/lib.php'), botJs = fs.readFileSync(path.join(OS, '..', 'bot', 'telegram_feedback_bot.js'), 'utf8');
  ck('сервер: user_caps отдаёт profile, offer_accepted, offer_version; бот шлёт action bot с токеном', /'profile'=>\$profile, 'offer_accepted'=>offer_accepted\(\$u\), 'offer_version'=>offer_version\(\)/.test(lib) && /action: 'bot', token: SECRET/.test(botJs) && !DASH.test(botJs));
  await b.close(); srv.close();
  console.log(bad ? '\nПРОВАЛЕНО проверок: ' + bad : '\nВсе проверки v4.77.0 (кабинет) прошли');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(1); });
