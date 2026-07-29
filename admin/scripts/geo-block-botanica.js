/**
 * Готовит блок геоаналитики для лендинга Botanica.
 *
 * Считает окружение по собственной геобазе CASE и складывает результат в
 * cfg.geo, чтобы шаблон при сборке ничего не вычислял: панель на проде
 * работает без геобазы, ей достаточно готовых чисел.
 *
 * Население по изохронам и демография взяты из приложения CASE OS Geo
 * Analytics (блок SITE) - это отдельная модель, и в подписи она названа
 * отдельно от геобазы, чтобы источники не смешивались.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { analyze } = require(path.join(__dirname, '..', 'lib', 'geo'));

const LAT = 41.348614, LNG = 69.316418;
const FILE = path.join(__dirname, '..', 'data', 'projects', 'botanica', 'project.json');
const MAX = 3000;   // самое широкое кольцо схемы на лендинге

const ml = (ru, uz, en) => ({ ru, uz, en });
const res = analyze({ lat: LAT, lng: LNG, radii: [500, 1000, 1500, MAX], nearest: 6 });

// точки для схемы: смещения в метрах от объекта
const M_LAT = 110540, M_LNG = 111320 * Math.cos((LAT * Math.PI) / 180);
const CAT = { bc: 'bc', med: 'med', pharmacy: 'ph', food: 'food', mahalla: 'mh' };
const points = res.points
  .filter((p) => p.d <= MAX)
  .map((p) => ({
    c: CAT[p.cat] || 'x',
    x: Math.round((p.lng - LNG) * M_LNG),
    y: Math.round((p.lat - LAT) * M_LAT),
    d: p.d,
    n: p.name || ''
  }));

const c1000 = res.counts[1000], c1500 = res.counts[1500], c3000 = res.counts[MAX];
const geo = {
  point: { lat: LAT, lng: LNG },
  rings: [500, 1000, 1500],
  points,
  // население по пешей доступности - модель CASE OS Geo Analytics
  iso: [
    { min: 10, pop: 3977 },
    { min: 15, pop: 8798 },
    { min: 20, pop: 17927 }
  ],
  demo: { youth: 22.2, women: 28.2, old: 5.3 },
  // окружение - собственная геобаза CASE
  around: [
    { k: 'med', n1: c1000.med || 0, n15: c1500.med || 0, n3: c3000.med || 0,
      l: ml('медицинские учреждения', 'tibbiyot muassasalari', 'medical facilities') },
    { k: 'ph', n1: c1000.pharmacy || 0, n15: c1500.pharmacy || 0, n3: c3000.pharmacy || 0,
      l: ml('аптеки', 'dorixonalar', 'pharmacies') },
    { k: 'bc', n1: c1000.bc || 0, n15: c1500.bc || 0, n3: c3000.bc || 0,
      l: ml('бизнес-центры', 'biznes-markazlar', 'business centres') },
    { k: 'mh', n1: c1000.mahalla || 0, n15: c1500.mahalla || 0, n3: c3000.mahalla || 0,
      l: ml('махаллинские центры', 'mahalla markazlari', 'mahalla centres') }
  ],
  nearest: {
    med: res.nearest.med.slice(0, 4).map((p) => ({ n: p.name, d: p.d })),
    bc: res.nearest.bc.slice(0, 3).map((p) => ({ n: p.name, d: p.d }))
  }
};

const cfg = JSON.parse(fs.readFileSync(FILE, 'utf8'));
cfg.geo = Object.assign(geo, cfg.geoTexts || {});
fs.writeFileSync(FILE, JSON.stringify(cfg, null, 2));
console.log('точек на схеме:', points.length);
console.log('в 1 км: медицина', c1000.med || 0, 'аптеки', c1000.pharmacy || 0, 'БЦ', c1000.bc || 0, 'махалли', c1000.mahalla || 0);
console.log('в 1,5 км: медицина', c1500.med || 0, 'аптеки', c1500.pharmacy || 0, 'БЦ', c1500.bc || 0, 'махалли', c1500.mahalla || 0);
console.log('в 3 км: медицина', c3000.med || 0, 'аптеки', c3000.pharmacy || 0, 'БЦ', c3000.bc || 0, 'махалли', c3000.mahalla || 0);
