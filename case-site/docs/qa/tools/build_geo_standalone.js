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
  const dataScript = '<script>/* данные, встроенные при сборке: границы районов и мастер-геобаза */\nwindow.CASE_STANDALONE_DATA={districts:'
    + safeInline(JSON.stringify(districts)) + ',master:' + safeInline(JSON.stringify(master)) + '};</script>';

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
  return { out: OUT, bytes: Buffer.byteLength(html), version, built, inlined, districts: (districts.features || []).length, master: { bc: master.bc.length, medicine: master.medicine.length, pharmacies: master.pharmacies.length } };
}

if (require.main === module) {
  const OS = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
  const OUT = path.resolve(process.argv[3] || path.join(__dirname, '..', '..', 'standalone', 'CASE_Geo_Analytics.html'));
  const r = build(OS, OUT);
  console.log('собрано: ' + r.out + ' (' + (r.bytes / 1024 / 1024).toFixed(2) + ' МБ), версия ' + r.version + ', сборка ' + r.built);
  console.log('встроено скриптов: ' + r.inlined.join(', '));
  console.log('районов: ' + r.districts + ', мастер-база: БЦ ' + r.master.bc + ', медицина ' + r.master.medicine + ', аптеки ' + r.master.pharmacies);
}
module.exports = { build };
