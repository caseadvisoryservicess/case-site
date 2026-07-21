<?php
// CASE OS v4.8.1 — protected delivery of the integrated Tashkent geo master.
declare(strict_types=1);
require __DIR__.'/lib.php';
$u = require_login();
$state = asaas_load_app_state_data();
if (!asaas_workspace_can_view($u, 'geoanalytics', $state)) fail('Нет доступа к мастер-геобазе', 403);

$base = dirname(__DIR__).'/data/geo_master';
$file = (string)($_GET['file'] ?? 'runtime.json');
$map = [
  // runtime/summary are needed by the map and are available to every user whose
  // effective workspace includes Geoanalytics.
  'runtime.json'=>['runtime.json','application/json; charset=utf-8',false,false],
  'summary.json'=>['summary.json','application/json; charset=utf-8',false,false],
  // Full exports and QA/admin files require edit/finance/admin rights. A read-only
  // analyst can use the map but cannot download the entire source database.
  'master.csv'=>['master.csv','text/csv; charset=utf-8',true,true],
  'master.geojson'=>['master.geojson','application/geo+json; charset=utf-8',true,true],
  'research_queue.csv'=>['research_queue.csv','text/csv; charset=utf-8',true,true],
  'qa_issues.csv'=>['qa_issues.csv','text/csv; charset=utf-8',true,true],
  'taxonomy.csv'=>['taxonomy.csv','text/csv; charset=utf-8',true,true],
  'admin.xlsx'=>['CASE_Tashkent_Geo_Admin.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',true,true],
  'restaurants.json'=>['restaurants.json','application/json; charset=utf-8',true,true],
  'cafes.json'=>['cafes.json','application/json; charset=utf-8',true,true],
  'fnb_import_qa.json'=>['fnb_import_qa.json','application/json; charset=utf-8',true,true],
];
if (!isset($map[$file])) fail('Файл не разрешён', 404);
if ($map[$file][3] && !asaas_geo_can_edit($u)) {
  fail('Экспорт мастер-геобазы доступен только редакторам', 403);
}
$path = $base.'/'.$map[$file][0];
if (!is_file($path)) fail('Файл мастер-базы не найден', 404);
$size = filesize($path);
if ($size === false) fail('Не удалось прочитать файл мастер-базы', 500);
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'self'");
header('Referrer-Policy: same-origin');
header('Cache-Control: private, no-store, max-age=0');
header('Content-Type: '.$map[$file][1]);
header('Content-Length: '.$size);
if ($map[$file][2]) {
  $downloadName = ($file === 'admin.xlsx') ? 'CASE_OS_Tashkent_Geo_Admin.xlsx' : basename($map[$file][0]);
  header('Content-Disposition: attachment; filename="'.$downloadName.'"');
}
$fh = fopen($path, 'rb');
if (!$fh) fail('Не удалось открыть файл мастер-базы', 500);
fpassthru($fh);
fclose($fh);
