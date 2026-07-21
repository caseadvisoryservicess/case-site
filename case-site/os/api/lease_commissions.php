<?php
// CASE OS v3.5.7 — lease commission engine endpoint.
require __DIR__.'/lib.php';
require_login();

function lease_comm_can_all(): bool {
  return can('admin') || can('finance') || can('approve');
}
function lease_comm_table_ready(): bool {
  try { db()->query('SELECT 1 FROM `lease_commission_deals` LIMIT 1'); return true; }
  catch (Throwable $e) { return false; }
}
function lease_setting(): array {
  try {
    $st = db()->prepare('SELECT setting_value FROM commission_engine_settings WHERE setting_key=?');
    $st->execute(['lease_distribution']);
    $raw = $st->fetchColumn();
    $j = is_string($raw) ? json_decode($raw, true) : [];
    return is_array($j) ? $j : [];
  } catch (Throwable $e) { return []; }
}
function lease_stage_prob(string $stage, array $cfg): float {
  $map = $cfg['stageProb'] ?? ['lead'=>20,'neg'=>35,'loi'=>65,'contract'=>85,'signed'=>100,'paid'=>100,'lost'=>0,'reversed'=>0];
  return ((float)($map[$stage] ?? 25)) / 100.0;
}
function lease_calc(array $r, ?array $cfg=null): array {
  $cfg = $cfg ?: lease_setting();
  $area = (float)($r['area'] ?? 0); $rate = (float)($r['rate'] ?? 0);
  $monthly = (float)($r['monthly_rent'] ?? 0); if ($monthly <= 0) $monthly = $area * $rate;
  $annual = $monthly * 12.0;
  $method = (string)($r['base_method'] ?? ($cfg['baseMethod'] ?? 'manual'));
  $C = (float)($r['commission_base'] ?? 0);
  if ($method === 'one_month') $C = $monthly;
  elseif ($method === 'annual_percent') $C = $annual * ((float)($r['annual_percent'] ?? ($cfg['annualPercent'] ?? 8))) / 100.0;
  elseif ($method === 'fixed') $C = (float)($r['fixed_amount'] ?? ($cfg['fixedAmount'] ?? 0));
  $scenario = (string)($r['closing_type'] ?? 'external');
  $agent = 0; $curator = 0; $support = $C * ((float)($cfg['supportShare'] ?? 5)) / 100.0;
  if ($scenario === 'curator_self') {
    $curator = $C * ((float)($cfg['curatorSelfShare'] ?? 25)) / 100.0;
  } elseif ($scenario === 'internal') {
    $agent = $C * ((float)($cfg['internalAgentShare'] ?? 15)) / 100.0;
    $curator = $C * ((float)($cfg['curatorShare'] ?? 5)) / 100.0;
  } else {
    $agent = $C * ((float)($cfg['externalAgentShare'] ?? 20)) / 100.0;
    $curator = $C * ((float)($cfg['curatorShare'] ?? 5)) / 100.0;
  }
  $company = $C - $agent - $curator - $support;
  $salary = (float)($r['salary_allocation'] ?? ($cfg['internalMonthlySalary'] ?? 0));
  $companyNet = $company - ($scenario === 'internal' ? $salary : 0);
  return [
    'monthly_rent'=>$monthly, 'annual_rent'=>$annual, 'commission_base'=>$C,
    'agent_amount'=>$agent, 'curator_amount'=>$curator, 'support_amount'=>$support,
    'company_amount'=>$company, 'company_net'=>$companyNet,
    'probability'=>lease_stage_prob((string)($r['stage'] ?? 'lead'), $cfg),
  ];
}
function lease_insert_ledger(int $dealId, array $deal, array $calc): void {
  $pdo = db();
  $pdo->prepare('DELETE FROM lease_commission_ledger WHERE lease_deal_id=?')->execute([$dealId]);
  $C = max((float)$calc['commission_base'], 0.000001);
  $cur = (string)($deal['currency'] ?? 'USD'); $fx = (float)($deal['fx_rate'] ?? 0);
  $period = !empty($deal['signed_date']) ? substr((string)$deal['signed_date'],0,7) : date('Y-m');
  $rows = [];
  $primary = trim((string)($deal['agent_primary'] ?? ''));
  $secondary = trim((string)($deal['agent_secondary'] ?? ''));
  $split1 = (float)($deal['split_primary'] ?? 100); $split2 = (float)($deal['split_secondary'] ?? 0);
  if ($secondary !== '' && ($split1 + $split2) <= 0) { $split1 = 50; $split2 = 50; }
  if ($secondary === '') { $split1 = 100; $split2 = 0; }
  if ($calc['agent_amount'] > 0 && $primary !== '') $rows[] = [$primary, 'agent', $calc['agent_amount']*$split1/100.0, $split1];
  if ($calc['agent_amount'] > 0 && $secondary !== '') $rows[] = [$secondary, 'agent', $calc['agent_amount']*$split2/100.0, $split2];
  $curatorName = trim((string)($deal['curator_name'] ?? ''));
  if ($calc['curator_amount'] > 0 && $curatorName !== '') $rows[] = [$curatorName, 'curator', $calc['curator_amount'], $calc['curator_amount']/$C*100];
  $supportName = trim((string)($deal['support_name'] ?? ''));
  if ($calc['support_amount'] > 0 && $supportName !== '') $rows[] = [$supportName, 'support', $calc['support_amount'], $calc['support_amount']/$C*100];
  $rows[] = ['CASE house', 'company', $calc['company_amount'], $calc['company_amount']/$C*100];
  $status = (string)($deal['payment_status'] ?? 'pending');
  $st = $pdo->prepare('INSERT INTO lease_commission_ledger
    (lease_deal_id, participant_name, participant_role, role_key, amount, currency, fx_rate, amount_usd, amount_uzs, share_percent, stage, probability, status, visibility_owner, period_month, notes, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  foreach ($rows as $x) {
    $amount = (float)$x[2];
    $usd = $cur === 'USD' ? $amount : ($fx > 0 ? $amount / $fx : 0);
    $uzs = $cur === 'UZS' ? $amount : ($fx > 0 ? $amount * $fx : 0);
    $st->execute([$dealId, $x[0], $x[1], $x[1], $amount, $cur, $fx, $usd, $uzs, (float)$x[3], $deal['stage'] ?? 'lead', $calc['probability'], $status, $x[0], $period, $deal['notes'] ?? null, current_user()['name'] ?? null]);
  }
}
function lease_save_deal(array $row): array {
  if (!can('edit') && !can('finance') && !can('admin')) fail('Нет доступа к созданию комиссионной сделки', 403);
  if (!lease_comm_can_all()) {
    $me = current_user()['broker_name'] ?? '';
    if (($row['agent_primary'] ?? '') !== $me && ($row['agent_secondary'] ?? '') !== $me) fail('Агент может сохранять только свои сделки', 403);
  }
  $cfg = lease_setting();
  $calc = lease_calc($row, $cfg);
  foreach ($calc as $k=>$v) $row[$k] = $v;
  if (empty($row['curator_name'])) $row['curator_name'] = $cfg['curatorName'] ?? null;
  if (empty($row['support_name'])) $row['support_name'] = $cfg['supportName'] ?? null;
  $saved = upsert_row('lease_commission_deals', $row);
  lease_insert_ledger((int)$saved['id'], $saved, $calc);
  audit('Lease commission recalculated', (string)$saved['id']);
  return $saved;
}

if (!lease_comm_table_ready()) json_out(['ok'=>true,'rows'=>[], 'note'=>'Run migrations: lease_commission_deals table is missing.']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $type = (string)($_GET['type'] ?? 'deals');
  if ($type === 'settings') json_out(['ok'=>true,'settings'=>lease_setting()]);
  if ($type === 'ledger') json_out(['ok'=>true,'rows'=>list_table('lease_commission_ledger', $_GET), 'all_access'=>lease_comm_can_all()]);
  $rows = list_table('lease_commission_deals', $_GET);
  json_out(['ok'=>true,'rows'=>$rows,'all_access'=>lease_comm_can_all()]);
}
if ($method === 'POST') {
  $b = body();
  $type = (string)($b['type'] ?? 'deal');
  if ($type === 'settings') {
    if (!lease_comm_can_all()) fail('Нет доступа к настройкам', 403);
    $val = $b['settings'] ?? [];
    $st = db()->prepare('INSERT INTO commission_engine_settings (setting_key, setting_value, updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by)');
    $st->execute(['lease_distribution', json_encode($val, JSON_UNESCAPED_UNICODE), current_user()['name'] ?? null]);
    audit('Lease commission settings changed', '');
    json_out(['ok'=>true]);
  }
  if (array_key_exists('delete', $b)) { if (!lease_comm_can_all()) fail('Нет доступа к удалению',403); delete_row('lease_commission_deals', $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) json_out(['ok'=>true,'row'=>lease_save_deal($b['row'])]);
  fail('Нужно поле row/delete/settings', 400);
}
fail('Метод не поддерживается', 405);
