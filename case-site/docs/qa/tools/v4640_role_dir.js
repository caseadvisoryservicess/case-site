/* Роль DIR — «все рабочие разделы, кроме администрирования».

   Проверка нужна потому, что доступ здесь собирается из трёх независимых мест: флаг admin
   в ROLES ядра, рабочая область в DEFAULTS каталога модулей и защита на отрисовке в
   core.js. Ошибка в любом из трёх даёт либо лишний доступ (человек попадает в управление
   пользователями), либо недостающий (не видит разделов, ради которых роль и заводилась).
   Оба исхода тихие: интерфейс не жалуется.

   Запуск: node v4640_role_dir.js [корень репозитория] */
'use strict';
const path = require('path'), fs = require('fs');
const ROOT = process.argv[2] || path.join(__dirname, '..', '..', '..');
const OS = path.join(ROOT, 'os');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) bad++; };

const ADMIN_VIEWS = ['users', 'admin_modules', 'admin_system'];

/* --- каталог модулей и рабочая область роли --- */
global.window = {};
global.document = {
  addEventListener() {}, head: { appendChild() {} },
  querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; },
  createElement() { return { style: {}, classList: { add() {}, toggle() {} }, querySelector() { return null; }, querySelectorAll() { return []; } }; }
};
global.S = { role: 'DIR', user: { u: 'humoyun' } };
require(path.join(OS, 'v3520-workspaces.js'));

const MODULES = window.CASE_OS_MODULES;
const ALL = MODULES.map(m => m.v);
const views = window.caseWorkspaceViews();

ck('каталог модулей загрузился целиком', MODULES.length === 89, MODULES.length + ' модулей');
ck('у роли DIR есть собственная рабочая область, а не заглушка из одного экрана',
   views.length > 1, views.length + ' разделов');
ck('DIR получает все разделы каталога, кроме трёх административных',
   views.length === ALL.length - ADMIN_VIEWS.length,
   `${views.length} против ${ALL.length} - ${ADMIN_VIEWS.length}`);

ADMIN_VIEWS.forEach(v => ck('раздел «' + v + '» НЕ выдан роли DIR', views.indexOf(v) < 0));

const missing = ALL.filter(v => ADMIN_VIEWS.indexOf(v) < 0 && views.indexOf(v) < 0);
ck('ни один рабочий раздел не потерян', missing.length === 0, missing.join(', ') || 'потерь нет');

ck('главный экран на месте', views.indexOf('dash') >= 0);
ck('геоаналитика на месте', views.indexOf('geoanalytics') >= 0);
ck('финансовая модель на месте', views.indexOf('feasibility') >= 0);
ck('контроль аренды на месте', views.indexOf('registry') >= 0);
ck('шаблоны договоров на месте — это рабочий раздел, а не административный',
   views.indexOf('document_templates') >= 0);

/* жёсткий гейт не должен трогать DIR: он существует только для AGX и BRJ */
ck('раздел администрирования закрыт роли, а не всей системе — у ADM он остаётся',
   ALL.indexOf('users') >= 0);

/* --- флаги роли в ядре --- */
const core = fs.readFileSync(path.join(OS, 'core.js'), 'utf8');
const line = (core.match(/^\s*DIR:\{[^}]*\}/m) || [''])[0];
ck('роль DIR объявлена в ROLES ядра', !!line);
ck('DIR: администрирование выключено', /admin:false/.test(line), line ? 'admin:false найден' : 'строки нет');
['leasing', 'finance', 'edit', 'approve', 'plans'].forEach(f =>
  ck('DIR: право «' + f + '» включено', new RegExp(f + ':true').test(line)));
ck('DIR: правка геоданных включена', /geoEdit:true/.test(line));
ck('DIR не помечен как внешний или ограниченный по проектам',
   !/ownOnly:true|projectScoped:true|external:true/.test(line));

/* --- назначение пользователя --- */
const user = (core.match(/\{u:'humoyun'[^}]*\}/) || [''])[0];
ck('Humoyun Mirkamolov заведён в списке пользователей', !!user);
ck('Humoyun Mirkamolov переведён на роль DIR', /role:'DIR'/.test(user), user);

/* --- защита на отрисовке: без неё workspace-список остаётся косметикой --- */
ck('переход в «Доступ» без права admin возвращает на главный экран',
   /S\.view==='users'&&!R\(\)\.admin/.test(core));
ck('«Модули» показывают замок без права admin',
   /function renderAdminModules\(\)\{if\(!R\(\)\.admin\)/.test(core));
ck('«Система» показывает замок без права admin',
   /function renderAdminSystem\(\)\{if\(!R\(\)\.admin\)/.test(core));

/* --- миграция базы --- */
const mig = path.join(OS, 'sql', 'migrations', '2026_08_13_role_dir.sql');
ck('миграция роли существует', fs.existsSync(mig));
if (fs.existsSync(mig)) {
  const sql = fs.readFileSync(mig, 'utf8');
  ck('миграция заводит роль DIR с admin=0',
     /INSERT INTO roles[\s\S]*'DIR'[\s\S]*1,1,1,1,1,0,0,0/.test(sql));
  ck('миграция идемпотентна', /ON DUPLICATE KEY UPDATE/.test(sql));
  ck('роль создаётся раньше назначения — иначе внешний ключ не пропустит',
     sql.indexOf('INSERT INTO roles') < sql.indexOf('UPDATE app_users'));
  ck('миграция назначает роль именно Humoyun Mirkamolov',
     /UPDATE app_users SET role_key='DIR'[\s\S]*Humoyun Mirkamolov/.test(sql));
}

/* --- дисциплина релиза --- */
const idx = fs.readFileSync(path.join(OS, 'index.html'), 'utf8');
const ver = (idx.match(/APP_VERSION='([\d.]+)'/) || [])[1];
ck('версия платформы поднята', ver === '4.64.0', ver);
['core', 'v3520-workspaces'].forEach(m => {
  const exp = new RegExp("'" + m + "':'4\\.64\\.0'").test(idx);
  const bust = new RegExp(m.replace(/[.]/g, '\\.') + "\\.js\\?v=4\\.64\\.0").test(idx);
  ck('модуль ' + m + ': ожидаемая версия совпадает с 4.64.0', exp);
  ck('модуль ' + m + ': cache-buster совпадает с версией', bust);
});
const sw = fs.readFileSync(path.join(OS, 'sw.js'), 'utf8');
ck('имя офлайн-кэша обновлено — иначе старые файлы переживут релиз',
   /case-os-v4640/.test(sw));

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nРоль DIR настроена верно во всех трёх местах');
process.exit(bad ? 1 : 0);
