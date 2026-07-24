/**
 * Правка 005: высота потолков в «О здании» - каждая отметка отдельной
 * строкой-буллетом (вместо одной строки через точки).
 * Шаблон рендерит переносы строк через white-space:pre-line.
 * Цифры прежние, из рабочей документации: 1-й этаж 4,0; 2-3-й 3,6;
 * 4-й и подвал 3,0. Идемпотентна.
 *
 * Запуск: node migrations/005-ceilings-bullets.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2 - сначала 001-schema-v2.js up'); process.exit(1); }

const row = ((cfg.about && cfg.about.specs) || []).find((r) => /потолк/i.test((r.b && r.b.ru) || ''));
if (!row) { console.log('Строка «Высота потолков» не найдена, изменений нет.'); process.exit(0); }
if (/•/.test((row.s && row.s.ru) || '') && /\u2011/.test((row.s && row.s.ru) || '')) { console.log('Изменений нет: правка уже применена.'); process.exit(0); }

// внутри буллета неразрывные пробелы и неразрывные дефисы (U+2011, тот же
// короткий дефис по начертанию): строка-буллет не разрывается в узкой колонке
const nb = (t) => t.replace(/ /g, '\u00a0').replace(/-/g, '\u2011');
row.s = {
  ru: [nb('• 1-й этаж: 4,0 м'), nb('• 2-3-й: 3,6 м'), nb('• 4-й и подвал: 3,0 м')].join('\n'),
  uz: [nb('• 1-qavat: 4,0 m'), nb('• 2-3-qavatlar: 3,6 m'), nb('• 4-qavat va podval: 3,0 m')].join('\n'),
  en: [nb('• Floor 1: 4.0 m'), nb('• Floors 2-3: 3.6 m'), nb('• Floor 4 and basement: 3.0 m')].join('\n')
};
console.log('✓ высота потолков переписана буллетами по строкам');
fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log('Готово:', FILE);
