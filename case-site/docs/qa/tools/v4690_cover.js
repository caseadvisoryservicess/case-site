/* Титульная картинка предложения: чередование и запасные варианты.

   Проверяется не «функция что-то вернула», а три свойства, каждое из которых при нарушении
   стоит дорого:
     1. один и тот же номер предложения всегда даёт одну и ту же картинку - иначе «тот самый
        файл, который мы отправляли клиенту» перестаёт существовать;
     2. соседние номера дают разные картинки - ради этого чередование и заводилось;
     3. в клиентской версии никогда не появляется пустая рамка - это прямой запрет ТЗ.

   Запуск: node v4690_cover.js [папка os] */
'use strict';
const path = require('path'), fs = require('fs');
const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));

global.window = {};
require(path.join(OS, 'v4690-offer-cover.js'));
const C = global.window.CASE_OFFER_COVER;

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const eq = (n, got, want) => ck(n, got === want, got === want ? String(got) : `получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`);

ck('модуль загрузился и объявил версию', !!C && /^\d+\.\d+\.\d+$/.test(C.version || ''), C && C.version);
ck('стандартных картинок заведено две', C.STOCK.length === 2, C.STOCK.map(x => x.file).join(', '));

/* ---- 1. фото проекта важнее стандартной картинки ---- */
const withPhoto = C.cover({ photo: 'files/uchtepa.jpg', offerNumber: 'CASE-OFF-2026-0042' });
eq('при наличии фото проекта берётся оно', withPhoto.kind, 'photo');
eq('и именно тот файл', withPhoto.src, 'files/uchtepa.jpg');
ck('запасной вариант не помечается', withPhoto.fallbackUsed === false);
eq('пустая строка вместо фото не считается фото', C.cover({ photo: '', offerNumber: 'X' }).kind, 'stock');
eq('null вместо фото тоже', C.cover({ photo: null, offerNumber: 'X' }).kind, 'stock');

/* ---- 2. повторяемость: главное свойство ---- */
const n1 = 'CASE-OFF-2026-0042';
const first = C.cover({ offerNumber: n1 });
let stable = true;
for (let i = 0; i < 50; i++) if (C.cover({ offerNumber: n1 }).src !== first.src) stable = false;
ck('один и тот же номер даёт одну и ту же картинку при каждой печати', stable, first.src);

/* ---- 3. чередование: соседние номера различаются ---- */
const seq = [];
for (let i = 1; i <= 12; i++) {
  const num = 'CASE-OFF-2026-' + String(i).padStart(4, '0');
  seq.push(C.cover({ offerNumber: num }).src);
}
const distinct = new Set(seq);
ck('по ряду номеров используются обе картинки', distinct.size === C.STOCK.length,
   [...distinct].join(' | '));
let alternations = 0;
for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) alternations++;
ck('картинки реально чередуются, а не залипают на одной',
   alternations >= 4, `смен подряд идущих: ${alternations} из ${seq.length - 1}`);

/* перестановка цифр не должна давать ту же картинку: слабый разброс выдал бы себя тут */
ck('номера-перестановки получают разный разброс',
   C.hash('CASE-OFF-2026-0042') !== C.hash('CASE-OFF-2026-0024'));

/* ---- 4. запасной блок, когда картинок нет ---- */
const noStock = C.cover({ offerNumber: 'X', stock: [], credentials: [{ value: '95', label: 'проектов' }, { value: '7', label: 'стран' }] });
eq('без стандартных картинок собирается блок из цифр', noStock.kind, 'credentials');
ck('и цифры в нём те, что передали', noStock.items.length === 2);
const html1 = C.html(noStock);
ck('блок из цифр отрисовывается', /95/.test(html1) && /проектов/.test(html1));

const nothing = C.cover({ offerNumber: 'X', stock: [], credentials: [] });
eq('без картинок и без цифр вариант всё равно определён', nothing.kind, 'credentials');
eq('но разметка пустая - пустой рамки в документе не будет', C.html(nothing), '');

/* цифры без значения не печатаются: «пусто лучше выдуманного» */
const partial = C.cover({ offerNumber: 'X', stock: [], credentials: [{ value: '', label: 'лет на рынке' }, { value: '95', label: 'проектов' }] });
const htmlPartial = C.html(partial);
ck('незаполненная цифра не попадает в документ',
   !/лет на рынке/.test(htmlPartial) && /95/.test(htmlPartial));

/* ---- 5. разметка ---- */
const h = C.html(C.cover({ offerNumber: 'CASE-OFF-2026-0001' }), { showCaption: true });
ck('картинка выводится тегом img со встроенными стилями', /^<figure/.test(h) && /<img /.test(h));
ck('стили встроенные: внешняя таблица стилей в PDF не доезжает', /style="/.test(h));
ck('картинка кадрируется, а не растягивается', /object-fit:cover/.test(h));
ck('подпись выводится по запросу', /figcaption/.test(h));
ck('без запроса подписи её нет', !/figcaption/.test(C.html(C.cover({ offerNumber: 'X' }))));
ck('пустой ввод не роняет разметку', C.html(null) === '');

/* ---- 6. файлы картинок ---- */
const missing = C.STOCK.filter(s => !fs.existsSync(path.join(OS, s.file)));
if (missing.length) {
  console.log('\n!!  ФАЙЛЫ КАРТИНОК ЕЩЁ НЕ ЗАЛИТЫ: ' + missing.map(m => m.file).join(', '));
  console.log('    Механизм работает, но до появления файлов титул будет собирать блок из цифр.');
  console.log('    Положите изображения по этим путям - код менять не нужно.');
} else {
  ck('файлы стандартных картинок на месте', true, C.STOCK.map(s => s.file).join(', '));
}

console.log('\nЧередование по первым восьми номерам:');
for (let i = 1; i <= 8; i++) {
  const num = 'CASE-OFF-2026-' + String(i).padStart(4, '0');
  const c = C.cover({ offerNumber: num });
  console.log('  ' + num + '  ->  ' + (c.src || 'блок из цифр'));
}

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nТитульная картинка выбирается повторяемо и без пустых мест');
process.exit(bad ? 1 : 0);
