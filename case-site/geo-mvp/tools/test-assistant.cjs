/**
 * Assistant end-to-end tests — the eight §63 scenarios plus §62 refusals.
 *
 * Runs the real engine, tool registry and state store in plain node, with only
 * the DOM-facing pieces stubbed. The point is to prove the BEHAVIOUR the brief
 * cares about: that every answer carries its six blocks and its denominators,
 * that context carries between turns, and — most importantly — that a question
 * the data cannot support is refused rather than answered from something nearby.
 *
 *   node tools/test-assistant.cjs
 */
const fs = require('fs');
const R = require('path').resolve(__dirname, '..') + '/';

global.window = { GEO: {}, performance: { now: () => 0 } };
for (const f of ['00-core','01-i18n','02-schema','03-data','08-analytics','09-geo',
                 '04-quality','05-state','06-filters','07-search','20-ai-tools',
                 '21-ai-intents','22-ai-engine'])
  require(R + 'src/js/' + f + '.js');

const GEO = global.window.GEO;
GEO.boot = { download() {}, toast() {} };          // DOM-facing; not under test here
GEO.map = { zoomTo() {} };
GEO.data.load(JSON.parse(fs.readFileSync(R + 'data/seed.json', 'utf8')),
              JSON.parse(fs.readFileSync(R + 'data/tashkent_districts.simplified.geojson', 'utf8')));
GEO.search.buildIndex(GEO.data.observed());

let pass = 0, fail = 0;
const T = (name, cond, detail) => { cond ? pass++ : fail++;
  console.log(`  ${cond ? '✓' : '✕'} ${name}${cond ? '' : '\n      → ' + detail}`); };

const SIX = ['answer','analysis','mapActions','dataCoverage','limitations','sources'];
function ask(q) {
  const r = GEO.ai.ask(q);
  T(`[blocks] "${q.slice(0,42)}" carries all six §46 blocks`,
    SIX.every(k => k in r), SIX.filter(k => !(k in r)).join(', '));
  return r;
}
const st = () => GEO.state.get();

console.log('\n── AI-1  Show Class A and A+ business centres');
let r = ask('Show Class A and A+ business centres');
T('applies the class filter to shared state (§59)',
  JSON.stringify((st().filters.classes || []).slice().sort()) === '["A","A+"]', JSON.stringify(st().filters));
T('returns 12', r.resultCount === 12, r.resultCount);
T('creates a layer', st().aiLayers.length === 1, JSON.stringify(st().aiLayers.map(l => l.name)));
T('states coverage with real numbers', /16 of 148/.test(r.dataCoverage), r.dataCoverage);
T('says what the 132 unclassified records mean',
  r.limitations.some(l => /132/.test(l)), JSON.stringify(r.limitations));
T('cites the source', r.sources.length > 0 && /2GIS/.test(r.sources.join(' ')), JSON.stringify(r.sources));

console.log('\n── AI-2a  Only buildings above 5,000 m2   (the anti-hallucination test)');
r = ask('Only buildings above 5,000 m2');
T('refuses rather than inventing a size filter', r.unavailable === true, r.answer);
T('names GLA as the missing field', /GLA/i.test(r.answer), r.answer);
T('leaves the previous selection intact at 12',
  r.resultCount === 12 && JSON.stringify((st().filters.classes||[]).slice().sort()) === '["A","A+"]',
  `${r.resultCount} / ${JSON.stringify(st().filters.classes)}`);
T('offers something answerable instead', (r.suggestions || []).length > 0, JSON.stringify(r.suggestions));

console.log('\n── AI-2b  Only those with known rent above $30   (real narrowing)');
r = ask('Only those with known rent above $30');
T('narrows 12 → 7', r.resultCount === 7, r.resultCount);
T('keeps the class context (§58)',
  JSON.stringify((st().filters.classes||[]).slice().sort()) === '["A","A+"]', JSON.stringify(st().filters.classes));
T('the rent filter is visible in shared state', st().filters.rentMin === 30, st().filters.rentMin);

console.log('\n── AI-3a  Which district has the most known Class A GLA?');
GEO.state.clearAnalysis({ source:'user', action:'reset' });
r = ask('Which district has the most known Class A GLA?');
T('refuses a GLA ranking', r.unavailable === true, r.answer);
T('produces no table or chart', !r.table && !r.chart, JSON.stringify({table: !!r.table, chart: !!r.chart}));

console.log('\n── AI-3b  Which district has the most Class A and A+ offices?');
r = ask('Which district has the most Class A and A+ offices?');
T('answers', r.unavailable !== true, r.answer);
T('names Yunusobod as the outright top', /yunusobod/i.test(r.answer), r.answer);
T('returns a ranked table', !!r.table && r.table.rows.length > 0, JSON.stringify(r.table && r.table.columns));
T('discloses the districts with zero records',
  r.limitations.some(l => /Bektemir|Yangihayot/i.test(l)), JSON.stringify(r.limitations));

console.log('\n── AI-4  Show its competitors within 3 km   (pronoun resolution)');
GEO.state.clearAnalysis({ source:'user', action:'reset' });
r = GEO.ai.ask('Show its competitors within 3 km');
T('errors clearly when nothing is selected',
  !!r.answer && /select/i.test(r.answer + (r.limitations||[]).join(' ')), r.answer);
const tri = GEO.data.observed().filter(x => x.name === 'Trilliant')[0];
GEO.state.set({ selectedId: tri.id }, { source:'user', action:'qa' });
r = ask('Show its competitors within 3 km');
T('resolves "its" to the selected property', /Trilliant/.test(r.answer), r.answer);
T('reports 74 within 3 km', /74/.test(r.answer), r.answer);
T('separates 9 qualified from 63 unqualified', /\b9\b/.test(r.answer) && /63/.test(r.answer), r.answer);
T('draws the rings', !!st().radius, JSON.stringify(st().radius));
T('states the distance method', r.limitations.some(l => /haversine/i.test(l)), JSON.stringify(r.limitations));

console.log('\n── AI-5  Show properties with poor data quality');
r = ask('Show properties with poor data quality');
T('pivots to completeness, which discriminates', /132 of 148/.test(r.answer), r.answer);
T('creates an inspectable layer',
  st().aiLayers.length > 0 && !!st().aiLayers[st().aiLayers.length-1].criteriaHuman,
  JSON.stringify(st().aiLayers.map(l => l.name)));

console.log('\n── AI-6  Which buildings need data verification?');
r = ask('Which buildings need data verification?');
T('produces a ranked queue', !!r.table && r.table.rows.length > 0, r.answer);
T('admits staleness cannot discriminate yet',
  r.limitations.some(l => /same day|one collection date|collected on the same/i.test(l)),
  JSON.stringify(r.limitations));
T('refuses to create field tasks without a backend',
  r.limitations.some(l => /backend/i.test(l)), JSON.stringify(r.limitations));

console.log('\n── AI-7a/b  Compare');
GEO.state.clearAnalysis({ source:'user', action:'reset' });
r = ask('Compare the three largest properties currently on the map');
T('refuses "largest" with no size data', r.unavailable === true, r.answer);
r = ask('Compare the three highest known asking rents');
T('compares exactly three', st().compare.length === 3, st().compare.length);
T('picks Trilliant, Nest one, Forum',
  st().compare.map(id => GEO.data.get(id).name).sort().join('|') ===
  ['Forum Business Center','Nest one','Trilliant'].join('|'),
  JSON.stringify(st().compare.map(id => GEO.data.get(id).name)));
// The ANSWER must not rank; the limitations block is where we say we deliberately don't.
T('declares no winner', !/\bwinner\b|\bbest\b|\bwins\b/i.test(r.answer), r.answer);
T('and says so explicitly', r.limitations.some(l => /does not declare a winner/i.test(l)),
  JSON.stringify(r.limitations));

console.log('\n── AI-8  Remove this analysis and return to all business centres');
r = ask('Remove this analysis and return to all business centres');
T('clears every layer', st().aiLayers.length === 0, st().aiLayers.length);
T('clears the rings', st().radius === null, JSON.stringify(st().radius));
T('resets the filters', (st().filters.classes||[]).length === 0 && st().filters.rentMin === null);
T('deselects the property', !st().selectedId, st().selectedId);
T('keeps the session log (reset clears state, not history)',
  GEO.state.sessionLog().length > 0, GEO.state.sessionLog().length);
r = GEO.ai.ask('Only those with known rent above $30');
T('context is reset – the next turn runs against all 148, not the previous 7',
  r.resultCount === 8, r.resultCount);

console.log('\n── §62  concepts the data cannot support');
[['Which office cluster has the highest employee density?', /employee|occupancy|workforce/i],
 ['Show me footfall around Trilliant', /pedestrian|footfall|mobile/i],
 ['Which business centres are near a metro station?', /metro/i],
 ['What is the catchment population within 3 km?', /population/i],
 ['What will rents be next year?', /historical|time series/i]].forEach(([q, re]) => {
  const x = GEO.ai.ask(q);
  T(`refuses "${q.slice(0,38)}…"`, x.unavailable === true, x.answer);
  T(`  …and says what would be required`,
    re.test((x.limitations||[]).join(' ')), JSON.stringify(x.limitations));
});

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
