---
name: local-storage-and-import-export
description: Owns LSP persistence and data exchange in js/state.js and the Import/Export screen - localStorage keys caseos-lsp-state-v1 / caseos-lsp-backup-v1 / caseos-lsp-session / caseos-lsp-ui, meta.schemaVersion migrations, debounced save, backup slot, corrupted-data recovery screen, quota guard, reset to demo, JSON export LSP_backup_YYYY-MM-DD.json, CSV export, validated JSON/CSV import with preview, and the CASE OS backup import adapter. Use for "data disappeared after refresh", "import this backup", "add a migration", "CSV import of brands", "localStorage quota", "recovery screen".
---

## Purpose

Own everything that moves `appState` in and out of the browser for the Leasing & Sales Platform (LSP,
`os/leasing/`, D1): local persistence (00_MASTER_PROMPT.md §46, D9), schema versioning and migrations,
backup and recovery, reset to demo data (§46, §47), JSON/CSV export and validated import (§42), and the
CASE OS backup import adapter (D1). The goal is §46 "Avoid silent data loss" and §42 "Invalid imports must
not corrupt the application", inside the no-backend, no-build constraints (§62).

## Responsibilities

### Persistence (D9, §46)

- Keys: `caseos-lsp-state-v1` (data), `caseos-lsp-backup-v1` (last good copy, written before each
  successful save), `caseos-lsp-session` (prototype session), `caseos-lsp-ui` (UI prefs: language, theme,
  last view). Never rename them.
- `appState.meta = {schemaVersion, savedAt, appVersion}`; `appVersion` = `LSP_VERSION` from `index.html`.
- `saveState()` is debounced (RECOMMENDATION: 500 ms) and drives the header indicator Saving / Saved /
  Unsaved; a `beforeunload` guard fires while unsaved changes exist.
- Save order: serialize -> copy current `caseos-lsp-state-v1` into `caseos-lsp-backup-v1` -> write new
  state -> update `meta.savedAt`. A failed write leaves the backup slot untouched.
- Quota guard: measure the serialized size; warn in the UI above 4 MB and name the driver (SVG plan text
  is the main one, D9); on `QuotaExceededError` keep in-memory state, show a persistent error and offer
  "Export JSON now". IndexedDB is out of scope for v0.1 (D9).
  CASE OS precedent: `persist()` in `os/core.js` degrades by dropping `_HEAVY_LOCAL_KEYS` when the quota
  is exceeded; LSP must not drop data silently, it must tell the user.

### Migrations (D9)

- `MIGRATIONS = [{from: 1, to: 2, up(state){...}}, ...]` in `js/state.js`, run in order on load when
  `meta.schemaVersion` < current; each step is pure, idempotent and logged to `auditLog` (`AUD-nnn`,
  action `state.migrated`).
- A migration never deletes records; it renames, defaults or moves fields. Field semantics come from
  `crm-data-modeler` (03_DATA_MODEL.md); this skill implements the step and its test.

### Recovery (D9, §46, §65)

- Load path: missing key -> seed demo data; unparsable JSON or failed structural check -> recovery
  screen (never a blank app) with three actions: restore `caseos-lsp-backup-v1`, download the raw string
  as `LSP_corrupted_YYYY-MM-DD.json`, reset to demo data.
- Reset to demo data requires confirmation, writes the current state to the backup slot first, and logs
  `state.reset_demo`.

### Export (§42, D9)

- Full JSON `LSP_backup_YYYY-MM-DD.json` = `{meta, ...appState}` without `session` and without transient
  fields (`documents[].localUrl`); pretty-printed; downloaded through a Blob object URL (same mechanism as
  CASE OS `exportAllJSON()` in `os/core.js`, which downloads `CASE_OS_backup_YYYY-MM-DD.json`).
- CSV export per table (§42 data areas: projects, buildings, floors, units, brands, companies, contacts,
  requirements, deals, tasks, activities, comments, documents): UTF-8 with BOM, one header row using the
  stored field names, nested objects flattened with dot paths (`area.glaM2`, `leasingTerms.askingRent`),
  arrays joined with `|`. Exports write an `auditLog` entry (`export.produced`, §54).

### Import (§42, D9)

- JSON import pipeline: parse -> schema check (`meta.schemaVersion` known, every collection is an array,
  each record has an id in the D13 format) -> migrate to current -> referential-integrity check
  (`projectId`, `buildingId`, `floorId`, `unitIds`, `brandId`, `companyId`, `contactIds`, `dealId`,
  `clientIds`, `polygonMappings[].unitId` resolve; ids unique per collection) -> config check (status,
  stage, category, visibility keys exist in `DEFAULT_CONFIG` or imported `settings`) -> preview (record
  counts per collection, warnings, errors) -> Confirm / Cancel -> replace-all (v0.1) -> save -> reload views.
- Any error blocks the import; warnings are listed and require confirmation; the current state is copied
  to the backup slot before replacement. Unlike CASE OS `importAllJSON()` (`os/core.js`: confirm, write
  raw string, `location.reload()`), LSP validates before writing.
- CSV import (v0.1: brands, companies, contacts, units): header detection, column-mapping preview with a
  suggested mapping, per-row validation, duplicate detection against existing records (name, unitNumber
  within a floor, phone/email), and the same Confirm / Cancel step. Imported rows get `demoRecord: false`,
  `sourceKind: 'imported'`.
- CASE OS backup adapter (D1): detects a `CASE_OS_backup_*.json` by its `stateBlob()` keys (`OBJECTS`, `U`,
  `BRANDS`, `DOC_CONTACTS`, `PLANSVG`) and maps OBJECTS -> projects, U -> units (+ building/floor derived
  from `floor`/`merged`/block), BRANDS -> brands (+ companies from `group`), DOC_CONTACTS -> contacts,
  PLANSVG -> floorPlans (text-label binding, marked experimental), `STAT` -> commercialStatus + open deal
  per the split rule in 05_STATUSES_STAGES_AND_CONFIG.md, CASECATS -> categories via the editable table
  (D15). `externalIds.caseOsObjectId` / `caseOsUnitCode` are filled (D13). Mapping rules are owned by
  `property-and-unit-data-engineer` and `crm-data-modeler`; this skill owns the pipeline, preview and tests.
- All imported strings are untrusted: escaped on render, never inserted as HTML; SVG plan text is passed
  to the sanitizer owned by `interactive-floorplan-engineer`; injection handling follows
  `ai-safety-and-permissions`.

### Hand-offs

| Topic | Owner | This skill |
|---|---|---|
| Entity fields, ID formats, derived vs stored | `crm-data-modeler` | implements migrations and validators |
| Unit/area/floor mapping of CASE OS `U` | `property-and-unit-data-engineer` | runs the adapter pipeline |
| SVG sanitizer, `floorPlans` from PLANSVG | `interactive-floorplan-engineer` | calls it, never bypasses it |
| Duplicate/completeness rules reused in import preview | `data-quality-and-provenance` | calls the services |
| Import/Export screen layout, chips, i18n | `frontend-ux-engineer` | supplies the flows |
| Flow 12 scripts and `LSP-QA-nnn` ids | `testing-and-qa` | supplies fixtures |

## Inputs

Planning documents:

- `docs/leasing-platform/08_PERSISTENCE_IMPORT_EXPORT.md` - authoritative for keys, meta, migrations,
  recovery, export/import formats and the CASE OS adapter.
- `docs/leasing-platform/03_DATA_MODEL.md` - collections, ID formats, references to validate.
- `docs/leasing-platform/05_STATUSES_STAGES_AND_CONFIG.md` - keys that imports must resolve; `STAT` split rule.
- `docs/leasing-platform/09_IMPLEMENTATION_PLAN.md` - build order of `js/state.js` and `js/views/importexport.js`.
- `docs/leasing-platform/10_QA_PLAN.md` - Flow 12, §65 "Persistence and import/export".
- `docs/leasing-platform/00_MASTER_PROMPT.md` §6.2, §8, §42, §46, §47, §54, §62, §64 Flow 12, §65.

LSP source files: `os/leasing/js/state.js` (persistence, ids, migrations, backup, recovery, import/export
core), `os/leasing/js/views/importexport.js` (screen), `os/leasing/js/config.js` (`DEFAULT_CONFIG` keys
to validate against), `os/leasing/data/demo.js` (seed and reset source), `os/leasing/js/services.js`
(duplicate/completeness checks reused in previews), `os/leasing/index.html` (`LSP_VERSION`, recovery
screen container).

CASE OS reference (read-only): `os/core.js` `STORAGE_KEY='asaas-os-demo-state-v7'`, `stateBlob()`,
`persist()`, `_HEAVY_LOCAL_KEYS`, `exportAllJSON()`, `importAllJSON()`; a real `CASE_OS_backup_*.json`
is the adapter's input format.

## Outputs

- Code in `os/leasing/js/state.js` and `os/leasing/js/views/importexport.js`; recovery screen markup in
  `os/leasing/index.html`; EN/RU strings in `os/leasing/data/i18n.js`.
- Node-runnable validators and migrations (state.js attaches to `window.LSP` in browsers and
  `module.exports` in Node, D10) with fixtures under `docs/qa/lsp/fixtures/` (valid backup, broken
  reference, corrupted JSON, CASE OS sample backup with fictional data).
- Files produced at runtime: `LSP_backup_YYYY-MM-DD.json`, `LSP_<table>_YYYY-MM-DD.csv`,
  `LSP_corrupted_YYYY-MM-DD.json`.
- README section "Data, backups and limits" (English + short Russian): where data lives, that it is
  per-browser, how to back up, quota, what import validates.
- For analysis requests: FACTS (cite `00_MASTER_PROMPT.md §n` or the file) / ASSUMPTIONS (A-n) /
  RECOMMENDATIONS.

## Constraints

- D9 key names, file names and `meta` shape are fixed; replace-all is the only import mode in v0.1.
- D1/D2: no backend, no `fetch()` of local files, no build step; must work from `file://` and under the
  CASE OS CSP; demo data is loaded via `<script src>` from `data/demo.js`.
- D13: ids come from the central generator; import never renumbers existing ids, and counters are
  re-seeded from the highest imported id per prefix.
- D4: reset restores the fictional demo set only; the adapter never bundles real CASE OS data in the repo.
- §6.2 / §55: no file bytes, no secrets, no claims of secure or encrypted storage; localStorage is
  per-browser and unencrypted, and the README says so.
- §42: preview + validation messages + Confirm + Cancel are mandatory for every import path.
- Do not modify CASE OS files (`os/core.js`, `os/index.html`, `os/sw.js`, `os/api/*`, `os/sql/*`); do not
  read or write the CASE OS key `asaas-os-demo-state-v7`.
- Vocabulary: `appState`, `meta.schemaVersion`, `caseos-lsp-*` keys, `LSP_backup_`, `demoRecord`,
  `externalIds`; never "database", "sync" or "cloud" for local persistence.
- Do not put model identifiers or session links in any repository file.

## Validation checklist

- [ ] Flow 12 in Node + Playwright (`docs/qa/tools/lsp_persistence.js`): change -> refresh -> persisted;
      export JSON; reset demo; import the export; state equal to pre-reset (deep compare minus `savedAt`).
- [ ] `caseos-lsp-backup-v1` holds the previous good state after every save; restore from the recovery
      screen returns the app to that state.
- [ ] Corrupted `caseos-lsp-state-v1` (truncated JSON, wrong type, unknown `schemaVersion` higher than
      current) shows the recovery screen with all three actions; no blank page, no uncaught error.
- [ ] Each migration step has a fixture at `from` and an assertion at `to`; running twice is a no-op.
- [ ] Import fixture with a dangling `unitIds` reference is rejected with a message naming the record id;
      the current state is untouched.
- [ ] Import fixture with an unknown `commercialStatus` key is rejected (or mapped only via the explicit
      mapping table for CASE OS `STAT`).
- [ ] CSV round trip for units and brands: export -> import preview shows identical counts and zero
      warnings; nested fields flattened and restored.
- [ ] CASE OS adapter on the fictional sample backup: projects/units/brands/contacts counts match,
      `externalIds.caseOsObjectId` and `caseOsUnitCode` set, `STAT` split rule applied, PLANSVG entries
      labeled experimental.
- [ ] Quota guard: a state above 4 MB triggers the warning; a simulated `QuotaExceededError` keeps
      in-memory state and shows the export prompt.
- [ ] Header indicator cycles Unsaved -> Saving -> Saved; `beforeunload` prompt appears only when unsaved.
- [ ] Exports and imports write `auditLog` entries; `session` and `localUrl` are absent from exports.
- [ ] No JS errors on load at all D10 viewports; relevant `LSP-QA-nnn` ids named for `testing-and-qa`.

## Prohibited behavior

- Writing an imported string to localStorage before validation (the CASE OS `importAllJSON()` pattern).
- Dropping collections or heavy keys silently on quota errors; losing unsaved state on reload without a guard.
- Inventing new localStorage keys, renaming D9 keys, or storing state under the CASE OS key.
- Merge or partial imports in v0.1; auto-renumbering ids; changing `demoRecord` on existing records.
- Persisting `session`, `documents[].localUrl`, object URLs, file bytes or base64 files.
- Introducing IndexedDB, a service worker, compression libraries or any dependency for persistence.
- Rendering imported values as HTML or executing imported SVG without the sanitizer.
- Committing real CASE OS backups, real client data or `os/data/case_brands_base.xlsx` derivatives as fixtures.
- Describing localStorage as backup, sync, cloud or secure storage in UI or docs.
- Editing CASE OS files or `.github/workflows/deploy-os.yml`.

## Examples

1. "After refresh the new deal disappeared."
   Expected: check the Saving/Saved indicator path and the debounce; reproduce in Playwright (create deal,
   wait for Saved, reload); inspect whether `saveState()` threw (quota) or the write raced with reload;
   fix in `js/state.js`, add the Flow 12 assertion, and report FACT/ASSUMPTION/RECOMMENDATION.
2. "Import this CASE_OS_backup_2026-09-01.json so the team can test with real structures."
   Expected: run the adapter in preview mode; show counts (OBJECTS -> projects, U -> units with derived
   buildings/floors, BRANDS -> brands/companies, DOC_CONTACTS -> contacts, PLANSVG -> floorPlans
   experimental), warnings (units without area, `STAT` values split into `commercialStatus` + open deal,
   unmapped CASECATS), errors; require Confirm; remind that the imported data is real and must not be
   committed or exported into the repository (D4).
3. "Add `deal.areaOverrideM2` to the schema."
   Expected: `crm-data-modeler` defines the field; this skill adds migration `schemaVersion n -> n+1`
   (default `null`), a fixture, the CSV column in export/import, the referential/validation rule
   (number or null), and confirms old backups still import.
