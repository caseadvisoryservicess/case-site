<?php
// CASE OS v4.43 — персональные настройки интерфейса (ширины/столбцы/плотность таблиц и т.п.).
// Хранятся на сервере ОТДЕЛЬНО для каждого пользователя: сотрудник получает свои настройки
// на любом устройстве и в любом браузере; localStorage на клиенте — только кэш.
// Строго свой user_id: чужие настройки прочитать или изменить нельзя.
declare(strict_types=1);
require __DIR__.'/lib.php';

$u = require_login();
$pdo = db();
$pdo->exec("CREATE TABLE IF NOT EXISTS user_prefs (
  user_id VARCHAR(64) NOT NULL PRIMARY KEY,
  data MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$uid = (string)($u['id'] ?? '');
if ($uid === '') fail('Нет идентификатора пользователя', 400);

$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($m === 'GET') {
  $st = $pdo->prepare('SELECT data, updated_at FROM user_prefs WHERE user_id=?');
  $st->execute([$uid]);
  $row = $st->fetch();
  $data = ($row && (string)$row['data'] !== '') ? json_decode((string)$row['data'], true) : null;
  json_out(['data'=>is_array($data) ? $data : new stdClass(), 'updated_at'=>$row['updated_at'] ?? null]);
}

if ($m === 'POST') {
  $b = body();
  $data = $b['data'] ?? null;
  if (!is_array($data)) fail('Нужно поле data (объект настроек)', 400);
  $json = json_encode($data, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось сериализовать настройки', 400);
  if (strlen($json) > 262144) fail('Настройки слишком большие (лимит 256 КБ)', 413);
  $now = date('Y-m-d H:i:s');
  $st = $pdo->prepare('INSERT INTO user_prefs (user_id, data, updated_at) VALUES (?,?,?)
    ON DUPLICATE KEY UPDATE data=VALUES(data), updated_at=VALUES(updated_at)');
  $st->execute([$uid, $json, $now]);
  json_out(['ok'=>true, 'updated_at'=>$now]);
}

fail('Метод не поддерживается', 405);
