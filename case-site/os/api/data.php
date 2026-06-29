<?php
// CASE OS — чтение/запись данных (с проверкой прав).
require __DIR__.'/lib.php';
$m = $_SERVER['REQUEST_METHOD'];
if ($m==='GET') { $t = $_GET['table'] ?? ''; json_out(['rows'=>list_table($t, $_GET)]); }
if ($m==='POST') {
  $b = body(); $t = $b['table'] ?? '';
  if (array_key_exists('delete',$b)) { delete_row($t, $b['delete']); json_out(['ok'=>true]); }
  if (array_key_exists('row',$b))    { json_out(['row'=>upsert_row($t, $b['row'])]); }
  fail('Нужно поле row или delete', 400);
}
fail('Метод не поддерживается', 405);
