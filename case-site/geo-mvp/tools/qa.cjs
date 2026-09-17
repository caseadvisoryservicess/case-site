#!/usr/bin/env node
/**
 * Browser QA harness — brief §66.
 *
 * Drives the built index.html in real Chromium from file://, which is exactly how
 * the deliverable will be opened. Checks the things a static read cannot: console
 * errors, failed network requests, the self-test assertions, the ten §35 UX
 * scenarios, the eight §63 assistant scenarios, responsive layout, and
 * prefers-reduced-motion.
 *
 *   node tools/qa.cjs                 run everything
 *   node tools/qa.cjs --shots         also write screenshots to qa-out/
 *   node tools/qa.cjs --only=selftest run one group
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const PW = execSync('npm root -g').toString().trim() + '/playwright';
const { chromium } = require(PW);

const ROOT = path.resolve(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'qa-out');
const SHOTS = process.argv.includes('--shots');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

const results = [];
let group = '';

function G(name) { group = name; }
function check(name, pass, detail) {
  results.push({ group, name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  const mark = pass ? '  \x1b[32m✓\x1b[0m' : '  \x1b[31m✕\x1b[0m';
  console.log(`${mark} ${name}${pass || detail === undefined ? '' : '  → ' + detail}`);
  return pass;
}

/**
 * A page starting from the shipped dataset with no local edits.
 *
 * localStorage on file:// is shared by every page in the context, so the UX
 * group's GLA edit survived into the assistant group and made three refusal
 * tests fail — the assistant was right that GLA coverage was 1, because the
 * previous group had put it there. Each group must start clean, and the app's
 * own `#reset` escape hatch is the honest way to do it: it clears storage
 * BEFORE init, which is exactly the recovery path a stuck tester would use.
 */
async function freshPage(ctx) {
  const page = await ctx.newPage();
  await page.goto(FILE + '#reset', { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  return page;
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
}

/**
 * The hosts a basemap may legitimately fail to reach when offline, read from the
 * registry in src/js/10b-basemaps.js rather than listed here.
 *
 * A hand-kept list drifts: the moment someone adds a provider, a real "the
 * deliverable is missing an asset" check starts reporting a tile fetch instead,
 * and the usual fix is to widen the list until it catches nothing. Parsing the
 * registry means adding a provider cannot silently blunt this check.
 */
function tileHosts() {
  const src = fs.readFileSync(path.join(ROOT, 'src/js/10b-basemaps.js'), 'utf8');
  const hosts = new Set();
  for (const m of src.matchAll(/url:\s*'https:\/\/([^'\/]+)/g)) {
    // {s}.basemaps.cartocdn.com -> basemaps.cartocdn.com
    hosts.add(m[1].replace(/^\{s\}\./, '').replace(/^tile-\{s\}\./, ''));
  }
  if (!hosts.size) throw new Error('qa: parsed no tile hosts from the basemap registry');
  return [...hosts];
}
const TILE_HOSTS = tileHosts();
const TILE_RE = new RegExp(TILE_HOSTS.map(h => h.replace(/\./g, '\\.')).join('|'));

/** Attach console/network listeners. Anything logged here is a §66 failure. */
function watch(page) {
  const errors = [], failed = [], warnings = [];
  page.on('console', m => {
    // The prototype is tested offline on purpose, so a failed tile fetch is the
    // designed state, not a defect. Everything else is.
    const t = m.text();
    if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED/.test(t) || TILE_RE.test(t)) return;
    if (m.type() === 'error') errors.push(t);
    if (m.type() === 'warning') warnings.push(t);
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => {
    const u = r.url();
    // Two external requests are OPTIONAL ENHANCEMENTS and are expected to fail when
    // the file is opened with no network: map tiles (the app draws a graticule and
    // says so) and the webfonts (typography falls back to Georgia / system-ui).
    // Everything else is an asset the deliverable itself is missing, which is a bug.
    if (TILE_RE.test(u) || /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u)) return;
    failed.push(u + ' – ' + (r.failure() && r.failure().errorText));
  });
  return { errors, failed, warnings };
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.error('index.html has not been built. Run: python3 build.py');
    process.exit(2);
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // The prototype is delivered as a file people open offline; test it that way.
    offline: true,
  });

  /* ───────────────────────── 1. boot & console ───────────────────────── */
  if (!ONLY || ONLY === 'boot') {
    G('boot');
    const page = await freshPage(ctx);
    const w = watch(page);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(1500);

    check('page loads from file://', await page.title() !== '');
    check('no console errors', w.errors.length === 0, w.errors.slice(0, 4).join(' | '));
    check('no failed requests for assets the file should carry itself',
          w.failed.length === 0, w.failed.slice(0, 4).join(' | '));

    // Offline typography must still be deliberate, not a browser default.
    const fonts = await page.evaluate(() => {
      const body = getComputedStyle(document.body).fontFamily;
      const h = document.querySelector('.hdr__name');
      return { body: body, display: h ? getComputedStyle(h).fontFamily : '' };
    });
    check('offline typography falls back to a named stack, not a browser default',
          /Inter|system-ui|-apple-system/.test(fonts.body) &&
          /DM Serif|Georgia|serif/.test(fonts.display),
          `${fonts.body} / ${fonts.display}`);

    const boot = await page.evaluate(() => ({
      hasGEO: typeof window.GEO === 'object',
      modules: Object.keys(window.GEO || {}).sort(),
      observed: window.GEO && window.GEO.data ? window.GEO.data.observed().length : -1,
      demo: window.GEO && window.GEO.data ? window.GEO.data.demoRecords().length : -1,
      districts: window.GEO && window.GEO.data ? window.GEO.data.districts().length : -1,
      markers: document.querySelectorAll('.leaflet-marker-icon').length,
      bodyScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    check('GEO namespace present', boot.hasGEO);
    check('148 observed records loaded', boot.observed === 148, boot.observed);
    check('8 demo records loaded', boot.demo === 8, boot.demo);
    check('12 districts loaded', boot.districts === 12, boot.districts);
    check('markers rendered on the map', boot.markers > 0, boot.markers + ' marker elements');
    check('no horizontal page scroll at 1440px', boot.bodyScrollX <= 0, boot.bodyScrollX);

    // T7: with no network the map must degrade, not break.
    check('offline map shows a notice rather than looking broken',
          await page.locator('#map-notice').isVisible().catch(() => false));

    // An unresolved i18n key renders as the key itself — visible, ugly, and silent.
    // Static analysis misses keys built by concatenation, so probe the rendered DOM.
    const leaks = await page.evaluate(() => {
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const keyish = /^[a-z][a-z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,4}\.?$/;
      let n;
      while ((n = walk.nextNode())) {
        const t = n.textContent.trim();
        if (t && keyish.test(t) && !/^\d/.test(t)) out.push(t);
      }
      return [...new Set(out)];
    });
    check('no unresolved i18n keys rendered on the default screen',
          leaks.length === 0, leaks.slice(0, 8).join(', '));

    // A DIFFERENT failure from a missing key, and invisible to the check above:
    // the key exists and resolves, but the caller passed variables under other
    // names, so "{n} of {m}" reaches the screen verbatim.
    const placeholders = await page.evaluate(() => {
      const out = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const tag = n.parentElement && n.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        const m = n.textContent.match(/\{[a-zA-Z][\w]*\}/g);
        if (m) m.forEach(x => out.add(x + '  in "' + n.textContent.trim().slice(0, 40) + '"'));
      }
      return [...out];
    });
    check('no unsubstituted {placeholders} rendered',
          placeholders.length === 0, placeholders.slice(0, 5).join(' | '));

    // Sweep every surface, not just the one the app opens on. A key behind a tab
    // or a modal is exactly where an unresolved string survives: nobody looks.
    const SURFACES = [
      ['analytics',       { rightRail: 'open', rightTab: 'analytics' }],
      ['assistant',       { rightRail: 'open', rightTab: 'ai' }],
      ['layers',          { rightRail: 'open', rightTab: 'layers' }],
      ['results list',    { leftRail: 'open', leftTab: 'results' }],
      ['data · records',  { overlay: 'data', dataTab: 'records' }],
      ['data · coverage', { overlay: 'data', dataTab: 'coverage' }],
      ['data · quality',  { overlay: 'data', dataTab: 'quality' }],
      ['data · dupes',    { overlay: 'data', dataTab: 'dupes' }],
      ['data · changes',  { overlay: 'data', dataTab: 'changes' }],
      ['data · io',       { overlay: 'data', dataTab: 'io' }],
    ];
    for (const [name, patch] of SURFACES) {
      const bad = await page.evaluate(async (p2) => {
        GEO.state.set(p2, { source: 'user', action: 'qa' });
        await new Promise(r => setTimeout(r, 120));
        const out = new Set();
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const keyish = /^[a-z][a-z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,4}\.?$/;
        let n;
        while ((n = walk.nextNode())) {
          const tag = n.parentElement && n.parentElement.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') continue;
          const txt = n.textContent.trim();
          if (txt && keyish.test(txt)) out.add(txt);
          const ph = txt.match(/\{[a-zA-Z][\w]*\}/g);
          if (ph) ph.forEach(x => out.add(x));
        }
        return [...out];
      }, patch);
      check(`no unresolved strings on: ${name}`, bad.length === 0, bad.slice(0, 5).join(', '));
    }
    // A property must be selected for the property tab to have anything to show.
    const propBad = await page.evaluate(async () => {
      const tri = GEO.data.observed().filter(x => x.name === 'Trilliant')[0];
      GEO.state.set({ overlay: null, selectedId: tri.id, rightRail: 'open', rightTab: 'property',
                      radius: { id: tri.id, km: [1, 3, 5] } }, { source: 'user', action: 'qa' });
      await new Promise(r => setTimeout(r, 200));
      const out = new Set();
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const keyish = /^[a-z][a-z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*){1,4}\.?$/;
      let n;
      while ((n = walk.nextNode())) {
        const tag = n.parentElement && n.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        const txt = n.textContent.trim();
        if (txt && keyish.test(txt)) out.add(txt);
        const ph = txt.match(/\{[a-zA-Z][\w]*\}/g);
        if (ph) ph.forEach(x => out.add(x));
      }
      return [...out];
    });
    check('no unresolved strings on: property + location',
          propBad.length === 0, propBad.slice(0, 5).join(', '));
    await page.evaluate(() => GEO.state.clearAnalysis({ source: 'user', action: 'qa' }));

    await shot(page, '01-desktop-1440');
    await page.close();
  }

  /* ───────────────────────── 2. self test ───────────────────────── */
  if (!ONLY || ONLY === 'selftest') {
    G('selftest');
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(FILE + '?selftest=1', { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    const out = await page.evaluate(() => {
      if (!window.GEO || !window.GEO.selftest) return null;
      try { return window.GEO.selftest.run(); }
      catch (e) { return { error: e.message, stack: e.stack }; }
    });

    if (!out) {
      check('selftest module present', false, 'GEO.selftest missing');
    } else if (out.error) {
      check('selftest runs without throwing', false, out.error);
    } else {
      check(`selftest: ${out.summary.passed}/${out.summary.total} assertions pass`,
            out.summary.ok,
            out.summary.failed.map(f => `${f.name} (got ${f.got}, want ${f.want})`).join(' | '));
      // Surface every individual failure so the report is actionable.
      out.summary.failed.forEach(f =>
        check(`  ↳ ${f.name}`, false, `got ${JSON.stringify(f.got)}, expected ${JSON.stringify(f.want)}`));
    }
    check('selftest page has no console errors', w.errors.length === 0, w.errors.slice(0, 3).join(' | '));
    await shot(page, '02-selftest');
    await page.close();
  }

  /* ───────────────────────── 3. UX scenarios (§35) ───────────────────────── */
  if (!ONLY || ONLY === 'ux') {
    G('ux scenarios (§35)');
    const page = await freshPage(ctx);
    const w = watch(page);

    const api = fn => page.evaluate(fn);

    // UX-1 — class filter
    let r = await api(() => {
      GEO.state.set({ filters: Object.assign({}, GEO.state.get().filters, { classes: ['A', 'A+'] }) },
                     { source: 'user', action: 'qa' });
      const rows = GEO.filters.apply(GEO.data.workingSet(), GEO.state.get().filters);
      return { n: rows.length, counter: (document.getElementById('result-count') || {}).textContent };
    });
    check('UX-1 class A + A+ yields 12 properties', r.n === 12, r.n);
    check('UX-1 the counter reflects it', /12/.test(r.counter || ''), r.counter);

    // UX-3 — rent filter
    r = await api(() => {
      GEO.state.resetFilters({ source: 'user', action: 'qa' });
      GEO.state.set({ filters: Object.assign({}, GEO.state.get().filters, { rentMax: 29.99 }) },
                     { source: 'user', action: 'qa' });
      return GEO.filters.apply(GEO.data.workingSet(), GEO.state.get().filters).length;
    });
    check('UX-3 asking rent under 30 yields 8 properties', r === 8, r);

    // UX-2 — district filter, including the true-zero district
    r = await api(() => {
      GEO.state.resetFilters({ source: 'user', action: 'qa' });
      const f = k => GEO.filters.apply(GEO.data.workingSet(),
        Object.assign({}, GEO.state.defaults().filters, { districts: [k] })).length;
      return { mirobod: f('mirobod'), yangihayot: f('yangihayot') };
    });
    check('UX-2 Mirobod yields 28 properties (geometry-authoritative)', r.mirobod === 28, r.mirobod);
    check('UX-2 Yangihayot is a true zero', r.yangihayot === 0, r.yangihayot);

    // UX-4 — location analysis
    r = await api(() => {
      const tri = GEO.data.observed().filter(x => x.name === 'Trilliant')[0];
      const la = GEO.geo.locationAnalysis(tri, GEO.data.workingSet(), {});
      return { b: la.bands.map(x => x.count),
               rentN: la.bands[1].rent.n,
               glaSufficient: la.bands[1].gla.sufficient,
               qualified: la.competitiveSet.qualified.length,
               proximityOnly: la.competitiveSet.proximityOnly.length };
    });
    check('UX-4 radius counts 1/3/5 km = 7/74/114', JSON.stringify(r.b) === '[7,74,114]', r.b);
    check('UX-4 nearby GLA is withheld, not zeroed', r.glaSufficient === false);
    check('UX-4 competitive set: 9 qualified, 63 proximity-only',
          r.qualified === 9 && r.proximityOnly === 63, `${r.qualified}/${r.proximityOnly}`);

    // Each ring carries its band's COUNT — that number is the only thing making
    // the circle more than decoration, and property markers were drawing through
    // it. Leaflet orders markers within a pane by latitude, so neither a
    // stylesheet z-index nor zIndexOffset could hold: the labels need a pane
    // above markerPane. Asserted structurally because the labels are
    // pointer-events:none, which makes elementFromPoint report what is beneath
    // them however they are stacked.
    const rings = await page.evaluate(async () => {
      const tri = GEO.data.observed().filter(x => x.name === 'Trilliant')[0];
      GEO.state.set({ selectedId: tri.id, radius: { id: tri.id, km: [1, 3, 5] } },
                    { source: 'user', action: 'qa' });
      await new Promise(r => setTimeout(r, 1200));
      const z = sel => { const e = document.querySelector(sel);
                         return e ? (+getComputedStyle(e).zIndex || 0) : null; };
      const labels = [...document.querySelectorAll('.geo-radius-label')];
      return { n: labels.length,
               markerZ: z('.leaflet-marker-pane'),
               labelZ: z('.leaflet-radiusLabels-pane'),
               allInPane: labels.length > 0 && labels.every(l =>
                 !!l.closest('.leaflet-radiusLabels-pane')),
               texts: labels.map(l => l.textContent.trim()) };
    });
    check('UX-4 every radius band is labelled with its count',
          rings.n === 3 && rings.texts.every(t => /\d/.test(t)), rings.texts.join(' | '));
    check('UX-4 radius labels render above the markers',
          rings.allInPane && rings.labelZ > rings.markerZ,
          `labels z=${rings.labelZ} vs markers z=${rings.markerZ}`);
    await page.evaluate(() => GEO.state.set({ radius: null }, { source: 'user', action: 'qa' }));

    // Every result card states its completeness as a COUNT and draws a meter to
    // match. 04-quality.js calls the two numbers known/total, the list panel calls
    // them n/m, and the panel used to pass the quality module's object straight
    // through — so the caption read "Not recorded of Not recorded key fields
    // recorded" on all 148 cards and every meter computed 0%. The 0% looked
    // right on a dataset whose true answer is mostly zero, which is precisely why
    // nothing caught it. Assert against a record that HAS fields.
    const comp = await page.evaluate(async () => {
      GEO.state.set({ leftTab: 'results', listSort: 'completeness.desc' },
                    { source: 'user', action: 'qa' });
      await new Promise(r => setTimeout(r, 900));
      const card = document.querySelector('#results-list .rcard');
      if (!card) return null;
      const cap = [...card.querySelectorAll('.coverage')].map(e => e.textContent.trim())
        .filter(x => /key fields/.test(x))[0] || '';
      const fill = card.querySelector('.covrow__fill');
      return { cap: cap, width: fill ? fill.style.width : null };
    });
    check('UX list card: completeness is a count, not "Not recorded"',
          !!comp && /^\d+ of \d+ /.test(comp.cap), comp && comp.cap);
    check('UX list card: the completeness meter matches the count',
          !!comp && comp.width === '25%', comp && `${comp.cap} -> ${comp.width}`);
    await page.evaluate(() => GEO.state.set({ listSort: 'name.asc' },
                                            { source: 'user', action: 'qa' }));

    // UX-5 — compare guard rails
    r = await api(() => {
      const ids = GEO.data.observed().slice(0, 5).map(x => x.id);
      GEO.state.set({ compare: ids }, { source: 'user', action: 'qa' });
      return GEO.state.get().compare.length;
    });
    check('UX-5 compare is capped at 4', r === 4, r);

    // UX-8/9 — edit and add propagate to analytics
    r = await api(() => {
      GEO.state.resetFilters({ source: 'user', action: 'qa' });
      const before = GEO.analytics.metric(GEO.data.workingSet(), 'gla', 'sum');
      const target = GEO.data.observed().filter(x => x.name === 'Gross Plaza')[0];
      const res = GEO.data.update(target.id, { gla: 12000 }, { confidence: 'Low' });
      const after = GEO.analytics.metric(GEO.data.workingSet(), 'gla', 'sum');
      const rent = GEO.analytics.metric(GEO.data.workingSet(), 'askingRent', 'mean');
      return { ok: res.ok, beforeSufficient: before.sufficient, afterValue: after.value,
               afterN: after.n, rentN: rent.n, edited: GEO.data.get(target.id)._meta.editedLocally };
    });
    check('UX-8 edit succeeds', r.ok);
    check('UX-8 total known GLA was "insufficient" before the edit', r.beforeSufficient === false);
    check('UX-8 total known GLA becomes 12,000 over n=1 after it',
          r.afterValue === 12000 && r.afterN === 1, `${r.afterValue} / n=${r.afterN}`);
    check('UX-8 an unrelated denominator is untouched (rent still n=16)', r.rentN === 16, r.rentN);
    check('UX-8 the record is marked edited locally', r.edited === true);

    r = await api(() => {
      const res = GEO.data.add({ name: 'QA Test Tower', lat: 41.3, lng: 69.28, districtKey: 'yunusobod' });
      const bad = GEO.data.add({ name: 'Atlantic Tower', lat: 0, lng: 0, districtKey: 'yunusobod' });
      const n = GEO.data.observed().length;
      const del = res.ok ? GEO.data.remove(res.record.id) : { ok: false };
      return { added: res.ok, count: n, rejected: !bad.ok,
               reason: bad.errors && bad.errors[0] && bad.errors[0].message,
               deleted: del.ok, after: GEO.data.observed().length };
    });
    check('UX-9 a new record can be added', r.added);
    check('UX-9 the count becomes 149', r.count === 149, r.count);
    check('UX-9 out-of-bounds coordinates are refused', r.rejected, r.reason);
    check('UX-9 deleting returns the count to 148', r.deleted && r.after === 148, r.after);

    // UX-10 — export / import round trip
    r = await api(() => {
      const env = GEO.data.exportEnvelope(GEO.data.observed());
      const txt = JSON.stringify(env);
      const imp = GEO.data.validateImport(txt);
      const badVer = GEO.data.validateImport(JSON.stringify(
        Object.assign({}, env, { schemaVersion: '0.0.1' })));
      const badJson = GEO.data.validateImport('{oops');
      return { ok: imp.ok, n: imp.accepted.length, badVer: !badVer.ok, badJson: !badJson.ok,
               hasVersion: !!env.schemaVersion, hasExportedAt: !!env.exportedAt };
    });
    check('UX-10 export re-imports cleanly', r.ok && r.n === 148, r.n);
    check('UX-10 export declares schemaVersion and exportedAt', r.hasVersion && r.hasExportedAt);
    check('UX-10 a mismatched schema version is refused', r.badVer);
    check('UX-10 malformed JSON is refused', r.badJson);

    check('UX run produced no console errors', w.errors.length === 0, w.errors.slice(0, 3).join(' | '));
    await page.close();
  }

  /* ───────────────────────── 4. assistant (§63) ───────────────────────── */
  if (!ONLY || ONLY === 'ai') {
    G('assistant scenarios (§63)');
    // Deliberately a FRESH page: the UX group edits a GLA in, and the §63
    // refusal tests are only meaningful against the shipped coverage of zero.
    const page = await freshPage(ctx);
    const w = watch(page);

    const ask = q => page.evaluate(async (query) => {
      if (!window.GEO || !GEO.ai || !GEO.ai.ask) return { missing: true };
      const res = await GEO.ai.ask(query);
      const st = GEO.state.get();
      return {
        intent: res && res.intent,
        answer: res && res.answer,
        blocks: res ? Object.keys(res) : [],
        coverage: res && res.dataCoverage,
        limitations: res && res.limitations,
        unavailable: res && res.unavailable === true,
        filters: st.filters,
        layers: st.aiLayers.map(l => ({ name: l.name, count: l.count })),
        resultCount: res && res.resultCount,
        radius: !!st.radius,
        selected: st.selectedId,
        compare: st.compare.length,
      };
    }, q);

    let a = await ask('Show Class A and A+ business centres');
    if (a.missing) {
      check('assistant module present', false, 'GEO.ai.ask missing');
    } else {
      check('AI-1 applies a class filter', JSON.stringify((a.filters.classes || []).sort()) === '["A","A+"]',
            JSON.stringify(a.filters.classes));
      check('AI-1 returns 12 properties', a.resultCount === 12, a.resultCount);
      check('AI-1 creates a layer', a.layers.length >= 1, JSON.stringify(a.layers));
      check('AI-1 states data coverage', !!a.coverage && /16 of 148|16\/148/.test(a.coverage), a.coverage);
      const six = ['answer', 'analysis', 'mapActions', 'dataCoverage', 'limitations', 'sources'];
      check('AI-1 response carries all six §46 blocks',
            six.every(k => a.blocks.indexOf(k) >= 0),
            six.filter(k => a.blocks.indexOf(k) < 0).join(', ') || 'all present');

      // The anti-hallucination test: GLA has zero coverage on the observed set.
      a = await ask('Only buildings above 5,000 m2');
      check('AI-2 refuses rather than inventing a size filter', a.unavailable === true, a.answer);
      check('AI-2 names GLA as the missing field', /gla|size|m²|m2/i.test(a.answer || ''), a.answer);
      check('AI-2 leaves the previous selection intact (still 12)',
            JSON.stringify((a.filters.classes || []).sort()) === '["A","A+"]',
            JSON.stringify(a.filters.classes));

      a = await ask('Which district has the most known Class A GLA?');
      check('AI-3a refuses a GLA ranking', a.unavailable === true, a.answer);

      a = await ask('Which district has the most Class A and A+ offices?');
      check('AI-3b answers the answerable form', a.unavailable !== true, a.answer);
      check('AI-3b names Yunusobod as the top district', /yunusobod/i.test(a.answer || ''), a.answer);

      await page.evaluate(() => {
        const tri = GEO.data.observed().filter(x => x.name === 'Trilliant')[0];
        GEO.state.set({ selectedId: tri.id }, { source: 'user', action: 'qa' });
      });
      a = await ask('Show its competitors within 3 km');
      check('AI-4 resolves "its" to the selected property', /trilliant/i.test(a.answer || ''), a.answer);
      check('AI-4 draws a radius', a.radius === true);
      check('AI-4 creates a competitor layer', a.layers.length >= 1, JSON.stringify(a.layers));

      a = await ask('Show properties with poor data quality');
      check('AI-5 produces a data-quality layer', a.layers.length >= 1, JSON.stringify(a.layers));

      a = await ask('Which buildings need data verification?');
      check('AI-6 produces a verification queue', a.unavailable !== true, a.answer);

      // §63 gives each scenario its own starting state; AI-5 left a data-quality
      // filter applied, and carrying it into AI-7 would test a different question.
      await page.evaluate(() => GEO.state.clearAnalysis({ source: 'user', action: 'qa' }));
      a = await ask('Compare the three largest properties currently on the map');
      check('AI-7a refuses "largest" with no size data', a.unavailable === true, a.answer);

      a = await ask('Compare the three highest known asking rents');
      check('AI-7b compares the three highest known rents', a.compare === 3, a.compare);

      a = await ask('Remove this analysis and return to all business centres');
      check('AI-8 clears every layer', a.layers.length === 0, JSON.stringify(a.layers));
      check('AI-8 clears the radius', a.radius === false);
      check('AI-8 resets the filters', (a.filters.classes || []).length === 0);
      check('AI-8 deselects the property', !a.selected);

      const kept = await page.evaluate(() => GEO.state.sessionLog().length);
      check('AI-8 keeps the session log (reset clears state, not history)', kept > 0, kept);
    }
    check('assistant run produced no console errors', w.errors.length === 0, w.errors.slice(0, 3).join(' | '));
    await shot(page, '03-assistant');
    await page.close();
  }

  /* ───────────────────── 4b. cross-cutting checks (§29, §60, §8) ───────────────────── */
  if (!ONLY || ONLY === 'checks') {
    G('cross-cutting');
    const page = await freshPage(ctx);
    const w = watch(page);

    // §9.3 — no user-visible string may be a raw i18n key. The static audit
    // (tools/check-i18n.cjs) sees `t('literal')` and nothing else, so it reports
    // "missing: 0" while fourteen COMPUTED prefixes — `t('value.flag.' + v)` and
    // friends — go unchecked. Five of those keys were in fact absent, and because
    // `t()` returns the key on a miss, the CSV export's filter header read
    // "flagged value.flag.duplicate": a file that leaves the app and reaches a
    // client. This check drives the real enumerations through the real call sites
    // and tests the OUTPUT, so it needs no list of key names to keep in step.
    const KEYISH = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_+-]+)+$/;
    const raw = await page.evaluate(() => {
      const bad = [], FL = GEO.filters;
      const flag = (where, v) => { if (typeof v === 'string' && v) bad.push(where + ': ' + v); };

      // every enumerated value, through the label function the UI actually calls
      [['flag', FL.FLAGS], ['completeness', FL.COMPLETENESS_BANDS],
       ['freshness', (FL.FRESHNESS_STATES || []).concat(['unknown'])],
       ['confidence', ['High', 'Medium', 'Low', 'Unknown']]
      ].forEach(([kind, vals]) => (vals || []).forEach(v =>
        flag('valueLabel(' + kind + ',' + v + ')', FL.valueLabel(kind, v))));

      // every disabled filter's reason, as the panel would print it
      (FL.availability(GEO.data.workingSet()) || []).forEach(e => {
        flag('availability(' + e.key + ').reason', e.reason);
        flag('availability(' + e.key + ').coverageText', e.coverageText);
      });

      // describe(): on screen, in the CSV header, and as a saved layer's name
      const f = GEO.state.get().filters;
      flag('describe(flags)', FL.describe(Object.assign({}, f, { flags: FL.FLAGS.slice() })));
      return bad;
    });
    const rawHits = raw.filter(s => KEYISH.test(s.split(': ').slice(1).join(': ')));
    check('no computed i18n key resolves to itself', rawHits.length === 0, rawHits.join(' | '));

    /* ───────────── base maps (§10) ─────────────
       The registry is a licence surface as much as a feature. Three things must
       hold and none of them are visible by reading the UI:
         · every provider shipped ACTIVE carries an attribution (omitting one is
           a licence breach, not a cosmetic slip);
         · no provider whose terms forbid direct tile access ships with a URL;
         · switching actually swaps the layer and leaves exactly one behind.  */
    const bm = await page.evaluate(async () => {
      const B = GEO.basemaps;
      const out = { audit: B.audit(), ids: B.PROVIDERS.map(p => p.id) };
      out.openWithoutAttribution = B.PROVIDERS
        .filter(p => p.access === 'open' && !p.attributionKey).map(p => p.id);
      out.licensedShippingUrls = B.PROVIDERS
        .filter(p => p.access === 'licensed' && p.url).map(p => p.id);
      out.lockedAreNamed = ['2gis', 'google', 'yandex']
        .every(id => B.PROVIDERS.some(p => p.id === id));
      out.lockedAreUnusable = ['2gis', 'google', 'yandex'].every(id => !B.usable(id));
      out.lockedStateReason = ['2gis', 'google', 'yandex']
        .every(id => !!B.get(id).needsKey);

      // a real switch, through state, as the radio does it
      GEO.state.set({ basemap: 'carto-dark' }, { source: 'user', action: 'qa' });
      await new Promise(r => setTimeout(r, 1600));
      out.dark = { attr: document.querySelector('.mapwrap').dataset.basemap,
                   layers: document.querySelectorAll('.leaflet-tile-pane .leaflet-layer').length };

      GEO.state.set({ basemap: 'none' }, { source: 'user', action: 'qa' });
      await new Promise(r => setTimeout(r, 1600));
      out.none = { layers: document.querySelectorAll('.leaflet-tile-pane .leaflet-layer').length,
                   noticeHidden: document.getElementById('map-notice').hidden,
                   chosen: document.querySelector('.mapwrap').dataset.tilesChosen };

      GEO.state.set({ basemap: B.DEFAULT_ID }, { source: 'user', action: 'qa' });
      await new Promise(r => setTimeout(r, 1600));
      out.back = { layers: document.querySelectorAll('.leaflet-tile-pane .leaflet-layer').length };
      return out;
    });
    check('§10: the basemap registry is self-consistent', bm.audit.length === 0, bm.audit.join(', '));
    check('§10: every active basemap carries an attribution',
          bm.openWithoutAttribution.length === 0, bm.openWithoutAttribution.join(', '));
    check('§10: no licensed provider ships a tile URL',
          bm.licensedShippingUrls.length === 0, bm.licensedShippingUrls.join(', '));
    check('§10: 2GIS, Google and Yandex are named, not omitted', bm.lockedAreNamed);
    check('§10: …and are locked, each stating what unlocks it',
          bm.lockedAreUnusable && bm.lockedStateReason);
    check('§10: switching to a dark basemap flips the marker-ring hook',
          bm.dark.attr === 'dark', bm.dark.attr);
    check('§10: a switch leaves exactly one tile layer, not a stack',
          bm.dark.layers === 1 && bm.back.layers === 1,
          `dark=${bm.dark.layers} back=${bm.back.layers}`);
    check('§10: "no base map" removes the tiles entirely',
          bm.none.layers === 0, String(bm.none.layers));
    /* The layers panel is the one piece of map chrome that is a DIALOG, and it
       grew tall enough to expose two stacking faults at once: Leaflet numbers
       its panes up to 700, so with #map at `z-index: auto` a z-600 marker drew
       over the z-10 panel and covered its own heading; and at 1765px the panel
       ran 893px past the bottom of a 940px window with its last options simply
       unreachable. Both are asserted from the RENDERED box, not the stylesheet. */
    const panelGeom = await page.evaluate(async () => {
      document.getElementById('map-layers').click();
      await new Promise(r => setTimeout(r, 800));
      const panel = document.getElementById('maplayers-panel');
      const b = panel.getBoundingClientRect();
      const top = sel => {
        const el = panel.querySelector(sel);
        if (!el) return 'missing';
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(Math.round(r.x + 6), Math.round(r.y + 6));
        return hit && (panel === hit || panel.contains(hit)) ? 'panel' : 'covered';
      };
      /* Sampling two fixed points is not enough: whether a marker sits under the
         heading depends on the map view, so the check passed with the fault
         still present. Find the markers that ACTUALLY intersect the panel and
         sample inside each intersection; assert the structural cause as well,
         so the check keeps its teeth when no marker happens to overlap. */
      const pr = panel.getBoundingClientRect();
      const covered = [];
      document.querySelectorAll('.leaflet-marker-icon').forEach(m => {
        const mr = m.getBoundingClientRect();
        if (!mr.width) return;
        const x = Math.max(pr.left, mr.left), y = Math.max(pr.top, mr.top);
        const x2 = Math.min(pr.right, mr.right), y2 = Math.min(pr.bottom, mr.bottom);
        if (x2 <= x || y2 <= y) return;
        const hit = document.elementFromPoint(Math.round((x + x2) / 2), Math.round((y + y2) / 2));
        if (!(hit && (panel === hit || panel.contains(hit)))) {
          covered.push(String(m.className).slice(0, 30));
        }
      });
      const out = { fits: b.bottom <= innerHeight + 1, height: Math.round(b.height),
                    viewport: innerHeight,
                    heading: top('.fgroup__hd'), radio: top('input[name="basemap"]'),
                    overlappingMarkers: document.querySelectorAll('.leaflet-marker-icon').length,
                    covered: covered,
                    mapIsolation: getComputedStyle(document.getElementById('map')).isolation };
      document.getElementById('map-layers').click();
      return out;
    });
    check('§10: the layers panel fits the window it opens in',
          panelGeom.fits, `${panelGeom.height}px in ${panelGeom.viewport}px`);
    check('§10: no map marker draws over the open layers panel',
          panelGeom.covered.length === 0 &&
          panelGeom.heading === 'panel' && panelGeom.radio === 'panel' &&
          panelGeom.mapIsolation === 'isolate',
          `covered=${panelGeom.covered.length} heading=${panelGeom.heading} ` +
          `isolation=${panelGeom.mapIsolation}`);

    check('§10: a CHOSEN grid is not reported as an outage',
          bm.none.noticeHidden === true && bm.none.chosen === 'true',
          `noticeHidden=${bm.none.noticeHidden} chosen=${bm.none.chosen}`);

    /* ───────────── dashes ─────────────
       The house rule is the en dash. Checked against RENDERED text rather than
       source, because that is where it is visible and because the source also
       contains hundreds of code comments the rule does not govern. */
    const sweepDashes = () => page.evaluate(() => {
      const hits = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walk.nextNode())) {
        const tag = n.parentElement && n.parentElement.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') continue;
        if (n.textContent.indexOf('\u2014') >= 0) hits.push(n.textContent.trim().slice(0, 60));
      }
      // placeholders, titles and aria labels are read too — an em dash hiding in
      // a tooltip is still on screen.
      document.querySelectorAll('[placeholder],[title],[aria-label]').forEach(e => {
        ['placeholder', 'title', 'aria-label'].forEach(a => {
          const v = e.getAttribute(a);
          if (v && v.indexOf('\u2014') >= 0) hits.push(a + ': ' + v.slice(0, 50));
        });
      });
      return hits;
    });

    // One surface is not a sweep: most copy lives in panels the default view
    // never shows, which is exactly where a missed dash would survive.
    const dashSurfaces = [
      ['default', null],
      ['analytics', { rightRail: 'open', rightTab: 'analytics' }],
      ['assistant', { rightRail: 'open', rightTab: 'assistant' }],
      ['layers', { rightRail: 'open', rightTab: 'layers' }],
      ['results', { leftTab: 'results' }],
      ['filters', { leftTab: 'filters' }],
      ['grid basemap', { basemap: 'none' }],
      ['demo mode', { demoMode: true }]
    ];
    let dashHits = [];
    for (const [name, patch] of dashSurfaces) {
      if (patch) {
        await page.evaluate(p => GEO.state.set(p, { source: 'user', action: 'qa' }), patch);
        await page.waitForTimeout(700);
      }
      const hits = await sweepDashes();
      if (hits.length) dashHits.push(`${name}: ${hits[0]}`);
    }
    await page.evaluate(() => GEO.state.set(
      { demoMode: false, basemap: GEO.basemaps.DEFAULT_ID, rightRail: 'closed' },
      { source: 'user', action: 'qa' }));
    await page.waitForTimeout(500);
    check(`house style: no em dash in rendered text (${dashSurfaces.length} surfaces)`,
          dashHits.length === 0, dashHits.slice(0, 3).join(' | '));

    /* ───────────── motion ─────────────
       A count-up that interpolated a FORMATTED value would put digits on screen
       that were never a measurement — the one thing this product may not do. */
    const motion = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.textContent = '$32.2';
      document.body.appendChild(probe);
      GEO.motion.countUp(probe, '$28.6');
      const immediate = probe.textContent;
      probe.remove();
      return { formattedSetDirectly: immediate === '$28.6',
               animates: GEO.motion.animates() };
    });
    check('motion: a formatted value is never interpolated',
          motion.formattedSetDirectly, 'got a tweened currency string');

    // §29 — no control may be inert. Every visible, enabled button must either carry
    // a handler-bearing id/data hook, or be disabled with a reason the user can read.
    const controls = await page.evaluate(() => {
      const vis = el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      // An anchor with a real href is wired by construction: clicking it goes
      // somewhere. The §29 failure is a BUTTON that looks actionable and is not —
      // which is why the map's OpenStreetMap attribution links are not a finding.
      const all = Array.from(document.querySelectorAll('button, [role="button"]')).filter(vis);
      const disabled = all.filter(b => b.disabled || b.getAttribute('aria-disabled') === 'true');
      // A disabled control with no visible reason is the failure §29 describes: it
      // looks broken rather than explained.
      const unexplained = disabled.filter(b =>
        !b.title && !b.getAttribute('aria-describedby') && !b.dataset.reason &&
        !(b.parentElement && /reason|note|why|hint/i.test(b.parentElement.className))
      ).slice(0, 6).map(b => (b.id || b.textContent.trim().slice(0, 24) || b.className));
      const anonymous = all.filter(b => !b.disabled && !b.id && !b.dataset.go &&
        !b.dataset.datatab && !b.getAttribute('role') && !b.className).slice(0, 6)
        .map(b => b.textContent.trim().slice(0, 24));
      return { total: all.length, disabled: disabled.length, unexplained, anonymous };
    });
    check(`§29: ${controls.total} controls, ${controls.disabled} disabled – every disabled one gives a reason`,
          controls.unexplained.length === 0, controls.unexplained.join(', '));
    check('§29: no anonymous unwired control', controls.anonymous.length === 0,
          controls.anonymous.join(', '));

    // X-12 — the product name lives in exactly one constant (§8: not "ZAKY").
    const naming = await page.evaluate(() => ({
      product: GEO.PRODUCT.name,
      provisional: GEO.PRODUCT.provisional,
      // The header now shows the CASE lockup (the firm) and the product word
      // separately, so the constant is read back from BOTH — the visible text,
      // not a hidden copy of it. A lockup that stopped agreeing with the name
      // written into every export is exactly what this check is for.
      header: [(document.getElementById('brand-word') || {}).textContent,
               (document.getElementById('product-name') || {}).textContent]
                 .filter(Boolean).join(' '),
      descriptor: (document.getElementById('brand-descriptor') || {}).textContent,
      // body.textContent includes the inlined <script> blocks, and one of them
      // carries the comment explaining why the name is NOT "ZAKY". Read the text
      // a person can actually see instead.
      zaky: (function () {
        var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        var n;
        while ((n = walk.nextNode())) {
          var tag = n.parentElement && n.parentElement.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') continue;
          if (/zaky/i.test(n.textContent)) return true;
        }
        return false;
      }()),
      chipShown: !document.getElementById('product-provisional').hidden,
    }));
    check('§8: the header renders the product-name constant',
          naming.header === naming.product, `${naming.header} vs ${naming.product}`);
    check('§8: the name is not "ZAKY" anywhere', naming.zaky === false);
    check('§8: a provisional name is labelled as provisional', naming.chipShown === true);
    check('§8: the header carries the CASE firm descriptor',
          naming.descriptor === 'Real Estate Advisory', naming.descriptor);

    // X-11 — the data chip is the honest one-line summary of the dataset.
    const chip = await page.evaluate(() => (document.getElementById('data-chip') || {}).textContent || '');
    check('§8/§19: the data chip states records, sources and the collection date',
          /148/.test(chip) && /2026|Jul/.test(chip), JSON.stringify(chip));

    // X-9 — switching to the client view hides internal surfaces (§60).
    const role = await page.evaluate(() => {
      GEO.state.set({ role: 'external' }, { source: 'user', action: 'qa' });
      const ext = {
        dataBtn: document.getElementById('btn-data').hidden,
        internalTools: GEO.ai.available('external').length,
        allTools: GEO.ai.available('internal').length,
      };
      GEO.state.set({ role: 'internal' }, { source: 'user', action: 'qa' });
      return Object.assign(ext, { dataBtnBack: document.getElementById('btn-data').hidden });
    });
    check('§60: the client view hides the data workspace', role.dataBtn === true);
    check('§60: the client view exposes fewer assistant tools',
          role.internalTools < role.allTools, `${role.internalTools} of ${role.allTools}`);
    check('§60: switching back restores it', role.dataBtnBack === false);

    // The demo-containment banner must appear the moment demo mode is on (D4).
    const demo = await page.evaluate(() => {
      GEO.data.setDemoMode(true);
      GEO.state.set({ demoMode: true }, { source: 'user', action: 'qa' });
      const on = { banner: !document.getElementById('demobar').hidden,
                   rows: GEO.data.workingSet().length };
      GEO.data.setDemoMode(false);
      GEO.state.set({ demoMode: false }, { source: 'user', action: 'qa' });
      return Object.assign(on, { bannerOff: document.getElementById('demobar').hidden,
                                 rowsOff: GEO.data.workingSet().length });
    });
    check('D4: demo mode shows a non-dismissible banner', demo.banner === true);
    check('D4: demo mode adds the 8 synthetic records', demo.rows === 156, demo.rows);
    check('D4: turning it off removes both', demo.bannerOff === true && demo.rowsOff === 148, demo.rowsOff);

    check('cross-cutting run produced no console errors',
          w.errors.length === 0, w.errors.slice(0, 3).join(' | '));
    await page.close();
  }

  /* ───────────────────────── 5. responsive & motion ───────────────────────── */
  if (!ONLY || ONLY === 'responsive') {
    G('responsive & motion');
    for (const vp of [{ w: 1920, h: 1080, n: 'xxl' }, { w: 1280, h: 800, n: 'l' },
                      { w: 1024, h: 768, n: 'm' }, { w: 768, h: 1024, n: 's' },
                      { w: 375, h: 812, n: 'xs' }]) {
      const page = await ctx.newPage();
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(FILE, { waitUntil: 'load' });
      await page.waitForTimeout(900);

      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const name = el => el.tagName.toLowerCase() +
          (el.id ? '#' + el.id : '.' + String(el.className).split(' ')[0]);

        // A drawer parked off-screen (translated out, visibility:hidden) still reports a
        // negative rect, and counting it as overflow would mask the real ones. Only an
        // element the user can actually SEE partly outside the viewport is a defect.
        const visible = el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
          if (el.closest('[hidden]') || el.hasAttribute('hidden')) return false;
          const r = el.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const shownW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
          const shownH = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
          return shownW > 0 && shownH > 0;
        };

        const overflowing = Array.from(document.querySelectorAll('body *'))
          .filter(el => {
            if (!visible(el)) return false;
            const r = el.getBoundingClientRect();
            return r.right > window.innerWidth + 1 || r.left < -1;
          })
          .slice(0, 5).map(name);

        // Text clipped by its own box. `.vh` is the visually-hidden utility, which is
        // clipped BY DESIGN — that is how it stays available to screen readers.
        const clipped = Array.from(document.querySelectorAll('body *'))
          .filter(el => {
            if (el.children.length || !el.textContent.trim()) return false;
            if (el.classList.contains('vh') || el.closest('.vh')) return false;
            if (!visible(el)) return false;
            const cs = getComputedStyle(el);
            if (/auto|scroll/.test(cs.overflow + cs.overflowX + cs.overflowY)) return false;
            if (cs.textOverflow === 'ellipsis') return false;   // deliberate truncation
            return el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
          })
          .slice(0, 5)
          .map(el => name(el) + ': "' + el.textContent.trim().slice(0, 30) + '"');

        const map = document.getElementById('map');
        return {
          scrollX: de.scrollWidth - de.clientWidth,
          overflowing, clipped,
          mapW: map ? Math.round(map.getBoundingClientRect().width) : 0,
        };
      });
      check(`${vp.n} (${vp.w}px): no horizontal page scroll`, m.scrollX <= 0, m.scrollX);
      check(`${vp.n} (${vp.w}px): nothing visible overflows the viewport`,
            m.overflowing.length === 0, m.overflowing.join(', '));
      check(`${vp.n} (${vp.w}px): no clipped text`,
            m.clipped.length === 0, m.clipped.join(' | '));

      // Overlap is invisible to an overflow check: both elements are inside the
      // viewport, just on top of each other. The map chrome is where it happens.
      const overlaps = await page.evaluate(() => {
        const ids = ['maplegend', 'map-notice', 'mapchrome', 'compare-tray'];
        const boxes = ids.map(id => {
          const el = document.getElementById(id);
          if (!el || el.hidden || getComputedStyle(el).display === 'none') return null;
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 ? { id, r } : null;
        }).filter(Boolean);
        const hits = [];
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i].r, b = boxes[j].r;
            const ov = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
                       Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            if (ov > 16) hits.push(`${boxes[i].id} ↔ ${boxes[j].id} (${Math.round(ov)}px²)`);
          }
        }
        return hits;
      });
      check(`${vp.n} (${vp.w}px): map chrome does not overlap itself`,
            overlaps.length === 0, overlaps.join(', '));
      if (vp.w >= 1280) {
        check(`${vp.n} (${vp.w}px): map is at least 560px wide`, m.mapW >= 560, m.mapW);
      }

      // The legend's collapsed default follows the breakpoint until a PERSON
      // changes it. It used to latch on the first render only, so a window
      // dragged narrow kept the expanded desktop legend — 36% of a 375px
      // viewport, sitting on the markers it exists to explain. This viewport
      // loop resizes an already-loaded page, which is exactly that path.
      if (vp.w <= 768) {
        const lg = await page.evaluate(() => {
          const l = document.getElementById('maplegend');
          if (!l || !l.getClientRects().length) return null;
          return { collapsed: l.dataset.collapsed,
                   pct: Math.round(l.getBoundingClientRect().height / innerHeight * 100) };
        });
        check(`${vp.n} (${vp.w}px): the legend stands down when the viewport shrinks`,
              !lg || (lg.collapsed === 'true' && lg.pct <= 15),
              lg ? `collapsed=${lg.collapsed}, ${lg.pct}% of viewport` : 'no legend');
      }
      await shot(page, `04-responsive-${vp.n}-${vp.w}`);
      await page.close();
    }

    // Print: the chrome goes, the figures and their denominators stay, and the
    // demo banner appears if and ONLY if demo mode is on. A report that wrongly
    // declares its own figures synthetic is as damaging as one that hides that
    // they are.
    const pr = await ctx.newPage();
    await pr.goto(FILE, { waitUntil: 'load' });
    await pr.waitForTimeout(900);
    await pr.evaluate(() => {
      const tri = GEO.data.observed().filter(x => x.name === 'Trilliant')[0];
      GEO.state.set({ selectedId: tri.id, rightRail: 'open', rightTab: 'property',
                      radius: { id: tri.id, km: [1, 3, 5] } }, { source: 'user', action: 'qa' });
      document.documentElement.setAttribute('data-print', 'property');
    });
    await pr.emulateMedia({ media: 'print' });
    await pr.waitForTimeout(400);
    const printed = await pr.evaluate(() => {
      const gone = sel => {
        const e = document.querySelector(sel);
        return !e || getComputedStyle(e).display === 'none';
      };
      const txt = document.body.innerText || '';
      return {
        chromeHidden: ['.hdr', '.rail--left', '.tabbar', '#mapchrome', '#toasts'].every(gone),
        propertyVisible: !gone('#pane-property'),
        keepsDenominators: /Based on \d+ of \d+/.test(txt),
        keepsCollectionDate: /19 Jul 2026/.test(txt),
        demoBannerOff: gone('#demobar'),
      };
    });
    check('print: interface chrome is hidden', printed.chromeHidden);
    check('print: the property analysis is kept', printed.propertyVisible);
    check('print: denominators survive onto paper', printed.keepsDenominators);
    check('print: the collection date is on the page', printed.keepsCollectionDate);
    check('print: no demo banner when demo mode is off', printed.demoBannerOff);

    const demoPrinted = await pr.evaluate(() => {
      GEO.data.setDemoMode(true);
      GEO.state.set({ demoMode: true }, { source: 'user', action: 'qa' });
      const shown = getComputedStyle(document.getElementById('demobar')).display !== 'none';
      GEO.data.setDemoMode(false);
      GEO.state.set({ demoMode: false }, { source: 'user', action: 'qa' });
      return shown;
    });
    check('print: the demo banner DOES print when demo mode is on', demoPrinted === true);
    await pr.close();

    const rm = await ctx.newPage();
    await rm.emulateMedia({ reducedMotion: 'reduce' });
    await rm.goto(FILE, { waitUntil: 'load' });
    await rm.waitForTimeout(700);
    const durations = await rm.evaluate(() =>
      Array.from(document.querySelectorAll('.rail, .btn, .overlay, .app__body'))
        .map(el => getComputedStyle(el).transitionDuration)
        .filter(d => d && d !== '0s')
        .filter(d => parseFloat(d) > 0.05));
    check('prefers-reduced-motion removes transitions', durations.length === 0,
          durations.slice(0, 4).join(', '));
    await rm.close();
  }

  await browser.close();

  /* ───────────────────────── report ───────────────────────── */
  const failed = results.filter(r => !r.pass);
  const byGroup = {};
  results.forEach(r => {
    byGroup[r.group] = byGroup[r.group] || { pass: 0, fail: 0 };
    byGroup[r.group][r.pass ? 'pass' : 'fail']++;
  });

  console.log('\n' + '─'.repeat(72));
  Object.keys(byGroup).forEach(g => {
    const s = byGroup[g];
    console.log(`  ${g.padEnd(28)} ${String(s.pass).padStart(3)} passed  ${s.fail ? `\x1b[31m${s.fail} failed\x1b[0m` : '0 failed'}`);
  });
  console.log('─'.repeat(72));
  console.log(`  TOTAL ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('\nFAILURES:');
    failed.forEach(f => console.log(`  ✕ [${f.group}] ${f.name}${f.detail ? '\n      ' + f.detail : ''}`));
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify({ results, byGroup }, null, 1));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
