/**
 * Правка 008: площади Taxtapul по государственному кадастру.
 *
 * Источники (сессия 2026-07-24, подтверждено владельцем):
 * - выписка по зданию 10.07.2026: GBA 2 299,00, GLA 1 854,99;
 * - выписка «подвал + 1 этаж» 21.04.2026: GBA 855,00, GLA 740,53;
 * - разбивка инженера (Камолиддин): подвал 415,0, 1 этаж 440,0 (пятно застройки),
 *   этажи 2-4 равные по консоли: (2 299 - 855) / 3 = 481,33.
 * Поэтажные GBA точные; GLA подвала и 1 этажа - пропорциональная разбивка
 * кадастровых 740,53 (уточнить, когда инженер даст обмер по отдельности),
 * GLA этажей 2-4 строго кадастровая: (1 854,99 - 740,53) / 3 = 371,5.
 * Приписка 4-го этажа: зоны 288,7 + 82,8 (из финальных чертежей Taxtapul_3).
 * Идемпотентна: значения просто приводятся к целевым.
 *
 * Запуск: node migrations/008-cadastre-areas.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2 - сначала 001-schema-v2.js up'); process.exit(1); }

let changes = 0;
const set = (obj, key, val, label) => {
  if (obj[key] !== val) { obj[key] = val; changes++; console.log('✓', label, '->', val); }
};

// 1) юниты: кадастровые GLA/GBA
const AREAS = {
  b: { gla: '358,9', gba: '415,0' },
  f1: { gla: '381,6', gba: '440,0' },
  f2: { gla: '371,5', gba: '481,3' },
  f3: { gla: '371,5', gba: '481,3' },
  f4: { gla: '371,5', gba: '481,4' },
  all: { gla: '1 855,0', gba: '2 299,0' }
};
for (const u of cfg.units || []) {
  const a = AREAS[u.id];
  if (!a) continue;
  set(u, 'gla', a.gla, 'GLA ' + u.id);
  set(u, 'gba', a.gba, 'GBA ' + u.id);
  if (u.id === 'f4' && u.glaNote !== '288,7 + 82,8') { u.glaNote = '288,7 + 82,8'; changes++; console.log('✓ приписка 4-го этажа: 288,7 + 82,8 (по чертежам v3)'); }
}

// 2) факты героя
for (const f of (cfg.intro && cfg.intro.facts) || []) {
  const ru = (f.l && f.l.ru) || '';
  if (/GLA/.test(ru) && !/этаж/.test(ru)) set(f, 'n', '1 855,0', 'факт героя GLA');
  else if (/GBA/.test(ru)) set(f, 'n', '2 299,0', 'факт героя GBA');
  else if (/на этаж/.test(ru)) set(f, 'n', '359-382', 'факт героя диапазон на этаж');
}

// 3) лента параметров
for (const p of cfg.params || []) {
  if (/GLA/.test((p.l && p.l.ru) || '') && typeof p.n === 'string') set(p, 'n', '1 855,0', 'параметр GLA');
}

// 4) «О здании»
for (const r of (cfg.about && cfg.about.specs) || []) {
  const b = (r.b && r.b.ru) || '';
  if (/\(GLA\)/.test(b)) {
    if ((r.s && r.s.ru) !== '1 855,0 м²') { r.s = { ru: '1 855,0 м²', uz: '1 855,0 m²', en: '1,855.0 m²' }; changes++; console.log('✓ «О здании»: GLA 1 855,0 м²'); }
  } else if (/\(GBA\)/.test(b)) {
    if ((r.s && r.s.ru) !== '2 299,0 м²') { r.s = { ru: '2 299,0 м²', uz: '2 299,0 m²', en: '2,299.0 m²' }; changes++; console.log('✓ «О здании»: GBA 2 299,0 м²'); }
  }
}

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
