/**
 * Правка 007: убрать последнее упоминание SFB - строку «Здание также
 * известно как бизнес-центр SFB» в «О здании» (решение владельца).
 * После неё SFB на лендинге не упоминается вообще.
 *
 * Обратима: чтобы вернуть, впишите тексты обратно в about.sfbNote
 * (ru: «Здание также известно как бизнес-центр SFB.»,
 *  uz: «Bino SFB biznes markazi nomi bilan ham tanilgan.»,
 *  en: «The building is also known as the SFB business center.»).
 * Идемпотентна.
 *
 * Запуск: node migrations/007-sfb-note-remove.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const note = (cfg.about && cfg.about.sfbNote) || null;
const hasText = note && Object.values(note).some((v) => String(v || '').trim());
if (!hasText) { console.log('Изменений нет: строка SFB уже убрана.'); process.exit(0); }

cfg.about.sfbNote = { ru: '', uz: '', en: '' };
console.log('✓ строка «Здание также известно как бизнес-центр SFB» убрана (ru/uz/en)');
fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log('Готово:', FILE);
