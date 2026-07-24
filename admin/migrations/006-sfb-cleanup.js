/**
 * Правка 006: убрать старое название SFB отовсюду, кроме одной согласованной
 * строки в «О здании» (about.sfbNote: «Здание также известно как бизнес-центр SFB»).
 *
 * Чистит: внутреннее имя проекта (панель и тема писем о заявках), старый блок
 * «бренд» (v1), старые тексты первой версии лендинга, ключевые слова SEO.
 * На сам лендинг эти поля не выводятся, поэтому после правки внешний вид
 * страницы не меняется - SFB остаётся ровно один раз, как согласовано.
 * Идемпотентна.
 *
 * Запуск: node migrations/006-sfb-cleanup.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'takhtapul';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));

let changes = 0;
const log = (p, v) => { changes++; console.log('✓', p, '->', String(v).slice(0, 80)); };

// 1) внутреннее имя проекта (видно в панели и в теме писем о заявках)
if (/SFB/.test(cfg.name || '')) { cfg.name = 'Taxtapul 31 - Тахтапул'; log('name', cfg.name); }

// 2) старый блок «бренд» (использовался первой версией лендинга)
if (cfg.brand) {
  if (/SFB/.test(cfg.brand.mark || '')) { cfg.brand.mark = 'T31'; log('brand.mark', cfg.brand.mark); }
  if (cfg.brand.name && /SFB/.test(JSON.stringify(cfg.brand.name))) {
    cfg.brand.name = { ru: 'TAXTAPUL', uz: 'TAXTAPUL', en: 'TAXTAPUL' };
    log('brand.name', 'TAXTAPUL');
  }
}

// 3) все остальные строки: аккуратные замены по контексту, длинные фразы первыми
const RULES = [
  [/в бизнес-центре SFB/g, 'в здании TAXTAPUL'],
  [/бизнес-центр SFB/g, 'здание TAXTAPUL'],
  [/SFB biznes markazida/g, 'TAXTAPUL binosida'],
  [/SFB biznes markazi/g, 'TAXTAPUL binosi'],
  [/in the SFB Business Center/g, 'in the TAXTAPUL building'],
  [/SFB Business Center/g, 'TAXTAPUL'],
  [/\bSFB\b/g, 'TAXTAPUL']
];
(function walk(obj, prefix) {
  for (const k of Object.keys(obj)) {
    const p = prefix ? prefix + '.' + k : k;
    if (p.startsWith('about.sfbNote')) continue; // единственное согласованное упоминание
    const v = obj[k];
    if (typeof v === 'string') {
      if (!v.includes('SFB')) continue;
      let nv = v;
      for (const [re, to] of RULES) nv = nv.replace(re, to);
      if (nv !== v) { obj[k] = nv; log(p, nv); }
    } else if (v && typeof v === 'object') walk(v, p);
  }
})(cfg, '');

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: SFB вне согласованной строки не найден.');
}
