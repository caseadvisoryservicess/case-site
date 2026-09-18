/* CASE OS v4.78.0: сборка данных Ташкента для студии из двух пакетов владельца (18.09.2026):
 *   tashkent_gis_dataset (v1): реестр 585 махаллей слоя хокимията (имена на трёх языках, площади
 *     Кенгаша 2023-2024), районы с населением на 01.07.2026, ряды 2022-2026, показатели города, перепись 2026;
 *   tashkent_gis_master (v2): реестр 585 махаллей Etirof (Кадастр агентлиги) с официальными кодами SOATO,
 *     402 полигона НГИС с геодезической площадью и центроидом, районы (SOATO уровня A, кадастровый префикс,
 *     геодезическая площадь, население 01.10.2025 и 01.01.2026), реестр источников, история переименований,
 *     список недостающих данных, правило для одноимённых махаллей.
 *
 * Пишет:
 *   os/data/mahalla_registry_tashkent.json   единый реестр 585 махаллей (код Etirof + имена хокимията)
 *   os/data/demography_tashkent.json         дополняет районы, город, источники (существующие поля сохраняются)
 * Печатает строку DIST для os/geoanalytics-studio.html (население 01.07.2026, площадь по границам 2024).
 *
 * Запуск: node docs/qa/tools/build_tashkent_data.js <папка tashkent_gis_dataset> [папка tashkent_gis_master] */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2], DIR2 = process.argv[3] || '';
if (!DIR || !fs.existsSync(path.join(DIR, '03_tashkent_districts.csv'))) { console.error('нужна папка tashkent_gis_dataset с файлами 03, 04, 10, 11'); process.exit(2); }
if (DIR2 && !fs.existsSync(path.join(DIR2, '04_tashkent_mahallas.csv'))) { console.error('вторая папка должна быть tashkent_gis_master с файлами 03..10'); process.exit(2); }
const OS = path.join(__dirname, '..', '..', '..', 'os');
const DEMO_PATH = path.join(OS, 'data', 'demography_tashkent.json');
const demo = JSON.parse(fs.readFileSync(DEMO_PATH, 'utf8'));
const dash = s => typeof s === 'string' ? s.replace(/[\u2014\u2013]/g, '-') : s;

function csv(file, dir) {
  let t = fs.readFileSync(path.join(dir || DIR, file), 'utf8'); if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
  t = dash(t);
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i]; if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; } else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c; }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const H = rows[0]; return rows.slice(1).filter(r => r.length > 1).map(r => { const o = {}; H.forEach((h, i) => { o[h] = r[i] == null ? '' : r[i]; }); return o; });
}
const nul = v => v == null || v === '' || v === 'NULL' ? null : v;
const num = v => { v = nul(v); if (v == null) return null; const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
/* район из пакета (узбекская латиница) -> ключ студии */
const KEY = { 'Bektemir': 'Bektemir', 'Chilonzor': 'Chilanzar', 'Mirobod': 'Mirabad', "Mirzo Ulug'bek": 'Mirzo-Ulugbek', 'Olmazor': 'Olmazor', 'Sergeli': 'Sergeli', 'Shayxontohur': 'Shaykhantakhur', 'Uchtepa': 'Uchtepa', 'Yakkasaroy': 'Yakkasaray', 'Yangihayot': 'Yangihayot', 'Yashnobod': 'Yashnabad', 'Yunusobod': 'Yunusabad' };
const keyOf = n => { n = String(n || '').replace(/[ʻʼ’`]/g, "'").replace(/\s+tumani$/i, '').trim(); return KEY[n] || null; };

/* нормализация имён махаллей для сопоставления двух реестров: в Etirof пишут x вместо h, q/k, v/b,
   разные апострофы и дефисы; сравнение только внутри района */
function norm(s) {
  s = String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[ʻʼ’`‘']/g, '').replace(/\s*(mfy|mahalla fuqarolar yigini|mahallasi|mahalla)\s*$/g, '');
  const digits = (s.match(/\d+/g) || []).join('');
  return s.replace(/\d+/g, '').replace(/x/g, 'h').replace(/q/g, 'k').replace(/v/g, 'b').replace(/[^a-z]/g, '') + digits;
}
/* «A.Fitrat» и «Abdurauf Fitrat»: ключ по инициалу и фамилии */
function initKey(raw) {
  const m = String(raw || '').replace(/[ʻʼ’`‘]/g, "'").match(/^([A-Za-z]{1,2})\.\s*([A-Za-z'\- ]+)$/); if (m) return m[1][0].toLowerCase() + '|' + norm(m[2]);
  const w = String(raw || '').trim().split(/\s+/); if (w.length >= 2) return w[0][0].toLowerCase() + '|' + norm(w.slice(1).join(' '));
  return null;
}
function lev(a, b) { const m = a.length, n = b.length, d = []; for (let i = 0; i <= m; i++) { d[i] = [i]; } for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
/* явные соответствия (Etirof -> хокимият), где написание расходится сильнее опечатки */
const ALIAS = { 'Uchtepa|akodiriy': 'abdullakodiriy', 'Uchtepa|okmachit': 'okmasjid', 'Olmazor|abshoshiy': 'abubakrshoshiy', 'Yunusabad|mulugbek': 'mirzoulugbek', 'Yunusabad|shayhshibli': 'shayhshibliy', 'Mirzo-Ulugbek|gulzor1': 'gulzorobod' };

/* 1. реестр махаллей: v1 (хокимият, три письменности, площади Кенгаша) */
const reg = csv('04_tashkent_mahallas.csv');
const v1rows = reg.map(r => ({ id: r.mahalla_id, layer_id: r.mahalla_id.split('-').pop(), name: nul(r.short_name_uz_latin) || nul(r.mahalla_name_uz_latin), name_full: nul(r.mahalla_name_uz_latin), name_cyr: nul(r.mahalla_name_uz_cyrillic), name_ru: nul(r.mahalla_name_ru), district: keyOf(r.district_name_uz_latin), district_uz: r.district_name_uz_latin, soato_district: nul(r.district_SOATO_code), area_ha: num(r.area_ha), boundary: nul(r.official_boundary_available) === 'YES', reference_date: nul(r.reference_date), confidence: nul(r.confidence) }));
let registry, registryNote, registrySource, matchStat = null, dup = [], left = [];
if (DIR2) {
  /* v2: Etirof, официальные коды; хокимиятские имена и площади присоединяются по району и имени */
  const reg2 = csv('04_tashkent_mahallas.csv', DIR2);
  const pool = {}; v1rows.forEach(r => { (pool[r.district] = pool[r.district] || []).push({ r, n: norm(r.name), used: false }); });
  matchStat = { exact: 0, alias: 0, initials: 0, fuzzy: 0, elimination: 0, none: 0 };
  const pick = (dk, n, raw) => {
    const cands = pool[dk] || [];
    let c = cands.find(x => !x.used && x.n === n); if (c) { c.used = true; return { r: c.r, how: 'exact' }; }
    const al = ALIAS[dk + '|' + n]; if (al) { c = cands.find(x => !x.used && x.n === al); if (c) { c.used = true; return { r: c.r, how: 'alias' }; } }
    const ik = initKey(raw); if (ik) { c = cands.find(x => !x.used && initKey(x.r.name) === ik); if (c) { c.used = true; return { r: c.r, how: 'initials' }; } }
    let best = null, bs = 0; cands.forEach(x => { if (x.used || x.n[0] !== n[0]) return; if ((x.n.match(/\d+$/) || [''])[0] !== (n.match(/\d+$/) || [''])[0]) return; const s = sim(x.n, n); if (s > bs) { bs = s; best = x; } });
    if (best && bs >= 0.75) { best.used = true; return { r: best.r, how: 'fuzzy', s: +bs.toFixed(2) }; }
    return null;
  };
  registry = reg2.map(r => {
    const dk = keyOf(r.district_name_uz_latin), n = norm(r.mahalla_name_uz_latin), m = pick(dk, n, r.mahalla_name_uz_latin);
    matchStat[m ? m.how : 'none']++;
    const v = m ? m.r : null;
    const o = { code: r.official_unique_code, soato: r.soato_code, name: r.mahalla_name_uz_latin, name_full: nul(r.official_full_name), name_hokimiyat: v ? v.name : null, name_cyr: v ? v.name_cyr : null, name_ru: v ? v.name_ru : null,
      district: dk, district_uz: r.district_name_uz_latin, soato_district: r.district_id, area_ha: num(r.area_ha_geodesic), area_ha_utm: num(r.area_ha_cadastre_utm), area_ha_hokimiyat: v ? v.area_ha : null,
      lat: num(r.mahalla_center_latitude), lng: num(r.mahalla_center_longitude), polygon: nul(r.geometry_available) === 'YES', layer_id: v ? v.layer_id : null, match: m ? m.how : 'none',
      registry_source: 'Etirof (Kadastr agentligi), реестр МФЙ', legal_basis: dash(nul(r.boundary_legal_basis)), confidence: nul(r.confidence) || 'A', note: dash(nul(r.notes)) };
    if (m && m.s != null) o.match_score = m.s;
    return o;
  });
  /* по остатку: если в районе без пары осталась ровно одна запись с каждой стороны, это переименование
     (Mustaqil yurt -> Mustaqillik, Eski Jaloyir -> Jaloyir): код и имя из Etirof, площадь хокимията присоединяется,
     кириллица и русское имя не переносятся */
  Object.keys(pool).forEach(dk => {
    const l1 = pool[dk].filter(x => !x.used), l2 = registry.filter(m => m.district === dk && m.match === 'none');
    if (l1.length === 1 && l2.length === 1) { l1[0].used = true; const v = l1[0].r, m = l2[0]; m.match = 'elimination'; m.name_hokimiyat = v.name; m.area_ha_hokimiyat = v.area_ha; m.layer_id = v.layer_id; m.note = (m.note ? m.note + '; ' : '') + 'в слое хокимията 2024 года под именем ' + v.name + ' (сопоставлено по остатку)'; matchStat.none--; matchStat.elimination++; }
  });
  Object.keys(pool).forEach(dk => pool[dk].forEach(x => { if (!x.used) left.push({ district: dk, name: x.r.name, name_cyr: x.r.name_cyr, name_ru: x.r.name_ru, area_ha: x.r.area_ha, layer_id: x.r.layer_id }); }));
  console.log('сопоставление реестров Etirof и хокимията: ' + JSON.stringify(matchStat) + (left.length ? '; без пары в реестре хокимията: ' + left.map(x => x.district + ':' + x.name).join(', ') : ''));
  registry.filter(m => m.match === 'fuzzy' || m.match === 'initials' || m.match === 'elimination').forEach(m => console.log('  ~ ' + m.match + ' ' + m.district + ': ' + m.name + ' = ' + m.name_hokimiyat + ' (' + m.match_score + ')'));
  registry.filter(m => m.match === 'none').forEach(m => console.log('  ? ' + m.district + ': ' + m.name + ' (без пары)'));
  try { dup = csv('10_tashkent_mahalla_name_duplicates.csv', DIR2).map(r => ({ name: r.source_name, code: r.soato_code, district: keyOf(r.district_name), rule: dash(r.match_guidance), polygon: r.has_official_polygon === 'YES' })); } catch (e) {}
  registryNote = 'Единый реестр махаллей Ташкента: 585 записей официального реестра МФЙ Etirof (Кадастр агентлиги, api-etirof.kadastr.uz) с кодами SOATO махалли (код района + 3 цифры), к ним присоединены имена на кириллице и по-русски и площади из слоя хокимията (границы по решениям Кенгаша города 24.11.2023-23.10.2024, Open Data Tashkent / ArcGIS). Площадь area_ha геодезическая по полигону НГИС (есть у 402 махаллей с полигоном), area_ha_hokimiyat из слоя хокимията. Населения по махаллям в открытых источниках нет (публикуется только до уровня района): запрос в Milliy statistika qo\'mitasi или единый реестр МФЙ (ПКМ 586 от 15.09.2025). Одноимённые махалли в разных районах (Mustaqillik) не объединять: ключ только код. Условия коммерческого использования слоёв не опубликованы.';
  registrySource = 'пакеты владельца tashkent_gis_master (04_tashkent_mahallas.csv, реестр Etirof, уверенность A) и tashkent_gis_dataset (04_tashkent_mahallas.csv, слой хокимията), 18.09.2026; сопоставление по району и имени: ' + JSON.stringify(matchStat) + (left.length ? '; без пары: ' + left.length : '');
} else {
  registry = v1rows;
  registryNote = 'Официальный реестр махаллей Ташкента: границы приняты решениями Кенгаша города по районам с 24.11.2023 по 23.10.2024, слой хокимията на Open Data Tashkent и ArcGIS. Населения по махаллям в открытых источниках нет.';
  registrySource = 'пакет tashkent_gis_dataset (CASE, 18.09.2026), файл 04_tashkent_mahallas.csv, уверенность A';
}
const byDist = {}; registry.forEach(m => { const d = byDist[m.district] = byDist[m.district] || { official: 0, polygons: 0 }; d.official++; if (m.polygon || m.boundary) d.polygons++; });
const registryOut = { schema: 'case-mahalla-registry/v2', version: new Date().toISOString().slice(0, 10), total: registry.length, with_polygon: registry.filter(m => m.polygon).length, note: registryNote, source: registrySource, duplicates_rule: dup, unmatched_hokimiyat: left, by_district: byDist, rows: registry };
fs.writeFileSync(path.join(OS, 'data', 'mahalla_registry_tashkent.json'), JSON.stringify(registryOut));
console.log('реестр махаллей: ' + registry.length + ' записей, с полигоном ' + registryOut.with_polygon + ', по районам ' + JSON.stringify(byDist));

/* 2. районы: население 01.07.2026, ряды и показатели (v1) */
const dist = csv('03_tashkent_districts.csv');
const long = csv('10_tashkent_district_demographics_socioeconomic_long.csv');
demo.districts = demo.districts || { rows: {} };
const D = demo.districts.rows;
dist.forEach(r => {
  const k = keyOf(r.district_name_uz_latin); if (!k) { console.log('район без ключа: ' + r.district_name_uz_latin); return; }
  D[k] = D[k] || {};
  Object.assign(D[k], { name_ru: nul(r.district_name_ru), name_cyr: nul(r.district_name_uz_cyrillic), name_en: nul(r.district_name_en), soato_grade: nul(r.SOATO_code_confidence), area_km2_official: num(r.area_km2_official), area_km2_official_source: nul(r.area_km2_official_source), area_km2_secondary: num(r.area_km2_secondary), sum_mahalla_area_ha: num(r.sum_of_mahalla_areas_ha), population_2026_07_01: num(r.population_total_persons), population_source: nul(r.population_source_url), population_conf: nul(r.population_confidence), mahallas_official: num(r.number_of_mahallas), hokimiyat_url: nul(r.hokimiyat_url), postcode: nul(r.postcode), date_established: nul(r.date_established) });
});
const IND = { population_total: 'population_series', average_monthly_nominal_salary: 'salary_month_thousand_uzs', retail_trade_turnover: 'retail_turnover_bn_uzs', registered_enterprises_total: 'enterprises', small_business_entities: 'small_business', entrepreneurship_subjects: 'entrepreneurs', migration_in: 'migration_in', migration_out: 'migration_out', net_migration: 'migration_net', hospitals: 'hospitals', polyclinics_ambulatory: 'polyclinics', doctors: 'doctors_thousand', preschool_institutions: 'preschools', construction_works_volume: 'construction_bn_uzs' };
const addSeries = (k, date, persons, source, conf) => { const s = D[k].population_series = D[k].population_series || []; if (!s.some(p => p.date === date)) s.push({ date, value: persons, source, conf }); };
long.forEach(r => {
  const k = keyOf(r.district_name_uz_latin); if (!k) return; const key = IND[r.indicator]; if (!key) return;
  const v = num(r.value); if (v == null) return;
  D[k] = D[k] || {};
  if (key === 'population_series') addSeries(k, r.reference_date, /thousand/.test(r.unit) ? Math.round(v * 1000) : Math.round(v), r.source_name, r.confidence === 'A' ? 'verified' : 'asking');
  else { const o = D[k][key] = D[k][key] || {}; o[r.reference_date] = v; o.unit = r.unit; o.source = r.source_name; }
});
demo.districts.note = 'Районы Ташкента: SOATO по Госреестру и кадастровому слою TUMAN_BORDER, площади по границам 2024 года (студия) и геодезические по кадастру. Дополнено пакетом tashkent_gis_dataset (18.09.2026): население по районам на 01.07.2026 (Toshstat, уверенность A), ряды 2022-2026, средняя номинальная зарплата (I полугодие 2025 и 2026), оборот розничной торговли (январь-июль 2026), предприятия и субъекты бизнеса (01.08.2026), миграция, здравоохранение, дошкольные учреждения, строительство.' + (DIR2 ? ' Пакет tashkent_gis_master: коды SOATO уровня A, кадастровые префиксы, геодезические площади, население на 01.10.2025 (Toshstat, A) и 01.01.2026 (hudud.stat.uz, B: портал в тестовом режиме), число махаллей и полигонов, центры районов, прежние названия и правовые акты.' : '');
demo.districts.sources = ['Toshstat, Demografiya Jan-Jun 2026 (toshstat.uz/2026/demografiya/demografiya1.pdf)', 'Toshstat, Demografiya Jan-Sep 2025, Jan-Mar 2025, Jan-Dec 2024', 'Toshstat, Mehnat Jan-Jun 2026 (зарплата)', 'Toshstat, Ichki savdo Jan-Jul 2026 (розница)', 'Toshstat, Korxona registri Aug 2026', 'Toshstat, Qurilish Jan-Apr 2026', 'Toshstat, Sog\'liqni saqlash 2023, Maktabgacha ta\'lim 2021', 'пакет tashkent_gis_dataset (CASE, 18.09.2026): 03_tashkent_districts.csv, 10_tashkent_district_demographics_socioeconomic_long.csv'];

/* 2b. районы из мастер-набора v2 */
if (DIR2) {
  const d2 = csv('03_tashkent_districts.csv', DIR2);
  d2.forEach(r => {
    const k = keyOf(r.district_name_uz_latin); if (!k) { console.log('v2: район без ключа: ' + r.district_name_uz_latin); return; }
    D[k] = D[k] || {};
    Object.assign(D[k], { soato: r.soato_code, soato_grade: 'A', soato_source: 'Госреестр АТЕ (ПКМ 832 от 10.12.2024) через hudud.stat.uz и кадастровый слой TUMAN_BORDER', cadastre_prefix: r.cadastre_prefix, area_km2_geodesic: num(r.area_km2_geodesic), area_source: dash(nul(r.boundary_source)), population_2026_01_01: num(r.population_2026_01_01), population_2025_10_01: num(r.population_2025_10_01), density_2026_01_01: num(r.population_density_per_km2_2026), mahallas_official: num(r.number_of_mahallas_official), mahallas_with_polygon: num(r.mahallas_with_official_polygon), polygon_coverage_pct: num(r.mahalla_polygon_coverage_pct), centroid: [num(r.latitude_centroid), num(r.longitude_centroid)], district_center: dash(nul(r.district_center)), former_names: dash(nul(r.former_names)), legal_document: nul(r.legal_document_defining_name) ? { name: dash(r.legal_document_defining_name), date: nul(r.legal_document_date), url: nul(r.legal_document_url) } : null, last_verified: nul(r.last_verified_date) });
    if (num(r.population_2025_10_01) != null) addSeries(k, '2025-10-01', num(r.population_2025_10_01), 'Toshkent shahar statistika boshqarmasi, Demografiya Jan-Sep 2025', 'verified');
    if (num(r.population_2026_01_01) != null) addSeries(k, '2026-01-01', num(r.population_2026_01_01), 'Milliy statistika qo\'mitasi, SIAT hudud.stat.uz (портал в тестовом режиме)', 'asking');
  });
  demo.districts.sources.push('пакет tashkent_gis_master (CASE, 18.09.2026): 01_tashkent_districts.geojson, 03_tashkent_districts.csv, 05_tashkent_mahalla_demographics.csv, 07_tashkent_admin_changes.csv');
  try { demo.districts.admin_changes = csv('07_tashkent_admin_changes.csv', DIR2).map(r => ({ date: r.change_date, entity: r.entity_type, old_name: dash(nul(r.old_name)), new_name: dash(nul(r.new_name)), old_district: dash(nul(r.old_district)), new_district: dash(nul(r.new_district)), type: r.change_type, document: dash(nul(r.legal_document)), url: nul(r.source_url), source_class: nul(r.source_class), description: dash(nul(r.description)) })); } catch (e) { console.log('07 не прочитан: ' + e.message); }
}
Object.keys(D).forEach(k => { if (D[k].population_series) D[k].population_series.sort((a, b) => a.date.localeCompare(b.date)); });

/* 3. город: перепись, семьи, показатели, ряд населения */
const city = csv('11_tashkent_city_indicators.csv');
const cityInd = {};
city.forEach(r => { const v = num(r.value); cityInd[r.indicator] = { value: v, unit: r.unit, date: r.reference_date, source: dash(r.source_name), url: r.source_url, conf: r.confidence }; });
demo.city.indicators = cityInd;
const series = demo.city.population_series;
const add = (date, value, source, conf) => { if (!series.some(p => p.date === date)) series.push({ date, value, source, conf }); };
/* 01.07.2026: сумма 12 районов из бюллетеня Toshstat (уверенность A) подтверждает число города из релиза */
const sum0707 = Object.keys(D).reduce((a, k) => a + (D[k].population_2026_07_01 || 0), 0);
{ const p = series.find(x => x.date === '2026-07-01'); if (p && Math.abs(sum0707 - p.value) <= 500) { p.conf = 'verified'; p.source = 'Toshstat, Demografiya Jan-Jun 2026 (toshstat.uz/2026/demografiya/demografiya1.pdf), таблица по районам: сумма 12 районов ' + sum0707.toLocaleString('ru'); p.note = 'сверено пакетом tashkent_gis_dataset (18.09.2026): сумма районов равна числу релиза stat.uz'; } else if (p) console.log('01.07.2026: сумма районов ' + sum0707 + ' не сходится с городом ' + p.value); }
add('2026-01-01', 3178100, 'Milliy statistika qo\'mitasi, релиз по демографии (публикация 27.01.2026), stat.uz/img/news/demografiya-lotin_p85803.pdf', 'verified');
demo.city.population_series_disputed = [{ date: '2026-01-15', value: 3224838, source: 'перепись населения 2026, предварительные итоги (stat.uz/img/news/kitob-uzb_p68566.pdf)', why: 'перепись и текущий учёт (doimiy aholi) считают по-разному: перепись выше регистра на ~47 тыс.; в ряд текущего учёта не включается, показывается отдельно' }];
if (DIR2) {
  const d5 = csv('05_tashkent_mahalla_demographics.csv', DIR2);
  d5.filter(r => r.entity_level === 'city').forEach(r => {
    const v = num(r.value); if (v == null) return;
    if (r.indicator === 'population_total' && r.reference_date === '2025-10-01') add('2025-10-01', Math.round(v), dash(r.source_name) + ' (' + r.source_url + ')', 'verified');
    if (r.indicator === 'population_total' && r.reference_date === '2026-01-01' && !series.some(p => p.date === '2026-01-01' && p.value === Math.round(v))) demo.city.population_series_disputed.push({ date: '2026-01-01', value: Math.round(v), source: dash(r.source_name) + ' (' + r.source_url + ')', why: 'сумма 12 районов по порталу hudud.stat.uz (тестовый режим, уверенность B) выше релиза Госкомстата 3 178 100 на 17,8 тыс.; в ряд берётся релиз' });
    if (r.indicator === 'area_km2') demo.city.area_km2_geodesic = { value: v, date: r.reference_date, source: dash(r.source_name), conf: 'verified', note: 'сумма геодезических площадей 12 районов по кадастровому слою TUMAN_BORDER' };
    if (r.indicator === 'number_of_mahallas') demo.city.mahallas_official = { value: v, date: r.reference_date, source: dash(r.source_name), conf: 'verified' };
  });
  /* махалли: 585 строк population_total = NULL: факт отсутствия публикации, не оценка */
  const mRows = d5.filter(r => r.entity_level === 'mahalla');
  demo.mahallas.population_published = { rows_checked: mRows.length, with_value: mRows.filter(r => nul(r.value) != null).length, note: 'В мастер-наборе 05_tashkent_mahalla_demographics.csv у всех ' + mRows.filter(r => nul(r.value) == null).length + ' махаллей population_total = NULL: ни один открытый источник (stat.uz, hudud.stat.uz, toshstat.uz, data.egov.uz, перепись 2026, HDX, WorldPop) не публикует население ниже района. Оценки студии по сетке населения помечены как modelled.' };
}
series.sort((a, b) => a.date.localeCompare(b.date));
demo.city.population_series_missing = ['2016-01-01', '2017-01-01', '2018-01-01', '2022-01-01', '2023-01-01'];
demo.city.census_2026 = { date: '2026-01-15', total: 3224838, male: 1612832, female: 1612006, female_share: +(1612006 / 3224838).toFixed(4), source: 'Milliy statistika qo\'mitasi, предварительные итоги переписи 2026 (stat.uz/img/news/kitob-uzb_p68566.pdf; aholi.stat.uz, 07.07.2026)', conf: 'verified', note: 'итоги по районам и махаллям публикуются поэтапно до 01.07.2027; по переписи доля женщин 50,0% против 50,9% по текущему учёту' };
if (cityInd.number_of_families) demo.city.household.families_2025 = { value: cityInd.number_of_families.value, date: cityInd.number_of_families.date, source: cityInd.number_of_families.source, note: 'семьи по учёту ЗАГС, не домохозяйства' };
if (cityInd.population_female && cityInd.population_male && !demo.city.sex.history.some(h => h.date === '2026-07-01' && h.conf === 'verified')) demo.city.sex.history.push({ date: '2026-07-01', male: Math.round(cityInd.population_male.value * 1000), female: Math.round(cityInd.population_female.value * 1000), source: 'Toshstat, Demografiya Jan-Jun 2026', conf: 'verified' });
demo.city.sex.history = demo.city.sex.history.filter(h => !(h.date === '2026-07-01' && h.conf === 'modelled'));
demo.city.sex.female_share = +(1633.3 / 3212.2).toFixed(4); demo.city.sex.date = '2026-07-01'; demo.city.sex.source = 'Toshstat, Demografiya Jan-Jun 2026: женщины 1 633,3 тыс., мужчины 1 578,9 тыс.'; demo.city.sex.conf = 'verified';
demo.city.market = { malls: { count: 24, gla_m2: 514000, vacancy: 0.18, gla_per_1000: 165 }, offices: { gla_m2: 591217, vacancy: 0.16 }, warehouses: { stock_m2: 634000 }, new_housing_2025_m2: 2170000, retail_turnover_bn_uzs_2026_jan_jul: cityInd.retail_turnover ? cityInd.retail_turnover.value : null, retail_outlets: cityInd.retail_outlets_enterprises ? cityInd.retail_outlets_enterprises.value : null, catering: cityInd.catering_facilities ? cityInd.catering_facilities.value : null, vehicles_2026_07: cityInd.registered_vehicles_owned_by_population ? cityInd.registered_vehicles_owned_by_population.value : null, source: 'CMWP Uzbekistan 2025 (spot.uz 06.01.2026); Toshstat, Ichki savdo Jan-Jul 2026; NSC via spot.uz 24.08.2026', conf: 'verified' };
demo.mahallas.registry_total = registry.length; demo.mahallas.registry_file = 'data/mahalla_registry_tashkent.json'; demo.mahallas.registry_schema = registryOut.schema; demo.mahallas.with_polygon = registryOut.with_polygon;
demo.mahallas.boundaries_file = 'data/mahalla_boundaries.geojson';
demo.mahallas.official_layer = { api: 'https://services8.arcgis.com/GyR85gR88mMqIY4t/arcgis/rest/services/Tashkent_Mahallas/FeatureServer/0', download: 'https://hub.arcgis.com/api/v3/datasets/c51c854bad2d48f1beaad40272f8d483_0/downloads/data?format=geojson&spatialRefId=4326', count: 585, note: 'слой хокимията со всеми 585 махаллями; из сети CASE OS недоступен, скачивается скриптом fetch_official_geometry.sh на своей машине и конвертируется node docs/qa/tools/ngis_to_studio.js в data/mahalla_boundaries.geojson' };
demo.mahallas.cadastre_layer = { api: 'https://db.ngis.uz/db/rest/services/UZKAD/MAHALLA_UZKAD_DB16/FeatureServer/0', count: 402, of: 585, date_range: '2026-03-14..2026-08-27', note: 'слой заполняется постепенно (183 махалли ещё не опубликованы); повторный запрос раз в месяц скриптом refresh_tashkent_gis.py из мастер-набора' };
if (dup.length) demo.mahallas.duplicates_rule = dup;

/* 3b. реестры источников и недостающих данных из мастер-набора */
if (DIR2) {
  try {
    const s8 = csv('08_tashkent_sources.csv', DIR2).map(r => ({ id: 'MASTER-' + r.SOURCE_ID, title: dash(r.source_title), org: dash(r.organization), type: dash(r.source_type), published: nul(r.publication_date), reference: nul(r.data_reference_date), url: nul(r.URL), what: dash(r.what_data_was_extracted), scope: dash(r.geographic_scope), official: r.official_or_secondary, conf: r.confidence, comment: dash(nul(r.comments)) }));
    demo.sources_register = (demo.sources_register || []).filter(s => !/^MASTER-/.test(String(s.id))).concat(s8);
    demo.ngis = demo.ngis || {};
    demo.ngis.gis_sources = csv('06_tashkent_gis_sources.csv', DIR2).map(r => ({ entity: r.entity_type, name: dash(r.entity_name), district: r.district, status: r.geometry_status, format: dash(r.geometry_format), crs: dash(r.coordinate_system), authority: dash(r.source_authority), source: dash(r.source_name), url: nul(r.source_url), download: nul(r.download_url), api: nul(r.api_url), reference: nul(r.reference_date), accessed: nul(r.access_date), conf: r.confidence, note: dash(nul(r.notes)) }));
    demo.missing_register = csv('09_tashkent_missing_data.csv', DIR2).map(r => ({ entity: dash(r.entity), field: dash(r.missing_field), searched: dash(r.what_was_searched), best: dash(r.best_source_found), why: dash(r.why_data_is_still_missing), next: dash(r.recommended_next_source), request_needed: dash(r.official_information_request_needed), priority: r.priority }));
  } catch (e) { console.log('реестры источников не прочитаны: ' + e.message); }
}
demo.inputs_needed = demo.inputs_needed.filter(x => !/Сверка 3 212,2 тыс/.test(x.what) && !/Границы махаллей по районам \(официальные слои Open Data/.test(x.what) && !/Полный реестр махаллей с кодами/.test(x.what) && !/^Население и число домохозяйств по махаллям$/.test(x.what) && !/^Коды районов \(СОАТО, кадастр\)/.test(x.what) && !/Население по районам Ташкента за 2016-2026/.test(x.what) && !/Подтверждение кодов SOATO районов/.test(x.what) && !/Официальные границы всех 585 махаллей/.test(x.what) && !/Население, домохозяйства и возраст по махаллям \(единый реестр/.test(x.what));
[{ what: 'Население по районам Ташкента до 2022 года (ряд 2016-2021) и перепись 2026 по районам', owner: 'аналитик CASE', where: 'toshstat.uz бюллетени прошлых лет; итоги переписи 2026 на aholi.stat.uz до 01.07.2027' },
 { what: 'Рождаемость и смертность по районам Ташкента (миграция по районам уже есть)', owner: 'аналитик CASE', where: 'Toshstat, бюллетень «Demografiya» по районам' },
 { what: 'Границы 183 махаллей, которых ещё нет в кадастровом слое (402 из 585 в студии)', owner: 'аналитик CASE (раз в месяц, 20 секунд на своей машине)', where: 'python3 docs/data/tashkent_gis_master/refresh_tashkent_gis.py, затем node docs/qa/tools/ngis_to_studio.js 02_tashkent_mahallas.geojson; либо слой хокимията (585) через fetch_official_geometry.sh' },
 { what: 'Население, домохозяйства и возраст по махаллям (ни один открытый источник не публикует ниже района)', owner: 'руководство CASE (письменный запрос)', where: 'Milliy statistika qo\'mitasi или Toshkent shahar statistika boshqarmasi: таблица переписи 2026 по махаллям; единый реестр МФЙ (ПКМ 586 от 15.09.2025), O\'zbekiston Mahallalari Uyushmasi' },
 { what: 'Условия коммерческого использования слоёв НГИС (open.ngis.uz) и слоя махаллей хокимията', owner: 'руководство CASE', where: 'Кадастр агентлиги; Управление цифрового развития хокимията Ташкента' }].forEach(x => { if (!demo.inputs_needed.some(y => y.what === x.what)) demo.inputs_needed.push(x); });
demo.version = new Date().toISOString().slice(0, 10);
fs.writeFileSync(DEMO_PATH, JSON.stringify(demo, null, 2));
console.log('demography_tashkent.json: районы ' + Object.keys(D).length + ', показатели города ' + Object.keys(cityInd).length + (DIR2 ? ', источники мастер-набора ' + (demo.sources_register || []).filter(s => /^MASTER-/.test(String(s.id))).length + ', недостающие ' + (demo.missing_register || []).length : ''));

/* 4. строка DIST для студии: население 01.07.2026 (тыс.), площадь по границам 2024 (км²) */
const gj = JSON.parse(fs.readFileSync(path.join(OS, 'data', 'tashkent_districts.geojson'), 'utf8'));
const SYN = { yunusobod: 'Yunusabad', chilonzor: 'Chilanzar', shayxontohur: 'Shaykhantakhur', olmazor: 'Olmazor', mirzoulugbek: 'Mirzo-Ulugbek', yashnobod: 'Yashnabad', uchtepa: 'Uchtepa', sergeli: 'Sergeli', mirobod: 'Mirabad', yakkasaroy: 'Yakkasaray', bektemir: 'Bektemir', yangihayot: 'Yangihayot' };
const area = {}; gj.features.forEach(f => { const k = SYN[String(f.properties.name || '').toLowerCase().replace(/[^a-z]/g, '')]; if (k) area[k] = +(f.properties.area_ha / 100).toFixed(2); });
const order = ['Olmazor', 'Yunusabad', 'Shaykhantakhur', 'Mirzo-Ulugbek', 'Yashnabad', 'Uchtepa', 'Chilanzar', 'Yangihayot', 'Sergeli', 'Mirabad', 'Yakkasaray', 'Bektemir'];
const line = 'DIST={' + order.map(k => JSON.stringify(k) + ': [' + (D[k].population_2026_07_01 / 1000).toFixed(1) + ', ' + area[k] + ']').join(', ') + '}';
console.log('DIST для студии (население 01.07.2026 тыс., площадь по границам 2024 км²):\n' + line);
if (DIR2) console.log('площади: границы 2024 / геодезические по кадастру: ' + order.map(k => k + ' ' + area[k] + '/' + D[k].area_km2_geodesic).join(', '));
fs.writeFileSync(path.join(__dirname, 'DIST_line.txt'), line);
