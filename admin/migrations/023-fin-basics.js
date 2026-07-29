/**
 * Опорные площади проектов для фин-модели (блок cfg.fin).
 *
 * Фин-модель научилась подставлять данные выбранного проекта, но площади у
 * разных типов объектов лежат в разных местах: у зданий они в юнитах, у земли
 * и одиночного помещения - только в текстах. Чтобы модель не парсила прозу,
 * складываем проверенные числа в отдельный блок:
 *   siteArea  - участок, м²
 *   footprint - пятно застройки, м²
 *   gba, gla  - общая и арендопригодная площадь, м²
 * Ноль означает «неизвестно»: модель оставит поле пустым для ручного ввода.
 *
 * Источники чисел - паспорт проекта (CLAUDE.md) и данные лендингов:
 * Тахтапул 645/440/2299/1855, Галаба 500 (участок по кадастру) и 2400/1436,5,
 * Кибрай 65000 и строения 2269, ресторан 303,8/279,7, Botanica 468 (26x18)
 * и 4133,4/2575,4.
 *
 * Миграция аддитивная и идемпотентная. Запуск: node migrations/023-fin-basics.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FIN = {
  takhtapul: { siteArea: 645, footprint: 440, gba: 2299, gla: 1855 },
  galaba: { siteArea: 500, footprint: 400, gba: 2400, gla: 1436.5 },
  'kibray-dc': { siteArea: 65000, footprint: 0, gba: 2269, gla: 0 },
  'mercure-restaurant': { siteArea: 0, footprint: 0, gba: 303.8, gla: 279.7 },
  botanica: { siteArea: 0, footprint: 468, gba: 4133.4, gla: 2575.4 }
};
const DIR = path.join(__dirname, '..', 'data', 'projects');

let changed = 0;
for (const [slug, fin] of Object.entries(FIN)) {
  const file = path.join(DIR, slug, 'project.json');
  if (!fs.existsSync(file)) { console.log(`${slug}: проекта нет, пропускаю`); continue; }
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (cfg.fin && Object.keys(cfg.fin).length) { console.log(`${slug}: блок fin уже есть, пропускаю`); continue; }
  cfg.fin = fin;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`${slug}: площади для фин-модели записаны`);
  changed++;
}
console.log(changed ? `Изменено проектов: ${changed}` : 'Изменений нет');
