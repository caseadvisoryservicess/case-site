<?php
/*
 * CASE OS — geo_seed_convert.php
 * Переводит УЖЕ ИМЕЮЩИЕСЯ реальные данные (мастер-БЦ, махалли с координатами, медицина, аптеки)
 * в единый мульти-source master-формат коллектора — как честный «первый срез» базы.
 * Данные НЕ выдумываются: берутся из ваших файлов, каждая запись помечается своим источником и
 * статусом «нужна проверка» (single-source ⇒ confidence C), чтобы админ видел очередь на верификацию.
 *
 *   php api/geo_seed_convert.php               # → data/geo_collect_out/seed_master.csv + .geojson + summary
 * PHP 7.4-совместимо.
 */
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $encoding=null) { return strtolower((string)$s); } }
function cli_arg($name,$default=null){ global $argv; foreach((array)$argv as $a){ if(strpos($a,'--'.$name.'=')===0)return substr($a,strlen($name)+3); } return $default; }
$ROOT=dirname(__DIR__);
$OUTARG=cli_arg('out','data/geo_collect_out');
$OUT=(strpos($OUTARG,'/')===0)?$OUTARG:$ROOT.'/'.$OUTARG; @mkdir($OUT,0775,true);
$now=date('Y-m-d H:i:s');

function provider_source($p){
  $p=mb_strtolower(trim((string)$p),'UTF-8');
  if(strpos($p,'2gis')!==false||strpos($p,'2 gis')!==false) return 'dgis';
  if(strpos($p,'google')!==false) return 'google';
  if(strpos($p,'yandex')!==false||strpos($p,'яндекс')!==false) return 'yandex';
  if(strpos($p,'osm')!==false||strpos($p,'openstreetmap')!==false) return 'osm';
  return ''; // GoldenPages, clinics.uz, stat.uz и т.п. — канонический источник без per-source колонки
}
$idx=1; $records=[];
function mk($name,$cat,$lat,$lng,$provider,$extra=[]){
  global $idx,$now;
  if(!is_numeric($lat)||!is_numeric($lng)) return null;
  $lat=(float)$lat; $lng=(float)$lng;
  if(!is_finite($lat)||!is_finite($lng)||$lat<-90||$lat>90||$lng<-180||$lng>180||($lat==0.0&&$lng==0.0)) return null;
  $src=provider_source($provider);
  $rec=[
    'object_id'=>'SEED'.str_pad($idx++,6,'0',STR_PAD_LEFT),
    'canonical_name'=>(string)$name,'main_category'=>$cat,'subcategory'=>$extra['subcategory']??'',
    'address'=>$extra['address']??'','phone'=>$extra['phone']??'','website'=>$extra['website']??'',
    'rating'=>$extra['rating']??null,'reviews'=>$extra['reviews']??null,
    'canonical_lat'=>round($lat,6),'canonical_lng'=>round($lng,6),
    'google_lat'=>null,'google_lng'=>null,'yandex_lat'=>null,'yandex_lng'=>null,'dgis_lat'=>null,'dgis_lng'=>null,'osm_lat'=>null,'osm_lng'=>null,
    'google_place_id'=>'','yandex_object_id'=>'','dgis_object_id'=>'','osm_id'=>'',
    'primary_source'=>(string)$provider,'source_url'=>$extra['source_url']??'',
    'source_count'=>1,'sources'=>$src?[$src]:[strtolower((string)$provider)],
    'coordinate_spread_m'=>null,'coordinate_accuracy'=>'single','data_confidence'=>'C',
    'operating_status'=>'','verification_status'=>$extra['verification_status']??'auto_unverified',
    'geometry_type'=>'point','district'=>$extra['district']??'','admin_comment'=>$extra['admin_comment']??'','data_collected_at'=>$now,
  ];
  if($src){ $rec[$src.'_lat']=$rec['canonical_lat']; $rec[$src.'_lng']=$rec['canonical_lng']; if($src==='dgis'&&!empty($extra['providerId']))$rec['dgis_object_id']=$extra['providerId']; }
  return $rec;
}

// 1) БЦ мастер (CSV)
$bcCsv=$ROOT.'/../import-data/CASE_BC_master_2GISGoldenPages_2026.csv';
if(!is_file($bcCsv)) $bcCsv=$ROOT.'/../import-data/ASAAS_BC_master_2GISGoldenPages_2026.csv'; // legacy import compatibility
$bc=0;
if(is_file($bcCsv)){
  $fh=fopen($bcCsv,'r'); $head=fgetcsv($fh); if($head){$head[0]=preg_replace('/^\xEF\xBB\xBF/','',$head[0]);}
  while(($row=fgetcsv($fh))!==false){
    $r=array_combine($head,$row); if(!$r) continue;
    $rec=mk($r['name']??'','business_center',$r['lat']??'',$r['lng']??'',$r['provider']??'',[
      'address'=>$r['address']??'','district'=>$r['district']??'','rating'=>$r['rating']??null,'reviews'=>$r['reviews']??null,
      'source_url'=>$r['source_url']??'','providerId'=>$r['providerId']??'','subcategory'=>$r['class']??'',
      'admin_comment'=>trim(('class='.($r['class']??'').' rent='.($r['rent']??'').' '.($r['comment']??''))),
    ]);
    if($rec){$records[]=$rec;$bc++;}
  }
  fclose($fh);
}

// 2) Махалли (JSON, только с координатами)
$mahPath=$ROOT.'/data/mahallas_tashkent.json'; $mah=0;
if(is_file($mahPath)){
  $m=json_decode(file_get_contents($mahPath),true); $arr=is_array($m)?(isset($m[0])?$m:($m['records']??$m['mahallas']??[])):[];
  foreach ($arr as $x){
    $rec=mk($x['name']??'','mahallas',$x['lat']??'',$x['lng']??'',$x['provider']??'GoldenPages',[
      'address'=>$x['address']??'','district'=>$x['district']??'','source_url'=>$x['sourceUrl']??'','subcategory'=>$x['subtype']??'',
      'verification_status'=>(($x['_verification']??'')==='online')?'auto_online':'auto_unverified',
    ]);
    if($rec){$records[]=$rec;$mah++;}
  }
}

// 3) Медицина + аптеки (bundle)
$bundlePath=$ROOT.'/data/bundle_tashkent_realdata.json'; $med=0;$ph=0;
if(is_file($bundlePath)){
  $b=json_decode(file_get_contents($bundlePath),true);
  foreach (($b['med']??[]) as $x){
    $provider=$x['s']??'OSM/clinics.uz';
    $rec=mk($x['n']??'','medicine',$x['la']??'',$x['ln']??'',$provider,[
      'subcategory'=>$x['t']??'','address'=>$x['a']??'','phone'=>$x['p']??'',
      'website'=>$x['w']??'','rating'=>$x['rating']??null,'reviews'=>$x['reviews']??null
    ]);
    if($rec){$records[]=$rec;$med++;}
  }
  foreach (($b['pharm']??[]) as $x){
    $lat=is_array($x)?($x[0]??null):($x['la']??null); $lng=is_array($x)?($x[1]??null):($x['ln']??null);
    $rec=mk('','pharmacy',$lat,$lng,'OSM',['admin_comment'=>'координаты без названия — уточнить']);
    if($rec){$records[]=$rec;$ph++;}
  }
}

function csv_safe_value($value){
  if (is_array($value)) $value=implode('|',$value);
  $s=(string)$value;
  // Excel/Sheets may execute cells beginning with = + - @ even when quoted.
  // Preserve genuine numeric values, but force all other risky cells to text.
  if ($s!=='' && preg_match('/^[=+\-@]/u',$s) && !is_numeric($s)) $s="'".$s;
  return $s;
}

// writers (те же колонки, что и у коллектора)
$cols=['object_id','canonical_name','main_category','subcategory','cuisine_primary','cuisine_tags','alcohol_status','alcohol_types','alcohol_verification','alcohol_source_url','district','address','phone','website','rating','reviews',
  'canonical_lat','canonical_lng','google_lat','google_lng','yandex_lat','yandex_lng','dgis_lat','dgis_lng','osm_lat','osm_lng',
  'google_place_id','yandex_object_id','dgis_object_id','osm_id','primary_source','source_url','source_count','coordinate_accuracy',
  'data_confidence','operating_status','verification_status','geometry_type','admin_comment','data_collected_at'];
$fh=fopen($OUT.'/seed_master.csv','w'); fwrite($fh,"\xEF\xBB\xBF"); fputcsv($fh,$cols);
foreach ($records as $r){ $row=[]; foreach($cols as $c){ $v=isset($r[$c])?$r[$c]:''; $row[]=csv_safe_value($v); } fputcsv($fh,$row); }
fclose($fh);
$feat=[];
foreach ($records as $r){ $feat[]=['type'=>'Feature','geometry'=>['type'=>'Point','coordinates'=>[$r['canonical_lng'],$r['canonical_lat']]],
  'properties'=>['id'=>$r['object_id'],'name'=>$r['canonical_name'],'category'=>$r['main_category'],'source'=>$r['primary_source'],'confidence'=>$r['data_confidence'],'status'=>$r['verification_status']]]; }
file_put_contents($OUT.'/seed_master.geojson',json_encode(['type'=>'FeatureCollection','features'=>$feat],JSON_UNESCAPED_UNICODE));

$byCat=[]; foreach($records as $r){$byCat[$r['main_category']]=($byCat[$r['main_category']]??0)+1;}
$summary=['converted_at'=>$now,'total'=>count($records),'by_source_file'=>['business_center'=>$bc,'mahallas'=>$mah,'medicine'=>$med,'pharmacy'=>$ph],
  'by_category'=>$byCat,'note'=>'Все записи — реальные, из ваших файлов; single-source ⇒ confidence C ⇒ очередь на ручную проверку/кросс-матч с Google/Яндекс/2GIS.','output'=>$OUTARG];
file_put_contents($OUT.'/seed_summary.json',json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
echo json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),"\n";
