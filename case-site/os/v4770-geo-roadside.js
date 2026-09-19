/* CASE OS v4.77.0: сторона дороги по типу проекта.
 *
 * Решение владельца: у точки анализа нужно понимать, с какой стороны дороги она стоит и
 * подходит ли эта сторона проекту. Бизнес-центру выгоднее сторона потока «в центр» (утренний
 * поток на работу, к деловым районам), ритейлу и продуктам выгоднее сторона «из центра»
 * (вечерний поток домой), клиники и образование целевые: сторона не решает, важны парковка,
 * подъезд с обеих сторон и видимость.
 *
 * Как считается:
 *   1. Дороги вокруг точки (250 м) берутся из гео-агента (load_roads, OpenStreetMap через
 *      прокси или напрямую из браузера). Ищется ближайший отрезок проезжей дороги.
 *   2. Направление «в центр»: вдоль отрезка в ту сторону, где ближе центр деловой активности
 *      Ташкента (Амир Темур / Сити, 41.3111, 69.2797). Движение правостороннее: поток идёт по
 *      правой стороне; точка справа от потока «в центр» стоит на стороне «в центр», иначе на
 *      стороне «из центра». Односторонняя дорога: обе стороны обслуживает один поток, тогда
 *      сторона точки «в центр» или «из центра» по направлению этого потока.
 *   3. Если дорога идёт почти поперёк направления на центр (кольцевая) или точка стоит в самом
 *      центре, вывод помечается как слабый.
 *   4. По типу проекта: совпадение стороны с предпочтением типа, встречная сторона или
 *      «сторона не критична» с параметрами, которые важны для целевых форматов.
 *
 * На карте: ближайший отрезок, стрелки потоков «в центр» и «из центра», подпись у точки.
 * Факт уходит в журнал гео-агента. Длинных тире в тексте нет намеренно.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_ROADSIDE) return;
  var VERSION = '4.79.0', KEY_TYPE = 'caseos_roadside_type', CENTER = [41.3111, 69.2797], SEARCH_M = 250, NEAR_CENTER_M = 800;
  var R = window.CASE_GEO_ROADSIDE = { version: VERSION, last: null };
  var gRoad = null, busy = false;
  var DRIVE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link)$/;
  var CLS_RU = { motorway: 'магистраль', trunk: 'магистраль', primary: 'главная улица', secondary: 'улица районного значения', tertiary: 'местная улица', unclassified: 'проезд', residential: 'жилая улица', living_street: 'жилая зона', service: 'служебный проезд', motorway_link: 'съезд', trunk_link: 'съезд', primary_link: 'съезд', secondary_link: 'съезд', tertiary_link: 'съезд' };
  /* Типы проектов: предпочтение стороны и что важно помимо стороны. */
  var TYPES = [
    { id: 'office', label: 'Бизнес-центр, офисы', pref: 'in', why: 'утренний поток на работу идёт к центру и деловым районам: вход и парковка со стороны «в центр» без разворота', extra: ['парковка 3 м/м на 100 м² GLA по нормативу CASE', 'близость метро и остановок для сотрудников', 'видимость фасада с потока «в центр»'] },
    { id: 'coffee', label: 'Кофейня, завтраки, утренний F&B', pref: 'in', why: 'утренний импульсный спрос «по дороге на работу»: сторона «в центр»', extra: ['остановка в 100 м', 'окно выдачи и короткая парковка'] },
    { id: 'retail', label: 'Супермаркет, продукты, стрит-ритейл', pref: 'out', why: 'вечерние покупки по дороге домой: сторона «из центра», к жилым массивам', extra: ['парковка перед входом', 'плотность жилья в 500-800 м', 'без разворота с вечернего потока'] },
    { id: 'pharmacy', label: 'Аптека', pref: 'out', why: 'покупка по дороге домой и рядом с жильём: сторона «из центра»', extra: ['поликлиника и остановка рядом', 'вечерний режим работы'] },
    { id: 'fnb', label: 'Ресторан, вечерний F&B', pref: 'out', why: 'вечерний и выходной спрос: сторона «из центра» и жилые районы', extra: ['парковка и такси-зона', 'терраса (коэффициент 0,7 к площади по нормативу CASE)'] },
    { id: 'fuel', label: 'АЗС, автосервис', pref: 'out', why: 'заправка по пути из города и перед выездом: сторона «из центра», лучше на магистрали', extra: ['въезд и выезд без пересечения встречного потока', 'класс дороги: магистраль или главная улица'] },
    { id: 'warehouse', label: 'Склад, логистика', pref: 'out', why: 'выезд из города и кольцевые магистрали: сторона «из центра»', extra: ['подъезд для фур без разворота', 'близость кольцевой и выездов'] },
    { id: 'clinic', label: 'Клиника, медицина', pref: 'any', why: 'целевой формат: пациент едет специально, сторона не решает', extra: ['парковка и подъезд с обеих сторон, разворот в 300 м', 'остановка и метро рядом для пациентов без машины', 'конкуренты: клиники и аптеки в 1 км (слой «Медицина»)'] },
    { id: 'education', label: 'Образование, детский сад, школа', pref: 'any', why: 'целевой формат: важна безопасность подхода и жильё рядом', extra: ['пешеходный подход без пересечения магистрали', 'жилые дома в 500-800 м', 'зона высадки детей'] },
    { id: 'hotel', label: 'Гостиница', pref: 'any', why: 'целевой формат: гость едет по адресу; важны подъезд такси и близость центра', extra: ['подъезд для такси и автобусов', 'аэропорт и вокзал по времени в пути', 'видимость вывески с обоих потоков'] },
    { id: 'residential', label: 'Жильё', pref: 'any', why: 'сторона дороги не решает; лучше тихая сторона, дальше от магистрали', extra: ['класс дороги: жилая улица предпочтительнее магистрали', 'школы, сады, парки в 500 м', 'шум и выбросы от магистрали'] }
  ];
  var VERDICT = { match: 'сторона подходит', miss: 'сторона встречная', any: 'сторона не критична', weak: 'сторона неопределима' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function agent() { return window.CASE_GEO_AGENT || null; }
  function site() { var A = agent(); if (A && A.state && A.state.site) return { lat: +A.state.site.lat, lng: +A.state.site.lon, name: A.state.site.name }; try { var p = window.caseGeoPoint ? window.caseGeoPoint() : null; return (p && !p.pending && isFinite(+p.lat) && isFinite(+p.lng)) ? { lat: +p.lat, lng: +p.lng, name: p.name } : null; } catch (e) { return null; } }
  function toast(msg) { var t = $('geoToast'); if (t) { t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); } }
  function typeOf(id) { return TYPES.filter(function (t) { return t.id === id; })[0] || TYPES[0]; }

  /* --- геометрия в местных метрах ------------------------------------------------------------ */
  function local(lat0) { var kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111320; return function (p) { return [(p[1]) * kx, (p[0]) * ky]; }; }
  function nearest(roads, s) {
    var P = local(s.lat), S = P([s.lat, s.lng]), best = null;
    (roads || []).forEach(function (w) {
      var line = w.line || []; if (line.length < 2) return;
      var drivable = DRIVE.test(String(w.cls || ''));
      for (var i = 1; i < line.length; i++) {
        var A = P(line[i - 1]), B = P(line[i]), vx = B[0] - A[0], vy = B[1] - A[1], len2 = vx * vx + vy * vy; if (!len2) continue;
        var u = ((S[0] - A[0]) * vx + (S[1] - A[1]) * vy) / len2; u = Math.max(0, Math.min(1, u));
        var px = A[0] + u * vx, py = A[1] + u * vy, d = Math.sqrt((S[0] - px) * (S[0] - px) + (S[1] - py) * (S[1] - py));
        /* проезжие дороги предпочтительнее: служебный проезд в 5 м не должен заслонять улицу в 30 м */
        var score = d + (drivable ? 0 : 60);
        if (!best || score < best.score) best = { score: score, d: d, w: w, a: line[i - 1], b: line[i], A: A, B: B, foot: [px, py], S: S, drivable: drivable };
      }
    });
    return best;
  }
  /* Анализ по ближайшему отрезку. Возвращает объект с полями side ('in'|'out'), weak, angle и т.д. */
  function analyzeGeom(best, s) {
    var P = local(s.lat), C = P(CENTER), mid = [(best.A[0] + best.B[0]) / 2, (best.A[1] + best.B[1]) / 2];
    var dx = best.B[0] - best.A[0], dy = best.B[1] - best.A[1], len = Math.sqrt(dx * dx + dy * dy) || 1; dx /= len; dy /= len;
    var cx = C[0] - mid[0], cy = C[1] - mid[1], clen = Math.sqrt(cx * cx + cy * cy) || 1; cx /= clen; cy /= clen;
    var cos = dx * cx + dy * cy;                     /* > 0: направление отрезка ведёт к центру */
    var inDir = cos >= 0 ? [dx, dy] : [-dx, -dy];    /* поток «в центр» вдоль дороги */
    var sx = best.S[0] - mid[0], sy = best.S[1] - mid[1];
    var crossIn = inDir[0] * sy - inDir[1] * sx;      /* < 0: точка справа от потока «в центр» */
    var oneway = !!best.w.oneway, side, flowDir;
    if (oneway) { flowDir = [dx, dy]; side = cos >= 0 ? 'in' : 'out'; }
    else { side = crossIn < 0 ? 'in' : 'out'; flowDir = side === 'in' ? inDir : [-inDir[0], -inDir[1]]; }
    var distCenter = clen, tangential = Math.abs(cos) < 0.25, nearCenter = distCenter < NEAR_CENTER_M;
    return { side: side, oneway: oneway, cos: cos, angleDeg: Math.round(Math.acos(Math.abs(cos)) * 180 / Math.PI), tangential: tangential, nearCenter: nearCenter, weak: tangential || nearCenter, inDir: inDir, flowDir: flowDir, mid: mid, distCenterM: Math.round(distCenter), distRoadM: Math.round(best.d), siteRightOfFlow: oneway ? ((dx * sy - dy * sx) < 0) : true };
  }
  function verdictFor(type, g) {
    if (!g) return { code: 'weak', text: VERDICT.weak };
    if (type.pref === 'any') return { code: 'any', text: VERDICT.any };
    if (g.weak) return { code: 'weak', text: VERDICT.weak };
    return g.side === type.pref ? { code: 'match', text: VERDICT.match } : { code: 'miss', text: VERDICT.miss };
  }
  function sideRu(side) { return side === 'in' ? 'сторона «в центр»' : 'сторона «из центра»'; }

  /* --- дороги от агента ------------------------------------------------------------------------- */
  function roadsNear(s) {
    var A = agent(); if (!A) return Promise.reject(new Error('Гео-агент не загружен'));
    var have = A.state && A.state.data && Array.isArray(A.state.data.roads) ? A.state.data.roads : null;
    var lm = A.lineNearM;
    if (have && have.length && typeof lm === 'function' && have.some(function (w) { return lm(w.line, s.lat, s.lng) <= SEARCH_M; })) return Promise.resolve(have);
    return A.run('load_roads', { radius_m: SEARCH_M }).then(function () { return (A.state.data.roads || []); });
  }

  /* --- карта ------------------------------------------------------------------------------------ */
  function unlocal(lat0, p) { var kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 111320; return [p[1] / ky, p[0] / kx]; }
  function arrowIcon(dir, label, color) {
    var ang = Math.round(Math.atan2(dir[0], dir[1]) * 180 / Math.PI); /* от севера по часовой */
    return L.divIcon({ className: '', html: '<div class="rs-arrow" style="color:' + color + '"><span style="display:inline-block;transform:rotate(' + ang + 'deg)">➜</span><i>' + esc(label) + '</i></div>', iconSize: [1, 1], iconAnchor: [0, 0] });
  }
  function draw(res) {
    var M = theMap(); if (!M || !window.L) return;
    if (!gRoad) gRoad = L.layerGroup().addTo(M); gRoad.clearLayers();
    if (!res || !res.best) return;
    var b = res.best, g = res.geom, s = res.site;
    L.polyline([b.a, b.b], { color: '#1b1b1b', weight: 7, opacity: .35 }).addTo(gRoad);
    L.polyline([b.a, b.b], { color: g.side === 'in' ? '#1b4f8a' : '#c0392b', weight: 3, opacity: .95 }).addTo(gRoad).bindTooltip('<b>' + esc(b.w.name || 'без названия') + '</b><br>' + esc(CLS_RU[b.w.cls] || b.w.cls || '') + (g.oneway ? ' · одностороннее' : ''));
    var foot = unlocal(s.lat, b.foot); L.polyline([[s.lat, s.lng], foot], { color: '#9E0000', weight: 1.5, dashArray: '4 4' }).addTo(gRoad).bindTooltip(g.distRoadM + ' м до дороги');
    /* стрелки потоков: со смещением 12 м вправо от каждого потока (правостороннее движение) */
    var off = 12, inD = g.inDir, outD = [-inD[0], -inD[1]];
    var rIn = [inD[1], -inD[0]], rOut = [outD[1], -outD[0]];
    var pIn = [g.mid[0] + rIn[0] * off, g.mid[1] + rIn[1] * off], pOut = [g.mid[0] + rOut[0] * off, g.mid[1] + rOut[1] * off];
    if (!g.oneway || g.cos >= 0) L.marker(unlocal(s.lat, pIn), { icon: arrowIcon(inD, 'в центр', '#1b4f8a'), interactive: false }).addTo(gRoad);
    if (!g.oneway || g.cos < 0) L.marker(unlocal(s.lat, pOut), { icon: arrowIcon(outD, 'из центра', '#c0392b'), interactive: false }).addTo(gRoad);
    L.marker([s.lat, s.lng], { icon: L.divIcon({ className: '', html: '<div class="rs-lbl rs-' + res.verdict.code + '">' + esc(sideRu(g.side)) + ' · ' + esc(res.verdict.text) + '</div>', iconAnchor: [-14, 30] }), interactive: false }).addTo(gRoad);
  }
  R.clear = function () { if (gRoad) gRoad.clearLayers(); R.last = null; var o = $('rsOut'); if (o) o.innerHTML = ''; };

  /* --- анализ ------------------------------------------------------------------------------------ */
  function analyze(typeId, silent) {
    var s = site(); if (!s) { if (!silent) toast('Сначала поставьте точку анализа (пин на панели инструментов или правый клик)'); return Promise.resolve(null); }
    var type = typeOf(typeId || ($('rsType') && $('rsType').value)); if (busy) return Promise.resolve(R.last);
    busy = true; var out = $('rsOut'); if (out) out.innerHTML = '<span class="rs-wait">ищу ближайшую дорогу…</span>';
    return roadsNear(s).then(function (roads) {
      var best = nearest(roads, s);
      var res = { site: s, type: type, roads: roads.length, best: best, geom: best ? analyzeGeom(best, s) : null };
      res.verdict = verdictFor(type, res.geom);
      R.last = res; draw(res); render(res);
      var A = agent(); if (A && typeof A.say === 'function') { try { A.say('fact', factHtml(res)); } catch (e) {} }
      return res;
    }, function (e) { if (out) out.innerHTML = '<span class="rs-err">' + esc(String(e && e.message || e)) + '</span>'; return null; }).then(function (r) { busy = false; return r; });
  }
  R.analyze = analyze; R.TYPES = TYPES; R.nearest = nearest; R.analyzeGeom = analyzeGeom; R.verdictFor = verdictFor;

  function factHtml(res) {
    var g = res.geom, t = res.type;
    if (!g) return '<b>Сторона дороги</b>: в ' + SEARCH_M + ' м от точки проезжих дорог не найдено (' + res.roads + ' участков в выборке).';
    return '<b>Сторона дороги</b> для «' + esc(t.label) + '»: <span class="ga-num">' + esc(sideRu(g.side)) + '</span>, ' + esc(res.verdict.text) + '. ' + esc(res.best.w.name || 'дорога без названия') + ' (' + esc(CLS_RU[res.best.w.cls] || res.best.w.cls || '') + (g.oneway ? ', одностороннее' : '') + '), ' + g.distRoadM + ' м от точки, угол к направлению на центр ' + g.angleDeg + '°' + (g.weak ? '; вывод слабый: ' + (g.nearCenter ? 'точка в самом центре' : 'дорога идёт поперёк направления на центр') : '') + '.';
  }
  function render(res) {
    var out = $('rsOut'); if (!out) return;
    var g = res.geom, t = res.type;
    if (!g) { out.innerHTML = '<div class="rs-err">В ' + SEARCH_M + ' м проезжих дорог не найдено. Передвиньте точку ближе к улице или проверьте связь с OpenStreetMap.</div>'; return; }
    var h = '<div class="rs-verdict rs-' + res.verdict.code + '"><b>' + esc(sideRu(g.side)) + '</b> · ' + esc(res.verdict.text) + '</div>';
    h += '<div class="rs-road">' + esc(res.best.w.name || 'дорога без названия') + ' · ' + esc(CLS_RU[res.best.w.cls] || res.best.w.cls || '') + (g.oneway ? ' · одностороннее' : ' · двустороннее') + ' · ' + g.distRoadM + ' м от точки' + (res.best.drivable ? '' : ' · <span class="rs-warn">не проезжая</span>') + '</div>';
    h += '<div class="rs-why">' + esc(t.why) + '.</div>';
    if (res.verdict.code === 'miss') h += '<div class="rs-tip">Точка стоит со стороны встречного потока: заезд потребует разворота. Проверьте разворот или светофор в 300 м и рассмотрите вход с параллельной улицы.</div>';
    if (res.verdict.code === 'weak') h += '<div class="rs-tip">' + (g.nearCenter ? 'Точка в ' + g.distCenterM + ' м от центра: потоки «в центр» и «из центра» здесь равнозначны.' : 'Дорога идёт под углом ' + g.angleDeg + '° к направлению на центр (кольцевая или поперечная): сторона потока к центру не определяет спрос.') + '</div>';
    h += '<div class="rs-extra"><span>Что ещё важно для этого типа:</span><ul>' + t.extra.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="mini">Правостороннее движение; направление «в центр» к деловому центру Ташкента (Амир Темур / Ташкент-Сити). Дороги: OpenStreetMap, © OpenStreetMap contributors. Это ориентир, не замер трафика.</div>';
    out.innerHTML = h;
  }

  /* --- раздел в левой панели ------------------------------------------------------------------- */
  function css() {
    if ($('geoRsCss')) return;
    var s = document.createElement('style'); s.id = 'geoRsCss'; s.textContent =
      '#rsSect .sbody{padding:6px 12px 12px}#rsType{width:100%;font-size:12px;padding:6px 8px;border-radius:8px;border:1px solid var(--line,#e3dcd1);background:#fff}'
      + '.rs-row{display:flex;gap:6px;margin:6px 0;align-items:center}.rs-row .btn{font-size:11px}'
      + '.rs-verdict{font-size:12.5px;padding:6px 9px;border-radius:8px;margin:4px 0}.rs-match{background:#e3f3e8;color:#14532d}.rs-miss{background:#fbeaea;color:#7a0000}.rs-any{background:#f1ede6;color:#3d3a35}.rs-weak{background:#fff4d6;color:#6b4e00}'
      + '.rs-road{font-size:11px;color:var(--ink,#1b1b1b);margin:2px 0}.rs-why{font-size:11px;color:var(--muted,#6f6a63);margin:4px 0}.rs-tip{font-size:11px;background:#faf7f2;border-left:3px solid #9E0000;padding:5px 8px;border-radius:0 6px 6px 0;margin:6px 0}'
      + '.rs-extra{font-size:11px;margin:6px 0}.rs-extra span{color:var(--muted,#6f6a63)}.rs-extra ul{margin:3px 0 0;padding-left:16px}.rs-wait,.rs-err{font-size:11px;color:var(--muted,#6f6a63)}.rs-err{color:#9E0000}.rs-warn{color:#9b6b00}'
      + '.rs-arrow{white-space:nowrap;font:800 18px/1 inherit;text-shadow:0 0 3px #fff,0 0 3px #fff}.rs-arrow i{font:700 10px/1 inherit;font-style:normal;margin-left:2px;background:#fff;border-radius:4px;padding:1px 4px;vertical-align:middle}'
      + '.rs-inline{margin-top:8px;border-top:1px dashed var(--line,#e3e6ec);padding-top:6px}.rs-h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--red,#9E0000);margin-bottom:4px}'
      + '.rs-lbl{white-space:nowrap;font:700 11px/1.3 inherit;background:#fff;border:1px solid #1b1b1b;border-radius:6px;padding:2px 6px;box-shadow:0 1px 4px rgba(0,0,0,.25)}.rs-lbl.rs-match{border-color:#14532d;color:#14532d}.rs-lbl.rs-miss{border-color:#7a0000;color:#7a0000}.rs-lbl.rs-weak{border-color:#6b4e00;color:#6b4e00}';
    document.head.appendChild(s);
  }
  /* v4.79.0 (замечание владельца): отдельного раздела «Сторона дороги» нет, блок живёт внутри
     «Точки анализа» рядом с «Что рядом» */
  function pointHost() {
    var info = $('projInfo'); if (info && info.parentNode) return info.parentNode;
    var hs = document.querySelectorAll('.left>.sect>h3');
    for (var i = 0; i < hs.length; i++) if (/точка анализа/i.test(hs[i].textContent)) return hs[i].parentNode;
    return null;
  }
  function mount() {
    if ($('rsSect')) return true;
    var host = pointHost(); if (!host) return false;
    var saved = ''; try { saved = localStorage.getItem(KEY_TYPE) || ''; } catch (e) {}
    var sect = document.createElement('div'); sect.className = 'rs-inline'; sect.id = 'rsSect';
    sect.innerHTML = '<div class="rs-h" id="rsH">Сторона дороги</div>'
      + '<select id="rsType" aria-label="Тип проекта">' + TYPES.map(function (t) { return '<option value="' + t.id + '"' + (t.id === saved ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('') + '</select>'
      + '<div class="rs-row"><button type="button" class="btn pri" id="rsGo" title="ближайшая дорога, направление потока к центру и сторона точки">▶ Определить сторону</button><button type="button" class="btn sec" id="rsClear" title="убрать стрелки с карты">✕</button></div>'
      + '<div id="rsOut"></div>';
    var amen = $('amen');
    if (amen && amen.parentNode === host) host.insertBefore(sect, amen.nextSibling); else host.appendChild(sect);
    $('rsGo').onclick = function () { analyze($('rsType').value); };
    $('rsClear').onclick = R.clear;
    $('rsType').onchange = function () { try { localStorage.setItem(KEY_TYPE, $('rsType').value); } catch (e) {} if (R.last) { var res = R.last; res.type = typeOf($('rsType').value); res.verdict = verdictFor(res.type, res.geom); draw(res); render(res); } };
    return true;
  }
  /* фразы агенту: «сторона дороги», «с какой стороны дороги», «road side», «yo'l tomoni» */
  function hookAgent() {
    var A = agent(); if (!A || typeof A.ask !== 'function' || A.ask._rs) return;
    var orig = A.ask;
    var w = function (text) {
      var t = String(text || '').toLowerCase();
      if (/сторон[аыуе]\s+дорог|какой\s+сторон|road\s*side|which\s+side|yo'?l(ning)?\s+tomon/.test(t)) {
        try { A.say('you', esc(String(text))); } catch (e) {}
        var id = null; TYPES.forEach(function (tp) { if (!id && new RegExp(tp.label.split(',')[0].toLowerCase().slice(0, 6)).test(t)) id = tp.id; });
        if (/офис|бизнес|office|ofis/.test(t)) id = 'office'; else if (/аптек|pharm|dorixona/.test(t)) id = 'pharmacy'; else if (/супермарк|магаз|продукт|ритейл|retail|do'?kon/.test(t)) id = 'retail'; else if (/клиник|медиц|clinic|klinika/.test(t)) id = 'clinic'; else if (/школ|сад|образов|school|maktab/.test(t)) id = 'education'; else if (/кофе|coffee|kofe/.test(t)) id = 'coffee'; else if (/ресторан|restaurant|restoran/.test(t)) id = 'fnb'; else if (/азс|заправ|fuel|yoqilg/.test(t)) id = 'fuel'; else if (/склад|логист|warehouse|ombor/.test(t)) id = 'warehouse'; else if (/гостин|отел|hotel|mehmonxona/.test(t)) id = 'hotel'; else if (/жиль|residential|uy-joy|turar/.test(t)) id = 'residential';
        if (id && $('rsType')) $('rsType').value = id;
        return analyze(id || ($('rsType') && $('rsType').value)).then(function (res) { if (res) try { A.say('ai', res.geom ? 'Точка стоит на ' + esc(sideRu(res.geom.side)) + ' (' + esc(res.best.w.name || 'дорога без названия') + '). Для «' + esc(res.type.label) + '» это ' + esc(res.verdict.text) + '.' : 'Рядом с точкой проезжих дорог не нашёл.'); } catch (e) {} });
      }
      return orig.apply(this, arguments);
    };
    w._rs = true; A.ask = w;
  }
  function install() {
    css();
    var tries = 0;
    (function tick() {
      var ok = mount(); hookAgent();
      if (ok && agent()) return;
      if (++tries < 80) setTimeout(tick, 250);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4770-geo-roadside'] = '4.79.0';
