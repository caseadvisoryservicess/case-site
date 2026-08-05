/**
 * Botanica: две неточности в данных, найденные при сплошной сверке меморандума.
 *
 * 1. Опечатка в подписи под планировками: «колонны 5-5-6-5-5 на 6-6-6 мм».
 *    Шаг колонн в миллиметрах бессмыслен, во всех остальных местах проекта
 *    (about.specs, тексты) та же сетка записана в метрах. Правим на «м» во всех
 *    трёх языках. Подпись видна и на лендинге, и в публичной брошюре.
 *
 * 2. На обложке брошюры величина 3,3-4,2 м подписана словом «потолки», хотя
 *    внутри документа тот же параметр везде называется «высота этажа». Это
 *    принципиально: 3,3 / 3,6 / 4,2 - расстояния между отметками перекрытий,
 *    чистая высота в помещении меньше на конструкцию и подвесной потолок.
 *    Слово «потолки» - общий значёк по умолчанию в gen-presentation.js, он
 *    верен для Тахтапула и Галабы (там сняты потолки в свету по разрезу),
 *    поэтому правим не общий шаблон, а только Botanica через cfg.pres.T.
 *
 * Миграция аддитивная и идемпотентная.
 * Запуск: node migrations/026-botanica-plan-note-and-ceil.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'projects', 'botanica', 'project.json');
if (!fs.existsSync(FILE)) { console.log('Проект botanica не найден, пропускаю'); process.exit(0); }

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;

// 1. шаг колонн: миллиметры -> метры
const walk = (o) => {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string' && v.includes('6-6-6 мм')) { o[k] = v.replace('6-6-6 мм', '6-6-6 м'); n++; }
    else if (typeof v === 'string' && v.includes('6-6-6 kolonnalar')) { /* uz: единиц нет, не трогаем */ }
    else if (typeof v === 'object') walk(v);
  }
};
walk(cfg);

// en-вариант пишет grid без единиц, uz тоже - проверяем только явные «мм»
const fixEn = (o) => {
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (typeof v === 'string' && v.includes('by 6-6-6 grid')) { /* без единиц, корректно */ }
    else if (typeof v === 'object') fixEn(v);
  }
};
fixEn(cfg);

// 2. подпись величины на обложке: «потолки» -> «высота этажа»
cfg.pres = cfg.pres || {};
cfg.pres.T = cfg.pres.T || {};
const want = { ru: 'высота этажа', uz: 'qavat balandligi', en: 'floor height' };
const cur = cfg.pres.T.cover_ceil || {};
if (cur.ru !== want.ru || cur.uz !== want.uz || cur.en !== want.en) {
  cfg.pres.T.cover_ceil = want; n++;
}

if (n) fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log(n ? `Изменений: ${n}` : 'Уже применено, изменений нет');
