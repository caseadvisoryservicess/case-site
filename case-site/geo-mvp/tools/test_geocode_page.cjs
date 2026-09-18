#!/usr/bin/env node
/*
 * Drives qa-out/geocode-check.html in real Chromium with the Yandex Geocoder
 * MOCKED at the network layer, so the page's whole path is exercised – query
 * planning, lon/lat parsing, every verdict, the JSON it offers for download,
 * the fetch->JSONP fallback, HTTP errors, a refused key with and without CORS
 * headers – without a key and without leaving the machine.
 *
 *   python3 tools/geocode_check_page.py && node tools/test_geocode_page.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { execSync } = require('child_process');
const PW = execSync('npm root -g').toString().trim() + '/playwright';   // same resolution as qa.cjs
const { chromium } = require(PW);

const ROOT = path.resolve(__dirname, '..');
const PAGE = 'file://' + path.join(ROOT, 'qa-out', 'geocode-check.html');
const SEED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'seed.json'), 'utf8'));
const RECORDS = SEED.records.filter(r => r.recordType === 'VERIFIED_SOURCE');
const KEY = 'TEST-KEY-0000-never-persisted';

let passed = 0; const failed = [];
function check(name, cond, detail) {
  if (cond) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { failed.push(name); console.log('  \x1b[31m✕\x1b[0m ' + name + (detail ? '  ' + detail : '')); }
}

// The same planning the page does, so the fixture knows which record a query is for.
const CITY = ['tashkent', 'toshkent', 'ташкент', 'тошкент'];
function planFor(r) {
  const addr = (r.address || '').trim();
  if (addr) {
    const bare = addr.toLowerCase().replace(/[^0-9a-zа-яё]+/g, ' ').split(' ').filter(w => w && !CITY.includes(w)).join(' ').trim();
    return bare ? ['forward', addr] : ['skip', 'city'];
  }
  return ['reverse', r.lng + ',' + r.lat];
}
const plan = RECORDS.map(r => ({ r, mode: planFor(r)[0], q: planFor(r)[1] }));
const forward = plan.filter(p => p.mode === 'forward');
const reverse = plan.filter(p => p.mode === 'reverse');
const skipped = plan.filter(p => p.mode === 'skip');
// Three deliberate deviations among the forward records.
const SHIFTED = forward[0].r;     // house 1 km north -> disagree
const STREET = forward[1].r;      // precision street  -> vague
const MISSING = forward[2].r;     // nothing found     -> not_found

const EMPTY = { response: { GeoObjectCollection: { metaDataProperty: { GeocoderResponseMetaData: { found: '0' } }, featureMember: [] } } };
function fixtureFor(params) {
  const q = params.get('geocode');
  const byQuery = plan.find(p => p.q === q);
  if (!byQuery) return EMPTY;
  const r = byQuery.r;
  if (r.id === MISSING.id) return EMPTY;
  let lat = r.lat, precision = 'exact', kind = 'house';
  if (r.id === SHIFTED.id) lat = r.lat + 0.009;
  if (r.id === STREET.id) { precision = 'street'; kind = 'street'; }
  return { response: { GeoObjectCollection: {
    metaDataProperty: { GeocoderResponseMetaData: { found: '1' } },
    featureMember: [{ GeoObject: { Point: { pos: r.lng + ' ' + lat },
      metaDataProperty: { GeocoderMetaData: { precision, kind, text: 'Ташкент, тест, ' + r.name } } } }] } } };
}

const seen = { urls: [], jsonp: 0, fetch: 0 };
async function mock(page, { abortFetch, failNth }) {
  await page.route('https://geocode-maps.yandex.ru/**', route => {
    const u = new URL(route.request().url());
    seen.urls.push(u);
    const cb = u.searchParams.get('callback');
    if (cb) {
      seen.jsonp++;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: cb + '(' + JSON.stringify(fixtureFor(u.searchParams)) + ');' });
    }
    seen.fetch++;
    if (abortFetch) return route.abort('failed');
    if (failNth && seen.fetch === failNth) return route.fulfill({ status: 429, contentType: 'application/json', body: '{"statusCode":429,"error":"Too Many Requests","message":"daily limit"}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureFor(u.searchParams)) });
  });
}

async function runPage(ctx, opts) {
  const page = await ctx.newPage();
  await mock(page, opts);
  await page.goto(PAGE);
  await page.evaluate(() => { CFG.pauseMs = 1; });     // no need to be polite to a mock
  await page.fill('#key', KEY);
  await page.click(opts.limit ? '#btnTest' : '#btnRun');
  await page.waitForFunction(() => !!window.__lastResult, null, { timeout: 120000 });
  const result = await page.evaluate(() => window.__lastResult);
  const status = await page.textContent('#status');
  const storage = await page.evaluate(() => ({ ls: localStorage.length, ss: sessionStorage.length }));
  return { page, result, status, storage };
}

async function saveDownload(page, selector) {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  const p = path.join(os.tmpdir(), 'ygc-test-' + process.pid + '-' + Date.now() + path.extname(dl.suggestedFilename()));
  await dl.saveAs(p);
  const bytes = fs.readFileSync(p); fs.unlinkSync(p);
  return { name: dl.suggestedFilename(), bytes };
}

(async () => {
  console.log('\n\x1b[1mfixture\x1b[0m');
  check('148 records: forward/reverse/skipped = ' + forward.length + '/' + reverse.length + '/' + skipped.length,
        forward.length + reverse.length + skipped.length === 148 && skipped.length === 9);

  const browser = await chromium.launch();
  const ctx = await browser.newContext();

  console.log('\n\x1b[1mfull run, fetch transport\x1b[0m');
  seen.urls.length = 0; seen.jsonp = 0; seen.fetch = 0;
  const A = await runPage(ctx, { abortFetch: false });
  const s = A.result.summary;
  check('requests equal forward + reverse (' + (forward.length + reverse.length) + ')', A.result.requests === forward.length + reverse.length, String(A.result.requests));
  check('agree = forward minus the three deviations', s.agree === forward.length - 3, JSON.stringify(s));
  check('exactly one disagree, one vague, one not_found', s.disagree === 1 && s.vague === 1 && s.not_found === 1, JSON.stringify(s));
  check('every record without an address is a suggestion', s.suggested === reverse.length, JSON.stringify(s));
  check('skipped list carries the nine city-only addresses', A.result.skipped.length === 9);
  const dis = A.result.items.find(i => i.verdict === 'disagree');
  check('the shifted house is the disagree, ~1 km away', dis && dis.id === SHIFTED.id && dis.distanceM > 900 && dis.distanceM < 1100, JSON.stringify(dis && [dis.id, dis.distanceM]));
  const sug = A.result.items.find(i => i.verdict === 'suggested');
  check('a suggestion carries the house text and a distance of 0 m to the pin', sug && sug.yandexText && sug.distanceM === 0, JSON.stringify(sug && [sug.yandexText, sug.distanceM]));
  check('Point.pos "lon lat" landed as lat in 41.x and lng in 69.x', A.result.items.every(i => i.yandexLat == null || (i.yandexLat > 41 && i.yandexLat < 42 && i.yandexLng > 69 && i.yandexLng < 70)));
  check('transport used was fetch, no JSONP needed', A.result.transport === 'fetch' && seen.jsonp === 0, A.result.transport + ' jsonp=' + seen.jsonp);
  const rev = seen.urls.find(u => u.searchParams.get('kind') === 'house');
  check('reverse queries send kind=house with longitude first', rev && /^69\.\d+,41\.\d+$/.test(rev.searchParams.get('geocode')), rev && rev.searchParams.get('geocode'));
  check('every query is boxed to Tashkent with rspn=1', seen.urls.every(u => u.searchParams.get('rspn') === '1' && u.searchParams.get('bbox') === '69.12,41.16~69.42,41.40'));
  const json = JSON.stringify(A.result);
  check('the JSON offered for download never contains the key', !json.includes(KEY));
  check('the key is not in localStorage or sessionStorage', A.storage.ls === 0 && A.storage.ss === 0, JSON.stringify(A.storage));
  check('the result declares itself display-only and non-populating', A.result.storage === 'display' && A.result.mayPopulateDataset === false);
  check('the result names the dataset it ran against', A.result.recordCount === 148 && typeof A.result.seedGeneratedAt === 'string' && A.result.keyTest === false, JSON.stringify([A.result.recordCount, A.result.seedGeneratedAt, A.result.keyTest]));
  check('timestamps use the same +00:00 form as the Python file', /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+00:00$/.test(A.result.startedAt), A.result.startedAt);
  check('status reports completion and asks for the file', /Готово/.test(A.status) && /пришлите/.test(A.status), A.status);
  check('the send note is shown after the full pass', await A.page.$eval('#sendNote', n => !n.classList.contains('hidden')));
  const dlJ = await saveDownload(A.page, '#btnJson');
  check('the JSON button downloads yandex-geocoder-check.json', dlJ.name === 'yandex-geocoder-check.json', dlJ.name);
  check('the downloaded JSON has no BOM and parses', dlJ.bytes[0] === 0x7b && (() => { try { JSON.parse(dlJ.bytes.toString('utf8')); return true; } catch (e) { return false; } })(), dlJ.bytes.slice(0, 4).toString('hex'));
  const dlC = await saveDownload(A.page, '#btnCsv');
  check('the CSV keeps its BOM for Excel', dlC.name === 'yandex-geocoder-check.csv' && dlC.bytes[0] === 0xef && dlC.bytes[1] === 0xbb && dlC.bytes[2] === 0xbf, dlC.bytes.slice(0, 3).toString('hex'));
  const rows = await A.page.$$eval('#rows tr', trs => trs.map(tr => tr.firstElementChild.textContent));
  check('the table puts disagree first and agree last', rows[0] === 'disagree' && rows[rows.length - 1] === 'agree', rows[0] + ' … ' + rows[rows.length - 1]);
  await A.page.close();

  console.log('\n\x1b[1mfive-request key test\x1b[0m');
  const B = await runPage(ctx, { abortFetch: false, limit: true });
  check('the key test sends exactly five requests', B.result.requests === 5, String(B.result.requests));
  check('after the key test the status points to the full pass and does not ask to send', /Полная проверка/.test(B.status) && !/пришлите/.test(B.status), B.status);
  check('the send note is hidden after the key test', await B.page.$eval('#sendNote', n => n.classList.contains('hidden')));
  const dlK = await saveDownload(B.page, '#btnJson');
  check('a key-test download is named as a key test, not as the result', dlK.name === 'yandex-geocoder-key-test.json' && B.result.keyTest === true, dlK.name);
  await B.page.close();

  console.log('\n\x1b[1mHTTP 429 on one request\x1b[0m');
  seen.urls.length = 0; seen.jsonp = 0; seen.fetch = 0;
  const E = await runPage(ctx, { abortFetch: false, limit: true, failNth: 3 });
  const errItem = E.result.items.find(i => i.verdict === 'error');
  check('an HTTP error is recorded on its item with the status and body, the run continues', errItem && /^HTTP 429: /.test(errItem.error) && /daily limit/.test(errItem.error) && E.result.items.length === 5, JSON.stringify(errItem && errItem.error));
  check('…it is not retried through JSONP and does not count as a request', E.result.transport === 'fetch' && seen.jsonp === 0 && E.result.requests === 4 && seen.fetch === 5, 'transport=' + E.result.transport + ' jsonp=' + seen.jsonp + ' requests=' + E.result.requests);
  await E.page.close();

  console.log('\n\x1b[1mfetch blocked: JSONP fallback\x1b[0m');
  seen.urls.length = 0; seen.jsonp = 0; seen.fetch = 0;
  const C = await runPage(ctx, { abortFetch: true, limit: true });
  check('after the first fetch failure the page switches to JSONP and stays there', C.result.transport === 'jsonp' && seen.fetch === 1 && seen.jsonp === 5, 'fetch=' + seen.fetch + ' jsonp=' + seen.jsonp);
  check('…and the five results are still verdicts, not errors', C.result.items.every(i => i.verdict !== 'error'), JSON.stringify(C.result.summary));
  await C.page.close();

  console.log('\n\x1b[1mrefused key, CORS header present\x1b[0m');
  const D = await ctx.newPage();
  await D.route('https://geocode-maps.yandex.ru/**', route => route.fulfill({ status: 403, contentType: 'application/json', body: '{"statusCode":403,"error":"Forbidden","message":"Invalid api key"}' }));
  await D.goto(PAGE); await D.fill('#key', KEY); await D.click('#btnRun');
  await D.waitForFunction(() => !!window.__lastResult, null, { timeout: 60000 });
  const dRes = await D.evaluate(() => window.__lastResult);
  const dStatus = await D.textContent('#status');
  check('a 403 stops after the first request with a message naming the product and Yandex\'s reply', dRes.requests === 0 && dRes.items.length === 1 && /отклонил ключ/.test(dStatus) && /Геокодера/.test(dStatus) && /Invalid api key/.test(dStatus), dStatus);
  check('…nothing is offered for download when no request succeeded', await D.$eval('#resultCard', n => n.classList.contains('hidden')));
  await D.close();

  console.log('\n\x1b[1mrefused key, NO CORS header (a real local server, no interception)\x1b[0m');
  // route.fulfill always adds Access-Control-Allow-Origin, so this case needs a real
  // server that omits it: from a file:// page fetch then fails at the network level.
  const server = http.createServer((req, res) => { res.writeHead(403, { 'content-type': 'application/json' }); res.end('{"statusCode":403,"error":"Forbidden","message":"Invalid api key"}'); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const F = await ctx.newPage();
  await F.goto(PAGE);
  await F.evaluate(p => { CFG.endpoint = 'http://127.0.0.1:' + p + '/1.x/'; CFG.pauseMs = 1; }, port);
  await F.fill('#key', KEY); await F.click('#btnRun');
  await F.waitForFunction(() => !!window.__lastResult, null, { timeout: 60000 });
  const fRes = await F.evaluate(() => window.__lastResult);
  const fStatus = await F.textContent('#status');
  const fLink = await F.$eval('#firstLink', a => a.getAttribute('href')).catch(() => null);
  check('the page stops after the first request and names BOTH causes, key and network', fRes.requests === 0 && fRes.items.length === 1 && /отклонил ключ/.test(fStatus) && /не дошёл/.test(fStatus), fStatus);
  check('…and offers a link to the first request so the person can see Yandex\'s reply', !!fLink && fLink.includes('127.0.0.1:' + port) && fLink.includes('geocode='), String(fLink));
  check('…while the JSON it would offer still carries no key', !JSON.stringify(fRes).includes(KEY));
  await F.close();
  server.close();

  await browser.close();
  console.log('\n' + '─'.repeat(62));
  console.log('  ' + passed + ' passed, ' + failed.length + ' failed');
  if (failed.length) { failed.forEach(f => console.log('    ✕ ' + f)); process.exit(1); }
})().catch(e => { console.error(e); process.exit(1); });
