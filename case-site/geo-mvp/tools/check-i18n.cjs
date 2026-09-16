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

const used = new Map();   // key -> [files]
for (const f of fs.readdirSync(path.join(R, 'src/js')).sort()) {
  if (!f.endsWith('.js') || f === '01-i18n.js') continue;
  const src = fs.readFileSync(path.join(R, 'src/js', f), 'utf8');
  // t('key'), t("key"), GEO.i18n.t('key') — only literal keys can be checked, which
  // is the point: a computed key is invisible to this audit, so modules should avoid one.
  for (const m of src.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(f);
  }
}

const missing = [...used.keys()].filter(k => !(k in en)).sort();
const unused = Object.keys(en).filter(k => !used.has(k)).sort();

console.log(`table: ${Object.keys(en).length} keys   referenced: ${used.size}   ` +
            `missing: ${missing.length}   unreferenced: ${unused.length}`);

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
  const marker = /(\n\s*\};\s*\n)(?=[\s\S]*I\.ru|[\s\S]*i18n\.ru)/;
  const at = src.indexOf('\n  };', src.indexOf('I.en = {') >= 0 ? src.indexOf('I.en = {') : 0);
  if (at < 0) {
    console.error('\ncheck-i18n --fix: could not find the end of the English table; add the keys by hand.');
    process.exit(2);
  }
  src = src.slice(0, at) + '\n' + block + src.slice(at);
  fs.writeFileSync(I18N, src);
  console.log(`\nappended ${missing.length} stub keys to ${path.relative(R, I18N)} — review the wording.`);
  process.exit(0);
}

process.exit(missing.length ? 1 : 0);
