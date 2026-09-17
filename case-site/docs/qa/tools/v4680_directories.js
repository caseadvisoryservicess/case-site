/* Справочники проекта: вид, тип работ, сегмент.

   Главная проверка здесь не «модуль загрузился», а другая: КАЖДОЕ написание вида проекта,
   встречающееся в настоящем портфеле, обязано приводиться к канону. Если хоть одно не
   приводится, в фильтре появится пункт-сирота, а часть проектов выпадет из выборки - и
   заметит это тот, кто будет искать свой проект и не найдёт.

   Запуск: node v4680_directories.js [папка os] */
'use strict';
const path = require('path'), fs = require('fs');
const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));

global.window = {};
require(path.join(OS, 'v4680-project-directories.js'));
require(path.join(OS, 'v4670-offer-pricing.js'));
const D = global.window.CASE_PROJECT_DIR;
const P = global.window.CASE_OFFER_PRICING;

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const eq = (n, got, want) => ck(n, got === want, got === want ? String(got) : `получили ${JSON.stringify(got)}, ждали ${JSON.stringify(want)}`);

ck('модуль загрузился и объявил версию', !!D && /^\d+\.\d+\.\d+$/.test(D.version || ''), D && D.version);

/* ---- 1. два измерения не путаются ---- */
ck('вид проекта и тип работ - разные справочники',
   D.KINDS !== D.WORK_TYPES && D.KINDS.length > 0 && D.WORK_TYPES.length > 0,
   `${D.KINDS.length} видов, ${D.WORK_TYPES.length} типов работ`);
ck('ключи видов уникальны', new Set(D.KINDS.map(x => x.key)).size === D.KINDS.length);
ck('ключи типов работ уникальны', new Set(D.WORK_TYPES.map(x => x.key)).size === D.WORK_TYPES.length);
ck('у каждого вида есть русское и английское название',
   D.KINDS.every(x => x.ru && x.en), D.KINDS.filter(x => !x.ru || !x.en).map(x => x.key).join(', ') || 'все заполнены');
ck('у каждого вида есть узбекское название',
   D.KINDS.every(x => x.uz), D.KINDS.filter(x => !x.uz).map(x => x.key).join(', ') || 'все заполнены');
ck('у каждого вида проставлен сегмент из списка сегментов',
   D.KINDS.every(x => D.SEGMENTS.some(s => s.key === x.segment)),
   D.KINDS.filter(x => !D.SEGMENTS.some(s => s.key === x.segment)).map(x => x.key).join(', ') || 'все на месте');

/* ---- 2. примеры владельца работают дословно ---- */
eq('«ТРЦ и новое строительство» собирается в подпись',
   D.label('regional_mall', 'new_build'), 'Региональный ТРЦ, новое строительство');
eq('«Lifestyle-центр и реконструкция» собирается в подпись',
   D.label('lifestyle_centre', 'reconstruction'), 'Lifestyle-центр, реконструкция');
eq('подпись на узбекском', D.label('lifestyle_centre', 'reconstruction', 'uz'), 'Lifestyle markaz, rekonstruksiya');
eq('без типа работ остаётся только вид', D.label('business_centre', null), 'Бизнес-центр');
eq('без вида остаётся только тип работ', D.label(null, 'new_build'), 'Новое строительство');
eq('пустые значения дают пустую строку', D.label(null, null), '');

/* ---- 3. приведение прежних написаний: проверка на настоящем портфеле ---- */
const portfolio = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'case_portfolio_projects_v4.9.3.json'), 'utf8'));
const rawKinds = [...new Set(portfolio.map(p => p.category).filter(Boolean))];
const orphans = rawKinds.filter(v => !D.normalizeKind(v));
ck(`все ${rawKinds.length} написаний вида из портфеля приводятся к канону`, orphans.length === 0,
   orphans.join(' | ') || 'сирот нет');

/* именно ради этого справочник и заводился: разные написания сливаются в одно */
eq('«Mixed-Use» и «Mixed-use» - один вид', D.normalizeKind('Mixed-Use'), D.normalizeKind('Mixed-use'));
eq('«Street Retail» и «Street retail» - один вид', D.normalizeKind('Street Retail'), D.normalizeKind('Street retail'));
const canon = new Set(rawKinds.map(v => D.normalizeKind(v)));
ck('после приведения видов стало меньше, чем написаний в данных',
   canon.size < rawKinds.length, `${rawKinds.length} написаний свелись к ${canon.size} видам`);

ck('приведение не зависит от регистра и лишних пробелов',
   D.normalizeKind('  lifestyle   centre ') === 'lifestyle_centre', D.normalizeKind('  lifestyle   centre '));
eq('русское название тоже распознаётся', D.normalizeKind('Региональный ТРЦ'), 'regional_mall');
eq('неизвестное написание честно даёт null', D.normalizeKind('Космодром'), null);
eq('пустое значение даёт null', D.normalizeKind(''), null);

eq('тип работ распознаётся по русскому названию', D.normalizeWorkType('Реконструкция'), 'reconstruction');
eq('и по ключу', D.normalizeWorkType('new_build'), 'new_build');

/* ---- 4. сегмент выводится из вида, а не заполняется руками ---- */
eq('ТРЦ относится к торговой недвижимости', D.segmentOf('regional_mall'), 'mall');
eq('бизнес-центр к офисной', D.segmentOf('business_centre'), 'office');
eq('курорт к гостиничной', D.segmentOf('resort'), 'hotel');
eq('логистика к складской', D.segmentOf('logistics'), 'warehouse');
eq('неизвестный вид попадает в прочее', D.segmentOf('нет такого'), 'other');

/* ---- 5. связь с коэффициентом сложности ---- */
const hintsRec = D.complexityHints('reconstruction');
ck('реконструкция подсказывает фактор сложности', hintsRec.length === 1, hintsRec.join(', '));
ck('подсказанный фактор существует в каталоге расчёта цены',
   hintsRec.every(h => P.COMPLEXITY.some(f => f.key === h)), hintsRec.join(', '));
ck('новое строительство не добавляет надбавку', D.complexityHints('new_build').length === 0);
const hintsExt = D.complexityHints('extension');
ck('расширение подсказывает поэтапность',
   hintsExt.length === 1 && P.COMPLEXITY.some(f => f.key === hintsExt[0]), hintsExt.join(', '));

/* подсказка действительно меняет цену, если её принять */
const plain = P.calc({ area: 18400, tariff: 't3' });
const withRec = P.calc({ area: 18400, tariff: 't3', complexityFactors: D.complexityHints('reconstruction') });
ck('принятая подсказка по реконструкции удорожает проект',
   withRec.billable > plain.billable, `${plain.billable} -> ${withRec.billable}`);
ck('но сама по себе подсказка ничего не проставляет: цена остаётся решением человека',
   plain.complexity === 1);

/* ---- 6. списки для формы ---- */
const optK = D.options('kinds');
ck('варианты вида готовы для выпадающего списка',
   optK.length === D.KINDS.length && optK.every(x => x.value && x.label), optK.length + ' вариантов');
ck('варианты типа работ тоже', D.options('workTypes').length === D.WORK_TYPES.length);
ck('варианты отдаются на нужном языке',
   D.options('kinds', 'en').find(x => x.value === 'regional_mall').label === 'Regional Mall');

/* ---- 7. справочники редактируются, а не зашиты ---- */
const own = [{ key: 'my_kind', ru: 'Свой вид', en: 'My kind', uz: 'Mening turim', segment: 'other', aliases: ['Custom'] }];
eq('можно передать собственный справочник видов', D.normalizeKind('Custom', own), 'my_kind');
eq('и он используется в подписи', D.label('my_kind', null, 'ru', { kinds: own }), 'Свой вид');

console.log('\nСправочник видов после приведения портфеля:');
[...canon].sort().forEach(k => {
  const n = portfolio.filter(p => D.normalizeKind(p.category) === k).length;
  console.log('  ' + String(n).padStart(3) + '  ' + (D.kind(k) || {}).ru + '  (' + k + ')');
});

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nСправочники согласованы и покрывают весь портфель');
process.exit(bad ? 1 : 0);
