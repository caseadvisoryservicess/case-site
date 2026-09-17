#!/usr/bin/env node
/**
 * i18n key audit.
 *
 * Every user-visible string goes through `t('key')` (brief §27, contract D14), and
 * `t()` returns the key itself when it is missing — which is a visible defect, not a
 * crash, so it will not announce itself. This finds the gaps.
 *
 *   node tools/check-i18n.cjs            report missing and unused keys
 *   node tools/check-i18n.cjs --fix      append a stub for every missing key
 *
 * `--fix` writes a clearly-marked block at the end of the English table so the gaps
 * are visible and fixable by hand, rather than silently papered over.
 */
const fs = require('fs');
const path = require('path');

const R = path.resolve(__dirname, '..');
const I18N = path.join(R, 'src/js/01-i18n.js');

global.window = {
  GEO: { log: { warn() {}, info() {}, error() {} },
         storage: { get: (k, d) => d, set() {} } },
};
require(I18N);
const en = global.window.GEO.i18n.en;

// A panel may ship its own defaults and write them into `GEO.i18n.en` at load
// (`if (!GEO.i18n.has(k)) GEO.i18n.en[k] = ADDED[k]`), which keeps ONE table at
// runtime while letting a module carry the copy it owns. Statically, those keys
// look missing. Collect every `'a.b.c': '…'` literal pair from the modules and
// treat them as defined — over-approximating here is safe, because the runtime
// probe in qa.cjs is what actually proves nothing leaks to the screen.
const declared = new Set();
for (const f of fs.readdirSync(path.join(R, 'src/js')).sort()) {
  if (!f.endsWith('.js') || f === '01-i18n.js') continue;
  const src = fs.readFileSync(path.join(R, 'src/js', f), 'utf8');
  for (const m of src.matchAll(/^\s*['"]([a-z][\w]*(?:\.[\w]+)+)['"]\s*:\s*['"]/gm)) {
    declared.add(m[1]);
  }
}

const used = new Map();   // key -> [files]
for (const f of fs.readdirSync(path.join(R, 'src/js')).sort()) {
  if (!f.endsWith('.js') || f === '01-i18n.js') continue;
  const src = fs.readFileSync(path.join(R, 'src/js', f), 'utf8');
  // t('key'), t("key"), GEO.i18n.t('key') — only literal keys can be checked, which
  // is the point: a computed key is invisible to this audit, so modules should avoid one.
  // Two shapes: a direct call `t('a.b')`, and a key stored in a data structure
  // (`labelKey: 'a.b'`) that is passed to t() later. The second shape is how the
  // filter rail declares its controls, and missing it is how two keys reached the
  // rendered page unresolved.
  const patterns = [
    /\bt\(\s*['"]([\w.]+)['"]/g,
    /\b(?:labelKey|titleKey|i18nKey|msgKey|noteKey|reasonKey)\s*:\s*['"]([\w.]+)['"]/g,
  ];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) {
      if (!used.has(m[1])) used.set(m[1], []);
      used.get(m[1]).push(f);
    }
  }
}

// A key ending in '.' is the literal prefix of a key built by concatenation
// (`t('value.confidence.' + level)`). It is never looked up as written, so it is
// reported separately rather than stubbed – the ENUMERATED keys are what matter.
const prefixes = [...used.keys()].filter(k => k.endsWith('.')).sort();
const missing = [...used.keys()]
  .filter(k => !k.endsWith('.') && !(k in en) && !declared.has(k)).sort();
const unused = Object.keys(en).filter(k => !used.has(k)).sort();

console.log(`table: ${Object.keys(en).length} keys   referenced: ${used.size}   ` +
            `missing: ${missing.length}   unreferenced: ${unused.length}   ` +
            `computed prefixes: ${prefixes.length}`);
if (declared.size) {
  console.log(`         ${declared.size} further keys are declared by panels and merged into the table at load`);
}

if (prefixes.length) {
  console.log('\nCOMPUTED KEYS — the enumerated suffixes must exist; this audit cannot check them:');
  for (const k of prefixes) console.log(`  ${k}<suffix>   (${[...new Set(used.get(k))].join(', ')})`);
}

if (missing.length) {
  console.log('\nMISSING — t() will render the key itself:');
  const byFile = {};
  for (const k of missing) for (const f of new Set(used.get(k))) (byFile[f] ||= []).push(k);
  for (const f of Object.keys(byFile).sort()) {
    console.log(`  ${f}`);
    for (const k of byFile[f]) console.log(`      ${k}`);
  }
}

if (process.argv.includes('--fix') && missing.length) {
  // Derive a readable English default from the key's last segments, so the stub is
  // usable immediately and obviously provisional.
  const guess = k => {
    const tail = k.split('.').slice(-2).join(' ');
    const words = tail.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[._]/g, ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  };
  const block = [
    '',
    '  /* ---------------------------------------------------------------------',
    '   * Keys referenced by modules but absent from the table above, added by',
    `   * tools/check-i18n.cjs --fix. Wording is derived from the key and should be`,
    '   * reviewed; they are grouped here rather than merged in so the gaps stay visible.',
    '   * ------------------------------------------------------------------- */',
    ...missing.map(k => `  '${k}': ${JSON.stringify(guess(k))},`),
  ].join('\n');

  let src = fs.readFileSync(I18N, 'utf8');

  // Find the END of the `I.en = { … }` object by matching braces from its opening,
  // ignoring braces inside string literals. Searching for the first `\n  };` finds a
  // nested object instead and splices the stubs into the middle of the table.
  const open = src.indexOf('I.en = {');
  if (open < 0) {
    console.error('\ncheck-i18n --fix: could not find `I.en = {`; add the keys by hand.');
    process.exit(2);
  }
  let i = src.indexOf('{', open), depth = 0, quote = null, close = -1;
  for (; i < src.length; i++) {
    const ch = src[i], prev = src[i - 1];
    if (quote) { if (ch === quote && prev !== '\\') quote = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) {
    console.error('\ncheck-i18n --fix: unbalanced braces in the English table.');
    process.exit(2);
  }

  // The table's last entry may have no trailing comma, in which case appending an
  // entry straight after it is a syntax error.
  const head = src.slice(0, close).replace(/\s+$/, '');
  const needsComma = !/[,{]$/.test(head);
  src = head + (needsComma ? ',' : '') + block + '\n' + src.slice(close);
  fs.writeFileSync(I18N, src);
  console.log(`\nappended ${missing.length} stub keys to ${path.relative(R, I18N)} – review the wording.`);
  process.exit(0);
}

process.exit(missing.length ? 1 : 0);
