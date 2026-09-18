/**
 * Intent-parser tests — every example the brief gives, plus Russian.
 *
 * Runs in plain node with a minimal host, so a parser regression is caught in a
 * second without launching a browser. Covers §54's ten required commands, all
 * eight §63 assistant tests, the §41 map-control examples, and the §62
 * unsupported-concept refusals.
 *
 *   node tools/test-intents.cjs
 */
const fs = require('fs');
const path = require('path').resolve(__dirname, '..') + '/';
const seed = JSON.parse(fs.readFileSync(path + 'data/seed.json', 'utf8'));

// Minimal host: the parser only needs schema enums, the district list and the filter shape.
global.window = { GEO: {
  log: { warn(){}, info(){}, error(){} },
  storage: { get: (k,d)=>d, set(){} },
  data: { districts: () => seed.districts },
  state: { defaults: () => ({ filters: {
    q:'', districts:[], classes:[], includeUnknownClass:true, statuses:[],
    glaMin:null, glaMax:null, rentMin:null, rentMax:null,
    vacancyMin:null, vacancyMax:null, parkingMin:null,
    amenities:[], confidence:[], completeness:[], freshness:[], flags:[] } }) },
  ai: {},
  geo: { COMPETITIVE_BAND_KM: 3, DEFAULT_BANDS_KM: [1,3,5] },
} };
require(path + 'src/js/02-schema.js');
require(path + 'src/js/21-ai-intents.js');
const I = global.window.GEO.ai.intents;

const CASES = [
  // §54
  ['Show Class A business centers.',                          'filter',        s => (s.filters.classes||[]).join()==='A'],
  ['Show Class A and A+ business centres',                    'filter',        s => (s.filters.classes||[]).sort().join()==='A,A+'],
  ['Show offices in Mirabad.',                                'filter',        s => (s.filters.districts||[]).join()==='mirobod'],
  ['Show buildings larger than 5,000 m2.',                    'filter',        s => s.requiredFields.includes('gla')],
  ['Show low-confidence properties.',                         'data_quality',  null],
  ['Show properties not verified recently.',                  'verification',  null],
  ['Compare these properties.',                               'compare',       null],
  ['Find competitors around this building.',                  'competitors',   null],
  ['Show office supply by district.',                         'rank_districts',null],
  ['Show average known rent by district.',                    'rank_districts',s => s.measure==='askingRent'],
  ['Clear all layers.',                                       'clear_analysis',null],
  // §63
  ['Only buildings above 5,000 m2',                           'filter',        s => s.narrowing && s.requiredFields.includes('gla')],
  ['Only those with known rent above $30',                    'filter',        s => s.narrowing && s.filters.rentMin===30],
  ['Which district has the most known Class A GLA?',          'rank_districts',s => s.measure==='gla'],
  ['Which district has the most Class A and A+ offices?',     'rank_districts',s => !s.measure],
  ['Show its competitors within 3 km',                        'competitors',   s => s.radiusKm===3],
  ['Show properties with poor data quality',                  'data_quality',  null],
  ['Which buildings need data verification?',                 'verification',  null],
  ['Compare the three largest properties currently on the map','compare',      s => s.rankBy==='gla' && s.count===3],
  ['Compare the three highest known asking rents',            'compare',       s => s.rankBy==='askingRent' && s.count===3],
  ['Remove this analysis and return to all business centers',  'clear_analysis',null],
  // §41
  ['Show business centers with rent above $30/m2',            'filter',        s => s.filters.rentMin===30],
  ['Create a 5 km competitor zone around this property',      'competitors',   s => s.radiusKm===5],
  ['Show buildings currently under construction',             'filter',        s => (s.filters.statuses||[]).includes('Under construction')],
  ['Show only properties with more than 2,000 m2 available',  'filter',        s => s.requiredFields.includes('availableArea')],
  // §62 unsupported
  ['Which office cluster has the highest employee density?',  'unsupported',   s => s.concept==='employeeDensity'],
  ['Show me footfall around Trilliant',                       'unsupported',   s => s.concept==='footfall'],
  ['Which business centres are near a metro station?',        'unsupported',   s => s.concept==='metro'],
  ['What will rents be next year?',                           'unsupported',   s => s.concept==='forecast'],
  ['What is the catchment population within 3 km?',           'unsupported',   s => s.concept==='demographics'],
  // Russian
  ['Покажи офисы класса A',                                   'filter',        s => (s.filters.classes||[]).join()==='A'],
  ['Какие здания нужно перепроверить?',                       'verification',  null],
  ['Сбросить все слои',                                       'clear_analysis',null],
  // misc
  ['Find Trilliant',                                          'find_property', s => /trilliant/i.test(s.query)],
  ['Show data coverage',                                      'coverage',      null],
  ['Export these results',                                    'export',        null],
  ['Show the largest office clusters',                        'clusters',      null],
  ['asdfgh qwerty',                                           'unknown',       null],
];

let pass = 0, fail = 0;
for (const [utt, wantIntent, extra] of CASES) {
  const plan = I.interpret(utt, { selectedId: 'BC-82f0eb0b80b7', state: {} });
  const intentOk = plan.intent === wantIntent;
  const extraOk = !extra || !!extra(plan);
  if (intentOk && extraOk) { pass++; console.log(`  ✓ ${utt}`); }
  else {
    fail++;
    console.log(`  ✕ ${utt}\n      got intent="${plan.intent}" want="${wantIntent}"${intentOk && !extraOk ? '  (slots wrong)' : ''}`);
    console.log('      ' + JSON.stringify({filters: plan.filters, required: plan.requiredFields, measure: plan.measure,
                  rankBy: plan.rankBy, count: plan.count, radiusKm: plan.radiusKm, narrowing: plan.narrowing,
                  concept: plan.concept, query: plan.query}));
  }
}
console.log(`\n${pass}/${CASES.length} intent cases pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
