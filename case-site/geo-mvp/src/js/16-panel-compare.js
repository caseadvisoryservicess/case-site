/* ===========================================================================
 * 16-panel-compare — the comparison overlay (R7 · brief §15, IA §5.8)
 *
 * Four decisions shape this file.
 *
 * A. NO WINNER. EVER. (§15, C-11)
 *    Nothing here ranks, sorts, bolds, arrows or colours a cell as "better".
 *    A difference may be marked as a DIFFERENCE — one muted word next to the
 *    row label — and that is the whole of it. The judgement belongs to the
 *    reader, who knows things about these buildings that this dataset does
 *    not. A footer line says so in as many words.
 *
 * B. THE EMPTY ROWS ARE THE PRODUCT.
 *    On this dataset most comparison rows are "Not recorded" in every column.
 *    Dropping them would flatter the data; showing them all inline would bury
 *    the four rows that carry information. So rows are ordered: every field
 *    known for at least one column first, then a collapsed group headed "No
 *    data for any selected property" holding the rest — present, counted, one
 *    click away. What nobody has collected is itself market intelligence
 *    (§37), and the honest treatment of it is collapsed-but-present.
 *
 * C. EVERY CELL CARRIES ITS PROVENANCE.
 *    A value without its confidence and its verification date is a number
 *    with no standing. Each populated cell renders a confidence dot WITH its
 *    word (§2.3, visual-system §4 — a bare dot is a defect) and the date the
 *    value was last verified. Unknown renders as `GEO.fmt.UNKNOWN` in muted
 *    type: never 0, never a dash, never blank (§36).
 *
 * D. THE PANEL HOLDS NO DATA.
 *    Between renders this module keeps a signature string, three view flags
 *    and one DOM reference for focus return. Records are re-derived from
 *    `GEO.data.get()` on every draw.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, el = Q.el, F = GEO.fmt, S = GEO.schema;
  var t = GEO.i18n.t;

  var BODY = '#compare-body';
  var OVERLAY = '#overlay-compare';
  var TITLE = '#compare-title';

  var MIN_COLS = 2;                 // C-05: below this there is nothing to compare
  var MAX_COLS = 4;                 // C-06 / §15: a fifth column is refused, not squeezed
  var ADD_RESULTS = 6;              // rows offered by the in-overlay add search
  var TENANT_NAMES = 3;             // named tenants per cell before "+n more"

  /* ---------------------------------------------------------- string table */
  /* D14: 100 % of user-visible strings live in ONE table, so the keys this
     panel needs that `01-i18n.js` does not ship yet are written INTO that
     table rather than kept locally — the coverage check, the translator
     export and the missing-key lint all keep seeing every string. The guard
     makes this a no-op once the keys are folded into 01-i18n.js, so a string
     is never defined twice. */
  var ADDED = {
    'compare.group.recorded': 'Recorded for at least one property',
    'compare.group.noData': 'No data for any selected property',
    'compare.group.noData.count': '{n} fields',
    'compare.group.noData.body':
      'These fields hold no value for any property in this comparison. They are listed rather than dropped: a field nobody has collected is a fact about the market, not an empty row.',
    'compare.differs': 'Values differ',
    'compare.hiddenIdentical': '{n} rows hidden — every selected property holds the same value.',
    'compare.add.scope': 'Searches the {n} properties in the current results.',
    'compare.add.none': 'No property in the current results matches "{q}".',
    'compare.add.already': 'Already in this comparison',
    'compare.row.distance.note': 'Straight-line (haversine) distance from {name}, the first column.',
    'compare.row.distance.self': 'Reference property',
    'compare.distance.km': '{km} km',
    'compare.distance.m': '{m} m',
    'compare.list.more': 'and {n} more',
    'compare.aria.table': 'Comparison of {n} properties, one column each',
    'compare.csv.title': '{product} — property comparison',
    'compare.csv.date': 'Exported {date}',
    'compare.csv.unknown': '"Not recorded" means the value has never been collected. It does not mean zero.',
    'compare.csv.colField': 'Field',
    'compare.csv.colConfidence': '{name} — confidence',
    'compare.csv.colVerified': '{name} — last verified'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.en[k]) GEO.i18n.en[k] = ADDED[k];
  });

  /* ------------------------------------------------------------ enum → key */
  /* Enum VALUES are UI vocabulary, not data, so each has a string key (IA
     §9.3). Only the vocabularies this table renders are listed; a value the
     map has never seen prints verbatim rather than being swallowed. */
  var ENUM_KEYS = {
    officeClass: { 'A+': 'value.class.aPlus', 'A': 'value.class.a', 'B+': 'value.class.bPlus',
                   'B': 'value.class.b', 'C': 'value.class.c' },
    status: { 'Operating': 'value.status.operating', 'Under construction': 'value.status.construction',
              'Planned': 'value.status.planned', 'Renovation': 'value.status.renovation' },
    confidence: { High: 'value.confidence.high', Medium: 'value.confidence.medium',
                  Low: 'value.confidence.low', Unknown: 'value.confidence.unknown' },
    collectionStatus: { not_collected: 'value.collection.notCollected', partial: 'value.collection.partial',
                        complete: 'value.collection.complete', confirmed_empty: 'value.collection.confirmedEmpty' },
    amenity: { 'restaurant': 'value.amenity.restaurant', 'cafe': 'value.amenity.cafe',
               'retail': 'value.amenity.retail', 'gym': 'value.amenity.gym',
               'conference room': 'value.amenity.conference', 'reception': 'value.amenity.reception',
               'security': 'value.amenity.security', 'underground parking': 'value.amenity.undergroundParking',
               'surface parking': 'value.amenity.surfaceParking', 'EV charging': 'value.amenity.evCharging',
               'bicycle parking': 'value.amenity.bicycleParking', 'backup generator': 'value.amenity.generator' }
  };

  function enumLabel(vocab, value) {
    var key = (ENUM_KEYS[vocab] || {})[value];
    return key ? t(key) : String(value);
  }

  /* --------------------------------------------------------- view state */
  /* None of this is application data: two booleans, a query string, a render
     signature and one element reference for focus return (decision D). */
  var view = { differingOnly: false, noDataOpen: false, q: '' };
  var sig = null;
  var dataVersion = 0;
  var isOpen = false;
  var opener = null;
  var wired = false;

  /* =====================================================================
   * 1. THE ROW MODEL
   * =================================================================== */

  function tenantName(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;
    return U.isKnown(entry.name) ? entry.name : null;
  }

  function listText(names, total) {
    var shown = names.join(', ');
    return total > names.length
      ? shown + ' ' + t('compare.list.more', { n: F.int(total - names.length) })
      : shown;
  }

  function tenantsText(rec) {
    var list = Array.isArray(rec.tenants) ? rec.tenants : [];
    var named = [];
    list.forEach(function (e) {
      var n = tenantName(e);
      if (n && named.length < TENANT_NAMES) named.push(n);
    });
    // §36 / D6: "confirmed empty" is a RECORDED fact and must not read as a
    // gap. `tenants: []` alone cannot say which of the two it is; the status
    // field can, so it is what decides.
    if (!list.length) {
      return rec.tenantsStatus === 'confirmed_empty' ? t('value.collection.confirmedEmpty') : null;
    }
    return named.length ? listText(named, list.length)
                        : GEO.i18n.plural('common.count.records', list.length);
  }

  function amenitiesText(rec) {
    var list = Array.isArray(rec.amenities) ? rec.amenities : [];
    if (!list.length) {
      return rec.amenitiesStatus === 'confirmed_empty' ? t('value.collection.confirmedEmpty') : null;
    }
    var named = list.slice(0, TENANT_NAMES).map(function (a) { return enumLabel('amenity', a); });
    return listText(named, list.length);
  }

  /** The display string for one field, or `null` when the field is unknown —
   *  `null` is what sends the cell to the "Not recorded" treatment. */
  function valueText(rec, fd) {
    var v = rec[fd.key];
    if (fd.key === 'tenants') return tenantsText(rec);
    if (fd.key === 'amenities') return amenitiesText(rec);
    if (!U.isKnown(v)) return null;
    if (fd.key === 'districtKey') return GEO.data.districtName(v);
    if (fd.key === 'officeClass') return enumLabel('officeClass', v);
    if (fd.key === 'status') return enumLabel('status', v);
    if (fd.unit === 'm²') return F.area(v);
    if (fd.unit === 'USD/m²/month') return F.rent(v, 'm²/month');
    // A recorded 8 prints "8%", a recorded 7.5 prints "7.5%": the stored
    // precision is shown, never padded into a precision the source never had.
    if (fd.unit === '%') return F.pct(v, Math.round(v) === v ? 0 : 1);
    if (fd.type === 'year' || fd.type === 'integer') return F.int(v);
    return F.num(v, Math.round(v) === v ? 0 : 1) + (fd.unit ? ' ' + fd.unit : '');
  }

  function verifiedAt(rec, fieldKey) {
    var ev = fieldKey ? GEO.data.evidence(rec, fieldKey) : null;
    // Field-level date first: a field re-verified in the editor carries its
    // own date and must not inherit the record's (D8).
    return (ev && ev.lastVerifiedAt) || (rec._meta && rec._meta.lastVerifiedAt) || null;
  }

  function fieldCell(rec, fd) {
    var text = valueText(rec, fd);
    var known = text !== null;
    var statusText = null;
    if (fd.statusField) {
      var st = rec[fd.statusField] || 'not_collected';
      statusText = t(fd.key === 'tenants' ? 'detail.tenants.status' : 'detail.amenities.status',
                     { status: enumLabel('collectionStatus', st) });
    }
    return {
      text: known ? text : null,
      known: known,
      confidence: known ? GEO.data.confidenceOf(rec, fd.key) : null,
      verified: known ? verifiedAt(rec, fd.key) : null,
      note: statusText
    };
  }

  function plainCell(text, opts) {
    opts = opts || {};
    return { text: text === null || text === undefined ? null : String(text),
             known: text !== null && text !== undefined,
             confidence: opts.confidence || null,
             verified: opts.verified || null,
             note: opts.note || null };
  }

  function distanceText(metres) {
    return metres < 1000 ? t('compare.distance.m', { m: F.int(Math.round(metres)) })
                         : t('compare.distance.km', { km: F.num(metres / 1000, 1) });
  }

  function completenessOf(rec) {
    if (GEO.quality && GEO.quality.completeness) {
      try { return GEO.quality.completeness(rec).text; } catch (e) { /* fall through */ }
    }
    var m = S.criticalFields.length, n = 0;
    S.criticalFields.forEach(function (k) { if (U.isKnown(rec[k])) n++; });
    return t('common.of', { n: F.int(n), m: F.int(m) });
  }

  /** Distance, confidence, completeness and last-verified: derived rows that
   *  are always known, so they always sit in the "recorded" group. They close
   *  the table because they describe the RECORD rather than the building. */
  function derivedRows(recs) {
    var reference = recs[0];
    var hasRefCoords = U.isKnown(reference.lat) && U.isKnown(reference.lng);

    return [
      {
        id: 'distance',
        label: t('compare.row.distance'),
        note: hasRefCoords ? t('compare.row.distance.note', { name: nameOf(reference) }) : null,
        cells: recs.map(function (r, i) {
          if (i === 0) return plainCell(t('compare.row.distance.self'));
          if (!hasRefCoords || !U.isKnown(r.lat) || !U.isKnown(r.lng)) return plainCell(null);
          return plainCell(distanceText(GEO.geo.between(reference, r)));
        })
      },
      {
        id: 'confidence',
        label: t('compare.row.confidence'),
        note: t('quality.confidence.legend'),
        cells: recs.map(function (r) {
          var level = GEO.data.recordConfidence(r);
          return plainCell(level === 'Unknown' ? t('value.confidence.unknown')
                                               : t('quality.confidence.dotLabel', { level: enumLabel('confidence', level) }),
                           { confidence: level });
        })
      },
      {
        id: 'completeness',
        label: t('compare.row.completeness'),
        note: t('quality.completeness.explain', { m: F.int(S.criticalFields.length) }),
        cells: recs.map(function (r) { return plainCell(completenessOf(r)); })
      },
      {
        id: 'lastVerified',
        label: t('field.lastVerifiedAt'),
        note: null,
        cells: recs.map(function (r) {
          var lv = verifiedAt(r, null);
          return plainCell(U.isKnown(lv) ? F.date(lv) : null);
        })
      }
    ];
  }

  /** A row differs when its columns do not all hold the same thing. Marked as
   *  DIFFERENT, never as better (decision A). All-unknown rows are identical
   *  by definition, which is also what C-07 requires of the toggle. */
  function markDiffering(row) {
    var first = null, differs = false, knownCount = 0;
    row.cells.forEach(function (c, i) {
      var key = c.known ? '1' + JSON.stringify(c.text) : '0';
      if (c.known) knownCount++;
      if (i === 0) first = key; else if (key !== first) differs = true;
    });
    row.known = knownCount > 0;
    row.differs = differs;
    return row;
  }

  /** The registry owns the label; i18n owns its wording. A field the string
   *  table has not caught up with falls back to the registry rather than
   *  printing a key at the reader. */
  function fieldLabel(key) {
    var s = t('field.' + key);
    return s === 'field.' + key ? S.label(key) : s;
  }

  function buildRows(recs) {
    var rows = S.compareFields.map(function (key) {
      var fd = S.byKey[key];
      return markDiffering({
        id: key,
        label: fieldLabel(key),
        note: null,
        cells: recs.map(function (r) { return fieldCell(r, fd); })
      });
    });
    derivedRows(recs).forEach(function (r) { rows.push(markDiffering(r)); });
    return rows;
  }

  /* =====================================================================
   * 2. RENDERING
   * =================================================================== */

  function nameOf(rec) { return U.isKnown(rec.name) ? rec.name : F.UNKNOWN; }

  function confidenceChip(level) {
    var label = level === 'Unknown'
      ? t('value.confidence.unknown')
      : t('quality.confidence.dotLabel', { level: enumLabel('confidence', level) });
    // §2.7 / visual-system §4: the dot NEVER appears without its word.
    return el('span.conf', { 'data-conf': level }, [
      el('span.conf__dot', { 'aria-hidden': 'true' }),
      el('span.conf__label', { text: label })
    ]);
  }

  function cellNode(cell, rowId) {
    var kids = [];
    if (!cell.known) {
      kids.push(el('span.unk', { text: F.UNKNOWN }));
    } else if (rowId === 'confidence') {
      // The confidence row IS a confidence chip; a second copy below it would
      // say the same thing twice.
      kids.push(confidenceChip(cell.confidence));
    } else {
      kids.push(el('div', { text: cell.text }));
    }
    if (cell.note) kids.push(el('div.micro', { text: cell.note }));
    if (cell.known && cell.confidence && rowId !== 'confidence') {
      kids.push(el('div', {}, [confidenceChip(cell.confidence)]));
    }
    if (cell.known && cell.verified) {
      kids.push(el('div.micro', { text: t('detail.quality.verified', { date: F.date(cell.verified) }) }));
    }
    return el('td.cmp__val', { 'data-known': cell.known ? 'true' : 'false' }, kids);
  }

  function rowNode(row) {
    var head = [el('span', { text: row.label })];
    // Marked as different — never as better, never with colour or an arrow.
    if (row.differs) head.push(el('span.cmp__colmeta', { text: t('compare.differs') }));
    if (row.note) head.push(el('span.cmp__colmeta', { text: row.note }));

    return el('tr', {}, [el('th.cmp__rowhd', { scope: 'row' }, head)].concat(
      row.cells.map(function (c) { return cellNode(c, row.id); })
    ));
  }

  function columnHead(rec, count) {
    var meta = [GEO.data.districtName(rec.districtKey),
                U.isKnown(rec.officeClass) ? enumLabel('officeClass', rec.officeClass)
                                           : t('value.class.unknown')].join(' · ');
    var kids = [];

    // C-08. Not a `.btn`: the print sheet hides `.btn`, and a printed
    // comparison with no column names is not a comparison.
    kids.push(el('button.cmp__colname', {
      type: 'button', text: nameOf(rec), title: t('compare.open', { name: nameOf(rec) }),
      onclick: function () {
        GEO.state.set({ overlay: null, selectedId: rec.id, rightRail: 'open', rightTab: 'property' },
                      { source: 'user', action: 'compare:open', summary: nameOf(rec) });
      }
    }));
    // D4: a synthetic record is badged everywhere it appears.
    if (rec.recordType === 'DEMO') kids.push(el('span.badge.badge--demo', { text: t('common.demo.badge') }));
    kids.push(el('span.cmp__colmeta', { text: meta }));

    if (count > MIN_COLS) {
      kids.push(el('button.btn.btn--icon', {
        type: 'button', text: '×',
        'aria-label': t('compare.removeColumn', { name: nameOf(rec) }),
        onclick: function () { removeColumn(rec.id); }
      }));
    } else {
      // §29: the control is disabled with its reason visible, not missing.
      var reasonId = 'cmp-min-' + rec.id;
      kids.push(el('button.btn.btn--icon', {
        type: 'button', disabled: true, text: '×',
        'aria-label': t('compare.removeColumn', { name: nameOf(rec) }),
        'aria-describedby': reasonId
      }));
      kids.push(el('span.reason', { id: reasonId, text: t('compare.min') }));
    }
    return el('th', { scope: 'col' }, kids);
  }

  function table(recs, rows) {
    var span = recs.length + 1;
    var recorded = rows.filter(function (r) { return r.known; });
    var empty = rows.filter(function (r) { return !r.known; });

    var shownRecorded = view.differingOnly
      ? recorded.filter(function (r) { return r.differs; })
      : recorded;
    var hiddenIdentical = recorded.length - shownRecorded.length;

    var head = el('thead', {}, [
      el('tr', {}, [el('th.cmp__rowhd', { scope: 'col' }, [
        el('span', { text: t('compare.group.recorded') })
      ])].concat(recs.map(function (r) { return columnHead(r, recs.length); })))
    ]);

    var bodies = [el('tbody', {}, shownRecorded.map(rowNode))];

    // Decision B: the no-data group is present, counted and collapsed — never
    // dropped. The `Show only differing rows` toggle suppresses it entirely,
    // because every one of its rows is identical in every column (C-07).
    if (empty.length && !view.differingOnly) {
      var headBtn = el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        'aria-expanded': view.noDataOpen ? 'true' : 'false',
        'aria-controls': 'cmp-nodata',
        text: (view.noDataOpen ? '▾ ' : '▸ ') + t('compare.group.noData'),
        onclick: function () { view.noDataOpen = !view.noDataOpen; redraw(); }
      });
      bodies.push(el('tbody', {}, [
        el('tr', {}, [el('th.cmp__rowhd', { scope: 'row', colspan: String(span) }, [
          headBtn,
          el('span.cmp__colmeta', { text: t('compare.group.noData.count', { n: F.int(empty.length) }) }),
          el('span.cmp__colmeta', { text: t('compare.group.noData.body') })
        ])])
      ]));
      bodies.push(el('tbody#cmp-nodata', { hidden: !view.noDataOpen }, empty.map(rowNode)));
    }

    var tbl = el('table.cmp__table', {}, [
      el('caption.vh', { text: t('compare.aria.table', { n: F.int(recs.length) }) }),
      head
    ].concat(bodies));

    return {
      node: el('div.cmp__scroll', {}, [tbl]),
      hiddenIdentical: hiddenIdentical,
      hiddenEmpty: view.differingOnly ? empty.length : 0,
      emptyCount: empty.length
    };
  }

  /* --------------------------------------------------------------- the bar */
  function addSearch(rows, recs) {
    var full = recs.length >= MAX_COLS;
    var kids = [];

    var input = el('input.input', {
      type: 'search', id: 'cmp-add', value: view.q, autocomplete: 'off', spellcheck: 'false',
      placeholder: t('compare.add.placeholder'), disabled: full,
      'aria-describedby': 'cmp-add-hint',
      oninput: function (e) { view.q = e.target.value; redraw(true); }
    });

    kids.push(el('label.field__label', { for: 'cmp-add', text: t('compare.add') }));
    kids.push(input);
    kids.push(el('span.reason', { id: 'cmp-add-hint',
      text: full ? t('compare.limit') : t('compare.add.scope', { n: F.int(rows.length) }) }));

    var out = [el('div.field', {}, kids)];
    if (full || !view.q.trim()) return out;

    var staged = {};
    recs.forEach(function (r) { staged[r.id] = true; });
    var res = GEO.search
      ? GEO.search.query(rows, view.q, { limit: ADD_RESULTS, districts: false })
      : { items: [] };

    if (!res.items.length) {
      out.push(el('p.micro', { text: t('compare.add.none', { q: view.q }) }));
      return out;
    }
    out.push(el('div.stack', {}, res.items.map(function (item) {
      var rec = item.record;
      var already = !!staged[rec.id];
      return el('button.btn.btn--quiet.btn--sm', {
        type: 'button', disabled: already,
        text: nameOf(rec) + ' · ' + GEO.data.districtName(rec.districtKey) +
              (already ? ' — ' + t('compare.add.already') : ''),
        onclick: function () { addColumn(rec.id); }
      });
    })));
    return out;
  }

  function bar(rows, recs) {
    var kids = [];

    kids.push(el('label.check', {}, [
      el('input', {
        type: 'checkbox', checked: view.differingOnly,
        onchange: function (e) { view.differingOnly = !!e.target.checked; redraw(); }
      }),
      el('span.check__text', { text: t('compare.differing') })
    ]));

    kids.push(el('button.btn.btn--quiet.btn--sm.push', {
      type: 'button', text: t('compare.export'),
      onclick: function () { exportCsv(recs); }
    }));
    kids.push(el('button.btn.btn--quiet.btn--sm', {
      type: 'button', text: t('compare.print'), onclick: printCompare
    }));

    return [el('div.cmp__bar', {}, kids),
            el('div.cmp__bar', {}, addSearch(rows, recs))];
  }

  /* ------------------------------------------------------------ empty state */
  function emptyState() {
    // IA §7: an empty state names the CAUSE and offers the ESCAPE.
    return el('div.empty.empty--center', {}, [
      el('p.empty__title', { text: t('empty.compare.title') }),
      el('p.empty__body', { text: t('empty.compare.body') }),
      el('div.empty__actions', {}, [
        el('button.btn.btn--primary.btn--sm', {
          type: 'button', text: t('empty.compare.action'),
          onclick: function () {
            GEO.state.set({ overlay: null, leftRail: 'open', leftTab: 'results' },
                          { source: 'user', action: 'compare:openList' });
          }
        })
      ])
    ]);
  }

  /* ----------------------------------------------------------------- draw */
  function draw(body, state, rows) {
    var recs = state.compare.map(function (id) { return GEO.data.get(id); })
                            .filter(function (r) { return !!r; });

    if (recs.length < MIN_COLS) {
      Q.fill(body, [el('div.cmp', {}, [emptyState()])]);
      return;
    }

    var model = buildRows(recs);
    var built = table(recs, model);
    var foot = [];

    if (view.differingOnly && built.hiddenIdentical) {
      foot.push(el('p.cmp__foot', { text: t('compare.hiddenIdentical', { n: F.int(built.hiddenIdentical) }) }));
    }
    if (built.hiddenEmpty) {
      foot.push(el('p.cmp__foot', { text: t('compare.hiddenRows', { n: F.int(built.hiddenEmpty) }) }));
    }
    if (recs.some(function (r) { return r.recordType === 'DEMO'; })) {
      foot.push(el('p.cmp__foot', {
        text: t('analytics.demo', {
          n: F.int(recs.filter(function (r) { return r.recordType === 'DEMO'; }).length)
        })
      }));
    }
    // Decision A, stated on screen and in the export.
    foot.push(el('p.cmp__foot', { text: t('compare.noWinner') }));

    Q.fill(body, [el('div.cmp', {}, bar(rows, recs).concat([built.node]).concat(foot))]);
  }

  /* =====================================================================
   * 3. ACTIONS
   * =================================================================== */

  function removeColumn(id) {
    var s = GEO.state.get();
    if (s.compare.length <= MIN_COLS) { GEO.boot.toast(t('compare.min')); return; }
    var rec = GEO.data.get(id);
    GEO.state.set({ compare: s.compare.filter(function (x) { return x !== id; }) },
                  { source: 'user', action: 'compare:remove', summary: rec ? nameOf(rec) : id });
  }

  function addColumn(id) {
    var s = GEO.state.get();
    if (s.compare.indexOf(id) >= 0) return;
    // §15: a fifth column is refused out loud. Silently dropping it, or
    // silently swapping one out, would lose the user's selection without
    // saying so.
    if (s.compare.length >= MAX_COLS) { GEO.boot.toast(t('toast.compareFull')); return; }
    var rec = GEO.data.get(id);
    view.q = '';
    GEO.state.set({ compare: s.compare.concat([id]) },
                  { source: 'user', action: 'compare:add', summary: rec ? nameOf(rec) : id });
  }

  function close() {
    GEO.state.set({ overlay: null }, { source: 'user', action: 'compare:close' });
  }

  /* ------------------------------------------------------------ CSV (C-09) */
  function csvCell(v) {
    if (v === null || v === undefined) return '';
    var s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv(recs) {
    var rows = buildRows(recs);
    var demo = recs.filter(function (r) { return r.recordType === 'DEMO'; });

    var head = [
      '# ' + t('compare.csv.title', { product: GEO.PRODUCT.name }),
      '# ' + t('compare.csv.date', { date: F.date(GEO.date.today()) }),
      '# ' + t('compare.csv.unknown'),
      '# ' + t('compare.noWinner')
    ];
    if (demo.length) head.push('# ' + t('common.demo.included', { n: F.int(demo.length) }));

    // Three columns per property: the value, the confidence behind it and the
    // date it was last verified. A comparison that travels without its
    // provenance is the artefact this product exists to replace.
    var cols = [t('compare.csv.colField')];
    recs.forEach(function (r) {
      cols.push(nameOf(r));
      cols.push(t('compare.csv.colConfidence', { name: nameOf(r) }));
      cols.push(t('compare.csv.colVerified', { name: nameOf(r) }));
    });

    var lines = [cols.map(csvCell).join(',')];
    rows.forEach(function (row) {
      var line = [row.label];
      row.cells.forEach(function (c) {
        line.push(c.known ? c.text : F.UNKNOWN);
        line.push(c.confidence ? enumLabel('confidence', c.confidence) : '');
        line.push(c.verified ? F.date(c.verified) : '');
      });
      lines.push(line.map(csvCell).join(','));
    });

    GEO.boot.download(head.join('\n') + '\n' + lines.join('\n'),
                      'geo-mvp-comparison-' + GEO.date.today() + '.csv', 'text/csv');
    GEO.boot.toast(t('toast.exported'));
  }

  /* ---------------------------------------------------------- print (C-10) */
  function printCompare() {
    var root = document.documentElement;
    var done = false;
    function cleanup() {
      if (done) return;
      done = true;
      delete root.dataset.print;
      w.removeEventListener('afterprint', cleanup);
    }
    // 09-print keys the "only the overlay prints" rules off this attribute.
    root.dataset.print = 'compare';
    w.addEventListener('afterprint', cleanup);
    try { w.print(); }
    catch (e) { GEO.boot.toast(t('error.print')); cleanup(); return; }
    setTimeout(cleanup, 1000);          // engines that never fire `afterprint`
  }

  /* =====================================================================
   * 4. FOCUS (C-04, IA §6.2)
   * =================================================================== */

  /* The element that opened the overlay is whatever last held focus outside
     it — the tray button, a list card, the `C` shortcut's focus owner or an
     assistant response action. Recording it here means focus return works for
     all of them without any of them having to tell us. */
  function trackOpener(e) {
    var n = e.target;
    if (!n || n === document.body || !n.closest) return;
    if (n.closest(OVERLAY)) return;
    opener = n;
  }

  function focusHeading() {
    var h = Q.$(TITLE);
    if (!h) return;
    // The heading, not the close button: a screen-reader user must hear WHAT
    // opened (IA §6.2).
    h.setAttribute('tabindex', '-1');
    h.focus();
  }

  function restoreFocus() {
    var target = (opener && document.contains(opener) && !opener.disabled) ? opener : null;
    if (!target) target = Q.$('#btn-open-compare');
    if (target && target.offsetParent === null) target = Q.$('#results-list');
    // Never `document.body`: if nothing survives, leave focus where it is.
    if (target && target.focus) target.focus();
  }

  /* =====================================================================
   * 5. RENDER
   * =================================================================== */

  function signature(state, rows) {
    return [state.compare.join('|'), state.demoMode ? '1' : '0', state.role,
            GEO.i18n.locale, String(dataVersion), String(rows.length),
            view.differingOnly ? '1' : '0', view.noDataOpen ? '1' : '0', view.q].join('|');
  }

  /** A view-only change (a disclosure, the differing-rows toggle, the add
   *  query) redraws this panel and nothing else. It is not an application
   *  event and does not belong in the §61 session log. */
  function redraw(keepFocus) {
    var body = Q.$(BODY);
    if (!body || !isOpen) return;
    var active = document.activeElement;
    var id = keepFocus && active ? active.id : null;
    var caret = (id && active.setSelectionRange && active.type === 'search') ? active.selectionStart : null;
    sig = null;
    render(GEO.state.get(), GEO.boot.visible(GEO.state.get()));
    if (!id) return;
    var back = document.getElementById(id);
    if (!back) return;
    back.focus();
    if (caret !== null && back.setSelectionRange) {
      try { back.setSelectionRange(caret, caret); } catch (e) { /* not a text input */ }
    }
  }

  function render(state, rows) {
    var body = Q.$(BODY);
    if (!body) return;

    if (state.overlay !== 'compare') {
      if (isOpen) { isOpen = false; sig = null; restoreFocus(); }
      return;
    }

    var justOpened = !isOpen;
    if (justOpened) {
      isOpen = true;
      view.q = '';
      sig = null;
    }

    var s = signature(state, rows);
    if (s === sig) return;
    sig = s;
    draw(body, state, rows);
    if (justOpened) focusHeading();
  }

  /* =====================================================================
   * 6. WIRING
   * =================================================================== */

  function wire() {
    if (wired) return;
    var overlay = Q.$(OVERLAY);
    if (!overlay) return;
    wired = true;

    document.addEventListener('focusin', trackOpener);

    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') {
        if (GEO.boot && GEO.boot.trapFocus) GEO.boot.trapFocus(overlay, e);
        return;
      }
      if (e.key === 'Escape') {
        // Handled here and stopped here: 99-boot's global handler ignores keys
        // typed inside an input, so the add-search box would otherwise be a
        // place where Esc does nothing.
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    });

    // The overlay header's Print button is shell markup with no owner but
    // this panel; wiring it here is what stops it being a dead control (§29).
    var print = Q.$('#compare-print');
    if (print) print.addEventListener('click', printCompare);
  }

  /* A dataset edit changes a cell's contents without changing the id set, so
     the signature has to move with it or the table would show stale values. */
  GEO.on('data:changed', function () { dataVersion += 1; });
  GEO.on('i18n:locale', function () { dataVersion += 1; });

  /* 99-boot is the LAST module in the manifest, so `GEO.boot` does not exist
     while this file is evaluated. `data:loaded` fires from inside boot's
     start(), after the repository is populated and before the first state
     broadcast — early enough to catch the opening render. */
  var registered = false;
  function registerPanel() {
    if (registered || !GEO.boot || !GEO.boot.registerPanel) return;
    registered = true;
    wire();
    GEO.boot.registerPanel(render);
  }
  registerPanel();
  GEO.on('data:loaded', registerPanel);
}(window));
