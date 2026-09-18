/* CASE OS v4.75.0: компоновка студии геоаналитики по замечаниям владельца.
 *
 *   - гео-агент живёт в отдельной выдвижной панели справа от карты с одной кнопкой
 *     «открыть / закрыть» (раньше был секцией в левой колонке);
 *   - легенда обозначений (цвет БЦ, точка анализа, отредактированные записи) переехала из
 *     левой панели в плашку «На экране» в левом нижнем углу карты;
 *   - у надписи Leaflet в правом нижнем углу убран флаг: остаётся ссылка на библиотеку
 *     и атрибуция источника карты;
 *   - «Зона охвата»: радиусы задаются свои (список через запятую, до восьми), а не только
 *     1 · 3 · 5 км; выбор помнится; цвет самого большого круга по-прежнему из палитры;
 *   - клик по карте больше не открывает отчёт по точке: отчёт открывают кнопка
 *     «Аналитика по точке» и карточки объектов (разметка флажка убрана из HTML, этот
 *     модуль подстраховывает старую разметку).
 */
(function () {
  'use strict';
  if (window.CASE_GEO_LAYOUT) return;
  var VERSION = '4.76.0', KEY_DRAWER = 'caseos_ga_drawer', KEY_RINGS = 'caseos_rings_v2', KEY_RINGS_OLD = 'caseos_rings_v1', KEY_LEFT = 'caseos_left_panel';
  var LY = window.CASE_GEO_LAYOUT = { version: VERSION };
  function $(id) { return document.getElementById(id); }
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function css() {
    if ($('geoLayoutCss')) return;
    var s = document.createElement('style'); s.id = 'geoLayoutCss'; s.textContent =
      '#mapT{position:relative}'
      + '.ga-drawer{position:absolute;top:0;right:0;bottom:0;width:min(400px,92vw);background:#fff;border-left:1px solid var(--line,#e3dcd1);box-shadow:-8px 0 30px rgba(20,20,20,.14);z-index:1010;display:flex;flex-direction:column;transform:translateX(102%);visibility:hidden;transition:transform .2s,visibility 0s .2s}'
      + '.ga-drawer.open{transform:none;visibility:visible;transition:transform .2s}'
      + '.ga-drawer-head{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#1b1b1b;color:#fff;font:800 12px/1 inherit;letter-spacing:.08em;text-transform:uppercase}'
      + '.ga-drawer-head .ga-badge{margin-left:2px}.ga-drawer-head .sp{flex:1}'
      + '.ga-drawer-x{width:30px;height:30px;border:1px solid rgba(255,255,255,.25);border-radius:8px;background:none;color:#fff;font:700 14px inherit;cursor:pointer}.ga-drawer-x:hover{background:rgba(255,255,255,.12)}'
      + '.ga-drawer>#gaPanel{flex:1;min-height:0;overflow:auto;border:0;border-radius:0;margin:0;padding:10px 12px 14px}'
      + '.ga-drawer>#gaPanel>h3{display:none}.ga-drawer>#gaPanel>.sbody{display:block!important}'
      + '.ga-toggle{position:absolute;right:10px;top:54px;z-index:1006;display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;border:1px solid var(--line,#e3dcd1);border-radius:9px;background:#9E0000;color:#fff;font:700 12px inherit;cursor:pointer;box-shadow:0 1px 2px rgba(40,30,20,.06),0 8px 24px rgba(40,30,20,.14);white-space:nowrap}'
      + '.ga-toggle:hover{background:#6e0000}.ga-toggle.on{display:none}'
      + '.ga-toggle .ga-toggle-ic{font-size:14px}'
      + '.ga-static-legend{margin-top:6px}.ga-static-legend .li{cursor:default}.ga-static-legend .li:hover{background:none}'
      + '.ga-static-legend .dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:0 0 auto}'
      + '#rings label.ck{display:inline-flex;align-items:center;gap:4px;margin:2px 10px 2px 0}#rings input[type=color]{width:18px;height:18px;padding:0;border:1px solid var(--line,#e3dcd1);border-radius:5px;background:none;cursor:pointer}'
      /* v4.76.0: у каждого кольца свой цвет, общий выбор цвета у толщины линий больше не нужен */
      + '#ringWc{display:none}'
      /* v4.76.0: левая панель сворачивается целиком; язычок у левого края карты */
      + '#mapT.left-off>.left{display:none}'
      + '.left-tab{position:absolute;left:0;top:50%;transform:translateY(-50%);z-index:1006;width:22px;height:64px;border:1px solid var(--line,#e3dcd1);border-left:0;border-radius:0 9px 9px 0;background:#fff;color:var(--ink,#1b1b1b);font:700 13px inherit;cursor:pointer;box-shadow:2px 0 10px rgba(40,30,20,.12);display:flex;align-items:center;justify-content:center;padding:0}'
      + '#mapT:not(.left-off) .left-tab{left:330px}.left-tab:hover{background:var(--paper-2,#f3f1ee)}'
      + '@media(max-width:900px){#mapT:not(.left-off) .left-tab{left:275px}}@media(max-width:620px){.left-tab{display:none}}'
      /* v4.76.0: полный экран для области карты; запасной режим без Fullscreen API */
      + '#mapT:fullscreen,#mapT:-webkit-full-screen{background:#fff}#mapT.geo-fs-fallback{position:fixed;inset:0;z-index:3000;background:#fff}'
      /* при открытом ящике панель инструментов, подсказка и уведомление сдвигаются к центру видимой части карты */
      + '#mapT.ga-open .geo-tb,#mapT.ga-open .geo-tb-hint,#mapT.ga-open .geo-toast{left:calc(50% - 120px)}'
      + '@media(max-width:620px){.ga-drawer{width:100%}.ga-toggle{top:auto;bottom:70px;right:12px}#mapT.ga-open .geo-tb,#mapT.ga-open .geo-tb-hint,#mapT.ga-open .geo-toast{left:50%}}';
    document.head.appendChild(s);
  }

  /* --- гео-агент в правой панели --------------------------------------------------- */
  /* focus: переводить ли курсор в строку агента. Только по явному нажатию кнопки: когда ящик
     открывается сам после фигуры, фокус остаётся на карте, и хоткеи P/O/C/R продолжают работать. */
  function openDrawer(on, focus) {
    var d = $('gaDrawer'), b = $('gaToggle'), wrap = $('mapT'); if (!d) return;
    d.classList.toggle('open', !!on); if (b) b.classList.toggle('on', !!on); if (wrap) wrap.classList.toggle('ga-open', !!on);
    try { localStorage.setItem(KEY_DRAWER, on ? '1' : '0'); } catch (e) {}
    setTimeout(function () { var M = theMap(); if (M) try { M.invalidateSize(); } catch (e) {} }, 220);
    if (on && focus) { var inp = $('gaInput'); if (inp) try { inp.focus({ preventScroll: true }); } catch (e) {} }
    if (!on) { try { var ae = document.activeElement; if (ae && d.contains(ae)) ae.blur(); } catch (e) {} }
  }
  function mountDrawer() {
    var panel = $('gaPanel'), wrap = $('mapT');
    if (!panel || !wrap) return false;
    if ($('gaDrawer')) return true;
    var drawer = document.createElement('aside'); drawer.id = 'gaDrawer'; drawer.className = 'ga-drawer'; drawer.setAttribute('aria-label', 'Гео-агент');
    var badge = panel.querySelector('.ga-badge');
    var head = document.createElement('div'); head.className = 'ga-drawer-head';
    head.innerHTML = '<span>Гео-агент</span>' + (badge ? badge.outerHTML : '') + '<span class="sp"></span><button type="button" class="ga-drawer-x" id="gaDrawerClose" aria-label="Закрыть панель агента" title="Закрыть (Esc)">✕</button>';
    drawer.appendChild(head);
    panel.classList.remove('closed');
    drawer.appendChild(panel);
    wrap.appendChild(drawer);
    var btn = document.createElement('button'); btn.type = 'button'; btn.id = 'gaToggle'; btn.className = 'ga-toggle'; btn.title = 'Гео-агент: открыть панель'; btn.setAttribute('aria-controls', 'gaDrawer');
    btn.innerHTML = '<span class="ga-toggle-ic">✦</span><span>Гео-агент</span>';
    wrap.appendChild(btn);
    btn.onclick = function () { openDrawer(!drawer.classList.contains('open'), true); };
    $('gaDrawerClose').onclick = function () { openDrawer(false); };
    var saved = null; try { saved = localStorage.getItem(KEY_DRAWER); } catch (e) {}
    openDrawer(saved === '1');
    return true;
  }
  function waitForAgent() {
    var tries = 0;
    (function tick() { if (mountDrawer() || ++tries > 60) return; setTimeout(tick, 250); })();
  }

  /* --- легенда обозначений в плашке «На экране» --------------------------------- */
  var STATIC = '<div class="grp2">Обозначения</div>'
    + '<div class="li"><span class="dot" style="background:#0d7a6f"></span>бизнес-центр (единый цвет)</div>'
    + '<div class="li"><span class="dot" style="background:#9E0000;border-radius:0"></span>точка анализа</div>'
    + '<div class="li"><span class="dot" style="background:#fff;border:2px solid #e6a700"></span>отредактированная запись</div>'
    + '<div class="li" style="color:var(--muted,#6f6a63)">наведите: данные · клик: карточка</div>';
  function wrapLegend() {
    var orig = window.updateLegend;
    if (typeof orig !== 'function' || orig._layout475) return;
    var w = function () {
      var r = orig.apply(this, arguments);
      try {
        var el = $('mlgd'), body = el && el.querySelector('.body');
        if (body && !body.querySelector('.ga-static-legend')) { var d = document.createElement('div'); d.className = 'ga-static-legend'; d.innerHTML = STATIC; body.appendChild(d); }
      } catch (e) {}
      return r;
    };
    w._layout475 = true; window.updateLegend = w;
    try { w(); } catch (e) {}
  }

  /* --- атрибуция без флага ------------------------------------------------------ */
  function fixAttribution() {
    var M = theMap(); if (!M || !M.attributionControl) return;
    try { M.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener" title="Библиотека карты">Leaflet</a>'); } catch (e) {}
  }

  /* --- свои радиусы охвата ------------------------------------------------------- */
  var PAL = ['#27ae60', '#e67e22', '#c0392b', '#2980b9', '#8e44ad', '#16a085', '#d35400', '#2c3e50'];
  function ringColor(i) { var rs = radii(); return (rs[i] && /^#[0-9a-f]{6}$/i.test(rs[i].color || '')) ? rs[i].color : PAL[i % PAL.length]; }
  function saveRings() { try { localStorage.setItem(KEY_RINGS, JSON.stringify(radii().map(function (r, i) { return { km: r.km, on: !!r.on, color: ringColor(i) }; }))); } catch (e) {} }
  function radii() { try { return Array.isArray(RADII) ? RADII : []; } catch (e) { return []; } }
  function myBuildRings() {
    var box = $('rings'); if (!box) return;
    var rs = radii(); box.innerHTML = '';
    rs.forEach(function (r, i) {
      var l = document.createElement('label'); l.className = 'ck';
      l.innerHTML = '<input type="checkbox"' + (r.on ? ' checked' : '') + '> <input type="color" value="' + ringColor(i) + '" title="цвет кольца ' + r.km + ' км" aria-label="цвет кольца ' + r.km + ' км"> ' + r.km + ' км';
      l.querySelector('input[type=checkbox]').onchange = function (e) { rs[i].on = e.target.checked; saveRings(); try { myRenderRings(); } catch (x) {} try { catchSummary(); } catch (x) {} };
      /* цвет кольца: своя кнопка у каждого радиуса (замечание владельца: кольца были одного цвета) */
      l.querySelector('input[type=color]').addEventListener('input', function (e) { rs[i].color = e.target.value; saveRings(); try { myRenderRings(); } catch (x) {} });
      box.appendChild(l);
    });
    var inp = $('ringKm'); if (inp && document.activeElement !== inp) inp.value = rs.map(function (r) { return r.km; }).join(', ');
  }
  function myRenderRings() {
    var M = theMap(); if (!M) return;
    try { gRing.clearLayers(); } catch (e) { return; }
    var p = null; try { p = proj(); } catch (e) {}
    if (!p || !Number.isFinite(+p.lat) || !Number.isFinite(+p.lng)) return;
    var w = +(($('ringW') || {}).value || 3), rs = radii();
    rs.filter(function (r) { return r.on; }).sort(function (a, b) { return b.km - a.km; }).forEach(function (r) {
      var i = rs.indexOf(r), col = ringColor(i);
      L.circle([+p.lat, +p.lng], { radius: r.km * 1000, color: col, weight: w, opacity: .95, fillColor: col, fillOpacity: .06 }).addTo(gRing).bindTooltip(r.km + ' км', { sticky: true });
    });
  }
  function applyRadii(text) {
    var nums = String(text || '').split(/[,;\s]+/).map(function (x) { return parseFloat(String(x).replace(',', '.')); }).filter(function (v) { return isFinite(v) && v > 0 && v <= 50; });
    nums = nums.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }).slice(0, 8);
    if (!nums.length) return false;
    var prev = radii();
    /* кнопка «применить» включает все введённые кольца; цвет кольца с тем же радиусом сохраняется */
    try { RADII = nums.map(function (km, i) { var old = null; prev.forEach(function (r) { if (+r.km === km) old = r; }); return { km: km, on: true, color: old && old.color ? old.color : PAL[i % PAL.length] }; }); } catch (e) { return false; }
    saveRings();
    myBuildRings();
    try { myRenderRings(); } catch (e) {}
    try { catchSummary(); } catch (e) {}
    return true;
  }
  function installRings() {
    if (typeof window.buildRings === 'function') window.buildRings = myBuildRings;
    if (typeof window.renderRings === 'function') window.renderRings = myRenderRings;
    /* v4.76.0: пин ставит только точку, кольца охвата не появляются сами (замечание владельца):
       по умолчанию все кольца выключены, пользователь включает их в «Зоне охвата». Память v2 хранит
       и флажки, и цвета; старая память v1 (список километров) переносится с выключенными кольцами. */
    var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY_RINGS) || 'null'); } catch (e) {}
    if (!Array.isArray(saved)) { try { var old = JSON.parse(localStorage.getItem(KEY_RINGS_OLD) || 'null'); if (Array.isArray(old) && old.length) saved = old.map(function (km) { return { km: +km, on: false }; }); } catch (e) {} }
    try {
      if (Array.isArray(saved) && saved.length) RADII = saved.filter(function (r) { return r && isFinite(+r.km) && +r.km > 0; }).map(function (r, i) { return { km: +r.km, on: !!r.on, color: /^#[0-9a-f]{6}$/i.test(r.color || '') ? r.color : PAL[i % PAL.length] }; });
      else if (Array.isArray(RADII)) RADII.forEach(function (r, i) { r.on = false; r.color = PAL[i % PAL.length]; });
    } catch (e) {}
    myBuildRings();
    var inp = $('ringKm'), btn = $('ringApply');
    if (btn) btn.onclick = function () { if (!applyRadii(inp && inp.value)) { if (inp) inp.value = radii().map(function (r) { return r.km; }).join(', '); } };
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
    try { myRenderRings(); } catch (e) {}
  }

  /* --- зоны по времени в пути (замечание владельца, v4.78.0): три зоны сразу, авто или метро,
     свои цвета, каждая зона включается отдельно; считает и рисует гео-агент (catchment) --- */
  var KEY_TZ = 'caseos_time_zones_v1', TZ_PAL = ['#9E0000', '#e67e22', '#2980b9'], TZ = null;
  function tzAgent() { return window.CASE_GEO_AGENT || null; }
  function tzToast(m) { var t = $('geoToast'); if (t) { t.textContent = m; t.classList.add('on'); clearTimeout(tzToast.t); tzToast.t = setTimeout(function () { t.classList.remove('on'); }, 2800); } }
  function tzLoad() {
    var d = { mode: 'car', mins: [10, 20, 30], colors: TZ_PAL.slice(), on: [true, true, true] };
    try { var j = JSON.parse(localStorage.getItem(KEY_TZ) || 'null'); if (j && typeof j === 'object') { if (j.mode === 'metro' || j.mode === 'car') d.mode = j.mode; if (Array.isArray(j.mins) && j.mins.length === 3 && j.mins.every(function (v) { return isFinite(+v) && +v > 0; })) d.mins = j.mins.map(Number); if (Array.isArray(j.colors)) d.colors = d.colors.map(function (c, i) { return /^#[0-9a-f]{6}$/i.test(j.colors[i] || '') ? j.colors[i] : c; }); if (Array.isArray(j.on)) d.on = d.on.map(function (v, i) { return j.on[i] !== false; }); } } catch (e) {}
    return d;
  }
  function tzSave() { try { localStorage.setItem(KEY_TZ, JSON.stringify({ mode: TZ.mode, mins: TZ.mins, colors: TZ.colors, on: TZ.on })); } catch (e) {} }
  function tzParseMins() {
    var nums = String(($('tzMin') || {}).value || '').split(/[,;\s\/]+/).map(function (x) { return parseInt(x, 10); }).filter(function (v) { return isFinite(v) && v >= 1 && v <= 60; });
    nums = nums.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }).slice(0, 3);
    while (nums.length && nums.length < 3) nums.push(Math.min(60, nums[nums.length - 1] + 10));
    return nums.length === 3 ? nums : null;
  }
  function tzRows(res) {
    var box = $('tzZones'); if (!box) return; box.innerHTML = '';
    var mins = res ? res.minutes : TZ.mins, zones = res ? res.zones : null;
    mins.forEach(function (m, i) {
      var l = document.createElement('label'); l.className = 'ck tz-row';
      l.innerHTML = '<input type="checkbox"' + (TZ.on[i] ? ' checked' : '') + ' title="показывать зону"> <input type="color" value="' + TZ.colors[i] + '" title="цвет зоны ' + m + ' мин" aria-label="цвет зоны ' + m + ' мин"> ' + m + ' мин' + (zones ? ' <span class="tz-pop">· ' + Math.round(zones[i].population).toLocaleString('ru') + ' жит.' + (zones[i].stations != null ? ' · станций ' + zones[i].stations : '') + '</span>' : '');
      l.querySelector('input[type=checkbox]').onchange = function (e) { TZ.on[i] = e.target.checked; tzSave(); tzApply(); };
      l.querySelector('input[type=color]').addEventListener('input', function (e) { TZ.colors[i] = e.target.value; tzSave(); tzApply(); });
      box.appendChild(l);
    });
    var note = $('tzNote'); if (note) note.textContent = res ? ((res.provenance && res.provenance.method ? res.provenance.method + '. ' : '') + 'Оценка, не факт: границы без коррекции на барьеры.') : 'Три зоны по времени в пути от точки анализа, каждая своим цветом: на авто по дорогам (OSRM) или на метро с пешей частью по линиям студии. Население считается внутри каждой зоны.';
  }
  function tzApply() { var A = tzAgent(); if (A && typeof A.recolorCatchment === 'function') A.recolorCatchment(TZ.colors, TZ.on.map(function (v) { return !v; })); }
  function tzBuild() {
    var A = tzAgent(); if (!A) { tzToast('Гео-агент не загружен'); return Promise.resolve(); }
    if (!A.state.site) { tzToast('Сначала поставьте точку анализа (пин внизу карты или правый клик)'); return Promise.resolve(); }
    var mins = tzParseMins(); if (!mins) { tzToast('Три времени в пути через запятую, например 10, 20, 30'); return Promise.resolve(); }
    TZ.mins = mins; TZ.mode = ($('tzMode') || {}).value === 'metro' ? 'metro' : 'car'; tzSave();
    var inp = $('tzMin'); if (inp) inp.value = mins.join(', ');
    var note = $('tzNote'); if (note) note.textContent = TZ.mode === 'metro' ? 'Считаю зоны по метро и пешком…' : 'Считаю изохроны по дорогам (OSRM)…';
    return A.run('catchment', { minutes: mins, mode: TZ.mode, colors: TZ.colors, hidden: TZ.on.map(function (v) { return !v; }) }).then(function (res) {
      try { A.say('fact', A.factHtml('catchment', res)); A.say('ai', A.narrative([{ name: 'catchment', res: res }])); } catch (e) {}
      tzRows(res);
      if (res.mode === 'radius') tzToast('Маршрутизатор недоступен: зоны построены по радиусам');
      return res;
    }, function (e) { var m = String(e && e.message || e); if (note) note.textContent = m; tzToast(m); });
  }
  function tzClear() { var A = tzAgent(); if (A) A.run('clear_layers', { layers: ['catchment'] }); tzRows(null); }
  function installTimeZones() {
    if ($('tzBox')) return; var rings = $('rings'); if (!rings || !rings.parentNode) return;
    TZ = tzLoad();
    var box = document.createElement('div'); box.id = 'tzBox'; box.className = 'tz';
    box.innerHTML = '<div class="tz-h">Зоны по времени в пути</div>'
      + '<div class="styrow sub"><label for="tzMode">как едем</label><select id="tzMode" style="font-size:11px"><option value="car">на авто (дороги OSM, OSRM)</option><option value="metro">метро и пешком</option></select></div>'
      + '<div class="styrow sub"><label for="tzMin">минуты</label><input type="text" id="tzMin" style="width:100px;font-size:11px" title="три времени в пути через запятую, до 60 минут"><button type="button" class="btn sec" id="tzGo" style="font-size:11px" title="построить три зоны по времени в пути от точки анализа">✓ построить</button><button type="button" class="btn sec" id="tzClear" style="font-size:11px" title="убрать зоны с карты">✕</button></div>'
      + '<div id="tzZones"></div><div class="mini" id="tzNote"></div>';
    rings.parentNode.insertBefore(box, rings.nextSibling);
    var st = document.createElement('style'); st.textContent = '.tz{margin:8px 0 4px;padding-top:6px;border-top:1px dashed var(--line,#e3dcd1)}.tz-h{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--red-d,#7a0000);margin-bottom:4px}.tz-row .tz-pop{color:var(--muted,#6f6a63);font-size:10.5px}.tz .styrow.sub{gap:4px}'; document.head.appendChild(st);
    $('tzMode').value = TZ.mode; $('tzMin').value = TZ.mins.join(', ');
    $('tzMode').onchange = function () { TZ.mode = this.value === 'metro' ? 'metro' : 'car'; tzSave(); };
    $('tzGo').onclick = function () { tzBuild(); }; $('tzClear').onclick = tzClear;
    $('tzMin').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); tzBuild(); } });
    tzRows(null);
  }
  LY.timeZones = { build: tzBuild, clear: tzClear, state: function () { return TZ; } };

  /* --- левая панель сворачивается целиком ------------------------------------------ */
  function leftOpen(on) {
    var wrap = $('mapT'), tab = $('leftTab'); if (!wrap) return;
    wrap.classList.toggle('left-off', !on);
    if (tab) { tab.textContent = on ? '\u2039' : '\u203a'; tab.title = on ? 'Скрыть левую панель' : 'Показать левую панель'; tab.setAttribute('aria-expanded', on ? 'true' : 'false'); }
    try { localStorage.setItem(KEY_LEFT, on ? '1' : '0'); } catch (e) {}
    setTimeout(function () { var M = theMap(); if (M) try { M.invalidateSize(); } catch (e) {} }, 60);
  }
  function mountLeftTab() {
    var wrap = $('mapT'); if (!wrap || $('leftTab') || !wrap.querySelector('.left')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'leftTab'; b.className = 'left-tab'; b.setAttribute('aria-controls', 'mapT');
    b.onclick = function () { leftOpen(wrap.classList.contains('left-off')); };
    wrap.appendChild(b);
    var saved = null; try { saved = localStorage.getItem(KEY_LEFT); } catch (e) {}
    leftOpen(saved !== '0');
  }

  /* --- полный экран области карты --------------------------------------------------- */
  function isFs() { var wrap = $('mapT'); return !!(wrap && ((document.fullscreenElement && document.fullscreenElement === wrap) || (document.webkitFullscreenElement && document.webkitFullscreenElement === wrap) || wrap.classList.contains('geo-fs-fallback'))); }
  var leftWasOpen = null;
  function fsApply(on) {
    var wrap = $('mapT'); if (!wrap) return;
    if (on) { leftWasOpen = !wrap.classList.contains('left-off'); if (leftWasOpen) leftOpen(false); }
    else if (leftWasOpen) { leftOpen(true); leftWasOpen = null; }
    setTimeout(function () { var M = theMap(); if (M) try { M.invalidateSize(); } catch (e) {} }, 120);
    try { document.dispatchEvent(new CustomEvent('caseos:fullscreen', { detail: { on: on } })); } catch (e) {}
  }
  function fullscreen(on) {
    var wrap = $('mapT'); if (!wrap) return;
    if (on === undefined) on = !isFs();
    if (!on) {
      if (wrap.classList.contains('geo-fs-fallback')) { wrap.classList.remove('geo-fs-fallback'); fsApply(false); return; }
      try { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { var r = ex.call(document); if (r && r.catch) r.catch(function () {}); } } catch (e) {}
      return;
    }
    var req = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    var fallback = function () { wrap.classList.add('geo-fs-fallback'); fsApply(true); };
    if (!req) { fallback(); return; }
    try { var p = req.call(wrap); if (p && p.then) p.then(null, fallback); } catch (e) { fallback(); }
  }
  function bindFullscreen() {
    ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) { document.addEventListener(ev, function () { fsApply(isFs()); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var wrap = $('mapT'); if (wrap && wrap.classList.contains('geo-fs-fallback')) fullscreen(false); } });
  }

  /* --- клик по карте ничего не открывает ------------------------------------------ */
  function disableProbeClick() { var cb = $('lProbe'); if (cb) { cb.checked = false; var row = cb.closest('label'); if (row) row.style.display = 'none'; } }

  function install() {
    css(); fixAttribution(); disableProbeClick(); wrapLegend(); installRings(); installTimeZones(); waitForAgent(); mountLeftTab(); bindFullscreen();
  }
  LY.openAgent = openDrawer; LY.applyRadii = applyRadii; LY.radii = radii; LY.leftOpen = leftOpen; LY.fullscreen = fullscreen; LY.isFullscreen = isFs; LY.ringColor = ringColor;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4750-geo-layout'] = '4.76.0';
