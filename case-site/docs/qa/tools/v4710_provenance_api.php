<?php
/* Происхождение чисел: серверная сторона.

   Проверяется не «функция вернула массив», а четыре свойства, нарушение любого из которых
   обесценивает всё остальное:

     1. «подтверждено» нельзя поставить задним числом или чужим именем: для conf=verified
        сервер ставит автора и дату сам, что бы ни прислал браузер;
     2. дата из будущего отклоняется: цифра, «проверенная» завтра, не устареет никогда,
        и правило 90/180 дней обошли бы одной опечаткой;
     3. роль без права finance не получает записи о ставках ни на чтение, ни на запись,
        и при этом НЕ СТИРАЕТ их своим обычным сохранением всего состояния;
     4. ключ строгий: происхождение ведётся только у перечисленных полей, иначе карта
        наполнится записями, которые ничему не соответствуют.

   Третье свойство важнее прочих по той же причине, что и в v4701: утечку заметят,
   молчаливую пропажу подтверждений - нет.

   Запуск: php v4710_provenance_api.php [папка os] */
declare(strict_types=1);

$OS = $argv[1] ?? dirname(__DIR__, 3) . '/os';

/* Берём только нужные функции: полный lib.php тянет подключение к базе. */
$lib = file_get_contents($OS . '/api/lib.php');
$start = strpos($lib, 'function unit_finance_fields');
if ($start === false) { fwrite(STDERR, "!!  в lib.php нет unit_finance_fields\n"); exit(1); }
eval(substr($lib, $start));
foreach (['prov_fields','prov_parse_key','prov_clean_record','redact_prov_for','restore_prov_finance','prov_is_finance_key'] as $fn) {
  if (!function_exists($fn)) { fwrite(STDERR, "!!  в lib.php нет {$fn}\n"); exit(1); }
}

$bad = 0;
function ck(string $n, bool $c, string $d = null): void {
  global $bad;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' - ' . $d) . "\n";
  if (!$c) $bad++;
}

$FIN   = ['name'=>'Азиз Шарипов', 'finance'=>1, 'admin'=>0, 'edit'=>1];
$NOFIN = ['name'=>'Агент Каримов', 'finance'=>0, 'admin'=>0, 'edit'=>1];
$TODAY = '2026-09-15';

echo "--- 1. Ключ: строгий разбор\n";
foreach (['unit:u12:rate','unit:u12:area','unit:u12:status','object:ca:gba','object:ca:gla','bench:b3:rate','brand:br9:rate'] as $k) {
  ck("принимается $k", prov_parse_key($k) !== null);
}
foreach ([
  'unit:u12:comment'    => 'поле, за которым происхождение не ведётся',
  'tenant:t1:rate'      => 'неизвестная сущность',
  'unit::rate'          => 'пустой идентификатор',
  'unit:u12'            => 'нет поля',
  'unit:u12:rate:extra' => 'лишний сегмент',
  'unit:u 12:rate'      => 'пробел в идентификаторе',
  "unit:u12:rate\n"     => 'перевод строки в конце',
  ''                    => 'пустая строка',
] as $k => $why) {
  ck("отклоняется: $why", prov_parse_key($k) === null, json_encode($k, JSON_UNESCAPED_UNICODE));
}
$p = prov_parse_key('unit:u12:rate');
ck('разбор возвращает сущность, идентификатор и поле',
   $p === ['entity'=>'unit','id'=>'u12','field'=>'rate'], json_encode($p));

echo "\n--- 2. Подтверждение: автор и дата ставятся сервером\n";
$r = prov_clean_record(['conf'=>'verified','src'=>'landlord','name'=>'ООО Ромашка',
                        'by'=>'Директор Чужой','at'=>'2024-01-01','how'=>'document'], $FIN, $TODAY);
ck('автор подтверждения - текущий пользователь, а не присланный', $r['by'] === 'Азиз Шарипов', $r['by']);
ck('дата подтверждения - сегодня, а не присланная',                $r['at'] === $TODAY, $r['at']);
ck('способ проверки сохраняется',                                  $r['how'] === 'document');
ck('источник и имя сохраняются',                                   $r['src'] === 'landlord' && $r['name'] === 'ООО Ромашка');
$r = prov_clean_record(['conf'=>'verified'], $FIN, $TODAY);
ck('подтверждение без способа получает «звонок» по умолчанию',     $r['how'] === 'call', $r['how']);

echo "\n--- 3. Запрошенное и расчётное: дата наблюдения принимается, автор - как прислан\n";
$r = prov_clean_record(['conf'=>'asking','src'=>'listing','name'=>'olx.uz','at'=>'2026-06-01','by'=>'Каримов'], $NOFIN, $TODAY);
ck('дата наблюдения сохраняется',            $r['at'] === '2026-06-01', $r['at']);
ck('автор наблюдения сохраняется',           $r['by'] === 'Каримов', $r['by']);
ck('способ проверки у запрошенного пустой',  $r['how'] === '', json_encode($r['how']));
$r = prov_clean_record(['conf'=>'modelled','src'=>'calculated','basis'=>'unit:u12:area'], $FIN, $TODAY);
ck('расчётное хранит основание',             $r['basis'] === 'unit:u12:area');
$r = prov_clean_record(['conf'=>'asking'], $FIN, $TODAY);
ck('без даты подставляется сегодня',         $r['at'] === $TODAY, $r['at']);
$r = prov_clean_record(['conf'=>'asking','at'=>'вчера'], $FIN, $TODAY);
ck('нечитаемая дата заменяется на сегодня',  $r['at'] === $TODAY, $r['at']);

echo "\n--- 4. Отклоняется то, что должно отклоняться\n";
$rejects = [
  'дата из будущего'                 => ['conf'=>'asking','at'=>'2026-09-16'],
  'неизвестная уверенность «точно»'  => ['conf'=>'точно'],
  'пустая уверенность'               => ['conf'=>''],
  'без уверенности вовсе'            => ['src'=>'landlord'],
  'запись не объект'                 => 'строка',
];
foreach ($rejects as $why => $rec) {
  $thrown = false;
  try { prov_clean_record($rec, $FIN, $TODAY); } catch (InvalidArgumentException $e) { $thrown = true; }
  ck("отклонено: $why", $thrown);
}
/* Будущее проверяется относительно переданного «сегодня», а не системных часов: иначе тест
   зависел бы от даты запуска. */
$ok = true;
try { prov_clean_record(['conf'=>'asking','at'=>'2026-09-15'], $FIN, $TODAY); } catch (Throwable $e) { $ok = false; }
ck('сегодняшняя дата принимается (граница включающая)', $ok);

echo "\n--- 5. Неизвестные значения не роняют запись, а сводятся к безопасным\n";
$r = prov_clean_record(['conf'=>'asking','src'=>'сосед сказал','how'=>'телепатия'], $FIN, $TODAY);
ck('неизвестный источник становится «иное»',  $r['src'] === 'other', $r['src']);
ck('неизвестный способ проверки сбрасывается', $r['how'] === '', json_encode($r['how']));
$r = prov_clean_record(['conf'=>'asking','name'=>str_repeat('я', 500),'note'=>str_repeat('н', 1000)], $FIN, $TODAY);
ck('имя источника обрезается до 160',          mb_strlen($r['name']) === 160, (string)mb_strlen($r['name']));
ck('примечание обрезается до 400',             mb_strlen($r['note']) === 400, (string)mb_strlen($r['note']));

echo "\n--- 6. Роль без finance: финансовые записи не видит и не стирает\n";
$PROV = [
  'unit:u1:rate'   => ['conf'=>'verified','src'=>'deal','name'=>'договор 12/2026','at'=>'2026-08-01','by'=>'Шарипов','how'=>'document','basis'=>'','note'=>''],
  'unit:u1:area'   => ['conf'=>'verified','src'=>'document','name'=>'БТИ','at'=>'2026-08-01','by'=>'Шарипов','how'=>'document','basis'=>'','note'=>''],
  'unit:u1:status' => ['conf'=>'asking','src'=>'broker','name'=>'','at'=>'2026-09-01','by'=>'Каримов','how'=>'','basis'=>'','note'=>''],
  'unit:u2:budget' => ['conf'=>'asking','src'=>'landlord','name'=>'','at'=>'2026-09-01','by'=>'','how'=>'','basis'=>'','note'=>''],
  'unit:u2:total'  => ['conf'=>'modelled','src'=>'calculated','name'=>'','at'=>'2026-09-01','by'=>'','how'=>'','basis'=>'unit:u2:rate','note'=>''],
];
ck('rate считается финансовым ключом',   prov_is_finance_key('unit:u1:rate'));
ck('budget считается финансовым ключом', prov_is_finance_key('unit:u2:budget'));
ck('total считается финансовым ключом',  prov_is_finance_key('unit:u2:total'));
ck('area не считается финансовым',       !prov_is_finance_key('unit:u1:area'));
ck('status не считается финансовым',     !prov_is_finance_key('unit:u1:status'));

$seen = redact_prov_for($PROV, $NOFIN);
ck('роль без finance не получает записи о ставке',  !isset($seen['unit:u1:rate']));
ck('роль без finance не получает записи о бюджете', !isset($seen['unit:u2:budget']));
ck('роль без finance не получает записи об итоге',  !isset($seen['unit:u2:total']));
ck('площадь и статус ей отдаются',                  isset($seen['unit:u1:area']) && isset($seen['unit:u1:status']));
ck('роль с finance получает всё',                    redact_prov_for($PROV, $FIN) === $PROV);

/* Главное: та же роль сохраняет состояние целиком, в котором финансовых записей нет
   (она их не получала), и добавляет своё наблюдение по статусу. */
$incoming = $seen;
$incoming['unit:u1:status'] = ['conf'=>'verified','src'=>'field','name'=>'','at'=>'2026-09-15','by'=>'Каримов','how'=>'visit','basis'=>'','note'=>''];
$saved = restore_prov_finance($incoming, $PROV, $NOFIN);
ck('запись о ставке НЕ стёрта сохранением роли без finance', ($saved['unit:u1:rate'] ?? null) === $PROV['unit:u1:rate']);
ck('запись о бюджете НЕ стёрта',                              ($saved['unit:u2:budget'] ?? null) === $PROV['unit:u2:budget']);
ck('запись об итоге НЕ стёрта',                               ($saved['unit:u2:total'] ?? null) === $PROV['unit:u2:total']);
ck('её собственная правка статуса принята',                  ($saved['unit:u1:status']['how'] ?? '') === 'visit');
ck('площадь не тронута',                                      ($saved['unit:u1:area'] ?? null) === $PROV['unit:u1:area']);

/* Обратная попытка: роль без finance подсовывает запись о ставке в общее сохранение. */
$sneak = $seen;
$sneak['unit:u1:rate'] = ['conf'=>'verified','src'=>'deal','name'=>'подделка','at'=>'2026-09-15','by'=>'Каримов','how'=>'deal','basis'=>'','note'=>''];
$saved = restore_prov_finance($sneak, $PROV, $NOFIN);
ck('подсунутая запись о ставке заменяется серверной копией', ($saved['unit:u1:rate']['name'] ?? '') === 'договор 12/2026', $saved['unit:u1:rate']['name'] ?? 'нет');
$sneak2 = $seen;
$sneak2['unit:u9:rate'] = ['conf'=>'asking','src'=>'listing','name'=>'','at'=>'2026-09-15','by'=>'','how'=>'','basis'=>'','note'=>''];
$saved = restore_prov_finance($sneak2, $PROV, $NOFIN);
ck('новая финансовая запись от роли без finance не проходит', !isset($saved['unit:u9:rate']));

echo "\n--- 7. Эндпоинт использует именно эти функции, а не свою копию правил\n";
$ep = file_get_contents($OS . '/api/provenance.php');
ck('provenance.php вызывает prov_parse_key',    strpos($ep, 'prov_parse_key(') !== false);
ck('provenance.php вызывает prov_clean_record', strpos($ep, 'prov_clean_record(') !== false);
ck('provenance.php закрывает финансовые поля через unit_can_see_finance',
   strpos($ep, 'unit_can_see_finance(') !== false && strpos($ep, 'unit_finance_fields(') !== false);
$sp = file_get_contents($OS . '/api/state.php');
ck('state.php режет PROV на чтении',         strpos($sp, 'redact_prov_for(') !== false);
ck('state.php восстанавливает PROV на записи', strpos($sp, 'restore_prov_finance(') !== false);
ck('PROV зарегистрирован в списке ключей состояния', preg_match("/'PROV'\]/", $sp) === 1);

echo "\n" . ($bad ? "ПРОВАЛЕНО проверок: {$bad}\n" : "Происхождение чисел на сервере ведёт себя верно\n");
exit($bad ? 1 : 0);
