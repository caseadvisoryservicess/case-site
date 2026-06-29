<?php
// CASE OS — одноразовая настройка: создаёт первого администратора.
// После использования УДАЛИТЕ этот файл с сервера.
require __DIR__.'/lib.php';
$cnt = (int)db()->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
if ($_SERVER['REQUEST_METHOD']==='GET') {
  if ($cnt > 0) fail('Установка уже выполнена (пользователи существуют).', 403);
  header('Content-Type:text/html;charset=utf-8');
  echo '<!doctype html><meta charset=utf-8><body style="font-family:sans-serif;max-width:420px;margin:40px auto">
  <h2>CASE OS — создание администратора</h2>
  <form method=post>
   <p>Email<br><input name=email style="width:100%;padding:8px"></p>
   <p>Пароль (мин. 6)<br><input name=password type=password style="width:100%;padding:8px"></p>
   <p>Имя<br><input name=name value="Aziz Shermukhamedov" style="width:100%;padding:8px"></p>
   <button style="padding:10px 16px">Создать администратора (ASH)</button>
  </form></body>'; exit;
}
if ($cnt > 0) fail('Установка уже выполнена.', 403);
$rolesCnt = (int)db()->query('SELECT COUNT(*) FROM roles')->fetchColumn();
if ($rolesCnt === 0) fail('Сначала импортируйте schema_mysql.sql и seed_roles.sql', 400);
$email = trim($_POST['email'] ?? ''); $pass = (string)($_POST['password'] ?? ''); $name = trim($_POST['name'] ?? 'CEO');
if (!$email || strlen($pass) < 6) fail('Укажите email и пароль (мин. 6 символов)', 400);
$id = uuid();
db()->prepare('INSERT INTO app_users (id,email,password_hash,name,title,role_key,broker_name,active) VALUES (?,?,?,?,?,?,?,1)')
  ->execute([$id,$email,password_hash($pass,PASSWORD_DEFAULT),$name,'Founder / CEO','ASH',null]);
json_out(['ok'=>true,'message'=>'Администратор создан. Теперь УДАЛИТЕ setup.php с сервера и войдите в систему.']);
