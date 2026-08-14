/* Солнце, кибла и роза ветров - сверка с эталонами.

   Положение солнца и направление киблы это чистая геометрия: их можно и нужно сверять с
   независимым расчётом, а не «смотреть, похоже ли». Значения здесь получены двумя разными
   путями - приближением NOAA и классическим расчётом через юлианскую дату (Meeus);
   расхождение между ними не превышало 0.4°. Восход и заход дополнительно сверены с
   публикуемыми значениями для Ташкента, кибла - со справочными по трём городам на разных
   континентах, включая южное полушарие (Джакарта, 295°), где ошибка знака сразу видна.

   Запуск: node v4610_sun_wind_qibla.js [путь к v4600-sun-wind.js] */
global.window = {}; global.document = { getElementById: () => null };
/* принимаем и путь к файлу, и папку os - остальные наборы вызываются как «<набор> os»,
   и разнобой в этом соглашении приводил к «модуль не найден» вместо результата */
const _p = require('path'), _fs = require('fs');
let _m = process.argv[2] || _p.join(__dirname, '..', '..', '..', 'os');
if (_fs.existsSync(_m) && _fs.statSync(_m).isDirectory()) _m = _p.join(_m, 'v4600-sun-wind.js');
require(_p.resolve(_m));
const S = global.window.CASE_SUN;
let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };

const LAT = 41.2995, LNG = 69.2401, TZ = 5;
/* эталон: независимый расчёт (NOAA + перекрёстная сверка с Meeus, расхождение <0.4°) */
/* час полдня берём точный, а не округлённый до сотых: 0.01 ч это 36 секунд, и на
   солнцестоянии азимут за это время уходит на 0.2° - тест ловил бы собственное округление */
const REF = [
  [172, S.sunEvents(LAT, LNG, TZ, 172).noon / 60, 72.2, 180.0],
  [355, S.sunEvents(LAT, LNG, TZ, 355).noon / 60, 25.3, 180.0],
  [80, S.sunEvents(LAT, LNG, TZ, 80).noon / 60, 48.6, 180.0],
  [224, 6, 4.8, 73.9], [224, 15, 48.2, 242.7], [224, 18, 15.2, 277.0]
];
REF.forEach(([doy, hr, alt, az]) => {
  const p = S.sunPos(LAT, LNG, TZ, doy, hr);
  const da = Math.abs(p.alt - alt), dz = Math.min(Math.abs(p.az - az), 360 - Math.abs(p.az - az));
  ck(`солнце: день ${doy}, ${hr.toFixed(2)} ч`, da < 0.15 && dz < 0.15,
     `высота ${p.alt.toFixed(1)}° (эталон ${alt}), азимут ${p.az.toFixed(1)}° (эталон ${az})`);
});
/* полдень в северном полушарии - строго юг, в южном - строго север */
const noonN = S.sunEvents(LAT, LNG, TZ, 172);
ck('полдень в Ташкенте: солнце на юге', Math.abs(S.sunPos(LAT, LNG, TZ, 172, noonN.noon / 60).az - 180) < 0.05);
const jk = S.sunEvents(-6.2088, 106.8456, 7, 172);
const jkAz = S.sunPos(-6.2088, 106.8456, 7, 172, jk.noon / 60).az;
ck('полдень в Джакарте: солнце на севере', Math.min(jkAz, 360 - jkAz) < 0.05, jkAz.toFixed(2) + '°');

/* восход и заход: сверка с публикуемыми значениями для Ташкента */
const jun = S.sunEvents(LAT, LNG, TZ, 172);
const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
ck('21 июня восход около 04:51', Math.abs(jun.rise - (4 * 60 + 51)) <= 3, hm(jun.rise));
ck('21 июня заход около 20:00', Math.abs(jun.set - 20 * 60) <= 3, hm(jun.set));
ck('21 июня долгота дня 15 ч 09 мин', Math.abs(jun.dayLength - (15 * 60 + 9)) <= 2, Math.floor(jun.dayLength / 60) + ' ч ' + Math.round(jun.dayLength % 60) + ' мин');
const dec = S.sunEvents(LAT, LNG, TZ, 355);
ck('21 декабря долгота дня 9 ч 11 мин', Math.abs(dec.dayLength - (9 * 60 + 11)) <= 2, Math.floor(dec.dayLength / 60) + ' ч ' + Math.round(dec.dayLength % 60) + ' мин');
ck('зимой солнце ниже, чем летом', dec.noonAlt < jun.noonAlt - 40, `${dec.noonAlt.toFixed(1)}° против ${jun.noonAlt.toFixed(1)}°`);
ck('летом восход северо-восточнее, чем зимой', jun.riseAz < dec.riseAz, `${jun.riseAz.toFixed(0)}° против ${dec.riseAz.toFixed(0)}°`);

/* полярная ночь и полярный день не должны ронять расчёт */
const pol = S.sunEvents(78.2, 15.6, 1, 355);
ck('полярная ночь: восхода нет, а не ошибка', pol.rise === null && pol.dayLength === null);

/* кибла - сверка со справочными значениями */
[['Ташкент', 41.2995, 69.2401, 240.3, 3531], ['Лондон', 51.5074, -0.1278, 119.0, 4794],
 ['Джакарта', -6.2088, 106.8456, 295.2, 7920]].forEach(([n, la, lo, b, km]) => {
  const q = S.qibla(la, lo);
  ck(`кибла из «${n}»`, Math.abs(q.bearing - b) < 0.5 && Math.abs(q.km - km) < 15,
     `${q.bearing.toFixed(2)}° (справочник ${b}), ${q.km.toFixed(0)} км (справочник ${km})`);
});
ck('в самой Мекке расстояние ноль', S.qibla(21.4225, 39.8262).km < 0.001);

/* роза ветров: направление - откуда дует, штиль не имеет направления */
const r = S.windRose([0, 0, 0, 90, 90, 180, 270], [3, 4, 5, 2, 2, 6, 0]);
ck('штиль посчитан отдельно и не даёт направления', r.calm === 1 && r.total === 7, `штиль ${r.calm} из ${r.total}`);
ck('северный румб - три наблюдения', r.sectors[0].n === 3 && Math.abs(r.sectors[0].freq - 50) < 0.01, r.sectors[0].n + ' шт, ' + r.sectors[0].freq.toFixed(1) + '%');
ck('средняя скорость по румбу верна', Math.abs(r.sectors[0].mean - 4) < 1e-9, r.sectors[0].mean);
ck('сумма частот по румбам - 100 %', Math.abs(r.sectors.reduce((s, x) => s + x.freq, 0) - 100) < 1e-9);
ck('359° попадает в северный румб, а не в северо-западный', S.windRose([359], [5]).sectors[0].n === 1);
ck('пустые данные не роняют розу', S.windRose([], []).total === 0);
ck('румб по азимуту назван верно', S.compass(0) === 'С' && S.compass(90) === 'В' && S.compass(225) === 'ЮЗ',
   [S.compass(0), S.compass(90), S.compass(225)].join(' '));

/* адрес архива наблюдений */
const u = S.windUrl(41.3, 69.28, 224, 3, 7);
ck('запрос архива: три года, окно ±7 дней, без ключа', u.length === 3 && u.every(x => /archive-api\.open-meteo\.com/.test(x) && /wind_direction_10m/.test(x) && !/key=/.test(x)));

/* картинки - статичный SVG без внешних ссылок */
const svg = S.sunSvg({ track: S.sunTrack(LAT, LNG, TZ, 224), summer: S.sunTrack(LAT, LNG, TZ, 172),
                       winter: S.sunTrack(LAT, LNG, TZ, 355), markAz: 180, markAlt: 60, qibla: 240.3 });
ck('диаграмма солнца - статичный SVG', /^<svg /.test(svg) && !/<script|http:\/\/|https:\/\//.test(svg), svg.length + ' символов');
const rsvg = S.roseSvg(S.windRose([0, 45, 45, 90], [3, 4, 5, 2]));
ck('роза ветров - статичный SVG', /^<svg /.test(rsvg) && !/<script|https?:\/\//.test(rsvg), rsvg.length + ' символов');

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nВся математика солнца, киблы и ветра сверена');
process.exit(bad ? 1 : 0);
