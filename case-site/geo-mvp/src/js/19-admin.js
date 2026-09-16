/* ===========================================================================
 * 19-admin — the data workspace: Records · Local changes · Import / Export
 * (R8 · brief §21, IA §5.9 D-01…D-24, build contract M1, M2, M3, M8, M12, M13)
 *
 * Module 18 owns Coverage, Quality and Duplicates in the same container; this
 * file renders only when `state.dataTab` is one of ITS three tabs, so the two
 * never fight over `#data-body`.
 *
 * Five decisions shape this file.
 *
 * A. THE FORM IS GENERATED, NOT WRITTEN.
 *    Every editor control comes from `GEO.schema.fields` grouped by
 *    `GEO.schema.groups`. Adding a field to the registry makes it appear here,
 *    in the detail card, in the CSV and in the completeness score at the same
 *    moment. There is no second list of fields in this file — the only field
 *    keys spelled out are the ones with genuinely special behaviour (lat/lng,
 *    districtKey, tenants), and each is commented where it appears.
 *
 * B. EVERY INPUT GOES THROUGH `GEO.schema.coerce`. ONCE.
 *    An empty input is `null` — unknown — never `0` and never `""` (D2, §36).
 *    "34,8" and "$34.8" normalise; "abc" produces a NAMED error next to the
 *    field instead of a silent 0. This is the single choke point M13 exists to
 *    create, and it lives in the schema, not here, so the importer and the
 *    normaliser use the same rules.
 *
 * C. ERRORS BLOCK, WARNINGS ARE ACKNOWLEDGED.
 *    A coordinate outside the Tashkent envelope is an ERROR and names the
 *    expected range: the building would be unmappable. A rent of $300 is a
 *    WARNING: the platform's job is to record the market, not to argue with
 *    it. Warnings never block the save, but they must be seen and ticked, so
 *    a surprising value is entered deliberately rather than by accident.
 *
 * D. AN EDIT IS NOT EVIDENCE.
 *    The provenance block defaults confidence to **Unknown**. Defaulting to
 *    High would let the act of typing a number manufacture the confidence the
 *    number has not earned (§2.3). `GEO.data.update` writes per-field evidence
 *    for exactly the fields that changed, so one re-verified rent does not
 *    re-date the whole record.
 *
 * E. NOTHING DESTRUCTIVE HAPPENS WITHOUT A WAY BACK.
 *    A 20-deep undo stack (M1) covers edit, add, delete, coordinate move and
 *    revert; every destructive toast carries Undo; delete names the record;
 *    the two resets are separate commands with separate confirms naming
 *    exactly what is lost (D15). The undo stack holds record SNAPSHOTS — the
 *    one place this module deliberately keeps a copy of data, because an undo
 *    stack is nothing else.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, el = Q.el, F = GEO.fmt, S = GEO.schema;
  var t = GEO.i18n.t;

  var A = GEO.admin = {};

  var BODY = '#data-body';
  var OVERLAY = '#overlay-data';

  /* The three tabs this module owns. Everything else in the workspace belongs
     to 18-panel-quality, and we leave its DOM entirely alone. */
  var MINE = { records: true, changes: true, io: true };

  var UNDO_DEPTH = 20;              // T4 — the storage cap is the same number
  var PAGE = 50;                    // records rendered per page
  var REJECT_PREVIEW = 3;           // rejected rows named in the import headline

  /* ---------------------------------------------------------- string table */
  /* D14: 100 % of user-visible strings live in ONE table, so keys this panel
     needs that `01-i18n.js` does not ship yet are written INTO that table
     rather than kept locally — the coverage check, the translator export and
     the missing-key lint all keep seeing every string. The guard makes this a
     no-op once the keys are folded into 01-i18n.js, so nothing is defined twice. */
  var ADDED = {
    'admin.records.title': 'Records',
    'admin.records.scope': 'All {n} records held in this browser, including {d} demo records. Demo records are excluded from every market statistic unless demo records are on.',
    'admin.records.scope.noDemo': 'All {n} records held in this browser.',
    'admin.records.onlyFiltered': 'Only records matching the current filters',
    'admin.records.onlyFiltered.count': '{n} of {m} records match',
    'admin.records.search.placeholder': 'Filter by name, address or district…',
    'admin.records.search.none': 'No record matches "{q}". The filter covers name, address and district, in Cyrillic and in Latin.',
    'admin.records.showing': 'Showing {n} of {m} records',
    'admin.records.showMore': 'Show {n} more',
    'admin.records.col.name': 'Property',
    'admin.records.col.district': 'District',
    'admin.records.col.class': 'Class',
    'admin.records.col.rent': 'Asking rent',
    'admin.records.col.completeness': 'Critical fields',
    'admin.records.col.confidence': 'Confidence',
    'admin.records.col.verified': 'Last verified',
    'admin.records.col.actions': 'Edit',
    'admin.records.sort.asc': 'Sorted ascending',
    'admin.records.sort.dir.asc': 'Ascending — switch to descending',
    'admin.records.sort.dir.desc': 'Descending — switch to ascending',
    'admin.records.card.aria': 'Records, {n} shown',
    'admin.records.sort.desc': 'Sorted descending',
    'admin.records.editedBadge': 'Edited locally',
    'admin.records.addedBadge': 'Added locally — not verified',

    'admin.form.back': 'Back to all records',
    'admin.form.errors.title.one': 'Fix 1 problem before saving',
    'admin.form.errors.title.other': 'Fix {n} problems before saving',
    'admin.form.warnings.title.one': 'Confirm 1 warning before saving',
    'admin.form.warnings.title.other': 'Confirm {n} warnings before saving',
    'admin.form.warnings.ack': 'I have checked these values against the source and they are correct as entered.',
    'admin.form.save.warnings': 'Confirm the warnings above before saving',
    'admin.form.addSource.disabled': 'This prototype records one source per edit. Multiple source rows per field need a backend.',
    'admin.form.prov.title': 'Provenance for this edit',
    'admin.form.prov.note': 'These details are written against every field you changed, and against nothing else. An edit is not evidence, so confidence starts at Not verified.',
    'admin.form.prov.confidence.hint': 'Raise this only when you have checked the value at the source named above.',
    'admin.form.nextRefresh': 'Next refresh from this date: fast fields {fast}, slow fields {slow}, stable fields {stable}.',
    'admin.form.current': 'Stored now: {value}',
    'admin.form.tenants.disabled': 'Tenant records can only be supplied through JSON import in this prototype.',
    'admin.form.district.mismatch': 'These coordinates fall inside {computed}, but the record says {claimed}. The boundary is authoritative for every map, chart and filter.',
    'admin.form.district.use': 'Use {name}',
    'admin.form.district.outside': 'These coordinates fall outside every Tashkent district boundary.',
    'admin.form.district.noGeometry': 'District boundaries did not load, so the coordinates cannot be checked against them.',
    'admin.form.pickOnMap.hint': 'Click the map to place this property. Press Escape to cancel.',
    'admin.form.pickOnMap.disabled': 'The map did not start, so coordinates must be typed.',
    'admin.form.pickOnMap.done': 'Coordinates taken from the map',
    'admin.form.unknownOption': 'Not recorded',
    'admin.form.newBadge': 'Not saved yet',

    'admin.undo.label.edit': 'the edit to "{name}"',
    'admin.undo.label.add': 'adding "{name}"',
    'admin.undo.label.delete': 'deleting "{name}"',
    'admin.undo.label.revert': 'reverting {field} on "{name}"',
    'admin.undo.label.restore': 'restoring "{name}"',
    'admin.undo.done': 'Undone — {what}',
    'admin.undo.available': 'Undo {what}',
    'admin.undo.cleared': 'The undo history was cleared because the whole dataset was replaced.',

    'admin.changes.count.fields.one': '1 field',
    'admin.changes.count.fields.other': '{n} fields',
    'admin.changes.summary.line': '{records} with local changes, {fields} edited.',
    'admin.changes.added.title': 'Added',
    'admin.changes.changed.title': 'Changed',
    'admin.changes.deleted.title': 'Deleted',
    'admin.changes.revertRecord': 'Revert every field on this record',
    'admin.changes.revertRecord.confirm': 'Revert {n} fields on "{name}"?',
    'admin.changes.revertRecord.body': 'Every edited field returns to the value shipped with the prototype. Nothing else on the record changes.',
    'admin.changes.netZero': '{n} records were added and then deleted in this session. They are not a difference from the shipped dataset, so they are not listed above.',
    'admin.changes.addedNote': 'Added in this browser. This record is not in the shipped dataset and carries no collected evidence.',
    'admin.changes.deletedNote': 'Removed from every count, chart and map layer. The record is kept so it can be restored.',
    'admin.changes.reverted': 'Reverted {n} fields on "{name}"',

    'admin.io.title': 'Import and export',
    'admin.io.export.title': 'Export',
    'admin.io.exportJson.contents': 'This file will hold all {n} records with their provenance.',
    'admin.io.exportJson.demo': 'It will be marked as containing {n} synthetic demo records, and carries a warning line at the top of the file.',
    'admin.io.exportCsv.contents': 'This file will hold the {n} records matching the current filters: {filters}',
    'admin.io.exportCsv.demo': '{n} of them are demo records and are labelled as such in the recordType column.',
    'admin.io.exportCsv.none': 'No record matches the current filters, so there is nothing to export.',
    'admin.io.import.title': 'Import',
    'admin.io.import.choose': 'Choose a JSON file',
    'admin.io.import.reading': 'Reading the file…',
    'admin.io.import.failed': 'The file could not be read by this browser.',
    'admin.io.report.headline': '{ok} valid, {bad} rejected: {examples}',
    'admin.io.report.headline.clean': '{ok} valid, none rejected.',
    'admin.io.report.more': 'and {n} more',
    'admin.io.commit.all': 'Import all {n} records',
    'admin.io.commit.blocked': 'A file with rejected rows is never imported in part. Fix the file and choose it again.',
    'admin.io.commit.replaces': 'Importing replaces every record currently held in this browser and clears the undo history.',
    'admin.io.demo.confirm': 'Turn on demo records?',
    'admin.io.demo.confirm.body': 'Every figure on screen — counts, averages, distributions and the assistant’s answers — will then include {n} synthetic records that are not market evidence. A banner stays on screen for as long as they are on, and every metric that includes one says so.',
    'admin.io.demo.state.on': 'Demo records are ON. Figures may include synthetic values.',
    'admin.io.demo.state.off': 'Demo records are OFF. Every figure is drawn from observed records only.',
    'admin.io.reset.title': 'Start again',
    'admin.reset.restore.count': 'Discarded: {changed} edited, {added} added, {deleted} deleted.',
    'admin.reset.restore.nothing': 'There are no local changes, so this would change nothing.',
    'admin.reset.full.count': 'This clears {n} stored keys, including edits, the demo setting and the chosen language.',
    'admin.storage.kb': '{n} KB',
    'admin.storage.bytes': '{n} bytes'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.en[k]) GEO.i18n.en[k] = ADDED[k];
  });

  /* ------------------------------------------------------------ enum → key */
  /* Enum VALUES are UI vocabulary, not data (IA §9.3). A value the table has
     never seen prints verbatim rather than being swallowed. */
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
    amenity: { 'restaurant': 'value.amenity.restaurant', 'cafe': 'value.amenity.cafe',
               'retail': 'value.amenity.retail', 'gym': 'value.amenity.gym',
               'conference room': 'value.amenity.conference', 'reception': 'value.amenity.reception',
               'security': 'value.amenity.security', 'underground parking': 'value.amenity.undergroundParking',
               'surface parking': 'value.amenity.surfaceParking', 'EV charging': 'value.amenity.evCharging',
               'bicycle parking': 'value.amenity.bicycleParking', 'backup generator': 'value.amenity.generator' },
    collectionStatus: { not_collected: 'value.collection.notCollected', partial: 'value.collection.partial',
                        complete: 'value.collection.complete', confirmed_empty: 'value.collection.confirmedEmpty' }
  };

  function enumLabel(vocab, value) {
    var key = (ENUM_KEYS[vocab] || {})[value];
    return key ? t(key) : String(value);
  }

  /** The registry owns the label; i18n owns its wording. A field the string
   *  table has not caught up with falls back to the registry rather than
   *  printing a key at the reader. */
  function fieldLabel(key) {
    // `has()` rather than calling `t()` and comparing: a miss through `t()` is
    // logged as a defect, and a field whose label the table has not caught up
    // with is a gap to fall back from, not an error to report on every render.
    return GEO.i18n.has('field.' + key) ? t('field.' + key) : S.label(key);
  }

  /* The registry's group labels are English literals in the schema; D14 says
     every user-visible string comes from the table, so the group keys map to
     the section names the property card already uses — one wording, one place. */
  var GROUP_KEYS = {
    identification: 'detail.section.overview',
    property: 'detail.section.building',
    commercial: 'detail.section.commercial',
    tenants: 'detail.section.tenants',
    amenities: 'detail.section.amenities'
  };

  function groupLabel(g) {
    var key = GROUP_KEYS[g.key];
    return key ? t(key) : g.label;
  }

  function nameOf(rec) {
    return rec && U.isKnown(rec.name) ? rec.name : F.UNKNOWN;
  }

  /* ---------------------------------------------------------- view state */
  /* None of this is application data: a query string, a sort, a page index,
     the unsaved contents of one form, and one import report awaiting a
     decision. Records are re-derived from `GEO.data` on every draw. */
  var view = {
    q: '',
    sort: 'name',
    dir: 'asc',
    page: 1,
    filteredOnly: false,
    form: null,
    report: null,          // { result, filename } — validated, not yet applied
    reportBusy: false,
    picking: false
  };

  var undoStack = [];      // decision E — the one deliberate copy of data
  var sig = null;
  var dataVersion = 0;
  var isOpen = false;
  var wired = false;

  /* =====================================================================
   * 1. UNDO (M1, D-12)
   * =================================================================== */

  function pushUndo(label, run) {
    undoStack.push({ label: label, run: run });
    // T4: the stack is capped so a long editing session cannot grow without
    // bound; the oldest entry is the one a user is least likely to want back.
    while (undoStack.length > UNDO_DEPTH) undoStack.shift();
  }

  /** Undo of an edit restores the whole record snapshot rather than applying an
   *  inverse patch: a patch would be re-stamped with today's provenance by
   *  `GEO.data.update` and the record would come back wearing evidence it
   *  never had. Remove-then-restore returns `_evidence` and `_meta` intact. */
  function restoreSnapshot(before) {
    return function () {
      GEO.data.remove(before.id);
      GEO.data.restore(before);
    };
  }

  A.canUndo = function () { return undoStack.length > 0; };
  A.undoDepth = function () { return undoStack.length; };
  A.undoLabel = function () {
    return undoStack.length ? undoStack[undoStack.length - 1].label : null;
  };

  /** Bound to Ctrl/Cmd+Z in 99-boot and offered in every destructive toast. */
  A.undo = function () {
    var entry = undoStack.pop();
    if (!entry) {
      if (GEO.boot) GEO.boot.toast(t('admin.undo.disabled'));
      return false;
    }
    try { entry.run(); }
    catch (e) { GEO.log.error('admin: undo failed', e); }
    closeForm(true);
    if (GEO.boot) GEO.boot.toast(t('admin.undo.done', { what: entry.label }));
    return true;
  };

  function clearUndo() { undoStack.length = 0; }

  /* =====================================================================
   * 2. SHARED PIECES
   * =================================================================== */

  function confidenceChip(level) {
    // §2.7 / visual-system §4: the dot NEVER appears without its word.
    var label = level === 'Unknown'
      ? t('value.confidence.unknown')
      : t('quality.confidence.dotLabel', { level: enumLabel('confidence', level) });
    return el('span.conf', { 'data-conf': level }, [
      el('span.conf__dot', { 'aria-hidden': 'true' }),
      el('span.conf__label', { text: label })
    ]);
  }

  function unknownNode() { return el('span.unk', { text: F.UNKNOWN }); }

  /** The display string for one stored value, or null when it is unknown. */
  function valueText(rec, fd) {
    var v = rec[fd.key];
    if (fd.type === 'tenantList') {
      // Tenants are objects, not scalars. `tenants: []` alone cannot say
      // whether nobody has looked or the building is empty, so the status
      // field decides (§36).
      var list = Array.isArray(v) ? v : [];
      if (list.length) return GEO.i18n.plural('common.count.records', list.length);
      return rec.tenantsStatus === 'confirmed_empty' ? t('value.collection.confirmedEmpty') : null;
    }
    if (!U.isKnown(v)) return null;
    if (Array.isArray(v)) {
      return v.map(function (x) {
        return fd.enumKey ? enumLabel(fd.enumKey, x) : String(x);
      }).join(', ');
    }
    if (fd.key === 'districtKey') return GEO.data.districtName(v);
    if (fd.enumKey) return enumLabel(fd.enumKey, v);
    if (fd.unit === 'm²') return F.area(v);
    if (fd.unit === 'USD/m²/month') return F.rent(v, 'm²/month');
    if (fd.unit === '%') return F.pct(v, Math.round(v) === v ? 0 : 1);
    if (fd.type === 'year' || fd.type === 'integer') return F.int(v);
    if (fd.type === 'number') return F.num(v, Math.round(v) === v ? 0 : 1) + (fd.unit ? ' ' + fd.unit : '');
    return String(v);
  }

  function demoBadge(rec) {
    // D4: a synthetic record is badged everywhere it appears.
    return rec.recordType === 'DEMO' ? el('span.badge.badge--demo', { text: t('common.demo.badge') }) : null;
  }

  function localBadge(rec) {
    var m = rec._meta || {};
    if (m.addedLocally) return el('span.badge.badge--flag', { text: t('admin.records.addedBadge') });
    if (m.editedLocally) return el('span.badge.badge--flag', { text: t('admin.records.editedBadge') });
    return null;
  }

  function sectionTitle(text) { return el('h3.sectitle', { text: text }); }

  /** Every record currently held, demo included. The Records tab is the
   *  inventory of what is STORED, not a market statistic, so the demo seam
   *  does not apply here — the badge and the scope line carry the distinction
   *  instead. Hiding demo records here would make them uneditable and
   *  invisible exactly when someone is trying to understand them (D4). */
  function allRecords() {
    return GEO.data.observed().concat(GEO.data.demoRecords());
  }

  /* =====================================================================
   * 3. RECORDS TAB (D-02, D-03, D-11)
   * =================================================================== */

  var SORTS = [
    { key: 'name',         labelKey: 'admin.records.col.name' },
    { key: 'districtKey',  labelKey: 'admin.records.col.district' },
    { key: 'officeClass',  labelKey: 'admin.records.col.class' },
    { key: 'askingRent',   labelKey: 'admin.records.col.rent', num: true },
    { key: 'completeness', labelKey: 'admin.records.col.completeness', num: true },
    { key: 'confidence',   labelKey: 'admin.records.col.confidence' },
    { key: 'lastVerified', labelKey: 'admin.records.col.verified' }
  ];

  function sortValue(rec, key) {
    switch (key) {
      case 'name':
        return U.isKnown(rec.name) ? String(rec.name).toLowerCase() : null;
      case 'districtKey':
        return U.isKnown(rec.districtKey) ? GEO.data.districtName(rec.districtKey).toLowerCase() : null;
      case 'officeClass':
        // Sorted by the ordinal ladder, not alphabetically: "A+" before "A"
        // before "B+" is the order the class actually has.
        return U.isKnown(rec.officeClass) ? S.enums.officeClass.indexOf(rec.officeClass) : null;
      case 'askingRent':
        return U.isKnown(rec.askingRent) ? rec.askingRent : null;
      case 'completeness':
        return GEO.quality ? GEO.quality.completeness(rec).known : null;
      case 'confidence':
        return S.enums.confidence.indexOf(GEO.data.recordConfidence(rec));
      case 'lastVerified':
        return (rec._meta && rec._meta.lastVerifiedAt) || null;
      default:
        return null;
    }
  }

  function searchRecords(pool, q) {
    if (!q || !q.trim()) return pool;
    if (GEO.search && GEO.search.query) {
      // limit -1 returns every hit: this is a table filter, not a suggest list.
      var res = GEO.search.query(pool, q, { limit: -1, districts: false });
      return res.items.map(function (i) { return i.record; });
    }
    var needle = q.toLowerCase();
    return pool.filter(function (r) {
      return (String(r.name || '') + ' ' + String(r.address || '')).toLowerCase().indexOf(needle) >= 0;
    });
  }

  function sortHeader(def) {
    var on = view.sort === def.key;
    var kids = [el('span', { text: t(def.labelKey) })];
    if (on) {
      // The glyph is decorative; `aria-sort` on the cell carries the meaning.
      kids.push(el('span', { 'aria-hidden': 'true', text: view.dir === 'asc' ? ' ▲' : ' ▼' }));
    }
    return el('th' + (def.num ? '.tbl__num' : ''), {
      scope: 'col',
      'aria-sort': on ? (view.dir === 'asc' ? 'ascending' : 'descending') : 'none'
    }, [
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        'aria-label': t(def.labelKey) + (on
          ? ' — ' + t(view.dir === 'asc' ? 'admin.records.sort.asc' : 'admin.records.sort.desc')
          : ''),
        onclick: function () {
          if (on) view.dir = view.dir === 'asc' ? 'desc' : 'asc';
          else { view.sort = def.key; view.dir = 'asc'; }
          view.page = 1;
          redraw();
        }
      }, kids)
    ]);
  }

  function recordRow(rec) {
    var comp = GEO.quality ? GEO.quality.completeness(rec) : null;
    var lv = (rec._meta && rec._meta.lastVerifiedAt) || null;
    var rentText = valueText(rec, S.byKey.askingRent);
    var classText = U.isKnown(rec.officeClass) ? enumLabel('officeClass', rec.officeClass) : null;

    var nameKids = [el('span', { text: nameOf(rec) })];
    var dBadge = demoBadge(rec);
    if (dBadge) nameKids.push(dBadge);
    var lBadge = localBadge(rec);
    if (lBadge) nameKids.push(lBadge);

    return el('tr', {}, [
      // `.tbl th` upper-cases and tracks out its text, which is right for a
      // column label and wrong for a row header that holds DATA: these names are
      // largely Cyrillic and a name is not ours to re-case. `nowrap` is dropped
      // for the same reason — a long name should wrap, not stretch the table.
      el('th.tbl__rowhd', {
        scope: 'row',
        style: 'text-transform:none;letter-spacing:0;white-space:normal'
      }, [
        el('div.row.row--tight', {}, nameKids),
        el('div.micro', { text: U.isKnown(rec.address) ? rec.address : rec.id })
      ]),
      el('td', {}, [U.isKnown(rec.districtKey)
        ? el('span', { text: GEO.data.districtName(rec.districtKey) })
        : unknownNode()]),
      el('td', {}, [classText
        ? el('span.badge.badge--class', { 'data-class': rec.officeClass, text: classText })
        : el('span.badge.badge--class', { 'data-class': 'unknown', text: t('value.class.unknown') })]),
      el('td.tbl__num', {}, [rentText ? el('span', { text: rentText }) : unknownNode()]),
      el('td.tbl__num', {}, [el('span', {
        text: comp ? t('common.of', { n: F.int(comp.known), m: F.int(comp.total) }) : F.UNKNOWN
      })]),
      el('td', {}, [confidenceChip(GEO.data.recordConfidence(rec))]),
      el('td', {}, [U.isKnown(lv) ? el('span', { text: F.date(lv) })
                                  : el('span.unk', { text: t('detail.quality.neverVerified') })]),
      el('td', {}, [el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        id: 'adm-edit-' + rec.id,
        text: t('common.edit'),
        'aria-label': t('admin.records.open', { name: nameOf(rec) }),
        onclick: function () { openRecord(rec.id, 'adm-edit-' + rec.id); }
      })])
    ]);
  }

  /* IA §2.3: below 768 px the Records table becomes a CARD LIST. Eight columns
     squeezed into 375 px is the "shrunken panel" §26 forbids — the cells
     collapse and the values disappear behind their own headers. A card keeps
     every field visible with its own label, which is what the reader needs from
     a data workspace on a phone. */
  function isPhone(state) { return state.bp === 'xs' || state.bp === 'xxs'; }

  function kvRow(label, valueNode) {
    return el('div.kv__row', {}, [
      el('span.kv__k', { text: label }),
      el('span.kv__v', {}, [valueNode])
    ]);
  }

  function recordCard(rec) {
    var comp = GEO.quality ? GEO.quality.completeness(rec) : null;
    var lv = (rec._meta && rec._meta.lastVerifiedAt) || null;
    var rentText = valueText(rec, S.byKey.askingRent);

    var head = [el('span', { text: nameOf(rec) })];
    var db = demoBadge(rec);
    if (db) head.push(db);
    var lb = localBadge(rec);
    if (lb) head.push(lb);

    return el('li.card.card--flat.stack', {}, [
      el('div.row.row--tight', {}, head),
      el('div.micro', { text: U.isKnown(rec.address) ? rec.address : rec.id }),
      el('div.kv', {}, [
        kvRow(t('admin.records.col.district'), U.isKnown(rec.districtKey)
          ? el('span', { text: GEO.data.districtName(rec.districtKey) }) : unknownNode()),
        kvRow(t('admin.records.col.class'), U.isKnown(rec.officeClass)
          ? el('span.badge.badge--class', { 'data-class': rec.officeClass,
                                            text: enumLabel('officeClass', rec.officeClass) })
          : el('span.badge.badge--class', { 'data-class': 'unknown', text: t('value.class.unknown') })),
        kvRow(t('admin.records.col.rent'), rentText ? el('span', { text: rentText }) : unknownNode()),
        kvRow(t('admin.records.col.completeness'), el('span', {
          text: comp ? t('common.of', { n: F.int(comp.known), m: F.int(comp.total) }) : F.UNKNOWN
        })),
        kvRow(t('admin.records.col.confidence'), confidenceChip(GEO.data.recordConfidence(rec))),
        kvRow(t('admin.records.col.verified'), U.isKnown(lv)
          ? el('span', { text: F.date(lv) })
          : el('span.unk', { text: t('detail.quality.neverVerified') }))
      ]),
      el('div.row', {}, [el('button.btn.btn--quiet.btn--sm', {
        type: 'button', id: 'adm-edit-' + rec.id, text: t('common.edit'),
        'aria-label': t('admin.records.open', { name: nameOf(rec) }),
        onclick: function () { openRecord(rec.id, 'adm-edit-' + rec.id); }
      })])
    ]);
  }

  /** The card list has no column headers to click, so the same sort lives in a
   *  select plus a direction toggle — one control, not a hidden gesture. */
  function sortControl() {
    return el('div.row', {}, [
      el('label.field__label', { for: 'adm-sort', text: t('list.sort.label') }),
      el('select.select', {
        id: 'adm-sort',
        onchange: function (e) { view.sort = e.target.value; view.page = 1; redraw(); }
      }, SORTS.map(function (def) {
        return el('option', { value: def.key, selected: view.sort === def.key, text: t(def.labelKey) });
      })),
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        text: view.dir === 'asc' ? '\u25B2' : '\u25BC',
        'aria-label': t(view.dir === 'asc' ? 'admin.records.sort.dir.asc' : 'admin.records.sort.dir.desc'),
        title: t(view.dir === 'asc' ? 'admin.records.sort.dir.asc' : 'admin.records.sort.dir.desc'),
        onclick: function () { view.dir = view.dir === 'asc' ? 'desc' : 'asc'; view.page = 1; redraw(); }
      })
    ]);
  }

  function deletedSection() {
    var deleted = GEO.data.localChanges().filter(function (c) { return c.kind === 'deleted'; });
    var kids = [sectionTitle(t('admin.deleted.title'))];

    if (!deleted.length) {
      kids.push(el('p.micro', { text: t('empty.deleted') }));
      return el('section.card.card--flat', {}, kids);
    }

    kids.push(el('div.stack', {}, deleted.map(function (c) {
      var rec = c.record;
      return el('div.row', {}, [
        el('span', { text: nameOf(rec) }),
        demoBadge(rec),
        el('span.micro', { text: rec.id }),
        el('button.btn.btn--quiet.btn--sm.push', {
          type: 'button',
          text: t('common.restore'),
          'aria-label': t('admin.deleted.restore', { name: nameOf(rec) }),
          onclick: function () { restoreRecord(rec); }
        })
      ]);
    })));
    return el('section.card.card--flat', {}, kids);
  }

  function recordsTab(state, rows) {
    if (view.form) return formView(state, rows);

    var pool = view.filteredOnly ? rows.slice() : allRecords();
    var total = pool.length;
    var matched = searchRecords(pool, view.q);
    var sorted = U.sortBy(matched, function (r) { return sortValue(r, view.sort); }, view.dir);
    var shown = sorted.slice(0, view.page * PAGE);

    var demoCount = GEO.data.demoRecords().length;
    var head = [];

    head.push(el('div.row', {}, [
      el('h2.sectitle', { text: t('admin.records.title') }),
      el('span.micro', { text: t('admin.records.showing', { n: F.int(shown.length), m: F.int(total) }) }),
      el('button.btn.btn--primary.btn--sm.push', {
        type: 'button', id: 'adm-add', text: t('admin.records.add'),
        onclick: function () { openNew('adm-add'); }
      }),
      undoButton()
    ]));

    head.push(el('p.micro', {
      text: view.filteredOnly
        ? t('admin.records.onlyFiltered.count', { n: F.int(rows.length), m: F.int(allRecords().length) })
        : (demoCount
            ? t('admin.records.scope', { n: F.int(total), d: F.int(demoCount) })
            : t('admin.records.scope.noDemo', { n: F.int(total) }))
    }));

    var search = el('div.field', {}, [
      el('label.field__label', { for: 'adm-q', text: t('admin.records.filter') }),
      el('input.input', {
        type: 'search', id: 'adm-q', value: view.q, autocomplete: 'off', spellcheck: 'false',
        placeholder: t('admin.records.search.placeholder'),
        oninput: function (e) { view.q = e.target.value; view.page = 1; redraw(true); }
      }),
      el('span.field__hint', { text: t('hdr.search.scripts') })
    ]);

    var scopeToggle = el('label.check', {}, [
      el('input', {
        type: 'checkbox', checked: view.filteredOnly,
        onchange: function (e) { view.filteredOnly = !!e.target.checked; view.page = 1; redraw(); }
      }),
      el('span.check__text', { text: t('admin.records.onlyFiltered') })
    ]);

    var body;
    if (!shown.length) {
      body = el('div.empty', {}, [
        el('p.empty__title', { text: view.q
          ? t('admin.records.search.none', { q: view.q })
          : t('empty.list.title') }),
        el('p.empty__body', { text: view.q ? t('hdr.search.hint') : t('empty.list.body') }),
        el('div.empty__actions', {}, [
          view.q ? el('button.btn.btn--quiet.btn--sm', {
            type: 'button', text: t('empty.search.action'),
            onclick: function () { view.q = ''; redraw(); }
          }) : null
        ])
      ]);
    } else if (isPhone(state)) {
      body = el('div.stack', {}, [
        sortControl(),
        el('ul.stack', { 'aria-label': t('admin.records.card.aria', { n: F.int(shown.length) }) },
           shown.map(recordCard))
      ]);
    } else {
      body = el('table.tbl.tbl--zebra', {}, [
        el('caption.vh', { text: t('admin.records.title') }),
        el('thead', {}, [el('tr', {}, SORTS.map(sortHeader).concat([
          el('th', { scope: 'col' }, [el('span.vh', { text: t('admin.records.col.actions') })])
        ]))]),
        el('tbody', {}, shown.map(recordRow))
      ]);
    }

    var foot = [];
    if (shown.length < sorted.length) {
      var more = Math.min(PAGE, sorted.length - shown.length);
      foot.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('admin.records.showMore', { n: F.int(more) }),
        onclick: function () { view.page += 1; redraw(); }
      }));
    }

    return el('div.stack.stack--lg', {}, head.concat([
      search, scopeToggle, body,
      foot.length ? el('div.row', {}, foot) : null,
      el('p.micro', { text: t('admin.undo.depth', { n: F.int(UNDO_DEPTH) }) }),
      deletedSection()
    ]));
  }

  function undoButton() {
    var can = A.canUndo();
    if (!can) {
      // §29: disabled with the reason visible as text, not only as a tooltip.
      return el('span.row.row--tight', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', disabled: true, text: t('admin.undo'),
          'aria-describedby': 'adm-undo-why'
        }),
        el('span.reason', { id: 'adm-undo-why', text: t('admin.undo.disabled') })
      ]);
    }
    return el('button.btn.btn--quiet.btn--sm', {
      type: 'button',
      text: t('admin.undo'),
      title: t('admin.undo.available', { what: A.undoLabel() }),
      'aria-label': t('admin.undo.available', { what: A.undoLabel() }),
      onclick: function () { A.undo(); }
    });
  }

  /* =====================================================================
   * 4. THE EDITOR FORM (D-04 … D-10, decisions A–D)
   * =================================================================== */

  function blankProvenance() {
    return {
      source: 'Manual edit (prototype)',
      sourceUrl: '',
      method: 'manual edit (prototype)',
      // Decision D: an edit is not evidence. Never default to High.
      confidence: 'Unknown',
      lastVerifiedAt: GEO.date.today(),
      note: ''
    };
  }

  /** Raw editor values for one record. `raw` is what the input shows; `value`
   *  is what `GEO.schema.coerce` made of it; `error` is the named parse
   *  failure. A rebuild of the form reads from here, so typing survives an
   *  unrelated re-render. */
  function formValues(rec) {
    var values = {};
    S.fields.forEach(function (fd) {
      if (fd.type === 'tenantList') return;           // D-23: not editable here
      var v = rec ? rec[fd.key] : null;
      var isList = fd.type === 'enumList' || fd.type === 'textList';
      // Arrays are copied, never shared with the stored record: a checkbox
      // click must not mutate the repository before Save is pressed.
      var value = isList ? (Array.isArray(v) ? v.slice() : []) : (U.isKnown(v) ? v : null);
      var raw;
      if (fd.type === 'enumList') raw = value.slice();
      else if (fd.type === 'textList') raw = value.join(', ');
      else raw = U.isKnown(v) ? String(v) : '';
      values[fd.key] = { raw: raw, value: value, error: null };
    });
    return values;
  }

  function openRecord(id, returnFocusId) {
    var rec = GEO.data.get(id);
    if (!rec) { if (GEO.boot) GEO.boot.toast(t('error.notFound')); return; }
    view.form = {
      id: id, isNew: false, values: formValues(rec), prov: blankProvenance(),
      ack: false, ackSig: '', nodes: {}, returnFocus: returnFocusId || null
    };
    sig = null;
    GEO.state.set({ overlay: 'data', dataTab: 'records', editingId: id },
                  { source: 'user', action: 'admin:openRecord', summary: nameOf(rec) });
  }

  function openNew(returnFocusId) {
    view.form = {
      id: null, isNew: true, values: formValues(null), prov: blankProvenance(),
      ack: false, ackSig: '', nodes: {}, returnFocus: returnFocusId || null
    };
    sig = null;
    GEO.state.set({ overlay: 'data', dataTab: 'records', editingId: null },
                  { source: 'user', action: 'admin:addRecord', summary: t('admin.form.title.new') });
  }

  A.openRecord = openRecord;

  function closeForm(clearState) {
    var back = view.form && view.form.returnFocus;
    view.form = null;
    sig = null;
    if (clearState) {
      GEO.state.set({ editingId: null }, { source: 'user', action: 'admin:closeForm' });
    }
    if (back) {
      var node = document.getElementById(back);
      if (node && node.offsetParent !== null) node.focus();
    }
  }

  /** The record the form currently describes, with every coerced value applied. */
  function candidateRecord() {
    var f = view.form;
    var base = f.isNew ? S.blank() : U.clone(GEO.data.get(f.id));
    if (!base) base = S.blank();
    Object.keys(f.values).forEach(function (k) { base[k] = f.values[k].value; });
    if (f.isNew) base.recordType = 'VERIFIED_SOURCE';
    return base;
  }

  function changedKeys() {
    var f = view.form;
    var rec = f.isNew ? null : GEO.data.get(f.id);
    var out = [];
    Object.keys(f.values).forEach(function (k) {
      var now = f.values[k].value;
      if (f.isNew) { if (U.isKnown(now)) out.push(k); return; }
      var was = rec ? rec[k] : null;
      if (JSON.stringify(now === undefined ? null : now) !== JSON.stringify(was === undefined ? null : was)) {
        out.push(k);
      }
    });
    return out;
  }

  function districtKeys() {
    return GEO.data.districts().map(function (d) { return d.key; });
  }

  function haveGeometry() {
    return GEO.data.districts().some(function (d) { return !!d.geometry; });
  }

  /** Decision C. Coercion failures join the schema's errors: a field we could
   *  not parse must never reach the repository as `null` pretending to be an
   *  intentional "unknown". */
  function validateForm() {
    var f = view.form;
    var cand = candidateRecord();
    var v = S.validate(cand, { districtKeys: districtKeys() });
    var errors = {};
    var list = [];

    v.errors.forEach(function (e) {
      var key = e.field || '_';
      if (!errors[key]) { errors[key] = e.message; list.push({ field: key, message: e.message }); }
    });
    Object.keys(f.values).forEach(function (k) {
      if (!f.values[k].error) return;
      errors[k] = f.values[k].error;
      list.push({ field: k, message: f.values[k].error });
    });

    return { candidate: cand, errors: errors, errorList: list, warnings: v.warnings };
  }

  function warningSignature(warnings) {
    return warnings.map(function (x) { return (x.field || '') + ':' + x.message; }).join('|');
  }

  /** The live district cross-check (M13): moving a pin must never silently
   *  leave the record claiming a district the geometry contradicts (D1). */
  function districtCheck(cand) {
    if (!GEO.geo || !GEO.geo.districtAt) return null;
    if (!U.isKnown(cand.lat) || !U.isKnown(cand.lng)) return null;
    if (!haveGeometry()) return { kind: 'noGeometry' };
    var at = GEO.geo.districtAt(cand.lat, cand.lng);
    if (at === null) return { kind: 'outside' };
    if (U.isKnown(cand.districtKey) && at !== cand.districtKey) return { kind: 'mismatch', key: at };
    return null;
  }

  function setValue(key, raw) {
    var f = view.form;
    if (!f) return;
    var c = S.coerce(key, raw);
    f.values[key] = { raw: raw, value: c.error ? null : c.value, error: c.error || null };
    refreshForm();
  }

  /* --------------------------------------------------- field editors (A) */

  function unknownOption() {
    return el('option', { value: '', text: t('admin.form.unknownOption') });
  }

  function enumSelect(fd, id) {
    var current = view.form.values[fd.key].raw;
    var opts = [unknownOption()];
    (S.enums[fd.enumKey] || []).forEach(function (v) {
      opts.push(el('option', { value: v, selected: String(current) === v, text: enumLabel(fd.enumKey, v) }));
    });
    return el('select.select', {
      id: id,
      onchange: function (e) { setValue(fd.key, e.target.value); }
    }, opts);
  }

  function districtSelect(fd, id) {
    var current = view.form.values[fd.key].raw;
    var opts = [unknownOption()];
    GEO.data.districts().forEach(function (d) {
      opts.push(el('option', { value: d.key, selected: String(current) === d.key, text: d.name }));
    });
    return el('select.select', {
      id: id,
      onchange: function (e) { setValue(fd.key, e.target.value); }
    }, opts);
  }

  function enumListChecks(fd, id) {
    var chosen = view.form.values[fd.key].raw || [];
    return el('div.stack', { id: id, role: 'group', 'aria-label': fieldLabel(fd.key) },
      (S.enums[fd.enumKey] || []).map(function (v) {
        return el('label.check', {}, [
          el('input', {
            type: 'checkbox', value: v, checked: chosen.indexOf(v) >= 0,
            onchange: function (e) {
              var next = (view.form.values[fd.key].raw || []).slice();
              var at = next.indexOf(v);
              if (e.target.checked) { if (at < 0) next.push(v); }
              else if (at >= 0) next.splice(at, 1);
              setValue(fd.key, next);
            }
          }),
          el('span.check__text', { text: enumLabel(fd.enumKey, v) })
        ]);
      }));
  }

  /** Numbers use a text input on purpose. `type="number"` refuses "34,8" and
   *  "$34.8" at the browser level, before `GEO.schema.coerce` — the exact
   *  input M13 requires us to accept and normalise. `inputmode` still brings
   *  up the numeric keypad on touch. */
  function textInput(fd, id) {
    var numeric = fd.type === 'number' || fd.type === 'coord' ||
                  fd.type === 'integer' || fd.type === 'year';
    var cls = numeric ? '.input.input--num' : '.input';
    return el('input' + cls, {
      type: 'text',
      id: id,
      value: String(view.form.values[fd.key].raw || ''),
      autocomplete: 'off',
      spellcheck: numeric ? 'false' : null,
      inputmode: numeric ? (fd.type === 'integer' || fd.type === 'year' ? 'numeric' : 'decimal') : null,
      'aria-invalid': view.form.values[fd.key].error ? 'true' : null,
      oninput: function (e) { setValue(fd.key, e.target.value); }
    });
  }

  function fieldEditor(fd) {
    var f = view.form;
    var id = 'adm-f-' + fd.key;
    var errId = id + '-err';
    var hintId = id + '-hint';
    var rec = f.isNew ? null : GEO.data.get(f.id);

    var control;
    if (fd.type === 'tenantList') {
      // D-23 / §29: present, disabled, with the reason as adjacent text.
      control = el('input.input', { type: 'text', id: id, disabled: true,
                                    value: String((rec && rec.tenants || []).length) });
    } else if (fd.type === 'enum') {
      control = enumSelect(fd, id);
    } else if (fd.type === 'district') {
      control = districtSelect(fd, id);
    } else if (fd.type === 'enumList') {
      control = enumListChecks(fd, id);
    } else {
      control = textInput(fd, id);
    }

    var hints = [];
    if (fd.unit) hints.push(fd.unit);
    // Only a handful of fields carry a help sentence; the rest are self-evident
    // from their label and unit, so the absence is normal and not a missing key.
    if (GEO.i18n.has('field.' + fd.key + '.help')) hints.push(t('field.' + fd.key + '.help'));
    if (fd.required) hints.push(t('admin.form.required'));
    if (fd.type === 'tenantList') hints.push(t('admin.form.tenants.disabled'));

    // The value as stored right now, so an editor can see what they are
    // replacing without leaving the form (§2.3).
    var storedText = rec ? valueText(rec, fd) : null;
    var stored = el('span.micro', {
      text: t('admin.form.current', { value: storedText === null ? F.UNKNOWN : storedText })
    });

    var errNode = el('span.field__err', { id: errId, role: 'alert', hidden: true });
    f.nodes.err = f.nodes.err || {};
    f.nodes.err[fd.key] = errNode;

    var labelKids = [el('label.field__label', { for: id, text: fieldLabel(fd.key) })];
    if (rec && U.isKnown(rec[fd.key])) {
      labelKids.push(confidenceChip(GEO.data.confidenceOf(rec, fd.key)));
    }

    return el('div.field', { dataset: { field: fd.key } }, [
      el('div.row.row--tight', {}, labelKids),
      control,
      hints.length ? el('span.field__hint', { id: hintId, text: hints.join(' · ') }) : null,
      stored,
      errNode
    ]);
  }

  function coordExtras() {
    var mapReady = !!(GEO.map && GEO.map.isReady && GEO.map.isReady());
    var kids = [];
    if (mapReady) {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('admin.form.pickOnMap'), onclick: pickOnMap
      }));
    } else {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button', disabled: true, text: t('admin.form.pickOnMap'),
        'aria-describedby': 'adm-pick-why'
      }));
      kids.push(el('span.reason', { id: 'adm-pick-why', text: t('admin.form.pickOnMap.disabled') }));
    }
    var warn = el('p.field__err', { id: 'adm-district-warn', role: 'alert', hidden: true });
    view.form.nodes.districtWarn = warn;
    var useBtn = el('button.btn.btn--quiet.btn--sm', { type: 'button' });
    // The button lives in its own `.row` so it keeps its natural width inside
    // the `.stack`; the ROW is what gets hidden, so no empty gap is left behind.
    var useRow = el('div.row', { hidden: true }, [useBtn]);
    view.form.nodes.districtUse = useBtn;
    view.form.nodes.districtUseRow = useRow;
    return el('div.stack', {}, [el('div.row', {}, kids), warn, useRow]);
  }

  /* ------------------------------------------------------- provenance (D-06…D-08) */

  function provenanceBlock() {
    var f = view.form;
    var p = f.prov;

    function textRow(key, labelKey, type) {
      var id = 'adm-p-' + key;
      return el('div.field', {}, [
        el('label.field__label', { for: id, text: t(labelKey) }),
        el('input.input', {
          type: type || 'text', id: id, value: p[key] || '', autocomplete: 'off',
          oninput: function (e) { p[key] = e.target.value; refreshForm(); }
        })
      ]);
    }

    var methodSel = el('select.select', {
      id: 'adm-p-method',
      onchange: function (e) { p.method = e.target.value; }
    }, S.enums.method.map(function (m) {
      return el('option', { value: m, selected: p.method === m, text: enumLabel('method', m) });
    }));

    var confSel = el('select.select', {
      id: 'adm-p-confidence',
      onchange: function (e) { p.confidence = e.target.value; refreshForm(); }
    }, S.enums.confidence.map(function (c) {
      return el('option', { value: c, selected: p.confidence === c, text: enumLabel('confidence', c) });
    }));

    var refreshLine = el('p.micro', { id: 'adm-p-refresh' });
    f.nodes.refreshLine = refreshLine;

    return el('section.card.card--flat', {}, [
      sectionTitle(t('admin.form.prov.title')),
      el('p.micro', { text: t('admin.form.prov.note') }),
      el('div.form__row', {}, [
        textRow('source', 'admin.form.source.name'),
        textRow('sourceUrl', 'admin.form.source.url', 'url')
      ]),
      el('div.form__row', {}, [
        el('div.field', {}, [
          el('label.field__label', { for: 'adm-p-method', text: t('admin.form.source.method') }),
          methodSel
        ]),
        el('div.field', {}, [
          el('label.field__label', { for: 'adm-p-confidence', text: t('admin.form.source.confidence') }),
          confSel,
          el('span.field__hint', { text: t('admin.form.prov.confidence.hint') })
        ])
      ]),
      el('div.field', {}, [
        el('label.field__label', { for: 'adm-p-date', text: t('admin.form.lastVerified') }),
        el('input.input', {
          type: 'date', id: 'adm-p-date', value: p.lastVerifiedAt || '',
          onchange: function (e) { p.lastVerifiedAt = e.target.value; refreshForm(); },
          oninput: function (e) { p.lastVerifiedAt = e.target.value; refreshForm(); }
        }),
        el('span.field__hint', { text: t('admin.form.lastVerified.hint') }),
        refreshLine
      ]),
      el('div.field', {}, [
        el('label.field__label', { for: 'adm-p-note', text: t('admin.form.source.note') }),
        el('textarea.textarea', {
          id: 'adm-p-note', rows: '2',
          oninput: function (e) { p.note = e.target.value; }
        }, [p.note || ''])
      ]),
      el('div.row', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', disabled: true, text: t('admin.form.addSource'),
          'aria-describedby': 'adm-addsource-why'
        }),
        el('span.reason', { id: 'adm-addsource-why', text: t('admin.form.addSource.disabled') })
      ])
    ]);
  }

  /* ------------------------------------------------------------ the form view */

  function formView(state, rows) {
    var f = view.form;
    var rec = f.isNew ? null : GEO.data.get(f.id);
    if (!f.isNew && !rec) { view.form = null; return recordsTab(state, rows); }

    f.nodes = { err: {} };

    var titleKids = [el('h2.prop__title', {
      text: f.isNew ? t('admin.form.title.new') : t('admin.form.title.edit', { name: nameOf(rec) })
    })];
    if (f.isNew) titleKids.push(el('span.badge.badge--flag', { text: t('admin.form.newBadge') }));
    if (rec) {
      var db = demoBadge(rec);
      if (db) titleKids.push(db);
      var lb = localBadge(rec);
      if (lb) titleKids.push(lb);
    }

    var head = el('div.stack', {}, [
      el('div.row', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('admin.form.back'), onclick: function () { tryCancel(); }
        }),
        undoButton()
      ]),
      el('div.row', {}, titleKids),
      el('p.micro', { text: t('admin.form.unknownHint') }),
      rec ? el('p.micro', { text: t('detail.quality.recordId') + ': ' + rec.id }) : null
    ]);

    var errBox = el('div.insufficient', { role: 'alert', hidden: true });
    f.nodes.errBox = errBox;
    var warnBox = el('div.insufficient', { hidden: true });
    f.nodes.warnBox = warnBox;

    var groups = S.groups.map(function (g) {
      var fields = S.fieldsIn(g.key);
      if (!fields.length) return null;
      var kids = fields.map(fieldEditor);
      // The coordinate helpers belong with the coordinates, so the district
      // cross-check appears where the user is typing (M13).
      if (g.key === 'identification') kids.push(coordExtras());
      return el('section.card.card--flat', {}, [sectionTitle(groupLabel(g))].concat(kids));
    }).filter(Boolean);

    var saveBtn = el('button.btn.btn--primary', {
      type: 'button', id: 'adm-save', text: t('admin.form.save'),
      'aria-describedby': 'adm-save-why',
      onclick: save
    });
    var saveWhy = el('span.reason', { id: 'adm-save-why' });
    f.nodes.saveBtn = saveBtn;
    f.nodes.saveWhy = saveWhy;

    var foot = [saveBtn, el('button.btn.btn--quiet', {
      type: 'button', text: t('admin.form.cancel'), onclick: function () { tryCancel(); }
    })];
    if (!f.isNew) {
      foot.push(el('button.btn.btn--danger.push', {
        type: 'button', text: t('admin.form.delete'), onclick: function () { askDelete(rec); }
      }));
    }

    var node = el('div.stack.stack--lg', {}, [
      head, errBox, warnBox,
      el('div.form', {}, groups),
      provenanceBlock(),
      el('div.form__foot', {}, foot),
      saveWhy
    ]);

    // Populated once the nodes exist; every later keystroke updates them in
    // place rather than rebuilding the form, so the caret never jumps.
    setTimeout(refreshForm, 0);
    return node;
  }

  /** Update everything derived from the form's current values, in place. */
  function refreshForm() {
    var f = view.form;
    if (!f || !f.nodes || !f.nodes.saveBtn) return;

    var v = validateForm();
    var changed = changedKeys();

    // per-field errors
    Object.keys(f.nodes.err || {}).forEach(function (k) {
      var node = f.nodes.err[k];
      var msg = v.errors[k];
      node.textContent = msg || '';
      node.hidden = !msg;
    });

    // the error summary — a named list, not a colour
    var errBox = f.nodes.errBox;
    if (errBox) {
      Q.clear(errBox);
      if (v.errorList.length) {
        errBox.appendChild(el('p.insufficient__title', {
          text: GEO.i18n.plural('admin.form.errors.title', v.errorList.length)
        }));
        errBox.appendChild(el('ul.stack', {}, v.errorList.map(function (e) {
          var label = e.field && e.field !== '_' ? fieldLabel(e.field) + ': ' : '';
          return el('li.insufficient__why', { text: label + e.message });
        })));
      }
      errBox.hidden = !v.errorList.length;
    }

    // warnings — never block, always acknowledged (decision C)
    var wsig = warningSignature(v.warnings);
    if (wsig !== f.ackSig) { f.ackSig = wsig; f.ack = false; }
    var warnBox = f.nodes.warnBox;
    if (warnBox) {
      Q.clear(warnBox);
      if (v.warnings.length) {
        warnBox.appendChild(el('p.insufficient__title', {
          text: GEO.i18n.plural('admin.form.warnings.title', v.warnings.length)
        }));
        warnBox.appendChild(el('ul.stack', {}, v.warnings.map(function (x) {
          var label = x.field ? fieldLabel(x.field) + ': ' : '';
          return el('li.insufficient__why', { text: label + x.message });
        })));
        warnBox.appendChild(el('label.check', {}, [
          el('input', {
            type: 'checkbox', checked: f.ack,
            onchange: function (e) { f.ack = !!e.target.checked; refreshForm(); }
          }),
          el('span.check__text', { text: t('admin.form.warnings.ack') })
        ]));
      }
      warnBox.hidden = !v.warnings.length;
    }

    // the district cross-check
    var dc = districtCheck(v.candidate);
    var warn = f.nodes.districtWarn, useBtn = f.nodes.districtUse;
    if (warn) {
      if (!dc) { warn.hidden = true; warn.textContent = ''; }
      else if (dc.kind === 'mismatch') {
        warn.hidden = false;
        warn.textContent = t('admin.form.district.mismatch', {
          computed: GEO.data.districtName(dc.key),
          claimed: U.isKnown(v.candidate.districtKey)
            ? GEO.data.districtName(v.candidate.districtKey) : F.UNKNOWN
        });
      } else if (dc.kind === 'outside') {
        warn.hidden = false;
        warn.textContent = t('admin.form.district.outside');
      } else {
        warn.hidden = false;
        warn.textContent = t('admin.form.district.noGeometry');
      }
    }
    if (useBtn && f.nodes.districtUseRow) {
      if (dc && dc.kind === 'mismatch') {
        f.nodes.districtUseRow.hidden = false;
        useBtn.textContent = t('admin.form.district.use', { name: GEO.data.districtName(dc.key) });
        useBtn.onclick = function () {
          setValue('districtKey', dc.key);
          var sel = document.getElementById('adm-f-districtKey');
          if (sel) sel.value = dc.key;
        };
      } else {
        f.nodes.districtUseRow.hidden = true;
      }
    }

    // the live next-refresh dates (D8 — computed, never stored)
    if (f.nodes.refreshLine) {
      var d = f.prov.lastVerifiedAt;
      var ok = !!GEO.date.parse(d);
      f.nodes.refreshLine.textContent = ok
        ? t('admin.form.nextRefresh', {
            fast: F.date(GEO.date.addDays(d, S.refreshDays.fast)),
            slow: F.date(GEO.date.addDays(d, S.refreshDays.slow)),
            stable: F.date(GEO.date.addDays(d, S.refreshDays.stable))
          })
        : t('error.validation.date');
    }

    // the save gate, with its reason always visible (§29)
    var reason = null;
    if (v.errorList.length) reason = t('admin.form.save.invalid');
    else if (!changed.length) reason = t('admin.form.save.unchanged');
    else if (v.warnings.length && !f.ack) reason = t('admin.form.save.warnings');
    f.nodes.saveBtn.disabled = !!reason;
    f.nodes.saveWhy.textContent = reason || '';
    f.nodes.saveWhy.hidden = !reason;
  }

  /* ---------------------------------------------------------------- save */

  function provenanceOpts() {
    var p = view.form.prov;
    return {
      source: p.source && p.source.trim() ? p.source.trim() : 'Manual edit (prototype)',
      sourceUrl: p.sourceUrl && p.sourceUrl.trim() ? p.sourceUrl.trim() : null,
      method: p.method || 'manual edit (prototype)',
      confidence: p.confidence || 'Unknown',
      note: p.note && p.note.trim() ? p.note.trim() : null,
      lastVerifiedAt: GEO.date.parse(p.lastVerifiedAt) ? p.lastVerifiedAt : GEO.date.today()
    };
  }

  function save() {
    var f = view.form;
    if (!f) return;
    var v = validateForm();
    if (v.errorList.length) { refreshForm(); return; }

    var changed = changedKeys();
    if (!changed.length) { refreshForm(); return; }

    var opts = provenanceOpts();

    if (f.isNew) {
      var fields = {};
      changed.forEach(function (k) { fields[k] = f.values[k].value; });
      var addRes = GEO.data.add(fields, opts);
      if (!addRes.ok) { refreshForm(); return; }
      var newId = addRes.record.id;
      var newName = nameOf(addRes.record);
      pushUndo(t('admin.undo.label.add', { name: newName }), function () { GEO.data.remove(newId); });
      closeForm(true);
      GEO.boot.toast(t('admin.form.saved', { name: newName }),
                     { label: t('toast.undo'), run: A.undo });
      return;
    }

    var patch = {};
    changed.forEach(function (k) { patch[k] = f.values[k].value; });
    var res = GEO.data.update(f.id, patch, opts);
    if (!res.ok) {
      // The repository re-validates; anything it refuses is shown rather than
      // swallowed, because a save that silently does nothing is the worst
      // possible outcome for a data-collection test.
      GEO.log.warn('admin: update refused', res.errors);
      refreshForm();
      return;
    }
    var name = nameOf(GEO.data.get(f.id));
    pushUndo(t('admin.undo.label.edit', { name: name }), restoreSnapshot(res.before));
    closeForm(true);
    GEO.boot.toast(t('admin.form.saved', { name: name }),
                   { label: t('toast.undo'), run: A.undo });
  }

  function tryCancel() {
    var f = view.form;
    if (!f) return;
    var dirty = changedKeys().length > 0;
    if (!dirty) { closeForm(true); return; }
    var name = f.isNew ? t('admin.form.title.new') : nameOf(GEO.data.get(f.id));
    GEO.boot.confirm(t('admin.form.cancel.confirm'),
                     t('admin.form.cancel.body', { name: name }),
                     t('admin.form.cancel'),
                     function () { closeForm(true); },
                     true);
  }

  /* -------------------------------------------------------------- delete */

  function askDelete(rec) {
    // G-03: a destructive confirm always names the object.
    GEO.boot.confirm(
      t('admin.form.delete.confirm', { name: nameOf(rec) }),
      t('admin.form.delete.body'),
      t('common.delete'),
      function () { doDelete(rec.id); },
      true);
  }

  function doDelete(id) {
    var rec = GEO.data.get(id);
    if (!rec) return;
    var name = nameOf(rec);
    var res = GEO.data.remove(id);
    if (!res.ok) return;
    var snapshot = res.record;
    pushUndo(t('admin.undo.label.delete', { name: name }),
             function () { GEO.data.restore(snapshot); });
    closeForm(true);
    GEO.boot.toast(t('toast.deleted', { name: name }),
                   { label: t('toast.undo'), run: A.undo });
  }

  function restoreRecord(snapshot) {
    var name = nameOf(snapshot);
    GEO.data.restore(snapshot);
    var id = snapshot.id;
    pushUndo(t('admin.undo.label.restore', { name: name }), function () { GEO.data.remove(id); });
    sig = null;
    GEO.boot.toast(t('toast.restored', { name: name }),
                   { label: t('toast.undo'), run: A.undo });
  }

  /* ------------------------------------------------------ pick on map (D-05) */

  /* The workspace steps aside, the next map click becomes the coordinate, and
     Escape cancels without changing anything. It reaches into the map only
     through the public `instance()` handle and puts the cursor back when it is
     done — no map DOM is rewritten and no map state is touched. */
  function pickOnMap() {
    var map = GEO.map && GEO.map.instance ? GEO.map.instance() : null;
    if (!map) return;

    var container = map.getContainer();
    var prevCursor = container.style.cursor;
    // The notice bar may already be carrying the storage or tiles warning;
    // borrowing it for the crosshair hint must not throw that away (T3, T7).
    var bar = Q.$('#notice');
    var prevNotice = bar && !bar.hidden ? { text: bar.textContent, kind: bar.dataset.kind } : null;

    view.picking = true;
    container.style.cursor = 'crosshair';
    GEO.boot.notice(t('admin.form.pickOnMap.hint'), 'info');
    GEO.state.set({ overlay: null }, { source: 'user', action: 'admin:pick' });

    function finish(latlng) {
      container.style.cursor = prevCursor;
      map.off('click', onClick);
      document.removeEventListener('keydown', onKey, true);
      if (prevNotice) GEO.boot.notice(prevNotice.text, prevNotice.kind);
      else GEO.boot.notice(null);
      view.picking = false;
      if (latlng) {
        setValue('lat', String(Math.round(latlng.lat * 1e6) / 1e6));
        setValue('lng', String(Math.round(latlng.lng * 1e6) / 1e6));
      }
      sig = null;
      GEO.state.set({ overlay: 'data', dataTab: 'records' },
                    { source: 'user', action: 'admin:pick:done' });
      if (latlng) GEO.boot.toast(t('admin.form.pickOnMap.done'));
    }

    function onClick(e) { finish(e.latlng); }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    }

    map.on('click', onClick);
    document.addEventListener('keydown', onKey, true);
  }

  /* =====================================================================
   * 5. LOCAL CHANGES TAB (M12, D-17, D-18)
   * =================================================================== */

  function diffText(fd, v) {
    if (!U.isKnown(v)) return F.UNKNOWN;
    if (Array.isArray(v)) {
      return v.map(function (x) { return fd && fd.enumKey ? enumLabel(fd.enumKey, x) : String(x); }).join(', ');
    }
    if (fd && fd.key === 'districtKey') return GEO.data.districtName(v);
    if (fd && fd.enumKey) return enumLabel(fd.enumKey, v);
    if (fd && fd.unit) return F.num(v, Math.round(v) === v ? 0 : 1) + ' ' + fd.unit;
    return String(v);
  }

  function fieldDiffRow(change, entry) {
    var fd = S.byKey[entry.field];
    return el('div.stack', {}, [
      el('div.row.row--tight', {}, [
        el('span.kv__k', { text: fieldLabel(entry.field) }),
        el('button.btn.btn--quiet.btn--sm.push', {
          type: 'button', text: t('admin.changes.revert'),
          'aria-label': t('admin.changes.revert.confirm', {
            field: fieldLabel(entry.field), name: nameOf(change.record)
          }),
          onclick: function () { askRevertField(change, entry); }
        })
      ]),
      el('div.diff', {}, [
        el('span.diff__before', { text: diffText(fd, entry.before) }),
        el('span.sep', { 'aria-hidden': 'true', text: '→' }),
        el('span.diff__after', { text: diffText(fd, entry.after) })
      ])
    ]);
  }

  function changeCard(change) {
    var rec = change.record;
    var head = [el('span', { text: nameOf(rec) })];
    var db = demoBadge(rec);
    if (db) head.push(db);
    head.push(el('span.micro', { text: rec.id }));

    var kids = [el('div.row.row--tight', {}, head)];

    if (change.kind === 'added') {
      kids.push(el('p.micro', { text: t('admin.changes.addedNote') }));
      kids.push(el('div.row', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('common.edit'),
          onclick: function () { openRecord(rec.id); }
        })
      ]));
    } else if (change.kind === 'deleted') {
      kids.push(el('p.micro', { text: t('admin.changes.deletedNote') }));
      kids.push(el('div.row', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('common.restore'),
          'aria-label': t('admin.deleted.restore', { name: nameOf(rec) }),
          onclick: function () { restoreRecord(rec); }
        })
      ]));
    } else {
      kids.push(el('div.stack', {}, change.fields.map(function (entry) {
        return fieldDiffRow(change, entry);
      })));
      kids.push(el('div.row', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('common.edit'),
          onclick: function () { openRecord(rec.id); }
        }),
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', text: t('admin.changes.revertRecord'),
          onclick: function () { askRevertRecord(change); }
        })
      ]));
    }

    return el('section.card.card--flat', {}, kids);
  }

  function askRevertField(change, entry) {
    var fd = S.byKey[entry.field];
    GEO.boot.confirm(
      t('admin.changes.revert.confirm', { field: fieldLabel(entry.field), name: nameOf(change.record) }),
      t('admin.changes.revert.body', { before: diffText(fd, entry.before) }),
      t('admin.changes.revert'),
      function () {
        var patch = {};
        patch[entry.field] = entry.before;
        var res = GEO.data.update(change.id, patch, provenanceForRevert());
        if (!res.ok) { GEO.boot.toast(res.errors[0] ? res.errors[0].message : t('common.error')); return; }
        pushUndo(t('admin.undo.label.revert', {
          field: fieldLabel(entry.field), name: nameOf(change.record)
        }), restoreSnapshot(res.before));
        sig = null;
        GEO.boot.toast(t('toast.reverted', { field: fieldLabel(entry.field), name: nameOf(change.record) }),
                       { label: t('toast.undo'), run: A.undo });
      },
      true);
  }

  function askRevertRecord(change) {
    GEO.boot.confirm(
      t('admin.changes.revertRecord.confirm', {
        n: F.int(change.fields.length), name: nameOf(change.record)
      }),
      t('admin.changes.revertRecord.body'),
      t('admin.changes.revert'),
      function () {
        var patch = {};
        change.fields.forEach(function (e) { patch[e.field] = e.before; });
        var res = GEO.data.update(change.id, patch, provenanceForRevert());
        if (!res.ok) { GEO.boot.toast(res.errors[0] ? res.errors[0].message : t('common.error')); return; }
        pushUndo(t('admin.undo.label.revert', {
          field: t('common.all'), name: nameOf(change.record)
        }), restoreSnapshot(res.before));
        sig = null;
        GEO.boot.toast(t('admin.changes.reverted', {
          n: F.int(change.fields.length), name: nameOf(change.record)
        }), { label: t('toast.undo'), run: A.undo });
      },
      true);
  }

  /* A revert restores the shipped VALUE; it does not restore the shipped
     EVIDENCE, because this build re-stamps provenance on every write. Saying
     so in the note is more honest than letting the record claim 2GIS sourcing
     it no longer has (§2.3). */
  function provenanceForRevert() {
    return {
      source: 'Manual edit (prototype)',
      method: 'manual edit (prototype)',
      confidence: 'Unknown',
      note: 'Reverted to the value shipped with the prototype.'
    };
  }

  function changesTab() {
    var changes = GEO.data.localChanges();

    // A record added locally and then deleted is not a difference from the
    // shipped dataset — it is a round trip. Listing it under "deleted" would
    // invent a change that does not exist.
    var netZero = changes.filter(function (c) {
      return c.kind === 'deleted' && c.record && c.record._meta && c.record._meta.addedLocally;
    });
    var real = changes.filter(function (c) { return netZero.indexOf(c) < 0; });

    var added = real.filter(function (c) { return c.kind === 'added'; });
    var changed = real.filter(function (c) { return c.kind === 'changed'; });
    var deleted = real.filter(function (c) { return c.kind === 'deleted'; });
    var fieldCount = changed.reduce(function (n, c) { return n + c.fields.length; }, 0);

    var head = [el('div.row', {}, [
      el('h2.sectitle', { text: t('admin.changes.title') }),
      exportChangeSetButton(real)
    ])];

    if (!real.length) {
      head.push(el('div.empty', {}, [
        el('p.empty__title', { text: t('empty.changes') }),
        el('p.empty__body', { text: t('admin.changes.note') }),
        el('div.empty__actions', {}, [
          el('button.btn.btn--quiet.btn--sm', {
            type: 'button', text: t('admin.records.add'),
            onclick: function () { openNew(); }
          })
        ])
      ]));
      if (netZero.length) {
        head.push(el('p.micro', { text: t('admin.changes.netZero', { n: F.int(netZero.length) }) }));
      }
      return el('div.stack.stack--lg', {}, head);
    }

    // The shipped `admin.changes.summary` reads "1 records changed"; English
    // needs two forms, so the counts go through the plural helper instead.
    head.push(el('p.micro', {
      text: t('admin.changes.summary.line', {
        records: GEO.i18n.plural('common.count.records', real.length),
        fields: GEO.i18n.plural('admin.changes.count.fields', fieldCount)
      })
    }));
    head.push(el('p.micro', { text: t('admin.changes.note') }));

    var sections = [];
    [['added', added], ['changed', changed], ['deleted', deleted]].forEach(function (pair) {
      if (!pair[1].length) return;
      sections.push(el('section.stack', {}, [
        sectionTitle(t('admin.changes.' + pair[0] + '.title') + ' · ' + F.int(pair[1].length))
      ].concat(pair[1].map(changeCard))));
    });

    if (netZero.length) {
      sections.push(el('p.micro', { text: t('admin.changes.netZero', { n: F.int(netZero.length) }) }));
    }

    return el('div.stack.stack--lg', {}, head.concat(sections));
  }

  function exportChangeSetButton(changes) {
    if (!changes.length) {
      return el('span.row.row--tight.push', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', disabled: true, text: t('admin.changes.export'),
          'aria-describedby': 'adm-cs-why'
        }),
        el('span.reason', { id: 'adm-cs-why', text: t('admin.changes.export.disabled') })
      ]);
    }
    return el('button.btn.btn--quiet.btn--sm.push', {
      type: 'button', text: t('admin.changes.export'),
      onclick: function () { exportChangeSet(changes); }
    });
  }

  function exportChangeSet(changes) {
    var payload = {
      schemaVersion: S.VERSION,
      kind: 'change-set',
      exportedAt: new Date().toISOString(),
      exportedBy: GEO.PRODUCT.name + ' ' + GEO.PRODUCT.version,
      city: GEO.PRODUCT.city,
      assetType: GEO.PRODUCT.assetType,
      note: t('admin.changes.note'),
      counts: {
        added: changes.filter(function (c) { return c.kind === 'added'; }).length,
        changed: changes.filter(function (c) { return c.kind === 'changed'; }).length,
        deleted: changes.filter(function (c) { return c.kind === 'deleted'; }).length
      },
      changes: changes.map(function (c) {
        return {
          kind: c.kind,
          id: c.id,
          name: U.isKnown(c.record.name) ? c.record.name : null,
          fields: c.fields.map(function (e) {
            return { field: e.field, label: fieldLabel(e.field), before: e.before, after: e.after };
          }),
          record: c.kind === 'changed' ? undefined : U.clone(c.record)
        };
      })
    };
    GEO.boot.download(JSON.stringify(payload, null, 1),
                      'geo-mvp-change-set-' + GEO.date.today() + '.json',
                      'application/json');
    GEO.boot.toast(t('toast.exported'));
  }

  /* =====================================================================
   * 6. IMPORT / EXPORT TAB (D-19 … D-22, M8, D4, D15)
   * =================================================================== */

  function exportBlock(state, rows) {
    var all = allRecords();
    var demoAll = all.filter(function (r) { return r.recordType === 'DEMO'; }).length;
    var demoRows = rows.filter(function (r) { return r.recordType === 'DEMO'; }).length;
    // `describe()` returns an empty string when nothing is filtered, and a
    // sentence that trails off after "matching the current filters:" reads as a
    // rendering bug rather than as "no filters".
    var described = GEO.filters && GEO.filters.describe ? GEO.filters.describe(state.filters) : '';
    var filtersText = described && described.trim() ? described : t('common.none');

    var jsonNotes = [el('p.micro', { text: t('admin.io.exportJson.note') }),
                     el('p.micro', { text: t('admin.io.exportJson.contents', { n: F.int(all.length) }) })];
    // D4: the demo disclosure is shown BEFORE the click, not discovered in the file.
    if (demoAll) jsonNotes.push(el('p.micro', { text: t('admin.io.exportJson.demo', { n: F.int(demoAll) }) }));

    var csvNotes = [];
    if (rows.length) {
      csvNotes.push(el('p.micro', {
        text: t('admin.io.exportCsv.contents', { n: F.int(rows.length), filters: filtersText })
      }));
      if (demoRows) csvNotes.push(el('p.micro', { text: t('admin.io.exportCsv.demo', { n: F.int(demoRows) }) }));
    } else {
      csvNotes.push(el('p.micro', { text: t('admin.io.exportCsv.none') }));
    }

    var csvBtn = rows.length
      ? el('button.btn.btn--quiet', {
          type: 'button', text: t('admin.io.exportCsv'),
          onclick: function () { exportCsv(rows, filtersText); }
        })
      : el('span.row.row--tight', {}, [
          el('button.btn.btn--quiet', {
            type: 'button', disabled: true, text: t('admin.io.exportCsv'),
            'aria-describedby': 'adm-csv-why'
          }),
          el('span.reason', { id: 'adm-csv-why', text: t('admin.io.exportCsv.none') })
        ]);

    // A button placed directly in a `.stack` (a flex column) stretches to full
    // width and centres its label; wrapping it in a `.row` keeps it its own size.
    return el('section.card.card--flat', {}, [
      sectionTitle(t('admin.io.export.title')),
      el('div.stack', {}, [
        el('div.row', {}, [el('button.btn.btn--quiet', {
          type: 'button', text: t('admin.io.exportJson'), onclick: exportJson
        })])
      ].concat(jsonNotes)),
      el('div.stack', {}, [el('div.row', {}, [csvBtn])].concat(csvNotes))
    ]);
  }

  function exportJson() {
    // The FULL envelope: demo records included, because UX-10 requires the
    // export to round-trip losslessly, and the envelope marks itself.
    var env = GEO.data.exportEnvelope();
    GEO.boot.download(JSON.stringify(env, null, 1), GEO.data.exportFilename(env), 'application/json');
    GEO.boot.toast(t('toast.exported'));
  }

  function exportCsv(rows, filtersText) {
    GEO.boot.download(GEO.data.toCsv(rows, filtersText),
                      'geo-mvp-selection-' + GEO.date.today() + '.csv', 'text/csv');
    GEO.boot.toast(t('toast.exported'));
  }

  /* --------------------------------------------------------- import (M8) */

  function importBlock() {
    var kids = [sectionTitle(t('admin.io.import.title'))];

    kids.push(el('div.field', {}, [
      el('label.field__label', { for: 'adm-file', text: t('admin.io.import.choose') }),
      // FileReader, not fetch: this page runs from file:// where a network
      // read of a local path is blocked (T1).
      el('input.input', {
        type: 'file', id: 'adm-file', accept: '.json,application/json',
        onchange: function (e) { readImportFile(e.target); }
      }),
      el('span.field__hint', { text: t('admin.io.importJson.hint') })
    ]));
    kids.push(el('p.micro', { text: t('admin.io.allOrNothing') }));

    if (view.reportBusy) {
      kids.push(el('p.micro', { text: t('admin.io.import.reading') }));
    }
    if (view.report) kids.push(importReport(view.report));

    return el('section.card.card--flat', {}, kids);
  }

  function readImportFile(input) {
    var file = input.files && input.files[0];
    // The same file must be selectable twice in a row, so the control is
    // cleared as soon as its contents are in hand.
    input.value = '';
    if (!file) return;

    view.report = null;
    view.reportBusy = true;
    redraw();

    var reader = new FileReader();
    reader.onerror = function () {
      view.reportBusy = false;
      view.report = { filename: file.name, result: { ok: false, message: t('admin.io.import.failed') } };
      redraw();
    };
    reader.onload = function () {
      view.reportBusy = false;
      var result;
      try { result = GEO.data.validateImport(String(reader.result)); }
      catch (e) { result = { ok: false, message: t('error.import.json') }; }
      view.report = { filename: file.name, result: result };
      redraw();
    };
    reader.readAsText(file, 'utf-8');
  }

  function importReport(report) {
    var r = report.result;
    var kids = [sectionTitle(t('admin.io.report.title')), el('p.micro', { text: report.filename })];

    // A schema-version mismatch, a non-JSON file or a file with no records
    // array returns a message and nothing else: it is refused by name and
    // changes nothing (M2, M8).
    if (!r.accepted) {
      kids.push(el('div.insufficient', { role: 'alert' }, [
        el('p.insufficient__title', { text: t('common.error') }),
        el('p.insufficient__why', { text: r.message }),
        el('p.insufficient__why', { text: t('error.import.unchanged') })
      ]));
      kids.push(el('div.row', {}, [el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('common.dismiss'),
        onclick: function () { view.report = null; redraw(); }
      })]));
      return el('div.stack', {}, kids);
    }

    var ok = r.accepted.length, bad = r.rejected.length;
    var examples = r.rejected.slice(0, REJECT_PREVIEW).map(function (b) {
      return (b.id || t('field.recordId') + ' ' + b.row) + ' ' + b.reason;
    }).join(', ');
    if (bad > REJECT_PREVIEW) {
      examples += ', ' + t('admin.io.report.more', { n: F.int(bad - REJECT_PREVIEW) });
    }

    kids.push(el('p', {
      text: bad
        ? t('admin.io.report.headline', { ok: F.int(ok), bad: F.int(bad), examples: examples })
        : t('admin.io.report.headline.clean', { ok: F.int(ok) })
    }));

    if (bad) {
      kids.push(el('ul.stack', {}, r.rejected.map(function (b) {
        return el('li.micro', {
          text: t('admin.io.report.row', {
            row: F.int(b.row), reason: (b.id ? b.id + ' — ' : '') + b.reason
          })
        });
      })));
    }

    var commit;
    if (r.ok) {
      commit = el('button.btn.btn--primary', {
        type: 'button', text: t('admin.io.commit.all', { n: F.int(ok) }),
        onclick: function () { commitImport(r); }
      });
    } else {
      commit = el('span.row.row--tight', {}, [
        el('button.btn.btn--primary', {
          type: 'button', disabled: true, text: t('admin.io.commit.all', { n: F.int(ok) }),
          'aria-describedby': 'adm-commit-why'
        }),
        el('span.reason', { id: 'adm-commit-why', text: t('admin.io.commit.blocked') })
      ]);
    }

    kids.push(el('p.micro', { text: t('admin.io.commit.replaces') }));
    kids.push(el('div.row', {}, [
      commit,
      el('button.btn.btn--quiet', {
        type: 'button', text: t('admin.io.cancel'),
        onclick: function () { view.report = null; redraw(); }
      })
    ]));

    return el('div.stack', {}, kids);
  }

  function commitImport(result) {
    var res = GEO.data.applyImport(result);
    view.report = null;
    if (!res.ok) { GEO.boot.toast(t('error.import.unchanged')); return; }
    // The dataset the stack referred to no longer exists, so keeping the
    // entries would offer an undo that restores records into a different world.
    clearUndo();
    sig = null;
    GEO.boot.toast(t('toast.imported', { n: F.int(res.count) }) + ' ' + t('admin.undo.cleared'));
  }

  /* ----------------------------------------------------------- demo (D4) */

  function demoBlock(state) {
    var demoCount = GEO.data.demoRecords().length;
    var on = !!state.demoMode;

    return el('section.card.card--flat', {}, [
      sectionTitle(t('admin.io.demo.title')),
      el('p.micro', { text: t('admin.io.demo.note', { n: F.int(demoCount) }) }),
      el('p', { text: on ? t('admin.io.demo.state.on') : t('admin.io.demo.state.off') }),
      el('div.row', {}, [
        el('button.btn' + (on ? '.btn--quiet' : '.btn--primary'), {
          type: 'button',
          text: on ? t('admin.io.demo.off') : t('admin.io.demo.on'),
          'aria-pressed': on ? 'true' : 'false',
          onclick: function () { toggleDemo(!on, demoCount); }
        })
      ])
    ]);
  }

  function setDemo(on) {
    GEO.data.setDemoMode(on);
    GEO.state.set({ demoMode: on },
                  { source: 'user', action: on ? 'demo:on' : 'demo:off',
                    summary: on ? 'Demo records on' : 'Demo records off' });
    GEO.boot.toast(on ? t('toast.demoOn') : t('toast.demoOff'));
  }

  function toggleDemo(on, demoCount) {
    if (!on) { setDemo(false); return; }
    // Turning them ON changes what every number on screen means, so it is
    // confirmed with the consequence spelled out (D4).
    GEO.boot.confirm(t('admin.io.demo.confirm'),
                     t('admin.io.demo.confirm.body', { n: F.int(demoCount) }),
                     t('admin.io.demo.on'),
                     function () { setDemo(true); });
  }

  /* ------------------------------------------------------- resets (D15) */

  function storageLine() {
    if (!GEO.storage.available) {
      return el('p.micro', { text: t('admin.storage.unavailable') });
    }
    var bytes = 0;
    GEO.storage.keys().forEach(function (k) {
      try { bytes += JSON.stringify(GEO.storage.get(k, null)).length; }
      catch (e) { /* a key we cannot measure is simply not counted */ }
    });
    var used = bytes > 1024 ? t('admin.storage.kb', { n: F.num(bytes / 1024, 1) })
                            : t('admin.storage.bytes', { n: F.int(bytes) });
    return el('p.micro', { text: t('admin.storage.usage', { used: used }) });
  }

  function resetBlock() {
    var changes = GEO.data.localChanges();
    var added = changes.filter(function (c) { return c.kind === 'added'; }).length;
    var changed = changes.filter(function (c) { return c.kind === 'changed'; }).length;
    var deleted = changes.filter(function (c) { return c.kind === 'deleted'; }).length;
    var keys = GEO.storage.keys().length;

    var restoreBody = changes.length
      ? t('admin.reset.restore.body') + ' ' +
        t('admin.reset.restore.count', { changed: F.int(changed), added: F.int(added), deleted: F.int(deleted) })
      : t('admin.reset.restore.body') + ' ' + t('admin.reset.restore.nothing');

    var restoreBtn = changes.length
      ? el('button.btn.btn--danger', {
          type: 'button', text: t('admin.reset.restore'),
          onclick: function () {
            GEO.boot.confirm(t('admin.reset.restore.confirm'), restoreBody,
                             t('admin.reset.restore'), restoreOriginal, true);
          }
        })
      : el('span.row.row--tight', {}, [
          el('button.btn.btn--danger', {
            type: 'button', disabled: true, text: t('admin.reset.restore'),
            'aria-describedby': 'adm-restore-why'
          }),
          el('span.reason', { id: 'adm-restore-why', text: t('admin.reset.restore.nothing') })
        ]);
    // The disabled button already carries its reason; repeating it below would
    // say the same sentence twice in four lines.
    var restoreNote = changes.length ? el('p.micro', { text: restoreBody }) : null;

    return el('section.card.card--flat', {}, [
      sectionTitle(t('admin.io.reset.title')),
      // D15: two distinct commands. Collapsing them into one "reset" is what
      // the build contract forbids, because they lose different things.
      el('div.stack', {}, [el('div.row', {}, [restoreBtn]), restoreNote]),
      el('div.stack', {}, [
        el('div.row', {}, [el('button.btn.btn--danger', {
          type: 'button', text: t('admin.reset.full'),
          onclick: function () {
            GEO.boot.confirm(t('admin.reset.full.confirm'),
                             t('admin.reset.full.body') + ' ' +
                             t('admin.reset.full.count', { n: F.int(keys) }),
                             t('admin.reset.full'), fullReset, true);
          }
        })]),
        el('p.micro', { text: t('admin.reset.full.body') }),
        el('p.micro', { text: t('boot.hashReset') })
      ]),
      storageLine()
    ]);
  }

  function restoreOriginal() {
    GEO.data.restoreOriginal();
    // `restoreOriginal` reloads the seed without the boundary GeoJSON, which
    // would leave `GEO.geo.districtAt` with no polygons to test against. One
    // explicit reload with both payloads puts the geometry back; the edits key
    // has already been removed, so nothing is re-applied.
    if (w.GEO_SEED && w.GEO_DISTRICTS) {
      try { GEO.data.load(w.GEO_SEED, w.GEO_DISTRICTS); }
      catch (e) { GEO.log.error('admin: reload after restore failed', e); }
    }
    clearUndo();
    view.form = null;
    view.report = null;
    sig = null;
    GEO.state.set({ editingId: null, selectedId: null, compare: [], radius: null },
                  { source: 'user', action: 'data:restoreOriginal',
                    summary: 'Original dataset restored' });
    GEO.boot.toast(t('admin.reset.done'));
  }

  function fullReset() {
    // M3: clears every `geo.mvp.v1.*` key and reloads. The `#reset` hash does
    // the same thing before app init, for the case where the app cannot start.
    GEO.storage.clearAll();
    location.replace(location.pathname);
  }

  function ioTab(state, rows) {
    return el('div.stack.stack--lg', {}, [
      el('h2.sectitle', { text: t('admin.io.title') }),
      exportBlock(state, rows),
      importBlock(),
      demoBlock(state),
      resetBlock()
    ]);
  }

  /* =====================================================================
   * 7. RENDER AND WIRING
   * =================================================================== */

  /** The workspace sub-nav is shell chrome shared with 18-panel-quality, so it
   *  is wired once and only ever has its `aria-selected` restated — an
   *  idempotent write either module can make safely. */
  function syncTabs(state) {
    Q.$$('#overlay-data [data-datatab]').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.datatab === state.dataTab ? 'true' : 'false');
    });
  }

  function signature(state, rows) {
    return [state.dataTab, state.bp, state.demoMode ? '1' : '0', state.role, GEO.i18n.locale,
            String(dataVersion), String(rows.length), String(state.editingId || ''),
            view.form ? (view.form.isNew ? 'new' : 'edit:' + view.form.id) : '-',
            view.q, view.sort, view.dir, String(view.page),
            view.filteredOnly ? '1' : '0',
            view.report ? 'r' : '-', view.reportBusy ? 'b' : '-'].join('|');
  }

  function draw(body, state, rows) {
    var node;
    if (state.dataTab === 'records') node = recordsTab(state, rows);
    else if (state.dataTab === 'changes') node = changesTab();
    else node = ioTab(state, rows);
    Q.fill(body, [el('div.dw__body', {}, [node])]);
  }

  /** A view-only change (sort, search, page, import report) redraws this panel
   *  and nothing else. It is not an application event and does not belong in
   *  the §61 session log. */
  function redraw(keepFocus) {
    var s = GEO.state.get();
    if (s.overlay !== 'data' || !MINE[s.dataTab]) return;
    var active = document.activeElement;
    var id = keepFocus && active ? active.id : null;
    var caret = (id && active.setSelectionRange && active.type === 'search') ? active.selectionStart : null;
    sig = null;
    render(s, GEO.boot.visible(s), GEO.boot.scope(s));
    if (!id) return;
    var back = document.getElementById(id);
    if (!back) return;
    back.focus();
    if (caret !== null && back.setSelectionRange) {
      try { back.setSelectionRange(caret, caret); } catch (e) { /* not a text input */ }
    }
  }

  function focusHeading() {
    var h = Q.$('#data-title');
    if (!h) return;
    // The heading, not the close button: a screen-reader user must hear WHAT
    // opened (IA §6.2).
    h.setAttribute('tabindex', '-1');
    h.focus();
  }

  function render(state, rows) {
    var body = Q.$(BODY);
    if (!body) return;

    syncTabs(state);

    if (state.overlay !== 'data' || state.role === 'external') {
      isOpen = false;
      sig = null;
      return;
    }
    // Module 18 owns the other three tabs and fills the same container; we
    // leave it entirely alone and redraw from scratch when we come back.
    if (!MINE[state.dataTab]) { isOpen = true; sig = null; return; }

    // P-06: the property card asks for a record by putting its id in state.
    if (state.editingId && (!view.form || view.form.isNew || view.form.id !== state.editingId)) {
      var rec = GEO.data.get(state.editingId);
      if (rec) {
        view.form = {
          id: state.editingId, isNew: false, values: formValues(rec),
          prov: blankProvenance(), ack: false, ackSig: '', nodes: {}, returnFocus: null
        };
        sig = null;
      }
    }

    var justOpened = !isOpen;
    if (justOpened) { isOpen = true; sig = null; }

    var s = signature(state, rows);
    if (s === sig) return;
    sig = s;
    draw(body, state, rows);
    if (justOpened) focusHeading();
  }

  function wire() {
    if (wired) return;
    var overlay = Q.$(OVERLAY);
    if (!overlay) return;
    wired = true;

    // Shared chrome. 18-panel-quality needs the same six buttons, so both
    // modules guard on the SAME element and the SAME flag — whichever loads
    // first wires them once. A second listener would fire a second identical
    // set() and cost a second render for one click.
    var tabs = Q.$('.overlay__tabs', overlay);
    if (tabs && tabs.dataset.wired !== '1') {
      tabs.dataset.wired = '1';
      Q.on(tabs, 'click', '[data-datatab]', function (e, btn) {
        GEO.state.set({ dataTab: btn.dataset.datatab },
                      { source: 'user', action: 'data:tab',
                        summary: 'Data workspace: ' + btn.dataset.datatab });
      });
    }

    if (!overlay.dataset.keysWired) {
      overlay.dataset.keysWired = '1';
      overlay.addEventListener('keydown', function (e) {
        if (e.key === 'Tab') {
          if (GEO.boot && GEO.boot.trapFocus) GEO.boot.trapFocus(overlay, e);
          return;
        }
        if (e.key !== 'Escape') return;
        // Handled here and stopped here: 99-boot's global handler ignores keys
        // typed inside an input, so Esc would otherwise do nothing in the
        // editor form and in the records filter box. Esc closes ONE layer.
        e.preventDefault();
        e.stopPropagation();
        if (view.form) { tryCancel(); return; }
        if (view.report) { view.report = null; redraw(); return; }
        GEO.state.set({ overlay: null }, { source: 'user', action: 'admin:esc' });
      });
    }
  }

  /* A dataset edit changes what the table and the diff show without changing
     the tab or the query, so the signature has to move with it. */
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
