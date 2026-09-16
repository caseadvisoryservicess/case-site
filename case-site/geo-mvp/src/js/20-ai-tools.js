/* ===========================================================================
 * 20-ai-tools — the assistant's tool registry
 *
 * Brief §45, §56, §60. The assistant does NOT manipulate the UI. It calls typed
 * functions here, which read the data layer and write through `GEO.state.set`
 * like any other caller. That is what makes §59 hold: a filter the assistant
 * applies is the same filter object the filter panel renders from, so the two
 * cannot disagree.
 *
 * Swapping the local intent parser for a real LLM later means handing this
 * registry to the model as its tool schema. Nothing above this layer changes.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, S = GEO.schema, A = GEO.analytics, F = GEO.fmt;
  var T = GEO.ai = GEO.ai || {};
  var registry = {};

  /**
   * @param spec.id        stable name the planner emits
   * @param spec.access    'external' | 'internal'   (§60)
   * @param spec.mutates   true when it changes data rather than view state (§60 —
   *                       these require explicit confirmation and are refused in
   *                       the prototype, which has no backend to enforce permissions)
   * @param spec.args      { name: 'type — description' } for the future LLM schema
   * @param spec.run       function(args, ctx) -> result
   */
  T.register = function (spec) {
    if (!spec.id || typeof spec.run !== 'function') throw new Error('bad tool spec');
    registry[spec.id] = spec;
    return spec;
  };

  T.tools = function () { return registry; };
  T.tool = function (id) { return registry[id] || null; };

  T.available = function (role) {
    return Object.keys(registry).filter(function (id) {
      return role === 'internal' || registry[id].access === 'external';
    });
  };

  /** Describe the registry the way an LLM tool-schema would want it. The future
   *  provider adapter serialises exactly this. */
  T.schema = function (role) {
    return T.available(role).map(function (id) {
      var t = registry[id];
      return { name: id, description: t.description, args: t.args,
               readOnly: !t.mutates, access: t.access };
    });
  };

  T.call = function (id, args, ctx) {
    var t = registry[id];
    if (!t) return { ok: false, error: 'No such tool: ' + id };
    if (t.access === 'internal' && ctx.role !== 'internal') {
      return { ok: false, error: 'That uses internal data, which is not available in the client view.' };
    }
    if (t.mutates && !ctx.confirmed) {
      return { ok: false, needsConfirmation: true,
               error: 'This would change stored data. It needs explicit confirmation, and in this prototype there is no backend to record it.' };
    }
    try { return Object.assign({ ok: true, tool: id, args: args }, t.run(args || {}, ctx)); }
    catch (e) {
      GEO.log.error('tool ' + id + ' threw', e);
      return { ok: false, tool: id, error: String(e && e.message || e) };
    }
  };

  /* ================================ helpers =============================== */

  function scope(ctx) {
    return GEO.data.workingSet({
      demoMode: ctx.state.demoMode,
      excludeSuspectedNonBc: ctx.state.excludeSuspectedNonBc
    });
  }

  /**
   * The rows the assistant is currently talking about.
   *
   * By default this is whatever the FILTERS select — the same set the map and the
   * list are showing — because that is what a user means by "these". Only an
   * explicit refinement ("only those above $30") narrows the previous RESULT set,
   * and the caller says so by passing `preferLastResult`.
   *
   * Inheriting the last result silently is worse than it sounds: after asking for
   * competitors within 3 km, a fresh question like "show properties with poor data
   * quality" would answer about those 74 records while appearing to answer about
   * the dataset, and the denominator would look plausible either way.
   */
  function currentRows(ctx, preferLastResult) {
    var s = ctx.state;
    if (preferLastResult && s.aiSession.lastResultIds && s.aiSession.lastResultIds.length) {
      var want = {};
      s.aiSession.lastResultIds.forEach(function (id) { want[id] = true; });
      var rows = scope(ctx).filter(function (r) { return want[r.id]; });
      if (rows.length) return rows;
    }
    return GEO.filters ? GEO.filters.apply(scope(ctx), s.filters) : scope(ctx);
  }

  /**
   * The gate that stops the assistant answering a question the data cannot support
   * (§47, §62). Returns a refusal object when `field` has no coverage in `rows`,
   * or null when it does. The refusal names the field, gives the real numbers,
   * and says what would be needed — it never guesses and never quietly returns [].
   */
  function requireCoverage(rows, field, ctx) {
    var c = A.coverage(rows, field);
    if (c.n > 0) return null;
    var label = S.label(field);
    var whole = A.coverage(scope(ctx), field);
    return {
      unavailable: true,
      field: field,
      answer: label + ' is recorded for 0 of the ' + F.int(c.N) + ' ' +
              F.plural(c.N, 'property', 'properties') + ' in the current selection' +
              (whole.N !== c.N ? ' (and for ' + whole.n + ' of ' + whole.N + ' in the whole dataset)' : '') +
              ', so this cannot be answered from the data held.',
      required: 'A recorded ' + GEO.fmt.lower(label) + ' per building.',
      coverage: { n: c.n, N: c.N, field: field }
    };
  }
  T._requireCoverage = requireCoverage;
  T._currentRows = currentRows;
  T._scope = scope;

  function ids(rows) { return rows.map(function (r) { return r.id; }); }

  /* ================================= tools ================================ */

  /* --- read: query ------------------------------------------------------- */

  T.register({
    id: 'searchProperties', access: 'external', mutates: false,
    description: 'Find properties by free text across name, address, district and tenant.',
    args: { q: 'string — the search text', limit: 'number — max results (default 20)' },
    run: function (a, ctx) {
      var rows = scope(ctx);
      var res = GEO.search ? GEO.search.query(rows, a.q, { limit: a.limit || 20 })
                           : { items: [], total: 0, districts: [] };
      return { rows: res.items.map(function (i) { return i.record; }),
               total: res.total, districts: res.districts };
    }
  });

  T.register({
    id: 'filterProperties', access: 'external', mutates: false,
    description: 'Evaluate a filter set against the dataset without applying it to the UI.',
    args: { filters: 'object — a partial filter object' },
    run: function (a, ctx) {
      var f = Object.assign({}, GEO.state.defaults().filters, a.filters || {});
      var rows = GEO.filters.apply(scope(ctx), f);
      return { rows: rows, filters: f, explain: GEO.filters.explain(scope(ctx), f) };
    }
  });

  T.register({
    id: 'getProperty', access: 'external', mutates: false,
    description: 'Fetch one property by id.',
    args: { id: 'string' },
    run: function (a) { return { record: GEO.data.get(a.id) }; }
  });

  T.register({
    id: 'getNearbyProperties', access: 'external', mutates: false,
    description: 'Properties within a radius of a subject property, nearest first.',
    args: { id: 'string — subject property', km: 'number — radius in kilometres' },
    run: function (a, ctx) {
      var subj = GEO.data.get(a.id);
      if (!subj) return { rows: [], error: 'No such property' };
      var hits = GEO.geo.withinM(scope(ctx), subj, (a.km || 3) * 1000, subj.id);
      return { rows: hits.map(function (h) { return h.record; }), hits: hits, subject: subj };
    }
  });

  /* --- read: calculate --------------------------------------------------- */

  T.register({
    id: 'calculateMetric', access: 'external', mutates: false,
    description: 'Compute one metric over a set of properties, with its denominator.',
    args: { field: 'string — schema field key', kind: 'count|sum|mean|median|min|max',
            rowIds: 'string[] — optional; defaults to the current result set' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      return { metric: A.metric(rows, a.field, a.kind || 'mean'), rows: rows };
    }
  });

  T.register({
    id: 'aggregateByDistrict', access: 'external', mutates: false,
    description: 'Group properties by district and measure each group.',
    args: { measure: 'string — optional field to measure', kind: 'count|sum|mean|median',
            rowIds: 'string[] — optional' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      if (a.measure) {
        var gate = requireCoverage(rows, a.measure, ctx);
        if (gate) return { refusal: gate };
      }
      return { groups: A.byDistrict(rows, { measure: a.measure, kind: a.kind || 'count' }), rows: rows };
    }
  });

  T.register({
    id: 'aggregateByClass', access: 'external', mutates: false,
    description: 'Group properties by office class and measure each group.',
    args: { measure: 'string — optional', kind: 'count|sum|mean|median', rowIds: 'string[] — optional' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      if (a.measure) {
        var gate = requireCoverage(rows, a.measure, ctx);
        if (gate) return { refusal: gate };
      }
      return { groups: A.byClass(rows, { measure: a.measure, kind: a.kind || 'count' }), rows: rows };
    }
  });

  T.register({
    id: 'getDataCoverage', access: 'external', mutates: false,
    description: 'How much of each field is actually recorded for a set of properties.',
    args: { rowIds: 'string[] — optional', fields: 'string[] — optional' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      var fields = a.fields || S.criticalFields;
      return {
        rows: rows,
        coverage: fields.map(function (f) {
          var c = A.coverage(rows, f);
          return { field: f, label: S.label(f), n: c.n, N: c.N };
        }),
        statement: A.coverageStatement(rows)
      };
    }
  });

  T.register({
    id: 'getSources', access: 'external', mutates: false,
    description: 'The sources and collection dates behind a set of properties.',
    args: { rowIds: 'string[] — optional' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      var seen = {};
      rows.forEach(function (r) {
        Object.keys(r._evidence).forEach(function (f) {
          var e = GEO.data.evidence(r, f);
          if (!e) return;
          var k = e.source + '|' + e.collectedAt;
          seen[k] = seen[k] || { source: e.source, method: e.method, collectedAt: e.collectedAt,
                                 confidence: e.confidence, fields: {}, records: {} };
          seen[k].fields[f] = true;
          seen[k].records[r.id] = true;
        });
      });
      return { sources: Object.keys(seen).map(function (k) {
        var s = seen[k];
        return { source: s.source, method: s.method, collectedAt: s.collectedAt,
                 confidence: s.confidence, fields: Object.keys(s.fields),
                 recordCount: Object.keys(s.records).length };
      }) };
    }
  });

  /* --- write: view state (never data) ------------------------------------ */

  T.register({
    id: 'applyFilters', access: 'external', mutates: false,
    description: 'Apply filters to the map and the filter panel. The panel visibly reflects them.',
    args: { filters: 'object — partial filter patch', replace: 'boolean — reset the others first' },
    run: function (a, ctx) {
      var base = a.replace ? GEO.state.defaults().filters : ctx.state.filters;
      var next = Object.assign({}, base, a.filters || {});
      var rows = GEO.filters.apply(scope(ctx), next);
      GEO.state.set({ filters: next }, {
        source: 'ai', action: 'applyFilters', tools: ['applyFilters'],
        summary: GEO.filters.describe(next)
      });
      return { rows: rows, filters: next,
               mapAction: 'Applied filters: ' + GEO.filters.describe(next) };
    }
  });

  T.register({
    id: 'clearFilters', access: 'external', mutates: false,
    description: 'Return every filter to its default.',
    args: {},
    run: function (a, ctx) {
      GEO.state.resetFilters({ source: 'ai', action: 'clearFilters', summary: 'Filters cleared' });
      return { rows: scope(ctx), mapAction: 'Cleared all filters' };
    }
  });

  T.register({
    id: 'selectProperty', access: 'external', mutates: false,
    description: 'Select a property and open its detail panel.',
    args: { id: 'string' },
    run: function (a) {
      var rec = GEO.data.get(a.id);
      if (!rec) return { error: 'No such property' };
      GEO.state.set({ selectedId: a.id, rightRail: 'open', rightTab: 'property' },
                    { source: 'ai', action: 'selectProperty', summary: 'Selected ' + rec.name });
      return { record: rec, mapAction: 'Selected ' + rec.name };
    }
  });

  T.register({
    id: 'zoomToProperty', access: 'external', mutates: false,
    description: 'Centre and zoom the map on a property.',
    args: { id: 'string', zoom: 'number' },
    run: function (a) {
      var rec = GEO.data.get(a.id);
      if (!rec) return { error: 'No such property' };
      if (GEO.map && GEO.map.zoomTo) GEO.map.zoomTo(rec, a.zoom || 16);
      return { record: rec, mapAction: 'Zoomed to ' + rec.name };
    }
  });

  T.register({
    id: 'createRadius', access: 'external', mutates: false,
    description: 'Draw distance rings around a property and compute the location analysis.',
    args: { id: 'string', bandsKm: 'number[] — default [1,3,5]' },
    run: function (a, ctx) {
      var subj = GEO.data.get(a.id);
      if (!subj) return { error: 'No such property' };
      var bands = a.bandsKm || GEO.geo.DEFAULT_BANDS_KM;
      var analysis = GEO.geo.locationAnalysis(subj, scope(ctx), { bandsKm: bands });
      GEO.state.set({ radius: { id: subj.id, km: bands }, selectedId: subj.id },
                    { source: 'ai', action: 'createRadius',
                      summary: bands.join('/') + ' km rings around ' + subj.name });
      return { analysis: analysis, subject: subj,
               mapAction: 'Drew ' + bands.join(', ') + ' km rings around ' + subj.name };
    }
  });

  T.register({
    id: 'removeRadius', access: 'external', mutates: false,
    description: 'Remove the distance rings.',
    args: {},
    run: function () {
      GEO.state.set({ radius: null }, { source: 'ai', action: 'removeRadius', summary: 'Rings removed' });
      return { mapAction: 'Removed the distance rings' };
    }
  });

  /* --- write: AI layers (§57) -------------------------------------------- */

  T.register({
    id: 'createLayer', access: 'external', mutates: false,
    description: 'Save a result set as a named, inspectable map layer.',
    args: { name: 'string', rowIds: 'string[]', criteriaHuman: 'string',
            criteriaMachine: 'object', style: 'string' },
    run: function (a, ctx) {
      var layer = {
        id: 'L' + (ctx.state.aiLayers.length + 1) + '-' + Math.abs(hash(a.name)).toString(36),
        name: a.name,
        criteriaHuman: a.criteriaHuman || a.name,
        criteriaMachine: a.criteriaMachine || null,
        recordIds: a.rowIds || [],
        count: (a.rowIds || []).length,
        style: a.style || 'highlight',
        visible: true,
        createdAt: new Date().toISOString()
      };
      GEO.state.set({ aiLayers: ctx.state.aiLayers.concat([layer]) },
                    { source: 'ai', action: 'createLayer',
                      summary: 'Layer "' + layer.name + '" (' + layer.count + ' properties)' });
      return { layer: layer,
               mapAction: 'Created layer "' + layer.name + '" with ' +
                          F.int(layer.count) + ' ' + F.plural(layer.count, 'property', 'properties') };
    }
  });

  T.register({
    id: 'removeLayer', access: 'external', mutates: false,
    description: 'Remove one layer, or every layer.',
    args: { id: 'string — omit to remove all' },
    run: function (a, ctx) {
      var kept = a.id ? ctx.state.aiLayers.filter(function (l) { return l.id !== a.id; }) : [];
      var removed = ctx.state.aiLayers.length - kept.length;
      GEO.state.set({ aiLayers: kept, radius: a.id ? ctx.state.radius : null },
                    { source: 'ai', action: 'removeLayer', summary: removed + ' layer(s) removed' });
      return { removed: removed, mapAction: 'Removed ' + removed + ' layer' + (removed === 1 ? '' : 's') };
    }
  });

  /* --- write: comparison -------------------------------------------------- */

  T.register({
    id: 'compareProperties', access: 'external', mutates: false,
    description: 'Stage 2–4 properties for side-by-side comparison and open the comparison view.',
    args: { rowIds: 'string[]' },
    run: function (a) {
      var list = (a.rowIds || []).slice(0, 4).filter(function (id) { return !!GEO.data.get(id); });
      if (list.length < 2) return { error: 'Comparison needs at least two properties.' };
      GEO.state.set({ compare: list, overlay: 'compare' },
                    { source: 'ai', action: 'compareProperties',
                      summary: 'Comparing ' + list.length + ' properties' });
      return { rowIds: list,
               records: list.map(GEO.data.get),
               mapAction: 'Opened a comparison of ' + list.length + ' properties' };
    }
  });

  /* --- read: quality (internal) ------------------------------------------ */

  T.register({
    id: 'showDataQuality', access: 'external', mutates: false,
    description: 'Data-quality profile of a set: completeness bands, confidence split, open issues.',
    args: { rowIds: 'string[] — optional' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      if (!GEO.quality) return { error: 'The quality module is not available.' };
      return {
        rows: rows,
        confidence: GEO.quality.confidenceSummary(rows),
        completeness: rows.reduce(function (acc, r) {
          var b = GEO.quality.completeness(r).band;
          acc[b] = (acc[b] || 0) + 1;
          return acc;
        }, {}),
        issues: GEO.quality.issues(rows),
        summary: GEO.quality.datasetSummary(rows)
      };
    }
  });

  T.register({
    id: 'getVerificationQueue', access: 'internal', mutates: false,
    description: 'Rank properties by how badly they need re-verification (§50).',
    args: { rowIds: 'string[] — optional', limit: 'number' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      if (!GEO.quality) return { error: 'The quality module is not available.' };
      var q = GEO.quality.verificationQueue(rows);
      return { queue: q.slice(0, a.limit || 20), total: q.length,
               summary: GEO.quality.datasetSummary(rows) };
    }
  });

  T.register({
    id: 'exportResults', access: 'external', mutates: false,
    description: 'Export the current result set as CSV.',
    args: { rowIds: 'string[] — optional', format: 'csv|json' },
    run: function (a, ctx) {
      var rows = a.rowIds ? a.rowIds.map(GEO.data.get).filter(Boolean) : currentRows(ctx);
      var text, name, mime;
      if (a.format === 'json') {
        var env = GEO.data.exportEnvelope(rows);
        text = JSON.stringify(env, null, 1);
        name = GEO.data.exportFilename(env);
        mime = 'application/json';
      } else {
        text = GEO.data.toCsv(rows, GEO.filters.describe(ctx.state.filters));
        name = 'geo-mvp-selection-' + GEO.date.today() + '.csv';
        mime = 'text/csv';
      }
      if (GEO.boot && GEO.boot.download) GEO.boot.download(text, name, mime);
      return { count: rows.length, filename: name,
               mapAction: 'Exported ' + F.int(rows.length) + ' records as ' + (a.format === 'json' ? 'JSON' : 'CSV') };
    }
  });

  /* --- mutating tools (§60): registered, declared, and refused ------------ */
  /* These exist so the permission model is real rather than described. In this
     prototype they always refuse — there is no backend to record a change
     against, and pretending otherwise would be the fabrication §47 forbids. */

  T.register({
    id: 'createFieldTasks', access: 'internal', mutates: true,
    description: 'Create field-collection tasks for a set of properties (§50).',
    args: { rowIds: 'string[]', fields: 'string[]', deadline: 'string' },
    run: function () {
      return { refused: true,
               message: 'Creating field tasks needs a backend to store them and a named collector to own them. ' +
                        'Neither exists in this prototype. The prioritised list above is exportable as CSV in the meantime.' };
    }
  });

  T.register({
    id: 'updateRecord', access: 'internal', mutates: true,
    description: 'Change a stored property value.',
    args: { id: 'string', patch: 'object' },
    run: function () {
      return { refused: true,
               message: 'The assistant does not edit records in this prototype. Open the property in the data editor to change it — ' +
                        'every edit is written with its own provenance, which an automated change would not have.' };
    }
  });

  function hash(str) {
    var h = 0;
    for (var i = 0; i < String(str).length; i++) {
      h = ((h << 5) - h) + String(str).charCodeAt(i);
      h |= 0;
    }
    return h;
  }
}(window));
