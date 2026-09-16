/* ===========================================================================
 * 12-panel-filters — the left rail's filter controls (§11, IA §5.1 L-01…L-20)
 *
 * Two ideas carry this file.
 *
 * 1. THE PANEL IS GENERATED FROM COVERAGE, NOT FROM A HARD-CODED LIST.
 *    Every range/enum control asks `GEO.filters.availability()` and
 *    `GEO.filters.ranges()` what the dataset actually holds. A field with zero
 *    coverage renders DISABLED WITH ITS REASON ON SCREEN — never hidden. On the
 *    observed set that is GLA, occupancy/vacancy, parking, amenities and status.
 *    Hiding them would teach a tester nothing; showing them disabled, with
 *    `0 of 148 records have a recorded GLA`, is the product's central argument
 *    made in the interface (§29, §37). Because availability is recomputed from
 *    `scope` on every render, each one re-enables itself the instant demo mode
 *    goes on or a value is typed into the editor. No flag, no special case.
 *
 * 2. THE PANEL RENDERS PURELY FROM `state.filters`.
 *    There is no private copy of a filter value anywhere in here. That is what
 *    makes §59 true by construction: when the assistant calls `state.set()`, the
 *    next render draws these controls from the same object it wrote, so the
 *    manual controls cannot fall out of step with it.
 *
 * The DOM is built ONCE and then synchronised, rather than re-rendered. Two
 * reasons, both behavioural: rebuilding would destroy focus and the caret while
 * someone is typing a rent into a number box, and it would reset the scroll
 * position of a rail that is taller than the viewport.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, Q = GEO.dom, el = Q.el, U = GEO.util, S = GEO.schema,
      F = GEO.fmt, A = GEO.analytics, t = GEO.i18n.t;

  /* ------------------------------------------------------------- chrome */
  /* These three are view chrome, not application data, which is why they are
     allowed to live here rather than in GEO.state: nothing else in the app —
     not the map, not the assistant, not an export — needs to know whether a
     disclosure is open. Filter VALUES are never held here (rule 1 above). */
  var MORE_KEY = 'ui.filters.more';
  var ui = null;                                   // DOM references, built once
  var moreOpen = !!GEO.storage.get(MORE_KEY, false);
  var aiKeys = {};                                 // filter keys the assistant last wrote (L-19)

  /* --------------------------------------------------------- the inventory */

  /* Every range/enum filter and the schema field whose coverage governs it.
     The panel is generated from this plus live coverage — adding a filterable
     field to the schema is the only edit needed to surface a new control. */
  var COVERAGE_FILTERS = [
    { key: 'statuses',  field: 'status' },
    { key: 'rent',      field: 'askingRent' },
    { key: 'gla',       field: 'gla' },
    { key: 'vacancy',   field: 'vacancyPct' },
    { key: 'parking',   field: 'parkingSpaces' },
    { key: 'amenities', field: 'amenities' }
  ];

  /* The §19 disclosure flags. Each one narrows the list to records carrying it;
     none of them corrects, merges or hides anything (D6, D7). */
  var FLAGS = [
    { key: 'districtConflict', labelKey: 'filter.conflict.label',
      test: function (r) { return !!(r._meta && r._meta.districtConflict); } },
    { key: 'duplicate', labelKey: 'filter.dupes.label',
      test: function (r) { return !!(r._meta && r._meta.possibleDuplicate); } },
    { key: 'suspectedNonBc', labelKey: 'filter.flags.suspected',
      test: function (r) { return !!(r._meta && r._meta.entityReview === 'suspected_non_bc'); } },
    { key: 'editedLocally', labelKey: 'filter.edited.label',
      test: function (r) { return !!(r._meta && (r._meta.editedLocally || r._meta.addedLocally)); } },
    { key: 'demo', labelKey: 'filter.flags.demo',
      test: function (r) { return r.recordType === 'DEMO'; } }
  ];

  var COMPLETENESS_BANDS = ['good', 'partial', 'minimal', 'none'];
  var FRESHNESS_STATES = ['fresh', 'ageing', 'stale'];

  /* =========================================================== derivation */

  function defaults() { return GEO.state.defaults().filters; }

  function applyFilters(rows, f) {
    if (!GEO.filters || !GEO.filters.apply) return rows;
    try { return GEO.filters.apply(rows, f); }
    catch (e) { GEO.log.error('filters.apply threw', e); return rows; }
  }

  /** Cross-filtering (L-05): a group's option counts are computed against every
   *  OTHER active filter, so ticking Yunusobod does not make every other
   *  district read (0) and strand the user. */
  function baseFor(scope, filters, keys) {
    var d = defaults();
    var f = Object.assign({}, filters);
    keys.forEach(function (k) { f[k] = d[k]; });
    return applyFilters(scope, f);
  }

  function countBy(rows, fn) {
    var o = {};
    rows.forEach(function (r) {
      var k = fn(r);
      if (k === null || k === undefined || k === '') k = '__unknown__';
      o[k] = (o[k] || 0) + 1;
    });
    return o;
  }

  /** Read one entry out of whatever shape 06-filters returns — a map keyed by
   *  filter key or by field name, or an array of descriptors. Unknown shapes
   *  fall through to the local computation rather than throwing. */
  function pick(ext, key, field) {
    if (!ext) return null;
    if (Array.isArray(ext)) {
      for (var i = 0; i < ext.length; i++) {
        if (ext[i] && (ext[i].key === key || ext[i].field === field)) return ext[i];
      }
      return null;
    }
    return ext[key] || ext[field] || null;
  }

  /**
   * Availability per filter: {n, N, available, reason}. The module's answer is
   * preferred; where it is silent the panel derives the same thing from real
   * coverage, so a filter is never enabled on a field the data cannot support
   * and never disabled on one it can.
   */
  function availability(scope) {
    var ext = null;
    if (GEO.filters && GEO.filters.availability) {
      try { ext = GEO.filters.availability(scope); }
      catch (e) { GEO.log.warn('filters.availability threw — using coverage', e); }
    }
    var out = {};
    COVERAGE_FILTERS.forEach(function (spec) {
      var e = pick(ext, spec.key, spec.field);
      var c = A.coverage(scope, spec.field);
      var n = (e && typeof e.n === 'number') ? e.n : c.n;
      var N = (e && typeof e.N === 'number') ? e.N : c.N;
      var open = (e && typeof e.available === 'boolean') ? e.available : n > 0;
      out[spec.key] = {
        key: spec.key, field: spec.field, n: n, N: N, available: open,
        reason: (e && e.reason) || (open ? null : t('filter.disabled.zero', {
          m: F.int(N), field: F.lower(S.label(spec.field))
        }))
      };
    });
    return out;
  }

  /** Observed min/max per numeric field, for the slider bounds and the note. */
  function ranges(scope) {
    var ext = null;
    if (GEO.filters && GEO.filters.ranges) {
      try { ext = GEO.filters.ranges(scope); }
      catch (e) { GEO.log.warn('filters.ranges threw — using known()', e); }
    }
    var out = {};
    ['askingRent', 'gla', 'vacancyPct', 'parkingSpaces'].forEach(function (field) {
      var e = pick(ext, field, field);
      var vals = A.known(scope, field);
      out[field] = {
        n: vals.length,
        N: scope.length,
        min: (e && typeof e.min === 'number') ? e.min
           : (vals.length ? Math.min.apply(null, vals) : null),
        max: (e && typeof e.max === 'number') ? e.max
           : (vals.length ? Math.max.apply(null, vals) : null)
      };
    });
    return out;
  }

  /* Quality derivations, preferring 04-quality and falling back to the schema's
     own rules so the panel is never blank because a sibling module is absent. */
  function completenessOf(rec) {
    if (GEO.quality && GEO.quality.completeness) {
      try {
        var c = GEO.quality.completeness(rec);
        if (c && c.band) return c;
      } catch (e) { /* fall through */ }
    }
    var m = S.criticalFields.length, n = 0;
    S.criticalFields.forEach(function (k) { if (U.isKnown(rec[k])) n++; });
    // D9 count bands, not percentage bands: percentages put all 148 in one bucket.
    return { band: n === 0 ? 'none' : (n <= 2 ? 'minimal' : (n <= 5 ? 'partial' : 'good')),
             n: n, m: m };
  }

  function freshnessOf(rec) {
    if (GEO.quality && GEO.quality.freshness) {
      try {
        var r = GEO.quality.freshness(rec);
        if (typeof r === 'string') return r;
        if (r && (r.state || r.freshness)) return r.state || r.freshness;
      } catch (e) { /* fall through */ }
    }
    return S.freshness(rec._meta && rec._meta.lastVerifiedAt, 'askingRent');
  }

  /* ============================================================== writing */

  /* The ONLY mutation path out of this panel. Writing a key clears its
     assistant marker, because the value is now the user's. */
  function commit(patchObj, action, summary) {
    Object.keys(patchObj).forEach(function (k) { delete aiKeys[k]; });
    GEO.state.set({ filters: patchObj },
                  { source: 'user', action: 'filter:' + action, summary: summary || null });
  }

  function toggleIn(key, value, on) {
    var cur = (GEO.state.get().filters[key] || []).slice();
    var i = cur.indexOf(value);
    if (on && i < 0) cur.push(value);
    else if (!on && i >= 0) cur.splice(i, 1);
    var p = {}; p[key] = cur;
    commit(p, key);
  }

  /** Empty input means UNKNOWN, not 0 (§36) — this is the choke point where a
   *  blank box would otherwise silently become a zero bound. */
  function commitNumber(filterKey, field, raw) {
    var v = null;
    if (raw !== null && raw !== undefined && String(raw).trim() !== '') {
      var c = S.coerce(field, raw);
      v = c.error ? null : c.value;
    }
    var p = {}; p[filterKey] = v;
    commit(p, filterKey);
  }

  /* ============================================================ builders */

  var seq = 0;
  function uid() { seq += 1; return 'fx-' + seq; }

  /**
   * One filter group: heading, body, an optional permanent note and the §29
   * reason line that appears whenever the group is disabled. The reason is text
   * in the flow and is wired to the group with aria-describedby — a title
   * attribute is not a reason anybody can read.
   */
  function group(titleText) {
    var hdId = uid();
    var reasonId = uid();
    var head = el('div.fgroup__hd', { id: hdId, text: titleText });
    var body = el('div.fgroup__body');
    var reason = el('span.fgroup__reason', { id: reasonId, hidden: true });
    var note = el('div.fgroup__note', { hidden: true });
    var node = el('div.fgroup', { role: 'group', 'aria-labelledby': hdId },
                  [head, body, note, reason]);
    return { node: node, head: head, body: body, note: note, reason: reason,
             reasonId: reasonId,
             /** Disabled groups keep every control mounted and visible. */
             setEnabled: function (on, why) {
               node.classList.toggle('fgroup--disabled', !on);
               Q.$$('input, select, button', body).forEach(function (n) { n.disabled = !on; });
               reason.hidden = !why;
               reason.textContent = why || '';
               if (why) node.setAttribute('aria-describedby', reasonId);
               else node.removeAttribute('aria-describedby');
             },
             setNote: function (text) {
               note.hidden = !text;
               Q.fill(note, text ? [document.createTextNode(text)] : []);
             } };
  }

  /**
   * A multi-select bound to one array-valued filter key. Counts live in their
   * own span so a zero option reads `Name (0)` — greyed, still selectable, and
   * never removed from the list (L-05: a district with a true zero is a fact).
   */
  function checkGroup(titleText, filterKey, options) {
    var g = group(titleText);
    var boxes = [];
    options.forEach(function (o) {
      var input = el('input', { type: 'checkbox', value: o.value });
      var count = el('span.check__count');
      var text = el('span.check__text', {}, [document.createTextNode(o.label), count]);
      var lab = el('label.check', o.title ? { title: o.title } : {}, [input, text]);
      input.addEventListener('change', function () {
        toggleIn(filterKey, o.value, input.checked);
      });
      g.body.appendChild(lab);
      boxes.push({ value: o.value, input: input, count: count });
    });
    g.boxes = boxes;
    g.filterKey = filterKey;
    /** Reflect state + fresh counts. Never reads anything but its arguments. */
    g.sync = function (selected, counts) {
      boxes.forEach(function (b) {
        b.input.checked = (selected || []).indexOf(b.value) >= 0;
        var n = (counts && counts[b.value]) || 0;
        b.count.textContent = t('filter.option.count', { n: F.int(n) });
      });
    };
    return g;
  }

  /** One `min`/`max` pair: two typed number boxes plus two sliders, which are
   *  two views of one value (L-08). An analyst types; a browser drags. */
  function rangeGroup(titleText, minKey, maxKey, field, opts) {
    opts = opts || {};
    var g = group(titleText);
    var minId = uid(), maxId = uid();

    var minIn = el('input.input.input--num', { type: 'number', id: minId, inputmode: 'decimal' });
    var maxIn = el('input.input.input--num', { type: 'number', id: maxId, inputmode: 'decimal' });
    var minSl = el('input.range', { type: 'range', 'aria-labelledby': minId + '-l' });
    var maxSl = el('input.range', { type: 'range', 'aria-labelledby': maxId + '-l' });

    var pair = el('div.rangepair', {}, [
      el('label.field', { for: minId }, [
        el('span.field__label', { id: minId + '-l', text: opts.minLabel || t('common.min') }), minIn
      ]),
      el('label.field', { for: maxId }, [
        el('span.field__label', { id: maxId + '-l', text: opts.maxLabel || t('common.max') }), maxIn
      ]),
      el('div.rangepair__sliders', {}, [minSl, maxSl])
    ]);
    g.body.appendChild(pair);

    // `change` (blur / Enter / drag-end), never `input`: committing on every
    // keystroke would re-run the whole app between "3" and "30".
    minIn.addEventListener('change', function () { commitNumber(minKey, field, minIn.value); });
    maxIn.addEventListener('change', function () { commitNumber(maxKey, field, maxIn.value); });
    minSl.addEventListener('input', function () { minIn.value = minSl.value; });
    maxSl.addEventListener('input', function () { maxIn.value = maxSl.value; });
    minSl.addEventListener('change', function () { commitNumber(minKey, field, minSl.value); });
    maxSl.addEventListener('change', function () { commitNumber(maxKey, field, maxSl.value); });

    g.sync = function (f, range) {
      var step = opts.step || 1;
      var lo = opts.fixedLo !== undefined ? opts.fixedLo
             : (range.min === null ? 0 : Math.floor(range.min / step) * step);
      var hi = opts.fixedHi !== undefined ? opts.fixedHi
             : (range.max === null ? lo + step : Math.ceil(range.max / step) * step);
      if (hi <= lo) hi = lo + step;

      [minSl, maxSl].forEach(function (s) { s.min = lo; s.max = hi; s.step = step; });
      minSl.value = U.isKnown(f[minKey]) ? U.clamp(f[minKey], lo, hi) : lo;
      maxSl.value = U.isKnown(f[maxKey]) ? U.clamp(f[maxKey], lo, hi) : hi;

      // Never fight the user's caret: only an unfocused box is overwritten.
      if (document.activeElement !== minIn) minIn.value = U.isKnown(f[minKey]) ? f[minKey] : '';
      if (document.activeElement !== maxIn) maxIn.value = U.isKnown(f[maxKey]) ? f[maxKey] : '';
      minIn.placeholder = range.n ? String(F.num(lo, opts.dp || 0)) : F.UNKNOWN;
      maxIn.placeholder = range.n ? String(F.num(hi, opts.dp || 0)) : F.UNKNOWN;
    };
    return g;
  }

  /* ================================================================ build */

  function build(pane) {
    var d = defaults();
    var u = {};

    /* --- active-filter summary (L-19, L-20) -------------------------- */
    u.summary = el('div.fgroup', { role: 'group', 'aria-label': t('filter.active.title') });
    u.summaryTitle = el('div.fgroup__hd', { text: t('filter.active.title') });
    u.chips = el('div.fchips');
    u.excl = el('div');
    u.summary.appendChild(u.summaryTitle);
    u.summary.appendChild(u.chips);
    u.summary.appendChild(u.excl);

    /* --- L-04 text search -------------------------------------------- */
    var qId = uid();
    u.q = el('input.input', {
      type: 'search', id: qId, autocomplete: 'off', spellcheck: 'false',
      placeholder: t('filter.name.placeholder')
    });
    u.qGroup = group(t('filter.name.label'));
    u.qGroup.body.appendChild(el('label.field', { for: qId }, [
      el('span.vh', { text: t('filter.name.label') }), u.q
    ]));
    u.qGroup.setNote(t('hdr.search.hint'));
    // 120ms debounce (L-04): one render per pause, not one per keystroke.
    u.q.addEventListener('input', U.debounce(function () {
      if (u.q.value === GEO.state.get().filters.q) return;
      commit({ q: u.q.value }, 'q');
    }, 120));

    /* --- L-05 district ------------------------------------------------ */
    u.districts = checkGroup(t('filter.district.label'), 'districts',
      GEO.data.districts().map(function (dd) {
        return { value: dd.key, label: dd.name, title: t('filter.district.zero') };
      }));
    u.districts.setNote(t('filter.district.note'));

    /* --- L-06 office class + the explicit unknown option -------------- */
    u.classes = checkGroup(t('filter.class.label'), 'classes',
      S.enums.officeClass.map(function (c) { return { value: c, label: c }; }));

    // The sixth control is NOT a sixth grade. "We don't know the class" is not a
    // position between B and C, so it is a separate, explicit toggle — and it is
    // ON by default, so ticking A+ can never silently drop 132 records without
    // the exclusion line below saying so.
    u.unknownClass = el('input', { type: 'checkbox' });
    u.unknownClassCount = el('span.check__count');
    u.unknownClass.addEventListener('change', function () {
      commit({ includeUnknownClass: u.unknownClass.checked }, 'includeUnknownClass');
    });
    u.classes.body.appendChild(el('label.check', {}, [
      u.unknownClass,
      el('span.check__text', {}, [
        document.createTextNode(t('value.class.unknown')), u.unknownClassCount
      ])
    ]));
    u.classes.setNote(t('filter.class.note'));

    /* --- L-07 status (zero coverage on the observed set) -------------- */
    u.statuses = checkGroup(t('filter.status.label'), 'statuses',
      S.enums.status.map(function (s) { return { value: s, label: s }; }));

    /* --- L-08 asking rent --------------------------------------------- */
    u.rent = rangeGroup(t('filter.rent.label'), 'rentMin', 'rentMax', 'askingRent', {
      minLabel: t('filter.rent.min'), maxLabel: t('filter.rent.max'), step: 0.5, dp: 1
    });

    /* --- advanced, behind the L-17 disclosure ------------------------- */
    u.gla = rangeGroup(t('filter.gla.label'), 'glaMin', 'glaMax', 'gla', {
      minLabel: t('filter.gla.min'), maxLabel: t('filter.gla.max'), step: 100
    });
    u.vacancy = rangeGroup(t('filter.occupancy.label'), 'vacancyMin', 'vacancyMax', 'vacancyPct', {
      step: 1, fixedLo: 0, fixedHi: 100
    });

    var parkId = uid();
    u.parkingIn = el('input.input.input--num', { type: 'number', id: parkId, min: '0', step: '1' });
    u.parking = group(t('filter.parking.label'));
    u.parking.body.appendChild(el('label.field', { for: parkId }, [
      el('span.field__label', { text: t('filter.parking.label') }), u.parkingIn
    ]));
    u.parkingIn.addEventListener('change', function () {
      commitNumber('parkingMin', 'parkingSpaces', u.parkingIn.value);
    });

    u.amenities = checkGroup(t('filter.amenities.label'), 'amenities',
      S.enums.amenity.map(function (a) { return { value: a, label: a }; }));

    u.confidence = checkGroup(t('filter.confidence.label'), 'confidence',
      S.enums.confidence.map(function (c) {
        return { value: c, label: t('value.confidence.' + c.toLowerCase()) };
      }));
    u.confidence.setNote(t('filter.confidence.note'));

    u.completeness = checkGroup(t('filter.completeness.label'), 'completeness',
      COMPLETENESS_BANDS.map(function (b) {
        // The band label already carries its own count slot in the table, so the
        // generic (n) span is suppressed for this group by using the full string.
        return { value: b, label: t('value.completeness.' + b) };
      }));
    u.completeness.setNote(t('filter.completeness.note', { m: F.int(S.criticalFields.length) }));

    u.freshness = checkGroup(t('filter.freshness.label'), 'freshness',
      FRESHNESS_STATES.map(function (s) {
        return { value: s, label: t('value.freshness.' + s) };
      }));
    u.freshness.setNote(t('filter.freshness.note'));

    /* --- L-15, L-16 and the scope toggles ----------------------------- */
    u.flags = checkGroup(t('filter.flags.label'), 'flags',
      FLAGS.map(function (fl) { return { value: fl.key, label: t(fl.labelKey) }; }));
    u.flags.setNote(t('filter.flags.note'));

    // Two scope switches, not filters: they change WHICH records exist before a
    // predicate is ever evaluated, which is why they write the top level of the
    // state and not `filters`.
    u.nonBc = el('input', { type: 'checkbox' });
    u.nonBcReason = el('span.fgroup__reason');
    u.nonBc.addEventListener('change', function () {
      GEO.state.set({ excludeSuspectedNonBc: u.nonBc.checked },
                    { source: 'user', action: 'scope:excludeSuspectedNonBc' });
    });
    u.flags.body.appendChild(el('label.check', {}, [
      u.nonBc, el('span.check__text', { text: t('filter.nonBc.label') })
    ]));
    u.flags.body.appendChild(u.nonBcReason);

    u.demo = el('input', { type: 'checkbox' });
    u.demoReason = el('span.fgroup__reason');
    u.demo.addEventListener('change', function () {
      var on = u.demo.checked;
      GEO.data.setDemoMode(on);
      GEO.state.set({ demoMode: on }, { source: 'user', action: 'scope:demoMode' });
    });
    u.flags.body.appendChild(el('label.check', {}, [
      u.demo, el('span.check__text', { text: t('filter.demo.label') })
    ]));
    u.flags.body.appendChild(u.demoReason);

    /* --- L-17 "More filters" disclosure -------------------------------- */
    var moreId = uid();
    u.moreCount = el('span.disc__count');
    u.moreBtn = el('button.disc__hd', {
      type: 'button', 'aria-expanded': String(moreOpen), 'aria-controls': moreId
    }, [document.createTextNode(t('filter.more')), u.moreCount]);
    u.moreBody = el('div.disc__body', { id: moreId }, [
      u.gla.node, u.vacancy.node, u.parking.node, u.amenities.node,
      u.confidence.node, u.completeness.node, u.freshness.node, u.flags.node
    ]);
    u.more = el('div.disc.fmore', { 'data-open': String(moreOpen) }, [
      u.moreBtn, el('div.disc__wrap', {}, [u.moreBody])
    ]);
    u.moreBtn.addEventListener('click', function () {
      moreOpen = !moreOpen;
      GEO.storage.set(MORE_KEY, moreOpen);
      applyMore(u);
    });
    applyMore(u);

    Q.fill(pane, [el('div.filters', {}, [
      u.summary,
      u.qGroup.node, u.districts.node, u.classes.node, u.statuses.node, u.rent.node,
      u.more
    ])]);

    ui = u;
  }

  /* The closed disclosure keeps its contents mounted (so the 0fr→1fr height
     transition works) but `inert`, so a collapsed control is never a hidden tab
     stop. Without this, Tab walks through eight invisible groups. */
  function applyMore(u) {
    u.more.setAttribute('data-open', String(moreOpen));
    u.moreBtn.setAttribute('aria-expanded', String(moreOpen));
    u.moreBtn.firstChild.nodeValue = moreOpen ? t('filter.less') : t('filter.more');
    if (moreOpen) u.moreBody.removeAttribute('inert');
    else u.moreBody.setAttribute('inert', '');
  }

  /* ========================================================== chips (L-19) */

  /** One human sentence per active filter value, each with its own removal. */
  function chipsFor(state) {
    var f = state.filters, d = defaults(), out = [];

    function push(key, label, undo) { out.push({ key: key, label: label, undo: undo }); }

    function rangeText(lo, hi, fmt) {
      if (U.isKnown(lo) && U.isKnown(hi)) return t('common.range', { from: fmt(lo), to: fmt(hi) });
      if (U.isKnown(lo)) return t('common.from') + ' ' + fmt(lo);
      return t('common.to') + ' ' + fmt(hi);
    }
    function addRange(minKey, maxKey, field, fmt) {
      if (!U.isKnown(f[minKey]) && !U.isKnown(f[maxKey])) return;
      push(minKey, S.label(field) + ' ' + rangeText(f[minKey], f[maxKey], fmt), function () {
        var p = {}; p[minKey] = null; p[maxKey] = null;
        commit(p, minKey);
      });
    }
    function addList(key, labelFor) {
      (f[key] || []).forEach(function (v) {
        push(key, labelFor(v), function () { toggleIn(key, v, false); });
      });
    }

    if (f.q) push('q', t('filter.name.label') + ': ' + f.q, function () { commit({ q: '' }, 'q'); });
    addList('districts', function (v) { return GEO.data.districtName(v); });
    addList('classes', function (v) { return t('filter.class.label') + ' ' + v; });
    if (f.includeUnknownClass !== d.includeUnknownClass) {
      push('includeUnknownClass', t('value.class.unknown'), function () {
        commit({ includeUnknownClass: d.includeUnknownClass }, 'includeUnknownClass');
      });
    }
    addList('statuses', function (v) { return v; });
    addRange('rentMin', 'rentMax', 'askingRent', function (v) { return F.num(v, 1); });
    addRange('glaMin', 'glaMax', 'gla', function (v) { return F.num(v, 0); });
    addRange('vacancyMin', 'vacancyMax', 'vacancyPct', function (v) { return F.pct(v, 0); });
    if (U.isKnown(f.parkingMin)) {
      push('parkingMin', t('filter.parking.label') + ' ' + F.int(f.parkingMin), function () {
        commit({ parkingMin: null }, 'parkingMin');
      });
    }
    addList('amenities', function (v) { return v; });
    addList('confidence', function (v) { return t('value.confidence.' + v.toLowerCase()); });
    addList('completeness', function (v) { return t('value.completeness.' + v); });
    addList('freshness', function (v) { return t('value.freshness.' + v); });
    addList('flags', function (v) {
      var hit = FLAGS.filter(function (fl) { return fl.key === v; })[0];
      return hit ? t(hit.labelKey) : v;
    });
    return out;
  }

  /* ====================================================== exclusion lines */

  /**
   * The §11 honesty line: what the current filters threw away and why. Prefers
   * `GEO.filters.explain`; where it says nothing, the same statements are
   * derived here so the line is never simply missing.
   */
  function exclusionLines(scope, state) {
    var ext = null;
    if (GEO.filters && GEO.filters.explain) {
      try { ext = GEO.filters.explain(scope, state.filters); }
      catch (e) { GEO.log.warn('filters.explain threw — deriving locally', e); }
    }
    var out = [];
    var list = ext && (ext.exclusions || ext.excluded || ext.lines);
    if (Array.isArray(list)) {
      list.forEach(function (item) {
        if (typeof item === 'string') { out.push(item); return; }
        if (!item) return;
        if (item.text) { out.push(item.text); return; }
        if (item.message) { out.push(item.message); return; }
        if (typeof item.n === 'number' && item.field) {
          out.push(t('filter.excluded.field',
                     { n: F.int(item.n), field: F.lower(S.label(item.field)) }));
        }
      });
    }
    if (!out.length) out = localExclusions(scope, state);
    if (state.excludeSuspectedNonBc) {
      var hidden = GEO.data.observed().filter(function (r) {
        return r._meta && r._meta.entityReview === 'suspected_non_bc';
      }).length;
      out.push(t('filter.excluded.nonBc', { n: F.int(hidden) }));
    }
    return out;
  }

  function localExclusions(scope, state) {
    var f = state.filters, out = [];

    // The L-06 headline: selecting grades drops the unrecorded, and says so.
    if ((f.classes || []).length) {
      var base = baseFor(scope, f, ['classes', 'includeUnknownClass']);
      var noClass = base.filter(function (r) { return !U.isKnown(r.officeClass); }).length;
      if (noClass) out.push(t('filter.excluded.class', { n: F.int(noClass) }));
    }
    [['rentMin', 'rentMax', 'askingRent', 'filter.excluded.rent'],
     ['glaMin', 'glaMax', 'gla', null],
     ['vacancyMin', 'vacancyMax', 'vacancyPct', null]].forEach(function (spec) {
      if (!U.isKnown(f[spec[0]]) && !U.isKnown(f[spec[1]])) return;
      var n = scope.filter(function (r) { return !U.isKnown(r[spec[2]]); }).length;
      if (!n) return;
      out.push(spec[3] ? t(spec[3], { n: F.int(n) })
                       : t('filter.excluded.field',
                           { n: F.int(n), field: F.lower(S.label(spec[2])) }));
    });
    if (U.isKnown(f.parkingMin)) {
      var np = scope.filter(function (r) { return !U.isKnown(r.parkingSpaces); }).length;
      if (np) out.push(t('filter.excluded.field',
                         { n: F.int(np), field: F.lower(S.label('parkingSpaces')) }));
    }
    return out;
  }

  /* ================================================================ render */

  function render(state, rows, scope) {
    var pane = Q.$('#pane-filters');
    if (!pane) return;
    if (!ui || !pane.firstChild) build(pane);

    var u = ui, f = state.filters, d = defaults();
    var avail = availability(scope);
    var rng = ranges(scope);

    /* --- summary ------------------------------------------------------ */
    var chips = chipsFor(state);
    var lines = exclusionLines(scope, state);
    u.summary.hidden = !chips.length && !lines.length;
    u.summaryTitle.hidden = !chips.length;
    Q.fill(u.chips, chips.map(function (c) {
      var cls = '.chip.chip--filter' + (aiKeys[c.key] ? '.chip--ai' : '');
      return el('span' + cls, aiKeys[c.key] ? { title: t('filter.chip.ai') } : {}, [
        el('span.chip__label', { text: c.label }),
        el('button.chip__x', {
          type: 'button', text: '×',
          'aria-label': t('filter.chip.remove', { name: c.label }),
          onclick: c.undo
        })
      ]);
    }));
    Q.fill(u.excl, lines.map(function (line) {
      return el('span.fcount__excl', { text: line });
    }));

    /* --- text ---------------------------------------------------------- */
    if (document.activeElement !== u.q) u.q.value = f.q || '';

    /* --- district ------------------------------------------------------ */
    u.districts.sync(f.districts,
      countBy(baseFor(scope, f, ['districts']), function (r) { return r.districtKey; }));

    /* --- class --------------------------------------------------------- */
    var classBase = baseFor(scope, f, ['classes', 'includeUnknownClass']);
    var classCounts = countBy(classBase, function (r) { return r.officeClass; });
    u.classes.sync(f.classes, classCounts);
    u.unknownClass.checked = !!f.includeUnknownClass;
    u.unknownClassCount.textContent =
      t('filter.option.count', { n: F.int(classCounts.__unknown__ || 0) });

    /* --- status: the canonical zero-coverage control -------------------- */
    u.statuses.sync(f.statuses,
      countBy(baseFor(scope, f, ['statuses']), function (r) { return r.status; }));
    u.statuses.setEnabled(avail.statuses.available, avail.statuses.reason);

    /* --- rent ----------------------------------------------------------- */
    u.rent.sync(f, rng.askingRent);
    u.rent.setEnabled(avail.rent.available, avail.rent.reason);
    u.rent.setNote(avail.rent.available
      ? t('filter.rent.note', {
          n: F.int(avail.rent.n), m: F.int(avail.rent.N),
          excluded: F.int(avail.rent.N - avail.rent.n)
        }) + ' ' + t('filter.rent.unit')
      : null);

    /* --- advanced -------------------------------------------------------- */
    u.gla.sync(f, rng.gla);
    u.gla.setEnabled(avail.gla.available, avail.gla.reason);
    u.gla.setNote(observedNote(avail.gla, rng.gla, 0));

    u.vacancy.sync(f, rng.vacancyPct);
    u.vacancy.setEnabled(avail.vacancy.available, avail.vacancy.reason);
    u.vacancy.setNote(observedNote(avail.vacancy, rng.vacancyPct, 0));

    if (document.activeElement !== u.parkingIn) {
      u.parkingIn.value = U.isKnown(f.parkingMin) ? f.parkingMin : '';
    }
    u.parking.setEnabled(avail.parking.available, avail.parking.reason);
    u.parking.setNote(observedNote(avail.parking, rng.parkingSpaces, 0));

    var amenBase = baseFor(scope, f, ['amenities']);
    var amenCounts = {};
    S.enums.amenity.forEach(function (a) {
      amenCounts[a] = amenBase.filter(function (r) {
        return (r.amenities || []).indexOf(a) >= 0;
      }).length;
    });
    u.amenities.sync(f.amenities, amenCounts);
    u.amenities.setEnabled(avail.amenities.available, avail.amenities.reason);

    // Confidence, completeness and freshness are derived from every record, so
    // they always have coverage and are never disabled — even when, as here,
    // confidence is single-valued. A zero-count option stays selectable and
    // produces the named empty state rather than a dead control (L-13).
    u.confidence.sync(f.confidence,
      countBy(baseFor(scope, f, ['confidence']), function (r) {
        return GEO.data.recordConfidence(r);
      }));
    u.completeness.sync(f.completeness,
      countBy(baseFor(scope, f, ['completeness']), function (r) {
        return completenessOf(r).band;
      }));
    u.freshness.sync(f.freshness,
      countBy(baseFor(scope, f, ['freshness']), function (r) { return freshnessOf(r); }));

    /* --- flags and scope -------------------------------------------------- */
    var flagBase = baseFor(scope, f, ['flags']);
    var flagCounts = {};
    FLAGS.forEach(function (fl) {
      flagCounts[fl.key] = flagBase.filter(fl.test).length;
    });
    u.flags.sync(f.flags, flagCounts);

    var demoBox = u.flags.boxes.filter(function (b) { return b.value === 'demo'; })[0];
    if (demoBox) {
      // No fake control: with demo mode off there are no demo records to find,
      // and the checkbox says so instead of silently returning nothing.
      demoBox.input.disabled = !state.demoMode;
    }
    u.demoReason.textContent = state.demoMode
      ? t('filter.demo.note', { n: F.int(GEO.data.demoRecords().length) })
      : t('filter.excluded.demo');
    u.demo.checked = !!state.demoMode;

    var suspected = GEO.data.observed().filter(function (r) {
      return r._meta && r._meta.entityReview === 'suspected_non_bc';
    }).length;
    u.nonBc.checked = !!state.excludeSuspectedNonBc;
    u.nonBcReason.textContent = t('filter.nonBc.note', { n: F.int(suspected) });

    /* --- disclosure badge -------------------------------------------------- */
    var advanced = ['glaMin', 'glaMax', 'vacancyMin', 'vacancyMax', 'parkingMin',
                    'amenities', 'confidence', 'completeness', 'freshness', 'flags']
      .filter(function (k) { return JSON.stringify(f[k]) !== JSON.stringify(d[k]); }).length;
    u.moreCount.hidden = !advanced;
    u.moreCount.textContent = advanced ? String(advanced) : '';
  }

  function observedNote(av, range, dp) {
    if (!av.available || range.min === null) return null;
    return t('filter.disabled.coverage', {
      n: F.int(av.n), m: F.int(av.N), field: F.lower(S.label(av.field))
    }) + ' ' + t('filter.range.observed', {
      from: F.num(range.min, dp), to: F.num(range.max, dp)
    });
  }

  /* ========================================================= registration */

  /* Track which filter keys the assistant wrote, so L-19 can mark those chips.
     This is provenance about the UI, not a copy of the values themselves —
     the chips are still rendered from `state.filters` on every pass. */
  GEO.state.subscribe(function (state, patch, meta) {
    if (!patch || !patch.filters) return;
    if (meta && meta.source === 'ai') {
      Object.keys(patch.filters).forEach(function (k) { aiKeys[k] = true; });
    }
    if (meta && meta.action === 'filters:reset') aiKeys = {};
  });

  /* 99-boot is the LAST module in the manifest, so `GEO.boot` does not exist
     while this file is being evaluated. `data:loaded` is emitted from inside
     boot's start(), after the repository is populated and before the first
     state broadcast — the earliest point at which registerPanel is both
     defined and still early enough to catch the opening render. */
  var registered = false;
  function registerPanel() {
    if (registered || !GEO.boot || !GEO.boot.registerPanel) return;
    registered = true;
    GEO.boot.registerPanel(render);
  }
  registerPanel();
  GEO.on('data:loaded', registerPanel);
}(window));
