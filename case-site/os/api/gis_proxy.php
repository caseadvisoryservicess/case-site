<?php
// CASE OS v3.5.7 — GIS proxy for isochrones / POI / routes. Keeps API keys server-side.
require __DIR__.'/lib.php';
require_login();
function gis_cfg_v34(string $key): string { $c = cfg(); return (string)($c[$key] ?? ($c['gis'][$key] ?? '')); }
function gis_http_json_v34(string $url, string $method='GET', ?array $payload=null, array $headers=[]): ?array {
  $opts = ['http'=>['timeout'=>20,'method'=>$method,'header'=>implode("\r\n", array_merge(['Content-Type: application/json','User-Agent: CASE-OS/4.8'], $headers))]];
  if ($payload !== null) $opts['http']['content'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
  $raw = @file_get_contents($url, false, stream_context_create($opts));
  if ($raw === false) return null;
  $j = json_decode($raw, true);
  return is_array($j) ? $j : ['raw'=>$raw];
}
$provider = strtolower((string)($_GET['provider'] ?? 'openrouteservice'));
$mode = strtolower((string)($_GET['mode'] ?? 'isochrone'));
$lat = (float)($_GET['lat'] ?? 0); $lon = (float)($_GET['lon'] ?? 0);
if (!$lat || !$lon) fail('lat/lon required',400);
if ($mode === 'isochrone') {
  $minutes = array_values(array_filter(array_map('intval', explode(',', (string)($_GET['minutes'] ?? '5,10,15')))));
  if (!$minutes) $minutes = [5,10,15];
  if ($provider === 'openrouteservice' || $provider === 'ors') {
    $key = gis_cfg_v34('openrouteservice_key'); if (!$key) json_out(['ok'=>false,'needs_key'=>'openrouteservice_key','message'=>'Add openrouteservice_key to os/api/config.php']);
    $payload = ['locations'=>[[$lon,$lat]], 'range'=>array_map(function($m){ return $m*60; }, $minutes), 'range_type'=>'time'];
    $j = gis_http_json_v34('https://api.openrouteservice.org/v2/isochrones/driving-car','POST',$payload,['Authorization: '.$key]);
    json_out(['ok'=>!!$j,'provider'=>'openrouteservice','data'=>$j]);
  }
  if ($provider === 'yandex') {
    $key = gis_cfg_v34('yandex_isochrone_key'); if (!$key) json_out(['ok'=>false,'needs_key'=>'yandex_isochrone_key','message'=>'Add yandex_isochrone_key to os/api/config.php']);
    $out=[]; foreach($minutes as $m){ $url='https://isoline.api.maps.yandex.ru/v1/driving?ll='.rawurlencode($lon.','.$lat).'&duration='.($m*60).'&apikey='.rawurlencode($key); $out[$m]=gis_http_json_v34($url); }
    json_out(['ok'=>true,'provider'=>'yandex','data'=>$out]);
  }
  if ($provider === '2gis' || $provider === 'dgis') {
    $key = gis_cfg_v34('dgis_key'); if (!$key) json_out(['ok'=>false,'needs_key'=>'dgis_key','message'=>'Add dgis_key to os/api/config.php']);
    $payload = ['points'=>[['lat'=>$lat,'lon'=>$lon]], 'durations'=>array_map(function($m){ return $m*60; },$minutes), 'transport'=>'car'];
    $j = gis_http_json_v34('https://routing.api.2gis.com/isochrone/2.0.0?key='.rawurlencode($key),'POST',$payload);
    json_out(['ok'=>!!$j,'provider'=>'2gis','data'=>$j]);
  }
  if ($provider === 'google') {
    json_out(['ok'=>false,'provider'=>'google','message'=>'Google Maps Platform does not provide a native isochrone polygon endpoint. Use Routes API / Compute Route Matrix for travel-time comparison, or ORS/Yandex/2GIS for polygons.']);
  }
}
// Категории "Городские объекты" (см. os/v420-geo-studio.js POI_DEFS) -> OSM-теги для Overpass.
// Ключи должны совпадать 1:1 с ключами POI_DEFS на клиенте.
function osm_poi_tag_filters(string $category): array {
  // Фильтры расширены по итогам предметного исследования реальных ташкентских объектов
  // по каждой категории (2GIS/Google Maps/Yandex Maps/Golden Pages/отраслевые сайты, июль 2026) —
  // добавлены OSM-теги, которые для найденных объектов оказались более типичными, чем исходный
  // узкий набор (см. POI_RESEARCH.md). Расширения ограничены простыми тегами/regex того же вида,
  // что уже использовался (без непроверяемых в песочнице составных Overpass-фильтров).
  $map = [
    'hotels'         => ['tourism~"hotel|apartment|guest_house|hostel|motel"'],
    'shopping'       => ['shop=mall', 'shop=department_store'],
    'street_retail'  => ['shop~"clothes|shoes|bag|jewelry|watches|electronics|appliance|computer|books|furniture|interior_decoration|hairdresser|beauty|cosmetics|perfumery|bakery|confectionery|pastry|florist|gift_shop|toys|sports|stationery|mobile_phone|optician|variety_store|department_store|convenience"'],
    'supermarkets'   => ['shop~"supermarket|convenience"'],
    'markets'        => ['amenity=marketplace', 'market=flea_market'],
    'restaurants'    => ['amenity=restaurant'],
    'cafes'          => ['amenity=cafe'],
    'fast_food'      => ['amenity=fast_food', 'amenity=food_court'],
    'parks'          => ['leisure~"park|garden|nature_reserve|recreation_ground"', 'tourism=theme_park'],
    'playgrounds'    => ['leisure~"playground|amusement_arcade"', 'tourism=theme_park'],
    'entertainment'  => ['amenity~"cinema|nightclub"', 'leisure~"amusement_arcade|water_park|bowling_alley"', 'tourism~"theme_park|aquarium"'],
    'sports'         => ['leisure~"sports_centre|fitness_centre|stadium|swimming_pool|ice_rink|sports_hall"'],
    'education'      => ['amenity~"school|university|college|kindergarten|language_school|music_school|driving_school"'],
    'residential'    => ['building~"apartments|residential"'],
    'warehouses'     => ['building~"warehouse|industrial"', 'landuse=industrial', 'office=logistics'],
    'parking'        => ['amenity=parking', 'building~"parking|garages"'],
    'transport_hubs' => ['highway=bus_stop', 'railway~"station|halt"', 'amenity=bus_station', 'aeroway=aerodrome'],
    'culture'        => ['amenity~"theatre|museum|arts_centre|library|community_centre|social_centre"'],
    'tourism'        => ['tourism~"attraction|viewpoint|gallery|museum|artwork|zoo|theme_park"', 'historic~"monument|memorial|archaeological_site|castle|ruins"'],
    'finance'        => ['amenity~"bank|atm|bureau_de_change|money_transfer"'],
    'government'     => ['amenity~"townhall|courthouse|police|post_office"', 'office=government'],
    'fuel_auto'      => ['amenity~"fuel|car_wash|charging_station"', 'shop~"car|car_repair|car_parts|tyres"'],
    'mahallas'       => ['place~"neighbourhood|quarter"'],
  ];
  return $map[$category] ?? [];
}
if ($mode === 'poi') {
  if ($provider === 'osm' || $provider === 'overpass') {
    $category = (string)($_GET['category'] ?? '');
    $filters = osm_poi_tag_filters($category);
    if (!$filters) fail('Unknown category', 400);
    $south = (float)($_GET['south'] ?? 0); $west = (float)($_GET['west'] ?? 0);
    $north = (float)($_GET['north'] ?? 0); $east = (float)($_GET['east'] ?? 0);
    if (!$south || !$west || !$north || !$east) fail('south/west/north/east required', 400);
    $bbox = "$south,$west,$north,$east";
    $stmts = '';
    foreach ($filters as $f) { $stmts .= "node[$f]($bbox);way[$f]($bbox);"; }
    // Лимит выборки: 400 было мало для города целиком (обрезало плотные категории —
    // рестораны/магазины/супермаркеты). Клиент может запросить больше через &limit=;
    // держим потолок 3000, чтобы не перегрузить Overpass и браузер.
    $limit = (int)($_GET['limit'] ?? 2000); if ($limit < 50) $limit = 50; if ($limit > 3000) $limit = 3000;
    $ql = "[out:json][timeout:40];($stmts);out center $limit;";
    $url = 'https://overpass-api.de/api/interpreter?' . http_build_query(['data' => $ql]);
    $raw = @file_get_contents($url, false, stream_context_create(['http' => [
      'timeout' => 25, 'method' => 'GET', 'header' => "User-Agent: CASE-OS/4.8 (POI layer fetch)\r\n",
    ]]));
    if ($raw === false) json_out(['ok' => false, 'message' => 'Overpass API недоступен с сервера (сеть/таймаут). Добавьте объекты вручную через «Управление данными» или повторите позже.']);
    $j = json_decode($raw, true);
    if (!is_array($j) || !isset($j['elements'])) json_out(['ok' => false, 'message' => 'Overpass вернул неожиданный ответ.']);
    $out = []; $seen = [];
    foreach ($j['elements'] as $el) {
      $lat = $el['lat'] ?? ($el['center']['lat'] ?? null);
      $lon = $el['lon'] ?? ($el['center']['lon'] ?? null);
      if ($lat === null || $lon === null) continue;
      $tags = is_array($el['tags'] ?? null) ? $el['tags'] : [];
      $name = trim((string)($tags['name'] ?? ''));
      if ($name === '') continue; // без названия POI бесполезен на карте — не добавляем шум
      $dupKey = round((float)$lat, 5) . ',' . round((float)$lon, 5) . '|' . $name;
      if (isset($seen[$dupKey])) continue; $seen[$dupKey] = true;
      $addr = trim(($tags['addr:street'] ?? '') . ' ' . ($tags['addr:housenumber'] ?? ''));
      $out[] = [
        'name' => $name, 'lat' => (float)$lat, 'lng' => (float)$lon,
        'subtype' => $tags['shop'] ?? $tags['amenity'] ?? $tags['leisure'] ?? $tags['tourism'] ?? $tags['building'] ?? $tags['railway'] ?? $tags['highway'] ?? '',
        'address' => $addr, 'district' => '', 'provider' => 'OSM', '_verification' => 'online',
      ];
      if (count($out) >= $limit) break;
    }
    json_out(['ok' => true, 'provider' => 'osm', 'category' => $category, 'count' => count($out), 'rows' => $out]);
  }
  json_out(['ok'=>false,'message'=>'POI proxy requires provider-specific Search API keys (Yandex / 2GIS / Google Places), or provider=osm (no key needed — OpenStreetMap Overpass).']);
}
fail('Unsupported mode/provider',400);
