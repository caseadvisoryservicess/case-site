/* CASE OS v4.57.1 — выгрузка геоаналитики по проекту: PDF · Excel · PowerPoint.
 *
 * Запрос владельца: «поставили наш новый проект на карту, проверили данные проекта,
 * конкурентную среду, население — и одной кнопкой выгрузили PDF, Excel, PPTX
 * с готовым презентационным видом».
 *
 * Почему всё собирается здесь, а не библиотекой: интернет в Ташкенте у сервисов
 * работает через раз, а CSP системы не пускает сторонние скрипты. .xlsx и .pptx —
 * это ZIP с XML внутри, и собрать их вручную надёжнее, чем зависеть от CDN.
 *
 * Числа берутся из LASTPROBE — того самого отчёта по точке, который виден на экране.
 * Второй раз ничего не пересчитывается: выгрузка не может разойтись с картой.
 */
(function () {
  'use strict';
  var VERSION = '4.58.0';   /* единственный источник версии модуля — см. регистрацию в конце файла */

  /* ================= ZIP без сжатия (method 0) =================
     Сжатие нам не нужно: файлы небольшие, а deflate в браузере без библиотеки
     потребовал бы CompressionStream, который есть не везде. */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) { var c = i; for (var j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[i] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function zipDate(d) {
    var time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time: time, date: date };
  }
  function zipBuild(files) {
    var now = zipDate(new Date()), parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var name = utf8(f.name), data = (f.data instanceof Uint8Array) ? f.data : utf8(f.data);
      var crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, now.time, true); lh.setUint16(12, now.date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, now.time, true); ch.setUint16(14, now.date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (n, p) { return n + p.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (n, p) { return n + p.length; }, 0);
    var out = new Uint8Array(total), pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }
  function saveBlob(bytes, name, mime) {
    var b = new Blob([bytes], { type: mime });
    var u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 1500);
  }
  /* v4.58.0: выгрузки собираются строками и минуют DOM, поэтому экранный нормализатор
     тире (v4450-ux-system.js) до содержимого .xlsx/.pptx/PDF не дотягивается, хотя
     требование «короткое тире» распространялось и на презентацию. Нормализуем сами —
     только подписи и текстовые ячейки; числовые ячейки идут мимо (см. sheetXml). */
  function dsh(v) {
    var s = String(v == null ? '' : v), solo = s.match(/^(\s*)[—–](\s*)$/);
    if (solo) return solo[1] + '-' + solo[2];
    return s.replace(/(\d)\s*[—–]\s*(?=\d)/g, '$1-')
            .replace(/(\S)\s*[—–]\s*(?=\S)/g, '$1 - ')
            .replace(/\s*[—–]\s*/g, '-');
  }
  /* PDF печатается в отдельном окне, куда экранный нормализатор тоже не попадает */
  function dshDoc(doc) {
    try {
      var w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null), n, list = [];
      while ((n = w.nextNode())) if (/[—–]/.test(n.nodeValue || '')) list.push(n);
      list.forEach(function (x) { x.nodeValue = dsh(x.nodeValue); });
      if (/[—–]/.test(doc.title || '')) doc.title = dsh(doc.title);
    } catch (e) {}
  }
  /* v4.58.0: (parseFloat(x)||x) ломал две записи — «15-35» превращалось в 15 (диапазон ставки
     терялся), а «0» уходило в файл текстом. Число ставим числом, только если вся строка — число. */
  function cellNum(v) {
    if (v === '' || v == null) return '-';
    var t = String(v).trim();
    if (/^-?\d+(?:[.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
    return t;
  }
  function xe(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      /* v4.58.0: было /\x00-\x08|\x0b|\x0c|\x0e-\x1f/ — вне квадратных скобок это не диапазоны,
         а буквальные строки, поэтому управляющие символы из имён OSM доходили до XML и Excel
         открывал файл «с восстановлением». Настоящий класс символов: */
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  /* ================= данные отчёта ================= */
  function probe() { return (typeof LASTPROBE === 'object' && LASTPROBE) ? LASTPROBE : null; }
  function need() {
    var p = probe();
    if (!p || !p.table) { alert('Сначала откройте отчёт по точке: кнопка «Аналитика по проекту» или клик по карте.'); return null; }
    return p;
  }
  /* Имя файла — латиницей. Проверено: браузер выбрасывает кириллицу из атрибута
     download, и файл сохраняется как «download» вообще без расширения — открыть
     его двойным щелчком уже нельзя. Название проекта транслитерируем, чтобы оно
     оставалось узнаваемым. */
  var TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h',
    ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  function lat(s) {
    return String(s || '').split('').map(function (c) {
      var low = c.toLowerCase(), t = TRANSLIT[low];
      if (t == null) return c;
      return (c === low) ? t : (t.charAt(0).toUpperCase() + t.slice(1));
    }).join('');
  }
  function fname(p, ext) {
    var base = lat(p.project || '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
    return 'CASE_OS_geo_' + (base || 'point') + '_' + new Date().toISOString().slice(0, 10) + '.' + ext;
  }
  /* ================= настройки выгрузки =================
     Запрос владельца: «каждый проект уникален и имеет свою настройку». Поэтому
     набор разделов, радиусы и эталоны конкуренции хранятся ОТДЕЛЬНО ПО КАЖДОМУ
     проекту: у бизнес-центра и у клиники разные конкуренты и разные пороги
     насыщения, и общая настройка на всех давала бы неверный скоринг. */
  var CFG_LS = 'caseos_export_cfg';
  var CFG_DEF = {
    radii: '500,1000,1500,2000,3000',
    parts: { pop: true, districts: true, allDistricts: true, radii: true, bc: true,
             med: true, poi: true, metro: true, market: true, scoring: true, map: true,
             comp: true, rentChart: true },
    bcLimit: 60, bcRadius: 3000, detailRadius: 1000,
    compRadius: 5000, compLimit: 20,
    compCats: { bc: true, shopping: true, markets: true, street_retail: false, hotels: false },
    /* эталоны конкуренции: сколько объектов на километр считается насыщением */
    bench: { bc: 6, med: 8, fnb: 25, edu: 5 },
    demandPop: 25000,
    formats: { xlsx: true, pptx: true, pdf: true }
  };
  function cfgKey() {
    var sel = document.getElementById('proj');
    return CFG_LS + '_' + ((sel && sel.value) || 'default');
  }
  function cfgLoad() {
    var out = JSON.parse(JSON.stringify(CFG_DEF));
    try {
      var raw = JSON.parse(localStorage.getItem(cfgKey()) || 'null');
      if (raw && typeof raw === 'object') {
        if (raw.radii) out.radii = raw.radii;
        ['bcLimit', 'bcRadius', 'detailRadius', 'demandPop'].forEach(function (k) { if (raw[k] != null) out[k] = raw[k]; });
        ['compRadius', 'compLimit'].forEach(function (k) { if (raw[k] != null) out[k] = raw[k]; });
        ['parts', 'bench', 'formats', 'compCats'].forEach(function (g) {
          if (raw[g]) Object.keys(out[g]).forEach(function (k) { if (raw[g][k] != null) out[g][k] = raw[g][k]; });
        });
      }
    } catch (e) {}
    return out;
  }
  function cfgSave(c) { try { localStorage.setItem(cfgKey(), JSON.stringify(c)); } catch (e) {} }
  function radiiOf(c) {
    var a = String(c.radii || '').split(',').map(function (x) { return parseInt(x, 10); })
      .filter(function (x) { return x > 0 && x <= 20000; });
    return a.length ? a.sort(function (x, y) { return x - y; }) : [500, 1000, 1500, 2000, 3000];
  }
  var PART_LABELS = [
    ['pop', 'Население: плотность и прирост по кольцам'],
    ['districts', 'Разрез населения по районам города'],
    ['allDistricts', 'Справочник районов Ташкента'],
    ['radii', 'Сводная таблица окружения по радиусам'],
    ['bc', 'Бизнес-центры: список конкурентов и ставки'],
    ['med', 'Медицина по направлениям'],
    ['poi', 'Городские объекты по слоям'],
    ['metro', 'Метро и пешая доступность'],
    ['market', 'Рынок города (OLX, uybor)'],
    ['comp', 'Конкуренты: карточки (тип, GBA, GLA, точки, ставка)'],
    ['rentChart', 'График «Заявленные ставки» в презентации'],
    ['scoring', 'Скоринг локации'],
    ['map', 'Снимок карты в презентации']
  ];
  var BENCH_LABELS = [['bc', 'бизнес-центров'], ['med', 'клиник'], ['fnb', 'заведений F&B'], ['edu', 'учебных центров']];

  window.caseGeoExportSettings = function (thenExport) {
    var c = cfgLoad(), sel = document.getElementById('proj');
    var pname = (sel && sel.options[sel.selectedIndex]) ? sel.options[sel.selectedIndex].text : 'проект';
    var wrap = document.getElementById('caseExpCfg');
    if (wrap) wrap.remove();
    wrap = document.createElement('div');
    wrap.id = 'caseExpCfg';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:4000;background:rgba(0,0,0,.35);display:flex;'
      + 'align-items:center;justify-content:center;padding:20px';
    wrap.innerHTML = '<div style="background:#fff;border-radius:10px;max-width:660px;width:100%;max-height:88vh;'
      + 'overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);font:13px/1.5 Montserrat,Arial,sans-serif">'
      + '<div style="padding:14px 18px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px">'
      + '<b style="flex:1">Что выгружать по проекту «' + xe(pname) + '»</b>'
      + '<span id="caseExpX" style="cursor:pointer;color:#6b7280;font-size:18px">✕</span></div>'
      + '<div style="padding:14px 18px">'
      + '<div style="color:#6b7280;margin-bottom:10px">Настройка своя у каждого проекта и запоминается — '
      + 'у бизнес-центра и у клиники разные конкуренты и разные пороги насыщения.</div>'
      + '<div style="font-weight:700;margin:10px 0 4px">Разделы отчёта</div>'
      + PART_LABELS.map(function (p) {
          return '<label style="display:block;padding:2px 0"><input type="checkbox" data-part="' + p[0] + '"'
            + (c.parts[p[0]] ? ' checked' : '') + '> ' + xe(p[1]) + '</label>';
        }).join('')
      + '<div style="font-weight:700;margin:14px 0 4px">Радиусы анализа, метры</div>'
      + '<input id="caseExpRadii" value="' + xe(c.radii) + '" style="width:100%;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px">'
      + '<div style="color:#6b7280;margin-top:3px">через запятую; по ним считаются население и конкуренты</div>'
      + '<div style="font-weight:700;margin:14px 0 4px">Детализация</div>'
      + '<label style="display:block">Радиус разбивок (медицина, F&B, районы), м: '
      + '<input id="caseExpDetail" type="number" min="200" max="10000" step="100" value="' + c.detailRadius + '" style="width:90px"></label>'
      + '<label style="display:block">Конкуренты-БЦ: радиус, м <input id="caseExpBcR" type="number" min="500" max="10000" step="100" value="' + c.bcRadius + '" style="width:90px">'
      + ' строк не больше <input id="caseExpBcN" type="number" min="5" max="500" step="5" value="' + c.bcLimit + '" style="width:70px"></label>'
      + '<label style="display:block">Конкуренты (карточки): радиус, м <input id="caseExpCompR" type="number" min="500" max="20000" step="500" value="' + c.compRadius + '" style="width:90px">'
      + ' строк не больше <input id="caseExpCompN" type="number" min="3" max="100" step="1" value="' + c.compLimit + '" style="width:70px"></label>'
      + '<div style="margin:6px 0 0">Кого считать конкурентами: '
      + COMP_CATS.map(function (cc) {
          return '<label style="margin-right:12px"><input type="checkbox" data-cc="' + cc.key + '"'
            + (c.compCats[cc.key] ? ' checked' : '') + '> ' + xe(cc.label) + '</label>';
        }).join('') + '</div>'
      + '<div style="font-weight:700;margin:14px 0 4px">Эталоны насыщения (объектов на 1 км)</div>'
      + '<div style="color:#6b7280;margin-bottom:4px">Чем выше эталон, тем терпимее скоринг к соседям. Влияет на баллы.</div>'
      + BENCH_LABELS.map(function (b) {
          return '<label style="display:inline-block;margin:0 14px 6px 0">' + xe(b[1]) + ': '
            + '<input type="number" min="1" max="200" data-bench="' + b[0] + '" value="' + c.bench[b[0]] + '" style="width:70px"></label>';
        }).join('')
      + '<div><label>Эталон спроса: население в 1 км '
      + '<input id="caseExpDemand" type="number" min="1000" max="200000" step="1000" value="' + c.demandPop + '" style="width:100px"></label></div>'
      + '<div style="font-weight:700;margin:14px 0 4px">Форматы файлов</div>'
      + '<label style="margin-right:14px"><input type="checkbox" data-fmt="xlsx"' + (c.formats.xlsx ? ' checked' : '') + '> Excel</label>'
      + '<label style="margin-right:14px"><input type="checkbox" data-fmt="pptx"' + (c.formats.pptx ? ' checked' : '') + '> Презентация</label>'
      + '<label><input type="checkbox" data-fmt="pdf"' + (c.formats.pdf ? ' checked' : '') + '> PDF</label>'
      + '</div>'
      + '<div style="padding:12px 18px;border-top:1px solid #e5e7eb;display:flex;gap:8px;justify-content:flex-end">'
      + '<button id="caseExpReset" style="padding:7px 12px;cursor:pointer">Сбросить</button>'
      + '<button id="caseExpSave" style="padding:7px 12px;cursor:pointer">Сохранить</button>'
      + '<button id="caseExpGo" style="padding:7px 14px;cursor:pointer;background:#9E0000;color:#fff;border:none;border-radius:6px">⤓ Выгрузить</button>'
      + '</div></div>';
    document.body.appendChild(wrap);
    function read() {
      var n = cfgLoad();
      wrap.querySelectorAll('[data-part]').forEach(function (el) { n.parts[el.dataset.part] = el.checked; });
      wrap.querySelectorAll('[data-bench]').forEach(function (el) { n.bench[el.dataset.bench] = Math.max(1, +el.value || 1); });
      wrap.querySelectorAll('[data-fmt]').forEach(function (el) { n.formats[el.dataset.fmt] = el.checked; });
      wrap.querySelectorAll('[data-cc]').forEach(function (el) { n.compCats[el.dataset.cc] = el.checked; });
      n.compRadius = Math.max(500, +wrap.querySelector('#caseExpCompR').value || 5000);
      n.compLimit = Math.max(3, +wrap.querySelector('#caseExpCompN').value || 20);
      n.radii = wrap.querySelector('#caseExpRadii').value;
      n.detailRadius = Math.max(200, +wrap.querySelector('#caseExpDetail').value || 1000);
      n.bcRadius = Math.max(500, +wrap.querySelector('#caseExpBcR').value || 3000);
      n.bcLimit = Math.max(5, +wrap.querySelector('#caseExpBcN').value || 60);
      n.demandPop = Math.max(1000, +wrap.querySelector('#caseExpDemand').value || 25000);
      return n;
    }
    var close = function () { wrap.remove(); };
    wrap.querySelector('#caseExpX').onclick = close;
    wrap.onclick = function (e) { if (e.target === wrap) close(); };
    wrap.querySelector('#caseExpReset').onclick = function () {
      try { localStorage.removeItem(cfgKey()); } catch (e) {}
      close(); window.caseGeoExportSettings(false);
    };
    wrap.querySelector('#caseExpSave').onclick = function () { cfgSave(read()); close(); };
    wrap.querySelector('#caseExpGo').onclick = function () {
      var n = read(); cfgSave(n); close();
      if (thenExport !== false) window.caseGeoExportAll();
    };
    return wrap;
  };

  var SCORE_ROWS = [
    ['Потенциал бизнес-центра', 'scoreBC'],
    ['Потенциал клиники', 'scoreMed'],
    ['Потенциал заведения F&B', 'scoreFnb'],
    ['Потенциал учебного центра', 'scoreEdu']
  ];
  var FORMULA = '0,55 × спрос (население 1 км / 25 000) + 0,45 × (1 − конкуренты / эталон). '
    + 'Эталоны: БЦ 6, клиника 8, F&B 25, учебный центр 5 на километр.';
  function formulaOf(c) {
    return '0,55 × спрос (население 1 км / ' + (c.demandPop || 25000) + ') + 0,45 × (1 − конкуренты / эталон). '
      + 'Эталоны этого проекта: БЦ ' + c.bench.bc + ', клиника ' + c.bench.med
      + ', F&B ' + c.bench.fnb + ', учебный центр ' + c.bench.edu + ' на километр.';
  }
  var SOURCES = 'Население — Kontur H3, откалибровано на официальные данные по районам. '
    + 'Бизнес-центры — база CASE. Медицина и аптеки — OpenStreetMap и clinics.uz. '
    + 'Общепит и образование — OpenStreetMap через сервер CASE OS. Ручные правки команды CASE учтены.';

  /* ================= детальные данные =================
     Всё, что система знает о локации, но раньше в файлы не попадало: плотность
     населения, разрез по районам города, полный список конкурентов с ценами,
     медицина по направлениям, метро, рынок аренды. Считается один раз и идёт
     и в Excel, и в презентацию — чтобы цифры в них не разошлись. */
  /* Данные карты читаем через мост CASE_GEO_DATA: BC, DIST, POP объявлены в студии
     через const/let и свойствами window не становятся, а eval запрещён политикой CSP.
     Функции (hav, popR, polysOf…) — обычные объявления, они на window есть. */
  function g(name) {
    var d = window.CASE_GEO_DATA;
    if (d && name in d) { try { return d[name]; } catch (e) { return undefined; } }
    return window[name];
  }
  function km2(m) { return Math.PI * Math.pow(m / 1000, 2); }
  function distName(latin) {
    var ru = g('DRU'); return (ru && ru[latin]) ? (ru[latin] + ' (' + latin + ')') : (latin || '');
  }
  /* Район каждой ячейки населения: по полигонам районов. Считаем только ячейки внутри
     радиуса — их сотни, а не десятки тысяч, поэтому точка-в-полигоне здесь допустима. */
  function popByDistrict(la, ln, m) {
    var POP = g('POP'), DISTGEO = g('DISTGEO'), hav = g('hav'),
        polysOf = g('polysOf'), inPoly = g('inPoly'), matchD = g('matchD');
    if (!POP || !DISTGEO || !hav || !polysOf || !inPoly) return null;
    var feats = (DISTGEO.features || []).map(function (f) {
      return { key: matchD ? matchD(f.properties) : '', polys: polysOf(f.geometry) };
    }).filter(function (x) { return x.key && x.polys.length; });
    if (!feats.length) return null;
    var out = {}, km = m / 1000, other = 0;
    POP.forEach(function (h) {
      if (hav(la, ln, h[0], h[1]) > km) return;
      for (var i = 0; i < feats.length; i++) {
        if (inPoly(h[1], h[0], feats[i].polys)) { out[feats[i].key] = (out[feats[i].key] || 0) + h[2]; return; }
      }
      other += h[2];
    });
    if (other > 1) out['за границей районов'] = other;
    return out;
  }
  function nearestMetro(la, ln, n) {
    var METRO = g('METRO'), hav = g('hav'); if (!METRO || !hav) return [];
    var all = [];
    METRO.forEach(function (l) { (l.s || []).forEach(function (x) { all.push({ n: x[2], line: l.n, km: hav(la, ln, x[0], x[1]) }); }); });
    return all.sort(function (a, b) { return a.km - b.km; }).slice(0, n || 6);
  }
  function bcAround(la, ln, m) {
    var BC = g('BC'), eff = g('eff'), hav = g('hav'); if (!BC || !hav) return [];
    var km = m / 1000, out = [];
    BC.forEach(function (b) {
      var e = eff ? eff(b) : b;
      /* v4.58.0: проверки на null не хватало — пустая строка даёт +'' === 0, а текст даёт NaN,
         и hav() возвращал NaN; сравнение NaN > km ложно, поэтому объект без координат попадал
         в выборку и вставал в отчёт с пустым расстоянием */
      var la2 = parseFloat(e.lat), ln2 = parseFloat(e.lng);
      if (!Number.isFinite(la2) || !Number.isFinite(ln2)) return;
      var d = hav(la, ln, la2, ln2);
      if (!Number.isFinite(d) || d > km) return;
      out.push({ name: e.name, district: e.district || '', km: d, cls: e['class'] || '', rent: e.rent || '',
        avail: e.avail || '', sale: e.sale || '', gla: e.gla || '', floors: e.floors || '',
        addr: e.address || '', prov: e.provider || '', psrc: e.psrc || '' });
    });
    return out.sort(function (a, b) { return a.km - b.km; });
  }
  function medBySpecialty(la, ln, m) {
    var MED = g('MEDPTS'), hav = g('hav'), SPLBL = g('SPLBL'); if (!MED || !hav) return null;
    var km = m / 1000, out = {};
    MED.forEach(function (x) { if (hav(la, ln, x.la, x.ln) <= km) { var k = (SPLBL && SPLBL[x.sp]) || x.sp || 'прочее'; out[k] = (out[k] || 0) + 1; } });
    return out;
  }
  function poiAround(la, ln, radii) {
    var api = window.CASE_GEO_POI; if (!api) return null;
    /* v4.58.0: брали api.visible() — это то, что попало в текущий кадр карты. Из-за этого
       один и тот же проект давал разные выгрузки в зависимости от того, куда пользователь
       сдвинул карту перед нажатием кнопки. Берём загруженные слои и уважаем галочки. */
    var loaded = api.keys().filter(function (k) { return api.total(k) > 0; });
    var keys = loaded.filter(function (k) { return api.on(k); });
    if (!keys.length) keys = loaded;      /* панель слоёв ещё не отрисована — берём все загруженные */
    if (!keys.length) return null;
    return keys.map(function (k) {
      var row = { key: k, label: api.label(k) };
      radii.forEach(function (r) { row['r' + r] = api.countIn([k], la, ln, r / 1000); });
      return row;
    });
  }
  /* ================= карточки конкурентов =================
     Тот самый разрез, который команда делает руками в презентациях по рынку:
     тип, год открытия, участок, GBA/GLA, этажность, число точек и из них F&B,
     парковка, заявленная ставка и расстояние. Берём из наших же данных —
     бизнес-центры из базы CASE, торговые центры и рынки из городских объектов. */
  var COMP_CATS = [
    { key: 'bc', label: 'Бизнес-центр' },
    { key: 'shopping', label: 'ТРЦ / ТЦ' },
    { key: 'markets', label: 'Рынок' },
    { key: 'street_retail', label: 'Стрит-ритейл' },
    { key: 'hotels', label: 'Гостиница' }
  ];
  function numOf(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\s|\u00a0/g, '').replace(',', '.')); return isFinite(n) ? n : null; }
  /* Ставка может быть числом (25), диапазоном («15-35», «$20–40») или «20 и выше».
     Возвращаем {min,max,text} — по ним строится и колонка, и график. */
  function rentRange(v) {
    var t = String(v == null ? '' : v).trim();
    if (!t) return null;
    var nums = (t.match(/\d+[.,]?\d*/g) || []).map(function (x) { return parseFloat(x.replace(',', '.')); });
    if (!nums.length) return null;
    var open = /выше|от\s|\+/.test(t.toLowerCase()) && nums.length === 1;
    return { min: nums[0], max: nums.length > 1 ? nums[1] : nums[0], open: open,
      text: nums.length > 1 ? ('$' + nums[0] + '–' + nums[1]) : ('$' + nums[0] + (open ? ' и выше' : '')) };
  }
  function competitors(p, c) {
    var hav = g('hav'), eff = g('eff'), BC = g('BC'), api = window.CASE_GEO_POI;
    if (!hav) return [];
    var km = (c.compRadius || c.bcRadius || 3000) / 1000, out = [];
    var cats = c.compCats || { bc: true, shopping: true, markets: true, street_retail: false, hotels: false };
    if (cats.bc && BC) BC.forEach(function (b, bi) {
      var e = eff ? eff(b) : b;
      var bla = parseFloat(e.lat), bln = parseFloat(e.lng);
      if (!Number.isFinite(bla) || !Number.isFinite(bln)) return;
      var d = hav(p.la, p.ln, bla, bln); if (!Number.isFinite(d) || d > km) return;
      out.push({ src: { k: 'bc', i: bi },   /* откуда строка — чтобы открыть полный профиль */
        kind: 'office',                     /* офис сравнивают по своим показателям */
        cls: e['class'] || '', yearReno: numOf(e.yearReno),
        typicalFloor: numOf(e.typicalFloor),
        layout: e.layout || '', finish: e.finish || '', owner: e.owner || '',
        name: e.name, type: e['class'] ? ('Бизнес-центр ' + e['class']) : 'Бизнес-центр',
        year: numOf(e.year), land: numOf(e.landArea), gba: numOf(e.gba), gla: numOf(e.gla),
        floors: numOf(e.floors), units: numOf(e.tenantsCount), fb: numOf(e.fbCount),
        park: numOf(e.parking) != null ? numOf(e.parking) : numOf(e.parkingSpaces),
        /* Диапазон важнее одиночного числа: если команда вписала «28-38», это её
           проверенные данные, а число rent часто приходит из объявлений одной площадки. */
        rent: rentRange(e.rentRange !== undefined && e.rentRange !== '' ? e.rentRange : e.rent),
        km: d, district: e.district || '', ours: /CASE \(owner\)/i.test(e.provider || ''),
        addr: e.address || '', avail: numOf(e.avail), sale: numOf(e.sale) });
    });
    if (api) COMP_CATS.forEach(function (cc) {
      if (cc.key === 'bc' || !cats[cc.key]) return;
      (api.rows ? api.rows(cc.key) : []).forEach(function (x, xi) {
        var la = +x.lat, ln = +x.lng; if (!isFinite(la) || !isFinite(ln)) return;
        var d = hav(p.la, p.ln, la, ln); if (d > km) return;
        out.push({ src: { k: cc.key, i: xi }, kind: 'retail',
          name: x.name, type: x.format || cc.label,
          year: numOf(x.openYear), land: numOf(x.landArea), gba: numOf(x.gba), gla: numOf(x.gla),
          floors: numOf(x.floors), units: numOf(x.tenantsCount) != null ? numOf(x.tenantsCount) : numOf(x.units),
          fb: numOf(x.fbCount), park: numOf(x.parkingSpaces),
          rent: rentRange(x.rentRange || x.rent), km: d, district: x.district || '', ours: false,
          addr: x.address || '', occ: numOf(x.occupancy), foot: numOf(x.annualFootfall) });
      });
    });
    /* v4.58.0: лимит применяли к общему списку. Если ближе оказывались 20 бизнес-центров,
       торговая часть выпадала целиком, хотя владелец просил обе таблицы. Режем по видам. */
    var lim = c.compLimit || 20;
    out.sort(function (a, b) { return a.km - b.km; });
    var office = out.filter(function (x) { return x.kind === 'office'; }).slice(0, lim);
    var retail = out.filter(function (x) { return x.kind === 'retail'; }).slice(0, lim);
    return office.concat(retail).sort(function (a, b) { return a.km - b.km; });
  }

  /* Свод по конкурентам в зоне охвата: сколько объектов, сколько метров, какие ставки.
     Считаем медиану, а не только среднее: один дорогой объект перекашивает среднее,
     а решение принимают по типичной ставке рынка. */
  function med(a) {
    if (!a.length) return null;
    var b = a.slice().sort(function (x, y) { return x - y; }), m = b.length >> 1;
    return b.length % 2 ? b[m] : +((b[m - 1] + b[m]) / 2).toFixed(1);
  }
  function compSummary(list, kind) {
    var rows = list.filter(function (x) { return x.kind === kind; });
    if (!rows.length) return null;
    var rents = [], avail = 0, area = 0, byCls = {};
    /* v4.58.0: раньше объект со ставкой «15-35» давал в выборку два числа, а объект с одной
       ставкой — одно, и медиана смещалась в сторону тех, кто указал диапазон. Для медианы
       берём по одному значению на объект (середину диапазона), границы рынка считаем отдельно. */
    var mids = [];
    rows.forEach(function (x) {
      if (x.rent) { rents.push(x.rent.min); if (x.rent.max !== x.rent.min) rents.push(x.rent.max);
        mids.push((x.rent.min + x.rent.max) / 2); }
      if (x.gla) area += x.gla;
      if (x.avail) avail += x.avail;
      if (kind === 'office') { var c = x.cls || 'без класса'; byCls[c] = (byCls[c] || 0) + 1; }
    });
    return { n: rows.length, withRent: rows.filter(function (x) { return x.rent; }).length,
      area: area || null, avail: avail || null,
      rentMin: rents.length ? Math.min.apply(null, rents) : null,
      rentMax: rents.length ? Math.max.apply(null, rents) : null,
      rentMed: med(mids), byCls: byCls };
  }

  function detail(p, c) {
    c = c || cfgLoad();
    var RAD = radiiOf(c), DR = c.detailRadius || 1000;
    var DIST = g('DIST'), popR = g('popR');
    var dRow = (DIST && p.d && DIST[p.d]) ? DIST[p.d] : null;
    var byDist1 = c.parts.districts ? popByDistrict(p.la, p.ln, DR) : null;
    var byDist3 = c.parts.districts ? popByDistrict(p.la, p.ln, 3000) : null;
    var prev = 0;
    var pop = RAD.map(function (r) {
      var v = popR ? popR(p.la, p.ln, r) : null;
      var row = { r: r, pop: v, area: +km2(r).toFixed(2),
        dens: (v == null) ? null : Math.round(v / km2(r)),
        ring: (v == null) ? null : Math.round(v - prev),
        shareDistrict: (v == null || !dRow) ? null : +(100 * v / (dRow[0] * 1000)).toFixed(1) };
      prev = v || prev;
      return row;
    });
    var compList = c.parts.comp ? competitors(p, c) : [];
    return {
      compOffice: compSummary(compList, 'office'),
      compRetail: compSummary(compList, 'retail'),
      district: dRow ? { name: distName(p.d), pop: Math.round(dRow[0] * 1000), area: dRow[1],
        dens: Math.round(dRow[0] * 1000 / dRow[1]) } : null,
      districtsAll: (DIST ? Object.keys(DIST).map(function (k) {
        return { name: distName(k), pop: Math.round(DIST[k][0] * 1000), area: DIST[k][1],
          dens: Math.round(DIST[k][0] * 1000 / DIST[k][1]), here: (k === p.d) };
      }).sort(function (a, b) { return b.pop - a.pop; }) : []),
      pop: pop, byDist1: byDist1, byDist3: byDist3,
      metro: c.parts.metro ? nearestMetro(p.la, p.ln, 8) : [],
      bc: c.parts.bc ? bcAround(p.la, p.ln, c.bcRadius || 3000).slice(0, c.bcLimit || 60) : [],
      med1: c.parts.med ? medBySpecialty(p.la, p.ln, DR) : null,
      med3: c.parts.med ? medBySpecialty(p.la, p.ln, 3000) : null,
      poi: c.parts.poi ? poiAround(p.la, p.ln, RAD) : null,
      /* Разбивка по человеческим подтипам: «Школа: 12, Курсы: 5» вместо «training: 5» */
      eduSub: (window.CASE_GEO_POI && window.CASE_GEO_POI.subtypes)
        ? window.CASE_GEO_POI.subtypes(['education'], p.la, p.ln, DR / 1000) : null,
      fnbSub: (window.CASE_GEO_POI && window.CASE_GEO_POI.subtypes)
        ? window.CASE_GEO_POI.subtypes(['restaurants', 'cafes', 'fast_food'], p.la, p.ln, DR / 1000) : null,
      market: c.parts.market ? (g('MARKET') || null) : null,
      comp: compList,

      radii: RAD, detailRadius: DR, cfg: c,
      /* Таблица по радиусам считается по настроенным радиусам, а не по тем,
         что были на экране: пользователь мог задать свои. */
      table: RAD.map(function (r) {
        var api = window.CASE_GEO_POI;
        var popR = g('popR'), medR = g('medR'), bcR = g('bcR'), phR = g('phR');
        return { r: r,
          pop: popR ? popR(p.la, p.ln, r) : null,
          bc: bcR ? bcR(p.la, p.ln, r) : 0,
          med: medR ? medR(p.la, p.ln, r, false) : 0,
          medProf: medR ? medR(p.la, p.ln, r, true) : 0,
          ph: phR ? phR(p.la, p.ln, r) : 0,
          fnb: (api && api.has(['restaurants', 'cafes', 'fast_food'])) ? api.countIn(['restaurants', 'cafes', 'fast_food'], p.la, p.ln, r / 1000) : null,
          edu: (api && api.has(['education'])) ? api.countIn(['education'], p.la, p.ln, r / 1000) : null };
      }),
      /* Скоринг пересчитывается по эталонам проекта: они настраиваются, и штатные
         значения из отчёта на экране здесь не годятся. */
      scores: (function () {
        var popR = g('popR'), pop1 = popR ? popR(p.la, p.ln, 1000) : null;
        var api = window.CASE_GEO_POI, medR = g('medR'), bcR = g('bcR');
        var demand = pop1 == null ? null : Math.min(1, pop1 / (c.demandPop || 25000));
        function sc(n, bench) {
          if (demand == null || n == null) return null;
          return Math.round((0.55 * demand + 0.45 * Math.max(0, 1 - n / bench)) * 100);
        }
        var fnb1 = (api && api.has(['restaurants', 'cafes', 'fast_food'])) ? api.countIn(['restaurants', 'cafes', 'fast_food'], p.la, p.ln, 1) : null;
        var edu1 = (api && api.has(['education'])) ? api.countIn(['education'], p.la, p.ln, 1) : null;
        return { scoreBC: sc(bcR ? bcR(p.la, p.ln, 1000) : null, c.bench.bc),
                 scoreMed: sc(medR ? medR(p.la, p.ln, 1000, true) : null, c.bench.med),
                 scoreFnb: sc(fnb1, c.bench.fnb), scoreEdu: sc(edu1, c.bench.edu), pop1: pop1 };
      })()
    };
  }

  function coreXml(p) {
    var t = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
      + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
      + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + '<dc:title>CASE OS — геоаналитика: ' + xe(p.project || 'точка') + '</dc:title>'
      + '<dc:creator>CASE Advisory · CASE OS</dc:creator>'
      + '<cp:lastModifiedBy>CASE OS</cp:lastModifiedBy>'
      + '<dcterms:created xsi:type="dcterms:W3CDTF">' + t + '</dcterms:created>'
      + '<dcterms:modified xsi:type="dcterms:W3CDTF">' + t + '</dcterms:modified>'
      + '</cp:coreProperties>';
  }
  function appXml(app, slides) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" '
      + 'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
      + '<Application>' + xe(app) + '</Application>'
      + (slides ? '<Slides>' + slides + '</Slides>' : '')
      + '<Company>CASE Advisory</Company></Properties>';
  }

  /* ================= Excel (.xlsx) ================= */
  function sheetXml(rows, widths) {
    var cols = (widths || []).map(function (w, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
    }).join('');
    var body = rows.map(function (row, ri) {
      var cells = row.map(function (v, ci) {
        var ref = colName(ci) + (ri + 1);
        if (v == null || v === '') return '<c r="' + ref + '"/>';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + ref + '"><v>' + v + '</v></c>';
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xe(dsh(v)) + '</t></is></c>';
      }).join('');
      return '<row r="' + (ri + 1) + '">' + cells + '</row>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + body + '</sheetData></worksheet>';
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26; } return s; }

  function buildSheets(p, D) {
    var RAD = D.radii, C = D.cfg, SC = D.scores, DR = D.detailRadius;
    function sv(k) { return SC && SC[k] != null ? SC[k] : p[k]; }

    /* 1. Сводка */
    var head = [
      ['CASE OS — геоаналитика локации'],
      ['Проект', p.project || '—'],
      ['Координаты', (+p.la).toFixed(5) + ', ' + (+p.ln).toFixed(5)],
      ['Район', D.district ? D.district.name : (p.d || '—')],
      ['Население района', D.district ? D.district.pop : 'нет данных'],
      ['Площадь района, км²', D.district ? D.district.area : 'нет данных'],
      ['Плотность района, чел/км²', D.district ? D.district.dens : 'нет данных'],
      ['Ближайшее метро', p.metro ? (p.metro.n + ' — ' + Math.round(p.metro.d * 1000) + ' м') : '—'],
      ['Дата отчёта', new Date().toLocaleString('ru-RU')],
      []
    ];
    var scores = [['Быстрый скоринг', 'Балл (0–100)', 'Оценка']];
    SCORE_ROWS.forEach(function (r) {
      var v = sv(r[1]);
      scores.push([r[0], v == null ? 'нет данных' : v,
        v == null ? '—' : (v >= 55 ? 'хорошо' : v >= 40 ? 'умеренно' : 'слабо')]);
    });
    scores.push([], ['Формула', formulaOf(C)], ['Эталоны насыщения (объектов на 1 км)',
        'БЦ ' + C.bench.bc + ', клиника ' + C.bench.med + ', F&B ' + C.bench.fnb + ', учебный центр ' + C.bench.edu],
      ['Эталон спроса', 'население в 1 км = ' + C.demandPop],
      ['Радиусы анализа, м', RAD.join(', ')],
      ['Источники', SOURCES]);

    /* 2. Население: плотность, прирост по кольцам, доля района */
    var popRows = [['Радиус, м', 'Жителей', 'Площадь круга, км²', 'Плотность, чел/км²',
      'Прирост в кольце', 'Доля населения района, %']];
    D.pop.forEach(function (t) {
      popRows.push([t.r, t.pop == null ? 'нет данных' : t.pop, t.area,
        t.dens == null ? '—' : t.dens, t.ring == null ? '—' : t.ring,
        t.shareDistrict == null ? '—' : t.shareDistrict]);
    });
    popRows.push([], ['Модель', 'Kontur H3, откалибровано на официальное население районов'],
      ['Плотность', 'жители в круге / площадь круга — сравнима с плотностью района из листа «Районы»']);

    /* 3. Разрез населения по районам */
    var dRows = [['Район', 'Жителей в ' + DR + ' м', 'Жителей в 3 км']];
    var keys = {};
    [D.byDist1, D.byDist3].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { keys[k] = 1; }); });
    Object.keys(keys).sort(function (a, b) {
      return ((D.byDist3 && D.byDist3[b]) || 0) - ((D.byDist3 && D.byDist3[a]) || 0);
    }).forEach(function (k) {
      dRows.push([distName(k), Math.round((D.byDist1 && D.byDist1[k]) || 0),
        Math.round((D.byDist3 && D.byDist3[k]) || 0)]);
    });
    if (dRows.length === 1) dRows.push(['Данные о населении ещё не загружены', '', '']);
    dRows.push([], ['Смысл', 'Показывает, из каких районов приходит аудитория — важно, когда точка стоит на границе']);

    /* 4. Все районы города */
    var allRows = [['Район', 'Население', 'Площадь, км²', 'Плотность, чел/км²', 'Район проекта']];
    D.districtsAll.forEach(function (x) { allRows.push([x.name, x.pop, x.area, x.dens, x.here ? 'да' : '']); });

    /* 5. Радиусы: всё окружение в одной таблице */
    var rad = [['Радиус, м', 'Население', 'Бизнес-центры', 'Медицина', 'в т.ч. профильные', 'Аптеки', 'F&B', 'Образование']];
    D.table.forEach(function (t) {
      rad.push([t.r, t.pop == null ? 'нет данных' : t.pop, t.bc, t.med, t.medProf, t.ph,
        t.fnb == null ? 'слой не загружен' : t.fnb, t.edu == null ? 'слой не загружен' : t.edu]);
    });

    /* 6. Бизнес-центры: полный список в 3 км + средние по классам */
    var bc = [['Бизнес-центр', 'Район', 'Расстояние, м', 'Класс', 'Ставка, $/м²/мес', 'Свободно, м²',
      'Продажа, $/м²', 'GLA, м²', 'Этажей', 'Адрес', 'Источник']];
    D.bc.forEach(function (x) {
      bc.push([x.name, x.district, Math.round(x.km * 1000), x.cls || '-',
        cellNum(x.rent), cellNum(x.avail), cellNum(x.sale), cellNum(x.gla),
        x.floors || '-', x.addr, x.prov]);
    });
    if (bc.length === 1) bc.push(['В радиусе 3 км бизнес-центров не найдено', '', '', '', '', '', '', '', '', '', '']);
    var byCls = {};
    D.bc.forEach(function (x) {
      var r = parseFloat(x.rent); if (!isFinite(r)) return;
      var c = x.cls || 'без класса';
      (byCls[c] = byCls[c] || []).push(r);
    });
    var clsKeys = Object.keys(byCls);
    if (clsKeys.length) {
      bc.push([], ['Средняя ставка по классам (только объекты с известной ценой)', 'Объектов', 'Средняя, $/м²/мес', 'Минимум', 'Максимум']);
      clsKeys.sort().forEach(function (c) {
        var a = byCls[c], sum = a.reduce(function (n, v) { return n + v; }, 0);
        bc.push([c, a.length, +(sum / a.length).toFixed(1), Math.min.apply(null, a), Math.max.apply(null, a)]);
      });
    }

    /* 7. Медицина по направлениям */
    var med = [['Направление медицины', 'В ' + DR + ' м', 'В 3 км']];
    var mk = {};
    [D.med1, D.med3].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { mk[k] = 1; }); });
    Object.keys(mk).sort(function (a, b) { return ((D.med3 && D.med3[b]) || 0) - ((D.med3 && D.med3[a]) || 0); })
      .forEach(function (k) { med.push([k, (D.med1 && D.med1[k]) || 0, (D.med3 && D.med3[k]) || 0]); });
    if (med.length === 1) med.push(['Данные медицины не загружены', '', '']);

    /* 8. Городские объекты по слоям */
    var poi = [['Слой городских объектов'].concat(RAD.map(function (r) { return r + ' м'; }))];
    if (D.poi) D.poi.forEach(function (row) {
      poi.push([row.label].concat(RAD.map(function (r) { return row['r' + r]; })));
    });
    else poi.push(['Слои городских объектов не включены'].concat(RAD.map(function () { return ''; })));

    /* 8a0. Конкуренты-офисы: показатели, по которым сравнивают БЦ */
    var off = [['№', 'Бизнес-центр', 'Класс', 'Год', 'Реконстр.', 'GBA, м²', 'GLA, м²', 'Эт.',
      'Типовой этаж, м²', 'Парковка', 'Ставка, $/м²/мес', 'Свободно, м²',
      'Планировка', 'Отделка', 'Собственник / УК', 'Расст., км', 'Адрес', 'Наш проект']];
    (D.comp || []).filter(function (x) { return x.kind === 'office'; }).forEach(function (x, i) {
      off.push([i + 1, x.name, x.cls || '—', x.year == null ? '—' : x.year, x.yearReno == null ? '—' : x.yearReno,
        x.gba == null ? '—' : x.gba, x.gla == null ? '—' : x.gla, x.floors == null ? '—' : x.floors,
        x.typicalFloor == null ? '—' : x.typicalFloor, x.park == null ? '—' : x.park,
        x.rent ? x.rent.text : '—', x.avail == null ? '—' : x.avail,
        x.layout || '—', x.finish || '—', x.owner || '—',
        +x.km.toFixed(2), x.addr || '', x.ours ? 'да' : '']);
    });
    if (off.length === 1) off.push(['—', 'В заданном радиусе бизнес-центров не найдено'].concat(new Array(16).fill('')));
    var S1 = D.compOffice;
    if (S1) off.push([], ['Свод по офисам в зоне охвата', ''],
      ['Объектов', S1.n], ['Из них с известной ставкой', S1.withRent],
      ['Суммарная GLA, м²', S1.area == null ? 'нет данных' : S1.area],
      ['Свободно суммарно, м²', S1.avail == null ? 'нет данных' : S1.avail],
      ['Ставка: минимум, $/м²/мес', S1.rentMin == null ? 'нет данных' : S1.rentMin],
      ['Ставка: медиана', S1.rentMed == null ? 'нет данных' : S1.rentMed],
      ['Ставка: максимум', S1.rentMax == null ? 'нет данных' : S1.rentMax],
      ['По классам', Object.keys(S1.byCls).sort().map(function (k) { return k + ': ' + S1.byCls[k]; }).join(', ') || '—'],
      ['Медиана, а не среднее', 'один дорогой объект перекашивает среднее; решение принимают по типичной ставке']);

    /* 8a. Конкуренты — карточки как в презентациях по рынку */
    var comp = [['№', 'Объект', 'Тип', 'Откр.', 'Участок, м²', 'GBA, м²', 'GLA, м²', 'Эт.',
      'Точки', 'F&B', 'Парк.', 'Ставка, $/м²/мес', 'Расст. по прямой, км', 'Район', 'Наш проект']];
    (D.comp || []).filter(function (x) { return x.kind !== 'office'; }).forEach(function (x, i) {
      comp.push([i + 1, x.name, x.type, x.year == null ? '—' : x.year,
        x.land == null ? '—' : x.land, x.gba == null ? '—' : x.gba, x.gla == null ? '—' : x.gla,
        x.floors == null ? '—' : x.floors, x.units == null ? '—' : x.units,
        x.fb == null ? '—' : x.fb, x.park == null ? '—' : x.park,
        x.rent ? x.rent.text : '—', +x.km.toFixed(2), x.district, x.ours ? 'да' : '']);
    });
    if (comp.length === 1) comp.push(['—', 'В заданном радиусе конкурентов не найдено', '', '', '', '', '', '', '', '', '', '', '', '', '']);
    comp.push([], ['Пустые ячейки', 'данных нет в базе — заполняются в карточке объекта на вкладке «Объекты»'],
      ['Расстояние', 'по прямой от точки проекта; расстояние по дороге считается отдельно маршрутизатором']);

    /* 8b. Образование и F&B по человеческим типам */
    var eduS = [['Тип учебного заведения', 'В ' + DR + ' м']];
    if (D.eduSub) Object.keys(D.eduSub).sort(function (a, b) { return D.eduSub[b] - D.eduSub[a]; })
      .forEach(function (k) { eduS.push([k, D.eduSub[k]]); });
    if (eduS.length === 1) eduS.push(['Слой образования не загружен', '']);
    var fnbS = [['Тип заведения', 'В ' + DR + ' м']];
    if (D.fnbSub) Object.keys(D.fnbSub).sort(function (a, b) { return D.fnbSub[b] - D.fnbSub[a]; })
      .forEach(function (k) { fnbS.push([k, D.fnbSub[k]]); });
    if (fnbS.length === 1) fnbS.push(['Слои общепита не загружены', '']);

    /* 9. Метро */
    var metro = [['Станция метро', 'Линия', 'Расстояние, м', 'Пешком, мин (~5 км/ч)']];
    D.metro.forEach(function (x) {
      metro.push([x.n, x.line, Math.round(x.km * 1000), Math.round(x.km / 5 * 60)]);
    });
    if (metro.length === 1) metro.push(['Данные метро не загружены', '', '', '']);

    /* 10. Рынок аренды города — фон для сравнения ставок */
    var mkt = [['Рынок Ташкента (внешние площадки)', 'Значение']];
    if (D.market) {
      if (D.market.src) mkt.push(['Источник и дата сбора', D.market.src]);
      ['olx', 'uybor'].forEach(function (k) {
        var m = D.market[k]; if (!m) return;
        if (m.rent) mkt.push([k.toUpperCase() + ' · аренда, медиана $/м²/мес', m.rent.med],
          [k.toUpperCase() + ' · аренда, 25–75 %', (m.rent.p25 || '—') + ' – ' + (m.rent.p75 || '—')],
          [k.toUpperCase() + ' · объявлений (аренда)', m.rent.n]);
        if (m.sale) mkt.push([k.toUpperCase() + ' · продажа, медиана $/м²', m.sale.med],
          [k.toUpperCase() + ' · объявлений (продажа)', m.sale.n]);
      });
    }
    if (mkt.length === 1) mkt.push(['Рыночные данные не загружены', '']);

    /* Лист «Сводка» есть всегда — без него файл нельзя ни с чем сопоставить.
       Остальное включается галочками в настройках проекта. */
    var out = [{ name: 'Сводка', rows: head.concat(C.parts.scoring ? scores : [['Скоринг в этой выгрузке отключён', '']]), w: [34, 46, 14] }];
    function add(on, sheet) { if (on) out.push(sheet); }
    add(C.parts.pop, { name: 'Население', rows: popRows, w: [12, 14, 18, 20, 18, 24] });
    add(C.parts.districts, { name: 'Население по районам', rows: dRows, w: [30, 18, 18] });
    add(C.parts.allDistricts, { name: 'Районы города', rows: allRows, w: [28, 14, 16, 20, 14] });
    add(C.parts.radii, { name: 'Радиусы', rows: rad, w: [12, 14, 16, 12, 18, 10, 10, 14] });
    add(C.parts.bc, { name: 'Бизнес-центры', rows: bc, w: [34, 16, 15, 10, 18, 14, 15, 12, 10, 40, 14] });
    add(C.parts.comp, { name: 'Конкуренты · БЦ', rows: off,
      w: [5, 32, 10, 8, 10, 12, 12, 6, 15, 11, 18, 13, 24, 22, 26, 11, 34, 12] });
    add(C.parts.comp, { name: 'Конкуренты · торговля', rows: comp, w: [5, 30, 20, 8, 13, 12, 12, 6, 8, 7, 8, 18, 18, 16, 12] });
    add(C.parts.med, { name: 'Медицина', rows: med, w: [40, 12, 12] });
    add(C.parts.poi, { name: 'Городские объекты', rows: poi, w: [32, 10, 10, 10, 10, 10] });
    add(C.parts.poi, { name: 'Образование по типам', rows: eduS, w: [34, 14] });
    add(C.parts.poi, { name: 'F&B по типам', rows: fnbS, w: [34, 14] });
    add(C.parts.metro, { name: 'Метро', rows: metro, w: [28, 22, 16, 20] });
    add(C.parts.market, { name: 'Рынок города', rows: mkt, w: [42, 30] });
    return out;
  }

  window.caseGeoExportXlsx = function () {
    var p = need(); if (!p) return;
    var sheets = buildSheets(p, detail(p));
    var files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        + '<Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('')
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
        + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
        + '</Relationships>' },
      { name: 'docProps/core.xml', data: coreXml(p) },
      { name: 'docProps/app.xml', data: appXml('Microsoft Excel', 0) },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
        + sheets.map(function (s, i) { return '<sheet name="' + xe(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('')
        + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('')
        + '</Relationships>' }
    ];
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s.rows, s.w) }); });
    saveBlob(zipBuild(files), fname(p, 'xlsx'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  /* ================= PowerPoint (.pptx) ================= */
  var EMU = 12700;                     /* 1 pt = 12700 EMU */
  var SLIDE_W = 12192000, SLIDE_H = 6858000;   /* 16:9 */
  function tx(text, x, y, w, h, size, opt) {
    opt = opt || {};
    var runs = String(text).split('\n').map(function (line) {
      return '<a:p><a:pPr algn="' + (opt.align || 'l') + '"/><a:r><a:rPr lang="ru-RU" sz="' + (size * 100) + '"'
        + (opt.bold ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + (opt.color || '222222') + '"/></a:solidFill>'
        + '<a:latin typeface="Arial"/></a:rPr><a:t>' + xe(dsh(line)) + '</a:t></a:r></a:p>';
    }).join('');
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + (opt.id || 2) + '" name="t' + (opt.id || 2) + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
      + '<p:spPr><a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>'
      + '<p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>' + runs + '</p:txBody></p:sp>';
  }
  function tbl(rows, x, y, w, id) {
    var colW = Math.floor(w / rows[0].length);
    var grid = rows[0].map(function () { return '<a:gridCol w="' + colW + '"/>'; }).join('');
    var body = rows.map(function (r, ri) {
      var cells = r.map(function (c) {
        var head = ri === 0;
        return '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ru-RU" sz="1100"'
          + (head ? ' b="1"' : '') + '><a:solidFill><a:srgbClr val="' + (head ? 'FFFFFF' : '222222') + '"/></a:solidFill>'
          + '<a:latin typeface="Arial"/></a:rPr><a:t>' + xe(dsh(c)) + '</a:t></a:r></a:p></a:txBody>'
          + '<a:tcPr marL="45720" marR="45720" marT="27432" marB="27432"><a:solidFill><a:srgbClr val="'
          + (head ? '9E0000' : (ri % 2 ? 'F5F6F8' : 'FFFFFF')) + '"/></a:solidFill></a:tcPr></a:tc>';
      }).join('');
      return '<a:tr h="270000">' + cells + '</a:tr>';
    }).join('');
    return '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="' + id + '" name="tbl' + id + '"/>'
      + '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>'
      + '<p:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + (rows.length * 270000) + '"/></p:xfrm>'
      + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">'
      + '<a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>' + grid + '</a:tblGrid>' + body + '</a:tbl>'
      + '</a:graphicData></a:graphic></p:graphicFrame>';
  }
  function pic(rid, x, y, w, h, id) {
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="map"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
      + '<p:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
      + '<p:spPr><a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  }
  function slideXml(shapes) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
      + '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
      + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
      + shapes.join('') + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
  }
  function rect(x, y, w, h, color, id) {
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="r' + id + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
      + '<p:spPr><a:xfrm><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="' + color + '"/></a:solidFill>'
      + '<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>';
  }
  function band(id) {   /* фирменная красная полоса сверху слайда */
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="band"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
      + '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + SLIDE_W + '" cy="110000"/></a:xfrm>'
      + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="9E0000"/></a:solidFill>'
      + '<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>';
  }
  var THEME = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="CASE"><a:themeElements>'
    + '<a:clrScheme name="CASE"><a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>'
    + '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="222222"/></a:dk2>'
    + '<a:lt2><a:srgbClr val="F5F6F8"/></a:lt2><a:accent1><a:srgbClr val="9E0000"/></a:accent1>'
    + '<a:accent2><a:srgbClr val="14675B"/></a:accent2><a:accent3><a:srgbClr val="A8792C"/></a:accent3>'
    + '<a:accent4><a:srgbClr val="1F6FB2"/></a:accent4><a:accent5><a:srgbClr val="7B3FA0"/></a:accent5>'
    + '<a:accent6><a:srgbClr val="2E9E6B"/></a:accent6><a:hlink><a:srgbClr val="9E0000"/></a:hlink>'
    + '<a:folHlink><a:srgbClr val="6D6D6D"/></a:folHlink></a:clrScheme>'
    + '<a:fontScheme name="CASE"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>'
    + '<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>'
    + '<a:fmtScheme name="CASE"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>'
    + '<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
    + '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>'
    + '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>'
    + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>'
    + '<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
    + '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
    + '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>'
    + '</a:fmtScheme></a:themeElements></a:theme>';
  var MASTER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
    + '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
    + '<p:grpSpPr/></p:spTree></p:cSld>'
    + '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" '
    + 'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'
    + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>';
  var LAYOUT = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">'
    + '<p:cSld name="Пустой"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
    + '<p:grpSpPr/></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>';

  function num(v, dash) { return v == null ? (dash || 'нет данных') : Number(v).toLocaleString('ru'); }

  function slidesFor(p, mapPng, D) {
    var S = [], H = 660000, C = D.cfg, SC = D.scores, DR = D.detailRadius;
    function sv(k) { return SC && SC[k] != null ? SC[k] : p[k]; }
    /* 1. Титул */
    S.push([band(2),
      tx('Геоаналитика локации', 700000, 1900000, 10800000, 900000, 40, { bold: true, color: '9E0000', id: 3 }),
      tx(p.project || 'Точка на карте', 700000, 2900000, 10800000, 700000, 24, { id: 4 }),
      tx((+p.la).toFixed(5) + ', ' + (+p.ln).toFixed(5)
        + (D.district ? '  ·  ' + D.district.name : (p.d ? '  ·  район ' + p.d : ''))
        + (p.metro ? '  ·  метро ' + p.metro.n + ' — ' + Math.round(p.metro.d * 1000) + ' м' : ''),
        700000, 3600000, 10800000, 500000, 16, { color: '6D6D6D', id: 5 }),
      tx('CASE Advisory  ·  ' + new Date().toLocaleDateString('ru-RU'), 700000, 5700000, 10800000, 500000, 13, { color: '6D6D6D', id: 6 })]);
    /* 2. Карта */
    if (mapPng && C.parts.map) {
      S.push([band(2), tx('Локация на карте', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        pic('rId2', 600000, 1100000, 11000000, 5000000, 4)]);
    }
    /* 3. Население: плотность и прирост по кольцам */
    var popRows = [['Радиус, м', 'Жителей', 'Плотность, чел/км²', 'Прирост в кольце', 'Доля района, %']];
    if (C.parts.pop) D.pop.forEach(function (t) {
      popRows.push([String(t.r), num(t.pop), t.dens == null ? '—' : num(t.dens),
        t.ring == null ? '—' : num(t.ring), t.shareDistrict == null ? '—' : String(t.shareDistrict)]);
    });
    var dtxt = D.district
      ? ('Район ' + D.district.name + ': ' + num(D.district.pop) + ' жителей, '
         + D.district.area + ' км², плотность ' + num(D.district.dens) + ' чел/км².')
      : 'Район проекта не определён.';
    if (C.parts.pop) S.push([band(2), tx('Население вокруг точки', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tbl(popRows, 600000, 1150000, 11000000, 4),
      tx(dtxt + '\nМодель Kontur H3, откалибрована на официальное население районов.',
        600000, 4600000, 11000000, 900000, 12, { color: '6D6D6D', id: 5 })]);
    /* 4. Откуда приходит аудитория — разрез по районам */
    var dr = [['Район', 'Жителей в 1 км', 'Жителей в 3 км']];
    var keys = {};
    [D.byDist1, D.byDist3].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { keys[k] = 1; }); });
    Object.keys(keys).sort(function (a, b) {
      return ((D.byDist3 && D.byDist3[b]) || 0) - ((D.byDist3 && D.byDist3[a]) || 0);
    }).slice(0, 8).forEach(function (k) {
      dr.push([distName(k), num(Math.round((D.byDist1 && D.byDist1[k]) || 0)),
        num(Math.round((D.byDist3 && D.byDist3[k]) || 0))]);
    });
    if (C.parts.districts && dr.length > 1) {
      S.push([band(2), tx('Откуда приходит аудитория: районы города', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        tbl(dr, 600000, 1150000, 7000000, 4),
        tx('Разрез показывает, из каких районов складывается население вокруг точки. '
          + 'Это важно, когда локация стоит на границе районов: формально она в одном, '
          + 'а половина аудитории живёт в соседнем.', 7900000, 1150000, 3700000, 3000000, 12, { color: '6D6D6D', id: 5 })]);
    }
    /* 5. Конкурентная среда: БЦ + средние ставки */
    var bcRows = [['Ближайшие бизнес-центры', 'Расстояние', 'Класс', 'Ставка']];
    D.bc.slice(0, 8).forEach(function (x) {
      bcRows.push([x.name, Math.round(x.km * 1000) + ' м', x.cls || '—', x.rent ? ('$' + x.rent) : '—']);
    });
    if (bcRows.length === 1) bcRows.push(['В радиусе 3 км не найдено', '', '', '']);
    /* F&B — по человеческим типам: чайхана, ресторан, фастфуд, а не по сырым тегам */
    var fnbRows = [['F&B в ' + DR + ' м', 'Объектов']];
    var fb = D.fnbSub || p.fnbBreak;
    if (fb) Object.keys(fb).sort(function (a, b) { return fb[b] - fb[a]; }).slice(0, 8).forEach(function (k) {
      fnbRows.push([(D.fnbSub ? k : ((p.poiLabels && p.poiLabels[k]) || k)), String(fb[k])]);
    });
    if (fnbRows.length === 1) fnbRows.push(['Слои общепита не загружены', '—']);
    if (C.parts.bc) S.push([band(2), tx('Ближайшее окружение: офисы и общепит', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tbl(bcRows, 600000, 1150000, 6600000, 4), tbl(fnbRows, 7500000, 1150000, 4100000, 5)]);
    /* 6. Медицина по направлениям */
    var med = [['Направление медицины', 'В 1 км', 'В 3 км']];
    var mk = {};
    [D.med1, D.med3].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { mk[k] = 1; }); });
    Object.keys(mk).sort(function (a, b) { return ((D.med3 && D.med3[b]) || 0) - ((D.med3 && D.med3[a]) || 0); })
      .slice(0, 9).forEach(function (k) { med.push([k, String((D.med1 && D.med1[k]) || 0), String((D.med3 && D.med3[k]) || 0)]); });
    if (C.parts.med && med.length > 1) {
      var metro = [['Метро', 'Линия', 'Пешком']];
      D.metro.slice(0, 5).forEach(function (x) { metro.push([x.n, x.line, Math.round(x.km / 5 * 60) + ' мин']); });
      S.push([band(2), tx('Медицина и транспортная доступность', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        tbl(med, 600000, 1150000, 6600000, 4), tbl(metro, 7500000, 1150000, 4100000, 5)]);
    }
    /* 7. Городские объекты по слоям */
    if (C.parts.poi && D.poi && D.poi.length) {
      var RAD = D.radii;
      var pr = [['Слой городских объектов'].concat(RAD.map(function (r) { return r + ' м'; }))];
      D.poi.slice(0, 10).forEach(function (row) {
        pr.push([row.label].concat(RAD.map(function (r) { return String(row['r' + r]); })));
      });
      S.push([band(2), tx('Городские объекты по радиусам', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        tbl(pr, 600000, 1150000, 11000000, 4),
        tx('Считаются только включённые слои. Данные — OpenStreetMap через сервер CASE OS.',
          600000, 5400000, 11000000, 600000, 11, { color: '6D6D6D', id: 5 })]);
    }
    /* 7b. Образование по типам — школа и коммерческие курсы для аренды значат разное */
    if (C.parts.poi && D.eduSub && Object.keys(D.eduSub).length) {
      var es = [['Тип учебного заведения', 'В ' + DR + ' м']];
      Object.keys(D.eduSub).sort(function (a, b) { return D.eduSub[b] - D.eduSub[a]; })
        .slice(0, 9).forEach(function (k) { es.push([k, String(D.eduSub[k])]); });
      S.push([band(2), tx('Образование рядом: по типам', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        tbl(es, 600000, 1150000, 7000000, 4),
        tx('Школа, вуз и коммерческие курсы для аренды означают разное: у них разные '
          + 'арендаторы, разные площади и разный трафик.', 7900000, 1150000, 3700000, 2500000, 12, { color: '6D6D6D', id: 5 })]);
    }

    /* 7c. Конкурентная среда: предложение — таблица как в наших презентациях */
    if (C.parts.comp && D.comp && D.comp.length) {
      var ct = [['№', 'Объект', 'Тип', 'Откр.', 'GBA, м²', 'GLA, м²', 'Эт.', 'Точки', 'F&B', 'Парк.', 'Ставка', 'Расст., км']];
      D.comp.slice(0, 12).forEach(function (x, i) {
        ct.push([String(i + 1), x.name, x.type, x.year == null ? '—' : String(x.year),
          x.gba == null ? '—' : num(x.gba), x.gla == null ? '—' : num(x.gla),
          x.floors == null ? '—' : String(x.floors), x.units == null ? '—' : String(x.units),
          x.fb == null ? '—' : String(x.fb), x.park == null ? '—' : num(x.park),
          x.rent ? x.rent.text : '—', x.km.toFixed(1)]);
      });
      S.push([band(2),
        tx('Конкурентная среда', 600000, 260000, 11000000, 420000, 24, { bold: true, color: '9E0000', id: 3 }),
        tx('Предложение рядом с проектом', 600000, 700000, 11000000, 380000, 14, { color: '6D6D6D', id: 4 }),
        tbl(ct, 400000, 1250000, 11400000, 5),
        tx('Пустые ячейки — данных нет в базе; заполняются в карточке объекта. '
          + 'Расстояние по прямой от площадки.', 400000, 6100000, 11400000, 500000, 10, { color: '6D6D6D', id: 6 })]);
    }
    /* 7d. Заявленные ставки — «плавающие» столбцы min–max, наш проект чёрным */
    if (C.parts.rentChart && D.comp) {
      var withRent = D.comp.filter(function (x) { return x.rent; }).slice(0, 14);
      if (withRent.length) {
        var maxV = Math.max.apply(null, withRent.map(function (x) { return x.rent.max; }));
        var top = Math.ceil(maxV / 10) * 10 || 10;
        var X0 = 3100000, W = 8400000, Y0 = 1250000, RH = Math.min(360000, 4600000 / withRent.length);
        var sh = [band(2), tx('Заявленные ставки, $/м²/мес', 600000, 260000, 11000000, 460000, 24, { bold: true, color: '9E0000', id: 3 })];
        var id = 10;
        /* шкала и вертикальные линии сетки */
        for (var v = 0; v <= top; v += 10) {
          var gx = X0 + Math.round(W * v / top);
          sh.push(tx('$' + v, gx - 250000, 800000, 500000, 300000, 11, { align: 'ctr', color: '6D6D6D', id: id++ }));
          sh.push(rect(gx, Y0, 9525, RH * withRent.length, 'E5E7EB', id++));
        }
        withRent.forEach(function (x, i) {
          var y = Y0 + i * RH;
          sh.push(tx(x.name, 500000, y + Math.round(RH * 0.15), 2500000, RH, 11, { align: 'r', id: id++ }));
          var bx = X0 + Math.round(W * x.rent.min / top);
          var bw = Math.max(60000, Math.round(W * (x.rent.max - x.rent.min) / top));
          sh.push(rect(bx, y + Math.round(RH * 0.18), bw, Math.round(RH * 0.62), x.ours ? '111111' : '9E0000', id++));
          sh.push(tx(x.rent.text, bx + bw + 90000, y + Math.round(RH * 0.15), 1600000, RH, 10, { color: '6D6D6D', id: id++ }));
        });
        sh.push(tx('Чёрным — наши проекты. Показаны только объекты с заявленной ставкой '
          + '(' + withRent.length + ' из ' + D.comp.length + ').',
          500000, 6150000, 11000000, 500000, 10, { color: '6D6D6D', id: id++ }));
        S.push(sh);
      }
    }

    /* 8. Скоринг */
    var sc = [['Сценарий', 'Балл 0–100', 'Оценка']];
    SCORE_ROWS.forEach(function (r) {
      var v = sv(r[1]);
      sc.push([r[0], v == null ? 'нет данных' : String(v),
        v == null ? '—' : (v >= 55 ? 'хорошо' : v >= 40 ? 'умеренно' : 'слабо')]);
    });
    if (C.parts.scoring) S.push([band(2), tx('Быстрый скоринг локации', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tbl(sc, 600000, 1150000, 11000000, 4),
      tx('Формула: ' + formulaOf(C) + '\nЭто прозрачный расчёт, а не модель машинного обучения: любую цифру можно проверить руками.',
        600000, 3900000, 11000000, 1400000, 12, { color: '6D6D6D', id: 5 })]);
    /* 9. Источники и методика */
    var srcTxt = SOURCES;
    if (D.market && D.market.src) srcTxt += '\nРынок города: ' + D.market.src;
    S.push([band(2), tx('Источники и методика', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tx(srcTxt + '\n\nРадиусы анализа: ' + D.radii.join(', ') + ' м.'
        + '\nЭталоны насыщения этого проекта: БЦ ' + C.bench.bc + ', клиника ' + C.bench.med
        + ', F&B ' + C.bench.fnb + ', учебный центр ' + C.bench.edu + ' на километр.'
        + '\nОтчёт собран в CASE OS автоматически по данным на ' + new Date().toLocaleDateString('ru-RU') + '.'
        + '\nПодробные таблицы — в приложении Excel к этой презентации.',
        600000, 1200000, 11000000, 4000000, 14, { id: 4 })]);
    return S;
  }

  window.caseGeoExportPptx = function (mapPng) {
    var p = need(); if (!p) return;
    var slides = slidesFor(p, mapPng, detail(p));
    var files = [];
    var types = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="png" ContentType="image/png"/>'
      + '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
      + '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
      + '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
      + '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + slides.map(function (s, i) { return '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'; }).join('')
      + '</Types>';
    files.push({ name: '[Content_Types].xml', data: types });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      + '</Relationships>' });
    files.push({ name: 'ppt/presentation.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
      + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
      + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>'
      + slides.map(function (s, i) { return '<p:sldId id="' + (256 + i) + '" r:id="rId' + (i + 2) + '"/>'; }).join('')
      + '</p:sldIdLst><p:sldSz cx="' + SLIDE_W + '" cy="' + SLIDE_H + '"/><p:notesSz cx="' + SLIDE_H + '" cy="' + SLIDE_W + '"/></p:presentation>' });
    files.push({ name: 'ppt/_rels/presentation.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>'
      + slides.map(function (s, i) { return '<Relationship Id="rId' + (i + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + (i + 1) + '.xml"/>'; }).join('')
      + '<Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'
      + '</Relationships>' });
    files.push({ name: 'ppt/slideMasters/slideMaster1.xml', data: MASTER });
    files.push({ name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>'
      + '</Relationships>' });
    files.push({ name: 'ppt/slideLayouts/slideLayout1.xml', data: LAYOUT });
    files.push({ name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>'
      + '</Relationships>' });
    files.push({ name: 'ppt/theme/theme1.xml', data: THEME });
    /* docProps есть в любом файле, созданном Office. Формально необязательны,
       но офисные пакеты на них рассчитывают — кладём, чтобы не искать проблему
       потом на чужом компьютере. */
    files.push({ name: 'docProps/core.xml', data: coreXml(p) });
    files.push({ name: 'docProps/app.xml', data: appXml('Microsoft Office PowerPoint', slides.length) });
    slides.forEach(function (shapes, i) {
      files.push({ name: 'ppt/slides/slide' + (i + 1) + '.xml', data: slideXml(shapes) });
      var rels = '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>';
      if (mapPng && shapes.join('').indexOf('r:embed="rId2"') >= 0)
        rels += '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/map.png"/>';
      files.push({ name: 'ppt/slides/_rels/slide' + (i + 1) + '.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + '</Relationships>' });
    });
    if (mapPng) files.push({ name: 'ppt/media/map.png', data: mapPng });
    saveBlob(zipBuild(files), fname(p, 'pptx'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  };

  /* ================= снимок карты для презентации =================
     Картинки тайлов, вставленные Leaflet, «пачкают» холст: они пришли с чужого домена
     без разрешения на чтение, и браузер запрещает выгрузить такой холст. Ставить
     crossOrigin на сами слои нельзя — у части провайдеров (Google, Яндекс, 2GIS) нет
     заголовка CORS, и тогда подложка вообще перестала бы рисоваться.
     Поэтому тайлы догружаются отдельным запросом: у кого CORS есть — попадут в снимок,
     у кого нет — снимок не делается вовсе, и презентация собирается без карты.
     Пустую карту в презентацию класть нельзя: она выглядит как готовая, но врёт. */
  window.caseGeoMapPngAsync = async function () {
    try {
      if (!window.map || !window.L) return null;
      var cont = map.getContainer(), size = map.getSize();
      var cv = document.createElement('canvas');
      cv.width = size.x; cv.height = size.y;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#f5f6f8'; ctx.fillRect(0, 0, cv.width, cv.height);
      var box = cont.getBoundingClientRect();
      var tiles = [].slice.call(cont.querySelectorAll('img.leaflet-tile-loaded'));
      var drawn = 0;
      await Promise.all(tiles.map(async function (img) {
        var r = img.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        try {
          var resp = await fetch(img.src, { mode: 'cors', cache: 'force-cache' });
          if (!resp.ok) return;
          var bmp = await createImageBitmap(await resp.blob());
          ctx.drawImage(bmp, r.left - box.left, r.top - box.top, r.width, r.height);
          drawn++;
        } catch (e) { /* провайдер без CORS — тайл в снимок не попадёт */ }
      }));
      if (tiles.length && !drawn) return null;         /* подложки не будет — снимок не делаем */
      /* Векторные слои Leaflet рисует на своих холстах: они наши, холст не пачкают */
      var cvs = cont.querySelectorAll('canvas.leaflet-zoom-animated');
      for (var j = 0; j < cvs.length; j++) {
        var rc = cvs[j].getBoundingClientRect();
        try { ctx.drawImage(cvs[j], rc.left - box.left, rc.top - box.top, rc.width, rc.height); } catch (e) {}
      }
      var url = cv.toDataURL('image/png');
      var b64 = url.split(',')[1], bin = atob(b64), out = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
      return out;
    } catch (e) { return null; }
  };
  /* Синхронный вариант — на случай, когда тайлов нет вовсе (карта без подложки) */
  window.caseGeoMapPng = function () {
    try {
      if (!window.map || !window.L) return null;
      if (map.getContainer().querySelector('img.leaflet-tile-loaded')) return null;
      var size = map.getSize(), cv = document.createElement('canvas');
      cv.width = size.x; cv.height = size.y;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#f5f6f8'; ctx.fillRect(0, 0, cv.width, cv.height);
      var box = map.getContainer().getBoundingClientRect();
      var cvs = map.getContainer().querySelectorAll('canvas.leaflet-zoom-animated');
      for (var j = 0; j < cvs.length; j++) {
        var rc = cvs[j].getBoundingClientRect();
        try { ctx.drawImage(cvs[j], rc.left - box.left, rc.top - box.top, rc.width, rc.height); } catch (e) {}
      }
      var url = cv.toDataURL('image/png'), b64 = url.split(',')[1], bin = atob(b64), out = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
      return out;
    } catch (e) { return null; }
  };

  /* ================= одна кнопка: всё сразу ================= */
  window.caseGeoExportAll = async function () {
    var p = need(); if (!p) return;
    var c = cfgLoad();
    var png = c.parts.map ? await window.caseGeoMapPngAsync() : null;
    if (c.formats.xlsx) window.caseGeoExportXlsx();
    if (c.formats.pptx) setTimeout(function () { window.caseGeoExportPptx(png); }, 400);
    if (c.formats.pdf) setTimeout(function () { if (typeof exportProbePdf === 'function') exportProbePdf(); }, 900);
    if (!c.formats.xlsx && !c.formats.pptx && !c.formats.pdf)
      alert('В настройках выгрузки не выбран ни один формат файла.');
  };

  /* Аналитика по текущему проекту: считаем отчёт в точке проекта и выгружаем всё */
  window.caseGeoProjectReport = function (exportAfter) {
    var sel = document.getElementById('proj');
    var p = (typeof PROJECTS === 'object' && sel) ? PROJECTS[sel.value] : null;
    /* Пустая строка через +'' даёт ноль, поэтому проверяем parseFloat: иначе проект
       без координат «успешно» считался бы в точке 0,0 посреди Атлантики. */
    if (!p || !Number.isFinite(parseFloat(p.lat)) || !Number.isFinite(parseFloat(p.lng))) {
      alert('У выбранного проекта нет координат. Поставьте точку на карте: «Объекты» → «Указать точку».');
      return;
    }
    if (typeof probeAt !== 'function') return;
    Promise.resolve(probeAt(+p.lat, +p.lng)).then(function () {
      if (exportAfter) setTimeout(window.caseGeoExportAll, 600);
    });
  };

  /* Тот же список конкурентов, что уходит в файлы, — для отчёта по точке на экране.
     Считается по настройкам проекта, поэтому экран и выгрузка не расходятся. */
  window.caseGeoCompetitors = function (la, ln) {
    if (!isFinite(+la) || !isFinite(+ln)) return [];
    return competitors({ la: +la, ln: +ln }, cfgLoad());
  };
  /* Клик по строке открывает полную карточку объекта — со всеми полями и правкой */
  window.caseGeoOpenCompetitor = function (k, i) {
    if (typeof window.geoOpenMapRecord === 'function') window.geoOpenMapRecord(k, +i);
  };

  /* Свод по конкурентам — тот же расчёт для экрана и для файлов */
  window.caseGeoCompSummary = function (list, kind) { return compSummary(list || [], kind || 'office'); };

  window.caseDashFix = dsh;
  window.caseDashFixDoc = dshDoc;
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4530-geo-export'] = VERSION;
})();
