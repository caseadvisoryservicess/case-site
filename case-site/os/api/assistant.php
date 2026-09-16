<?php
// CASE OS v4.72.0 - гео-ассистент: прокси к модели.
//
// Клиент держит переписку у себя и на каждый ход присылает её целиком; сервер без
// состояния: проверяет сессию, чистит историю, добавляет ключ и подсказку, вызывает
// модель, отдаёт ответ. Инструменты исполняются в браузере (там живёт карта), поэтому цикл
// «модель просит инструмент - клиент исполняет - модель продолжает» крутится с клиента.
//
// Ключ API лежит в config.php и никогда не попадает ни в ответ, ни в клиентский код.
// GET ?mode=tools отдаёт список инструментов: клиент берёт его отсюда, чтобы не держать
// второй список, который разошёлся бы с серверным при первой правке.
require __DIR__.'/lib.php';
require __DIR__.'/assistant_lib.php';
$u = require_login();

$mode = (string)($_GET['mode'] ?? '');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
  if ($mode === 'tools') json_out(['ok'=>true, 'tools'=>assistant_tools()]);
  if ($mode === 'status') {
    $c = cfg();
    $key = trim((string)($c['anthropic_api_key'] ?? ''));
    json_out(['ok'=>true, 'configured'=>$key !== '', 'model'=>(string)($c['assistant_model'] ?? assistant_default_model())]);
  }
  fail('Метод не поддерживается', 405);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Метод не поддерживается', 405);

$b = body();
$c = cfg();
$key = trim((string)($c['anthropic_api_key'] ?? ''));
// Без ключа ассистент не ломается: клиент переходит на локальный разбор команд и говорит
// об этом. needs_key - тот же приём, что у gis_proxy.php для внешних маршрутизаторов.
if ($key === '') json_out(['ok'=>false, 'needs_key'=>'anthropic_api_key', 'message'=>'Ассистент с моделью не настроен: добавьте anthropic_api_key в os/api/config.php. Команды на карте работают и без него.']);

// Ограничение частоты на сессию. Каждый ход стоит денег, а кнопку можно зажать.
$now = time();
$win = isset($_SESSION['asst_win']) && is_array($_SESSION['asst_win']) ? $_SESSION['asst_win'] : [];
$win = array_values(array_filter($win, function ($t) use ($now) { return is_int($t) && $t > $now - 600; }));
if (count($win) >= 40) fail('Слишком много запросов к ассистенту: не больше 40 за 10 минут', 429);
$win[] = $now;
$_SESSION['asst_win'] = $win;

try {
  $messages = assistant_clean_messages($b['messages'] ?? null);
} catch (InvalidArgumentException $e) {
  fail($e->getMessage(), 400);
}
$site = is_array($b['site'] ?? null) ? $b['site'] : null;
if ($site !== null) {
  if (!isset($site['lat'], $site['lon']) || !is_numeric($site['lat']) || !is_numeric($site['lon'])) $site = null;
  else $site = ['lat'=>(float)$site['lat'], 'lon'=>(float)$site['lon'], 'name'=>mb_substr((string)($site['name'] ?? ''), 0, 80)];
}
$projects = [];
foreach ((array)($b['projects'] ?? []) as $p) {
  if (!is_array($p) || !isset($p['id'])) continue;
  $projects[] = ['id'=>mb_substr((string)$p['id'], 0, 40), 'name'=>mb_substr((string)($p['name'] ?? ''), 0, 60), 'lat'=>(float)($p['lat'] ?? 0), 'lng'=>(float)($p['lng'] ?? ($p['lon'] ?? 0))];
  if (count($projects) >= 40) break;
}
$lang = in_array((string)($b['lang'] ?? 'ru'), ['ru','uz','en'], true) ? (string)$b['lang'] : 'ru';
$model = trim((string)($c['assistant_model'] ?? '')) ?: assistant_default_model();

$req = assistant_build_request($messages, $site, $projects, $lang, $model);
$res = assistant_http_post(assistant_api_url(), $req, $key);
if ($res['status'] !== 200 || !is_array($res['json'])) {
  try { audit('Гео-ассистент: ошибка модели', 'HTTP ' . $res['status']); } catch (Throwable $e) {}
  json_out(['ok'=>false, 'message'=>assistant_error_text((int)$res['status'], $res['json'])]);
}
$out = assistant_parse_response($res['json']);
// Отказ модели или обрыв по длине: вызовы инструментов из такого ответа исполнять нельзя,
// они могли прийти обрезанными. Клиент по stop_reason знает, что делать.
if ($out['stop_reason'] === 'refusal' || $out['stop_reason'] === 'max_tokens') {
  $out['content'] = array_values(array_filter($out['content'], function ($blk) { return $blk['type'] === 'text'; }));
}
try { audit('Гео-ассистент: ход', ($site ? sprintf('%.4f,%.4f', $site['lat'], $site['lon']) : 'без участка') . ' · токены ' . $out['usage']['input'] . '/' . $out['usage']['output']); } catch (Throwable $e) {}
json_out(['ok'=>true] + $out);
