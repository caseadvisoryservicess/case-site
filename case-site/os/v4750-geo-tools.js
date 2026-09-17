/* CASE OS v4.75.0: панель инструментов карты, контекстное меню, отмена и повтор.
 *
 * Замечание владельца: внизу по центру карты нужна панель как в Felt: отмена и повтор,
 * пин (P), полигон по точкам (O), полигон от руки (F), буфер-круг заданного радиуса (C),
 * маршрут между двумя точками (R), комментарий (M), стиль карты. По правому клику на карте:
 * добавить метку здесь, круг отсюда, маршрут отсюда, переместиться сюда, получить сведения,
 * скопировать координаты, вставить объект из буфера обмена.
 *
 * Все фигуры уходят в гео-агент (точка анализа, зона): пин = точка анализа, полигон и круг =
 * фигуры зоны, по которым агент считает население, площадь и конкурентов. Маршрут строится
 * по дорогам OSM через OSRM из браузера; комментарии живут в localStorage этого браузера.
 * Обычный левый клик по карте ничего не открывает; карточку даёт клик по объекту.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_TOOLS) return;
  var VERSION = '4.75.0', NOTES_KEY = 'caseos_geo_notes_v1', OSRM = 'https://router.project-osrm.org/route/v1/driving/';
  var TL = window.CASE_GEO_TOOLS = { version: VERSION };
  var ST = { tool: null, pts: [], preview: null, undo: [], redo: [], routes: null, notes: null, notesData: [], circle: null, freeOn: false, menu: null, seq: 0 };
  function $(id) { return document.getElementById(id); }
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function agent() { return window.CASE_GEO_AGENT || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function km(a, b, c, d) { var R = 6371, r = function (x) { return x * Math.PI / 180; }; var s = Math.pow(Math.sin(r(c - a) / 2), 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.pow(Math.sin(r(d - b) / 2), 2); return R * 2 * Math.asin(Math.sqrt(s)); }
  function fmtKm(m) { return m >= 1000 ? (Math.round(m / 100) / 10) + ' км' : Math.round(m) + ' м'; }

  function css() {
    if ($('geoToolsCss')) return;
    var s = document.createElement('style'); s.id = 'geoToolsCss'; s.textContent =
      '.geo-tb{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:1005;display:flex;align-items:center;gap:2px;padding:6px;background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:14px;box-shadow:0 8px 24px rgba(40,30,20,.16);user-select:none}'
      + '.geo-tb button{width:38px;height:38px;border:0;background:none;border-radius:10px;font-size:17px;line-height:1;cursor:pointer;color:var(--ink,#1b1b1b);display:flex;align-items:center;justify-content:center;position:relative;padding:0}'
      + '.geo-tb button:hover{background:var(--paper-2,#f3f1ee)}.geo-tb button.on{background:#9E0000;color:#fff}.geo-tb button:disabled{opacity:.3;cursor:default;background:none}'
      + '.geo-tb .sep{width:1px;height:24px;background:var(--line,#e3dcd1);margin:0 4px}'
      + '.geo-tb button[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:46px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:9px;padding:6px 10px;font:600 12px inherit;color:var(--ink,#1b1b1b);box-shadow:0 6px 18px rgba(40,30,20,.14);pointer-events:none}'
      + '.geo-tb button kbd{position:absolute;right:3px;bottom:2px;font:700 8px/1 inherit;color:var(--muted,#6f6a63);background:var(--paper-2,#f3f1ee);border-radius:3px;padding:1px 3px}.geo-tb button.on kbd{color:#9E0000;background:#fff}'
      + '.geo-tb-hint{position:absolute;left:50%;bottom:68px;transform:translateX(-50%);z-index:1005;background:#1b1b1b;color:#fff;font:600 12px inherit;padding:7px 12px;border-radius:9px;white-space:nowrap;display:none;align-items:center;gap:6px;box-shadow:0 6px 18px rgba(0,0,0,.2)}.geo-tb-hint.on{display:flex}'
      + '.geo-tb-hint input{width:64px;border-radius:6px;border:0;padding:4px 6px;font:inherit;font-size:12px}.geo-tb-hint button{border:0;border-radius:6px;padding:4px 9px;font:700 12px inherit;cursor:pointer;background:#fff;color:#1b1b1b}.geo-tb-hint button.pri{background:#9E0000;color:#fff}'
      + '.geo-cmenu{position:absolute;z-index:1300;background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:12px;box-shadow:0 10px 30px rgba(40,30,20,.2);padding:6px;min-width:262px;font-size:12.5px}'
      + '.geo-cmenu button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;padding:8px 10px;border-radius:8px;font:inherit;font-size:12.5px;color:var(--ink,#1b1b1b);cursor:pointer}.geo-cmenu button:hover{background:var(--paper-2,#f3f1ee)}.geo-cmenu .ic{width:18px;text-align:center;flex:0 0 auto}.geo-cmenu hr{border:0;border-top:1px solid var(--line-2,#eee9e1);margin:4px 0}'
      + '.geo-cmenu .geo-cmenu-xy{padding:4px 10px 6px;font-size:10.5px;color:var(--muted,#6f6a63)}'
      + '.geo-note-ic{width:28px;height:28px;border-radius:50% 50% 50% 0;background:#1b1b1b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)}.geo-note-ic span{transform:rotate(45deg)}'
      + '.geo-note-form textarea{width:220px;min-height:64px;border:1px solid var(--line,#e3dcd1);border-radius:8px;padding:6px 8px;font:inherit;font-size:12px;resize:vertical}.geo-note-form .row{display:flex;gap:6px;margin-top:6px}.geo-note-form button{border:1px solid var(--line,#e3dcd1);border-radius:7px;background:#fff;padding:5px 10px;font:700 12px inherit;cursor:pointer}.geo-note-form button.pri{background:#9E0000;color:#fff;border-color:#9E0000}'
      + '.geo-note-view{font-size:12.5px;max-width:240px;white-space:pre-wrap}.geo-note-view small{display:block;color:var(--muted,#6f6a63);margin-top:4px}.geo-note-view button{margin-top:6px;border:1px solid var(--line,#e3dcd1);border-radius:7px;background:#fff;padding:4px 9px;font:700 11px inherit;cursor:pointer;color:#9E0000}'
      + '.leaflet-container.geo-tool-cursor{cursor:crosshair}.leaflet-container.geo-tool-free{cursor:cell}'
      + '.geo-info{font-size:12.5px;max-width:260px;line-height:1.45}.geo-info b{display:block}.geo-info small{color:var(--muted,#6f6a63)}'
      + '.geo-toast{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);z-index:1400;background:#1b1b1b;color:#fff;font:600 12px inherit;padding:8px 13px;border-radius:9px;opacity:0;transition:opacity .18s;pointer-events:none;max-width:80%}.geo-toast.on{opacity:1}'
      + '@media(max-width:620px){.geo-tb{bottom:64px;padding:4px}.geo-tb button{width:34px;height:34px;font-size:15px}.geo-tb button kbd{display:none}.geo-tb-hint{bottom:110px}}';
    document.head.appendChild(s);
  }

  var TOOLS = [
    { a: 'pin', ic: '📍', key: 'P', tip: 'Пин: точка анализа · P' },
    { a: 'poly', ic: '⬠', key: 'O', tip: 'Полигон по точкам · O (Enter замкнуть, Esc отмена)' },
    { a: 'free', ic: '✎', key: 'F', tip: 'Полигон от руки · F (тяните мышью)' },
    { a: 'circle', ic: '◯', key: 'C', tip: 'Буфер: круг заданного радиуса · C' },
    { a: 'route', ic: '⤳', key: 'R', tip: 'Маршрут между двумя точками · R' },
    { a: 'note', ic: '💬', key: 'M', tip: 'Комментарий на карте · M' }
  ];
  var HINTS = { pin: 'Кликните по карте, чтобы поставить точку анализа', poly: 'Кликайте по карте: вершины полигона. Enter или двойной клик замкнёт, Esc отменит', free: 'Зажмите кнопку мыши и обведите область', circle: 'Кликните центр круга, затем кликните на нужном расстоянии', route: 'Кликните начало маршрута, затем конец', note: 'Кликните по карте, чтобы оставить комментарий' };

  function toolbar() {
    var mapEl = $('map'); if (!mapEl || $('geoTb')) return;
    var tb = document.createElement('div'); tb.className = 'geo-tb'; tb.id = 'geoTb'; tb.setAttribute('role', 'toolbar'); tb.setAttribute('aria-label', 'Инструменты карты');
    tb.innerHTML = '<button type="button" data-a="undo" data-tip="Отменить · Ctrl+Z" aria-label="Отменить" disabled>↶</button><button type="button" data-a="redo" data-tip="Повторить · Ctrl+Y" aria-label="Повторить" disabled>↷</button><span class="sep"></span>'
      + TOOLS.map(function (t) { return '<button type="button" data-a="' + t.a + '" data-tip="' + esc(t.tip) + '" aria-label="' + esc(t.tip) + '">' + t.ic + '<kbd>' + t.key + '</kbd></button>'; }).join('')
      + '<span class="sep"></span><button type="button" data-a="style" data-tip="Стиль карты: подложка" aria-label="Стиль карты">▦</button>';
    /* внутри контейнера карты: «по центру» значит по центру карты, а не всей страницы с левой панелью */
    mapEl.appendChild(tb);
    var hint = document.createElement('div'); hint.className = 'geo-tb-hint'; hint.id = 'geoTbHint'; mapEl.appendChild(hint);
    var toast = document.createElement('div'); toast.className = 'geo-toast'; toast.id = 'geoToast'; mapEl.appendChild(toast);
    try { L.DomEvent.disableClickPropagation(tb); L.DomEvent.disableScrollPropagation(tb); L.DomEvent.disableClickPropagation(hint); } catch (e) {}
    tb.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var a = b.getAttribute('data-a');
      if (a === 'undo') return undo();
      if (a === 'redo') return redo();
      if (a === 'style') { var sb = document.querySelector('.geo-basectl-btn'); if (sb) sb.click(); return; }
      setTool(ST.tool === a ? null : a);
    });
  }
  var toastT = null;
  function toast(msg) { var t = $('geoToast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2800); }
  function hint(html) { var h = $('geoTbHint'); if (!h) return; if (!html) { h.classList.remove('on'); h.innerHTML = ''; return; } h.innerHTML = html; h.classList.add('on'); }
  function syncButtons() {
    document.querySelectorAll('#geoTb button[data-a]').forEach(function (b) { var a = b.getAttribute('data-a'); if (a === 'undo') b.disabled = !ST.undo.length; else if (a === 'redo') b.disabled = !ST.redo.length; else b.classList.toggle('on', a === ST.tool); });
  }

  /* --- отмена и повтор ---------------------------------------------------------- */
  function push(action) { ST.undo.push(action); ST.redo = []; syncButtons(); }
  function undo() { var a = ST.undo.pop(); if (!a) return; try { a.undo(); } catch (e) {} ST.redo.push(a); syncButtons(); toast('Отменено: ' + a.label); }
  function redo() { var a = ST.redo.pop(); if (!a) return; try { a.redo(); } catch (e) {} ST.undo.push(a); syncButtons(); toast('Повторено: ' + a.label); }

  /* --- режимы --------------------------------------------------------------------- */
  function previewGroup() { var M = theMap(); if (!M) return null; if (!ST.preview) ST.preview = L.layerGroup().addTo(M); return ST.preview; }
  function clearPreview() { if (ST.preview) ST.preview.clearLayers(); }
  function setTool(name) {
    var M = theMap(); if (!M) return;
    cancel(true);
    ST.tool = name || null;
    var A = agent(); if (A && A.setPick) try { A.setPick(false); } catch (e) {}
    M.getContainer().classList.toggle('geo-tool-cursor', !!name && name !== 'free');
    M.getContainer().classList.toggle('geo-tool-free', name === 'free');
    if (name === 'poly' || name === 'free') { try { ST.dblWas = M.doubleClickZoom.enabled(); M.doubleClickZoom.disable(); } catch (e) {} }
    if (name === 'free') { try { ST.dragWas = M.dragging.enabled(); M.dragging.disable(); } catch (e) {} }
    hint(name ? esc(HINTS[name] || '') : '');
    syncButtons();
  }
  function cancel(silent) {
    var M = theMap();
    ST.pts = []; ST.circle = null; ST.freeOn = false; clearPreview();
    if (M) { try { if (ST.dblWas) M.doubleClickZoom.enable(); } catch (e) {} try { if (ST.dragWas) M.dragging.enable(); } catch (e) {} }
    ST.dblWas = null; ST.dragWas = null;
    if (!silent) { ST.tool = null; if (M) { M.getContainer().classList.remove('geo-tool-cursor'); M.getContainer().classList.remove('geo-tool-free'); } hint(''); syncButtons(); }
  }
  function finishTool() { setTool(null); }

  /* --- пин: точка анализа ----------------------------------------------------------- */
  function setSite(lat, lon, name) {
    var A = agent(); if (!A) { toast('Гео-агент не загружен'); return Promise.resolve(); }
    var prev = A.state.site ? { lat: A.state.site.lat, lon: A.state.site.lon, name: A.state.site.name } : null;
    return A.run('set_site', { lat: lat, lon: lon, name: name || 'точка на карте' }).then(function (res) {
      try { A.say('fact', A.factHtml('set_site', res)); A.say('ai', A.narrative([{ name: 'set_site', res: res }])); } catch (e) {}
      push({ label: 'точка анализа', undo: function () { if (prev) A.run('set_site', prev); else toast('Прежней точки не было: точка остаётся'); }, redo: function () { A.run('set_site', { lat: lat, lon: lon, name: name || 'точка на карте' }); } });
    }, function (e) { toast(String(e && e.message || e)); });
  }

  /* --- полигоны и круги: фигуры зоны агента ---------------------------------------- */
  function simplify(pts, tolM) {
    if (pts.length < 4) return pts;
    var lat0 = pts[0][0], kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111320;
    var P = pts.map(function (p) { return [p[1] * kx, p[0] * ky]; });
    /* если концы отрезка совпадают (замкнутая обводка: отпустили там же, где нажали), расстояние
       считаем до точки, иначе все вершины «лежат на отрезке» и обводка схлопывается в две точки */
    function dp(i, j, keep) { var maxD = 0, idx = -1, ax = P[i][0], ay = P[i][1], bx = P[j][0], by = P[j][1], dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy); for (var k = i + 1; k < j; k++) { var d = len < 1e-6 ? Math.sqrt(Math.pow(P[k][0] - ax, 2) + Math.pow(P[k][1] - ay, 2)) : Math.abs(dy * P[k][0] - dx * P[k][1] + bx * ay - by * ax) / len; if (d > maxD) { maxD = d; idx = k; } } if (maxD > tolM && idx > 0) { dp(i, idx, keep); keep[idx] = true; dp(idx, j, keep); } }
    var keep = {}; keep[0] = true; keep[pts.length - 1] = true; dp(0, pts.length - 1, keep);
    return pts.filter(function (p, i) { return keep[i]; });
  }
  function commitShape(kind, data) {
    var A = agent(); if (!A) { toast('Гео-агент не загружен'); return; }
    var call = kind === 'circle' ? A.run('draw_circle', data) : A.run('draw_polygon', { points: data });
    call.then(function (res) {
      var shape = A.state.zone[A.state.zone.length - 1];
      try { A.say('fact', A.factHtml(kind === 'circle' ? 'draw_circle' : 'draw_polygon', res)); } catch (e) {}
      push({ label: kind === 'circle' ? 'круг' : 'полигон', undo: function () { A.removeShape(shape); }, redo: function () { A.addShape(shape); } });
      if (window.CASE_GEO_LAYOUT && window.CASE_GEO_LAYOUT.openAgent) window.CASE_GEO_LAYOUT.openAgent(true);
      return A.ask('площадь зоны, население в зоне, конкуренты в зоне');
    }, function (e) { toast(String(e && e.message || e)); });
  }
  function drawPolyPreview(closing) {
    var g = previewGroup(); if (!g) return; g.clearLayers();
    if (ST.pts.length > 1) L.polyline(ST.pts, { color: '#9E0000', weight: 2, dashArray: '5' }).addTo(g);
    ST.pts.forEach(function (p, i) { L.circleMarker(p, { radius: i === 0 ? 5 : 3, color: '#9E0000', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(g); });
    if (closing && ST.pts.length >= 3) L.polygon(ST.pts, { color: '#9E0000', weight: 1, fillColor: '#9E0000', fillOpacity: .06, dashArray: '3' }).addTo(g);
  }
  function finishPolygon() {
    if (ST.pts.length < 3) { toast('Нужно минимум три точки'); return; }
    var ring = ST.pts.slice(); finishTool(); commitShape('polygon', ring);
  }
  function circlePreview(lat, lon, r) {
    var g = previewGroup(); if (!g) return; g.clearLayers();
    L.circleMarker([lat, lon], { radius: 4, color: '#9E0000', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(g);
    if (r > 0) L.circle([lat, lon], { radius: r, color: '#9E0000', weight: 2, dashArray: '5', fillColor: '#9E0000', fillOpacity: .06 }).addTo(g);
  }
  function circleAsk(lat, lon, r) {
    ST.circle = { lat: lat, lon: lon, r: r, fixed: true };
    circlePreview(lat, lon, r);
    hint('Радиус, км: <input type="number" id="geoCircleKm" min="0.05" max="50" step="0.05" value="' + (Math.round(r / 10) / 100) + '"> <button type="button" class="pri" id="geoCircleOk">Готово</button><button type="button" id="geoCircleNo">Отмена</button>');
    var inp = $('geoCircleKm');
    inp.addEventListener('input', function () { var v = parseFloat(inp.value); if (v > 0) { ST.circle.r = v * 1000; circlePreview(lat, lon, ST.circle.r); } });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); $('geoCircleOk').click(); } });
    $('geoCircleOk').onclick = function () { var c = ST.circle; finishTool(); commitShape('circle', { lat: c.lat, lon: c.lon, radius_m: Math.round(c.r) }); };
    $('geoCircleNo').onclick = function () { finishTool(); };
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) {} }, 0);
  }
  TL.circleAt = function (lat, lon) { setTool('circle'); ST.circle = { lat: lat, lon: lon, r: 0, fixed: false }; circlePreview(lat, lon, 0); hint('Кликните на нужном расстоянии от центра'); };

  /* --- маршрут ------------------------------------------------------------------- */
  function routeGroup() { var M = theMap(); if (!M) return null; if (!ST.routes) ST.routes = L.layerGroup().addTo(M); return ST.routes; }
  function route(a, b) {
    var g = routeGroup(); if (!g) return;
    hint('Строю маршрут по дорогам OSM…');
    var url = OSRM + a[1].toFixed(6) + ',' + a[0].toFixed(6) + ';' + b[1].toFixed(6) + ',' + b[0].toFixed(6) + '?overview=full&geometries=geojson';
    fetch(url, { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      var rt = j && j.routes && j.routes[0]; if (!rt || !rt.geometry) throw new Error('маршрут не найден');
      var line = rt.geometry.coordinates.map(function (c) { return [c[1], c[0]]; }), dist = rt.distance, mins = Math.round(rt.duration / 60);
      var lg = L.layerGroup();
      L.polyline(line, { color: '#1565c0', weight: 5, opacity: .9 }).addTo(lg).bindTooltip('🚗 ' + fmtKm(dist) + ' · ' + mins + ' мин (OSRM, дороги OSM)', { sticky: true });
      L.circleMarker(a, { radius: 5, color: '#fff', weight: 2, fillColor: '#1565c0', fillOpacity: 1 }).addTo(lg).bindTooltip('старт');
      L.circleMarker(b, { radius: 5, color: '#fff', weight: 2, fillColor: '#9E0000', fillOpacity: 1 }).addTo(lg).bindTooltip('финиш · ' + fmtKm(dist) + ' · ' + mins + ' мин', { permanent: true, direction: 'top' });
      lg.addTo(g);
      push({ label: 'маршрут', undo: function () { g.removeLayer(lg); }, redo: function () { g.addLayer(lg); } });
      finishTool(); toast('Маршрут: ' + fmtKm(dist) + ', около ' + mins + ' мин на авто (OSRM, дороги OSM)');
      var A = agent(); if (A && A.say) try { A.say('fact', '<div class="ga-fbody"><b>Маршрут</b> ' + fmtKm(dist) + ' · ' + mins + ' мин на авто <span class="ga-prov ga-m" title="Источник: OSRM (project-osrm.org), дороги OSM"><i>ƒ</i>расчёт</span></div>'); } catch (e) {}
    }).catch(function (e) { finishTool(); var d = km(a[0], a[1], b[0], b[1]) * 1000; toast('Маршрутизатор недоступен (' + String(e && e.message || e) + '); по прямой ' + fmtKm(d)); });
  }
  TL.routeFrom = function (lat, lon) { setTool('route'); ST.pts = [[lat, lon]]; drawPolyPreview(false); hint('Кликните конец маршрута'); };

  /* --- комментарии --------------------------------------------------------------- */
  function notesGroup() { var M = theMap(); if (!M) return null; if (!ST.notes) ST.notes = L.layerGroup().addTo(M); return ST.notes; }
  function saveNotes() { try { localStorage.setItem(NOTES_KEY, JSON.stringify(ST.notesData.map(function (n) { return { id: n.id, lat: n.lat, lon: n.lon, text: n.text, at: n.at }; }))); } catch (e) {} }
  function noteIcon() { return L.divIcon({ className: '', html: '<div class="geo-note-ic"><span>💬</span></div>', iconSize: [28, 28], iconAnchor: [4, 28], popupAnchor: [10, -26] }); }
  function noteMarker(n) {
    var m = L.marker([n.lat, n.lon], { icon: noteIcon(), title: n.text.slice(0, 60) });
    m.bindTooltip(esc(n.text.slice(0, 80)), { direction: 'top', offset: [10, -26] });
    m.bindPopup(function () { var d = document.createElement('div'); d.className = 'geo-note-view'; d.innerHTML = esc(n.text) + '<small>' + esc(n.at) + '</small>'; var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Удалить'; b.onclick = function () { removeNote(n, true); }; d.appendChild(b); return d; });
    m._note = n; return m;
  }
  function addNote(n, silent) { var g = notesGroup(); if (!g) return; var m = noteMarker(n); m.addTo(g); n._m = m; if (ST.notesData.indexOf(n) < 0) ST.notesData.push(n); saveNotes(); if (!silent) push({ label: 'комментарий', undo: function () { removeNote(n, false); }, redo: function () { addNote(n, true); } }); }
  function removeNote(n, withUndo) { var g = notesGroup(); if (g && n._m) g.removeLayer(n._m); var i = ST.notesData.indexOf(n); if (i >= 0) ST.notesData.splice(i, 1); saveNotes(); try { theMap().closePopup(); } catch (e) {} if (withUndo) push({ label: 'удаление комментария', undo: function () { addNote(n, true); }, redo: function () { removeNote(n, false); } }); }
  function noteForm(lat, lon) {
    var M = theMap(); if (!M) return;
    var d = document.createElement('div'); d.className = 'geo-note-form';
    d.innerHTML = '<textarea placeholder="Комментарий к этому месту" aria-label="Текст комментария"></textarea><div class="row"><button type="button" class="pri">Сохранить</button><button type="button">Отмена</button></div>';
    var pop = L.popup({ closeButton: false, autoClose: true, className: 'geo-note-pop' }).setLatLng([lat, lon]).setContent(d).openOn(M);
    var ta = d.querySelector('textarea'), btns = d.querySelectorAll('button');
    btns[0].onclick = function () { var t = ta.value.trim(); if (!t) { ta.focus(); return; } M.closePopup(pop); addNote({ id: 'n' + Date.now().toString(36), lat: lat, lon: lon, text: t.slice(0, 500), at: new Date().toISOString().slice(0, 16).replace('T', ' ') }, false); finishTool(); };
    btns[1].onclick = function () { M.closePopup(pop); finishTool(); };
    setTimeout(function () { try { ta.focus(); } catch (e) {} }, 0);
  }
  function loadNotes() { try { var arr = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); if (Array.isArray(arr)) arr.forEach(function (n) { if (n && Number.isFinite(+n.lat) && Number.isFinite(+n.lon) && n.text) addNote({ id: n.id || ('n' + Math.random().toString(36).slice(2)), lat: +n.lat, lon: +n.lon, text: String(n.text), at: n.at || '' }, true); }); } catch (e) {} }

  /* --- события карты ------------------------------------------------------------ */
  function onClick(e) {
    var lat = e.latlng.lat, lon = e.latlng.lng, t = ST.tool;
    if (!t) return;
    if (t === 'pin') { finishTool(); setSite(lat, lon); return; }
    if (t === 'poly') {
      if (ST.pts.length >= 3 && km(lat, lon, ST.pts[0][0], ST.pts[0][1]) * 1000 < 12 * metersPerPixel()) { finishPolygon(); return; }
      ST.pts.push([lat, lon]); drawPolyPreview(false); hint('Вершин: ' + ST.pts.length + '. Enter, двойной клик или клик по первой точке замкнёт'); return;
    }
    if (t === 'circle') {
      if (!ST.circle || ST.circle.fixed) { ST.circle = { lat: lat, lon: lon, r: 0, fixed: false }; circlePreview(lat, lon, 0); hint('Кликните на нужном расстоянии от центра'); return; }
      var r = Math.max(20, km(ST.circle.lat, ST.circle.lon, lat, lon) * 1000); circleAsk(ST.circle.lat, ST.circle.lon, r); return;
    }
    if (t === 'route') {
      if (!ST.pts.length) { ST.pts = [[lat, lon]]; drawPolyPreview(false); hint('Кликните конец маршрута'); return; }
      var a = ST.pts[0]; ST.pts = []; clearPreview(); route(a, [lat, lon]); return;
    }
    if (t === 'note') { noteForm(lat, lon); return; }
  }
  function metersPerPixel() { var M = theMap(); try { var c = M.getCenter(); return 40075016.686 * Math.abs(Math.cos(c.lat * Math.PI / 180)) / Math.pow(2, M.getZoom() + 8); } catch (e) { return 10; } }
  function onMove(e) {
    if (ST.tool === 'circle' && ST.circle && !ST.circle.fixed) { var r = km(ST.circle.lat, ST.circle.lon, e.latlng.lat, e.latlng.lng) * 1000; circlePreview(ST.circle.lat, ST.circle.lon, r); hint('Радиус ' + fmtKm(r) + ': кликните, чтобы зафиксировать'); }
    if (ST.tool === 'free' && ST.freeOn) { ST.pts.push([e.latlng.lat, e.latlng.lng]); drawPolyPreview(false); }
  }
  function onDown(e) { if (ST.tool === 'free') { ST.freeOn = true; ST.pts = [[e.latlng.lat, e.latlng.lng]]; } }
  function onUp() {
    if (ST.tool !== 'free' || !ST.freeOn) return;
    ST.freeOn = false;
    var ring = simplify(ST.pts, Math.max(8, metersPerPixel() * 3));
    if (ring.length < 3) { toast('Обведите область: слишком мало точек'); ST.pts = []; clearPreview(); return; }
    finishTool(); commitShape('polygon', ring);
  }
  function onDbl(e) { if (ST.tool === 'poly') { try { L.DomEvent.stop(e); } catch (x) {} finishPolygon(); } }
  function onKey(e) {
    var tgt = e.target, tag = tgt && tgt.tagName ? tgt.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || (tgt && tgt.isContentEditable)) { if (e.key === 'Escape' && ST.tool) cancel(false); return; }
    if ((e.ctrlKey || e.metaKey) && !e.altKey) { var k = e.key.toLowerCase(); if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; } if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; } return; }
    if (e.key === 'Escape') { if (ST.menu) hideMenu(); if (ST.tool) cancel(false); return; }
    if (e.key === 'Enter' && ST.tool === 'poly') { e.preventDefault(); finishPolygon(); return; }
    var m = { p: 'pin', o: 'poly', f: 'free', c: 'circle', r: 'route', m: 'note' }[e.key.toLowerCase()];
    if (m) { e.preventDefault(); setTool(ST.tool === m ? null : m); }
  }

  /* --- контекстное меню --------------------------------------------------------- */
  function hideMenu() { if (ST.menu) { ST.menu.remove(); ST.menu = null; } }
  function districtOf(lat, lon) { try { return (typeof distFast === 'function' && distFast(lat, lon)) || ''; } catch (e) { return ''; } }
  function nearestBc(lat, lon) {
    try { var rows = (typeof BC !== 'undefined' && Array.isArray(BC) ? BC : []).map(function (b) { return typeof eff === 'function' ? eff(b) : b; }).filter(function (b) { return b && b.lat != null && b.lng != null; }); var best = null; rows.forEach(function (b) { var d = km(lat, lon, +b.lat, +b.lng) * 1000; if (!best || d < best.d) best = { d: d, name: b.name || '' }; }); return best; } catch (e) { return null; }
  }
  function copyText(t) { return (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject(new Error('нет доступа к буферу'))).then(function () { toast('Скопировано: ' + t); }, function () { window.prompt('Скопируйте координаты', t); }); }
  function pasteFromClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Браузер не даёт читать буфер обмена: вставьте текст в строку гео-агента'); return; }
    navigator.clipboard.readText().then(function (t) {
      t = String(t || '').trim(); if (!t) { toast('Буфер обмена пуст'); return; }
      var m = t.match(/(-?\d{1,2}\.\d{3,})[,;\s]+(-?\d{1,3}\.\d{3,})/);
      if (m) { setSite(parseFloat(m[1]), parseFloat(m[2]), 'из буфера обмена'); return; }
      var A = agent(); if (A) { if (window.CASE_GEO_LAYOUT && window.CASE_GEO_LAYOUT.openAgent) window.CASE_GEO_LAYOUT.openAgent(true); A.ask('адрес: ' + t.slice(0, 120)); } else toast('Не координаты и не адрес: ' + t.slice(0, 60));
    }, function () { toast('Доступ к буферу обмена не разрешён'); });
  }
  function info(lat, lon) {
    var M = theMap(); if (!M) return;
    var d = districtOf(lat, lon), nb = nearestBc(lat, lon), A = agent();
    var html = '<div class="geo-info"><b>' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</b>' + (d ? 'Район: ' + esc(d) + '<br>' : '') + (nb ? 'Ближайший БЦ: ' + esc(nb.name) + ' (' + fmtKm(nb.d) + ')<br>' : '') + (A && A.state && A.state.site ? 'До точки анализа: ' + fmtKm(km(lat, lon, A.state.site.lat, A.state.site.lon) * 1000) + '<br>' : '') + '<small id="geoInfoAddr">Адрес: ищу в OpenStreetMap…</small></div>';
    var pop = L.popup({ maxWidth: 300 }).setLatLng([lat, lon]).setContent(html).openOn(M);
    var D = window.CASE_GEO_DIRECT;
    if (D && D.reverse) D.reverse(lat, lon, 'ru').then(function (r) { var el = $('geoInfoAddr'); if (!el) return; el.textContent = r && r.ok ? 'Адрес: ' + r.name + ' (OSM, ODbL)' : 'Адрес: ' + (r && r.message || 'не найден'); }, function () { var el = $('geoInfoAddr'); if (el) el.textContent = 'Адрес: геокодер недоступен'; });
    else { var el = $('geoInfoAddr'); if (el) el.textContent = 'Адрес: геокодер недоступен'; }
    void pop;
  }
  function showMenu(e) {
    hideMenu();
    var M = theMap(), mapEl = $('map'); if (!M || !mapEl) return;
    var lat = e.latlng.lat, lon = e.latlng.lng;
    var m = document.createElement('div'); m.className = 'geo-cmenu'; m.setAttribute('role', 'menu');
    var items = [
      ['pin', '📍', 'Добавить метку здесь (точка анализа)'], ['circle', '◯', 'Круг охвата отсюда…'], ['route', '⤳', 'Маршрут отсюда…'], ['center', '⤢', 'Переместиться сюда'], null,
      ['info', 'ℹ', 'Получить сведения'], ['copy', '⧉', 'Скопировать координаты'], ['paste', '📋', 'Вставить объект из буфера обмена']
    ];
    m.innerHTML = '<div class="geo-cmenu-xy">' + lat.toFixed(5) + ', ' + lon.toFixed(5) + '</div>' + items.map(function (it) { return it ? '<button type="button" data-a="' + it[0] + '"><span class="ic">' + it[1] + '</span>' + esc(it[2]) + '</button>' : '<hr>'; }).join('');
    var rect = mapEl.getBoundingClientRect(), x = e.containerPoint.x, y = e.containerPoint.y;
    m.style.left = Math.min(x, rect.width - 275) + 'px'; m.style.top = Math.min(y, rect.height - 330) + 'px';
    mapEl.appendChild(m); ST.menu = m;
    try { L.DomEvent.disableClickPropagation(m); L.DomEvent.disableScrollPropagation(m); } catch (x) {}
    m.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return; var a = b.getAttribute('data-a'); hideMenu();
      if (a === 'pin') setSite(lat, lon);
      else if (a === 'circle') TL.circleAt(lat, lon);
      else if (a === 'route') TL.routeFrom(lat, lon);
      else if (a === 'center') M.panTo([lat, lon]);
      else if (a === 'info') info(lat, lon);
      else if (a === 'copy') copyText(lat.toFixed(6) + ', ' + lon.toFixed(6));
      else if (a === 'paste') pasteFromClipboard();
    });
  }

  function install() {
    var M = theMap(); if (!M) return;
    css(); toolbar(); loadNotes();
    M.on('click', onClick); M.on('mousemove', onMove); M.on('mousedown', onDown); M.on('mouseup', onUp); M.on('dblclick', onDbl);
    M.on('contextmenu', function (e) { try { L.DomEvent.preventDefault(e.originalEvent); } catch (x) {} showMenu(e); });
    M.on('movestart zoomstart', hideMenu);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', function (e) { if (ST.menu && !(e.target.closest && e.target.closest('.geo-cmenu'))) hideMenu(); });
    syncButtons();
  }
  TL.setTool = setTool; TL.cancel = function () { cancel(false); }; TL.undo = undo; TL.redo = redo; TL.state = ST; TL.finishPolygon = finishPolygon; TL.notes = function () { return ST.notesData.map(function (n) { return { id: n.id, lat: n.lat, lon: n.lon, text: n.text, at: n.at }; }); }; TL.showInfo = info; TL.simplify = simplify;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4750-geo-tools'] = '4.75.0';
