/* ===========================================================================
 * 14-panel-detail — the Property tab (R5 · brief §13, §19)
 *
 * This is the panel that has to prove the product's data-quality claim, so
 * provenance is not a footnote here — it is the subject. Three rules shape
 * every decision below:
 *
 *   §36  Unknown is `null` and renders as GEO.fmt.UNKNOWN. A measured zero
 *        (`vacancyPct: 0`) renders as `0%` in the full-weight numeral style;
 *        an unknown renders as "Not recorded" in `.unk`. The two never look
 *        alike, because the whole argument for this platform collapses the
 *        first time a reader mistakes one for the other.
 *   §2.3 Every field that HOLDS a value carries a provenance affordance. Not
 *        a tooltip — a real control that opens source, URL, method, confidence,
 *        collection date, last verified, computed next refresh, QC status and
 *        the collector's note.
 *   §29  No fake controls. `Open source` is the canonical case: all 148 seed
 *        records have `sourceUrl: null`, so the control renders disabled with
 *        its reason in the flow rather than as a dead link.
 *
 * The section list is generated from GEO.schema.groups / fieldsIn(group), so a
 * field added to the registry appears here with its label, unit, formatting and
 * provenance button already wired. There is no second list of fields.
 *
 * DOM contract with 15/16/17: this module owns `#pane-property` and nothing
 * else. It publishes one empty mount node, `#prop-location`, for the location
 * analysis block; module 17 renders into it. `Analyze location` here only
 * writes `state.radius` — it draws nothing.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, el = Q.el, F = GEO.fmt, S = GEO.schema;
  var t = GEO.i18n.t;

  var PANE = '#pane-property';
  var LOCATION_MOUNT_ID = 'prop-location';
  var ZOOM_TO = 16;                       // P-09 / L-24 both zoom to z16
  var COORD_DP = 4;                       // P-04: "41.3110, 69.2800"

  /* ---------------------------------------------------------- string table */
  /* D14 says 100 % of user-visible strings live in ONE table. These are the
     keys this panel needs that `01-i18n.js` does not ship yet, so they are
     written INTO that table rather than kept locally — the coverage check, the
     translator export and the missing-key lint all keep seeing every string.
     The guard makes this block a no-op the moment the keys are folded into
     01-i18n.js, so there is never a second definition of one string. */
  var ADDED = {
    /* P-03 pre-fills a question the engine can actually answer. The shipped
       `detail.ask.prefill` ("Tell me about {name}") matches no entry in the
       21-ai-intents catalogue and would land on "That question was not
       recognised", which turns a working control into a dead end (§29). This
       phrasing hits the `competitors` intent, which is also what P-03 specifies. */
    'detail.ask.prefill.competitors': 'Show competitors within {km} km of {name}',

    /* The qcStatus vocabulary. `detail.provenance.qc` (the row label) ships;
       its four values do not. */
    'value.qc.unreviewed': 'Not reviewed',
    'value.qc.needsCheck': 'Needs checking',
    'value.qc.accepted': 'Accepted',
    'value.qc.rejected': 'Rejected',

    /* The shipped `quality.freshness.dueIn` / `.overdue` have no plural forms,
       and the number this panel prints most often is 1: the whole observed set
       is 59 days old against a 60-day interval, so the headline reads "Due in
       1 days" everywhere. These are the `.one`/`.other` pair the i18n plural
       accessor expects; the singular-only keys should be retired in favour of
       them rather than left as a second definition. */
    'quality.freshness.dueIn.one': 'Due in {n} day',
    'quality.freshness.dueIn.other': 'Due in {n} days',
    'quality.freshness.overdue.one': 'Overdue by {n} day',
    'quality.freshness.overdue.other': 'Overdue by {n} days',
    'detail.editedLocally.one': '{n} field edited locally — not verified',
    'detail.editedLocally.other': '{n} fields edited locally — not verified'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.en[k]) GEO.i18n.en[k] = ADDED[k];
  });

  /* ------------------------------------------------------------ enum → key */
  /* Data values are never machine-translated (IA §9.3 rule 5), but ENUM values
     are UI vocabulary, not data, so each one has a string key. A value the
     table has never seen is printed verbatim: it is better to show an
     untranslated token than to swallow a value the registry grew. */
  var ENUM_KEYS = {
    officeClass: { 'A+': 'value.class.aPlus', 'A': 'value.class.a', 'B+': 'value.class.bPlus',
                   'B': 'value.class.b', 'C': 'value.class.c' },
    status: { 'Operating': 'value.status.operating', 'Under construction': 'value.status.construction',
              'Planned': 'value.status.planned', 'Renovation': 'value.status.renovation' },
    confidence: { High: 'value.confidence.high', Medium: 'value.confidence.medium',
                  Low: 'value.confidence.low', Unknown: 'value.confidence.unknown' },
    method: { 'public website': 'value.method.website', 'owner/developer': 'value.method.owner',
              'broker': 'value.method.broker', 'field visit': 'value.method.fieldVisit',
              'phone verification': 'value.method.phone', 'public registry': 'value.method.registry',
              'map service': 'value.method.mapService', 'uploaded document': 'value.method.document',
              'manual edit (prototype)': 'value.method.manualEdit', 'other': 'value.method.other' },
    qcStatus: { unreviewed: 'value.qc.unreviewed', needs_check: 'value.qc.needsCheck',
                accepted: 'value.qc.accepted', rejected: 'value.qc.rejected' },
    collectionStatus: { not_collected: 'value.collection.notCollected', partial: 'value.collection.partial',
                        complete: 'value.collection.complete', confirmed_empty: 'value.collection.confirmedEmpty' },
    entityReview: { unreviewed: 'value.entity.unreviewed', confirmed_bc: 'value.entity.confirmedBc',
                    suspected_non_bc: 'value.entity.suspectedNonBc', name_quality: 'value.entity.nameQuality' },
    recordType: { VERIFIED_SOURCE: 'value.recordType.verified', DEMO: 'value.recordType.demo' },
    completeness: { none: 'value.completeness.none', minimal: 'value.completeness.minimal',
                    partial: 'value.completeness.partial', good: 'value.completeness.good' },
    freshness: { fresh: 'value.freshness.fresh', ageing: 'value.freshness.ageing',
                 stale: 'value.freshness.stale', unknown: 'value.freshness.unknown' },
    amenity: { 'restaurant': 'value.amenity.restaurant', 'cafe': 'value.amenity.cafe',
               'retail': 'value.amenity.retail', 'gym': 'value.amenity.gym',
               'conference room': 'value.amenity.conference', 'reception': 'value.amenity.reception',
               'security': 'value.amenity.security', 'underground parking': 'value.amenity.undergroundParking',
               'surface parking': 'value.amenity.surfaceParking', 'EV charging': 'value.amenity.evCharging',
               'bicycle parking': 'value.amenity.bicycleParking', 'backup generator': 'value.amenity.generator' },
    tenantIndustry: { 'Financial services': 'value.industry.financial', 'IT & software': 'value.industry.it',
                      'Professional services': 'value.industry.professional', 'Energy': 'value.industry.energy',
                      'Transport & logistics': 'value.industry.transport', 'Wholesale & retail': 'value.industry.retail',
                      'Government & public': 'value.industry.government', 'Healthcare': 'value.industry.healthcare',
                      'Education': 'value.industry.education', 'Manufacturing': 'value.industry.manufacturing',
                      'Telecoms & media': 'value.industry.telecoms', 'Other': 'value.industry.other' }
  };

  /* Group key → section heading. A group the registry grows without a string
     key falls back to its own registry label rather than disappearing. */
  var GROUP_KEYS = {
    identification: 'detail.section.overview',
    property: 'detail.section.building',
    commercial: 'detail.section.commercial',
    tenants: 'detail.section.tenants',
    amenities: 'detail.section.amenities'
  };

  /* Sections open on first view (P-07). Everything else starts collapsed with
     its filled-field count in the header, so the panel opens on the facts. */
  var OPEN_BY_DEFAULT = { metrics: true, identification: true, quality: true };

  /* The §13 key-metric row, in the order the brief lists it. */
  var METRICS = ['gla', 'gba', 'floors', 'askingRent', 'occupancyPct', 'vacancyPct', 'parkingSpaces'];

  function enumLabel(enumKey, value) {
    var map = ENUM_KEYS[enumKey];
    var key = map ? map[value] : null;
    return key ? t(key) : String(value);
  }

  function fieldLabel(key) {
    return GEO.i18n.has('field.' + key) ? t('field.' + key) : S.label(key);
  }

  /* ---------------------------------------------------- section open state */
  /* Disclosure state is a per-viewer UI preference, not application data, so it
     does not belong in GEO.state and it is not a cached record. It is persisted
     so that a tester who always wants Commercial open is not re-collapsing it
     on every selection. */
  var sections = GEO.storage.get('detail.sections', {}) || {};

  function isOpen(id) {
    return sections[id] === undefined ? !!OPEN_BY_DEFAULT[id] : !!sections[id];
  }

  function setOpen(id, open) {
    sections[id] = !!open;
    GEO.storage.set('detail.sections', sections);
  }

  /* -------------------------------------------------------------- formatting */
  function unitLabel(unit) {
    if (unit === 'm²') return t('unit.sqm');
    if (unit === '%') return t('unit.pct');
    if (unit === 'USD/m²/month') return t('unit.usdSqmMonth');
    if (unit === 'spaces/m²') return t('unit.spacesPerSqm');
    return unit;
  }

  /**
   * One value, formatted for display.
   * Returns { known, text, numeric }. `known` is the §36 discriminator and is
   * the ONLY thing the renderer uses to decide between the numeral style and
   * the "Not recorded" style — never a truthiness test on the value, which
   * would turn a measured zero into a gap.
   */
  function display(rec, fd) {
    var v = rec[fd.key];
    if (!U.isKnown(v)) return { known: false, text: F.UNKNOWN, numeric: false };

    switch (fd.type) {
      case 'district':
        return { known: true, text: GEO.data.districtName(v), numeric: false };
      case 'enum':
        return { known: true, text: enumLabel(fd.enumKey, v), numeric: false };
      case 'year':
        // A year is an identifier, not a quantity: 2022, never "2,022".
        return { known: true, text: String(v), numeric: true };
      case 'coord':
        return { known: true, text: coordNum(v, 6), numeric: true };
      case 'integer':
        return { known: true, text: F.int(v), numeric: true };
      case 'number':
        return { known: true, text: numberText(v, fd), numeric: true };
      case 'textList':
        return { known: true, text: v.join(', '), numeric: false };
      case 'enumList':
        return { known: true,
                 text: v.map(function (x) { return enumLabel(fd.enumKey, x); }).join(', '),
                 numeric: false };
      case 'tenantList':
        return { known: true,
                 text: v.map(function (x) { return x && x.name ? x.name : F.UNKNOWN; }).join(', '),
                 numeric: false };
      default:
        return { known: true, text: String(v), numeric: false };
    }
  }

  /* GEO.fmt.num groups thousands with a lookahead that also fires inside the
     FRACTIONAL part, so `F.num(41.342585, 4)` prints "41.3,426". A coordinate
     has no thousands to group and four or six decimals to protect, so it is
     formatted here instead of being routed through the shared helper. The core
     bug is worth fixing in 00-core; this panel must not print a comma into a
     latitude while it waits. */
  function coordNum(v, dp) {
    return U.isKnown(v) ? Number(v).toFixed(dp) : F.UNKNOWN;
  }

  function numberText(v, fd) {
    if (fd.unit === 'm²') return F.area(v);
    if (fd.unit === 'USD/m²/month') return F.rent(v, 'm²/month');
    // A recorded 8 prints as "8%", a recorded 7.5 as "7.5%" — the stored
    // precision is shown, never padded into a precision the source never had.
    if (fd.unit === '%') return F.pct(v, Math.round(v) === v ? 0 : 1);
    if (fd.unit === 'spaces/m²') return F.num(v, 3) + ' ' + unitLabel(fd.unit);
    return F.num(v, Math.round(v) === v ? 0 : 1) + (fd.unit ? ' ' + unitLabel(fd.unit) : '');
  }

  /* ------------------------------------------------------------ provenance */
  function confidenceChip(level) {
    var key = ENUM_KEYS.confidence[level] || 'value.confidence.unknown';
    // §2.7 / visual-system §4: a confidence dot NEVER appears without its word.
    // "Not verified confidence" does not read, so Unknown carries its own noun.
    var label = level === 'Unknown' ? t(key) : t('quality.confidence.dotLabel', { level: t(key) });
    return el('span.conf', { 'data-conf': level }, [
      el('span.conf__dot', { 'aria-hidden': 'true' }),
      el('span.conf__label', { text: label })
    ]);
  }

  function freshnessChip(state) {
    var key = ENUM_KEYS.freshness[state] || 'value.freshness.unknown';
    return el('span.fresh', { 'data-fresh': state }, [
      el('span.fresh__dot', { 'aria-hidden': 'true' }),
      el('span', { text: t(key) })
    ]);
  }

  function provRow(labelText, valueNode) {
    return el('div', {}, [
      el('div.provpop__k', { text: labelText }),
      typeof valueNode === 'string' ? el('div.provpop__v', { text: valueNode })
                                    : el('div.provpop__v', {}, [valueNode])
    ]);
  }

  /**
   * P-08 — the field-level evidence view (§2.3). Rendered as an R9 dialog
   * rather than a hover popover: it has to be reachable by keyboard, dismissed
   * with Esc, focus-trapped and focus-returned, and all four come for free from
   * GEO.boot.dialog. A hover-only provenance affordance is not provenance.
   */
  /**
   * GEO.boot.dialog plus one correction: 99-boot's global Escape handler also
   * listens on `document`, so a plain Esc inside an R9 dialog closes the dialog
   * AND the right rail behind it. Capturing Escape on `#dialog` keeps the key
   * meaning exactly one thing while a modal is open (P5), and still leaves Tab
   * to the helper's own focus trap.
   */
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

  function openProvenance(rec, fd) {
    var ev = GEO.data.evidence(rec, fd.key);
    var shown = display(rec, fd);
    var rows = [];

    rows.push(provRow(t('detail.provenance.value'),
                      shown.known ? shown.text : el('span.unk', { text: F.UNKNOWN })));

    if (!ev) {
      rows.push(el('p.muted', { text: t('detail.provenance.none') }));
    } else {
      rows.push(provRow(t('detail.provenance.source'), ev.source || F.UNKNOWN));
      rows.push(provRow(t('detail.provenance.sourceUrl'),
        ev.sourceUrl ? el('a', { href: ev.sourceUrl, target: '_blank',
                                 rel: 'noopener noreferrer', text: ev.sourceUrl })
                     : el('span.unk', { text: F.UNKNOWN })));
      rows.push(provRow(t('detail.provenance.method'),
        ev.method ? enumLabel('method', ev.method) : F.UNKNOWN));
      rows.push(provRow(t('detail.provenance.confidence'), confidenceChip(ev.confidence)));
      rows.push(provRow(t('detail.provenance.collected'), F.date(ev.collectedAt)));
      rows.push(provRow(t('detail.provenance.verified'), F.date(ev.lastVerifiedAt)));
      // Computed from lastVerifiedAt on every read (D8) — it is never stored,
      // so it cannot drift out of step with the date it depends on.
      rows.push(provRow(t('detail.provenance.nextRefresh'),
        el('span.row.row--tight', {}, [
          el('span', { text: F.date(ev.nextRefreshAt) }),
          freshnessChip(ev.freshness || 'unknown')
        ])));
      rows.push(provRow(t('detail.provenance.qc'), enumLabel('qcStatus', ev.qcStatus)));
      if (ev.profileId) rows.push(provRow(t('detail.provenance.profile'), ev.profileId));
      rows.push(provRow(t('detail.provenance.note'),
        ev.note ? el('span', { text: ev.note }) : el('span.unk', { text: F.UNKNOWN })));
    }

    if (rec._meta && rec._meta.editedLocally) {
      rows.push(el('p.micro', { text: t('detail.provenance.edited',
                                        { date: F.date(rec._meta.updatedAt) }) }));
    }

    modal({
      title: t('detail.provenance.title', { field: fieldLabel(fd.key) }),
      body: el('div.provpop', {}, rows)
    });
  }

  /** The affordance itself. Present on every field that HOLDS a value; a field
   *  with nothing recorded has no evidence to show and gets no control, so the
   *  panel never offers a button whose only answer is "nothing". */
  function provButton(rec, fd) {
    return el('button.prov', {
      type: 'button',
      'aria-label': t('detail.provenance.title', { field: fieldLabel(fd.key) }),
      title: t('detail.provenance.open'),
      text: 'ⓘ',
      onclick: function () { openProvenance(rec, fd); }
    });
  }

  /* ----------------------------------------------------------- key/value rows */
  function kvRow(rec, fd) {
    var shown = display(rec, fd);
    var cls = 'span.kv__v' + (shown.numeric ? '.kv__v--num' : '') +
              (fieldEdited(rec, fd.key) ? '.kv__v--edited' : '');
    return el('div.kv__row', {}, [
      el('span.kv__k', { text: fieldLabel(fd.key) }),
      el(cls, { 'data-known': shown.known ? 'true' : 'false' },
         [shown.known ? el('span', { text: shown.text }) : el('span.unk', { text: F.UNKNOWN })]),
      shown.known ? provButton(rec, fd) : el('span')
    ]);
  }

  /** A field whose evidence was written by the prototype editor rather than
   *  inherited from a shipped profile (M12) — it must never look sourced. */
  function fieldEdited(rec, key) {
    var e = rec._evidence ? rec._evidence[key] : null;
    return !!(e && typeof e === 'object' && !e.p);
  }

  /* -------------------------------------------------------------- sections */
  var secSeq = 0;

  function disclosure(id, label, countText, bodyNodes) {
    var open = isOpen(id);
    var uid = 'prop-sec-' + id + '-' + (++secSeq);
    var body = el('div.disc__body', { id: uid + '-body' }, bodyNodes);
    var hd = el('button.disc__hd', {
      type: 'button', id: uid + '-hd',
      'aria-expanded': open ? 'true' : 'false',
      'aria-controls': uid + '-body'
    }, [
      el('span', { text: label }),
      countText ? el('span.disc__count', { text: countText }) : null
    ]);
    // `.disc__hd` must stay a DIRECT child of `.disc` (the caret rotation is a
    // child selector), so the section is named by the button instead of being
    // wrapped in a heading element.
    var sec = el('section.prop__sec.disc', {
      dataset: { open: open ? 'true' : 'false' },
      'aria-labelledby': uid + '-hd'
    }, [hd, el('div.disc__wrap', {}, [body])]);

    hd.addEventListener('click', function () {
      var next = sec.dataset.open !== 'true';
      sec.dataset.open = next ? 'true' : 'false';
      hd.setAttribute('aria-expanded', next ? 'true' : 'false');
      setOpen(id, next);
    });
    return sec;
  }

  function filledCount(rec, fields) {
    return fields.filter(function (fd) { return U.isKnown(rec[fd.key]); }).length;
  }

  /* ---------------------------------------------------------- key metrics */
  /* The hero numeral carries the quantity and `.stat__unit` carries the unit,
     rather than "$27.5 /m²/month" being set at 26px — which does not fit a
     150px tile at 375px. The split is driven by the registry's own `unit`, so
     a new numeric field lands in the right shape without a change here. */
  function metricParts(rec, fd) {
    var v = rec[fd.key];
    if (!U.isKnown(v)) return { known: false, value: F.UNKNOWN, unit: null };
    if (fd.type === 'number') {
      if (fd.unit === 'm²') return { known: true, value: F.num(v, 0), unit: t('unit.sqm') };
      // The unit names the currency, so the numeral does not repeat it: a tile
      // reading "$27.5 USD/m²/month" states USD twice and m²/month once.
      if (fd.unit === 'USD/m²/month') return { known: true, value: F.num(v, 1),
                                               unit: t('unit.usdSqmMonth') };
      if (fd.unit === '%') return { known: true, value: F.pct(v, Math.round(v) === v ? 0 : 1),
                                    unit: null };
      if (fd.unit === 'spaces/m²') return { known: true, value: F.num(v, 3),
                                            unit: t('unit.spacesPerSqm') };
      return { known: true, value: F.num(v, Math.round(v) === v ? 0 : 1),
               unit: fd.unit ? unitLabel(fd.unit) : null };
    }
    return { known: true, value: display(rec, fd).text, unit: null };
  }

  function metricTile(rec, key) {
    var fd = S.byKey[key];
    if (!fd) return null;
    var parts = metricParts(rec, fd);
    var isDemo = rec.recordType === 'DEMO';

    var kids = [
      el('div.stat__label', { text: fieldLabel(key) }),
      el('div.stat__value', { 'data-known': parts.known ? 'true' : 'false' },
         parts.known
           ? [el('span', { text: parts.value }),
              parts.unit ? el('span.stat__unit', { text: ' ' + parts.unit }) : null]
           : [el('span.unk', { text: F.UNKNOWN })])
    ];
    // R9: the rent unit is an assumption of ours, not a statement of the
    // source's, and it says so everywhere a rent figure appears.
    if (parts.known && key === 'askingRent') {
      kids.push(el('div.stat__cov.coverage', { text: t('detail.rentUnitNote') }));
    }
    // D4: a synthetic figure is badged wherever it appears, not only in the header.
    if (parts.known && isDemo) {
      kids.push(el('div.stat__demo.micro', { text: t('common.demo.badge') }));
    }

    if (!parts.known) {
      // Nothing to open, so nothing pretends to be a control (§29). The greyed
      // "Not recorded" IS the explanation; a disabled button beside it would
      // add a reason string to seven tiles and say nothing new.
      return el('div.stat.stat--unknown', { 'data-known': 'false' }, kids);
    }
    // No aria-label: the tile's own text already reads "GLA 24,500 m² DEMO",
    // and an aria-label would replace that — hiding the demo badge and the
    // assumed-unit note from exactly the readers who can least afford to miss them.
    return el('button.stat', {
      type: 'button', 'data-known': 'true',
      title: t('detail.provenance.open'),
      onclick: function () { openProvenance(rec, fd); }
    }, kids);
  }

  function metricsSection(rec) {
    var tiles = METRICS.map(function (k) { return metricTile(rec, k); })
                       .filter(function (n) { return !!n; });
    var known = METRICS.filter(function (k) { return U.isKnown(rec[k]); }).length;
    return disclosure('metrics', t('detail.section.metrics'),
                      t('common.of', { n: F.int(known), m: F.int(METRICS.length) }),
                      [el('div.stats', {}, tiles)]);
  }

  /* -------------------------------------------------------- group sections */
  /* Coordinates are a location fact, not an identification row: they are lifted
     out of their registry group and rendered once, in Location, next to the
     copy action that exists for them. Everything else in every group renders
     generically, so a new registry field needs no change here. */
  function groupFields(groupKey) {
    return S.fieldsIn(groupKey).filter(function (fd) { return fd.type !== 'coord'; });
  }

  function groupSection(rec, group) {
    var fields = groupFields(group.key);
    if (!fields.length) return null;

    var label = GROUP_KEYS[group.key] ? t(GROUP_KEYS[group.key]) : group.label;
    var body, count;

    // A list section counts its entries; a field section counts its filled
    // fields. "0 of 1" would be a true but useless thing to say about tenants,
    // and P-07's own example is the bare count (`Tenants (0)`).
    if (group.key === 'tenants') {
      body = tenantsBody(rec);
      count = F.int((rec.tenants || []).length);
    } else if (group.key === 'amenities') {
      body = amenitiesBody(rec);
      count = F.int((rec.amenities || []).length);
    } else {
      body = [el('div.kv', {}, fields.map(function (fd) { return kvRow(rec, fd); }))];
      count = t('common.of', { n: F.int(filledCount(rec, fields)), m: F.int(fields.length) });
    }

    if (group.key === 'commercial' && U.isKnown(rec.askingRent)) {
      body.push(el('p.coverage', { text: t('detail.rentUnitNote') }));
    }

    return disclosure(group.key, label, count, body);
  }

  /* ------------------------------------------------------------- tenants */
  /* §36's sharpest case. "Tenant list not collected", "Confirmed: no tenants"
     and "four tenants" are three different statements, and `tenants: []` alone
     cannot tell them apart — which is exactly why `tenantsStatus` exists. The
     status line is rendered ALWAYS, above the list, whatever the list holds. */
  function statusLine(statusValue, labelKey) {
    return el('p.row.row--tight', {}, [
      el('span.kv__k', { text: t(labelKey, { status: enumLabel('collectionStatus', statusValue) }) })
    ]);
  }

  function tenantFragment(text, known) {
    return known ? el('span', { text: text }) : el('span.unk', { text: F.UNKNOWN });
  }

  function tenantsBody(rec) {
    var status = rec.tenantsStatus || 'not_collected';
    var list = Array.isArray(rec.tenants) ? rec.tenants : [];
    var out = [statusLine(status, 'detail.tenants.status')];

    if (status === 'confirmed_empty') {
      out.push(el('p.empty__body', { text: t('empty.tenants.confirmed') }));
    } else if (!list.length) {
      out.push(el('div.empty', {}, [
        el('p.empty__title', { text: t('empty.tenants.title') }),
        el('p.empty__body', { text: t('empty.tenants.body') })
      ]));
    } else {
      out.push(el('ul.stack', {}, list.map(function (tn) {
        var frags = [];
        frags.push(tenantFragment(tn.industry ? enumLabel('tenantIndustry', tn.industry) : F.UNKNOWN,
                                  U.isKnown(tn.industry)));
        frags.push(el('span.sep', { text: '·', 'aria-hidden': 'true' }));
        frags.push(tenantFragment(F.area(tn.area), U.isKnown(tn.area)));
        frags.push(el('span.sep', { text: '·', 'aria-hidden': 'true' }));
        frags.push(tenantFragment(t('detail.tenants.floor', { floor: tn.floor }), U.isKnown(tn.floor)));
        return el('li', {}, [
          el('div', { text: tn.name || F.UNKNOWN }),
          el('div.micro.row.row--tight', {}, frags)
        ]);
      })));
    }

    var fd = S.byKey.tenants;
    if (fd && list.length) out.push(el('div.row', {}, [provButton(rec, fd)]));
    return out;
  }

  /* ----------------------------------------------------------- amenities */
  function amenitiesBody(rec) {
    var status = rec.amenitiesStatus || 'not_collected';
    var list = Array.isArray(rec.amenities) ? rec.amenities : [];
    var out = [statusLine(status, 'detail.amenities.status')];

    if (status === 'confirmed_empty') {
      out.push(el('p.empty__body', { text: t('value.collection.confirmedEmpty') }));
    } else if (!list.length) {
      out.push(el('div.empty', {}, [
        el('p.empty__title', { text: t('empty.amenities.title') }),
        el('p.empty__body', { text: t('empty.amenities.body') })
      ]));
    } else {
      out.push(el('div.row', {}, list.map(function (a) {
        return el('span.chip', {}, [el('span.chip__label', { text: enumLabel('amenity', a) })]);
      })));
      var fd = S.byKey.amenities;
      if (fd) out.push(el('div.row', {}, [provButton(rec, fd)]));
    }
    return out;
  }

  /* ------------------------------------------------------------- location */
  function coordText(rec) {
    return t('detail.coords', { lat: coordNum(rec.lat, COORD_DP), lng: coordNum(rec.lng, COORD_DP) });
  }

  function locationSection(rec) {
    var hasCoords = U.isKnown(rec.lat) && U.isKnown(rec.lng);
    var body = [];

    body.push(el('div.kv', {}, [
      el('div.kv__row', {}, [
        el('span.kv__k', { text: t('field.coordinates') }),
        el('span.kv__v.kv__v--num', { 'data-known': hasCoords ? 'true' : 'false' },
           [hasCoords ? el('span', { text: coordText(rec) }) : el('span.unk', { text: F.UNKNOWN })]),
        hasCoords ? provButton(rec, S.byKey.lat) : el('span')
      ]),
      el('div.kv__row', {}, [
        el('span.kv__k', { text: t('field.districtKey') }),
        el('span.kv__v', {}, [el('span', { text: GEO.data.districtName(rec.districtKey) })]),
        U.isKnown(rec.districtKey) ? provButton(rec, S.byKey.districtKey) : el('span')
      ])
    ]));
    body.push(el('p.coverage', { text: t('detail.coords.hint') }));

    if (hasCoords) {
      body.push(el('div.row', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('detail.action.copyCoords'),
          onclick: function () { copy(coordText(rec), 'toast.coordsCopied'); }
        })
      ]));
    }
    return disclosure('location', t('detail.section.location'), null, body);
  }

  /* --------------------------------------------------------- data quality */
  /* D9 — count bands over the 8 critical fields, not a percentage: at this
     coverage a percentage puts all 148 records in one bucket and discriminates
     nothing. The band is taken from the quality module when it is loaded; the
     arithmetic is re-derived here either way so the panel states a number it
     can show the working for. */
  function completenessOf(rec) {
    var crit = S.criticalFields;
    var missing = crit.filter(function (k) { return !U.isKnown(rec[k]); });
    var n = crit.length - missing.length;
    var band = null;
    if (GEO.quality && GEO.quality.completeness) {
      var q = GEO.quality.completeness(rec);
      if (q && q.band) {
        band = q.band;
        if (typeof q.n === 'number') n = q.n;
        if (Array.isArray(q.missing)) missing = q.missing;
      }
    }
    if (!band) band = n === 0 ? 'none' : (n <= 2 ? 'minimal' : (n <= 5 ? 'partial' : 'good'));
    return { n: n, m: crit.length, band: band, missing: missing };
  }

  /* The record's own freshness is driven by its FAST fields (60 d): the whole
     record is only as fresh as the quickest-moving thing in it. `askingRent`
     is a fast field, so it carries the class into GEO.schema. */
  function freshnessOf(rec) {
    var lv = rec._meta ? rec._meta.lastVerifiedAt : null;
    var today = GEO.date.today();
    var state = null, next = null;

    if (GEO.quality && GEO.quality.freshness) {
      var q = GEO.quality.freshness(rec);
      if (q) { state = q.state || q.freshness || null; next = q.nextRefreshAt || null; }
    }
    if (!state) state = S.freshness(lv, 'askingRent', today);
    if (!next) next = S.nextRefresh(lv, 'askingRent');

    var due = next ? GEO.date.daysBetween(today, next) : null;
    var reason = null;
    if (due !== null) {
      reason = due >= 0 ? GEO.i18n.plural('quality.freshness.dueIn', due)
                        : GEO.i18n.plural('quality.freshness.overdue', -due);
    }
    return { state: state, next: next, due: due, reason: reason,
             age: GEO.date.daysBetween(lv, today), lastVerifiedAt: lv };
  }

  function sourcesOf(rec) {
    var ids = {}, out = [];
    var all = GEO.data.sources();
    Object.keys(rec._evidence || {}).forEach(function (k) {
      var ev = GEO.data.evidence(rec, k);
      if (!ev) return;
      var id = ev.sourceId || ev.source;
      if (!id || ids[id]) return;
      ids[id] = true;
      var meta = all.filter(function (s) { return s.id === ev.sourceId; })[0];
      out.push({ name: ev.source || (meta && meta.name) || F.UNKNOWN,
                 method: ev.method || (meta && meta.method) || null,
                 date: ev.collectedAt || (meta && meta.retrievedAt) || null,
                 url: ev.sourceUrl || (meta && meta.url) || null,
                 note: meta && meta.note ? meta.note : null });
    });
    return out;
  }

  function qualitySection(rec) {
    var comp = completenessOf(rec);
    var fresh = freshnessOf(rec);
    var meta = rec._meta || {};
    var body = [];

    /* --- record confidence: dot AND word, never colour alone (§19) --- */
    body.push(el('div.stack', {}, [
      el('div.sectitle', { text: t('detail.quality.confidence') }),
      confidenceChip(GEO.data.recordConfidence(rec)),
      el('p.coverage', { text: t('quality.confidence.legend') }),
      el('p.coverage', { text: t('quality.confidence.identity') }),
      el('p.coverage', { text: t('quality.confidence.claims') }),
      el('p.coverage', { text: t('quality.confidence.district') }),
      meta.sourceConfidenceLetter
        ? el('p.micro', { text: t('detail.quality.sourceGrade', { grade: meta.sourceConfidenceLetter }) })
        : null
    ]));

    /* --- completeness: the meter is decorative, the sentence is the fact --- */
    var pct = comp.m ? Math.round((comp.n / comp.m) * 100) : 0;
    var meter = el('div.covrow__bar', { 'data-zero': comp.n === 0 ? 'true' : 'false',
                                        'aria-hidden': 'true' },
                   [el('div.covrow__fill', { style: 'width:' + pct + '%' })]);
    body.push(el('div.stack', {}, [
      el('div.sectitle', { text: t('quality.completeness.band',
                                   { band: t(ENUM_KEYS.completeness[comp.band] || 'value.completeness.none'),
                                     n: F.int(comp.n), m: F.int(comp.m) }) }),
      meter,
      comp.missing.length
        ? el('p.coverage', { text: t('detail.quality.missingFields',
              { fields: comp.missing.map(fieldLabel).join(', ') }) })
        : null,
      el('p.coverage', { text: t('quality.completeness.explain', { m: F.int(comp.m) }) })
    ]));

    /* --- verification: verified date + age, next date, state + reason --- */
    body.push(el('div.stack', {}, [
      el('div.sectitle', { text: t('detail.quality.freshness') }),
      el('p', {}, [
        el('span', { text: t('detail.quality.verified', { date: F.date(fresh.lastVerifiedAt) }) }),
        el('span.sep', { text: ' · ', 'aria-hidden': 'true' }),
        el('span.muted', { text: fresh.age === null ? t('value.freshness.unknown')
                                                    : t('common.daysAgo', { n: F.int(fresh.age) }) })
      ]),
      el('p.row.row--tight', {}, [
        freshnessChip(fresh.state),
        fresh.reason ? el('span.micro', { text: fresh.reason }) : null
      ]),
      el('p.coverage', { text: t('quality.freshness.due', { date: F.date(fresh.next) }) }),
      el('p.coverage', { text: t('detail.quality.collected',
            { date: F.date(meta.collectedAt),
              age: F.int(GEO.date.daysBetween(meta.collectedAt, GEO.date.today())) }) }),
      // D8, stated rather than hidden: one collection date across the observed
      // set means staleness cannot yet separate records. The engine is correct;
      // the data is not yet varied enough for it to say anything.
      el('p.coverage', { text: t('quality.freshness.note',
            { date: F.date(meta.collectedAt),
              age: F.int(GEO.date.daysBetween(meta.collectedAt, GEO.date.today())) }) }),
      el('p.coverage', { text: t('quality.freshness.intervals',
            { fast: S.refreshDays.fast, slow: S.refreshDays.slow, stable: S.refreshDays.stable }) })
    ]));

    /* --- source list --- */
    var srcs = sourcesOf(rec);
    body.push(el('div.stack', {}, [
      el('div.sectitle', { text: t('common.sources') }),
      srcs.length
        ? el('ul.stack', {}, srcs.map(function (s) {
            return el('li', {}, [
              el('div', { text: t('detail.quality.sourceLine',
                  { source: s.name,
                    method: s.method ? enumLabel('method', s.method) : F.UNKNOWN,
                    date: F.date(s.date) }) }),
              s.note ? el('div.micro', { text: s.note }) : null
            ]);
          }))
        : el('p.unk', { text: F.UNKNOWN })
    ]));

    /* --- the collector's own note, verbatim --- */
    /* It is Russian, it is an instruction to a field team, and it is the most
       honest thing in the record. It is quoted exactly — never translated,
       never summarised — with its origin labelled, because a paraphrase of an
       instruction about what still needs checking is a different instruction. */
    if (U.isKnown(meta.sourceNote)) {
      body.push(el('div.stack', {}, [
        el('div.sectitle', { text: t('detail.quality.sourceNote') }),
        el('blockquote.card.card--flat', { lang: 'ru' },
           [el('p', { text: meta.sourceNote })]),
        el('p.coverage', { text: t('detail.quality.sourceNote.origin',
              { source: srcs.length ? srcs[0].name : (meta.verificationMode || F.UNKNOWN) }) })
      ]));
    }

    /* --- record identity, photos, review flags --- */
    body.push(el('div.kv', {}, [
      el('div.kv__row', {}, [
        el('span.kv__k', { text: t('detail.quality.recordType') }),
        el('span.kv__v', { text: enumLabel('recordType', rec.recordType) }),
        el('span')
      ]),
      el('div.kv__row', {}, [
        el('span.kv__k', { text: t('detail.quality.recordId') }),
        el('span.kv__v.kv__v--num', { text: rec.id }),
        el('button.prov', {
          type: 'button', text: '⧉', 'aria-label': t('detail.action.copyId'),
          title: t('detail.action.copyId'),
          onclick: function () { copy(rec.id, 'toast.idCopied'); }
        })
      ]),
      el('div.kv__row', {}, [
        el('span.kv__k', { text: t('quality.entity.title') }),
        el('span.kv__v', { text: enumLabel('entityReview', meta.entityReview || 'unreviewed') }),
        el('span')
      ])
    ]));
    body.push(el('p.coverage', { text: t('detail.quality.noPhotos') }));

    return disclosure('quality', t('detail.section.quality'), null, body);
  }

  /* ------------------------------------------------------------- clipboard */
  /* X-E9 — `navigator.clipboard` is frequently unavailable on file://, so the
     control must degrade to something that still works rather than fail
     silently. Every path ends in either a toast or a selectable dialog. */
  function copy(text, okKey) {
    function manual() {
      var input = el('input.input', { type: 'text', readonly: true, value: text,
                                      'aria-label': t('error.clipboard.hint') });
      input.value = text;
      modal({
        title: t('common.copy'),
        body: el('div.stack', {}, [
          el('p', { text: t('error.clipboard') }),
          input,
          el('p.micro', { text: t('error.clipboard.hint') })
        ])
      });
      try { input.focus(); input.select(); } catch (e) { /* focus is best-effort */ }
    }

    function legacy() {
      var ta = el('textarea', { 'aria-hidden': 'true', tabindex: '-1' });
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      var ok = false;
      try { ta.select(); ok = document.execCommand('copy'); }
      catch (e) { ok = false; }
      document.body.removeChild(ta);
      if (ok) GEO.boot.toast(t(okKey)); else manual();
    }

    var nav = w.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      try {
        nav.clipboard.writeText(text).then(
          function () { GEO.boot.toast(t(okKey)); },
          legacy
        );
        return;
      } catch (e) { /* synchronous throw — fall through to the legacy path */ }
    }
    legacy();
  }

  /* --------------------------------------------------------------- actions */
  function disabledAction(labelText, reasonText) {
    var id = 'prop-reason-' + (++secSeq);
    return el('span', {}, [
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button', disabled: true, 'aria-describedby': id, text: labelText
      }),
      el('span.reason', { id: id, text: reasonText })
    ]);
  }

  /** The first source URL this record actually carries. All 148 seed records
   *  return null here, which is why P-05 is the reference case for §29. */
  function sourceUrlOf(rec) {
    var keys = Object.keys(rec._evidence || {});
    for (var i = 0; i < keys.length; i++) {
      var ev = GEO.data.evidence(rec, keys[i]);
      if (ev && U.isKnown(ev.sourceUrl)) return ev.sourceUrl;
    }
    return null;
  }

  function actionsBar(state, rec) {
    var inCompare = state.compare.indexOf(rec.id) >= 0;
    var compareFull = state.compare.length >= 4 && !inCompare;
    var url = sourceUrlOf(rec);
    var hasRadius = !!(state.radius && state.radius.id === rec.id);
    var kids = [];

    /* P-01 — compare toggle */
    if (compareFull) {
      kids.push(disabledAction(t('detail.action.compare'), t('detail.action.compare.limit')));
    } else {
      kids.push(el('button.btn.btn--ghost.btn--sm', {
        type: 'button', 'aria-pressed': inCompare ? 'true' : 'false',
        text: inCompare ? t('detail.action.inCompare') : t('detail.action.compare'),
        onclick: function () {
          var next = state.compare.filter(function (id) { return id !== rec.id; });
          if (!inCompare) next.push(rec.id);
          GEO.state.set({ compare: next },
            { source: 'user', action: inCompare ? 'compare:remove' : 'compare:add',
              summary: rec.name });
        }
      }));
    }

    /* P-02 — analyze location. This writes state only; module 17 draws. */
    kids.push(el('button.btn.btn--ghost.btn--sm', {
      type: 'button',
      text: hasRadius ? t('detail.action.reanalyze') : t('detail.action.analyze'),
      onclick: function () {
        GEO.state.set({ radius: { id: rec.id, km: (GEO.geo && GEO.geo.DEFAULT_BANDS_KM) || [1, 3, 5] },
                        rightRail: 'open', rightTab: 'property' },
          { source: 'user', action: 'location:analyze', summary: rec.name });
      }
    }));

    /* P-03 — hand the property to the assistant, pre-filled but NOT sent. */
    kids.push(el('button.btn.btn--ghost.btn--sm', {
      type: 'button', text: t('detail.action.ask'),
      onclick: function () {
        GEO.state.set({ rightRail: 'open', rightTab: 'ai', aiUnread: false },
          { source: 'user', action: 'ai:askAbout', summary: rec.name });
        // The textarea is static shell markup, not another panel's render
        // output, so filling it here does not cross a module's DOM boundary.
        // The input event lets the AI panel's own send-enabled logic react.
        var box = Q.$('#ai-input');
        if (!box) return;
        box.value = t('detail.ask.prefill.competitors',
                      { km: (GEO.geo && GEO.geo.COMPETITIVE_BAND_KM) || 3, name: rec.name });
        box.dispatchEvent(new Event('input', { bubbles: true }));
        box.focus();
      }
    }));

    /* P-04 — copy coordinates */
    if (U.isKnown(rec.lat) && U.isKnown(rec.lng)) {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('detail.action.copyCoords'),
        onclick: function () { copy(coordText(rec), 'toast.coordsCopied'); }
      }));
    } else {
      kids.push(disabledAction(t('detail.action.copyCoords'),
                               t('detail.action.copyCoords.disabled')));
    }

    /* P-05 — open source, or say plainly why there is nothing to open */
    if (url) {
      kids.push(el('a.btn.btn--quiet.btn--sm', {
        href: url, target: '_blank', rel: 'noopener noreferrer',
        text: t('detail.action.openSource')
      }));
    } else {
      kids.push(disabledAction(t('detail.action.openSource'),
                               t('detail.action.openSource.disabled')));
    }

    /* P-06 — Edit. Hidden entirely in the External role (§60, X-9): a control
       the role may never use is removed, not disabled, because a disabled
       Edit button advertises an internal capability to an external reader. */
    if (state.role !== 'external') {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('detail.action.edit'),
        onclick: function () {
          GEO.state.set({ overlay: 'data', dataTab: 'records', editingId: rec.id },
            { source: 'user', action: 'admin:edit', summary: rec.name });
        }
      }));
    }

    return el('div.prop__actions', { role: 'group', 'aria-label': t('detail.tab') }, kids);
  }

  /* ---------------------------------------------------------------- header */
  function headerBlock(state, rec) {
    var meta = rec._meta || {};
    var isDemo = rec.recordType === 'DEMO';
    var cls = U.isKnown(rec.officeClass) ? rec.officeClass : null;

    var chips = [];
    if (isDemo) chips.push(el('span.badge.badge--demo', { text: t('detail.demo.badge') }));

    // The ramp colour carries the class, the letter inside it carries the
    // class again for anyone the colour does not reach. "?" is not a word, so
    // an unrecorded class gets the sentence spelled out beside the badge.
    chips.push(el('span.badge.badge--class', {
      dataset: { class: cls || 'unknown' },
      'aria-label': cls ? t('detail.class.badge', { class: cls }) : t('value.class.unknown'),
      text: cls || '?'
    }));
    if (!cls) {
      chips.push(el('span.chip', {}, [
        el('span.chip__label', { text: t('value.class.unknown') })
      ]));
    }
    chips.push(el('span.chip', {}, [el('span.chip__label', {
      text: U.isKnown(rec.status) ? enumLabel('status', rec.status) : t('value.status.unknown')
    })]));
    chips.push(el('span.chip', {}, [el('span.chip__label', {
      text: t('detail.district', { name: GEO.data.districtName(rec.districtKey) })
    })]));

    /* `.reason` is reserved for the §29 partner of a disabled control, so these
       record-level notes use the neutral text utilities: mixing them would make
       "every .reason has a disabled control beside it" untestable. */
    var flags = [];
    if (isDemo) flags.push(el('p.micro', { text: t('detail.demo.note') }));

    /* D1 — the conflict names BOTH labels. The polygon wins, and the reader is
       told which label lost and why, because silently correcting a source is
       indistinguishable from an error until you can see both numbers. */
    if (meta.districtConflict) {
      flags.push(el('div.stack', {}, [
        el('div.row.row--tight', {}, [
          el('span.badge.badge--flag', { text: t('detail.conflict.badge') }),
          el('span.micro', { text: t('detail.districtSource',
                                     { label: meta.districtSourceLabel || F.UNKNOWN }) })
        ]),
        el('p.muted', { text: t('detail.conflict.note', {
          label: meta.districtSourceLabel || F.UNKNOWN,
          computed: GEO.data.districtName(rec.districtKey)
        }) }),
        el('p.coverage', { text: t('quality.conflict.rule') })
      ]));
    }

    if (meta.possibleDuplicate) {
      flags.push(el('div.stack', {}, [
        el('span.badge.badge--flag', { text: t('detail.dupe.badge') }),
        el('p.muted', { text: t('quality.dupes.note') }),
        // The review queue lives in the Data workspace, which the External role
        // cannot open (§60/X-9) — so the route to it is removed for that role
        // rather than shown as a disabled control leading nowhere.
        state.role === 'external' ? null : el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('detail.dupe.review'),
          onclick: function () {
            GEO.state.set({ overlay: 'data', dataTab: 'dupes' },
              { source: 'user', action: 'admin:dupes', summary: rec.name });
          }
        })
      ]));
    }

    if (meta.entityReview === 'suspected_non_bc' || meta.entityReview === 'name_quality') {
      // Both notes: the reviewer's finding about THIS record, and the policy
      // that keeps it counted. A flag is not a deletion (D7), and a reader who
      // sees only the finding will assume it was.
      flags.push(el('div.stack', {}, [
        el('span.badge.badge--flag', { text: t('detail.entity.badge') }),
        meta.entityReviewNote ? el('p.muted', { text: meta.entityReviewNote }) : null,
        el('p.micro', { text: t('detail.entity.note') })
      ]));
    }

    if (meta.addedLocally) {
      flags.push(el('p.micro', { text: t('detail.addedLocally') }));
    } else if (meta.editedLocally) {
      flags.push(el('p.micro', { text: GEO.i18n.plural('detail.editedLocally', editedFieldCount(rec)) }));
    }

    return [
      el('div.prop__hd', {}, [
        el('h2.prop__title', { id: 'prop-title', text: rec.name || F.UNKNOWN }),
        el('button.btn.btn--icon', {
          type: 'button', 'aria-label': t('detail.action.zoom'),
          title: t('detail.action.zoom'), text: '⌖',
          onclick: function () {
            // The viewport is state, not a side-effect: writing it here keeps
            // the map, the list and any later render reading one snapshot.
            GEO.state.set({ map: { centre: [rec.lat, rec.lng], zoom: ZOOM_TO } },
              { source: 'user', action: 'map:zoomTo', summary: rec.name });
          }
        })
      ]),
      el('div.prop__sub', {}, chips)
    ].concat(flags);
  }

  function editedFieldCount(rec) {
    return S.fields.filter(function (fd) { return fieldEdited(rec, fd.key); }).length;
  }

  /* ----------------------------------------------------------- empty state */
  /* E-05. An empty state names the cause and offers the escape — here both
     escapes, because a property is reachable from the map and from the list
     and a reader who cannot see the map needs the second one named. */
  function emptyState(state) {
    return el('div.empty', {}, [
      el('p.empty__title', { text: t('empty.property.title') }),
      el('p.empty__body', { text: t('empty.property.body') }),
      el('div.empty__actions', {}, [
        el('button.btn.btn--primary.btn--sm', {
          type: 'button', text: t('empty.property.action'),
          onclick: function () {
            GEO.state.set({ leftRail: 'open', leftTab: 'results' },
              { source: 'user', action: 'rail:showResults' });
            var list = Q.$('#results-list');
            if (list) list.focus();
          }
        }),
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('empty.property.action.map'),
          onclick: function () {
            GEO.state.set({ rightRail: 'closed', map: { fitToken: state.map.fitToken + 1 } },
              { source: 'user', action: 'nav:map' });
            var map = Q.$('#map');
            if (map) map.focus();
          }
        })
      ])
    ]);
  }

  /* --------------------------------------------------------------- render */
  var lastSig = null;
  var dirty = false;

  /* The signature covers exactly the slice of state this panel draws from,
     plus the record's own edit stamp. Records themselves are never cached —
     only this string is — so there is no second copy of the dataset here. */
  function signature(state) {
    var rec = state.selectedId ? GEO.data.get(state.selectedId) : null;
    return [
      state.selectedId || '',
      state.role,
      state.demoMode ? '1' : '0',
      state.compare.join('|'),
      state.radius ? state.radius.id : '',
      GEO.i18n.locale,
      rec && rec._meta ? String(rec._meta.updatedAt) : '',
      rec && rec._meta ? String(!!rec._meta.editedLocally) : ''
    ].join('');
  }

  function draw(pane, state, rec) {
    if (!rec) {
      Q.fill(pane, [emptyState(state)]);
      return;
    }

    var kids = headerBlock(state, rec);
    kids.push(actionsBar(state, rec));

    /* The mount for §16's location analysis. It is created here and left
       empty: module 17 owns everything inside it, and this module never reads
       or writes its contents. Kept above the sections so the result of
       "Analyze location" is visible without scrolling or expanding anything. */
    kids.push(el('div#' + LOCATION_MOUNT_ID + '.loc', {}));

    kids.push(metricsSection(rec));
    S.groups.forEach(function (g) {
      var sec = groupSection(rec, g);
      if (sec) kids.push(sec);
    });
    kids.push(locationSection(rec));
    kids.push(qualitySection(rec));

    Q.fill(pane, [el('div.prop', { 'aria-labelledby': 'prop-title' }, kids)]);
  }

  function render(state) {
    var pane = Q.$(PANE);
    if (!pane) return;

    // While the tab is hidden there is nothing to keep in step; clearing the
    // signature guarantees a full redraw the moment it is shown again.
    if (state.rightRail !== 'open' || state.rightTab !== 'property') { lastSig = null; return; }

    var sig = signature(state);
    if (sig === lastSig && !dirty) return;
    lastSig = sig;
    dirty = false;

    draw(pane, state, state.selectedId ? GEO.data.get(state.selectedId) : null);
  }

  /* `99-boot.js` is LAST in the manifest and opens with `GEO.boot = {}`, so at
     panel-load time `GEO.boot.registerPanel` does not exist yet and anything
     queued on `GEO.boot` would be discarded a moment later. DOMContentLoaded is
     the seam: every inline script has run by then, and because this listener is
     added while 14 loads — before 99-boot adds its own — registration lands
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
          GEO.log.error('14-panel-detail: GEO.boot.registerPanel is unavailable — the Property tab will not render');
        }
      });
    } else {
      setTimeout(function () {
        if (!registerWithBoot()) {
          GEO.log.error('14-panel-detail: GEO.boot.registerPanel is unavailable — the Property tab will not render');
        }
      }, 0);
    }
  }

  /* A dataset edit arrives as an empty patch (99-boot re-broadcasts it), so the
     signature alone cannot see it. Nor can a locale switch. Both force one
     redraw rather than being guessed at from the patch. */
  GEO.on('data:changed', function () { dirty = true; });
  GEO.on('i18n:locale', function () { dirty = true; });

  /* The published surface for module 17: where to render, and nothing else. */
  GEO.panels = GEO.panels || {};
  GEO.panels.detail = {
    LOCATION_MOUNT_ID: LOCATION_MOUNT_ID,
    locationMount: function () { return Q.$('#' + LOCATION_MOUNT_ID); }
  };
}(window));
