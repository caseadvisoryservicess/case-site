<?php
/* Финансовые поля помещений: кто их видит и кто может менять.

   Независимый аудит v4.70.0 нашёл здесь две дыры уровня P0, и обе были тихими: экран честно
   маскировал ставки как «•••», а сервер отдавал их целиком - в общем state, в CSV и через
   атомарные эндпоинты. Роль, которой цифры не показывают, скачивала их одной кнопкой.

   Поэтому проверяется не «функция вернула массив», а три свойства, нарушение любого из
   которых означает утечку коммерческой тайны или порчу данных:

     1. роль без права finance не получает денег ни по одному пути;
     2. роль без права finance не может их изменить;
     3. и при этом НЕ СТИРАЕТ их своим обычным сохранением - иначе защита превратилась бы
        в потерю данных у всех.

   Третье свойство важнее первых двух: утечку заметят, молчаливую пропажу ставок - нет.

   Запуск: php v4701_unit_finance_acl.php [папка os] */
declare(strict_types=1);

$OS = $argv[1] ?? dirname(__DIR__, 3) . '/os';

/* Берём только нужные функции: полный lib.php тянет подключение к базе. */
$lib = file_get_contents($OS . '/api/lib.php');
$start = strpos($lib, 'function unit_finance_fields');
if ($start === false) { fwrite(STDERR, "!!  в lib.php нет unit_finance_fields\n"); exit(1); }
eval(substr($lib, $start));

$bad = 0;
function ck(string $n, bool $c, string $d = null): void {
  global $bad;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' - ' . $d) . "\n";
  if (!$c) $bad++;
}

/* Роли ровно как в os/sql/seed_roles.sql и миграции DIR. */
$ROLES = [
  'ASH' => ['name'=>'Генеральный директор',        'finance'=>1,'admin'=>1,'edit'=>1,'plans'=>1],
  'ADM' => ['name'=>'Администратор',               'finance'=>1,'admin'=>1,'edit'=>1,'plans'=>1],
  'CFO' => ['name'=>'Финансовый директор',         'finance'=>1,'admin'=>1,'edit'=>0,'plans'=>1],
  'DIR' => ['name'=>'Директор без админки',        'finance'=>1,'admin'=>0,'edit'=>1,'plans'=>1],
  'BA'  => ['name'=>'Директор по аренде',          'finance'=>1,'admin'=>0,'edit'=>1,'plans'=>0],
  'HO'  => ['name'=>'Администратор аренды',        'finance'=>1,'admin'=>0,'edit'=>1,'plans'=>0],
  'AG'  => ['name'=>'Агент аренды',                'finance'=>0,'admin'=>0,'edit'=>1,'plans'=>0],
  'BSH' => ['name'=>'Архитектор',                  'finance'=>0,'admin'=>0,'edit'=>1,'plans'=>1],
  'BRJ' => ['name'=>'Младший админ данных',        'finance'=>0,'admin'=>0,'edit'=>1,'plans'=>0],
  'AGX' => ['name'=>'Внешний агент',               'finance'=>0,'admin'=>0,'edit'=>0,'plans'=>0],
];

$UNIT = ['id'=>'u1','obj'=>'ca','code'=>'A-101','floor'=>'1','area'=>120.5,'terr'=>10,
  'cat'=>'F&B','sub'=>'Кофейня','status'=>'vac','broker'=>'Нодир',
  'rate'=>32.0,'budget'=>28.0,'budLand'=>25.0,'factLand'=>27.5,'capex'=>15000,
  'total'=>3856.0,'gap'=>4.0,'offer'=>['rent'=>30,'term'=>5]];

$FIN = unit_finance_fields();
ck('список финансовых полей объявлен в одном месте', count($FIN) >= 7, implode(', ', $FIN));
ck('площадь и терраса финансовыми НЕ считаются: они нужны архитектору для работы',
   !in_array('area', $FIN, true) && !in_array('terr', $FIN, true));

echo "\n--- 1. Кто видит деньги\n";
foreach ($ROLES as $key => $r) {
  $u = ['role_key'=>$key] + $r;
  $out = redact_units_for([$UNIT], $u)[0];
  $sees = unit_can_see_finance($u);
  $leaked = array_values(array_filter($FIN, fn($f) => array_key_exists($f, $out)));
  /* сравниваем с полями, которые реально есть в образце: commission и feeTotal в списке
     на будущее, и их отсутствие в фикстуре не должно выглядеть как утечка */
  $present = array_values(array_filter($FIN, fn($f) => array_key_exists($f, $UNIT)));
  if ($sees) {
    ck("$key ({$r['name']}): деньги на месте", count($leaked) === count($present), count($leaked) . ' из ' . count($present));
  } else {
    ck("$key ({$r['name']}): деньги вырезаны", empty($leaked), $leaked ? 'утекло: ' . implode(', ', $leaked) : 'ни одного поля');
    ck("$key: коммерческие условия offer тоже вырезаны", !array_key_exists('offer', $out));
    ck("$key: рабочие поля на месте - площадь, код, статус",
       isset($out['area'], $out['code'], $out['status']) && $out['area'] === 120.5);
    /* Ключи именно УДАЛЕНЫ, а не обнулены: ноль читался бы как настоящая бесплатная ставка */
    ck("$key: поля удалены, а не обнулены", !array_key_exists('rate', $out));
  }
}

echo "\n--- 2. Кто может менять состав помещений\n";
foreach ($ROLES as $key => $r) {
  $u = ['role_key'=>$key] + $r;
  $can = unit_can_change_structure($u);
  $expect = ($r['admin'] || $r['finance'] || $r['plans']) ? true : false;
  ck("$key: право на массовое изменение состава = " . ($can ? 'да' : 'нет'), $can === $expect);
}
ck('агент аренды НЕ может менять состав помещений, хотя у него есть edit',
   unit_can_change_structure(['edit'=>1,'finance'=>0,'admin'=>0,'plans'=>0]) === false);

echo "\n--- 3. Сохранение не стирает деньги (главное свойство)\n";
$agent = ['role_key'=>'AG','finance'=>0,'admin'=>0,'edit'=>1,'plans'=>0];
$server = [$UNIT];
/* Агент получил помещение без денег, поменял статус и брокера и сохраняет весь state. */
$received = redact_units_for($server, $agent);
$edited = $received;
$edited[0]['status'] = 'neg';
$edited[0]['broker'] = 'Азиз';
$saved = restore_unit_finance($edited, $server, $agent);

ck('ставка вернулась из серверной копии', ($saved[0]['rate'] ?? null) === 32.0, var_export($saved[0]['rate'] ?? null, true));
ck('бюджет вернулся', ($saved[0]['budget'] ?? null) === 28.0);
ck('CAPEX вернулся', ($saved[0]['capex'] ?? null) === 15000);
ck('коммерческие условия offer вернулись', ($saved[0]['offer'] ?? null) === ['rent'=>30,'term'=>5]);
ck('разрешённая правка агента сохранилась', $saved[0]['status'] === 'neg' && $saved[0]['broker'] === 'Азиз');
$allBack = array_values(array_filter($FIN, fn($f) => ($saved[0][$f] ?? null) !== ($UNIT[$f] ?? null)));
ck('ни одно финансовое поле не потеряно и не изменено', empty($allBack), $allBack ? implode(', ', $allBack) : 'все на месте');

/* Попытка подделки: агент присылает свою ставку - её обязаны заменить серверной. */
$forged = $received;
$forged[0]['rate'] = 1.0;
$forged[0]['capex'] = 0;
$fixed = restore_unit_finance($forged, $server, $agent);
ck('подложенная агентом ставка отброшена', $fixed[0]['rate'] === 32.0, (string)$fixed[0]['rate']);
ck('подложенный CAPEX отброшен', $fixed[0]['capex'] === 15000);

/* Новое помещение, которого нет на сервере: денег у него просто нет, а не ноль. */
$withNew = $received;
$withNew[] = ['id'=>'u99','obj'=>'ca','code'=>'A-999','area'=>50,'rate'=>99.0];
$afterNew = restore_unit_finance($withNew, $server, $agent);
ck('новому помещению агент не может назначить ставку', !array_key_exists('rate', $afterNew[1]));
ck('само помещение при этом создаётся', $afterNew[1]['code'] === 'A-999');

/* Роль с финансами проходит насквозь без изменений. */
$cfo = ['role_key'=>'CFO','finance'=>1,'admin'=>1,'edit'=>0,'plans'=>1];
$cfoEdit = [$UNIT]; $cfoEdit[0]['rate'] = 35.0;
ck('роль с правом finance меняет ставку свободно',
   restore_unit_finance($cfoEdit, $server, $cfo)[0]['rate'] === 35.0);

echo "\n--- 4. Все три серверных пути спрашивают один и тот же список\n";
$state  = file_get_contents($OS . '/api/state.php');
$patch  = file_get_contents($OS . '/api/unit_patch.php');
$batch  = file_get_contents($OS . '/api/units_batch.php');

ck('state.php вырезает деньги на выдаче', strpos($state, 'redact_units_for($data[\'U\']') !== false);
ck('state.php восстанавливает деньги на приёме', strpos($state, 'restore_unit_finance(') !== false);
ck('unit_patch.php запрещает финансовые поля', strpos($patch, 'unit_finance_fields()') !== false
   && strpos($patch, '$financeLocked') !== false);
ck('unit_patch.php сообщает об отказе, а не молчит', strpos($patch, 'blocked_fields') !== false);
ck('unit_patch.php чистит и свой ответ', strpos($patch, 'redact_units_for([$unit]') !== false);
ck('units_batch.php требует права на структуру', strpos($batch, 'unit_can_change_structure($u)') !== false);
/* Важно не отсутствие строк как таковых - в unit_patch.php есть общий список
   разрешённых полей, и это нормально. Важно, чтобы РЕШЕНИЕ о деньгах принималось
   единой функцией, а не собственным списком в каждом файле. */
ck('решение о деньгах во всех путях принимает общая функция',
   strpos($state, 'redact_units_for(') !== false
   && strpos($patch, 'unit_finance_fields()') !== false
   && strpos($batch, 'unit_can_change_structure(') !== false);
ck('список финансовых полей объявлен ровно один раз - в lib.php',
   substr_count($state . $patch . $batch, 'function unit_finance_fields') === 0);

echo "\n--- 5. Выгрузка CSV\n";
$core = file_get_contents($OS . '/core.js');
$i = strpos($core, 'function exportRegCSV()');
$fn = substr($core, $i, strpos($core, 'function downloadCSV', $i) - $i);
ck('выгрузка спрашивает право finance', strpos($fn, 'R().finance') !== false);
ck('финансовые столбцы отсутствуют, а не пустуют',
   strpos($fn, 'fin?base.concat(money,tail):base.concat(tail)') !== false);
ck('ставка больше не выгружается безусловно', strpos($fn, "u.rate||0,uBudget(u),u.total||0") !== false
   && strpos($fn, 'const fee=fin?') !== false);

echo "\n" . ($bad ? "ПРОВАЛЕНО проверок: $bad\n" : "Финансовые поля закрыты на всех путях и не теряются при сохранении\n");
exit($bad ? 1 : 0);
