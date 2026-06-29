<?php
// CASE OS — вход / выход / текущий пользователь.
require __DIR__.'/lib.php';

function publicUser(array $u): array {
  return ['id'=>$u['id'],'email'=>$u['email'],'name'=>$u['name'],'title'=>$u['title'],
          'role'=>$u['role_key'],'role_label'=>$u['role_label'],'broker'=>$u['broker_name']];
}
function rightsOf(array $u): array {
  return ['leasing'=>(bool)$u['leasing'],'finance'=>(bool)$u['finance'],'edit'=>(bool)$u['edit'],
          'approve'=>(bool)$u['approve'],'plans'=>(bool)$u['plans'],'own_only'=>(bool)$u['own_only'],'admin'=>(bool)$u['admin']];
}

if ($_SERVER['REQUEST_METHOD']==='GET') {
  $u = current_user();
  if (!$u || !$u['active']) json_out(['auth'=>false]);
  json_out(['auth'=>true,'user'=>publicUser($u),'rights'=>rightsOf($u)]);
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
if ($a==='logout') { audit('Выход'); $_SESSION=[]; session_destroy(); json_out(['auth'=>false]); }
fail('Неизвестное действие', 400);
