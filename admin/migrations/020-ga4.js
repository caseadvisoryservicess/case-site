/**
 * Google Analytics 4 на все лендинги.
 *
 * Поток данных в GA4 заведён на домен caseadvisory.uz, поэтому идентификатор
 * измерения один на все проекты: страницы разойдутся по адресам, а сводка по
 * домену останется общей.
 *
 * Шаблон подставляет gtag сам, когда заполнено settings.ga4Id. Если у проекта
 * задан GTM, шаблон отдаёт предпочтение ему и код GA4 отдельно не вставляет,
 * чтобы просмотры не считались дважды.
 *
 * Миграция аддитивная и идемпотентная: проект, где идентификатор уже стоит,
 * не трогается.
 *
 * Запуск: node migrations/020-ga4.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ID = 'G-X9Y8MHCP9L';
const DIR = path.join(__dirname, '..', 'data', 'projects');

let changed = 0;
for (const slug of fs.readdirSync(DIR)) {
  const file = path.join(DIR, slug, 'project.json');
  if (!fs.existsSync(file)) continue;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.settings = cfg.settings || {};
  const cur = String(cfg.settings.ga4Id || '').trim();
  if (cur) {
    console.log(`${slug}: уже стоит GA4 ${cur}, пропускаю`);
    continue;
  }
  cfg.settings.ga4Id = ID;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`${slug}: GA4 ${ID} проставлен`);
  changed++;
}
console.log(changed ? `Изменено проектов: ${changed}` : 'Изменений нет');
