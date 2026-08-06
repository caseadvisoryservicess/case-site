/**
 * Тахтапул: убираем последние следы SFB - старые рендеры с логотипом на фасаде.
 *
 * Правило 4 паспорта: название SFB не упоминается нигде. Миграции 006 и 007
 * вычистили его из текстов, имени проекта и блока brand, но три картинки
 * остались лежать в uploads, и на фасаде у них большими буквами написано SFB:
 *
 *   hero.jpg            (старый герой, заменён на hero-dusk.jpg)
 *   facade-angle.jpg    (угловой ракурс)
 *   facade-evening.jpg  (вечерний фасад)
 *
 * На лендинг они не попадали: проект давно на схеме v2, а ссылки на них
 * остались только в мёртвых блоках v1 (hero.image и building.images), которые
 * template2.js не читает. Но файлы видны в панели в выборе картинок, то есть
 * их можно случайно поставить на страницу - и один раз это уже произошло:
 * они попали в титульные листы инвесторской презентации.
 *
 * Миграция снимает ссылки в v1-блоках. Сами файлы удаляются отдельно, скриптом
 * ниже, и на проде их нужно удалить руками через панель: данные прода деплоем
 * не перезаписываются (правило 7).
 *
 * Аддитивная и идемпотентная. Запуск: node migrations/027-takhtapul-sfb-renders.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SFB = ['hero.jpg', 'facade-angle.jpg', 'facade-evening.jpg'];
const FILE = path.join(__dirname, '..', 'data', 'projects', 'takhtapul', 'project.json');
if (!fs.existsSync(FILE)) { console.log('Проект takhtapul не найден, пропускаю'); process.exit(0); }

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;

// v1-блок hero: заменяем на актуальный герой схемы v2
if (cfg.hero && SFB.includes(cfg.hero.image)) {
  cfg.hero.image = (cfg.intro && cfg.intro.image) || 'hero-dusk.jpg';
  n++;
}

// v1-блок building: убираем SFB-кадры из списка
if (cfg.building && Array.isArray(cfg.building.images)) {
  const before = cfg.building.images.length;
  cfg.building.images = cfg.building.images.filter((f) => !SFB.includes(f));
  if (cfg.building.images.length !== before) n += before - cfg.building.images.length;
}

// на всякий случай проходим по всему конфигу: вдруг ссылка всплывёт где-то ещё
const scrub = (o) => {
  if (Array.isArray(o)) {
    for (let i = o.length - 1; i >= 0; i--) {
      if (typeof o[i] === 'string' && SFB.includes(o[i])) { o.splice(i, 1); n++; }
      else scrub(o[i]);
    }
  } else if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'string' && SFB.includes(o[k]) && k !== 'image') { o[k] = ''; n++; }
      else scrub(o[k]);
    }
  }
};
scrub(cfg);

if (n) fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log(n ? `Изменений: ${n}` : 'Уже применено, изменений нет');
