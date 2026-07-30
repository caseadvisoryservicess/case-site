/**
 * Инвестиционный меморандум Botanica на русском (PDF, A4 альбомная).
 *
 * Отдельный документ, а не публичная брошюра проекта: здесь есть цены входа и
 * выхода, доходность и расчёт сделки. Правило «на лендинге цен нет» остаётся в
 * силе, поэтому файл называется invest-ru.pdf, шаблон лендинга его не
 * подхватывает и на сайт он не попадает - только в панель и владельцу в руки.
 *
 * Источники цифр:
 *   1. Botanica_Ozon_Investment_Presentation.pdf (владелец, 2026-07-30):
 *      вход 1 360 $/м² с НДС, выход 2 500 $/м² (3 кв. 2027, после кадастра),
 *      прибыль 1 140 $/м², ROI 83,8% за цикл ~14 мес, IRR 65-70%,
 *      аренда 25 $/м² в месяц, 300 $/м² в год, валовая доходность 22,05%,
 *      окупаемость 4,5 года; сток классов A и B 665 тыс. м², рост с 210 тыс. м²
 *      в 2021, ввод 192 тыс. м² в 2025, поглощение 79 тыс. м².
 *   2. Tashkent_Development_Ecosystem_V2 (владелец, 2026-07-30):
 *      ставка класса A 32-34 $/м² в месяц, вакантность класса A до 58%,
 *      стрит-ритейл в центре 26-28 $/м², OPEX около 3 $/м², офисный сток
 *      около 520 тыс. м² (рекордный ввод), торговые площади 478,5 тыс. м².
 *   3. Площади и характеристики здания - project.json (экспликации чертежей).
 *
 * Запуск (локально, нужен Playwright): node scripts/gen-invest-botanica.js
 * Результат: data/projects/botanica/uploads/invest-ru.pdf
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const SLUG = 'botanica';
const UP = path.join(ROOT, 'data', 'projects', SLUG, 'uploads');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'projects', SLUG, 'project.json'), 'utf8'));

const TH = (cfg.site && cfg.site.theme) || {};
const BRONZE = TH.accent || '#a3854c', INK = TH.ink || '#1c2a22', MUTED = TH.muted || '#5f6b62',
      BG = TH.bg || '#f7f4ed', DARK = TH.dark || '#1e362a';
const rgbOf = (hex) => { const h = String(hex).replace('#', ''); const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) || 0).join(','); };
const ACC_RGB = rgbOf(BRONZE);
const CODE = (cfg.site && cfg.site.code) || 'BOTANICA';
const PHONE = (cfg.contacts && cfg.contacts.phone) || '';
const TG = (cfg.contacts && cfg.contacts.telegram) || '';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const img64 = (name) => {
  const ext0 = path.extname(name), base = name.slice(0, -ext0.length);
  const pick = [base + '-1280' + ext0, name].find((f) => fs.existsSync(path.join(UP, f))) || name;
  const p = path.join(UP, pick);
  if (!fs.existsSync(p)) return '';
  const ext = path.extname(pick).slice(1).toLowerCase();
  return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${fs.readFileSync(p).toString('base64')}`;
};

const TOTAL = 8;
const CSS = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, "Segoe UI", Roboto, "DejaVu Sans", Arial, sans-serif; color: ${INK}; }
.pg { width: 297mm; height: 210mm; page-break-after: always; position: relative; overflow: hidden; background: ${BG}; padding: 16mm 18mm 14mm; display: flex; flex-direction: column; }
.pg:last-child { page-break-after: auto; }
.lbl { display: inline-block; font-size: 8.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${BRONZE}; margin-bottom: 5mm; }
h2 { font-size: 23pt; font-weight: 800; letter-spacing: -.01em; margin-bottom: 6mm; line-height: 1.15; }
h3 { font-size: 12pt; font-weight: 800; margin-bottom: 3mm; }
.foot { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 8pt; color: ${MUTED}; }
.foot b { color: ${INK}; font-weight: 700; letter-spacing: .08em; }
.card { background: #fff; border-radius: 4mm; padding: 6mm 7mm; }
.card.acc { background: rgba(${ACC_RGB}, .1); }
.kpi { background: #fff; border-radius: 4mm; padding: 6mm; display: flex; flex-direction: column; justify-content: center; }
.kpi .k { font-size: 8pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: ${BRONZE}; }
.kpi .v { font-size: 25pt; font-weight: 800; letter-spacing: -.02em; margin-top: 2mm; }
.kpi .s { font-size: 9pt; color: ${MUTED}; margin-top: 1.5mm; line-height: 1.4; }
ul { list-style: none; }
li { font-size: 10pt; line-height: 1.55; margin-bottom: 2.6mm; padding-left: 5mm; position: relative; }
li::before { content: ''; position: absolute; left: 0; top: 2.2mm; width: 2mm; height: 2mm; border-radius: 50%; background: ${BRONZE}; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 4mm; overflow: hidden; }
th { text-align: left; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: ${MUTED}; padding: 4mm 5mm 3mm; border-bottom: .5pt solid #ddd; }
td { padding: 4mm 5mm; font-size: 10.5pt; border-bottom: .4pt solid #eee; }
tr:last-child td { border-bottom: none; }
td.n { text-align: right; font-weight: 800; white-space: nowrap; }
.note { font-size: 8pt; color: ${MUTED}; line-height: 1.5; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; flex: 1; min-height: 0; }
.conf { position: absolute; right: 18mm; top: 14mm; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase; color: ${MUTED}; }
`;

const foot = (n) => `<div class="foot"><span><b>${esc(CODE)}</b> · Богишамол 151 · Ташкент</span>
  <span>CASE Real Estate Advisory · ${esc(PHONE)} · caseadvisory.uz</span><span>${n} / ${TOTAL}</span></div>`;

const kpi = (k, v, s) => `<div class="kpi"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
const rows = (arr) => arr.map(([a, b]) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`).join('');

const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">
<title>Бизнес-центр Botanica - инвестиционный меморандум</title><style>${CSS}</style></head><body>

<div class="pg" style="background:${DARK};color:#fff;justify-content:center">
  <img src="${img64('case-logo.png')}" style="position:absolute;left:18mm;top:14mm;height:11mm">
  <div class="conf" style="color:rgba(255,255,255,.5)">конфиденциально</div>
  <div style="font-size:9pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:${BRONZE};margin-bottom:6mm">Инвестиционный меморандум</div>
  <div style="font-size:40pt;font-weight:800;letter-spacing:-.02em;line-height:1.05">Бизнес-центр Botanica</div>
  <div style="font-size:13pt;color:rgba(255,255,255,.75);margin-top:4mm">Ташкент, Юнусабадский район, улица Богишамол 151 · напротив Ботанического сада</div>
  <div style="display:flex;gap:8mm;margin-top:12mm">
    ${[['1 360 $/м²', 'цена входа на этапе строительства, с НДС'],
       ['2 500 $/м²', 'ориентир цены после ввода, 3 кв. 2027'],
       ['22,05%', 'валовая доходность аренды при 25 $/м² в месяц']]
      .map(([v, s]) => `<div style="flex:1;background:rgba(255,255,255,.07);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:6mm">
        <div style="font-size:20pt;font-weight:800;letter-spacing:-.02em">${v}</div>
        <div style="font-size:9pt;color:rgba(255,255,255,.7);margin-top:2mm;line-height:1.4">${s}</div></div>`).join('')}
  </div>
  <div style="margin-top:10mm;font-size:9pt;color:rgba(255,255,255,.55);line-height:1.5">
    Документ подготовлен CASE Real Estate Advisory для переговоров со стратегическим инвестором.<br>
    Цифры доходности - расчёт собственника, не является публичной офертой и инвестиционной рекомендацией.
  </div>
</div>

<div class="pg">
  <span class="lbl">Объект</span>
  <h2>Что покупается</h2>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:1.05;display:flex;flex-direction:column;gap:5mm;min-height:0">
      <table>
        ${rows([
          ['Общая площадь (GBA)', '3 902,4 м²'],
          ['Арендопригодная площадь (GLA)', '2 575,4 м²'],
          ['Уровни', 'подвал и 7 этажей'],
          ['Типовой этаж', 'GBA 500,4 м² · GLA 337,9 м²'],
          ['Высота этажа', '4,2 м первый · 3,3 м типовой'],
          ['Сетка колонн', '5-5-6-5-5 на 6-6-6 м'],
          ['Габарит здания', '26 x 18 м'],
          ['Парковка', 'около 30 мест (уточняется)']
        ])}
      </table>
      <div class="card acc" style="font-size:10pt;line-height:1.55">Площади приведены по экспликациям рабочих чертежей: итог экспликации каждого листа принят как общая площадь этажа. Подвал 438,92 м², первый этаж 461,15 м², этажи со второго по седьмой по 500,39 м².</div>
    </div>
    <div style="flex:.95;display:flex;flex-direction:column;gap:5mm;min-height:0">
      <div style="flex:1;border-radius:4mm;overflow:hidden;position:relative;min-height:0">
        <img src="${img64('render-aerial.jpg')}" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.6);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">визуализация</span>
      </div>
      <div class="card" style="font-size:10pt;line-height:1.55">
        <h3>Локация</h3>
        Первая линия Богишамол напротив Ботанического сада. В радиусе одного километра живёт 20 959 человек, в трёх километрах - 218 966. Ближайшее метро Шахристан в 2,4 км. По соседству IT Park Uzbekistan и Государственный институт искусств и культуры.
      </div>
    </div>
  </div>
  ${foot(2)}
</div>

<div class="pg">
  <span class="lbl">Executive summary</span>
  <h2>Инвестиционный профиль</h2>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5mm">
    ${kpi('Цена входа', '$1 360', 'за м², с НДС, на этапе строительства')}
    ${kpi('Цена выхода', '$2 500', 'за м², 3 кв. 2027 после получения кадастра')}
    ${kpi('Потенциал ROI', '+83,8%', 'за цикл около 14 месяцев')}
    ${kpi('Доходность аренды', '22,05%', 'валовая, при ставке 25 $/м² в месяц')}
  </div>
  <div class="two" style="margin-top:7mm">
    <div class="card">
      <h3>Две стратегии на одном активе</h3>
      <ul>
        <li><b>Капитализация.</b> Вход на этапе строительства, выход после ввода и кадастра. Прибыль 1 140 $ с каждого квадратного метра.</li>
        <li><b>Арендный бизнес.</b> Удержание актива, валютный поток 300 $ с квадратного метра в год, окупаемость вложений 4,5 года.</li>
        <li><b>Комбинация.</b> Часть площадей под собственный офис, часть в аренду или под продажу после ввода.</li>
      </ul>
    </div>
    <div class="card acc">
      <h3>Почему сейчас</h3>
      <ul>
        <li>Девелоперы замораживают старт новых проектов из-за конкуренции - предложение 2027-2028 годов ограничено.</li>
        <li>Текущий объём нового предложения рынок поглощает за два-три года.</li>
        <li>Арендаторы переходят из старых зданий в новые с современной инженерией.</li>
        <li>Покупка на этапе строительства фиксирует стоимость в валюте до ввода.</li>
      </ul>
    </div>
  </div>
  ${foot(3)}
</div>

<div class="pg">
  <span class="lbl">Макроконтекст</span>
  <h2>Офисный рынок Ташкента: от дефицита к качеству</h2>
  <div class="two">
    <div style="display:flex;flex-direction:column;gap:5mm;min-height:0">
      <table>
        <tr><th>Показатель рынка</th><th style="text-align:right">Значение</th></tr>
        ${rows([
          ['Сток классов A и B, 2026', '665 тыс. м²'],
          ['Было в 2021 году', '210 тыс. м²'],
          ['Введено в 2025 году', '192 тыс. м²'],
          ['Поглощение за 2025 год', '79 тыс. м²'],
          ['Ставка класса A', '32-34 $/м² в месяц'],
          ['Вакантность класса A', 'до 58%'],
          ['Эксплуатация (OPEX)', 'около 3 $/м² в месяц']
        ])}
      </table>
      <div class="note">Сток классов A и B приведён без учёта трёх башен Tashkent City (более 220 тыс. м²). Источники: аналитика рынка 2024-2025 и данные собственника, июль 2026.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5mm">
      <div class="card">
        <h3>Что происходит</h3>
        <ul>
          <li>Рынок вырос втрое за пять лет, и рекордный ввод 2025 года создал временный профицит предложения.</li>
          <li>Высокая вакантность класса A сосредоточена в новых башнях: она отражает не отсутствие спроса, а разовый выброс площадей.</li>
          <li>Поглощение держится на уровне 79 тыс. м² в год, то есть текущий избыток уходит за два-три года.</li>
        </ul>
      </div>
      <div class="card acc">
        <h3>Что это значит для входа</h3>
        <ul>
          <li>Окно покупки по цене этапа строительства закрывается вместе с профицитом.</li>
          <li>К 2027-2028 годам новых проектов будет меньше: старт заморожен уже сейчас.</li>
          <li>Botanica выходит на рынок к моменту, когда избыток предложения будет поглощён.</li>
        </ul>
      </div>
    </div>
  </div>
  ${foot(4)}
</div>

<div class="pg">
  <span class="lbl">Требования рынка</span>
  <h2>Чего просят корпоративные арендаторы</h2>
  <div class="two">
    <div class="card">
      <h3>Боли арендаторов</h3>
      <ul>
        <li>Надёжность инженерных систем и климат-контроля.</li>
        <li>Профессиональная управляющая компания, предсказуемый OPEX.</li>
        <li>Гибкость собственника и прозрачные условия сделки.</li>
        <li>Обоснованная ставка при высоком уровне комфорта.</li>
      </ul>
      <div class="note" style="margin-top:4mm">Источник: опрос арендаторов AmCham.</div>
    </div>
    <div class="card acc">
      <h3>Ответ Botanica</h3>
      <ul>
        <li>Инженерия подбирается под класс здания, а не под минимальную смету.</li>
        <li>Управление зданием по международным стандартам, ориентир OPEX около 3 $/м² в месяц.</li>
        <li>Свободная планировка: открытый формат или кабинетная нарезка на выбор арендатора.</li>
        <li>Прямой диалог с собственником: условия обсуждаются, а не выдаются готовым бланком.</li>
      </ul>
    </div>
  </div>
  ${foot(5)}
</div>

<div class="pg">
  <span class="lbl">Стратегия 1</span>
  <h2>Капитализация: вход на стройке, выход после ввода</h2>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:1.1">
      <table>
        <tr><th>Параметр сделки</th><th style="text-align:right">Значение</th></tr>
        ${rows([
          ['Цена приобретения сейчас', '1 360 $/м² с НДС'],
          ['Цена реализации, 3 кв. 2027', '2 500 $/м²'],
          ['Прибыль с квадратного метра', '1 140 $'],
          ['Возврат на вложенное (ROI)', '83,8%'],
          ['Горизонт цикла', 'около 14 месяцев'],
          ['Годовая доходность (IRR)', '65-70%']
        ])}
      </table>
      <div class="note" style="margin-top:4mm">Расчёт собственника. Цена выхода - ориентир по рынку на момент получения кадастра, не гарантия.</div>
    </div>
    <div style="flex:.9;display:flex;flex-direction:column;gap:5mm">
      <div class="card">
        <h3>Пример на одном этаже</h3>
        <ul>
          <li>Типовой этаж 500,39 м² по общей площади.</li>
          <li>Вход: 500,39 x 1 360 = 680,5 тыс. $.</li>
          <li>Выход: 500,39 x 2 500 = 1,25 млн $.</li>
          <li>Разница: около 570 тыс. $ на этаж.</li>
        </ul>
      </div>
      <div class="card acc">
        <h3>Что определяет результат</h3>
        <ul>
          <li>Срок ввода и получения кадастра.</li>
          <li>Состояние рынка в 2027 году и глубина поглощения текущего профицита.</li>
          <li>Объём блока: крупный лот торгуется иначе, чем отдельный этаж.</li>
        </ul>
      </div>
    </div>
  </div>
  ${foot(6)}
</div>

<div class="pg">
  <span class="lbl">Стратегия 2</span>
  <h2>Арендный бизнес: валютный поток и защита капитала</h2>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:1.1">
      <table>
        <tr><th>Параметр модели</th><th style="text-align:right">Значение</th></tr>
        ${rows([
          ['Инвестиции на входе', '1 360 $/м²'],
          ['Ожидаемая арендная ставка', '25 $/м² в месяц'],
          ['Годовой поток с квадратного метра', '300 $'],
          ['Валовая доходность (Gross Yield)', '22,05% годовых в валюте'],
          ['Окупаемость вложений', '4,5 года'],
          ['Ориентир эксплуатационных затрат', 'около 3 $/м² в месяц']
        ])}
      </table>
      <div class="note" style="margin-top:4mm">Доходность указана до вычета эксплуатационных расходов, налогов и простоя. Чистая доходность считается индивидуально в финансовой модели CASE.</div>
    </div>
    <div style="flex:.9;display:flex;flex-direction:column;gap:5mm">
      <div class="card">
        <h3>Здание целиком</h3>
        <ul>
          <li>GLA 2 575,4 м² при ставке 25 $/м² - около 773 тыс. $ валового дохода в год.</li>
          <li>При заполняемости 90% - около 695 тыс. $.</li>
          <li>Ставка рынка для класса A сегодня 32-34 $/м², то есть в расчёте заложен запас.</li>
        </ul>
      </div>
      <div class="card acc">
        <h3>Кому подходит</h3>
        <ul>
          <li>Инвестору, которому нужен валютный поток, а не разовая прибыль.</li>
          <li>Компании, готовой занять часть здания и сдавать остальное.</li>
          <li>Фонду, который заходит на этапе строительства и выходит после стабилизации.</li>
        </ul>
      </div>
    </div>
  </div>
  ${foot(7)}
</div>

<div class="pg" style="background:${DARK};color:#fff">
  <span class="lbl">Стратегическому партнёру</span>
  <h2 style="color:#fff">Зачем Botanica крупной компании</h2>
  <div style="display:flex;gap:8mm;flex:1;min-height:0">
    <div style="flex:1.15;display:flex;flex-direction:column;gap:5mm">
      <div style="background:rgba(255,255,255,.07);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:6mm 7mm">
        <ul style="color:rgba(255,255,255,.85)">
          <li style="color:rgba(255,255,255,.85)">Флагманское присутствие: собственный корпоративный центр в новом бизнес-центре Ташкента.</li>
          <li style="color:rgba(255,255,255,.85)">Фиксация стоимости в валюте на этапе строительства - защита от инфляции и курса.</li>
          <li style="color:rgba(255,255,255,.85)">Возможность выкупа этажа или крупного блока на индивидуальных условиях.</li>
          <li style="color:rgba(255,255,255,.85)">Свободная планировка под собственные регламенты размещения.</li>
        </ul>
      </div>
      <div style="background:rgba(${ACC_RGB},.18);border-radius:4mm;padding:5mm 6mm;font-size:10pt;line-height:1.55;color:rgba(255,255,255,.9)">
        Формат сделки обсуждается: покупка блока, аренда с последующим выкупом или долгосрочная аренда с фиксацией ставки на весь срок.
      </div>
    </div>
    <div style="flex:.85;display:flex;flex-direction:column;justify-content:center;gap:4mm">
      <div style="font-size:14pt;font-weight:800">Обсудим условия</div>
      <div style="font-size:20pt;font-weight:800;letter-spacing:-.01em">${esc(PHONE)}</div>
      <div style="font-size:11pt;color:rgba(255,255,255,.75)">t.me/${esc(TG)} · caseadvisory.uz/botanica/</div>
      <div style="font-size:9pt;color:rgba(255,255,255,.55);line-height:1.55;margin-top:4mm">
        CASE Real Estate Advisory выступает агентом собственника по коммерциализации проекта.
        Информация носит справочный характер, не является публичной офертой и инвестиционной рекомендацией.
        Цифры доходности - расчёт собственника, фактический результат зависит от рынка на момент сделки.
      </div>
      <img src="${img64('case-logo.png')}" style="height:11mm;width:auto;margin-top:4mm;align-self:flex-start">
    </div>
  </div>
  <div class="foot" style="color:rgba(255,255,255,.5)"><span><b style="color:#fff">${esc(CODE)}</b> · Богишамол 151 · Ташкент</span>
    <span>Конфиденциально</span><span>${TOTAL} / ${TOTAL}</span></div>
</div>

</body></html>`;

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-invest-'));
  try {
    const page = await browser.newPage();
    const file = path.join(tmpDir, 'invest.html');
    fs.writeFileSync(file, html.replace(/[—–]/g, '-'));   // правило: только короткий дефис
    await page.goto('file://' + file, { waitUntil: 'networkidle' });
    const out = path.join(UP, 'invest-ru.pdf');
    await page.pdf({ path: out, format: 'A4', landscape: true, printBackground: true });
    console.log('Готово:', out, (fs.statSync(out).size / 1024 / 1024).toFixed(1) + ' МБ');
  } finally {
    await browser.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
