/**
 * Правка 002: тексты по фидбеку (идемпотентная, можно запускать повторно).
 *
 * - плитка «Open plan» по-русски («Свободная планировка»)
 * - примечание к юнитам без англицизма
 * - из «О здании» убраны строки «Пятно этажа» и «Сетка колонн»
 * - подзаголовок формы без «прайса и графика стройки»
 *
 * Запуск: node migrations/002-texts.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2 — сначала 001-schema-v2.js up'); process.exit(1); }

// 1) плитка Open plan -> мультиязычная
for (const p of cfg.params || []) {
  if (p.n === 'Open plan') {
    p.n = { ru: 'Свободная планировка', uz: 'Erkin planirovka', en: 'Open plan' };
    p.l = { ru: 'делится под ваш бриф', uz: 'briefingizga moslab bo‘linadi', en: 'flexible floor plates' };
    console.log('✓ плитка «Open plan» переведена');
  }
}

// 2) примечание к юнитам без англицизма (RU)
if (cfg.unitsSection && cfg.unitsSection.note && /open plan/i.test(cfg.unitsSection.note.ru || '')) {
  cfg.unitsSection.note.ru = cfg.unitsSection.note.ru
    .replace(/Все этажи\s*[—-]\s*open plan:/i, 'Все этажи со свободной планировкой:');
  console.log('✓ примечание к юнитам переписано по-русски');
}

// 2б) англицизм в карточках «Кому подходит» (RU)
for (const c of (cfg.useCases && cfg.useCases.cards) || []) {
  if (c.p && /Open plan/.test(c.p.ru || '')) {
    c.p.ru = c.p.ru.replace(/Open plan/g, 'Свободная планировка');
    console.log('✓ карточка «' + ((c.h && c.h.ru) || '') + '» переписана по-русски');
  }
}

// 3) убрать строки «Пятно этажа» и «Сетка колонн»
if (cfg.about && Array.isArray(cfg.about.specs)) {
  const before = cfg.about.specs.length;
  cfg.about.specs = cfg.about.specs.filter((r) => {
    const b = (r.b && r.b.ru) || '';
    return b !== 'Пятно этажа' && b !== 'Сетка колонн';
  });
  if (cfg.about.specs.length !== before) console.log('✓ строки «Пятно этажа» и «Сетка колонн» убраны');
}

// 4) подзаголовок формы
if (cfg.lead && cfg.lead.sub && /прайс|стройк/i.test(cfg.lead.sub.ru || '')) {
  cfg.lead.sub = {
    ru: 'Оставьте контакты - вышлем планировки этажей и условия, ответим на вопросы по аренде и покупке.',
    uz: "Kontaktlaringizni qoldiring - qavat rejalari va shartlarni yuboramiz, ijara va sotib olish bo'yicha savollarga javob beramiz.",
    en: 'Leave your contacts - we will send floor plans and terms, and answer your questions on leasing and purchase.'
  };
  console.log('✓ подзаголовок формы обновлён');
}

fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log('Готово:', FILE);
