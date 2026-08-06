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

  // ── схема окружения: те же кольца и точки, что на лендинге Botanica ──
  const scheme = (S) => {
    const R = GEO.maxRing, k = (S / 2 - 16) / R, c = S / 2;
    const dots = GEO.points.filter((p) => p.d <= R).map((p) =>
      `<circle cx="${(c + p.x * k).toFixed(1)}" cy="${(c - p.y * k).toFixed(1)}" r="2.6" fill="${GEO_COL[p.c] || GEO_COL.x}" stroke="#fff" stroke-width=".7"/>`).join('');
    const rings = [500, 1000, 2000, 3000].map((m) =>
      `<circle cx="${c}" cy="${c}" r="${(m * k).toFixed(1)}" fill="none" stroke="rgba(0,0,0,.26)" stroke-width=".7" stroke-dasharray="3 3"/>` +
      // подпись только у километровых колец: у 500 м она налезает на маркер объекта
      (m >= 1000 ? `<text x="${c}" y="${(c - m * k + 9).toFixed(1)}" text-anchor="middle" font-size="7" font-family="system-ui" fill="#555">${m / 1000} км</text>` : '')).join('');
    return `<svg viewBox="0 0 ${S} ${S}" style="width:100%;height:auto;display:block">
      ${rings}${dots}
      <circle cx="${c}" cy="${c}" r="5" fill="${BRONZE}" stroke="#fff" stroke-width="2"/>
    </svg>`;
  };
  const legend = [['med', 'медицина'], ['ph', 'аптеки'], ['bc', 'бизнес-центры'], ['mh', 'махаллинские центры']]
    .map(([c, l]) => `<span style="display:inline-flex;align-items:center;gap:1.6mm;margin-right:6mm;font-size:8.5pt;color:${MUTED}">
      <i style="width:2.4mm;height:2.4mm;border-radius:50%;background:${GEO_COL[c]};display:inline-block"></i>${l}</span>`).join('');

  const radRow = (label, key) => `<tr><td>${label}</td>` +
    [500, 1000, 1500, 3000].map((r) => `<td class="n">${GEO.counts[r][key]}</td>`).join('') + '</tr>';

  // ── шкала «насколько свободна ниша» ──
  const bar = (pct, colour, note) => `
    <div style="height:7mm;border-radius:2mm;background:rgba(0,0,0,.06);overflow:hidden;position:relative">
      <div style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(pct, 2)}%;background:${colour}"></div>
      <div style="position:absolute;left:2.5mm;top:0;bottom:0;display:flex;align-items:center;font-size:8.5pt;font-weight:800;color:${pct > 18 ? '#fff' : INK}">${note}</div>
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
  ${[[String(GEO.total), 'объектов вокруг в радиусе 3 км по геобазе CASE'],
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
        ${radRow('Аптеки', 'ph')}
        ${radRow('Бизнес-центры', 'bc')}
        ${radRow('Махаллинские центры', 'mh')}
      </table>
      <div class="icard acc" style="font-size:9.5pt;line-height:1.5">
        <b>Что это за место.</b> Тахтапул стоит в плотной центральной застройке Шайхантахура: в одном километре ${C1.med} медицинских объектов, ${C1.ph} аптек и ${C1.mh} махаллинских центров. Это сложившийся, обжитой район с высокой концентрацией сервиса, а не окраина под застройку.
      </div>
      <div class="inote">Источник: геобаза CASE Tashkent Geo Master (3 292 объекта по Ташкенту: 148 бизнес-центров, 1 530 медучреждений, 1 027 аптек, 545 махаллей), сбор 2026 год. На схеме показаны все ${GEO.total} объектов базы, попавшие в радиус 3 км.</div>
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
              `${C1.ph} аптек в том же радиусе: медицинский трафик здесь давно сформирован и поделён.`])}
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
  <div class="ih">Какой формат сильнее на этом участке</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;flex:1;min-height:0;align-content:start">
    <div class="fmt" style="border-top:1.6mm solid #2f6fb0">
      <h4>Офис, бизнес-центр</h4>
      ${bar(FREE_BC, '#2f6fb0', `ниша свободна на ${FREE_BC}%`)}
      <div class="m">${C1.bc} бизнес-центра в радиусе 1 км при эталоне насыщения ${BENCH.bc}. Свободного места в нише больше, чем занятого, а здание целиком под одного арендатора закрывает запрос на штаб-квартиру, которого мелкие БЦ рядом не закрывают.</div>
    </div>
    <div class="fmt" style="border-top:1.6mm solid #c0392b">
      <h4>Клиника, медцентр</h4>
      ${bar(FREE_MED, '#c0392b', `ниша свободна на ${FREE_MED}%`)}
      <div class="m">${C1.medCore} профильных конкурентов в радиусе 1 км при эталоне ${BENCH.med} - насыщение превышено более чем втрое. Формат физически возможен (планировки это позволяют), но входить придётся в самый плотный медицинский кластер города.</div>
    </div>
    <div class="fmt" style="border-top:1.6mm solid #9aa0a6">
      <h4>Учебный центр</h4>
      ${bar(0, '#9aa0a6', 'данных о конкурентах нет')}
      <div class="m">Здание подходит: этажи по 371,5 м² без несущих стен режутся на аудитории, потолки 3,6 м на 2-3 этажах, отдельный вход. Но конкуренцию посчитать не на чем - образовательного слоя в геобазе нет.</div>
    </div>
    <div class="fmt" style="border-top:1.6mm solid #9aa0a6">
      <h4>Небольшая школа</h4>
      ${bar(0, '#9aa0a6', 'ограничение участка')}
      <div class="m">Участок 645 м², пятно застройки 440 м². Свободной территории остаётся около 205 м² - этого не хватает на спортивную и игровую зоны, которые школе нужны. Формат упирается не в конкуренцию, а в размер участка.</div>
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Шкала показывает слагаемое конкуренции из формулы приложения CASE OS Geo Analytics: балл = 0,55 x спрос + 0,45 x (1 - конкуренты / эталон). Эталоны насыщения: ${BENCH.bc} бизнес-центров и ${BENCH.med} клиник в радиусе 1 км.</div>
  ${foot()}
</div>

<!-- вывод -->
<div class="pg">
  <span class="ilbl">Вывод</span>
  <div class="ih">Что данные говорят о Тахтапуле</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5mm">
    ${kpi('Офис', `${FREE_BC}%`, 'свободной ниши в радиусе 1 км')}
    ${kpi('Клиника', `${FREE_MED}%`, 'свободной ниши: насыщение превышено втрое')}
    ${kpi('Образование', 'нет данных', 'слоя учебных заведений в геобазе нет')}
  </div>
  <div class="itwo" style="margin-top:7mm">
    <div class="icard">
      <div class="ih3">Почему офис, а не клиника</div>
      ${ul([`Разница между форматами держится на конкуренции: ${C1.bc} бизнес-центра против ${C1.medCore} профильных медцентров в одном и том же километре.`,
            'Слагаемое спроса в формуле для обоих форматов одинаковое: точка одна, население вокруг одно. Оно сдвигает оба балла на одну величину и порядок не меняет.',
            `Поэтому офисный формат выигрывает у медицинского ровно на 0,45 x (${FREE_BC}% - ${FREE_MED}%) = ${Math.round(0.45 * (FREE_BC - FREE_MED))} балла из 100, независимо от того, какой окажется цифра населения.`])}
    </div>
    <div class="icard acc">
      <div class="ih3">Чего в данных не хватает</div>
      ${ul(['<b>Население по точке.</b> Откалиброванных цифр по Шайхантахуру у нас нет. Собственная сетка населения помечена источником как непроверенная по единицам и на другом объекте занижала в пять раз, поэтому в этот документ она не попала.',
            '<b>Образовательные учреждения.</b> Слой не собран - без него учебный центр и школа сравниваются словами, а не баллами.',
            '<b>Ставки аренды по соседним БЦ.</b> В базе есть их адреса и расстояния, но не условия. Это следующий шаг, если формат офиса подтверждается.'])}
    </div>
  </div>
  <div class="inote" style="margin-top:5mm">Геоаналитика описывает окружение объекта и насыщенность ниш, но не заменяет финансовую модель: доходность формата считается отдельно, по ставке аренды и составу арендаторов.</div>
  ${foot()}
</div>
`;
}

module.exports = { count, html, divider };
