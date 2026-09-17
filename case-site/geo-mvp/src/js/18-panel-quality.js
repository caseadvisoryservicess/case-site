/* ===========================================================================
 * 18-panel-quality — Coverage · Quality · Duplicates (R8, §19, §37, §50)
 *
 * Three of the six tabs of the data workspace. 19-admin owns the other three
 * (Records, Local changes, Import/Export); the two files meet at `state.dataTab`
 * and at `#data-body`, and neither renders while the other's tab is selected.
 *
 * Six decisions worth knowing before reading the code.
 *
 * A. THIS IS THE HONEST HEART, SO NOTHING HERE IS FLATTERED.
 *    The Coverage tab exists to say, in the product's own voice, that this
 *    dataset knows where 148 buildings are and almost nothing about what they
 *    cost. 11% office-class coverage, 11% rent coverage, 0% for everything a
 *    commercial decision actually needs. The framing is "collection backlog",
 *    because that is what it is: a line item per bar, not a defect. A version
 *    of this tab that opened with a green tick would be the most expensive lie
 *    in the build (§37).
 *
 * B. THE WORKSPACE DESCRIBES THE DATASET, NOT THE MAP'S CURRENT FILTER.
 *    Every figure here is derived from `scope` — the unfiltered working set —
 *    because "148 records from 1 source" is a claim about the dataset, not about
 *    whatever the map is showing. When a filter IS active the difference is
 *    stated at the top rather than silently applied.
 *
 * C. AN INDICATOR THAT CANNOT SEPARATE ITS RECORDS SAYS SO, NEXT TO THE NUMBER.
 *    All observed records share one collection date, so no staleness threshold
 *    can discriminate between them: `datasetSummary().stalenessDiscriminates`
 *    is computed, not asserted, and its caveat is rendered beside the count and
 *    never in a footnote. The confidence split gets the same treatment when it
 *    collapses into one band. A number whose caveat is one scroll away is a
 *    number that will be quoted without it.
 *
 * D. A QUEUE'S CONTROL EITHER NARROWS THE MAP TO EXACTLY ITS RECORDS, OR SAYS
 *    WHY IT CANNOT (§29). The filter model has predicates for missing critical
 *    data, district conflicts, duplicate suspicion and suspected non-office
 *    entities — those buttons apply the filter and are exact. The duplicate
 *    queues route to the Duplicates tab, which is where their work is done. For
 *    out-of-bounds coordinates, contradictory values and placeholder names the
 *    filter model has no predicate at all: those buttons render `disabled` with
 *    the reason visible as text, and every record is still reachable one at a
 *    time from the queue's own list. No control here is inert and unexplained.
 *
 * E. DUPLICATES ARE REVIEWED OVER THE UNCOLLAPSED SET (D6).
 *    `workingSet()` drops the absorbed member of any group ruled `same building`,
 *    which is the whole point of the verdict — but it would also remove the group
 *    from this tab and trap the reviewer in their own decision. The Duplicates
 *    tab therefore reads `collapseDuplicates:false` and shows resolved groups too,
 *    with the effect of the verdict on the headline count derived from the
 *    collapsed `scope` rather than from a second copy of the collapsing rule.
 *
 * F. NOTHING DERIVED IS CACHED. The only things held between renders are a
 *    render signature (a string), two counters, a few view booleans and the
 *    chart container elements 10-charts mounts into. Every record, metric,
 *    queue and duplicate index is recomputed from `scope` on each draw, and the
 *    CSV exports recompute from live state rather than from what is on screen.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, Q = GEO.dom, el = Q.el, U = GEO.util, S = GEO.schema,
      F = GEO.fmt, A = GEO.analytics, QA = GEO.quality, D = GEO.data, t = GEO.i18n.t;

  var BODY = '#data-body';

  /* The tabs this module owns. 19-admin owns records | changes | io. */
  var MY_TABS = { coverage: true, quality: true, dupes: true };

  /* Strings this panel needs that the shipped table does not carry yet. They
     are written INTO `GEO.i18n.en` rather than kept in a private map, so D14
     still holds: one table, one lookup, one translator export. A key already
     defined in 01-i18n always wins — this never overwrites shipped copy. */
  var ADDED = {
    'quality.tab.coverage': 'Coverage',
    'quality.tab.quality': 'Quality',
    'quality.tab.dupes': 'Duplicates',
    'quality.scope.filtered': 'This workspace describes all {m} records in the dataset. The map filters are currently showing {n} of them; nothing on these three tabs is filtered.',
    'quality.scope.all': 'This workspace describes all {m} records currently in the dataset.',
    'quality.scope.demo': 'Demo records are on, so {n} synthetic records are included in every figure on this tab. They are badged wherever they appear.',

    /* ---- coverage tab ---- */
    'quality.coverage.lead': 'What this dataset knows, field by field. Every figure anywhere in the product is capped by these bars, and every "Insufficient verified data" elsewhere is one of them.',
    'quality.coverage.headline.title': 'Where the buildings are is known. What they cost is not.',
    'quality.coverage.headline.full': 'Recorded for all {m} records: {list}.',
    'quality.coverage.headline.partial': 'Recorded for some: {list}. The best covered is {field}, at {n} of {m} ({pct}).',
    'quality.coverage.headline.none': 'Nothing recorded at all for {n} of the {m} fields in the registry, including {list}.',
    'quality.coverage.headline.critical': 'Of the {k} critical fields a commercial decision needs, {a} carry any recorded value at all: {list}. The other {b} are recorded for no property in the dataset: {missing}.',
    'quality.coverage.headline.criticalNone': 'None of the {k} critical fields a commercial decision needs carries a recorded value for any property: {missing}.',
    'quality.coverage.headline.criticalItem': '{field} {n} of {m} ({pct})',
    'quality.coverage.headline.backlog': 'Read that as a collection backlog rather than a platform defect. Each bar below is a line item a field-collection programme would work through, in the order the verification backlog on the Quality tab ranks them.',
    'quality.coverage.stat.full': 'Fields recorded for every record',
    'quality.coverage.stat.partial': 'Fields recorded for some records',
    'quality.coverage.stat.empty': 'Fields with nothing recorded',
    'quality.coverage.stat.index': 'Critical-field coverage',
    'quality.coverage.stat.fields': 'Based on {m} fields in the registry.',
    'quality.coverage.index.cov': 'Based on {n} recorded values out of {m} possible – {k} critical fields across {r} records.',
    'quality.coverage.index.none': 'There are no records to measure, so there is no coverage to report.',
    'quality.coverage.notAFilter': 'These bars are a denominator, not a link. The filter model has no "records missing field X" predicate, so nothing here can narrow the map to exactly those records; the verification backlog on the Quality tab names them record by record instead.',
    'quality.coverage.chart.cov': 'Every bar is counted over all {m} records in the dataset. The hatched remainder of each bar is what is not recorded – it is shown, never dropped.',
    'quality.coverage.table.title': 'Coverage by field',
    'quality.coverage.col.field': 'Field',
    'quality.coverage.col.recorded': 'Recorded',
    'quality.coverage.col.pct': 'Share',
    'quality.coverage.col.critical': 'Critical',
    'quality.coverage.criticalNote': 'A critical field is one of the {m} the completeness band counts. They are the fields a commercial decision needs.',
    'quality.coverage.export': 'Export coverage (CSV)',
    'quality.coverage.exported': 'Coverage exported – {n} fields with their denominators',

    /* ---- provenance block ---- */
    'quality.sources.title': 'Dataset provenance',
    'quality.sources.lead': 'Every source behind this dataset: how it was collected, when it was retrieved, how many records it carries, and whether its licence has been reviewed for commercial use.',
    'quality.sources.col.source': 'Source',
    'quality.sources.col.method': 'Method',
    'quality.sources.col.retrieved': 'Retrieved',
    'quality.sources.col.records': 'Records',
    'quality.sources.col.licence': 'Licence review',
    'quality.sources.licence.required': 'Required – not yet done',
    'quality.sources.licence.cleared': 'Cleared',
    'quality.sources.licence.na': 'Not applicable',
    'quality.sources.licence.unknown': 'Not recorded',
    'quality.sources.licence.note': 'A licence review that has not been done is a commercial risk, not a formality: redistributing scraped listing data without one is the fastest way to lose the dataset this product is built on.',
    'quality.sources.schema': 'Schema version {v} · seed generated {date}',
    'quality.sources.empty.title': 'No sources are declared in this dataset.',
    'quality.sources.empty.body': 'Every record should name where it came from. A dataset with no declared source cannot be audited, and nothing in it can be defended to a client.',
    'quality.sources.fieldVerified': 'Fields re-checked against a second source or a first-hand method: {n} of {m} records.',

    /* ---- quality tab ---- */
    'quality.quality.lead': 'What can be stood behind, what cannot, and the queues a reviewer would work through. Each indicator states plainly where it cannot yet separate one record from another.',
    'quality.confidence.title': 'Confidence',
    'quality.confidence.noSpread': 'This indicator does not separate these records: all {m} fall in one band. Every observed record comes from one source collected in one pass, so record-level confidence carries no variance until a second source exists.',
    'quality.completeness.title': 'Completeness',
    'quality.freshness.title': 'Freshness',
    'quality.freshness.cannotSeparate': 'Staleness cannot separate these records yet – read the count as "all of them" or "none of them", not as a ranking.',
    'quality.split.share': '{n} of {m}',
    'quality.split.allRecords': 'Counted over all {m} records in the dataset; every record falls in exactly one band.',
    'quality.checks.title': 'Review queues',
    'quality.checks.summary': '{n} of {m} checks found something. Each queue is a real list of record ids, not a badge.',
    'quality.checks.clean.title': 'Checks that found nothing',
    'quality.checks.clean.body': 'These ran over all {m} records and returned no cases. That is a measured zero, not a check nobody ran.',
    'quality.checks.clean.row': '{title} – 0 records',
    'quality.issue.records': '{n} records',
    'quality.issue.why': 'Why it matters',
    'quality.issue.list': 'List the {n} records',
    'quality.issue.listGroups': 'List the {n} groups',
    'quality.issue.listPairs': 'List the {n} pairs',
    'quality.issue.hide': 'Hide the list',
    'quality.issue.openRecord': 'Open this record',
    'quality.issue.reviewDupes': 'Review these pairs',
    'quality.issue.supersetNote': 'The map filter covers all {n} records under any duplicate suspicion, which includes these {m}.',
    'quality.issue.noFilter': 'The filter model has no predicate for this check, so the map cannot be narrowed to exactly these records. Open them one at a time from the list.',
    'quality.issue.severity.serious': 'Serious',
    'quality.issue.severity.warn': 'Check',
    'quality.issue.severity.note': 'Note',
    'quality.issue.severity.label': 'Severity: {level}',

    'quality.why.missing_critical': 'Nothing is recorded for these beyond a name, a district and a point on the map. They cannot enter a rent, class, size or vacancy figure, so every market statistic in this product is computed over a fraction of the supply – and that fraction is what the coverage line under each figure reports.',
    'quality.why.coordinate_out_of_bounds': 'A point outside the city envelope falls in no district polygon, so the record is invisible to district aggregation, to radius analysis and to the competitive set. It quietly reduces a district count rather than raising an error.',
    'quality.why.duplicate_coordinate': 'Two records on one coordinate are one building counted twice. Until a verdict is recorded, every count, GLA and supply figure that includes them overstates the market.',
    'quality.why.district_conflict': 'District drives every chart, filter and rent benchmark in the product. Where the source label and the official boundary disagree, one of the two is publishing the wrong district rent – and the highest rent in this dataset is one of the ten.',
    'quality.why.duplicate_proximity': 'Pairs this close share a footprint, and the source never flagged them. They double-count supply exactly like the flagged groups do, and nothing outside this queue will find them.',
    'quality.why.suspected_non_bc': 'These names describe a firm rather than a building. Counted as supply they inflate the stock; deleted on suspicion they destroy a record nobody has checked. Flagged, they can be excluded from analytics with one toggle and the effect stated numerically.',
    'quality.why.value_conflict': 'Two recorded numbers that cannot both be true. A figure that contradicts its own neighbour will contradict a client fact-check just as fast.',
    'quality.why.duplicate_name': 'The same or nearly the same name, close together. Either one building was listed twice or two buildings share a brand – and the two mean opposite things for a supply count.',
    'quality.why.name_quality': 'A placeholder name identifies no building. It cannot be searched for, cannot be verified in the field, and cannot be matched against a client schedule.',

    'quality.tasks.title': 'Field-collection tasks',
    'quality.tasks.body': 'Turning a queue into assigned tasks needs somewhere to send them and someone to own them.',

    'quality.backlog.title': 'Verification backlog',
    'quality.backlog.lead': 'Every record ranked by how much one visit or one call would improve the dataset. This is the list a field-collection programme would actually work from, which is why it exports.',
    'quality.backlog.col.rank': '#',
    'quality.backlog.col.record': 'Record',
    'quality.backlog.col.score': 'Score',
    'quality.backlog.col.action': 'Next action',
    'quality.backlog.col.verify': 'What to verify',
    'quality.backlog.col.why': 'Why',
    'quality.backlog.action.collect': 'Collect',
    'quality.backlog.action.verify': 'Re-verify',
    'quality.backlog.showing': 'Showing the first {n} of {m}. The export carries all {m}.',
    'quality.backlog.showAll': 'Show all {n}',
    'quality.backlog.showFewer': 'Show the first {n} only',
    'quality.backlog.export': 'Export the backlog (CSV)',
    'quality.backlog.exported': 'Backlog exported – {n} records with their scores and reasons',
    'quality.backlog.scoring': 'Score = 12 per missing critical field, + 30 stale or 12 ageing, + 8 per weakly-sourced commercial field, + 25 coordinates out of bounds, + 20 district conflict, + 15 unresolved duplicate, + 10 suspected non-office, + 5 name needs checking, + 6 if the record already carries commercial data, plus 0 / 5 / 15 / 20 for High / Medium / Low / Not-verified confidence.',
    'quality.backlog.empty.title': 'Nothing is queued for verification.',
    'quality.backlog.empty.body': 'Every one of the {m} records has all {k} critical fields recorded, carries no flag and is inside its refresh interval.',

    /* ---- duplicates tab ---- */
    'quality.dupes.lead': 'Every candidate the three duplicate checks found, side by side, with what each source said. A verdict is recorded against both records; nothing is ever merged automatically.',
    'quality.dupes.pairs.one': '{n} possible duplicate pair',
    'quality.dupes.pairs.other': '{n} possible duplicate pairs',
    'quality.dupes.headline': '{records} records · {pairs} unresolved · counted as {counted}',
    'quality.dupes.headline.cov': 'Three checks over all {records} records: {g} source-flagged coordinate groups, {p} unflagged pairs under {d} m apart, {n} similar-name pairs – {total} candidates in all, of which {resolved} carry a verdict.',
    'quality.dupes.kind.coordinate': 'Flagged by the source – identical coordinates',
    'quality.dupes.kind.proximity': 'Found by coordinate proximity – under {m} m apart',
    'quality.dupes.kind.name': 'Similar names, close together – {why}',
    'quality.dupes.apart': '{d} m apart',
    'quality.dupes.sameSpot': 'Identical coordinates',
    'quality.dupes.said': 'What the source said',
    'quality.dupes.said.none': 'The source supplied no note for this record beyond the listing itself.',
    'quality.dupes.said.district': 'Source district label: {label}',
    'quality.dupes.verdict.aria': 'Verdict for {names}',
    'quality.dupes.verdict.mixed': 'The two records carry different verdicts. Record one for both.',
    'quality.dupes.recorded': 'Verdict recorded {date}',
    'quality.dupes.effect.same': 'Counted as one building: {kept} is kept and {dropped} is absorbed in every supply statistic.',
    'quality.dupes.effect.samePending': 'Ruled the same building. The collapse applies to the counted set on the next recompute.',
    'quality.dupes.effect.different': 'Counted as {n} separate buildings, which is what the verdict says they are.',
    'quality.dupes.effect.undecided': 'Counted as {n} separate records until a verdict is recorded – so supply figures may be counting one building twice.',
    'quality.dupes.empty.title': 'No duplicate candidates in this dataset.',
    'quality.dupes.empty.body': 'Three checks ran over all {m} records and found nothing: source-flagged coordinate groups, pairs under {d} m apart, and similar names within {g} m of each other.',
    'quality.dupes.verdictFailed': 'The verdict could not be saved for {name}.',
    'quality.dupes.demoNote': 'This candidate includes a DEMO record. A verdict on it changes nothing in the market statistics, which exclude demo records unless demo mode is on.'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.has(k, 'en')) GEO.i18n.en[k] = ADDED[k];
  });

  /* ------------------------------------------------------------- constants */

  /* A backlog of 148 rows is a scroll, not a briefing. The first slice is what
     a reviewer reads; the export is what they work from. */
  var BACKLOG_PAGE = 25;

  /* Records named inside one duplicate candidate card. Both sides always show. */
  var DUPE_FIELDS = ['officeClass', 'askingRent'];

  var VERDICTS = ['same_building', 'different_buildings', 'undecided'];
  var VERDICT_I18N = {
    same_building: 'value.verdict.same',
    different_buildings: 'value.verdict.different',
    undecided: 'value.verdict.undecided'
  };

  var CONF_I18N = { High: 'value.confidence.high', Medium: 'value.confidence.medium',
                    Low: 'value.confidence.low', Unknown: 'value.confidence.unknown' };
  var FRESH_I18N = { fresh: 'value.freshness.fresh', ageing: 'value.freshness.ageing',
                     stale: 'value.freshness.stale', unknown: 'value.freshness.unknown' };
  var METHOD_I18N = {
    'public website': 'value.method.website', 'owner/developer': 'value.method.owner',
    'broker': 'value.method.broker', 'field visit': 'value.method.fieldVisit',
    'phone verification': 'value.method.phone', 'public registry': 'value.method.registry',
    'map service': 'value.method.mapService', 'uploaded document': 'value.method.document',
    'manual edit (prototype)': 'value.method.manualEdit', 'other': 'value.method.other'
  };
  var LICENCE_I18N = { required: 'quality.sources.licence.required',
                       cleared: 'quality.sources.licence.cleared',
                       'n/a': 'quality.sources.licence.na' };

  /* Decision D. A queue's map control is only offered where the filter model can
     reproduce the queue exactly, or where it is an honestly-labelled superset.
     Everything absent from this table renders its button disabled with the
     reason on screen — never a button that quietly selects the wrong records. */
  var ISSUE_FILTER = {
    missing_critical:     { patch: { completeness: ['none'] }, exact: true },
    district_conflict:    { patch: { flags: ['districtConflict'] }, exact: true },
    suspected_non_bc:     { patch: { flags: ['suspectedNonBc'] }, exact: true },
    duplicate_coordinate: { patch: { flags: ['duplicate'] }, exact: false, dupes: true },
    duplicate_proximity:  { patch: { flags: ['duplicate'] }, exact: false, dupes: true },
    duplicate_name:       { patch: { flags: ['duplicate'] }, exact: false, dupes: true }
  };

  /* ------------------------------------------------- view bookkeeping only */
  /* `open` holds which disclosures the reader expanded, `backlogAll` whether the
     backlog is showing its first slice or all of it. No record, metric or queue
     is held here — those are recomputed from `scope` on every draw. */
  var ui = { open: {}, backlogAll: false };
  var mounts = {};
  /* Callbacks a tab queues to run AFTER its nodes are in the document. A chart
     mounted while its container is still detached measures zero width, and the
     resize observer then has to correct it on the next frame. */
  var afterAttach = [];
  var pane = null;
  var lastSig = null;
  var dataVersion = 0;
  var uiVersion = 0;

  /* ================================================================ labels */

  /* The i18n table is authoritative for a field's label; the schema registry is
     the fallback while a key is missing, so a label is never the raw key. */
  function fieldLabel(key) {
    if (GEO.i18n.has('field.' + key)) return t('field.' + key);
    return S.label(key);
  }

  function methodLabel(m) {
    if (!U.isKnown(m)) return F.UNKNOWN;
    return METHOD_I18N[m] ? t(METHOD_I18N[m]) : String(m);
  }

  function licenceLabel(v) {
    if (!U.isKnown(v)) return t('quality.sources.licence.unknown');
    return LICENCE_I18N[v] ? t(LICENCE_I18N[v]) : String(v);
  }

  function recordName(rec) {
    return U.isKnown(rec.name) ? rec.name : F.UNKNOWN;
  }

  /* Coordinates are fixed-decimal, never thousands-separated: `GEO.fmt.num`
     groups digits, and "41.29,970" is not a latitude. Four places is the
     precision the detail panel publishes, and the two must agree. */
  var COORD_DP = 4;

  function coordText(rec) {
    if (!U.isKnown(rec.lat) || !U.isKnown(rec.lng)) return F.UNKNOWN;
    return t('detail.coords', { lat: Number(rec.lat).toFixed(COORD_DP),
                                lng: Number(rec.lng).toFixed(COORD_DP) });
  }

  /* ============================================================== fragments */

  /** §2.3 / visual-system §4: a confidence dot NEVER appears without its word. */
  function confChip(level) {
    var key = CONF_I18N[level] || CONF_I18N.Unknown;
    var label = level === 'Unknown' ? t(key) : t('quality.confidence.dotLabel', { level: t(key) });
    return el('span.conf', { 'data-conf': level }, [
      el('span.conf__dot', { 'aria-hidden': 'true' }),
      el('span.conf__label', { text: label })
    ]);
  }

  function freshChip(state) {
    return el('span.fresh', { 'data-fresh': state }, [
      el('span.fresh__dot', { 'aria-hidden': 'true' }),
      el('span', { text: t(FRESH_I18N[state] || FRESH_I18N.unknown) })
    ]);
  }

  /** D4 — a DEMO record is badged everywhere it appears, without exception. */
  function demoBadge(rec) {
    if (rec.recordType !== 'DEMO') return null;
    return el('span.badge.badge--demo', { text: t('common.demo.badge') });
  }

  function classBadge(rec) {
    var cls = U.isKnown(rec.officeClass) ? rec.officeClass : null;
    return el('span.badge.badge--class', {
      dataset: { class: cls || 'unknown' },
      'aria-label': cls ? cls : t('value.class.unknown'),
      text: cls || '?'
    });
  }

  /** Severity is carried by a word first and a colour second — the status scale
      sits below the 3:1 mark floor by design, and the label is the mitigation. */
  function severityChip(sev) {
    /* The word carries the severity; `data-sev` is the hook a stylesheet can
       colour later. It is never a dot on its own — the status scale sits below
       the 3:1 mark floor by design and the label is the mitigation (visual §4). */
    return el('span.badge.badge--flag.dq-sev', {
      dataset: { sev: sev },
      'aria-label': t('quality.issue.severity.label', { level: t('quality.issue.severity.' + sev) }),
      text: t('quality.issue.severity.' + sev)
    });
  }

  function coverageLine(text) { return el('p.coverage', { text: text }); }

  function sectionTitle(text) { return el('h3.sectitle', { text: text }); }

  function card(kids) { return el('section.card.stack', {}, kids); }

  function emptyState(title, body, actions) {
    return el('div.empty', {}, [
      el('p.empty__title', { text: title }),
      el('p.empty__body', { text: body }),
      actions && actions.length ? el('div.empty__actions', {}, actions) : null
    ]);
  }

  /**
   * The one place a figure is turned into a tile. When `sufficient` is false the
   * VALUE is replaced by the words and the reason; the denominator line below it
   * always survives, because the denominator is the explanation (§36, E-06).
   */
  function statTile(m) {
    var insufficient = m.sufficient === false;
    return el('div.stat' + (insufficient ? '.stat--insufficient' : ''), {}, [
      el('span.stat__label', { text: m.label }),
      el('span.stat__value', { text: insufficient ? t('common.insufficient') : m.display }),
      insufficient && m.reason ? el('span.reason', { text: m.reason }) : null,
      m.coverageText ? el('span.coverage.stat__cov', { text: m.coverageText }) : null,
      m.containsDemo ? el('span.badge.badge--demo.stat__demo', { text: t('common.demo.badge') }) : null
    ]);
  }

  /**
   * Every table here is wider than a phone: `.tbl` headers do not wrap, and the
   * backlog carries six columns. The table therefore scrolls inside its own box
   * rather than scrolling the workspace sideways — a horizontal scrollbar on the
   * page is the 375px failure the build contract names. The inline overflow is
   * the floor, so the behaviour does not depend on a stylesheet rule that has
   * not been written yet; `.dq-scroll` is the hook for when it is.
   */
  function tableOf(headCells, bodyRows, caption) {
    return el('div.dq-scroll', { style: 'overflow-x:auto;max-width:100%' }, [
      el('table.tbl.tbl--zebra', {}, [
        caption ? el('caption', { text: caption }) : null,
        el('thead', {}, [el('tr', {}, headCells.map(function (h) {
          return el('th', { scope: 'col', 'class': h.num ? 'tbl__num' : null, text: h.text });
        }))]),
        el('tbody', {}, bodyRows)
      ])
    ]);
  }

  /** A disclosure whose open/closed state is view bookkeeping, not app state. */
  function disclosure(id, label, hideLabel, countText, bodyFn) {
    var open = !!ui.open[id];
    return el('div.disc', { dataset: { open: open ? 'true' : 'false' } }, [
      el('button.disc__hd', {
        type: 'button', 'aria-expanded': open ? 'true' : 'false',
        onclick: function () { ui.open[id] = !ui.open[id]; redraw(); }
      }, [
        el('span', { text: open ? hideLabel : label }),
        countText ? el('span.disc__count', { text: countText }) : null
      ]),
      el('div.disc__wrap', {}, [
        el('div.disc__body', {}, open ? bodyFn() : [])
      ])
    ]);
  }

  /* ================================================================ actions */

  function fitPatch(state, extra) {
    var p = Object.assign({
      overlay: null,
      leftRail: 'open',
      leftTab: 'results',
      map: { fitToken: state.map.fitToken + 1 }
    }, extra || {});
    return p;
  }

  /**
   * Narrow the map to a queue. Filters are RESET first and then the queue's
   * predicate applied: intersecting a review queue with whatever the user last
   * filtered by would show a subset of the queue while the button claims the
   * whole of it.
   */
  function showOnMap(patch, summary) {
    var state = GEO.state.get();
    var filters = Object.assign({}, GEO.state.defaults().filters, patch);
    GEO.state.set(fitPatch(state, { filters: filters }),
                  { source: 'user', action: 'quality:showOnMap', summary: summary });
  }

  function openRecord(id) {
    GEO.state.set({ selectedId: id, rightRail: 'open', rightTab: 'property', overlay: null },
                  { source: 'user', action: 'quality:openRecord',
                    summary: 'Opened ' + id + ' from the data quality queue' });
  }

  function goToTab(tab) {
    GEO.state.set({ dataTab: tab }, { source: 'user', action: 'data:tab', summary: 'Data workspace: ' + tab });
  }

  /**
   * D6. The verdict is metadata, and `GEO.data.update` refuses `_` keys by design
   * (metadata is not a user-editable field). So the flag is set on the live record
   * and the repository is then told about it with an empty patch, which is what
   * registers the record as locally changed, writes the persisted diff — the diff
   * covers `_meta`, so the verdict survives a reload — and broadcasts
   * `data:changed`. `lastVerifiedAt` is passed back in unchanged: recording an
   * opinion about two records is not a re-verification of their contents, and
   * letting it stamp today's date would quietly reset the freshness clock.
   * If a later data layer grows a first-class API, it wins.
   */
  function writeVerdict(ids, verdict) {
    var failed = [], changed = 0;
    ids.forEach(function (id) {
      var rec = D.get(id);
      if (!rec) return;
      if (typeof D.setDuplicateVerdict === 'function') {
        var out = D.setDuplicateVerdict(id, verdict);
        if (out && out.ok) changed++; else failed.push(rec);
        return;
      }
      var meta = rec._meta || (rec._meta = {});
      var before = meta.duplicateVerdict || 'undecided';
      if (before === verdict) return;
      var keepVerified = meta.lastVerifiedAt;
      meta.duplicateVerdict = verdict;
      meta.duplicateVerdictAt = GEO.date.today();
      var res = D.update(id, {}, { lastVerifiedAt: keepVerified });
      if (res && res.ok) { changed++; return; }
      meta.duplicateVerdict = before;       // nothing half-applies
      delete meta.duplicateVerdictAt;
      failed.push(rec);
    });
    if (failed.length) {
      GEO.boot.toast(t('quality.dupes.verdictFailed', { name: recordName(failed[0]) }));
      return;
    }
    if (!changed) return;                   // already at this verdict
    GEO.boot.toast(t('toast.verdictSaved'));
    /* `D.update` emits `data:changed`, which 99-boot turns into a render, so the
       headline count and the queues update without this panel pushing a patch. */
  }

  /* ==================================================================== CSV */

  function csvCell(v) {
    if (!U.isKnown(v)) return '';
    var s = Array.isArray(v) ? v.join('; ') : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csvHead(titleText, scope) {
    return [
      '# ' + GEO.PRODUCT.name + ' – ' + titleText + ' – ' + GEO.date.today(),
      '# Records: ' + F.int(scope.length) + (D.containsDemo(scope) ? ' (INCLUDES SYNTHETIC DEMO RECORDS)' : ''),
      '# Blank cells mean NOT RECORDED. They do not mean zero.',
      '# Source: ' + D.sources().map(function (s) { return s.name; }).join(' | ')
    ].join('\n');
  }

  function exportCoverage(scope) {
    var rows = A.fieldCoverage(scope);
    var cols = ['field_key', 'field_label', 'critical', 'recorded_n', 'records_N', 'share', 'coverage_sentence'];
    var body = rows.map(function (r) {
      return [r.key, r.label, r.critical ? 'yes' : 'no', r.n, r.N,
              F.num(r.pct * 100, 1) + '%', F.coverage(r.n, r.N, F.lower(r.label))]
        .map(csvCell).join(',');
    });
    GEO.boot.download(csvHead(t('quality.coverage.table.title'), scope) + '\n' + cols.join(',') + '\n' + body.join('\n'),
                      'geo-mvp-coverage-' + GEO.date.today() + '.csv', 'text/csv');
    GEO.boot.toast(t('quality.coverage.exported', { n: F.int(rows.length) }));
  }

  /**
   * §50. The deliverable a field-collection programme would work from: one row
   * per record, ranked, with the score, the action, the fields and the reasons.
   * Recomputed from live state rather than read off the screen, so an export can
   * never be one edit older than the panel.
   */
  function exportBacklog(scope) {
    var queue = QA.verificationQueue(scope);
    var cols = ['rank', 'id', 'name', 'district', 'record_type', 'score', 'next_action',
                'confidence', 'completeness_band', 'critical_known', 'critical_total',
                'freshness', 'last_verified', 'fields_to_verify', 'reasons'];
    var body = queue.map(function (q, i) {
      var rec = q.record;
      return [
        i + 1, rec.id, rec.name, D.districtName(rec.districtKey), rec.recordType,
        q.score, q.nextAction, q.confidence, q.completeness.band,
        q.completeness.known, q.completeness.total,
        q.freshness.state, (rec._meta || {}).lastVerifiedAt,
        q.fieldsToVerify.map(function (f) { return f.action + ':' + f.field; }).join('; '),
        q.reasons.join('; ')
      ].map(csvCell).join(',');
    });
    GEO.boot.download(csvHead(t('quality.backlog.title'), scope) + '\n' +
                      '# ' + t('quality.backlog.scoring') + '\n' +
                      cols.join(',') + '\n' + body.join('\n'),
                      'geo-mvp-verification-backlog-' + GEO.date.today() + '.csv', 'text/csv');
    GEO.boot.toast(t('quality.backlog.exported', { n: F.int(queue.length) }));
  }

  /* ========================================================== COVERAGE TAB */

  function mountFor(id) {
    if (!mounts[id]) mounts[id] = el('div', { dataset: { chart: id } });
    return mounts[id];
  }

  /** Decision A: the sentence a reader should leave this tab with, derived –
   *  never a fixed string that could outlive the numbers it describes. */
  function coverageHeadline(cov, scope) {
    var N = scope.length;
    var full = cov.filter(function (r) { return r.N > 0 && r.n === r.N; });
    var partial = cov.filter(function (r) { return r.n > 0 && r.n < r.N; });
    var none = cov.filter(function (r) { return r.n === 0; });

    var lines = [];
    if (full.length) {
      lines.push(t('quality.coverage.headline.full', {
        m: F.int(N), list: full.map(function (r) { return r.label; }).join(', ') }));
    }
    if (partial.length) {
      // `fieldCoverage` is sorted by share descending, so the first partial row
      // is the best-covered field that is not complete.
      var best = partial[0];
      lines.push(t('quality.coverage.headline.partial', {
        list: partial.map(function (r) { return r.label; }).join(', '),
        field: best.label, n: F.int(best.n), m: F.int(best.N),
        pct: F.pct(best.pct * 100, 0) }));
    }
    if (none.length) {
      lines.push(t('quality.coverage.headline.none', {
        n: F.int(none.length), m: F.int(cov.length),
        list: none.slice(0, 6).map(function (r) { return r.label; }).join(', ') }));
    }

    /* The commercial half of the story, stated over the critical fields rather
       than over the whole registry: "11% or 0%" is the sentence this tab exists
       to make, and it is derived so it cannot outlive the numbers. */
    var crit = cov.filter(function (r) { return r.critical; });
    var critHas = crit.filter(function (r) { return r.n > 0; });
    var critNone = crit.filter(function (r) { return r.n === 0; });
    if (crit.length) {
      lines.push(critHas.length
        ? t('quality.coverage.headline.critical', {
            k: F.int(crit.length), a: F.int(critHas.length), b: F.int(critNone.length),
            list: critHas.map(function (r) {
              return t('quality.coverage.headline.criticalItem', {
                field: r.label, n: F.int(r.n), m: F.int(r.N), pct: F.pct(r.pct * 100, 0) });
            }).join(', '),
            missing: critNone.map(function (r) { return r.label; }).join(', ') })
        : t('quality.coverage.headline.criticalNone', {
            k: F.int(crit.length),
            missing: critNone.map(function (r) { return r.label; }).join(', ') }));
    }

    lines.push(t('quality.coverage.headline.backlog'));

    var demo = D.containsDemo(scope);

    return card([
      el('h3', { text: t('quality.coverage.headline.title') }),
      el('div.stack', {}, lines.map(function (line) { return el('p', { text: line }); })),
      /* D4 – every figure computed over a set that includes synthetic records
         says so on the figure, not only in the banner. */
      el('div.stats', {}, [
        statTile({ label: t('quality.coverage.stat.full'), display: F.int(full.length),
                   coverageText: t('quality.coverage.stat.fields', { m: F.int(cov.length) }),
                   containsDemo: demo }),
        statTile({ label: t('quality.coverage.stat.partial'), display: F.int(partial.length),
                   coverageText: t('quality.coverage.stat.fields', { m: F.int(cov.length) }),
                   containsDemo: demo }),
        statTile({ label: t('quality.coverage.stat.empty'), display: F.int(none.length),
                   coverageText: t('quality.coverage.stat.fields', { m: F.int(cov.length) }),
                   containsDemo: demo }),
        criticalIndexTile(scope)
      ])
    ]);
  }

  function criticalIndexTile(scope) {
    var idx = QA.coverageIndex(scope);
    return statTile({
      containsDemo: D.containsDemo(scope),
      label: t('quality.coverage.stat.index'),
      display: idx.value === null ? F.UNKNOWN : F.pct(idx.value * 100, 0),
      sufficient: idx.total > 0,
      reason: idx.total > 0 ? null : t('quality.coverage.index.none'),
      coverageText: t('quality.coverage.index.cov', {
        n: F.int(idx.known), m: F.int(idx.total),
        k: F.int(idx.fieldsPerRecord), r: F.int(idx.N) })
    });
  }

  function coverageTable(cov) {
    var body = cov.map(function (r) {
      return el('tr', {}, [
        el('th', { scope: 'row', 'class': 'tbl__rowhd', text: r.label }),
        el('td.tbl__num', { text: t('analytics.chart.ofTotal', { n: F.int(r.n), m: F.int(r.N) }) }),
        el('td.tbl__num', { text: F.pct(r.pct * 100, 0) }),
        el('td', { text: r.critical ? t('analytics.chart.yes') : '' })
      ]);
    });
    return tableOf([
      { text: t('quality.coverage.col.field') },
      { text: t('quality.coverage.col.recorded'), num: true },
      { text: t('quality.coverage.col.pct'), num: true },
      { text: t('quality.coverage.col.critical') }
    ], body, t('quality.coverage.table.title'));
  }

  function sourcesBlock(scope) {
    var sources = D.sources();
    var meta = D.seedMeta();
    var ds = QA.datasetSummary(scope);

    if (!sources.length) {
      return card([
        sectionTitle(t('quality.sources.title')),
        emptyState(t('quality.sources.empty.title'), t('quality.sources.empty.body'))
      ]);
    }

    var body = sources.map(function (s) {
      return el('tr', {}, [
        el('th', { scope: 'row', 'class': 'tbl__rowhd' }, [
          el('div', { text: U.isKnown(s.name) ? s.name : F.UNKNOWN }),
          U.isKnown(s.note) ? el('div.micro', { text: s.note }) : null,
          U.isKnown(s.url) ? el('div.micro', { text: s.url }) : null
        ]),
        el('td', { text: methodLabel(s.method) }),
        el('td', { text: F.date(s.retrievedAt) }),
        el('td.tbl__num', { text: U.isKnown(s.recordCount) ? F.int(s.recordCount) : F.UNKNOWN }),
        el('td', { text: licenceLabel(s.licenceReview) })
      ]);
    });

    return card([
      sectionTitle(t('quality.sources.title')),
      el('p', { text: t('quality.sources.lead') }),
      tableOf([
        { text: t('quality.sources.col.source') },
        { text: t('quality.sources.col.method') },
        { text: t('quality.sources.col.retrieved') },
        { text: t('quality.sources.col.records'), num: true },
        { text: t('quality.sources.col.licence') }
      ], body),
      el('p.reason', { text: t('quality.sources.licence.note') }),
      el('p.coverage', { text: t('quality.sources.schema', {
        v: meta.schemaVersion, date: F.date(meta.generatedAt) }) }),
      el('p.coverage', { text: t('quality.sources.fieldVerified', {
        n: F.int(ds.fieldVerified), m: F.int(ds.records) }) }),
      ds.fieldVerifiedNote ? el('p.reason', { text: ds.fieldVerifiedNote }) : null
    ]);
  }

  function drawCoverage(state, rows, scope) {
    var cov = A.fieldCoverage(scope);
    var host = mountFor('coverage');

    /* 10-charts owns the pixels and keeps its instance alive across redraws, so
       the container is a module singleton that gets re-attached rather than a
       fresh div per render (which would orphan an observer every time). The
       mount itself waits until the pane is in the document – see `afterAttach`.
       If the chart cannot be drawn at all the table below carries the same
       numbers, which is the honest failure of a chart. */
    afterAttach.push(function () {
      if (!GEO.charts || !GEO.charts.coverageBars) return;
      try {
        GEO.charts.coverageBars(host, {
          key: 'dq-coverage',
          rows: cov,
          title: t('analytics.chart.coverage'),
          sub: t('quality.coverage.lead'),
          coverageText: t('quality.coverage.chart.cov', { m: F.int(scope.length) }),
          note: t('analytics.chart.criticalNote')
        });
      } catch (e) {
        GEO.log.error('coverage chart failed – the table below carries the same numbers', e);
        Q.fill(host, []);
      }
    });

    return [
      el('p', { text: t('quality.coverage.lead') }),
      coverageHeadline(cov, scope),
      card([host, el('p.reason', { text: t('quality.coverage.notAFilter') })]),
      card([
        coverageTable(cov),
        el('p.reason', { text: t('quality.coverage.criticalNote', { m: F.int(S.criticalFields.length) }) }),
        el('div.row', {}, [
          el('button.btn.btn--quiet', { type: 'button', text: t('quality.coverage.export'),
            onclick: function () { exportCoverage(GEO.boot.scope(GEO.state.get())); } })
        ])
      ]),
      sourcesBlock(scope)
    ];
  }

  /* =========================================================== QUALITY TAB */

  /** One row of a split: label, count over the denominator, and a bar whose
   *  zero state is a hatched track rather than an absent mark (visual §5). */
  function splitRow(labelNode, n, N) {
    var share = N > 0 ? n / N : 0;
    return el('div.covrow', {}, [
      el('div', {}, [labelNode]),
      el('div.covrow__n', { text: t('quality.split.share', { n: F.int(n), m: F.int(N) }) }),
      el('div.covrow__bar', { dataset: { zero: n === 0 ? 'true' : 'false' } }, [
        n > 0 ? el('div.covrow__fill', { style: 'width:' + Math.round(share * 100) + '%' }) : null
      ])
    ]);
  }

  function confidenceBlock(scope) {
    var cs = QA.confidenceSummary(scope);
    var spread = cs.order.filter(function (k) { return cs.counts[k] > 0; }).length;
    return card([
      sectionTitle(t('quality.confidence.title')),
      el('div', {}, cs.order.map(function (level) {
        return splitRow(confChip(level), cs.counts[level], cs.N);
      })),
      coverageLine(cs.text),
      /* Decision C – the caveat sits beside the number, not in a footnote. */
      spread <= 1 ? el('p.reason', { text: t('quality.confidence.noSpread', { m: F.int(cs.N) }) }) : null,
      el('p.reason', { text: t('quality.confidence.legend') }),
      el('ul.stack', {}, [
        el('li', { text: t('quality.confidence.identity') }),
        el('li', { text: t('quality.confidence.claims') }),
        el('li', { text: t('quality.confidence.district') })
      ])
    ]);
  }

  function completenessBlock(scope) {
    var bands = QA.completenessBands(scope);
    return card([
      sectionTitle(t('quality.completeness.title')),
      el('div', {}, bands.order.map(function (b) {
        return splitRow(el('span', { text: QA.bandLabel(b) }), bands.counts[b], bands.N);
      })),
      coverageLine(t('quality.split.allRecords', { m: F.int(bands.N) })),
      el('p.reason', { text: t('quality.completeness.explain', { m: F.int(S.criticalFields.length) }) })
    ]);
  }

  function freshnessBlock(scope) {
    var ds = QA.datasetSummary(scope);
    var order = ['fresh', 'ageing', 'stale', 'unknown'];
    return card([
      sectionTitle(t('quality.freshness.title')),
      el('div', {}, order.map(function (k) {
        return splitRow(freshChip(k), ds.freshness[k] || 0, ds.records);
      })),
      coverageLine(t('quality.split.allRecords', { m: F.int(ds.records) })),
      /* D8 – the disclosure is COMPUTED, and it is rendered against the counts
         it qualifies rather than at the bottom of the tab. */
      ds.stalenessDiscriminates
        ? el('p.coverage', { text: ds.stalenessNote })
        : el('div.insufficient', {}, [
            el('p.insufficient__title', { text: t('quality.freshness.cannotSeparate') }),
            el('p.insufficient__why', { text: ds.stalenessNote })
          ]),
      el('p.reason', { text: ds.refreshIntervals })
    ]);
  }

  /* --------------------------------------------------------- issue queues */

  /* 04-quality composes each queue's sentences from the shipped string table, and
     three of those keys declare a variable the caller does not pass: `{examples}`
     on two details, `{district}` on the missing-critical item, `{m}` on the pair
     item. `t()` deliberately leaves an unresolved token VISIBLE so the gap is
     findable – right for a log, wrong for a panel a client reads. So the tokens
     are stripped for display and every fact they would have carried is rebuilt
     here from the record, group or pair that 04-quality already hands over. The
     upstream gap stays in `GEO.log`, where it belongs, instead of on screen. */
  var TOKEN = /\s*\{\w+\}/g;
  var EDGE = /^[\s\u2014\u2013\u00b7,:;-]+|[\s\u2014\u2013\u00b7,:;-]+$/g;

  function safeText(str) {
    if (!U.isKnown(str)) return '';
    return String(str).replace(TOKEN, '').replace(/\s{2,}/g, ' ').replace(EDGE, '');
  }

  /* A record name is scraped data: it can be 50 characters of Cyrillic. `.btn`
     is `white-space: nowrap`, which would push the card past the viewport at
     375px, so every button whose label is DATA rather than UI copy wraps. */
  var WRAP = 'white-space:normal;text-align:left;min-width:0';

  function openButton(rec) {
    return el('button.btn.btn--quiet.btn--sm', {
      type: 'button', style: WRAP, text: recordName(rec),
      'aria-label': t('quality.issue.openRecord') + ' – ' + recordName(rec),
      onclick: function () { openRecord(rec.id); }
    });
  }

  function verifiedLine(rec) {
    return el('span.coverage', { text: t('detail.quality.verified',
      { date: F.date((rec._meta || {}).lastVerifiedAt) }) });
  }

  /** Both sides of a duplicate candidate, each openable, with the distance that
   *  made it a candidate – the fact the shipped item string drops. */
  function pairRow(records, distanceM, why) {
    var bits = [distanceM < 1 ? t('quality.dupes.sameSpot')
                              : t('quality.dupes.apart', { d: F.num(distanceM, 0) })];
    if (why) bits.push(why);
    var names = [];
    records.forEach(function (rec) {
      if (names.length) names.push(el('span.sep', { text: '·' }));
      names.push(openButton(rec));
      var badge = demoBadge(rec);
      if (badge) names.push(badge);
    });
    return el('div.qrow', {}, [
      el('div.stack', {}, [
        el('div.row', {}, names),
        el('span.micro', { text: bits.join(' · ') })
      ])
    ]);
  }

  function issueItems(e) {
    if (e.groups) {
      return e.groups.map(function (g) { return pairRow(g.records, g.maxDistanceM, null); });
    }
    if (e.pairs) {
      return e.pairs.map(function (p) {
        return pairRow(p.records, p.distanceM, p.why
          ? t('quality.issue.name.why.' + p.why, { n: F.int(QA.NAME_EDIT_MAX) })
          : null);
      });
    }
    return e.items.map(function (it) {
      var id = it.id || (it.ids && it.ids[0]) || null;
      var rec = id ? D.get(id) : null;
      var text = safeText(it.text);
      if (!rec) return el('div.qrow', {}, [el('span', { text: text })]);
      var facts = [D.districtName(rec.districtKey), QA.completeness(rec).text];
      return el('div.qrow', {}, [
        el('div.stack', {}, [
          el('div.row', {}, [openButton(rec), demoBadge(rec), classBadge(rec)]),
          text && text !== recordName(rec) ? el('span.micro', { text: text }) : null,
          el('span.micro', { text: facts.join(' · ') }),
          verifiedLine(rec)
        ])
      ]);
    });
  }

  /**
   * One queue. Decision D decides which of the three control shapes it gets, and
   * every shape states what it does – including the disabled one.
   */
  function issueCard(e, scope) {
    var map = ISSUE_FILTER[e.type];
    var controls = [];
    var notes = [];

    if (map && map.dupes) {
      // Their work is adjudication, not map-reading: send the reviewer to the tab
      // that records verdicts, and offer the map filter as the secondary route.
      controls.push(el('button.btn.btn--primary.btn--sm', {
        type: 'button', text: t('quality.issue.reviewDupes'),
        onclick: function () { goToTab('dupes'); }
      }));
    }

    if (map) {
      var filters = Object.assign({}, GEO.state.defaults().filters, map.patch);
      var hits = GEO.filters ? GEO.filters.apply(scope, filters).length : e.n;
      controls.push(el('button.btn' + (map.dupes ? '.btn--quiet' : '.btn--primary') + '.btn--sm', {
        type: 'button', text: e.action,
        onclick: function () { showOnMap(map.patch, e.title); }
      }));
      if (!map.exact) {
        notes.push(t('quality.issue.supersetNote', { n: F.int(hits), m: F.int(e.n) }));
      }
    } else {
      // §29: no silent no-op. The button is present, disabled, and the reason is
      // adjacent text rather than a tooltip nobody can reach from a keyboard.
      controls.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: e.action, disabled: true,
        title: t('quality.issue.noFilter')
      }));
      notes.push(t('quality.issue.noFilter'));
    }

    var listN = e.groups ? e.groups.length : (e.pairs ? e.pairs.length : e.items.length);
    var listLabel = e.groups ? t('quality.issue.listGroups', { n: F.int(listN) })
                  : e.pairs  ? t('quality.issue.listPairs',  { n: F.int(listN) })
                             : t('quality.issue.list',       { n: F.int(listN) });

    return el('section.card.stack', { 'aria-label': e.title }, [
      el('div.row', {}, [
        severityChip(e.severity),
        el('h4', { text: e.title }),
        el('span.chip.push', {}, [
          el('span.chip__label', { text: t('quality.issue.records', { n: F.int(e.n) }) })
        ])
      ]),
      el('p', { text: safeText(e.detail) }),
      el('div', {}, [
        el('div.sectitle', { text: t('quality.issue.why') }),
        el('p', { text: t('quality.why.' + e.type) })
      ]),
      el('div.row', {}, controls),
      notes.length ? el('p.reason', { text: notes.join(' ') }) : null,
      listN
        ? disclosure('issue:' + e.type, listLabel, t('quality.issue.hide'),
                     F.int(listN), function () { return issueItems(e); })
        : null
    ]);
  }

  function issueTitleFor(type) {
    /* The titles 04-quality gives a populated queue, so a queue that found
       nothing is named with exactly the same words as one that did. */
    var KEYS = {
      missing_critical: 'quality.issue.missingCritical.title',
      coordinate_out_of_bounds: 'quality.issue.outOfBounds.title',
      duplicate_coordinate: 'quality.issue.duplicateCoordinate.title',
      district_conflict: 'quality.conflict.title',
      duplicate_proximity: 'quality.issue.duplicateProximity.title',
      suspected_non_bc: 'quality.issue.suspectedNonBc.title',
      value_conflict: 'quality.issue.valueConflict.title',
      duplicate_name: 'quality.issue.duplicateName.title',
      name_quality: 'quality.issue.nameQuality.title'
    };
    var key = KEYS[type];
    if (!key) return type;
    return type === 'duplicate_proximity'
      ? t(key, { m: F.int(QA.PROXIMITY_M) })
      : t(key);
  }

  /**
   * The checks that returned nothing. `Q.issues` only returns populated queues,
   * so without this the reader cannot tell "we looked and found none" from "we
   * never looked" – and out-of-bounds coordinates (0 at seed) would vanish.
   */
  function cleanChecksBlock(found, scope) {
    var clean = QA.ISSUE_TYPES.filter(function (d) { return !found[d.type]; });
    if (!clean.length) return null;
    return card([
      sectionTitle(t('quality.checks.clean.title')),
      el('p', { text: t('quality.checks.clean.body', { m: F.int(scope.length) }) }),
      el('ul.stack', {}, clean.map(function (d) {
        return el('li.row', {}, [
          severityChip(d.severity),
          el('span', { text: t('quality.checks.clean.row', { title: issueTitleFor(d.type) }) })
        ]);
      }))
    ]);
  }

  function issuesBlock(scope, dupes) {
    var issues = QA.issues(scope, { duplicates: dupes });
    var found = {};
    issues.forEach(function (e) { found[e.type] = true; });

    var kids = [
      el('div.row', {}, [
        sectionTitle(t('quality.checks.title')),
        el('span.push.coverage', { text: t('quality.checks.summary', {
          n: F.int(issues.length), m: F.int(QA.ISSUE_TYPES.length) }) })
      ])
    ];

    if (!issues.length) {
      kids.push(emptyState(t('empty.quality'),
        t('quality.checks.clean.body', { m: F.int(scope.length) })));
    } else {
      issues.forEach(function (e) { kids.push(issueCard(e, scope)); });
    }

    kids.push(cleanChecksBlock(found, scope));

    // D-15 / §50 – present, disabled, and honest about what it would need.
    kids.push(card([
      sectionTitle(t('quality.tasks.title')),
      el('p', { text: t('quality.tasks.body') }),
      el('button.btn.btn--quiet', {
        type: 'button', disabled: true, text: t('quality.queue.createTasks'),
        title: t('quality.queue.createTasks.disabled')
      }),
      el('p.reason', { text: t('quality.queue.createTasks.disabled') })
    ]));

    return el('div.stack.stack--lg', {}, kids);
  }

  /* ------------------------------------------------- verification backlog */

  function backlogBlock(scope, dupes) {
    var queue = QA.verificationQueue(scope, { duplicates: dupes });

    if (!queue.length) {
      return card([
        sectionTitle(t('quality.backlog.title')),
        emptyState(t('quality.backlog.empty.title'),
                   t('quality.backlog.empty.body', {
                     m: F.int(scope.length), k: F.int(S.criticalFields.length) }))
      ]);
    }

    var shown = ui.backlogAll ? queue : queue.slice(0, BACKLOG_PAGE);
    var body = shown.map(function (q, i) {
      var rec = q.record;
      return el('tr', {}, [
        el('td.tbl__num', { text: F.int(i + 1) }),
        el('th', { scope: 'row', 'class': 'tbl__rowhd' }, [
          el('button.btn.btn--quiet.btn--sm', {
            type: 'button', style: WRAP, text: recordName(rec),
            'aria-label': t('quality.issue.openRecord') + ' – ' + recordName(rec),
            onclick: function () { openRecord(rec.id); }
          }),
          el('div.row.row--tight', {}, [
            demoBadge(rec),
            classBadge(rec),
            el('span.micro', { text: D.districtName(rec.districtKey) })
          ]),
          el('div', {}, [confChip(q.confidence)]),
          el('div.coverage', { text: t('detail.quality.verified', {
            date: F.date((rec._meta || {}).lastVerifiedAt) }) })
        ]),
        el('td.tbl__num', { text: F.int(q.score) }),
        el('td', {}, [
          el('span', { text: q.nextAction === 'collect'
            ? t('quality.backlog.action.collect') : t('quality.backlog.action.verify') }),
          el('div.micro', { text: q.completeness.text })
        ]),
        el('td', {}, [
          el('ul', {}, q.fieldsToVerify.slice(0, 8).map(function (f) {
            return el('li.micro', { text: f.reason });
          })),
          q.fieldsToVerify.length > 8
            ? el('div.micro', { text: t('quality.issue.examples.more',
                { n: F.int(q.fieldsToVerify.length - 8) }) })
            : null
        ]),
        el('td.qrow__why', { text: q.reasons.join(' · ') })
      ]);
    });

    return card([
      sectionTitle(t('quality.backlog.title')),
      el('p', { text: t('quality.backlog.lead') }),
      tableOf([
        { text: t('quality.backlog.col.rank'), num: true },
        { text: t('quality.backlog.col.record') },
        { text: t('quality.backlog.col.score'), num: true },
        { text: t('quality.backlog.col.action') },
        { text: t('quality.backlog.col.verify') },
        { text: t('quality.backlog.col.why') }
      ], body),
      coverageLine(F.coverage(queue.length, scope.length, 'a verification score')),
      queue.length > BACKLOG_PAGE
        ? el('p.coverage', { text: t('quality.backlog.showing', {
            n: F.int(shown.length), m: F.int(queue.length) }) })
        : null,
      el('div.row', {}, [
        queue.length > BACKLOG_PAGE ? el('button.btn.btn--quiet.btn--sm', {
          type: 'button',
          text: ui.backlogAll
            ? t('quality.backlog.showFewer', { n: F.int(BACKLOG_PAGE) })
            : t('quality.backlog.showAll', { n: F.int(queue.length) }),
          onclick: function () { ui.backlogAll = !ui.backlogAll; redraw(); }
        }) : null,
        el('button.btn.btn--primary.btn--sm', {
          type: 'button', text: t('quality.backlog.export'),
          onclick: function () { exportBacklog(GEO.boot.scope(GEO.state.get())); }
        })
      ]),
      el('p.reason', { text: t('quality.backlog.scoring') })
    ]);
  }

  function drawQuality(state, rows, scope) {
    /* The duplicate index is the expensive part (O(n²)). Both the queues and the
       backlog need it, so it is built once here and handed to both. */
    var dupes = QA.duplicates(scope);
    return [
      el('p', { text: t('quality.quality.lead') }),
      confidenceBlock(scope),
      completenessBlock(scope),
      freshnessBlock(scope),
      issuesBlock(scope, dupes),
      backlogBlock(scope, dupes)
    ];
  }

  /* ======================================================== DUPLICATES TAB */

  /** Every candidate in one shape, so the card is written once. */
  function candidates(dupes) {
    var out = [];
    dupes.coordinateGroups.forEach(function (g) {
      out.push({ id: 'grp:' + g.groupId, kind: 'coordinate', records: g.records,
                 ids: g.recordIds, distanceM: g.maxDistanceM,
                 kindText: t('quality.dupes.kind.coordinate') });
    });
    dupes.proximityPairs.forEach(function (p) {
      out.push({ id: 'prx:' + p.recordIds.join('+'), kind: 'proximity', records: p.records,
                 ids: p.recordIds, distanceM: p.distanceM,
                 kindText: t('quality.dupes.kind.proximity', { m: F.int(QA.PROXIMITY_M) }) });
    });
    dupes.namePairs.forEach(function (p) {
      out.push({ id: 'nam:' + p.recordIds.join('+'), kind: 'name', records: p.records,
                 ids: p.recordIds, distanceM: p.distanceM,
                 kindText: t('quality.dupes.kind.name', {
                   why: t('quality.issue.name.why.' + p.why, { n: F.int(QA.NAME_EDIT_MAX) }) }) });
    });
    return out;
  }

  function verdictOf(rec) { return (rec._meta || {}).duplicateVerdict || 'undecided'; }

  /** One verdict for the candidate, or null when its records disagree. */
  function candidateVerdict(c) {
    var seen = U.uniq(c.records.map(verdictOf));
    return seen.length === 1 ? seen[0] : null;
  }

  function verdictDate(c) {
    var dates = c.records.map(function (r) { return (r._meta || {}).duplicateVerdictAt; })
                         .filter(function (d) { return U.isKnown(d); });
    return dates.length ? dates.sort()[dates.length - 1] : null;
  }

  /** What the source said about this record, in the source's own words. */
  function sourceSaid(rec) {
    var meta = rec._meta || {};
    var lines = [];
    ['name', 'address', 'officeClass', 'askingRent'].forEach(function (k) {
      if (!U.isKnown(rec[k])) return;
      var ev = D.evidence(rec, k);
      if (!ev) return;
      lines.push(fieldLabel(k) + ' – ' + (U.isKnown(ev.source) ? ev.source : F.UNKNOWN) +
                 ' · ' + methodLabel(ev.method) +
                 (U.isKnown(ev.note) ? ' · ' + ev.note : ''));
    });
    if (U.isKnown(meta.districtSourceLabel)) {
      lines.push(t('quality.dupes.said.district', { label: meta.districtSourceLabel }));
    }
    if (U.isKnown(meta.sourceNote)) lines.push(meta.sourceNote);
    if (!lines.length) lines.push(t('quality.dupes.said.none'));
    return lines;
  }

  function dupeRecordCard(rec) {
    var meta = rec._meta || {};
    var kv = [];

    function row(label, valueNode) {
      kv.push(el('div.kv__row', {}, [
        el('span.kv__k', { text: label }),
        typeof valueNode === 'string'
          ? el('span.kv__v' + (valueNode === F.UNKNOWN ? '.unk' : ''), { text: valueNode })
          : el('span.kv__v', {}, [valueNode])
      ]));
    }

    row(fieldLabel('address'), U.isKnown(rec.address) ? rec.address : F.UNKNOWN);
    row(fieldLabel('districtKey'), D.districtName(rec.districtKey));
    row(t('field.coordinates'), coordText(rec));
    DUPE_FIELDS.forEach(function (k) {
      var v = rec[k];
      if (!U.isKnown(v)) { row(fieldLabel(k), F.UNKNOWN); return; }
      row(fieldLabel(k), k === 'askingRent' ? F.rent(v) : String(v));
    });

    /* A grid item's default `min-width: auto` is min-content, so one long
       address would widen the whole card rather than wrapping inside it. */
    return el('div.stack', { style: 'min-width:0;overflow-wrap:anywhere' }, [
      el('div.row', {}, [openButton(rec), demoBadge(rec), classBadge(rec)]),
      el('div.micro', { text: rec.id }),
      el('div.kv', {}, kv),
      el('div', {}, [confChip(D.recordConfidence(rec))]),
      el('div.coverage', { text: t('detail.quality.verified', { date: F.date(meta.lastVerifiedAt) }) }),
      el('div', {}, [
        el('div.sectitle', { text: t('quality.dupes.said') }),
        el('ul', {}, sourceSaid(rec).map(function (line) {
          return el('li.micro', { text: line });
        }))
      ])
    ]);
  }

  /** The effect of the recorded verdict on the counted set, read off the counted
   *  set itself rather than from a second copy of the collapsing rule. */
  function verdictEffect(c, verdict, inScope) {
    if (verdict === 'same_building') {
      var kept = c.records.filter(function (r) { return inScope[r.id]; });
      var dropped = c.records.filter(function (r) { return !inScope[r.id]; });
      if (kept.length && dropped.length) {
        return t('quality.dupes.effect.same', {
          kept: kept.map(recordName).join(', '),
          dropped: dropped.map(recordName).join(', ') });
      }
      return t('quality.dupes.effect.samePending');
    }
    if (verdict === 'different_buildings') {
      return t('quality.dupes.effect.different', { n: F.int(c.records.length) });
    }
    return t('quality.dupes.effect.undecided', { n: F.int(c.records.length) });
  }

  /* `.seg__btn` is the shipped segmented control, but it is 28px high and a
     verdict is a decision a reviewer commits to – it gets the full 32px target
     (44px at touch widths, where `--hit` changes under it). The chosen verdict
     is carried by `aria-pressed` and by the filled button, and again in words by
     the "Verdict recorded" line beside it, so it never depends on fill alone. */
  function verdictControl(c) {
    var current = candidateVerdict(c);
    var names = c.records.map(recordName).join(' / ');
    return el('div.row.row--tight', {
      role: 'group', 'aria-label': t('quality.dupes.verdict.aria', { names: names })
    }, VERDICTS.map(function (v) {
      var on = current === v;
      return el('button.btn.btn--sm' + (on ? '.btn--primary' : '.btn--quiet'), {
        type: 'button',
        'aria-pressed': on ? 'true' : 'false',
        text: t(VERDICT_I18N[v]),
        onclick: function () { writeVerdict(c.ids, v); }
      });
    }));
  }

  function dupeCard(c, inScope) {
    var verdict = candidateVerdict(c);
    var when = verdictDate(c);
    var hasDemo = c.records.some(function (r) { return r.recordType === 'DEMO'; });

    return el('section.dupe', { 'aria-label': c.records.map(recordName).join(' / ') }, [
      el('div.row', {}, [
        el('span.chip', { style: 'white-space:normal;min-width:0' },
           [el('span.chip__label', { style: 'white-space:normal;overflow:visible',
                                     text: c.kindText })]),
        el('span.micro', {
          text: c.distanceM < 1
            ? t('quality.dupes.sameSpot')
            : t('quality.dupes.apart', { d: F.num(c.distanceM, 0) })
        })
      ]),
      el('div.dupe__pair', {}, c.records.map(dupeRecordCard)),
      el('div.dupe__verdict', {}, [
        el('span.sectitle', { text: t('quality.dupes.verdict') }),
        verdictControl(c),
        verdict && verdict !== 'undecided' && when
          ? el('span.micro', { text: t('quality.dupes.recorded', { date: F.date(when) }) })
          : null
      ]),
      verdict === null ? el('p.reason', { text: t('quality.dupes.verdict.mixed') }) : null,
      el('p.coverage', { text: verdictEffect(c, verdict || 'undecided', inScope) }),
      hasDemo ? el('p.reason', { text: t('quality.dupes.demoNote') }) : null
    ]);
  }

  function drawDupes(state, rows, scope) {
    /* Decision E – reviewed over the UNCOLLAPSED set so a verdict can be revised,
       while the headline "counted as" figure comes from the collapsed scope. */
    var review = D.workingSet({
      demoMode: state.demoMode,
      excludeSuspectedNonBc: state.excludeSuspectedNonBc,
      collapseDuplicates: false
    });
    var dupes = QA.duplicates(review);
    var list = candidates(dupes);

    var inScope = {};
    scope.forEach(function (r) { inScope[r.id] = true; });

    var unresolved = list.filter(function (c) {
      var v = candidateVerdict(c);
      return v === null || v === 'undecided';
    });
    var resolved = list.length - unresolved.length;

    var head = card([
      el('h3', { text: t('quality.dupes.headline', {
        records: F.int(review.length),
        pairs: GEO.i18n.plural('quality.dupes.pairs', unresolved.length,
                               { n: F.int(unresolved.length) }),
        counted: F.int(scope.length) }) }),
      coverageLine(t('quality.dupes.headline.cov', {
        records: F.int(review.length),
        g: F.int(dupes.coordinateGroups.length),
        d: F.int(QA.PROXIMITY_M),
        p: F.int(dupes.proximityPairs.length),
        n: F.int(dupes.namePairs.length),
        total: F.int(list.length),
        resolved: F.int(resolved) })),
      el('p', { text: t('quality.dupes.lead') }),
      el('p.reason', { text: t('quality.dupes.note') })
    ]);

    if (!list.length) {
      return [head, card([emptyState(
        t('quality.dupes.empty.title'),
        t('quality.dupes.empty.body', {
          m: F.int(review.length), d: F.int(QA.PROXIMITY_M),
          g: F.int(QA.NAME_GATE_M.identical) }))])];
    }

    return [head].concat(list.map(function (c) { return dupeCard(c, inScope); }));
  }

  /* ================================================================ render */

  var DRAW = { coverage: drawCoverage, quality: drawQuality, dupes: drawDupes };
  var TAB_LABEL = { coverage: 'quality.tab.coverage', quality: 'quality.tab.quality',
                    dupes: 'quality.tab.dupes' };

  function scopeNote(state, rows, scope) {
    var kids = [];
    if (rows.length !== scope.length) {
      kids.push(el('p.coverage', { text: t('quality.scope.filtered', {
        m: F.int(scope.length), n: F.int(rows.length) }) }));
    } else {
      kids.push(el('p.coverage', { text: t('quality.scope.all', { m: F.int(scope.length) }) }));
    }
    var demoN = scope.filter(function (r) { return r.recordType === 'DEMO'; }).length;
    if (demoN) {
      kids.push(el('p.reason', { text: t('quality.scope.demo', { n: F.int(demoN) }) }));
    }
    return el('div', {}, kids);
  }

  /** My pane inside `#data-body`, created once so the chart containers it holds
   *  keep their 10-charts instances across redraws. */
  function ensurePane() {
    if (!pane) pane = el('div.dq.stack.stack--lg', { role: 'tabpanel', tabindex: '-1' });
    return pane;
  }

  function detach() {
    if (pane && pane.parentNode) pane.parentNode.removeChild(pane);
    lastSig = null;
  }

  function draw(state, rows, scope) {
    var body = Q.$(BODY);
    if (!body) return;
    var node = ensurePane();

    /* `#data-body` is shared with 19-admin. Whichever module owns the selected
       tab clears the pane the other left behind, so a stale panel can never sit
       under the live one; each module only ever builds inside its OWN element. */
    Array.prototype.slice.call(body.children).forEach(function (child) {
      if (child !== node) body.removeChild(child);
    });
    if (node.parentNode !== body) body.appendChild(node);

    afterAttach = [];
    node.setAttribute('aria-label', t(TAB_LABEL[state.dataTab] || 'quality.title'));
    var kids = DRAW[state.dataTab](state, rows, scope);
    Q.fill(node, [scopeNote(state, rows, scope)].concat(kids));

    var queued = afterAttach;
    afterAttach = [];
    queued.forEach(function (fn) {
      try { fn(); }
      catch (e) { GEO.log.error('18-panel-quality: deferred mount failed', e); }
    });
  }

  /** A view toggle is not app state, so it redraws this pane instead of pushing
   *  a patch that would re-render every panel in the app. */
  function redraw() {
    uiVersion += 1;
    lastSig = null;
    var s = GEO.state.get();
    if (s.overlay !== 'data' || !MY_TABS[s.dataTab]) return;
    draw(s, GEO.boot.visible(s), GEO.boot.scope(s));
  }

  function signature(state, rows, scope) {
    return [state.overlay, state.dataTab, state.bp, state.role,
            state.demoMode, state.excludeSuspectedNonBc,
            scope.length, rows.length, dataVersion, uiVersion, GEO.i18n.locale].join('|');
  }

  function render(state, rows, scope) {
    /* The overlay's tablist is shell chrome shared with 19-admin. Writing
       `aria-selected` from state is idempotent – both modules would write the
       same value – and without it the selected tab is only visible as a colour. */
    if (state.overlay === 'data') {
      Q.$$('#overlay-data [data-datatab]').forEach(function (b) {
        b.setAttribute('aria-selected', b.dataset.datatab === state.dataTab ? 'true' : 'false');
      });
    }

    if (state.overlay !== 'data' || !MY_TABS[state.dataTab]) { detach(); return; }

    var sig = signature(state, rows, scope);
    if (sig === lastSig) return;
    lastSig = sig;

    draw(state, rows, scope);
  }

  /* An edit arrives as an empty patch that 99-boot re-broadcasts, and a locale
     change arrives outside state entirely, so neither shows up in the signature.
     Both force exactly one redraw. */
  GEO.on('data:changed', function () { dataVersion += 1; lastSig = null; });
  GEO.on('i18n:locale', function () { dataVersion += 1; lastSig = null; });

  /* ---------------------------------------------------------- tab wiring */
  /* The six sub-tab buttons live in the shell, and both 18 and 19 need them to
     work. The guard makes the wiring idempotent whichever module gets there
     first: a second listener would fire a second identical `set()` and cost a
     second render for one click. */
  function wireTabs() {
    var tabs = Q.$('#overlay-data .overlay__tabs');
    if (!tabs || tabs.dataset.wired === '1') return;
    tabs.dataset.wired = '1';
    Q.on(tabs, 'click', '[data-datatab]', function (e, btn) {
      goToTab(btn.dataset.datatab);
    });
  }

  /* `99-boot.js` is LAST in the manifest and opens with `GEO.boot = {}`, so at
     panel-load time `GEO.boot.registerPanel` does not exist yet. DOMContentLoaded
     is the seam: every inline script has run by then, and because this listener
     is added while 18 loads – before 99-boot adds its own – registration lands
     before `B.start()` subscribes the renderer. */
  function registerWithBoot() {
    if (!GEO.boot || !GEO.boot.registerPanel) return false;
    GEO.boot.registerPanel(render);
    wireTabs();
    return true;
  }

  if (!registerWithBoot()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (!registerWithBoot()) {
          GEO.log.error('18-panel-quality: GEO.boot.registerPanel is unavailable – ' +
                        'the Coverage, Quality and Duplicates tabs will not render');
        }
      });
    } else {
      setTimeout(function () {
        if (!registerWithBoot()) {
          GEO.log.error('18-panel-quality: GEO.boot.registerPanel is unavailable – ' +
                        'the Coverage, Quality and Duplicates tabs will not render');
        }
      }, 0);
    }
  }
}(window));
