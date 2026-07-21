<?php
// CASE OS — общее состояние платформы (живые данные интерфейса).
// GET  — отдать сохранённое состояние (нужен вход).
// POST — сохранить состояние (нужно право edit или admin). Тело: {"data": {...}, "revision": 123?}.
require __DIR__.'/lib.php';
$u = require_login();
$m = $_SERVER['REQUEST_METHOD'];

function ensure_app_state_schema(): void {
  $pdo = db();
  try { $pdo->query('SELECT revision FROM app_state LIMIT 1'); }
  catch (Throwable $e) {
    try { $pdo->exec('ALTER TABLE app_state ADD COLUMN revision INT NOT NULL DEFAULT 0'); }
    catch (Throwable $e2) {}
  }
}

ensure_app_state_schema();

// Sales/Investors/Partners/Brand-requests/Lease/Supplier-commission modules keep their
// working data inside this shared state blob (see os/v32-upgrade.js, os/v326-commission-engines.js)
// instead of the row-level-ACL'd data.php endpoints their DB tables were designed for.
// Until that migration happens, redact non-owned/finance rows here so a non-finance,
// non-admin caller (e.g. a single-project external agent) cannot read every other
// broker's sales assets, investor budgets, partner commissions, etc. by simply calling
// this endpoint — the UI's own "you only see what's yours" copy must be true at the API too.
function redact_shared_state(array $data, array $u): array {
  if (!empty($u['admin']) || !empty($u['finance'])) return $data; // sees everything, matches existing UI intent
  $me = owner_identity($u); // единая функция (lib.php) - P2-04
  $ownBy = function(array $rows, string $field) use ($me) {
    return array_values(array_filter($rows, function($r) use ($field, $me) {
      return is_array($r) && (string)($r[$field] ?? '') === $me && $me !== '';
    }));
  };
  foreach (['BRAND_REQUESTS'=>'broker','SALES_ASSETS'=>'broker','SALES_BUYERS'=>'broker',
            'INVESTOR_REQUESTS'=>'broker','PARTNER_REFERRALS'=>'broker',
            'LEASE_COMMISSION_DEALS'=>'broker','SUPPLIER_COMMISSION_DEALS'=>'owner'] as $key=>$field) {
    if (isset($data[$key]) && is_array($data[$key])) $data[$key] = $ownBy($data[$key], $field);
  }
  if (isset($data['CASE_PARTNERS']) && is_array($data['CASE_PARTNERS'])) $data['CASE_PARTNERS'] = $ownBy($data['CASE_PARTNERS'], 'owner');
  return $data;
}

// Полный список верхнеуровневых ключей общего state blob (см. os/index.html stateBlob(),
// os/v32-upgrade.js и os/v326-commission-engines.js DATA_KEYS). До миграции каждого модуля
// на собственную ACL'd таблицу — единственная граница между ролями здесь, на сервере.
function all_shared_state_keys(): array {
  return ['OBJECTS','U','BRANDS','USERS','CHANGES','BENCH','REFUSALS','PLANUP','PLANSVG',
    'PLAN_LABELPOS','PLAN_CODES','PLAN_STRUCT','DOCREG','DOC_CONTACTS','AGENTS','ROLES','KPSEQ','ACTLOG','AUDIT',
    'MAPCFG','PROJECT_PPT','QUIZLOG','QUIZSTATS','KB','KBPROG','HRPROF','CHAT','KPI_TARGETS',
    'ROLE_WORKSPACES','USER_WORKSPACES','MODULE_FLAGS','GEO_DATA','TRASH','COMMCFG','COMMLOST',
    'BRAND_REQUESTS','INVESTOR_REQUESTS','SALES_ASSETS','SALES_BUYERS','CASE_PARTNERS',
    'PARTNER_REFERRALS','V32_NOTES',
    'COMMISSION_ENGINE_CFG','LEASE_COMMISSION_DEALS','SUPPLIERS','SUPPLIER_COMMISSION_DEALS',
    'SUPPLIER_COMMISSION_LEDGER',
    'CASE_CLIENTS','CASE_OPPORTUNITIES','CASE_PROPOSALS','CASE_CONTRACTS','CASE_SCOPE_ITEMS',
    'CASE_SCOPE_CHANGES','CASE_TASKS','CASE_DELIVERABLES','CASE_LAYOUT_VERSIONS','CASE_DECISIONS',
    'CASE_DOCUMENT_TEMPLATES','CASE_WORKFLOW_SETTINGS','CASE_PORTFOLIO_PROJECTS','CASE_PROPOSAL_CATALOG'];
}
// === P0-01 (независимый deep-review v4.8.1) ==================================
// Раньше здесь был ОДИН широкий статический список ключей на почти все не-админские
// роли — из-за этого меню-конфигурация рабочих областей (ROLE_WORKSPACES/USER_WORKSPACES,
// см. os/v3520-workspaces.js) НЕ была настоящей границей доступа на сервере: роль, у которой
// в меню нет «Геоаналитики» или «Брендов», всё равно могла записать GEO_DATA/BRANDS прямым
// POST в этот эндпоинт. Теперь список разрешённых ключей ВЫЧИСЛЯЕТСЯ из фактических рабочих
// областей роли/пользователя — тем же способом, что и интерфейс.
//
// Почему restore-из-старого, а не 403 на весь запрос: клиент сохраняет ВЕСЬ state blob целиком
// (см. index.html stateBlob()), поэтому в каждом сохранении присутствуют все ключи, включая те,
// которые роль не меняла. Жёсткий 403 ломал бы любое легитимное сохранение. Поэтому неразрешённый
// ключ восстанавливается из уже сохранённого состояния (модуль вне рабочей области роль изменить
// не может), а РЕАЛЬНАЯ попытка изменить такой ключ (incoming ≠ old) пишется в аудит и
// возвращается клиенту в поле rejected_keys (P2-05 — «structured partial-save response»).

// Дефолтные рабочие области ролей — зеркало DEFAULTS в os/v3520-workspaces.js.
function default_role_views(): array { return asaas_workspace_default_views(); }


// Серверный аналог hardAllowed() из os/v3520-workspaces.js — по флагам роли из таблицы roles
// ($u имеет leasing/finance/admin/edit/... из current_user()). «external»/«brandsOnly» на
// сервере отдельными колонками не хранятся; доступ определяется только матрицей рабочих областей.
function server_hard_allowed(array $u, string $v): bool { return asaas_workspace_hard_allowed($u, $v); }


// Фактические рабочие области пользователя = ROLE_WORKSPACES[role] (или дефолт роли),
// затем перекрытие USER_WORKSPACES[userKey].views (mode:'custom'), отфильтрованное по
// server_hard_allowed(). dash присутствует всегда. USER_WORKSPACES у клиента ключуется по
// id/email/role — пробуем все три.
function effective_views_for(array $u, ?array $oldData): array { return asaas_workspace_effective_views($u, is_array($oldData) ? $oldData : []); }


// Карта «раздел (view) → верхнеуровневые ключи state, которые он редактирует». Намеренно
// щедрая внутри раздела (пропущенный ключ молча откатил бы легитимную правку), но строгая
// между разделами. Ключ, не принадлежащий ни одному доступному разделу, восстанавливается.
function workspace_view_keys(): array {
  return [
    'work_tasks'=>['CASE_TASKS','CASE_SCOPE_ITEMS','CASE_DELIVERABLES'],
    'work_kanban'=>['CASE_TASKS'],
    'workload'=>['CASE_TASKS'],
    'work_approvals'=>['CASE_SCOPE_CHANGES','CASE_PROPOSALS','CASE_CONTRACTS','CASE_DELIVERABLES'],
    'crm_clients'=>['CASE_CLIENTS','CASE_OPPORTUNITIES'],
    'advisory_pipeline'=>['CASE_CLIENTS','CASE_OPPORTUNITIES'],
    'advisory_proposal_builder'=>['CASE_PROPOSALS','CASE_SCOPE_ITEMS','CASE_PROPOSAL_CATALOG','CASE_DOCUMENT_TEMPLATES'],
    'advisory_portfolio_map'=>['CASE_PORTFOLIO_PROJECTS','MAPCFG'],
    'advisory_proposals'=>['CASE_PROPOSALS','CASE_SCOPE_ITEMS','CASE_DOCUMENT_TEMPLATES','CASE_PROPOSAL_CATALOG'],
    'advisory_contracts'=>['CASE_CONTRACTS','CASE_PROPOSALS','CASE_SCOPE_ITEMS','OBJECTS'],
    'project_contracts'=>['CASE_CONTRACTS','CASE_PROPOSALS','CASE_SCOPE_ITEMS','OBJECTS'],
    'advisory_scope'=>['CASE_SCOPE_ITEMS','CASE_SCOPE_CHANGES','CASE_TASKS','CASE_DELIVERABLES'],
    'advisory_delivery'=>['CASE_TASKS','CASE_SCOPE_ITEMS','CASE_DELIVERABLES','CASE_DECISIONS'],
    'advisory_reports'=>['CASE_DELIVERABLES','CASE_TASKS'],
    'advisory_cross_sell'=>['CASE_OPPORTUNITIES','CASE_CONTRACTS'],
    'project_workspace'=>['CASE_TASKS','CASE_SCOPE_ITEMS','CASE_DELIVERABLES','CASE_CONTRACTS','CASE_LAYOUT_VERSIONS','CASE_DECISIONS'],
    'project_layouts'=>['CASE_LAYOUT_VERSIONS','PLANUP','PLANSVG','PLAN_LABELPOS','PLAN_CODES','PLAN_STRUCT'],
    'leasing_layouts'=>['CASE_LAYOUT_VERSIONS','PLANUP','PLANSVG','PLAN_LABELPOS','PLAN_CODES','PLAN_STRUCT'],
    'plan_master'=>['CASE_LAYOUT_VERSIONS','PLANUP','PLANSVG','PLAN_LABELPOS','PLAN_CODES','PLAN_STRUCT','U','OBJECTS','CHANGES'],
    'leasing_portfolio_map'=>['CASE_PORTFOLIO_PROJECTS','MAPCFG'],
    'document_templates'=>['CASE_DOCUMENT_TEMPLATES'],
    'case_projects'=>['OBJECTS'],
    'map'=>['MAPCFG','GEO_DATA','CASE_PORTFOLIO_PROJECTS','OBJECTS'],
    'analytics_hub'=>['GEO_DATA','MAPCFG'],
    'geoanalytics'=>['GEO_DATA','MAPCFG','CASE_PORTFOLIO_PROJECTS'],
    'registry'=>['OBJECTS','U','CHANGES','PROJECT_PPT'],
    'dates'=>['OBJECTS'],
    'plans'=>['PLANUP','PLANSVG','PLAN_LABELPOS','PLAN_CODES','PLAN_STRUCT'],
    'brands'=>['BRANDS'],
    'docs'=>['DOCREG','DOC_CONTACTS','KPSEQ'],
    'bench'=>['BENCH','REFUSALS'],
    'v32_requests'=>['BRAND_REQUESTS'],
    'v32_investors'=>['INVESTOR_REQUESTS'],
    'v32_demand'=>['BRAND_REQUESTS','INVESTOR_REQUESTS'],
    'v32_sales'=>['SALES_ASSETS','SALES_BUYERS'],
    'v32_partners'=>['CASE_PARTNERS','PARTNER_REFERRALS'],
    'v326_lease'=>['LEASE_COMMISSION_DEALS','COMMISSION_ENGINE_CFG','COMMLOST'],
    'v326_suppliers'=>['SUPPLIERS','SUPPLIER_COMMISSION_DEALS','SUPPLIER_COMMISSION_LEDGER','COMMCFG'],
    'kpi'=>['KPI_TARGETS'],
    'study'=>['QUIZLOG','QUIZSTATS','KB','KBPROG'],
    'org'=>['AGENTS','HRPROF'],
  ];
}
// Универсальные, низкочувствительные ключи, доступные всем вошедшим редакторам (иначе откат
// ломал бы UX): чат и корзина по разделам, служебные заметки.
function baseline_state_keys(): array { return ['CHAT','TRASH','V32_NOTES']; }


// Серверная валидация геослоя. Клиентская форма удобна, но не является защитой:
// редактор мог отправить прямой POST с 0,0, неверным enum алкоголя или дублирующим master_id.
// Sanitize in place instead of hard-rejecting the whole save (see geo_state.php for
// the primary geo path). One legacy scheme-less URL or blank/zero coord used to abort
// the entire save; now such quirks are healed, only structural/size problems hard-fail.
function validate_geo_state_payload(&$geo): void {
  if (!is_array($geo)) fail('GEO_DATA должен быть объектом', 400);
  if (!isset($geo['datasets']) || !is_array($geo['datasets'])) fail('GEO_DATA.datasets должен быть объектом', 400);
  $alcohol = ['unknown','yes','no','limited','seasonal'];
  $alcoholVerification = ['not_checked','official_menu','phone','field','owner'];
  $urlKeys = ['website','sourceUrl','googleUrl','yandexUrl','dgisUrl','alcoholSourceUrl'];
  $total = 0;
  foreach ($geo['datasets'] as $name=>&$rows) {
    if (!is_array($rows)) continue; // object datasets: districts, market, prices, etc.
    $total += count($rows);
    if ($total > 100000) fail('Слишком много записей в GEO_DATA', 413);
    foreach ($rows as $i=>&$row) {
      if (!is_array($row)) continue; // population may be compact numeric arrays
      $latKey = $name === 'medicine' ? 'la' : 'lat';
      $lngKey = $name === 'medicine' ? 'ln' : 'lng';
      $hasLat = array_key_exists($latKey, $row) && $row[$latKey] !== '' && $row[$latKey] !== null;
      $hasLng = array_key_exists($lngKey, $row) && $row[$lngKey] !== '' && $row[$lngKey] !== null;
      if ($hasLat || $hasLng) {
        $bad = (!$hasLat || !$hasLng || !is_numeric($row[$latKey]) || !is_numeric($row[$lngKey]));
        if (!$bad) {
          $lat = (float)$row[$latKey]; $lng = (float)$row[$lngKey];
          if (($lat === 0.0 && $lng === 0.0) || $lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) $bad = true;
        }
        if ($bad) { unset($row[$latKey]); unset($row[$lngKey]); }
      }
      foreach ($urlKeys as $urlKey) {
        if (!array_key_exists($urlKey, $row)) continue;
        $url = trim((string)$row[$urlKey]);
        if ($url === '' || preg_match('~^https?://~i', $url)) { $row[$urlKey] = $url; continue; }
        if (preg_match('~^(www\.)?([a-z0-9-]+\.)+[a-z]{2,}([/?#].*)?$~i', $url)) $row[$urlKey] = 'https://'.$url;
        else $row[$urlKey] = '';
      }
      if ($name === 'restaurants' || $name === 'cafes') {
        if (!in_array((string)($row['alcoholStatus'] ?? 'unknown'), $alcohol, true)) $row['alcoholStatus'] = 'unknown';
        if (!in_array((string)($row['alcoholVerification'] ?? 'not_checked'), $alcoholVerification, true)) $row['alcoholVerification'] = 'not_checked';
      }
    }
    unset($row);
  }
  unset($rows);
}


// Пользователи без глобального edit могут работать в новом workflow-контуре,
// если администратор открыл им соответствующий модуль. Это отделяет право
// выполнять свои задачи/вести Advisory от права редактировать мастер-реестры.
function workflow_state_write_allowed(array $u, ?array $state=null): bool {
  if (!empty($u['admin']) || !empty($u['edit'])) return true;
  $writeViews = [
    'work_tasks','work_kanban','workload','work_approvals','crm_clients',
    'advisory_pipeline','advisory_proposals','advisory_contracts','project_contracts',
    'advisory_scope','advisory_delivery','advisory_reports','advisory_cross_sell',
    'project_workspace','project_layouts','leasing_layouts','document_templates'
  ];
  $views = effective_views_for($u, $state);
  return count(array_intersect($writeViews, $views)) > 0;
}

// Ограничение общего state blob по назначенным проектам. Внешний участник не должен
// читать или случайно затереть задачи/документы других проектов при обычном save round-trip.
function workflow_project_key_fields(): array {
  return [
    'CASE_TASKS'=>'projectId','CASE_SCOPE_ITEMS'=>'projectId','CASE_SCOPE_CHANGES'=>'projectId',
    'CASE_DELIVERABLES'=>'projectId','CASE_LAYOUT_VERSIONS'=>'projectId','CASE_DECISIONS'=>'projectId',
    'CASE_CONTRACTS'=>'projectId'
  ];
}
function workflow_row_allowed_for_user(array $row, string $field, array $u): bool {
  if (empty($u['project_scope'])) return true;
  $allowed = is_array($u['projects'] ?? null) ? array_map('strval', $u['projects']) : [];
  $pid = (string)($row[$field] ?? '');
  if ($pid !== '' && in_array($pid, $allowed, true)) return true;
  // Личная несвязанная задача остаётся доступной своему исполнителю.
  if ($field === 'projectId' && (string)($row['assigneeId'] ?? '') === (string)($u['id'] ?? '')) return true;
  return false;
}
function redact_workflow_project_scope(array $data, array $u): array {
  if (empty($u['project_scope'])) return $data;
  foreach (workflow_project_key_fields() as $key=>$field) {
    if (!isset($data[$key]) || !is_array($data[$key])) continue;
    $data[$key] = array_values(array_filter($data[$key], function($row) use ($field,$u) {
      return is_array($row) && workflow_row_allowed_for_user($row, $field, $u);
    }));
  }
  return $data;
}

// Какие верхнеуровневые ключи роль ДЕЙСТВИТЕЛЬНО может менять этим эндпоинтом.
// null = без ограничения только для администратора. Finance-право не обходит матрицу разделов.
// вычисляется из фактических рабочих областей. ACTLOG/AUDIT/ROLES/USERS никогда не входят
// (системные/аудиторские, см. P2-01), ROLE_WORKSPACES/USER_WORKSPACES защищены отдельным
// блоком ниже.
function role_allowed_state_keys(array $u, ?array $oldData=null): ?array {
  if (!empty($u['admin'])) return null;
  $views = effective_views_for($u, $oldData);
  $map = workspace_view_keys();
  $allowed = baseline_state_keys();
  foreach ($views as $v) { foreach (($map[$v] ?? []) as $k) { if (!in_array($k, $allowed, true)) $allowed[] = $k; } }
  // системные ключи под запретом для любой не-админской роли
  $allowed = array_values(array_diff($allowed, ['USERS','ROLES','ACTLOG','AUDIT','ROLE_WORKSPACES','USER_WORKSPACES']));
  // Просмотр геоаналитики не равен праву редактировать мастер-базу. BA/BSH/HM могут
  // видеть карту могут пользователи с модулем; GEO_DATA меняют только пользователи с edit/finance/admin rights.
  if (!asaas_geo_can_edit($u)) $allowed = array_values(array_diff($allowed, ['GEO_DATA']));
  return $allowed;
}

// Ключи, которые роль может ЧИТАТЬ. В отличие от role_allowed_state_keys(), здесь
// GEO_DATA остаётся у read-only пользователей геоаналитики, чтобы они видели ручные
// правки администратора, но POST всё равно отклонит их попытку изменить этот ключ.
function role_visible_state_keys(array $u, ?array $state=null): ?array {
  if (!empty($u['admin'])) return null;
  $views = effective_views_for($u, $state);
  $map = workspace_view_keys();
  $visible = baseline_state_keys();
  foreach ($views as $v) { foreach (($map[$v] ?? []) as $k) { if (!in_array($k, $visible, true)) $visible[] = $k; } }
  return array_values(array_diff($visible, ['USERS','ROLES','ACTLOG','AUDIT','ROLE_WORKSPACES','USER_WORKSPACES']));
}

if ($m === 'GET') {
  $st = db()->query('SELECT data, updated_at, updated_by, revision FROM app_state WHERE id=1');
  $row = $st->fetch();
  $data = ($row && $row['data']) ? json_decode($row['data'], true) : null;
  if (is_array($data)) {
    $fullData = $data;
    $data = redact_shared_state($data, $u);
    $data = redact_workflow_project_scope($data, $u);
    // Чтение теперь ограничено той же рабочей областью, что и запись. Раньше скрытый
    // GEO_DATA всё ещё возвращался агенту через state.php, хотя меню и geo_master.php
    // его не показывали. Для не-админских ролей отдаём только ключи разрешённых модулей.
    $visibleKeys = role_visible_state_keys($u, $fullData);
    if ($visibleKeys !== null) {
      $keep = array_flip(array_merge($visibleKeys, ['ROLE_WORKSPACES','USER_WORKSPACES','MODULE_FLAGS']));
      foreach (array_keys($data) as $key) if (!isset($keep[$key])) unset($data[$key]);
      $visibleCfg = asaas_workspace_visible_config($u, $fullData);
      $data['ROLE_WORKSPACES'] = $visibleCfg['ROLE_WORKSPACES'];
      $data['USER_WORKSPACES'] = $visibleCfg['USER_WORKSPACES'];
      $data['MODULE_FLAGS'] = $visibleCfg['MODULE_FLAGS'];
    }
  }
  json_out(['data'=>$data, 'updated_at'=>$row['updated_at'] ?? null, 'updated_by'=>$row['updated_by'] ?? null, 'revision'=>(int)($row['revision'] ?? 0)]);
}

if ($m === 'POST') {
  $b = body();
  if (!array_key_exists('data', $b)) fail('Нужно поле data', 400);
  $incoming = is_array($b['data']) ? $b['data'] : [];
  // Старое состояние читаем для всех ролей: оно нужно не только ACL, но и чтобы
  // валидировать GEO_DATA лишь при реальном изменении, не блокируя обычное сохранение
  // из-за исторической записи, которую пользователь в этом запросе не трогал.
  $oldSt = db()->query('SELECT data FROM app_state WHERE id=1');
  $oldRow = $oldSt->fetch();
  $oldData = ($oldRow && $oldRow['data']) ? json_decode($oldRow['data'], true) : [];
  if (!is_array($oldData)) $oldData = [];
  if (!workflow_state_write_allowed($u, $oldData)) fail('Нет прав на сохранение', 403);
  // Настройки рабочих областей являются управленческой конфигурацией.
  // Их может менять любая роль с административным правом; сохранения остальных ролей
  // не должны случайно перезаписывать эту часть общего state blob.
  if (!can('admin')) {
    foreach (['ROLE_WORKSPACES','USER_WORKSPACES','MODULE_FLAGS'] as $protectedKey) {
      if (is_array($oldData) && array_key_exists($protectedKey, $oldData)) $incoming[$protectedKey] = $oldData[$protectedKey];
      else unset($incoming[$protectedKey]);
    }
  }
  // Feature flags are an admin-only configuration. Keep only known module IDs and valid
  // lifecycle states, and never persist a flag for protected system modules (Home / Settings).
  if (can('admin') && array_key_exists('MODULE_FLAGS', $incoming)) {
    $known = array_flip(asaas_known_module_ids());
    $protected = array_flip(asaas_protected_module_ids());
    $cleanFlags = [];
    foreach ((array)$incoming['MODULE_FLAGS'] as $moduleId=>$rec) {
      $moduleId = (string)$moduleId;
      if (!isset($known[$moduleId]) || isset($protected[$moduleId])) continue;
      $status = is_string($rec) ? $rec : (is_array($rec) ? (string)($rec['status'] ?? '') : '');
      if (!in_array($status, ['active','beta','hidden','disabled','deprecated'], true)) continue;
      $cleanFlags[$moduleId] = [
        'status'=>$status,
        'updatedAt'=>substr((string)(is_array($rec) ? ($rec['updatedAt'] ?? '') : ''), 0, 40),
        'updatedBy'=>substr((string)(is_array($rec) ? ($rec['updatedBy'] ?? '') : ''), 0, 160),
      ];
    }
    $incoming['MODULE_FLAGS'] = $cleanFlags;
  }

  // Не давать роли переписать модули вне её фактической рабочей области через прямой POST в
  // обход того, что UI просто скрывает пункты меню (P0-01). Разрешённые ключи вычисляются из
  // рабочих областей роли/пользователя (см. role_allowed_state_keys ниже). Каждый ключ вне
  // списка восстанавливается из уже сохранённого состояния. Настоящая попытка изменить такой
  // ключ (incoming ≠ old) фиксируется в аудите и возвращается в rejected_keys.
  $rejectedKeys = [];
  $allowedKeys = role_allowed_state_keys($u, $oldData);
  if ($allowedKeys !== null) {
    $restrictedKeys = array_diff(all_shared_state_keys(), $allowedKeys, ['ROLE_WORKSPACES','USER_WORKSPACES','MODULE_FLAGS']);
    foreach ($restrictedKeys as $rkKey) {
      $hadOld = is_array($oldData) && array_key_exists($rkKey, $oldData);
      $clientSent = array_key_exists($rkKey, $incoming);
      // настоящая попытка записи в закрытый раздел: клиент прислал значение, отличное от старого
      if ($clientSent && (!$hadOld || $incoming[$rkKey] !== $oldData[$rkKey])) $rejectedKeys[] = $rkKey;
      if ($hadOld) $incoming[$rkKey] = $oldData[$rkKey];
      else unset($incoming[$rkKey]);
    }
    if ($rejectedKeys) {
      try { audit('state_key_denied', 'role='.(string)($u['role_key'] ?? '-').' keys='.implode(',', $rejectedKeys)); } catch (Throwable $e) {}
    }
  }
  // A non-finance, non-admin caller only ever received their OWN rows for these keys
  // (see redact_shared_state() on GET above) — so a normal save round-trip must not be
  // allowed to overwrite everyone else's rows with that incomplete picture. Splice the
  // client's own rows (identity-checked, not trusted as-is) back into the untouched rest
  // of the server's copy instead of accepting the client's version of these keys wholesale.
  $geoChanged = array_key_exists('GEO_DATA', $incoming) && (($oldData['GEO_DATA'] ?? null) !== $incoming['GEO_DATA']);
  if ($geoChanged) {
    // Начиная с v4.9.7 GEO_DATA сохраняется только через транзакционный geo_state.php.
    // Общий state blob может быть устаревшим из-за параллельной работы других отделов и
    // не имеет права откатывать ручные правки геоаналитики.
    $rejectedKeys[] = 'GEO_DATA';
    if (array_key_exists('GEO_DATA',$oldData)) $incoming['GEO_DATA'] = $oldData['GEO_DATA'];
    else unset($incoming['GEO_DATA']);
  }

  if (!can('admin') && !can('finance')) {
    $me = owner_identity($u); // единая функция (lib.php) - P2-04
    foreach (['BRAND_REQUESTS'=>'broker','SALES_ASSETS'=>'broker','SALES_BUYERS'=>'broker',
              'INVESTOR_REQUESTS'=>'broker','PARTNER_REFERRALS'=>'broker','CASE_PARTNERS'=>'owner',
              'LEASE_COMMISSION_DEALS'=>'broker','SUPPLIER_COMMISSION_DEALS'=>'owner'] as $key=>$field) {
      $oldRows = (is_array($oldData) && isset($oldData[$key]) && is_array($oldData[$key])) ? $oldData[$key] : [];
      $othersOld = array_values(array_filter($oldRows, function($r) use ($field,$me) { return !(is_array($r) && (string)($r[$field] ?? '')===$me && $me!==''); }));
      $incomingRows = (isset($incoming[$key]) && is_array($incoming[$key])) ? $incoming[$key] : [];
      $ownIncoming = array_values(array_filter($incomingRows, function($r) use ($field,$me) { return is_array($r) && (string)($r[$field] ?? '')===$me && $me!==''; }));
      $incoming[$key] = array_merge($othersOld, $ownIncoming);
    }
  }
  // Для project_scope пользователя сохраняем нетронутыми строки чужих проектов.
  if (!empty($u['project_scope'])) {
    foreach (workflow_project_key_fields() as $key=>$field) {
      $oldRows = (isset($oldData[$key]) && is_array($oldData[$key])) ? $oldData[$key] : [];
      $othersOld = array_values(array_filter($oldRows, function($row) use ($field,$u) {
        return !(is_array($row) && workflow_row_allowed_for_user($row, $field, $u));
      }));
      $incomingRows = (isset($incoming[$key]) && is_array($incoming[$key])) ? $incoming[$key] : [];
      $allowedIncoming = array_values(array_filter($incomingRows, function($row) use ($field,$u) {
        return is_array($row) && workflow_row_allowed_for_user($row, $field, $u);
      }));
      $incoming[$key] = array_merge($othersOld, $allowedIncoming);
    }
  }

  $json = json_encode($incoming, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось сериализовать состояние', 400);
  if (strlen($json) > json_body_limit_bytes()) fail('Состояние слишком большое для безопасного сохранения', 413);
  $now  = date('Y-m-d H:i:s');
  $pdo  = db();
  $st = $pdo->query('SELECT revision FROM app_state WHERE id=1');
  $row = $st->fetch();
  $clientRev = array_key_exists('revision', $b) ? (int)$b['revision'] : null;
  if ($row) {
    $serverRev = (int)($row['revision'] ?? 0);
    if ($clientRev !== null && $clientRev !== $serverRev) {
      fail('Данные уже изменены другим пользователем. Обновите страницу и повторите действие.', 409);
    }
    $newRev = $serverRev + 1;
    $pdo->prepare('UPDATE app_state SET data=?, updated_at=?, updated_by=?, revision=? WHERE id=1')
        ->execute([$json, $now, $u['name'] ?? '-', $newRev]);
  } else {
    $newRev = 1;
    $pdo->prepare('INSERT INTO app_state (id, data, updated_at, updated_by, revision) VALUES (1,?,?,?,?)')
        ->execute([$json, $now, $u['name'] ?? '-', $newRev]);
  }
  json_out(['ok'=>true, 'updated_at'=>$now, 'revision'=>$newRev] + (!empty($rejectedKeys) ? ['rejected_keys'=>array_values(array_unique($rejectedKeys))] : []));
}

fail('Метод не поддерживается', 405);
