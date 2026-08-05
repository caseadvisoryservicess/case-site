/**
 * Дополнительные страницы русской брошюры Botanica: инвестиционная часть.
 *
 * Модуль подключается к scripts/gen-presentation.js переменной окружения
 * CASE_PRES_EXTRA и дописывает свои страницы в конец документа со сквозной
 * нумерацией. Получается ОДИН файл: наша основная презентация проекта плюс всё,
 * что прислал владелец 2026-07-30.
 *
 * Источники (оба файла владельца, ничего не выброшено):
 *   1. Botanica_Ozon_Investment_Presentation.pdf - 7 слайдов:
 *      executive summary (вход 1 360 $/м² с НДС, выход 2 500 $/м² в 3 кв. 2027
 *      после кадастра, ROI 83,8% за цикл около 14 месяцев, валовая доходность
 *      22,05% при ставке 25 $/м² в месяц), макроконтекст рынка (сток классов A
 *      и B 665 тыс. м² без трёх башен Tashkent City более 220 тыс. м², рост с
 *      210 тыс. м² в 2021 году, ввод 192 тыс. м² в 2025, поглощение 79 тыс. м²,
 *      четыре причины входить сейчас), боли арендаторов по опросу AmCham против
 *      ответа Botanica, стратегия 1 (капитализация, прибыль 1 140 $/м²,
 *      IRR 65-70%), стратегия 2 (аренда, 300 $/м² в год, окупаемость 4,5 года),
 *      синергия для Ozon как стратегического партнёра (четыре пункта).
 *   2. Tashkent_Development_Ecosystem_V2 - плакат «Стратегия девелопмента:
 *      Ташкент»: игровое поле из 40 клеток, панель рынка (офисный сток около
 *      520 тыс. м², торговые площади 478,5 тыс. м² плюс 73% за год, ставка
 *      класса A 32-34 $/м² в месяц, вакантность класса A до 58%, стрит-ритейл
 *      26-28 $/м², рост коворкингов с нулевой вакансией), шесть ключевых
 *      стейкхолдеров, кривая жизненного цикла с множителем стоимости и текст
 *      про адаптацию к рынку Ташкента. Поле воспроизведено целиком в нашей
 *      палитре и стоит последней страницей, как просил владелец.
 *
 * Цены здесь есть, поэтому файл собирается отдельно (invest-ru.pdf) и НЕ
 * попадает на сайт: шаблон лендинга копирует в assets только presentation.pdf,
 * presentation-uz.pdf и presentation-en.pdf. Правило «на лендинге цен нет»
 * не нарушается.
 */
'use strict';

// ── палитра этапов игрового поля (наши цвета, не цвета исходного плаката) ──
const PH = {
  0: { c: '#7c8a80', n: 'Событие' },
  1: { c: '#4f7f6a', n: 'Предынвестиционная фаза' },
  2: { c: '#a3854c', n: 'Проектирование и согласования' },
  3: { c: '#a8543c', n: 'Строительство' },
  4: { c: '#2f5f7a', n: 'Эксплуатация и выход' }
};

// клетки поля в порядке движения: старт в правом нижнем углу, дальше против
// часовой стрелки. Подписи взяты с плаката владельца дословно.
const BOTTOM = [ // нижний ряд, справа налево
  ['АНАЛИЗ', 'Поиск локации', 1],
  ['УЧАСТОК', 'Земля / аренда', 1],
  ['СЕТИ', 'Городская инфраструктура', 1],
  ['ИДЕЯ', 'Формат БЦ / ТРЦ', 1],
  ['НАЛОГИ', 'Сбор за землю', 1],
  ['АНАЛИТИКА', 'Исследование рынка', 1],
  ['НЭИ', 'Анализ HBU', 1],
  ['ШАНС', 'Изменение генплана', 0],
  ['КОНЦЕПЦИЯ', 'Разработка', 1]
];
const LEFT = [ // левая колонка, снизу вверх
  ['ИНВЕСТОРЫ', 'Поиск пула', 2],
  ['ГРАД. СОВЕТ', 'Утверждение АГО', 2],
  ['ПРОЕКТ', 'Архитектура', 2],
  ['ФИНАНСЫ', 'Кредитование', 2],
  ['ФОРУМ', 'Участие в TIIF', 2],
  ['МАРКЕТИНГ', 'Предброкеридж', 2],
  ['ГОСЭКСПЕРТИЗА', 'Согласования', 2],
  ['ГЕНПОДРЯД', 'Выбор ГП', 2],
  ['РАЗРЕШЕНИЯ', 'На стройку', 2]
];
const TOP = [ // верхний ряд, слева направо
  ['ПЛОЩАДКА', 'Подготовка территории', 3],
  ['ШАНС', 'Инвест-программа', 0],
  ['ФУНДАМЕНТ', 'Цикл 0', 3],
  ['КАРКАС', 'Монолитные работы', 3],
  ['КОНКУРЕНЦИЯ', 'Tashkent City Mall', 0],
  ['ФАСАД', 'Тепловой контур', 3],
  ['ИНЖЕНЕРИЯ', 'MEP системы', 3],
  ['БРОКЕРИДЖ', 'Сдача, до 34 $/м²', 3],
  ['КАДАСТР', 'Госприемка', 3]
];
const RIGHT = [ // правая колонка, сверху вниз
  ['ЗАПУСК', 'Открытие', 4],
  ['СТАБИЛИЗАЦИЯ', 'Снижение вакансии', 4],
  ['УПРАВЛЕНИЕ', 'Facility Management', 4],
  ['РЕФИНАНС.', 'Оптимизация кредита', 4],
  ['КАП. РЕМОНТ', 'Модернизация', 4],
  ['ШАНС', 'Падение ставок', 0],
  ['РЕКОНЦЕПЦИЯ', 'Смена формата', 4],
  ['ВЫХОД', 'Продажа актива', 4],
  ['РЕДЕВЕЛОПМЕНТ', 'Новый цикл', 4]
];
const CORNERS = {
  br: ['СТАРТ', 'Инициация проекта'],
  bl: ['ДОЛГОСТРОЙ', 'Заморозка проекта'],
  tl: ['СЭЗ (IT-парк)', 'Налоговые льготы'],
  tr: ['Нарушение СНиП', 'Штрафы от ГАСН']
};

const MARKET = [
  ['Офисный сток Ташкента', 'около 520 тыс. м², рекордный ввод'],
  ['Торговые площади', '478,5 тыс. м², плюс 73% за год'],
  ['Ставка класса A', '32-34 $/м² в месяц'],
  ['Вакантность класса A', 'до 58% из-за новых башен'],
  ['Стрит-ритейл в центре', 'аренда 26-28 $/м²'],
  ['Тренды', 'рост коворкингов с нулевой вакансией, гибкие офисы']
];
const STAKE = [
  ['Девелопер', 'инициация проекта и риски'],
  ['Инвестор', 'капитал и возврат вложений'],
  ['Консалтинг', 'анализ рынка'],
  ['Брокер', 'заполнение площадей'],
  ['Генподрядчик', 'строительство'],
  ['Управляющая компания', 'эксплуатация, OPEX около 3 $/м²']
];

// ── титульные листы разделов ──
// Ключи about/cases/loc/viz вызывает сам gen-presentation.js в нужных местах
// основной брошюры, разделы 05 и 06 модуль ставит сам в своей части.
const SECTIONS = {
  about: {
    n: '01', h: 'Здание', s: 'Что это за объект и что в нём есть', img: 'render-corner.jpg',
    list: ['Бизнес-центр класса B/B+ со свободной планировкой', 'Восемь уровней: от отдельного этажа до здания целиком', 'Планировки подвала, первого этажа и типового этажа']
  },
  cases: {
    n: '02', h: 'Формат сделки', s: 'Кому подходит здание и на каких условиях', img: 'render-street.jpg',
    list: ['Сценарии использования: под кого нарезается здание', 'Аренда, покупка, аренда с последующим выкупом']
  },
  loc: {
    n: '03', h: 'Локация', s: 'Где стоит здание и кто живёт вокруг', img: 'map.jpg',
    list: ['Богишамол напротив Ботанического сада', 'Доступность на автомобиле и метро', 'Локация в цифрах: жители и окружение в радиусе до 3 км']
  },
  viz: {
    n: '04', h: 'Облик здания', s: 'Как объект будет выглядеть', img: 'render-aerial.jpg',
    list: ['Визуализации фасада и окружения', 'Разрез здания по отметкам']
  },
  invest: {
    n: '05', h: 'Инвестиционная модель', s: 'Экономика проекта, рынок Ташкента и две стратегии заработка на активе', img: '',
    list: ['Инвестиционный профиль и макроконтекст рынка', 'Капитализация: вход на стройке, выход после ввода или гарантированный обратный выкуп', 'Арендный бизнес: валютный поток и защита капитала', 'Синергия для стратегического партнёра']
  },
  eco: {
    n: '06', h: 'Экосистема девелопмента', s: 'Как создаётся стоимость коммерческого объекта в Ташкенте', img: '',
    list: ['Жизненный цикл проекта и множитель стоимости', 'Ключевые стейкхолдеры и их роли', 'Игровое поле: сорок клеток пути от идеи до выхода']
  }
};

// 4 титульных листа основной брошюры + 15 страниц инвестиционной части
const count = 4 + 15;

// один шаблон на все титульные листы: слева номер и содержание раздела,
// справа кадр проекта либо своя вставка
function dividerPage(ctx, key, right) {
  const { esc, img64, BRONZE, DARK, CODE, nextPg, TOTAL } = ctx;
  const S = SECTIONS[key];
  const rightHtml = right || (S.img
    ? `<img src="${img64(S.img)}" style="width:100%;height:100%;object-fit:cover">`
    : '');
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
  return SECTIONS[key] ? dividerPage(ctx, key) : '';
}

function html(ctx) {
  const { esc, img64, BRONZE, INK, MUTED, BG, DARK, ACC_RGB, CODE, cfg, foot } = ctx;
  const PHONE = (cfg.contacts && cfg.contacts.phone) || '';
  const TG = (cfg.contacts && cfg.contacts.telegram) || '';

  const rows = (arr) => arr.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join('');
  const kpi = (k, v, s) => `<div class="ikpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const ul = (arr) => `<ul class="ix">${arr.map((x) => `<li>${x}</li>`).join('')}</ul>`;

  // ── клетка игрового поля ──
  // клетки расставляются по сетке явно: порядок в разметке не совпадает с
  // порядком обхода поля, автоматическая раскладка тут не годится
  const at = (r, c) => `grid-row:${r};grid-column:${c}`;
  const cell = (x, r, c) => `<div class="bcell" style="${at(r, c)}"><i style="background:${PH[x[2]].c}"></i>
      <b>${esc(x[0])}</b><s>${esc(x[1])}</s></div>`;
  const corner = (k, r, c) => `<div class="bcell bcorner" style="${at(r, c)}"><b>${esc(CORNERS[k][0])}</b><s>${esc(CORNERS[k][1])}</s></div>`;

  // ── кривая жизненного цикла проекта ──
  const curve = (w, h, big) => {
    const fs1 = big ? 8 : 5.2, fs2 = big ? 7 : 4.4;
    const x = (f) => 30 + f * (w - 44), y = (f) => h - 26 - f * (h - 52);
    const pts = [[0, .10], [.22, .30], [.40, .34], [.58, .16], [.78, .88], [1, .88]];
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(p[0]).toFixed(1) + ' ' + y(p[1]).toFixed(1)).join(' ');
    const seg = ['Предынвестиц.', 'Проектир.', 'Строительство', 'Эксплуатация'];
    const yrs = ['1-5 лет', '1-2 года', '1-3 года', '10-15 лет'];
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block">
      <line x1="${x(0)}" y1="${h - 26}" x2="${x(1)}" y2="${h - 26}" stroke="rgba(${ACC_RGB},.35)" stroke-width="1"/>
      <line x1="${x(0)}" y1="${y(0)}" x2="${x(0)}" y2="${y(1)}" stroke="rgba(${ACC_RGB},.35)" stroke-width="1"/>
      ${[0, 1, 2, 3].map((i) => `<line x1="${x((i + 1) / 4)}" y1="${y(0)}" x2="${x((i + 1) / 4)}" y2="${y(1)}" stroke="rgba(${ACC_RGB},.16)" stroke-width=".6"/>`).join('')}
      <path d="${d}" fill="none" stroke="${BRONZE}" stroke-width="${big ? 2.6 : 1.8}" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${x(.22)}" cy="${y(.30)}" r="${big ? 4 : 2.6}" fill="#4f7f6a"/>
      <circle cx="${x(.58)}" cy="${y(.16)}" r="${big ? 4 : 2.6}" fill="#a8543c"/>
      <circle cx="${x(.78)}" cy="${y(.88)}" r="${big ? 4.6 : 3}" fill="#2f5f7a"/>
      <text x="${x(.22)}" y="${y(.30) - 8}" text-anchor="middle" font-size="${fs1}" font-weight="700" fill="${INK}">x1,5</text>
      <text x="${x(.58)}" y="${y(.16) + 12}" text-anchor="middle" font-size="${fs2}" fill="${MUTED}">спад: затраты</text>
      <text x="${x(.80)}" y="${y(.88) - 9}" text-anchor="middle" font-size="${fs1}" font-weight="700" fill="${INK}">пиковая стоимость</text>
      ${seg.map((s, i) => `<text x="${x((i + .5) / 4)}" y="${h - 15}" text-anchor="middle" font-size="${fs2}" font-weight="700" fill="${INK}">${s}</text>
        <text x="${x((i + .5) / 4)}" y="${h - 6}" text-anchor="middle" font-size="${fs2}" fill="${MUTED}">${yrs[i]}</text>`).join('')}
      <text x="6" y="${y(.5)}" font-size="${fs2}" fill="${MUTED}" transform="rotate(-90 6 ${y(.5)})" text-anchor="middle">стоимость актива</text>
    </svg>`;
  };

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
  .itab td{padding:3.6mm 5mm;font-size:10.5pt;border-bottom:.4pt solid #eee}
  .itab tr:last-child td{border-bottom:none}
  .itab td.n{text-align:right;font-weight:800;white-space:nowrap}
  .inote{font-size:8pt;color:${MUTED};line-height:1.5}
  .idark{background:${DARK};color:#fff}
  .idark .ih{color:#fff}
  .ibox{background:rgba(255,255,255,.07);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:5.5mm 6.5mm}
  .idark ul.ix li{color:rgba(255,255,255,.86)}

  /* ── игровое поле ── */
  .board{display:grid;grid-template-columns:27mm repeat(9,1fr) 27mm;grid-template-rows:19mm repeat(9,1fr) 19mm;gap:1.1mm;flex:1;min-height:0}
  .bcell{background:#fff;border-radius:1.6mm;padding:1.6mm 1.4mm 1.2mm;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;position:relative}
  .bcell i{position:absolute;left:1.4mm;right:1.4mm;top:1mm;height:1.5mm;border-radius:1mm;display:block}
  .bcell b{font-size:5.6pt;font-weight:800;letter-spacing:.02em;line-height:1.1;margin-top:2.2mm}
  .bcell s{text-decoration:none;font-size:4.5pt;color:${MUTED};line-height:1.15;margin-top:.8mm}
  .bcorner{background:${DARK};color:#fff}
  .bcorner b{font-size:6.4pt;margin-top:0}
  .bcorner s{color:rgba(255,255,255,.62);font-size:4.8pt}
  .bmid{grid-column:2 / 11;grid-row:2 / 11;display:flex;flex-direction:column;gap:2.4mm;padding:1.5mm 2mm}
  .bpan{background:#fff;border-radius:2.4mm;padding:3mm 3.6mm;display:flex;flex-direction:column;justify-content:center}
  .bpan h4{font-size:7.2pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${BRONZE};margin-bottom:1.8mm}
  .brow{display:flex;justify-content:space-between;gap:2mm;font-size:6.4pt;line-height:1.35;padding:.7mm 0;border-bottom:.3pt solid #eee}
  .brow:last-child{border-bottom:none}
  .brow b{font-weight:700}
  .brow span{color:${MUTED};text-align:right}
  .blegend{display:flex;gap:3.5mm;flex-wrap:wrap;font-size:6.2pt;color:${MUTED};align-items:center}
  .blegend em{font-style:normal;display:inline-flex;align-items:center;gap:1.2mm}
  .blegend u{text-decoration:none;width:3mm;height:1.8mm;border-radius:.8mm;display:inline-block}
  .phcard{background:#fff;border-radius:3mm;padding:4mm 4.5mm;display:flex;flex-direction:column}
  .phcard h4{font-size:9pt;font-weight:800;margin-bottom:1.5mm}
  .phcard .tag{font-size:7pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2.5mm}
  .phcard p{font-size:8pt;line-height:1.45;color:${MUTED}}
  .phcard .cells{font-size:7.6pt;line-height:1.5;margin-top:2.5mm;color:${INK}}
  </style>`;

  return `${CSS}

${dividerPage(ctx, 'invest', `<div style="height:100%;padding:16mm 12mm;display:flex;flex-direction:column;justify-content:center;gap:5mm">
  <div style="background:rgba(255,255,255,.07);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:6mm 6.5mm">
    <div style="font-size:8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRONZE};margin-bottom:2mm">Стратегия 1</div>
    <div style="font-size:15pt;font-weight:800">Капитализация</div>
    <div style="font-size:9pt;color:rgba(255,255,255,.65);margin-top:2mm;line-height:1.4">Перепродажа: вход на стройке, выход после ввода. Прибыль в долларах на м² и в процентах.</div>
  </div>
  <div style="background:rgba(255,255,255,.07);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:6mm 6.5mm">
    <div style="font-size:8pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRONZE};margin-bottom:2mm">Стратегия 2</div>
    <div style="font-size:15pt;font-weight:800">Арендный бизнес</div>
    <div style="font-size:9pt;color:rgba(255,255,255,.65);margin-top:2mm;line-height:1.4">Пассивный доход: доходность к цене покупки и к рыночной стоимости после ввода.</div>
  </div>
  <div style="font-size:8pt;color:rgba(255,255,255,.5);line-height:1.5;margin-top:1mm">Подробный расчёт по каждой стратегии - на следующих страницах.</div>
</div>`)}

<!-- executive summary -->
<div class="pg">
  <span class="ilbl">Executive summary</span>
  <div class="ih">Инвестиционный профиль проекта</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm">
    ${kpi('Цена входа', '$1 360', 'за м², с НДС, на этапе строительства')}
    ${kpi('Цена выхода', '$2 500', 'за м², 3 кв. 2027, после получения кадастра')}
    ${kpi('Потенциал ROI', '+83,8%', 'за цикл около 14 месяцев')}
    ${kpi('Арендный доход', '22,05%', 'валовая доходность при 25 $/м² в месяц')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Две стратегии на одном активе</div>
      ${ul(['<b>Капитализация.</b> Вход на этапе строительства, выход после ввода и кадастра. Прибыль 1 140 $ с каждого квадратного метра.',
            '<b>Арендный бизнес.</b> Удержание актива, валютный поток 300 $ с квадратного метра в год, окупаемость 4,5 года.',
            '<b>Комбинация.</b> Часть площадей под собственный офис, остальное в аренду или на продажу после ввода.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Почему текущий момент - окно входа</div>
      ${ul(['Охлаждение новых строек: конкуренция заставляет девелоперов замораживать старт проектов.',
            'Ожидаемый дефицит 2027-2028 годов: текущий объём нового предложения рынок поглотит за два-три года.',
            'Смещение фокуса арендаторов: переход из старых зданий в современные центры с исправной инженерией.',
            'Вход по цене этапа строительства фиксирует стоимость в валюте до ввода объекта.'])}
    </div>
  </div>
  ${foot()}
</div>

<!-- макроконтекст рынка -->
<div class="pg">
  <span class="ilbl">Макроконтекст рынка Ташкента</span>
  <div class="ih">Эволюция офисного рынка: от дефицита к качеству, 2021-2026</div>
  <div class="itwo">
    <div style="display:flex;flex-direction:column;gap:5mm;min-height:0">
      <table class="itab">
        <tr><th>Показатель рынка</th><th style="text-align:right">Значение</th></tr>
        ${rows([
          ['Сток классов A и B, 2026', '665 тыс. м²'],
          ['Весь офисный сток города', 'около 520 тыс. м² (другой периметр счёта)'],
          ['Было в 2021 году', '210 тыс. м²'],
          ['Введено в 2025 году', '192 тыс. м²'],
          ['Поглощение за 2025 год', '79 тыс. м²'],
          ['Ставка класса A', '32-34 $/м² в месяц'],
          ['Вакантность класса A', 'до 58%'],
          ['Эксплуатация (OPEX)', 'около 3 $/м² в месяц']
        ])}
      </table>
      <div class="inote">Сток классов A и B приведён без учёта трёх башен Tashkent City (более 220 тыс. м²). Цифра «около 520 тыс. м²» приходит из другого обзора и считает офисный сток по своему периметру - поэтому две величины рядом не складываются и не сравниваются напрямую. Источники: аналитика рынка 2024-2025 и данные собственника, июль 2026 года.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5mm">
      <div class="icard">
        <div class="ih3">Что происходит на рынке</div>
        ${ul(['Рынок вырос втрое за пять лет, и рекордный ввод 2025 года создал временный профицит предложения.',
              'Высокая вакантность класса A сосредоточена в новых башнях: это разовый выброс площадей, а не отсутствие спроса.',
              'Поглощение держится на уровне 79 тыс. м² в год, то есть избыток уходит за два-три года.'])}
      </div>
      <div class="icard acc">
        <div class="ih3">Что это значит для входа</div>
        ${ul(['Окно покупки по цене этапа строительства закрывается вместе с профицитом.',
              'К 2027-2028 годам новых проектов будет меньше: старт заморожен уже сейчас.',
              'Botanica выходит на рынок к моменту, когда текущий избыток предложения будет поглощён.'])}
      </div>
    </div>
  </div>
  ${foot()}
</div>

<!-- независимая рыночная аналитика -->
<div class="pg">
  <span class="ilbl">Внешняя оценка рынка</span>
  <div class="ih">Как этот же объект оценивают снаружи</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm">
    ${kpi('Рост цен офисов', '+25%', 'за год, рынок Ташкента в целом')}
    ${kpi('Вакантность', '16%', 'по качественным офисам в целом, упала с 25% за год')}
    ${kpi('Ставки класса B', '+13%', 'за год')}
    ${kpi('Рыночный ориентир', '$2 100', 'за м² сегодня: наш вход 1 360 $/м² ниже на 35%')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Пример: как растут цены на стройке</div>
      ${ul(['Бизнес-центр класса A Centris Towers подорожал на 105% за 2 года строительства - это около 43% годовых.',
            'Класс выше, чем у Botanica, поэтому абсолютные цены другие - но принцип тот же: ранний вход на этапе стройки фиксирует максимальную выгоду.',
            'Наш ориентир по Botanica - 83,8% за цикл около 14 месяцев, расчёт на странице «Перепродажа и прибыль на выходе».'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Что это значит для инвестора</div>
      ${ul(['Дефицит качества: спрос смещается на офисы с отделкой в сильных локациях, устаревшие простаивают.',
            'Внешняя оценка сегодняшней рыночной цены объекта - около 2 100 $/м². Наша цена входа 1 360 $/м² ниже её на 35%, то есть дисконт есть уже сегодня, без ожидания роста.',
            'Вакантность 58% на предыдущей странице относится к классу A и сосредоточена в новых башнях Tashkent City; 16% - оценка по качественным офисам в целом.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Источник: инвестиционный обзор по объекту Botanica, REDREAM Real Estate &amp; Investment, 2026. Это оценка стороннего участника рынка, а не независимое исследование: сам обзор предлагает тот же объект и в части площадей расходится с нашими чертежами (у него арендопригодная площадь 3 463 м², по экспликациям рабочих чертежей 2 575,4 м²). Поэтому берём отсюда только рыночные показатели; все расчёты по объекту на соседних страницах - наши, по чертежам.</div>
  ${foot()}
</div>

<!-- почему бизнес-центр: гео-аналитика -->
<div class="pg">
  <span class="ilbl">Гео-аналитика CASE</span>
  <div class="ih">Почему на этом участке бизнес-центр</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm">
    ${kpi('БЦ-конкурентов в 1 км', '0', 'офисной конкуренции в пешей доступности нет')}
    ${kpi('До ближайшего БЦ', '1 273 м', 'ни одного управляемого центра ближе')}
    ${kpi('Оценка под БЦ', '92 / 100', 'при городской медиане 83; модель слабо различает точки')}
    ${kpi('Оценка под клинику', '64 / 100', 'при городской медиане 55')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Формат выбран по данным, а не по вкусу</div>
      ${ul(['Участок считали двумя форматами: клиника и бизнес-центр. По обоим он выше городской медианы, но масштаб конкуренции отличается на порядок.',
            '<b>Клинике нужны люди, которые живут рядом. Бизнес-центру - люди, которые сюда приезжают.</b> Это разные экономики одного участка.',
            'Медицинский рынок вокруг зрелый: 151 профильная клиника в 3 км (из 169 медучреждений всех типов на странице «Локация в цифрах»). Офисной конкуренции в километре нет вовсе.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Что это даёт инвестору</div>
      ${ul(['Выручка БЦ считается просто: GLA x ставка x заполняемость, без лицензирования и медоборудования.',
            'Капзатраты ниже и предсказуемее, выход на заполняемость короче, чем набор пациентской базы у клиники.',
            'Поток мимо участка оцифрован по реальной дорожной сети - транспортный коридор из области.',
            '<b>Риски формата, названные тем же анализом:</b> целевая ставка выше медианы района, метро в 2,4 км, парковка ограничена; ставка должна выдержать конкуренцию с центром города.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Источник: гео-аналитическая платформа CASE (1 530 медучреждений, 1 027 аптек, 148 бизнес-центров, сетка населения по городу), сбор из открытых источников, июль 2026. Ограничение обоих форматов - парковка: открытых данных нет, считается отдельно.</div>
  ${foot()}
</div>

<!-- требования арендаторов -->
<div class="pg">
  <span class="ilbl">Рыночные требования и продукт</span>
  <div class="ih">Чего требуют корпоративные арендаторы и чем отвечает Botanica</div>
  <div class="itwo">
    <div class="icard">
      <div class="ih3">Боли арендаторов</div>
      ${ul(['Надёжность инженерных систем и климат-контроля.',
            'Высокий профессионализм управляющей компании (FM и PM).',
            'Гибкость собственника и прозрачность условий сделки.',
            'Экономическая обоснованность ставок при высоком комфорте.'])}
      <div class="inote" style="margin-top:4mm">Источник: опрос арендаторов AmCham.</div>
    </div>
    <div class="icard acc">
      <div class="ih3">Ответ Botanica</div>
      ${ul(['Инженерные сети высшего класса от ведущих мировых производителей.',
            'Профессиональное международное управление зданием и оптимизация OPEX.',
            'Высокая гибкость планировок: открытый формат или кабинетная нарезка.',
            'Стандарты качества, опережающие ожидания топ-менеджмента и резидентов.'])}
    </div>
  </div>
  ${foot()}
</div>

<!-- капитализация: перепродажа и прибыль на выходе -->
<div class="pg">
  <span class="ilbl">Стратегия 1: капитализация</span>
  <div class="ih">Перепродажа и прибыль на выходе</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm">
    ${kpi('Цена входа', '$1 360 /м²', 'на этапе строительства, с НДС')}
    ${kpi('Цена выхода', '$2 500 /м²', 'ориентир, 3 кв. 2027, после кадастра')}
    ${kpi('Прибыль с м²', '$1 140', 'разница цены выхода и входа')}
    ${kpi('ROI', '+83,8%', 'за цикл сделки, около 14 месяцев')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm;flex:1;min-height:0;margin-top:7mm">
    <div class="icard">
      <div class="ih3">Как считается прибыль</div>
      ${ul(['Прибыль в долларах: цена выхода минус цена входа, на квадратный метр - 1 140 $.',
            'Прибыль в процентах (ROI): прибыль к вложенному капиталу - 83,8% за весь цикл сделки.',
            'Годовая доходность (IRR) с учётом срока сделки: 65-70% годовых.'])}
    </div>
    <div class="icard">
      <div class="ih3">Пример на одном этаже</div>
      ${ul(['Типовой этаж: 458,73 м² общей площади, без лифтового холла.',
            'Вход: 458,73 x 1 360 = 623,9 тыс. $.',
            'Выход: 458,73 x 2 500 = 1,15 млн $.',
            'Разница: около 523 тыс. $ на этаж.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">От чего зависит результат</div>
      ${ul(['Срок ввода объекта и получения кадастра.',
            'Состояние рынка в 2027 году и глубина поглощения текущего профицита.',
            'Объём лота: крупный блок торгуется иначе, чем отдельный этаж.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Расчёт собственника. Цена выхода - ориентир по рынку на момент получения кадастра, а не гарантированная величина.</div>
  ${foot()}
</div>

<!-- график внесения инвестиций -->
<div class="pg">
  <span class="ilbl">Стратегия 1: капитализация</span>
  <div class="ih">График внесения инвестиций - этажи 2-4</div>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:1.15;display:flex;flex-direction:column;gap:5mm;min-height:0">
      <table class="itab">
        <tr><th>Транш</th><th>Доля</th><th>Срок</th><th style="text-align:right">Сумма</th></tr>
        <tr><td>1-й</td><td>50%</td><td>Август</td><td class="n">935 809 $</td></tr>
        <tr><td>2-й</td><td>25%</td><td>Октябрь</td><td class="n">467 905 $</td></tr>
        <tr><td>3-й</td><td>25%</td><td>Декабрь</td><td class="n">467 904 $</td></tr>
        <tr style="background:${BG}"><td><b>Итого</b></td><td><b>100%</b></td><td></td><td class="n">1 871 618 $</td></tr>
      </table>
      <div class="inote">Этажи 2-4 продаются инвестору: три типовых этажа по 458,73 м² GBA каждый - 1 376,19 м² общей площади, по цене входа 1 360 $/м² с НДС. Год транша уточняется на дату подписания договора, здесь - только месяцы цикла оплаты.</div>
    </div>
    <div style="flex:.85;display:flex;flex-direction:column;gap:5mm">
      <div class="icard">
        <div class="ih3">Как считать под свой лот</div>
        ${ul(['Итого капитал = площадь лота (м² GBA) x 1 360 $.',
              'Транш 1 - 50% суммы, при подписании.',
              'Транш 2 - 25% суммы, через два месяца.',
              'Транш 3 - 25% суммы, ещё через два месяца.'])}
      </div>
      <div class="icard acc">
        <div class="ih3">Один типовой этаж</div>
        <div style="font-size:9.5pt;line-height:1.5">458,73 м² x 1 360 $ = 623 872,8 $, транши 311 936,4 / 155 968,2 / 155 968,2 $.</div>
      </div>
    </div>
  </div>
  ${foot()}
</div>

<!-- обратный выкуп -->
<div class="pg">
  <span class="ilbl">Стратегия 1: капитализация</span>
  <div class="ih">Вариант обратного выкупа - этажи 2-4</div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm">
    ${kpi('Цена входа', '$1 360 /м²', 'на этапе строительства, с НДС')}
    ${kpi('Цена обратного выкупа', '$1 700 /м²', 'максимум, цена входа +25%')}
    ${kpi('Прибыль с м²', '$340', 'разница цены выкупа и входа')}
    ${kpi('Прибыль', '+25%', 'гарантированный максимум CASE')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Как это работает</div>
      ${ul(['CASE Real Estate Advisory предлагает обратный выкуп этажей 2-4 у инвестора по фиксированной цене - максимум 25% сверх цены входа.',
            'Выкуп происходит после завершения строительства и государственной приёмки объекта, до выхода на открытый рынок.',
            'Итого на этажи 2-4: вход 1 871 618 $, выкуп 2 339 523 $, прибыль 467 905 $.',
            'Один типовой этаж: вход 623 872,8 $, выкуп 779 841 $, прибыль 155 968,2 $.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Чем отличается от рыночного выхода</div>
      ${ul(['Обратный выкуп - гарантированная сделка с фиксированной ценой и известным сроком: сразу после гос. приёмки, без ожидания кадастра и покупателя на рынке.',
            'Рыночный выход по ориентиру 2 500 $/м² (страница «Перепродажа и прибыль на выходе») даёт более высокую прибыль - 1 140 $ с м² вместо 340 $ - но зависит от рынка на момент кадастра, в 3 кв. 2027.',
            'Инвестор выбирает: гарантированные +25% сейчас или рыночный ориентир позже.'])}
    </div>
  </div>
  ${foot()}
</div>

<!-- аренда: пассивный доход -->
<div class="pg">
  <span class="ilbl">Стратегия 2: арендный бизнес</span>
  <div class="ih">Пассивный доход от аренды</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5mm">
    ${kpi('Арендный поток', '$300 /м² в год', 'при ставке 25 $/м² в месяц, с арендопригодного метра (GLA)')}
    ${kpi('Доходность к цене покупки', '22,05%', 'на арендопригодный метр: 300 $ к 1 360 $')}
    ${kpi('Доходность к рыночной стоимости', '12,00%', 'на арендопригодный метр: 300 $ к 2 500 $')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm;flex:1;min-height:0;margin-top:7mm">
    <div class="icard">
      <div class="ih3">Два способа считать доходность</div>
      ${ul(['<b>К цене покупки (yield on cost).</b> 300 $ потока к 1 360 $ вложений - 22,05%.',
            '<b>К рыночной стоимости (yield on value).</b> Те же 300 $ к 2 500 $ после ввода - 12,00%.',
            '<b>Обе цифры - на арендопригодный метр (GLA).</b> Купленная площадь (GBA) включает коридоры и санузлы, аренда на них не начисляется.'])}
    </div>
    <div class="icard">
      <div class="ih3">Пересчёт на купленную площадь</div>
      ${ul(['Этажи 2-4: покупка 1 871 618 $, аренда 1 013,7 м² GLA x 300 $ = 304 110 $ в год.',
            'Доходность на всю купленную площадь - 16,25%, окупаемость 6,2 года.',
            'Здание целиком: 773 тыс. $ в год, при заполняемости 90% около 695 тыс. $.',
            'Эксплуатационные затраты - около 3 $/м² в месяц.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Почему разница важна и кому подходит</div>
      ${ul(['22,05% против 12,00% - выигрыш даёт вход по цене стройки.',
            '12,00% - ориентир, с которым актив сравнят на рынке готовых бизнес-центров.',
            '16,25% на всю купленную площадь: разницу создают общие зоны этажа.',
            'Подходит инвестору, которому нужен поток, а не разовая прибыль.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:4mm">Ближайшие действующие бизнес-центры - от 1,3 км, аренда в них идёт от 25 $/м² в месяц: ставка в модели подтверждена соседним рынком. В самом километре действующих бизнес-центров нет ни одного. Доходность указана до вычета эксплуатационных расходов, налогов и простоя.</div>
  ${foot()}
</div>

<!-- синергия для стратегического партнёра -->
<div class="pg idark">
  <span class="ilbl">Синергия для стратегического партнёра</span>
  <div class="ih">Зачем Botanica крупной компании</div>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:1.15;display:flex;flex-direction:column;gap:5mm">
      <div class="ibox">
        ${ul(['<b>Флагманское присутствие:</b> размещение команды в одном из самых современных и технологичных бизнес-центров Ташкента.',
              '<b>Защита от инфляции и валютных рисков:</b> фиксация стоимости в твёрдой валюте на этапе строительства, 1 360 $/м² с НДС.',
              '<b>Гибкость размещения:</b> возможность выкупа этажа или крупного блока под центральный офис на индивидуальных условиях.',
              '<b>Имиджевый капитал:</b> архитектура и уровень инженерии подчёркивают статус лидера рынка.'])}
      </div>
      <div style="background:rgba(${ACC_RGB},.18);border-radius:4mm;padding:5mm 6mm;font-size:10pt;line-height:1.55;color:rgba(255,255,255,.9)">
        Формат сделки обсуждается: покупка блока, аренда с последующим выкупом или долгосрочная аренда с фиксацией ставки на весь срок.
      </div>
    </div>
    <div style="flex:.85;display:flex;flex-direction:column;justify-content:center;gap:4mm">
      <div style="font-size:14pt;font-weight:800">Обсудим условия</div>
      <div style="font-size:20pt;font-weight:800;letter-spacing:-.01em">${esc(PHONE)}</div>
      <div style="font-size:11pt;color:rgba(255,255,255,.75)">t.me/${esc(TG)} · caseadvisory.uz/botanica/</div>
      <div style="font-size:8.5pt;color:rgba(255,255,255,.55);line-height:1.55;margin-top:3mm">
        CASE Real Estate Advisory выступает агентом собственника по коммерциализации проекта.
        Информация носит справочный характер, не является публичной офертой и инвестиционной рекомендацией.
      </div>
      <img src="${img64('case-logo.png')}" style="height:11mm;width:auto;margin-top:3mm;align-self:flex-start">
    </div>
  </div>
  <div class="foot" style="color:rgba(255,255,255,.5)"><span><b style="color:#fff">${esc(CODE)}</b> · ${esc(ctx.addr)}</span>
    <span>Конфиденциально</span><span>${ctx.nextPg()} / ${ctx.TOTAL}</span></div>
</div>

${dividerPage(ctx, 'eco', `<div style="height:100%;padding:18mm 12mm;display:flex;flex-direction:column;justify-content:center;gap:4mm">
  ${[1, 2, 3, 4].map((k) => `<div style="display:flex;align-items:center;gap:4mm">
    <span style="width:14mm;height:3mm;border-radius:1.5mm;background:${PH[k].c};display:block;flex:none"></span>
    <span style="font-size:9.5pt;color:rgba(255,255,255,.85)">${PH[k].n}</span></div>`).join('')}
  <div style="font-size:8.5pt;color:rgba(255,255,255,.5);line-height:1.5;margin-top:4mm">Четыре фазы жизненного цикла - четыре стороны игрового поля в конце раздела.</div>
</div>`)}

<!-- жизненный цикл и стейкхолдеры -->
<div class="pg">
  <span class="ilbl">Экосистема девелопмента</span>
  <div class="ih">Жизненный цикл проекта и множитель стоимости</div>
  <div style="display:flex;flex-direction:column;gap:5mm;flex:1;min-height:0">
    <div class="icard" style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;padding:5mm 8mm">
      ${curve(620, 250, true)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5mm">
      <div class="icard" style="padding:5mm 5.5mm">
        <div class="ih3">Ключевые стейкхолдеры</div>
        ${STAKE.map(([a, b]) => `<div style="display:flex;justify-content:space-between;gap:3mm;font-size:8.5pt;line-height:1.35;padding:1.3mm 0;border-bottom:.3pt solid #eee">
          <b>${a}</b><span style="color:${MUTED};text-align:right">${b}</span></div>`).join('')}
      </div>
      <div class="icard" style="padding:5mm 5.5mm">
        <div class="ih3">Адаптация к рынку Ташкента</div>
        <div style="font-size:8.5pt;line-height:1.45;color:${MUTED}">
          Простые стратегии уступают место глубокой концептуализации (Highest and Best Use). При ставках до 34 $/м² в сегменте A растёт вакантность из-за агрессивного ввода новых объектов Tashkent City. Успех определяют якорные арендаторы ещё на предынвестиционной фазе и профессиональный facility management с OPEX в пределах 3 $/м².
        </div>
      </div>
      <div class="icard acc" style="padding:5mm 5.5mm">
        <div class="ih3">Как читать кривую</div>
        <div style="font-size:8.5pt;line-height:1.45;color:${MUTED}">
          Первый множитель около x1,5 проект набирает ещё на бумаге: смена назначения участка, анализ наилучшего использования, утверждённая концепция. Затем спад: стройка это только затраты. Пиковая стоимость достигается не в момент ввода, а после стабилизации заполняемости.
        </div>
      </div>
    </div>
  </div>
  ${foot()}
</div>

<!-- как читать поле -->
<div class="pg">
  <span class="ilbl">Приложение</span>
  <div class="ih">Стратегия девелопмента: как читать поле на следующей странице</div>
  <div style="font-size:10pt;line-height:1.5;color:${MUTED};margin-bottom:5mm;max-width:210mm">
    Поле показывает путь коммерческого объекта от идеи до выхода из актива. Движение начинается с клетки СТАРТ в правом нижнем углу и идёт по часовой стрелке: вдоль нижней стороны налево, вверх по левой, направо по верхней и вниз по правой. Каждая сторона поля - одна фаза жизненного цикла. Клетки ШАНС и угловые клетки - события, которые случаются не с каждым проектом, но меняют экономику сразу.
  </div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5mm;flex:1;min-height:0">
    ${[[1, 'нижняя сторона', BOTTOM, 'От поиска локации до утверждённой концепции. Здесь проект стоит дешевле всего и здесь же зарабатывается первый множитель стоимости.'],
       [2, 'левая сторона', LEFT, 'Деньги, архитектура и разрешения. Фаза, на которой проект перестаёт быть идеей и получает право на существование.'],
       [3, 'верхняя сторона', TOP, 'Затраты без выручки. Botanica входит в эту фазу: впереди конструктив, фасад и инженерия, параллельно идёт предброкеридж.'],
       [4, 'правая сторона', RIGHT, 'Заполнение, управление и выход. Пиковая стоимость наступает после стабилизации, а не в день ввода.']]
      .map(([k, side, arr, txt]) => `<div class="phcard" style="border-top:1.6mm solid ${PH[k].c}">
        <div class="tag" style="color:${PH[k].c}">${side}</div>
        <h4>${PH[k].n}</h4>
        <p>${txt}</p>
        <div class="cells">${arr.map((c) => c[0]).join(' · ')}</div>
      </div>`).join('')}
  </div>
  <div class="icard acc" style="margin-top:5mm;font-size:9.5pt;line-height:1.5">
    <b>Где сейчас Botanica.</b> Проект прошёл нижнюю и левую стороны поля: концепция, анализ, архитектура и согласования позади, здание проектируется, бронирование этажей открыто. Впереди верхняя сторона - стройка, инженерия и кадастр. Инвестор, который заходит сейчас, покупает по цене стройки, а выходит на клетках ЗАПУСК и СТАБИЛИЗАЦИЯ, где актив стоит дороже всего.
  </div>
  ${foot()}
</div>

<!-- игровое поле целиком -->
<div class="pg" style="padding:8mm 8mm 7mm">
  <div class="board">
    ${corner('tl', 1, 1)}
    ${TOP.map((c, i) => cell(c, 1, i + 2)).join('')}
    ${corner('tr', 1, 11)}
    ${LEFT.slice().reverse().map((c, i) => cell(c, i + 2, 1)).join('')}
    ${RIGHT.map((c, i) => cell(c, i + 2, 11)).join('')}
    ${corner('bl', 11, 1)}
    ${BOTTOM.slice().reverse().map((c, i) => cell(c, 11, i + 2)).join('')}
    ${corner('br', 11, 11)}

    <div class="bmid">
      <div style="text-align:center;padding:1mm 0 0">
        <div style="font-size:16pt;font-weight:800;letter-spacing:-.01em">Стратегия девелопмента: Ташкент</div>
        <div style="font-size:7pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${BRONZE};margin-top:1.4mm">Экосистема создания стоимости в коммерческой недвижимости</div>
      </div>
      <div style="display:flex;gap:2.4mm;flex:1;min-height:0">
        <div style="flex:1;display:flex;flex-direction:column;gap:2.4mm;min-height:0">
          <div class="bpan" style="flex:1">
            <h4>Рынок недвижимости, аналитика 2024-2025</h4>
            ${MARKET.map(([a, b]) => `<div class="brow"><b>${a}</b><span>${b}</span></div>`).join('')}
          </div>
          <div class="bpan" style="flex:1">
            <h4>Ключевые стейкхолдеры</h4>
            ${STAKE.map(([a, b]) => `<div class="brow"><b>${a}</b><span>${b}</span></div>`).join('')}
          </div>
        </div>
        <div style="flex:1.05;display:flex;flex-direction:column;gap:2.4mm;min-height:0">
          <div class="bpan" style="flex:1;display:flex;flex-direction:column">
            <h4>Жизненный цикл и капитализация проекта (множитель стоимости)</h4>
            <div style="flex:1;display:flex;align-items:center">${curve(420, 178, false)}</div>
          </div>
          <div class="bpan">
            <h4>Адаптация к рынку Ташкента</h4>
            <div style="font-size:6.4pt;line-height:1.4;color:${MUTED}">
              Простые стратегии уступают место глубокой концептуализации (Highest and Best Use). При ставках до 34 $/м² в сегменте A растёт вакантность из-за агрессивного ввода новых объектов. Успех определяют якорные арендаторы на предынвестиционной фазе и профессиональный facility management с OPEX в пределах 3 $/м².
            </div>
          </div>
        </div>
      </div>
      <div class="blegend">
        ${[1, 2, 3, 4, 0].map((k) => `<em><u style="background:${PH[k].c}"></u>${PH[k].n}</em>`).join('')}
        <em style="margin-left:auto">Движение по часовой стрелке от клетки СТАРТ</em>
      </div>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;font-size:7.5pt;color:${MUTED};margin-top:3mm">
    <span><b style="color:${INK};letter-spacing:.08em">${esc(CODE)}</b> · ${esc(ctx.addr)}</span>
    <span>CASE Real Estate Advisory · ${esc(PHONE)} · caseadvisory.uz</span>
    <span>${ctx.nextPg()} / ${ctx.TOTAL}</span>
  </div>
</div>
`;
}

module.exports = { count, html, divider };
