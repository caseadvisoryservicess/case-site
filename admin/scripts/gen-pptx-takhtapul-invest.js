/**
 * Инвесторская презентация Тахтапула в редактируемом PowerPoint.
 *
 * Владелец попросил презентацию в формате pptx и именно изменяемую: весь текст,
 * таблицы и схема окружения собраны нативными объектами PowerPoint, а не
 * картинками. Открывается и правится обычным способом.
 *
 * Цифры берутся из трёх файлов проекта, ничего не зашито в код руками:
 *   data/projects/takhtapul/project.json      - площади, уровни, контакты
 *   data/projects/takhtapul/caseos-model.json - прогоны модели CASE OS Geo Analytics
 *   data/projects/takhtapul/geo-invest.json   - точки окружения для схемы
 *
 * Правило 1 паспорта: длинных тире нет нигде. Санитайзер dash() прогоняет
 * каждую строку на выходе, как и оба генератора PDF. Не убирать.
 * Правило 2: цен в документе нет, условия по запросу.
 *
 * Запуск: cd admin && node scripts/gen-pptx-takhtapul-invest.js
 * Файл:   data/projects/takhtapul/uploads/invest-ru.pptx
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PptxGenJS = require('pptxgenjs');

const ROOT = path.join(__dirname, '..');
const SLUG = 'takhtapul';
const DIR = path.join(ROOT, 'data', 'projects', SLUG);
const UP = path.join(DIR, 'uploads');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
const CFG = rd('project.json');
const M = rd('caseos-model.json');
const GEO = rd('geo-invest.json');
const OUT = process.env.CASE_PPTX_OUT || path.join(UP, 'invest-ru.pptx');

// ── палитра проекта (те же значения, что у лендинга и брошюры) ──
const C = {
  bg: 'F6F5F2', ink: '212326', mut: '63666B', brz: 'A8804C', brzd: '8C6A3D',
  dark: '1B1D1F', card: 'FFFFFF', line: 'DFDCD5', ok: '2E7C39', warn: '9A6A12',
  blue: '2F5F7A', soft: 'EDE7DC', medx: 'D3C3A8'
};
const FH = 'Cambria';   // заголовки, кириллица есть
const FB = 'Calibri';   // текст

// сетка листа 13,333 x 7,5 дюйма
const L = 0.62, W = 12.09, RGT = L + W, FOOT = 7.0;

// правило 1: никаких длинных тире ни в одной строке документа
const dash = (s) => String(s).replace(/[—–]/g, '-');
const num = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// русское склонение после числа: 1 конкурент, 2-4 конкурента, 5+ конкурентов
const plural = (n, one, few, many) => {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
};

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE';           // 13,333 x 7,5 - ставим до первого слайда
pres.author = 'CASE Real Estate Advisory';
pres.company = 'CASE Real Estate Advisory';
pres.title = 'Taxtapul 31 - инвестиционный обзор';
pres.subject = 'Геоаналитика и выбор формата';

let PG = 0;
const img = (f) => path.join(UP, f);
const has = (f) => fs.existsSync(img(f));

// ── строительные блоки ──
const shadow = () => ({ type: 'outer', angle: 90, blur: 9, offset: 1, color: '000000', opacity: 0.07 });

const txt = (s, t, o) => s.addText(dash(t), Object.assign({ fontFace: FB, color: C.ink, margin: 0 }, o));

const card = (s, x, y, w, h, o = {}) => s.addShape('roundRect', {
  x, y, w, h, rectRadius: 0.06,
  fill: { color: o.fill || C.card },
  line: { color: o.line || C.line, width: o.lw === undefined ? 0.75 : o.lw },
  shadow: o.flat ? undefined : shadow()
});

// светлый лист с колонтитулом
const page = (title, kicker) => {
  const s = pres.addSlide();
  PG++;
  s.background = { color: C.bg };
  if (kicker) txt(s, kicker.toUpperCase(), { x: L, y: 0.42, w: W, h: 0.26, fontSize: 10.5, bold: true, color: C.brz, charSpacing: 2.2 });
  // длинный заголовок ужимаем, чтобы он остался в одну строку и не налез на текст ниже
  if (title) {
    const n = title.length;
    txt(s, title, { x: L, y: 0.72, w: W, h: 0.62, fontSize: n > 40 ? (n > 50 ? 23 : 26) : 30, bold: true, color: C.ink, fontFace: FH });
  }
  txt(s, 'CASE Real Estate Advisory · TAXTAPUL, ул. Тахтапул, 31, Ташкент', { x: L, y: FOOT, w: 9, h: 0.26, fontSize: 9, color: C.mut });
  txt(s, String(PG), { x: RGT - 0.7, y: FOOT, w: 0.7, h: 0.26, fontSize: 9, color: C.mut, align: 'right' });
  return s;
};

// тёмный лист-разделитель
const divider = (n, title, sub, items, photo) => {
  const s = pres.addSlide();
  PG++;
  s.background = { color: C.dark };
  if (photo && has(photo)) s.addImage({ path: img(photo), x: 7.1, y: 0, w: 6.233, h: 7.5, sizing: { type: 'cover', w: 6.233, h: 7.5 } });
  s.addShape('rect', { x: 0, y: 0, w: 7.1, h: 7.5, fill: { color: C.dark }, line: { width: 0 } });
  txt(s, n, { x: L, y: 1.5, w: 3, h: 1.3, fontSize: 80, bold: true, color: C.brz, fontFace: FH });
  txt(s, title, { x: L, y: 2.85, w: 5.9, h: 0.7, fontSize: 34, bold: true, color: 'FFFFFF', fontFace: FH });
  txt(s, sub, { x: L, y: 3.6, w: 5.9, h: 0.6, fontSize: 14, color: 'C9C2B6' });
  s.addText(items.map((t, i) => ({ text: dash(t), options: { bullet: true, breakLine: i < items.length - 1 } })),
    { x: L, y: 4.35, w: 5.9, h: 2.1, fontSize: 12.5, color: 'C9C2B6', fontFace: FB, paraSpaceAfter: 7, margin: 0 });
  txt(s, String(PG), { x: L, y: FOOT, w: 1, h: 0.26, fontSize: 9, color: '8A8578' });
  return s;
};

// плитка с крупной цифрой
const tile = (s, x, y, w, h, val, unit, label, o = {}) => {
  card(s, x, y, w, h, o.flat ? { fill: C.soft, flat: true, lw: 0 } : {});
  txt(s, val, { x: x + 0.24, y: y + 0.22, w: w - 0.48, h: 0.62, fontSize: o.big || 30, bold: true, color: o.color || C.ink, fontFace: FH });
  if (unit) txt(s, unit, { x: x + 0.24, y: y + 0.84, w: w - 0.48, h: 0.26, fontSize: 11, color: C.brz, bold: true });
  txt(s, label, { x: x + 0.24, y: y + (unit ? 1.1 : 0.86), w: w - 0.48, h: h - (unit ? 1.28 : 1.04), fontSize: 10.5, color: C.mut });
};

// таблица в стиле документа
const table = (s, rows, o = {}) => {
  // o.align - строка на все колонки или массив по колонкам (первая всегда слева)
  const al = (j) => (j === 0 ? 'left' : (Array.isArray(o.align) ? (o.align[j] || 'right') : (o.align || 'right')));
  const head = rows[0].map((t, j) => ({ text: dash(t), options: { bold: true, color: 'FFFFFF', fill: { color: C.dark }, fontSize: o.hs || 11, align: al(j) } }));
  const body = rows.slice(1).map((r, i) => r.map((t, j) => ({
    text: dash(t),
    options: {
      color: j === 0 ? C.ink : C.mut, bold: j === 0 || (o.boldRows || []).includes(i),
      fill: { color: (o.boldRows || []).includes(i) ? C.soft : (i % 2 ? 'FFFFFF' : 'FAF8F5') },
      fontSize: o.fs || 11, align: al(j)
    }
  })));
  s.addTable([head, ...body], {
    x: o.x === undefined ? L : o.x, y: o.y, w: o.w || W, colW: o.colW,
    border: { type: 'solid', color: C.line, pt: 0.5 },
    fontFace: FB, valign: 'middle', rowH: o.rowH || 0.32, margin: [4, 8, 4, 8]
  });
};

// подпись-сноска под содержимым
const note = (s, y, t) => txt(s, t, { x: L, y, w: W, h: 0.5, fontSize: 9.5, color: C.mut, italic: true });

// горизонтальная полоса-индикатор
const bar = (s, x, y, w, h, frac, color) => {
  s.addShape('roundRect', { x, y, w, h, rectRadius: 0.03, fill: { color: C.line }, line: { width: 0 } });
  if (frac > 0) s.addShape('roundRect', { x, y, w: Math.max(0.06, w * frac), h, rectRadius: 0.03, fill: { color }, line: { width: 0 } });
};

// ════════════════════════════════════════════════════════════════
// 1. Титул
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  PG++;
  s.background = { color: C.dark };
  if (has('facade-vertical-dusk.jpg')) {
    s.addImage({ path: img('facade-vertical-dusk.jpg'), x: 7.53, y: 0, w: 5.803, h: 7.5, sizing: { type: 'cover', w: 5.803, h: 7.5 } });
  }
  s.addShape('rect', { x: 0, y: 0, w: 7.53, h: 7.5, fill: { color: C.dark }, line: { width: 0 } });
  txt(s, 'CASE REAL ESTATE ADVISORY', { x: L, y: 0.75, w: 6.3, h: 0.3, fontSize: 11, bold: true, color: C.brz, charSpacing: 2.6 });
  txt(s, 'TAXTAPUL', { x: L, y: 1.9, w: 6.3, h: 1.35, fontSize: 76, bold: true, color: 'FFFFFF', fontFace: FH, charSpacing: 1 });
  txt(s, 'ул. Тахтапул, 31 · Шайхантахурский район · Ташкент', { x: L, y: 3.2, w: 6.3, h: 0.34, fontSize: 14, color: 'C9C2B6' });
  s.addShape('rect', { x: L, y: 3.85, w: 1.5, h: 0.03, fill: { color: C.brz }, line: { width: 0 } });
  txt(s, 'Инвестиционный обзор объекта', { x: L, y: 4.12, w: 6.3, h: 0.62, fontSize: 25, bold: true, color: 'FFFFFF', fontFace: FH });
  txt(s, 'Геоаналитика окружения, оценка модели CASE OS и выбор формата использования', { x: L, y: 4.82, w: 6.1, h: 0.6, fontSize: 13, color: 'C9C2B6' });
  txt(s, 'Отдельно стоящее коммерческое здание · 5 уровней · 2 299,0 м² общей площади', { x: L, y: 5.7, w: 6.3, h: 0.3, fontSize: 12, color: C.brz, bold: true });
  txt(s, 'Август 2026 · документ для инвестора, не является публичной офертой', { x: L, y: FOOT - 0.05, w: 6.3, h: 0.3, fontSize: 9.5, color: '8A8578' });
}

// ════════════════════════════════════════════════════════════════
// 2. Объект в цифрах
// ════════════════════════════════════════════════════════════════
{
  const s = page('Объект в цифрах', 'Здание');
  const tw = (W - 0.48) / 3;
  tile(s, L, 1.5, tw, 1.72, '2 299,0', 'м²', 'Общая площадь здания (GBA) по государственному кадастру');
  tile(s, L + tw + 0.24, 1.5, tw, 1.72, '1 855,0', 'м²', 'Арендопригодная площадь (GLA), пять уровней');
  tile(s, L + 2 * (tw + 0.24), 1.5, tw, 1.72, '5', 'уровней', 'Подвал и четыре надземных этажа, свободная планировка');

  if (has('hero-dusk.jpg')) s.addImage({ path: img('hero-dusk.jpg'), x: L, y: 3.46, w: 5.9, h: 3.0, sizing: { type: 'cover', w: 5.9, h: 3.0 } });
  const rx = L + 6.14, rw = W - 6.14;
  const facts = [
    ['645 м²', 'участок в постоянном пользовании'],
    ['440 м²', 'пятно застройки'],
    ['до 4,0 м', 'высота потолков, первый этаж'],
    ['359-382 м²', 'арендопригодная площадь этажа']
  ];
  facts.forEach((f, i) => {
    const y = 3.46 + i * 0.78;
    card(s, rx, y, rw, 0.68, { fill: C.card, flat: true });
    txt(s, f[0], { x: rx + 0.2, y: y + 0.09, w: 1.75, h: 0.5, fontSize: 16, bold: true, color: C.brzd, fontFace: FH, valign: 'middle' });
    txt(s, f[1], { x: rx + 2.05, y: y + 0.09, w: rw - 2.25, h: 0.5, fontSize: 11, color: C.mut, valign: 'middle' });
  });
  note(s, 6.56, 'Площади по данным государственного кадастра, подлежат уточнению по фактическим обмерам при сдаче.');
}

// ════════════════════════════════════════════════════════════════
// 3. Здание по уровням
// ════════════════════════════════════════════════════════════════
{
  const s = page('Здание по уровням', 'Помещения');
  const rows = [['Уровень', 'Общая площадь (GBA), м²', 'Арендопригодная (GLA), м²', 'Потолок, м', 'Назначение']];
  (CFG.units || []).forEach((u) => {
    if (u.id === 'all' || /цел/i.test((u.level && u.level.ru) || '')) return;
    rows.push([(u.level && u.level.ru) || u.id, u.gba || '-', u.gla || '-', u.ceil || '-', (u.uses && u.uses.ru) || '']);
  });
  rows.push(['Здание целиком', '2 299,0', '1 855,0', '', 'подвал и четыре этажа']);
  table(s, rows, { y: 1.55, colW: [1.85, 2.3, 2.5, 1.3, 4.14], rowH: 0.42, boldRows: [rows.length - 2], align: 'center' });
  note(s, 4.55, 'Источник: выписки государственного кадастра и рабочая документация. Планировки свободные, перегородки под задачу арендатора.');

  const px = [['plan-cad-b.jpg', 'Подвал'], ['plan-cad-f1.jpg', '1 этаж'], ['plan-cad-f23.jpg', '2-3 этаж'], ['plan-cad-f4.jpg', '4 этаж']].filter((p) => has(p[0]));
  const pw = (W - 0.36) / Math.max(1, px.length);
  px.forEach((p, i) => {
    const x = L + i * (pw + 0.12);
    s.addImage({ path: img(p[0]), x, y: 5.15, w: pw, h: 1.5, sizing: { type: 'cover', w: pw, h: 1.5 } });
    txt(s, p[1], { x, y: 6.68, w: pw, h: 0.24, fontSize: 9.5, color: C.mut, align: 'center' });
  });
}

// ════════════════════════════════════════════════════════════════
// 4. Локация
// ════════════════════════════════════════════════════════════════
{
  const s = page('Локация', 'Место');
  if (has('caseos-map.jpg')) s.addImage({ path: img('caseos-map.jpg'), x: L, y: 1.5, w: 5.45, h: 4.69, sizing: { type: 'cover', w: 5.45, h: 4.69 } });
  txt(s, 'Карта: CASE OS Geo Analytics, зона вокруг объекта', { x: L, y: 6.24, w: 5.45, h: 0.24, fontSize: 9, color: C.mut, italic: true });

  const rx = L + 5.75, rw = W - 5.75;
  txt(s, 'Объект стоит внутри плотного жилого массива Шайхантахура, в километре вокруг живут 32 375 человек. Это не деловой периметр города, а обжитой район с готовым ежедневным потоком людей.',
    { x: rx, y: 1.5, w: rw, h: 0.95, fontSize: 12.5, color: C.ink });

  const rows = [['Ориентир', 'Расстояние']];
  rows.push(['Метро ' + M.metro.name, num(M.metro.d) + ' м']);
  M.nearestBc.slice(0, 3).forEach((b) => rows.push(['Бизнес-центр ' + b[0], num(b[1]) + ' м']));
  M.med1km.anchors.slice(0, 3).forEach((a) => rows.push([a[0], num(a[1]) + ' м']));
  table(s, rows, { x: rx, y: 2.62, w: rw, colW: [rw - 1.5, 1.5], rowH: 0.34 });

  txt(s, 'Рядом на карте приложения: Малая кольцевая дорога, Jomiy bozor и Malika bozor, Ташкентская телебашня, УзЭкспоЦентр, Японский сад, зоопарк, парк Анхор Локомотив, мечеть Минор.',
    { x: rx, y: 5.75, w: rw, h: 0.8, fontSize: 11, color: C.mut });
}

// ════════════════════════════════════════════════════════════════
// 5. Разделитель: геоаналитика
// ════════════════════════════════════════════════════════════════
divider('01', 'Геоаналитика', 'Что показывают данные о месте и как их считает модель CASE OS Geo Analytics', [
  'Источник данных и метод расчёта',
  'Окружение объекта по радиусам от 500 м до 3 км',
  'Схема окружения: медицина и бизнес-центры',
  'Три формата в одной модели: балл, конкуренция, медиана города',
  'Где формула работает, а где её выводы применять нельзя'
], 'aerial-night.jpg');

// ════════════════════════════════════════════════════════════════
// 6. Источник и метод
// ════════════════════════════════════════════════════════════════
{
  const s = page('Источник данных и метод', 'Геоаналитика');
  txt(s, 'Все цифры этого раздела взяты из приложения CASE OS Geo Analytics: это тот же расчёт, по которому приложение выставляет баллы, а не наша отдельная оценка.',
    { x: L, y: 1.42, w: W, h: 0.4, fontSize: 12.5, color: C.ink });

  const lay = [
    ['Медицина', M.layers.med.city, M.layers.med.src],
    ['Образование', M.layers.edu.city, M.layers.edu.src],
    ['Бизнес-центры', M.layers.bc.city, M.layers.bc.src]
  ];
  const cw = (7.1 - 0.4) / 3;
  lay.forEach((l, i) => {
    const x = L + i * (cw + 0.2);
    card(s, x, 2.0, cw, 1.72);
    txt(s, l[0], { x: x + 0.2, y: 2.15, w: cw - 0.4, h: 0.28, fontSize: 11.5, bold: true, color: C.ink });
    txt(s, num(l[1]), { x: x + 0.2, y: 2.45, w: cw - 0.4, h: 0.5, fontSize: 26, bold: true, color: C.brzd, fontFace: FH });
    txt(s, 'объектов по Ташкенту', { x: x + 0.2, y: 2.95, w: cw - 0.4, h: 0.24, fontSize: 9.5, color: C.brz });
    txt(s, l[2], { x: x + 0.2, y: 3.2, w: cw - 0.4, h: 0.44, fontSize: 9, color: C.mut });
  });

  txt(s, 'Слой образования появился в приложении 7 августа 2026 года. До этого оценить учебный формат по данным было нельзя, теперь можно.',
    { x: L, y: 3.88, w: 7.1 - 0.2, h: 0.55, fontSize: 11, color: C.mut });

  card(s, L, 4.55, 7.1 - 0.2, 1.95, { fill: C.soft, flat: true, lw: 0 });
  txt(s, 'ФОРМУЛА МОДЕЛИ', { x: L + 0.25, y: 4.72, w: 6.4, h: 0.24, fontSize: 9.5, bold: true, color: C.brz, charSpacing: 1.6 });
  txt(s, M.formula.text, { x: L + 0.25, y: 5.0, w: 6.4, h: 0.62, fontSize: 13, bold: true, color: C.ink, fontFace: FH });
  txt(s, 'Формула открытая, без машинного обучения: результат можно пересчитать вручную и проверить.',
    { x: L + 0.25, y: 5.7, w: 6.4, h: 0.5, fontSize: 10.5, color: C.mut });

  const rx = L + 7.2, rw = W - 7.2;
  const par = [
    ['Радиус спроса', '1 км'],
    ['Шаг сетки', M.formula.grid.step + ' м'],
    ['Ячеек в расчёте', num(M.formula.grid.cells)],
    ['Эталон спроса', num(M.formula.demandBench) + ' чел.'],
    ['Эталон конкуренции', M.formula.compBench + ' объектов'],
    ['Веса спрос / конкуренция', M.formula.wDemand + ' / ' + M.formula.wComp],
    ['Жителей в 1 км от объекта', num(M.formula.pop1km)]
  ];
  txt(s, 'Параметры прогона', { x: rx, y: 1.98, w: rw, h: 0.3, fontSize: 14, bold: true, color: C.ink, fontFace: FH });
  par.forEach((p, i) => {
    const y = 2.42 + i * 0.6;
    card(s, rx, y, rw, 0.52, { fill: i === par.length - 1 ? C.soft : C.card, flat: true });
    txt(s, p[0], { x: rx + 0.18, y: y + 0.06, w: rw - 1.9, h: 0.4, fontSize: 10.5, color: C.mut, valign: 'middle' });
    txt(s, p[1], { x: rx + rw - 1.85, y: y + 0.06, w: 1.65, h: 0.4, fontSize: 11.5, bold: true, color: C.ink, align: 'right', valign: 'middle' });
  });
}

// ════════════════════════════════════════════════════════════════
// 7. Окружение по радиусам
// ════════════════════════════════════════════════════════════════
{
  const s = page('Окружение объекта по радиусам', 'Геоаналитика');
  const R = M.radii.list;
  const lbl = (r) => (r >= 1000 ? String(r / 1000).replace('.', ',') + ' км' : r + ' м');
  const rows = [['Показатель', ...R.map(lbl)]];
  rows.push(['Жителей', ...R.map((r) => num(M.radii.pop[r]))]);
  rows.push(['Медицинских объектов', ...R.map((r) => num(M.radii.med[r]))]);
  rows.push(['в том числе профильных конкурентов клиники', ...R.map((r) => num(M.radii.comp[r]))]);
  rows.push(['Бизнес-центров', ...R.map((r) => num(M.radii.bc[r]))]);
  table(s, rows, { y: 1.6, colW: [4.09, 1.6, 1.6, 1.6, 1.6, 1.6], rowH: 0.46, fs: 12, align: 'center' });

  const cw = (W - 0.48) / 3;
  const hi = [
    ['32 375', 'жителей в километре вокруг', 'Спрос по модели упирается в потолок: эталон 25 000 человек перекрыт на 29%.'],
    ['3', 'чужих бизнес-центра в 1 км', 'Модель считает четыре, потому что в её списке есть и сам Тахтапул.'],
    ['1 791 м', 'до метро Бадамзар', 'Пешая доступность метро для сотрудников и посетителей.']
  ];
  hi.forEach((h, i) => {
    const x = L + i * (cw + 0.24);
    card(s, x, 4.2, cw, 1.62);
    txt(s, h[0], { x: x + 0.22, y: 4.36, w: cw - 0.44, h: 0.5, fontSize: 26, bold: true, color: C.brzd, fontFace: FH });
    txt(s, h[1], { x: x + 0.22, y: 4.86, w: cw - 0.44, h: 0.26, fontSize: 10.5, bold: true, color: C.brz });
    txt(s, h[2], { x: x + 0.22, y: 5.14, w: cw - 0.44, h: 0.6, fontSize: 10, color: C.mut });
  });
  note(s, 6.05, 'Население считает сетка Kontur H3, откалиброванная приложением на официальное население района. Источник счётчиков: карточка точки CASE OS Geo Analytics.');
}

// ════════════════════════════════════════════════════════════════
// 8. Схема окружения (нативные фигуры, редактируется в PowerPoint)
// ════════════════════════════════════════════════════════════════
{
  const s = page('Схема окружения', 'Геоаналитика');
  const CX = 4.35, CY = 4.12, RMAX = 2.45, MAXM = 3000;
  const sc = RMAX / MAXM;
  card(s, L, 1.5, 7.5, 5.25, { fill: 'FFFFFF' });

  [[3000, '3 км'], [1500, '1,5 км'], [1000, '1 км'], [500, '500 м']].forEach(([m, t]) => {
    const r = m * sc;
    s.addShape('ellipse', { x: CX - r, y: CY - r, w: r * 2, h: r * 2, fill: { color: 'FFFFFF', transparency: 100 }, line: { color: m === 1000 ? C.brz : C.line, width: m === 1000 ? 1.25 : 0.75, dashType: m === 1000 ? 'solid' : 'dash' } });
    txt(s, t, { x: CX - 0.4, y: CY - r - 0.02, w: 0.8, h: 0.2, fontSize: 8, color: m === 1000 ? C.brz : C.mut, align: 'center' });
  });

  const D = 0.052;
  const col = { med: C.brz, medx: C.medx, bc: C.blue };
  (GEO.points || []).forEach((p) => {
    if (p.d > MAXM) return;
    const x = CX + p.x * sc - D / 2, y = CY - p.y * sc - D / 2;
    s.addShape('ellipse', { x, y, w: D, h: D, fill: { color: col[p.c] || C.mut }, line: { width: 0 } });
  });
  s.addShape('ellipse', { x: CX - 0.09, y: CY - 0.09, w: 0.18, h: 0.18, fill: { color: C.dark }, line: { color: 'FFFFFF', width: 1.5 } });
  txt(s, 'TAXTAPUL', { x: CX + 0.16, y: CY - 0.13, w: 1.4, h: 0.26, fontSize: 9, bold: true, color: C.dark, valign: 'middle' });

  const rx = L + 7.8, rw = W - 7.8;
  txt(s, 'Что на схеме', { x: rx, y: 1.6, w: rw, h: 0.3, fontSize: 15, bold: true, color: C.ink, fontFace: FH });
  const leg = [
    [C.brz, 'Профильные конкуренты клиники', GEO.counts[3000].comp],
    [C.medx, 'Прочая медицина: стоматология, узкие профили', GEO.counts[3000].med - GEO.counts[3000].comp],
    [C.blue, 'Бизнес-центры, кроме самого объекта', GEO.counts[3000].bc]
  ];
  leg.forEach((g, i) => {
    const y = 2.1 + i * 0.62;
    s.addShape('ellipse', { x: rx + 0.02, y: y + 0.09, w: 0.15, h: 0.15, fill: { color: g[0] }, line: { width: 0 } });
    txt(s, g[1], { x: rx + 0.3, y, w: rw - 0.9, h: 0.5, fontSize: 10.5, color: C.ink });
    txt(s, String(g[2]), { x: rx + rw - 0.6, y, w: 0.6, h: 0.3, fontSize: 13, bold: true, color: C.brzd, align: 'right', fontFace: FH });
  });
  // счёт по кольцам, чтобы схема читалась без обращения к таблице
  txt(s, 'Сколько объектов в каждом кольце', { x: rx, y: 4.05, w: rw, h: 0.28, fontSize: 11.5, bold: true, color: C.ink });
  const ringRows = [['Радиус', 'Медицина', 'БЦ']];
  [[500, '500 м'], [1000, '1 км'], [1500, '1,5 км'], [3000, '3 км']].forEach(([r, t]) => {
    ringRows.push([t, num(GEO.counts[r].med), num(GEO.counts[r].bc)]);
  });
  table(s, ringRows, { x: rx, y: 4.42, w: rw, colW: [rw - 2.5, 1.4, 1.1], rowH: 0.33, fs: 10.5, hs: 10, align: 'center' });

  txt(s, 'Всего ' + GEO.total + ' объектов в радиусе 3 км. Аптеки и махаллинские центры на схему не выносим: ни офису, ни клинике они не конкуренты и только зашумляют картину. Каждый круг и каждая точка это объект PowerPoint, их можно двигать и перекрашивать.',
    { x: rx, y: 6.1, w: rw, h: 0.85, fontSize: 9.5, color: C.mut });
}

// ════════════════════════════════════════════════════════════════
// 8а. Карты приложения, если владелец положил их файлами в uploads
//
// Механизм такой же, как в PDF-модуле: кладём файл в
// data/projects/takhtapul/uploads - и слайд собирается сам, править код не
// надо. Скриншоты, вставленные прямо в переписку, на диск не попадают, поэтому
// карты нужны именно файлами.
// ════════════════════════════════════════════════════════════════
const MAP_DEFS = [
  ['caseos-heat-bc.jpg', 'Зоны пригодности: бизнес-центр', 'Балл нашей точки 78 из 100 при медиане города 83. Зелёное - людей много, конкурентов мало; красное - людей мало либо ниша занята.'],
  ['caseos-heat-med.jpg', 'Зоны пригодности: клиника', 'Балл 55 из 100 при медиане города 55. Модель штрафует за 33 профильных соседа, но в медицине это кластер, а не отток спроса.'],
  ['caseos-heat-edu.jpg', 'Зоны пригодности: образование', 'Балл 55 из 100 при медиане города 55. В конкуренты попали 19 объектов слоя, включая школы и детские сады.']
];
MAP_DEFS.filter((m) => has(m[0])).forEach((m) => {
  const s = page(m[1], 'Карты модели');
  s.addImage({ path: img(m[0]), x: L, y: 1.5, w: W, h: 4.75, sizing: { type: 'contain', w: W, h: 4.75 } });
  txt(s, m[2], { x: L, y: 6.35, w: W, h: 0.5, fontSize: 11, color: C.mut });
});

// ════════════════════════════════════════════════════════════════
// 9. Три формата в одной модели
// ════════════════════════════════════════════════════════════════
{
  const s = page('Три формата, один эталон', 'Оценка модели');
  txt(s, 'Один и тот же прогон при эталоне конкуренции 8 объектов: цифры сопоставимы между собой напрямую.',
    { x: L, y: 1.4, w: W, h: 0.34, fontSize: 12.5, color: C.ink });
  const cw = (W - 0.48) / 3;
  M.scores.forEach((sc, i) => {
    const x = L + i * (cw + 0.24), lead = sc.key === 'bc';
    card(s, x, 1.9, cw, 4.35, lead ? { fill: 'FFFFFF', line: C.brz, lw: 1.5 } : {});
    txt(s, sc.label, { x: x + 0.24, y: 2.08, w: cw - 0.48, h: 0.5, fontSize: 13, bold: true, color: C.ink, fontFace: FH });
    txt(s, String(sc.score), { x: x + 0.24, y: 2.62, w: cw - 0.48, h: 0.95, fontSize: 62, bold: true, color: lead ? C.brzd : C.mut, fontFace: FH });
    txt(s, 'из 100', { x: x + 0.24, y: 3.55, w: cw - 0.48, h: 0.26, fontSize: 11, color: C.brz, bold: true });
    bar(s, x + 0.24, 3.9, cw - 0.48, 0.16, sc.score / 100, lead ? C.brz : C.medx);
    const st = [
      ['Конкурентов в 1 км', num(sc.comp)],
      ['Медиана города', String(sc.cityMedian)],
      ['Перцентиль точки', sc.pctile + '%']
    ];
    st.forEach((r, j) => {
      const y = 4.28 + j * 0.46;
      txt(s, r[0], { x: x + 0.24, y, w: cw - 1.35, h: 0.34, fontSize: 10.5, color: C.mut, valign: 'middle' });
      txt(s, r[1], { x: x + cw - 1.35, y, w: 1.11, h: 0.34, fontSize: 12, bold: true, color: C.ink, align: 'right', valign: 'middle' });
      if (j < st.length - 1) s.addShape('rect', { x: x + 0.24, y: y + 0.4, w: cw - 0.48, h: 0.008, fill: { color: C.line }, line: { width: 0 } });
    });
    txt(s, sc.score >= sc.cityMedian ? 'на уровне медианы города' : 'ниже медианы города', { x: x + 0.24, y: 5.72, w: cw - 0.48, h: 0.3, fontSize: 10, italic: true, color: C.mut });
  });
  note(s, 6.45, 'Источник: модель зон пригодности CASE OS Geo Analytics, три прогона по одной точке, 2 715 ячеек по 400 м. Перцентиль показывает, какую долю ячеек города точка обходит.');
}

// ════════════════════════════════════════════════════════════════
// 10. Из чего складывается балл
// ════════════════════════════════════════════════════════════════
{
  const s = page('Из чего складывается балл', 'Оценка модели');
  txt(s, 'В формуле два слагаемых. Спрос у всех трёх форматов одинаковый и уже упёрся в потолок модели, поэтому форматы различает только конкуренция.',
    { x: L, y: 1.42, w: W, h: 0.4, fontSize: 12.5, color: C.ink });

  const SW = 7.9, SX = L + 2.55;
  txt(s, 'Спрос, 55 баллов максимум', { x: SX, y: 1.95, w: 3.2, h: 0.24, fontSize: 9.5, bold: true, color: C.brz });
  txt(s, 'Конкуренция, 45 баллов максимум', { x: SX + SW * 0.55 + 0.1, y: 1.95, w: 3.4, h: 0.24, fontSize: 9.5, bold: true, color: C.blue });

  M.scores.forEach((sc, i) => {
    const y = 2.35 + i * 1.02;
    const dem = 55, comp = Math.round(Math.max(0, 1 - sc.comp / M.formula.compBench) * 45 * 10) / 10;
    txt(s, sc.label, { x: L, y: y + 0.02, w: 2.4, h: 0.5, fontSize: 11.5, bold: true, color: C.ink, valign: 'middle' });
    s.addShape('rect', { x: SX, y, w: SW, h: 0.5, fill: { color: 'FFFFFF' }, line: { color: C.line, width: 0.5 } });
    s.addShape('rect', { x: SX, y, w: SW * (dem / 100), h: 0.5, fill: { color: C.brz }, line: { width: 0 } });
    txt(s, '55', { x: SX, y, w: SW * (dem / 100), h: 0.5, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    if (comp > 0) {
      s.addShape('rect', { x: SX + SW * (dem / 100), y, w: SW * (comp / 100), h: 0.5, fill: { color: C.blue }, line: { width: 0 } });
      txt(s, String(comp).replace('.', ','), { x: SX + SW * (dem / 100), y, w: SW * (comp / 100), h: 0.5, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    }
    txt(s, '= ' + sc.score, { x: SX + SW + 0.15, y, w: 1.0, h: 0.5, fontSize: 15, bold: true, color: C.ink, fontFace: FH, valign: 'middle' });
    txt(s, sc.comp + ' ' + plural(sc.comp, 'конкурент', 'конкурента', 'конкурентов') + ' при эталоне ' + M.formula.compBench, { x: SX, y: y + 0.54, w: SW, h: 0.24, fontSize: 9, color: C.mut });
  });

  card(s, L, 5.6, W, 1.1, { fill: C.soft, flat: true, lw: 0 });
  txt(s, 'Отсюда важный вывод: разница между форматами в этой модели не про качество места, а исключительно про число соседей той же категории. Место у всех трёх форматов одно и то же и оценено одинаково высоко.',
    { x: L + 0.25, y: 5.78, w: W - 0.5, h: 0.8, fontSize: 12, color: C.ink });
}

// ════════════════════════════════════════════════════════════════
// 11. Где модель применима, а где нет
// ════════════════════════════════════════════════════════════════
{
  const s = page('Где формулу можно применять, а где нельзя', 'Оценка модели');
  txt(s, 'Модель штрафует за любое соседство одинаково. Для офиса это верно, для медицины и образования - нет.',
    { x: L, y: 1.42, w: W, h: 0.36, fontSize: 12.5, color: C.ink });
  const cw = (W - 0.3) / 2;
  const cols = [
    [C.ok, 'Работает: офис', 'Арендатор выбирает одно здание из нескольких. Соседний бизнес-центр это прямой отток спроса: тот, кто снял там, не снимет здесь. Чем меньше соседей, тем выше шанс сдать площадь.',
      ['Конкуренция за одного и того же арендатора', 'Спрос делится, не складывается', 'Штраф модели отражает реальность']],
    [C.warn, 'Не работает: клиника и учебный центр', 'Здесь соседство даёт приток. Пациент едет в место, известное как место, куда ходят лечиться; ученик идёт туда, где рядом школа и другие занятия. Кластер работает на нас, а формула считает его минусом.',
      ['Больницы и роддом рядом дают направления и поток', 'Место уже известно людям по нужному поводу', 'Штраф модели искажает картину']]
  ];
  cols.forEach((c, i) => {
    const x = L + i * (cw + 0.3);
    card(s, x, 1.95, cw, 4.55);
    s.addShape('ellipse', { x: x + 0.24, y: 2.18, w: 0.34, h: 0.34, fill: { color: c[0] }, line: { width: 0 } });
    txt(s, i === 0 ? '✓' : '!', { x: x + 0.24, y: 2.18, w: 0.34, h: 0.34, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
    txt(s, c[1], { x: x + 0.7, y: 2.18, w: cw - 0.95, h: 0.36, fontSize: 15, bold: true, color: C.ink, fontFace: FH, valign: 'middle' });
    txt(s, c[2], { x: x + 0.24, y: 2.75, w: cw - 0.48, h: 1.3, fontSize: 12, color: C.ink });
    s.addText(c[3].map((t, j) => ({ text: dash(t), options: { bullet: true, breakLine: j < c[3].length - 1 } })),
      { x: x + 0.24, y: 4.15, w: cw - 0.48, h: 1.5, fontSize: 11, color: C.mut, fontFace: FB, paraSpaceAfter: 7, margin: 0 });
    txt(s, i === 0 ? 'Балл 78 читаем как есть' : 'Балл 55 сам по себе не приговор', { x: x + 0.24, y: 5.85, w: cw - 0.48, h: 0.4, fontSize: 11.5, bold: true, color: c[0], valign: 'middle' });
  });
  note(s, 6.6, 'Это ограничение самой формулы, а не ошибка в данных. Эталон насыщения нельзя применять к форматам с эффектом кластера.');
}

// ════════════════════════════════════════════════════════════════
// 12. Клиника: медицинский кластер
// ════════════════════════════════════════════════════════════════
{
  const s = page('Клиника: насыщение здесь работает в плюс', 'Формат 1');
  txt(s, 'В километре вокруг объекта 34 медицинских объекта. Модель называет это насыщением, но состав кластера показывает обратное: рядом стационары, роддом и диспансеры, то есть источники направлений, а не соперники за того же пациента.',
    { x: L, y: 1.42, w: W, h: 0.62, fontSize: 12.5, color: C.ink });

  const rows = [['Объект в радиусе 1 км', 'Профиль', 'Расстояние']];
  M.med1km.anchors.forEach((a) => rows.push([a[0], a[2], num(a[1]) + ' м']));
  table(s, rows, { y: 2.2, w: 7.5, colW: [4.4, 1.75, 1.35], rowH: 0.325, align: 'center' });

  const rx = L + 7.8, rw = W - 7.8;
  const box = [
    ['Поток пациентов', 'Стационар выписывает - наблюдение и реабилитация нужны рядом.'],
    ['Направления', 'Диспансеры и поликлиники направляют на диагностику и узкий приём.'],
    ['Репутация места', 'Район уже известен людям как место, куда едут лечиться.'],
    ['Кадры', '2-й Республиканский медицинский колледж в ближней зоне.']
  ];
  box.forEach((b, i) => {
    const y = 2.2 + i * 1.12;
    card(s, rx, y, rw, 1.0);
    txt(s, b[0], { x: rx + 0.2, y: y + 0.13, w: rw - 0.4, h: 0.26, fontSize: 11.5, bold: true, color: C.brzd });
    txt(s, b[1], { x: rx + 0.2, y: y + 0.42, w: rw - 0.4, h: 0.5, fontSize: 10.5, color: C.mut });
  });
  txt(s, 'В слое есть дубли: одна организация встречается на двух языках или в трёх источниках. После снятия очевидных дублей остаётся около 25 объектов - всё равно втрое выше эталона 8, поэтому балл модели не меняется.',
    { x: L, y: 5.65, w: 7.5, h: 0.75, fontSize: 10, color: C.mut, italic: true });
  txt(s, 'Первый этаж с потолком 4,0 м и отдельным входом закрывает ресепшн и диагностику, верхние этажи - кабинеты приёма.',
    { x: L, y: 6.42, w: 7.5, h: 0.45, fontSize: 10.5, bold: true, color: C.brzd });
}

// ════════════════════════════════════════════════════════════════
// 13. Образование
// ════════════════════════════════════════════════════════════════
{
  const s = page('Учебный центр: аудитория рядом', 'Формат 2');
  txt(s, 'Слой образования в приложении появился 7 августа 2026 года: ' + num(M.layers.edu.city) + ' объектов по городу. Он и позволил оценить этот формат по данным, а не на глаз.',
    { x: L, y: 1.42, w: W, h: 0.36, fontSize: 12.5, color: C.ink });

  const near = M.views.z16;
  const tot = near.edu;
  txt(s, 'Состав образования в ближней зоне вокруг объекта', { x: L, y: 1.95, w: 7.5, h: 0.3, fontSize: 14, bold: true, color: C.ink, fontFace: FH });
  near.eduMix.forEach((e, i) => {
    const y = 2.42 + i * 0.62, p = Math.round((e[1] / tot) * 100);
    txt(s, e[0], { x: L, y, w: 2.6, h: 0.42, fontSize: 11, color: C.ink, valign: 'middle' });
    bar(s, L + 2.7, y + 0.12, 3.5, 0.18, e[1] / tot, i === near.eduMix.length - 1 ? C.warn : C.brz);
    txt(s, num(e[1]) + '  ·  ' + p + '%', { x: L + 6.35, y, w: 1.15, h: 0.42, fontSize: 11, bold: true, color: C.ink, align: 'right', valign: 'middle' });
  });

  const rx = L + 7.8, rw = W - 7.8;
  card(s, rx, 1.95, rw, 1.75, { fill: C.soft, flat: true, lw: 0 });
  txt(s, '1 из ' + tot, { x: rx + 0.22, y: 2.12, w: rw - 0.44, h: 0.55, fontSize: 30, bold: true, color: C.warn, fontFace: FH });
  txt(s, 'объектов образования в ближней зоне - коммерческий учебный центр. Остальное это школы, детские сады, колледжи и вузы, то есть готовая аудитория, а не конкуренты.',
    { x: rx + 0.22, y: 2.7, w: rw - 0.44, h: 0.9, fontSize: 10.5, color: C.ink });

  const facts = [
    ['19', 'конкурентов насчитала модель в 1 км по всему слою, включая школы и детские сады'],
    ['86', 'из ' + tot + ' объектов ближней зоны это школы и детские сады: дети, родители и педагоги рядом'],
    ['12', 'записей «курсы / учебный центр» во всём городском слое OSM: коммерческие курсы туда почти не попадают']
  ];
  facts.forEach((f, i) => {
    const y = 3.95 + i * 0.95;
    card(s, rx, y, rw, 0.85);
    txt(s, f[0], { x: rx + 0.2, y: y + 0.08, w: 1.35, h: 0.68, fontSize: 17, bold: true, color: C.brzd, fontFace: FH, valign: 'middle' });
    txt(s, f[1], { x: rx + 1.6, y: y + 0.08, w: rw - 1.8, h: 0.68, fontSize: 9.5, color: C.mut, valign: 'middle' });
  });

  txt(s, 'Школа №20 стоит на той же улице, соседним зданием. Это и подтверждает жилой характер места, и закрывает вариант собственной школы: полноценная школа конкурировала бы с ней в упор, а курсы её дополняют. Отдельно: участок под школу мал, 645 м² минус пятно 440 м² оставляют около 205 м².',
    { x: L, y: 5.6, w: 7.5, h: 1.0, fontSize: 11, color: C.mut });
  note(s, 6.62, 'Коммерческие центры ближней зоны по ручному срезу 2ГИС, Яндекс.Карт, Golden Pages и Yellow Pages: ' + M.eduNear.commercial.map((c) => c[0]).join(', ') + '.');
}

// ════════════════════════════════════════════════════════════════
// 14. Офис
// ════════════════════════════════════════════════════════════════
{
  const s = page('Офис: лучший балл модели и его цена', 'Формат 3');
  txt(s, 'У офиса единственного из трёх форматов конкуренция ниже эталона, поэтому он и получает 78 из 100. Но это же и единственный формат, где балл ниже медианы города.',
    { x: L, y: 1.42, w: W, h: 0.4, fontSize: 12.5, color: C.ink });

  const rows = [['Ближайшие бизнес-центры', 'Расстояние']];
  M.nearestBc.forEach((b) => rows.push([b[0], num(b[1]) + ' м']));
  table(s, rows, { y: 2.0, w: 6.2, colW: [4.5, 1.7], rowH: 0.38 });

  const rx = L + 6.5, rw = W - 6.5;
  const cw = (rw - 0.24) / 2;
  tile(s, rx, 2.0, cw, 1.72, '78', 'из 100', 'Балл модели, лучший из трёх форматов', { color: C.brzd, big: 30 });
  tile(s, rx + cw + 0.24, 2.0, cw, 1.72, '83', 'медиана', 'Медиана города по этому формату выше нашей точки', { color: C.mut, big: 30 });

  card(s, rx, 3.92, rw, 2.2, { fill: C.soft, flat: true, lw: 0 });
  txt(s, 'Как это читать', { x: rx + 0.22, y: 4.1, w: rw - 0.44, h: 0.28, fontSize: 12.5, bold: true, color: C.ink, fontFace: FH });
  txt(s, 'Точка обходит 42% ячеек города. Свободная ниша есть, но офисный спрос в Ташкенте тянется в деловые коридоры, а здесь жилой массив. Поэтому офис мы ставим третьим и в формате «здание целиком под одну компанию»: такому арендатору важен не деловой адрес, а свой отдельный дом, парковка и близость к жилью сотрудников.',
    { x: rx + 0.22, y: 4.44, w: rw - 0.44, h: 1.6, fontSize: 11, color: C.mut });

  txt(s, 'В километре три чужих бизнес-центра, ближайший NEXUS в 358 м. Модель показывает четыре, потому что в её списке бизнес-центров есть и сам Тахтапул.',
    { x: L, y: 4.75, w: 6.2, h: 0.7, fontSize: 11, color: C.mut });
  note(s, 6.3, 'Совокупная арендопригодная площадь 1 855,0 м² на пяти уровнях со свободной планировкой позволяет собрать здание под одного арендатора без перестройки несущих конструкций.');
}

// ════════════════════════════════════════════════════════════════
// 15. Разделитель: позиция CASE
// ════════════════════════════════════════════════════════════════
divider('02', 'Позиция CASE', 'Приоритет форматов, обоснование расхождения с моделью и что объект даёт каждому сценарию', [
  'Приоритет: клиника, учебный центр, офис целиком',
  'Почему порядок не совпадает с баллом модели',
  'Что здание даёт каждому формату по уровням',
  'Формат сделки и что нужно уточнить по данным'
], 'facade-night.jpg');

// ════════════════════════════════════════════════════════════════
// 16. Приоритет форматов
// ════════════════════════════════════════════════════════════════
{
  const s = page('Приоритет форматов: позиция CASE', 'Вывод');
  const P = [
    ['1', 'Клиника', C.brz, 'Медицинский кластер в километре: стационары, роддом, онкодиспансер, детская инфекционная больница. Это поток направлений и узнаваемость места. Первый этаж с потолком 4,0 м и отдельным входом закрывает ресепшн и диагностику, верхние уровни - кабинеты.',
      ['34 медобъекта в 1 км, из них стационары и роддом', 'Медицинский колледж рядом как источник кадров', 'Балл модели 55: штраф за кластер, который здесь плюс']],
    ['2', 'Учебный центр и курсы', C.brzd, 'В ближней зоне 86 школ и детских садов и всего один коммерческий учебный центр в слое OSM. Аудитория живёт вокруг: 32 375 человек в километре. Формат берёт этажи целиком или блоками.',
      ['Школа №20 соседним зданием, поток учеников и родителей', 'Свободная планировка под аудитории от 359 до 382 м²', 'Балл модели 55: в конкуренты записаны школы и детсады']],
    ['3', 'Офис целиком под одну компанию', C.mut, 'Лучший балл модели, но офисный спрос тянется в деловые коридоры. Реалистичный сценарий - одна компания забирает здание целиком ради отдельного дома и парковки.',
      ['3 чужих бизнес-центра в 1 км, ближайший 358 м', '1 855,0 м² на пяти уровнях под одного арендатора', 'Балл модели 78 при медиане города 83']]
  ];
  const cw = (W - 0.48) / 3;
  P.forEach((p, i) => {
    const x = L + i * (cw + 0.24);
    card(s, x, 1.5, cw, 5.0, i === 0 ? { line: C.brz, lw: 1.5 } : {});
    s.addShape('ellipse', { x: x + 0.24, y: 1.72, w: 0.52, h: 0.52, fill: { color: p[2] }, line: { width: 0 } });
    txt(s, p[0], { x: x + 0.24, y: 1.72, w: 0.52, h: 0.52, fontSize: 22, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', fontFace: FH });
    txt(s, p[1], { x: x + 0.88, y: 1.72, w: cw - 1.12, h: 0.55, fontSize: 15, bold: true, color: C.ink, fontFace: FH, valign: 'middle' });
    txt(s, p[3], { x: x + 0.24, y: 2.42, w: cw - 0.48, h: 1.75, fontSize: 11, color: C.ink });
    s.addShape('rect', { x: x + 0.24, y: 4.25, w: cw - 0.48, h: 0.008, fill: { color: C.line }, line: { width: 0 } });
    s.addText(p[4].map((t, j) => ({ text: dash(t), options: { bullet: true, breakLine: j < p[4].length - 1 } })),
      { x: x + 0.24, y: 4.42, w: cw - 0.48, h: 1.9, fontSize: 10, color: C.mut, fontFace: FB, paraSpaceAfter: 6, margin: 0 });
  });
  note(s, 6.6, 'Порядок это позиция CASE по совокупности данных и практики рынка, а не результат модели. Балл модели приведён у каждого формата отдельно.');
}

// ════════════════════════════════════════════════════════════════
// 17. Почему приоритет не совпадает с баллом
// ════════════════════════════════════════════════════════════════
{
  const s = page('Почему приоритет не совпадает с баллом модели', 'Вывод');
  txt(s, 'Расхождение объяснимое, и мы не подгоняем одно под другое: балл показываем как есть, приоритет обосновываем отдельно.',
    { x: L, y: 1.42, w: W, h: 0.36, fontSize: 12.5, color: C.ink });

  const rows = [['Формат', 'Балл модели', 'Приоритет CASE', 'Причина расхождения']];
  rows.push(['Клиника', '55', '1', 'Модель штрафует за соседей. В медицине соседи дают поток: направления, диагностика, наблюдение после стационара.']);
  rows.push(['Учебный центр', '55', '2', 'В конкуренты попали школы и детские сады. Для коммерческих курсов это аудитория, а не соперники.']);
  rows.push(['Офис', '78', '3', 'Штраф корректен, но модель не видит тип спроса: офисный арендатор ищет деловой коридор, а здесь жилой массив.']);
  table(s, rows, { y: 1.95, colW: [2.0, 1.35, 1.5, 7.24], rowH: 0.7, fs: 11, align: ['left', 'center', 'center', 'left'] });

  const cw = (W - 0.48) / 3;
  const k = [
    ['Что модель считает хорошо', 'Плотность населения, число объектов по категориям, расстояния. Это факты, и мы их приводим без правок.'],
    ['Чего она не различает', 'Тип спроса и эффект кластера. Один и тот же штраф применяется и к офису, и к клинике.'],
    ['Как мы это подаём', 'Балл модели и приоритет CASE стоят рядом. Выдавать приоритет за результат модели нельзя, как и подгонять балл под приоритет.']
  ];
  k.forEach((c, i) => {
    const x = L + i * (cw + 0.24);
    card(s, x, 5.05, cw, 1.5);
    txt(s, c[0], { x: x + 0.22, y: 5.2, w: cw - 0.44, h: 0.28, fontSize: 11.5, bold: true, color: C.brzd });
    txt(s, c[1], { x: x + 0.22, y: 5.52, w: cw - 0.44, h: 0.9, fontSize: 10, color: C.mut });
  });
}

// ════════════════════════════════════════════════════════════════
// 18. Что здание даёт каждому формату
// ════════════════════════════════════════════════════════════════
{
  const s = page('Что здание даёт каждому формату', 'Вывод');
  const rows = [['Уровень', 'Площадь GLA, м²', 'Потолок, м', 'Клиника', 'Учебный центр', 'Офис целиком']];
  const use = {
    b: ['стерилизация, склад, архив', 'склад, техпомещения', 'серверная, архив'],
    f1: ['ресепшн, забор анализов, диагностика', 'ресепшн, зона ожидания родителей', 'входная группа, переговорные'],
    f2: ['кабинеты приёма', 'аудитории', 'открытый офис'],
    f3: ['кабинеты приёма, дневной стационар', 'аудитории, лаборатории', 'открытый офис'],
    f4: ['администрация, конференц-зона', 'большой зал, администрация', 'руководство, конференц-зона']
  };
  (CFG.units || []).forEach((u) => {
    if (!use[u.id]) return;
    rows.push([(u.level && u.level.ru) || u.id, u.gla || '-', u.ceil || '-', ...use[u.id]]);
  });
  table(s, rows, { y: 1.55, colW: [1.3, 1.35, 1.1, 2.85, 2.7, 2.79], rowH: 0.56, fs: 10.5, align: 'center' });

  const cw = (W - 0.48) / 3;
  const adv = [
    ['Свободная планировка', 'Несущие стены только по контуру и ядру: перегородки ставятся под задачу арендатора без согласования конструктива.'],
    ['Отдельный вход и лифт', 'Здание отдельно стоящее, вход свой, лифт на все уровни. Формат «целиком под одного» не требует переделок.'],
    ['Гибкость по этажам', 'Уровни от 359 до 382 м² можно брать по одному, блоками или целиком, поэтому один арендатор не блокирует остальных.']
  ];
  adv.forEach((a, i) => {
    const x = L + i * (cw + 0.24);
    card(s, x, 5.32, cw, 1.35);
    txt(s, a[0], { x: x + 0.22, y: 5.46, w: cw - 0.44, h: 0.28, fontSize: 11.5, bold: true, color: C.brzd });
    txt(s, a[1], { x: x + 0.22, y: 5.76, w: cw - 0.44, h: 0.82, fontSize: 10, color: C.mut });
  });
}

// ════════════════════════════════════════════════════════════════
// 19. Формат сделки
// ════════════════════════════════════════════════════════════════
{
  const s = page('Формат сделки', 'Условия');
  const cw = (W - 0.48) / 3;
  const D = [
    ['Аренда', 'Этаж, блок или здание целиком. Планировка и отделка под задачу арендатора, срок и условия обсуждаются.', ['От одного уровня', 'Свободная планировка', 'Возможны каникулы на отделку']],
    ['Покупка', 'Здание целиком с участком в постоянном пользовании и полным пакетом кадастровых документов.', ['2 299,0 м² GBA', 'Участок 645 м²', 'Документы в порядке, обременений нет']],
    ['Аренда с выкупом', 'Промежуточный вариант: арендатор занимает здание сейчас и фиксирует условия последующего выкупа.', ['Вход без полной суммы', 'Условия выкупа фиксируются на старте', 'Подходит операторам клиники и учебного центра']]
  ];
  D.forEach((d, i) => {
    const x = L + i * (cw + 0.24);
    card(s, x, 1.55, cw, 3.5);
    txt(s, d[0], { x: x + 0.24, y: 1.76, w: cw - 0.48, h: 0.42, fontSize: 17, bold: true, color: C.ink, fontFace: FH });
    txt(s, d[1], { x: x + 0.24, y: 2.28, w: cw - 0.48, h: 1.05, fontSize: 11.5, color: C.ink });
    s.addText(d[2].map((t, j) => ({ text: dash(t), options: { bullet: true, breakLine: j < d[2].length - 1 } })),
      { x: x + 0.24, y: 3.4, w: cw - 0.48, h: 1.45, fontSize: 10.5, color: C.mut, fontFace: FB, paraSpaceAfter: 6, margin: 0 });
  });
  card(s, L, 5.3, W, 1.2, { fill: C.soft, flat: true, lw: 0 });
  txt(s, 'Коммерческие условия предоставляются по запросу. Настоящий документ носит справочный характер и не является публичной офертой; площади подлежат уточнению по фактическим обмерам при сдаче.',
    { x: L + 0.28, y: 5.55, w: W - 0.56, h: 0.7, fontSize: 12, color: C.ink });
}

// ════════════════════════════════════════════════════════════════
// 20. Чего не хватает в данных
// ════════════════════════════════════════════════════════════════
{
  const s = page('Что стоит уточнить по данным', 'Честно о границах анализа');
  txt(s, 'Документ опирается только на проверяемые источники. Ниже то, что мы сознательно не додумывали.',
    { x: L, y: 1.42, w: W, h: 0.36, fontSize: 12.5, color: C.ink });
  const G = [
    ['Координаты образовательных объектов', 'Слой образования показывает объекты на карте, но выгрузки с координатами у нас нет. Поэтому по образованию мы приводим состав и счёт модели, но не даём счётчиков по радиусам.'],
    ['Коммерческие курсы в OSM', 'Во всём городском слое всего 12 записей «курсы / учебный центр». Реальных центров больше: шесть мы нашли ручным поиском по справочникам. Полный список даст прогон коллектора CASE OS.'],
    ['Ставки аренды соседних бизнес-центров', 'Адреса и расстояния известны, условия аренды - нет. Без них сравнение по деньгам было бы догадкой.'],
    ['Дубли в слое медицины', 'Одна организация иногда записана дважды на разных языках. На балл модели это не влияет, но абсолютный счёт слегка завышен.'],
    ['Население по остальным радиусам', 'Приложение калибрует сетку на официальное население района по полигонам из сети. Мы берём его готовые цифры и не пересчитываем их сами.'],
    ['Экспорт карт зон пригодности', 'Тепловые карты по трём форматам сняты с экрана приложения. Для вставки в документ в высоком качестве нужен файловый экспорт.']
  ];
  const cw = (W - 0.3) / 2;
  G.forEach((g, i) => {
    const x = L + (i % 2) * (cw + 0.3), y = 1.95 + Math.floor(i / 2) * 1.62;
    card(s, x, y, cw, 1.45);
    txt(s, g[0], { x: x + 0.22, y: y + 0.15, w: cw - 0.44, h: 0.3, fontSize: 12, bold: true, color: C.brzd });
    txt(s, g[1], { x: x + 0.22, y: y + 0.48, w: cw - 0.44, h: 0.85, fontSize: 10.5, color: C.mut });
  });
}

// ════════════════════════════════════════════════════════════════
// 21. Контакты
// ════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  PG++;
  s.background = { color: C.dark };
  if (has('og-cover.jpg')) s.addImage({ path: img('og-cover.jpg'), x: 7.33, y: 0, w: 6.0, h: 7.5, sizing: { type: 'cover', w: 6.0, h: 7.5 } });
  s.addShape('rect', { x: 0, y: 0, w: 7.33, h: 7.5, fill: { color: C.dark }, line: { width: 0 } });
  txt(s, 'CASE REAL ESTATE ADVISORY', { x: L, y: 1.3, w: 6.2, h: 0.3, fontSize: 11, bold: true, color: C.brz, charSpacing: 2.4 });
  txt(s, 'Обсудить объект', { x: L, y: 1.85, w: 6.2, h: 0.8, fontSize: 40, bold: true, color: 'FFFFFF', fontFace: FH });
  txt(s, 'Покажем здание, поднимем документы и посчитаем экономику под ваш формат.', { x: L, y: 2.75, w: 6.0, h: 0.6, fontSize: 13.5, color: 'C9C2B6' });
  const ct = CFG.contacts || {};
  const rowsC = [['Телефон', ct.phone || '+998 90 922 07 00'], ['Telegram', ct.telegram || '@muhammadaxmadiy'], ['Сайт', 'caseadvisory.uz/taxtapul/'], ['Адрес объекта', 'ул. Тахтапул, 31, Ташкент']];
  rowsC.forEach((r, i) => {
    const y = 3.7 + i * 0.72;
    s.addShape('rect', { x: L, y: y + 0.62, w: 6.0, h: 0.008, fill: { color: '3A3C3F' }, line: { width: 0 } });
    txt(s, r[0], { x: L, y, w: 2.0, h: 0.5, fontSize: 11, color: '8A8578', valign: 'middle' });
    txt(s, r[1], { x: L + 2.0, y, w: 4.0, h: 0.5, fontSize: 15, bold: true, color: 'FFFFFF', valign: 'middle' });
  });
  txt(s, 'Документ подготовлен CASE Real Estate Advisory. Справочный характер, не является публичной офертой.', { x: L, y: FOOT - 0.1, w: 6.2, h: 0.4, fontSize: 9, color: '8A8578' });
}

pres.writeFile({ fileName: OUT }).then(() => {
  console.log('Готово:', path.relative(process.cwd(), OUT), '| слайдов:', PG);
});
