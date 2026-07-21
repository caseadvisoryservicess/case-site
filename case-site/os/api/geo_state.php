<?php
// CASE OS v4.17.0 — dedicated, transactional Geoanalytics persistence.
declare(strict_types=1);
require __DIR__.'/lib.php';

$u = require_login();
$pdo = db();
$state = asaas_load_app_state_data();
if (!asaas_workspace_can_view($u, 'geoanalytics', $state)) fail('Нет доступа к геоаналитике', 403);

// Sanitize the geo payload in place rather than hard-rejecting the whole save.
// A single legacy row (blank/zero coords, a scheme-less link like "abnmbgroup.com")
// used to abort the entire save with 400, so NOTHING in Geoanalytics could be saved.
// Now we only hard-fail on structural/size problems; per-row data quirks are healed:
// scheme-less domain URLs gain https://, unusable URLs are dropped, invalid coords are
// dropped (row kept, just unplaced), and alcohol enums are coerced to a safe default.
function geo_validate_payload(&$geo): void {
  if (!is_array($geo)) fail('GEO_DATA должен быть объектом', 400);
  if (!isset($geo['datasets']) || !is_array($geo['datasets'])) fail('GEO_DATA.datasets должен быть объектом', 400);
  $alcohol = ['unknown','yes','no','limited','seasonal'];
  $alcoholVerification = ['not_checked','official_menu','phone','field','owner'];
  $urlKeys = ['website','sourceUrl','googleUrl','yandexUrl','dgisUrl','alcoholSourceUrl'];
  $total = 0;
  foreach ($geo['datasets'] as $name=>&$rows) {
    if (!is_array($rows)) continue;
    $total += count($rows);
    if ($total > 100000) fail('Слишком много записей в GEO_DATA', 413); // genuine safety cap
    foreach ($rows as $i=>&$row) {
      if (!is_array($row)) continue;
      $latKey = $name === 'medicine' ? 'la' : 'lat';
      $lngKey = $name === 'medicine' ? 'ln' : 'lng';
      $hasLat = array_key_exists($latKey, $row) && $row[$latKey] !== '' && $row[$latKey] !== null;
      $hasLng = array_key_exists($lngKey, $row) && $row[$lngKey] !== '' && $row[$lngKey] !== null;
      if ($hasLat || $hasLng) {
        $bad = (!$hasLat || !$hasLng || !is_numeric($row[$latKey]) || !is_numeric($row[$lngKey]));
        if (!$bad) {
          $lat = (float)$row[$latKey]; $lng = (float)$row[$lngKey];
          if (($lat === 0.0 && $lng === 0.0) || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) $bad = true;
        }
        if ($bad) { unset($row[$latKey]); unset($row[$lngKey]); } // drop unusable coords, keep the record
      }
      foreach ($urlKeys as $urlKey) {
        if (!array_key_exists($urlKey, $row)) continue;
        $url = trim((string)$row[$urlKey]);
        if ($url === '' || preg_match('~^https?://~i', $url)) { $row[$urlKey] = $url; continue; }
        if (preg_match('~^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}([/?#].*)?$~i', $url)) $row[$urlKey] = 'https://'.$url;
        else $row[$urlKey] = '';
      }
      if ($name === 'restaurants' || $name === 'cafes') {
        if (!in_array((string)($row['alcoholStatus'] ?? 'unknown'), $alcohol, true)) $row['alcoholStatus'] = 'unknown';
        if (!in_array((string)($row['alcoholVerification'] ?? 'not_checked'), $alcoholVerification, true)) $row['alcoholVerification'] = 'not_checked';
      }
    }
    unset($row);
  }
  unset($rows);
}

function geo_history_ensure(PDO $pdo): void {
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->exec('CREATE TABLE IF NOT EXISTS geo_state_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_revision INTEGER NOT NULL DEFAULT 0,
      geo_revision INTEGER NOT NULL DEFAULT 0,
      geo_json TEXT NOT NULL,
      checksum TEXT NOT NULL,
      reason TEXT NULL,
      updated_by TEXT NULL,
      created_at TEXT NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_geo_hist_created ON geo_state_history(created_at)');
  } else {
    $pdo->exec('CREATE TABLE IF NOT EXISTS geo_state_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      app_revision BIGINT NOT NULL DEFAULT 0,
      geo_revision BIGINT NOT NULL DEFAULT 0,
      geo_json LONGTEXT NOT NULL,
      checksum CHAR(64) NOT NULL,
      reason VARCHAR(500) NULL,
      updated_by VARCHAR(190) NULL,
      created_at DATETIME NOT NULL,
      KEY idx_geo_hist_created (created_at),
      KEY idx_geo_hist_revision (geo_revision)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  }
}

function geo_is_list_array(array $a): bool {
  $i = 0; foreach ($a as $k=>$v) { if ($k !== $i++) return false; } return true;
}

function geo_row_key(array $row, int $i): string {
  foreach (['master_id','id','seed_object_id','object_id'] as $k) {
    $v = trim((string)($row[$k] ?? ''));
    if ($v !== '') return $k.':'.$v;
  }
  $name = trim((string)($row['name'] ?? $row['n'] ?? ''));
  $lat = $row['lat'] ?? $row['la'] ?? '';
  $lng = $row['lng'] ?? $row['ln'] ?? '';
  if ($name !== '') return 'name:'.mb_strtolower($name).'|'.$lat.'|'.$lng;
  return 'index:'.$i;
}

function geo_without_audit(array $row): array {
  foreach (['_updatedAt','_updatedBy','_updatedRole','_updateSource'] as $k) unset($row[$k]);
  return $row;
}

function geo_stamp_changed_rows(array $incoming, array $old, array $u, string $now): array {
  $oldSets = isset($old['datasets']) && is_array($old['datasets']) ? $old['datasets'] : [];
  if (!isset($incoming['datasets']) || !is_array($incoming['datasets'])) return $incoming;
  foreach ($incoming['datasets'] as $setName=>&$rows) {
    if (!is_array($rows)) continue;
    $oldRows = isset($oldSets[$setName]) && is_array($oldSets[$setName]) ? $oldSets[$setName] : [];
    $oldIndex = [];
    foreach ($oldRows as $oi=>$orow) if (is_array($orow) && !geo_is_list_array($orow)) $oldIndex[geo_row_key($orow, (int)$oi)] = $orow;
    foreach ($rows as $i=>&$row) {
      if (!is_array($row) || geo_is_list_array($row)) continue;
      $key = geo_row_key($row, (int)$i);
      $prev = $oldIndex[$key] ?? null;
      $changed = $prev === null || geo_without_audit($row) !== geo_without_audit($prev);
      if ($changed) {
        $row['_updatedAt'] = $now;
        $row['_updatedBy'] = (string)($u['name'] ?? '-');
        $row['_updatedRole'] = (string)($u['role_key'] ?? '');
        $row['_updateSource'] = 'CASE OS Geoanalytics';
      } elseif (is_array($prev)) {
        foreach (['_updatedAt','_updatedBy','_updatedRole','_updateSource'] as $ak) if (array_key_exists($ak,$prev)) $row[$ak] = $prev[$ak];
      }
    }
    unset($row);
  }
  unset($rows);
  return $incoming;
}

$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$historyReady = false;
if ($m === 'POST' || isset($_GET['history'])) {
  try { geo_history_ensure($pdo); $historyReady = true; } catch (Throwable $e) { $historyReady = false; }
}
if ($m === 'GET') {
  if (isset($_GET['history'])) {
    if (!asaas_geo_can_edit($u)) fail('История доступна только редакторам', 403);
    if (!$historyReady) fail('История сохранений пока недоступна. Запустите api/migrate.php.', 503);
    $st = $pdo->query('SELECT id,app_revision,geo_revision,checksum,reason,updated_by,created_at FROM geo_state_history ORDER BY id DESC LIMIT 50');
    json_out(['history'=>$st->fetchAll()]);
  }
  $st = $pdo->query('SELECT data,updated_at,updated_by,revision FROM app_state WHERE id=1');
  $row = $st->fetch();
  $all = ($row && !empty($row['data'])) ? json_decode((string)$row['data'], true) : [];
  if (!is_array($all)) $all = [];
  $geo = isset($all['GEO_DATA']) && is_array($all['GEO_DATA']) ? $all['GEO_DATA'] : null;
  $geoRev = (int)($geo['meta']['serverRevision'] ?? 0);
  json_out(['data'=>$geo,'geo_revision'=>$geoRev,'app_revision'=>(int)($row['revision'] ?? 0),'updated_at'=>$row['updated_at'] ?? null,'updated_by'=>$row['updated_by'] ?? null]);
}

if ($m === 'POST') {
  if (!asaas_geo_can_edit($u)) fail('Нет прав на изменение геоданных', 403);
  $b = body();
  $action = (string)($b['action'] ?? 'save');
  if ($action === 'restore') {
    if (empty($u['admin'])) fail('Восстановление снимка доступно администратору', 403);
    $id = (int)($b['history_id'] ?? 0);
    if ($id <= 0) fail('Не указан снимок', 400);
    $st = $pdo->prepare('SELECT geo_json,reason FROM geo_state_history WHERE id=?');
    $st->execute([$id]);
    $snap = $st->fetch();
    if (!$snap) fail('Снимок не найден', 404);
    $restored = json_decode((string)$snap['geo_json'], true);
    if (!is_array($restored)) fail('Снимок повреждён', 500);
    $b['data'] = $restored;
    $b['reason'] = 'Восстановление снимка #'.$id;
  }
  if (!array_key_exists('data',$b) || !is_array($b['data'])) fail('Нужно поле data', 400);
  geo_validate_payload($b['data']);
  $reason = trim((string)($b['reason'] ?? 'ручное редактирование'));
  if (strlen($reason) > 500) $reason = substr($reason,0,500);
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  try {
    $pdo->beginTransaction();
    $sql = 'SELECT data,updated_at,updated_by,revision FROM app_state WHERE id=1'.($driver === 'mysql' ? ' FOR UPDATE' : '');
    $st = $pdo->query($sql);
    $row = $st->fetch();
    $all = ($row && !empty($row['data'])) ? json_decode((string)$row['data'], true) : [];
    if (!is_array($all)) $all = [];
    $oldGeo = isset($all['GEO_DATA']) && is_array($all['GEO_DATA']) ? $all['GEO_DATA'] : [];
    $serverGeoRev = (int)($oldGeo['meta']['serverRevision'] ?? 0);
    $expected = array_key_exists('expected_geo_revision',$b) ? (int)$b['expected_geo_revision'] : null;
    if ($expected !== null && $expected !== $serverGeoRev) {
      $pdo->rollBack();
      fail('Геоданные уже изменены другим пользователем. Обновите модуль и повторите сохранение.', 409);
    }
    $nowIso = gmdate('c');
    $nowDb = date('Y-m-d H:i:s');
    $incoming = geo_stamp_changed_rows($b['data'], $oldGeo, $u, $nowIso);
    $incoming['updatedAt'] = $nowIso;
    $incoming['updatedBy'] = (string)($u['name'] ?? '-');
    $incoming['meta'] = isset($incoming['meta']) && is_array($incoming['meta']) ? $incoming['meta'] : [];
    $incoming['meta']['serverRevision'] = $serverGeoRev + 1;
    $incoming['meta']['lastSavedAt'] = $nowIso;
    $incoming['meta']['lastSavedBy'] = (string)($u['name'] ?? '-');
    $incoming['meta']['lastSaveReason'] = $reason;
    $incomingJson = json_encode($incoming, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if ($incomingJson === false) { $pdo->rollBack(); fail('Не удалось сериализовать геоданные', 400); }
    if (strlen($incomingJson) > json_body_limit_bytes()) { $pdo->rollBack(); fail('Геоданные слишком большие для сохранения', 413); }
    $oldJson = $oldGeo ? json_encode($oldGeo, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) : '';
    if ($historyReady && $oldJson && hash('sha256',$oldJson) !== hash('sha256',$incomingJson)) {
      $hist = $pdo->prepare('INSERT INTO geo_state_history (app_revision,geo_revision,geo_json,checksum,reason,updated_by,created_at) VALUES (?,?,?,?,?,?,?)');
      $hist->execute([(int)($row['revision'] ?? 0),$serverGeoRev,$oldJson,hash('sha256',$oldJson),$reason,(string)($u['name'] ?? '-'),$nowDb]);
    }
    $all['GEO_DATA'] = $incoming;
    // Освобождаем крупные промежуточные копии перед финальным encode (пик памяти на
    // гео-мастербазе доходил до fatal 128 МБ). $incomingJson ещё нужен для checksum ниже.
    unset($oldGeo, $oldJson, $row['data']);
    if (function_exists('gc_collect_cycles')) gc_collect_cycles();
    $allJson = json_encode($all, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if ($allJson === false || strlen($allJson) > json_body_limit_bytes()) { $pdo->rollBack(); fail('Общее состояние слишком большое для сохранения', 413); }
    $appRev = (int)($row['revision'] ?? 0) + 1;
    if ($row) {
      $up = $pdo->prepare('UPDATE app_state SET data=?,updated_at=?,updated_by=?,revision=? WHERE id=1');
      $up->execute([$allJson,$nowDb,(string)($u['name'] ?? '-'),$appRev]);
    } else {
      $ins = $pdo->prepare('INSERT INTO app_state (id,data,updated_at,updated_by,revision) VALUES (1,?,?,?,?)');
      $ins->execute([$allJson,$nowDb,(string)($u['name'] ?? '-'),$appRev]);
    }
    $pdo->commit();
    try { audit('geo_state_saved','reason='.$reason.' geo_revision='.($serverGeoRev+1)); } catch (Throwable $e) {}
    json_out(['ok'=>true,'data'=>$incoming,'geo_revision'=>$serverGeoRev+1,'app_revision'=>$appRev,'updated_at'=>$nowDb,'updated_by'=>(string)($u['name'] ?? '-'),'checksum'=>hash('sha256',$incomingJson)]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fail('Не удалось сохранить геоданные: '.$e->getMessage(), 500);
  }
}

fail('Метод не поддерживается',405);
