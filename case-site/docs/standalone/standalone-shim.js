/* CASE Geo Analytics, автономная версия: сервер CASE OS заменён браузером.
 *
 * Студия геоаналытики написана как экран CASE OS: она ходит за данными и правами в PHP-API
 * (api/*.php) и берёт границы районов из папки data/. В одном файле, который открывают с
 * диска или кладут на любой статический хостинг, ничего этого нет. Этот сценарий загружается
 * первым и перехватывает fetch: всё, что раньше делал сервер, делает браузер.
 *
 *   api/auth.php, api/workspace_access.php  -> вход не нужен, правка разрешена (данные живут
 *                                              в localStorage этого браузера)
 *   api/geo_master.php?file=runtime.json    -> мастер-геобаза, встроенная в файл при сборке
 *   data/tashkent_districts.geojson         -> границы районов, встроенные при сборке
 *   api/gis_proxy.php?mode=poi              -> Overpass API напрямую из браузера, тот же
 *                                              разбор, что в os/api/gis_proxy.php
 *   api/gis_proxy.php?mode=buildings|roads  -> Overpass напрямую, разбор как в os/api/osm_lib.php
 *   api/gis_proxy.php?mode=geocode          -> Nominatim напрямую
 *   api/gis_proxy.php?mode=ping             -> проверка Overpass и Nominatim из браузера
 *   api/llm.php                             -> своей модели нет, агент честно говорит об этом
 *   остальное api/*                         -> «сервера нет», без падений
 *
 * Условия использования: OpenStreetMap по ODbL, атрибуция сохранена во всех ответах;
 * Overpass и Nominatim - общедоступные серверы с ограничением частоты, файл не спамит:
 * здания и дороги кэшируются в памяти на полчаса, адреса - на время сеанса.
 * Никаких ключей и платных сервисов внутри нет. Длинных тире в тексте нет намеренно.
 */
(function () {
  'use strict';
  if (window.CASE_STANDALONE) return;
  var DATA = window.CASE_STANDALONE_DATA || {};
  var S = window.CASE_STANDALONE = {
    version: '%VERSION%', built: '%BUILT%',
    overpass: 'https://overpass-api.de/api/interpreter',
    nominatim: 'https://nominatim.openstreetmap.org',
    log: [], cache: {}, geocodeCache: {}
  };
  var realFetch = window.fetch.bind(window);

  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  function fail(message, status) { return jsonResponse({ ok: false, error: message, message: message }, status || 400); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
  function withTimeout(ms) {
    var c = typeof AbortController === 'function' ? new AbortController() : null;
    if (c) setTimeout(function () { try { c.abort(); } catch (e) {} }, ms);
    return c ? c.signal : undefined;
  }
  function getText(url, timeoutMs) {
    var t0 = Date.now();
    return realFetch(url, { signal: withTimeout(timeoutMs || 60000), cache: 'no-store' }).then(function (r) {
      return r.text().then(function (t) { return { status: r.status, body: t, ms: Date.now() - t0 }; });
    }, function (e) { return { status: 0, body: '', error: String(e && e.message || e), ms: Date.now() - t0 }; });
  }
  function overpass(ql, timeoutMs) {
    return getText(S.overpass + '?data=' + encodeURIComponent(ql), timeoutMs).then(function (r) {
      if (r.status === 0) throw new Error('Overpass API недоступен из браузера' + (r.error ? ' (' + r.error + ')' : '') + '. Проверьте интернет или повторите позже.');
      if (r.status === 429 || r.status === 504) throw new Error('Overpass API перегружен (HTTP ' + r.status + '). Повторите через минуту или уменьшите участок.');
      var j = null; try { j = JSON.parse(r.body); } catch (e) {}
      if (!j || !Array.isArray(j.elements)) throw new Error('Overpass вернул неожиданный ответ (HTTP ' + r.status + ').');
      return j.elements;
    });
  }

  /* ── Городские объекты (POI): те же теги, что в os/api/gis_proxy.php ─────────── */
  var POI_FILTERS = {
    hotels: ['tourism~"hotel|apartment|guest_house|hostel|motel"'],
    shopping: ['shop=mall', 'shop=department_store'],
    street_retail: ['shop~"clothes|shoes|bag|jewelry|watches|electronics|appliance|computer|books|furniture|interior_decoration|hairdresser|beauty|cosmetics|perfumery|bakery|confectionery|pastry|florist|gift_shop|toys|sports|stationery|mobile_phone|optician|variety_store"'],
    supermarkets: ['shop~"supermarket|convenience"'],
    markets: ['amenity=marketplace', 'market=flea_market'],
    restaurants: ['amenity=restaurant'],
    cafes: ['amenity~"cafe|ice_cream"', 'shop~"coffee|tea"'],
    fast_food: ['amenity~"fast_food|food_court"'],
    parks: ['leisure~"park|garden|nature_reserve|recreation_ground"'],
    playgrounds: ['leisure=playground'],
    entertainment: ['amenity~"cinema|nightclub"', 'leisure~"amusement_arcade|water_park|bowling_alley"', 'tourism~"theme_park|aquarium"'],
    sports: ['leisure~"sports_centre|fitness_centre|stadium|swimming_pool|ice_rink|sports_hall"'],
    education: ['amenity~"school|university|college|kindergarten|language_school|music_school|driving_school|training"', 'office=educational_institution'],
    residential: ['building~"apartments|residential"'],
    warehouses: ['building~"warehouse|industrial"', 'landuse=industrial', 'office=logistics'],
    parking: ['amenity=parking', 'building~"parking|garages"'],
    transport_hubs: ['highway=bus_stop', 'railway~"station|halt"', 'amenity=bus_station', 'aeroway=aerodrome'],
    culture: ['amenity~"theatre|museum|arts_centre|library|community_centre|social_centre"', 'tourism~"museum|gallery"'],
    tourism: ['tourism~"attraction|viewpoint|artwork|zoo"', 'historic~"monument|memorial|archaeological_site|castle|ruins"'],
    finance: ['amenity~"bank|atm|bureau_de_change|money_transfer"'],
    government: ['amenity~"townhall|courthouse|police|post_office"', 'office=government'],
    fuel_auto: ['amenity~"fuel|car_wash|charging_station"', 'shop~"car|car_repair|car_parts|tyres"'],
    mahallas: ['place~"neighbourhood|quarter"']
  };
  var MODE_RU = { bus: 'автобус', trolleybus: 'троллейбус', minibus: 'маршрутка', share_taxi: 'маршрутка', tram: 'трамвай', subway: 'метро' };
  function natcmp(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }
  function transportRows(elements) {
    var stops = {}, routesBy = {}, routeList = {};
    elements.forEach(function (el) {
      if (el.type === 'relation') {
        var t = el.tags || {}, mode = MODE_RU[t.route] || 'транспорт', ref = String(t.ref || '').trim(), label = ref || String(t.name || '').trim();
        if (!label) return;
        routeList[mode + ' ' + label] = { mode: mode, ref: label, name: String(t.name || '') };
        (el.members || []).forEach(function (m) {
          if (m.type !== 'node') return; var rid = String(m.ref || ''); if (!rid) return;
          routesBy[rid] = routesBy[rid] || {}; routesBy[rid][mode] = routesBy[rid][mode] || [];
          if (routesBy[rid][mode].indexOf(label) < 0) routesBy[rid][mode].push(label);
        });
        return;
      }
      var lat = el.lat != null ? el.lat : (el.center && el.center.lat), lon = el.lon != null ? el.lon : (el.center && el.center.lon);
      if (lat == null || lon == null) return;
      var tg = el.tags || {};
      if (tg.public_transport === 'platform' && tg.highway !== 'bus_stop' && !('bus' in tg) && !('trolleybus' in tg) && !('tram' in tg)) return;
      stops[String(el.id || '')] = { lat: +lat, lon: +lon, tags: tg };
    });
    function hub(t) {
      if (t.aeroway === 'aerodrome') return ['aerodrome', 'Аэропорт'];
      if (t.amenity === 'bus_station') return ['bus_station', 'Автовокзал'];
      if (t.railway === 'tram_stop') return ['tram_stop', 'Трамвайная остановка'];
      if (t.railway === 'station' || t.railway === 'halt') return ['station', t.station === 'subway' ? 'Станция метро' : 'Ж/д станция'];
      return ['bus_stop', 'Автобусная остановка'];
    }
    var out = [], seen = {}, withRoutes = 0;
    Object.keys(stops).forEach(function (id) {
      var st = stops[id], t = st.tags, h = hub(t), rts = routesBy[id] || {}, parts = [], all = [];
      Object.keys(rts).forEach(function (mode) { var nums = rts[mode].slice().sort(natcmp); parts.push(mode + ': ' + nums.join(', ')); all = all.concat(nums); });
      var routesTxt = parts.join(' · '); if (routesTxt) withRoutes++;
      var street = String(t['addr:street'] || '').trim(), name = String(t.name || '').trim();
      if (!name) name = street ? h[1] + ' - ' + street : (routesTxt ? h[1] + ' - ' + all.join(', ') : h[1] + ' без названия');
      var key = st.lat.toFixed(5) + ',' + st.lon.toFixed(5) + '|' + name; if (seen[key]) return; seen[key] = 1;
      out.push({ name: name.slice(0, 120), lat: st.lat, lng: st.lon, subtype: h[0], hubType: h[1], routes: routesTxt, routesCount: all.length,
        address: (street + ' ' + String(t['addr:housenumber'] || '')).trim(), district: '', provider: 'OSM', osmId: String(id), _verification: 'online' });
    });
    return { rows: out, routes: routeList, withRoutes: withRoutes };
  }
  function poi(qs) {
    var category = qs.get('category') || '', filters = POI_FILTERS[category];
    if (!filters) return fail('Unknown category', 400);
    var south = num(qs.get('south')), west = num(qs.get('west')), north = num(qs.get('north')), east = num(qs.get('east'));
    if (south == null || west == null || north == null || east == null) return fail('south/west/north/east required', 400);
    var bbox = south + ',' + west + ',' + north + ',' + east;
    var limit = parseInt(qs.get('limit') || '2000', 10); if (!(limit >= 50)) limit = 50; if (limit > 3000) limit = 3000;
    if (category === 'transport_hubs') {
      var ql = '[out:json][timeout:60];'
        + 'node["highway"="bus_stop"](' + bbox + ')->.a;node["public_transport"="platform"](' + bbox + ')->.b;'
        + 'node["amenity"="bus_station"](' + bbox + ')->.c;node["railway"~"^(station|halt|tram_stop)$"](' + bbox + ')->.d;(.a;.b;.c;.d;)->.n;'
        + '(way["amenity"="bus_station"](' + bbox + ');way["aeroway"="aerodrome"](' + bbox + ');node["aeroway"="aerodrome"](' + bbox + ');)->.w;'
        + 'rel(bn.n)["type"="route"]["route"~"^(bus|trolleybus|minibus|share_taxi|tram|subway)$"]->.rt;.n out;.w out center;.rt out body;';
      return overpass(ql, 70000).then(function (elements) {
        var p = transportRows(elements), out = p.rows, total = out.length;
        out.sort(function (a, b) { return b.routesCount - a.routesCount; });
        if (total > limit) out = out.slice(0, limit);
        var routes = Object.keys(p.routes).sort().map(function (k) { return p.routes[k]; });
        return jsonResponse({ ok: true, provider: 'osm', category: category, count: out.length, total: total, truncated: total > limit, withRoutes: p.withRoutes, routesFound: routes.length, routes: routes, rows: out });
      }, function (e) { return jsonResponse({ ok: false, message: e.message }); });
    }
    var stmts = filters.map(function (f) { return 'nwr[' + f + '](' + bbox + ');'; }).join('');
    return overpass('[out:json][timeout:40];(' + stmts + ');out center ' + limit + ';', 50000).then(function (elements) {
      var out = [], seen = {};
      for (var i = 0; i < elements.length && out.length < limit; i++) {
        var el = elements[i], lat = el.lat != null ? el.lat : (el.center && el.center.lat), lon = el.lon != null ? el.lon : (el.center && el.center.lon);
        if (lat == null || lon == null) continue;
        var tags = el.tags || {}, name = String(tags.name || '').trim(); if (!name) continue;
        var key = (+lat).toFixed(5) + ',' + (+lon).toFixed(5) + '|' + name; if (seen[key]) continue; seen[key] = 1;
        out.push({ name: name, lat: +lat, lng: +lon, subtype: tags.shop || tags.amenity || tags.leisure || tags.tourism || tags.building || tags.railway || tags.highway || '',
          address: (String(tags['addr:street'] || '') + ' ' + String(tags['addr:housenumber'] || '')).trim(), district: '', provider: 'OSM', _verification: 'online' });
      }
      return jsonResponse({ ok: true, provider: 'osm', category: category, count: out.length, rows: out });
    }, function (e) { return jsonResponse({ ok: false, message: e.message }); });
  }

  /* ── Здания и дороги: как в os/api/osm_lib.php ────────────────────────────────── */
  var ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link', 'living_street', 'pedestrian'];
  function bboxOf(lat, lon, radiusM) {
    var r = Math.max(50, Math.min(3000, radiusM)), dLat = r / 111320, dLon = r / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    return { south: lat - dLat, west: lon - dLon, north: lat + dLat, east: lon + dLon, radius_m: r };
  }
  function bboxStr(b) { return [b.south, b.west, b.north, b.east].map(function (v) { return v.toFixed(6); }).join(','); }
  function centroid(geom) {
    var g = geom.slice(), n = g.length;
    if (n > 1 && g[0].lat === g[n - 1].lat && g[0].lon === g[n - 1].lon) g.pop();
    var la = 0, lo = 0, k = 0; g.forEach(function (p) { if (p.lat != null && p.lon != null) { la += +p.lat; lo += +p.lon; k++; } });
    return k ? [+(la / k).toFixed(6), +(lo / k).toFixed(6)] : null;
  }
  function areaM2(geom, lat0) {
    var n = geom.length; if (n < 3) return 0; var kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111320, s = 0;
    for (var i = 0; i < n; i++) { var a = geom[i], b = geom[(i + 1) % n]; if (a.lat == null || b.lat == null) return 0; s += (a.lon * kx) * (b.lat * ky) - (b.lon * kx) * (a.lat * ky); }
    return Math.abs(s) / 2;
  }
  function intOrNull(v) { if (v == null || v === '') return null; var m = /^-?\d+/.exec(String(v)); return m ? parseInt(m[0], 10) : null; }
  function waysToBuildings(elements, lat0, limit) {
    var out = [];
    for (var i = 0; i < elements.length && out.length < limit; i++) {
      var el = elements[i]; if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 4) continue;
      var tags = el.tags || {}, c = centroid(el.geometry); if (!c) continue;
      var ring = el.geometry.filter(function (p) { return p.lat != null && p.lon != null; }).map(function (p) { return [+(+p.lat).toFixed(6), +(+p.lon).toFixed(6)]; });
      var b = String(tags.building || 'yes');
      out.push({ id: +el.id || 0, c: c, ring: ring, kind: b === 'yes' ? '' : b, levels: intOrNull(tags['building:levels']), name: String(tags.name || '').trim().slice(0, 120),
        addr: (String(tags['addr:street'] || '') + ' ' + String(tags['addr:housenumber'] || '')).trim().slice(0, 120), area: Math.round(areaM2(el.geometry, lat0)) });
    }
    return out;
  }
  function waysToRoads(elements, limit) {
    var out = [];
    for (var i = 0; i < elements.length && out.length < limit; i++) {
      var el = elements[i]; if (el.type !== 'way' || !Array.isArray(el.geometry) || el.geometry.length < 2) continue;
      var tags = el.tags || {};
      out.push({ id: +el.id || 0, line: el.geometry.filter(function (p) { return p.lat != null && p.lon != null; }).map(function (p) { return [+(+p.lat).toFixed(6), +(+p.lon).toFixed(6)]; }),
        cls: String(tags.highway || ''), name: String(tags.name || '').trim().slice(0, 120), oneway: ['yes', 'true', '1', '-1'].indexOf(String(tags.oneway || '').toLowerCase()) >= 0, lanes: intOrNull(tags.lanes) });
    }
    return out;
  }
  function provenance(kind, bbox, count) {
    return { source: 'OpenStreetMap', source_type: 'osm', licence: 'ODbL 1.0', attribution: '© OpenStreetMap contributors',
      method: (kind === 'buildings' ? 'контуры way["building"] в рамке вокруг точки' : 'линии way["highway"] в рамке вокруг точки') + ', Overpass API из браузера',
      radius_m: bbox.radius_m, bbox: bboxStr(bbox), count: count, fetched_at: new Date().toISOString(), cached: false, conf: 'asking' };
  }
  function osmFeatures(mode, qs) {
    var lat = num(qs.get('lat')), lon = num(qs.get('lon')), r = parseInt(qs.get('radius_m') || '500', 10);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail('lat/lon required', 400);
    var classes = null;
    if (mode === 'roads' && qs.get('classes')) { classes = qs.get('classes').split(',').map(function (c) { return c.toLowerCase().replace(/[^a-z_]/g, ''); }).filter(Boolean); if (!classes.length) classes = null; }
    var bbox = bboxOf(lat, lon, r), limit = mode === 'buildings' ? 6000 : 4000;
    var key = mode + '|' + lat.toFixed(4) + '|' + lon.toFixed(4) + '|' + bbox.radius_m + '|' + (classes ? classes.join(',') : '');
    var hit = S.cache[key];
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) { var prov = provenance(mode, bbox, hit.rows.length); prov.cached = true; prov.fetched_at = hit.fetched_at; return jsonResponse({ ok: true, provider: 'osm', mode: mode, rows: hit.rows, provenance: prov, truncated: hit.truncated }); }
    var ql = mode === 'buildings'
      ? '[out:json][timeout:45];(way["building"](' + bboxStr(bbox) + '););out geom ' + Math.max(100, limit) + ';'
      : '[out:json][timeout:45];(way["highway"~"^(' + (classes || ROAD_CLASSES).join('|') + ')$"](' + bboxStr(bbox) + '););out geom ' + Math.max(100, limit) + ';';
    return overpass(ql, 55000).then(function (elements) {
      var rows = mode === 'buildings' ? waysToBuildings(elements, lat, limit) : waysToRoads(elements, limit), truncated = rows.length >= limit;
      S.cache[key] = { rows: rows, truncated: truncated, at: Date.now(), fetched_at: new Date().toISOString() };
      return jsonResponse({ ok: true, provider: 'osm', mode: mode, rows: rows, provenance: provenance(mode, bbox, rows.length), truncated: truncated });
    }, function (e) { return jsonResponse({ ok: false, message: e.message }); });
  }

  /* ── Адрес: Nominatim напрямую ────────────────────────────────────────────────── */
  function geocode(qs) {
    var q = String(qs.get('q') || '').trim().slice(0, 200), lang = ['ru', 'uz', 'en'].indexOf(qs.get('lang') || 'ru') >= 0 ? qs.get('lang') || 'ru' : 'ru';
    if (!q) return fail('q required', 400);
    var key = q.toLowerCase() + '|' + lang;
    if (S.geocodeCache[key]) return jsonResponse({ ok: true, results: S.geocodeCache[key], cached: true, attribution: '© OpenStreetMap contributors' });
    var url = S.nominatim + '/search?q=' + encodeURIComponent(q) + '&format=jsonv2&limit=5&countrycodes=uz&accept-language=' + lang + '&addressdetails=0';
    return getText(url, 15000).then(function (r) {
      if (r.status === 0) return jsonResponse({ ok: false, message: 'Геокодер недоступен из браузера' + (r.error ? ' (' + r.error + ')' : '') + '. Задайте точку кликом по карте или координатами.' });
      if (r.status !== 200) return jsonResponse({ ok: false, message: 'Геокодер ответил кодом ' + r.status + '. Повторите позже.' });
      var j = null; try { j = JSON.parse(r.body); } catch (e) {}
      var results = [];
      (Array.isArray(j) ? j : []).forEach(function (x) {
        if (!x || !isFinite(parseFloat(x.lat)) || !isFinite(parseFloat(x.lon)) || results.length >= 5) return;
        results.push({ name: String(x.display_name || '').trim().slice(0, 200), lat: +(+x.lat).toFixed(6), lon: +(+x.lon).toFixed(6), type: String(x.type || '') });
      });
      S.geocodeCache[key] = results;
      return jsonResponse({ ok: true, results: results, cached: false, attribution: '© OpenStreetMap contributors' });
    });
  }

  /* ── Проверка связи из браузера ───────────────────────────────────────────────── */
  function ping() {
    return Promise.all([getText(S.overpass.replace(/\/interpreter$/, '/status'), 8000), getText(S.nominatim + '/status.php?format=json', 8000)]).then(function (rs) {
      var line = function (what, r) {
        if (r.status >= 200 && r.status < 400) return what + ' доступен: HTTP ' + r.status + ' за ' + r.ms + ' мс.';
        if (r.status === 429 || r.status === 503 || r.status === 504) return what + ' перегружен (HTTP ' + r.status + '). Повторите позже.';
        if (r.status > 0) return what + ' ответил кодом HTTP ' + r.status + '.';
        return what + ' не отвечает из браузера' + (r.error ? ' (' + r.error + ')' : '') + ': проверьте интернет.';
      };
      var advice = ['Автономная версия: запросы идут из браузера, сервера CASE OS нет.', line('Overpass API (здания и дороги OSM)', rs[0]), line('Геокодер Nominatim (поиск адреса)', rs[1])];
      if (rs[0].status === 0 && rs[1].status === 0) advice.push('Итог: интернета нет или сеть закрыта. Точка, радиусы, полигоны, население и слои из файла работают и без сети.');
      advice.push('Своя модель в автономной версии недоступна: запросы разбирает детерминированный движок команд.');
      return jsonResponse({ ok: true, facts: { env: { browser: true, standalone: true, version: S.version }, overpass: { status: rs[0].status, ms: rs[0].ms, error: rs[0].error || '' }, nominatim: { status: rs[1].status, ms: rs[1].ms, error: rs[1].error || '' }, llm: { configured: false, ollama_local: false } }, advice: advice });
    });
  }

  /* ── Маршрутизация запросов ───────────────────────────────────────────────────── */
  function handle(path, qs) {
    if (path === 'api/auth.php') return jsonResponse({ auth: true, user: { id: 'standalone', name: 'Пользователь', role: 'GEO', role_label: 'Автономная версия', edit: true }, rights: { edit: 1 }, csrf: '', pass_login: false, code_login: false });
    if (path === 'api/workspace_access.php') return jsonResponse({ allowed: true, can_edit: true });
    if (path === 'api/geo_master.php') { if (qs.get('file') === 'runtime.json' && DATA.master) return jsonResponse(DATA.master); return fail('В автономной версии есть только встроенная мастер-база', 404); }
    if (path === 'data/tashkent_districts.geojson') return DATA.districts ? jsonResponse(DATA.districts) : fail('нет границ районов', 404);
    if (path === 'data/tashkent_region_districts.geojson') return fail('границы области в файл не встроены', 404);
    if (path === 'api/llm.php') return jsonResponse({ ok: false, needs_llm: true, message: 'В автономной версии своей модели нет: команды работают без неё.' });
    if (path === 'api/gis_proxy.php') {
      var mode = qs.get('mode') || '';
      if (mode === 'poi') return poi(qs);
      if (mode === 'buildings' || mode === 'roads') return osmFeatures(mode, qs);
      if (mode === 'geocode') return geocode(qs);
      if (mode === 'ping') return ping();
      return jsonResponse({ ok: false, message: 'В автономной версии режим «' + mode + '» недоступен: платные провайдеры и серверный кэш есть только в CASE OS.' });
    }
    return fail('Сервера CASE OS в автономной версии нет', 404);
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var clean = url.split('#')[0];
    var m = /(^|\/)(api\/[a-z_]+\.php|data\/[a-z_]+\.geojson)(\?[^]*)?$/.exec(clean);
    var foreign = /^https?:\/\//i.test(clean) && (function () { try { return new URL(clean).origin !== location.origin; } catch (e) { return true; } })();
    if (!m || foreign) return realFetch(input, init);
    var path = m[2], qs = new URLSearchParams((m[3] || '').slice(1));
    S.log.push(path + (m[3] || ''));
    try { return Promise.resolve(handle(path, qs)); } catch (e) { return Promise.resolve(fail(String(e && e.message || e), 500)); }
  };

  /* Ссылки на файлы мастер-базы (master.csv и т. п.) ведут на сервер, которого нет */
  try {
    document.documentElement.classList.add('geo-standalone');
    var st = document.createElement('style'); st.textContent = '.geo-standalone a[href*="geo_master.php"]{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
})();
