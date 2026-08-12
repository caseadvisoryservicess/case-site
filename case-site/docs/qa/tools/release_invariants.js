/* Инварианты релиза CASE OS — ловит расхождения, из-за которых обновление уезжает
   наполовину, а система об этом молчит.

   Поводом стала проверка v4.57.1: новый модуль выгрузки v4530-geo-export.js не попал ни в
   ASSETS service worker (офлайн гео-студия открывалась без выгрузки и без внятной ошибки),
   ни в CASE_EXPECTED_MODULES (сверка полноты заливки его не видела), комментарий версии в
   sw.js отстал на восемь релизов, DEPLOY.md обещал старую версию в шапке, а единственный
   файл контрольных сумм был от 4.51.0 и давал ложные FAILED на нормальных файлах.
   Каждая из этих мелочей по отдельности безобидна, вместе они означают, что штатная
   проверка релиза перестала что-либо проверять.

   Запуск: node release_invariants.js [папка os] */
'use strict';
const fs = require('fs'), path = require('path');
const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));
const ROOT = path.resolve(OS, '..');

let failed = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) failed++; };
const read = f => fs.readFileSync(path.join(OS, f), 'utf8');

const index = read('index.html');
const sw = read('sw.js');

/* ---- 1. версия объявлена в одном месте и совпадает везде ---- */
const APP = (index.match(/const APP_VERSION\s*=\s*'([\d.]+)'/) || [])[1];
ck('APP_VERSION найден в index.html', !!APP, APP || 'не найден');

const cache = (sw.match(/const CACHE\s*=\s*'case-os-v(\d+)'/) || [])[1];
const expectCache = APP && ('v' + APP.replace(/\./g, ''));
ck('имя кэша service worker отражает версию', cache && ('v' + cache) === expectCache,
   'case-os-v' + cache + ' при APP_VERSION ' + APP);

const swComment = (sw.match(/^\/\/ CASE OS v([\d.]+) service worker/) || [])[1];
ck('комментарий версии в sw.js не отстал', swComment === APP, swComment + ' против ' + APP);

if (fs.existsSync(path.join(OS, 'DEPLOY.md'))) {
  /* строку «Включает v4.52.0-v4.57.1» проверять не надо — это перечень вошедших релизов.
     Важны заголовок и признак успешной установки: по ним администратор решает, залилось ли */
  const dep = read('DEPLOY.md').split('\n').filter(l => !/^Миграций|Включает/.test(l.trim())).join('\n');
  const head = (dep.match(/^# CASE OS v([\d.]+)/) || [])[1];
  ck('заголовок DEPLOY.md — текущая версия', head === APP, head + ' против ' + APP);
  const badge = (dep.match(/В шапке `v([\d.]+)`/) || [])[1];
  ck('DEPLOY.md называет верный признак успешной установки', badge === APP, badge + ' против ' + APP);
}

const sums = fs.readdirSync(OS).filter(f => /^SHA256SUMS_v[\d.]+\.txt$/.test(f));
ck('файл контрольных сумм ровно один и от текущей версии',
   sums.length === 1 && sums[0] === 'SHA256SUMS_v' + APP + '.txt', sums.join(', ') || 'нет ни одного');

/* ---- 2. каждый модуль объявляет свою версию один раз и согласованно ---- */
const studio = fs.existsSync(path.join(OS, 'geoanalytics-studio.html')) ? read('geoanalytics-studio.html') : '';
const html = index + studio;
const expected = {};
(index.match(/CASE_EXPECTED_MODULES\s*=\s*\{([^}]*)\}/) || [, ''])[1]
  .split(',').forEach(p => { const m = p.match(/'([^']+)'\s*:\s*'([^']+)'/); if (m) expected[m[1]] = m[2]; });
const expectedStudio = {};
(index.match(/CASE_EXPECTED_STUDIO_MODULES\s*=\s*\{([^}]*)\}/) || [, ''])[1]
  .split(',').forEach(p => { const m = p.match(/'([^']+)'\s*:\s*'([^']+)'/); if (m) expectedStudio[m[1]] = m[2]; });

ck('карта версий модулей студии объявлена через window, а не const',
   !studio || /window\.CASE_EXPECTED_STUDIO_MODULES\s*=/.test(index),
   /window\.CASE_EXPECTED_STUDIO_MODULES/.test(index) ? 'window' : 'const не становится свойством окна — сверка из iframe не сработает');

const registrars = [];
fs.readdirSync(OS).filter(f => f.endsWith('.js')).forEach(f => {
  const s = read(f);
  const m = s.match(/CASE_MODULE_VERSIONS\['([^']+)'\]\s*=\s*([^;]+);/);
  if (!m) return;
  const name = m[1], value = m[2].trim();
  const lit = (value.match(/^'([\d.]+)'$/) || [])[1];
  const varDecl = (s.match(/var VERSION\s*=\s*'([\d.]+)'/) || [])[1];
  const cb = (html.match(new RegExp(f.replace(/[.]/g, '\\.') + '\\?v=([\\d.]+)')) || [])[1];
  registrars.push({ file: f, name, lit, varDecl, cb, value });
});

registrars.forEach(r => {
  /* если модуль объявляет var VERSION, регистрировать он обязан именно её:
     литерал рядом с переменной — это два источника правды, которые расходятся молча */
  if (r.varDecl) {
    ck('версия модуля ' + r.file + ' берётся из одной переменной',
       /(^|\.)VERSION$/.test(r.value) || r.lit === r.varDecl,
       'var VERSION=' + r.varDecl + ', регистрируется ' + r.value);
  }
  const declared = r.lit || r.varDecl;
  if (declared && r.cb) ck('cache-buster ' + r.file + ' совпадает с версией модуля', r.cb === declared, '?v=' + r.cb + ' против ' + declared);
  const exp = expected[r.name] !== undefined ? expected[r.name] : expectedStudio[r.name];
  if (declared && exp !== undefined) ck('ожидаемая версия ' + r.name + ' совпадает с объявленной', exp === declared, exp + ' против ' + declared);
});

/* модуль, объявляющий версию, обязан быть под присмотром одной из карт ожиданий */
const unwatched = registrars.filter(r => expected[r.name] === undefined && expectedStudio[r.name] === undefined);
ck('каждый модуль с версией попадает в сверку полноты заливки', unwatched.length === 0,
   unwatched.map(r => r.file).join(', ') || 'непокрытых нет');

/* ---- 3. service worker кэширует ровно то, что страницы подключают ---- */
const assets = ((sw.match(/const ASSETS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1].match(/'([^']+)'/g) || [])
  .map(x => x.slice(1, -1).replace(/^\.\//, ''));
const assetSet = new Set(assets);

const missingOnDisk = assets.filter(a => a !== '' && a !== './' && !fs.existsSync(path.join(OS, a)));
ck('все ресурсы из ASSETS лежат на диске', missingOnDisk.length === 0, missingOnDisk.join(', ') || 'все на месте');

const linked = new Set();
[['index.html', index], ['geoanalytics-studio.html', studio]].forEach(([, src]) => {
  (src.match(/<script[^>]+src="([^"]+)"/g) || []).forEach(t => {
    const u = t.match(/src="([^"]+)"/)[1].split('?')[0];
    if (!/^https?:/.test(u)) linked.add(u.replace(/^\.\//, ''));
  });
});
const notCached = [...linked].filter(u => !assetSet.has(u) && fs.existsSync(path.join(OS, u)));
ck('каждый подключённый скрипт есть в офлайн-кэше', notCached.length === 0, notCached.join(', ') || 'все скрипты закэшированы');

/* ---- 4. в видимом тексте страниц нет длинного и среднего тире ---- */
const strip = s => s.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
const dashPages = fs.readdirSync(OS).filter(f => f.endsWith('.html')).filter(f => {
  const body = strip(read(f));
  const text = body.replace(/<[^>]*>/g, ' ');
  const titles = (body.match(/\b(?:title|placeholder|aria-label)="[^"]*"/g) || []).join(' ');
  return /[—–]/.test(text) || /[—–]/.test(titles);
});
ck('в статическом тексте страниц нет длинного тире', dashPages.length === 0, dashPages.join(', ') || 'чисто');

/* нормализатор экрана и нормализатор выгрузок должны существовать оба:
   первый не достаёт до .xlsx/.pptx и до окна печати, второй — до экрана */
ck('нормализатор тире на экране на месте', /function dashFix\(/.test(read('v4450-ux-system.js')));
ck('нормализатор тире в выгрузках на месте', /function dsh\(/.test(read('v4530-geo-export.js')));
ck('печатная версия PDF нормализуется', /caseDashFixDoc/.test(studio));

/* ---- 5. в релизном пакете нет секретов ---- */
['api/config.php', 'api/config.local.php', 'api/config.local-xampp.php'].forEach(f => {
  if (fs.existsSync(path.join(OS, f))) console.log('    (в архив не класть: ' + f + ')');
});

console.log(failed ? '\nПРОВАЛЕНО инвариантов: ' + failed : '\nВсе инварианты релиза выполнены');
process.exit(failed ? 1 : 0);
