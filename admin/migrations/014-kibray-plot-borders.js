/**
 * Правка 014: реальный снимок участка с границами (Кибрай).
 *
 * Владелец прислал спутниковый снимок Google с обведёнными границами участка.
 * Это первая на странице картинка, которая показывает сам объект, а не
 * концепцию застройки, поэтому:
 *   - ставим её первой в галерее «Об участке»;
 *   - у неё своя плашка «границы участка», а не «визуализация концепции»
 *     (шаблон научился брать подпись из about.images[].badge);
 *   - в брошюре она уходит на страницу «Об участке», концепт-рендеры
 *     остаются на странице «Концепция застройки».
 *
 * Заодно заполняем окружение участка в блоке локации: по снимку видно
 * дорогу вдоль северной границы, промышленную застройку с востока, жилой
 * массив с запада и канал с юго-запада. Раньше поле было пустым, и в
 * брошюре на его месте зияла пустая плашка.
 *
 * Идемпотентна. Запуск: node migrations/014-kibray-plot-borders.js [slug]
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

// 1) снимок с границами - первой картинкой галереи
const imgs = (cfg.about.images = cfg.about.images || []);
const PLOT = {
  file: 'plot-borders.jpg',
  badge: ml('границы участка', 'uchastka chegaralari', 'plot boundaries'),
  alt: ml('Спутниковый снимок участка 6,5 га в Кибрае с обозначенными границами, первая линия дороги',
          'Qibraydagi 6,5 ga uchastkaning chegaralari belgilangan sun\'iy yo\'ldosh tasviri, yo\'lning birinchi qatori',
          'Satellite view of the 6.5 ha plot in Kibray with its boundaries marked, fronting the road')
};
const at = imgs.findIndex((g) => g.file === PLOT.file);
if (at < 0) {
  imgs.unshift(PLOT); changes++;
  console.log('✓ снимок с границами добавлен первым в галерею');
} else if (JSON.stringify(imgs[at]) !== JSON.stringify(PLOT) || at !== 0) {
  imgs.splice(at, 1); imgs.unshift(PLOT); changes++;
  console.log('✓ снимок с границами обновлён и поднят на первое место');
}

// 2) окружение участка: по снимку, аккуратно и без домыслов
const around = ml(
  'Северная граница участка выходит на асфальтированную дорогу - заезд прямо с неё. С востока промышленная застройка и действующее предприятие, с запада жилой массив махалли, вдоль юго-западной границы проходит канал. Внутри контура участок ровный, свободный, с двумя существующими строениями.',
  'Uchastkaning shimoliy chegarasi asfaltlangan yo\'lga chiqadi - kirish bevosita undan. Sharqdan sanoat qurilishi va ishlayotgan korxona, g\'arbdan mahalla turar-joy massivi, janubi-g\'arbiy chegara bo\'ylab kanal o\'tadi. Kontur ichida uchastka tekis, bo\'sh, ikkita mavjud inshoot bilan.',
  'The northern boundary fronts a paved road, with access directly from it. To the east there is industrial development and an operating plant, to the west a residential mahalla, and a canal runs along the south-western boundary. Inside the outline the plot is level and clear, with the two existing structures.');
if (JSON.stringify(cfg.location.around) !== JSON.stringify(around)) {
  cfg.location.around = around; changes++;
  console.log('✓ окружение участка описано по снимку');
}

// 3) вопрос про границы: где посмотреть контур
const items = Array.isArray(cfg.faq) ? cfg.faq : (cfg.faq && cfg.faq.items) || [];
const Q = ml('Где проходят границы участка?', 'Uchastka chegaralari qayerdan o\'tadi?', 'Where do the plot boundaries run?');
if (!items.some((q) => ruOf(q.q) === Q.ru)) {
  const A = ml(
    'Контур участка показан на снимке в блоке «Об участке»: это четырёхугольник с выходом на дорогу по северной границе. Точные координаты поворотных точек и кадастровый план предоставляем по запросу вместе с выпиской из Государственного реестра, а на осмотре показываем границы на местности.',
    'Uchastka konturi «Uchastka haqida» blokidagi tasvirda ko\'rsatilgan: bu shimoliy chegarasi yo\'lga chiqadigan to\'rtburchak. Burilish nuqtalarining aniq koordinatalari va kadastr rejasini Davlat reyestridan ko\'chirma bilan birga so\'rov bo\'yicha beramiz, ko\'rikda esa chegaralarni joyida ko\'rsatamiz.',
    'The outline is shown on the image in the About the site section: a quadrilateral fronting the road along its northern edge. Exact turning-point coordinates and the cadastral plan are provided on request together with the State Register extract, and the boundaries are walked with you during a site visit.');
  const idx = items.findIndex((q) => /Что именно прода/i.test(ruOf(q.q)));
  const row = { q: Q, a: A };
  if (idx >= 0) items.splice(idx + 1, 0, row); else items.push(row);
  changes++;
  console.log('✓ вопрос «Где проходят границы участка?» добавлен');
}

// 3a) подпись под галереей: раньше «все изображения - визуализации проекта»,
// теперь это неправда, первая картинка - реальный снимок
if (!cfg.texts) cfg.texts = {};
const VIZ_ALL = ml(
  'Первое изображение - спутниковый снимок участка с обозначенными границами, остальные - визуализации концепции застройки.',
  'Birinchi tasvir - chegaralari belgilangan uchastkaning sun\'iy yo\'ldosh tasviri, qolganlari - qurilish konsepsiyasi vizualizatsiyalari.',
  'The first image is a satellite view of the plot with its boundaries marked; the others are visualisations of a development concept.');
if (JSON.stringify(cfg.texts['about.vizAll']) !== JSON.stringify(VIZ_ALL)) {
  cfg.texts['about.vizAll'] = VIZ_ALL; changes++;
  console.log('✓ подпись под галереей переписана: снимок и визуализации разделены');
}

// 4) брошюра: на странице «Об участке» реальный снимок, концепты - дальше
if (!cfg.pres) cfg.pres = {};
if (cfg.pres.aboutImg !== PLOT.file) {
  cfg.pres.aboutImg = PLOT.file; changes++;
  console.log('✓ брошюра: на странице «Об участке» снимок с границами');
}
const wantViz = ['gate.jpg', 'hall.jpg', 'power.jpg'];
if (JSON.stringify(cfg.pres.vizImgs) !== JSON.stringify(wantViz)) {
  cfg.pres.vizImgs = wantViz; changes++;
  console.log('✓ брошюра: на странице концепции три визуализации');
}

if (changes) {
  fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
  console.log('Готово:', FILE);
} else {
  console.log('Изменений нет: правка уже применена.');
}
