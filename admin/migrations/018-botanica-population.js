/**
 * Botanica: жители в радиусе и ближайшее метро.
 *
 * Источник - отчёт по точке из приложения CASE OS Geo Analytics (владелец
 * прислал 2026-07-29): население считает сетка Kontur H3, откалиброванная на
 * официальное население района. Наша собственная сетка в admin/data/geo даёт
 * ту же картину распределения, но в неподтверждённых единицах (примерно в 4,7
 * раза меньше), поэтому наружу идут именно калиброванные числа.
 *
 * Счёт объектов в отчёте сходится с нашей геобазой: медицина 5 / 14 в 1 и 1,5
 * км, аптеки 1 / 5, бизнес-центры на единицу больше только потому, что отчёт
 * считает и сам объект.
 *
 * Миграция аддитивная и идемпотентная.
 * Запуск: node migrations/018-botanica-population.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'projects', 'botanica', 'project.json');
if (!fs.existsSync(FILE)) {
  console.log('Проект botanica не найден, пропускаю');
  process.exit(0);
}

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let changed = 0;

// строка «жители в радиусе» идёт первой в таблице окружения
if (cfg.geo && Array.isArray(cfg.geo.around) && !cfg.geo.around.some((a) => a.k === 'pop')) {
  cfg.geo.around.unshift({
    k: 'pop',
    n1: 20959,    // 1 км
    n15: 59751,   // 1,5 км
    n3: 218966,   // 3 км
    l: { ru: 'жители в радиусе', uz: 'radius ichidagi aholi', en: 'residents within the radius' }
  });
  changed++;
}

// ближайшая станция метро: 2 427 м по отчёту, на странице округляем до 2,4 км
const metro = {
  ru: 'Ближайшее метро - станция Шахристан, 2,4 км',
  uz: 'Eng yaqin metro - Shahriston bekati, 2,4 km',
  en: 'Nearest metro: Shahriston station, 2.4 km'
};
if (cfg.location && !String((cfg.location.metroNote || {}).ru || '').trim()) {
  cfg.location.metroNote = metro;
  changed++;
}

if (changed) fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log(changed ? `Изменений: ${changed}` : 'Уже применено, изменений нет');
