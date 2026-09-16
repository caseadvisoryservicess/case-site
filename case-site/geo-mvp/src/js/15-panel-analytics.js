/* ===========================================================================
 * 15-panel-analytics — the Analytics tab (§14, §36; IA §5.5, A-01…A-07)
 *
 * This is the panel that either earns the product's credibility or spends it.
 * Five decisions are worth knowing before reading the code.
 *
 * A. A CARD IS NEVER HIDDEN FOR HAVING NO DATA.
 *    Five of the eight §14 metrics have zero coverage on the observed set
 *    (GLA, available area, occupancy, vacancy, status). Dropping them would
 *    leave a tidy dashboard answering only the questions this dataset happens
 *    to answer — the most flattering lie available here. They are grouped
 *    under "Not yet collected" with their 0-of-N coverage stated, and they
 *    move back up by themselves under demo mode or after an edit (D11). The
 *    test is derived (`metric.n === 0`), never a hard-coded list of fields.
 *
 * B. EVERY FIGURE CARRIES ITS DENOMINATOR — ON SCREEN AND IN THE FILE.
 *    The metric object owns `n`, `N` and `coverageText`; this file renders the
 *    coverage line under every card and every chart, and writes n, N and the
 *    coverage sentence into every row of the CSV. A consultant who cannot get
 *    the numbers out of a tool has a demo, not an instrument (M10).
 *
 * C. NOTHING DERIVED IS CACHED.
 *    The only things held between renders are a render signature (a string), a
 *    data-version counter and five empty mount elements. Export and print
 *    recompute from live state rather than from what happens to be on screen,
 *    so a figure in a file can never be one edit older than the panel.
 *
 * D. THE CHART MODULE OWNS THE PIXELS; THIS FILE OWNS THE QUESTION.
 *    10-charts mounts an instance INTO a container and keeps it alive (resize
 *    observer, chart/table toggle, mark transitions). So the five containers
 *    are created once and re-attached on each redraw — building a fresh div per
 *    render would orphan an instance, and its observer, every time the panel
 *    re-rendered. If a chart cannot be drawn at all, the container gets the
 *    TABLE of the same numbers: the honest failure of a chart is a table.
 *
 * E. A BAR THAT CANNOT FILTER SAYS SO.
 *    Clicking a district, a class or a bin applies that filter (A-03). The
 *    unknown bar cannot: the filter model has no "only unrecorded" predicate.
 *    Rather than a silent no-op (§29) it explains itself and points at the Data
 *    workspace, which can list those records.
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
    'analytics.chart.district.coverage': 'District is recorded for all {m} properties.',
    'analytics.chart.unknownNotFilter': 'The filters have no "only unrecorded" option, so that bar is a denominator, not a link. The Data workspace lists the records behind it.',
    'analytics.chart.binFilterNote': 'Bands are left-closed and right-open. The filter is inclusive at both ends, so a value sitting exactly on an upper edge is admitted by the band below it as well.',
    'analytics.strip.median': 'Median {value}. Range {min} to {max}.',
    'analytics.strip.medianRef': 'Median {value}',
    'analytics.strip.iqr': 'Middle half (Q1–Q3): {q1} to {q3}.',
    'analytics.strip.select': 'Select {name}',
    'analytics.coverage.lead': 'This is the chart a professional collection programme would change: every figure above is capped by these bars.',
    'analytics.coverage.openData': 'Open the coverage view in the Data workspace',
    'analytics.formula.count': 'A count of the records in the current selection. A count of zero is a measured fact, so it is always published.',
    'analytics.formula.sum': 'The {n} recorded values added together. Records with nothing recorded are excluded, never counted as zero.',
    'analytics.formula.mean': 'The {n} recorded values added together, divided by {n}. Records with nothing recorded are excluded, never counted as zero.',
    'analytics.formula.median': 'The middle of the {n} recorded values, sorted; at an even count, the mean of the two central values.',
    'analytics.formula.split': 'Records counted by recorded status. The {n} whose status is not recorded are in neither group, and are not implied to be either.',
    'analytics.metric.excluded.more': '{n} more are not listed here.'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.has(k, 'en')) GEO.i18n.en[k] = ADDED[k];
  });

  /* View bookkeeping only. `sig` is a string, `dataVersion` a counter and
     `mounts` five empty elements — no record, metric or series is held here. */
  var lastSig = null;
  var dataVersion = 0;
  var mounts = {};

  /* §7.6: the 8 critical fields plus the three that identify a record at all.
     Derived from the registry, so a new critical field gains a bar by itself. */
  var COVERAGE_EXTRA = ['name', 'address', 'districtKey'];

  /* A popover listing 132 excluded records is a scroll, not a disclosure; the
     rest are named by count and reachable in the Data workspace. */
  var EXCLUDED_SHOWN = 25;

  /* D10 §7.1: a median needs 3 values, a middle-half band needs 8. */
  var IQR_MIN_N = 8;

  /* ---------------------------------------------------------------- labels */

  /* Office class is the only enum this panel renders as a category: the status
     split is a sentence from the string table, not a list of enum labels. */
  var ENUM_KEYS = {
    officeClass: { 'A+': 'value.class.aPlus', 'A': 'value.class.a', 'B+': 'value.class.bPlus',
                   'B': 'value.class.b', 'C': 'value.class.c' }
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

  /** D4: a demo record is badged wherever it appears — including inside a
   *  popover list and inside a chart point's own label. */
  function demoBadge() {
    return el('span.badge.badge--demo', {
      text: t('common.demo.badge'), title: t('value.recordType.demo')
    });
  }

  function demoCount(rows) {
    return rows.filter(function (r) { return r.recordType === 'DEMO'; }).length;
  }

  /** The most recent verification date in the selection. On the panel and in
   *  the export header: a figure without a date is a rumour. */
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
     (kind + field) rather than by its position, so re-ordering `dashboard()`
     can never re-label a card. A metric this map does not know keeps the label
     the analytics module gave it. */
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
   * The value slot has three outcomes and no fourth: a number, a measured
   * split, or the words. Never blank, never a dash, and never a zero standing
   * in for an unknown — `vacancyPct: 0` prints "0%" from the metric's own
   * display, which is how a measured zero stays distinguishable (§36).
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
    // A-07: the reason replaces the number and names what is missing. It is
    // text, not a link — it never offers to "estimate anyway".
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

  /** The records a metric left out, by name. The point of A-02 is that
   *  "excluded for missing data" is checkable, not merely asserted. */
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

    // Analytics rules §8: the qualifier lives in the label, and the reason
    // weighting is impossible here is stated with its own coverage.
    if (m.weighting) {
      var glaCov = A.coverage(rows, 'gla');
      kids.push(el('p.micro', {
        text: t('analytics.metric.weighting', {
          how: t('common.unweighted'), n: F.int(glaCov.n), m: F.int(glaCov.N)
        })
      }));
    }

    (m.notes || []).forEach(function (note) { kids.push(el('p.micro', { text: note })); });

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

  /* =============================================================== charts */

  /* 10-charts' own shapers carry the unknown bucket through and keep a
     suppressed mean as `null` rather than as a zero. They are used in
     preference to mapping groups by hand — the hand-written version is exactly
     where an unknown bucket gets dropped. The local equivalents run only if the
     chart module is unavailable, and follow the same two rules. */
  function rowsFromGroups(groups) {
    if (GEO.charts && GEO.charts.rowsFromGroups) return GEO.charts.rowsFromGroups(groups);
    return (groups || []).map(function (g) {
      return { key: g.key, label: g.label, value: g.count, unknown: !!g.unknown, rows: g.rows };
    });
  }

  function rowsFromHistogram(h) {
    if (GEO.charts && GEO.charts.rowsFromHistogram) return GEO.charts.rowsFromHistogram(h);
    var out = (h.series || []).map(function (b, i) {
      return { key: 'bin-' + i, label: b.label, value: b.count, unknown: false, rows: b.rows };
    });
    if (h.unknown) {
      out.push({ key: '__unknown__', label: h.unknown.label, value: h.unknown.count,
                 unknown: true, rows: h.unknown.rows });
    }
    return out;
  }

  /** The bin edges travel with the row so a click can turn a band back into a
   *  range filter without the handler re-deriving them from a label. */
  function attachEdges(items, hist) {
    (hist.series || []).forEach(function (bin, i) {
      if (!items[i]) return;
      items[i].lo = (bin.lo === undefined) ? null : bin.lo;
      items[i].hi = (bin.hi === undefined) ? null : bin.hi;
    });
    return items;
  }

  /* --- chart 1 · business centres by district ---------------------------- */
  function districtSpec(rows) {
    var groups = A.byDistrict(rows);
    var unknown = null, known = [];
    groups.forEach(function (g) { if (g.unknown) { unknown = g; } else { known.push(g); } });

    /* §7.2: count descending, ties alphabetical by DISPLAY name, zero-count
       districts kept at the bottom. Yangihayot and Bektemir hold no records:
       that is a true zero in this dataset, not missing data, and a chart that
       dropped them would quietly shorten the city to ten districts. */
    known.sort(function (a, b) {
      return b.count - a.count || (a.label < b.label ? -1 : (a.label > b.label ? 1 : 0));
    });

    // districtKey is required by the schema, so there is normally no unknown
    // bucket at all (§7.0.1); it is drawn only if one somehow exists.
    var ordered = (unknown && unknown.count) ? known.concat([unknown]) : known;

    return {
      id: 'district', kind: 'bar', render: 'barChart',
      title: t('analytics.chart.district'),
      rows: rowsFromGroups(ordered),
      total: rows.length,
      axisTitle: t('analytics.axis.count'),
      categoryLabel: t('analytics.axis.district'),
      valueLabel: t('analytics.axis.count'),
      coverageText: !rows.length ? t('common.coverage.empty')
        : ((unknown && unknown.count)
            ? coverageLine(rows.length - unknown.count, rows.length, fieldLabel('districtKey'))
            : t('analytics.chart.district.coverage', { m: F.int(rows.length) })),
      insufficient: rows.length ? null : { reason: t('analytics.chart.empty') },
      onBarClick: function (row) { applyDistrict(row); }
    };
  }

  /* --- chart 2 · business centres by class ------------------------------- */
  function classSpec(rows) {
    var groups = A.byClass(rows);                 // fixed ordinal order, unknown last
    var cov = A.coverage(rows, 'officeClass');
    var items = rowsFromGroups(groups);

    /* The hatched "Class not recorded" bar is the largest bar in this dataset
       (132 of 148). Hiding it would be the single most misleading thing this
       application could do, so it is drawn at every n, labelled with its count,
       and left out of nothing except the ordinal ramp it is not a step of. */
    items.forEach(function (r) {
      if (!r.unknown) r.label = enumLabel('officeClass', r.key);
    });

    return {
      id: 'class', kind: 'bar', render: 'barChart', ordinal: true,
      title: t('analytics.chart.class'),
      rows: items,
      total: rows.length,
      axisTitle: t('analytics.axis.count'),
      categoryLabel: t('analytics.axis.class'),
      valueLabel: t('analytics.axis.count'),
      coverageText: coverageLine(cov.n, cov.N, fieldLabel('officeClass')),
      note: t('analytics.chart.unknownNote'),
      insufficient: rows.length ? null : { reason: t('analytics.chart.empty') },
      onBarClick: function (row) { applyClass(row); }
    };
  }

  /* --- charts 3 and 4 · distributions ------------------------------------ */

  /** Tukey hinges: at an odd count the median belongs to both halves. Used only
   *  at n ≥ 8, where a middle-half band describes rather than claims. */
  function hinges(values) {
    var s = values.slice().sort(function (a, b) { return a - b; });
    var n = s.length, half = Math.floor(n / 2);
    return {
      q1: A.median(s.slice(0, n % 2 ? half + 1 : half)),
      q3: A.median(s.slice(half))
    };
  }

  function rentSpec(rows, state) {
    var d = A.rentDistribution(rows);
    var unknownLine = t('analytics.chart.unknownBar', { n: F.int(d.histogram.unknown.count) });
    var rentFmt = function (v) { return F.rent(v); };

    /* D10 §7.1, the form ladder. At n = 0 there is no axis: an empty axis
       implies a measured zero everywhere. Below 30 the individual values are
       plotted, because a 7-bin histogram over 16 points implies a distribution
       the sample cannot support. */
    if (d.form === 'strip') {
      var vals = d.points.map(function (p) { return p.value; });
      var notes = [], refs = [];

      if (d.n >= A.MIN_N) {
        var med = A.median(vals);
        refs.push({ value: med, label: t('analytics.strip.medianRef', { value: rentFmt(med) }) });
        notes.push(t('analytics.strip.median', {
          value: rentFmt(med), min: rentFmt(d.min), max: rentFmt(d.max)
        }));
        if (d.n >= IQR_MIN_N) {
          var h = hinges(vals);
          notes.push(t('analytics.strip.iqr', { q1: rentFmt(h.q1), q3: rentFmt(h.q3) }));
        }
      } else if (d.n) {
        // 1–2 values: the individual facts, with no median and no quartiles.
        notes.push(t('analytics.strip.note', { n: F.int(d.n) }));
      }
      // A strip plot has no bar to carry the unknown block, so it is stated in
      // words beside the plot — shown in every form, never dropped (§7.1).
      notes.push(unknownLine);

      var points = d.points.map(function (p) {
        var rec = GEO.data.get(p.id);
        var demo = !!(rec && rec.recordType === 'DEMO');
        var name = U.isKnown(p.name) ? p.name : F.UNKNOWN;
        // The DEMO mark is written into the label as well as flagged, so it
        // survives a renderer that knows nothing about record types (D4) — but
        // only when the name does not already announce it, because "DEMO —
        // Alpha Tower · DEMO" reads as a rendering bug rather than a warning.
        var marked = demo && name.indexOf(t('common.demo.badge')) < 0;
        return {
          key: p.id, id: p.id,
          label: marked ? name + ' · ' + t('common.demo.badge') : name,
          value: p.value,
          sub: U.isKnown(p.officeClass) ? enumLabel('officeClass', p.officeClass)
                                        : t('value.class.unknown'),
          selected: state.selectedId === p.id
        };
      });

      return {
        id: 'rent', kind: 'strip', render: 'stripPlot',
        title: t('analytics.chart.rent'),
        points: points,
        min: d.min, max: d.max,
        total: rows.length,
        valueFormat: rentFmt,
        tickFormat: function (v) { return F.num(v, 0); },
        axisTitle: t('analytics.axis.rent'),
        categoryLabel: t('field.name'),
        valueLabel: fieldLabel('askingRent'),
        refs: refs,
        coverageText: d.coverageText,
        note: notes.join(' '),
        insufficient: d.n ? null : { reason: A.metric(rows, 'askingRent', 'mean').reason },
        onPointClick: function (p) { selectRecord(p); }
      };
    }

    return {
      id: 'rent', kind: 'column', render: 'columnChart',
      title: t('analytics.chart.rent'),
      rows: attachEdges(rowsFromHistogram(d.histogram), d.histogram),
      total: rows.length,
      axisTitle: t('analytics.axis.count'),
      categoryLabel: t('analytics.axis.rent'),
      valueLabel: t('analytics.axis.count'),
      coverageText: d.coverageText,
      note: t('analytics.chart.binFilterNote'),
      onBarClick: function (row) { applyRange(row, 'rentMin', 'rentMax'); }
    };
  }

  function glaSpec(rows) {
    var d = A.glaDistribution(rows);

    /* D11: the chart ships and renders its insufficient state on the observed
       set (0 of 148), and becomes live under demo mode or after an editor
       entry — which is the UX-8 demonstration. Dropping it would hide the gap
       it exists to report. The bins stay readable in the table view either way. */
    return {
      id: 'gla', kind: 'column', render: 'columnChart',
      title: t('analytics.chart.gla'),
      rows: attachEdges(rowsFromHistogram(d.histogram), d.histogram),
      total: rows.length,
      axisTitle: t('analytics.axis.count'),
      categoryLabel: t('analytics.axis.gla'),
      valueLabel: t('analytics.axis.count'),
      valueFormat: F.int,
      coverageText: d.coverageText,
      note: d.sufficient ? t('analytics.chart.binFilterNote')
                         : t('analytics.chart.unknownBar', { n: F.int(d.histogram.unknown.count) }),
      insufficient: d.sufficient ? null : { reason: d.reason },
      onBarClick: d.sufficient ? function (row) { applyRange(row, 'glaMin', 'glaMax'); } : null
    };
  }

  /* --- chart 5 · data coverage by field ---------------------------------- */
  function coverageSpec(rows) {
    var wanted = S.criticalFields.concat(COVERAGE_EXTRA);
    var items = A.fieldCoverage(rows)
      .filter(function (c) { return wanted.indexOf(c.key) >= 0; })
      .map(function (c) {
        return { key: c.key, label: fieldLabel(c.key), n: c.n, N: c.N, critical: !!c.critical };
      });

    /* No `onRowClick`: its accessible name promises "show the records missing
       this field", and the filter model cannot express that. The button under
       the chart opens the workspace that can (D-13) — §29 again. `note` is
       left free so the chart's own critical-field footnote survives. */
    return {
      id: 'coverage', kind: 'coverage', render: 'coverageBars',
      title: t('analytics.chart.coverage'),
      lead: t('analytics.coverage.lead'),
      rows: items,
      total: rows.length,
      categoryLabel: t('analytics.axis.field'),
      coverageText: t('analytics.coverage.note'),
      insufficient: rows.length ? null : { reason: t('analytics.chart.empty') }
    };
  }

  /* --------------------------------------------------------- chart drawing */

  /** One shaping of a spec into rows of text, used by the CSV export and by the
   *  table the panel draws if a chart cannot be. Two consumers, one source. */
  function figuresOf(spec) {
    var fmt = spec.valueFormat || F.int;
    var out = [];

    if (spec.insufficient) {
      out.push({ item: t('common.insufficient'), value: spec.insufficient.reason,
                 n: null, N: spec.total });
    }
    if (spec.kind === 'coverage') {
      (spec.rows || []).forEach(function (r) {
        out.push({ item: r.label, value: t('common.of', { n: F.int(r.n), m: F.int(r.N) }),
                   n: r.n, N: r.N, unknown: !r.n });
      });
    } else if (spec.kind === 'strip') {
      (spec.points || []).forEach(function (p) {
        out.push({ item: p.label, value: fmt(p.value), n: null, N: spec.total });
      });
    } else {
      (spec.rows || []).forEach(function (r) {
        var known = typeof r.value === 'number';
        out.push({ item: r.label, value: known ? fmt(r.value) : t('common.insufficient'),
                   n: known ? r.value : null, N: spec.total, unknown: !!r.unknown });
      });
    }
    return out;
  }

  /* What the panel draws if `GEO.charts` is missing or throws: the table of the
     same numbers. Every value present, none gated behind colour or hover —
     which is the A-04 requirement anyway, so the degraded panel is still
     readable, printable and exportable, just not graphical. */
  function fallbackChart(spec) {
    var figures = figuresOf(spec);
    var head = el('tr', {}, [
      el('th', { scope: 'col', text: spec.categoryLabel || t('analytics.chart.col.category') }),
      el('th.tbl__num', { scope: 'col', text: spec.valueLabel || t('analytics.chart.col.value') })
    ]);
    var body = figures.map(function (f) {
      return el('tr', { 'data-unknown': f.unknown ? 'true' : null }, [
        el('th', { scope: 'row', text: f.item }),
        el('td.tbl__num', { text: f.value })
      ]);
    });

    return el('section.chart', { 'aria-label': spec.title }, [
      el('div.chart__hd', {}, [
        el('div.chart__title', {}, [
          el('span', { text: spec.title }),
          spec.categoryLabel ? el('span.chart__sub', { text: spec.categoryLabel }) : null
        ])
      ]),
      el('table.chart__table.tbl', {}, [el('thead', {}, [head]), el('tbody', {}, body)]),
      spec.note ? el('p.micro', { text: spec.note }) : null,
      el('p.coverage.chart__cov', { text: spec.coverageText })
    ]);
  }

  /** The container is created once per chart and reused, because 10-charts
   *  keeps a live instance per container (decision D). */
  function mountFor(id) {
    if (!mounts[id]) mounts[id] = el('div', { 'data-chart': id });
    return mounts[id];
  }

  function drawChart(spec) {
    var host = mountFor(spec.id);
    var C = GEO.charts;
    var fn = null;
    if (C) {
      if (typeof C[spec.render] === 'function') fn = C[spec.render];
      else if (typeof C.render === 'function') fn = C.render;
    }

    var ok = false;
    if (fn) {
      try { ok = !!fn.call(C, host, spec); }
      catch (e) {
        GEO.log.error('charts.' + spec.render + ' threw — showing the table instead', e);
        ok = false;
      }
    }
    if (!ok) Q.fill(host, [fallbackChart(spec)]);
    return host;
  }

  /* ============================================================== actions */

  /* A-03. Clicking a mark applies the matching filter and shows the results
     list, so a chart is a way of asking a question rather than a picture of an
     answer. Every write goes through GEO.state.set, which is what keeps the
     manual filter controls in step with it (§59). */

  function showResults(state) {
    var p = { leftRail: 'open', leftTab: 'results' };
    // P3: on a phone at most one panel may cover the map, so the rail the
    // reader is in yields to the list it just sent them to.
    if (isSmall(state.bp)) p.rightRail = 'closed';
    return p;
  }

  /** Decision E: the unknown bar is not a control, and says so rather than
   *  doing nothing when it is clicked. */
  function notFilterable() {
    if (GEO.boot && GEO.boot.toast) {
      GEO.boot.toast(t('analytics.chart.unknownNotFilter'), {
        label: t('common.nav.data'),
        run: function () { openCoverageWorkspace(); }
      });
    }
  }

  function applyFilter(patch, row) {
    var state = GEO.state.get();
    GEO.state.set(Object.assign({ filters: patch }, showResults(state)),
      { source: 'user', action: 'analytics:filter',
        summary: t('analytics.chart.filterAction', { category: row.label }) });
  }

  function applyDistrict(row) {
    if (!row || row.unknown || !row.key) { notFilterable(); return; }
    applyFilter({ districts: [row.key] }, row);
  }

  function applyClass(row) {
    if (!row || row.unknown || !row.key) { notFilterable(); return; }
    applyFilter({ classes: [row.key] }, row);
  }

  function applyRange(row, minKey, maxKey) {
    if (!row || row.unknown) { notFilterable(); return; }
    var patch = {};
    patch[minKey] = (row.lo === undefined) ? null : row.lo;
    patch[maxKey] = (row.hi === undefined) ? null : row.hi;
    applyFilter(patch, row);
  }

  /** A strip-plot dot is one building, so clicking it selects that building
   *  rather than filtering the market down to a band of one. */
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
   * A-05 / M10. The figures on screen, each with its n, its N and its coverage
   * sentence, under a header block naming the filters, the selection, the
   * verification date and the assumed rent unit. Recomputed from live state at
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
      figuresOf(spec).forEach(function (f) {
        lines.push(csvRow([spec.title, f.item, f.value,
                           f.n === null || f.n === undefined ? '' : F.int(f.n),
                           F.int(f.N === undefined || f.N === null ? spec.total : f.N),
                           spec.coverageText]));
        figures++;
      });
    });

    GEO.boot.download(lines.join('\n'),
                      'geo-mvp-analysis-' + GEO.date.today() + '.csv', 'text/csv');
    GEO.boot.toast(t('analytics.export.done', { n: F.int(figures) }));
  }

  /* A-06. The print stylesheet keys off `html[data-print]` and prints its
     running header and footer from body attributes, so the denominator and the
     verification date are on every page whatever was printed. */
  function printPanel(state, rows, scope) {
    var model = buildModel(state, rows, scope);
    var root = document.documentElement;
    var previous = root.getAttribute('data-print');
    var restored = false;

    function restore() {
      if (restored) return;
      restored = true;
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

    // Charts are measured from their container, and print gives them a
    // different one; re-measuring first keeps the paper copy in proportion.
    if (GEO.charts && GEO.charts.redrawAll) GEO.charts.redrawAll();

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
      /* "Structurally empty" is derived, never a hard-coded list: a metric with
         no recorded value anywhere in the selection. The same test moves a card
         back up by itself the moment demo mode or an edit supplies a value. */
      if (m.kind !== 'count' && m.n === 0) empty.push(m); else live.push(m);
    });

    var summary = null;
    if (GEO.quality && GEO.quality.datasetSummary) {
      try { summary = GEO.quality.datasetSummary(rows); }
      catch (e) { GEO.log.warn('quality.datasetSummary threw', e); }
    }

    var described = (GEO.filters && GEO.filters.describe) ? GEO.filters.describe(state.filters) : '';

    return {
      cards: cards,
      live: live,
      empty: empty,
      specs: [districtSpec(rows), classSpec(rows), rentSpec(rows, state),
              glaSpec(rows), coverageSpec(rows)],
      filterText: (GEO.state.activeFilterCount(state.filters) && described)
        ? t('analytics.filters.active', { list: described })
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
    kids.push(el('span.reason.reason--inline', {
      text: none ? t('analytics.export.disabled') : t('analytics.export.analysis.note')
    }));
    return el('div.row', {}, kids);
  }

  function headerBlock(state, rows, scope, model) {
    var active = GEO.state.activeFilterCount(state.filters);
    var kids = [];

    /* A-01. The scope line is what makes a screenshot of this panel
       self-describing: the figures cover the FILTERED set, not the selection,
       and the reader is told so on every render rather than left to assume. */
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

    /* The caveats the headline count carries — unresolved duplicate pairs, and
       records whose own name says they are a company — are rendered beside the
       cards, not only inside the popover. A supply figure that may double-count
       has to say so where it is read (§2.7). */
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

  function coverageActions(state) {
    // D-13 lives in the Data workspace: the filter model cannot express
    // "records missing field X", so this opens the view that can list them
    // instead of pretending a bar is a filter.
    var external = state.role === 'external';
    return el('div.row', {}, [
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        text: t('analytics.coverage.openData'),
        disabled: external ? true : null,
        onclick: function () { openCoverageWorkspace(); }
      }),
      external ? el('span.reason.reason--inline', { text: t('hdr.data.hiddenExternal') }) : null
    ]);
  }

  function draw(pane, state, rows, scope) {
    var model = buildModel(state, rows, scope);
    var kids = [headerBlock(state, rows, scope, model), statsBlock(model, rows)];

    model.specs.forEach(function (spec) {
      if (spec.lead) kids.push(el('p.micro', { text: spec.lead }));
      kids.push(drawChart(spec));
      if (spec.id === 'coverage') kids.push(coverageActions(state));
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
     change arrives outside state entirely, so neither shows up in the
     signature. Both force exactly one redraw. */
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
