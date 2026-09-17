/* ===========================================================================
 * 03-data — the repository
 *
 * The ONLY module that knows where records come from. Everything else asks
 * `GEO.data.workingSet()`. Swapping localStorage for PostGIS/Supabase/an API
 * later means reimplementing this file's public surface and nothing else
 * (brief §20).
 *
 * The demo containment seam lives here (D4): observed and demo records are held
 * in two separate arrays that meet at exactly one function, so a market statistic
 * cannot pick up a synthetic record by accident.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema;
  var D = GEO.data = {};

  var seed = null;          // the shipped dataset, never mutated
  var observed = [];        // recordType VERIFIED_SOURCE  — real market data
  var demo = [];            // recordType DEMO             — synthetic fixtures
  var byId = {};
  var districts = [];
  var districtsByKey = {};
  var profiles = {};
  var sources = [];
  var rejected = [];        // records refused at load, with the reason

  var EDITS_KEY = 'edits';  // persisted as a DIFF against the seed, not a full copy (T4)
  var edits = { changed: {}, added: {}, deleted: {} };

  /* ------------------------------------------------------------ normalise */
  function normalise(raw) {
    var r = S.blank();
    Object.keys(raw).forEach(function (k) { r[k] = raw[k]; });

    // Defensive coercion: the seed is generated and clean, but an IMPORTED file
    // is not. The source's `rent` was a string ("34.8"); a string here would make
    // a range filter compare lexically and "9" > "40.6" (T11).
    S.fields.forEach(function (fd) {
      if (fd.type === 'number' || fd.type === 'coord' || fd.type === 'integer' || fd.type === 'year') {
        var v = r[fd.key];
        if (typeof v === 'string') {
          var c = S.coerce(fd.key, v);
          r[fd.key] = c.error ? null : c.value;
        } else if (v === '' || v === undefined) {
          r[fd.key] = null;
        }
      } else if (fd.type === 'text' || fd.type === 'district' || fd.type === 'enum') {
        if (r[fd.key] === '' || r[fd.key] === undefined) r[fd.key] = null;
      } else if (!Array.isArray(r[fd.key])) {
        r[fd.key] = [];
      }
    });

    r._evidence = r._evidence || {};
    r._meta = r._meta || {};
    r._history = r._history || {};
    if (!r._meta.entityReview) r._meta.entityReview = 'unreviewed';
    if (!r._meta.duplicateVerdict) r._meta.duplicateVerdict = 'undecided';
    return r;
  }

  /* ------------------------------------------------------------- evidence */
  /** Resolve `_evidence[field]` — a profile id string, or {p, ...overrides} —
   *  into a full provenance object. `nextRefreshAt` is always COMPUTED from
   *  lastVerifiedAt so it can never drift out of step with it (D8). */
  D.evidence = function (rec, fieldKey) {
    var e = rec && rec._evidence ? rec._evidence[fieldKey] : null;
    if (!e) return null;

    var base = typeof e === 'string' ? (profiles[e] || {}) : (profiles[e.p] || {});
    var over = typeof e === 'string' ? {} : e;

    var out = {
      field: fieldKey,
      profileId: typeof e === 'string' ? e : e.p,
      source: over.source || base.source || null,
      sourceId: over.sourceId || base.sourceId || null,
      sourceUrl: over.sourceUrl !== undefined ? over.sourceUrl : (base.sourceUrl || null),
      method: over.method || base.method || null,
      confidence: over.confidence || base.confidence || 'Unknown',
      note: over.note !== undefined ? over.note : (base.note || null),
      collectorId: over.collectorId !== undefined ? over.collectorId : (base.collectorId || null),
      reviewer: over.reviewer !== undefined ? over.reviewer : (base.reviewer || null),
      qcStatus: over.qcStatus || base.qcStatus || 'unreviewed',
      collectedAt: over.collectedAt || rec._meta.collectedAt || null,
      lastVerifiedAt: over.lastVerifiedAt || rec._meta.lastVerifiedAt || null
    };
    out.nextRefreshAt = S.nextRefresh(out.lastVerifiedAt, fieldKey);
    out.freshness = S.freshness(out.lastVerifiedAt, fieldKey);
    return out;
  };

  /** Confidence for a field: its evidence, or 'Unknown' when the value is
   *  unknown or carries no evidence. Never guesses upward. */
  D.confidenceOf = function (rec, fieldKey) {
    if (!U.isKnown(rec[fieldKey])) return 'Unknown';
    var e = D.evidence(rec, fieldKey);
    return e ? e.confidence : 'Unknown';
  };

  /** Record-level confidence = the WEAKEST confidence among its known critical
   *  fields, falling back to its base fields. Taking the strongest, or an
   *  average, would let one well-sourced field launder a badly-sourced one. */
  D.recordConfidence = function (rec) {
    var order = S.enums.confidence;                      // High, Medium, Low, Unknown
    var worst = null;
    S.criticalFields.concat(['name', 'lat', 'districtKey']).forEach(function (k) {
      if (!U.isKnown(rec[k])) return;
      var c = D.confidenceOf(rec, k);
      if (worst === null || order.indexOf(c) > order.indexOf(worst)) worst = c;
    });
    return worst || 'Unknown';
  };

  /* ----------------------------------------------------------------- load */
  D.load = function (seedEnvelope, districtGeoJson) {
    seed = seedEnvelope;
    profiles = seedEnvelope.evidenceProfiles || {};
    sources = seedEnvelope.sources || [];
    rejected = [];

    if (seedEnvelope.refreshDays) S.refreshDays = seedEnvelope.refreshDays;

    districts = (seedEnvelope.districts || []).map(function (d) { return U.clone(d); });
    districtsByKey = {};
    districts.forEach(function (d) { districtsByKey[d.key] = d; });

    if (districtGeoJson) {
      (districtGeoJson.features || []).forEach(function (ft) {
        var key = D.districtKeyByName(ft.properties.name);
        if (districtsByKey[key]) districtsByKey[key].geometry = ft.geometry;
      });
    }

    observed = [];
    demo = [];
    byId = {};
    (seedEnvelope.records || []).forEach(function (raw) {
      var r = normalise(raw);
      // No default for recordType: a record we cannot classify never enters the
      // observed set, because that is the set market statistics are computed from.
      if (r.recordType === 'DEMO') demo.push(r);
      else if (r.recordType === 'VERIFIED_SOURCE') observed.push(r);
      else { rejected.push({ id: r.id, reason: 'missing or unknown recordType' }); return; }
      byId[r.id] = r;
    });

    D.restoreEdits();
    GEO.emit('data:loaded', { observed: observed.length, demo: demo.length, rejected: rejected.length });
    return D;
  };

  D.districtKeyByName = function (name) {
    var n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    var hit = districts.filter(function (d) {
      return d.key === n || d.name.toLowerCase() === n ||
             (d.nameRu || '').toLowerCase() === n || (d.nameUz || '').toLowerCase() === n;
    })[0];
    return hit ? hit.key : null;
  };

  /* ------------------------------------------------------------ accessors */
  D.districts = function () { return districts; };
  D.district = function (key) { return districtsByKey[key] || null; };
  D.districtName = function (key) { var d = districtsByKey[key]; return d ? d.name : GEO.fmt.UNKNOWN; };
  D.sources = function () { return sources; };
  D.profiles = function () { return profiles; };
  D.rejected = function () { return rejected; };
  D.seedMeta = function () {
    return { schemaVersion: seed.schemaVersion, generatedAt: seed.generatedAt,
             city: seed.city, assetType: seed.assetType, counts: seed.counts };
  };

  D.observed = function () { return observed; };
  D.demoRecords = function () { return demo; };
  D.get = function (id) { return byId[id] || null; };

  /* ------------------------------------------------- THE CONTAINMENT SEAM */
  /**
   * The single point where observed and demo records can meet (D4).
   * Every consumer — filters, analytics, map, assistant, export — goes through
   * here. Demo records are absent unless demo mode is explicitly on, so a
   * synthetic value cannot reach a market statistic by omission.
   */
  D.workingSet = function (opts) {
    opts = opts || {};
    var demoOn = opts.demoMode !== undefined ? opts.demoMode : D.demoMode();
    var rows = demoOn ? observed.concat(demo) : observed.slice();
    if (opts.excludeSuspectedNonBc) {
      rows = rows.filter(function (r) { return r._meta.entityReview !== 'suspected_non_bc'; });
    }
    if (opts.collapseDuplicates !== false) rows = D.collapseDuplicates(rows);
    return rows;
  };

  /**
   * Collapse only the duplicate groups a HUMAN has adjudicated as the same building.
   * Nothing collapses on its own: the seed ships every group as `undecided`, so counts
   * stay at 148 until someone works the review queue (D6). Once a pair is confirmed,
   * every supply statistic stops double-counting that building — which is the whole
   * commercial point of the queue.
   *
   * The survivor is the record with the most recorded critical fields (ties broken by
   * id, so the choice is deterministic and reproducible across sessions). The absorbed
   * ids are listed on the survivor so the UI can say what was merged.
   */
  D.collapseDuplicates = function (rows) {
    var groups = {};
    rows.forEach(function (r) {
      var g = r._meta.duplicateGroupId;
      if (g && r._meta.duplicateVerdict === 'same_building') (groups[g] = groups[g] || []).push(r);
    });
    var keys = Object.keys(groups);
    if (!keys.length) return rows;

    var drop = {};
    keys.forEach(function (g) {
      var members = groups[g];
      if (members.length < 2) return;
      var best = members.slice().sort(function (a, b) {
        var ca = S.criticalFields.filter(function (f) { return U.isKnown(a[f]); }).length;
        var cb = S.criticalFields.filter(function (f) { return U.isKnown(b[f]); }).length;
        return cb - ca || (a.id < b.id ? -1 : 1);
      })[0];
      best._meta.absorbedIds = members
        .filter(function (m) { return m.id !== best.id; })
        .map(function (m) { return m.id; });
      members.forEach(function (m) { if (m.id !== best.id) drop[m.id] = true; });
    });
    return rows.filter(function (r) { return !drop[r.id]; });
  };

  D.containsDemo = function (rows) {
    return rows.some(function (r) { return r.recordType === 'DEMO'; });
  };

  var demoMode = false;
  D.demoMode = function () { return demoMode; };
  D.setDemoMode = function (on) {
    demoMode = !!on;
    GEO.storage.set('demoMode', demoMode);
    GEO.emit('data:changed', { reason: 'demoMode' });
  };

  /* ------------------------------------------------------------- mutation */
  function stampEdit(rec, fields, opts) {
    var today = GEO.date.today();
    rec._meta.editedLocally = true;
    rec._meta.updatedAt = today;
    rec._meta.lastVerifiedAt = (opts && opts.lastVerifiedAt) || today;
    (fields || []).forEach(function (k) {
      if (!U.isKnown(rec[k])) { delete rec._evidence[k]; return; }
      // A local edit gets its OWN per-field evidence object rather than pointing at
      // a shipped profile — otherwise the edit would inherit 2GIS's provenance and
      // claim a source it does not have (§2.3).
      rec._evidence[k] = {
        p: null,
        source: (opts && opts.source) || 'Manual edit (prototype)',
        sourceUrl: (opts && opts.sourceUrl) || null,
        method: (opts && opts.method) || 'manual edit (prototype)',
        confidence: (opts && opts.confidence) || 'Unknown',
        note: (opts && opts.note) || 'Entered in the prototype data editor. Not independently verified.',
        collectorId: (opts && opts.collectorId) || null,
        reviewer: null,
        qcStatus: 'unreviewed',
        collectedAt: today,
        lastVerifiedAt: rec._meta.lastVerifiedAt
      };
    });
  }

  /** Apply a patch. Returns {ok, errors, warnings, before}. Nothing is written
   *  when validation fails, so a rejected save can never half-apply. */
  D.update = function (id, patch, opts) {
    var rec = byId[id];
    if (!rec) return { ok: false, errors: [{ field: null, message: 'No record ' + id }] };

    var candidate = U.clone(rec);
    var touched = [];
    Object.keys(patch).forEach(function (k) {
      if (k.charAt(0) === '_') return;                   // metadata is not user-editable
      if (k === 'recordType') return;                    // no promotion path, ever (D4)
      candidate[k] = patch[k];
      touched.push(k);
    });

    var v = S.validate(candidate, { districtKeys: districts.map(function (d) { return d.key; }) });
    if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };

    var before = U.clone(rec);
    touched.forEach(function (k) { rec[k] = candidate[k]; });
    if (patch.tenantsStatus) rec.tenantsStatus = patch.tenantsStatus;
    if (patch.amenitiesStatus) rec.amenitiesStatus = patch.amenitiesStatus;
    stampEdit(rec, touched, opts);

    edits.changed[id] = true;
    D.persist();
    GEO.emit('data:changed', { reason: 'update', id: id, fields: touched });
    return { ok: true, errors: [], warnings: v.warnings, before: before };
  };

  D.add = function (fields, opts) {
    var rec = S.blank();
    rec.id = 'LOCAL-' + Date.now().toString(36).toUpperCase();
    rec.recordType = 'VERIFIED_SOURCE';
    Object.keys(fields).forEach(function (k) {
      if (k.charAt(0) !== '_' && k !== 'recordType') rec[k] = fields[k];
    });
    var today = GEO.date.today();
    rec._meta = {
      recordConfidence: 'Unknown', sourceConfidenceLetter: null, sourceCount: 0,
      coordinateAccuracy: 'manual', verificationMode: 'manual',
      collectedAt: today, lastVerifiedAt: today, seedObjectId: null,
      possibleDuplicate: false, duplicateGroupId: null, duplicateVerdict: 'undecided',
      districtSourceLabel: null, districtSourceKey: fields.districtKey || null,
      districtResolvedBy: 'manual', districtConflict: false,
      entityReview: 'unreviewed', entityReviewNote: null,
      sourceNote: null, editedLocally: true, addedLocally: true,
      createdAt: today, updatedAt: today
    };

    var v = S.validate(rec, { districtKeys: districts.map(function (d) { return d.key; }) });
    if (!v.ok) return { ok: false, errors: v.errors, warnings: v.warnings };

    stampEdit(rec, Object.keys(fields), opts);
    observed.push(rec);
    byId[rec.id] = rec;
    edits.added[rec.id] = true;
    D.persist();
    GEO.emit('data:changed', { reason: 'add', id: rec.id });
    return { ok: true, errors: [], warnings: v.warnings, record: rec };
  };

  /** Soft delete — the record leaves every view but is recoverable (M1). */
  D.remove = function (id) {
    var rec = byId[id];
    if (!rec) return { ok: false };
    var snapshot = U.clone(rec);
    observed = observed.filter(function (r) { return r.id !== id; });
    demo = demo.filter(function (r) { return r.id !== id; });
    delete byId[id];
    edits.deleted[id] = snapshot;
    delete edits.added[id];
    delete edits.changed[id];
    D.persist();
    GEO.emit('data:changed', { reason: 'delete', id: id });
    return { ok: true, record: snapshot };
  };

  D.restore = function (snapshot) {
    var rec = normalise(snapshot);
    (rec.recordType === 'DEMO' ? demo : observed).push(rec);
    byId[rec.id] = rec;
    delete edits.deleted[rec.id];
    if (!rec._meta.addedLocally) edits.changed[rec.id] = true;
    else edits.added[rec.id] = true;
    D.persist();
    GEO.emit('data:changed', { reason: 'restore', id: rec.id });
    return { ok: true, record: rec };
  };

  /* ---------------------------------------------------------- persistence */
  /* A diff against the shipped seed, not a copy of it: the full dataset is
     ~236 KB of JSON, which localStorage stores as UTF-16 (T4). */
  D.persist = function () {
    var seedById = {};
    (seed.records || []).forEach(function (r) { seedById[r.id] = r; });

    var payload = { schemaVersion: S.VERSION, savedAt: GEO.date.today(),
                    changed: {}, added: [], deleted: Object.keys(edits.deleted) };

    Object.keys(edits.changed).forEach(function (id) {
      var now = byId[id], was = seedById[id];
      if (!now || !was) return;
      var diff = {};
      Object.keys(now).forEach(function (k) {
        if (k === '_history') return;
        if (JSON.stringify(now[k]) !== JSON.stringify(was[k])) diff[k] = now[k];
      });
      if (Object.keys(diff).length) payload.changed[id] = diff;
    });
    Object.keys(edits.added).forEach(function (id) {
      if (byId[id]) payload.added.push(byId[id]);
    });

    var res = GEO.storage.set(EDITS_KEY, payload);
    if (!res.ok) {
      GEO.emit('storage:failed', {
        quota: res.quota,
        message: res.quota
          ? 'Browser storage is full, so this change was not saved. Export your data, then use Full reset.'
          : 'This change could not be saved to browser storage. Export your data to keep it.'
      });
    }
    return res;
  };

  D.restoreEdits = function () {
    var saved = GEO.storage.get(EDITS_KEY, null);
    demoMode = !!GEO.storage.get('demoMode', false);
    if (!saved) return;

    // Never silently migrate across a schema change: a field this build no longer
    // understands would be applied blind (M2). Hand it to the recovery dialog.
    if (saved.schemaVersion !== S.VERSION) {
      GEO.emit('storage:schemaMismatch', { saved: saved.schemaVersion, current: S.VERSION, payload: saved });
      return;
    }

    (saved.deleted || []).forEach(function (id) {
      var rec = byId[id];
      if (!rec) return;
      edits.deleted[id] = U.clone(rec);
      observed = observed.filter(function (r) { return r.id !== id; });
      demo = demo.filter(function (r) { return r.id !== id; });
      delete byId[id];
    });
    Object.keys(saved.changed || {}).forEach(function (id) {
      var rec = byId[id];
      if (!rec) return;
      Object.keys(saved.changed[id]).forEach(function (k) { rec[k] = saved.changed[id][k]; });
      edits.changed[id] = true;
    });
    (saved.added || []).forEach(function (raw) {
      var rec = normalise(raw);
      (rec.recordType === 'DEMO' ? demo : observed).push(rec);
      byId[rec.id] = rec;
      edits.added[rec.id] = true;
    });
  };

  D.localChanges = function () {
    var seedById = {};
    (seed.records || []).forEach(function (r) { seedById[r.id] = r; });
    var out = [];
    Object.keys(edits.added).forEach(function (id) {
      if (byId[id]) out.push({ kind: 'added', id: id, record: byId[id], fields: [] });
    });
    Object.keys(edits.changed).forEach(function (id) {
      var now = byId[id], was = seedById[id];
      if (!now || !was) return;
      var fields = S.fields.map(function (fd) { return fd.key; }).filter(function (k) {
        return JSON.stringify(now[k]) !== JSON.stringify(was[k]);
      }).map(function (k) { return { field: k, before: was[k], after: now[k] }; });
      if (fields.length) out.push({ kind: 'changed', id: id, record: now, fields: fields });
    });
    Object.keys(edits.deleted).forEach(function (id) {
      out.push({ kind: 'deleted', id: id, record: edits.deleted[id], fields: [] });
    });
    return out;
  };

  D.hasLocalChanges = function () { return D.localChanges().length > 0; };

  /* ----------------------------------------------------- restore / reset */
  D.restoreOriginal = function () {
    edits = { changed: {}, added: {}, deleted: {} };
    GEO.storage.remove(EDITS_KEY);
    D.load(seed, null);
    GEO.emit('data:changed', { reason: 'restoreOriginal' });
  };

  /* -------------------------------------------------------- import/export */
  D.exportEnvelope = function (rows, opts) {
    opts = opts || {};
    var set = rows || D.workingSet({ demoMode: true });
    var hasDemo = D.containsDemo(set);
    var env = {
      schemaVersion: S.VERSION,
      exportedAt: new Date().toISOString(),
      exportedBy: GEO.PRODUCT.name + ' ' + GEO.PRODUCT.version,
      city: seed.city, assetType: seed.assetType,
      refreshDays: S.refreshDays,
      criticalFields: S.criticalFields,
      evidenceProfiles: profiles,
      districts: districts.map(function (d) {
        return { key: d.key, name: d.name, nameRu: d.nameRu, nameUz: d.nameUz, areaHa: d.areaHa };
      }),
      sources: sources,
      containsDemoRecords: hasDemo,
      counts: {
        total: set.length,
        verifiedSource: set.filter(function (r) { return r.recordType === 'VERIFIED_SOURCE'; }).length,
        demo: set.filter(function (r) { return r.recordType === 'DEMO'; }).length
      },
      records: U.clone(set)
    };
    if (hasDemo) {
      // Visible in a text editor, at the top of the file, before any record (D4.7).
      env._WARNING = 'THIS EXPORT CONTAINS SYNTHETIC DEMO RECORDS (recordType "DEMO"). ' +
                     'They are fictional and are NOT market evidence. Filter them out before any analysis.';
    }
    if (opts.filters) env.appliedFilters = opts.filters;
    return env;
  };

  D.exportFilename = function (env) {
    return GEO.PRODUCT.name.toLowerCase().replace(/\s+/g, '-') + '-' +
           (seed.city.key || 'tashkent') + '-' + GEO.date.today() +
           (env.containsDemoRecords ? '-INCLUDES-DEMO' : '') + '.json';
  };

  /**
   * Validate an import and report per-row. All-or-nothing: a bad file never
   * half-applies (M8). Returns {ok, accepted, rejected, envelope, message}.
   */
  D.validateImport = function (text) {
    var env;
    try { env = JSON.parse(text); }
    catch (e) { return { ok: false, message: 'Import failed: the file is not valid JSON.' }; }

    if (!env || typeof env !== 'object' || !Array.isArray(env.records)) {
      return { ok: false, message: 'Import failed: no "records" array found. This does not look like a ' + GEO.PRODUCT.name + ' export.' };
    }
    if (env.schemaVersion !== S.VERSION) {
      return { ok: false, message: 'Import failed: the file uses schema version ' +
               (env.schemaVersion || 'unknown') + ', this build reads ' + S.VERSION +
               '. Nothing was changed.' };
    }

    var keys = districts.map(function (d) { return d.key; });
    var accepted = [], bad = [];
    env.records.forEach(function (raw, i) {
      var rec = normalise(raw);
      if (!rec.id) { bad.push({ row: i + 1, id: null, reason: 'missing id' }); return; }
      var v = S.validate(rec, { districtKeys: keys });
      if (!v.ok) {
        bad.push({ row: i + 1, id: rec.id,
                   reason: v.errors.map(function (e) { return e.message; }).join('; ') });
        return;
      }
      accepted.push(rec);
    });

    return {
      ok: bad.length === 0,
      accepted: accepted, rejected: bad, envelope: env,
      message: bad.length === 0
        ? accepted.length + ' ' + GEO.fmt.plural(accepted.length, 'record') + ' ready to import.'
        : 'Import rejected: ' + bad.length + ' of ' + env.records.length +
          ' records are invalid. Nothing was changed.'
    };
  };

  D.applyImport = function (result) {
    if (!result || !result.ok) return { ok: false };
    observed = []; demo = []; byId = {};
    result.accepted.forEach(function (r) {
      (r.recordType === 'DEMO' ? demo : observed).push(r);
      byId[r.id] = r;
    });
    if (result.envelope.evidenceProfiles) profiles = result.envelope.evidenceProfiles;
    edits = { changed: {}, added: {}, deleted: {} };
    observed.forEach(function (r) { edits.added[r.id] = true; });
    demo.forEach(function (r) { edits.added[r.id] = true; });
    D.persist();
    GEO.emit('data:changed', { reason: 'import', count: result.accepted.length });
    return { ok: true, count: result.accepted.length };
  };

  D.toCsv = function (rows, appliedFiltersText) {
    var cols = ['id', 'recordType'].concat(S.fields.map(function (fd) { return fd.key; }))
                                   .filter(function (c) { return c !== 'tenants'; });
    var head = [
      '# ' + GEO.PRODUCT.name + ' export – ' + GEO.date.today(),
      '# Filters: ' + (appliedFiltersText || 'none'),
      '# Blank cells mean NOT RECORDED. They do not mean zero.',
      '# Source: ' + sources.map(function (s) { return s.name; }).join(' | ')
    ].join('\n');

    function cell(v) {
      if (!U.isKnown(v)) return '';
      var s = Array.isArray(v) ? v.join('; ') : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    return head + '\n' + cols.join(',') + '\n' +
           rows.map(function (r) {
             return cols.map(function (c) { return cell(r[c]); }).join(',');
           }).join('\n');
  };
}(window));
