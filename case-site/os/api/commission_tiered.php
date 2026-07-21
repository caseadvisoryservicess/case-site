<?php
// CASE OS v4.17.0 — tiered leasing commission engine.
// Monthly-count tiers (retroactive) + admin/architect/manager 5% bonuses + manual overrides.
// Reads closed deals from lease_commission_deals; config in commission_engine_settings.tiered_distribution.
// Visibility: agents see only their own; manager/admin/finance/approve see everyone.
require __DIR__.'/lib.php';
$u = require_login();

function ct_can_all(): bool { return can('admin') || can('finance') || can('approve'); }
function ct_me(): string {
  $u = current_user();
  foreach (['broker','name','email'] as $k) { $v = trim((string)($u[$k] ?? '')); if ($v !== '') return $v; }
  return '';
}
function ct_default_config(): array {
  return [
    'mode' => 'tiered',
    'triggerStages' => ['paid'],            // funnel stage(s) at which a deal counts (Предоплата ≈ paid)
    'retroactiveTiers' => true,
    'agentTiers' => [ ['min'=>1,'pct'=>20], ['min'=>2,'pct'=>25], ['min'=>3,'pct'=>30] ],
    'managerTiers' => [ ['min'=>1,'pct'=>25], ['min'=>4,'pct'=>30] ],
    'adminName' => '', 'adminSupportPct' => 5,
    'architectName' => '', 'architectSupportPct' => 5,
    'managerName' => '', 'managerControlPct' => 5,
    'managerControlOwn' => false,           // manager gets control % on own deals? (per spec: no)
    'supportIncludeOwn' => true,            // admin/architect get support on their own closed deals? (yes)
    'overrides' => [ 'per_user_flat' => (object)[], 'per_deal' => (object)[] ],
  ];
}
function ct_config(): array {
  $cfg = ct_default_config();
  try {
    $st = db()->prepare('SELECT setting_value FROM commission_engine_settings WHERE setting_key=?');
    $st->execute(['tiered_distribution']);
    $raw = $st->fetchColumn();
    $j = is_string($raw) ? json_decode($raw, true) : null;
    if (is_array($j)) $cfg = array_merge($cfg, $j);
  } catch (Throwable $e) {}
  return $cfg;
}
function ct_save_config(array $cfg): void {
  $pdo = db();
  $json = json_encode($cfg, JSON_UNESCAPED_UNICODE);
  $drv = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($drv === 'sqlite') {
    $pdo->prepare('INSERT INTO commission_engine_settings (setting_key,setting_value,updated_by) VALUES (?,?,?)
      ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value, updated_by=excluded.updated_by')
      ->execute(['tiered_distribution',$json,ct_me()]);
  } else {
    $pdo->prepare('INSERT INTO commission_engine_settings (setting_key,setting_value,updated_by) VALUES (?,?,?)
      ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by)')
      ->execute(['tiered_distribution',$json,ct_me()]);
  }
}
function ct_pct_for_count(array $tiers, int $count): float {
  $p = 0.0;
  foreach ($tiers as $t) { if ($count >= (int)($t['min'] ?? 0)) $p = (float)($t['pct'] ?? 0); }
  return $p;
}
function ct_role_of(string $name, array $cfg): string {
  if ($name !== '' && $name === (string)($cfg['managerName'] ?? '')) return 'MANAGER';
  return 'AGENT'; // admin/architect are bonus holders, not special closers (admin closes as AGENT tier)
}

// Compute payouts for a set of deals [{deal_id,closer,commission}] under cfg.
function ct_compute(array $deals, array $cfg): array {
  $count = [];
  foreach ($deals as $d) { $c = (string)$d['closer']; if ($c!=='') $count[$c] = ($count[$c] ?? 0) + 1; }
  $per = []; $perDeal = []; $totalC = 0.0; $paid = 0.0;
  $bump = function(&$per, $name, $key, $amt) {
    if ($name === '') return;
    if (!isset($per[$name])) $per[$name] = ['participant'=>$name,'close'=>0.0,'bonus'=>0.0,'total'=>0.0,'deals'=>0];
    $per[$name][$key] += $amt; $per[$name]['total'] += $amt;
  };
  $flat = (array)($cfg['overrides']['per_user_flat'] ?? []);
  $perDealOv = (array)($cfg['overrides']['per_deal'] ?? []);
  foreach ($deals as $d) {
    $C = (float)$d['commission']; $totalC += $C;
    $closer = (string)$d['closer'];
    $role = ct_role_of($closer, $cfg);
    $line = ['deal_id'=>$d['deal_id'],'closer'=>$closer,'commission'=>$C,'payouts'=>[]];
    // closer payout
    if (isset($perDealOv[$d['deal_id']]['splits']) && is_array($perDealOv[$d['deal_id']]['splits'])) {
      foreach ($perDealOv[$d['deal_id']]['splits'] as $s) {
        $amt = $C * (float)($s['pct'] ?? 0) / 100.0; $bump($per,(string)($s['user'] ?? ''),'close',$amt);
        if (isset($per[(string)($s['user'] ?? '')])) $per[(string)$s['user']]['deals']++;
        $line['payouts'][] = ['to'=>$s['user'] ?? '','kind'=>'close_override','pct'=>$s['pct'] ?? 0,'amount'=>$amt]; $paid += $amt;
      }
    } else {
      if (isset($flat[$closer]['closer_pct'])) $pct = (float)$flat[$closer]['closer_pct'];
      else { $tiers = $role==='MANAGER' ? (array)$cfg['managerTiers'] : (array)$cfg['agentTiers']; $pct = ct_pct_for_count($tiers, (int)$count[$closer]); }
      $amt = $C * $pct / 100.0; $bump($per,$closer,'close',$amt);
      if (isset($per[$closer])) $per[$closer]['deals']++;
      $line['payouts'][] = ['to'=>$closer,'kind'=>'close','pct'=>$pct,'amount'=>$amt]; $paid += $amt;
    }
    // role bonuses
    $bonuses = [
      ['name'=>(string)($cfg['adminName'] ?? ''), 'pct'=>(float)($cfg['adminSupportPct'] ?? 5), 'kind'=>'support', 'skipOwn'=>!($cfg['supportIncludeOwn'] ?? true)],
      ['name'=>(string)($cfg['architectName'] ?? ''), 'pct'=>(float)($cfg['architectSupportPct'] ?? 5), 'kind'=>'support', 'skipOwn'=>!($cfg['supportIncludeOwn'] ?? true)],
      ['name'=>(string)($cfg['managerName'] ?? ''), 'pct'=>(float)($cfg['managerControlPct'] ?? 5), 'kind'=>'control', 'skipOwn'=>!($cfg['managerControlOwn'] ?? false)],
    ];
    foreach ($bonuses as $b) {
      if ($b['name'] === '') continue;
      if ($b['skipOwn'] && $b['name'] === $closer) continue;
      $amt = $C * $b['pct'] / 100.0; $bump($per,$b['name'],'bonus',$amt);
      $line['payouts'][] = ['to'=>$b['name'],'kind'=>$b['kind'],'pct'=>$b['pct'],'amount'=>$amt]; $paid += $amt;
    }
    $perDeal[] = $line;
  }
  foreach ($per as &$p) { $p['close']=round($p['close'],2); $p['bonus']=round($p['bonus'],2); $p['total']=round($p['total'],2); } unset($p);
  return ['perUser'=>array_values($per),'perDeal'=>$perDeal,'totalCommission'=>round($totalC,2),'totalPaid'=>round($paid,2),'company'=>round($totalC-$paid,2)];
}

// Pull closed deals for a month from lease_commission_deals.
function ct_deals_for_month(string $month, array $cfg): array {
  $out = [];
  try {
    $st = db()->query('SELECT id, agent_primary, commission_base, signed_date, stage FROM lease_commission_deals');
    foreach ($st->fetchAll() as $r) {
      $stage = (string)($r['stage'] ?? '');
      if (!in_array($stage, (array)$cfg['triggerStages'], true)) continue;
      $m = substr((string)($r['signed_date'] ?? ''), 0, 7);
      if ($month !== '' && $m !== $month) continue;
      $out[] = ['deal_id'=>(string)$r['id'],'closer'=>trim((string)($r['agent_primary'] ?? '')),'commission'=>(float)($r['commission_base'] ?? 0),'month'=>$m];
    }
  } catch (Throwable $e) {}
  return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $type = (string)($_GET['type'] ?? 'commissions');
  if ($type === 'settings') { if (!ct_can_all()) fail('Нет доступа', 403); json_out(['ok'=>true,'settings'=>ct_config()]); }
  $cfg = ct_config();
  $month = (string)($_GET['month'] ?? gmdate('Y-m'));
  $deals = ct_deals_for_month($month, $cfg);
  $res = ct_compute($deals, $cfg);
  if (!ct_can_all()) {
    // agent view: only own numbers
    $me = ct_me();
    $res['perUser'] = array_values(array_filter($res['perUser'], function($p) use ($me){ return $p['participant'] === $me; }));
    $res['perDeal'] = array_values(array_filter($res['perDeal'], function($d) use ($me){
      foreach ($d['payouts'] as $p) if (($p['to'] ?? '') === $me) return true; return false; }));
    $res['scope'] = 'own';
    unset($res['company'], $res['totalCommission'], $res['totalPaid']); // company totals are management-only
  } else { $res['scope'] = 'all'; }
  json_out(['ok'=>true,'month'=>$month,'result'=>$res,'all_access'=>ct_can_all()]);
}

if ($method === 'POST') {
  require_valid_csrf($_POST ?: (body() ?: []));
  if (!ct_can_all()) fail('Нет доступа к настройке комиссий', 403);
  $b = body();
  if (isset($b['settings']) && is_array($b['settings'])) {
    $cfg = array_merge(ct_config(), $b['settings']);
    ct_save_config($cfg);
    try { audit('commission_tiered_settings','updated'); } catch (Throwable $e) {}
    json_out(['ok'=>true,'settings'=>$cfg]);
  }
  fail('Нет данных для сохранения', 400);
}
fail('Метод не поддерживается', 405);
