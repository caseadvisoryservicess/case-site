<?php
// CASE OS v4.77.0: обратная связь. Пользователь пишет из платформы (предложение, проблема, вопрос),
// внешний Telegram-бот пересылает сообщения сюда с токеном, администратор видит очередь,
// меняет статус и отвечает; пользователь видит ответ в личном кабинете.
require __DIR__.'/lib.php';
feedback_ensure_table();
$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$KINDS = ['idea','problem','question'];
$STATUSES = ['new','seen','done'];

if ($m === 'GET') {
  $u = require_login();
  if (isset($_GET['count'])) {
    if (empty($u['admin'])) json_out(['new'=>0]);
    $n = 0; try { $n = (int)db()->query("SELECT COUNT(*) FROM feedback WHERE status='new'")->fetchColumn(); } catch (Throwable $e) {}
    json_out(['new'=>$n]);
  }
  if (isset($_GET['mine']) || empty($u['admin'])) {
    $st = db()->prepare('SELECT id,kind,text,page,status,reply,created_at,updated_at FROM feedback WHERE user_id=? ORDER BY id DESC LIMIT 100');
    $st->execute([(string)$u['id']]);
    json_out(['rows'=>$st->fetchAll()]);
  }
  $lim = max(20, min(500, (int)($_GET['limit'] ?? 300)));
  $st = db()->query('SELECT id,user_id,user_name,user_email,channel,kind,text,page,status,reply,replied_by,created_at,updated_at FROM feedback ORDER BY id DESC LIMIT '.$lim);
  json_out(['rows'=>$st->fetchAll()]);
}

if ($m === 'POST') {
  $raw = file_get_contents('php://input');
  $peek = json_decode((string)$raw, true);
  /* бот с внешнего хостинга: без сеанса и CSRF, только по секретному токену из config.php */
  if (is_array($peek) && ($peek['action'] ?? '') === 'bot') {
    $tok = feedback_bot_token();
    if ($tok === '' || !hash_equals($tok, (string)($peek['token'] ?? ''))) fail('Неверный токен бота', 403);
    $text = mb_substr(trim((string)($peek['text'] ?? '')), 0, 4000);
    if ($text === '') fail('Пустое сообщение', 400);
    $from = mb_substr(trim((string)($peek['from_name'] ?? 'Telegram')), 0, 120);
    $fromId = mb_substr(trim((string)($peek['from_id'] ?? '')), 0, 60);
    $kind = in_array((string)($peek['kind'] ?? ''), $KINDS, true) ? (string)$peek['kind'] : 'question';
    db()->prepare('INSERT INTO feedback (user_id,user_name,user_email,channel,kind,text,page,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      ->execute([null, 'Telegram: '.$from, $fromId !== '' ? 'tg:'.$fromId : null, 'telegram', $kind, $text, null, 'new', date('Y-m-d H:i:s')]);
    $id = (int)db()->lastInsertId();
    try { db()->exec('COMMIT'); } catch (Throwable $e) {}
    try { $st = db()->prepare('INSERT INTO audit_log (by_id,by_name,role_key,action,detail) VALUES (?,?,?,?,?)'); $st->execute([null, 'Telegram-бот', '-', 'Обращение из Telegram', '#'.$id.' '.$from]); } catch (Throwable $e) {}
    json_out(['ok'=>true,'id'=>$id]);
  }
  $u = require_login();
  $b = body();
  $a = (string)($b['action'] ?? 'send');
  if ($a === 'send') {
    $text = mb_substr(trim((string)($b['text'] ?? '')), 0, 4000);
    if (mb_strlen($text) < 3) fail('Напишите сообщение', 400);
    $kind = in_array((string)($b['kind'] ?? ''), $KINDS, true) ? (string)$b['kind'] : 'idea';
    $page = mb_substr(trim((string)($b['page'] ?? '')), 0, 190);
    /* защита от потока: не больше 20 обращений от одной учётной записи за 10 минут (throttle из auth.php здесь не подключён) */
    try { $st = db()->prepare('SELECT COUNT(*) FROM feedback WHERE user_id=? AND created_at>?'); $st->execute([(string)$u['id'], date('Y-m-d H:i:s', time() - 600)]); $n = (int)$st->fetchColumn(); } catch (Throwable $e) { $n = 0; /* счётчик недоступен: пропускаем */ }
    if ($n >= 20) fail('Слишком много обращений подряд. Повторите через несколько минут.', 429);
    db()->prepare('INSERT INTO feedback (user_id,user_name,user_email,channel,kind,text,page,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      ->execute([(string)$u['id'], (string)($u['name'] ?? ''), (string)($u['email'] ?? ''), is_demo_user($u) ? 'demo' : 'app', $kind, $text, $page, 'new', date('Y-m-d H:i:s')]);
    $id = (int)db()->lastInsertId();
    try { db()->exec('COMMIT'); } catch (Throwable $e) {}
    audit('Обращение отправлено', '#'.$id.' '.$kind);
    json_out(['ok'=>true,'id'=>$id]);
  }
  if ($a === 'status') {
    if (empty($u['admin'])) fail('Только администратор', 403);
    $id = (int)($b['id'] ?? 0); if ($id <= 0) fail('Нужен id обращения', 400);
    $status = in_array((string)($b['status'] ?? ''), $STATUSES, true) ? (string)$b['status'] : 'seen';
    $reply = array_key_exists('reply', $b) ? mb_substr(trim((string)$b['reply']), 0, 4000) : null;
    if ($reply !== null) db()->prepare('UPDATE feedback SET status=?, reply=?, replied_by=?, updated_at=? WHERE id=?')->execute([$status, $reply, (string)($u['name'] ?? ''), date('Y-m-d H:i:s'), $id]);
    else db()->prepare('UPDATE feedback SET status=?, updated_at=? WHERE id=?')->execute([$status, date('Y-m-d H:i:s'), $id]);
    try { db()->exec('COMMIT'); } catch (Throwable $e) {}
    audit('Обращение: статус '.$status, '#'.$id.($reply !== null ? ' с ответом' : ''));
    json_out(['ok'=>true]);
  }
  fail('Неизвестное действие', 400);
}
fail('Метод не поддерживается', 405);
