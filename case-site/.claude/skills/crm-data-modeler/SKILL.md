---
name: crm-data-modeler
description: Owns the LSP data model (CASE OS Leasing & Sales Platform, os/leasing/): the appState collections of the master prompt, stable ID formats (PROJ-/UNIT-/BRAND-/COMP-/CONT-/REQ-/DEAL-/TASK-/ACT-/CMT-/DOC-/RPT-/SH-/AUD-), reference and back-reference rules, referential-integrity validation, meta.schemaVersion migration content, derived-vs-stored field decisions, the CRM entity schemas (brands, companies, contacts, requirements, comments, tasks, activities, statusHistory, auditLog) and the field-level CASE OS mapping in 03_DATA_MODEL.md. Use for "add a field", "new entity", "ID format", "foreign key", "dangling reference", "schemaVersion", "migration", "derived or stored", "appState shape", "validateState".
---

## Purpose

Keep `appState` in `os/leasing/js/state.js` a single connected model (`00_MASTER_PROMPT.md` §3.1,
§7, §8) with stable IDs (D13), explicit references, one authoritative place for every fact
(stored or derived, never both) and migrations that let demo, imported and hand-entered data survive
schema changes (D9). Every other skill that adds or reads a field gets its definition from this skill
and from `03_DATA_MODEL.md`.

## Responsibilities

- `appState` shape: exactly the collections of §8 (`users, clients, projects, sites, buildings,
  floors, floorPlans, units, brands, companies, contacts, requirements, deals, tasks, activities,
  comments, documents, reports, settings, statusHistory, auditLog, session`) plus
  `meta {schemaVersion, savedAt, appVersion}` (D9). Any new top-level key is a Q-n.
- IDs (D13): `PREFIX-nnn` per collection (`PROJ, SITE, BLDG, FLOOR, PLAN, UNIT, BRAND, COMP, CONT,
  REQ, DEAL, TASK, ACT, CMT, DOC, RPT, SH, AUD`), zero-padded to at least three digits, allocated
  from per-collection counters kept in `meta.counters`, never reused after deletion, never derived
  from names. `users` and `clients` have no prefix in D13: propose `USER-nnn` / `CLIENT-nnn` as a
  Q-n (owner Founder) and use them until decided. `externalIds {caseOsObjectId, caseOsUnitCode,
  propertyId, geoMasterId}` on projects, buildings and units, `null` in v0.1 unless imported.
- References: every child stores its parent pointer(s) (`unit.projectId / buildingId / floorId`,
  `deal.projectId`, `contact.companyId`, `brand.companyId`); many-to-many links are arrays of IDs on
  the owning side (`deal.unitIds`, `deal.contactIds`, `contact.brandIds`, `task.dealId`). RECOMMENDATION
  recorded in `03_DATA_MODEL.md`: the child pointer is authoritative; parent-side arrays from the
  master prompt schemas (`project.unitIds`, `floor.unitIds`, `unit.dealIds`, `brand.history.dealIds`,
  `company.brandIds`) are indexes rebuilt by a pure `rebuildIndexes(state)` in `js/services.js`
  on load, after import and after every write, never edited by views.
- Integrity: `validateState(state, config)` in `js/services.js` (pure, Node-testable) returns
  `{errors, warnings}` with codes: dangling reference, duplicate ID, `unitNumber` not unique inside
  a project, `stage` / `commercialStatus` / `visibility` / role not in config, deal `type` vs stage
  set mismatch, `unitIds` empty on a deal past Property / Unit Offered (warning), missing
  `demoRecord` flag, missing `createdAt`. Delete rules: records referenced by deals, statusHistory
  or documents are archived (`archived: true`), not removed; hard delete only for unreferenced
  drafts, always logged in `auditLog`.
- Derived vs stored (decision table in `03_DATA_MODEL.md`): stored = `unit.commercialStatus`,
  `deal.stage`, `deal.probability` (explicit override only), `unit.actualUse`, `outcome.*`,
  `provenance`, `termsHistory`; derived by services = unit pipeline stage and display status (D5),
  `dealArea`, project totals and buckets (D6), completeness scores, stale flags,
  `unit.operational.lastActivityDate`, `unit.salesTerms.currentOffer` (best open offer, Q-n raised
  by `sales-pipeline-analyst`), parent-side ID arrays. A derived value is never written back into
  a record, and a stored value is never recomputed silently.
- CRM entity schemas: `brands` (§18, all nested groups incl. `expansionRequirements`,
  `relationship`, `history`, `notes {general, internal}`, `visibility`), `companies` (§19, one
  company owns many brands, `contactIds`, `responsibleManagerId`), `contacts` (§20, `firstName`,
  `lastName`, `position`, `companyId`, `brandIds`, `phones[]`, `emails[]`, `messagingApps[]`,
  `preferredLanguage`, `relationshipOwnerId`, `lastContactDate`, `nextAction`), `requirements` (§21,
  no schema in the master prompt: define `REQ-nnn {brandId | companyId, type Leasing | Sales,
  targetCities, targetProjectIds, category, subcategory, areaMinM2, areaMaxM2, floorPreference,
  budget, timeline, status, ownerId, dealIds, notes}` as a RECOMMENDATION), `comments` (§29:
  author, timestamp, related object `{type, id}`, visibility, status Open / In Review / Resolved),
  `tasks` (§27), `activities` (§28 thirteen types, related object, authorId), `statusHistory`
  (`SH-nnn`: entity, id, field, from, to, at, by, reason), `auditLog` (`AUD-nnn`: user, timestamp,
  action, entity, id, fields changed, `permanent`, tool name when called through `LSP.runTool`),
  `reports` (`RPT-nnn`, shape owned by `reporting-and-dashboard-analyst`).
- Fields introduced by the brief, defined here and placed once: `deal.areaOverrideM2` (D6),
  `deal.commission` record (§38 fields; amounts by `commercial-real-estate-financial-analyst`),
  `deal.termsHistory[]` deviations `{field, from, to, by, at, reason}` (D20),
  inline `provenance` records `{conf, src, how, at, by, name, note}` on `unit.area.glaM2`,
  `unit.leasingTerms.askingRent / agreedRent`, `unit.commercialStatus`, `deal.commercialTerms.*`
  and project areas (D16), `commercialMode: 'leasing' | 'sales' | 'both'` on projects and units
  (§23), `aliases[]` on config taxonomies with a `normalize()` helper (D21).
- Enum discipline: records store the config `key` of a status, stage, visibility level, category
  or role; labels and translations come from `js/config.js` and `data/i18n.js`. Documents may show
  labels for readability; the key ↔ label table is in `05_STATUSES_STAGES_AND_CONFIG.md`.
- Record conventions: `createdAt` / `updatedAt` ISO 8601 strings, `demoRecord` boolean on every
  record (D4), `visibility` on projects, units, deals, brands, documents, comments, notes (§6.8),
  money stored in cents with `currency` (D20), no computed totals stored.
- Migrations: define each `meta.schemaVersion` step's content (renamed, defaulted or moved fields,
  never deleted records) in `03_DATA_MODEL.md`; `local-storage-and-import-export` implements the
  step, its fixture and test. Demo data always ships at the current `schemaVersion`.
- CASE OS mapping (D1, `03_DATA_MODEL.md` §9): the field-level table `BRANDS` → `brands`
  (`cat/sub` via the D15 mapping, `amin/amax` → `expansionRequirements`, `reqs` →
  `fitOutRequirements`, `status active/target/refused` → `relationship.relationshipStatus`,
  `group` → `companies`), `BRANDS.person/phone/email` and `DOC_CONTACTS` → `contacts`, `U.hist`
  → activities, `U.dates` → tasks, plus the "not imported" list; behaviour, warnings and dry-run
  belong to `08_PERSISTENCE_IMPORT_EXPORT.md` §9.
- Hand-offs: project / building / floor / unit field semantics, areas and `unitNumber` rules →
  `property-and-unit-data-engineer`; `floorPlans` geometry and `polygonMappings` →
  `interactive-floorplan-engineer`; stage lists and transition rules → `leasing-pipeline-analyst` /
  `sales-pipeline-analyst`; money semantics → `commercial-real-estate-financial-analyst`; duplicate
  similarity, completeness and stale computation → `data-quality-and-provenance`; role capabilities
  and field whitelists → `client-portal-permissions`; brand content → `brand-and-market-researcher`;
  tool param schemas → `ai-tool-designer`; `externalIds` contract → `geoanalytics-integration-architect`;
  future-module extension points → `building-os-architecture`; persistence, backup slot, import
  pipeline → `local-storage-and-import-export`.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §3.1, §3.2, §6.3–§6.5, §6.8, §7, §8, §9–§11 (for cross-references only),
  §18, §19, §20, §21, §24, §27, §28, §29, §30, §38, §54, §62 (stable IDs, central state), §65
  "Technical review".
- `03_DATA_MODEL.md` (primary document of this skill), `05_STATUSES_STAGES_AND_CONFIG.md` (enum
  keys), `04_ROLES_AND_VISIBILITY.md` §4–§5 (visibility fields and precedence),
  `08_PERSISTENCE_IMPORT_EXPORT.md` §1 (envelope), §7 (import validation), §9 (adapter behaviour),
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §5 (`externalIds`), `13_CASE_OS_v4731_REUSE.md`
  (provenance `PROV` vocabulary, deviations pattern).

LSP sources (`os/leasing/`, once they exist): `js/state.js` (`appState`, `newId()`, counters,
statusHistory and auditLog writers), `js/services.js` (`validateState`, `rebuildIndexes`,
`normalize`), `js/config.js` (enum keys, taxonomies with `aliases`), `data/demo.js` (fixture
validity), `js/views/crm.js` (brands, companies, contacts, requirements forms).

CASE OS read-only references (never edited): `os/core.js` (`BRANDS` field list, `unit()` factory,
`stateBlob()` keys, `STAT`), `os/sql/schema_mysql.sql` (`deals` one-unit-only, `contacts
{name,title,phone,email}`, `UNIQUE (obj_id, code)` on `units`), the v4.73.1 `v4710-provenance.js`
model described in the brief (`PROV` keyed `entity:id:field`).

## Outputs

- `03_DATA_MODEL.md` sections (when assigned): entity catalog with ID prefix, fields, types,
  defaults, required flags, reference targets, stored/derived marker, visibility; relationship
  diagram in text; decision table derived vs stored; migration content per `schemaVersion`; the
  CASE OS field-level mapping table.
- Pure functions in `js/services.js`: `validateState(state, config)`, `rebuildIndexes(state)`,
  `normalize(text)`; ID allocation `newId(collection)` and record writers in `js/state.js` that set
  `createdAt / updatedAt`, `demoRecord`, and append `SH-` / `AUD-` entries.
- JSON fixtures (valid state, state with dangling references, state one `schemaVersion` behind) for
  `testing-and-qa` and `local-storage-and-import-export`, with expected `validateState` output.
- Field-change notes for other skills: name, type, default, placement, migration step, consumers
  (views, tools, exports, portal whitelist).
- Answers structured as FACTS (cite `00_MASTER_PROMPT.md §n` or the CASE OS file) / ASSUMPTIONS
  (A-n) / RECOMMENDATIONS, open items as Q-n with owner.

## Constraints

- §8: all views render from `appState`; no business data in HTML; no second store per view (§25).
- §6.3–§6.5, D5, D6: `unit.commercialStatus` holds inventory keys only; stage lives on `deal`;
  `deal.unitIds` is an array; unit GLA is stored once on the unit and never copied into deals.
- D13: ID formats and `externalIds` names are fixed; IDs are opaque strings, never parsed for
  meaning by views; `caseOsObjectId` / `caseOsUnitCode` are the only fold-back keys.
- D9: `meta.schemaVersion` is an integer; migrations are ordered, idempotent, never delete records;
  the localStorage keys `caseos-lsp-state-v1`, `caseos-lsp-backup-v1`, `caseos-lsp-session`,
  `caseos-lsp-ui` are not renamed.
- D7, §6.8: visibility values are `internal`, `client_visible`, `restricted`, `public`; sensitive
  nested groups (`notes.internal`, `commission`, `termsHistory`, `commercialTerms`) are named so
  that the `clientView` whitelist can exclude them by path.
- D16 / D20 / D21 vocabularies are taken from the brief verbatim (`conf` modelled | asking |
  verified; closed `src` and `how` lists; cents; `aliases`), not re-invented.
- D10: `validateState` and `rebuildIndexes` have no DOM or localStorage access and attach to
  `window.LSP` in browsers and `module.exports` in Node.
- D1 / D11: `os/core.js`, `os/v*.js`, `os/sql/`, `os/api/` are read-only precedents; the CASE OS
  `deals` one-unit rule, `STAT` conflation and document-only `contacts` are patterns NOT to copy.
- No backend, ORM, IndexedDB (v0.1), encryption or "secure storage" claims; the model is a
  prototype schema and says so where documented.

## Validation checklist

- [ ] Every collection in `appState` is one of the §8 keys plus `meta`; every record has `id` with
      the right prefix, `createdAt`, `updatedAt`, `demoRecord`; sensitive records have `visibility`.
- [ ] Every reference field names its target collection in `03_DATA_MODEL.md`; `validateState`
      on `data/demo.js` returns zero errors, and a fixture with one dangling `unitIds` entry
      returns exactly one coded error.
- [ ] Parent-side ID arrays equal the result of `rebuildIndexes`; no view writes them.
- [ ] Derived values (pipeline stage, display status, `dealArea`, totals, completeness, stale,
      `lastActivityDate`, `currentOffer`) have no stored field; stored values have exactly one field.
- [ ] Enum fields store config keys that exist in `DEFAULT_CONFIG`; `05_STATUSES_STAGES_AND_CONFIG.md`
      holds the key ↔ label table.
- [ ] New field: placement, type, default, migration step, consumers and portal whitelist impact
      are written before code; `local-storage-and-import-export` receives the migration content.
- [ ] `unitNumber` unique per project; `unit.id` unique globally; counters in `meta.counters`
      never go backwards after import or reset.
- [ ] `requirements` schema, `USER-` / `CLIENT-` prefixes and any addition beyond §8 are labeled
      RECOMMENDATION / Q-n with owner, not fact.
- [ ] CASE OS mapping rows cite `os/core.js` or `os/sql/schema_mysql.sql` for the source field.
- [ ] `git status` shows changes only under `os/leasing/`, `docs/leasing-platform/`, `docs/qa/lsp/`,
      `docs/qa/tools/lsp_*.js`, `.claude/skills/`.

## Prohibited behavior

- Storing a derived value (stage on unit, totals, scores, best offer) or recomputing a stored one.
- Reusing, re-numbering or name-deriving IDs; parsing IDs for business meaning; renaming D13
  prefixes, `externalIds` keys or localStorage keys.
- Copying CASE OS shapes into LSP (`STAT` on units, one-unit deals, `vars[]` name strings instead
  of `brandId`, contacts without a central collection).
- Adding a top-level collection, a nested group or an enum value without a Q-n and a migration.
- Migrations that delete records or silently coerce missing values to zero or empty strings.
- Defining KPI formulas, stage transition rules, area validation, money conversion, similarity
  thresholds or role capabilities (owned by sister skills).
- Writing DOM, localStorage or network code into `validateState` / `rebuildIndexes`.
- Claiming the schema is production-ready, secure, or backed by PostgreSQL; the production
  migration path belongs to `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7 as future architecture.

## Examples

1. Prompt: "Add `deal.areaOverrideM2` to the schema."
   Expected: definition in `03_DATA_MODEL.md` (number in m², `null` default, stored, used by
   `dealArea` only when set, internal visibility, provenance optional), the migration step
   `schemaVersion n → n+1` content (default `null`), a `validateState` rule (positive number or
   `null`), consumers listed (`leasing-pipeline-analyst` math, CSV export column, Deal Detail form,
   tool param schema), then hand-off to `local-storage-and-import-export` for the step and test.
2. Prompt: "The units table shows a brand that was deleted from the brand database."
   Expected: FACT (§3.1 one source of truth; `unit.actualUse.brandId` is a stored reference);
   diagnosis via `validateState` (dangling `brandId`); RECOMMENDATION: brands referenced by units,
   deals or documents are archived, not deleted; a repair migration nulls dangling `brandId` and
   keeps `actualUse.tenantName`; an `auditLog` entry records the repair; test fixture added.
3. Prompt: "Write the contacts entity for 03_DATA_MODEL.md."
   Expected: `CONT-nnn` schema with all §20 fields, arrays for phones / emails / messaging apps,
   `companyId` (single) and `brandIds` (many), `relationshipOwnerId` referencing `users`, derived
   `lastContactDate` from activities versus stored `nextAction` (decision table row), visibility
   default `internal` with a `restricted` option for decision makers, the CASE OS mapping rows
   from `BRANDS.person/phone/email` and `DOC_CONTACTS` (cite `os/core.js`, `os/sql/schema_mysql.sql`),
   and the dedupe hand-off to `data-quality-and-provenance`.
