/* Городские объекты для Geo Platform MVP: из мастер-геобазы CASE OS (os/data/geo_master/
   runtime.json) в docs/standalone/data/geo_mvp_data.json добавляется блок poi с медициной
   (по типу учреждения), аптеками, ресторанами и кафе. Поля сведены к имени, координатам,
   подтипу, району и источнику: карте и счётчикам больше не нужно. Записи без координат
   не берутся. Блоки bc и districts не трогаются.
   Запуск: node build_geo_mvp_data.js [runtime.json] [geo_mvp_data.json] */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const SRC = process.argv[2] || path.join(ROOT, 'os', 'data', 'geo_master', 'runtime.json');
const OUT = process.argv[3] || path.join(ROOT, 'docs', 'standalone', 'data', 'geo_mvp_data.json');

const MED_TYPES = { hospital: 'hospital', clinic: 'clinic', private: 'private', doctors: 'doctors', dentist: 'dentist', lab: 'lab', maternity: 'maternity', rehab: 'rehab', other: 'other' };
function num(v) { const n = parseFloat(v); return isFinite(n) && n !== 0 ? +n.toFixed(6) : null; }
/* длинное и среднее тире из названий источников приводим к короткому: правило проекта, тире в тексте только короткие */
const DASHES = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']', 'g');
function clean(s) { return String(s == null ? '' : s).replace(DASHES, '-').replace(/\s+/g, ' ').trim().slice(0, 120); }

function build(src, out) {
  const master = JSON.parse(fs.readFileSync(src, 'utf8'));
  const data = JSON.parse(fs.readFileSync(out, 'utf8'));
  const poi = { generated: new Date().toISOString().slice(0, 10), source: 'CASE OS geo master (runtime.json), OpenStreetMap, clinics.uz, 2GIS, Yandex; coordinates not field-verified', categories: {} };
  const med = {};
  (master.medicine || []).forEach(r => {
    const lat = num(r.la), lng = num(r.ln); if (lat == null || lng == null) return;
    const t = MED_TYPES[r.t] || 'other';
    (med[t] = med[t] || []).push({ n: clean(r.n) || 'Без названия', lat, lng, d: clean(r.d), s: clean(r.s || r.a) });
  });
  poi.categories.medicine = { sub: med };
  poi.categories.pharmacies = { sub: { pharmacy: (master.pharmacies || []).map(r => { const lat = num(r.lat), lng = num(r.lng); return lat == null || lng == null ? null : { n: clean(r.name) || 'Аптека', lat, lng, d: clean(r.district), s: clean(r.provider) }; }).filter(Boolean) } };
  const food = {};
  ['restaurants', 'cafes'].forEach(k => { food[k] = (master[k] || []).map(r => { const lat = num(r.lat), lng = num(r.lng); return lat == null || lng == null ? null : { n: clean(r.name) || k, lat, lng, d: clean(r.district), s: clean(r.provider), t: clean(r.subtype) }; }).filter(Boolean); });
  poi.categories.food = { sub: food };
  data.poi = poi;
  fs.writeFileSync(out, JSON.stringify(data));
  const counts = {};
  Object.keys(poi.categories).forEach(c => { counts[c] = {}; Object.keys(poi.categories[c].sub).forEach(s => { counts[c][s] = poi.categories[c].sub[s].length; }); });
  return { bytes: Buffer.byteLength(JSON.stringify(data)), counts };
}
if (require.main === module) {
  const r = build(SRC, OUT);
  console.log('poi записан в ' + OUT + ' (' + (r.bytes / 1024).toFixed(0) + ' КБ): ' + JSON.stringify(r.counts));
}
module.exports = { build };
