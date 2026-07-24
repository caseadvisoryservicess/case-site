/* CASE OS — аудит ролей и безопасности (статический).
   1) Консистентность реестров: каталог модулей (v3520) ↔ validViews (index.html) ↔ серверные списки (api/lib.php).
   2) Ролевые списки: клиентские DEFAULTS ↔ серверные ROLE-списки.
   3) API: каждый эндпоинт должен требовать авторизацию (или быть явно публичным).
   Запуск: node roles_security_audit.js /path/to/os */
'use strict';
const fs = require('fs');
const path = require('path');
const OS = path.resolve(process.argv[2] || '.');
const read = f => fs.readFileSync(path.join(OS, f), 'utf8');

const out = { findings: [], info: [] };
function finding(sev, what) { out.findings.push({ sev, what }); }

/* ---- 1. каталог модулей v3520 ---- */
const w = read('v3520-workspaces.js');
const moduleIds = [...w.matchAll(/\{v:'([a-z0-9_]+)'/g)].map(m => m[1]);
const modSet = new Set(moduleIds);
out.info.push('каталог модулей (v3520): ' + moduleIds.length);

/* ---- 2. validViews ядра ---- */
const idx = read('index.html');
const vvM = idx.match(/const validViews=\[([^\]]+)\]/);
const validViews = [...vvM[1].matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
const vvSet = new Set(validViews);
out.info.push('validViews (index.html): ' + validViews.length);

/* каталог ⊆ validViews (после динамической досыпки — проверяем статически и помечаем чем закрыто) */
moduleIds.filter(v => !vvSet.has(v)).forEach(v =>
  finding('info', 'модуль «' + v + '» отсутствует в статическом validViews (закрывается динамической синхронизацией P1-5 из v3520)'));
validViews.filter(v => !modSet.has(v) && v !== 'chat').forEach(v =>
  finding('warn', 'view «' + v + '» есть в validViews, но отсутствует в каталоге модулей (некому управлять доступом)'));

/* ---- 3. клиентские ролевые списки (v3520 DEFAULTS) ---- */
const defBlock = w.slice(w.indexOf('var CURRENT_CORE'), w.indexOf('function', w.indexOf('var CURRENT_CORE')));
const roleLists = {};
[...defBlock.matchAll(/(CURRENT_CORE|[A-Z]{2,4})[:=]\s*\[([^\]]*)\]/g)].forEach(m => {
  roleLists[m[1]] = [...m[2].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]);
});
Object.entries(roleLists).forEach(([role, views]) => {
  views.filter(v => !modSet.has(v)).forEach(v =>
    finding('warn', 'клиентский список роли ' + role + ' содержит view «' + v + '», которого нет в каталоге модулей'));
});

/* ---- 4. серверные списки (lib.php) ---- */
const lib = read('api/lib.php');
const srvAllM = lib.match(/function\s+workspace_all_modules[^{]*\{[\s\S]*?return\s*\[([\s\S]*?)\];/);
let srvAll = [];
if (srvAllM) srvAll = [...srvAllM[1].matchAll(/'([a-z0-9_]+)'/g)].map(m => m[1]);
else {
  // fallback: самый большой массив строк в lib.php
  const arrs = [...lib.matchAll(/\[((?:'[a-z0-9_]+',?\s*){20,})\]/g)].map(m => [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]));
  arrs.sort((a, b) => b.length - a.length);
  srvAll = arrs[0] || [];
}
const srvSet = new Set(srvAll);
out.info.push('серверный список модулей (lib.php): ' + srvAll.length);
moduleIds.filter(v => !srvSet.has(v) && v !== 'chat').forEach(v =>
  finding('warn', 'модуль «' + v + '» есть в клиентском каталоге, но отсутствует в серверном списке (сервер не сможет им управлять/фильтровать)'));
srvAll.filter(v => !modSet.has(v) && v !== 'chat').forEach(v =>
  finding('warn', 'серверный список содержит «' + v + '», которого нет в клиентском каталоге'));

/* серверные ролевые списки */
const srvRoles = {};
[...lib.matchAll(/'([A-Z]{2,4})'=>\[([^\]]*)\]/g)].forEach(m => {
  srvRoles[m[1]] = [...m[2].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]);
});
Object.keys(roleLists).filter(r => r !== 'CURRENT_CORE').forEach(role => {
  if (!srvRoles[role]) { finding('info', 'роль ' + role + ': клиентский список есть, серверного нет (сервер использует общий)'); return; }
  const c = new Set(roleLists[role]), s = new Set(srvRoles[role]);
  const onlyClient = roleLists[role].filter(v => !s.has(v));
  const onlyServer = srvRoles[role].filter(v => !c.has(v));
  if (onlyClient.length) finding('warn', 'роль ' + role + ': только в клиентском списке: ' + onlyClient.join(', '));
  if (onlyServer.length) finding('warn', 'роль ' + role + ': только в серверном списке: ' + onlyServer.join(', '));
});

/* ---- 5. API: каждый эндпоинт требует авторизацию ---- */
const PUBLIC_OK = new Set(['health.php', 'auth.php', 'config.sample.php', 'config.production.example.php', 'config.local-xampp.php', 'notify_recipients.sample.php',
  'setup.php' /* bootstrap первого администратора: самозапирается, когда пользователи созданы (проверено вручную) */]);
const AUTH_PATTERNS = [/require_login\s*\(/, /require_user\s*\(/, /current_user\s*\(/, /require_edit\s*\(/, /require_admin\s*\(/, /\bcan\s*\(/, /auth_user\s*\(/, /session_user\s*\(/];
const CLI_GUARD = /PHP_SAPI\s*!==\s*'cli'[^;{]*\)\s*\{[^}]*(exit|die)/;
fs.readdirSync(path.join(OS, 'api')).filter(f => f.endsWith('.php')).forEach(f => {
  const src = read('api/' + f);
  const hasAuth = AUTH_PATTERNS.some(re => re.test(src));
  const cliOnly = CLI_GUARD.test(src.slice(0, 3000));
  const includesLib = /require[^;]*lib\.php/.test(src);
  if (!hasAuth && !cliOnly && !PUBLIC_OK.has(f)) {
    finding(includesLib ? 'warn' : 'crit', 'api/' + f + ': не найдено явной проверки авторизации' + (includesLib ? ' (подключает lib.php — проверить, вызывает ли она auth сама)' : ''));
  }
  if (cliOnly && !hasAuth) out.info.push('api/' + f + ': CLI-only (веб-запросы отклоняются 403)');
  if (/\$_GET|\$_POST|\$_REQUEST/.test(src) && !/htmlspecialchars|json_out|intval|\(int\)|preg_match|filter_var/.test(src)) {
    finding('info', 'api/' + f + ': прямое чтение GET/POST без видимой валидации — проверить руками');
  }
});

/* ---- 6. клиентские точки безопасности ---- */
if (/passwordless|беспарол/i.test(idx) && !/DEMO_ALLOWED/.test(idx)) finding('crit', 'беспарольный вход без демо-ограничения');
if (!/fail-closed|Fail-closed/i.test(idx)) finding('info', 'не найден комментарий fail-closed у логина (проверить вход)');
const csp = read('.htaccess');
if (!/Content-Security-Policy/.test(csp)) finding('warn', '.htaccess: нет CSP');
if (!/Strict-Transport-Security/.test(csp)) finding('warn', '.htaccess: нет HSTS');

/* ---- вывод ---- */
const crit = out.findings.filter(f => f.sev === 'crit').length;
const warn = out.findings.filter(f => f.sev === 'warn').length;
console.log(JSON.stringify({ suite: 'CASE OS roles & security static audit', date: '2026-07-24', crit, warn, info: out.findings.filter(f => f.sev === 'info').length, notes: out.info, findings: out.findings }, null, 2));
process.exit(crit ? 2 : 0);
