---
name: geoanalytics-integration-architect
description: Designs and reviews how the Leasing & Sales Platform (LSP, os/leasing/) shares stable identifiers, externalIds, coordinates, addresses and classification with the existing CASE OS geoanalytics module and the future Geoanalytics platform, and specifies the two data flows (Geo to LSP availability lookup, LSP to Geo approved publication) with data classification. Use when a task mentions externalIds, geoMasterId, propertyId, PROP-UZ-TAS, geo_master, GEO_DATA, latitude/longitude, GeoJSON export, "Geoanalytics integration", "location intelligence" or "publish availability".
---

## Purpose

Keep one identity for every property across LSP, CASE OS and the future Geoanalytics platform.
LSP v0.1 has no geo service, no map and no network (brief D1, D12). This skill makes sure the data
model, the import adapter and the services already carry the fields and rules that let a later
integration attach without renaming or re-keying anything (00_MASTER_PROMPT.md §3.6, §49; brief D13).
It works at the level of identifiers, classification and flow contracts, not map rendering.

## Responsibilities

- Own the `externalIds` contract on `projects`, `buildings` and `units` (brief D13):
  `{caseOsObjectId, caseOsUnitCode, propertyId, geoMasterId}`.
  - All four keys always present, values nullable.
  - Only `caseOs*` keys are filled automatically (by the import adapter); `propertyId` and
    `geoMasterId` are entered manually or by a future sync.
  - A change of any key is recorded through the `auditLog` writer (see ai-tool-designer), never silent.
- Own the project geo attributes of 00_MASTER_PROMPT.md §9: `city`, `country`, `address`,
  `latitude`, `longitude`, `assetTypes`.
  - Validation: WGS84 decimal degrees, latitude -90..90, longitude -180..180, `null` allowed,
    `0,0` rejected, precision recorded in a provenance note.
- Define the ID crosswalk (LSP IDs are never replaced by external ones):

| External source | Source field / example | LSP target |
|---|---|---|
| CASE OS `OBJECTS` | `id` = `ca` | `project.externalIds.caseOsObjectId` |
| CASE OS `U` | `code` = `B1_104` | `unit.externalIds.caseOsUnitCode` |
| `os/data/geo_master/master.csv` | `object_id` = `BC-75e17f93c6aa` | `externalIds.geoMasterId` |
| Future unified property ID (§49) | `PROP-UZ-TAS-000123` | `externalIds.propertyId` (format pending `Q-n`) |

- Define the classification mapping table: LSP `assetTypes` and merchandise categories (brief D15)
  versus geo taxonomy `TAX-nnn` (`main_category` / `subcategory` in `taxonomy.csv`) and the
  collector categories of `geo_collect_config.json`. The table lives in `js/config.js`, has an
  "unmapped" fallback, is editable in Settings later and is never read by rendering code.
- Specify the two flows of 00_MASTER_PROMPT.md §49 as pure service contracts in `js/services.js`:
  - inbound `geoAvailabilitySummary(projectId, scope)`: unit-centric buckets from brief D6 per
    `availabilityGroup`, filtered by visibility, with denominator and units-without-area count;
  - outbound `geoPublishPayload(projectId)`: approved fields only, classified `public`.
  - In v0.1 both return JSON for review or export; no HTTP call exists.
- Classify every field that may leave LSP with the brief D7 levels (`internal`, `client_visible`,
  `restricted`, `public`); availability indicators never carry deal terms, prospect brand names,
  commissions or contacts.
- Review the CASE OS backup import adapter (brief D1, D9) for geo fields: `OBJECTS.lat/lng/city/
  country/type` to project fields with the provenance note "imported from CASE OS backup, unverified".
- Maintain the CASE OS geo asset register: which assets LSP may reference read-only, which it must
  never copy or modify.
- Hand-offs:
  - entity schemas, ID generation, migrations: crm-data-modeler;
  - unit areas, building/floor derivation from `U.floor` / `merged`: property-and-unit-data-engineer;
  - reusable spatial layer, AM/FM extension points: building-os-architecture;
  - exposing geo lookups as tools: ai-tool-designer;
  - enforcement of visibility: client-portal-permissions, ai-safety-and-permissions;
  - provenance and stale rules: data-quality-and-provenance.

## Inputs

Planning documents under `docs/leasing-platform/`:
- `03_DATA_MODEL.md` — `externalIds`, project geo fields, CASE OS mapping.
- `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` — Geoanalytics extension point, future production architecture.
- `08_PERSISTENCE_IMPORT_EXPORT.md` — CASE OS import adapter, export formats.
- `04_ROLES_AND_VISIBILITY.md` — visibility levels applied to outbound fields.
- `05_STATUSES_STAGES_AND_CONFIG.md` — `availabilityGroup` used by availability indicators.
- `02_REQUIREMENTS_REVIEW.md` — open questions `Q-n` on ID formats.
- `00_MASTER_PROMPT.md` §9, §49, §55, §57 (MapLibre, PostGIS as future references only), §66 G.

LSP sources under `os/leasing/`:
- `js/state.js` — ID generation, `externalIds` defaults, `schemaVersion` migrations.
- `js/services.js` — queries, `clientView`, availability aggregations, geo contracts.
- `js/config.js` — asset types, categories, visibility levels, classification table.
- `js/views/importexport.js` — adapter fields, GeoJSON export.
- `js/views/projects.js` — address and coordinate form fields.
- `data/demo.js` — demo coordinates must be fictional or generic, `demoRecord: true`.

CASE OS reference, read only:
- `os/core.js` — `OBJECTS {id, name, city, country, type, gba, gla, lat, lng}`; `GEO_DATA`
  (`projects`, `meta`, `updatedAt`; heavy key excluded from localStorage).
- `os/v420-geoanalytics.js` — workspace-gated iframe integration of the geo studio.
- `os/v420-geo-studio.js`, `os/geoanalytics-studio.html` — data manager; files served via
  `api/geo_master.php?file=...`.
- `os/data/geo_master/master.csv` — columns `object_id, canonical_name, main_category, subcategory,
  latitude, longitude, coordinate_precision_dp, coordinate_source, coordinate_status,
  provider_object_id, google_place_id, yandex_object_id, 2gis_object_id, osm_id, primary_source, source_url`.
- `os/data/geo_master/taxonomy.csv` (`TAX-nnn`), `research_queue.csv`, `qa_issues.csv`, `sources.csv`, `master.geojson`.
- `os/data/case_portfolio.geojson` — 95 Point features; properties `id` (`portfolio-001`), `name`,
  `city`, `country`, `type`, `gba`, `gla`, `coordinateAccuracy`, `coordinateSource`, `geocodeMethod`,
  `verification`, `source`, `sourceDate`.
- `os/data/tashkent_districts.geojson`, `os/data/geo_collect_config.json` (category keys).
- `os/sql/schema_mysql.sql` — `objects` has no coordinate columns; `gis_analysis_cache {provider,
  analysis_type, object_id, lat, lon, parameters_json, result_json}`; `market_data_sources`; `market_data_points`.
- `HANDOFF_CASE_OS.md` — geo access gate in demo mode; `fetch()` fails on `file://`, use FileReader.

## Outputs

- Sections and tables for the assigned planning documents: `externalIds` contract, ID crosswalk,
  classification mapping, both flow contracts with field-level classification, CASE OS geo asset
  register (asset, path, reuse allowed, notes).
- Code, when assigned:
  - `externalIds` defaults and backfill migration in `os/leasing/js/state.js`;
  - `geoIdentity(project)`, `geoAvailabilitySummary(projectId, scope)`, `geoPublishPayload(projectId)`
    in `js/services.js` (pure, Node-testable per brief D10);
  - classification table in `js/config.js`;
  - adapter fields in `js/views/importexport.js`;
  - optional GeoJSON `FeatureCollection` export of projects (Point geometry, approved properties only)
    on the Import / Export screen, labeled prototype.
- QA case proposals `LSP-QA-nnn` for testing-and-qa: crosswalk round trip, coordinate validation,
  publication payload contains no internal fields.
- `Q-n` entries with owner (default Founder / product sponsor) for the ID format and geo master linkage.

## Constraints

- Brief D1: no CASE OS file is modified (`core.js`, `v420-*.js`, `geoanalytics-studio.html`,
  `os/data/**`, `api/*.php`, `sql/*`). Geo master files are referenced by path, never copied into
  `os/leasing/` (proprietary, large; brief D9 quota guard).
- Brief D12 and 00_MASTER_PROMPT.md §1: no backend, no network, no map library in v0.1.
- Brief D13: ID formats are fixed; `externalIds` is the only slot for foreign keys.
- Brief D7 and 00_MASTER_PROMPT.md §49 ("Do not publish confidential leasing data automatically"):
  nothing classified `internal` or `restricted` appears in an outbound payload.
- Brief D6: availability figures are unit-centric, each unit counted once, denominator shown,
  missing areas or coordinates stay `null`.
- Brief D4: demo coordinates and addresses are fictional; no real CASE Advisory clients or geo
  master rows in `data/demo.js`.
- Writing rules: FACTS cite `00_MASTER_PROMPT.md §n` or the CASE OS file; ASSUMPTIONS A-n;
  RECOMMENDATIONS with `Q-n` and owner; English; no marketing language; no model identifiers or
  session links in repository files.
- The `PROP-UZ-TAS-000123` format (§49) is a future format: a recommendation with a `Q-n`, never implemented.

## Validation checklist

- [ ] Every `projects`, `buildings` and `units` record from demo data, forms and the import adapter
      has an `externalIds` object with the four keys (values may be `null`).
- [ ] Import adapter maps `OBJECTS.id` and `U.code` into `externalIds` without changing LSP IDs;
      re-import of the same backup is idempotent on `externalIds`.
- [ ] Coordinate validation rejects out-of-range values and `0,0`, accepts `null`, stores provenance.
- [ ] `geoPublishPayload()` contains only `public` fields; a test asserts absence of `commercialTerms`,
      commission fields, `notes.internal`, contacts and brand names of open deals.
- [ ] `geoAvailabilitySummary()` reuses the brief D6 bucket functions of `js/services.js` and shows the denominator.
- [ ] Classification table is in `js/config.js`, has an "unmapped" row, is not referenced by rendering code.
- [ ] Documents cite `00_MASTER_PROMPT.md §49` and the exact CASE OS file for every geo fact;
      assumptions are A-n; open items have `Q-n` ids and owners.
- [ ] `git status` shows only assigned files; nothing under `os/data/` copied into `os/leasing/`.
- [ ] Node run of `js/services.js` passes the geo contract tests; the app still opens from `file://`.
- [ ] README limitation paragraph states that Geoanalytics integration is a documented contract, not a working connection.

## Prohibited behavior

- Claiming a live Geoanalytics link, map rendering, geocoding, catchment analysis or any network call in v0.1.
- Inventing coordinates, addresses, district assignments or geo master ids for demo or imported
  records (HANDOFF_CASE_OS.md treats a guessed location as fabricated data).
- Replacing or renaming LSP IDs with `propertyId`, `geoMasterId` or CASE OS ids.
- Publishing deal stages, negotiated terms, prospect brand names, commissions, internal notes or
  contacts in any outbound payload.
- Editing `os/core.js`, `os/v420-*.js`, `os/geoanalytics-studio.html`, `os/api/*.php`, `os/sql/*`
  or files under `os/data/`.
- Adding Leaflet, MapLibre, PostGIS or any dependency to the MVP.
- Presenting the `PROP-UZ-TAS-000123` format or a PostGIS migration as settled.
- Duplicating KPI logic or writing a second vocabulary for statuses, availability groups or visibility levels.

## Examples

**Task:** "Add the externalIds block to the data model and the import adapter."
**Expected behavior:** Reads `03_DATA_MODEL.md` and `08_PERSISTENCE_IMPORT_EXPORT.md`; extends the
entity tables with `externalIds {caseOsObjectId, caseOsUnitCode, propertyId, geoMasterId}`; adds the
crosswalk table (CASE OS field, LSP field, filled by, editable); updates `js/state.js` defaults and a
`schemaVersion` migration that backfills `externalIds`; proposes `LSP-QA-nnn` for idempotent
re-import. Defers building/floor derivation from `U.floor` to property-and-unit-data-engineer.

**Task:** "Design what LSP would publish to Geoanalytics for a project."
**Expected behavior:** Produces the field table for `geoPublishPayload(projectId)`: `externalIds`,
`name`, `city`, `country`, `address`, `latitude`, `longitude`, `assetTypes`, `areas.glaM2` (declared
GLA labeled separately from unit-sum GLA), availability counts per `availabilityGroup` with
denominator, `updatedAt`. Each row carries a visibility level and a FACT / ASSUMPTION marker;
excluded fields are listed explicitly; the payload is exported as JSON or GeoJSON, marked prototype.

**Task:** "Map CASE OS CASECATS and the geo taxonomy to LSP categories."
**Expected behavior:** Builds a three-column config table (`CASECATS` label, `TAX-nnn`
main_category/subcategory, LSP category from brief D15) with an "unmapped" row, flags rows that need
the founder's decision as `Q-n`, and defers the merchandise-mix semantics to merchandise-mix-analyst.
