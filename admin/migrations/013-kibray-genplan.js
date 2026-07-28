/**
 * Правка 013: данные генерального плана для участка в Кибрае.
 *
 * Источник: портал «Шаффоф қурилиш» (dshk.shaffofqurilish.uz), карточка
 * «Bosh reja obyekt» по этому участку. Скриншот от владельца 2026-07-28:
 *   Hudud: Qishloq hududi
 *   Funksiya: Texnologik sanoat hududlari   <- функциональная зона
 *   District: Qibray tumani, Mahalla: Sharq MFY, Toshkent viloyati
 *   Qavatlilik: 3                            <- разрешённая этажность
 *   Seysmologik zonasi: 8                    <- сейсмическая зона
 *   Strategiya: Rekonstruksiya, H2 Takomillashtirish hududlari
 *
 * Это самая сильная часть страницы после земли: покупателю ЦОД важно, что
 * назначение зоны промышленно-технологическое, а не жилое или сельское.
 * Сейсмичность 8 баллов тоже пишем открыто: её всё равно проверят, а для
 * ташкентской агломерации это норма и вопрос конструктива, не блокер.
 *
 * Две строки карточки (Qurilish Maydoni Yer Maydon 50 и Umumiy Maydonining
 * Yer 1) на странице НЕ публикуем: подписи в карточке обрезаны, точную
 * трактовку (процент застройки и коэффициент площади) надо подтвердить.
 * Правило 3: не выдумываем.
 *
 * Идемпотентна. Запуск: node migrations/013-kibray-genplan.js [slug]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const slug = process.argv[2] || 'kibray-dc';
const FILE = path.join(__dirname, '..', 'data', 'projects', slug, 'project.json');
const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
if (!(cfg.schemaVersion >= 2)) { console.error('Проект не на схеме v2'); process.exit(1); }

const ml = (ru, uz, en) => ({ ru, uz, en });
const ruOf = (v) => (v && typeof v === 'object' ? v.ru : v) || '';
let changes = 0;

// 1) строки в «Об участке» - сразу после назначения проекта
const specs = (cfg.about && cfg.about.specs) || [];
const ROWS = [
  {
    b: ml('Зона по генеральному плану', 'Bosh reja bo\'yicha zona', 'Master plan zoning'),
    s: ml('территория технологической промышленности (Texnologik sanoat hududlari)',
          'texnologik sanoat hududlari',
          'technological industry area (Texnologik sanoat hududlari)')
  },
  {
    b: ml('Разрешённая этажность', 'Ruxsat etilgan qavatlilik', 'Permitted height'),
    s: ml('до 3 этажей', '3 qavatgacha', 'up to 3 floors')
  },
  {
    b: ml('Сейсмичность', 'Seysmiklik', 'Seismic zone'),
    s: ml('8 баллов', '8 ball', '8 points')
  }
];
const afterIdx = specs.findIndex((s) => /Назначение проекта/i.test(ruOf(s.b)));
let at = afterIdx >= 0 ? afterIdx + 1 : 1;
for (const row of ROWS) {
  const key = ruOf(row.b);
  if (specs.some((s) => ruOf(s.b) === key)) continue;
  specs.splice(at, 0, row); at++; changes++;
  console.log('✓ «Об участке»: строка «' + key + '»');
}

// 2) вопрос про генплан
// faq в конфиге лежит массивом, но в других проектах встречается и объект с items
const items = Array.isArray(cfg.faq) ? cfg.faq : (cfg.faq && cfg.faq.items) || [];
const Q = ml('Что разрешает генеральный план?', 'Bosh reja nimaga ruxsat beradi?', 'What does the master plan allow?');
if (!items.some((q) => ruOf(q.q) === Q.ru)) {
  const A = ml(
    'По карточке объекта на портале «Шаффоф қурилиш» участок относится к территориям технологической промышленности (Texnologik sanoat hududlari), Кибрайский район, махалля Шарк. Разрешённая этажность - до 3 этажей: для дата-центра это не ограничение, машинные залы строятся в один-два уровня. Сейсмическая зона - 8 баллов, стандартная величина для ташкентской агломерации, которая учитывается в конструктивных решениях. Карточку генплана и документы по участку высылаем по запросу.',
    '«Shaffof qurilish» portalidagi obyekt kartochkasiga ko\'ra uchastka texnologik sanoat hududlariga kiradi, Qibray tumani, Sharq MFY. Ruxsat etilgan qavatlilik - 3 qavatgacha: data-markaz uchun bu cheklov emas, mashina zallari bir-ikki darajada quriladi. Seysmik zona - 8 ball, Toshkent aglomeratsiyasi uchun odatiy ko\'rsatkich va konstruktiv yechimlarda hisobga olinadi. Bosh reja kartochkasi va uchastka hujjatlarini so\'rov bo\'yicha yuboramiz.',
    'According to the object record on the Shaffof Qurilish portal, the plot sits within a technological industry area (Texnologik sanoat hududlari), Kibray district, Sharq mahalla. The permitted height is up to 3 floors, which is no constraint for a data center: data halls are normally built on one or two levels. The seismic zone is 8 points, a standard figure for the Tashkent agglomeration that is accounted for in the structural design. The master plan record and the plot documents are available on request.');
  const idx = items.findIndex((q) => /обременени/i.test(ruOf(q.q)));
  const row = { q: Q, a: A };
  if (idx >= 0) items.splice(idx + 1, 0, row); else items.push(row);
  changes++;
  console.log('✓ вопрос «Что разрешает генеральный план?» добавлен');
}

// 3) лента параметров: назначение зоны видно сразу, без прокрутки до «Об участке»
const params = cfg.params || [];
const wantP = ml('Зона технологической промышленности', 'Texnologik sanoat hududi', 'Technological industry zone');
if (!params.some((p) => ruOf(p.l) === wantP.ru)) {
  const dIdx = params.findIndex((p) => /Проект под ЦОД/i.test(ruOf(p.l)));
  const row = { n: '', l: wantP };
  if (dIdx >= 0) params.splice(dIdx, 0, row); else params.push(row);
  changes++;
  console.log('✓ лента параметров: «Зона технологической промышленности»');
}
// в ленте ровно 5 колонок, шестая ушла бы на вторую строку. Убираем «Ровный
// рельеф»: это было моё допущение по спутниковому снимку, а не проверенные
// данные (правило 3), и покупателю ЦОД зонирование важнее рельефа.
const relIdx = params.findIndex((p) => /Ровный рельеф/i.test(ruOf(p.l)));
if (relIdx >= 0) {
  params.splice(relIdx, 1); changes++;
  console.log('✓ лента параметров: убран «Ровный рельеф» (неподтверждённое допущение)');
}

// 4) ключевые слова: земля под ЦОД, промышленная зона
if (cfg.seo) {
  const extra = ['промышленная зона Кибрай', 'земля под дата-центр Узбекистан', 'участок под ЦОД Ташкент'];
  const cur = (cfg.seo.keywords || '').split(', ').filter(Boolean);
  const add = extra.filter((k) => !cur.includes(k));
  if (add.length) {
    cfg.seo.keywords = cur.concat(add).join(', ');
    changes++;
    console.log('✓ ключевые слова: +' + add.length);
  }
}

// 5) дисклеймер: появился второй источник данных, его надо назвать
if (!cfg.texts) cfg.texts = {};
const LEGAL = ml(
  'Площади и характеристики приведены по выписке из Государственного реестра прав на недвижимость от 05.02.2024, зонирование и сейсмичность - по карточке объекта портала «Шаффоф қурилиш». Информация носит справочный характер и не является публичной офертой.',
  'Maydonlar va xususiyatlar Ko\'chmas mulkka bo\'lgan huquqlar Davlat reyestridan 05.02.2024 dagi ko\'chirma bo\'yicha, zonalashtirish va seysmiklik - «Shaffof qurilish» portali obyekt kartochkasi bo\'yicha keltirilgan. Ma\'lumot ma\'lumot xarakteriga ega va ommaviy oferta hisoblanmaydi.',
  'Areas and characteristics are stated per the extract from the State Register of Real Property Rights dated 05.02.2024; zoning and the seismic figure come from the object record on the Shaffof Qurilish portal. This information is for reference only and does not constitute a public offer.');
if (JSON.stringify(cfg.texts['legal.area']) !== JSON.stringify(LEGAL)) {
  cfg.texts['legal.area'] = LEGAL; changes++;
  console.log('✓ дисклеймер: назван второй источник данных (портал генплана)');
}

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
