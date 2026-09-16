/* CASE OS v4.72.0 - гео-ассистент студии геоаналитики.
 *
 * Клиент выбирает участок и просит словами: «радиус 1 км и население», «покажи здания и
 * дороги», «выдели дома выше 9 этажей», «сделай здания красными». Так работают ассистенты
 * Aino World и Placer.ai. Отличие CASE в одном, и оно принципиальное:
 *
 * ── Модель пишет текст, но не выдумывает число
 *
 * Население в радиусе, число зданий, километры дорог считают инструменты в этом файле по
 * данным, у которых есть происхождение: источник, метод, дата, уверенность. Модель лишь
 * выбирает инструмент и пересказывает результат. Ассистент Aino отвечает «в радиусе 1 км
 * живёт 48 000 человек», и никто не знает, откуда цифра. Здесь каждая цифра приходит с
 * плашкой происхождения, той же, что появилась в v4.71.0 у ставок и площадей. Это не
 * украшение: именно это CASE показывает клиенту, когда тот спрашивает «откуда».
 *
 * ── Два пути разбора команды
 *
 *   1. Локальный разбор (regex) понимает типовые команды на русском, английском и узбекском
 *      и не требует ни ключа, ни сети. Работает в демо и если ключ API не настроен.
 *   2. Модель (Claude) через api/assistant.php понимает свободную речь, комбинирует
 *      инструменты и пишет короткий пересказ. Инструменты всё равно исполняются здесь.
 *
 * ── Почему инструменты исполняются в браузере, а не на сервере
 *
 * Карта, слои, выбранный проект и калиброванная сетка населения живут в этом окне. Сервер
 * ничего из этого не видит. Поэтому цикл «модель просит инструмент - инструмент исполнен -
 * модель продолжает» крутится с клиента; сервер без состояния и только держит ключ.
 *
 * ── Про население, честно
 *
 * Сетка населения (Kontur H3) сама помечена как «методологический слой, проверить
 * источник». Студия калибрует её на официальное население районов (Toshstat 01.01.2026),
 * что чинит суммы по районам, но не распределение внутри района. Поэтому число жителей
 * всегда идёт с уверенностью «расчёт» и с этим примечанием. Считаем по доле площади ячейки
 * внутри круга, а не «центроид попал / не попал»: ячейка около 0.7 км², круг 500 м - 0.8 км²,
 * и счёт по центроидам ошибался бы в разы.
 *
 * Модуль живёт внутри iframe студии, как v4630-huff.js: читает точку проекта из #proj и
 * CASE_GEO_DATA, рисует на глобальной карте map, к серверу с ключом ходит через родителя
 * (postMessage), потому что CSRF-токен есть только у родителя.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_ASSIST) return;

  var VERSION = '4.72.0';
  var PARAMS = new URLSearchParams(location.search);
  var EMBEDDED = PARAMS.get('embedded') === '1';
  var RADIUS_MAX = 3000;
  var MAX_ROUNDS = 6;           /* ходов модели на одну реплику: защита от зацикливания */

  var ST = {
    site: null,                 /* {lat, lon, name} */
    groups: {},                 /* имя слоя -> L.layerGroup */
    data: { buildings: null, roads: null },
    prov: { buildings: null, roads: null },
    styles: {
      buildings: { color: '#9E0000', fill: '#9E0000', opacity: 0.30, weight: 1 },
      roads:     { color: '#34495e', fill: '#34495e', opacity: 0.90, weight: 2.5 },
      radius:    { color: '#9E0000', fill: '#9E0000', opacity: 0.05, weight: 2 },
      isochrone: { color: '#e67e22', fill: '#e67e22', opacity: 0.12, weight: 2 },
      selection: { color: '#f2b90d', fill: '#f2b90d', opacity: 0.55, weight: 2 },
      site:      { color: '#9E0000', fill: '#ffffff', opacity: 1, weight: 3 }
    },
    transcript: [],             /* история для модели: {role, content:[blocks]} */
    busy: false,
    llm: { checked: false, configured: false, note: '' },
    pick: false,
    cellArea: null,             /* м², оценка по расстоянию между соседними ячейками */
    log: []
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

  /* Расстояние по прямой, км (гаверсинус). В студии есть такая же hav(); дублируем, чтобы
     модуль не зависел от имени функции в чужом файле. */
  function distKm(a, b, c, d) {
    var R = 6371, r = function (x) { return x * Math.PI / 180; };
    var s = Math.pow(Math.sin(r(c - a) / 2), 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.pow(Math.sin(r(d - b) / 2), 2);
    return R * 2 * Math.asin(Math.sqrt(s));
  }

  function clampRadius(m) {
    var n = num(m);
    if (n == null || n <= 0) return 1000;
    return Math.max(50, Math.min(RADIUS_MAX, Math.round(n)));
  }

  function group(name) {
    var M = mapObj(); if (!M) return null;
    if (!ST.groups[name]) ST.groups[name] = L.layerGroup().addTo(M);
    return ST.groups[name];
  }
  function clearGroup(name) { if (ST.groups[name]) ST.groups[name].clearLayers(); }

  /* Точка участка: заданная явно, иначе выбранный проект студии. */
  function projectNow() {
    try {
      var sel = $('proj'), g = geoData();
      if (g && g.PROJECTS && sel && g.PROJECTS[sel.value]) return g.PROJECTS[sel.value];
      if (typeof proj === 'function') return proj();
    } catch (e) {}
    return null;
  }
  function siteNow() {
    if (ST.site) return ST.site;
    var p = projectNow();
    if (p && num(p.lat) != null && num(p.lng) != null) return { lat: +p.lat, lon: +p.lng, name: p.name || 'проект' };
    return null;
  }

  /* ── Население: доля площади ячейки внутри круга ────────────────────────── */

  /* Площадь ячейки оцениваем по данным, а не берём константу: расстояние между соседними
     центрами у правильных шестиугольников равно √3·R, площадь (3√3/2)·R², откуда площадь =
     (√3/2)·d². Медиана по выборке устойчива к одиночным дырам в сетке. */
  function cellAreaM2(pop) {
    if (ST.cellArea) return ST.cellArea;
    var n = pop.length, ds = [];
    if (n < 10) return ST.cellArea = 737000;
    var step = Math.max(1, Math.floor(n / 150));
    for (var i = 0; i < n; i += step) {
      var a = pop[i], best = Infinity;
      for (var j = 0; j < n; j++) {
        if (j === i) continue;
        var b = pop[j];
        if (Math.abs(b[0] - a[0]) > 0.02 || Math.abs(b[1] - a[1]) > 0.03) continue;
        var d = distKm(a[0], a[1], b[0], b[1]);
        if (d > 0 && d < best) best = d;
      }
      if (best < Infinity) ds.push(best);
    }
    if (!ds.length) return ST.cellArea = 737000;
    ds.sort(function (x, y) { return x - y; });
    var dm = ds[Math.floor(ds.length / 2)] * 1000;      /* м */
    ST.cellArea = Math.round(Math.sqrt(3) / 2 * dm * dm);
    return ST.cellArea;
  }

  /* Площадь пересечения двух дисков радиусов R и r с расстоянием между центрами d. */
  function lens(R, r, d) {
    if (d >= R + r) return 0;
    if (d <= Math.abs(R - r)) return Math.PI * Math.min(R, r) * Math.min(R, r);
    var a = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r))
          + R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R))
          - 0.5 * Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
    return a;
  }

  function popInRadius(lat, lon, radiusM, pop) {
    var area = cellAreaM2(pop), rc = Math.sqrt(area / Math.PI), sum = 0, cells = 0, cellsFull = 0;
    for (var i = 0; i < pop.length; i++) {
      var h = pop[i];
      var d = distKm(lat, lon, h[0], h[1]) * 1000;
      if (d >= radiusM + rc) continue;
      var f = lens(radiusM, rc, d) / (Math.PI * rc * rc);
      if (f <= 0) continue;
      sum += h[2] * f; cells++; if (f >= 0.999) cellsFull++;
    }
    return { population: Math.round(sum), cells: cells, cellsFull: cellsFull, cellAreaM2: area };
  }

  /* Калибровка сетки. В студии POP стартует как сырая сетка Kontur и калибруется только при
     включении тепловой карты; без этого шага счёт завышен примерно вдвое по городу. */
  function ensureCalibrated() {
    try {
      if (typeof CAL !== 'undefined' && CAL) return Promise.resolve();
      if (typeof ensureGeo === 'function' && typeof calibrate === 'function') {
        return ensureGeo().then(function () { calibrate(); });
      }
    } catch (e) {}
    return Promise.resolve();
  }

  /* ── Инструменты ──────────────────────────────────────────────────────────── */

  function needSite() {
    var s = siteNow();
    if (!s) throw new Error('Участок не задан: выберите проект в списке, кликните по карте в режиме выбора или назовите координаты.');
    return s;
  }

  function drawSite(s) {
    if (!hasL()) return;
    var g = group('site'); g.clearLayers();
    var st = ST.styles.site;
    L.circleMarker([s.lat, s.lon], { radius: 8, color: st.color, weight: st.weight, fillColor: st.fill, fillOpacity: 1 })
      .bindTooltip(esc(s.name || 'участок'), { permanent: false }).addTo(g);
  }

  var TOOLS = {
    set_site: function (inp) {
      inp = inp || {};
      var s = null, g = geoData();
      if (inp.project_id && g && g.PROJECTS && g.PROJECTS[inp.project_id]) {
        var p = g.PROJECTS[inp.project_id];
        s = { lat: +p.lat, lon: +p.lng, name: p.name || String(inp.project_id) };
      } else if (num(inp.lat) != null && num(inp.lon) != null) {
        s = { lat: +inp.lat, lon: +inp.lon, name: inp.name || 'участок' };
      }
      if (!s || Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180) throw new Error('Нужны координаты (lat, lon) или project_id из списка проектов.');
      ST.site = s; drawSite(s);
      var M = mapObj(); if (M) try { M.setView([s.lat, s.lon], Math.max(M.getZoom(), 14)); } catch (e) {}
      return Promise.resolve({ ok: true, site: s });
    },

    draw_radius: function (inp) {
      var s = needSite();
      var radii = Array.isArray(inp && inp.radii_m) ? inp.radii_m.map(clampRadius) : [clampRadius(inp && inp.radius_m)];
      radii = radii.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return b - a; });
      if (inp && hexOk(inp.color)) { ST.styles.radius.color = inp.color; ST.styles.radius.fill = inp.color; }
      if (hasL()) {
        var g = group('radius'); g.clearLayers(); drawSite(s);
        var st = ST.styles.radius;
        radii.forEach(function (r) {
          L.circle([s.lat, s.lon], { radius: r, color: st.color, weight: st.weight, opacity: 0.95, fillColor: st.fill, fillOpacity: st.opacity })
            .bindTooltip(r >= 1000 ? (r / 1000) + ' км' : r + ' м', { sticky: true }).addTo(g);
        });
        try { mapObj().fitBounds(L.latLng(s.lat, s.lon).toBounds(radii[0] * 2.2)); } catch (e) {}
      }
      return Promise.resolve({ ok: true, radii_m: radii, drawn: true });
    },

    draw_isochrone: function (inp) {
      var s = needSite();
      var minutes = Math.max(1, Math.min(60, Math.round(num(inp && inp.minutes) || 10)));
      if (typeof isochrone !== 'function') return Promise.reject(new Error('Изохроны в этой сборке студии недоступны.'));
      if (inp && hexOk(inp.color)) { ST.styles.isochrone.color = inp.color; ST.styles.isochrone.fill = inp.color; }
      return Promise.resolve(isochrone(s.lat, s.lon, minutes)).then(function () {
        var g = null; try { g = (typeof gIso !== 'undefined') ? gIso : null; } catch (e) {}
        var n = 0; if (g) g.eachLayer(function () { n++; });
        if (!n) throw new Error('Маршрутизатор (OSRM) недоступен, изохрону построить нельзя. Можно взять радиус: 10 минут на автомобиле в городе примерно 3-4 км.');
        if (g) g.eachLayer(function (l) { try { l.setStyle({ color: ST.styles.isochrone.color, fillColor: ST.styles.isochrone.fill, fillOpacity: ST.styles.isochrone.opacity, weight: ST.styles.isochrone.weight }); } catch (e) {} });
        return { ok: true, minutes: minutes, drawn: true,
          provenance: { conf: 'modelled', source: 'OSRM (project-osrm.org), дороги OSM', method: '24 луча, время в пути по матрице OSRM, зона = точки, достижимые за ' + minutes + ' мин', at: today() } };
      });
    },

    count_population: function (inp) {
      var s = needSite(), r = clampRadius(inp && inp.radius_m);
      return ensureCalibrated().then(function () {
        var g = geoData(), pop = g && Array.isArray(g.POP) ? g.POP : null;
        if (!pop || !pop.length) throw new Error('Сетка населения не загружена.');
        var res = popInRadius(s.lat, s.lon, r, pop);
        var calibrated = false; try { calibrated = (typeof CAL !== 'undefined' && !!CAL); } catch (e) {}
        return { ok: true, radius_m: r, population: res.population, cells: res.cells, cell_area_m2: res.cellAreaM2,
          provenance: { conf: 'modelled',
            source: 'Сетка населения H3 (Kontur), ' + (calibrated ? 'откалибрована на официальное население районов (Toshstat, 01.01.2026)' : 'БЕЗ калибровки на районы'),
            method: 'сумма по ячейкам с долей площади ячейки внутри круга ' + r + ' м',
            at: today(),
            note: 'Источник сетки помечен «проверить»; распределение внутри района не подтверждено. Для решения брать как порядок величины, не как факт.' } };
      });
    },

    load_buildings: function (inp) {
      var s = needSite(), r = clampRadius(inp && inp.radius_m);
      if (inp && hexOk(inp.color)) { ST.styles.buildings.color = inp.color; ST.styles.buildings.fill = inp.color; }
      return fetchProxy('buildings', s, r, null).then(function (j) {
        var rows = (j.rows || []).filter(function (b) { return b.c && distKm(s.lat, s.lon, b.c[0], b.c[1]) * 1000 <= r; });
        ST.data.buildings = rows; ST.prov.buildings = j.provenance || null;
        renderBuildings();
        var area = 0, withLevels = 0, byKind = {}, maxLv = 0;
        rows.forEach(function (b) { area += b.area || 0; if (b.levels != null) { withLevels++; if (b.levels > maxLv) maxLv = b.levels; } var k = b.kind || 'без типа'; byKind[k] = (byKind[k] || 0) + 1; });
        var kinds = Object.keys(byKind).sort(function (a, b) { return byKind[b] - byKind[a]; }).slice(0, 6).map(function (k) { return { kind: k, count: byKind[k] }; });
        return { ok: true, radius_m: r, count: rows.length, footprint_area_m2: Math.round(area), with_levels: withLevels, max_levels: maxLv || null, by_kind: kinds,
          truncated: !!j.truncated, provenance: provFrom(j.provenance, r) };
      });
    },

    load_roads: function (inp) {
      var s = needSite(), r = clampRadius(inp && inp.radius_m);
      var classes = Array.isArray(inp && inp.classes) ? inp.classes.map(String) : null;
      if (inp && hexOk(inp.color)) { ST.styles.roads.color = inp.color; ST.styles.roads.fill = inp.color; }
      return fetchProxy('roads', s, r, classes).then(function (j) {
        /* Дорога считается в круге, если в круг попадает хотя бы одна её вершина ИЛИ отрезок
           проходит ближе радиуса к центру: длинный прямой проспект имеет вершины далеко за
           кругом и по одним вершинам выпал бы из выборки. */
        var rows = (j.rows || []).filter(function (w) { return lineNearM(w.line, s.lat, s.lon) <= r; });
        ST.data.roads = rows; ST.prov.roads = j.provenance || null;
        renderRoads();
        var byCls = {}, lengthKm = 0;
        rows.forEach(function (w) { byCls[w.cls || '?'] = (byCls[w.cls || '?'] || 0) + 1; lengthKm += lineKm(w.line); });
        var cls = Object.keys(byCls).sort(function (a, b) { return byCls[b] - byCls[a]; }).map(function (k) { return { cls: k, count: byCls[k] }; });
        return { ok: true, radius_m: r, count: rows.length, length_km: Math.round(lengthKm * 10) / 10, by_class: cls, named: rows.filter(function (w) { return w.name; }).length,
          truncated: !!j.truncated, provenance: provFrom(j.provenance, r) };
      });
    },

    style_layer: function (inp) {
      inp = inp || {};
      var layer = String(inp.layer || '');
      if (!ST.styles[layer]) throw new Error('Неизвестный слой: ' + layer + '. Доступны: buildings, roads, radius, isochrone, selection.');
      var st = ST.styles[layer];
      if (hexOk(inp.color)) { st.color = inp.color; if (!hexOk(inp.fill_color)) st.fill = inp.color; }
      if (hexOk(inp.fill_color)) st.fill = inp.fill_color;
      if (num(inp.opacity) != null) st.opacity = Math.max(0, Math.min(1, +inp.opacity));
      if (num(inp.weight) != null) st.weight = Math.max(0.5, Math.min(12, +inp.weight));
      restyle(layer);
      syncColorInputs();
      return Promise.resolve({ ok: true, layer: layer, style: { color: st.color, fill_color: st.fill, opacity: st.opacity, weight: st.weight } });
    },

    select_features: function (inp) {
      inp = inp || {};
      var layer = String(inp.layer || '');
      var src = ST.data[layer];
      if (!src) throw new Error('Слой ' + layer + ' ещё не загружен: сначала load_' + layer + '.');
      if (hexOk(inp.color)) { ST.styles.selection.color = inp.color; ST.styles.selection.fill = inp.color; }
      var q = (inp.name_contains ? String(inp.name_contains).toLowerCase() : '');
      var hit = src.filter(function (f) {
        if (layer === 'buildings') {
          if (num(inp.min_levels) != null && !(f.levels != null && f.levels >= +inp.min_levels)) return false;
          if (num(inp.max_levels) != null && !(f.levels != null && f.levels <= +inp.max_levels)) return false;
          if (inp.kind && !kindMatch(f.kind, String(inp.kind))) return false;
        } else {
          if (Array.isArray(inp.classes) && inp.classes.length && inp.classes.map(String).indexOf(f.cls) < 0) return false;
        }
        if (q && String(f.name || '').toLowerCase().indexOf(q) < 0 && String(f.addr || '').toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      renderSelection(layer, hit);
      var crit = [];
      if (num(inp.min_levels) != null) crit.push('этажей >= ' + inp.min_levels);
      if (num(inp.max_levels) != null) crit.push('этажей <= ' + inp.max_levels);
      if (inp.kind) crit.push('тип ' + inp.kind);
      if (Array.isArray(inp.classes) && inp.classes.length) crit.push('классы ' + inp.classes.join(','));
      if (q) crit.push('название содержит «' + q + '»');
      return Promise.resolve({ ok: true, layer: layer, matched: hit.length, of: src.length, criteria: crit.join('; ') || 'все',
        note: layer === 'buildings' && (num(inp.min_levels) != null || num(inp.max_levels) != null) ? 'Этажность в OSM заполнена не у всех зданий: здания без этажности в выборку не попали.' : '' });
    },

    count_competitors: function (inp) {
      var s = needSite(), r = clampRadius(inp && inp.radius_m);
      var g = geoData(), bc = g && Array.isArray(g.BC) ? g.BC : [];
      var eff_ = (typeof eff === 'function') ? eff : function (x) { return x; };
      var rows = bc.map(eff_).filter(function (b) { return num(b.lat) != null && num(b.lng) != null; })
        .map(function (b) { return { name: b.name || '', dist_m: Math.round(distKm(s.lat, s.lon, +b.lat, +b.lng) * 1000), cls: b.class || '', district: b.district || '' }; })
        .filter(function (b) { return b.dist_m <= r; }).sort(function (a, b) { return a.dist_m - b.dist_m; });
      return Promise.resolve({ ok: true, radius_m: r, business_centers: rows.length, nearest: rows.slice(0, 8),
        provenance: { conf: 'asking', source: 'база бизнес-центров CASE (2GIS, Google, Yandex, ручная сверка)', method: 'расстояние по прямой от участка до координаты объекта', at: today() } });
    },

    clear_layers: function (inp) {
      var want = Array.isArray(inp && inp.layers) && inp.layers.length ? inp.layers.map(String) : ['all'];
      var all = ['buildings', 'roads', 'radius', 'isochrone', 'selection'];
      var done = [];
      (want.indexOf('all') >= 0 ? all : want).forEach(function (n) {
        if (n === 'isochrone') { try { if (typeof gIso !== 'undefined' && gIso) gIso.clearLayers(); } catch (e) {} }
        else clearGroup(n);
        if (n === 'buildings') ST.data.buildings = null;
        if (n === 'roads') ST.data.roads = null;
        done.push(n);
      });
      return Promise.resolve({ ok: true, cleared: done });
    }
  };

  function kindMatch(kind, want) {
    kind = String(kind || '').toLowerCase(); want = want.toLowerCase();
    if (want === 'residential') return /^(residential|apartments|house|detached|dormitory|terrace|semidetached_house)$/.test(kind);
    if (want === 'commercial') return /^(commercial|retail|office|supermarket|mall|kiosk|hotel)$/.test(kind);
    return kind === want;
  }
  /* Минимальное расстояние от точки до ломаной, м: по отрезкам на локальной плоскости. */
  function lineNearM(line, lat, lon) {
    var kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 111320, best = Infinity;
    for (var i = 0; i < (line || []).length; i++) {
      var ax = (line[i][1] - lon) * kx, ay = (line[i][0] - lat) * ky;
      var d = Math.sqrt(ax * ax + ay * ay); if (d < best) best = d;
      if (i === 0) continue;
      var bx = (line[i - 1][1] - lon) * kx, by = (line[i - 1][0] - lat) * ky;
      var vx = ax - bx, vy = ay - by, len2 = vx * vx + vy * vy;
      if (!len2) continue;
      var u = -(bx * vx + by * vy) / len2;
      if (u > 0 && u < 1) { var px = bx + u * vx, py = by + u * vy; var dd = Math.sqrt(px * px + py * py); if (dd < best) best = dd; }
    }
    return best;
  }
  function lineKm(line) { var s = 0; for (var i = 1; i < (line || []).length; i++) s += distKm(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]); return s; }
  function provFrom(p, r) {
    p = p || {};
    return { conf: p.conf || 'asking', source: (p.source || 'OpenStreetMap') + ' (' + (p.licence || 'ODbL') + ')', attribution: p.attribution || '© OpenStreetMap contributors',
      method: (p.method || 'Overpass API') + (p.cached ? ', из кэша сервера' : ''), at: (p.fetched_at || today()).slice(0, 10), radius_m: r };
  }

  /* Запросы к прокси идут прямо из iframe: это GET с cookie той же площадки, CSRF не нужен.
     Ошибка сервера читается как текст, чтобы страница входа или HTML хостинга не превращались
     в загадочный «Unexpected token <». */
  function fetchProxy(mode, s, r, classes) {
    var url = 'api/gis_proxy.php?mode=' + mode + '&provider=osm&lat=' + s.lat + '&lon=' + s.lon + '&radius_m=' + r + (classes && classes.length ? '&classes=' + encodeURIComponent(classes.join(',')) : '');
    return fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(function (rs) {
      return rs.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!j) throw new Error('сервер ответил не JSON (HTTP ' + rs.status + '): ' + t.slice(0, 120));
        if (!j.ok) throw new Error(j.message || j.error || ('HTTP ' + rs.status));
        return j;
      });
    });
  }

  /* ── Отрисовка ────────────────────────────────────────────────────────────── */

  function renderBuildings() {
    if (!hasL()) return;
    var g = group('buildings'); g.clearLayers();
    var st = ST.styles.buildings;
    (ST.data.buildings || []).forEach(function (b) {
      if (!b.ring || b.ring.length < 3) return;
      var tip = '<b>' + esc(b.name || (b.kind || 'здание')) + '</b>' + (b.levels != null ? '<br>этажей: ' + b.levels : '') + (b.area ? '<br>пятно: ' + fmt(b.area) + ' м²' : '') + (b.addr ? '<br>' + esc(b.addr) : '');
      L.polygon(b.ring, { color: st.color, weight: st.weight, opacity: 0.9, fillColor: st.fill, fillOpacity: st.opacity }).bindTooltip(tip, { sticky: true }).addTo(g);
    });
  }
  function renderRoads() {
    if (!hasL()) return;
    var g = group('roads'); g.clearLayers();
    var st = ST.styles.roads;
    (ST.data.roads || []).forEach(function (w) {
      var wt = st.weight * (/motorway|trunk|primary/.test(w.cls) ? 1.6 : /secondary|tertiary/.test(w.cls) ? 1.2 : 0.8);
      L.polyline(w.line, { color: st.color, weight: wt, opacity: st.opacity, lineJoin: 'round', lineCap: 'round' })
        .bindTooltip('<b>' + esc(w.name || 'без названия') + '</b><br>' + esc(w.cls) + (w.oneway ? ' · одностороннее' : ''), { sticky: true }).addTo(g);
    });
  }
  function renderSelection(layer, hit) {
    if (!hasL()) return;
    var g = group('selection'); g.clearLayers();
    var st = ST.styles.selection;
    hit.forEach(function (f) {
      if (layer === 'buildings') L.polygon(f.ring, { color: st.color, weight: st.weight, opacity: 1, fillColor: st.fill, fillOpacity: st.opacity }).addTo(g);
      else L.polyline(f.line, { color: st.color, weight: st.weight + 2, opacity: 1 }).addTo(g);
    });
  }
  function restyle(layer) {
    if (layer === 'buildings') return renderBuildings();
    if (layer === 'roads') return renderRoads();
    var st = ST.styles[layer], g = layer === 'isochrone' ? (function () { try { return gIso; } catch (e) { return null; } })() : ST.groups[layer];
    if (!g) return;
    g.eachLayer(function (l) { try { l.setStyle({ color: st.color, fillColor: st.fill, fillOpacity: st.opacity, weight: st.weight }); } catch (e) {} });
  }

  /* ── Локальный разбор команд ───────────────────────────────────────────────── */

  var COLORS = [
    [/красн|red|qizil/i, '#c0392b'], [/син|blue|ko.k/i, '#2e86de'], [/зел[её]н|green|yashil/i, '#27ae60'],
    [/ж[её]лт|yellow|sariq/i, '#f2b90d'], [/оранж|orange/i, '#e67e22'], [/ч[её]рн|black|qora/i, '#1c1f26'],
    [/сер|gr[ae]y|kulrang/i, '#7f8c8d'], [/фиолет|purple|violet/i, '#8e44ad'], [/бел|white|oq\b/i, '#ffffff'],
    [/розов|pink/i, '#e84393'], [/коричн|brown/i, '#8d6e63']
  ];
  function colorIn(text) {
    var m = text.match(/#[0-9a-f]{6}\b/i); if (m) return m[0].toLowerCase();
    for (var i = 0; i < COLORS.length; i++) if (COLORS[i][0].test(text)) return COLORS[i][1];
    return null;
  }
  function metersIn(text) {
    /* Без \b: в JS-regex без флага u граница слова не видит кириллицу, и «500 м и 1 км» терял «500 м». */
    var out = [], re = /(\d+(?:[.,]\d+)?)\s*(км|km|метр[а-я]*|meters?|metr|м(?![а-яa-z])|m(?![a-zа-я]))/gi, m;
    while ((m = re.exec(text))) {
      var v = parseFloat(m[1].replace(',', '.')), u = m[2].toLowerCase();
      out.push(Math.round(/км|km/.test(u) ? v * 1000 : v));
    }
    return out.filter(function (v, i, a) { return v > 0 && a.indexOf(v) === i; });
  }

  /* Возвращает список вызовов инструментов или null, если фраза не распознана. Порядок
     вызовов осмысленный: участок, потом контуры, потом счёт, потом выделение и цвет. */
  function parseLocal(text) {
    var t = String(text || '').trim(); if (!t) return null;
    var low = t.toLowerCase(), calls = [];
    var coords = t.match(/(-?\d{1,2}\.\d{3,})[,\s]+(-?\d{1,3}\.\d{3,})/);
    if (coords) calls.push({ name: 'set_site', input: { lat: parseFloat(coords[1]), lon: parseFloat(coords[2]) } });
    var meters = metersIn(low), r1 = meters.length ? meters[0] : 1000;
    var color = colorIn(low);
    var wantsClear = /очист|убер|сброс|clear|reset|tozala/.test(low);
    if (wantsClear && !/здани|дорог|радиус|кру[гж]|изохрон|выдел/.test(low)) { calls.push({ name: 'clear_layers', input: {} }); return calls; }

    /* «Сделай здания синими» - про цвет уже показанного слоя, а не про загрузку: нет ни метров,
       ни глагола загрузки. Иначе каждая перекраска тянула бы слой заново. */
    var styleIntent = !!color && /покрас|перекрас|цвет|colou?r|сделай|rang/.test(low) && !meters.length && !/покажи|загруз|show|load|добавь|нарисуй|выдел|только|only|select/.test(low);
    if (styleIntent) {
      var sl = /здани|дом|building|bino/.test(low) ? 'buildings' : /дорог|улиц|road|street/.test(low) ? 'roads' : /радиус|кру[гж]|circle/.test(low) ? 'radius' : /изохрон|isochron/.test(low) ? 'isochrone' : /выдел/.test(low) ? 'selection' : null;
      if (sl) { calls.push({ name: 'style_layer', input: { layer: sl, color: color } }); return calls; }
    }
    var mins = low.match(/(\d+)\s*(мин|minute|min\b|daqiqa)/);
    if (mins && /езд|доех|drive|driving|изохрон|isochron|мин|minute|daqiqa|авто/.test(low)) calls.push({ name: 'draw_isochrone', input: { minutes: parseInt(mins[1], 10) } });
    if (/радиус|кру[гж]|зон[аеуы]\b|radius|circle|radiusda/.test(low) && meters.length) calls.push({ name: 'draw_radius', input: { radii_m: meters } });

    if (/здани|дом[аов]?\b|застройк|building|bino/.test(low) && !/выдел|только|only|select/.test(low)) calls.push({ name: 'load_buildings', input: { radius_m: r1 } });
    if (/дорог|улиц|магистрал|road|street|yo.l|ko.cha/.test(low) && !/выдел|только|only|select/.test(low)) {
      var inp = { radius_m: r1 };
      if (/магистрал|главн|major|primary|trunk|arterial/.test(low)) inp.classes = ['motorway', 'trunk', 'primary', 'secondary'];
      calls.push({ name: 'load_roads', input: inp });
    }
    if (/населен|жител|люд|population|people|aholi|inhabit/.test(low)) {
      (meters.length ? meters : [r1]).forEach(function (r) { calls.push({ name: 'count_population', input: { radius_m: r } }); });
    }
    if (/конкурент|бизнес.центр|\bбц\b|competitor|business cent|raqobat/.test(low)) calls.push({ name: 'count_competitors', input: { radius_m: r1 } });

    if (/выдел|покажи только|только|only|select|highlight|ajrat/.test(low)) {
      var lv = low.match(/(\d+)\s*(этаж|floor|level|qavat)/);
      var sel = null;
      if (/здани|дом|building|bino|этаж|floor|qavat/.test(low)) {
        sel = { layer: 'buildings' };
        if (lv) { if (/ниже|меньше|до\s|below|under|less|max/.test(low)) sel.max_levels = parseInt(lv[1], 10); else sel.min_levels = parseInt(lv[1], 10); }
        if (/жил|residential|apartment|turar/.test(low)) sel.kind = 'residential';
        if (/коммерч|торгов|офис|commercial|retail|office|savdo/.test(low)) sel.kind = 'commercial';
      } else if (/дорог|улиц|магистрал|road|street/.test(low)) {
        sel = { layer: 'roads' };
        if (/магистрал|главн|major|primary|trunk/.test(low)) sel.classes = ['motorway', 'trunk', 'primary', 'secondary'];
      }
      if (sel) { if (color) sel.color = color; calls.push({ name: 'select_features', input: sel }); }
    }
    if (color && !calls.some(function (c) { return c.name === 'select_features'; })) {
      var layer = /здани|дом|building|bino/.test(low) ? 'buildings' : /дорог|улиц|road|street/.test(low) ? 'roads' : /радиус|кру[гж]|circle/.test(low) ? 'radius' : /изохрон/.test(low) ? 'isochrone' : /выдел/.test(low) ? 'selection' : null;
      if (layer) {
        /* «загрузи здания красным» = цвет в самом вызове, а не отдельный style_layer после */
        var loader = calls.find(function (c) { return c.name === 'load_' + layer || (layer === 'radius' && c.name === 'draw_radius'); });
        if (loader) loader.input.color = color; else calls.push({ name: 'style_layer', input: { layer: layer, color: color } });
      }
    }
    return calls.length ? calls : null;
  }

  /* ── Исполнение и журнал ──────────────────────────────────────────────────── */

  function run(name, input) {
    var fn = TOOLS[name];
    if (!fn) return Promise.reject(new Error('Неизвестный инструмент: ' + name));
    var p; try { p = fn(input || {}); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(p);
  }

  var TOOL_RU = { set_site: 'Участок', draw_radius: 'Радиус', draw_isochrone: 'Изохрона', count_population: 'Население', load_buildings: 'Здания', load_roads: 'Дороги', style_layer: 'Стиль слоя', select_features: 'Выделение', count_competitors: 'Конкуренты', clear_layers: 'Очистка' };
  var CONF_RU = { verified: ['✓', 'подтв.', 'ga-v'], asking: ['≈', 'наблюдение', 'ga-a'], modelled: ['ƒ', 'расчёт', 'ga-m'] };

  function provChip(p) {
    if (!p) return '';
    var c = CONF_RU[p.conf] || CONF_RU.modelled;
    var tip = (p.source ? 'Источник: ' + p.source + '\n' : '') + (p.method ? 'Метод: ' + p.method + '\n' : '') + (p.at ? 'Дата: ' + p.at + '\n' : '') + (p.note || '');
    return '<span class="ga-prov ' + c[2] + '" title="' + esc(tip.trim()) + '"><i>' + c[0] + '</i>' + c[1] + '</span>';
  }

  /* Факты рисуются отдельно от текста модели и только из результата инструмента: так видно,
     где число, а где пересказ. */
  function factHtml(name, res) {
    var h = '<div class="ga-fbody"><b>' + esc(TOOL_RU[name] || name) + '</b> ';
    switch (name) {
      case 'set_site': h += esc(res.site.name) + ' · ' + res.site.lat.toFixed(5) + ', ' + res.site.lon.toFixed(5); break;
      case 'draw_radius': h += res.radii_m.map(function (r) { return r >= 1000 ? (r / 1000) + ' км' : r + ' м'; }).join(', ') + ' нарисовано'; break;
      case 'draw_isochrone': h += res.minutes + ' мин на автомобиле ' + provChip(res.provenance); break;
      case 'count_population': h += '<span class="ga-num">' + fmt(res.population) + '</span> жителей в радиусе ' + res.radius_m + ' м ' + provChip(res.provenance) + '<div class="ga-note">' + esc(res.provenance.note) + '</div>'; break;
      case 'load_buildings': h += '<span class="ga-num">' + fmt(res.count) + '</span> зданий в ' + res.radius_m + ' м, пятно застройки ' + fmt(res.footprint_area_m2) + ' м²' + (res.max_levels ? ', до ' + res.max_levels + ' этажей' : '') + ' ' + provChip(res.provenance) + '<div class="ga-note">' + esc(res.provenance.attribution) + (res.truncated ? ' · выборка обрезана лимитом, уменьшите радиус' : '') + '</div>'; break;
      case 'load_roads': h += '<span class="ga-num">' + fmt(res.count) + '</span> участков дорог, ' + res.length_km + ' км в ' + res.radius_m + ' м ' + provChip(res.provenance) + '<div class="ga-note">' + res.by_class.slice(0, 4).map(function (c) { return esc(c.cls) + ' ' + c.count; }).join(' · ') + ' · ' + esc(res.provenance.attribution) + '</div>'; break;
      case 'style_layer': h += esc(res.layer) + ': ' + esc(res.style.color) + ', заливка ' + res.style.opacity + ', линия ' + res.style.weight; break;
      case 'select_features': h += '<span class="ga-num">' + fmt(res.matched) + '</span> из ' + fmt(res.of) + ' (' + esc(res.criteria) + ')' + (res.note ? '<div class="ga-note">' + esc(res.note) + '</div>' : ''); break;
      case 'count_competitors': h += '<span class="ga-num">' + fmt(res.business_centers) + '</span> БЦ в ' + res.radius_m + ' м ' + provChip(res.provenance) + (res.nearest.length ? '<div class="ga-note">' + res.nearest.slice(0, 4).map(function (b) { return esc(b.name) + ' (' + b.dist_m + ' м)'; }).join(', ') + '</div>' : ''); break;
      case 'clear_layers': h += 'убрано: ' + esc(res.cleared.join(', ')); break;
      default: h += esc(JSON.stringify(res)).slice(0, 200);
    }
    return h + '</div>';
  }

  function say(who, html) {
    ST.log.push({ who: who, html: html });
    var box = $('gaLog'); if (!box) return;
    var d = document.createElement('div'); d.className = 'ga-msg ga-' + who; d.innerHTML = html; box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  /* Локальный путь: разобрали, исполнили, показали факты. Без модели и без пересказа. */
  function runLocal(text) {
    var calls = parseLocal(text);
    if (!calls) { say('sys', 'Не понял команду. Примеры: «радиус 1 км и население», «здания 500 м», «дороги 1 км», «выдели дома выше 9 этажей», «сделай здания синими», «очистить».'); return Promise.resolve(false); }
    var chain = Promise.resolve();
    calls.forEach(function (c) {
      chain = chain.then(function () {
        return run(c.name, c.input).then(function (res) { say('fact', factHtml(c.name, res)); },
          function (e) { say('err', esc(TOOL_RU[c.name] || c.name) + ': ' + esc(e && e.message || e)); });
      });
    });
    return chain.then(function () { return true; });
  }

  /* ── Модель через родителя ─────────────────────────────────────────────────── */

  var pending = {}, seq = 0;
  function bridge(action, payload) {
    return new Promise(function (res, rej) {
      if (!EMBEDDED || window.parent === window) { rej(new Error('standalone')); return; }
      var id = 'ga' + (++seq);
      pending[id] = { res: res, rej: rej, t: setTimeout(function () { delete pending[id]; rej(new Error('нет ответа от платформы (таймаут)')); }, 150000) };
      try { window.parent.postMessage({ source: 'asaas-geo-v42', type: 'asaas-geo-assistant', reqId: id, action: action, payload: payload || {} }, location.origin); }
      catch (e) { clearTimeout(pending[id].t); delete pending[id]; rej(e); }
    });
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== 'asaas-os-v4' || e.data.type !== 'asaas-geo-assistant-reply') return;
    var p = pending[e.data.reqId]; if (!p) return;
    clearTimeout(p.t); delete pending[e.data.reqId];
    if (e.data.ok) p.res(e.data.data); else p.rej(new Error(e.data.error || 'ошибка платформы'));
  });

  function projectsForModel() {
    var g = geoData(), out = [];
    try { Object.keys((g && g.PROJECTS) || {}).forEach(function (k) { var p = g.PROJECTS[k]; if (p && num(p.lat) != null) out.push({ id: k, name: p.name || k, lat: +p.lat, lng: +p.lng }); }); } catch (e) {}
    return out.slice(0, 40);
  }
  function langNow() { try { return (window.GEO_LANG || document.documentElement.lang || 'ru').slice(0, 2); } catch (e) { return 'ru'; } }

  function checkLLM() {
    if (ST.llm.checked) return Promise.resolve(ST.llm.configured);
    return bridge('status', {}).then(function (j) {
      ST.llm.checked = true; ST.llm.configured = !!(j && j.configured);
      if (!ST.llm.configured) ST.llm.note = j && j.demo ? 'Демо-режим: команды исполняются без модели.' : 'Ключ модели не настроен (anthropic_api_key в os/api/config.php): команды исполняются без пересказа.';
      return ST.llm.configured;
    }, function () { ST.llm.checked = true; ST.llm.configured = false; ST.llm.note = EMBEDDED ? 'Платформа не ответила: команды исполняются без модели.' : 'Отдельное окно студии: модель доступна только внутри CASE OS, команды работают.'; return false; });
  }

  /* Ход модели. Транскрипт хранится целиком: сервер без состояния. Все результаты
     инструментов одного хода уходят одним сообщением, как требует API. */
  function askModel(text) {
    var site = siteNow();
    ST.transcript.push({ role: 'user', content: [{ type: 'text', text: text }] });
    var rounds = 0;
    function step() {
      if (++rounds > MAX_ROUNDS) { say('sys', 'Слишком длинная цепочка инструментов, остановился.'); return Promise.resolve(); }
      return bridge('chat', { messages: ST.transcript, site: site, projects: projectsForModel(), lang: langNow() }).then(function (j) {
        if (!j || j.ok === false) {
          if (j && j.needs_key) { ST.llm.configured = false; ST.llm.note = j.message || ''; say('sys', esc(ST.llm.note)); ST.transcript.pop(); return runLocal(text); }
          throw new Error((j && (j.message || j.error)) || 'пустой ответ');
        }
        var content = Array.isArray(j.content) ? j.content : [];
        if (content.length) ST.transcript.push({ role: 'assistant', content: content });
        content.forEach(function (b) { if (b.type === 'text' && b.text) say('ai', esc(b.text).replace(/\n/g, '<br>')); });
        var uses = content.filter(function (b) { return b.type === 'tool_use'; });
        if (!uses.length || j.stop_reason !== 'tool_use') return;
        var results = [];
        var chain = Promise.resolve();
        uses.forEach(function (u) {
          chain = chain.then(function () {
            return run(u.name, u.input).then(function (res) {
              say('fact', factHtml(u.name, res));
              results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(res) });
            }, function (e) {
              say('err', esc(TOOL_RU[u.name] || u.name) + ': ' + esc(e && e.message || e));
              results.push({ type: 'tool_result', tool_use_id: u.id, is_error: true, content: String(e && e.message || e) });
            });
          });
        });
        return chain.then(function () { ST.transcript.push({ role: 'user', content: results }); site = siteNow(); return step(); });
      });
    }
    return step();
  }

  function ask(text) {
    text = String(text || '').trim();
    if (!text || ST.busy) return Promise.resolve();
    ST.busy = true; say('you', esc(text)); setBusy(true);
    return checkLLM().then(function (ok) {
      if (!ok) { if (ST.llm.note && !ST.llm.noted) { ST.llm.noted = true; say('sys', esc(ST.llm.note)); } return runLocal(text); }
      return askModel(text).catch(function (e) { say('err', 'Модель: ' + esc(e && e.message || e) + '. Пробую разобрать команду локально.'); return runLocal(text); });
    }).then(function () { ST.busy = false; setBusy(false); }, function (e) { ST.busy = false; setBusy(false); say('err', esc(e && e.message || e)); });
  }

  /* ── Панель ────────────────────────────────────────────────────────────────── */

  var CSS = ''
    + '.ga-log{max-height:280px;overflow:auto;border:1px solid var(--line,#e3e6ec);border-radius:8px;padding:6px;background:#fafaf9;font-size:11.5px;line-height:1.4}'
    + '.ga-msg{margin:4px 0;padding:6px 8px;border-radius:8px;word-break:break-word}'
    + '.ga-you{background:#fff;border:1px solid var(--line,#e3e6ec);margin-left:18px}'
    + '.ga-ai{background:#f3efe9}'
    + '.ga-fact{background:#fff;border-left:3px solid #9E0000;padding:5px 8px;margin:4px 0;border-radius:0 8px 8px 0}'
    + '.ga-sys{color:var(--muted,#646a77);font-size:11px}'
    + '.ga-err{color:#9E0000;font-size:11px}'
    + '.ga-num{font-weight:800;font-size:13px}'
    + '.ga-note{font-size:10px;color:var(--muted,#646a77);margin-top:2px}'
    + '.ga-row{display:flex;gap:6px;margin-top:6px}'
    + '.ga-row input{flex:1;font:inherit;font-size:12px;padding:6px 8px;border:1px solid var(--line,#e3e6ec);border-radius:7px;min-width:0}'
    + '.ga-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}'
    + '.ga-chip{font-size:10.5px;padding:3px 7px;border:1px solid var(--line,#e3e6ec);border-radius:12px;background:#fff;cursor:pointer;color:var(--ink,#1c1f26)}'
    + '.ga-chip:hover{border-color:#9E0000;color:#9E0000}'
    + '.ga-colors{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:8px;font-size:10.5px;color:var(--muted,#646a77)}'
    + '.ga-colors label{display:flex;align-items:center;gap:4px}'
    + '.ga-colors input{width:26px;height:20px;padding:0;border:1px solid var(--line,#e3e6ec);border-radius:4px;background:none}'
    + '.ga-site{font-size:11px;color:var(--muted,#646a77);margin-top:6px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}'
    + '.ga-pick.on{border-color:#9E0000;color:#9E0000}'
    /* Плашки происхождения: та же азбука, что в v4710-provenance.js - значок, рамка, слово. */
    + '.ga-prov{display:inline-flex;align-items:center;gap:3px;font-size:9.5px;font-weight:700;padding:1px 5px;border-radius:8px;margin-left:4px;vertical-align:middle;cursor:help;white-space:nowrap}'
    + '.ga-prov i{font-style:normal}'
    + '.ga-v{background:#e8f5ea;border:1px solid #2e7d32;color:#1b5e20}'
    + '.ga-a{background:#fff;border:1px solid #8d6e00;color:#6b5300}'
    + '.ga-m{background:#f4f4f4;border:1px dashed #757575;color:#4a4a4a}';

  var CHIPS = ['радиус 500 м и 1 км', 'население 1 км', 'здания 500 м', 'дороги 1 км', 'конкуренты 2 км', 'выдели дома выше 9 этажей', 'сделай здания синими', 'очистить'];

  function panelHtml() {
    return '<h3>Ассистент</h3><div class="sbody">'
      + '<div class="ga-log" id="gaLog"><div class="ga-msg ga-sys">Задайте участок и спросите: «радиус 1 км и население», «покажи здания и дороги», «выдели дома выше 9 этажей». Каждое число придёт с источником и уверенностью.</div></div>'
      + '<div class="ga-row"><input id="gaInput" placeholder="Что сделать на карте?" autocomplete="off"><button class="btn pri" id="gaSend" style="font-size:11px">→</button></div>'
      + '<div class="ga-chips">' + CHIPS.map(function (c) { return '<span class="ga-chip" data-q="' + esc(c) + '">' + esc(c) + '</span>'; }).join('') + '</div>'
      + '<div class="ga-site"><span id="gaSite">участок: проект из списка</span><button class="btn sec ga-pick" id="gaPick" style="font-size:10.5px;padding:3px 8px">выбрать кликом</button></div>'
      + '<div class="ga-colors">'
      + '<label>здания <input type="color" data-layer="buildings" value="' + ST.styles.buildings.color + '"></label>'
      + '<label>дороги <input type="color" data-layer="roads" value="' + ST.styles.roads.color + '"></label>'
      + '<label>радиус <input type="color" data-layer="radius" value="' + ST.styles.radius.color + '"></label>'
      + '</div>'
      + '<div class="ga-note" style="margin-top:6px">Здания и дороги: © OpenStreetMap contributors, ODbL. Число жителей - расчёт по сетке, не факт.</div>'
      + '</div>';
  }

  function setBusy(on) { var b = $('gaSend'); if (b) { b.disabled = on; b.textContent = on ? '…' : '→'; } }
  function syncColorInputs() {
    var host = $('gaPanel'); if (!host) return;
    host.querySelectorAll('input[type=color][data-layer]').forEach(function (i) { var st = ST.styles[i.getAttribute('data-layer')]; if (st) i.value = st.color; });
  }
  function siteLabel() {
    var el = $('gaSite'); if (!el) return;
    var s = siteNow();
    el.textContent = s ? ('участок: ' + (s.name || '') + ' ' + s.lat.toFixed(4) + ', ' + s.lon.toFixed(4)) : 'участок не задан';
  }

  function install() {
    try {
      if (!document.getElementById('gaCss')) { var st = document.createElement('style'); st.id = 'gaCss'; st.textContent = CSS; document.head.appendChild(st); }
      var left = document.querySelector('#mapT .left') || document.querySelector('.left');
      if (!left || $('gaPanel')) return;
      var sect = document.createElement('div'); sect.className = 'sect'; sect.id = 'gaPanel'; sect.innerHTML = panelHtml();
      /* Сразу после секции «Проект»: ассистент - способ работать с картой, а не ещё один слой. */
      var first = left.querySelector('.sect');
      if (first && first.nextSibling) left.insertBefore(sect, first.nextSibling); else left.appendChild(sect);
      var hd = sect.querySelector('h3'); hd.onclick = function () { sect.classList.toggle('closed'); };
      var inp = $('gaInput'), btn = $('gaSend');
      function send() { var v = inp.value; inp.value = ''; ask(v); }
      btn.onclick = send;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } });
      sect.querySelectorAll('.ga-chip').forEach(function (c) { c.onclick = function () { ask(c.getAttribute('data-q')); }; });
      sect.querySelectorAll('input[type=color][data-layer]').forEach(function (i) {
        i.addEventListener('input', function () { run('style_layer', { layer: i.getAttribute('data-layer'), color: i.value }); });
      });
      $('gaPick').onclick = function () { ST.pick = !ST.pick; $('gaPick').classList.toggle('on', ST.pick); $('gaPick').textContent = ST.pick ? 'кликните по карте…' : 'выбрать кликом'; };
      var M = mapObj();
      if (M) M.on('click', function (e) {
        if (!ST.pick) return;
        ST.pick = false; $('gaPick').classList.remove('on'); $('gaPick').textContent = 'выбрать кликом';
        run('set_site', { lat: e.latlng.lat, lon: e.latlng.lng, name: 'точка на карте' }).then(function (res) { say('fact', factHtml('set_site', res)); siteLabel(); });
      });
      var sel = $('proj'); if (sel) sel.addEventListener('change', function () { ST.site = null; siteLabel(); });
      siteLabel();
    } catch (e) { try { console.warn('geo assistant install', e); } catch (_) {} }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
  /* Студия проверяет доступ асинхронно и может перестроить панель; повторяем установку
     после прихода контекста от родителя и по таймеру. install() идемпотентна. */
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.source === 'asaas-os-v4' && e.data.type === 'asaas-geo-context') setTimeout(function () { install(); siteLabel(); }, 60); });
  setTimeout(install, 1500);

  window.CASE_GEO_ASSIST = {
    version: VERSION, TOOLS: TOOLS, run: run, ask: ask, parseLocal: parseLocal, state: ST,
    popInRadius: popInRadius, lens: lens, lineNearM: lineNearM, cellAreaM2: cellAreaM2, siteNow: siteNow, factHtml: factHtml, colorIn: colorIn, metersIn: metersIn
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4720-geo-assistant'] = VERSION;
})();
