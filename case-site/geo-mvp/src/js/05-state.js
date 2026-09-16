/* ===========================================================================
 * 05-state — the single source of truth
 *
 * This file is what makes brief §59 ("manual controls must reflect AI-applied
 * filters") true by construction rather than by discipline.
 *
 * There is ONE state object. Every mutation goes through `set()`. Every panel
 * re-renders from the state it is given. No module writes to another module's
 * DOM, and no module keeps its own copy of anything in here. The assistant is
 * simply another caller of `set()` with `meta.source === 'ai'`, so it has no
 * private path to the map or the filters — which is exactly why the filter
 * panel cannot fall out of step with it.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util;

  var listeners = [];
  var log = [];               // the §61 session log
  var applying = false;       // re-entrancy guard

  function initial() {
    return {
      /* --- data scope --- */
      demoMode: false,
      excludeSuspectedNonBc: false,
      role: 'internal',                    // 'internal' | 'external'  (§60, product model only)

      /* --- filters (§11). The AI writes exactly this shape. --- */
      filters: {
        q: '',                             // name/address/district/tenant text
        districts: [],                     // canonical keys
        classes: [],                       // A+ | A | B+ | B | C
        includeUnknownClass: true,         // explicit: unknown is a choice, not an accident
        statuses: [],
        glaMin: null, glaMax: null,
        rentMin: null, rentMax: null,
        vacancyMin: null, vacancyMax: null,
        parkingMin: null,
        amenities: [],
        confidence: [],                    // High | Medium | Low | Unknown
        completeness: [],                  // none | minimal | partial | good
        freshness: [],                     // fresh | ageing | stale
        flags: []                          // districtConflict | duplicate | suspectedNonBc | editedLocally | demo
      },

      /* --- selection & workspaces --- */
      selectedId: null,
      hoverId: null,
      compare: [],                         // record ids, 2–4 (§15)
      leftTab: 'filters',                  // filters | results     (§12 map | map+list)
      leftRail: 'open',                    // open | collapsed | closed
      rightTab: 'property',                // property | analytics | ai | layers
      rightRail: 'closed',                 // open | closed
      overlay: null,                       // null | 'compare' | 'data' | 'dialog:*'
      dataTab: 'records',

      /* --- map --- */
      map: { centre: [41.3111, 69.2797], zoom: 12, fitToken: 0 },
      markerEncoding: 'officeClass',       // officeClass | confidence | completeness
      layerVisibility: { properties: true, districts: true, context: false },

      /* --- location analysis (§16) --- */
      radius: null,                        // { id, km:[1,3,5] } or null

      /* --- assistant (§57, §58) --- */
      aiLayers: [],                        // {id,name,criteriaHuman,criteriaMachine,recordIds,count,visible,createdAt}
      aiSession: { turns: [], lastResultIds: null, lastIntent: null },
      aiUnread: false,

      /* --- system --- */
      notice: null,
      tilesOk: true
    };
  }

  var state = initial();

  var State = GEO.state = {};

  State.get = function () { return state; };

  State.snapshot = function () { return U.clone(state); };

  /**
   * The only mutation path.
   * @param patch  shallow-merged at the top level; `filters` and `map` are
   *               merged one level deeper so a caller can set one filter.
   * @param meta   { source:'user'|'ai'|'boot'|'url', action:'…', tools:[…] }
   */
  State.set = function (patch, meta) {
    if (!patch) return state;
    meta = meta || { source: 'user', action: 'set' };

    if (applying) {
      // A subscriber calling set() during a render would produce a partially
      // rendered frame that no longer matches any single state. Fail loudly.
      GEO.log.error('state.set() called re-entrantly from a subscriber — ignored', meta.action);
      return state;
    }

    var next = U.clone(state);
    Object.keys(patch).forEach(function (k) {
      if (k === 'filters' || k === 'map' || k === 'aiSession' || k === 'layerVisibility') {
        next[k] = Object.assign({}, next[k], patch[k]);
      } else {
        next[k] = patch[k];
      }
    });

    // Invariants that must hold no matter who wrote the patch.
    if (next.compare.length > 4) next.compare = next.compare.slice(0, 4);
    if (next.role === 'external') {
      next.overlay = next.overlay === 'data' ? null : next.overlay;   // §60
    }
    if (next.selectedId && !GEO.data.get(next.selectedId)) next.selectedId = null;
    next.compare = next.compare.filter(function (id) { return !!GEO.data.get(id); });
    if (next.radius && !GEO.data.get(next.radius.id)) next.radius = null;

    var prev = state;
    state = U.deepFreeze(next);

    log.push({
      t: new Date().toISOString(),
      source: meta.source, action: meta.action,
      tools: meta.tools || null,
      keys: Object.keys(patch),
      // A one-line human description so the session log reads as a record of
      // what happened, not as a diff dump.
      summary: meta.summary || null
    });
    if (log.length > 1000) log.shift();

    applying = true;
    try {
      listeners.forEach(function (fn) {
        try { fn(state, patch, meta, prev); }
        catch (e) { GEO.log.error('state subscriber threw', e); }
      });
    } finally { applying = false; }

    return state;
  };

  State.subscribe = function (fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  };

  /* ------------------------------------------------------------ shortcuts */

  State.resetFilters = function (meta) {
    return State.set({ filters: initial().filters },
                     meta || { source: 'user', action: 'filters:reset', summary: 'Filters reset' });
  };

  /** §63 Test 8: clear everything the assistant created and return to all records,
   *  WITHOUT clearing the session log (reset clears state, not history). */
  State.clearAnalysis = function (meta) {
    return State.set({
      filters: initial().filters,
      aiLayers: [],
      radius: null,
      selectedId: null,
      compare: [],
      rightRail: 'closed',
      aiSession: { turns: state.aiSession.turns, lastResultIds: null, lastIntent: null },
      map: { fitToken: state.map.fitToken + 1 }
    }, meta || { source: 'user', action: 'analysis:clear', summary: 'Analysis cleared; returned to all business centres' });
  };

  State.sessionLog = function () { return log.slice(); };

  State.clearSession = function () {
    log = [];
    return State.set({ aiSession: { turns: [], lastResultIds: null, lastIntent: null },
                       aiLayers: [], radius: null, selectedId: null, compare: [] },
                     { source: 'user', action: 'session:new', summary: 'New session' });
  };

  /** True when any filter differs from its default — drives the "Reset filters"
   *  button's enabled state and the "N filters active" chip. */
  State.activeFilterCount = function (f) {
    var d = initial().filters;
    f = f || state.filters;
    return Object.keys(d).filter(function (k) {
      return JSON.stringify(f[k]) !== JSON.stringify(d[k]);
    }).length;
  };

  State.defaults = initial;
}(window));
