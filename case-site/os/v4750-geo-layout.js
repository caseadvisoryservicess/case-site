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
  var VERSION = '4.75.0', KEY_DRAWER = 'caseos_ga_drawer', KEY_RINGS = 'caseos_rings_v1';
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
      + '#rings label.ck{display:inline-flex;margin:2px 10px 2px 0}'
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
  function ringColor(i, n) { if (i === n - 1) { var c = $('ringWc'); if (c && c.value) return c.value; } return PAL[i % PAL.length]; }
  function radii() { try { return Array.isArray(RADII) ? RADII : []; } catch (e) { return []; } }
  function myBuildRings() {
    var box = $('rings'); if (!box) return;
    var rs = radii(); box.innerHTML = '';
    rs.forEach(function (r, i) {
      var l = document.createElement('label'); l.className = 'ck';
      l.innerHTML = '<input type="checkbox"' + (r.on ? ' checked' : '') + '> <span class="dot" style="background:' + ringColor(i, rs.length) + '"></span> ' + r.km + ' км';
      l.querySelector('input').onchange = function (e) { rs[i].on = e.target.checked; try { renderProj(); } catch (x) {} };
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
      var i = rs.indexOf(r), col = ringColor(i, rs.length);
      L.circle([+p.lat, +p.lng], { radius: r.km * 1000, color: col, weight: w, opacity: .95, fillColor: col, fillOpacity: .06 }).addTo(gRing).bindTooltip(r.km + ' км', { sticky: true });
    });
  }
  function applyRadii(text) {
    var nums = String(text || '').split(/[,;\s]+/).map(function (x) { return parseFloat(String(x).replace(',', '.')); }).filter(function (v) { return isFinite(v) && v > 0 && v <= 50; });
    nums = nums.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; }).slice(0, 8);
    if (!nums.length) return false;
    try { RADII = nums.map(function (km) { return { km: km, on: true }; }); } catch (e) { return false; }
    try { localStorage.setItem(KEY_RINGS, JSON.stringify(nums)); } catch (e) {}
    myBuildRings();
    try { renderProj(); } catch (e) {}
    return true;
  }
  function installRings() {
    if (typeof window.buildRings === 'function') window.buildRings = myBuildRings;
    if (typeof window.renderRings === 'function') window.renderRings = myRenderRings;
    var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY_RINGS) || 'null'); } catch (e) {}
    if (Array.isArray(saved) && saved.length) { try { RADII = saved.map(function (km) { return { km: +km, on: true }; }); } catch (e) {} }
    myBuildRings();
    var inp = $('ringKm'), btn = $('ringApply');
    if (btn) btn.onclick = function () { if (!applyRadii(inp && inp.value)) { if (inp) inp.value = radii().map(function (r) { return r.km; }).join(', '); } };
    if (inp) inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
    try { myRenderRings(); } catch (e) {}
  }

  /* --- клик по карте ничего не открывает ------------------------------------------ */
  function disableProbeClick() { var cb = $('lProbe'); if (cb) { cb.checked = false; var row = cb.closest('label'); if (row) row.style.display = 'none'; } }

  function install() {
    css(); fixAttribution(); disableProbeClick(); wrapLegend(); installRings(); waitForAgent();
  }
  LY.openAgent = openDrawer; LY.applyRadii = applyRadii; LY.radii = radii;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4750-geo-layout'] = '4.75.0';
