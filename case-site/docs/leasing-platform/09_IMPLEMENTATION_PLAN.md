# Implementation plan

**Purpose.** This document is the build instruction for the CASE OS · Leasing & Sales Platform (LSP, `os/leasing/`, `LSP_VERSION = '0.1.0'`). It fixes the module architecture and the render cycle, the coding conventions every file follows, the thirteen build phases (Phase 0 to Phase 12) with their files, deliverables, screens, flows, definition of done, sponsor review gate, effort and risks, the dependency graph between phases, a build checklist for each of the 22 screens of `00_MASTER_PROMPT.md §63`, the demo dataset and demo SVG build plan, the configuration and i18n plumbing, the responsive plan, the release and changelog process, the documentation deliverables of `00_MASTER_PROMPT.md §66` and the approval gate that must close before Phase 0 starts. It answers `00_MASTER_PROMPT.md §69` item 9. An engineer should be able to implement the MVP from this document plus the sibling documents it cites, without re-reading the master prompt.

**Status: DRAFT for approval — 2026-09-17**

**Sources.** FACTS come from `00_MASTER_PROMPT.md` (cited as `00_MASTER_PROMPT.md §n`), from the sibling planning documents (cited by file name and section), and from the existing CASE OS code (cited by path). Decisions D1–D22 and assumptions A-1..A-3 are those of the planning context brief and the decision log in `docs/leasing-platform/README.md`. New assumptions introduced here are A-09-4 and following; open questions are Q-09-1 and following (section 13). Nothing in this document claims production security, OCR/CV plan recognition or backend functionality.

---

## 1. Architecture overview

### 1.1 Module responsibilities (D2)

One namespace, no framework, no build step, no bundler. Files load in the order below through ordered `<script src>` tags in `os/leasing/index.html`.

| # | File | Responsibility | May touch DOM | Browser export | Node export (D10) | Budget (§2.9) |
|---|---|---|---|---|---|---|
| 1 | `index.html` | Shell: `LSP_VERSION`, login screen, prototype-authentication sentence, DEMO DATA banner, app frame (header, nav, view root, drawer root, print root), script/link tags | yes (markup) | `window.LSP_VERSION` | — | 30 KB |
| 2 | `css/lsp.css` | Design tokens (light/dark), layout, components, floor-plan styles, print stylesheet | — | — | — | 70 KB |
| 3 | `data/i18n.js` | `I18N.en` (base) and `I18N.ru` dictionaries | no | `LSP.i18n` | `module.exports` | 80 KB |
| 4 | `js/config.js` | `DEFAULT_CONFIG`: statuses, stages, lost reasons, categories, visibility levels, client status mapping, stale thresholds, commission rules, currencies and units, notification rules, document and activity types, plan settings | no | `LSP.config` | `module.exports` | 45 KB |
| 5 | `js/state.js` | `appState`, ID generation, localStorage persistence and backup slot, `meta.schemaVersion` migrations, corruption recovery, `statusHistory` / `auditLog` writers, import/export core, the single event bus `LSP.events` | no | `LSP.state`, `LSP.persistence`, `LSP.events` | `module.exports` (`createStore(storageLike)`, 08 §14.1) | 70 KB |
| 6 | `js/services.js` | All business logic, DOM-free: queries, filters, KPI and anti-double-counting rules, pipeline rules, derived display status, merchandise mix, matching, completeness, stale rules, visibility filtering and `clientView()`, report builders, search, `planViewModel()`, and the mutation orchestrators (`setUnitStatus`, `createDeal`, `moveDealToStage`, `registerDocument`, …) | no | `LSP.services` | `module.exports` | 140 KB |
| 7 | `js/tools.js` | `LSP.tools` registry and `LSP.runTool(name, params, session)` with the permission checker (12 §2) | no | `LSP.tools`, `LSP.runTool` | `module.exports` | 35 KB |
| 8 | `js/ui.js` | Hash router, shell rendering, one delegated listener per event type, drawer, modal, toast, table, filter chips, KPI card, empty state, inline SVG charts, provenance marks, `t()`, `esc()`, `fmtArea`/`fmtMoney`/`fmtDate` | yes | `LSP.ui` | — | 90 KB |
| 9 | `js/floorplan.js` | SVG plan engine: sanitize, inject, bind, decorate, colorize, legend, tooltip, pan/zoom, mapping wizard, mobile fallback (06 §4.1) | yes | `LSP.floorplan` | `module.exports` for the pure helpers only | 80 KB |
| 10 | `js/views/*.js` | One file per screen group: `dashboard`, `projects`, `units`, `pipeline`, `crm`, `tasks`, `activities`, `documents`, `reports`, `portal`, `settings`, `importexport`, `ask` | yes | `LSP.views.<name>` | — | 460 KB total, 45 KB per file |
| 11 | `data/demo.js`, `data/demo-plans.js` | Demo dataset builder `LSP.demo.build(options)` and the demo SVG plans as JS strings | no | `LSP.demo` | `module.exports` | 140 KB + 180 KB |
| 12 | `README.md` | Startup instructions, what is prototype-only, limitations (EN with a short RU summary, D3) | — | — | — | 10 KB |

**Dependency rule.** A module may call only downwards in this list. `js/services.js` never reads the DOM and never calls `js/ui.js`; `js/state.js` never calls `js/services.js`; `js/views/*.js` never mutate `appState` directly and never contain a business constant; `js/floorplan.js` obtains everything it draws from one call, `services.planViewModel(floorId, mode, session)` (06 §4.1). A violation of this rule is a review defect, not a style preference: the Node test layer (D10) loads items 3–7 and 11 without a DOM, and any upward call breaks it.

### 1.2 Why classic scripts and a global namespace

FACT: the app must open from `file://` (D2) and must run under the CASE OS CSP in `os/.htaccess`. ES modules are blocked by CORS on `file://`, and `fetch()` of a local file fails there as well. Therefore: classic `<script src>` tags in dependency order (no `defer`, no `type="module"`), one global namespace `window.LSP`, demo plans embedded as JS strings, and no runtime download of anything except the Google Fonts stylesheet (allowed by the CSP `style-src` / `font-src`, with a system font fallback so the app is complete offline).

### 1.3 Namespace map

| Path | Content |
|---|---|
| `LSP.version` | `LSP_VERSION` string |
| `LSP.config` | `DEFAULT_CONFIG` plus `effective()` (§7.1) |
| `LSP.state` | the `appState` object of `00_MASTER_PROMPT.md §8` |
| `LSP.persistence` | save/load/flush, validation, migrations, CSV helpers, CASE OS adapter, `now()` (08 §14.1) |
| `LSP.events` | `on(type, fn)`, `off`, `emit(type, payload)`; `on('*')` for the render subscription |
| `LSP.services` | pure business logic and mutation orchestrators |
| `LSP.tools`, `LSP.runTool` | AI tool registry and permission-checked dispatcher (12 §2.1) |
| `LSP.ui` | router, components, `t`, `esc`, formatters, `render(viewId)` |
| `LSP.floorplan` | plan engine (06 §4.1) |
| `LSP.views` | view modules, each `{ render(state, params) → htmlString, actions: {…}, mount?(root), unmount?() }` |
| `LSP.demo` | `build(options)` returning a fresh demo state |

### 1.4 Dual export for Node tests (D10)

Every DOM-free file ends with the same guard, so the same source runs in the browser and under `node --check` / `require()`:

```javascript
(function (root) {
  'use strict';
  /* … module body … */
  var api = { /* public functions */ };
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.LSP = root.LSP || {};
  root.LSP.services = api;           // or .config, .state, .tools, .demo, .i18n
}(typeof globalThis !== 'undefined' ? globalThis : this));
```

`js/state.js` additionally exports `createStore(storageLike)` so the persistence layer can be driven over a `Map`-backed fake storage in Node (08 §14.1). `js/floorplan.js` exports only its pure helpers (`parsePolygonJson`, JSON→SVG conversion, mapping validation); everything that touches an `SVGElement` is tested in Playwright.

### 1.5 Render cycle

The only supported sequence, for every state change without exception:

```text
data-action on a control
  → view action handler (js/views/*.js)
    → LSP.services.<operation>(...)            validate, apply business rule
      → js/state.js writer                     mutate appState, append statusHistory + auditLog,
                                               stamp updatedAt, mark dirty, schedule debounced save
        → LSP.events.emit(type, payload)       exactly one event per operation
          → js/ui.js subscription (registered once)
             1. LSP.ui.render(viewId)          re-render the ACTIVE view only, from appState via services
             2. LSP.floorplan.render(reason)   only if a plan is mounted and visible
             3. header: save indicator, notification count, role badge
```

Rules that make this testable against `00_MASTER_PROMPT.md §3.5` ("no hidden state") and `§65` ("no duplicated event handlers"):

- A service never calls `render()`; a view never mutates `appState`; a writer never renders.
- One event per operation. Batch operations (import, reset to demo, settings save) emit one `state:replaced` event, not one per record.
- Renders are coalesced: events arriving in the same microtask produce one render pass.
- `render(viewId)` rebuilds the view root from `appState` and is idempotent; it attaches no listeners (the delegated listeners live on the app root and are registered once at boot).
- `floorplan.render(reason)` takes a reason from `geometry | mappings | data | mode | labels | selection` (06 §4.3); views never touch polygons directly.
- Derived values (display status, KPI buckets, pipeline aggregates, completeness, staleness) are computed in services on every render and never stored on the record (D5, D6).

### 1.6 Event delegation

One delegated listener per event type (`click`, `keydown`, `input`, `change`, `submit`) on the app root, registered once in `js/ui.js`. Dispatch is on the `data-action` attribute of the closest matching ancestor; targets travel in `data-id`, `data-entity`, `data-unit-id`, `data-view`, `data-stage`, `data-mode`.

| Convention | Rule |
|---|---|
| Naming | `data-action="<area>.<verb>"`, lower camel verb: `nav.go`, `unit.setStatus`, `unit.addTask`, `deal.moveStage`, `deal.setLostReason`, `plan.setMode`, `filters.reset`, `filters.removeChip`, `crm.openBrand`, `doc.register`, `settings.saveSection`, `io.exportJson`, `portal.submitComment` |
| Registration | Each view exports an `actions` map keyed by the same strings; `js/ui.js` resolves the handler from the active view first, then from a small global map (navigation, language, theme, logout, drawer close) |
| Unknown action | Logged as a console warning with the action name; never a silent no-op (this is how "fake buttons" of `00_MASTER_PROMPT.md §65` are caught) |
| No inline handlers | `onclick=` and friends are forbidden. FACT: CASE OS `os/core.js` uses 183 inline handlers; LSP departs from that so handler duplication is testable and no inline script is needed under the CSP |
| Keyboard | `Enter` and `Space` activate anything with `role="button"`; `Escape` closes the drawer and the modal; `Enter` submits the login form (`00_MASTER_PROMPT.md §32`) |
| Test hooks | Every control also carries the `data-testid` value of `10_QA_PLAN.md §2.7`; that contract is part of the definition of done (10 §2.7, Q-10-1) |

---

## 2. Coding conventions

### 2.1 Naming

| Subject | Rule | Example |
|---|---|---|
| Files | lower kebab-case; a view file is named after its route group | `js/views/importexport.js` |
| Functions | camelCase, verb first: `get*` (read), `calc*` (number), `build*` (object), `render*` (markup string), `handle*` (event) | `calcInventoryBuckets()` |
| Record fields | camelCase, as written in `03_DATA_MODEL.md` | `commercialStatus`, `glaM2` |
| Status / stage / reason / category keys | lower snake_case, stable forever; labels live only in config and `data/i18n.js` | `active_marketing`, `contract_signed`, `loi_commercial_terms`, `rent_too_high` |
| Entity IDs | D13 formats, uppercase prefix + three digits, zero-padded, never reused | `UNIT-001`, `DEAL-014` |
| CSS classes | `lsp-` prefix, BEM-light: `lsp-table`, `lsp-table__row`, `lsp-badge--warn` | |
| i18n keys | `<screen>.<element>[.<qualifier>]`, plus the fixed namespaces `status.*`, `stage.*`, `category.*`, `role.*`, `lostReason.*` | `units.filter.areaRange` |
| Tool parameters | tools take **keys**, never display labels (`getStaleDeals({stage: 'negotiation'})`). The label-style examples in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §3` are illustrative and are normalised to keys at the next revision of that document | |

### 2.2 Identifiers

IDs are allocated by `js/state.js` only, through `nextId(prefix)`, which scans the collection for the highest numeric suffix and increments; the counter is never stored, so an imported state cannot collide with a stale counter. IDs are opaque strings: nothing parses them for meaning except the integrity checker, which verifies that a reference's prefix matches the target collection. `externalIds` (`caseOsObjectId`, `caseOsUnitCode`, `propertyId`, `geoMasterId`) exist on project, building and unit from Phase 1 and are never used as primary keys (D13).

### 2.3 Dates and time

Dates are ISO 8601 strings: `YYYY-MM-DD` for calendar dates, `YYYY-MM-DDTHH:mm:ss.sssZ` (UTC) for timestamps. No locale string is ever parsed. Every "now" and "today" comparison goes through `LSP.persistence.now()` so tests can pin the clock (08 §14.1); `Date.now()` appears in exactly one place. Day arithmetic uses a single helper, `daysBetween(a, b)`, which compares calendar dates in UTC and returns an integer. Overdue, stale and staleness-of-provenance rules read their thresholds from config (§7), never from a literal.

### 2.4 Money, areas and rates (D20)

Money is stored as an integer number of cents together with its `currency`; a rent value is stored together with `rentUnit` (default `USD/m2/month`). Arithmetic happens in cents (the `cents()` rounding pattern of CASE OS `os/v4670-offer-pricing.js`); rounding happens once, at display. Areas are numbers in m² with at most one decimal. There is no FX conversion in v0.1 (A-01-5): values keep their currency and totals across currencies are refused with an explicit note rather than summed. `null` is not zero: a missing input produces `n/a` with a reason, and every percentage prints its denominator (D6, `00_MASTER_PROMPT.md §65` "missing values do not become zero", "denominators are visible").

Every manual override of asking → proposed → agreed terms appends a `deviation` entry (`field, from, to, by, at, reason`) to the deal's `termsHistory` and an `auditLog` row; deviations are internal and never reach `clientView()` (D20, 04 §6).

### 2.5 Internationalisation in code

No user-facing string literal exists outside `data/i18n.js`. Views call `t('units.title')`; interpolation uses `{name}` placeholders resolved by `t(key, params)`. Demo content (brand names, note texts, document titles) is data, not UI text, and is not translated. Number, date and money formatting is done by `fmtArea`, `fmtDate`, `fmtMoney` from `js/ui.js`, which read the active language from `caseos-lsp-ui` (D9). Full rules in section 8.

### 2.6 Accessibility

Real `<button>` and `<a>` elements for anything clickable; `aria-label` on icon-only controls; a visible focus ring; focus returns to the opener when a drawer or modal closes; every status is conveyed by text and a non-colour pattern as well as by colour (`00_MASTER_PROMPT.md §14`, D16 icon + frame + word); touch targets at least 40 px on the mobile breakpoint; `prefers-reduced-motion` disables transitions. Contrast of configured status colours is checked in QA (`10_QA_PLAN.md §3.16`), and a failing colour is corrected in config, never with a CSS override.

### 2.7 CSS tokens and colours

Tokens live on `:root` (light) and `body.dark` (dark) and reuse the CASE OS names: `--bg --panel --card --ink --muted --soft --border --green --amber --blue --teal --purple`, plus `--red: #9E0000` used as an accent only (D14; FACT: CASE OS `os/index.html`). Data colours — unit statuses, merchandise categories, manager colours — are never CSS constants: rendering reads `color`, `textColor` and `pattern` from the config entry and applies them per element (05 P3). A hex literal in `js/views/*.js` or `js/floorplan.js` fails the static check.

### 2.8 Dependencies, CSP and `file://`

| Constraint | Rule |
|---|---|
| Runtime dependencies | None. No Chart.js, no Leaflet, no framework, no polyfill bundle. Charts are inline SVG generated by code (D14). The only external resource is the Google Fonts stylesheet with a system fallback |
| CSP (`os/.htaccess`) | LSP loads no external script, so no `script-src` entry is ever needed; no `eval`, no `new Function`, no `javascript:` URL; inline `<style>` is permitted and used only for the generated data-colour block; `blob:`/`data:` URLs are used only for document previews, which `img-src`/`frame-src` already allow |
| `file://` | No `fetch()` and no `XMLHttpRequest` of a local file; no ES modules; no service worker registered by LSP; hash routing only; all assets referenced through `<script src>` / `<link href>` with relative paths |
| Strict mode | Every file is one IIFE beginning with `'use strict';`. No implicit globals; the only global is `LSP` (plus `LSP_VERSION`) |
| Escaping (D19) | Every dynamic value in an HTML string passes through `esc()`. SVG text (plan labels, chart labels, legends, tooltips) is set with `textContent` / `createElementNS`, never by string concatenation. FACT: CASE OS v4.70.3 fixed a stored XSS where a unit code and brand name were concatenated into SVG `<text>` |
| Untrusted input | Imported JSON, CSV, CASE OS backups, uploaded SVG and client comments are data. SVG passes the allow-list sanitizer (06 §12.1) on save and again on every inject |

### 2.9 Size budget

D18 caps the add-on package at 1.5 MB because the hosting disk is nearly full (FACT: 1.89 of 1.95 GB used). The budget is enforced on the uncompressed source tree, which guarantees the zip:

| Area | Budget | Hard gate |
|---|---|---|
| Per file | the values in the table of §1.1 | `lsp_static_check.js` fails the build above the per-file budget |
| `os/leasing/` total (excluding `LSP_standalone.html`) | 1.5 MB | fails above |
| Single demo plan SVG string | 60 000 characters (06 §10) | fails above |
| `LSP_standalone.html` | reported, not capped; not shipped inside the add-on zip (§10.3) | reported |

---

## 3. Phase plan

### 3.1 Definition of done — common to every phase

Every phase closes only when all of these are true. Phase-specific criteria are listed with each phase and are additional.

1. `node --check` passes for every changed JS file.
2. `lsp_static_check.js` and `lsp_unit_tests.js` are green; at the end of the phase the full seven-script battery runs and its JSON is committed to `docs/qa/lsp/` (`10_QA_PLAN.md §7`).
3. Every new control carries a `data-action` with a registered handler and the `data-testid` of `10_QA_PLAN.md §2.7`.
4. Every new user-facing string exists in `data/i18n.js` in both EN and RU.
5. No hex colour literal in views or `js/floorplan.js`; no business constant outside `js/config.js`.
6. No inline event handler, no `fetch()` of a local file, no external script, no `eval`.
7. Every screen and panel added in the phase renders an explicit empty state; any destination or action that is not implemented is visibly labelled "future" and disabled (`00_MASTER_PROMPT.md §63`, §69).
8. Every number added shows its denominator or `n/a` with a reason (D6).
9. Every new route and every new action is gated by the role check of `04_ROLES_AND_VISIBILITY.md §3.2` / §3.3.
10. Every state-changing action writes `auditLog`, and every status or stage change also writes `statusHistory`.
11. Size budgets of §2.9 still hold.
12. A `docs/leasing-platform/CHANGELOG_LSP.md` entry exists for the phase (§10.5).
13. No CASE OS file outside `os/leasing/` has changed (`git diff --name-only` guard, §10.4).

### 3.2 Review gates

Five gates are formal and require the sponsor's sign-off before the next phase starts: **G1** (end of Phase 0), **G2** (end of Phase 2), **G3** (end of Phase 6), **G4** (end of Phase 8), **G5** (end of Phase 12). Every other phase ends with a short written summary (what was built, what the QA JSON says, what changed in the plan) and a demonstration on request, but does not block. A gate that cannot be held within three working days proceeds on the documented recommendation and is recorded in the changelog as "proceeded without sign-off"; this keeps the critical path moving and keeps the decision visible.

### Phase 0 — Skeleton, state, config, demo, login

| Item | Content |
|---|---|
| Goal | A bootable application shell with real persistence, real configuration, a first demo dataset and role-aware prototype login |
| Files | `index.html`, `css/lsp.css`, `data/i18n.js`, `js/config.js`, `js/state.js`, `js/ui.js`, `data/demo.js` (structure only), `js/views/dashboard.js` (placeholder), `README.md` |
| Deliverables | `LSP_VERSION`; design tokens light/dark; hash router with role gating; one delegated listener per event type; `t()`, `esc()`, formatters; `appState` with all 20 collections of `00_MASTER_PROMPT.md §8`; `nextId()`; debounced save to `caseos-lsp-state-v1` with the Saving / Saved / Unsaved indicator and `beforeunload` guard (08 §2); `DEFAULT_CONFIG` seeded into `appState.settings`; demo users, clients, projects, buildings, floors and units; login screen with the sentence "Prototype authentication only. This does not provide production security."; role badge, logout, DEMO DATA banner, EN/RU toggle, theme toggle |
| Screens working (§63) | 1 Login; navigation shell with every other destination present and explicitly labelled "in build" |
| Flows testable (§64) | Flow 1 (internal login) |
| Definition of done | §3.1, plus: all eight demo users of `04_ROLES_AND_VISIBILITY.md §1.3` can log in and show different navigation; refresh preserves the session; `LSP.persistence.createStore()` runs in Node; the shell renders at all six QA viewports without clipping |
| Review gate | **G1 formal**: visual direction (D14), default UI language (A-1), demo-user list (A-2), navigation structure |
| Effort | 4 sessions (A-09-4) |
| Risks | Token or layout rework if G1 rejects the visual direction; demo-data schema churn while `03_DATA_MODEL.md` is still settling — mitigated by building `data/demo.js` as a function, not a literal |

### Phase 1 — Projects, buildings, floors, units

| Item | Content |
|---|---|
| Goal | The property spine: project, building, floor and unit records that can be listed, created, edited and validated, with status history |
| Files | `js/views/projects.js`, `js/views/units.js`, `js/services.js` (first substantial part), `js/state.js` (writers), `js/ui.js` (table, filters, drawer shell), `data/demo.js` |
| Deliverables | Projects list and project dashboard shell (identity, areas, mandate, team, structure tree); building and floor editing; units table with the `00_MASTER_PROMPT.md §26` filter set, active filter chips and Reset All; internal unit drawer (non-plan variant) with the sections of `00_MASTER_PROMPT.md §15`; area and uniqueness validation; `commercialStatus` changes writing `statusHistory` and `auditLog`; declared versus computed GLA shown separately (D6); `externalIds` fields |
| Screens working (§63) | 3 Projects List; 4 Project Dashboard (structure and identity; KPIs arrive in Phase 6); 6 Units Table |
| Flows testable (§64) | Part of Flow 2 (project selection) and Flow 3 (status change without the plan) |
| Definition of done | §3.1, plus: unit IDs unique and `unitNumber` unique per project; an area entered as text or negative is rejected with a field-level message; a status change is visible in the table and in the drawer immediately and survives refresh; `repairIntegrity()` reports zero issues on the demo state |
| Review gate | Written summary; demonstration of the units table and drawer to the Head of Leasing & Sales |
| Effort | 4 sessions |
| Risks | Drawer scope creep (deal and document sections are stubs until Phases 4 and 5) — the stubs must be labelled, not hidden |

### Phase 2 — Floor plan engine

| Item | Content |
|---|---|
| Goal | The acceptance feature of `00_MASTER_PROMPT.md §13`: real clickable polygons, five modes, legends, and the mapping wizard |
| Files | `js/floorplan.js`, `data/demo-plans.js`, `docs/qa/tools/lsp_gen_demo_plans.js`, `css/lsp.css` (plan and legend), `js/views/projects.js` (host screen), `js/services.js` (`planViewModel`) |
| Deliverables | Sanitize → inject → bind → decorate → colorize → legend → tooltip pipeline (06 §4.2); binding by `data-unit-id` then `id`/`data-code`; versioned `floorPlans` with `polygonMappings`; the five modes (Leasing/Sales status, Merchandise mix, Target vs Actual, Manager, Availability) each with its own legend, labels, tooltips and non-colour indicator; pan and zoom; "Not on plan" panel; mobile fallback list; Plan Import / Mapping Wizard with SVG, JSON polygon and raster paths, auto-match, manual assignment, manual polygon drawing, and clearly labelled EXPERIMENTAL text-label matching; three demo plans (§6.4) |
| Screens working (§63) | 5 Interactive Floor Plan |
| Flows testable (§64) | Flow 2 (open project → plan → floor), Flow 4 (mix modes; the gap figures arrive in Phase 6) |
| Definition of done | §3.1, plus the `00_MASTER_PROMPT.md §65` "Floor plans" block: plan loads, units clickable, correct unit selected, hover works, all modes and legends correct, floor switching works, zoom and pan work, a status change repaints the polygon, plan and table show the same state, exactly one click handler; the sanitizer rejects the hostile SVG fixture; a CAD-like fixture yields "0 polygons found" plus label suggestions, never a silent success |
| Review gate | **G2 formal**: plan usability and readability in light and dark, label density, mode set, wizard flow |
| Effort | 6 sessions |
| Risks | Hand-authored SVG geometry takes longer than estimated; label collisions on dense floors; dark-mode contrast (fallback per Q-02-7: the plan canvas stays light) |

### Phase 3 — CRM

| Item | Content |
|---|---|
| Goal | Brands, companies, contacts and requirements as separate connected records, with duplicate warnings and deterministic matching |
| Files | `js/views/crm.js`, `js/services.js`, `data/demo.js`, `js/config.js` (categories) |
| Deliverables | Brand database and brand detail (classification, expansion requirements, relationship, history, notes, documents, activity); companies separate from brands, one company to many brands; central contacts with multi-brand links and consistent phone formatting; requirement records; non-blocking duplicate warnings on name, phone and email; deterministic brand-to-unit matching in both directions with a per-criterion explanation and the disclaimer that suggestions are not recommendations (`00_MASTER_PROMPT.md §39`) |
| Screens working (§63) | 10 Brand Database, 11 Brand Detail, 12 Companies, 13 Contacts, 14 Requirements |
| Flows testable (§64) | Flow 5 steps 1–4 (search, profile, contacts, requirements); steps 5–7 need Phase 4 |
| Definition of done | §3.1, plus: a brand can be created, edited and found by search; a contact links to several brands and exactly one company; the duplicate warning appears and can be dismissed without blocking the save; matching output lists the criteria that matched and those that did not |
| Review gate | Written summary; the Head of Leasing & Sales reviews the brand field set against daily practice |
| Effort | 4 sessions |
| Risks | Matching weights are a judgement call (07 §7); they are configuration so they can be tuned after the gate |

### Phase 4 — Pipelines

| Item | Content |
|---|---|
| Goal | Leasing and sales deals as the only owner of stage, with Kanban, table and plan views over one data store |
| Files | `js/views/pipeline.js`, `js/services.js`, `js/config.js` (stages, lost reasons, commission rules), `data/demo.js` |
| Deliverables | Deal records per `00_MASTER_PROMPT.md §24` with `type` Leasing or Sales; the 16 leasing stages and the 16 sales stages from config; stage moves writing `dateEnteredStage` and `statusHistory`; Closed Lost requiring a reason; multi-unit deals and multi-prospect units; deal detail with commercial terms, `termsHistory` deviations (D20), next action, activity list, documents, commission block with configurable completion rule; Kanban with drag and drop that records history, sortable and filterable table, and the same deals visible through plan polygons; derived unit display status (D5) now live on plan and table |
| Screens working (§63) | 7 Leasing Pipeline, 8 Sales Pipeline, 9 Deal Detail |
| Flows testable (§64) | Flow 5 complete, Flow 8 (multi-unit deal area) |
| Definition of done | §3.1, plus the `00_MASTER_PROMPT.md §65` "Pipelines" block; `dealArea` equals the sum of GLA of distinct linked units; a unit with three open deals still counts its area once wherever inventory is shown; sales-only fields never appear on a leasing deal and the reverse (05 §5.1) |
| Review gate | Written summary; sponsor confirms the commission-completion default (Q-02-2) and commission visibility (Q-02-4) against the built screen |
| Effort | 5 sessions |
| Risks | Drag and drop reliability — if it cannot be made reliable it is replaced by an explicit stage selector rather than shipped half-working (`00_MASTER_PROMPT.md §25`) |

### Phase 5 — Tasks, activities, comments, documents, notifications

| Item | Content |
|---|---|
| Goal | The daily-work layer: what must be done, what happened, what was said and which file proves it |
| Files | `js/views/tasks.js`, `js/views/activities.js`, `js/views/documents.js`, `js/services.js`, `js/ui.js` (timeline, notification list) |
| Deliverables | Tasks per `00_MASTER_PROMPT.md §27` with one-click completion and rescheduling; activity records of the 13 types of `§28` and timelines on brand, company, contact, project, unit and deal; internal notes and client-visible comments with `responseStatus` Open / In Review / Resolved; document registry with the 13 categories, versions, visibility and registration from the unit, deal, brand and project drawers; local notification list built from local data only (`§45`) |
| Screens working (§63) | 15 Tasks, 16 Activities, 18 Documents |
| Flows testable (§64) | Flow 6 (leasing deal end to end, including document registration and commission states) |
| Definition of done | §3.1, plus the `§65` "Tasks and activities" and "Documents" blocks; a document marked `internal` is absent from every client-scope service output (proved by a service-level test before the portal exists); a task created from the unit drawer appears in the tasks screen and in the dashboard counters once Phase 6 lands |
| Review gate | Written summary |
| Effort | 4 sessions |
| Risks | Local object URLs do not survive a refresh — the limitation is stated in the UI and in the README, never worked around (`00_MASTER_PROMPT.md §6.2`) |

### Phase 6 — Dashboard, KPI, merchandise mix

| Item | Content |
|---|---|
| Goal | Correct numbers: inventory buckets that partition GLA exactly once, deal-centric pipeline metrics labelled as such, mix analytics, completeness and staleness |
| Files | `js/services.js` (KPI core), `js/views/dashboard.js`, `js/views/projects.js` (project dashboard), `js/ui.js` (KPI card, inline SVG charts) |
| Deliverables | Internal home dashboard answering "what needs attention today" with portfolio KPIs, today's work, pipeline snapshot and data hygiene (`§33`); project dashboard with the same rules scoped to one project; the inventory bucket algorithm of `07_CALCULATIONS_AND_KPI_RULES.md §2`; pipeline area and weighted pipeline value (§3); merchandise mix target versus actual by GLA and by unit count with gaps, vacant area by category and pipeline area by category; completeness indicators for brand, unit and deal (`§40`); configurable stale rules (`§41`); provenance marks on unit area, rent and status (D16) |
| Screens working (§63) | 2 Internal Home Dashboard; 4 Project Dashboard complete |
| Flows testable (§64) | Flow 3 complete (status change propagates to plan and dashboard), Flow 4 complete, Flow 7 (multiple prospects do not duplicate inventory) |
| Definition of done | §3.1, plus every expected value of the calculation fixture in `10_QA_PLAN.md §5` reproduced by the Node tests; every percentage prints its denominator; a unit without area is excluded from sums and counted in an explicit note; inventory and pipeline figures are visually and textually distinguished |
| Review gate | **G3 formal**: the sponsor and the Head of Leasing & Sales accept the KPI definitions, the under-negotiation threshold (Q-02-1) and the display-status threshold; these are the numbers the owner will be shown |
| Effort | 4 sessions |
| Risks | Disagreement about bucket definitions after the fact would invalidate report content — mitigated by G3 before Phase 8 |

### Phase 7 — Client portal

| Item | Content |
|---|---|
| Goal | A separate, simpler client experience built from a whitelist view model, never from a filtered internal view |
| Files | `js/views/portal.js`, `js/services.js` (`clientView`, `portalProjects`), `js/floorplan.js` (client variant), `css/lsp.css` |
| Deliverables | Client route set with hard redirect of any internal route to `#/portal` (04 §3.2); client dashboard with the approved metric set of `00_MASTER_PROMPT.md §35`; client floor plan with approved status colours through the client status mapping (`§36`); client unit drawer as a separate component from the internal one; comment creation with author, timestamp, related object, visibility and response status; approved documents only; last-update date; internal portal preview for `founder_admin`, `head_ls` and `administrator` (04 §1.4) |
| Screens working (§63) | 19 Client Portal Dashboard, 20 Client Floor Plan |
| Flows testable (§64) | Flow 10 (client comment reaches internal notifications and is resolved); Flow 9 except the report step |
| Definition of done | §3.1, plus the negative matrix RV-01..RV-36 of `04_ROLES_AND_VISIBILITY.md §13` green, including the canary tokens: no `CANARY-INTERNAL`, `CANARY-COMMISSION`, `CANARY-RESTRICTED` or `CANARY-CONTACT` string appears anywhere in the portal DOM, in a portal print output or in any client-scope tool result; the portal renders only from `clientView(projectId, session)` output |
| Review gate | Written summary; the sponsor reviews the portal as a client user before G4 |
| Effort | 3 sessions |
| Risks | A convenience shortcut that renders an internal component in the portal would break P-4 — prevented by the rule that the portal imports no internal view module |

### Phase 8 — Reports and print

| Item | Content |
|---|---|
| Goal | Reports generated from current data, with an auditable "changes since previous report" and a print path that produces a clean PDF |
| Files | `js/views/reports.js`, `js/services.js` (report builders, snapshots), `css/lsp.css` (`@media print`) |
| Deliverables | Client report with the section list of `00_MASTER_PROMPT.md §37` and the exclusions enforced by `clientView()`; internal leasing, sales, activity and data-quality reports; report records (`RPT-`) storing the snapshot that "changes since previous report" is computed against; print stylesheet hiding navigation, drawers, toasts and controls, expanding table viewports, forcing light tokens and keeping provenance marks legible in monochrome; plan and legend fit on one page |
| Screens working (§63) | 17 Reports |
| Flows testable (§64) | Flow 9 complete (client prints or downloads the report), Flow 11 (reporting) |
| Definition of done | §3.1, plus the `§65` "Reports" block: both report types work, reflect current data, exclude internal information from the client report, print without clipping at A4, and browser Save as PDF produces the same content |
| Review gate | **G4 formal**: the sponsor accepts the client-facing output — the report as the owner will receive it, and the portal as the owner will see it |
| Effort | 3 sessions |
| Risks | Print clipping is discovered late; mitigated by making one print check part of every phase from Phase 6 onwards |

### Phase 9 — Persistence hardening, import and export

| Item | Content |
|---|---|
| Goal | Data that cannot be silently lost, and the ability to move it in and out |
| Files | `js/state.js`, `js/views/importexport.js`, `docs/qa/lsp/fixtures/*` |
| Deliverables | Backup slot `caseos-lsp-backup-v1` written before each successful save; migrations by `meta.schemaVersion`; corruption recovery screen with restore backup, download raw, import JSON and reset to demo (never a blank app); quota guard with the storage panel and reduction actions; JSON export `LSP_backup_YYYY-MM-DD.json` and CSV export per table; JSON import with schema and referential-integrity validation, preview with counts and warnings, confirm and cancel, replace-all only in v0.1; CSV import with column mapping preview for brands, companies, contacts and units; the CASE OS backup adapter with detection, dry-run report and confirmation (08 §9) |
| Screens working (§63) | 22 Import / Export |
| Flows testable (§64) | Flow 12 (persistence, export, reset, import) |
| Definition of done | §3.1, plus the `§65` "Persistence and import/export" block; every validation error code of 08 §7.1 is produced by a fixture; an invalid import never replaces state; the truncated and hostile fixtures both land on the recovery screen; the adapter dry run reports counts and warnings before anything is written |
| Review gate | Written summary; the Head of Leasing & Sales runs one CASE OS backup import on a local machine and reports what the adapter missed |
| Effort | 4 sessions |
| Risks | localStorage quota on the shared `caseadvisory.uz` origin (A-02-2) — the quota guard and plan-size reporting exist for exactly this |

### Phase 10 — Settings UI

| Item | Content |
|---|---|
| Goal | Every business rule of `00_MASTER_PROMPT.md §44` editable without touching code |
| Files | `js/views/settings.js`, `js/config.js`, `js/state.js` (config merge and tombstones) |
| Deliverables | Editable unit statuses with colour, text colour, pattern, `countsAs`, `availabilityGroup` and `clientStatus`; leasing and sales stages with rank and probability; lost reasons; merchandise categories and subcategories with aliases (D21); client status mapping; report visibility; stale thresholds; commission rules and the completion rule; currencies and units; document visibility defaults; notification rules; prototype users (so real staff can be added without demo data); reset a section to defaults |
| Screens working (§63) | 21 Settings |
| Flows testable (§64) | none new; every earlier flow is re-run against an edited configuration |
| Definition of done | §3.1, plus: adding a status makes it appear in the drawer selector, the plan legend, the units filter and the client status mapping without a code change; renaming a label never changes a key; deleting a status that is in use is refused with the list of affected units; every settings save writes an `auditLog` entry with before and after |
| Review gate | Written summary; the Head of Leasing & Sales edits the configuration unaided as the acceptance test |
| Effort | 3 sessions |
| Risks | Config edits that break a rendering assumption; mitigated by the entry-completeness validation in the form |

### Phase 11 — Search, tool registry, Ask palette, responsive polish

| Item | Content |
|---|---|
| Goal | Global search, the provider-independent tool layer, the deterministic Ask palette (D17) and the responsive and print finish |
| Files | `js/tools.js`, `js/views/ask.js`, `js/ui.js`, `css/lsp.css`, all views (responsive pass) |
| Deliverables | Global search over project, building, floor, unit, brand, company, contact, deal, task and document with object type and context in every result (`§43`); `LSP.tools` registry covering all 26 functions of `§52` with `name`, `description`, `params`, `readOnly`, `requiredRole`, `visibilityScope`; `LSP.runTool` applying the permission checker, writing audit entries and returning result envelopes labelled platform / calculated / unavailable; the deterministic Ask palette with the ten intents of `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §3`, labelled "Ask (prototype) — deterministic commands, no AI", not rendered for client sessions; responsive pass at all six viewports; print pass on every printable screen |
| Screens working (§63) | none new; the palette is a component on screen 2 |
| Flows testable (§64) | none new; the responsive sweep covers every screen |
| Definition of done | §3.1, plus: no tool reachable by a client session returns internal data (tested at tool level, not only in the UI); no external network call exists anywhere in the codebase and the static check proves it; the palette answers only from tool output and shows the supported phrasings on an unmatched input; the responsive sweep produces no clipping, no horizontal page scroll and usable mobile quick actions |
| Review gate | Written summary; sponsor decides whether the palette ships in v0.1 (Q-09-2) |
| Effort | 3 sessions |
| Risks | The palette invites scope creep toward an assistant; the closed intent table and the "no AI" label are the boundary. D17 makes the palette a planned deliverable, while `01_PRODUCT_SPEC.md` Q-01-7 and `02_REQUIREMENTS_REVIEW.md` Q-02-3 still treat it as optional — see Q-09-2 |

### Phase 12 — QA, packaging and deliverables

| Item | Content |
|---|---|
| Goal | The complete check-up of `00_MASTER_PROMPT.md §65`, the packaged release and the documentation set of `§66` |
| Files | `docs/qa/tools/lsp_*.js`, `docs/qa/lsp/*`, `os/leasing/README.md`, `docs/leasing-platform/*` (as-built revisions), `CHANGELOG_LSP.md` |
| Deliverables | The seven QA scripts and the standalone bundler complete and green; the QA report `docs/qa/lsp/LSP_QA_REPORT_v0.1.0.md` and the known-limitations file per the templates in `10_QA_PLAN.md §8`; `os/leasing/README.md` final (EN with a short RU summary); as-built revisions of `01_PRODUCT_SPEC.md`, `03_DATA_MODEL.md`, `04_ROLES_AND_VISIBILITY.md`, `05_STATUSES_STAGES_AND_CONFIG.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`, `13_CASE_OS_v4731_REUSE.md`; the add-on zip `CASE_OS_LSP_v0.1.0.zip` with the install note and `SHA256SUMS`; the CASE OS guard run |
| Screens working (§63) | all 22, or explicitly labelled as partial in the QA report |
| Flows testable (§64) | all 12 |
| Definition of done | §3.1, plus: every `§65` check has a result row; the manual checklist has been run on a real tablet and phone by the Head of Leasing & Sales; `verify_full_qa.js` and `role_access_qa.js` on `os/` keep their pre-existing pass counts; the diff against CASE OS files outside `os/leasing/` is empty; the zip contains no secret, no `.claude/`, no `CLAUDE.md`, no `graphify-out/`; no model identifier or session link appears in any repository file |
| Review gate | **G5 formal**: release sign-off by the sponsor, the Head of Leasing & Sales and the engineer, recorded in the QA report |
| Effort | 4 sessions |
| Risks | Defects found late in QA consume the phase; mitigated by running the fast battery on every commit from Phase 0 |

### 3.3 Effort summary

| Phase | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Sessions | 4 | 4 | 6 | 4 | 5 | 4 | 4 | 3 | 3 | 4 | 3 | 3 | 4 | **51** |

A-09-4 defines the unit. 51 focused sessions is roughly 25 to 26 engineer-days of implementation for one engineer, excluding sponsor review time, rework after gates and the planning work already done. Add 15 % contingency for the first three phases, where the data model is still settling. With two engineers the schedule is bounded by the critical path of §4 (35 sessions) plus coordination, not by the total.

---

## 4. Dependency graph between phases

```text
                     ┌─► Phase 2  Floor plan ───────────────┐
Phase 0 ─► Phase 1 ──┤                                       ├─► Phase 6 ─► Phase 7 ─► Phase 8 ──┐
 shell     property  └─► Phase 3 ─► Phase 4 ─► Phase 5 ──────┘   KPI        portal     reports   │
                          CRM      pipelines  tasks/docs          │                              ├─► Phase 12
                                                                  ├─► Phase 9  persistence, I/E  │   QA, release
                                                                  ├─► Phase 10 settings UI       │
                                                                  └─► Phase 11 search, tools ────┘
```

| Phase | Hard predecessors | Why | May run in parallel with | Blocks |
|---|---|---|---|---|
| 0 | — | — | — | everything |
| 1 | 0 | needs state, config, IDs | — | 2, 3 |
| 2 | 1 | polygons bind to units | 3, 4, 5 | 6 (mix modes), 7 (client plan) |
| 3 | 1 | brands attach to projects and units | 2 | 4 |
| 4 | 3 | deals need brands, companies, contacts | 2 | 5, 6 |
| 5 | 4 | documents and activities attach to deals | 2 | 6 (hygiene counts), 9 (all collections exist) |
| 6 | 2, 4, 5 | KPI needs inventory, pipeline and activity data | 9, 10 | 7, 8, 10, 11 |
| 7 | 6, 2 | portal shows KPIs and the plan | 9, 10 | 8, 11 |
| 8 | 6, 7 | client report is the portal content in print form | 9, 10 | 12 |
| 9 | 5 | export and CSV need every collection | 6, 7, 8 | 11, 12 |
| 10 | 6 | Settings edits must be observable in the KPI and plan consumers | 7, 8, 9 | 12 |
| 11 | 6, 7, 9 | tools need services, client scope and the import surface | 8, 10 | 12 |
| 12 | all | — | — | release |

**Critical path:** 0 → 1 → 3 → 4 → 5 → 6 → 7 → 8 → 12, 35 sessions. **Off-path:** Phase 2 (6), Phase 9 (4), Phase 10 (3), Phase 11 (3).

**Safe two-engineer split (A-09-5):** engineer A owns `js/state.js`, `js/services.js`, `js/config.js` and the critical path; engineer B takes Phase 2 in full, then Phases 9, 10 and 11. The two must not edit `js/services.js` in the same phase; `js/ui.js` changes are coordinated because every view depends on it.

**If time runs out**, cut in the reverse order of `00_MASTER_PROMPT.md §67`: visual polish first, then the Ask palette, then CSV import, then the external-agent stub, then the Manager plan mode. Never cut data correctness, role separation or state synchronisation (Q-09-8).

---

## 5. Screen-by-screen build checklist

### 5.1 Identity and build order

Routes are those of `04_ROLES_AND_VISIBILITY.md §3.2`. "Phase" is the phase at which the screen is complete; a phase in brackets is where its shell first appears.

| # | Screen (`§63`) | Route | View file | Phase |
|---|---|---|---|---|
| 1 | Login | `#/login` | `index.html` shell + `js/ui.js` | 0 |
| 2 | Internal Home Dashboard | `#/home` | `js/views/dashboard.js` | 6 (0) |
| 3 | Projects List | `#/projects` | `js/views/projects.js` | 1 |
| 4 | Project Dashboard | `#/projects/:id` | `js/views/projects.js` | 6 (1) |
| 5 | Interactive Floor Plan | `#/projects/:id/plan` | `js/views/projects.js` + `js/floorplan.js` | 2 |
| 6 | Units Table | `#/units` | `js/views/units.js` | 1 |
| 7 | Leasing Pipeline | `#/pipeline/leasing` | `js/views/pipeline.js` | 4 |
| 8 | Sales Pipeline | `#/pipeline/sales` | `js/views/pipeline.js` | 4 |
| 9 | Deal Detail | `#/deals/:id` | `js/views/pipeline.js` | 4 |
| 10 | Brand Database | `#/brands` | `js/views/crm.js` | 3 |
| 11 | Brand Detail | `#/brands/:id` | `js/views/crm.js` | 3 |
| 12 | Companies | `#/companies` | `js/views/crm.js` | 3 |
| 13 | Contacts | `#/contacts` | `js/views/crm.js` | 3 |
| 14 | Requirements | `#/requirements` | `js/views/crm.js` | 3 |
| 15 | Tasks | `#/tasks` | `js/views/tasks.js` | 5 |
| 16 | Activities | `#/activities` | `js/views/activities.js` | 5 |
| 17 | Reports | `#/reports` | `js/views/reports.js` | 8 |
| 18 | Documents | `#/documents` | `js/views/documents.js` | 5 |
| 19 | Client Portal Dashboard | `#/portal` | `js/views/portal.js` | 7 |
| 20 | Client Floor Plan | `#/portal/plan` | `js/views/portal.js` + `js/floorplan.js` (client variant) | 7 |
| 21 | Settings | `#/settings` | `js/views/settings.js` | 10 |
| 22 | Import / Export | `#/importexport` | `js/views/importexport.js` | 9 |

### 5.2 Components, data, actions, empty state, print

| # | Components | Data (services) | Key actions (`data-action`) | Empty state | Print |
|---|---|---|---|---|---|
| 1 | user cards, demo-code field, warning block | `users` | `auth.pickUser`, `auth.submit` | "No demo users — reset demo data" | no |
| 2 | KPI grid, attention lists, pipeline snapshot chart, hygiene list, notifications, Ask panel | `portfolioKpis`, `attentionLists`, `pipelineByStage`, `hygieneReport` | `nav.go`, `task.complete`, `task.reschedule`, `ask.submit` | per card: "No data yet — add a project" | KPI sheet |
| 3 | table, filters, chips, new-project form | `searchProjects`, `filterProjects` | `project.new`, `project.open`, `filters.*` | "No projects match these filters" | list |
| 4 | identity panel, area panel with declared vs computed GLA, KPI cards, mix chart, structure tree, team, documents, notes | `projectKpis`, `inventoryBuckets`, `aggregateMerchandiseMix`, `projectChanges` | `building.add`, `floor.add`, `unit.add`, `project.edit`, `nav.go` | "No buildings yet — add a building" | KPI sheet |
| 5 | project/building/floor selectors, mode switch, SVG canvas, legend, tooltip, zoom controls, unit drawer, "Not on plan" panel, wizard | `planViewModel` | `plan.setMode`, `plan.setFloor`, `plan.zoom`, `plan.selectUnit`, `plan.openWizard`, `unit.*` | "No plan for this floor — open the mapping wizard" | plan + legend, one page |
| 6 | table, filter set of `§26`, chips, completeness and provenance marks, drawer | `filterUnits`, `unitDisplayStatus`, `getDataCompleteness` | `unit.open`, `unit.setStatus`, `filters.*`, `units.export` | "No units match these filters" | list |
| 7, 8 | Kanban columns, cards, table view toggle, filters, stage aging badges | `getDealsByStage`, `pipelineArea`, `pipelineValue` | `pipeline.setView`, `deal.moveStage`, `deal.open`, `deal.new` | "No deals in this pipeline yet" | table |
| 9 | header with stage bar, terms panel with `termsHistory`, units panel, contacts, activity timeline, documents, commission block, tasks | `getDeal`, `dealArea`, `isDealFinanciallyComplete`, `timeline` | `deal.setStage`, `deal.setLostReason`, `deal.editTerms`, `deal.addActivity`, `deal.registerDoc`, `deal.linkUnit` | "No activity recorded yet" | deal sheet |
| 10, 11 | table, search, brand form, classification, expansion requirements, contacts, requirements, history, matching panel | `searchBrands`, `suggestUnitsForBrand`, `getDataCompleteness` | `brand.new`, `brand.save`, `brand.createDeal`, `match.explain` | "No brands yet — create one or import a CSV" | brand profile |
| 12 | table, company form, linked brands, contacts | `searchCompanies` | `company.new`, `company.save`, `company.openBrand` | "No companies yet" | no |
| 13 | table, contact form, multi-brand selector, duplicate warning | `searchContacts`, `duplicateWarnings` | `contact.new`, `contact.save`, `contact.linkBrand` | "No contacts yet" | no |
| 14 | table, requirement form, linked brand, create-deal action | `searchRequirements`, `suggestUnitsForBrand` | `requirement.new`, `requirement.createDeal` | "No requirements recorded" | no |
| 15 | grouped lists (overdue, today, next 7 days, no next action), task form | `getOverdueTasks`, `tasksByBucket` | `task.new`, `task.complete`, `task.reschedule`, `task.assign` | "Nothing due — no open tasks" | list |
| 16 | timeline, type filter, entity filter | `timeline`, `activitiesByManager` | `activity.add`, `filters.*` | "No activity in this period" | no |
| 17 | report type selector, period selector, report root, section list, approve and print actions | `generateOwnerReport`, `internalReports`, `getProjectChanges` | `report.generate`, `report.print`, `report.approve` | "No report generated yet" | primary print target |
| 18 | table, category and visibility filters, register form, version list | `getVisibleDocuments` | `doc.register`, `doc.open`, `doc.setVisibility`, `doc.newVersion` | "No documents registered" | list |
| 19 | project selector, approved KPI cards, mix chart, recent changes, key deals, next actions, comments, documents, last update | `clientView`, `portalProjects` | `portal.selectProject`, `portal.submitComment`, `portal.printReport`, `portal.openDoc` | "No updates yet for this project" | client report |
| 20 | floor selector, plan (client variant), client drawer, comment box | `clientView`, `planViewModel` (client variant) | `portal.setFloor`, `portal.selectUnit`, `portal.submitComment` | "No approved plan for this floor" | plan + legend |
| 21 | tab bar, editable tables per config section, colour pickers, reset-to-default, users panel | `LSP.config.effective()`, `configUsage` | `settings.editRow`, `settings.addRow`, `settings.saveSection`, `settings.resetSection` | not applicable (config always seeded) | no |
| 22 | export buttons, import file input, validation panel, preview, CSV mapping table, storage panel, reset-demo confirmation, backup restore | `LSP.persistence.*` | `io.exportJson`, `io.exportCsv`, `io.importFile`, `io.confirmImport`, `io.cancelImport`, `io.resetDemo`, `io.restoreBackup` | "No import in progress" | no |

Every screen additionally renders the "Not available for your role" screen instead of its content when the role check denies the route, and logs `route_denied` to `auditLog` (04 §3.2).

---

## 6. Demo dataset build plan (D4)

### 6.1 Form

`data/demo.js` exports `LSP.demo.build({ buildDate })` and returns a **fresh** state object on every call (no shared mutable references, no module-level literal reused across resets). Records are generated from compact tables inside the file rather than written out one by one, which keeps the file inside its budget and makes a field rename a one-line change. Randomness is a small seeded generator with a fixed seed, so two builds with the same `buildDate` are byte-identical. All dates are computed relative to `buildDate` so "overdue", "due today" and "next seven days" stay meaningful whenever the demo is reset (08 §5).

### 6.2 Content inventory

| Area | Content | Source |
|---|---|---|
| Clients | `CLIENT-001` (Demo City Mall owner), `CLIENT-002` (Demo Business Park owner) | D4 |
| Users | the eight demo users of `04_ROLES_AND_VISIBILITY.md §1.3`; no password field on any user | `§32`, D4 |
| Projects | `PROJ-001` Demo City Mall (retail, leasing only), `PROJ-002` Demo Business Park (office plus plinth retail, leasing and sales) | D4 |
| Structure | `BLDG-001` with `FLOOR-001` and `FLOOR-002`; `BLDG-002` with `FLOOR-003`; 45 units `UNIT-001`..`UNIT-045` | 06 §10 |
| Brands / companies / contacts | about 24 brands across at least 8 categories, about 10 companies, about 30 contacts | `§47`, D4 |
| Requirements | at least 6, of which 2 unmatched to any deal | `§21` |
| Deals | about 25 leasing deals spread across the 16 stages including Closed Lost with reasons, about 6 sales deals | `§47` |
| Deliberate fixtures | one unit with 3 open deals (Flow 7); one deal linked to 2 units (Flow 8); one unit without area; one unit without category; one deal without next action; one stale deal; one brand without contacts; one duplicate-looking contact pair | `§64`, `§65`, `§40` |
| Tasks / activities / comments | tasks overdue, due today and in the next 7 days; activities of at least 6 types; comments with `responseStatus` Open, In Review and Resolved | `§27`, `§28`, `§29` |
| Documents | internal, client-visible and restricted documents, at least one with two versions; at least one approved report record | `§30`, `§37` |
| Labels | every record carries `demoRecord: true`; `meta.origin = 'demo'`; the DEMO DATA banner is visible after a reset | D4 |
| Canaries | every internal note contains `CANARY-INTERNAL`, every restricted comment `CANARY-RESTRICTED`, every commission note `CANARY-COMMISSION`, every contact phone `CANARY-CONTACT`; no canary appears in any client-visible text | 04 §13 |

Prohibited in demo data (A-2, D4): CASE Advisory's real clients and projects (Creative Avenue, Zarafshan Mall, Gulistan, Mega House), the real brand base `os/data/case_brands_base.xlsx`, the CASE OS demo logins, and any real staff name. Real staff are added later through Settings › Users.

### 6.3 Build order inside Phase 0, 1, 3, 4 and 5

Demo data grows with the schema rather than being written once: Phase 0 produces users, clients, projects, buildings, floors and units; Phase 1 adds areas, categories and statuses; Phase 3 adds brands, companies, contacts and requirements; Phase 4 adds deals, terms and stage history; Phase 5 adds tasks, activities, comments and documents. The demo validation tests (`lsp_unit_tests.js --only=demo`, `10_QA_PLAN.md §6`) are extended in the same phase, so a broken fixture is caught the day it is written.

### 6.4 Demo SVG authoring

The three demo floors are authored as polygon SVGs, not exported from CAD. FACT: `os/zarafshan-l2.svg` is a CAD export with 994 `<path>`, 64 `<text>` and no closed unit shapes with ids, which is why CASE OS binds plans through text labels; a demo that depends on that path could not satisfy `00_MASTER_PROMPT.md §13` ("true clickable polygons").

Procedure:

1. Sketch the floor on paper or in any vector editor to fix proportions; the plan is schematic, not a survey.
2. Write the SVG with the generator script `docs/qa/tools/lsp_gen_demo_plans.js` (06 §10): it emits the geometry from a compact table of rectangles and paths, so a unit can be resized by editing one row.
3. Structure: `viewBox="0 0 1200 800"` (`PLAN-003`: `0 0 1000 700`); a `g[data-layer="walls"]` with walls, cores and voids; a `g[data-layer="units"]` with one `<path>` or `<rect>` per unit carrying `id="p-<unitNumber>"` and `data-unit-id="UNIT-0nn"`.
4. No transforms on unit polygons, no `<text>` inside the units layer (the engine draws labels), no `<style>` block, no font reference, no image, no script, no external reference.
5. Coordinates to at most one decimal; polygon sizes plausible relative to `area.glaM2` so a 2 400 m² anchor is visibly larger than a 60 m² shop and all three label tiers are exercised.
6. Each plan stays below 60 000 characters; the generator prints the character count and fails above it.
7. Include the edge cases of 06 §10: one kiosk polygon with no unit, one unit with no polygon, one archived version with `svgDropped: true`.
8. Ship `polygonMappings` pre-populated (`source: 'attribute'`, `confirmed: true`) so rendering never depends on implicit binding, and commit the result as JS strings in `data/demo-plans.js`.
9. Verify: the plan passes the sanitizer unchanged, every polygon binds, the legend totals equal the units-table totals for the same floor, and the file opens from `file://`.

---

## 7. Settings and configuration plumbing

### 7.1 Path from default to consumer

```text
js/config.js  DEFAULT_CONFIG          (the seed and the "reset to defaults" source)
      │  first boot, or reset to demo
      ▼
appState.settings                     (what the user has edited; persisted in caseos-lsp-state-v1)
      │  LSP.config.effective()       deep merge: objects by key, arrays by entry `key`,
      ▼                               additive for new defaults, tombstones for user-deleted entries
effective config  ─►  js/services.js (rules, thresholds, probabilities, commission, mapping)
                  ─►  js/floorplan.js (colour, textColor, pattern, legend order)
                  ─►  js/ui.js        (badges, currency and unit formatting, notification rules)
                  ─►  js/views/*.js   (selector option lists — never a literal list)
```

Rules:

- Nothing except the seed and "reset to defaults" reads `DEFAULT_CONFIG` directly; every consumer reads the effective config.
- Entry **keys are immutable** once data references them. Settings edits a label, a colour, an order or a flag; a key change is a migration, not an edit.
- When `DEFAULT_CONFIG` gains a new entry in a later version, the merge adds it to an existing state unless the user deleted that key, which is recorded as `{ key, _deleted: true }` so the addition is not resurrected on every load.
- Every settings save writes one `auditLog` entry with the section, the key and the before and after values, and emits one `state:replaced` event so all open views re-render.
- Deleting or deactivating an entry that is in use is refused with the list of affected records.

### 7.2 Configuration sections and their consumers

| Section | Consumers | Phase in which the consumer appears | Covered by |
|---|---|---|---|
| `unitStatuses` | services (buckets), floorplan (colour, legend), units table, drawer, client mapping | 1, 2, 6 | `10_QA_PLAN.md §3.3`, §3.4 |
| `leasingStages`, `salesStages` | services (derived stage, pipeline), pipeline views, deal detail | 4 | §3.6, §3.7 |
| `lostReasons` | deal detail guard, lost-reasons report | 4, 8 | §3.6 |
| `merchandiseCategories`, subcategories, aliases | mix analytics, plan modes, brand classification, CSV and CASE OS import | 2, 3, 6, 9 | §3.7 |
| `clientStatusMapping` | portal, client report | 7, 8 | §3.10 |
| `visibilityLevels`, `reportVisibility`, `documentVisibility` | `clientView`, documents, reports | 5, 7, 8 | §3.9, §3.10 |
| `staleThresholds` | dashboard attention lists, deal and brand badges, provenance staleness | 6 | §3.8 |
| `commissionRules`, completion rule | deal detail, dashboard "closed won", commission reports | 4, 6, 8 | §3.6 |
| `currencies`, `units`, `rentUnits` | formatters, terms panels, KPI value | 1, 4, 6 | §3.7 |
| `notificationRules` | notification list | 5 | §3.8 |
| `thresholds.displayStage`, `thresholds.negotiationStage` | derived display status, inventory buckets | 2, 6 | §3.7 (Q-02-1) |
| `plan` (label tiers, zoom limits, pattern set) | floorplan | 2 | §3.4 |

### 7.3 Worked example — adding a unit status

1. Settings › Statuses › Add. 2. Enter `key` (lower snake_case, immutable), EN and RU labels, `kind: 'inventory'`, `availabilityGroup`, `countsAs`, `color`, `textColor`, `pattern`, `clientStatus`. 3. The form refuses to save while any of those is empty, because rendering, bucketing and the portal all depend on them. 4. Save writes the entry, an `auditLog` row and one event. 5. The status appears immediately in the drawer selector, the units filter, the plan legend and the client status mapping table. 6. No code changes. 7. `lsp_unit_tests.js --only=calc` and `lsp_role_access.js` are re-run because bucket membership and the client mapping changed (10 §7).

---

## 8. Internationalisation plan

### 8.1 Model

`data/i18n.js` holds `I18N = { en: {…}, ru: {…}, uz: {} }`. English is the base and the fallback (D3, A-1). `t(key, params)` returns `I18N[lang][key]`, then `I18N.en[key]`, then the key itself with a console warning in development. Parameters are named placeholders: `t('units.countWithoutArea', { n: 3 })`. The active language lives in `caseos-lsp-ui` (D9) and is toggled from the header; the toggle re-renders the active view and the plan legend, and nothing else has to know.

### 8.2 Key namespaces

| Namespace | Content | Example |
|---|---|---|
| `app.*` | shell, header, navigation, save indicator, banner, errors | `app.save.unsaved` |
| `<screen>.*` | one namespace per screen key of §5.1 | `pipeline.column.loi` |
| `drawer.*` | unit and deal drawer sections and fields | `drawer.commercial.askingRent` |
| `status.*`, `stage.*`, `category.*`, `lostReason.*`, `role.*`, `docType.*`, `activityType.*` | configuration labels; the key after the dot is the config entry key | `status.contract_signed` |
| `kpi.*` | KPI card titles, denominators, `n/a` reasons | `kpi.leasedGla.denominator` |
| `validation.*`, `import.*` | field messages and the validation and import codes of 08 §7.1 | `import.error.E-REF-UNIT` |
| `prov.*` | provenance confidence words and staleness text (D16) | `prov.conf.verified` |

Configuration labels are held in **both** places by design: the config entry carries the EN and RU label for export and for the Settings table, and `data/i18n.js` carries the same strings under `status.<key>` so that a user-renamed label overrides the dictionary. The resolution order is: user-edited config label for the active language, then the dictionary, then the key.

### 8.3 Working rules

- A string reaches the UI only through `t()`. A literal in a view is a defect caught by the static check.
- EN is written first; the RU string is added in the same commit. A missing RU value falls back to EN and is listed by the static check as a coverage gap.
- Keys are stable once shipped: a wording change edits the value, never the key.
- Demo content is data, not UI text, and is not translated.
- Pluralisation: no grammatical plural engine in v0.1. Counts are rendered as "n units" style patterns that read correctly in both languages, and the Russian strings are written to accept any number ("Помещений: 3").
- Formatting: thousands separator is a non-breaking space in both languages; decimal separator is a point in EN and a comma in RU; dates are `DD.MM.YYYY` in RU and `D MMM YYYY` in EN; currency and rent unit come from the record (D20).

### 8.4 Extraction and audit

The i18n audit runs inside `lsp_static_check.js` (`10_QA_PLAN.md §2.1` layer S) and reports four numbers: keys defined in EN, keys defined in RU, keys used in code but not defined, and keys defined but never used. It also flags user-facing literals by scanning `js/views/*.js` and `js/ui.js` for quoted strings that reach an HTML template without passing through `t()`, and any Cyrillic literal outside `data/i18n.js` and `data/demo.js`. The gate: zero undefined keys from Phase 0 onwards, and 100 % RU coverage before G5. Uzbek stays an empty dictionary in v0.1; the transliteration approach of the live CASE OS build is documented for later in `13_CASE_OS_v4731_REUSE.md`.

---

## 9. Responsive plan

### 9.1 Breakpoints

| Breakpoint | Width | QA viewport (D10) | Layout |
|---|---|---|---|
| Wide | ≥ 1600 px | 1920×1080 | Persistent left navigation, 4-column KPI grid, drawer 480 px beside the content, plan and legend side by side |
| Standard | 1280–1599 px | 1440×900 | Same, 3-column KPI grid, drawer 420 px |
| Compact | 1024–1279 px | 1366×768, 1024×768 | Navigation collapses to icons with labels on hover and focus; 2-column KPI grid; filters collapse into a "Filters" button with a popover; drawer 400 px and overlays the content |
| Tablet | 768–1023 px | 820×1180 | Navigation becomes a top bar with an overflow menu; 2-column KPI grid; tables scroll horizontally inside their viewport container; drawer becomes a bottom sheet at 70 % height; plan keeps pan and zoom with larger touch targets |
| Mobile | < 768 px | 390×844 | Single column; navigation becomes a bottom bar of five destinations plus "More"; KPI cards stack; tables become stacked record cards with the three most important fields; drawer is a full-screen sheet; the floor plan is replaced by the unit list with an explicit "Open plan" action |

### 9.2 What collapses, in order

Filters → chips row (chips stay, controls move into a popover). Table columns → priority order per screen, keeping identifier, status and the one number the screen exists for. KPI grid → fewer columns, never smaller type. Drawer → side panel, overlay, sheet. Plan → pan/zoom canvas, then list with "Open plan". Charts → the same inline SVG with fewer labels, never a bitmap.

### 9.3 Mobile quick actions (`00_MASTER_PROMPT.md §48`)

The phone layout is for lookup and small updates, not for the full desktop plan experience. Guaranteed on mobile: global search; open a unit, brand, contact or deal and read it; change a deal stage and its next action; complete or reschedule a task; add a comment or an internal note; read and answer a client comment. Not guaranteed on mobile: the mapping wizard, Settings editing, import and export, and report generation — these render a short explanation and a link to open the screen on a larger display rather than a broken layout.

### 9.4 Verification

`lsp_responsive.js` renders every screen at the six viewports and records one screenshot each; the assertions are no horizontal page scroll, no clipped text, navigation reachable, drawer fully visible, table inside its container, and touch targets at least 40 px on the mobile viewport (`10_QA_PLAN.md §3.13`, §3.16). Screenshots are reviewed by the engineer at every phase that changes `css/lsp.css`.

---

## 10. Release process

### 10.1 Versioning

`LSP_VERSION` is declared once, in `os/leasing/index.html`, and is the single source for the header version tag, the export file names, the QA result file names and the zip name. CASE OS `APP_VERSION`, `os/core.js`, `os/sw.js` and its cache name are **not** touched (D11). Numbering: `0.1.0` is the MVP; `0.1.x` for fixes inside the MVP scope; `0.2.0` for the next agreed phase set. The version is bumped in the same commit that builds the release artefacts, never earlier.

### 10.2 Service-worker coexistence

FACT: the CASE OS service worker `os/sw.js` is registered at scope `/os/` and its navigation fallback returns the CASE OS `index.html`. LSP registers no service worker of its own. Before any release to hosting, the behaviour of `https://caseadvisory.uz/os/leasing/` **with the CASE OS service worker already installed in the browser** is verified (`lsp_e2e_flows.js --sw`, `10_QA_PLAN.md §2.2`). If the fallback intercepts the LSP navigation, the correction belongs to CASE OS `sw.js` and is a separate change requiring explicit approval; it is not made silently as part of the LSP release.

### 10.3 Packaging

| Artefact | Content | Rule |
|---|---|---|
| `CASE_OS_LSP_v0.1.0.zip` (D18) | `os/leasing/` only, plus a one-page install note and `SHA256SUMS` | Drops into the live `os/` of any CASE OS version without touching another file; total 1.5 MB; excludes `.claude/`, `CLAUDE.md`, `graphify-out/`, `docs/`, any `config.php`, any `*.sqlite`, any backup |
| `os/leasing/LSP_standalone.html` | everything inlined by `docs/qa/tools/lsp_bundle.js` | For testing from disk and for hand-off. RECOMMENDATION: delivered as a separate file, **not** inside the add-on zip, because it duplicates the whole application and would roughly double the package on a host with 1.89 of 1.95 GB used |
| `CASE_OS_vX_os_only.zip` | the normal CASE OS release | `os/leasing/` travels inside it automatically once it exists under `os/`. The first release in which this happens must be a conscious decision (Q-09-5), because it publishes the prototype to hosting |

Installation follows the CASE OS practice: free disk space first, upload with hidden files shown, verify with `sha256sum -c SHA256SUMS`, then confirm the version tag in the running page. Details in `13_CASE_OS_v4731_REUSE.md`.

### 10.4 Guard: no CASE OS change

Before every release candidate:

```text
git diff --name-only <branch-base>..HEAD -- os/ ':!os/leasing/'     → must print nothing
node docs/qa/tools/verify_full_qa.js                                 → pass count unchanged
node docs/qa/tools/role_access_qa.js                                 → pass count unchanged
```

The first command is the mechanical form of D1 and D11: LSP is additive. The other two prove that adding a folder under `os/` did not disturb the production application.

### 10.5 Branch, commits and changelog

- Work happens on the branch `claude/new-session-gz8f1m` (D11). No push to `main`, no pull request without explicit permission.
- No model identifier, session link, API key, password or token appears in any commit, file or file name (`00_MASTER_PROMPT.md §55`).
- Commit granularity: one commit per coherent step inside a phase (for example "units table + filters", "plan legend + tooltips"), never one commit per phase and never a mixed commit that touches CASE OS files. Subject in the repository's existing style, `Leasing & Sales platform: <what changed>`, at most 72 characters; the body lists the files and the QA scripts that were run.
- The fast battery (`node --check`, `lsp_static_check.js`, `lsp_unit_tests.js`, under 20 seconds) must be green before a commit is pushed.
- `docs/leasing-platform/CHANGELOG_LSP.md` is created in Phase 0 and updated in every phase. Format:

```markdown
# Changelog — CASE OS · Leasing & Sales Platform (LSP)

## Unreleased
### Phase 4 — Pipelines — 2026-xx-xx
Added: leasing and sales deals, Kanban and table views, stage guards, lost reasons, commission block.
Changed: unit display status is now derived from open deals (D5).
Files: js/views/pipeline.js, js/services.js, js/config.js, data/demo.js.
QA: lsp_static_check 42/42, lsp_unit_tests 118/118, lsp_e2e_flows flows 5 and 8 pass. Results: docs/qa/lsp/.
Known issues: drag and drop not yet keyboard-accessible (tracked for Phase 11).

## v0.1.0 — <date>
Summary of the MVP, link to the QA report, zip name and SHA-256.
```

Each entry states date, phase, what was added or changed, the files touched, the QA evidence and the known issues. A phase without a changelog entry does not meet the definition of done.

---

## 11. Documentation deliverables (`00_MASTER_PROMPT.md §66`)

| § | Deliverable | File | Written / revised | Owner |
|---|---|---|---|---|
| A | Working HTML prototype | `os/leasing/` | Phases 0–12 | Engineer |
| B | Product summary | `os/leasing/README.md` (EN with a short RU summary) and the as-built revision of `01_PRODUCT_SPEC.md`; index in `docs/leasing-platform/README.md` | README drafted in Phase 0, final in Phase 12 | Engineer |
| C | Data model documentation | `03_DATA_MODEL.md` | Planning; revised at the end of Phases 1, 4 and 12 | Engineer |
| D | Role matrix | `04_ROLES_AND_VISIBILITY.md` | Planning; revised at the end of Phase 7 and Phase 12 | Engineer |
| E | Configuration documentation | `05_STATUSES_STAGES_AND_CONFIG.md` (`js/config.js` is the executable source) | Planning; revised at the end of Phase 10 | Engineer with the Head of Leasing & Sales |
| F | Known limitations | "Limitations" section of `os/leasing/README.md` and `docs/qa/lsp/LSP_KNOWN_LIMITATIONS_v0.1.0.md` (template in `10_QA_PLAN.md §8.2`) | Phase 12, from notes kept in the changelog from Phase 0 | Engineer |
| G | Future production architecture | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` | Planning; revised Phase 12 | Engineer |
| H | QA report | `docs/qa/lsp/LSP_QA_REPORT_v0.1.0.md` plus the result JSON in `docs/qa/lsp/` (template in `10_QA_PLAN.md §8.1`) | Phase 12 | Engineer, signed by the sponsor and the Head of Leasing & Sales |

Continuous, outside the `§66` list: `docs/leasing-platform/CHANGELOG_LSP.md` (every phase), `13_CASE_OS_v4731_REUSE.md` (revised before packaging), the install note inside the add-on zip (Phase 12), and `docs/leasing-platform/README.md` as the index and decision log (kept current whenever a D or Q item is resolved).

---

## 12. Approval gate before Phase 0

`02_REQUIREMENTS_REVIEW.md §7.4` defines the approval sequence. This section states what must close before the first line of Phase 0 is written, and what may proceed on the documented recommendation.

| Item | Decision to take | Recommendation | Blocks Phase 0? | Owner |
|---|---|---|---|---|
| D1 | Build LSP as a self-contained module at `os/leasing/` beside CASE OS, with no change to CASE OS files | Approve | **Yes** — folder, README and packaging all depend on it | Founder / product sponsor |
| Q-02-8 | Placement: inside `os/` (reachable on hosting) or outside `os/` (local files only) | Inside `os/`, not linked from CASE OS navigation, prototype warning on every screen | **Yes** | Founder / product sponsor |
| Q-09-1 | What happens to the existing single-file spike `os/leasing/index.html` | Keep it as a reference copy outside the release path, rebuild to the D2 structure, harvest its demo data and plans | **Yes** — it occupies the target path | Founder with the engineer |
| A-1 | UI language: EN base plus RU, `t()` from day one, default EN | Approve | No (rework limited to labels) | Founder; Head of Leasing & Sales |
| A-2 | Demo data fully fictional; real staff added in Settings | Approve | No, but `data/demo.js` cannot be finished without it | Founder |
| A-3 | Merchandise categories: master prompt list plus the five additions of D15, with an editable CASECATS mapping | Approve | No | Head of Leasing & Sales |
| Q-02-9 | Default currency and rent unit | USD and `USD/m2/month`; UZS configured; no FX conversion in v0.1 | No | Head of Leasing & Sales |
| Q-09-5 | Release channel for v0.1.0: add-on zip only, or also inside the next full CASE OS zip | Add-on zip `CASE_OS_LSP_v0.1.0.zip` for v0.1.0; folding into the full zip is a separate, later decision | No, but required before the first release candidate | Founder |
| A-09-4, A-09-5 | Effort unit and team shape (one engineer, or two with the split of §4) | Acknowledge; the plan assumes one engineer | No | Founder |

**May start on the recommendation without waiting:** Q-02-1 (stage thresholds), Q-02-2 (commission completion rule), Q-02-4 (commission visibility), Q-02-7 (dark-mode plan fallback) — all four have config defaults in `05_STATUSES_STAGES_AND_CONFIG.md`, so a later change is a settings edit, not a rewrite. Q-02-5 (whether real operational data may be entered during validation) does not block coding but must be settled before the team starts using the prototype.

**Sign-off block for G0 (to be completed on approval):** Founder / product sponsor — name, date. Head of Leasing & Sales — name, date. Engineer — name, date. The same block is repeated for G1, G2, G3, G4 and G5 in `docs/leasing-platform/CHANGELOG_LSP.md`.

---

## 13. Assumptions, open questions, cross-references

### 13.1 Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | UI language: EN base dictionary, RU second, default EN (D3) | Dictionary order changes; no code impact because every string goes through `t()` |
| A-2 | Demo data is fictional and labelled; real CASE Advisory data is never committed (D4) | `data/demo.js` must be rewritten; the demo validation tests change |
| A-3 | Merchandise categories are the master prompt list plus the D15 additions, editable in Settings | Configuration change only |
| A-09-4 | One "focused engineering session" is about half a working day of uninterrupted implementation by one engineer who has already read the planning documents. Estimates exclude sponsor review time, rework after gates and the planning work itself | The 51-session total scales proportionally; the phase ratios stay valid |
| A-09-5 | One engineer builds the MVP. Where two work in parallel, §4 defines the only safe split | With two engineers the schedule is bounded by the 35-session critical path; merge conflicts in `js/services.js` become the main risk |
| A-09-6 | The existing single-file spike can be used as a reference and its demo content and plans can be harvested | If it is discarded entirely, Phase 0 and Phase 6 grow by about 3 sessions in total |
| A-09-7 | Demo plans stay hand-authored SVG below 60 000 characters each. A CAD export would break the D18 size budget and would not produce clickable polygons | The plan phase grows and the add-on zip exceeds 1.5 MB |
| A-09-8 | No continuous integration exists; every check runs locally on the engineer's machine before each commit. FACT: there is no autodeploy, and the workflow file `case-site/.github/workflows/deploy-os.yml` is not relied on | Discipline replaces automation; a missed local run is caught only at the phase-end full battery |

### 13.2 Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-09-1 | A single-file prototype already exists at `os/leasing/index.html` (about 262 KB, committed on the working branch before this planning cycle, with a Russian `README.md`). It already uses the D9 storage keys, the D13 ID formats and the D7 role keys, but it is one file with inline handlers and without the D2 module structure. Refactor it into the D2 structure, or rebuild and keep it only as a reference? | Rebuild to the D2 structure in Phase 0 and keep a reference copy outside the release path. Harvest its demo dataset, its SVG plans and any working logic, but do not keep two implementations: a second source of truth is exactly what `00_MASTER_PROMPT.md §3.1` forbids. The spike predates decisions D16–D22 and the QA `data-testid` contract, so incremental patching would cost more than a structured rebuild | Founder / product sponsor, with the engineer |
| Q-09-2 | Is the deterministic Ask palette a required Phase 11 deliverable (D17) or optional (`01_PRODUCT_SPEC.md` Q-01-7, `02_REQUIREMENTS_REVIEW.md` Q-02-3, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §3`)? | Treat it as required per D17, because the owner already works this way in the CASE OS geo agent; drop it only if the Phase 12 budget is at risk. Decide at the Phase 10 gate, and align the three sibling documents with whatever is decided | Founder / product sponsor |
| Q-09-3 | Gate cadence: does the sponsor review every phase, or only the five formal gates of §3.2? | Five formal gates plus a short written summary after every other phase. More gates slow the critical path; fewer would let the client-facing output drift | Founder / product sponsor |
| Q-09-4 | One engineer or two in parallel? | One engineer for Phases 0 and 1 in any case; from Phase 2 a second engineer can take the plan engine and later Phases 9 to 11 with the split of §4 | Founder / product sponsor |
| Q-09-5 | Release channel for v0.1.0: the add-on zip only (D18), or also inside the next `CASE_OS_vX_os_only.zip` (D11)? The two decisions are not identical, because anything under `os/` travels with the full zip automatically | Add-on zip for v0.1.0 and an explicit decision before the first full CASE OS release that includes `os/leasing/`. Publishing a prototype to the production host is a business decision, not a packaging detail | Founder / product sponsor |
| Q-09-6 | Language of `CHANGELOG_LSP.md`: repository documents are Russian, planning documents are English | English entries with a one-line Russian summary per released version, matching the README convention of D3 | Founder; Head of Leasing & Sales |
| Q-09-7 | Should the live CASE OS v4.73.1 `os/` be committed to the repository before LSP packaging (Q-BRIEF-1)? | Yes, as a separate change without `api/config.php`, before Phase 12, so the coexistence and guard checks run against what is actually deployed rather than against v4.51.0 | Founder / product sponsor |
| Q-09-8 | If the budget is exhausted before Phase 8, what is cut? | Cut in the reverse order of `00_MASTER_PROMPT.md §67`: visual polish, Ask palette, CSV import, external-agent stub, Manager plan mode. Never cut data correctness, role separation or state synchronisation. Phases 6, 7 and 8 are the point of the prototype and are protected | Founder / product sponsor |

### 13.3 Cross-references

`00_MASTER_PROMPT.md` (§3.1, §3.5, §5, §8, §12, §13, §14, §15, §16, §22, §23, §25, §26, §27, §28, §29, §30, §32, §33, §34, §35, §37, §39, §40, §41, §42, §43, §44, §45, §46, §47, §48, §52, §55, §62, §63, §64, §65, §66, §67, §69); `01_PRODUCT_SPEC.md` (§5.1 phase names, §5.2 MVP items to screens, §6 flows, §12 assumptions and open questions); `02_REQUIREMENTS_REVIEW.md` (§4 risk register, §5 trims, §7 decisions required before coding and the approval sequence); `03_DATA_MODEL.md` (entities, ID allocation, integrity rules, field-level CASE OS mapping); `04_ROLES_AND_VISIBILITY.md` (§1.2 session, §1.3 demo users, §3.2 routes, §3.3 actions, §6 client filter pipeline, §13 negative matrix and canaries); `05_STATUSES_STAGES_AND_CONFIG.md` (status and stage entries, guards, lost reasons, `DEFAULT_CONFIG` skeleton, Settings requirements); `06_FLOORPLAN_ARCHITECTURE.md` (§4 rendering pipeline and public surface, §5 modes, §8 wizard, §10 demo plans, §12 sanitizer and limits, §14 test hooks); `07_CALCULATIONS_AND_KPI_RULES.md` (§2 inventory buckets, §3 pipeline metrics, §6 merchandise mix, §7 matching, §8 completeness); `08_PERSISTENCE_IMPORT_EXPORT.md` (§1 keys, §2 save cycle, §4 recovery, §5 reset, §6–§8 export and import, §9 CASE OS adapter, §12 quota, §14 test hooks); `10_QA_PLAN.md` (§2.1 script set, §2.7 `data-testid` contract, §3 test catalog, §4 flow tests, §5 calculation fixtures, §6 demo validation, §7 regression policy, §8 templates); `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (§2 tool registry, §3 Ask palette, §6 extension points, §7 future production architecture); `13_CASE_OS_v4731_REUSE.md` (reusable patterns, deployment constraints, add-on packaging); `docs/leasing-platform/README.md` (index, decision log, approval checklist). CASE OS sources read for facts: `os/index.html`, `os/core.js`, `os/sw.js`, `os/.htaccess`, `os/zarafshan-l2.svg`, `os/sql/schema_mysql.sql`, `HANDOFF_CASE_OS.md`, `docs/qa/tools/verify_full_qa.js`.
