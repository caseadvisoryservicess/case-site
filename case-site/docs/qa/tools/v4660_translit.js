/* Транслитератор узбекского: латиница <-> кириллица.

   Проверять его надо жёстче обычного модуля по двум причинам. Первая: результат уходит в
   коммерческое предложение, которое подписывают, поэтому «примерно правильно» не годится.
   Вторая: почти все ошибки здесь тихие. Неверно разобранный диграф не роняет страницу, он
   просто делает документ безграмотным, и увидит это только носитель языка - уже у клиента.

   Поэтому тут три слоя проверок:
     1) точечные случаи из ТЗ, где порядок правил решает исход (yo‘q, yer, yaxshi);
     2) неприкосновенность имён, чисел, единиц, почты, ссылок и плейсхолдеров;
     3) свойство обратимости на корпусе из 850 словоформ, взятых из настоящих шаблонов
        предложения, а не придуманных.

   Запуск: node v4660_translit.js [папка os] */
'use strict';
const path = require('path'), fs = require('fs');
const OS = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..', 'os'));

global.window = {};
require(path.join(OS, 'v4660-uz-translit.js'));
const T = global.window.CASE_UZ_TRANSLIT;

let bad = 0;
const ck = (n, c, d) => { console.log((c ? 'OK  ' : '!!  ') + n + (d === undefined ? '' : ' - ' + d)); if (!c) bad++; };
const eq = (name, got, want) => ck(name, got === want, got === want ? got : `получили «${got}», ждали «${want}»`);

ck('модуль загрузился и объявил версию', !!T && /^\d+\.\d+\.\d+$/.test(T.version || ''), T && T.version);

/* ---- 1. случаи, где порядок правил решает исход ---- */

/* Прямо из раздела 12.3b ТЗ. */
eq('o‘ становится ў', T.toCyrl('o‘'), 'ў');
eq('g‘ становится ғ', T.toCyrl('g‘'), 'ғ');
eq('sh становится ш', T.toCyrl('sh'), 'ш');
eq('yo‘q читается как й+ў+қ, а не как ё', T.toCyrl('yo‘q'), 'йўқ');

/* Йотированные: только в начале слова и после гласной. */
eq('yer в начале слова даёт е', T.toCyrl('yer'), 'ер');
eq('yulduz даёт ю', T.toCyrl('yulduz'), 'юлдуз');
eq('yaxshi даёт я', T.toCyrl('yaxshi'), 'яхши');
eq('yozuv даёт ё', T.toCyrl('yozuv'), 'ёзув');

/* e: начало слова против позиции после согласной. */
eq('e в начале слова даёт э', T.toCyrl('ekspert'), 'экcперт'.replace('c', 'с'));
eq('e после согласной даёт е', T.toCyrl('kel'), 'кел');
eq('e после гласной даёт э', T.toCyrl('maef'), 'маэф');

/* Диграфы разбираются раньше одиночных букв. */
eq('ch становится ч', T.toCyrl('chek'), 'чек');
eq('ng становится нг', T.toCyrl('teng'), 'тенг');
eq('x и h - разные буквы', T.toCyrl('xah'), 'хаҳ');
eq('q становится қ', T.toCyrl('qavat'), 'қават');

/* Ключевое решение: ts НЕ склеивается в ц, иначе ломаются стыки морфем. */
eq('ketsa остаётся кетса, а не кеца', T.toCyrl('ketsa'), 'кетса');
eq('aytsa остаётся айтса', T.toCyrl('aytsa'), 'айтса');
eq('обратно ц читается как ts', T.toLatn('ц'), 'ts');

/* Тутуқ белгиси. */
eq('тутуқ белгиси даёт ъ', T.toCyrl('ma’lumot'), 'маълумот');
eq('и возвращается обратно', T.toLatn('маълумот'), 'ma’lumot');

/* Заглавные. */
eq('заглавная O‘ даёт Ў', T.toCyrl('O‘zbekiston'), 'Ўзбекистон');
eq('заглавная Sh даёт Ш', T.toCyrl('Shahar'), 'Шаҳар');
eq('заглавная Ya даёт Я', T.toCyrl('Yakka'), 'Якка');

/* ---- 2. что трогать нельзя ---- */

const KEEP_CASES = [
  ['CASE Real Estate', 'название компании'],
  ['Excel', 'название программы'],
  ['NOI va IRR', 'финансовые аббревиатуры'],
  ['18 400 m²', 'число с единицей'],
  ['2,5 USD/m²', 'ставка'],
  ['info@caseadvisory.uz', 'адрес почты'],
  ['https://case.uz/taklif', 'ссылка'],
  ['{{client_company}}', 'плейсхолдер'],
  ['{{fee_total}} USD', 'плейсхолдер с валютой'],
  ['PDF va DWG', 'форматы файлов'],
  ['F&B zonasi', 'отраслевой термин']
];
KEEP_CASES.forEach(([src, what]) => {
  const cyr = T.toCyrl(src);
  const tokens = src.match(/CASE|Excel|NOI|IRR|USD|PDF|DWG|F&B|m²|\{\{[^}]+\}\}|[\w.]+@[\w.]+|https?:\/\/\S+|\d[\d\s]*/g) || [];
  const kept = tokens.every(t => cyr.indexOf(t) >= 0);
  ck('не транслитерируется: ' + what, kept, src + '  ->  ' + cyr);
});

eq('внутри плейсхолдера ничего не меняется',
   T.toCyrl('Hurmatli {{client_contact}}, taklif tayyor'),
   'Ҳурматли {{client_contact}}, таклиф тайёр');

/* ---- 3. нормализация апострофов ---- */
eq('прямая кавычка после o становится типографской', T.normalizeApostrophes("bo'lim"), 'bo‘lim');
eq('обратная кавычка после g становится типографской', T.normalizeApostrophes('bog`liq'), 'bog‘liq');
eq('одиночный апостроф становится тутуқ белгиси', T.normalizeApostrophes("ma'lumot"), 'ma’lumot');
eq('U+2018 не после o и g тоже становится тутуқ белгиси',
   T.normalizeApostrophes('Ma‘lumotlar'), 'Ma’lumotlar');
ck('уже нормализованный текст не меняется повторной нормализацией',
   T.normalizeApostrophes(T.normalizeApostrophes('bo‘lim ma’lumot')) === T.normalizeApostrophes('bo‘lim ma’lumot'));

/* ---- 4. обратимость на настоящем корпусе ---- */

/* Корпус лежит в репозитории, а не во временной папке: проверка должна давать один и тот
   же результат у любого, кто её запустит. Файл собран из двух утверждённых шаблонов
   предложения - это настоящие словоформы фирмы, а не выдуманный набор. */
const corpusPath = path.join(__dirname, '..', 'fixtures', 'uz_corpus.json');
let corpus = null;
try { corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8')); } catch (e) {}
if (!corpus) {
  /* Запасной корпус: слова из шаблонов предложения, покрывающие все сложные случаи.
     Он нужен, чтобы проверка работала и без внешнего файла - в чужой среде, в CI, у коллеги. */
  corpus = ['Boshlang‘ich', 'Bo‘lim', 'Marg‘ilon', 'Ma’lumotlar', 'O‘zbekiston', 'O‘zgarishlar',
    'To‘liq', 'To‘lov', 'Yo‘l', 'Yo‘riqnoma', 'bog‘langan', 'bog‘liq', 'bog‘lovchi', 'boshlang‘ich',
    'taklif', 'tijorat', 'loyiha', 'maydon', 'hisob', 'kitob', 'shartnoma', 'muddat', 'narx',
    'nazorat', 'tashrif', 'yechim', 'qavat', 'avtoturargoh', 'savdo', 'galereyasi', 'xizmat',
    'yig‘imi', 'foydalanish', 'tozalash', 'qiyosiy', 'tahlil', 'risklar', 'ro‘yxati',
    'yakka', 'hamkorlik', 'maslahat', 'o‘lchamlari', 'topografik', 'o‘lchov', 'kirish',
    'zallari', 'qabul', 'zonasi', 'turar', 'joy', 'zinapoya', 'liftlari', 'tekshirish',
    'xarajatlarni', 'kamaytirish', 'bozordagi', 'o‘rni', 'ochilishga', 'tayyorgarlik',
    'brend', 'jalb', 'qilish', 'chizmalar', 'yaxshi', 'yulduz', 'yer', 'yo‘q', 'ketsa'];
}

let broken = [];
corpus.forEach(w => {
  const norm = T.normalizeApostrophes(w);
  const r = T.roundTrips(norm);
  if (!r.ok) broken.push(`${norm} -> ${T.toCyrl(norm)} -> ${r.back}`);
});
ck(`обратимость на корпусе из ${corpus.length} словоформ`, broken.length === 0,
   broken.length ? broken.slice(0, 12).join(' | ') + (broken.length > 12 ? ` … и ещё ${broken.length - 12}` : '') : 'все слова вернулись без изменений');

/* Обратимость на связном тексте, а не только на отдельных словах: пробелы, знаки
   препинания и неприкосновенные токены участвуют в разборе и могут сдвинуть границы слов. */
const SENTENCES = [
  'Hurmatli {{client_contact}}, CASE Real Estate Advisory sizga tijorat taklifini yo‘llaydi.',
  'Hisob-kitob maydoni 18 400 m², stavka 2,5 USD/m², jami {{fee_total}} USD.',
  'Bo‘lim A: bozor tahlili va qiyosiy tahlil. Bo‘lim B: konsepsiya va qavat rejalari.',
  'Moliyaviy model Excel formatida, chizmalar DWG va PDF ko‘rinishida topshiriladi.',
  'To‘lov tartibi: boshlang‘ich to‘lov 40%, oraliq 30%, yakuniy 30%.',
  'Taklif 30 kun davomida amal qiladi. Savollar: info@caseadvisory.uz'
];
let brokenS = [];
SENTENCES.forEach(s => {
  const norm = T.normalizeApostrophes(s);
  const r = T.roundTrips(norm);
  if (!r.ok) brokenS.push(norm + '\n      вернулось: ' + r.back);
});
ck('обратимость на связных предложениях предложения', brokenS.length === 0,
   brokenS.join('\n    ') || 'все предложения вернулись без изменений');

/* Показательный прогон: видно глазами, что кириллица читаемая, а не набор букв. */
console.log('\nПример преобразования:');
SENTENCES.slice(0, 3).forEach(s => {
  console.log('  лат: ' + s);
  console.log('  кир: ' + T.toCyrl(T.normalizeApostrophes(s)));
});

console.log(bad ? `\nПРОВАЛЕНО проверок: ${bad}` : '\nТранслитератор обратим и не трогает то, что трогать нельзя');
process.exit(bad ? 1 : 0);
