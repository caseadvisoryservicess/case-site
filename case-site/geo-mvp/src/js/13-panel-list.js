/* ===========================================================================
 * 13-panel-list — the results list (§12, IA §5.2 L-21…L-25)
 *
 * The list is the accessibility spine of the product. IA §6.4 makes it a rule:
 * "everything reachable by clicking a marker is reachable from the results
 * list". So this is a real list — `role="list"`, roving tabindex, arrow keys,
 * Enter to select — and not a decorative echo of the map.
 *
 * Three decisions worth knowing before reading the code:
 *
 * A. A CARD PRINTS WHAT IS KNOWN AND NAMES WHAT IS NOT, ONCE.
 *    Five stacked "Not recorded" rows on 132 of 148 cards is noise that trains
 *    the reader to stop looking. So the value rows are omitted and one honest
 *    line lists the missing fields by name. Absence stays visible; it stops
 *    being wallpaper. A MEASURED zero (`vacancyPct: 0`) still renders as `0%`
 *    in a normal row, which is exactly how the two stay distinguishable (§36).
 *
 * B. UNKNOWNS SORT LAST IN BOTH DIRECTIONS, IN THEIR OWN BLOCK.
 *    Sorting by rent ascending must not put the 132 buildings with no recorded
 *    rent at the top as though they were free. They go below a labelled
 *    separator that says how many there are and why they are there.
 *
 * C. THE PANEL RE-DERIVES, IT NEVER CACHES RECORDS.
 *    The only things held between renders are a render signature (a string),
 *    a page cursor (a number) and DOM focus bookkeeping. "Show more" bumps the
 *    cursor and re-broadcasts state rather than redrawing from a stored array.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO, Q = GEO.dom, el = Q.el, U = GEO.util, S = GEO.schema,
      F = GEO.fmt, t = GEO.i18n.t;

  /* 148 cards render comfortably, but the panel must stay responsive if the
     dataset grows, so a page is drawn at a time behind an explicit control —
     never an infinite scroller, which hides the total from the reader. */
  var PAGE = 60;

  /* View bookkeeping only. None of this is application data: `sig` is a string,
     `shown` is a count, `focusWanted` is a DOM restoration hint. Records are
     never held here (decision C). */
  var sig = null;
  var lastSetKey = null;
  var shown = PAGE;
  var dataVersion = 0;
  var focusWanted = null;
  var wired = false;

  var CARD_FIELDS = ['askingRent', 'gla', 'vacancyPct', 'status'];
  var MISSING_FIELDS = ['address', 'askingRent', 'gla', 'vacancyPct', 'status'];

  /* ------------------------------------------------------------- sorting */

  function completenessOf(rec) {
    if (GEO.quality && GEO.quality.completeness) {
      try {
        var c = GEO.quality.completeness(rec);
        if (c && c.band) return c;
      } catch (e) { /* fall through to the schema's own rule */ }
    }
    var m = S.criticalFields.length, n = 0;
    S.criticalFields.forEach(function (k) { if (U.isKnown(rec[k])) n++; });
    return { band: n === 0 ? 'none' : (n <= 2 ? 'minimal' : (n <= 5 ? 'partial' : 'good')),
             n: n, m: m };
  }

  /* `value` returns null for "this record has no value for the sort key", which
     is what sends it to the unknown block — never a 0 and never a "" that would
     sort as though it were the smallest real value (decision B). */
  var SORTS = [
    { id: 'name.asc', labelKey: 'list.sort.name', dir: 'asc',
      value: function (r) { return U.isKnown(r.name) ? String(r.name).toLowerCase() : null; },
      missing: 'name' },
    { id: 'name.desc', labelKey: 'list.sort.nameDesc', dir: 'desc',
      value: function (r) { return U.isKnown(r.name) ? String(r.name).toLowerCase() : null; },
      missing: 'name' },
    { id: 'district.asc', labelKey: 'list.sort.district', dir: 'asc',
      value: function (r) {
        return U.isKnown(r.districtKey) ? GEO.data.districtName(r.districtKey).toLowerCase() : null;
      },
      missing: 'districtKey' },
    { id: 'rent.desc', labelKey: 'list.sort.rentDesc', dir: 'desc',
      value: function (r) { return U.isKnown(r.askingRent) ? r.askingRent : null; },
      missing: 'askingRent' },
    { id: 'rent.asc', labelKey: 'list.sort.rentAsc', dir: 'asc',
      value: function (r) { return U.isKnown(r.askingRent) ? r.askingRent : null; },
      missing: 'askingRent' },
    { id: 'gla.desc', labelKey: 'list.sort.glaDesc', dir: 'desc',
      value: function (r) { return U.isKnown(r.gla) ? r.gla : null; },
      missing: 'gla' },
    { id: 'gla.asc', labelKey: 'list.sort.glaAsc', dir: 'asc',
      value: function (r) { return U.isKnown(r.gla) ? r.gla : null; },
      missing: 'gla' },
    { id: 'completeness.desc', labelKey: 'list.sort.completeness', dir: 'desc',
      // Always known: a completeness of 0 critical fields is a measured count,
      // not a gap, so this sort never produces an unknown block.
      value: function (r) { return completenessOf(r).n; }, missing: null },
    { id: 'confidence.desc', labelKey: 'list.sort.confidence', dir: 'asc',
      value: function (r) {
        var c = GEO.data.recordConfidence(r);
        return c === 'Unknown' ? null : S.enums.confidence.indexOf(c);
      },
      missingLabelKey: 'field.confidence' },
    // "oldest first": the re-verification backlog is the useful end of this
    // sort, so ascending is what the label promises (§50).
    { id: 'verified.asc', labelKey: 'list.sort.verified', dir: 'asc',
      value: function (r) {
        return (r._meta && U.isKnown(r._meta.lastVerifiedAt)) ? r._meta.lastVerifiedAt : null;
      },
      missingLabelKey: 'field.lastVerifiedAt' },
    { id: 'distance.asc', labelKey: 'list.sort.distance', dir: 'asc',
      needsSelection: true,
      value: function (r, state) {
        var subject = GEO.data.get(state.selectedId);
        if (!subject || !U.isKnown(r.lat) || !U.isKnown(r.lng)) return null;
        return GEO.geo.distanceM(subject.lat, subject.lng, r.lat, r.lng);
      },
      missingLabelKey: 'field.coordinates' }
  ];

  function sortById(id) {
    return SORTS.filter(function (s) { return s.id === id; })[0] || SORTS[0];
  }

  function currentSort(state) {
    var s = sortById(state.listSort || SORTS[0].id);
    // A sort that needs a selection quietly becomes the default when there is
    // none, rather than producing a silently empty ordering.
    if (s.needsSelection && !state.selectedId) return SORTS[0];
    return s;
  }

  function byName(a, b) {
    var x = String(a.r.name || '').toLowerCase(), y = String(b.r.name || '').toLowerCase();
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  function partition(rows, sort, state) {
    var known = [], unknown = [];
    rows.forEach(function (r) {
      var v = sort.value(r, state);
      (U.isNil(v) ? unknown : known).push({ r: r, v: v });
    });
    known.sort(function (a, b) {
      if (a.v === b.v) return byName(a, b);
      return (a.v < b.v ? -1 : 1) * (sort.dir === 'desc' ? -1 : 1);
    });
    unknown.sort(byName);
    function pluck(x) { return x.r; }
    return { known: known.map(pluck), unknown: unknown.map(pluck) };
  }

  function unknownGroupLabel(sort, n) {
    var label = sort.missingLabelKey ? t(sort.missingLabelKey)
              : (sort.missing ? S.label(sort.missing) : t('common.unknown'));
    return t('list.group.noValue', { field: F.lower(label), n: F.int(n) });
  }

  /* -------------------------------------------------------------- writing */

  function select(id) {
    // Selecting always routes to the Property tab and opens the rail (P6).
    GEO.state.set({ selectedId: id, rightRail: 'open', rightTab: 'property' },
                  { source: 'user', action: 'list:select' });
  }

  var setHover = U.debounce(function (id) {
    if (GEO.state.get().hoverId === id) return;
    GEO.state.set({ hoverId: id }, { source: 'user', action: 'list:hover' });
  }, 80);

  function toggleCompare(rec) {
    var cur = GEO.state.get().compare.slice();
    var i = cur.indexOf(rec.id);
    if (i >= 0) {
      cur.splice(i, 1);
    } else if (cur.length >= 4) {
      // §29: the control acts. It refuses out loud and says what the limit is,
      // rather than being inert or silently dropping the fifth property.
      GEO.boot.toast(t('list.card.compare.limit'), {
        label: t('common.open'),
        run: function () {
          GEO.state.set({ overlay: 'compare' }, { source: 'user', action: 'overlay:compare' });
        }
      });
      return;
    } else {
      cur.push(rec.id);
    }
    GEO.state.set({ compare: cur }, { source: 'user', action: 'list:compare' });
  }

  /* The map is never touched directly. Writing the viewport into state is the
     documented route (build contract §5.3): the map panel renders from it, and
     the move is therefore visible in the session log like any other action. */
  function zoomTo(rec) {
    if (!U.isKnown(rec.lat) || !U.isKnown(rec.lng)) return;
    GEO.state.set({ map: { centre: [rec.lat, rec.lng], zoom: 16 } },
                  { source: 'user', action: 'list:zoomTo' });
  }

  /* ---------------------------------------------------------- the filters */

  function applyFilters(rows, f) {
    if (!GEO.filters || !GEO.filters.apply) return rows;
    try { return GEO.filters.apply(rows, f); }
    catch (e) { GEO.log.error('filters.apply threw', e); return rows; }
  }

  var FILTER_LABELS = {
    q: 'filter.name.label', districts: 'filter.district.label',
    classes: 'filter.class.label', includeUnknownClass: 'filter.class.label',
    statuses: 'filter.status.label',
    rentMin: 'field.askingRent', rentMax: 'field.askingRent',
    glaMin: 'field.gla', glaMax: 'field.gla',
    vacancyMin: 'field.vacancyPct', vacancyMax: 'field.vacancyPct',
    parkingMin: 'filter.parking.label', amenities: 'filter.amenities.label',
    confidence: 'filter.confidence.label', completeness: 'filter.completeness.label',
    freshness: 'filter.freshness.label', flags: 'filter.flags.label'
  };

  /**
   * E-02 needs a named escape, so the empty state has to know WHICH filter did
   * the damage. `GEO.filters.explain` is asked first; when it has no opinion the
   * same answer is derived by probing each active filter on its own and keeping
   * the one that survives fewest records.
   */
  function narrowest(scope, filters) {
    if (GEO.filters && GEO.filters.explain) {
      try {
        var ex = GEO.filters.explain(scope, filters);
        var n = ex && (ex.narrowest || ex.narrowestFilter);
        if (n && (n.key || n.label)) {
          return { key: n.key || null,
                   label: n.label || t(FILTER_LABELS[n.key] || 'filter.title') };
        }
        // `explain` reports, per group, how many records that group alone
        // removed from the set that passed every other filter. The largest of
        // those IS the narrowest filter, already computed — no need to re-probe.
        var by = ex && ex.excludedBy;
        if (by) {
          var best = null;
          Object.keys(by).forEach(function (k) {
            var e = by[k];
            if (!e || !e.excluded) return;
            if (!best || e.excluded > best.excluded) best = e;
          });
          if (best) {
            return { key: best.key, excluded: best.excluded,
                     label: labelForGroup(best.key, best.label) };
          }
        }
      } catch (e) { GEO.log.warn('filters.explain threw — probing locally', e); }
    }
    var d = GEO.state.defaults().filters;
    var best = null;
    Object.keys(d).forEach(function (k) {
      if (JSON.stringify(filters[k]) === JSON.stringify(d[k])) return;
      var only = Object.assign({}, d);
      only[k] = filters[k];
      // The unknown-class switch is meaningless on its own, so it is probed
      // together with the grades it qualifies.
      if (k === 'classes') only.includeUnknownClass = filters.includeUnknownClass;
      var n = applyFilters(scope, only).length;
      if (!best || n < best.n) {
        best = { key: k, n: n, label: t(FILTER_LABELS[k] || 'common.filter') };
      }
    });
    return best;
  }

  function clearFilter(key) {
    var d = GEO.state.defaults().filters;
    var p = {};
    p[key] = d[key];
    // Ranges are one control with two keys; clearing half of one is not an escape.
    var pairs = { rentMin: 'rentMax', rentMax: 'rentMin', glaMin: 'glaMax', glaMax: 'glaMin',
                  vacancyMin: 'vacancyMax', vacancyMax: 'vacancyMin' };
    if (pairs[key]) p[pairs[key]] = d[pairs[key]];
    if (key === 'classes') p.includeUnknownClass = d.includeUnknownClass;
    GEO.state.set({ filters: p }, { source: 'user', action: 'filter:clear:' + key });
  }

  /* ================================================================ cards */

  function classBadge(rec) {
    var known = U.isKnown(rec.officeClass);
    return el('span.badge.badge--class', {
      'data-class': known ? rec.officeClass : 'unknown',
      text: known ? rec.officeClass : t('value.class.unknown'),
      title: known ? S.label('officeClass') : t('value.class.unknown')
    });
  }

  function confidenceTag(rec) {
    var level = GEO.data.recordConfidence(rec);
    // Dot AND label, always. A bare dot is a defect (visual-system §4): Medium
    // and Low sit below the 3:1 mark floor on purpose and the words are the
    // mitigation.
    return el('span.conf', { 'data-conf': level }, [
      el('span.conf__dot', { 'aria-hidden': 'true' }),
      el('span.conf__label', {
        text: t('quality.confidence.dotLabel', { level: t('value.confidence.' + level.toLowerCase()) })
      })
    ]);
  }

  function flagBadges(rec) {
    var m = rec._meta || {}, out = [];
    if (m.districtConflict) {
      out.push(el('span.badge.badge--flag', {
        text: t('list.card.conflict'),
        title: t('detail.conflict.note', {
          label: m.districtSourceLabel || F.UNKNOWN,
          computed: GEO.data.districtName(rec.districtKey)
        })
      }));
    }
    if (m.possibleDuplicate) {
      out.push(el('span.badge.badge--flag', {
        text: t('list.card.duplicate'), title: t('list.card.duplicate.why')
      }));
    }
    if (m.addedLocally || m.editedLocally) {
      out.push(el('span.badge.badge--flag', {
        text: t(m.addedLocally ? 'list.card.added' : 'list.card.edited'),
        title: t('list.card.edited.why')
      }));
    }
    return out;
  }

  function valueOf(rec, key) {
    var v = rec[key];
    if (key === 'askingRent') return F.rent(v);
    if (key === 'gla') return F.area(v);
    if (key === 'vacancyPct') return F.pct(v, 0);      // a measured 0 prints "0%"
    return String(v);
  }

  function card(rec, state) {
    var selected = state.selectedId === rec.id;
    var inCompare = state.compare.indexOf(rec.id) >= 0;
    var comp = completenessOf(rec);

    var top = el('div.rcard__top', {}, [
      el('span.rcard__name', { text: rec.name || F.UNKNOWN }),
      classBadge(rec)
    ]);
    if (rec.recordType === 'DEMO') {
      // D4: a synthetic record is badged everywhere it appears, without exception.
      top.appendChild(el('span.badge.badge--demo', {
        text: t('common.demo.badge'), title: t('detail.demo.note')
      }));
    }

    var sub = [GEO.data.districtName(rec.districtKey)];
    if (U.isKnown(rec.address)) sub.push(rec.address);

    var kids = [top, el('div.rcard__sub', { text: sub.join(' \u00B7 ') })];

    var present = CARD_FIELDS.filter(function (k) { return U.isKnown(rec[k]); });
    if (present.length) {
      kids.push(el('div.rcard__grid', {}, present.map(function (k) {
        return el('div', {}, [
          el('div.rcard__k', { text: S.label(k) }),
          el('div.rcard__v', { text: valueOf(rec, k) })
        ]);
      })));
    }

    // Decision A: one line, naming the gaps, instead of a column of dashes.
    var missing = MISSING_FIELDS.filter(function (k) { return !U.isKnown(rec[k]); });
    if (missing.length) {
      kids.push(el('p.micro.unk', {
        // Lowercased through F.lower so the sentence reads as a sentence —
        // "No address, asking rent, GLA, vacancy, status recorded" — while the
        // acronyms that are genuinely acronyms survive intact.
        text: t('list.card.missing', {
          fields: missing.map(function (k) { return F.lower(S.label(k)); }).join(', ')
        })
      }));
    }

    kids.push(el('div.row.row--tight', {}, [confidenceTag(rec)].concat(flagBadges(rec))));

    var fill = el('span.covrow__fill');
    fill.style.width = (comp.m ? Math.round((comp.n / comp.m) * 100) : 0) + '%';
    kids.push(el('div.covrow__bar', {
      'aria-hidden': 'true', 'data-zero': comp.n === 0 ? 'true' : null
    }, [fill]));
    kids.push(el('div.coverage', {
      text: t('list.card.completeness', { n: F.int(comp.n), total: F.int(comp.m) })
    }));
    kids.push(el('div.coverage', {
      text: (rec._meta && U.isKnown(rec._meta.lastVerifiedAt))
        ? t('detail.quality.verified', { date: F.date(rec._meta.lastVerifiedAt) })
        : t('detail.quality.neverVerified')
    }));

    var atLimit = !inCompare && state.compare.length >= 4;
    var compareBtn = el('button.btn.btn--quiet.btn--sm', {
      type: 'button',
      'data-act': 'compare',
      'aria-pressed': String(inCompare),
      'aria-disabled': atLimit ? 'true' : null,
      title: atLimit ? t('list.card.compare.limit') : null,
      'aria-label': (inCompare ? t('list.card.compare.remove') : t('list.card.compare')) +
                    (atLimit ? ' \u2014 ' + t('list.card.compare.limit') : ''),
      text: inCompare ? t('detail.action.inCompare') : t('common.compare')
    });

    var canZoom = U.isKnown(rec.lat) && U.isKnown(rec.lng);
    var zoomBtn = el('button.btn.btn--icon.rcard__zoom', {
      type: 'button', 'data-act': 'zoom', text: '\u2295',
      disabled: !canZoom,
      'aria-label': t('list.card.zoom'),
      title: canZoom ? t('list.card.zoom') : t('field.coordinates') + ': ' + F.UNKNOWN
    });

    kids.push(el('div.rcard__foot', {}, [compareBtn, el('span.push'), zoomBtn]));

    // Every card starts outside the tab order; `syncStates` hands the single
    // stop to the selected card (or the first one) immediately afterwards.
    return el('li.rcard', {
      role: 'listitem',
      dataset: { id: rec.id },
      tabindex: '-1',
      'aria-current': selected ? 'true' : null
    }, kids);
  }

  /* ========================================================= empty states */

  function emptyState(state, scope) {
    var f = state.filters;
    var kids;

    // E-03: a selected district that genuinely holds no records is a RECORDED
    // ZERO, and must never be reported as though the data were missing.
    if ((f.districts || []).length === 1) {
      var key = f.districts[0];
      var inDistrict = scope.filter(function (r) { return r.districtKey === key; }).length;
      if (inDistrict === 0) {
        kids = [
          el('p.empty__title', { text: t('empty.district.title', { name: GEO.data.districtName(key) }) }),
          el('p.empty__body', { text: t('empty.district.body') }),
          el('div.empty__actions', {}, [
            el('button.btn.btn--ghost', {
              type: 'button', text: t('empty.district.action'),
              onclick: function () { clearFilter('districts'); }
            })
          ])
        ];
        return el('li', { role: 'presentation' }, [el('div.empty', {}, kids)]);
      }
    }

    var active = GEO.state.activeFilterCount(f);
    if (!active) {
      kids = [
        el('p.empty__title', { text: t('empty.list.title') }),
        el('p.empty__body', { text: t('empty.list.body') })
      ];
      return el('li', { role: 'presentation' }, [el('div.empty', {}, kids)]);
    }

    var worst = narrowest(scope, f);
    var actions = [];
    if (worst && worst.key) {
      actions.push(el('button.btn.btn--ghost', {
        type: 'button', text: t('empty.results.clear', { name: worst.label }),
        onclick: function () { clearFilter(worst.key); }
      }));
    }
    actions.push(el('button.btn.btn--quiet', {
      type: 'button', text: t('empty.results.resetAll'),
      onclick: function () { GEO.state.resetFilters({ source: 'user', action: 'filters:reset' }); }
    }));

    kids = [
      el('p.empty__title', { text: t('empty.results.title') }),
      el('p.empty__body', {
        text: t('empty.results.body', {
          name: worst ? worst.label : t('filter.active.title'), m: F.int(scope.length)
        })
      }),
      el('div.empty__actions', {}, actions)
    ];
    return el('li', { role: 'presentation' }, [el('div.empty', {}, kids)]);
  }

  /* ================================================================ chrome */

  function toolbar(state, rows, sort) {
    var selId = 'fx-list-sort';
    var sel = el('select.select', { id: selId, 'aria-label': t('list.sort.label') });
    SORTS.forEach(function (s) {
      var disabled = !!(s.needsSelection && !state.selectedId);
      sel.appendChild(el('option', {
        value: s.id, text: t(s.labelKey), disabled: disabled || null
      }));
    });
    sel.value = sort.id;
    sel.addEventListener('change', function () {
      GEO.state.set({ listSort: sel.value }, { source: 'user', action: 'list:sort' });
    });

    var kids = [
      el('label.vh', { for: selId, text: t('list.sort.label') }),
      sel,
      el('span.push'),
      el('span.coverage', {
        text: t('list.showing', { n: F.int(Math.min(shown, rows.length)), m: F.int(rows.length) })
      })
    ];
    // §29: the one option that cannot act right now says why, in text.
    if (!state.selectedId) {
      kids.push(el('span.reason', { text: t('list.sort.distance.disabled') }));
    }
    return el('li.list__bar', { role: 'presentation' }, kids);
  }

  /* ================================================================ render */

  /* Which records are on screen, and in what state the data behind them is.
     Selection, hover and compare deliberately do NOT appear here: they change
     constantly and are handled by the cheap `syncStates` pass instead. */
  function setKeyOf(state, rows) {
    return [dataVersion, state.demoMode ? 1 : 0, rows.length,
            rows.map(function (r) { return r.id; }).join(',')].join('|');
  }

  function rememberFocus(list) {
    var a = document.activeElement;
    if (!a || !list.contains(a)) { focusWanted = null; return; }
    var li = a.closest ? a.closest('.rcard') : null;
    focusWanted = li ? { id: li.dataset.id, act: a.getAttribute('data-act') || null } : null;
  }

  function restoreFocus(list) {
    var want = focusWanted;
    focusWanted = null;
    if (!want) return;
    var li = list.querySelector('.rcard[data-id="' + cssEscape(want.id) + '"]');
    if (!li) return;
    // The card that gets focus back also takes the list's single tab stop, or
    // the next Tab would jump to a card the user is not looking at.
    setRovingStop(list, li);
    var target = want.act ? li.querySelector('[data-act="' + want.act + '"]') : null;
    (target || li).focus();
  }

  /* The ids are generated (`BC-…`, `DEMO-…`, `LOCAL-…`) so this only has to
     survive them, not arbitrary user text — but quoting is still cheaper than
     trusting a scraped dataset. */
  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /**
   * Roving tabindex (IA §6.2). The whole list is ONE tab stop, so 148 cards do
   * not become 148 stops on the way to the map. The per-card Compare and Zoom
   * buttons are pulled out of the tab order too and put back only on the active
   * card — otherwise they would quietly reintroduce 296 of them.
   */
  function setRovingStop(list, li) {
    Q.$$('.rcard', list).forEach(function (c) {
      var on = c === li;
      c.tabIndex = on ? 0 : -1;
      Q.$$('[data-act]', c).forEach(function (b) { b.tabIndex = on ? 0 : -1; });
    });
  }

  /** Cheap pass: selection, hover and compare change often and do not need the
   *  148 cards rebuilding. */
  function syncStates(list, state) {
    var active = null;
    Q.$$('.rcard', list).forEach(function (li) {
      var id = li.dataset.id;
      var selected = state.selectedId === id;
      if (selected) li.setAttribute('aria-current', 'true');
      else li.removeAttribute('aria-current');
      if (selected && !active) active = li;

      var inCompare = state.compare.indexOf(id) >= 0;
      var btn = li.querySelector('[data-act="compare"]');
      if (btn) {
        var atLimit = !inCompare && state.compare.length >= 4;
        btn.setAttribute('aria-pressed', String(inCompare));
        btn.textContent = inCompare ? t('detail.action.inCompare') : t('common.compare');
        if (atLimit) { btn.setAttribute('aria-disabled', 'true'); btn.title = t('list.card.compare.limit'); }
        else { btn.removeAttribute('aria-disabled'); btn.removeAttribute('title'); }
        btn.setAttribute('aria-label',
          (inCompare ? t('list.card.compare.remove') : t('list.card.compare')) +
          (atLimit ? ' \u2014 ' + t('list.card.compare.limit') : ''));
      }
    });

    setRovingStop(list, active || Q.$$('.rcard', list)[0] || null);
  }

  function render(state, rows, scope) {
    var list = Q.$('#results-list');
    if (!list) return;
    list.setAttribute('role', 'list');

    var sort = currentSort(state);
    var setKey = setKeyOf(state, rows);

    // A new result set starts at page one; paging within one set does not, or
    // "Show more" would undo itself on the next render.
    if (lastSetKey !== null && lastSetKey !== setKey) shown = PAGE;
    lastSetKey = setKey;

    // The filters are part of the signature even though they are already baked
    // into `rows`: when `rows` is empty the EXPLANATION still varies with them
    // (E-02 names the narrowest filter, E-03 names the district), and two
    // different causes of "nothing here" must not show each other's escape.
    // `selectedId` appears only as a boolean, because the toolbar's distance
    // option flips between enabled and disabled-with-a-reason on the first
    // selection, and never again.
    var next = [sort.id, shown, state.selectedId ? 1 : 0,
                JSON.stringify(state.filters), setKey].join('|');
    if (next === sig && list.firstChild) { syncStates(list, state); return; }
    sig = next;

    rememberFocus(list);

    var parts = partition(rows, sort, state);
    var kids = [toolbar(state, rows, sort)];

    if (!rows.length) {
      kids.push(emptyState(state, scope));
      Q.fill(list, kids);
      return;
    }

    var budget = shown;
    parts.known.slice(0, budget).forEach(function (rec) { kids.push(card(rec, state)); });
    budget -= Math.min(budget, parts.known.length);

    // Decision B: the unknown block is always announced, even when the page cap
    // means none of its cards are drawn yet — its count is the honest part.
    if (parts.unknown.length) {
      kids.push(el('li.list__group', { role: 'presentation' }, [
        document.createTextNode(unknownGroupLabel(sort, parts.unknown.length)),
        el('span.vh', { text: t('list.group.noValue.note') })
      ]));
      parts.unknown.slice(0, budget).forEach(function (rec) { kids.push(card(rec, state)); });
    }

    var drawn = Math.min(shown, rows.length);
    if (drawn < rows.length) {
      kids.push(el('li', { role: 'presentation' }, [
        el('button.btn.btn--ghost.btn--block', {
          type: 'button',
          text: t('list.showMore', { n: F.int(Math.min(PAGE, rows.length - drawn)) }),
          onclick: function () {
            shown += PAGE;
            // Re-derive through the normal path instead of redrawing from a
            // stored array — nothing in this module holds the records.
            GEO.state.set({}, { source: 'user', action: 'list:showMore' });
          }
        }),
        el('span.coverage', { text: t('list.showing', { n: F.int(drawn), m: F.int(rows.length) }) })
      ]));
    }

    Q.fill(list, kids);
    syncStates(list, state);
    restoreFocus(list);
  }

  /* ============================================================== wiring */

  function wire() {
    var list = Q.$('#results-list');
    if (!list || wired) return;
    wired = true;

    list.addEventListener('click', function (e) {
      var act = e.target.closest ? e.target.closest('[data-act]') : null;
      var li = e.target.closest ? e.target.closest('.rcard') : null;
      if (!li) return;
      var rec = GEO.data.get(li.dataset.id);
      if (!rec) return;
      if (act && act.getAttribute('data-act') === 'compare') { toggleCompare(rec); return; }
      if (act && act.getAttribute('data-act') === 'zoom') { zoomTo(rec); return; }
      select(rec.id);
    });

    // Hover previews the marker without selecting (L-22). Debounced, because a
    // pointer crossing the list would otherwise broadcast a state change per
    // card and re-render every panel on the way past.
    list.addEventListener('mouseover', function (e) {
      var li = e.target.closest ? e.target.closest('.rcard') : null;
      setHover(li ? li.dataset.id : null);
    });
    list.addEventListener('mouseleave', function () { setHover(null); });
    list.addEventListener('focusin', function (e) {
      var li = e.target.closest ? e.target.closest('.rcard') : null;
      if (li) setHover(li.dataset.id);
    });

    list.addEventListener('keydown', function (e) {
      var li = e.target.closest ? e.target.closest('.rcard') : null;
      if (!li || e.target !== li) return;           // let the inner buttons be
      var cards = Q.$$('.rcard', list);
      var i = cards.indexOf(li);
      var to = null;
      if (e.key === 'ArrowDown') to = cards[Math.min(i + 1, cards.length - 1)];
      else if (e.key === 'ArrowUp') to = cards[Math.max(i - 1, 0)];
      else if (e.key === 'Home') to = cards[0];
      else if (e.key === 'End') to = cards[cards.length - 1];
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(li.dataset.id);
        return;
      }
      if (!to) return;
      e.preventDefault();
      setRovingStop(list, to);
      to.focus();
    });
  }

  /* A data edit changes a card's contents without changing the id set, so the
     render signature has to move with it or the list would show stale values. */
  GEO.on('data:changed', function () { dataVersion += 1; });
  GEO.on('i18n:locale', function () { dataVersion += 1; });

  /* 99-boot is the LAST module in the manifest, so `GEO.boot` does not exist
     while this file is being evaluated. `data:loaded` fires from inside boot's
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
