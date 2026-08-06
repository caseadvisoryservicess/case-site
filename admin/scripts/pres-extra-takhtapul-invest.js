/**
 * Дополнительные страницы русской брошюры Тахтапула: геоаналитика и выбор
 * формата. Модуль подключается к scripts/gen-presentation.js переменной
 * CASE_PRES_EXTRA и дописывает страницы со сквозной нумерацией. Получается
 * ОДИН файл: наша основная презентация с лендинга плюс инвесторская часть.
 *
 * Источник цифр окружения - собственная геобаза CASE Tashkent Geo Master
 * (3 292 объекта: 148 бизнес-центров, 1 530 медучреждений, 1 027 аптек,
 * 545 махаллей). Считает scripts/geo-block-takhtapul.js, результат лежит в
 * data/projects/takhtapul/geo-invest.json.
 *
 * Скоринг берём из приложения CASE OS Geo Analytics (скриншоты владельца,
 * 2026-08-06), а не считаем сами. По точке Тахтапула приложение даёт:
 *   офис    78/100 (медиана города 84), конкурентов в 1 км 4
 *   клиника 55/100 (медиана города 55), конкурентов в 1 км 33
 *   жителей в 1 км 32 375, эталон спроса 25 000, эталон конкуренции 8
 * Формула приложения сверена вручную и сходится ровно:
 *   0,55 x min(1, 32375/25000) + 0,45 x max(0, 1 - конкуренты/8).
 * Спрос упирается в потолок модели, поэтому разницу между форматами задаёт
 * только конкуренция, а разрыв офиса и клиники - ровно 23 балла.
 *
 * ОБРАЗОВАНИЕ. В модели приложения этого формата нет, а слой «Образование»
 * на карте читает data/tashkent_education.json, которого пока не существует:
 * его делает связка geo_collector.php --category=education -> geo_education_export.php,
 * и запускать её надо на сервере с ключами карт. Поэтому здесь адресный срез,
 * собранный вручную по 2ГИС, Яндекс.Картам, Golden Pages, Yellow Pages и
 * Top.uz. Счётчиков «столько-то в радиусе 3 км» по образованию НЕ даём и
 * координат не выдумываем: у школы №20 справочники расходятся даже в номере
 * дома (19 и 26), поэтому в документе стоит только улица.
 *
 * Сборка:
 *   cd admin
 *   node scripts/geo-block-takhtapul.js
 *   CASE_PRES_EXTRA=scripts/pres-extra-takhtapul-invest.js \
 *   CASE_PRES_LANGS=ru CASE_PRES_OUT=invest-ru.pdf \
 *   node scripts/gen-presentation.js takhtapul
 */
'use strict';
const fs = require('fs');
const path = require('path');

const GEO_FILE = path.join(__dirname, '..', 'data', 'projects', 'takhtapul', 'geo-invest.json');
if (!fs.existsSync(GEO_FILE)) {
  throw new Error('Нет data/projects/takhtapul/geo-invest.json - сначала запустите node scripts/geo-block-takhtapul.js');
}
const GEO = JSON.parse(fs.readFileSync(GEO_FILE, 'utf8'));

const C1 = GEO.counts[1000];
// разбивка медицины в 1 км по направлениям приложения, в процентах
const pct = (n, total) => Math.round((n / total) * 100);
const MED_MIX = GEO.medMix.slice(0, 6).map((m) => [m.l, m.n, pct(m.n, C1.med)]);

// ── выгрузка приложения CASE OS Geo Analytics по точке (владелец, 2026-08-06) ──
// Авторитетный источник по скорингу: приложение считает по своей модели зон
// пригодности (сетка 400 м, 2 579 ячеек) и по своему слою медицины (OSM +
// clinics.uz), который чуть шире нашей геобазы.
// Формула: 0,55 x min(1, население 1 км / 25 000) + 0,45 x max(0, 1 - конкуренты / 8).
// Сверено вручную: 4 конкурента -> 78 баллов, 33 -> 55 баллов, сходится ровно.
// ГЛАВНОЕ: отсюда откалиброванное население по точке - 32 375 человек в 1 км.
// Раньше его не было, и абсолютные баллы посчитать было не на чем.
const OS = {
  pop1km: 32375,
  benchPop: 25000,
  benchComp: 8,
  bc: { score: 78, median: 84, comp: 4 },
  med: { score: 55, median: 55, comp: 33 }
};
const GAP = OS.bc.score - OS.med.score;
const gnum = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ── образовательный слой ──
// В геобазе CASE его нет: категории TAX-021..024 объявлены, но объекты не
// выгружены. Собрано вручную по открытым справочникам 2026-08-06 через
// веб-поиск: 2ГИС, Яндекс.Карты, Golden Pages, Yellow Pages, Top.uz.
// ВАЖНО: это первый срез по адресам, а не геокодированная выгрузка. Точные
// счётчики по радиусу 3 км даст только прогон коллектора CASE OS
// (os/api/geo_collector.php, категория education) с ключами карт.
const EDU = {
  schools: [
    ['Средняя школа №20', 'ул. Тахтапул', 'та же улица'],
    ['Средняя школа №34', 'ж/м Бешагач, 10Б', ''],
    ['Средняя школа №10', 'ул. Лабзак, 105', ''],
    ['Invento The Uzbek International School', 'Малая кольцевая, 2', '']
  ],
  kinder: [
    ['Детский сад', 'ул. Заркайнар, 17'],
    ['Детский сад №76', 'Лабзакский проезд, 21а'],
    ['Детский сад', 'ул. Курганча, 7']
  ],
  centres: [
    ['NOBELIS', 'ул. Зульфияхонум, 14'],
    ['ALPHA EDUCATION', 'ул. Зульфияхонум, 12'],
    ['PDP Academy', 'проспект Беруни, 3А'],
    ['Free Study', 'ул. Алишера Навои, 24'],
    ['Everest', 'ул. Бирлик, 78'],
    ['101%', 'Жангох даха, 26']
  ],
  districtCentres: { gp: 63, dgis: 160 }
};

// ── приоритет форматов: позиция CASE ──
// Владелец 2026-08-06: порядок такой - клиника, учебное заведение, офис
// (офис скорее всего целиком под одну компанию). Он расходится с сырым баллом
// модели, где офис 78 против клиники 55, и это НЕ ошибка ни того, ни другого:
// модель одинаково штрафует за любое соседство, а в медицине соседство даёт
// приток. Поэтому в документе показываем и балл модели, и приоритет CASE,
// и прямо объясняем, откуда расхождение. Выдавать приоритет за результат
// модели нельзя, как и молча подгонять балл под приоритет.
const PRIORITY = [
  {
    n: 1, h: 'Клиника, медцентр', score: `${'' /* заполняется ниже */}`,
    key: 'med'
  },
  { n: 2, h: 'Учебный центр и курсы', key: 'edu' },
  { n: 3, h: 'Офис целиком под одну компанию', key: 'bc' }
];

// ── карты из приложения CASE OS ──
// Подложку с улицами из среды сборки не снять: тайлы OSM, 2ГИС и Яндекса
// закрыты прокси (проверено, CONNECT отдаёт 403). Поэтому карты кладём
// картинками: владелец делает скриншот в приложении и кладёт файл в uploads
// проекта. Как только файл появился - страница карты собирается сама, без
// правок кода. Пока файлов нет, работает наша SVG-схема.
const UP_DIR = path.join(__dirname, '..', 'data', 'projects', 'takhtapul', 'uploads');
const MAP_DEFS = [
  { file: 'caseos-map.jpg', h: 'Окружение объекта на карте',
    c: 'Медицина и бизнес-центры вокруг Тахтапула, кольца 1, 3 и 5 км. Экспорт из приложения CASE OS Geo Analytics.' },
  { file: 'caseos-heat-bc.jpg', h: 'Зоны пригодности: офис',
    c: 'Модель зон пригодности приложения, сетка 400 м. Зелёное - людей много, конкурентов мало; красное - наоборот. Балл площадки 78 из 100.' },
  { file: 'caseos-heat-med.jpg', h: 'Зоны пригодности: клиника',
    c: 'Та же модель для медицинского формата. Балл площадки 55 из 100 при медиане города 55.' }
];
const MAPS = MAP_DEFS.filter((m) => fs.existsSync(path.join(UP_DIR, m.file)));

const GEO_COL = { med: '#c0392b', medx: '#e08a80', bc: '#2f6fb0', ph: '#1e8f5e', mh: '#8a6bbf', x: '#9aa0a6' };
// Показываем только те слои, которые действительно конкурируют с оцениваемыми
// форматами. Аптеки и махаллинские центры владелец попросил убрать: они не
// конкуренты ни офису, ни клинике и только зашумляют схему и таблицу.
const SHOW = ['med', 'medx', 'bc'];


const SECTIONS = {
  about: {
    n: '01', h: 'Здание', s: 'Что это за объект и что в нём есть', img: 'facade-vertical-dusk.jpg',
    list: ['Пять уровней: подвал и четыре этажа', 'Площади по государственному кадастру', 'Планировки всех уровней']
  },
  cases: {
    n: '02', h: 'Формат сделки', s: 'Кому подходит здание и на каких условиях', img: 'hero-dusk.jpg',
    list: ['Сценарии использования: под кого нарезается здание', 'Аренда, покупка, аренда с последующим выкупом']
  },
  loc: {
    n: '03', h: 'Локация', s: 'Где стоит здание и что вокруг', img: 'aerial-night.jpg',
    list: ['Улица Тахтапул, 31, Шайхантахурский район', 'Доступность и окружение']
  },
  viz: {
    n: '04', h: 'Облик здания', s: 'Как выглядит объект', img: 'facade-night.jpg',
    list: ['Визуализации фасада и окружения', 'Ход строительных работ']
  },
  geo: {
    n: '05', h: 'Геоаналитика и выбор формата', s: 'Что говорят данные об окружении объекта и какой формат для него сильнее', img: '',
    list: ['Окружение в радиусе до 3 км по геобазе CASE', 'Конкурентная среда: кто уже работает рядом', 'Сравнение форматов: офис, клиника, образование', 'Чего в данных не хватает и как это закрыть']
  }
};

// 4 титульных листа основной брошюры + 5 страниц инвесторской части + карты,
// если владелец положил скриншоты приложения в uploads
const count = 4 + 5 + MAPS.length;

function dividerPage(ctx, key, right) {
  const { esc, img64, BRONZE, DARK, CODE, nextPg, TOTAL } = ctx;
  const S = SECTIONS[key];
  const rightHtml = right || (S.img ? `<img src="${img64(S.img)}" style="width:100%;height:100%;object-fit:cover">` : '');
  return `
<div class="pg" style="padding:0;background:${DARK};color:#fff;flex-direction:row">
  <div style="flex:1.15;padding:20mm 14mm 16mm 18mm;display:flex;flex-direction:column;justify-content:center;position:relative">
    <div style="font-size:44pt;font-weight:800;letter-spacing:-.03em;color:${BRONZE};line-height:1">${S.n}</div>
    <div style="font-size:30pt;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin-top:4mm">${esc(S.h)}</div>
    <div style="font-size:12pt;color:rgba(255,255,255,.72);margin-top:4mm;line-height:1.45;max-width:120mm">${esc(S.s)}</div>
    <div style="height:.5pt;background:rgba(255,255,255,.22);margin:9mm 0 7mm;max-width:120mm"></div>
    ${S.list.map((x) => `<div style="font-size:10pt;line-height:1.5;color:rgba(255,255,255,.82);padding-left:5mm;position:relative;margin-bottom:3mm;max-width:120mm">
      <span style="position:absolute;left:0;top:1.9mm;width:2mm;height:2mm;border-radius:50%;background:${BRONZE};display:block"></span>${esc(x)}</div>`).join('')}
    <div style="position:absolute;left:18mm;right:14mm;bottom:8mm;display:flex;justify-content:space-between;gap:6mm;font-size:8pt;color:rgba(255,255,255,.45)">
      <span><b style="color:#fff;letter-spacing:.08em">${esc(CODE)}</b> · ${esc(ctx.addr)}</span>
      <span>${nextPg()} / ${TOTAL}</span>
    </div>
  </div>
  <div style="flex:.85;position:relative;overflow:hidden;background:rgba(255,255,255,.05)">${rightHtml}</div>
</div>`;
}

function divider(key, ctx) {
  return SECTIONS[key] && key !== 'geo' ? dividerPage(ctx, key) : '';
}

function html(ctx) {
  const { esc, BRONZE, INK, MUTED, BG, DARK, ACC_RGB, foot } = ctx;

  const kpi = (k, v, s) => `<div class="ikpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const ul = (arr) => `<ul class="ix">${arr.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  // тысячи разделяем пробелом, как во всех наших документах
  const gn = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  // ── схема окружения ──
  // Подложки-карты здесь нет: тайлы Яндекса и Google из среды сборки
  // недоступны. Чтобы схема читалась как карта, а не как россыпь точек,
  // добавлены север, масштабная линейка, подпись объекта и подписанные
  // ближайшие бизнес-центры.
  const scheme = (S) => {
    const R = GEO.maxRing, k = (S / 2 - 26) / R, c = S / 2;
    const px = (p) => [c + p.x * k, c - p.y * k];
    const dots = GEO.points.filter((p) => p.d <= R && SHOW.includes(p.c)).map((p) => {
      const [x, y] = px(p);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.c === 'bc' ? 3.2 : 2.4}" fill="${GEO_COL[p.c]}" fill-opacity="${p.c === 'bc' ? 1 : .78}" stroke="#fff" stroke-width=".6"/>`;
    }).join('');
    const rings = [500, 1000, 2000, 3000].map((m) =>
      `<circle cx="${c}" cy="${c}" r="${(m * k).toFixed(1)}" fill="none" stroke="rgba(0,0,0,.24)" stroke-width=".7" stroke-dasharray="3 3"/>` +
      (m >= 1000 ? `<text x="${c}" y="${(c - m * k + 9).toFixed(1)}" text-anchor="middle" font-size="7" font-family="system-ui" fill="#666">${m / 1000} км</text>` : '')).join('');
    // подписи трёх ближайших бизнес-центров: главный конкурент офисного формата
    const named = GEO.nearestBc.slice(0, 3).map((b) => {
      const pt = GEO.points.find((p) => p.c === 'bc' && p.d === b.d);
      if (!pt) return '';
      const [x, y] = px(pt);
      const right = x >= c;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.2" fill="none" stroke="${GEO_COL.bc}" stroke-width="1.1"/>
        <text x="${(x + (right ? 7 : -7)).toFixed(1)}" y="${(y + 2.6).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" font-size="6.6" font-family="system-ui" font-weight="700" fill="${GEO_COL.bc}">${esc(b.n)}</text>`;
    }).join('');
    const scaleM = 1000, scalePx = scaleM * k;
    return `<svg viewBox="0 0 ${S} ${S}" style="width:100%;height:auto;display:block">
      ${rings}${dots}${named}
      <circle cx="${c}" cy="${c}" r="5.5" fill="${BRONZE}" stroke="#fff" stroke-width="2"/>
      <text x="${c}" y="${c + 16}" text-anchor="middle" font-size="7.4" font-weight="800" font-family="system-ui" fill="${INK}">Тахтапул, 31</text>
      <g transform="translate(${S - 20} 18)">
        <path d="M0 12 L0 -6 M-3.5 -2 L0 -6 L3.5 -2" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="0" y="21" text-anchor="middle" font-size="6.4" font-family="system-ui" font-weight="700" fill="${INK}">С</text>
      </g>
      <g transform="translate(14 ${S - 14})">
        <line x1="0" y1="0" x2="${scalePx.toFixed(1)}" y2="0" stroke="${INK}" stroke-width="1.1"/>
        <line x1="0" y1="-3" x2="0" y2="3" stroke="${INK}" stroke-width="1.1"/>
        <line x1="${scalePx.toFixed(1)}" y1="-3" x2="${scalePx.toFixed(1)}" y2="3" stroke="${INK}" stroke-width="1.1"/>
        <text x="${(scalePx / 2).toFixed(1)}" y="-5" text-anchor="middle" font-size="6.4" font-family="system-ui" fill="${INK}">1 км</text>
      </g>
    </svg>`;
  };
  const legend = [['med', 'медицина'], ['bc', 'бизнес-центры']]
    .map(([c, l]) => `<span style="display:inline-flex;align-items:center;gap:1.6mm;margin-right:6mm;font-size:8.5pt;color:${MUTED}">
      <i style="width:2.4mm;height:2.4mm;border-radius:50%;background:${GEO_COL[c]};display:inline-block"></i>${l}</span>`).join('');

  const radRow = (label, key) => `<tr><td>${label}</td>` +
    [500, 1000, 1500, 3000].map((r) => `<td class="n">${GEO.counts[r][key]}</td>`).join('') + '</tr>';

  // ── карточка формата ──
  // Одной шкалой «свободна ниша» тут обойтись нельзя: для офиса сосед-конкурент
  // это минус, а для медцентра чаще плюс (кластер даёт поток и направления).
  // Поэтому у каждого формата отдельно данные и отдельно их трактовка.
  const chip = (text, colour, solid) => `<span style="align-self:flex-start;font-size:7.5pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
    padding:1.6mm 3mm;border-radius:2mm;background:${solid ? colour : 'rgba(0,0,0,.05)'};color:${solid ? '#fff' : MUTED}">${text}</span>`;
  const fmtCard = (colour, title, chipEl, data, read) => `
    <div class="fmt" style="border-top:1.6mm solid ${colour}">
      <h4>${title}</h4>
      ${chipEl}
      <div class="m"><b style="color:${INK}">Данные:</b> ${data}</div>
      <div class="m"><b style="color:${INK}">Как читать:</b> ${read}</div>
    </div>`;

  const CSS = `<style>
  .ilbl{display:inline-block;font-size:8.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${BRONZE};margin-bottom:5mm}
  .ih{font-size:23pt;font-weight:800;letter-spacing:-.01em;line-height:1.15;margin-bottom:6mm}
  .ih3{font-size:12pt;font-weight:800;margin-bottom:3mm}
  .icard{background:#fff;border-radius:4mm;padding:6mm 7mm}
  .icard.acc{background:rgba(${ACC_RGB},.1)}
  .itwo{display:grid;grid-template-columns:1fr 1fr;gap:7mm;flex:1;min-height:0}
  .ikpi{background:#fff;border-radius:4mm;padding:5.5mm;display:flex;flex-direction:column;justify-content:center}
  .ikpi .k{font-size:8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRONZE}}
  .ikpi .v{font-size:24pt;font-weight:800;letter-spacing:-.02em;margin-top:2mm}
  .ikpi .s{font-size:8.5pt;color:${MUTED};margin-top:1.5mm;line-height:1.35}
  ul.ix{list-style:none}
  ul.ix li{font-size:10pt;line-height:1.5;margin-bottom:2.6mm;padding-left:5mm;position:relative}
  ul.ix li::before{content:'';position:absolute;left:0;top:2mm;width:2mm;height:2mm;border-radius:50%;background:${BRONZE}}
  .itab{border-collapse:collapse;width:100%;background:#fff;border-radius:4mm;overflow:hidden}
  .itab th{text-align:left;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};padding:4mm 5mm 3mm;border-bottom:.5pt solid #ddd}
  .itab td{padding:3.4mm 5mm;font-size:10.5pt;border-bottom:.4pt solid #eee}
  .itab tr:last-child td{border-bottom:none}
  .itab td.n,.itab th.n{text-align:right;font-weight:800;white-space:nowrap}
  .itab th.n{font-weight:700}
  .inote{font-size:8pt;color:${MUTED};line-height:1.5}
  .idark{background:${DARK};color:#fff}
  .idark .ih{color:#fff}
  .ibox{background:rgba(255,255,255,.07);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:5.5mm 6.5mm}
  .fmt{background:#fff;border-radius:4mm;padding:5mm 5.5mm;display:flex;flex-direction:column;gap:2.5mm}
  .why{background:#fff;border-radius:3mm;padding:4mm 4.2mm}
  .why h4{font-size:9.5pt;font-weight:800;margin-bottom:2.2mm}
  .why p{font-size:8pt;line-height:1.4;color:${MUTED};margin-bottom:2mm}
  .why p:last-child{margin-bottom:0}
  .fmt h4{font-size:11pt;font-weight:800}
  .fmt .m{font-size:8.5pt;color:${MUTED};line-height:1.45}
  </style>`;

  return `${CSS}

${dividerPage(ctx, 'geo', `<div style="height:100%;padding:18mm 12mm;display:flex;flex-direction:column;justify-content:center;gap:5mm">
  <div style="font-size:8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRONZE}">Балл площадки, CASE OS Geo Analytics</div>
  ${[[`${OS.bc.score}`, 'Офис, бизнес-центр', `медиана города ${OS.bc.median}`],
     [`${OS.med.score}`, 'Клиника, медцентр', `медиана города ${OS.med.median}`]]
    .map(([v, s2, s3]) => `<div class="ibox">
      <div style="display:flex;align-items:baseline;gap:2.5mm">
        <div style="font-size:30pt;font-weight:800;letter-spacing:-.02em">${v}</div>
        <div style="font-size:11pt;color:rgba(255,255,255,.55)">/ 100</div>
      </div>
      <div style="font-size:10pt;font-weight:700;margin-top:1.5mm">${s2}</div>
      <div style="font-size:8.5pt;color:rgba(255,255,255,.6);margin-top:1mm">${s3}</div></div>`).join('')}
  <div style="font-size:8pt;color:rgba(255,255,255,.5);line-height:1.5">Жителей в радиусе 1 км - ${gnum(OS.pop1km)}. Спрос упирается в верхнюю границу модели, поэтому разницу между форматами задаёт только конкуренция.</div>
</div>`)}

${MAPS.map((m) => `
<!-- карта из приложения: ${m.file} -->
<div class="pg">
  <span class="ilbl">Геоаналитика</span>
  <div class="ih">${esc(m.h)}</div>
  <div style="flex:1;min-height:0;border-radius:4mm;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center">
    <img src="${ctx.img64(m.file)}" style="width:100%;height:100%;object-fit:contain">
  </div>
  <div class="inote" style="margin-top:4mm">${esc(m.c)}</div>
  ${foot()}
</div>`).join('')}

<!-- окружение в цифрах -->
<div class="pg">
  <span class="ilbl">Геоаналитика</span>
  <div class="ih">Окружение объекта в цифрах</div>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:.95;display:flex;flex-direction:column;min-height:0">
      <div class="icard" style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:5mm">
        ${scheme(300)}
      </div>
      <div style="margin-top:3mm">${legend}</div>
    </div>
    <div style="flex:1.1;display:flex;flex-direction:column;gap:5mm;min-height:0">
      <table class="itab">
        <tr><th>Что вокруг</th><th class="n">500 м</th><th class="n">1 км</th><th class="n">1,5 км</th><th class="n">3 км</th></tr>
        ${radRow('Медицина, всего', 'med')}
        ${radRow('в том числе профильные конкуренты', 'comp')}
        ${radRow('Бизнес-центры', 'bc')}
      </table>
      <div class="icard acc" style="font-size:9.5pt;line-height:1.5">
        <b>Что это за место.</b> В радиусе одного километра живёт ${gn(OS.pop1km)} человек - это выше верхней границы модели CASE OS (${gn(OS.benchPop)}), то есть спроса на площадке заведомо достаточно под любой из форматов. Плотная центральная застройка Шайхантахура: ${C1.med} медицинских объектов и ${C1.bc} бизнес-центра в том же километре.
      </div>
      <div class="inote">Источник: слои приложения CASE OS Geo Analytics - те же, по которым приложение считает балл площадки: медицина по OSM и clinics.uz (1 530 объектов по городу), бизнес-центры (151). Профильными конкурентами клиники приложение считает больницы, поликлиники, частные центры, врачебные практики и лаборатории; стоматологии и узкие профили в этот счёт не входят. На схеме ${GEO.total} объекта в радиусе 3 км. Сверено с карточкой точки в приложении: на 1 км сходится ровно.</div>
    </div>
  </div>
  ${foot()}
</div>

<!-- конкурентная среда -->
<div class="pg">
  <span class="ilbl">Геоаналитика</span>
  <div class="ih">Конкурентная среда: кто уже работает рядом</div>
  <div class="itwo">
    <div style="display:flex;flex-direction:column;gap:5mm;min-height:0">
      <div class="icard">
        <div class="ih3">Офисы: ниша не занята</div>
        <table class="itab" style="background:transparent">
          ${GEO.nearestBc.slice(0, 5).map((b) => `<tr><td style="padding:2.4mm 0">${esc(b.n)}</td><td class="n" style="padding:2.4mm 0">${gn(b.d)} м</td></tr>`).join('')}
        </table>
        <div class="inote" style="margin-top:2.5mm">По слою приложения. В радиусе 1 км ${C1.bc}, в 3 км ${GEO.counts[3000].bc}. Модель считает на один больше: в её списке есть и сам Тахтапул.</div>
      </div>
      <div class="icard acc">
        <div class="ih3">Медицина: структура ${C1.med} объектов в 1 км</div>
        <table class="itab" style="background:transparent">
          ${MED_MIX.map(([l, n, p]) => `<tr>
            <td style="padding:2.2mm 0">${l}</td>
            <td class="n" style="padding:2.2mm 0">${n}</td>
            <td class="n" style="padding:2.2mm 0;color:${BRONZE};width:16mm">${p}%</td></tr>`).join('')}
        </table>
        <div class="inote" style="margin-top:2.5mm">Профильные конкуренты - ${C1.comp} объекта, ${pct(C1.comp, C1.med)}% медицины. Больницы и роддом дают направления, а не конкуренцию.</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5mm;min-height:0">
      <div class="icard">
        <div class="ih3">Образование: что рядом</div>
        <table class="itab" style="background:transparent">
          ${EDU.schools.map(([n, a, tag]) => `<tr>
            <td style="padding:1.8mm 0;font-size:9pt">${esc(n)}${tag ? ` <b style="color:${BRONZE}">- ${tag}</b>` : ''}</td>
            <td class="n" style="padding:1.8mm 0;font-size:9pt;font-weight:400;color:${MUTED}">${esc(a)}</td></tr>`).join('')}
        </table>
        <div class="inote" style="margin-top:2.5mm">Учебные центры рядом: ${EDU.centres.map(([n]) => esc(n)).join(', ')}. Детские сады: ${EDU.kinder.length} в шаговой доступности.</div>
      </div>
      <div class="icard acc">
        <div class="ih3">Как читать эти числа</div>
        ${ul(['Медицина и бизнес-центры - из слоёв приложения CASE OS, то есть ровно те данные, по которым посчитан балл площадки.',
              `Образование собрано по 2ГИС, Яндекс.Картам, Golden Pages, Yellow Pages и Top.uz: по району ${EDU.districtCentres.gp} учебных центров по Golden Pages и ${EDU.districtCentres.dgis} организаций категории по 2ГИС. Справочники классифицируют по-разному, поэтому приведены обе цифры.`,
              'Считаем объекты, а не их выручку: справочник знает, что объект есть, но не знает, насколько он загружен.'])}
      </div>
    </div>
  </div>
  ${foot()}
</div>

<!-- приоритет форматов -->
<div class="pg">
  <span class="ilbl">Выбор формата</span>
  <div class="ih">Приоритет CASE по этой площадке</div>
  <table class="itab">
    <tr><th style="width:8mm"></th><th>Формат</th><th class="n">Балл модели</th><th class="n">Конкурентов в 1 км</th><th>Что решает</th></tr>
    <tr>
      <td class="n" style="font-size:14pt;color:${BRONZE}">1</td>
      <td><b>Клиника, медцентр</b></td>
      <td class="n">${OS.med.score} / 100</td>
      <td class="n">${C1.comp}</td>
      <td>Кластер: больницы и роддом рядом дают поток</td>
    </tr>
    <tr>
      <td class="n" style="font-size:14pt;color:${BRONZE}">2</td>
      <td><b>Учебный центр и курсы</b></td>
      <td class="n" style="color:${MUTED}">нет в модели</td>
      <td class="n">${EDU.districtCentres.gp} по району</td>
      <td>Школа на той же улице и ${gnum(OS.pop1km)} жителей в километре</td>
    </tr>
    <tr>
      <td class="n" style="font-size:14pt;color:${BRONZE}">3</td>
      <td><b>Офис целиком под одну компанию</b></td>
      <td class="n">${OS.bc.score} / 100</td>
      <td class="n">${C1.bc}</td>
      <td>Ниша свободна, но спрос уже разобран соседями</td>
    </tr>
  </table>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:6mm;flex:1;min-height:0;align-content:start">
    <div class="why" style="border-top:1.4mm solid #c0392b">
      <h4>1. Клиника</h4>
      <p>${C1.comp} профильных соседей в километре, а рядом больницы и роддом. Поток пациентов в район уже идёт: направления, диагностика, послеоперационное наблюдение.</p>
      <p>Место известно людям как место, куда ходят лечиться, - новому центру не надо формировать поток с нуля. Планировки позволяют: этажи 371,5 м², отдельный вход, потолки 3,6 м.</p>
    </div>
    <div class="why" style="border-top:1.4mm solid #7a6a3f">
      <h4>2. Учебный центр и курсы</h4>
      <p>Школа №20 на той же улице Тахтапул, рядом детские сады, вокруг жилой массив - ${gnum(OS.pop1km)} человек в радиусе километра. Поток учеников и родителей уже здесь.</p>
      <p>По району ${EDU.districtCentres.gp} учебных центров по Golden Pages и ${EDU.districtCentres.dgis} организаций категории по 2ГИС - спрос сформирован. Этажи без несущих стен режутся на аудитории.</p>
    </div>
    <div class="why" style="border-top:1.4mm solid #2f6fb0">
      <h4>3. Офис целиком под одну компанию</h4>
      <p>Формально лучший балл модели - ${OS.bc.score} из 100: бизнес-центров рядом мало, ${C1.bc} в километре.</p>
      <p>Но поштучная нарезка конкурирует с NEXUS, Alpha и «Бизнес центром» рядом. Сильный сценарий один: здание целиком под штаб-квартиру - его соседи закрыть не могут.</p>
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Балл модели CASE OS: 0,55 x спрос + 0,45 x (1 - конкуренты / ${OS.benchComp}), спрос = жители 1 км / ${gnum(OS.benchPop)}. Жителей ${gnum(OS.pop1km)}, спрос упирается в потолок, поэтому балл задаёт только конкуренция. Приоритет CASE отличается от порядка баллов сознательно: модель штрафует за любое соседство, а в медицине соседство работает на приток. Образовательного формата в модели нет.</div>
  ${foot()}
</div>

<!-- вывод -->
<div class="pg">
  <span class="ilbl">Вывод</span>
  <div class="ih">Что данные говорят о Тахтапуле</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5mm">
    ${kpi('Жителей в 1 км', gnum(OS.pop1km), `выше верхней границы модели (${gnum(OS.benchPop)}): спроса достаточно под любой формат`)}
    ${kpi('Медицина в 1 км', `${C1.comp}`, 'профильных центров плюс больницы и роддом: сложившийся кластер')}
    ${kpi('Бизнес-центры в 1 км', `${C1.bc}`, 'ниша свободна, но лоты мелкие')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Приоритет CASE</div>
      ${ul([`<b>1. Клиника.</b> ${C1.comp} профильных соседей и больницы с роддомом рядом означают готовый поток пациентов. Формат сильнее всего именно из-за плотности, а не вопреки ей.`,
            `<b>2. Учебный центр и курсы.</b> Школа на той же улице, детские сады рядом, ${gnum(OS.pop1km)} жителей в километре. Здание режется на аудитории без переделки конструктива.`,
            '<b>3. Офис целиком под одну компанию.</b> Ниша свободна, но поштучная нарезка проигрывает соседям. Работает сценарий штаб-квартиры на всё здание.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Почему приоритет не совпадает с баллом модели</div>
      ${ul([`Модель даёт офису ${OS.bc.score}, клинике ${OS.med.score}: она вычитает баллы за каждого соседа.`,
            'Для офиса это верно - арендатор выбирает одно здание из нескольких. Для медицины наоборот: пациент едет в медицинский район, и соседство даёт приток, а не отток.',
            'Поэтому балл модели мы приводим как есть, а приоритет ставим с поправкой на кластерный эффект. Это оценка CASE, а не результат формулы.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Источники: слои приложения CASE OS Geo Analytics (медицина OSM и clinics.uz, бизнес-центры, сетка населения Kontur, откалиброванная на официальное население района) и адресный срез по образованию из 2ГИС, Яндекс.Карт, Golden Pages, Yellow Pages и Top.uz. Геоаналитика описывает окружение и не заменяет финансовую модель: доходность формата считается отдельно.</div>
  ${foot()}
</div>
`;
}

module.exports = { count, html, divider };
