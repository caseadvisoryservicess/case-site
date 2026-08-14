/* Расчёт стоимости предложения: сверка с эталонным калькулятором и с критериями приёмки.

   Цена уходит в документ, который подписывают. Поэтому проверяется не «похоже на правду»,
   а точные значения из раздела 12 технического задания, плюс свойства, которые обязаны
   выполняться тождественно при любых входных данных: сумма частей графика равна целому,
   скидка не уводит сумму в минус, ручное вмешательство всегда попадает в отклонения.

   Запуск: node v4670_pricing.js [папка os] */
'use strict';
const path = require('path');
const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));

global.window = {};
require(path.join(OS, 'v4670-offer-pricing.js'));
const P = global.window.CASE_OFFER_PRICING;

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const eq = (n, got, want) => ck(n, got === want, got === want ? String(got) : `получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`);

ck('модуль загрузился и объявил версию', !!P && /^\d+\.\d+\.\d+$/.test(P.version || ''), P && P.version);

/* ---- 1. критерии приёмки из раздела 12 ТЗ ---- */

/* 12.1: Commercial Concept, 18 400 м² -> 46 000 с графиком 40/30/30 */
const a = P.calc({ area: 18400, tariff: 't3' });
eq('ставка Commercial Concept берётся из прайса', a.rate, 2.5);
eq('18 400 м² по 2,5 дают 46 000', a.total, 46000);
eq('база и к оплате совпадают, пока нет скидки', a.billable, 46000);
eq('первый платёж 40%', a.schedule[0].amount, 18400);
eq('промежуточный 30%', a.schedule[1].amount, 13800);
eq('финальный 30%', a.schedule[2].amount, 13800);
ck('минимальная сумма не применялась', a.minApplied === false);
ck('отклонений нет: всё по прайсу', a.deviations.length === 0, JSON.stringify(a.deviations));

/* 12.1: 1 200 м² -> применяется минимум 5 000, и об этом сказано */
const b = P.calc({ area: 1200, tariff: 't3' });
eq('малая площадь подтягивается к минимуму', b.total, 5000);
ck('применение минимума объяснено словами', /5 000/.test(b.minNote.replace(/\s/g, ' ')), b.minNote);
ck('в объяснении виден исходный расчёт', /3 000/.test(b.minNote.replace(/\s/g, ' ')), b.minNote);

/* 12.1b: надзор 4 месяца по 2 500 -> отдельные 10 000; 12 часов -> 960 */
const c = P.calc({ area: 18400, tariff: 't3', months: 4, monthly: 2500, hours: 12 });
eq('надзор считается отдельной строкой', c.supervision, 10000);
eq('сверхнормативные часы по 80', c.extra, 960);
eq('итог складывается из трёх частей', c.total, 46000 + 10000 + 960);
eq('надзор НЕ входит в график 40/30/30', c.schedule[0].amount, 18400);
ck('сумма графика равна базовой услуге, а не итогу',
   c.schedule.reduce((s, x) => s + x.amount, 0) === c.billableUsd, `${c.schedule.reduce((s, x) => s + x.amount, 0)} против ${c.billableUsd}`);

/* надзор меньше трёх месяцев поднимается до минимума и это видно */
const d = P.calc({ area: 18400, tariff: 't3', months: 1, monthly: 2500 });
eq('один месяц надзора превращается в три', d.months, 3);
eq('и оплачивается как три', d.supervision, 7500);
ck('подъём срока помечен отклонением', d.deviations.some(x => x.key === 'months_raised'));

/* ---- 2. гибкость: ставка, скидка, итог ---- */

const e = P.calc({ area: 10000, tariff: 't3', rate: 2.0 });
eq('ручная ставка применяется', e.rate, 2.0);
eq('и меняет сумму', e.total, 20000);
ck('изменение ставки помечено отклонением', e.deviations.some(x => x.key === 'rate'));
ck('в отклонении видна и прайсовая, и назначенная ставка',
   /2,5/.test(e.deviations.find(x => x.key === 'rate').detail) && /2/.test(e.deviations.find(x => x.key === 'rate').detail),
   e.deviations.find(x => x.key === 'rate').detail);
ck('такое предложение требует объяснения', e.needsReason === true);

const f = P.calc({ area: 18400, tariff: 't3', discountPercent: 10 });
eq('скидка 10% уменьшает сумму', f.billable, 41400);
eq('скидка посчитана', f.discountValue, 4600);
eq('база при этом сохраняется для документа', f.base, 46000);
ck('скидка помечена отклонением', f.deviations.some(x => x.key === 'discount'));
ck('график считается от суммы со скидкой, а не от базы',
   f.schedule.reduce((s, x) => s + x.amount, 0) === 41400,
   String(f.schedule.reduce((s, x) => s + x.amount, 0)));

const g = P.calc({ area: 18400, tariff: 't3', discountAmount: 6000 });
eq('абсолютная скидка применяется', g.billable, 40000);
eq('вид скидки распознан', g.discountKind, 'amount');

const h = P.calc({ area: 18400, tariff: 't3', discountPercent: 10, discountAmount: 3000 });
eq('при двух заданных скидках выигрывает абсолютная', h.discountValue, 3000);

const i = P.calc({ area: 1000, tariff: 't3', discountPercent: 50 });
ck('скидка может опустить итог ниже минимума - это решение, а не ошибка', i.billable === 2500, String(i.billable));
ck('но такой случай помечен отдельным отклонением', i.deviations.some(x => x.key === 'below_min'));

const j = P.calc({ area: 18400, tariff: 't3', discountPercent: 300 });
ck('скидка больше базы не уводит сумму в минус', j.billable === 0 && j.discountValue === 46000,
   `к оплате ${j.billable}, скидка ${j.discountValue}`);

const k = P.calc({ area: 18400, tariff: 't3', totalOverride: 40000 });
eq('итог можно назначить вручную', k.total, 40000);
ck('расчётный итог при этом сохранён для сравнения', k.computedTotal === 46000);
ck('ручной итог помечен отклонением', k.deviations.some(x => x.key === 'total'));

/* ставка ноль - допустимое ручное значение, а не «поле не заполнено» */
const l = P.calc({ area: 18400, tariff: 't3', rate: 0 });
eq('нулевая ставка принимается как осознанное решение', l.raw, 0);
eq('но минимальная сумма всё равно работает', l.billable, 5000);

/* ---- 2bis. коэффициент сложности ---- */

const cx1 = P.calc({ area: 18400, tariff: 't3', complexityFactors: ['stilobat_multilevel', 'mixed_use'] });
eq('надбавки складываются, а не перемножаются', cx1.complexity, 1.35);
eq('сложный проект дороже', cx1.billable, 62100);
ck('коэффициент виден в формуле документа', /× 1,35 =/.test(cx1.formula), cx1.formula);
ck('сложность помечена отклонением', cx1.deviations.some(x => x.key === 'complexity'));
ck('в отклонении перечислены сами надбавки',
   /Многоуровневый стилобат \+20%/.test(cx1.deviations.find(x => x.key === 'complexity').detail),
   cx1.deviations.find(x => x.key === 'complexity').detail);

const cx2 = P.calc({ area: 18400, tariff: 't3', complexityFactors: ['simple_single', 'repeat_client'] });
eq('понижающие факторы удешевляют', cx2.complexity, 0.75);
eq('и уменьшают сумму', cx2.billable, 34500);
ck('понижение названо своим именем',
   /понижающий/i.test(cx2.deviations.find(x => x.key === 'complexity').ru),
   cx2.deviations.find(x => x.key === 'complexity').ru);

const cx3 = P.calc({ area: 18400, tariff: 't3', complexity: 1.4, complexityFactors: ['mixed_use'] });
eq('прямое значение выигрывает у набора надбавок', cx3.complexity, 1.4);
ck('и помечено как назначенное вручную', cx3.complexityIsManual === true);

const cx4 = P.calc({ area: 18400, tariff: 't3', complexity: 0.1 });
eq('слишком низкий коэффициент подтягивается к нижней границе', cx4.complexity, P.COMPLEXITY_FLOOR);
ck('и это отдельное отклонение', cx4.deviations.some(x => x.key === 'complexity_floor'));

const cx5 = P.calc({ area: 1000, tariff: 't3', complexityFactors: ['simple_single'] });
eq('минимальная сумма применяется ПОСЛЕ коэффициента', cx5.billable, 5000);
ck('в объяснении минимума указана сумма уже с коэффициентом',
   /2 125/.test(cx5.minNote.replace(/\s/g, ' ')), cx5.minNote);

const cx6 = P.calc({ area: 18400, tariff: 't3', complexityFactors: ['mixed_use'], discountPercent: 10 });
eq('скидка считается от суммы с коэффициентом, а не до него', cx6.discountValue, 5290);
eq('и итог сходится', cx6.billable, 52900 - 5290);

eq('без сложности коэффициент равен единице и в формуле его нет',
   P.calc({ area: 18400, tariff: 't3' }).formula.indexOf('×  ') , -1);
ck('каталог сложности отдаётся наружу и редактируем',
   Array.isArray(P.COMPLEXITY) && P.COMPLEXITY.length >= 8, P.COMPLEXITY.length + ' факторов');
const own = P.calc({ area: 10000, tariff: 't3', complexityCatalog: [{ key: 'my', ru: 'Свой фактор', delta: 0.5 }], complexityFactors: ['my'] });
eq('можно передать собственный каталог факторов', own.complexity, 1.5);

/* ---- 3. прайс редактируется, а не зашит ---- */

const custom = [{ code: 't3', key: 'commercial_concept', name: 'Commercial Concept', rate: 3.1 }];
const m = P.calc({ area: 10000, tariff: 't3', tariffs: custom });
eq('ставка берётся из переданной таблицы тарифов', m.rate, 3.1);
eq('и считается по ней', m.total, 31000);
ck('изменение прайса не считается отклонением: это новый стандарт',
   !m.deviations.some(x => x.key === 'rate'));

const n = P.calc({ area: 10000, tariff: 't2' });
ck('неподтверждённая ставка тарифа помечена', n.deviations.some(x => x.key === 'unconfirmed_rate'));
eq('но считается', n.rate, 2.2);

/* ---- 4. свойства, обязанные выполняться всегда ---- */

let sumFails = [], negFails = [], splitFails = [];
for (let area = 0; area <= 40000; area += 137) {
  for (const disc of [0, 7, 13, 33, 50]) {
    const r = P.calc({ area: area, tariff: 't3', discountPercent: disc });
    const sched = r.schedule.reduce((s, x) => s + x.amount, 0);
    const split = r.split.reduce((s, x) => s + x.amount, 0);
    /* сверяем с округлённой суммой: в документе деньги целые, точное значение хранится */
    if (sched !== r.billableUsd) sumFails.push(`${area}/${disc}%: ${sched} против ${r.billableUsd}`);
    if (split !== r.billableUsd) splitFails.push(`${area}/${disc}%: ${split} против ${r.billableUsd}`);
    if (r.billable < 0 || r.total < 0) negFails.push(`${area}/${disc}%`);
  }
}
ck('сумма графика платежей всегда равна сумме к оплате в целых долларах', sumFails.length === 0,
   sumFails.slice(0, 4).join(' | ') || `проверено ${Math.ceil(40000 / 137) * 5} сочетаний`);
ck('сумма ценностной разбивки всегда равна сумме к оплате в целых долларах', splitFails.length === 0,
   splitFails.slice(0, 4).join(' | ') || 'сходится везде');
ck('сумма никогда не уходит в минус', negFails.length === 0, negFails.slice(0, 4).join(' | ') || 'ни разу');

ck('доли разбивки идут в закреплённом ТЗ порядке 50-30-20',
   P.SPLIT_PLAN.map(x => x.percent).join('-') === '50-30-20');
ck('график платежей 40-30-30', P.SCHEDULE_PLAN.map(x => x.percent).join('-') === '40-30-30');

/* ---- 5. формат чисел ---- */
eq('денежный формат с разделителем тысяч', P.usd(46000).replace(/\s/g, ' '), '$46 000');
eq('шестизначная сумма', P.usd(1234567).replace(/\s/g, ' '), '$1 234 567');
eq('малая сумма без разделителя', P.usd(960), '$960');
ck('разделитель неразрывный, чтобы число не разорвалось при печати',
   P.usd(46000).indexOf(' ') > 0);
eq('ставка пишется через запятую', P.rateText(2.5), '2,5');
eq('площадь с разделителем тысяч', P.areaText(18400).replace(/\s/g, ' '), '18 400');
eq('формула видна целиком', P.calc({ area: 18400, tariff: 't3' }).formula.replace(/\s/g, ' '),
   '18 400 м² × 2,5 USD/м² = $46 000');

/* ---- 6. строки документа ---- */
/* главное свойство таблицы в документе: столбец складывается в итог */
let lineFails = [];
[[18400, 0, 0, 0], [18400, 10, 4, 12], [1200, 0, 0, 0], [9000, 33, 3, 5], [2055, 7, 0, 0]].forEach(([ar, di, mo, ho]) => {
  const r = P.calc({ area: ar, tariff: 't3', discountPercent: di, months: mo, monthly: 2500, hours: ho });
  const sum = P.lines(r).reduce((s, x) => s + x.amount, 0);
  if (Math.round(sum) !== Math.round(r.total)) lineFails.push(`${ar}м²/${di}%: строки ${Math.round(sum)}, итог ${Math.round(r.total)}`);
});
ck('строки документа складываются в итог', lineFails.length === 0, lineFails.join(' | ') || 'сходится на всех сочетаниях');

const rows = P.lines(c);
eq('в документе четыре строки: услуга, надзор, часы', rows.length, 3);
ck('первая строка - основная услуга с формулой', rows[0].key === 'base' && /18 400/.test(rows[0].note.replace(/\s/g, ' ')));
const rowsD = P.lines(f);
ck('скидка выводится отдельной строкой со знаком минус',
   rowsD.some(x => x.key === 'discount' && x.amount === -4600));

console.log('\nПример расчёта со скидкой и надзором:');
const demo = P.calc({ area: 18400, tariff: 't3', rate: 2.3, discountPercent: 5, months: 4, monthly: 2500, hours: 6 });
P.lines(demo).forEach(r => console.log('  ' + r.ru.padEnd(24) + P.usd(r.amount).padStart(10) + (r.note ? '   ' + r.note : '')));
console.log('  ' + 'ИТОГО'.padEnd(24) + P.usd(demo.total).padStart(10));
console.log('  отклонения: ' + demo.deviations.map(d => d.ru).join('; '));

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nРасчёт стоимости соответствует ТЗ и остаётся управляемым вручную');
process.exit(bad ? 1 : 0);
