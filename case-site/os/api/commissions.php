<?php
// CASE OS v3.1 — private bonus / commission ledger endpoint.
// Team-ledger access follows configurable action rights (admin/finance/approve); agents otherwise see only their rows.
require __DIR__.'/lib.php';
require_login();

function commissions_can_all(): bool {
  $u = current_user();
  return can('admin') || can('finance') || can('approve');
}
function commissions_table_ready(): bool {
  try { db()->query('SELECT 1 FROM `commission_ledger` LIMIT 1'); return true; }
  catch (Throwable $e) { return false; }
}

if (!commissions_table_ready()) {
  json_out(['ok'=>true,'rows'=>[],'summary'=>['earned'=>0,'pipeline'=>0,'weighted'=>0,'lost'=>0], 'note'=>'Run migrations: commission_ledger table is missing.']);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $rows = list_table('commission_ledger', $_GET);
  $summary = ['earned'=>0,'pipeline'=>0,'weighted'=>0,'lost'=>0];
  foreach ($rows as $r) {
    $summary['earned'] += (float)($r['bonus_earned'] ?? 0);
    $summary['pipeline'] += (float)($r['bonus_pipeline'] ?? 0);
    $summary['weighted'] += (float)($r['weighted_bonus'] ?? 0);
    $summary['lost'] += (float)($r['lost_bonus'] ?? 0);
  }
  json_out(['ok'=>true,'all_access'=>commissions_can_all(),'rows'=>$rows,'summary'=>$summary]);
}

if ($method === 'POST') {
  if (!commissions_can_all()) fail('Нет доступа к изменению commission ledger', 403);
  $b = body();
  if (array_key_exists('delete', $b)) { delete_row('commission_ledger', $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) { json_out(['ok'=>true,'row'=>upsert_row('commission_ledger', $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}

fail('Метод не поддерживается', 405);
