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
// Синтаксис совместим с PHP 7.2-8.4: хостинг на PHP 8.0 (16.09.2026), но версия переключается в
// панели одним кликом, и код не должен зависеть от этого выбора.
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

// v4.72.1: GET наружу. curl предпочтительнее: даёт код ответа и не зависит от allow_url_fopen,
// который на части хостингов выключен, и тогда file_get_contents молча возвращает false.
// Возвращает ['status'=>int, 'body'=>string, 'error'=>string].
function osm_http_get(string $url, int $timeout, string $ua): array {
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 12, CURLOPT_HTTPHEADER => ['User-Agent: ' . $ua]]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = $raw === false ? curl_error($ch) : '';
    curl_close($ch);
    return ['status'=>$status, 'body'=>is_string($raw) ? $raw : '', 'error'=>$err];
  }
  if (!ini_get('allow_url_fopen')) return ['status'=>0, 'body'=>'', 'error'=>'на хостинге нет curl и выключен allow_url_fopen'];
  $raw = @file_get_contents($url, false, stream_context_create(['http' => ['timeout' => $timeout, 'method' => 'GET', 'header' => "User-Agent: $ua\r\n", 'ignore_errors' => true]]));
  $status = 0;
  if (isset($http_response_header[0]) && preg_match('~\s(\d{3})\s~', $http_response_header[0], $m)) $status = (int)$m[1];
  return ['status'=>$status, 'body'=>is_string($raw) ? $raw : '', 'error'=>$raw === false ? 'network' : ''];
}

// v4.73.0: адрес -> точка через Nominatim (OpenStreetMap). Правила сервиса: узнаваемый
// User-Agent, не чаще одного запроса в секунду, кэш разрешён. Страна ограничена Узбекистаном:
// агент работает по Ташкенту, и без ограничения «Чиланзар» находился в трёх странах.
function osm_geocode_url(string $q, string $lang): string {
  return 'https://nominatim.openstreetmap.org/search?' . http_build_query([
    'q' => $q, 'format' => 'jsonv2', 'limit' => 5, 'countrycodes' => 'uz', 'accept-language' => $lang, 'addressdetails' => 0,
  ]);
}

// Ответ Nominatim -> короткие записи. Берём только то, у чего есть координаты; имя и тип
// могут отсутствовать, это не ошибка.
function osm_geocode_parse($json): array {
  if (!is_array($json)) return [];
  $out = [];
  foreach ($json as $r) {
    if (!is_array($r) || !isset($r['lat'], $r['lon']) || !is_numeric($r['lat']) || !is_numeric($r['lon'])) continue;
    $out[] = [
      'name' => mb_substr(trim((string)($r['display_name'] ?? '')), 0, 200),
      'lat'  => round((float)$r['lat'], 6),
      'lon'  => round((float)$r['lon'], 6),
      'type' => (string)($r['type'] ?? ''),
    ];
    if (count($out) >= 5) break;
  }
  return $out;
}

// Что умеет этот PHP: от этого зависит, может ли сервер вообще выходить в сеть.
function osm_env(): array {
  return [
    'php' => PHP_VERSION,
    'curl' => function_exists('curl_init'),
    'allow_url_fopen' => (bool)ini_get('allow_url_fopen'),
    'openssl' => extension_loaded('openssl'),
  ];
}

// Короткий GET с замером времени: для проверки связи, не для данных.
function osm_probe(string $url): array {
  $t0 = microtime(true);
  $r = osm_http_get($url, 8, 'CASE-OS/4.73 (connectivity check; caseadvisory.uz)');
  $r['ms'] = (int)round((microtime(true) - $t0) * 1000);
  $r['body'] = mb_substr((string)$r['body'], 0, 200);
  return $r;
}

// Факты проверки связи -> советы словами. Чистая функция: сеть не трогает, чтобы её можно
// было проверить на всех сочетаниях. Каждый совет называет причину и что сделать; текст
// для поддержки хостинга дан дословно, потому что владелец будет его пересылать.
function osm_diagnosis(array $f): array {
  $env = isset($f['env']) && is_array($f['env']) ? $f['env'] : [];
  $ov = isset($f['overpass']) && is_array($f['overpass']) ? $f['overpass'] : ['status' => 0, 'error' => '', 'ms' => 0];
  $nm = isset($f['nominatim']) && is_array($f['nominatim']) ? $f['nominatim'] : ['status' => 0, 'error' => '', 'ms' => 0];
  $llm = isset($f['llm']) && is_array($f['llm']) ? $f['llm'] : ['configured' => false];
  $curl = !empty($env['curl']); $fopen = !empty($env['allow_url_fopen']);
  $out = [];

  if (!$curl && !$fopen) $out[] = 'На хостинге нет расширения curl и выключен allow_url_fopen: PHP не может выходить в сеть вообще. В панели хостинга откройте «Select PHP version» и поставьте галочку curl, затем повторите проверку.';
  elseif (!$curl) $out[] = 'Расширение curl выключено, PHP ходит в сеть через file_get_contents: это работает, но хуже переживает медленные ответы. Для надёжности включите curl в «Select PHP version».';

  $line = function (string $what, array $r): string {
    $st = (int)($r['status'] ?? 0); $err = (string)($r['error'] ?? ''); $ms = (int)($r['ms'] ?? 0);
    if ($st >= 200 && $st < 400) return $what . ' доступен: HTTP ' . $st . ' за ' . $ms . ' мс.';
    if ($st === 429 || $st === 503 || $st === 504) return $what . ' перегружен (HTTP ' . $st . '). Это на их стороне. Повторите позже или уменьшите радиус.';
    if ($st > 0) return $what . ' ответил кодом HTTP ' . $st . '. Повторите позже; если повторяется, сообщите разработчику код ответа.';
    return $what . ' не отвечает с сервера' . ($err !== '' ? ' (' . $err . ')' : '') . '.';
  };
  $out[] = $line('Overpass API (здания и дороги OSM)', $ov);
  $out[] = $line('Геокодер Nominatim (поиск адреса)', $nm);

  $ovDown = (int)($ov['status'] ?? 0) === 0; $nmDown = (int)($nm['status'] ?? 0) === 0;
  if ($ovDown && $nmDown) $out[] = 'Итог: оба внешних сервиса не отвечают с сервера, значит причина не в них. Если curl включён, это сетевая политика хостинга: напишите в поддержку дословно «разрешите исходящие HTTPS-соединения из PHP к overpass-api.de и nominatim.openstreetmap.org». Пока сеть закрыта, точку задавайте кликом или координатами, а здания и дороги недоступны.';
  elseif ($ovDown) $out[] = 'Итог: геокодер отвечает, а Overpass нет. Скорее всего таймаут на большом запросе: уменьшите радиус до 500 м и повторите; если не помогает, попросите поддержку хостинга разрешить исходящие HTTPS к overpass-api.de.';
  elseif ($nmDown) $out[] = 'Итог: Overpass отвечает, а геокодер нет. Попросите поддержку хостинга разрешить исходящие HTTPS к nominatim.openstreetmap.org; пока точку задавайте кликом или координатами.';

  if (!empty($llm['configured'])) {
    $st = (int)($llm['status'] ?? 0); $ep = (string)($llm['endpoint'] ?? ''); $model = (string)($llm['model'] ?? '');
    if ($st >= 200 && $st < 400) $out[] = 'Своя модель ' . $ep . ' отвечает (' . $model . ', ' . (int)($llm['ms'] ?? 0) . ' мс): свободные фразы, которые движок не разобрал, она переводит в команды; числа всё равно считают инструменты.';
    else $out[] = 'Своя модель ' . $ep . ' не отвечает' . (!empty($llm['error']) ? ' (' . $llm['error'] . ')' : ($st ? ' (HTTP ' . $st . ')' : '')) . ': проверьте, запущена ли Ollama (или другой OpenAI-совместимый сервер) и верен ли адрес в config.php. Команды работают без неё.';
  } elseif (!empty($llm['ollama_local'])) {
    $models = trim((string)($llm['ollama_models'] ?? ''));
    $first = $models !== '' ? trim(explode(',', $models)[0]) : 'llama3';
    $out[] = 'На сервере найдена Ollama' . ($models !== '' ? ' (модели: ' . $models . ')' : ' (моделей не загружено)') . '. Чтобы агент понимал свободные фразы, впишите в os/api/config.php: \'llm_endpoint\' => \'http://127.0.0.1:11434/v1\', \'llm_model\' => \'' . $first . '\'.';
  } else {
    $out[] = 'Своя модель не настроена: запросы разбираются детерминированным движком команд, и для радиусов, населения, зданий, дорог, полигонов и цветов этого достаточно. Внешние платные сервисы ИИ не используются.';
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
