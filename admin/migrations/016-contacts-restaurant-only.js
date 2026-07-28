/**
 * Правка 016: контакты отдела аренды остаются только на ресторане.
 *
 * Владелец 2026-07-28, уточнение к правке 015: менять контакты нужно было
 * только у ресторана, остальные проекты трогать не надо. Возвращаем им
 * прежний телефон и телеграм и убираем список менеджеров.
 *
 * Правка 015 при этом остаётся в истории и продолжает работать для нового
 * проекта: сам механизм contacts.people в шаблоне полезен и не мешает.
 *
 * Что НЕ трогаем: smtpHost/smtpUser/smtpPass, tgBotToken, tgChatId,
 * sheetsEndpoint - рабочие настройки уведомлений (правило 7).
 *
 * Идемпотентна. Запуск для каждого проекта, КРОМЕ ресторана:
 *   node migrations/016-contacts-restaurant-only.js takhtapul
 *   node migrations/016-contacts-restaurant-only.js galaba
 *   node migrations/016-contacts-restaurant-only.js kibray-dc
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
if (slug === 'mercure-restaurant') {
  console.error('У ресторана контакты отдела аренды остаются, эта правка не для него.');
  process.exit(1);
}
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
if (!fs.existsSync(FILE)) { console.error('Нет такого проекта:', slug); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2'); process.exit(1); }

const PHONE = '+998 90 922 07 00';
const TG = 'muhammadaxmadiy';
const NEW_PHONE = /\+998\s*77\s*041\s*73\s*75/g;

const c = (cfg.contacts = cfg.contacts || {});
let changes = 0;

if (c.phone !== PHONE) { console.log('✓ телефон:', c.phone || '(пусто)', '->', PHONE); c.phone = PHONE; changes++; }
if (c.telegram !== TG) { console.log('✓ телеграм:', c.telegram || '(пусто)', '->', '@' + TG); c.telegram = TG; changes++; }
if (c.people) { delete c.people; changes++; console.log('✓ список менеджеров убран'); }

// номер мог осесть в текстах подвала или блоков
const walk = (o) => {
  if (typeof o === 'string') return NEW_PHONE.test(o) ? o.replace(NEW_PHONE, PHONE) : o;
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
if (JSON.stringify(cfg) !== before) { changes++; console.log('✓ номер заменён и в текстах'); }

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
