/* ===========================================================================
 * 99-boot — wiring and start-up
 *
 * The only file that knows the order things happen in. Everything else is a
 * module that exposes functions and subscribes to state; this file connects
 * them to the DOM in shell.html and starts the app.
 *
 * Boot is deliberately defensive: on file:// there is no console open, no
 * server log and no way for a non-technical tester to recover from a white
 * screen. Every failure mode ends in a visible, actionable screen instead
 * (build contract M2/M3).
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, S = GEO.schema;
  var B = GEO.boot = {};

  /* ------------------------------------------------------------ recovery */
  /* Handled BEFORE anything else reads storage: if a previous session wrote a
     state this build cannot read, the user must still be able to get out —
     without devtools, without a server, without us. */
  function handleEscapeHatch() {
    if (location.hash === '#reset') {
      try { GEO.storage.clearAll(); } catch (e) { /* nothing better to do */ }
      location.replace(location.pathname);
      return true;
    }
    return false;
  }

  function fatal(title, message, actions) {
    var el = Q.el;
    var box = Q.$('#boot');
    Q.$('#boot-title').textContent = title;
    Q.$('#boot-msg').textContent = message;
    Q.fill(Q.$('#boot-actions'), (actions || []).map(function (a) {
      return el('button.btn' + (a.primary ? '.btn--primary' : '.btn--quiet'),
                { type: 'button', text: a.label, onclick: a.run });
    }));
    box.hidden = false;
    GEO.log.error('boot failed:', title, message);
  }

  /* -------------------------------------------------------------- notices */
  function notice(text, kind) {
    var n = Q.$('#notice');
    if (!text) { n.hidden = true; return; }
    n.dataset.kind = kind || 'info';
    Q.fill(n, [Q.el('span', { text: text })]);
    n.hidden = false;
  }
  B.notice = notice;

  GEO.on('storage:failed', function (p) { notice(p.message, 'warn'); });

  GEO.on('storage:schemaMismatch', function (p) {
    // Never silently migrate and never silently discard: offer the user both,
    // and let them take their data out first.
    fatal('Saved data is from an older version',
          'Your browser holds edits saved with schema version ' + p.saved +
          ', but this build reads ' + S.VERSION + '. Nothing has been loaded or changed. ' +
          'Export the old data if you need it, then start clean.',
      [
        { label: 'Export the old data', run: function () {
            B.download(JSON.stringify(p.payload, null, 1),
                       'geo-mvp-recovered-' + GEO.date.today() + '.json', 'application/json');
          } },
        { label: 'Discard it and start clean', primary: true, run: function () {
            GEO.storage.clearAll();
            location.replace(location.pathname);
          } }
      ]);
  });

  /* ------------------------------------------------------------- download */
  /* A data: URL rather than a Blob URL, because Blob URLs are unreliable from
     the file:// origin in some browsers and this must work offline. */
  B.download = function (text, filename, mime) {
    var a = document.createElement('a');
    a.href = 'data:' + (mime || 'text/plain') + ';charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /* --------------------------------------------------------------- toasts */
  B.toast = function (text, action) {
    var el = Q.el;
    var node = el('div.toast', { role: 'status' }, [
      el('span.toast__text', { text: text }),
      action ? el('button.toast__action', {
        type: 'button', text: action.label,
        onclick: function () { action.run(); node.remove(); }
      }) : null,
      el('button.toast__close', { type: 'button', 'aria-label': 'Dismiss',
        text: '×', onclick: function () { node.remove(); } })
    ]);
    Q.$('#toasts').appendChild(node);
    setTimeout(function () { node.classList.add('is-leaving'); }, 5600);
    setTimeout(function () { if (node.parentNode) node.remove(); }, 6000);
    return node;
  };

  /* --------------------------------------------------------------- dialog */
  B.dialog = function (opts) {
    var el = Q.el;
    var box = Q.$('#dialog');
    var lastFocus = document.activeElement;

    Q.$('#dialog-title').textContent = opts.title;
    Q.fill(Q.$('#dialog-body'), typeof opts.body === 'string'
      ? [el('p', { text: opts.body })] : [opts.body]);
    Q.fill(Q.$('#dialog-actions'), (opts.actions || []).map(function (a) {
      return el('button.btn' + (a.primary ? '.btn--primary' : (a.danger ? '.btn--danger' : '.btn--quiet')),
        { type: 'button', text: a.label, onclick: function () { close(); if (a.run) a.run(); } });
    }));

    function close() {
      box.hidden = true;
      Q.$('#scrim').hidden = true;
      document.removeEventListener('keydown', onKey);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape' && !opts.nonDismissible) { e.preventDefault(); close(); }
      if (e.key === 'Tab') trapFocus(box, e);
    }

    box.hidden = false;
    Q.$('#scrim').hidden = false;
    document.addEventListener('keydown', onKey);
    var first = box.querySelector('button, [href], input, select, textarea');
    if (first) first.focus();
    return { close: close };
  };

  function trapFocus(container, e) {
    var f = Q.$$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', container)
      .filter(function (n) { return !n.disabled && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  B.trapFocus = trapFocus;

  B.confirm = function (title, body, confirmLabel, onConfirm, danger) {
    return B.dialog({
      title: title, body: body,
      actions: [
        { label: 'Cancel' },
        { label: confirmLabel, primary: !danger, danger: danger, run: onConfirm }
      ]
    });
  };

  /* ---------------------------------------------------------- derivations */
  /* One place computes "which records are we looking at", so the counter, the
     list, the map, the charts and the assistant can never disagree. */
  B.visible = function (state) {
    var rows = GEO.data.workingSet({
      demoMode: state.demoMode,
      excludeSuspectedNonBc: state.excludeSuspectedNonBc
    });
    return GEO.filters ? GEO.filters.apply(rows, state.filters) : rows;
  };

  B.scope = function (state) {
    return GEO.data.workingSet({
      demoMode: state.demoMode,
      excludeSuspectedNonBc: state.excludeSuspectedNonBc
    });
  };

  /* --------------------------------------------------------------- render */
  var panels = [];
  B.registerPanel = function (fn) { panels.push(fn); };

  function render(state, patch, meta) {
    var rows = B.visible(state);
    var scope = B.scope(state);
    var app = Q.$('#app');
    app.dataset.left = state.leftRail;
    app.dataset.right = state.rightRail;
    app.dataset.leftTab = state.leftTab;
    app.dataset.rightTab = state.rightTab;
    app.dataset.role = state.role;
    Q.$('#rail-right').hidden = state.rightRail !== 'open';

    Q.$$('#rail-left [role="tab"]').forEach(function (t) {
      var on = t.id === 'tab-' + state.leftTab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Q.$('#pane-filters').hidden = state.leftTab !== 'filters';
    Q.$('#pane-results').hidden = state.leftTab !== 'results';

    Q.$$('#rail-right [role="tab"]').forEach(function (t) {
      var on = t.id === 'tab-' + state.rightTab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    ['property', 'analytics', 'ai', 'layers'].forEach(function (k) {
      var p = Q.$('#pane-' + k);
      if (p) p.hidden = state.rightTab !== k;
    });

    Q.$('#btn-analytics').setAttribute('aria-pressed',
      String(state.rightRail === 'open' && state.rightTab === 'analytics'));
    Q.$('#btn-ai').setAttribute('aria-pressed',
      String(state.rightRail === 'open' && state.rightTab === 'ai'));
    Q.$('#btn-data').hidden = state.role === 'external';
    Q.$('#ai-dot').hidden = !state.aiUnread;

    // X-11 / §8 / §19 — the header's standing statement about the dataset:
    // how many records, from how many sources, how recently, and how many have
    // ever been verified in the field. Recomputed on every change, including
    // after a local edit, so it can never describe a dataset that no longer exists.
    var chip = Q.$('#data-chip');
    if (GEO.quality && GEO.quality.datasetSummary) {
      var ds = GEO.quality.datasetSummary(scope);
      chip.textContent = ds.text;
      chip.title = (ds.fieldVerifiedNote || '') +
                   (ds.stalenessNote ? ' ' + ds.stalenessNote : '');
    } else {
      chip.textContent = GEO.fmt.int(scope.length) + ' records';
    }

    Q.$('#demobar').hidden = !state.demoMode;
    document.body.classList.toggle('has-demobar', state.demoMode);

    var layersBadge = Q.$('#layers-badge');
    layersBadge.hidden = !state.aiLayers.length;
    layersBadge.textContent = String(state.aiLayers.length);

    var fBadge = Q.$('#filters-badge');
    var active = GEO.state.activeFilterCount(state.filters);
    fBadge.hidden = !active;
    fBadge.textContent = String(active);
    var resetBtn = Q.$('#btn-reset-filters');
    resetBtn.disabled = !active;
    resetBtn.title = active
      ? GEO.i18n.t('list.action.resetAll')
      : 'No filters are active, so there is nothing to reset.';

    // §59 / P7: when the assistant changes filters we do NOT yank the rail open —
    // that steals the map. We mark the tab so the manual controls are visibly
    // out of date, and the toast offers the jump.
    if (meta && meta.source === 'ai' && patch && patch.filters) {
      if (state.leftTab !== 'filters' || state.leftRail !== 'open') {
        Q.$('#filters-ai-dot').hidden = false;
        B.toast('Filters updated by the assistant', {
          label: 'View filters',
          run: function () {
            GEO.state.set({ leftRail: 'open', leftTab: 'filters' },
                          { source: 'user', action: 'rail:showFilters' });
          }
        });
      }
    }
    if (state.leftTab === 'filters' && state.leftRail === 'open') {
      Q.$('#filters-ai-dot').hidden = true;
    }

    var scrimNeeded = !!state.overlay;
    Q.$('#scrim').hidden = !scrimNeeded;
    Q.$('#overlay-compare').hidden = state.overlay !== 'compare';
    Q.$('#overlay-data').hidden = state.overlay !== 'data';
    // P5: while a modal is open the rest of the app is inert but stays mounted,
    // so the map viewport and every panel's state survive the round trip.
    ['#app'].forEach(function (sel) {
      var n = Q.$(sel);
      if (scrimNeeded) { n.setAttribute('inert', ''); n.setAttribute('aria-hidden', 'true'); }
      else { n.removeAttribute('inert'); n.removeAttribute('aria-hidden'); }
    });

    // §11's "X properties found", plus the scope denominator when a filter is narrowing it.
    var countKey = 'filter.results.count.' + (rows.length === 1 ? 'one' : 'other');
    var countText = GEO.i18n ? GEO.i18n.t(countKey, { n: GEO.fmt.int(rows.length) })
                             : GEO.fmt.int(rows.length) + ' properties found';
    if (rows.length !== scope.length) {
      countText += ' · ' + (GEO.i18n ? GEO.i18n.t('list.showing', { n: GEO.fmt.int(rows.length), m: GEO.fmt.int(scope.length) })
                                     : 'of ' + GEO.fmt.int(scope.length));
    }
    Q.$('#result-count').textContent = countText;

    var tray = Q.$('#compare-tray');
    tray.hidden = state.compare.length === 0;
    Q.$('#compare-tray-label').textContent =
      state.compare.length + ' selected for comparison';
    Q.$('#btn-open-compare').disabled = state.compare.length < 2;

    panels.forEach(function (fn) {
      try { fn(state, rows, scope, patch, meta); }
      catch (e) { GEO.log.error('panel render failed', e); }
    });
  }

  /* ----------------------------------------------------------- header wiring */
  function wireHeader() {
    Q.$('#product-name').textContent = GEO.PRODUCT.name;
    Q.$('#product-provisional').hidden = !GEO.PRODUCT.provisional;

    Q.$('#btn-analytics').addEventListener('click', function () {
      var s = GEO.state.get();
      var open = s.rightRail === 'open' && s.rightTab === 'analytics';
      GEO.state.set({ rightRail: open ? 'closed' : 'open', rightTab: 'analytics' },
                    { source: 'user', action: 'rail:analytics' });
    });
    Q.$('#btn-ai').addEventListener('click', function () {
      var s = GEO.state.get();
      var open = s.rightRail === 'open' && s.rightTab === 'ai';
      GEO.state.set({ rightRail: open ? 'closed' : 'open', rightTab: 'ai', aiUnread: false },
                    { source: 'user', action: 'rail:ai' });
    });
    Q.$('#btn-data').addEventListener('click', function () {
      GEO.state.set({ overlay: 'data' }, { source: 'user', action: 'overlay:data' });
    });
    Q.$('#data-chip').addEventListener('click', function () {
      GEO.state.set({ overlay: 'data', dataTab: 'coverage' },
                    { source: 'user', action: 'overlay:data:coverage' });
    });
    Q.$('#data-close').addEventListener('click', function () {
      GEO.state.set({ overlay: null }, { source: 'user', action: 'overlay:close' });
    });
    Q.$('#compare-close').addEventListener('click', function () {
      GEO.state.set({ overlay: null }, { source: 'user', action: 'overlay:close' });
    });
    Q.$('#scrim').addEventListener('click', function () {
      GEO.state.set({ overlay: null }, { source: 'user', action: 'overlay:close' });
    });

    Q.$('#rail-right-close').addEventListener('click', function () {
      GEO.state.set({ rightRail: 'closed' }, { source: 'user', action: 'rail:close' });
    });
    Q.$('#rail-left-collapse').addEventListener('click', function () {
      var s = GEO.state.get();
      GEO.state.set({ leftRail: s.leftRail === 'open' ? 'collapsed' : 'open' },
                    { source: 'user', action: 'rail:toggleLeft' });
    });
    Q.$$('#rail-left [role="tab"]').forEach(function (t) {
      t.addEventListener('click', function () {
        GEO.state.set({ leftTab: t.id.replace('tab-', ''), leftRail: 'open' },
                      { source: 'user', action: 'rail:leftTab' });
      });
    });
    Q.$$('#rail-right [role="tab"]').forEach(function (t) {
      t.addEventListener('click', function () {
        GEO.state.set({ rightTab: t.id.replace('tab-', ''), rightRail: 'open' },
                      { source: 'user', action: 'rail:rightTab' });
      });
    });

    Q.$('#btn-reset-filters').addEventListener('click', function () {
      GEO.state.resetFilters({ source: 'user', action: 'filters:reset' });
    });
    Q.$('#btn-export-csv').addEventListener('click', function () {
      var s = GEO.state.get();
      var rows = B.visible(s);
      var desc = GEO.filters ? GEO.filters.describe(s.filters) : 'none';
      B.download(GEO.data.toCsv(rows, desc),
                 'geo-mvp-selection-' + GEO.date.today() + '.csv', 'text/csv');
      B.toast(GEO.fmt.int(rows.length) + ' records exported as CSV');
    });

    Q.$('#btn-open-compare').addEventListener('click', function () {
      GEO.state.set({ overlay: 'compare' }, { source: 'user', action: 'overlay:compare' });
    });
    Q.$('#btn-clear-compare').addEventListener('click', function () {
      GEO.state.set({ compare: [] }, { source: 'user', action: 'compare:clear' });
    });

    Q.$('#demo-off').addEventListener('click', function () {
      GEO.data.setDemoMode(false);
      GEO.state.set({ demoMode: false }, { source: 'user', action: 'demo:off' });
    });

    // Menus whose only option is the current one: rendered as real menus so the
    // roadmap is visible, with every other entry disabled and labelled — never a
    // silent no-op (§29).
    [['#city-menu', 'city'], ['#type-menu', 'assetType'], ['#lang-menu', 'lang']]
      .forEach(function (pair) {
        Q.$(pair[0]).addEventListener('click', function () { B.openScopeMenu(pair[1], Q.$(pair[0])); });
      });

    Q.$('#btn-settings').addEventListener('click', function () { B.openSettings(); });

    Q.$$('#tabbar .tabbar__btn').forEach(function (b) {
      b.addEventListener('click', function () {
        var go = b.dataset.go;
        if (go === 'map') GEO.state.set({ leftRail: 'closed', rightRail: 'closed', overlay: null }, { source: 'user', action: 'nav:map' });
        else if (go === 'results') GEO.state.set({ leftRail: 'open', leftTab: 'results', rightRail: 'closed', overlay: null }, { source: 'user', action: 'nav:list' });
        else if (go === 'data') GEO.state.set({ overlay: 'data' }, { source: 'user', action: 'nav:data' });
        else GEO.state.set({ rightRail: 'open', rightTab: go, leftRail: 'closed', overlay: null }, { source: 'user', action: 'nav:' + go });
      });
    });
  }

  /* ---------------------------------------------------------- breakpoints */
  /* The rails are docked columns above 1280, overlay drawers from 768 to 1023 and
     bottom sheets below that (IA P2-P4). The DEFAULT differs with them: on a small
     screen the map must be what you see first, so booting with a drawer covering it
     would be wrong. Without this, `leftRail` said "open" on a tablet while the CSS
     parked the rail off-screen — state and rendering disagreeing, which is exactly
     the class of bug the single-source-of-truth rule exists to prevent. */
  B.BREAKPOINTS = [
    { name: 'xxl', min: 1920 }, { name: 'xl', min: 1440 }, { name: 'l', min: 1280 },
    { name: 'm', min: 1024 }, { name: 's', min: 768 }, { name: 'xs', min: 481 },
    { name: 'xxs', min: 0 }
  ];

  B.breakpoint = function (width) {
    var w = width || window.innerWidth;
    for (var i = 0; i < B.BREAKPOINTS.length; i++) {
      if (w >= B.BREAKPOINTS[i].min) return B.BREAKPOINTS[i].name;
    }
    return 'xxs';
  };

  B.defaultRails = function (bp) {
    if (bp === 'l' || bp === 'xl' || bp === 'xxl') return { leftRail: 'open' };
    if (bp === 'm') return { leftRail: 'collapsed' };
    return { leftRail: 'closed' };          // s and below: the map leads
  };

  function wireBreakpoints() {
    var last = B.breakpoint();
    document.getElementById('app').dataset.bp = last;

    var onResize = U.debounce(function () {
      var bp = B.breakpoint();
      if (bp === last) return;
      var wasSmall = last === 's' || last === 'xs' || last === 'xxs';
      var isSmall = bp === 's' || bp === 'xs' || bp === 'xxs';
      last = bp;
      document.getElementById('app').dataset.bp = bp;

      var patch = { bp: bp };
      // Crossing INTO drawer/sheet territory: at most one panel may cover the map,
      // and neither should do so uninvited (P3, P4).
      if (isSmall && !wasSmall) {
        patch.leftRail = 'closed';
        patch.rightRail = 'closed';
      } else if (!isSmall && wasSmall) {
        patch.leftRail = B.defaultRails(bp).leftRail;
      }
      GEO.state.set(patch, { source: 'system', action: 'viewport:' + bp,
                             summary: 'Viewport is now ' + bp });
    }, 150);

    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
  }

  /* ------------------------------------------------------------- keyboard */
  function wireKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && GEO.admin && GEO.admin.undo) {
          e.preventDefault(); GEO.admin.undo();
        }
        return;
      }
      var s = GEO.state.get();
      switch (e.key) {
        case 'Escape':
          if (s.overlay) GEO.state.set({ overlay: null }, { source: 'user', action: 'esc:overlay' });
          else if (s.rightRail === 'open') GEO.state.set({ rightRail: 'closed' }, { source: 'user', action: 'esc:rail' });
          break;
        case '/': e.preventDefault(); Q.$('#search').focus(); break;
        case 'f': GEO.state.set({ leftRail: 'open', leftTab: 'filters' }, { source: 'user', action: 'key:f' }); break;
        case 'l': GEO.state.set({ leftRail: 'open', leftTab: 'results' }, { source: 'user', action: 'key:l' }); break;
        case '1': case '2': case '3': case '4':
          GEO.state.set({ rightRail: 'open',
                          rightTab: ['property', 'analytics', 'ai', 'layers'][Number(e.key) - 1] },
                        { source: 'user', action: 'key:tab' });
          break;
        case 'c': if (s.compare.length >= 2) GEO.state.set({ overlay: 'compare' }, { source: 'user', action: 'key:c' }); break;
        case 'd': if (s.role !== 'external') GEO.state.set({ overlay: 'data' }, { source: 'user', action: 'key:d' }); break;
        case '?': B.openShortcuts(); break;
      }
    });
  }

  /* ------------------------------------------------------------ URL state */
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (!h || h === 'reset' || h === 'selftest') return null;
    try { return GEO.filters ? GEO.filters.fromHash(h) : null; }
    catch (e) { return null; }
  }

  var writeHash = U.debounce(function (state) {
    if (!GEO.filters || !GEO.filters.toHash) return;
    var h = GEO.filters.toHash(state.filters);
    var next = h ? '#' + h : '';
    if (location.hash !== next) history.replaceState(null, '', location.pathname + next);
  }, 250);

  /* ---------------------------------------------------------------- start */
  B.start = function () {
    if (handleEscapeHatch()) return;

    if (typeof w.GEO_SEED !== 'object' || !w.GEO_SEED) {
      fatal('The dataset did not load',
            'The seed data block is missing from this file. It was probably not assembled correctly — rebuild with `python3 build.py`.', []);
      return;
    }

    try {
      GEO.data.load(w.GEO_SEED, w.GEO_DISTRICTS);
    } catch (e) {
      fatal('The dataset could not be read', String(e && e.message || e),
            [{ label: 'Clear stored data and reload', primary: true, run: function () {
                 GEO.storage.clearAll(); location.replace(location.pathname);
               } }]);
      return;
    }

    if (GEO.selftest && GEO.selftest.isRequested()) {
      GEO.selftest.render(GEO.selftest.run());
      return;
    }

    if (!GEO.storage.available) notice(GEO.storage.reason, 'warn');
    if (GEO.data.rejected().length) {
      notice(GEO.data.rejected().length + ' records were refused at load because their type could not be established. ' +
             'They are excluded from every figure.', 'warn');
    }

    wireHeader();
    wireKeyboard();

    if (GEO.map && GEO.map.init) {
      try { GEO.map.init('map', {}); }
      catch (e) {
        GEO.log.error('map init failed', e);
        notice('The map could not start. Filters, analytics, comparison and export still work.', 'warn');
      }
    }

    // Panels self-register during their own load; render once here with the
    // fully-built state so every region draws from the same snapshot.
    GEO.state.subscribe(render);

    wireBreakpoints();

    var bp = B.breakpoint();
    var fromHash = readHash();
    GEO.state.set(Object.assign({
      bp: bp,
      demoMode: GEO.data.demoMode(),
      filters: fromHash || GEO.state.defaults().filters
    }, B.defaultRails(bp)),
      { source: 'boot', action: 'boot', summary: 'Application started' });

    GEO.state.subscribe(function (s) { writeHash(s); });
    GEO.on('data:changed', function () {
      if (GEO.search && GEO.search.buildIndex) GEO.search.buildIndex(GEO.data.observed().concat(GEO.data.demoRecords()));
      GEO.state.set({}, { source: 'system', action: 'data:changed', summary: 'Dataset changed' });
    });

    if (GEO.search && GEO.search.buildIndex) {
      GEO.search.buildIndex(GEO.data.observed().concat(GEO.data.demoRecords()));
    }

    GEO.log.info('booted', GEO.PRODUCT.name, GEO.PRODUCT.version,
                 GEO.data.observed().length + ' observed records');
  };

  /* Fallback implementations so the app is never broken by a module that has not
     been written yet; each is replaced by its real module when present. */
  B.openScopeMenu = B.openScopeMenu || function () {};
  B.openSettings = B.openSettings || function () {};
  B.openShortcuts = B.openShortcuts || function () {};

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', B.start);
  } else {
    B.start();
  }
}(window));
