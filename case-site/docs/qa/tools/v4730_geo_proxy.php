<?php
/* Гео-агент: серверная сторона без сети и без базы.

   Что проверяется и почему:

     1. Геокодер: адрес запроса к Nominatim собран по правилам (формат, страна, язык), ответ
        разбирается в короткие записи, мусор отбрасывается.
     2. Диагностика связи: чистая функция «факты -> советы» на всех сочетаниях, которые
        встречаются на хостинге: нет curl, закрыта сеть, своя модель есть / нет / не отвечает,
        найдена локальная Ollama. Совет обязан называть причину и лечение.
     3. Своя модель: тело запроса в формате OpenAI, меню команд в подсказке, разбор ответа
        строгий - неизвестные команды и вложенные структуры отбрасываются, ограждённый
        JSON в ``` принимается. Это единственная защита от того, что маленькая модель выдумает
        команду, которой нет.
     4. Внешних ИИ-сервисов в коде нет: файлов assistant.php нет, в config.sample нет ключей
        Anthropic, в исходниках нет обращений к api.anthropic.com.
     5. Синтаксис не новее PHP 7.2 на всех затронутых файлах: хостинг на PHP 8.0, но версия
        переключается в панели одним кликом, и код не должен зависеть от этого выбора.

   Запуск: php v4730_geo_proxy.php [папка os] */
declare(strict_types=1);

$OS = $argv[1] ?? dirname(__DIR__, 3) . '/os';
require $OS . '/api/osm_lib.php';
require $OS . '/api/llm_lib.php';

$bad = 0;
function ck(string $n, bool $c, string $d = null): void {
  global $bad;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' - ' . $d) . "\n";
  if (!$c) $bad++;
}

echo "--- 1. Геокодер\n";
$u = osm_geocode_url('Амира Темура 15, Ташкент', 'ru');
ck('адрес Nominatim с форматом jsonv2, страной uz и языком', strpos($u, 'nominatim.openstreetmap.org/search') !== false && strpos($u, 'format=jsonv2') !== false && strpos($u, 'countrycodes=uz') !== false && strpos($u, 'accept-language=ru') !== false);
ck('запрос закодирован', strpos($u, 'q=%D0%90') !== false);
$parsed = osm_geocode_parse([
  ['display_name' => 'улица Амира Темура, 15, Ташкент, Узбекистан', 'lat' => '41.3111234', 'lon' => '69.2797456', 'type' => 'house'],
  ['display_name' => 'без координат'],
  'мусор',
  ['lat' => '41.3', 'lon' => '69.3'],
]);
ck('разобраны только записи с координатами', count($parsed) === 2, (string)count($parsed));
ck('координаты округлены до 6 знаков', $parsed[0]['lat'] === 41.311123 && $parsed[0]['lon'] === 69.279746);
ck('имя и тип на месте', $parsed[0]['name'] !== '' && $parsed[0]['type'] === 'house');
ck('запись без имени не роняет разбор', $parsed[1]['name'] === '');
ck('не-массив даёт пустой список', osm_geocode_parse('строка') === []);

echo "\n--- 2. Диагностика связи\n";
$envOk = ['php' => '7.2', 'curl' => true, 'allow_url_fopen' => true, 'openssl' => true];
$ok = ['status' => 200, 'error' => '', 'ms' => 120];
$down = ['status' => 0, 'error' => 'Could not resolve host', 'ms' => 0];
$adv = osm_diagnosis(['env' => $envOk, 'overpass' => $ok, 'nominatim' => $ok, 'llm' => ['configured' => false, 'ollama_local' => false]]);
ck('всё доступно: совет говорит «доступен» и про движок команд', count(preg_grep('~доступен~', $adv)) === 2 && count(preg_grep('~движком команд~', $adv)) === 1, implode(' | ', $adv));
$adv = osm_diagnosis(['env' => ['curl' => false, 'allow_url_fopen' => false], 'overpass' => $down, 'nominatim' => $down, 'llm' => ['configured' => false]]);
ck('нет curl и fopen: названы «Select PHP version» и curl', count(preg_grep('~Select PHP version~', $adv)) === 1);
ck('сеть закрыта: назван итог про сетевую политику хостинга и текст обращения в поддержку', count(preg_grep('~сетевая политика хостинга~', $adv)) === 1 && count(preg_grep('~разрешите исходящие HTTPS~', $adv)) === 1);
$adv = osm_diagnosis(['env' => $envOk, 'overpass' => ['status' => 504, 'error' => '', 'ms' => 30000], 'nominatim' => $ok]);
ck('Overpass перегружен: совет повторить позже, без обвинения хостинга', count(preg_grep('~Повторите позже~', $adv)) === 1 && !preg_grep('~сетевая политика~', $adv));
$adv = osm_diagnosis(['env' => $envOk, 'overpass' => $ok, 'nominatim' => $ok, 'llm' => ['configured' => true, 'endpoint' => 'http://127.0.0.1:11434/v1', 'model' => 'llama3', 'status' => 200, 'ms' => 40, 'error' => '']]);
ck('своя модель отвечает: названы адрес и модель, числа всё равно у инструментов', count(preg_grep('~11434/v1 отвечает~', $adv)) === 1 && count(preg_grep('~числа всё равно считают инструменты~', $adv)) === 1);
$adv = osm_diagnosis(['env' => $envOk, 'overpass' => $ok, 'nominatim' => $ok, 'llm' => ['configured' => true, 'endpoint' => 'http://127.0.0.1:11434/v1', 'model' => 'llama3', 'status' => 0, 'ms' => 0, 'error' => 'Connection refused']]);
ck('своя модель не отвечает: совет проверить Ollama и адрес, команды работают', count(preg_grep('~запущена ли Ollama~', $adv)) === 1 && count(preg_grep('~Команды работают без неё~', $adv)) === 1);
$adv = osm_diagnosis(['env' => $envOk, 'overpass' => $ok, 'nominatim' => $ok, 'llm' => ['configured' => false, 'ollama_local' => true, 'ollama_models' => 'llama3:latest, mistral:latest']]);
ck('найдена локальная Ollama: названы модели и что дописать в config.php', count(preg_grep('~найдена Ollama~', $adv)) === 1 && count(preg_grep('~llama3:latest~', $adv)) === 1 && count(preg_grep('~llm_endpoint~', $adv)) === 1);
$adv = osm_diagnosis(['env' => ['curl' => false, 'allow_url_fopen' => true], 'overpass' => $ok, 'nominatim' => $ok]);
ck('curl выключен, но fopen есть: мягкий совет включить curl', count(preg_grep('~включите curl~', $adv)) === 1);
$all = implode("\n", osm_diagnosis(['env' => $envOk, 'overpass' => $down, 'nominatim' => $down, 'llm' => ['configured' => false]]));
ck('в советах нет длинного тире', strpos($all, "\u{2014}") === false && strpos($all, "\u{2013}") === false);

echo "\n--- 3. Своя модель\n";
$c = llm_config(['llm_endpoint' => 'http://127.0.0.1:11434/v1/', 'llm_model' => 'llama3']);
ck('настроена, хвостовой слэш срезан', $c['configured'] && $c['endpoint'] === 'http://127.0.0.1:11434/v1' && $c['model'] === 'llama3');
ck('без модели не настроена', !llm_config(['llm_endpoint' => 'http://x'])['configured']);
ck('без адреса не настроена', !llm_config(['llm_model' => 'llama3'])['configured']);
ck('пустой конфиг не настроен', !llm_config([])['configured']);
$req = llm_build_request('llama3', 'сколько народу поблизости', 'ru');
ck('формат OpenAI chat completions', $req['model'] === 'llama3' && $req['messages'][0]['role'] === 'system' && $req['messages'][1]['role'] === 'user' && $req['stream'] === false);
ck('температура 0: перевод в команды должен быть повторяемым', $req['temperature'] === 0);
$sys = $req['messages'][0]['content'];
$menuOk = true; foreach (array_keys(llm_menu()) as $n) if (strpos($sys, '- ' . $n . ':') === false) $menuOk = false;
ck('все команды меню перечислены в подсказке', $menuOk);
ck('подсказка требует только JSON и запрещает выдумывать числа', strpos($sys, 'ТОЛЬКО JSON') !== false && strpos($sys, 'Не выдумывай числа') !== false);
ck('в меню нет help и ping: их модель вызывать не должна', !isset(llm_menu()['help']) && !isset(llm_menu()['ping']));
$calls = llm_parse_calls("Вот команды:\n```json\n[{\"name\":\"draw_radius\",\"input\":{\"radii_m\":[500,1000]}},{\"name\":\"count_population\",\"input\":{\"radius_m\":1000}},{\"name\":\"delete_everything\",\"input\":{}},{\"name\":\"style_layer\",\"input\":{\"layer\":\"buildings\",\"color\":\"#2e86de\",\"nested\":{\"a\":1}}}]\n```\nГотово.");
ck('ограждённый JSON с пояснениями разобран', count($calls) === 3, (string)count($calls));
ck('неизвестная команда отброшена', !in_array('delete_everything', array_map(function ($c) { return $c['name']; }, $calls), true));
ck('массив чисел сохранён', $calls[0]['input']['radii_m'] === [500, 1000]);
ck('вложенный объект во входе отброшен, простые поля остались', !isset($calls[2]['input']['nested']) && $calls[2]['input']['color'] === '#2e86de');
$pts = llm_parse_calls('[{"name":"draw_polygon","input":{"points":[[41.31,69.28],[41.32,69.29],[41.30,69.30],["x","y"]]}}]');
ck('точки полигона как пары чисел, мусор отброшен', count($pts[0]['input']['points']) === 3 && $pts[0]['input']['points'][0] === [41.31, 69.28]);
ck('не JSON -> пусто', llm_parse_calls('извините, не понял') === []);
ck('объект вместо массива -> пусто', llm_parse_calls('{"name":"draw_radius"}') === []);
$many = '[' . implode(',', array_fill(0, 12, '{"name":"zone_area","input":{}}')) . ']';
ck('не больше восьми команд за раз', count(llm_parse_calls($many)) === 8);
ck('ключ входа с недопустимыми символами отброшен', llm_parse_calls('[{"name":"clear_layers","input":{"lay ers":1,"layers":["zone"]}}]')[0]['input'] === ['layers' => ['zone']]);
ck('текст ответа извлекается из choices', llm_extract_text(['choices' => [['message' => ['content' => '[]']]]]) === '[]' && llm_extract_text([]) === '');
$tr = llm_translate([], 'что угодно', 'ru');
ck('без настройки перевод честно отвечает not_configured, без сети', !$tr['ok'] && $tr['error'] === 'not_configured');

echo "\n--- 4. Внешних ИИ-сервисов нет\n";
ck('assistant.php и assistant_lib.php удалены', !is_file($OS . '/api/assistant.php') && !is_file($OS . '/api/assistant_lib.php'));
$sample = file_get_contents($OS . '/api/config.sample.php');
ck('в config.sample нет ключа Anthropic, есть llm_endpoint/llm_model', strpos($sample, 'anthropic_api_key') === false && strpos($sample, "'llm_endpoint'") !== false && strpos($sample, "'llm_model'") !== false);
$hits = [];
foreach (glob($OS . '/api/*.php') as $f) { $s = file_get_contents($f); if (stripos($s, 'anthropic') !== false) $hits[] = basename($f); }
foreach (glob($OS . '/*.js') as $f) { $s = file_get_contents($f); if (stripos($s, 'api.anthropic') !== false || stripos($s, 'assistant.php') !== false) $hits[] = basename($f); }
ck('ни в API, ни в модулях нет обращений к Anthropic или assistant.php', !$hits, implode(', ', $hits));
$ep = file_get_contents($OS . '/api/llm.php');
ck('llm.php требует вход, только GET и отвечает needs_llm без настройки', strpos($ep, 'require_login()') !== false && strpos($ep, "!== 'GET'") !== false && strpos($ep, "'needs_llm'=>true") !== false);
ck('llm.php ограничивает частоту', strpos($ep, '429') !== false);
$gp = file_get_contents($OS . '/api/gis_proxy.php');
ck('gis_proxy: режимы geocode и ping на месте', strpos($gp, "\$mode === 'geocode'") !== false && strpos($gp, "\$mode === 'ping'") !== false);
ck('gis_proxy: геокодер кэшируется и ходит с честным User-Agent', strpos($gp, "'nominatim', 'geocode'") !== false && strpos($gp, 'geo agent address search') !== false);
ck('gis_proxy: ping только ролям с правом правки и с лимитом', strpos($gp, "Проверка связи доступна ролям с правом правки") !== false && strpos($gp, 'geo_ping') !== false);

echo "\n--- 5. Совместимость с PHP 7.2\n";
foreach (['llm.php', 'llm_lib.php', 'osm_lib.php', 'gis_proxy.php'] as $f) {
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

echo "\n" . ($bad ? "ПРОВАЛЕНО проверок: {$bad}\n" : "Серверная сторона гео-агента ведёт себя верно\n");
exit($bad ? 1 : 0);
