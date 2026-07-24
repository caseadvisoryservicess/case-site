<?php
// CASE OS v4.32.2 — inbound brand requests endpoint.
require __DIR__.'/lib.php';
$u = require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$isExternal = (($u['role_key'] ?? '') === 'AGX');

if ($method === 'GET') {
  // External agents only submit a new lead; they cannot enumerate the request database.
  if ($isExternal) json_out(['ok'=>true,'rows'=>[]]);
  json_out(['ok'=>true,'rows'=>list_table('brand_requests', $_GET)]);
}
if ($method === 'POST') {
  $b = body();
  if ($isExternal) {
    if (!array_key_exists('row', $b) || !is_array($b['row'])) fail('Нужно поле row', 400);
    $in = $b['row'];
    $name = trim((string)($in['brand_name'] ?? $in['brand'] ?? ''));
    if ($name === '') fail('Укажите название бренда', 400);
    $num = function($v) { return ($v === '' || $v === null) ? null : (is_numeric($v) ? (float)$v : null); };
    $row = [
      'brand_name'=>mb_substr($name,0,190),
      'country'=>mb_substr(trim((string)($in['country'] ?? 'Узбекистан')),0,120),
      'city'=>mb_substr(trim((string)($in['city'] ?? '')),0,120),
      'category'=>mb_substr(trim((string)($in['category'] ?? '')),0,190),
      'area_min'=>$num($in['area_min'] ?? $in['areaMin'] ?? null),
      'area_max'=>$num($in['area_max'] ?? $in['areaMax'] ?? null),
      'budget_max'=>null,
      'preferences'=>mb_substr(trim((string)($in['preferences'] ?? $in['note'] ?? '')),0,4000),
      'stage'=>'new','source'=>'external_agent','broker'=>owner_identity($u),
      'next_action'=>'Внутренняя проверка','due_date'=>date('Y-m-d', time()+3*86400),
      'potential_fee'=>null,'visibility'=>'internal','partner_id'=>null,'created_by'=>(string)($u['id'] ?? '')
    ];
    $saved = upsert_row('brand_requests', $row);
    audit('Внешний агент: новый бренд на проверку', $name);
    json_out(['ok'=>true,'submitted'=>true,'row'=>['id'=>$saved['id'] ?? null,'stage'=>'new']]);
  }
  if (array_key_exists('delete', $b)) { delete_row('brand_requests', $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row', $b)) { json_out(['ok'=>true,'row'=>upsert_row('brand_requests', $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}
fail('Метод не поддерживается', 405);
