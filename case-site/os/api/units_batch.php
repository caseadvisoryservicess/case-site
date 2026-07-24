<?php
// CASE OS v4.32.2 — atomic structural LCR mutations (create / update / delete multiple units).
// Used for merge, split, renumber, bulk delete and unit creation without replacing the whole platform state.
require __DIR__.'/lib.php';
$u = require_login();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Метод не поддерживается', 405);
if (($u['role_key'] ?? '') === 'AGX') fail('Внешнему агенту изменение LCR недоступно', 403);
if (empty($u['edit']) && empty($u['admin'])) fail('Нет прав на изменение LCR', 403);
$b = body();
$upserts = isset($b['upserts']) && is_array($b['upserts']) ? $b['upserts'] : [];
$deletes = isset($b['deletes']) && is_array($b['deletes']) ? $b['deletes'] : [];
if (!$upserts && !$deletes) fail('Нет изменений помещений', 400);
if (count($upserts) > 1000 || count($deletes) > 1000) fail('Слишком много изменений за один запрос', 413);

$pdo = db();
$pdo->beginTransaction();
try {
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $row = $pdo->query('SELECT data,revision FROM app_state WHERE id=1'.($driver === 'mysql' ? ' FOR UPDATE' : ''))->fetch();
  if (!$row) fail('Состояние платформы не найдено', 404);
  $data = json_decode((string)($row['data'] ?? ''), true);
  if (!is_array($data)) fail('Состояние платформы повреждено', 500);
  $units = isset($data['U']) && is_array($data['U']) ? array_values($data['U']) : [];
  $index = [];
  foreach ($units as $i=>$unit) if (is_array($unit) && isset($unit['id'])) $index[(string)$unit['id']] = (int)$i;
  $me = owner_identity($u);

  $canTouch = static function(array $unit) use ($u,$me): void {
    $obj = trim((string)($unit['obj'] ?? ''));
    if ($obj === '' || !user_project_allowed($obj)) fail('Нет доступа к проекту', 403);
    if (!empty($u['own_only']) && empty($u['admin'])) {
      $broker = trim((string)($unit['broker'] ?? ''));
      if ($broker !== '' && $broker !== '-' && $broker !== $me) fail('Можно изменять только свои помещения', 403);
    }
  };

  $deleteSet = [];
  foreach ($deletes as $rawId) {
    $id = trim((string)$rawId);
    if ($id === '' || isset($deleteSet[$id])) continue;
    if (isset($index[$id])) $canTouch($units[$index[$id]]);
    $deleteSet[$id] = true;
  }
  if ($deleteSet) {
    $units = array_values(array_filter($units, static function($unit) use ($deleteSet) {
      return !is_array($unit) || !isset($deleteSet[(string)($unit['id'] ?? '')]);
    }));
    $index = [];
    foreach ($units as $i=>$unit) if (is_array($unit) && isset($unit['id'])) $index[(string)$unit['id']] = (int)$i;
  }

  $saved = [];
  foreach ($upserts as $incoming) {
    if (!is_array($incoming)) continue;
    $id = trim((string)($incoming['id'] ?? ''));
    $obj = trim((string)($incoming['obj'] ?? ''));
    if ($id === '' || $obj === '') fail('У помещения отсутствует id или проект', 400);
    $encoded = json_encode($incoming, JSON_UNESCAPED_UNICODE);
    if ($encoded === false || strlen($encoded) > 131072) fail('Запись помещения слишком большая', 413);
    if (isset($index[$id])) {
      $old = $units[$index[$id]];
      $canTouch($old);
      if ((string)($old['obj'] ?? '') !== $obj) fail('Нельзя перенести помещение в другой проект этим действием', 400);
      // Merge to preserve fields added by another module that are absent in the current client.
      $unit = array_replace($old, $incoming);
      $unit['id'] = $id;
      $unit['obj'] = (string)($old['obj'] ?? $obj);
      $canTouch($unit);
      $units[$index[$id]] = $unit;
    } else {
      $unit = $incoming;
      $unit['id'] = $id;
      $unit['obj'] = $obj;
      $canTouch($unit);
      if (!empty($u['own_only']) && empty($u['admin'])) {
        $broker = trim((string)($unit['broker'] ?? ''));
        if ($broker === '' || $broker === '-') $unit['broker'] = $me;
      }
      $units[] = $unit;
      $index[$id] = count($units)-1;
    }
    $idx = $index[$id];
    $units[$idx]['updatedAt'] = date('c');
    $units[$idx]['updatedBy'] = (string)($u['name'] ?? '-');
    $saved[] = $units[$idx];
  }

  $data['U'] = array_values($units);
  $json = json_encode($data, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось сериализовать состояние', 500);
  if (strlen($json) > json_body_limit_bytes()) fail('Состояние слишком большое для сохранения', 413);
  $now = date('Y-m-d H:i:s');
  $newRev = (int)($row['revision'] ?? 0) + 1;
  $pdo->prepare('UPDATE app_state SET data=?, updated_at=?, updated_by=?, revision=? WHERE id=1')
      ->execute([$json, $now, (string)($u['name'] ?? '-'), $newRev]);
  try { audit('LCR: атомарное структурное изменение', 'upsert='.count($saved).' delete='.count($deleteSet)); } catch (Throwable $e) {}
  $pdo->commit();
  json_out(['ok'=>true,'units'=>$saved,'deleted'=>array_keys($deleteSet),'revision'=>$newRev,'updated_at'=>$now]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  if ($e instanceof PDOException) fail('Не удалось сохранить изменения помещений', 500);
  throw $e;
}
