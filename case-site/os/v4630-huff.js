/* CASE OS v4.63.0 — модель Хаффа: сколько людей выберет нашу точку, а не соседнюю.
 *
 * Зачем. Все считают «жителей в радиусе». Это неправда: человек не идёт в ближайшую точку
 * механически — он выбирает между вариантами, взвешивая, насколько объект крупный и
 * насколько далеко. Радиус говорит «вокруг 40 тысяч человек», хотя в трёхстах метрах стоит
 * ТРЦ вчетверо больше и заберёт большую часть. Модель Хаффа отвечает на настоящий вопрос:
 * какую ДОЛЮ этих людей реально получит наш объект.
 *
 * Формула (Huff, 1964), классика геомаркетинга:
 *     P(i -> j) = (A_j^a / D_ij^b) / сумма по всем k (A_k^a / D_ik^b)
 *   A - привлекательность объекта (у нас арендопригодная площадь GLA, иначе GBA),
 *   D - расстояние от жилой ячейки до объекта,
 *   a - насколько сильно людей тянет размер (обычно 1),
 *   b - насколько быстро отталкивает расстояние (обычно 2; в пешей доступности больше).
 * Ожидаемый охват = сумма по жилым ячейкам: P(ячейка -> наш объект) * население ячейки.
 *
 * Что это даёт сверх «жителей в радиусе»:
 *   - честная оценка охвата с учётом конкурентов, а не круг на карте;
 *   - видно, У КОГО именно мы забираем людей - по каждому конкуренту своя доля;
 *   - каннибализация: сколько мы отнимем у СВОИХ же объектов. Для сети это главный вопрос
 *     при открытии новой точки, и радиусом он не считается в принципе.
 *
 * Честная граница метода: Хафф не знает о ценах, ассортименте, качестве и парковке. Он
 * объясняет выбор двумя переменными - размером и расстоянием. Поэтому здесь он не выдаётся
 * за прогноз выручки: он даёт долю рынка по площади и расстоянию, а не рубли.
 */
(function () {
  'use strict';
  var VERSION = '4.63.0';
  var MIN_KM = 0.05;   /* объект прямо под окнами: не даём расстоянию уйти в ноль */

  function num(v) { var x = parseFloat(v); return Number.isFinite(x) ? x : null; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dist(la1, ln1, la2, ln2) {
    var R = 6371, p = Math.PI / 180;
    var dLa = (la2 - la1) * p, dLn = (ln2 - ln1) * p;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2)
          + Math.cos(la1 * p) * Math.cos(la2 * p) * Math.sin(dLn / 2) * Math.sin(dLn / 2);
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, x)));
  }

  /* Привлекательность: арендопригодная площадь, иначе общая, иначе участок.
     Если площади нет ни у кого - модель бессмысленна, и мы об этом говорим, а не
     подставляем единицу молча: одинаковая привлекательность превращает Хаффа в
     «кто ближе, тот и забрал», что честнее назвать своим именем. */
  function attractOf(o) {
    return num(o.gla) || num(o.gba) || num(o.landArea) || null;
  }

  /* Доли выбора из одной жилой ячейки между всеми доступными объектами. */
  function shares(la, ln, objects, a, b) {
    var w = [], sum = 0;
    for (var i = 0; i < objects.length; i++) {
      var o = objects[i];
      var d = Math.max(MIN_KM, dist(la, ln, o.lat, o.lng));
      var u = Math.pow(o.attract, a) / Math.pow(d, b);
      w.push(u); sum += u;
    }
    if (!sum) return w.map(function () { return 0; });
    return w.map(function (u) { return u / sum; });
  }

  /* Основной расчёт.
     target      - наш объект {lat,lng,attract,name}
     competitors - массив тех же полей; у своих ставим ours:true
     popCells    - [[lat,lng,people], ...]
     opts        - {a,b,maxKm} */
  function catchment(target, competitors, popCells, opts) {
    opts = opts || {};
    var a = num(opts.a) != null ? num(opts.a) : 1;
    var b = num(opts.b) != null ? num(opts.b) : 2;
    var maxKm = num(opts.maxKm) || 5;

    var all = [target].concat(competitors);
    var got = 0, popIn = 0, cells = 0;
    var lost = competitors.map(function (c) { return { name: c.name, ours: !!c.ours, from: 0 }; });

    for (var i = 0; i < popCells.length; i++) {
      var c = popCells[i], la = c[0], ln = c[1], people = c[2];
      if (!(people > 0)) continue;
      if (dist(la, ln, target.lat, target.lng) > maxKm) continue;
      cells++; popIn += people;
      var s = shares(la, ln, all, a, b);
      got += s[0] * people;
      /* сколько эта ячейка отдаёт каждому конкуренту - по этому видно, у кого мы берём:
         без нас его доля была бы больше, и разница как раз и есть отнятое */
      var sWithout = shares(la, ln, competitors, a, b);
      for (var k = 0; k < competitors.length; k++) {
        lost[k].from += (sWithout[k] - s[k + 1]) * people;
      }
    }

    lost.forEach(function (x) { x.from = Math.round(x.from); });
    lost.sort(function (x, y) { return y.from - x.from; });
    var ourLoss = lost.filter(function (x) { return x.ours; })
                      .reduce(function (s, x) { return s + x.from; }, 0);

    return {
      captured: Math.round(got),
      popInRadius: Math.round(popIn),
      share: popIn ? got / popIn * 100 : 0,
      cells: cells,
      competitors: competitors.length,
      lost: lost,
      cannibalized: Math.round(ourLoss),
      cannibalShare: got ? ourLoss / got * 100 : 0,
      a: a, b: b, maxKm: maxKm
    };
  }

  /* Готовим набор объектов из данных студии: конкуренты нужной категории с площадью. */
  function objectsFrom(rows, ownerMark) {
    var out = [];
    (rows || []).forEach(function (r) {
      var la = num(r.lat), ln = num(r.lng), at = attractOf(r);
      if (la == null || ln == null || !(at > 0)) return;
      out.push({ lat: la, lng: ln, attract: at, name: r.name || 'без названия',
                 ours: !!(ownerMark && ownerMark(r)) });
    });
    return out;
  }

  /* Картинка: горизонтальные полосы «у кого сколько забираем».
     Статичный SVG - печатается и вставляется в презентацию без пересчёта. */
  function lostSvg(res, topN) {
    var top = res.lost.filter(function (x) { return x.from > 0; }).slice(0, topN || 8);
    if (!top.length) return '<div class="mini">Конкурентов с площадью в зоне нет - забирать не у кого.</div>';
    /* ширину полосы считаем с запасом под число справа: при полной ширине подпись
       уезжала за край картинки, и у самого крупного конкурента цифра пропадала */
    var max = top[0].from || 1, W = 380, rowH = 22, H = top.length * rowH + 10;
    var LAB = 150, NUM = 62, BAR = W - LAB - NUM;
    var g = top.map(function (x, i) {
      var w = Math.max(2, BAR * x.from / max), y = i * rowH + 6;
      return '<text x="0" y="' + (y + 11) + '" font-size="10.5" fill="#4a443c">'
        + esc(x.name.slice(0, 20)) + (x.ours ? ' <tspan fill="#9E0000" font-weight="800">свой</tspan>' : '') + '</text>'
        + '<rect x="' + LAB + '" y="' + y + '" width="' + w.toFixed(1) + '" height="14" rx="3" fill="'
        + (x.ours ? '#9E0000' : '#0d7a6f') + '" opacity="' + (x.ours ? '.85' : '.55') + '"/>'
        + '<text x="' + (LAB + w + 5).toFixed(1) + '" y="' + (y + 11) + '" font-size="10" font-weight="700" fill="#4a443c">'
        + x.from.toLocaleString('ru') + '</text>';
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" role="img"'
      + ' aria-label="У кого объект забирает посетителей"><rect width="' + W + '" height="' + H + '" fill="#fff"/>'
      + g + '</svg>';
  }


  /* ================= карточка в студии ================= */
  var CATS = [
    { k: 'bc', label: 'Бизнес-центры', src: 'bc' },
    { k: 'shopping', label: 'ТРЦ и торговые центры', src: 'poi' },
    { k: 'supermarkets', label: 'Супермаркеты', src: 'poi' },
    { k: 'markets', label: 'Рынки и базары', src: 'poi' },
    { k: 'street_retail', label: 'Стрит-ритейл', src: 'poi' },
    { k: 'hotels', label: 'Гостиницы', src: 'poi' }
  ];
  var ST = { cat: 'shopping', a: 1, b: 2, maxKm: 3, attract: '', res: null };

  function project() {
    try {
      var sel = document.getElementById('proj');
      if (window.CASE_GEO_DATA && CASE_GEO_DATA.PROJECTS && sel) {
        var p = CASE_GEO_DATA.PROJECTS[sel.value];
        if (p) return p;
      }
    } catch (e) {}
    return null;
  }
  function popCells() {
    try { if (window.CASE_GEO_DATA && Array.isArray(CASE_GEO_DATA.POP)) return CASE_GEO_DATA.POP; } catch (e) {}
    return [];
  }
  function rowsOf(cat) {
    var c = CATS.filter(function (x) { return x.k === cat; })[0];
    if (!c) return [];
    if (c.src === 'bc') {
      try { return (window.CASE_GEO_DATA && CASE_GEO_DATA.BC) || []; } catch (e) { return []; }
    }
    try { return (window.CASE_GEO_POI && CASE_GEO_POI.rows(cat)) || []; } catch (e) { return []; }
  }
  /* свой объект — из портфеля CASE либо помеченный как наш поставщик */
  function isOurs(r) {
    return /CASE|наш/i.test(String(r.provider || '')) || r.ours === true || r.portfolio === true;
  }

  function render(host) {
    var p = project();
    var la = num(p && p.lat), ln = num(p && p.lng);
    var pop = popCells();
    var rows = rowsOf(ST.cat);
    var objs = objectsFrom(rows, isOurs);
    var withArea = objs.length, total = rows.length;
    var myAttract = num(ST.attract) || attractOf(p || {}) || null;

    var body;
    if (la == null || ln == null) {
      body = '<div class="mini">У выбранного проекта нет координат — задайте точку на карте, иначе считать не от чего.</div>';
    } else if (!pop.length) {
      body = '<div class="mini">Не загружены ячейки населения — без них доля рынка не считается.</div>';
    } else if (!withArea) {
      body = '<div class="mini">Ни у одного объекта категории «' + esc((CATS.filter(function (x) { return x.k === ST.cat; })[0] || {}).label || ST.cat)
        + '» не заполнена площадь (GLA или GBA). Модель Хаффа взвешивает объекты именно по площади, поэтому без неё расчёт невозможен — '
        + 'заполните площади в карточках объектов или включите и загрузите слой.</div>';
    } else if (!myAttract) {
      body = '<div class="mini">Не задана площадь нашего объекта — укажите её в поле выше: именно она определяет, какую долю мы забираем.</div>';
    } else {
      var res = catchment({ lat: la, lng: ln, attract: myAttract, name: (p && p.name) || 'наш объект' },
                          objs, pop, { a: ST.a, b: ST.b, maxKm: ST.maxKm });
      ST.res = res;
      var naive = res.popInRadius;
      body =
        '<table style="margin:8px 0">'
        + '<tr><td style="color:#6f6a63">Жителей в радиусе ' + ST.maxKm + ' км</td><td style="font-weight:700">' + naive.toLocaleString('ru') + '</td></tr>'
        + '<tr><td style="color:#6f6a63">Из них выберут нас</td><td style="font-weight:800;color:#9E0000">' + res.captured.toLocaleString('ru')
        + ' <span style="font-weight:600;color:#6f6a63">(' + res.share.toFixed(1) + ' %)</span></td></tr>'
        + '<tr><td style="color:#6f6a63">Конкурентов в расчёте</td><td style="font-weight:700">' + withArea
        + (total > withArea ? ' <span style="font-weight:600;color:#6f6a63">из ' + total + ' — у остальных нет площади</span>' : '') + '</td></tr>'
        + (res.cannibalized > 0
            ? '<tr><td style="color:#6f6a63">Отнимем у своих же</td><td style="font-weight:800;color:#9E0000">'
              + res.cannibalized.toLocaleString('ru') + ' <span style="font-weight:600;color:#6f6a63">('
              + res.cannibalShare.toFixed(0) + ' % нашего охвата)</span></td></tr>'
            : '')
        + '</table>'
        + '<div class="mini" style="margin-bottom:8px">Радиус обещает ' + naive.toLocaleString('ru')
        + ' человек, модель — ' + res.captured.toLocaleString('ru') + '. Разницу забирают соседи: круг на карте не учитывает, '
        + 'что рядом стоит объект крупнее.</div>'
        + '<h3 style="margin:14px 0 6px;font-size:11px;letter-spacing:.06em;color:#4a443c">У КОГО ЗАБИРАЕМ</h3>'
        + lostSvg(res);
    }

    host.innerHTML =
      '<div class="ch"><span>Доля рынка по модели Хаффа</span><span style="flex:1"></span>'
      + '<button class="btn sec" style="font-size:11px" onclick="caseHuffClose()">Закрыть</button></div>'
      + '<div class="body">'
      + '<div class="geo-passport"><div class="eyebrow">Точка проекта</div>'
      + '<div class="addr">' + esc((p && p.name) || 'проект не выбран') + '</div>'
      + '<div class="coords">' + (la == null ? 'координаты не заданы' : la.toFixed(5) + ', ' + ln.toFixed(5)) + '</div></div>'
      + '<div class="styrow" style="grid-template-columns:auto 1fr;gap:8px;align-items:center">'
      + '<label for="huffCat" style="font-size:11px;color:#6f6a63">Конкурируем с</label>'
      + '<select id="huffCat" onchange="caseHuffSet(\'cat\',this.value)">'
      + CATS.map(function (c) { return '<option value="' + c.k + '"' + (ST.cat === c.k ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('')
      + '</select></div>'
      + '<div class="styrow" style="grid-template-columns:auto 1fr auto 1fr;gap:8px;align-items:center">'
      + '<label for="huffArea" style="font-size:11px;color:#6f6a63">Наша GLA, м²</label>'
      + '<input id="huffArea" type="number" min="0" step="100" value="' + (myAttract || '') + '" onchange="caseHuffSet(\'attract\',this.value)">'
      + '<label for="huffR" style="font-size:11px;color:#6f6a63">Радиус, км</label>'
      + '<input id="huffR" type="number" min="0.5" max="15" step="0.5" value="' + ST.maxKm + '" onchange="caseHuffSet(\'maxKm\',this.value)"></div>'
      + '<div class="styrow" style="grid-template-columns:auto 1fr auto 1fr;gap:8px;align-items:center">'
      + '<label for="huffA" style="font-size:11px;color:#6f6a63" title="насколько людей тянет размер объекта">Вес размера</label>'
      + '<input id="huffA" type="number" min="0" max="3" step="0.1" value="' + ST.a + '" onchange="caseHuffSet(\'a\',this.value)">'
      + '<label for="huffB" style="font-size:11px;color:#6f6a63" title="насколько быстро отталкивает расстояние; для пешей доступности больше">Вес расстояния</label>'
      + '<input id="huffB" type="number" min="0.5" max="4" step="0.1" value="' + ST.b + '" onchange="caseHuffSet(\'b\',this.value)"></div>'
      + body
      + '<div class="mini" style="margin-top:10px;border-top:1px solid #e3dcd1;padding-top:8px">'
      + 'Модель объясняет выбор двумя вещами: размером объекта и расстоянием до него. Она не знает о ценах, '
      + 'арендаторах, качестве и парковке — поэтому это доля рынка по площади и доступности, а не прогноз выручки.</div>'
      + '</div>';
  }

  window.caseHuffOpen = function () {
    var host = document.getElementById('probe'), bg = document.getElementById('probebg');
    if (!host) return;
    render(host);
    host.classList.add('open'); if (bg) bg.classList.add('open');
  };
  window.caseHuffClose = function () {
    var host = document.getElementById('probe'), bg = document.getElementById('probebg');
    if (host) host.classList.remove('open'); if (bg) bg.classList.remove('open');
  };
  window.caseHuffSet = function (k, v) {
    if (k === 'cat' || k === 'attract') ST[k] = v; else ST[k] = num(v) != null ? num(v) : ST[k];
    render(document.getElementById('probe'));
  };
  window.CASE_HUFF = {
    version: VERSION,
    dist: dist, shares: shares, catchment: catchment,
    objectsFrom: objectsFrom, attractOf: attractOf, lostSvg: lostSvg, MIN_KM: MIN_KM,
    open: window.caseHuffOpen
  };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4630-huff'] = VERSION;
})();
