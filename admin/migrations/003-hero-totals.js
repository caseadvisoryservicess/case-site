/**
 * Правка 003: итоговые GLA и GBA здания на титульном экране (факты героя).
 *
 * Добавляет в intro.facts два факта с проверенными цифрами:
 *   1 882,9 м² GLA всего и 2 152,4 м² GBA всего
 * (GBA - сумма по уровням из рабочей документации:
 *  375,9 + 412,9 + 453,0 + 453,0 + 457,6 = 2 152,4; те же цифры в PDF-презентации).
 * Подписи на трёх языках, термины переведены, аббревиатура в скобках.
 * Идемпотентна: повторный запуск ничего не дублирует.
 *
 * Запуск: node migrations/003-hero-totals.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2 - сначала 001-schema-v2.js up'); process.exit(1); }

cfg.intro = cfg.intro || {};
const facts = Array.isArray(cfg.intro.facts) ? cfg.intro.facts : (cfg.intro.facts = []);
const ruOf = (f) => (f.l && f.l.ru) || '';

// итоговый GLA уже есть, если найден факт с GLA не «на этаж»; GBA - по вхождению GBA
const hasGlaTotal = facts.some((f) => /GLA/.test(ruOf(f)) && !/этаж/.test(ruOf(f)));
const hasGba = facts.some((f) => /GBA/.test(ruOf(f)));

const totals = [
  { skip: hasGlaTotal, fact: { n: '1 882,9', l: { ru: 'м² арендопригодной площади (GLA)', uz: 'm² ijaraga yaroqli maydon (GLA)', en: 'm² total GLA' } } },
  { skip: hasGba, fact: { n: '2 152,4', l: { ru: 'м² общей площади (GBA)', uz: 'm² umumiy maydon (GBA)', en: 'm² total GBA' } } }
];

// вставляем после факта «уровней» (если он есть), сохраняя порядок GLA -> GBA
let at = facts.findIndex((f) => ruOf(f).includes('уровн')) + 1;
let added = 0;
for (const t of totals) {
  if (t.skip) { console.log('= уже есть:', t.fact.l.ru); at++; continue; }
  facts.splice(at, 0, t.fact);
  at++;
  added++;
  console.log('✓ добавлен факт героя:', t.fact.n, t.fact.l.ru);
}

if (added) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
