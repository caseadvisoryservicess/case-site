<?php
// CASE OS — применение миграций БД (только admin). Безопасно: применяет
// только новые файлы из os/sql/migrations/*.sql и помечает их применёнными.
require __DIR__.'/lib.php';
require_login();
if (!can('admin')) fail('Только администратор', 403);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') require_valid_csrf();
$pdo = db();
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(190) PRIMARY KEY, applied_at DATETIME)');
$applied = [];
foreach ($pdo->query('SELECT filename FROM schema_migrations') as $r) $applied[$r['filename']] = 1;
$files = glob(__DIR__.'/../sql/migrations/*.sql') ?: [];
sort($files);
$done = []; $already = []; $failed = [];
foreach ($files as $f) {
  $base = basename($f);
  if (isset($applied[$base])) { $already[] = $base; continue; }
  $sql = trim((string)file_get_contents($f));
  if ($sql === '') { $already[] = $base; continue; }
  $mark = function() use ($pdo, $base) {
    $pdo->prepare('INSERT INTO schema_migrations (filename,applied_at) VALUES (?,?)')
        ->execute([$base, date('Y-m-d H:i:s')]);
  };
  try {
    $pdo->exec($sql); // в MySQL DDL автокоммитится; миграции пишем идемпотентно
    $mark();
    $done[] = $base;
  } catch (Throwable $e) {
    $m = $e->getMessage();
    // изменение уже есть в базе (колонка/таблица/строка существует — база ставилась из более
    // нового install_all.sql): помечаем применённой и продолжаем, НЕ прерывая остальные миграции
    if (preg_match('/duplicate column|column already exists|already exists|duplicate key name|duplicate entry|unique constraint failed/i', $m)) {
      try { $mark(); } catch (Throwable $e2) {}
      $already[] = $base;
      continue;
    }
    audit('Миграция: ошибка', $base.' — '.$m);
    $failed[] = $base.': '.$m; // ошибка одной миграции не должна блокировать следующие
  }
}
if ($done) audit('Миграции применены', implode(', ', $done));
json_out(['ok'=>!count($failed), 'applied'=>$done, 'already'=>$already, 'failed'=>$failed]);
