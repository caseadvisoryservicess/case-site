<?php
// CASE OS — ядро бэкенда (подключение к БД, сессии, права, реестр таблиц).
declare(strict_types=1);
mb_internal_encoding('UTF-8');

// ── Сессия ────────────────────────────────────────────────────────────
session_set_cookie_params(['lifetime'=>0,'path'=>'/','httponly'=>true,'samesite'=>'Lax']);
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
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function fail(string $msg, int $code=400): void { json_out(['error'=>$msg], $code); }
function body(): array {
  $raw = file_get_contents('php://input');
  $j = json_decode($raw ?: '[]', true);
  return is_array($j) ? $j : [];
}
function uuid(): string {
  $d = random_bytes(16); $d[6]=chr((ord($d[6])&0x0f)|0x40); $d[8]=chr((ord($d[8])&0x3f)|0x80);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d),4));
}

// ── Текущий пользователь и права ──────────────────────────────────────
function current_user(): ?array {
  if (empty($_SESSION['uid'])) return null;
  static $u = null;
  if ($u && $u['id']===$_SESSION['uid']) return $u;
  try {
    $st = db()->prepare('SELECT u.id,u.email,u.name,u.title,u.role_key,u.broker_name,u.projects,u.active,
        r.label AS role_label,r.leasing,r.finance,r.edit,r.approve,r.plans,r.own_only,r.project_scope,r.admin
      FROM app_users u JOIN roles r ON r.`key`=u.role_key WHERE u.id=?');
    $st->execute([$_SESSION['uid']]);
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
  return $u;
}
function require_login(): array {
  $u = current_user();
  if (!$u || !$u['active']) fail('Не авторизован', 401);
  return $u;
}
function can(string $p): bool {
  $u = current_user();
  return $u ? (bool)($u[$p] ?? false) : false;
}
function audit(string $action, string $detail=''): void {
  $u = current_user();
  $st = db()->prepare('INSERT INTO audit_log (by_id,by_name,role_key,action,detail) VALUES (?,?,?,?,?)');
  $st->execute([$u['id']??null, $u['name']??'-', $u['role_key']??'-', $action, $detail]);
}

// ── Реестр таблиц (белый список) ──────────────────────────────────────
function tables(): array {
  return [
    'objects'=>['pk'=>'id','idtype'=>'text','cols'=>['id','name','ru','country','city','type','gba','gla','plan','sc','inc','cur','cond','levels','vat','vat_rate','comm'],'json'=>['comm'],'read'=>'leasing','write'=>'edit','proj_scope'=>'id'],
    'units'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','code','floor','area','terr','cat','sub','rate','budget','status','broker','assigned_to','vars','shortlist','merged','offer'],'json'=>['vars','shortlist','merged','offer'],'finance'=>['rate','budget'],'read'=>'leasing','write'=>'edit','own_only'=>'broker','proj_scope'=>'obj_id'],
    'brands'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','cat','sub','country','amin','amax','format','fr','reqs','coten','person','phone','email','site','ig','status','notes','about','pos','concept','rec','founded','group','price','icsc','uz_op','net_pts','net_countries','logo','shopfront','interior','edited_by'],'read'=>'leasing','write'=>'edit'],
    'registry_changes'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','date','type','what','by_name'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'benchmarks'=>['pk'=>'id','idtype'=>'auto','cols'=>['city','district','obj','cat','rent','sc','note'],'read'=>'leasing','write'=>'edit'],
    'refusals'=>['pk'=>'id','idtype'=>'auto','cols'=>['obj_id','brand','reason','date'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'control_dates'=>['pk'=>'id','idtype'=>'auto','cols'=>['unit_id','label','date'],'read'=>'leasing','write'=>'edit'],
    'documents'=>['pk'=>'id','idtype'=>'auto','cols'=>['t','type','no','to_name','obj_id','lang','fname','status','ver','raw','by_id'],'read'=>'leasing','write'=>'edit','proj_scope'=>'obj_id'],
    'contacts'=>['pk'=>'id','idtype'=>'auto','cols'=>['name','title','phone','email'],'read'=>'leasing','write'=>'edit'],
    'agent_metrics'=>['pk'=>'user_id','idtype'=>'text','cols'=>['user_id','touch','meet','view','loi','sign','earned','pipe'],'read'=>'leasing','write'=>'edit'],
    'kp_counters'=>['pk'=>'obj_id','idtype'=>'text','cols'=>['obj_id','last_no'],'read'=>'leasing','write'=>'edit'],
    'roles'=>['pk'=>'key','idtype'=>'text','cols'=>['key','label','leasing','finance','edit','approve','plans','own_only','project_scope','admin'],'read'=>'leasing','write'=>'admin'],
    'app_users'=>['pk'=>'id','idtype'=>'uuid','cols'=>['id','email','name','title','role_key','broker_name','projects','active'],'json'=>['projects'],'read'=>'leasing','write'=>'admin'],
    'activity_log'=>['pk'=>'id','idtype'=>'auto','cols'=>['kind','by_id','obj_id'],'read'=>'leasing','write'=>'leasing'],
    'audit_log'=>['pk'=>'id','idtype'=>'auto','cols'=>['by_id','by_name','role_key','action','detail'],'read'=>'admin','write'=>null],
  ];
}
function q(string $id): string { return '`'.str_replace('`','',$id).'`'; } // безопасное имя столбца

// ── Чтение таблицы ────────────────────────────────────────────────────
function list_table(string $table, array $filters): array {
  $defs = tables(); if (!isset($defs[$table])) fail('Неизвестная таблица', 400);
  $d = $defs[$table];
  require_login();
  if (!can($d['read'])) fail('Нет доступа на чтение: '.$table, 403);
  $where = []; $args = [];
  // фильтр по объекту
  if (!empty($filters['obj']) && in_array('obj_id', array_merge($d['cols'],['obj_id']), true)) {
    $where[] = q('obj_id').'=?'; $args[] = $filters['obj'];
  }
  // own_only — агент видит только свои
  if (!empty($d['own_only']) && can('own_only') && !can('admin')) {
    $u = current_user();
    $where[] = q($d['own_only']).'=?'; $args[] = $u['broker_name'];
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
  $sql = 'SELECT * FROM '.q($table);
  if ($where) $sql .= ' WHERE '.implode(' AND ', $where);
  $st = db()->prepare($sql); $st->execute($args);
  $rows = $st->fetchAll();
  $fin = can('finance');
  foreach ($rows as &$row) {
    if (isset($row['password_hash'])) unset($row['password_hash']);
    foreach (($d['json']??[]) as $jc) if (isset($row[$jc]) && is_string($row[$jc])) $row[$jc] = json_decode($row[$jc], true);
    if (!$fin) foreach (($d['finance']??[]) as $fc) if (array_key_exists($fc,$row)) $row[$fc] = null;
  }
  return $rows;
}

// ── Запись (upsert) ───────────────────────────────────────────────────
function upsert_row(string $table, array $row): array {
  $defs = tables(); if (!isset($defs[$table])) fail('Неизвестная таблица', 400);
  $d = $defs[$table];
  require_login();
  if (empty($d['write']) || !can($d['write'])) fail('Нет доступа на запись: '.$table, 403);
  $pk = $d['pk'];
  $data = [];
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
  if ($exists) {
    $sets = []; $args = [];
    foreach ($data as $k=>$v) { if ($k===$pk) continue; $sets[]=q($k).'=?'; $args[]=$v; }
    if ($sets) { $args[]=$idval; $pdo->prepare('UPDATE '.q($table).' SET '.implode(',',$sets).' WHERE '.q($pk).'=?')->execute($args); }
  } else {
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
  return $saved;
}

// ── Удаление ──────────────────────────────────────────────────────────
function delete_row(string $table, $id): void {
  $defs = tables(); if (!isset($defs[$table])) fail('Неизвестная таблица', 400);
  $d = $defs[$table];
  require_login();
  if (empty($d['write']) || !can($d['write'])) fail('Нет доступа на запись: '.$table, 403);
  db()->prepare('DELETE FROM '.q($table).' WHERE '.q($d['pk']).'=?')->execute([$id]);
  audit('Удаление: '.$table, (string)$id);
}
