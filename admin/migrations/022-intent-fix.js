/**
 * Формат сделки у объектов, где он один.
 *
 * Раньше site.intent = none означало только «не показывать переключатель
 * аренда/покупка». Значение при этом всё равно бралось по умолчанию (аренда)
 * или подхватывалось из выбора посетителя на другом лендинге: домен один,
 * память браузера была общая. В итоге с участка под ЦОД, который продаётся,
 * заявка могла уйти с пометкой «аренда», а с ресторана, который сдаётся, -
 * с пометкой «покупка».
 *
 * Теперь site.intent принимает и конкретное значение:
 *   both  - переключатель на месте (Тахтапул, Галаба, Botanica)
 *   lease - только аренда (ресторан Mercure)
 *   buy   - только продажа (участок в Кибрае)
 * Шаблон фиксирует это значение, убирает лишние варианты из формы заявки и
 * хранит выбор посетителя отдельно для каждого проекта.
 *
 * Значения взяты из блока «Формат сделки» самих проектов: у Кибрая это
 * «Продажа», у ресторана «Аренда».
 *
 * Миграция идемпотентная. Запуск: node migrations/022-intent-fix.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FIX = { 'kibray-dc': 'buy', 'mercure-restaurant': 'lease' };
const DIR = path.join(__dirname, '..', 'data', 'projects');

let changed = 0;
for (const [slug, intent] of Object.entries(FIX)) {
  const file = path.join(DIR, slug, 'project.json');
  if (!fs.existsSync(file)) { console.log(`${slug}: проекта нет, пропускаю`); continue; }
  const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.site = cfg.site || {};
  if (cfg.site.intent === intent) { console.log(`${slug}: уже ${intent}, пропускаю`); continue; }
  cfg.site.intent = intent;
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2));
  console.log(`${slug}: формат сделки -> ${intent}`);
  changed++;
}
console.log(changed ? `Изменено проектов: ${changed}` : 'Изменений нет');
