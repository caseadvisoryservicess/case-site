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
  var VERSION = '4.77.0', KEY_SECT = 'caseos_mah_sect', KEY_OVR = 'caseos_mahalla_pop_v1', KERNEL_KM = 0.9, FORECAST_YEARS = 10;
  var D = window.CASE_GEO_DEMO = { version: VERSION, data: null, ready: false };
  var OVR = {}, gMah = null, gSel = null, curDist = '', curMah = null, sortBy = 'pop', cache = {}, BND = null;
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
    return fetch(f, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (g) {
      if (!g || !Array.isArray(g.features) || !g.features.length) { BND = null; return null; }
      BND = g.features.map(function (ft) { var ps = polys(ft.geometry); if (!ps.length) return null; var pr = ft.properties || {}; return { name: String(pr.name || pr.NAME || pr.mahalla || pr.title || ''), district: String(pr.district || pr.DISTRICT || ''), polys: ps, bb: bbox(ps), ll: ps.map(function (p) { return p.map(function (ring) { return ring.map(function (c) { return [c[1], c[0]]; }); }); }) }; }).filter(Boolean);
      invalidate(); try { renderList(); drawMah(); } catch (e) {}
      return BND;
    }).catch(function () { BND = null; return null; });
  }
  function polys(g) { if (!g) return []; if (g.type === 'Polygon') return [g.coordinates]; if (g.type === 'MultiPolygon') return g.coordinates; if (g.type === 'GeometryCollection') { var o = []; (g.geometries || []).forEach(function (x) { o = o.concat(polys(x)); }); return o; } return []; }
  function bbox(ps) { var b = [Infinity, Infinity, -Infinity, -Infinity]; ps.forEach(function (p) { p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); return b; }
  function ring(x, y, r) { var inside = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
  function inPolys(x, y, ps) { for (var k = 0; k < ps.length; k++) { var p = ps[k]; if (ring(x, y, p[0])) { var hole = false; for (var h = 1; h < p.length; h++) if (ring(x, y, p[h])) { hole = true; break; } if (!hole) return true; } } return false; }
  function inB(b, la, ln) { return !(ln < b.bb[0] || ln > b.bb[2] || la < b.bb[1] || la > b.bb[3]) && inPolys(ln, la, b.polys); }
  function nrm(s) { return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9']/g, ''); }
  function boundaryFor(m, dk) {
    if (!BND) return null; var la = +m.lat, ln = +m.lng;
    for (var i = 0; i < BND.length; i++) { var b = BND[i]; if (b.district && dk && b.district !== dk) continue; if (inB(b, la, ln)) return b; }
    var n = nrm(m.name); if (!n) return null;
    for (var j = 0; j < BND.length; j++) if ((!BND[j].district || BND[j].district === dk) && nrm(BND[j].name) === n) return BND[j];
    return null;
  }
  function popInBoundary(b) { var P = pop(), s = 0; for (var i = 0; i < P.length; i++) { var h = P[i]; if (inB(b, h[0], h[1])) s += h[2]; } return s; }
  D.boundaries = function () { return BND; };
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
    var rows = mahRows().filter(function (m) { return String(m.district || '') === dk && isFinite(+m.lat) && isFinite(+m.lng); });
    var z = zones().filter(function (x) { return x.key === dk; })[0];
    var total = z ? z.pop : null, P = pop(), w = [], sumW = 0, manualSum = 0, manualN = 0, bnd = [], bndSum = 0, bndN = 0;
    rows.forEach(function (m, i) {
      var mp = manualPop(m); if (mp) { manualSum += mp.value; manualN++; w[i] = 0; return; }
      var b = boundaryFor(m, dk); if (b) { var v = popInBoundary(b); bnd[i] = { b: b, v: v }; bndSum += v; bndN++; w[i] = 0; return; }
      var s = 0, la = +m.lat, ln = +m.lng, dl = KERNEL_KM / 111.32, dn = KERNEL_KM / (111.32 * Math.cos(la * Math.PI / 180));
      for (var k = 0; k < P.length; k++) { var h = P[k]; if (Math.abs(h[0] - la) > dl || Math.abs(h[1] - ln) > dn) continue; var d = havKm(la, ln, h[0], h[1]); if (d <= KERNEL_KM) s += h[2] * (1 - d / KERNEL_KM); }
      w[i] = s; sumW += s;
    });
    var rest = total != null ? Math.max(0, total - manualSum - bndSum) : null;
    var out = rows.map(function (m, i) {
      var mp = manualPop(m), est = null, conf = 'modelled', src = '', poly = null;
      if (mp) { est = mp.value; conf = 'verified'; src = mp.src; }
      else if (bnd[i]) { est = bnd[i].v; conf = 'asking'; src = 'сетка населения внутри официальной границы махалли'; poly = bnd[i].b; }
      else if (rest != null && sumW > 0) { est = rest * w[i] / sumW; src = 'оценка: население района × доля махалли по сетке населения (' + Math.round(KERNEL_KM * 1000) + ' м)'; }
      else if (sumW > 0) { est = null; src = 'нет официального населения района'; }
      return { m: m, key: keyOf(m), name: m.name, pop: est, conf: conf, src: src, hh: manualHh(m), manual: !!mp, poly: poly, lat: +m.lat, lng: +m.lng };
    });
    cache[dk] = { rows: out, total: total, manualN: manualN, manualSum: manualSum, boundedN: bndN, calibrated: calibrated() && P.length > 0 };
    return cache[dk];
  }
  D.estimateDistrict = estimateDistrict;
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
  function seriesFor(N) {
    var c = city(); if (!c) return null;
    var cp = cityPop(), popTr = trendOf(c.population_series || []);
    var k = cp && cp.value ? N / cp.value : null;
    var scale = function (tr) { return { points: tr.points.map(function (p) { return { t: p.t, v: p.v * k, date: p.date, conf: p.conf }; }), forecast: tr.forecast.map(function (p) { return { t: p.t, v: p.v * k, conf: 'modelled' }; }), cagr: tr.cagr }; };
    var popS = k != null ? scale(popTr) : null;
    var inc = c.income && c.income.per_capita_uzs_year ? c.income.per_capita_uzs_year : {};
    var incTr = trendOf(Object.keys(inc).map(function (y) { return { date: y + '-12-31', value: +inc[y], conf: 'verified' }; }));
    var hhSize = c.household && c.household.size ? c.household.size : null;
    return {
      pop: popS, income: incTr,
      households: popS && hhSize ? { points: popS.points.map(function (p) { return { t: p.t, v: p.v / hhSize, conf: p.conf }; }), forecast: popS.forecast.map(function (p) { return { t: p.t, v: p.v / hhSize, conf: 'modelled' }; }), cagr: popS.cagr } : null,
      cityCagr: popTr.cagr, incomeCagr: incTr.cagr
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
    s += '<text x="' + (mid - 6) + '" y="10" text-anchor="end" class="dm-lg">мужчины</text><text x="' + (mid + 6) + '" y="10" class="dm-lg">женщины</text>';
    age5.slice().reverse().forEach(function (r, i) {
      var y = 16 + i * rowH, wm = r.m / mx * half, wf = r.f / mx * half;
      s += '<rect x="' + (mid - 4 - wm) + '" y="' + y + '" width="' + wm + '" height="' + (rowH - 2) + '" class="dm-m' + (conf === 'modelled' ? ' dm-mod' : '') + '"><title>' + esc(r.g) + ': мужчины ' + fmt(r.m) + '</title></rect>';
      s += '<rect x="' + (mid + 4) + '" y="' + y + '" width="' + wf + '" height="' + (rowH - 2) + '" class="dm-f' + (conf === 'modelled' ? ' dm-mod' : '') + '"><title>' + esc(r.g) + ': женщины ' + fmt(r.f) + '</title></rect>';
      s += '<text x="' + mid + '" y="' + (y + rowH - 4) + '" text-anchor="middle" class="dm-ax">' + esc(r.g) + '</text>';
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
    if (tr.forecast && tr.forecast.length) { var xs = X(tr.points[tr.points.length - 1].t); s += '<rect x="' + xs.toFixed(1) + '" y="0" width="' + (W - pad.r - xs).toFixed(1) + '" height="' + H + '" class="dm-fcbg"/><text x="' + (xs + 4).toFixed(1) + '" y="9" class="dm-lg">прогноз</text>'; }
    s += '<polyline points="' + fact + '" class="dm-fact"/>';
    if (fc) s += '<polyline points="' + fc + '" class="dm-fc"/>';
    tr.points.forEach(function (p) { s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.4" class="dm-dot"><title>' + Math.floor(p.t) + ': ' + (opts.fmt || fmt)(p.v) + '</title></circle>'; });
    (tr.forecast || []).forEach(function (p) { s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="1.8" class="dm-dotf"><title>' + p.t + ' (прогноз): ' + (opts.fmt || fmt)(p.v) + '</title></circle>'; });
    var yrs = [Math.floor(t0), Math.floor((t0 + t1) / 2), Math.floor(t1)];
    yrs.forEach(function (y) { s += '<text x="' + X(y).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="middle" class="dm-ax">' + y + '</text>'; });
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
  function demoHtml(scope) {
    var c = city();
    if (!c) return '<div class="dm-none">Файл данных демографии не загружен: data/demography_tashkent.json</div>';
    var st = structure(scope.N), sr = seriesFor(scope.N);
    if (!st) return '<div class="dm-none">Нет населения для охвата «' + esc(scope.label) + '»</div>';
    var h = '<div class="dm-head"><div class="dm-scope">' + esc(scope.label) + '</div><div class="dm-mut">' + esc(scope.note || '') + '</div></div>';
    h += '<div class="dm-kpi">'
      + kpi('Население', fmt(st.N), scope.conf === 'modelled' ? 'оценка' : 'факт')
      + kpi('Домохозяйств', st.households != null ? fmt(st.households) : '-', st.hhSize ? 'по ' + String(st.hhSize).replace('.', ',') + ' чел.' : 'нет размера')
      + kpi('Женщины', st.female != null ? fmt(st.female) : '-', st.femShare != null ? pct(st.femShare, 1) : '')
      + kpi('Мужчины', st.male != null ? fmt(st.male) : '-', st.femShare != null ? pct(1 - st.femShare, 1) : '')
      + kpi('Доход на душу', st.income ? mln(st.income.uzs) + ' сум/год' : '-', st.income ? (st.income.usd ? '≈ $' + fmt(st.income.usd) + ' · ' + st.income.year : st.income.year) : 'нет данных')
      + kpi('Совокупный доход', st.income ? mln(st.income.total) + ' сум/год' : '-', 'население × доход на душу')
      + '</div>';
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
        + trendRow('Население', sr.pop, fmt) + trendRow('Домохозяйства', sr.households, fmt) + trendRow('Доход на душу, сум/год', sr.income, mln) + '</tbody></table>';
      h += '<div class="dm-two"><div>' + lineSvg(sr.pop, { label: 'Население' }) + '<div class="dm-cap">Население</div></div><div>' + lineSvg(sr.income, { label: 'Доход на душу', fmt: mln }) + '<div class="dm-cap">Доход на душу</div></div></div>';
      h += '<div class="dm-mut">Метод: среднегодовой темп по всему ряду фактов, продлённый на ' + FORECAST_YEARS + ' лет (CAGR). Население охвата масштабировано от городского ряда: доля охвата в городе принята постоянной. Это прогноз, не факт.</div>';
    }
    if (st.assumptions.length) h += '<h4>Допущения</h4><ul class="dm-as">' + st.assumptions.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
    var need = (D.data.inputs_needed || []);
    if (need.length) h += '<h4>Требуемые входные данные</h4><ul class="dm-as">' + need.map(function (n) { return '<li><b>' + esc(n.what) + '</b> · ' + esc(n.owner) + ' · ' + esc(n.where) + '</li>'; }).join('') + '</ul>';
    var srcs = []; [c.sex, c.age3, c.income, c.household, c.spending].forEach(function (b) { if (b && (b.source || b.working_source)) srcs.push(b.source || b.working_source); });
    var cp = cityPop(); if (cp) srcs.unshift(cp.source + ' (' + cp.date + ')');
    h += '<h4>Источники</h4><ul class="dm-as dm-src">' + srcs.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  function kpi(l, v, s) { return '<div class="dm-k"><div class="dm-kl">' + esc(l) + '</div><div class="dm-kv">' + v + '</div><div class="dm-ks">' + esc(s || '') + '</div></div>'; }

  function scopes() {
    var out = [], cp = cityPop();
    if (cp) out.push({ id: 'city', label: 'Город Ташкент', N: cp.value, note: 'факт ' + cp.date + ', ' + cp.source, conf: 'verified' });
    zones().forEach(function (z) { out.push({ id: 'd:' + z.key, label: distRu(z.key) + ' район', N: z.pop, note: 'официальное население района, площадь ' + String(z.area).replace('.', ',') + ' км²', conf: 'verified' }); });
    if (curMah) { var e = estimateDistrict(curMah.district).rows.filter(function (r) { return r.key === curMah.key; })[0]; if (e && e.pop != null) out.push({ id: 'm:' + e.key, label: 'Махалля ' + e.name + ' (' + distRu(curMah.district) + ')', N: e.pop, note: e.src, conf: e.conf }); }
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
  D.open = openDemo; D.scopes = scopes; D.html = demoHtml;
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
      + '.mah-lbl{background:#fff;border:1px solid #8C6A2F;color:#5a4420;border-radius:6px;padding:1px 5px;font:600 10px/1.3 inherit;white-space:nowrap}'
      /* карточка демографии */
      + '#card.dm-open{width:min(760px,96vw);max-width:96vw;padding:12px 16px;box-sizing:border-box}.dm-top{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}.dm-top h2{font-size:16px;margin:0}.dm-top .sp{flex:1}.dm-top select{font-size:12px;padding:5px 8px;border-radius:8px;border:1px solid var(--line,#e3dcd1);max-width:340px}'
      + '.dm-body{flex:1;min-height:0;overflow:auto;font-size:12px}.dm-body h4{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--slate,#4a5568);margin:14px 0 6px;border-top:1px solid var(--line,#e3dcd1);padding-top:8px}'
      + '.dm-head .dm-scope{font-weight:800;font-size:13px}.dm-mut{color:var(--muted,#6f6a63);font-size:10.5px;line-height:1.45}.dm-none{color:var(--muted,#6f6a63);font-size:11.5px;padding:8px 0}'
      + '.dm-kpi{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:6px 0}.dm-k{background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:9px;padding:7px 9px;min-width:0}.dm-kl{font-size:10px;color:var(--muted,#6f6a63);text-transform:uppercase;letter-spacing:.04em}.dm-kv{font-size:15px;font-weight:800;margin:2px 0}.dm-ks{font-size:10px;color:var(--muted,#6f6a63)}'
      + '.dm-age3{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;margin:4px 0 6px}.dm-age3 span{background:#faf7f2;border-radius:6px;padding:3px 7px}'
      + '.dm-pyr .dm-m{fill:#1b4f8a}.dm-pyr .dm-f{fill:#9E0000}.dm-pyr .dm-mod{opacity:.55}.dm-pyr .dm-ax{font-size:8px;fill:#6f6a63}.dm-lg{font-size:8px;fill:#6f6a63}'
      + '.dm-line .dm-fact{fill:none;stroke:#9E0000;stroke-width:2}.dm-line .dm-fc{fill:none;stroke:#9E0000;stroke-width:1.5;stroke-dasharray:4 3;opacity:.75}.dm-line .dm-dot{fill:#9E0000}.dm-line .dm-dotf{fill:#fff;stroke:#9E0000}.dm-line .dm-fcbg{fill:#f5efe6}.dm-line .dm-ax{font-size:8px;fill:#6f6a63}'
      + '.dm-two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}.dm-cap{font-size:10px;color:var(--muted,#6f6a63);text-align:center}'
      + '.dm-tr{width:100%;border-collapse:collapse;font-size:11px}.dm-tr th,.dm-tr td{border-bottom:1px solid #eee;padding:4px 6px;text-align:left;vertical-align:top}.dm-tr th{font-size:10px;color:var(--muted,#6f6a63);font-weight:600}'
      + '.dm-bars{display:grid;gap:3px;margin:6px 0}.dm-bar{display:grid;grid-template-columns:200px 1fr 130px;gap:6px;align-items:center;font-size:10.5px}.dm-bar .dm-bn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dm-bar .dm-bn i{font-style:normal;background:#9E0000;color:#fff;border-radius:4px;padding:0 4px;font-size:9px}.dm-bar .dm-bt{background:#f1ede6;border-radius:4px;height:9px;overflow:hidden}.dm-bar .dm-bt b{display:block;height:100%;background:#b9b2a8}.dm-bar.rde .dm-bt b{background:#9E0000}.dm-bar .dm-bv{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}'
      + '.dm-share{margin:6px 0;font-size:11.5px;background:#fbeaea;border-radius:8px;padding:6px 9px}.dm-as{margin:4px 0;padding-left:18px;font-size:11px;line-height:1.45}.dm-src{color:var(--muted,#6f6a63)}'
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
      + '<label class="ck" style="margin-top:6px"><input type="checkbox" id="mahShow" checked> Махалли района на карте</label>'
      + '<div class="mini">Границ махаллей в открытых источниках нет: население махалли оценено по сетке населения вокруг её точки в пределах официального населения района. Введённое вручную число имеет приоритет и помечено зелёным.</div>'
      + '</div>';
    anchor.parentNode.insertBefore(sect, anchor);
    var h3 = sect.querySelector('h3'); h3.style.cursor = 'pointer';
    h3.addEventListener('click', function () { var closed = sect.classList.toggle('closed'); try { localStorage.setItem(KEY_SECT, closed ? '0' : '1'); } catch (e) {} });
    try { if (localStorage.getItem(KEY_SECT) === '0') sect.classList.add('closed'); } catch (e) {}
    $('mahDemoBtn').onclick = function () { openDemo(curMah ? 'm:' + curMah.key : curDist ? 'd:' + curDist : 'city'); };
    $('mahDemoCatch').onclick = function () { if (!point()) { toast('Сначала поставьте точку анализа (пин на панели инструментов)'); return; } openDemo('catch'); };
    $('mahDist').onchange = function () { curDist = $('mahDist').value; curMah = null; $('mahEdit').hidden = true; renderList(); drawMah(); };
    $('mahSort').querySelectorAll('button').forEach(function (b) { b.onclick = function () { sortBy = b.dataset.s; $('mahSort').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderList(); }; });
    $('mahShow').onchange = drawMah;
    $('mahPopSave').onclick = function () { if (!curMah) return; var v = num($('mahPop').value); if (v == null || v <= 0) { toast('Введите население числом'); return; } OVR[curMah.key] = Math.round(v); saveOvr(); invalidate(); renderList(); drawMah(); toast('Население махалли сохранено в этой копии студии'); };
    $('mahPopClear').onclick = function () { if (!curMah) return; delete OVR[curMah.key]; saveOvr(); invalidate(); renderList(); drawMah(); };
    fillDistricts();
    return true;
  }
  function fillDistricts() {
    var sel = $('mahDist'); if (!sel) return;
    var ds = districtsList(); if (!ds.length) return;
    var cur = sel.value;
    sel.innerHTML = '<option value="">выберите район</option>' + ds.map(function (d) { return '<option value="' + esc(d.key) + '">' + esc(distRu(d.key)) + ' · ' + d.n + ' махаллей</option>'; }).join('');
    if (cur) sel.value = cur;
    var p = point(); if (!cur && p && p.district && ds.some(function (d) { return d.key === p.district; })) { sel.value = p.district; curDist = p.district; renderList(); drawMah(); }
    if (!cur) { $('mahSum').innerHTML = '<b>' + ds.length + '</b> районов · <b>' + mahRows().length + '</b> махаллей в мастер-базе' + (zones().length ? '' : ' · границы районов не загружены'); }
  }
  function renderList() {
    var box = $('mahList'), sum = $('mahSum'); if (!box) return;
    if (!curDist) { box.innerHTML = ''; return; }
    var e = estimateDistrict(curDist), rows = e.rows.slice(), p = point();
    rows.forEach(function (r) { r.d = p ? havKm(p.lat, p.lng, r.lat, r.lng) : null; });
    if (sortBy === 'name') rows.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ru'); });
    else if (sortBy === 'dist' && p) rows.sort(function (a, b) { return (a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d); });
    else rows.sort(function (a, b) { return (b.pop || 0) - (a.pop || 0); });
    var st = structure(e.total), rep = (D.data && D.data.mahallas && D.data.mahallas.reported_counts && D.data.mahallas.reported_counts[curDist]) || null;
    sum.innerHTML = '<b>' + esc(distRu(curDist)) + '</b>: ' + (e.total != null ? '<b>' + fmt(e.total) + '</b> жителей (официально)' : 'население района неизвестно') + ' · <b>' + rows.length + '</b> махаллей в базе' + (rep ? ' из ~' + rep + ' заявленных <span title="Open Data Tashkent, число из поисковой сводки, требует проверки">(?)</span>' : '')
      + (st && st.households != null ? ' · ' + fmt(st.households) + ' домохозяйств' : '') + (e.manualN ? ' · вручную: ' + e.manualN : '') + (e.boundedN ? ' · с границами: ' + e.boundedN : '') + (e.calibrated ? '' : ' · <span style="color:#9b6b00">сетка населения ещё не откалибрована</span>');
    box.innerHTML = rows.map(function (r) {
      return '<div class="mah-row' + (curMah && curMah.key === r.key ? ' sel' : '') + '" data-k="' + esc(r.key) + '" role="button" tabindex="0"><span class="n">' + esc(r.name) + '</span><span class="p' + (r.manual ? ' man' : '') + '">' + (r.pop != null ? fmt(r.pop) : '-') + '<i>' + (r.manual ? '✓' : 'ƒ') + '</i></span>'
        + '<span class="s">' + (r.d != null ? (r.d < 1 ? Math.round(r.d * 1000) + ' м' : r.d.toFixed(1).replace('.', ',') + ' км') + ' до точки · ' : '') + (r.hh != null ? fmt(r.hh) + ' домохозяйств · ' : '') + esc(r.m.address || '') + '</span></div>';
    }).join('') || '<div class="mah-sum">В этом районе махаллей в мастер-базе нет</div>';
    box.querySelectorAll('.mah-row').forEach(function (el) {
      el.onclick = function () { selectMah(el.dataset.k); };
      el.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selectMah(el.dataset.k); } };
    });
  }
  function selectMah(key) {
    var e = estimateDistrict(curDist), r = e.rows.filter(function (x) { return x.key === key; })[0]; if (!r) return;
    curMah = { key: key, district: curDist, name: r.name, lat: r.lat, lng: r.lng };
    $('mahEdit').hidden = document.body.classList.contains('geo-no-edit');
    $('mahEditName').textContent = r.name + ':'; $('mahPop').value = OVR[key] != null ? OVR[key] : (r.manual ? Math.round(r.pop) : '');
    renderList(); drawMah();
    var M = theMap(); if (M) { try { M.setView([r.lat, r.lng], Math.max(M.getZoom(), 14)); } catch (x) {} }
  }
  function drawMah() {
    var M = theMap(); if (!M || !window.L) return;
    if (!gMah) gMah = L.layerGroup().addTo(M); gMah.clearLayers();
    if (!curDist || !($('mahShow') && $('mahShow').checked)) return;
    var e = estimateDistrict(curDist), mx = Math.max.apply(null, e.rows.map(function (r) { return r.pop || 0; })) || 1;
    e.rows.forEach(function (r) {
      var rad = 5 + 13 * Math.sqrt((r.pop || 0) / mx), sel = curMah && curMah.key === r.key;
      if (r.poly) L.polygon(r.poly.ll, { color: sel ? '#9E0000' : '#8C6A2F', weight: sel ? 2 : 1, fillColor: '#c9a86a', fillOpacity: .12, interactive: false }).addTo(gMah);
      var c = L.circleMarker([r.lat, r.lng], { radius: rad, color: sel ? '#9E0000' : '#8C6A2F', weight: sel ? 3 : 1.5, fillColor: r.manual ? '#14675B' : '#c9a86a', fillOpacity: .45 });
      c.bindTooltip('<b>' + esc(r.name) + '</b><br>' + (r.pop != null ? fmt(r.pop) + ' жителей (' + (r.manual ? 'введено' : 'оценка') + ')' : 'население неизвестно') + (r.hh != null ? '<br>' + fmt(r.hh) + ' домохозяйств' : '') + '<br><small>' + esc(r.src) + '</small>');
      c.on('click', function () { selectMah(r.key); });
      c.addTo(gMah);
      if (sel) L.marker([r.lat, r.lng], { icon: L.divIcon({ className: '', html: '<span class="mah-lbl">' + esc(r.name) + '</span>', iconAnchor: [-8, 8] }), interactive: false }).addTo(gMah);
    });
  }
  D.select = function (dk, key) { if (dk && $('mahDist')) { $('mahDist').value = dk; curDist = dk; } curMah = null; renderList(); drawMah(); if (key) selectMah(key); };
  D.current = function () { return { district: curDist, mahalla: curMah }; };
  D.layerCount = function () { return gMah ? gMah.getLayers().length : 0; };

  /* --- установка -------------------------------------------------------------------------------- */
  function hooks() {
    var rp = window.renderProj; if (typeof rp === 'function' && !rp._mah) { var w = function () { var r = rp.apply(this, arguments); try { invalidate(); if (!curDist) fillDistricts(); else renderList(); } catch (e) {} return r; }; w._mah = true; window.renderProj = w; }
    var cal = window.calibrate; if (typeof cal === 'function' && !cal._mah) { var w2 = function () { var r = cal.apply(this, arguments); try { invalidate(); renderList(); drawMah(); } catch (e) {} return r; }; w2._mah = true; window.calibrate = w2; }
    var sc = window.saveCard; if (typeof sc === 'function' && !sc._mah) { var w3 = function () { var r = sc.apply(this, arguments); try { invalidate(); renderList(); } catch (e) {} return r; }; w3._mah = true; window.saveCard = w3; }
  }
  function install() {
    css(); loadOvr(); loadData().then(function () { return loadBoundaries(); });
    var tries = 0;
    (function tick() {
      var ok = mount();
      if (ok) { hooks(); if (!mahRows().length && tries < 120) setTimeout(function () { fillDistricts(); if (!$('mahDist').options.length || $('mahDist').options.length < 2) { var t2 = 0; (function again() { fillDistricts(); if ($('mahDist').options.length < 2 && ++t2 < 60) setTimeout(again, 500); })(); } }, 800); return; }
      if (++tries < 80) setTimeout(tick, 250);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4770-geo-mahalla'] = '4.77.0';
