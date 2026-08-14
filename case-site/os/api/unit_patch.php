<?php
// CASE OS v4.32.2 — atomic LCR unit patch.
// Prevents an edit to one unit from being lost when another user saves a different module.
require __DIR__.'/lib.php';
$u = require_login();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Метод не поддерживается', 405);
if (in_array((string)($u['role_key'] ?? ''), ['AGX','BSH','BRJ'], true)) fail('Для этой роли LCR доступен только для просмотра', 403);
if (empty($u['edit']) && empty($u['admin'])) fail('Нет прав на изменение LCR', 403);
$b = body();
$id = trim((string)($b['id'] ?? ''));
$changes = $b['changes'] ?? null;
if ($id === '' || !is_array($changes)) fail('Нужны id и changes', 400);
/* Отказ должен быть слышен: молча выбросив поле, мы показали бы пользователю «сохранено»
   там, где ничего не сохранилось, и он узнал бы об этом на переговорах с арендатором. */

// Only business fields of a unit may be changed. Object/id/source links are immutable here.
$allowed = array_flip([
  'code','block','floor','area','terr','cat','sub','rate','budget','budLand','factLand','capex',
  'total','gap','status','broker','assignedTo','assigned_to','vars','shortlist','merged','offer',
  'comment','comments','dates','hist','leaseModel','vat','utilities','terms','opening','reservationEnd',
  'contractSign','contractEnd','rateReview','fitout','handover','specialTerms','brand','tenant',
  'layoutVersionId','layoutVersionNo','layoutSource','manualOverride','updatedAt','updatedBy'
]);
/* P0-SEC-02: право edit разрешало агенту аренды менять ставку, бюджет и CAPEX через этот
   эндпоинт, хотя по описанию роли он ведёт показы и брони. Экран этих полей ему не
   показывает, но эндпоинт принимал их без единой проверки. Список финансовых полей -
   общий с state.php и units_batch.php (lib.php: unit_finance_fields). */
$financeLocked = !unit_can_see_finance($u) ? array_flip(unit_finance_fields()) : [];
$blocked = [];

$clean = [];
foreach ($changes as $k=>$v) {
  $k = (string)$k;
  if (!isset($allowed[$k])) continue;
  if (isset($financeLocked[$k])) { $blocked[] = $k; continue; }
  if ($k === 'offer' && !unit_can_see_finance($u)) { $blocked[] = $k; continue; }
  if (in_array($k, ['code','block','floor','cat','sub','status','broker','assignedTo','assigned_to','comment','leaseModel','vat','terms','opening','reservationEnd','contractSign','contractEnd','rateReview','fitout','handover','specialTerms','brand','tenant','layoutVersionId','layoutVersionNo','layoutSource','updatedAt','updatedBy'], true)) {
    $clean[$k] = mb_substr(trim((string)$v), 0, 4000);
  } elseif (in_array($k, ['area','terr','rate','budget','budLand','factLand','capex','total','gap'], true)) {
    if (!is_numeric($v) && $v !== '' && $v !== null) fail('Некорректное числовое значение: '.$k, 400);
    $clean[$k] = ($v === '' || $v === null) ? 0 : (float)$v;
  } elseif (in_array($k, ['vars','shortlist','merged','offer','comments','dates','hist','utilities'], true)) {
    if (!is_array($v) && $v !== null) fail('Поле '.$k.' должно быть массивом', 400);
    $clean[$k] = $v === null ? [] : $v;
  } else {
    $clean[$k] = $v;
  }
}
if (!$clean) fail('Нет разрешённых изменений', 400);

$pdo = db();
$pdo->beginTransaction();
try {
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $sql = 'SELECT data,revision FROM app_state WHERE id=1'.($driver === 'mysql' ? ' FOR UPDATE' : '');
  $st = $pdo->query($sql);
  $row = $st->fetch();
  if (!$row) fail('Состояние платформы не найдено', 404);
  $data = json_decode((string)($row['data'] ?? ''), true);
  if (!is_array($data)) fail('Состояние платформы повреждено', 500);
  $units = isset($data['U']) && is_array($data['U']) ? $data['U'] : [];
  $idx = -1;
  foreach ($units as $i=>$unit) {
    if (is_array($unit) && (string)($unit['id'] ?? '') === $id) { $idx = (int)$i; break; }
  }
  if ($idx < 0) fail('Помещение не найдено', 404);
  $unit = $units[$idx];
  $objId = (string)($unit['obj'] ?? '');
  if (!user_project_allowed($objId)) fail('Нет доступа к проекту', 403);

  // Own-only internal users may change only their unit or assign an unassigned unit to themselves.
  if (!empty($u['own_only']) && empty($u['admin'])) {
    $me = owner_identity($u);
    $currentBroker = trim((string)($unit['broker'] ?? ''));
    $requestedBroker = array_key_exists('broker', $clean) ? trim((string)$clean['broker']) : $currentBroker;
    if ($currentBroker !== '' && $currentBroker !== '-' && $currentBroker !== $me) fail('Можно изменять только свои помещения', 403);
    if ($requestedBroker !== '' && $requestedBroker !== '-' && $requestedBroker !== $me) fail('Нельзя назначить помещение другому брокеру', 403);
  }

  foreach ($clean as $k=>$v) $unit[$k] = $v;
  $unit['updatedAt'] = date('c');
  $unit['updatedBy'] = (string)($u['name'] ?? '-');
  $units[$idx] = $unit;
  $data['U'] = $units;
  $json = json_encode($data, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось сериализовать состояние', 500);
  if (strlen($json) > json_body_limit_bytes()) fail('Состояние слишком большое для сохранения', 413);
  $now = date('Y-m-d H:i:s');
  $newRev = (int)($row['revision'] ?? 0) + 1;
  $pdo->prepare('UPDATE app_state SET data=?, updated_at=?, updated_by=?, revision=? WHERE id=1')
      ->execute([$json, $now, (string)($u['name'] ?? '-'), $newRev]);
  try { audit('LCR: атомарная правка помещения', $id.' · '.implode(',', array_keys($clean))); } catch (Throwable $e) {}
  $pdo->commit();
  /* Отданное помещение тоже чистим: иначе ответ вернул бы ставку роли, которой её
     только что запретили менять, и она увидела бы её в ответе эндпоинта. */
  $safeUnit = unit_can_see_finance($u) ? $unit : (redact_units_for([$unit], $u)[0] ?? $unit);
  json_out(['ok'=>true,'unit'=>$safeUnit,'revision'=>$newRev,'updated_at'=>$now]
    + (!empty($blocked) ? ['blocked_fields'=>array_values(array_unique($blocked))] : []));
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  if ($e instanceof PDOException) fail('Не удалось сохранить помещение', 500);
  throw $e;
}
