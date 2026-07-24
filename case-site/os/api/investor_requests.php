<?php
// CASE OS v4.32.2 — investor purchase requests endpoint.
require __DIR__.'/lib.php';
$u = require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$isExternal = (($u['role_key'] ?? '') === 'AGX');

if ($method === 'GET') {
  if ($isExternal) json_out(['ok'=>true,'rows'=>[]]);
  json_out(['ok'=>true,'rows'=>list_table('investor_requests', $_GET)]);
}
if ($method === 'POST') {
  $b = body();
  if ($isExternal) {
    if (!array_key_exists('row', $b) || !is_array($b['row'])) fail('Нужно поле row', 400);
    $in = $b['row'];
    $name = trim((string)($in['investor_name'] ?? $in['investor'] ?? ''));
    if ($name === '') fail('Укажите имя или название инвестора', 400);
    $num = function($v) { return ($v === '' || $v === null) ? null : (is_numeric($v) ? (float)$v : null); };
    $row = [
      'investor_name'=>mb_substr($name,0,190),
      'country'=>mb_substr(trim((string)($in['country'] ?? 'Узбекистан')),0,120),
      'city'=>mb_substr(trim((string)($in['city'] ?? '')),0,120),
      'asset_type'=>mb_substr(trim((string)($in['asset_type'] ?? $in['assetType'] ?? '')),0,190),
      'area_min'=>$num($in['area_min'] ?? $in['areaMin'] ?? null),
      'area_max'=>$num($in['area_max'] ?? $in['areaMax'] ?? null),
      'budget_min'=>$num($in['budget_min'] ?? $in['budgetMin'] ?? null),
      'budget_max'=>$num($in['budget_max'] ?? $in['budgetMax'] ?? null),
      'cap_rate'=>mb_substr(trim((string)($in['cap_rate'] ?? $in['capRate'] ?? '')),0,120),
      'proof_funds'=>'pending',
      'preferences'=>mb_substr(trim((string)($in['preferences'] ?? $in['note'] ?? '')),0,4000),
      'stage'=>'new','source'=>'external_agent',
      'contact'=>mb_substr(trim((string)($in['contact'] ?? '')),0,500),
      'broker'=>owner_identity($u),'next_action'=>'Внутренняя проверка',
      'due_date'=>date('Y-m-d', time()+3*86400),'potential_fee'=>null,
      'visibility'=>'internal','partner_id'=>null,'created_by'=>(string)($u['id'] ?? '')
    ];
    $saved = upsert_row('investor_requests', $row);
    audit('Внешний агент: новый инвестор на проверку', $name);
    json_out(['ok'=>true,'submitted'=>true,'row'=>['id'=>$saved['id'] ?? null,'stage'=>'new']]);
  }
  if (array_key_exists('delete', $b)) { delete_row('investor_requests', $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) { json_out(['ok'=>true,'row'=>upsert_row('investor_requests', $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}
fail('Метод не поддерживается', 405);
