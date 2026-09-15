<?php
// CASE OS v4.71.0 - атомарная запись происхождения одного поля.
//
// Почему отдельный эндпоинт, а не общее сохранение состояния. Клиент сохраняет весь state
// целиком (index.html stateBlob), поэтому два сотрудника, подтвердившие разные ставки в
// одну минуту, затёрли бы правки друг друга - и заметил бы это не тот, кто затёр, а тот,
// чьё подтверждение исчезло. По этой же причине в платформе уже живут unit_patch.php и
// units_batch.php. Здесь пишется РОВНО ОДИН ключ карты PROV.
//
// Почему подтверждение нельзя принимать от клиента как есть. Запись «подтверждено» имеет
// цену: она снимает с числа оговорки и попадает в материалы клиенту. Если дату и автора
// присылает браузер, то подтвердить чужим именем и задним числом можно правкой одного
// поля в DevTools. Поэтому для conf=verified сервер ставит by и at сам, игнорируя
// присланные значения.
require __DIR__.'/lib.php';
$u = require_login();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') fail('Метод не поддерживается', 405);

// Право то же, что и на правку реестра: происхождение - это утверждение о данных, а не
// пометка для себя. Роли только для чтения его не ставят.
if (in_array((string)($u['role_key'] ?? ''), ['AGX','BSH','BRJ'], true)) fail('Для этой роли происхождение доступно только для просмотра', 403);
if (empty($u['edit']) && empty($u['admin'])) fail('Нет прав на изменение данных', 403);

$b = body();
$key = trim((string)($b['key'] ?? ''));
$rec = array_key_exists('rec', $b) ? $b['rec'] : null;

// Разбор ключа и очистка записи живут в lib.php (prov_parse_key, prov_clean_record):
// эндпоинт нельзя проверить без базы, а функции - можно.
$p = prov_parse_key($key);
if ($p === null) fail('Некорректный ключ происхождения или поле, за которым оно не ведётся', 400);
$entity = $p['entity']; $entityId = $p['id']; $field = $p['field'];

$clean = null;
if ($rec !== null) {
  try { $clean = prov_clean_record($rec, $u); }
  catch (InvalidArgumentException $e) { fail($e->getMessage(), 400); }
}

$pdo = db();
$pdo->beginTransaction();
try {
  $driver = (string)$pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
  $sql = 'SELECT data,revision FROM app_state WHERE id=1'.($driver === 'mysql' ? ' FOR UPDATE' : '');
  $row = $pdo->query($sql)->fetch();
  if (!$row) fail('Состояние платформы не найдено', 404);
  $data = json_decode((string)($row['data'] ?? ''), true);
  if (!is_array($data)) fail('Состояние платформы повреждено', 500);

  // Происхождение помещения проверяется по проекту этого помещения: иначе роль с доступом
  // к одному проекту помечала бы данные чужого.
  if ($entity === 'unit') {
    $objId = '';
    foreach ((isset($data['U']) && is_array($data['U'])) ? $data['U'] : [] as $unit) {
      if (is_array($unit) && (string)($unit['id'] ?? '') === $entityId) { $objId = (string)($unit['obj'] ?? ''); break; }
    }
    if ($objId === '') fail('Помещение не найдено', 404);
    if (!user_project_allowed($objId)) fail('Нет доступа к проекту', 403);
  } elseif ($entity === 'object') {
    if (!user_project_allowed($entityId)) fail('Нет доступа к проекту', 403);
  }

  // Ставка и бюджет - финансовые поля. Роль, которой цифру не показывают, не должна и
  // утверждать, откуда она взялась: такое утверждение само раскрывает, что цифра есть.
  if (in_array($field, unit_finance_fields(), true) && !unit_can_see_finance($u)) {
    fail('Нет прав на финансовые поля', 403);
  }

  // Пустой объект {} после json_decode становится [] - для строковых ключей это одно и то же.
  $prov = (isset($data['PROV']) && is_array($data['PROV'])) ? $data['PROV'] : [];
  if ($clean === null) unset($prov[$key]); else $prov[$key] = $clean;
  $data['PROV'] = $prov;

  $json = json_encode($data, JSON_UNESCAPED_UNICODE);
  if ($json === false) fail('Не удалось сериализовать состояние', 500);
  if (strlen($json) > json_body_limit_bytes()) fail('Состояние слишком большое для сохранения', 413);
  $now = date('Y-m-d H:i:s');
  $newRev = (int)($row['revision'] ?? 0) + 1;
  $pdo->prepare('UPDATE app_state SET data=?, updated_at=?, updated_by=?, revision=? WHERE id=1')
      ->execute([$json, $now, (string)($u['name'] ?? '-'), $newRev]);
  try {
    audit('Происхождение: '.($clean === null ? 'снято' : $clean['conf']),
          $key.($clean === null ? '' : ' · '.$clean['src'].($clean['name'] !== '' ? ' · '.$clean['name'] : '')));
  } catch (Throwable $e) {}
  $pdo->commit();
  json_out(['ok'=>true,'key'=>$key,'rec'=>$clean,'revision'=>$newRev,'updated_at'=>$now]);
} catch (Throwable $e) {
  if ($pdo->inTransaction()) $pdo->rollBack();
  if ($e instanceof PDOException) fail('Не удалось сохранить происхождение', 500);
  throw $e;
}
