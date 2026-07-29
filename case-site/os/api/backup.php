<?php
// CASE OS — резервное копирование и восстановление базы данных.
// Запуск: (1) вручную кнопкой в платформе (админ), (2) автоматически по расписанию
// (cron на хостинге) через ссылку с секретным токеном — см. config.php 'backup_token'.
// Делает полный SQL-дамп всех таблиц (структура + данные), сжимает (.sql.gz),
// сохраняет в os/sql/backups/ и удаляет файлы старше 30 дней.
// Восстановление (action=restore) — только admin, только POST с CSRF; перед применением
// автоматически создаётся снапшот текущей базы для отката.
require __DIR__.'/lib.php';

$cfg = cfg();
$token = $_GET['token'] ?? '';
$viaCron = $token !== '' && isset($cfg['backup_token']) && hash_equals((string)$cfg['backup_token'], (string)$token);
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') require_valid_csrf();
// Cron-token допускается ТОЛЬКО для создания новой копии. Список, скачивание и
// восстановление всегда требуют авторизованного администратора.
if (!$viaCron || in_array($action, ['list','download','restore'], true)) {
  require_login();
  if (!can('admin')) fail('Только администратор', 403);
}

/* v4.50.3: дампы базы уходят ЗА пределы публичной папки.
   Раньше они лежали в os/sql/backups — внутри веб-корня. Имена предсказуемы
   с точностью до секунды (caseos_ГГГГ-ММ-ДД_ЧЧММСС.sql.gz), а запрет на отдачу
   .sql.gz стоял только в /api и на эту папку не распространялся. Кто угадал имя,
   скачивал всю базу мимо этого эндпоинта и мимо проверки прав. */
$legacyDir = __DIR__.'/../sql/backups';
$dir = $legacyDir;
$outside = realpath(__DIR__.'/../../..');          // на уровень выше public_html
if ($outside !== false) {
  $cand = $outside.'/caseos_backups';
  if (!is_dir($cand)) @mkdir($cand, 0700, true);
  if (is_dir($cand) && is_writable($cand)) {
    $dir = $cand;
    // одноразовый переезд копий, сделанных до обновления
    foreach (glob($legacyDir.'/*.sql.gz') ?: [] as $f) { @rename($f, $cand.'/'.basename($f)); }
  }
}
if (!is_dir($dir)) @mkdir($dir, 0700, true);

/** Рабочая папка плюс старая — на случай, если переезд не удался (нет прав на запись выше). */
function caseos_backup_dirs(): array {
  global $dir, $legacyDir;
  $out = [$dir];
  $rl = realpath($legacyDir); $rd = realpath($dir);
  if ($rl !== false && $rl !== $rd) $out[] = $legacyDir;
  return $out;
}
function caseos_find_backup(string $name): ?string {
  foreach (caseos_backup_dirs() as $d) { $p = $d.'/'.$name; if (is_file($p)) return $p; }
  return null;
}

function backupList(string $dir): array {
  $out = []; $seen = [];
  foreach (caseos_backup_dirs() as $d) {
    foreach (glob($d.'/*.sql.gz') ?: [] as $f) {
      $n = basename($f);
      if (isset($seen[$n])) continue;
      $seen[$n] = 1;
      $out[] = ['name'=>$n, 'size'=>filesize($f), 'time'=>filemtime($f)];
    }
  }
  usort($out, function($a,$b){ return $b['time']<=>$a['time']; });
  return $out;
}

// Полный SQL-дамп базы (структура + данные). Возвращает строку SQL.
function caseos_make_dump(PDO $pdo, string $driver): string {
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
    // sqlite (локальный тест): дамп с очисткой таблиц перед вставкой, чтобы restore был идемпотентен
    $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($tables as $t) {
      $sql .= 'DELETE FROM "'.$t.'";'."\n";
      $rows = $pdo->query('SELECT * FROM "'.$t.'"');
      foreach ($rows as $row) {
        $cols = array_keys($row);
        $vals = array_map(function($v) use ($pdo){ return $v===null?'NULL':$pdo->quote((string)$v); }, array_values($row));
        $sql .= 'INSERT INTO "'.$t.'" ("'.implode('","', $cols).'") VALUES ('.implode(',', $vals).");\n";
      }
    }
  }
  $sql .= "SET FOREIGN_KEY_CHECKS=1;\n";
  return $sql;
}

function caseos_write_backup(string $dir, string $sql, string $prefix='caseos'): array {
  $fname = $prefix.'_'.date('Y-m-d_His').'.sql.gz';
  $fpath = $dir.'/'.$fname;
  $gz = gzencode($sql, 6);
  if ($gz === false || file_put_contents($fpath, $gz, LOCK_EX) === false) fail('Не удалось записать файл бэкапа', 500);
  return ['name'=>$fname, 'path'=>$fpath, 'size'=>filesize($fpath)];
}

function caseos_prune(string $dir): void {
  $cutoff = time() - 30*86400;
  foreach (caseos_backup_dirs() as $d) {
    foreach (glob($d.'/*.sql.gz') ?: [] as $f) { if (filemtime($f) < $cutoff) @unlink($f); }
  }
}

if ($action === 'list') {
  json_out(['backups'=>backupList($dir)]);
}
if ($action === 'download') {
  $name = basename((string)($_GET['name'] ?? ''));
  $path = preg_match('/^[\w.\-]+\.sql\.gz$/', $name) ? caseos_find_backup($name) : null;
  if ($name === '' || $path === null) fail('Файл не найден', 404);
  header('Content-Type: application/gzip');
  header('Content-Disposition: attachment; filename="'.$name.'"');
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
  header('Content-Length: '.filesize($path));
  readfile($path);
  exit;
}

$pdo = db();
$driver = $cfg['driver'] ?? 'mysql';

if ($action === 'restore') {
  if ($method !== 'POST') fail('Восстановление выполняется только методом POST', 405);
  $name = basename((string)($_POST['name'] ?? $_GET['name'] ?? ''));
  $path = preg_match('/^[\w.\-]+\.sql\.gz$/', $name) ? caseos_find_backup($name) : null;
  if ($name === '' || $path === null) fail('Файл резервной копии не найден', 404);
  $blob = @file_get_contents($path);
  if ($blob === false) fail('Не удалось прочитать файл резервной копии', 500);
  $sql = @gzdecode($blob);
  if ($sql === false || strpos($sql, 'CASE OS backup') === false) fail('Файл не является резервной копией CASE OS или повреждён', 400);
  // Снимок текущей базы ПЕРЕД восстановлением — для отката
  $snap = null;
  try { $snap = caseos_write_backup($dir, caseos_make_dump($pdo, $driver), 'caseos_prerestore'); }
  catch (Throwable $e) { fail('Не удалось создать защитный снимок перед восстановлением: '.$e->getMessage().'. Восстановление отменено, данные не тронуты.', 500); }
  // Применяем дамп (мульти-стейтмент). FK-проверки выключены внутри самого дампа.
  try {
    $pdo->exec($sql);
  } catch (Throwable $e) {
    fail('Ошибка восстановления: '.$e->getMessage().'. Текущая база сохранена в снимке «'.$snap['name'].'» — восстановите её при необходимости.', 500);
  }
  try { $pdo->exec($driver==='mysql' ? 'SET FOREIGN_KEY_CHECKS=1' : 'PRAGMA foreign_keys=ON'); } catch (Throwable $e) {}
  audit('Восстановление базы из резервной копии', $name.' (снимок отката: '.$snap['name'].')');
  json_out(['ok'=>true, 'restored'=>$name, 'snapshot'=>$snap['name'], 'backups'=>backupList($dir)]);
}

// ── Создание новой резервной копии (по умолчанию) ────────────────────
$out = caseos_write_backup($dir, caseos_make_dump($pdo, $driver), 'caseos');
caseos_prune($dir);
if (!$viaCron) audit('Резервная копия базы', $out['name']);
json_out(['ok'=>true, 'file'=>$out['name'], 'size'=>$out['size'], 'backups'=>backupList($dir)]);
