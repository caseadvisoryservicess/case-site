<?php
// CASE OS — диагностика базы и файлов (только админ).
// Помогает найти причину «сервер сказал “создан”, а строки в базе нет»:
// битая таблица, не залившиеся при обновлении файлы, кэш PHP, другая БД.
require __DIR__.'/lib.php';
require_login();
if (!can('admin')) fail('Только администратор', 403);

$out = ['ok'=>true, 'php'=>PHP_VERSION, 'time'=>date('Y-m-d H:i:s')];
$c = cfg();
$out['db'] = ['driver'=>($c['driver']??'mysql'), 'name'=>($c['name']??''), 'host'=>($c['host']??'')];
try { $out['db']['server'] = db()->getAttribute(PDO::ATTR_SERVER_VERSION); } catch (Throwable $e) {}
if (($c['driver'] ?? 'mysql') === 'mysql') { // режимы MySQL, из-за которых вставки могут «испаряться» или блокироваться
  try { $out['db']['autocommit'] = (int)db()->query('SELECT @@autocommit')->fetchColumn(); } catch (Throwable $e) {}
  try { $out['db']['isolation'] = (string)db()->query('SELECT @@transaction_isolation')->fetchColumn(); }
  catch (Throwable $e) { try { $out['db']['isolation'] = (string)db()->query('SELECT @@tx_isolation')->fetchColumn(); } catch (Throwable $e2) {} }
  try { $out['db']['max_user_connections'] = (int)db()->query('SELECT @@max_user_connections')->fetchColumn(); } catch (Throwable $e) {}
}

// Файлы API: контрольные суммы и даты — ловим не обновившиеся при заливке файлы
foreach (['users.php','data.php','lib.php','auth.php','state.php','migrate.php'] as $f) {
  $p = __DIR__.'/'.$f;
  $out['files'][$f] = is_file($p) ? ['md5'=>substr(md5_file($p),0,10), 'изменён'=>date('Y-m-d H:i', filemtime($p))] : 'НЕТ ФАЙЛА';
}
$out['opcache'] = function_exists('opcache_get_status') ? (bool)(opcache_get_status(false)['opcache_enabled'] ?? false) : 'n/a';

// Таблица app_users: движок, колонки, сколько строк и какие email внутри
try { db()->exec("DELETE FROM app_users WHERE email LIKE 'diag.%@test.local'"); } catch (Throwable $e0) {} // следы прошлых проверок — до снятия списка
try {
  if (($c['driver']??'mysql') === 'mysql') {
    $st = db()->query("SHOW TABLE STATUS LIKE 'app_users'"); $r = $st->fetch();
    $out['app_users']['engine'] = $r['Engine'] ?? '?';
    $cols = db()->query('SHOW COLUMNS FROM app_users')->fetchAll();
    $out['app_users']['columns'] = array_map(function($x){ return $x['Field']; }, $cols);
  } else {
    $out['app_users']['engine'] = 'sqlite';
    $cols = db()->query('PRAGMA table_info(app_users)')->fetchAll();
    $out['app_users']['columns'] = array_map(function($x){ return $x['name']; }, $cols);
  }
  $out['app_users']['count'] = (int)db()->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
  $out['app_users']['list'] = db()->query('SELECT email, role_key, active FROM app_users')->fetchAll();
} catch (Throwable $e) { $out['app_users']['error'] = $e->getMessage(); }

// Тест записи: вставляем строку, читаем её ЧЕРЕЗ НОВОЕ СОЕДИНЕНИЕ (как следующий запрос), удаляем
try {
  $id = uuid(); $email = 'diag.'.substr($id,0,8).'@test.local';
  db()->prepare('INSERT INTO app_users (id,email,password_hash,name,title,role_key,active) VALUES (?,?,?,?,?,?,0)')
    ->execute([$id, $email, 'x', 'Диагностика', '', 'AG']);
  try { db()->exec('COMMIT'); } catch (Throwable $eC) {} // как в создании пользователя — страховка от autocommit=0
  if (($c['driver']??'mysql') === 'sqlite') $pdo2 = new PDO('sqlite:'.$c['sqlite_path']);
  else $pdo2 = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=".($c['charset']??'utf8mb4'), $c['user'], $c['pass']);
  $pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $st = $pdo2->prepare('SELECT 1 FROM app_users WHERE id=?'); $st->execute([$id]);
  $seen = (bool)$st->fetchColumn();
  $st->closeCursor(); $st = null; $pdo2 = null; // освободить read-lock (sqlite), иначе DELETE ждёт таймаут
  db()->prepare('DELETE FROM app_users WHERE id=?')->execute([$id]);
  $out['write_test'] = $seen
    ? 'OK — вставка видна из нового соединения'
    : 'ПРОБЛЕМА: вставленная строка НЕ видна из нового соединения (битая таблица app_users, переполнение квоты или подключение к другой БД). Обратитесь в поддержку хостинга: REPAIR/проверка таблицы app_users в базе '.$c['name'].'.';
} catch (Throwable $e) { $out['write_test'] = 'ОШИБКА записи: '.$e->getMessage(); }

json_out($out);
