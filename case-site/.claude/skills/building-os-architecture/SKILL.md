---
name: building-os-architecture
description: Guards the extension points that let the Leasing & Sales Platform (LSP, os/leasing/) grow into Building OS, Asset Management and Facility Management later without a data-model rewrite, and keeps those modules out of the v0.1 scope. Use when a task mentions Building OS, digital twin, Asset Management, Facility Management, rent roll, lease administration, work orders, equipment, inspections, NOI, CAPEX, "spatial entity layer", future roles (Asset Manager, Facility Manager), "what not to build now", or a review of a data-model or floor-plan change for long-term compatibility.
---

## Purpose

00_MASTER_PROMPT.md §3.6 and §50 require an architecture that does not prevent Asset Management,
Facility Management and Building OS later, while §1, §5 and §50 forbid building them now. This skill
holds that line: it defines the reusable spatial entity layer (project, building, floor, floor plan
version, unit) as the base every future module references, keeps an explicit register of extension
points, and reviews changes to `os/leasing/` for decisions that would block the fold-out. It produces
registers, review notes and guard rules, not new modules.

## Responsibilities

- Define the spatial entity layer: `PROJ-nnn > SITE-nnn > BLDG-nnn > FLOOR-nnn > UNIT-nnn` with
  `PLAN-nnn` versions (brief D8, D13). Future modules attach to these IDs; polygon ids stay inside
  `floorPlans[].polygonMappings` and are never used as foreign keys.
- Maintain the extension-point register. Minimum rows:

| Extension point | Location in LSP | Future consumer | Rule that keeps it open |
|---|---|---|---|
| `externalIds` (D13) | `js/state.js`, `03_DATA_MODEL.md` | Geo, Building OS | only slot for foreign keys |
| `statusHistory`, `auditLog` | `js/state.js` writers | AM, FM, Building OS | append-only event backbone |
| `commercialStatus` config with `kind`, `countsAs`, `availabilityGroup` (D5) | `js/config.js` | FM operational states | new states are config, never stages |
| `documents[].category` incl. `technical document`, `floor plan` (§30) | `js/config.js` | FM, Building OS | categories editable, ids stable |
| `unit.leasingTerms.leaseStart/leaseExpiry/agreedRent` (§11) | `js/state.js` | AM lease record | stored on the unit, mirrored via services |
| `floorPlans` versions `effectiveDate`, `current`, `archived` (§10) | `js/floorplan.js` | Building OS spatial twin | history never erased |
| future roles of §31 | `04_ROLES_AND_VISIBILITY.md` | AM, FM | documented names, no rights |

- Own the "not now" list from §3.6 and §50, kept in `01_PRODUCT_SPEC.md` and `README.md`:
  lease administration, rent roll, rent collection, payments, arrears, turnover, OPEX, NOI, budgets,
  forecasts, CAPEX, maintenance, work orders, helpdesk, equipment, technical systems, incidents,
  inspections, energy, vendors, SLAs, tenant performance.
- Define the lease boundary for v0.1: the only lease facts are a deal at `Contract Signed` or later
  plus `unit.leasingTerms`. A future `leases` collection derives from those and is described as a
  fold-out path, not created. Same for `rentRoll` (derived view over occupied units) and
  `workOrders` (new entity referencing `UNIT-nnn`).
- Review pull requests and plan documents for blockers:
  - tenant, area or status stored on a polygon instead of the unit;
  - unit id reuse after deletion;
  - plan replacement that drops `statusHistory` or `dealIds`;
  - statuses hard-coded in rendering;
  - lease dates stored only on the deal;
  - `appState` collections that collide with reserved future names (`leases`, `rentRoll`,
    `workOrders`, `equipment`, `inspections`, `budgets`).
- Contribute the AM / FM / Building OS paragraphs of 00_MASTER_PROMPT.md §66 G as recommendations,
  consistent with the fold-back path of brief D1.
- Use CASE OS precedents as reference only:
  - `os/v417-master-plan.js`: immutable layout-version snapshot with checksum; plan, unit registry
    and version registry share one data base ("not a second base");
  - `os/v4450-owner-report.js`: snapshot-based reporting;
  - `os/sql/schema_mysql.sql`: `commission_ledger`, `lease_commission_deals` and feasibility tables
    already exist in CASE OS and are not re-implemented in LSP.
- Hand-offs:
  - shared IDs, coordinates, geo classification: geoanalytics-integration-architect;
  - SVG engine, sanitizer, mapping wizard: interactive-floorplan-engineer;
  - entity schemas, references, migrations: crm-data-modeler;
  - areas and GLA/GBA discipline: property-and-unit-data-engineer;
  - role capabilities: client-portal-permissions;
  - commission rules: commercial-real-estate-financial-analyst;
  - scope and phase decisions: leasing-product-architect.

## Inputs

Planning documents under `docs/leasing-platform/`:
- `01_PRODUCT_SPEC.md` — scope and exclusions.
- `02_REQUIREMENTS_REVIEW.md` — risks and corrections.
- `03_DATA_MODEL.md` — entities, IDs, relationships.
- `05_STATUSES_STAGES_AND_CONFIG.md` — status `kind`, `countsAs`, `availabilityGroup`.
- `06_FLOORPLAN_ARCHITECTURE.md` — plan versioning, `polygonMappings`.
- `09_IMPLEMENTATION_PLAN.md` — phases, definition of done.
- `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` — extension points, future production architecture.
- `00_MASTER_PROMPT.md` §3.2, §3.6, §4 (Building OS expansion is developed with the internal team,
  including Beksulton Shaxriddinov), §7, §10, §11, §30, §31, §50, §63, §66 G.

LSP sources under `os/leasing/`:
- `js/state.js` — `appState` collections, ID generation, `schemaVersion` migrations.
- `js/config.js` — statuses, document categories, roles.
- `js/services.js` — derived pipeline stage, buckets, `clientView`.
- `js/floorplan.js` — plan versions, mapping persistence.
- `js/views/units.js`, `js/views/projects.js` — where lease-like fields are edited.
- `data/demo.js` — demo `floorPlans` versions and `statusHistory`.

CASE OS reference, read only:
- `os/v417-master-plan.js`, `os/v4450-owner-report.js`.
- `os/core.js` — `STAT` conflation of inventory state and deal stage (the pattern LSP must not
  repeat); `CASE_LAYOUT_VERSIONS`; `PLANSVG` keyed `objId::block::floor`.
- `os/sql/schema_mysql.sql` — `units` UNIQUE `(obj_id, code)`, `deals`, `commission_ledger`,
  `lease_commission_deals`, `data_quality_snapshots`.
- `HANDOFF_CASE_OS.md` — audit items P0-1 (snapshot) and P1-3 (three parallel plan routes).

## Outputs

- Extension-point register and "not now" list as sections of `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`
  and `01_PRODUCT_SPEC.md` (when assigned), plus the README limitations paragraph.
- Review notes on data-model, floor-plan and services changes: finding, file and line, blocked
  future module, recommended fix, severity.
- Guard rules for code: reserved collection names documented in `js/state.js` comments and
  `03_DATA_MODEL.md`; migration policy note (new collections arrive through a `schemaVersion`
  migration with empty arrays, never by ad-hoc property creation).
- Fold-out paths (text plus one table each) for `leases`, `rentRoll`, `workOrders`, `equipment`,
  `inspections`: source fields in LSP, derivation rule, new fields required, owner, `Q-n` status.
- QA proposals `LSP-QA-nnn` for testing-and-qa: plan version replacement keeps `statusHistory` and
  `dealIds`; unit deletion is blocked or archived while history exists; statuses render from config only.

## Constraints

- 00_MASTER_PROMPT.md §1, §5 (item 35 is an architecture, not a module), §50 "Do not implement
  these now": no AM, FM or Building OS screens, entities, calculations or navigation in v0.1;
  §63 forbids empty navigation destinations, so future modules are named only in documentation.
- Brief D1: `os/leasing/` is self-contained; no change to `os/core.js`, `os/v417-master-plan.js`,
  `os/sql/*` or any CASE OS file. CASE OS financial modules are precedents, not reuse targets.
- Brief D5 and 00_MASTER_PROMPT.md §6.3: `unit.commercialStatus` stores inventory states only;
  derived stage is computed in `js/services.js`; a future FM state is a new config `kind`, never a stage.
- Brief D8 and §10: new plan versions never erase unit, deal or status history; `polygonMappings`
  live on the plan version.
- Brief D13: IDs are stable and never reused; `externalIds` is the only foreign-key slot.
- Brief D9: new collections require a `schemaVersion` migration.
- Brief D7 and §31: future roles are listed with capabilities marked "future"; no role gets rights
  in `js/config.js` before it appears in the role matrix of `04_ROLES_AND_VISIBILITY.md`.
- Writing rules: FACTS cite `00_MASTER_PROMPT.md §n` or the CASE OS file; ASSUMPTIONS A-n;
  RECOMMENDATIONS with `Q-n` and owner; English; no marketing language; no production, security or
  backend claims; no model identifiers or session links.

## Validation checklist

- [ ] Extension-point register exists; every row names an LSP file, a future consumer and the
      keeping-open rule, using the entity names of `03_DATA_MODEL.md` exactly.
- [ ] "Not now" list matches 00_MASTER_PROMPT.md §50 item by item and appears in `01_PRODUCT_SPEC.md`
      or `README.md`; no navigation entry, screen or menu item for those items exists in `os/leasing/index.html`.
- [ ] `appState` contains only the collections of 00_MASTER_PROMPT.md §8 plus those approved in
      `03_DATA_MODEL.md`; reserved future names are documented and unused.
- [ ] Replacing a floor plan version in the demo keeps `unit.statusHistoryIds`, `unit.dealIds` and the
      archived version's `polygonMappings` (test proposed as `LSP-QA-nnn`).
- [ ] No rendering code reads a status literal; `Fit-out`, `Occupied`, `Temporarily Blocked` resolve through `js/config.js`.
- [ ] Lease dates and agreed rent live on `unit.leasingTerms`, mirrored on the deal only through services, never as a third copy.
- [ ] Future roles appear in `04_ROLES_AND_VISIBILITY.md` as "future" rows and in `js/config.js` at
      most as disabled entries with no rights.
- [ ] Fold-out paths reference only fields that exist in the current schema; nothing is invented.
- [ ] `git status` shows only assigned files; no CASE OS file touched.
- [ ] Every statement about future capability is phrased as recommendation or future work, with
      `Q-n` and owner where a decision is needed.

## Prohibited behavior

- Building, stubbing or hiding behind feature flags any rent roll, lease administration, payments,
  arrears, NOI, budget, CAPEX, work order, equipment, inspection, energy or vendor functionality.
- Adding `appState` collections for those modules "to be ready", or placeholder screens
  (00_MASTER_PROMPT.md §63, §69 "no fake buttons").
- Storing tenant, area, status or deal data on SVG polygons, plan versions or `PLAN-nnn` records
  instead of `UNIT-nnn`.
- Reusing unit or building IDs after deletion, or deleting records that own `statusHistory` instead of archiving them.
- Re-implementing or importing CASE OS commission ledgers, `lease_commission_deals` or feasibility models into LSP.
- Presenting PostgreSQL, PostGIS, Supabase or any backend migration (§57, §66 G) as decided or scheduled.
- Modifying `os/core.js`, `os/v417-master-plan.js`, `os/v4450-owner-report.js`, `os/sql/*` or any other CASE OS file.
- Using a parallel vocabulary ("space", "premise", "asset unit") instead of the brief's entity, status and ID names.

## Examples

**Task:** "Review the units data model PR for Building OS compatibility."
**Expected behavior:** Reads `03_DATA_MODEL.md` and the diff of `os/leasing/js/state.js` and
`js/services.js`; checks unit ID stability, `externalIds`, that `commercialStatus` holds inventory
states only, that `leasingTerms.leaseStart/leaseExpiry` sit on the unit, and that nothing is stored on
polygons; returns a findings table (finding, file:line, blocked module, fix, severity). If a new
collection was added, asks for the `schemaVersion` migration and the `03_DATA_MODEL.md` update.
Defers area validation to property-and-unit-data-engineer.

**Task:** "Write the Building OS / AM / FM section for 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md."
**Expected behavior:** Produces the spatial entity layer description, the extension-point register,
the "not now" list (cited to §50), fold-out tables for `leases`, `rentRoll` and `workOrders` with
derivation rules from existing fields, the future roles list (cited to §31, marked future), and a
short production-phase recommendation consistent with brief D1; every open item carries `Q-n` and an owner.

**Task:** "The head of leasing wants a lease expiry list on the dashboard now."
**Expected behavior:** Confirms this needs no new module: `unit.leasingTerms.leaseExpiry` exists
(00_MASTER_PROMPT.md §11), so a derived list in `js/services.js` plus a dashboard card belongs to
reporting-and-dashboard-analyst; states that renewals workflow, rent roll and arrears stay out of
scope (§50) and records the request as a `Q-n` for leasing-product-architect if it grows beyond a read-only list.
