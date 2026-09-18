/* CASE OS v4.73.0 - собственный гео-агент студии геоаналитики.
 *
 * Владелец поставил условие: никаких платных моделей и внешних ИИ-сервисов. Агент должен
 * жить внутри платформы и быть бесплатным для всех, кто им пользуется. Значит «ум» агента -
 * это детерминированный движок в браузере: разбор запроса на русском, узбекском и
 * английском, состояние диалога (точка, зона, последний слой, последний радиус),
 * уточняющие вопросы и пересказ по шаблонам. Настоящую языковую модель на этом хостинге
 * (PHP 7.2, без GPU) запустить нельзя, и делать вид, что это она, не нужно: для задач
 * «радиус, население, здания, дороги, полигон, объединить, покрасить» детерминированный
 * разбор точнее модели, потому что он не ошибается в числах и не выдумывает.
 *
 * ── Числа считают инструменты, у каждого числа есть происхождение
 *
 * Население - по сетке H3 (Kontur) с калибровкой на официальное население районов
 * (Toshstat 01.01.2026); сама сетка помечена «проверить источник», поэтому число всегда
 * идёт с уверенностью «расчёт» и примечанием. Здания и дороги - OpenStreetMap через
 * Overpass (ODbL, атрибуция обязательна и показывается). Конкуренты - база БЦ CASE.
 * Счёт в круге - по доле площади ячейки внутри круга (пересечение дисков), в полигоне -
 * по подвыборке точек ячейки. Площадь объединённой зоны - сеточной выборкой.
 *
 * ── Точка без привязки к проектам CASE
 *
 * Агентом будут пользоваться не сотрудники, а клиенты, и им список проектов CASE не нужен.
 * Точка задаётся кликом по карте (кнопка «Точка»), координатами в строке запроса или
 * адресом (геокодер Nominatim через api/gis_proxy.php, бесплатно, с кэшем на сервере).
 *
 * ── Зона
 *
 * Зона - набор фигур: круги, изохрона, полигоны, нарисованные кликами или заданные
 * координатами. «Объединить» делает из них одну зону: счёт «в зоне» берёт точку, если она
 * попала хотя бы в одну фигуру. Геометрического объединения контуров здесь нет намеренно:
 * для счёта оно не нужно, а площадь объединения считается выборкой точек.
 *
 * Модуль живёт внутри iframe студии, как v4630-huff.js: рисует на глобальной карте map,
 * читает сетку из CASE_GEO_DATA, к серверу ходит GET-запросами с cookie (CSRF не нужен).
 */
(function () {
  'use strict';
  if (window.CASE_GEO_AGENT) return;

  var VERSION = '4.75.0';
  var RADIUS_MAX = 3000;

  var ST = {
    site: null,                 /* {lat, lon, name} */
    zone: [],                   /* фигуры: {kind:'circle',lat,lon,r,label} | {kind:'polygon',ring:[[lat,lon]...],label} */
    merged: false,
    groups: {},
    data: { buildings: null, roads: null },
    styles: {
      buildings: { color: '#9E0000', fill: '#9E0000', opacity: 0.30, weight: 1 },
      roads:     { color: '#34495e', fill: '#34495e', opacity: 0.90, weight: 2.5 },
      zone:      { color: '#9E0000', fill: '#9E0000', opacity: 0.07, weight: 2 },
      selection: { color: '#f2b90d', fill: '#f2b90d', opacity: 0.55, weight: 2 },
      site:      { color: '#9E0000', fill: '#ffffff', opacity: 1, weight: 3 }
    },
    lastLayer: null, lastRadius: 1000, lastIntents: [],
    draw: null,                 /* {pts:[]} пока рисуем полигон */
    pick: false, probeWas: null, dblWas: null,
    lang: 'ru', busy: false, cellArea: null, log: []
  };

  /* ── Помощники ───────────────────────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { var n = +v; return Number.isFinite(n) ? n : null; }
  function fmt(n) { return n == null ? '-' : Math.round(n).toLocaleString('ru'); }
  function hexOk(c) { return typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c); }
  function mapObj() { try { return (typeof map !== 'undefined' && map) ? map : null; } catch (e) { return null; } }
  function hasL() { return typeof L !== 'undefined' && !!mapObj(); }
  function geoData() { return window.CASE_GEO_DATA || null; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function distKm(a, b, c, d) {
    var R = 6371, r = function (x) { return x * Math.PI / 180; };
    var s = Math.pow(Math.sin(r(c - a) / 2), 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.pow(Math.sin(r(d - b) / 2), 2);
    return R * 2 * Math.asin(Math.sqrt(s));
  }
  function clampRadius(m) { var n = num(m); if (n == null || n <= 0) return ST.lastRadius || 1000; return Math.max(50, Math.min(RADIUS_MAX, Math.round(n))); }
  function group(name) { var M = mapObj(); if (!M) return null; if (!ST.groups[name]) ST.groups[name] = L.layerGroup().addTo(M); return ST.groups[name]; }
  function clearGroup(name) { if (ST.groups[name]) ST.groups[name].clearLayers(); }
  function humanM(r) { return r >= 1000 ? (Math.round(r / 100) / 10) + ' км' : r + ' м'; }

  /* ── Геометрия ────────────────────────────────────────────────────────────── */

  function inRing(lat, lon, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var yi = ring[i][0], xi = ring[i][1], yj = ring[j][0], xj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inShape(lat, lon, s) {
    if (s.kind === 'circle') return distKm(lat, lon, s.lat, s.lon) * 1000 <= s.r;
    return inRing(lat, lon, s.ring);
  }
  /* Текущая зона: все фигуры, если объединены; иначе последняя нарисованная. */
  function zoneShapes() { if (!ST.zone.length) return []; return ST.merged ? ST.zone.slice() : [ST.zone[ST.zone.length - 1]]; }
  function inZone(lat, lon, shapes) { shapes = shapes || zoneShapes(); for (var i = 0; i < shapes.length; i++) if (inShape(lat, lon, shapes[i])) return true; return false; }
  function shapeBbox(s) {
    if (s.kind === 'circle') { var dLat = s.r / 111320, dLon = s.r / (111320 * Math.cos(s.lat * Math.PI / 180)); return [s.lat - dLat, s.lon - dLon, s.lat + dLat, s.lon + dLon]; }
    var b = [90, 180, -90, -180]; s.ring.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; }); return b;
  }
  function zoneBbox(shapes) { var b = [90, 180, -90, -180]; shapes.forEach(function (s) { var x = shapeBbox(s); b[0] = Math.min(b[0], x[0]); b[1] = Math.min(b[1], x[1]); b[2] = Math.max(b[2], x[2]); b[3] = Math.max(b[3], x[3]); }); return b; }
  /* Площадь зоны сеточной выборкой N×N по рамке. Объединение контуров не нужно: точка либо
     попала хотя бы в одну фигуру, либо нет. Точность около 1% при N=160. */
  function zoneAreaM2(shapes, N) {
    N = N || 160; if (!shapes.length) return 0;
    var b = zoneBbox(shapes), kx = 111320 * Math.cos(((b[0] + b[2]) / 2) * Math.PI / 180), ky = 111320;
    var w = (b[3] - b[1]) * kx, h = (b[2] - b[0]) * ky, hit = 0;
    for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) {
      var lat = b[0] + (i + 0.5) / N * (b[2] - b[0]), lon = b[1] + (j + 0.5) / N * (b[3] - b[1]);
      if (inZone(lat, lon, shapes)) hit++;
    }
    return Math.round(w * h * hit / (N * N));
  }
  function ringAreaM2(ring) {
    var lat0 = ring[0][0], kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111320, s = 0;
    for (var i = 0; i < ring.length; i++) { var a = ring[i], b = ring[(i + 1) % ring.length]; s += (a[1] * kx) * (b[0] * ky) - (b[1] * kx) * (a[0] * ky); }
    return Math.abs(s) / 2;
  }
  /* Центр и радиус запроса к прокси: рамка зоны целиком. */
  function zoneFetchSpec(shapes) {
    var b = zoneBbox(shapes), lat = (b[0] + b[2]) / 2, lon = (b[1] + b[3]) / 2;
    var r = Math.ceil(distKm(lat, lon, b[2], b[3]) * 1000);
    return { lat: lat, lon: lon, r: Math.max(50, Math.min(RADIUS_MAX, r)) };
  }
  function lineNearM(line, lat, lon) {
    var kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 111320, best = Infinity;
    for (var i = 0; i < (line || []).length; i++) {
      var ax = (line[i][1] - lon) * kx, ay = (line[i][0] - lat) * ky, d = Math.sqrt(ax * ax + ay * ay); if (d < best) best = d;
      if (i === 0) continue;
      var bx = (line[i - 1][1] - lon) * kx, by = (line[i - 1][0] - lat) * ky, vx = ax - bx, vy = ay - by, len2 = vx * vx + vy * vy;
      if (!len2) continue;
      var u = -(bx * vx + by * vy) / len2;
      if (u > 0 && u < 1) { var px = bx + u * vx, py = by + u * vy, dd = Math.sqrt(px * px + py * py); if (dd < best) best = dd; }
    }
    return best;
  }
  /* Дорога в зоне: хотя бы одна точка ломаной или её отрезков с шагом 60 м попала в зону. */
  function lineInZone(line, shapes) {
    for (var i = 0; i < line.length; i++) {
      if (inZone(line[i][0], line[i][1], shapes)) return true;
      if (i === 0) continue;
      var d = distKm(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]) * 1000, n = Math.floor(d / 60);
      for (var k = 1; k < n; k++) { var t = k / n; if (inZone(line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t, shapes)) return true; }
    }
    return false;
  }
  function lineKm(line) { var s = 0; for (var i = 1; i < (line || []).length; i++) s += distKm(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]); return s; }

  /* ── Население ─────────────────────────────────────────────────────────────── */

  function cellAreaM2(pop) {
    if (ST.cellArea) return ST.cellArea;
    var n = pop.length, ds = [];
    if (n < 10) return ST.cellArea = 737000;
    var step = Math.max(1, Math.floor(n / 150));
    for (var i = 0; i < n; i += step) {
      var a = pop[i], best = Infinity;
      for (var j = 0; j < n; j++) { if (j === i) continue; var b = pop[j]; if (Math.abs(b[0] - a[0]) > 0.02 || Math.abs(b[1] - a[1]) > 0.03) continue; var d = distKm(a[0], a[1], b[0], b[1]); if (d > 0 && d < best) best = d; }
      if (best < Infinity) ds.push(best);
    }
    if (!ds.length) return ST.cellArea = 737000;
    ds.sort(function (x, y) { return x - y; });
    var dm = ds[Math.floor(ds.length / 2)] * 1000;
    return ST.cellArea = Math.round(Math.sqrt(3) / 2 * dm * dm);
  }
  function lens(R, r, d) {
    if (d >= R + r) return 0;
    if (d <= Math.abs(R - r)) return Math.PI * Math.min(R, r) * Math.min(R, r);
    return r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r)) + R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R)) - 0.5 * Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
  }
  function popInRadius(lat, lon, radiusM, pop) {
    var area = cellAreaM2(pop), rc = Math.sqrt(area / Math.PI), sum = 0, cells = 0;
    for (var i = 0; i < pop.length; i++) {
      var h = pop[i], d = distKm(lat, lon, h[0], h[1]) * 1000;
      if (d >= radiusM + rc) continue;
      var f = lens(radiusM, rc, d) / (Math.PI * rc * rc); if (f <= 0) continue;
      sum += h[2] * f; cells++;
    }
    return { population: Math.round(sum), cells: cells, cellAreaM2: area };
  }
  /* Полигон и объединённая зона: ячейка представлена сеткой 4×4 точек внутри её диска;
     доля попавших точек - доля ячейки в зоне. */
  function popInZone(shapes, pop) {
    var area = cellAreaM2(pop), rc = Math.sqrt(area / Math.PI), sum = 0, cells = 0;
    var b = zoneBbox(shapes), padLat = rc / 111320, padLon = rc / (111320 * Math.cos(((b[0] + b[2]) / 2) * Math.PI / 180));
    for (var i = 0; i < pop.length; i++) {
      var h = pop[i];
      if (h[0] < b[0] - padLat || h[0] > b[2] + padLat || h[1] < b[1] - padLon || h[1] > b[3] + padLon) continue;
      var hit = 0, tot = 0, dLat = rc / 111320, dLon = rc / (111320 * Math.cos(h[0] * Math.PI / 180));
      for (var a = 0; a < 4; a++) for (var c = 0; c < 4; c++) {
        var u = (a + 0.5) / 4 * 2 - 1, v = (c + 0.5) / 4 * 2 - 1; if (u * u + v * v > 1) continue;
        tot++; if (inZone(h[0] + u * dLat, h[1] + v * dLon, shapes)) hit++;
      }
      if (hit) { sum += h[2] * hit / tot; cells++; }
    }
    return { population: Math.round(sum), cells: cells, cellAreaM2: area };
  }
  function ensureCalibrated() {
    try {
      if (typeof CAL !== 'undefined' && CAL) return Promise.resolve();
      if (typeof ensureGeo === 'function' && typeof calibrate === 'function') return ensureGeo().then(function () { calibrate(); });
    } catch (e) {}
    return Promise.resolve();
  }
  function popProv(what) {
    var calibrated = false; try { calibrated = (typeof CAL !== 'undefined' && !!CAL); } catch (e) {}
    return { conf: 'modelled', source: 'Сетка населения H3 (Kontur), ' + (calibrated ? 'откалибрована на официальное население районов (Toshstat, 01.01.2026)' : 'БЕЗ калибровки на районы'),
      method: what, at: today(), note: 'Источник сетки помечен «проверить»; распределение внутри района не подтверждено. Для решения брать как порядок величины, не как факт.' };
  }

  /* ── Сеть ──────────────────────────────────────────────────────────────────── */

  function getJSON(url) {
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (rs) {
      return rs.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!j) throw new Error('сервер ответил не JSON (HTTP ' + rs.status + '): ' + t.slice(0, 120));
        if (!j.ok) throw new Error(j.message || j.error || ('HTTP ' + rs.status));
        return j;
      });
    });
  }
  function fetchProxy(mode, spec, classes) {
    return getJSON('api/gis_proxy.php?mode=' + mode + '&provider=osm&lat=' + spec.lat + '&lon=' + spec.lon + '&radius_m=' + spec.r + (classes && classes.length ? '&classes=' + encodeURIComponent(classes.join(',')) : ''));
  }
  function provFrom(p, what) {
    p = p || {};
    return { conf: p.conf || 'asking', source: (p.source || 'OpenStreetMap') + ' (' + (p.licence || 'ODbL') + ')', attribution: p.attribution || '© OpenStreetMap contributors',
      method: (p.method || 'Overpass API') + (p.cached ? ', из кэша сервера' : '') + (what ? '; ' + what : ''), at: (p.fetched_at || today()).slice(0, 10) };
  }

  /* ── Отрисовка ───────────────────────────────────────────────────────────── */

  /* v4.73.1: точка агента и «точка анализа» студии - одно и то же. Если студия даёт хук
     caseGeoSetPoint, точку ставим через него (студия рисует свою метку со звездой и подписью,
     показывает район и считает по ней отчёт и выгрузку), а свою метку не дублируем. */
  function studioHook() { return typeof window.caseGeoSetPoint === 'function' ? window.caseGeoSetPoint : null; }
  function drawSite() {
    if (!hasL() || !ST.site) return;
    var g = group('site'); g.clearLayers(); var st = ST.styles.site;
    if (studioHook()) return;
    L.circleMarker([ST.site.lat, ST.site.lon], { radius: 8, color: st.color, weight: st.weight, fillColor: st.fill, fillOpacity: 1 }).bindTooltip(esc(ST.site.name || 'точка')).addTo(g);
  }
  function syncStudioPoint() {
    var hook = studioHook(); if (!hook || !ST.site) return;
    try { var r = hook(ST.site.lat, ST.site.lon, ST.site.name); if (r && r.district) ST.site.district = r.district; } catch (e) {}
  }
  function renderZone() {
    if (!hasL()) return;
    var g = group('zone'); g.clearLayers(); var st = ST.styles.zone;
    var cur = zoneShapes();
    ST.zone.forEach(function (s) {
      var active = cur.indexOf(s) >= 0;
      var o = { color: st.color, weight: active ? st.weight : 1, opacity: active ? 0.95 : 0.5, fillColor: st.fill, fillOpacity: active ? st.opacity : 0.02, dashArray: active ? null : '4' };
      var l = s.kind === 'circle' ? L.circle([s.lat, s.lon], Object.assign({ radius: s.r }, o)) : L.polygon(s.ring, o);
      l.bindTooltip(esc(s.label || (s.kind === 'circle' ? humanM(s.r) : 'полигон')), { sticky: true }).addTo(g);
    });
  }
  function renderDraw() {
    if (!hasL()) return;
    var g = group('draw'); g.clearLayers(); if (!ST.draw) return;
    var pts = ST.draw.pts;
    if (pts.length > 1) L.polyline(pts, { color: '#9E0000', weight: 2, dashArray: '5' }).addTo(g);
    pts.forEach(function (p) { L.circleMarker(p, { radius: 4, color: '#9E0000', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(g); });
  }
  function renderBuildings() {
    if (!hasL()) return;
    var g = group('buildings'); g.clearLayers(); var st = ST.styles.buildings;
    (ST.data.buildings || []).forEach(function (b) {
      if (!b.ring || b.ring.length < 3) return;
      var tip = '<b>' + esc(b.name || (b.kind || 'здание')) + '</b>' + (b.levels != null ? '<br>этажей: ' + b.levels : '') + (b.area ? '<br>пятно: ' + fmt(b.area) + ' м²' : '') + (b.addr ? '<br>' + esc(b.addr) : '');
      L.polygon(b.ring, { color: st.color, weight: st.weight, opacity: 0.9, fillColor: st.fill, fillOpacity: st.opacity }).bindTooltip(tip, { sticky: true }).addTo(g);
    });
  }
  function renderRoads() {
    if (!hasL()) return;
    var g = group('roads'); g.clearLayers(); var st = ST.styles.roads;
    (ST.data.roads || []).forEach(function (w) {
      var wt = st.weight * (/motorway|trunk|primary/.test(w.cls) ? 1.6 : /secondary|tertiary/.test(w.cls) ? 1.2 : 0.8);
      L.polyline(w.line, { color: st.color, weight: wt, opacity: st.opacity, lineJoin: 'round', lineCap: 'round' }).bindTooltip('<b>' + esc(w.name || 'без названия') + '</b><br>' + esc(w.cls) + (w.oneway ? ' · одностороннее' : ''), { sticky: true }).addTo(g);
    });
  }
  function renderSelection(layer, hit) {
    if (!hasL()) return;
    var g = group('selection'); g.clearLayers(); var st = ST.styles.selection;
    hit.forEach(function (f) { if (layer === 'buildings') L.polygon(f.ring, { color: st.color, weight: st.weight, opacity: 1, fillColor: st.fill, fillOpacity: st.opacity }).addTo(g); else L.polyline(f.line, { color: st.color, weight: st.weight + 2, opacity: 1 }).addTo(g); });
  }
  function restyle(layer) {
    if (layer === 'buildings') return renderBuildings();
    if (layer === 'roads') return renderRoads();
    if (layer === 'zone') return renderZone();
    var st = ST.styles[layer], g = ST.groups[layer]; if (!g) return;
    g.eachLayer(function (l) { try { l.setStyle({ color: st.color, fillColor: st.fill, fillOpacity: st.opacity, weight: st.weight }); } catch (e) {} });
  }
  function fitZone() { try { var b = zoneBbox(zoneShapes()); mapObj().fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: [20, 20] }); } catch (e) {} }

  /* ── Режимы карты: точка и полигон ───────────────────────────────────────── */

  /* Клик по карте в студии одновременно открывает «отчёт по точке» (флажок lProbe). На время
     выбора точки и рисования полигона флажок снимается и потом возвращается, иначе каждый
     клик агента открывал бы посторонний отчёт. Пока студия сама рисует зону (ZMODE), агент
     клики не трогает. */
  function suspendProbe() { var cb = $('lProbe'); if (cb && ST.probeWas === null) { ST.probeWas = cb.checked; cb.checked = false; } }
  function resumeProbe() { var cb = $('lProbe'); if (cb && ST.probeWas !== null) { cb.checked = ST.probeWas; ST.probeWas = null; } }
  function studioDrawing() { try { return typeof ZMODE !== 'undefined' && !!ZMODE; } catch (e) { return false; } }

  function setPick(on) {
    ST.pick = !!on;
    var b = $('gaPick'); if (b) { b.classList.toggle('on', ST.pick); b.textContent = ST.pick ? T('pickOn') : T('pickBtn'); }
    if (ST.pick) suspendProbe(); else if (!ST.draw) resumeProbe();
  }
  function startDraw() {
    ST.draw = { pts: [] }; suspendProbe();
    var M = mapObj(); if (M && M.doubleClickZoom) { ST.dblWas = M.doubleClickZoom.enabled(); M.doubleClickZoom.disable(); }
    var b = $('gaDone'); if (b) b.disabled = false;
    renderDraw();
  }
  function stopDraw() {
    ST.draw = null; clearGroup('draw');
    var M = mapObj(); if (M && M.doubleClickZoom && ST.dblWas) M.doubleClickZoom.enable(); ST.dblWas = null;
    var b = $('gaDone'); if (b) b.disabled = true;
    if (!ST.pick) resumeProbe();
  }
  function onMapClick(e) {
    if (studioDrawing()) return;
    if (ST.draw) { ST.draw.pts.push([e.latlng.lat, e.latlng.lng]); renderDraw(); say('sys', T('vertex', ST.draw.pts.length)); return; }
    if (!ST.pick) return;
    setPick(false);
    run('set_site', { lat: e.latlng.lat, lon: e.latlng.lng, name: T('mapPoint') }).then(function (res) { say('fact', factHtml('set_site', res)); say('ai', narrative([{ name: 'set_site', res: res }])); siteLabel(); });
  }
  function onMapDbl(e) { if (ST.draw) { try { L.DomEvent.stop(e); } catch (x) {} run('finish_polygon', {}).then(function (res) { say('fact', factHtml('finish_polygon', res)); say('ai', narrative([{ name: 'finish_polygon', res: res }])); }, function (err) { say('err', esc(err.message)); }); } }

  /* ── Инструменты ──────────────────────────────────────────────────────────── */

  function needSite() { if (!ST.site) throw new Error(T('needSite')); return ST.site; }
  function needZone() { var s = zoneShapes(); if (!s.length) throw new Error(T('needZone')); return s; }
  function addShape(s) { ST.zone.push(s); renderZone(); }

  /* v4.78.0: снять точку анализа (кнопка в студии, меню карты, фраза «убери точку») */
  function clearSite() { var had = !!ST.site; ST.site = null; clearGroup('site'); return had; }
  /* v4.78.0: зоны по времени в пути: рисование из ST.catchment (цвета и скрытые зоны меняются без пересчёта)
     и режим «метро и пешком»: Дейкстра по станциям линий студии (2ГИС). Нормативы: пешком 5 км/ч
     (83 м/мин), ожидание поезда 3 мин, перегон 2,5 мин, пересадка 4 мин между станциями разных линий
     ближе 300 м. Зона за T минут = круг пешей досягаемости от точки плюс круги вокруг станций, куда
     успеваешь доехать, радиусом на оставшиеся минуты. Оценка, не расписание. */
  var WALK_M_MIN = 83, HOP_MIN = 2.5, TRANSFER_MIN = 4, WAIT_MIN = 3;
  function metroLines() { try { return (typeof METRO !== 'undefined' && Array.isArray(METRO)) ? METRO : []; } catch (e) { return []; } }
  function metroReach(s) {
    var nodes = [];
    metroLines().forEach(function (l, li) { (l.s || []).forEach(function (x, si) { if (isFinite(+x[0]) && isFinite(+x[1])) nodes.push({ lat: +x[0], lon: +x[1], name: x[2] || '', li: li, si: si, line: l.n || '' }); }); });
    if (!nodes.length) return null;
    var n = nodes.length, adj = nodes.map(function () { return []; });
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { if (i === j) continue; var a = nodes[i], b = nodes[j]; if (a.li === b.li && Math.abs(a.si - b.si) === 1) adj[i].push([j, HOP_MIN]); else if (a.li !== b.li && distKm(a.lat, a.lon, b.lat, b.lon) * 1000 <= 300) adj[i].push([j, TRANSFER_MIN]); }
    var t = nodes.map(function (nd) { return distKm(s.lat, s.lon, nd.lat, nd.lon) * 1000 / WALK_M_MIN + WAIT_MIN; }), done = nodes.map(function () { return false; });
    for (var k = 0; k < n; k++) { var best = -1; for (var q = 0; q < n; q++) if (!done[q] && (best < 0 || t[q] < t[best])) best = q; if (best < 0) break; done[best] = true; adj[best].forEach(function (e) { if (t[best] + e[1] < t[e[0]]) t[e[0]] = t[best] + e[1]; }); }
    return nodes.map(function (nd, i) { return { lat: nd.lat, lon: nd.lon, name: nd.name, line: nd.line, min: t[i] }; });
  }
  function metroShapes(s, mins, reach) {
    return mins.map(function (T) {
      var shapes = [{ kind: 'circle', lat: s.lat, lon: s.lon, r: T * WALK_M_MIN, label: 'пешком от точки ' + T + ' мин' }], st = [];
      reach.slice().sort(function (a, b) { return a.min - b.min; }).forEach(function (r) { var left = T - r.min; if (left * WALK_M_MIN < 60) return; shapes.push({ kind: 'circle', lat: r.lat, lon: r.lon, r: Math.round(left * WALK_M_MIN), label: r.name + ' (' + r.line + '): ' + Math.round(r.min) + ' мин, пешком ещё ' + Math.round(left) + ' мин' }); st.push(r.name); });
      return { shapes: shapes, stations: st };
    });
  }
  var CATCH_COLS = ['#9E0000', '#e67e22', '#2980b9'], CATCH_NAMES = ['PTA', 'STA', 'TTA'];
  function drawCatchment() {
    var c = ST.catchment, grp = group('catchment'); if (!grp) return; grp.clearLayers(); if (!c) return;
    c.shapes.forEach(function (sh, i) {
      if (c.hidden && c.hidden[i]) return;
      var col = (c.colors && /^#[0-9a-f]{6}$/i.test(c.colors[i] || '')) ? c.colors[i] : CATCH_COLS[i], z = c.zones[i];
      var tip = CATCH_NAMES[i] + ' · ' + c.minutes[i] + ' мин · ' + fmt(z.population) + ' жит.';
      sh.forEach(function (s, k) {
        var o = { color: col, weight: k === 0 ? 2 : 1, opacity: k === 0 ? .95 : .7, fillColor: col, fillOpacity: k === 0 ? .07 : .05, dashArray: i ? '5' : null };
        var l = s.kind === 'circle' ? L.circle([s.lat, s.lon], Object.assign({ radius: s.r }, o)) : L.polygon(s.ring, o);
        l.addTo(grp).bindTooltip(tip + (k && s.label ? ' · ' + esc(s.label) : ''), { sticky: true });
      });
    });
  }
  function recolorCatchment(colors, hidden) { if (!ST.catchment) return false; if (Array.isArray(colors)) ST.catchment.colors = colors.slice(0, 3); if (Array.isArray(hidden)) ST.catchment.hidden = hidden.slice(0, 3); drawCatchment(); return true; }
  var TOOLS = {
    clear_site: function () {
      var had = clearSite();
      try { if (typeof window.caseGeoClearPoint === 'function') window.caseGeoClearPoint(); } catch (e) {}
      return Promise.resolve({ ok: true, had: had });
    },
    set_site: function (inp) {
      inp = inp || {};
      if (inp.address) {
        var q = String(inp.address).trim();
        return getJSON('api/gis_proxy.php?mode=geocode&q=' + encodeURIComponent(q)).then(function (j) {
          var rs = j.results || [];
          if (!rs.length) throw new Error(T('noGeo', q));
          var r0 = rs[0];
          ST.site = { lat: +r0.lat, lon: +r0.lon, name: r0.name || q }; drawSite(); syncStudioPoint();
          var M = mapObj(); if (M) try { M.setView([ST.site.lat, ST.site.lon], Math.max(M.getZoom(), 15)); } catch (e) {}
          return { ok: true, site: ST.site, query: q, candidates: rs.slice(0, 3).map(function (r) { return { name: r.name, lat: +r.lat, lon: +r.lon }; }), provenance: { conf: 'asking', source: 'Nominatim (OpenStreetMap), ODbL', method: 'поиск по адресу, взят первый результат', at: today() } };
        });
      }
      if (num(inp.lat) == null || num(inp.lon) == null || Math.abs(+inp.lat) > 90 || Math.abs(+inp.lon) > 180) throw new Error(T('needSite'));
      ST.site = { lat: +inp.lat, lon: +inp.lon, name: inp.name || T('point') }; drawSite(); syncStudioPoint();
      var M = mapObj(); if (M) try { M.setView([ST.site.lat, ST.site.lon], Math.max(M.getZoom(), 14)); } catch (e) {}
      return Promise.resolve({ ok: true, site: ST.site });
    },

    draw_radius: function (inp) {
      var s = needSite();
      var radii = (Array.isArray(inp && inp.radii_m) ? inp.radii_m : [inp && inp.radius_m]).map(clampRadius).filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
      if (inp && hexOk(inp.color)) { ST.styles.zone.color = inp.color; ST.styles.zone.fill = inp.color; }
      /* Новые круги заменяют прежние круги вокруг этой же точки, полигоны и изохроны остаются. */
      ST.zone = ST.zone.filter(function (z) { return !(z.kind === 'circle' && z.auto); });
      radii.forEach(function (r) { ST.zone.push({ kind: 'circle', lat: s.lat, lon: s.lon, r: r, label: humanM(r), auto: true }); });
      ST.lastRadius = radii[radii.length - 1]; renderZone(); fitZone();
      return Promise.resolve({ ok: true, radii_m: radii });
    },

    draw_isochrone: function (inp) {
      var s = needSite(), minutes = Math.max(1, Math.min(60, Math.round(num(inp && inp.minutes) || 10)));
      if (typeof isochrone !== 'function') return Promise.reject(new Error(T('noIso')));
      return Promise.resolve(isochrone(s.lat, s.lon, minutes)).then(function () {
        var g = null; try { g = (typeof gIso !== 'undefined') ? gIso : null; } catch (e) {}
        var ring = null; if (g) g.eachLayer(function (l) { try { var ll = l.getLatLngs(); ll = Array.isArray(ll[0]) ? ll[0] : ll; if (ll.length >= 3) ring = ll.map(function (p) { return [p.lat, p.lng]; }); } catch (e) {} });
        if (!ring) throw new Error(T('isoFail'));
        try { g.clearLayers(); } catch (e) {}
        addShape({ kind: 'polygon', ring: ring, label: minutes + ' мин' }); fitZone();
        return { ok: true, minutes: minutes, area_m2: Math.round(ringAreaM2(ring)), provenance: { conf: 'modelled', source: 'OSRM (project-osrm.org), дороги OSM', method: '24 луча, время в пути по матрице OSRM за ' + minutes + ' мин', at: today() } };
      });
    },

    draw_polygon: function (inp) {
      inp = inp || {};
      if (Array.isArray(inp.points) && inp.points.length >= 3) {
        var ring = inp.points.map(function (p) { return [+p[0], +p[1]]; }).filter(function (p) { return Number.isFinite(p[0]) && Number.isFinite(p[1]); });
        if (ring.length < 3) throw new Error(T('needPts'));
        addShape({ kind: 'polygon', ring: ring, label: T('polygon') }); fitZone();
        return Promise.resolve({ ok: true, points: ring.length, area_m2: Math.round(ringAreaM2(ring)), drawn: true });
      }
      startDraw();
      return Promise.resolve({ ok: true, drawing: true });
    },
    finish_polygon: function () {
      if (!ST.draw) throw new Error(T('notDrawing'));
      if (ST.draw.pts.length < 3) throw new Error(T('needPts'));
      var ring = ST.draw.pts.slice(); stopDraw();
      addShape({ kind: 'polygon', ring: ring, label: T('polygon') }); fitZone();
      return Promise.resolve({ ok: true, points: ring.length, area_m2: Math.round(ringAreaM2(ring)), drawn: true });
    },
    cancel_polygon: function () { var was = !!ST.draw; stopDraw(); return Promise.resolve({ ok: true, cancelled: was }); },

    /* v4.75.0: круг с произвольным центром (инструмент «буфер» на панели карты, правый клик) */
    draw_circle: function (inp) {
      inp = inp || {};
      var lat = num(inp.lat), lon = num(inp.lon), r = clampRadius(inp.radius_m);
      if (lat == null || lon == null) { var s0 = needSite(); lat = s0.lat; lon = s0.lon; }
      if (hexOk(inp.color)) { ST.styles.zone.color = inp.color; ST.styles.zone.fill = inp.color; }
      addShape({ kind: 'circle', lat: lat, lon: lon, r: r, label: inp.label || humanM(r) }); fitZone();
      return Promise.resolve({ ok: true, lat: lat, lon: lon, radius_m: r, area_m2: Math.round(Math.PI * r * r), drawn: true });
    },

    /* v4.75.0: зоны охвата по методике CASE (PTA / STA / TTA по времени в пути на авто,
       население по сетке, домохозяйства 4,5 чел., RDE $349/чел/год для Ташкента, capture rate
       от GLA и ставки при rent-to-sales 15%). Всё помечено как расчёт и сопровождается списком
       требуемых входных данных: доходы по зонам и опрос жителей в базе отсутствуют. */
    catchment: function (inp) {
      inp = inp || {};
      var s = needSite();
      var DEF = { regional: [10, 20, 30], community: [5, 10, 15], convenience: [3, 6, 10], office: [5, 10, 15] };
      var format = DEF[inp.format] ? inp.format : 'regional';
      var mins = (Array.isArray(inp.minutes) && inp.minutes.length ? inp.minutes : DEF[format]).map(function (m) { return Math.max(1, Math.min(60, Math.round(+m) || 0)); }).filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }).slice(0, 3);
      while (mins.length < 3) mins.push((mins[mins.length - 1] || 10) + 10);
      var HH = 4.5, RDE_PP_USD = 349, SHARES = [0.75, 0.20, 0.05], R2S = 0.15;
      var gla = num(inp.gla_m2), rent = num(inp.rent_usd_m2_month);
      /* v4.78.0 (замечание владельца): режим «метро и пешком», свои цвета и скрытые зоны из раздела «Зона охвата» */
      var want = inp.mode === 'metro' ? 'metro' : 'car';
      var colors = Array.isArray(inp.colors) ? inp.colors.slice(0, 3) : null, hidden = Array.isArray(inp.hidden) ? inp.hidden.slice(0, 3) : null;
      var rings = [], mode = want === 'metro' ? 'metro' : 'isochrone', metroInfo = null;
      function circleRing(rM) { var out = [], n = 48; for (var i = 0; i < n; i++) { var th = i / n * 2 * Math.PI; out.push([s.lat + rM / 111320 * Math.cos(th), s.lon + rM / (111320 * Math.cos(s.lat * Math.PI / 180)) * Math.sin(th)]); } return out; }
      function isoRing(m) {
        if (typeof isochrone !== 'function') return Promise.resolve(null);
        return Promise.resolve().then(function () { return isochrone(s.lat, s.lon, m); }).then(function () {
          var gi = null; try { gi = (typeof gIso !== 'undefined') ? gIso : null; } catch (e) {}
          var ring = null; if (gi) gi.eachLayer(function (l) { try { var ll = l.getLatLngs(); ll = Array.isArray(ll[0]) ? ll[0] : ll; if (ll.length >= 3) ring = ll.map(function (p) { return [p.lat, p.lng]; }); } catch (e) {} });
          try { if (gi) gi.clearLayers(); } catch (e) {}
          return ring;
        }, function () { return null; });
      }
      var chain = Promise.resolve();
      if (want === 'metro') {
        var reach = metroReach(s); if (!reach) throw new Error('Линии метро не загружены: зоны по метро недоступны');
        metroInfo = metroShapes(s, mins, reach);
      } else mins.forEach(function (m) { chain = chain.then(function () { if (mode !== 'isochrone') { rings.push(null); return; } return isoRing(m).then(function (r) { if (!r) mode = 'radius'; rings.push(r); }); }); });
      return chain.then(ensureCalibrated).then(function () {
        var g = geoData(), pop = g && Array.isArray(g.POP) ? g.POP : null;
        if (!pop || !pop.length) throw new Error(T('noPop'));
        if (mode === 'radius') rings = mins.map(function (m) { return circleRing(m * 400); });
        var shapesPer = mode === 'metro' ? metroInfo.map(function (z) { return z.shapes; }) : rings.map(function (r) { return [{ kind: 'polygon', ring: r }]; });
        var NAMES = ['PTA', 'STA', 'TTA'], RU = ['первичная', 'вторичная', 'третичная'];
        var cum = shapesPer.map(function (sh) { return popInZone(sh, pop).population; });
        var zones = shapesPer.map(function (sh, i) {
          var band = Math.max(0, cum[i] - (i ? cum[i - 1] : 0)), hh = band / HH, rde = band * RDE_PP_USD;
          var z = { name: NAMES[i], name_ru: RU[i], minutes: mins[i], population: Math.round(band), cum_population: Math.round(cum[i]), households: Math.round(hh), rde_usd: Math.round(rde), share: SHARES[i] };
          if (mode === 'metro') { z.stations = metroInfo[i].stations.length; z.station_names = metroInfo[i].stations.slice(0, 12); }
          return z;
        });
        ST.catchment = { mode: mode, minutes: mins, shapes: shapesPer, zones: zones, colors: colors, hidden: hidden };
        drawCatchment();
        try { var bb = zoneBbox(shapesPer[2]); mapObj().fitBounds([[bb[0], bb[1]], [bb[2], bb[3]]], { padding: [20, 20] }); } catch (e) {}
        if (mode === 'metro') { try { var cb = document.getElementById('lMetro'); if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change')); } } catch (e) {} }
        var res = { ok: true, format: format, minutes: mins, mode: mode, zones: zones, household_size: HH, rde_per_person_usd: RDE_PP_USD, rent_to_sales: R2S,
          provenance: { conf: 'modelled', source: 'Методика CASE: PTA/STA/TTA по времени в пути (Nukus Panorama, Silk Hub); RDE $349/чел/год и capture 0,394% (Wonderland Databook, Ташкент 2024); 4,5 чел. на домохозяйство (Silk Hub)' + (mode === 'metro' ? '; линии и станции метро из базы студии (2ГИС)' : ''),
            method: mode === 'isochrone' ? 'изохроны OSRM за ' + mins.join('/') + ' мин на авто, население по сетке с калибровкой' : mode === 'metro' ? 'метро и пешком за ' + mins.join('/') + ' мин: пешком 5 км/ч, ожидание поезда 3 мин, перегон 2,5 мин, пересадка 4 мин; зона = круги досягаемости вокруг точки и вокруг станций, куда успеваешь доехать; население по сетке с калибровкой' : 'маршрутизатор недоступен: радиусы ' + mins.map(function (m) { return (m * 0.4).toFixed(1); }).join('/') + ' км (0,4 км за минуту в городе)',
            note: 'Границы без коррекции на барьеры (ж/д, река, каналы, заторы): поправьте полигон инструментом. Доходы по национальной структуре расходов, а не по опросу зоны. Оценка, не факт.' + (mode === 'metro' ? ' Время метро по нормативам, не по расписанию.' : '') },
          inputs_needed: ['доходы домохозяйств по зонам (аналитик CASE)', 'полевой опрос жителей зоны, n не меньше 400', 'коррекция границ по барьерам и заторам', 'GLA и ставка проекта для capture rate'] };
        if (gla != null && rent != null && gla > 0 && rent > 0) {
          var turnover = gla * rent * 12 / R2S;
          res.gla_m2 = gla; res.rent_usd_m2_month = rent; res.required_turnover_usd = Math.round(turnover);
          res.captures = zones.map(function (z) { return { name: z.name, share: z.share, required_usd: Math.round(turnover * z.share), capture_rate: z.rde_usd > 0 ? turnover * z.share / z.rde_usd : null }; });
          res.inputs_needed = res.inputs_needed.slice(0, 3);
        }
        return res;
      });
    },

    merge_zones: function () {
      if (ST.zone.length < 1) throw new Error(T('needZone'));
      ST.merged = true; renderZone(); fitZone();
      var a = zoneAreaM2(ST.zone);
      return Promise.resolve({ ok: true, shapes: ST.zone.length, area_m2: a, provenance: { conf: 'modelled', source: 'CASE OS', method: 'объединение фигур: точка в зоне, если попала хотя бы в одну; площадь сеточной выборкой 160×160', at: today() } });
    },
    zone_area: function () {
      var sh = needZone(); var a = zoneAreaM2(sh);
      return Promise.resolve({ ok: true, shapes: sh.length, area_m2: a, provenance: { conf: 'modelled', source: 'CASE OS', method: 'площадь сеточной выборкой 160×160 по рамке зоны', at: today() } });
    },

    count_population: function (inp) {
      inp = inp || {};
      return ensureCalibrated().then(function () {
        var g = geoData(), pop = g && Array.isArray(g.POP) ? g.POP : null;
        if (!pop || !pop.length) throw new Error(T('noPop'));
        if (inp.zone) {
          var sh = needZone(), res = popInZone(sh, pop);
          return { ok: true, zone: true, shapes: sh.length, population: res.population, cells: res.cells, provenance: popProv('сумма по ячейкам с долей точек ячейки (4×4) внутри зоны') };
        }
        var s = needSite(), r = clampRadius(inp.radius_m), res2 = popInRadius(s.lat, s.lon, r, pop);
        ST.lastRadius = r;
        return { ok: true, radius_m: r, population: res2.population, cells: res2.cells, provenance: popProv('сумма по ячейкам с долей площади ячейки внутри круга ' + r + ' м') };
      });
    },

    load_buildings: function (inp) {
      inp = inp || {};
      if (hexOk(inp.color)) { ST.styles.buildings.color = inp.color; ST.styles.buildings.fill = inp.color; }
      var spec, filter, what;
      if (inp.zone) { var sh = needZone(); spec = zoneFetchSpec(sh); filter = function (b) { return inZone(b.c[0], b.c[1], sh); }; what = 'центроид здания внутри зоны'; }
      else { var s = needSite(), r = clampRadius(inp.radius_m); ST.lastRadius = r; spec = { lat: s.lat, lon: s.lon, r: r }; filter = function (b) { return distKm(s.lat, s.lon, b.c[0], b.c[1]) * 1000 <= r; }; what = 'центроид здания в круге ' + r + ' м'; }
      return fetchProxy('buildings', spec, null).then(function (j) {
        var rows = (j.rows || []).filter(function (b) { return b.c && filter(b); });
        ST.data.buildings = rows; ST.lastLayer = 'buildings'; renderBuildings();
        var area = 0, withLevels = 0, byKind = {}, maxLv = 0;
        rows.forEach(function (b) { area += b.area || 0; if (b.levels != null) { withLevels++; if (b.levels > maxLv) maxLv = b.levels; } var k = b.kind || 'без типа'; byKind[k] = (byKind[k] || 0) + 1; });
        var kinds = Object.keys(byKind).sort(function (a, b) { return byKind[b] - byKind[a]; }).slice(0, 6).map(function (k) { return { kind: k, count: byKind[k] }; });
        return { ok: true, zone: !!inp.zone, radius_m: inp.zone ? null : spec.r, count: rows.length, footprint_area_m2: Math.round(area), with_levels: withLevels, max_levels: maxLv || null, by_kind: kinds, truncated: !!j.truncated, provenance: provFrom(j.provenance, what) };
      });
    },

    load_roads: function (inp) {
      inp = inp || {};
      var classes = Array.isArray(inp.classes) ? inp.classes.map(String) : null;
      if (hexOk(inp.color)) { ST.styles.roads.color = inp.color; ST.styles.roads.fill = inp.color; }
      var spec, filter, what;
      if (inp.zone) { var sh = needZone(); spec = zoneFetchSpec(sh); filter = function (w) { return lineInZone(w.line || [], sh); }; what = 'участок дороги проходит через зону'; }
      else { var s = needSite(), r = clampRadius(inp.radius_m); ST.lastRadius = r; spec = { lat: s.lat, lon: s.lon, r: r }; filter = function (w) { return lineNearM(w.line, s.lat, s.lon) <= r; }; what = 'участок дороги проходит ближе ' + r + ' м к точке'; }
      return fetchProxy('roads', spec, classes).then(function (j) {
        var rows = (j.rows || []).filter(filter);
        ST.data.roads = rows; ST.lastLayer = 'roads'; renderRoads();
        var byCls = {}, lengthKm = 0;
        rows.forEach(function (w) { byCls[w.cls || '?'] = (byCls[w.cls || '?'] || 0) + 1; lengthKm += lineKm(w.line); });
        var cls = Object.keys(byCls).sort(function (a, b) { return byCls[b] - byCls[a]; }).map(function (k) { return { cls: k, count: byCls[k] }; });
        return { ok: true, zone: !!inp.zone, radius_m: inp.zone ? null : spec.r, count: rows.length, length_km: Math.round(lengthKm * 10) / 10, by_class: cls, named: rows.filter(function (w) { return w.name; }).length, truncated: !!j.truncated, provenance: provFrom(j.provenance, what) };
      });
    },

    style_layer: function (inp) {
      inp = inp || {}; var layer = String(inp.layer || ST.lastLayer || '');
      if (!ST.styles[layer]) throw new Error(T('badLayer', layer));
      var st = ST.styles[layer];
      if (hexOk(inp.color)) { st.color = inp.color; if (!hexOk(inp.fill_color)) st.fill = inp.color; }
      if (hexOk(inp.fill_color)) st.fill = inp.fill_color;
      if (num(inp.opacity) != null) st.opacity = Math.max(0, Math.min(1, +inp.opacity));
      if (num(inp.weight) != null) st.weight = Math.max(0.5, Math.min(12, +inp.weight));
      /* «Сделай здания синими. А теперь их зелёными»: «их» - последний упомянутый слой, а не
         последний загруженный. */
      if (layer === 'buildings' || layer === 'roads') ST.lastLayer = layer;
      restyle(layer); syncColorInputs();
      return Promise.resolve({ ok: true, layer: layer, style: { color: st.color, fill_color: st.fill, opacity: st.opacity, weight: st.weight } });
    },

    select_features: function (inp) {
      inp = inp || {}; var layer = String(inp.layer || ST.lastLayer || ''), src = ST.data[layer];
      if (!src) throw new Error(T('notLoaded', layer));
      if (hexOk(inp.color)) { ST.styles.selection.color = inp.color; ST.styles.selection.fill = inp.color; }
      var q = inp.name_contains ? String(inp.name_contains).toLowerCase() : '';
      var hit = src.filter(function (f) {
        if (layer === 'buildings') {
          if (num(inp.min_levels) != null && !(f.levels != null && f.levels >= +inp.min_levels)) return false;
          if (num(inp.max_levels) != null && !(f.levels != null && f.levels <= +inp.max_levels)) return false;
          if (inp.kind && !kindMatch(f.kind, String(inp.kind))) return false;
        } else if (Array.isArray(inp.classes) && inp.classes.length && inp.classes.map(String).indexOf(f.cls) < 0) return false;
        if (q && String(f.name || '').toLowerCase().indexOf(q) < 0 && String(f.addr || '').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      renderSelection(layer, hit); ST.lastLayer = layer;
      var crit = [];
      if (num(inp.min_levels) != null) crit.push('этажей >= ' + inp.min_levels);
      if (num(inp.max_levels) != null) crit.push('этажей <= ' + inp.max_levels);
      if (inp.kind) crit.push('тип ' + inp.kind);
      if (Array.isArray(inp.classes) && inp.classes.length) crit.push('классы ' + inp.classes.join(','));
      if (q) crit.push('название содержит «' + q + '»');
      return Promise.resolve({ ok: true, layer: layer, matched: hit.length, of: src.length, criteria: crit.join('; ') || 'все', note: layer === 'buildings' && (num(inp.min_levels) != null || num(inp.max_levels) != null) ? 'Этажность в OSM заполнена не у всех зданий: здания без этажности в выборку не попали.' : '' });
    },

    count_competitors: function (inp) {
      inp = inp || {};
      var g = geoData(), bc = g && Array.isArray(g.BC) ? g.BC : [], eff_ = (typeof eff === 'function') ? eff : function (x) { return x; };
      var rows = bc.map(eff_).filter(function (b) { return num(b.lat) != null && num(b.lng) != null; });
      var s = ST.site, r = null, sh = null;
      if (inp.zone) sh = needZone(); else { s = needSite(); r = clampRadius(inp.radius_m); }
      rows = rows.map(function (b) { return { name: b.name || '', dist_m: s ? Math.round(distKm(s.lat, s.lon, +b.lat, +b.lng) * 1000) : null, lat: +b.lat, lng: +b.lng, district: b.district || '' }; })
        .filter(function (b) { return sh ? inZone(b.lat, b.lng, sh) : b.dist_m <= r; }).sort(function (a, b) { return (a.dist_m || 0) - (b.dist_m || 0); });
      return Promise.resolve({ ok: true, zone: !!inp.zone, radius_m: r, business_centers: rows.length, nearest: rows.slice(0, 8).map(function (b) { return { name: b.name, dist_m: b.dist_m }; }), provenance: { conf: 'asking', source: 'база бизнес-центров CASE (2GIS, Google, Yandex, ручная сверка)', method: sh ? 'координата объекта внутри зоны' : 'расстояние по прямой от точки', at: today() } });
    },

    clear_layers: function (inp) {
      var want = Array.isArray(inp && inp.layers) && inp.layers.length ? inp.layers.map(String) : ['all'];
      var all = ['buildings', 'roads', 'zone', 'selection', 'draw', 'catchment'], done = [];
      (want.indexOf('all') >= 0 ? all : want).forEach(function (n) {
        if (n === 'zone') { ST.zone = []; ST.merged = false; try { if (typeof gIso !== 'undefined' && gIso) gIso.clearLayers(); } catch (e) {} }
        if (n === 'draw') stopDraw(); else clearGroup(n);
        if (n === 'catchment') ST.catchment = null;
        if (n === 'buildings') ST.data.buildings = null;
        if (n === 'roads') ST.data.roads = null;
        done.push(n);
      });
      if (want.indexOf('all') >= 0) { ST.lastLayer = null; }
      return Promise.resolve({ ok: true, cleared: done });
    },

    ping: function () {
      return getJSON('api/gis_proxy.php?mode=ping').then(function (j) { return { ok: true, advice: j.advice || [], facts: j.facts || {} }; });
    },
    help: function () { return Promise.resolve({ ok: true, help: true }); }
  };

  function kindMatch(kind, want) {
    kind = String(kind || '').toLowerCase(); want = want.toLowerCase();
    if (want === 'residential') return /^(residential|apartments|house|detached|dormitory|terrace|semidetached_house)$/.test(kind);
    if (want === 'commercial') return /^(commercial|retail|office|supermarket|mall|kiosk|hotel)$/.test(kind);
    return kind === want;
  }
  function run(name, input) {
    var fn = TOOLS[name]; if (!fn) return Promise.reject(new Error('Неизвестный инструмент: ' + name));
    var p; try { p = fn(input || {}); } catch (e) { return Promise.reject(e); }
    /* v4.75.0: последний результат каждого инструмента доступен другим модулям и тестам */
    return Promise.resolve(p).then(function (res) { ST.lastResults = ST.lastResults || {}; ST.lastResults[name] = res; return res; });
  }

  /* ── Движок: язык, разбор, состояние ─────────────────────────────────────── */

  var I18N = {
    ru: { pickBtn: '📍 Точка', pickOn: 'кликните по карте…', mapPoint: 'точка на карте', point: 'точка', polygon: 'полигон',
      needSite: 'Сначала укажите точку: нажмите «📍 Точка» и кликните по карте, введите координаты («41.35, 69.28») или адрес («адрес: Амира Темура 15»).',
      needZone: 'Зоны пока нет: нарисуйте радиус («радиус 1 км»), полигон («полигон», затем клики по карте и «готово») или изохрону.',
      noIso: 'Изохроны в этой сборке недоступны.', isoFail: 'Маршрутизатор недоступен, изохрону построить нельзя. Возьмите радиус: 10 минут на автомобиле в городе примерно 3-4 км.',
      needPts: 'Нужно минимум три точки полигона.', notDrawing: 'Полигон сейчас не рисуется. Скажите «полигон» и кликайте по карте.',
      noPop: 'Сетка населения не загружена.', badLayer: function (l) { return 'Неизвестный слой «' + l + '». Доступны: здания, дороги, зона, выделение.'; },
      notLoaded: function (l) { return 'Слой «' + l + '» ещё не загружен: сначала «здания 500 м» или «дороги 1 км».'; },
      noGeo: function (q) { return 'Адрес «' + q + '» не найден. Уточните: улица и дом, город.'; },
      vertex: function (n) { return 'Вершина ' + n + '. Двойной клик или «готово» - замкнуть полигон.'; },
      unknown: 'Не понял. Примеры: «радиус 1 км и население», «здания 500 м», «дороги 1 км», «полигон» (потом клики и «готово»), «объедини», «выдели дома выше 9 этажей», «сделай здания синими», «адрес: Амира Темура 15», «очистить». Скажите «помощь» для полного списка.',
      help: 'Умею: точка (клик, координаты, адрес); радиус N м/км; изохрона N минут; население (в радиусе или «в зоне»); здания и дороги (в радиусе или «в зоне»); полигон кликами или координатами; объединить фигуры в одну зону; площадь зоны; выделить дома по этажности и типу, дороги по классу; покрасить слой; конкуренты; очистить; проверить связь. Числа считают инструменты по данным с происхождением; я их пересказываю и не выдумываю.' },
    en: { pickBtn: '📍 Point', pickOn: 'click the map…', mapPoint: 'map point', point: 'point', polygon: 'polygon',
      needSite: 'Set a point first: press “📍 Point” and click the map, type coordinates (“41.35, 69.28”) or an address (“address: Amir Temur 15”).',
      needZone: 'No zone yet: draw a radius (“radius 1 km”), a polygon (“polygon”, then click the map and say “done”) or an isochrone.',
      noIso: 'Isochrones are unavailable in this build.', isoFail: 'Router unavailable, cannot build the isochrone. Use a radius: 10 minutes by car in the city is roughly 3-4 km.',
      needPts: 'A polygon needs at least three points.', notDrawing: 'Not drawing a polygon now. Say “polygon” and click the map.',
      noPop: 'Population grid not loaded.', badLayer: function (l) { return 'Unknown layer “' + l + '”. Available: buildings, roads, zone, selection.'; },
      notLoaded: function (l) { return 'Layer “' + l + '” not loaded yet: first “buildings 500 m” or “roads 1 km”.'; },
      noGeo: function (q) { return 'Address “' + q + '” not found. Add street, number and city.'; },
      vertex: function (n) { return 'Vertex ' + n + '. Double-click or “done” to close the polygon.'; },
      unknown: 'Not understood. Examples: “radius 1 km and population”, “buildings 500 m”, “roads 1 km”, “polygon” (then clicks and “done”), “merge”, “select buildings above 9 floors”, “make buildings blue”, “address: Amir Temur 15”, “clear”. Say “help” for the full list.',
      help: 'I can: point (click, coordinates, address); radius N m/km; isochrone N minutes; population (in radius or “in zone”); buildings and roads (in radius or “in zone”); polygon by clicks or coordinates; merge shapes into one zone; zone area; select buildings by floors and type, roads by class; recolour a layer; competitors; clear; check connection. Numbers come from tools over data with provenance; I only restate them.' },
    uz: { pickBtn: '📍 Nuqta', pickOn: 'xaritada bosing…', mapPoint: 'xaritadagi nuqta', point: 'nuqta', polygon: 'poligon',
      needSite: 'Avval nuqtani belgilang: “📍 Nuqta” tugmasini bosib xaritada bosing, koordinata (“41.35, 69.28”) yoki manzil (“manzil: Amir Temur 15”) kiriting.',
      needZone: 'Hali zona yo‘q: radius (“radius 1 km”), poligon (“poligon”, keyin xaritada bosing va “tayyor”) yoki izoxrona chizing.',
      noIso: 'Izoxrona bu yig‘ilmada mavjud emas.', isoFail: 'Marshrutlash mavjud emas, izoxronani qurib bo‘lmaydi. Radius oling: shaharda 10 daqiqa mashinada taxminan 3-4 km.',
      needPts: 'Poligon uchun kamida uchta nuqta kerak.', notDrawing: 'Hozir poligon chizilmayapti. “poligon” deng va xaritada bosing.',
      noPop: 'Aholi to‘ri yuklanmagan.', badLayer: function (l) { return 'Noma’lum qatlam “' + l + '”. Mavjud: binolar, yo‘llar, zona, tanlov.'; },
      notLoaded: function (l) { return '“' + l + '” qatlami hali yuklanmagan: avval “binolar 500 m” yoki “yo‘llar 1 km”.'; },
      noGeo: function (q) { return '“' + q + '” manzili topilmadi. Ko‘cha, uy va shaharni aniqlashtiring.'; },
      vertex: function (n) { return 'Nuqta ' + n + '. Ikki marta bosing yoki “tayyor” deng.'; },
      unknown: 'Tushunmadim. Misollar: “radius 1 km va aholi”, “binolar 500 m”, “yo‘llar 1 km”, “poligon” (keyin bosishlar va “tayyor”), “birlashtir”, “9 qavatdan baland binolarni ajrat”, “binolarni ko‘k qil”, “manzil: Amir Temur 15”, “tozala”. To‘liq ro‘yxat uchun “yordam”.',
      help: 'Qo‘limdan keladi: nuqta (bosish, koordinata, manzil); radius N m/km; izoxrona N daqiqa; aholi (radiusda yoki “zonada”); binolar va yo‘llar (radiusda yoki “zonada”); poligon; fig‘uralarni bitta zonaga birlashtirish; zona maydoni; binolarni qavat va turi bo‘yicha ajratish; qatlamni bo‘yash; raqobatchilar; tozalash; ulanishni tekshirish. Raqamlarni manbali ma’lumotlar asosida vositalar hisoblaydi; men ularni faqat aytib beraman.' }
  };
  function T(key) { var d = I18N[ST.lang] || I18N.ru, v = d[key] != null ? d[key] : I18N.ru[key]; var args = Array.prototype.slice.call(arguments, 1); return typeof v === 'function' ? v.apply(null, args) : v; }

  function detectLang(t) {
    if (/[а-яё]/i.test(t)) return 'ru';
    /* одни координаты («41.31, 69.28») языка не выдают: остаёмся на прежнем */
    if (!/[a-z]/i.test(t)) return ST.lang || 'ru';
    if (/\b(aholi|bino|yo.l|ko.cha|radius\w*da|zona|poligon|birlashtir|tozala|ajrat|manzil|yordam|tayyor|bekor|daqiqa|km ichida|qavat|rang|qil\b)/i.test(t)) return 'uz';
    return 'en';
  }
  var COLORS = [[/красн|red|qizil/i, '#c0392b'], [/син|blue|ko.k/i, '#2e86de'], [/зел[её]н|green|yashil/i, '#27ae60'], [/ж[её]лт|yellow|sariq/i, '#f2b90d'], [/оранж|orange|to.q sariq/i, '#e67e22'], [/ч[её]рн|black|qora/i, '#1c1f26'], [/сер|gr[ae]y|kulrang/i, '#7f8c8d'], [/фиолет|purple|violet|binafsha/i, '#8e44ad'], [/бел|white|oq\b/i, '#ffffff'], [/розов|pink|pushti/i, '#e84393'], [/коричн|brown|jigarrang/i, '#8d6e63']];
  function colorIn(t) { var m = t.match(/#[0-9a-f]{6}\b/i); if (m) return m[0].toLowerCase(); for (var i = 0; i < COLORS.length; i++) if (COLORS[i][0].test(t)) return COLORS[i][1]; return null; }
  function metersIn(t) {
    var out = [], re = /(\d+(?:[.,]\d+)?)\s*(км|km|метр[а-я]*|meters?|metr|м(?![а-яa-z])|m(?![a-zа-я]))/gi, m;
    while ((m = re.exec(t))) { var v = parseFloat(m[1].replace(',', '.')), u = m[2].toLowerCase(); out.push(Math.round(/км|km/.test(u) ? v * 1000 : v)); }
    return out.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
  }

  /* Разбор одной реплики -> список вызовов инструментов в осмысленном порядке, либо
     {ask: текст} для уточнения, либо null, если фраза не распознана. Учитывает состояние:
     «а 2 км?» повторяет прошлые счёты с новым радиусом, «их синим» красит последний слой. */
  function parse(text) {
    var raw = String(text || '').trim(); if (!raw) return null;
    ST.lang = detectLang(raw);
    var low = raw.toLowerCase().replace(/ё/g, 'е'), calls = [];
    var meters = metersIn(low), color = colorIn(low);
    var zoneRef = /в зоне|внутри зоны|в полигоне|в объединен|in (the )?zone|in (the )?polygon|zonada|poligonda|within the zone/.test(low);

    /* «помощь», «что умеешь?», но не «а 2 км?»: вопрос с числом - это продолжение, не справка. */
    /* \b в JS не видит кириллицу, поэтому границы слов здесь - явные просмотры вперёд. */
    if ((/^(помощь|что умеешь|help|yordam)(?![а-яa-z])/.test(low) || (/\?$/.test(low) && !/\d/.test(low))) && !/радиус|населен|здани|дорог|radius|population|building|road|aholi|bino|yo.l/.test(low)) return [{ name: 'help', input: {} }];
    if (/провер(ь|ка)\s*(связ|подключ)|check (the )?connection|ping|ulanish/.test(low)) return [{ name: 'ping', input: {} }];

    /* Точка: координаты, адрес, «здесь» */
    var coords = raw.match(/(-?\d{1,2}\.\d{3,})[,;\s]+(-?\d{1,3}\.\d{3,})/);
    if (coords) calls.push({ name: 'set_site', input: { lat: parseFloat(coords[1]), lon: parseFloat(coords[2]) } });
    var addr = raw.match(/(?:адрес|по адресу|address|manzil)\s*[:\-]?\s*(.+)$/i);
    if (addr && !coords) calls.push({ name: 'set_site', input: { address: addr[1].replace(/[«»"]/g, '').trim() } });
    if (/^(точка|point|nuqta)$/.test(low)) { setPick(true); return [{ name: 'help', input: { pick: true } }]; }

    /* v4.75.0: зоны охвата по методике CASE: PTA/STA/TTA по времени в пути */
    if (/зон[аыу] охвата|catchment|торгов(ая|ой|ую) зон|(^|[^a-z])pta([^a-z]|$)|по методике/.test(low)) {
      var cm = {}, mm3 = low.match(/(\d+)\s*[\/,и ]+\s*(\d+)\s*[\/,и ]+\s*(\d+)\s*(мин|min|daqiqa)/);
      if (mm3) cm.minutes = [parseInt(mm3[1], 10), parseInt(mm3[2], 10), parseInt(mm3[3], 10)]; else { var m1 = low.match(/(\d+)\s*(мин|min|daqiqa)/); if (m1) cm.minutes = [parseInt(m1[1], 10)]; }
      cm.format = /трц|региональн|regional|mall/.test(low) ? 'regional' : /районн|community|соседск|(^|[^а-я])тц(?![а-я])/.test(low) ? 'community' : /у дома|convenience|шаговой/.test(low) ? 'convenience' : /(^|[^а-я])бц(?![а-я])|бизнес.центр|офис|office/.test(low) ? 'office' : 'regional';
      var gm = low.match(/gla\s*[:=]?\s*(\d[\d\s]*)/), rm = low.match(/(?:ставк[аеиу]|rent)\s*[:=]?\s*\$?\s*(\d+(?:[.,]\d+)?)/) || low.match(/\$\s*(\d+(?:[.,]\d+)?)/) || low.match(/(\d+(?:[.,]\d+)?)\s*\$/);
      if (gm) cm.gla_m2 = parseInt(gm[1].replace(/\s/g, ''), 10); if (rm) cm.rent_usd_m2_month = parseFloat(rm[1].replace(',', '.'));
      if (/метро|metro/.test(low)) cm.mode = 'metro';
      calls.push({ name: 'catchment', input: cm }); return calls;
    }

    /* Полигон: начать, закончить, отменить, по координатам */
    if (/^(готово|закончи|замкни|done|finish|tayyor)(?![а-яa-z])/.test(low)) return [{ name: 'finish_polygon', input: {} }];
    if (/^(отмена|отмени|cancel|bekor)(?![а-яa-z])/.test(low)) return [{ name: 'cancel_polygon', input: {} }];
    if (/полигон|многоугольник|polygon|poligon|нарисуй зону|draw (a )?zone/.test(low) && !/в полигоне|in (the )?polygon|poligonda/.test(low)) {
      var pts = [], re = /(-?\d{1,2}\.\d{3,})[,;\s]+(-?\d{1,3}\.\d{3,})/g, m;
      while ((m = re.exec(raw))) pts.push([parseFloat(m[1]), parseFloat(m[2])]);
      calls = calls.filter(function (c) { return c.name !== 'set_site'; });
      calls.push({ name: 'draw_polygon', input: pts.length >= 3 ? { points: pts } : {} });
      if (pts.length >= 3 || calls.length === 1) return calls.concat(color ? [{ name: 'style_layer', input: { layer: 'zone', color: color } }] : []);
    }
    if (/объедини|слей|merge|union|birlashtir/.test(low)) calls.push({ name: 'merge_zones', input: {} });
    if (/площад[ьи] зоны|zone area|zona maydoni/.test(low)) calls.push({ name: 'zone_area', input: {} });

    if (/(убер|сним|удал|сброс|очист)[а-я]*\s+(точк|пин|метк)|(точк|пин|метк)[а-я]*\s+(убер|сним|удал|сброс)|(remove|clear|delete|unset)\s+(the\s+)?(point|pin|site|marker)|nuqta(ni)?\s*(o[ʻ'’]?chir|olib tashla|tozala)/.test(low)) return [{ name: 'clear_site', input: {} }];
    if (/очист|убер|сброс|clear|reset|tozala/.test(low) && !/здани|дорог|радиус|кру[гж]|зон|выдел|building|road|zone/.test(low)) { calls.push({ name: 'clear_layers', input: {} }); return calls; }

    /* «Сделай здания синими»: цвет без загрузки и без метров */
    var styleIntent = !!color && /покрас|перекрас|цвет|colou?r|сделай|make|rang|qil/.test(low) && !meters.length && !/покажи|загруз|show|load|добавь|нарисуй|выдел|только|only|select|ajrat/.test(low);
    if (styleIntent) {
      var sl = /здани|дом|building|bino/.test(low) ? 'buildings' : /дорог|улиц|road|street|yo.l|ko.cha/.test(low) ? 'roads' : /радиус|кру[гж]|circle|зон|zone|zona|полигон|polygon/.test(low) ? 'zone' : /выдел|selection|tanlov/.test(low) ? 'selection' : /(^|[^а-яa-z])(их|его|ее|them|it|ularni|uni)(?![а-яa-z])/.test(low) ? (ST.lastLayer || 'buildings') : null;
      if (sl) calls.push({ name: 'style_layer', input: { layer: sl, color: color } });
      return calls.length ? calls : null;
    }

    var mins = low.match(/(\d+)\s*(мин|minute|min\b|daqiqa)/);
    if (mins && /езд|доех|drive|driving|изохрон|isochron|мин|minute|daqiqa|авто|car|mashina/.test(low)) calls.push({ name: 'draw_isochrone', input: { minutes: parseInt(mins[1], 10) } });
    if (/радиус|кру[гж]|зон[аеуы](?![а-яa-z])|radius|circle|radiusda/.test(low) && meters.length && !zoneRef) calls.push({ name: 'draw_radius', input: { radii_m: meters } });

    var r1 = meters.length ? meters[0] : ST.lastRadius;
    var loadB = /здани|дом[аов]?(?![а-яa-z])|застройк|building|bino/.test(low) && !/выдел|только|only|select|ajrat/.test(low);
    var loadR = /дорог|улиц|магистрал|road|street|yo.l|ko.cha/.test(low) && !/выдел|только|only|select|ajrat/.test(low);
    if (loadB) calls.push({ name: 'load_buildings', input: zoneRef ? { zone: true } : { radius_m: r1 } });
    if (loadR) { var inp = zoneRef ? { zone: true } : { radius_m: r1 }; if (/магистрал|главн|major|primary|trunk|arterial|asosiy/.test(low)) inp.classes = ['motorway', 'trunk', 'primary', 'secondary']; calls.push({ name: 'load_roads', input: inp }); }
    if (/населен|жител|люд|population|people|aholi|inhabit|residents/.test(low)) {
      if (zoneRef) calls.push({ name: 'count_population', input: { zone: true } });
      else (meters.length ? meters : [r1]).forEach(function (r) { calls.push({ name: 'count_population', input: { radius_m: r } }); });
    }
    if (/конкурент|бизнес.центр|(^|[^а-я])бц(?![а-я])|competitor|business cent|raqobat/.test(low)) calls.push({ name: 'count_competitors', input: zoneRef ? { zone: true } : { radius_m: r1 } });

    if (/выдел|покажи только|только|only|select|highlight|ajrat/.test(low)) {
      var lv = low.match(/(\d+)\s*(этаж|floor|level|qavat)/), sel = null;
      if (/здани|дом|building|bino|этаж|floor|qavat/.test(low)) {
        sel = { layer: 'buildings' };
        if (lv) { if (/ниже|меньше|до\s|below|under|less|max|past/.test(low)) sel.max_levels = parseInt(lv[1], 10); else sel.min_levels = parseInt(lv[1], 10); }
        if (/жил|residential|apartment|turar/.test(low)) sel.kind = 'residential';
        if (/коммерч|торгов|офис|commercial|retail|office|savdo/.test(low)) sel.kind = 'commercial';
      } else if (/дорог|улиц|магистрал|road|street|yo.l/.test(low)) { sel = { layer: 'roads' }; if (/магистрал|главн|major|primary|trunk|asosiy/.test(low)) sel.classes = ['motorway', 'trunk', 'primary', 'secondary']; }
      else if (ST.lastLayer) sel = { layer: ST.lastLayer };
      if (sel) { if (color) sel.color = color; calls.push({ name: 'select_features', input: sel }); }
    }
    if (color && !calls.some(function (c) { return c.name === 'select_features' || c.name === 'style_layer'; })) {
      var layer = /здани|дом|building|bino/.test(low) ? 'buildings' : /дорог|улиц|road|street|yo.l/.test(low) ? 'roads' : /радиус|кру[гж]|circle|зон|zone|zona|полигон|polygon/.test(low) ? 'zone' : null;
      if (layer) { var loader = calls.find(function (c) { return c.name === 'load_' + layer || (layer === 'zone' && (c.name === 'draw_radius' || c.name === 'draw_polygon')); }); if (loader) loader.input.color = color; else calls.push({ name: 'style_layer', input: { layer: layer, color: color } }); }
    }

    /* Продолжение: только расстояние («а 2 км?») - повторить прошлые счёты с новым радиусом. */
    if (!calls.length && meters.length && ST.lastIntents.length) {
      ST.lastIntents.forEach(function (n) { calls.push({ name: n, input: { radius_m: meters[0] } }); });
    }
    return calls.length ? calls : null;
  }

  /* ── Пересказ по шаблонам ─────────────────────────────────────────────────── */

  function narrative(items) {
    var L_ = ST.lang, s = [];
    var w = function (ru, en, uz) { return L_ === 'en' ? en : L_ === 'uz' ? uz : ru; };
    items.forEach(function (it) {
      var r = it.res, n = it.name; if (!r || !r.ok) return;
      if (n === 'clear_site') s.push(w(r.had ? 'Точка анализа снята.' : 'Точки и не было.', r.had ? 'Analysis point removed.' : 'There was no point.', r.had ? 'Tahlil nuqtasi olib tashlandi.' : 'Nuqta yo‘q edi.'));
      if (n === 'set_site') s.push(w('Точка: ', 'Point: ', 'Nuqta: ') + (r.site.name || '') + ' (' + r.site.lat.toFixed(5) + ', ' + r.site.lon.toFixed(5) + ')' + (r.candidates && r.candidates.length > 1 ? w(' - взят первый из ' + r.candidates.length + ' найденных', ' - first of ' + r.candidates.length + ' matches', ' - topilgan ' + r.candidates.length + ' tadan birinchisi') : '') + '.');
      if (n === 'draw_radius') s.push(w('Круг ', 'Circle ', 'Aylana ') + r.radii_m.map(humanM).join(', ') + '.');
      if (n === 'draw_isochrone') s.push(w('Изохрона ' + r.minutes + ' мин, площадь ' + (r.area_m2 / 1e6).toFixed(1) + ' км² (расчёт по дорогам OSM).', 'Isochrone ' + r.minutes + ' min, area ' + (r.area_m2 / 1e6).toFixed(1) + ' km² (modelled on OSM roads).', 'Izoxrona ' + r.minutes + ' daqiqa, maydon ' + (r.area_m2 / 1e6).toFixed(1) + ' km² (OSM yo‘llari bo‘yicha hisob).'));
      if (n === 'draw_polygon' && r.drawing) s.push(w('Рисую полигон: кликайте по карте, двойной клик или «готово» замкнёт.', 'Drawing a polygon: click the map, double-click or say “done” to close.', 'Poligon chizyapman: xaritada bosing, ikki marta bosish yoki “tayyor” yopadi.'));
      if ((n === 'draw_polygon' && r.drawn) || n === 'finish_polygon') s.push(w('Полигон из ' + r.points + ' точек, площадь ' + (r.area_m2 / 1e6).toFixed(2) + ' км².', 'Polygon with ' + r.points + ' points, area ' + (r.area_m2 / 1e6).toFixed(2) + ' km².', r.points + ' nuqtali poligon, maydoni ' + (r.area_m2 / 1e6).toFixed(2) + ' km².'));
      if (n === 'merge_zones') s.push(w('Объединил ' + r.shapes + ' фигур в одну зону, площадь ' + (r.area_m2 / 1e6).toFixed(2) + ' км² (сеточная выборка).', 'Merged ' + r.shapes + ' shapes into one zone, area ' + (r.area_m2 / 1e6).toFixed(2) + ' km² (grid sampling).', r.shapes + ' ta figurani bitta zonaga birlashtirdim, maydoni ' + (r.area_m2 / 1e6).toFixed(2) + ' km².'));
      if (n === 'zone_area') s.push(w('Площадь зоны ' + (r.area_m2 / 1e6).toFixed(2) + ' км².', 'Zone area ' + (r.area_m2 / 1e6).toFixed(2) + ' km².', 'Zona maydoni ' + (r.area_m2 / 1e6).toFixed(2) + ' km².'));
      if (n === 'draw_circle') s.push(w('Круг ' + humanM(r.radius_m) + ' с центром ' + r.lat.toFixed(4) + ', ' + r.lon.toFixed(4) + '.', 'Circle ' + humanM(r.radius_m) + ' centred at ' + r.lat.toFixed(4) + ', ' + r.lon.toFixed(4) + '.', 'Aylana ' + humanM(r.radius_m) + '.'));
      if (n === 'catchment') {
        var zz = r.zones.map(function (z) { return z.name + ' ' + z.minutes + ' мин: ' + fmt(z.population) + ' жит., ' + fmt(z.households) + ' д/х, RDE около $' + (z.rde_usd / 1e6).toFixed(1) + ' млн/год'; }).join('; ');
        s.push(w('Зоны охвата по методике CASE (' + (r.mode === 'isochrone' ? 'по времени в пути на авто' : r.mode === 'metro' ? 'на метро и пешком' : 'по радиусам: маршрутизатор недоступен') + '): ' + zz + '. Оценка, не факт: границы без коррекции на барьеры, доходы по национальной структуре расходов.', 'CASE catchment zones (' + (r.mode === 'isochrone' ? 'by drive time' : 'by radius, router unavailable') + '): ' + zz + '. Estimate, not a fact.', 'CASE qamrov zonalari: ' + zz + '. Bu hisob, fakt emas.'));
        if (r.captures) s.push(w('Требуемый оборот при rent-to-sales 15%: $' + fmt(r.required_turnover_usd) + ' в год; capture rate PTA ' + (r.captures[0].capture_rate * 100).toFixed(2) + '% (ориентир CASE 0,39%), STA ' + (r.captures[1].capture_rate * 100).toFixed(3) + '%, TTA ' + (r.captures[2].capture_rate * 100).toFixed(3) + '%.', 'Required turnover at 15% rent-to-sales: $' + fmt(r.required_turnover_usd) + ' per year; capture PTA ' + (r.captures[0].capture_rate * 100).toFixed(2) + '%.', 'Talab qilinadigan aylanma: $' + fmt(r.required_turnover_usd) + '.'));
        else s.push(w('Для capture rate добавьте GLA и ставку: «зона охвата, GLA 20000, ставка $25».', 'Add GLA and rent for the capture rate: "catchment, GLA 20000, rent $25".', 'Capture rate uchun GLA va stavkani qo‘shing.'));
        /* проверка на здравый смысл: ориентир CASE 0,39% по PTA; на порядок выше значит, что RDE первичной
           зоны такой оборот не даст: либо GLA и ставка завышены, либо зона мала, либо нужен другой формат */
        if (r.captures && r.captures[0].capture_rate != null && r.captures[0].capture_rate > 0.02) s.push(w('Внимание: capture rate PTA выше 2%, это в разы больше ориентира CASE. RDE первичной зоны такой оборот не покроет: проверьте GLA и ставку, расширьте зону или измените формат.', 'Warning: PTA capture rate above 2%, several times the CASE reference. The primary zone cannot support this turnover: check GLA and rent, widen the zone or change the format.', 'Diqqat: PTA capture rate 2% dan yuqori, CASE mo‘ljalidan ancha ko‘p. GLA va stavkani tekshiring yoki zonani kengaytiring.'));
      }
      if (n === 'count_population') s.push(w((r.zone ? 'В зоне' : 'В радиусе ' + humanM(r.radius_m)) + ' около ' + fmt(r.population) + ' жителей - расчёт по сетке, порядок величины, не факт.', (r.zone ? 'In the zone' : 'Within ' + humanM(r.radius_m)) + ' about ' + fmt(r.population) + ' residents - modelled from a grid, an order of magnitude, not a fact.', (r.zone ? 'Zonada' : humanM(r.radius_m) + ' radiusda') + ' taxminan ' + fmt(r.population) + ' aholi - to‘r bo‘yicha hisob, taxmin, fakt emas.'));
      if (n === 'load_buildings') s.push(w((r.zone ? 'В зоне ' : 'В ' + humanM(r.radius_m) + ' ') + fmt(r.count) + ' зданий OSM, пятно застройки ' + fmt(r.footprint_area_m2) + ' м²' + (r.max_levels ? ', до ' + r.max_levels + ' этажей' : '') + (r.by_kind.length ? '; чаще всего ' + r.by_kind[0].kind + ' (' + r.by_kind[0].count + ')' : '') + '.', (r.zone ? 'In the zone ' : 'Within ' + humanM(r.radius_m) + ' ') + fmt(r.count) + ' OSM buildings, footprint ' + fmt(r.footprint_area_m2) + ' m²' + (r.max_levels ? ', up to ' + r.max_levels + ' floors' : '') + '.', (r.zone ? 'Zonada ' : humanM(r.radius_m) + ' ichida ') + fmt(r.count) + ' ta OSM binosi, qurilish izi ' + fmt(r.footprint_area_m2) + ' m²' + (r.max_levels ? ', ' + r.max_levels + ' qavatgacha' : '') + '.'));
      if (n === 'load_roads') s.push(w((r.zone ? 'В зоне ' : 'В ' + humanM(r.radius_m) + ' ') + fmt(r.count) + ' участков дорог, ' + r.length_km + ' км' + (r.by_class.length ? '; больше всего ' + r.by_class[0].cls + ' (' + r.by_class[0].count + ')' : '') + '.', (r.zone ? 'In the zone ' : 'Within ' + humanM(r.radius_m) + ' ') + fmt(r.count) + ' road segments, ' + r.length_km + ' km.', (r.zone ? 'Zonada ' : humanM(r.radius_m) + ' ichida ') + fmt(r.count) + ' ta yo‘l bo‘lagi, ' + r.length_km + ' km.'));
      if (n === 'select_features') s.push(w('Выделено ' + r.matched + ' из ' + r.of + ' (' + r.criteria + ').', 'Selected ' + r.matched + ' of ' + r.of + ' (' + r.criteria + ').', r.of + ' tadan ' + r.matched + ' tasi ajratildi (' + r.criteria + ').'));
      if (n === 'style_layer') s.push(w('Слой «' + r.layer + '»: цвет ' + r.style.color + '.', 'Layer “' + r.layer + '”: colour ' + r.style.color + '.', '“' + r.layer + '” qatlami: rang ' + r.style.color + '.'));
      if (n === 'count_competitors') s.push(w((r.zone ? 'В зоне ' : 'В ' + humanM(r.radius_m) + ' ') + r.business_centers + ' БЦ из базы CASE' + (r.nearest.length ? ', ближайший ' + r.nearest[0].name + (r.nearest[0].dist_m != null ? ' (' + r.nearest[0].dist_m + ' м)' : '') : '') + '.', (r.zone ? 'In the zone ' : 'Within ' + humanM(r.radius_m) + ' ') + r.business_centers + ' business centres from the CASE base.', (r.zone ? 'Zonada ' : humanM(r.radius_m) + ' ichida ') + r.business_centers + ' ta biznes-markaz.'));
      if (n === 'clear_layers') s.push(w('Убрал: ' + r.cleared.join(', ') + '.', 'Cleared: ' + r.cleared.join(', ') + '.', 'Tozalandi: ' + r.cleared.join(', ') + '.'));
      if (n === 'cancel_polygon') s.push(w('Рисование отменено.', 'Drawing cancelled.', 'Chizish bekor qilindi.'));
      if (n === 'ping') s.push((r.advice || []).join(' '));
      if (n === 'help') s.push(r.help && it.input && it.input.pick ? T('pickOn') : T('help'));
    });
    return s.join(' ');
  }

  /* ── Журнал и факты ───────────────────────────────────────────────────────── */

  var TOOL_RU = { draw_circle: 'Круг', catchment: 'Зоны охвата', set_site: 'Точка', clear_site: 'Точка снята', draw_radius: 'Радиус', draw_isochrone: 'Изохрона', draw_polygon: 'Полигон', finish_polygon: 'Полигон', cancel_polygon: 'Полигон', merge_zones: 'Объединение', zone_area: 'Площадь зоны', count_population: 'Население', load_buildings: 'Здания', load_roads: 'Дороги', style_layer: 'Стиль', select_features: 'Выделение', count_competitors: 'Конкуренты', clear_layers: 'Очистка', ping: 'Связь', help: 'Помощь' };
  var CONF_RU = { verified: ['✓', 'подтв.', 'ga-v'], asking: ['≈', 'наблюдение', 'ga-a'], modelled: ['ƒ', 'расчёт', 'ga-m'] };
  function provChip(p) {
    if (!p) return ''; var c = CONF_RU[p.conf] || CONF_RU.modelled;
    var tip = (p.source ? 'Источник: ' + p.source + '\n' : '') + (p.method ? 'Метод: ' + p.method + '\n' : '') + (p.at ? 'Дата: ' + p.at + '\n' : '') + (p.note || '');
    return '<span class="ga-prov ' + c[2] + '" title="' + esc(tip.trim()) + '"><i>' + c[0] + '</i>' + c[1] + '</span>';
  }
  function factHtml(name, res) {
    var h = '<div class="ga-fbody"><b>' + esc(TOOL_RU[name] || name) + '</b> ';
    switch (name) {
      case 'set_site': h += esc(res.site.name) + ' · ' + res.site.lat.toFixed(5) + ', ' + res.site.lon.toFixed(5) + (res.site.district ? ' · ' + esc(res.site.district) : '') + (res.provenance ? ' ' + provChip(res.provenance) : ''); break;
      case 'draw_radius': h += res.radii_m.map(humanM).join(', '); break;
      case 'draw_isochrone': h += res.minutes + ' мин · ' + (res.area_m2 / 1e6).toFixed(1) + ' км² ' + provChip(res.provenance); break;
      case 'draw_polygon': h += res.drawing ? 'рисование: кликайте по карте' : res.points + ' точек · ' + (res.area_m2 / 1e6).toFixed(2) + ' км²'; break;
      case 'finish_polygon': h += res.points + ' точек · ' + (res.area_m2 / 1e6).toFixed(2) + ' км²'; break;
      case 'cancel_polygon': h += 'отменено'; break;
      case 'merge_zones': h += res.shapes + ' фигур → одна зона · <span class="ga-num">' + (res.area_m2 / 1e6).toFixed(2) + '</span> км² ' + provChip(res.provenance); break;
      case 'zone_area': h += '<span class="ga-num">' + (res.area_m2 / 1e6).toFixed(2) + '</span> км² ' + provChip(res.provenance); break;
      case 'count_population': h += '<span class="ga-num">' + fmt(res.population) + '</span> жителей ' + (res.zone ? 'в зоне' : 'в радиусе ' + humanM(res.radius_m)) + ' ' + provChip(res.provenance) + '<div class="ga-note">' + esc(res.provenance.note) + '</div>'; break;
      case 'load_buildings': h += '<span class="ga-num">' + fmt(res.count) + '</span> зданий ' + (res.zone ? 'в зоне' : 'в ' + humanM(res.radius_m)) + ', пятно ' + fmt(res.footprint_area_m2) + ' м²' + (res.max_levels ? ', до ' + res.max_levels + ' эт.' : '') + ' ' + provChip(res.provenance) + '<div class="ga-note">' + esc(res.provenance.attribution) + (res.truncated ? ' · выборка обрезана, уменьшите радиус' : '') + '</div>'; break;
      case 'load_roads': h += '<span class="ga-num">' + fmt(res.count) + '</span> участков, ' + res.length_km + ' км ' + (res.zone ? 'в зоне' : 'в ' + humanM(res.radius_m)) + ' ' + provChip(res.provenance) + '<div class="ga-note">' + res.by_class.slice(0, 4).map(function (c) { return esc(c.cls) + ' ' + c.count; }).join(' · ') + ' · ' + esc(res.provenance.attribution) + '</div>'; break;
      case 'style_layer': h += esc(res.layer) + ': ' + esc(res.style.color); break;
      case 'select_features': h += '<span class="ga-num">' + fmt(res.matched) + '</span> из ' + fmt(res.of) + ' (' + esc(res.criteria) + ')' + (res.note ? '<div class="ga-note">' + esc(res.note) + '</div>' : ''); break;
      case 'count_competitors': h += '<span class="ga-num">' + fmt(res.business_centers) + '</span> БЦ ' + (res.zone ? 'в зоне' : 'в ' + humanM(res.radius_m)) + ' ' + provChip(res.provenance) + (res.nearest.length ? '<div class="ga-note">' + res.nearest.slice(0, 4).map(function (b) { return esc(b.name) + (b.dist_m != null ? ' (' + b.dist_m + ' м)' : ''); }).join(', ') + '</div>' : ''); break;
      case 'draw_circle': h += humanM(res.radius_m) + ' · ' + (res.area_m2 / 1e6).toFixed(2) + ' км² · центр ' + res.lat.toFixed(4) + ', ' + res.lon.toFixed(4); break;
      case 'catchment': h += (res.mode === 'isochrone' ? 'по времени в пути на авто' : res.mode === 'metro' ? 'на метро и пешком' : 'по радиусам') + ' ' + provChip(res.provenance) + '<table class="ga-tbl"><tr><th>зона</th><th>мин</th><th>жителей</th><th>д/х</th><th>RDE, $ млн</th>' + (res.captures ? '<th>capture</th>' : '') + '</tr>' + res.zones.map(function (z, i) { var c = res.captures ? res.captures[i].capture_rate : null; return '<tr><td>' + z.name + '</td><td>' + z.minutes + '</td><td>' + fmt(z.population) + '</td><td>' + fmt(z.households) + '</td><td>' + (z.rde_usd / 1e6).toFixed(1) + '</td>' + (res.captures ? '<td>' + (c == null ? '-' : (c * 100).toFixed(c * 100 >= 1 ? 1 : 3) + '%') + '</td>' : '') + '</tr>'; }).join('') + '</table><div class="ga-note">' + esc(res.provenance.note) + (res.inputs_needed && res.inputs_needed.length ? ' Требуемые входные данные: ' + esc(res.inputs_needed.join('; ')) + '.' : '') + '</div>'; break;
      case 'clear_site': h += res.had ? 'точка анализа снята с карты' : 'точки не было'; break;
      case 'clear_layers': h += esc(res.cleared.join(', ')); break;
      case 'ping': h += (res.advice || []).map(function (a) { return '<div class="ga-note" style="color:inherit;font-size:11px">' + esc(a) + '</div>'; }).join(''); break;
      case 'help': h += esc(T('help')); break;
      default: h += esc(JSON.stringify(res)).slice(0, 200);
    }
    return h + '</div>';
  }
  function say(who, html) {
    ST.log.push({ who: who, html: html });
    var box = $('gaLog'); if (!box) return;
    var d = document.createElement('div'); d.className = 'ga-msg ga-' + who; d.innerHTML = html; box.appendChild(d); box.scrollTop = box.scrollHeight;
  }

  /* Один ход: разобрать, исполнить по очереди, показать факты и пересказ. Сбой одного
     инструмента не отменяет остальных: ошибка пишется рядом с фактами. */
  function ask(text) {
    text = String(text || '').trim();
    if (!text || ST.busy) return Promise.resolve();
    ST.busy = true; say('you', esc(text)); setBusy(true);
    var calls = parse(text);
    /* Движок не разобрал фразу: если владелец настроил свою модель (Ollama и т.п.), она
       переводит фразу в те же команды из закрытого меню. Каждое имя проверяется здесь ещё
       раз: исполняются только инструменты агента, и никогда help/ping по воле модели. */
    var viaModel = calls ? Promise.resolve(calls) : getJSON('api/llm.php?q=' + encodeURIComponent(text.slice(0, 300)) + '&lang=' + ST.lang).then(function (j) {
      var ok = (j.calls || []).filter(function (c) { return c && typeof c.name === 'string' && TOOLS[c.name] && c.name !== 'help' && c.name !== 'ping' && c.input && typeof c.input === 'object'; });
      if (!ok.length) return null;
      say('sys', esc(ST.lang === 'en' ? 'Understood via the local model: ' : ST.lang === 'uz' ? 'Mahalliy model orqali tushunildi: ' : 'Понято своей моделью: ') + esc(ok.map(function (c) { return c.name; }).join(', ')));
      return ok;
    }, function () { return null; });
    return viaModel.then(function (calls2) {
      if (!calls2) { say('ai', esc(T('unknown'))); ST.busy = false; setBusy(false); return false; }
      return execute(calls2);
    });
  }
  function execute(calls) {
    var done = [], chain = Promise.resolve();
    calls.forEach(function (c) {
      chain = chain.then(function () {
        return run(c.name, c.input).then(function (res) { if (c.name !== 'help' || !c.input.pick) say('fact', factHtml(c.name, res)); done.push({ name: c.name, res: res, input: c.input }); },
          function (e) { say('err', esc(TOOL_RU[c.name] || c.name) + ': ' + esc(e && e.message || e)); });
      });
    });
    return chain.then(function () {
      var counted = calls.filter(function (c) { return /^(count_population|load_buildings|load_roads|count_competitors)$/.test(c.name) && !c.input.zone; }).map(function (c) { return c.name; });
      if (counted.length) ST.lastIntents = counted;
      var txt = narrative(done); if (txt) say('ai', esc(txt));
      siteLabel(); ST.busy = false; setBusy(false); return true;
    }, function (e) { ST.busy = false; setBusy(false); say('err', esc(e && e.message || e)); });
  }

  /* ── Панель ────────────────────────────────────────────────────────────────── */

  /* Оформление в палитре CASE: тёплая бумага #faf8f5, оксблад #9E0000 и тёмный #6e0000,
     чернила #1b1b1b, хайрлайн #e3dcd1, Montserrat. Панель - карточка с тёмной шапкой, диалог
     на бумаге, факты - белые карточки с красным корешком и крупным числом, ввод - пилюля с
     круглой красной кнопкой. Чипы происхождения (✓ подтв., ≈ наблюдение, ƒ расчёт) различаются
     не только цветом, но и значком и рамкой: так они читаются и в чёрно-белой печати. */
  var CSS = ''
    + '#gaPanel{--ga-red:#9E0000;--ga-red-d:#6e0000;--ga-ink:#1b1b1b;--ga-paper:#faf8f5;--ga-paper-2:#f3f1ee;--ga-line:#e3dcd1;--ga-muted:#6f6a63}'
    + '#gaPanel>h3{background:var(--ga-ink);color:#fff;letter-spacing:.08em;gap:8px;border-radius:12px 12px 0 0}'
    + '#gaPanel>h3::before{color:rgba(255,255,255,.65)}#gaPanel>h3:hover{background:#2b2a28}'
    + '.ga-badge{margin-left:auto;font-size:8.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:var(--ga-red);border-radius:999px;padding:2px 8px;white-space:nowrap}'
    + '.ga-log{max-height:320px;overflow:auto;border:1px solid var(--ga-line);border-radius:10px;padding:8px;background:var(--ga-paper);font-size:11.5px;line-height:1.45;scrollbar-width:thin}'
    + '.ga-msg{margin:6px 0;padding:7px 10px;border-radius:10px;word-break:break-word}'
    + '.ga-you{background:#fff;border:1px solid var(--ga-line);margin-left:28px;border-bottom-right-radius:3px;font-weight:600}'
    + '.ga-ai{background:var(--ga-paper-2);margin-right:16px;border-bottom-left-radius:3px}'
    + '.ga-fact{background:#fff;border:1px solid var(--ga-line);border-left:3px solid var(--ga-red);border-radius:4px 10px 10px 4px;margin-right:16px;padding:7px 10px}'
    + '.ga-fact .ga-fbody>b{display:block;color:var(--ga-red);font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}'
    + '.ga-num{font-weight:800;font-size:15px;color:var(--ga-ink);font-variant-numeric:tabular-nums}'
    + '.ga-sys{color:var(--ga-muted);font-size:11px;padding:4px 6px}'
    + '.ga-err{color:var(--ga-red);font-size:11px;background:#fdeaea;border:1px solid #f1c9c9}'
    + '.ga-note{font-size:10px;color:var(--ga-muted);margin-top:3px;line-height:1.4}'
    + '.ga-row{display:flex;gap:6px;margin-top:8px;align-items:center}'
    + '.ga-row input{flex:1;min-width:0;font:inherit;font-size:12px;padding:9px 13px;border:1px solid var(--ga-line);border-radius:999px;background:#fff;color:var(--ga-ink)}'
    + '.ga-row input:focus{outline:none;border-color:var(--ga-red);box-shadow:0 0 0 3px rgba(158,0,0,.12)}'
    + '.ga-send{flex:0 0 36px;width:36px;height:36px;border-radius:50%;border:none;background:var(--ga-red);color:#fff;font-size:13px;font-weight:800;cursor:pointer;box-shadow:0 2px 0 var(--ga-red-d);display:flex;align-items:center;justify-content:center;padding:0}'
    + '.ga-send:hover{background:var(--ga-red-d)}.ga-send:disabled{opacity:.55;cursor:default}'
    + '.ga-tools{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px}'
    + '.ga-tool{font:inherit;font-size:10.5px;font-weight:700;padding:7px 3px;border:1px solid var(--ga-line);border-radius:8px;background:var(--ga-paper-2);color:var(--ga-ink);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.ga-tool:hover{background:#fff;border-color:#c9bfb2}.ga-tool:disabled{opacity:.45;cursor:default}'
    + '.ga-tool.on{background:var(--ga-red);border-color:var(--ga-red);color:#fff}'
    + '.ga-eyebrow{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--ga-muted);margin:10px 0 4px}'
    + '.ga-chips{display:flex;flex-wrap:wrap;gap:4px}'
    + '.ga-chip{font-size:10.5px;font-weight:600;padding:4px 9px;border:1px solid var(--ga-line);border-radius:999px;background:#fff;cursor:pointer;color:var(--ga-ink)}'
    + '.ga-chip:hover{border-color:var(--ga-red);color:var(--ga-red);background:#fff6f6}'
    + '.ga-site{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--ga-muted);margin-top:10px;padding:6px 9px;border-radius:8px;background:var(--ga-paper-2)}'
    + '.ga-site::before{content:"";flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:#c9bfb2}'
    + '.ga-site.on{color:var(--ga-ink);font-weight:600}.ga-site.on::before{background:var(--ga-red)}'
    + '.ga-colors{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}'
    + '.ga-colors label{display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--ga-muted);padding:5px 7px;border:1px solid var(--ga-line);border-radius:8px;background:#fff;cursor:pointer}'
    + '.ga-colors input{width:22px;height:22px;padding:0;border:1px solid var(--ga-line);border-radius:6px;background:none;cursor:pointer}'
    + '.ga-foot{font-size:10px;color:var(--ga-muted);margin-top:8px;line-height:1.4}'
    + '.ga-prov{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px;vertical-align:middle;cursor:help;white-space:nowrap}.ga-prov i{font-style:normal}'
    + '.ga-v{background:#e8f5ea;border:1px solid #2e7d32;color:#1b5e20}.ga-a{background:#fff;border:1px solid #8d6e00;color:#6b5300}.ga-m{background:#f4f4f4;border:1px dashed #757575;color:#4a4a4a}';
  var CHIPS = ['зона охвата по методике', 'радиус 500 м и 1 км', 'население 1 км', 'здания 500 м', 'дороги 1 км', 'полигон', 'объедини', 'население в зоне', 'выдели дома выше 9 этажей', 'сделай здания синими', 'конкуренты 2 км', 'очистить', 'помощь'];

  function panelHtml() {
    return '<h3>Гео-агент <span class="ga-badge" title="Разбор запросов и все расчёты выполняются внутри CASE OS. Внешних платных сервисов ИИ нет.">свой движок</span></h3><div class="sbody">'
      + '<div class="ga-log" id="gaLog"><div class="ga-msg ga-sys">Укажите точку: кнопка «📍 Точка» и клик по карте, координаты («41.35, 69.28») или «адрес: …». Потом спрашивайте: «радиус 1 км и население», «здания и дороги 500 м», «полигон» (клики по карте, затем «готово»), «объедини», «население в зоне». У каждого числа - источник и уверенность. Агент свой и бесплатный: внешних сервисов ИИ нет.</div></div>'
      + '<div class="ga-row"><input id="gaInput" placeholder="Спросите: радиус 1 км и население" autocomplete="off" aria-label="Запрос гео-агенту"><button class="ga-send" id="gaSend" title="Отправить" aria-label="Отправить">➤</button></div>'
      + '<div class="ga-tools"><button class="ga-tool" id="gaPick" title="кликните по карте, чтобы задать точку">📍 Точка</button><button class="ga-tool" id="gaPoly" title="нарисовать зону кликами по карте">▱ Полигон</button><button class="ga-tool" id="gaDone" title="замкнуть полигон" disabled>✓ Готово</button><button class="ga-tool" id="gaPing" title="доступны ли с сервера здания OSM, геокодер и своя модель">⇄ Связь</button></div>'
      + '<div class="ga-eyebrow">Быстрые команды</div>'
      + '<div class="ga-chips">' + CHIPS.map(function (c) { return '<span class="ga-chip" data-q="' + esc(c) + '">' + esc(c) + '</span>'; }).join('') + '</div>'
      + '<div class="ga-site" id="gaSite">точка не задана</div>'
      + '<div class="ga-colors"><label>здания <input type="color" data-layer="buildings" value="' + ST.styles.buildings.color + '"></label><label>дороги <input type="color" data-layer="roads" value="' + ST.styles.roads.color + '"></label><label>зона <input type="color" data-layer="zone" value="' + ST.styles.zone.color + '"></label></div>'
      + '<div class="ga-foot">Здания, дороги, адреса: © OpenStreetMap contributors, ODbL. Население - расчёт по сетке, не факт.</div>'
      + '</div>';
  }
  function setBusy(on) { var b = $('gaSend'); if (b) { b.disabled = on; b.textContent = on ? '…' : '➤'; } }
  function syncColorInputs() { var host = $('gaPanel'); if (!host) return; host.querySelectorAll('input[type=color][data-layer]').forEach(function (i) { var st = ST.styles[i.getAttribute('data-layer')]; if (st) i.value = st.color; }); }
  function siteLabel() {
    var el = $('gaSite'); if (!el) return;
    el.classList.toggle('on', !!ST.site);
    el.textContent = ST.site ? ((ST.site.name || 'точка') + ' · ' + ST.site.lat.toFixed(4) + ', ' + ST.site.lon.toFixed(4) + (ST.zone.length ? ' · фигур в зоне: ' + ST.zone.length + (ST.merged ? ' (объединены)' : '') : '')) : 'точка не задана';
  }

  function install() {
    try {
      if (!document.getElementById('gaCss')) { var st = document.createElement('style'); st.id = 'gaCss'; st.textContent = CSS + '.ga-tbl{width:100%;border-collapse:collapse;font-size:11px;margin:4px 0}.ga-tbl th,.ga-tbl td{border-bottom:1px solid var(--ga-line);padding:2px 4px;text-align:right}.ga-tbl th:first-child,.ga-tbl td:first-child{text-align:left}.ga-tbl th{color:var(--ga-muted);font-weight:700}'; document.head.appendChild(st); }
      var left = document.querySelector('#mapT .left') || document.querySelector('.left');
      if (!left || $('gaPanel')) return;
      var sect = document.createElement('div'); sect.className = 'sect'; sect.id = 'gaPanel'; sect.innerHTML = panelHtml();
      var first = left.querySelector('.sect');
      if (first && first.nextSibling) left.insertBefore(sect, first.nextSibling); else left.appendChild(sect);
      sect.querySelector('h3').onclick = function () { sect.classList.toggle('closed'); };
      var inp = $('gaInput');
      function send() { var v = inp.value; inp.value = ''; ask(v); }
      $('gaSend').onclick = send;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      sect.querySelectorAll('.ga-chip').forEach(function (c) { c.onclick = function () { ask(c.getAttribute('data-q')); }; });
      sect.querySelectorAll('input[type=color][data-layer]').forEach(function (i) { i.addEventListener('input', function () { run('style_layer', { layer: i.getAttribute('data-layer'), color: i.value }); }); });
      $('gaPick').onclick = function () { setPick(!ST.pick); if (ST.pick) say('sys', esc(T('pickOn'))); };
      $('gaPoly').onclick = function () { ask('полигон'); };
      $('gaDone').onclick = function () { ask('готово'); };
      $('gaPing').onclick = function () { ask('проверь связь'); };
      var M = mapObj(); if (M) { M.on('click', onMapClick); M.on('dblclick', onMapDbl); }
      siteLabel();
    } catch (e) { try { console.warn('geo agent install', e); } catch (_) {} }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.source === 'asaas-os-v4' && e.data.type === 'asaas-geo-context') setTimeout(install, 60); });
  setTimeout(install, 1500);

  window.CASE_GEO_AGENT = {
    version: VERSION, TOOLS: TOOLS, run: run, ask: ask, parse: parse, state: ST, narrative: narrative,
    popInRadius: popInRadius, popInZone: popInZone, lens: lens, cellAreaM2: cellAreaM2, zoneAreaM2: zoneAreaM2, inRing: inRing, lineNearM: lineNearM, lineInZone: lineInZone,
    factHtml: factHtml, colorIn: colorIn, metersIn: metersIn, detectLang: detectLang, setPick: setPick, clearSite: clearSite, recolorCatchment: recolorCatchment, catchment: function () { return ST.catchment; },
    /* v4.75.0: панель инструментов карты рисует фигуры через агента и пишет в его журнал */
    say: say, renderZone: renderZone, addShape: addShape, removeShape: function (sh) { var i = ST.zone.indexOf(sh); if (i >= 0) { ST.zone.splice(i, 1); renderZone(); } return i >= 0; }, startDraw: startDraw, stopDraw: stopDraw
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4730-geo-agent'] = VERSION;
})();
