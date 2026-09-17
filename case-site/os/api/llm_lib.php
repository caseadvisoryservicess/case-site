<?php
// CASE OS v4.73.0 - своя модель для гео-агента (необязательный слой).
//
// Агент понимает команды детерминированным движком в браузере. Этот файл добавляет второй
// путь только для фраз, которые движок не разобрал: текст уходит на OpenAI-совместимый
// сервер, который стоит у владельца (Ollama на сервере или в его сети), и возвращается
// СПИСОК КОМАНД из закрытого меню. Модель не отвечает пользователю и не считает числа: она
// переводит свободную речь в те же инструменты, что и движок, а инструменты считают сами.
//
// Почему именно так, а не «модель ведёт диалог»: маленькие локальные модели ненадёжно
// вызывают инструменты и охотно выдумывают цифры. Перевод в команды из меню - задача,
// с которой они справляются, а проверка ответа здесь строгая: неизвестная команда или
// кривой JSON просто отбрасываются, и агент честно говорит, что не понял.
//
// Внешние платные сервисы не используются. Адрес и модель задаются в config.php:
//   'llm_endpoint' => 'http://127.0.0.1:11434/v1', 'llm_model' => 'llama3', 'llm_key' => ''.
// Синтаксис совместим с PHP 7.2-8.4 (хостинг на PHP 8.0, но версия переключается в панели).
declare(strict_types=1);

function llm_config(array $c): array {
  $ep = rtrim(trim((string)($c['llm_endpoint'] ?? '')), '/');
  return ['endpoint' => $ep, 'model' => trim((string)($c['llm_model'] ?? '')), 'key' => trim((string)($c['llm_key'] ?? '')), 'configured' => $ep !== '' && trim((string)($c['llm_model'] ?? '')) !== ''];
}

// Закрытое меню команд. Совпадает с инструментами v4730-geo-agent.js; клиент дополнительно
// проверяет каждое имя у себя, так что рассинхрон не даст выполнить лишнего.
function llm_menu(): array {
  return [
    'set_site' => 'задать точку: {"lat":41.31,"lon":69.28} или {"address":"текст адреса"}',
    'draw_radius' => 'нарисовать круги: {"radii_m":[500,1000]}',
    'draw_isochrone' => 'зона за N минут на автомобиле: {"minutes":10}',
    'draw_polygon' => 'начать рисовать полигон кликами: {} или по точкам {"points":[[lat,lon],...]}',
    'finish_polygon' => 'замкнуть полигон: {}',
    'merge_zones' => 'объединить фигуры в одну зону: {}',
    'zone_area' => 'площадь зоны: {}',
    'count_population' => 'жители: {"radius_m":1000} или в зоне {"zone":true}',
    'load_buildings' => 'здания OSM: {"radius_m":500} или {"zone":true}',
    'load_roads' => 'дороги OSM: {"radius_m":1000,"classes":["primary"]} или {"zone":true}',
    'select_features' => 'выделить: {"layer":"buildings","min_levels":9} | {"layer":"buildings","kind":"residential"} | {"layer":"roads","classes":["primary"]}',
    'style_layer' => 'цвет слоя: {"layer":"buildings","color":"#2e86de"} (слои: buildings, roads, zone, selection)',
    'count_competitors' => 'бизнес-центры рядом: {"radius_m":2000} или {"zone":true}',
    'clear_layers' => 'убрать слои: {} или {"layers":["buildings"]}',
  ];
}

function llm_system_prompt(): string {
  $lines = ['Ты переводишь запрос пользователя карты в список команд. Отвечай ТОЛЬКО JSON-массивом объектов {"name":..., "input":{...}} без пояснений и без markdown.',
    'Разрешённые команды и форма входа:'];
  foreach (llm_menu() as $n => $d) $lines[] = '- ' . $n . ': ' . $d;
  $lines[] = 'Если запрос не про карту или его нельзя выразить этими командами, ответь [] (пустой массив). Не выдумывай числа: населения и зданий в командах нет, их считает платформа.';
  $lines[] = 'Порядок: сначала точка, потом фигуры (радиус, полигон), потом загрузка (здания, дороги), потом счёт (население, конкуренты), потом выделение и цвет.';
  return implode("\n", $lines);
}

// Тело запроса в формате OpenAI chat completions - его понимают Ollama, vLLM, LM Studio,
// llama.cpp и большинство шлюзов.
function llm_build_request(string $model, string $text, string $lang): array {
  return [
    'model' => $model,
    'messages' => [
      ['role' => 'system', 'content' => llm_system_prompt()],
      ['role' => 'user', 'content' => 'Язык пользователя: ' . $lang . ". Запрос: " . $text],
    ],
    'temperature' => 0,
    'max_tokens' => 400,
    'stream' => false,
  ];
}

function llm_http(string $url, ?array $body, string $key, int $timeout = 40): array {
  $headers = ['Content-Type: application/json'];
  if ($key !== '') $headers[] = 'Authorization: Bearer ' . $key;
  $json = $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE);
  $t0 = microtime(true);
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    $opts = [CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 6];
    if ($json !== null) { $opts[CURLOPT_POST] = true; $opts[CURLOPT_POSTFIELDS] = $json; }
    curl_setopt_array($ch, $opts);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = $raw === false ? curl_error($ch) : '';
    curl_close($ch);
    return ['status' => $status, 'body' => is_string($raw) ? $raw : '', 'error' => $err, 'ms' => (int)round((microtime(true) - $t0) * 1000)];
  }
  if (!ini_get('allow_url_fopen')) return ['status' => 0, 'body' => '', 'error' => 'нет curl и allow_url_fopen', 'ms' => 0];
  $ctx = stream_context_create(['http' => ['method' => $json === null ? 'GET' : 'POST', 'header' => implode("\r\n", $headers), 'content' => $json === null ? '' : $json, 'timeout' => $timeout, 'ignore_errors' => true]]);
  $raw = @file_get_contents($url, false, $ctx);
  $status = 0;
  if (isset($http_response_header[0]) && preg_match('~\s(\d{3})\s~', $http_response_header[0], $m)) $status = (int)$m[1];
  return ['status' => $status, 'body' => is_string($raw) ? $raw : '', 'error' => $raw === false ? 'network' : '', 'ms' => (int)round((microtime(true) - $t0) * 1000)];
}

// Текст ответа модели -> список команд. Принимаем только известные имена и объектный input.
// Модель может обернуть JSON в ```json``` или дописать слова: вырезаем первый массив.
function llm_parse_calls(string $text): array {
  $menu = llm_menu();
  $s = trim($text);
  $a = strpos($s, '['); $b = strrpos($s, ']');
  if ($a === false || $b === false || $b < $a) return [];
  $j = json_decode(substr($s, $a, $b - $a + 1), true);
  if (!is_array($j)) return [];
  $out = [];
  foreach ($j as $c) {
    if (!is_array($c)) continue;
    $n = (string)($c['name'] ?? '');
    if (!isset($menu[$n])) continue;
    $in = $c['input'] ?? [];
    if (!is_array($in)) $in = [];
    // Только простые значения: числа, строки, булевы, массивы чисел/строк. Никаких вложенных
    // структур, которых инструменты не ждут.
    $clean = [];
    foreach ($in as $k => $v) {
      $k = (string)$k;
      if (!preg_match('~^[a-z_]{1,24}$~', $k)) continue;
      if (is_int($v) || is_float($v) || is_bool($v)) $clean[$k] = $v;
      elseif (is_string($v)) $clean[$k] = mb_substr($v, 0, 200);
      elseif (is_array($v)) {
        // Только списки. Объект вида {"a":1} - вложенная структура, которой инструменты не ждут.
        if ($v !== [] && array_keys($v) !== range(0, count($v) - 1)) continue;
        $arr = [];
        foreach ($v as $x) {
          if (is_int($x) || is_float($x)) $arr[] = $x;
          elseif (is_string($x)) $arr[] = mb_substr($x, 0, 60);
          elseif (is_array($x) && count($x) === 2 && is_numeric($x[0] ?? null) && is_numeric($x[1] ?? null)) $arr[] = [(float)$x[0], (float)$x[1]];
          if (count($arr) >= 200) break;
        }
        $clean[$k] = $arr;
      }
    }
    $out[] = ['name' => $n, 'input' => $clean];
    if (count($out) >= 8) break;
  }
  return $out;
}

function llm_extract_text(array $j): string {
  $t = $j['choices'][0]['message']['content'] ?? ($j['choices'][0]['text'] ?? '');
  return is_string($t) ? $t : '';
}

// Перевод фразы в команды. Возвращает ['ok'=>bool, 'calls'=>[], 'error'=>string].
function llm_translate(array $cfg, string $text, string $lang): array {
  $c = llm_config($cfg);
  if (!$c['configured']) return ['ok' => false, 'calls' => [], 'error' => 'not_configured'];
  $r = llm_http($c['endpoint'] . '/chat/completions', llm_build_request($c['model'], $text, $lang), $c['key']);
  if ($r['status'] !== 200) return ['ok' => false, 'calls' => [], 'error' => $r['status'] === 0 ? ('модель недоступна' . ($r['error'] !== '' ? ': ' . $r['error'] : '')) : ('модель ответила кодом ' . $r['status'])];
  $j = json_decode($r['body'], true);
  if (!is_array($j)) return ['ok' => false, 'calls' => [], 'error' => 'модель ответила не JSON'];
  return ['ok' => true, 'calls' => llm_parse_calls(llm_extract_text($j)), 'error' => '', 'ms' => $r['ms']];
}

// Проверка связи: настроенный эндпоинт (GET /models) и, отдельно, локальная Ollama на
// стандартном порту, даже если она не настроена в config.php. Панель хостинга показывает
// «Ollama (local)» в списке провайдеров, и это единственный способ узнать, стоит ли она
// на самом сервере.
function llm_probe(array $cfg): array {
  $c = llm_config($cfg);
  $out = ['configured' => $c['configured'], 'endpoint' => $c['endpoint'], 'model' => $c['model'], 'status' => null, 'ms' => 0, 'error' => '', 'ollama_local' => false, 'ollama_models' => ''];
  if ($c['configured']) {
    $r = llm_http($c['endpoint'] . '/models', null, $c['key'], 8);
    $out['status'] = $r['status']; $out['ms'] = $r['ms']; $out['error'] = $r['error'];
  }
  $o = llm_http('http://127.0.0.1:11434/api/tags', null, '', 3);
  if ($o['status'] === 200) {
    $out['ollama_local'] = true;
    $j = json_decode($o['body'], true);
    $names = [];
    foreach ((array)($j['models'] ?? []) as $m) if (is_array($m) && isset($m['name'])) $names[] = (string)$m['name'];
    $out['ollama_models'] = implode(', ', array_slice($names, 0, 8));
  }
  return $out;
}
