<?php
// CASE OS — управление пользователями (только admin): создание + смена пароля.
require __DIR__.'/lib.php';
require_login();
if (!can('admin')) fail('Только администратор', 403);
$b = body(); $a = $b['action'] ?? '';
if ($a==='create') {
  $email = mb_strtolower(trim($b['email'] ?? '')); $pass = (string)($b['password'] ?? '');
  if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Укажите корректный email', 400);
  if (strlen($pass) < 8) fail('Пароль минимум 8 символов', 400);
  // дубликат — честная ошибка, а не тихий сбой
  $st = db()->prepare('SELECT id,name,active FROM app_users WHERE LOWER(email)=?'); $st->execute([$email]);
  if ($ex = $st->fetch()) fail('Сотрудник с email '.$email.' уже есть в базе ('.$ex['name'].($ex['active']?'':', отключён').'). Обновите список пользователей (F5).', 409);
  $role = (string)($b['role'] ?? 'AG');
  $rs = db()->prepare('SELECT `key` FROM roles WHERE `key`=?'); $rs->execute([$role]);
  if (!$rs->fetch()) fail('Неизвестная роль пользователя', 400);
  $id = uuid();
  $projects = is_array($b['projects'] ?? null) ? json_encode(array_values($b['projects']), JSON_UNESCAPED_UNICODE) : null;
  $ins = function() use ($id,$email,$pass,$b,$projects,$role) {
    db()->prepare('INSERT INTO app_users (id,email,password_hash,name,title,role_key,broker_name,projects,active) VALUES (?,?,?,?,?,?,?,?,1)')
      ->execute([$id,$email,password_hash($pass,PASSWORD_DEFAULT),trim($b['name']??$email),trim($b['title']??''),$role,($b['broker']??null),$projects]);
  };
  try { $ins(); }
  catch (Throwable $e) {
    // старые установки: в app_users могут отсутствовать колонки projects/broker_name/title — дочиним и повторим
    foreach (['projects'=>'TEXT NULL','broker_name'=>'VARCHAR(190) NULL','title'=>'VARCHAR(190) NULL'] as $col=>$def) {
      try { db()->exec('ALTER TABLE app_users ADD COLUMN '.$col.' '.$def); } catch (Throwable $e2) {}
    }
    // FOREIGN KEY role_key → roles: если миграция с новой ролью не применялась, строки роли нет — добавим
    try {
      $role = (string)($b['role'] ?? 'AG'); $label = trim($b['title'] ?? '') ?: $role;
      $ig = (cfg()['driver'] ?? 'mysql') === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
      db()->prepare($ig.' INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin) VALUES (?,?,1,0,1,0,0,0,0,0)')
        ->execute([$role, $label]);
    } catch (Throwable $e2) {}
    try { $ins(); }
    catch (Throwable $e3) { fail('Не удалось создать пользователя: '.$e3->getMessage().'. Нажмите «Применить миграции» (Пользователи → Обновление базы данных) и повторите.', 500); }
  }
  // страховка от autocommit=0 на хостинге: без явного COMMIT вставка откатится при закрытии соединения
  try { db()->exec('COMMIT'); } catch (Throwable $eC) {}
  // контрольное чтение ЧЕРЕЗ НОВОЕ СОЕДИНЕНИЕ (как следующий запрос браузера):
  // ловит битую таблицу/квоту/непроходящий COMMIT — когда вставка «проходит», а строка не сохраняется
  $found = null; $verr = '';
  try {
    $c = cfg();
    if (($c['driver'] ?? 'mysql') === 'sqlite') $pdo2 = new PDO('sqlite:'.$c['sqlite_path']);
    else $pdo2 = new PDO("mysql:host={$c['host']};dbname={$c['name']};charset=".($c['charset']??'utf8mb4'), $c['user'], $c['pass']);
    $pdo2->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $st = $pdo2->prepare('SELECT id FROM app_users WHERE id=?'); $st->execute([$id]);
    $found = (bool)$st->fetch();
    $st->closeCursor(); $st = null; $pdo2 = null; // освободить read-lock (sqlite) до следующих записей
  } catch (Throwable $ev) { $verr = $ev->getMessage(); }
  if ($found === null) {
    // второе соединение не открылось (например, лимит max_user_connections) — проверяем хотя бы своим
    try { $st = db()->prepare('SELECT id FROM app_users WHERE id=?'); $st->execute([$id]); $found = (bool)$st->fetch(); }
    catch (Throwable $e4) { $found = true; /* проверить нечем — не блокируем создание */ }
    if ($verr) $verr = ' (доп. соединение: '.$verr.')';
  }
  if (!$found) fail('Сбой записи: пользователь не сохранился в базе — вставка прошла, но строка не видна повторному чтению'.$verr.'. Нажмите «Диагностика базы» в разделе Пользователи и покажите результат в поддержку хостинга.', 500);
  audit('Создан пользователь', $email);
  json_out(['ok'=>true,'id'=>$id]);
}
if ($a==='change_email') {
  // v4.17.0: админ может изменить логин (email). Внутренний id неизменен — история не отвязывается.
  $uid = (string)($b['id'] ?? '');
  $email = mb_strtolower(trim($b['email'] ?? ''));
  if (!$uid) fail('Нужен id пользователя', 400);
  if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Укажите корректный email', 400);
  $st = db()->prepare('SELECT id,email FROM app_users WHERE id=?'); $st->execute([$uid]);
  $cur = $st->fetch();
  if (!$cur) fail('Пользователь не найден', 404);
  $old = mb_strtolower((string)$cur['email']);
  if ($old === $email) json_out(['ok'=>true,'unchanged'=>true]);
  // уникальность среди других пользователей
  $du = db()->prepare('SELECT id,name FROM app_users WHERE LOWER(email)=? AND id<>?'); $du->execute([$email,$uid]);
  if ($ex = $du->fetch()) fail('Email '.$email.' уже занят пользователем «'.$ex['name'].'».', 409);
  db()->prepare('UPDATE app_users SET email=? WHERE id=?')->execute([$email,$uid]);
  try { db()->exec('COMMIT'); } catch (Throwable $e) {}
  audit('Изменён логин (email) пользователя', $uid.': '.$old.' → '.$email);
  json_out(['ok'=>true,'old'=>$old,'email'=>$email]);
}
if ($a==='set_archived') {
  // Архив: пользователь скрыт из активных списков, но данные и история сохранены. Реализуется колонкой archived (при отсутствии — добавляем).
  $uid = (string)($b['id'] ?? ''); $arch = !empty($b['archived']) ? 1 : 0;
  if (!$uid) fail('Нужен id пользователя', 400);
  if ($uid === (string)(current_user()['id'] ?? '') && $arch) fail('Нельзя архивировать собственную учётную запись', 400);
  $run = function() use ($uid,$arch) { db()->prepare('UPDATE app_users SET archived=?'.($arch?', active=0':'').' WHERE id=?')->execute([$arch,$uid]); };
  try { $run(); }
  catch (Throwable $e) { try { db()->exec('ALTER TABLE app_users ADD COLUMN archived TINYINT NOT NULL DEFAULT 0'); } catch (Throwable $e2) {} $run(); }
  try { db()->exec('COMMIT'); } catch (Throwable $e) {}
  audit('Пользователь '.($arch?'архивирован':'восстановлен из архива'), $uid);
  json_out(['ok'=>true]);
}
if ($a==='delete_user') {
  // Полное удаление — только для учёток без значимых связанных данных. Клиент выполняет проверку связей и
  // не предлагает hard-delete при их наличии; сервер защищает от удаления самого себя и требует явного подтверждения.
  $uid = (string)($b['id'] ?? '');
  if (!$uid) fail('Нужен id пользователя', 400);
  if ($uid === (string)(current_user()['id'] ?? '')) fail('Нельзя удалить собственную учётную запись', 400);
  if (empty($b['confirm'])) fail('Требуется подтверждение (confirm)', 400);
  $st = db()->prepare('SELECT email,name FROM app_users WHERE id=?'); $st->execute([$uid]);
  $u = $st->fetch();
  if (!$u) json_out(['ok'=>true,'already'=>true]);
  db()->prepare('DELETE FROM app_users WHERE id=?')->execute([$uid]);
  try { db()->exec('COMMIT'); } catch (Throwable $e) {}
  audit('Удалён пользователь', $uid.' · '.$u['email'].' · '.$u['name']);
  json_out(['ok'=>true]);
}
if ($a==='setpass') {
  $uid = $b['id'] ?? ''; $pass = (string)($b['password'] ?? '');
  if (!$uid || strlen($pass) < 8) fail('Нужны id и пароль (мин. 8 символов)', 400);
  db()->prepare('UPDATE app_users SET password_hash=? WHERE id=?')->execute([password_hash($pass,PASSWORD_DEFAULT),$uid]);
  audit('Смена пароля пользователя', (string)$uid);
  json_out(['ok'=>true]);
}
fail('Неизвестное действие', 400);
