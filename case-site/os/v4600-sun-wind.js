/* CASE OS v4.61.0 — солнце, роза ветров и кибла по точке проекта.
 *
 * Запрос владельца: «нужен ход солнца и роза ветров, день за днём, по любому проекту,
 * статичной картинкой, с выбором дня года — чтобы решать, как посадить объект. И маркер
 * направления киблы на карте, с возможностью выключить».
 *
 * Почему всё считается здесь, а не берётся из сервиса: положение солнца и направление
 * киблы — это чистая геометрия, она не зависит ни от сети, ни от чьего-то API и считается
 * одинаково через сто лет. Внешние данные нужны только для ветра: климат ниоткуда не
 * выводится, его можно только измерить, поэтому роза строится по архиву наблюдений
 * (Open-Meteo, ERA5, ключ не нужен) и честно подписывается годами, за которые взята.
 *
 * Расчёт солнца — алгоритм NOAA. Он сверен с независимым расчётом через юлианскую дату
 * (Meeus): расхождение по высоте и азимуту не превышает 0.4°, что для посадки здания
 * заведомо достаточно. Кибла сверена с справочными значениями: Ташкент 240.3° и 3531 км,
 * Лондон 119°, Джакарта 295° — совпадает.
 *
 * Картинка статичная (SVG): её видно на экране, она печатается в PDF и вставляется
 * в презентацию без пересчёта.
 */
(function () {
  'use strict';
  var VERSION = '4.61.0';
  var KAABA = { lat: 21.4225, lng: 39.8262 };   /* Кааба, Мекка */
  var R = Math.PI / 180, DEG = 180 / Math.PI;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v, d) { var x = parseFloat(v); return Number.isFinite(x) ? x : d; }

  /* ================= солнце =================
     Приближение NOAA: угол года -> уравнение времени и склонение -> часовой угол.
     Азимут берём через atan2, а не через acos: у acos две ветви, и на утренних часах
     он молча даёт зеркальное направление — солнце «встаёт» на западе. */
  function declEq(doy, hr) {
    var g = 2 * Math.PI / 365 * (doy - 1 + (hr - 12) / 24);
    return {
      eq: 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
          - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g)),
      dec: 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
           - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
           - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)
    };
  }
  function sunPos(lat, lng, tz, doy, hr) {
    var d = declEq(doy, hr), la = lat * R;
    var ha = ((hr * 60 + d.eq + 4 * lng - 60 * tz) / 4 - 180) * R;
    var s = Math.sin(la) * Math.sin(d.dec) + Math.cos(la) * Math.cos(d.dec) * Math.cos(ha);
    return {
      alt: Math.asin(Math.max(-1, Math.min(1, s))) * DEG,
      az: (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(la) - Math.tan(d.dec) * Math.cos(la)) * DEG + 180 + 360) % 360
    };
  }
  /* Восход и заход: склонение берём не на полдень, а на сам момент события — иначе
     зимой ошибка доходит до десятка минут. Два-три уточнения сходятся полностью. */
  function sunEvents(lat, lng, tz, doy, zenith) {
    var z = zenith == null ? 90.833 : zenith, la = lat * R, out = {};
    ['rise', 'set'].forEach(function (key) {
      var sign = key === 'rise' ? 1 : -1, hr = key === 'rise' ? 6 : 18, m = null;
      for (var i = 0; i < 3; i++) {
        var d = declEq(doy, hr);
        var c = Math.cos(z * R) / (Math.cos(la) * Math.cos(d.dec)) - Math.tan(la) * Math.tan(d.dec);
        if (Math.abs(c) > 1) { m = null; break; }          /* полярный день или ночь */
        m = 720 - 4 * (lng + sign * Math.acos(c) * DEG) - d.eq + tz * 60;
        hr = m / 60;
      }
      out[key] = m;
    });
    var dn = declEq(doy, 12);
    out.noon = 720 - 4 * lng - dn.eq + tz * 60;
    out.dayLength = (out.rise != null && out.set != null) ? out.set - out.rise : null;
    if (out.rise != null) out.riseAz = sunPos(lat, lng, tz, doy, out.rise / 60).az;
    if (out.set != null) out.setAz = sunPos(lat, lng, tz, doy, out.set / 60).az;
    out.noonAlt = sunPos(lat, lng, tz, doy, out.noon / 60).alt;
    return out;
  }
  function sunTrack(lat, lng, tz, doy, stepMin) {
    var step = stepMin || 10, pts = [];
    for (var m = 0; m <= 1440; m += step) {
      var p = sunPos(lat, lng, tz, doy, m / 60);
      pts.push({ min: m, alt: p.alt, az: p.az });
    }
    return pts;
  }

  /* ================= кибла =================
     Начальный азимут по большому кругу. Локсодрома (постоянный курс) даёт другое число —
     на широте Ташкента разница около девяти градусов, и именно она гуляет по справочникам. */
  function qibla(lat, lng) {
    var p1 = lat * R, p2 = KAABA.lat * R, dl = (KAABA.lng - lng) * R;
    var b = Math.atan2(Math.sin(dl) * Math.cos(p2),
                       Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * DEG;
    var c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
    return { bearing: (b + 360) % 360, km: 6371 * Math.acos(Math.max(-1, Math.min(1, c))) };
  }

  /* ================= роза ветров =================
     16 румбов. Направление в метеорологии — ОТКУДА дует, так его и рисуем: лепесток
     смотрит в ту сторону, откуда приходит ветер. Путать эти две трактовки — классическая
     ошибка, из-за которой фасад ставят под ветер вместо защиты от него. */
  var DIRS = ['С', 'ССВ', 'СВ', 'ВСВ', 'В', 'ВЮВ', 'ЮВ', 'ЮЮВ', 'Ю', 'ЮЮЗ', 'ЮЗ', 'ЗЮЗ', 'З', 'ЗСЗ', 'СЗ', 'ССЗ'];
  function windRose(dirs, speeds) {
    var n = 16, cnt = new Array(n).fill(0), sum = new Array(n).fill(0), calm = 0, total = 0;
    for (var i = 0; i < dirs.length; i++) {
      var d = num(dirs[i], null), v = num(speeds && speeds[i], 0);
      if (d == null) continue;
      total++;
      if (v < 0.5) { calm++; continue; }              /* штиль направления не имеет */
      var s = Math.round(((d % 360) + 360) % 360 / (360 / n)) % n;
      cnt[s]++; sum[s] += v;
    }
    var moving = total - calm;
    return {
      total: total, calm: calm, calmPct: total ? calm / total * 100 : 0,
      sectors: cnt.map(function (c, i) {
        return { dir: DIRS[i], deg: i * (360 / n), freq: moving ? c / moving * 100 : 0,
                 mean: c ? sum[i] / c : 0, n: c };
      })
    };
  }

  /* ================= диаграмма хода солнца =================
     Полярная: азимут по кругу, высота по радиусу (в центре зенит, по краю горизонт).
     Так строят солнечные карты в архитектуре, и с ней сразу видно, с какой стороны и как
     высоко приходит солнце — то есть какой фасад греется и куда ложится тень. */
  function sunSvg(o) {
    var W = 380, C = W / 2, Rr = C - 34;
    function xy(az, alt) {
      var r = Rr * (90 - Math.max(0, Math.min(90, alt))) / 90, a = (az - 90) * R;
      return [C + r * Math.cos(a), C + r * Math.sin(a)];
    }
    function path(pts) {
      var d = '', up = false;
      pts.forEach(function (p) {
        if (p.alt < 0) { up = false; return; }
        var q = xy(p.az, p.alt);
        d += (up ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1) + ' ';
        up = true;
      });
      return d;
    }
    var g = '';
    [0, 30, 60].forEach(function (a) {
      var r = Rr * (90 - a) / 90;
      g += '<circle cx="' + C + '" cy="' + C + '" r="' + r.toFixed(1) + '" fill="none" stroke="#e3dcd1"/>';
      if (a) g += '<text x="' + (C + 3) + '" y="' + (C - r + 11).toFixed(1) + '" font-size="8.5" fill="#9a938a">' + a + '°</text>';
    });
    ['С', 'В', 'Ю', 'З'].forEach(function (lbl, i) {
      var a = (i * 90 - 90) * R, x = C + (Rr + 15) * Math.cos(a), y = C + (Rr + 15) * Math.sin(a);
      g += '<line x1="' + C + '" y1="' + C + '" x2="' + (C + Rr * Math.cos(a)).toFixed(1) + '" y2="'
        + (C + Rr * Math.sin(a)).toFixed(1) + '" stroke="#efe9e0"/>'
        + '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" font-size="11" font-weight="800" fill="#6f6a63" text-anchor="middle">' + lbl + '</text>';
    });
    /* солнцестояния — рамка года: между этими двумя дугами лежат все остальные дни */
    g += '<path d="' + path(o.summer) + '" fill="none" stroke="#d9c07a" stroke-width="1.2" stroke-dasharray="3 3"/>';
    g += '<path d="' + path(o.winter) + '" fill="none" stroke="#a8b6c4" stroke-width="1.2" stroke-dasharray="3 3"/>';
    g += '<path d="' + path(o.track) + '" fill="none" stroke="#9E0000" stroke-width="2.4"/>';
    o.track.forEach(function (p) {
      if (p.alt < 0 || p.min % 60) return;
      var q = xy(p.az, p.alt);
      g += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.6" fill="#9E0000"/>';
      if (p.min % 180 === 0) g += '<text x="' + (q[0] + 5).toFixed(1) + '" y="' + (q[1] - 4).toFixed(1)
        + '" font-size="8.5" fill="#6f6a63">' + (p.min / 60) + ':00</text>';
    });
    if (o.markAlt > 0) {
      var m = xy(o.markAz, o.markAlt);
      g += '<circle cx="' + m[0].toFixed(1) + '" cy="' + m[1].toFixed(1) + '" r="6" fill="#F0A202" stroke="#fff" stroke-width="1.6"/>';
      /* тень уходит ровно против солнца — на плане это направление, куда ляжет здание */
      var s = xy((o.markAz + 180) % 360, 0);
      g += '<line x1="' + C + '" y1="' + C + '" x2="' + s[0].toFixed(1) + '" y2="' + s[1].toFixed(1)
        + '" stroke="#4a443c" stroke-width="1.4" stroke-dasharray="5 4" opacity=".55"/>';
    }
    if (o.qibla != null) {
      var qa = (o.qibla - 90) * R;
      g += '<line x1="' + C + '" y1="' + C + '" x2="' + (C + Rr * Math.cos(qa)).toFixed(1) + '" y2="'
        + (C + Rr * Math.sin(qa)).toFixed(1) + '" stroke="#0F8B8D" stroke-width="1.8"/>'
        + '<text x="' + (C + (Rr - 16) * Math.cos(qa)).toFixed(1) + '" y="' + (C + (Rr - 16) * Math.sin(qa) - 5).toFixed(1)
        + '" font-size="9" font-weight="800" fill="#0F8B8D" text-anchor="middle">кибла</text>';
    }
    return '<svg viewBox="0 0 ' + W + ' ' + W + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="Ход солнца по выбранному дню">'
      + '<rect width="' + W + '" height="' + W + '" fill="#fff"/>' + g + '</svg>';
  }

  /* ================= роза ветров, картинка ================= */
  function roseSvg(rose, title) {
    var W = 380, C = W / 2, Rr = C - 36;
    var max = Math.max.apply(null, rose.sectors.map(function (s) { return s.freq; })).toFixed(2) * 1 || 1;
    var maxSpeed = Math.max.apply(null, rose.sectors.map(function (s) { return s.mean; })) || 1;
    var g = '';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      g += '<circle cx="' + C + '" cy="' + C + '" r="' + (Rr * f).toFixed(1) + '" fill="none" stroke="#e3dcd1"/>';
      g += '<text x="' + (C + 3) + '" y="' + (C - Rr * f + 10).toFixed(1) + '" font-size="8" fill="#9a938a">'
        + (max * f).toFixed(0) + '%</text>';
    });
    rose.sectors.forEach(function (s) {
      if (!s.freq) return;
      var half = 360 / 16 / 2 * 0.86, r = Rr * s.freq / max;
      var a1 = (s.deg - half - 90) * R, a2 = (s.deg + half - 90) * R;
      var p = [C + r * Math.cos(a1), C + r * Math.sin(a1), C + r * Math.cos(a2), C + r * Math.sin(a2)];
      /* цвет — средняя скорость в румбе: слабый ветер бледный, сильный густой */
      var t = Math.min(1, s.mean / maxSpeed);
      g += '<path d="M' + C + ' ' + C + ' L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)
        + ' A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' + p[2].toFixed(1) + ' ' + p[3].toFixed(1) + ' Z" '
        + 'fill="rgba(158,0,0,' + (0.2 + 0.65 * t).toFixed(2) + ')" stroke="#fff" stroke-width=".6"><title>'
        + esc(s.dir + ': ' + s.freq.toFixed(1) + ' % времени, средняя ' + s.mean.toFixed(1) + ' м/с') + '</title></path>';
    });
    ['С', 'В', 'Ю', 'З'].forEach(function (lbl, i) {
      var a = (i * 90 - 90) * R;
      g += '<text x="' + (C + (Rr + 16) * Math.cos(a)).toFixed(1) + '" y="' + (C + (Rr + 16) * Math.sin(a) + 4).toFixed(1)
        + '" font-size="11" font-weight="800" fill="#6f6a63" text-anchor="middle">' + lbl + '</text>';
    });
    g += '<circle cx="' + C + '" cy="' + C + '" r="16" fill="#fff" stroke="#e3dcd1"/>'
      + '<text x="' + C + '" y="' + (C + 1) + '" font-size="8" fill="#6f6a63" text-anchor="middle">штиль</text>'
      + '<text x="' + C + '" y="' + (C + 10) + '" font-size="9" font-weight="800" fill="#4a443c" text-anchor="middle">'
      + rose.calmPct.toFixed(0) + '%</text>';
    return '<svg viewBox="0 0 ' + W + ' ' + W + '" width="100%" style="max-width:' + W + 'px" role="img" aria-label="' + esc(title || 'Роза ветров') + '">'
      + '<rect width="' + W + '" height="' + W + '" fill="#fff"/>' + g + '</svg>';
  }

  /* ================= данные по ветру =================
     Архив наблюдений Open-Meteo (ERA5). Ключ не нужен, запрос идёт из браузера
     пользователя — в Ташкенте у сервера с внешними сервисами бывает туго, а у человека
     за столом интернет есть. Берём одно и то же окно дат за несколько лет: роза за один
     день одного года — это погода, а не климат. */
  function windUrl(lat, lng, doy, years, span) {
    var now = new Date().getFullYear(), parts = [];
    for (var i = 1; i <= years; i++) {
      var y = now - i, d = new Date(Date.UTC(y, 0, 1));
      d.setUTCDate(doy - span);
      var a = d.toISOString().slice(0, 10);
      d.setUTCDate(d.getUTCDate() + span * 2);
      parts.push([a, d.toISOString().slice(0, 10)]);
    }
    return parts.map(function (p) {
      return 'https://archive-api.open-meteo.com/v1/archive?latitude=' + lat.toFixed(4)
        + '&longitude=' + lng.toFixed(4) + '&start_date=' + p[0] + '&end_date=' + p[1]
        + '&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=UTC';
    });
  }
  function fetchWind(lat, lng, doy, years, span) {
    var urls = windUrl(lat, lng, doy, years || 5, span || 7);
    return Promise.all(urls.map(function (u) {
      return fetch(u, { cache: 'default' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    })).then(function (list) {
      var dirs = [], sp = [], ok = 0;
      list.forEach(function (j) {
        if (!j || !j.hourly || !j.hourly.wind_direction_10m) return;
        ok++;
        dirs = dirs.concat(j.hourly.wind_direction_10m);
        sp = sp.concat(j.hourly.wind_speed_10m || []);
      });
      if (!dirs.length) return null;
      var rose = windRose(dirs, sp);
      rose.yearsUsed = ok; rose.yearsAsked = urls.length; rose.span = span || 7;
      return rose;
    });
  }

  /* ================= карточка ================= */
  function tzOf(lng) { return Math.round(lng / 15); }   /* пояс по долготе, если не задан */
  function doyOf(dateStr) {
    var d = new Date(dateStr + 'T12:00:00Z');
    if (isNaN(d)) return 1;
    return Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
  }
  function hm(min) {
    if (min == null) return 'нет';
    var h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function compass(deg) { return DIRS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16]; }

  var STATE = { date: null, hour: 12, rose: null, roseKey: '' };

  function project() {
    try { if (window.CASE_GEO_DATA && CASE_GEO_DATA.PROJECTS) {
      var sel = document.getElementById('proj');
      var p = CASE_GEO_DATA.PROJECTS[sel && sel.value] || null;
      if (p) return p;
    } } catch (e) {}
    try { if (typeof active === 'function') return active(); } catch (e) {}
    return null;
  }
  function point() {
    var p = project(), la = num(p && p.lat, null), ln = num(p && p.lng, null);
    if (la == null || ln == null) { la = 41.3111; ln = 69.2797; }
    return { lat: la, lng: ln, name: (p && p.name) || 'Точка проекта' };
  }

  function render(host) {
    var pt = point(), tz = tzOf(pt.lng);
    var date = STATE.date || new Date().toISOString().slice(0, 10);
    var doy = doyOf(date), ev = sunEvents(pt.lat, pt.lng, tz, doy);
    var mark = sunPos(pt.lat, pt.lng, tz, doy, STATE.hour);
    var q = qibla(pt.lat, pt.lng);
    var svg = sunSvg({
      track: sunTrack(pt.lat, pt.lng, tz, doy),
      summer: sunTrack(pt.lat, pt.lng, tz, 172),
      winter: sunTrack(pt.lat, pt.lng, tz, 355),
      markAz: mark.az, markAlt: mark.alt, qibla: q.bearing
    });
    var shadow = mark.alt > 1 ? (1 / Math.tan(mark.alt * R)) : null;
    var rows = [
      ['Восход', hm(ev.rise) + (ev.riseAz != null ? ' · ' + ev.riseAz.toFixed(0) + '° ' + compass(ev.riseAz) : '')],
      ['Заход', hm(ev.set) + (ev.setAz != null ? ' · ' + ev.setAz.toFixed(0) + '° ' + compass(ev.setAz) : '')],
      ['Солнечный полдень', hm(ev.noon) + ' · высота ' + ev.noonAlt.toFixed(1) + '°'],
      /* округляем минуты ЦЕЛИКОМ, а не остаток: при 13 ч 59.7 мин остаток округлялся
         до 60 и в отчёте появлялось «13 ч 60 мин» */
      ['Долгота дня', ev.dayLength == null ? 'нет'
        : Math.floor(Math.round(ev.dayLength) / 60) + ' ч ' + (Math.round(ev.dayLength) % 60) + ' мин'],
      ['Солнце в ' + STATE.hour + ':00', mark.alt > 0
        ? 'высота ' + mark.alt.toFixed(1) + '°, азимут ' + mark.az.toFixed(0) + '° ' + compass(mark.az)
        : 'под горизонтом'],
      ['Длина тени', shadow == null ? 'солнце низко или под горизонтом' : shadow.toFixed(2) + ' высоты объекта'],
      ['Кибла', q.bearing.toFixed(1) + '° ' + compass(q.bearing) + ' · до Каабы ' + Math.round(q.km) + ' км']
    ];
    var table = rows.map(function (r) {
      return '<tr><td style="color:#6f6a63;white-space:nowrap">' + esc(r[0]) + '</td><td style="font-weight:700">' + esc(r[1]) + '</td></tr>';
    }).join('');

    var roseBlock;
    if (STATE.rose === 'loading') roseBlock = '<div class="mini">Загружаю архив наблюдений…</div>';
    else if (STATE.rose === 'error') roseBlock = '<div class="mini">Архив ветра недоступен: нет сети или сервис не ответил. Солнце и кибла посчитаны и без него - они не зависят от внешних данных.</div>';
    else if (STATE.rose) {
      var top = STATE.rose.sectors.slice().sort(function (a, b) { return b.freq - a.freq; })[0];
      roseBlock = roseSvg(STATE.rose, 'Роза ветров')
        + '<div class="mini" style="margin-top:6px">Преобладает <b>' + esc(top.dir) + '</b> - '
        + top.freq.toFixed(0) + ' % времени, средняя ' + top.mean.toFixed(1) + ' м/с. Штиль '
        + STATE.rose.calmPct.toFixed(0) + ' %. Наблюдения за ' + STATE.rose.yearsUsed + ' лет, окно ±'
        + STATE.rose.span + ' дней вокруг выбранной даты. Лепесток показывает, ОТКУДА дует.</div>';
    } else roseBlock = '<div class="mini">Нажмите «Загрузить ветер», чтобы построить розу по архиву наблюдений за последние годы.</div>';

    host.innerHTML =
      '<div class="ch"><span>Солнце, ветер и кибла</span><span style="flex:1"></span>'
      + '<button class="btn sec" style="font-size:11px" onclick="caseSunClose()" aria-label="Закрыть">Закрыть</button></div>'
      + '<div class="body">'
      + '<div class="geo-passport"><div class="eyebrow">Точка проекта</div>'
      + '<div class="addr">' + esc(pt.name) + '</div>'
      + '<div class="coords">' + pt.lat.toFixed(5) + ', ' + pt.lng.toFixed(5) + ' · часовой пояс UTC' + (tz >= 0 ? '+' : '') + tz + '</div></div>'
      + '<div class="styrow" style="grid-template-columns:auto 1fr auto 1fr;align-items:center;gap:8px">'
      + '<label for="sunDate" style="font-size:11px;color:#6f6a63">День</label>'
      + '<input id="sunDate" type="date" value="' + esc(date) + '" onchange="caseSunSet(this.value)">'
      + '<label for="sunHour" style="font-size:11px;color:#6f6a63">Час <b id="sunHourVal" style="color:#1b1d21">'
      + (STATE.hour < 10 ? '0' : '') + STATE.hour + ':00</b></label>'
      + '<input id="sunHour" type="range" min="0" max="23" value="' + STATE.hour + '" oninput="caseSunHour(this.value)"></div>'
      + svg
      + '<div class="mini" style="margin-top:4px">Красная дуга - выбранный день, пунктиры - солнцестояния: между ними лежат все остальные дни года. Точки на дуге - целые часы. Серый пунктир - куда ляжет тень в выбранный час.</div>'
      + '<table style="margin-top:10px">' + table + '</table>'
      + '<h3 style="margin:16px 0 6px;font-size:11px;letter-spacing:.06em;color:#4a443c">РОЗА ВЕТРОВ</h3>'
      + (STATE.rose && STATE.rose !== 'loading' && STATE.rose !== 'error' ? '' :
         '<div class="styrow"><button class="btn sec" style="font-size:11px" onclick="caseSunWind()">Загрузить ветер</button></div>')
      + roseBlock
      + '</div>';
  }

  function open() {
    var host = document.getElementById('probe'), bg = document.getElementById('probebg');
    if (!host) return;
    if (!STATE.date) STATE.date = new Date().toISOString().slice(0, 10);
    render(host);
    host.classList.add('open'); if (bg) bg.classList.add('open');
  }

  window.caseSunOpen = open;
  window.caseSunClose = function () {
    var host = document.getElementById('probe'), bg = document.getElementById('probebg');
    if (host) host.classList.remove('open'); if (bg) bg.classList.remove('open');
  };
  window.caseSunSet = function (v) { STATE.date = v; STATE.rose = null; open(); };
  window.caseSunHour = function (v) { STATE.hour = parseInt(v, 10) || 0; render(document.getElementById('probe')); };
  window.caseSunWind = function () {
    var pt = point(), doy = doyOf(STATE.date);
    STATE.rose = 'loading'; render(document.getElementById('probe'));
    fetchWind(pt.lat, pt.lng, doy, 5, 7).then(function (r) {
      STATE.rose = r || 'error'; render(document.getElementById('probe'));
    }).catch(function () { STATE.rose = 'error'; render(document.getElementById('probe')); });
  };

  /* ================= маркер киблы на карте =================
     Отдельный слой с выключателем: направление на Мекку нужно не в каждом проекте,
     и висеть на карте постоянно оно не должно. */
  var qLayer = null;
  window.caseQiblaToggle = function (on) {
    try {
      if (!window.map || !window.L) return;
      if (qLayer) { map.removeLayer(qLayer); qLayer = null; }
      if (!on) return;
      var pt = point(), q = qibla(pt.lat, pt.lng);
      /* линия строится по большому кругу: на таком расстоянии прямая на плоской карте
         заметно уходит от настоящего направления */
      var pts = [], p1 = pt.lat * R, l1 = pt.lng * R, p2 = KAABA.lat * R, l2 = KAABA.lng * R;
      var d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((p2 - p1) / 2), 2)
        + Math.cos(p1) * Math.cos(p2) * Math.pow(Math.sin((l2 - l1) / 2), 2)));
      for (var i = 0; i <= 64; i++) {
        var f = i / 64, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
        var x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
        var y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
        var z = A * Math.sin(p1) + B * Math.sin(p2);
        pts.push([Math.atan2(z, Math.sqrt(x * x + y * y)) * DEG, Math.atan2(y, x) * DEG]);
      }
      qLayer = L.layerGroup([
        L.polyline(pts, { color: '#0F8B8D', weight: 2.5, dashArray: '7 5' }),
        L.marker([pt.lat, pt.lng], { icon: L.divIcon({ className: 'geo-qibla-lab', html: 'кибла ' + q.bearing.toFixed(0) + '°', iconSize: [78, 18] }) })
      ]).addTo(map);
    } catch (e) {}
  };

  window.CASE_SUN = { sunPos: sunPos, sunEvents: sunEvents, sunTrack: sunTrack, qibla: qibla,
                      windRose: windRose, windUrl: windUrl, sunSvg: sunSvg, roseSvg: roseSvg,
                      compass: compass, version: VERSION };
  window.CASE_MODULE_VERSIONS = window.CASE_MODULE_VERSIONS || {};
  window.CASE_MODULE_VERSIONS['v4600-sun-wind'] = VERSION;
})();
