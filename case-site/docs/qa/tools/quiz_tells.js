/* Проверка банка вопросов мини-теста на подсказки: можно ли угадать ответ, не зная темы.

   Появился после жалобы: в вариантах ответов стояли приписки «— рабочий вариант»,
   «— в рамках процедуры», «— операционный вариант» и т.п. Они были ДОБАВЛЕНЫ ко всем
   неверным ответам и НИ РАЗУ к верному — то есть вариант без приписки всегда был
   правильным. Так тест проверял внимательность к оформлению, а не знания.

   Что ищем:
     1. Повторяющиеся хвосты после « — », привязанные к верности ответа.
     2. Длину: не является ли верный ответ систематически самым длинным.
     3. Позицию: не смещён ли верный ответ к какой-то букве.
     4. Мусор: висящие тире, пустые и повторяющиеся варианты.

   Запуск: node quiz_tells.js [путь к quiz-data.js] */
const fs = require('fs');

const FILE = process.argv[2] || '/home/user/case-site/case-site/os/quiz-data.js';
const LANGS = ['ru', 'uz', 'en'];
let failed = 0;
function check(name, cond, detail) {
  console.log((cond ? 'OK  ' : '!!  ') + name + (detail === undefined ? '' : ' — ' + detail));
  if (!cond) failed++;
}

const bank = Function(fs.readFileSync(FILE, 'utf8') + ';return QUIZ_BANK;')();
console.log('вопросов в банке: ' + bank.length + '\n');

for (const L of LANGS) {
  console.log('=== ' + L + ' ===');
  const tails = new Map();
  let total = 0, longest = 0, pos = [0, 0, 0], junk = 0, dup = 0, empty = 0;

  for (const q of bank) {
    const d = q[L];
    if (!d || !d.a) continue;
    total++;
    const a = d.a, c = d.c;
    if (new Set(a).size !== a.length) dup++;
    a.forEach(t => { if (!String(t).trim()) empty++; if (/—\s*$/.test(t)) junk++; });
    a.forEach((t, k) => {
      if (String(t).includes(' — ')) {
        const tail = String(t).split(' — ').pop().trim();
        const rec = tails.get(tail) || { correct: 0, wrong: 0 };
        if (k === c) rec.correct++; else rec.wrong++;
        tails.set(tail, rec);
      }
    });
    const lc = String(a[c]).length;
    const mx = Math.max(...a.map((t, k) => k === c ? 0 : String(t).length));
    if (lc > mx) longest++;
    if (c < 3) pos[c]++;
  }

  /* Хвост, встречающийся часто и только у неверных ответов, — это подсказка.
     Порог 5: единичные совпадения бывают и в осмысленном тексте. */
  const tell = [...tails.entries()]
    .filter(([, r]) => r.wrong >= 5 && r.correct === 0)
    .sort((x, y) => y[1].wrong - x[1].wrong);
  check('нет приписок, встречающихся только у неверных ответов', tell.length === 0,
    tell.length ? tell.slice(0, 5).map(([t, r]) => `«${t}» ×${r.wrong}`).join(', ') : 'ни одной');

  const pct = Math.round(100 * longest / total);
  check('верный ответ не является систематически самым длинным', pct <= 45,
    `самый длинный в ${pct}% вопросов (норма — около 33%)`);

  const maxPos = Math.round(100 * Math.max(...pos) / total);
  check('верный ответ равномерно распределён по позициям', maxPos <= 45,
    `A/B/C = ${pos.join('/')}, максимум ${maxPos}%`);

  check('нет висящих тире, пустых и повторяющихся вариантов',
    junk === 0 && empty === 0 && dup === 0,
    `тире ${junk}, пустых ${empty}, повторов ${dup}`);
  console.log('');
}

console.log(failed ? 'ПРОВАЛЕНО проверок: ' + failed : 'Подсказок не найдено');
process.exit(failed ? 1 : 0);
