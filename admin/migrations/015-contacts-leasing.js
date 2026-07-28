/**
 * Правка 015: единые контакты отдела аренды на всех лендингах.
 *
 * Владелец 2026-07-28: личный номер и телеграм Мухаммада с лендингов убрать,
 * вместо них поставить контакты команды по аренде:
 *   Нодир Махмудходжизода  +998 77 041 73 75   telegram @caseadvisory_leasing
 *   Хилола Омонуллаева     +998 70 164 40 02
 *
 * Основным (шапка, липкая панель, подвал, разметка) становится номер Нодира,
 * телеграм-канал общий. В блоке заявки шаблон показывает обоих по именам:
 * поле contacts.people. По брифу в контактах должен стоять живой человек,
 * а не безличный номер.
 *
 * Что НЕ трогаем: smtpHost/smtpUser/smtpPass, tgBotToken, tgChatId,
 * sheetsEndpoint - это рабочие настройки уведомлений на проде (правило 7).
 *
 * Идемпотентна. Запускать для каждого проекта:
 *   node migrations/015-contacts-leasing.js takhtapul
 *   node migrations/015-contacts-leasing.js galaba
 *   node migrations/015-contacts-leasing.js kibray-dc
 *   node migrations/015-contacts-leasing.js mercure-restaurant
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
if (!fs.existsSync(FILE)) { console.error('Нет такого проекта:', slug); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2'); process.exit(1); }

const PHONE = '+998 77 041 73 75';
const TG = 'caseadvisory_leasing';
const PEOPLE = [
  { name: { ru: 'Нодир Махмудходжизода', uz: 'Nodir Mahmudhojizoda', en: 'Nodir Mahmudhojizoda' }, phone: '+998 77 041 73 75' },
  { name: { ru: 'Хилола Омонуллаева', uz: 'Hilola Omonullayeva', en: 'Hilola Omonullayeva' }, phone: '+998 70 164 40 02' }
];

const c = (cfg.contacts = cfg.contacts || {});
let changes = 0;

if (c.phone !== PHONE) { console.log('✓ основной телефон:', c.phone || '(пусто)', '->', PHONE); c.phone = PHONE; changes++; }
if (c.telegram !== TG) { console.log('✓ телеграм:', c.telegram || '(пусто)', '->', '@' + TG); c.telegram = TG; changes++; }
if (JSON.stringify(c.people) !== JSON.stringify(PEOPLE)) {
  c.people = PEOPLE; changes++;
  console.log('✓ менеджеры в блоке заявки: Нодир и Хилола');
}

// подстраховка: старый номер мог осесть в текстах подвала или блоков
const OLD = /\+998\s*90\s*922\s*07\s*00/g;
const walk = (o) => {
  if (typeof o === 'string') return OLD.test(o) ? o.replace(OLD, PHONE) : o;
  if (Array.isArray(o)) return o.map(walk);
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (k === 'phone') continue;
      o[k] = walk(o[k]);
    }
  }
  return o;
};
const before = JSON.stringify(cfg);
walk(cfg);
if (JSON.stringify(cfg) !== before) { changes++; console.log('✓ старый номер заменён и в текстах'); }

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
