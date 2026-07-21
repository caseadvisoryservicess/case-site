<?php
// CASE OS v3.5.7 — Market data endpoint for map/location snapshots.
require __DIR__.'/lib.php';
require_login();
function table_exists_v34(string $t): bool { try { db()->query('SELECT 1 FROM `'.$t.'` LIMIT 1'); return true; } catch (Throwable $e) { return false; } }
function country_iso3_v34(string $country): string {
  $s = mb_strtolower(trim($country));
  $map = ['uzbekistan'=>'UZB','узбекистан'=>'UZB','uz'=>'UZB','tajikistan'=>'TJK','таджикистан'=>'TJK','tj'=>'TJK','kazakhstan'=>'KAZ','казахстан'=>'KAZ','kz'=>'KAZ','turkey'=>'TUR','турция'=>'TUR','tr'=>'TUR','uae'=>'ARE','оаэ'=>'ARE','united arab emirates'=>'ARE','russia'=>'RUS','россия'=>'RUS'];
  return $map[$s] ?? strtoupper(substr(preg_replace('/[^A-Za-z]/','',$country),0,3));
}
function http_json_v34(string $url): ?array {
  $ctx = stream_context_create(['http'=>['timeout'=>10,'header'=>"User-Agent: CASE-OS/4.8\r\n"]]);
  $raw = @file_get_contents($url, false, $ctx);
  if ($raw === false) return null;
  $j = json_decode($raw, true);
  return is_array($j) ? $j : null;
}
function wb_indicator_v34(string $iso3, string $indicator): ?array {
  $url = 'https://api.worldbank.org/v2/country/'.rawurlencode($iso3).'/indicator/'.rawurlencode($indicator).'?format=json&per_page=5';
  $j = http_json_v34($url);
  if (!$j || empty($j[1]) || !is_array($j[1])) return null;
  foreach ($j[1] as $row) { if (isset($row['value']) && $row['value'] !== null) return ['value'=>$row['value'],'year'=>$row['date'] ?? null,'source'=>'World Bank WDI','indicator'=>$indicator]; }
  return null;
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'GET') {
  $country = (string)($_GET['country'] ?? 'Uzbekistan');
  $region = (string)($_GET['region'] ?? '');
  $city = (string)($_GET['city'] ?? '');
  $iso3 = country_iso3_v34($country);
  $snapshot = ['country'=>$country,'iso3'=>$iso3,'region'=>$region,'city'=>$city,'updated_at'=>date('c'),'sources'=>[
    'World Bank WDI','IMF Data / WEO','UN Population Division','National statistics portals','CBU / Central bank rates'
  ], 'indicators'=>[]];
  if (table_exists_v34('market_data_points')) {
    $st = db()->prepare('SELECT indicator_key, indicator_label, value, unit, year, source_name, source_url, updated_at FROM market_data_points WHERE country_iso3=? AND (city=? OR city IS NULL OR city="") ORDER BY year DESC, updated_at DESC LIMIT 200');
    $st->execute([$iso3,$city]);
    $rows = $st->fetchAll();
    if ($rows) $snapshot['indicators'] = $rows;
  }
  if (!$snapshot['indicators']) {
    $defs = ['SP.POP.TOTL'=>'Population','NY.GDP.MKTP.CD'=>'GDP current US$','NY.GDP.PCAP.CD'=>'GDP per capita current US$','FP.CPI.TOTL.ZG'=>'Inflation CPI %','SP.URB.TOTL.IN.ZS'=>'Urban population %'];
    foreach ($defs as $k=>$label) { $v = wb_indicator_v34($iso3,$k); if ($v) $snapshot['indicators'][] = ['indicator_key'=>$k,'indicator_label'=>$label,'value'=>$v['value'],'unit'=>'','year'=>$v['year'],'source_name'=>$v['source'],'source_url'=>'https://data.worldbank.org/indicator/'.$k,'updated_at'=>date('c')]; }
  }
  json_out(['ok'=>true,'snapshot'=>$snapshot,'note'=>'City/region data often requires national statistics API or CSV import. Configure monthly cron to refresh.']);
}
if ($method === 'POST') {
  if (!can('admin') && !can('finance')) fail('Нет доступа к обновлению market data',403);
  $b = body();
  if (($b['action'] ?? '') === 'upsert_point') {
    if (!table_exists_v34('market_data_points')) fail('Run migration 2026_07_18_asaas_v34_market_gis.sql first',400);
    $st = db()->prepare('INSERT INTO market_data_points (country_iso3,country,region,city,indicator_key,indicator_label,value,unit,year,source_name,source_url,updated_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE value=VALUES(value),unit=VALUES(unit),year=VALUES(year),source_name=VALUES(source_name),source_url=VALUES(source_url),updated_by=VALUES(updated_by),updated_at=CURRENT_TIMESTAMP');
    $st->execute([$b['country_iso3']??country_iso3_v34($b['country']??''),$b['country']??null,$b['region']??null,$b['city']??null,$b['indicator_key']??'', $b['indicator_label']??'', $b['value']??null, $b['unit']??null, $b['year']??null, $b['source_name']??null, $b['source_url']??null, current_user()['name']??null]);
    json_out(['ok'=>true]);
  }
  fail('Unknown action',400);
}
fail('Метод не поддерживается',405);
