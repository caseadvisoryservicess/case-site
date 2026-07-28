/**
 * Генерация PDF-презентаций проекта на трёх языках (A4 альбомная).
 *
 * Контент берётся из project.json (переводы полей - те же, что на лендинге),
 * служебные подписи - из словаря T ниже, проектные переопределения - в cfg.pres.
 *
 * Два режима, выбор по cfg.site.assetType:
 *   building (по умолчанию) - здание: обложка, о проекте, таблица помещений,
 *     страницы планировок, сценарии, формат сделки, локация, визуализации,
 *     контакты. Всего 8 + число страниц планировок.
 *   land - земельный участок: у него нет этажей, GLA и планировок, поэтому
 *     набор другой: обложка, об участке (таблица параметров), кому подходит,
 *     формат сделки, локация, визуализации, контакты. Всего 7 страниц.
 *
 * Запуск (локально, нужен Playwright+Chromium):
 *   node scripts/gen-presentation.js [slug]
 * Результат: uploads/presentation.pdf (RU), presentation-uz.pdf, presentation-en.pdf
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SLUG = process.argv[2] || 'takhtapul';
const UP = path.join(ROOT, 'data', 'projects', SLUG, 'uploads');

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'projects', SLUG, 'project.json'), 'utf8'));
const SITE = String(cfg.seo.publicUrl || '').replace(/\/+$/, '') + '/';
// проектные переопределения брошюры: cfg.pres = { elev, plans, planPages, T: {...} }
const PRES = cfg.pres || {};

// значение мультиязычного поля с фолбэком на русский
const L = (v, lang) => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  const t = v[lang];
  return (t && String(t).trim()) ? t : (v.ru || '');
};

// GBA по уровням берём из юнитов конфига
const GBA = {};
for (const u of cfg.units || []) if (u.gba) GBA[u.id] = u.gba;
// отметки этажей и листы планов - из cfg.pres, по умолчанию значения Тахтапула
const ELEV = PRES.elev || { b: '-', f1: '±0.000', f2: '+4.300', f3: '+8.200', f4: '+12.100' };
const PLAN_CAD = PRES.plans || { b: 'plan-cad-b.jpg', f1: 'plan-cad-f1.jpg', f2: 'plan-cad-f23.jpg', f3: 'plan-cad-f23.jpg', f4: 'plan-cad-f4.jpg' };
// какие уровни показывать отдельными страницами планировок
const PLAN_PAGES = PRES.planPages || [{ id: 'b' }, { id: 'f1' }, { id: 'f2', title: 'f23_title' }, { id: 'f4' }];
// земельный участок: другой состав страниц, планировок и этажей у него нет
// именованные менеджеры: если заданы, на странице контактов показываем их,
// а не один обезличенный номер
const PEOPLE = ((cfg.contacts || {}).people || []).filter((p) => p && p.phone);
// страницы фотосетки: объект, который продаётся глазами, показываем целиком,
// а не тремя кадрами. Источник - cfg.photos.images, по 6 снимков на лист.
const GRID_IMGS = (PRES.gridImgs || ((cfg.photos && cfg.photos.images) || []).map((g) => g.file)).filter(Boolean);
// подпись кадра в сетке: из cfg.photos.images[].badge, если задана
const badgeOf2 = (file, lang) => {
  const g = ((cfg.photos && cfg.photos.images) || []).find((x) => x.file === file);
  return g && g.badge ? L(g.badge, lang) : '';
};
const GRID_PAGES = [];
for (let i = 0; i < GRID_IMGS.length; i += 6) GRID_PAGES.push(GRID_IMGS.slice(i, i + 6));
const AT = (cfg.site && cfg.site.assetType) || 'building';
const LAND = AT === 'land' || AT === 'single';
const TOTAL = LAND ? 7 + GRID_PAGES.length : 8 + PLAN_PAGES.length;
const planImg = (u) => {
  const cad = PLAN_CAD[u.id];
  return (cad && fs.existsSync(path.join(UP, cad))) ? cad : u.plan;
};

// служебные подписи презентации
const T = {
  addr: { ru: 'Тахтапул, 31 · Ташкент', uz: 'Taxtapul 31 · Toshkent', en: '31 Taxtapul St · Tashkent' },
  cover_glaAll: { ru: 'GLA всего', uz: 'umumiy GLA', en: 'total GLA' },
  cover_levels: { ru: 'уровней', uz: 'daraja', en: 'levels' },
  cover_parking: { ru: 'машиномест', uz: 'avtoturargoh', en: 'parking spaces' },
  cover_ceil: { ru: 'потолки', uz: 'shiftlar', en: 'ceilings' },
  lbl_about: { ru: 'О проекте', uz: 'Loyiha haqida', en: 'About the project' },
  h_about: { ru: 'Отдельно стоящее здание со свободной планировкой', uz: 'Erkin planirovkali alohida bino', en: 'A standalone open-plan building' },
  card_gla: { ru: 'арендопригодная площадь (GLA)', uz: 'ijaraga yaroqli maydon (GLA)', en: 'leasable area (GLA)' },
  card_gba: { ru: 'общая площадь (GBA)', uz: 'umumiy maydon (GBA)', en: 'gross building area (GBA)' },
  card_lvl_n: { ru: '5 уровней', uz: '5 daraja', en: '5 levels' },
  card_lvl_s: { ru: 'подвал + 4 этажа, лифт', uz: 'podval + 4 qavat, lift', en: 'basement + 4 floors, lift' },
  card_park_n: { ru: '12 мест', uz: '12 joy', en: '12 spaces' },
  card_park_s: { ru: 'паркинг: 6 подземных + 6 наземных', uz: 'avtoturargoh: 6 yer osti + 6 yer usti', en: 'parking: 6 underground + 6 surface' },
  lbl_units: { ru: 'Помещения', uz: 'Maydonlar', en: 'Premises' },
  h_units: { ru: 'Пять уровней - от этажа до здания целиком', uz: 'Besh daraja - qavatdan butun binogacha', en: 'Five levels - from one floor to the whole building' },
  th_level: { ru: 'Уровень', uz: 'Daraja', en: 'Level' },
  th_elev: { ru: 'Отметка', uz: 'Belgi', en: 'Elevation' },
  th_ceil: { ru: 'Потолки', uz: 'Shift', en: 'Ceiling' },
  th_use: { ru: 'Возможное использование', uz: 'Mumkin bo‘lgan foydalanish', en: 'Suggested use' },
  th_status: { ru: 'Статус', uz: 'Holat', en: 'Status' },
  st_available: { ru: 'Свободно', uz: 'Bo‘sh', en: 'Available' },
  st_reserved: { ru: 'Резерв', uz: 'Band qilingan', en: 'Reserved' },
  st_leased: { ru: 'Сдано', uz: 'Ijaraga berilgan', en: 'Leased' },
  st_sold: { ru: 'Продано', uz: 'Sotilgan', en: 'Sold' },
  units_note: {
    ru: 'Цены и условия - по запросу. Возможна аренда, покупка отдельного этажа или здания целиком, аренда с последующим выкупом.',
    uz: 'Narxlar va shartlar - so‘rov bo‘yicha. Ijara, alohida qavat yoki butun binoni sotib olish, keyinchalik sotib olish sharti bilan ijara mumkin.',
    en: 'Prices and terms on request. Lease, purchase of a floor or the whole building, and lease with option to buy are available.'
  },
  lbl_plan: { ru: 'Планировка', uz: 'Planirovka', en: 'Floor plan' },
  f23_title: { ru: '2 и 3 этажи (идентичные)', uz: '2 va 3-qavatlar (bir xil)', en: 'Floors 2 and 3 (identical)' },
  plan_ceil: { ru: 'Потолки (в свету)', uz: 'Shift (toza balandlik)', en: 'Ceiling (clear)' },
  plan_use: { ru: 'Использование', uz: 'Foydalanish', en: 'Use' },
  plan_note: {
    ru: 'Схема по рабочим чертежам, не является точным обмером. Свободная планировка: колонны 5 950 / 7 150 / 5 950 мм и лифтовое ядро.',
    uz: 'Ish chizmalari asosidagi sxema, aniq o‘lchov emas. Erkin planirovka: 5 950 / 7 150 / 5 950 mm kolonnalar va lift yadrosi.',
    en: 'Diagram based on working drawings, not a survey. Open plan: columns at 5,950 / 7,150 / 5,950 mm and the lift core.'
  },
  lbl_cases: { ru: 'Сценарии использования', uz: 'Foydalanish stsenariylari', en: 'Use cases' },
  deal_note: { ru: 'Цены и условия - по запросу:', uz: 'Narxlar va shartlar - so‘rov bo‘yicha:', en: 'Prices and terms on request:' },
  lbl_loc: { ru: 'Локация', uz: 'Lokatsiya', en: 'Location' },
  loc_car: { ru: 'На автомобиле', uz: 'Avtomobilda', en: 'By car' },
  loc_coord: { ru: 'Координаты', uz: 'Koordinatalar', en: 'Coordinates' },
  loc_first: {
    ru: 'Первая линия улицы Тахтапул, выезд на Малую кольцевую - рядом. Объект для клиентов, приезжающих на автомобиле: паркинг у входа и подземный уровень.',
    uz: 'Taxtapul ko‘chasining birinchi qatori, Kichik halqa yo‘liga chiqish - yonida. Avtomobilda keladigan mijozlar uchun obyekt: kiraverishda va yer osti qavatida avtoturargoh.',
    en: 'First line of Taxtapul Street, the Small Ring Road access is adjacent. Built for clients arriving by car: parking at the door and an underground level.'
  },
  lbl_viz: { ru: 'Визуализации', uz: 'Vizualizatsiyalar', en: 'Visualisations' },
  h_viz: { ru: 'Внешний облик', uz: 'Tashqi ko‘rinish', en: 'Exterior' },
  viz_one: { ru: 'визуализация', uz: 'vizualizatsiya', en: 'visualisation' },
  viz_p: {
    ru: 'Витражное остекление по всему периметру, кровельная терраса с перголой и вечерняя архитектурная подсветка. На фасаде предусмотрено место под вывеску арендатора - здание работает на узнаваемость вашего бренда.',
    uz: 'Butun perimetr bo‘ylab vitraj oynalar, pergolali tom terrasasi va kechki arxitektura yoritilishi. Fasadda ijarachi peshlavhasi uchun joy ko‘zda tutilgan - bino brendingiz tanilishiga xizmat qiladi.',
    en: 'Floor-to-ceiling glazing around the perimeter, a rooftop terrace with a pergola and evening architectural lighting. The facade provides space for the tenant’s signage - the building works for your brand visibility.'
  },
  viz_all: {
    ru: 'Все изображения - визуализации проекта, не являются публичной офертой.',
    uz: 'Barcha tasvirlar - loyiha vizualizatsiyalari, ommaviy oferta emas.',
    en: 'All images are project visualisations and do not constitute a public offer.'
  },
  c_h: { ru: 'Обсудим ваш формат?', uz: 'Formatingizni muhokama qilamizmi?', en: 'Shall we discuss your format?' },
  c_s: { ru: 'Ответим в течение дня - площадь, срок, порядок входа.', uz: 'Kun davomida javob beramiz - maydon, muddat, kirish tartibi.', en: 'We reply within the day - area, term, entry terms.' },
  c_qr: { ru: 'Наведите камеру - откроется сайт проекта', uz: 'Kamerani yo‘naltiring - loyiha sayti ochiladi', en: 'Point your camera to open the project website' },
  c_legal: { ru: 'Информация справочная, не является публичной офертой', uz: 'Ma’lumot xarakteriga ega, ommaviy oferta emas', en: 'For reference only, not a public offer' },
  // подписи режима «земельный участок»
  lbl_land: { ru: 'Участок', uz: 'Uchastka', en: 'The plot' },
  h_grid: { ru: 'Помещение изнутри', uz: 'Maydon ichkaridan', en: 'Inside the space' },
  th_param: { ru: 'Параметр', uz: 'Parametr', en: 'Parameter' },
  th_value: { ru: 'Значение', uz: 'Qiymat', en: 'Value' },
  land_deal: { ru: 'Стоимость и условия сделки - по запросу:', uz: 'Bitim narxi va shartlari - so‘rov bo‘yicha:', en: 'Price and deal terms on request:' },
  land_loc_zone: {
    ru: 'По генеральному плану площадка относится к территориям технологической промышленности: окружение профильное, а не жилой квартал. Границы, подъезд и соседей показываем на осмотре.',
    uz: 'Bosh reja bo‘yicha maydon texnologik sanoat hududlariga kiradi: atrof-muhit ixtisoslashgan, turar-joy kvartali emas. Chegaralar, kirish yo‘li va qo‘shnilarni ko‘rikda ko‘rsatamiz.',
    en: 'Under the master plan the site sits within a technological industry area: the surroundings are industrial rather than residential. Boundaries, access and neighbours are shown during a site visit.'
  },
  loc_dist: { ru: 'Расстояния', uz: 'Masofalar', en: 'Distances' },
  viz_concept: { ru: 'визуализация концепции', uz: 'konsepsiya vizualizatsiyasi', en: 'concept visualisation' },
  viz_all_concept: {
    ru: 'Все изображения - визуализации концепции застройки, а не фотографии участка. Публичной офертой не являются.',
    uz: 'Barcha tasvirlar - qurilish konsepsiyasi vizualizatsiyalari, uchastka fotosuratlari emas. Ommaviy oferta hisoblanmaydi.',
    en: 'All images are visualisations of a development concept, not photographs of the site. They do not constitute a public offer.'
  }
};

// для мелких ячеек сетки полноразмерный вариант не нужен: 1280 на 79 мм это
// больше 400 dpi, а вес PDF втрое меньше
const img64grid = (name) => {
  const ext0 = path.extname(name);
  const base = name.slice(0, -ext0.length);
  const pick = [base + '-1280' + ext0, base + '-640' + ext0, name].find((f) => fs.existsSync(path.join(UP, f))) || name;
  const ext = path.extname(pick).slice(1);
  return `data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${fs.readFileSync(path.join(UP, pick)).toString('base64')}`;
};

const img64 = (name) => {
  // для брошюры берём уменьшенный вариант, если пайплайн его создал:
  // оригиналы рендеров весят по 3 МБ и раздувают PDF
  const ext0 = path.extname(name);
  const base = name.slice(0, -ext0.length);
  const pick = [base + '-1920' + ext0, base + '-1280' + ext0, name].find((f) => fs.existsSync(path.join(UP, f))) || name;
  const p = path.join(UP, pick);
  const ext = path.extname(pick).slice(1);
  const mime = ext === 'svg' ? 'svg+xml' : ext === 'png' ? 'png' : 'jpeg';
  return `data:image/${mime};base64,${fs.readFileSync(p).toString('base64')}`;
};

const TH = (cfg.site && cfg.site.theme) || {};
const BRONZE = TH.accent || '#a8804c', INK = TH.ink || '#212326', MUTED = TH.muted || '#63666b',
      BG = TH.bg || '#f6f5f2', DARK = TH.dark || '#1b1d1f';
const CODE = (cfg.site && cfg.site.code) || 'TAXTAPUL';
const rgbOf = (hex) => { const h = String(hex).replace('#',''); const n = h.length===3 ? h.split('').map(c=>c+c).join('') : h;
  return [0,2,4].map(i=>parseInt(n.slice(i,i+2),16)||0).join(','); };
const ACC_RGB = rgbOf(BRONZE);

const CSS = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, "Segoe UI", Roboto, "DejaVu Sans", Arial, sans-serif; color: ${INK}; }
.pg { width: 297mm; height: 210mm; page-break-after: always; position: relative; overflow: hidden; background: ${BG}; padding: 16mm 18mm 14mm; display: flex; flex-direction: column; }
.pg:last-child { page-break-after: auto; }
.lbl { display: inline-block; font-size: 8.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${BRONZE}; margin-bottom: 5mm; }
h2 { font-size: 24pt; font-weight: 800; letter-spacing: -.01em; margin-bottom: 7mm; }
.foot { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; display: flex; justify-content: space-between; font-size: 8pt; color: ${MUTED}; }
.foot b { color: ${INK}; font-weight: 700; letter-spacing: .08em; }
table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 4mm; overflow: hidden; }
th { text-align: left; font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; color: ${MUTED}; padding: 4mm 5mm 3mm; border-bottom: .5pt solid #ddd; }
td { padding: 4.2mm 5mm; font-size: 10.5pt; border-bottom: .4pt solid #eee; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
.st { display: inline-block; font-size: 8.5pt; font-weight: 700; padding: 1.6mm 4mm; border-radius: 99px; background: #e6f4e7; color: #2e7c39; }
.st.off { background: #ececeb; color: #75787c; }
`;

// проектные строки поверх умолчаний
for (const k of Object.keys(PRES.T || {})) T[k] = Object.assign({}, T[k], PRES.T[k]);

function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

// цифры обложки и картинки: из конфига, с возможностью переопределить в cfg.pres
const factN = (re) => {
  // ищем и в фактах героя, и в ленте параметров: у разных проектов цифра лежит по-разному
  const all = [].concat(cfg.intro.facts || [], cfg.params || []);
  const f = all.find((x) => re.test((x.l && x.l.ru) || '') && x.n);
  if (!f) return '';
  return typeof f.n === 'string' ? f.n : (f.n && f.n.ru) || '';
};
const numOf = (s) => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const fmtNum = (n) => String(n).replace('.', ',');
const wholeUnit = (cfg.units || []).find((u) => u.whole) || {};
const ceils = (cfg.units || []).filter((u) => u.ceil).map((u) => u.ceil);
const COVER = Object.assign({
  gla: wholeUnit.gla || factN(/GLA/),
  gba: wholeUnit.gba || factN(/GBA/),
  levels: factN(/уровн|этаж/),
  parking: factN(/машином/),
  ceil: (() => {
    // берём исходные строки, чтобы сохранить формат: 3,0-4,0 у одного проекта, 3,60-4,05 у другого
    const ps = ceils.map((c) => [numOf(c), c]).filter((x) => !isNaN(x[0]));
    if (!ps.length) return '';
    const lo = ps.reduce((a, b) => (b[0] < a[0] ? b : a));
    const hi = ps.reduce((a, b) => (b[0] > a[0] ? b : a));
    return lo[1] === hi[1] ? lo[1] : lo[1] + '-' + hi[1];
  })()
}, PRES.cover || {});
// чертёж на странице «Об объекте» нельзя обрезать по краям: у планов там
// легенда с площадями. Для фотографии остаётся cover.
const ABOUT_FIT = PRES.aboutImgFit || 'cover';
const ABOUT_IMG = PRES.aboutImg
  || ((cfg.about.images || [])[0] || {}).file
  || cfg.intro.image;
const VIZ_IMGS = PRES.vizImgs
  || (cfg.about.images || []).slice(1, 3).map((x) => x.file).filter(Boolean);

function buildHtml(lang, qr) {
  if (LAND) return buildLandHtml(lang, qr);
  const t = (k) => T[k][lang];
  const M = (v) => esc(L(v, lang));
  const units = cfg.units.filter((u) => !u.whole);
  const whole = cfg.units.find((u) => u.whole);
  const siteShown = SITE.replace('https://', '') + (lang === 'ru' ? '' : lang + '/');
  const stLabel = (st) => t('st_' + (st || 'available')) || t('st_available');

  const foot = (n) => `<div class="foot"><span><b>${esc(CODE)}</b> · ${t('addr')}</span><span>CASE Real Estate Advisory · ${esc(cfg.contacts.phone)} · caseadvisory.uz</span><span>${n} / ${TOTAL}</span></div>`;

  const unitRow = (u) => `<tr>
    <td><b>${M(u.level)}</b></td>
    <td>${ELEV[u.id] || ''}</td>
    <td>${GBA[u.id] || ''} м²</td>
    <td><b>${esc(u.gla)} м²</b>${u.glaNote ? ` <span style="color:${MUTED};font-size:8.5pt">(${esc(u.glaNote)})</span>` : ''}</td>
    <td>${esc(u.ceil)} м</td>
    <td style="font-size:9.5pt;color:${MUTED}">${M(u.uses)}</td>
    <td><span class="st${u.status === 'available' ? '' : ' off'}">${stLabel(u.status)}</span></td>
  </tr>`;

  const planPage = (n, u, extraTitle) => `
  <div class="pg">
    <span class="lbl">${t('lbl_plan')}</span>
    <h2>${extraTitle ? esc(extraTitle) : M(u.level)}</h2>
    <div style="display:flex;gap:12mm;flex:1;min-height:0">
      <div style="flex:1.15;background:#fff;border-radius:5mm;padding:8mm;display:flex;align-items:center;justify-content:center">
        <img src="${img64(planImg(u))}" style="max-width:100%;max-height:138mm">
      </div>
      <div style="flex:.85;display:flex;flex-direction:column;gap:4mm;justify-content:center">
        ${[['GBA', (GBA[u.id] || '') + ' м²'], ['GLA', u.gla + ' м²' + (u.glaNote ? ' (' + u.glaNote + ')' : '')], [t('plan_ceil'), u.ceil + ' м'], [t('th_elev'), ELEV[u.id] || '-'], [t('plan_use'), L(u.uses, lang)]]
          .map(([k, v]) => `<div style="background:#fff;border-radius:3.5mm;padding:5mm 6mm">
            <div style="font-size:8pt;letter-spacing:.09em;text-transform:uppercase;color:${MUTED};margin-bottom:1.5mm">${esc(k)}</div>
            <div style="font-size:${k === t('plan_use') ? '11' : '15'}pt;font-weight:700">${esc(v)}</div>
          </div>`).join('')}
        <div style="font-size:8pt;color:${MUTED};margin-top:1mm">${t('plan_note')}</div>
      </div>
    </div>
    ${foot(n)}
  </div>`;

  const caseCard = (c) => `<div style="background:#fff;border-radius:4mm;padding:7mm;flex:1">
    <div style="font-size:13.5pt;font-weight:800;margin-bottom:1.5mm">${M(c.h)}</div>
    <div style="font-size:9pt;font-weight:700;color:${BRONZE};margin-bottom:3mm">${M(c.levels)}</div>
    <div style="font-size:9.5pt;line-height:1.55;color:${MUTED}">${M(c.p)}</div>
  </div>`;

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><style>${CSS}</style></head><body>

  <div class="pg" style="padding:0;background:${DARK}">
    <img src="${img64(cfg.intro.image)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,16,18,.35),rgba(15,16,18,.82))"></div>
    <div style="position:relative;margin-top:auto;padding:0 18mm 20mm;color:#fff">
      <div style="font-size:11pt;font-weight:800;letter-spacing:.2em;margin-bottom:6mm">${esc(CODE)}</div>
      <div style="font-size:32pt;font-weight:800;letter-spacing:-.01em;line-height:1.12;max-width:210mm">${M(cfg.intro.h1)}</div>
      <div style="font-size:13pt;margin-top:6mm;opacity:.9">${M(cfg.intro.sub)}</div>
      <div style="font-size:10.5pt;margin-top:3mm;opacity:.75">${M(cfg.location.address)}</div>
      <div style="display:flex;gap:14mm;margin-top:10mm;font-size:10pt">
        <span><b style="font-size:16pt">${esc(COVER.gla)} м²</b><br><span style="opacity:.75">${t('cover_glaAll')}</span></span>
        <span><b style="font-size:16pt">${esc(COVER.levels)}</b><br><span style="opacity:.75">${t('cover_levels')}</span></span>
        <span><b style="font-size:16pt">${esc(COVER.parking)}</b><br><span style="opacity:.75">${t('cover_parking')}</span></span>
        <span><b style="font-size:16pt">${esc(COVER.ceil)} м</b><br><span style="opacity:.75">${t('cover_ceil')}</span></span>
      </div>
    </div>
    <div style="position:absolute;right:18mm;bottom:20mm;color:#fff;font-size:9pt;opacity:.8">CASE Real Estate Advisory</div>
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_about')}</span>
    <h2>${t('h_about')}</h2>
    <div style="display:flex;gap:12mm;flex:1;min-height:0">
      <div style="flex:1;display:flex;flex-direction:column;gap:5mm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm">
          ${[[esc(COVER.gla) + ' м²', t('card_gla')], [esc(COVER.gba) + ' м²', t('card_gba')], [t('card_lvl_n'), t('card_lvl_s')], [t('card_park_n'), t('card_park_s')]]
            .map(([n, l]) => `<div style="background:#fff;border-radius:4mm;padding:6mm">
              <div style="font-size:17pt;font-weight:800">${n}</div>
              <div style="font-size:9pt;color:${MUTED};margin-top:1mm">${l}</div></div>`).join('')}
        </div>
        <div style="background:rgba(${ACC_RGB},.1);border-left:1.2mm solid ${BRONZE};border-radius:0 3mm 3mm 0;padding:5mm 6mm;font-size:10.5pt;line-height:1.5">${M(cfg.about.status)}</div>
        <div style="font-size:9.5pt;color:${MUTED};line-height:1.55">${M(cfg.unitsSection.note)} ${M(cfg.about.sfbNote)}</div>
      </div>
      <div style="flex:1;border-radius:5mm;overflow:hidden;position:relative">
        <img src="${img64(ABOUT_IMG)}" style="width:100%;height:100%;object-fit:cover">
        <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.6);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">${t('viz_one')}</span>
      </div>
    </div>
    ${foot(2)}
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_units')}</span>
    <h2>${t('h_units')}</h2>
    <table>
      <tr><th>${t('th_level')}</th><th>${t('th_elev')}</th><th>GBA</th><th>GLA</th><th>${t('th_ceil')}</th><th>${t('th_use')}</th><th>${t('th_status')}</th></tr>
      ${units.map(unitRow).join('')}
      <tr style="background:${BG}">
        <td><b>${M(whole.level)}</b></td><td></td><td><b>${esc(whole.gba || '')} м²</b></td><td><b>${esc(whole.gla || '')} м²</b></td><td></td>
        <td style="font-size:9.5pt;color:${MUTED}">${M(whole.uses)}</td>
        <td><span class="st${whole.status === 'available' ? '' : ' off'}">${stLabel(whole.status)}</span></td>
      </tr>
    </table>
    <div style="margin-top:5mm;font-size:9pt;color:${MUTED}">${t('units_note')}</div>
    ${foot(3)}
  </div>

  ${PLAN_PAGES.map((pp, i) => {
      const u = units.find((x) => x.id === pp.id);
      return u ? planPage(4 + i, u, pp.title ? t(pp.title) : '') : '';
    }).join('')}

  <div class="pg">
    <span class="lbl">${t('lbl_cases')}</span>
    <h2>${M(cfg.useCases.h2)}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6mm;flex:1;align-content:start">
      ${cfg.useCases.cards.map(caseCard).join('')}
    </div>
    ${foot(4 + PLAN_PAGES.length)}
  </div>

  <div class="pg" style="background:${DARK};color:#fff">
    <span class="lbl">${M(cfg.scenarios.h2)}</span>
    <h2 style="color:#fff">${M(cfg.scenarios.h2)}</h2>
    <div style="display:flex;gap:6mm;flex:1;align-items:stretch">
      ${cfg.scenarios.cols.map((c) => `<div style="flex:1;background:rgba(255,255,255,.06);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:8mm">
        <div style="font-size:14pt;font-weight:800;margin-bottom:4mm">${M(c.h)}</div>
        <div style="font-size:10pt;line-height:1.6;color:rgba(255,255,255,.78)">${M(c.p)}</div>
      </div>`).join('')}
    </div>
    <div style="margin-top:6mm;font-size:10pt;color:rgba(255,255,255,.65)">${t('deal_note')} ${esc(cfg.contacts.phone)} · t.me/${esc(cfg.contacts.telegram)}</div>
    <div class="foot" style="color:rgba(255,255,255,.5)"><span><b style="color:#fff">${esc(CODE)}</b> · ${t('addr')}</span><span>CASE Real Estate Advisory</span><span>${5 + PLAN_PAGES.length} / ${TOTAL}</span></div>
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_loc')}</span>
    <h2>${M(cfg.location.h2)}</h2>
    <div style="display:flex;gap:12mm;flex:1">
      <div style="flex:1">
        <div style="font-size:13pt;font-weight:700;margin-bottom:6mm">${M(cfg.location.address)}</div>
        <table style="background:none">
          <tr><th colspan="2" style="padding-left:0">${t('loc_car')}</th></tr>
          ${cfg.location.drive.map((d) => `<tr><td style="padding-left:0;background:none">${M(d.to)}</td><td style="text-align:right;font-weight:700;background:none">${M(d.time)}</td></tr>`).join('')}
        </table>
        <div style="margin-top:5mm;font-size:8.5pt;color:${MUTED}">${M(cfg.location.metroNote)} · ${t('loc_coord')}: ${esc(cfg.location.lat)}, ${esc(cfg.location.lng)}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5mm">
        <div style="background:#fff;border-radius:4mm;padding:7mm;font-size:10.5pt;line-height:1.6;color:${MUTED}">${M(cfg.location.around)}</div>
        <div style="background:rgba(${ACC_RGB},.1);border-radius:4mm;padding:6mm;font-size:10.5pt;line-height:1.5">${t('loc_first')}</div>
      </div>
    </div>
    ${foot(6 + PLAN_PAGES.length)}
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_viz')}</span>
    <h2>${t('h_viz')}</h2>
    <div style="display:flex;gap:10mm;flex:1;min-height:0">
      <div style="flex:.8;display:flex;flex-direction:column;gap:5mm;justify-content:center">
        <div style="background:#fff;border-radius:4mm;padding:7mm;font-size:11pt;line-height:1.65">${t('viz_p')}</div>
        <div style="background:rgba(${ACC_RGB},.1);border-left:1.2mm solid ${BRONZE};border-radius:0 3mm 3mm 0;padding:5mm 6mm;font-size:10pt;line-height:1.5">${M(cfg.about.status)}</div>
        <div style="font-size:8.5pt;color:${MUTED}">${t('viz_all')}</div>
      </div>
      <div style="flex:1.2;display:flex;flex-direction:column;gap:5mm">
        ${VIZ_IMGS.map((f) => `<div style="flex:1;border-radius:5mm;overflow:hidden;position:relative">
          <img src="${img64(f)}" style="width:100%;height:100%;object-fit:cover">
          <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.6);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">${t('viz_one')}</span>
        </div>`).join('')}
      </div>
    </div>
    ${foot(7 + PLAN_PAGES.length)}
  </div>

  <div class="pg" style="background:${DARK};color:#fff;align-items:center;justify-content:center;text-align:center">
    <div style="font-size:10pt;font-weight:800;letter-spacing:.2em;margin-bottom:8mm">${esc(CODE)}</div>
    <div style="font-size:26pt;font-weight:800;margin-bottom:3mm">${t('c_h')}</div>
    <div style="font-size:11pt;color:rgba(255,255,255,.7);margin-bottom:10mm">${t('c_s')}</div>
    ${PEOPLE.length
      ? `<div style="display:flex;gap:16mm;justify-content:center;margin-bottom:3mm">${PEOPLE.map((p) => `<div><div style="font-size:9.5pt;color:rgba(255,255,255,.72);margin-bottom:1mm">${esc(L(p.name, lang))}</div><div style="font-size:15pt;font-weight:800">${esc(p.phone)}</div></div>`).join('')}</div>`
      : `<div style="font-size:17pt;font-weight:800;margin-bottom:2.5mm">${esc(cfg.contacts.phone)}</div>`}
    <div style="font-size:12pt;color:rgba(255,255,255,.85);margin-bottom:10mm">t.me/${esc(cfg.contacts.telegram)} · ${esc(siteShown)}</div>
    <img src="${qr}" style="width:34mm;height:34mm;border-radius:3mm">
    <div style="font-size:8.5pt;color:rgba(255,255,255,.55);margin-top:3mm">${t('c_qr')}</div>
    <div style="position:absolute;left:18mm;right:18mm;bottom:8mm;display:flex;justify-content:space-between;font-size:8pt;color:rgba(255,255,255,.45)">
      <span>CASE Real Estate Advisory · caseadvisory.uz</span><span>${t('c_legal')}</span><span>${TOTAL} / ${TOTAL}</span>
    </div>
  </div>

  </body></html>`;
}

/**
 * Брошюра земельного участка: 7 страниц.
 * У земли нет этажей, GLA и планировок, поэтому вместо таблицы помещений -
 * таблица параметров участка из cfg.about.specs, а вместо страниц планировок
 * сразу сценарии использования.
 */
function buildLandHtml(lang, qr) {
  const t = (k) => T[k][lang];
  const M = (v) => esc(L(v, lang));
  const siteShown = SITE.replace('https://', '') + (lang === 'ru' ? '' : lang + '/');
  const foot = (n) => `<div class="foot"><span><b>${esc(CODE)}</b> · ${t('addr')}</span><span>CASE Real Estate Advisory · ${esc(cfg.contacts.phone)} · caseadvisory.uz</span><span>${n} / ${TOTAL}</span></div>`;
  // подпись картинок: у концепт-визуализаций своя, чтобы не выдать их за фото
  const vizBadge = (cfg.texts && cfg.texts['about.viz']) ? L(cfg.texts['about.viz'], lang) : t('viz_concept');
  // у отдельной картинки может быть своя подпись (например, реальный снимок
  // с границами участка рядом с визуализациями застройки)
  const badgeOf = (file) => {
    const g = (cfg.about.images || []).find((x) => x.file === file);
    return (g && g.badge) ? L(g.badge, lang) : vizBadge;
  };
  const legal = (cfg.texts && cfg.texts['legal.area']) ? L(cfg.texts['legal.area'], lang) : '';
  const facts = (cfg.intro.facts || []).slice(0, 4);
  const specs = (cfg.about.specs || []);
  const caseCard = (c) => `<div style="background:#fff;border-radius:4mm;padding:6.5mm">
    <div style="font-size:13pt;font-weight:800;margin-bottom:1.5mm">${M(c.h)}</div>
    <div style="font-size:9pt;font-weight:700;color:${BRONZE};margin-bottom:3mm">${M(c.levels)}</div>
    <div style="font-size:9.5pt;line-height:1.55;color:${MUTED}">${M(c.p)}</div>
  </div>`;

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"><style>${CSS}
  /* у участка параметров много (12 строк), поэтому строки плотнее обычных */
  .spec td { padding: 2.3mm 4.5mm; font-size: 8.8pt; line-height: 1.3; }
  .spec td:first-child { width: 40%; font-weight: 700; }
  .spec td:last-child { color: ${MUTED}; white-space: pre-line; }
  .pg.land h2 { margin-bottom: 5mm; }
</style></head><body>

  <div class="pg" style="padding:0;background:${DARK}">
    <img src="${img64(cfg.intro.image)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,16,18,.35),rgba(15,16,18,.85))"></div>
    <div style="position:relative;margin-top:auto;padding:0 18mm 20mm;color:#fff">
      <div style="font-size:11pt;font-weight:800;letter-spacing:.2em;margin-bottom:6mm">${esc(CODE)}</div>
      <div style="font-size:30pt;font-weight:800;letter-spacing:-.01em;line-height:1.14;max-width:215mm">${M(cfg.intro.h1)}</div>
      <div style="font-size:13pt;margin-top:6mm;opacity:.9">${M(cfg.intro.sub)}</div>
      <div style="font-size:10.5pt;margin-top:3mm;opacity:.75">${M(cfg.location.address)}</div>
      <div style="display:flex;gap:14mm;margin-top:10mm;font-size:10pt">
        ${facts.map((f) => `<span><b style="font-size:16pt">${M(f.n)}</b><br><span style="opacity:.75">${M(f.l)}</span></span>`).join('')}
      </div>
    </div>
    <div style="position:absolute;right:18mm;bottom:20mm;color:#fff;font-size:9pt;opacity:.8">CASE Real Estate Advisory</div>
  </div>

  <div class="pg land">
    <span class="lbl">${t('lbl_land')}</span>
    <h2>${M(cfg.about.h2)}</h2>
    <div style="display:flex;gap:10mm;flex:1;min-height:0">
      <div style="flex:1.05;min-height:0">
        <table class="spec">
          ${specs.map((s) => `<tr><td>${M(s.b)}</td><td>${M(s.s)}</td></tr>`).join('')}
        </table>
      </div>
      <div style="flex:.95;display:flex;flex-direction:column;gap:4mm;min-height:0">
        <div style="flex:1;border-radius:5mm;overflow:hidden;position:relative;min-height:0">
          <img src="${img64(ABOUT_IMG)}" style="width:100%;height:100%;object-fit:${ABOUT_FIT};background:#fff">
          <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.62);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">${esc(badgeOf(ABOUT_IMG))}</span>
        </div>
        <div style="background:rgba(${ACC_RGB},.1);border-left:1.2mm solid ${BRONZE};border-radius:0 3mm 3mm 0;padding:5mm 6mm;font-size:10.5pt;line-height:1.5">${M(cfg.about.status)}</div>
        <div style="font-size:8pt;color:${MUTED};line-height:1.5">${esc(legal)}</div>
      </div>
    </div>
    ${foot(2)}
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_cases')}</span>
    <h2>${M(cfg.useCases.h2)}</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5mm;flex:1;align-content:start">
      ${cfg.useCases.cards.map(caseCard).join('')}
    </div>
    ${foot(3)}
  </div>

  <div class="pg" style="background:${DARK};color:#fff">
    <span class="lbl">${M(cfg.scenarios.h2)}</span>
    <h2 style="color:#fff">${M(cfg.scenarios.h2)}</h2>
    <div style="display:flex;gap:6mm;align-items:flex-start">
      ${cfg.scenarios.cols.map((c) => `<div style="flex:1;background:rgba(255,255,255,.06);border:.4pt solid rgba(255,255,255,.18);border-radius:4mm;padding:8mm">
        <div style="font-size:14pt;font-weight:800;margin-bottom:4mm">${M(c.h)}</div>
        <div style="font-size:10pt;line-height:1.6;color:rgba(255,255,255,.78)">${M(c.p)}</div>
      </div>`).join('')}
    </div>
    <div style="margin-top:8mm;font-size:10pt;color:rgba(255,255,255,.65)">${t('land_deal')} ${esc(cfg.contacts.phone)} · t.me/${esc(cfg.contacts.telegram)}</div>
    <div class="foot" style="color:rgba(255,255,255,.5)"><span><b style="color:#fff">${esc(CODE)}</b> · ${t('addr')}</span><span>CASE Real Estate Advisory</span><span>4 / ${TOTAL}</span></div>
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_loc')}</span>
    <h2>${M(cfg.location.h2)}</h2>
    <div style="display:flex;gap:12mm;flex:1">
      <div style="flex:1">
        <div style="font-size:12.5pt;font-weight:700;line-height:1.45;margin-bottom:6mm">${M(cfg.location.address)}</div>
        ${(cfg.location.pois || []).length ? `<table style="background:none">
          <tr><th colspan="2" style="padding-left:0">${t('loc_dist')}</th></tr>
          ${cfg.location.pois.map((p) => `<tr><td style="padding-left:0;background:none">${M(p.name)}</td><td style="text-align:right;font-weight:700;background:none">${M(p.dist)}</td></tr>`).join('')}
        </table>` : ''}
        <div style="margin-top:5mm;font-size:8.5pt;color:${MUTED}">${t('loc_coord')}: ${esc(cfg.location.lat)}, ${esc(cfg.location.lng)}</div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;gap:5mm;justify-content:center">
        <div style="background:#fff;border-radius:4mm;padding:7mm;font-size:10.5pt;line-height:1.6;color:${MUTED}">${M(cfg.location.sub)}</div>
        <div style="background:rgba(${ACC_RGB},.1);border-radius:4mm;padding:6mm;font-size:10.5pt;line-height:1.5">${t('land_loc_zone')}</div>
        ${L(cfg.location.around, lang) ? `<div style="background:#fff;border-radius:4mm;padding:6mm;font-size:10pt;line-height:1.55;color:${MUTED}">${M(cfg.location.around)}</div>` : ''}
      </div>
    </div>
    ${foot(5)}
  </div>

  <div class="pg">
    <span class="lbl">${t('lbl_viz')}</span>
    <h2>${t('h_viz')}</h2>
    <div style="display:flex;gap:10mm;flex:1;min-height:0">
      <div style="flex:.8;display:flex;flex-direction:column;gap:5mm;justify-content:center">
        <div style="background:#fff;border-radius:4mm;padding:7mm;font-size:11pt;line-height:1.65">${t('viz_p')}</div>
        <div style="font-size:8.5pt;color:${MUTED};line-height:1.5">${t('viz_all_concept')}</div>
      </div>
      <div style="flex:1.2;display:flex;flex-direction:column;gap:5mm">
        ${VIZ_IMGS.map((f) => `<div style="flex:1;border-radius:5mm;overflow:hidden;position:relative">
          <img src="${img64(f)}" style="width:100%;height:100%;object-fit:cover">
          <span style="position:absolute;right:4mm;bottom:4mm;background:rgba(15,16,18,.62);color:#fff;font-size:7pt;letter-spacing:.1em;text-transform:uppercase;padding:2mm 3.5mm;border-radius:2mm">${esc(badgeOf(f))}</span>
        </div>`).join('')}
      </div>
    </div>
    ${foot(6)}
  </div>

  ${GRID_PAGES.map((files, i) => `
  <div class="pg">
    <span class="lbl">${t('lbl_viz')}</span>
    <h2>${t('h_grid')}${GRID_PAGES.length > 1 ? ` ${i + 1}/${GRID_PAGES.length}` : ''}</h2>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(files.length, 3)},1fr);grid-auto-rows:1fr;gap:6mm;flex:1;min-height:0">
      ${files.map((f) => `<div style="border-radius:4mm;overflow:hidden;position:relative">
        <img src="${img64grid(f)}" style="width:100%;height:100%;object-fit:cover">
        ${badgeOf2(f, lang) ? `<span style="position:absolute;left:3mm;bottom:3mm;background:rgba(15,16,18,.62);color:#fff;font-size:6.5pt;letter-spacing:.09em;text-transform:uppercase;padding:1.6mm 3mm;border-radius:1.6mm">${esc(badgeOf2(f, lang))}</span>` : ''}
      </div>`).join('')}
    </div>
    ${foot(7 + i)}
  </div>`).join('')}

  <div class="pg" style="background:${DARK};color:#fff;align-items:center;justify-content:center;text-align:center">
    <div style="font-size:10pt;font-weight:800;letter-spacing:.2em;margin-bottom:8mm">${esc(CODE)}</div>
    <div style="font-size:26pt;font-weight:800;margin-bottom:3mm">${t('c_h')}</div>
    <div style="font-size:11pt;color:rgba(255,255,255,.7);margin-bottom:10mm">${t('c_s')}</div>
    ${PEOPLE.length
      ? `<div style="display:flex;gap:16mm;justify-content:center;margin-bottom:3mm">${PEOPLE.map((p) => `<div><div style="font-size:9.5pt;color:rgba(255,255,255,.72);margin-bottom:1mm">${esc(L(p.name, lang))}</div><div style="font-size:15pt;font-weight:800">${esc(p.phone)}</div></div>`).join('')}</div>`
      : `<div style="font-size:17pt;font-weight:800;margin-bottom:2.5mm">${esc(cfg.contacts.phone)}</div>`}
    <div style="font-size:12pt;color:rgba(255,255,255,.85);margin-bottom:10mm">t.me/${esc(cfg.contacts.telegram)} · ${esc(siteShown)}</div>
    <img src="${qr}" style="width:34mm;height:34mm;border-radius:3mm">
    <div style="font-size:8.5pt;color:rgba(255,255,255,.55);margin-top:3mm">${t('c_qr')}</div>
    <div style="position:absolute;left:18mm;right:18mm;bottom:8mm;display:flex;justify-content:space-between;font-size:8pt;color:rgba(255,255,255,.45)">
      <span>CASE Real Estate Advisory · caseadvisory.uz</span><span>${t('c_legal')}</span><span>${TOTAL} / ${TOTAL}</span>
    </div>
  </div>

  </body></html>`;
}

async function main() {
  const QR = require('qrcode');
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();

  for (const lang of ['ru', 'uz', 'en']) {
    const url = SITE + (lang === 'ru' ? '' : lang + '/');
    const qr = await QR.toDataURL(url, { width: 380, margin: 1, color: { dark: DARK, light: BG } });
    // типографика: никаких длинных/средних тире
    const html = buildHtml(lang, qr).replace(/[—–]/g, '-');
    const htmlPath = path.join(ROOT, 'tmp-presentation.html');
    fs.writeFileSync(htmlPath, html);
    const out = path.join(UP, lang === 'ru' ? 'presentation.pdf' : `presentation-${lang}.pdf`);
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle' });
    await page.pdf({ path: out, format: 'A4', landscape: true, printBackground: true });
    fs.unlinkSync(htmlPath);
    console.log(lang.toUpperCase() + ':', path.basename(out), (fs.statSync(out).size / 1024 / 1024).toFixed(1) + ' МБ');
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
