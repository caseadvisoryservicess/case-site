/* CASE OS v4.76.0: бизнес-центры внутри студии геоаналитики.
 *
 * Решение владельца: отдельный экран «Geo Platform: бизнес-центры» показывал те же данные, что
 * и студия, и люди путались. Всё нужное из него живёт теперь здесь, в левой панели студии:
 *
 *   - фильтры бизнес-центров: поиск, район, класс, источник, проверка, «только с известной
 *     ставкой», «только с правками»; счётчик «найдено N из M»; карта и счёт по кольцам
 *     показывают только отфильтрованные объекты (студия спрашивает CASE_GEO_BC.pass);
 *   - список отфильтрованных БЦ с расстоянием до точки анализа, переходом на карту и в карточку;
 *   - сравнение до четырёх БЦ таблицей (пустая ячейка значит «нет данных», не ноль);
 *   - показатели выборки с честными знаменателями (ставка известна у k из N и т.п.);
 *   - тепловая карта ставок по известным значениям (слой в категории «Бизнес-центры»).
 *
 * Редактор записей с происхождением полей (источник и дата цены, комментарий CASE) в студии
 * уже был: карточка БЦ. Данные те же: мастер-база БЦ студии.
 */
(function () {
  'use strict';
  if (window.CASE_GEO_BC) return;
  var VERSION = '4.76.0', KEY = 'caseos_bc_filters_v1', KEY_SECT = 'caseos_bc_sect', PAGE = 60, CELL_M = 700;
  var B = window.CASE_GEO_BC = { version: VERSION };
  var F = blank(), CMP = [], shown = PAGE, sortBy = 'name', listOn = true, gHeat = null, tmr = null;
  var CLASSES = ['A+', 'A', 'B+', 'B', 'C'], CLASS_COL = { 'A+': '#6e0000', 'A': '#9E0000', 'B+': '#c0392b', 'B': '#e67e22', 'C': '#b9b2a8', none: '#d8d0c4' };
  var RAMP = ['#ffece0', '#f7b28c', '#dc6046', '#9E0000', '#6e0000'];

  function blank() { return { q: '', districts: [], classes: [], providers: [], verif: [], rentOnly: false, editedOnly: false }; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function theMap() { try { return (typeof map !== 'undefined' && map && typeof map.addLayer === 'function') ? map : null; } catch (e) { return null; } }
  function num(v) { if (v == null || v === '') return null; var n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  function fmt(n) { return Math.round(n).toLocaleString('ru'); }
  function all() { try { return (typeof BC !== 'undefined' && Array.isArray(BC)) ? BC : []; } catch (e) { return []; } }
  function effOf(b) { try { return typeof eff === 'function' ? eff(b) : b; } catch (e) { return b; } }
  function edited(b) { try { return !!(b && typeof EDITS !== 'undefined' && EDITS && EDITS[b.id]); } catch (e) { return false; } }
  function cls(e) { return String(e['class'] || '').trim().toUpperCase().replace(/А/g, 'A').replace(/В/g, 'B').replace(/С/g, 'C'); }
  function verif(e) { return String(e._verification || '') === 'needs_review' ? 'needs_review' : 'online'; }
  function point() { try { var p = window.caseGeoPoint ? window.caseGeoPoint() : null; return (p && !p.pending && isFinite(+p.lat) && isFinite(+p.lng)) ? p : null; } catch (e) { return null; } }
  function distKm(e) { var p = point(); if (!p || e.lat == null || e.lng == null) return null; try { return hav(+p.lat, +p.lng, +e.lat, +e.lng); } catch (x) { return null; } }
  function fmtKm(km) { return km == null ? '' : (km < 1 ? Math.round(km * 1000) + ' м' : km.toFixed(km < 10 ? 1 : 0) + ' км'); }

  /* --- фильтр: единственная точка правды для карты, колец, списка и показателей ------------- */
  function pass(e, b) {
    if (!e) return false;
    if (F.q) { var q = F.q.toLowerCase(); if ([e.name, e.address, e.district, e.comment].join(' ').toLowerCase().indexOf(q) < 0) return false; }
    if (F.districts.length && F.districts.indexOf(String(e.district || '')) < 0) return false;
    if (F.classes.length && F.classes.indexOf(cls(e) || 'none') < 0) return false;
    if (F.providers.length && F.providers.indexOf(String(e.provider || '')) < 0) return false;
    if (F.verif.length && F.verif.indexOf(verif(e)) < 0) return false;
    if (F.rentOnly && num(e.rent) == null) return false;
    if (F.editedOnly && !edited(b || e)) return false;
    return true;
  }
  function rows() { return all().map(function (b) { return { b: b, e: effOf(b) }; }); }
  function filtered() { return rows().filter(function (r) { return pass(r.e, r.b); }); }
  function active() { return !!(F.q || F.districts.length || F.classes.length || F.providers.length || F.verif.length || F.rentOnly || F.editedOnly); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(F)); } catch (e) {} }
  function load() { try { var s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') F = Object.assign(blank(), s); } catch (e) {} }

  function css() {
    if ($('geoBcCss')) return;
    var s = document.createElement('style'); s.id = 'geoBcCss'; s.textContent =
      '#bcSect .sbody{padding:6px 12px 12px}#bcQ{width:100%;box-sizing:border-box;font-size:12px;padding:7px 9px;border-radius:8px;border:1px solid var(--line,#e3dcd1)}'
      + '.bc-found{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted,#6f6a63);margin:6px 0 4px}.bc-found b{color:var(--ink,#1b1b1b);font-size:13px}.bc-found .sp{flex:1}'
      + '.bc-reset{border:0;background:none;color:#9E0000;font:600 11px inherit;cursor:pointer;padding:2px 4px}.bc-reset:disabled{color:var(--muted,#6f6a63);cursor:default;opacity:.6}'
      + '.bc-grp{margin:6px 0 2px}.bc-lab{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#6f6a63);margin-bottom:3px}'
      + '.bc-chips{display:flex;flex-wrap:wrap;gap:4px}.bc-chip{border:1px solid var(--line,#e3dcd1);background:#fff;border-radius:999px;padding:3px 9px;font:600 11px inherit;color:var(--ink,#1b1b1b);cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1.2}'
      + '.bc-chip i{font-style:normal;color:var(--muted,#6f6a63);font-weight:500}.bc-chip:hover{border-color:#c9bfb2}.bc-chip.on{background:#9E0000;border-color:#9E0000;color:#fff}.bc-chip.on i{color:#f3d9d9}'
      + '.bc-chip .dot{width:8px;height:8px;border-radius:50%;display:inline-block}'
      + '.bc-toggles{display:flex;flex-wrap:wrap;gap:4px 12px;margin:6px 0 4px;font-size:11px}'
      + '.bc-kpi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0 6px}.bc-kcard{background:#fff;border:1px solid var(--line,#e3dcd1);border-radius:9px;padding:7px 9px;min-width:0}'
      + '.bc-kcard b{display:block;font-size:15px;line-height:1.1;color:var(--ink,#1b1b1b)}.bc-kcard small{display:block;font-size:10px;color:var(--muted,#6f6a63);margin-top:2px;line-height:1.25}.bc-kcard.wide{grid-column:span 2}'
      + '.bc-bars{display:flex;gap:2px;height:8px;border-radius:4px;overflow:hidden;margin-top:5px}.bc-bars span{display:block;height:100%}'
      + '.bc-listhead{display:flex;align-items:center;gap:6px;margin:6px 0 4px}.bc-listhead button{border:1px solid var(--line,#e3dcd1);background:#fff;border-radius:8px;padding:5px 9px;font:700 11px inherit;cursor:pointer}.bc-listhead select{font-size:11px;padding:4px 6px;flex:1;min-width:0}'
      + '.bc-list{max-height:42vh;overflow:auto;border:1px solid var(--line,#e3dcd1);border-radius:9px;background:#fff}.bc-list.off{display:none}'
      + '.bc-item{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--line-2,#eee9e1);cursor:pointer}.bc-item:last-child{border-bottom:0}.bc-item:hover{background:var(--paper-2,#f3f1ee)}.bc-item.sel{background:#fbeeee}'
      + '.bc-item .bc-main{flex:1;min-width:0}.bc-item b{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bc-item small{display:block;font-size:10px;color:var(--muted,#6f6a63);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
      + '.bc-item .bc-cls{display:inline-block;min-width:22px;text-align:center;border-radius:5px;padding:1px 4px;font:700 10px inherit;color:#fff}.bc-item .bc-ed{color:#e6a700;font-weight:700}'
      + '.bc-item .bc-act{display:flex;gap:2px}.bc-item .bc-act button{width:26px;height:26px;border:1px solid var(--line,#e3dcd1);background:#fff;border-radius:7px;cursor:pointer;font-size:12px;padding:0}.bc-item .bc-act button:hover{border-color:#9E0000;color:#9E0000}'
      + '.bc-item input[type=checkbox]{margin:0}'
      + '.bc-more{display:block;width:100%;border:0;background:var(--paper-2,#f3f1ee);padding:7px;font:600 11px inherit;cursor:pointer;color:var(--ink,#1b1b1b)}'
      + '.bc-empty{padding:12px;font-size:11.5px;color:var(--muted,#6f6a63);text-align:center}'
      + '.bc-cmpbar{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:11px;color:var(--muted,#6f6a63)}.bc-cmpbar button{border:1px solid #9E0000;background:#9E0000;color:#fff;border-radius:8px;padding:5px 10px;font:700 11px inherit;cursor:pointer}.bc-cmpbar button.sec{background:#fff;color:#9E0000}.bc-cmpbar button:disabled{opacity:.4;cursor:default}'
      + '.bc-cmp{font-size:12px}.bc-cmp .ch{display:flex;align-items:center;gap:8px;margin-bottom:8px}.bc-cmp .ch b{flex:1;font-size:14px}.bc-cmp table{border-collapse:collapse;width:100%}.bc-cmp th,.bc-cmp td{border-bottom:1px solid var(--line-2,#eee9e1);padding:5px 7px;text-align:left;vertical-align:top;font-size:11.5px}'
      + '.bc-cmp th{background:var(--paper,#faf8f5);font-size:11px}.bc-cmp th.col{min-width:120px}.bc-cmp td.lab{color:var(--muted,#6f6a63);white-space:nowrap}.bc-cmp td.empty{color:#c9c1b4}.bc-cmp td.best{font-weight:700;color:#0d7a6f}'
      + '.bc-cmp .rm{border:0;background:none;color:#9E0000;cursor:pointer;font:700 11px inherit;padding:0 2px}.bc-cmp .foot{margin-top:8px;font-size:10.5px;color:var(--muted,#6f6a63)}.bc-cmp .btns{display:flex;gap:6px;margin-top:10px}.bc-cmp .btns .btn{font-size:11px}'
      + '.bc-heatleg{margin-top:6px}.bc-heatleg .ramp{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:3px 0}.bc-heatleg .ramp span{flex:1}.bc-heatleg .lbl{display:flex;justify-content:space-between;font-size:9.5px;color:var(--muted,#6f6a63)}'
      + '#card.bc-cmp-open{width:min(820px,96vw)!important;max-width:96vw!important}';
    document.head.appendChild(s);
  }

  /* --- секция в левой панели ------------------------------------------------------------- */
  function layersSection() { var hs = document.querySelectorAll('.left>.sect>h3'); for (var i = 0; i < hs.length; i++) if (/слои и стиль/i.test(hs[i].textContent)) return hs[i].parentNode; return null; }
  function mount() {
    if ($('bcSect')) return true;
    var anchor = layersSection(); if (!anchor || !all().length) return false;
    var sect = document.createElement('div'); sect.className = 'sect'; sect.id = 'bcSect';
    sect.innerHTML = '<h3 id="bcH">Бизнес-центры</h3><div class="sbody">'
      + '<input type="search" id="bcQ" placeholder="Название, адрес, район" aria-label="Поиск бизнес-центра" autocomplete="off">'
      + '<div class="bc-found">найдено <b id="bcFound">0</b> из <span id="bcTotal">0</span><span class="sp"></span><button type="button" class="bc-reset" id="bcReset" disabled>сбросить</button></div>'
      + '<div class="bc-grp"><span class="bc-lab">Район</span><div class="bc-chips" id="bcFDist"></div></div>'
      + '<div class="bc-grp"><span class="bc-lab">Класс</span><div class="bc-chips" id="bcFClass"></div></div>'
      + '<div class="bc-grp"><span class="bc-lab">Источник и проверка</span><div class="bc-chips" id="bcFProv"></div></div>'
      + '<div class="bc-toggles"><label class="ck"><input type="checkbox" id="bcRentOnly"> только с известной ставкой</label><label class="ck"><input type="checkbox" id="bcEditedOnly"> только с правками</label></div>'
      + '<div class="bc-kpi" id="bcKpi"></div>'
      + '<div class="bc-listhead"><button type="button" id="bcListBtn" aria-expanded="true">Список ▾</button><select id="bcSort" aria-label="Порядок списка"><option value="name">по имени</option><option value="dist">по расстоянию до точки</option><option value="rent">по ставке</option><option value="class">по классу</option></select></div>'
      + '<div class="bc-list" id="bcList"></div>'
      + '<div class="bc-cmpbar" id="bcCmpBar"></div>'
      + '</div>';
    anchor.parentNode.insertBefore(sect, anchor);
    var h3 = sect.querySelector('h3');
    h3.style.cursor = 'pointer';
    h3.addEventListener('click', function () { var closed = sect.classList.toggle('closed'); try { localStorage.setItem(KEY_SECT, closed ? '0' : '1'); } catch (e) {} });
    try { if (localStorage.getItem(KEY_SECT) === '0') sect.classList.add('closed'); } catch (e) {}
    bind();
    buildChips();
    syncControls();
    return true;
  }
  function chip(v, label, n, on, extra) { return '<button type="button" class="bc-chip' + (on ? ' on' : '') + '" data-v="' + esc(v) + '">' + (extra || '') + esc(label) + '<i>' + n + '</i></button>'; }
  function buildChips() {
    var rs = rows(), byD = {}, byP = {}, byC = {}, nv = { online: 0, needs_review: 0 };
    rs.forEach(function (r) { var e = r.e; byD[e.district || ''] = (byD[e.district || ''] || 0) + 1; byP[e.provider || ''] = (byP[e.provider || ''] || 0) + 1; var c = cls(e) || 'none'; byC[c] = (byC[c] || 0) + 1; nv[verif(e)]++; });
    var dists = Object.keys(byD).filter(Boolean).sort(function (a, b) { return byD[b] - byD[a]; });
    $('bcFDist').innerHTML = dists.map(function (d) { return chip(d, d, byD[d], F.districts.indexOf(d) >= 0); }).join('');
    $('bcFClass').innerHTML = CLASSES.concat(['none']).map(function (c) { return chip(c, c === 'none' ? 'без класса' : c, byC[c] || 0, F.classes.indexOf(c) >= 0, '<span class="dot" style="background:' + CLASS_COL[c] + '"></span>'); }).join('');
    var provs = Object.keys(byP).filter(Boolean).sort(function (a, b) { return byP[b] - byP[a]; });
    $('bcFProv').innerHTML = provs.map(function (p) { return chip(p, p, byP[p], F.providers.indexOf(p) >= 0); }).join('')
      + chip('v:online', 'онлайн', nv.online, F.verif.indexOf('online') >= 0) + chip('v:needs_review', 'нужна проверка', nv.needs_review, F.verif.indexOf('needs_review') >= 0);
  }
  function toggleIn(arr, v) { var i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
  function bind() {
    $('bcQ').addEventListener('input', function () { F.q = this.value.trim(); apply(); });
    $('bcReset').addEventListener('click', function () { F = blank(); $('bcQ').value = ''; apply(); });
    $('bcRentOnly').addEventListener('change', function () { F.rentOnly = this.checked; apply(); });
    $('bcEditedOnly').addEventListener('change', function () { F.editedOnly = this.checked; apply(); });
    $('bcFDist').addEventListener('click', function (e) { var c = e.target.closest('.bc-chip'); if (!c) return; toggleIn(F.districts, c.getAttribute('data-v')); apply(); });
    $('bcFClass').addEventListener('click', function (e) { var c = e.target.closest('.bc-chip'); if (!c) return; toggleIn(F.classes, c.getAttribute('data-v')); apply(); });
    $('bcFProv').addEventListener('click', function (e) { var c = e.target.closest('.bc-chip'); if (!c) return; var v = c.getAttribute('data-v'); if (v.indexOf('v:') === 0) toggleIn(F.verif, v.slice(2)); else toggleIn(F.providers, v); apply(); });
    $('bcListBtn').addEventListener('click', function () { listOn = !listOn; $('bcList').classList.toggle('off', !listOn); this.textContent = listOn ? 'Список ▾' : 'Список ▸'; this.setAttribute('aria-expanded', listOn ? 'true' : 'false'); });
    $('bcSort').addEventListener('change', function () { sortBy = this.value; shown = PAGE; renderList(); });
    $('bcList').addEventListener('click', function (e) {
      var more = e.target.closest('.bc-more'); if (more) { shown += PAGE; renderList(); return; }
      var it = e.target.closest('.bc-item'); if (!it) return;
      var id = +it.getAttribute('data-id');
      if (e.target.closest('input[type=checkbox]')) { toggleCompare(id); return; }
      var act = e.target.closest('[data-act]');
      if (act && act.getAttribute('data-act') === 'card') { try { openCard(id); } catch (x) {} return; }
      showOnMap(id);
    });
    $('bcCmpBar').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; if (b.id === 'bcCmpOpen') openCompare(); if (b.id === 'bcCmpClear') { CMP = []; renderList(); renderCmpBar(); } });
  }
  function syncControls() {
    if (!$('bcQ')) return;
    $('bcQ').value = F.q; $('bcRentOnly').checked = F.rentOnly; $('bcEditedOnly').checked = F.editedOnly;
    ['bcFDist', 'bcFClass', 'bcFProv'].forEach(function (id) { [].slice.call($(id).querySelectorAll('.bc-chip')).forEach(function (c) { var v = c.getAttribute('data-v'); var on = id === 'bcFDist' ? F.districts.indexOf(v) >= 0 : id === 'bcFClass' ? F.classes.indexOf(v) >= 0 : (v.indexOf('v:') === 0 ? F.verif.indexOf(v.slice(2)) >= 0 : F.providers.indexOf(v) >= 0); c.classList.toggle('on', on); }); });
    $('bcReset').disabled = !active();
  }

  /* --- применение: карта, кольца, список, показатели, тепловая карта -------------------- */
  function apply() {
    save(); shown = PAGE; syncControls();
    try { renderBC(); } catch (e) {}
    try { catchSummary(); } catch (e) {}
    renderAll();
    if (gHeat && $('lRentHeat') && $('lRentHeat').checked) drawHeat();
  }
  function renderAll() { if (!$('bcSect')) return; var rs = filtered(); $('bcFound').textContent = rs.length; $('bcTotal').textContent = all().length; renderKpi(rs); renderList(rs); renderCmpBar(); }
  function schedule() { clearTimeout(tmr); tmr = setTimeout(renderAll, 80); }

  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function renderKpi(rs) {
    var n = rs.length, byC = {}, withC = 0, rents = [], glas = [], ed = 0, src = {};
    rs.forEach(function (r) { var e = r.e, c = cls(e); if (c) { withC++; byC[c] = (byC[c] || 0) + 1; } var rv = num(e.rent); if (rv != null) rents.push(rv); var g = num(e.gla); if (g != null) glas.push(g); if (edited(r.b)) ed++; src[e.provider || 'прочее'] = (src[e.provider || 'прочее'] || 0) + 1; });
    var bars = withC ? '<div class="bc-bars" title="доли классов среди объектов с известным классом">' + CLASSES.map(function (c) { return byC[c] ? '<span style="width:' + (byC[c] / withC * 100) + '%;background:' + CLASS_COL[c] + '" title="' + c + ': ' + byC[c] + '"></span>' : ''; }).join('') + '</div>' : '';
    var h = '<div class="bc-kcard"><b>' + n + '</b><small>объектов в выборке' + (active() ? ' из ' + all().length : '') + '</small></div>'
      + '<div class="bc-kcard"><b>' + withC + '</b><small>класс известен' + (withC ? ': ' + CLASSES.filter(function (c) { return byC[c]; }).map(function (c) { return c + ' ' + byC[c]; }).join(', ') : '') + '</small>' + bars + '</div>'
      + '<div class="bc-kcard"><b>' + (rents.length ? '$' + fmt(median(rents)) : '-') + '</b><small>медиана ставки, $/м²/мес · известна у ' + rents.length + ' из ' + n + (rents.length ? ' · ' + fmt(Math.min.apply(null, rents)) + '..' + fmt(Math.max.apply(null, rents)) : '') + '</small></div>'
      + '<div class="bc-kcard"><b>' + (glas.length ? fmt(glas.reduce(function (s, v) { return s + v; }, 0)) : '-') + '</b><small>GLA, м² · известна у ' + glas.length + ' из ' + n + '</small></div>'
      + '<div class="bc-kcard wide"><b>' + Object.keys(src).sort(function (a, b) { return src[b] - src[a]; }).map(function (k) { return esc(k) + ' ' + src[k]; }).join(' · ') + '</b><small>источники записей · правок CASE: ' + ed + '. Пусто значит «нет данных», не ноль.</small></div>';
    $('bcKpi').innerHTML = h;
  }
  function sorted(rs) {
    var s = rs.slice();
    if (sortBy === 'dist' && point()) s.sort(function (a, b) { var x = distKm(a.e), y = distKm(b.e); return (x == null ? 1e9 : x) - (y == null ? 1e9 : y); });
    else if (sortBy === 'rent') s.sort(function (a, b) { var x = num(a.e.rent), y = num(b.e.rent); return (y == null ? -1 : y) - (x == null ? -1 : x); });
    else if (sortBy === 'class') s.sort(function (a, b) { var x = CLASSES.indexOf(cls(a.e)), y = CLASSES.indexOf(cls(b.e)); return (x < 0 ? 9 : x) - (y < 0 ? 9 : y) || String(a.e.name).localeCompare(String(b.e.name), 'ru'); });
    else s.sort(function (a, b) { return String(a.e.name).localeCompare(String(b.e.name), 'ru'); });
    return s;
  }
  function renderList(rs) {
    var box = $('bcList'); if (!box) return;
    rs = rs || filtered();
    if (!rs.length) { box.innerHTML = '<div class="bc-empty">Ничего не найдено: ослабьте фильтры.</div>'; return; }
    var s = sorted(rs), h = '';
    s.slice(0, shown).forEach(function (r) {
      var e = r.e, c = cls(e), d = distKm(e), rv = num(e.rent);
      h += '<div class="bc-item' + (CMP.indexOf(r.b.id) >= 0 ? ' sel' : '') + '" data-id="' + r.b.id + '" title="клик: показать на карте">'
        + '<input type="checkbox" aria-label="в сравнение" title="в сравнение (до четырёх)"' + (CMP.indexOf(r.b.id) >= 0 ? ' checked' : '') + '>'
        + '<div class="bc-main"><b>' + (c ? '<span class="bc-cls" style="background:' + (CLASS_COL[c] || '#888') + '">' + esc(c) + '</span> ' : '') + esc(e.name) + (edited(r.b) ? ' <span class="bc-ed" title="есть правки CASE">✎</span>' : '') + '</b>'
        + '<small>' + esc([e.district, e.provider, d != null ? fmtKm(d) + ' от точки' : ''].filter(Boolean).join(' · ')) + '</small>'
        + (rv != null ? '<small>ставка $' + fmt(rv) + '/м²/мес' + (e.psrc ? ' · ' + esc(e.psrc) : '') + (e.pdate ? ' · ' + esc(e.pdate) : '') + '</small>' : '')
        + '</div><div class="bc-act"><button type="button" data-act="card" title="карточка БЦ" aria-label="карточка">✎</button></div></div>';
    });
    if (s.length > shown) h += '<button type="button" class="bc-more">показать ещё ' + Math.min(PAGE, s.length - shown) + ' из ' + (s.length - shown) + '</button>';
    box.innerHTML = h;
  }
  function showOnMap(id) {
    var M = theMap(), b = all()[id]; if (!M || !b) return;
    var e = effOf(b); if (e.lat == null) return;
    var la = +e.lat, ln = +e.lng;
    try { M.setView([la, ln], Math.max(M.getZoom(), 16)); } catch (x) {}
    try { markSel(la, ln); } catch (x) {}
    try {
      var found = null; if (typeof gBC !== 'undefined' && gBC) gBC.eachLayer(function (l) { if (!found && l.getLatLng) { var p = l.getLatLng(); if (Math.abs(p.lat - la) < 1e-7 && Math.abs(p.lng - ln) < 1e-7) found = l; } });
      if (found) { if (gBC.zoomToShowLayer) gBC.zoomToShowLayer(found, function () { found.openPopup(); }); else found.openPopup(); }
    } catch (x) {}
    [].slice.call(document.querySelectorAll('.bc-item')).forEach(function (it) { it.classList.toggle('sel', +it.getAttribute('data-id') === id || CMP.indexOf(+it.getAttribute('data-id')) >= 0); });
  }

  /* --- сравнение ---------------------------------------------------------------------------- */
  function toggleCompare(id) {
    var i = CMP.indexOf(id);
    if (i >= 0) CMP.splice(i, 1); else { if (CMP.length >= 4) { toast('В сравнении не больше четырёх БЦ'); syncCompareMarks(); return; } CMP.push(id); }
    syncCompareMarks(); renderCmpBar();
  }
  /* отметки в списке правим на месте: перерисовка списка сбивала прокрутку и второй клик подряд */
  function syncCompareMarks() { [].slice.call(document.querySelectorAll('.bc-item')).forEach(function (it) { var id = +it.getAttribute('data-id'), on = CMP.indexOf(id) >= 0, cb = it.querySelector('input[type=checkbox]'); if (cb) cb.checked = on; it.classList.toggle('sel', on); }); }
  function renderCmpBar() { var bar = $('bcCmpBar'); if (!bar) return; bar.innerHTML = '<button type="button" id="bcCmpOpen"' + (CMP.length < 2 ? ' disabled' : '') + '>Сравнить (' + CMP.length + ')</button><button type="button" class="sec" id="bcCmpClear"' + (CMP.length ? '' : ' disabled') + '>очистить</button><span>отметьте до четырёх БЦ в списке</span>'; }
  var CMP_FIELDS = [['Класс', 'class'], ['Район', 'district'], ['Адрес', 'address'], ['Этажей', 'floors', 'n'], ['GLA, м²', 'gla', 'n'], ['GBA, м²', 'gba', 'n'], ['Парковка, мест', 'parking', 'n'], ['Год постройки', 'year', 'n'], ['Ставка, $/м²/мес', 'rent', 'n', 'low'], ['Свободно, м²', 'avail', 'n'], ['Продажа, $/м²', 'sale', 'n'], ['Источник цены', 'psrc'], ['Дата цены', 'pdate'], ['Рейтинг', 'rating', 'n', 'high'], ['Отзывов', 'reviews', 'n', 'high'], ['Источник записи', 'provider'], ['Проверка', '_verification'], ['До точки анализа', '__dist'], ['Комментарий CASE', 'comment']];
  function openCompare() {
    var card = $('card'), bg = $('cardbg'); if (!card || !bg || CMP.length < 2) return;
    var items = CMP.map(function (id) { return all()[id]; }).filter(Boolean).map(function (b) { return { b: b, e: effOf(b) }; });
    var h = '<div class="bc-cmp"><div class="ch"><b>Сравнение бизнес-центров</b><button type="button" class="btn sec" onclick="closeCard()">✕</button></div><div class="body"><table><thead><tr><th></th>'
      + items.map(function (it) { return '<th class="col">' + esc(it.e.name) + ' <button type="button" class="rm" data-rm="' + it.b.id + '" title="убрать из сравнения">✕</button></th>'; }).join('') + '</tr></thead><tbody>';
    CMP_FIELDS.forEach(function (f) {
      var vals = items.map(function (it) { if (f[1] === '__dist') { var d = distKm(it.e); return d == null ? null : fmtKm(d); } var v = it.e[f[1]]; if (f[1] === '_verification') v = v === 'needs_review' ? 'нужна проверка' : (v ? 'онлайн' : ''); return v == null || String(v).trim() === '' ? null : String(v); });
      if (vals.every(function (v) { return v == null; })) return;
      var best = -1;
      if (f[2] === 'n' && f[3]) { var nums = vals.map(function (v) { return num(v); }); var cand = nums.map(function (v, i) { return v == null ? null : i; }).filter(function (i) { return i != null; }); if (cand.length > 1) { best = cand[0]; cand.forEach(function (i) { if (f[3] === 'low' ? nums[i] < nums[best] : nums[i] > nums[best]) best = i; }); } }
      h += '<tr><td class="lab">' + esc(f[0]) + '</td>' + vals.map(function (v, i) { return v == null ? '<td class="empty">нет данных</td>' : '<td' + (i === best ? ' class="best"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>';
    });
    h += '</tbody></table><div class="foot">Пустая ячейка значит «нет данных», не ноль. Выделено лучшее значение среди известных: ниже ставка, выше рейтинг. Значения из мастер-базы CASE с правками команды; источник и дата цены указаны построчно.</div>'
      + '<div class="btns"><button type="button" class="btn sec" onclick="closeCard()">Закрыть</button><button type="button" class="btn sec" id="bcCmpCsv">⤓ CSV</button></div></div></div>';
    card.innerHTML = h; card.classList.add('open', 'bc-cmp-open'); bg.classList.add('open');
    card.querySelector('.bc-cmp').addEventListener('click', function (e) { var rm = e.target.closest('[data-rm]'); if (rm) { toggleCompare(+rm.getAttribute('data-rm')); if (CMP.length >= 2) openCompare(); else closeCard(); } });
    var csv = $('bcCmpCsv'); if (csv) csv.onclick = function () { exportCompare(items); };
  }
  function exportCompare(items) {
    var lines = [['Показатель'].concat(items.map(function (it) { return it.e.name; }))];
    CMP_FIELDS.forEach(function (f) { lines.push([f[0]].concat(items.map(function (it) { if (f[1] === '__dist') { var d = distKm(it.e); return d == null ? '' : fmtKm(d); } var v = it.e[f[1]]; return v == null ? '' : String(v); }))); });
    var txt = lines.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    try { var blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'CASE_сравнение_БЦ.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { toast('Браузер не дал сохранить файл'); }
  }

  /* --- тепловая карта ставок ------------------------------------------------------------------ */
  function heatRow() {
    var cat = document.querySelector('.geo-cat[data-cat="Бизнес-центры"] .geo-cat-body') || (function () { var t = [].slice.call(document.querySelectorAll('.geo-cat-title')).filter(function (x) { return /бизнес-центры/i.test(x.textContent); })[0]; return t ? t.parentNode : null; })();
    if (!cat || $('lRentHeat')) return !!$('lRentHeat');
    var row = document.createElement('div'); row.className = 'styrow'; row.innerHTML = '<label class="ck"><input type="checkbox" id="lRentHeat"> Тепловая карта ставок (известные значения)</label>';
    var srcRow = cat.querySelector('#bcBySrc') ? cat.querySelector('#bcBySrc').closest('.styrow') : null;
    if (srcRow && srcRow.nextSibling) cat.insertBefore(row, srcRow.nextSibling); else cat.appendChild(row);
    $('lRentHeat').addEventListener('change', function () { if (this.checked) drawHeat(); else clearHeat(); });
    return true;
  }
  function cellsOf(rs) {
    var dLat = CELL_M / 111320, out = {};
    rs.forEach(function (r) { var e = r.e, v = num(e.rent); if (v == null || e.lat == null || e.lng == null) return; var la = +e.lat, ln = +e.lng, dLng = CELL_M / (111320 * Math.cos(la * Math.PI / 180)); var ky = Math.floor(la / dLat), kx = Math.floor(ln / dLng), k = ky + '_' + kx; if (!out[k]) out[k] = { la0: ky * dLat, ln0: kx * dLng, la1: (ky + 1) * dLat, ln1: (kx + 1) * dLng, sum: 0, n: 0 }; out[k].sum += v; out[k].n++; });
    return Object.keys(out).map(function (k) { var c = out[k]; c.mean = c.sum / c.n; return c; });
  }
  function drawHeat() {
    var M = theMap(); if (!M) return;
    if (!gHeat) gHeat = L.layerGroup().addTo(M);
    gHeat.clearLayers();
    var cells = cellsOf(filtered());
    if (!cells.length) { toast('В выборке нет БЦ с известной ставкой'); heatLegend(null); return; }
    var mn = Math.min.apply(null, cells.map(function (c) { return c.mean; })), mx = Math.max.apply(null, cells.map(function (c) { return c.mean; }));
    cells.forEach(function (c) { var t = mx > mn ? (c.mean - mn) / (mx - mn) : .5, col = RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))]; L.rectangle([[c.la0, c.ln0], [c.la1, c.ln1]], { color: col, weight: 1, fillColor: col, fillOpacity: .45, interactive: true }).addTo(gHeat).bindTooltip('средняя ставка $' + fmt(c.mean) + '/м²/мес · ' + c.n + ' БЦ с известной ценой', { sticky: true }); });
    heatLegend({ mn: mn, mx: mx, n: cells.length });
  }
  function clearHeat() { if (gHeat) gHeat.clearLayers(); heatLegend(null); }
  function heatLegend(info) {
    var lg = $('mlgd'), body = lg && lg.querySelector('.body'); if (!body) return;
    var el = $('bcHeatLeg');
    if (!info) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'bcHeatLeg'; el.className = 'bc-heatleg'; body.appendChild(el); }
    el.innerHTML = '<div class="grp2">Ставки БЦ · ' + info.n + ' ячеек по ' + CELL_M + ' м</div><div class="ramp">' + RAMP.map(function (c) { return '<span style="background:' + c + '"></span>'; }).join('') + '</div><div class="lbl"><span>$' + fmt(info.mn) + '</span><span>$' + fmt(info.mx) + ' /м²/мес</span></div>';
  }

  /* --- служебное ------------------------------------------------------------------------------ */
  var toastT = null;
  function toast(msg) { var t = $('geoToast'); if (t) { t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2800); } }
  function hooks() {
    ['saveCard', 'resetCard'].forEach(function (n) { var o = window[n]; if (typeof o === 'function' && !o._bc) { var w = function () { var r = o.apply(this, arguments); schedule(); return r; }; w._bc = true; window[n] = w; } });
    var rp = window.renderProj; if (typeof rp === 'function' && !rp._bc) { var w2 = function () { var r = rp.apply(this, arguments); schedule(); return r; }; w2._bc = true; window.renderProj = w2; }
    var cc = window.closeCard; if (typeof cc === 'function' && !cc._bc) { var w3 = function () { var c = $('card'); if (c) c.classList.remove('bc-cmp-open'); return cc.apply(this, arguments); }; w3._bc = true; window.closeCard = w3; }
    var ul = window.updateLegend; if (typeof ul === 'function' && !ul._bc) { var w4 = function () { var r = ul.apply(this, arguments); if ($('lRentHeat') && $('lRentHeat').checked && gHeat && gHeat.getLayers().length) { var cells = cellsOf(filtered()); if (cells.length) heatLegend({ mn: Math.min.apply(null, cells.map(function (c) { return c.mean; })), mx: Math.max.apply(null, cells.map(function (c) { return c.mean; })), n: cells.length }); } return r; }; w4._bc = true; window.updateLegend = w4; }
  }
  function install() {
    css(); load();
    var tries = 0;
    (function tick() {
      var ok = mount(); heatRow();
      if (ok) { hooks(); apply(); return; }
      if (++tries < 80) setTimeout(tick, 250);
    })();
  }
  B.pass = pass; B.filters = function () { return JSON.parse(JSON.stringify(F)); }; B.set = function (patch) { Object.keys(patch || {}).forEach(function (k) { F[k] = patch[k]; }); if ($('bcQ')) $('bcQ').value = F.q || ''; apply(); }; B.reset = function () { F = blank(); if ($('bcQ')) $('bcQ').value = ''; apply(); };
  B.filtered = function () { return filtered().map(function (r) { return r.e; }); }; B.compare = function () { return CMP.slice(); }; B.toggleCompare = toggleCompare; B.openCompare = openCompare; B.showOnMap = showOnMap; B.heat = function (on) { var cb = $('lRentHeat'); if (cb) { cb.checked = !!on; cb.dispatchEvent(new Event('change', { bubbles: true })); } }; B.cells = function () { return cellsOf(filtered()); }; B.refresh = renderAll;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {}; window.CASE_MODULE_VERSIONS['v4760-geo-bc'] = '4.76.0';
