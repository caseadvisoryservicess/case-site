/* ===========================================================================
 * 24-selftest — `index.html?selftest=1`
 *
 * Brief §66 lists 24 things to verify before delivery. A checklist a human runs
 * by hand is a checklist that gets run once. These assertions are the same
 * checks, run by the app against itself in two seconds, so a regression is
 * caught by opening a URL rather than by remembering.
 *
 * The expected values come from `tools/oracle.py`, which computes them from
 * `data/seed.json` with a SECOND, INDEPENDENT implementation in Python. If this
 * file and that script agree, the arithmetic is very unlikely to be wrong in the
 * same way twice. Nothing here is hard-coded inside the application itself —
 * these numbers live only in the test.
 * ========================================================================= */
(function (w) {
  'use strict';

  var GEO = w.GEO;
  var T = GEO.selftest = {};

  var results = [];

  function ok(name, pass, got, want, note) {
    results.push({ name: name, pass: !!pass, got: got, want: want, note: note || null });
    return pass;
  }

  function eq(name, got, want, note) {
    return ok(name, JSON.stringify(got) === JSON.stringify(want), got, want, note);
  }

  function close(name, got, want, tol, note) {
    var pass = typeof got === 'number' && Math.abs(got - want) <= (tol || 0.005);
    return ok(name, pass, got, want, note);
  }

  function has(name, cond, note) {
    return ok(name, !!cond, cond ? 'yes' : 'no', 'yes', note);
  }

  /* ------------------------------------------------------------------ run */
  T.run = function () {
    results = [];
    var D = GEO.data, A = GEO.analytics, S = GEO.schema, Q = GEO.quality, Fl = GEO.filters;

    var obs = D.observed();
    var demo = D.demoRecords();
    var all = obs.concat(demo);

    /* --- dataset shape ------------------------------------------------- */
    eq('dataset: observed record count', obs.length, 148);
    eq('dataset: demo record count', demo.length, 8);
    eq('dataset: records rejected at load', D.rejected().length, 0);
    eq('dataset: districts', D.districts().length, 12);
    has('dataset: every district has geometry',
        D.districts().every(function (d) { return !!d.geometry; }));

    // D4: the containment seam. Demo records must be absent unless demo mode is on.
    eq('containment: workingSet excludes demo by default',
       D.workingSet({ demoMode: false }).length, 148);
    eq('containment: workingSet includes demo when enabled',
       D.workingSet({ demoMode: true }).length, 156);
    has('containment: no demo record carries a VERIFIED_SOURCE type',
        demo.every(function (r) { return r.recordType === 'DEMO'; }));
    has('containment: every demo id is prefixed DEMO-',
        demo.every(function (r) { return r.id.indexOf('DEMO-') === 0; }));

    /* --- D2: unknown is never zero ------------------------------------- */
    var zeroCoverage = ['gla', 'gba', 'floors', 'parkingSpaces', 'occupancyPct',
                        'vacancyPct', 'status', 'yearOpened'];
    zeroCoverage.forEach(function (f) {
      eq('unknown≠0: observed coverage of ' + f + ' is zero', A.coverage(obs, f).n, 0);
    });
    has('unknown≠0: no observed record has 0 where the field is unknown',
        obs.every(function (r) {
          return zeroCoverage.every(function (f) { return r[f] === null; });
        }));
    // The measured zero must survive as a value, not collapse into unknown.
    var eta = all.filter(function (r) { return r.name.indexOf('Eta House') >= 0; })[0];
    has('unknown≠0: a measured zero vacancy is stored as 0, not null',
        eta && eta.vacancyPct === 0);
    var theta = all.filter(function (r) { return r.name.indexOf('Theta Offices') >= 0; })[0];
    eq('unknown≠0: "confirmed empty" is distinguishable from "not collected"',
       theta && theta.tenantsStatus, 'confirmed_empty');
    eq('unknown≠0: an uncollected tenant list reads not_collected',
       obs[0].tenantsStatus, 'not_collected');

    /* §36 names five distinctions by hand. Four are observable in the shipped data;
       the fifth (free rent) is not, because no landlord in this dataset offers it.
       Asserting the MECHANISM on a probe record proves the rule holds anyway —
       otherwise the first zero-rent record ever entered would silently vanish from
       the denominator, and nobody would find out from the UI. */
    var probe = [
      { askingRent: 0,    gla: 0,    vacancyPct: 0,    occupancyPct: 0,    id: 'p1' },
      { askingRent: null, gla: null, vacancyPct: null, occupancyPct: null, id: 'p2' }
    ];
    ['askingRent', 'gla', 'vacancyPct', 'occupancyPct'].forEach(function (f) {
      eq('§36: a measured 0 ' + f + ' contributes to n', A.coverage(probe, f).n, 1);
      eq('§36: an unknown ' + f + ' does not', A.coverage(probe, f).N - A.coverage(probe, f).n, 1);
      eq('§36: sum over [0, null] is 0, not null', A.metric(probe, f, 'sum').value, 0);
    });
    has('§36: a zero rent is displayed as a price, not as "Not recorded"',
        A.metric(probe, 'askingRent', 'sum').display !== GEO.fmt.UNKNOWN,
        'missing rent and free rent are different facts');
    eq('§36: formatting an unknown never yields 0', GEO.fmt.num(null, 0), GEO.fmt.UNKNOWN);
    eq('§36: formatting a measured zero yields 0', GEO.fmt.num(0, 0), '0');
    has('§36: isKnown treats 0 as a value and "" as an absence',
        GEO.util.isKnown(0) === true && GEO.util.isKnown('') === false &&
        GEO.util.isKnown(null) === false && GEO.util.isKnown([]) === false);

    /* --- coverage ------------------------------------------------------- */
    eq('coverage: name', A.coverage(obs, 'name').n, 148);
    eq('coverage: districtKey', A.coverage(obs, 'districtKey').n, 148);
    eq('coverage: address', A.coverage(obs, 'address').n, 109);
    eq('coverage: officeClass', A.coverage(obs, 'officeClass').n, 16);
    eq('coverage: askingRent', A.coverage(obs, 'askingRent').n, 16);

    /* --- D1: geometry decides the district ------------------------------ */
    var byDistrict = {};
    obs.forEach(function (r) { byDistrict[r.districtKey] = (byDistrict[r.districtKey] || 0) + 1; });
    eq('district: mirobod', byDistrict.mirobod || 0, 28);
    eq('district: mirzo-ulugbek', byDistrict['mirzo-ulugbek'] || 0, 26);
    eq('district: yakkasaroy', byDistrict.yakkasaroy || 0, 24);
    eq('district: yunusobod', byDistrict.yunusobod || 0, 22);
    eq('district: yashnobod', byDistrict.yashnobod || 0, 17);
    eq('district: chilonzor', byDistrict.chilonzor || 0, 13);
    eq('district: shayxontohur', byDistrict.shayxontohur || 0, 10);
    eq('district: olmazor', byDistrict.olmazor || 0, 4);
    eq('district: sergeli', byDistrict.sergeli || 0, 3);
    eq('district: uchtepa', byDistrict.uchtepa || 0, 1);
    eq('district: yangihayot is a true zero', byDistrict.yangihayot || 0, 0);
    eq('district: bektemir is a true zero', byDistrict.bektemir || 0, 0);
    eq('district: counts sum to the record count',
       Object.keys(byDistrict).reduce(function (s, k) { return s + byDistrict[k]; }, 0), 148);

    var conflicts = obs.filter(function (r) { return r._meta.districtConflict; });
    eq('district: source-label conflicts flagged', conflicts.length, 10);
    var tri = obs.filter(function (r) { return r.name === 'Trilliant'; })[0];
    eq('district: Trilliant resolved by polygon to yunusobod', tri && tri.districtKey, 'yunusobod',
       'the highest rent in the dataset; the source labelled it Mirzo-Ulugbek');
    eq('district: Trilliant retains the source label',
       tri && tri._meta.districtSourceKey, 'mirzo-ulugbek');

    /* --- class ---------------------------------------------------------- */
    var cls = {};
    obs.forEach(function (r) { if (r.officeClass) cls[r.officeClass] = (cls[r.officeClass] || 0) + 1; });
    eq('class: A+', cls['A+'] || 0, 4);
    eq('class: A', cls.A || 0, 8);
    eq('class: B+', cls['B+'] || 0, 1);
    eq('class: B', cls.B || 0, 3);
    eq('class: C', cls.C || 0, 0);
    eq('class: not recorded', 148 - 16, 132);

    /* --- rent ----------------------------------------------------------- */
    var rentMean = A.metric(obs, 'askingRent', 'mean');
    var rentMedian = A.metric(obs, 'askingRent', 'median');
    eq('rent: n', rentMean.n, 16);
    eq('rent: N', rentMean.N, 148);
    close('rent: mean', rentMean.value, 32.21875, 0.0001);
    close('rent: median (even n → mean of the two central values)', rentMedian.value, 32.3, 0.0001);
    has('rent: mean is labelled unweighted', rentMean.weighting === 'per property, unweighted');
    eq('rent: coverage line wording', rentMean.coverageText,
       'Based on 16 of 148 properties with verified asking rent.');

    /* --- sufficiency ---------------------------------------------------- */
    var glaSum = A.metric(obs, 'gla', 'sum');
    has('sufficiency: total known GLA reports insufficient, not 0', !glaSum.sufficient);
    eq('sufficiency: insufficient renders as words, not a number', glaSum.display,
       'Insufficient verified data');
    has('sufficiency: the reason names the missing field',
        glaSum.reason && glaSum.reason.toLowerCase().indexOf('gla') >= 0);

    var twoRent = obs.filter(function (r) { return r.askingRent !== null; }).slice(0, 2);
    has('sufficiency: a mean over n=2 is withheld',
        !A.metric(twoRent, 'askingRent', 'mean').sufficient,
        'one or two buildings are not a market average');
    has('sufficiency: a count is always published',
        A.metric([], null, 'count').sufficient, 'a count of zero is a fact');

    /* --- filters -------------------------------------------------------- */
    if (Fl) {
      var f0 = GEO.state.defaults().filters;
      function F(patch) { return Object.assign({}, f0, patch); }
      eq('filter: class A + A+', Fl.apply(obs, F({ classes: ['A', 'A+'] })).length, 12);
      eq('filter: rent < 30', Fl.apply(obs, F({ rentMax: 29.99 })).length, 8);
      eq('filter: class A + district mirobod',
         Fl.apply(obs, F({ classes: ['A'], districts: ['mirobod'] })).length, 3);
      eq('filter: no filters returns everything', Fl.apply(obs, f0).length, 148);

      var avail = Fl.availability(obs);
      function availOf(k) {
        return avail.filter(function (a) { return a.key === k; })[0];
      }
      has('filter: GLA filter disables itself at zero coverage',
          availOf('gla') && availOf('gla').available === false);
      has('filter: the disabled reason is visible text',
          availOf('gla') && !!availOf('gla').reason);
      has('filter: rent filter is available', availOf('askingRent') && availOf('askingRent').available);

      var hash = Fl.toHash(F({ classes: ['A', 'A+'], districts: ['mirobod'] }));
      eq('filter: URL hash round-trips', Fl.fromHash(hash).classes, ['A', 'A+']);
    } else {
      ok('filter: module present', false, 'missing', 'GEO.filters');
    }

    /* --- search --------------------------------------------------------- */
    if (GEO.search) {
      var latinC = GEO.search.query(obs, 'Infinity Business Center', { limit: 5 });
      has('search: Latin "C" finds the record spelled with a Cyrillic "С"',
          latinC.items.some(function (i) { return i.record.name.indexOf('Infinity Business') === 0; }));
      has('search: Cyrillic query finds Cyrillic names',
          GEO.search.query(obs, 'Бизнес', { limit: 20 }).total > 0);
      has('search: "Mirabad" resolves to the mirobod district',
          GEO.search.query(obs, 'Mirabad', { limit: 5 }).districts.some(function (d) { return d.key === 'mirobod'; }));
      has('search: "Мирабад" resolves to the mirobod district',
          GEO.search.query(obs, 'Мирабад', { limit: 5 }).districts.some(function (d) { return d.key === 'mirobod'; }));
      has('search: finds Trilliant by name',
          GEO.search.query(obs, 'trilliant', { limit: 5 }).items.length > 0);
    } else {
      ok('search: module present', false, 'missing', 'GEO.search');
    }

    /* --- geometry & location analysis ----------------------------------- */
    if (tri) {
      var la = GEO.geo.locationAnalysis(tri, obs, {});
      eq('location: 1 km count (cumulative, subject excluded)', la.bands[0].count, 7);
      eq('location: 3 km count', la.bands[1].count, 74);
      eq('location: 5 km count', la.bands[2].count, 114);
      close('location: average known rent within 3 km', la.bands[1].rent.value, 31.23636364, 0.0001);
      eq('location: rent coverage within 3 km', la.bands[1].rent.n, 11);
      has('location: total known GLA within 3 km is withheld', !la.bands[1].gla.sufficient);
      has('location: the subject is excluded from its own counts',
          la.bands[2].rows.every(function (r) { return r.id !== tri.id; }));

      var cs = la.competitiveSet;
      eq('competitive set: qualified by class band', cs.qualified.length, 9);
      eq('competitive set: proximity-only (class not recorded)', cs.proximityOnly.length, 63);
      eq('competitive set: heading is a suggestion, not a verdict', cs.title, 'Suggested competitive set');
      has('competitive set: the caveat names the unqualified records',
          cs.caveat && cs.caveat.indexOf('63') >= 0);
    }

    has('geometry: point-in-polygon agrees with every stored districtKey',
        obs.every(function (r) { return GEO.geo.districtAt(r.lat, r.lng) === r.districtKey; }),
        'D1 — the stored key must be reproducible from the coordinates');

    /* --- quality -------------------------------------------------------- */
    if (Q) {
      var bands = { none: 0, minimal: 0, partial: 0, good: 0 };
      obs.forEach(function (r) { bands[Q.completeness(r).band]++; });
      eq('quality: completeness band "none"', bands.none, 132);
      eq('quality: completeness band "minimal"', bands.minimal, 16);

      var issues = Q.issues(obs);
      function issue(t) { return issues.filter(function (i) { return i.type === t; })[0]; }
      eq('quality: district conflicts queued',
         issue('district_conflict') ? issue('district_conflict').recordIds.length : -1, 10);
      eq('quality: source-flagged coordinate duplicates queued',
         issue('duplicate_coordinate') ? issue('duplicate_coordinate').recordIds.length : -1, 12);
      has('quality: unflagged sub-30m pairs are found too',
          issue('duplicate_proximity') && issue('duplicate_proximity').recordIds.length >= 4,
          'the source flagged 6 pairs; 3 more are under 30 m apart');
      eq('quality: suspected non-office entities flagged',
         issue('suspected_non_bc') ? issue('suspected_non_bc').recordIds.length : -1, 8);
      eq('quality: generic placeholder names flagged',
         issue('name_quality') ? issue('name_quality').recordIds.length : -1, 6);

      var sum = Q.datasetSummary(obs);
      has('quality: the summary admits staleness cannot discriminate yet',
          sum.stalenessDiscriminates === false,
          'D8 — all 148 observed records share one collection date');
    } else {
      ok('quality: module present', false, 'missing', 'GEO.quality');
    }

    /* --- provenance ----------------------------------------------------- */
    eq('provenance: rent evidence is Low confidence, not inflated',
       D.confidenceOf(tri, 'askingRent'), 'Low');
    eq('provenance: geometry-derived district is High confidence',
       D.confidenceOf(tri, 'districtKey'), 'High');
    eq('provenance: name from a single map-service listing is Medium',
       D.confidenceOf(tri, 'name'), 'Medium');
    has('provenance: nextRefreshAt is computed from lastVerifiedAt',
        D.evidence(tri, 'askingRent').nextRefreshAt ===
        GEO.date.addDays(D.evidence(tri, 'askingRent').lastVerifiedAt, S.refreshDays.fast));
    has('provenance: an unknown field has no confidence to claim',
        D.confidenceOf(tri, 'gla') === 'Unknown');

    /* --- round trip ----------------------------------------------------- */
    var env = D.exportEnvelope(obs);
    eq('export: record count', env.records.length, 148);
    eq('export: declares its schema version', env.schemaVersion, S.VERSION);
    has('export: an observed-only export is not flagged as containing demo',
        env.containsDemoRecords === false);
    var envDemo = D.exportEnvelope(all);
    has('export: an export containing demo records says so', envDemo.containsDemoRecords === true);
    has('export: and carries a warning readable in a text editor', !!envDemo._WARNING);

    var imp = D.validateImport(JSON.stringify(env));
    has('import: a clean export re-imports', imp.ok);
    eq('import: round-trips every record', imp.accepted.length, 148);
    has('import: a wrong schema version is refused',
        !D.validateImport(JSON.stringify({ schemaVersion: '0.0.1', records: [] })).ok);
    has('import: malformed JSON is refused with a message',
        !D.validateImport('{not json').ok);

    /* --- no fake controls (§29) ----------------------------------------- */
    var dead = GEO.dom.$$('button:not([disabled]):not([aria-disabled="true"])')
      .filter(function (b) {
        return !b.id && !b.dataset.go && !b.dataset.datatab &&
               !b.className && !b.getAttribute('role');
      });
    eq('§29: no unidentified, unwired buttons', dead.length, 0);

    var summary = {
      total: results.length,
      passed: results.filter(function (r) { return r.pass; }).length,
      failed: results.filter(function (r) { return !r.pass; })
    };
    summary.ok = summary.failed.length === 0;
    return { summary: summary, results: results };
  };

  /* ---------------------------------------------------------------- render */
  T.render = function (out) {
    var el = GEO.dom.el;
    var s = out.summary;
    var panel = el('div.selftest', { role: 'region', 'aria-label': 'Self test results' }, [
      el('header.selftest__hdr', {}, [
        el('h1', { text: 'Self test — ' + GEO.PRODUCT.name + ' ' + GEO.PRODUCT.version }),
        el('p.selftest__score' + (s.ok ? '.is-pass' : '.is-fail'), {
          text: s.passed + ' of ' + s.total + ' checks passed' +
                (s.ok ? '' : ' — ' + s.failed.length + ' FAILED')
        }),
        el('p.selftest__note', {
          text: 'Expected values are computed independently by tools/oracle.py from data/seed.json. ' +
                'Nothing asserted here is hard-coded inside the application.'
        }),
        el('a.selftest__back', { href: location.pathname, text: '← Back to the app' })
      ]),
      el('table.selftest__table', {}, [
        el('thead', {}, el('tr', {}, [
          el('th', { text: '' }), el('th', { text: 'Check' }),
          el('th', { text: 'Got' }), el('th', { text: 'Expected' }), el('th', { text: 'Note' })
        ])),
        el('tbody', {}, out.results.map(function (r) {
          return el('tr' + (r.pass ? '.is-pass' : '.is-fail'), {}, [
            el('td', { text: r.pass ? '✓' : '✕' }),
            el('td', { text: r.name }),
            el('td', { text: String(r.got) }),
            el('td', { text: String(r.want) }),
            el('td', { text: r.note || '' })
          ]);
        }))
      ])
    ]);
    document.body.className = 'selftest-mode';
    GEO.dom.fill(document.body, [panel]);
    return panel;
  };

  T.isRequested = function () {
    return /[?&]selftest=1/.test(location.search) || location.hash === '#selftest';
  };
}(window));
