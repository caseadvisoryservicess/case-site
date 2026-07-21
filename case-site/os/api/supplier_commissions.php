<?php
// CASE OS v3.5.7 — supplier mediation commission endpoint.
require __DIR__.'/lib.php';
require_login();

function supplier_comm_can_all(): bool {
  return can('admin') || can('finance') || can('approve');
}
function supplier_table_ready(): bool {
  try { db()->query('SELECT 1 FROM `supplier_commission_deals` LIMIT 1'); return true; }
  catch (Throwable $e) { return false; }
}
function supplier_setting(): array {
  try {
    $st = db()->prepare('SELECT setting_value FROM commission_engine_settings WHERE setting_key=?');
    $st->execute(['supplier_distribution']);
    $raw = $st->fetchColumn();
    $j = is_string($raw) ? json_decode($raw, true) : [];
    return is_array($j) ? $j : [];
  } catch (Throwable $e) { return []; }
}
function supplier_calc(array $r): array {
  $order = (float)($r['order_amount'] ?? 0);
  $rate = (float)($r['commission_rate'] ?? 0);
  $disc = (float)($r['client_discount_rate'] ?? 0);
  if ($rate <= 0 || $disc <= 0) {
    $cfg = supplier_setting();
    if ($rate <= 0) $rate = (float)($cfg['defaultCommissionRate'] ?? 5);
    if ($disc <= 0) $disc = (float)($cfg['defaultClientDiscount'] ?? 5);
  }
  return ['commission_rate'=>$rate,'client_discount_rate'=>$disc,'case_commission'=>$order*$rate/100.0,'client_saving'=>$order*$disc/100.0];
}
function supplier_insert_ledger(int $dealId, array $deal, array $calc): void {
  $pdo = db();
  $pdo->prepare('DELETE FROM supplier_commission_ledger WHERE supplier_deal_id=?')->execute([$dealId]);
  $cur = (string)($deal['currency'] ?? 'USD');
  $period = date('Y-m');
  $st = $pdo->prepare('INSERT INTO supplier_commission_ledger
    (supplier_deal_id, supplier_name, client_name, case_commission, client_saving, currency, status, visibility_owner, period_month, notes, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  $st->execute([$dealId, $deal['supplier_name'] ?? null, $deal['client_name'] ?? null, $calc['case_commission'], $calc['client_saving'], $cur, $deal['payment_status'] ?? $deal['status'] ?? 'expected', $deal['owner'] ?? null, $period, $deal['notes'] ?? null, current_user()['name'] ?? null]);
}
function supplier_save_deal(array $row): array {
  if (!can('edit') && !can('finance') && !can('admin')) fail('Нет доступа к созданию посреднической сделки', 403);
  if (!supplier_comm_can_all()) {
    $me = current_user()['broker_name'] ?? '';
    if (($row['owner'] ?? '') !== $me) fail('Агент может сохранять только свои сделки', 403);
  }
  $cfg = supplier_setting();
  if (($row['status'] ?? '') === 'received' && !empty($cfg['requireDisclosureBeforePaid']) && (empty($row['client_disclosure']) || empty($row['supplier_disclosure']))) {
    fail('Перед оплатой нужно раскрытие комиссии клиенту и поставщику', 400);
  }
  $calc = supplier_calc($row);
  foreach ($calc as $k=>$v) $row[$k] = $v;
  $saved = upsert_row('supplier_commission_deals', $row);
  supplier_insert_ledger((int)$saved['id'], $saved, $calc);
  audit('Supplier commission recalculated', (string)$saved['id']);
  return $saved;
}
function supplier_type_table(string $type): string {
  if ($type === 'categories') return 'supplier_categories';
  if ($type === 'suppliers') return 'suppliers';
  if ($type === 'ledger') return 'supplier_commission_ledger';
  if ($type === 'deals') return 'supplier_commission_deals';
  fail('Неизвестный тип supplier endpoint', 400);
}

if (!supplier_table_ready()) json_out(['ok'=>true,'rows'=>[], 'note'=>'Run migrations: supplier_commission_deals table is missing.']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $type = (string)($_GET['type'] ?? 'deals');
  if ($type === 'settings') json_out(['ok'=>true,'settings'=>supplier_setting()]);
  json_out(['ok'=>true,'type'=>$type,'rows'=>list_table(supplier_type_table($type), $_GET), 'all_access'=>supplier_comm_can_all()]);
}
if ($method === 'POST') {
  $b = body();
  $type = (string)($b['type'] ?? 'deals');
  if ($type === 'settings') {
    if (!supplier_comm_can_all()) fail('Нет доступа к настройкам', 403);
    $val = $b['settings'] ?? [];
    $st = db()->prepare('INSERT INTO commission_engine_settings (setting_key, setting_value, updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by)');
    $st->execute(['supplier_distribution', json_encode($val, JSON_UNESCAPED_UNICODE), current_user()['name'] ?? null]);
    audit('Supplier commission settings changed', '');
    json_out(['ok'=>true]);
  }
  if (array_key_exists('delete', $b)) { delete_row(supplier_type_table($type), $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) {
    if ($type === 'deals') json_out(['ok'=>true,'row'=>supplier_save_deal($b['row'])]);
    json_out(['ok'=>true,'row'=>upsert_row(supplier_type_table($type), $b['row'])]);
  }
  fail('Нужно поле row/delete/settings', 400);
}
fail('Метод не поддерживается', 405);
