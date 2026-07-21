<?php
// CASE OS v4.17.0 — protected Financial Feasibility scenarios.
// Module visibility comes from the configurable workspace; writes require action rights.
declare(strict_types=1);
require __DIR__.'/lib.php';

$u = require_login();
$state = asaas_load_app_state_data();
if (!asaas_workspace_can_view($u, 'feasibility', $state)) fail('Финансовая модель не включена в вашу рабочую область', 403);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' && !can('edit') && !can('finance') && !can('admin')) fail('Нет права редактировать финансовые модели', 403);

function feas_status(string $s): string {
  $s = strtolower(trim($s));
  return in_array($s, ['draft','review','approved','archived'], true) ? $s : 'draft';
}
function feas_ensure_schema(): void {
  $pdo = db();
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  if ($driver === 'sqlite') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS feasibility_models (
      id TEXT PRIMARY KEY, obj_id TEXT NOT NULL, scenario_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft', model_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, created_by_id TEXT, created_by_name TEXT,
      updated_by_id TEXT, updated_by_name TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS feasibility_model_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, model_id TEXT NOT NULL, revision INTEGER NOT NULL,
      status TEXT NOT NULL, model_json TEXT NOT NULL, saved_by_id TEXT, saved_by_name TEXT, saved_at TEXT NOT NULL,
      UNIQUE(model_id, revision)
    )");
  } else {
    $pdo->exec("CREATE TABLE IF NOT EXISTS feasibility_models (
      id VARCHAR(36) PRIMARY KEY, obj_id VARCHAR(80) NOT NULL, scenario_name VARCHAR(190) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'draft', model_json LONGTEXT NOT NULL,
      revision INT NOT NULL DEFAULT 1, created_by_id VARCHAR(64) NULL, created_by_name VARCHAR(190) NULL,
      updated_by_id VARCHAR(64) NULL, updated_by_name VARCHAR(190) NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL,
      KEY idx_feas_obj (obj_id), KEY idx_feas_status (status), KEY idx_feas_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS feasibility_model_versions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, model_id VARCHAR(36) NOT NULL,
      revision INT NOT NULL, status VARCHAR(30) NOT NULL, model_json LONGTEXT NOT NULL,
      saved_by_id VARCHAR(64) NULL, saved_by_name VARCHAR(190) NULL, saved_at DATETIME NOT NULL,
      UNIQUE KEY uq_feas_version (model_id, revision), KEY idx_feas_version_model (model_id), KEY idx_feas_version_saved (saved_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  }
}
function feas_record(string $id): array {
  $st = db()->prepare('SELECT * FROM feasibility_models WHERE id=?');
  $st->execute([$id]);
  $r = $st->fetch();
  if (!$r) fail('Финансовая модель не найдена', 404);
  $r['model'] = json_decode((string)$r['model_json'], true) ?: [];
  unset($r['model_json']);
  $vs = db()->prepare('SELECT id,model_id,revision,status,saved_by_id,saved_by_name,saved_at FROM feasibility_model_versions WHERE model_id=? ORDER BY revision DESC, id DESC');
  $vs->execute([$id]);
  $r['versions'] = $vs->fetchAll();
  return $r;
}

try { feas_ensure_schema(); }
catch (Throwable $e) {
  error_log('CASE OS feasibility schema error: '.$e->getMessage());
  fail('Не удалось подготовить хранилище финансовых моделей. Примените миграции v4.0.0.', 500);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $id = trim((string)($_GET['id'] ?? ''));
  if ($id !== '') json_out(['record'=>feas_record($id)]);
  $st = db()->query('SELECT id,obj_id,scenario_name,status,revision,created_by_name,updated_by_name,created_at,updated_at FROM feasibility_models ORDER BY updated_at DESC, scenario_name ASC');
  json_out(['records'=>$st->fetchAll()]);
}

if ($method !== 'POST') fail('Метод не поддерживается', 405);
$b = body();
$action = strtolower(trim((string)($b['action'] ?? 'save')));

if ($action === 'delete') {
  $id = trim((string)($b['id'] ?? ''));
  if ($id === '') fail('Не указан ID модели', 400);
  $pdo = db(); $pdo->beginTransaction();
  try {
    $pdo->prepare('DELETE FROM feasibility_model_versions WHERE model_id=?')->execute([$id]);
    $pdo->prepare('DELETE FROM feasibility_models WHERE id=?')->execute([$id]);
    $pdo->commit();
    audit('Финмодель: удаление', $id);
    json_out(['ok'=>true]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    error_log('CASE OS feasibility delete error: '.$e->getMessage());
    fail('Не удалось удалить финансовую модель', 500);
  }
}

if ($action === 'restore') {
  $id = trim((string)($b['id'] ?? ''));
  $revision = (int)($b['revision'] ?? 0);
  if ($id === '' || $revision < 1) fail('Некорректная версия', 400);
  $st = db()->prepare('SELECT * FROM feasibility_model_versions WHERE model_id=? AND revision=? ORDER BY id DESC LIMIT 1');
  $st->execute([$id,$revision]);
  $v = $st->fetch();
  if (!$v) fail('Версия не найдена', 404);
  $meta = db()->prepare('SELECT obj_id,scenario_name,revision FROM feasibility_models WHERE id=?');
  $meta->execute([$id]);
  $m = $meta->fetch();
  if (!$m) fail('Модель не найдена', 404);
  $b = [
    'id'=>$id,
    'obj_id'=>$m['obj_id'],
    'scenario_name'=>$m['scenario_name'],
    'status'=>$v['status'],
    'model'=>json_decode((string)$v['model_json'], true) ?: [],
    'expected_revision'=>(int)$m['revision']
  ];
  $action = 'save';
}

if ($action !== 'save') fail('Неизвестное действие', 400);

$id = trim((string)($b['id'] ?? '')) ?: uuid();
if (!preg_match('/^[a-zA-Z0-9._-]{1,36}$/', $id)) fail('Некорректный ID модели', 400);
$obj = trim((string)($b['obj_id'] ?? 'ALL')) ?: 'ALL';
if (strlen($obj) > 80) fail('Некорректный ID проекта', 400);
$name = trim((string)($b['scenario_name'] ?? ''));
if ($name === '') fail('Введите название сценария', 400);
if (function_exists('mb_strlen') ? mb_strlen($name, 'UTF-8') > 190 : strlen($name) > 190) fail('Название сценария слишком длинное', 400);
$status = feas_status((string)($b['status'] ?? 'draft'));
$model = $b['model'] ?? null;
$expectedRevision = max(0, (int)($b['expected_revision'] ?? 0));
if (!is_array($model)) fail('Некорректные данные финансовой модели', 400);
if (!isset($model['project']) || !is_array($model['project'])) fail('В модели отсутствуют параметры проекта', 400);
$json = json_encode($model, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($json === false || strlen($json) > 5*1024*1024) fail('Финансовая модель слишком большая или повреждена', 413);

$now = date('Y-m-d H:i:s');
$pdo = db(); $pdo->beginTransaction();
try {
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $st = $pdo->prepare('SELECT revision FROM feasibility_models WHERE id=?'.($driver === 'mysql' ? ' FOR UPDATE' : ''));
  $st->execute([$id]);
  $old = $st->fetch();
  if (($old && $expectedRevision > 0 && (int)$old['revision'] !== $expectedRevision) || (!$old && $expectedRevision > 0)) {
    $pdo->rollBack();
    fail('Модель уже изменена другим пользователем. Откройте последнюю версию и повторите изменения.', 409);
  }
  $revision = $old ? ((int)$old['revision'] + 1) : 1;
  if ($old) {
    $pdo->prepare('UPDATE feasibility_models SET obj_id=?,scenario_name=?,status=?,model_json=?,revision=?,updated_by_id=?,updated_by_name=?,updated_at=? WHERE id=?')
      ->execute([$obj,$name,$status,$json,$revision,$u['id']??null,$u['name']??null,$now,$id]);
  } else {
    $pdo->prepare('INSERT INTO feasibility_models (id,obj_id,scenario_name,status,model_json,revision,created_by_id,created_by_name,updated_by_id,updated_by_name,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      ->execute([$id,$obj,$name,$status,$json,$revision,$u['id']??null,$u['name']??null,$u['id']??null,$u['name']??null,$now,$now]);
  }
  $pdo->prepare('INSERT INTO feasibility_model_versions (model_id,revision,status,model_json,saved_by_id,saved_by_name,saved_at) VALUES (?,?,?,?,?,?,?)')
    ->execute([$id,$revision,$status,$json,$u['id']??null,$u['name']??null,$now]);
  $pdo->commit();
  audit('Финмодель: сохранение', $obj.' · '.$name.' · r'.$revision.' · '.$status);
  json_out(['ok'=>true,'id'=>$id,'revision'=>$revision,'status'=>$status,'updated_at'=>$now]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  error_log('CASE OS feasibility save error: '.$e->getMessage());
  fail('Не удалось сохранить финансовую модель', 500);
}
