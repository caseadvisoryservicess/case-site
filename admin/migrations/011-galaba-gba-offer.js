/**
 * Правка 011: у Галабы общая площадь показывается по предложению, без подвала.
 *
 * Владелец уточнил: помещения махаллинского комитета уже переданы комитету и
 * в площадь продажи и аренды не входят, поэтому показывать GBA здания целиком
 * (2 400,0) неверно - подвал 400,0 весь у махалли.
 *
 * Ставим 2 000,0 - общая площадь этажей 1-5, то есть тех уровней, что в
 * предложении. Подвал из цифры уходит.
 *
 * Почему не «строго без махалли»: в чертежах Galaba_3 GBA дан только на этаж
 * целиком (400,0), у махаллинской части указана лишь GLA (подвал 344,1,
 * 1 этаж 134,9, 2 этаж 36,2). Вычесть её из GBA нельзя, не выдумав цифру
 * (правило 3). Вариант «этажи 3-5 = 1 200,0» отпадает: он меньше GLA 1 436,5
 * и читается как ошибка. То, что на 1 и 2 этаже часть площадей у комитета,
 * написано в блоке помещений, в вопросах и видно синим на планировках.
 *
 * Идемпотентна. Запуск: node migrations/011-galaba-gba-offer.js [slug]
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

// 1) факт героя: 2 400,0 -> 2 000,0 с подписью про этажи 1-5
for (const f of (cfg.intro && cfg.intro.facts) || []) {
  if (!/GBA/.test(ruOf(f.l))) continue;
  const want = { ru: '2 000,0', uz: '2 000,0', en: '2,000.0' };
  const wantL = ml('м² общей площади этажей 1-5 (GBA)', 'm² 1-5-qavatlar umumiy maydoni (GBA)', 'm² GBA of floors 1 to 5');
  if (JSON.stringify(f.n) !== JSON.stringify(want) || JSON.stringify(f.l) !== JSON.stringify(wantL)) {
    f.n = want; f.l = wantL; changes++;
    console.log('✓ факт героя: общая площадь этажей 1-5, 2 000,0');
  }
}

// 2) «О здании»: вместо двух строк одна, без подвала
const specs = (cfg.about && cfg.about.specs) || [];
const allIdx = specs.findIndex((s) => /Общая площадь здания/.test(ruOf(s.b)));
if (allIdx >= 0) { specs.splice(allIdx, 1); changes++; console.log('✓ убрана строка «Общая площадь здания 2 400,0» (включала подвал махалли)'); }

const f15 = specs.find((s) => /этажей 1-5/.test(ruOf(s.b)));
if (f15) {
  const wantS = ml('2 000,0 м² (этажи в предложении, без подвала)',
                   '2 000,0 m² (taklifdagi qavatlar, podvalsiz)',
                   '2,000.0 m² (floors offered, basement excluded)');
  if (JSON.stringify(f15.s) !== JSON.stringify(wantS)) {
    f15.s = wantS; changes++;
    console.log('✓ «О здании»: 2 000,0 м² с пояснением, что подвал не входит');
  }
}

// 3) брошюра: карточка «О проекте» тоже на 2 000,0
if (cfg.pres) {
  if (!cfg.pres.cover) cfg.pres.cover = {};
  if (cfg.pres.cover.gba !== '2 000,0') { cfg.pres.cover.gba = '2 000,0'; changes++; console.log('✓ брошюра: карточка GBA -> 2 000,0'); }
  if (!cfg.pres.T) cfg.pres.T = {};
  const wantT = ml('общая площадь этажей 1-5 (GBA)', '1-5-qavatlar umumiy maydoni (GBA)', 'GBA of floors 1 to 5');
  if (JSON.stringify(cfg.pres.T.card_gba) !== JSON.stringify(wantT)) {
    cfg.pres.T.card_gba = wantT; changes++; console.log('✓ брошюра: подпись карточки приведена к лендингу');
  }
}

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
