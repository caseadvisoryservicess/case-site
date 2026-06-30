<?php
// CASE OS — общее состояние платформы (живые данные интерфейса).
// GET  — отдать сохранённое состояние (нужен вход).
// POST — сохранить состояние (нужно право edit или admin). Тело: {"data": {...}}.
require __DIR__.'/lib.php';
$u = require_login();
$m = $_SERVER['REQUEST_METHOD'];

if ($m === 'GET') {
  $st = db()->query('SELECT data, updated_at, updated_by FROM app_state WHERE id=1');
  $row = $st->fetch();
  $data = ($row && $row['data']) ? json_decode($row['data'], true) : null;
  json_out(['data'=>$data, 'updated_at'=>$row['updated_at'] ?? null, 'updated_by'=>$row['updated_by'] ?? null]);
}

if ($m === 'POST') {
  if (!can('edit') && !can('admin')) fail('Нет прав на сохранение', 403);
  $b = body();
  if (!array_key_exists('data', $b)) fail('Нужно поле data', 400);
  $json = json_encode($b['data'], JSON_UNESCAPED_UNICODE);
  $now  = date('Y-m-d H:i:s');
  $pdo  = db();
  $exists = (bool)$pdo->query('SELECT 1 FROM app_state WHERE id=1')->fetchColumn();
  if ($exists) {
    $pdo->prepare('UPDATE app_state SET data=?, updated_at=?, updated_by=? WHERE id=1')
        ->execute([$json, $now, $u['name'] ?? '-']);
  } else {
    $pdo->prepare('INSERT INTO app_state (id, data, updated_at, updated_by) VALUES (1,?,?,?)')
        ->execute([$json, $now, $u['name'] ?? '-']);
  }
  json_out(['ok'=>true, 'updated_at'=>$now]);
}

fail('Метод не поддерживается', 405);
