<?php
// CASE OS — резервное копирование базы данных.
// Запуск: (1) вручную кнопкой в платформе (админ), (2) автоматически по расписанию
// (cron на хостинге) через ссылку с секретным токеном — см. config.php 'backup_token'.
// Делает полный SQL-дамп всех таблиц (структура + данные), сжимает (.sql.gz),
// сохраняет в os/sql/backups/ и удаляет файлы старше 30 дней.
require __DIR__.'/lib.php';

$cfg = cfg();
$token = $_GET['token'] ?? '';
$viaCron = $token !== '' && isset($cfg['backup_token']) && hash_equals((string)$cfg['backup_token'], (string)$token);
// Cron-token разрешён только для создания новой резервной копии.
// Список и скачивание бэкапов всегда доступны только авторизованному admin.
$action = $_GET['action'] ?? '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') require_valid_csrf();
if (!$viaCron || in_array($action, ['list','download'], true)) {
  require_login();
  if (!can('admin')) fail('Только администратор', 403);
}

$dir = __DIR__.'/../sql/backups';
if (!is_dir($dir)) @mkdir($dir, 0755, true);

function backupList(string $dir): array {
  $out = [];
  foreach (glob($dir.'/*.sql.gz') ?: [] as $f) {
    $out[] = ['name'=>basename($f), 'size'=>filesize($f), 'time'=>filemtime($f)];
  }
  usort($out, function($a,$b){ return $b['time']<=>$a['time']; });
  return $out;
}

if ($action === 'list') {
  json_out(['backups'=>backupList($dir)]);
}
if ($action === 'download') {
  $name = basename((string)($_GET['name'] ?? ''));
  $path = $dir.'/'.$name;
  if ($name === '' || !preg_match('/^[\w.\-]+\.sql\.gz$/', $name) || !is_file($path)) fail('Файл не найден', 404);
  header('Content-Type: application/gzip');
  header('Content-Disposition: attachment; filename="'.$name.'"');
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
  header('Content-Length: '.filesize($path));
  readfile($path);
  exit;
}

// ── Сам дамп ─────────────────────────────────────────────────────────
$pdo = db();
$driver = $cfg['driver'] ?? 'mysql';
$sql = "-- CASE OS backup ".date('Y-m-d H:i:s')."\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n\n";

if ($driver === 'mysql') {
  $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
  foreach ($tables as $t) {
    $create = $pdo->query('SHOW CREATE TABLE `'.$t.'`')->fetch();
    $sql .= "DROP TABLE IF EXISTS `$t`;\n".$create['Create Table'].";\n\n";
    $rows = $pdo->query('SELECT * FROM `'.$t.'`');
    foreach ($rows as $row) {
      $cols = array_map(function($c){ return '`'.$c.'`'; }, array_keys($row));
      $vals = array_map(function($v) use ($pdo) { return $v === null ? 'NULL' : $pdo->quote((string)$v); }, array_values($row));
      $sql .= 'INSERT INTO `'.$t.'` ('.implode(',', $cols).') VALUES ('.implode(',', $vals).");\n";
    }
    $sql .= "\n";
  }
} else {
  // sqlite (локальный тест) — просто копия файла в текстовом виде через дамп таблиц
  $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
  foreach ($tables as $t) {
    $rows = $pdo->query('SELECT * FROM "'.$t.'"');
    foreach ($rows as $row) {
      $cols = array_keys($row);
      $vals = array_map(function($v) use ($pdo){ return $v===null?'NULL':$pdo->quote((string)$v); }, array_values($row));
      $sql .= 'INSERT INTO "'.$t.'" ("'.implode('","', $cols).'") VALUES ('.implode(',', $vals).");\n";
    }
  }
}
$sql .= "SET FOREIGN_KEY_CHECKS=1;\n";

$fname = 'caseos_'.date('Y-m-d_His').'.sql.gz';
$fpath = $dir.'/'.$fname;
$gz = gzencode($sql, 6);
if ($gz === false || file_put_contents($fpath, $gz, LOCK_EX) === false) fail('Не удалось записать файл бэкапа', 500);

// удалить бэкапы старше 30 дней
$cutoff = time() - 30*86400;
foreach (glob($dir.'/*.sql.gz') ?: [] as $f) {
  if (filemtime($f) < $cutoff) @unlink($f);
}

if (!$viaCron) audit('Резервная копия базы', $fname);
json_out(['ok'=>true, 'file'=>$fname, 'size'=>filesize($fpath), 'backups'=>backupList($dir)]);
