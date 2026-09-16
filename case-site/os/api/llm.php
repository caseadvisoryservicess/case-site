<?php
// CASE OS v4.73.0 - перевод свободной фразы в команды гео-агента через свою модель.
//
// GET, потому что запрос ничего не меняет и приходит из iframe студии, у которого нет
// CSRF-токена. Текст короткий (до 300 символов), ответ - список команд из закрытого меню,
// каждая из которых ещё раз проверяется на клиенте. Без настроенной модели отвечает
// needs_llm, и агент говорит, что фразу не понял. Ключей и внешних платных сервисов нет.
require __DIR__.'/lib.php';
require __DIR__.'/llm_lib.php';
$u = require_login();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') fail('Метод не поддерживается', 405);

$q = mb_substr(trim((string)($_GET['q'] ?? '')), 0, 300);
if ($q === '') fail('q required', 400);
$lang = in_array((string)($_GET['lang'] ?? 'ru'), ['ru','uz','en'], true) ? (string)$_GET['lang'] : 'ru';

$c = llm_config(cfg());
if (!$c['configured']) json_out(['ok'=>false, 'needs_llm'=>true, 'message'=>'Своя модель не настроена (llm_endpoint и llm_model в os/api/config.php). Команды работают и без неё.']);

// Локальная модель бесплатна, но не бесконечна: на общем сервере один ответ может стоить
// секунд процессорного времени. Двадцать фраз за десять минут на сессию.
$now = time();
$win = isset($_SESSION['llm_win']) && is_array($_SESSION['llm_win']) ? $_SESSION['llm_win'] : [];
$win = array_values(array_filter($win, function ($t) use ($now) { return is_int($t) && $t > $now - 600; }));
if (count($win) >= 20) fail('Слишком много запросов к модели: не больше 20 за 10 минут', 429);
$win[] = $now; $_SESSION['llm_win'] = $win;

$r = llm_translate(cfg(), $q, $lang);
try { audit('Гео-агент: своя модель', ($r['ok'] ? count($r['calls']) . ' команд' : 'ошибка: ' . $r['error'])); } catch (Throwable $e) {}
if (!$r['ok']) json_out(['ok'=>false, 'message'=>$r['error']]);
json_out(['ok'=>true, 'calls'=>$r['calls'], 'used'=>'llm', 'model'=>$c['model'], 'ms'=>$r['ms'] ?? 0]);
