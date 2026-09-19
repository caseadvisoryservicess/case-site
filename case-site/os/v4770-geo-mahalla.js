/* CASE OS v4.77.0: махалли по районам и демография в студии геоаналитики.
 *
 * Решение владельца (дорожная карта после v4.76.0):
 *   - аналитика по карте идёт по районам (население и площадь), ниже уровнем нужны махалли:
 *     список махаллей Ташкента как подкатегории каждого района, население и его структура
 *     по каждой махалле; границ махаллей в открытых источниках нет, поэтому население махалли
 *     оценивается по калиброванной сетке населения вокруг точки махалли, а вручную введённое
 *     значение (карточка махалли в мастер-базе, поле «Население махалли») имеет приоритет;
 *   - вся аналитика показывает структуру населения: мужчины и женщины, пятилетние возрастные
 *     группы диаграммой, средний доход, число домохозяйств, на что люди тратят деньги
 *     (объём рынка по разделам расходов, рыночная доля проекта по методике CASE);
 *   - у каждого показателя тренд за прошлые годы и прогноз на десять лет вперёд с указанием
 *     метода. Прогноз подписан как прогноз, допущение как допущение: ничего не выдумывается.
 *
 * Данные: os/data/demography_tashkent.json (или window.CASE_DEMOGRAPHY во встроенной версии).
 * Каждое число там с источником, датой и степенью уверенности; пустое значение значит «нет
 * открытых данных» и попадает в список требуемых входных данных, а не в расчёт.
 *
 * Разделы: «Махалли и демография» в левой панели студии (район, махалли района, оценка
 * населения, показ на карте) и карточка «Демография» (охват: город, район, махалля, зона
 * охвата точки анализа) с диаграммами на чистом SVG. Длинных тире в тексте нет намеренно.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_DEMO) return;
  var VERSION = '4.79.0', KEY_SECT = 'caseos_mah_sect', KEY_OVR = 'caseos_mahalla_pop_v1', KEY_BND = 'caseos_mahalla_bounds_v1', KEY_SHOW = 'caseos_mah_show_v1', KEY_COL = 'caseos_mah_colors_v1', KERNEL_KM = 0.9, FORECAST_YEARS = 10, CAPTURE = 0.00394;
  var D = window.CASE_GEO_DEMO = { version: VERSION, data: null, ready: false };
  var OVR = {}, BNDL = {}, gMah = null, gSel = null, curDist = '', curMah = null, sortBy = 'pop', cache = {}, BND = null, REG = null, REGI = {}, REGC = {};
  var DIST_RU = { 'Yunusabad': 'Юнусабадский', 'Mirzo-Ulugbek': 'Мирзо-Улугбекский', 'Uchtepa': 'Учтепинский', 'Yashnabad': 'Яшнабадский', 'Olmazor': 'Алмазарский', 'Chilanzar': 'Чиланзарский', 'Sergeli': 'Сергелийский', 'Shaykhantakhur': 'Шайхантахурский', 'Mirabad': 'Мирабадский', 'Yangihayot': 'Янгихаётский', 'Yakkasaray': 'Яккасарайский', 'Bektemir': 'Бектемирский' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return n == null || !isFinite(n) ? '-' : Math.round(n).toLocaleString('ru'); }
  function pct(x, d) { return x == null || !isFinite(x) ? '-' : (x * 100).toFixed(d == null ? 1 : d).replace('.', ',') + '%'; }
  function mln(n) { return n == null || !isFinite(n) ? '-' : (n / 1e6).toFixed(n < 1e7 ? 2 : 1).replace('.', ',') + ' млн'; }
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function havKm(a, b, c, d) { try { return hav(a, b, c, d); } catch (e) { var R = 6371, r = function (x) { return x * Math.PI / 180; }; var s = Math.pow(Math.sin(r(c - a) / 2), 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.pow(Math.sin(r(d - b) / 2), 2); return R * 2 * Math.asin(Math.sqrt(s)); } }
  function pop() { try { return (typeof POP !== 'undefined' && Array.isArray(POP)) ? POP : []; } catch (e) { return []; } }
  function zones() { try { return (typeof ZONES !== 'undefined' && Array.isArray(ZONES)) ? ZONES.filter(function (z) { return z.scope === 'city'; }) : []; } catch (e) { return []; } }
  function calibrated() { try { return typeof CAL !== 'undefined' && !!CAL; } catch (e) { return false; } }
  function mahRows() { try { return window.CASE_GEO_POI ? window.CASE_GEO_POI.rows('mahallas') : []; } catch (e) { return []; } }
  function point() { try { var p = window.caseGeoPoint ? window.caseGeoPoint() : null; return (p && !p.pending && isFinite(+p.lat) && isFinite(+p.lng)) ? { lat: +p.lat, lng: +p.lng, name: p.name, district: p.district } : null; } catch (e) { return null; } }
  function distRu(k) { return DIST_RU[k] || k || ''; }
  function toast(msg) { var t = $('geoToast'); if (t) { t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); } }
  function num(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; }

  /* --- данные демографии ---------------------------------------------------------------------- */
  function loadData() {
    if (window.CASE_DEMOGRAPHY && window.CASE_DEMOGRAPHY.schema) { D.data = window.CASE_DEMOGRAPHY; D.ready = true; return Promise.resolve(D.data); }
    return fetch('data/demography_tashkent.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('demography ' + r.status); return r.json(); })
      .then(function (j) { if (!j || j.schema !== 'case-demography/v1') throw new Error('demography schema'); D.data = j; D.ready = true; return j; })
      .catch(function (e) { try { console.warn('демография не загружена', e); } catch (_) {} D.data = null; D.ready = false; return null; });
  }
  /* Официальные границы махаллей (необязательный файл os/data/mahalla_boundaries.geojson: слои
     Open Data Tashkent после проверки CRS). Пока файла нет, население оценивается по радиусу. */
  function loadBoundaries() {
    var f = (D.data && D.data.mahallas && D.data.mahallas.boundaries_file) || 'data/mahalla_boundaries.geojson';
    if (window.CASE_MAHALLA_BOUNDARIES && window.CASE_MAHALLA_BOUNDARIES.features) return Promise.resolve(applyBoundaries(window.CASE_MAHALLA_BOUNDARIES, 'file'));
    return fetch(f, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (g) {
      if (!g || !Array.isArray(g.features) || !g.features.length) { return null; }
      return applyBoundaries(g, 'file');
    }).catch(function () { return null; });
  }
  /* v4.78.0: границы приходят из файла или живым запросом к НГИС (v4780-geo-ngis.js): один и тот же формат */
  function applyBoundaries(g, origin) {
    if (!g || !Array.isArray(g.features)) return null;
    var list = g.features.map(function (ft) { var ps = polys(ft.geometry); if (!ps.length) return null; var pr = ft.properties || {}; return { name: String(pr.name || pr.NAME || pr.mahalla || pr.title || ''), district: String(pr.district || pr.DISTRICT || ''), origin: origin || 'file', props: pr, polys: ps, bb: bbox(ps), ll: ps.map(function (p) { return p.map(function (ring) { return ring.map(function (c) { return [c[1], c[0]]; }); }); }) }; }).filter(Boolean);
    if (!list.length) return null;
    BND = (BND || []).filter(function (b) { return b.origin !== (origin || 'file'); }).concat(list);
    var ORD = { ngis: 0, file: 1, hokimiyat: 2 }; BND.sort(function (a, b) { return (ORD[a.origin] == null ? 3 : ORD[a.origin]) - (ORD[b.origin] == null ? 3 : ORD[b.origin]); });
    invalidate(); try { renderList(); drawMah(); if (curMah) bndInfo(); } catch (e) {}
    return BND;
  }
  D.setBoundaries = applyBoundaries;
  function polys(g) { if (!g) return []; if (g.type === 'Polygon') return [g.coordinates]; if (g.type === 'MultiPolygon') return g.coordinates; if (g.type === 'GeometryCollection') { var o = []; (g.geometries || []).forEach(function (x) { o = o.concat(polys(x)); }); return o; } return []; }
  function bbox(ps) { var b = [Infinity, Infinity, -Infinity, -Infinity]; ps.forEach(function (p) { p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); return b; }
  function ring(x, y, r) { var inside = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
  function inPolys(x, y, ps) { for (var k = 0; k < ps.length; k++) { var p = ps[k]; if (ring(x, y, p[0])) { var hole = false; for (var h = 1; h < p.length; h++) if (ring(x, y, p[h])) { hole = true; break; } if (!hole) return true; } } return false; }
  function inB(b, la, ln) { return !(ln < b.bb[0] || ln > b.bb[2] || la < b.bb[1] || la > b.bb[3]) && inPolys(ln, la, b.polys); }
  function nrm(s) { return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9']/g, ''); }
  /* v4.78.0: граница, введённая вручную с карты: в записи махалли мастер-базы (поле boundary, общая база) или,
     без права правок, в этом браузере (KEY_BND). Кольцо [[lat,lng],...] превращается в тот же объект, что и
     полигон из файла, поэтому население и рисование считаются одинаково. */
  function loadBndl() { try { var o = JSON.parse(localStorage.getItem(KEY_BND) || 'null'); if (o && typeof o === 'object') BNDL = o; } catch (e) { BNDL = {}; } }
  function saveBndl() { try { localStorage.setItem(KEY_BND, JSON.stringify(BNDL)); } catch (e) {} }
  function manualRing(m) {
    var k = keyOf(m), s = BNDL[k] != null ? BNDL[k] : m.boundary; if (!s) return null;
    try { var r = typeof s === 'string' ? JSON.parse(s) : s; if (!Array.isArray(r) || r.length < 3) return null; r = r.map(function (p) { return [+p[0], +p[1]]; }).filter(function (p) { return isFinite(p[0]) && isFinite(p[1]); }); return r.length >= 3 ? r : null; } catch (e) { return null; }
  }
  function ringToBoundary(ring, m) { var ps = [[ring.map(function (p) { return [p[1], p[0]]; })]]; return { name: String(m.name || ''), district: String(m.district || ''), polys: ps, bb: bbox(ps), ll: [[ring.slice()]], manual: true }; }
  function boundaryFor(m, dk) {
    var mr = manualRing(m); if (mr) return ringToBoundary(mr, m);
    if (!BND) return null; var la = +m.lat, ln = +m.lng;
    for (var i = 0; i < BND.length; i++) { var b = BND[i]; if (b.district && dk && b.district !== dk) continue; if (inB(b, la, ln)) return b; }
    var n = nrm(m.name); if (!n) return null;
    for (var j = 0; j < BND.length; j++) if ((!BND[j].district || BND[j].district === dk) && nrm(BND[j].name) === n) return BND[j];
    return null;
  }
  /* население внутри границы: ячейки сетки как круги с дробным попаданием (popInZone гео-агента), чтобы
     небольшая махалля без центра ячейки внутри не получала ноль; без агента считаются центры ячеек */
  function popInBoundary(b) {
    var P = pop(), A = window.CASE_GEO_AGENT;
    if (A && typeof A.popInZone === 'function' && b.ll && b.ll.length) {
      try { var shapes = []; b.ll.forEach(function (pg) { if (pg && pg[0] && pg[0].length >= 3) shapes.push({ kind: 'polygon', ring: pg[0].map(function (c) { return [+c[0], +c[1]]; }) }); }); if (shapes.length) { var r = A.popInZone(shapes, P); if (r && isFinite(+r.population)) return +r.population; } } catch (e) {}
    }
    var s = 0; for (var i = 0; i < P.length; i++) { var h = P[i]; if (inB(b, h[0], h[1])) s += h[2]; } return s;
  }
  D.boundaries = function () { return BND; };
  /* v4.78.0: единый реестр 585 махаллей (Etirof + слой хокимията). Кадастровые участки по замечанию
     владельца не подключаются: они меняются слишком быстро, чтобы держать их в студии */
  function loadRegistry() {
    var f = (D.data && D.data.mahallas && D.data.mahallas.registry_file) || 'data/mahalla_registry_tashkent.json';
    var src = window.CASE_MAHALLA_REGISTRY ? Promise.resolve(window.CASE_MAHALLA_REGISTRY) : fetch(f, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; });
    return src.then(function (j) {
      if (!j || !Array.isArray(j.rows) || !j.rows.length) return null;
      REG = j; REGI = {}; REGC = {};
      j.rows.forEach(function (r) { if (r.code) REGC[String(r.code)] = r; var d = String(r.district || ''); (REGI[d] = REGI[d] || []).push(r); });
      invalidate(); try { renderList(); drawMah(); } catch (e) {}
      return j;
    }).catch(function () { return null; });
  }
  D.registry = function () { return REG; };
  /* имена в мастер-базе в английской транслитерации (KH, K за q, U за oʻ), в реестре узбекская латиница
     и кириллица: сравнение по упрощённой форме и расстоянию Левенштейна внутри района; одна запись
     реестра присоединяется к одной строке базы */
  function nrmX(s) {
    s = String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[ʻʼ’`‘']/g, '').replace(/\s*(mfy|mahalla fuqarolar yigini|mahallasi|mahalla|махалля|мфй)\s*$/g, '');
    var digits = (s.match(/\d+/g) || []).join('');
    return s.replace(/\d+/g, '').replace(/kh/g, 'h').replace(/gh/g, 'g').replace(/x/g, 'h').replace(/q/g, 'k').replace(/v/g, 'b').replace(/w/g, 'b').replace(/[^a-zа-яё]/g, '') + digits;
  }
  function lev(a, b) { var m = a.length, n = b.length, d = [], i, j; for (i = 0; i <= m; i++) d[i] = [i]; for (j = 1; j <= n; j++) d[0][j] = j; for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; }
  function simX(a, b) { return 1 - lev(a, b) / Math.max(a.length, b.length, 1); }
  function regNames(r) { return [r.name, r.name_hokimiyat, r.name_cyr, r.name_ru].filter(Boolean).map(nrmX); }
  function polygonAt(la, ln, dk) { if (!BND) return null; for (var i = 0; i < BND.length; i++) { var b = BND[i]; if (dk && b.district && b.district !== dk) continue; if (inB(b, la, ln)) return b; } return null; }
  function boundaryByCode(code) { if (!BND || !code) return null; for (var i = 0; i < BND.length; i++) { var b = BND[i]; if (b.props && String(b.props.mahalla_code) === String(code)) return b; } return null; }
  /* сопоставление строк района с реестром: точное имя, затем полигон реестра, в котором лежит точка,
     затем близкое имя (сходство не ниже 0,8, числа в имени совпадают) */
  function matchRegistry(rows, dk) {
    var out = [], used = {}, list = REGI[dk] || []; if (!list.length) return out;
    var pre = list.map(function (r) { return { r: r, ns: regNames(r) }; });
    var names = rows.map(function (m) { return nrmX(m.name); });
    var claim = function (i, r, how, s) { used[r.code] = true; out[i] = { r: r, how: how, s: s }; };
    rows.forEach(function (m, i) { var n = names[i]; if (!n) return; for (var k = 0; k < pre.length; k++) { var p = pre[k]; if (used[p.r.code]) continue; if (p.ns.indexOf(n) >= 0) { claim(i, p.r, 'name'); return; } } });
    rows.forEach(function (m, i) { if (out[i]) return; var b = polygonAt(+m.lat, +m.lng, dk); var code = b && b.props ? String(b.props.mahalla_code || '') : ''; if (code && REGC[code] && !used[code]) claim(i, REGC[code], 'polygon'); });
    rows.forEach(function (m, i) { if (out[i]) return; var n = names[i]; if (!n) return; var dg = (n.match(/\d+$/) || [''])[0], best = null, bs = 0; pre.forEach(function (p) { if (used[p.r.code]) return; p.ns.forEach(function (x) { if ((x.match(/\d+$/) || [''])[0] !== dg) return; var sc = simX(x, n); if (sc > bs) { bs = sc; best = p.r; } }); }); if (best && bs >= 0.8) claim(i, best, 'similar', +bs.toFixed(2)); });
    return out;
  }
  /* махалля в точке (любой район): полигон реестра, иначе ближайшая точка базы в пределах 400 м */
  function mahallaAt(la, ln) {
    var b = polygonAt(+la, +ln, ''); if (b) { var r = b.props && b.props.mahalla_code ? REGC[String(b.props.mahalla_code)] : null; return { name: (r && r.name) || b.name, district: b.district, code: r ? r.code : ((b.props && b.props.mahalla_code) || ''), area_ha: (r && r.area_ha != null) ? r.area_ha : ((b.props && b.props.area_ha != null) ? b.props.area_ha : null), name_ru: r ? r.name_ru : null, origin: b.manual ? 'manual' : b.origin, polygon: b }; }
    var best = null, bd = 0.4; mahRows().forEach(function (m) { if (!isFinite(+m.lat) || !isFinite(+m.lng)) return; var d = havKm(+la, +ln, +m.lat, +m.lng); if (d < bd) { bd = d; best = m; } });
    return best ? { name: best.name, district: best.district, code: '', area_ha: null, origin: 'point', dist_km: bd } : null;
  }
  D.mahallaAt = mahallaAt;
  /* по замечанию владельца (v4.78.0): у махаллей без официальной границы рисуется расчётная граница:
     ячейка Вороного по точкам махаллей района, обрезанная границей района (полуплоскости в метрах,
     отсечение Сазерленда-Ходжмана). Это ориентир для карты, помечен пунктиром и словом «расчётная»;
     население таких махаллей по-прежнему считается по сетке вокруг точки, не внутри ячейки. Как только
     появляется официальный полигон (файл, НГИС, хокимият, вручную), расчётная ячейка исчезает. */
  function districtRing(dk, la, ln) {
    var z = zones().filter(function (x) { return x.key === dk; })[0]; if (!z || !z.polys || !z.polys.length) return null;
    var best = null; z.polys.forEach(function (pg) { if (pg && pg[0] && pg[0].length >= 3 && ring(ln, la, pg[0])) best = pg[0]; });
    if (!best) z.polys.forEach(function (pg) { if (pg && pg[0] && (!best || pg[0].length > best.length)) best = pg[0]; });
    return best;
  }
  function voronoiCell(rows, i, dk) {
    var m = rows[i], la = +m.lat, ln = +m.lng, base = districtRing(dk, la, ln); if (!base) return null;
    var kx = 111320 * Math.cos(la * Math.PI / 180), ky = 111320;
    var P = [ln * kx, la * ky], poly = base.map(function (c) { return [c[0] * kx, c[1] * ky]; });
    for (var j = 0; j < rows.length && poly.length >= 3; j++) {
      if (j === i) continue; var q = rows[j]; if (!isFinite(+q.lat) || !isFinite(+q.lng)) continue;
      var Q = [+q.lng * kx, +q.lat * ky], dx = Q[0] - P[0], dy = Q[1] - P[1]; if (dx * dx + dy * dy < 1) continue;
      var cst = (Q[0] * Q[0] + Q[1] * Q[1] - P[0] * P[0] - P[1] * P[1]) / 2, out = [];
      for (var k = 0; k < poly.length; k++) {
        var A = poly[k], B = poly[(k + 1) % poly.length], fa = dx * A[0] + dy * A[1] - cst, fb = dx * B[0] + dy * B[1] - cst;
        if (fa <= 0) out.push(A);
        if ((fa <= 0) !== (fb <= 0)) { var t = fa / (fa - fb); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
      }
      poly = out;
    }
    if (poly.length < 3) return null;
    var ringLL = poly.map(function (c) { return [+(c[0] / kx).toFixed(6), +(c[1] / ky).toFixed(6)]; }), ps = [[ringLL]];
    return { name: String(m.name || ''), district: dk, polys: ps, bb: bbox(ps), ll: [[ringLL.map(function (c) { return [c[1], c[0]]; })]], approx: true, origin: 'approx' };
  }
  function mahallaLine(ma) {
    if (!ma) return 'Махалля точки: границы и точки базы рядом нет';
    return 'Махалля точки: ' + ma.name + (ma.name_ru ? ' (' + ma.name_ru + ')' : '') + (ma.district ? ', ' + distRu(ma.district) + ' район' : '') + (ma.code ? ', код ' + ma.code : '') + (ma.area_ha != null ? ', ' + Math.round(ma.area_ha) + ' га' : '') + (ma.origin === 'point' ? '; ближайшая точка базы в ' + Math.round(ma.dist_km * 1000) + ' м, границы нет' : ma.origin === 'manual' ? '; граница введена вручную' : '; граница из слоя махаллей НГИС');
  }
  function city() { return (D.data && D.data.city) || null; }
  function cityPop() {
    var c = city(); if (!c) return null;
    var s = (c.population_series || []).filter(function (p) { return p && isFinite(+p.value); });
    return s.length ? s[s.length - 1] : null;
  }
  function yearOf(date) { var d = new Date(date); return d.getFullYear() + (d.getMonth() + d.getDate() / 31) / 12; }

  /* Тренд и прогноз: среднегодовой темп (CAGR) по всему ряду фактов, прогноз продлением темпа.
     Метод один для всех показателей, подписан в карточке. Для ряда из одной точки прогноза нет. */
  function trendOf(series) {
    var s = (series || []).filter(function (p) { return p && isFinite(+p.value) && p.date; }).map(function (p) { return { t: yearOf(p.date), v: +p.value, date: p.date, conf: p.conf || 'verified' }; }).sort(function (a, b) { return a.t - b.t; });
    if (s.length < 2) return { points: s, cagr: null, forecast: [] };
    var a = s[0], b = s[s.length - 1], years = b.t - a.t;
    var cagr = years > 0 && a.v > 0 ? Math.pow(b.v / a.v, 1 / years) - 1 : null;
    var fc = [];
    if (cagr != null) { var y0 = Math.floor(b.t); for (var k = 1; k <= FORECAST_YEARS; k++) fc.push({ t: y0 + k, v: b.v * Math.pow(1 + cagr, (y0 + k) - b.t), conf: 'modelled' }); }
    return { points: s, cagr: cagr, forecast: fc, last: b, first: a };
  }
  D.trendOf = trendOf;

  /* --- оценка населения махалли ---------------------------------------------------------------- */
  function loadOvr() { try { var o = JSON.parse(localStorage.getItem(KEY_OVR) || 'null'); if (o && typeof o === 'object') OVR = o; } catch (e) { OVR = {}; } }
  function saveOvr() { try { localStorage.setItem(KEY_OVR, JSON.stringify(OVR)); } catch (e) {} }
  function keyOf(m) { return String(m.master_id || m.name + '|' + m.district); }
  function manualPop(m) { var k = keyOf(m); if (OVR[k] != null) return { value: +OVR[k], src: 'ввод вручную (эта копия студии)' }; var v = num(m.population); if (v != null && v > 0) return { value: v, src: 'мастер-база, карточка махалли' }; return null; }
  function manualHh(m) { var v = num(m.households); return v != null && v > 0 ? v : null; }

  /* Вес махалли внутри района: ядро по калиброванной сетке населения (радиус KERNEL_KM, линейное
     затухание), нормированный на сумму по махаллям района; население района из ZONES (официальное).
     Махалли с ручным значением из общей суммы вычитаются, остаток делится по весам. */
  function estimateDistrict(dk) {
    if (cache[dk]) return cache[dk];
    var base = mahRows().filter(function (m) { return String(m.district || '') === dk && isFinite(+m.lat) && isFinite(+m.lng); });
    var reg = matchRegistry(base, dk), usedCodes = {};
    reg.forEach(function (x) { if (x) usedCodes[x.r.code] = true; });
    /* официальные махалли с полигоном, которых нет в базе: строки реестра (помечены «реестр») */
    var rows = base.slice();
    (REGI[dk] || []).forEach(function (r) { if (usedCodes[r.code] || !r.polygon || !isFinite(+r.lat) || !isFinite(+r.lng)) return; rows.push({ name: r.name, district: dk, lat: +r.lat, lng: +r.lng, master_id: 'REG:' + r.code, address: r.name_ru || '', reg_only: true }); reg[rows.length - 1] = { r: r, how: 'registry' }; });
    var z = zones().filter(function (x) { return x.key === dk; })[0];
    var total = z ? z.pop : null, P = pop(), w = [], sumW = 0, manualSum = 0, manualN = 0, bnd = [], bndSum = 0, bndN = 0, claimed = {}, cand = {};
    /* границы: вручную > полигон по коду реестра > полигон, в котором лежит точка; один полигон одной строке */
    rows.forEach(function (m, i) {
      var mr = manualRing(m); if (mr) { bnd[i] = { b: ringToBoundary(mr, m) }; return; }
      var code = reg[i] ? String(reg[i].r.code) : '', b = code ? boundaryByCode(code) : null;
      if (b && claimed[code] == null) { claimed[code] = i; bnd[i] = { b: b }; }
    });
    rows.forEach(function (m, i) {
      if (bnd[i] || manualPop(m)) return; var b = polygonAt(+m.lat, +m.lng, dk); if (!b) return;
      var code = String((b.props && b.props.mahalla_code) || (b.name + '|' + b.district)); if (claimed[code] != null) return;
      (cand[code] = cand[code] || { b: b, rows: [] }).rows.push(i);
    });
    Object.keys(cand).forEach(function (code) {
      var c = cand[code], ctr = c.b.props && isFinite(+c.b.props.lat) && isFinite(+c.b.props.lng) ? [+c.b.props.lat, +c.b.props.lng] : [(c.b.bb[1] + c.b.bb[3]) / 2, (c.b.bb[0] + c.b.bb[2]) / 2];
      c.rows.sort(function (a, b2) { return havKm(ctr[0], ctr[1], rows[a].lat, rows[a].lng) - havKm(ctr[0], ctr[1], rows[b2].lat, rows[b2].lng); });
      claimed[code] = c.rows[0]; bnd[c.rows[0]] = { b: c.b };
    });
    rows.forEach(function (m, i) {
      var mp = manualPop(m); if (mp) { manualSum += mp.value; manualN++; w[i] = 0; bnd[i] = null; return; }
      if (bnd[i]) { bnd[i].v = popInBoundary(bnd[i].b); bndSum += bnd[i].v; bndN++; w[i] = 0; return; }
      var s = 0, la = +m.lat, ln = +m.lng, dl = KERNEL_KM / 111.32, dn = KERNEL_KM / (111.32 * Math.cos(la * Math.PI / 180));
      for (var k = 0; k < P.length; k++) { var h = P[k]; if (Math.abs(h[0] - la) > dl || Math.abs(h[1] - ln) > dn) continue; var d = havKm(la, ln, h[0], h[1]); if (d <= KERNEL_KM) s += h[2] * (1 - d / KERNEL_KM); }
      w[i] = s; sumW += s;
    });
    var rest = total != null ? Math.max(0, total - manualSum - bndSum) : null, approxN = 0;
    var out = rows.map(function (m, i) {
      var mp = manualPop(m), est = null, conf = 'modelled', src = '', poly = null, r = reg[i] ? reg[i].r : null;
      if (!bnd[i]) { try { poly = voronoiCell(rows, i, dk); if (poly) approxN++; } catch (e) { poly = null; } }
      if (mp) { est = mp.value; conf = 'verified'; src = mp.src; }
      else if (bnd[i]) { est = bnd[i].v; conf = 'asking'; src = bnd[i].b.manual ? 'сетка населения внутри границы, введённой вручную с карты' : 'сетка населения внутри официальной границы махалли (' + (bnd[i].b.origin === 'ngis' ? 'НГИС, живой запрос' : 'слой махаллей НГИС') + ')'; poly = bnd[i].b; }
      else if (rest != null && sumW > 0) { est = rest * w[i] / sumW; src = 'оценка: население района × доля махалли по сетке населения (' + Math.round(KERNEL_KM * 1000) + ' м)'; }
      else if (sumW > 0) { est = null; src = 'нет официального населения района'; }
      var area = r && r.area_ha != null ? r.area_ha : (r && r.area_ha_hokimiyat != null ? r.area_ha_hokimiyat : (poly && poly.props && poly.props.area_ha != null ? poly.props.area_ha : null));
      return { m: m, key: keyOf(m), name: m.name, pop: est, conf: conf, src: src, hh: manualHh(m), manual: !!mp, poly: poly, lat: +m.lat, lng: +m.lng, reg: r, regHow: reg[i] ? reg[i].how : null, regOnly: !!m.reg_only, area_ha: area, density: area && est != null ? est / (area / 100) : null };
    });
    var official = REGI[dk] ? REGI[dk].length : null, matched = reg.filter(function (x) { return x && x.how !== 'registry'; }).length, regOnlyN = rows.filter(function (m) { return m.reg_only; }).length;
    var missing = official != null ? (REGI[dk] || []).filter(function (r) { return !usedCodes[r.code] && !r.polygon; }).map(function (r) { return r.name; }) : [];
    cache[dk] = { rows: out, total: total, manualN: manualN, manualSum: manualSum, boundedN: bndN, approxN: approxN, calibrated: calibrated() && P.length > 0, official: official, matched: matched, regOnly: regOnlyN, missing: missing, baseN: base.length, polygons: REG && REG.by_district && REG.by_district[dk] ? REG.by_district[dk].polygons : null };
    return cache[dk];
  }
  D.estimateDistrict = estimateDistrict;
  /* v4.78.1 (замечание владельца «все махалли сразу»): режим «Все районы»: строки всех районов вместе */
  var ALL = '*';
  function estimateAll() {
    if (cache[ALL]) return cache[ALL];
    var rows = [], total = 0, bounded = 0, approx = 0, manualN = 0, official = 0, matched = 0;
    districtsList().forEach(function (d) { var e = estimateDistrict(d.key); e.rows.forEach(function (r) { r.dk = d.key; rows.push(r); }); if (e.total) total += e.total; bounded += e.boundedN || 0; approx += e.approxN || 0; manualN += e.manualN || 0; official += e.official || 0; matched += e.matched || 0; });
    cache[ALL] = { rows: rows, total: total, manualN: manualN, boundedN: bounded, approxN: approx, official: official, matched: matched, regOnly: 0, missing: [], baseN: rows.length, polygons: null, calibrated: calibrated() && pop().length > 0, all: true };
    return cache[ALL];
  }
  function estimateCur(dk) { return dk === ALL ? estimateAll() : estimateDistrict(dk); }
  function invalidate() { cache = {}; }
  function districtsList() {
    var o = {}; mahRows().forEach(function (m) { var d = String(m.district || ''); if (d) o[d] = (o[d] || 0) + 1; });
    return Object.keys(o).sort(function (a, b) { return distRu(a).localeCompare(distRu(b), 'ru'); }).map(function (k) { return { key: k, n: o[k] }; });
  }

  /* --- структура населения для любого охвата -------------------------------------------------- */
  /* Вход: население N (число), радиус или площадь для плотности не требуется. Возвращает
     пол, три возрастные группы, пятилетние группы, домохозяйства, доход, расходы, RDE. Флаг
     assumptions перечисляет допущения словами: их печатает каждая карточка. */
  function structure(N) {
    var c = city(); if (!c || N == null || !isFinite(N)) return null;
    var A = [], fem = c.sex && c.sex.female_share != null ? c.sex.female_share : null;
    var work = c.age3 && c.age3.working_share != null ? c.age3.working_share : null;
    var under = c.age3 && c.age3.under_share != null ? c.age3.under_share : null, over = c.age3 && c.age3.over_share != null ? c.age3.over_share : null;
    var uz = (D.data.uzbekistan && D.data.uzbekistan.age3) || null;
    if (work != null && (under == null || over == null) && uz && uz.under_share != null && uz.over_share != null) {
      var rest = 1 - work, k = rest / (uz.under_share + uz.over_share); under = uz.under_share * k; over = uz.over_share * k;
      A.push('доли моложе и старше трудоспособного возраста по Ташкенту не опубликованы: остаток ' + pct(rest, 0) + ' поделён в национальной пропорции ' + pct(uz.under_share, 1) + ' : ' + pct(uz.over_share, 1));
    }
    var groups = (c.age5 && c.age5.groups) || [], male5 = c.age5 && Array.isArray(c.age5.male) ? c.age5.male : null, female5 = c.age5 && Array.isArray(c.age5.female) ? c.age5.female : null, age5 = null, age5conf = 'verified';
    if (male5 && female5 && male5.length === groups.length) age5 = groups.map(function (g, i) { return { g: g, m: N * male5[i], f: N * female5[i] }; });
    else if (under != null && work != null && over != null && groups.length) {
      /* трудоспособный возраст в Узбекистане: мужчины 16-59 (с 2024 года шаг к 60), женщины 16-54 (шаг к 55);
         для сетки 5-летних групп берём границы 0-14 / 15-59 / 60+ и равномерное деление внутри групп */
      age5conf = 'modelled';
      var bands = [['0-4', '5-9', '10-14'], ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59'], ['60-64', '65-69', '70-74', '75+']];
      var share = { under: under, work: work, over: over }, mf = fem != null ? fem : 0.5;
      age5 = groups.map(function (g) {
        var s = bands[0].indexOf(g) >= 0 ? share.under / bands[0].length : bands[1].indexOf(g) >= 0 ? share.work / bands[1].length : share.over / bands[2].length;
        var v = N * s; var fShare = bands[2].indexOf(g) >= 0 ? Math.min(0.62, mf + 0.08) : bands[0].indexOf(g) >= 0 ? Math.max(0.47, mf - 0.03) : mf;
        return { g: g, m: v * (1 - fShare), f: v * fShare };
      });
      /* нормировка пола к городской доле женщин */
      var sumF = age5.reduce(function (s, r) { return s + r.f; }, 0), sumM = age5.reduce(function (s, r) { return s + r.m; }, 0);
      if (fem != null && sumF + sumM > 0) { var kf = (N * fem) / sumF, km = (N * (1 - fem)) / sumM; age5.forEach(function (r) { r.f *= kf; r.m *= km; }); }
      A.push('пятилетние группы по Ташкенту не опубликованы: население распределено равномерно внутри трёх официальных групп (0-14, 15-59, 60+), это допущение до получения бюллетеня Toshstat');
    }
    var hhSize = c.household && c.household.size != null ? c.household.size : null;
    var inc = c.income && c.income.per_capita_uzs_year ? c.income.per_capita_uzs_year : {};
    var incYears = Object.keys(inc).sort(), incLast = incYears.length ? { year: incYears[incYears.length - 1], value: +inc[incYears[incYears.length - 1]] } : null;
    var fx = c.fx && c.fx.uzs_per_usd ? c.fx.uzs_per_usd : null;
    var rdeShare = c.spending && c.spending.rde_share_of_consumer != null ? c.spending.rde_share_of_consumer : null;
    var rdePc = c.spending && c.spending.rde_per_capita_uzs_year_2024 != null ? c.spending.rde_per_capita_uzs_year_2024 : null;
    var consumerPc = rdeShare && rdePc != null ? rdePc / rdeShare : null;
    if (consumerPc != null) A.push('база потребительских расходов на душу выведена как RDE / ' + pct(rdeShare, 0) + ' (методика CASE, 2024); структура расходов по разделам КИПЦ национальная');
    var kipc = D.data.kipc || null, kipcRows = [];
    if (kipc && Array.isArray(kipc.divisions) && consumerPc != null) {
      var yi = kipc.years.length - 1;
      kipcRows = kipc.divisions.map(function (d) { var w = d.w[yi]; return { code: d.code, name: d.name, w: w, market: N * consumerPc * w, rde: !!d.rde }; });
    }
    return {
      N: N, female: fem != null ? N * fem : null, male: fem != null ? N * (1 - fem) : null, femShare: fem,
      age3: under != null ? { under: N * under, work: N * work, over: N * over, underShare: under, workShare: work, overShare: over } : null,
      age5: age5, age5conf: age5conf, groups: groups,
      households: hhSize ? N / hhSize : null, hhSize: hhSize,
      income: incLast ? { year: incLast.year, uzs: incLast.value, usd: fx ? incLast.value / fx : null, total: incLast.value * N } : null,
      consumerPc: consumerPc, consumerTotal: consumerPc != null ? consumerPc * N : null,
      rde: rdePc != null ? { pc: rdePc, total: rdePc * N, usdPc: fx ? rdePc / fx : null, share: rdeShare } : null,
      kipc: kipcRows, kipcYear: kipc ? kipc.years[kipc.years.length - 1] : null, fx: fx, assumptions: A
    };
  }
  D.structure = structure;

  /* Ряды для тренда и прогноза по охвату: население (масштаб от городского ряда), доход,
     домохозяйства и RDE выводятся из населения и доходов, метод один: CAGR по фактам. */
  function seriesFor(N, base) {
    var c = city(); if (!c) return null;
    /* v4.78.0: для района и его махаллей ряд населения района (Toshstat), иначе городской ряд */
    var own = Array.isArray(base) && base.filter(function (p) { return p && isFinite(+p.value) && p.date; }).length >= 2 ? base : null;
    var cp = cityPop(), popTr = trendOf(own || c.population_series || []);
    var lastV = own && popTr.last ? popTr.last.v : (cp && cp.value ? cp.value : null);
    var k = lastV ? N / lastV : null;
    var scale = function (tr) { return { points: tr.points.map(function (p) { return { t: p.t, v: p.v * k, date: p.date, conf: p.conf }; }), forecast: tr.forecast.map(function (p) { return { t: p.t, v: p.v * k, conf: 'modelled' }; }), cagr: tr.cagr }; };
    var popS = k != null ? scale(popTr) : null;
    var inc = c.income && c.income.per_capita_uzs_year ? c.income.per_capita_uzs_year : {};
    var incTr = trendOf(Object.keys(inc).map(function (y) { return { date: y + '-12-31', value: +inc[y], conf: 'verified' }; }));
    var hhSize = c.household && c.household.size ? c.household.size : null;
    /* v4.78.0: расходы и объём рынка: население ряда × расходы на душу, растущие темпом дохода (расчёт, не факт) */
    var st = structure(N), incC = incTr.cagr != null ? incTr.cagr : 0;
    function derived(pc) {
      if (!popS || pc == null || !popS.points.length) return null;
      var last = popS.points[popS.points.length - 1];
      var f = function (p) { return { t: p.t, v: p.v * pc * Math.pow(1 + incC, p.t - last.t), conf: 'modelled' }; };
      return { points: popS.points.map(f), forecast: popS.forecast.map(f), cagr: popS.cagr != null ? (1 + popS.cagr) * (1 + incC) - 1 : null, derived: true };
    }
    return {
      pop: popS, income: incTr,
      households: popS && hhSize ? { points: popS.points.map(function (p) { return { t: p.t, v: p.v / hhSize, conf: p.conf }; }), forecast: popS.forecast.map(function (p) { return { t: p.t, v: p.v / hhSize, conf: 'modelled' }; }), cagr: popS.cagr } : null,
      spending: derived(st ? st.consumerPc : null), rde: derived(st && st.rde ? st.rde.pc : null),
      cityCagr: popTr.cagr, incomeCagr: incTr.cagr, own: !!own
    };
  }
  D.seriesFor = seriesFor;

  /* --- население внутри охвата ---------------------------------------------------------------- */
  function popInCircle(lat, lng, km) { var P = pop(), s = 0; for (var i = 0; i < P.length; i++) { var h = P[i]; if (havKm(lat, lng, h[0], h[1]) <= km) s += h[2]; } return s; }
  function scopeCatchment() {
    var p = point(); if (!p) return null;
    var A = window.CASE_GEO_AGENT, zone = A && A.state && Array.isArray(A.state.zone) && A.state.zone.length ? A.state.zone : null;
    if (zone && typeof A.popInZone === 'function') { try { var r = A.popInZone(zone, pop()); var n = typeof r === 'number' ? r : (r && (r.population != null ? r.population : r.pop)); if (n != null) return { label: 'Зона охвата (фигуры агента)', N: n, note: 'фигуры, нарисованные на карте' }; } catch (e) {} }
    var radii = []; try { radii = (typeof RADII !== 'undefined' ? RADII : []).filter(function (r) { return r.on; }).map(function (r) { return +r.km; }); } catch (e) {}
    var km = radii.length ? Math.max.apply(null, radii) : 1;
    return { label: 'Зона охвата ' + String(km).replace('.', ',') + ' км вокруг точки', N: popInCircle(p.lat, p.lng, km), note: 'круг ' + String(km).replace('.', ',') + ' км вокруг точки анализа; население по калиброванной сетке' };
  }

  /* --- SVG-диаграммы ------------------------------------------------------------------------- */
  function pyramidSvg(age5, conf) {
    if (!age5 || !age5.length) return '<div class="dm-none">Пятилетних групп нет: нужен бюллетень Toshstat (см. «Требуемые входные данные»)</div>';
    var W = 320, rowH = 13, H = age5.length * rowH + 22, mx = Math.max.apply(null, age5.map(function (r) { return Math.max(r.m, r.f); })) || 1, half = 120, mid = W / 2;
    var s = '<svg class="dm-pyr" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Половозрастная пирамида">';
    s += '<text x="' + (mid - 6) + '" y="10" text-anchor="end" font-size="8" fill="#6f6a63" class="dm-lg">мужчины</text><text x="' + (mid + 6) + '" y="10" font-size="8" fill="#6f6a63" class="dm-lg">женщины</text>';
    age5.slice().reverse().forEach(function (r, i) {
      var y = 16 + i * rowH, wm = r.m / mx * half, wf = r.f / mx * half;
      var op = conf === 'modelled' ? ' opacity="0.55"' : '';
      s += '<rect x="' + (mid - 4 - wm) + '" y="' + y + '" width="' + wm + '" height="' + (rowH - 2) + '" fill="#1b4f8a"' + op + ' class="dm-m' + (conf === 'modelled' ? ' dm-mod' : '') + '"><title>' + esc(r.g) + ': мужчины ' + fmt(r.m) + '</title></rect>';
      s += '<rect x="' + (mid + 4) + '" y="' + y + '" width="' + wf + '" height="' + (rowH - 2) + '" fill="#9E0000"' + op + ' class="dm-f' + (conf === 'modelled' ? ' dm-mod' : '') + '"><title>' + esc(r.g) + ': женщины ' + fmt(r.f) + '</title></rect>';
      s += '<text x="' + mid + '" y="' + (y + rowH - 4) + '" text-anchor="middle" font-size="8" fill="#6f6a63" class="dm-ax">' + esc(r.g) + '</text>';
    });
    return s + '</svg>';
  }
  function lineSvg(tr, opts) {
    opts = opts || {};
    if (!tr || !tr.points || !tr.points.length) return '<div class="dm-none">Нет ряда</div>';
    var pts = tr.points.concat(tr.forecast || []), W = 320, H = 96, pad = { l: 8, r: 8, t: 10, b: 16 };
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t, vmax = Math.max.apply(null, pts.map(function (p) { return p.v; })), vmin = Math.min.apply(null, pts.map(function (p) { return p.v; }));
    if (t1 === t0) t1 = t0 + 1; if (vmax === vmin) vmax = vmin + 1;
    var X = function (t) { return pad.l + (t - t0) / (t1 - t0) * (W - pad.l - pad.r); }, Y = function (v) { return pad.t + (1 - (v - vmin) / (vmax - vmin)) * (H - pad.t - pad.b); };
    var fact = tr.points.map(function (p) { return X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ');
    var fc = (tr.forecast && tr.forecast.length ? [tr.points[tr.points.length - 1]].concat(tr.forecast) : []).map(function (p) { return X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ');
    var s = '<svg class="dm-line" viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opts.label || 'Тренд и прогноз') + '">';
    if (tr.forecast && tr.forecast.length) { var xs = X(tr.points[tr.points.length - 1].t); s += '<rect x="' + xs.toFixed(1) + '" y="0" width="' + (W - pad.r - xs).toFixed(1) + '" height="' + H + '" fill="#f5efe6" class="dm-fcbg"/><text x="' + (xs + 4).toFixed(1) + '" y="9" font-size="8" fill="#6f6a63" class="dm-lg">прогноз</text>'; }
    s += '<polyline points="' + fact + '" fill="none" stroke="#9E0000" stroke-width="2" class="dm-fact"/>';
    if (fc) s += '<polyline points="' + fc + '" fill="none" stroke="#9E0000" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.75" class="dm-fc"/>';
    tr.points.forEach(function (p) { s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.4" fill="#9E0000" class="dm-dot"><title>' + Math.floor(p.t) + ': ' + (opts.fmt || fmt)(p.v) + '</title></circle>'; });
    (tr.forecast || []).forEach(function (p) { s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="1.8" fill="#fff" stroke="#9E0000" class="dm-dotf"><title>' + p.t + ' (прогноз): ' + (opts.fmt || fmt)(p.v) + '</title></circle>'; });
    var yrs = [Math.floor(t0), Math.floor((t0 + t1) / 2), Math.floor(t1)];
    yrs.forEach(function (y) { s += '<text x="' + X(y).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" font-size="8" fill="#6f6a63" class="dm-ax">' + y + '</text>'; });
    return s + '</svg>';
  }
  function barsSvg(rows) {
    if (!rows || !rows.length) return '';
    var mx = Math.max.apply(null, rows.map(function (r) { return r.w; })) || 1, s = '<div class="dm-bars">';
    rows.forEach(function (r) { s += '<div class="dm-bar' + (r.rde ? ' rde' : '') + '" title="' + esc(r.name) + '"><span class="dm-bn">' + esc(r.code) + ' ' + esc(r.name) + (r.rde ? ' <i>RDE</i>' : '') + '</span><span class="dm-bt"><b style="width:' + (r.w / mx * 100).toFixed(1) + '%"></b></span><span class="dm-bv">' + pct(r.w, 1) + ' · ' + mln(r.market) + '</span></div>'; });
    return s + '</div>';
  }
  D.svg = { pyramid: pyramidSvg, line: lineSvg, bars: barsSvg };

  /* --- карточка «Демография» ------------------------------------------------------------------- */
  function trendRow(label, tr, f, unit) {
    if (!tr || !tr.points || !tr.points.length) return '<tr><td>' + esc(label) + '</td><td colspan="4" class="dm-mut">нет ряда</td></tr>';
    var last = tr.points[tr.points.length - 1], fc = tr.forecast && tr.forecast.length ? tr.forecast[tr.forecast.length - 1] : null;
    return '<tr><td>' + esc(label) + '</td><td>' + f(tr.points[0].v) + '<div class="dm-mut">' + Math.floor(tr.points[0].t) + '</div></td><td><b>' + f(last.v) + '</b><div class="dm-mut">' + Math.floor(last.t) + '</div></td><td>' + (tr.cagr != null ? (tr.cagr >= 0 ? '+' : '') + pct(tr.cagr, 1) + '/год' : '-') + '</td><td>' + (fc ? f(fc.v) + '<div class="dm-mut">' + fc.t + ' · прогноз</div>' : '<span class="dm-mut">нет</span>') + '</td></tr>';
  }
  /* v4.78.0: факты Toshstat по району (пакеты владельца) и реестр по махалле */
  function lastOf(o) { if (!o) return null; var ks = Object.keys(o).filter(function (k) { return /^\d{4}/.test(k); }).sort(); if (!ks.length) return null; var k = ks[ks.length - 1]; return { k: k, v: o[k], prev: ks.length > 1 ? { k: ks[ks.length - 2], v: o[ks[ks.length - 2]] } : null, unit: o.unit, source: o.source }; }
  function period(k) { return String(k).replace(/(\d{4})-(\d{2})-(\d{2})\/(\d{4})-(\d{2})-(\d{2})/, '$3.$2.$1-$6.$5.$4').replace(/(\d{4})-(\d{2})-(\d{2})/, '$3.$2.$1'); }
  function districtFacts(dk) {
    var dr = D.data && D.data.districts && D.data.districts.rows && D.data.districts.rows[dk]; if (!dr) return '';
    var items = [];
    var sal = lastOf(dr.salary_month_thousand_uzs); if (sal) items.push(kpi('Средняя зарплата', fmt(sal.v * 1000) + ' сум/мес', period(sal.k) + (sal.prev && sal.prev.v ? ' · ' + (sal.v / sal.prev.v - 1 >= 0 ? '+' : '') + pct(sal.v / sal.prev.v - 1, 1) + ' к ' + period(sal.prev.k) : '')));
    var rt = lastOf(dr.retail_turnover_bn_uzs); if (rt) items.push(kpi('Оборот розницы', (rt.v / 1000).toFixed(1).replace('.', ',') + ' трлн сум', period(rt.k)));
    var en = lastOf(dr.enterprises), sb = lastOf(dr.small_business); if (en) items.push(kpi('Предприятий', fmt(en.v), period(en.k) + (sb ? ' · малый бизнес ' + fmt(sb.v) : '')));
    var mg = lastOf(dr.migration_net); if (mg) items.push(kpi('Миграция, сальдо', (mg.v >= 0 ? '+' : '') + fmt(mg.v), period(mg.k)));
    if (dr.area_km2_geodesic) items.push(kpi('Площадь', String(dr.area_km2_geodesic).replace('.', ',') + ' км²', 'геодезическая по официальной границе' + (dr.density_2026_01_01 ? ' · ' + fmt(dr.density_2026_01_01) + ' чел./км² (01.01.2026)' : '')));
    if (dr.mahallas_official) items.push(kpi('Махаллей', fmt(dr.mahallas_official), 'реестр Etirof' + (dr.mahallas_with_polygon ? ' · с официальной границей ' + dr.mahallas_with_polygon : '')));
    var hp = lastOf(dr.hospitals), pl = lastOf(dr.polyclinics), ps = lastOf(dr.preschools); if (hp || pl || ps) items.push(kpi('Соцобъекты', (hp ? hp.v + ' больниц' : '') + (pl ? (hp ? ' · ' : '') + pl.v + ' поликлиник' : ''), ps ? ps.v + ' детсадов (' + period(ps.k) + ')' : (hp ? period(hp.k) : '')));
    if (!items.length) return '';
    return '<h4>Район: факты Toshstat</h4><div class="dm-kpi dm-facts">' + items.join('') + '</div><div class="dm-mut">Toshstat: зарплата за полугодие, оборот розницы январь-июль 2026, реестр предприятий 01.08.2026, миграция за полугодие; SOATO ' + esc(dr.soato || '') +  + (dr.former_names ? '; прежние названия: ' + esc(dr.former_names) : '') + '.</div>';
  }
  function mahallaFacts(r) {
    if (!r) return ''; var g = r.reg, items = [];
    if (g) items.push(kpi('Реестр Etirof', esc(g.name), (g.code ? 'код ' + g.code : '') + (g.name_cyr ? ' · ' + g.name_cyr : '')));
    if (r.area_ha != null) items.push(kpi('Площадь', Math.round(r.area_ha) + ' га', (g && g.area_ha != null ? 'геодезическая по официальному полигону' : 'слой хокимията 2024') + (r.density != null ? ' · ' + fmt(r.density) + ' чел./км²' : '')));
    if (r.poly) items.push(kpi('Граница', r.poly.manual ? 'вручную' : r.poly.approx ? 'расчётная' : 'официальная', r.poly.manual ? 'введена с карты' : r.poly.approx ? 'по соседним точкам, не официальная' : r.poly.origin === 'hokimiyat' ? 'слой хокимията (Open Data Tashkent)' : 'слой махаллей, open.ngis.uz'));
    if (!items.length) return '';
    return '<h4>Махалля: реестр и границы</h4><div class="dm-kpi dm-facts">' + items.join('') + '</div>' + (r.regOnly ? '<div class="dm-mut">Этой махалли нет в мастер-базе: строка из реестра Etirof с центроидом официального полигона.</div>' : '');
  }
  function demoHtml(scope, opts) {
    opts = opts || {};
    var c = city();
    if (!c) return '<div class="dm-none">Файл данных демографии не загружен: data/demography_tashkent.json</div>';
    var st = structure(scope.N), sr = seriesFor(scope.N, scope.series);
    if (!st) return '<div class="dm-none">Нет населения для охвата «' + esc(scope.label) + '»</div>';
    var h = '<div class="dm-head"><div class="dm-scope">' + esc(scope.label) + '</div><div class="dm-mut">' + esc(scope.note || '') + '</div></div>';
    if (scope.id === 'city' && c.market && c.market.offices) h += '<div class="dm-market">Рынок города: офисы <b>' + fmt(c.market.offices.gla_m2) + ' м² GLA</b>, вакантность <b>' + pct(c.market.offices.vacancy, 0) + '</b>; торговые центры: ' + (c.market.malls ? c.market.malls.count + ' объектов, ' + fmt(c.market.malls.gla_m2) + ' м² GLA, вакантность ' + pct(c.market.malls.vacancy, 0) : '') + ' <span class="dm-mut">(' + esc(c.market.source) + ')</span></div>';
    h += '<div class="dm-kpi">'
      + kpi('Население', fmt(st.N), scope.conf === 'modelled' ? 'оценка' : 'факт')
      + kpi('Домохозяйств', st.households != null ? fmt(st.households) : '-', st.hhSize ? 'по ' + String(st.hhSize).replace('.', ',') + ' чел.' : 'нет размера')
      + kpi('Женщины', st.female != null ? fmt(st.female) : '-', st.femShare != null ? pct(st.femShare, 1) : '')
      + kpi('Мужчины', st.male != null ? fmt(st.male) : '-', st.femShare != null ? pct(1 - st.femShare, 1) : '')
      + kpi('Доход на душу', st.income ? mln(st.income.uzs) + ' сум/год' : '-', st.income ? (st.income.usd ? '≈ $' + fmt(st.income.usd) + ' · ' + st.income.year : st.income.year) : 'нет данных')
      + kpi('Совокупный доход', st.income ? mln(st.income.total) + ' сум/год' : '-', 'население × доход на душу')
      + '</div>';
    if (scope.id && scope.id.slice(0, 2) === 'd:') h += districtFacts(scope.id.slice(2));
    if (scope.row) h += mahallaFacts(scope.row);
    h += '<h4>Возраст и пол</h4>';
    if (st.age3) h += '<div class="dm-age3"><span>моложе трудоспособного <b>' + pct(st.age3.underShare, 1) + '</b> · ' + fmt(st.age3.under) + '</span><span>трудоспособный <b>' + pct(st.age3.workShare, 1) + '</b> · ' + fmt(st.age3.work) + '</span><span>старше трудоспособного <b>' + pct(st.age3.overShare, 1) + '</b> · ' + fmt(st.age3.over) + '</span></div>';
    h += pyramidSvg(st.age5, st.age5conf);
    if (st.age5 && st.age5conf === 'modelled') h += '<div class="dm-mut">Пирамида в полутоне: пятилетние группы построены допущением, факт только для трёх групп.</div>';
    h += '<h4>Расходы и объём рынка</h4>';
    if (st.rde) h += '<div class="dm-kpi">'
      + kpi('Потребительские расходы', st.consumerTotal != null ? mln(st.consumerTotal) + ' сум/год' : '-', st.consumerPc != null ? mln(st.consumerPc) + ' сум на душу' : '')
      + kpi('RDE (ритейл, F&B, досуг)', mln(st.rde.total) + ' сум/год', '$' + fmt(st.rde.usdPc) + ' на душу · ' + pct(st.rde.share, 0) + ' расходов')
      + '</div>';
    if (st.kipc.length) h += '<div class="dm-mut">Структура расходов по разделам КИПЦ, ' + esc(st.kipcYear) + '; справа доля и объём рынка в охвате за год. Разделы RDE входят в ёмкость торговых форматов.</div>' + barsSvg(st.kipc);
    if (scope.share != null) h += '<div class="dm-share">Рыночная доля проекта: <b>' + pct(scope.share, 2) + '</b> RDE зоны · ' + mln(st.rde ? st.rde.total * scope.share : null) + ' сум/год <span class="dm-mut">(capture rate по методике CASE; в модели Хаффа доля считается с учётом конкурентов)</span></div>';
    h += '<h4>Тренд и прогноз на ' + FORECAST_YEARS + ' лет</h4>';
    if (sr) {
      h += '<table class="dm-tr"><thead><tr><th>Показатель</th><th>Начало ряда</th><th>Последний факт</th><th>Темп</th><th>Прогноз</th></tr></thead><tbody>'
        + trendRow('Население', sr.pop, fmt) + trendRow('Домохозяйства', sr.households, fmt) + trendRow('Доход на душу, сум/год', sr.income, mln)
        + trendRow('Потребительские расходы, сум/год (расчёт)', sr.spending, mln) + trendRow('RDE: ритейл, F&B, досуг, сум/год (расчёт)', sr.rde, mln) + '</tbody></table>';
      if (!opts.compact) h += '<div class="dm-two dm-three"><div>' + lineSvg(sr.pop, { label: 'Население' }) + '<div class="dm-cap">Население</div></div><div>' + lineSvg(sr.income, { label: 'Доход на душу', fmt: mln }) + '<div class="dm-cap">Доход на душу</div></div><div>' + lineSvg(sr.rde, { label: 'RDE', fmt: mln }) + '<div class="dm-cap">RDE (объём рынка)</div></div></div>';
      h += '<div class="dm-mut">Метод: среднегодовой темп по всему ряду фактов, продлённый на ' + FORECAST_YEARS + ' лет (CAGR). ' + (sr.own ? 'Ряд населения: факты Toshstat по району (2022-2026); для махалли масштабирован по её доле в районе.' : 'Население охвата масштабировано от городского ряда: доля охвата в городе принята постоянной.') + ' Расходы и RDE: население × расходы на душу с темпом дохода на душу; в столбце «начало ряда» это расчёт назад, не факт. Это прогноз, не факт.</div>';
    }
    if (st.assumptions.length) h += '<h4>Допущения</h4><ul class="dm-as">' + st.assumptions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
    if (opts.compact) { h += '<div class="dm-mut">Источники: stat.uz, Toshkent shahar statistika boshqarmasi, библиотека методики CASE; требуемые входные данные и полный список источников в карточке «Демография и рынок» (раздел «Махалли и демография»).</div>'; return h; }
    var need = (D.data.inputs_needed || []);
    if (need.length) h += '<h4>Требуемые входные данные</h4><ul class="dm-as">' + need.map(function (n) { return '<li><b>' + esc(n.what) + '</b> · ' + esc(n.owner) + ' · ' + esc(n.where) + '</li>'; }).join('') + '</ul>';
    var srcs = []; [c.sex, c.age3, c.income, c.household, c.spending].forEach(function (b) { if (b && (b.source || b.working_source)) srcs.push(b.source || b.working_source); });
    var cp = cityPop(); if (cp) srcs.unshift(cp.source + ' (' + cp.date + ')');
    h += '<h4>Источники</h4><ul class="dm-as dm-src">' + srcs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  /* v4.78.0: охват «круг вокруг точки» для отчёта по точке, вкладки «Аналитика» и выгрузок */
  function scopeAt(lat, lng, km, label) {
    var k = +km || 1;
    return { id: 'pt', label: label || ('Зона ' + String(k).replace('.', ',') + ' км вокруг точки'), N: popInCircle(+lat, +lng, k), note: 'круг ' + String(k).replace('.', ',') + ' км вокруг точки анализа; население по калиброванной сетке; capture rate ' + pct(CAPTURE, 3) + ' по методике CASE', conf: 'modelled', share: CAPTURE };
  }
  /* строки для Excel (показатель, значение, примечание) и короткая таблица для слайда */
  function exportRows(lat, lng, radiusM) {
    if (!D.data) return null;
    var km = (+radiusM || 1000) / 1000, sc = scopeAt(lat, lng, km), st = structure(sc.N), sr = seriesFor(sc.N); if (!st) return null;
    var rows = [['Показатель', 'Значение', 'Примечание']], slide = [['Показатель', 'Значение']];
    var R = function (a, b, c, s) { rows.push([a, b, c || '']); if (s) slide.push([a, typeof b === 'number' ? Math.round(b).toLocaleString('ru') : String(b)]); };
    R('Охват', sc.label, sc.note);
    var ma = mahallaAt(lat, lng); if (ma) R('Махалля точки', ma.name + (ma.district ? ' (' + distRu(ma.district) + ')' : ''), mahallaLine(ma).replace(/^Махалля точки: /, ''), true);
    R('Население', Math.round(st.N), 'оценка по сетке населения', true);
    if (st.households != null) R('Домохозяйств', Math.round(st.households), 'по ' + st.hhSize + ' чел.', true);
    if (st.female != null) { R('Женщины', Math.round(st.female), pct(st.femShare, 1), true); R('Мужчины', Math.round(st.male), pct(1 - st.femShare, 1)); }
    if (st.age3) { R('Моложе трудоспособного (0-15)', Math.round(st.age3.under), pct(st.age3.underShare, 1), true); R('Трудоспособный возраст', Math.round(st.age3.work), pct(st.age3.workShare, 1), true); R('Старше трудоспособного', Math.round(st.age3.over), pct(st.age3.overShare, 1), true); }
    (st.age5 || []).forEach(function (r) { R('Возраст ' + r.g + ': мужчины', Math.round(r.m), st.age5conf === 'modelled' ? 'допущение: равномерно внутри трёх групп' : 'факт'); R('Возраст ' + r.g + ': женщины', Math.round(r.f), st.age5conf === 'modelled' ? 'допущение' : 'факт'); });
    if (st.income) { R('Доход на душу, сум/год', Math.round(st.income.uzs), st.income.year + (st.income.usd ? ' · ≈ $' + Math.round(st.income.usd) : ''), true); R('Совокупный доход, сум/год', Math.round(st.income.total), 'население × доход на душу', true); }
    if (st.consumerTotal != null) R('Потребительские расходы, сум/год', Math.round(st.consumerTotal), 'RDE / ' + pct(st.rde.share, 0), true);
    if (st.rde) { R('RDE (ритейл, F&B, досуг), сум/год', Math.round(st.rde.total), '$' + Math.round(st.rde.usdPc) + ' на душу', true); R('Доля рынка проекта (capture rate)', pct(sc.share, 3), 'RDE × ' + pct(sc.share, 3) + ' = ' + Math.round(st.rde.total * sc.share).toLocaleString('ru') + ' сум/год', true); }
    st.kipc.forEach(function (k) { R('КИПЦ ' + k.code + ' ' + k.name, Math.round(k.market), pct(k.w, 2) + (k.rde ? ' · RDE' : '')); });
    if (sr) {
      var fc = function (tr) { return tr && tr.forecast && tr.forecast.length ? tr.forecast[tr.forecast.length - 1] : null; };
      var pf = fc(sr.pop), inf = fc(sr.income), rf = fc(sr.rde);
      if (pf) R('Население, прогноз ' + pf.t, Math.round(pf.v), 'CAGR ' + pct(sr.pop.cagr, 1) + ' в год', true);
      if (inf) R('Доход на душу, прогноз ' + inf.t, Math.round(inf.v), 'CAGR ' + pct(sr.income.cagr, 1) + ' в год', true);
      if (rf) R('RDE, прогноз ' + rf.t, Math.round(rf.v), 'население × расходы на душу с темпом дохода', true);
    }
    st.assumptions.forEach(function (a) { rows.push(['Допущение', a, '']); });
    return { label: sc.label, rows: rows, slide: slide.slice(0, 14), note: 'Оценки по калиброванной сетке населения и открытой статистике (stat.uz, Toshstat, библиотека CASE). Пятилетние группы и структура расходов построены по допущениям, перечисленным в листе «Демография и рынок». Прогноз: CAGR по ряду фактов. Это ориентир, не факт.' };
  }
  /* отчёт по точке (probeAt студии): раздел «Демография и рынок» в конце отчёта и в его PDF-версии */
  function injectProbe(la, ln) {
    var body = document.querySelector('#probe .body'); if (!body || !D.data) return;
    var rad = 1000; try { if (typeof LASTPROBE !== 'undefined' && LASTPROBE && Array.isArray(LASTPROBE.radii) && LASTPROBE.radii.length) rad = Math.max.apply(null, LASTPROBE.radii.map(Number)); } catch (e) {}
    var sc = scopeAt(la, ln, rad / 1000);
    var html = '<h3 style="margin:16px 0 8px">L. Демография и рынок: зона ' + (rad >= 1000 ? String(rad / 1000).replace('.', ',') + ' км' : rad + ' м') + '</h3><div class="dm-probe"><div class="dm-mah">' + esc(mahallaLine(mahallaAt(la, ln))) + '</div>' + demoHtml(sc, { compact: true }) + '</div>';
    var old = body.querySelector('.dm-probe-wrap'); if (old) old.remove();
    var d = document.createElement('div'); d.className = 'dm-probe-wrap'; d.innerHTML = html; body.appendChild(d);
    try { if (typeof LASTPROBE !== 'undefined' && LASTPROBE) LASTPROBE.html = String(LASTPROBE.html || '') + html; } catch (e) {}
  }
  function hookProbe() {
    var pa = window.probeAt; if (typeof pa !== 'function' || pa._dm) return;
    var w = function (la, ln) { var r = pa.apply(this, arguments); return Promise.resolve(r).then(function (v) { try { injectProbe(+la, +ln); } catch (e) {} return v; }); };
    w._dm = true; window.probeAt = w;
  }
  /* вкладка «Аналитика»: раздел I с городом и районом точки анализа */
  function injectAnalytics() {
    var box = $('anaT'); if (!box || !D.data || !box.innerHTML) return;
    var old = box.querySelector('.dm-ana'); if (old) old.remove();
    var cp = cityPop(); if (!cp) return;
    var h = '<div class="dm-ana"><h3 style="margin:16px 0 8px">I. Демография и рынок</h3>' + demoHtml({ id: 'city', label: 'Город Ташкент', N: cp.value, note: 'факт ' + cp.date + ', ' + cp.source, conf: 'verified' }, { compact: true });
    var p = point(); var z = p && p.district ? zones().filter(function (x) { return x.key === p.district; })[0] : null;
    if (z) h += '<h3 style="margin:16px 0 8px">I2. Район точки анализа: ' + esc(distRu(z.key)) + '</h3>' + demoHtml({ id: 'd:' + z.key, label: distRu(z.key) + ' район', N: z.pop, note: 'официальное население района, площадь ' + String(z.area).replace('.', ',') + ' км²', conf: 'verified', series: distSeries(z.key) }, { compact: true });
    h += '</div>';
    var d = document.createElement('div'); d.innerHTML = h; box.appendChild(d.firstChild);
  }
  function hookAnalytics() {
    var an = window.analytics; if (typeof an !== 'function' || an._dm) return;
    var w = function () { var r = an.apply(this, arguments); try { injectAnalytics(); } catch (e) {} return r; };
    w._dm = true; window.analytics = w;
    try { injectAnalytics(); } catch (e) {}
  }
  function kpi(l, v, s) { return '<div class="dm-k"><div class="dm-kl">' + esc(l) + '</div><div class="dm-kv">' + v + '</div><div class="dm-ks">' + esc(s || '') + '</div></div>'; }

  function distSeries(dk) { var dr = D.data && D.data.districts && D.data.districts.rows && D.data.districts.rows[dk]; return dr && Array.isArray(dr.population_series) ? dr.population_series : null; }
  function scopes() {
    var out = [], cp = cityPop();
    if (cp) out.push({ id: 'city', label: 'Город Ташкент', N: cp.value, note: 'факт ' + cp.date + ', ' + cp.source, conf: 'verified' });
    zones().forEach(function (z) { out.push({ id: 'd:' + z.key, label: distRu(z.key) + ' район', N: z.pop, note: 'официальное население района (Toshstat, 01.07.2026), площадь ' + String(z.area).replace('.', ',') + ' км²', conf: 'verified', series: distSeries(z.key) }); });
    if (curMah) { var e = estimateDistrict(curMah.district).rows.filter(function (r) { return r.key === curMah.key; })[0]; if (e && e.pop != null) out.push({ id: 'm:' + e.key, label: 'Махалля ' + e.name + ' (' + distRu(curMah.district) + ')', N: e.pop, note: e.src + (e.area_ha != null ? ' · ' + Math.round(e.area_ha) + ' га' : '') + (e.density != null ? ' · ' + fmt(e.density) + ' чел./км²' : ''), conf: e.conf, series: distSeries(curMah.district), row: e }); }
    /* capture rate 0,394%: отправная точка из отчётов CASE (библиотека методики), пересчитывается под проект в модели Хаффа */
    var sc = scopeCatchment(); if (sc) { sc.id = 'catch'; sc.conf = 'modelled'; sc.share = 0.00394; out.push(sc); }
    return out;
  }
  function openDemo(id) {
    var list = scopes(); if (!list.length) { toast('Данные демографии ещё не загружены'); return; }
    var sc = list.filter(function (s) { return s.id === id; })[0] || list[list.length - 1];
    var card = $('card'), bg = $('cardbg'); if (!card) return;
    card.innerHTML = '<div class="dm-top"><h2>Демография и рынок</h2><select id="dmScope" aria-label="Охват">' + list.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === sc.id ? ' selected' : '') + '>' + esc(s.label) + '</option>'; }).join('') + '</select><span class="sp"></span><button class="btn sec" id="dmCsv" type="button">⤓ CSV</button><button class="btn" id="dmX" type="button" aria-label="Закрыть">✕</button></div><div class="dm-body" id="dmBody">' + demoHtml(sc) + '</div>';
    card.classList.add('open'); card.classList.add('dm-open'); if (bg) bg.classList.add('open');
    $('dmScope').onchange = function () { var s2 = list.filter(function (s) { return s.id === $('dmScope').value; })[0]; if (s2) $('dmBody').innerHTML = demoHtml(s2); };
    $('dmX').onclick = function () { try { closeCard(); } catch (e) { card.classList.remove('open'); if (bg) bg.classList.remove('open'); } card.classList.remove('dm-open'); };
    $('dmCsv').onclick = function () { var s2 = list.filter(function (s) { return s.id === $('dmScope').value; })[0] || sc; exportCsv(s2); };
    D.lastScope = sc.id;
  }
  D.open = openDemo; D.scopes = scopes; D.html = function (scope, opts) { return demoHtml(scope, opts || {}); }; D.scopeAt = scopeAt; D.exportRows = exportRows;
  function exportCsv(sc) {
    if (document.body.classList.contains('geo-no-export')) { toast('Выгрузка недоступна для вашего доступа'); return; }
    var st = structure(sc.N), sr = seriesFor(sc.N); if (!st) return;
    var rows = [['показатель', 'значение', 'примечание']];
    rows.push(['охват', sc.label, sc.note || '']); rows.push(['население', Math.round(st.N), sc.conf]);
    if (st.female != null) { rows.push(['женщины', Math.round(st.female), pct(st.femShare, 1)]); rows.push(['мужчины', Math.round(st.male), '']); }
    if (st.households != null) rows.push(['домохозяйства', Math.round(st.households), 'размер ' + st.hhSize]);
    if (st.age3) { rows.push(['моложе трудоспособного', Math.round(st.age3.under), pct(st.age3.underShare, 1)]); rows.push(['трудоспособный', Math.round(st.age3.work), pct(st.age3.workShare, 1)]); rows.push(['старше трудоспособного', Math.round(st.age3.over), pct(st.age3.overShare, 1)]); }
    (st.age5 || []).forEach(function (r) { rows.push(['возраст ' + r.g + ' мужчины', Math.round(r.m), st.age5conf]); rows.push(['возраст ' + r.g + ' женщины', Math.round(r.f), st.age5conf]); });
    if (st.income) rows.push(['доход на душу, сум/год', Math.round(st.income.uzs), st.income.year]);
    if (st.rde) rows.push(['RDE, сум/год', Math.round(st.rde.total), 'на душу ' + Math.round(st.rde.pc)]);
    st.kipc.forEach(function (r) { rows.push(['КИПЦ ' + r.code + ' ' + r.name, Math.round(r.market), pct(r.w, 2)]); });
    if (sr && sr.pop) { sr.pop.points.forEach(function (p) { rows.push(['население ' + Math.floor(p.t), Math.round(p.v), 'факт']); }); sr.pop.forecast.forEach(function (p) { rows.push(['население ' + p.t, Math.round(p.v), 'прогноз']); }); }
    if (sr && sr.rde) { sr.rde.points.forEach(function (p) { rows.push(['RDE ' + Math.floor(p.t), Math.round(p.v), 'расчёт']); }); sr.rde.forecast.forEach(function (p) { rows.push(['RDE ' + p.t, Math.round(p.v), 'прогноз']); }); }
    st.assumptions.forEach(function (a) { rows.push(['допущение', a, '']); });
    var csv = '﻿' + rows.map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'CASE_demography_' + sc.id.replace(/[^a-z0-9]/gi, '_') + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* --- раздел «Махалли и демография» в левой панели ------------------------------------------- */
  function css() {
    if ($('geoMahCss')) return;
    var s = document.createElement('style'); s.id = 'geoMahCss'; s.textContent =
      '#mahSect .sbody{padding:6px 12px 12px}#mahDist{width:100%;font-size:12px;padding:6px 8px;border-radius:8px;border:1px solid var(--line,#e3dcd1);background:#fff}'
      + '.mah-sum{font-size:11px;color:var(--muted,#6f6a63);margin:6px 0 4px;line-height:1.45}.mah-sum b{color:var(--ink,#1b1b1b)}'
      + '.mah-btns{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0 6px}.mah-btns .btn{font-size:11px}'
      + '.mah-list{max-height:260px;overflow:auto;border:1px solid var(--line,#e3dcd1);border-radius:8px;background:#fff}'
      + '.mah-row{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:5px 8px;border-bottom:1px solid #f0ece6;font-size:11.5px;cursor:pointer}.mah-row:hover{background:#faf7f2}.mah-row.sel{background:#fbeaea}'
      + '.mah-row .n{font-weight:600;color:var(--ink,#1b1b1b)}.mah-row .p{text-align:right;font-variant-numeric:tabular-nums}.mah-row .p i{font-style:normal;color:var(--muted,#6f6a63);font-size:10px;margin-left:3px}.mah-row .p.man{color:#14675B}'
      + '.mah-row .s{grid-column:1/3;font-size:10px;color:var(--muted,#6f6a63)}'
      + '.mah-edit{display:flex;gap:4px;align-items:center;margin-top:6px;font-size:11px}.mah-edit input{width:90px;font-size:11px;padding:4px 6px;border:1px solid var(--line,#e3dcd1);border-radius:6px}'
      + '.mah-sort{display:flex;gap:6px;font-size:10.5px;color:var(--muted,#6f6a63);margin:4px 0}.mah-sort button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0;text-decoration:underline dotted}.mah-sort button.on{color:#9E0000;font-weight:700}'
      + '.mah-lbl{background:#fff;border:1px solid #9E0000;color:#5a4420;border-radius:6px;padding:2px 6px;font:600 10.5px/1.3 inherit;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.25)}.mah-lbl b{color:#9E0000}'
      + '.mah-off{font-style:normal;font-weight:400;color:var(--muted,#6f6a63);font-size:10px}.mah-tag{font-style:normal;font-weight:600;font-size:9px;background:#f1ede6;color:#5a4420;border-radius:4px;padding:0 4px;margin-left:3px}.mah-row.reg .n{color:#5a4420}.mah-miss{margin-top:4px;font-size:10.5px}.mah-miss summary{cursor:pointer;color:#9E0000}.dm-mah{font-size:11px;background:#faf7f2;border-radius:8px;padding:5px 9px;margin:4px 0 6px}.dm-facts .dm-kv{font-size:13px}'
      /* карточка демографии */
      + '#card.dm-open{width:min(760px,96vw);max-width:96vw;padding:12px 16px;box-sizing:border-box}.dm-top{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}.dm-top h2{font-size:16px;margin:0}.dm-top .sp{flex:1}.dm-top select{font-size:12px;padding:5px 8px;border-radius:8px;border:1px solid var(--line,#e3dcd1);max-width:340px}'
      + '.dm-body{flex:1;min-height:0;overflow:auto;font-size:12px}.dm-body h4{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--slate,#4a5568);margin:14px 0 6px;border-top:1px solid var(--line,#e3dcd1);padding-top:8px}'
      + '.dm-head .dm-scope{font-weight:800;font-size:13px}.dm-mut{color:var(--muted,#6f6a63);font-size:10.5px;line-height:1.45}.dm-none{color:var(--muted,#6f6a63);font-size:11.5px;padding:8px 0}'
      + '.dm-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0}.dm-k{background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:9px;padding:7px 9px;min-width:0}.dm-kl{font-size:10px;color:var(--muted,#6f6a63);text-transform:uppercase;letter-spacing:.04em}.dm-kv{font-size:15px;font-weight:800;margin:2px 0}.dm-ks{font-size:10px;color:var(--muted,#6f6a63)}'
      + '.dm-age3{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin:4px 0 6px}.dm-age3 span{background:#faf7f2;border-radius:6px;padding:3px 7px}'
      + '.dm-pyr .dm-m{fill:#1b4f8a}.dm-pyr .dm-f{fill:#9E0000}.dm-pyr .dm-mod{opacity:.55}.dm-pyr .dm-ax{font-size:8px;fill:#6f6a63}.dm-lg{font-size:8px;fill:#6f6a63}'
      + '.dm-line .dm-fact{fill:none;stroke:#9E0000;stroke-width:2}.dm-line .dm-fc{fill:none;stroke:#9E0000;stroke-width:1.5;stroke-dasharray:4 3;opacity:.75}.dm-line .dm-dot{fill:#9E0000}.dm-line .dm-dotf{fill:#fff;stroke:#9E0000}.dm-line .dm-fcbg{fill:#f5efe6}.dm-line .dm-ax{font-size:8px;fill:#6f6a63}'
      + '.dm-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.dm-three{grid-template-columns:1fr 1fr 1fr}.dm-cap{font-size:10px;color:var(--muted,#6f6a63);text-align:center}.dm-market{font-size:11.5px;background:#faf7f2;border-radius:8px;padding:6px 9px;margin:6px 0}.dm-probe .dm-kpi{grid-template-columns:repeat(3,minmax(0,1fr))}.dm-ana .dm-kpi{grid-template-columns:repeat(3,minmax(0,1fr))}'
      + '.dm-tr{width:100%;border-collapse:collapse;font-size:11px}.dm-tr th,.dm-tr td{border-bottom:1px solid #eee;padding:4px 6px;text-align:left;vertical-align:top}.dm-tr th{font-size:10px;color:var(--muted,#6f6a63);font-weight:600}'
      + '.dm-bars{display:grid;gap:3px;margin:6px 0}.dm-bar{display:grid;grid-template-columns:200px 1fr 130px;gap:6px;align-items:center;font-size:10.5px}.dm-bar .dm-bn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-bar .dm-bn i{font-style:normal;background:#9E0000;color:#fff;border-radius:4px;padding:0 4px;font-size:9px}.dm-bar .dm-bt{background:#f1ede6;border-radius:4px;height:9px;overflow:hidden}.dm-bar .dm-bt b{display:block;height:100%;background:#b9b2a8}.dm-bar.rde .dm-bt b{background:#9E0000}.dm-bar .dm-bv{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
      + '.dm-share{margin:6px 0;font-size:11.5px;background:#fbeaea;border-radius:8px;padding:6px 9px}.dm-as{margin:4px 0;padding-left:18px;font-size:11px;line-height:1.45}.dm-src{color:var(--muted,#6f6a63)}'
      + '.mah-col{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:5px 0 2px;font-size:10.5px;color:var(--muted,#6f6a63)}.mah-col label{display:inline-flex;align-items:center;gap:3px}.mah-col input[type=color]{width:26px;height:18px;padding:0;border:1px solid var(--line,#e3dcd1);border-radius:4px;background:none}.mah-col button{border:1px solid var(--line,#e3dcd1);background:#fff;border-radius:6px;font:600 10px inherit;padding:1px 6px;cursor:pointer}'
      + '.mah-list.mah-hint{outline:2px solid #9E0000;outline-offset:2px;border-radius:6px}'
      + '@media(max-width:620px){.dm-kpi{grid-template-columns:1fr 1fr}.dm-two{grid-template-columns:1fr}.dm-bar{grid-template-columns:1fr}.dm-bar .dm-bv{text-align:left}}';
    document.head.appendChild(s);
  }
  function anchorSect() { var hs = document.querySelectorAll('.left>.sect>h3'); for (var i = 0; i < hs.length; i++) if (/слои и стиль/i.test(hs[i].textContent)) return hs[i].parentNode; return null; }
  function mount() {
    if ($('mahSect')) return true;
    var anchor = anchorSect(); if (!anchor) return false;
    var sect = document.createElement('div'); sect.className = 'sect'; sect.id = 'mahSect';
    sect.innerHTML = '<h3 id="mahH">Махалли и демография</h3><div class="sbody">'
      + '<div class="mah-btns"><button type="button" class="btn pri" id="mahDemoBtn" title="население, пол, возраст, доходы, расходы, тренд и прогноз для города, района, махалли или зоны охвата">◔ Демография и рынок</button><button type="button" class="btn sec" id="mahDemoCatch" title="структура населения в зоне охвата точки анализа">по зоне охвата</button></div>'
      + '<label class="mah-sum" for="mahDist">Район и его махалли</label><select id="mahDist" aria-label="Район"><option value="">выберите район</option></select>'
      + '<div class="mah-sum" id="mahSum"></div>'
      + '<div class="mah-sort" id="mahSort"><span>порядок:</span><button type="button" data-s="pop" class="on">по населению</button><button type="button" data-s="name">по имени</button><button type="button" data-s="dist">по расстоянию до точки</button></div>'
      + '<div class="mah-list" id="mahList"></div>'
      + '<div class="mah-edit" id="mahEdit" hidden><span id="mahEditName"></span><input type="number" id="mahPop" min="0" step="100" placeholder="население"><button type="button" class="btn sec" id="mahPopSave" style="font-size:11px">✓</button><button type="button" class="btn sec" id="mahPopClear" style="font-size:11px" title="убрать ручное значение">↺</button></div>'
      + '<div class="mah-edit" id="mahBnd" hidden><span>Граница:</span><button type="button" class="btn sec" id="mahBndSet" style="font-size:11px" title="взять последний полигон, нарисованный инструментом O или F внизу карты, как границу этой махалли; население пересчитается внутри границы">▱ из полигона на карте</button><button type="button" class="btn sec" id="mahBndClear" style="font-size:11px" title="убрать границу махалли">✕</button><span class="mini" id="mahBndInfo"></span></div>'
      + '<label class="ck" style="margin-top:6px"><input type="checkbox" id="mahShow" checked title="границы и кружки всех махаллей выбранного района или всего города; клик по махалле открывает её карточку"> Все махалли на карте</label>'
      + '<label class="ck"><input type="checkbox" id="mahSelShow" checked title="граница и подпись выбранной махалли"> Выбранная махалля на карте</label>'
      + '<div class="mah-col"><span>цвет границ:</span><label><input type="color" id="mahColSel" title="цвет выбранной махалли"> выбранная</label><label><input type="color" id="mahColAll" title="цвет остальных границ"> остальные</label><button type="button" id="mahColReset" title="вернуть цвета по умолчанию">↺</button></div>'
      + '<div class="mini" id="mahSrc" title="Реестр Etirof: 585 махаллей с кодами. Официальные границы 402 из них из слоя махаллей НГИС (open.ngis.uz), население внутри границы по сетке. У остальных граница расчётная (пунктир по соседним точкам), население по сетке в пределах официального населения района. Введённое вручную число имеет приоритет и помечено зелёным. Населения по махаллям в открытых источниках нет.">Источники: Etirof, НГИС, хокимият · наведите для пояснения</div>'
      + '</div>';
    anchor.parentNode.insertBefore(sect, anchor);
    var h3 = sect.querySelector('h3'); h3.style.cursor = 'pointer';
    h3.addEventListener('click', function () { var closed = sect.classList.toggle('closed'); try { localStorage.setItem(KEY_SECT, closed ? '0' : '1'); } catch (e) {} });
    try { if (localStorage.getItem(KEY_SECT) === '0') sect.classList.add('closed'); } catch (e) {}
    $('mahDemoBtn').onclick = function () { openDemo(curMah ? 'm:' + curMah.key : (curDist && curDist !== ALL) ? 'd:' + curDist : 'city'); };
    $('mahDemoCatch').onclick = function () { if (!point()) { toast('Сначала поставьте точку анализа (пин на панели инструментов)'); return; } openDemo('catch'); };
    $('mahDist').onchange = function () { curDist = $('mahDist').value; curMah = null; $('mahEdit').hidden = true; $('mahBnd').hidden = true; renderList(); drawMah(); fitCity(); };
    $('mahSort').querySelectorAll('button').forEach(function (b) { b.onclick = function () { sortBy = b.dataset.s; $('mahSort').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderList(); }; });
    try { var sv = JSON.parse(localStorage.getItem(KEY_SHOW) || 'null'); if (sv && typeof sv === 'object') { if (sv.all === false) $('mahShow').checked = false; if (sv.sel === false) $('mahSelShow').checked = false; } } catch (e) {}
    $('mahShow').onchange = function () { saveShow(); drawMah(); };
    /* галочка выбранной махалли: если махалля не выбрана, показываем это словами, а не молчим */
    $('mahSelShow').onchange = function () { saveShow(); drawMah(); if (this.checked && !curMah) { toast('Выберите махаллю в списке или кликните по ней на карте: тогда её граница и подпись появятся'); try { $('mahList').classList.add('mah-hint'); setTimeout(function () { var l = $('mahList'); if (l) l.classList.remove('mah-hint'); }, 1800); } catch (e) {} } };
    var C0 = colors(); $('mahColSel').value = C0.sel; $('mahColAll').value = C0.all;
    $('mahColSel').addEventListener('input', function () { colors().sel = this.value; saveColors(); drawMah(); });
    $('mahColAll').addEventListener('input', function () { colors().all = this.value; saveColors(); drawMah(); });
    $('mahColReset').onclick = function () { COL = { sel: COL_DEF.sel, all: COL_DEF.all }; saveColors(); $('mahColSel').value = COL.sel; $('mahColAll').value = COL.all; drawMah(); };
    $('mahPopSave').onclick = function () { if (!curMah) return; var v = num($('mahPop').value); if (v == null || v <= 0) { toast('Введите население числом'); return; } OVR[curMah.key] = Math.round(v); saveOvr(); invalidate(); renderList(); drawMah(); toast('Население махалли сохранено в этой копии студии'); };
    $('mahPopClear').onclick = function () { if (!curMah) return; delete OVR[curMah.key]; saveOvr(); invalidate(); renderList(); drawMah(); };
    $('mahBndSet').onclick = function () { if (!curMah) return; var ring = lastPolygon(); if (!ring) { toast('Нарисуйте полигон вокруг махалли инструментом O (или F от руки) внизу карты и нажмите снова'); return; } setBoundary(curMah.key, ring, curMah.name); };
    $('mahBndClear').onclick = function () { if (!curMah) return; setBoundary(curMah.key, null, curMah.name); };
    fillDistricts();
    return true;
  }
  function fillDistricts() {
    var sel = $('mahDist'); if (!sel) return;
    var ds = districtsList(); if (!ds.length) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">выберите район</option><option value="*">Все районы · ' + ds.length + ' районов, все махалли города на одной карте</option>' + ds.map(function (d) { return '<option value="' + esc(d.key) + '">' + esc(distRu(d.key)) + ' · ' + d.n + ' махаллей</option>'; }).join('');
    if (cur) sel.value = cur;
    var p = point(); if (!cur && p && p.district && ds.some(function (d) { return d.key === p.district; })) { sel.value = p.district; curDist = p.district; renderList(); drawMah(); }
    if (!cur) { $('mahSum').innerHTML = '<b>' + ds.length + '</b> районов · <b>' + mahRows().length + '</b> махаллей в мастер-базе' + (zones().length ? '' : ' · границы районов не загружены'); }
  }
  function renderList() {
    var box = $('mahList'), sum = $('mahSum'); if (!box) return;
    if (!curDist) { box.innerHTML = ''; return; }
    var e = estimateCur(curDist), rows = e.rows.slice(), p = point();
    rows.forEach(function (r) { r.d = p ? havKm(p.lat, p.lng, r.lat, r.lng) : null; });
    if (sortBy === 'name') rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ru'); });
    else if (sortBy === 'dist' && p) rows.sort(function (a, b) { return (a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d); });
    else rows.sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); });
    var st = structure(e.total), dr = D.data && D.data.districts && D.data.districts.rows && D.data.districts.rows[curDist];
    if (e.all) { sum.innerHTML = '<b>Все районы Ташкента</b>: <b>' + fmt(e.total) + '</b> жителей (Toshstat, 01.07.2026) · в реестре Etirof <b>' + e.official + '</b> махаллей · на карте <b>' + rows.length + '</b> (сопоставлено ' + e.matched + ') · официальных границ ' + e.boundedN + ', расчётных ' + e.approxN + (e.manualN ? ' · вручную: ' + e.manualN : '') + ' · <span class="mini">список ниже по всем районам; галочка «Все махалли на карте» рисует границы всего города, клик по границе открывает карточку</span>'; }
    else sum.innerHTML = '<b>' + esc(distRu(curDist)) + '</b>: ' + (e.total != null ? '<b>' + fmt(e.total) + '</b> жителей (Toshstat, 01.07.2026)' : 'население района неизвестно')
      + (e.official != null ? ' · в реестре Etirof <b>' + e.official + '</b> махаллей, официальных границ ' + (e.polygons != null ? e.polygons : '-') : '')
      + ' · в базе <b>' + e.baseN + '</b>' + (e.official != null ? ' (сопоставлено с реестром ' + e.matched + (e.regOnly ? ', добавлено из реестра ' + e.regOnly : '') + ')' : '')
      + (dr && dr.soato ? ' · SOATO ' + esc(dr.soato) : '')
      + (dr && dr.area_km2_geodesic ? ' · ' + String(dr.area_km2_geodesic).replace('.', ',') + ' км²' : '')
      + (st && st.households != null ? ' · ' + fmt(st.households) + ' домохозяйств' : '') + (e.manualN ? ' · вручную: ' + e.manualN : '') + (e.boundedN ? ' · с границами: ' + e.boundedN : '') + (e.approxN ? ' · расчётных границ: ' + e.approxN : '') + (e.calibrated ? '' : ' · <span style="color:#9b6b00">сетка населения ещё не откалибрована</span>')
      + (e.missing && e.missing.length ? '<details class="mah-miss"><summary>' + e.missing.length + ' махаллей реестра без официальной границы и без точки в базе</summary>' + esc(e.missing.join(', ')) + '</details>' : '');
    box.innerHTML = rows.map(function (r) {
      var off = r.reg && r.reg.name && !r.regOnly && nrmX(r.reg.name) !== nrmX(r.name) ? ' <i class="mah-off" title="официальное имя в реестре Etirof">' + esc(r.reg.name) + '</i>' : '';
      return '<div class="mah-row' + (curMah && curMah.key === r.key ? ' sel' : '') + (r.regOnly ? ' reg' : '') + '" data-k="' + esc(r.key) + '" role="button" tabindex="0"><span class="n">' + esc(r.name) + off + (r.regOnly ? ' <i class="mah-tag" title="официальная махалля из реестра Etirof, в мастер-базе точки нет">реестр</i>' : '') + '</span><span class="p' + (r.manual ? ' man' : '') + '">' + (r.pop != null ? fmt(r.pop) : '-') + '<i>' + (r.manual ? '✓' : 'ƒ') + '</i></span>'
        + '<span class="s">' + (e.all && r.dk ? esc(distRu(r.dk)) + ' · ' : '') + (r.reg && r.reg.code ? 'код ' + esc(r.reg.code) + ' · ' : '') + (r.area_ha != null ? Math.round(r.area_ha) + ' га' + (r.density != null ? ' · ' + fmt(r.density) + ' чел./км²' : '') + ' · ' : '') + (r.poly ? '▱ граница ' + (r.poly.manual ? 'вручную' : r.poly.approx ? 'расчётная' : 'официальная') + ' · ' : '') + (r.d != null ? (r.d < 1 ? Math.round(r.d * 1000) + ' м' : r.d.toFixed(1).replace('.', ',') + ' км') + ' до точки · ' : '') + (r.hh != null ? fmt(r.hh) + ' домохозяйств · ' : '') + esc(r.m.address || '') + '</span></div>';
    }).join('') || '<div class="mah-sum">В этом районе махаллей в мастер-базе нет</div>';
    box.querySelectorAll('.mah-row').forEach(function (el) {
      el.onclick = function () { selectMah(el.dataset.k); };
      el.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectMah(el.dataset.k); } };
    });
  }
  /* последний полигон, нарисованный инструментами карты (агент хранит фигуры зоны) */
  function lastPolygon() {
    var A = window.CASE_GEO_AGENT, z = (A && A.state && Array.isArray(A.state.zone)) ? A.state.zone : [];
    for (var i = z.length - 1; i >= 0; i--) { var sh = z[i]; var ring = sh && sh.kind === 'polygon' ? (sh.ring || sh.points) : null; if (Array.isArray(ring) && ring.length >= 3) return ring.map(function (p) { return [+p[0], +p[1]]; }); }
    return null;
  }
  function setBoundary(key, ring, name) {
    var shared = false;
    try { if (typeof window.geoSetMahallaBoundary === 'function' && !document.body.classList.contains('geo-no-edit')) shared = !!window.geoSetMahallaBoundary(key, ring || [], name); } catch (e) { shared = false; }
    if (!shared) { if (ring) BNDL[key] = ring; else delete BNDL[key]; saveBndl(); }
    invalidate(); renderList(); drawMah(); if (curMah) bndInfo();
    toast(ring ? (shared ? 'Граница махалли сохранена в общей базе, население пересчитано' : 'Граница махалли сохранена в этой копии студии') : 'Граница махалли убрана');
  }
  function bndInfo() {
    var el = $('mahBndInfo'); if (!el || !curMah) return;
    var e = estimateCur(curDist), r = e.rows.filter(function (x) { return x.key === curMah.key; })[0];
    el.textContent = r && r.poly ? (r.poly.manual ? 'введена вручную' : r.poly.approx ? 'расчётная по соседним точкам; население по радиусу' : (r.poly.origin === 'ngis' ? 'из НГИС (open.ngis.uz)' : r.poly.origin === 'hokimiyat' ? 'из слоя хокимията' : 'из официального файла')) : 'нет: население по радиусу';
  }
  D.setBoundary = setBoundary; D.lastPolygon = lastPolygon;
  function selectMah(key) {
    var e = estimateCur(curDist), r = e.rows.filter(function (x) { return x.key === key; })[0]; if (!r) return;
    curMah = { key: key, district: r.dk || String(r.m.district || curDist), name: r.name, lat: r.lat, lng: r.lng };
    $('mahEdit').hidden = document.body.classList.contains('geo-no-edit');
    $('mahBnd').hidden = false; bndInfo();
    $('mahEditName').textContent = r.name + ':'; $('mahPop').value = OVR[key] != null ? OVR[key] : (r.manual ? Math.round(r.pop) : '');
    renderList(); drawMah();
    var M = theMap(); if (M) { try { if (r.poly && window.L) M.fitBounds(L.polygon(r.poly.ll).getBounds().pad(0.35), { maxZoom: 16 }); else M.setView([r.lat, r.lng], Math.max(M.getZoom(), 14)); } catch (x) {} }
  }
  /* подсказка по махалле (наведение) и подпись выбранной махалли на карте (по замечанию владельца:
     при выборе видна граница, сверху сведения: жители, площадь, домохозяйства) */
  function tipHtml(r) {
    return '<b>' + esc(r.name) + '</b>' + (r.reg && r.reg.name && nrmX(r.reg.name) !== nrmX(r.name) ? ' <small>' + esc(r.reg.name) + '</small>' : '') + (r.reg && r.reg.name_cyr ? '<br><small>' + esc(r.reg.name_cyr) + '</small>' : '') + '<br>' + (r.pop != null ? fmt(r.pop) + ' жителей (' + (r.manual ? 'введено' : 'оценка') + ')' : 'население неизвестно') + (r.hh != null ? '<br>' + fmt(r.hh) + ' домохозяйств' : '') + (r.reg && r.reg.code ? '<br>код ' + esc(r.reg.code) : '') + (r.area_ha != null ? ' · ' + Math.round(r.area_ha) + ' га' : '') + (r.density != null ? ' · ' + fmt(r.density) + ' чел./км²' : '') + (r.poly && r.poly.approx ? '<br><small>граница расчётная: по соседним точкам, не официальная</small>' : '') + '<br><small>' + esc(r.src) + '</small><br><small>клик: карточка махалли</small>';
  }
  function labelHtml(r) {
    return '<span class="mah-lbl"><b>' + esc(r.name) + '</b>' + (r.pop != null ? ' · ' + fmt(r.pop) + ' жит.' : '') + (r.hh != null ? ' · ' + fmt(r.hh) + ' д/х' : '') + (r.area_ha != null ? ' · ' + Math.round(r.area_ha) + ' га' : '') + (r.poly ? (r.poly.approx ? ' · граница расчётная' : '') : ' · без границы') + '</span>';
  }
  function toolBusy() { try { var T = window.CASE_GEO_TOOLS; return !!(T && T.state && T.state.tool); } catch (e) { return false; } }
  function openCard(key) { if (toolBusy()) return; selectMah(key); try { openDemo('m:' + key); } catch (e) {} }
  /* v4.79.0 (замечание владельца): цвета границ махаллей меняются вручную и запоминаются.
     По умолчанию: выбранная брендовым красным, остальные бронзовым (проверенная палитра карты). */
  var COL_DEF = { sel: '#9E0000', all: '#8A6A2E' }, COL = null;
  function colors() {
    if (COL) return COL;
    COL = { sel: COL_DEF.sel, all: COL_DEF.all };
    try { var j = JSON.parse(localStorage.getItem(KEY_COL) || 'null'); if (j && typeof j === 'object') { if (/^#[0-9a-f]{6}$/i.test(j.sel || '')) COL.sel = j.sel; if (/^#[0-9a-f]{6}$/i.test(j.all || '')) COL.all = j.all; } } catch (e) {}
    return COL;
  }
  function saveColors() { try { localStorage.setItem(KEY_COL, JSON.stringify(colors())); } catch (e) {} }
  function lighten(hex, k) {
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || ''); if (!m) return hex;
    var v = [1, 2, 3].map(function (i) { var c = parseInt(m[i], 16); return Math.round(c + (255 - c) * k); });
    return '#' + v.map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
  }
  D.colors = colors;
  function showAll() { return !!($('mahShow') && $('mahShow').checked); }
  function showSel() { var c = $('mahSelShow'); return !c || c.checked; }
  function saveShow() { try { localStorage.setItem(KEY_SHOW, JSON.stringify({ all: showAll(), sel: showSel() })); } catch (e) {} }
  function drawMah() {
    var M = theMap(); if (!M || !window.L) return;
    if (!gMah) gMah = L.layerGroup().addTo(M); gMah.clearLayers();
    if (!curDist) return;
    var all = showAll(), selOn = showSel();
    if (!all && !(selOn && curMah)) return;
    var e = estimateCur(curDist), mx = Math.max.apply(null, e.rows.map(function (r) { return r.pop || 0; })) || 1;
    e.rows.forEach(function (r) {
      var sel = curMah && curMah.key === r.key;
      if (!all && !sel) return;
      if (sel && !selOn) return;
      var rad = 5 + 13 * Math.sqrt((r.pop || 0) / mx);
      if (r.poly) {
        /* при показе всех махалл границы кликабельны: клик открывает карточку махалли */
        var ap = !!r.poly.approx;
        var C = colors(), cl = sel ? C.sel : (ap ? lighten(C.all, .3) : C.all);
        var pg = L.polygon(r.poly.ll, { color: cl, weight: sel ? 2.5 : 1, fillColor: sel ? C.sel : lighten(C.all, .45), fillOpacity: sel ? .1 : (ap ? .05 : .12), dashArray: r.poly.manual ? '6 4' : (ap ? '2 5' : null), interactive: all });
        if (all) { pg.bindTooltip(tipHtml(r), { sticky: true }); pg.on('click', function () { openCard(r.key); }); }
        pg.addTo(gMah);
      }
      var C2 = colors();
      var c = L.circleMarker([r.lat, r.lng], { radius: rad, color: sel ? C2.sel : C2.all, weight: sel ? 3 : 1.5, fillColor: r.manual ? '#00897C' : lighten(C2.all, .45), fillOpacity: .45 });
      c.bindTooltip(tipHtml(r));
      c.on('click', function () { if (toolBusy()) return; if (all) openCard(r.key); else selectMah(r.key); });
      c.addTo(gMah);
      if (sel) L.marker([r.lat, r.lng], { icon: L.divIcon({ className: '', html: labelHtml(r), iconAnchor: [-8, 8] }), interactive: false }).addTo(gMah);
    });
  }
  /* режим «Все районы»: карта отъезжает на весь город, чтобы все махалли были видны сразу */
  function fitCity() {
    var M = theMap(); if (!M || !window.L || curDist !== ALL) return;
    var pts = estimateAll().rows.filter(function (r) { return r.lat && r.lng; }).map(function (r) { return [r.lat, r.lng]; });
    if (pts.length > 2) { try { M.fitBounds(L.latLngBounds(pts).pad(0.03)); } catch (x) {} }
  }
  D.layers = function () { return gMah ? gMah.getLayers() : []; };
  D.select = function (dk, key) { if (dk && $('mahDist')) { $('mahDist').value = dk; curDist = dk; } curMah = null; renderList(); drawMah(); if (key) selectMah(key); else if (dk === ALL) fitCity(); };
  D.current = function () { return { district: curDist, mahalla: curMah }; };
  D.layerCount = function () { return gMah ? gMah.getLayers().length : 0; };

  /* --- установка -------------------------------------------------------------------------------- */
  function hooks() {
    var rp = window.renderProj; if (typeof rp === 'function' && !rp._mah) { var w = function () { var r = rp.apply(this, arguments); try { invalidate(); if (!curDist) fillDistricts(); else renderList(); } catch (e) {} return r; }; w._mah = true; window.renderProj = w; }
    var cal = window.calibrate; if (typeof cal === 'function' && !cal._mah) { var w2 = function () { var r = cal.apply(this, arguments); try { invalidate(); renderList(); drawMah(); } catch (e) {} return r; }; w2._mah = true; window.calibrate = w2; }
    var sc = window.saveCard; if (typeof sc === 'function' && !sc._mah) { var w3 = function () { var r = sc.apply(this, arguments); try { invalidate(); renderList(); } catch (e) {} return r; }; w3._mah = true; window.saveCard = w3; }
  }
  /* v420-geo-studio.js после загрузки мастер-базы подменяет renderProj и analytics своими версиями и
     снимает обёртки, поставленные раньше: перепроверяем и оборачиваем заново первые полторы минуты */
  function rehook() { try { hooks(); hookProbe(); hookAnalytics(); var box = $('anaT'); if (box && box.innerHTML && !box.querySelector('.dm-ana')) injectAnalytics(); } catch (e) {} }
  function install() {
    css(); loadOvr(); loadBndl(); loadData().then(function () { loadRegistry(); try { injectAnalytics(); } catch (e) {} return loadBoundaries(); });
    /* вкладка «Аналитика» заполняется студией при загрузке данных; раздел демографии дорисовывается при открытии вкладки */
    document.addEventListener('click', function (ev) { var b = ev.target && ev.target.closest ? ev.target.closest('.tabs button[data-t="anaT"]') : null; if (b) setTimeout(function () { try { var box = $('anaT'); if (box && box.innerHTML && !box.querySelector('.dm-ana')) injectAnalytics(); } catch (e) {} }, 60); }, true);
    var tries = 0;
    (function tick() {
      var ok = mount();
      if (ok) { rehook(); var hn = 0, hv = setInterval(function () { rehook(); if (++hn >= 60) clearInterval(hv); }, 1500); if (!mahRows().length && tries < 120) setTimeout(function () { fillDistricts(); if (!$('mahDist').options.length || $('mahDist').options.length < 2) { var t2 = 0; (function again() { fillDistricts(); if ($('mahDist').options.length < 2 && ++t2 < 60) setTimeout(again, 500); })(); } }, 800); return; }
      if (++tries < 80) setTimeout(tick, 250);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4770-geo-mahalla'] = '4.79.0';
