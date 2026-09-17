---
name: testing-and-qa
description: Owns QA for the Leasing & Sales Platform (LSP, os/leasing/) in CASE OS style: Node + playwright-core scripts docs/qa/tools/lsp_*.js (static server, 404 on /api/*, Chromium at /opt/pw-browsers), Node logic tests over js/config.js, js/state.js, js/services.js and js/tools.js, the LSP-QA-nnn catalog mapping every §64 flow and §65 check, results JSON in docs/qa/lsp/, the static audit (no secrets, no CASE OS diff, no inline handlers, size budget), the standalone bundle and add-on zip checks, and the final QA report. Use for "QA plan", "run the LSP tests", "add LSP-QA test", "Playwright script", "responsive sweep", "QA report", "regression" or "which checks cover flow 7".
---

## Purpose

00_MASTER_PROMPT.md §65 lists the check-up that must pass before the MVP is declared complete, §64 defines the
twelve user flows, §48 the viewports, and §66 H the QA report deliverable. Brief D10 fixes the tooling: CASE OS
conventions (`docs/qa/tools/*.js`, playwright-core, static server that returns 404 for `/api/*`), results in
`docs/qa/lsp/*.json`, pure-logic tests in Node over `window.LSP` / `module.exports`, six viewports, a named test for
every §65 check and §64 flow; D18 adds the standalone bundle script `docs/qa/tools/lsp_bundle.js` and the add-on zip
checks. This skill owns the test catalog, the scripts, the fixtures they need, the results and the report. It does
not fix application code: findings go to the owning skill with the test id.

## Responsibilities

- Test catalog `LSP-QA-nnn` in `10_QA_PLAN.md`: one row per check with id, source (`00_MASTER_PROMPT.md §64 Flow n`
  or `§65 <section>`, or the brief decision), suite file, type (static / node / browser / responsive / negative /
  package), viewport, fixture, expected-value owner. Ids are stable once published; a removed check keeps its id
  with status "retired".
- Browser suites (`docs/qa/tools/lsp_*.js`) follow `verify_full_qa.js` exactly: `'use strict'`, `playwright-core`,
  `http.createServer` from the `os/` directory passed as `process.argv[2]` with `/api/*` → 404 and a traversal
  guard, `chromium.launch({executablePath: process.env.CHROME_BIN ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:
  ['--no-sandbox','--disable-dev-shm-usage','--no-proxy-server']})`, `page.on('pageerror')` collected, `rec(name,
  ok, info)` pushing `{test, status:'PASS'|'FAIL', info}`, output `{suite, date, env, total, pass, fail, results}`
  as JSON, exit code 0/1 and `2` on FATAL. LSP opens at `/leasing/index.html` so relative paths match hosting (brief
  D1). Suites: `lsp_full_qa.js` (flows 1–12 at 1440×900), `lsp_role_access.js` (every demo user incl. both client
  users, forbidden routes, negative DOM checks), `lsp_all_views_sweep.js` (all 22 screens of §63 per role: JS
  errors, blank panels, "future" labels, screenshots to an out dir), `lsp_responsive.js` (key screens at the six D10
  viewports: nav usable, drawer fits, no page-level horizontal scroll, no clipped text via
  `scrollWidth`/`clientWidth` and bounding boxes), `lsp_file_offline.js` (copy `os/leasing/` to an empty folder,
  open `index.html` and `LSP_standalone.html` via `file://`, abort every non-file request with `page.route`, assert
  boot and demo data; precedent `geo_standalone_offline.js`), `lsp_persistence.js` (Flow 12, corrupted
  `caseos-lsp-state-v1`, backup slot, rejected import leaves state deep-equal), `lsp_floorplan.js` (clickable
  polygons, modes, legends, status change recolors, plan = table state, markup in a unit code rendered as text per
  brief D19), `lsp_reports_print.js` (report content, internal data excluded from client report,
  `page.emulateMedia({media:'print'})` clipping check, `page.pdf` where available), `lsp_palette.js` (brief D17:
  EN/RU intents map to the closed tool list, unknown command discarded, answers labeled platform / calculated /
  unavailable, client scope respected).
- Node suite `lsp_node_logic.js`: loads `js/config.js`, `js/state.js`, `js/services.js`, `js/tools.js` via `require`
  (brief D10: `module.exports` in Node), uses `data/demo.js` fixtures (the unit with 3 prospects, the deal spanning
  2 units, the unit without area) and asserts the worked examples of `07_CALCULATIONS_AND_KPI_RULES.md`: inventory
  buckets partition project GLA (sum of buckets equals computed GLA; declared `glaM2` reported separately), pipeline
  GLA is deal-based and labeled, weighted value = Σ basis × probability, missing area yields `null` plus a "units
  without area" count (never `0`), money kept to cents and every term override recorded in `termsHistory` (brief
  D20), provenance aggregates take the weakest confidence and staleness flips at 90/180 days (brief D16),
  `clientView(projectId)` contains no forbidden field, `LSP.runTool` denials and dry-runs. Expected values come from
  the analyst skills; this skill encodes them, it does not derive them.
- Static audit `lsp_static_audit.js` (precedent `roles_security_audit.js`, findings `{sev, what}`): `LSP_VERSION`
  present in `os/leasing/index.html` and semver; CASE OS `APP_VERSION` and `sw.js` cache name unchanged; `git diff
  --name-only` against the branch base contains nothing under `os/` outside `os/leasing/`; no `onclick=`/`on*=`
  inline attributes, `eval`, `new Function`, external `<script src>`, local `fetch(`, external AI provider hostnames
  or key fields; no secret patterns (`api_key`, `token`, `password:` with a value, private key headers); the §6.1
  sentence present; every demo record has `demoRecord:true`; no model identifiers or session links in `os/leasing/`,
  `docs/leasing-platform/`, `docs/qa/lsp/`; the 26 tool names of §52 present in `js/tools.js`; `du -sb os/leasing`
  within the brief D18 budget of 1.5 MB.
- Packaging (brief D18): `lsp_bundle.js` inlines `css/lsp.css`, `js/*.js`, `js/views/*.js`, `data/*.js` into
  `os/leasing/LSP_standalone.html` in script order (the multi-file source stays canonical); `lsp_package.js` builds
  or checks `CASE_OS_LSP_v<LSP_VERSION>.zip` containing only `os/leasing/`, the one-page install note and
  `SHA256SUMS`, verifies `sha256sum -c`, and asserts that unpacking over a copy of any CASE OS `os/` (the live
  v4.73.1 build when supplied, otherwise the repository `os/`) changes no file outside `os/leasing/`.
- Test hooks: use only exported surfaces (`window.LSP.state`, `LSP.services`, `LSP.tools`, `LSP.runTool`,
  `LSP_VERSION`) and DOM attributes supplied by frontend-ux-engineer (`data-view`, `data-action`, `data-id`,
  `data-entity`, `data-drawer`, `data-save-state`, `data-lang`, `data-theme`, `data-prov`) and
  interactive-floorplan-engineer (`data-unit-id`, `data-mode`, `data-legend-key`). Login in tests presses Enter
  (Flow 1); never call unexported internals.
- Waiting: prefer `page.waitForFunction` on `data-save-state`, `data-view` or an `LSP.state` value over fixed
  timeouts; an intermittent failure is reported as a race to the owning skill (precedent: the sticky-header race
  caught by `v4463_pins.js`, `HANDOFF_CASE_OS.md`). Thresholds are never loosened to make a failing check pass
  (precedent: `quiz_tells.js` note in `HANDOFF_CASE_OS.md`).
- Negative tests are mandatory for every visibility rule: after a `client` login, the rendered DOM, `clientView`
  output, palette answers and every client report contain no commission value, internal note text, proposed/agreed
  term, `termsHistory` entry, internal contact, provenance `by/name/note` or other client's project name from the
  demo dataset (values supplied by client-portal-permissions and ai-safety-and-permissions).
- Results: each run writes `docs/qa/lsp/LSP_v<LSP_VERSION>_<SUITE>.json` (naming follows
  `docs/qa/CASE_OS_v4.33.0_FULL_QA_BROWSER_TEST.json`; a per-release subfolder with README as in `docs/qa/v4.45.0/`
  when several runs belong together). Screenshots go to the scratchpad unless the change note needs them.
- Final QA report `docs/qa/lsp/LSP_v<LSP_VERSION>_QA_REPORT.md` with the §65 sections: implemented, partially
  implemented, simulated, known bugs, data limitations, security limitations, AI limitations, recommended next
  improvements; plus the §66 H list of tested workflows with `LSP-QA-nnn` ids and pass/fail counts per suite, and
  the package checksum.
- Hand-offs: expected KPI, pipeline, commission and money values → commercial-real-estate-financial-analyst,
  leasing-pipeline-analyst, sales-pipeline-analyst, merchandise-mix-analyst; DOM hooks and inline-ability of assets
  → frontend-ux-engineer; SVG fixtures and plan hooks → interactive-floorplan-engineer; import/corruption fixtures →
  local-storage-and-import-export; forbidden-field lists → client-portal-permissions and ai-safety-and-permissions;
  tool contracts and palette intents → ai-tool-designer; documentation of "simulated" features → the owning skill
  and `README.md`.

## Inputs

Planning documents (`docs/leasing-platform/`): `10_QA_PLAN.md` (primary: catalog, tooling, viewports),
`09_IMPLEMENTATION_PLAN.md` (definition of done per phase; which checks gate each phase),
`07_CALCULATIONS_AND_KPI_RULES.md` (worked examples = expected values), `04_ROLES_AND_VISIBILITY.md` (negative tests
per role), `08_PERSISTENCE_IMPORT_EXPORT.md` (Flow 12, recovery, import rejection), `06_FLOORPLAN_ARCHITECTURE.md`
(plan hooks, sanitizer fixtures), `05_STATUSES_STAGES_AND_CONFIG.md` (status/stage keys used in assertions),
`01_PRODUCT_SPEC.md` (the 22 screens, what counts as implemented), `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (tool,
permission and palette tests), `13_CASE_OS_v4731_REUSE.md` (what must not break at deployment, packaging and
installation procedure), `00_MASTER_PROMPT.md` §6.1, §32, §47, §48, §63, §64, §65, §66 H.

LSP sources (`os/leasing/`), read only: `index.html` (`LSP_VERSION`, script order), `js/config.js`, `js/state.js`,
`js/services.js`, `js/tools.js` (Node-loadable), `js/ui.js` and `js/views/*.js` (hooks), `js/floorplan.js`,
`data/demo.js`, `data/i18n.js`, `README.md` (startup and install instructions the tests must match).

CASE OS reference, read only: `docs/qa/tools/verify_full_qa.js` (server, launch, `rec`, output shape),
`role_access_qa.js` (per-role loop, forbidden screens), `all_views_sweep.js` (view sweep, blank/placeholder
detection, screenshots), `geo_standalone_offline.js` (`file://` and offline pattern), `roles_security_audit.js`
(static findings), `css_conflicts.js` (optional live stylesheet conflict check), `mock_backend.js` (not needed for
LSP: no backend; documented as such), `HANDOFF_CASE_OS.md` QA section (`npm i playwright-core` in the scratchpad,
`node <script> /path/to/os`), `docs/qa/*.json` and `docs/qa/v4.45.0/README.md` (result formats); the live build's
`SHA256SUMS` verification step described in the brief and Document 13.

## Outputs

- `docs/qa/tools/lsp_full_qa.js`, `lsp_role_access.js`, `lsp_all_views_sweep.js`, `lsp_responsive.js`,
  `lsp_file_offline.js`, `lsp_persistence.js`, `lsp_floorplan.js`, `lsp_reports_print.js`, `lsp_palette.js`,
  `lsp_node_logic.js`, `lsp_static_audit.js`, `lsp_bundle.js`, `lsp_package.js`, plus `lsp_run_all.js` that runs
  every suite and prints the pass/fail table.
- `os/leasing/LSP_standalone.html` (generated, never hand-edited) and `CASE_OS_LSP_v<LSP_VERSION>.zip` with
  `SHA256SUMS`, built outside the repository unless the release note asks otherwise.
- `docs/qa/lsp/LSP_v<LSP_VERSION>_<SUITE>.json` results and `LSP_v<LSP_VERSION>_QA_REPORT.md`.
- The `LSP-QA-nnn` catalog and coverage matrix (§64 flows × §65 sections × brief decisions × suites) for
  `10_QA_PLAN.md`.
- Fixture requests to owning skills (SVG threat fixtures, markup-in-code fixtures, corrupted state blobs, invalid
  JSON/CSV samples, expected KPI and money values) recorded in the catalog with the owner.
- Change-note QA block per release: suites run, counts, failing ids with owner and status, package size and
  checksum.

## Constraints

- Brief D10: CASE OS conventions, six viewports, every §65 check and §64 flow mapped to a named test; pure logic
  tested in Node.
- Brief D1, D11, D18: tests never modify CASE OS files or `APP_VERSION`; the static audit fails if they change;
  tests run against `os/` served as a whole with LSP at `/leasing/`; the add-on zip contains only `os/leasing/`, the
  install note and `SHA256SUMS`, within 1.5 MB.
- Brief D2, D9: tests assume no backend (404 on `/api/*` is the environment, not an error), no network, localStorage
  keys `caseos-lsp-state-v1`, `caseos-lsp-backup-v1`, `caseos-lsp-session`, `caseos-lsp-ui`.
- Brief D17: palette tests assert the closed tool menu and labels; no test may require or mock an external AI
  service.
- 00_MASTER_PROMPT.md §65: the report distinguishes implemented / partially implemented / simulated; §63: "future"
  screens are asserted as labeled, not as complete; §6.1, §55: the report states the security limitations without
  softening them.
- Environment FACT (brief): Node 22, Playwright 1.56 and Chromium `/opt/pw-browsers/chromium-1194` are available;
  MySQL is not; no PHP is involved in LSP.
- Vocabulary: assertions use the brief's status keys, stage names, role keys and ID formats (`UNIT-001`, `DEAL-001`,
  `AUD-001`); test names start with the `LSP-QA-nnn` id.
- Writing rules: results and report in English; FACTS (observed) separated from ASSUMPTIONS (A-n) and
  RECOMMENDATIONS; no model identifiers or session links in scripts, results or the report.

## Validation checklist

- [ ] Every §64 flow (1–12), every §65 section and brief decisions D16–D20 map to at least one `LSP-QA-nnn` row; the
      matrix in `10_QA_PLAN.md` has no empty cell.
- [ ] Each script runs with `node docs/qa/tools/<script>.js /path/to/os` after `npm i playwright-core` in the
      scratchpad, prints valid JSON with `suite, date, env, total, pass, fail, results`, and exits 0/1/2 as
      specified.
- [ ] `lsp_file_offline.js` passes for both `index.html` and `LSP_standalone.html` with all non-file requests
      aborted; no local request failure appears in `pageerror` or console.
- [ ] `lsp_node_logic.js` asserts the `07_CALCULATIONS_AND_KPI_RULES.md` worked examples, including the 3-prospect
      unit counted once, the 2-unit deal area, `null` (not `0`) for the unit without area, cents rounding and
      weakest-confidence aggregation.
- [ ] `lsp_role_access.js` logs in as every demo user, presses Enter to submit, asserts role badge and route set,
      and contains the negative DOM/`clientView`/report/palette checks for both client users.
- [ ] `lsp_responsive.js` covers dashboard, units table, floor plan or its mobile fallback, drawer and portal at all
      six D10 viewports with a no-clipping and no-page-scroll assertion.
- [ ] `lsp_static_audit.js` reports zero findings: no CASE OS diff, `APP_VERSION` unchanged, no inline handlers, no
      secrets or external AI references, §6.1 sentence present, `demoRecord:true` everywhere, 26 tool names present,
      size within budget.
- [ ] `lsp_package.js` confirms the zip lists only `os/leasing/**`, the install note and `SHA256SUMS`, `sha256sum
      -c` passes, and unpacking over a CASE OS `os/` copy changes nothing outside `os/leasing/`.
- [ ] Results JSON written to `docs/qa/lsp/` with the `LSP_v<LSP_VERSION>_<SUITE>` name; screenshots not committed
      unless referenced.
- [ ] No test calls an unexported internal, uses a fixed `waitForTimeout` where a `waitForFunction` hook exists, or
      was made green by loosening a threshold.
- [ ] The QA report lists implemented / partially implemented / simulated features, known bugs with `LSP-QA-nnn` ids
      and owners, data, security and AI limitations, next improvements and the package checksum.
- [ ] Failing checks are handed to the owning skill with the id and a reproduction; no application code was changed
      by this skill.

## Prohibited behavior

- Editing `os/leasing/` application code, demo data or planning documents to make a check pass; the fix belongs to
  the owning skill (the generated `LSP_standalone.html` is the only file under `os/leasing/` this skill writes).
- Modifying CASE OS QA scripts (`verify_full_qa.js`, `role_access_qa.js`, `all_views_sweep.js`, ...) or any CASE OS
  file, or writing LSP results into the CASE OS result files.
- Marking a check PASS on a fixed timeout, a loosened threshold, a skipped viewport or a partial role list.
- Deriving expected KPI, pipeline, commission or money values inside the test instead of taking them from the
  analyst documents.
- Asserting only positive visibility (client sees X) without the negative counterpart (client does not see Y).
- Requiring a backend, network access, MySQL, PHP or any external AI service for an LSP test.
- Reporting simulated or "future" features as implemented, or omitting security and AI limitations from the report.
- Using real client, brand or contact data as fixtures; committing screenshots, zips or scratch output that bloat
  the repository.
- Putting model identifiers, session links or credentials in scripts, results or the report.

## Examples

**Task:** "Write the Flow 7 test (multiple prospects on one unit)."
**Expected behavior:** Adds `LSP-QA-0xx` rows to the catalog; in `lsp_node_logic.js` loads the demo unit with 3 open
deals and asserts `calculateVacantGLA`/inventory buckets count its area once while `calculatePipelineGLA` reports it
three times with the "deal-based" label and the expected values from `07_CALCULATIONS_AND_KPI_RULES.md`; in
`lsp_full_qa.js` opens the unit drawer via `data-unit-id`, asserts three prospects listed and the dashboard KPI
unchanged after adding a fourth prospect; writes results to `docs/qa/lsp/`.

**Task:** "Run the full LSP regression and produce the QA report for v0.1.0."
**Expected behavior:** Runs `lsp_run_all.js`, collects the JSON results into `docs/qa/lsp/`, builds the standalone
file and the add-on zip with `SHA256SUMS`, fills `LSP_v0.1.0_QA_REPORT.md` with the §65 sections, lists failing ids
with owner skill and reproduction, states the security limitations (prototype login, localStorage, no server
authorization) and AI limitations (closed function registry and deterministic palette, no external AI) verbatim from
the README, and does not touch application code.

**Task:** "The client report test fails intermittently after the print emulation."
**Expected behavior:** Replaces the fixed wait with `waitForFunction` on `data-view="reports"` and the report's
`RPT-nnn` id in `LSP.state`, re-runs three times, and if the failure persists reports it to
reporting-and-dashboard-analyst as a race with the `LSP-QA-nnn` id, the trace and the viewport; does not relax the
clipping assertion.

