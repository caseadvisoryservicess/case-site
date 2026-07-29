/**
 * Botanica: общая площадь (GBA) по экспликациям новых чертежей.
 *
 * В обновлённых чертежах (Botanica_ofisi.pdf, июль 2026) справа на каждом
 * листе стоит таблица «Экспликация помещений» с итогом по этажу. Владелец
 * подтвердил: этот итог и есть GBA этажа.
 *
 *   подвал      438,92   (было 485,7)
 *   1 этаж      461,15   (было 485,7)
 *   этажи 2-7   500,39   (было 527,0)
 *   итого     3 902,41   (было 4 133,4)
 *
 * Арендопригодная площадь (GLA) не меняется: 253,9 / 294,1 / 337,9, итого
 * 2 575,4.
 *
 * В таблице помещений оставляем цифры экспликации как есть, до сотых: так
 * сумма этажей сходится с итогом ровно. В крупных цифрах (факты героя, лента
 * параметров, «О здании») показываем 3 902,4 - один знак после запятой, как у
 * всех остальных площадей на странице.
 *
 * Миграция аддитивная и идемпотентная. Правит и cfg.fin для фин-модели.
 * Запуск: node migrations/024-botanica-gba-explication.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'projects', 'botanica', 'project.json');
if (!fs.existsSync(FILE)) { console.log('Проект botanica не найден, пропускаю'); process.exit(0); }

const GBA = { b: '438,92', f1: '461,15', f2: '500,39', f3: '500,39', f4: '500,39', f5: '500,39', f6: '500,39', f7: '500,39' };
const TOTAL = { ru: '3 902,4', uz: '3 902,4', en: '3,902.4' };
const TOTAL_TABLE = '3 902,4';

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;

for (const u of cfg.units || []) {
  if (u.whole) {
    if (u.gba !== TOTAL_TABLE) { u.gba = TOTAL_TABLE; n++; }
    continue;
  }
  const want = GBA[u.id];
  if (want && u.gba !== want) { u.gba = want; n++; }
}

// крупные цифры на странице
const setMl = (obj, val) => {
  if (!obj) return;
  for (const lang of ['ru', 'uz', 'en']) {
    const v = val[lang] || val.ru;
    if (obj[lang] !== undefined && obj[lang] !== v) { obj[lang] = v; n++; }
  }
};
const byLabel = (arr, needle) => (arr || []).find((x) => {
  const l = (x.l && x.l.ru) || (x.b && x.b.ru) || '';
  return l.includes(needle);
});

setMl((byLabel(cfg.intro && cfg.intro.facts, 'общей площади (GBA)') || {}).n, TOTAL);
setMl((byLabel(cfg.params, 'м² GBA') || {}).n, TOTAL);

const spec = byLabel(cfg.about && cfg.about.specs, 'Общая площадь (GBA)');
if (spec) setMl(spec.s, { ru: TOTAL.ru + ' м²', uz: TOTAL.uz + ' m²', en: TOTAL.en + ' m²' });

const typ = byLabel(cfg.about && cfg.about.specs, 'Типовой этаж');
if (typ) setMl(typ.s, {
  ru: 'GBA 500,4 м², GLA 337,9 м² (этажи 2-7)',
  uz: 'GBA 500,4 m², GLA 337,9 m² (2-7-qavatlar)',
  en: 'GBA 500.4 m², GLA 337.9 m² (floors 2-7)'
});

// фин-модель берёт площади отсюда
cfg.fin = cfg.fin || {};
if (cfg.fin.gba !== 3902.41) { cfg.fin.gba = 3902.41; n++; }

// обложка брошюры, если в ней указана общая площадь
if (cfg.pres && cfg.pres.cover && cfg.pres.cover.gba && cfg.pres.cover.gba !== TOTAL_TABLE) {
  cfg.pres.cover.gba = TOTAL_TABLE; n++;
}

if (n) fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log(n ? `Изменений: ${n}` : 'Уже применено, изменений нет');
