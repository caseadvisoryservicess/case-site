/* CASE OS v4.74.0: OpenStreetMap из браузера напрямую (Overpass API, Nominatim).
 *
 * Зачем. На хостинге PHP не выпускают в интернет: api/gis_proxy.php честно отвечает
 * «Overpass недоступен с сервера», и слои зданий, дорог, городских объектов и поиск адреса
 * не работают, хотя из браузера сотрудника те же серверы доступны. Этот файл держит один
 * разбор ответов Overpass и Nominatim (тот же, что в os/api/gis_proxy.php и osm_lib.php) и
 * используется в двух местах:
 *
 *   1. Платформа CASE OS (студия в iframe): install() оборачивает fetch. Запрос к
 *      api/gis_proxy.php сначала идёт на сервер (там кэш и лимиты); если сервер не смог
 *      выйти в сеть (ok:false с причиной «недоступен с сервера», HTTP 5xx, обрыв), тот же
 *      запрос выполняется из браузера, и ответ помечается _via:'browser'. Ошибки прав и
 *      параметров (400/401/403) не перехватываются: это не сетевая проблема.
 *   2. Автономный файл (docs/standalone): шим маршрутизирует api/gis_proxy.php сюда
 *      напрямую, сервера там нет.
 *
 * Условия использования: данные OpenStreetMap по ODbL, атрибуция сохранена в каждом
 * ответе; Overpass и Nominatim - общедоступные серверы с ограничением частоты, поэтому
 * здания и дороги кэшируются на полчаса, адреса - на время сеанса. Ключей нет.
 * Совместимо со старыми браузерами: никаких стрелочных функций и const. */
(function () {
  'use strict';
  if (window.CASE_GEO_DIRECT) return;
  var VERSION = '4.74.0';
  var realFetch = window.fetch.bind(window);
  var D = window.CASE_GEO_DIRECT = {
    version: VERSION,
    overpass: 'https://overpass-api.de/api/interpreter',
    nominatim: 'https://nominatim.openstreetmap.org',
    cache: {}, geocodeCache: {}, log: [], lastVia: {}
  };

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
    return getText(D.overpass + '?data=' + encodeURIComponent(ql), timeoutMs).then(function (r) {
      if (r.status === 0) throw new Error('Overpass API недоступен из браузера' + (r.error ? ' (' + r.error + ')' : '') + '. Проверьте интернет или повторите позже.');
      if (r.status === 429 || r.status === 504) throw new Error('Overpass API перегружен (HTTP ' + r.status + '). Повторите через минуту или уменьшите участок.');
      var j = null; try { j = JSON.parse(r.body); } catch (e) {}
      if (!j || !Array.isArray(j.elements)) throw new Error('Overpass вернул неожиданный ответ (HTTP ' + r.status + ').');
      return j.elements;
    });
  }

  /* Городские объекты (POI): те же теги, что в os/api/gis_proxy.php */
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
    if (!filters) return Promise.resolve({ ok: false, status: 400, message: 'Unknown category' });
    var south = num(qs.get('south')), west = num(qs.get('west')), north = num(qs.get('north')), east = num(qs.get('east'));
    if (south == null || west == null || north == null || east == null) return Promise.resolve({ ok: false, status: 400, message: 'south/west/north/east required' });
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
        return { ok: true, provider: 'osm', category: category, count: out.length, total: total, truncated: total > limit, withRoutes: p.withRoutes, routesFound: routes.length, routes: routes, rows: out, attribution: '© OpenStreetMap contributors' };
      }, function (e) { return { ok: false, message: e.message }; });
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
      return { ok: true, provider: 'osm', category: category, count: out.length, rows: out, attribution: '© OpenStreetMap contributors' };
    }, function (e) { return { ok: false, message: e.message }; });
  }

  /* Здания и дороги: как в os/api/osm_lib.php */
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
  function features(mode, qs) {
    var lat = num(qs.get('lat')), lon = num(qs.get('lon')), r = parseInt(qs.get('radius_m') || '500', 10);
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return Promise.resolve({ ok: false, status: 400, message: 'lat/lon required' });
    var classes = null;
    if (mode === 'roads' && qs.get('classes')) { classes = qs.get('classes').split(',').map(function (c) { return c.toLowerCase().replace(/[^a-z_]/g, ''); }).filter(Boolean); if (!classes.length) classes = null; }
    var bbox = bboxOf(lat, lon, r), limit = mode === 'buildings' ? 6000 : 4000;
    var key = mode + '|' + lat.toFixed(4) + '|' + lon.toFixed(4) + '|' + bbox.radius_m + '|' + (classes ? classes.join(',') : '');
    var hit = D.cache[key];
    if (hit && Date.now() - hit.at < 30 * 60 * 1000) { var prov = provenance(mode, bbox, hit.rows.length); prov.cached = true; prov.fetched_at = hit.fetched_at; return Promise.resolve({ ok: true, provider: 'osm', mode: mode, rows: hit.rows, provenance: prov, truncated: hit.truncated }); }
    var ql = mode === 'buildings'
      ? '[out:json][timeout:45];(way["building"](' + bboxStr(bbox) + '););out geom ' + Math.max(100, limit) + ';'
      : '[out:json][timeout:45];(way["highway"~"^(' + (classes || ROAD_CLASSES).join('|') + ')$"](' + bboxStr(bbox) + '););out geom ' + Math.max(100, limit) + ';';
    return overpass(ql, 55000).then(function (elements) {
      var rows = mode === 'buildings' ? waysToBuildings(elements, lat, limit) : waysToRoads(elements, limit), truncated = rows.length >= limit;
      D.cache[key] = { rows: rows, truncated: truncated, at: Date.now(), fetched_at: new Date().toISOString() };
      return { ok: true, provider: 'osm', mode: mode, rows: rows, provenance: provenance(mode, bbox, rows.length), truncated: truncated };
    }, function (e) { return { ok: false, message: e.message }; });
  }

  /* Адрес: Nominatim напрямую */
  function geocode(qs) {
    var q = String(qs.get('q') || '').trim().slice(0, 200), lang = ['ru', 'uz', 'en'].indexOf(qs.get('lang') || 'ru') >= 0 ? qs.get('lang') || 'ru' : 'ru';
    if (!q) return Promise.resolve({ ok: false, status: 400, message: 'q required' });
    var key = q.toLowerCase() + '|' + lang;
    if (D.geocodeCache[key]) return Promise.resolve({ ok: true, results: D.geocodeCache[key], cached: true, attribution: '© OpenStreetMap contributors' });
    var url = D.nominatim + '/search?q=' + encodeURIComponent(q) + '&format=jsonv2&limit=5&countrycodes=uz&accept-language=' + lang + '&addressdetails=0';
    return getText(url, 15000).then(function (r) {
      if (r.status === 0) return { ok: false, message: 'Геокодер недоступен из браузера' + (r.error ? ' (' + r.error + ')' : '') + '. Задайте точку кликом по карте или координатами.' };
      if (r.status !== 200) return { ok: false, message: 'Геокодер ответил кодом ' + r.status + '. Повторите позже.' };
      var j = null; try { j = JSON.parse(r.body); } catch (e) {}
      var results = [];
      (Array.isArray(j) ? j : []).forEach(function (x) {
        if (!x || !isFinite(parseFloat(x.lat)) || !isFinite(parseFloat(x.lon)) || results.length >= 5) return;
        results.push({ name: String(x.display_name || '').trim().slice(0, 200), lat: +(+x.lat).toFixed(6), lon: +(+x.lon).toFixed(6), type: String(x.type || '') });
      });
      D.geocodeCache[key] = results;
      return { ok: true, results: results, cached: false, attribution: '© OpenStreetMap contributors' };
    });
  }

  /* Проверка связи из браузера. opts.standalone: сервера CASE OS нет вовсе. */
  function ping(opts) {
    opts = opts || {};
    return Promise.all([getText(D.overpass.replace(/\/interpreter$/, '/status'), 8000), getText(D.nominatim + '/status.php?format=json', 8000)]).then(function (rs) {
      var line = function (what, r) {
        if (r.status >= 200 && r.status < 400) return what + ' доступен из браузера: HTTP ' + r.status + ' за ' + r.ms + ' мс.';
        if (r.status === 429 || r.status === 503 || r.status === 504) return what + ' перегружен (HTTP ' + r.status + '). Повторите позже.';
        if (r.status > 0) return what + ' ответил кодом HTTP ' + r.status + '.';
        return what + ' не отвечает из браузера' + (r.error ? ' (' + r.error + ')' : '') + ': проверьте интернет.';
      };
      var advice = [];
      if (opts.standalone) advice.push('Автономная версия: запросы идут из браузера, сервера CASE OS нет.');
      advice.push(line('Overpass API (здания и дороги OSM)', rs[0]));
      advice.push(line('Геокодер Nominatim (поиск адреса)', rs[1]));
      var both0 = rs[0].status === 0 && rs[1].status === 0;
      if (both0) advice.push('Итог: интернета нет или сеть закрыта. Точка, радиусы, полигоны, население и слои из файла работают и без сети.');
      else if (!opts.standalone) advice.push('Слои OSM и адреса запрашиваются из браузера напрямую, когда сервер не может выйти в сеть.');
      if (opts.standalone) advice.push('Своя модель в автономной версии недоступна: запросы разбирает детерминированный движок команд.');
      return { ok: true, facts: { env: { browser: true, standalone: !!opts.standalone, version: VERSION }, overpass: { status: rs[0].status, ms: rs[0].ms, error: rs[0].error || '' }, nominatim: { status: rs[1].status, ms: rs[1].ms, error: rs[1].error || '' }, llm: { configured: false, ollama_local: false } }, advice: advice };
    });
  }

  function handle(mode, qs) {
    if (mode === 'poi') return poi(qs);
    if (mode === 'buildings' || mode === 'roads') return features(mode, qs);
    if (mode === 'geocode') return geocode(qs);
    if (mode === 'ping') return ping({ standalone: !!window.CASE_STANDALONE });
    return Promise.resolve({ ok: false, message: 'Режим «' + mode + '» из браузера недоступен: платные провайдеры и серверный кэш есть только на сервере CASE OS.' });
  }

  /* Сервер не смог выйти в сеть: это единственный повод повторить запрос из браузера */
  function serverNetworkFailure(status, j) {
    if (status === 0 || status >= 500) return true;
    if (status === 200 && j && j.ok === false && /недоступен с сервера|перегружен|неожиданный ответ|нет curl|allow_url_fopen|таймаут|network|timeout/i.test(String(j.message || j.error || ''))) return true;
    return false;
  }
  function jsonResponse(obj, status) {
    return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }
  function install() {
    if (window.CASE_STANDALONE || D.installed) return;
    D.installed = true;
    var prev = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var m = /(^|\/)api\/gis_proxy\.php\?([^#]*)$/.exec(url.split('#')[0]);
      if (!m) return prev.call(window, input, init);
      var qs = new URLSearchParams(m[2]), mode = qs.get('mode') || '';
      if (['poi', 'buildings', 'roads', 'geocode', 'ping'].indexOf(mode) < 0) return prev.call(window, input, init);
      var direct = function (serverMsg) {
        return handle(mode, qs).then(function (o) {
          if (o && o.ok !== false) { o._via = 'browser'; if (serverMsg) o._server = serverMsg; D.lastVia[mode] = 'browser'; D.log.push(mode + ': из браузера' + (serverMsg ? ' (сервер: ' + serverMsg + ')' : '')); }
          else if (o) { o._via = 'browser'; if (serverMsg) o.message = (o.message || '') + ' Сервер: ' + serverMsg; }
          return jsonResponse(o, 200);
        });
      };
      return prev.call(window, input, init).then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (mode === 'ping') {
            /* «Связь» показывает оба пути: с сервера и из браузера */
            return ping({}).then(function (b) {
              var base = (j && typeof j === 'object') ? j : { ok: false, message: 'сервер ответил кодом HTTP ' + r.status };
              var out = { ok: true, facts: Object.assign({}, base.facts || {}, { browser: b.facts }), advice: [].concat(base.advice || (base.message ? ['Сервер: ' + base.message] : []), b.advice) };
              return jsonResponse(out, 200);
            });
          }
          if (serverNetworkFailure(r.status, j)) return direct((j && (j.message || j.error)) || ('HTTP ' + r.status));
          D.lastVia[mode] = 'server';
          return new Response(t, { status: r.status, headers: { 'Content-Type': r.headers.get('Content-Type') || 'application/json; charset=utf-8' } });
        });
      }, function (e) { return direct(String(e && e.message || e)); });
    };
  }
  D.poi = poi; D.features = features; D.geocode = geocode; D.ping = ping; D.handle = handle; D.install = install; D.serverNetworkFailure = serverNetworkFailure;
  install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['geo-direct'] = '4.74.0';
