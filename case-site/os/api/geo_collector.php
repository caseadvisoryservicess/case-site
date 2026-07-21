<?php
/*
 * CASE OS — geo_collector.php
 * Мульти-source сборщик геобазы (Google Places New / Яндекс Geosearch / 2GIS Places / OSM Overpass).
 * Запускается НА СЕРВЕРЕ (где открыта сеть и лежат ключи в config.php), из CLI:
 *
 *   php api/geo_collector.php --category=all --sources=osm,google,yandex,dgis --grid-km=1.5 --out=data/geo_collect_out
 *   php api/geo_collector.php --dry-run                 # только сетка+конфиг, без сети (проверка настройки)
 *   php api/geo_collector.php --category=pharmacy --sources=osm --max-cells=5
 *
 * Ключи читаются из api/config.php: google_maps_key, yandex_search_key, dgis_key.
 * Результат: Master CSV + GeoJSON + отчёты (duplicates / coord_conflicts / missing_data /
 * source_matrix / verification_queue). Дальше админ проверяет и дополняет вручную в CASE OS.
 *
 * ВНИМАНИЕ: инструмент НЕ выдумывает данные. Если источник недоступен/без ключа — он просто
 * пропускается, а в отчёте видно, из каких источников собран каждый объект.
 * PHP 7.4-совместимо (без стрелочных функций).
 */

if (PHP_SAPI !== 'cli') { header('Content-Type: text/plain; charset=utf-8'); }
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $encoding=null) { return strtolower((string)$s); } }
@set_time_limit(0);
@ini_set('memory_limit', '1024M');

// ---------- args ----------
function arg($name, $def=null){
  global $argv;
  foreach ((array)$argv as $a){
    if (strpos($a, '--'.$name.'=')===0) return substr($a, strlen($name)+3);
    if ($a === '--'.$name) return true;
  }
  return $def;
}
$ROOT = dirname(__DIR__);                 // .../os
$OUT  = arg('out', 'data/geo_collect_out');
$OUTDIR = (strpos($OUT,'/')===0) ? $OUT : $ROOT.'/'.$OUT;
@mkdir($OUTDIR, 0775, true);
$DRY   = (bool)arg('dry-run', false);
if (!$DRY && !function_exists('curl_init')) { fwrite(STDERR, "Для живого сбора требуется PHP extension cURL. Включите php-curl на сервере.\n"); exit(2); }
$MAXCELLS = (int)arg('max-cells', 0);      // 0 = без лимита
$ONLYCAT  = arg('category', 'all');
$SRC_ARG  = arg('sources', 'osm,google,yandex,dgis');
$WANT_SRC = array_filter(array_map('trim', explode(',', $SRC_ARG)));
function logline($s){ fwrite(STDERR, '['.date('H:i:s').'] '.$s."\n"); }

// ---------- config ----------
$cfgPath = $ROOT.'/data/geo_collect_config.json';
if (!is_file($cfgPath)) { fwrite(STDERR, "Нет $cfgPath\n"); exit(2); }
$CFG = json_decode(file_get_contents($cfgPath), true);
if (!$CFG) { fwrite(STDERR, "geo_collect_config.json не парсится\n"); exit(2); }
$KEYS = is_file(__DIR__.'/config.php') ? (require __DIR__.'/config.php') : [];
if (!is_array($KEYS)) $KEYS = [];
function keyOf($name){ global $KEYS; return isset($KEYS[$name]) ? trim((string)$KEYS[$name]) : ''; }

$GRID_KM = (float)arg('grid-km', $CFG['grid']['cell_km'] ?? 1.5);
$RADIUS  = (int)($CFG['grid']['search_radius_m'] ?? 1200);
$BBOX    = $CFG['city']['bbox'];
$DEDUP_M = (float)($CFG['dedup']['name_distance_m'] ?? 60);
$CONF    = $CFG['dedup']['coord_confidence'] ?? ['high_m'=>20,'ok_m'=>50,'review_m'=>100];

// ================= ЧИСТАЯ ЛОГИКА (юнит-тестируемая) =================
function haversine_m($lat1,$lng1,$lat2,$lng2){
  $R=6371000.0; $t=M_PI/180.0;
  $dLat=($lat2-$lat1)*$t; $dLng=($lng2-$lng1)*$t;
  $a=sin($dLat/2)*sin($dLat/2)+cos($lat1*$t)*cos($lat2*$t)*sin($dLng/2)*sin($dLng/2);
  return 2*$R*atan2(sqrt($a), sqrt(1-$a));
}
function norm_name($s){
  $s=mb_strtolower(trim((string)$s),'UTF-8');
  $s=preg_replace('/[""«»"'."'".'`]+/u','',$s);
  $s=preg_replace('/\b(ооо|ип|оао|зао|llc|ltd|inc|mchj|xk|xj)\b/u','',$s);
  $s=preg_replace('/[^\p{L}\p{N}]+/u',' ',$s);
  return trim(preg_replace('/\s+/u',' ',$s));
}
function median_num($arr){
  $a=array_values(array_filter($arr, function($x){ return is_numeric($x); }));
  if (!$a) return null;
  sort($a); $n=count($a); $m=intdiv($n,2);
  return ($n%2) ? (float)$a[$m] : (($a[$m-1]+$a[$m])/2.0);
}
// сетка ячеек по bbox
function build_grid($bbox, $cellKm){
  $latKm=111.0; $lngKm=111.0*cos((($bbox['south']+$bbox['north'])/2)*M_PI/180.0);
  $dLat=$cellKm/$latKm; $dLng=$cellKm/max(0.01,$lngKm);
  $cells=[];
  for ($lat=$bbox['south']; $lat<$bbox['north']; $lat+=$dLat){
    for ($lng=$bbox['west']; $lng<$bbox['east']; $lng+=$dLng){
      $cells[]=['lat'=>round($lat+$dLat/2,6),'lng'=>round($lng+$dLng/2,6)];
    }
  }
  return $cells;
}
// уверенность по расхождению координат источников
function coord_confidence($maxSpreadM, $conf){
  if ($maxSpreadM===null) return 'single';
  if ($maxSpreadM<=$conf['high_m']) return 'high';
  if ($maxSpreadM<=$conf['ok_m']) return 'ok';
  if ($maxSpreadM<=$conf['review_m']) return 'review';
  return 'conflict';
}
// грейд A..E записи
function grade_record($rec){
  if (!empty($rec['operating_status']) && $rec['operating_status']==='closed') return 'E';
  $n=(int)$rec['source_count'];
  $cc=$rec['coordinate_accuracy'];
  if ($cc==='conflict') return 'D';
  if ($n>=2 && ($cc==='high'||$cc==='single'||$cc==='ok')) {
    // достаточность полей
    $filled = (!empty($rec['phone'])?1:0)+(!empty($rec['website'])?1:0)+(!empty($rec['address'])?1:0);
    return ($cc==='high' && $filled>=1) ? 'A' : 'B';
  }
  if ($n>=2) return 'B';
  return 'C';
}

// ================= HTTP =================
function http_get($url, $headers=[]){
  $ch=curl_init($url);
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>40,CURLOPT_HTTPHEADER=>$headers,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_USERAGENT=>'CASE-OS-geo-collector/1.0']);
  $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
  return ['code'=>$code,'body'=>$body,'err'=>$err];
}
function http_post_json($url, $payload, $headers=[]){
  $ch=curl_init($url);
  $headers[]='Content-Type: application/json';
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>60,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_HTTPHEADER=>$headers,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_USERAGENT=>'CASE-OS-geo-collector/1.0']);
  $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
  return ['code'=>$code,'body'=>$body,'err'=>$err];
}
function http_post_form($url, $fields){
  $ch=curl_init($url);
  curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>90,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($fields),CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_USERAGENT=>'CASE-OS-geo-collector/1.0']);
  $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
  return ['code'=>$code,'body'=>$body,'err'=>$err];
}

// нормализованная сырая запись из любого источника
function raw($source,$id,$name,$lat,$lng,$cat,$extra=[]){
  return array_merge([
    'source'=>$source,'source_id'=>(string)$id,'name'=>(string)$name,
    'lat'=>is_numeric($lat)?(float)$lat:null,'lng'=>is_numeric($lng)?(float)$lng:null,
    'category_key'=>$cat,'address'=>'','phone'=>'','website'=>'','rating'=>null,'reviews'=>null,'operating_status'=>'',
  ], $extra);
}

// ---------- adapters ----------
function fetch_osm($cat, $bbox, $endpoint){
  $filters=$cat['osm'] ?? []; if (!$filters) return [];
  $q="[out:json][timeout:60];(";
  foreach ($filters as $f){
    $kv=explode('=',$f,2); if(count($kv)!=2) continue;
    $k=$kv[0]; $v=$kv[1];
    $sel='["'.$k.'"="'.$v.'"]';
    $q.="node$sel(".$bbox['south'].",".$bbox['west'].",".$bbox['north'].",".$bbox['east'].");";
    $q.="way$sel(".$bbox['south'].",".$bbox['west'].",".$bbox['north'].",".$bbox['east'].");";
  }
  $q.=");out center tags 3000;";
  $r=http_post_form($endpoint, ['data'=>$q]);
  if ($r['code']!=200 || !$r['body']) return [];
  $j=json_decode($r['body'],true); if(!isset($j['elements'])) return [];
  $out=[];
  foreach ($j['elements'] as $e){
    $lat=$e['lat'] ?? ($e['center']['lat'] ?? null);
    $lng=$e['lon'] ?? ($e['center']['lon'] ?? null);
    if($lat===null||$lng===null) continue;
    $t=$e['tags'] ?? [];
    $nm=$t['name'] ?? ($t['name:ru'] ?? ($t['name:en'] ?? ''));
    if($nm==='') continue;
    $out[]=raw('osm',($e['type'][0].$e['id']),$nm,$lat,$lng,$cat['key'],[
      'address'=>trim(($t['addr:street']??'').' '.($t['addr:housenumber']??'')),
      'phone'=>$t['phone']??($t['contact:phone']??''),
      'website'=>$t['website']??($t['contact:website']??''),
      'subtype'=>isset($t['shop'])?$t['shop']:(isset($t['cuisine'])?$t['cuisine']:''),
    ]);
  }
  return $out;
}
function fetch_google($cat, $cell, $endpoint, $key, $radius){
  if(!$key || empty($cat['queries'])) return [];
  $out=[]; $texts=[];
  foreach (['ru','uz','en'] as $L){ foreach (($cat['queries'][$L]??[]) as $q){ $texts[]=$q; } }
  $texts=array_slice(array_unique($texts),0,3); // ограничим квоту
  foreach ($texts as $tq){
    $payload=[
      'textQuery'=>$tq,
      'languageCode'=>'ru',
      'maxResultCount'=>20,
      'locationBias'=>['circle'=>['center'=>['latitude'=>$cell['lat'],'longitude'=>$cell['lng']],'radius'=>(float)$radius]],
    ];
    if(!empty($cat['google_type'])) $payload['includedType']=$cat['google_type'];
    $headers=['X-Goog-Api-Key: '.$key,'X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.primaryType'];
    $r=http_post_json($endpoint,$payload,$headers);
    if($r['code']!=200||!$r['body']) continue;
    $j=json_decode($r['body'],true); if(empty($j['places'])) continue;
    foreach ($j['places'] as $p){
      $lat=$p['location']['latitude']??null; $lng=$p['location']['longitude']??null; if($lat===null) continue;
      $out[]=raw('google',$p['id']??'',($p['displayName']['text']??''),$lat,$lng,$cat['key'],[
        'address'=>$p['formattedAddress']??'','phone'=>$p['nationalPhoneNumber']??'','website'=>$p['websiteUri']??'',
        'rating'=>$p['rating']??null,'reviews'=>$p['userRatingCount']??null,
        'operating_status'=>(isset($p['businessStatus'])&&$p['businessStatus']!=='OPERATIONAL')?'closed':'',
        'subtype'=>$p['primaryType']??'',
      ]);
    }
  }
  return $out;
}
function fetch_yandex($cat, $cell, $endpoint, $key, $radius){
  if(!$key || empty($cat['queries'])) return [];
  $out=[]; $texts=[];
  foreach (['ru','uz','en'] as $L){ foreach (($cat['queries'][$L]??[]) as $q){ $texts[]=$q; } }
  $texts=array_slice(array_unique($texts),0,3);
  $spn=max(0.01,($radius/111000.0)*2);
  foreach ($texts as $tq){
    $url=$endpoint.'?'.http_build_query([
      'apikey'=>$key,'text'=>$tq,'lang'=>'ru_RU','type'=>'biz','results'=>50,'rspn'=>1,
      'll'=>$cell['lng'].','.$cell['lat'],'spn'=>$spn.','.$spn,
    ]);
    $r=http_get($url);
    if($r['code']!=200||!$r['body']) continue;
    $j=json_decode($r['body'],true); if(empty($j['features'])) continue;
    foreach ($j['features'] as $f){
      $c=$f['geometry']['coordinates']??null; if(!$c) continue; // [lng,lat]
      $meta=$f['properties']['CompanyMetaData']??[];
      $ph=''; if(!empty($meta['Phones'][0]['formatted'])) $ph=$meta['Phones'][0]['formatted'];
      $out[]=raw('yandex',$meta['id']??'',($f['properties']['name']??''),$c[1],$c[0],$cat['key'],[
        'address'=>$meta['address']??'','phone'=>$ph,'website'=>$meta['url']??'',
        'subtype'=>isset($meta['Categories'][0]['name'])?$meta['Categories'][0]['name']:'',
      ]);
    }
  }
  return $out;
}
function fetch_dgis($cat, $cell, $endpoint, $key, $radius){
  if(!$key || empty($cat['queries'])) return [];
  $out=[]; $texts=[];
  foreach (['ru','uz','en'] as $L){ foreach (($cat['queries'][$L]??[]) as $q){ $texts[]=$q; } }
  $texts=array_slice(array_unique($texts),0,3);
  foreach ($texts as $tq){
    $page=1;
    do {
      $url=$endpoint.'?'.http_build_query([
        'q'=>$tq,'point'=>$cell['lng'].','.$cell['lat'],'radius'=>$radius,'key'=>$key,
        'page'=>$page,'page_size'=>50,'fields'=>'items.point,items.address_name,items.contact_groups,items.rubrics',
      ]);
      $r=http_get($url);
      if($r['code']!=200||!$r['body']) break;
      $j=json_decode($r['body'],true);
      $items=$j['result']['items']??[];
      if(!$items) break;
      foreach ($items as $it){
        $pt=$it['point']??null; if(!$pt) continue;
        $ph=''; $web='';
        foreach (($it['contact_groups']??[]) as $g){ foreach (($g['contacts']??[]) as $ct){
          if(($ct['type']??'')==='phone'&&!$ph) $ph=$ct['value']??'';
          if(($ct['type']??'')==='website'&&!$web) $web=$ct['value']??'';
        }}
        $out[]=raw('dgis',$it['id']??'',($it['name']??''),$pt['lat'],$pt['lon'],$cat['key'],[
          'address'=>$it['address_name']??'','phone'=>$ph,'website'=>$web,
          'subtype'=>isset($it['rubrics'][0]['name'])?$it['rubrics'][0]['name']:'',
        ]);
      }
      $total=$j['result']['total']??count($items);
      $page++;
    } while ($page<=3 && ($page-1)*50 < $total);
  }
  return $out;
}

// ================= dedup + merge =================
function name_tokens($s){ $s=norm_name($s); if($s==='') return []; return array_values(array_unique(explode(' ',$s))); }
function name_sim($a,$b){ $ta=name_tokens($a); $tb=name_tokens($b); if(!$ta||!$tb) return 0.0;
  $inter=count(array_intersect($ta,$tb)); $uni=count(array_unique(array_merge($ta,$tb))); return $uni?($inter/$uni):0.0; }
function shares_id($a,$b){
  foreach (['phone','website'] as $f){ if(!empty($a[$f])&&!empty($b[$f])&&norm_name($a[$f])===norm_name($b[$f])) return true; }
  return false;
}
function dedup_merge($raws, $dedupM, $conf){
  // Объединяем по близости + сходству названия (token Jaccard) ИЛИ общему телефону/сайту.
  // Разные написания из разных карт ("Korzinka" / "Korzinka маркет") сшиваются; разные бизнесы
  // рядом с разными именами — нет; один бренд в разных точках — разные записи (по расстоянию).
  $mergeR=max($dedupM,150);
  $groups=[]; // flat: каждый — {_lat,_lng,_cat,_name,items[]}
  foreach ($raws as $r){
    if($r['lat']===null) continue;
    $placed=false;
    foreach ($groups as &$g){
      if($g['_cat']!==$r['category_key']) continue;
      $d=haversine_m($g['_lat'],$g['_lng'],$r['lat'],$r['lng']);
      if($d>$mergeR) continue;
      if(name_sim($g['_name'],$r['name'])>=0.34 || shares_id(['phone'=>$g['_phone'],'website'=>$g['_web']],$r)){
        $g['items'][]=$r; $placed=true; break;
      }
    }
    unset($g);
    if(!$placed){ $groups[]=['_lat'=>$r['lat'],'_lng'=>$r['lng'],'_cat'=>$r['category_key'],'_name'=>$r['name'],'_phone'=>$r['phone'],'_web'=>$r['website'],'items'=>[$r]]; }
  }
  $records=[]; $idx=1;
  {
    foreach ($groups as $g){
      $items=$g['items'];
      $bySrc=[]; foreach ($items as $it){ $bySrc[$it['source']]=$it; }
      $rec=[
        'object_id'=>'GEO'.str_pad($idx++,6,'0',STR_PAD_LEFT),
        'canonical_name'=>'', 'main_category'=>$items[0]['category_key'], 'subcategory'=>'',
        'address'=>'','phone'=>'','website'=>'','rating'=>null,'reviews'=>null,'operating_status'=>'',
        'google_lat'=>null,'google_lng'=>null,'yandex_lat'=>null,'yandex_lng'=>null,
        'dgis_lat'=>null,'dgis_lng'=>null,'osm_lat'=>null,'osm_lng'=>null,
        'canonical_lat'=>null,'canonical_lng'=>null,
        'google_place_id'=>'','yandex_object_id'=>'','dgis_object_id'=>'','osm_id'=>'',
        'source_count'=>0,'sources'=>[], 'coordinate_accuracy'=>'','data_confidence'=>'',
        'verification_status'=>'auto_unverified','geometry_type'=>'point',
      ];
      $lats=[];$lngs=[]; $names=[];
      foreach (['google','yandex','dgis','osm'] as $s){
        if(!isset($bySrc[$s])) continue;
        $it=$bySrc[$s]; $rec['sources'][]=$s;
        $rec[$s.'_lat']=$it['lat']; $rec[$s.'_lng']=$it['lng'];
        $lats[]=$it['lat']; $lngs[]=$it['lng']; $names[]=$it['name'];
        if($s==='google') $rec['google_place_id']=$it['source_id'];
        if($s==='yandex') $rec['yandex_object_id']=$it['source_id'];
        if($s==='dgis')   $rec['dgis_object_id']=$it['source_id'];
        if($s==='osm')    $rec['osm_id']=$it['source_id'];
        foreach (['address','phone','website'] as $f){ if(empty($rec[$f]) && !empty($it[$f])) $rec[$f]=$it[$f]; }
        if($rec['rating']===null && $it['rating']!==null){ $rec['rating']=$it['rating']; $rec['reviews']=$it['reviews']; }
        if(empty($rec['subcategory']) && !empty($it['subtype'])) $rec['subcategory']=$it['subtype'];
        if($it['operating_status']==='closed') $rec['operating_status']='closed';
      }
      $rec['source_count']=count($rec['sources']);
      $rec['canonical_name']=$names[0] ?? '';
      // canonical = медиана координат источников
      $rec['canonical_lat']=median_num($lats);
      $rec['canonical_lng']=median_num($lngs);
      // расхождение = макс попарная дистанция
      $spread=null;
      for($i=0;$i<count($lats);$i++) for($k=$i+1;$k<count($lats);$k++){
        $d=haversine_m($lats[$i],$lngs[$i],$lats[$k],$lngs[$k]); if($spread===null||$d>$spread)$spread=$d;
      }
      $rec['coordinate_spread_m']=$spread!==null?round($spread,1):null;
      $rec['coordinate_accuracy']=coord_confidence($spread,$conf);
      $rec['data_confidence']=grade_record($rec);
      $records[]=$rec;
    }
  }
  return $records;
}

// ================= RUN =================
$grid=build_grid($BBOX,$GRID_KM);
if($MAXCELLS>0) $grid=array_slice($grid,0,$MAXCELLS);
$cats=$CFG['categories'];
if($ONLYCAT!=='all'){ $cats=array_values(array_filter($cats,function($c)use($ONLYCAT){return $c['key']===$ONLYCAT;})); }

$srcCfg=$CFG['sources'];
$activeSrc=[];
foreach ($WANT_SRC as $s){
  if(empty($srcCfg[$s]['enabled'])) continue;
  $need=$srcCfg[$s]['key'];
  if($need && keyOf($need)==='' && !$DRY){ logline("С${s}: пропущен — нет ключа '$need' в config.php"); continue; }
  $activeSrc[]=$s;
}

logline("Город: ".$CFG['city']['name']." · ячеек сетки: ".count($grid)." (".$GRID_KM." км) · категорий: ".count($cats)." · источники: ".implode(',', $activeSrc));
if($DRY){
  $summary=['dry_run'=>true,'city'=>$CFG['city']['name'],'grid_cells'=>count($grid),'grid_km'=>$GRID_KM,
    'categories'=>array_map(function($c){return $c['key'];},$cats),'active_sources'=>$activeSrc,
    'estimated_requests'=>[
      'osm'=>in_array('osm',$activeSrc)?count($cats):0,
      'google'=>in_array('google',$activeSrc)?count($cats)*count($grid)*3:0,
      'yandex'=>in_array('yandex',$activeSrc)?count($cats)*count($grid)*3:0,
      'dgis'=>in_array('dgis',$activeSrc)?count($cats)*count($grid)*3:0,
    ]];
  file_put_contents($OUTDIR.'/dry_run.json', json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
  logline("DRY-RUN: сеть не вызывалась. Оценка запросов записана в $OUTDIR/dry_run.json");
  echo json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),"\n";
  exit(0);
}

$allRaw=[];
foreach ($cats as $cat){
  $catRaw=[];
  // OSM — один запрос на весь bbox (эффективно)
  if(in_array('osm',$activeSrc)){
    $r=fetch_osm($cat,$BBOX,$srcCfg['osm']['endpoint']);
    $catRaw=array_merge($catRaw,$r); logline($cat['key'].": osm +".count($r));
    usleep((int)($srcCfg['osm']['rate_ms']*1000));
  }
  // Google/Yandex/2GIS — по ячейкам
  foreach ($grid as $ci=>$cell){
    if(in_array('google',$activeSrc)){ $r=fetch_google($cat,$cell,$srcCfg['google']['endpoint'],keyOf($srcCfg['google']['key']),$RADIUS); $catRaw=array_merge($catRaw,$r); usleep((int)($srcCfg['google']['rate_ms']*1000)); }
    if(in_array('yandex',$activeSrc)){ $r=fetch_yandex($cat,$cell,$srcCfg['yandex']['endpoint'],keyOf($srcCfg['yandex']['key']),$RADIUS); $catRaw=array_merge($catRaw,$r); usleep((int)($srcCfg['yandex']['rate_ms']*1000)); }
    if(in_array('dgis',$activeSrc)){ $r=fetch_dgis($cat,$cell,$srcCfg['dgis']['endpoint'],keyOf($srcCfg['dgis']['key']),$RADIUS); $catRaw=array_merge($catRaw,$r); usleep((int)($srcCfg['dgis']['rate_ms']*1000)); }
  }
  logline($cat['key'].": всего сырых ".count($catRaw));
  $allRaw=array_merge($allRaw,$catRaw);
}

$records=dedup_merge($allRaw,$DEDUP_M,$CONF);
$now=date('Y-m-d H:i:s');
foreach ($records as &$r){ $r['data_collected_at']=$now; } unset($r);

function csv_safe_value($value){
  if (is_array($value)) $value=implode('|',$value);
  $s=(string)$value;
  // Excel/Sheets may execute cells beginning with = + - @ even when quoted.
  // Preserve genuine numeric values, but force all other risky cells to text.
  if ($s!=='' && preg_match('/^[=+\-@]/u',$s) && !is_numeric($s)) $s="'".$s;
  return $s;
}

// ---------- writers ----------
function write_csv($path,$records){
  $cols=['object_id','canonical_name','main_category','subcategory','cuisine_primary','cuisine_tags','alcohol_status','alcohol_types','alcohol_verification','alcohol_source_url','address','phone','website','rating','reviews',
    'canonical_lat','canonical_lng','google_lat','google_lng','yandex_lat','yandex_lng','dgis_lat','dgis_lng','osm_lat','osm_lng',
    'google_place_id','yandex_object_id','dgis_object_id','osm_id','source_count','coordinate_spread_m','coordinate_accuracy',
    'data_confidence','operating_status','verification_status','geometry_type','data_collected_at'];
  $fh=fopen($path,'w'); fwrite($fh,"\xEF\xBB\xBF"); fputcsv($fh,$cols);
  foreach ($records as $r){ $row=[]; foreach($cols as $c){ $v=isset($r[$c])?$r[$c]:''; $row[]=csv_safe_value($v); } fputcsv($fh,$row); }
  fclose($fh);
}
function write_geojson($path,$records){
  $feat=[];
  foreach ($records as $r){ if($r['canonical_lat']===null) continue;
    $feat[]=['type'=>'Feature','geometry'=>['type'=>'Point','coordinates'=>[$r['canonical_lng'],$r['canonical_lat']]],
      'properties'=>['id'=>$r['object_id'],'name'=>$r['canonical_name'],'category'=>$r['main_category'],'subtype'=>$r['subcategory'],'cuisine_primary'=>$r['cuisine_primary']??'','cuisine_tags'=>$r['cuisine_tags']??'','alcohol_status'=>$r['alcohol_status']??'unknown',
        'sources'=>$r['sources'],'confidence'=>$r['data_confidence'],'coord_accuracy'=>$r['coordinate_accuracy'],'status'=>$r['verification_status']]];
  }
  file_put_contents($path,json_encode(['type'=>'FeatureCollection','features'=>$feat],JSON_UNESCAPED_UNICODE));
}
write_csv($OUTDIR.'/master.csv',$records);
write_geojson($OUTDIR.'/master.geojson',$records);

// отчёты
$dupes=array_values(array_filter($records,function($r){return $r['source_count']>=2;}));
$conflicts=array_values(array_filter($records,function($r){return $r['coordinate_accuracy']==='conflict';}));
$missing=[]; foreach ($records as $r){ $m=[]; foreach(['address','phone','website'] as $f){ if(empty($r[$f]))$m[]=$f; } if($m) $missing[]=['id'=>$r['object_id'],'name'=>$r['canonical_name'],'missing'=>$m]; }
$queue=array_values(array_filter($records,function($r){return in_array($r['data_confidence'],['C','D','E'])||in_array($r['coordinate_accuracy'],['review','conflict']);}));
$matrix=['by_source'=>['osm'=>0,'google'=>0,'yandex'=>0,'dgis'=>0],'by_confidence'=>['A'=>0,'B'=>0,'C'=>0,'D'=>0,'E'=>0],'by_category'=>[]];
foreach ($records as $r){ foreach($r['sources'] as $s){ if(isset($matrix['by_source'][$s]))$matrix['by_source'][$s]++; }
  $matrix['by_confidence'][$r['data_confidence']]=($matrix['by_confidence'][$r['data_confidence']]??0)+1;
  $matrix['by_category'][$r['main_category']]=($matrix['by_category'][$r['main_category']]??0)+1; }

file_put_contents($OUTDIR.'/report_multisource_matched.json',json_encode(['count'=>count($dupes),'items'=>$dupes],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
file_put_contents($OUTDIR.'/report_coordinate_conflicts.json',json_encode(['count'=>count($conflicts),'items'=>$conflicts],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
file_put_contents($OUTDIR.'/report_missing_data.json',json_encode(['count'=>count($missing),'items'=>$missing],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
file_put_contents($OUTDIR.'/report_verification_queue.json',json_encode(['count'=>count($queue),'items'=>$queue],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
file_put_contents($OUTDIR.'/report_source_matrix.json',json_encode($matrix,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));

$fin=['collected_at'=>$now,'total_objects'=>count($records),'multisource_matched'=>count($dupes),
  'coordinate_conflicts'=>count($conflicts),'need_verification'=>count($queue),'source_matrix'=>$matrix,'output_dir'=>$OUTDIR];
file_put_contents($OUTDIR.'/summary.json',json_encode($fin,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
logline("ГОТОВО: ".count($records)." объектов → $OUTDIR (master.csv, master.geojson + 5 отчётов)");
echo json_encode($fin,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),"\n";
