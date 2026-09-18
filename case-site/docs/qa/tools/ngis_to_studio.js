/* CASE OS v4.78.0: границы махаллей Ташкента из выгрузок НГИС в файл студии.
 *
 * Вход (любой из двух форматов, распознаётся по свойствам):
 *   1) мастер-набор владельца 02_tashkent_mahallas.geojson (папка tashkent_gis_master): 402 полигона с
 *      официальными кодами Etirof (official_unique_code = SOATO махалли), площадью (area_ha_geodesic) и
 *      центроидом; упрощение 0,0001° (~10 м);
 *   2) сырой слой UZKAD/MAHALLA_UZKAD_DB16 (скрипт docs/data/ngis/ngis_etl.py или консоль браузера):
 *      cadastral_number, mahalla_name, soato_district, soato_region.
 * Выход: os/data/mahalla_boundaries.geojson только по Ташкенту; у каждого полигона name, district в написании
 * студии (Yunusabad, Mirzo-Ulugbek, ...), soato_district, mahalla_code (официальный код), cadastral_number,
 * area_ha, lat, lng (центроид), source, source_date. Студия подхватывает файл сама.
 *
 * Запуск: node docs/qa/tools/ngis_to_studio.js <geojson> [os/data/mahalla_boundaries.geojson] */
'use strict';
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('нужен путь к GeoJSON слоя MAHALLA или к 02_tashkent_mahallas.geojson'); process.exit(2); }
const OS = path.join(__dirname, '..', '..', '..', 'os');
const out = process.argv[3] || path.join(OS, 'data', 'mahalla_boundaries.geojson');
const demo = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'demography_tashkent.json'), 'utf8'));
const bySoato = {};
Object.keys(demo.districts.rows).forEach(k => { bySoato[String(demo.districts.rows[k].soato)] = k; });
const fc = JSON.parse(fs.readFileSync(src, 'utf8'));
const NAME_KEYS = ['short_name', 'mahalla_name_uz_latin', 'name', 'NAME', 'mahalla_name', 'nomi', 'mfy_name', 'mahalla', 'MAHALLA', 'name_uz', 'title'];
const nul = v => (v == null || v === '' || v === 'NULL') ? null : v;
function nameOf(p) {
  for (const k of NAME_KEYS) if (nul(p[k]) != null && String(p[k]).trim()) return String(p[k]).trim();
  for (const k of Object.keys(p)) if (/nom|name/i.test(k) && typeof p[k] === 'string' && nul(p[k]) && p[k].trim()) return p[k].trim();
  return '';
}
const num = v => { v = nul(v); if (v == null) return null; const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; };
function centroid(g) {
  /* центроид первого внешнего кольца по формуле площади (для подписи и привязки; точность достаточна) */
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null; if (!ring) return null;
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f; }
  if (!a) return [ring[0][1], ring[0][0]]; a *= 0.5; return [+(cy / (6 * a)).toFixed(5), +(cx / (6 * a)).toFixed(5)];
}
const today = new Date().toISOString().slice(0, 10);
const feats = [], unmatched = {};
let total = 0, master = false;
for (const ft of fc.features || []) {
  const p = ft.properties || ft.attributes || {};
  const isMaster = p.official_unique_code != null; if (isMaster) master = true;
  const region = String(p.soato_region || (isMaster ? '1726' : ''));
  if (region && region !== '1726') continue;
  total++;
  const soato = String(nul(p.soato_district) || nul(p.district_id) || (isMaster && p.soato_code ? String(p.soato_code).slice(0, 7) : '') || '');
  const district = bySoato[soato] || '';
  if (!district) { unmatched[soato] = (unmatched[soato] || 0) + 1; }
  if (!ft.geometry) continue;
  const code = String(nul(p.official_unique_code) || nul(p.cadastral_number) || '');
  const c = (num(p.latitude_centroid) != null && num(p.longitude_centroid) != null) ? [num(p.latitude_centroid), num(p.longitude_centroid)] : centroid(ft.geometry);
  feats.push({ type: 'Feature', geometry: ft.geometry, properties: {
    name: nameOf(p), district, soato_district: soato, mahalla_code: code, cadastral_number: String(nul(p.cadastral_number) || code || ''),
    area_ha: num(p.area_ha_geodesic) != null ? num(p.area_ha_geodesic) : null, area_ha_utm: num(p.area_ha_cadastre_utm), lat: c ? c[0] : null, lng: c ? c[1] : null,
    source: 'Кадастр агентлиги, геопортал open.ngis.uz (слой UZKAD/MAHALLA_UZKAD_DB16)' + (isMaster ? ', мастер-набор tashkent_gis_master' : ''), source_date: isMaster ? (String(nul(p.geometry_date_range) || '2026-09-18').slice(0, 10) === '2026' ? '2026-09-18' : today) : today } });
}
feats.sort((a, b) => String(a.properties.mahalla_code).localeCompare(String(b.properties.mahalla_code)));
fs.writeFileSync(out, JSON.stringify({ type: 'FeatureCollection', name: 'mahalla_boundaries_tashkent', crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } }, source: 'Кадастр агентлиги (Davlat kadastr palatasi), геопортал open.ngis.uz, слой UZKAD/MAHALLA_UZKAD_DB16, выгрузка владельца 18.09.2026' + (master ? '; коды и площади из мастер-набора tashkent_gis_master (реестр Etirof)' : '') + '. Публичные данные; условия коммерческого переиспользования не подтверждены. Правовая основа границ: ПКМ 48 от 04.03.2014, ст. 26-30.', features: feats }));
const byD = {};
feats.forEach(f => { byD[f.properties.district || '?'] = (byD[f.properties.district || '?'] || 0) + 1; });
console.log('формат: ' + (master ? 'мастер-набор (официальные коды)' : 'сырой слой НГИС') + '; полигонов по Ташкенту: ' + feats.length + ' из ' + total + ' записей региона 1726');
console.log('по районам: ' + Object.keys(byD).sort().map(k => k + ' ' + byD[k]).join(', '));
if (Object.keys(unmatched).length) console.log('SOATO без района студии: ' + JSON.stringify(unmatched));
console.log('записано: ' + out + ' (' + Math.round(fs.statSync(out).size / 1024) + ' КБ)');
