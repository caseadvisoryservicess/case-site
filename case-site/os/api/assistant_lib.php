<?php
// CASE OS v4.72.0 - гео-ассистент: сборка запроса к модели и разбор ответа.
//
// Правило, ради которого этот файл написан так, а не иначе: МОДЕЛЬ ПИШЕТ ТЕКСТ, НО НЕ
// ВЫДУМЫВАЕТ ЧИСЛО. Население в радиусе, число зданий, длина дорог - всё это считают
// детерминированные инструменты в браузере, на данных, у которых есть происхождение.
// Модель только решает, какой инструмент вызвать, и пересказывает результат. Ассистент
// Aino отвечает «в радиусе 1 км живёт 48 000 человек», и никто не знает, откуда цифра.
// У CASE каждая цифра приходит с источником, методом и датой, потому что её дал не
// языковой оракул, а функция с известной формулой.
//
// Здесь только чистые функции: определения инструментов, системная подсказка, сборка тела
// запроса, HTTP и разбор ответа. assistant.php их вызывает; тест v4720_assistant_api.php
// вызывает их же без сессии и базы.
//
// Модель вызывается сырым HTTP, а не официальным PHP SDK, по внешней причине: SDK требует
// PHP 8.1 и composer, а боевой хостинг работает на PHP 7.2 (HANDOFF, 27.07.2026) и
// разворачивается копированием папки. Тем же способом платформа уже ходит в Overpass и
// OSRM (gis_proxy.php).
//
// Синтаксис PHP 7.2: без стрелочных функций, оператора присваивания через null-coalescing, типизированных свойств и запятой после
// последнего аргумента вызова.
declare(strict_types=1);

function assistant_api_url(): string { return 'https://api.anthropic.com/v1/messages'; }
function assistant_api_version(): string { return '2023-06-01'; }
function assistant_default_model(): string { return 'claude-opus-5'; }

// Инструменты. Это ЕДИНСТВЕННОЕ место, где они перечислены: клиент получает список отсюда
// (GET assistant.php?mode=tools) и исполняет ровно то, что здесь описано. Второй список в
// JavaScript разошёлся бы с этим при первой же правке.
//
// Описания написаны как условия вызова, а не как справка: модель решает по ним, ЗВАТЬ ли
// инструмент, и «когда пользователь просит...» работает лучше, чем «возвращает...».
function assistant_tools(): array {
  $hex = ['type'=>'string', 'description'=>'Цвет в формате #rrggbb. Только если пользователь попросил цвет.'];
  return [
    [
      'name' => 'set_site',
      'description' => 'Задать точку участка (сайт). Вызывать, когда пользователь называет координаты, адрес из списка проектов или говорит «эта точка», «здесь». Без участка остальные инструменты не имеют смысла. Если координат нет и проект не назван, не вызывать, а спросить.',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'properties'=>[
        'lat' => ['type'=>'number', 'description'=>'Широта в градусах (Ташкент ~41.3)'],
        'lon' => ['type'=>'number', 'description'=>'Долгота в градусах (Ташкент ~69.3)'],
        'project_id' => ['type'=>'string', 'description'=>'Идентификатор проекта из списка в контексте; тогда lat/lon не нужны'],
        'name' => ['type'=>'string', 'description'=>'Как назвать участок на карте']
      ]]
    ],
    [
      'name' => 'draw_radius',
      'description' => 'Нарисовать круг(и) заданного радиуса вокруг участка. Вызывать при словах «радиус», «круг», «зона N км/м». Несколько радиусов передавать одним вызовом.',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['radii_m'], 'properties'=>[
        'radii_m' => ['type'=>'array', 'items'=>['type'=>'integer'], 'description'=>'Радиусы в метрах, например [500, 1000]'],
        'color' => $hex
      ]]
    ],
    [
      'name' => 'draw_isochrone',
      'description' => 'Нарисовать зону доступности на автомобиле за N минут по дорогам (изохрону). Вызывать при словах «за 10 минут», «доехать», «время в пути». Требует внешнего маршрутизатора: если он недоступен, инструмент честно вернёт ошибку, и тогда предложить радиус.',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['minutes'], 'properties'=>[
        'minutes' => ['type'=>'integer', 'description'=>'Минуты езды: 5, 10, 15, 20 или 30'],
        'color' => $hex
      ]]
    ],
    [
      'name' => 'count_population',
      'description' => 'Посчитать жителей в радиусе от участка по сетке населения. Вызывать при словах «население», «сколько людей живёт», «жителей». Результат содержит уверенность и метод: пересказывать число ТОЛЬКО с ними, не округлять в уверенную сторону.',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['radius_m'], 'properties'=>[
        'radius_m' => ['type'=>'integer', 'description'=>'Радиус в метрах, до 3000']
      ]]
    ],
    [
      'name' => 'load_buildings',
      'description' => 'Загрузить и показать здания OpenStreetMap в радиусе от участка: контуры, этажность, тип, площадь застройки. Вызывать при словах «здания», «застройка», «дома», «выдели здания».',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['radius_m'], 'properties'=>[
        'radius_m' => ['type'=>'integer', 'description'=>'Радиус в метрах, до 3000'],
        'color' => $hex
      ]]
    ],
    [
      'name' => 'load_roads',
      'description' => 'Загрузить и показать дороги OpenStreetMap в радиусе от участка. Вызывать при словах «дороги», «улицы», «магистрали», «подъезд». Классы: motorway, trunk, primary, secondary, tertiary, residential и др.; «только магистрали» = primary и выше.',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['radius_m'], 'properties'=>[
        'radius_m' => ['type'=>'integer', 'description'=>'Радиус в метрах, до 3000'],
        'classes' => ['type'=>'array', 'items'=>['type'=>'string'], 'description'=>'Классы дорог OSM; пусто = все проезжие'],
        'color' => $hex
      ]]
    ],
    [
      'name' => 'style_layer',
      'description' => 'Изменить цвет, заливку, прозрачность или толщину уже показанного слоя. Вызывать при словах «покрась», «сделай красным», «прозрачнее», «толще». Слой должен быть уже загружен.',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['layer'], 'properties'=>[
        'layer' => ['type'=>'string', 'enum'=>['buildings','roads','radius','isochrone','selection'], 'description'=>'Какой слой'],
        'color' => $hex,
        'fill_color' => $hex,
        'opacity' => ['type'=>'number', 'description'=>'Прозрачность заливки 0..1'],
        'weight' => ['type'=>'number', 'description'=>'Толщина линии в пикселях']
      ]]
    ],
    [
      'name' => 'select_features',
      'description' => 'Выделить часть уже загруженных зданий или дорог по условию и подсветить их. Вызывать при словах «выдели», «покажи только», «дома выше 9 этажей», «только жилые», «улица такая-то».',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['layer'], 'properties'=>[
        'layer' => ['type'=>'string', 'enum'=>['buildings','roads']],
        'min_levels' => ['type'=>'integer', 'description'=>'Здания: минимальная этажность'],
        'max_levels' => ['type'=>'integer', 'description'=>'Здания: максимальная этажность'],
        'kind' => ['type'=>'string', 'description'=>'Здания: тип OSM (residential, apartments, commercial, retail, industrial, house...)'],
        'classes' => ['type'=>'array', 'items'=>['type'=>'string'], 'description'=>'Дороги: классы highway'],
        'name_contains' => ['type'=>'string', 'description'=>'Подстрока в названии'],
        'color' => $hex
      ]]
    ],
    [
      'name' => 'count_competitors',
      'description' => 'Посчитать конкурирующие объекты в радиусе из базы CASE (бизнес-центры) и загруженных городских слоёв. Вызывать при словах «конкуренты», «сколько БЦ рядом», «торговые центры рядом».',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'required'=>['radius_m'], 'properties'=>[
        'radius_m' => ['type'=>'integer', 'description'=>'Радиус в метрах, до 3000']
      ]]
    ],
    [
      'name' => 'clear_layers',
      'description' => 'Убрать слои ассистента с карты. Вызывать при словах «очисти», «убери», «сбрось».',
      'input_schema' => ['type'=>'object', 'additionalProperties'=>false, 'properties'=>[
        'layers' => ['type'=>'array', 'items'=>['type'=>'string', 'enum'=>['buildings','roads','radius','isochrone','selection','all']], 'description'=>'Какие слои; пусто = все']
      ]]
    ]
  ];
}

function assistant_tool_names(): array {
  $out = [];
  foreach (assistant_tools() as $t) $out[] = $t['name'];
  return $out;
}

// Системная подсказка. Стабильная часть без дат и без данных пользователя: она кэшируется
// на стороне API (cache_control), и любой изменчивый байт в ней ломал бы кэш на каждом
// запросе. Всё изменчивое (участок, проекты, язык) уходит отдельным блоком ниже.
function assistant_system_stable(): string {
  return implode("\n", [
    'Ты - гео-ассистент CASE OS, платформы консалтинговой компании CASE Advisory (Ташкент, коммерческая недвижимость).',
    'Пользователь смотрит на карту и просит проанализировать участок: радиусы, население, здания, дороги, конкуренты, изохроны, цвета слоёв.',
    '',
    'Главное правило: ты не источник чисел. Любое число (жителей, зданий, метров, площади) берётся ТОЛЬКО из результата инструмента и повторяется без изменений, вместе с уверенностью и методом, которые инструмент вернул.',
    'Если инструмент не вызывался, числа не называть. Если инструмент вернул ошибку, сказать об этом прямо и предложить замену (например, радиус вместо изохроны).',
    '',
    'Порядок работы: 1) убедись, что участок задан (set_site), иначе спроси; 2) вызови нужные инструменты, при необходимости несколько сразу; 3) коротко перескажи результат: цифра, уверенность, метод, что видно на карте.',
    'Уверенность результата: verified = проверено на месте или документом; asking = наблюдённые открытые данные (OSM), полнота не проверена; modelled = расчёт по модели. Никогда не выдавай modelled или asking за проверенное.',
    '',
    'Стиль: отвечай на языке пользователя (русский, узбекский или английский), 2-5 предложений, без вступлений, без маркетинга. Не используй длинное тире, только дефис.',
    'Если просят изменить цвет, используй style_layer или параметр color; цвета передавай как #rrggbb.',
    'Если просят что-то вне карты и данных (юридический совет, прогноз выручки, цены), скажи, что это вне зоны ассистента, и не выдумывай.'
  ]);
}

// Изменчивый блок: участок, проекты, язык. Короткий, без ключей и личных данных.
function assistant_system_context(?array $site, array $projects, string $lang): string {
  $lines = [];
  $lines[] = 'Язык интерфейса пользователя: ' . ($lang !== '' ? $lang : 'ru') . '.';
  if ($site && isset($site['lat'], $site['lon'])) {
    $lines[] = sprintf('Текущий участок: %s (%.5f, %.5f).', (string)($site['name'] ?? 'без названия'), (float)$site['lat'], (float)$site['lon']);
  } else {
    $lines[] = 'Участок пока не задан.';
  }
  if ($projects) {
    $rows = [];
    foreach (array_slice($projects, 0, 40) as $p) {
      if (!is_array($p) || !isset($p['id'])) continue;
      $rows[] = sprintf('%s = %s (%.5f, %.5f)', (string)$p['id'], mb_substr((string)($p['name'] ?? ''), 0, 60), (float)($p['lat'] ?? 0), (float)($p['lng'] ?? ($p['lon'] ?? 0)));
    }
    if ($rows) $lines[] = 'Проекты CASE, которые можно задать через set_site(project_id): ' . implode('; ', $rows) . '.';
  }
  return implode("\n", $lines);
}

// Проверка истории переписки, присланной клиентом. Клиент хранит транскрипт сам (сервер без
// состояния), значит любая его часть могла быть подделана в DevTools. Пропускаем только
// роли user/assistant и блоки text/tool_use/tool_result с известными именами инструментов;
// всё остальное выбрасывается, а не «пробрасывается как есть».
function assistant_clean_messages($messages, int $maxMessages = 40, int $maxBytes = 300000): array {
  if (!is_array($messages)) throw new InvalidArgumentException('messages должен быть массивом');
  $names = array_flip(assistant_tool_names());
  $out = [];
  $bytes = 0;
  foreach ($messages as $m) {
    if (!is_array($m)) continue;
    $role = (string)($m['role'] ?? '');
    if ($role !== 'user' && $role !== 'assistant') continue;
    $content = $m['content'] ?? '';
    if (is_string($content)) {
      $content = mb_substr($content, 0, 8000);
      $blocks = [['type'=>'text', 'text'=>$content]];
    } elseif (is_array($content)) {
      $blocks = [];
      foreach ($content as $b) {
        if (!is_array($b)) continue;
        $t = (string)($b['type'] ?? '');
        if ($t === 'text') {
          $blocks[] = ['type'=>'text', 'text'=>mb_substr((string)($b['text'] ?? ''), 0, 8000)];
        } elseif ($t === 'tool_use' && $role === 'assistant') {
          $n = (string)($b['name'] ?? '');
          if (!isset($names[$n])) continue;
          $blocks[] = ['type'=>'tool_use', 'id'=>mb_substr((string)($b['id'] ?? ''), 0, 80), 'name'=>$n, 'input'=>is_array($b['input'] ?? null) ? $b['input'] : new stdClass()];
        } elseif ($t === 'tool_result' && $role === 'user') {
          $c = $b['content'] ?? '';
          if (!is_string($c)) $c = json_encode($c, JSON_UNESCAPED_UNICODE);
          $row = ['type'=>'tool_result', 'tool_use_id'=>mb_substr((string)($b['tool_use_id'] ?? ''), 0, 80), 'content'=>mb_substr((string)$c, 0, 20000)];
          if (!empty($b['is_error'])) $row['is_error'] = true;
          $blocks[] = $row;
        }
      }
    } else {
      continue;
    }
    if (!$blocks) continue;
    $row = ['role'=>$role, 'content'=>$blocks];
    $bytes += strlen(json_encode($row, JSON_UNESCAPED_UNICODE));
    if ($bytes > $maxBytes) throw new InvalidArgumentException('История переписки слишком длинная, начните новый диалог');
    $out[] = $row;
  }
  if (!$out) throw new InvalidArgumentException('Пустой запрос');
  if (count($out) > $maxMessages) $out = array_slice($out, -$maxMessages);
  // Диалог обязан начинаться с user и чередоваться: иначе API вернёт 400 с непонятным текстом.
  while ($out && $out[0]['role'] !== 'user') array_shift($out);
  if (!$out) throw new InvalidArgumentException('Диалог должен начинаться с сообщения пользователя');
  return $out;
}

// Тело запроса. Кэшируемая часть (инструменты + стабильная подсказка) стоит первой и
// помечена cache_control; изменчивый контекст идёт вторым блоком system без пометки.
function assistant_build_request(array $messages, ?array $site, array $projects, string $lang, string $model): array {
  return [
    'model' => $model !== '' ? $model : assistant_default_model(),
    // Ответы короткие: 2-5 предложений плюс вызовы инструментов. 4096 хватает с запасом,
    // а меньший потолок оборвал бы ответ с несколькими вызовами на середине.
    'max_tokens' => 4096,
    'system' => [
      ['type'=>'text', 'text'=>assistant_system_stable(), 'cache_control'=>['type'=>'ephemeral']],
      ['type'=>'text', 'text'=>assistant_system_context($site, $projects, $lang)]
    ],
    'tools' => assistant_tools(),
    'tool_choice' => ['type'=>'auto'],
    // Маршрутизация по инструментам и короткий пересказ: глубокие размышления здесь не
    // нужны, а стоят денег и секунд. Опус 5 думает адаптивно сам; effort задаёт глубину.
    'output_config' => ['effort'=>'medium'],
    'messages' => $messages
  ];
}

// HTTP к API. curl предпочтительнее: даёт код ответа и таймауты; file_get_contents -
// запасной путь для хостингов без curl. Ключ идёт только в заголовке и никогда в теле
// ответа клиенту.
function assistant_http_post(string $url, array $body, string $apiKey, int $timeout = 90): array {
  $json = json_encode($body, JSON_UNESCAPED_UNICODE);
  if ($json === false) return ['status'=>0, 'json'=>null, 'raw'=>'', 'error'=>'json_encode'];
  $headers = ['Content-Type: application/json', 'x-api-key: ' . $apiKey, 'anthropic-version: ' . assistant_api_version()];
  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_POST => true, CURLOPT_POSTFIELDS => $json, CURLOPT_HTTPHEADER => $headers,
      CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 15
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err = $raw === false ? curl_error($ch) : '';
    curl_close($ch);
    if ($raw === false) return ['status'=>0, 'json'=>null, 'raw'=>'', 'error'=>$err];
  } else {
    $ctx = stream_context_create(['http'=>['method'=>'POST', 'header'=>implode("\r\n", $headers), 'content'=>$json, 'timeout'=>$timeout, 'ignore_errors'=>true]]);
    $raw = @file_get_contents($url, false, $ctx);
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('~\s(\d{3})\s~', $http_response_header[0], $m)) $status = (int)$m[1];
    if ($raw === false) return ['status'=>0, 'json'=>null, 'raw'=>'', 'error'=>'network'];
  }
  $j = json_decode((string)$raw, true);
  return ['status'=>$status, 'json'=>is_array($j) ? $j : null, 'raw'=>(string)$raw, 'error'=>''];
}

// Ответ API -> то, что уходит клиенту. Отдаём только блоки text и tool_use: thinking и
// прочее клиенту не нужно, а в истории переписки этих блоков потом не будет, значит и
// возвращать их в API незачем.
function assistant_parse_response(array $j): array {
  $blocks = [];
  foreach ((array)($j['content'] ?? []) as $b) {
    if (!is_array($b)) continue;
    $t = (string)($b['type'] ?? '');
    if ($t === 'text') $blocks[] = ['type'=>'text', 'text'=>(string)($b['text'] ?? '')];
    elseif ($t === 'tool_use') $blocks[] = ['type'=>'tool_use', 'id'=>(string)($b['id'] ?? ''), 'name'=>(string)($b['name'] ?? ''), 'input'=>is_array($b['input'] ?? null) ? $b['input'] : []];
  }
  $usage = is_array($j['usage'] ?? null) ? $j['usage'] : [];
  return [
    'content' => $blocks,
    'stop_reason' => (string)($j['stop_reason'] ?? ''),
    'model' => (string)($j['model'] ?? ''),
    'usage' => [
      'input' => (int)($usage['input_tokens'] ?? 0),
      'output' => (int)($usage['output_tokens'] ?? 0),
      'cache_read' => (int)($usage['cache_read_input_tokens'] ?? 0)
    ]
  ];
}

// Текст ошибки для пользователя по коду API. Тело ошибки API наружу не отдаём целиком:
// в нём бывают подробности о ключе и организации.
function assistant_error_text(int $status, ?array $j): string {
  $type = is_array($j) && isset($j['error']['type']) ? (string)$j['error']['type'] : '';
  if ($status === 401) return 'Ключ API не принят. Проверьте anthropic_api_key в os/api/config.php.';
  if ($status === 429) return 'Лимит запросов к модели исчерпан, повторите через минуту.';
  if ($status === 529 || $type === 'overloaded_error') return 'Модель перегружена, повторите через минуту.';
  if ($status === 400) return 'Модель отклонила запрос (400' . ($type !== '' ? ', ' . $type : '') . '). Начните новый диалог.';
  if ($status === 0) return 'Сервер не смог соединиться с api.anthropic.com (сеть или таймаут).';
  return 'Ошибка модели (HTTP ' . $status . ($type !== '' ? ', ' . $type : '') . ').';
}
