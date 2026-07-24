/**
 * Правка 004: CAD-планировки на лендинге, GBA везде, переводы терминов.
 *
 * - Планировки юнитов переключаются на реальные CAD-планы из рабочей
 *   документации (те же файлы, что в PDF-презентации): plan-cad-*.jpg.
 *   Файл ставится только если он существует в uploads.
 * - Каждому юниту добавляется поэтажный GBA из рабочей документации
 *   (375,9 / 412,9 / 453,0 / 453,0 / 457,6; здание целиком 2 152,4).
 * - «О здании»: строка «Общая площадь (GBA) 2 152,4 м²», термин GLA
 *   переведён с аббревиатурой в скобках.
 * - Лента параметров и факты героя: термины GLA/GBA переведены на ru/uz.
 * Идемпотентна: повторный запуск ничего не дублирует и не ломает.
 *
 * Запуск: node migrations/004-cad-plans-gba.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const DIR = path.join(__dirname, '..', 'data', 'projects', slug);
const FILE = path.join(DIR, 'project.json');
const UP = path.join(DIR, 'uploads');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2 - сначала 001-schema-v2.js up'); process.exit(1); }

const PLANS = { b: 'plan-cad-b.jpg', f1: 'plan-cad-f1.jpg', f2: 'plan-cad-f23.jpg', f3: 'plan-cad-f23.jpg', f4: 'plan-cad-f4.jpg' };
const GBA = { b: '375,9', f1: '412,9', f2: '453,0', f3: '453,0', f4: '457,6', all: '2 152,4' };

// 1) юниты: CAD-планы + поэтажный GBA
for (const u of cfg.units || []) {
  const cad = PLANS[u.id];
  if (cad && fs.existsSync(path.join(UP, cad)) && u.plan !== cad) {
    console.log('✓ планировка', u.id + ':', u.plan, '->', cad);
    u.plan = cad;
  }
  if (GBA[u.id] && u.gba !== GBA[u.id]) {
    u.gba = GBA[u.id];
    console.log('✓ GBA', u.id + ':', u.gba);
  }
}

// 2) «О здании»: перевод строки GLA + строка GBA
if (cfg.about && Array.isArray(cfg.about.specs)) {
  const specs = cfg.about.specs;
  const glaIdx = specs.findIndex((r) => /GLA/.test((r.b && r.b.ru) || ''));
  if (glaIdx > -1 && specs[glaIdx].b.ru === 'GLA') {
    specs[glaIdx].b = { ru: 'Арендопригодная площадь (GLA)', uz: 'Ijaraga yaroqli maydon (GLA)', en: 'GLA' };
    console.log('✓ «О здании»: строка GLA переведена');
  }
  if (!specs.some((r) => /GBA/.test((r.b && r.b.ru) || ''))) {
    specs.splice(glaIdx > -1 ? glaIdx + 1 : specs.length, 0, {
      b: { ru: 'Общая площадь (GBA)', uz: 'Umumiy maydon (GBA)', en: 'GBA' },
      s: { ru: '2 152,4 м²', uz: '2 152,4 m²', en: '2,152.4 m²' }
    });
    console.log('✓ «О здании»: добавлена строка GBA 2 152,4 м²');
  }
}

// 3) лента параметров: перевод термина GLA
for (const p of cfg.params || []) {
  const ru = (p.l && p.l.ru) || '';
  if (/GLA/.test(ru) && ru !== 'м² арендопригодной площади (GLA)') {
    p.l = { ru: 'м² арендопригодной площади (GLA)', uz: 'm² ijaraga yaroqli maydon (GLA)', en: 'm² total GLA' };
    console.log('✓ параметры: термин GLA переведён');
  }
}

// 4) факты героя: перевод терминов (если правка 003 была применена со старыми подписями)
const RELABEL = [
  ['м² GLA всего', { ru: 'м² арендопригодной площади (GLA)', uz: 'm² ijaraga yaroqli maydon (GLA)', en: 'm² total GLA' }],
  ['м² GBA всего', { ru: 'м² общей площади (GBA)', uz: 'm² umumiy maydon (GBA)', en: 'm² total GBA' }],
  ['м² GLA на этаж', { ru: 'м² на этаж (GLA)', uz: 'm² har qavatda (GLA)', en: 'm² GLA per floor' }]
];
for (const f of (cfg.intro && cfg.intro.facts) || []) {
  const ru = (f.l && f.l.ru) || '';
  for (const [old, l] of RELABEL) {
    if (ru === old) { f.l = l; console.log('✓ факт героя переведён:', l.ru); }
  }
}

fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log('Готово:', FILE);
