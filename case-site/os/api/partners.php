<?php
// CASE OS v3.5.7 — external partners and referrals endpoint.
require __DIR__.'/lib.php';
require_login();
function partner_table_from_type(string $type): string {
  if ($type === 'partners') return 'case_partners';
  if ($type === 'referrals') return 'partner_referrals';
  fail('Неизвестный тип partners endpoint', 400);
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $type = (string)($_GET['type'] ?? 'partners');
  $table = partner_table_from_type($type);
  json_out(['ok'=>true,'type'=>$type,'rows'=>list_table($table, $_GET)]);
}
if ($method === 'POST') {
  $b = body();
  $type = (string)($b['type'] ?? 'partners');
  $table = partner_table_from_type($type);
  if (array_key_exists('delete', $b)) { delete_row($table, $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) { json_out(['ok'=>true,'type'=>$type,'row'=>upsert_row($table, $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}
fail('Метод не поддерживается', 405);
