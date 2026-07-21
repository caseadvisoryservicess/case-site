<?php
// CASE OS v4.17.0 — secure project/document file storage.
// Files are stored below data/case_files and are never exposed directly by the web server.
declare(strict_types=1);
require __DIR__.'/lib.php';
$u = require_login();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

const CASE_FILE_LIMIT = 26214400; // 25 MiB

function case_files_dir(): string {
  $dir = dirname(__DIR__).'/data/case_files';
  if (!is_dir($dir) && !mkdir($dir, 0770, true) && !is_dir($dir)) fail('Не удалось создать защищённое хранилище', 500);
  return $dir;
}
function case_files_index_path(): string { return case_files_dir().'/index.json'; }
function case_files_read_index(): array {
  $path = case_files_index_path();
  if (!is_file($path)) return [];
  $raw = file_get_contents($path);
  $rows = json_decode($raw ?: '[]', true);
  return is_array($rows) ? $rows : [];
}
function case_files_write_index(array $rows): void {
  $path = case_files_index_path();
  $tmp = $path.'.tmp.'.bin2hex(random_bytes(4));
  $json = json_encode(array_values($rows), JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
  if ($json === false || file_put_contents($tmp, $json."\n", LOCK_EX) === false) fail('Не удалось сохранить индекс файлов', 500);
  @chmod($tmp, 0660);
  if (!rename($tmp, $path)) { @unlink($tmp); fail('Не удалось обновить индекс файлов', 500); }
}
function case_file_project_allowed(array $u, string $projectId): bool {
  if ($projectId === '' || empty($u['project_scope'])) return true;
  $projects = $u['projects'] ?? [];
  return is_array($projects) && in_array($projectId, array_map('strval', $projects), true);
}
function case_file_has_view(array $u, array $views): bool {
  if (!empty($u['admin'])) return true;
  $state = asaas_load_app_state_data();
  foreach ($views as $view) if (asaas_workspace_can_view($u, $view, $state)) return true;
  return false;
}
function case_file_clean_name(string $name): string {
  $name = preg_replace('/[\x00-\x1F\x7F]+/u', '', $name) ?? '';
  $name = str_replace(['/', '\\'], '_', $name);
  $name = trim($name);
  return $name !== '' ? (function_exists('mb_substr') ? mb_substr($name, 0, 180) : substr($name, 0, 180)) : 'file';
}
function case_file_allowed_extensions(): array {
  return [
    'pdf'=>'application/pdf','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp',
    'svg'=>'image/svg+xml','dwg'=>'application/octet-stream','dxf'=>'application/octet-stream','ifc'=>'application/octet-stream',
    'rvt'=>'application/octet-stream','xlsx'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls'=>'application/vnd.ms-excel','docx'=>'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'doc'=>'application/msword','zip'=>'application/zip'
  ];
}
function case_file_find(array $rows, string $id): ?array {
  foreach ($rows as $row) if (is_array($row) && hash_equals((string)($row['id'] ?? ''), $id)) return $row;
  return null;
}

if ($method === 'GET') {
  $id = trim((string)($_GET['id'] ?? ''));
  if ($id === '' || !preg_match('/^[a-f0-9-]{16,64}$/i', $id)) fail('Некорректный идентификатор файла', 400);
  $row = case_file_find(case_files_read_index(), $id);
  if (!$row) fail('Файл не найден', 404);
  $kind = (string)($row['kind'] ?? 'project');
  $views = $kind === 'template'
    ? ['document_templates']
    : ['project_layouts','leasing_layouts','project_workspace','advisory_delivery','plans'];
  if (!case_file_has_view($u, $views)) fail('Нет доступа к файлу', 403);
  if (!case_file_project_allowed($u, (string)($row['project_id'] ?? ''))) fail('Нет доступа к проекту', 403);
  $stored = basename((string)($row['stored_name'] ?? ''));
  $path = case_files_dir().'/'.$stored;
  if ($stored === '' || !is_file($path)) fail('Файл отсутствует в хранилище', 404);
  $name = case_file_clean_name((string)($row['original_name'] ?? 'file'));
  $mime = (string)($row['mime'] ?? 'application/octet-stream');
  $inline = in_array($mime, ['application/pdf','image/png','image/jpeg','image/webp'], true) && empty($_GET['download']);
  header('Content-Type: '.$mime);
  header('Content-Length: '.(string)filesize($path));
  header('Content-Disposition: '.($inline?'inline':'attachment').'; filename*=UTF-8\'\''.rawurlencode($name));
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: private, no-store, max-age=0');
  readfile($path);
  exit;
}

if ($method === 'POST') {
  require_valid_csrf($_POST);
  $kind = trim((string)($_POST['kind'] ?? 'project'));
  if (!in_array($kind, ['layout','template','deliverable','project'], true)) fail('Неизвестный тип файла', 400);
  $projectId = trim((string)($_POST['project_id'] ?? ''));
  $contextId = trim((string)($_POST['context_id'] ?? ''));
  $views = $kind === 'template'
    ? ['document_templates']
    : ['project_layouts','leasing_layouts','project_workspace','advisory_delivery','plans'];
  if (!case_file_has_view($u, $views)) fail('Нет доступа к загрузке файлов', 403);
  if (!can('edit') && !can('plans') && !can('admin')) fail('Нет права загрузки файлов', 403);
  if (!case_file_project_allowed($u, $projectId)) fail('Нет доступа к проекту', 403);
  if (!isset($_FILES['file']) || !is_array($_FILES['file'])) fail('Файл не передан', 400);
  $f = $_FILES['file'];
  if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) fail('Ошибка загрузки файла', 400);
  $size = (int)($f['size'] ?? 0);
  if ($size <= 0 || $size > CASE_FILE_LIMIT) fail('Размер файла должен быть не более 25 МБ', 413);
  $original = case_file_clean_name((string)($f['name'] ?? 'file'));
  $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
  $allowed = case_file_allowed_extensions();
  if (!isset($allowed[$ext])) fail('Этот формат файла не разрешён', 415);
  $tmp = (string)($f['tmp_name'] ?? '');
  if ($tmp === '' || !is_uploaded_file($tmp)) fail('Некорректный временный файл', 400);
  $detected = 'application/octet-stream';
  if (class_exists('finfo')) {
    $fi = new finfo(FILEINFO_MIME_TYPE);
    $detected = (string)($fi->file($tmp) ?: $detected);
  }
  // Block executable/script payloads regardless of extension. CAD/BIM formats are intentionally binary/octet-stream.
  $blocked = ['application/x-httpd-php','text/x-php','text/html','application/javascript','text/javascript','application/x-sh'];
  if (in_array(strtolower($detected), $blocked, true)) fail('Содержимое файла не соответствует разрешённому формату', 415);
  if ($ext === 'svg') {
    $svg = file_get_contents($tmp, false, null, 0, min($size, 1048576));
    if ($svg === false || preg_match('/<(script|foreignObject)\b|\bon\w+\s*=|javascript\s*:/i', $svg)) fail('SVG содержит небезопасные элементы', 415);
  }
  $id = uuid();
  $stored = $id.'.'.$ext;
  $dest = case_files_dir().'/'.$stored;
  if (!move_uploaded_file($tmp, $dest)) fail('Не удалось переместить файл в хранилище', 500);
  @chmod($dest, 0660);
  $row = [
    'id'=>$id,'kind'=>$kind,'project_id'=>$projectId,'context_id'=>$contextId,
    'original_name'=>$original,'stored_name'=>$stored,'extension'=>$ext,
    'mime'=>($detected && $detected !== 'application/octet-stream')?$detected:$allowed[$ext],
    'size'=>$size,'sha256'=>hash_file('sha256', $dest),
    'created_at'=>date('c'),'created_by'=>(string)($u['name'] ?? $u['email'] ?? '-'),
    'created_by_id'=>(string)($u['id'] ?? '')
  ];
  $rows = case_files_read_index();
  $rows[] = $row;
  case_files_write_index($rows);
  audit('project_file_upload', $kind.' '.$original.' project='.$projectId.' context='.$contextId);
  json_out(['ok'=>true,'file'=>$row], 201);
}

fail('Метод не поддерживается', 405);
