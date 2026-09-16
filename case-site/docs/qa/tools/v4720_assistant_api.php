<?php
/* Гео-ассистент: серверная сторона без сети и без базы.

   Что проверяется и почему:

     1. Тело запроса к модели собрано так, как требует API: модель по умолчанию, инструменты
        с закрытыми схемами, кэшируемая подсказка первой, изменчивый контекст вторым блоком,
        и НИКАКОГО ключа внутри тела. Ключ идёт заголовком; тело уходит в журнал при отладке,
        и ключ в нём был бы утечкой.
     2. История переписки, присланная браузером, чистится: чужие роли, неизвестные типы блоков
        и вызовы несуществующих инструментов выбрасываются. Клиент хранит транскрипт сам,
        значит любая его часть могла быть подделана в DevTools.
     3. Разбор ответа не спотыкается о блоки thinking и отдаёт только text и tool_use.
     4. Библиотека OSM: рамка, запросы Overpass, разбор контуров с площадью и этажностью,
        строка происхождения с атрибуцией ODbL. Площадь проверяется на квадрате известного
        размера, а не «функция что-то вернула».
     5. Синтаксис PHP 7.2: боевой сервер на нём, и одна стрелочная функция уронила бы
        эндпоинт с fatal без единого теста, который это заметил бы.

   Запуск: php v4720_assistant_api.php [папка os] */
declare(strict_types=1);

$OS = $argv[1] ?? dirname(__DIR__, 3) . '/os';
require $OS . '/api/assistant_lib.php';
require $OS . '/api/osm_lib.php';

$bad = 0;
function ck(string $n, bool $c, string $d = null): void {
  global $bad;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' - ' . $d) . "\n";
  if (!$c) $bad++;
}

echo "--- 1. Инструменты\n";
$tools = assistant_tools();
$names = array_map(function ($t) { return $t['name']; }, $tools);
ck('десять инструментов', count($tools) === 10, (string)count($tools));
ck('имена уникальны', count(array_unique($names)) === count($names));
$expected = ['set_site','draw_radius','draw_isochrone','count_population','load_buildings','load_roads','style_layer','select_features','count_competitors','clear_layers'];
ck('состав ровно тот, что исполняет клиент', $names === $expected, implode(',', $names));
$schemaOk = true; $reqOk = true; $descOk = true;
foreach ($tools as $t) {
  $s = $t['input_schema'];
  if (($s['type'] ?? '') !== 'object' || ($s['additionalProperties'] ?? null) !== false) $schemaOk = false;
  foreach ((array)($s['required'] ?? []) as $r) if (!isset($s['properties'][$r])) $reqOk = false;
  if (mb_strlen((string)($t['description'] ?? '')) < 40 || strpos((string)$t['description'], 'Вызывать') === false) $descOk = false;
}
ck('у каждой схемы type=object и additionalProperties=false', $schemaOk);
ck('каждое required-поле описано в properties', $reqOk);
ck('каждое описание говорит, КОГДА вызывать', $descOk);

echo "\n--- 2. Тело запроса\n";
$msgs = [['role'=>'user', 'content'=>[['type'=>'text', 'text'=>'радиус 1 км и население']]]];
$site = ['lat'=>41.3485, 'lon'=>69.3166, 'name'=>'Botanica BC'];
$projects = [['id'=>'p1', 'name'=>'Тест Плаза', 'lat'=>41.315, 'lng'=>69.28]];
$req = assistant_build_request($msgs, $site, $projects, 'ru', '');
ck('модель по умолчанию claude-opus-5', $req['model'] === 'claude-opus-5', $req['model']);
ck('явная модель из конфига уважается', assistant_build_request($msgs, $site, [], 'ru', 'claude-sonnet-5')['model'] === 'claude-sonnet-5');
ck('max_tokens задан и разумен', isset($req['max_tokens']) && $req['max_tokens'] >= 2048 && $req['max_tokens'] <= 16000, (string)$req['max_tokens']);
ck('первый блок system кэшируется', ($req['system'][0]['cache_control']['type'] ?? '') === 'ephemeral');
ck('в стабильной подсказке правило «не источник чисел»', strpos($req['system'][0]['text'], 'не источник чисел') !== false);
ck('в стабильной подсказке нет даты и координат (иначе кэш ломался бы)', !preg_match('~\d{4}-\d{2}-\d{2}|41\.3~', $req['system'][0]['text']));
ck('второй блок system несёт участок', strpos($req['system'][1]['text'], '41.34850') !== false && strpos($req['system'][1]['text'], 'Botanica') !== false);
ck('второй блок system несёт проекты', strpos($req['system'][1]['text'], 'p1 = Тест Плаза') !== false);
ck('второй блок system НЕ кэшируется', !isset($req['system'][1]['cache_control']));
ck('инструменты приложены', count($req['tools']) === 10);
ck('tool_choice auto', ($req['tool_choice']['type'] ?? '') === 'auto');
ck('усилие задано через output_config', isset($req['output_config']['effort']));
ck('устаревшего budget_tokens нет', strpos(json_encode($req), 'budget_tokens') === false);
ck('сообщения переданы как есть', $req['messages'] === $msgs);
$noSite = assistant_build_request($msgs, null, [], 'en', '');
ck('без участка подсказка так и говорит', strpos($noSite['system'][1]['text'], 'не задан') !== false);
ck('язык интерфейса передан', strpos($noSite['system'][1]['text'], 'en') !== false);
$body = json_encode($req);
ck('в теле запроса нет ничего похожего на ключ', strpos($body, 'sk-ant') === false && strpos($body, 'api_key') === false);
ck('в подсказке нет длинного тире', strpos($req['system'][0]['text'], "\u{2014}") === false && strpos($req['system'][0]['text'], "\u{2013}") === false);

echo "\n--- 3. Очистка истории\n";
$dirty = [
  ['role'=>'system', 'content'=>'подделка роли'],
  ['role'=>'user', 'content'=>'привет'],
  ['role'=>'assistant', 'content'=>[
    ['type'=>'text', 'text'=>'ок'],
    ['type'=>'tool_use', 'id'=>'t1', 'name'=>'draw_radius', 'input'=>['radii_m'=>[1000]]],
    ['type'=>'tool_use', 'id'=>'t2', 'name'=>'delete_everything', 'input'=>[]],
    ['type'=>'thinking', 'thinking'=>'...'],
  ]],
  ['role'=>'user', 'content'=>[
    ['type'=>'tool_result', 'tool_use_id'=>'t1', 'content'=>['ok'=>true, 'radii_m'=>[1000]]],
    ['type'=>'image', 'source'=>'x'],
  ]],
  'мусор',
];
$clean = assistant_clean_messages($dirty);
ck('роль system выброшена', count($clean) === 3 && $clean[0]['role'] === 'user');
ck('строка становится текстовым блоком', $clean[0]['content'][0]['type'] === 'text' && $clean[0]['content'][0]['text'] === 'привет');
$asst = $clean[1]['content'];
ck('известный инструмент сохранён', count(array_filter($asst, function ($b) { return $b['type'] === 'tool_use' && $b['name'] === 'draw_radius'; })) === 1);
ck('неизвестный инструмент выброшен', count(array_filter($asst, function ($b) { return $b['type'] === 'tool_use' && $b['name'] === 'delete_everything'; })) === 0);
ck('блок thinking выброшен', count(array_filter($asst, function ($b) { return $b['type'] === 'thinking'; })) === 0);
$res = $clean[2]['content'];
ck('tool_result сохранён и сериализован строкой', count($res) === 1 && $res[0]['type'] === 'tool_result' && is_string($res[0]['content']) && strpos($res[0]['content'], '1000') !== false);
ck('блок image выброшен', count(array_filter($res, function ($b) { return $b['type'] === 'image'; })) === 0);
ck('диалог, начинающийся с assistant, обрезается до первого user', assistant_clean_messages([['role'=>'assistant','content'=>'x'],['role'=>'user','content'=>'y']])[0]['role'] === 'user');
$thrown = false; try { assistant_clean_messages([['role'=>'system','content'=>'x']]); } catch (InvalidArgumentException $e) { $thrown = true; }
ck('пустая история после очистки отклоняется', $thrown);
$thrown = false; try { assistant_clean_messages('строка'); } catch (InvalidArgumentException $e) { $thrown = true; }
ck('не-массив отклоняется', $thrown);
$long = [['role'=>'user', 'content'=>str_repeat('я', 20000)]];
ck('длинный текст обрезается до 8000', mb_strlen(assistant_clean_messages($long)[0]['content'][0]['text']) === 8000);
$many = []; for ($i = 0; $i < 60; $i++) $many[] = ['role'=>$i % 2 ? 'assistant' : 'user', 'content'=>'m' . $i];
$cut = assistant_clean_messages($many);
ck('история обрезается до 40 последних и начинается с user', count($cut) === 40 && $cut[0]['role'] === 'user' && $cut[39]['content'][0]['text'] === 'm59');
$thrown = false; try { assistant_clean_messages([['role'=>'user','content'=>str_repeat('x', 7000)]], 40, 1000); } catch (InvalidArgumentException $e) { $thrown = true; }
ck('превышение лимита байтов отклоняется', $thrown);

echo "\n--- 4. Разбор ответа и ошибок\n";
$api = ['content'=>[
    ['type'=>'thinking', 'thinking'=>'...', 'signature'=>'s'],
    ['type'=>'text', 'text'=>'Считаю.'],
    ['type'=>'tool_use', 'id'=>'toolu_1', 'name'=>'count_population', 'input'=>['radius_m'=>1000]],
  ], 'stop_reason'=>'tool_use', 'model'=>'claude-opus-5', 'usage'=>['input_tokens'=>1200, 'output_tokens'=>80, 'cache_read_input_tokens'=>1000]];
$p = assistant_parse_response($api);
ck('thinking не отдаётся клиенту', count($p['content']) === 2);
ck('text и tool_use сохранены', $p['content'][0]['type'] === 'text' && $p['content'][1]['type'] === 'tool_use' && $p['content'][1]['input']['radius_m'] === 1000);
ck('stop_reason и модель', $p['stop_reason'] === 'tool_use' && $p['model'] === 'claude-opus-5');
ck('usage сведён', $p['usage']['input'] === 1200 && $p['usage']['cache_read'] === 1000);
ck('401 объясняет про ключ', strpos(assistant_error_text(401, null), 'anthropic_api_key') !== false);
ck('429 просит подождать', strpos(assistant_error_text(429, null), 'минуту') !== false);
ck('529/overloaded', strpos(assistant_error_text(529, null), 'перегружена') !== false);
ck('0 = сеть', strpos(assistant_error_text(0, null), 'соединиться') !== false);
ck('тело ошибки API наружу не пересказывается', strpos(assistant_error_text(400, ['error'=>['type'=>'invalid_request_error','message'=>'org secret']]), 'org secret') === false);

echo "\n--- 5. Библиотека OSM\n";
$bb = osm_bbox(41.3, 69.3, 1000);
ck('рамка симметрична по широте', abs(($bb['north'] - 41.3) - (41.3 - $bb['south'])) < 1e-9);
ck('градус долготы шире градуса широты на этой широте', ($bb['east'] - 69.3) > ($bb['north'] - 41.3));
ck('радиус обрезается сверху до 3000', osm_bbox(41.3, 69.3, 99999)['radius_m'] === 3000);
ck('радиус обрезается снизу до 50', osm_bbox(41.3, 69.3, 1)['radius_m'] === 50);
$ql = osm_buildings_ql($bb, 6000);
ck('запрос зданий содержит рамку и out geom', strpos($ql, '["building"]') !== false && strpos($ql, 'out geom') !== false && strpos($ql, osm_bbox_str($bb)) !== false);
$qr = osm_roads_ql($bb, 4000, ['primary', 'residential; drop table', 'TRUNK']);
ck('классы дорог чистятся до букв и подчёркивания: ни пробела, ни кавычки, ни точки с запятой', !preg_match('~\^\([^)]*[\s;"\']~', $qr) && strpos($qr, '(primary|residentialdroptable|trunk)') !== false, $qr);
ck('пустой список классов даёт стандартный набор', strpos(osm_roads_ql($bb, 4000, []), 'motorway|trunk|primary') !== false);

/* Квадрат ~100 x 100 м на широте 41.3: 100 м по широте = 100/111320 градуса,
   100 м по долготе = 100/(111320*cos(41.3)) градуса. */
$dLat = 100 / 111320.0; $dLon = 100 / (111320.0 * cos(deg2rad(41.3)));
$sq = [['lat'=>41.3, 'lon'=>69.3], ['lat'=>41.3 + $dLat, 'lon'=>69.3], ['lat'=>41.3 + $dLat, 'lon'=>69.3 + $dLon], ['lat'=>41.3, 'lon'=>69.3 + $dLon], ['lat'=>41.3, 'lon'=>69.3]];
$elements = [
  ['type'=>'way', 'id'=>1, 'geometry'=>$sq, 'tags'=>['building'=>'apartments', 'building:levels'=>'9', 'name'=>'Дом 1', 'addr:street'=>'ул. Тестовая', 'addr:housenumber'=>'5']],
  ['type'=>'way', 'id'=>2, 'geometry'=>$sq, 'tags'=>['building'=>'yes', 'building:levels'=>'12;14']],
  ['type'=>'way', 'id'=>3, 'geometry'=>[['lat'=>41.3,'lon'=>69.3],['lat'=>41.301,'lon'=>69.301]], 'tags'=>['building'=>'yes']],
  ['type'=>'node', 'id'=>4, 'lat'=>41.3, 'lon'=>69.3, 'tags'=>['building'=>'yes']],
];
$b = osm_ways_to_buildings($elements, 41.3, 100);
ck('линия и узел не считаются зданиями', count($b) === 2, (string)count($b));
ck('площадь квадрата 100x100 м считается с точностью 2%', abs($b[0]['area'] - 10000) < 200, (string)$b[0]['area']);
ck('центроид в середине квадрата', abs($b[0]['c'][0] - (41.3 + $dLat / 2)) < 1e-5 && abs($b[0]['c'][1] - (69.3 + $dLon / 2)) < 1e-5);
ck('этажность разбирается', $b[0]['levels'] === 9);
ck('этажность «12;14» даёт первое число, а не ошибку', $b[1]['levels'] === 12);
ck('building=yes даёт пустой тип', $b[1]['kind'] === '' && $b[0]['kind'] === 'apartments');
ck('адрес склеен', $b[0]['addr'] === 'ул. Тестовая 5');
ck('лимит записей соблюдается', count(osm_ways_to_buildings([$elements[0], $elements[1]], 41.3, 1)) === 1);
$roads = osm_ways_to_roads([
  ['type'=>'way', 'id'=>10, 'geometry'=>[['lat'=>41.3,'lon'=>69.3],['lat'=>41.31,'lon'=>69.31]], 'tags'=>['highway'=>'primary', 'name'=>'пр. Тестовый', 'oneway'=>'yes', 'lanes'=>'4']],
  ['type'=>'way', 'id'=>11, 'geometry'=>[['lat'=>41.3,'lon'=>69.3]], 'tags'=>['highway'=>'residential']],
], 100);
ck('дорога из одной точки отброшена', count($roads) === 1);
ck('класс, имя, одностороннее и полосы разобраны', $roads[0]['cls'] === 'primary' && $roads[0]['name'] === 'пр. Тестовый' && $roads[0]['oneway'] === true && $roads[0]['lanes'] === 4);
$pv = osm_provenance('buildings', $bb, 2);
ck('происхождение несёт атрибуцию OSM и лицензию ODbL', $pv['attribution'] === '© OpenStreetMap contributors' && strpos($pv['licence'], 'ODbL') !== false);
ck('уверенность OSM - наблюдение, не проверено', $pv['conf'] === 'asking');
ck('метод и радиус на месте', strpos($pv['method'], 'building') !== false && $pv['radius_m'] === 1000);

echo "\n--- 6. Эндпоинт и совместимость с PHP 7.2\n";
$ep = file_get_contents($OS . '/api/assistant.php');
ck('эндпоинт требует вход', strpos($ep, 'require_login()') !== false);
ck('без ключа отвечает needs_key, а не падает', strpos($ep, "'needs_key'=>'anthropic_api_key'") !== false);
ck('значение ключа не попадает ни в один ответ', !preg_match('~=>\s*\$key\s*[,\]]~', $ep) && strpos($ep, "'key'=>") === false);
ck('есть ограничение частоты', strpos($ep, '429') !== false);
ck('вызовы инструментов при refusal/max_tokens вырезаются', strpos($ep, "'refusal'") !== false && strpos($ep, "'max_tokens'") !== false);
foreach (['assistant.php', 'assistant_lib.php', 'osm_lib.php', 'gis_proxy.php'] as $f) {
  $src = file_get_contents($OS . '/api/' . $f);
  $bad72 = [];
  if (preg_match('~\bfn\s*\(~', $src)) $bad72[] = 'fn()';
  if (strpos($src, '??=') !== false) $bad72[] = '??=';
  if (preg_match('~\bmatch\s*\(~', $src)) $bad72[] = 'match';
  if (strpos($src, '?->') !== false) $bad72[] = '?->';
  if (preg_match('~\b(str_contains|str_starts_with|str_ends_with|array_key_first|array_key_last|array_is_list)\s*\(~', $src)) $bad72[] = 'функции 7.3+/8.x';
  if (preg_match('~(private|public|protected)\s+(int|string|array|bool|float)\s+\$~', $src)) $bad72[] = 'типизированные свойства';
  ck("$f без конструкций новее PHP 7.2", !$bad72, implode(', ', $bad72));
}

echo "\n" . ($bad ? "ПРОВАЛЕНО проверок: {$bad}\n" : "Серверная сторона гео-ассистента ведёт себя верно\n");
exit($bad ? 1 : 0);
