/**
 * Botanica: короткие номера уровней (lvlShort).
 *
 * Без этого поля кнопки выбора этажа на лендинге выходили пустыми, а
 * интерактивный разрез здания вообще не рисовался: он собирается только по
 * тем уровням, у которых есть короткая подпись (минус означает подземный).
 *
 * Миграция аддитивная и идемпотентная: заполняет lvlShort там, где его нет,
 * и ничего не трогает у остальных проектов.
 *
 * Запуск: node migrations/017-botanica-lvlshort.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'projects', 'botanica', 'project.json');
if (!fs.existsSync(FILE)) {
  console.log('Проект botanica не найден, пропускаю');
  process.exit(0);
}

// подвал уходит под линию земли, поэтому у него минус
const SHORT = { b: '-1', f1: '1', f2: '2', f3: '3', f4: '4', f5: '5', f6: '6', f7: '7' };

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let n = 0;
for (const u of cfg.units || []) {
  if (u.whole) continue;
  if (String(u.lvlShort || '').trim()) continue;
  const s = SHORT[u.id];
  if (!s) continue;
  u.lvlShort = s;
  n++;
}

if (n) fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log(n ? `Проставлено уровней: ${n}` : 'Уже проставлено, изменений нет');
