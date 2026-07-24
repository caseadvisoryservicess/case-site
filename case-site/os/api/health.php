<?php
// CASE OS v4.32.2 — backend/database health check (admin only).
require __DIR__.'/lib.php';
require_login();
if (!can('admin')) fail('Только администратор', 403);

$out = [
  'ok' => true,
  'php' => PHP_VERSION,
  'time' => date('Y-m-d H:i:s'),
  'backend' => 'CASE OS v4.32.2',
  'driver' => cfg()['driver'] ?? 'mysql',
  'tables' => [],
];

try {
  $pdo = db();
  $driver = cfg()['driver'] ?? 'mysql';
  $names = ['roles','app_users','objects','units','brands','documents','audit_log','activity_log','app_state','deals','deal_actions','data_quality_snapshots','doc_templates','commission_rules','commission_ledger','deal_stage_probabilities','brand_requests','sales_assets','sales_buyers','investor_requests','case_partners','partner_referrals','sales_commission_ledger','commission_engine_settings','lease_commission_deals','lease_commission_ledger','supplier_categories','suppliers','supplier_commission_deals','supplier_commission_ledger','market_data_sources','market_data_points','gis_analysis_cache','geo_state_history'];
  foreach ($names as $t) {
    try { $out['tables'][$t] = (int)$pdo->query('SELECT COUNT(*) FROM `'.$t.'`')->fetchColumn(); }
    catch (Throwable $e) { $out['tables'][$t] = null; }
  }
  try {
    $st = $pdo->query('SELECT revision, updated_at, updated_by, CHAR_LENGTH(data) AS bytes FROM app_state WHERE id=1');
    $out['app_state'] = $st->fetch() ?: null;
    try {
      $raw = $pdo->query('SELECT data FROM app_state WHERE id=1')->fetchColumn();
      $stateData = $raw ? json_decode((string)$raw,true) : [];
      $geo = is_array($stateData) && isset($stateData['GEO_DATA']) && is_array($stateData['GEO_DATA']) ? $stateData['GEO_DATA'] : null;
      $out['geo_state'] = $geo ? ['geo_revision'=>(int)($geo['meta']['serverRevision']??0),'updated_at'=>$geo['updatedAt']??($geo['meta']['lastSavedAt']??null),'updated_by'=>$geo['updatedBy']??($geo['meta']['lastSavedBy']??null)] : null;
    } catch (Throwable $e) { $out['geo_state_error']=$e->getMessage(); }
  } catch (Throwable $e) { $out['app_state_error'] = $e->getMessage(); }
  if ($driver === 'mysql') {
    try { $out['db_server'] = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION); } catch (Throwable $e) {}
    try { $out['db_autocommit'] = (int)$pdo->query('SELECT @@autocommit')->fetchColumn(); } catch (Throwable $e) {}
  }
} catch (Throwable $e) {
  $out['ok'] = false;
  $out['error'] = $e->getMessage();
}

$dir = realpath(__DIR__.'/../sql/backups') ?: (__DIR__.'/../sql/backups');
$out['backups'] = [
  'dir_exists' => is_dir($dir),
  'writable' => is_writable($dir),
  'count' => count(glob($dir.'/*.sql.gz') ?: []),
];

json_out($out);
