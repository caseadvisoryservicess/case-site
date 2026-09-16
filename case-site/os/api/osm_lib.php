<?php
// CASE OS v4.72.0 - здания и дороги из OpenStreetMap для гео-ассистента.
//
// Отдельный файл, а не куски внутри gis_proxy.php, по одной причине: сборку запроса и
// разбор ответа Overpass нельзя проверить, когда они зашиты в скрипт, который требует
// сессию и базу. Здесь только чистые функции; gis_proxy.php их вызывает.
//
// Что отдаём и почему именно так:
//   - здания: контур (замкнутый way) + этажность, тип, имя, адрес. Центроид считаем сами,
//     чтобы клиент мог отобрать здания «внутри круга» по одному числу, а не по полигону;
//   - дороги: линии + класс (highway), имя, одностороннее движение. Класс нужен, чтобы
//     ассистент умел «показать только магистрали»;
//   - лицензия: OSM распространяется по ODbL, и атрибуция обязательна на любой карте и в
//     любой выгрузке. Поэтому строка атрибуции возвращается в каждом ответе, а не хранится
//     где-то на клиенте, где её забудут при следующей переделке легенды.
//
// Синтаксис PHP 7.2: боевой сервер (см. HANDOFF, 27.07.2026) работает на нём.
declare(strict_types=1);

// Ограничения запроса. Радиус больше 3 км даёт десятки тысяч зданий: Overpass отвечает
// минутами, а браузер рисует их с трудом. Для решения о локации 3 км и так много.
function osm_radius_limit_m(): int { return 3000; }
function osm_feature_limit(string $kind): int { return $kind === 'buildings' ? 6000 : 4000; }

// Классы дорог по OSM. Служебные проезды (service) и дорожки исключены намеренно: они
// заполняют карту шумом и ничего не говорят о доступности участка.
function osm_road_classes(): array {
  return ['motorway','trunk','primary','secondary','tertiary','unclassified','residential',
          'motorway_link','trunk_link','primary_link','secondary_link','tertiary_link','living_street','pedestrian'];
}

// Рамка вокруг точки. Широта в градусах на километр постоянна (111.32 км), долгота
// сжимается косинусом широты: на широте Ташкента километр по долготе короче на четверть.
function osm_bbox(float $lat, float $lon, int $radiusM): array {
  $r = max(50, min(osm_radius_limit_m(), $radiusM));
  $dLat = $r / 111320.0;
  $dLon = $r / (111320.0 * max(0.2, cos(deg2rad($lat))));
  return ['south'=>$lat - $dLat, 'west'=>$lon - $dLon, 'north'=>$lat + $dLat, 'east'=>$lon + $dLon, 'radius_m'=>$r];
}

function osm_bbox_str(array $b): string {
  return sprintf('%.6f,%.6f,%.6f,%.6f', $b['south'], $b['west'], $b['north'], $b['east']);
}

// Запрос Overpass QL для зданий. out geom - чтобы вершины пришли прямо в way, без второго
// запроса за узлами. Отношения (многоконтурные здания) не запрашиваем: их мало, а разбор
// вдвое сложнее; для решения о локации контур внешнего кольца не критичен.
function osm_buildings_ql(array $bbox, int $limit): string {
  $bb = osm_bbox_str($bbox);
  return '[out:json][timeout:45];(way["building"](' . $bb . '););out geom ' . max(100, $limit) . ';';
}

function osm_roads_ql(array $bbox, int $limit, ?array $classes = null): string {
  $cls = $classes ?: osm_road_classes();
  $cls = array_values(array_filter(array_map(function ($c) { return preg_replace('~[^a-z_]~', '', strtolower((string)$c)); }, $cls)));
  if (!$cls) $cls = osm_road_classes();
  $bb = osm_bbox_str($bbox);
  return '[out:json][timeout:45];(way["highway"~"^(' . implode('|', $cls) . ')$"](' . $bb . '););out geom ' . max(100, $limit) . ';';
}

// Центроид по вершинам (среднее). Для контура здания этого достаточно: нам нужна точка
// «где здание», а не строгий центр масс полигона.
function osm_centroid(array $geom): ?array {
  // Замкнутый контур в OSM повторяет первую вершину последней; без этого шага среднее
  // смещалось бы к первой вершине.
  $cnt = count($geom);
  if ($cnt > 1 && isset($geom[0]['lat'], $geom[0]['lon'], $geom[$cnt - 1]['lat'], $geom[$cnt - 1]['lon'])
      && (float)$geom[0]['lat'] === (float)$geom[$cnt - 1]['lat'] && (float)$geom[0]['lon'] === (float)$geom[$cnt - 1]['lon']) {
    array_pop($geom);
  }
  $n = 0; $la = 0.0; $lo = 0.0;
  foreach ($geom as $p) {
    if (!isset($p['lat'], $p['lon'])) continue;
    $la += (float)$p['lat']; $lo += (float)$p['lon']; $n++;
  }
  if (!$n) return null;
  return [round($la / $n, 6), round($lo / $n, 6)];
}

// Площадь контура в м² (формула шнурков на локальной плоскости). Нужна для «суммарной
// площади застройки в радиусе» - цифры, которую спрашивают чаще, чем число зданий.
function osm_area_m2(array $geom, float $lat0): float {
  $n = count($geom);
  if ($n < 3) return 0.0;
  $kx = 111320.0 * cos(deg2rad($lat0)); $ky = 111320.0;
  $s = 0.0;
  for ($i = 0; $i < $n; $i++) {
    $a = $geom[$i]; $b = $geom[($i + 1) % $n];
    if (!isset($a['lat'], $a['lon'], $b['lat'], $b['lon'])) return 0.0;
    $x1 = ((float)$a['lon']) * $kx; $y1 = ((float)$a['lat']) * $ky;
    $x2 = ((float)$b['lon']) * $kx; $y2 = ((float)$b['lat']) * $ky;
    $s += $x1 * $y2 - $x2 * $y1;
  }
  return abs($s) / 2.0;
}

function osm_int_or_null($v): ?int {
  if ($v === null || $v === '') return null;
  if (!preg_match('~^-?\d+~', (string)$v, $m)) return null;
  return (int)$m[0];
}

// Ответ Overpass -> компактные записи для клиента. Координаты округлены до 6 знаков
// (это ~11 см): дальше только вес, а не точность.
function osm_ways_to_buildings(array $elements, float $lat0, int $limit): array {
  $out = [];
  foreach ($elements as $el) {
    if (($el['type'] ?? '') !== 'way' || !is_array($el['geometry'] ?? null)) continue;
    $geom = $el['geometry'];
    if (count($geom) < 4) continue;                 // не контур
    $tags = is_array($el['tags'] ?? null) ? $el['tags'] : [];
    $c = osm_centroid($geom);
    if ($c === null) continue;
    $ring = [];
    foreach ($geom as $p) { if (isset($p['lat'], $p['lon'])) $ring[] = [round((float)$p['lat'], 6), round((float)$p['lon'], 6)]; }
    $b = (string)($tags['building'] ?? 'yes');
    $out[] = [
      'id'     => (int)($el['id'] ?? 0),
      'c'      => $c,
      'ring'   => $ring,
      'kind'   => $b === 'yes' ? '' : $b,          // 'yes' означает «здание без уточнения»
      'levels' => osm_int_or_null($tags['building:levels'] ?? null),
      'name'   => mb_substr(trim((string)($tags['name'] ?? '')), 0, 120),
      'addr'   => mb_substr(trim(((string)($tags['addr:street'] ?? '')) . ' ' . ((string)($tags['addr:housenumber'] ?? ''))), 0, 120),
      'area'   => (int)round(osm_area_m2($geom, $lat0)),
    ];
    if (count($out) >= $limit) break;
  }
  return $out;
}

function osm_ways_to_roads(array $elements, int $limit): array {
  $out = [];
  foreach ($elements as $el) {
    if (($el['type'] ?? '') !== 'way' || !is_array($el['geometry'] ?? null)) continue;
    $geom = $el['geometry'];
    if (count($geom) < 2) continue;
    $tags = is_array($el['tags'] ?? null) ? $el['tags'] : [];
    $line = [];
    foreach ($geom as $p) { if (isset($p['lat'], $p['lon'])) $line[] = [round((float)$p['lat'], 6), round((float)$p['lon'], 6)]; }
    $out[] = [
      'id'     => (int)($el['id'] ?? 0),
      'line'   => $line,
      'cls'    => (string)($tags['highway'] ?? ''),
      'name'   => mb_substr(trim((string)($tags['name'] ?? '')), 0, 120),
      'oneway' => in_array(strtolower((string)($tags['oneway'] ?? '')), ['yes','true','1','-1'], true),
      'lanes'  => osm_int_or_null($tags['lanes'] ?? null),
    ];
    if (count($out) >= $limit) break;
  }
  return $out;
}

// Строка происхождения, которая уходит с каждым ответом. Клиент показывает её рядом с
// числом, а не в подвале страницы: это часть данных, а не украшение.
function osm_provenance(string $kind, array $bbox, int $count, ?string $fetchedAt = null, bool $fromCache = false): array {
  return [
    'source'      => 'OpenStreetMap',
    'source_type' => 'osm',
    'licence'     => 'ODbL 1.0',
    'attribution' => '© OpenStreetMap contributors',
    'method'      => $kind === 'buildings' ? 'контуры way["building"] в рамке вокруг точки, Overpass API' : 'линии way["highway"] в рамке вокруг точки, Overpass API',
    'radius_m'    => $bbox['radius_m'],
    'bbox'        => osm_bbox_str($bbox),
    'count'       => $count,
    'fetched_at'  => $fetchedAt ?: date('c'),
    'cached'      => $fromCache,
    'conf'        => 'asking',   // данные наблюдённые, но проверить полноту OSM на месте никто не выезжал
  ];
}
