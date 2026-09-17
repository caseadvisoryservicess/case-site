<?php
/* Разбор ответа Overpass по транспорту.

   Слой «Транспортные узлы и остановки» показывал ноль при тысячах остановок в городе:
   общая ветка прокси выбрасывает всё безымянное (`if ($name === '') continue`), а
   остановка в ташкентском OSM почти всегда без имени. Плюс главное для аренды - не сама
   остановка, а какие маршруты на ней останавливаются, и это лежит не в остановке, а в
   отношениях type=route, куда она входит.

   Сам запрос к Overpass отсюда не проверить (нет выхода в интернет), а разбор ответа -
   можно: подаём синтетический ответ той же формы, что отдаёт Overpass, и сверяем результат.

   Запуск: php transport_parse.php [путь к gis_proxy.php] */

$src = $argv[1] ?? __DIR__ . '/../../../os/api/gis_proxy.php';
$code = file_get_contents($src);
$i = strpos($code, 'function transport_rows_from_overpass');
if ($i === false) { fwrite(STDERR, "!! функция transport_rows_from_overpass не найдена в $src\n"); exit(1); }
/* вырезаем функцию по балансу фигурных скобок - файл целиком подключать нельзя, он исполняется */
$open = strpos($code, '{', $i); $d = 0; $end = $open;
for ($k = $open; $k < strlen($code); $k++) {
  if ($code[$k] === '{') $d++;
  elseif ($code[$k] === '}') { $d--; if ($d === 0) { $end = $k; break; } }
}
eval(substr($code, $i, $end - $i + 1));

$failed = 0;
function ck(string $n, bool $c, $d = null): void {
  global $failed;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' — ' . (is_scalar($d) ? $d : json_encode($d, JSON_UNESCAPED_UNICODE))) . "\n";
  if (!$c) $failed++;
}

/* Ответ той же формы, что отдаёт Overpass: безымянные остановки, платформа без признака
   транспорта, вокзал полигоном (у него center), станция метро и три маршрута. */
$elements = [
  ['type'=>'node','id'=>1,'lat'=>41.311,'lon'=>69.279,'tags'=>['highway'=>'bus_stop']],
  ['type'=>'node','id'=>2,'lat'=>41.312,'lon'=>69.280,'tags'=>['highway'=>'bus_stop','addr:street'=>'ул. Амира Темура']],
  ['type'=>'node','id'=>3,'lat'=>41.313,'lon'=>69.281,'tags'=>['highway'=>'bus_stop','name'=>'Хадра']],
  ['type'=>'node','id'=>4,'lat'=>41.314,'lon'=>69.282,'tags'=>['railway'=>'station','station'=>'subway','name'=>'Пахтакор']],
  ['type'=>'node','id'=>5,'lat'=>41.315,'lon'=>69.283,'tags'=>['public_transport'=>'platform']],           // без вида транспорта — не берём
  ['type'=>'node','id'=>6,'lat'=>41.316,'lon'=>69.284,'tags'=>['public_transport'=>'platform','bus'=>'yes']],
  ['type'=>'way','id'=>7,'center'=>['lat'=>41.317,'lon'=>69.285],'tags'=>['amenity'=>'bus_station','name'=>'Автовокзал Ташкент']],
  ['type'=>'relation','id'=>101,'tags'=>['type'=>'route','route'=>'bus','ref'=>'11','name'=>'Автобус 11'],
   'members'=>[['type'=>'node','ref'=>1],['type'=>'node','ref'=>2],['type'=>'way','ref'=>999]]],
  ['type'=>'relation','id'=>102,'tags'=>['type'=>'route','route'=>'bus','ref'=>'33'],
   'members'=>[['type'=>'node','ref'=>1]]],
  ['type'=>'relation','id'=>103,'tags'=>['type'=>'route','route'=>'minibus','ref'=>'5'],
   'members'=>[['type'=>'node','ref'=>1],['type'=>'node','ref'=>6]]],
  ['type'=>'relation','id'=>104,'tags'=>['type'=>'route','route'=>'bus'],                                   // без ref и без name — пропускаем
   'members'=>[['type'=>'node','ref'=>2]]],
];

$r = transport_rows_from_overpass($elements);
$rows = $r['rows'];
$by = [];
foreach ($rows as $x) $by[$x['name']] = $x;

ck('безымянные остановки больше не выбрасываются', count($rows) === 6, count($rows) . ' строк: ' . implode(' | ', array_keys($by)));

$s1 = null; foreach ($rows as $x) if (($x['osmId'] ?? '') === '1') $s1 = $x;
ck('на остановке видно, какие маршруты останавливаются', $s1 && $s1['routes'] === 'автобус: 11, 33 · маршрутка: 5', $s1['routes'] ?? 'нет строки');
ck('число маршрутов посчитано', $s1 && $s1['routesCount'] === 3, $s1['routesCount'] ?? null);

$s2 = null; foreach ($rows as $x) if (($x['osmId'] ?? '') === '2') $s2 = $x;
ck('безымянная остановка названа по улице', $s2 && $s2['name'] === 'Автобусная остановка - ул. Амира Темура', $s2['name'] ?? null);
ck('собственное имя остановки не переписывается', isset($by['Хадра']), implode(', ', array_keys($by)));

$metro = $by['Пахтакор'] ?? null;
ck('станция метро распознана как метро', $metro && $metro['hubType'] === 'Станция метро' && $metro['subtype'] === 'station', $metro['hubType'] ?? null);
$avto = $by['Автовокзал Ташкент'] ?? null;
ck('вокзал полигоном взят по центру', $avto && $avto['subtype'] === 'bus_station' && abs($avto['lat'] - 41.317) < 1e-9, $avto['subtype'] ?? null);

$plain = false; foreach ($rows as $x) if (($x['osmId'] ?? '') === '5') $plain = true;
ck('перрон без вида транспорта не попал в слой', !$plain, $plain ? 'попал' : 'отброшен');

$s6 = null; foreach ($rows as $x) if (($x['osmId'] ?? '') === '6') $s6 = $x;
ck('платформа с признаком bus взята и получила маршрут', $s6 && $s6['routes'] === 'маршрутка: 5', $s6['routes'] ?? null);

$noName = null; foreach ($rows as $x) if (($x['osmId'] ?? '') === '1') $noName = $x;
ck('остановка без имени и улицы названа по маршрутам', $noName && strpos($noName['name'], '11') !== false, $noName['name'] ?? null);

ck('маршрут без номера и названия пропущен', count($r['routes']) === 3, count($r['routes']) . ': ' . implode(' | ', array_keys($r['routes'])));
/* маршрут 11 проходит и через первую, и через вторую остановку, маршрутка 5 - через первую
   и шестую: остановок с маршрутами три, а не две */
ck('посчитано, у скольких остановок есть маршруты', $r['withRoutes'] === 3, $r['withRoutes']);

/* Порядок номеров: «2» должен идти перед «10», обычная сортировка строк даёт обратное */
$mix = [
  ['type'=>'node','id'=>50,'lat'=>41.3,'lon'=>69.2,'tags'=>['highway'=>'bus_stop']],
  ['type'=>'relation','id'=>201,'tags'=>['type'=>'route','route'=>'bus','ref'=>'10'],'members'=>[['type'=>'node','ref'=>50]]],
  ['type'=>'relation','id'=>202,'tags'=>['type'=>'route','route'=>'bus','ref'=>'2'],'members'=>[['type'=>'node','ref'=>50]]],
  ['type'=>'relation','id'=>203,'tags'=>['type'=>'route','route'=>'bus','ref'=>'9'],'members'=>[['type'=>'node','ref'=>50]]],
];
$m = transport_rows_from_overpass($mix);
ck('номера маршрутов идут по-человечески: 2, 9, 10', $m['rows'][0]['routes'] === 'автобус: 2, 9, 10', $m['rows'][0]['routes']);

/* Пустой ответ не должен ронять разбор */
$e = transport_rows_from_overpass([]);
ck('пустой ответ Overpass обрабатывается без ошибки', $e['rows'] === [] && $e['withRoutes'] === 0);

echo $failed ? "\nПРОВАЛЕНО проверок: $failed\n" : "\nВсе проверки разбора транспорта пройдены\n";
exit($failed ? 1 : 0);
