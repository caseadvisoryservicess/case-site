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
 * Метод скоринга - формула приложения CASE OS Geo Analytics:
 *   балл = 0,55 x спрос + 0,45 x (1 - конкуренты / эталон)
 *   спрос = население в 1 км / 25 000; эталоны: БЦ 6 объектов, клиника 8.
 *
 * ЧЕСТНАЯ ОГОВОРКА, из-за которой страницы построены именно так. Слагаемое
 * спроса по Тахтапулу посчитать не на чем: откалиброванного населения по точке
 * нет (у Botanica оно было из отчёта владельца по сетке Kontur H3), а наша
 * собственная сетка помечена источником как непроверенная по единицам и на
 * Botanica занижала в 4,7-5,8 раза с плавающим коэффициентом. Поэтому:
 *   1. Абсолютное население по Тахтапулу НЕ публикуем (правило 3).
 *   2. Показываем слагаемое конкуренции - оно и решает выбор формата, потому
 *      что спрос в одной точке одинаков для всех форматов и сдвигает все баллы
 *      на одну и ту же величину, не меняя порядок. Это не упрощение, а точное
 *      следствие формулы, и на странице так и написано.
 *   3. По образовательным форматам конкурентов в геобазе НЕТ ни одного:
 *      в ней только медицина, аптеки, бизнес-центры, махалли и общепит. Значит
 *      учебный центр и школу этой формулой не считаем и прямо это пишем,
 *      а не подставляем ноль вместо отсутствующих данных.
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

// эталоны насыщения из приложения CASE OS Geo Analytics
const BENCH = { bc: 6, med: 8 };
const C1 = GEO.counts[1000];
// свободна ли ниша, 0-100: столько процентов от эталона ещё не занято
const free = (n, bench) => Math.max(0, Math.round((1 - n / bench) * 100));
const FREE_BC = free(C1.bc, BENCH.bc);
const FREE_MED = free(C1.medCore, BENCH.med);

const GEO_COL = { med: '#c0392b', ph: '#1e8f5e', bc: '#2f6fb0', mh: '#8a6bbf', food: '#d08a1e', x: '#9aa0a6' };
// Показываем только те слои, которые действительно конкурируют с оцениваемыми
// форматами. Аптеки и махаллинские центры владелец попросил убрать: они не
// конкуренты ни офису, ни клинике и только зашумляют схему и таблицу.
const SHOW = ['med', 'bc'];
const SHOWN_TOTAL = GEO.points.filter((p) => SHOW.includes(p.c)).length;

const SECTIONS = {
  about: {
    n: '01', h: 'Здание', s: 'Что это за объект и что в нём есть', img: 'facade-angle.jpg',
    list: ['Пять уровней: подвал и четыре этажа', 'Площади по государственному кадастру', 'Планировки всех уровней']
  },
  cases: {
    n: '02', h: 'Формат сделки', s: 'Кому подходит здание и на каких условиях', img: 'facade-evening.jpg',
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

// 4 титульных листа основной брошюры + 5 страниц инвесторской части
const count = 4 + 5;

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
  .fmt h4{font-size:11pt;font-weight:800}
  .fmt .m{font-size:8.5pt;color:${MUTED};line-height:1.45}
  </style>`;

  return `${CSS}

${dividerPage(ctx, 'geo', `<div style="height:100%;padding:16mm 12mm;display:flex;flex-direction:column;justify-content:center;gap:5mm">
  ${[[String(SHOWN_TOTAL), 'медицинских объектов и бизнес-центров в радиусе 3 км'],
     [String(C1.bc), 'бизнес-центра в радиусе 1 км'],
     [String(C1.medCore), 'профильных медцентров и клиник в радиусе 1 км']]
    .map(([v, s2]) => `<div class="ibox">
      <div style="font-size:22pt;font-weight:800;letter-spacing:-.02em">${v}</div>
      <div style="font-size:8.5pt;color:rgba(255,255,255,.7);margin-top:2mm;line-height:1.4">${s2}</div></div>`).join('')}
  <div style="font-size:8pt;color:rgba(255,255,255,.5);line-height:1.5;margin-top:1mm">Геобаза CASE Tashkent Geo Master, сбор 2026 год.</div>
</div>`)}

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
        ${radRow('в том числе клиники и медцентры', 'medCore')}
        ${radRow('Бизнес-центры', 'bc')}
      </table>
      <div class="icard acc" style="font-size:9.5pt;line-height:1.5">
        <b>Что это за место.</b> Тахтапул стоит в плотной центральной застройке Шайхантахура: в одном километре ${C1.med} медицинских объектов и ${C1.bc} бизнес-центра. Это сложившийся, обжитой район, а не окраина под застройку: медицинская ниша здесь давно занята, офисная - нет.
      </div>
      <div class="inote">Источник: геобаза CASE Tashkent Geo Master (3 292 объекта по Ташкенту, из них 148 бизнес-центров и 1 530 медучреждений), сбор 2026 год. На схеме и в таблице - только медицина и бизнес-центры, то есть форматы, с которыми объект конкурирует: ${SHOWN_TOTAL} объекта в радиусе 3 км.</div>
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
          ${GEO.nearestBc.slice(0, 6).map((b) => `<tr><td style="padding:2.4mm 0">${esc(b.n)}</td><td class="n" style="padding:2.4mm 0">${gn(b.d)} м</td></tr>`).join('')}
        </table>
        <div class="inote" style="margin-top:3mm">Ближайшие бизнес-центры по геобазе CASE. В радиусе 1 км их ${C1.bc}, в 3 км - ${GEO.counts[3000].bc}.</div>
      </div>
      <div class="icard acc">
        <div class="ih3">Медицина: ниша плотно занята</div>
        ${ul([`В одном километре ${C1.medCore} профильных конкурентов: ${C1.medBreak.private} частных медцентров и ${C1.medBreak.clinic} клиник.`,
              `Плюс ${C1.medBreak.hospital} больниц, ${C1.medBreak.doctors} врачебных практик и роддом - каждый со своим потоком пациентов.`,
              'Медицинский трафик здесь давно сформирован и поделён между действующими игроками.'])}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5mm;min-height:0">
      <div class="icard">
        <div class="ih3">Образование: данных нет</div>
        ${ul(['В геобазе CASE есть медицина, аптеки, бизнес-центры, махалли и общепит. Школ, колледжей и учебных центров в ней нет ни одного объекта.',
              'Поэтому по учебному центру и школе мы не считаем конкуренцию той же формулой: подставить ноль вместо отсутствующих данных значит выдать пустую базу за пустой рынок.',
              'Что нужно, чтобы посчитать: выгрузка образовательных учреждений по Шайхантахуру. Собирается тем же способом, что и остальные слои базы.'])}
      </div>
      <div class="icard acc">
        <div class="ih3">Как читать эти числа</div>
        ${ul(['Считаем объекты, а не их выручку и загрузку: геобаза знает, что объект есть, но не знает, насколько он успешен.',
              'Близость конкурента - не всегда минус: медицинский кластер притягивает поток пациентов, и часть его достаётся новым игрокам. Но входить в него дороже.'])}
      </div>
    </div>
  </div>
  ${foot()}
</div>

<!-- сравнение форматов -->
<div class="pg">
  <span class="ilbl">Выбор формата</span>
  <div class="ih">Что данные говорят по каждому формату</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm;flex:1;min-height:0;align-content:start">
    ${fmtCard('#2f6fb0', 'Офис, бизнес-центр',
      chip('ниша не занята', '#2f6fb0', true),
      `${C1.bc} бизнес-центра в радиусе 1 км при эталоне насыщения ${BENCH.bc}. Ближайший - ${esc(GEO.nearestBc[0].n)} в ${gn(GEO.nearestBc[0].d)} м.`,
      'Единственный формат, где расчёт по формуле работает прямо: чем меньше офисов рядом, тем свободнее ниша. Свободного места больше, чем занятого, а здание целиком под одного арендатора закрывает запрос на штаб-квартиру, которого мелкие БЦ рядом не закрывают.')}
    ${fmtCard('#c0392b', 'Клиника, медцентр',
      chip('медицинский кластер', '#c0392b', true),
      `${C1.medCore} профильных медцентров и клиник, ${C1.medBreak.hospital} больниц, роддом и ${C1.medBreak.doctors} врачебные практики в радиусе 1 км.`,
      'Формула штрафует за соседей и даёт ноль, но для медицины она здесь не работает: пациентский поток в район уже сформирован, а государственная больница и роддом рядом дают направления, диагностику и послеоперационное наблюдение. Для медцентра такое соседство чаще плюс, чем минус - модель насыщения этого не учитывает.')}
    ${fmtCard('#7a6a3f', 'Учебный центр',
      chip('нужен сбор данных', '', false),
      'Здание подходит: этажи по 371,5 м² без несущих стен режутся на аудитории, потолки 3,6 м на 2-3 этажах, отдельный вход. Вокруг жилой массив.',
      'Конкурентов посчитать не на чем: слой образования в геобазе объявлен, но не собран - ни одного объекта. Оценка формата держится на характеристиках здания и на жилом окружении, а не на замере рынка.')}
    ${fmtCard('#7a6a3f', 'Небольшая школа',
      chip('ограничение участка', '', false),
      'Участок 645 м², пятно застройки 440 м². Свободной территории остаётся около 205 м².',
      'Формат упирается не в конкуренцию, а в размер участка: на спортивную и игровую зоны 205 м² не хватает. Школа возможна только в формате без собственной территории, и это надо согласовывать отдельно.')}
  </div>
  <div class="inote" style="margin-top:5mm">Эталоны насыщения из приложения CASE OS Geo Analytics: ${BENCH.bc} бизнес-центров и ${BENCH.med} клиник в радиусе 1 км. Формула балла: 0,55 x спрос + 0,45 x (1 - конкуренты / эталон). Она одинаково штрафует за любое соседство, поэтому применима к офису и не применима к медицине - об этом сказано в карточке.</div>
  ${foot()}
</div>

<!-- вывод -->
<div class="pg">
  <span class="ilbl">Вывод</span>
  <div class="ih">Что данные говорят о Тахтапуле</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5mm">
    ${kpi('Офис', `${FREE_BC}%`, 'свободной ниши в радиусе 1 км, расчёт по формуле')}
    ${kpi('Клиника', `${C1.medCore} + ${C1.medBreak.hospital}`, 'профильных центров и больниц в 1 км: сложившийся кластер')}
    ${kpi('Образование', 'нет замера', 'слой учебных заведений в геобазе не собран')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Два рабочих формата, разная логика</div>
      ${ul([`<b>Офис.</b> Ниша объективно свободна: ${C1.bc} бизнес-центра в километре при эталоне ${BENCH.bc}. Здесь работает прямой расчёт, и здание целиком под одного арендатора усиливает позицию.`,
            `<b>Медцентр.</b> Работает обратная логика: ${C1.medCore} профильных соседей, ${C1.medBreak.hospital} больниц и роддом означают, что поток пациентов в район уже идёт. Формула такое соседство штрафует, практика - наоборот.`,
            '<b>Учебный центр.</b> Здание подходит, окружение жилое, но рынок не замерен - вывод пока на характеристиках объекта, а не на данных.'])}
    </div>
    <div class="icard acc">
      <div class="ih3">Чего не хватает для полной картины</div>
      ${ul(['<b>Слой образования.</b> В классификаторе геобазы школы, детские сады, вузы и учебные центры заведены, но объекты по ним не собраны. Без этого учебный центр и школу нельзя поставить в один ряд с офисом и клиникой.',
            '<b>Население по точке.</b> Откалиброванных цифр по Шайхантахуру нет. Собственная сетка помечена источником как непроверенная по единицам и на другом объекте занижала в пять раз, поэтому в документ не попала.',
            '<b>Ставки аренды соседних БЦ.</b> Адреса и расстояния в базе есть, условия - нет. Это следующий шаг, если формат офиса подтверждается.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Геоаналитика описывает окружение объекта и насыщенность ниш, но не заменяет финансовую модель: доходность формата считается отдельно, по ставке аренды и составу арендаторов.</div>
  ${foot()}
</div>
`;
}

module.exports = { count, html, divider };
