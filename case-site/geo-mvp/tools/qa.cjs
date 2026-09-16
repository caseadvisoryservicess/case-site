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

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: false });
}

/** Attach console/network listeners. Anything logged here is a §66 failure. */
function watch(page) {
  const errors = [], failed = [], warnings = [];
  page.on('console', m => {
    // The prototype is tested offline on purpose, so a failed tile fetch is the
    // designed state, not a defect. Everything else is.
    const t = m.text();
    if (/ERR_INTERNET_DISCONNECTED|ERR_NAME_NOT_RESOLVED|tile\.openstreetmap/.test(t)) return;
    if (m.type() === 'error') errors.push(t);
    if (m.type() === 'warning') warnings.push(t);
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', r => {
    const u = r.url();
    // Tile requests are expected to fail with no network; that is a designed state.
    if (/tile\.openstreetmap\.org/.test(u)) return;
    failed.push(u + ' — ' + (r.failure() && r.failure().errorText));
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
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(1500);

    check('page loads from file://', await page.title() !== '');
    check('no console errors', w.errors.length === 0, w.errors.slice(0, 4).join(' | '));
    check('no failed local requests (broken image/asset paths)',
          w.failed.length === 0, w.failed.slice(0, 4).join(' | '));

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
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

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
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

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
    const page = await ctx.newPage();
    const w = watch(page);
    await page.goto(FILE, { waitUntil: 'load' });
    await page.waitForTimeout(1200);

    // §29 — no control may be inert. Every visible, enabled button must either carry
    // a handler-bearing id/data hook, or be disabled with a reason the user can read.
    const controls = await page.evaluate(() => {
      const vis = el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const all = Array.from(document.querySelectorAll('button, [role="button"], a[href]')).filter(vis);
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
    check(`§29: ${controls.total} controls, ${controls.disabled} disabled — every disabled one gives a reason`,
          controls.unexplained.length === 0, controls.unexplained.join(', '));
    check('§29: no anonymous unwired control', controls.anonymous.length === 0,
          controls.anonymous.join(', '));

    // X-12 — the product name lives in exactly one constant (§8: not "ZAKY").
    const naming = await page.evaluate(() => ({
      product: GEO.PRODUCT.name,
      provisional: GEO.PRODUCT.provisional,
      header: (document.getElementById('product-name') || {}).textContent,
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
      if (vp.w >= 1280) {
        check(`${vp.n} (${vp.w}px): map is at least 560px wide`, m.mapW >= 560, m.mapW);
      }
      await shot(page, `04-responsive-${vp.n}-${vp.w}`);
      await page.close();
    }

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
