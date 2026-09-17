<?php
/* Категории POI не должны делить между собой один и тот же OSM-тег.

   Пока делили - один объект попадал сразу в несколько слоёв: парк аттракционов числился
   в «Развлечениях», «Парках», «Детских площадках» и «Туризме», универмаг - в «ТРЦ» и в
   «Стрит-ритейле». Суммы в легенде и выборка конкурентов удваивались, а по цифрам понять
   это было нельзя: каждый слой по отдельности выглядел правдоподобно.

   Каждая категория соответствует слою в POI_DEFS (os/v420-geo-studio.js), поэтому здесь же
   проверяем, что ключи не разъехались между клиентом и сервером.

   Запуск: php poi_categories.php [папка os] */

$OS = $argv[1] ?? __DIR__ . '/../../../os';
$php = file_get_contents($OS . '/api/gis_proxy.php');
$js  = file_get_contents($OS . '/v420-geo-studio.js');

$failed = 0;
function ck(string $n, bool $c, $d = null): void {
  global $failed;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null || $d === '' ? '' : ' — ' . $d) . "\n";
  if (!$c) $failed++;
}

/* комментарии вырезаем: в них теги упоминаются прозой и это не фильтры */
$clean = preg_replace('#/\*.*?\*/#s', '', $php);
$clean = preg_replace('#//[^\n]*#', '', $clean);
preg_match('/\$map = \[(.*?)\n  \];/s', $clean, $m);
if (!$m) { echo "!!  не найден список категорий \$map в gis_proxy.php\n"; exit(1); }

$cats = []; $last = null;
foreach (explode("\n", $m[1]) as $line) {
  if (preg_match("/^\s*'([a-z_]+)'\s*=>\s*\[(.*)/", $line, $mm)) { $last = $mm[1]; $cats[$last] = $mm[2]; }
  elseif ($last !== null) { $cats[$last] .= $line; }
}
ck('список категорий разобран', count($cats) > 15, count($cats) . ' категорий');

/* раскладываем каждый фильтр в набор пар ключ=значение */
$owner = [];
foreach ($cats as $cat => $body) {
  preg_match_all('/(\w+)~"([^"]+)"/', $body, $re, PREG_SET_ORDER);
  foreach ($re as $r) foreach (explode('|', $r[2]) as $v) $owner[$r[1] . '=' . $v][] = $cat;
  preg_match_all('/(\w+)=([a-z_]+)/', $body, $eq, PREG_SET_ORDER);
  foreach ($eq as $r) $owner[$r[1] . '=' . $r[2]][] = $cat;
}
$dup = [];
foreach ($owner as $tag => $list) { $u = array_values(array_unique($list)); if (count($u) > 1) $dup[$tag] = $u; }
ck('ни один OSM-тег не принадлежит двум слоям сразу', !$dup,
   $dup ? implode('; ', array_map(function ($t, $l) { return $t . ' -> ' . implode(', ', $l); }, array_keys($dup), $dup)) : 'пересечений нет');

/* ключи сервера и клиента должны совпадать: иначе слой либо не грузится, либо грузится в пустоту */
preg_match('/var POI_DEFS\s*=\s*\{(.*?)\n  \};/s', $js, $pm);
$clientKeys = [];
if ($pm) { preg_match_all('/^\s*([a-z_]+)\s*:\s*\{label:/m', $pm[1], $ck2); $clientKeys = $ck2[1]; }
ck('POI_DEFS прочитан на клиенте', count($clientKeys) > 15, count($clientKeys) . ' слоёв');

$onlyServer = array_diff(array_keys($cats), $clientKeys);
$onlyClient = array_diff($clientKeys, array_keys($cats));
ck('у каждой серверной категории есть слой на клиенте', !$onlyServer, implode(', ', $onlyServer) ?: 'все на месте');
ck('у каждого слоя на клиенте есть фильтр на сервере', !$onlyClient, implode(', ', $onlyClient) ?: 'все на месте');

/* транспорт собирается отдельной веткой, а не через $map — проверяем, что она на месте */
ck('транспорт собирается отдельной веткой с маршрутами',
   strpos($php, 'function transport_rows_from_overpass') !== false
   && strpos($php, "\$category === 'transport_hubs'") !== false);

/* HTTP-таймаут прокси должен быть больше таймаута самого запроса Overpass:
   иначе соединение рвётся, пока сервер ещё считает, и это выглядит как «Overpass недоступен» */
/* сверяем попарно: у каждого запроса к Overpass свой таймаут соединения ниже по коду.
   Общий минимум по файлу брать нельзя - там есть вспомогательные вызовы (изохроны,
   маршрутизация) со своими таймаутами, к Overpass отношения не имеющими. */
preg_match_all('/\[out:json\]\[timeout:(\d+)\]/', $php, $qt, PREG_OFFSET_CAPTURE);
$pairs = []; $bad = [];
foreach ($qt[1] as $q) {
  $qSec = (int)$q[0]; $from = $q[1];
  if (!preg_match("/'timeout'\s*=>\s*(\d+)/", substr($php, $from, 3000), $h)) { $bad[] = "запрос $qSec с - таймаут соединения не найден"; continue; }
  $hSec = (int)$h[1];
  $pairs[] = "$qSec/$hSec";
  if ($hSec <= $qSec) $bad[] = "запрос $qSec с при соединении $hSec с";
}
ck('у каждого запроса к Overpass таймаут соединения с запасом', !$bad && $pairs,
   $bad ? implode('; ', $bad) : 'пары запрос/соединение: ' . implode(', ', $pairs));

echo $failed ? "\nПРОВАЛЕНО проверок: $failed\n" : "\nВсе проверки категорий POI пройдены\n";
exit($failed ? 1 : 0);
