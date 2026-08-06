<?php
/*
 * CASE OS — geo_education_export.php
 * Готовит слой «Образование» для геоаналитики из выгрузки коллектора.
 *
 *   1) php api/geo_collector.php --category=education --sources=osm,google,yandex,dgis
 *   2) php api/geo_education_export.php
 *      → data/tashkent_education.json  (его читает слой «Образование» на карте)
 *
 * Параметры (все необязательные):
 *   --in=data/geo_collect_out/seed_master.csv
 *   --out=data/tashkent_education.json
 *   --min-confidence=C     A|B|C — ниже указанной строки отбрасываются
 *
 * Инструмент НИЧЕГО не выдумывает: берёт только то, что собрал коллектор.
 * Строки без координат пропускаются и попадают в счётчик отброшенных.
 * PHP 7.4-совместимо.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); header('Content-Type: text/plain; charset=utf-8'); exit("CLI only\n"); }
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

function argv_get($name, $def = null) {
  global $argv;
  foreach ((array)$argv as $a) {
    if (strpos($a, '--' . $name . '=') === 0) return substr($a, strlen($name) + 3);
    if ($a === '--' . $name) return true;
  }
  return $def;
}

$ROOT = dirname(__DIR__);
$IN   = argv_get('in',  'data/geo_collect_out/seed_master.csv');
$OUT  = argv_get('out', 'data/tashkent_education.json');
$MINC = strtoupper((string)argv_get('min-confidence', 'C'));
if (strpos($IN, '/') !== 0)  $IN  = $ROOT . '/' . $IN;
if (strpos($OUT, '/') !== 0) $OUT = $ROOT . '/' . $OUT;

if (!is_file($IN)) {
  fwrite(STDERR, "Не найден файл выгрузки: $IN\n"
    . "Сначала соберите данные:\n"
    . "  php api/geo_collector.php --category=education --sources=osm,google,yandex,dgis\n");
  exit(1);
}

/* Тип определяем по подкатегории, а если её нет — по названию. Порядок правил важен:
   «колледж» и «лицей» должны сработать раньше «школы», иначе всё уедет в школы. */
$RULES = array(
  'driving'      => array('автошкол', 'driving', 'avtomaktab', 'автошкола'),
  'music'        => array('музыкальн', 'художествен', 'music school', 'musiqa', 'san\'at maktab', 'искусств'),
  'kindergarten' => array('детский сад', 'детсад', 'kindergarten', 'bog\'cha', 'bogcha', 'ясли', 'nursery'),
  'university'   => array('университет', 'university', 'universitet', 'институт', 'institute', 'academy', 'академия'),
  'college'      => array('колледж', 'kollej', 'college', 'лицей', 'litsey', 'техникум'),
  'language'     => array('язык', 'language', 'til kurs', 'english', 'ielts', 'инглиш', 'lingv', 'лингв'),
  'courses'      => array('курс', 'kurs', 'учебный центр', 'o\'quv markaz', 'oquv markaz', 'training',
                          'образовательный центр', 'it school', 'it-школа', 'it школа', 'репетитор',
                          'подготов', 'tutoring', 'academy of', 'skill'),
  'school'       => array('школа', 'maktab', 'school', 'гимназия', 'gimnaziya'),
);

function detect_type($subcat, $name, $rules) {
  $hay = mb_strtolower(trim($subcat . ' ' . $name), 'UTF-8');
  if ($hay === '') return 'other';
  foreach ($rules as $type => $needles) {
    foreach ($needles as $n) { if (mb_strpos($hay, $n, 0, 'UTF-8') !== false) return $type; }
  }
  return 'other';
}

$fh = fopen($IN, 'r');
if (!$fh) { fwrite(STDERR, "Не удалось открыть $IN\n"); exit(1); }
$head = fgetcsv($fh);
if (!$head) { fwrite(STDERR, "Пустой файл выгрузки\n"); exit(1); }
if (isset($head[0])) $head[0] = preg_replace('/^\xEF\xBB\xBF/', '', $head[0]);  // BOM
$col = array_flip($head);

$need = array('main_category', 'canonical_name', 'canonical_lat', 'canonical_lng');
foreach ($need as $c) {
  if (!isset($col[$c])) { fwrite(STDERR, "В выгрузке нет колонки $c — формат изменился?\n"); exit(1); }
}

$rank = array('A' => 3, 'B' => 2, 'C' => 1);
$minRank = isset($rank[$MINC]) ? $rank[$MINC] : 1;

$points = array(); $skippedNoCoord = 0; $skippedConf = 0; $total = 0; $byType = array();
while (($row = fgetcsv($fh)) !== false) {
  $cat = isset($row[$col['main_category']]) ? trim($row[$col['main_category']]) : '';
  if ($cat !== 'education') continue;
  $total++;

  $conf = isset($col['data_confidence']) && isset($row[$col['data_confidence']])
        ? strtoupper(trim($row[$col['data_confidence']])) : 'C';
  if ((isset($rank[$conf]) ? $rank[$conf] : 1) < $minRank) { $skippedConf++; continue; }

  $la = isset($row[$col['canonical_lat']]) ? trim($row[$col['canonical_lat']]) : '';
  $ln = isset($row[$col['canonical_lng']]) ? trim($row[$col['canonical_lng']]) : '';
  if ($la === '' || $ln === '' || !is_numeric($la) || !is_numeric($ln)) { $skippedNoCoord++; continue; }

  $name = trim($row[$col['canonical_name']]);
  $sub  = isset($col['subcategory']) && isset($row[$col['subcategory']]) ? trim($row[$col['subcategory']]) : '';
  $src  = isset($col['primary_source']) && isset($row[$col['primary_source']]) ? trim($row[$col['primary_source']]) : '';
  $type = detect_type($sub, $name, $RULES);
  $byType[$type] = (isset($byType[$type]) ? $byType[$type] : 0) + 1;

  $p = array('n' => $name, 'la' => round((float)$la, 5), 'ln' => round((float)$ln, 5), 't' => $type);
  if ($src !== '') $p['s'] = $src;
  $points[] = $p;
}
fclose($fh);

if (!$points) {
  fwrite(STDERR, "В выгрузке нет записей категории education.\n"
    . "Соберите их: php api/geo_collector.php --category=education --sources=osm,google,yandex,dgis\n");
  exit(2);
}

$out = array(
  'src'        => 'CASE OS collector · ' . date('Y-m-d'),
  'total'      => count($points),
  'by_type'    => $byType,
  'min_conf'   => $MINC,
  'skipped'    => array('без координат' => $skippedNoCoord, 'ниже порога достоверности' => $skippedConf),
  'points'     => $points,
);
@mkdir(dirname($OUT), 0775, true);
if (file_put_contents($OUT, json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
  fwrite(STDERR, "Не удалось записать $OUT\n"); exit(1);
}

echo "Готово: " . count($points) . " объектов → $OUT\n";
echo "Из " . $total . " строк категории education пропущено: без координат $skippedNoCoord, ниже порога $skippedConf\n";
arsort($byType);
foreach ($byType as $t => $n) echo "  " . str_pad($t, 14) . $n . "\n";
