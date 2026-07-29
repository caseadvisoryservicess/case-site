/**
 * Счётчик Яндекс.Метрики на все лендинги.
 *
 * Счётчик один на домен caseadvisory.uz, поэтому один и тот же номер ставится
 * всем проектам: в Метрике страницы разойдутся по адресам (/taxtapul/,
 * /galaba/, /botanica/ и так далее), а сводка по домену останется общей.
 *
 * Шаблон подставляет счётчик сам, когда в настройках проекта заполнено поле
 * settings.metricaId. Своя аналитика CASE (события в панели) работает
 * независимо и не отключается.
 *
 * Миграция аддитивная и идемпотентная: не трогает проект, где номер уже стоит
 * (в том числе если там другой номер - значит так и задумано).
 *
 * Запуск: node migrations/019-metrika.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ID = '111115481';
const DIR = path.join(__dirname, '..', 'data', 'projects');

let changed = 0;
for (const slug of fs.readdirSync(DIR)) {
  const file = path.join(DIR, slug, 'project.json');
  if (!fs.existsSync(file)) continue;
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.settings = cfg.settings || {};
  const cur = String(cfg.settings.metricaId || '').trim();
  if (cur) {
    console.log(`${slug}: уже стоит счётчик ${cur}, пропускаю`);
    continue;
  }
  cfg.settings.metricaId = ID;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`${slug}: счётчик ${ID} проставлен`);
  changed++;
}
console.log(changed ? `Изменено проектов: ${changed}` : 'Изменений нет');
