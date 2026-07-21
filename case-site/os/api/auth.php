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

// Вход по коду из письма включён по умолчанию. Временное отключение (например,
// на локальном XAMPP, где нет почты): в config.php добавьте 'code_login' => false —
// тогда вход будет по паролю. При переезде на хостинг уберите эту строку.
function code_login_enabled(): bool { $c = cfg(); return !array_key_exists('code_login', $c) || !empty($c['code_login']); }
// Вход по паролю доступен ВСЕГДА параллельно с кодом из письма (по умолчанию) —
// сотрудники сами выбирают способ на экране входа; это подстраховка на случай,
// если письмо с кодом не пришло или сессия оборвалась в неудобный момент.
// Чтобы разрешить только код из письма (без пароля), в config.php добавьте
// 'allow_password_login' => false.
function password_login_allowed(): bool { $c = cfg(); if (array_key_exists('allow_password_login', $c)) return !empty($c['allow_password_login']); return true; }

if ($_SERVER['REQUEST_METHOD']==='GET') {
  $u = current_user();
  if (!$u || !$u['active']) json_out(['auth'=>false,'csrf'=>csrf_token(),'pass_login'=>password_login_allowed(),'code_login'=>code_login_enabled()]);
  json_out(['auth'=>true,'csrf'=>csrf_token(),'user'=>publicUser($u),'rights'=>rightsOf($u)]);
}

// Минимальный SMTP-клиент (без внешних библиотек): порт 465 (ssl), 587 (tls/STARTTLS)
// или без шифрования (none — только для локальных тестов).
function smtp_send(array $smtp, string $from, string $to, string $subject, string $body): bool {
  $host = $smtp['host'] ?? ''; if (!$host) return false;
  $port = (int)($smtp['port'] ?? 465);
  $secure = $smtp['secure'] ?? 'ssl';
  $user = (string)($smtp['user'] ?? ''); $pass = (string)($smtp['pass'] ?? '');
  $timeout = 12;
  $remote = ($secure === 'ssl' ? 'ssl://' : '').$host.':'.$port;
  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout);
  if (!$fp) return false;
  stream_set_timeout($fp, $timeout);
  $read = function() use ($fp) { $d=''; while (($l = fgets($fp, 515)) !== false) { $d .= $l; if (strlen($l) < 4 || $l[3] !== '-') break; } return $d; };
  $cmd  = function($c) use ($fp, $read) { fwrite($fp, $c."\r\n"); return $read(); };
  $is   = function($resp, $codes) { return in_array(substr($resp, 0, 3), (array)$codes, true); };
  $bye  = function() use ($fp) { @fclose($fp); return false; };
  if (!$is($read(), '220')) return $bye();
  if (!$is($cmd('EHLO caseos.local'), '250')) return $bye();
  if ($secure === 'tls') {
    if (!$is($cmd('STARTTLS'), '220')) return $bye();
    if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return $bye();
    if (!$is($cmd('EHLO caseos.local'), '250')) return $bye();
  }
  if ($user !== '') {
    if (!$is($cmd('AUTH LOGIN'), '334')) return $bye();
    if (!$is($cmd(base64_encode($user)), '334')) return $bye();
    if (!$is($cmd(base64_encode($pass)), '235')) return $bye();
  }
  if (!$is($cmd('MAIL FROM:<'.$from.'>'), '250')) return $bye();
  if (!$is($cmd('RCPT TO:<'.$to.'>'), ['250','251'])) return $bye();
  if (!$is($cmd('DATA'), '354')) return $bye();
  $headers = "From: CASE OS <$from>\r\nTo: <$to>\r\nSubject: $subject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\nDate: ".date('r');
  $msg = $headers."\r\n\r\n".str_replace("\n.", "\n..", $body)."\r\n.";
  if (!$is($cmd($msg), '250')) return $bye();
  $cmd('QUIT'); @fclose($fp);
  return true;
}
// Отправка письма с кодом. Приоритет: SMTP из config.php ('smtp' => [...]) — самый
// надёжный путь на хостинге; иначе штатный mail(). Отправитель: 'mail_from'.
// Для локальной отладки: 'mail_debug_file' => '/путь/файл' — код пишется в файл.
function send_login_code(string $email, string $code): bool {
  $cfg = cfg();
  $subject = '=?UTF-8?B?'.base64_encode('Код входа в CASE OS').'?=';
  $body = "Ваш код для входа в CASE OS: $code\n\nКод действует 10 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.";
  $from = $cfg['mail_from'] ?? ($cfg['smtp']['user'] ?? ('no-reply@'.preg_replace('/^www\./','',$_SERVER['HTTP_HOST'] ?? 'caseadvisory.uz')));
  $sent = false;
  if (!empty($cfg['smtp']['host'])) {
    try { $sent = smtp_send($cfg['smtp'], $from, $email, $subject, $body); } catch (Throwable $e) {}
  }
  if (!$sent) {
    $headers = "From: CASE OS <$from>\r\nContent-Type: text/plain; charset=utf-8\r\nMIME-Version: 1.0";
    try { $sent = @mail($email, $subject, $body, $headers); } catch (Throwable $e) {}
  }
  if (!empty($cfg['mail_debug_file'])) { @file_put_contents($cfg['mail_debug_file'], date('c')." $email $code\n", FILE_APPEND); $sent = true; }
  return (bool)$sent;
}

// ── Дросселирование попыток входа (P1-03) ──────────────────────────────
// Таблица создаётся лениво по тому же принципу, что login_codes выше: миграцию
// заранее запускать не нужно (иначе замкнутый круг — для миграции нужен вход).
// scope_key разделяет счётчики "по e-mail" и "по IP", чтобы блокировать и точечный
// перебор одного аккаунта, и перебор многих аккаунтов с одного адреса.
function throttle_ensure_table(): void {
  try { db()->query('SELECT 1 FROM login_throttle LIMIT 1'); }
  catch (Throwable $e) {
    try {
      db()->exec('CREATE TABLE IF NOT EXISTS login_throttle (
        scope_key VARCHAR(190) PRIMARY KEY, fail_count INT NOT NULL DEFAULT 0,
        last_fail_at DATETIME, locked_until DATETIME)');
    } catch (Throwable $e2) {}
  }
}
function client_ip(): string { return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'); }
function throttle_locked_seconds(string $scopeKey): int {
  throttle_ensure_table();
  try {
    $st = db()->prepare('SELECT locked_until FROM login_throttle WHERE scope_key=?');
    $st->execute([$scopeKey]);
    $row = $st->fetch();
    if ($row && $row['locked_until'] && strtotime($row['locked_until']) > time()) return strtotime($row['locked_until']) - time();
  } catch (Throwable $e) {}
  return 0;
}
// Каждое обращение увеличивает счётчик; после $freeAttempts бесплатных попыток
// включается экспоненциальная задержка (baseSeconds*2^n), ограниченная capSeconds.
function throttle_register_event(string $scopeKey, int $freeAttempts, int $baseSeconds, int $capSeconds): void {
  throttle_ensure_table();
  try {
    $st = db()->prepare('SELECT fail_count FROM login_throttle WHERE scope_key=?');
    $st->execute([$scopeKey]); $row = $st->fetch();
    $count = $row ? ((int)$row['fail_count'] + 1) : 1;
    $lockedUntil = null;
    if ($count > $freeAttempts) {
      $secs = min($capSeconds, $baseSeconds * (2 ** min(10, $count - $freeAttempts)));
      $lockedUntil = date('Y-m-d H:i:s', time() + $secs);
    }
    if ($row) db()->prepare('UPDATE login_throttle SET fail_count=?, last_fail_at=?, locked_until=? WHERE scope_key=?')
      ->execute([$count, date('Y-m-d H:i:s'), $lockedUntil, $scopeKey]);
    else db()->prepare('INSERT INTO login_throttle (scope_key,fail_count,last_fail_at,locked_until) VALUES (?,?,?,?)')
      ->execute([$scopeKey, $count, date('Y-m-d H:i:s'), $lockedUntil]);
  } catch (Throwable $e) {}
}
function throttle_clear(string $scopeKey): void {
  throttle_ensure_table();
  try { db()->prepare('DELETE FROM login_throttle WHERE scope_key=?')->execute([$scopeKey]); } catch (Throwable $e) {}
}

$b = body(); $a = $b['action'] ?? '';
if ($a==='login') {
  if (!password_login_allowed()) { audit('Попытка входа по паролю (отключён)', trim($b['email'] ?? '')); fail('Вход по паролю отключён. Используйте вход по коду из письма.', 403); }
  $email = trim($b['email'] ?? ''); $pass = (string)($b['password'] ?? '');
  $emailKey = 'login-email:'.mb_strtolower($email); $ipKey = 'login-ip:'.client_ip();
  $lockedFor = max(throttle_locked_seconds($emailKey), throttle_locked_seconds($ipKey));
  if ($lockedFor > 0) { audit('Вход заблокирован (превышены попытки)', $email); fail('Слишком много неудачных попыток входа. Повторите через '.ceil($lockedFor/60).' мин.', 429); }
  $st = db()->prepare('SELECT * FROM app_users WHERE email=? AND active=1');
  $st->execute([$email]); $row = $st->fetch();
  if (!$row || !password_verify($pass, $row['password_hash'] ?? '')) {
    throttle_register_event($emailKey, 5, 15, 900);
    throttle_register_event($ipKey, 10, 15, 900);
    fail('Неверный логин или пароль', 401);
  }
  throttle_clear($emailKey); throttle_clear($ipKey);
  session_regenerate_id(true);
  $_SESSION['uid'] = $row['id'];
  audit('Вход в систему', 'роль: '.$row['role_key']);
  $u = current_user();
  json_out(['auth'=>true,'csrf'=>csrf_token(),'user'=>publicUser($u),'rights'=>rightsOf($u)]);
}
if ($a==='request_code') {
  if (!code_login_enabled()) fail('Вход по коду временно отключён — используйте вход по паролю.', 403);
  $email = mb_strtolower(trim($b['email'] ?? ''));
  if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Укажите корректный email', 400);
  $ipKey = 'reqcode-ip:'.client_ip();
  $lockedFor = throttle_locked_seconds($ipKey);
  if ($lockedFor > 0) fail('Слишком много запросов кода. Повторите через '.ceil($lockedFor/60).' мин.', 429);
  throttle_register_event($ipKey, 8, 30, 600);
  // Умышленно НЕ различаем "email не найден" и "email найден" в ответе клиенту —
  // иначе endpoint превращается в оракул для перебора зарегистрированных адресов
  // (независимый аудит, P1-03). Письмо реально уходит только зарегистрированному
  // активному аккаунту; для остальных запрос тихо завершается тем же ответом.
  $st = db()->prepare('SELECT id FROM app_users WHERE LOWER(email)=? AND active=1');
  $st->execute([$email]);
  $registered = (bool)$st->fetch();
  $generic = ['ok'=>true,'message'=>'Если такой адрес зарегистрирован в системе, письмо с кодом отправлено. Проверьте папку «Спам».'];
  if (!$registered) { audit('Запрос кода для незарегистрированного email', $email); json_out($generic); }
  // не чаще одного кода в минуту; таблица кодов создаётся сама при первом использовании
  // (миграцию запускать не обязательно — иначе замкнутый круг: для миграции нужен вход)
  try { $st = db()->prepare('SELECT created_at FROM login_codes WHERE email=?'); $st->execute([$email]); }
  catch (Throwable $e) {
    try {
      db()->exec('CREATE TABLE IF NOT EXISTS login_codes (
        email VARCHAR(190) PRIMARY KEY, code_hash VARCHAR(255), expires_at DATETIME,
        attempts INT NOT NULL DEFAULT 0, created_at DATETIME)');
      $st = db()->prepare('SELECT created_at FROM login_codes WHERE email=?'); $st->execute([$email]);
    } catch (Throwable $e2) { fail('Не удалось подготовить вход по коду ('.$e2->getMessage().'). Обратитесь к администратору.', 500); }
  }
  $prev = $st->fetch();
  if ($prev && strtotime($prev['created_at']) > time() - 60) json_out($generic); // уже отправлен недавно — тот же общий ответ, не 429 с деталями
  $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  db()->prepare('DELETE FROM login_codes WHERE email=?')->execute([$email]);
  db()->prepare('INSERT INTO login_codes (email,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,0,?)')
    ->execute([$email, password_hash($code, PASSWORD_DEFAULT), date('Y-m-d H:i:s', time()+600), date('Y-m-d H:i:s')]);
  if (!send_login_code($email, $code)) fail('Хостинг не отправил письмо. Администратору: 1) создайте почтовый ящик (например no-reply@ваш-домен) в cPanel → Email Accounts; 2) пропишите его SMTP-данные в os/api/config.php (блок smtp — образец в config.sample.php). Аварийно можно временно включить вход по паролю: allow_password_login => true.', 500);
  audit('Запрошен код входа', $email);
  json_out($generic);
}
if ($a==='verify_code') {
  if (!code_login_enabled()) fail('Вход по коду временно отключён — используйте вход по паролю.', 403);
  $email = mb_strtolower(trim($b['email'] ?? '')); $code = trim((string)($b['code'] ?? ''));
  if (!$email || !$code) fail('Укажите email и код из письма', 400);
  $lc = null;
  try { $st = db()->prepare('SELECT * FROM login_codes WHERE email=?'); $st->execute([$email]); $lc = $st->fetch(); }
  catch (Throwable $e) { fail('Код не запрошен или уже использован. Нажмите «Получить код».', 400); }
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
  json_out(['auth'=>true,'csrf'=>csrf_token(),'user'=>publicUser($u),'rights'=>rightsOf($u)]);
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
