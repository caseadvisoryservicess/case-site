/* CASE OS v4.53.1 — выгрузка геоаналитики по проекту: PDF · Excel · PowerPoint.
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
  function xe(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\x00-\x08|\x0b|\x0c|\x0e-\x1f/g, '');
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
  var SCORE_ROWS = [
    ['Потенциал бизнес-центра', 'scoreBC'],
    ['Потенциал клиники', 'scoreMed'],
    ['Потенциал заведения F&B', 'scoreFnb'],
    ['Потенциал учебного центра', 'scoreEdu']
  ];
  var FORMULA = '0,55 × спрос (население 1 км / 25 000) + 0,45 × (1 − конкуренты / эталон). '
    + 'Эталоны: БЦ 6, клиника 8, F&B 25, учебный центр 5 на километр.';
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
      if (e.lat == null || e.lng == null) return;
      var d = hav(la, ln, +e.lat, +e.lng);
      if (d > km) return;
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
    var vis = api.visible(), keys = Object.keys(vis);
    if (!keys.length) return null;
    return keys.map(function (k) {
      var row = { key: k, label: api.label(k) };
      radii.forEach(function (r) { row['r' + r] = api.countIn([k], la, ln, r / 1000); });
      return row;
    });
  }
  function detail(p) {
    var RAD = p.radii || [500, 1000, 1500, 2000, 3000];
    var DIST = g('DIST'), popR = g('popR');
    var dRow = (DIST && p.d && DIST[p.d]) ? DIST[p.d] : null;
    var byDist1 = popByDistrict(p.la, p.ln, 1000), byDist3 = popByDistrict(p.la, p.ln, 3000);
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
    return {
      district: dRow ? { name: distName(p.d), pop: Math.round(dRow[0] * 1000), area: dRow[1],
        dens: Math.round(dRow[0] * 1000 / dRow[1]) } : null,
      districtsAll: (DIST ? Object.keys(DIST).map(function (k) {
        return { name: distName(k), pop: Math.round(DIST[k][0] * 1000), area: DIST[k][1],
          dens: Math.round(DIST[k][0] * 1000 / DIST[k][1]), here: (k === p.d) };
      }).sort(function (a, b) { return b.pop - a.pop; }) : []),
      pop: pop, byDist1: byDist1, byDist3: byDist3,
      metro: nearestMetro(p.la, p.ln, 6),
      bc: bcAround(p.la, p.ln, 3000),
      med1: medBySpecialty(p.la, p.ln, 1000), med3: medBySpecialty(p.la, p.ln, 3000),
      poi: poiAround(p.la, p.ln, RAD),
      market: g('MARKET') || null
    };
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
        return '<c r="' + ref + '" t="inlineStr"><is><t xml:space="preserve">' + xe(v) + '</t></is></c>';
      }).join('');
      return '<row r="' + (ri + 1) + '">' + cells + '</row>';
    }).join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + body + '</sheetData></worksheet>';
  }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = (i - 1 - m) / 26; } return s; }

  function buildSheets(p, D) {
    var RAD = p.radii || [500, 1000, 1500, 2000, 3000];

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
      var v = p[r[1]];
      scores.push([r[0], v == null ? 'нет данных' : v,
        v == null ? '—' : (v >= 55 ? 'хорошо' : v >= 40 ? 'умеренно' : 'слабо')]);
    });
    scores.push([], ['Формула', FORMULA], ['Источники', SOURCES]);

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
    var dRows = [['Район', 'Жителей в 1 км', 'Жителей в 3 км']];
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
    p.table.forEach(function (t) {
      rad.push([t.r, t.pop == null ? 'нет данных' : t.pop, t.bc, t.med, t.medProf, t.ph,
        t.fnb == null ? 'слой не загружен' : t.fnb, t.edu == null ? 'слой не загружен' : t.edu]);
    });

    /* 6. Бизнес-центры: полный список в 3 км + средние по классам */
    var bc = [['Бизнес-центр', 'Район', 'Расстояние, м', 'Класс', 'Ставка, $/м²/мес', 'Свободно, м²',
      'Продажа, $/м²', 'GLA, м²', 'Этажей', 'Адрес', 'Источник']];
    D.bc.forEach(function (x) {
      bc.push([x.name, x.district, Math.round(x.km * 1000), x.cls || '—',
        x.rent === '' ? '—' : (parseFloat(x.rent) || x.rent),
        x.avail === '' ? '—' : (parseFloat(x.avail) || x.avail),
        x.sale === '' ? '—' : (parseFloat(x.sale) || x.sale),
        x.gla === '' ? '—' : (parseFloat(x.gla) || x.gla), x.floors || '—', x.addr, x.prov]);
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
    var med = [['Направление медицины', 'В 1 км', 'В 3 км']];
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

    return [
      { name: 'Сводка', rows: head.concat(scores), w: [34, 46, 14] },
      { name: 'Население', rows: popRows, w: [12, 14, 18, 20, 18, 24] },
      { name: 'Население по районам', rows: dRows, w: [30, 18, 18] },
      { name: 'Районы города', rows: allRows, w: [28, 14, 16, 20, 14] },
      { name: 'Радиусы', rows: rad, w: [12, 14, 16, 12, 18, 10, 10, 14] },
      { name: 'Бизнес-центры', rows: bc, w: [34, 16, 15, 10, 18, 14, 15, 12, 10, 40, 14] },
      { name: 'Медицина', rows: med, w: [40, 12, 12] },
      { name: 'Городские объекты', rows: poi, w: [32, 10, 10, 10, 10, 10] },
      { name: 'Метро', rows: metro, w: [28, 22, 16, 20] },
      { name: 'Рынок города', rows: mkt, w: [42, 30] }
    ];
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
        + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
        + '</Relationships>' },
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
        + '<a:latin typeface="Arial"/></a:rPr><a:t>' + xe(line) + '</a:t></a:r></a:p>';
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
          + '<a:latin typeface="Arial"/></a:rPr><a:t>' + xe(c) + '</a:t></a:r></a:p></a:txBody>'
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
      + shapes.join('') + '</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" '
      + 'accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" '
      + 'hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sld>';
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
    var S = [], H = 660000;
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
    if (mapPng) {
      S.push([band(2), tx('Локация на карте', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        pic('rId2', 600000, 1100000, 11000000, 5000000, 4)]);
    }
    /* 3. Население: плотность и прирост по кольцам */
    var popRows = [['Радиус, м', 'Жителей', 'Плотность, чел/км²', 'Прирост в кольце', 'Доля района, %']];
    D.pop.forEach(function (t) {
      popRows.push([String(t.r), num(t.pop), t.dens == null ? '—' : num(t.dens),
        t.ring == null ? '—' : num(t.ring), t.shareDistrict == null ? '—' : String(t.shareDistrict)]);
    });
    var dtxt = D.district
      ? ('Район ' + D.district.name + ': ' + num(D.district.pop) + ' жителей, '
         + D.district.area + ' км², плотность ' + num(D.district.dens) + ' чел/км².')
      : 'Район проекта не определён.';
    S.push([band(2), tx('Население вокруг точки', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
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
    if (dr.length > 1) {
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
    var fnbRows = [['F&B в 1 км', 'Объектов']];
    if (p.fnbBreak) Object.keys(p.fnbBreak).forEach(function (k) {
      fnbRows.push([(p.poiLabels && p.poiLabels[k]) || k, String(p.fnbBreak[k])]);
    });
    if (fnbRows.length === 1) fnbRows.push(['Слои общепита не загружены', '—']);
    S.push([band(2), tx('Конкурентная среда', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tbl(bcRows, 600000, 1150000, 6600000, 4), tbl(fnbRows, 7500000, 1150000, 4100000, 5)]);
    /* 6. Медицина по направлениям */
    var med = [['Направление медицины', 'В 1 км', 'В 3 км']];
    var mk = {};
    [D.med1, D.med3].forEach(function (o) { if (o) Object.keys(o).forEach(function (k) { mk[k] = 1; }); });
    Object.keys(mk).sort(function (a, b) { return ((D.med3 && D.med3[b]) || 0) - ((D.med3 && D.med3[a]) || 0); })
      .slice(0, 9).forEach(function (k) { med.push([k, String((D.med1 && D.med1[k]) || 0), String((D.med3 && D.med3[k]) || 0)]); });
    if (med.length > 1) {
      var metro = [['Метро', 'Линия', 'Пешком']];
      D.metro.slice(0, 5).forEach(function (x) { metro.push([x.n, x.line, Math.round(x.km / 5 * 60) + ' мин']); });
      S.push([band(2), tx('Медицина и транспортная доступность', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        tbl(med, 600000, 1150000, 6600000, 4), tbl(metro, 7500000, 1150000, 4100000, 5)]);
    }
    /* 7. Городские объекты по слоям */
    if (D.poi && D.poi.length) {
      var RAD = p.radii || [500, 1000, 1500, 2000, 3000];
      var pr = [['Слой городских объектов'].concat(RAD.map(function (r) { return r + ' м'; }))];
      D.poi.slice(0, 10).forEach(function (row) {
        pr.push([row.label].concat(RAD.map(function (r) { return String(row['r' + r]); })));
      });
      S.push([band(2), tx('Городские объекты по радиусам', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
        tbl(pr, 600000, 1150000, 11000000, 4),
        tx('Считаются только включённые слои. Данные — OpenStreetMap через сервер CASE OS.',
          600000, 5400000, 11000000, 600000, 11, { color: '6D6D6D', id: 5 })]);
    }
    /* 8. Скоринг */
    var sc = [['Сценарий', 'Балл 0–100', 'Оценка']];
    SCORE_ROWS.forEach(function (r) {
      var v = p[r[1]];
      sc.push([r[0], v == null ? 'нет данных' : String(v),
        v == null ? '—' : (v >= 55 ? 'хорошо' : v >= 40 ? 'умеренно' : 'слабо')]);
    });
    S.push([band(2), tx('Быстрый скоринг локации', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tbl(sc, 600000, 1150000, 11000000, 4),
      tx('Формула: ' + FORMULA + '\nЭто прозрачный расчёт, а не модель машинного обучения: любую цифру можно проверить руками.',
        600000, 3900000, 11000000, 1400000, 12, { color: '6D6D6D', id: 5 })]);
    /* 9. Источники и методика */
    var srcTxt = SOURCES;
    if (D.market && D.market.src) srcTxt += '\nРынок города: ' + D.market.src;
    S.push([band(2), tx('Источники и методика', 600000, 300000, 11000000, H, 26, { bold: true, color: '9E0000', id: 3 }),
      tx(srcTxt + '\n\nРадиусы анализа: ' + (p.radii || []).join(', ') + ' м.'
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
      + slides.map(function (s, i) { return '<Override PartName="/ppt/slides/slide' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'; }).join('')
      + '</Types>';
    files.push({ name: '[Content_Types].xml', data: types });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>'
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
    var png = await window.caseGeoMapPngAsync();
    window.caseGeoExportXlsx();
    setTimeout(function () { window.caseGeoExportPptx(png); }, 400);
    setTimeout(function () { if (typeof exportProbePdf === 'function') exportProbePdf(); }, 900);
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

  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4530-geo-export'] = '4.53.1';
})();
