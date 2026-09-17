/* CASE OS v4.74.0: дерево слоёв и подложки в студии геоаналитики.
 *
 * Замечание владельца: левая панель должна работать как фильтр, галочка -> карта меняется
 * сразу; слои по категориям и подкатегориям; границы районов, тепловая карта, объекты; и
 * вернуть кнопку выбора карт. Что делает модуль поверх готовой разметки секции «Слои и
 * стиль» (geoanalytics-studio.html), не трогая обработчики слоёв:
 *
 *   - категории («Бизнес-центры», «Медицина и аптеки», «Ритейл» ...) становятся узлами
 *     дерева: общая галочка включает и выключает все слои категории, счётчик «включено /
 *     всего», категория сворачивается, состояние помнится в localStorage;
 *   - «Границы и плотность» поднимаются наверх, перед ними узел «Подложка» с выбором карты;
 *   - поиск по слоям: строка «найти слой» показывает только подходящие строки и раскрывает
 *     их категории;
 *   - у карты появляется кнопка подложки с именем текущей карты и списком остальных;
 *     стандартный свёрнутый переключатель Leaflet скрыт, чтобы не было двух органов
 *     управления одним и тем же; выбор помнится;
 *   - строки слоёв, которые модуль городских объектов дорисовывает позже (якоря
 *     geoCatAnchor-*), подхватываются наблюдателем и попадают в счётчики.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_TREE) return;
  var VERSION = '4.74.0', KEY = 'caseos_geo_tree_v1';
  var T = window.CASE_GEO_TREE = { version: VERSION };
  /* карта студии объявлена как let map (глобальная лексическая), а theMap() - это <div id="map">;
     берём именно объект Leaflet */
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(patch) { var s = store(); Object.keys(patch).forEach(function (k) { s[k] = patch[k]; }); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function layerInputs(root) { return [].slice.call(root.querySelectorAll('input[type=checkbox]')).filter(function (cb) { return /^(l[A-Z]|geoLayer-)/.test(cb.id || ''); }); }
  function findLayersSection() { var hs = document.querySelectorAll('.left>.sect>h3'); for (var i = 0; i < hs.length; i++) if (/слои и стиль/i.test(hs[i].textContent)) return hs[i].parentNode; return null; }

  function css() {
    if (document.getElementById('geoTreeCss')) return;
    var s = document.createElement('style'); s.id = 'geoTreeCss'; s.textContent =
      '.geo-cat{border:1px solid var(--line,#e3dcd1);border-radius:10px;margin:6px 0;background:#fff;overflow:hidden}'
      + '.geo-cat-head{display:flex;align-items:center;gap:7px;padding:6px 9px;background:var(--paper-2,#f3f1ee)}'
      + '.geo-cat-head .geo-cat-all{margin:0;accent-color:var(--red,#9E0000);flex:0 0 auto}'
      + '.geo-cat-name{flex:1;min-width:0;text-align:left;border:0;background:none;font:800 10.5px/1.2 inherit;letter-spacing:.04em;text-transform:uppercase;color:var(--red-d,#6e0000);cursor:pointer;display:flex;align-items:center;gap:6px;padding:3px 0}'
      + '.geo-cat-name>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.geo-cat-n{margin-left:auto;font-weight:700;color:var(--muted,#6f6a63);font-size:10px;border:1px solid var(--line,#e3dcd1);border-radius:999px;padding:1px 7px;background:#fff;letter-spacing:0;text-transform:none}'
      + '.geo-cat-active .geo-cat-n{color:#fff;background:var(--red,#9E0000);border-color:var(--red,#9E0000)}'
      + '.geo-cat-chev{font-size:9px;color:var(--muted,#6f6a63);transition:transform .15s;flex:0 0 auto}'
      + '.geo-cat:not(.open) .geo-cat-chev{transform:rotate(-90deg)}'
      + '.geo-cat-body{padding:4px 9px 6px}.geo-cat:not(.open) .geo-cat-body{display:none}'
      + '.geo-cat-body .geo-cat-title{display:none}'
      + '.geo-tree-q{width:100%;height:30px;border:1px solid var(--line,#e3dcd1);border-radius:8px;padding:0 9px;font:inherit;font-size:11.5px;margin:2px 0 6px;background:#fff}'
      + '.geo-tree-q:focus{outline:none;border-color:var(--red,#9E0000);box-shadow:0 0 0 3px rgba(158,0,0,.1)}'
      + '.geo-tree-hide{display:none!important}.geo-tree-empty{font-size:11px;color:var(--muted,#6f6a63);padding:4px 2px}'
      + '.geo-base-opt{display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0}.geo-base-opt input{accent-color:var(--red,#9E0000)}'
      + '.leaflet-control-layers{display:none!important}'
      + '.geo-basectl{position:relative;font-family:inherit}'
      + '.geo-basectl-btn{display:flex;align-items:center;gap:6px;height:34px;padding:0 11px;border:1px solid var(--line,#e3dcd1);border-radius:9px;background:#fff;box-shadow:0 1px 2px rgba(40,30,20,.06),0 8px 24px rgba(40,30,20,.08);font:700 12px inherit;color:var(--ink,#1b1b1b);cursor:pointer;white-space:nowrap;max-width:230px}'
      + '.geo-basectl-btn:hover{background:var(--paper-2,#f3f1ee)}.geo-basectl-name{overflow:hidden;text-overflow:ellipsis}'
      + '.geo-basectl-menu{position:absolute;right:0;top:38px;min-width:200px;background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:10px;box-shadow:0 8px 24px rgba(40,30,20,.14);padding:6px;z-index:1200}'
      + '.geo-basectl-menu.hidden{display:none}.geo-basectl-menu .geo-base-opt{padding:5px 8px;border-radius:7px;cursor:pointer}.geo-basectl-menu .geo-base-opt:hover{background:var(--paper-2,#f3f1ee)}'
      + '.geo-basectl-menu h5{margin:2px 8px 4px;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#6f6a63)}'
      + '@media(max-width:620px){.geo-basectl-btn{max-width:150px}}';
    document.head.appendChild(s);
  }

  /* --- подложки --------------------------------------------------------------------- */
  function bases() { var B = window.BASES; if (!B || !theMap()) return []; return Object.keys(B).filter(function (k) { return !/нужен ключ/i.test(k); }); }
  function currentBase() { var B = window.BASES || {}; for (var k in B) { try { if (theMap().hasLayer(B[k])) return k; } catch (e) {} } return null; }
  function setBase(k) {
    var B = window.BASES; if (!B || !B[k] || !theMap()) return;
    var cur = currentBase(); if (cur === k) { save({ base: k }); syncBase(); return; }
    if (cur) { try { theMap().removeLayer(B[cur]); } catch (e) {} }
    B[k].addTo(theMap());
    try { theMap().fire('baselayerchange', { name: k, layer: B[k] }); } catch (e) {}
    save({ base: k }); syncBase();
  }
  function syncBase() {
    var cur = currentBase() || '';
    /* у дерева и у кнопки разные группы радио: одна общая группа снимала бы отметку в дереве при выборе из меню */
    document.querySelectorAll('input[name=geoBaseOpt],input[name=geoBaseMenuOpt]').forEach(function (r) { r.checked = r.value === cur; });
    var n = document.querySelector('.geo-basectl-name'); if (n) n.textContent = cur || 'Подложка';
  }
  function baseOptions(name) {
    return bases().map(function (k) { return '<label class="geo-base-opt"><input type="radio" name="' + name + '" value="' + esc(k) + '"> <span>' + esc(k) + '</span></label>'; }).join('');
  }
  function bindBaseOptions(root) {
    root.querySelectorAll('input[name=geoBaseOpt],input[name=geoBaseMenuOpt]').forEach(function (r) { r.addEventListener('change', function () { if (r.checked) setBase(r.value); }); });
  }
  function baseCategory() {
    if (!bases().length) return null;
    var d = document.createElement('div'); d.className = 'geo-cat open'; d.setAttribute('data-cat', 'Подложка');
    d.innerHTML = '<div class="geo-cat-head"><button type="button" class="geo-cat-name"><span>Подложка карты</span><span class="geo-cat-n geo-base-current"></span><span class="geo-cat-chev">▾</span></button></div><div class="geo-cat-body">' + baseOptions('geoBaseOpt') + '<div class="mini" style="margin-top:3px">Данные OpenStreetMap по ODbL; Google, 2GIS и Яндекс показываются по их условиям.</div></div>';
    bindBaseOptions(d);
    return d;
  }
  function baseControl() {
    var host = document.querySelector('#map .leaflet-top.leaflet-right'); if (!host || document.querySelector('.geo-basectl') || !bases().length) return;
    var el = document.createElement('div'); el.className = 'geo-basectl leaflet-control';
    el.innerHTML = '<button type="button" class="geo-basectl-btn" title="Подложка карты" aria-haspopup="true" aria-expanded="false">🗺 <span class="geo-basectl-name"></span> <span aria-hidden="true">▾</span></button><div class="geo-basectl-menu hidden" role="menu"><h5>Подложка карты</h5>' + baseOptions('geoBaseMenuOpt') + '</div>';
    host.insertBefore(el, host.firstChild);
    try { if (window.L && L.DomEvent) { L.DomEvent.disableClickPropagation(el); L.DomEvent.disableScrollPropagation(el); } } catch (e) {}
    var btn = el.querySelector('.geo-basectl-btn'), menu = el.querySelector('.geo-basectl-menu');
    btn.addEventListener('click', function (e) { e.stopPropagation(); var open = menu.classList.toggle('hidden'); btn.setAttribute('aria-expanded', open ? 'false' : 'true'); });
    document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.geo-basectl')) { menu.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); } });
    bindBaseOptions(el);
    /* закрываем и по клику на уже выбранную подложку: change в этом случае не приходит */
    var close = function () { menu.classList.add('hidden'); btn.setAttribute('aria-expanded', 'false'); };
    menu.addEventListener('change', close);
    menu.addEventListener('click', function (e) { var opt = e.target.closest && e.target.closest('.geo-base-opt'); if (!opt) return; var r = opt.querySelector('input'); setTimeout(function () { if (r && r.checked) setBase(r.value); close(); }, 0); });
  }

  /* --- дерево категорий --------------------------------------------------------------- */
  function refresh(d) {
    var body = d.querySelector('.geo-cat-body'); if (!body) return;
    var ins = layerInputs(body), on = ins.filter(function (cb) { return cb.checked; }).length;
    /* textContent меняем только при отличии: замена текстового узла сама по себе мутация,
       и наблюдатель ниже уходил бы в бесконечный цикл */
    var n = d.querySelector('.geo-cat-n:not(.geo-base-current)'), txt = ins.length ? on + ' / ' + ins.length : '';
    if (n && n.textContent !== txt) n.textContent = txt;
    var all = d.querySelector('.geo-cat-all'); if (all) { all.checked = ins.length > 0 && on === ins.length; all.indeterminate = on > 0 && on < ins.length; all.disabled = !ins.length; }
    d.classList.toggle('geo-cat-active', on > 0);
  }
  var refreshT = null;
  function refreshAll() { document.querySelectorAll('.geo-cat').forEach(refresh); }
  function refreshSoon() { clearTimeout(refreshT); refreshT = setTimeout(refreshAll, 60); }
  function categoryNode(title, items, opened) {
    var d = document.createElement('div'); d.className = 'geo-cat' + (opened ? ' open' : ''); d.setAttribute('data-cat', title);
    var head = document.createElement('div'); head.className = 'geo-cat-head';
    head.innerHTML = '<input type="checkbox" class="geo-cat-all" title="включить или выключить все слои категории" aria-label="все слои: ' + esc(title) + '"><button type="button" class="geo-cat-name" aria-expanded="' + (opened ? 'true' : 'false') + '"><span>' + esc(title) + '</span><span class="geo-cat-n"></span><span class="geo-cat-chev">▾</span></button>';
    var bd = document.createElement('div'); bd.className = 'geo-cat-body'; items.forEach(function (el) { bd.appendChild(el); });
    d.appendChild(head); d.appendChild(bd);
    head.querySelector('.geo-cat-name').addEventListener('click', function () { var open = d.classList.toggle('open'); this.setAttribute('aria-expanded', open ? 'true' : 'false'); var s = store(); s.open = s.open || {}; s.open[title] = open ? 1 : 0; save({ open: s.open }); });
    head.querySelector('.geo-cat-all').addEventListener('change', function () {
      var on = this.checked;
      layerInputs(bd).forEach(function (cb) { if (cb.checked !== on) { cb.checked = on; cb.dispatchEvent(new Event('change', { bubbles: true })); } });
      refresh(d);
    });
    return d;
  }
  function buildTree() {
    var sect = findLayersSection(); if (!sect || sect.querySelector('.geo-cat')) return false;
    var body = sect.querySelector('.sbody') || sect;
    var kids = [].slice.call(body.children), groups = [], cur = null, loose = [];
    kids.forEach(function (el) {
      if (el.classList && el.classList.contains('geo-cat-title')) { cur = { title: el.textContent.trim(), titleEl: el, items: [] }; groups.push(cur); }
      else if (cur) cur.items.push(el); else loose.push(el);
    });
    if (!groups.length) return false;
    var st = store(), openDefault = { 'Бизнес-центры': 1, 'Границы и плотность': 1 };
    var order = groups.slice(), bi = -1;
    order.forEach(function (g, i) { if (bi < 0 && /границы/i.test(g.title)) bi = i; });
    if (bi > 0) order.unshift(order.splice(bi, 1)[0]);
    var frag = document.createDocumentFragment();
    var q = document.createElement('input'); q.type = 'search'; q.className = 'geo-tree-q'; q.placeholder = 'Найти слой: районы, метро, кафе, аптеки'; q.setAttribute('aria-label', 'Найти слой');
    frag.appendChild(q);
    var base = baseCategory(); if (base) frag.appendChild(base);
    order.forEach(function (g) {
      var opened = (st.open && Object.prototype.hasOwnProperty.call(st.open, g.title)) ? !!st.open[g.title] : !!openDefault[g.title];
      g.titleEl.remove();
      frag.appendChild(categoryNode(g.title, g.items, opened));
    });
    var empty = document.createElement('div'); empty.className = 'geo-tree-empty geo-tree-hide'; empty.textContent = 'Слоёв с таким названием нет.'; frag.appendChild(empty);
    loose.forEach(function (el) { frag.appendChild(el); });
    body.appendChild(frag);
    body.addEventListener('change', function (e) { var d = e.target.closest && e.target.closest('.geo-cat'); if (d && !e.target.classList.contains('geo-cat-all')) refresh(d); });
    q.addEventListener('input', function () { filterTree(body, q.value); });
    refreshAll();
    try { new MutationObserver(function (muts) { for (var i = 0; i < muts.length; i++) { var t = muts[i].target; if (t && t.closest && t.closest('.geo-cat-head')) continue; refreshSoon(); return; } }).observe(body, { childList: true, subtree: true }); } catch (e) {}
    return true;
  }
  function filterTree(body, text) {
    var t = String(text || '').trim().toLowerCase(), any = false;
    body.querySelectorAll('.geo-cat').forEach(function (d) {
      var rows = [].slice.call(d.querySelectorAll('.geo-cat-body>*')), hit = 0;
      rows.forEach(function (r) {
        if (!t) { r.classList.remove('geo-tree-hide'); return; }
        var isRow = r.classList.contains('lrow') || r.classList.contains('styrow') || r.classList.contains('geo-base-opt') || r.id && r.id.indexOf('geoCatAnchor-') === 0;
        var ok = isRow && r.textContent.toLowerCase().indexOf(t) >= 0;
        if (r.id && r.id.indexOf('geoCatAnchor-') === 0) { var sub = 0; [].slice.call(r.children).forEach(function (c) { var o = c.textContent.toLowerCase().indexOf(t) >= 0; c.classList.toggle('geo-tree-hide', !o); if (o) sub++; }); ok = sub > 0; }
        r.classList.toggle('geo-tree-hide', !ok);
        if (ok) hit++;
      });
      if (t) { d.classList.toggle('geo-tree-hide', !hit); if (hit) d.classList.add('open'); if (hit) any = true; }
      else { d.classList.remove('geo-tree-hide'); var s = store(); if (s.open && Object.prototype.hasOwnProperty.call(s.open, d.getAttribute('data-cat'))) d.classList.toggle('open', !!s.open[d.getAttribute('data-cat')]); }
    });
    var empty = body.querySelector('.geo-tree-empty'); if (empty) empty.classList.toggle('geo-tree-hide', !t || any);
  }

  function install() {
    css();
    var built = buildTree();
    baseControl();
    var st = store();
    if (st.base && window.BASES && window.BASES[st.base]) setBase(st.base); else syncBase();
    /* автозамена подложки в студии меняет слои без события baselayerchange: следим и за layeradd */
    try { if (theMap()) { theMap().on('baselayerchange', syncBase); theMap().on('layeradd layerremove', function (e) { var B = window.BASES || {}; for (var k in B) if (B[k] === e.layer) { syncBase(); return; } }); } } catch (e) {}
    T.built = built;
  }
  T.setBase = setBase; T.currentBase = currentBase; T.bases = bases; T.refresh = refreshAll; T.filter = function (t) { var s = findLayersSection(); if (s) filterTree(s.querySelector('.sbody') || s, t); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4740-geo-tree'] = '4.74.0';
