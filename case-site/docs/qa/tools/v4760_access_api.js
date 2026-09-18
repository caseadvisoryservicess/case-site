/* v4.76.0: модель доступа на настоящем PHP API (встроенный сервер php -S, база SQLite).

   Что проверяется:
     1. Экран входа получает флаги регистрации и демо; регистрация создаёт отключённого клиента,
        повторная заявка отвечает так же (без оракула адресов), вход по неподтверждённой заявке
        объясняет причину, неверный пароль отвечает 401.
     2. Демо-вход: роль DEMO, тип demo, права без выгрузки и правок; сохранение состояния и
        геоданных отвечает 403; демо-пользователь создаётся один раз.
     3. Администратор: тип admin, список пользователей содержит тип, срок и настройки (колонки
        дочинились сами на старой схеме); подтверждение заявки открывает доступ клиенту с датой и
        выгрузкой; клиент входит, видит days_left и права; истёкший срок закрывает вход (403) и
        текущий сеанс (auth: false, expired), учётная запись и данные остаются; срок «сегодня»
        ещё действует (days_left 0); журнал пользователя показывает его действия.
     4. Корзина геоданных: строка, пропавшая при сохранении, попадает в корзину с автором;
        восстановление возвращает её в набор; клиент без права правок геоданные не пишет.

   Запуск: node v4760_access_api.js [папка os] */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case_access_'));
  const apiDir = path.join(dir, 'api'); fs.mkdirSync(apiDir);
  for (const f of fs.readdirSync(path.join(OS, 'api'))) if (/\.php$/.test(f) && !/^config(\.|\.local)/.test(f)) fs.copyFileSync(path.join(OS, 'api', f), path.join(apiDir, f));
  fs.writeFileSync(path.join(apiDir, 'mode.php'), "<?php return ['mode' => 'geo'];");
  const dbPath = path.join(dir, 'db.sqlite');
  fs.writeFileSync(path.join(apiDir, 'config.php'), "<?php return ['driver' => 'sqlite', 'sqlite_path' => " + JSON.stringify(dbPath) + ", 'platform_mode' => 'geo'];");
  /* старая схема: app_users без колонок типа, срока и настроек; их должен дочинить сам код */
  const boot = path.join(dir, 'boot.php');
  fs.writeFileSync(boot, `<?php
$p = new PDO('sqlite:' . ${JSON.stringify(dbPath)}); $p->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$p->exec("CREATE TABLE roles (\`key\` TEXT PRIMARY KEY, label TEXT NOT NULL, leasing INTEGER DEFAULT 0, finance INTEGER DEFAULT 0, edit INTEGER DEFAULT 0, approve INTEGER DEFAULT 0, plans INTEGER DEFAULT 0, own_only INTEGER DEFAULT 0, project_scope INTEGER DEFAULT 0, admin INTEGER DEFAULT 0)");
$p->exec("CREATE TABLE app_users (id TEXT PRIMARY KEY, email TEXT UNIQUE, password_hash TEXT, name TEXT NOT NULL, title TEXT, role_key TEXT NOT NULL, broker_name TEXT, projects TEXT, active INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)");
$p->exec("CREATE TABLE audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, by_id TEXT, by_name TEXT, role_key TEXT, action TEXT, detail TEXT, at TEXT DEFAULT CURRENT_TIMESTAMP)");
$p->exec("CREATE TABLE app_state (id INTEGER PRIMARY KEY, data TEXT, updated_at TEXT, updated_by TEXT, revision INTEGER NOT NULL DEFAULT 0)");
$p->exec("INSERT INTO roles VALUES ('ASH','Генеральный директор',1,1,1,1,1,0,0,1)");
$p->exec("INSERT INTO roles VALUES ('AG','Агент аренды',1,0,1,0,0,0,0,0)");
$st = $p->prepare("INSERT INTO app_users (id,email,password_hash,name,title,role_key) VALUES (?,?,?,?,?,?)");
$st->execute(['u-admin','admin@case.test',password_hash('admin12345',PASSWORD_DEFAULT),'Админ Тестов','CEO','ASH']);
$st->execute(['u-emp','emp@case.test',password_hash('emp12345',PASSWORD_DEFAULT),'Сотрудник Тестов','агент','AG']);
echo "ok";`);
  const bootOut = execSync('php ' + JSON.stringify(boot), { encoding: 'utf8' });
  ck('база SQLite подготовлена по старой схеме (без колонок типа и срока)', bootOut.trim() === 'ok', bootOut.slice(0, 120));

  const port = 18000 + Math.floor(Math.random() * 2000);
  const php = spawn('php', ['-S', '127.0.0.1:' + port, '-t', apiDir], { stdio: ['ignore', 'pipe', 'pipe'] });
  let phpLog = ''; php.stderr.on('data', d => { phpLog += d; }); php.stdout.on('data', d => { phpLog += d; });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 40; i++) { try { await fetch(base + '/health.php'); break; } catch (e) { await sleep(150); } }

  /* клиент с cookie и CSRF на каждую роль */
  function jar() {
    const j = { cookie: '', csrf: '' };
    j.call = async (ep, body, method) => {
      const opt = { method: method || (body ? 'POST' : 'GET'), headers: { 'Accept': 'application/json', 'Origin': base, 'Cookie': j.cookie } };
      if (body) { opt.headers['Content-Type'] = 'application/json'; opt.headers['X-CSRF-Token'] = j.csrf; opt.body = JSON.stringify(body); }
      const r = await fetch(base + '/' + ep, opt);
      const sc = r.headers.get('set-cookie'); if (sc) { const m = sc.match(/caseos=([^;]+)/); if (m) j.cookie = 'caseos=' + m[1]; }
      let data = null; try { data = await r.json(); } catch (e) { data = null; }
      if (data && data.csrf) j.csrf = data.csrf;
      return { status: r.status, data };
    };
    return j;
  }

  console.log('--- 1. Экран входа, регистрация');
  const guest = jar();
  let r = await guest.call('auth.php');
  ck('без сеанса: auth false, флаги регистрации и демо, режим geo', r.status === 200 && r.data && r.data.auth === false && r.data.registration === true && r.data.demo_login === true && r.data.mode === 'geo', JSON.stringify(r.data));
  r = await guest.call('auth.php', { action: 'register', name: 'Клиент Пробный', email: 'client@firm.test', password: 'client12345', company: 'Фирма', phone: '+998 90 000 00 00', offer_accepted: true });
  ck('заявка принята: pending, понятное сообщение', r.status === 200 && r.data && r.data.ok && r.data.pending && /Заявка принята/.test(r.data.message), JSON.stringify(r.data));
  const again = await guest.call('auth.php', { action: 'register', name: 'Клиент Пробный', email: 'client@firm.test', password: 'other12345', offer_accepted: true });
  ck('повторная заявка на тот же email отвечает так же (без оракула адресов)', again.status === 200 && again.data && again.data.pending && again.data.message === r.data.message);
  r = await guest.call('auth.php', { action: 'register', name: 'К', email: 'bad', password: '123', offer_accepted: true });
  ck('короткое имя, плохой email, короткий пароль отклоняются', r.status === 400);
  r = await guest.call('auth.php', { action: 'login', email: 'client@firm.test', password: 'client12345' });
  ck('вход по неподтверждённой заявке: 403 с объяснением', r.status === 403 && /не подтверждена/.test(r.data && r.data.error || ''), JSON.stringify(r.data));
  r = await guest.call('auth.php', { action: 'login', email: 'client@firm.test', password: 'wrong-wrong' });
  ck('неверный пароль: 401 без подробностей', r.status === 401 && /Неверный логин или пароль/.test(r.data && r.data.error || ''));

  console.log('--- 2. Демо-вход');
  const demo = jar();
  await demo.call('auth.php');
  r = await demo.call('auth.php', { action: 'demo' });
  ck('демо-вход: пользователь типа demo, роль DEMO, без выгрузки и правок', r.status === 200 && r.data && r.data.auth && r.data.user.type === 'demo' && r.data.user.role === 'DEMO' && r.data.user.caps.export === false && r.data.user.caps.edit === false && r.data.user.demo === true, JSON.stringify(r.data && r.data.user));
  r = await demo.call('auth.php');
  ck('сеанс демо держится: auth true, тот же тип', r.data && r.data.auth === true && r.data.user.type === 'demo');
  r = await demo.call('state.php', { data: { GEO_PREFS: { a: 1 } } });
  ck('демо не сохраняет состояние: 403 с объяснением', r.status === 403 && /Демо-доступ/.test(r.data && r.data.error || ''), JSON.stringify(r.data));
  r = await demo.call('geo_state.php', { data: { datasets: {}, projects: [] } });
  ck('демо не пишет геоданные: 403', r.status === 403, JSON.stringify(r.data));
  const demo2 = jar(); await demo2.call('auth.php'); r = await demo2.call('auth.php', { action: 'demo' });
  ck('второй демо-вход использует ту же учётную запись', r.status === 200 && r.data.user.email === 'demo@caseadvisory.local');
  await demo.call('auth.php', { action: 'logout' });

  console.log('--- 3. Администратор, подтверждение, срок');
  const admin = jar();
  await admin.call('auth.php');
  r = await admin.call('auth.php', { action: 'login', email: 'admin@case.test', password: 'admin12345' });
  ck('администратор входит: тип admin, выгрузка и правки, без срока', r.status === 200 && r.data.user.type === 'admin' && r.data.user.caps.export === true && r.data.user.caps.edit === true && r.data.user.days_left === null, JSON.stringify(r.data && r.data.user && r.data.user.caps));
  r = await admin.call('data.php?table=app_users');
  const rows = (r.data && r.data.rows) || [];
  const client = rows.find(u => u.email === 'client@firm.test'), demoRow = rows.find(u => u.role_key === 'DEMO');
  ck('список пользователей: заявитель отключён, тип client, настройки с флагом заявки и компанией; демо-пользователь создан', !!client && +client.active === 0 && client.user_type === 'client' && client.settings && client.settings.registration_pending === 1 && client.settings.company === 'Фирма' && !!demoRow && demoRow.user_type === 'demo', JSON.stringify({ client, demoRow }).slice(0, 300));
  const d = n => { const t = new Date(Date.now() + n * 86400000); return t.toISOString().slice(0, 10); };
  r = await admin.call('users.php', { action: 'approve', id: client.id, expires_at: d(10), can_export: 1 });
  ck('заявка подтверждена: доступ до +10 дней, выгрузка разрешена', r.status === 200 && r.data.ok && String(r.data.expires_at).slice(0, 10) === d(10), JSON.stringify(r.data));
  const cl = jar(); await cl.call('auth.php');
  r = await cl.call('auth.php', { action: 'login', email: 'client@firm.test', password: 'client12345' });
  ck('клиент входит: тип client, роль CL, days_left 9 или 10, выгрузка да, правки нет', r.status === 200 && r.data.user.type === 'client' && r.data.user.role === 'CL' && (r.data.user.days_left === 9 || r.data.user.days_left === 10) && r.data.user.caps.export === true && r.data.user.caps.edit === false, JSON.stringify(r.data && r.data.user));
  r = await cl.call('geo_state.php', { data: { datasets: {}, projects: [] } });
  ck('клиент без права правок геоданные не пишет: 403', r.status === 403, JSON.stringify(r.data));
  r = await cl.call('geo_state.php');
  ck('клиент читает геоданные (студия доступна)', r.status === 200 && r.data && 'data' in r.data);
  r = await admin.call('users.php', { action: 'set_profile', id: client.id, user_type: 'client', expires_at: d(-1), settings: { can_export: false, note: 'проверка' } });
  ck('администратор ставит вчерашний срок и снимает выгрузку', r.status === 200 && r.data.ok && r.data.settings.can_export === false && r.data.settings.note === 'проверка', JSON.stringify(r.data));
  r = await cl.call('auth.php');
  ck('текущий сеанс клиента закрыт: auth false, expired, объяснение', r.data && r.data.auth === false && r.data.expired === true && /истёк/.test(r.data.message || ''), JSON.stringify(r.data));
  r = await cl.call('auth.php', { action: 'login', email: 'client@firm.test', password: 'client12345' });
  ck('вход с истёкшим сроком: 403, данные сохранены', r.status === 403 && /Срок доступа истёк/.test(r.data && r.data.error || '') && /сохранены/.test(r.data.error), JSON.stringify(r.data));
  r = await admin.call('data.php?table=app_users');
  ck('учётная запись клиента после истечения не удалена и активна', !!(r.data.rows || []).find(u => u.email === 'client@firm.test' && +u.active === 1));
  r = await admin.call('users.php', { action: 'set_profile', id: client.id, user_type: 'client', expires_at: d(0), settings: { can_export: true } });
  r = await cl.call('auth.php', { action: 'login', email: 'client@firm.test', password: 'client12345' });
  ck('срок «сегодня» ещё действует: вход есть, days_left 0', r.status === 200 && r.data.user.days_left === 0, JSON.stringify(r.data && r.data.user && { d: r.data.user.days_left, e: r.data.user.expires_at }));
  r = await admin.call('users.php', { action: 'set_profile', id: client.id, user_type: 'client', expires_at: '' });
  r = await cl.call('auth.php');
  ck('без срока доступ бессрочный: days_left null', r.data && r.data.auth === true && r.data.user.days_left === null);
  r = await admin.call('users.php', { action: 'set_profile', id: client.id, user_type: 'boss' });
  ck('неизвестный тип доступа отклоняется', r.status === 400);
  r = await admin.call('users.php', { action: 'log', id: client.id });
  const acts = ((r.data && r.data.rows) || []).map(x => x.action);
  ck('журнал клиента: входы и отказ по сроку', acts.some(a => /Вход в систему/.test(a)) && acts.some(a => /срок доступа истёк/i.test(a)), acts.slice(0, 6).join(' | '));
  const cl2 = jar(); await cl2.call('auth.php'); r = await cl2.call('users.php', { action: 'log', id: client.id });
  ck('журнал без входа: 401', r.status === 401);
  r = await cl.call('users.php', { action: 'log', id: client.id });
  ck('журнал для клиента закрыт: только администратор', r.status === 403);

  console.log('--- 4. Корзина геоданных');
  r = await admin.call('geo_state.php', { data: { datasets: { bc: [{ master_id: 'X1', name: 'Alpha' }, { master_id: 'X2', name: 'Beta', address: 'ул. Тестовая' }] }, projects: [] }, reason: 'тест' });
  ck('администратор сохраняет два объекта', r.status === 200 && r.data.ok, JSON.stringify(r.data && r.data.error));
  r = await admin.call('geo_state.php', { data: { datasets: { bc: [{ master_id: 'X1', name: 'Alpha' }] }, projects: [] }, reason: 'удаление Beta' });
  ck('сохранение без Beta проходит', r.status === 200 && r.data.ok);
  r = await admin.call('geo_state.php?trash=1');
  const tr = (r.data && r.data.trash) || [];
  ck('корзина: одна запись Beta с автором и временем, не восстановлена', tr.length === 1 && tr[0].title === 'Beta' && tr[0].dataset === 'bc' && tr[0].deleted_by === 'Админ Тестов' && !tr[0].restored_at && !!tr[0].deleted_at, JSON.stringify(tr));
  r = await cl.call('geo_state.php?trash=1');
  ck('корзина для клиента закрыта: 403', r.status === 403);
  r = await admin.call('geo_state.php', { action: 'restore_trash', trash_id: tr[0].id });
  ck('восстановление проходит', r.status === 200 && r.data.ok, JSON.stringify(r.data));
  r = await admin.call('geo_state.php');
  const bc = (((r.data || {}).data || {}).datasets || {}).bc || [];
  ck('Beta вернулась в набор с адресом, Alpha на месте', bc.length === 2 && bc.some(x => x.name === 'Beta' && x.address === 'ул. Тестовая') && bc.some(x => x.name === 'Alpha'), JSON.stringify(bc));
  r = await admin.call('geo_state.php?trash=1');
  ck('запись корзины помечена восстановленной', r.data.trash.length === 1 && !!r.data.trash[0].restored_at && r.data.trash[0].restored_by === 'Админ Тестов');
  r = await admin.call('geo_state.php', { action: 'restore_trash', trash_id: tr[0].id });
  ck('повторное восстановление: 409', r.status === 409);
  r = await admin.call('users.php', { action: 'log', id: 'u-admin' });
  const aacts = ((r.data && r.data.rows) || []).map(x => x.action + ' ' + (x.detail || ''));
  ck('журнал администратора: сохранение с числом удалённых строк и восстановление', aacts.some(a => /Геоданные сохранены.*удалено строк=1/.test(a)) && aacts.some(a => /Корзина: запись восстановлена/.test(a)), aacts.slice(0, 5).join(' | '));

  console.log('--- 5. Итог');
  ck('PHP не писал ошибок и предупреждений', !/Warning|Fatal|Notice|Deprecated/.test(phpLog), phpLog.split('\n').filter(l => /Warning|Fatal|Notice|Deprecated/.test(l)).slice(0, 3).join(' | ') || 'чисто');
  php.kill();
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log('\n' + (bad ? bad + ' проблем' : 'Модель доступа на PHP API работает: регистрация, демо, подписка, журнал, корзина'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
