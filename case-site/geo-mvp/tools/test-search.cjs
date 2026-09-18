/**
 * Search tests (§18, build contract T9).
 *
 * The hard cases are real and measured: 100 of 109 addresses are Cyrillic, the
 * district keys are Latin, and one record's name contains a Cyrillic "С"
 * masquerading as a Latin "C". A naive indexOf fails all of them silently.
 *
 *   node tools/test-search.cjs
 */
const fs = require('fs');
const R = require('path').resolve(__dirname, '..') + '/';
global.window = { GEO: {} };
for (const f of ['00-core','01-i18n','02-schema','03-data','08-analytics','09-geo','04-quality','05-state','06-filters','07-search'])
  require(R + 'src/js/' + f + '.js');
const GEO = global.window.GEO;
GEO.data.load(JSON.parse(fs.readFileSync(R + 'data/seed.json', 'utf8')),
              JSON.parse(fs.readFileSync(R + 'data/tashkent_districts.simplified.geojson', 'utf8')));
const obs = GEO.data.observed();
const S = GEO.search;
if (S.buildIndex) S.buildIndex(obs);

let pass = 0, fail = 0;
const T = (name, cond, detail) => { cond ? pass++ : fail++;
  console.log(`  ${cond ? '✓' : '✕'} ${name}${cond ? '' : '   ' + (detail === undefined ? '' : detail)}`); };

console.log('API:', Object.keys(S).join(', '), '\n');

const q = (s, n) => S.query(obs, s, { limit: n || 8 });
const names = r => r.items.map(i => i.record.name);

// The Cyrillic-С homoglyph record
const cyrC = obs.filter(r => /^Infinity Business/.test(r.name))[0];
T('the homoglyph record exists in the data',
  !!cyrC && /С/.test(cyrC.name), cyrC && JSON.stringify(cyrC.name));
T('Latin "Infinity Business Center" finds the Cyrillic-С record',
  names(q('Infinity Business Center', 10)).some(n => /^Infinity Business/.test(n)),
  JSON.stringify(names(q('Infinity Business Center', 10))));

T('"trilliant" finds Trilliant', names(q('trilliant')).indexOf('Trilliant') >= 0);
T('"Бизнес" finds Cyrillic-named records', q('Бизнес', 20).total > 0, q('Бизнес', 20).total);
T('"Biznes" also finds them', q('Biznes', 20).total > 0, q('Biznes', 20).total);

const dk = s => (q(s).districts || []).map(d => d.key);
T('"Mirabad" resolves to the mirobod district', dk('Mirabad').indexOf('mirobod') >= 0, JSON.stringify(dk('Mirabad')));
T('"Mirobod" resolves to the mirobod district', dk('Mirobod').indexOf('mirobod') >= 0, JSON.stringify(dk('Mirobod')));
T('"Мирабад" resolves to the mirobod district', dk('Мирабад').indexOf('mirobod') >= 0, JSON.stringify(dk('Мирабад')));
T('"Yunusabad" resolves to yunusobod', dk('Yunusabad').indexOf('yunusobod') >= 0, JSON.stringify(dk('Yunusabad')));
T('"Chilanzar" resolves to chilonzor', dk('Chilanzar').indexOf('chilonzor') >= 0, JSON.stringify(dk('Chilanzar')));

T('address search works (Cyrillic street)', q('Шевченко', 10).total > 0, q('Шевченко', 10).total);
T('exact name outranks a substring match',
  names(q('Orient', 5))[0] === 'Orient', JSON.stringify(names(q('Orient', 5))));
T('limit is honoured but total is truthful',
  q('business', 3).items.length <= 3 && q('business', 3).total >= q('business', 3).items.length,
  JSON.stringify({ shown: q('business', 3).items.length, total: q('business', 3).total }));
T('an empty query returns nothing rather than everything', q('', 10).items.length === 0);
T('gibberish returns nothing', q('zzzqqq', 10).items.length === 0);
T('matchesRecord agrees with query',
  typeof S.matchesRecord === 'function' && S.matchesRecord(obs.filter(r => r.name === 'Trilliant')[0], 'trilli'));

// The search box and the q filter must never disagree (one folding implementation).
const viaFilter = GEO.filters.apply(obs, Object.assign({}, GEO.state.defaults().filters, { q: 'trilliant' }));
T('the q filter finds the same record as the search box',
  viaFilter.length >= 1 && viaFilter.some(r => r.name === 'Trilliant'),
  viaFilter.length);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
