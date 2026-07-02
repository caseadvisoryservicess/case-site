<?php
// CASE OS — вход / выход / текущий пользователь.
require __DIR__.'/lib.php';

function publicUser(array $u): array {
  return ['id'=>$u['id'],'email'=>$u['email'],'name'=>$u['name'],'title'=>$u['title'],
          'role'=>$u['role_key'],'role_label'=>$u['role_label'],'broker'=>$u['broker_name'],
          'projects'=>is_array($u['projects'] ?? null) ? $u['projects'] : []];
}
function rightsOf(array $u): array {
  return ['leasing'=>(bool)$u['leasing'],'finance'=>(bool)$u['finance'],'edit'=>(bool)$u['edit'],
          'approve'=>(bool)$u['approve'],'plans'=>(bool)$u['plans'],'own_only'=>(bool)$u['own_only'],
          'project_scope'=>(bool)$u['project_scope'],'admin'=>(bool)$u['admin']];
}

if ($_SERVER['REQUEST_METHOD']==='GET') {
  $u = current_user();
  if (!$u || !$u['active']) json_out(['auth'=>false]);
  json_out(['auth'=>true,'user'=>publicUser($u),'rights'=>rightsOf($u)]);
}

// Отправка письма с кодом. На cPanel работает штатный mail(); при необходимости
// адрес отправителя задаётся в config.php: 'mail_from' => 'no-reply@ваш-домен'.
// Для локальной отладки: 'mail_debug_file' => '/путь/файл' — код пишется в файл.
function send_login_code(string $email, string $code): bool {
  $cfg = cfg();
  $subject = '=?UTF-8?B?'.base64_encode('Код входа в CASE OS').'?=';
  $body = "Ваш код для входа в CASE OS: $code\n\nКод действует 10 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.";
  $from = $cfg['mail_from'] ?? ('no-reply@'.preg_replace('/^www\./','',$_SERVER['HTTP_HOST'] ?? 'caseadvisory.uz'));
  $headers = "From: CASE OS <$from>\r\nContent-Type: text/plain; charset=utf-8\r\nMIME-Version: 1.0";
  $sent = false;
  try { $sent = @mail($email, $subject, $body, $headers); } catch (Throwable $e) {}
  if (!empty($cfg['mail_debug_file'])) { @file_put_contents($cfg['mail_debug_file'], date('c')." $email $code\n", FILE_APPEND); $sent = true; }
  return (bool)$sent;
}

$b = body(); $a = $b['action'] ?? '';
if ($a==='login') {
  $email = trim($b['email'] ?? ''); $pass = (string)($b['password'] ?? '');
  $st = db()->prepare('SELECT * FROM app_users WHERE email=? AND active=1');
  $st->execute([$email]); $row = $st->fetch();
  if (!$row || !password_verify($pass, $row['password_hash'] ?? '')) fail('Неверный логин или пароль', 401);
  session_regenerate_id(true);
  $_SESSION['uid'] = $row['id'];
  audit('Вход в систему', 'роль: '.$row['role_key']);
  $u = current_user();
  json_out(['auth'=>true,'user'=>publicUser($u),'rights'=>rightsOf($u)]);
}
if ($a==='request_code') {
  $email = mb_strtolower(trim($b['email'] ?? ''));
  if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Укажите корректный email', 400);
  $st = db()->prepare('SELECT id FROM app_users WHERE LOWER(email)=? AND active=1');
  $st->execute([$email]);
  if (!$st->fetch()) fail('Этот email не зарегистрирован в системе (или учётка отключена). Обратитесь к администратору.', 404);
  // не чаще одного кода в минуту
  try { $st = db()->prepare('SELECT created_at FROM login_codes WHERE email=?'); $st->execute([$email]); }
  catch (Throwable $e) { fail('Вход по коду ещё не активирован: администратору нужно один раз нажать «Применить миграции» (Пользователи → Обновление базы данных). Пока войдите по паролю.', 503); }
  $prev = $st->fetch();
  if ($prev && strtotime($prev['created_at']) > time() - 60) fail('Код уже отправлен. Подождите минуту и попробуйте снова (проверьте папку «Спам»).', 429);
  $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  db()->prepare('DELETE FROM login_codes WHERE email=?')->execute([$email]);
  db()->prepare('INSERT INTO login_codes (email,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,0,?)')
    ->execute([$email, password_hash($code, PASSWORD_DEFAULT), date('Y-m-d H:i:s', time()+600), date('Y-m-d H:i:s')]);
  if (!send_login_code($email, $code)) fail('Не удалось отправить письмо. Попробуйте вход по паролю или обратитесь к администратору.', 500);
  audit('Запрошен код входа', $email);
  json_out(['ok'=>true]);
}
if ($a==='verify_code') {
  $email = mb_strtolower(trim($b['email'] ?? '')); $code = trim((string)($b['code'] ?? ''));
  if (!$email || !$code) fail('Укажите email и код из письма', 400);
  $st = db()->prepare('SELECT * FROM login_codes WHERE email=?');
  $st->execute([$email]); $lc = $st->fetch();
  if (!$lc) fail('Код не запрошен или уже использован. Нажмите «Получить код».', 400);
  if (strtotime($lc['expires_at']) < time()) { db()->prepare('DELETE FROM login_codes WHERE email=?')->execute([$email]); fail('Код истёк. Запросите новый.', 400); }
  if ((int)$lc['attempts'] >= 5) { db()->prepare('DELETE FROM login_codes WHERE email=?')->execute([$email]); audit('Код входа: превышены попытки', $email); fail('Слишком много неверных попыток. Запросите новый код.', 429); }
  if (!password_verify($code, $lc['code_hash'] ?? '')) {
    db()->prepare('UPDATE login_codes SET attempts=attempts+1 WHERE email=?')->execute([$email]);
    fail('Неверный код. Проверьте письмо и попробуйте ещё раз.', 401);
  }
  db()->prepare('DELETE FROM login_codes WHERE email=?')->execute([$email]);
  $st = db()->prepare('SELECT * FROM app_users WHERE LOWER(email)=? AND active=1');
  $st->execute([$email]); $row = $st->fetch();
  if (!$row) fail('Учётная запись не найдена или отключена', 401);
  session_regenerate_id(true);
  $_SESSION['uid'] = $row['id'];
  audit('Вход по коду из письма', 'роль: '.$row['role_key']);
  $u = current_user();
  json_out(['auth'=>true,'user'=>publicUser($u),'rights'=>rightsOf($u)]);
}
if ($a==='logout') { audit('Выход'); $_SESSION=[]; session_destroy(); json_out(['auth'=>false]); }
if ($a==='verify_ceo') {
  require_login();
  if (!can('admin')) fail('Только администратор', 403);
  $pass = (string)($b['password'] ?? '');
  $st = db()->prepare("SELECT password_hash FROM app_users WHERE role_key='ASH' AND active=1 ORDER BY created_at ASC LIMIT 1");
  $st->execute();
  $ceo = $st->fetch();
  if (!$ceo || !password_verify($pass, $ceo['password_hash'] ?? '')) {
    audit('Сброс данных: неверный пароль CEO', '');
    fail('Неверный пароль CEO', 401);
  }
  json_out(['ok'=>true]);
}
fail('Неизвестное действие', 400);
