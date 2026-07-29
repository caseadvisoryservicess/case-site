/**
 * Приём заявок: заполнить leadEndpoint у всех проектов.
 *
 * Поле было пустым у всех проектов, кроме Тахтапула. Пустое значение шаблон
 * подставлял в форму как есть, и браузер отправлял заявку на саму страницу:
 * посетитель видел «Не удалось отправить», заявка никуда не попадала. Из этого
 * же адреса выводится адрес приёма событий, поэтому вместе с заявками молча
 * терялась и аналитика проекта.
 *
 * Ставим тот же вид адреса, что у Тахтапула, где всё работает.
 * Шаблон с этой версии умеет и сам подставлять /admin/api/lead/<slug>, но
 * явное значение видно в панели и его можно поменять руками.
 *
 * Миграция аддитивная и идемпотентная: заполненное поле не трогает.
 *
 * Запуск: node migrations/021-lead-endpoint.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const BASE = 'https://caseadvisory.uz/admin/api/lead/';
const DIR = path.join(__dirname, '..', 'data', 'projects');

let changed = 0;
for (const slug of fs.readdirSync(DIR)) {
  const file = path.join(DIR, slug, 'project.json');
  if (!fs.existsSync(file)) continue;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cur = String(cfg.leadEndpoint || '').trim();
  if (cur) {
    console.log(`${slug}: приём заявок уже настроен (${cur}), пропускаю`);
    continue;
  }
  cfg.leadEndpoint = BASE + (cfg.slug || slug);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`${slug}: приём заявок -> ${cfg.leadEndpoint}`);
  changed++;
}
console.log(changed ? `Изменено проектов: ${changed}` : 'Изменений нет');
