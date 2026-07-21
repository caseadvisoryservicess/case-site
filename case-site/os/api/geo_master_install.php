<?php
// CASE OS v4.8.1 — safe CLI installer/updater for the integrated Tashkent geo master.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI only\n"); }
require __DIR__.'/lib.php';

function has_arg(string $name): bool { global $argv; return in_array('--'.$name, (array)$argv, true); }
function record_master_key(array $row): string {
  foreach (['master_id','seed_object_id'] as $key) {
    $v = trim((string)($row[$key] ?? ''));
    if ($v !== '') return $key.':'.$v;
  }
  return '';
}
function record_is_manual(array $row): bool {
  if (trim((string)($row['_updatedAt'] ?? '')) !== '' || trim((string)($row['_updatedBy'] ?? '')) !== '') return true;
  if (trim((string)($row['_checkedAt'] ?? '')) !== '' || trim((string)($row['_checkedBy'] ?? '')) !== '') return true;
  if ((string)($row['_verification'] ?? '') === 'verified') return true;
  $provider = strtolower(trim((string)($row['provider'] ?? ($row['s'] ?? ''))));
  if (strpos($provider, 'case manual') !== false || strpos($provider, 'ручн') !== false) return true;
  // A record without a master/seed id was created by a user or another live source and
  // must never disappear merely because a bundled baseline is updated.
  return record_master_key($row) === '';
}
function validate_dataset(string $name, array $rows): void {
  $seen = [];
  foreach ($rows as $i=>$row) {
    if (!is_array($row)) throw new RuntimeException("Dataset $name row $i is not an object");
    $key = record_master_key($row);
    if ($key !== '') {
      if (isset($seen[$key])) throw new RuntimeException("Duplicate master key in $name: $key");
      $seen[$key] = true;
    }
    $latKey = $name === 'medicine' ? 'la' : 'lat';
    $lngKey = $name === 'medicine' ? 'ln' : 'lng';
    $lat = $row[$latKey] ?? null; $lng = $row[$lngKey] ?? null;
    if (!is_numeric($lat) || !is_numeric($lng)) throw new RuntimeException("Invalid coordinates in $name row $i");
    $lat = (float)$lat; $lng = (float)$lng;
    if (($lat === 0.0 && $lng === 0.0) || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
      throw new RuntimeException("Out-of-range coordinates in $name row $i");
    }
  }
}
function merge_dataset(array $baseline, array $existing, string $name, array &$stats): array {
  $oldByKey = [];
  foreach ($existing as $i=>$row) {
    if (!is_array($row)) continue;
    $key = record_master_key($row);
    if ($key !== '' && !isset($oldByKey[$key])) $oldByKey[$key] = ['index'=>$i,'row'=>$row];
  }
  $used = [];
  $out = [];
  foreach ($baseline as $base) {
    $key = record_master_key($base);
    if ($key !== '' && isset($oldByKey[$key])) {
      $old = $oldByKey[$key]['row'];
      $used[$oldByKey[$key]['index']] = true;
      if (record_is_manual($old)) {
        // New fields from baseline are added, but every saved/manual value wins.
        $merged = array_replace($base, $old);
        $stats['manual_preserved']++;
      } else {
        // Untouched preloaded row receives corrected baseline values while keeping
        // unknown extension fields that are not present in the new package.
        $merged = array_replace($old, $base);
        $stats['baseline_refreshed']++;
      }
      $merged['_masterBaselineVersion'] = '4.8.1';
      $out[] = $merged;
    } else {
      $base['_masterBaselineVersion'] = '4.8.1';
      $out[] = $base;
      $stats['baseline_added']++;
    }
  }
  foreach ($existing as $i=>$old) {
    if (!is_array($old) || isset($used[$i])) continue;
    $key = record_master_key($old);
    if ($key !== '' && !record_is_manual($old)) {
      // The record disappeared from the newer baseline. Do not delete it silently:
      // preserve it and place it into review so an administrator decides its fate.
      $old['_masterRetired'] = true;
      $old['_verification'] = 'needs_review';
      $note = trim((string)($old['_note'] ?? ''));
      $old['_note'] = trim($note.' | Не найдено в мастер-базе v4.8.1; проверить актуальность перед удалением.', ' |');
      $stats['retired_preserved']++;
    } else {
      $stats['custom_preserved']++;
    }
    $out[] = $old;
  }
  $stats['datasets'][$name] = ['baseline'=>count($baseline),'existing'=>count($existing),'result'=>count($out)];
  return array_values($out);
}
function merge_geo_data(array $baselineGeo, array $existingGeo, array &$stats): array {
  $result = $existingGeo;
  $result['version'] = 2;
  $result['status'] = 'master_merged';
  $result['updatedAt'] = date('c');
  $result['updatedBy'] = 'CASE OS v4.8.1 installer';
  $result['projects'] = isset($existingGeo['projects']) && is_array($existingGeo['projects']) ? $existingGeo['projects'] : [];
  $oldSets = isset($existingGeo['datasets']) && is_array($existingGeo['datasets']) ? $existingGeo['datasets'] : [];
  $newSets = $baselineGeo['datasets'];
  $sets = $oldSets; // preserves every non-master dataset (parks, hotels, user layers, etc.)
  foreach (['bc','medicine','pharmacies','mahallas','restaurants','cafes'] as $name) {
    $sets[$name] = merge_dataset((array)($newSets[$name] ?? []), (array)($oldSets[$name] ?? []), $name, $stats);
  }
  $result['datasets'] = $sets;
  $oldMeta = isset($existingGeo['meta']) && is_array($existingGeo['meta']) ? $existingGeo['meta'] : [];
  $result['meta'] = array_replace_recursive($baselineGeo['meta'], $oldMeta);
  $result['meta']['status'] = 'master_merged';
  $result['meta']['updatedAt'] = date('c');
  $result['meta']['updatedBy'] = 'CASE OS v4.8.1 installer';
  $result['meta']['master'] = $baselineGeo['meta']['master'];
  $result['meta']['merge'] = $stats;
  return $result;
}
function secure_backup(string $dir, string $content): string {
  if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('Cannot create backup directory');
  @chmod($dir, 0700);
  $stamp = gmdate('Ymd_His').'_'.bin2hex(random_bytes(4));
  $final = $dir.'/app_state_before_geo_'.$stamp.'.json';
  $temp = $final.'.tmp';
  $bytes = file_put_contents($temp, $content, LOCK_EX);
  if ($bytes === false || $bytes !== strlen($content)) { @unlink($temp); throw new RuntimeException('Backup write failed'); }
  @chmod($temp, 0600);
  if (hash_file('sha256', $temp) !== hash('sha256', $content)) { @unlink($temp); throw new RuntimeException('Backup verification failed'); }
  if (!rename($temp, $final)) { @unlink($temp); throw new RuntimeException('Backup finalization failed'); }
  return $final;
}
function run_self_test(): void {
  $base = ['datasets'=>['bc'=>[
    ['master_id'=>'A','name'=>'Baseline corrected','address'=>'New'],
    ['master_id'=>'B','name'=>'Added']
  ],'medicine'=>[],'pharmacies'=>[],'mahallas'=>[],'restaurants'=>[
    ['master_id'=>'F1','name'=>'Restaurant','cuisinePrimary'=>'Unknown','alcoholStatus'=>'unknown','alcoholVerification'=>'not_checked']
  ],'cafes'=>[]], 'meta'=>['master'=>['version'=>'4.8.1']]];
  $old = ['projects'=>[['id'=>'P1','name'=>'User project']],'datasets'=>['bc'=>[
    ['master_id'=>'A','name'=>'Manual name','address'=>'Old','_updatedAt'=>'2026-07-19T00:00:00Z'],
    ['name'=>'User-created','provider'=>'CASE manual'],
    ['master_id'=>'OLD','name'=>'Old baseline']
  ],'restaurants'=>[
    ['master_id'=>'F1','name'=>'Restaurant','cuisinePrimary'=>'Italian','alcoholStatus'=>'yes','alcoholTypes'=>'wine','alcoholVerification'=>'phone','_updatedAt'=>'2026-07-19T01:00:00Z']
  ],'parks'=>[['name'=>'Custom park']]],'meta'=>['custom'=>'keep']];
  $stats=['manual_preserved'=>0,'baseline_refreshed'=>0,'baseline_added'=>0,'retired_preserved'=>0,'custom_preserved'=>0,'datasets'=>[]];
  $out = merge_geo_data($base,$old,$stats);
  $bc = $out['datasets']['bc'];
  $fnb = $out['datasets']['restaurants'][0] ?? [];
  $ok = count($bc)===4 && $bc[0]['name']==='Manual name' && $bc[0]['address']==='Old'
    && $bc[1]['name']==='Added' && $bc[2]['name']==='User-created' && !empty($bc[3]['_masterRetired'])
    && ($fnb['cuisinePrimary'] ?? '')==='Italian' && ($fnb['alcoholStatus'] ?? '')==='yes'
    && ($fnb['alcoholVerification'] ?? '')==='phone'
    && count($out['projects'])===1 && count($out['datasets']['parks'])===1;
  if (!$ok) { fwrite(STDERR,"Merge self-test failed\n"); exit(10); }
  echo "Merge self-test PASS\n";
  exit(0);
}

if (has_arg('self-test')) run_self_test();
$apply = has_arg('apply');
$force = has_arg('force');
$replaceAll = has_arg('replace-all');
if ($replaceAll && !$force) { fwrite(STDERR,"--replace-all requires --force\n"); exit(2); }

$runtimePath = dirname(__DIR__).'/data/geo_master/runtime.json';
if (!is_file($runtimePath)) { fwrite(STDERR,"Missing $runtimePath\n"); exit(2); }
$runtime = json_decode((string)file_get_contents($runtimePath), true);
$required = ['meta','bc','medicine','pharmacies','mahallas','restaurants','cafes'];
if (!is_array($runtime)) { fwrite(STDERR,"Invalid runtime.json\n"); exit(2); }
foreach ($required as $key) if (!isset($runtime[$key]) || ($key !== 'meta' && !is_array($runtime[$key]))) { fwrite(STDERR,"Invalid runtime.json: missing $key\n"); exit(2); }
try {
  foreach (['bc','medicine','pharmacies','mahallas','restaurants','cafes'] as $name) validate_dataset($name, $runtime[$name]);
} catch (Throwable $e) { fwrite(STDERR,$e->getMessage()."\n"); exit(2); }

$geo = [
  'version'=>2,'status'=>'preloaded_master','updatedAt'=>date('c'),'updatedBy'=>'CASE OS v4.8.1 installer',
  'projects'=>[],
  'datasets'=>['bc'=>$runtime['bc'],'medicine'=>$runtime['medicine'],'pharmacies'=>$runtime['pharmacies'],
    'mahallas'=>$runtime['mahallas'],'restaurants'=>$runtime['restaurants'],'cafes'=>$runtime['cafes']],
  'meta'=>['status'=>'preloaded_master','updatedAt'=>date('c'),'updatedBy'=>'CASE OS v4.8.1 installer','master'=>$runtime['meta']]
];
$summary = ['objects'=>(int)($runtime['meta']['records']??0),'business_centers'=>count($runtime['bc']),
  'medicine'=>count($runtime['medicine']),'pharmacies'=>count($runtime['pharmacies']),'mahallas'=>count($runtime['mahallas']),
  'restaurants'=>count($runtime['restaurants']),'cafes'=>count($runtime['cafes']),
  'apply'=>$apply,'force'=>$force,'mode'=>$replaceAll?'replace_all':'safe_merge'];
if (!$apply) {
  echo json_encode($summary, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),"\n";
  echo "Dry run only. Existing GEO_DATA is preserved unless --apply --force is used. --force performs a safe merge; destructive replacement additionally requires --replace-all.\n";
  exit(0);
}

$backupDir = dirname(__DIR__).'/data/geo_master/backups';
if (!is_dir($backupDir) && !mkdir($backupDir,0700,true) && !is_dir($backupDir)) { fwrite(STDERR,"Cannot create backup directory\n"); exit(3); }
$lockPath = $backupDir.'/.install.lock';
$lock = fopen($lockPath, 'c');
if (!$lock || !flock($lock, LOCK_EX|LOCK_NB)) { fwrite(STDERR,"Another geo installer is already running.\n"); exit(3); }

$pdo = db();
try { $pdo->query('SELECT revision FROM app_state LIMIT 1'); }
catch (Throwable $e) { flock($lock,LOCK_UN); fclose($lock); fwrite(STDERR,"app_state is missing. Run migrations first.\n"); exit(3); }

$backupPath = null;
try {
  $pdo->beginTransaction();
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $st = $pdo->query($driver === 'sqlite' ? 'SELECT data,revision FROM app_state WHERE id=1' : 'SELECT data,revision FROM app_state WHERE id=1 FOR UPDATE');
  $row = $st->fetch();
  $state = ($row && $row['data']) ? json_decode($row['data'], true) : [];
  if (!is_array($state)) throw new RuntimeException('Current app_state JSON is invalid');
  $hasGeo = isset($state['GEO_DATA']) && is_array($state['GEO_DATA']);
  if ($hasGeo && !$force) throw new RuntimeException('GEO_DATA already exists. Nothing changed. Re-run with --apply --force for a safe merge.');
  if ($row && $row['data']) $backupPath = secure_backup($backupDir, (string)$row['data']);

  $mergeStats = ['manual_preserved'=>0,'baseline_refreshed'=>0,'baseline_added'=>0,
    'retired_preserved'=>0,'custom_preserved'=>0,'datasets'=>[]];
  if ($hasGeo && !$replaceAll) $state['GEO_DATA'] = merge_geo_data($geo, $state['GEO_DATA'], $mergeStats);
  else $state['GEO_DATA'] = $geo;

  $json = json_encode($state, JSON_UNESCAPED_UNICODE);
  if ($json === false || strlen($json) > json_body_limit_bytes()) throw new RuntimeException('Final app_state is invalid or exceeds the safe limit');
  $now = date('Y-m-d H:i:s');
  $by = 'CASE OS v4.8.1 installer'.($replaceAll?' (replace-all)':' (safe merge)');
  if ($row) {
    $rev = (int)($row['revision'] ?? 0)+1;
    $pdo->prepare('UPDATE app_state SET data=?,updated_at=?,updated_by=?,revision=? WHERE id=1')->execute([$json,$now,$by,$rev]);
  } else {
    $rev = 1;
    $pdo->prepare('INSERT INTO app_state (id,data,updated_at,updated_by,revision) VALUES (1,?,?,?,?)')->execute([$json,$now,$by,$rev]);
  }
  $pdo->commit();
  $summary['revision']=$rev; $summary['bytes']=strlen($json); $summary['backup']=$backupPath; $summary['merge']=$mergeStats;
  echo json_encode($summary,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE),"\nInstalled successfully.\n";
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  fwrite(STDERR,$e->getMessage()."\n");
  flock($lock,LOCK_UN); fclose($lock);
  exit($e->getMessage()[0]==='G' ? 4 : 5);
}
flock($lock,LOCK_UN); fclose($lock);
