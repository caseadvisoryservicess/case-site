/**
 * Botanica: из GBA каждого этажа убран лифтовой холл.
 *
 * Владелец 2026-07-30: GBA должна быть полной продаваемой площадью этажа,
 * лифтовой холл в неё входить не должен. В экспликациях чертежей (тех же
 * листах Botanica_ofisi.pdf, что и миграция 024) лифтовой холл - отдельная
 * строка на каждом этаже, от подвала до последнего:
 *
 *   подвал      Лифтавой холл  40,54   Итого экспликации 438,92
 *   1 этаж      Лифтавой холл  41,66   Итого экспликации 461,15
 *   этажи 2-7   Лифтовой холл  41,66   Итого экспликации 500,39 (на каждом)
 *
 * Новая GBA этажа = итог экспликации минус лифтовой холл:
 *
 *   подвал      438,92 - 40,54 = 398,38
 *   1 этаж      461,15 - 41,66 = 419,49
 *   этажи 2-7   500,39 - 41,66 = 458,73 (на каждом)
 *   итого здания: 398,38 + 419,49 + 458,73 x 6 = 3 570,25 -> 3 570,3
 *
 * GLA не меняется (в GLA лифтового холла и так не было). Правит per-этажные
 * u.gba, сводную строку «этажи целиком», крупные цифры на странице (факты
 * героя, лента параметров, «О здании»), фин-модель и обложку брошюры.
 *
 * Миграция аддитивная и идемпотентная. Запуск:
 *   node migrations/025-botanica-gba-no-lift.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'projects', 'botanica', 'project.json');
if (!fs.existsSync(FILE)) { console.log('Проект botanica не найден, пропускаю'); process.exit(0); }

const GBA = { b: '398,38', f1: '419,49', f2: '458,73', f3: '458,73', f4: '458,73', f5: '458,73', f6: '458,73', f7: '458,73' };
const TOTAL = { ru: '3 570,3', uz: '3 570,3', en: '3,570.3' };
const TOTAL_TABLE = '3 570,3';
const TOTAL_EXACT = 3570.25;

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
  ru: 'GBA 458,7 м², GLA 337,9 м² (этажи 2-7)',
  uz: 'GBA 458,7 m², GLA 337,9 m² (2-7-qavatlar)',
  en: 'GBA 458.7 m², GLA 337.9 m² (floors 2-7)'
});

// фин-модель берёт площади отсюда
cfg.fin = cfg.fin || {};
if (cfg.fin.gba !== TOTAL_EXACT) { cfg.fin.gba = TOTAL_EXACT; n++; }

// обложка брошюры, если в ней указана общая площадь
if (cfg.pres && cfg.pres.cover && cfg.pres.cover.gba && cfg.pres.cover.gba !== TOTAL_TABLE) {
  cfg.pres.cover.gba = TOTAL_TABLE; n++;
}

if (n) fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log(n ? `Изменений: ${n}` : 'Уже применено, изменений нет');
