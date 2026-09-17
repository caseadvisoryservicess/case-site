#!/usr/bin/env bash
# Everything that can say "this is still correct", in one command.
#
#   bash tools/verify.sh          static checks + unit tests + browser QA
#   bash tools/verify.sh --quick  skip the browser run
#
# Exits non-zero on the first failure so it is usable as a pre-commit gate.
set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
step() {
  printf '\n\033[1m── %s\033[0m\n' "$1"
}
run() {
  if "$@"; then return 0; fi
  printf '\033[31m   FAILED: %s\033[0m\n' "$*"
  fail=1
}

step "JavaScript syntax"
for f in src/js/*.js tools/*.cjs; do
  node --check "$f" >/dev/null 2>&1 || { echo "   syntax error in $f"; fail=1; }
done
[ "$fail" = 0 ] && echo "   all modules parse"

step "Seed dataset is reproducible from the source"
# Rebuilds seed.json from the CASE source data and fails if it differs, so a hand
# edit to the shipped dataset cannot go unnoticed.
cp data/seed.json /tmp/seed.before.json 2>/dev/null
run python3 tools/build_seed.py
if ! diff -q /tmp/seed.before.json data/seed.json >/dev/null 2>&1; then
  echo "   NOTE: seed.json changed — the ETL and the shipped file had drifted apart."
  fail=1
fi

step "Oracle (independent Python implementation of every metric)"
run python3 tools/oracle.py

step "Intent parser — every §54, §63, §41 and §62 example"
run node tools/test-intents.cjs

step "Filter engine against the oracle"
run node tools/test-filters.cjs

step "Search — script folding and district aliases"
run node tools/test-search.cjs

step "Assistant — the eight §63 scenarios and the §62 refusals"
run node tools/test-assistant.cjs

step "Ingestion: matching, the four per-field outcomes, the licence gate"
run python3 tools/test_merge.py

step "i18n key audit"
run node tools/check-i18n.cjs

step "District labels against the boundary polygons"
run python3 tools/etl_districts_check.py

step "Assembled file is current"
run python3 build.py --check

if [ "${1:-}" != "--quick" ]; then
  step "Browser QA (Chromium, file://)"
  run node tools/qa.cjs
fi

printf '\n'
if [ "$fail" = 0 ]; then
  printf '\033[32m✓ everything passed\033[0m\n'
else
  printf '\033[31m✕ something failed — see above\033[0m\n'
fi
exit "$fail"
