<?php
// CASE OS — управление пользователями (только admin): создание + смена пароля.
require __DIR__.'/lib.php';
require_login();
if (!can('admin')) fail('Только администратор', 403);
$b = body(); $a = $b['action'] ?? '';
if ($a==='create') {
  $email = trim($b['email'] ?? ''); $pass = (string)($b['password'] ?? '');
  if (!$email || strlen($pass) < 6) fail('Укажите email и пароль (мин. 6 символов)', 400);
  $id = uuid();
  db()->prepare('INSERT INTO app_users (id,email,password_hash,name,title,role_key,broker_name,active) VALUES (?,?,?,?,?,?,?,1)')
    ->execute([$id,$email,password_hash($pass,PASSWORD_DEFAULT),trim($b['name']??$email),trim($b['title']??''),($b['role']??'AG'),($b['broker']??null)]);
  audit('Создан пользователь', $email);
  json_out(['ok'=>true,'id'=>$id]);
}
if ($a==='setpass') {
  $uid = $b['id'] ?? ''; $pass = (string)($b['password'] ?? '');
  if (!$uid || strlen($pass) < 6) fail('Нужны id и пароль (мин. 6 символов)', 400);
  db()->prepare('UPDATE app_users SET password_hash=? WHERE id=?')->execute([password_hash($pass,PASSWORD_DEFAULT),$uid]);
  audit('Смена пароля пользователя', (string)$uid);
  json_out(['ok'=>true]);
}
fail('Неизвестное действие', 400);
