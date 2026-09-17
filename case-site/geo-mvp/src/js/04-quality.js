/* ===========================================================================
 * 04-quality — completeness, freshness, duplicates, conflicts, the backlog
 *
 * Brief §19 (quality indicators), §23 (refresh cadence), §37 (the coverage
 * argument), §50 (field-collection backlog); build contract D3, D6, D7, D8, D9.
 *
 * This module answers one question in several ways: *how much of this dataset
 * can you actually stand behind?* It never repairs anything. A conflict, a
 * duplicate or a suspicious entity is surfaced with both sides of the evidence
 * and a verdict a human records — merging or deleting on suspicion destroys
 * data on an unverified judgement (D6, D7).
 *
 * Two load-order facts that shape the code:
 *   - this file runs BEFORE `08-analytics` and `09-geo` (see `manifest.json`),
 *     so `GEO.geo` / `GEO.analytics` are resolved lazily inside functions and
 *     never captured at load time;
 *   - distance always comes from `GEO.geo.distanceM` so the build holds exactly
 *     one haversine. A second copy here would drift from the one the radius
 *     panel publishes.
 *
 * Honesty rule carried through every function: an indicator that cannot
 * separate the records it is given must SAY so rather than return a confident
 * all-or-nothing answer. `datasetSummary().stalenessDiscriminates` is the
 * canonical case (D8) — all observed records share one collection date, so any
 * threshold flags all of them or none of them, and the number alone would lie.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema, D = GEO.data, F = GEO.fmt;
  var Q = GEO.quality = {};

  function t(key, vars) { return GEO.i18n ? GEO.i18n.t(key, vars) : key; }
  function plural(key, n, vars) {
    return GEO.i18n ? GEO.i18n.plural(key, n, vars) : (n + ' ' + key);
  }
  function asOf(day) { return day || GEO.date.today(); }
  function idsOf(rows) { return rows.map(function (r) { return r.id; }); }

  /* Severity vocabulary is the visual system's status scale (10-visual-system
     §4): serious / warn / note map to --status-serious / --status-warn /
     --status-neutral. Colour is never the only cue — every queue carries a
     title and a detail sentence. */
  Q.SEVERITY = ['serious', 'warn', 'note'];

  /* =======================================================================
   * 1. COMPLETENESS — count bands, not percentage bands (D9)
   *
   * A percentage over 8 critical fields puts all 148 observed records in one
   * bucket (0% or 25%), which teaches a tester nothing. Counting the fields
   * splits them 132 / 16 and reads the way a consultant speaks: "no commercial
   * data recorded" is actionable, "25% complete" is not.
   * ===================================================================== */

  Q.BANDS = ['none', 'minimal', 'partial', 'good'];

  /** 0 -> none · 1–2 -> minimal · 3–5 -> partial · 6–8 -> good. */
  Q.band = function (knownCount) {
    if (knownCount <= 0) return 'none';
    if (knownCount <= 2) return 'minimal';
    if (knownCount <= 5) return 'partial';
    return 'good';
  };

  Q.bandLabel = function (band) { return t('value.completeness.' + band); };

  /**
   * completeness(rec) -> { known, total, band, missing[], present[], ratio, text }
   * `missing` holds field KEYS; §11.3 requires the property card to name the
   * missing fields rather than merely assert incompleteness.
   */
  Q.completeness = function (rec) {
    var keys = S.criticalFields;
    var present = [], missing = [];
    keys.forEach(function (k) {
      if (U.isKnown(rec[k])) present.push(k); else missing.push(k);
    });
    var band = Q.band(present.length);
    return {
      known: present.length,
      total: keys.length,
      band: band,
      bandLabel: Q.bandLabel(band),
      present: present,
      missing: missing,
      // Kept for sorting and for the coverage chart only. It is deliberately
      // NOT the thing displayed as a band (D9).
      ratio: keys.length ? present.length / keys.length : 0,
      text: t('quality.completeness.band',
              { band: Q.bandLabel(band), n: present.length, m: keys.length })
    };
  };

  /** Set-level coverage: Σ known critical fields / (rows × critical fields). */
  Q.coverageIndex = function (rows) {
    var per = S.criticalFields.length;
    var total = rows.length * per, known = 0;
    rows.forEach(function (r) { known += Q.completeness(r).known; });
    return {
      value: total ? known / total : null,
      known: known, total: total, N: rows.length, fieldsPerRecord: per
    };
  };

  /** Band histogram over a set — the Quality tab's first chart. */
  Q.completenessBands = function (rows) {
    var counts = {};
    Q.BANDS.forEach(function (b) { counts[b] = 0; });
    rows.forEach(function (r) { counts[Q.completeness(r).band]++; });
    return { counts: counts, order: Q.BANDS, N: rows.length };
  };

  /* =======================================================================
   * 2. FRESHNESS — per field, worst-of for the record (D8, §23)
   *
   * A record is as stale as its stalest KNOWN field. A field with no value is
   * not stale, it is missing: the fix is collection, not re-verification, and
   * conflating the two would put every record in the stale bucket permanently
   * (04-data-schema §4.4).
   * ===================================================================== */

  /* Worst-of ordering. `unknown` (a value that has never been verified) ranks
     above `ageing`: not knowing when a figure was last checked is a weaker
     position than knowing it is due soon. */
  var FRESH_RANK = { fresh: 0, ageing: 1, unknown: 2, stale: 3 };

  /** Every known field with its own refresh clock. */
  Q.freshnessByField = function (rec, day) {
    var today = asOf(day);
    var out = [];
    S.fields.forEach(function (fd) {
      if (!U.isKnown(rec[fd.key])) return;
      var ev = D.evidence(rec, fd.key);
      // Field-level date first, then the record's. A field re-verified in the
      // editor carries its own date and must not inherit the record's.
      var lv = (ev && ev.lastVerifiedAt) || (rec._meta && rec._meta.lastVerifiedAt) || null;
      var due = U.isKnown(lv) ? S.nextRefresh(lv, fd.key) : null;
      out.push({
        field: fd.key,
        label: S.label(fd.key),
        refresh: fd.refresh || 'slow',
        intervalDays: S.refreshDays[fd.refresh || 'slow'],
        lastVerifiedAt: lv,
        nextRefreshAt: due,
        ageDays: U.isKnown(lv) ? GEO.date.daysBetween(lv, today) : null,
        daysToDue: due ? GEO.date.daysBetween(today, due) : null,
        state: S.freshness(lv, fd.key, today)
      });
    });
    return out;
  };

  /**
   * freshness(rec) -> { state, oldestField, ageDays, nextRefreshAt, fields[] }
   * `oldestField` is the field that SETS the state (worst state, earliest due
   * date among equals) — the one a reviewer would act on. `nextRefreshAt` is
   * the earliest due date across all known fields, computed from
   * `lastVerifiedAt` and never stored, so it cannot drift (D8).
   */
  Q.freshness = function (rec, day) {
    var today = asOf(day);
    var fields = Q.freshnessByField(rec, today);

    if (!fields.length) {
      // Nothing recorded means nothing to re-verify. Reporting "stale" here
      // would be a lie about an empty record; it is incomplete, not out of date.
      return { state: 'unknown', oldestField: null, ageDays: null,
               nextRefreshAt: null, fields: [],
               reason: t('quality.freshness.nothingToVerify') };
    }

    var worst = null, next = null;
    fields.forEach(function (f) {
      if (worst === null ||
          FRESH_RANK[f.state] > FRESH_RANK[worst.state] ||
          (FRESH_RANK[f.state] === FRESH_RANK[worst.state] && earlier(f.nextRefreshAt, worst.nextRefreshAt))) {
        worst = f;
      }
      if (f.nextRefreshAt && earlier(f.nextRefreshAt, next)) next = f.nextRefreshAt;
    });

    return {
      state: worst.state,
      oldestField: worst.field,
      oldestFieldLabel: worst.label,
      ageDays: worst.ageDays,
      lastVerifiedAt: worst.lastVerifiedAt,
      nextRefreshAt: next,
      daysToDue: next ? GEO.date.daysBetween(today, next) : null,
      fields: fields,
      reason: null
    };
  };

  /* ISO date-only strings compare correctly as strings; a null sorts last. */
  function earlier(a, b) {
    if (!a) return false;
    if (!b) return true;
    return a < b;
  }

  function fieldsInState(rec, state, day) {
    return Q.freshnessByField(rec, day)
      .filter(function (f) { return f.state === state; })
      .map(function (f) { return f.field; });
  }

  Q.staleFields  = function (rec, day) { return fieldsInState(rec, 'stale', day); };
  Q.ageingFields = function (rec, day) { return fieldsInState(rec, 'ageing', day); };

  /* =======================================================================
   * 3. CONFIDENCE (D3)
   * ===================================================================== */

  /**
   * Counts by High / Medium / Low / Unknown over `GEO.data.recordConfidence`,
   * which is the WEAKEST confidence among a record's known critical fields —
   * so a well-sourced name cannot launder an unverified rent claim.
   */
  Q.confidenceSummary = function (rows) {
    var order = S.enums.confidence;
    var counts = {}, ids = {};
    order.forEach(function (l) { counts[l] = 0; ids[l] = []; });
    rows.forEach(function (r) {
      var c = D.recordConfidence(r);
      if (counts[c] === undefined) { counts[c] = 0; ids[c] = []; }
      counts[c]++;
      ids[c].push(r.id);
    });
    return {
      N: rows.length, order: order, counts: counts, ids: ids,
      text: t('quality.confidence.summary', {
        high: F.int(counts.High), medium: F.int(counts.Medium),
        low: F.int(counts.Low), unknown: F.int(counts.Unknown)
      })
    };
  };

  /* Commercial claims are the fields a client quotes back at us, so they are
     the ones worth re-verifying first when they carry a weak source. */
  Q.COMMERCIAL_FIELDS = ['askingRent', 'serviceCharge', 'occupancyPct',
                         'vacancyPct', 'availableArea', 'officeClass'];

  /** Known commercial fields whose evidence is Low or Unknown confidence. */
  Q.lowConfidenceFields = function (rec) {
    return Q.COMMERCIAL_FIELDS.filter(function (k) {
      if (!U.isKnown(rec[k])) return false;
      var c = D.confidenceOf(rec, k);
      return c === 'Low' || c === 'Unknown';
    });
  };

  /* =======================================================================
   * 4. NAME NORMALISATION — used only to GATE a duplicate suggestion
   *
   * Two normalisations, deliberately:
   *
   *   nameKey()   lowercase -> Cyrillic transliterated -> non-alphanumerics
   *               dropped. Identity across script and punctuation only.
   *   nameCore()  the same, with generic building words removed first
   *               (business / centre / tower / plaza / jsc / llc / …).
   *
   * The identity and edit-distance gates run on `nameKey`; only the containment
   * gate runs on `nameCore`. Stripping the generic words BEFORE an identity
   * test makes "SIMURG JSC" identical to "SIMURG" 3.3 km away, and makes
   * "Chilonzor" two edits from "CHILANZAR BIZNES CENTER" 1.5 km away — neither
   * is evidence of a duplicated building, and both would put a reviewer to work
   * on a false positive. Containment is where the generic words genuinely get
   * in the way ("UzOman Square" vs "UzOman tower"), so that is where they go.
   *
   * Stop words are matched on the ORIGINAL tokens, which is why the list holds
   * both scripts. Known limitation: a mixed-script word such as "Сenter"
   * (Cyrillic С, Latin remainder) is not matched — the seed contains one.
   * ===================================================================== */

  Q.NAME_STOP_WORDS = ['business', 'biznes', 'centre', 'center', 'centr', 'sentr',
                       'бизнес', 'центр', 'tower', 'plaza', 'office', 'офис',
                       'jsc', 'llc', 'group'];

  /* Tokens are split on anything that is not a lowercase letter or digit in
     the Latin, Russian or Uzbek-Cyrillic alphabets. Written as escapes so the
     class survives any encoding accident in the assembler (T5). */
  var WORD_SEP = /[^0-9a-zа-яёўқғҳ]+/;

  /* Practical RU/UZ -> Latin table. It only has to be CONSISTENT: it is used to
     compare two names with each other, never to display anything. */
  var TRANSLIT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h'
  };

  /* Below this a core is not a name any more ("T-Tower" -> "t"), so the full
     key is used instead. A one-letter core matches half the dataset. */
  var MIN_CORE_LENGTH = 3;

  function tokenise(name) {
    return String(name === null || name === undefined ? '' : name)
      .toLowerCase().split(WORD_SEP)
      .filter(function (tok) { return tok !== ''; });
  }

  function translit(s) {
    var out = '', i;
    for (i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      out += (TRANSLIT[c] !== undefined ? TRANSLIT[c] : c);
    }
    return out;
  }

  function alnum(s) { return s.replace(/[^a-z0-9]/g, ''); }

  Q.nameKey = function (name) { return alnum(translit(tokenise(name).join(''))); };

  Q.nameCore = function (name) {
    var kept = tokenise(name).filter(function (tok) {
      return Q.NAME_STOP_WORDS.indexOf(tok) < 0;
    });
    var core = alnum(translit(kept.join('')));
    return core.length >= MIN_CORE_LENGTH ? core : Q.nameKey(name);
  };

  /** Levenshtein with an early exit — `max + 1` means "further than max". */
  function editDistance(a, b, max) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      var best = i;
      for (j = 1; j <= b.length; j++) {
        var sub = prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1);
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, sub);
        if (cur[j] < best) best = cur[j];
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /* =======================================================================
   * 5. DUPLICATES (D6) — three kinds, never merged
   * ===================================================================== */

  Q.PROXIMITY_M = 30;              // below this two listings share a footprint
  Q.NAME_EDIT_MAX = 2;             // "Neus" / "NEXUS" is 2 — and 8 km apart
  Q.NAME_MIN_SHARED = 4;           // a 3-letter containment is a coincidence
  Q.NAME_GATE_M = { identical: 4000, edit: 1500, contains: 1000 };

  function distanceM(a, b) {
    // Lazy on purpose: 09-geo loads after this file. One haversine per build.
    return GEO.geo.distanceM(a.lat, a.lng, b.lat, b.lng);
  }

  function hasCoords(r) { return U.isKnown(r.lat) && U.isKnown(r.lng); }

  function maxPairDistance(rows) {
    var max = 0, i, j;
    for (i = 0; i < rows.length; i++) {
      for (j = i + 1; j < rows.length; j++) {
        if (!hasCoords(rows[i]) || !hasCoords(rows[j])) continue;
        var d = distanceM(rows[i], rows[j]);
        if (d > max) max = d;
      }
    }
    return max;
  }

  /**
   * duplicates(rows) -> { coordinateGroups[], proximityPairs[], namePairs[] }
   *
   * A pair is reported once and once only, in the strongest category that
   * covers it: source-flagged group, then sub-30 m proximity, then name.
   * Reporting the same two records in three queues would treble the apparent
   * size of the problem.
   */
  Q.duplicates = function (rows) {
    var grouped = {};
    rows.forEach(function (r) {
      var g = r._meta && r._meta.duplicateGroupId;
      if (!g) return;
      (grouped[g] = grouped[g] || []).push(r);
    });

    var coordinateGroups = Object.keys(grouped).sort().map(function (g) {
      var members = grouped[g];
      return {
        groupId: g, records: members, recordIds: idsOf(members),
        maxDistanceM: maxPairDistance(members),
        // The verdict lives on the records; `undecided` until a human rules (D6).
        verdict: (members[0]._meta && members[0]._meta.duplicateVerdict) || 'undecided'
      };
    }).filter(function (g) {
      // A group with one member left after filtering is not a pair in THIS
      // selection; saying "1 duplicate" would be false.
      return g.records.length > 1;
    });

    /* Precompute the name forms once — O(n), not O(n²). */
    var pts = [];
    rows.forEach(function (r) {
      if (!hasCoords(r)) return;
      pts.push({ rec: r, key: Q.nameKey(r.name), core: Q.nameCore(r.name),
                 group: (r._meta && r._meta.duplicateGroupId) || null });
    });

    var gate = Math.max(Q.NAME_GATE_M.identical, Q.PROXIMITY_M);
    // Conservative degree box so far-apart pairs never reach the haversine.
    var dLatMax = gate / 110000, dLngMax = gate / 80000;

    var proximityPairs = [], namePairs = [], i, j;
    for (i = 0; i < pts.length; i++) {
      for (j = i + 1; j < pts.length; j++) {
        var a = pts[i], b = pts[j];
        if (Math.abs(a.rec.lat - b.rec.lat) > dLatMax) continue;
        if (Math.abs(a.rec.lng - b.rec.lng) > dLngMax) continue;

        var sameGroup = !!a.group && a.group === b.group;
        if (sameGroup) continue;                       // already in a coordinate group

        var d = distanceM(a.rec, b.rec);

        if (d < Q.PROXIMITY_M) {
          proximityPairs.push({ records: [a.rec, b.rec], recordIds: [a.rec.id, b.rec.id],
                                distanceM: d, flaggedBySource: false });
          continue;                                     // not re-reported as a name pair
        }

        var why = null, ed = null;
        if (a.key && b.key) {
          if (a.key === b.key) {
            if (d <= Q.NAME_GATE_M.identical) why = 'identical';
          } else {
            ed = editDistance(a.key, b.key, Q.NAME_EDIT_MAX);
            if (ed <= Q.NAME_EDIT_MAX && d <= Q.NAME_GATE_M.edit) {
              why = 'edit';
            } else if (a.core && b.core &&
                       (a.core.indexOf(b.core) >= 0 || b.core.indexOf(a.core) >= 0) &&
                       Math.min(a.core.length, b.core.length) >= Q.NAME_MIN_SHARED &&
                       d <= Q.NAME_GATE_M.contains) {
              why = 'contains';
            }
          }
        }
        if (why) {
          namePairs.push({ records: [a.rec, b.rec], recordIds: [a.rec.id, b.rec.id],
                           distanceM: d, why: why,
                           editDistance: why === 'edit' ? ed : null });
        }
      }
    }

    function byDistance(x, y) { return x.distanceM - y.distanceM; }
    proximityPairs.sort(byDistance);
    namePairs.sort(byDistance);

    return { coordinateGroups: coordinateGroups,
             proximityPairs: proximityPairs,
             namePairs: namePairs };
  };

  function verdictOf(rec) {
    return (rec._meta && rec._meta.duplicateVerdict) || 'undecided';
  }

  /** Ids with an unresolved duplicate suspicion of any kind — used by the queue. */
  function unresolvedDuplicateIds(dupes) {
    var set = {};
    dupes.coordinateGroups.forEach(function (g) {
      if (g.verdict !== 'undecided') return;
      g.recordIds.forEach(function (id) { set[id] = true; });
    });
    dupes.proximityPairs.concat(dupes.namePairs).forEach(function (p) {
      // A pair the reviewer has already ruled on stops driving the backlog.
      // The verdict is per record, so a pair counts as settled only when both
      // sides carry one — one settled record does not close the other's case.
      if (verdictOf(p.records[0]) !== 'undecided' &&
          verdictOf(p.records[1]) !== 'undecided') return;
      p.recordIds.forEach(function (id) { set[id] = true; });
    });
    return set;
  }

  /* =======================================================================
   * 6. CONSISTENCY — values that contradict each other (§11.6)
   * Raised, never auto-corrected: the platform records the market, it does not
   * argue with it (§2.2).
   * ===================================================================== */

  Q.valueConflicts = function (rec) {
    var out = [];
    if (U.isKnown(rec.occupancyPct) && U.isKnown(rec.vacancyPct)) {
      var sum = rec.occupancyPct + rec.vacancyPct;
      if (Math.abs(sum - 100) > 1) {
        out.push({ code: 'occupancyVacancy', fields: ['occupancyPct', 'vacancyPct'],
                   text: t('quality.value.occupancyVacancy', {
                     occ: F.num(rec.occupancyPct, 1), vac: F.num(rec.vacancyPct, 1),
                     sum: F.num(sum, 1) }) });
      }
    }
    if (U.isKnown(rec.gla) && U.isKnown(rec.gba) && rec.gla > rec.gba) {
      out.push({ code: 'areaMismatch', fields: ['gla', 'gba'],
                 text: t('quality.value.areaMismatch',
                         { gla: F.area(rec.gla), gba: F.area(rec.gba) }) });
    }
    if (U.isKnown(rec.availableArea) && U.isKnown(rec.gla) && rec.availableArea > rec.gla) {
      out.push({ code: 'availableExceedsGla', fields: ['availableArea', 'gla'],
                 text: t('quality.value.availableExceedsGla',
                         { available: F.area(rec.availableArea), gla: F.area(rec.gla) }) });
    }
    return out;
  };

  Q.outOfBounds = function (rec) {
    var b = S.bounds;
    if (!hasCoords(rec)) return false;
    return rec.lat < b.latMin || rec.lat > b.latMax ||
           rec.lng < b.lngMin || rec.lng > b.lngMax;
  };

  /* =======================================================================
   * 7. THE REVIEW QUEUES
   * ===================================================================== */

  /* Declared order = the order a reviewer should work through them, which is
     also severity order. Every entry is a real queue with real record ids;
     nothing here is a percentage badge. */
  Q.ISSUE_TYPES = [
    { type: 'missing_critical',          severity: 'serious' },
    { type: 'coordinate_out_of_bounds',  severity: 'serious' },
    { type: 'duplicate_coordinate',      severity: 'serious' },
    { type: 'district_conflict',         severity: 'warn' },
    { type: 'duplicate_proximity',       severity: 'warn' },
    { type: 'suspected_non_bc',          severity: 'warn' },
    { type: 'value_conflict',            severity: 'warn' },
    { type: 'duplicate_name',            severity: 'note' },
    { type: 'name_quality',              severity: 'note' }
  ];

  var SEVERITY_BY_TYPE = {};
  Q.ISSUE_TYPES.forEach(function (d) { SEVERITY_BY_TYPE[d.type] = d.severity; });

  /* The detail line shows the first few cases by name; the full list is in
     `items`, so a panel can expand without recomputing anything. */
  var EXAMPLES_SHOWN = 3;

  function examplesOf(items) {
    if (!items.length) return '';
    var shown = items.slice(0, EXAMPLES_SHOWN).map(function (it) { return it.text; });
    var rest = items.length - shown.length;
    if (rest > 0) shown.push(t('quality.issue.examples.more', { n: F.int(rest) }));
    return shown.join(' · ');
  }

  function nameOf(rec) { return U.isKnown(rec.name) ? rec.name : F.UNKNOWN; }

  function issue(type, recordIds, title, detail, action, items, extra) {
    var e = {
      type: type,
      severity: SEVERITY_BY_TYPE[type] || 'note',
      recordIds: recordIds,
      n: recordIds.length,
      title: title,
      detail: detail,
      action: action,
      items: items || []
    };
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }

  /**
   * issues(rows) -> [{ type, severity, recordIds[], title, detail, action, items[] }]
   *
   * Only non-empty queues are returned; `Q.ISSUE_TYPES` lists everything that
   * was checked, so a panel can honestly say "9 checks run, 6 found something"
   * rather than implying the absent ones were never looked for.
   */
  Q.issues = function (rows, opts) {
    opts = opts || {};
    var out = [];
    // Building the duplicate index is the expensive part (≈20 ms at 156 rows,
    // O(n²)). A panel that also renders the queue builds it once and passes it
    // to both rather than paying twice for the same answer.
    var dupes = opts.duplicates || Q.duplicates(rows);

    /* --- missing critical data (the `none` completeness band) ------------- */
    var none = rows.filter(function (r) { return Q.completeness(r).band === 'none'; });
    if (none.length) {
      out.push(issue('missing_critical', idsOf(none),
        t('quality.issue.missingCritical.title'),
        t('quality.issue.missingCritical.detail', {
          n: F.int(none.length), m: F.int(rows.length),
          k: F.int(S.criticalFields.length) }),
        t('quality.issue.missingCritical.action'),
        none.map(function (r) {
          var c = Q.completeness(r);
          return { id: r.id, text: t('quality.issue.item.missingCritical',
                                     { name: nameOf(r), n: F.int(c.known), m: F.int(c.total) }) };
        })));
    }

    /* --- coordinates outside the city extent ----------------------------- */
    var oob = rows.filter(Q.outOfBounds);
    if (oob.length) {
      var oobItems = oob.map(function (r) {
        return { id: r.id, text: t('quality.issue.item.outOfBounds',
                                   { name: nameOf(r), lat: F.num(r.lat, 4), lng: F.num(r.lng, 4) }) };
      });
      out.push(issue('coordinate_out_of_bounds', idsOf(oob),
        t('quality.issue.outOfBounds.title'),
        t('quality.issue.outOfBounds.detail', {
          n: F.int(oob.length),
          latMin: S.bounds.latMin, latMax: S.bounds.latMax,
          lngMin: S.bounds.lngMin, lngMax: S.bounds.lngMax,
          examples: examplesOf(oobItems) }),
        t('quality.issue.outOfBounds.action'), oobItems));
    }

    /* --- duplicates the source itself flagged ---------------------------- */
    if (dupes.coordinateGroups.length) {
      var groupIds = [];
      var groupItems = dupes.coordinateGroups.map(function (g) {
        groupIds = groupIds.concat(g.recordIds);
        return {
          id: g.groupId, ids: g.recordIds,
          text: t('quality.issue.item.dupeGroup', {
            names: g.records.map(nameOf).join(' / '), d: F.num(g.maxDistanceM, 0) })
        };
      });
      out.push(issue('duplicate_coordinate', groupIds,
        t('quality.issue.duplicateCoordinate.title'),
        t('quality.issue.duplicateCoordinate.detail', {
          records: F.int(groupIds.length), groups: F.int(dupes.coordinateGroups.length),
          examples: examplesOf(groupItems) }),
        t('quality.issue.duplicateCoordinate.action'), groupItems,
        { groups: dupes.coordinateGroups }));
    }

    /* --- district label vs polygon (D1) ---------------------------------- */
    var conflicts = rows.filter(function (r) { return !!(r._meta && r._meta.districtConflict); });
    if (conflicts.length) {
      // Both sides are named, every time: the label the source supplied and the
      // district the boundary actually puts the point in. Neither is hidden.
      var conflictItems = conflicts.map(function (r) {
        return { id: r.id, text: t('quality.conflict.row', {
          name: nameOf(r),
          label: U.isKnown(r._meta.districtSourceLabel) ? r._meta.districtSourceLabel : F.UNKNOWN,
          computed: D.districtName(r.districtKey) }) };
      });
      out.push(issue('district_conflict', idsOf(conflicts),
        t('quality.conflict.title'),
        t('quality.issue.districtConflict.detail', {
          n: F.int(conflicts.length), examples: examplesOf(conflictItems) }),
        t('quality.issue.districtConflict.action'), conflictItems));
    }

    /* --- unflagged sub-30 m pairs ---------------------------------------- */
    if (dupes.proximityPairs.length) {
      var proxIds = [], seenProx = {};
      var proxItems = dupes.proximityPairs.map(function (p) {
        p.recordIds.forEach(function (id) {
          if (!seenProx[id]) { seenProx[id] = true; proxIds.push(id); }
        });
        return { ids: p.recordIds, text: t('quality.issue.item.dupePair', {
          a: nameOf(p.records[0]), b: nameOf(p.records[1]), d: F.num(p.distanceM, 0) }) };
      });
      out.push(issue('duplicate_proximity', proxIds,
        t('quality.issue.duplicateProximity.title', { m: F.int(Q.PROXIMITY_M) }),
        t('quality.issue.duplicateProximity.detail', {
          pairs: F.int(dupes.proximityPairs.length), m: F.int(Q.PROXIMITY_M),
          examples: examplesOf(proxItems) }),
        t('quality.issue.duplicateProximity.action'), proxItems,
        { pairs: dupes.proximityPairs }));
    }

    /* --- entity review (D7) ---------------------------------------------- */
    ['suspected_non_bc', 'name_quality'].forEach(function (flag) {
      var hit = rows.filter(function (r) { return r._meta && r._meta.entityReview === flag; });
      if (!hit.length) return;
      var key = flag === 'suspected_non_bc' ? 'suspectedNonBc' : 'nameQuality';
      var items = hit.map(function (r) {
        return { id: r.id, text: U.isKnown(r._meta.entityReviewNote)
          ? nameOf(r) + ' – ' + r._meta.entityReviewNote : nameOf(r) };
      });
      out.push(issue(flag, idsOf(hit),
        t('quality.issue.' + key + '.title'),
        t('quality.issue.' + key + '.detail',
          { n: F.int(hit.length), examples: examplesOf(items) }),
        t('quality.issue.' + key + '.action'), items));
    });

    /* --- contradictory values -------------------------------------------- */
    var conflicted = [], conflictedItems = [];
    rows.forEach(function (r) {
      var vc = Q.valueConflicts(r);
      if (!vc.length) return;
      conflicted.push(r);
      vc.forEach(function (c) {
        conflictedItems.push({ id: r.id, code: c.code,
          text: t('quality.issue.item.valueConflict', { name: nameOf(r), message: c.text }) });
      });
    });
    if (conflicted.length) {
      out.push(issue('value_conflict', idsOf(conflicted),
        t('quality.issue.valueConflict.title'),
        t('quality.issue.valueConflict.detail',
          { n: F.int(conflicted.length), examples: examplesOf(conflictedItems) }),
        t('quality.issue.valueConflict.action'), conflictedItems));
    }

    /* --- similar names, gated on proximity ------------------------------- */
    if (dupes.namePairs.length) {
      var nameIds = [], seenName = {};
      var nameItems = dupes.namePairs.map(function (p) {
        p.recordIds.forEach(function (id) {
          if (!seenName[id]) { seenName[id] = true; nameIds.push(id); }
        });
        return { ids: p.recordIds, why: p.why, text: t('quality.issue.item.namePair', {
          a: nameOf(p.records[0]), b: nameOf(p.records[1]), d: F.num(p.distanceM, 0),
          why: t('quality.issue.name.why.' + p.why, { n: F.int(Q.NAME_EDIT_MAX) }) }) };
      });
      out.push(issue('duplicate_name', nameIds,
        t('quality.issue.duplicateName.title'),
        t('quality.issue.duplicateName.detail', {
          pairs: F.int(dupes.namePairs.length), examples: examplesOf(nameItems) }),
        t('quality.issue.duplicateName.action'), nameItems,
        { pairs: dupes.namePairs }));
    }

    if (opts.severity) {
      out = out.filter(function (e) { return e.severity === opts.severity; });
    }
    return out;
  };

  /* =======================================================================
   * 8. THE VERIFICATION QUEUE (§50)
   *
   * THE SCORING RULE, stated so it can be argued with rather than guessed at.
   * Every term is a weight × a fact already recorded on the record; nothing is
   * inferred, and no term uses a value the dataset does not hold.
   *
   *   12 × missing critical fields (0–8)   0–96  the dominant term: a record
   *                                              with nothing recorded is the
   *                                              biggest single gap.
   *   30 × record is stale                       a published figure is now
   *                                              past its own refresh interval.
   *   12 × record is ageing                      due soon, worth batching into
   *                                              a trip that is happening anyway.
   *    8 × Low/Unknown-confidence commercial field   an advertised rent or class
   *                                              nobody has confirmed.
   *   25 × coordinates outside Tashkent          the record cannot be mapped or
   *                                              aggregated correctly at all.
   *   20 × district label conflicts with the boundary (D1)
   *   15 × unresolved duplicate suspicion (D6)   double-counts supply until ruled on.
   *   10 × suspected non-office entity (D7)
   *    5 × name needs checking (D7)
   *    6 × the record already carries commercial data  — the deliberate small
   *        bonus. A priced record is commercially material: its number is the
   *        one that ends up in a client deck, so keeping it current matters
   *        more than filling in a building nobody has quoted. It is +6 and not
   *        more because a bonus large enough to outrank a collection gap would
   *        turn the backlog into a re-verification loop over 16 records.
   *   +{High 0, Medium 5, Low 15, Unknown 20} for the record's weakest
   *        confidence, so a badly-sourced record outranks a well-sourced one
   *        at equal completeness.
   *
   * Where this lands on the seed, and it is the right place. Trilliant (141)
   * and Ventum plaza (136) lead — priced records that also carry a flag. The
   * other 14 priced records score 121, ahead of the 101 an empty record scores
   * on completeness alone, but behind the 126 of an empty record that ALSO has
   * an unresolved duplicate or an entity flag. That last ordering is deliberate:
   * an unadjudicated duplicate makes a supply figure wrong today, which is worse
   * than a rent one day from its refresh date. Re-checking a price protects a
   * number already in use, collecting an empty record creates a new one, and
   * resolving a duplicate corrects a number that is currently being published.
   * ===================================================================== */

  Q.QUEUE_WEIGHTS = {
    missingCriticalField: 12,
    stale: 30,
    ageing: 12,
    lowConfidenceField: 8,
    outOfBounds: 25,
    districtConflict: 20,
    unresolvedDuplicate: 15,
    suspectedNonBc: 10,
    nameQuality: 5,
    commerciallyMaterial: 6,
    recordConfidence: { High: 0, Medium: 5, Low: 15, Unknown: 20 }
  };

  /* Carrying any of these makes a record commercially material — it is the
     record a client would quote. */
  Q.PRICED_FIELDS = ['askingRent', 'serviceCharge', 'occupancyPct',
                     'vacancyPct', 'availableArea'];

  /**
   * verificationQueue(rows) -> [{ record, score, reasons[], fieldsToVerify[] }]
   * Ranked most-needed first. Nothing is hidden below a threshold: the whole
   * set is returned and the caller decides how much of it to show.
   */
  Q.verificationQueue = function (rows, opts) {
    opts = opts || {};
    var today = asOf(opts.today);
    var W = Q.QUEUE_WEIGHTS;
    // The duplicate index is O(n²); a caller that already has one passes it in.
    var dupeIds = unresolvedDuplicateIds(opts.duplicates || Q.duplicates(rows));

    var queue = rows.map(function (rec) {
      var comp = Q.completeness(rec);
      var fresh = Q.freshness(rec, today);
      var lowConf = Q.lowConfidenceFields(rec);
      var meta = rec._meta || {};
      var priced = Q.PRICED_FIELDS.some(function (k) { return U.isKnown(rec[k]); });
      var conf = D.recordConfidence(rec);

      var score = comp.missing.length * W.missingCriticalField;
      var reasons = [], fields = [], flags = {};

      if (comp.missing.length) {
        reasons.push(t('quality.queue.missing',
                       { n: F.int(comp.missing.length), m: F.int(comp.total) }));
        comp.missing.forEach(function (k) {
          fields.push({ field: k, label: S.label(k), action: 'collect',
                        reason: t('quality.queue.field.collect', { field: S.label(k) }) });
        });
        flags.missingCritical = comp.missing.length;
      }

      if (fresh.state === 'stale') {
        score += W.stale;
        flags.stale = true;
        reasons.push(t('quality.queue.stale', { date: F.date(fresh.lastVerifiedAt) }));
      } else if (fresh.state === 'ageing') {
        score += W.ageing;
        flags.ageing = true;
        reasons.push(t('quality.queue.reason.ageing',
                       { field: fresh.oldestFieldLabel, date: F.date(fresh.nextRefreshAt) }));
      }
      fresh.fields.forEach(function (f) {
        if (f.state !== 'stale' && f.state !== 'ageing') return;
        fields.push({ field: f.field, label: f.label, action: 'verify',
                      reason: t('quality.queue.field.verify',
                                { field: f.label, date: F.date(f.lastVerifiedAt) }) });
      });

      if (lowConf.length) {
        score += lowConf.length * W.lowConfidenceField;
        flags.lowConfidenceFields = lowConf.length;
        reasons.push(t('quality.queue.lowConfidence', {
          field: lowConf.map(function (k) { return S.label(k); }).join(', ') }));
        lowConf.forEach(function (k) {
          fields.push({ field: k, label: S.label(k), action: 'confirm',
                        reason: t('quality.queue.field.confirm', { field: S.label(k) }) });
        });
      }

      if (Q.outOfBounds(rec)) {
        score += W.outOfBounds;
        flags.outOfBounds = true;
        reasons.push(t('quality.queue.reason.bounds'));
      }
      if (meta.districtConflict) {
        score += W.districtConflict;
        flags.districtConflict = true;
        reasons.push(t('quality.queue.reason.conflict'));
      }
      if (dupeIds[rec.id]) {
        score += W.unresolvedDuplicate;
        flags.duplicate = true;
        reasons.push(t('quality.queue.duplicate'));
      }
      if (meta.entityReview === 'suspected_non_bc') {
        score += W.suspectedNonBc;
        flags.suspectedNonBc = true;
        reasons.push(t('quality.queue.reason.entity'));
      } else if (meta.entityReview === 'name_quality') {
        score += W.nameQuality;
        flags.nameQuality = true;
        reasons.push(t('quality.queue.reason.nameQuality'));
      }
      if (priced) {
        score += W.commerciallyMaterial;
        flags.commerciallyMaterial = true;
        reasons.push(t('quality.queue.reason.commercial'));
      }
      score += (W.recordConfidence[conf] !== undefined ? W.recordConfidence[conf] : 0);

      return {
        record: rec, id: rec.id, score: score, reasons: reasons, flags: flags,
        // §4.5: a record with nothing recorded needs COLLECTION, not a re-check.
        // The two land on different people, so the queue says which.
        nextAction: comp.missing.length ? 'collect' : 'verify',
        completeness: comp, freshness: fresh, confidence: conf,
        fieldsToVerify: dedupeFields(fields)
      };
    });

    queue.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      // Ties: the emptier record first, then by id so the order is stable
      // across renders and reproducible in the oracle.
      if (a.completeness.known !== b.completeness.known) {
        return a.completeness.known - b.completeness.known;
      }
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    return queue;
  };

  /* One row per field. Collecting a missing value outranks re-verifying a
     present one, which outranks confirming a weak source. */
  var ACTION_RANK = { collect: 0, verify: 1, confirm: 2 };

  function dedupeFields(fields) {
    var seen = {}, out = [];
    fields.forEach(function (f) {
      var prev = seen[f.field];
      if (prev === undefined) { seen[f.field] = out.length; out.push(f); return; }
      if (ACTION_RANK[f.action] < ACTION_RANK[out[prev].action]) out[prev] = f;
    });
    return out;
  }

  /* =======================================================================
   * 9. DATASET SUMMARY — the header data chip, with its own caveat (D8)
   * ===================================================================== */

  /* "Field-verified" means a first-hand check, not a second reading of the same
     listing. A field qualifies when its evidence method is one of these, or the
     record declares more than one source. On the shipped seed this is 0 — which
     is the §37 argument stated as a number instead of a claim. */
  Q.FIELD_VERIFICATION_METHODS = ['field visit', 'phone verification', 'owner/developer'];

  Q.isFieldVerified = function (rec) {
    if (rec._meta && rec._meta.sourceCount > 1) return true;
    var keys = Object.keys(rec._evidence || {});
    for (var i = 0; i < keys.length; i++) {
      if (!U.isKnown(rec[keys[i]])) continue;
      var ev = D.evidence(rec, keys[i]);
      if (ev && Q.FIELD_VERIFICATION_METHODS.indexOf(ev.method) >= 0) return true;
    }
    return false;
  };

  /**
   * datasetSummary(rows) -> the header chip line plus the numbers behind it.
   *
   * `stalenessDiscriminates` is the D8 disclosure and it is COMPUTED, never
   * asserted: it is false whenever the rows share a single verification date,
   * because then any threshold either flags all of them or none of them and the
   * stale count carries no information. The UI renders `stalenessNote` next to
   * the count whenever this is false.
   */
  Q.datasetSummary = function (rows, opts) {
    opts = opts || {};
    var today = asOf(opts.today);

    var sourceIds = {}, sourceNames = [], verifiedDates = {}, collectedDates = [];
    var latest = null, fieldVerified = 0, edited = 0, demo = 0;
    var states = { fresh: 0, ageing: 0, stale: 0, unknown: 0 };

    rows.forEach(function (r) {
      Object.keys(r._evidence || {}).forEach(function (k) {
        var ev = D.evidence(r, k);
        if (!ev) return;
        var key = ev.sourceId || ev.source;
        if (key && !sourceIds[key]) {
          sourceIds[key] = true;
          sourceNames.push(ev.source || key);
        }
      });

      var meta = r._meta || {};
      if (U.isKnown(meta.collectedAt)) {
        collectedDates.push(meta.collectedAt);
        if (!latest || meta.collectedAt > latest) latest = meta.collectedAt;
      }
      if (U.isKnown(meta.lastVerifiedAt)) verifiedDates[meta.lastVerifiedAt] = true;
      if (meta.editedLocally) edited++;
      if (r.recordType === 'DEMO') demo++;
      if (Q.isFieldVerified(r)) fieldVerified++;
      states[Q.freshness(r, today).state]++;
    });

    var distinctDates = Object.keys(verifiedDates);
    // One date across the whole set (or none) — the indicator cannot separate
    // these records, and the count alone would read as if it had.
    var discriminates = distinctDates.length > 1;
    var sharedDate = distinctDates.length === 1 ? distinctDates[0] : null;

    var sourceCount = sourceNames.length;
    var text = t('hdr.data.summary', {
      records: F.int(rows.length),
      sources: plural('common.count.sources', sourceCount, { n: F.int(sourceCount) }),
      date: F.date(latest),
      verified: F.int(fieldVerified)
    });
    if (edited) text += t('hdr.data.edited', { n: F.int(edited) });

    return {
      records: rows.length,
      sources: sourceCount,
      sourceNames: sourceNames,
      latestCollectedAt: latest,
      collectedDates: U.uniq(collectedDates).sort(),
      fieldVerified: fieldVerified,
      fieldVerifiedNote: fieldVerified ? null : t('quality.summary.fieldVerified.none'),
      editedLocally: edited,
      demo: demo,
      containsDemo: demo > 0,
      freshness: states,
      stale: states.stale,
      ageing: states.ageing,

      /* D8 — the honest flag and the sentence the UI must render beside the
         stale count whenever it is false. */
      stalenessDiscriminates: discriminates,
      distinctVerificationDates: distinctDates.length,
      stalenessNote: discriminates
        ? t('quality.summary.stalenessDiscriminates',
            { n: F.int(states.stale), m: F.int(rows.length) })
        : (sharedDate
            ? t('quality.freshness.note', {
                date: F.date(sharedDate),
                age: F.int(GEO.date.daysBetween(sharedDate, today)) })
            : t('quality.summary.noDates')),

      text: text,
      refreshIntervals: t('quality.freshness.intervals', {
        fast: F.int(S.refreshDays.fast), slow: F.int(S.refreshDays.slow),
        stable: F.int(S.refreshDays.stable) })
    };
  };
}(window));
