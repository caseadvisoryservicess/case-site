<?php
// CASE OS v3.5.7 — investor purchase requests endpoint.
require __DIR__.'/lib.php';
require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  json_out(['ok'=>true,'rows'=>list_table('investor_requests', $_GET)]);
}
if ($method === 'POST') {
  $b = body();
  if (array_key_exists('delete', $b)) { delete_row('investor_requests', $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) { json_out(['ok'=>true,'row'=>upsert_row('investor_requests', $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}
fail('Метод не поддерживается', 405);
