# QA plan

**Purpose.** This document is the test plan for the Leasing & Sales Operating Platform MVP (LSP, `os/leasing/`, `LSP_VERSION = '0.1.0'`). It defines the test layers, the tooling and commands, a named test for every check in 00_MASTER_PROMPT.md §65, a scripted scenario for every user flow in 00_MASTER_PROMPT.md §64, the calculation fixture with expected values, the demo-data validation rules, the regression policy, the report templates required by 00_MASTER_PROMPT.md §65 and §66 F/H, and the exit criteria for declaring the MVP complete. It is written so that the implementing engineer can build the test scripts from it, and so that the founder can read the resulting QA report against a fixed list of expectations. It follows decisions D2, D4–D13 and D16–D22 of the planning brief and cross-references 01_PRODUCT_SPEC.md, 03_DATA_MODEL.md, 04_ROLES_AND_VISIBILITY.md, 05_STATUSES_STAGES_AND_CONFIG.md, 06_FLOORPLAN_ARCHITECTURE.md, 07_CALCULATIONS_AND_KPI_RULES.md, 08_PERSISTENCE_IMPORT_EXPORT.md, 09_IMPLEMENTATION_PLAN.md, 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md and 13_CASE_OS_v4731_REUSE.md.

Status: DRAFT for approval — 2026-09-17

## 0. Sources, conventions and vocabulary

| Item | Rule |
|---|---|
| Requirement sources | 00_MASTER_PROMPT.md §64 (flows), §65 (final check-up), §66 F and H (known limitations, QA report), §69 item 10 (this plan). |
| CASE OS conventions (FACT) | `docs/qa/tools/verify_full_qa.js`, `role_access_qa.js`, `all_views_sweep.js`: Node + `playwright-core`, local static HTTP server that answers 404 for `/api/*`, Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` with `--no-sandbox --no-proxy-server`, result rows `{test, status:'PASS'|'FAIL', info}`, JSON written to `docs/qa/`. LSP follows these conventions (D10). |
| Environment (FACT) | Node v22.22.2, playwright-core 1.56.1, chromium-1194. MySQL is not available; PHP is irrelevant to LSP (no backend, D1). Outbound network is proxied and may be blocked; tests must not depend on the network. The live CASE OS build v4.73.1 is extracted in the scratchpad (brief §1b) and is used for the coexistence check (§3.18). |
| Sibling documents used as facts | Routes and demo logins: 04_ROLES_AND_VISIBILITY.md §1.2, §1.3, §3.2. Negative assertions RV-01..RV-36 and canary tokens: 04 §13. Persistence test API, fixtures, error codes, CSV rules: 08_PERSISTENCE_IMPORT_EXPORT.md §6.2, §7.1, §9.2, §14. Tool registry surface and tests: 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §2.1, §2.8, §8.1. Phase names: 01_PRODUCT_SPEC.md §5.1. |
| Test IDs | Atomic checks: `LSP-QA-nnn` (single ID space, §3 and §6). Flow scenarios: `LSP-FLOW-nn` (§4). Each flow lists the atomic checks it exercises. |
| Layer codes | S static · U unit (Node) · E browser end-to-end · R role/visibility · V responsive · P print/PDF · D persistence · I import/export · A accessibility · M manual (cannot be automated honestly). |
| Vocabulary | Entities, fields, statuses, stages, roles, IDs, file names and localStorage keys are those of the planning brief and of 03/04/05/08. Tests never introduce parallel names. |
| FACT / ASSUMPTION / RECOMMENDATION | Facts cite `00_MASTER_PROMPT.md §n`, a repository file or a sibling document section. Assumptions are labelled A-1..A-3 (brief) and A-10-n (this document). Open questions are Q-10-n with a recommendation and an owner. |

## 1. Strategy and test layers

The MVP is a static, no-backend application (D1, D2). Everything that matters can therefore be tested in two places: pure business logic in Node (fast, deterministic) and the rendered application in headless Chromium (behaviour, roles, layout). No test may rely on a server, a network resource or the wall clock.

### 1.1 Layer overview

| Layer | Proves | Tool | Speed | Script (docs/qa/tools/) |
|---|---|---|---|---|
| S — Static | Every JS file parses (`node --check`); file-structure, size-budget and packaging rules of D2/D11/D18 hold; no forbidden content (secrets, external runtime dependencies, external AI service hosts, `fetch()` of local files, real client names, model identifiers, the word "password" in the UI); `LSP_VERSION` consistent; CASE OS files untouched. | Node, `git`, `unzip -l`, `sha256sum` | < 10 s | `lsp_static_check.js` |
| U — Unit | `js/services.js`, `js/config.js`, `js/state.js` (through `LSP.persistence.createStore()` with a `Map`-backed storage, 08 §14.1) and `js/tools.js` loaded in Node via `module.exports` (D10). KPI/anti-double-counting rules on the fixture of 07_CALCULATIONS_AND_KPI_RULES.md §13 (restated in §5), pipeline rules, derived display status, merchandise mix, matching, completeness, stale rules, provenance aggregation (D16), money/deviation rules (D20), taxonomy aliases (D21), `clientView()` whitelist, report builders, search, tool registry and permission checks (12 §2.8), migrations, import validation, CSV round-trip, adapter, ID generation, demo-data validation (§6). | Node `assert` | < 5 s | `lsp_unit_tests.js` |
| E — Browser E2E | The 12 flows of 00_MASTER_PROMPT.md §64 and the application/floor-plan/CRM/pipeline/tasks/documents/reports checks of §65 against the demo dataset; the "Ask" palette (D17); escaping of data-driven text (D19). | playwright-core + Chromium | 2–4 min | `lsp_e2e_flows.js` |
| R — Role/visibility | Login as every demo user of 04 §1.3; positive canary controls and the negative matrix RV-01..RV-36 of 04 §13 (mapped in §3.15). | playwright-core | 1–2 min | `lsp_role_access.js` |
| V — Responsive | Every screen at the six viewports of D10 (1920×1080, 1440×900, 1366×768, 1024×768, 820×1180, 390×844); one screenshot per screen × viewport. | playwright-core | 3–5 min | `lsp_responsive.js` |
| P — Print/PDF | `page.emulateMedia({ media: 'print' })` on internal and client reports; `page.pdf()`; the "Print / Save as PDF" button calls `window.print()`. | playwright-core | < 1 min | part of `lsp_e2e_flows.js` (flow 11) |
| D — Persistence | Keys of D9 and 08 §1.1; save indicator states of 08 §2.2; backup slot; recovery screen of 08 §4.5; migrations; quota levels of 08 §12.2; multi-tab `stale`; beforeunload guard. | playwright-core | < 1 min | `lsp_persistence.js` |
| I — Import/export | JSON export/import with the validation codes of 08 §7.1; CSV export/import rules of 08 §6.2 and §8; CASE OS backup adapter of 08 §9 with the synthetic fixture of 08 §14.2. | Node + playwright-core | < 1 min | `lsp_import_export.js` |
| A — Accessibility basics | Focus order, labels, contrast of configured status colours, non-colour indicators, touch targets, reduced motion. | playwright-core | < 1 min | part of `lsp_responsive.js` |
| M — Manual | Real tablet/phone touch behaviour, the real "Save as PDF" dialog, readability of colour-coded plans in both themes, Russian copy, installation of the add-on zip on hosting (D18, 13_CASE_OS_v4731_REUSE.md). Recorded from the checklist in §8.3. | Human | 1–2 h | — |

### 1.2 Principles

1. **Assert on state and identifiers, not on copy.** Tests select elements by `data-testid` (§2.7), by stable IDs (D13) and by `[data-unit-id]` polygons (D8), navigate by setting `location.hash` to the routes of 04 §3.2, and read state through `window.LSP` (§2.8). Visible strings are asserted only where the string itself is the requirement (the prototype-authentication sentence of 00_MASTER_PROMPT.md §6.1, the object type in search results §43, the canary tokens of 04 §13). The test language is EN, the default UI language (A-1).
2. **Two data sets only.** The demo dataset (`data/demo.js`, D4, with the canary tokens `CANARY-INTERNAL`, `CANARY-RESTRICTED`, `CANARY-COMMISSION`, `CANARY-CONTACT` per 04 §13 / A-04-8) for E2E and role tests; the calculation fixture (§5) for unit tests. Browser tests that need exact numbers load the fixture into the running app through `page.addInitScript(() => localStorage.setItem('caseos-lsp-state-v1', FIXTURE))` (08 §14.1), so the same numbers are checked in Node and in the DOM.
3. **Deterministic time.** `LSP.persistence.now()` is overridable (08 §14.1) and every date-dependent service accepts an explicit as-of date (A-10-7); tests pass `2026-09-17`. The demo dataset materialises relative dates on build so that overdue/today/next-7-days samples exist on any run date.
4. **No network.** The static server serves the `os/` folder; `/api/*` answers 404. Requests to any host other than `127.0.0.1`, `fonts.googleapis.com` and `fonts.gstatic.com` fail the run. Font requests may fail; the app must render with the system fallback (D14). No external AI service is ever contacted (brief §1b owner rule, D17).
5. **CSP replay.** The static server sends the `Content-Security-Policy` header of `os/.htaccess` (FACT, line 32) with every response, so an asset the production CSP would block surfaces as a `securitypolicyviolation` event and fails the run. The live v4.73.1 `.htaccess` only adds a maps host to `script-src` (brief §1b) and can be replayed with `--csp=<path>`.
6. **Clean-up and isolation.** Each script starts a fresh browser context (empty localStorage), seeds through `LSP.demo.build()` / reset (08 §5), and never leaves test records in committed files. QA result files never contain personal data from real CASE OS backups (12 §8.1).
7. **PASS / FAIL / SKIP.** `SKIP` is allowed only for checks whose feature 09_IMPLEMENTATION_PLAN.md declares optional (Kanban drag/drop, plan zoom/pan) and must carry `info`; a SKIP never counts as a PASS in the exit criteria (§9). The "Ask" palette is not optional (D17).
8. **Every §65 item, every §64 flow and every RV row of 04 §13 maps to a named test** (D10). The catalog in §3 is the contract; scripts print the test ID as the first token of `test`.

## 2. Tooling and commands

### 2.1 Script set

| Script | Layer | Arguments | Writes |
|---|---|---|---|
| `docs/qa/tools/lsp_common.js` | shared | — | Helper module: `serve(osDir, {csp})` (static server, 404 on `/api/*`, CSP replay, MIME table incl. `.svg`, `.json`, `.csv`, request log), `launch()` (Chromium path from `CHROME_BIN` or the fixed path, `--no-sandbox --disable-dev-shm-usage --no-proxy-server`), `openApp(page, base, {viewport, initState})`, `loginAs(page, login)` (types the demo code of 04 §1.3 into `login-code`, presses Enter), `resetDemo(page)`, `loadFixture(page, fixture)`, `rec(id, name, ok, info)`, `finish(suite, outDir)` (writes JSON, sets exit code), `VIEWPORTS`, `CANARY` tokens. |
| `lsp_static_check.js` | S | `<osDir>` `[outDir]` `[--zip=<file>]` | `lsp_static_check_v<LSP_VERSION>.json` |
| `lsp_unit_tests.js` | U | `<osDir>` `[outDir]` `[--only=calc\|demo\|tools\|persistence\|csv\|adapter]` | `lsp_unit_tests_v<LSP_VERSION>.json` |
| `lsp_e2e_flows.js` | E, P | `<osDir>` `[outDir]` `[--flow=n]` | `lsp_e2e_flows_v<LSP_VERSION>.json` |
| `lsp_role_access.js` | R | `<osDir>` `[outDir]` | `lsp_role_access_v<LSP_VERSION>.json` |
| `lsp_responsive.js` | V, A | `<osDir>` `[outDir]` `[shotsDir]` | `lsp_responsive_v<LSP_VERSION>.json`, screenshots |
| `lsp_persistence.js` | D | `<osDir>` `[outDir]` | `lsp_persistence_v<LSP_VERSION>.json` |
| `lsp_import_export.js` | I | `<osDir>` `[outDir]` `[--only=json\|csv\|adapter]` | `lsp_import_export_v<LSP_VERSION>.json` |
| `lsp_bundle.js` | build (D18) | `<leasingDir>` `<outFile>` | `os/leasing/LSP_standalone.html` (all CSS/JS/demo inlined); not a test, but LSP-QA-183 runs the E2E login flow against its output from `file://` |
| `docs/qa/lsp/fixtures/calc_fixture.js` | data | — | The §5 fixture as a Node module (`module.exports = { state, expected }`), shared by unit tests and by `loadFixture()` (Q-10-3). |
| `docs/qa/lsp/fixtures/*` | data | — | Persistence, import, CSV and adapter fixtures exactly as listed in 08 §14.2 (`corrupt_truncated.json` … `caseos_backup_synthetic.json`, `csv/*.csv`). |

`<osDir>` is the CASE OS `os/` folder (the server root), not `os/leasing/`, so that the app runs at `/leasing/index.html` exactly as it will at `https://caseadvisory.uz/os/leasing/` (D1). Default `outDir` is `docs/qa/lsp/`. 04 §13 refers to the role script as `lsp_roles_*.js`, 08 §14.2 names `lsp_caseos_adapter.js` and 12 §2.8 names `lsp_tools.js`; in this plan those are the `--only=adapter` section of `lsp_import_export.js`, the `--only=tools` section of `lsp_unit_tests.js` and `lsp_role_access.js` (Q-10-9).

### 2.2 Commands

```text
cd /home/user/case-site/case-site
npm i playwright-core@1.56.1 --no-save                      # once per environment (CASE OS practice)
for f in os/leasing/js/*.js os/leasing/js/views/*.js os/leasing/data/*.js; do node --check "$f" || exit 1; done
node docs/qa/tools/lsp_static_check.js  os docs/qa/lsp
node docs/qa/tools/lsp_unit_tests.js    os docs/qa/lsp
node docs/qa/tools/lsp_e2e_flows.js     os docs/qa/lsp
node docs/qa/tools/lsp_role_access.js   os docs/qa/lsp
node docs/qa/tools/lsp_responsive.js    os docs/qa/lsp /tmp/lsp-shots
node docs/qa/tools/lsp_persistence.js   os docs/qa/lsp
node docs/qa/tools/lsp_import_export.js os docs/qa/lsp
node docs/qa/tools/lsp_bundle.js        os/leasing os/leasing/LSP_standalone.html
node docs/qa/tools/lsp_static_check.js  os docs/qa/lsp --zip=CASE_OS_LSP_v0.1.0.zip   # packaging check (D18)
node docs/qa/tools/verify_full_qa.js    os                  # CASE OS regression guard (D1/D11), see §7
node docs/qa/tools/role_access_qa.js    os
```

Exit code 0 = all PASS (SKIP allowed), 1 = at least one FAIL, 2 = harness error. Scripts run individually; there is no test-runner dependency (D2).

### 2.3 Result JSON format

```json
{
  "suite": "LSP e2e flows",
  "app": "LSP",
  "lspVersion": "0.1.0",
  "date": "2026-09-17",
  "env": "node v22.22.2, playwright-core 1.56.1, chromium-1194, static http 127.0.0.1 (CSP replay)",
  "total": 0, "pass": 0, "fail": 0, "skip": 0,
  "results": [
    { "test": "LSP-QA-001 no blocking JavaScript errors", "status": "PASS", "info": "22 views, 0 pageerror" }
  ]
}
```

`results[]` rows keep the CASE OS shape `{test, status, info}`; `info` is optional on PASS and mandatory on FAIL and SKIP. `test` starts with the test ID from §3, §4 or §6.

### 2.4 Output directory

```text
docs/qa/lsp/
  README.md                                   index of the runs for the current LSP_VERSION (CASE OS practice: docs/qa/v4.45.0/README.md)
  fixtures/                                   calc_fixture.js + the 08 §14.2 fixtures
  lsp_static_check_v0.1.0.json … lsp_import_export_v0.1.0.json   (seven result files)
  LSP_QA_REPORT_v0.1.0.md                     filled from the template in §8.1
  LSP_KNOWN_LIMITATIONS_v0.1.0.md             filled from the template in §8.2
```

Screenshots (`<shotsDir>/<viewport>/<view>.png`, about 22 views × 6 viewports) are written outside the repository by default and are not committed; the responsive JSON records their count and per-view metrics (Q-10-4).

### 2.5 Static server helper (facts reused)

Identical to the CASE OS helper in `verify_full_qa.js`: `http.createServer`, path-traversal guard (`f.startsWith(OS_DIR)`), directory → 404, `/api/*` → 404, MIME table. LSP additions: CSP header replay (§1.2 item 5), a request log used by LSP-QA-118, `file://` mode used by LSP-QA-118 and LSP-QA-183, and a `--sw` option that first visits `/index.html?demo=1` so the CASE OS service worker (`os/sw.js`, scope `/os/`, FACT) is registered before `/leasing/index.html` is opened (LSP-QA-186).

### 2.6 Browser instrumentation

| Technique | Used by |
|---|---|
| `page.on('pageerror')`, `page.on('console')` (error level), `securitypolicyviolation` listener via `page.addInitScript` | LSP-QA-001, all scripts |
| `page.addInitScript` wrapping `EventTarget.prototype.addEventListener` to count registrations per (element, type, handler source) | LSP-QA-007, LSP-QA-039 |
| `page.on('request')` host allow-list; `page.route` to block everything else | LSP-QA-118, LSP-QA-181 |
| `document.documentElement.scrollWidth <= innerWidth` per view and viewport | LSP-QA-009, LSP-QA-109..114 |
| `elementFromPoint` on drawer/modal centres, only inside the visible area (CASE OS lesson in `HANDOFF_CASE_OS.md`) | LSP-QA-005 |
| `page.emulateMedia({ media: 'print' })`, `page.pdf({ format: 'A4', printBackground: true })`, `window.print` stub | LSP-QA-097..099 |
| Contrast ratio from `DEFAULT_CONFIG` status `color`/`textColor` (WCAG 2.x relative luminance) | LSP-QA-164 |
| Canary tokens collected from `LSP.state` before login, then searched in DOM / view model / print / CSV | §3.15 |
| Second `page` in the same context for multi-tab `stale` | LSP-QA-108e |

### 2.7 data-testid contract

Tests depend on this contract; 09_IMPLEMENTATION_PLAN.md adopts it as part of the definition of done (Q-10-1). Naming: kebab-case, `<area>-<element>`; record-bound elements append the record ID. Values already fixed by 08 (`save-indicator`, `storage-panel`, `import-preview`, `import-confirm`, `import-cancel`, `csv-mapping-table`, `recovery-screen`, `recovery-*`) are reused unchanged.

| Area | data-testid values |
|---|---|
| Login (04 §1.2) | `login-user-card-<login>` (click fills the field), `login-code` (the "Demo code" field), `login-submit`, `login-warning` (prototype-authentication sentence), `login-error` |
| Shell | `app-shell`, `nav`, `nav-<key>` with keys `home`, `projects`, `units`, `pipeline-leasing`, `pipeline-sales`, `brands`, `companies`, `contacts`, `requirements`, `tasks`, `activities`, `reports`, `documents`, `settings`, `importexport` (routes of 04 §3.2), `header-role-badge`, `header-user`, `header-logout`, `header-lang`, `header-theme`, `demo-banner`, `save-indicator` (`data-state` = `saved|unsaved|saving|error|stale`, 08 §2.2), `global-search`, `search-result-<id>`, `notif-bell`, `notif-item-<kind>`, `toast`, `denied-screen`, `denied-link`, `preview-banner`, `portal-preview-select`, `ask-input`, `ask-answer`, `ask-source-label` |
| Projects | `projects-table`, `project-row-<id>`, `project-new`, `project-form`, `project-save`, `project-kpi-<key>` (`gla-computed`, `gla-declared`, `leased`, `vacant`, `negotiation`, `sold`, `unavailable`, `units-without-area`) |
| Floor plan | `plan-project-select`, `plan-building-select`, `plan-floor-select`, `plan-mode-<mode>` (`status`, `mix`, `target-actual`, `manager`, `availability`), `plan-svg`, `plan-legend`, `plan-legend-item-<key>`, `plan-tooltip`, `plan-zoom-in`, `plan-zoom-out`, `plan-zoom-reset`, `plan-mobile-list`, `plan-wizard-open`, `plan-wizard-step-<n>`, `plan-wizard-file`, `plan-wizard-automatch`, `plan-wizard-textmatch` (experimental), `plan-wizard-assign-<polygonId>`, `plan-wizard-save`; polygons carry `data-unit-id` / `data-polygon-id` (D8) |
| Unit drawer | `unit-drawer`, `drawer-tab-<tab>` (`summary`, `commercial`, `deal`, `contacts`, `documents`, `timeline`), `drawer-close`, `unit-status-select`, `unit-brand-select`, `unit-add-note`, `unit-add-task`, `unit-add-comment`, `unit-create-deal`, `unit-add-prospect`, `unit-register-doc`, `unit-save`, `unit-prospect-<dealId>`, `prov-mark-<field>` (D16 confidence mark) |
| Units table | `units-table`, `unit-row-<id>`, `units-filter-<key>`, `filter-chip-<key>`, `filter-chip-remove-<key>`, `filters-reset` |
| Pipeline / deal | `pipeline-view-kanban`, `pipeline-view-table`, `kanban-col-<stageKey>`, `kanban-card-<dealId>`, `pipeline-table`, `deal-row-<id>`, `deal-new`, `deal-form`, `deal-type-select`, `deal-brand-select`, `deal-units-select`, `deal-manager-select`, `deal-stage-select`, `deal-lost-reason`, `deal-terms-<field>`, `deal-terms-history` (D20 deviations), `deal-add-activity`, `deal-register-doc`, `deal-commission-status`, `deal-save`, `deal-history` |
| CRM | `brands-table`, `brand-row-<id>`, `brand-search`, `brand-new`, `brand-form`, `brand-save`, `brand-dup-warning`, `brand-detail`, `brand-contacts`, `brand-requirements`, `brand-create-deal`, `companies-table`, `company-row-<id>`, `contacts-table`, `contact-row-<id>`, `contact-brands-multiselect`, `contact-dup-warning`, `requirements-table`, `requirement-new`, `requirement-create-deal`, `activity-timeline`, `timeline-item-<id>`, `match-suggestions`, `match-reason-<id>` |
| Tasks / dashboard | `tasks-list`, `task-row-<id>`, `task-new`, `task-form`, `task-assignee-select`, `task-due-input`, `task-save`, `task-complete-<id>`, `task-reschedule-<id>`, `dashboard-overdue`, `dashboard-today`, `dashboard-next7`, `dashboard-no-next-action`, `dashboard-stale`, `dashboard-client-comments`, `dashboard-kpi-<key>`, `hygiene-<key>` |
| Documents | `documents-table`, `doc-row-<id>`, `doc-register`, `doc-form`, `doc-visibility-select`, `doc-save`, `doc-open-<id>` |
| Portal | `portal-shell`, `portal-nav-dashboard`, `portal-nav-plan`, `portal-project-select`, `portal-kpi-<key>`, `portal-plan`, `portal-floor-select`, `portal-unit-drawer`, `portal-comment-input`, `portal-comment-submit`, `portal-comments-list`, `portal-comment-<id>`, `portal-report-print`, `portal-doc-row-<id>`, `portal-last-update` |
| Reports | `reports-type-select`, `report-since-select`, `report-generate`, `report-root`, `report-print`, `report-section-<key>`, `report-approve` |
| Settings | `settings-tab-<key>`, `settings-status-row-<key>`, `settings-status-color-<key>`, `settings-stage-row-<key>`, `settings-threshold-<key>`, `settings-save` |
| Import/export | `export-json`, `export-notice`, `export-csv-<table>`, `import-file`, `import-preview`, `import-validation`, `import-confirm`, `import-cancel`, `csv-mapping-table`, `reset-demo`, `reset-demo-understand`, `reset-demo-confirm`, `backup-restore`, `storage-panel`, `recovery-screen`, `recovery-restore-backup`, `recovery-download-raw`, `recovery-import-json`, `recovery-reset-demo`, `recovery-discard-checkbox` (A-10-9) |
| Comments | `comment-<id>`, `comment-status-<id>` (`responseStatus`), `comment-reply-<id>`, `comment-resolve-<id>` |

### 2.8 Browser globals used by tests

FACTS from sibling documents: `LSP.persistence.*` (08 §14.1: `createStore`, `serialize`, `parse`, `validateEnvelope`, `validateImport`, `migrate`, `registerMigration`, `resetMigrations`, `repairIntegrity`, `save`, `load`, `flush`, `getStorageStats`, `csv.*`, `adapter.*`, `now`), `LSP.demo.build()` (08 §5), `LSP.tools.registry / describe() / roleSets / permission.check() / trace` and `LSP.runTool(name, params, session)` → result envelope (12 §2.1). ASSUMPTION A-10-5 for the rest: `LSP.version`, `LSP.state` (the `appState` of 00_MASTER_PROMPT.md §8), `LSP.config` (effective config), `LSP.services` (pure functions of D2, including `clientView(projectId, session)` and `portalProjects(session)` of 04 §6). Navigation in tests is `location.hash = '#/…'` with the routes of 04 §3.2; no router API is required. In Node, `require()` of `js/config.js`, `js/services.js`, `js/state.js`, `js/tools.js` and `data/demo.js` returns the same functions and data through `module.exports` (D10).

## 3. Test catalog (00_MASTER_PROMPT.md §65)

Columns: ID · check (wording of §65) · layer · script · preconditions · expected · status (blank until the run). "demo" = fresh demo dataset after `resetDemo()`; "fixture" = §5 fixture loaded through `loadFixture()`. Role logins are the demo codes of 04 §1.3 (`founder`, `head`, `manager.lease`, `manager.sales`, `admin.crm`, `agent.ext`, `client.a`, `client.b`).

### 3.1 Application checks

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-001 | No blocking JavaScript errors | E | lsp_e2e_flows | demo, `founder`; every `nav-<key>` visited, drawer and modal opened | 0 `pageerror`, 0 console errors, 0 CSP violations over the whole run | |
| LSP-QA-002 | No blank screens | E | lsp_e2e_flows | as 001 | each view: `#main` innerText > 120 chars and ≥ 1 `[data-testid]` rendered; screens marked future carry `data-future="true"` and a visible "future" label (00_MASTER_PROMPT.md §63) | |
| LSP-QA-003 | No fake buttons | E | lsp_e2e_flows | listener instrumentation active | every `button`, `[role=button]`, `a[href]` in every view has a listener or a resolvable href, or is `disabled` + `data-future` | |
| LSP-QA-004 | No broken navigation | E | lsp_e2e_flows | demo | each `nav-<key>` click lands on its route of 04 §3.2; browser back/forward return to the previous view; unknown hash → not-found screen with a link, never blank; a denied route → `denied-screen` + `denied-link` and an `auditLog` row `route_denied` (04 §3.2) | |
| LSP-QA-005 | No overlapping panels | E, V | lsp_e2e_flows, lsp_responsive | drawer + modal + toast open at 1440×900 and 390×844 | drawer and modal bounding boxes inside the viewport; `elementFromPoint` at their centres returns a descendant of the expected panel | |
| LSP-QA-006 | No lost state | E | lsp_e2e_flows | demo | after visiting all views twice, `JSON.stringify(LSP.state)` minus `session` is unchanged; a unit edit survives a navigation cycle | |
| LSP-QA-007 | No duplicated event handlers | E | lsp_e2e_flows | instrumentation | no (element, type, handler source) registered twice after two navigation cycles; one click on `unit-add-task` → exactly +1 task in `LSP.state.tasks` | |
| LSP-QA-008 | No invalid links | E, S | lsp_e2e_flows, lsp_static_check | demo | every `a[href^="#/"]` resolves to a route of 04 §3.2; no `href="#"` without listener; no external `href` except documented references in README | |
| LSP-QA-009 | No clipped critical content | V | lsp_responsive | all viewports | no horizontal page scroll; KPI values, table headers and drawer titles have `scrollWidth <= clientWidth` or an explicit ellipsis with `title` | |

### 3.2 Login and roles

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-010 | Enter key submits login | E | lsp_e2e_flows | login screen | `login-code` = `head`, `page.keyboard.press('Enter')` → `app-shell` visible, `caseos-lsp-session` = `{userId, roleKey:'head_ls', clientId:null, loginAt, lspVersion}` (04 §1.2); unknown code → `login-error` "No demo user with this code", still on Login (RV-30) | |
| LSP-QA-011 | Logout works | E | lsp_e2e_flows | logged in | `header-logout` → login screen; `caseos-lsp-session` removed; `caseos-lsp-state-v1` and `caseos-lsp-ui` kept; `auditLog` rows for login and logout | |
| LSP-QA-012 | Internal roles display correctly | R | lsp_role_access | each internal demo user | `header-role-badge` = `displayName · role label` from `LSP.config.roles` for `founder_admin`, `head_ls`, `manager`, `administrator` | |
| LSP-QA-013 | Client role displays correctly | R | lsp_role_access | `client.a`, `client.b` | badge shows role label and client organisation name; `portal-shell` rendered; `nav` internal items absent | |
| LSP-QA-014 | Role-based views differ | R | lsp_role_access | all roles | the set of `nav-<key>` items equals the F/O/R columns of 04 §3.2 per role (for example `nav-settings` present for `founder`, `head`, `admin.crm`, absent for `manager.*`; `nav-importexport` absent for `manager.*`) | |
| LSP-QA-015 | Client cannot see internal notes | R | lsp_role_access | `client.a` | RV-03: `CANARY-INTERNAL` absent from portal DOM, client drawer, client report DOM and print | |
| LSP-QA-016 | Client cannot see commissions | R | lsp_role_access | `client.a` | RV-04: `CANARY-COMMISSION`, the word "commission" and any `deal.commission` key absent from DOM, view model and print | |
| LSP-QA-017 | Client cannot see other clients or projects | R | lsp_role_access | `client.a` (PROJ-001), `client.b` (PROJ-002) | RV-01, RV-11: `portal-project-select` absent for a single-project client (04 §6 invariant 4); `PROJ-002` absent from `client.a` DOM and view model; `location.hash = '#/portal/PROJ-002'` resolves to own portal | |
| LSP-QA-018 | Prototype authentication warning is visible | E, S | lsp_e2e_flows, lsp_static_check | login screen | `login-warning` shows the sentence of 00_MASTER_PROMPT.md §6.1; README repeats it; the word "password" appears nowhere in the UI (RV-32, 04 §1.2) | |

### 3.3 Projects and units

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-019 | Projects can be created/edited where allowed | E, R | lsp_e2e_flows, lsp_role_access | `head` creates; `manager.lease` edits assigned only | `project-new` → `project-save` → new `PROJ-` ID, `demoRecord:false`, `auditLog` entry; `manager.sales` sees PROJ-001 nowhere (RV-21) | |
| LSP-QA-020 | Buildings and floors are linked correctly | U, E | lsp_unit_tests, lsp_e2e_flows | demo | every `floor.buildingId` exists and `building.projectId === floor.projectId`; `plan-building-select` change filters `plan-floor-select` | |
| LSP-QA-021 | Unit IDs are unique | U, E | lsp_unit_tests, lsp_e2e_flows | demo; create 2 units | `units[].id` unique; `unitNumber` unique per building; duplicate `unitNumber` → validation message, no save | |
| LSP-QA-022 | Unit areas validate | E | lsp_e2e_flows | drawer | `area.glaM2` accepts positive numbers; `-5`, `abc`, `0` rejected; empty stays `null` (never 0) | |
| LSP-QA-023 | Unit statuses update | E | lsp_e2e_flows | drawer | `unit-status-select` → `unit.commercialStatus` changed; polygon `fill` equals the `LSP.config` colour of the new display status; `unit-row-<id>` badge updated | |
| LSP-QA-024 | Status history is created | U, E | lsp_unit_tests, lsp_e2e_flows | after 023 | new `SH-` record `{unitId, from, to, userId, at}`; `auditLog` entry; drawer timeline shows a "status change" item | |
| LSP-QA-025 | Project totals update | E | lsp_e2e_flows | after 023 (Available → Contract Signed) | `project-kpi-leased` increases by the unit GLA and `project-kpi-vacant` decreases by the same amount; denominators unchanged | |
| LSP-QA-026 | Unit data persists | D | lsp_persistence | after 023 | reload → `commercialStatus` and `SH-` record present | |

### 3.4 Floor plans

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-027 | Sample floor plan loads | E | lsp_e2e_flows | demo, `#/projects/<id>/plan` | `plan-svg` contains an `<svg>` with ≥ 10 `[data-unit-id]` polygons; both demo floors of D8 load | |
| LSP-QA-028 | Units are clickable | E | lsp_e2e_flows | 027 | click on `[data-unit-id="<id>"]` opens `unit-drawer` | |
| LSP-QA-029 | Selected unit is correct | E | lsp_e2e_flows | 028 | drawer shows `unitNumber` and `glaM2` of exactly that unit; polygon has the `selected` class | |
| LSP-QA-030 | Hover state works | E | lsp_e2e_flows | 027 | `page.hover` → `plan-tooltip` visible with unit number, display status and area; polygon gets `hover` class; leaving hides it | |
| LSP-QA-031 | Status view works | E | lsp_e2e_flows | `plan-mode-status` | polygon fills equal configured colours of the display status (D5); legend lists exactly the statuses present on the floor | |
| LSP-QA-032 | Merchandise mix view works | E | lsp_e2e_flows | `plan-mode-mix` | fills by `actualUse.category` (fallback `targetUse.category` with pattern); legend = categories present; labels show category | |
| LSP-QA-033 | Target vs Actual view works | E | lsp_e2e_flows | `plan-mode-target-actual` | units whose actual ≠ target are outlined/patterned and listed in the side panel; matching units plain; legend explains both | |
| LSP-QA-034 | Legends are correct | E | lsp_e2e_flows | each mode | every fill colour on the plan has a `plan-legend-item-<key>` with the same colour, label and pattern; no legend entry without a unit unless marked "not on this floor" | |
| LSP-QA-035 | Floor switching works | E | lsp_e2e_flows | project with 2 floors | `plan-floor-select` change replaces the SVG; polygons belong to the new `floorId`; selected unit cleared; `caseos-lsp-ui.lastFloorId` updated (08 §11) | |
| LSP-QA-036 | Zoom/pan works if implemented | E | lsp_e2e_flows | `plan-zoom-in` present | transform of the SVG group changes; `plan-zoom-reset` restores; Ctrl + wheel zooms; if absent → SKIP with info | |
| LSP-QA-037 | Status changes update colors | E | lsp_e2e_flows | drawer open on plan | after 023 the polygon fill changes without reload (00_MASTER_PROMPT.md §3.5) | |
| LSP-QA-038 | Plan and table show the same state | E | lsp_e2e_flows | after 037 | `unit-row-<id>` badge, `project-kpi-*`, dashboard KPI and portal (when `client_visible`) show the same display status | |
| LSP-QA-039 | No duplicate click handlers exist | E | lsp_e2e_flows | instrumentation | switching floors 3× and modes 5× leaves exactly one click handler per polygon (a delegated handler on `plan-svg` counts once) | |

### 3.5 CRM

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-040 | Brands can be searched | E, U | lsp_e2e_flows, lsp_unit_tests | demo | `brand-search` "demo" filters `brands-table`; `global-search` result shows `<name> — Brand` (00_MASTER_PROMPT.md §43) | |
| LSP-QA-041 | Brands can be created/edited | E | lsp_e2e_flows | `manager.lease` | `brand-new` → `brand-save` → `BRAND-` ID, `classification.category` from `LSP.config.categories`; edit persists | |
| LSP-QA-042 | Companies are separate from brands | U, E | lsp_unit_tests, lsp_e2e_flows | demo | `companies[]` distinct from `brands[]`; a company with 2 `brandIds` renders both brands; creating a brand does not create a company | |
| LSP-QA-043 | Contacts support multiple brand links | E | lsp_e2e_flows | `contact-brands-multiselect` | contact with 2 brand IDs appears on both brand detail pages; `contact.companyId` single | |
| LSP-QA-044 | Duplicate warnings work | U, E | lsp_unit_tests, lsp_e2e_flows | brand name variant (case/space); contact with an existing phone | `brand-dup-warning` / `contact-dup-warning` shown; save only after confirmation; `hygiene-duplicates` counts them (08 §8.4 rules) | |
| LSP-QA-045 | Requirements can be created | E | lsp_e2e_flows | brand detail | `requirement-new` → `REQ-` record linked to `brandId`; listed in `brand-requirements` | |
| LSP-QA-046 | Opportunities can be created | E | lsp_e2e_flows | requirement | `requirement-create-deal` → `DEAL-` with `type`, `brandId`, `stage: 'Lead'`, `status: 'Open'`, `projectId` | |
| LSP-QA-047 | Deals can be linked to multiple units | E, U | lsp_e2e_flows, lsp_unit_tests | deal form | `deal-units-select` two units → `deal.unitIds.length === 2`; both units list the deal; `dealArea` = sum of both GLA | |
| LSP-QA-048 | Multiple prospects can link to one unit | E, U | lsp_e2e_flows, lsp_unit_tests | unit drawer | `unit-add-prospect` twice → 3 open deals on one unit; `unit-prospect-<dealId>` ×3; inventory KPI unchanged | |
| LSP-QA-049 | Next actions work | E | lsp_e2e_flows | deal | `nextAction.text/dueDate/ownerId` saved; `dashboard-no-next-action` decreases by 1; overdue next action listed | |
| LSP-QA-050 | Activities appear in timelines | E | lsp_e2e_flows | deal + brand | `deal-add-activity` (call) → `ACT-` record appears in deal, brand, unit and contact timelines with the same ID | |

### 3.6 Pipelines

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-051 | Leasing pipeline works | E | lsp_e2e_flows | `#/pipeline/leasing` | Kanban columns = leasing stages of `LSP.config.leasingStages` in order; every open leasing deal appears once | |
| LSP-QA-052 | Sales pipeline works | E | lsp_e2e_flows | `#/pipeline/sales` | columns = sales stages; sales deals only; leasing-only fields absent from the sales deal form (00_MASTER_PROMPT.md §23) | |
| LSP-QA-053 | Kanban updates table | E | lsp_e2e_flows | Lead → Contacted via `deal-stage-select` (or `dragTo` if implemented, Q-10-6) | `pipeline-table` row shows the new stage; `deal.dateEnteredStage` updated | |
| LSP-QA-054 | Table updates unit/floor-plan views | E | lsp_e2e_flows | stage set to Negotiation from the table | unit display status becomes "Negotiation" on plan and units table; project KPI "under negotiation" includes the unit | |
| LSP-QA-055 | Stages are configurable | E, U | lsp_e2e_flows, lsp_unit_tests | `head` in Settings: rename "Viewing Scheduled", add a stage, reorder (04 action A20) | Kanban and selects reflect config; existing deals keep their stage key; unit test: services read stages from config only | |
| LSP-QA-056 | Lost reasons are required where appropriate | E | lsp_e2e_flows | stage → Closed Lost | save blocked until `deal-lost-reason` chosen from `LSP.config.lostReasons`; `outcome.lost === true`; reason appears in the lost-reason report | |
| LSP-QA-057 | Stage history is recorded | U, E | lsp_unit_tests, lsp_e2e_flows | after 053 | `deal-history` lists every change with user, timestamp, from/to; `auditLog` entry; activity of type "stage change" | |
| LSP-QA-058 | Pipeline filters work | E | lsp_e2e_flows | table view | each filter of 00_MASTER_PROMPT.md §26 present; chip per filter; `filter-chip-remove-<key>` removes one; `filters-reset` clears all and restores the full row count | |

### 3.7 Calculations (fixture of §5; unit and browser)

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-059 | Total GLA is correct | U, E | lsp_unit_tests, lsp_e2e_flows | fixture | computed GLA 1,930 m² from 11 units; declared 2,000 m² shown separately (§5.3) | |
| LSP-QA-060 | Leased GLA is correct | U, E | as above | fixture | 480 m² (Contract Signed 300 + Fit-out 60 + Occupied 120) | |
| LSP-QA-061 | Vacant GLA is correct | U, E | as above | fixture | Available bucket 100 m²; UNIT-908 excluded and noted | |
| LSP-QA-062 | Pipeline GLA is correct | U, E | as above | fixture | deal-based pre-signature leasing pipeline 1,000 m² (unique units 600 m²); label states "deal-based" (D6) | |
| LSP-QA-063 | Pipeline value is correct | U, E | as above | fixture | weighted pre-signature 144,480; incl. signed 245,280; sales weighted 300,000 (§5.5); money to cents (D20) | |
| LSP-QA-064 | Target/actual merchandise calculations are correct | U, E | as above | fixture | shares and gaps of §5.7; over/under classification | |
| LSP-QA-065 | Multi-unit deal area is correct | U, E | as above | fixture DEAL-904 | `dealArea` 400 m²; with `areaOverrideM2: 380` → 380; inventory unchanged | |
| LSP-QA-066 | Multiple prospects do not duplicate inventory GLA | U, E | as above | fixture UNIT-902 (3 deals) | Under-negotiation bucket counts 200 m² once; pipeline by stage counts 200 in Lead, Viewing Completed and Negotiation with the "units with several prospects appear more than once" note | |
| LSP-QA-067 | Client KPIs use approved visibility rules | U, R | lsp_unit_tests, lsp_role_access | fixture; one `internal` unit added | `clientView('PROJ-901', session)` KPI values equal internal inventory values minus hidden units (RV-15); no pipeline value, rents or commissions in the output (§5.9) | |
| LSP-QA-068 | Missing values do not become zero | U, E | as above | fixture UNIT-908, DEAL-909 | area `null` → excluded, "1 unit without area"; deal value `n/a`; KPI card shows "n/a", never "0" | |
| LSP-QA-069 | Denominators are visible where relevant | E | lsp_e2e_flows | fixture | every percentage KPI renders "x of 1,930 m²"; `project-kpi-units-without-area` = 1 | |

### 3.8 Tasks and activities

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-070 | Tasks can be created | E | lsp_e2e_flows | unit drawer and deal | `TASK-` record with `unitId`/`dealId`, `status: 'Open'`, `demoRecord:false` | |
| LSP-QA-071 | Tasks can be assigned | E | lsp_e2e_flows | `task-assignee-select` | `assigneeId` = chosen user; that user's dashboard (login switch) lists it; notification "new assignment" | |
| LSP-QA-072 | Due dates work | E | lsp_e2e_flows | `task-due-input` | stored ISO date; sorting by due date; invalid date rejected | |
| LSP-QA-073 | Overdue status works | U, E | lsp_unit_tests, lsp_e2e_flows | as-of 2026-09-17, fixture tasks (§5.10) | TASK-901 overdue, TASK-902 today, TASK-903 next 7 days, TASK-905 (Done) not overdue | |
| LSP-QA-074 | Completion works | E | lsp_e2e_flows | `task-complete-<id>` | `status` Done, `completedAt` set, activity "task completed", removed from the overdue list in one click | |
| LSP-QA-075 | Rescheduling works | E | lsp_e2e_flows | `task-reschedule-<id>` | new due date saved; moves between dashboard buckets | |
| LSP-QA-076 | Dashboard updates | E | lsp_e2e_flows | after 070–075 | `dashboard-overdue`, `dashboard-today`, `dashboard-next7` recomputed without reload | |
| LSP-QA-077 | Activities appear in timelines | E | lsp_e2e_flows | task completion, comment, document | each generates an `ACT-` item on the related deal/unit/brand timelines | |

### 3.9 Documents

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-078 | Demo files display | E | lsp_e2e_flows | demo | `documents-table` lists demo `DOC-` records with category, project, visibility, size | |
| LSP-QA-079 | Document metadata is stored | E, D | lsp_e2e_flows, lsp_persistence | `doc-register` with `setInputFiles` | record has `fileName`, `fileSize`, `uploadedBy`, `uploadedAt`, `version`, `localUrl` (object URL, prototype only, 08 §10); metadata survives reload, the object URL does not (documented) | |
| LSP-QA-080 | Visibility is respected | R | lsp_role_access | docs with `internal`, `client_visible`, `restricted` | `manager.lease` sees internal + client_visible; `restricted` only for `founder`/`head` (04 footnote 9); `client.a` sees client_visible only | |
| LSP-QA-081 | Client-visible documents appear in portal | R | lsp_role_access | `client.a` | `portal-doc-row-<id>` for each `client_visible` document of PROJ-001 | |
| LSP-QA-082 | Internal documents do not appear in portal | R | lsp_role_access | `client.a` | RV-09: no `portal-doc-row` for `internal`/`restricted`; their IDs and `localUrl` absent from the portal DOM and view model | |
| LSP-QA-083 | Document registration works | E | lsp_e2e_flows | `unit-register-doc`, `deal-register-doc` | record linked to `unitId`/`dealId`; timeline item "document uploaded" | |

### 3.10 Client portal

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-084 | Client sees only assigned projects | R | lsp_role_access | `client.a`, `client.b` | as LSP-QA-017; `portalProjects(session)` is the only source of the switcher (04 §6 invariant 4) | |
| LSP-QA-085 | Dashboard is simplified | R | lsp_role_access | `client.a` | portal KPI set equals the list of 00_MASTER_PROMPT.md §35 and nothing more (RV-12: no tasks, hygiene, stale counts, weighted pipeline value) | |
| LSP-QA-086 | Floor plan is accessible | R | lsp_role_access | `client.a` | `portal-plan` renders polygons; `portal-floor-select` switches floors | |
| LSP-QA-087 | Approved unit data appears | R | lsp_role_access | client clicks a unit | `portal-unit-drawer` shows unit number, area, `clientStatus` (RV-10: labels ⊆ configured client statuses ∪ availability groups), approved category; no rents, manager, deals, internal notes | |
| LSP-QA-088 | Comments can be created | R | lsp_role_access | `client.a` | `portal-comment-submit` → `CMT-` with `authorId`, `relatedType/relatedId`, `visibility: 'client_visible'`, `responseStatus: 'Open'`; `auditLog` `client_comment_created` (04 §6 invariant 5) | |
| LSP-QA-089 | Comments appear internally | R, E | lsp_role_access | after 088, login `manager.lease` | `notif-item-client-comment` and `dashboard-client-comments` include it; unit timeline shows "client comment" | |
| LSP-QA-090 | Reports exclude restricted information | R | lsp_role_access | `client.a` `portal-report-print` | RV-03/04/05/08 in the client report DOM and print view; only approved reports listed (RV-14) | |
| LSP-QA-091 | Client downloads approved documents only | R | lsp_role_access | `client.a` | `doc-open-<id>` exists only for `client_visible`; `LSP.runTool('getVisibleDocuments', {projectId}, clientSession)` returns none with other visibility (RV-35) | |

### 3.11 Reports

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-092 | Internal report works | E | lsp_e2e_flows | `reports-type-select` internal leasing/sales/activity/data-quality | each `report-section-<key>` of 00_MASTER_PROMPT.md §37 rendered with values | |
| LSP-QA-093 | Client report works | E | lsp_e2e_flows | client report for PROJ-001, `admin.crm` drafts, `head` approves (`report-approve`, 04 footnote 13) | sections of §37 client list rendered; "last updated" timestamp; `RPT-` record with `approved: true` | |
| LSP-QA-094 | Reports reflect current data | E | lsp_e2e_flows | change a unit status, regenerate | leased GLA changes by the unit GLA; the `RPT-` record freezes the snapshot | |
| LSP-QA-095 | Changes since previous period can be shown | U, E | lsp_unit_tests, lsp_e2e_flows | two `RPT-` snapshots | `getProjectChanges(projectId, sinceReportId)` lists status changes, new/closed deals, new comments; section "changes since previous report" non-empty | |
| LSP-QA-096 | Internal information is excluded from client reports | R | lsp_role_access | as 090, plus `founder` "preview as client" | identical exclusion whether generated by the client or previewed internally; preview DOM equals the client DOM (RV-33) | |
| LSP-QA-097 | Print stylesheet works | P | lsp_e2e_flows | `emulateMedia print` | `nav`, `header-*`, drawers hidden; `report-root` full width; `@media print` rules in `css/lsp.css`; page breaks on `report-section-*` | |
| LSP-QA-098 | No clipping occurs | P | lsp_e2e_flows | print media | no element in `report-root` wider than the page box; tables wrap; inline SVG charts scale to width | |
| LSP-QA-099 | Browser Save as PDF works | P, M | lsp_e2e_flows + manual | `page.pdf({format:'A4'})`; `window.print` stub | PDF ≥ 20 KB with ≥ 2 pages (count of `/Type /Page` objects); `report-print` invokes `window.print()`; real dialog confirmed manually (M-3) | |

### 3.12 Persistence and import/export

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-100 | localStorage persistence works | D | lsp_persistence | edit | `caseos-lsp-state-v1` written (debounced) as the envelope of 08 §1.2 with `meta: {schemaVersion, savedAt, appVersion}`; `save-indicator` `data-state` goes `unsaved` → `saving` → `saved` (08 §2.2); only the four keys of 08 §1.1 exist | |
| LSP-QA-101 | Refresh preserves data | D | lsp_persistence | after 100 | `page.reload()` → the edit present; session restored from `caseos-lsp-session`; `caseos-lsp-ui.lastRoute` restored | |
| LSP-QA-102 | Reset demo data works | D | lsp_persistence | dirty state, `founder` | `reset-demo` → `reset-demo-understand` + `reset-demo-confirm` (two-step, 08 §5) → state deep-equals `LSP.demo.build()` minus timestamps; backup slot holds the previous state; first audit entry `state.reset_demo`; `demo-banner` visible; `manager.lease` has no reset control (RV-26/A19) | |
| LSP-QA-103 | JSON export works | I | lsp_import_export | `export-json` by `founder` (04 footnote 11) | download `LSP_backup_YYYY-MM-DD.json`; parses; envelope with `meta` and all collections of 00_MASTER_PROMPT.md §8; `export-notice` states that the file may contain internal data (12 §8.1); `head` has no `export-json` | |
| LSP-QA-104 | JSON import works | I | lsp_import_export | exported file after a change | `import-preview` shows source block, counts per collection (current → incoming) and 0 errors (08 §7.2); `import-confirm` replaces all atomically; state deep-equals the export; audit `import.json.completed` | |
| LSP-QA-105 | CSV export works where implemented | I | lsp_import_export | `export-csv-<table>` for the tables of 08 §6.2 | file `LSP_<table>_YYYY-MM-DD.csv`, UTF-8 BOM, CRLF, `;` delimiter, RFC 4180 quoting, formula-injection guard, empty cell for null, arrays joined with `\|`; documents CSV has no `localUrl`; deals CSV has `commission.*` columns only for `founder`; `manager.lease` export contains no commission column (RV-36); client has no CSV export | |
| LSP-QA-106 | Invalid imports are rejected safely | I | lsp_import_export | fixtures of 08 §14.2 | `corrupt_wrong_type.json` → `E-ENVELOPE`; `state_newer_schema.json` → `E-SCHEMA-NEWER`; `import_dup_ids.json` → `E-ID-DUP`; `import_bad_id_format.json` → `E-ID-FORMAT`; `repair_dangling_refs.json` → `E-REF-PARENT`, `E-REF-UNIT`; `import_unknown_status.json` → `E-CONFIG-STATUS`; `corrupt_checksum.json` → `E-CHECKSUM` unless ignored; `import_mixed_demo.json` → `W-DEMO-MIXED`, with "Strip demo records" → `E-REF-UNIT`; in every error case `import-confirm` disabled, `import-cancel` leaves the state hash and backup slot unchanged, audit `import.json.rejected` | |
| LSP-QA-107 | Corrupted local data does not create a blank application | D | lsp_persistence | `corrupt_truncated.json` / `corrupt_no_meta.json` / `state_newer_schema.json` placed in `caseos-lsp-state-v1` before load | `recovery-screen` with reason `parse` / `envelope` / `newer-schema` and the four options of 08 §4.5; `recovery-restore-backup` restores a valid slot and boots; `recovery-download-raw` downloads `LSP_raw_state_YYYY-MM-DD.txt`; `recovery-import-json` opens the import pipeline; `recovery-reset-demo` enabled only after the download or `recovery-discard-checkbox`; audit `state.recovery.*` | |
| LSP-QA-108 | Backup and restore workflow works | D, I | lsp_persistence, lsp_import_export | backup slot + export file; `migration_v1_to_test.json` with `registerMigration(2, fn)` | `backup-restore` restores `caseos-lsp-backup-v1`; export → reset → import (flow 12) restores data; migration runs on load, the backup slot holds the pre-migration string, audit `state.migrated`; `repairIntegrity` report for `repair_dangling_refs.json` nulls optional refs and flags orphans without deleting | |
| LSP-QA-108a | Quota guard | D, U | lsp_persistence, lsp_unit_tests | `import_large.json`; `setItem` mocked to throw `QuotaExceededError` | `getStorageStats()` levels notice ≥ 2 MB / warning ≥ 4 MB (08 §12.2) with `storage-panel` badge and toast; write failure → `save-indicator` `error`, in-memory state and backup slot unchanged | |
| LSP-QA-108b | beforeunload guard | D | lsp_persistence | `data-state="unsaved"` | navigation triggers a `beforeunload` dialog (`page.on('dialog')`); none when `saved` (Q-10-8) | |
| LSP-QA-108c | CSV import with column mapping | I | lsp_import_export | `csv/brands_ok.csv`, `csv/brands_ru_headers.csv`, `csv/contacts_dupes.csv`, `csv/units_bad_rows.csv`, `csv/units_comma_delim.csv` | `csv-mapping-table` auto-maps exact and alias headers (08 §8.3, D21); delimiter and decimal detection; duplicates reported `existing (skipped)` / `W-ROW-DUP-FILE`; bad rows → partial import with error report; > 50 % errors → `E-CSV-QUALITY`; mapping remembered in `caseos-lsp-ui.csvMappings` | |
| LSP-QA-108d | CASE OS backup adapter | I, U | lsp_import_export, lsp_unit_tests | `caseos_backup_synthetic.json` (08 §14.2) | `adapter.detect` true; dry-run lists mapped/skipped keys and warnings; split rule of 08 §9.2 (`vac` → Available no deal, `res` → Reserved + Negotiation deals, `neg` → Available + Negotiation, `off` → Property / Unit Offered, `os` → LOI / Commercial Terms, `cs` → Contract Draft, `cd` → Contract Signed + one open Contract Signed deal for `vars[0]`); companies from `group`; contact dedupe; `merged` → one unit with combined label; raster plan skipped by default; SVG plan → `polygonMappings` suggestions `confirmed:false`; roles `ASH/ADM/CFO → founder_admin`, `BA → head_ls`, `DIR → head_ls` (D22), `AG → manager`, `HO/BSH/BRJ → administrator`, `AGX → external_agent`, `HM` skipped; CASECATS → categories through the alias table (D15, D21); `PROV` entries ↔ inline `provenance` records 1:1 (D16, key convention of 13_CASE_OS_v4731_REUSE.md); expected counts pinned in the fixture (A-10-6) | |
| LSP-QA-108e | Multi-tab stale state | D | lsp_persistence | two pages, same context | page B saves → page A shows `save-indicator` `stale` and the reload banner (08 §2.5); a `storage` event with a null session logs out both tabs (08 §11) | |

### 3.13 Responsive testing

Each check runs at all six viewports; the JSON records one row per (check, viewport).

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-109 | Navigation remains usable | V | lsp_responsive | every viewport | ≥ 1024 px: `nav` visible; < 1024 px: burger opens `nav`, all `nav-<key>` reachable; touch targets ≥ 44 px at 390×844 | |
| LSP-QA-110 | Drawers fit | V | lsp_responsive | unit drawer open | drawer width ≤ viewport width; content scrolls inside; `drawer-close` visible without scrolling | |
| LSP-QA-111 | Tables do not destroy the layout | V | lsp_responsive | units, pipeline table, brands | table container scrolls horizontally; page `scrollWidth` ≤ `innerWidth`; sticky header inside the container | |
| LSP-QA-112 | Floor plan remains usable | V | lsp_responsive | plan view | ≥ 820 px: SVG fits and polygons clickable; 390×844: `plan-mobile-list` (unit list + drawer, D8) instead of the full plan, with an "open on a larger screen" note | |
| LSP-QA-113 | Text is not clipped | V | lsp_responsive | all views | as LSP-QA-009 per viewport; KPI numbers never overflow their card | |
| LSP-QA-114 | Mobile quick actions work | V | lsp_responsive | 390×844 | search, open task, complete task, add comment, change deal stage each succeed and update state | |
| LSP-QA-115 | Screenshot sweep | V | lsp_responsive | all views × viewports | screenshot per pair; JSON lists `chars`, `jsErrors`, `overflow` per pair (CASE OS `all_views_sweep.js` metrics) | |

### 3.14 Technical review

| ID | Check | Layer | Script | Preconditions | Expected | Status |
|---|---|---|---|---|---|---|
| LSP-QA-116 | No secrets are included | S | lsp_static_check | `os/leasing/**`, `docs/leasing-platform/**` | regex scan for key/token/credential patterns → 0 hits; demo users carry no password values (04 §1.2) | |
| LSP-QA-117 | No production security claims are made | S, M | lsp_static_check + review | `os/leasing/**`, README | "secure", "encrypted", "protected", "production-ready" absent or qualified as future; prototype sentence present (LSP-QA-018); no OCR/CV/backend claims (12 §8.1) | |
| LSP-QA-118 | No backend is accidentally required | S, E | lsp_static_check, lsp_e2e_flows | request log; `file://` boot | no `fetch(`, `XMLHttpRequest`, dynamic `import(` in LSP JS (D2); zero requests outside the allow-list; no external AI service host in any file (brief §1b, D17); app boots and logs in from `file://` | |
| LSP-QA-119 | External libraries are documented | S | lsp_static_check | index.html, README | no external `<script src>`; only the Google Fonts `<link>` (D14); README lists it and the CSP of `os/.htaccess` it must satisfy | |
| LSP-QA-120 | All major modules are understandable | M | review | D2 file list | every file of D2 exists, starts with a header comment stating purpose and public functions; README module map matches | |
| LSP-QA-121 | Business rules are not unnecessarily duplicated | S, M | lsp_static_check + review | views | KPI, bucket, display-status and visibility functions exist once in `js/services.js`; `js/views/*.js` and `js/floorplan.js` contain no `reduce`/sum over `glaM2` (grep); `js/views/portal.js` never references `appState` or `state.` (RV-34) | |
| LSP-QA-122 | Status colors are configurable | S, E | lsp_static_check, lsp_e2e_flows | Settings colour change by `founder` (A21) | no hex colour literals in `js/floorplan.js` and `js/views/*.js` (only `js/config.js` and `css/lsp.css`); `settings-status-color-<key>` recolours plan, badges and legend | |
| LSP-QA-123 | Visibility rules are explicit | U, S | lsp_unit_tests | services | every entity of 00_MASTER_PROMPT.md §6.8 carries `visibility` ∈ {`internal`, `client_visible`, `restricted`, `public`}; `clientView` copies by whitelist: a field added to a unit is absent from the view model until whitelisted (04 §6 invariant 2) | |
| LSP-QA-124 | Stable IDs are used | U | lsp_unit_tests | demo + generated | all IDs match D13 (`^(PROJ|SITE|BLDG|FLOOR|PLAN|UNIT|BRAND|COMP|CONT|REQ|DEAL|TASK|ACT|CMT|DOC|RPT|SH|AUD|USER|CLIENT)-\d{3,}$`, A-04-1); the generator never reuses an ID after deletion; counters rebuilt on load (08 §4.1) | |
| LSP-QA-125 | Future Geoanalytics integration is possible | U | lsp_unit_tests | demo | every project/building/unit has `externalIds: {caseOsObjectId, caseOsUnitCode, propertyId, geoMasterId}` (D13); projects carry `latitude`, `longitude`, `address`, `assetTypes` | |
| LSP-QA-126 | Future Building OS integration is possible | U, S | lsp_unit_tests, lsp_static_check | floor plans | `floorPlans[].polygonMappings` versioned per plan (D8); units carry no plan geometry other than `geometry.polygonId`/`centroid`; every §52 function is in `LSP.tools.registry` (LSP-QA-169) | |

### 3.15 Role and visibility negative matrix (04_ROLES_AND_VISIBILITY.md §13)

Run by `lsp_role_access.js` for every demo user. One test per RV row; "How" uses the assertion types of 04 §13 (DOM, VM, ROUTE, TOOL, PRINT, STATIC). Positive controls (04 §13, last paragraph) run first: `CANARY-INTERNAL` visible for `manager.lease`/`admin.crm`/`head`/`founder` in the internal drawer, `CANARY-COMMISSION` for `head`/`founder`, the client-visible demo document for `client.a`/`agent.ext` — a broken render cannot pass the negatives. `external_agent` rows run only if `agent.ext` exists in the demo dataset (04 §1.3 lists it as a stub).

| ID | 04 §13 | Role | Must NOT (abridged; the RV row is the full wording) | How |
|---|---|---|---|---|
| LSP-QA-127 | RV-01 | client | see a project outside `project.clientIds` (`client.a` never sees PROJ-002) | DOM + VM + TOOL |
| LSP-QA-128 | RV-02 | client | reach `#/home`, `#/units`, `#/deals/:id`, `#/settings`, `#/importexport`, `#/brands` | ROUTE → `#/portal` |
| LSP-QA-129 | RV-03 | client | find `CANARY-INTERNAL` in portal DOM, drawer, report DOM or print | DOM + PRINT |
| LSP-QA-130 | RV-04 | client | find `CANARY-COMMISSION`, "commission", any `deal.commission` key | DOM + VM + PRINT |
| LSP-QA-131 | RV-05 | client | find `CANARY-RESTRICTED` or a `restricted`/`internal` comment | DOM + VM |
| LSP-QA-132 | RV-06 | client | see keys `commercialTerms`, `leasingTerms`, `salesTerms`, `probability`, `nextAction`, `lostReason`, `ownership`, `responsibility`, plus `termsHistory` (D20) and `provenance.by/note` (D16) | VM |
| LSP-QA-133 | RV-07 | client | see prospect brand names or a `restricted` brand on a signed unit | DOM + VM |
| LSP-QA-134 | RV-08 | client | see any contact, phone, email or `CANARY-CONTACT` | DOM + VM |
| LSP-QA-135 | RV-09 | client | see or download an `internal`/`restricted` document | DOM + VM + click |
| LSP-QA-136 | RV-10 | client | see a raw internal status/stage label instead of a `clientStatus` | DOM |
| LSP-QA-137 | RV-11 | client | see another client's identity | VM |
| LSP-QA-138 | RV-12 | client | see tasks, activities, staff performance, hygiene/stale counts, weighted pipeline value | DOM + VM |
| LSP-QA-139 | RV-13 | client | create anything but a `client_visible` comment with `responseStatus = Open` | TOOL + DOM |
| LSP-QA-140 | RV-14 | client | see a draft client report or any internal report | DOM + VM |
| LSP-QA-141 | RV-15 | client | count a hidden (`internal`) unit in Total/Leased/Vacant GLA | VM (fixture equality) |
| LSP-QA-142 | RV-16 | external_agent | see units outside `user.projectIds` or not in availability group `available` | DOM + VM |
| LSP-QA-143 | RV-17 | external_agent | see other prospects, non-own deals, `commercialTerms`, tenant or manager names | DOM + VM |
| LSP-QA-144 | RV-18 | external_agent | open Brand Database, Companies, Reports, Settings, Import/Export, portal | ROUTE |
| LSP-QA-145 | RV-19 | external_agent | see phones/emails of contacts it did not create; `CANARY-CONTACT` | DOM + VM |
| LSP-QA-146 | RV-20 | external_agent | move a deal beyond Qualified; change a unit status; create a client-visible comment | TOOL + DOM |
| LSP-QA-147 | RV-21 | manager | see objects of non-assigned projects (`manager.sales` never sees PROJ-001) | DOM + VM + TOOL |
| LSP-QA-148 | RV-22 | manager | see `deal.commission.*`, commission reports/filter, `CANARY-COMMISSION` (with `managerSeesOwnShare = false`) | DOM + VM + PRINT |
| LSP-QA-149 | RV-23 | manager | change `ownership.responsibleManagerId`; open Settings, Import/Export, Users; see other managers' performance rows | ROUTE + DOM + TOOL |
| LSP-QA-150 | RV-24 | manager | see `restricted` comments where not author/responsible; `restricted` contacts' phones/emails | DOM + VM |
| LSP-QA-151 | RV-25 | administrator | see `deal.commission.*`, `CANARY-COMMISSION`; change a deal stage or terms; approve a client report | DOM + VM + TOOL |
| LSP-QA-152 | RV-26 | administrator | edit Settings; run JSON export/import or reset demo | DOM + TOOL |
| LSP-QA-153 | RV-27 | head_ls | edit users/roles, commission rules, currencies/units; run JSON import/reset; export full JSON | DOM + TOOL |
| LSP-QA-154 | RV-28 | head_ls | be blocked from anything else a founder sees (positive control: sees `CANARY-COMMISSION` in Deal Detail) | DOM |
| LSP-QA-155 | RV-29 | founder_admin | demote the last active `founder_admin`; add a `restricted` field to a client whitelist; grant `client` a capability outside C32–C35 (guards G1–G8, 04 §12) | DOM + service error |
| LSP-QA-156 | RV-30 | any | log in with an unknown code, an inactive user, or a client user without `clientId` | DOM (inline error) |
| LSP-QA-157 | RV-31 | any | reach a blank screen from a denied route | ROUTE + DOM |
| LSP-QA-158 | RV-32 | any | find "password" or a security claim in Login, README, portal or reports; the §6.1 sentence must be present | DOM + STATIC |
| LSP-QA-159 | RV-33 | preview | write a comment or download while `previewClientId` is set; preview DOM ≠ real client DOM | DOM (snapshot diff) |
| LSP-QA-160 | RV-34 | portal code | `js/views/portal.js` references `appState` or `state.` | STATIC |
| LSP-QA-161 | RV-35 | tools | client session gets non-whitelisted output from `getUnit`, `getProject`, `getVisibleDocuments`, `generateOwnerReport`, or any result from `getDeal`, `getDealsByStage`, `calculatePipelineValue`, `createTask`, `searchContacts` | TOOL |
| LSP-QA-162 | RV-36 | export | CSV export for manager/administrator contains commission columns; a client CSV exists | file content |

### 3.16 Accessibility basics

| ID | Check | Layer | Script | Expected |
|---|---|---|---|---|
| LSP-QA-163 | Focus order | A | lsp_responsive | Tab from page load reaches the first `login-user-card-*` → `login-code` → `login-submit`; in the shell nav → main → drawer; focus outline visible (2 px, accent colour as CASE OS `v4450_accessibility.json`) |
| LSP-QA-164 | Contrast of status colours | A, U | lsp_unit_tests | for every status in `LSP.config.unitStatuses`: contrast(`textColor`, `color`) ≥ 4.5:1; contrast(`color`, panel background light and dark) ≥ 3:1; failures listed with the status key |
| LSP-QA-165 | Non-colour indicator | A | lsp_e2e_flows | every legend item has a `pattern` or outline token in addition to colour (D5); Target vs Actual deviations outlined; provenance marks are icon + frame + word (D16) |
| LSP-QA-166 | Labels | A | lsp_responsive | every `input`, `select`, `textarea` has `<label for>` or `aria-label`; icon-only buttons have `aria-label`; missing = 0 |
| LSP-QA-167 | Touch targets and reduced motion | A | lsp_responsive | 390×844: interactive elements ≥ 44 px high; `prefers-reduced-motion` disables transitions |
| LSP-QA-168 | Drawer and modal keyboard | A | lsp_e2e_flows | Escape closes drawer/modal; focus returns to the opener |

### 3.17 Tool registry (12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §2.8; `lsp_unit_tests.js --only=tools`)

| ID | Check | Expected |
|---|---|---|
| LSP-QA-169 | Registry completeness | all 26 functions of 00_MASTER_PROMPT.md §52 present in `LSP.tools.registry`, each with `name, description, params, readOnly, requiredRole, visibilityScope, handler` (12 §2.2); `describe()` is JSON-serialisable and contains no functions |
| LSP-QA-170 | Every tool per role on demo data | each tool called with each demo session returns an envelope with `ok` or a permission error; no exception escapes |
| LSP-QA-171 | Client segregation through tools | RV-35 plus: no commission, internal note, restricted contact, `localUrl` of internal/restricted documents or other client's project obtainable through any tool with a client session |
| LSP-QA-172 | Deny by default | unknown role, `external_agent`, unknown tool, missing session → denied and audited (12 §8.1) |
| LSP-QA-173 | Write tools need confirmation | `createTask`, `addComment` without `confirm` change nothing; with it they go through `state.js` writers so `auditLog` (and `statusHistory` where relevant) are written |
| LSP-QA-174 | Denied calls are audited | every denial produces an `AUD-` row with tool name, role and reason; `trace` holds the last 200 calls |
| LSP-QA-175 | D6 partition identity | `calculateLeasedGLA + calculateVacantGLA + under-negotiation + sold + unavailable` = project GLA from units on the fixture (1,930) and on both demo projects |

### 3.18 Decisions D16–D22, packaging and coexistence

| ID | Check | Layer | Script | Expected |
|---|---|---|---|---|
| LSP-QA-176 | Provenance-lite (D16) | U, E | lsp_unit_tests, lsp_e2e_flows | `unit.provenance.glaM2 = {conf, src, how, at, by, name, note}` with `conf` ∈ modelled/asking/verified and closed `src`/`how` lists; an aggregate (project GLA) takes the weakest confidence and shows the composition ("verified 3, asking 7"); staleness amber > 90 days, red > 180 days from the oldest input; `prov-mark-<field>` is icon + frame + word; a deal cannot enter Contract Signed without `agreedRent`/`agreedPrice` provenance (`src = deal`, `how = document`); client outputs show the confidence mark but not `by`/`note` |
| LSP-QA-177 | Escaping (D19) | E, S | lsp_e2e_flows, lsp_static_check | a fixture unit with `unitNumber` `<b>x</b>` and a brand named `<img src=x onerror=alert(1)>` render as literal text in SVG labels, tooltips, legends, tables and reports (no `<b>`/`<img>` element created, 0 `pageerror`); static: no `innerHTML`/string-built markup fed with record data in `js/floorplan.js` (grep + review); uploaded SVG sanitiser strips `<script>`, `<foreignObject>`, `on*` attributes and external `href` (08 §9.2) |
| LSP-QA-178 | Money and deviations (D20) | U, E | lsp_unit_tests, lsp_e2e_flows | `cents()` rounds 12.345 → 12.35 and never yields floating residues; `rentUnit` default `USD/m2/month` with `currency`; changing `proposedRent` or `agreedRent` writes a `termsHistory` entry `{field, from, to, by, at, reason}` visible in `deal-terms-history` for internal roles and absent from `clientView()` (LSP-QA-132) |
| LSP-QA-179 | Taxonomy aliases (D21) | U, I | lsp_unit_tests, lsp_import_export | `normalize('Мода и стиль')` → Fashion, `normalize('fashion ')` → Fashion, unknown → `null` + warning; CSV import with an aliased RU header maps correctly (LSP-QA-108c); brand formats and project kinds carry `aliases` |
| LSP-QA-180 | "Ask" palette (D17) | E | lsp_e2e_flows | `ask-input` "show overdue tasks" and "просроченные задачи" both call `getOverdueTasks` (visible in `LSP.tools.trace`) and render the count with `ask-source-label` "platform data"; a computed question ("leased GLA of Demo City Mall") is labelled "calculated"; an unknown phrase answers "not available" with suggested commands and calls no tool; a client session only gets client-scope tools; a request to any external host fails the run (§1.2 item 4) |
| LSP-QA-181 | No external AI (owner rule) | S | lsp_static_check | no external AI service hostnames or SDK imports anywhere under `os/leasing/` (pattern list lives in the script); README states that no external AI service is used |
| LSP-QA-182 | Size budget (D18) | S | lsp_static_check | total size of `os/leasing/**` ≤ 1.5 MB; per-file sizes listed; no fonts or images bundled; demo SVG plans < 150 KB each (A-10-10) |
| LSP-QA-183 | Standalone bundle (D18) | S, E | lsp_bundle, lsp_e2e_flows `--flow=1` | `lsp_bundle.js` produces `os/leasing/LSP_standalone.html`; opened from `file://` it boots, logs in and shows the dashboard with 0 errors; its byte size is reported |
| LSP-QA-184 | Add-on zip content (D18) | S | lsp_static_check `--zip` | `CASE_OS_LSP_v0.1.0.zip` (`unzip -l`) contains only `os/leasing/**`, the one-page install note and `SHA256SUMS`; `sha256sum -c SHA256SUMS` passes; no `.claude/`, `CLAUDE.md`, `graphify-out/`, `config.php`, `*.sqlite`, secrets; the zip name carries `LSP_VERSION` |
| LSP-QA-185 | CASE OS untouched (D1, D11) | S | lsp_static_check | `git diff --name-only <merge-base>..HEAD -- os/ ':!os/leasing'` is empty; `APP_VERSION` in `os/index.html`, `os/core.js`, `os/sw.js` cache name and `os/api/**`, `os/sql/**` unchanged |
| LSP-QA-186 | Coexistence with the CASE OS service worker and the live build | E | lsp_e2e_flows (`--sw`) | after `/index.html?demo=1` registers `os/sw.js` (scope `/os/`, network-first, navigation fallback = CASE OS index, FACT), `/leasing/index.html` still loads LSP (not the CASE OS shell) and `/leasing/js/*.js` are not served from the `case-os-v4510` cache; the same run repeated against the extracted v4.73.1 `os/` folder (brief §1b) with `os/leasing/` copied in, replaying its `.htaccess` CSP (Q-10-2); offline deep links are documented as a limitation |

## 4. Flow tests (00_MASTER_PROMPT.md §64 flows 1–12)

All flows run in `lsp_e2e_flows.js` in order on one browser context, except flows 9–10 which switch users. Each flow starts from `resetDemo()` unless stated. Assertions read `LSP.state` and the DOM. Routes are those of 04 §3.2; logins are the demo codes of 04 §1.3.

### LSP-FLOW-01 — Internal login (flow 1)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `openApp` | login screen, `login-warning` visible (LSP-QA-018); user cards listed, no password field | `login-warning`, `login-user-card-*` |
| 2 | type `head` | field value set; clicking `login-user-card-head` fills the same field | `login-code` |
| 3 | press Enter | `app-shell` visible; session `roleKey === 'head_ls'` (LSP-QA-010) | — |
| 4 | read nav | `nav-importexport` absent, `nav-settings` present (read), `nav-pipeline-leasing` present (04 §3.2; LSP-QA-014) | `nav-*` |
| 5 | badge | `Demo Head of Leasing & Sales · <role label>` (LSP-QA-012) | `header-role-badge` |

### LSP-FLOW-02 — Open project (flow 2)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `nav-projects` | `projects-table` with 2 demo rows | `project-row-<id>` |
| 2 | click first project | route `#/projects/<id>`; KPI cards rendered | `project-kpi-*` |
| 3 | compare KPIs | values equal `LSP.services` results for that project (computed in `page.evaluate`) | — |
| 4 | open plan | `#/projects/<id>/plan`; `plan-svg` with polygons (LSP-QA-027) | `plan-svg` |
| 5 | select second floor | polygons replaced (LSP-QA-035) | `plan-floor-select` |

### LSP-FLOW-03 — Unit management (flow 3)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | click polygon of an Available unit | drawer opens with that unit (LSP-QA-028/029) | `[data-unit-id]`, `unit-drawer` |
| 2 | set status Active Marketing | `commercialStatus` updated; `SH-` record (LSP-QA-023/024) | `unit-status-select` |
| 3 | assign brand | `actualUse.brandId` set; tenant name in summary | `unit-brand-select` |
| 4 | add note (internal) | `operational.notes[]` +1 with `visibility: 'internal'` | `unit-add-note` |
| 5 | add task | `TASK-` linked to `unitId` (LSP-QA-070) | `unit-add-task` |
| 6 | save | `save-indicator` `unsaved` → `saving` → `saved` (LSP-QA-100) | `unit-save`, `save-indicator` |
| 7 | plan colour | polygon fill = config colour of Active Marketing (LSP-QA-037) | — |
| 8 | dashboard | KPI values for the project recomputed (LSP-QA-025/076) | `dashboard-kpi-*` |

### LSP-FLOW-04 — Merchandise mix (flow 4)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | open plan | status mode default | `plan-mode-status` |
| 2 | `plan-mode-mix` | fills by category; legend lists categories (LSP-QA-032/034) | `plan-legend-item-*` |
| 3 | compare | each polygon fill equals `LSP.config.categories[cat].color` | — |
| 4 | `plan-mode-target-actual` | deviating units outlined; side list of gaps (LSP-QA-033) | — |
| 5 | toggle GLA/unit count | numbers switch; denominators shown (LSP-QA-064/069) | — |

### LSP-FLOW-05 — Brand CRM (flow 5)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `global-search` "demo" | results carry type and context (LSP-QA-040) | `search-result-<id>` |
| 2 | open brand | `#/brands/<id>`; `brand-detail` with completeness indicator | `brand-detail` |
| 3 | contacts | ≥ 1 contact listed; one contact linked to 2 brands (LSP-QA-043) | `brand-contacts` |
| 4 | requirements | listed; create one (LSP-QA-045) | `requirement-new` |
| 5 | create opportunity | `DEAL-` from requirement (LSP-QA-046) | `requirement-create-deal` |
| 6 | link project/unit | `deal.projectId`, `unitIds[0]` set | `deal-units-select` |
| 7 | follow-up | task with due date = as-of + 2 days; appears in `dashboard-next7` | `task-due-input` |

### LSP-FLOW-06 — Leasing deal (flow 6)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `deal-new`, type Leasing | form shows leasing terms only | `deal-type-select` |
| 2 | link brand, unit, manager (`head` assigns; 04 footnote 2) | fields set; `ownership.responsibleManagerId` | `deal-brand-select`, `deal-units-select`, `deal-manager-select` |
| 3 | move stages Lead → Contacted → Qualified → Requirement Confirmed → Property / Unit Offered → Viewing Scheduled → Viewing Completed → Negotiation | each change writes history (LSP-QA-057); unit display status follows (LSP-QA-054) | `deal-stage-select`, `deal-history` |
| 4 | commercial terms; then change `proposedRent` once | `commercialTerms.proposedRent`, `leaseTerm` saved in cents; a `termsHistory` deviation entry with reason (LSP-QA-178) | `deal-terms-*`, `deal-terms-history` |
| 5 | activity | `ACT-` on deal, brand, unit (LSP-QA-050) | `deal-add-activity` |
| 6 | register document (LOI, `internal`) | `DOC-` with `dealId` (LSP-QA-083) | `deal-register-doc` |
| 7 | LOI / Commercial Terms → Contract Draft → Contract Signed | blocked until `agreedRent` provenance is entered (`src = deal`, `how = document`, LSP-QA-176); then `outcome.signedDate` set; services offer unit `commercialStatus` Contract Signed, user confirms; Leased GLA increases | `prov-mark-agreedRent` |
| 8 | Commission Pending | `outcome.commissionStatus: 'Pending'`; not Closed Won yet (00_MASTER_PROMPT.md §22) | `deal-commission-status` |
| 9 | Commission Received | `deal.commission.receivedAmount/receivedDate`; Closed Won allowed; with config `requireCommissionForWon:false` Closed Won allowed from Contract Signed (00_MASTER_PROMPT.md §6.6) | — |

### LSP-FLOW-07 — Multiple prospects (flow 7)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | open the demo unit with 3 prospects | 3 `unit-prospect-<dealId>` rows | `unit-prospect-*` |
| 2 | add a 4th prospect | 4 open deals in `unit.dealIds` | `unit-add-prospect` |
| 3 | inventory | project "under negotiation" GLA unchanged by step 2; unit counted once (LSP-QA-066) | `project-kpi-negotiation` |
| 4 | pipeline | pipeline-by-stage area increased by the unit GLA with the deal-based note (D6) | — |

### LSP-FLOW-08 — Multi-unit deal (flow 8)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `deal-new` | — | — |
| 2 | select 2 units (150 + 250) | `unitIds.length === 2` | `deal-units-select` |
| 3 | deal area | 400 m² shown; inventory buckets unchanged (LSP-QA-065) | — |
| 4 | set `areaOverrideM2` 380 | deal area 380; both units still list the deal | `deal-terms-areaOverrideM2` |

### LSP-FLOW-09 — Client login (flow 9)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | logout | login screen (LSP-QA-011) | `header-logout` |
| 2 | login `client.a` | `portal-shell`; no project switcher (single project, 04 §6 invariant 4); PROJ-002 absent (LSP-QA-084) | — |
| 3 | dashboard | KPI set of §35 only (LSP-QA-085) | `portal-kpi-*` |
| 4 | plan | `#/portal/plan`; polygons clickable; client status colours (LSP-QA-086) | `portal-plan` |
| 5 | click unit | `portal-unit-drawer` approved fields only (LSP-QA-087) | — |
| 6 | comment | `CMT-` `responseStatus: 'Open'` (LSP-QA-088) | `portal-comment-submit` |
| 7 | print report | print media OK; `window.print` called (LSP-QA-090/097/099) | `portal-report-print` |
| 8 | open approved file | `doc-open-<id>` only for `client_visible` (LSP-QA-091) | — |

### LSP-FLOW-10 — Client comment (flow 10)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | client comment (from flow 9) | exists | — |
| 2 | logout, login `manager.lease` | — | — |
| 3 | notifications | `notif-item-client-comment` present; `dashboard-client-comments` = 1 + demo count (LSP-QA-089) | `notif-bell` |
| 4 | respond | reply comment `visibility: 'client_visible'`; `responseStatus` In Review (04 action A30) | `comment-reply-<id>` |
| 5 | resolve | `responseStatus` Resolved; removed from awaiting-response; `client.a` (re-login) sees reply and status | `comment-resolve-<id>` |

### LSP-FLOW-11 — Reporting (flow 11)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `admin.crm` generates a client report for PROJ-001; `head` approves | `RPT-` record; `approved: true`; sections rendered (LSP-QA-093) | `report-generate`, `report-approve` |
| 2 | current data | leased GLA equals `LSP.services` value at generation time (LSP-QA-094) | `report-section-progress` |
| 3 | exclusion | no canary tokens (LSP-QA-096) | `report-root` |
| 4 | print/PDF | LSP-QA-097/098/099 | `report-print` |
| 5 | changes since | second report after a status change lists it (LSP-QA-095) | `report-since-select` |

### LSP-FLOW-12 — Persistence (flow 12)

| Step | Action | Assertion | data-testid |
|---|---|---|---|
| 1 | `founder` changes a unit status and a task | `save-indicator` `saved` (LSP-QA-100) | — |
| 2 | reload | changes present (LSP-QA-101) | — |
| 3 | export JSON | download captured, parsed (LSP-QA-103) | `export-json` |
| 4 | reset demo | two-step confirmation; fresh demo (LSP-QA-102) | `reset-demo`, `reset-demo-understand`, `reset-demo-confirm` |
| 5 | import JSON | preview counts; confirm (LSP-QA-104) | `import-file`, `import-confirm` |
| 6 | verify | state deep-equals the export; changes of step 1 restored | — |

## 5. Calculation fixtures and expected values (07_CALCULATIONS_AND_KPI_RULES.md §13)

The canonical fixture is 07_CALCULATIONS_AND_KPI_RULES.md §13; this section restates it so that the QA scripts and the QA report are self-contained. The fixture ships as `docs/qa/lsp/fixtures/calc_fixture.js` (Q-10-3). As-of date 2026-09-17. Threshold for "under negotiation" = stage Negotiation (leasing) and Negotiation (sales) per D6; probabilities are pinned inside the fixture, not read from `DEFAULT_CONFIG` (A-10-7). Project `PROJ-901` "Fixture Mall", declared `areas.glaM2 = 2000`, `commercial.mandateExpiryDate = 2026-10-10`, one building `BLDG-901`, one floor `FLOOR-901`, all records `demoRecord: true`.

### 5.1 Units

| Unit | GLA m² | commercialStatus | targetUse.category | actualUse.category | Open deals |
|---|---|---|---|---|---|
| UNIT-901 | 100 | Available | Beauty | — | — (DEAL-907 Closed Lost) |
| UNIT-902 | 200 | Available | Fashion | — | DEAL-901 Lead, DEAL-902 Negotiation, DEAL-903 Viewing Completed |
| UNIT-903 | 150 | Active Marketing | F&B | — | DEAL-904 LOI / Commercial Terms (multi-unit) |
| UNIT-904 | 250 | Active Marketing | F&B | — | DEAL-904 |
| UNIT-905 | 300 | Contract Signed | Fashion | Fashion | DEAL-905 Contract Signed (Commission Pending) |
| UNIT-906 | 120 | Occupied | F&B | F&B | — |
| UNIT-907 | 80 | Temporarily Blocked | Services | — | — |
| UNIT-908 | null | Available | Services | — | DEAL-909 Negotiation |
| UNIT-909 | 400 | For Sale | Services | — | DEAL-906 (Sales) Negotiation |
| UNIT-910 | 180 | Sold | Grocery | Grocery | — |
| UNIT-911 | 90 | Reserved | Entertainment | — | — |
| UNIT-912 | 60 | Fit-out | Services | Services | — |

### 5.2 Deals

| Deal | Type | Stage | Units | Rent / price basis | Probability | status |
|---|---|---|---|---|---|---|
| DEAL-901 | Leasing | Lead | UNIT-902 | proposedRent 20 USD/m²/month | 5 % | Open |
| DEAL-902 | Leasing | Negotiation | UNIT-902 | proposedRent 25 | 50 % | Open |
| DEAL-903 | Leasing | Viewing Completed | UNIT-902 | proposedRent 22; `nextAction.text` null; lastContactDate 2026-09-15 | 35 % | Open |
| DEAL-904 | Leasing | LOI / Commercial Terms | UNIT-903, UNIT-904 | proposedRent 30 | 65 % | Open |
| DEAL-905 | Leasing | Contract Signed | UNIT-905 | agreedRent 28 with provenance `{conf: verified, src: deal, how: document}` (D16) | 100 % | Open |
| DEAL-906 | Sales | Negotiation | UNIT-909 | offerPrice 600,000 USD | 50 % | Open |
| DEAL-907 | Leasing | Closed Lost (reason: rent too high) | UNIT-901 | proposedRent 40 | — | Closed |
| DEAL-909 | Leasing | Negotiation | UNIT-908 | proposedRent 20; lastContactDate 2026-08-20 | 50 % | Open |

Value basis precedence: `agreedRent` → `proposedRent` → `askingRent`; annualised rent = rent × dealArea × 12; sales value = `agreedPrice` → `offerPrice` → `askingPrice`; all money rounded to cents (D20).

### 5.3 Inventory buckets (unit-centric, D6)

| Bucket | Units | GLA m² | Share of 1,930 |
|---|---|---|---|
| Leased | UNIT-905, UNIT-912, UNIT-906 | 480 | 24.9 % |
| Sold | UNIT-910 | 180 | 9.3 % |
| Under negotiation | UNIT-902, UNIT-903, UNIT-904, UNIT-909, UNIT-911 (+ UNIT-908 without area) | 1,090 | 56.5 % |
| Available | UNIT-901 | 100 | 5.2 % |
| Unavailable / other | UNIT-907 | 80 | 4.1 % |
| **Computed GLA** | 11 units with area | **1,930** | 100.0 % |
| Declared GLA (project field) | — | 2,000 | shown separately, never substituted |
| Units without area | UNIT-908 | — | reported as "1 unit without area" |

Availability view groups: available 100 · in_process 1,090 · occupied_or_sold 660 · unavailable 80.

Mutation case: close DEAL-906 as Closed Lost → UNIT-909 moves to Available (400); Under negotiation 690, Available 500; all views update without reload (LSP-QA-038). Hidden-unit case (RV-15): set `UNIT-901.visibility = 'internal'` → `clientView` total GLA 1,830, Available 0 with the note "1 unit not shown".

### 5.4 Pipeline area (deal-centric)

| Stage | Deal-based m² | Note |
|---|---|---|
| Lead | 200 | DEAL-901 |
| Viewing Completed | 200 | DEAL-903 |
| Negotiation | 200 | DEAL-902 (DEAL-909 n/a: unit without area, counted as "1 deal without area") |
| LOI / Commercial Terms | 400 | DEAL-904 (150 + 250) |
| Pre-signature total | 1,000 | unique units 600 m² (UNIT-902, 903, 904) — both figures displayed |
| Contract Signed | 300 | DEAL-905 (post-signature) |
| Sales — Negotiation | 400 | DEAL-906 |

### 5.5 Pipeline value

| Deal | Annualised | Weighted |
|---|---|---|
| DEAL-901 | 20 × 200 × 12 = 48,000 | 2,400 |
| DEAL-902 | 25 × 200 × 12 = 60,000 | 30,000 |
| DEAL-903 | 22 × 200 × 12 = 52,800 | 18,480 |
| DEAL-904 | 30 × 400 × 12 = 144,000 | 93,600 |
| DEAL-909 | n/a (no area) | n/a — excluded, "1 deal without computable value" |
| **Leasing pre-signature** | 304,800 | **144,480** |
| DEAL-905 (signed) | 28 × 300 × 12 = 100,800 | 100,800 |
| Leasing incl. signed | 405,600 | 245,280 |
| DEAL-906 (sales) | 600,000 | 300,000 |

The dashboard KPI "pipeline value" uses the pre-signature figure; "signed deals" is a separate KPI (00_MASTER_PROMPT.md §33). If 07_CALCULATIONS_AND_KPI_RULES.md defines otherwise, 07 prevails and the expected values here are updated (Q-10-3).

### 5.6 Display status (D5)

| Unit | Display status | Client status (00_MASTER_PROMPT.md §36 mapping, defaults of 05) |
|---|---|---|
| UNIT-901 | Available | Available |
| UNIT-902 | Negotiation (highest of Lead, Viewing Completed, Negotiation) | In Negotiation |
| UNIT-903 / UNIT-904 | LOI | In Negotiation |
| UNIT-905 | Contract Signed | Leased |
| UNIT-906 | Occupied | Leased |
| UNIT-907 | Temporarily Blocked | Not Available (A-10-8) |
| UNIT-908 | Negotiation | In Negotiation |
| UNIT-909 | Sale Negotiation | In Negotiation |
| UNIT-910 | Sold | Sold |
| UNIT-911 | Reserved | In Negotiation (A-10-8) |
| UNIT-912 | Fit-out | Leased |

With `displayThreshold` raised to LOI / Commercial Terms, UNIT-902 shows Available and UNIT-903/904 still show LOI.

### 5.7 Merchandise mix (project targets: Fashion 40 %, F&B 20 %, Services 10 %, Entertainment 15 %, Grocery 15 %; target units Fashion = 2)

| Category | Actual GLA (leased + sold, base 660) | Actual share | Target share | Gap pp | Class (±2 pp) |
|---|---|---|---|---|---|
| Fashion | 300 | 45.5 % | 40 % | +5.5 | over |
| F&B | 120 | 18.2 % | 20 % | −1.8 | on target |
| Services | 60 | 9.1 % | 10 % | −0.9 | on target |
| Entertainment | 0 | 0.0 % | 15 % | −15.0 | under |
| Grocery | 180 | 27.3 % | 15 % | +12.3 | over |

By unit count: 4 units, 25 % each; Fashion actual 1 vs target 2 → gap −1; other categories "no target unit count" (n/a, not 0). Vacant area by target category (Available bucket): Beauty 100. Pipeline area by target category (Under negotiation bucket, unit-centric): Fashion 200, F&B 400, Services 400, Entertainment 90.

### 5.8 Matching (deterministic, 00_MASTER_PROMPT.md §39)

BRAND-901 Fashion, `minimumAreaM2` 150, `maximumAreaM2` 250, target city of PROJ-901, floor preference 1. `suggestUnitsForBrand('BRAND-901')` → UNIT-902 first (category and area match, Available), UNIT-903/904 lower (area OK, category mismatch), UNIT-901 excluded (area 100 < min); each suggestion carries `reasons[]` strings and the label "suggestion, not a recommendation". `suggestBrandsForUnit('UNIT-902')` → BRAND-901 before BRAND-902 (F&B).

### 5.9 Client view

`clientView('PROJ-901', session)`: inventory buckets and percentages identical to §5.3; units with client statuses of §5.6; no pipeline value, rents, probabilities, commissions, manager IDs, `termsHistory`, internal notes; provenance shown as confidence mark only; documents and comments filtered to `client_visible`; plain JSON without references (04 §6 invariant 3). Deep key scan per LSP-QA-132.

### 5.10 Tasks, stale, provenance and completeness (as-of 2026-09-17, stale threshold 14 days, mandate warning 30 days)

| Record | Data | Expected |
|---|---|---|
| TASK-901 | due 2026-09-10, Open | overdue |
| TASK-902 | due 2026-09-17, Open | today |
| TASK-903 | due 2026-09-20, Open | next 7 days |
| TASK-904 | due 2026-10-05, Open | later |
| TASK-905 | due 2026-09-01, Done | not overdue |
| DEAL-909 | lastContactDate 2026-08-20 | stale (28 days) |
| DEAL-903 | lastContactDate 2026-09-15, no next action | not stale; "without next action" |
| PROJ-901 | mandateExpiryDate 2026-10-10 | "mandate expiry approaching" (23 days) |
| UNIT-908 | no area, no polygon | completeness 3/5 (area, polygon missing) |
| BRAND-903 | no contacts, no last contact | completeness flags contacts and last contact |
| UNIT-905 `provenance.glaM2` | `{conf: 'verified', at: 2026-03-01}` | staleness amber (200 days → red); project GLA aggregate = weakest of inputs; composition "verified 1, asking 2, no source 8" when UNIT-902/903 carry `asking` |

### 5.11 CASE OS import adapter expectations (08 §9.2, §14.2; 03_DATA_MODEL.md §9 prevails for field mapping)

`docs/qa/lsp/fixtures/caseos_backup_synthetic.json` is fictional and shaped like a v4.51.0 blob (2 objects, blocks/floors, 12 units across all `STAT` values incl. one `merged`, 6 brands with `group`, `DOC_CONTACTS`, one `kind:'svg'` plan with text labels, one `kind:'img'` plan, `USERS` for every role key incl. `DIR`). Expected: 2 projects, 12 units (the `merged` pair as one unit), companies = distinct non-empty `norm(group)` values, contacts deduplicated per 08 §8.4, the split rule and role mapping of LSP-QA-108d, warnings `W-CO-*` grouped in the dry-run, skipped keys listed with counts, raster plan excluded by default, SVG plan mappings as unconfirmed suggestions. Exact counts are pinned in the fixture header when it is authored (A-10-6). `PROV` records of the live-build layout (brief §1b) round-trip to inline `provenance` and back (D16).

## 6. Demo data validation tests (`lsp_unit_tests.js --only=demo`)

Runs on `LSP.demo.build()` from `data/demo.js` in Node (08 §5, D10). Counts follow D4 and 00_MASTER_PROMPT.md §47.

| ID | Check | Expected |
|---|---|---|
| LSP-QA-187 | Projects and clients | exactly 2 projects: "Demo City Mall" (leasing only) and "Demo Business Park" (leasing and sales); 2 clients `CLIENT-001`, `CLIENT-002` with disjoint `project.clientIds` |
| LSP-QA-188 | Buildings, floors, plans | ≥ 2 buildings or ≥ 2 floors per D4; ≥ 2 floor plans with ≥ 10 `polygonMappings` each, `current: true`, `version: 1`; SVG text embedded, never fetched (D2); each plan < 150 KB (A-10-10) |
| LSP-QA-189 | Units | 30–50 in total (about 30 + 15); every unit's `floorId`, `buildingId`, `projectId` consistent; ≥ 1 unit with `area.glaM2 === null`; statuses cover ≥ 8 of the D5 inventory statuses; ≥ 1 unit with `visibility: 'internal'` (RV-15) |
| LSP-QA-190 | Brands, companies, contacts | 20–30 brands across ≥ 8 categories; ~10 companies, ≥ 1 company with ≥ 2 brands; ~30 contacts, ≥ 1 contact with ≥ 2 `brandIds` |
| LSP-QA-191 | Deals | ~25 leasing deals covering every leasing stage at least once incl. Closed Lost with reason; ~6 sales deals; ≥ 1 unit with 3 open deals; ≥ 1 deal with 2 `unitIds`; no closed deal counted as open; every Contract Signed deal has `agreedRent`/`agreedPrice` provenance (D16) |
| LSP-QA-192 | Users | the eight demo users of 04 §1.3 with the listed `login`, `roleKey`, `clientId`, `projectIds`, `active: true`; no password field on any user |
| LSP-QA-193 | Tasks, activities, comments, documents | tasks in overdue / today / next 7 days relative to the build date; activities of ≥ 6 types; comments with `responseStatus` Open, In Review and Resolved; documents with `internal`, `client_visible` and `restricted`; ≥ 1 approved client report (`RPT-`) |
| LSP-QA-194 | Canary tokens (04 §13, A-04-8) | every internal note contains `CANARY-INTERNAL`, every `restricted` comment `CANARY-RESTRICTED`, every commission note `CANARY-COMMISSION`, every contact phone `CANARY-CONTACT`; no canary appears in any `client_visible` text |
| LSP-QA-195 | `demoRecord` flag and banner | every record in every collection has `demoRecord: true`; `meta.origin === 'demo'`; `demo-banner` visible after reset |
| LSP-QA-196 | Referential integrity | every `*Id` / `*Ids` reference resolves to a record of the right prefix; `statusHistory` and `auditLog` reference existing units/deals/users; `repairIntegrity` reports 0 issues; IDs match D13 and are unique |
| LSP-QA-197 | Fictional names | no occurrence of "Creative Avenue", "Zarafshan", "Gulistan", "Mega House", any CASE OS demo login (`aziz`, `nodir`, …) or a real client name; brand names are invented; manual spot check against `os/data/case_brands_base.xlsx` recorded in the QA report (M-6) |

## 7. Regression policy and when to run what

Phase names are those of 01_PRODUCT_SPEC.md §5.1 (Phase 0 skeleton … Phase 12 QA and deliverables).

| Trigger | Run | Gate |
|---|---|---|
| Every commit touching `os/leasing/**` | `node --check` loop, `lsp_static_check.js`, `lsp_unit_tests.js` (< 20 s) | green before the commit is pushed to the working branch (D11) |
| `js/config.js` or Settings screens change (Phase 10) | + `lsp_role_access.js`, `--only=calc` and `--only=tools`, LSP-QA-055/122 | green |
| `js/services.js` change | + `lsp_e2e_flows.js` flows 3, 6, 7, 8, 11 | green |
| `js/state.js` or `js/views/importexport.js` change (Phase 9) | + `lsp_persistence.js`, `lsp_import_export.js` | green |
| `js/floorplan.js`, `css/lsp.css` or demo SVG change (Phase 2) | + `lsp_e2e_flows.js` flows 2, 3, 4, LSP-QA-177 and `lsp_responsive.js` | green; screenshots reviewed by the engineer |
| `js/tools.js` or the palette change (Phase 11) | + `--only=tools`, LSP-QA-180/181 | green |
| End of each phase (definition of done in 09_IMPLEMENTATION_PLAN.md) | full battery (seven scripts) | JSON committed to `docs/qa/lsp/` |
| Before the add-on zip `CASE_OS_LSP_v0.1.0.zip` (D18) | full battery + `lsp_bundle.js` + `--zip` check + CASE OS guard: `verify_full_qa.js` and `role_access_qa.js` on `os/` keep their current pass counts; LSP-QA-185 diff empty; LSP-QA-186 coexistence incl. the v4.73.1 package | founder sign-off (§9) |
| Manual checklist (§8.3) | once per release candidate by the Head of Leasing & Sales on a real tablet and phone; installation on hosting per 13_CASE_OS_v4731_REUSE.md | findings recorded in the QA report |
| Flaky test | rerun 3×; a test that fails once in 3 runs is a defect of the test or of the app, never "flaky" — fix before release (`HANDOFF_CASE_OS.md` practice) | — |

Test scripts are versioned with the app: when a `data-testid` or a fixture value changes, the change lands in the same commit as the app change with the reason in the commit message. QA result files and fixtures never contain data from real CASE OS backups (12 §8.1).

## 8. Templates

### 8.1 QA report template (`docs/qa/lsp/LSP_QA_REPORT_v<version>.md`, 00_MASTER_PROMPT.md §65 output list and §66 H)

```markdown
# LSP QA report — v0.1.0 — <date>

## 1. Run summary
| Script | Total | Pass | Fail | Skip | JSON |
|---|---|---|---|---|---|
| lsp_static_check (incl. --zip) | | | | | lsp_static_check_v0.1.0.json |
| lsp_unit_tests (calc, demo, tools, persistence, csv, adapter) | | | | | |
| lsp_e2e_flows (flows 1–12, print, palette, escaping, --sw) | | | | | |
| lsp_role_access (RV-01..36 + positive controls) | | | | | |
| lsp_responsive (6 viewports + a11y) | | | | | |
| lsp_persistence | | | | | |
| lsp_import_export (json, csv, adapter) | | | | | |
| CASE OS guard (verify_full_qa, role_access_qa) | | | | | |
Environment: node, playwright-core, chromium build; run date; branch; commit; LSP_VERSION.
Packaging: zip name, size, SHA256SUMS verified, standalone bundle size, coexistence run against v4.73.1 package.

## 2. Flows tested (LSP-FLOW-01..12): status and remarks per flow
## 3. Implemented features (per 00_MASTER_PROMPT.md §5 list, with screen numbers of §63)
## 4. Partially implemented features (what works, what is missing, test IDs that SKIP)
## 5. Simulated features (prototype login, local file registry, notifications from local data, experimental text-label matching, deterministic Ask palette)
## 6. Known bugs (ID, severity, test ID, reproduction, workaround)
## 7. Data limitations (demo data is fictional; adapter coverage; localStorage quota; shared origin with CASE OS)
## 8. Security limitations (prototype authentication only; no server-side authorization; visibility enforced in the browser only; object URLs are not storage)
## 9. AI limitations (tool registry and deterministic palette only; no model, no network; matching is a suggestion, not a recommendation)
## 10. Manual checklist results (§8.3)
## 11. Recommended next improvements (ordered, with the test ID that would prove each)
## 12. Remaining issues and sign-off (founder / product sponsor, Head of Leasing & Sales, engineer)
```

### 8.2 Known-limitations template (`docs/qa/lsp/LSP_KNOWN_LIMITATIONS_v<version>.md`, 00_MASTER_PROMPT.md §66 F)

```markdown
# LSP known limitations — v0.1.0 — <date>

## A. Prototype limitations (by design for v0.1)
| Area | Limitation | Reference |
|---|---|---|
| Authentication | Demo-code login and role simulation only; no production security | 00_MASTER_PROMPT.md §6.1, 04 §1.2 |
| Files | Metadata + browser object URLs; no secure storage | §6.2, 08 §10 |
| Persistence | localStorage only, shared origin with CASE OS; ~4 MB practical quota; per browser | D9, 08 §12 |
| Floor plans | Supplied SVG polygons / manual mapping; text-label matching experimental; no OCR/CV/CAD | §6.7, §16 |
| Visibility | Enforced by services in the browser; not a security boundary | §3.4, §55 |
| AI | Tool registry and deterministic palette without a model or network | §51–§53, D17 |
| Offline | CASE OS service worker fallback may serve the CASE OS shell for deep links when offline | LSP-QA-186 |

## B. Unavailable features (in scope later, not in v0.1)
| Feature | Planned in | Reference |

## C. Known bugs (open at release)
| ID | Severity | Test ID | Description | Workaround |

## D. Future functionality (ecosystem)
| Area | Extension point | Reference |
| Geoanalytics | externalIds, propertyId format | §49, 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §5 |
| Building OS / AM / FM | spatial layer, floorPlans versions | §50, 12 §6 |
| Production backend | state-blob fold-back, API, RBAC | §55, §66 G, 12 §7, 13_CASE_OS_v4731_REUSE.md |
```

### 8.3 Manual checklist (M layer)

| # | Check | Device / browser | Result |
|---|---|---|---|
| M-1 | Login, dashboard, unit drawer, task completion on a real phone (390 px class) | phone | |
| M-2 | Floor plan pan/zoom and polygon tap on a real tablet (820 px class) | tablet | |
| M-3 | "Print / Save as PDF" through the real browser dialog; page count and readability | desktop Chrome | |
| M-4 | Light and dark theme: status colours distinguishable on the plan; legend readable; provenance marks readable in monochrome print | desktop | |
| M-5 | RU dictionary: no untranslated keys on the main screens; terminology matches the team's usage | desktop | |
| M-6 | Demo names: no real client, project or brand names (spot check against the real brand base) | — | |
| M-7 | `os/leasing/index.html` and `LSP_standalone.html` open from disk (`file://`) with no console errors | desktop | |
| M-8 | Add-on zip installed into the live `os/` (v4.73.1) per 13_CASE_OS_v4731_REUSE.md: `https://caseadvisory.uz/os/leasing/` loads under the live CSP; CASE OS itself unchanged; free disk space checked before upload (brief §1b) | hosting | |

## 9. Exit criteria for declaring the MVP complete

All criteria are required (00_MASTER_PROMPT.md §65 "before declaring the MVP complete", §69; 01_PRODUCT_SPEC.md §9.4).

| # | Criterion | Evidence |
|---|---|---|
| X-1 | Every `LSP-QA-*` test in §3 and §6 is PASS; SKIP only for LSP-QA-036 and LSP-QA-053 drag/drop when 09 declared them optional, with the reason in Known limitations B | seven JSON files in `docs/qa/lsp/` with `fail: 0` |
| X-2 | Every `LSP-FLOW-01..12` scenario PASS in one continuous run | `lsp_e2e_flows_v0.1.0.json` |
| X-3 | 0 page errors, 0 console errors, 0 CSP violations across all views, all roles, all six viewports | LSP-QA-001, LSP-QA-115 |
| X-4 | Calculation fixture: all expected values of §5 reproduced in Node and in the DOM (LSP-QA-059..069, 175) | `lsp_unit_tests_v0.1.0.json`, e2e |
| X-5 | Role negative matrix RV-01..36 100 % PASS with positive controls, no SKIP (LSP-QA-127..162) | `lsp_role_access_v0.1.0.json` |
| X-6 | Persistence, corruption recovery, migration, quota and import validation PASS (LSP-QA-100..108e) | two JSON files |
| X-7 | Demo data validation PASS incl. canary and fictional-name checks (LSP-QA-187..197) | unit tests + M-6 |
| X-8 | CASE OS guard: `verify_full_qa.js` and `role_access_qa.js` unchanged pass counts; LSP-QA-185 diff empty; LSP-QA-186 coexistence PASS incl. the v4.73.1 package | guard JSON + `git diff --stat` in the QA report |
| X-9 | Packaging: LSP-QA-182 size budget, LSP-QA-183 standalone bundle, LSP-QA-184 zip content and `SHA256SUMS` PASS | static check JSON |
| X-10 | Manual checklist M-1..M-8 completed with no blocking finding | §8.3 table in the QA report |
| X-11 | QA report and Known limitations filled from §8; no placeholder text; every open bug has an ID and severity | files in `docs/qa/lsp/` |
| X-12 | README of `os/leasing/` states prototype scope, limitations, the prototype-authentication sentence and "no external AI service"; `LSP_VERSION` in `index.html` equals the version in the QA report and the zip name | LSP-QA-018, 181, 184 |
| X-13 | No model identifiers or session links in any repository file added by the MVP (brief §4); no personal data from real backups in `docs/qa/lsp/` | static check pattern list, review |
| X-14 | Sign-off by the founder / product sponsor after review of the QA report; operational acceptance by the Head of Leasing & Sales after the manual checklist | signatures in the QA report §12 |

## 10. Assumptions and open questions

### 10.1 Assumptions

| ID | Assumption | Impact on this plan |
|---|---|---|
| A-1 (brief) | Default UI language EN with RU toggle | tests run in EN; RU checked by M-5, the i18n key check and the RU palette intent (LSP-QA-180) |
| A-2 (brief) | Demo data is fictional | §6 fictional-name check; no comparison with real KPIs |
| A-3 (brief) | Default merchandise categories = master prompt list + additions of D15 | §5.7 uses Fashion, F&B, Services, Entertainment, Grocery, Beauty |
| A-10-4 | Setting `location.hash` to a route of 04 §3.2 is sufficient for test navigation; no router API is exposed for tests | all browser scripts |
| A-10-5 | `window.LSP` exposes `version`, `state`, `config`, `services` (incl. `clientView`, `portalProjects`) in addition to the surfaces fixed by 08 §14.1 and 12 §2.1; Node `require` returns the same through `module.exports` (D10) | all scripts |
| A-10-6 | Expected counts for `caseos_backup_synthetic.json` are pinned in the fixture header when it is authored (08 §14.2 gives the shape, not the numbers) | LSP-QA-108d |
| A-10-7 | Date-dependent services accept an explicit as-of date; the fixture pins probabilities and thresholds | deterministic §5.5 and §5.10 |
| A-10-8 | Client status defaults for Temporarily Blocked → Not Available and Reserved → In Negotiation | §5.6; 05_STATUSES_STAGES_AND_CONFIG.md prevails |
| A-10-9 | The `data-testid` names proposed here for elements 08 describes without a name (`recovery-discard-checkbox`, `reset-demo-understand`, `export-notice`, `report-approve`, `ask-*`, `prov-mark-*`, `deal-terms-history`) are adopted by 09 | §2.7 |
| A-10-10 | Each hand-authored demo SVG plan stays under 150 KB so that the 1.5 MB budget of D18 holds with two or more plans | LSP-QA-182, 188 |

### 10.2 Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-10-1 | Is the `data-testid` contract of §2.7 part of the definition of done in 09_IMPLEMENTATION_PLAN.md? | Yes; missing test IDs block the phase gate | Founder / product sponsor (approval), engineer via 09 |
| Q-10-2 | Should the coexistence run against the extracted live v4.73.1 package (LSP-QA-186) be a release gate, given that the repository `main` is 22 releases behind (brief Q-BRIEF-1)? | Yes; it is cheap and proves the add-on installs beside what is actually deployed | Founder / product sponsor |
| Q-10-3 | Which document owns the calculation fixture if §5 and 07_CALCULATIONS_AND_KPI_RULES.md §13 diverge, and does "pipeline value" include signed deals? | 07 §13 is canonical; both documents cite `docs/qa/lsp/fixtures/calc_fixture.js`; pipeline value = pre-signature, signed deals separate | Head of Leasing & Sales (business rule), engineer (fixture file) |
| Q-10-4 | Commit screenshots to `docs/qa/lsp/`? | No; keep PNGs outside git (about 130 files per run); commit JSON metrics only; add a `.gitignore` rule for `docs/qa/lsp/shots/` in the implementation phase | Founder / product sponsor |
| Q-10-5 | Run the CASE OS battery as a gate for every LSP add-on release? | Yes (X-8); it takes about two minutes and proves D1 | Founder / product sponsor |
| Q-10-6 | Kanban drag/drop in v0.1? | Implement only if it records history reliably (00_MASTER_PROMPT.md §25); otherwise stage select only and LSP-QA-053 uses the select; decide in 09 | Head of Leasing & Sales |
| Q-10-7 | Who performs the manual checklist and on which devices? | Head of Leasing & Sales on one Android/iOS phone and one tablet; results in the QA report | Head of Leasing & Sales |
| Q-10-8 | Should the prototype enforce a `beforeunload` prompt (LSP-QA-108b) in headless runs? | Yes, but tests dismiss it via `page.on('dialog')`; document that browsers may suppress it | engineer via 09 |
| Q-10-9 | Script names differ between documents (`lsp_roles_*.js` in 04 §13, `lsp_caseos_adapter.js` in 08 §14.2, `lsp_tools.js` in 12 §2.8). | Keep the seven scripts of this plan (D10) with `--only=` sections; the sibling documents update their references at the next revision | engineer via 09 |
