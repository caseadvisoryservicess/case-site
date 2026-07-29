/* v4.50.3: платформа не должна считать бэкенд живым, если сервер не выполняет PHP.

   Из аудита: на статичном сервере /api/auth.php отдаётся ИСХОДНЫМ ТЕКСТОМ с кодом 200.
   apiGET глотает ошибку разбора JSON и возвращает null, а initAuth ставил BACKEND=true
   безусловно — платформа показывала серверный вход, который не может работать, вместо
   честного отказа. Заодно наружу утекал исходник PHP.

   Проверяем оба конца: при мусорном ответе бэкенд считается недоступным, при нормальном —
   доступным (иначе проверка сломала бы обычный вход).

   Запуск: node v4503_backend_guard.js [папка os] */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const OS = process.argv[2] || '/home/user/case-site/case-site/os';
const CHROME = process.env.CASE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PHP_SRC = '<?php\nrequire __DIR__."/lib.php";\nsession_start();\njson_out(["auth"=>false]);\n';

let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
               '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
               '.svg': 'image/svg+xml', '.png': 'image/png' };

/** mode: 'source' — сервер отдаёт исходник PHP (не выполняет его); 'json' — нормальный ответ */
function serve(mode) {
  return http.createServer((rq, rs) => {
    const u = decodeURIComponent(rq.url.split('?')[0]);
    if (/\.php$/.test(u)) {
      if (mode === 'source') { rs.writeHead(200, { 'Content-Type': 'text/html' }); return rs.end(PHP_SRC); }
      rs.writeHead(200, { 'Content-Type': 'application/json' });
      return rs.end(JSON.stringify({ auth: false, csrf: 'x', pass_login: true, code_login: true }));
    }
    const f = path.join(OS, u === '/' ? 'index.html' : u.replace(/^\//, ''));
    if (!f.startsWith(OS) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end('no'); }
    rs.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    rs.end(fs.readFileSync(f));
  });
}

async function run(mode) {
  const srv = serve(mode);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--no-proxy-server'] });
  const pg = await b.newPage();
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/index.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(3500);
  const st = await pg.evaluate(() => ({
    backend: typeof BACKEND === 'undefined' ? 'нет' : BACKEND,
    emailShown: (() => { const e = document.getElementById('lemail'); return !!e && e.style.display !== 'none'; })()
  }));
  await b.close(); srv.close();
  return { ...st, errs };
}

(async () => {
  const bad = await run('source');
  check('исходник PHP с кодом 200 НЕ считается рабочим бэкендом', bad.backend === false,
    'BACKEND=' + bad.backend);
  check('страница при этом не падает', bad.errs.length === 0, bad.errs[0] || 'ошибок нет');

  const ok = await run('json');
  check('нормальный ответ auth.php по-прежнему включает бэкенд', ok.backend === true,
    'BACKEND=' + ok.backend);
  check('вход по email доступен при живом сервере', ok.emailShown, 'поле email показано: ' + ok.emailShown);

  console.log(failed ? '\nПРОВАЛЕНО проверок: ' + failed : '\nВсе проверки пройдены');
  process.exit(failed ? 1 : 0);
})();
