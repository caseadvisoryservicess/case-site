<?php
// CASE OS — ядро бэкенда (подключение к БД, сессии, права, реестр таблиц).
declare(strict_types=1);
// Лимит памяти PHP: сохранение общего состояния с гео-мастербазой (тысячи объектов)
// требует несколько json_encode/decode подряд и упирается в дефолтные 128 МБ (fatal на
// geo_state.php:214). .htaccess/.user.ini на части хостингов игнорируются, поэтому
// поднимаем лимит прямо в рантайме — надёжнее всего. Если хостинг запрещает — тихо игнор.
@ini_set('memory_limit', '512M');
// В проде не выводим ошибки PHP в тело ответа (утечка путей вида /home/.../public_html/...
// и порча JSON), пишем их в лог сервера. API отдаёт понятный JSON, а не HTML-fatal.
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');
if (function_exists('mb_internal_encoding')) mb_internal_encoding('UTF-8');
if (!function_exists('mb_strtolower')) { function mb_strtolower($s, $encoding=null) { return strtolower((string)$s); } }

// ── Сессия ────────────────────────────────────────────────────────────
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
// v4.44: 12 часов вместо 1 часа — сессия жила меньше рабочего дня: сотрудник отходил на
// обед/встречу, сессия умирала, и все сохранения (ЛСР, гео) молча падали с 401 —
// «данные не сохраняются». Клиент дополнительно держит сессию keepalive-пингом.
ini_set('session.gc_maxlifetime', '43200');
// v4.70.3: схема бралась только из $_SERVER['HTTPS']. Если TLS терминируется на прокси
// или CDN перед Apache, эта переменная до PHP не доходит, и сессионная cookie уходит без
// Secure по открытому http. Тот же учёт X-Forwarded-Proto уже сделан в правиле
// переадресации домена (hosting/caseadvisory.uz/.htaccess) - держим PHP и Apache в одной
// логике. Заголовок берём первым значением из списка: за цепочкой прокси там «https, http».
$caseHttps = (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off')
  || (isset($_SERVER['HTTP_X_FORWARDED_PROTO'])
      && strtolower(trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_PROTO'])[0])) === 'https')
  || (isset($_SERVER['HTTP_X_FORWARDED_SSL'])
      && strtolower((string)$_SERVER['HTTP_X_FORWARDED_SSL']) === 'on')
  || ((int)($_SERVER['SERVER_PORT'] ?? 0) === 443);
// Жёстко true ставить нельзя: config.local-xampp.php - рабочий конфиг под http://localhost,
// и при безусловном Secure браузер не сохранит cookie, а разработка получит вечный 401.
session_set_cookie_params([
  'lifetime'=>43200,
  'path'=>'/',
  'httponly'=>true,
  'samesite'=>'Lax',
  'secure'=>$caseHttps
]);
session_name('caseos');
session_start();

// ── Конфиг + подключение ──────────────────────────────────────────────
function cfg(): array {
  $f = __DIR__.'/config.php';
  return is_file($f) ? require $f : require __DIR__.'/config.sample.php';
}
function db(): PDO {
  static $pdo = null;
  if ($pdo) return $pdo;
  $c = cfg();
  if (($c['driver'] ?? 'mysql') === 'sqlite') {
    $pdo = new PDO('sqlite:'.$c['sqlite_path']);
    $pdo->exec('PRAGMA foreign_keys=ON');
  } else {
    $dsn = "mysql:host={$c['host']};dbname={$c['name']};charset=".($c['charset']??'utf8mb4');
    $pdo = new PDO($dsn, $c['user'], $c['pass']);
  }
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  return $pdo;
}

// ── Ответы ────────────────────────────────────────────────────────────
function json_out($data, int $code=200): void {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store, no-cache, must-revalidate');
  header('X-Content-Type-Options: nosniff');
  header('X-Frame-Options: SAMEORIGIN');
  header('Referrer-Policy: same-origin');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function fail(string $msg, int $code=400): void { json_out(['error'=>$msg], $code); }
function body(): array {
  $len = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
  if ($len > json_body_limit_bytes()) fail('Слишком большой запрос JSON', 413);
  $raw = file_get_contents('php://input');
  if (strlen($raw) > json_body_limit_bytes()) fail('Слишком большой запрос JSON', 413);
  $j = json_decode($raw ?: '[]', true);
  if (json_last_error() !== JSON_ERROR_NONE) fail('Некорректный JSON: '.json_last_error_msg(), 400);
  if (!is_array($j)) fail('JSON должен быть объектом', 400);
  require_valid_csrf($j);
  unset($j['_csrf']);
  return $j;
}
function uuid(): string {
  $d = random_bytes(16); $d[6]=chr((ord($d[6])&0x0f)|0x40); $d[8]=chr((ord($d[8])&0x3f)|0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d),4));
}

function same_host(?string $url): bool {
  if (!$url) return true;
  $h = parse_url($url, PHP_URL_HOST);
  $current = preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? ''));
  return !$h || strcasecmp($h, $current) === 0;
}
function require_same_origin_for_write(): void {
  $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if (!in_array($m, ['POST','PUT','PATCH','DELETE'], true)) return;
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  $referer = $_SERVER['HTTP_REFERER'] ?? '';
  if ($origin && !same_host($origin)) fail('Запрос отклонён: другой origin', 403);
  if (!$origin && $referer && !same_host($referer)) fail('Запрос отклонён: другой referer', 403);
}
function json_body_limit_bytes(): int { return 40 * 1024 * 1024; } /* 40 МБ: вмещает состояние с чертежами/презентациями до ~30 МБ (запас на прочие ключи). Требует post_max_size ≥ 48M на хостинге (см. api/.htaccess). */
function csrf_token(): string {
  if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
  }
  return $_SESSION['csrf_token'];
}
function require_valid_csrf(array $payload=[]): void {
  $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if (!in_array($m, ['POST','PUT','PATCH','DELETE'], true)) return;
  require_same_origin_for_write();
  $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($payload['_csrf'] ?? '');
  if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
    fail('Сессия устарела или запрос заблокирован. Обновите страницу и повторите действие.', 403);
  }
}


// ── Текущий пользователь и права ──────────────────────────────────────
// v4.76.0: тип доступа (сотрудник, клиент, демо), срок подписки и личные настройки пользователя.
// Колонки дочиниваются сами при первом обращении, миграция os/sql/migrations/2026_09_17_v4760_access.sql
// делает то же самое явно. Без колонок вход не ломается: тип «сотрудник», без срока.
function ensure_user_profile_columns(): void {
  static $done = false; if ($done) return; $done = true;
  foreach (['user_type'=>"VARCHAR(16) NOT NULL DEFAULT 'employee'", 'expires_at'=>'DATETIME NULL', 'settings'=>'TEXT NULL'] as $col=>$def) {
    try { db()->exec('ALTER TABLE app_users ADD COLUMN '.$col.' '.$def); } catch (Throwable $e) {}
  }
}
function current_user(): ?array {
  if (empty($_SESSION['uid'])) return null;
  static $u = null;
  if ($u && $u['id']===$_SESSION['uid']) return $u;
  $full = 'SELECT u.id,u.email,u.name,u.title,u.role_key,u.broker_name,u.projects,u.active,u.user_type,u.expires_at,u.settings,
        r.label AS role_label,r.leasing,r.finance,r.edit,r.approve,r.plans,r.own_only,r.project_scope,r.admin
      FROM app_users u JOIN roles r ON r.`key`=u.role_key WHERE u.id=?';
  try {
    try { $st = db()->prepare($full); $st->execute([$_SESSION['uid']]); }
    catch (Throwable $e0) { ensure_user_profile_columns(); $st = db()->prepare($full); $st->execute([$_SESSION['uid']]); }
    $u = $st->fetch() ?: null;
  } catch (Throwable $e) {
    // старая схема БД (миграции ещё не применены) — работаем без project_scope/projects,
    // чтобы обновление файлов платформы не блокировало вход до применения миграций.
    $st = db()->prepare('SELECT u.id,u.email,u.name,u.title,u.role_key,u.broker_name,u.active,
        r.label AS role_label,r.leasing,r.finance,r.edit,r.approve,r.plans,r.own_only,r.admin
      FROM app_users u JOIN roles r ON r.`key`=u.role_key WHERE u.id=?');
    $st->execute([$_SESSION['uid']]);
    $u = $st->fetch() ?: null;
    if ($u) { $u['project_scope'] = 0; $u['projects'] = null; }
  }
  if ($u && is_string($u['projects'] ?? null)) $u['projects'] = json_decode($u['projects'], true) ?: [];
  if ($u) { if (!array_key_exists('user_type', $u)) $u['user_type'] = 'employee'; if (!array_key_exists('expires_at', $u)) $u['expires_at'] = null; $u['settings'] = user_settings($u); }
  return $u;
}
function require_login(): array {
  $u = current_user();
  if (!$u || !$u['active']) fail('Не авторизован', 401);
  // v4.76.0: подписка истекла: вход закрыт, данные и учётная запись остаются
  if (subscription_expired($u)) { access_close_session(); fail('Срок доступа истёк. Данные сохранены; продление у администратора CASE.', 403); }
  return $u;
}

// Закрыть сеанс, но оставить клиенту рабочий CSRF-токен: после session_destroy() новый токен
// не сохранился бы, и следующий вход падал бы с «сессия устарела».
function access_close_session(): void {
  $_SESSION = [];
  try { session_regenerate_id(true); } catch (Throwable $e) {}
}
// ── v4.76.0: типы доступа, подписка, настройки пользователя ──────────────
// Администратор: флаг admin роли. Сотрудник: любая внутренняя роль. Клиент: роль CL (только
// просмотр студии; выгрузка и правки включаются администратором в настройках пользователя).
// Демо: роль DEMO, общий демо-пользователь, ничего не сохраняет, видит ограниченные данные.
function user_type(array $u): string {
  if (!empty($u['admin'])) return 'admin';
  $t = (string)($u['user_type'] ?? '');
  if (in_array($t, ['employee','client','demo'], true)) return $t;
  $rk = (string)($u['role_key'] ?? '');
  return $rk === 'CL' ? 'client' : ($rk === 'DEMO' ? 'demo' : 'employee');
}
function is_demo_user(?array $u): bool { return $u ? user_type($u) === 'demo' : false; }
function user_settings(array $u): array {
  $s = $u['settings'] ?? null;
  if (is_string($s)) { $s = json_decode($s, true); }
  return is_array($s) ? $s : [];
}
// Дата окончания хранится днём: доступ действует весь этот день включительно.
function subscription_end_ts(array $u): ?int {
  $e = trim((string)($u['expires_at'] ?? ''));
  if ($e === '' || $e === '0000-00-00' || $e === '0000-00-00 00:00:00') return null;
  $t = strtotime(strlen($e) <= 10 ? $e.' 23:59:59' : $e);
  return $t ? $t : null;
}
function subscription_days_left(array $u): ?int {
  $t = subscription_end_ts($u);
  if ($t === null) return null;
  return (int)floor(($t - time()) / 86400);
}
function subscription_expired(array $u): bool { $d = subscription_days_left($u); return $d !== null && $d < 0; }
// Что можно на клиенте: выгрузка и правки. Сервер проверяет права сам, это подсказка интерфейсу.
function user_caps(array $u): array {
  $t = user_type($u); $s = user_settings($u);
  $export = $t === 'admin' || $t === 'employee' ? (array_key_exists('can_export', $s) ? !empty($s['can_export']) : true) : ($t === 'client' ? !empty($s['can_export']) : false);
  $edit = $t === 'admin' ? true : ($t === 'employee' ? (array_key_exists('can_edit', $s) ? !empty($s['can_edit']) && asaas_geo_can_edit($u) : asaas_geo_can_edit($u)) : ($t === 'client' ? !empty($s['can_edit']) && asaas_geo_can_edit($u) : false));
  $profile = (string)($s['profile'] ?? '');
  if (!in_array($profile, ['office','developer','asset','consulting','leasing','full'], true)) $profile = '';
  return ['type'=>$t, 'demo'=>$t === 'demo', 'export'=>$export, 'edit'=>$edit, 'days_left'=>subscription_days_left($u), 'expires_at'=>$u['expires_at'] ?? null,
    /* v4.77.0: профиль студии (панели под задачу пользователя) и согласие с офертой */
    'profile'=>$profile, 'offer_accepted'=>offer_accepted($u), 'offer_version'=>offer_version()];
}
// ── v4.77.0: публичная оферта и обратная связь ───────────────────────────
// Версия оферты живёт здесь и в os/offer.html; при смене версии пользователи принимают её заново.
function offer_version(): string { $c = cfg(); return (string)($c['offer_version'] ?? '1.0'); }
function offer_accepted(array $u): bool {
  $s = user_settings($u); $a = $s['offer_accepted'] ?? null;
  return is_array($a) && (string)($a['version'] ?? '') === offer_version();
}
function feedback_bot_token(): string { $c = cfg(); return (string)($c['feedback_bot_token'] ?? ''); }
function feedback_ensure_table(): void {
  $driver = (cfg()['driver'] ?? 'mysql') === 'sqlite' ? 'sqlite' : 'mysql';
  try {
    if ($driver === 'sqlite') db()->exec('CREATE TABLE IF NOT EXISTS feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NULL, user_name TEXT NULL, user_email TEXT NULL, channel TEXT NOT NULL DEFAULT \'app\', kind TEXT NOT NULL DEFAULT \'idea\', text TEXT NOT NULL, page TEXT NULL, status TEXT NOT NULL DEFAULT \'new\', reply TEXT NULL, replied_by TEXT NULL, created_at TEXT NOT NULL, updated_at TEXT NULL)');
    else db()->exec('CREATE TABLE IF NOT EXISTS feedback (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id CHAR(36) NULL, user_name VARCHAR(190) NULL, user_email VARCHAR(190) NULL, channel VARCHAR(16) NOT NULL DEFAULT \'app\', kind VARCHAR(16) NOT NULL DEFAULT \'idea\', text TEXT NOT NULL, page VARCHAR(190) NULL, status VARCHAR(16) NOT NULL DEFAULT \'new\', reply TEXT NULL, replied_by VARCHAR(190) NULL, created_at DATETIME NOT NULL, updated_at DATETIME NULL, KEY idx_feedback_status (status), KEY idx_feedback_user (user_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  } catch (Throwable $e) {}
}
function deny_if_demo(): void {
  $u = current_user();
  if ($u && is_demo_user($u)) fail('Демо-доступ: изменения не сохраняются. Полный доступ открывает CASE после регистрации.', 403);
}
// Роли клиента и демо создаются при первой регистрации или демо-входе (и миграцией).
function ensure_access_roles(): void {
  static $done = false; if ($done) return; $done = true;
  $ig = (cfg()['driver'] ?? 'mysql') === 'sqlite' ? 'INSERT OR IGNORE' : 'INSERT IGNORE';
  foreach ([['CL','Клиент (просмотр геоаналитики)'], ['DEMO','Демо-доступ']] as $r) {
    try { db()->prepare($ig.' INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin) VALUES (?,?,0,0,0,0,0,0,0,0)')->execute($r); } catch (Throwable $e) {}
  }
}
function registration_enabled(): bool { $c = cfg(); return !array_key_exists('allow_registration', $c) || !empty($c['allow_registration']); }
function demo_login_enabled(): bool { $c = cfg(); return !array_key_exists('demo_login', $c) || !empty($c['demo_login']); }
function demo_email(): string { $c = cfg(); return (string)($c['demo_email'] ?? 'demo@caseadvisory.local'); }
function can(string $p): bool {
  $u = current_user();
  return $u ? (bool)($u[$p] ?? false) : false;
}
// Единая идентификация владельца записи (P2-04): часть кода (state.php, до этой правки)
// падала на u.name, если broker_name пуст, а own_only/own_private в lib.php - нет. Пользователь
// с пустым broker_name мог из-за этого получать разный набор "своих" записей в разных частях
// API для одних и тех же данных. Теперь и там, и там - один и тот же канонический источник.
function owner_identity(array $u): string {
  $b = trim((string)($u['broker_name'] ?? ''));
  if ($b !== '') return $b;
  return trim((string)($u['name'] ?? ''));
}

// ── Единая серверная модель рабочих областей ──────────────────────────
// Интерфейс скрывает модули по ROLE_WORKSPACES / USER_WORKSPACES. Эти функции
// повторяют ту же логику на сервере, чтобы скрытый модуль нельзя было открыть
// прямым URL или прочитать через API. Используются state.php и geo_master.php.
function asaas_workspace_default_views(): array {
  // CASE OS v4.9.3: roles are recommended templates, never hard technical bans.
  $all = ['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','case_projects','project_workspace','project_layouts','plan_master','leasing_layouts','advisory_pipeline','advisory_proposal_builder','advisory_proposals','advisory_portfolio_map','advisory_contracts','advisory_scope','advisory_delivery','advisory_reports','advisory_cross_sell','document_templates','project_handover','project_contracts','docs',
    'advisory_research','advisory_concept','advisory_area','plans','feasibility','advisory_business_plan','mep','lift',
    'leasing_portfolio_map','registry','brands','v32_demand','v32_requests','v32_sales','v32_investors','v32_partners','v326_lease','leasing_layouts','leasing_opening',
    'manage_portfolio','facility_management','equipment_registry','maintenance','tenant_contracts','asset_management',
    'property_budget','noi_performance','capex_management','owner_reports','v326_suppliers',
    'finance_dashboard','finance_income','finance_expenses','finance_invoices','finance_receivables','finance_payables',
    'finance_treasury','finance_payroll','finance_project_pnl','finance_department_pnl','finance_budget',
    'analytics_hub','map','geoanalytics','market_data','macro_data','bench','data_quality','data_import_export',
    'product_intelligence','product_market','product_living','product_manage','product_subscriptions',
    'kpi','org','study','rating','users','admin_modules','admin_system','admin_workflows','admin_directories','admin_integrations'];
  return [
    'ASH'=>$all, 'CFO'=>$all, 'ADM'=>$all,
    'BA'=>['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','project_handover','docs','registry','brands','v32_demand','v32_requests','v32_sales','v32_investors','v32_partners','v326_lease','leasing_layouts','plans','leasing_opening','feasibility','mep','map','geoanalytics','bench','kpi','org','study','rating'],
    'AG'=>['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','docs','registry','brands','v32_demand','v32_requests','v32_sales','v32_investors','v326_lease','leasing_layouts','plans','leasing_opening','map','geoanalytics','kpi','org','study','rating'],
    'AGX'=>['dash','work_tasks','work_kanban','brands','v32_investors'],
    /* v4.76.0: клиенты и демо видят только студию геоаналитики */
    'CL'=>['dash','geoanalytics'], 'DEMO'=>['dash','geoanalytics'],
    'HO'=>['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','leasing_portfolio_map','project_workspace','project_layouts','plan_master','case_projects','docs','registry','brands','v32_demand','v32_requests','v326_lease','leasing_layouts','plans','leasing_opening','kpi','org','study'],
    'BSH'=>['dash','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','project_workspace','project_layouts','plan_master','case_projects','docs','registry','advisory_pipeline','advisory_proposal_builder','advisory_proposals','advisory_portfolio_map','advisory_contracts','advisory_scope','advisory_delivery','advisory_reports','advisory_cross_sell','advisory_concept','advisory_area','plans','mep','lift','map','geoanalytics','org','study'],
    'HM'=>['dash','v32_action','dates','work_tasks','work_kanban','workload','work_approvals','crm_clients','project_workspace','project_layouts','plan_master','case_projects','docs','advisory_pipeline','advisory_proposal_builder','advisory_proposals','advisory_portfolio_map','advisory_contracts','advisory_scope','advisory_delivery','advisory_reports','advisory_cross_sell','advisory_research','advisory_concept','advisory_area','plans','feasibility','advisory_business_plan','mep','lift','map','geoanalytics','market_data','macro_data','bench','data_quality','kpi','org','study','rating'],
    'BRJ'=>['dash','work_tasks','work_kanban','brands','geoanalytics','market_data','macro_data','data_quality','data_import_export'],
  ];
}
function asaas_known_module_ids(): array {
  $defs = asaas_workspace_default_views();
  return array_values(array_unique(array_filter((array)($defs['ASH'] ?? []), 'is_string')));
}
function asaas_protected_module_ids(): array { return ['dash','users']; }

// ── v4.74.0: режим платформы «только геоаналитика» ────────────────────
// Источник правды один: config.php ('platform_mode'), иначе api/mode.php. Клиент получает
// режим в ответе auth.php и строит меню по нему; сервер здесь же режет эндпоинты, таблицы и
// разделы состояния других отделов. Данные не удаляются: смена режима возвращает всё.
function platform_mode(): string {
  static $mode = null;
  if ($mode !== null) return $mode;
  $c = cfg();
  $m = (string)($c['platform_mode'] ?? '');
  if ($m === '') {
    $f = __DIR__.'/mode.php';
    if (is_file($f)) { $r = require $f; $m = is_array($r) ? (string)($r['mode'] ?? '') : (string)$r; }
  }
  $mode = ($m === 'geo') ? 'geo' : 'full';
  return $mode;
}
function geo_only(): bool { return platform_mode() === 'geo'; }
// Разделы, которые остаются в режиме «только геоаналитика». dash и users защищены от
// скрытия флагами модулей (asaas_protected_module_ids), поэтому входят сюда явно.
function geo_only_module_ids(): array {
  return ['dash','map','geoanalytics','analytics_hub','users','admin_modules','admin_system']; // v4.76.0: экрана geo_platform больше нет
}
function geo_only_allows(string $view): bool { return !geo_only() || in_array($view, geo_only_module_ids(), true); }
// Ставится в начало эндпоинтов других отделов: в гео-режиме они отвечают 403 всем, включая
// администратора. Сообщение объясняет причину, а не выглядит как сбой прав.
function require_module_enabled(string $view): void {
  if (!geo_only_allows($view)) fail('Раздел «'.$view.'» отключён: платформа работает в режиме «только геоаналитика» (api/mode.php)', 403);
}
function asaas_workspace_hard_allowed(array $u, string $view): bool {
  // v4.45.0: role invariants are security boundaries, not only menu presets.
  // External agents never receive corporate registries; junior data admins never receive LCR/projects.
  $rk = (string)($u['role_key'] ?? '');
  if ($rk === 'AGX') return in_array($view, ['dash','work_tasks','work_kanban','brands','v32_investors'], true);
  if ($rk === 'CL' || $rk === 'DEMO') return in_array($view, ['dash','geoanalytics'], true); // v4.76.0: граница безопасности, не пресет меню
  if ($rk === 'BRJ') return in_array($view, ['dash','work_tasks','work_kanban','brands','geoanalytics','market_data','macro_data','data_quality','data_import_export'], true);
  return true;
}
function asaas_future_module_ids(): array {
  // v4.71.0: data_quality снят из будущих - раздел стал настоящим (происхождение чисел),
  // зеркало флага future в os/v3520-workspaces.js.
  return ['project_handover','project_contracts','advisory_research','advisory_concept','advisory_area',
    'advisory_business_plan','leasing_opening','manage_portfolio','facility_management','equipment_registry',
    'maintenance','tenant_contracts','asset_management','property_budget','noi_performance','capex_management',
    'owner_reports','finance_dashboard','finance_income','finance_expenses','finance_invoices','finance_receivables',
    'finance_payables','finance_treasury','finance_payroll','finance_project_pnl','finance_department_pnl','finance_budget',
    'market_data','macro_data','data_import_export','product_intelligence','product_market','product_living',
    'product_manage','product_subscriptions','admin_workflows','admin_directories','admin_integrations'];
}
function asaas_module_status(array $state, string $view): string {
  if (in_array($view, asaas_protected_module_ids(), true)) return 'active';
  $flags = $state['MODULE_FLAGS'] ?? [];
  $rec = (is_array($flags) && array_key_exists($view, $flags)) ? $flags[$view] : null;
  $status = is_string($rec) ? $rec : (is_array($rec) ? ($rec['status'] ?? '') : '');
  if (!in_array($status, ['active','beta','hidden','disabled','deprecated'], true)) {
    $status = in_array($view, asaas_future_module_ids(), true) ? 'hidden' : 'active';
  }
  return $status;
}
function asaas_feature_can_view(array $u, array $state, string $view): bool {
  $status = asaas_module_status($state, $view);
  if ($status === 'hidden' || $status === 'disabled') return false;
  if ($status === 'beta') return !empty($u['admin']);
  return true;
}

function asaas_workspace_effective_views(array $u, array $state=[]): array {
  $rk = (string)($u['role_key'] ?? '');
  $defs = asaas_workspace_default_views();
  $base = $defs[$rk] ?? ['dash'];
  $roleWs = $state['ROLE_WORKSPACES'] ?? null;
  if (is_array($roleWs) && isset($roleWs[$rk]) && is_array($roleWs[$rk])) $base = $roleWs[$rk];
  $userWs = $state['USER_WORKSPACES'] ?? null;
  if (is_array($userWs)) {
    foreach ([(string)($u['id'] ?? ''), (string)($u['email'] ?? ''), $rk] as $key) {
      $rec = ($key !== '' && isset($userWs[$key]) && is_array($userWs[$key])) ? $userWs[$key] : null;
      if ($rec && (($rec['mode'] ?? '') === 'custom') && isset($rec['views']) && is_array($rec['views'])) {
        $base = $rec['views'];
        break;
      }
    }
  }
  $out = [];
  foreach ((array)$base as $view) {
    if (is_string($view) && $view !== '' && asaas_workspace_hard_allowed($u, $view) && asaas_feature_can_view($u, $state, $view) && geo_only_allows($view) && !in_array($view, $out, true)) $out[] = $view;
  }
  if (asaas_feature_can_view($u, $state, 'dash') && !in_array('dash', $out, true)) array_unshift($out, 'dash');
  // v4.74.0: в гео-режиме каждому, у кого есть хоть один гео-раздел или права администратора,
  // гарантируем «Гео: рынок и POI» - иначе меню было бы пустым, а платформа бесполезной.
  if (geo_only() && !in_array('geoanalytics', $out, true) && (!empty($u['admin']) || in_array('map', $out, true) || in_array('analytics_hub', $out, true))) $out[] = 'geoanalytics';
  return $out;
}
function asaas_workspace_can_view(array $u, string $view, array $state=[]): bool {
  return in_array($view, asaas_workspace_effective_views($u, $state), true);
}
function asaas_geo_can_edit(array $u): bool {
  // No role-name bypass: administrators grant action rights in the permission matrix.
  return !empty($u['edit']) || !empty($u['finance']) || !empty($u['admin']);
}
function asaas_load_app_state_data(): array {
  try {
    $st = db()->query('SELECT data FROM app_state WHERE id=1');
    $row = $st->fetch();
    $data = ($row && !empty($row['data'])) ? json_decode($row['data'], true) : [];
    return is_array($data) ? $data : [];
  } catch (Throwable $e) { return []; }
}
function asaas_workspace_visible_config(array $u, array $state): array {
  if (!empty($u['admin'])) return [
    'ROLE_WORKSPACES'=>$state['ROLE_WORKSPACES'] ?? [],
    'USER_WORKSPACES'=>$state['USER_WORKSPACES'] ?? [],
    'MODULE_FLAGS'=>$state['MODULE_FLAGS'] ?? [],
  ];
  $rk = (string)($u['role_key'] ?? '');
  $roles = [];
  if (isset($state['ROLE_WORKSPACES'][$rk]) && is_array($state['ROLE_WORKSPACES'][$rk])) $roles[$rk] = $state['ROLE_WORKSPACES'][$rk];
  $users = [];
  foreach ([(string)($u['id'] ?? ''), (string)($u['email'] ?? ''), $rk] as $key) {
    if ($key !== '' && isset($state['USER_WORKSPACES'][$key]) && is_array($state['USER_WORKSPACES'][$key])) $users[$key] = $state['USER_WORKSPACES'][$key];
  }
  return ['ROLE_WORKSPACES'=>$roles,'USER_WORKSPACES'=>$users,'MODULE_FLAGS'=>$state['MODULE_FLAGS'] ?? []];
}
function audit(string $action, string $detail=''): void {
  $u = current_user();
  $st = db()->prepare('INSERT INTO audit_log (by_id,by_name,role_key,action,detail) VALUES (?,?,?,?,?)');
  $st->execute([$u['id']??null, $u['name']??'-', $u['role_key']??'-', $action, $detail]);
}

// Row-table access follows the same configurable module matrix as the interface.
// A role name never creates a hidden technical ban; read/write rights are still checked
// separately by each table definition (leasing/edit/finance/admin).
function table_workspace_views(string $table): array {
  $map = [
    'objects'=>['case_projects','registry'], 'units'=>['registry'],
    'registry_changes'=>['registry'], 'control_dates'=>['dates','registry'],
    'brands'=>['brands'], 'benchmarks'=>['bench'], 'refusals'=>['bench'],
    'documents'=>['docs'], 'contacts'=>['docs'], 'doc_templates'=>['docs'],
    'deals'=>['v32_action'], 'deal_actions'=>['v32_action'],
    'brand_requests'=>['v32_requests'],
    'sales_assets'=>['v32_sales'], 'sales_buyers'=>['v32_sales'], 'sales_commission_ledger'=>['v32_sales'],
    'investor_requests'=>['v32_investors'],
    'case_partners'=>['v32_partners'], 'partner_referrals'=>['v32_partners'],
    'commission_rules'=>['v326_lease'], 'commission_ledger'=>['v326_lease'],
    'deal_stage_probabilities'=>['v326_lease'], 'lease_commission_deals'=>['v326_lease'],
    'lease_commission_ledger'=>['v326_lease'], 'commission_engine_settings'=>['v326_lease'],
    'supplier_categories'=>['v326_suppliers'], 'suppliers'=>['v326_suppliers'],
    'supplier_commission_deals'=>['v326_suppliers'], 'supplier_commission_ledger'=>['v326_suppliers'],
    'agent_metrics'=>['kpi'], 'kp_counters'=>['docs'],
    'roles'=>['users'], 'app_users'=>['users'], 'audit_log'=>['users'],
    'data_quality_snapshots'=>['data_quality'], 'activity_log'=>['v32_action'],
  ];
  return $map[$table] ?? [];
}
function role_allowed_tables(array $u): ?array { return null; }
function require_table_allowed(string $table): void {
  $u = current_user();
  if (!$u) return;
  $views = table_workspace_views($table);
  // v4.74.0: гео-режим режет таблицы других отделов и администратору тоже - иначе «отключено»
  // было бы только косметикой меню. Таблицы без привязки к разделу (служебные) не трогаем.
  if ($views && geo_only()) { $ok = false; foreach ($views as $view) if (geo_only_allows($view)) { $ok = true; break; } if (!$ok) fail('Таблица «'.$table.'» отключена: платформа в режиме «только геоаналитика»', 403); }
  if (!empty($u['admin'])) return;
  if (!$views) return;
  $state = asaas_load_app_state_data();
  foreach ($views as $view) if (asaas_workspace_can_view($u, $view, $state)) return;
  fail('Раздел для таблицы не включён в вашу рабочую область: '.$table, 403);
}

// ── Реестр таблиц (белый список) ──────────────────────────────────────
function tables(): array {
  return [
    'objects'=>['pk'=>'id','idtype'=>'text','cols'=>['id','name','ru','country','city','type','gba','gla','plan','sc','inc','cur','cond','levels','vat','vat_rate','comm'],'json'=>['comm'],'read'=>'leasing','write'=>'edit','proj_scope'=>'id'],
    'units'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','code','floor','area','terr','cat','sub','rate','budget','status','broker','assigned_to','vars','shortlist','merged','offer'],'json'=>['vars','shortlist','merged','offer'],'finance'=>['rate','budget'],'read'=>'leasing','write'=>'edit','own_only'=>'broker','proj_scope'=>'obj_id'],
    'brands'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','cat','sub','country','amin','amax','format','fr','reqs','coten','person','phone','email','site','ig','status','notes','about','pos','concept','rec','founded','group','price','tier','icsc','uz_op','net_pts','net_countries','logo','shopfront','interior','edited_by'],'read'=>'leasing','write'=>'edit'],
    'registry_changes'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','date','type','what','by_name'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'benchmarks'=>['pk'=>'id','idtype'=>'auto','cols'=>['city','district','obj','cat','rent','sc','note'],'read'=>'leasing','write'=>'edit'],
    'refusals'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','brand','reason','date'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'control_dates'=>['pk'=>'id','idtype'=>'auto','cols'=>['unit_id','label','date'],'read'=>'leasing','write'=>'edit','proj_scope_via'=>['units','id','unit_id','obj_id']],
    'documents'=>['pk'=>'id','idtype'=>'auto','cols'=>['t','type','no','to_name','obj_id','lang','fname','status','ver','raw','by_id'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'contacts'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','title','phone','email'],'read'=>'leasing','write'=>'edit'],
    // agent_metrics/kp_counters: не используются фронтендом (KPI считаются на клиенте из
    // общего state blob) — раньше любая edit-роль могла писать сюда чужие метрики через
    // прямой POST. Живых сценариев записи нет, поэтому сужаем до admin без риска регрессии.
    'agent_metrics'=>['pk'=>'user_id','idtype'=>'text','cols'=>['user_id','touch','meet','view','loi','sign','earned','pipe'],'read'=>'leasing','write'=>'admin'],
    'kp_counters'=>['pk'=>'obj_id','idtype'=>'text','cols'=>['obj_id','last_no'],'read'=>'leasing','write'=>'admin'],
    'roles'=>['pk'=>'key','idtype'=>'text','cols'=>['key','label','leasing','finance','edit','approve','plans','own_only','project_scope','admin'],'read'=>'leasing','write'=>'admin'],
    // read=>leasing остаётся - реальная функция чата (@упоминания, index.html ~2510) должна
    // видеть список активных сотрудников для ЛЮБОЙ leasing-роли. Но email/роль/брокер/проекты -
    // это уже не то, что нужно для упоминания в чате; redact_unless_admin прячет их не-админам
    // на уровне list_table() (см. ниже), а не полагается на то, что фронтенд "просто не покажет".
    'app_users'=>['pk'=>'id','idtype'=>'uuid','cols'=>['id','email','name','title','role_key','broker_name','projects','active','user_type','expires_at','settings'],'json'=>['projects','settings'],'read'=>'leasing','write'=>'admin','redact_unless_admin'=>['email','title','role_key','broker_name','projects','user_type','expires_at','settings']],
    // activity_log: не используется фронтендом для записи (реальный журнал - audit_log,
    // пишется только сервером через audit()). write=>leasing раньше позволяло любой
    // leasing-роли вставлять поддельные записи; отключаем клиентскую запись полностью.
    'activity_log'=>['pk'=>'id','idtype'=>'auto','cols'=>['kind','by_id','obj_id'],'read'=>'leasing','write'=>null],
    'deals'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','unit_id','unit_code','brand_id','brand_name','broker','stage','probability','proposed_rate','expected_monthly_rent','expected_commission','next_action','next_action_date','priority','delay_reason','refusal_reason','status','created_by'],'finance'=>['proposed_rate','expected_monthly_rent','expected_commission'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'deal_actions'=>['pk'=>'id','idtype'=>'auto','cols'=>['deal_id','obj_id','unit_code','brand_name','action_type','action_text','due_date','done_at','by_id','by_name'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'data_quality_snapshots'=>['pk'=>'id','idtype'=>'auto','cols'=>['score','scope','metrics','created_by'],'json'=>['metrics'],'read'=>'admin','write'=>'admin'],
    'doc_templates'=>['pk'=>'id','idtype'=>'auto','cols'=>['code','title','lang','body','active','created_by'],'read'=>'leasing','write'=>'admin'],
    'commission_rules'=>['pk'=>'id','idtype'=>'auto','cols'=>['role_key','broker','obj_id','source_type','default_share','close_share','floor_share','building_share','active','notes','created_by'],'read'=>'finance','write'=>'finance'],
    'commission_ledger'=>['pk'=>'id','idtype'=>'auto','cols'=>['deal_id','obj_id','unit_id','unit_code','brand_name','broker','role_key','case_commission','bonus_rate','bonus_earned','bonus_pipeline','weighted_bonus','lost_bonus','stage','probability','status','event_type','visibility','notes','created_by'],'read'=>'leasing','write'=>'finance','own_private'=>'broker','proj_scope'=>'obj_id'],
    'deal_stage_probabilities'=>['pk'=>'stage','idtype'=>'text','cols'=>['stage','probability','label_ru','label_en','label_uz'],'read'=>'finance','write'=>'admin'],

    'brand_requests'=>['pk'=>'id','idtype'=>'auto','cols'=>['brand_name','country','city','category','area_min','area_max','budget_max','preferences','stage','source','broker','next_action','due_date','potential_fee','visibility','partner_id','created_by'],'finance'=>['budget_max','potential_fee'],'read'=>'leasing','write'=>'edit','own_private'=>'broker'],
    'sales_assets'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','country','city','type','area','price','currency','seller','stage','broker','partner','visibility','commission_rate','expected_commission','next_action','due_date','notes','created_by'],'finance'=>['price','commission_rate','expected_commission'],'read'=>'leasing','write'=>'edit','own_private'=>'broker'],
    'sales_buyers'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','country','city','asset_type','area_min','area_max','budget_min','budget_max','cap_rate','contact','broker','stage','notes','created_by'],'finance'=>['budget_min','budget_max'],'read'=>'leasing','write'=>'edit','own_private'=>'broker'],
    'investor_requests'=>['pk'=>'id','idtype'=>'auto','cols'=>['investor_name','country','city','asset_type','area_min','area_max','budget_min','budget_max','cap_rate','proof_funds','preferences','stage','source','contact','broker','next_action','due_date','potential_fee','visibility','partner_id','created_by'],'finance'=>['budget_min','budget_max','potential_fee'],'read'=>'leasing','write'=>'edit','own_private'=>'broker'],
    'case_partners'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','type','country','city','email','phone','access','scope','status','owner','notes','created_by'],'read'=>'leasing','write'=>'admin','own_private'=>'owner'],
    'partner_referrals'=>['pk'=>'id','idtype'=>'auto','cols'=>['partner_id','partner_name','kind','name','country','city','category','area_min','area_max','budget_min','budget_max','status','broker','notes','created_by'],'finance'=>['budget_min','budget_max'],'read'=>'leasing','write'=>'edit','own_private'=>'broker'],
    'sales_commission_ledger'=>['pk'=>'id','idtype'=>'auto','cols'=>['sales_asset_id','asset_name','broker','partner','case_commission','agent_bonus','partner_bonus','weighted_bonus','lost_bonus','stage','probability','status','visibility','notes','created_by'],'finance'=>['case_commission','partner_bonus'],'read'=>'leasing','write'=>'finance','own_private'=>'broker'],
    'commission_engine_settings'=>['pk'=>'setting_key','idtype'=>'text','cols'=>['setting_key','setting_value','updated_by'],'json'=>['setting_value'],'read'=>'finance','write'=>'admin'],
    'lease_commission_deals'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','object_name','unit_id','unit_code','tenant_name','area','rate','monthly_rent','annual_rent','term_months','signed_date','currency','fx_rate','base_method','annual_percent','fixed_amount','commission_base','ash_confirmed','closing_type','agent_primary','agent_secondary','split_primary','split_secondary','curator_name','support_name','agent_amount','curator_amount','support_amount','company_amount','salary_allocation','company_net','stage','probability','payment_status','reversal_of','notes','audit_json','created_by'],'json'=>['audit_json'],'read'=>'leasing','write'=>'edit','own_private'=>'agent_primary','proj_scope'=>'obj_id'],
    'lease_commission_ledger'=>['pk'=>'id','idtype'=>'auto','cols'=>['lease_deal_id','participant_name','participant_role','role_key','amount','currency','fx_rate','amount_usd','amount_uzs','share_percent','stage','probability','status','visibility_owner','period_month','notes','created_by'],'read'=>'leasing','write'=>'finance','own_private'=>'visibility_owner'],
    'supplier_categories'=>['pk'=>'id','idtype'=>'auto','cols'=>['name_ru','name_uz','name_en','commission_rate','client_discount_rate','active','notes'],'read'=>'leasing','write'=>'admin'],
    'suppliers'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','category_id','category_name','contact_name','phone','email','terms','commission_rate','client_discount_rate','transparency_policy','status','owner','created_by'],'read'=>'leasing','write'=>'edit','own_private'=>'owner'],
    'supplier_commission_deals'=>['pk'=>'id','idtype'=>'auto','cols'=>['supplier_id','supplier_name','category_id','category_name','client_name','client_type','project_name','order_amount','currency','fx_rate','commission_rate','case_commission','client_discount_rate','client_saving','client_disclosure','supplier_disclosure','disclosure_date','disclosure_by','status','payment_status','owner','notes','audit_json','created_by'],'json'=>['audit_json'],'read'=>'leasing','write'=>'edit','own_private'=>'owner'],
    'supplier_commission_ledger'=>['pk'=>'id','idtype'=>'auto','cols'=>['supplier_deal_id','supplier_name','client_name','case_commission','client_saving','currency','status','visibility_owner','period_month','notes','created_by'],'read'=>'leasing','write'=>'finance','own_private'=>'visibility_owner'],
    'audit_log'=>['pk'=>'id','idtype'=>'auto','cols'=>['by_id','by_name','role_key','action','detail'],'read'=>'admin','write'=>null],
  ];
}
function q(string $id): string { return '`'.str_replace('`','',$id).'`'; } // безопасное имя столбца

// ── Чтение таблицы ────────────────────────────────────────────────────
function list_table(string $table, array $filters): array {
  $defs = tables(); if (!isset($defs[$table])) fail('Неизвестная таблица', 400);
  if ($table === 'app_users') ensure_user_profile_columns(); // v4.76.0: старые базы без колонок типа и срока
  $d = $defs[$table];
  require_login();
  require_table_allowed($table);
  if (!can($d['read'])) fail('Нет доступа на чтение: '.$table, 403);
  $where = []; $args = [];
  // фильтр по объекту
  if (!empty($filters['obj']) && in_array('obj_id', array_merge($d['cols'],['obj_id']), true)) {
    $where[] = q('obj_id').'=?'; $args[] = $filters['obj'];
  }
  // own_only — агент видит только свои
  if (!empty($d['own_only']) && can('own_only') && !can('admin')) {
    $u = current_user();
    $where[] = q($d['own_only']).'=?'; $args[] = owner_identity($u);
  }
  // own_private — приватные записи: агент видит только свои строки, finance/admin/manager видят весь список
  if (!empty($d['own_private']) && !can('finance') && !can('admin')) {
    $u = current_user();
    $where[] = q($d['own_private']).'=?'; $args[] = owner_identity($u);
  }
  // proj_scope — внешний агент видит только назначенные ему объекты
  if (!empty($d['proj_scope']) && can('project_scope') && !can('admin')) {
    $u = current_user();
    $allowed = is_array($u['projects'] ?? null) ? $u['projects'] : [];
    if (!$allowed) $allowed = ['__none__'];
    $ph = implode(',', array_fill(0, count($allowed), '?'));
    $where[] = q($d['proj_scope']).' IN ('.$ph.')';
    foreach ($allowed as $a) $args[] = $a;
  }
  // proj_scope_via — как proj_scope, но у таблицы нет своего obj_id, только ссылка на
  // строку другой таблицы, где obj_id и хранится (например control_dates.unit_id -> units.obj_id).
  if (!empty($d['proj_scope_via']) && can('project_scope') && !can('admin')) {
    [$viaTable, $viaPk, $viaLocal, $viaObjCol] = $d['proj_scope_via'];
    $u = current_user();
    $allowed = is_array($u['projects'] ?? null) ? $u['projects'] : [];
    if (!$allowed) $allowed = ['__none__'];
    $ph = implode(',', array_fill(0, count($allowed), '?'));
    $where[] = q($viaLocal).' IN (SELECT '.q($viaPk).' FROM '.q($viaTable).' WHERE '.q($viaObjCol).' IN ('.$ph.'))';
    foreach ($allowed as $a) $args[] = $a;
  }
  $sql = 'SELECT * FROM '.q($table);
  if ($where) $sql .= ' WHERE '.implode(' AND ', $where);
  $limit = table_row_limit($table);
  if ($limit) $sql .= ' LIMIT '.((int)$limit + 1); // +1: чтобы обнаружить обрезку и предупредить об этом
  $st = db()->prepare($sql); $st->execute($args);
  $rows = $st->fetchAll();
  $truncated = $limit && count($rows) > $limit;
  if ($truncated) $rows = array_slice($rows, 0, $limit);
  $fin = can('finance');
  $isAdmin = can('admin');
  $redact = (!empty($d['redact_unless_admin']) && !$isAdmin) ? $d['redact_unless_admin'] : [];
  foreach ($rows as &$row) {
    if (isset($row['password_hash'])) unset($row['password_hash']);
    foreach (($d['json']??[]) as $jc) if (isset($row[$jc]) && is_string($row[$jc])) $row[$jc] = json_decode($row[$jc], true);
    if (!$fin) foreach (($d['finance']??[]) as $fc) if (array_key_exists($fc,$row)) $row[$fc] = null;
    foreach ($redact as $rc) if (array_key_exists($rc,$row)) unset($row[$rc]);
  }
  unset($row);
  if ($truncated) {
    // Не молчим о срезе (независимый аудит, P2-02: "no silent caps"). Формат ответа data.php
    // ({"rows":[...]}) не резервирует место под доп. метаданные, поэтому обрезку фиксируем в
    // серверный лог, а не подменяем форму ответа - фронтенд сегодня не листает ни одну из этих
    // таблиц постранично, предел стоит намного выше реальных объёмов и не должен срабатывать.
    $cu = current_user();
    error_log('list_table: '.$table.' truncated at '.$limit.' rows for user '.(string)($cu['id'] ?? '-'));
  }
  return $rows;
}
// Защитный потолок числа строк за один список-запрос (P2-02): list_table() исторически делал
// неограниченный SELECT *. Фронтенд CASE OS сегодня не постранично листает ни одну из этих
// таблиц, поэтому обрезка не должна происходить в норме - предел стоит намного выше реальных
// объёмов данных и служит защитой от случайного/злонамеренного раздувания ответа, а не UX-пагинацией.
function table_row_limit(string $table): int { return 20000; }


function user_project_allowed(?string $objId): bool {
  if (!$objId) return true;
  if (can('admin') || !can('project_scope')) return true;
  $u = current_user();
  $allowed = is_array($u['projects'] ?? null) ? $u['projects'] : [];
  return in_array($objId, $allowed, true);
}
// Разрешить строку через связанную таблицу (control_dates -> units -> obj_id), см. tables().
function resolve_via_obj_id(array $d, $localVal): ?string {
  if (empty($d['proj_scope_via']) || $localVal === null || $localVal === '') return null;
  [$viaTable, $viaPk, , $viaObjCol] = $d['proj_scope_via'];
  $st = db()->prepare('SELECT '.q($viaObjCol).' FROM '.q($viaTable).' WHERE '.q($viaPk).'=?');
  $st->execute([$localVal]);
  $r = $st->fetch();
  return $r ? (string)($r[$viaObjCol] ?? '') : null;
}
function row_allowed_for_user(array $d, array $row): bool {
  if (can('admin')) return true;
  $u = current_user();
  if (!empty($d['own_only']) && can('own_only')) {
    $field = $d['own_only'];
    if ((string)($row[$field] ?? '') !== owner_identity($u)) return false;
  }
  if (!empty($d['own_private']) && !can('finance') && !can('admin')) {
    $field = $d['own_private'];
    if ((string)($row[$field] ?? '') !== owner_identity($u)) return false;
  }
  if (!empty($d['proj_scope']) && can('project_scope')) {
    if (!user_project_allowed((string)($row[$d['proj_scope']] ?? ''))) return false;
  }
  if (!empty($d['proj_scope_via']) && can('project_scope')) {
    $viaLocal = $d['proj_scope_via'][2];
    if (!user_project_allowed(resolve_via_obj_id($d, $row[$viaLocal] ?? null))) return false;
  }
  return true;
}
function fetch_row_for_acl(string $table, array $d, $idval): ?array {
  if ($idval === null || $idval === '') return null;
  $st = db()->prepare('SELECT * FROM '.q($table).' WHERE '.q($d['pk']).'=?');
  $st->execute([$idval]);
  $r = $st->fetch();
  return $r ?: null;
}

// ── Запись (upsert) ───────────────────────────────────────────────────
function upsert_row(string $table, array $row): array {
  $defs = tables(); if (!isset($defs[$table])) fail('Неизвестная таблица', 400);
  $d = $defs[$table];
  require_login();
  require_table_allowed($table);
  if (empty($d['write']) || !can($d['write'])) fail('Нет доступа на запись: '.$table, 403);
  $pk = $d['pk'];
  $data = [];
  foreach (($d['finance']??[]) as $fc) if (array_key_exists($fc, $row) && !can('finance') && !can('approve') && !can('admin')) fail('Нет доступа на изменение финансовых полей: '.$fc, 403);
  foreach ($d['cols'] as $c) if (array_key_exists($c, $row)) {
    $v = $row[$c];
    if (in_array($c, ($d['json']??[]), true)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
    $data[$c] = $v;
  }
  $pdo = db();
  $idval = $row[$pk] ?? null;
  if (($d['idtype']==='uuid') && !$idval) { $idval = uuid(); $data[$pk] = $idval; }
  if (($d['idtype']==='text') && !$idval) fail('Не задан идентификатор для '.$table, 400);

  $exists = false;
  if ($idval !== null && $idval !== '') {
    $c = $pdo->prepare('SELECT 1 FROM '.q($table).' WHERE '.q($pk).'=?');
    $c->execute([$idval]); $exists = (bool)$c->fetchColumn();
  }
  // created_by — поле авторства/аудита: клиент не должен переписывать его на UPDATE
  // (иначе можно подменить историю "кто на самом деле создал запись"), а на CREATE оно
  // всегда подставляется сервером из текущего пользователя, а не тем, что прислал клиент
  // (P2-03, "immutable audit fields").
  $hasCreatedBy = in_array('created_by', $d['cols'], true);
  if ($hasCreatedBy) {
    if ($exists) unset($data['created_by']);
    else { $cu = current_user(); $data['created_by'] = $cu['name'] ?? '-'; }
  }
  if ($exists) {
    $old = fetch_row_for_acl($table, $d, $idval);
    if ($old && !row_allowed_for_user($d, $old)) fail('Нет доступа к этой записи', 403);
    $check = array_merge($old ?: [], $data);
    if (!row_allowed_for_user($d, $check)) fail('Запись выходит за пределы ваших прав доступа', 403);
    $sets = []; $args = [];
    foreach ($data as $k=>$v) { if ($k===$pk) continue; $sets[]=q($k).'=?'; $args[]=$v; }
    if ($sets) { $args[]=$idval; $pdo->prepare('UPDATE '.q($table).' SET '.implode(',',$sets).' WHERE '.q($pk).'=?')->execute($args); }
  } else {
    if (!empty($d['proj_scope']) && !user_project_allowed((string)($data[$d['proj_scope']] ?? ''))) fail('Нет доступа к этому объекту', 403);
    if (!row_allowed_for_user($d, $data)) fail('Запись выходит за пределы ваших прав доступа', 403);
    if (($d['idtype']==='auto')) unset($data[$pk]);
    elseif ($idval!==null) $data[$pk]=$idval;
    $cols = array_keys($data);
    $ph = implode(',', array_fill(0, count($cols), '?'));
    $pdo->prepare('INSERT INTO '.q($table).' ('.implode(',',array_map('q',$cols)).') VALUES ('.$ph.')')->execute(array_values($data));
    if ($d['idtype']==='auto') $idval = $pdo->lastInsertId();
  }
  audit(($exists?'Изменение: ':'Создание: ').$table, (string)$idval);
  $sel = $pdo->prepare('SELECT * FROM '.q($table).' WHERE '.q($pk).'=?');
  $sel->execute([$idval]); $saved = $sel->fetch() ?: [];
  if (isset($saved['password_hash'])) unset($saved['password_hash']);
  foreach (($d['json']??[]) as $jc) if (isset($saved[$jc]) && is_string($saved[$jc])) $saved[$jc]=json_decode($saved[$jc], true);
  if (!can('finance')) foreach (($d['finance']??[]) as $fc) if (array_key_exists($fc,$saved)) $saved[$fc]=null;
  return $saved;
}

// ── Удаление ──────────────────────────────────────────────────────────
function delete_row(string $table, $id): void {
  $defs = tables(); if (!isset($defs[$table])) fail('Неизвестная таблица', 400);
  $d = $defs[$table];
  require_login();
  require_table_allowed($table);
  if (empty($d['write']) || !can($d['write'])) fail('Нет доступа на запись: '.$table, 403);
  $old = fetch_row_for_acl($table, $d, $id);
  if ($old && !row_allowed_for_user($d, $old)) fail('Нет доступа к этой записи', 403);
  db()->prepare('DELETE FROM '.q($table).' WHERE '.q($d['pk']).'=?')->execute([$id]);
  audit('Удаление: '.$table, (string)$id);
}

// ── P0-SEC-01/02: финансовые поля помещений ─────────────────────────────────
// Независимый аудит v4.70.0 показал: экран честно маскирует ставки как «•••» для ролей
// без права finance, но сервер отдавал те же ставки целиком - в ключе U общего state,
// в CSV-выгрузке и через атомарные эндпоинты. Маскировка на экране защитой не является:
// значение доступно через DevTools, выгрузку и прямой запрос к API.
//
// Ниже - ЕДИНСТВЕННОЕ место, где перечислены финансовые поля помещения. Все три пути
// (state.php, unit_patch.php, units_batch.php) обязаны спрашивать именно его, иначе
// расхождение вернётся при первом же добавленном поле.
//
// Площадь и терраса в список НЕ входят намеренно: архитектору они нужны для работы, а
// коммерческой тайной не являются. Скрываем деньги, а не геометрию.
function unit_finance_fields(): array {
  return ['rate','budget','budLand','factLand','capex','total','gap','commission','feeTotal'];
}

// Видит ли пользователь деньги помещений.
function unit_can_see_finance(array $u): bool {
  return !empty($u['finance']) || !empty($u['admin']);
}

// Вырезать деньги из массива помещений перед отправкой роли без права finance.
// Ключи не обнуляются, а УДАЛЯЮТСЯ: клиент отличает «поля нет» от «поле равно нулю»,
// и подставленный ноль выглядел бы как реальная бесплатная ставка.
function redact_units_for(array $rows, array $u): array {
  if (unit_can_see_finance($u)) return $rows;
  $fields = unit_finance_fields();
  return array_map(function ($r) use ($fields) {
    if (!is_array($r)) return $r;
    foreach ($fields as $f) unset($r[$f]);
    /* offer/vars хранят коммерческие условия внутри JSON - отдаём только безопасную часть */
    if (isset($r['offer'])) unset($r['offer']);
    return $r;
  }, $rows);
}

// Вернуть деньги на место при сохранении. Без этого шага защита превращается в потерю
// данных: клиент получил помещения БЕЗ ставок, сохранил весь state целиком, и ставки
// исчезли бы у всех. Поэтому финансовые поля каждого помещения берутся из серверной
// копии по идентификатору, а не из присланного клиентом.
function restore_unit_finance(array $incomingRows, array $oldRows, array $u): array {
  if (unit_can_see_finance($u)) return $incomingRows;
  $fields = unit_finance_fields();
  $byId = [];
  foreach ($oldRows as $r) if (is_array($r) && isset($r['id'])) $byId[(string)$r['id']] = $r;
  return array_map(function ($r) use ($byId, $fields) {
    if (!is_array($r)) return $r;
    $old = isset($r['id']) ? ($byId[(string)$r['id']] ?? null) : null;
    foreach ($fields as $f) {
      if ($old !== null && array_key_exists($f, $old)) $r[$f] = $old[$f];
      else unset($r[$f]);   /* новое помещение: денег у него пока просто нет */
    }
    if ($old !== null && array_key_exists('offer', $old)) $r['offer'] = $old['offer'];
    else unset($r['offer']);
    return $r;
  }, $incomingRows);
}

// Может ли пользователь менять состав помещений: создавать, удалять, массово заливать,
// объединять и перенумеровывать. Право edit этого не даёт: агент аренды по описанию роли
// ведёт показы и брони, а не структуру объекта.
function unit_can_change_structure(array $u): bool {
  return !empty($u['admin']) || !empty($u['finance']) || !empty($u['plans']);
}

// ── v4.71.0: происхождение чисел (карта PROV в общем состоянии) ─────────────────
// Всё, что относится к разбору и проверке записи, живёт здесь, а не в provenance.php:
// эндпоинт нельзя проверить без базы, а функции - можно, и v4710_provenance_api.php
// именно это и делает.

// Сущности и поля, за которыми происхождение ведётся. Список закрытый намеренно: открыв
// его, мы получили бы происхождение у полей вроде «комментарий», где оно ничего не значит,
// и потеряли бы возможность сказать «по ставкам подтверждено 62%».
function prov_fields(): array {
  return [
    'unit'   => ['rate','area','status','budget','total'],
    'object' => ['gba','gla','levels','vacancy'],
    'bench'  => ['rate','area'],
    'brand'  => ['rate'],
  ];
}
function prov_conf_values(): array   { return ['verified','asking','modelled']; }
function prov_source_values(): array { return ['landlord','broker','tenant','deal','listing','field','registry','document','osm','calculated','other']; }
function prov_method_values(): array { return ['call','visit','document','registry','deal']; }

// Ключ имеет вид «сущность:идентификатор:поле». Разбор строгий: свободный ключ означал бы,
// что карта со временем наполнится записями, которые ничему не соответствуют, а доля
// подтверждённых данных перестанет считаться. Возвращает null, если ключ не подходит.
function prov_parse_key(string $key): ?array {
  // \z, а не $: в PCRE $ совпадает и перед завершающим переводом строки, и ключ с «\n» на
  // конце прошёл бы проверку, став отдельной записью-призраком рядом с настоящей.
  if (!preg_match('~^(unit|object|bench|brand):([A-Za-z0-9_\-]{1,64}):([A-Za-z0-9_]{1,40})\z~', $key, $m)) return null;
  $fields = prov_fields();
  if (!isset($fields[$m[1]]) || !in_array($m[3], $fields[$m[1]], true)) return null;
  return ['entity'=>$m[1], 'id'=>$m[2], 'field'=>$m[3]];
}

// Финансовые ключи: те, чьё поле входит в unit_finance_fields(). Запись происхождения не
// содержит самой цифры, но содержит имя источника - свободный текст, куда сотрудник
// запросто впишет «Ромашка, 25$». Поэтому роль без права finance этих записей не видит.
function prov_is_finance_key(string $key): bool {
  $p = prov_parse_key($key);
  return $p !== null && in_array($p['field'], unit_finance_fields(), true);
}

// Очистить присланную запись. Бросает InvalidArgumentException с текстом для клиента.
// Для conf=verified автор и дата ставятся сервером: подтверждение имеет цену (снимает с
// числа оговорки и уходит в материалы клиенту), и если дату с автором присылает браузер,
// подтвердить чужим именем и задним числом можно правкой одного поля в DevTools.
function prov_clean_record($rec, array $u, ?string $today = null): array {
  $today = $today ?? date('Y-m-d');
  if (!is_array($rec)) throw new InvalidArgumentException('Запись происхождения должна быть объектом');
  $conf = (string)($rec['conf'] ?? '');
  if (!in_array($conf, prov_conf_values(), true)) throw new InvalidArgumentException('Недопустимая уверенность: '.$conf);
  $src = (string)($rec['src'] ?? 'other');
  if (!in_array($src, prov_source_values(), true)) $src = 'other';
  $how = (string)($rec['how'] ?? '');
  if ($how !== '' && !in_array($how, prov_method_values(), true)) $how = '';

  // Будущая дата отклоняется: цифра, «проверенная» завтра, не устареет никогда, и правило
  // 90/180 дней обошли бы одной опечаткой.
  $at = substr(trim((string)($rec['at'] ?? '')), 0, 10);
  if ($at === '' || !preg_match('~^\d{4}-\d{2}-\d{2}$~', $at)) $at = $today;
  if ($at > $today) throw new InvalidArgumentException('Дата наблюдения не может быть в будущем');

  $by = mb_substr(trim((string)($rec['by'] ?? '')), 0, 80);
  if ($conf === 'verified') {
    $by = (string)($u['name'] ?? '-');
    $at = $today;
    if ($how === '') $how = 'call';
  }
  return [
    'conf'  => $conf,
    'src'   => $src,
    'name'  => mb_substr(trim((string)($rec['name'] ?? '')), 0, 160),
    'at'    => $at,
    'by'    => $by,
    'how'   => $how,
    'basis' => mb_substr(trim((string)($rec['basis'] ?? '')), 0, 120),
    'note'  => mb_substr(trim((string)($rec['note'] ?? '')), 0, 400),
  ];
}

// Вырезать финансовые записи перед отправкой роли без права finance. Ключи удаляются, а не
// обнуляются - по той же причине, что и в redact_units_for.
function redact_prov_for(array $prov, array $u): array {
  if (unit_can_see_finance($u)) return $prov;
  foreach (array_keys($prov) as $k) if (prov_is_finance_key((string)$k)) unset($prov[$k]);
  return $prov;
}

// Вернуть финансовые записи на место при сохранении всего состояния ролью без finance:
// она получила карту без них и, сохранив state целиком, стёрла бы их у всех.
function restore_prov_finance(array $incoming, array $old, array $u): array {
  if (unit_can_see_finance($u)) return $incoming;
  foreach (array_keys($incoming) as $k) if (prov_is_finance_key((string)$k)) unset($incoming[$k]);
  foreach ($old as $k => $v) if (prov_is_finance_key((string)$k)) $incoming[$k] = $v;
  return $incoming;
}
