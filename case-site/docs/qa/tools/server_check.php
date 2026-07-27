<?php
/* CASE OS — глубокая диагностика боевого сервера.

   ЗАПУСК (в терминале DirectAdmin, из папки os/):
       php server_check.php                 — показать на экране
       php server_check.php > check.txt     — сохранить в файл

   БЕЗОПАСНОСТЬ:
   • Скрипт ТОЛЬКО ЧИТАЕТ. Он ничего не меняет, не удаляет и не пишет в базу.
   • Пароли, ключи и содержимое config.php НЕ выводятся — печатается только «задан / не задан».
   • Запуск через браузер заблокирован: работает исключительно из терминала.
   • Вывод можно пересылать целиком — секретов в нём нет.

   ЧТО ПРОВЕРЯЕТ: полноту заливки файлов и версии всех модулей, окружение PHP, состояние базы,
   права сотрудников, объёмы данных, историю геоданных и историю правок в помещениях —
   по последним двум видно, когда и под чьей учётной записью записи пропадали. */

if (PHP_SAPI !== 'cli') {
  header('Content-Type: text/plain; charset=utf-8', true, 403);
  echo "Диагностика запускается только из терминала: php server_check.php\n";
  exit;
}

@ini_set('memory_limit', '512M');
@ini_set('display_errors', '1');

/* ---- где лежит платформа ---- */
$OS = __DIR__;
if (!is_file($OS . '/index.html')) {
  foreach ([getcwd(), getcwd() . '/os', __DIR__ . '/../../../os', __DIR__ . '/../../os',
            dirname(__DIR__) . '/os', __DIR__ . '/../os'] as $try) {
    if (@is_file($try . '/index.html')) { $OS = realpath($try); break; }
  }
}

function hr($t = '') {
  echo "\n" . str_repeat('=', 76) . "\n";
  if ($t !== '') echo "  $t\n" . str_repeat('=', 76) . "\n";
}
function ok($b)    { return $b ? 'OK  ' : '!!  '; }
function human($n) { $u = ['Б','КБ','МБ','ГБ']; $i = 0; $n = (float)$n;
                     while ($n >= 1024 && $i < 3) { $n /= 1024; $i++; }
                     return round($n, 1) . ' ' . $u[$i]; }
function cut($s, $n) { $s = (string)$s; return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n); }
/* printf('%-20s') считает БАЙТЫ, поэтому кириллица разъезжает по столбцам.
   p() обрезает и добивает пробелами по числу СИМВОЛОВ — колонки стоят ровно. */
function p($s, $n, $right = false) {
  $s   = cut($s, $n);
  $len = function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
  $pad = str_repeat(' ', max(0, $n - $len));
  return $right ? $pad . $s : $s . $pad;
}

echo "CASE OS — ДИАГНОСТИКА СЕРВЕРА\n";
echo 'дата: ' . date('Y-m-d H:i:s') . "\n";
echo "папка платформы: $OS\n";

/* ============ 1. ФАЙЛЫ И ВЕРСИИ — ловит неполную заливку ============ */
hr('1. ФАЙЛЫ И ВЕРСИИ');
$idx = @file_get_contents($OS . '/index.html');
if ($idx === false) {
  echo "!!  index.html НЕ НАЙДЕН — в этой папке платформа не установлена.\n";
  echo "    Перейдите в папку os вашего сайта и запустите скрипт оттуда.\n";
} else {
  preg_match("/const APP_VERSION\s*=\s*'([^']+)'/", $idx, $m);
  $appv = $m[1] ?? '?';
  echo "версия платформы (index.html): $appv\n";
  echo '  index.html: ' . human(strlen($idx)) . ', изменён ' . date('Y-m-d H:i', filemtime($OS . '/index.html')) . "\n";

  $core = $OS . '/core.js';
  echo ok(is_file($core)) . 'core.js: ' . (is_file($core)
      ? human(filesize($core)) . ', изменён ' . date('Y-m-d H:i', filemtime($core))
      : 'ОТСУТСТВУЕТ — сайт не откроется! Залейте папку os целиком') . "\n";

  $sw = @file_get_contents($OS . '/sw.js');
  if ($sw !== false) {
    preg_match("/CACHE\s*=\s*'([^']+)'/", $sw, $m2);
    $cache = $m2[1] ?? '?';
    $want  = 'case-os-v' . str_replace('.', '', $appv);
    echo ok($cache === $want) . "кэш sw.js: $cache"
       . ($cache === $want ? '' : "  (ожидался $want — sw.js от прошлой версии)") . "\n";
  } else echo "!!  sw.js не найден\n";

  /* ---- сверка версий модулей: главный индикатор частичной заливки ---- */
  echo "\nВЕРСИИ МОДУЛЕЙ (что ждёт index.html — что лежит в файлах):\n";
  if (preg_match('/CASE_EXPECTED_MODULES\s*=\s*\{([^}]*)\}/', $idx, $mm)) {
    preg_match_all("/'([^']+)'\s*:\s*'([^']+)'/", $mm[1], $pairs, PREG_SET_ORDER);
    $bad = 0;
    foreach ($pairs as $p) {
      $name = $p[1]; $want = $p[2];
      $file = $OS . '/' . ($name === 'core' ? 'core.js' : $name . '.js');
      if (!is_file($file)) $have = 'ФАЙЛ ОТСУТСТВУЕТ';
      else {
        $t = @file_get_contents($file);
        $have = preg_match("/CASE_MODULE_VERSIONS\['" . preg_quote($name, '/') . "'\]\s*=\s*'([^']+)'/", $t, $v)
              ? $v[1] : 'без метки версии';
      }
      $good = ($have === $want);
      if (!$good) $bad++;
      echo '  ' . ok($good) . p($name, 24) . ' ждём ' . p($want, 10) . ' факт ' . $have . "\n";
    }
    echo $bad
      ? "  !!  РАСХОЖДЕНИЙ: $bad. Заливка неполная — перезалейте папку os ЦЕЛИКОМ с перезаписью.\n"
      : "  Все модули совпадают — заливка полная.\n";
  } else echo "  (карта версий не найдена — платформа старше 4.46.4)\n";

  /* ---- контрольные суммы: ловит повреждённые и подменённые файлы ---- */
  $sums = glob($OS . '/SHA256SUMS_v*.txt');
  if ($sums) {
    /* берём файл сумм именно для установленной версии, иначе — самый свежий */
    natsort($sums); $f = end($sums);
    foreach ($sums as $s0) if (basename($s0) === 'SHA256SUMS_v' . $appv . '.txt') { $f = $s0; break; }
    echo "\nКОНТРОЛЬНЫЕ СУММЫ (" . basename($f) . "):\n";
    $lines = @file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $miss = 0; $diff = 0; $okn = 0; $ex = [];
    foreach ($lines as $ln) {
      if (!preg_match('/^([0-9a-f]{64})\s+\*?(.+)$/', trim($ln), $s)) continue;
      $rel  = preg_replace('#^\./#', '', preg_replace('#^os/#', '', $s[2]));
      $path = $OS . '/' . $rel;
      if (!is_file($path))                          { $miss++; if (count($ex) < 10) $ex[] = "отсутствует: $rel"; }
      elseif (hash_file('sha256', $path) !== $s[1]) { $diff++; if (count($ex) < 10) $ex[] = "изменён:     $rel"; }
      else                                            $okn++;
    }
    echo "  совпало: $okn | отличается: $diff | отсутствует: $miss\n";
    foreach ($ex as $e) echo "    - $e\n";
    if ($diff + $miss === 0) echo "  Все файлы на месте и не повреждены.\n";
  }

  /* ---- серверная часть ---- */
  echo "\nФАЙЛЫ API:\n";
  $need = ['api/lib.php','api/state.php','api/auth.php','api/unit_patch.php','api/geo_state.php',
           'api/user_prefs.php','api/users.php','api/data.php','api/health.php'];
  $lost = 0;
  foreach ($need as $n) if (!is_file($OS . '/' . $n)) { echo "  !!  нет $n\n"; $lost++; }
  echo $lost ? "  !!  Отсутствует файлов: $lost — часть функций не работает.\n"
             : "  Все ключевые файлы API на месте.\n";
}

/* ============ 2. ОКРУЖЕНИЕ PHP ============ */
hr('2. ОКРУЖЕНИЕ PHP');
echo 'PHP: ' . PHP_VERSION . ' (' . PHP_OS . ")\n";
if (version_compare(PHP_VERSION, '8.0', '<')) echo "!!  Нужен PHP 8.0 и новее\n";
foreach (['pdo_mysql','pdo_sqlite','json','mbstring','zip','gd','curl','openssl'] as $e)
  echo ok(extension_loaded($e)) . "расширение $e\n";
foreach (['memory_limit','post_max_size','upload_max_filesize','max_execution_time',
          'session.gc_maxlifetime','date.timezone'] as $k) {
  $v = ini_get($k);
  echo '    ' . str_pad($k, 24) . '= ' . ($v === false || $v === '' ? '(не задано)' : $v) . "\n";
}
$pm = (int)preg_replace('/\D/', '', ini_get('post_max_size'));
if ($pm && $pm < 16 && stripos(ini_get('post_max_size'), 'm') !== false)
  echo "!!  post_max_size = " . ini_get('post_max_size') . " — большое сохранение может обрываться. Нужно 32M и больше.\n";
$free = @disk_free_space($OS); if ($free) echo '    свободно на диске: ' . human($free) . "\n";
echo '    папка os доступна на запись: ' . (is_writable($OS) ? 'да' : 'НЕТ') . "\n";

/* ============ 3. БАЗА ДАННЫХ ============ */
hr('3. БАЗА ДАННЫХ');
$pdo = null;
$cfgFile = $OS . '/api/config.php';
if (!is_file($cfgFile)) {
  echo "!!  api/config.php НЕ НАЙДЕН — платформа не видит базу, сохранение работать не будет.\n";
} else {
  echo 'config.php: ' . human(filesize($cfgFile)) . ', права ' . substr(sprintf('%o', fileperms($cfgFile)), -4) . "\n";
  $c = @include $cfgFile;
  echo ok(is_array($c)) . "config.php читается\n";
  if (is_array($c)) {
    echo '    драйвер: ' . ($c['driver'] ?? 'mysql') . "\n";
    echo '    имя базы: ' . ($c['name'] ?? '?') . "   (хост, логин и пароль намеренно не печатаются)\n";
    foreach (['pass','user','host'] as $k)
      echo '    ' . str_pad($k, 22) . (($c[$k] ?? '') === '' ? '!! НЕ ЗАДАН' : 'задан') . "\n";
    foreach (['openrouteservice_key','yandex_search_key','dgis_key','google_maps_key','yandex_geocoder_key'] as $k)
      echo '    ключ ' . str_pad($k, 22) . (empty($c[$k]) ? 'не задан' : 'задан') . "\n";
    try {
      if (($c['driver'] ?? 'mysql') === 'sqlite') $pdo = new PDO('sqlite:' . $c['sqlite_path']);
      else $pdo = new PDO('mysql:host=' . $c['host'] . ';dbname=' . $c['name'] . ';charset=' . ($c['charset'] ?? 'utf8mb4'),
                          $c['user'], $c['pass']);
      $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
      $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
      echo "OK  подключение к базе установлено\n";
      try { echo '    сервер: ' . $pdo->getAttribute(PDO::ATTR_SERVER_VERSION) . "\n"; } catch (Throwable $e) {}
    } catch (Throwable $e) {
      echo '!!  НЕ УДАЛОСЬ ПОДКЛЮЧИТЬСЯ: ' . $e->getMessage() . "\n";
      echo "    Пока база недоступна, платформа не сохраняет ничего.\n";
    }
  }
}

if ($pdo) {
  echo "\nТАБЛИЦЫ:\n";
  foreach (['app_state','app_users','roles','geo_state_history','user_prefs','audit_log','activity_log',
            'login_codes','login_throttle','schema_migrations','feasibility_models','brand_requests'] as $t) {
    try { $n = $pdo->query('SELECT COUNT(*) c FROM `' . $t . '`')->fetch()['c']; echo '    ' . p($t, 24) . p($n, 9, true) . " строк\n"; }
    catch (Throwable $e) { echo '    ' . p($t, 24) . "  нет таблицы\n"; }
  }

  /* ---- 4. ПРАВА: прямой ответ на «у сотрудника пропадают данные» ---- */
  hr('4. СОТРУДНИКИ И ПРАВА (кто вообще может сохранять)');
  try {
    $rl = [];
    foreach ($pdo->query('SELECT * FROM roles')->fetchAll() as $r) {
      $k = $r['key'] ?? $r['role_key'] ?? '';
      $rl[$k] = $r;
    }
    echo "  ПРАВА РОЛЕЙ:\n";
    echo '    ' . p('роль', 8) . p('название', 26) . p('правка', 8) . p('финансы', 9) . p('админ', 7) . p('лизинг', 8) . "планы\n";
    foreach ($rl as $k => $r)
      echo '    ' . p($k, 8) . p($r['label'] ?? '', 26)
         . p(empty($r['edit']) ? 'НЕТ' : 'да', 8) . p(empty($r['finance']) ? 'нет' : 'да', 9)
         . p(empty($r['admin']) ? 'нет' : 'да', 7) . p(empty($r['leasing']) ? 'нет' : 'да', 8)
         . (empty($r['plans']) ? 'нет' : 'да') . "\n";

    $rows = $pdo->query('SELECT id,name,email,role_key,active,created_at FROM app_users ORDER BY role_key,name')->fetchAll();
    echo "\n  СОТРУДНИКИ (" . count($rows) . "):\n";
    echo '    ' . p('имя', 26) . p('почта', 30) . p('роль', 7) . p('правка', 8) . "активен\n";
    $noEdit = [];
    foreach ($rows as $u) {
      $r    = $rl[$u['role_key'] ?? ''] ?? [];
      $edit = array_key_exists('edit', $r) ? (empty($r['edit']) ? 'НЕТ' : 'да') : '?';
      if ($edit === 'НЕТ' && !empty($u['active'])) $noEdit[] = ($u['name'] ?? '') . ' (' . ($u['role_key'] ?? '') . ')';
      echo '    ' . p($u['name'] ?? '', 26) . p($u['email'] ?? '', 30) . p($u['role_key'] ?? '?', 7)
         . p($edit, 8) . (empty($u['active']) ? 'НЕТ' : 'да') . "\n";
    }
    if ($noEdit) {
      echo "\n  !!  У этих активных сотрудников НЕТ права на правку — они физически не могут\n";
      echo "      сохранить ничего, и со стороны это выглядит как «данные пропали»:\n";
      foreach ($noEdit as $n) echo "        - $n\n";
      echo "      Право выдаётся в разделе «Настройки → Права ролей».\n";
    } else echo "\n  У всех активных сотрудников есть право на правку.\n";
  } catch (Throwable $e) { echo '  не удалось прочитать: ' . $e->getMessage() . "\n"; }

  /* ---- 5. ДАННЫЕ ---- */
  hr('5. ДАННЫЕ ПЛАТФОРМЫ');
  $d = null;
  try {
    $st = $pdo->query('SELECT id,data,updated_at,updated_by,revision FROM app_state WHERE id=1')->fetch();
    if (!$st) echo "  !!  app_state пуст — данных на сервере нет вообще\n";
    else {
      echo '  ревизия: ' . ($st['revision'] ?? '?')
         . ' | последнее сохранение: ' . ($st['updated_at'] ?? '?')
         . ' | кем: ' . ($st['updated_by'] ?? '?') . "\n";
      echo '  размер общего состояния: ' . human(strlen((string)$st['data'])) . "\n";
      $d = json_decode((string)$st['data'], true);
      if (!is_array($d)) echo "  !!  СОСТОЯНИЕ НЕ РАЗБИРАЕТСЯ КАК JSON — база повреждена\n";
      else {
        $big = [];
        foreach ($d as $k => $v)
          $big[$k] = ['n' => is_array($v) ? count($v) : 1,
                      's' => strlen((string)json_encode($v, JSON_UNESCAPED_UNICODE))];
        uasort($big, function ($a, $b) { return $b['s'] <=> $a['s']; });
        echo "\n  " . p('РАЗДЕЛ', 24) . p('записей', 9, true) . p('размер', 12, true) . "\n";
        $i = 0;
        foreach ($big as $k => $v) { if ($i++ >= 16) break;
          echo '  ' . p($k, 24) . p($v['n'], 9, true) . p(human($v['s']), 12, true) . "\n"; }
        if (count($big) > 16) echo '  ... и ещё ' . (count($big) - 16) . " разделов\n";

        $U = isset($d['U']) && is_array($d['U']) ? $d['U'] : [];
        $B = isset($d['BRANDS']) && is_array($d['BRANDS']) ? $d['BRANDS'] : [];
        $O = isset($d['OBJECTS']) && is_array($d['OBJECTS']) ? $d['OBJECTS'] : [];
        $withRate = 0; $withBudget = 0; $withVars = 0; $withTenant = 0; $occ = 0; $varsTotal = 0;
        foreach ($U as $u) {
          if (!is_array($u)) continue;
          if (!empty($u['rate']))   $withRate++;
          if (!empty($u['budget'])) $withBudget++;
          if (!empty($u['tenant'])) $withTenant++;
          if (!empty($u['vars']) && is_array($u['vars'])) { $withVars++; $varsTotal += count($u['vars']); }
          if (in_array($u['status'] ?? '', ['cd','os','cs'], true)) $occ++;
        }
        echo "\n  объекты: " . count($O) . ' | помещения: ' . count($U) . ' | бренды: ' . count($B) . "\n";
        echo '  помещений: со ставкой ' . $withRate . ' | с бюджетом ' . $withBudget
           . ' | с арендатором ' . $withTenant . ' | занято ' . $occ . "\n";
        echo '  подбор (варианты): помещений с вариантами ' . $withVars . ', всего вариантов ' . $varsTotal . "\n";
        if (count($U) && !$withRate)
          echo "  !!  Ни у одного помещения нет ставки — коммерческие данные не введены либо потеряны.\n";
        if (count($U) && !$withVars)
          echo "  !!  Ни у одного помещения нет вариантов подбора — подбор не сохраняется либо очищен.\n";

        $g = isset($d['GEO_DATA']) && is_array($d['GEO_DATA']) ? $d['GEO_DATA'] : null;
        if ($g === null) echo "  !!  Раздела GEO_DATA в состоянии НЕТ — геоданные не сохранены.\n";
        else {
          $gn = 0; $parts = [];
          $ds = isset($g['datasets']) && is_array($g['datasets']) ? $g['datasets'] : [];
          foreach ($ds as $k => $v) { $c2 = is_array($v) ? count($v) : 0; $gn += $c2; $parts[] = "$k=$c2"; }
          $gp = (isset($g['projects']) && is_array($g['projects'])) ? count($g['projects']) : 0;
          echo '  геоданные: ' . $gn . ' записей в ' . count($ds) . ' наборах (' . implode(', ', $parts) . '), проектов: ' . $gp . "\n";
          if ($gn === 0) echo "  !!  Геоданные пустые. Смотрите раздел 6 — там видно, когда объём обвалился.\n";
        }
      }
    }
  } catch (Throwable $e) { echo '  ошибка чтения app_state: ' . $e->getMessage() . "\n"; }

  /* ---- 6. ИСТОРИЯ ПРАВОК В ПОМЕЩЕНИЯХ: кто и когда очищал варианты ---- */
  hr('6. ИСТОРИЯ ПРАВОК В ПОМЕЩЕНИЯХ (следы «очищено»)');
  if (is_array($d) && isset($d['U']) && is_array($d['U'])) {
    $ev = [];
    foreach ($d['U'] as $u) {
      if (!is_array($u) || empty($u['hist']) || !is_array($u['hist'])) continue;
      foreach ($u['hist'] as $h) {
        $when = is_array($h) ? (string)($h[0] ?? '') : '';
        $what = is_array($h) ? (string)($h[1] ?? '') : (string)$h;
        if ($what === '') continue;
        if (stripos($what, 'очищено') !== false || mb_stripos($what, 'Варианты (реестр)') !== false)
          $ev[] = [$when, (string)($u['code'] ?? $u['id'] ?? '?'), $what];
      }
    }
    usort($ev, function ($a, $b) { return strcmp($a[0], $b[0]); });
    $clr = 0;
    foreach ($ev as $e) if (stripos($e[2], 'очищено') !== false) $clr++;
    echo '  записей о правке вариантов: ' . count($ev) . ', из них «очищено»: ' . $clr . "\n";
    if ($ev) {
      echo "\n  последние 20:\n";
      echo '    ' . p('дата', 12) . p('помещение', 14) . "что произошло\n";
      foreach (array_slice($ev, -20) as $e)
        echo '    ' . p(substr($e[0], 0, 12), 12) . p($e[1], 14) . cut($e[2], 62) . "\n";
      if ($clr)
        echo "\n  !!  Строки со словом «очищено» — это моменты, когда список вариантов помещения\n"
           . "      обнулился. В скобках указан сотрудник. С версии 4.49.2 платформа переспрашивает\n"
           . "      перед таким обнулением и предлагает добавить вариант вместо замены.\n";
    }
  } else echo "  нет данных для анализа\n";

  /* ---- 7. ИСТОРИЯ ГЕОДАННЫХ ---- */
  hr('7. ИСТОРИЯ ГЕОДАННЫХ (когда менялся объём)');
  try {
    $h = $pdo->query('SELECT id,created_at,updated_by,reason,geo_revision,LENGTH(geo_json) len,geo_json
                      FROM geo_state_history ORDER BY id DESC LIMIT 25')->fetchAll();
    if (!$h) echo "  снимков нет — либо геоданные ни разу не сохраняли, либо история не включена\n";
    else {
      echo '  ' . p('#', 6) . p('дата', 21) . p('кто сохранил', 24) . p('записей', 9, true)
         . p('размер', 11, true) . '  ' . "причина\n";
      $prev = null; $drops = 0;
      foreach (array_reverse($h) as $r) {
        $gd = json_decode((string)$r['geo_json'], true);
        $n  = 0;
        if (is_array($gd) && isset($gd['datasets']) && is_array($gd['datasets']))
          foreach ($gd['datasets'] as $v) if (is_array($v)) $n += count($v);
        $mark = ($prev !== null && $prev > 0 && $n < $prev * 0.7) ? '   <-- РЕЗКОЕ ПАДЕНИЕ' : '';
        if ($mark) $drops++;
        echo rtrim('  ' . p($r['id'], 6) . p(substr((string)$r['created_at'], 0, 19), 21)
           . p($r['updated_by'] ?? '', 24) . p($n, 9, true) . p(human($r['len']), 11, true)
           . '  ' . p($r['reason'] ?? '', 22) . $mark) . "\n";
        $prev = $n;
      }
      echo "\n  Строка с пометкой «РЕЗКОЕ ПАДЕНИЕ» показывает момент и учётную запись, под которой\n";
      echo "  объём геоданных обвалился. К любому снимку можно вернуться из интерфейса:\n";
      echo "  Геоаналитика → «История / восстановление».\n";
      if (!$drops) echo "  Обвалов объёма не зафиксировано.\n";
    }
  } catch (Throwable $e) { echo '  таблицы истории нет или ошибка: ' . $e->getMessage() . "\n"; }

  /* ---- 8. ЖУРНАЛ ДЕЙСТВИЙ: отказы в сохранении ---- */
  hr('8. ЖУРНАЛ ДЕЙСТВИЙ (отказы и восстановления)');
  try {
    $a = $pdo->query('SELECT at,by_name,role_key,action,detail FROM audit_log ORDER BY id DESC LIMIT 30')->fetchAll();
    if (!$a) echo "  журнал пуст\n";
    else {
      echo '  ' . p('когда', 21) . p('кто', 24) . p('роль', 6) . p('действие', 24) . "подробности\n";
      foreach ($a as $r)
        echo '  ' . p(substr((string)$r['at'], 0, 19), 21) . p($r['by_name'] ?? '', 24)
           . p($r['role_key'] ?? '-', 6) . p($r['action'] ?? '', 24) . cut($r['detail'] ?? '', 44) . "\n";
      echo "\n  Действие «state_key_denied» означает: сотрудник пытался сохранить раздел, который\n";
      echo "  закрыт для его роли. Для него это выглядит как «ввёл и всё пропало».\n";
    }
  } catch (Throwable $e) { echo '  журнала нет или ошибка: ' . $e->getMessage() . "\n"; }

  /* ---- 9. ЛИЧНЫЕ НАСТРОЙКИ ТАБЛИЦ ---- */
  hr('9. ЛИЧНЫЕ НАСТРОЙКИ ТАБЛИЦ');
  try {
    $pf = $pdo->query('SELECT user_id,LENGTH(data) len,updated_at FROM user_prefs ORDER BY updated_at DESC LIMIT 15')->fetchAll();
    if (!$pf) echo "  ни у кого не сохранены — настройки столбцов живут только в браузере\n";
    else {
      echo '  ' . p('пользователь', 40) . p('размер', 11, true) . '  ' . "обновлено\n";
      foreach ($pf as $r)
        echo '  ' . p($r['user_id'], 40) . p(human($r['len']), 11, true) . '  ' . $r['updated_at'] . "\n";
    }
  } catch (Throwable $e) { echo '  таблицы нет или ошибка: ' . $e->getMessage() . "\n"; }
}

/* ============ 10. ОШИБКИ PHP ============ */
hr('10. ПОСЛЕДНИЕ ОШИБКИ PHP');
$logs = array_filter([ini_get('error_log'), $OS . '/error_log', $OS . '/api/error_log',
                      dirname($OS) . '/error_log', dirname($OS) . '/logs/error_log']);
$shown = false;
foreach ($logs as $lg) {
  if ($lg && @is_file($lg) && @is_readable($lg)) {
    echo "файл: $lg\n";
    $lines = @file($lg) ?: [];
    foreach (array_slice($lines, -20) as $l) echo '  ' . rtrim($l) . "\n";
    $shown = true;
    break;
  }
}
if (!$shown) echo "  файл ошибок не найден — обычно это значит, что ошибок нет\n";

hr('ГОТОВО');
echo "Скрипт ничего не изменил. Вывод можно переслать целиком — секретов в нём нет.\n";
