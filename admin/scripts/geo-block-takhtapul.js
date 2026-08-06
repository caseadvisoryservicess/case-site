/**
 * Геоаналитика Тахтапула для инвесторской презентации.
 *
 * Считает окружение точки по собственной геобазе CASE и кладёт готовые числа в
 * data/projects/takhtapul/geo-invest.json. Модуль дополнительных страниц
 * (scripts/pres-extra-takhtapul-invest.js) читает этот файл, поэтому сборка
 * презентации не требует геобазы.
 *
 * ВАЖНО, чем это отличается от Botanica: у Botanica результат кладётся в
 * cfg.geo и попадает на лендинг. Здесь - отдельный файл и только презентация.
 * Причина: у Botanica есть откалиброванное население по точке (отчёт владельца,
 * сетка Kontur H3, миграция 018), а по Тахтапулу такого нет. Наша собственная
 * сетка admin/data/geo/population_grid.csv помечена самим источником как
 * «Методологический слой; проверить источник/единицу измерения» и на Botanica
 * оказалась примерно в 4,7-5,8 раза ниже откалиброванных значений, причём
 * коэффициент по радиусам плавает. Переносить его на другой район (Тахтапул -
 * Шайхантахур, Botanica - Юнусабад) нельзя, поэтому абсолютное население по
 * Тахтапулу наружу НЕ выдаём (правило 3: никаких выдуманных цифр).
 *
 * Запуск: node scripts/geo-block-takhtapul.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { analyze, distance } = require(path.join(__dirname, '..', 'lib', 'geo'));

const LAT = 41.338889, LNG = 69.263403;      // ул. Тахтапул, 31
const SLUG = 'takhtapul';
const MAX = 3000;
const OUT = path.join(__dirname, '..', 'data', 'projects', SLUG, 'geo-invest.json');

const res = analyze({ lat: LAT, lng: LNG, radii: [500, 1000, 1500, MAX], nearest: 10 });

// точки схемы: смещения в метрах от объекта
const M_LAT = 110540, M_LNG = 111320 * Math.cos((LAT * Math.PI) / 180);
const CAT = { bc: 'bc', med: 'med', pharmacy: 'ph', food: 'food', mahalla: 'mh' };
const points = res.points.filter((p) => p.d <= MAX).map((p) => ({
  c: CAT[p.cat] || 'x',
  x: Math.round((p.lng - LNG) * M_LNG),
  y: Math.round((p.lat - LAT) * M_LAT),
  d: p.d
}));

const c = (r) => res.counts[r] || {};
const sub = (r, s) => c(r)['med:' + s] || 0;

// профильные конкуренты клиники - частные медцентры и клиники.
// Больницы, роддом и кабинеты врачей считаем отдельно: это не тот же продукт.
const medCore = (r) => sub(r, 'private') + sub(r, 'clinic');

const data = {
  point: { lat: LAT, lng: LNG },
  rings: [500, 1000, 1500],
  maxRing: MAX,
  points,
  counts: [500, 1000, 1500, MAX].reduce((a, r) => {
    a[r] = {
      med: c(r).med || 0,
      medCore: medCore(r),
      medBreak: {
        private: sub(r, 'private'), clinic: sub(r, 'clinic'), hospital: sub(r, 'hospital'),
        dentist: sub(r, 'dentist'), doctors: sub(r, 'doctors'), maternity: sub(r, 'maternity')
      },
      ph: c(r).pharmacy || 0,
      bc: c(r).bc || 0,
      mh: c(r).mahalla || 0
    };
    return a;
  }, {}),
  nearestBc: res.nearest.bc.slice(0, 8).map((p) => ({ n: p.name, d: p.d })),
  total: res.total,
  // сетка населения - только для внутренней проверки, наружу не идёт
  gridPopulation: res.population
};

fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
console.log('Готово:', path.relative(process.cwd(), OUT));
console.log('точек на схеме:', points.length, '| всего объектов до 3 км:', res.total);
for (const r of [500, 1000, 1500, MAX]) {
  const x = data.counts[r];
  console.log(`  ${String(r).padStart(4)} м: медицина ${x.med} (профильных ${x.medCore}), аптеки ${x.ph}, БЦ ${x.bc}, махалли ${x.mh}`);
}
console.log('ближайшие БЦ:', data.nearestBc.slice(0, 3).map((b) => `${b.n} ${b.d} м`).join(' · '));
console.log('сетка населения (НЕ публикуем):', JSON.stringify(res.population));
