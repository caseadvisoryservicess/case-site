/* ===========================================================================
 * 06-filters — the predicate engine
 *
 * Brief §11; build contract §5 (state), D2 (unknown is null), D4 (demo
 * containment), D7 (flagged, never deleted).
 *
 * Two rules decide whether a filtered count means anything.
 *
 * 1. A FILTER ON A FIELD EXCLUDES RECORDS WHOSE VALUE IS UNKNOWN, and says so.
 *    A building with no recorded rent is not a building whose rent is 0: it
 *    cannot satisfy "under $30" and it cannot fail it either — it is not
 *    evidence. Every such exclusion is counted and named, which is what
 *    `explain()` is for. "132 properties excluded — office class not recorded"
 *    is the difference between a filter and a lie (§36, rule R4).
 *
 * 2. A FILTER WHOSE FIELD HAS ZERO COVERAGE DISABLES ITSELF, with the reason on
 *    screen, rather than silently returning nothing (§29, rule R2).
 *    `availability()` is derived from the rows it is handed and from nothing
 *    else, so GLA, occupancy, vacancy, parking, amenities and status start
 *    disabled on the observed set and re-enable themselves the moment demo mode
 *    goes on or a value is typed into the editor. There is no flag to flip.
 *
 * This module is a SELECTOR, not a metric: it decides which records are in the
 * set, and 08-analytics decides what may be said about them. It therefore reads
 * record fields directly — but only ever behind `GEO.util.isKnown`, the same
 * primitive `analytics.known()` is built on — so an unknown can never reach a
 * comparison as though it were a number.
 *
 * Load order (manifest): this file runs BEFORE 07-search and 08-analytics, so
 * those namespaces are resolved lazily inside functions and never captured at
 * load time.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema, F = GEO.fmt;
  var FL = GEO.filters = {};

  function t(key, vars) { return GEO.i18n ? GEO.i18n.t(key, vars) : key; }

  /** The i18n table is authoritative for a field's label; the schema registry is
   *  the fallback while a key is missing, so a label is never the raw key. */
  function fieldLabel(key) {
    if (GEO.i18n && GEO.i18n.has && GEO.i18n.has('field.' + key)) return t('field.' + key);
    return S.label(key);
  }

  /* ------------------------------------------------------------ vocabulary */
  /* `value.*` is the i18n table's reserved namespace for shared enum values, so
     these maps only hold the part that is not mechanically derivable from the
     value itself ('EV charging' -> value.amenity.evCharging). */
  var CLASS_I18N  = { 'A+': 'aPlus', 'A': 'a', 'B+': 'bPlus', 'B': 'b', 'C': 'c' };
  var STATUS_I18N = { 'Operating': 'operating', 'Under construction': 'construction',
                      'Planned': 'planned', 'Renovation': 'renovation' };
  var AMENITY_I18N = {
    'restaurant': 'restaurant', 'cafe': 'cafe', 'retail': 'retail', 'gym': 'gym',
    'conference room': 'conference', 'reception': 'reception', 'security': 'security',
    'underground parking': 'undergroundParking', 'surface parking': 'surfaceParking',
    'EV charging': 'evCharging', 'bicycle parking': 'bicycleParking',
    'backup generator': 'generator'
  };

  FL.FLAGS = ['districtConflict', 'duplicate', 'suspectedNonBc', 'editedLocally', 'demo'];
  FL.COMPLETENESS_BANDS = ['none', 'minimal', 'partial', 'good'];
  /* `unknown` is deliberately not selectable: a record that was never verified
     is not "fresh, ageing or stale", it is outside the question, and the
     freshness filter reports it as an unknown-exclusion instead (§36). */
  FL.FRESHNESS_STATES = ['fresh', 'ageing', 'stale'];

  /**
   * One row per filter GROUP. `key` is the group's identity in `explain()` and
   * in the panel; `keys` are the state keys it owns; `field` is the schema field
   * whose coverage governs it, or null for a filter derived from quality rather
   * than from a property attribute.
   */
  FL.GROUPS = [
    { key: 'q',            keys: ['q'],                                 field: null },
    { key: 'districts',    keys: ['districts'],                         field: 'districtKey' },
    { key: 'classes',      keys: ['classes', 'includeUnknownClass'],    field: 'officeClass' },
    { key: 'statuses',     keys: ['statuses'],                          field: 'status' },
    { key: 'gla',          keys: ['glaMin', 'glaMax'],                  field: 'gla' },
    { key: 'rent',         keys: ['rentMin', 'rentMax'],                field: 'askingRent' },
    { key: 'vacancy',      keys: ['vacancyMin', 'vacancyMax'],          field: 'vacancyPct' },
    { key: 'parking',      keys: ['parkingMin'],                        field: 'parkingSpaces' },
    { key: 'amenities',    keys: ['amenities'],                         field: 'amenities' },
    { key: 'confidence',   keys: ['confidence'],                        field: null },
    { key: 'completeness', keys: ['completeness'],                      field: null },
    { key: 'freshness',    keys: ['freshness'],                         field: null },
    { key: 'flags',        keys: ['flags'],                             field: null }
  ];

  FL.KEYS = (function () {
    var out = [];
    FL.GROUPS.forEach(function (g) { out = out.concat(g.keys); });
    return out;
  }());

  /* The numeric fields a slider can span. `ranges()` reports all of them so a
     control that becomes possible after an edit already has its bounds. */
  FL.NUMERIC_FIELDS = ['askingRent', 'gla', 'vacancyPct', 'occupancyPct',
                       'parkingSpaces', 'availableArea'];

  /* ------------------------------------------------------------- coercion */

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return (typeof n === 'number' && !isNaN(n)) ? n : null;
  }

  function text(v) {
    return (v === null || v === undefined) ? '' : String(v).replace(/^\s+|\s+$/g, '');
  }

  function bool(v, dflt) { return (v === null || v === undefined) ? dflt : !!v; }

  /**
   * Coerce to a list and drop values outside `allowed`. A value the vocabulary
   * does not contain (a stale URL, a mistyped AI plan) is dropped with a log
   * line rather than kept: kept, it would silently match nothing and present an
   * empty map as a finding about the market.
   */
  function list(v, allowed, what) {
    var a = Array.isArray(v) ? v : (v === null || v === undefined || v === '' ? [] : [v]);
    var out = [];
    a.forEach(function (x) {
      if (x === null || x === undefined || x === '') return;
      if (allowed && allowed.indexOf(x) < 0) {
        GEO.log.warn('filters: ignoring unknown ' + what + ' "' + x + '"');
        return;
      }
      if (out.indexOf(x) < 0) out.push(x);
    });
    return out;
  }

  FL.defaults = function () { return GEO.state.defaults().filters; };

  /**
   * Fill every key from the defaults and coerce each to its stored type.
   * Everything downstream — apply, explain, describe, toHash — starts here, so
   * a partial patch from the assistant and a hand-edited URL are handled in one
   * place instead of thirteen. Never mutates its argument.
   */
  FL.normalise = function (filters) {
    var d = FL.defaults(), f = filters || {};
    function pick(k) { return f[k] === undefined ? d[k] : f[k]; }
    return {
      q: text(pick('q')),
      districts: list(pick('districts'), null, 'district'),
      classes: list(pick('classes'), S.enums.officeClass, 'office class'),
      includeUnknownClass: bool(pick('includeUnknownClass'), d.includeUnknownClass),
      statuses: list(pick('statuses'), S.enums.status, 'status'),
      glaMin: num(pick('glaMin')), glaMax: num(pick('glaMax')),
      rentMin: num(pick('rentMin')), rentMax: num(pick('rentMax')),
      vacancyMin: num(pick('vacancyMin')), vacancyMax: num(pick('vacancyMax')),
      parkingMin: num(pick('parkingMin')),
      amenities: list(pick('amenities'), S.enums.amenity, 'amenity'),
      confidence: list(pick('confidence'), S.enums.confidence, 'confidence level'),
      completeness: list(pick('completeness'), FL.COMPLETENESS_BANDS, 'completeness band'),
      freshness: list(pick('freshness'), FL.FRESHNESS_STATES, 'freshness state'),
      flags: list(pick('flags'), FL.FLAGS, 'flag')
    };
  };

  /** State keys that differ from their default — drives the chips and the
   *  enabled state of "Reset filters" (L-18, L-19). */
  FL.activeKeys = function (filters) {
    var f = FL.normalise(filters), d = FL.defaults();
    return FL.KEYS.filter(function (k) {
      return JSON.stringify(f[k]) !== JSON.stringify(d[k]);
    });
  };

  FL.anyActive = function (filters) { return FL.activeKeys(filters).length > 0; };

  /* ------------------------------------------------- derived record values */

  function completenessBand(rec) {
    if (GEO.quality && GEO.quality.completeness) {
      var c = GEO.quality.completeness(rec);
      if (c && c.band) return c.band;
    }
    // D9 count bands, not percentage bands: a percentage puts all 148 observed
    // records in one bucket and discriminates nothing.
    var n = 0;
    S.criticalFields.forEach(function (k) { if (U.isKnown(rec[k])) n++; });
    return n === 0 ? 'none' : (n <= 2 ? 'minimal' : (n <= 5 ? 'partial' : 'good'));
  }

  function freshnessState(rec) {
    if (GEO.quality && GEO.quality.freshness) {
      var r = GEO.quality.freshness(rec);
      if (typeof r === 'string') return r;
      if (r && r.state) return r.state;
    }
    return S.freshness(rec._meta && rec._meta.lastVerifiedAt, 'askingRent');
  }

  function confidenceOf(rec) { return GEO.data.recordConfidence(rec); }

  /* The duplicate scan is the one genuinely expensive derivation in this module
     — 04-quality compares every nearby pair — and both `apply()` and
     `availability()` run on every render. It is memoised against the exact id
     list it was computed for, and dropped whenever the dataset changes, so an
     edit that moves a pin is never answered from a stale set. */
  var dupCache = { key: null, ids: null };
  GEO.on('data:changed', function () { dupCache.key = null; });

  /**
   * Ids under any unresolved duplicate suspicion. 04-quality finds the three
   * pairs the source never flagged as well as the six it did, so the filter is
   * built from its answer and falls back to the record's own marker only if the
   * quality module is absent (D6 — nothing is ever merged, only listed).
   */
  function duplicateIds(rows) {
    var key = rows.length + ':' + rows.map(function (r) { return r.id; }).join(',');
    if (dupCache.key === key) return dupCache.ids;

    var set = {};
    if (!GEO.quality || !GEO.quality.duplicates) {
      rows.forEach(function (r) {
        if (r._meta && (r._meta.duplicateGroupId || r._meta.possibleDuplicate)) set[r.id] = true;
      });
    } else {
      var d = GEO.quality.duplicates(rows);
      d.coordinateGroups.forEach(function (g) {
        g.recordIds.forEach(function (id) { set[id] = true; });
      });
      d.proximityPairs.concat(d.namePairs).forEach(function (p) {
        p.recordIds.forEach(function (id) { set[id] = true; });
      });
    }
    dupCache.key = key;
    dupCache.ids = set;
    return set;
  }

  function flagTest(flag, dupIds) {
    switch (flag) {
      case 'districtConflict':
        return function (r) { return !!(r._meta && r._meta.districtConflict); };
      case 'duplicate':
        return function (r) { return !!dupIds[r.id]; };
      case 'suspectedNonBc':
        return function (r) { return !!(r._meta && r._meta.entityReview === 'suspected_non_bc'); };
      case 'editedLocally':
        return function (r) { return !!(r._meta && (r._meta.editedLocally || r._meta.addedLocally)); };
      case 'demo':
        return function (r) { return r.recordType === 'DEMO'; };
      default:
        return function () { return false; };
    }
  }

  /** Amenities are a status-backed list: `[]` with `amenitiesStatus` of
   *  `confirmed_empty` is a RECORDED empty list, not an absence (§6). */
  function amenitiesKnown(rec) {
    return U.isKnown(rec.amenities) || rec.amenitiesStatus === 'confirmed_empty';
  }

  /* ---------------------------------------------------------- text search */

  /* 07-search owns the T9 transliteration table and the R6 homoglyph fold, and
     is the matcher whenever it is loaded. This fallback exists so the name box
     still works without it; it reuses 04-quality's name fold rather than
     carrying a second transliteration table that would drift from the first. */
  function fold(s) {
    if (GEO.search && GEO.search.fold) return GEO.search.fold(s);
    if (GEO.quality && GEO.quality.nameKey) return GEO.quality.nameKey(s);
    return String(s === null || s === undefined ? '' : s).toLowerCase();
  }

  function recordParts(rec) {
    var parts = [rec.name, rec.address];
    (rec.altNames || []).forEach(function (n) { parts.push(n); });
    if (U.isKnown(rec.districtKey)) parts.push(GEO.data.districtName(rec.districtKey));
    (rec.tenants || []).forEach(function (tn) { parts.push(tn && tn.name); });
    return parts.filter(function (p) { return U.isKnown(p); });
  }

  function textPredicate(q) {
    if (!q) return null;
    if (GEO.search && typeof GEO.search.matches === 'function') {
      return function (r) { return !!GEO.search.matches(r, q); };
    }
    var needle = fold(q);
    if (!needle) return null;
    // Each field is folded separately so a query cannot match across the seam
    // between two of them ("plaza mirobod" is not a name).
    return function (r) {
      var parts = recordParts(r);
      for (var i = 0; i < parts.length; i++) {
        if (fold(parts[i]).indexOf(needle) >= 0) return true;
      }
      return false;
    };
  }

  /* ------------------------------------------------------------ predicates */

  /**
   * Build the active predicates. Each carries the group it belongs to and,
   * where the filter reads a field, an `unknown` test that reports whether a
   * record failed because the value is missing rather than because it did not
   * match — the whole basis of `explain()`.
   */
  /* Confidence, completeness and freshness are each derived from a record's
     evidence, and `explain()` re-tests every record against every predicate to
     work out what each filter cost. Without this the freshness filter alone
     would recompute 04-quality's per-field clocks tens of thousands of times
     for one panel render. The cache lives only for the duration of one call, so
     it can never answer with a value from before an edit. */
  function perCall(fn) {
    var cache = {};
    return function (rec) {
      if (!rec.id) return fn(rec);
      if (cache[rec.id] === undefined) cache[rec.id] = fn(rec);
      return cache[rec.id];
    };
  }

  function buildPredicates(rows, f) {
    var preds = [];

    function add(group, field, test, unknown) {
      preds.push({ group: group, field: field || null, test: test, unknown: unknown || null });
    }

    var qp = textPredicate(f.q);
    if (qp) add('q', null, qp, null);

    if (f.districts.length) {
      add('districts', 'districtKey', function (r) {
        return U.isKnown(r.districtKey) && f.districts.indexOf(r.districtKey) >= 0;
      }, function (r) { return !U.isKnown(r.districtKey); });
    }

    /* Rule R4 and the oracle (class A + A+ = 12): choosing grades is a statement
       about grades, so the 132 records with no recorded class are excluded —
       loudly, via explain(), never silently. `includeUnknownClass: false` with
       no grade chosen is the other half of the same control: show only records
       whose class is actually recorded. */
    if (f.classes.length) {
      add('classes', 'officeClass', function (r) {
        return U.isKnown(r.officeClass) && f.classes.indexOf(r.officeClass) >= 0;
      }, function (r) { return !U.isKnown(r.officeClass); });
    } else if (f.includeUnknownClass === false) {
      add('classes', 'officeClass', function (r) {
        return U.isKnown(r.officeClass);
      }, function (r) { return !U.isKnown(r.officeClass); });
    }

    if (f.statuses.length) {
      add('statuses', 'status', function (r) {
        return U.isKnown(r.status) && f.statuses.indexOf(r.status) >= 0;
      }, function (r) { return !U.isKnown(r.status); });
    }

    addRange('gla', 'gla', f.glaMin, f.glaMax);
    addRange('rent', 'askingRent', f.rentMin, f.rentMax);
    addRange('vacancy', 'vacancyPct', f.vacancyMin, f.vacancyMax);
    addRange('parking', 'parkingSpaces', f.parkingMin, null);

    if (f.amenities.length) {
      // OR within the group, AND across groups — the same convention the
      // district and class groups use (IA §5.1 L-05).
      add('amenities', 'amenities', function (r) {
        if (!amenitiesKnown(r)) return false;
        var have = r.amenities || [];
        for (var i = 0; i < f.amenities.length; i++) {
          if (have.indexOf(f.amenities[i]) >= 0) return true;
        }
        return false;
      }, function (r) { return !amenitiesKnown(r); });
    }

    /* Confidence, completeness and freshness are DERIVED: every record has a
       value for the first two, so neither can exclude anything for being
       unknown. Freshness can — a record that was never verified has no state. */
    if (f.confidence.length) {
      var conf = perCall(confidenceOf);
      add('confidence', null, function (r) {
        return f.confidence.indexOf(conf(r)) >= 0;
      }, null);
    }

    if (f.completeness.length) {
      var band = perCall(completenessBand);
      add('completeness', null, function (r) {
        return f.completeness.indexOf(band(r)) >= 0;
      }, null);
    }

    if (f.freshness.length) {
      var fresh = perCall(freshnessState);
      add('freshness', null, function (r) {
        return f.freshness.indexOf(fresh(r)) >= 0;
      }, function (r) { return FL.FRESHNESS_STATES.indexOf(fresh(r)) < 0; });
    }

    if (f.flags.length) {
      // Only pay for the duplicate scan when a duplicate filter is actually on.
      var dupIds = f.flags.indexOf('duplicate') >= 0 ? duplicateIds(rows) : {};
      var tests = f.flags.map(function (fg) { return flagTest(fg, dupIds); });
      add('flags', null, function (r) {
        for (var i = 0; i < tests.length; i++) if (tests[i](r)) return true;
        return false;
      }, null);
    }

    return preds;

    function addRange(group, field, lo, hi) {
      if (lo === null && hi === null) return;
      add(group, field, function (r) {
        var v = r[field];
        if (!U.isKnown(v)) return false;          // missing is not zero (D2)
        if (lo !== null && v < lo) return false;
        if (hi !== null && v > hi) return false;
        return true;
      }, function (r) { return !U.isKnown(r[field]); });
    }
  }

  /* ---------------------------------------------------------------- apply */

  /** The filtered set. A copy, always, so a caller cannot mutate the repository
   *  array by sorting the result in place. */
  FL.apply = function (rows, filters) {
    var f = FL.normalise(filters);
    var preds = buildPredicates(rows, f);
    if (!preds.length) return rows.slice();
    return rows.filter(function (r) {
      for (var i = 0; i < preds.length; i++) if (!preds[i].test(r)) return false;
      return true;
    });
  };

  /* -------------------------------------------------------------- explain */

  /**
   * What the current filters kept, and what each one threw away.
   *
   *   { N, kept, rows, excludedBy: { <group>: {count, reason, …} }, exclusions:[…] }
   *
   * `count` is the number of records this filter dropped BECAUSE THE VALUE IS
   * NOT RECORDED; `excluded` is everything it dropped, including records that
   * simply did not match. Both are measured against the records that pass every
   * OTHER active filter, which is the only honest denominator for "what did
   * this one filter cost?" when several are on at once.
   *
   * `exclusions` is the same information pre-rendered as sentences, in group
   * order, for the panel's §11 honesty line.
   */
  FL.explain = function (rows, filters) {
    var f = FL.normalise(filters);
    var preds = buildPredicates(rows, f);

    var kept = rows.filter(function (r) {
      for (var i = 0; i < preds.length; i++) if (!preds[i].test(r)) return false;
      return true;
    });

    var excludedBy = {}, exclusions = [];

    preds.forEach(function (p, i) {
      var others = rows.filter(function (r) {
        return preds.every(function (q, j) { return j === i || q.test(r); });
      });
      var removed = others.filter(function (r) { return !p.test(r); });
      if (!removed.length) return;

      var unknown = p.unknown ? removed.filter(p.unknown) : [];
      var label = p.field ? F.lower(fieldLabel(p.field)) : groupLabel(p.group);
      var reason = unknown.length
        ? t('filter.excluded.field', { n: F.int(unknown.length), field: label })
        : null;

      excludedBy[p.group] = {
        key: p.group, field: p.field, label: label,
        count: unknown.length,          // excluded for want of a recorded value
        excluded: removed.length,       // excluded by this filter at all
        base: others.length,
        reason: reason
      };
      if (unknown.length) {
        exclusions.push({ key: p.group, field: p.field, n: unknown.length, text: reason });
      }
    });

    return { N: rows.length, kept: kept.length, rows: kept,
             excludedBy: excludedBy, exclusions: exclusions };
  };

  function groupLabel(group) {
    switch (group) {
      case 'q': return F.lower(t('filter.name.label'));
      case 'confidence': return F.lower(t('filter.confidence.label'));
      case 'completeness': return F.lower(t('filter.completeness.label'));
      case 'freshness': return F.lower(t('filter.freshness.label'));
      case 'flags': return F.lower(t('filter.flags.label'));
      default: return group;
    }
  }

  /* --------------------------------------------------------- availability */

  /**
   * Coverage for one field. The generic reader is `analytics.coverage`; the two
   * status-backed list fields are the exception, because `U.isKnown([])` is
   * false and would report a CONFIRMED-empty amenity list as missing — which
   * would disable a filter the data can in fact answer.
   */
  function coverageOf(rows, field) {
    var fd = S.field(field);
    if (fd && fd.statusField) {
      var n = 0;
      rows.forEach(function (r) {
        if (U.isKnown(r[field]) || r[fd.statusField] === 'confirmed_empty') n++;
      });
      return { n: n, N: rows.length };
    }
    return GEO.analytics.coverage(rows, field);
  }

  function entry(key, field, label, filterKeys, cov, derived, noneKey) {
    var available = cov.n > 0;
    return {
      key: key, field: field, label: label, filterKeys: filterKeys,
      derived: !!derived,
      coverage: { n: cov.n, N: cov.N },
      n: cov.n, N: cov.N,               // also flat: the panel reads them here
      available: available,
      // R2: not hidden, not inert-but-enabled — disabled with the reason visible.
      reason: available ? null : t(noneKey || 'filter.disabled.none'),
      coverageText: t('filter.disabled.coverage',
                      { n: F.int(cov.n), m: F.int(cov.N), field: F.lower(label) })
    };
  }

  function groupFor(field) {
    var hit = FL.GROUPS.filter(function (g) { return g.field === field; })[0];
    return hit || { keys: [] };
  }

  /**
   * One descriptor per filterable field, plus the four filters derived from
   * data quality rather than from a property attribute. Computed from `rows`
   * every time, never cached: that is what makes a filter re-enable itself the
   * instant demo mode goes on or an editor save lands.
   */
  FL.availability = function (rows) {
    var out = S.filterFields.map(function (k) {
      return entry(k, k, fieldLabel(k), groupFor(k).keys, coverageOf(rows, k), false);
    });

    out.push(entry('confidence', null, t('filter.confidence.label'), ['confidence'],
                   { n: rows.length, N: rows.length }, true));
    out.push(entry('completeness', null, t('filter.completeness.label'), ['completeness'],
                   { n: rows.length, N: rows.length }, true));

    /* Coverage for freshness is the coverage of the date it is computed from.
       Asking 04-quality for each record's full per-field state here would cost
       ~12 ms on 148 records, on every render, to answer a question a single
       `lastVerifiedAt` already answers. The FILTER still uses the exact state —
       it just does not pay for it when nobody has asked for it. */
    var dated = 0;
    rows.forEach(function (r) {
      if (r._meta && U.isKnown(r._meta.lastVerifiedAt)) dated++;
    });
    out.push(entry('freshness', null, t('filter.freshness.label'), ['freshness'],
                   { n: dated, N: rows.length }, true));

    var dupIds = duplicateIds(rows), flagged = 0;
    var tests = FL.FLAGS.map(function (fg) { return flagTest(fg, dupIds); });
    rows.forEach(function (r) {
      for (var i = 0; i < tests.length; i++) {
        if (tests[i](r)) { flagged++; return; }
      }
    });
    out.push(entry('flags', null, t('filter.flags.label'), ['flags'],
                   { n: flagged, N: rows.length }, true, 'filter.flags.none'));

    return out;
  };

  /* --------------------------------------------------------------- ranges */

  /**
   * The min and max actually present for each numeric filter, so a slider spans
   * the data rather than an invented range. `null` for a field nothing records —
   * an invented 0–100 track would imply a distribution that does not exist.
   */
  FL.ranges = function (rows) {
    var out = {};
    FL.NUMERIC_FIELDS.forEach(function (k) {
      var vals = GEO.analytics.known(rows, k);
      out[k] = vals.length
        ? { field: k, min: Math.min.apply(null, vals), max: Math.max.apply(null, vals),
            n: vals.length, N: rows.length }
        : null;
    });
    return out;
  };

  /* ------------------------------------------------------------- describe */

  /** The display label for one filter value. `district` resolves through the
   *  dataset because a district name is data, not interface copy. */
  FL.valueLabel = function (kind, value) {
    switch (kind) {
      case 'district':     return GEO.data.districtName(value);
      case 'class':        return CLASS_I18N[value] ? t('value.class.' + CLASS_I18N[value]) : String(value);
      case 'status':       return STATUS_I18N[value] ? t('value.status.' + STATUS_I18N[value]) : String(value);
      case 'amenity':      return AMENITY_I18N[value] ? t('value.amenity.' + AMENITY_I18N[value]) : String(value);
      case 'confidence':   return t('value.confidence.' + String(value).toLowerCase());
      case 'completeness': return t('value.completeness.' + value);
      case 'freshness':    return t('value.freshness.' + value);
      case 'flag':         return t('value.flag.' + value);
      default:             return String(value);
    }
  };

  function labelled(values, kind) {
    return values.map(function (v) { return FL.valueLabel(kind, v); }).join(', ');
  }

  /* Units belong in the sentence: this string ends up in a CSV header and in an
     AI layer's criteria, where "up to 30" without a unit is a future argument. */
  function valueText(field, v) {
    switch (field) {
      case 'askingRent': return F.rent(v);
      case 'gla': case 'availableArea': return F.area(v);
      case 'vacancyPct': case 'occupancyPct': return F.pct(v, 1);
      case 'parkingSpaces': return F.int(v);
      default: return F.num(v, 1);
    }
  }

  function rangeText(field, lo, hi) {
    if (lo === null && hi === null) return null;
    var label = fieldLabel(field);
    if (lo !== null && hi !== null) {
      return t('filter.describe.between',
               { field: label, min: valueText(field, lo), max: valueText(field, hi) });
    }
    if (lo !== null) return t('filter.describe.from', { field: label, min: valueText(field, lo) });
    return t('filter.describe.upTo', { field: label, max: valueText(field, hi) });
  }

  /**
   * One short sentence naming the active filters — the CSV export header, the
   * assistant's layer criteria and the URL-state summary all read this, so a
   * saved result set can always be traced back to the rule that produced it.
   * Empty string when nothing is active, so callers can fall back with `||`.
   */
  FL.describe = function (filters) {
    var f = FL.normalise(filters), parts = [];

    if (f.q) parts.push(t('filter.describe.q', { q: f.q }));
    if (f.districts.length) {
      parts.push(t('filter.describe.districts', { list: labelled(f.districts, 'district') }));
    }
    if (f.classes.length) {
      parts.push(t('filter.describe.classes', { list: labelled(f.classes, 'class') }));
    } else if (f.includeUnknownClass === false) {
      parts.push(t('filter.describe.classKnownOnly'));
    }
    if (f.statuses.length) {
      parts.push(t('filter.describe.statuses', { list: labelled(f.statuses, 'status') }));
    }

    [rangeText('gla', f.glaMin, f.glaMax),
     rangeText('askingRent', f.rentMin, f.rentMax),
     rangeText('vacancyPct', f.vacancyMin, f.vacancyMax)]
      .forEach(function (s) { if (s) parts.push(s); });

    if (f.parkingMin !== null) {
      parts.push(t('filter.describe.atLeast', { field: fieldLabel('parkingSpaces'),
                                                min: valueText('parkingSpaces', f.parkingMin) }));
    }
    if (f.amenities.length) {
      parts.push(t('filter.describe.amenities', { list: labelled(f.amenities, 'amenity') }));
    }
    if (f.confidence.length) {
      parts.push(t('filter.describe.confidence', { list: labelled(f.confidence, 'confidence') }));
    }
    if (f.completeness.length) {
      parts.push(t('filter.describe.completeness', { list: labelled(f.completeness, 'completeness') }));
    }
    if (f.freshness.length) {
      parts.push(t('filter.describe.freshness', { list: labelled(f.freshness, 'freshness') }));
    }
    if (f.flags.length) {
      parts.push(t('filter.describe.flags', { list: labelled(f.flags, 'flag') }));
    }

    // ' · ' is punctuation, not copy — the same separator 08-analytics uses.
    return parts.join(' · ');
  };

  /* ----------------------------------------------------------- URL state */

  /* M9: a test session must be reproducible from a link, so the filter set
     serialises to a compact hash and back without loss. Codes are short because
     the whole thing has to survive being pasted into a chat message. */
  var HASH = [
    { code: 'q',  type: 'text',   keys: ['q'] },
    { code: 'd',  type: 'list',   keys: ['districts'] },
    { code: 'c',  type: 'list',   keys: ['classes'] },
    { code: 'u',  type: 'bool',   keys: ['includeUnknownClass'] },
    { code: 's',  type: 'list',   keys: ['statuses'] },
    { code: 'g',  type: 'range',  keys: ['glaMin', 'glaMax'] },
    { code: 'r',  type: 'range',  keys: ['rentMin', 'rentMax'] },
    { code: 'v',  type: 'range',  keys: ['vacancyMin', 'vacancyMax'] },
    { code: 'p',  type: 'number', keys: ['parkingMin'] },
    { code: 'a',  type: 'list',   keys: ['amenities'] },
    { code: 'cf', type: 'list',   keys: ['confidence'] },
    { code: 'cp', type: 'list',   keys: ['completeness'] },
    { code: 'fr', type: 'list',   keys: ['freshness'] },
    { code: 'fl', type: 'list',   keys: ['flags'] }
  ];

  var HASH_BY_CODE = {};
  HASH.forEach(function (h) { HASH_BY_CODE[h.code] = h; });

  function enc(s) { return encodeURIComponent(String(s)); }
  function dec(s) {
    // A hand-edited URL can carry a lone '%', which decodeURIComponent throws on.
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  /** Filters -> hash string (no leading '#'). Defaults are omitted, so the URL
   *  stays short and only carries what the tester actually changed. */
  FL.toHash = function (filters) {
    var f = FL.normalise(filters), d = FL.defaults(), out = [];
    HASH.forEach(function (h) {
      var a = h.keys[0], b = h.keys[1];
      if (h.type === 'text') {
        if (f[a]) out.push(h.code + '=' + enc(f[a]));
      } else if (h.type === 'list') {
        if (f[a].length) out.push(h.code + '=' + f[a].map(enc).join(','));
      } else if (h.type === 'bool') {
        if (f[a] !== d[a]) out.push(h.code + '=' + (f[a] ? '1' : '0'));
      } else if (h.type === 'number') {
        if (f[a] !== null) out.push(h.code + '=' + f[a]);
      } else if (h.type === 'range') {
        if (f[a] !== null || f[b] !== null) {
          out.push(h.code + '=' + (f[a] === null ? '' : f[a]) + ':' + (f[b] === null ? '' : f[b]));
        }
      }
    });
    return out.join('&');
  };

  /** Hash string -> a complete filter object. An unrecognised code, or a value
   *  outside its vocabulary, is ignored rather than thrown: a stale link from a
   *  previous build must still open the app. */
  FL.fromHash = function (str) {
    var f = U.clone(FL.defaults());
    String(str === null || str === undefined ? '' : str)
      .replace(/^#/, '').split('&').forEach(function (pair) {
        if (!pair) return;
        var i = pair.indexOf('=');
        var h = HASH_BY_CODE[i < 0 ? pair : pair.slice(0, i)];
        if (!h) return;
        var raw = i < 0 ? '' : pair.slice(i + 1);
        var a = h.keys[0], b = h.keys[1];

        if (h.type === 'text') {
          f[a] = dec(raw);
        } else if (h.type === 'list') {
          f[a] = raw === '' ? [] : raw.split(',').map(dec);
        } else if (h.type === 'bool') {
          f[a] = (raw === '1' || raw === 'true');
        } else if (h.type === 'number') {
          f[a] = num(dec(raw));
        } else if (h.type === 'range') {
          var bits = raw.split(':');
          f[a] = bits[0] === '' ? null : num(dec(bits[0]));
          f[b] = (bits.length > 1 && bits[1] !== '') ? num(dec(bits[1])) : null;
        }
      });
    return FL.normalise(f);
  };
}(window));
