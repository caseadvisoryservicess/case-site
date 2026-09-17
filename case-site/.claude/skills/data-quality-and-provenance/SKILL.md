---
name: data-quality-and-provenance
description: Data hygiene rules for LSP (os/leasing/) — completeness scoring per master prompt §40 for brands, units and deals, configurable stale rules per §41 (staleThresholds), non-blocking duplicate warnings for brands, companies and contacts, the dashboard data-hygiene and report data-quality checks (§33, §37), demoRecord labeling and the DEMO DATA banner, n/a-not-zero handling, provenance fields (areaSource, relationship.source, externalIds) and source citing in planning documents. Use for "completeness", "stale", "duplicate warning", "data hygiene", "getDataCompleteness", "demoRecord", "provenance", "where does this number come from" or "missing area / category / next action".
---

## Purpose

Make data problems visible instead of silently wrong. In LSP every record can answer four questions:
what is missing (completeness, `00_MASTER_PROMPT.md` §40), how old it is (stale rules, §41), whether it
may be a duplicate (§5 item 30, §65) and where it came from (provenance). The skill enforces "Never treat
unknown values as zero" (§69, brief D6) and the writing rule that every fact in a planning document cites
its source.

## Responsibilities

- Completeness engine (§40, §52 `getDataCompleteness`): required-field lists per entity in
  `config.completenessRules` — brand: category, contacts, expansion requirements, last contact, owner;
  unit: area, status, category, commercial terms, polygon mapping; deal: responsible manager, contact,
  stage, next action, linked unit/project, commercial terms. Output per record
  `{entityType, entityId, present, required, missing: [fieldKey]}`, displayed as "n of m", never as a
  percentage without its denominator.
- Stale engine (§41, §44): rules with thresholds in `config.staleThresholds` — deal without activity for
  X days (`deal.activity.lastContactDate`), brand without contact for X days
  (`brand.relationship.lastContactDate`), unit commercial terms not updated for X days (`unit.updatedAt`
  until a terms-level timestamp is decided — ASSUMPTION, Q-n owner `crm-data-modeler`), mandate expiry
  approaching (`project.commercial.mandateExpiryDate`), no next action (`deal.nextAction.dueDate` empty),
  client comment awaiting response (`comments` with status `Open` older than X days). Output
  `{ruleKey, entityType, entityId, ageDays, thresholdDays, severity, message}`. Which dates count as
  "activity" on a deal is defined by `leasing-pipeline-analyst` / `sales-pipeline-analyst`; this skill
  owns the generic runner and the thresholds table.
- Duplicate warnings (§5 item 30, §33, §65 "duplicate warnings work"): `findDuplicates(entityType,
  record)` on create/edit and in the import preview — brands by normalised `name` / `legalName` (lower
  case, trimmed, punctuation and repeated whitespace collapsed), companies by `legalName` /
  `tradingName`, contacts by phone digits, lower-case email and first + last name. Warnings are
  non-blocking and never auto-merge. `unitNumber` uniqueness inside a project is a blocking validation
  owned by `property-and-unit-data-engineer`; this skill only reports it in the hygiene list.
- Consistency checks feeding §33 "Data hygiene" and §37 "Data quality": records without a responsible
  manager, deals without next action, stale activities, inconsistent unit status (for example
  `commercialStatus` counting as leased while `actualUse.brandId` is empty, or Occupied with an open
  deal), missing floor plans (floor without a `current` plan), units without polygon mapping, duplicate
  contacts / brands, missing category, missing area, missing commercial terms, brands without contacts,
  outdated commercial terms.
- `demoRecord` discipline (§47, D4): every demo record carries `demoRecord: true`; the "DEMO DATA"
  banner shows while any such record exists; imported CASE OS records carry `demoRecord: false` (rule of
  `local-storage-and-import-export`) and a hygiene warning "mixed demo and imported data" appears when
  both kinds exist.
- Provenance, using only fields the model already defines: `unit.geometry.areaSource`
  (`Manual / Plan / Verified`, §11) required whenever `area.glaM2` is set; `brand.relationship.source`
  (§18); `documents.uploadedBy / uploadedAt` and `floorPlans.uploadedBy / uploadedAt` (§10, §30);
  `externalIds.caseOsObjectId / caseOsUnitCode` (D13) on imported records; `createdAt / updatedAt` on
  every record; `statusHistory` (`SH-001`) and `auditLog` (`AUD-001`) for changes (§54). Any additional
  provenance field (for example an import batch reference) is a RECOMMENDATION for `03_DATA_MODEL.md`,
  owner `crm-data-modeler`.
- Source-citing discipline: FACTS cite `00_MASTER_PROMPT.md §n` or a CASE OS file with line;
  ASSUMPTIONS are labeled A-n; RECOMMENDATIONS are separated; open items are Q-n with an owner. On
  request, review another agent's document and list uncited numbers and unlabeled assumptions.
- Hand-offs: entity fields, IDs and migrations → `crm-data-modeler`; area validation ranges, GLA/GBA
  discipline and unit-number uniqueness → `property-and-unit-data-engineer`; brand field semantics →
  `brand-and-market-researcher`; "missing documents" rule shape and demo cases →
  `document-and-file-registry`; rendering of hygiene blocks, badges and the data-quality report section
  → `reporting-and-dashboard-analyst` and `frontend-ux-engineer`; import preview / confirm UI →
  `local-storage-and-import-export`; tool registration → `ai-tool-designer`; Playwright and Node tests
  → `testing-and-qa`.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §3.1, §5 items 29–32, §6.4, §10–§11 (provenance fields), §18, §33 "Data
  hygiene", §34, §37 "Data quality", §40, §41, §42, §44, §45, §47, §52–§54, §65 "CRM", "Calculations",
  "Persistence and import/export", §69.
- `01_PRODUCT_SPEC.md` (items 29–32, NFR-18 demo banner), `02_REQUIREMENTS_REVIEW.md` (X-9, R-4, R-5,
  A-02-3), `03_DATA_MODEL.md`, `05_STATUSES_STAGES_AND_CONFIG.md` (`staleThresholds`, `countsAs`),
  `07_CALCULATIONS_AND_KPI_RULES.md` (missing-value rules), `08_PERSISTENCE_IMPORT_EXPORT.md` (import
  validation), `10_QA_PLAN.md`.

LSP sources (`os/leasing/`, once they exist):
- `js/config.js` (`completenessRules`, `staleThresholds`, `duplicateRules`), `js/services.js` (the only
  place for hygiene logic), `js/state.js` (statusHistory and auditLog writers, `demoRecord` on reset),
  `js/views/dashboard.js`, `js/views/reports.js`, `js/views/importexport.js` (preview hook),
  `data/demo.js`.

CASE OS read-only references (never edited):
- `os/v4450-owner-report.js`: the `quality` tab with `validation` entries at levels error / warning /
  info / ok — precedent for severity levels.
- `os/sql/schema_mysql.sql`: `data_quality_snapshots {score, scope, metrics JSON}` — precedent for a
  hygiene snapshot; `units` `UNIQUE (obj_id, code)`.
- `os/core.js`: `brand()` factory fields `reviewFlag`, `editedBy`, `editedAt` (line 489) — precedent for
  review flags and edit provenance.
- `docs/qa/tools/verify_full_qa.js`: result row shape `{test, status, info}`.

## Outputs

- `js/config.js` entries: `completenessRules` (per entity: field key, label key, presence test),
  `staleThresholds` (days per rule, editable in Settings), `duplicateRules` (fields and normalisation per
  entity).
- Pure functions in `js/services.js` attached to `window.LSP` and `module.exports` (D10):
  `getDataCompleteness(scope)` (§52 name) and proposed helpers `getStaleRecords(scope)`,
  `findDuplicates(entityType, record)`, `getHygieneSummary(projectId)`, `normalizeName()`,
  `normalizePhone()`; registration through `ai-tool-designer`.
- Demo hygiene cases in `data/demo.js` (D4): one unit without area, one unit without category, two
  near-duplicate contacts, one brand without contacts, one deal without next action, one deal beyond the
  stale threshold, one `Open` client comment older than the threshold, one unit without polygon mapping,
  one project with a mandate expiring inside the warning window.
- Provenance rules and the citation checklist for `03_DATA_MODEL.md` and `README.md`; review notes
  listing uncited facts in other documents.
- Test vectors `LSP-QA-nnn` for `10_QA_PLAN.md` (completeness, stale, duplicates, banner, n/a behaviour).
- Chat answers structured as FACTS / ASSUMPTIONS (A-n) / RECOMMENDATIONS with Q-n and owner.

## Constraints

- D6 / §69: a missing value is excluded and counted ("n units without area"), never zero; every
  percentage shows its denominator; KPI cards show "n/a" when inputs are missing.
- §41 / §44: thresholds and required-field lists live only in `config` (seeded by `DEFAULT_CONFIG`) and
  are editable in Settings; no threshold literal in views or services.
- Duplicate warnings are advisory: they never block a save (except unit-number uniqueness), never merge
  records and never rename IDs; merge tooling is outside the v0.1 scope.
- Hygiene results are derived: recomputed from `appState` and never stored, except inside a report
  snapshot (`RPT-001`) built by `reporting-and-dashboard-analyst`.
- D7: hygiene output is internal (it reveals staff performance and negotiation state) and never enters
  `clientView(projectId)`; the client dashboard shows only the "last update date" (§35).
- Provenance values describe origin, not quality: `areaSource: 'Verified'` is set only by a human action
  that writes an `auditLog` entry; imports set `Manual` or `Plan` as the source states.
- D4 / A-2 / A-02-3: demo data is fictional; a state containing imported real data is never committed or
  hosted; `demoRecord` and the banner are the only markers — there is no "real data" mode.
- D1 / D11 / D13: no CASE OS file is modified; LSP lives in `os/leasing/`; IDs `SH-001`, `AUD-001`; UI
  strings go through `t(key)` (D3).
- No production, backend, OCR/CV or security claims; the exact vocabulary of the brief and master prompt
  is used.

## Validation checklist

- [ ] `getDataCompleteness` returns `{present, required, missing}` per record for brands, units and deals
      using the §40 lists from `config.completenessRules`; the UI shows "n of m".
- [ ] Every §41 rule exists in `config.staleThresholds`, is editable in Settings and produces
      `{ruleKey, ageDays, thresholdDays, severity}`; changing a threshold changes the dashboard without a
      demo reset.
- [ ] `findDuplicates` flags the two demo near-duplicate contacts (phone digits / email / name) and a brand
      re-entered with different casing; the save still succeeds with a visible warning.
- [ ] The §33 "Data hygiene" block and the §37 "Data quality" section render only service output; each
      item links to its record.
- [ ] A unit without `area.glaM2` is excluded from every GLA sum and appears in "n units without area";
      no KPI shows 0 for a missing input.
- [ ] Every record in `data/demo.js` has `demoRecord: true`; the "DEMO DATA" banner is visible; after a
      CASE OS import the "mixed data" warning appears.
- [ ] Every unit with `area.glaM2` has `geometry.areaSource`; every research-sourced brand has
      `relationship.source`; every imported project / unit has `externalIds.caseOsObjectId` /
      `caseOsUnitCode`.
- [ ] Status and stage changes write `statusHistory` and `auditLog` entries with user and timestamp (§54).
- [ ] Node tests cover completeness, stale ageing across a threshold, duplicate normalisation and the n/a
      path; ids `LSP-QA-nnn` are listed in `10_QA_PLAN.md`.
- [ ] Reviewed documents: every number, list length or field name is cited (`00_MASTER_PROMPT.md §n`,
      CASE OS file + line) or labeled A-n.
- [ ] `git status` shows no change outside `os/leasing/`, `docs/leasing-platform/`, `docs/qa/lsp/`,
      `docs/qa/tools/lsp_*.js`, `.claude/skills/`.

## Prohibited behavior

- Defaulting missing areas, rents, probabilities, dates or counts to 0 (or any placeholder) in sums,
  percentages or charts.
- Hard-coding thresholds, required-field lists or normalisation rules in views.
- Auto-merging, auto-deleting or renumbering suspected duplicates; blocking saves on advisory warnings.
- Storing completeness scores, stale flags or duplicate results on records in `appState`.
- Setting `areaSource: 'Verified'` or any provenance value programmatically without a recorded human
  action.
- Removing or flipping `demoRecord` on existing records; presenting demo data as real; hosting or
  committing imported real data.
- Sending hygiene results, staff-performance-like metrics or internal flags to the client portal or the
  client report.
- Stating facts in documents without a citation, or dressing assumptions as facts.
- Editing `os/core.js`, `os/v*.js`, `os/sql/`, `os/api/`, `os/index.html`, `os/sw.js`; adding backend or
  network calls.

## Examples

1. Prompt: "The dashboard shows 0 % completeness for brands after the demo reset."
   Expected: FACTS (the §40 brand list and `config.completenessRules`); check whether `required` is empty
   or a presence test is wrong (for example `contactIds` tested as a string); fix in services, not in the
   view; the card shows "n of m" or "n/a" with a reason; add a Node assertion; no rule or threshold added
   to `dashboard.js`.
2. Prompt: "Add a stale rule for mandate expiry approaching."
   Expected: `staleThresholds.mandateExpiryWarningDays` in `DEFAULT_CONFIG` with a Settings field; a rule
   in the runner reading `project.commercial.mandateExpiryDate`; an output row with severity; the
   dashboard block "owners requiring updates" (§33) consumes it; a demo project with an expiry inside the
   window; a test vector; a note that the default number of days is an ASSUMPTION (A-n) with owner Head
   of Leasing & Sales.
3. Prompt: "Review 07_CALCULATIONS_AND_KPI_RULES.md for provenance."
   Expected: a table of statements without a source (line, statement, needed citation or A-n label); a
   check that every worked example's numbers come from `data/demo.js` records; confirmation that
   missing-value behaviour matches D6; proposed wording changes — no edits to the document unless the task
   assigns it.
