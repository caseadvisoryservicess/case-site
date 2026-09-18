/* CASE OS v4.77.0: профили пользователей в студии и блок «Что рядом».
 *
 * Решение владельца: у разных клиентов разные задачи, и у каждого своя панель.
 *   - «Ищу офис»: свободный ограниченный доступ; нужны бизнес-центры, ставки, сравнение и
 *     удобства рядом с точкой: парковка, метро, остановки, кафе, банки, спорт, аптеки;
 *   - «Девелопер»: где и что строить: модель зон пригодности, демография, сторона дороги,
 *     зоны охвата;
 *   - «Управление активами»: свой объект, его окружение и конкуренты, ставки, зоны охвата;
 *   - внутренние: «Консалтинг CASE», «Лизинг и продажи», «Всё» (полный набор).
 *
 * Профиль берётся из прав учётной записи (личный кабинет, поле «Профиль панелей»), его можно
 * временно сменить переключателем на вкладках студии (запоминается в этом браузере). Профиль
 * только прячет лишние разделы левой панели, права доступа он не меняет: они в v4760-geo-caps.js.
 *
 * Блок «Что рядом» в «Точке анализа»: удобства в 300 / 500 / 800 м по слоям студии (метро,
 * остановки, парковки, еда, банки, спорт, супермаркеты, аптеки, клиники, образование, парки,
 * бизнес-центры). Числа только по загруженным слоям: пустой слой показан как «слой не загружен».
 * Длинных тире в тексте нет намеренно.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_PROFILES) return;
  var VERSION = '4.77.0', KEY = 'caseos_geo_profile', KEY_R = 'caseos_amen_r';
  var P = window.CASE_GEO_PROFILES = { version: VERSION, current: null };
  var PROFILES = {
    office: { label: 'Ищу офис', hide: ['analysis', 'road', 'mah', 'catch'], hint: 'бизнес-центры, ставки, сравнение и удобства рядом с точкой' },
    developer: { label: 'Девелопер', hide: [], hint: 'где и что строить: зоны пригодности, демография, сторона дороги, зоны охвата' },
    asset: { label: 'Управление активами', hide: ['analysis', 'road'], hint: 'свой объект, окружение, конкуренты, ставки и зоны охвата' },
    consulting: { label: 'Консалтинг CASE', hide: [], hint: 'полный набор инструментов' },
    leasing: { label: 'Лизинг и продажи', hide: ['analysis', 'mah', 'road'], hint: 'бизнес-центры, ставки, список и сравнение, зоны охвата' },
    full: { label: 'Всё', hide: [], hint: 'все разделы студии' }
  };
  var SECT = [[/точка анализа/i, 'point'], [/анализ локации/i, 'analysis'], [/сторона дороги/i, 'road'], [/зона охвата/i, 'rings'], [/слои и стиль/i, 'layers'], [/итог по catchment/i, 'catch'], [/бизнес-центры/i, 'bc'], [/махалли/i, 'mah']];
  var RADII_M = [300, 500, 800];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function havKm(a, b, c, d) { try { return hav(a, b, c, d); } catch (e) { var R = 6371, r = function (x) { return x * Math.PI / 180; }; var s = Math.pow(Math.sin(r(c - a) / 2), 2) + Math.cos(r(a)) * Math.cos(r(c)) * Math.pow(Math.sin(r(d - b) / 2), 2); return R * 2 * Math.asin(Math.sqrt(s)); } }
  function point() { try { var p = window.caseGeoPoint ? window.caseGeoPoint() : null; return (p && !p.pending && isFinite(+p.lat) && isFinite(+p.lng)) ? { lat: +p.lat, lng: +p.lng } : null; } catch (e) { return null; } }
  function caps() { try { if (window.CASE_GEO_CAPS && window.CASE_GEO_CAPS.caps) return window.CASE_GEO_CAPS.caps; } catch (e) {} try { if (window.parent && window.parent !== window && window.parent.CASE_USER_CAPS) return window.parent.CASE_USER_CAPS; } catch (e) {} return null; }
  function valid(p) { return !!(p && PROFILES[p]); }

  /* --- профиль ------------------------------------------------------------------------------- */
  function stored() { var s = ''; try { s = localStorage.getItem(KEY) || ''; } catch (e) {} return valid(s) ? s : ''; }
  function fromCaps() {
    var c = caps(); if (!c) return '';
    if (valid(c.profile)) return c.profile;
    if (c.demo || document.body.classList.contains('geo-demo')) return 'office';
    return 'full';
  }
  /* Права студии (v4760-geo-caps.js) читаются позже этого модуля: без сохранённого выбора ждём их до 8 с,
     иначе демо-доступ стартовал бы с полного набора панелей */
  function initial(cb) {
    var s = stored(); if (s) { cb(s, false); return; }
    var tries = 0;
    (function tick() {
      var p = fromCaps();
      if (p) { cb(p, true); return; }
      if (++tries < 32) setTimeout(tick, 250); else cb(document.body.classList.contains('geo-demo') ? 'office' : 'full', true);
    })();
  }
  function set(p, fromAccount) {
    if (!valid(p)) p = 'full';
    P.current = p;
    Object.keys(PROFILES).forEach(function (k) { document.body.classList.remove('prof-' + k); });
    document.body.classList.add('prof-' + p);
    var sel = $('geoProfile'); if (sel && sel.value !== p) sel.value = p;
    if (sel) sel.title = 'Профиль «' + PROFILES[p].label + '»: ' + PROFILES[p].hint;
    try { if (fromAccount) localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('caseos:profile', { detail: { profile: p } })); } catch (e) {}
    return p;
  }
  P.set = set; P.list = function () { return Object.keys(PROFILES).map(function (k) { return { id: k, label: PROFILES[k].label, hide: PROFILES[k].hide.slice() }; }); }; P.PROFILES = PROFILES;

  function tagSections() {
    var hs = document.querySelectorAll('.left>.sect>h3'), n = 0;
    for (var i = 0; i < hs.length; i++) { var s = hs[i].parentNode; if (s.dataset.sect) { n++; continue; } for (var k = 0; k < SECT.length; k++) if (SECT[k][0].test(hs[i].textContent)) { s.dataset.sect = SECT[k][1]; n++; break; } }
    return n;
  }
  function css() {
    if ($('geoProfCss')) return;
    var rules = '';
    Object.keys(PROFILES).forEach(function (k) { PROFILES[k].hide.forEach(function (sid) { rules += 'body.prof-' + k + ' .left>.sect[data-sect="' + sid + '"]{display:none!important}'; }); });
    var s = document.createElement('style'); s.id = 'geoProfCss'; s.textContent = rules
      + '#geoProfile{margin-left:auto;align-self:center;font:600 11px inherit;padding:4px 8px;border-radius:8px;border:1px solid var(--line,#e3dcd1);background:#fff;color:var(--ink,#1b1b1b);max-width:190px}'
      + '.tabs{align-items:center}'
      + '.amen{margin-top:8px;border-top:1px dashed var(--line,#e3dcd1);padding-top:6px}.amen-h{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--red-d,#7a0000)}.amen-h .sp{flex:1}'
      + '.amen-r{display:flex;gap:2px}.amen-r button{border:1px solid var(--line,#e3dcd1);background:#fff;border-radius:999px;padding:1px 7px;font:600 10px inherit;cursor:pointer;color:var(--ink,#1b1b1b)}.amen-r button.on{background:#9E0000;border-color:#9E0000;color:#fff}'
      + '.amen-g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-top:6px}.amen-i{display:flex;align-items:center;gap:6px;font-size:11px;background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:8px;padding:4px 7px;min-width:0}.amen-i .ic{width:18px;text-align:center;font-weight:800;color:#9E0000;flex:none}.amen-i b{font-variant-numeric:tabular-nums}.amen-i small{color:var(--muted,#6f6a63);font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.amen-i.off{opacity:.55}'
      + '.amen-note{font-size:10px;color:var(--muted,#6f6a63);margin-top:4px}body.prof-office .amen{order:-1}';
    document.head.appendChild(s);
  }
  function mountSelect() {
    if ($('geoProfile')) return true;
    var tabs = document.querySelector('.tabs'); if (!tabs) return false;
    var sel = document.createElement('select'); sel.id = 'geoProfile'; sel.setAttribute('aria-label', 'Профиль панелей');
    sel.innerHTML = Object.keys(PROFILES).map(function (k) { return '<option value="' + k + '">' + esc(PROFILES[k].label) + '</option>'; }).join('');
    sel.onchange = function () { set(sel.value, false); };
    tabs.appendChild(sel);
    return true;
  }

  /* --- «Что рядом» ---------------------------------------------------------------------------- */
  function radius() { var r = 500; try { r = +localStorage.getItem(KEY_R) || 500; } catch (e) {} return RADII_M.indexOf(r) >= 0 ? r : 500; }
  function metroNear(p, km) {
    var out = [], best = null;
    try {
      var lines = (typeof METRO !== 'undefined' && Array.isArray(METRO)) ? METRO : [];
      lines.forEach(function (l) { (l.s || l.stations || []).forEach(function (st) {
        var name, la, ln;
        /* станции студии: [lat, lng, 'название']; допускается и ['название', lat, lng] */
        if (Array.isArray(st)) { if (typeof st[0] === 'number' && typeof st[1] === 'number') { la = st[0]; ln = st[1]; name = st[2]; } else { name = st[0]; la = +st[1]; ln = +st[2]; } }
        else if (st && typeof st === 'object') { name = st.n || st.name || st.title; la = +(st.la != null ? st.la : st.lat); ln = +(st.ln != null ? st.ln : st.lng); }
        if (!isFinite(la) || !isFinite(ln)) return;
        var d = havKm(p.lat, p.lng, la, ln); if (d <= km) out.push({ name: name, d: d, line: l.n || l.name || '' }); if (!best || d < best.d) best = { name: name, d: d, line: l.n || l.name || '' };
      }); });
    } catch (e) {}
    return { within: out, nearest: best };
  }
  function countPairs(arr, p, km, la, ln) { var n = 0; (arr || []).forEach(function (x) { var a = la(x), b = ln(x); if (isFinite(a) && isFinite(b) && havKm(p.lat, p.lng, a, b) <= km) n++; }); return n; }
  function amenities(p, rM) {
    var km = rM / 1000, POI = window.CASE_GEO_POI, has = function (k) { return !!(POI && POI.total(k) > 0); }, cnt = function (keys) { return POI ? POI.countIn(keys, p.lat, p.lng, km) : 0; };
    var metro = metroNear(p, km), bc = 0, ph = 0, med = 0;
    try { bc = (typeof BC !== 'undefined' ? BC : []).filter(function (b) { var e = typeof eff === 'function' ? eff(b) : b; return e.lat != null && e.lng != null && (!window.CASE_GEO_BC || window.CASE_GEO_BC.pass(e, b)) && havKm(p.lat, p.lng, +e.lat, +e.lng) <= km; }).length; } catch (e) {}
    try { ph = countPairs(typeof PHARM !== 'undefined' ? PHARM : [], p, km, function (x) { return Array.isArray(x) ? +x[0] : +(x.lat != null ? x.lat : x.la); }, function (x) { return Array.isArray(x) ? +x[1] : +(x.lng != null ? x.lng : x.ln); }); } catch (e) {}
    try { med = countPairs(typeof MEDPTS !== 'undefined' ? MEDPTS : [], p, km, function (x) { return +x.la; }, function (x) { return +x.ln; }); } catch (e) {}
    var items = [
      { k: 'metro', ic: 'M', label: 'Метро', n: metro.within.length, sub: metro.nearest ? (metro.nearest.name ? metro.nearest.name + ' · ' : '') + Math.round(metro.nearest.d * 1000) + ' м' : 'нет данных о станциях', ok: !!metro.nearest },
      { k: 'transport_hubs', ic: 'T', label: 'Остановки и узлы', n: cnt(['transport_hubs']), ok: has('transport_hubs') },
      { k: 'parking', ic: 'P', label: 'Парковки', n: cnt(['parking']), ok: has('parking') },
      { k: 'food', ic: '☕', label: 'Кафе и рестораны', n: cnt(['cafes', 'restaurants', 'fast_food']), ok: has('cafes') || has('restaurants') || has('fast_food') },
      { k: 'finance', ic: '₿', label: 'Банки и банкоматы', n: cnt(['finance']), ok: has('finance') },
      { k: 'supermarkets', ic: 'S', label: 'Супермаркеты', n: cnt(['supermarkets', 'markets']), ok: has('supermarkets') || has('markets') },
      { k: 'sports', ic: '◎', label: 'Спорт и фитнес', n: cnt(['sports']), ok: has('sports') },
      { k: 'pharm', ic: '+', label: 'Аптеки', n: ph, ok: (function () { try { return (typeof PHARM !== 'undefined' && PHARM.length > 0); } catch (e) { return false; } })() },
      { k: 'med', ic: '✚', label: 'Клиники', n: med, ok: (function () { try { return (typeof MEDPTS !== 'undefined' && MEDPTS.length > 0); } catch (e) { return false; } })() },
      { k: 'education', ic: 'E', label: 'Образование', n: cnt(['education']), ok: has('education') },
      { k: 'parks', ic: '♣', label: 'Парки и площадки', n: cnt(['parks', 'playgrounds']), ok: has('parks') || has('playgrounds') },
      { k: 'bc', ic: 'B', label: 'Бизнес-центры', n: bc, ok: (function () { try { return (typeof BC !== 'undefined' && BC.length > 0); } catch (e) { return false; } })() }
    ];
    return items;
  }
  P.amenities = amenities;
  function renderAmen() {
    var box = $('amen'); if (!box) return;
    var p = point(), r = radius();
    var head = '<div class="amen-h"><span>Что рядом</span><span class="sp"></span><div class="amen-r">' + RADII_M.map(function (m) { return '<button type="button" data-r="' + m + '"' + (m === r ? ' class="on"' : '') + '>' + m + ' м</button>'; }).join('') + '</div></div>';
    if (!p) { box.innerHTML = head + '<div class="amen-note">Поставьте точку анализа: пин на панели инструментов или правый клик по карте.</div>'; bindR(box); return; }
    var items = amenities(p, r);
    box.innerHTML = head + '<div class="amen-g">' + items.map(function (it) { return '<div class="amen-i' + (it.ok ? '' : ' off') + '" data-k="' + it.k + '" title="' + esc(it.label) + '"><span class="ic">' + it.ic + '</span><span style="min-width:0"><b>' + (it.ok ? it.n : '·') + '</b> ' + esc(it.label) + (it.sub ? '<br><small>' + esc(it.sub) + '</small>' : (it.ok ? '' : '<br><small>слой не загружен</small>')) + '</span></div>'; }).join('') + '</div>'
      + '<div class="amen-note">Считается по загруженным слоям студии в радиусе ' + r + ' м от точки. Включите слои в «Слои и стиль», чтобы увидеть объекты на карте.</div>';
    bindR(box);
  }
  function bindR(box) { box.querySelectorAll('.amen-r button').forEach(function (b) { b.onclick = function () { try { localStorage.setItem(KEY_R, b.dataset.r); } catch (e) {} renderAmen(); }; }); }
  function mountAmen() {
    if ($('amen')) return true;
    var info = $('projInfo'); if (!info || !info.parentNode) return false;
    var d = document.createElement('div'); d.id = 'amen'; d.className = 'amen';
    info.parentNode.insertBefore(d, info.nextSibling);
    renderAmen();
    return true;
  }
  P.renderAmenities = renderAmen;

  /* --- установка ------------------------------------------------------------------------------ */
  function hooks() {
    var rp = window.renderProj; if (typeof rp === 'function' && !rp._prof) { var w = function () { var r = rp.apply(this, arguments); try { renderAmen(); } catch (e) {} return r; }; w._prof = true; window.renderProj = w; }
  }
  function install() {
    css();
    var tries = 0;
    (function tick() {
      var ok = mountSelect() && mountAmen() && tagSections() >= 5;
      if (ok) { hooks(); initial(function (p, fromAccount) { set(p, fromAccount); }); var n = 0; var iv = setInterval(function () { try { tagSections(); renderAmen(); } catch (e) {} if (++n >= 20) clearInterval(iv); }, 4000); return; }
      if (++tries < 100) setTimeout(tick, 250);
    })();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4770-geo-profiles'] = '4.77.0';
