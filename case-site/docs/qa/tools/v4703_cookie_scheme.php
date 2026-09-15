<?php
/* Флаг Secure у сессионной cookie: откуда берётся схема.

   До v4.70.3 схема определялась одним $_SERVER['HTTPS']. На хостинге, где TLS
   терминируется на прокси или CDN, а до Apache доходит уже открытый http, эта переменная
   пуста - и cookie сессии caseos уходила без Secure. Браузер в таком случае готов
   отправить её и по http, то есть один незашифрованный запрос к домену отдаёт чужую
   сессию целиком. Внешне всё работает, поэтому дефект и жил.

   Обратная ошибка не менее дорогая: если поставить Secure безусловно, разработка под
   config.local-xampp.php (http://localhost) перестанет логиниться - браузер просто не
   сохранит cookie, и каждый запрос вернёт 401. Поэтому проверяются ОБА направления:
   за прокси флаг должен появиться, на локальном http - остаться снятым.

   Проверяется настоящий код: выражение вырезается из os/api/lib.php и исполняется как
   есть. Копия здесь была бы бесполезна - она осталась бы зелёной после правки lib.php.

   Запуск: php v4703_cookie_scheme.php [папка os] */
declare(strict_types=1);

$OS = $argv[1] ?? dirname(__DIR__, 3) . '/os';

$lib = file_get_contents($OS . '/api/lib.php');
if ($lib === false) { fwrite(STDERR, "!!  не читается {$OS}/api/lib.php\n"); exit(1); }
$start = strpos($lib, '$caseHttps =');
if ($start === false) { fwrite(STDERR, "!!  в lib.php нет присваивания \$caseHttps\n"); exit(1); }
$end = strpos($lib, ";\n", $start);
if ($end === false) { fwrite(STDERR, "!!  не найден конец выражения \$caseHttps\n"); exit(1); }
$EXPR = substr($lib, $start, $end - $start + 1);

$bad = 0;
function ck(string $n, bool $c, string $d = null): void {
  global $bad;
  echo ($c ? 'OK  ' : '!!  ') . $n . ($d === null ? '' : ' - ' . $d) . "\n";
  if (!$c) $bad++;
}

/* Каждый прогон начинается с чистого $_SERVER: иначе заголовок из предыдущего сценария
   протёк бы в следующий и тест показал бы Secure там, где его нет. */
function scheme(array $server): bool {
  global $EXPR;
  $_SERVER = $server;
  $caseHttps = null;
  eval($EXPR);
  return (bool)$caseHttps;
}

/* Флаг обязан ПОЯВИТЬСЯ. */
$secureExpected = [
  'Apache сам держит TLS (HTTPS=on)'            => ['HTTPS'=>'on'],
  'HTTPS=1 - так пишет часть сборок'            => ['HTTPS'=>'1'],
  'HTTPS=On в другом регистре'                  => ['HTTPS'=>'On'],
  'прокси: X-Forwarded-Proto: https'            => ['HTTP_X_FORWARDED_PROTO'=>'https'],
  'прокси: заголовок в верхнем регистре'        => ['HTTP_X_FORWARDED_PROTO'=>'HTTPS'],
  'прокси: пробелы вокруг значения'             => ['HTTP_X_FORWARDED_PROTO'=>'  https '],
  'цепочка прокси: "https, http"'               => ['HTTP_X_FORWARDED_PROTO'=>'https, http'],
  'прокси старого образца: X-Forwarded-SSL: on' => ['HTTP_X_FORWARDED_SSL'=>'on'],
  'X-Forwarded-SSL: ON'                         => ['HTTP_X_FORWARDED_SSL'=>'ON'],
  'порт 443 без прочих признаков'               => ['SERVER_PORT'=>'443'],
  'порт 443 числом, не строкой'                 => ['SERVER_PORT'=>443],
];
foreach ($secureExpected as $name => $srv) ck('Secure выставлен: ' . $name, scheme($srv) === true);

/* Флаг обязан ОСТАТЬСЯ СНЯТЫМ: здесь цена ошибки - неработающий вход, а не утечка. */
$plainExpected = [
  'локальная разработка XAMPP, http://localhost' => ['HTTPS'=>'', 'SERVER_PORT'=>'80', 'HTTP_HOST'=>'localhost'],
  'HTTPS=off - так отдаёт IIS и часть Apache'    => ['HTTPS'=>'off'],
  'HTTPS=OFF в верхнем регистре'                 => ['HTTPS'=>'OFF'],
  'чистый http, порт 80'                         => ['SERVER_PORT'=>'80'],
  'нестандартный порт разработки 8080'           => ['SERVER_PORT'=>'8080'],
  'прокси честно сообщает http'                  => ['HTTP_X_FORWARDED_PROTO'=>'http'],
  'цепочка прокси: "http, https"'                => ['HTTP_X_FORWARDED_PROTO'=>'http, https'],
  'X-Forwarded-SSL: off'                         => ['HTTP_X_FORWARDED_SSL'=>'off'],
  'пустой $_SERVER (запуск из CLI)'              => [],
];
foreach ($plainExpected as $name => $srv) ck('Secure не выставлен: ' . $name, scheme($srv) === false);

/* Сочетание, ради которого всё затевалось: Apache видит обычный http на 80 порту, и
   единственный признак TLS - заголовок от прокси. Это ровно рабочий хостинг. */
ck('боевой хостинг: http на 80 порту + X-Forwarded-Proto: https',
   scheme(['HTTPS'=>'', 'SERVER_PORT'=>'80', 'HTTP_X_FORWARDED_PROTO'=>'https',
           'HTTP_HOST'=>'caseadvisory.uz']) === true);

/* Флаг не должен зависеть от того, что прислал клиент поверх настоящего TLS: если
   Apache сам держит TLS, заголовок с "http" не имеет права снять Secure. */
ck('подделанный X-Forwarded-Proto: http не снимает Secure при настоящем TLS',
   scheme(['HTTPS'=>'on', 'HTTP_X_FORWARDED_PROTO'=>'http']) === true);

/* Остальные параметры cookie задаются рядом и защищают ту же сессию: без httponly
   значение читается скриптом, без SameSite уходит с чужого сайта. Проверяем, что правка
   схемы не задела соседние ключи. */
$params = [];
if (preg_match('/session_set_cookie_params\(\[(.*?)\]\);/s', $lib, $m)) $params = $m[1];
ck('cookie остаётся httponly', is_string($params) && preg_match("/'httponly'\s*=>\s*true/", $params) === 1);
ck('cookie остаётся SameSite=Lax', is_string($params) && preg_match("/'samesite'\s*=>\s*'Lax'/", $params) === 1);
ck('флаг secure берётся из вычисленной схемы, а не из литерала',
   is_string($params) && preg_match("/'secure'\s*=>\s*\\\$caseHttps/", $params) === 1);

echo "\n" . ($bad ? "ПРОВАЛЕНО проверок: {$bad}\n" : "Схема для флага Secure определяется верно\n");
exit($bad ? 1 : 0);
