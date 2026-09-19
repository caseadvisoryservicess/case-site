/* CASE OS v4.78.0: НГИС (open.ngis.uz) прямо из браузера: границы махаллей и генплан в точке.
 *
 * Владелец передал разбор геопортала Кадастр агентлиги (docs/data/ngis/NGIS_ANALIZ_2026-09-18.md):
 * за порталом стоит ArcGIS Server REST (db.ngis.uz) с анонимным доступом и открытым CORS. Сервер
 * CASE OS в интернет не ходит, поэтому запросы уходят из браузера пользователя, как OSM в
 * geo-direct.js. Ничего не сохраняется на сервере CASE: махалли держатся в памяти и в кэше
 * этого браузера, генплан спрашивается по точке.
 *
 *   1. «Границы махаллей из НГИС» в разделе «Махалли и демография»: слой MAHALLA (только его
 *      FeatureServer открыт для запросов), Ташкент по soato_region='1726', генерализация 0.0002
 *      (около 6 МБ на страну, Ташкент меньше). Район каждого полигона берётся по SOATO из
 *      data/demography_tashkent.json (districts.rows), имя из атрибутов. Полигоны уходят в модуль
 *      махаллей тем же путём, что файл data/mahalla_boundaries.geojson: население считается внутри
 *      границы, полигон рисуется. Слой НГИС покрывает около половины МФЙ страны: не полный реестр.
 *   2. «Генплан и налоговая зона (НГИС)» в разделе «Махалли и демография» (по точке анализа): зона генплана Ташкента в точке
 *      (функция, этажность, застройка участка, сейсмика, стратегия) и класс налоговой зоны.
 *      Сначала точка ищется в локальных выгрузках владельца data/ngis_genplan_tashkent.geojson
 *      (7 419 зон, 18.09.2026) и data/ngis_nalog_tashkent.geojson без сети; живой запрос к НГИС
 *      остаётся запасным. Атрибуты показываются как есть, известные переводятся. Факт уходит в
 *      отчёт по точке. Галочка «Зоны генплана на карте» рисует выгрузку слоем (canvas) с легендой.
 *   3. Полигоны махаллей из живого запроса получают mahalla_code = кадастровый номер (код SOATO
 *      махалли), тот же ключ, что в реестре Etirof и в файле data/mahalla_boundaries.geojson.
 *
 * Правовой режим: данные публичные, но разрешение на коммерческое переиспользование не
 * подтверждено (риск R2 разбора). Поэтому в интерфейсе стоит атрибуция и пометка, а запросы идут
 * только по действию пользователя или по его точке, без массовой выгрузки. Длинных тире нет.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_NGIS) return;
  var VERSION = '4.79.0', BASE = 'https://db.ngis.uz/db/rest/services', KEY_CACHE = 'caseos_ngis_mahalla_v1', KEY_AUTO = 'caseos_ngis_auto', TIMEOUT = 25000, SIMPLIFY = 0.0002, REGION = '1726';
  var N = window.CASE_GEO_NGIS = { version: VERSION, base: BASE, mahallas: null, genplan: null, loading: false };
  var LAYERS = { MAHALLA: 'UZKAD/MAHALLA_UZKAD_DB16/FeatureServer/0', GENPLAN: 'Hosted/TOSHKENT_GENPLAN_3857_MAP/MapServer/2', NALOG: 'Hosted/TOSHKENT_NALOG_ZONE_MAP/MapServer/0' };
  var ATTR = 'Кадастр агентлиги, геопортал open.ngis.uz';
  var FUNC_RU = { Aholi_yashash_joyi: 'жилая застройка', Aralash_foydalanish: 'смешанное использование', Qizil_chiziqlar: 'красные линии', MTT_hududi: 'детские сады', Yashil_hudud: 'зелёная зона', Rivojlanish_hududi: 'зона развития', "Suv_bo'ylari_va_havzalari": 'водоёмы и берега', Maktab_hududi: 'школы', Savdo_va_tijorat: 'торговля и коммерция', Universitet_institut_va_LITI_hududlari: 'вузы и НИИ', Transport_Aeroport: 'транспорт, аэропорт', "Madaniy_ma'rifiy": 'культура и просвещение', "Ma'muriy_markazlar": 'административные центры', "Sog'liqni_saqlash_muassasalari": 'здравоохранение', Poliklinika: 'поликлиники', Ishbilarmonlik_markazi: 'деловой центр', "Maishiy_xizmat_ko'rsatish": 'бытовые услуги', Qabriston: 'кладбище', Madaniy_meros_hududi: 'культурное наследие', Sport: 'спорт', Texnologik_sanoat_hududlari: 'технологическая промышленность', Texnik_Infratuzilma_hududlari: 'техническая инфраструктура', Transport_markazlari: 'транспортные узлы', Harbiy_hudud: 'военная территория', Avtoturargoh: 'автостоянки', Kocha_va_yollar: 'улицы и дороги', Logistika_markazlari: 'логистические центры' };
  var STRAT_RU = { Konservatsiya: 'консервация', Rekonstruksiya: 'реконструкция', Renovatsiya: 'реновация' };
  var FIELD_RU = { funksiya: 'Функция зоны', hudud: 'Территория', strategiya: 'Стратегия', strategiya_turi: 'Тип стратегии', qavatlilik: 'Этажность', qurilish_maydonining_yer_maydon: 'Застройка к участку', seysmologik_zonasi: 'Сейсмическая зона', mahalla_id: 'Код махалли', mahalla: 'Махалля', tuman: 'Район', maydon: 'Площадь, га', shape_area: 'Площадь (ед. слоя)', ez_tashkent: 'Налоговая зона', zona: 'Зона', nomi: 'Название', name: 'Название' };
  var HIDE = /^(objectid|shape|shape_length|shape_area|globalid|fid|id|create_at|modify_at|version_life|sp_id|sp_uid)$/i;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) { var t = $('geoToast'); if (t) { t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 3200); } }
  function point() { try { var p = window.caseGeoPoint ? window.caseGeoPoint() : null; return (p && !p.pending && isFinite(+p.lat) && isFinite(+p.lng)) ? { lat: +p.lat, lng: +p.lng } : null; } catch (e) { return null; } }
  function demo() { return window.CASE_GEO_DEMO || null; }
  function districtsTable() { var D = demo(); return (D && D.data && D.data.districts && D.data.districts.rows) || null; }
  function keyBySoato() { var t = districtsTable(), o = {}; if (t) Object.keys(t).forEach(function (k) { if (t[k].soato) o[String(t[k].soato)] = k; }); return o; }
  function fetchJson(url, ms) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, timer = ctl ? setTimeout(function () { ctl.abort(); }, ms || TIMEOUT) : null;
    return fetch(url, { mode: 'cors', credentials: 'omit', signal: ctl ? ctl.signal : undefined }).then(function (r) { if (!r.ok) throw new Error('НГИС ответил ' + r.status); return r.json(); }).then(function (j) { if (j && j.error) throw new Error('НГИС: ' + (j.error.message || JSON.stringify(j.error)).slice(0, 160)); return j; }).finally(function () { if (timer) clearTimeout(timer); });
  }
  N.fetchJson = fetchJson;

  /* --- махалли ------------------------------------------------------------------------------- */
  function nameOf(pr) {
    var keys = ['name', 'NAME', 'mahalla_name', 'nomi', 'mfy_name', 'mahalla', 'MAHALLA', 'name_uz', 'title'];
    for (var i = 0; i < keys.length; i++) if (pr[keys[i]] != null && String(pr[keys[i]]).trim()) return String(pr[keys[i]]).trim();
    var ks = Object.keys(pr); for (var k = 0; k < ks.length; k++) if (/nom|name/i.test(ks[k]) && typeof pr[ks[k]] === 'string' && pr[ks[k]].trim()) return pr[ks[k]].trim();
    return '';
  }
  function toStudio(fc) {
    var map = keyBySoato(), feats = [];
    (fc.features || []).forEach(function (ft) {
      var pr = ft.properties || ft.attributes || {}; if (!ft.geometry) return;
      var soato = String(pr.soato_district || pr.SOATO_DISTRICT || pr.soato || '');
      var cad = String(pr.cadastral_number || pr.official_unique_code || ''), code = /^\d{10}$/.test(cad) ? cad : String(pr.official_unique_code || pr.mahalla_code || pr.MAHALLA_CODE || '');
      feats.push({ type: 'Feature', geometry: ft.geometry, properties: { name: nameOf(pr), district: map[soato] || '', soato_district: soato, mahalla_code: code, cadastral_number: cad, source: ATTR, source_date: new Date().toISOString().slice(0, 10) } });
    });
    return { type: 'FeatureCollection', features: feats };
  }
  function loadMahallas(force) {
    if (N.loading) return Promise.resolve(N.mahallas);
    var D = demo(); if (!D || typeof D.setBoundaries !== 'function') { toast('Модуль махаллей не загружен'); return Promise.resolve(null); }
    if (!force) { try { var c = JSON.parse(localStorage.getItem(KEY_CACHE) || 'null'); if (c && c.fc && c.fc.features && c.fc.features.length) { N.mahallas = c.fc; D.setBoundaries(c.fc, 'ngis'); status('Границы из НГИС: ' + c.fc.features.length + ' полигонов (кэш от ' + c.at + ')'); return Promise.resolve(c.fc); } } catch (e) {} }
    N.loading = true; status('Запрашиваю границы махаллей у НГИС…');
    var all = [], PAGE = 2000;
    function page(off) {
      var u = BASE + '/' + LAYERS.MAHALLA + '/query?where=' + encodeURIComponent("soato_region='" + REGION + "'") + '&outFields=*&returnGeometry=true&f=geojson&outSR=4326&maxAllowableOffset=' + SIMPLIFY + '&resultOffset=' + off + '&resultRecordCount=' + PAGE;
      return fetchJson(u).then(function (j) { var f = j.features || []; all = all.concat(f); if (f.length >= PAGE && all.length < 20000) return page(off + PAGE); return all; });
    }
    return page(0).then(function (feats) {
      var fc = toStudio({ features: feats });
      N.mahallas = fc; N.loading = false;
      if (!fc.features.length) { status('НГИС не вернул полигонов по Ташкенту'); return fc; }
      D.setBoundaries(fc, 'ngis');
      try { var txt = JSON.stringify({ at: new Date().toISOString().slice(0, 10), fc: fc }); if (txt.length < 3500000) localStorage.setItem(KEY_CACHE, txt); localStorage.setItem(KEY_AUTO, '1'); } catch (e) {}
      var byD = {}; fc.features.forEach(function (f) { var d = f.properties.district || '?'; byD[d] = (byD[d] || 0) + 1; });
      status('Границы из НГИС: ' + fc.features.length + ' полигонов по Ташкенту, ' + Object.keys(byD).filter(function (k) { return k !== '?'; }).length + ' районов; население махаллей с границей пересчитано внутри полигона');
      toast('Границы махаллей из НГИС загружены: ' + fc.features.length);
      return fc;
    }).catch(function (e) { N.loading = false; status('Не удалось получить границы из НГИС: ' + (e && e.message || e) + '. Портал мог закрыть доступ (риск R1); положите файл data/mahalla_boundaries.geojson.'); return null; });
  }
  N.loadMahallas = loadMahallas;
  /* v4.78.0 (замечание владельца «у части махаллей нет границ»): слой хокимията Ташкента со всеми 585
     махаллями (Open Data Tashkent, опубликован на ArcGIS Online), запрос из браузера пользователя.
     Полигон привязывается к реестру по id слоя (layer_id реестра), поэтому получает официальный код и
     район студии. Порядок приоритета границ: живой НГИС, файл кадастра, хокимият. */
  var HOK = 'https://services8.arcgis.com/GyR85gR88mMqIY4t/arcgis/rest/services/Tashkent_Mahallas/FeatureServer/0/query', KEY_HOK = 'caseos_hokimiyat_mahalla_v1', KEY_HOK_AUTO = 'caseos_hokimiyat_auto';
  function centroidOf(g) {
    var ring = g && g.type === 'Polygon' ? g.coordinates[0] : g && g.type === 'MultiPolygon' ? g.coordinates[0][0] : null; if (!ring || ring.length < 3) return null;
    var a = 0, cx = 0, cy = 0; for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) { var f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]; a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f; }
    if (!a) return [ring[0][1], ring[0][0]]; a *= 0.5; return [cy / (6 * a), cx / (6 * a)];
  }
  function toStudioHok(feats) {
    var D = demo(), reg = D && typeof D.registry === 'function' ? D.registry() : null, byId = {};
    if (reg && Array.isArray(reg.rows)) reg.rows.forEach(function (r) { if (r.layer_id != null) byId[String(r.layer_id)] = r; });
    var map = keyBySoato(), out = [];
    feats.forEach(function (ft) {
      var pr = ft.properties || ft.attributes || {}; if (!ft.geometry) return;
      var id = String(pr.id != null ? pr.id : (pr.Id != null ? pr.Id : (pr.OBJECTID != null ? pr.OBJECTID : ''))), r = byId[id] || null;
      var c = centroidOf(ft.geometry);
      out.push({ type: 'Feature', geometry: ft.geometry, properties: { name: r ? r.name : String(pr.name_uz_lt || pr.name_ru || nameOf(pr) || ''), district: r ? r.district : (map[String(pr.soato_district || '')] || ''), soato_district: r ? r.soato_district : '', mahalla_code: r ? r.code : '', cadastral_number: '', area_ha: pr.Maydoni != null && isFinite(+pr.Maydoni) ? +pr.Maydoni : (r && r.area_ha_hokimiyat != null ? r.area_ha_hokimiyat : null), lat: c ? +c[0].toFixed(5) : null, lng: c ? +c[1].toFixed(5) : null, layer_id: id, name_ru: pr.name_ru || (r ? r.name_ru : ''), source: 'Хокимият Ташкента, Open Data Tashkent (ArcGIS Online), границы по решениям Кенгаша 2023-2024', source_date: new Date().toISOString().slice(0, 10) } });
    });
    return { type: 'FeatureCollection', features: out };
  }
  function loadHokimiyat(force) {
    if (N.loadingHok) return Promise.resolve(N.hokimiyat);
    var D = demo(); if (!D || typeof D.setBoundaries !== 'function') { toast('Модуль махаллей не загружен'); return Promise.resolve(null); }
    if (!force) { try { var c = JSON.parse(localStorage.getItem(KEY_HOK) || 'null'); if (c && c.fc && c.fc.features && c.fc.features.length) { N.hokimiyat = c.fc; D.setBoundaries(c.fc, 'hokimiyat'); statusHok('Границы хокимията: ' + c.fc.features.length + ' махаллей (кэш от ' + c.at + ')'); return Promise.resolve(c.fc); } } catch (e) {} }
    N.loadingHok = true; statusHok('Запрашиваю слой хокимията (585 махаллей)…');
    var all = [], PAGE = 1000;
    function page(off) {
      var u = HOK + '?where=1%3D1&outFields=id,district,name_uz_lt,name_uz_kr,name_ru,Maydoni&returnGeometry=true&outSR=4326&f=geojson&maxAllowableOffset=0.0001&resultOffset=' + off + '&resultRecordCount=' + PAGE;
      return fetchJson(u, 40000).then(function (j) { var f = j.features || []; all = all.concat(f); if (f.length >= PAGE && all.length < 5000) return page(off + PAGE); return all; });
    }
    return page(0).then(function (feats) {
      var fc = toStudioHok(feats); N.hokimiyat = fc; N.loadingHok = false;
      if (!fc.features.length) { statusHok('Слой хокимията не вернул полигонов'); return fc; }
      D.setBoundaries(fc, 'hokimiyat');
      try { var txt = JSON.stringify({ at: new Date().toISOString().slice(0, 10), fc: fc }); if (txt.length < 3800000) localStorage.setItem(KEY_HOK, txt); localStorage.setItem(KEY_HOK_AUTO, '1'); } catch (e) {}
      var withCode = fc.features.filter(function (f) { return f.properties.mahalla_code; }).length;
      statusHok('Границы хокимията: ' + fc.features.length + ' махаллей, ' + withCode + ' с кодом реестра; расчётные границы заменены официальными');
      toast('Границы всех махаллей из слоя хокимията загружены: ' + fc.features.length);
      return fc;
    }).catch(function (e) { N.loadingHok = false; statusHok('Не удалось получить слой хокимията: ' + (e && e.message || e) + '. Нужен доступ к services8.arcgis.com из вашей сети.'); return null; });
  }
  N.loadHokimiyat = loadHokimiyat;
  function statusHok(t) { var el = $('hokStatus'); if (el) el.textContent = t; }
  function status(t) { var el = $('ngisStatus'); if (el) el.textContent = t; }
  function mountMahallaButton() {
    if ($('ngisLoad')) return true;
    var sect = $('mahSect'); var body = sect && sect.querySelector('.sbody'); if (!body) return false;
    var show = $('mahShow'); var anchor = show ? show.closest('label') : null;
    var d = document.createElement('div'); d.className = 'ngis-row';
    d.innerHTML = '<div class="ngis-h">Обновление границ (из вашего браузера)</div>'
      + '<button type="button" class="btn sec" id="hokLoad" style="font-size:11px" title="официальные границы всех 585 махаллей Ташкента из слоя хокимията (Open Data Tashkent на ArcGIS Online); закрывает пробелы кадастрового слоя">⬇ Все 585 границ (хокимият)</button><button type="button" class="btn sec" id="hokReload" style="font-size:11px" title="запросить заново, минуя кэш">↻</button><div class="mini" id="hokStatus"></div>'
      + '<button type="button" class="btn sec" id="ngisLoad" style="font-size:11px" title="свежие границы из кадастрового слоя open.ngis.uz (в пакете уже есть снимок от 18.09.2026, слой пополняется); запрос из вашего браузера">↻ Обновить границы из НГИС</button><button type="button" class="btn sec" id="ngisReload" style="font-size:11px" title="запросить заново, минуя кэш">↻</button><div class="mini" id="ngisStatus"></div><div class="mini" title="' + esc(ATTR) + ' и хокимият Ташкента. Данные публичные, условия коммерческого переиспользования не подтверждены. Приоритет границ: живой НГИС, файл кадастра, хокимият, расчётная.">Источники: НГИС и хокимият · наведите для пояснения</div>';
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(d, anchor); else body.appendChild(d);
    $('ngisLoad').onclick = function () { loadMahallas(false); };
    $('ngisReload').onclick = function () { try { localStorage.removeItem(KEY_CACHE); } catch (e) {} loadMahallas(true); };
    $('hokLoad').onclick = function () { loadHokimiyat(false); };
    $('hokReload').onclick = function () { try { localStorage.removeItem(KEY_HOK); } catch (e) {} loadHokimiyat(true); };
    var auto = false, autoH = false; try { auto = localStorage.getItem(KEY_AUTO) === '1'; autoH = localStorage.getItem(KEY_HOK_AUTO) === '1'; } catch (e) {}
    if (auto) setTimeout(function () { loadMahallas(false); }, 600);
    if (autoH) setTimeout(function () { loadHokimiyat(false); }, 900);
    return true;
  }

  /* --- генплан и налоговая зона в точке ------------------------------------------------------ */
  var lastKey = '', lastReq = 0, lastFactKey = '';
  function queryAt(layer, lat, lng) {
    var geom = encodeURIComponent(JSON.stringify({ x: +lng, y: +lat, spatialReference: { wkid: 4326 } }));
    var u = BASE + '/' + layer + '/query?geometry=' + geom + '&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*&returnGeometry=false&f=json';
    return fetchJson(u, 15000).then(function (j) { var f = (j.features || [])[0]; return f ? (f.attributes || f.properties || null) : null; });
  }
  function valRu(k, v) {
    if (v == null || v === '') return '';
    if (k === 'funksiya') return FUNC_RU[v] ? FUNC_RU[v] + ' (' + v + ')' : String(v);
    if (k === 'strategiya') return STRAT_RU[v] ? STRAT_RU[v] + ' (' + v + ')' : String(v);
    if (typeof v === 'number') return v.toLocaleString('ru');
    return String(v);
  }
  function rowsOf(attrs) {
    if (!attrs) return [];
    var order = ['funksiya', 'hudud', 'strategiya', 'strategiya_turi', 'qavatlilik', 'qurilish_maydonining_yer_maydon', 'seysmologik_zonasi', 'maydon', 'tuman', 'mahalla', 'mahalla_id', 'ez_tashkent', 'zona', 'nomi', 'name'];
    var keys = Object.keys(attrs).filter(function (k) { return !HIDE.test(k) && attrs[k] != null && attrs[k] !== ''; });
    keys.sort(function (a, b) { var ia = order.indexOf(a), ib = order.indexOf(b); ia = ia < 0 ? 99 : ia; ib = ib < 0 ? 99 : ib; return ia - ib || a.localeCompare(b); });
    return keys.slice(0, 14).map(function (k) { return [FIELD_RU[k] || k, valRu(k, attrs[k])]; });
  }
  /* --- локальные выгрузки генплана и налоговых зон ------------------------------------------- */
  var LOCAL = { genplan: null, nalog: null, loading: null, failed: false };
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function polys(g) { if (!g) return []; if (g.type === 'Polygon') return [g.coordinates]; if (g.type === 'MultiPolygon') return g.coordinates; return []; }
  function bboxOf(ps) { var b = [Infinity, Infinity, -Infinity, -Infinity]; ps.forEach(function (p) { p[0].forEach(function (c) { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; }); }); return b; }
  function ringIn(x, y, r) { var inside = false; for (var i = 0, j = r.length - 1; i < r.length; j = i++) { var xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside; } return inside; }
  function inPolys(x, y, ps) { for (var k = 0; k < ps.length; k++) { var p = ps[k]; if (ringIn(x, y, p[0])) { var hole = false; for (var h = 1; h < p.length; h++) if (ringIn(x, y, p[h])) { hole = true; break; } if (!hole) return true; } } return false; }
  function indexOf(fc) { if (!fc || !Array.isArray(fc.features)) return null; return { fc: fc, items: fc.features.map(function (ft) { var ps = polys(ft.geometry); return ps.length ? { ps: ps, bb: bboxOf(ps), p: ft.properties || {} } : null; }).filter(Boolean) }; }
  function localAt(ix, lat, lng) { var out = []; if (!ix) return out; for (var i = 0; i < ix.items.length; i++) { var it = ix.items[i]; if (lng < it.bb[0] || lng > it.bb[2] || lat < it.bb[1] || lat > it.bb[3]) continue; if (inPolys(lng, lat, it.ps)) out.push(it); } return out; }
  function loadLocal() {
    if (LOCAL.loading) return LOCAL.loading;
    var get = function (f) { return fetch(f, { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); };
    var gp = window.CASE_NGIS_GENPLAN ? Promise.resolve(window.CASE_NGIS_GENPLAN) : get('data/ngis_genplan_tashkent.geojson'), nl = window.CASE_NGIS_NALOG ? Promise.resolve(window.CASE_NGIS_NALOG) : get('data/ngis_nalog_tashkent.geojson');
    LOCAL.loading = Promise.all([gp, nl]).then(function (rs) { LOCAL.genplan = indexOf(rs[0]); LOCAL.nalog = indexOf(rs[1]); LOCAL.failed = !LOCAL.genplan; return LOCAL; });
    return LOCAL.loading;
  }
  N.loadLocal = loadLocal;
  function attrsOf(p) { return { funksiya: p.f, strategiya: p.s, hudud: p.h, qavatlilik: p.q, seysmologik_zonasi: p.z, maydon: p.a, tuman: p.d, mahalla: p.m }; }
  /* зоны генплана перекрываются (красные линии поверх застройки): основной считается самый малый
     полигон не из красных линий, остальные перечисляются */
  function pickLocal(hits) {
    if (!hits.length) return null;
    var main = hits.filter(function (h) { return h.p.f !== 'Qizil_chiziqlar'; }); if (!main.length) main = hits;
    main.sort(function (a, b) { return (+a.p.a || 0) - (+b.p.a || 0); });
    return { main: main[0], also: hits.filter(function (h) { return h !== main[0]; }) };
  }
  var gLayer = null, gLegend = null;
  var COLORS = { Aholi_yashash_joyi: '#f2d16b', Aralash_foydalanish: '#e9a05a', Savdo_va_tijorat: '#d9534f', Ishbilarmonlik_markazi: '#9E0000', Yashil_hudud: '#7fbf7b', "Suv_bo'ylari_va_havzalari": '#6fa8dc', Rivojlanish_hududi: '#c9a86a', MTT_hududi: '#b39ddb', Maktab_hududi: '#9fa8da', Universitet_institut_va_LITI_hududlari: '#7986cb', Transport_Aeroport: '#9e9e9e', Transport_markazlari: '#757575', Texnologik_sanoat_hududlari: '#8d6e63', Texnik_Infratuzilma_hududlari: '#a1887f', "Sog'liqni_saqlash_muassasalari": '#ef9a9a', Poliklinika: '#f48fb1', "Madaniy_ma'rifiy": '#ce93d8', Madaniy_meros_hududi: '#ba68c8', "Ma'muriy_markazlar": '#90a4ae', "Maishiy_xizmat_ko'rsatish": '#ffcc80', Sport: '#a5d6a7', Qabriston: '#bdbdbd', Harbiy_hudud: '#8c8c8c', Avtoturargoh: '#b0bec5', Logistika_markazlari: '#795548' };
  function toggleLayer(on) {
    var M = theMap(); if (!M || !window.L) return;
    if (!on) { if (gLayer) M.removeLayer(gLayer); if (gLegend) gLegend.hidden = true; N.layerOn = false; return; }
    loadLocal().then(function (Lx) {
      if (!Lx.genplan) { status('Файл data/ngis_genplan_tashkent.geojson не загружен'); var cb = $('ngisLayer'); if (cb) cb.checked = false; return; }
      if (!gLayer) {
        var rd = L.canvas({ padding: 0.4 });
        gLayer = L.geoJSON(Lx.genplan.fc, { renderer: rd, filter: function (f) { return f.properties.f !== 'Qizil_chiziqlar'; }, style: function (f) { var c = COLORS[f.properties.f] || '#c8c0b4'; return { color: c, weight: 0.6, opacity: .8, fillColor: c, fillOpacity: .28 }; }, onEachFeature: function (f, l) { var p = f.properties; l.bindTooltip('<b>' + esc(FUNC_RU[p.f] || p.f) + '</b>' + (p.q ? ' · ' + p.q + ' эт.' : '') + (p.s ? '<br>' + esc(STRAT_RU[p.s] || p.s) : '') + (p.m ? '<br>' + esc(p.m) : '') + (p.a ? ' · ' + p.a + ' га' : ''), { sticky: true }); } });
      }
      gLayer.addTo(M); N.layerOn = true;
      if (gLegend) { var cnt = {}; Lx.genplan.items.forEach(function (it) { cnt[it.p.f] = (cnt[it.p.f] || 0) + 1; }); var keys = Object.keys(cnt).filter(function (k) { return k !== 'Qizil_chiziqlar'; }).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 12); gLegend.innerHTML = keys.map(function (k) { return '<span><i style="background:' + (COLORS[k] || '#c8c0b4') + '"></i>' + esc(FUNC_RU[k] || k) + ' <small>' + cnt[k] + '</small></span>'; }).join(''); gLegend.hidden = false; }
    });
  }
  N.toggleLayer = toggleLayer;
  function renderGenplan(state) {
    var box = $('ngisPointBody') || $('ngisPoint'); if (!box) return;
    if (!state) { box.innerHTML = '<div class="ngis-h">Генплан и налоговая зона (НГИС)</div><div class="mini" title="Зона генплана Ташкента и налоговая зона запрашиваются по точке анализа">Поставьте точку анализа.</div>'; return; }
    if (state.loading) { box.innerHTML = '<div class="ngis-h">Генплан и налоговая зона (НГИС)</div><div class="mini">Запрашиваю НГИС…</div>'; return; }
    var h = '<div class="ngis-h">Генплан и налоговая зона (НГИС)</div>';
    if (state.error) h += '<div class="mini" style="color:#9E0000">' + esc(state.error) + '</div>';
    else {
      var g = rowsOf(state.genplan), n = rowsOf(state.nalog);
      h += g.length ? '<table class="ngis-t">' + g.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' : '<div class="mini">Зона генплана в точке не найдена (слой только по Ташкенту).</div>';
      h += n.length ? '<div class="mini" style="margin-top:4px">Налоговая зона: ' + n.map(function (r) { return esc(r[0]) + ' ' + esc(r[1]); }).join(' · ') + '</div>' : '';
      if (state.also && state.also.length) h += '<div class="mini">Также в точке: ' + state.also.map(function (a) { return esc(FUNC_RU[a] || a); }).join(', ') + '</div>';
    }
    h += '<div class="mini" title="' + esc(ATTR) + (state.source === 'local' ? '. Выгрузка владельца 18.09.2026, без сети.' : '. Запрос из вашего браузера.') + ' Данные публичные, условия коммерческого переиспользования не подтверждены.">Источник: НГИС · ' + (state.source === 'local' ? 'выгрузка 18.09.2026' : 'запрос из браузера') + '</div>';
    box.innerHTML = h;
  }
  function genplanAt(p) {
    var key = p ? p.lat.toFixed(5) + ',' + p.lng.toFixed(5) : '';
    if (!p) { N.genplan = null; renderGenplan(null); return Promise.resolve(null); }
    if (key === lastKey && N.genplan && !N.genplan.loading) { renderGenplan(N.genplan); return Promise.resolve(N.genplan); }
    lastKey = key; var req = ++lastReq;
    N.genplan = { loading: true, lat: p.lat, lng: p.lng }; renderGenplan(N.genplan);
    var done = function (st) { if (req !== lastReq) return N.genplan; N.genplan = st; renderGenplan(st); try { var A = window.CASE_GEO_AGENT, fk = st.genplan ? p.lat.toFixed(5) + ',' + p.lng.toFixed(5) : ''; /* факт в журнал только по точке, которую поставил пользователь, и один раз на точку */ if (A && typeof A.say === 'function' && st.genplan && A.state && A.state.site && fk !== lastFactKey) { lastFactKey = fk; A.say('fact', '<b>Генплан (НГИС)</b>: ' + rowsOf(st.genplan).slice(0, 4).map(function (r) { return esc(r[0]) + ' ' + esc(r[1]); }).join('; ') + '.'); } } catch (e) {} try { injectProbe(); } catch (e2) {} return st; };
    var live = function (why) {
      return Promise.all([queryAt(LAYERS.GENPLAN, p.lat, p.lng).catch(function (e) { return { __err: e }; }), queryAt(LAYERS.NALOG, p.lat, p.lng).catch(function () { return null; })]).then(function (rs) {
        var g = rs[0], st = { lat: p.lat, lng: p.lng, genplan: null, nalog: rs[1], error: null, at: new Date().toISOString(), source: 'live' };
        if (g && g.__err) st.error = 'НГИС недоступен: ' + (g.__err.message || g.__err) + (why ? ' (' + why + ')' : '') + '. Проверьте доступ к db.ngis.uz из вашей сети.'; else st.genplan = g;
        return done(st);
      });
    };
    /* сначала локальная выгрузка (без сети), живой запрос только если точки в ней нет */
    return loadLocal().then(function (Lx) {
      if (req !== lastReq) return N.genplan;
      var hits = Lx.genplan ? localAt(Lx.genplan, p.lat, p.lng) : [], pk = pickLocal(hits);
      if (pk) { var nh = Lx.nalog ? localAt(Lx.nalog, p.lat, p.lng) : []; return done({ lat: p.lat, lng: p.lng, genplan: attrsOf(pk.main.p), also: pk.also.map(function (a) { return a.p.f; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; }), nalog: nh.length ? { ez_tashkent: nh[0].p.zone } : null, error: null, at: new Date().toISOString(), source: 'local' }); }
      return live(Lx.genplan ? 'точка вне локальной выгрузки генплана' : 'локальная выгрузка не загружена');
    });
  }
  N.genplanAt = genplanAt; N.rowsOf = rowsOf;
  function mountPoint() {
    if ($('ngisPoint')) return true;
    /* по замечанию владельца (v4.78.0): блок живёт в разделе «Махалли и демография», в конце его тела,
       а не под «Точкой анализа»; обновляется по точке анализа, как и раньше */
    var sect = $('mahSect'); var host = sect && sect.querySelector('.sbody'); if (!host) return false;
    var d = document.createElement('div'); d.id = 'ngisPoint'; d.className = 'ngis-point';
    d.innerHTML = '<div id="ngisPointBody"></div><label class="ck" style="margin-top:4px"><input type="checkbox" id="ngisLayer"> Зоны генплана на карте <span class="mini" style="display:inline">(выгрузка НГИС, 7 419 зон)</span></label><div class="ngis-legend" id="ngisLegend" hidden></div>';
    host.appendChild(d);
    gLegend = $('ngisLegend');
    $('ngisLayer').onchange = function () { toggleLayer(this.checked); };
    renderGenplan(N.genplan);
    return true;
  }
  function onPoint() { var p = point(); genplanAt(p); }
  var seenKey = '';
  function pollPoint() { var p = point(), k = p ? p.lat.toFixed(5) + ',' + p.lng.toFixed(5) : ''; if (k !== seenKey) { seenKey = k; onPoint(); } }
  function hooks() {
    /* точку ставят через caseGeoSetPoint (агент, пин, правый клик); renderProj студия подменяет при загрузке, поэтому не полагаемся на него */
    var sp = window.caseGeoSetPoint; if (typeof sp === 'function' && !sp._ngis) { var w = function () { var r = sp.apply(this, arguments); try { pollPoint(); } catch (e) {} return r; }; w._ngis = true; window.caseGeoSetPoint = w; }
    var pa = window.probeAt; if (typeof pa === 'function' && !pa._ngis) { var w2 = function (la, ln) { var r = pa.apply(this, arguments); return Promise.resolve(r).then(function (v) { try { injectProbe(); } catch (e) {} return v; }); }; w2._ngis = true; window.probeAt = w2; }
  }
  function injectProbe() {
    var body = document.querySelector('#probe .body'); if (!body || !N.genplan || N.genplan.loading || !N.genplan.genplan) return;
    var old = body.querySelector('.ngis-probe'); if (old) old.remove();
    var rows = rowsOf(N.genplan.genplan), d = document.createElement('div'); d.className = 'ngis-probe';
    d.innerHTML = '<h3 style="margin:16px 0 8px">M. Генплан Ташкента в точке (НГИС)</h3><table>' + rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + (N.genplan.nalog && N.genplan.nalog.ez_tashkent ? '<tr><td>Налоговая зона</td><td>' + esc(N.genplan.nalog.ez_tashkent) + '</td></tr>' : '') + '</table><p class="mini">' + esc(ATTR) + (N.genplan.source === 'local' ? ', выгрузка 18.09.2026' : ', живой запрос') + '. Публичные данные, условия коммерческого переиспользования не подтверждены.</p>';
    body.appendChild(d);
    try { if (typeof LASTPROBE !== 'undefined' && LASTPROBE) LASTPROBE.html = String(LASTPROBE.html || '') + d.innerHTML; } catch (e) {}
  }
  function css() {
    if ($('geoNgisCss')) return;
    var s = document.createElement('style'); s.id = 'geoNgisCss'; s.textContent =
      '.ngis-row{margin:6px 0;display:flex;flex-wrap:wrap;gap:4px;align-items:center}.ngis-row .mini{flex-basis:100%}'
      + '.ngis-point{margin-top:8px;border-top:1px dashed var(--line,#e3dcd1);padding-top:6px}.ngis-h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--red-d,#7a0000);margin-bottom:4px}'
      + '.ngis-t{width:100%;border-collapse:collapse;font-size:11px}.ngis-t td{padding:2px 4px;border-bottom:1px solid #f0ece6;vertical-align:top}.ngis-t td:first-child{color:var(--muted,#6f6a63);white-space:nowrap}'
      + '.ngis-legend{display:flex;flex-wrap:wrap;gap:3px 8px;font-size:10px;color:var(--muted,#6f6a63);margin:4px 0}.ngis-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:3px;vertical-align:-1px;opacity:.85}.ngis-legend small{opacity:.7}';
    document.head.appendChild(s);
  }
  function install() {
    css();
    var tries = 0;
    (function tick() {
      var ok = mountMahallaButton() && mountPoint();
      if (ok) { hooks(); pollPoint(); setInterval(function () { try { hooks(); pollPoint(); } catch (e) {} }, 1500); return; }
      if (++tries < 120) setTimeout(tick, 250);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4780-geo-ngis'] = '4.79.0';
