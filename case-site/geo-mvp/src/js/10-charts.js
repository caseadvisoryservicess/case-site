/* ===========================================================================
 * 10-charts — hand-rolled inline SVG charts, plus the table view
 *
 * Brief §14, visual-system §5 and §7. There is no chart library: every chart
 * here plots ONE series, so a library's categorical palette would spend the
 * identity channel re-encoding what bar length already shows.
 *
 * Division of labour, as stated at the top of 06-charts.css:
 *   CSS — fill, stroke, type, weight, hover, transitions, the table view.
 *   JS  — all geometry: the ≤24px bar thickness, the 4px rounded data-end with
 *         a square baseline (drawn as a path, because SVG `rx` rounds all four
 *         corners), the 2px surface gap between touching segments, and tick
 *         values rounded to clean numbers.
 *
 * Four rules this file exists to enforce:
 *
 * A. THE UNKNOWN BUCKET IS ALWAYS DRAWN, NEVER DROPPED (visual-system §5).
 *    It is `--unknown` PLUS a 45° hatch — texture, not hue, so it survives
 *    greyscale print and colour-vision deficiency — and it is always directly
 *    labelled with its count. Hiding it would misrepresent coverage.
 *
 * B. A SUPPRESSED GROUP IS NOT A ZERO. A row whose value is `null` (a mean the
 *    analytics layer refused to publish at n < 3) draws NO bar and says
 *    "Insufficient verified data" where the bar would be. Plotting it at zero
 *    is the exact §36 failure this product exists to avoid.
 *
 * C. NO VALUE IS GATED BEHIND COLOUR OR HOVER. Every chart carries a table
 *    toggle rendering the same numbers as a real <table>, and a coverage line
 *    underneath. The toggle is removed — not shown inert — when there is no
 *    table to show (§29: no fake controls).
 *
 * D. TEXT NEVER WEARS THE DATA COLOUR. Direct labels sit outside the mark, so
 *    the scale gives up room for them rather than printing white text on red.
 *
 * Callers pass metric/aggregate objects from GEO.analytics. Nothing in this
 * file reads a record: it has no way to turn an unknown into a zero.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, Q = GEO.dom, el = Q.el, U = GEO.util, F = GEO.fmt, t = GEO.i18n.t;

  var C = GEO.charts = {};

  var NS = 'http://www.w3.org/2000/svg';

  /* Mark geometry (visual-system §7). Every number here is JS's to own. */
  var BAR_MAX  = 24;    /* a bar never fills its band — the leftover is air   */
  var BAND_H   = 30;    /* 30 − 24 = 6px of surface between adjacent bars     */
  var COV_BAND = 26;    /* the coverage chart runs to ~20 rows, so it is tighter */
  var COV_TH   = 16;
  var SEG_GAP  = 2;     /* between two touching segments of one row          */
  var END_R    = 4;     /* rounded data-end; the baseline end stays square    */
  var DOT_R    = 5;
  var LANE_H   = 64;    /* strip-plot jitter lane                            */
  var COL_H    = 170;   /* default column plot height                        */
  var CAT_PX   = 12;    /* .c-cat  — --fs-sm                                 */
  var TICK_PX  = 11;    /* .c-tick — --fs-xs                                 */
  var MIN_W    = 240;
  var FALLBACK_W = 560; /* used only while the container cannot be measured  */

  /* ========================================================== SVG helpers == */

  /* The SVG twin of GEO.dom.el. `document.createElement('rect')` makes an
     HTMLUnknownElement that never paints, so SVG needs createElementNS. Like
     el(), every text value goes through textContent and is escaped by
     construction — the dataset is third-party scraped text. */
  function svgEl(spec, attrs, kids) {
    var m = /^([a-zA-Z]+)?((?:\.[\w-]+)*)$/.exec(spec) || [];
    var node = document.createElementNS(NS, m[1] || 'g');
    var cls = (m[2] || '').split('.').filter(function (s) { return !!s; });
    if (cls.length) node.setAttribute('class', cls.join(' '));
    setAttrs(node, attrs);
    appendKids(node, kids);
    return node;
  }

  function appendKids(node, kids) {
    (Array.isArray(kids) ? kids : (kids ? [kids] : [])).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  /* SVGElement.classList and .dataset are late arrivals in old Safari, so every
     attribute goes through setAttribute — including class and data-*. */
  function setAttrs(node, attrs) {
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'text') { node.textContent = (v === null || v === undefined) ? '' : String(v); return; }
      if (v === null || v === undefined || v === false) { node.removeAttribute(k); return; }
      node.setAttribute(k, v === true ? '' : v);
    });
    return node;
  }

  function n2(v) { return Math.round(v * 100) / 100; }

  /**
   * Horizontal bar: SQUARE at the baseline (left), 4px ROUNDED at the data end.
   * `rx` on a <rect> rounds all four corners, which would round the baseline
   * too and make the bar look like it floats off its own axis.
   */
  function hBarPath(x, y, len, h, r) {
    if (!(len > 0.5)) return 'M' + n2(x) + ',' + n2(y) + 'h0';
    r = Math.min(r, h / 2, len);
    var x1 = x + len;
    if (r < 0.5) {
      return 'M' + n2(x) + ',' + n2(y) + 'H' + n2(x1) + 'V' + n2(y + h) + 'H' + n2(x) + 'Z';
    }
    return 'M' + n2(x) + ',' + n2(y) +
           'H' + n2(x1 - r) +
           'A' + n2(r) + ',' + n2(r) + ' 0 0 1 ' + n2(x1) + ',' + n2(y + r) +
           'V' + n2(y + h - r) +
           'A' + n2(r) + ',' + n2(r) + ' 0 0 1 ' + n2(x1 - r) + ',' + n2(y + h) +
           'H' + n2(x) + 'Z';
  }

  /** Vertical column: square on the baseline (bottom), rounded at the top. */
  function vBarPath(x, baseY, len, wdt, r) {
    if (!(len > 0.5)) return 'M' + n2(x) + ',' + n2(baseY) + 'h0';
    r = Math.min(r, wdt / 2, len);
    var yTop = baseY - len;
    if (r < 0.5) {
      return 'M' + n2(x) + ',' + n2(baseY) + 'V' + n2(yTop) + 'H' + n2(x + wdt) + 'V' + n2(baseY) + 'Z';
    }
    return 'M' + n2(x) + ',' + n2(baseY) +
           'V' + n2(yTop + r) +
           'A' + n2(r) + ',' + n2(r) + ' 0 0 1 ' + n2(x + r) + ',' + n2(yTop) +
           'H' + n2(x + wdt - r) +
           'A' + n2(r) + ',' + n2(r) + ' 0 0 1 ' + n2(x + wdt) + ',' + n2(yTop + r) +
           'V' + n2(baseY) + 'Z';
  }

  /* No text metrics without a layout pass, and a pass per label would cost more
     than the truncation is worth. Inter's average advance at these sizes is
     ~0.55em; the estimate is deliberately generous so labels never collide. */
  function textW(s, px) { return String(s).length * px * 0.58; }

  function maxTextW(list, px) {
    var m = 0;
    list.forEach(function (s) { m = Math.max(m, textW(s, px)); });
    return m;
  }

  /* Axis ticks land on clean numbers, so printing "20.0" where the tick is 20
     adds a decimal the data never claimed. */
  function autoNum(v) {
    return F.num(v, Math.abs(v - Math.round(v)) < 1e-9 ? 0 : 1);
  }

  function truncate(s, maxPx, px) {
    s = String(s === null || s === undefined ? '' : s);
    if (textW(s, px) <= maxPx) return s;
    var keep = Math.max(1, Math.floor(maxPx / (px * 0.58)) - 1);
    return s.slice(0, keep) + '…';
  }

  /* Ticks land on 1 / 2 / 2.5 / 5 × 10ⁿ so the axis reads as round commercial
     numbers rather than as whatever the data's maximum happened to be. */
  function niceStep(raw) {
    if (!(raw > 0)) return 1;
    var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  }

  function ticksFromZero(max, count) {
    if (!(max > 0)) return { ticks: [0], max: 1 };
    var step = niceStep(max / Math.max(1, count));
    var top = Math.ceil(max / step - 1e-9) * step;
    var out = [], v = 0;
    while (v <= top + step * 1e-6) { out.push(Math.round(v * 1e6) / 1e6); v += step; }
    return { ticks: out, max: top };
  }

  function ticksInRange(lo, hi, count) {
    if (!(hi > lo)) return [lo];
    var step = niceStep((hi - lo) / Math.max(1, count));
    var out = [], v = Math.ceil(lo / step - 1e-9) * step;
    while (v <= hi + step * 1e-6) { out.push(Math.round(v * 1e6) / 1e6); v += step; }
    return out.length ? out : [lo, hi];
  }

  /* Deterministic cross-axis jitter. Seeded from the point's own key so a
     redraw never shuffles the dots under the reader's cursor, and applied to
     the cross axis ONLY — moving a dot along the value axis would change the
     value it reports. */
  function jitter(seed, amp) {
    var h = 2166136261, i, s = String(seed);
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return ((h % 2000) / 1000 - 1) * amp;
  }

  /* =========================================================== instances == */

  var seq = 0;
  var instances = [];

  function findInstance(container, key) {
    for (var i = 0; i < instances.length; i++) {
      if (instances[i].container === container && instances[i].key === key) return instances[i];
    }
    return null;
  }

  function hatchId(inst) { return inst.id + '-hatch'; }

  /* 1px --surface lines at 4px pitch over an --unknown ground, rotated 45°.
     The id is per instance: several charts share one document, and duplicate
     ids would make every `url(#…)` resolve to whichever pattern loaded first. */
  function hatchPattern(inst) {
    return svgEl('pattern', {
      id: hatchId(inst), width: 4, height: 4,
      patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
    }, [
      svgEl('rect.c-hatch-bg', { x: 0, y: 0, width: 4, height: 4 }),
      svgEl('line.c-hatch-line', { x1: 0, y1: 0, x2: 0, y2: 4 })
    ]);
  }

  function measure(inst) {
    var r = inst.plot.getBoundingClientRect ? inst.plot.getBoundingClientRect() : null;
    var px = (r && r.width) || inst.plot.clientWidth || 0;
    /* A chart inside an inactive tab measures 0. Draw at a sane default and let
       the observer redraw the moment it is shown, rather than committing a
       zero-width SVG that looks broken when the tab opens. */
    return Math.max(MIN_W, Math.round(px) || FALLBACK_W);
  }

  function observe(inst) {
    inst.onSize = U.debounce(function () {
      if (!inst.node || !inst.node.parentNode) return;
      if (inst.view !== 'chart' || inst.bad) return;
      var wNow = measure(inst);
      if (Math.abs(wNow - inst.lastW) < 3) return;     /* height changes are ours */
      inst.meta = {};
      inst.draw(inst);
    }, 120);

    if (w.ResizeObserver) {
      try {
        inst.ro = new w.ResizeObserver(function () { inst.onSize(); });
        inst.ro.observe(inst.plot);
        return;
      } catch (e) { inst.ro = null; }
    }
    inst.onWin = function () { inst.onSize(); };
    w.addEventListener('resize', inst.onWin);
  }

  /* ============================================================== frame ==== */

  function buildFrame(container, type, spec, draw, table) {
    var id = 'geo-chart-' + (++seq);
    var inst = {
      id: id, key: spec.key || '', container: container, type: type, spec: spec,
      draw: draw, table: table, view: 'chart', meta: {}, model: null,
      bad: null, lastW: 0, ro: null, onWin: null
    };

    inst.titleText = document.createTextNode('');
    inst.sub = el('div.chart__sub', { hidden: true });
    inst.title = el('div.chart__title', { id: id + '-title' }, [inst.titleText, inst.sub]);

    inst.btnChart = el('button', {
      type: 'button', 'aria-pressed': 'true',
      'aria-label': t('analytics.chart.asChart'), text: t('analytics.chart.chart'),
      onclick: function () { setView(inst, 'chart'); }
    });
    inst.btnTable = el('button', {
      type: 'button', 'aria-pressed': 'false',
      'aria-label': t('analytics.chart.asTable'), text: t('analytics.chart.table'),
      onclick: function () { setView(inst, 'table'); }
    });
    inst.toggle = el('div.chart__toggle', { role: 'group', 'aria-label': t('analytics.chart.view') },
                     [inst.btnChart, inst.btnTable]);

    inst.gGrid  = svgEl('g');
    inst.gMarks = svgEl('g');
    inst.gAxis  = svgEl('g');
    inst.gLab   = svgEl('g');
    inst.svg = svgEl('svg.chart__svg', {
      preserveAspectRatio: 'xMinYMin meet', focusable: 'false', role: 'img'
    }, [svgEl('defs', {}, [hatchPattern(inst)]), inst.gGrid, inst.gMarks, inst.gAxis, inst.gLab]);

    inst.tip = el('div.chart__tip', { hidden: true, 'aria-hidden': 'true' });
    inst.plot = el('div.chart__plot', {}, [inst.svg, inst.tip]);
    inst.insuf = el('div.chart__insufficient', { hidden: true });
    inst.tableHost = el('div', { hidden: true });
    inst.viewBox = el('div.chart__view', {}, [inst.insuf, inst.plot, inst.tableHost]);

    inst.cov = el('p.chart__cov.coverage', {});
    inst.note = el('p.chart__cov.coverage', { hidden: true });
    inst.hd = el('div.chart__hd', {}, [inst.title, inst.toggle]);

    inst.node = el('section.chart', { role: 'group', 'aria-labelledby': id + '-title' },
                   [inst.hd, inst.viewBox, inst.cov, inst.note]);

    wirePlot(inst);
    if (inst.key) container.appendChild(inst.node);
    else Q.fill(container, [inst.node]);
    observe(inst);
    return inst;
  }

  /* One delegated listener set per chart, on the HTML plot wrapper. Marks are
     reused across redraws so the CSS growth transition has something to
     animate; re-binding listeners to reused nodes would stack duplicates. */
  function wirePlot(inst) {
    function markOf(target) {
      var node = target;
      while (node && node !== inst.plot) {
        if (node.getAttribute && node.getAttribute('data-mkey')) return node;
        node = node.parentNode;
      }
      return null;
    }
    inst.plot.addEventListener('mouseover', function (e) {
      var m = markOf(e.target);
      if (m) showTip(inst, m);
    });
    inst.plot.addEventListener('mouseout', function (e) {
      if (markOf(e.target)) hideTip(inst);
    });
    inst.plot.addEventListener('focusin', function (e) {
      var m = markOf(e.target);
      if (m) showTip(inst, m);
    });
    inst.plot.addEventListener('focusout', function () { hideTip(inst); });
    inst.plot.addEventListener('click', function (e) {
      var m = markOf(e.target);
      if (m) activate(inst, m, e);
    });
    inst.plot.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var m = markOf(e.target);
      if (!m) return;
      e.preventDefault();
      activate(inst, m, e);
    });
  }

  function activate(inst, mark, ev) {
    var meta = inst.meta[mark.getAttribute('data-mkey')];
    if (meta && meta.onActivate) meta.onActivate(ev);
  }

  function setText(node, str) {
    node.textContent = str || '';
    node.hidden = !str;
  }

  function setView(inst, view) {
    if (inst.view === view) return;
    inst.view = view;
    applyView(inst);
  }

  function refresh(inst) {
    var spec = inst.spec;
    inst.titleText.nodeValue = spec.title || '';
    setText(inst.sub, spec.sub);
    setText(inst.cov, spec.coverageText);
    setText(inst.note, spec.note);

    inst.bad = insufficiencyOf(inst);
    inst.model = inst.table ? inst.table(inst) : null;

    /* §29: a toggle that would open an empty table is a fake control, so it is
       removed rather than shown inert. */
    var hasTable = !!(inst.model && inst.model.rows.length);
    inst.toggle.hidden = !hasTable;
    if (!hasTable && inst.view === 'table') inst.view = 'chart';

    applyView(inst);
  }

  function applyView(inst) {
    var isChart = inst.view === 'chart';
    inst.btnChart.setAttribute('aria-pressed', isChart ? 'true' : 'false');
    inst.btnTable.setAttribute('aria-pressed', isChart ? 'false' : 'true');
    hideTip(inst);

    if (inst.bad) {
      inst.node.classList.add('chart--insufficient');
      Q.fill(inst.insuf, [
        el('div.chart__insufficient-title', { text: t('common.insufficient') }),
        el('div.chart__insufficient-why', { text: inst.bad.reason })
      ]);
      inst.insuf.hidden = !isChart;
      inst.meta = {};
      Q.clear(inst.gGrid); Q.clear(inst.gMarks); Q.clear(inst.gAxis); Q.clear(inst.gLab);
    } else {
      inst.node.classList.remove('chart--insufficient');
      inst.insuf.hidden = true;
      inst.plot.hidden = !isChart;
      if (isChart) { inst.meta = {}; inst.draw(inst); }
    }

    inst.tableHost.hidden = isChart;
    if (!isChart) Q.fill(inst.tableHost, [buildTable(inst)]);
  }

  function mount(container, type, spec, draw, table) {
    if (!container) return null;
    var key = spec.key || '';
    var inst = findInstance(container, key);
    if (inst && inst.type === type && inst.node && inst.node.parentNode === container) {
      inst.spec = spec; inst.draw = draw; inst.table = table;
      refresh(inst);
      return inst.node;
    }
    if (inst) removeInstance(inst);
    else if (!key) C.destroy(container);
    inst = buildFrame(container, type, spec, draw, table);
    instances.push(inst);
    refresh(inst);
    return inst.node;
  }

  function removeInstance(inst) {
    if (inst.ro) { try { inst.ro.disconnect(); } catch (e) { /* already gone */ } }
    if (inst.onWin) w.removeEventListener('resize', inst.onWin);
    if (inst.node && inst.node.parentNode) inst.node.parentNode.removeChild(inst.node);
    instances = instances.filter(function (i) { return i !== inst; });
  }

  function insufficiencyOf(inst) {
    var s = inst.spec;
    if (inst.type === 'insufficient') {
      return { reason: s.reason || t('analytics.chart.empty') };
    }
    if (s.insufficient) {
      return { reason: (typeof s.insufficient === 'object' && s.insufficient.reason) ||
                       s.reason || t('analytics.chart.empty') };
    }
    var n = inst.type === 'strip' ? (s.points || []).length : (s.rows || []).length;
    return n ? null : { reason: s.reason || t('analytics.chart.empty') };
  }

  /* ============================================================ tooltip ==== */

  function showTip(inst, mark) {
    var m = inst.meta[mark.getAttribute('data-mkey')];
    if (!m) return;
    /* Category, value with its share, and the coverage caveat — the tooltip
       repeats the denominator rather than showing a number on its own. */
    Q.fill(inst.tip, [
      el('div.chart__tip-title', { text: m.line }),
      m.extra ? el('div.chart__tip-val', { text: m.extra }) : null,
      m.note ? el('div.chart__tip-note', { text: m.note }) : null
    ]);
    inst.tip.hidden = false;

    var pr = inst.plot.getBoundingClientRect();
    var mr = mark.getBoundingClientRect();
    var tw = inst.tip.offsetWidth, th = inst.tip.offsetHeight;
    var left = U.clamp(mr.left - pr.left + mr.width / 2 - tw / 2, 0, Math.max(0, pr.width - tw));
    var top = mr.top - pr.top - th - 8;
    if (top < 0) top = mr.top - pr.top + mr.height + 8;
    inst.tip.style.left = Math.round(left) + 'px';
    inst.tip.style.top = Math.round(top) + 'px';
  }

  function hideTip(inst) {
    if (inst.tip && !inst.tip.hidden) inst.tip.hidden = true;
  }

  /**
   * The one place a mark's hover text, its accessible name and its click
   * behaviour are decided together, so the three can never disagree.
   */
  function meta(inst, key, o) {
    inst.meta[key] = o;
    return o;
  }

  /* ============================================================== table ==== */

  /* The table view is not a fallback, it is the guarantee: no value in this
     product is reachable only by hovering a mark or by telling two fills apart.
     When a mark is clickable the table's category cell is a real <button> with
     the same action, because focusing an SVG node is unreliable in older
     browsers and the keyboard route must not depend on it. */
  function buildTable(inst) {
    var m = inst.model || { columns: [], rows: [] };
    var head = el('tr', {}, m.columns.map(function (c) {
      return el('th' + (c.num ? '.tbl__num' : ''), { scope: 'col', text: c.label });
    }));
    var body = m.rows.map(function (r) {
      return el('tr', { 'data-unknown': r.unknown ? 'true' : null }, r.cells.map(function (c) {
        var kid = c.action
          ? el('button.btn.btn--quiet.btn--sm', {
              type: 'button', 'aria-label': c.actionLabel || c.text, text: c.text,
              onclick: c.action
            })
          : c.text;
        return el('td' + (c.num ? '.tbl__num' : ''), {}, [kid]);
      }));
    });
    return el('table.chart__table', {}, [
      el('caption.vh', { text: (inst.spec.title ? inst.spec.title + ' — ' : '') + t('a11y.chartTable') }),
      el('thead', {}, [head]),
      el('tbody', {}, body)
    ]);
  }

  /* ============================================================== marks ==== */

  /* Redraws reuse the mark element for a given key and only rewrite its
     geometry, which is what lets `transition: d/width/height/y` in
     06-charts.css animate the 220ms bar growth instead of snapping. Marks whose
     key has gone are removed. */
  function syncMarks(layer, items) {
    var existing = {}, kids = layer.childNodes, i, node, k;
    for (i = 0; i < kids.length; i++) {
      node = kids[i];
      k = node.getAttribute && node.getAttribute('data-mkey');
      if (k) existing[k] = node;
    }
    var used = {};
    items.forEach(function (it) {
      var n = existing[it.key];
      if (!n || n.tagName !== it.tag) {
        if (n && n.parentNode) n.parentNode.removeChild(n);
        n = document.createElementNS(NS, it.tag);
        layer.appendChild(n);
      }
      setAttrs(n, it.attrs);
      n.setAttribute('data-mkey', it.key);
      used[it.key] = true;
    });
    Object.keys(existing).forEach(function (key) {
      if (!used[key] && existing[key].parentNode) existing[key].parentNode.removeChild(existing[key]);
    });
  }

  function barClasses(spec, row) {
    var c = 'c-bar';
    if (row.unknown) c += ' c-bar--unknown';
    if (spec.onBarClick) c += ' c-bar--clickable';
    return c;
  }

  /* `.c-bar { fill: var(--data) }` is a stylesheet rule, and a stylesheet rule
     beats a presentation attribute — so the hatch (and any caller-supplied
     colour) is written as an inline style, which beats both. The presentation
     attribute is kept as well for exporters that ignore inline styles. */
  function paint(inst, spec, row, attrs) {
    if (row.unknown) {
      var url = 'url(#' + hatchId(inst) + ')';
      attrs.fill = url;
      attrs.style = 'fill:' + url;
    } else if (row.color) {
      attrs.style = 'fill:' + row.color;
    } else if (spec.ordinal) {
      /* Office class is the dimension here, so the bar wears the ordinal ramp.
         06-charts.css maps the attribute to the validated hexes — this file
         never names a colour. */
      attrs['data-class'] = row.key;
    }
    return attrs;
  }

  function interactive(spec, row, attrs) {
    if (!spec.onBarClick) return attrs;
    attrs.tabindex = '0';
    attrs.role = 'button';
    attrs['aria-label'] = t('analytics.chart.filterAction', { category: row.label });
    return attrs;
  }

  function rowValueText(row, fmtV) {
    return typeof row.value === 'number' ? fmtV(row.value) : t('common.insufficient');
  }

  function shareText(row, total) {
    if (!(total > 0) || typeof row.value !== 'number') return null;
    return F.pct(row.value / total * 100, 0);
  }

  /** A share needs a stated denominator. Summing group *means* would invent a
   *  meaningless one, so the row sum is only a default when the bars are counts
   *  (no `measure` declared) and no row was suppressed. */
  function totalOf(spec, rows) {
    if (typeof spec.total === 'number') return spec.total;
    if (spec.total === null || spec.measure) return 0;
    var sum = 0, ok = true;
    rows.forEach(function (r) {
      if (typeof r.value !== 'number') ok = false;
      else sum += r.value;
    });
    return ok ? sum : 0;
  }

  function registerBarMeta(inst, spec, row, key, fmtV, total) {
    var valueText = rowValueText(row, fmtV);
    var share = shareText(row, total);
    var line = (total > 0 && share !== null)
      ? t('analytics.chart.tooltip', { category: row.label, n: valueText, m: F.int(total), pct: share })
      : t('analytics.chart.tip.plain', { label: row.label, value: valueText });
    meta(inst, key, {
      line: line,
      extra: null,
      note: row.unknown ? t('analytics.chart.unknownNote')
                        : (typeof row.value !== 'number' ? row.reason || null : spec.coverageText || null),
      onActivate: spec.onBarClick ? function (ev) { spec.onBarClick(row, ev); } : null
    });
  }

  /* The top bar and the unknown bar are the only ones that carry a number: a
     value on every bar turns the plot into a table with decoration. */
  function topIndex(rows) {
    var best = -1, bestV = -Infinity;
    rows.forEach(function (r, i) {
      if (r.unknown || typeof r.value !== 'number') return;
      if (r.value > bestV) { bestV = r.value; best = i; }
    });
    return best;
  }

  function unknownLabel(row, fmtV) {
    return t('analytics.chart.unknownBar', { n: rowValueText(row, fmtV) });
  }

  function svgFrame(inst, W, H, interactiveMarks) {
    inst.lastW = W;
    inst.svg.setAttribute('viewBox', '0 0 ' + n2(W) + ' ' + n2(H));
    inst.svg.setAttribute('height', Math.round(H));
    /* role="img" hides the children from assistive tech, which is right when
       the table view carries the data — but wrong when the bars are buttons. */
    inst.svg.setAttribute('role', interactiveMarks ? 'group' : 'img');
    if (interactiveMarks) inst.svg.removeAttribute('aria-label');
    else inst.svg.setAttribute('aria-label',
      [inst.spec.title, inst.spec.coverageText].filter(function (s) { return !!s; }).join('. '));
  }

  /* ========================================================= bar chart ===== */

  function drawBars(inst) {
    var spec = inst.spec, rows = spec.rows || [];
    var W = measure(inst);
    var fmtV = spec.valueFormat || F.int;
    var total = totalOf(spec, rows);
    var top = topIndex(rows);

    /* Direct labels sit outside the bar tip, so the scale gives up room for
       them — printing them on the mark would mean text in (or on) the data
       colour, which visual-system §7 forbids. */
    var direct = [];
    rows.forEach(function (r, i) {
      if (r.unknown) direct.push(unknownLabel(r, fmtV));
      else if (i === top) direct.push(fmtV(r.value));
    });
    var labelPad = direct.length ? U.clamp(maxTextW(direct, TICK_PX) + 12, 44, 150) : 8;

    var gutter = U.clamp(Math.round(W * 0.36), 76, 170);
    var x0 = gutter;
    var scaleW = Math.max(40, W - gutter - 4 - labelPad);
    var maxV = 0;
    rows.forEach(function (r) { if (typeof r.value === 'number' && r.value > maxV) maxV = r.value; });
    var tk = ticksFromZero(maxV, U.clamp(Math.round(scaleW / 90), 2, 6));
    var sx = function (v) { return scaleW * (v / tk.max); };

    var top0 = 4;
    var plotH = rows.length * BAND_H;
    var axisY = top0 + plotH;
    var H = axisY + 20 + (spec.axisTitle ? 14 : 0);

    /* ---- grid: 1px SOLID, recessive, never dashed ---- */
    var grid = [svgEl('line.c-base', { x1: n2(x0), y1: top0, x2: n2(x0), y2: n2(axisY) })];
    tk.ticks.forEach(function (v) {
      if (v === 0) return;
      var x = x0 + sx(v);
      grid.push(svgEl('line.c-grid', { x1: n2(x), y1: top0, x2: n2(x), y2: n2(axisY) }));
    });
    Q.fill(inst.gGrid, grid);

    /* ---- marks ---- */
    var marks = [], labels = [];
    rows.forEach(function (r, i) {
      var key = String(r.key === undefined ? i : r.key);
      var y = top0 + i * BAND_H + (BAND_H - BAR_MAX) / 2;
      var cy = y + BAR_MAX / 2 + 4;                     /* optical baseline for 12px type */

      labels.push(svgEl('text.c-cat' + (r.unknown ? '.c-cat--unknown' : ''), {
        x: n2(gutter - 8), y: n2(cy), 'text-anchor': 'end',
        text: truncate(r.label, gutter - 12, CAT_PX)
      }));

      if (typeof r.value !== 'number') {
        /* B: a suppressed mean is not a zero-length bar. It says so in words,
           on the plot, where the bar the reader is looking for would be. */
        labels.push(svgEl('text.c-tick', {
          x: n2(x0 + 4), y: n2(cy), 'text-anchor': 'start',
          text: truncate(t('common.insufficient'), scaleW + labelPad - 8, TICK_PX)
        }));
        registerBarMeta(inst, spec, r, key, fmtV, total);
        return;
      }

      var len = sx(r.value);
      marks.push({
        key: key, tag: 'path',
        attrs: interactive(spec, r, paint(inst, spec, r, {
          'class': barClasses(spec, r),
          d: hBarPath(x0, y, len, BAR_MAX, END_R)
        }))
      });
      registerBarMeta(inst, spec, r, key, fmtV, total);

      /* Selective direct labels: the top bar, the unknown bar — and a measured
         zero, which otherwise draws nothing at all and would be indistinguishable
         from "we never looked" (§36). */
      if (r.unknown || i === top || r.value === 0) {
        labels.push(svgEl('text.c-label', {
          x: n2(x0 + len + 6), y: n2(cy), 'text-anchor': 'start',
          text: r.unknown ? unknownLabel(r, fmtV) : fmtV(r.value)
        }));
      }
    });
    syncMarks(inst.gMarks, marks);
    Q.fill(inst.gLab, labels);

    /* ---- axis ---- */
    var axis = [];
    tk.ticks.forEach(function (v, i) {
      axis.push(svgEl('text.c-tick', {
        x: n2(x0 + sx(v)), y: n2(axisY + 14),
        'text-anchor': i === 0 ? 'start' : (i === tk.ticks.length - 1 ? 'end' : 'middle'),
        text: (spec.tickFormat || F.int)(v)
      }));
    });
    if (spec.axisTitle) {
      axis.push(svgEl('text.c-axis-title', {
        x: n2(x0 + scaleW / 2), y: n2(axisY + 30), 'text-anchor': 'middle', text: spec.axisTitle
      }));
    }
    Q.fill(inst.gAxis, axis);

    svgFrame(inst, W, H, !!spec.onBarClick);
  }

  function tableBars(inst) {
    var spec = inst.spec, rows = spec.rows || [];
    var fmtV = spec.valueFormat || F.int;
    var total = totalOf(spec, rows);
    var cols = [
      { label: spec.categoryLabel || t('analytics.chart.col.category') },
      { label: spec.valueLabel || t('analytics.chart.col.value'), num: true }
    ];
    if (total > 0) cols.push({ label: t('analytics.chart.col.share'), num: true });

    return {
      columns: cols,
      rows: rows.map(function (r, i) {
        var cells = [{
          text: r.label,
          action: spec.onBarClick ? function (ev) { spec.onBarClick(r, ev); } : null,
          actionLabel: spec.onBarClick ? t('analytics.chart.filterAction', { category: r.label }) : null
        }, {
          text: rowValueText(r, fmtV), num: true
        }];
        if (total > 0) cells.push({ text: shareText(r, total) || F.UNKNOWN, num: true });
        return { key: String(r.key === undefined ? i : r.key), unknown: !!r.unknown, cells: cells };
      })
    };
  }

  /* ====================================================== column chart ===== */

  function drawColumns(inst) {
    var spec = inst.spec, rows = spec.rows || [];
    var W = measure(inst);
    var fmtV = spec.valueFormat || F.int;
    var total = totalOf(spec, rows);
    var top = topIndex(rows);

    var maxV = 0;
    rows.forEach(function (r) { if (typeof r.value === 'number' && r.value > maxV) maxV = r.value; });
    var plotH = spec.height || COL_H;
    var tk = ticksFromZero(maxV, U.clamp(Math.round(plotH / 40), 2, 5));

    var padL = U.clamp(maxTextW(tk.ticks.map(spec.tickFormat || F.int), TICK_PX) + 10, 26, 64);
    var padT = 18;                                        /* room for the direct label */
    var padR = 6;
    var plotW = Math.max(60, W - padL - padR);
    var baseY = padT + plotH;
    var catH = 18;
    var H = baseY + catH + (spec.axisTitle ? 14 : 0) + 4;

    var band = plotW / Math.max(1, rows.length);
    var th = U.clamp(band - 8, 6, BAR_MAX);               /* ≥2px of surface either side */
    var sy = function (v) { return plotH * (v / tk.max); };

    var grid = [svgEl('line.c-base', { x1: n2(padL), y1: n2(baseY), x2: n2(padL + plotW), y2: n2(baseY) })];
    tk.ticks.forEach(function (v) {
      if (v === 0) return;
      var y = baseY - sy(v);
      grid.push(svgEl('line.c-grid', { x1: n2(padL), y1: n2(y), x2: n2(padL + plotW), y2: n2(y) }));
    });
    Q.fill(inst.gGrid, grid);

    var marks = [], labels = [];
    rows.forEach(function (r, i) {
      var key = String(r.key === undefined ? i : r.key);
      var cx = padL + band * i + band / 2;
      var x = cx - th / 2;

      /* A suppressed column has no mark at all — a column of zero height would
         read as a measured zero. Its category label carries the recessive
         unknown style and the table view states the reason in full. */
      var suppressed = typeof r.value !== 'number';
      labels.push(svgEl('text.c-cat' + (r.unknown || suppressed ? '.c-cat--unknown' : ''), {
        x: n2(cx), y: n2(baseY + 14), 'text-anchor': 'middle',
        text: truncate(r.label, band - 2, TICK_PX)
      }));

      if (suppressed) return;

      var len = sy(r.value);
      marks.push({
        key: key, tag: 'path',
        attrs: interactive(spec, r, paint(inst, spec, r, {
          'class': barClasses(spec, r),
          d: vBarPath(x, baseY, len, th, END_R)
        }))
      });
      registerBarMeta(inst, spec, r, key, fmtV, total);

      /* Top column, unknown column, and any measured zero — see drawBars. */
      if (r.unknown || i === top || r.value === 0) {
        var txt = r.unknown ? unknownLabel(r, fmtV) : fmtV(r.value);
        var half = textW(txt, TICK_PX) / 2;
        var anchor = (cx - half < padL) ? 'start' : ((cx + half > padL + plotW) ? 'end' : 'middle');
        labels.push(svgEl('text.c-label', {
          x: n2(anchor === 'start' ? padL : (anchor === 'end' ? padL + plotW : cx)),
          y: n2(baseY - len - 6), 'text-anchor': anchor, text: txt
        }));
      }
    });
    syncMarks(inst.gMarks, marks);
    Q.fill(inst.gLab, labels);

    var axis = [];
    tk.ticks.forEach(function (v) {
      axis.push(svgEl('text.c-tick', {
        x: n2(padL - 6), y: n2(baseY - sy(v) + 4), 'text-anchor': 'end',
        text: (spec.tickFormat || F.int)(v)
      }));
    });
    if (spec.axisTitle) {
      axis.push(svgEl('text.c-axis-title', {
        x: n2(padL + plotW / 2), y: n2(baseY + catH + 12), 'text-anchor': 'middle', text: spec.axisTitle
      }));
    }
    Q.fill(inst.gAxis, axis);

    svgFrame(inst, W, H, !!spec.onBarClick);
  }

  /* ========================================================= strip plot ==== */

  /* D10. Below n = 30 the individual values are plotted: 16 values across 7
     bins is noise that implies a distribution the data cannot support, while
     16 values on a number line is evidence. */
  function drawStrip(inst) {
    var spec = inst.spec, pts = spec.points || [];
    var W = measure(inst);
    var fmtV = spec.valueFormat || function (v) { return F.num(v, 1); };

    var vals = pts.map(function (p) { return p.value; });
    var lo = typeof spec.min === 'number' ? spec.min : Math.min.apply(null, vals);
    var hi = typeof spec.max === 'number' ? spec.max : Math.max.apply(null, vals);
    if (!(hi > lo)) { lo = lo - 1; hi = hi + 1; }        /* one distinct value still needs a line */
    var pad = (hi - lo) * 0.06;
    var d0 = lo - pad, d1 = hi + pad;

    var padL = 14, padR = 14, padT = 20;
    var plotW = Math.max(60, W - padL - padR);
    var sx = function (v) { return padL + plotW * (v - d0) / (d1 - d0); };
    var axisY = padT + LANE_H / 2;
    var H = padT + LANE_H + 24 + (spec.axisTitle ? 14 : 0);
    var amp = LANE_H / 2 - DOT_R - 4;

    Q.fill(inst.gGrid, [svgEl('line.c-strip-axis', {
      x1: n2(padL), y1: n2(axisY), x2: n2(padL + plotW), y2: n2(axisY)
    })]);

    /* Mean / median rules are labelled in words beside the plot: a bare dashed
       line is a threshold the reader has to guess at. */
    var marks = [], labels = [];
    (spec.refs || []).forEach(function (ref) {
      if (typeof ref.value !== 'number') return;
      var x = sx(ref.value);
      labels.push(svgEl('line.c-ref', { x1: n2(x), y1: n2(padT - 8), x2: n2(x), y2: n2(padT + LANE_H) }));
      labels.push(svgEl('text.c-ref-label', {
        x: n2(U.clamp(x, padL, padL + plotW)), y: n2(padT - 12),
        'text-anchor': x > padL + plotW - 60 ? 'end' : 'start',
        text: ref.label
      }));
    });

    pts.forEach(function (p, i) {
      var key = String(p.key === undefined ? (p.id === undefined ? i : p.id) : p.key);
      var cls = 'c-strip-dot' + (spec.onPointClick ? ' c-strip-dot--clickable' : '') +
                (p.selected ? ' c-strip-dot--selected' : '');
      var attrs = {
        'class': cls, cx: n2(sx(p.value)), cy: n2(axisY + jitter(key, amp)), r: DOT_R,
        /* 2px --surface ring so overlapping dots stay legible; inline because
           the stylesheet's 1px rule would otherwise win the cascade. */
        style: 'stroke-width:2' + (p.color ? ';fill:' + p.color : '')
      };
      if (spec.onPointClick) {
        attrs.tabindex = '0';
        attrs.role = 'button';
        attrs['aria-label'] = t('analytics.chart.tip.plain', { label: p.label, value: fmtV(p.value) });
      }
      marks.push({ key: key, tag: 'circle', attrs: attrs });
      meta(inst, key, {
        line: t('analytics.chart.tip.plain', { label: p.label, value: fmtV(p.value) }),
        extra: p.sub || null,
        note: spec.coverageText || null,
        onActivate: spec.onPointClick ? function (ev) { spec.onPointClick(p, ev); } : null
      });
    });
    syncMarks(inst.gMarks, marks);
    Q.fill(inst.gLab, labels);

    var axis = [], tickFmt = spec.tickFormat || autoNum;
    ticksInRange(d0, d1, U.clamp(Math.round(plotW / 80), 2, 7)).forEach(function (v) {
      var half = textW(tickFmt(v), TICK_PX) / 2;
      axis.push(svgEl('text.c-tick', {
        x: n2(U.clamp(sx(v), padL + half, Math.max(padL + half, padL + plotW - half))),
        y: n2(padT + LANE_H + 14), 'text-anchor': 'middle', text: tickFmt(v)
      }));
    });
    if (spec.axisTitle) {
      axis.push(svgEl('text.c-axis-title', {
        x: n2(padL + plotW / 2), y: n2(padT + LANE_H + 28), 'text-anchor': 'middle', text: spec.axisTitle
      }));
    }
    Q.fill(inst.gAxis, axis);

    svgFrame(inst, W, H, !!spec.onPointClick);
  }

  function tableStrip(inst) {
    var spec = inst.spec;
    var fmtV = spec.valueFormat || function (v) { return F.num(v, 1); };
    var pts = (spec.points || []).slice().sort(function (a, b) { return b.value - a.value; });
    return {
      columns: [
        { label: spec.categoryLabel || t('analytics.chart.col.property') },
        { label: spec.valueLabel || t('analytics.chart.col.value'), num: true }
      ],
      rows: pts.map(function (p, i) {
        return {
          key: String(p.key === undefined ? (p.id === undefined ? i : p.id) : p.key),
          unknown: false,
          cells: [{
            text: p.label,
            action: spec.onPointClick ? function (ev) { spec.onPointClick(p, ev); } : null,
            actionLabel: p.label
          }, { text: fmtV(p.value), num: true }]
        };
      })
    };
  }

  /* ====================================================== coverage bars ==== */

  /* D11 — the "what do we actually know" chart, and the one this dataset
     genuinely supports. Each row is one field: the recorded share in --data,
     the rest hatched, separated by the 2px surface gap the mark spec requires
     for two touching segments. The pair `n of N` is the datum here rather than
     decoration, so it is rendered as a recessive value column in a text token —
     never as a number riding the mark. */
  function rowHit(spec, row, attrs) {
    if (!spec.onRowClick) return attrs;
    attrs.tabindex = '0';
    attrs.role = 'button';
    attrs['aria-label'] = t('analytics.coverage.action.field', { field: row.label });
    return attrs;
  }

  function drawCoverage(inst) {
    var spec = inst.spec, rows = spec.rows || [];
    var W = measure(inst);
    var anyCritical = rows.some(function (r) { return !!r.critical; });

    var valueTexts = rows.map(function (r) {
      return t('analytics.chart.ofTotal', { n: F.int(r.n), m: F.int(r.N) });
    });
    var valueW = U.clamp(maxTextW(valueTexts, TICK_PX) + 10, 48, 120);
    var gutter = U.clamp(Math.round(W * 0.40), 90, 200);
    var x0 = gutter;
    var scaleW = Math.max(40, W - gutter - valueW - 6);

    var top0 = 4;
    var plotH = rows.length * COV_BAND;
    var axisY = top0 + plotH;
    var H = axisY + 20;

    var grid = [svgEl('line.c-base', { x1: n2(x0), y1: top0, x2: n2(x0), y2: n2(axisY) })];
    [25, 50, 75, 100].forEach(function (p) {
      var x = x0 + scaleW * p / 100;
      grid.push(svgEl('line.c-grid', { x1: n2(x), y1: top0, x2: n2(x), y2: n2(axisY) }));
    });
    Q.fill(inst.gGrid, grid);

    var marks = [], labels = [];
    rows.forEach(function (r, i) {
      var key = String(r.key === undefined ? i : r.key);
      var y = top0 + i * COV_BAND + (COV_BAND - COV_TH) / 2;
      var cy = y + COV_TH / 2 + 4;
      var share = r.N > 0 ? r.n / r.N : 0;
      var knownLen = scaleW * share;

      /* The critical mark is an asterisk keyed to a footnote, not a colour:
         "critical" has to survive greyscale print and colour-vision
         deficiency. The label is truncated BEFORE the mark is appended, so
         the mark is never the character that gets cut. */
      labels.push(svgEl('text.c-cat' + (r.n ? '' : '.c-cat--unknown'), {
        x: n2(gutter - 8), y: n2(cy), 'text-anchor': 'end',
        text: truncate(r.label, gutter - 12 - (r.critical ? 10 : 0), CAT_PX) + (r.critical ? ' *' : '')
      }));

      if (knownLen > 0.5) {
        marks.push({
          key: key + ':known', tag: 'path',
          attrs: rowHit(spec, r, {
            'class': 'c-bar' + (spec.onRowClick ? ' c-bar--clickable' : ''),
            d: hBarPath(x0, y, knownLen, COV_TH, END_R)
          })
        });
      }

      /* A: the unknown remainder is always drawn and always hatched. The 2px
         gap is the mark spec's rule for two touching segments of one row. */
      var unkStart = x0 + (knownLen > 0.5 ? knownLen + SEG_GAP : 0);
      var unkLen = x0 + scaleW - unkStart;
      if (unkLen > 0.5 && r.n < r.N) {
        marks.push({
          key: key + ':unknown', tag: 'path',
          attrs: rowHit(spec, r, paint(inst, {}, { unknown: true }, {
            'class': 'c-bar c-bar--unknown',
            d: hBarPath(unkStart, y, unkLen, COV_TH, END_R)
          }))
        });
      }

      labels.push(svgEl('text.c-tick', {
        x: n2(W - 4), y: n2(cy), 'text-anchor': 'end', text: valueTexts[i]
      }));

      var line = t('analytics.coverage.row', { field: r.label, n: F.int(r.n), m: F.int(r.N) });
      var note = r.critical ? t('quality.coverage.critical')
                            : (r.n ? null : t('quality.coverage.zero'));
      var act = spec.onRowClick ? function (ev) { spec.onRowClick(r, ev); } : null;
      meta(inst, key + ':known', { line: line, extra: F.pct(share * 100, 0), note: note, onActivate: act });
      meta(inst, key + ':unknown', {
        line: line,
        extra: t('analytics.chart.unknownBar', { n: F.int(r.N - r.n) }),
        note: t('analytics.chart.unknownNote'), onActivate: act
      });
    });
    syncMarks(inst.gMarks, marks);
    Q.fill(inst.gLab, labels);

    var axis = [];
    [0, 25, 50, 75, 100].forEach(function (p, i) {
      axis.push(svgEl('text.c-tick', {
        x: n2(x0 + scaleW * p / 100), y: n2(axisY + 14),
        'text-anchor': i === 0 ? 'start' : (p === 100 ? 'end' : 'middle'),
        text: F.pct(p, 0)
      }));
    });
    Q.fill(inst.gAxis, axis);

    /* The asterisk needs its key. The '* ' prefix is punctuation tying the mark
       to the sentence, not a string — the sentence itself is translated. */
    if (anyCritical && !spec.note) setText(inst.note, '* ' + t('analytics.chart.criticalNote'));

    svgFrame(inst, W, H, !!spec.onRowClick);
  }

  function tableCoverage(inst) {
    var spec = inst.spec, rows = spec.rows || [];
    return {
      columns: [
        { label: spec.categoryLabel || t('analytics.axis.field') },
        { label: t('analytics.chart.col.recorded'), num: true },
        { label: t('analytics.chart.col.missing'), num: true },
        { label: t('analytics.chart.col.critical') }
      ],
      rows: rows.map(function (r, i) {
        return {
          key: String(r.key === undefined ? i : r.key),
          unknown: !r.n,
          cells: [{
            text: r.label,
            action: spec.onRowClick ? function (ev) { spec.onRowClick(r, ev); } : null,
            actionLabel: spec.onRowClick ? t('analytics.coverage.action.field', { field: r.label }) : null
          }, {
            text: t('analytics.chart.ofTotal', { n: F.int(r.n), m: F.int(r.N) }), num: true
          }, {
            text: F.int(r.N - r.n), num: true
          }, {
            text: r.critical ? t('analytics.chart.yes') : ''
          }]
        };
      })
    };
  }

  /* =============================================================== API ===== */

  /**
   * Horizontal bars for counts (districts, classes, coverage of a dimension).
   * spec: { key?, rows:[{key,label,value,unknown,color,reason}], total, title,
   *         sub, coverageText, note, valueFormat, tickFormat, axisTitle,
   *         categoryLabel, valueLabel, ordinal, measure, onBarClick,
   *         insufficient:{reason} }
   *
   * `value: null` marks a group the analytics layer refused to publish: it is
   * drawn as words, never as a zero-length bar.
   */
  C.barChart = function (container, spec) {
    return mount(container, 'bar', spec || {}, drawBars, tableBars);
  };

  /** Vertical columns for histograms. Same spec and the same mark rules. */
  C.columnChart = function (container, spec) {
    return mount(container, 'column', spec || {}, drawColumns, tableBars);
  };

  /**
   * One dot per value on a number line (D10).
   * spec: { key?, points:[{key,id,label,value,color,selected,sub}], min, max,
   *         title, sub, coverageText, note, valueFormat, tickFormat, axisTitle,
   *         refs:[{value,label}], onPointClick }
   */
  C.stripPlot = function (container, spec) {
    return mount(container, 'strip', spec || {}, drawStrip, tableStrip);
  };

  /**
   * The §37/D11 coverage chart.
   * spec: { key?, rows:[{key,label,n,N,critical}], title, sub, coverageText,
   *         note, categoryLabel, onRowClick }
   * Feed it `GEO.analytics.fieldCoverage(rows)` directly.
   */
  C.coverageBars = function (container, spec) {
    return mount(container, 'coverage', spec || {}, drawCoverage, tableCoverage);
  };

  /**
   * The chart area replaced by the words "Insufficient verified data" plus the
   * sentence naming exactly what is missing. The title and the coverage line
   * stay: the denominator is the explanation.
   */
  C.insufficient = function (container, spec) {
    return mount(container, 'insufficient', spec || {}, function () {}, function () { return null; });
  };

  /**
   * Dispatch for callers that hold a spec rather than a call site — the AI
   * `generate_chart` tool returns `{kind, rows|series, title, coverageText,
   * valueFormat}` and 23-ai-panel hands it straight here.
   */
  C.render = function (container, spec) {
    var s = Object.assign({}, spec || {});
    if (!s.rows && s.series) s.rows = s.series;
    switch (s.kind) {
      case 'column':
      case 'histogram': return C.columnChart(container, s);
      case 'strip':     return C.stripPlot(container, s);
      case 'coverage':  return C.coverageBars(container, s);
      case 'insufficient': return C.insufficient(container, s);
      default:          return C.barChart(container, s);
    }
  };

  /**
   * `GEO.analytics.aggregate()` groups -> chart rows, with the unknown group
   * carried through. Panels should use this rather than mapping groups by
   * hand: the hand-written version is where the unknown bucket gets dropped and
   * where a suppressed mean becomes a zero.
   */
  C.rowsFromGroups = function (groups, opts) {
    opts = opts || {};
    return (groups || []).map(function (g) {
      var value = g.count;
      var reason = null;
      if (opts.measure) {
        /* An insufficient group has no value — NOT a value of zero. */
        value = (g.metric && g.metric.sufficient) ? g.metric.value : null;
        reason = g.metric ? g.metric.reason : null;
      }
      return { key: g.key, label: g.label, value: value, unknown: !!g.unknown,
               reason: reason, rows: g.rows, metric: g.metric };
    });
  };

  /** `GEO.analytics.histogram()` -> chart rows, unknown bucket included. */
  C.rowsFromHistogram = function (h) {
    if (!h) return [];
    var rows = (h.series || []).map(function (b, i) {
      return { key: 'bin-' + i, label: b.label, value: b.count, unknown: false, rows: b.rows };
    });
    if (h.unknown) {
      rows.push({ key: '__unknown__', label: h.unknown.label, value: h.unknown.count,
                  unknown: true, rows: h.unknown.rows });
    }
    return rows;
  };

  /** Remove every chart in `container` and release its observers. */
  C.destroy = function (container) {
    instances.filter(function (i) { return i.container === container; })
             .forEach(removeInstance);
  };

  /** Re-measure and redraw every mounted chart (breakpoint changes, print). */
  C.redrawAll = function () {
    instances.forEach(function (inst) {
      if (inst.view === 'chart' && !inst.bad && inst.node && inst.node.parentNode) {
        inst.meta = {};
        inst.draw(inst);
      }
    });
  };

  /* Locale changes rewrite every axis label, tooltip and table header, so the
     charts re-render rather than keeping half a translation on screen. */
  GEO.on('i18n:locale', function () {
    instances.forEach(function (inst) {
      inst.btnChart.textContent = t('analytics.chart.chart');
      inst.btnTable.textContent = t('analytics.chart.table');
      inst.btnChart.setAttribute('aria-label', t('analytics.chart.asChart'));
      inst.btnTable.setAttribute('aria-label', t('analytics.chart.asTable'));
      inst.toggle.setAttribute('aria-label', t('analytics.chart.view'));
      refresh(inst);
    });
  });
}(window));
