<?php
// CASE OS — разовая настройка первого администратора (создаёт CEO/роль ASH).
// Ссылка на этот файл есть в api/README.md (шаг 5 установки).
// ВАЖНО: пока в базе нет ни одного пользователя, любой, кто найдёт этот URL,
// может создать себе учётную запись CEO — как только администратор создан,
// скрипт сам отказывается работать повторно, но лучше сразу удалить файл с сервера.
require __DIR__.'/lib.php';

function setup_users_exist(): bool {
  try { return (int)db()->query('SELECT COUNT(*) FROM app_users')->fetchColumn() > 0; }
  catch (Throwable $e) { return false; } // таблицы ещё нет / миграции не применены — настройка ещё нужна
}

function setup_render(string $error = '', array $old = []): void {
  $token = csrf_token();
  $esc = function($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };
  header('Content-Type: text/html; charset=utf-8');
  ?>
<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CASE OS — создание администратора</title>
<style>
 body{font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#0f1420;color:#e7ecf5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
 .card{background:#161d2e;border:1px solid #263049;border-radius:12px;padding:28px 30px;width:360px;max-width:92vw}
 h1{font-size:18px;margin:0 0 4px}
 p.sub{color:#8b96ad;margin:0 0 20px;font-size:13px}
 label{display:block;font-size:13px;color:#a9b2c6;margin:14px 0 5px}
 input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid #2c3752;background:#0f1420;color:#e7ecf5;font-size:14px}
 button{margin-top:20px;width:100%;padding:10px;border:0;border-radius:8px;background:#e11d3c;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
 button:hover{background:#c81833}
 .err{background:#3a1420;border:1px solid #7a2436;color:#ff9db0;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:6px}
 .hint{margin-top:16px;font-size:12px;color:#7885a0}
</style></head><body>
<div class="card">
 <h1>CASE OS — создание администратора</h1>
 <p class="sub">Первый запуск: этот аккаунт получит роль CEO (ASH) со всеми правами.</p>
 <?php if ($error): ?><div class="err"><?php echo $esc($error); ?></div><?php endif; ?>
 <form method="post">
  <input type="hidden" name="_csrf" value="<?php echo $esc($token); ?>">
  <label>Имя</label>
  <input name="name" required value="<?php echo $esc($old['name'] ?? ''); ?>">
  <label>Email</label>
  <input name="email" type="email" required value="<?php echo $esc($old['email'] ?? ''); ?>">
  <label>Пароль (мин. 8 символов)</label>
  <input name="password" type="password" required minlength="8">
  <button type="submit">Создать администратора</button>
 </form>
 <div class="hint">После успешного создания удалите файл <code>api/setup.php</code> с сервера.</div>
</div>
</body></html>
<?php
}

if (setup_users_exist()) {
  http_response_code(403);
  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:40px;color:#333;max-width:520px">'
     .'<h2>Настройка уже выполнена</h2><p>В базе уже есть пользователи — этот скрипт больше не нужен и отказывается создавать администратора повторно.</p>'
     .'<p>Удалите файл <code>api/setup.php</code> с сервера. Если доступ администратора утерян, попросите другого администратора сбросить пароль в разделе «Пользователи», либо создайте запись напрямую в БД.</p></body>';
  exit;
}

$m = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($m === 'GET') { setup_render(); exit; }

if ($m === 'POST') {
  // Обычная форма (form-urlencoded), не JSON — своя проверка origin/CSRF по образцу
  // require_valid_csrf() из lib.php, но без body(), который ожидает JSON-тело.
  require_same_origin_for_write();
  $token = $_POST['_csrf'] ?? '';
  if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
    setup_render('Сессия устарела. Обновите страницу и попробуйте снова.');
    exit;
  }
  $name = trim((string)($_POST['name'] ?? ''));
  $email = mb_strtolower(trim((string)($_POST['email'] ?? '')));
  $pass = (string)($_POST['password'] ?? '');
  $old = ['name'=>$name,'email'=>$email];
  if (!$name) { setup_render('Укажите имя', $old); exit; }
  if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) { setup_render('Укажите корректный email', $old); exit; }
  if (strlen($pass) < 8) { setup_render('Пароль минимум 8 символов', $old); exit; }

  // Роль ASH обычно уже есть после импорта sql/seed_roles.sql — но если пропущен,
  // создаём её тут же с правами CEO, чтобы первый вход не блокировался отсутствующей ролью.
  try {
    $rs = db()->prepare('SELECT `key` FROM roles WHERE `key`=?'); $rs->execute(['ASH']);
    if (!$rs->fetch()) {
      db()->prepare('INSERT INTO roles (`key`,label,leasing,finance,edit,approve,plans,own_only,project_scope,admin) VALUES (?,?,1,1,1,1,1,0,0,1)')
        ->execute(['ASH','CEO']);
    }
  } catch (Throwable $e) { setup_render('Не удалось проверить роли: '.$e->getMessage(), $old); exit; }

  // Повторная проверка прямо перед вставкой — на случай гонки (два одновременных первых запуска).
  if (setup_users_exist()) { setup_render('Администратор уже создан кем-то другим — обновите страницу.', $old); exit; }

  $id = uuid();
  try {
    db()->prepare('INSERT INTO app_users (id,email,password_hash,name,title,role_key,active) VALUES (?,?,?,?,?,?,1)')
      ->execute([$id, $email, password_hash($pass, PASSWORD_DEFAULT), $name, 'CEO', 'ASH']);
  } catch (Throwable $e) {
    setup_render('Не удалось создать пользователя: '.$e->getMessage(), $old); exit;
  }
  try { db()->exec('COMMIT'); } catch (Throwable $e) {} // страховка от autocommit=0 на хостинге

  header('Content-Type: text/html; charset=utf-8');
  echo '<!doctype html><meta charset="utf-8"><body style="font:15px sans-serif;padding:40px;color:#333;max-width:520px">'
     .'<h2>Готово</h2><p>Администратор <b>'.htmlspecialchars($email, ENT_QUOTES, 'UTF-8').'</b> создан (роль CEO).</p>'
     .'<p><b>Важно:</b> удалите файл <code>api/setup.php</code> с сервера прямо сейчас — пока он есть, любой найдёт этот адрес.</p>'
     .'<p><a href="../">Перейти к платформе →</a></p></body>';
  exit;
}

http_response_code(405);
echo 'Метод не поддерживается';
