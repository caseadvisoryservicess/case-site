/* ===========================================================================
 * 15-panel-analytics — the Analytics tab (§14, §36; IA §5.5, A-01…A-07)
 *
 * This is the panel that either earns the product's credibility or spends it.
 * Four decisions are worth knowing before reading the code.
 *
 * A. A CARD IS NEVER HIDDEN FOR HAVING NO DATA.
 *    Five of the eight §14 metrics have zero coverage on the observed set
 *    (GLA, available area, occupancy, vacancy, status). Dropping them would
 *    leave a tidy dashboard that answers only the questions this dataset
 *    happens to answer — the most flattering lie available here. They are
 *    grouped under "Not yet collected" with their 0-of-N coverage stated, and
 *    they move back up by themselves under demo mode or after an edit (D11).
 *    The test is derived (`n === 0`), never a hard-coded list of field names.
 *
 * B. EVERY FIGURE CARRIES ITS DENOMINATOR — ON SCREEN AND IN THE EXPORT.
 *    The metric object owns `n`, `N` and `coverageText`; this file renders the
 *    coverage line under every card and every chart, and writes n, N and the
 *    coverage sentence into each row of the CSV. A consultant who cannot get
 *    the numbers out of a tool has a demo, not an instrument (M10).
 *
 * C. NOTHING DERIVED IS CACHED.
 *    The only things held between renders are a render signature (a string)
 *    and a data-version counter. Export and print recompute from the live
 *    state rather than from whatever was on screen, so a figure in a file can
 *    never be one edit older than the figure on the panel.
 *
 * D. THE CHART MODULE OWNS THE PIXELS; THIS FILE OWNS THE QUESTION.
 *    Every chart is handed to `GEO.charts` as a spec. When a chart cannot be
 *    drawn, the panel falls back to the TABLE view of the same spec — every
 *    value present, none gated behind colour or hover (A-04, visual-system
 *    §10) — because the honest failure of a chart is a table, not a hole.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, Q = GEO.dom, el = Q.el, U = GEO.util, S = GEO.schema,
      F = GEO.fmt, A = GEO.analytics, t = GEO.i18n.t;

  var PANE = '#pane-analytics';

  /* Strings this panel needs that the shipped table does not carry yet. They
     are written INTO `GEO.i18n.en` rather than kept in a private map, so D14
     still holds: one table, one lookup, one translator export. A key already
     defined in 01-i18n always wins — this never overwrites shipped copy. */
  var ADDED = {
    'analytics.metrics.title': 'Metrics',
    'analytics.notCollected.title': 'Not yet collected',
    'analytics.notCollected.body': 'Nothing in the current selection has a recorded value for these. The cards stay, with their 0-of-{m} coverage, because a hidden card reads as a question nobody asked.',
    'analytics.filters.active': 'Active filters: {list}',
    'analytics.filters.none': 'No filters are active.',
    'analytics.export.analysis': 'Export analysis',
    'analytics.export.analysis.note': 'Writes every figure on this panel with its n, its N and the active filters.',
    'analytics.export.done': 'Analysis exported — {n} figures with their denominators',
    'analytics.export.col.section': 'Section',
    'analytics.export.col.item': 'Item',
    'analytics.export.col.value': 'Value',
    'analytics.export.col.n': 'Recorded (n)',
    'analytics.export.col.N': 'In selection (N)',
    'analytics.export.col.coverage': 'Coverage',
    'analytics.table.share': 'Share of selection',
    'analytics.chart.empty': 'No properties are in the current selection, so there is nothing to plot.',
    'analytics.chart.district.coverage': 'District is recorded for all {m} properties.',
    'analytics.chart.unknownNotFilter': 'The filters have no "only unrecorded" option, so this bar is a denominator, not a link. The Data workspace lists the records behind it.',
    'analytics.chart.binFilterNote': 'Bands are left-closed and right-open. The filter is inclusive at both ends, so a value sitting exactly on an upper edge is admitted by the band below it as well.',
    'analytics.strip.median': 'Median {value}. Range {min} to {max}.',
    'analytics.strip.iqr': 'Middle half (Q1–Q3): {q1} to {q3}.',
    'analytics.strip.select': 'Select {name}',
    'analytics.coverage.lead': 'This is the chart a professional collection programme would change: every figure above is capped by these bars.',
    'analytics.coverage.openData': 'Open the coverage view in the Data workspace',
    'analytics.formula.count': 'A count of the records in the current selection. A count of zero is a measured fact, so it is always published.',
    'analytics.formula.sum': 'The {n} recorded values added together. Records with nothing recorded are excluded, never counted as zero.',
    'analytics.formula.mean': 'The {n} recorded values added together, divided by {n}. Records with nothing recorded are excluded, never counted as zero.',
    'analytics.formula.median': 'The middle of the {n} recorded values, sorted; at an even count, the mean of the two central values.',
    'analytics.formula.split': 'Records counted by recorded status. The {n} whose status is not recorded are in neither group and are not implied to be either.',
    'analytics.metric.excluded.more': '{n} more are not listed here.'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.has(k, 'en')) GEO.i18n.en[k] = ADDED[k];
  });

  /* View bookkeeping only. `sig` is a string and `dataVersion` is a counter —
     no record, no metric and no chart series is held here (decision C). */
  var lastSig = null;
  var dataVersion = 0;

  /* The §7.6 field list: the 8 critical fields plus the three that identify a
     record at all. Derived from the registry, so adding a critical field adds
     a bar without touching this file. */
  var COVERAGE_EXTRA = ['name', 'address', 'districtKey'];

  /* A metric popover over 132 excluded records is a scroll, not a disclosure;
     the rest are named by count and reachable in the Data workspace. */
  var EXCLUDED_SHOWN = 25;

  /* ---------------------------------------------------------------- labels */

  var ENUM_KEYS = {
    officeClass: { 'A+': 'value.class.aPlus', 'A': 'value.class.a', 'B+': 'value.class.bPlus',
                   'B': 'value.class.b', 'C': 'value.class.c' },
    status: { 'Operating': 'value.status.operating', 'Under construction': 'value.status.construction',
              'Planned': 'value.status.planned', 'Renovation': 'value.status.renovation' }
  };

  function enumLabel(enumKey, value) {
    var map = ENUM_KEYS[enumKey];
    var key = map ? map[value] : null;
    return key ? t(key) : String(value);
  }

  function fieldLabel(key) {
    return GEO.i18n.has('field.' + key) ? t('field.' + key) : S.label(key);
  }

  /** The §14/§36 denominator sentence, always through the one accessor. */
  function coverageLine(n, N, label) {
    return GEO.i18n.coverageLine(n, N, F.lower(label));
  }

  /** D4: a demo record is badged wherever it appears, including inside a
   *  popover list and inside a chart's point label. */
  function demoBadge() {
    return el('span.badge.badge--demo', {
      text: t('common.demo.badge'), title: t('value.recordType.demo')
    });
  }

  function demoCount(rows) {
    return rows.filter(function (r) { return r.recordType === 'DEMO'; }).length;
  }

  /** The most recent verification date across the selection. Shown in words on
   *  the panel and in the export header: a figure without a date is a rumour. */
  function lastVerified(rows) {
    var best = null;
    rows.forEach(function (r) {
      var v = r._meta && r._meta.lastVerifiedAt;
      if (U.isKnown(v) && (best === null || v > best)) best = v;
    });
    return best;
  }

  function isSmall(bp) { return bp === 's' || bp === 'xs' || bp === 'xxs'; }

  /* ================================================================ modals */
  /* GEO.boot.dialog plus one correction, the same one 14-panel-detail makes:
     99-boot's global Escape handler also listens on `document`, so a plain Esc
     inside a dialog would close the dialog AND the rail behind it. Capturing
     Escape on `#dialog` keeps the key meaning exactly one thing (P5), and
     leaves Tab to the helper's own focus trap. */
  function modal(opts) {
    var box = Q.$('#dialog');
    var handle = null;

    function release() { box.removeEventListener('keydown', onKey, true); }

    function onKey(e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      release();
      if (handle) handle.close();
    }

    handle = GEO.boot.dialog({
      title: opts.title,
      body: opts.body,
      actions: [{ label: t('common.close'), primary: true, run: release }]
    });
    box.addEventListener('keydown', onKey, true);
    return handle;
  }

  /* ========================================================= metric cards */

  /* The card label comes from the string table, keyed by what the metric IS
     (kind + field) rather than by position, so re-ordering `dashboard()` can
     never re-label a card. A metric this map does not know falls back to the
     label the analytics module gave it. */
  var CARD_KEYS = {
    'count:': 'analytics.metric.count',
    'sum:gla': 'analytics.metric.glaSum',
    'mean:askingRent': 'analytics.metric.rentMean.long',
    'median:askingRent': 'analytics.metric.rentMedian',
    'sum:availableArea': 'analytics.metric.availableSum',
    'mean:occupancyPct': 'analytics.metric.occupancyMean',
    'mean:vacancyPct': 'analytics.metric.vacancyMean',
    'split:status': 'analytics.metric.statusSplit'
  };

  function metricId(m) { return m.kind + ':' + (m.field || ''); }

  function metricLabel(m) {
    var key = CARD_KEYS[metricId(m)];
    return (key && GEO.i18n.has(key)) ? t(key) : m.label;
  }

  /**
   * The value slot has exactly three outcomes and no fourth: a number, a
   * measured split, or the words. Never blank, never a dash, and never a zero
   * standing in for an unknown — `vacancyPct: 0` prints "0%" from the metric's
   * own display, which is how a measured zero stays distinguishable (§36).
   */
  function metricValue(m) {
    if (!m.sufficient) return t('common.insufficient');
    if (m.kind === 'split') {
      return t('analytics.metric.split', {
        operating: F.int(m.value.operating), pipeline: F.int(m.value.pipeline)
      });
    }
    return m.display;
  }

  function metricCard(m, rows) {
    var poor = !m.sufficient;
    var kids = [
      el('span.stat__label', { text: metricLabel(m) }),
      el('span.stat__value', { text: metricValue(m) })
    ];
    // A-07: the reason replaces the number and names the missing field. It is
    // rendered as text, not as a link — it never offers to "estimate anyway".
    if (poor && m.reason) kids.push(el('span.reason', { text: m.reason }));
    // R3: the denominator line is part of the card permanently, not only
    // inside the popover.
    kids.push(el('span.coverage.stat__cov', { text: m.coverageText }));
    if (m.containsDemo) kids.push(el('span.stat__demo', {}, [demoBadge()]));

    return el('button.stat' + (poor ? '.stat--insufficient' : ''), {
      type: 'button',
      'data-metric': metricId(m),
      title: t('analytics.metric.open'),
      'aria-label': metricLabel(m) + ': ' + metricValue(m) + '. ' +
                    m.coverageText + ' ' + t('analytics.metric.open'),
      onclick: function () { openMetric(m, rows); }
    }, kids);
  }

  function formulaText(m) {
    if (m.kind === 'count') return t('analytics.formula.count');
    if (m.kind === 'split') return t('analytics.formula.split', { n: F.int(m.N - m.n) });
    if (m.kind === 'sum') return t('analytics.formula.sum', { n: F.int(m.n) });
    if (m.kind === 'median') return t('analytics.formula.median', { n: F.int(m.n) });
    if (m.kind === 'mean') return t('analytics.formula.mean', { n: F.int(m.n) });
    return null;
  }

  /** The records a metric left out, by name. Not a count in the abstract: the
   *  point of A-02 is that "excluded for missing data" is checkable. */
  function excludedRecords(m, rows) {
    if (!m.field) return [];
    return rows.filter(function (r) { return !U.isKnown(r[m.field]); });
  }

  function openMetric(m, rows) {
    var kids = [];

    kids.push(el('p.stat__value', { text: metricValue(m) }));
    kids.push(el('p.coverage', { text: m.coverageText }));
    if (!m.sufficient && m.reason) kids.push(el('p.muted', { text: m.reason }));

    var formula = formulaText(m);
    if (formula) {
      kids.push(el('h3.sectitle', { text: t('analytics.metric.formula') }));
      kids.push(el('p', { text: formula }));
    }

    // §8 of the analytics rules: the qualifier lives in the label, and the
    // reason weighting is impossible here is stated with its own coverage.
    if (m.weighting) {
      var glaCov = A.coverage(rows, 'gla');
      kids.push(el('p.micro', {
        text: t('analytics.metric.weighting', {
          how: t('common.unweighted'), n: F.int(glaCov.n), m: F.int(glaCov.N)
        })
      }));
    }

    (m.notes || []).forEach(function (note) {
      kids.push(el('p.micro', { text: note }));
    });

    var ex = excludedRecords(m, rows);
    if (ex.length) {
      kids.push(el('h3.sectitle', { text: t('analytics.metric.excluded', { n: F.int(ex.length) }) }));
      kids.push(el('p.micro', { text: t('analytics.metric.excluded.note') }));
      kids.push(el('ul.stack', {}, ex.slice(0, EXCLUDED_SHOWN).map(function (r) {
        return el('li.row.row--tight', {}, [
          el('span', { text: U.isKnown(r.name) ? r.name : F.UNKNOWN }),
          r.recordType === 'DEMO' ? demoBadge() : null
        ]);
      })));
      if (ex.length > EXCLUDED_SHOWN) {
        kids.push(el('p.micro', {
          text: t('analytics.metric.excluded.more', { n: F.int(ex.length - EXCLUDED_SHOWN) })
        }));
      }
    }

    modal({ title: metricLabel(m), body: el('div.stack', {}, kids) });
  }

  /* ============================================================== charts */

  /**
   * One canonical spec shape for all five charts.
   *
   * `rows` is the spelling the repository already uses for a chart series
   * (22-ai-engine's `out.chart`); `series` is the spelling in the AI
   * architecture's tool contract. Both point at the SAME array, so a chart
   * module written against either reading finds the data — and neither can
   * drift from the other, because there is only one array.
   */
  function specFor(o) {
    o.series = o.rows;
    if (o.onSelect) o.onClick = o.onSelect;       // same function, two names
    return o;
  }

  function item(o) {
    var N = o.N || 0;
    var share = N ? (100 * o.value / N) : null;
    return {
      key: o.key, label: o.label, value: o.value,
      n: o.value, N: N,
      unknown: !!o.unknown,
      selectable: !!o.selectable,
      ordinal: o.ordinal || null,
      share: share,
      shareText: N ? F.pct(share, 1) : F.UNKNOWN,
      actionLabel: o.selectable ? t('analytics.chart.filterAction', { category: o.label }) : null,
      tooltip: t('analytics.chart.tooltip', {
        category: o.label, n: F.int(o.value), m: F.int(N),
        pct: N ? F.pct(share, 1) : F.UNKNOWN
      })
    };
  }

  /** The table view's data, which is also what the CSV export writes. One
   *  shaping, so the chart, the table and the file can never disagree. `n` and
   *  `N` travel with each row so the export keeps its denominator column. */
  function tableOf(columns, items) {
    return {
      columns: columns,
      rows: items.map(function (it) {
        return { key: it.key, unknown: it.unknown, n: it.value, N: it.N,
                 cells: [it.label, F.int(it.value), it.shareText] };
      })
    };
  }

  /* --- chart 1 · business centres by district ---------------------------- */
  function districtSpec(rows) {
    var groups = A.byDistrict(rows);
    var unknown = null, known = [];
    groups.forEach(function (g) { if (g.unknown) { unknown = g; } else { known.push(g); } });

    /* §7.2: count descending, ties alphabetical by DISPLAY name, and the
       zero-count districts kept at the bottom. Yangihayot and Bektemir hold no
       records: that is a true zero in this dataset, not missing data, and a
       chart that dropped them would imply the city has ten districts. */
    known.sort(function (a, b) {
      return b.count - a.count || (a.label < b.label ? -1 : (a.label > b.label ? 1 : 0));
    });

    var items = known.map(function (g) {
      return item({ key: g.key, label: g.label, value: g.count, N: rows.length, selectable: true });
    });
    // districtKey is required by the schema, so there is normally no unknown
    // bucket at all (§7.0.1). It is drawn only if one somehow exists.
    if (unknown && unknown.count) {
      items.push(item({ key: null, label: unknown.label, value: unknown.count,
                        N: rows.length, unknown: true }));
    }

    return specFor({
      id: 'district', kind: 'bar',
      title: t('analytics.chart.district'),
      categoryAxis: t('analytics.axis.district'),
      valueAxis: t('analytics.axis.count'),
      rows: items,
      N: rows.length,
      coverageText: !rows.length
        ? t('common.coverage.empty')
        : ((unknown && unknown.count)
            ? coverageLine(rows.length - unknown.count, rows.length, fieldLabel('districtKey'))
            : t('analytics.chart.district.coverage', { m: F.int(rows.length) })),
      insufficient: rows.length ? null : t('analytics.chart.empty'),
      table: tableOf([t('analytics.axis.district'), t('analytics.axis.count'),
                      t('analytics.table.share')], items),
      onSelect: function (it) { applyDistrict(it); }
    });
  }

  /* --- chart 2 · business centres by class ------------------------------- */
  function classSpec(rows) {
    var groups = A.byClass(rows);                 // fixed ordinal order, unknown last
    var cov = A.coverage(rows, 'officeClass');

    /* The hatched "Class not recorded" bar is the largest bar in this dataset
       (132 of 148). Hiding it would be the single most misleading thing this
       application could do, so it is drawn at every n, labelled with its count,
       and excluded from nothing except the ordinal ramp it is not part of. */
    var items = groups.map(function (g) {
      return item({
        key: g.unknown ? null : g.key,
        label: g.unknown ? t('value.class.unknown') : enumLabel('officeClass', g.key),
        value: g.count, N: rows.length,
        unknown: g.unknown,
        ordinal: g.unknown ? null : g.key,
        selectable: !g.unknown
      });
    });

    return specFor({
      id: 'class', kind: 'bar', ordinal: true,
      title: t('analytics.chart.class'),
      categoryAxis: t('analytics.axis.class'),
      valueAxis: t('analytics.axis.count'),
      rows: items,
      N: rows.length,
      coverageText: coverageLine(cov.n, cov.N, fieldLabel('officeClass')),
      note: t('analytics.chart.unknownNote'),
      insufficient: rows.length ? null : t('analytics.chart.empty'),
      table: tableOf([t('analytics.axis.class'), t('analytics.axis.count'),
                      t('analytics.table.share')], items),
      onSelect: function (it) { applyClass(it); }
    });
  }

  /* --- distributions (charts 3 and 4) ------------------------------------ */

  function binLabel(bin, fmt) {
    if (bin.lo === null || bin.lo === undefined) return t('analytics.bin.under', { max: fmt(bin.hi) });
    if (bin.hi === null || bin.hi === undefined) return t('analytics.bin.over', { min: fmt(bin.lo) });
    return t('analytics.bin.range', { min: fmt(bin.lo), max: fmt(bin.hi) });
  }

  function binItems(hist, N, fmt, selectable) {
    var items = hist.series.map(function (bin) {
      var it = item({ key: null, label: binLabel(bin, fmt), value: bin.count,
                      N: N, selectable: selectable });
      it.lo = (bin.lo === undefined) ? null : bin.lo;
      it.hi = (bin.hi === undefined) ? null : bin.hi;
      return it;
    });
    // The unknown column is always last and always drawn, at any count (§5).
    items.push(item({ key: null, label: hist.unknown.label, value: hist.unknown.count,
                      N: N, unknown: true }));
    return items;
  }

  /** Tukey hinges: at an odd count the median belongs to both halves. Used only
   *  at n ≥ 8, where a middle-half band is a description rather than a claim. */
  function hinges(values) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    var n = s.length, half = Math.floor(n / 2);
    return {
      q1: A.median(s.slice(0, n % 2 ? half + 1 : half)),
      q3: A.median(s.slice(half))
    };
  }

  function rentSpec(rows) {
    var d = A.rentDistribution(rows);
    var fmt = function (v) { return F.num(v, 0); };
    var un = d.histogram.unknown;
    var unknownLine = t('analytics.chart.unknownBar', { n: F.int(un.count) });

    if (!d.n) {
      // n = 0 on the ladder: no axis is drawn, because an empty axis implies a
      // measured zero everywhere. The reason names the missing field.
      return specFor({
        id: 'rent', kind: 'insufficient',
        title: t('analytics.chart.rent'),
        rows: [],
        N: rows.length,
        coverageText: d.coverageText,
        note: unknownLine,
        insufficient: A.metric(rows, 'askingRent', 'mean').reason,
        table: { columns: [t('analytics.axis.rent'), t('analytics.axis.count')],
                 rows: [{ key: null, unknown: true, n: un.count, N: rows.length,
                          cells: [un.label, F.int(un.count)] }] }
      });
    }

    if (d.form === 'strip') {
      /* D10 / §7.1. Sixteen points across seven bins is noise that implies a
         distribution the sample cannot support; sixteen points on a number line
         are sixteen facts. The unknown block is stated in words beside the plot
         because a strip plot has no bar to carry it. */
      var vals = d.points.map(function (p) { return p.value; });
      var notes = [];
      var stats = null;

      if (d.n >= A.MIN_N) {
        stats = { median: A.median(vals), min: d.min, max: d.max };
        notes.push(t('analytics.strip.median', {
          value: F.rent(stats.median), min: F.rent(d.min), max: F.rent(d.max)
        }));
        if (d.n >= 8) {
          var h = hinges(vals);
          stats.q1 = h.q1;
          stats.q3 = h.q3;
          notes.push(t('analytics.strip.iqr', { q1: F.rent(h.q1), q3: F.rent(h.q3) }));
        }
      } else {
        // 1–2 values: the individual facts, with no median and no quartiles.
        notes.push(t('analytics.strip.note', { n: F.int(d.n) }));
      }
      notes.push(unknownLine);

      var points = d.points.map(function (p) {
        var rec = GEO.data.get(p.id);
        var demo = !!(rec && rec.recordType === 'DEMO');
        var name = U.isKnown(p.name) ? p.name : F.UNKNOWN;
        return {
          id: p.id,
          // The DEMO mark is baked into the label as well as flagged, so it
          // survives a renderer that does not know about record types (D4).
          label: demo ? name + ' · ' + t('common.demo.badge') : name,
          value: p.value, valueText: F.rent(p.value),
          demo: demo, ordinal: p.officeClass || null, selectable: true
        };
      }).sort(function (a, b) { return a.value - b.value; });

      return specFor({
        id: 'rent', kind: 'strip',
        title: t('analytics.chart.rent'),
        valueAxis: t('analytics.axis.rent'),
        rows: points, points: points, stats: stats,
        N: rows.length,
        coverageText: d.coverageText,
        note: notes.join(' '),
        table: {
          columns: [t('field.name'), t('analytics.axis.rent')],
          // One row is one recorded value on one building, so it has no
          // denominator of its own; the chart's coverage line carries it.
          rows: points.map(function (p) {
            return { key: p.id, unknown: false, n: null, N: rows.length,
                     cells: [p.label, p.valueText] };
          })
        },
        onSelect: function (p) { selectRecord(p); }
      });
    }

    var items = binItems(d.histogram, rows.length, fmt, true);
    return specFor({
      id: 'rent', kind: 'column',
      title: t('analytics.chart.rent'),
      categoryAxis: t('analytics.axis.rent'),
      valueAxis: t('analytics.axis.count'),
      rows: items,
      N: rows.length,
      coverageText: d.coverageText,
      note: t('analytics.chart.binFilterNote'),
      table: tableOf([t('analytics.axis.rent'), t('analytics.axis.count'),
                      t('analytics.table.share')], items),
      onSelect: function (it) { applyRange(it, 'rentMin', 'rentMax'); }
    });
  }

  function glaSpec(rows) {
    var d = A.glaDistribution(rows);
    var items = binItems(d.histogram, rows.length, F.int, d.sufficient);
    var table = tableOf([t('analytics.axis.gla'), t('analytics.axis.count'),
                         t('analytics.table.share')], items);

    /* D11: the chart ships and renders its insufficient state on the observed
       set (0 of 148), and becomes live under demo mode or after an editor
       entry. Dropping it would hide the gap it exists to report. */
    if (!d.sufficient) {
      return specFor({
        id: 'gla', kind: 'insufficient',
        title: t('analytics.chart.gla'),
        rows: [], N: rows.length,
        coverageText: d.coverageText,
        note: t('analytics.chart.unknownBar', { n: F.int(d.histogram.unknown.count) }),
        insufficient: d.reason,
        table: table
      });
    }

    return specFor({
      id: 'gla', kind: 'column',
      title: t('analytics.chart.gla'),
      categoryAxis: t('analytics.axis.gla'),
      valueAxis: t('analytics.axis.count'),
      rows: items,
      N: rows.length,
      coverageText: d.coverageText,
      note: t('analytics.chart.binFilterNote'),
      table: table,
      onSelect: function (it) { applyRange(it, 'glaMin', 'glaMax'); }
    });
  }

  /* --- chart 5 · data coverage by field ---------------------------------- */
  function coverageSpec(rows) {
    var wanted = S.criticalFields.concat(COVERAGE_EXTRA);
    var items = A.fieldCoverage(rows)
      .filter(function (c) { return wanted.indexOf(c.key) >= 0; })
      .map(function (c) {
        return {
          key: c.key, label: fieldLabel(c.key),
          value: c.n, n: c.n, N: c.N, pct: c.pct,
          critical: c.critical, unknown: false, selectable: false,
          shareText: F.pct(100 * c.pct, 0),
          tooltip: t('analytics.coverage.row', {
            field: fieldLabel(c.key), n: F.int(c.n), m: F.int(c.N)
          })
        };
      });

    return specFor({
      id: 'coverage', kind: 'coverage',
      title: t('analytics.chart.coverage'),
      categoryAxis: t('analytics.axis.field'),
      valueAxis: t('analytics.axis.count'),
      lead: t('analytics.coverage.lead'),
      rows: items,
      N: rows.length,
      coverageText: t('analytics.coverage.note'),
      insufficient: rows.length ? null : t('analytics.chart.empty'),
      table: {
        columns: [t('analytics.axis.field'), t('analytics.export.col.n'),
                  t('analytics.table.share')],
        rows: items.map(function (it) {
          return { key: it.key, unknown: false, n: it.n, N: it.N,
                   cells: [it.label, t('common.of', { n: F.int(it.n), m: F.int(it.N) }),
                           it.shareText] };
        })
      }
    });
  }

  /* --------------------------------------------------------- chart drawing */

  function tableNode(table) {
    var head = el('thead', {}, [
      el('tr', {}, table.columns.map(function (c, i) {
        return el(i ? 'th.tbl__num' : 'th', { scope: 'col', text: c });
      }))
    ]);
    var body = el('tbody', {}, table.rows.map(function (r) {
      return el('tr', r.unknown ? { 'data-unknown': 'true' } : {}, r.cells.map(function (c, i) {
        return i === 0 ? el('th', { scope: 'row', text: c })
                       : el('td.tbl__num', { text: c });
      }));
    }));
    return el('table.chart__table.tbl', {}, [head, body]);
  }

  /* What the panel draws when `GEO.charts` is absent or throws: the TABLE view
     of the same spec. Every value is present and none is gated behind colour or
     hover, which is the A-04 requirement anyway — so the degraded panel is
     still readable, exportable and honest, just not graphical. */
  function fallbackChart(spec) {
    var body = spec.insufficient
      ? el('div.insufficient', {}, [
          el('div.insufficient__title', { text: t('common.insufficient') }),
          el('p.insufficient__why', { text: spec.insufficient })
        ])
      : tableNode(spec.table);

    return el('section.chart', { 'aria-label': spec.title }, [
      el('div.chart__hd', {}, [
        el('div.chart__title', {}, [
          el('span', { text: spec.title }),
          spec.categoryAxis ? el('span.chart__sub', { text: spec.categoryAxis }) : null
        ])
      ]),
      body,
      spec.note ? el('p.micro', { text: spec.note }) : null,
      el('p.coverage.chart__cov', { text: spec.coverageText })
    ]);
  }

  /** Hand the spec to the chart module; fall back to its table on any failure.
   *  `insufficient` is routed to the module's own state renderer when it has
   *  one, because the plot area — and only the plot area — is what it replaces. */
  function drawChart(spec) {
    var C = GEO.charts;
    var name = spec.insufficient ? 'insufficient'
             : spec.kind === 'bar' ? 'barChart'
             : spec.kind === 'column' ? 'columnChart'
             : spec.kind === 'strip' ? 'stripPlot'
             : spec.kind === 'coverage' ? 'coverageBars'
             : 'render';
    var fn = null;
    if (C) {
      if (typeof C[name] === 'function') fn = C[name];
      else if (typeof C.render === 'function') fn = C.render;
    }
    var node = null;
    if (fn) {
      try { node = fn.call(C, spec); }
      catch (e) {
        GEO.log.error('charts.' + name + ' threw — showing the table view instead', e);
        node = null;
      }
    }
    return (node && node.nodeType === 1) ? node : fallbackChart(spec);
  }

  /* ============================================================== actions */

  /* A-03. Clicking a mark applies the matching filter and shows the results
     list, so the chart is a way of asking a question rather than a picture of
     an answer. Every write goes through GEO.state.set, which is what keeps the
     manual filter controls in step (§59). */

  function showResults(state) {
    var p = { leftRail: 'open', leftTab: 'results' };
    // P3: on a phone at most one panel may cover the map, so the rail the user
    // is reading yields to the list it just sent them to.
    if (isSmall(state.bp)) p.rightRail = 'closed';
    return p;
  }

  /** The unknown bar is not a control: the filter model has no "only
   *  unrecorded" predicate, so instead of a silent no-op the bar says why. */
  function notFilterable() {
    if (GEO.boot && GEO.boot.toast) GEO.boot.toast(t('analytics.chart.unknownNotFilter'));
  }

  function applyDistrict(it) {
    if (!it || it.unknown || !it.key) { notFilterable(); return; }
    var state = GEO.state.get();
    GEO.state.set(Object.assign({ filters: { districts: [it.key] } }, showResults(state)),
      { source: 'user', action: 'analytics:filter:district',
        summary: t('analytics.chart.filterAction', { category: it.label }) });
  }

  function applyClass(it) {
    if (!it || it.unknown || !it.key) { notFilterable(); return; }
    var state = GEO.state.get();
    GEO.state.set(Object.assign({ filters: { classes: [it.key] } }, showResults(state)),
      { source: 'user', action: 'analytics:filter:class',
        summary: t('analytics.chart.filterAction', { category: it.label }) });
  }

  function applyRange(it, minKey, maxKey) {
    if (!it || it.unknown) { notFilterable(); return; }
    var state = GEO.state.get();
    var f = {};
    f[minKey] = (it.lo === undefined) ? null : it.lo;
    f[maxKey] = (it.hi === undefined) ? null : it.hi;
    GEO.state.set(Object.assign({ filters: f }, showResults(state)),
      { source: 'user', action: 'analytics:filter:range',
        summary: t('analytics.chart.filterAction', { category: it.label }) });
  }

  /** A strip-plot dot is one building, so clicking it selects that building
   *  rather than filtering to a band of one. */
  function selectRecord(p) {
    if (!p || !p.id || !GEO.data.get(p.id)) return;
    GEO.state.set({ selectedId: p.id, rightRail: 'open', rightTab: 'property' },
      { source: 'user', action: 'analytics:select',
        summary: t('analytics.strip.select', { name: p.label }) });
  }

  function openCoverageWorkspace() {
    GEO.state.set({ overlay: 'data', dataTab: 'coverage' },
      { source: 'user', action: 'analytics:openCoverage' });
  }

  /* ================================================================ export */

  function csvCell(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvRow(cells) { return cells.map(csvCell).join(','); }

  /**
   * A-05 / M10. The figures on screen, their n, their N and their coverage
   * sentence, under a header block naming the filters, the selection size, the
   * collection date and the assumed rent unit. Recomputed from live state at
   * the moment of the click, never from what happened to be rendered.
   */
  function exportAnalysis(state, rows, scope) {
    var model = buildModel(state, rows, scope);
    var lines = [];
    var figures = 0;

    lines.push('# ' + GEO.PRODUCT.name + ' ' + GEO.PRODUCT.version + ' — ' +
               t('analytics.title') + ' — ' + F.date(GEO.date.today()));
    lines.push('# ' + t('analytics.scope', { n: F.int(rows.length), m: F.int(scope.length) }));
    lines.push('# ' + model.filterText);
    lines.push('# ' + A.coverageStatement(rows));
    lines.push('# ' + model.verifiedText);
    if (model.stalenessNote) lines.push('# ' + model.stalenessNote);
    lines.push('# ' + t('common.assumedUnit'));
    if (GEO.data.containsDemo(rows)) {
      lines.push('# ' + t('common.demo.included', { n: F.int(demoCount(rows)) }));
    }

    lines.push(csvRow([t('analytics.export.col.section'), t('analytics.export.col.item'),
                       t('analytics.export.col.value'), t('analytics.export.col.n'),
                       t('analytics.export.col.N'), t('analytics.export.col.coverage')]));

    model.cards.forEach(function (m) {
      var section = (model.empty.indexOf(m) >= 0)
        ? t('analytics.notCollected.title') : t('analytics.metrics.title');
      lines.push(csvRow([section, metricLabel(m), metricValue(m),
                         F.int(m.n), F.int(m.N), m.coverageText]));
      figures++;
    });

    model.specs.forEach(function (spec) {
      if (spec.insufficient) {
        lines.push(csvRow([spec.title, t('common.insufficient'), spec.insufficient,
                           '', F.int(spec.N), spec.coverageText]));
        figures++;
      }
      (spec.table.rows || []).forEach(function (r) {
        lines.push(csvRow([spec.title, r.cells[0], r.cells[1],
                           r.n === null || r.n === undefined ? '' : F.int(r.n),
                           F.int(r.N === undefined ? spec.N : r.N),
                           spec.coverageText]));
        figures++;
      });
    });

    GEO.boot.download(lines.join('\n'),
                      'geo-mvp-analysis-' + GEO.date.today() + '.csv', 'text/csv');
    GEO.boot.toast(t('analytics.export.done', { n: F.int(figures) }));
  }

  /* A-06. The print stylesheet keys off `html[data-print]` and prints the
     running header and footer from body attributes, so the collection date is
     on every page whatever was printed. */
  function printPanel(state, rows, scope) {
    var model = buildModel(state, rows, scope);
    var root = document.documentElement;
    var previous = root.getAttribute('data-print');
    var done = false;

    function restore() {
      if (done) return;
      done = true;
      if (previous === null) root.removeAttribute('data-print');
      else root.setAttribute('data-print', previous);
      document.body.removeAttribute('data-print-header');
      document.body.removeAttribute('data-print-footer');
      w.removeEventListener('afterprint', restore);
    }

    root.setAttribute('data-print', 'analytics');
    document.body.setAttribute('data-print-header',
      GEO.PRODUCT.name + ' · ' + t('analytics.title') + ' · ' +
      t('analytics.scope', { n: F.int(rows.length), m: F.int(scope.length) }));
    document.body.setAttribute('data-print-footer',
      model.verifiedText + ' · ' + A.coverageStatement(rows));
    w.addEventListener('afterprint', restore);

    try { w.print(); }
    catch (e) {
      GEO.log.error('window.print() was refused', e);
      GEO.boot.toast(t('error.print'));
    }
    restore();
  }

  /* ================================================================ model */

  /**
   * Everything the panel shows, derived from the rows it was handed. Called on
   * every render AND by export and print, so a file can never carry a figure
   * the screen does not (decision C).
   */
  function buildModel(state, rows, scope) {
    var cards = A.dashboard(rows);
    var live = [], empty = [];

    cards.forEach(function (m) {
      /* "Structurally empty" is derived, never a hard-coded list: a metric
         with no recorded value anywhere in the selection. The same test moves
         a card back up by itself the moment demo mode or an edit supplies a
         value (D11) — which is the UX-8 demonstration. */
      if (m.kind !== 'count' && m.n === 0) empty.push(m); else live.push(m);
    });

    var summary = null;
    if (GEO.quality && GEO.quality.datasetSummary) {
      try { summary = GEO.quality.datasetSummary(rows); }
      catch (e) { GEO.log.warn('quality.datasetSummary threw', e); }
    }

    var describe = (GEO.filters && GEO.filters.describe) ? GEO.filters.describe(state.filters) : '';

    return {
      cards: cards,
      live: live,
      empty: empty,
      specs: [districtSpec(rows), classSpec(rows), rentSpec(rows), glaSpec(rows), coverageSpec(rows)],
      filterText: (GEO.state.activeFilterCount(state.filters) && describe)
        ? t('analytics.filters.active', { list: describe })
        : t('analytics.filters.none'),
      verifiedText: t('detail.quality.verified', { date: F.date(lastVerified(rows)) }),
      stalenessNote: summary ? summary.stalenessNote : null
    };
  }

  /* =============================================================== drawing */

  function actionsRow(state, rows) {
    var none = rows.length === 0;
    var kids = [
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        text: t('analytics.export.analysis'),
        disabled: none ? true : null,
        title: none ? t('analytics.export.disabled') : t('analytics.export.analysis.note'),
        onclick: function () {
          var s = GEO.state.get();
          exportAnalysis(s, GEO.boot.visible(s), GEO.boot.scope(s));
        }
      }),
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        text: t('analytics.print'),
        onclick: function () {
          var s = GEO.state.get();
          printPanel(s, GEO.boot.visible(s), GEO.boot.scope(s));
        }
      })
    ];
    // §29: a disabled control states why, visibly — not only in a tooltip.
    if (none) kids.push(el('span.reason.reason--inline', { text: t('analytics.export.disabled') }));
    else kids.push(el('span.micro', { text: t('analytics.export.note') }));
    return el('div.row', {}, kids);
  }

  function headerBlock(state, rows, scope, model) {
    var active = GEO.state.activeFilterCount(state.filters);
    var kids = [];

    // A-01. The scope line is what makes a screenshot of this panel
    // self-describing: analytics cover the FILTERED set, not the selection.
    kids.push(el('div.scope', {}, [
      el('span', { text: t('analytics.scope', { n: F.int(rows.length), m: F.int(scope.length) }) }),
      active ? el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('analytics.scope.clear'),
        onclick: function () {
          GEO.state.resetFilters({ source: 'user', action: 'analytics:clearFilters',
                                   summary: t('analytics.scope.clear') });
        }
      }) : null
    ]));

    kids.push(el('p.micro', { text: model.filterText }));
    kids.push(el('p.coverage', { text: A.coverageStatement(rows) }));
    kids.push(el('p.micro', { text: model.verifiedText }));
    if (model.stalenessNote) kids.push(el('p.micro', { text: model.stalenessNote }));
    if (state.selectedId) kids.push(el('p.micro', { text: t('analytics.scope.selection') }));

    if (GEO.data.containsDemo(rows)) {
      kids.push(el('p.row.row--tight', {}, [
        demoBadge(),
        el('span.micro', { text: t('analytics.demo', { n: F.int(demoCount(rows)) }) })
      ]));
    }

    kids.push(actionsRow(state, rows));
    return el('header.stack', {}, kids);
  }

  function statsBlock(model, rows) {
    var kids = [
      el('h3.sectitle', { text: t('analytics.metrics.title') }),
      el('div.stats', {}, model.live.map(function (m) { return metricCard(m, rows); }))
    ];

    /* The caveats the headline count carries — unresolved duplicate pairs and
       records whose own name says they are a company — are rendered beside the
       cards, not only inside the popover. A supply figure that may double-count
       says so where it is read (§2.7). */
    var notes = [];
    model.cards.forEach(function (m) {
      (m.notes || []).forEach(function (n) { notes.push(n); });
    });
    if (notes.length) {
      kids.push(el('div.stack', {}, notes.map(function (n) { return el('p.micro', { text: n }); })));
    }

    if (model.empty.length) {
      kids.push(el('h3.sectitle', { text: t('analytics.notCollected.title') }));
      kids.push(el('p.micro', { text: t('analytics.notCollected.body', { m: F.int(rows.length) }) }));
      kids.push(el('div.stats', {}, model.empty.map(function (m) { return metricCard(m, rows); })));
    }

    return el('section.stack', { 'aria-label': t('analytics.metrics.title') }, kids);
  }

  function draw(pane, state, rows, scope) {
    var model = buildModel(state, rows, scope);
    var kids = [headerBlock(state, rows, scope, model), statsBlock(model, rows)];

    model.specs.forEach(function (spec) {
      if (spec.lead) kids.push(el('p.micro', { text: spec.lead }));
      kids.push(drawChart(spec));
      if (spec.id === 'coverage') {
        // D-13 lives in the Data workspace: the filter model cannot express
        // "records missing field X", so this opens the view that can list them
        // rather than pretending a bar is a filter.
        var external = state.role === 'external';
        var btn = el('button.btn.btn--quiet.btn--sm', {
          type: 'button',
          text: t('analytics.coverage.openData'),
          disabled: external ? true : null,
          onclick: function () { openCoverageWorkspace(); }
        });
        kids.push(el('div.row', {}, [
          btn,
          external ? el('span.reason.reason--inline', { text: t('hdr.data.hiddenExternal') }) : null
        ]));
      }
    });

    Q.fill(pane, [el('div.stack.stack--lg', {}, kids)]);
  }

  /* --------------------------------------------------------------- render */

  /* The slice of state this panel depends on. `hoverId` is deliberately absent:
     a pointer crossing the results list must not redraw five charts. */
  function signature(state, rows, scope) {
    return [state.rightTab, state.rightRail, state.bp, state.role,
            state.demoMode, state.excludeSuspectedNonBc, state.selectedId,
            scope.length, rows.length, dataVersion, GEO.i18n.locale,
            (GEO.filters && GEO.filters.toHash) ? GEO.filters.toHash(state.filters) : '',
            rows.map(function (r) { return r.id; }).join(',')].join('|');
  }

  function render(state, rows, scope) {
    var pane = Q.$(PANE);
    if (!pane) return;

    // While the tab is hidden there is nothing to keep in step; clearing the
    // signature guarantees a full redraw the moment it is shown again.
    if (state.rightRail !== 'open' || state.rightTab !== 'analytics') { lastSig = null; return; }

    var sig = signature(state, rows, scope);
    if (sig === lastSig) return;
    lastSig = sig;

    draw(pane, state, rows, scope);
  }

  /* An edit arrives as an empty patch that 99-boot re-broadcasts, and a locale
     change arrives outside state entirely, so neither is visible in the
     signature. Both bump a counter that is. */
  GEO.on('data:changed', function () { dataVersion += 1; lastSig = null; });
  GEO.on('i18n:locale', function () { dataVersion += 1; lastSig = null; });

  /* `99-boot.js` is LAST in the manifest and opens with `GEO.boot = {}`, so at
     panel-load time `GEO.boot.registerPanel` does not exist yet. DOMContentLoaded
     is the seam: every inline script has run by then, and because this listener
     is added while 15 loads — before 99-boot adds its own — registration lands
     before `B.start()` subscribes the renderer. */
  function registerWithBoot() {
    if (!GEO.boot || !GEO.boot.registerPanel) return false;
    GEO.boot.registerPanel(render);
    return true;
  }

  if (!registerWithBoot()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (!registerWithBoot()) {
          GEO.log.error('15-panel-analytics: GEO.boot.registerPanel is unavailable — the Analytics tab will not render');
        }
      });
    } else {
      setTimeout(function () {
        if (!registerWithBoot()) {
          GEO.log.error('15-panel-analytics: GEO.boot.registerPanel is unavailable — the Analytics tab will not render');
        }
      }, 0);
    }
  }
}(window));
