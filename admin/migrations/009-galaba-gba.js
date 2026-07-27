/**
 * Правка 009: общая площадь здания (GBA) на лендинге Галабы.
 *
 * По просьбе владельца: на странице была только арендопригодная площадь,
 * общей площади здания не было нигде. Добавляем:
 *  - в факты героя: 2 400,0 м² общей площади здания (GBA);
 *  - в «О здании»: две строки - здание целиком 2 400,0 м² (подвал и 5 этажей)
 *    и этажи 1-5, которые предлагаются, 2 000,0 м².
 * Заодно из фактов героя убираются парковка и район: парковка есть в ленте
 * параметров сразу под героем, район - в шапке и в блоке локации, а шесть
 * фактов в строку не помещались и последний висел сиротой.
 *
 * Цифры: 6 уровней по 400,0 м² = 2 400,0; этажи 1-5 = 2 000,0 (чертежи Galaba_3).
 * Идемпотентна: повторный запуск ничего не меняет.
 *
 * Запуск: node migrations/009-galaba-gba.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'galaba';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2'); process.exit(1); }

const ml = (ru, uz, en) => ({ ru, uz, en });
const ruOf = (v) => (v && typeof v === 'object' ? v.ru : v) || '';
let changes = 0;

// 1) факты героя: только строки с цифрой, GBA сразу после GLA
const facts = (cfg.intro && cfg.intro.facts) || [];
const before = facts.length;
for (let i = facts.length - 1; i >= 0; i--) if (!facts[i].n) facts.splice(i, 1);
if (facts.length !== before) { changes++; console.log('✓ из фактов героя убраны строки без цифры:', before - facts.length); }

const parkIdx = facts.findIndex((f) => /машином/.test(ruOf(f.l)));
if (parkIdx >= 0) { facts.splice(parkIdx, 1); changes++; console.log('✓ парковка убрана из фактов героя (осталась в ленте параметров)'); }

if (!facts.some((f) => /GBA/.test(ruOf(f.l)))) {
  const glaIdx = facts.findIndex((f) => /GLA/.test(ruOf(f.l)));
  facts.splice(glaIdx + 1, 0, {
    n: { ru: '2 400,0', uz: '2 400,0', en: '2,400.0' },
    l: ml('м² общей площади здания (GBA)', 'm² binoning umumiy maydoni (GBA)', 'm² total building GBA')
  });
  changes++; console.log('✓ в факты героя добавлено: GBA 2 400,0');
}

// 2) «О здании»: строки про общую площадь
const specs = (cfg.about && cfg.about.specs) || [];
const hasAll = specs.some((s) => /Общая площадь здания/.test(ruOf(s.b)));
const hasF15 = specs.some((s) => /этажей 1-5/.test(ruOf(s.b)));
const glaRow = specs.findIndex((s) => /\(GLA\)/.test(ruOf(s.b)));
let at = glaRow >= 0 ? glaRow + 1 : specs.length;
if (!hasAll) {
  specs.splice(at++, 0, {
    b: ml('Общая площадь здания (GBA)', 'Binoning umumiy maydoni (GBA)', 'Total building GBA'),
    s: ml('2 400,0 м² (подвал и 5 этажей)', '2 400,0 m² (podval va 5 qavat)', '2,400.0 m² (basement and 5 floors)')
  });
  changes++; console.log('✓ «О здании»: общая площадь здания 2 400,0 м²');
}
if (!hasF15) {
  specs.splice(at, 0, {
    b: ml('Общая площадь этажей 1-5 (GBA)', '1-5-qavatlar umumiy maydoni (GBA)', 'GBA of floors 1 to 5'),
    s: ml('2 000,0 м²', '2 000,0 m²', '2,000.0 m²')
  });
  changes++; console.log('✓ «О здании»: общая площадь этажей 1-5 - 2 000,0 м²');
}

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
