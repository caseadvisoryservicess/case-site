/* Сборка CASE Geo Analytics одним файлом из текущей студии CASE OS.
 *
 * Зачем сборщик, а не отдельная копия: прежняя автономная версия (docs/standalone/
 * CASE_OS_Geo_Analytics.html) правилась руками и отстала от студии на десяток выпусков.
 * Здесь автономный файл собирается из тех же исходников, что и экран CASE OS, поэтому
 * гео-агент, зона, полигоны, выгрузка, солнце и Хафф в нём ровно такие же, как в платформе.
 *
 * Что делает: берёт os/geoanalytics-studio.html, встраивает все подключаемые скрипты
 * (Leaflet уже внутри), встраивает границы районов и мастер-геобазу, ставит первым
 * сценарием docs/standalone/standalone-shim.js (браузер вместо сервера CASE OS) и меняет
 * шапку на «CASE Geo Analytics». Секреты не нужны: в студии их нет.
 *
 * Запуск: node build_geo_standalone.js [папка os] [выходной файл]
 * По умолчанию: os -> docs/standalone/CASE_Geo_Analytics.html */
'use strict';
const fs = require('fs');
const path = require('path');

function safeInline(s) {
  /* внутри <script> тег закрывает только последовательность </script; экранировать любое </
     нельзя: в модулях есть регулярные выражения вида /</g, и они переставали собираться.
     U+2028 и U+2029 ломают старые движки.
     Коды символов через fromCharCode: запись \u2028 в исходнике часть редакторов превращает
     в сам символ, и регулярное выражение с ним не собирается. */
  var LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
  return s.replace(/<\/script/gi, '<\\/script').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

function build(OS, OUT) {
  OS = path.resolve(OS);
  const studioPath = path.join(OS, 'geoanalytics-studio.html');
  const src = fs.readFileSync(studioPath, 'utf8');
  const indexSrc = fs.readFileSync(path.join(OS, 'index.html'), 'utf8');
  const version = (indexSrc.match(/APP_VERSION='([\d.]+)'/) || [, '0'])[1];
  const built = new Date().toISOString().slice(0, 10);
  const shimPath = path.join(__dirname, '..', '..', 'standalone', 'standalone-shim.js');
  const shim = fs.readFileSync(shimPath, 'utf8').replace(/%VERSION%/g, version).replace(/%BUILT%/g, built);
  const districts = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'tashkent_districts.geojson'), 'utf8'));
  const master = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'geo_master', 'runtime.json'), 'utf8'));
  /* v4.77.0: демография Ташкента (ряды, пол, возраст, доходы, КИПЦ) встроена как window.CASE_DEMOGRAPHY:
     модуль махаллей и демографии читает её раньше, чем data/demography_tashkent.json */
  const demography = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'demography_tashkent.json'), 'utf8'));
  /* v4.78.0: реестр 585 махаллей (Etirof + хокимият), 402 официальные границы из слоя махаллей НГИС и
     налоговые зоны тоже вшиты (кадастровые участки по замечанию владельца не берутся: слишком быстро меняются); выгрузка генплана (2,9 МБ) не вшивается: в автономном файле
     генплан в точке спрашивается живым запросом к НГИС, слой на карте недоступен */
  const readJ = f => JSON.parse(fs.readFileSync(path.join(OS, 'data', f), 'utf8'));
  const registry = readJ('mahalla_registry_tashkent.json'), boundaries = readJ('mahalla_boundaries.geojson'), nalog = readJ('ngis_nalog_tashkent.geojson');
  const dataScript = '<script>/* данные, встроенные при сборке: границы районов, мастер-геобаза, демография, реестр и границы махаллей, налоговые зоны НГИС */\nwindow.CASE_STANDALONE_DATA={districts:'
    + safeInline(JSON.stringify(districts)) + ',master:' + safeInline(JSON.stringify(master)) + '};\nwindow.CASE_DEMOGRAPHY=' + safeInline(JSON.stringify(demography)) + ';\nwindow.CASE_MAHALLA_REGISTRY=' + safeInline(JSON.stringify(registry)) + ';\nwindow.CASE_MAHALLA_BOUNDARIES=' + safeInline(JSON.stringify(boundaries)) + ';\nwindow.CASE_NGIS_NALOG=' + safeInline(JSON.stringify(nalog)) + ';</script>';

  const inlined = [];
  let html = src.replace(/<script src="([^"?]+)(\?v=[^"]*)?"><\/script>/g, (m, f) => {
    const p = path.join(OS, f);
    if (!fs.existsSync(p)) throw new Error('нет файла для встраивания: ' + f);
    inlined.push(f);
    return '<script>/* ' + f + ' */\n' + safeInline(fs.readFileSync(p, 'utf8')) + '\n</script>';
  });
  if (/<script src=/.test(html)) throw new Error('остался внешний скрипт: ' + (html.match(/<script src="[^"]+"/) || [])[0]);
  if (!/<head[^>]*>/i.test(html)) throw new Error('в студии нет <head>');
  html = html.replace(/<head[^>]*>/i, m => m + '\n' + dataScript + '\n<script>/* docs/standalone/standalone-shim.js */\n' + shim + '\n</script>');
  html = html.replace(/<title>[^<]*<\/title>/, '<title>CASE Geo Analytics · Tashkent</title>');
  const headerOld = '<span class="lg"><b>CASE</b> OS</span><span class="tag">Universal Geo Analytics · preliminary online data</span>';
  if (html.indexOf(headerOld) < 0) throw new Error('шапка студии изменилась, обновите сборщик');
  html = html.replace(headerOld, '<span class="lg"><b>CASE</b> Geo Analytics</span><span class="tag">автономная версия ' + version + ' · сборка ' + built + '</span>');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, html);
  return { out: OUT, bytes: Buffer.byteLength(html), version, built, inlined, districts: (districts.features || []).length, master: { bc: master.bc.length, medicine: master.medicine.length, pharmacies: master.pharmacies.length, mahallas: master.mahallas.length }, demography: demography.version, registry: registry.total, boundaries: (boundaries.features || []).length, nalog: (nalog.features || []).length };
}

if (require.main === module) {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const OUT = path.resolve(process.argv[3] || path.join(__dirname, '..', '..', 'standalone', 'CASE_Geo_Analytics.html'));
  const r = build(OS, OUT);
  console.log('собрано: ' + r.out + ' (' + (r.bytes / 1024 / 1024).toFixed(2) + ' МБ), версия ' + r.version + ', сборка ' + r.built);
  console.log('встроено скриптов: ' + r.inlined.join(', '));
  console.log('районов: ' + r.districts + ', мастер-база: БЦ ' + r.master.bc + ', медицина ' + r.master.medicine + ', аптеки ' + r.master.pharmacies);
  console.log('реестр махаллей: ' + r.registry + ', границ: ' + r.boundaries + ', налоговых зон: ' + r.nalog + ', демография: ' + r.demography);
}
module.exports = { build };
