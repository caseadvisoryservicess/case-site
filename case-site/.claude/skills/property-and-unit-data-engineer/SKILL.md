---
name: property-and-unit-data-engineer
description: Owns the property side of the LSP data set under os/leasing/: projects, buildings, floors and units, their stable IDs (PROJ-/BLDG-/FLOOR-/UNIT-), area fields and GLA/GBA discipline, inventory-only unit statuses, plan-vs-registry reconciliation, and the property half of the CASE OS backup import adapter (OBJECTS/U to projects/units). Use for "add or edit project/building/floor/unit data", "unit numbering", "area validation", "declared vs computed GLA", "import CASE_OS_backup json", "map CASE OS units", "demo projects", or changes to js/views/projects.js, js/views/units.js or property demo data.
---

# property-and-unit-data-engineer

## Purpose

Keep the property hierarchy of the Leasing & Sales Platform (LSP, `os/leasing/`) correct and
auditable: Client -> Project -> Site (optional) -> Building -> Floor -> Unit
(00_MASTER_PROMPT.md §7). The skill guarantees that every unit exists exactly once, carries one
GLA figure that every KPI reuses, stores only an inventory state in `commercialStatus`, and that
data imported from the production platform CASE OS keeps its provenance instead of being rebuilt
by hand. It is the "property database" of the MVP (§5 items 4–7, §67 priority 3).

## Responsibilities

- Field semantics, defaults and validation for `projects` (§9), `sites`, `buildings`, `floors`,
  `floorPlans` metadata only (§10) and `units` (§11) as specified in `03_DATA_MODEL.md`.
- Unit identity: `id` is `UNIT-001` (global, never reused); `unitNumber` is unique inside a
  project (mirrors CASE OS `UNIQUE KEY uq_unit (obj_id, code)` in `os/sql/schema_mysql.sql`);
  `label` is display-only. `externalIds.caseOsObjectId` / `externalIds.caseOsUnitCode` are
  filled by the import adapter; `propertyId` and `geoMasterId` stay `null` in v0.1 (D13).
- Area discipline: `area.glaM2` is the single leasable figure used by inventory KPIs;
  `grossUnitAreaM2`, `mezzanineM2`, `terraceM2` are informational and never added into GLA sums;
  `geometry.areaSource` is one of `Manual | Plan | Verified`. Project `areas.gbaM2` /
  `areas.glaM2` are DECLARED values; the COMPUTED project GLA is the sum of `units[].area.glaM2`
  over units with a numeric area and is produced by `js/services.js` on demand (D6).
- Unit inventory status (`commercialStatus`, D5) and its change path: every change goes through
  the `js/state.js` writers that append `statusHistory` (`SH-001`) and `auditLog` (`AUD-001`).
- Plan-vs-registry reconciliation service: a port of the CASE OS `planDiff()` idea
  (`os/core.js`) returning `onlyOnPlan`, `onlyInRegistry`, `areaDiff` (tolerance 0.5 m²) between
  a floor's units and the labels/polygons the floor-plan engine reports. "Apply area from plan"
  is an explicit user action that sets `geometry.areaSource = 'Plan'` and writes an audit entry.
- Project totals as services queries: computed GLA, unit count, floor count, "n units without
  area" note, declared-vs-computed delta.
- Property part of the demo dataset (D4, §47): "Demo City Mall" and "Demo Business Park",
  30–50 units, floors and buildings, `demoRecord: true` on every record.
- Property half of the CASE OS import adapter (D1, D9): `OBJECTS` -> `projects`, `U` ->
  `units` with `buildings`/`floors` derived from `block` / `floor` / `PLANSVG` keys
  (`objId::block::floor`), `STAT` split table (status side only), with a preview of counts and
  warnings before anything is written.
- Screens: Projects List, Project Dashboard (data part), Units Table (§63 items 3, 4, 6) in
  `js/views/projects.js` and `js/views/units.js`, using the components of `js/ui.js`.

Hand-offs: appState shape, ID generator, referential-integrity checks and migrations ->
`crm-data-modeler`; SVG geometry, `polygonMappings` and plan versions ->
`interactive-floorplan-engineer`; the deal created by the `STAT` split rule, stage probabilities
and `vars[]` prospects -> `leasing-pipeline-analyst`; `BRANDS`/`DOC_CONTACTS` import ->
`crm-data-modeler` and `brand-and-market-researcher`; CASECATS -> D15 category mapping table ->
`merchandise-mix-analyst`; KPI formulas that consume the areas -> `commercial-real-estate-
financial-analyst` and `reporting-and-dashboard-analyst`; import preview/confirm UI, CSV column
mapping and backup slot -> `local-storage-and-import-export`; provenance and stale flags ->
`data-quality-and-provenance`; `externalIds` contract -> `geoanalytics-integration-architect`.

## Inputs

- `docs/leasing-platform/00_MASTER_PROMPT.md` §3.2, §6.3–§6.5, §7, §9, §10, §11, §12, §34,
  §42, §47, §49 (ID stability), §63 items 3/4/6, §64 flows 2, 3, 7, 8, 12, §65 "Projects and
  units" and "Calculations".
- `docs/leasing-platform/03_DATA_MODEL.md` (entity fields, derived vs stored decision for
  `areas.unitCount` / `areas.floorCount`, CASE OS mapping), `05_STATUSES_STAGES_AND_CONFIG.md`
  (inventory statuses, `countsAs`, `availabilityGroup`), `07_CALCULATIONS_AND_KPI_RULES.md`
  (denominators, missing-value rule), `08_PERSISTENCE_IMPORT_EXPORT.md` (adapter contract,
  validation messages), `09_IMPLEMENTATION_PLAN.md` (phase in which each file is touched),
  `10_QA_PLAN.md` (test ids that cover this area), `02_REQUIREMENTS_REVIEW.md`.
- LSP source (read before editing): `os/leasing/js/config.js` (`DEFAULT_CONFIG` statuses,
  currencies, units), `js/state.js` (ID generation, writers, import core), `js/services.js`
  (property queries), `js/views/projects.js`, `js/views/units.js`, `js/views/importexport.js`,
  `data/demo.js`, `data/i18n.js` (labels for new fields, EN base + RU).
- CASE OS, read-only, for verification of the source structure: `os/core.js` (`unit()` factory
  line 334, `STAT` line 318, `OBJECTS` demo rows 308–311, `glaOf` line 893, `planKey`,
  `unitBlock`, `floorLabel`, `planDiff`, `updateAreasFromPlan`), `os/sql/schema_mysql.sql`
  (`objects`, `units`, `control_dates`, `unit_comments`), `HANDOFF_CASE_OS.md`.

## Outputs

- Property queries and validators in `os/leasing/js/services.js` (pure functions, attached to
  `window.LSP` in browsers and `module.exports` in Node, D10): computed GLA, totals, hierarchy
  integrity report, unit-number uniqueness check, area validator, plan-vs-registry diff.
- The CASE OS adapter functions (property tables) where `08_PERSISTENCE_IMPORT_EXPORT.md`
  places them (import core in `js/state.js` or a dedicated adapter section), returning
  `{records, warnings, counts}` for the preview and never writing state directly.
- `js/views/projects.js`, `js/views/units.js`: list, filters (project, building, floor, unit,
  unit status, area range, category), unit form, project form, totals strip.
- Property records in `data/demo.js` and their EN/RU labels in `data/i18n.js`.
- Node fixtures for `docs/qa/tools/lsp_*.js` handed to `testing-and-qa` (e.g. a 3-unit project
  with one unit without area; a project whose declared GLA differs from computed GLA).
- A short FACTS / ASSUMPTIONS / RECOMMENDATIONS note in the task response whenever a rule is
  not covered by the planning documents (cite `00_MASTER_PROMPT.md §n` or the CASE OS file).

## Constraints

- D1: LSP lives in `os/leasing/`; CASE OS `core.js`, `index.html`, `sw.js`, `APP_VERSION`,
  `os/sql/*` and `os/api/*` are never modified. The adapter READS `CASE_OS_backup_*.json`
  (`stateBlob()` keys `OBJECTS`, `U`, `PLANSVG`, `PLAN_STRUCT`, `PLAN_CODES`); nothing is
  written back to CASE OS.
- D5 / §6.3: `commercialStatus` holds inventory states only (Vacant, Available, Active
  Marketing, Reserved, Contract Signed, Fit-out, Occupied, For Sale, Sold, Temporarily Blocked,
  Not Available, Unknown). Lead, Viewing, Negotiation, LOI, Contract Draft, Sale Negotiation are
  deal stages: they are displayed on units as a DERIVED display status and never stored on them.
- D6 / §6.4 / §34: each unit's GLA is counted once; a missing area is `null`, is excluded from
  sums and reported as "n units without area"; never coerce to 0. Declared project GLA is shown
  as "declared GLA" and never silently substituted for the computed value.
- §9: use GLA and GBA only; do not introduce NLA/GFA fields or labels.
- D13: IDs are generated by the `js/state.js` generator (`UNIT-001` format); never derive an
  LSP `id` from a CASE OS code, and never renumber existing IDs during import or migration.
- Import mapping rules (property side); the full table is maintained in
  `08_PERSISTENCE_IMPORT_EXPORT.md`, this is the binding summary:
  | CASE OS | LSP | Rule |
  |---|---|---|
  | `OBJECTS.id`, `name`, `ru` | `externalIds.caseOsObjectId`, `name`, `alternativeNames[0]` | keep both names |
  | `OBJECTS.gba`, `gla` | `areas.gbaM2`, `areas.glaM2` | declared values, 0 -> `null` + warning |
  | `OBJECTS.type`, `city`, `country`, `lat`, `lng` | `assetTypes[]`, `city`, `country`, `latitude`, `longitude` | type via editable mapping (Mall, Mixed-use, Plinth retail ...) |
  | `OBJECTS.cur`, `sc`, `inc`, `vat`, `vatRate`, `cond` | `commercial.pricingNotes` (text) + warning | never default currency to USD when `cur` is a UZS text |
  | `U.code` | `unitNumber`, `externalIds.caseOsUnitCode` | uniqueness re-checked per project |
  | `U.block` / `PLANSVG` key block / `PLAN_STRUCT` | `buildings[]` (one per block; one default building when none) | default building flagged in warnings |
  | `U.floor` (`'1 этаж'`) | `floors[]` per (building, floor label), `floorNumber` parsed numerically | unparsable label -> `floorNumber: null` |
  | `U.area`, `U.terr` | `area.glaM2`, `area.terraceM2` | 0 -> `null` + warning; `areaSource: 'Manual'` |
  | `U.merged` (`['B1_107','B1_108']`) | ONE unit with the combined `unitNumber`, merged codes listed in `operational.notes` | area stays combined; never split areas by guess |
  | `U.status` (`STAT`) | `commercialStatus` + open deal per the split table in `05_STATUSES_STAGES_AND_CONFIG.md` | deal side -> `leasing-pipeline-analyst` |
  | `U.cat`, `U.sub` | `actualUse` when the unit counts as leased, else `targetUse` | D15 mapping; unknown labels (e.g. `'Еда и напитки'`, `'Торговля'` in demo rows) -> warning, not "Other" |
  | `U.broker`, `U.comment`, `U.hist`, `U.dates` | `responsibility.responsibleManagerId` (name -> user, else warning), internal note, activities, tasks | non-property targets are handed off |
- D4: demo projects are fictional; never copy Creative Avenue, Zarafshan Mall, Gulistan, Mega
  House or their unit codes into `data/demo.js`.
- D3: every new label goes through `t(key)` with EN and RU entries.
- Never claim production security, OCR/CV recognition or a backend; the adapter is a local,
  prototype-only bridge and the README says so.
- Vocabulary: use the entity, field, status and ID names of the context brief and
  `03_DATA_MODEL.md` verbatim; do not create synonyms (e.g. "premises", "space", "NLA").

## Validation checklist

- [ ] Every `units[]` record has a unique `id` and a `unitNumber` unique within its `projectId`;
      `projectId`, `buildingId`, `floorId` resolve and agree with each other.
- [ ] `area.glaM2` is a positive number or `null`; no 0 was written for "unknown".
- [ ] Computed project GLA equals the sum of numeric unit GLAs; the "n units without area" note
      and the declared GLA are both visible where the total is shown.
- [ ] No deal-stage value (Lead, Viewing, Negotiation, LOI, Contract Draft, Sale Negotiation)
      is stored in `commercialStatus`; display status comes from services.
- [ ] Every status change created a `statusHistory` and an `auditLog` entry through `state.js`.
- [ ] Import of a sample `CASE_OS_backup_*.json` produces a preview (counts + warnings), writes
      nothing before confirm, and rejects a file without `OBJECTS`/`U` safely.
- [ ] Imported units carry `externalIds.caseOsObjectId` and `caseOsUnitCode`; merged CASE OS
      records became one unit with a warning, not several units with guessed areas.
- [ ] Plan-vs-registry diff lists `onlyOnPlan`, `onlyInRegistry`, `areaDiff` and applies
      nothing without a user action.
- [ ] Demo property data: 2 projects, 30–50 units, every record `demoRecord: true`, no real
      CASE Advisory client names.
- [ ] Node run of the pure functions (`js/services.js`, `js/config.js`) passes; the browser
      still boots from `file://` and under the `os/.htaccess` CSP.
- [ ] `git diff --stat` shows changes only under `os/leasing/`, `docs/leasing-platform/`,
      `docs/qa/tools/lsp_*`, `docs/qa/lsp/`; no CASE OS file touched.
- [ ] Task response separates FACTS (cited) from ASSUMPTIONS (A-n) and RECOMMENDATIONS.

## Prohibited behavior

- Storing a deal stage, brand negotiation or probability on a unit record.
- Treating a missing area, GLA or count as zero, or filling it with an average or a guess.
- Adding unit GLA more than once (per deal, per prospect, per floor plan) in any total.
- Substituting declared `areas.glaM2` for computed GLA, or the reverse, without a label.
- Inventing unit numbers, floors, buildings or areas for imported CASE OS records beyond the
  documented derivation rules; silently dropping CASE OS fields (every drop is a warning).
- Editing `os/core.js`, `os/sql/*`, `os/api/*`, `os/index.html`, `os/sw.js` or any file outside
  the assignment; bumping `APP_VERSION` or the service-worker cache name.
- Using real CASE Advisory projects, brands or people in demo data.
- Introducing NLA/GFA, a parallel status list, or field names that are not in `03_DATA_MODEL.md`.
- Claiming that the import adapter, localStorage or the prototype login is production-grade.

## Examples

1. Prompt: "Add `Fit-out` handling to the Units Table and make the project totals show leased vs
   available GLA correctly." Expected: read `05_STATUSES_STAGES_AND_CONFIG.md` and confirm
   `Fit-out` has `countsAs: 'leased'` in `DEFAULT_CONFIG`; add nothing to rendering that
   hard-codes the status; extend the totals query in `js/services.js` so buckets partition the
   computed GLA; show the declared GLA separately; add a Node fixture with one unit without area
   and hand the test id to `testing-and-qa`.
2. Prompt: "Import this CASE_OS_backup_2026-09-10.json so the team can test with real
   structures." Expected: run the adapter in preview mode; report counts (projects, buildings
   derived from blocks, floors, units) and warnings (merged codes kept as one unit, categories not
   in the mapping table, currency text carried into `pricingNotes`, brokers not matched to users);
   confirm only after the user accepts; deals for `neg/off/os/cs` statuses are created by the
   split table owned by `leasing-pipeline-analyst`; nothing in CASE OS is changed.
3. Prompt: "The floor plan shows unit F1-014 at 118 m² but the table says 122 m²." Expected:
   run the plan-vs-registry diff for that floor, show the `areaDiff` row (plan 118 / registry
   122, above the 0.5 m² tolerance), and offer "Apply area from plan" which sets
   `geometry.areaSource = 'Plan'` and writes an audit entry; do not change the area automatically
   and do not touch `polygonMappings` (that belongs to `interactive-floorplan-engineer`).
