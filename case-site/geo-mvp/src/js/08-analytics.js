/* ===========================================================================
 * 08-analytics — metrics, aggregation, and the missing-data rules
 *
 * Brief §14 and §36. This is the module the product's credibility rests on.
 *
 * THE ONE RULE: a metric may read values only through `known()`. Nothing in
 * this file, or anywhere else, may iterate a raw array of records and read a
 * field directly — that is how an unknown silently becomes a zero. Every
 * metric returns `n` (records that contributed) and `N` (records in the
 * selection) and renders a coverage line stating both.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema, F = GEO.fmt;
  var A = GEO.analytics = {};

  /* Below this many contributing records a mean, median or distribution is not
     published. A "district average rent" computed from one building is not an
     average, it is that building's rent wearing a disguise. Counts are exempt:
     a count of zero is a fact, not an absence. */
  A.MIN_N = 3;

  /** THE ONLY READER. Returns the non-null values of `field` across `rows`. */
  A.known = function (rows, field) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var v = rows[i][field];
      if (U.isKnown(v)) out.push(v);
    }
    return out;
  };

  A.withKnown = function (rows, field) {
    return rows.filter(function (r) { return U.isKnown(r[field]); });
  };

  A.coverage = function (rows, field) {
    return { n: A.withKnown(rows, field).length, N: rows.length };
  };

  A.mean = function (xs) {
    if (!xs.length) return null;
    var s = 0;
    for (var i = 0; i < xs.length; i++) s += xs[i];
    return s / xs.length;
  };

  /** Even sample size -> the mean of the two central values. Stated, not implied. */
  A.median = function (xs) {
    if (!xs.length) return null;
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  A.sum = function (xs) {
    var s = 0;
    for (var i = 0; i < xs.length; i++) s += xs[i];
    return s;
  };

  /**
   * The universal metric object. Everything rendered as a number in this app
   * comes from here, so the denominator can never be forgotten.
   *
   * kind: 'count' | 'sum' | 'mean' | 'median' | 'min' | 'max'
   * Returns:
   *   { kind, field, value, n, N, unit, sufficient, reason,
   *     display, coverageText, containsDemo, label }
   */
  A.metric = function (rows, field, kind, opts) {
    opts = opts || {};
    var fd = S.field(field) || {};
    var label = opts.label || fd.label || field;
    var unit = opts.unit !== undefined ? opts.unit : (fd.unit || null);
    var N = rows.length;
    var containsDemo = GEO.data.containsDemo(rows);

    if (kind === 'count') {
      return finish({ value: N, n: N, sufficient: true, reason: null });
    }

    var vals = A.known(rows, field);
    var n = vals.length;

    if (n === 0) {
      return finish({
        value: null, n: 0, sufficient: false,
        reason: 'No property in the current selection has a recorded ' + label.toLowerCase() + '.'
      });
    }

    // Sums are publishable at any n — "total known GLA over 2 buildings" is a
    // true statement about those 2 buildings, provided the denominator is shown.
    var needsMinN = (kind === 'mean' || kind === 'median');
    if (needsMinN && n < A.MIN_N) {
      return finish({
        value: null, n: n, sufficient: false,
        reason: 'Only ' + n + ' of ' + N + ' ' + F.plural(N, 'property', 'properties') +
                ' ' + F.plural(n, 'has', 'have') + ' a recorded ' + label.toLowerCase() +
                '. At least ' + A.MIN_N + ' are needed before an average is meaningful.'
      });
    }

    var v = kind === 'sum' ? A.sum(vals)
          : kind === 'mean' ? A.mean(vals)
          : kind === 'median' ? A.median(vals)
          : kind === 'min' ? Math.min.apply(null, vals)
          : kind === 'max' ? Math.max.apply(null, vals)
          : null;

    return finish({ value: v, n: n, sufficient: true, reason: null });

    function finish(core) {
      var dp = opts.dp !== undefined ? opts.dp
             : (field === 'askingRent' || field === 'serviceCharge') ? 1
             : (kind === 'count' || field === 'gla' || field === 'gba') ? 0 : 1;

      var display;
      if (!core.sufficient) display = 'Insufficient verified data';
      else if (opts.format) display = opts.format(core.value);
      else if (unit === 'USD/m²/month') display = F.rent(core.value);
      else if (unit === 'm²') display = F.area(core.value);
      else if (unit === '%') display = F.pct(core.value, dp);
      else display = F.num(core.value, dp);

      return {
        kind: kind, field: field, label: label, unit: unit,
        value: core.value, n: core.n, N: N,
        sufficient: core.sufficient, reason: core.reason,
        display: display,
        coverageText: kind === 'count'
          ? 'All ' + F.int(N) + ' ' + F.plural(N, 'property', 'properties') + ' in the current selection.'
          : F.coverage(core.n, N, (opts.coverageLabel || label).toLowerCase()),
        containsDemo: containsDemo,
        weighting: (kind === 'mean' && field === 'askingRent')
          ? 'per property, unweighted' : null
      };
    }
  };

  /* ------------------------------------------------------------ dashboard */
  /** The §14 metric cards, in the order they are displayed. */
  A.dashboard = function (rows) {
    var operating = rows.filter(function (r) { return r.status === 'Operating'; });
    var pipeline = rows.filter(function (r) {
      return r.status === 'Under construction' || r.status === 'Planned';
    });
    var statusKnown = A.withKnown(rows, 'status').length;

    return [
      A.metric(rows, null, 'count', { label: 'Business centres', coverageLabel: 'records' }),
      A.metric(rows, 'gla', 'sum', { label: 'Total known GLA', coverageLabel: 'GLA' }),
      A.metric(rows, 'askingRent', 'mean', { label: 'Average asking rent', coverageLabel: 'asking rent' }),
      A.metric(rows, 'askingRent', 'median', { label: 'Median asking rent', coverageLabel: 'asking rent' }),
      A.metric(rows, 'availableArea', 'sum', { label: 'Known available area', coverageLabel: 'available area' }),
      A.metric(rows, 'occupancyPct', 'mean', { label: 'Average occupancy', coverageLabel: 'occupancy' }),
      A.metric(rows, 'vacancyPct', 'mean', { label: 'Average vacancy', coverageLabel: 'vacancy' }),
      {
        // Operating vs pipeline is a split, not a single number, and it is only
        // meaningful over the records whose status is actually recorded.
        kind: 'split', field: 'status', label: 'Operating vs pipeline',
        value: { operating: operating.length, pipeline: pipeline.length },
        n: statusKnown, N: rows.length,
        sufficient: statusKnown > 0,
        reason: statusKnown ? null : 'Building status is not recorded for any property in the current selection.',
        display: statusKnown ? (operating.length + ' operating · ' + pipeline.length + ' pipeline')
                             : 'Insufficient verified data',
        coverageText: F.coverage(statusKnown, rows.length, 'building status'),
        containsDemo: GEO.data.containsDemo(rows)
      }
    ];
  };

  /* ---------------------------------------------------------- aggregation */
  /**
   * Group rows by a dimension and measure each group.
   * The UNKNOWN group is always returned (never dropped) — dropping it is how a
   * chart silently implies full coverage.
   */
  A.aggregate = function (rows, dimension, opts) {
    opts = opts || {};
    var measureField = opts.measure || null;
    var kind = opts.kind || 'count';
    var groups = {};

    rows.forEach(function (r) {
      var k = typeof dimension === 'function' ? dimension(r) : r[dimension];
      var key = U.isKnown(k) ? String(k) : '__unknown__';
      (groups[key] = groups[key] || []).push(r);
    });

    var order = opts.order;                          // explicit ordinal order, if any
    var keys = Object.keys(groups).filter(function (k) { return k !== '__unknown__'; });
    if (order) {
      keys = order.filter(function (k) { return groups[k]; })
                  .concat(keys.filter(function (k) { return order.indexOf(k) < 0; }));
    }

    var out = keys.map(function (k) {
      var m = measureField ? A.metric(groups[k], measureField, kind, opts)
                           : A.metric(groups[k], null, 'count', {});
      return { key: k, label: opts.labelFor ? opts.labelFor(k) : k,
               rows: groups[k], count: groups[k].length, metric: m, unknown: false };
    });

    if (opts.includeEmpty && opts.allKeys) {
      opts.allKeys.forEach(function (k) {
        if (groups[k]) return;
        out.push({ key: k, label: opts.labelFor ? opts.labelFor(k) : k,
                   rows: [], count: 0,
                   metric: A.metric([], measureField, measureField ? kind : 'count', opts),
                   unknown: false });
      });
    }

    if (!order && !opts.keepKeyOrder) {
      out.sort(function (a, b) { return b.count - a.count || (a.key < b.key ? -1 : 1); });
    }

    var un = groups.__unknown__ || [];
    out.push({
      key: '__unknown__',
      label: opts.unknownLabel || 'Not recorded',
      rows: un, count: un.length,
      metric: A.metric(un, measureField, measureField ? kind : 'count', opts),
      unknown: true
    });

    return out;
  };

  A.byDistrict = function (rows, opts) {
    var all = GEO.data.districts().map(function (d) { return d.key; });
    return A.aggregate(rows, 'districtKey', Object.assign({
      includeEmpty: true, allKeys: all,
      labelFor: function (k) { return GEO.data.districtName(k); },
      unknownLabel: 'District not recorded'
    }, opts || {}));
  };

  A.byClass = function (rows, opts) {
    return A.aggregate(rows, 'officeClass', Object.assign({
      order: S.enums.officeClass,
      includeEmpty: true, allKeys: S.enums.officeClass,
      unknownLabel: 'Class not recorded'
    }, opts || {}));
  };

  A.byStatus = function (rows, opts) {
    return A.aggregate(rows, 'status', Object.assign({
      order: S.enums.status, includeEmpty: true, allKeys: S.enums.status,
      unknownLabel: 'Status not recorded'
    }, opts || {}));
  };

  /* ------------------------------------------------------------ histogram */
  /**
   * Bin a numeric field. `edges` are the inclusive-lower/exclusive-upper
   * boundaries; the final bin is open-ended. The unknown bucket is always
   * returned alongside, with its own count.
   */
  A.histogram = function (rows, field, edges) {
    var bins = [];
    for (var i = 0; i < edges.length; i++) {
      var lo = edges[i], hi = edges[i + 1];
      bins.push({
        lo: lo, hi: hi === undefined ? null : hi,
        label: hi === undefined ? F.int(lo) + '+' : F.int(lo) + '–' + F.int(hi),
        count: 0, rows: []
      });
    }
    var below = { lo: null, hi: edges[0], label: '< ' + F.int(edges[0]), count: 0, rows: [] };
    var unknown = { unknown: true, label: 'Not recorded', count: 0, rows: [] };

    rows.forEach(function (r) {
      var v = r[field];
      if (!U.isKnown(v)) { unknown.count++; unknown.rows.push(r); return; }
      if (v < edges[0]) { below.count++; below.rows.push(r); return; }
      for (var i = bins.length - 1; i >= 0; i--) {
        if (v >= bins[i].lo) { bins[i].count++; bins[i].rows.push(r); return; }
      }
    });

    var series = (below.count ? [below] : []).concat(bins);
    return { series: series, unknown: unknown,
             n: rows.length - unknown.count, N: rows.length };
  };

  /* Bin edges chosen against the real observed range (16 known rents,
     19.9–44.7 USD/m²/month). $5 bands read as round commercial numbers and
     leave no populated band empty at n=16. */
  A.RENT_BINS = [20, 25, 30, 35, 40, 45];
  A.GLA_BINS = [2000, 5000, 10000, 20000];

  /**
   * §14 chart 3. At small n a histogram invents a distribution the data cannot
   * support, so below this threshold the chart shows every individual value as
   * a strip plot instead. 16 points across 7 bins is noise; 16 points on a
   * number line is evidence.
   */
  A.STRIP_PLOT_BELOW = 30;

  A.rentDistribution = function (rows) {
    var vals = A.known(rows, 'askingRent');
    var withKnown = A.withKnown(rows, 'askingRent');
    return {
      form: vals.length < A.STRIP_PLOT_BELOW ? 'strip' : 'histogram',
      points: withKnown.map(function (r) {
        return { id: r.id, name: r.name, value: r.askingRent, officeClass: r.officeClass };
      }),
      histogram: A.histogram(rows, 'askingRent', A.RENT_BINS),
      n: vals.length, N: rows.length,
      coverageText: F.coverage(vals.length, rows.length, 'asking rent'),
      min: vals.length ? Math.min.apply(null, vals) : null,
      max: vals.length ? Math.max.apply(null, vals) : null
    };
  };

  A.glaDistribution = function (rows) {
    var h = A.histogram(rows, 'gla', A.GLA_BINS);
    return {
      form: 'histogram', histogram: h, n: h.n, N: h.N,
      coverageText: F.coverage(h.n, h.N, 'GLA'),
      sufficient: h.n > 0,
      reason: h.n ? null
        : 'GLA is not recorded for any property in the current selection, so a size distribution cannot be drawn. ' +
          'Enter a GLA in the data editor, or switch on demo records, to see this chart populate.'
    };
  };

  /**
   * The §37 "what do we actually know?" chart, and the data-collection backlog.
   * This is the chart this dataset genuinely supports.
   */
  A.fieldCoverage = function (rows) {
    return S.fields
      .filter(function (fd) { return fd.type !== 'textList'; })
      .map(function (fd) {
        var c = A.coverage(rows, fd.key);
        return { key: fd.key, label: fd.label, critical: !!fd.critical,
                 n: c.n, N: c.N, pct: c.N ? c.n / c.N : 0 };
      })
      .sort(function (a, b) { return b.pct - a.pct || (a.label < b.label ? -1 : 1); });
  };

  /* --------------------------------------------------------- the top line */
  /** The single honest sentence about the current selection, used in the AI's
   *  Data coverage block and under the analytics header. */
  A.coverageStatement = function (rows) {
    var total = rows.length;
    var demoN = rows.filter(function (r) { return r.recordType === 'DEMO'; }).length;
    var parts = [F.int(total) + ' ' + F.plural(total, 'property', 'properties') + ' in the current selection'];
    ['officeClass', 'askingRent', 'gla', 'vacancyPct'].forEach(function (k) {
      var c = A.coverage(rows, k);
      parts.push(S.label(k) + ' ' + c.n + '/' + c.N);
    });
    if (demoN) parts.push(demoN + ' of them ' + F.plural(demoN, 'is a DEMO record', 'are DEMO records'));
    return parts.join(' · ');
  };
}(window));
