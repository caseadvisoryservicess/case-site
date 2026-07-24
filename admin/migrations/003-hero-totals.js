/**
 * Правка 003: итоговые GLA и GBA здания на титульном экране (факты героя).
 *
 * Добавляет в intro.facts два факта с проверенными цифрами:
 *   1 882,9 м² GLA всего и 2 152,4 м² GBA всего
 * (GBA - сумма по уровням из рабочей документации:
 *  375,9 + 412,9 + 453,0 + 453,0 + 457,6 = 2 152,4; те же цифры в PDF-презентации).
 * Подписи на трёх языках, каждая страница показывает свою.
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
const hasFact = (tag) => facts.some((f) => ((f.l && f.l.ru) || '').includes(tag));

const totals = [
  { tag: 'GLA всего', fact: { n: '1 882,9', l: { ru: 'м² GLA всего', uz: 'm² umumiy GLA', en: 'm² total GLA' } } },
  { tag: 'GBA', fact: { n: '2 152,4', l: { ru: 'м² GBA всего', uz: 'm² umumiy GBA', en: 'm² total GBA' } } }
];

// вставляем после факта «уровней» (если он есть), сохраняя порядок GLA -> GBA
let at = facts.findIndex((f) => ((f.l && f.l.ru) || '').includes('уровн')) + 1;
let added = 0;
for (const t of totals) {
  if (hasFact(t.tag)) { console.log('= уже есть:', t.fact.l.ru); at = Math.max(at, facts.findIndex((f) => ((f.l && f.l.ru) || '').includes(t.tag)) + 1); continue; }
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
