<?php
// CASE OS — критические даты: дневной дайджест по 90/60/30/7 дней и просрочкам.
// Запускается по cron (НЕ через веб — CLI-only), раз в день, напр.:
//   0 7 * * * /usr/bin/php /path/to/os/api/cron_critical_dates.php >> /path/to/os/api/cron_dates.log 2>&1
// Источник данных: та же общая state-таблица (app_state), что видит UI — отдельной
// таблицы дат в БД пока нет (см. ASAAS_OS_Upgrade_Spec_EN_prompt.md §3).
// Доставка: Telegram (Bot API) и/или e-mail (тот же SMTP, что и вход по коду —
// см. config.php 'smtp'). Пока получатели не настроены в notify_recipients.php —
// скрипт просто считает и печатает дайджест (безопасно для локальных тестов).
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(403); echo "CLI only\n"; exit(1); }

require __DIR__.'/lib.php';

function cron_recipients(): array {
  // Формат: [ ['broker' => 'Нодир', 'telegram_chat_id' => '123456789', 'email' => 'nodir@example.com'], ... ]
  // 'broker' сопоставляется с полем u.broker юнита. Пустой broker => общий дайджест (ASH/ADM).
  $f = __DIR__.'/notify_recipients.php';
  if (is_file($f)) { $r = require $f; return is_array($r) ? $r : []; }
  return [];
}

// Скопировано из auth.php::smtp_send() — намеренно отдельная копия, чтобы cron
// не подключал auth.php целиком (тот при include исполняет обработку HTTP-запроса).
function cron_smtp_send(array $smtp, string $from, string $to, string $subject, string $body): bool {
  $host = $smtp['host'] ?? ''; if (!$host) return false;
  $port = (int)($smtp['port'] ?? 465);
  $secure = $smtp['secure'] ?? 'ssl';
  $user = (string)($smtp['user'] ?? ''); $pass = (string)($smtp['pass'] ?? '');
  $timeout = 12;
  $remote = ($secure === 'ssl' ? 'ssl://' : '').$host.':'.$port;
  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout);
  if (!$fp) return false;
  stream_set_timeout($fp, $timeout);
  $read = function() use ($fp) { $d=''; while (($l = fgets($fp, 515)) !== false) { $d .= $l; if (strlen($l) < 4 || $l[3] !== '-') break; } return $d; };
  $cmd  = function($c) use ($fp, $read) { fwrite($fp, $c."\r\n"); return $read(); };
  $is   = function($resp, $codes) { return in_array(substr($resp, 0, 3), (array)$codes, true); };
  $bye  = function() use ($fp) { @fclose($fp); return false; };
  if (!$is($read(), '220')) return $bye();
  if (!$is($cmd('EHLO caseos.local'), '250')) return $bye();
  if ($secure === 'tls') {
    if (!$is($cmd('STARTTLS'), '220')) return $bye();
    if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return $bye();
    if (!$is($cmd('EHLO caseos.local'), '250')) return $bye();
  }
  if ($user !== '') {
    if (!$is($cmd('AUTH LOGIN'), '334')) return $bye();
    if (!$is($cmd(base64_encode($user)), '334')) return $bye();
    if (!$is($cmd(base64_encode($pass)), '235')) return $bye();
  }
  if (!$is($cmd('MAIL FROM:<'.$from.'>'), '250')) return $bye();
  if (!$is($cmd('RCPT TO:<'.$to.'>'), ['250','251'])) return $bye();
  if (!$is($cmd('DATA'), '354')) return $bye();
  $headers = "From: CASE OS <$from>\r\nTo: <$to>\r\nSubject: $subject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\nDate: ".date('r');
  $msg = $headers."\r\n\r\n".str_replace("\n.", "\n..", $body)."\r\n.";
  if (!$is($cmd($msg), '250')) return $bye();
  $cmd('QUIT'); @fclose($fp);
  return true;
}

function cron_send_email(string $to, string $subject, string $body): bool {
  $cfg = cfg();
  $from = $cfg['mail_from'] ?? ($cfg['smtp']['user'] ?? 'no-reply@caseadvisory.uz');
  if (!empty($cfg['smtp']['host'])) {
    try { if (cron_smtp_send($cfg['smtp'], $from, $to, $subject, $body)) return true; } catch (Throwable $e) {}
  }
  $headers = "From: CASE OS <$from>\r\nContent-Type: text/plain; charset=utf-8\r\nMIME-Version: 1.0";
  try { return (bool)@mail($to, $subject, $body, $headers); } catch (Throwable $e) { return false; }
}

function cron_send_telegram(string $chatId, string $text): bool {
  $cfg = cfg();
  $token = $cfg['telegram_bot_token'] ?? '';
  if (!$token || !$chatId) return false;
  $url = "https://api.telegram.org/bot{$token}/sendMessage";
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => http_build_query(['chat_id' => $chatId, 'text' => $text]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 12,
  ]);
  $resp = curl_exec($ch);
  $ok = $resp !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
  curl_close($ch);
  return $ok;
}

function days_until(string $dateStr): ?int {
  $d = DateTime::createFromFormat('Y-m-d', substr($dateStr, 0, 10));
  if (!$d) return null;
  $today = new DateTime('today');
  return (int)$today->diff($d)->format('%r%a');
}

// ── Собрать все контрольные даты из app_state ──────────────────────────
$row = db()->query('SELECT data FROM app_state WHERE id=1')->fetch();
$data = ($row && $row['data']) ? json_decode($row['data'], true) : null;
if (!is_array($data) || empty($data['U']) || !is_array($data['U'])) {
  fwrite(STDERR, "cron_critical_dates: no U (units) array in app_state — nothing to check.\n");
  exit(0);
}
$objects = [];
if (!empty($data['OBJECTS']) && is_array($data['OBJECTS'])) {
  foreach ($data['OBJECTS'] as $o) { if (is_array($o) && isset($o['id'])) $objects[$o['id']] = $o['name'] ?? $o['id']; }
}

$byBroker = []; // broker name => list of {code,obj,type,date,days}
$overdueAll = [];
foreach ($data['U'] as $u) {
  if (!is_array($u) || empty($u['dates']) || !is_array($u['dates'])) continue;
  $broker = trim((string)($u['broker'] ?? ''));
  if ($broker === '-') $broker = ''; // конвенция приложения: '-' = брокер не назначен (см. index.html)
  foreach ($u['dates'] as $d) {
    if (!is_array($d) || count($d) < 2) continue;
    $days = days_until((string)$d[1]);
    if ($days === null || $days > 90) continue; // за пределами дайджеста (>90 дней) — не тревожим заранее
    $entry = ['code' => $u['code'] ?? '', 'obj' => $objects[$u['obj'] ?? ''] ?? ($u['obj'] ?? ''), 'type' => $d[0], 'date' => $d[1], 'days' => $days];
    $key = $broker !== '' ? $broker : '(без брокера)';
    $byBroker[$key][] = $entry;
    if ($days < 0) $overdueAll[] = $entry;
  }
}

if (!$byBroker) { echo "cron_critical_dates: no upcoming/overdue critical dates within 90 days.\n"; exit(0); }

$recipients = cron_recipients();
$byName = [];
foreach ($recipients as $r) { if (!empty($r['broker'])) $byName[$r['broker']] = $r; }

$sentAny = false;
foreach ($byBroker as $broker => $entries) {
  usort($entries, function($a, $b){ return $a['days'] <=> $b['days']; });
  $lines = array_map(function ($e) {
    $tag = $e['days'] < 0 ? 'ПРОСРОЧЕНО ('.abs($e['days']).' дн.)' : ('через '.$e['days'].' дн.');
    return "- {$e['code']} ({$e['obj']}) · {$e['type']} · {$e['date']} · {$tag}";
  }, $entries);
  $digest = "CASE OS — контрольные даты, {$broker}:\n".implode("\n", $lines);
  echo $digest."\n\n";

  $r = $byName[$broker] ?? null;
  if (!$r) continue; // получатель не настроен — только вывод в лог/консоль
  if (!empty($r['telegram_chat_id']) && cron_send_telegram((string)$r['telegram_chat_id'], $digest)) $sentAny = true;
  if (!empty($r['email']) && cron_send_email((string)$r['email'], 'CASE OS — контрольные даты', $digest)) $sentAny = true;
}

if (!$recipients) {
  fwrite(STDERR, "cron_critical_dates: notify_recipients.php not configured (see notify_recipients.sample.php) — digest printed above but not delivered.\n");
}
exit(0);
