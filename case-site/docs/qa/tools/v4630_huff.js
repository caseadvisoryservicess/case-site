/* Модель Хаффа - сверка по свойствам, которые обязаны выполняться тождественно.

   У Хаффа математика строгая, и это редкий случай, когда расчёт можно проверить не
   «похоже на правду», а точно: доли обязаны давать единицу, при равных условиях делиться
   поровну, при удвоении площади с a=1 давать ровно двойное отношение. Любая ошибка в
   формуле ломает хотя бы одно из этих свойств.

   Запуск: node v4630_huff.js [папка os или путь к v4630-huff.js] */
'use strict';
const path = require('path'), fs = require('fs');
let m = process.argv[2] || path.join(__dirname, '..', '..', '..', 'os');
if (fs.existsSync(m) && fs.statSync(m).isDirectory()) m = path.join(m, 'v4630-huff.js');
global.window = {};
require(path.resolve(m));
const H = global.window.CASE_HUFF;

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const close = (x, y, eps) => Math.abs(x - y) < (eps === undefined ? 1e-9 : eps);

/* --- свойства долей --- */
const objs = [
  { lat: 41.30, lng: 69.25, attract: 10000, name: 'А' },
  { lat: 41.31, lng: 69.26, attract: 20000, name: 'Б' },
  { lat: 41.33, lng: 69.29, attract: 5000, name: 'В' }
];
const s = H.shares(41.305, 69.255, objs, 1, 2);
ck('доли всегда дают в сумме единицу', close(s.reduce((a, b) => a + b, 0), 1),
   s.map(x => x.toFixed(4)).join(' + '));
ck('каждая доля в пределах от нуля до единицы', s.every(x => x >= 0 && x <= 1));

/* равные площади на равном удалении делятся поровну */
const sym = H.shares(41.30, 69.25, [
  { lat: 41.31, lng: 69.25, attract: 1000 },
  { lat: 41.29, lng: 69.25, attract: 1000 }
], 1, 2);
ck('равные объекты на равном удалении делят пополам', close(sym[0], 0.5, 1e-6),
   sym.map(x => x.toFixed(6)).join(' / '));

/* при a=1 и равном расстоянии доли пропорциональны площади */
const prop = H.shares(41.30, 69.25, [
  { lat: 41.31, lng: 69.25, attract: 2000 },
  { lat: 41.29, lng: 69.25, attract: 1000 }
], 1, 2);
ck('вдвое большая площадь при a=1 даёт ровно вдвое большую долю', close(prop[0] / prop[1], 2, 1e-6),
   (prop[0] / prop[1]).toFixed(6));

/* a=0 полностью убирает влияние площади: остаётся только расстояние */
const noA = H.shares(41.30, 69.25, [
  { lat: 41.31, lng: 69.25, attract: 50000 },
  { lat: 41.29, lng: 69.25, attract: 100 }
], 0, 2);
ck('при a=0 площадь перестаёт влиять, решает только расстояние', close(noA[0], 0.5, 1e-6),
   noA.map(x => x.toFixed(6)).join(' / '));

/* чем больше b, тем сильнее выигрывает ближний */
const near = { lat: 41.301, lng: 69.25, attract: 1000 }, far = { lat: 41.35, lng: 69.25, attract: 1000 };
const b1 = H.shares(41.30, 69.25, [near, far], 1, 1)[0];
const b3 = H.shares(41.30, 69.25, [near, far], 1, 3)[0];
ck('рост b усиливает ближний объект', b3 > b1, `b=1: ${b1.toFixed(4)}, b=3: ${b3.toFixed(4)}`);

/* объект ровно в точке жилья не должен давать деление на ноль */
const zero = H.shares(41.30, 69.25, [
  { lat: 41.30, lng: 69.25, attract: 1000 },
  { lat: 41.32, lng: 69.25, attract: 1000 }
], 1, 2);
ck('объект в самой точке не ломает расчёт', zero.every(Number.isFinite) && close(zero[0] + zero[1], 1),
   zero.map(x => x.toFixed(4)).join(' / '));

/* единственный объект забирает всё */
const solo = H.shares(41.30, 69.25, [{ lat: 41.31, lng: 69.25, attract: 500 }], 1, 2);
ck('единственный объект получает всех', close(solo[0], 1), solo[0]);

/* --- охват --- */
const pop = [];
for (let i = 0; i < 20; i++) for (let j = 0; j < 20; j++) pop.push([41.28 + i * 0.002, 69.23 + j * 0.002, 100]);
const target = { lat: 41.30, lng: 69.25, attract: 10000, name: 'наш' };

const alone = H.catchment(target, [], pop, { a: 1, b: 2, maxKm: 5 });
ck('без конкурентов охват равен всему населению зоны', alone.captured === alone.popInRadius,
   `${alone.captured} из ${alone.popInRadius}`);
ck('доля рынка без конкурентов - сто процентов', close(alone.share, 100, 1e-6), alone.share.toFixed(3) + ' %');

const twin = H.catchment(target, [{ lat: 41.30, lng: 69.25, attract: 10000, name: 'близнец' }], pop, { a: 1, b: 2, maxKm: 5 });
ck('одинаковый конкурент в той же точке делит рынок пополам', close(twin.share, 50, 0.001),
   twin.share.toFixed(3) + ' %');

const big = H.catchment(target, [{ lat: 41.30, lng: 69.25, attract: 30000, name: 'втрое больше' }], pop, { a: 1, b: 2, maxKm: 5 });
ck('втрое больший сосед оставляет нам четверть', close(big.share, 25, 0.001), big.share.toFixed(3) + ' %');

/* радиус ограничивает выборку */
const small = H.catchment(target, [], pop, { a: 1, b: 2, maxKm: 1 });
ck('радиус ограничивает зону расчёта', small.popInRadius < alone.popInRadius && small.popInRadius > 0,
   `${small.popInRadius} против ${alone.popInRadius}`);

/* --- у кого забираем и каннибализация --- */
const comp = [
  { lat: 41.302, lng: 69.25, attract: 10000, name: 'Чужой рядом' },
  { lat: 41.34, lng: 69.25, attract: 10000, name: 'Чужой далеко' },
  { lat: 41.299, lng: 69.25, attract: 10000, name: 'Наш второй', ours: true }
];
const r = H.catchment(target, comp, pop, { a: 1, b: 2, maxKm: 5 });
ck('отнятое посчитано по каждому конкуренту', r.lost.length === 3 && r.lost.every(x => x.from >= 0),
   r.lost.map(x => x.name + ':' + x.from).join(', '));
ck('у ближнего забираем больше, чем у дальнего',
   (r.lost.find(x => x.name === 'Чужой рядом') || {}).from > (r.lost.find(x => x.name === 'Чужой далеко') || {}).from,
   r.lost.map(x => x.name + ':' + x.from).join(' | '));
ck('каннибализация посчитана только по своим',
   r.cannibalized === (r.lost.find(x => x.name === 'Наш второй') || {}).from,
   `${r.cannibalized} из ${r.captured}`);
ck('сумма отнятого не превышает нашего охвата',
   r.lost.reduce((s, x) => s + x.from, 0) <= r.captured + 2,
   `${r.lost.reduce((s, x) => s + x.from, 0)} против ${r.captured}`);

/* --- привлекательность --- */
ck('привлекательность берётся из GLA', H.attractOf({ gla: 5000, gba: 9000 }) === 5000);
ck('без GLA берётся GBA', H.attractOf({ gba: 9000 }) === 9000);
ck('без площадей привлекательности нет, а не единица', H.attractOf({ name: 'пусто' }) === null);
const built = H.objectsFrom([
  { name: 'с площадью', lat: 41.3, lng: 69.2, gla: 1000 },
  { name: 'без площади', lat: 41.3, lng: 69.2 },
  { name: 'без координат', gla: 500 }
]);
ck('в расчёт идут только объекты с координатами и площадью', built.length === 1 && built[0].name === 'с площадью',
   built.map(x => x.name).join(', '));

/* --- картинка --- */
const svg = H.lostSvg(r);
ck('диаграмма «у кого забираем» - статичный SVG без внешних ссылок',
   /^<svg /.test(svg) && !/<script|https?:\/\//.test(svg), svg.length + ' символов');
ck('свои объекты помечены в диаграмме', /свой/.test(svg));
ck('пустой список конкурентов объяснён словами, а не пустой картинкой',
   /Конкурентов с площадью/.test(H.lostSvg({ lost: [] })));

/* --- устойчивость --- */
ck('пустое население не роняет расчёт', H.catchment(target, comp, [], {}).captured === 0);
ck('нулевая площадь у всех не даёт NaN',
   Number.isFinite(H.catchment({ lat: 41.3, lng: 69.25, attract: 0 },
     [{ lat: 41.31, lng: 69.25, attract: 0 }], pop, {}).captured));

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nМодель Хаффа удовлетворяет всем свойствам');
process.exit(bad ? 1 : 0);
