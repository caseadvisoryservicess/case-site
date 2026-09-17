<?php
/* v4.74.0: режим «только геоаналитика» на сервере, без базы и без сети.

   Что проверяется и почему:

     1. api/mode.php по умолчанию отдаёт geo; config.php ('platform_mode') важнее mode.php;
        значение full возвращает полную платформу.
     2. В гео-режиме фактические рабочие области любой роли (в том числе администратора)
        содержат только гео-разделы и администрирование; в полном режиме списки прежние.
     3. require_module_enabled() режет чужой раздел ответом 403 с объяснением, а гео-раздел
        пропускает. Каждый эндпоинт другого отдела вызывает эту проверку.
     4. auth.php и workspace_access.php сообщают режим клиенту; state.php ограничивает ключи
        состояния и для администратора; require_table_allowed режет таблицы до проверки admin.
     5. Синтаксис изменённых файлов проходит php -l (хостинг на PHP 8.0, код совместим с 7.2).

   Запуск: php v4740_geo_only_api.php [папка os] */
declare(strict_types=1);

$OS = rtrim($argv[1] ?? dirname(__DIR__, 3) . '/os', '/');
$bad = 0;
function ck(string $n, bool $c, string $d = null): void {
  global $bad;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' - ' . $d) . "\n";
  if (!$c) $bad++;
}
/* lib.php запускает сессию и при отказе делает exit, поэтому каждый сценарий живёт в своём процессе */
function runPhp(string $apiDir, string $code): string {
  $tmp = tempnam(sys_get_temp_dir(), 'geo_only_');
  file_put_contents($tmp, "<?php\nrequire '" . $apiDir . "/lib.php';\n" . $code);
  $out = shell_exec('php ' . escapeshellarg($tmp) . ' 2>&1');
  unlink($tmp);
  return (string)$out;
}
function apiCopy(string $OS, string $modeFile, string $configFile = null): string {
  $dir = sys_get_temp_dir() . '/geo_only_api_' . bin2hex(random_bytes(4));
  mkdir($dir);
  foreach (glob($OS . '/api/*.php') as $f) copy($f, $dir . '/' . basename($f));
  @unlink($dir . '/config.php');
  file_put_contents($dir . '/mode.php', $modeFile);
  if ($configFile !== null) file_put_contents($dir . '/config.php', $configFile);
  return $dir;
}
function rmdirAll(string $dir): void { foreach (glob($dir . '/*') as $f) unlink($f); rmdir($dir); }

$PROBE = 'echo json_encode(["mode"=>platform_mode(),"geo"=>geo_only(),"allow_geo"=>geo_only_allows("geoanalytics"),"allow_reg"=>geo_only_allows("registry"),'
  . '"admin"=>asaas_workspace_effective_views(["role_key"=>"ASH","admin"=>1],[]),"ba"=>asaas_workspace_effective_views(["role_key"=>"BA"],[]),"brj"=>asaas_workspace_effective_views(["role_key"=>"BRJ"],[])]);';

echo "--- 1. Режим из mode.php и config.php\n";
$m = require $OS . '/api/mode.php';
ck('api/mode.php по умолчанию geo', is_array($m) && ($m['mode'] ?? '') === 'geo');
$geoDir = apiCopy($OS, "<?php return ['mode' => 'geo'];");
$j = json_decode(runPhp($geoDir, $PROBE), true);
ck('lib.php читает geo из mode.php', is_array($j) && $j['mode'] === 'geo' && $j['geo'] === true, substr((string)json_encode($j), 0, 120));
ck('гео-раздел разрешён, реестр нет', $j && $j['allow_geo'] === true && $j['allow_reg'] === false);
ck('администратор в гео-режиме: только главный, гео и администрирование', $j && $j['admin'] === ['dash', 'analytics_hub', 'map', 'geoanalytics', 'users', 'admin_modules', 'admin_system'], json_encode($j['admin'] ?? null));
ck('BA: главный, наши проекты, рынок и POI; BRJ: главный и рынок', $j && $j['ba'] === ['dash', 'map', 'geoanalytics'] && $j['brj'] === ['dash', 'geoanalytics'], json_encode([$j['ba'] ?? null, $j['brj'] ?? null]));
$fullDir = apiCopy($OS, "<?php return ['mode' => 'full'];");
$f = json_decode(runPhp($fullDir, $PROBE), true);
ck('mode.php = full: полная платформа, реестр разрешён, у администратора больше 40 разделов', $f && $f['mode'] === 'full' && $f['geo'] === false && $f['allow_reg'] === true && count($f['admin']) > 40 && in_array('registry', $f['ba'], true), substr((string)json_encode($f), 0, 160));
$cfgDir = apiCopy($OS, "<?php return ['mode' => 'geo'];", "<?php return ['platform_mode' => 'full', 'driver' => 'sqlite', 'sqlite_path' => ':memory:'];");
$c = json_decode(runPhp($cfgDir, $PROBE), true);
ck('config.php (platform_mode) важнее mode.php', $c && $c['mode'] === 'full', substr((string)json_encode($c), 0, 120));
$cfgDir2 = apiCopy($OS, "<?php return ['mode' => 'full'];", "<?php return ['platform_mode' => 'geo', 'driver' => 'sqlite', 'sqlite_path' => ':memory:'];");
$c2 = json_decode(runPhp($cfgDir2, $PROBE), true);
ck('config.php может включить geo при mode.php = full', $c2 && $c2['mode'] === 'geo');

echo "--- 2. Гейт эндпоинтов\n";
$deny = runPhp($geoDir, "require_module_enabled('registry'); echo 'PASSED';");
ck('чужой раздел в гео-режиме: JSON с объяснением, а не тихий проход', strpos($deny, 'PASSED') === false && strpos($deny, 'только геоаналитика') !== false && strpos($deny, 'mode.php') !== false, substr($deny, 0, 160));
$allow = runPhp($geoDir, "require_module_enabled('geoanalytics'); require_module_enabled('users'); echo 'PASSED';");
ck('гео-раздел и администрирование проходят', strpos($allow, 'PASSED') !== false, substr($allow, 0, 120));
$allowFull = runPhp($fullDir, "require_module_enabled('registry'); echo 'PASSED';");
ck('в полном режиме реестр проходит', strpos($allowFull, 'PASSED') !== false, substr($allowFull, 0, 120));
$gated = ['brand_requests' => 'v32_requests', 'commission_tiered' => 'v326_lease', 'commissions' => 'v326_lease', 'feasibility_models' => 'feasibility', 'investor_requests' => 'v32_investors', 'lease_commissions' => 'v326_lease', 'market_data' => 'market_data', 'partners' => 'v32_partners', 'sales' => 'v32_sales', 'supplier_commissions' => 'v326_suppliers', 'unit_patch' => 'registry', 'units_batch' => 'registry', 'cron_critical_dates' => 'dates', 'project_files' => 'project_layouts', 'provenance' => 'data_quality'];
$missing = [];
foreach ($gated as $file => $view) {
  $src = (string)file_get_contents($OS . '/api/' . $file . '.php');
  if (strpos($src, "require_module_enabled('" . $view . "')") === false) $missing[] = $file;
}
ck('все 15 эндпоинтов других отделов вызывают гейт своего раздела', !$missing, $missing ? implode(', ', $missing) : 'все на месте');
$geoFiles = ['geo_state', 'geo_master', 'gis_proxy', 'auth', 'users', 'state', 'workspace_access', 'user_prefs', 'backup', 'llm', 'geo_collector', 'health', 'diag'];
$wrong = [];
foreach ($geoFiles as $file) { $p = $OS . '/api/' . $file . '.php'; if (is_file($p) && strpos((string)file_get_contents($p), 'require_module_enabled(') !== false) $wrong[] = $file; }
ck('гео-эндпоинты, вход, доступ и состояние гейтом не закрыты', !$wrong, $wrong ? implode(', ', $wrong) : 'верно');

echo "--- 3. Режим в ответах и ограничение состояния\n";
$auth = (string)file_get_contents($OS . '/api/auth.php');
ck('auth.php сообщает режим при входе, по коду и при проверке сессии, и на экране входа', substr_count($auth, "'mode'=>platform_mode()") === 4, (string)substr_count($auth, "'mode'=>platform_mode()"));
ck('workspace_access.php сообщает режим', strpos((string)file_get_contents($OS . '/api/workspace_access.php'), "'mode'=>platform_mode()") !== false);
$state = (string)file_get_contents($OS . '/api/state.php');
ck('state.php: в гео-режиме ключи ограничены и для администратора (чтение и запись)', preg_match('/function role_allowed_state_keys[^{]*\{\s*if \(geo_only\(\)\) return geo_only_state_keys\(\$u, \$oldData, true\);/', $state) === 1 && preg_match('/function role_visible_state_keys[^{]*\{\s*if \(geo_only\(\)\) return geo_only_state_keys\(\$u, \$state, false\);/', $state) === 1);
$lib = (string)file_get_contents($OS . '/api/lib.php');
$posGate = strpos($lib, "if (\$views && geo_only())"); $posAdmin = strpos($lib, "if (!empty(\$u['admin'])) return;\n  if (!\$views) return;");
ck('require_table_allowed: гео-гейт стоит до обхода для администратора', $posGate !== false && $posAdmin !== false && $posGate < $posAdmin);
$tmpState = tempnam(sys_get_temp_dir(), 'geo_state_');
file_put_contents($tmpState, "<?php\nrequire '" . $geoDir . "/state.php';");
$keys = (string)shell_exec('php ' . escapeshellarg($tmpState) . ' 2>&1'); unlink($tmpState);
ck('state.php без сессии отвечает «не авторизован», а не падает', strpos($keys, 'Не авторизован') !== false && stripos($keys, 'fatal') === false, substr($keys, 0, 120));

echo "--- 4. Синтаксис\n";
$lintBad = [];
foreach (array_merge(array_keys($gated), ['lib', 'auth', 'state', 'workspace_access', 'mode']) as $file) {
  $out = shell_exec('php -l ' . escapeshellarg($OS . '/api/' . $file . '.php') . ' 2>&1');
  if (strpos((string)$out, 'No syntax errors') === false) $lintBad[] = $file;
}
ck('php -l на изменённых файлах чист', !$lintBad, $lintBad ? implode(', ', $lintBad) : 'чисто');
$added = substr($lib, (int)strpos($lib, 'v4.74.0: режим платформы'), 2200) . substr($state, (int)strpos($state, 'v4.74.0: в режиме'), 1400);
ck('в новых серверных фрагментах и mode.php нет длинного тире', !preg_match('/[' . "\u{2014}\u{2013}" . ']/u', (string)file_get_contents($OS . '/api/mode.php') . $added));

foreach ([$geoDir, $fullDir, $cfgDir, $cfgDir2] as $d) rmdirAll($d);
echo $bad ? "\nПРОВАЛЕНО: $bad\n" : "\nСервер в режиме «только геоаналитика» ведёт себя верно\n";
exit($bad ? 1 : 0);
