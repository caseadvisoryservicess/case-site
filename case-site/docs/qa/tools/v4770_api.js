/* v4.77.0: оферта, кабинет и обратная связь на настоящем PHP API (php -S, база SQLite).

   Что проверяется:
     1. Экран входа отдаёт версию оферты и адрес документа; регистрация без согласия отвечает
        400, с согласием создаёт заявку, у которой в настройках записаны версия, время и IP.
     2. Администратор: права содержат profile, offer_accepted (false до принятия),
        offer_version; accept_offer записывает согласие, после него offer_accepted true;
        смена версии оферты в конфиге снова требует согласия.
     3. update_profile: имя, компания, телефон, профиль панелей (только из списка); права
        отдают профиль; change_password: неверный текущий 403, короткий 400, верный меняет
        (вход по новому паролю работает); my_log отдаёт действия пользователя.
     4. Обратная связь: send пишет обращение (channel app), счётчик новых, список для
        администратора и «мои»; status с ответом; клиент видит ответ в «мои»; бот: неверный
        токен 403, верный пишет обращение с каналом telegram без сеанса; пустой текст 400.
     5. Демо-пользователь: accept_offer отвечает ok без записи; send работает (канал demo);
        update_profile отвечает 403.
     6. users.php set_profile принимает settings.profile.

   Запуск: node v4770_api.js [папка os] */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case_cab_'));
  const apiDir = path.join(dir, 'api'); fs.mkdirSync(apiDir);
  for (const f of fs.readdirSync(path.join(OS, 'api'))) if (/\.php$/.test(f) && !/^config(\.|\.local)/.test(f)) fs.copyFileSync(path.join(OS, 'api', f), path.join(apiDir, f));
  fs.writeFileSync(path.join(apiDir, 'mode.php'), "<?php return ['mode' => 'geo'];");
  const dbPath = path.join(dir, 'db.sqlite');
  const cfgPath = path.join(apiDir, 'config.php');
  const writeCfg = (ver, extra) => fs.writeFileSync(cfgPath, "<?php return ['driver' => 'sqlite', 'sqlite_path' => " + JSON.stringify(dbPath) + ", 'platform_mode' => 'geo', 'offer_version' => " + JSON.stringify(ver) + ", 'feedback_bot_token' => 'bot-secret-token-123'" + (extra || '') + "];");
  writeCfg('1.0');
  const boot = path.join(dir, 'boot.php');
  fs.writeFileSync(boot, `<?php
$p = new PDO('sqlite:' . ${JSON.stringify(dbPath)}); $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$p->exec("CREATE TABLE roles (\`key\` TEXT PRIMARY KEY, label TEXT NOT NULL, leasing INTEGER DEFAULT 0, finance INTEGER DEFAULT 0, edit INTEGER DEFAULT 0, approve INTEGER DEFAULT 0, plans INTEGER DEFAULT 0, own_only INTEGER DEFAULT 0, project_scope INTEGER DEFAULT 0, admin INTEGER DEFAULT 0)");
$p->exec("CREATE TABLE app_users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, name TEXT NOT NULL, title TEXT, role_key TEXT NOT NULL, broker_name TEXT, projects TEXT, active INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$p->exec("CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, by_id TEXT, by_name TEXT, role_key TEXT, action TEXT, detail TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP)");
$p->exec("CREATE TABLE app_state (id INTEGER PRIMARY KEY, data TEXT, updated_at TEXT, updated_by TEXT, revision INTEGER NOT NULL DEFAULT 0)");
$p->exec("INSERT INTO roles VALUES ('ASH','Генеральный директор',1,1,1,1,1,0,0,1)");
$st = $p->prepare("INSERT INTO app_users (id,email,password_hash,name,title,role_key) VALUES (?,?,?,?,?,?)");
$st->execute(['u-admin','admin@case.test',password_hash('admin12345',PASSWORD_DEFAULT),'Админ Тестов','CEO','ASH']);
echo "ok";`);
  ck('база SQLite подготовлена', execSync('php ' + JSON.stringify(boot), { encoding: 'utf8' }).trim() === 'ok');
  const port = 18000 + Math.floor(Math.random() * 2000);
  const php = spawn('php', ['-S', '127.0.0.1:' + port, '-t', apiDir], { stdio: ['ignore', 'pipe', 'pipe'] });
  let phpLog = ''; php.stderr.on('data', d => { phpLog += d; }); php.stdout.on('data', d => { phpLog += d; });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 40; i++) { try { await fetch(base + '/health.php'); break; } catch (e) { await sleep(150); } }
  function jar() {
    const j = { cookie: '', csrf: '' };
    j.call = async (ep, body, method, raw) => {
      const opt = { method: method || (body ? 'POST' : 'GET'), headers: { 'Accept': 'application/json', 'Origin': base, 'Cookie': j.cookie } };
      if (body) { opt.headers['Content-Type'] = 'application/json'; if (!raw) opt.headers['X-CSRF-Token'] = j.csrf; opt.body = JSON.stringify(body); }
      const r = await fetch(base + '/' + ep, opt);
      const sc = r.headers.get('set-cookie'); if (sc) { const m = sc.match(/caseos=([^;]+)/); if (m) j.cookie = 'caseos=' + m[1]; }
      let data = null; try { data = await r.json(); } catch (e) { data = null; }
      if (data && data.csrf) j.csrf = data.csrf;
      return { status: r.status, data };
    };
    return j;
  }
  /* запрос к базе без оболочки shell: $ в аргументах не раскрывается */
  const qPhp = path.join(dir, 'q.php');
  fs.writeFileSync(qPhp, "<?php $p=new PDO('sqlite:'.$argv[1]);echo json_encode($p->query($argv[2])->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);");
  const sql = q => execFileSync('php', [qPhp, dbPath, q], { encoding: 'utf8' });

  console.log('--- 1. Флаги и регистрация');
  const guest = jar();
  let r = await guest.call('auth.php');
  ck('без сеанса: offer_version 1.0 и offer_url offer.html', r.status === 200 && r.data && r.data.auth === false && r.data.offer_version === '1.0' && r.data.offer_url === 'offer.html', JSON.stringify(r.data));
  r = await guest.call('auth.php', { action: 'register', name: 'Клиент Пробный', email: 'client@firm.test', password: 'client12345', company: 'Фирма' });
  ck('регистрация без согласия: 400 с понятным текстом', r.status === 400 && /оферт/i.test(r.data && r.data.error || ''), JSON.stringify(r.data));
  r = await guest.call('auth.php', { action: 'register', name: 'Клиент Пробный', email: 'client@firm.test', password: 'client12345', company: 'Фирма', phone: '+998 90 000 00 00', offer_accepted: true });
  ck('регистрация с согласием: заявка принята', r.status === 200 && r.data && r.data.ok && r.data.pending, JSON.stringify(r.data));
  const reg = JSON.parse(sql("SELECT settings FROM app_users WHERE email='client@firm.test'"))[0];
  const regS = JSON.parse(reg.settings);
  ck('в настройках заявителя: offer_accepted с версией 1.0, временем и IP', regS.offer_accepted && regS.offer_accepted.version === '1.0' && /^\d{4}-\d{2}-\d{2}/.test(regS.offer_accepted.at) && !!regS.offer_accepted.ip, reg.settings);

  console.log('--- 2. Администратор: права и согласие');
  const admin = jar(); await admin.call('auth.php'); /* GET выдаёт cookie и CSRF для POST */
  r = await admin.call('auth.php', { action: 'login', email: 'admin@case.test', password: 'admin12345' });
  ck('вход администратора: caps с profile "", offer_accepted false, offer_version 1.0', r.status === 200 && r.data.user && r.data.user.caps && r.data.user.caps.profile === '' && r.data.user.caps.offer_accepted === false && r.data.user.caps.offer_version === '1.0', JSON.stringify(r.data.user ? r.data.user.caps : r.data));
  r = await admin.call('auth.php', { action: 'accept_offer' });
  ck('accept_offer: ok, версия и время', r.status === 200 && r.data.ok && r.data.version === '1.0' && !!r.data.at, JSON.stringify(r.data));
  r = await admin.call('auth.php');
  ck('после согласия offer_accepted true', r.data.user.caps.offer_accepted === true, JSON.stringify(r.data.user.caps));
  writeCfg('1.1'); await sleep(2600);
  r = await admin.call('auth.php');
  ck('новая версия оферты 1.1 в конфиге: согласие снова требуется', r.data.offer_version === '1.1' && r.data.user.caps.offer_accepted === false && r.data.user.caps.offer_version === '1.1', JSON.stringify({ v: r.data.offer_version, caps: r.data.user.caps }));
  r = await admin.call('auth.php', { action: 'accept_offer' }); r = await admin.call('auth.php');
  ck('принята версия 1.1', r.data.user.caps.offer_accepted === true);

  console.log('--- 3. Профиль, пароль, журнал');
  r = await admin.call('auth.php', { action: 'update_profile', name: 'Админ Обновлённый', company: 'CASE', phone: '+998 71 000 00 00', profile: 'developer' });
  ck('update_profile: ok, имя и настройки в ответе', r.status === 200 && r.data.ok && r.data.name === 'Админ Обновлённый' && r.data.settings.company === 'CASE' && r.data.settings.profile === 'developer', JSON.stringify(r.data));
  r = await admin.call('auth.php');
  ck('права отдают profile developer, имя обновлено', r.data.user.caps.profile === 'developer' && r.data.user.name === 'Админ Обновлённый', JSON.stringify(r.data.user.caps));
  r = await admin.call('auth.php', { action: 'update_profile', name: 'Админ Обновлённый', profile: 'hacker' });
  const capsAfterBad = (await admin.call('auth.php')).data.user.caps;
  ck('профиль вне списка не принимается (остаётся пустым или прежним, не "hacker")', capsAfterBad.profile !== 'hacker', JSON.stringify({ status: r.status, profile: capsAfterBad.profile }));
  r = await admin.call('auth.php', { action: 'update_profile', name: 'A' });
  ck('имя короче 2 символов: 400', r.status === 400, JSON.stringify(r.data));
  r = await admin.call('auth.php', { action: 'change_password', old_password: 'wrong', password: 'newpass12345' });
  ck('неверный текущий пароль: 403', r.status === 403, JSON.stringify(r.data));
  r = await admin.call('auth.php', { action: 'change_password', old_password: 'admin12345', password: 'short' });
  ck('короткий новый пароль: 400', r.status === 400, JSON.stringify(r.data));
  r = await admin.call('auth.php', { action: 'change_password', old_password: 'admin12345', password: 'newpass12345' });
  ck('смена пароля: ok', r.status === 200 && r.data.ok, JSON.stringify(r.data));
  const admin2 = jar(); await admin2.call('auth.php');
  r = await admin2.call('auth.php', { action: 'login', email: 'admin@case.test', password: 'newpass12345' });
  ck('вход по новому паролю работает', r.status === 200 && r.data.auth === true && r.data.user && r.data.user.name === 'Админ Обновлённый', JSON.stringify(r.data && r.data.error));
  r = await admin.call('auth.php', { action: 'my_log', limit: 50 });
  const acts = (r.data.rows || []).map(x => x.action);
  ck('my_log: свои действия (вход, согласие с офертой, профиль, пароль)', r.status === 200 && acts.some(a => /Вход/.test(a)) && acts.some(a => /офер/i.test(a)) && acts.some(a => /Профиль/.test(a)) && acts.some(a => /Пароль/.test(a)), acts.slice(0, 8).join(' | '));

  console.log('--- 4. Обратная связь');
  r = await admin.call('feedback.php', { action: 'send', kind: 'idea', text: 'Добавьте слой парковок', page: 'geoanalytics' });
  ck('send: обращение записано', r.status === 200 && r.data.ok && r.data.id === 1, JSON.stringify(r.data));
  r = await admin.call('feedback.php', { action: 'send', kind: 'idea', text: 'ab' });
  ck('короткий текст: 400', r.status === 400);
  r = await admin.call('feedback.php?count=1');
  ck('count: 1 новое', r.data['new'] === 1, JSON.stringify(r.data));
  r = await guest.call('feedback.php', { action: 'bot', token: 'wrong', text: 'привет' }, 'POST', true);
  ck('бот с неверным токеном: 403', r.status === 403, JSON.stringify(r.data));
  r = await guest.call('feedback.php', { action: 'bot', token: 'bot-secret-token-123', text: '' }, 'POST', true);
  ck('бот с пустым текстом: 400', r.status === 400, JSON.stringify(r.data));
  r = await guest.call('feedback.php', { action: 'bot', token: 'bot-secret-token-123', text: 'Не работает выгрузка PDF', from_name: 'Иван (@ivan)', from_id: '12345', kind: 'problem' }, 'POST', true);
  ck('бот с верным токеном без сеанса: обращение записано', r.status === 200 && r.data.ok && r.data.id === 2, JSON.stringify(r.data));
  r = await admin.call('feedback.php?limit=50');
  const rows = r.data.rows || [];
  ck('список администратора: 2 обращения, telegram-канал с автором и tg-id, app-канал со страницей', rows.length === 2 && rows[0].channel === 'telegram' && /Иван/.test(rows[0].user_name) && rows[0].user_email === 'tg:12345' && rows[0].kind === 'problem' && rows[1].channel === 'app' && rows[1].page === 'geoanalytics', JSON.stringify(rows.map(x => [x.id, x.channel, x.user_name, x.kind])));
  r = await admin.call('feedback.php', { action: 'status', id: 1, status: 'done', reply: 'Слой парковок уже есть в «Слои и стиль»' });
  ck('status с ответом: ok', r.status === 200 && r.data.ok);
  r = await admin.call('feedback.php?mine=1');
  ck('«мои»: только своё обращение, со статусом done и ответом', r.data.rows.length === 1 && r.data.rows[0].status === 'done' && /Слой парковок уже/.test(r.data.rows[0].reply), JSON.stringify(r.data.rows));
  r = await admin.call('feedback.php?count=1');
  ck('count: новых 1 (осталось обращение из Telegram)', r.data['new'] === 1, JSON.stringify(r.data));

  console.log('--- 5. Демо-пользователь');
  const demo = jar(); await demo.call('auth.php');
  r = await demo.call('auth.php', { action: 'demo' });
  ck('демо-вход', r.status === 200 && r.data.auth === true && r.data.user && r.data.user.type === 'demo' && r.data.user.caps.offer_accepted === false, JSON.stringify(r.data && r.data.error));
  r = await demo.call('auth.php', { action: 'accept_offer' });
  ck('демо accept_offer: ok без записи', r.status === 200 && r.data.ok && r.data.demo === true, JSON.stringify(r.data));
  const demoRow = JSON.parse(sql("SELECT settings FROM app_users WHERE role_key='DEMO'"))[0];
  ck('в настройках демо согласие не сохранено', !demoRow || !/offer_accepted/.test(demoRow.settings || ''), demoRow && demoRow.settings);
  r = await demo.call('auth.php', { action: 'update_profile', name: 'Хакер Демо', profile: 'full' });
  ck('демо update_profile: 403', r.status === 403, JSON.stringify(r.data));
  r = await demo.call('auth.php', { action: 'change_password', old_password: 'x', password: 'newpass12345' });
  ck('демо change_password: 403', r.status === 403, JSON.stringify(r.data));
  r = await demo.call('feedback.php', { action: 'send', kind: 'question', text: 'Как получить полный доступ?' });
  ck('демо send: ok, канал demo', r.status === 200 && r.data.ok && /"channel":"demo"/.test(sql('SELECT channel FROM feedback WHERE id=' + r.data.id)), JSON.stringify(r.data));
  r = await demo.call('feedback.php?mine=1');
  ck('демо «мои»: своё обращение', r.data.rows.length === 1 && r.data.rows[0].kind === 'question');
  r = await demo.call('feedback.php?limit=50');
  ck('демо не видит чужие обращения (список = «мои»)', r.data.rows.length === 1);

  console.log('--- 6. users.php set_profile с профилем');
  const cl = JSON.parse(sql("SELECT id FROM app_users WHERE email='client@firm.test'"))[0];
  r = await admin.call('users.php', { action: 'approve', id: cl.id, expires_at: '2026-12-31', can_export: 1 });
  ck('заявка подтверждена', r.status === 200 && r.data.ok, JSON.stringify(r.data));
  r = await admin.call('users.php', { action: 'set_profile', id: cl.id, user_type: 'client', settings: { profile: 'asset', can_export: true } });
  ck('set_profile с профилем asset: ok', r.status === 200 && r.data.ok, JSON.stringify(r.data));
  const client = jar(); await client.call('auth.php');
  r = await client.call('auth.php', { action: 'login', email: 'client@firm.test', password: 'client12345' });
  ck('клиент вошёл: профиль asset в правах, оферта принята при регистрации версии 1.0, но текущая 1.1 не принята', r.status === 200 && r.data.user.caps.profile === 'asset' && r.data.user.caps.offer_accepted === false, JSON.stringify(r.data.user && r.data.user.caps));

  console.log('--- 7. v4.78.0: бесплатный доступ «Ищу офис»');
  const g2 = jar(); await g2.call('auth.php');
  r = await g2.call('auth.php', { action: 'register', name: 'Офис Искатель', email: 'office@seeker.test', password: 'seeker12345', company: 'ИП', phone: '', offer_accepted: true, purpose: 'office' });
  ck('регистрация с целью «ищу офис»: доступ открыт сразу (active, free)', r.status === 200 && r.data.ok && r.data.active === true && r.data.free === true && /Доступ открыт/.test(r.data.message), JSON.stringify(r.data));
  const fo = jar(); await fo.call('auth.php');
  r = await fo.call('auth.php', { action: 'login', email: 'office@seeker.test', password: 'seeker12345' });
  ck('вход бесплатного клиента: тип client, tier free, limited, без выгрузки и правок, профиль office, оферта принята', r.status === 200 && r.data.auth === true && r.data.user.caps.type === 'client' && r.data.user.caps.tier === 'free' && r.data.user.caps.limited === true && r.data.user.caps.export === false && r.data.user.caps.edit === false && r.data.user.caps.profile === 'office' && r.data.user.caps.offer_accepted === true && r.data.user.settings.purpose === 'office', JSON.stringify(r.data.user && r.data.user.caps));
  r = await fo.call('feedback.php', { action: 'send', kind: 'question', text: 'Хочу полный доступ' });
  ck('бесплатный клиент пишет обращение', r.status === 200 && r.data.ok);
  const seeker = JSON.parse(sql("SELECT id FROM app_users WHERE email='office@seeker.test'"))[0];
  r = await admin.call('users.php', { action: 'set_profile', id: seeker.id, user_type: 'client', settings: { tier: 'full', can_export: true } });
  ck('администратор переводит в полный уровень: ok', r.status === 200 && r.data.ok, JSON.stringify(r.data));
  r = await fo.call('auth.php');
  ck('после перевода: tier full, limited false, выгрузка разрешена, профиль office остался', r.data.user.caps.tier === 'full' && r.data.user.caps.limited === false && r.data.user.caps.export === true && r.data.user.caps.profile === 'office', JSON.stringify(r.data.user.caps));
  writeCfg('1.1', ", 'free_office_access' => false"); await sleep(2600); /* opcache встроенного сервера перечитывает файл раз в 2 с */
  r = await g2.call('auth.php', { action: 'register', name: 'Второй Искатель', email: 'office2@seeker.test', password: 'seeker12345', offer_accepted: true, purpose: 'office' });
  ck('free_office_access выключен: заявка «ищу офис» ждёт администратора', r.status === 200 && r.data.pending === true && !r.data.active, JSON.stringify(r.data));
  const s2 = JSON.parse(JSON.parse(sql("SELECT settings FROM app_users WHERE email='office2@seeker.test'"))[0].settings);
  ck('в настройках заявки цель office без tier free', s2.purpose === 'office' && s2.registration_pending === 1 && s2.tier !== 'free', JSON.stringify(s2));
  r = await g2.call('auth.php', { action: 'register', name: 'Девелопер Один', email: 'dev@firm.test', password: 'devdev12345', offer_accepted: true, purpose: 'developer' });
  ck('цель «девелопер»: заявка ждёт администратора', r.status === 200 && r.data.pending === true, JSON.stringify(r.data));

  php.kill();
  const errLog = phpLog.split('\n').filter(l => /PHP (Fatal|Warning|Parse|Notice)/.test(l));
  ck('PHP без предупреждений и ошибок', errLog.length === 0, errLog.slice(0, 3).join(' | ') || 'нет');
  console.log(bad ? '\nПРОВАЛЕНО проверок: ' + bad : '\nВсе проверки v4.77.0 (API) прошли');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('СБОЙ', e); process.exit(1); });
