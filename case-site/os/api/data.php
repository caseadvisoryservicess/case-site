<?php
// CASE OS — чтение/запись данных (с проверкой прав).
require __DIR__.'/lib.php';
$u = require_login();
$m = $_SERVER['REQUEST_METHOD'];
$t = $m==='GET' ? ($_GET['table'] ?? '') : '';

// v4.32.2: external agents may not enumerate or mutate corporate registries through
// the generic endpoint. New brand/investor leads use dedicated moderated endpoints.
if (($u['role_key'] ?? '') === 'AGX') {
  if ($m === 'GET') {
    $blocked = ['brands','units','brand_requests','investor_requests','sales_assets','sales_buyers',
      'commission_ledger','lease_commission_deals','lease_commission_ledger','supplier_commission_deals',
      'app_users','audit_log'];
    if (in_array((string)$t, $blocked, true)) fail('Раздел недоступен внешнему агенту', 403);
  } else {
    fail('Изменение данных через общий API недоступно внешнему агенту', 403);
  }
}

if ($m==='GET') { json_out(['rows'=>list_table($t, $_GET)]); }
if ($m==='POST') {
  $b = body(); $t = $b['table'] ?? '';
  if (array_key_exists('delete',$b)) { delete_row($t, $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row',$b))    { json_out(['row'=>upsert_row($t, $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}
fail('Метод не поддерживается', 405);
