/* ===========================================================================
 * 17-panel-location — location analysis & competitive set (§16, §17)
 *
 * Renders INSIDE `#prop-location`, the empty mount that 14-panel-detail
 * publishes beneath the property detail. That mount is the entire DOM contract
 * between the two modules: 14 writes `state.radius` and draws nothing; this
 * module draws and never touches anything else in the Property tab.
 *
 * Three things this panel refuses to do.
 *
 *   1. PUBLISH A NUMBER WITHOUT ITS CONVENTION. Radius bands are cumulative
 *      and the subject is excluded from its own counts. Both conventions are
 *      defensible, both are in use in the market, and a reader cannot tell
 *      from a figure which one produced it — so `analysis.method` is printed
 *      verbatim, every time, next to the figures it governs.
 *
 *   2. PUBLISH A MEAN THAT IS NOT ONE. Every band's rent and GLA come from
 *      `GEO.analytics.metric`, which refuses below n = 3 and says why. On this
 *      dataset the 3 km GLA total correctly reports insufficient data: GLA is
 *      recorded for 0 of 148 observed properties. That refusal is the feature.
 *
 *   3. PRETEND THE SUGGESTED SET IS DEFINITIVE (§17). The heading is exactly
 *      "Suggested competitive set". Properties whose class is not recorded are
 *      neither silently included nor silently dropped — they are listed under
 *      their own heading with the reason, and the caveat is printed in full.
 *      Every qualified row shows the reasons it qualified, and the analyst can
 *      add or remove any of them by hand; manual entries are marked as such
 *      and the figures recompute from state.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, U = GEO.util, Q = GEO.dom, el = Q.el, F = GEO.fmt;
  var A = GEO.analytics, G = GEO.geo;
  var t = GEO.i18n.t;

  var MOUNT_ID = 'prop-location';

  var MIN_KM = 0.1;                 // below this a "band" holds the subject and nothing else
  var MAX_KM = 25;                  // Tashkent's extent; beyond it the band is the whole city
  var PROXIMITY_PAGE = 8;           // proximity-only rows drawn before "show all"

  /* ---------------------------------------------------------- string table */
  /* D14 — every user-visible string lives in the one table. The guard makes
     this block a no-op once the keys are folded into 01-i18n.js. */
  var ADDED = {
    'location.scope': 'Computed over the {n} properties your filters currently show, of {m} in the dataset.',
    'location.scope.all': 'Computed over all {n} properties in the dataset.',
    'location.method.title': 'How these figures were produced',
    'location.remove': 'Remove the radius rings',
    'location.focus': 'Use the {km} km band for the competitive set',
    'location.focused': 'This band drives the competitive set below.',
    'location.band.empty': 'No other property in the current selection is within {km} km.',
    'location.custom.label': 'Custom radius',
    'location.custom.hint': 'Between {min} and {max} km. The 1, 3 and 5 km bands are always kept.',
    'location.custom.apply': 'Add band',
    'location.custom.error': 'Enter a distance between {min} and {max} km.',
    'location.custom.remove': 'Remove the {km} km band',
    'location.competitive.proximity.note':
      'These properties are close enough, but their office class is not recorded, so they could not be qualified as peers. They are listed, never counted as peers. Add any of them by hand if you know the building.',
    'location.competitive.excluded.note':
      'Excluded by the rule above, listed so the rule can be checked rather than trusted.',
    'location.competitive.removedGroup': 'Removed by hand ({n})',
    'location.competitive.manualNote': 'Added by hand, not by the rule above.',
    'location.competitive.showAll': 'Show all {n}',
    'location.competitive.showFewer': 'Show fewer',
    'location.layer.name': 'Competitive set — {name}'
  };
  Object.keys(ADDED).forEach(function (k) {
    if (!GEO.i18n.en[k]) GEO.i18n.en[k] = ADDED[k];
  });

  /* Class values are UI vocabulary, not data (IA §9.3), so they carry keys. */
  var CLASS_KEYS = { 'A+': 'value.class.aPlus', 'A': 'value.class.a', 'B+': 'value.class.bPlus',
                     'B': 'value.class.b', 'C': 'value.class.c' };

  function classLabel(v) { return CLASS_KEYS[v] ? t(CLASS_KEYS[v]) : String(v); }

  /* --------------------------------------------------------- view state */
  /* View bookkeeping only — two booleans and a draft input string. The bands,
     the focused band and the manual edits to the competitive set all live in
     `state.radius`, because they change what the map draws and what the
     figures say, and §59 requires that to be one shared object. */
  var view = { proximityAll: false, excludedOpen: false, customDraft: '', customError: null };
  var dataVersion = 0;

  function mountNode() {
    return (GEO.panels && GEO.panels.detail && GEO.panels.detail.locationMount
      ? GEO.panels.detail.locationMount()
      : Q.$('#' + MOUNT_ID));
  }

  function nameOf(rec) { return U.isKnown(rec.name) ? rec.name : F.UNKNOWN; }

  /** "3", not "3.0"; "2.5" stays "2.5". A band label is a radius a person
   *  typed, and printing a decimal they did not type reads as false precision. */
  function kmText(km) { return F.num(km, km % 1 ? 1 : 0); }

  /* =====================================================================
   * 1. BANDS
   * =================================================================== */

  function bandsOf(radius) {
    var list = (radius && Array.isArray(radius.km) && radius.km.length)
      ? radius.km.slice() : (G.DEFAULT_BANDS_KM || [1, 3, 5]).slice();
    list = U.uniq(list.filter(function (n) { return typeof n === 'number' && !isNaN(n); }));
    list.sort(function (a, b) { return a - b; });
    return list.length ? list : (G.DEFAULT_BANDS_KM || [1, 3, 5]).slice();
  }

  /** Which band drives the competitive set. The default is 3 km — the radius
   *  §63's own worked example names — falling back to the widest band when a
   *  custom set does not contain it. */
  function focusOf(radius, bands) {
    var wanted = radius && typeof radius.focusKm === 'number' ? radius.focusKm : null;
    if (wanted !== null && bands.indexOf(wanted) >= 0) return wanted;
    if (bands.indexOf(G.COMPETITIVE_BAND_KM) >= 0) return G.COMPETITIVE_BAND_KM;
    return bands[bands.length - 1];
  }

  function patchRadius(state, extra, action, summary) {
    var next = Object.assign({}, state.radius, extra);
    GEO.state.set({ radius: next }, { source: 'user', action: action, summary: summary || null });
  }

  /* =====================================================================
   * 2. METRIC RENDERING
   * =================================================================== */

  /**
   * One metric, rendered whole: the figure, or the words "Insufficient
   * verified data" plus the sentence naming exactly what is missing — and the
   * coverage line under both, because the denominator IS the explanation
   * (§14, §36, A-07).
   */
  function metricValue(m) {
    if (!m.sufficient) {
      return el('div.insufficient', {}, [
        el('p.insufficient__title', { text: t('common.insufficient') }),
        el('p.insufficient__why', { text: m.reason }),
        el('p.coverage', { text: m.coverageText })
      ]);
    }
    var kids = [el('div.num', { text: m.display })];
    if (m.weighting) kids.push(el('div.micro', { text: t('common.unweighted') }));
    kids.push(el('div.coverage', { text: m.coverageText }));
    if (m.containsDemo) kids.push(el('div.micro', { text: t('a11y.demoActive') }));
    return el('div', {}, kids);
  }

  function kvRow(labelText, valueNode) {
    return el('div.kv__row', {}, [
      el('span.kv__k', { text: labelText }),
      el('span.kv__v.kv__v--num', {}, [valueNode]),
      el('span')
    ]);
  }

  /** The class mix, unknown bucket included and directly labelled with its
   *  count (visual-system §5: the "no data" bucket is shown, never dropped). */
  function classMix(rows) {
    // Fixed order A+, A, B+, B, C, Not recorded (visual-system §7): class is
    // ordinal, so the mix must read down the ladder even when a rung is empty.
    // `aggregate()` appends the empty classes after the populated ones, which
    // would print B before B+.
    var order = GEO.schema.enums.officeClass;
    var groups = A.byClass(rows).slice().sort(function (a, b) {
      if (a.unknown) return 1;
      if (b.unknown) return -1;
      return order.indexOf(a.key) - order.indexOf(b.key);
    });
    var kids = [];
    groups.forEach(function (g, i) {
      if (i) kids.push(el('span.sep', { text: ' · ' }));
      var text = (g.unknown ? t('value.class.unknown') : classLabel(g.key)) + ' ' + F.int(g.count);
      kids.push(el(g.unknown ? 'span.unk' : 'span', { text: text }));
    });
    return el('div.row.row--tight', {}, kids);
  }

  function bandBlock(band, focusKm) {
    var km = kmText(band.km);
    var title = GEO.i18n.plural('location.band.count', band.count, { km: km });
    var kids = [el('p.sectitle', { text: title })];

    if (band.km === focusKm) kids.push(el('p.micro', { text: t('location.focused') }));

    if (!band.count) {
      // A true zero, stated as one: nothing is missing here, there is simply
      // nothing within the ring (§36, IA §7).
      kids.push(el('p.empty__body', { text: t('location.band.empty', { km: km }) }));
      return el('div.prop__sec', {}, kids);
    }

    kids.push(el('div.kv', {}, [
      kvRow(t('location.rent', { km: km }), metricValue(band.rent)),
      kvRow(t('location.gla', { km: km }), metricValue(band.gla)),
      kvRow(t('location.classMix', { km: km }), classMix(band.rows))
    ]));
    return el('div.prop__sec', {}, kids);
  }

  /* =====================================================================
   * 3. BAND SELECTOR (P-10)
   * =================================================================== */

  function bandCards(state, analysis, bands, focusKm) {
    return el('div.loc__bands', {}, analysis.bands.map(function (band) {
      var km = kmText(band.km);
      var on = band.km === focusKm;
      return el('button.band', {
        type: 'button', 'aria-pressed': on ? 'true' : 'false',
        'aria-label': GEO.i18n.plural('location.band.count', band.count, { km: km }) +
                      '. ' + t('location.focus', { km: km }),
        onclick: function () {
          patchRadius(state, { focusKm: band.km }, 'location:band', km + ' km');
        }
      }, [
        // Block elements: the two lines stack into the card the mark spec
        // describes — the radius above, the count below.
        el('div.band__km', { text: t('location.radius.option', { km: km }) }),
        el('div.band__n', { text: F.int(band.count) })
      ]);
    }));
  }

  function customBand(state, bands) {
    var defaults = (G.DEFAULT_BANDS_KM || [1, 3, 5]);
    var custom = bands.filter(function (km) { return defaults.indexOf(km) < 0; })[0];
    var kids = [];

    var input = el('input.input.input--num', {
      type: 'text', inputmode: 'decimal', id: 'loc-custom', value: view.customDraft,
      'aria-describedby': 'loc-custom-hint' + (view.customError ? ' loc-custom-err' : ''),
      'aria-invalid': view.customError ? 'true' : null,
      oninput: function (e) { view.customDraft = e.target.value; }
    });

    kids.push(el('label.field__label', { for: 'loc-custom', text: t('location.custom.label') }));
    kids.push(el('div.row', {}, [
      input,
      el('button.btn.btn--quiet.btn--sm', {
        type: 'button', text: t('location.custom.apply'),
        onclick: function () { applyCustom(state, defaults); }
      })
    ]));
    kids.push(el('span.field__hint', { id: 'loc-custom-hint',
      text: t('location.custom.hint', { min: F.num(MIN_KM, 1), max: F.int(MAX_KM) }) }));
    if (view.customError) {
      kids.push(el('span.field__err', { id: 'loc-custom-err', role: 'alert', text: view.customError }));
    }
    if (custom !== undefined) {
      kids.push(el('button.btn.btn--quiet.btn--sm', {
        type: 'button',
        text: t('location.custom.remove', { km: kmText(custom) }),
        onclick: function () {
          patchRadius(state, { km: defaults.slice(), focusKm: G.COMPETITIVE_BAND_KM },
                      'location:bands', t('location.custom.remove', { km: kmText(custom) }));
        }
      }));
    }
    return el('div.field', {}, kids);
  }

  /** Strict parsing (M13): "3,5" is accepted as 3.5 because that is how the
   *  number is typed here, but "3 km" and "about 3" are rejected by name
   *  rather than silently coerced into something. */
  function applyCustom(state, defaults) {
    var raw = String(view.customDraft || '').trim().replace(',', '.');
    var km = /^[0-9]*\.?[0-9]+$/.test(raw) ? parseFloat(raw) : NaN;
    if (isNaN(km) || km < MIN_KM || km > MAX_KM) {
      view.customError = t('location.custom.error', { min: F.num(MIN_KM, 1), max: F.int(MAX_KM) });
      redraw();
      // The field is re-created by the redraw, so focus has to be put back on
      // it: the reader must be able to correct the value they just typed.
      var again = Q.$('#loc-custom');
      if (again) again.focus();
      return;
    }
    km = Math.round(km * 100) / 100;
    view.customError = null;
    view.customDraft = '';
    var bands = U.uniq(defaults.concat([km]));
    bands.sort(function (a, b) { return a - b; });
    patchRadius(state, { km: bands, focusKm: km }, 'location:bands', km + ' km');
  }

  /* =====================================================================
   * 4. COMPETITIVE SET (§17, P-11, P-12)
   * =================================================================== */

  function distanceText(metres) {
    return metres < 1000 ? t('location.distanceM', { m: F.int(Math.round(metres)) })
                         : t('location.distance', { km: F.num(metres / 1000, 1) });
  }

  function entryRow(entry, action) {
    var rec = entry.record;
    var kids = [];

    // Plain text, not a control: the row already carries one action, and the
    // print sheet hides `.btn` — a printed peer group must keep its names.
    kids.push(el('span.compset__name', { text: nameOf(rec) }));
    if (rec.recordType === 'DEMO') kids.push(el('span.badge.badge--demo', { text: t('common.demo.badge') }));
    if (entry.manual) kids.push(el('span.chip', {}, [el('span.chip__label', { text: t('location.competitive.manual') })]));
    if (U.isKnown(entry.distanceM)) kids.push(el('span.compset__dist', { text: distanceText(entry.distanceM) }));
    if (action) kids.push(action);

    var out = [el('div.compset__row', {}, kids)];
    // §17: the reasons are the point. A suggestion whose basis is hidden is
    // indistinguishable from an assertion.
    if (entry.reasons && entry.reasons.length) {
      out.push(el('p.micro', { text: entry.reasons.join(' · ') }));
    }
    if (entry.manual) out.push(el('p.micro', { text: t('location.competitive.manualNote') }));
    return el('div', {}, out);
  }

  function removeButton(state, rec) {
    return el('button.btn.btn--quiet.btn--sm', {
      type: 'button', 'aria-label': t('location.competitive.remove', { name: nameOf(rec) }),
      text: t('common.remove'),
      onclick: function () {
        var removed = (state.radius.remove || []).concat([rec.id]);
        var added = (state.radius.add || []).filter(function (id) { return id !== rec.id; });
        patchRadius(state, { remove: removed, add: added }, 'location:competitor:remove', nameOf(rec));
      }
    });
  }

  function addButton(state, rec, labelKey) {
    return el('button.btn.btn--quiet.btn--sm', {
      type: 'button', 'aria-label': t('location.competitive.add', { name: nameOf(rec) }),
      text: t(labelKey || 'common.add'),
      onclick: function () {
        var added = (state.radius.add || []).concat([rec.id]);
        var removed = (state.radius.remove || []).filter(function (id) { return id !== rec.id; });
        patchRadius(state, { add: U.uniq(added), remove: removed }, 'location:competitor:add', nameOf(rec));
      }
    });
  }

  function group(titleText, noteText, children) {
    var kids = [el('p.compset__title', { text: titleText })];
    if (noteText) kids.push(el('p.micro', { text: noteText }));
    return el('div.compset__group', {}, kids.concat(children));
  }

  function saveLayerButton(state, analysis, set, focusKm) {
    var ids = set.qualified.map(function (q) { return q.record.id; });
    if (!ids.length) {
      var reasonId = 'loc-layer-reason';
      return el('span', {}, [
        el('button.btn.btn--quiet.btn--sm', {
          type: 'button', disabled: true, 'aria-describedby': reasonId,
          text: t('location.competitive.save')
        }),
        el('span.reason', { id: reasonId, text: t('location.competitive.save.disabled') })
      ]);
    }
    return el('button.btn.btn--quiet.btn--sm', {
      type: 'button', text: t('location.competitive.save'),
      onclick: function () {
        var subject = analysis.subject;
        var name = t('location.layer.name', { name: nameOf(subject) });
        var layer = {
          id: 'layer-' + Date.now().toString(36),
          name: name,
          criteriaHuman: ruleSentence(subject, focusKm),
          criteriaMachine: {
            kind: 'competitiveSet', subjectId: subject.id, bandKm: focusKm,
            classBand: G.CLASS_BAND,
            manualAdd: (state.radius.add || []).slice(),
            manualRemove: (state.radius.remove || []).slice()
          },
          recordIds: ids, count: ids.length,
          style: null, visible: true, source: 'manual',
          createdAt: new Date().toISOString()
        };
        GEO.state.set({ aiLayers: state.aiLayers.concat([layer]) },
                      { source: 'user', action: 'layer:create', summary: name });
        GEO.boot.toast(t('toast.layerCreated', { name: name }));
      }
    });
  }

  function ruleSentence(subject, km) {
    return U.isKnown(subject.officeClass)
      ? t('location.competitive.rule', { km: kmText(km), class: classLabel(subject.officeClass) })
      : t('location.competitive.noClass');
  }

  function competitiveBlock(state, analysis, focusKm) {
    var set = analysis.competitiveSet;
    var subject = analysis.subject;
    var kids = [];

    // §17 requires this exact heading. It is a suggestion, and it says so.
    kids.push(el('p.sectitle', { text: t('location.competitive.title') }));
    kids.push(el('p.micro', { text: ruleSentence(subject, focusKm) }));
    // The caveat is printed in full, never summarised: each clause of it names
    // a specific limit of this particular list.
    kids.push(el('p.coverage', { text: set.caveat }));

    /* ---- qualified ---- */
    if (set.qualified.length) {
      kids.push(group(t('location.competitive.qualified', { n: F.int(set.qualified.length) }), null,
        set.qualified.map(function (q) { return entryRow(q, removeButton(state, q.record)); })));
    } else {
      kids.push(group(t('location.competitive.qualified', { n: F.int(0) }), null,
        [el('p.empty__body', { text: t('location.competitive.empty') })]));
    }

    /* ---- proximity only: class not recorded ---- */
    if (set.proximityOnly.length) {
      var shown = view.proximityAll ? set.proximityOnly : set.proximityOnly.slice(0, PROXIMITY_PAGE);
      var rows = shown.map(function (p) { return entryRow(p, addButton(state, p.record)); });
      if (set.proximityOnly.length > PROXIMITY_PAGE) {
        rows.push(el('button.btn.btn--ghost.btn--sm.btn--block', {
          type: 'button',
          text: view.proximityAll ? t('location.competitive.showFewer')
                                  : t('location.competitive.showAll', { n: F.int(set.proximityOnly.length) }),
          onclick: function () { view.proximityAll = !view.proximityAll; redraw(); }
        }));
      }
      kids.push(group(t('location.competitive.proximity', { n: F.int(set.proximityOnly.length) }),
                      t('location.competitive.proximity.note'), rows));
    }

    /* ---- removed by hand ---- */
    var removedIds = (state.radius.remove || []);
    if (removedIds.length) {
      var removedRows = [];
      removedIds.forEach(function (id) {
        var rec = GEO.data.get(id);
        if (!rec) return;
        removedRows.push(entryRow(
          { record: rec, distanceM: G.between(subject, rec), reasons: [] },
          addButton(state, rec, 'location.competitive.addBack')));
      });
      if (removedRows.length) {
        kids.push(group(t('location.competitive.removedGroup', { n: F.int(removedRows.length) }), null, removedRows));
      }
    }

    /* ---- excluded by the rule ---- */
    if (set.excluded.length) {
      var body = el('div.disc__body#loc-excluded', {},
        [el('p.micro', { text: t('location.competitive.excluded.note') })].concat(
          set.excluded.map(function (x) { return entryRow(x, addButton(state, x.record)); })));
      kids.push(el('div.disc', { 'data-open': view.excludedOpen ? 'true' : 'false' }, [
        el('button.disc__hd', {
          type: 'button', 'aria-expanded': view.excludedOpen ? 'true' : 'false',
          'aria-controls': 'loc-excluded',
          text: t('location.competitive.excluded', { n: F.int(set.excluded.length) }),
          onclick: function () { view.excludedOpen = !view.excludedOpen; redraw(); }
        }),
        el('div.disc__wrap', {}, [body])
      ]));
    }

    kids.push(el('div.row', {}, [saveLayerButton(state, analysis, set, focusKm)]));
    return el('div.compset', {}, kids);
  }

  /* =====================================================================
   * 5. DRAW
   * =================================================================== */

  function draw(mount, state, rows, scope, subject) {
    var bands = bandsOf(state.radius);
    var focusKm = focusOf(state.radius, bands);

    var analysis = G.locationAnalysis(subject, rows, {
      bandsKm: bands,
      competitiveBandKm: focusKm,
      manualAdd: (state.radius.add || []).slice(),
      manualRemove: (state.radius.remove || []).slice()
    });

    var kids = [];

    kids.push(el('div.row', {}, [
      el('h3.sectitle#loc-title', { text: t('location.title') }),
      el('button.btn.btn--quiet.btn--sm.push', {
        type: 'button', text: t('location.remove'),
        onclick: function () {
          GEO.state.set({ radius: null },
                        { source: 'user', action: 'location:clear', summary: nameOf(subject) });
        }
      })
    ]));

    // The denominator for every figure below: which set was measured.
    kids.push(el('p.coverage', {
      text: rows.length === scope.length
        ? t('location.scope.all', { n: F.int(rows.length) })
        : t('location.scope', { n: F.int(rows.length), m: F.int(scope.length) })
    }));
    if (GEO.data.containsDemo(analysis.widest.rows)) {
      kids.push(el('p.micro', {
        text: t('analytics.demo', {
          n: F.int(analysis.widest.rows.filter(function (r) { return r.recordType === 'DEMO'; }).length)
        })
      }));
    }

    kids.push(bandCards(state, analysis, bands, focusKm));
    kids.push(customBand(state, bands));

    analysis.bands.forEach(function (band) { kids.push(bandBlock(band, focusKm)); });

    // Verbatim from the engine that produced the numbers — cumulative bands,
    // subject excluded, haversine radius. Paraphrasing it here would let the
    // statement and the arithmetic drift apart.
    kids.push(el('div.prop__sec', {}, [
      el('p.sectitle', { text: t('location.method.title') }),
      el('p.loc__method', { text: analysis.method })
    ]));

    kids.push(el('div.prop__sec', {}, [competitiveBlock(state, analysis, focusKm)]));

    Q.fill(mount, [el('section.stack', { 'aria-labelledby': 'loc-title' }, kids)]);
  }

  /* =====================================================================
   * 6. RENDER
   * =================================================================== */

  function signature(state, rows, scope) {
    var radius = state.radius;
    return [state.selectedId || '', radius.id, bandsOf(radius).join(','),
            String(focusOf(radius, bandsOf(radius))),
            (radius.add || []).join('|'), (radius.remove || []).join('|'),
            String(rows.length), String(scope.length), state.demoMode ? '1' : '0',
            GEO.i18n.locale, String(dataVersion),
            view.proximityAll ? '1' : '0', view.excludedOpen ? '1' : '0',
            view.customError || ''].join(';');
  }

  function render(state, rows, scope) {
    var mount = mountNode();
    if (!mount) return;

    // While the Property tab is hidden there is nothing to keep in step, and
    // the mount belongs to a record that may no longer be on screen.
    if (state.rightRail !== 'open' || state.rightTab !== 'property') return;

    // §16 is an analysis OF the selected property. A radius left over from a
    // different record is not shown against this one; 14's "Analyze location"
    // button is right above, which is the way back.
    var radius = state.radius;
    if (!radius || !state.selectedId || radius.id !== state.selectedId) {
      if (mount.firstChild) { Q.clear(mount); delete mount.dataset.sig; }
      return;
    }

    var subject = GEO.data.get(radius.id);
    if (!subject) return;

    // The signature lives on the mount, not in this module: 14 re-creates the
    // mount empty whenever it redraws the property, and an attribute that
    // disappears with the node is exactly the cache invalidation we want.
    var s = signature(state, rows, scope);
    if (mount.dataset.sig === s) return;
    draw(mount, state, rows, scope, subject);
    mount.dataset.sig = s;
  }

  /** A view-only change (a disclosure, "show all", a rejected custom radius)
   *  redraws this block and nothing else — it is not an application event and
   *  does not belong in the §61 session log. */
  function redraw() {
    var mount = mountNode();
    if (mount) delete mount.dataset.sig;
    var state = GEO.state.get();
    render(state, GEO.boot.visible(state), GEO.boot.scope(state));
  }

  /* A dataset edit changes the figures without changing the id set, so the
     signature has to move with it or the analysis would be stale. */
  GEO.on('data:changed', function () { dataVersion += 1; });
  GEO.on('i18n:locale', function () { dataVersion += 1; });

  /* 99-boot is the LAST module in the manifest, so `GEO.boot` does not exist
     while this file is evaluated. This is deliberately the SAME seam that
     14-panel-detail uses, and for a reason beyond symmetry: boot renders
     panels in registration order, 14 owns the mount this module draws into,
     and a listener added here — while 17 loads, after 14 added its own —
     always fires second. Register through a different seam and this panel can
     draw into a node 14 is about to replace. */
  var registered = false;
  function registerPanel() {
    if (registered || !GEO.boot || !GEO.boot.registerPanel) return false;
    registered = true;
    GEO.boot.registerPanel(render);
    return true;
  }

  if (!registerPanel()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        if (!registerPanel()) {
          GEO.log.error('17-panel-location: GEO.boot.registerPanel is unavailable — location analysis will not render');
        }
      });
    } else {
      setTimeout(function () {
        if (!registerPanel()) {
          GEO.log.error('17-panel-location: GEO.boot.registerPanel is unavailable — location analysis will not render');
        }
      }, 0);
    }
  }
}(window));
