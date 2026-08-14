/* Проект Uchtepa Park в портфеле — сверка по всем местам, где он обязан быть.

   Портфель хранится в пяти файлах сразу: рантайм-массив SEED в v492 (срабатывает только на
   пустом состоянии), дозаливочный seed для уже работающих установок, JSON и GeoJSON пакета
   данных и CSV, на который ведёт кнопка «Экспорт CSV». Пропустить любой из пяти легко, и
   расхождение будет тихим: на карте проект есть, в выгрузке клиенту его нет.

   Отдельно проверяется защита координаты. migrate() в v493 перезаписывает координаты из
   своей таблицы COORDS у всех записей, КРОМЕ помеченных ручными — условие там
   /manual|ручн|точн/i по полю coordinateSource либо verification==='verified'. Без пометки
   точная координата однажды молча заменилась бы центроидом города.

   Запуск: node v4650_uchtepa_park.js [корень репозитория] */
'use strict';
const path = require('path'), fs = require('fs'), assert = require('assert');
const ROOT = process.argv[2] || path.join(__dirname, '..', '..', '..');
const OS = path.join(ROOT, 'os');

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' — ' + d)); if (!c) bad++; };

const ID = 'portfolio-096', SRC_ID = 96, NAME = 'Uchtepa Park';
const LAT = 41.29667581538922, LNG = 69.17693062226368;
/* Учтепа — юго-запад Ташкента. Рамка широкая нарочно: она ловит перепутанные местами
   широту и долготу и потерянные знаки после запятой, а не придирается к метрам. */
const BOX = { latMin: 41.2, latMax: 41.4, lngMin: 69.1, lngMax: 69.4 };

/* --- 1. рантайм-массив в v492 --- */
const v492 = fs.readFileSync(path.join(OS, 'v492-portfolio-proposals.js'), 'utf8');
let SEED = null;
try { SEED = JSON.parse(/var SEED=(\[[\s\S]*?\]);\s*\n/.exec(v492)[1]); } catch (e) {}
ck('массив SEED в v492 разбирается как корректный JSON', Array.isArray(SEED),
   SEED ? SEED.length + ' проектов' : 'не разобрался');
const inSeed = SEED && SEED.filter(p => p.id === ID);
ck('Uchtepa Park есть в SEED ровно один раз', inSeed && inSeed.length === 1,
   inSeed ? inSeed.length + ' совпадений' : '-');

/* --- 2. дозаливка в уже работающие установки --- */
global.window = {};
require(path.join(OS, 'data', 'case_portfolio.seed.js'));
const boot = global.window.CASE_PORTFOLIO_SEED_V493;
ck('дозаливочный seed не пуст', Array.isArray(boot) && boot.length > 0,
   Array.isArray(boot) ? boot.length + ' записей' : 'не массив');
const inBoot = (boot || []).find(p => p.id === ID);
ck('Uchtepa Park попадёт в установки, где портфель уже заполнен', !!inBoot);

/* --- 3-4. пакет данных --- */
const json = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'case_portfolio_projects_v4.9.3.json'), 'utf8'));
const geo = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'case_portfolio.geojson'), 'utf8'));
const inJson = json.filter(p => p.id === ID);
const inGeo = geo.features.filter(f => f.properties.id === ID);
ck('в JSON пакета данных один Uchtepa Park', inJson.length === 1, json.length + ' проектов всего');
ck('в GeoJSON один Uchtepa Park', inGeo.length === 1, geo.features.length + ' объектов всего');
ck('JSON и GeoJSON согласованы по числу записей', json.length === geo.features.length);

/* --- 5. CSV, на который ведёт кнопка «Экспорт CSV» --- */
const csvRaw = fs.readFileSync(path.join(OS, 'data', 'case_portfolio_projects_v4.9.3.csv'), 'utf8').replace(/^﻿/, '');
const csvLines = csvRaw.trim().split('\n');
const csvCols = csvLines[0].split(',').length;
const csvHit = csvLines.filter(l => l.indexOf(ID) === 0);
ck('в CSV одна строка Uchtepa Park', csvHit.length === 1, (csvLines.length - 1) + ' строк данных');
ck('CSV содержит столько же записей, сколько JSON', csvLines.length - 1 === json.length);
ck('в строке CSV столько же полей, сколько в шапке',
   csvHit.length === 1 && csvHit[0].split(',').length === csvCols,
   csvHit.length ? csvHit[0].split(',').length + ' против ' + csvCols : '-');

/* --- содержание записи --- */
const p = inJson[0];
if (p) {
  ck('название записано точно как передал владелец', p.name === NAME, p.name);
  ck('широта сохранена без потери точности', p.lat === LAT, String(p.lat));
  ck('долгота сохранена без потери точности', p.lng === LNG, String(p.lng));
  ck('точка лежит в границах Ташкента, а не за морем',
     p.lat > BOX.latMin && p.lat < BOX.latMax && p.lng > BOX.lngMin && p.lng < BOX.lngMax,
     p.lat + ', ' + p.lng);
  ck('страна и город проставлены', p.country === 'Uzbekistan' && p.city === 'Tashkent',
     p.country + ' / ' + p.city);
  ck('идентификаторы не столкнулись с существующими',
     json.filter(x => x.sourceId === SRC_ID).length === 1 && json.filter(x => x.id === ID).length === 1);
  ck('проект отнесён хотя бы к одной линии бизнеса — иначе он не попадёт ни на одну карту',
     Array.isArray(p.businessLines) && p.businessLines.length > 0, (p.businessLines || []).join(', '));
  ck('статус — «в работе», а не «завершён»', p.status === 'pipeline', p.status);

  /* защита координаты от перезаписи центроидом города */
  const manualBySource = /manual|ручн|точн/i.test(String(p.coordinateSource || ''));
  const manualByFlag = p.verification === 'verified';
  ck('координата помечена ручной и переживёт миграцию портфеля', manualBySource || manualByFlag,
     'по источнику: ' + manualBySource + ', по флагу: ' + manualByFlag);
  ck('точность координаты названа честно', p.coordinateAccuracy === 'exact_manual', p.coordinateAccuracy);
  ck('координата НЕ помечена как геокод по городу',
     p.geocodeMethod !== 'city' && p.coordinateAccuracy !== 'city_geocoded', p.geocodeMethod);
  ck('происхождение записи указано', !!p.source && !!p.sourceDate, p.source + ' / ' + p.sourceDate);

  /* незаполненное должно оставаться незаполненным, а не выдуманным */
  ['category', 'type', 'investor', 'architect'].forEach(f =>
    ck('поле «' + f + '» оставлено пустым, а не заполнено догадкой', p[f] === '', JSON.stringify(p[f])));
  ['gba', 'gla', 'openingYear'].forEach(f =>
    ck('число «' + f + '» равно null, а не нулю — ноль читался бы как измеренное значение',
       p[f] === null, JSON.stringify(p[f])));
  ck('в примечании сказано, что подтверждена только координата', /координат/i.test(p.note || ''));
}

/* --- согласие между файлами по координате --- */
if (p && inBoot) ck('дозаливочный seed несёт ту же координату, что и пакет данных',
   inBoot.lat === p.lat && inBoot.lng === p.lng);
if (p && inSeed && inSeed.length === 1) ck('рантайм-SEED несёт ту же координату',
   inSeed[0].lat === p.lat && inSeed[0].lng === p.lng);
if (p && inGeo.length === 1) ck('GeoJSON хранит координату в порядке «долгота, широта»',
   inGeo[0].geometry.coordinates[0] === p.lng && inGeo[0].geometry.coordinates[1] === p.lat,
   JSON.stringify(inGeo[0].geometry.coordinates));

/* --- пустая категория не должна ломать отрисовку маркера --- */
ck('у карты есть запасной цвет для проекта без категории',
   /CATEGORY_COLORS\[p\.category\]\|\|'#/.test(fs.readFileSync(path.join(OS, 'v493-portfolio-suite.js'), 'utf8')));

/* --- дисциплина релиза ---
   Сверяем согласованность, а не совпадение с литералом версии: литерал устаревает на
   следующем же релизе и делает проверку красной там, где ошибки нет. Важно другое — что
   изменённые файлы получили cache-buster текущей версии. Без этого браузер отдаст из кэша
   старый портфель, и нового проекта на карте не окажется. */
const idx = fs.readFileSync(path.join(OS, 'index.html'), 'utf8');
const ver = (idx.match(/APP_VERSION='([\d.]+)'/) || [])[1];
ck('версия платформы объявлена', /^\d+\.\d+\.\d+$/.test(ver || ''), ver);
[['v492-portfolio-proposals\\.js', 'рантайм-модуль портфеля'],
 ['case_portfolio\\.seed\\.js', 'дозаливочный seed']].forEach(([f, label]) => {
  const bust = (idx.match(new RegExp(f + '\\?v=([\\d.]+)')) || [])[1];
  ck('cache-buster обновлён: ' + label, bust === ver, bust + ' при версии ' + ver);
});
const cache = (fs.readFileSync(path.join(OS, 'sw.js'), 'utf8').match(/case-os-v(\d+)/) || [])[1];
ck('имя офлайн-кэша соответствует версии платформы',
   cache === (ver || '').replace(/\./g, ''), 'case-os-v' + cache + ' при версии ' + ver);

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nUchtepa Park заведён во всех пяти файлах согласованно');
process.exit(bad ? 1 : 0);
