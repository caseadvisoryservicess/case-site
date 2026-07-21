<?php
// CASE OS v4.17.0 — authenticated workspace/action capability check.
declare(strict_types=1);
require __DIR__.'/lib.php';

$u = require_login();
$view = trim((string)($_GET['view'] ?? ''));
$known = [];
foreach (asaas_workspace_default_views() as $views) {
  foreach ((array)$views as $v) if (is_string($v) && $v !== '' && !in_array($v, $known, true)) $known[] = $v;
}
if ($view === '' || !in_array($view, $known, true)) fail('Неизвестный раздел', 400);
$state = asaas_load_app_state_data();
$allowed = asaas_workspace_can_view($u, $view, $state);
if (!$allowed) fail('Раздел не включён в вашу рабочую область', 403);

json_out([
  'view'=>$view,
  'allowed'=>true,
  'can_edit'=>!empty($u['edit']) || !empty($u['finance']) || !empty($u['admin']),
  'can_finance'=>!empty($u['finance']) || !empty($u['admin']),
  'can_approve'=>!empty($u['approve']) || !empty($u['admin']),
  'can_admin'=>!empty($u['admin']),
]);
