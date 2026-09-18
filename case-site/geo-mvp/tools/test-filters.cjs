/**
 * Filter-engine tests against the oracle.
 *
 * Runs the real modules in plain node — no browser — so a regression in the
 * arithmetic that every screen depends on is caught in a second. Expected values
 * come from tools/oracle.py, an independent Python implementation.
 *
 *   node tools/test-filters.cjs
 */
const fs = require('fs');
const R = require('path').resolve(__dirname, '..') + '/';
global.window={GEO:{}};
for (const f of ['00-core','01-i18n','02-schema','03-data','08-analytics','09-geo','04-quality','05-state','06-filters'])
  require(R+'src/js/'+f+'.js');
const GEO=global.window.GEO;
GEO.data.load(JSON.parse(fs.readFileSync(R+'data/seed.json','utf8')),
              JSON.parse(fs.readFileSync(R+'data/tashkent_districts.simplified.geojson','utf8')));
const obs=GEO.data.observed(), F=GEO.filters, D=GEO.state.defaults().filters;
const f=p=>Object.assign({},D,p);
let pass=0,fail=0;
const T=(name,got,want)=>{ const ok=JSON.stringify(got)===JSON.stringify(want);
  ok?pass++:fail++; console.log(`  ${ok?'✓':'✕'} ${name}${ok?'':`  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`); };

console.log('API:', Object.keys(F).join(', '));
T('no filters -> 148', F.apply(obs,D).length, 148);
T('class A + A+ -> 12', F.apply(obs,f({classes:['A','A+']})).length, 12);
T('class A -> 8', F.apply(obs,f({classes:['A']})).length, 8);
T('rentMax 29.99 -> 8', F.apply(obs,f({rentMax:29.99})).length, 8);
T('rentMin 30 -> 8', F.apply(obs,f({rentMin:30})).length, 8);
T('district mirobod -> 28', F.apply(obs,f({districts:['mirobod']})).length, 28);
T('district yangihayot -> 0', F.apply(obs,f({districts:['yangihayot']})).length, 0);
T('class A + mirobod -> 3', F.apply(obs,f({classes:['A'],districts:['mirobod']})).length, 3);
T('gla >= 5000 (0 coverage) -> 0', F.apply(obs,f({glaMin:5000})).length, 0);
T('flags districtConflict -> 10', F.apply(obs,f({flags:['districtConflict']})).length, 10);
T('completeness none -> 132', F.apply(obs,f({completeness:['none']})).length, 132);

const av = F.availability(obs);
const g = k => av.filter(a=>a.key===k)[0];
T('gla filter unavailable', g('gla') && g('gla').available, false);
T('gla has a reason', !!(g('gla')&&g('gla').reason), true);
T('askingRent filter available', g('askingRent') && g('askingRent').available, true);
console.log('  disabled filters:', av.filter(a=>!a.available).map(a=>a.key).join(', '));

const ex = F.explain(obs, f({classes:['A','A+']}));
console.log('  explain(classes) keys:', Object.keys(ex.excludedBy||{}).join(', '), '| kept', ex.kept);
console.log('  describe:', JSON.stringify(F.describe(f({classes:['A','A+'],districts:['mirobod']}))));
const h = F.toHash(f({classes:['A','A+'],districts:['mirobod'],rentMin:30}));
console.log('  hash:', h);
const back = F.fromHash(h);
T('hash round-trips classes', back.classes.sort(), ['A','A+']);
T('hash round-trips districts', back.districts, ['mirobod']);
T('hash round-trips rentMin', back.rentMin, 30);
T('unknown hash keys ignored', typeof F.fromHash('zzz=1'), 'object');
const r = F.ranges(obs);
console.log('  ranges.askingRent:', JSON.stringify(r.askingRent), ' ranges.gla:', JSON.stringify(r.gla));
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail?1:0);
