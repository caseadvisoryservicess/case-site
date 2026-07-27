<?php
/* CASE OS — углублённая проверка: помещения, права на разделы, корзина, отказы.

   ЗАПУСК (в терминале, из папки os/):
       php deep_check.php
       php deep_check.php > deep.txt

   Отвечает на два вопроса, которые остались открытыми после server_check.php:
     1. Почему у помещений пусто в ставке и бюджете — данных нет вообще
        или они лежат в других полях?
     2. Кто именно из ролей имеет право сохранять помещения, а у кого сервер
        молча откатывает правки обратно.

   БЕЗОПАСНОСТЬ: только чтение. Ничего не меняет и не удаляет.
   Имена арендаторов и брендов не печатаются — только счётчики заполненности. */

if (PHP_SAPI !== 'cli') {
  header('Content-Type: text/plain; charset=utf-8', true, 403);
  echo "Запускается только из терминала: php deep_check.php\n";
  exit;
}
@ini_set('memory_limit', '512M');

$OS = __DIR__;
if (!is_file($OS . '/index.html')) {
  foreach ([getcwd(), getcwd() . '/os', __DIR__ . '/../os'] as $try)
    if (@is_file($try . '/index.html')) { $OS = realpath($try); break; }
}
function hr($t) { echo "\n" . str_repeat('=', 76) . "\n  $t\n" . str_repeat('=', 76) . "\n"; }
function cut($s, $n) { $s = (string)$s; return function_exists('mb_substr') ? mb_substr($s, 0, $n) : substr($s, 0, $n); }
function p($s, $n, $right = false) {
  $s = cut($s, $n);
  $len = function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
  $pad = str_repeat(' ', max(0, $n - $len));
  return $right ? $pad . $s : $s . $pad;
}

echo "CASE OS — УГЛУБЛЁННАЯ ПРОВЕРКА\n";
echo 'дата: ' . date('Y-m-d H:i:s') . " | папка: $OS\n";

$cfg = $OS . '/api/config.php';
if (!is_file($cfg)) { echo "!! api/config.php не найден\n"; exit; }
$c = include $cfg;
try {
  if (($c['driver'] ?? 'mysql') === 'sqlite') $pdo = new PDO('sqlite:' . $c['sqlite_path']);
  else $pdo = new PDO('mysql:host=' . $c['host'] . ';dbname=' . $c['name'] . ';charset=' . ($c['charset'] ?? 'utf8mb4'), $c['user'], $c['pass']);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (Throwable $e) { echo '!! нет связи с базой: ' . $e->getMessage() . "\n"; exit; }

$row = $pdo->query('SELECT data FROM app_state WHERE id=1')->fetch();
$d = json_decode((string)($row['data'] ?? '{}'), true);
if (!is_array($d)) { echo "!! состояние не читается\n"; exit; }
$U = isset($d['U']) && is_array($d['U']) ? $d['U'] : [];

/* ===== 1. ПОМЕЩЕНИЯ: какие поля реально заполнены ===== */
hr('1. ПОМЕЩЕНИЯ: ЗАПОЛНЕННОСТЬ ПОЛЕЙ (' . count($U) . ' шт.)');
$fill = []; $seen = [];
foreach ($U as $u) {
  if (!is_array($u)) continue;
  foreach ($u as $k => $v) {
    $seen[$k] = true;
    $has = is_array($v) ? count($v) > 0 : (trim((string)$v) !== '' && (string)$v !== '0');
    if ($has) $fill[$k] = ($fill[$k] ?? 0) + 1;
  }
}
foreach (array_keys($seen) as $k) if (!isset($fill[$k])) $fill[$k] = 0;
arsort($fill);
echo '  ' . p('поле', 24) . p('заполнено', 11, true) . "  из " . count($U) . "\n";
foreach ($fill as $k => $v) {
  $mark = ($v === 0) ? '   <-- пусто у всех' : '';
  echo '  ' . p($k, 24) . p($v, 11, true) . $mark . "\n";
}

$lcr = ['rate'=>'ставка реестра','budget'=>'ЛСР: базовая аренда','budLand'=>'ЛСР: аренда посадки',
        'capex'=>'ЛСР: CAPEX','fact'=>'ЛСР: факт','tenant'=>'арендатор','vars'=>'варианты подбора'];
echo "\n  КЛЮЧЕВЫЕ КОММЕРЧЕСКИЕ ПОЛЯ:\n";
foreach ($lcr as $k => $lbl) {
  $has = array_key_exists($k, $fill);
  echo '  ' . p($lbl, 26) . p($k, 10)
     . ($has ? p($fill[$k], 6, true) . ' из ' . count($U) : '     поля нет ни у одного помещения') . "\n";
}
$anyMoney = ($fill['rate'] ?? 0) + ($fill['budget'] ?? 0) + ($fill['budLand'] ?? 0) + ($fill['capex'] ?? 0);
echo $anyMoney
  ? "\n  Коммерческие данные на сервере ЕСТЬ.\n"
  : "\n  !!  НИ У ОДНОГО помещения нет ни ставки, ни бюджета, ни CAPEX.\n"
  . "      Значит на сервер эти данные не доехали ни разу — они не «пропали позже»,\n"
  . "      а не сохранились в момент ввода. Смотрите раздел 3.\n";

/* последние правки по помещениям */
$ev = [];
foreach ($U as $u) {
  if (!is_array($u) || empty($u['hist']) || !is_array($u['hist'])) continue;
  foreach ($u['hist'] as $h) {
    $when = is_array($h) ? (string)($h[0] ?? '') : '';
    $what = is_array($h) ? (string)($h[1] ?? '') : (string)$h;
    if ($what !== '') $ev[] = [$when, (string)($u['code'] ?? $u['id'] ?? '?'), $what];
  }
}
usort($ev, function ($a, $b) { return strcmp($a[0], $b[0]); });
echo "\n  ВСЕГО ЗАПИСЕЙ В ИСТОРИИ ПОМЕЩЕНИЙ: " . count($ev) . "\n";
if ($ev) {
  echo "  последние 15:\n";
  foreach (array_slice($ev, -15) as $e)
    echo '    ' . p(substr($e[0], 0, 12), 12) . p($e[1], 12) . cut($e[2], 60) . "\n";
} else {
  echo "  !!  История правок пуста — похоже, карточки помещений вообще не сохранялись.\n";
}

/* ===== 2. КОРЗИНА ===== */
hr('2. КОРЗИНА (не туда ли уехали данные)');
$T = isset($d['TRASH']) && is_array($d['TRASH']) ? $d['TRASH'] : [];
echo '  записей в корзине: ' . count($T) . "\n";
if ($T) {
  $byType = [];
  foreach ($T as $t) {
    $k = is_array($t) ? (string)($t['type'] ?? $t['kind'] ?? 'без типа') : 'без типа';
    $byType[$k] = ($byType[$k] ?? 0) + 1;
  }
  foreach ($byType as $k => $v) echo '    ' . p($k, 24) . p($v, 6, true) . "\n";
  echo "  Если здесь лежат помещения — их можно вернуть из интерфейса, раздел «Корзина».\n";
}

/* ===== 3. КТО ИМЕЕТ ПРАВО СОХРАНЯТЬ ПОМЕЩЕНИЯ ===== */
hr('3. ПРАВО НА СОХРАНЕНИЕ РАЗДЕЛОВ (почему правки откатываются)');
echo "  Сервер разрешает роли записывать только те разделы, которые входят в её\n";
echo "  рабочие области. Помещения (U) даёт область «registry» либо «plan_master».\n";
echo "  Всё остальное сервер молча возвращает к прежнему значению — правка исчезает.\n\n";

$RW = isset($d['ROLE_WORKSPACES']) && is_array($d['ROLE_WORKSPACES']) ? $d['ROLE_WORKSPACES'] : [];
$UW = isset($d['USER_WORKSPACES']) && is_array($d['USER_WORKSPACES']) ? $d['USER_WORKSPACES'] : [];
if (!$RW) echo "  ROLE_WORKSPACES не задан — действует список по умолчанию из кода.\n";
else {
  echo '  ' . p('роль', 8) . p('может править помещения', 26) . "рабочие области\n";
  foreach ($RW as $role => $ws) {
    $list = is_array($ws) ? $ws : [];
    $canU = in_array('registry', $list, true) || in_array('plan_master', $list, true);
    echo '  ' . p($role, 8) . p($canU ? 'ДА' : 'нет — правки откатятся', 26)
       . cut(implode(', ', $list), 40) . "\n";
  }
}
if ($UW) {
  echo "\n  ПЕРСОНАЛЬНЫЕ НАБОРЫ ОБЛАСТЕЙ (перекрывают роль):\n";
  foreach ($UW as $uid => $ws) {
    $list = is_array($ws) ? $ws : [];
    $canU = in_array('registry', $list, true) || in_array('plan_master', $list, true);
    echo '  ' . p($uid, 40) . p($canU ? 'помещения: ДА' : 'помещения: нет', 20)
       . cut(implode(', ', $list), 30) . "\n";
  }
}

/* ===== 4. ОТКАЗЫ: полная статистика ===== */
hr('4. ОТКАЗЫ В СОХРАНЕНИИ — ПОЛНАЯ КАРТИНА');
try {
  $a = $pdo->query("SELECT by_name,role_key,detail,at FROM audit_log
                    WHERE action='state_key_denied' ORDER BY id DESC LIMIT 400")->fetchAll();
  echo '  всего отказов в журнале (до 400 последних): ' . count($a) . "\n";
  if ($a) {
    $perKey = []; $perUser = []; $firstAt = null; $lastAt = null;
    foreach ($a as $r) {
      $lastAt = $lastAt ?? $r['at']; $firstAt = $r['at'];
      $perUser[($r['by_name'] ?? '?') . ' (' . ($r['role_key'] ?? '?') . ')'] = ($perUser[($r['by_name'] ?? '?') . ' (' . ($r['role_key'] ?? '?') . ')'] ?? 0) + 1;
      if (preg_match('/keys=(.+)$/u', (string)$r['detail'], $m))
        foreach (explode(',', $m[1]) as $k) { $k = trim($k); if ($k !== '') $perKey[$k] = ($perKey[$k] ?? 0) + 1; }
    }
    echo '  период: с ' . $firstAt . ' по ' . $lastAt . "\n";
    echo "\n  КТО НАТЫКАЕТСЯ:\n";
    arsort($perUser);
    foreach ($perUser as $k => $v) echo '    ' . p($k, 40) . p($v, 6, true) . " раз\n";
    echo "\n  КАКИЕ РАЗДЕЛЫ СЕРВЕР НЕ ПРИНЯЛ:\n";
    arsort($perKey);
    foreach ($perKey as $k => $v) {
      $note = ($k === 'U') ? '   <-- ПОМЕЩЕНИЯ: правки реестра и ЛСР не сохраняются' : '';
      echo '    ' . p($k, 24) . p($v, 6, true) . ' раз' . $note . "\n";
    }
    echo "\n  Раздел с пометкой — это и есть причина жалобы «ввёл и всё пропало».\n";
    echo "  Лечение: либо добавить роли нужную рабочую область в «Права ролей»,\n";
    echo "  либо убрать у неё из меню раздел, который она всё равно не может сохранять.\n";
  }
} catch (Throwable $e) { echo '  ошибка: ' . $e->getMessage() . "\n"; }

echo "\n" . str_repeat('=', 76) . "\n";
echo "ГОТОВО. Скрипт ничего не изменил.\n";
