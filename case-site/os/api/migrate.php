<?php
// CASE OS — применение миграций БД (только admin). Безопасно: применяет
// только новые файлы из os/sql/migrations/*.sql и помечает их применёнными.
require __DIR__.'/lib.php';
require_login();
if (!can('admin')) fail('Только администратор', 403);
$pdo = db();
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(190) PRIMARY KEY, applied_at DATETIME)');
$applied = [];
foreach ($pdo->query('SELECT filename FROM schema_migrations') as $r) $applied[$r['filename']] = 1;
$files = glob(__DIR__.'/../sql/migrations/*.sql') ?: [];
sort($files);
$done = []; $already = [];
foreach ($files as $f) {
  $base = basename($f);
  if (isset($applied[$base])) { $already[] = $base; continue; }
  $sql = trim((string)file_get_contents($f));
  if ($sql === '') { $base and $already[] = $base; continue; }
  try {
    $pdo->exec($sql); // в MySQL DDL автокоммитится; миграции пишем идемпотентно
    $pdo->prepare('INSERT INTO schema_migrations (filename,applied_at) VALUES (?,?)')
        ->execute([$base, date('Y-m-d H:i:s')]);
    $done[] = $base;
  } catch (Throwable $e) {
    audit('Миграция: ошибка', $base.' — '.$e->getMessage());
    json_out(['error'=>'Миграция '.$base.': '.$e->getMessage(), 'applied'=>$done], 500);
  }
}
if ($done) audit('Миграции применены', implode(', ', $done));
json_out(['ok'=>true, 'applied'=>$done, 'already'=>$already]);
