# Data model: entities, IDs, relationships, fields

**Purpose.** This document is the authoritative specification of the Leasing & Sales Platform data model (LSP, `os/leasing/`, `LSP_VERSION = '0.1.0'`, decision D1): the central `appState` object, the stable ID formats of D13, the field list of every entity in `00_MASTER_PROMPT.md §8`, the reference graph with its cardinalities and archive rules, the referential-integrity invariants that `js/services.js` must enforce, the registry of derived fields that are computed and never stored, the `statusHistory` and `auditLog` record formats, the field-by-field mapping from CASE OS to LSP used by the import adapter, and the extension hooks that keep Building OS, Asset Management and Facility Management possible later. It answers planning item 3 of `00_MASTER_PROMPT.md §69` and deliverable C of `§66`. It is written so that `js/state.js`, `data/demo.js` and the entity layer of `js/services.js` can be implemented from it without re-reading the master prompt. Sibling documents own the vocabularies referenced here: `05_STATUSES_STAGES_AND_CONFIG.md` (status, stage, lost-reason and configuration keys), `04_ROLES_AND_VISIBILITY.md` (role keys and field-level visibility classes), `06_FLOORPLAN_ARCHITECTURE.md` (floor-plan geometry and `polygonMappings`), `07_CALCULATIONS_AND_KPI_RULES.md` (formulas over these fields), `08_PERSISTENCE_IMPORT_EXPORT.md` (envelope, migrations, adapter behaviour and warning codes). FACTS cite `00_MASTER_PROMPT.md §n` or a CASE OS file; assumptions are labeled A-n; open questions are Q-03-n with a recommendation and an owner.

**Status: DRAFT for approval — 2026-09-17**

---

## 1. Principles

| # | Principle | Rule | Source |
|---|---|---|---|
| P1 | One central state | All application data lives in one `appState` object (`§8`). Views render from it; no view keeps a second copy of business data, and no business data is written into HTML. | `§8`, `§25`, `§62` |
| P2 | Stable IDs | Every record has an `id` in a D13 format. IDs are assigned once, never edited, never reused after archiving, and are the only thing other records store. | `§7`, `§49`, D13 |
| P3 | References by id only | Relations are id strings or arrays of id strings. No embedded copies of related records, no name-based joins. Display names are resolved at render time. | `§7`, `§8` |
| P4 | Derived is never stored | Anything computable from stored fields (pipeline stage of a unit, display status, KPI buckets, completeness, staleness, client status) is computed by `js/services.js` on read. Section 7 is the closed list. | `§3.5`, `§34`, D5, D6 |
| P5 | Visibility on every sensitive object | Projects, buildings, floors, floor plans, units, brands, companies, contacts, deals, documents, comments, reports and note entries carry `visibility` with a value from `settings.visibility.levels` (`internal`, `client_visible`, `restricted`, `public`). Client rendering is a whitelist over these values plus the field classes of `04_ROLES_AND_VISIBILITY.md §4`, never a blacklist. | `§3.4`, `§6.8`, D7 |
| P6 | Unit status and deal stage are separate fields | `unit.commercialStatus` stores inventory state only; stages live on deals. The 16-value plan vocabulary of `§12` is reconstructed for display (section 7). | `§6.3`, `§12`, D5 |
| P7 | `demoRecord` on every record | Every record carries `demoRecord: boolean`. Demo data is fictional and flagged `true`; imported and user-created data is `false`. The DEMO DATA banner is driven by `meta.origin` plus these flags. | `§47`, D4 |
| P8 | Timestamps are ISO 8601 | Datetime fields end in `At` and store UTC with milliseconds (`2026-09-17T09:30:00.000Z`). Date-only fields end in `Date` and store `YYYY-MM-DD` (local business date, no timezone). No other date format is accepted on import. | `§8`, A-03-1 |
| P9 | Money is explicit | Money fields are numbers in major units rounded to cents by `cents(v) = Math.round(v*100)/100` (FACT: the same helper exists in CASE OS `v4670-offer-pricing.js` line 110). Every money field is qualified by the `currency` and, for rent, the `rentUnit` of its owning block. Values in different currencies are never summed (`07_CALCULATIONS_AND_KPI_RULES.md §1.3`). | D20, `§44` |
| P10 | Unknown is `null`, never `0` | A missing number is `null`. `0` means "measured as zero". Services exclude `null` from sums and report the count of excluded records; UI renders `n/a`. Importers never substitute `0` for an empty cell. | `§65` "Calculations", `§69` |
| P11 | Enum discipline | Values that index a configuration list (`commercialStatus`, `stage`, `visibility`, `category`, `subcategory`, `lostReason`, `roleKey`, `commercialMode`) are lowercase snake_case **keys** resolved against `settings`. The small fixed enums the master prompt spells out (`deal.type`, `deal.status`, `task.status`, `task.priority`, `comment.responseStatus`, `commission.status`, `document.category`) keep the master prompt's literal spelling. Labels are never stored. | `§12`, `§24`, `§44` |
| P12 | Archive, do not delete | Records that other records reference are soft-archived (`archivedAt`, `archivedBy`, optional `archiveReason`) and stay in state. Hard deletion is offered only where section 5 says so. | `§3.5`, `§54`, RECOMMENDATION |
| P13 | Provenance where numbers matter | `unit`, `deal` and `project` carry an optional `provenance` map keyed by field path (D16). Absence of a record means "no source", which is weaker than `modelled`. | D16 |
| P14 | Extension by new top-level keys | Future modules add new collections that reference `unitId` / `buildingId` / `projectId`; they never widen `unit` or `deal` with lease-administration, rent-roll or maintenance fields (section 10). | `§3.6`, `§50` |

### 1.1 Vocabulary reconciliation (decisions this document takes as schema owner)

| Item | Canonical form here | Other spellings seen | Resolution |
|---|---|---|---|
| Leasing / sales switch on project and unit | `commercialMode: 'leasing' \| 'sales' \| 'leasing_and_sales'` | `07_CALCULATIONS_AND_KPI_RULES.md §1.2` calls it `unit.dealMode` with value `both` (A-07-1) | `commercialMode` is used by `05_STATUSES_STAGES_AND_CONFIG.md`, `06_FLOORPLAN_ARCHITECTURE.md`, `02_REQUIREMENTS_REVIEW.md` and the v0.1 prototype; `dealMode` is a documentation-only alias to be removed (Q-03-2) |
| `project.commercial.mandateMode` | Exclusivity of the mandate (`Exclusive`, `Non-exclusive`, `Co-exclusive`) | `§9` shows `mandateMode: "Exclusive"` | Kept as `§9` defines it. It is **not** the leasing/sales switch; the two must never be merged |
| `deal.type` | `'Leasing' \| 'Sales'` | `05_STATUSES_STAGES_AND_CONFIG.md §5.1` writes `deal.type === 'leasing'` | `§24` writes `type: "Leasing"` and the v0.1 prototype stores `'Leasing'`/`'Sales'`; P11 keeps the master prompt literal (Q-03-2) |
| `deal.status` | `'Open' \| 'Won' \| 'Lost'` | `05` §6.1 lists `open`/`won`/`lost` | `§24` writes `status: "Open"`; P11 keeps the literal (Q-03-2) |
| `visibility` | lowercase keys `internal`, `client_visible`, `restricted`, `public` | `§11`, `§18`, `§24`, `§30` write `"Internal"` | Exception to the master prompt literal because `visibility` indexes `settings.visibility.levels` and is used as a CSS/class key everywhere; all sibling documents already use lowercase |
| User and client IDs | `USER-001`, `CLIENT-001` | v0.1 prototype emits `USR-001`, `CLI-001` | D13 spells prefixes out (`PROJ`, `BLDG`, `BRAND`, `FLOOR`); `04_ROLES_AND_VISIBILITY.md` A-04-1 asked this document to confirm — confirmed. The prototype ids are normalised in the demo dataset rebuild and by migration `1 → 2` (Q-03-1) |

---

## 2. `appState` shape

FACT (`§8`): the central state object has exactly these top-level keys. Nothing else is added at the top level in v0.1; `meta` is added by `08_PERSISTENCE_IMPORT_EXPORT.md §1.2` as the envelope header and is part of the in-memory object.

```javascript
const appState = {
  meta: {                       // envelope header; owned by 08_PERSISTENCE_IMPORT_EXPORT.md
    schemaVersion: 1,           // integer, bumped only with a shipped migration
    appVersion: "0.1.0",        // LSP_VERSION that wrote the state
    savedAt: null,              // ISO 8601 UTC
    createdAt: null,            // ISO 8601 UTC, first creation of this lineage
    origin: "demo",             // demo | import | caseos-adapter | recovery | user
    idCounters: {},             // { "UNIT": 45, "DEAL": 31, ... } see section 3
    checksum: null              // 8-hex FNV-1a over JSON.stringify(data)
  },

  users: [],            // USER-nnn   internal and client user accounts (prototype only)
  clients: [],          // CLIENT-nnn client / owner organisations
  projects: [],         // PROJ-nnn   leasing or sales mandates on a property
  sites: [],            // SITE-nnn   optional site / complex layer between project and building
  buildings: [],        // BLDG-nnn
  floors: [],           // FLOOR-nnn
  floorPlans: [],       // PLAN-nnn   versioned plan records (06_FLOORPLAN_ARCHITECTURE.md)
  units: [],            // UNIT-nnn   the inventory
  brands: [],           // BRAND-nnn
  companies: [],        // COMP-nnn
  contacts: [],         // CONT-nnn
  requirements: [],     // REQ-nnn
  deals: [],            // DEAL-nnn   leasing and sales opportunities
  tasks: [],            // TASK-nnn
  activities: [],       // ACT-nnn
  comments: [],         // CMT-nnn
  documents: [],        // DOC-nnn    metadata only (§6.2)
  reports: [],          // RPT-nnn    generated report snapshots
  settings: {},         // single object: the effective configuration (05_...md)
  statusHistory: [],    // SH-nnn
  auditLog: [],         // AUD-nnn
  session: null         // runtime only, never persisted in the data key
};
```

Rules:

- `settings` is an object, not an array, and has no `id`. It is a deep merge of `DEFAULT_CONFIG` (`js/config.js`) with the user's edits; sections absent from the stored object fall back to the default (`05_STATUSES_STAGES_AND_CONFIG.md`).
- `session` is rebuilt on boot from the `caseos-lsp-session` key and is excluded from export, import, checksum and CSV (`04_ROLES_AND_VISIBILITY.md §1.2`, `08_PERSISTENCE_IMPORT_EXPORT.md §1.2`).
- Collections are arrays in insertion order. Order carries no meaning; every lookup is by `id` through an index `Map` rebuilt after load and after every mutation batch.
- `sites` is present from day one and is optional per project (section 4.4). It exists so that the `§3.2` hierarchy (`Project -> Site / Complex -> Building`) never needs a schema change, while the minimum hierarchy `Client -> Project -> Building -> Floor -> Unit` (`§7`) stays mandatory.
- Empty collections are `[]`, never `null` or absent. A missing collection on import is created empty and produces a warning, not an error.

---

## 3. ID rules

### 3.1 Format

FACT (D13, `§49`): IDs are human-readable, stable and shared with the wider ecosystem. Format: `<PREFIX>-<number>`, the number zero-padded to at least three digits, growing to four and beyond without padding rules changing (`UNIT-001` … `UNIT-999`, `UNIT-1000`).

| Collection | Prefix | Collection | Prefix | Collection | Prefix |
|---|---|---|---|---|---|
| `users` | `USER` | `units` | `UNIT` | `activities` | `ACT` |
| `clients` | `CLIENT` | `brands` | `BRAND` | `comments` | `CMT` |
| `projects` | `PROJ` | `companies` | `COMP` | `documents` | `DOC` |
| `sites` | `SITE` | `contacts` | `CONT` | `reports` | `RPT` |
| `buildings` | `BLDG` | `requirements` | `REQ` | `statusHistory` | `SH` |
| `floors` | `FLOOR` | `deals` | `DEAL` | `auditLog` | `AUD` |
| `floorPlans` | `PLAN` | `tasks` | `TASK` | `settings` | (no id) |

`USER` and `CLIENT` are confirmed here at the request of `04_ROLES_AND_VISIBILITY.md` A-04-1 (see 1.1).

### 3.2 Generation

```javascript
// js/state.js
function nextId(prefix) {
  const n = (appState.meta.idCounters[prefix] || 0) + 1;
  appState.meta.idCounters[prefix] = n;
  return prefix + '-' + String(n).padStart(3, '0');
}
```

- Counters live in `meta.idCounters` and are persisted, so an id is never reused after a record is archived or removed by a replace-all import.
- On load, and after any import, every counter is set to `max(persisted counter, highest numeric suffix present in that collection)`. This repairs counters lost in a hand-edited file (`08_PERSISTENCE_IMPORT_EXPORT.md §1.2`).
- IDs are generated only inside `js/state.js`. Views and services never build an id string.
- `SH` and `AUD` ids are generated by the writers of section 8, in the same way.

### 3.3 Uniqueness and validation

| Rule | Level | On violation |
|---|---|---|
| `id` matches `^[A-Z]+-\d{3,}$` and its prefix matches the collection | hard | record rejected on import (`E-ID-FORMAT`) |
| `id` unique within its collection | hard | import rejected (`E-ID-DUPLICATE`), listing the duplicates |
| `id` unique across the whole state | soft (guaranteed by distinct prefixes) | integrity report entry |
| `unit.unitNumber` unique within `projectId` | soft | non-blocking warning `W-UNIT-NUMBER-DUP` in the integrity report and in the units table; never blocks saving, because real registries do contain duplicated codes across blocks (FACT: CASE OS enforces `UNIQUE (obj_id, code)` in `os/sql/schema_mysql.sql`, which the import adapter relies on) |
| `floorPlans`: exactly one `current: true` per `floorId` | hard invariant | repaired on load (newest `version` wins), logged |

### 3.4 `externalIds`

FACT (D13, `§49`): projects, buildings and units carry `externalIds` so the ecosystem can match records without renaming anything. The block is also present on `floorPlans`, `brands` and `companies` because the CASE OS adapter needs it.

| Field | Type | Present on | Meaning |
|---|---|---|---|
| `caseOsObjectId` | string \| null | project | `OBJECTS[].id` (`'ca'`, `'zm'`) |
| `caseOsUnitCode` | string \| null | unit | `U[].code` (`'B1_104'`) — the code, not the volatile `u12` id |
| `caseOsBrandName` | string \| null | brand, company | normalised source name, so a re-import matches |
| `caseOsPlanKey` | string \| null | floorPlan | `objId::block::floor` (`06_FLOORPLAN_ARCHITECTURE.md §2.1`) |
| `propertyId` | string \| null | project, building | future ecosystem property id, format `PROP-UZ-TAS-000123` (`§49`); reserved, never generated by LSP v0.1 |
| `geoMasterId` | string \| null | project, building | future Geoanalytics master record (`12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`) |

`externalIds` is always an object; unknown members are preserved on import and export (forward compatibility). It is `internal` class in `04_ROLES_AND_VISIBILITY.md §4` and never reaches a client view.

---

## 4. Entity catalog

Table conventions: **Req** = required for a valid record (`y`), required only in a given state (`cond`), or optional (`n`). **Default** is the value written by `js/state.js` when the record is created. **Visibility** in the Notes column is the field class of `04_ROLES_AND_VISIBILITY.md §4` — `pub` (client-safe identity), `cv` (client_visible), `int` (internal), `res` (restricted); a blank means the field is structural and never rendered.

Blocks that repeat on several entities are defined once in section 4.23.

### 4.1 `users` — `USER-nnn`

FACT (`§32`, `§31`): prototype accounts for role simulation. No password, hash, token or secret is stored anywhere (`§6.1`, `§55`).

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `USER-nnn` | y | generated | |
| `login` | string, lowercase, unique | y | — | The "demo code" printed on the login card (`04_ROLES_AND_VISIBILITY.md §1.2`). Not a secret. |
| `displayName` | string | y | — | `pub` inside the internal app; rendered to clients only as "CASE team" (`04` §4.2) |
| `roleKey` | key of `settings.roles` | y | `manager` | `founder_admin`, `head_ls`, `manager`, `administrator`, `external_agent`, `client` (D7) |
| `clientId` | `CLIENT-nnn` \| null | cond | `null` | Required when `roleKey === 'client'`; must be `null` otherwise |
| `projectIds` | `PROJ-nnn[]` | n | `[]` | Explicit project scope for `external_agent`; for other internal roles scope comes from `project.team` (`04` §11) |
| `email` | string \| null | n | `null` | `int`. Demo values are fictional |
| `phone` | string \| null | n | `null` | `int` |
| `active` | boolean | y | `true` | Inactive users cannot log in and are excluded from assignee pickers, but keep their history |
| `color` | hex \| null | n | `null` | Manager colour on the plan "Manager" mode (`06` §5.4) |
| `demoRecord` | boolean | y | `false` | |
| `createdAt`, `updatedAt` | ISO datetime | y | now | |
| `archivedAt`, `archivedBy` | ISO datetime \| null, `USER-nnn` \| null | n | `null` | Soft archive (P12) |

### 4.2 `clients` — `CLIENT-nnn`

FACT (`§35`): client access is limited by client id and assigned projects. A client organisation may have several user accounts (`04` A-04-5).

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `CLIENT-nnn` | y | generated | |
| `name` | string | y | — | Organisation name shown in the portal header |
| `legalName` | string \| null | n | `null` | `int` |
| `type` | `'Owner' \| 'Developer' \| 'Investor' \| 'Landlord' \| 'Other'` | n | `'Owner'` | `§9` "client/owner", "developer" |
| `country`, `city` | string \| null | n | `null` | |
| `primaryContactId` | `CONT-nnn` \| null | n | `null` | `int` |
| `userIds` | `USER-nnn[]` | n | `[]` | Back-reference, maintained by services (section 5.3) |
| `reportingCadence` | `'Weekly' \| 'Biweekly' \| 'Monthly' \| 'On request'` \| null | n | `null` | Drives the "owners requiring updates" dashboard card (`§33`) |
| `lastReportAt` | ISO datetime \| null | n | `null` | Written by the report generator (section 4.18) |
| `notes` | note entry[] | n | `[]` | 4.23.3; `int` |
| `visibility` | visibility key | y | `internal` | A client organisation record itself is never rendered in the portal |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.3 `projects` — `PROJ-nnn`

FACT (`§9`): full schema and the required-field list. The table below is `§9` completed with the fields the rest of the platform needs.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `PROJ-nnn` | y | generated | |
| `name` | string | y | — | `pub` |
| `alternativeNames` | string[] | n | `[]` | `§9` "alternative name"; also fed by the CASE OS `ru` field. `pub` |
| `clientIds` | `CLIENT-nnn[]` | y | `[]` | The portal filter (`04` §6). An empty array means "no client sees this project" |
| `developerId` | `COMP-nnn` \| null | n | `null` | `§9` "developer" as a company reference, not free text. `cv` |
| `city`, `country`, `address` | string \| null | y / y / n | `null` | `pub`; `city` and `country` required for the Geoanalytics hand-off (`§49`) |
| `latitude`, `longitude` | number \| null | n | `null` | Decimal degrees, WGS84. `pub` |
| `assetTypes` | string[] | y | `['Retail']` | Values from `settings.assetTypes` (`Retail`, `Office`, `Mixed-use`, `Plinth retail`, `Warehouse`, `Other`) |
| `status` | `'Planned' \| 'Active' \| 'On hold' \| 'Completed' \| 'Archived'` | y | `'Active'` | `§9`. `Archived` is a business state; `archivedAt` is the record-level archive (P12) |
| `commercialMode` | `'leasing' \| 'sales' \| 'leasing_and_sales'` | y | `'leasing'` | `§23`; the project default a unit may narrow (1.1) |
| `areas.gbaM2`, `areas.glaM2`, `areas.leasableAreaM2`, `areas.sellableAreaM2` | number \| null | n | `null` | Declared areas. Never silently substituted for the unit sum (D6); rendered as "declared GLA" beside the computed one. `cv` |
| `areas.unitCount`, `areas.floorCount` | integer \| null | n | `null` | Declared counts; the computed counts are derived (section 7) and shown next to them |
| `commercial.leasingMandateType`, `commercial.salesMandateType` | string \| null | n | `null` | e.g. `Exclusive agency`, `Co-agency`. `int` |
| `commercial.mandateMode` | `'Exclusive' \| 'Non-exclusive' \| 'Co-exclusive'` \| null | n | `'Exclusive'` | Exclusivity, not the leasing/sales switch (1.1). `int` |
| `commercial.mandateStartDate`, `commercial.mandateExpiryDate` | date \| null | n | `null` | Expiry drives the mandate notification (`§41`, `§45`). `int` |
| `commercial.targetOpeningDate` | date \| null | n | `null` | `cv` |
| `commercial.targetOccupancyPercent` | number 0–100 \| null | n | `null` | `cv` |
| `commercial.pricingNotes` | string \| null | n | `null` | `int` |
| `commercial.currency` | ISO 4217 (`'USD'`, `'UZS'`) | y | `'USD'` | Project default inherited by new units and deals (P9) |
| `commercial.rentUnit` | `'USD/m2/month' \| 'USD/m2/year' \| 'USD/month' \| 'USD/year'` | y | `'USD/m2/month'` | Default rent basis (D20) |
| `commercial.commissionRuleKey` | key of `settings.commissionRules` \| null | n | `null` | Which configurable rule applies (`§6.6`, `§38`). `res` |
| `team.curatorId`, `team.headId`, `team.projectLeadId`, `team.administratorId` | `USER-nnn` \| null | n | `null` | `§9`. `int` |
| `team.leasingManagerIds`, `team.salesManagerIds` | `USER-nnn[]` | n | `[]` | Drive the `manager` role scope (`04` §11). `int` |
| `targetMix` | mix target[] | n | `[]` | `[{category, subcategory\|null, targetSharePercent, targetGlaM2, targetUnits}]` (`§17`); `merchandise-mix-analyst` rules in `07` §6 |
| `notes.internal`, `notes.clientVisible` | note entry[] | n | `[]` | 4.23.3. `int` / `cv` |
| `documentIds` | `DOC-nnn[]` | n | `[]` | Back-reference (section 5.3) |
| `buildingIds`, `floorIds`, `unitIds` | id[] | n | `[]` | Back-references, rebuilt by services; never authoritative (section 5.3) |
| `externalIds` | externalIds | y | `{}` | 3.4 |
| `provenance` | provenance map | n | `{}` | Keys `areas.gbaM2`, `areas.glaM2` (D16) |
| `visibility` | visibility key | y | `client_visible` | A project reaches a client only through `clientIds` **and** this value (`04` §5) |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.4 `sites` — `SITE-nnn`

FACT (`§3.2`, `§7`, `§8`): `sites` is a listed collection and appears in the hierarchy as "Site / Complex", but the minimum hierarchy skips it. RECOMMENDATION: ship the entity, keep it optional, and give the UI no dedicated screen in v0.1 (A-03-2).

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `SITE-nnn` | y | generated | |
| `projectId` | `PROJ-nnn` | y | — | A site belongs to exactly one project |
| `name` | string | y | — | `cv` |
| `siteCode` | string \| null | n | `null` | Short code used in unit numbering when a project has several plots |
| `address`, `latitude`, `longitude` | string \| null, number \| null | n | `null` | Falls back to the project values when null |
| `landAreaM2` | number \| null | n | `null` | `cv` |
| `buildingIds` | `BLDG-nnn[]` | n | `[]` | Back-reference |
| `notes` | note entry[] | n | `[]` | `int` |
| `visibility` | visibility key | y | `client_visible` | |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

A building may have `siteId: null`; the hierarchy then reads `Project -> Building`. Services must never require a site to exist.

### 4.5 `buildings` — `BLDG-nnn`

FACT (`§10` Building): `id, projectId, name, blockCode, status, floorIds, notes, createdAt, updatedAt`.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `BLDG-nnn` | y | generated | |
| `projectId` | `PROJ-nnn` | y | — | |
| `siteId` | `SITE-nnn` \| null | n | `null` | 4.4 |
| `name` | string | y | — | `pub` |
| `blockCode` | string \| null | n | `null` | `'A'`, `'B1'`; used by unit numbering and by the CASE OS plan key |
| `status` | `'Planned' \| 'Under construction' \| 'Operating' \| 'Renovation' \| 'Closed'` | y | `'Operating'` | `§10` example `Operating` |
| `floorCount`, `unitCount` | integer \| null | n | `null` | Declared; computed counts are derived (section 7) |
| `areas.gbaM2`, `areas.glaM2` | number \| null | n | `null` | Optional building-level declared areas |
| `floorIds` | `FLOOR-nnn[]` | n | `[]` | Back-reference |
| `notes` | note entry[] | n | `[]` | `int` |
| `externalIds` | externalIds | y | `{}` | `propertyId`, `geoMasterId` (3.4) |
| `visibility` | visibility key | y | `client_visible` | |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.6 `floors` — `FLOOR-nnn`

FACT (`§10` Floor): `id, projectId, buildingId, floorNumber, name, floorPlanIds, unitIds, status, createdAt, updatedAt`.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `FLOOR-nnn` | y | generated | |
| `projectId`, `buildingId` | ids | y | — | `projectId` must equal `building.projectId` (section 6) |
| `floorNumber` | integer \| null | n | `null` | Basement `-1`, ground `0` or `1` by project convention; `null` when the source label cannot be parsed (import) |
| `name` | string | y | — | `'Ground Floor'`, `'Level 2'`. `pub` |
| `sortOrder` | integer | y | `floorNumber ?? 999` | Explicit display order, so `Mezzanine` can sit between `1` and `2` |
| `status` | `'Active' \| 'Inactive'` | y | `'Active'` | `§10` |
| `areas.glaM2` | number \| null | n | `null` | Declared floor GLA |
| `floorPlanIds`, `unitIds` | id[] | n | `[]` | Back-references |
| `notes` | note entry[] | n | `[]` | `int` |
| `visibility` | visibility key | y | `client_visible` | |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

`(buildingId, name)` must be unique; `(buildingId, floorNumber)` must be unique when `floorNumber` is not null.

### 4.7 `floorPlans` — `PLAN-nnn`

FACT (`§10` Floor plan) plus the additions of `06_FLOORPLAN_ARCHITECTURE.md §2.1`, which owns the rendering semantics. This table is the storage contract; `06` is the behaviour contract.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `PLAN-nnn` | y | generated | |
| `projectId`, `buildingId`, `floorId` | ids | y | — | One plan version belongs to exactly one floor |
| `version` | integer ≥ 1 | y | `max(version on the floor) + 1` | Never edited |
| `current` | boolean | y | `true` | Exactly one `true` per `floorId` (3.3) |
| `archived` | boolean | y | `false` | Set when a newer version is published; archived versions are immutable |
| `fileName` | string | y | — | Original name or `manual-<floor>.svg` |
| `format` | `'SVG' \| 'JSON' \| 'RASTER'` | y | `'SVG'` | Source of the geometry; the stored geometry is always SVG text |
| `svgText` | string \| null | cond | `null` | Sanitized serialized SVG; `null` only when `svgDropped` |
| `backgroundUrl` | data URL \| null | n | `null` | `data:image/png;base64,…` or JPEG only, for `RASTER` plans |
| `viewBox` | `[x, y, w, h]` | y | from the SVG | Repaired on sanitize |
| `polygonCount` | integer | y | computed | Cached count of candidate polygons |
| `sourceHash` | string | y | computed | 32-bit hash of `svgText`; memoization key |
| `polygonMappings` | mapping[] | y | `[]` | `{polygonId, unitId, bindingKind, source, confirmed, confidence, createdAt, createdBy}` (`06` §2.3). Unconfirmed entries never bind |
| `ignoredPolygonIds` | string[] | n | `[]` | Candidate polygons the team marked as non-units |
| `svgDropped` | boolean | y | `false` | Quota reduction on archived versions (`08` §12.3) |
| `effectiveDate` | date \| null | n | publish date | "Plan valid from" |
| `uploadedAt`, `uploadedBy` | ISO datetime, `USER-nnn` | y | now / session user | |
| `notes` | string \| null | n | `null` | `int` |
| `externalIds` | externalIds | y | `{}` | `caseOsPlanKey` |
| `visibility` | `'internal' \| 'client_visible'` | y | `internal` | The `current` version is what a client sees when `client_visible` (`04` §4.1) |
| `demoRecord`, `createdAt`, `updatedAt` | | | | as 4.1 |

Publishing a new version never touches units, deals, `statusHistory`, comments or documents (`§10`, D8).

### 4.8 `units` — `UNIT-nnn`

FACT (`§11`): the full unit schema. Added by this document: `siteId`, `externalIds`, `commercialMode`, `provenance`, `archivedAt`, and the `salesTerms.currentOffer` / `deposit` fields of `§11` kept intact. `commercialStatus` stores an **inventory** key only (D5, P6).

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `UNIT-nnn` | y | generated | `pub` |
| `projectId`, `buildingId`, `floorId` | ids | y | — | Must form a consistent chain (section 6) |
| `siteId` | `SITE-nnn` \| null | n | `null` | Mirrors `building.siteId`; stored for query speed only |
| `unitNumber` | string | y | — | `'F1-001'` (`§11`). Unique within the project (3.3, soft). `pub` |
| `label` | string | y | `'Unit ' + unitNumber` | Display label; merged units keep `'B1_107 + B1_108'` here. `pub` |
| `geometry.polygonId` | string \| null | n | `null` | Convenience mirror of the current plan mapping; the plan's `polygonMappings` is authoritative (`06` §2.6). `cv` |
| `geometry.centroid` | `{x, y}` \| null | n | `null` | Plan coordinates, cached for label placement. `cv` |
| `geometry.frontageLengthM` | number \| null | n | `null` | Matching input (`§39`). `int` |
| `geometry.areaSource` | `'Manual' \| 'Plan' \| 'Verified'` \| null | n | `null` | `§11`. Superseded for reporting by `provenance.glaM2` (D16) but kept as `§11` defines it. `int` |
| `area.glaM2` | number \| null | y-ish | `null` | The inventory area. `null` is legal and reported as "unit without area" (P10, `§37`). `cv` |
| `area.grossUnitAreaM2`, `area.mezzanineM2`, `area.terraceM2` | number \| null | n | `null` | Never added into GLA sums. `int` (terrace `cv`) |
| `targetUse.category`, `targetUse.subcategory` | category key \| null | n | `null` | From `settings.merchandiseCategories` (D15). `cv` |
| `targetUse.brandProfile` | string \| null | n | `null` | Free text, e.g. "international mid fashion". `int` |
| `targetUse.merchandiseRole` | `'anchor' \| 'mini_anchor' \| 'inline' \| 'kiosk' \| 'fnb' \| 'service' \| 'office' \| 'other'` \| null | n | `null` | Drives mix weighting and plan label tiers. `int` |
| `targetUse.preferredUnitType` | string \| null | n | `null` | `int` |
| `actualUse.brandId` | `BRAND-nnn` \| null | n | `null` | Set only under the rule of section 6.7. `int` (the id never leaves the internal side) |
| `actualUse.tenantName` | string \| null | n | `null` | Rendered to clients only when the unit `countsAs` leased or sold (`04` A-04-4). `cv` |
| `actualUse.category`, `actualUse.subcategory` | category key \| null | n | `null` | Actual mix input. `cv` |
| `actualUse.setAt`, `actualUse.setBy`, `actualUse.setReason` | ISO datetime \| null, `USER-nnn` \| null, string \| null | n | `null` | Written together with `brandId` (section 6.7); a manual assignment requires a reason |
| `commercialStatus` | inventory status key | y | `'available'` | Key with `kind: 'inventory'` from `settings.unitStatuses` (`05` Table 2a). Never a stage key (P6). `cv` (rendered as the mapped `clientStatus`) |
| `commercialMode` | `'leasing' \| 'sales' \| 'leasing_and_sales'` | y | project value | `§23`. Controls which terms block and which deal type are offered (1.1) |
| `leasingTerms.*` | `askingRent`, `agreedRent`, `currency`, `rentUnit`, `serviceCharge`, `vatTreatment`, `turnoverRent`, `rentFreePeriod`, `fitOutPeriod`, `deposit`, `leaseTerm`, `indexation`, `openingDate`, `leaseStart`, `leaseExpiry` | n | `§11` values; `currency`/`rentUnit` from the project | Money per P9. `vatTreatment` ∈ `'Unknown' \| 'Included' \| 'On top' \| 'Not applicable'`. Dates are `YYYY-MM-DD`. All `int` |
| `salesTerms.*` | `askingPrice`, `pricePerM2`, `currentOffer`, `agreedPrice`, `paymentSchedule`, `deposit`, `plannedClosingDate` | n | `null` | `§11`. All `int` |
| `responsibility.responsibleManagerId` | `USER-nnn` \| null | n | `null` | Missing value feeds the "records without a responsible manager" hygiene card (`§33`). `int` |
| `responsibility.supportingManagerId`, `responsibility.referralPartnerId` | `USER-nnn` / `CONT-nnn` \| null | n | `null` | `int` / `res` |
| `operational.nextAction` | string \| null | n | `null` | `int` |
| `operational.nextActionDate` | date \| null | n | `null` | `int` |
| `operational.lastActivityDate` | date \| null | n | `null` | Maintained by the activity writer (section 8.3). `int` |
| `operational.notes` | note entry[] | n | `[]` | 4.23.3. `int` unless an entry is marked `client_visible` |
| `dealIds`, `documentIds`, `activityIds`, `commentIds`, `statusHistoryIds` | id[] | n | `[]` | Back-references, rebuilt by services (section 5.3) |
| `externalIds` | externalIds | y | `{}` | `caseOsUnitCode` |
| `provenance` | provenance map | n | `{}` | Keys `glaM2`, `askingRent`, `agreedRent`, `commercialStatus` (D16) |
| `visibility` | visibility key | y | `client_visible` | `restricted` hides a single unit from the portal without hiding the floor |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

A unit is never "owned" by a deal: several open deals may point at it at once (`§6.4`), and archiving the last deal changes nothing on the unit.

### 4.9 `brands` — `BRAND-nnn`

FACT (`§18`): the brand database is a long-term proprietary asset; the schema below is `§18` unchanged plus `demoRecord`, `externalIds`, `archivedAt` and the `contacts` note that `§18` states in prose.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `BRAND-nnn` | y | generated | `pub` |
| `name` | string | y | — | Trading name. Duplicate warning on `norm(name)` (`08` §8.4), never blocking. `pub` |
| `legalName` | string \| null | n | `null` | `int` |
| `logoUrl` | string \| null | n | `null` | Data URL or external URL; no file bytes are stored by LSP. `pub` |
| `website` | string \| null | n | `null` | `pub` |
| `countryOfOrigin` | string \| null | n | `null` | `pub` |
| `operatingCountries` | string[] | n | `[]` | `cv` |
| `status` | `'Active' \| 'Target' \| 'Refused' \| 'Inactive'` | y | `'Active'` | Lifecycle of the brand record itself (`§18`) |
| `classification.category`, `classification.subcategory` | category key \| null | n | `null` | `settings.merchandiseCategories` (D15). `pub` / `cv` |
| `classification.priceSegment` | `'Value' \| 'Mass' \| 'Mid' \| 'Premium' \| 'Luxury'` \| null | n | `null` | `cv` |
| `classification.format` | string \| null | n | `null` | e.g. `Flagship`, `Standard`, `Corner`, `Kiosk`; `settings.brandFormats` with aliases (D21). `cv` |
| `classification.brandType` | `'International' \| 'Regional' \| 'Local' \| 'Franchise' \| 'Own operation'` \| null | n | `null` | `cv` |
| `companyId` | `COMP-nnn` \| null | n | `null` | One company owns many brands (`§19`); never one company per brand. `int` |
| `contactIds` | `CONT-nnn[]` | n | `[]` | Multiple contacts per brand (`§18`). `int` |
| `expansionRequirements.*` | `targetCities[]`, `targetProjects[]`, `preferredLocationType`, `minimumAreaM2`, `preferredAreaM2`, `maximumAreaM2`, `frontageRequirement`, `floorPreference`, `parkingRequirements`, `accessRequirements`, `targetRentRange`, `commercialModel`, `openingTimeline`, `fitOutRequirements` | n | `§18` values | Matching inputs (`§39`, `07` §7). Areas are numbers; `targetRentRange` is `{min, max, currency, rentUnit}` \| null (A-03-3). `int` |
| `relationship.ownerId` | `USER-nnn` \| null | n | `null` | Relationship owner; completeness input (`§40`). `int` |
| `relationship.source` | string \| null | n | `null` | Where the relationship came from (`§26` filter "source"). `int` |
| `relationship.lastContactDate`, `relationship.nextFollowUpDate` | date \| null | n | `null` | Stale rules (`§41`). `int` |
| `relationship.relationshipStatus` | `'New' \| 'In contact' \| 'Negotiating' \| 'Tenant' \| 'Dormant' \| 'Refused'` \| null | n | `null` | `int` |
| `history.projectIds`, `history.unitIds`, `history.dealIds` | id[] | n | `[]` | Back-references (section 5.3). `int` |
| `history.rejectedProjectIds`, `history.rejectionReasons` | `PROJ-nnn[]`, string[] | n | `[]` | `§18`; parallel arrays kept as the master prompt defines them. `int` |
| `notes.general`, `notes.internal` | note entry[] | n | `[]` | `int` / `res` (`04` §4.2) |
| `documentIds`, `activityIds` | id[] | n | `[]` | Back-references |
| `externalIds` | externalIds | y | `{}` | `caseOsBrandName` |
| `visibility` | visibility key | y | `internal` | `restricted` for NDA prospects: even the tenant name on a signed unit then renders "Confidential tenant" (`04` §4.2) |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.10 `companies` — `COMP-nnn`

FACT (`§19`): companies are separate from brands; one company may own multiple brands; duplicate company records per brand are forbidden.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `COMP-nnn` | y | generated | |
| `legalName` | string | y | — | `§19`. Duplicate warning on `norm(legalName)` |
| `tradingName` | string \| null | n | `null` | |
| `country`, `city` | string \| null | n | `null` | |
| `website` | string \| null | n | `null` | |
| `industry` | string \| null | n | `null` | `§19` |
| `companyType` | `'Brand owner' \| 'Franchisee' \| 'Distributor' \| 'Developer' \| 'Investor' \| 'Broker' \| 'Other'` | n | `'Brand owner'` | `§19` |
| `brandIds`, `contactIds` | id[] | n | `[]` | `§19`; `brandIds` is a back-reference of `brand.companyId` (section 5.3) |
| `responsibleManagerId` | `USER-nnn` \| null | n | `null` | `§19` |
| `notes` | note entry[] | n | `[]` | `int` |
| `documentIds`, `activityIds` | id[] | n | `[]` | `§19` "documents", "activity history" |
| `externalIds` | externalIds | y | `{}` | `caseOsBrandName` (from `BRANDS[].group`) |
| `visibility` | visibility key | y | `internal` | |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.11 `contacts` — `CONT-nnn`

FACT (`§20`): one central contact database; a contact may link to multiple brands, one company, multiple deals and multiple projects.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `CONT-nnn` | y | generated | |
| `firstName`, `lastName` | string, string \| null | y / n | — / `null` | Import splits a single name on the first space |
| `position` | string \| null | n | `null` | `int` |
| `companyId` | `COMP-nnn` \| null | n | `null` | At most one company (`§20`) |
| `brandIds` | `BRAND-nnn[]` | n | `[]` | Many brands (`§20`) |
| `phones` | `[{label, value}]` | n | `[]` | `label` ∈ `'mobile' \| 'work' \| 'other'`. Stored as typed by the user; a normalised `e164`-like form is derived for duplicate detection only. `res` |
| `emails` | `[{label, value}]` | n | `[]` | `res` |
| `messagingApps` | `[{app, handle}]` | n | `[]` | `app` ∈ `'telegram' \| 'whatsapp' \| 'other'` (`§18`, `§20`). `res` |
| `city`, `country` | string \| null | n | `null` | `int` |
| `preferredLanguage` | `'en' \| 'ru' \| 'uz'` \| null | n | `null` | `§20`. `int` |
| `relationshipOwnerId` | `USER-nnn` \| null | n | `null` | `int` |
| `lastContactDate` | date \| null | n | `null` | `int` |
| `nextAction`, `nextActionDate` | string \| null, date \| null | n | `null` | `int` |
| `notes` | note entry[] | n | `[]` | `res` |
| `dealIds`, `projectIds`, `activityIds`, `documentIds` | id[] | n | `[]` | Back-references |
| `visibility` | visibility key | y | `internal` | `restricted` for decision makers (`§37` "restricted contacts"). Contacts never appear in any client whitelist (`04` §4.2) |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.12 `requirements` — `REQ-nnn`

FACT (`§21`): a brand or buyer may have a general requirement before a specific opportunity exists; the chain is `Contact / Company / Brand -> Requirement -> Lead -> Opportunity / Deal -> Unit`. `§21` gives no field list, so the table below is a RECOMMENDATION built from `§21`, `§26` (filters) and `§39` (matching).

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `REQ-nnn` | y | generated | |
| `title` | string | y | — | e.g. "Coffee chain — 2 units, Tashkent, Q2" |
| `type` | `'Leasing' \| 'Sales'` | y | `'Leasing'` | Same literal set as `deal.type` (P11) |
| `brandId` | `BRAND-nnn` \| null | n | `null` | At least one of `brandId`, `companyId`, `contactIds` must be set (section 6) |
| `companyId` | `COMP-nnn` \| null | n | `null` | |
| `contactIds` | `CONT-nnn[]` | n | `[]` | |
| `status` | `'Open' \| 'Matched' \| 'On hold' \| 'Closed'` | y | `'Open'` | `Matched` when at least one deal references it |
| `source` | string \| null | n | `null` | `§26` filter "source" |
| `criteria.cities`, `criteria.projectIds` | string[], `PROJ-nnn[]` | n | `[]` | Matching inputs (`07` §7) |
| `criteria.category`, `criteria.subcategory` | category key \| null | n | `null` | |
| `criteria.minAreaM2`, `criteria.maxAreaM2` | number \| null | n | `null` | |
| `criteria.floorPreference` | string \| null | n | `null` | `'ground'`, `'any'`, `'1'` |
| `criteria.frontageMinM` | number \| null | n | `null` | |
| `criteria.budget` | `{min, max, currency, rentUnit \| null}` \| null | n | `null` | Rent budget for leasing, price for sales |
| `criteria.openingTimeline` | string \| null | n | `null` | |
| `criteria.accessRequirements` | string \| null | n | `null` | |
| `responsibleManagerId` | `USER-nnn` \| null | n | `null` | |
| `dealIds` | `DEAL-nnn[]` | n | `[]` | Back-reference of `deal.requirementId` |
| `notes` | note entry[] | n | `[]` | `int` |
| `visibility` | visibility key | y | `internal` | Requirements never reach the portal |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.13 `deals` — `DEAL-nnn`

FACT (`§24`): the deal schema. Added here per the assignment and D5/D6: `unitIds` is the only unit link (already `§24`), `requirementId`, `stageHistory`, `termsHistory`, `areaOverrideM2`, `probabilityOverridden`, `lostReasonNote`, `commission` (the `§38` block, stored on the deal), `provenance`, `archivedAt`.

| Field | Type | Req | Default | Notes / visibility |
|---|---|---|---|---|
| `id` | `DEAL-nnn` | y | generated | |
| `type` | `'Leasing' \| 'Sales'` | y | `'Leasing'` | Immutable after the first stage change (`05` §5.1); create a new deal instead |
| `projectId` | `PROJ-nnn` | y | — | Must equal the project of every linked unit (section 6.2) |
| `unitIds` | `UNIT-nnn[]` | n | `[]` | Zero units is legal before "Property / Unit Offered"; several units are legal (`§6.5`). Duplicates are removed on write |
| `areaOverrideM2` | number \| null | n | `null` | Overrides `dealArea` when the negotiated area differs from the unit sum (D6). Requires a note in `termsHistory` |
| `brandId`, `companyId` | ids \| null | n | `null` | A buyer with no brand keeps `brandId: null` and uses `companyId`/`contactIds` |
| `contactIds` | `CONT-nnn[]` | n | `[]` | |
| `requirementId` | `REQ-nnn` \| null | n | `null` | The `§21` chain |
| `ownership.responsibleManagerId` | `USER-nnn` \| null | n | session user | Completeness and pipeline-by-manager input. `int` |
| `ownership.supportManagerId`, `ownership.referralPartnerId` | `USER-nnn` / `CONT-nnn` \| null | n | `null` | `int` / `res` |
| `stage` | stage key of the deal's type | y | `'lead'` | `settings.leasingStages` / `salesStages` (`05` Tables 4–5) |
| `dateEnteredStage` | date \| null | y | today | Stage aging input (`07` §3) |
| `stageHistory` | `[{stage, at, by, fromStage, note}]` | y | one entry | Append-only. Written with every stage change together with a `statusHistory` row (section 8.1) |
| `probability` | number 0–100 \| null | n | stage default | |
| `probabilityOverridden` | boolean | y | `false` | When `true`, a stage change no longer reseeds `probability` (`05` §4) |
| `status` | `'Open' \| 'Won' \| 'Lost'` | y | `'Open'` | Derived from the stage type but stored, because it is the primary pipeline filter (`§26`) |
| `commercialTerms.*` (leasing) | `askingRent`, `proposedRent`, `agreedRent`, `serviceCharge`, `turnoverRent`, `deposit`, `rentFreePeriod`, `fitOutPeriod`, `leaseTerm`, `indexation` | n | `null` (asking seeded from the unit) | `int` |
| `commercialTerms.*` (sales) | `askingPrice`, `offerPrice`, `agreedPrice`, `pricePerM2`, `paymentSchedule`, `plannedClosingDate` | n | `null` | `int` |
| `commercialTerms.currency`, `commercialTerms.rentUnit`, `commercialTerms.vatTreatment` | string | y | project values | P9 |
| `termsHistory` | deviation[] | n | `[]` | `[{field, from, to, by, at, reason}]` (D20). Written on every manual override of asking → proposed → agreed. Never client-visible |
| `nextAction.text`, `nextAction.ownerId`, `nextAction.dueDate` | string \| null, `USER-nnn` \| null, date \| null | n | `null` | Empty `text` feeds "deals without next action" (`§33`). `int` |
| `activity.lastContactDate` | date \| null | n | `null` | Stale-deal input (`§41`) |
| `activity.activityIds` | `ACT-nnn[]` | n | `[]` | Back-reference |
| `documentIds` | `DOC-nnn[]` | n | `[]` | Back-reference |
| `outcome.won`, `outcome.lost` | boolean | y | `false` | Set by the stage transition rules (`05` §6.2) |
| `outcome.lostReason` | lost-reason key \| null | cond | `null` | Required when `status === 'Lost'` (`§22`) |
| `outcome.lostReasonNote` | string \| null | cond | `null` | Required when `lostReason === 'other'` (`05` §7) |
| `outcome.signedDate`, `outcome.paymentDate` | date \| null | n | `null` | |
| `outcome.commissionStatus` | `'Not Applicable' \| 'Pending' \| 'Invoiced' \| 'Partially Received' \| 'Received' \| 'Written Off'` | y | `'Not Applicable'` | `§24` default kept; the extra values are the `§38` lifecycle. `res` |
| `commission` | commission record \| null | n | `null` | Section 4.13.1. Always `restricted` — clients never see commission distribution (`§38`) |
| `provenance` | provenance map | n | `{}` | Keys `agreedRent`, `agreedPrice`; required once the deal reaches Contract Signed (D16) |
| `visibility` | visibility key | y | `internal` | `client_visible` marks a "client-approved key deal" (`§37`, `04` §4.2) |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

#### 4.13.1 Commission record (inside the deal)

FACT (`§38`): the model below is the master prompt's, unchanged, plus `ruleKey` and `currency`. It is stored as `deal.commission` because a commission always belongs to exactly one deal; there is no separate collection in v0.1.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `ruleKey` | key of `settings.commissionRules` \| null | n | project rule | Which configurable rule produced the figures (`§6.6`) |
| `currency` | ISO 4217 | y | deal currency | P9 |
| `grossCommission` | number \| null | n | `null` | Computed by the rule, editable; an edit writes a `termsHistory` entry |
| `invoiceDate`, `expectedPaymentDate`, `receivedDate` | date \| null | n | `null` | |
| `receivedAmount` | number \| null | n | `null` | `null` ≠ `0` (P10) |
| `status` | `'Pending' \| 'Invoiced' \| 'Partially Received' \| 'Received' \| 'Written Off'` | y | `'Pending'` | Mirrors `outcome.commissionStatus` minus `Not Applicable` |
| `companyShare`, `managerShare`, `externalAgentShare`, `administratorShare` | number \| null | n | `null` | Amounts in `currency`; percentages live in the rule, not here |
| `notes` | string \| null | n | `null` | |

The whole block has field class `restricted` and is not editable by `manager` by default (`04` §10). "Financially complete" is a configurable condition (`§6.6`), evaluated in services from `status` and the rule, never hard-coded.

### 4.14 `tasks` — `TASK-nnn`

FACT (`§27`): schema as written, plus `completedBy`, `createdBy`, `rescheduledFrom` and `visibility`.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `TASK-nnn` | y | generated | |
| `title` | string | y | — | |
| `projectId`, `unitId`, `brandId`, `dealId` | ids \| null | n | `null` | At least one link is recommended, none is required (`§27`) |
| `contactId`, `companyId` | ids \| null | n | `null` | Added so a CRM follow-up can hang on a contact (`§28`) |
| `assigneeId` | `USER-nnn` \| null | n | session user | |
| `dueDate` | date \| null | n | `null` | Overdue is derived (section 7), never stored |
| `priority` | `'Low' \| 'Normal' \| 'High' \| 'Urgent'` | y | `'Normal'` | `§27` default kept |
| `status` | `'Open' \| 'Done' \| 'Cancelled'` | y | `'Open'` | `§27` uses `Open`; `Done`/`Cancelled` complete the set |
| `comment` | string \| null | n | `null` | `§27` |
| `rescheduledFrom` | date \| null | n | `null` | Previous `dueDate`, for the "rescheduling works" check (`§65`) |
| `createdBy`, `completedBy` | `USER-nnn` \| null | y / n | session user / `null` | |
| `createdAt`, `completedAt` | ISO datetime \| null | y / n | now / `null` | |
| `visibility` | visibility key | y | `internal` | Tasks never reach the portal in v0.1 |
| `demoRecord`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.15 `activities` — `ACT-nnn`

FACT (`§28`): activity histories for brands, companies, contacts, projects, units and deals; the type list is the master prompt's. In the MVP activities may be created manually, and some are written automatically by services (section 8.3).

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `ACT-nnn` | y | generated | |
| `type` | `'call' \| 'meeting' \| 'viewing' \| 'email_note' \| 'messenger_note' \| 'proposal_sent' \| 'document_uploaded' \| 'stage_change' \| 'status_change' \| 'client_comment' \| 'internal_comment' \| 'task_completed' \| 'client_decision'` | y | — | The `§28` list as lowercase keys (P11, they index `settings.activityTypes`) |
| `at` | ISO datetime | y | now | When the activity happened (may be back-dated by the user) |
| `authorId` | `USER-nnn` \| null | y | session user | `null` only for imported history |
| `subject` | string \| null | n | `null` | One-line summary shown in the timeline |
| `text` | string \| null | n | `null` | Body |
| `projectId`, `unitId`, `dealId`, `brandId`, `companyId`, `contactId` | ids \| null | n | `null` | At least one must be set (section 6). An activity may carry several links and then appears in each timeline |
| `systemGenerated` | boolean | y | `false` | `true` for the rows services write (stage change, status change, document registered, task completed) |
| `relatedId` | id \| null | n | `null` | The `SH-nnn`, `DOC-nnn`, `TASK-nnn` or `CMT-nnn` that caused a system row |
| `visibility` | visibility key | y | `internal` | `client_visible` activities may appear in the portal timeline (not rendered in v0.1) |
| `demoRecord`, `createdAt`, `updatedAt` | | | | Activities are never archived or edited after creation except `text`/`subject` by the author |

### 4.16 `comments` — `CMT-nnn`

FACT (`§29`): internal notes, client-visible notes and client comments are separated; each comment carries author, timestamp, related object, visibility and response status `Open` / `In Review` / `Resolved`.

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `CMT-nnn` | y | generated | |
| `authorId` | `USER-nnn` | y | session user | |
| `authorType` | `'internal' \| 'client'` | y | from the session role | Decides the badge and the notification routing (`§45`) |
| `clientId` | `CLIENT-nnn` \| null | cond | session `clientId` | Required when `authorType === 'client'` |
| `projectId` | `PROJ-nnn` | y | — | Every comment belongs to a project, so the portal filter is a single check |
| `unitId`, `dealId`, `brandId`, `documentId` | ids \| null | n | `null` | The related object (`§29`); `projectId` alone means a project-level comment |
| `text` | string | y | — | Plain text; rendered with `esc()` only (D19) |
| `visibility` | visibility key | y | `internal` (internal author) / `client_visible` (client author) | A client author can never create an `internal` comment |
| `responseStatus` | `'Open' \| 'In Review' \| 'Resolved'` | y | `'Open'` | `§29` |
| `responseStatusAt`, `responseStatusBy` | ISO datetime \| null, `USER-nnn` \| null | n | `null` | |
| `parentCommentId` | `CMT-nnn` \| null | n | `null` | One level of reply, so an internal answer is attached to the client question (`§64` Flow 10) |
| `createdAt` | ISO datetime | y | now | `§29` "timestamp" |
| `demoRecord`, `updatedAt` | | | | Comments are not archived; a wrong comment is resolved, not hidden |

### 4.17 `documents` — `DOC-nnn`

FACT (`§30`): schema and the 13 categories. Metadata only; no secure storage is claimed (`§6.2`).

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `DOC-nnn` | y | generated | |
| `fileName` | string | y | — | |
| `category` | `'Floor plan' \| 'Brochure' \| 'Presentation' \| 'Commercial terms' \| 'Owner instruction' \| 'Tenant proposal' \| 'LOI' \| 'Contract' \| 'Invoice' \| 'Report' \| 'Photo' \| 'Technical document' \| 'Other'` | y | `'Other'` | The `§30` list, literal spelling (P11) |
| `projectId`, `unitId`, `brandId`, `dealId` | ids \| null | n | `null` | `§30`. At least one link required (section 6) |
| `companyId`, `contactId` | ids \| null | n | `null` | Added for CRM documents |
| `version` | integer ≥ 1 | y | `1` | A new version is a new record with the same `documentGroupId` |
| `documentGroupId` | `DOC-nnn` \| null | n | `null` | The `id` of version 1; `null` on version 1 itself |
| `supersededByDocumentId` | `DOC-nnn` \| null | n | `null` | Set when a newer version is registered |
| `uploadedBy` | `USER-nnn` | y | session user | |
| `uploadedAt` | ISO datetime | y | now | |
| `visibility` | visibility key | y | `internal` | `internal` \| `client_visible` \| `restricted` (`§30`) |
| `fileSize` | integer \| null | n | `null` | Bytes, from the `File` object; `null` for demo records |
| `mimeType` | string \| null | n | `null` | From the `File` object |
| `localUrl` | string \| null | n | `null` | Runtime-only object URL; stripped by the serializer and therefore `null` after reload (`08` §10). The UI must say "file not available after reload" rather than offer a dead link |
| `comment` | string \| null | n | `null` | `§30` |
| `demoRecord`, `createdAt`, `updatedAt`, `archivedAt`, `archivedBy` | | | | as 4.1 |

### 4.18 `reports` — `RPT-nnn`

FACT (`§37`): reports are calculated from current data and must show "changes since previous report". RECOMMENDATION: store the **input snapshot**, never the rendered HTML, so the comparison is a data diff and the state stays small (`08` §12.4).

| Field | Type | Req | Default | Notes |
|---|---|---|---|---|
| `id` | `RPT-nnn` | y | generated | |
| `type` | `'client' \| 'internal_leasing' \| 'internal_sales' \| 'internal_activity' \| 'internal_data_quality'` | y | — | `§37` report families |
| `projectId` | `PROJ-nnn` \| null | y for client reports | `null` | `null` = portfolio-level internal report |
| `clientId` | `CLIENT-nnn` \| null | cond | `null` | Required for `type === 'client'` |
| `periodFrom`, `periodTo` | date \| null | n | `null` | Reporting window; `periodFrom` defaults to the previous report of the same `(type, projectId)` |
| `generatedAt` | ISO datetime | y | now | `§37` "last updated timestamp" |
| `generatedBy` | `USER-nnn` | y | session user | |
| `previousReportId` | `RPT-nnn` \| null | n | resolved | The report the "changes since" section compares against |
| `snapshot` | object | y | computed | KPI inputs at generation time: per-unit `{unitId, commercialStatus, glaM2, actualUse.brandId}`, per-deal `{dealId, stage, status}`, bucket totals, mix totals. No rendered markup |
| `sections` | string[] | y | config default | Which `§37` sections were included; the client set is filtered by `settings.reportVisibility` |
| `visibility` | visibility key | y | `internal` (internal reports) / `client_visible` (client reports) | |
| `demoRecord`, `createdAt` | | | | Reports are immutable once generated; regeneration creates a new record |

### 4.19 `settings` — single object

FACT (`§44`): editable configuration for stages, statuses, colors, categories, subcategories, lost reasons, commission rules, roles, client status mappings, report visibility, stale thresholds, currencies, units, document visibility and notification rules. The **schema and default values are owned by `05_STATUSES_STAGES_AND_CONFIG.md`**; this document only fixes how it is stored.

| Aspect | Rule |
|---|---|
| Shape | A plain object of named sections: `unitStatuses[]`, `leasingStages[]`, `salesStages[]`, `lostReasons[]`, `merchandiseCategories[]`, `visibility`, `clientStatuses[]`, `roles`, `commissionRules[]`, `staleRules`, `kpi`, `currencies[]`, `assetTypes[]`, `brandFormats[]`, `documentDefaults`, `reportVisibility`, `notifications`, `persistence` |
| No `id` | `settings` is not a collection; it has no `id`, `demoRecord` or `visibility` |
| Merge | Stored settings are deep-merged over `DEFAULT_CONFIG`; a missing section falls back to the default, so a new release can add a section without a migration |
| Keys | List entries are identified by `key`; reordering is expressed by `order`, never by array position |
| Editing | Every write goes through `js/state.js` and produces an `auditLog` entry `settings.changed` with the section, key and before/after value |
| Deletion | A status, stage, category or lost reason that is referenced by any record cannot be deleted, only deactivated (`active: false`); the integrity report lists referenced-but-inactive keys |

### 4.20 `statusHistory` — `SH-nnn`

See section 8.1 for the record format and the writers.

### 4.21 `auditLog` — `AUD-nnn`

See section 8.2 for the record format and the writers.

### 4.22 `session` — runtime only

FACT (`§32`, D9, `04` §1.2): `{ userId, roleKey, clientId, previewClientId, loginAt, lspVersion }`. It is held on `appState.session`, persisted separately in `caseos-lsp-session`, excluded from the data key, from export, from import and from the checksum. It has no id and no `demoRecord`. It carries no credential of any kind (`§6.1`).

### 4.23 Shared blocks

#### 4.23.1 `externalIds`
Defined in section 3.4. Present on `projects`, `buildings`, `units`, `floorPlans`, `brands`, `companies`.

#### 4.23.2 `provenance` (D16)
A map keyed by the field path it describes, on `units`, `deals` and `projects`:

```javascript
provenance: {
  glaM2: { conf: "verified",         // modelled | asking | verified   (absent = "no source", weakest)
           src:  "document",         // landlord | broker | tenant | deal | listing | field |
                                     // registry | document | osm | calculated | other
           how:  "document",         // call | visit | document | registry | deal
           name: "Lease agreement 12/2026",
           at:   "2026-08-14T10:00:00.000Z",
           by:   "USER-002",
           basis: null, note: null }
}
```

Rules (unchanged from CASE OS v4.71.0, `os/v4710-provenance.js`): the confidence order is `none < modelled < asking < verified`; an aggregate always takes the weakest confidence of its inputs and shows the composition; staleness is amber after 90 days and red after 180 days; the distinction is icon + frame + word, never colour alone. `conf: 'verified'` may only be set together with `at` and `by`. A `provenance` record on `agreedRent` / `agreedPrice` is **required** when a deal reaches Contract Signed, with `src: 'deal'` and `how: 'document'` (D16).

#### 4.23.3 Note entry
Used by `notes`, `notes.internal`, `notes.clientVisible`, `operational.notes`:

```javascript
{ text: "…", authorId: "USER-003", at: "2026-09-17T09:30:00.000Z", visibility: "internal" }
```

A plain string is accepted on import and upgraded to this shape with `authorId: null` and the record's `createdAt`. Client-visible note entries are the only notes the portal renders (`§29`, `04` §4.2).

---

## 5. Relationship map

### 5.1 Text diagram

```text
clients ──< projects ──< sites ──< buildings ──< floors ──< units
   │           │                                    │         │
   │           │                                    └──< floorPlans (versioned)
   │           │                                              │ polygonMappings[].unitId
   │           │                                              └────────────────► units
   │           └──< requirements ──< deals >──── unitIds[] ────► units   (many-to-many)
   │                     ▲              │
   │                     │              ├── brandId ──► brands ──► companyId ──► companies
users ──► session        │              ├── contactIds[] ──► contacts ──► companyId ──► companies
   │                     │              │                        └── brandIds[] ──► brands
   │                     └── brandId / companyId / contactIds[]
   │
   └──< tasks, activities, comments, documents, reports, statusHistory, auditLog
                (each carries optional links to project / unit / deal / brand / company / contact)
```

Reading rules: `──<` is one-to-many, `>────` is many-to-many through an array, `──►` is a single reference. The commercial chain of `§68` (`Client -> Project -> Building -> Floor -> Unit -> Brand -> Deal -> Activity -> Contract -> Commission`) is expressed as: `Contract` = `deal.outcome.signedDate` plus a `DOC-nnn` of category `Contract`; `Commission` = `deal.commission`.

### 5.2 Every reference field

**Archive rule** column: *block* = the referenced record cannot be archived while a live reference exists; *null* = the reference is set to `null` on archive; *keep* = the reference is kept (historical link to an archived record is legitimate and rendered with an "archived" badge).

| Source field | Target | Cardinality | Required | Archive rule on the target |
|---|---|---|---|---|
| `users[].clientId` | clients | n:1 | cond | block |
| `users[].projectIds[]` | projects | n:m | n | null |
| `clients[].primaryContactId` | contacts | 1:1 | n | null |
| `projects[].clientIds[]` | clients | n:m | y (may be empty) | block |
| `projects[].developerId` | companies | n:1 | n | null |
| `projects[].team.*Id` / `*Ids[]` | users | n:m | n | null |
| `sites[].projectId` | projects | n:1 | y | block |
| `buildings[].projectId` | projects | n:1 | y | block |
| `buildings[].siteId` | sites | n:1 | n | null |
| `floors[].projectId`, `floors[].buildingId` | projects, buildings | n:1 | y | block |
| `floorPlans[].projectId/buildingId/floorId` | …, floors | n:1 | y | block |
| `floorPlans[].polygonMappings[].unitId` | units | n:1 | y per entry | entry dropped, reported |
| `floorPlans[].uploadedBy` | users | n:1 | y | keep |
| `units[].projectId/buildingId/floorId` | …, floors | n:1 | y | block |
| `units[].siteId` | sites | n:1 | n | null |
| `units[].actualUse.brandId` | brands | n:1 | n | keep |
| `units[].responsibility.*Id` | users, contacts | n:1 | n | null |
| `brands[].companyId` | companies | n:1 | n | null |
| `brands[].contactIds[]` | contacts | n:m | n | remove from array |
| `brands[].relationship.ownerId` | users | n:1 | n | null |
| `brands[].history.*Ids[]` | projects/units/deals | n:m | n | keep (history) |
| `companies[].responsibleManagerId` | users | n:1 | n | null |
| `contacts[].companyId` | companies | n:1 | n | null |
| `contacts[].brandIds[]` | brands | n:m | n | remove from array |
| `contacts[].relationshipOwnerId` | users | n:1 | n | null |
| `requirements[].brandId/companyId/contactIds[]` | brands/companies/contacts | n:1 / n:m | ≥1 of them | null / remove |
| `requirements[].responsibleManagerId` | users | n:1 | n | null |
| `deals[].projectId` | projects | n:1 | y | block |
| `deals[].unitIds[]` | units | n:m | n | keep (the deal keeps its history) |
| `deals[].brandId`, `deals[].companyId` | brands, companies | n:1 | n | keep |
| `deals[].contactIds[]` | contacts | n:m | n | remove from array |
| `deals[].requirementId` | requirements | n:1 | n | null |
| `deals[].ownership.*Id` | users, contacts | n:1 | n | null |
| `deals[].nextAction.ownerId` | users | n:1 | n | null |
| `tasks[].projectId/unitId/brandId/dealId/contactId/companyId` | … | n:1 | ≥1 recommended | keep |
| `tasks[].assigneeId`, `createdBy`, `completedBy` | users | n:1 | n | keep |
| `activities[].*Id` (6 link fields) | … | n:1 | ≥1 required | keep |
| `activities[].authorId` | users | n:1 | n | keep |
| `comments[].projectId` | projects | n:1 | y | block |
| `comments[].unitId/dealId/brandId/documentId` | … | n:1 | n | keep |
| `comments[].authorId`, `clientId`, `parentCommentId` | users, clients, comments | n:1 | y / cond / n | keep |
| `documents[].projectId/unitId/brandId/dealId/companyId/contactId` | … | n:1 | ≥1 required | keep |
| `documents[].uploadedBy`, `documentGroupId`, `supersededByDocumentId` | users, documents | n:1 | y / n / n | keep |
| `reports[].projectId`, `clientId`, `generatedBy`, `previousReportId` | … | n:1 | cond | keep |
| `statusHistory[].entityId`, `byUserId` | any, users | n:1 | y | keep |
| `auditLog[].userId`, `entityId` | users, any | n:1 | y / n | keep |

### 5.3 Back-references are caches

`project.buildingIds`, `project.floorIds`, `project.unitIds`, `project.documentIds`, `site.buildingIds`, `building.floorIds`, `floor.floorPlanIds`, `floor.unitIds`, `unit.dealIds`, `unit.documentIds`, `unit.activityIds`, `unit.commentIds`, `unit.statusHistoryIds`, `brand.contactIds` (paired with `contact.brandIds`), `brand.history.*`, `company.brandIds`, `company.contactIds`, `contact.dealIds`, `contact.projectIds`, `client.userIds`, `requirement.dealIds`, `deal.activity.activityIds`, `deal.documentIds`.

Rules: the **child's forward reference is authoritative**. Back-reference arrays exist because `§9`, `§11`, `§18` and `§19` list them and because they make drawer rendering cheap. They are rebuilt by `services.rebuildBackReferences()` after load, after every import and after every mutation batch; a divergence found on load is repaired silently and counted in the integrity report. No business rule ever reads a back-reference without the rebuild having run. `brand.contactIds` / `contact.brandIds` is the one genuinely symmetric pair: both sides are written together by the service that links them.

### 5.4 Archive and delete

RECOMMENDATION (P12): v0.1 offers **soft archive** on `projects`, `sites`, `buildings`, `floors`, `units`, `brands`, `companies`, `contacts`, `requirements`, `deals`, `tasks`, `documents` and `users`. Archiving sets `archivedAt` and `archivedBy`, writes `statusHistory` and `auditLog` rows, and removes the record from default lists, pickers, KPI sums and the portal, while every historical reference keeps resolving.

| Operation | Offered in v0.1 | Rule |
|---|---|---|
| Archive a unit | yes | Refused while an **open** deal references it; the dialog offers to close those deals as `Closed Lost` with a reason first. Excluded from all inventory buckets afterwards (`07` §2) |
| Archive a deal | yes | Allowed in any stage; an open deal is first moved to `Closed Lost` with a reason (`§22`) |
| Archive a brand / company / contact | yes | Allowed; open deals referencing it are listed in the confirmation |
| Archive a project / building / floor | yes | Refused while non-archived children exist ("archive 12 units first"); never cascades silently |
| Delete permanently | no | Not offered. The only way to remove data is a replace-all import or "reset to demo data" (`08` §5) |
| Comments, activities, statusHistory, auditLog, reports | not archivable | Append-only history (`§54`). A comment is resolved, not removed |
| Floor plan versions | no delete | Archived versions may only be `svgDropped` (`06` §2.4) |

---

## 6. Referential-integrity invariants

`services.integrityReport()` returns `{errors[], warnings[], repairs[]}` and runs on load, after every import, on demand in Settings → Data, and as a QA hook. Errors block an import (`08` §7.1); on load they are repaired where a safe repair exists and reported otherwise. The list is closed: every check below has a code.

| Code | Invariant | Level | Repair |
|---|---|---|---|
| `I-01` | Every reference in the table of 5.2 resolves to an existing record | error | dangling optional reference → `null` and reported; dangling required reference → record quarantined and listed |
| `I-02` | `unit.floorId` → `floor.buildingId` → `building.projectId` chain is consistent with `unit.buildingId` and `unit.projectId` | error | `buildingId`/`projectId` recomputed from `floorId`, which is authoritative |
| `I-03` | `floor.projectId === building.projectId`; `building.projectId === site.projectId` when `siteId` is set | error | recomputed from the parent |
| `I-04` | `deal.projectId` equals `unit.projectId` of **every** id in `deal.unitIds` | error | the offending unit id is removed from `unitIds` and listed; a deal is never silently moved to another project |
| `I-05` | `deal.unitIds` contains no duplicates and no archived unit at creation time | warning | duplicates removed |
| `I-06` | `deal.stage` exists in the stage list of `deal.type` and is `active` | error | unknown stage → `lead`, reported; inactive stage → kept and reported (`§44`) |
| `I-07` | `deal.status === 'Lost'` implies `outcome.lostReason` set; `lostReason === 'other'` implies `lostReasonNote` | error | not repairable; the deal is listed for the user to fix |
| `I-08` | `deal.status` agrees with the `type` of its stage (`open`/`won`/`post-signing`/`lost`, `05` §6.1) | warning | `status` recomputed from the stage |
| `I-09` | `unit.commercialStatus` is a configured key with `kind: 'inventory'` | error | unknown or derived key → `unknown`, reported (`§33` "inconsistent unit status") |
| `I-10` | `contact.companyId`, when set, exists; `contact.brandIds` all exist and each of those brands lists the contact | warning | symmetry restored from the contact side |
| `I-11` | `brand.companyId`, when set, exists; `company.brandIds` is the exact set of brands pointing at it | warning | recomputed from the brands |
| `I-12` | Exactly one `floorPlans` record per `floorId` has `current: true`; `polygonMappings[].unitId` units belong to that plan's `floorId` | error | newest `version` becomes current; offending mappings dropped (`E-PLAN-UNIT-FLOOR`) |
| `I-13` | `unit.unitNumber` unique within `projectId` | warning | reported only (3.3) |
| `I-14` | `requirement` has at least one of `brandId`, `companyId`, `contactIds` | warning | reported |
| `I-15` | `activity` and `document` have at least one link field set | warning | orphan listed in Data hygiene |
| `I-16` | `comment.authorType === 'client'` implies `clientId` set and `visibility !== 'internal'` | error | visibility raised to `client_visible`, reported |
| `I-17` | A `client` user has `clientId`; a non-client user has `clientId: null` | error | session refused (`04` §1.2) |
| `I-18` | `statusHistory[].entityId` and `auditLog[].entityId` resolve, or the target is archived | warning | reported; history is never deleted |
| `I-19` | Every `settings` key referenced by a record exists (status, stage, category, lost reason, role, currency) | warning | listed as "referenced but missing from configuration" |
| `I-20` | `meta.idCounters[prefix] >= highest suffix used` for every prefix | error | counter raised (3.2) |

### 6.1 Prospects

"Prospects of a unit" is not a stored field. It is defined as `deals.filter(d => d.status === 'Open' && stage is in the open set && d.unitIds.includes(unitId) && !d.archivedAt)`. The open set is every stage whose `type` is `open` in `settings.leasingStages` / `salesStages` (`05` §4). A unit with three prospects is three deals, not three unit rows (`§6.4`), and inventory counts its GLA once (`07` §5).

### 6.2 Deal ↔ unit consistency

A deal is created either from a unit (project inherited) or from a brand/requirement (project chosen first). Adding a unit whose `projectId` differs from `deal.projectId` is refused by the service with a message naming both projects. Changing `deal.projectId` is only possible while `unitIds` is empty.

### 6.3 `unit.actualUse.brandId`

`actualUse.brandId` may be written in exactly two ways:

1. **Automatically**, when a deal linked to the unit reaches the stage configured in `settings.kpi.actualUseFromStage` (default: leasing `contract_signed`, sales `contract`). Services then propose `brandId`, `tenantName`, `category` and `subcategory` from the deal's brand and ask for confirmation; on confirmation `actualUse.setAt/setBy` are written and `setReason` is `'deal:<DEAL-nnn>'`.
2. **Manually**, by a user with edit rights, and only with a non-empty `setReason` (for example "existing tenant, no deal in the system"). The reason is stored and shown in the unit drawer and in the audit entry.

Clearing `actualUse.brandId` follows the same rule. A stage change never writes `actualUse` silently, and never writes `commercialStatus` silently either — status suggestions are confirmed by the user (`05` §6.2).

---

## 7. Derived fields registry

FACT (`§3.5`, `§34`, D4/P4): these values are computed in `js/services.js` on every read and are **never** written into `appState`, never exported, never imported and never part of the checksum. An importer that finds them in a file drops them with a warning. Formulas live in `07_CALCULATIONS_AND_KPI_RULES.md`; this table fixes what exists and what it is derived from.

| Derived value | Scope | Derived from | Owner document |
|---|---|---|---|
| `pipelineStage(unit)` | unit | highest-`rank` stage among the unit's open deals; `null` when there is none (D5) | `05` §3 |
| `displayStatus(unit)` | unit | if the unit's status is `marketable` and `pipelineStage` rank ≥ `settings.kpi.underNegotiationStage`, the stage's `displayStatusKey`; otherwise `commercialStatus` | `05` §3 |
| `availabilityGroup(unit)` | unit | `settings.unitStatuses[commercialStatus].availabilityGroup` | `05` §2 |
| `inventoryBucket(unit)` | unit | `countsAs` of the status plus the qualifying-deal test; exactly one of leased / sold / under negotiation / available / unavailable (D6) | `07` §2 |
| `clientStatus(unit)` / `clientStatus(deal)` | unit, deal | `settings.clientStatuses` mapping of the status or stage (`§36`) | `05` §8 |
| `dealArea(deal)` | deal | `areaOverrideM2 ?? Σ area.glaM2` over the unique ids in `unitIds`; `null` when every linked unit lacks an area | `07` §3 |
| `weightedValue(deal)` | deal | annualised rent or agreed price × `probability` (stage default when not overridden) | `07` §3 |
| `stageAgeDays(deal)` | deal | `today − dateEnteredStage` | `07` §3 |
| `isOverdue(task)` | task | `status === 'Open' && dueDate < today` | `07` §9 |
| `isStale(deal)`, `isStale(brand)`, `isStale(unitTerms)` | deal, brand, unit | `settings.staleRules` thresholds against `activity.lastContactDate`, `relationship.lastContactDate`, `updatedAt` (`§41`) | `07` §9 |
| `completeness(brand \| unit \| deal)` | record | the check lists of `§40` | `07` §8 |
| `clientStatusCounts`, mix aggregates, GLA sums, conversion, stage aging | project, portfolio | units + deals | `07` §2–§6 |
| `matchScore(brand, unit)` | pair | `expansionRequirements` vs unit characteristics (`§39`) | `07` §7 |
| `duplicateCandidates(brand \| company \| contact)` | record | normalised name / phone / email comparison (`§30` of the MVP list, `08` §8.4) | `08` §8.4 |
| `computedUnitCount`, `computedFloorCount`, `computedGlaM2` | project, building, floor | counts and sums over non-archived units | `07` §2 |
| `aggregate provenance` | any aggregate | weakest `conf` and oldest `at` of the contributing records (D16) | `07` §1.4 |

Two stored fields look derived and are not: `deal.status` (stored because it is the primary filter and must survive a stage-list edit) and `deal.probability` (stored because a user may override it, `probabilityOverridden`). Both are checked against their stage by `I-06`/`I-08`.

---

## 8. `statusHistory` and `auditLog`

### 8.1 `statusHistory` — `SH-nnn`

Purpose (`§65` "status history is created", `§3.5`): a business-readable history of the state changes an operator cares about. It is not the audit log.

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | `SH-nnn` | y | |
| `entityType` | `'unit' \| 'deal' \| 'project' \| 'floorPlan' \| 'task' \| 'comment'` | y | |
| `entityId` | id | y | |
| `field` | `'commercialStatus' \| 'stage' \| 'status' \| 'responseStatus' \| 'archived'` | y | Which tracked field changed |
| `fromValue`, `toValue` | string \| null | y | Stored keys, not labels; `fromValue` is `null` on creation |
| `at` | ISO datetime | y | |
| `byUserId` | `USER-nnn` \| null | y | `null` only for imported history |
| `reason` | string \| null | n | Required for `stage → closed_lost` (the lost reason key) and for a manual `actualUse` change (section 6.3) |
| `source` | `'ui' \| 'tool' \| 'import' \| 'migration'` | y | `tool` = written through `LSP.runTool` (D12) |
| `relatedDealId` | `DEAL-nnn` \| null | n | Set when a unit status change was suggested by a deal transition |

Writers (the only ones): the unit status service, the deal stage service, the deal status service, the archive service, the comment response-status service, the floor-plan publish service, and the import adapter (one creation row per imported unit, `source: 'import'`). Appended in `js/state.js`; nothing else may push into the array. The array is never pruned in v0.1.

### 8.2 `auditLog` — `AUD-nnn`

FACT (`§54`): for the MVP, record important changes in a local audit log; the future production list is user, timestamp, action, prompt, tools used, datasets accessed, fields changed, reports generated, exports produced, client-visible actions and permanent changes. The MVP records the subset it can honestly record.

| Field | Type | Req | Notes |
|---|---|---|---|
| `id` | `AUD-nnn` | y | |
| `at` | ISO datetime | y | |
| `userId`, `roleKey` | `USER-nnn` \| null, role key | y | The acting session |
| `action` | dotted key | y | `record.created`, `record.updated`, `record.archived`, `unit.statusChanged`, `deal.stageChanged`, `deal.termsOverridden`, `document.registered`, `comment.added`, `comment.resolved`, `report.generated`, `settings.changed`, `plan.published`, `plan.mappingsChanged`, `import.json.completed`, `import.csv.completed`, `import.caseos.completed`, `export.json`, `export.csv`, `state.reset`, `state.recovered`, `session.login`, `session.logout`, `tool.called` |
| `entityType`, `entityId` | string \| null, id \| null | n | The object acted on |
| `fields` | `[{path, from, to}]` | n | Changed fields; money and rent values included, free-text bodies truncated to 200 characters |
| `details` | object | n | Action-specific payload (counts, warning codes, tool name and parameters, file name) |
| `clientVisibleAction` | boolean | y | `true` when the action changed something a client can see (`§54`) |
| `permanent` | boolean | y | `true` for archive, import, reset and settings changes (`§53` "permanent edits require confirmation") |
| `source` | `'ui' \| 'tool' \| 'import' \| 'migration'` | y | |

`auditLog` is append-only, is exported with the state, is visible to `founder_admin` and `head_ls` only, and is the one collection with a compaction action (export to CSV first, then keep the last `settings.persistence.auditKeep` entries, default 2 000 — `08` §12.3). It contains no credential, no session token and no client personal data beyond what the acted-on record already holds (`§55`).

### 8.3 Automatic activity rows

Four services also append an `activities` row with `systemGenerated: true` and `relatedId` pointing at the history row: stage change, unit status change, document registration, task completion (`§28`). This is what makes the unit and deal timelines complete without manual entry. Every such write also refreshes `unit.operational.lastActivityDate` and `deal.activity.lastContactDate` when the activity type is a contact type (`call`, `meeting`, `viewing`, `email_note`, `messenger_note`, `proposal_sent`).

---

## 9. CASE OS mapping and import adapter

Scope: this section owns the **field-by-field** mapping; `08_PERSISTENCE_IMPORT_EXPORT.md §9` owns the adapter's workflow (detection, dry run, confirmation, warning codes, privacy notice) and `13_CASE_OS_v4731_REUSE.md` the deployment context. The adapter is a one-way import transformation, not a synchronisation (D1). Source: a `CASE_OS_backup_YYYY-MM-DD.json` produced by `exportAllJSON()` (FACT: `os/core.js` `stateBlob()`).

### 9.1 `OBJECTS[]` → `projects`

| CASE OS field | Example | LSP target | Rule |
|---|---|---|---|
| `id` | `'ca'` | `externalIds.caseOsObjectId` | verbatim; also the adapter's in-memory key |
| `name` | `'Creative Avenue'` | `name` | |
| `ru` | `'Креативное авеню'` | `alternativeNames[0]` | omitted when equal to `name` |
| `country`, `city` | `'Узбекистан'`, `'Ташкент'` | `country`, `city` | verbatim; not translated |
| `type` | `'Mall'`, `'Mixed-use'`, `'Plinth retail'` | `assetTypes[0]` | mapped through `settings.assetTypes` aliases (D21); unknown → `'Other'` + `W-CO-ASSETTYPE` |
| `gba`, `gla` | `18500`, `17560` | `areas.gbaM2`, `areas.glaM2` | `0`, `''` and missing → `null` (P10) |
| `lat`, `lng` | `41.58`, `64.21` | `latitude`, `longitude` | only when both are finite numbers |
| `cur` | `'сумах по курсу ЦБ РУз'` | `commercial.currency` | contains "сум" → `'UZS'`, else `'USD'`; `W-CO-CURRENCY` always emitted because the string is free text |
| `sc`, `inc` | `10`, `5` | — | service charge and indexation defaults are project-level in CASE OS; carried into `commercial.pricingNotes` as text |
| `vat`, `vatRate` | `'incl'`, `12` | — | carried into `commercial.pricingNotes`; per-unit `vatTreatment` stays `'Unknown'` |
| `cond` | `'shell & core'` | `commercial.pricingNotes` | appended |
| `comm` | `{type, total, note}` | — | **not imported**: LSP commission rules are configured in Settings (`§6.6`); `W-CO-COMM-SKIPPED` with the text preserved in `notes.internal` |
| `plan` | `'Свой объект'` / `'Подписка ТЦ'` | `notes.internal` | engagement type; no LSP field in v0.1 |
| `levels` | `'dual'` / `'single'` | — | skipped |
| — | | `commercialMode` | `'leasing'` (CASE OS `U` is a leasing registry); sales assets are not imported |
| — | | `status`, `visibility`, `demoRecord` | `'Active'`, `'client_visible'`, `false` |

### 9.2 `U[]` → `buildings`, `floors`, `units`

Buildings: one per distinct block. FACT: CASE OS derives blocks from `PLAN_STRUCT[objId].blocks` and from `PLANSVG` keys `objId::block::floor`; unit codes such as `'B1_104'` carry the block as the prefix before `_`. Rule: block = `PLAN_STRUCT` block if present, else the code prefix when it matches `^[A-Za-zА-Яа-я]{1,3}\d?(?=[_-])`, else a single building `'Main'` with `blockCode: null` and `W-CO-NO-BLOCKS`.

Floors: one per `(building, U[].floor)` label. Label parsing → `floorNumber`:

| Label pattern | `floorNumber` | `name` |
|---|---|---|
| `'1 этаж'`, `'2 этаж'`, `'-1 этаж'` (leading integer) | that integer | the label verbatim |
| `'Цоколь'` | `0` | the label verbatim |
| `'Подвал'` | `-1` | the label verbatim |
| `'Мезонин'`, `'Антресоль'` | `null`, `sortOrder` between the neighbours | the label verbatim |
| anything else | `null` | the label verbatim, `W-CO-FLOOR-UNPARSED` |

Units:

| CASE OS field | LSP target | Rule |
|---|---|---|
| `id` (`'u12'`) | — | volatile; used only in the adapter's in-memory map for `PROV` resolution, never persisted |
| `code` | `unitNumber`, `externalIds.caseOsUnitCode` | verbatim |
| `merged` (`['B1_107','B1_108']`) | `label`, `operational.notes` | **one** LSP unit; `label = codes.join(' + ')`; a note records the merge; `W-CO-MERGED`. A multi-unit deal is created instead only when the codes also exist as separate `U` rows (then the merged row is skipped and the deal links both units) |
| `floor` | `floorId` | via the table above |
| `area` | `area.glaM2` | `0`/`''` → `null` + `W-CO-NO-AREA` |
| `terr` | `area.terraceM2` | never added to GLA |
| `cat`, `sub` | `targetUse.category`, `targetUse.subcategory` | via the CASECATS mapping of 9.6 |
| `rate` | `leasingTerms.askingRent` | `rentUnit` from the project; `0` → `null` |
| `budget` | `leasingTerms.askingRent` fallback | used only when `rate` is empty; noted |
| `total`, `gap` | — | derived figures in CASE OS; recomputed by LSP (`07`) |
| `status` | `commercialStatus` + open deals | split rule of 9.3 |
| `broker` | `responsibility.responsibleManagerId` | via the editable broker → user table; unmapped → `null` + `W-CO-BROKER-UNMAPPED` |
| `vars[]` | `deals` | 9.3 |
| `dates[[label,date]]` | `tasks` | `title = label`, `dueDate = date`, `status = 'Open'` when `date ≥ today` else `'Done'`; `W-CO-DATES` with a count |
| `comment` | `operational.notes[0]` | note entry with `authorId: null` |
| `hist[]` | `activities` | `type: 'email_note'`, `systemGenerated: false`, `authorId: null` |
| `assigned_to`, `shortlist`, `offer(s)` | `notes.internal` | no typed LSP counterpart in v0.1 |
| — | `commercialMode`, `visibility`, `demoRecord` | `'leasing'`, `'client_visible'`, `false` |

### 9.3 `STAT` split rule (D5)

FACT (`os/core.js` line 318): `STAT = {vac, neg, off, os, cs, cd, res}` is one field mixing inventory state and deal stage — exactly what `§6.3` forbids. The adapter splits it:

| `U[].status` | CASE OS label | → `unit.commercialStatus` | → open deal per name in `vars[]`, at stage |
|---|---|---|---|
| `vac` | Вакант | `available` | none |
| `neg` | Переговоры | `available` | `negotiation` (Negotiation) |
| `off` | Предложено | `available` | `unit_offered` (Property / Unit Offered) |
| `os` | Предложение подписано | `available` | `loi_terms` (LOI / Commercial Terms) |
| `cs` | Контракт на подписании | `available` | `contract_draft` (Contract Draft) |
| `cd` | Контракт подписан | `contract_signed` | `contract_signed` (Contract Signed) for `vars[0]`; `vars[1..]` become `lead` |
| `res` | Резерв | `reserved` | `negotiation` (Negotiation) |
| anything else | — | `unknown` | none; `W-CO-STATUS-UNKNOWN` |

Deals created this way are `type: 'Leasing'`, `status: 'Open'` (`'Won'` for the `cd` primary deal per `05` §6.1), `dateEnteredStage: null`, `probability` from the stage default, `brandId` resolved by `norm(name)` against the imported brands (`null` + `W-CO-BRAND-UNRESOLVED` otherwise), `ownership.responsibleManagerId` from the unit's broker mapping. On `cd` the adapter also sets `actualUse.tenantName = vars[0]` with `setReason: 'CASE OS import'`. One `statusHistory` row per unit is written with `source: 'import'` and `reason: 'CASE OS import'`.

### 9.4 `BRANDS[]` → `brands` (+ `companies`)

| CASE OS field | LSP target | Rule |
|---|---|---|
| `name` | `name`, `externalIds.caseOsBrandName` | duplicate warning, never blocking |
| `cat`, `sub` | `classification.category`, `classification.subcategory` | CASECATS mapping (9.6) |
| `country` | `countryOfOrigin` | |
| `format` | `classification.format` | alias-normalised (D21) |
| `amin`, `amax` | `expansionRequirements.minimumAreaM2`, `maximumAreaM2` | numbers only; text → `notes.internal` |
| `fr` | `classification.brandType` | franchise/ownership text → `'Franchise'` / `'Own operation'`; unmapped → `notes.internal` |
| `person`, `phone`, `email` | one `contacts` record | name split on the first space; linked both ways; deduplicated (`08` §8.4) |
| `site` | `website` | |
| `ig` | `notes.general` | no typed social field in v0.1 |
| `reqs` | `expansionRequirements.fitOutRequirements` | |
| `coten` | `expansionRequirements.accessRequirements` | co-tenancy text; noted as such |
| `status` (`active`/`target`/`refused`) | `relationship.relationshipStatus` | `'In contact'` / `'New'` / `'Refused'`; `brand.status` = `'Active'`/`'Active'`/`'Refused'` |
| `notes`, `about` | `notes.internal`, `notes.general` | |
| `pos`, `concept`, `rec` | `notes.general` | |
| `group` | `companies` | one company per distinct `norm(group)`, `legalName = group`, `brand.companyId` set; empty `group` → `companyId: null` (`§19`: never one company per brand) |
| `price`, `tier` | `classification.priceSegment` | mapped through an alias table; unmapped → `notes.internal` |
| `founded`, `icsc`, `uz_op`, `net_pts`, `net_countries` | `notes.general` | no typed counterparts in v0.1 |
| `logo`, `shopfront`, `interior` | `logoUrl` (logo only) | data URLs are counted and reported in the size estimate; images other than the logo are skipped |
| `contacts[]`, `owner`, `lastContact` | `contactIds`, `relationship.ownerId`, `relationship.lastContactDate` | owner mapped through the broker → user table |
| `hist[]`, `editedBy`, `editedAt` | `activities` | one `email_note` per entry, `authorId: null` |

### 9.5 `DOC_CONTACTS[]` → `contacts`, `PLANSVG` → `floorPlans`

| Source | Target | Rule |
|---|---|---|
| `DOC_CONTACTS[].name` | `firstName` + `lastName` | split on the first space; a single token becomes `firstName` |
| `DOC_CONTACTS[].title` | `position` | |
| `DOC_CONTACTS[].phone`, `.email` | `phones[0]`, `emails[0]` | `label: 'work'`; deduplicated against brand-derived contacts (`W-CO-CONTACT-DUP`) |
| — | `companyId`, `brandIds`, `visibility` | `null`, `[]`, `'internal'` (document contacts have no brand link in CASE OS) |
| `PLANSVG[objId::block::floor]` `{kind:'svg', data}` | `floorPlans` | `version: 1`, `current: true`, `format: 'SVG'`, `svgText` = sanitized `data`, `externalIds.caseOsPlanKey` = the key, `visibility: 'internal'` |
| `PLANSVG[...]` `{kind:'img', data}` | `floorPlans.backgroundUrl` | off by default (size); opt-in per plan with a quota estimate; `W-CO-PLAN-RASTER-SKIPPED` |
| `PLANSVG` text labels | `polygonMappings` **suggestions** | EXPERIMENTAL (`§6.7`, `§16`): `<text>` whose content equals a unit code produces `{bindingKind:'marker', source:'label_experimental', confirmed:false, confidence}`. Unconfirmed entries never bind and never colour a unit. FACT: `os/zarafshan-l2.svg` is a CAD export with 994 `<path>`, 64 `<text>` and no unit polygons — such a plan yields label suggestions only (`W-CO-PLAN-LABELS-ONLY`) |
| `PROV[entity:id:field]` | inline `provenance` (D16) | `unit:<u.id>:area` → `unit.provenance.glaM2`; `unit:<u.id>:rate` → `unit.provenance.askingRent`; `unit:<u.id>:status` → `unit.provenance.commercialStatus`; `object:<id>:gba|gla` → `project.provenance.areas.gbaM2|glaM2`. `conf`, `src`, `how`, `at`, `by`, `name`, `basis`, `note` copied verbatim; unmapped keys counted (`W-CO-PROV-UNMAPPED`). The mapping is symmetric so a future fold-back can write `PROV` keys back |

### 9.6 `CASECATS` → merchandise categories

FACT (`os/core.js` line 506): `CASECATS` is 17 Russian categories. D15 defines the LSP defaults. The adapter ships this table pre-filled and **editable in the dry run**; a confirmed mapping is written into the category `aliases` (D21) so the next import needs no manual step.

| CASECATS (RU) | LSP category key | | CASECATS (RU) | LSP category key |
|---|---|---|---|---|
| Мода и стиль | `fashion` | | Мебель и товары для дома | `home_interior` |
| Обувь и аксессуары | `fashion` (sub `footwear`) | | Склады / кладовки | `other` |
| Услуги, киоски, спец. магазин | `services` | | Автозапчасти и аксессуары | `other` |
| Парфюмерия и косметика | `beauty` | | Спортивная одежда и товары | `sports` |
| Игрушки, книги, канцтовары и хобби | `kids_education` | | Офисы | `office` |
| Ювелирные изделия, очки и бижутерия | `fashion` (sub `jewellery`) | | Терраса | `other` |
| Места общественного питания | `fnb` | | Вспомогательные и тех. помещения | `other` |
| Развлечение | `entertainment` | | (unmapped value) | `other` + `W-CO-CATEGORY-UNMAPPED` |
| Супермаркет / гипермаркет | `grocery` (role `anchor`) | | | |
| Электроника, бытовая техника | `electronics` | | | |

### 9.7 Warnings the adapter must emit

`W-CO-CURRENCY`, `W-CO-ASSETTYPE`, `W-CO-COMM-SKIPPED`, `W-CO-NO-BLOCKS`, `W-CO-FLOOR-UNPARSED`, `W-CO-NO-AREA`, `W-CO-MERGED`, `W-CO-CATEGORY-UNMAPPED`, `W-CO-BROKER-UNMAPPED`, `W-CO-STATUS-UNKNOWN`, `W-CO-BRAND-UNRESOLVED`, `W-CO-CONTACT-DUP`, `W-CO-DATES`, `W-CO-PLAN-LABELS-ONLY`, `W-CO-PLAN-NO-MATCH`, `W-CO-PLAN-RASTER-SKIPPED`, `W-CO-PROV-UNMAPPED`, `W-CO-ROLE-MAPPED`, `W-CO-USER-SKIPPED`, `W-CO-LAYOUT-VERSIONS-SKIPPED`, `W-CO-FINANCE-REDACTED` (a backup exported by a CASE OS user without `finance` rights contains no `rate`/`budget` — FACT: server-side redaction in v4.73.1 `state.php`/`lib.php`).

Each warning is grouped by code with a count and up to five examples, and every skipped state key is listed with its record count, so nothing disappears silently (`08` §9.3). Not imported: `AUDIT`, `ACTLOG`, `CHANGES`, `REFUSALS`, `DOCREG`, `CASE_*` consulting entities, commissions, `GEO_DATA`, `BENCH`, `TAXO`, plan snapshots and layout versions.

---

## 10. Future extension hooks

FACT (`§3.6`, `§50`): Asset Management, lease administration, rent roll, payments, arrears, NOI, budgets, CAPEX, Facility Management, work orders, equipment, inspections and Building OS must remain possible, and must not be implemented now. The model supports them through **new top-level collections that reference existing ids**, never through new fields on `unit` or `deal`.

| Future collection | Prefix | Anchors | What it would hold | Phase |
|---|---|---|---|---|
| `leases` | `LEASE` | `unitIds[]`, `dealId`, `brandId`, `projectId` | executed lease terms, dates, options, indexation schedule (lease administration) | Building OS / AM |
| `rentRoll` | `RR` | `leaseId`, `unitId`, period | charges, invoices, receipts, arrears, turnover declarations | AM |
| `budgets` | `BUD` | `projectId`, `buildingId`, period | budget vs actual, NOI, OPEX, CAPEX lines | AM |
| `workOrders` | `WO` | `unitId`, `buildingId`, `equipmentId` | helpdesk and maintenance jobs, SLA, vendor | FM |
| `equipment` | `EQ` | `buildingId`, `floorId`, `unitId` | technical systems, warranty, service history | FM / Building OS |
| `inspections` | `INSP` | `buildingId`, `floorId`, `unitId`, `equipmentId` | checklists, findings, photos | FM |

Why this works without a rewrite: units, floors, buildings and projects already have stable IDs (P2, D13) that outlive plan versions and deals; `floorPlans.polygonMappings` already makes the plan a reusable **spatial entity layer** (`§50`) that any of the collections above can render on; `externalIds.propertyId` / `geoMasterId` already reserve the ecosystem identifiers (`§49`); `visibility` already exists on every object so future roles (Asset Manager, Facility Manager, Tenant Portal User) can be added to `settings.roles` without touching records.

**What must NOT be done now** (scope guard, `§3.6`, `§50`, `leasing-product-architect`): no lease, charge, invoice, payment, arrears, NOI, budget, work-order, equipment or inspection fields on `unit` or `deal`; no rent-roll or accounting calculation in `js/services.js`; no `leaseStart`/`leaseExpiry` driven renewal logic beyond storing the dates `§11` already defines; no tenant-facing portal; no second spatial model beside `floorPlans`. Adding any of these to an existing entity is the change that would force a migration later, which is exactly what this section prevents.

---

## 11. Example records (demo dataset, D4 — fictional)

Abridged to the fields that carry meaning; every record also has `demoRecord: true`, `createdAt` and `updatedAt`. All names, numbers and contacts are invented.

```javascript
{ id:"CLIENT-001", name:"Demo City Holding", type:"Owner", country:"Uzbekistan", city:"Tashkent",
  reportingCadence:"Monthly", userIds:["USER-007"], visibility:"internal" }

{ id:"PROJ-001", name:"Demo City Mall", alternativeNames:["Demo City"], clientIds:["CLIENT-001"],
  city:"Tashkent", country:"Uzbekistan", assetTypes:["Retail"], status:"Active", commercialMode:"leasing",
  areas:{ gbaM2:32000, glaM2:18500, unitCount:30, floorCount:2 },
  commercial:{ mandateMode:"Exclusive", mandateExpiryDate:"2027-03-31", currency:"USD",
               rentUnit:"USD/m2/month", targetOccupancyPercent:92 },
  team:{ headId:"USER-002", projectLeadId:"USER-003", administratorId:"USER-005" },
  externalIds:{}, visibility:"client_visible" }

{ id:"BLDG-001", projectId:"PROJ-001", name:"Main Building", blockCode:"A", status:"Operating" }
{ id:"FLOOR-001", projectId:"PROJ-001", buildingId:"BLDG-001", floorNumber:1, name:"Ground Floor",
  sortOrder:1, status:"Active" }
{ id:"PLAN-001", projectId:"PROJ-001", buildingId:"BLDG-001", floorId:"FLOOR-001", version:1,
  current:true, archived:false, format:"SVG", fileName:"demo-city-ground.svg", viewBox:[0,0,1200,800],
  polygonCount:17, svgDropped:false, visibility:"client_visible",
  polygonMappings:[{ polygonId:"p-A-102", unitId:"UNIT-002", bindingKind:"polygon",
                     source:"attribute", confirmed:true, confidence:null }] }

{ id:"UNIT-002", projectId:"PROJ-001", buildingId:"BLDG-001", floorId:"FLOOR-001",
  unitNumber:"A-102", label:"Unit A-102", geometry:{ polygonId:"p-A-102", areaSource:"Plan" },
  area:{ glaM2:142.5, terraceM2:null },
  targetUse:{ category:"fashion", subcategory:"fashion_mass", merchandiseRole:"inline" },
  actualUse:{ brandId:null, tenantName:null, category:null, subcategory:null },
  commercialStatus:"available", commercialMode:"leasing",
  leasingTerms:{ askingRent:26, currency:"USD", rentUnit:"USD/m2/month", serviceCharge:5,
                 vatTreatment:"Unknown" },
  responsibility:{ responsibleManagerId:"USER-003" },
  operational:{ nextAction:"Send revised offer", nextActionDate:"2026-09-19",
                lastActivityDate:"2026-09-15", notes:[] },
  provenance:{ glaM2:{ conf:"verified", src:"document", how:"document",
                       name:"Measurement report 06/2026", at:"2026-06-12T08:00:00.000Z",
                       by:"USER-005" } },
  externalIds:{}, visibility:"client_visible" }

{ id:"COMP-003", legalName:"Demo Retail Group LLC", tradingName:"Demo Retail Group", country:"Turkey",
  companyType:"Brand owner", brandIds:["BRAND-007","BRAND-008"], responsibleManagerId:"USER-003" }

{ id:"BRAND-007", name:"Demo Denim", countryOfOrigin:"Turkey", status:"Active",
  classification:{ category:"fashion", subcategory:"fashion_mass", priceSegment:"Mass",
                   format:"Standard", brandType:"International" },
  companyId:"COMP-003", contactIds:["CONT-011"],
  expansionRequirements:{ targetCities:["Tashkent"], minimumAreaM2:120, preferredAreaM2:160,
                          maximumAreaM2:220, floorPreference:"ground",
                          targetRentRange:{ min:20, max:30, currency:"USD",
                                            rentUnit:"USD/m2/month" } },
  relationship:{ ownerId:"USER-003", relationshipStatus:"Negotiating",
                 lastContactDate:"2026-09-15" }, visibility:"internal" }

{ id:"CONT-011", firstName:"Demo", lastName:"Contact", position:"Expansion Manager",
  companyId:"COMP-003", brandIds:["BRAND-007"],
  phones:[{ label:"mobile", value:"+998 90 000 00 11" }],
  emails:[{ label:"work", value:"expansion@example.invalid" }],
  preferredLanguage:"en", relationshipOwnerId:"USER-003", visibility:"internal" }

{ id:"REQ-004", title:"Demo Denim — 1 unit, Tashkent, Q1 2027", type:"Leasing", brandId:"BRAND-007",
  companyId:"COMP-003", contactIds:["CONT-011"], status:"Matched", responsibleManagerId:"USER-003",
  criteria:{ cities:["Tashkent"], category:"fashion", minAreaM2:120, maxAreaM2:220,
             floorPreference:"ground" }, dealIds:["DEAL-012"], visibility:"internal" }

{ id:"DEAL-012", type:"Leasing", projectId:"PROJ-001", unitIds:["UNIT-019","UNIT-020"],
  areaOverrideM2:null, brandId:"BRAND-007", companyId:"COMP-003", contactIds:["CONT-011"],
  requirementId:"REQ-004", ownership:{ responsibleManagerId:"USER-003" },
  stage:"loi_terms", dateEnteredStage:"2026-09-08", probability:65, probabilityOverridden:false,
  status:"Open",
  stageHistory:[{ stage:"lead", at:"2026-07-21T09:00:00.000Z", by:"USER-003", fromStage:null,
                  note:null },
                { stage:"loi_terms", at:"2026-09-08T14:05:00.000Z", by:"USER-003",
                  fromStage:"negotiation", note:"LOI sent" }],
  commercialTerms:{ askingRent:26, proposedRent:24, agreedRent:null, serviceCharge:5,
                    rentFreePeriod:"60 days", leaseTerm:"5 years", currency:"USD",
                    rentUnit:"USD/m2/month", vatTreatment:"Unknown" },
  termsHistory:[{ field:"commercialTerms.proposedRent", from:26, to:24, by:"USER-002",
                  at:"2026-09-08T13:40:00.000Z", reason:"Head approved 2 USD discount, 5-year term" }],
  nextAction:{ text:"Collect LOI signature", ownerId:"USER-003", dueDate:"2026-09-22" },
  activity:{ lastContactDate:"2026-09-15", activityIds:["ACT-045"] },
  outcome:{ won:false, lost:false, lostReason:null, commissionStatus:"Not Applicable" },
  commission:{ ruleKey:"standard_leasing", currency:"USD", grossCommission:null, status:"Pending" },
  visibility:"internal" }

{ id:"TASK-021", title:"Collect LOI signature", projectId:"PROJ-001", unitId:"UNIT-019",
  dealId:"DEAL-012", assigneeId:"USER-003", dueDate:"2026-09-22", priority:"High", status:"Open",
  createdBy:"USER-003", visibility:"internal" }

{ id:"ACT-045", type:"meeting", at:"2026-09-15T10:00:00.000Z", authorId:"USER-003",
  subject:"LOI walkthrough with Demo Denim", dealId:"DEAL-012", unitId:"UNIT-019",
  brandId:"BRAND-007", systemGenerated:false, visibility:"internal" }

{ id:"CMT-008", authorId:"USER-007", authorType:"client", clientId:"CLIENT-001", projectId:"PROJ-001",
  unitId:"UNIT-002", text:"Why is this unit still available after the campaign?",
  visibility:"client_visible", responseStatus:"Open", createdAt:"2026-09-16T07:41:00.000Z" }

{ id:"DOC-014", fileName:"Demo City Mall - LOI Demo Denim v2.pdf", category:"LOI", projectId:"PROJ-001",
  unitId:"UNIT-019", dealId:"DEAL-012", version:2, documentGroupId:"DOC-011", uploadedBy:"USER-003",
  uploadedAt:"2026-09-08T14:10:00.000Z", visibility:"internal", fileSize:184320,
  mimeType:"application/pdf", localUrl:null }

{ id:"RPT-006", type:"client", projectId:"PROJ-001", clientId:"CLIENT-001", periodFrom:"2026-08-01",
  periodTo:"2026-08-31", generatedAt:"2026-09-01T06:00:00.000Z", generatedBy:"USER-005",
  previousReportId:"RPT-004", sections:["summary","progress","mix","key_deals","next_steps"],
  visibility:"client_visible" }

{ id:"SH-031", entityType:"deal", entityId:"DEAL-012", field:"stage", fromValue:"negotiation",
  toValue:"loi_terms", at:"2026-09-08T14:05:00.000Z", byUserId:"USER-003", reason:null, source:"ui" }

{ id:"AUD-118", at:"2026-09-08T14:05:00.000Z", userId:"USER-003", roleKey:"manager",
  action:"deal.stageChanged", entityType:"deal", entityId:"DEAL-012",
  fields:[{ path:"stage", from:"negotiation", to:"loi_terms" }],
  clientVisibleAction:false, permanent:false, source:"ui" }
```

---

## 12. Size estimate

Method: characters of `JSON.stringify(data)`; localStorage stores UTF-16, so bytes ≈ characters × 2 (`08` §12.1). The demo dataset is D4: 2 projects, 2 buildings, 5 floors, 45 units, ~24 brands, ~10 companies, ~30 contacts, ~31 deals, 3 current floor plans + 1 archived, 8 users, 2 clients.

| Collection | Records | Avg chars/record | Total chars | Note |
|---|---|---|---|---|
| `units` | 45 | ~1 100 | ~50 000 | the widest business record (four nested blocks) |
| `deals` | 31 | ~1 400 | ~43 000 | `stageHistory` and `termsHistory` grow with use |
| `brands` | 24 | ~1 200 | ~29 000 | `expansionRequirements` dominates |
| `contacts` + `companies` | 40 | ~450 | ~18 000 | |
| `activities` | ~90 | ~300 | ~27 000 | grows fastest in daily use |
| `tasks`, `comments`, `documents`, `requirements` | ~90 | ~350 | ~31 000 | |
| `projects`, `sites`, `buildings`, `floors`, `users`, `clients` | ~25 | ~800 | ~20 000 | |
| `statusHistory` + `auditLog` | ~200 | ~260 | ~52 000 | append-only; `auditKeep` caps the log at 2 000 entries ≈ 520 000 chars |
| `settings` | 1 | — | ~25 000 | full configuration when edited; `{}` when untouched |
| `floorPlans` **without** `svgText` | 4 | ~2 500 | ~10 000 | `polygonMappings` for 45 units |
| `floorPlans.svgText` | 3 current | < 60 000 each | ~150 000 | hand-authored demo plans (`06` §10) |
| **Total demo state** | | | **≈ 455 000 chars ≈ 0.87 MB** | |
| Plus backup slot (`caseos-lsp-backup-v1`) | | | **≈ 1.75 MB together** | the backup doubles the footprint (D9) |

Against the `08` §12.2 thresholds this is `ok` (< 2 MB) with headroom, and well under the 4 MB warning. Growth drivers, in order: plan SVG text, `auditLog`, `activities`. A CASE OS import of a real portfolio is the realistic risk — a single CAD plan such as `os/zarafshan-l2.svg` is ~228 000 characters on its own, so the adapter shows a per-plan size estimate with an exclude checkbox before writing (`08` §9.3). The add-on package budget of D18 (≤ 1.5 MB of shipped files) is a separate limit and is unaffected by localStorage.

---

## 13. Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | UI language: English base + Russian, `t(key)` from day one (D3, brief) | field labels change, not the schema |
| A-2 | All demo data is fictional and flagged `demoRecord: true` (D4, brief) | demo dataset is rebuilt |
| A-3 | Merchandise categories = the `§14.2` list plus Home & Interior, Sports, Kids & Education, Health/Pharmacy, Anchor Supermarket, editable in Settings (D15, brief) | the 9.6 mapping table and `targetUse`/`actualUse` values change; no schema change |
| A-03-1 | Datetime fields store UTC with milliseconds and date-only fields store the local business date without a timezone; no LSP record needs sub-day precision on a business date | mixed-timezone teams would see off-by-one dates; fix is a per-user timezone in `settings` |
| A-03-2 | `sites` ships as an entity with no dedicated screen in v0.1; every demo building has `siteId: null` | a project with several plots needs the screen earlier than planned |
| A-03-3 | `expansionRequirements.targetRentRange` and `requirement.criteria.budget` are structured objects `{min, max, currency, rentUnit}` rather than the free text CASE OS stores | matching (`07` §7) would fall back to text comparison |
| A-03-4 | A commission belongs to exactly one deal, so it is stored as `deal.commission` and not as a collection | portfolio-level or split commissions across deals would need a `COMM-nnn` collection |
| A-03-5 | Back-reference arrays are caches rebuilt from forward references (5.3), so an inconsistent import is repaired rather than rejected | a hand-edited file could silently lose a link the user expected to be authoritative |
| A-03-6 | Documents store metadata only; `localUrl` is runtime-only and is `null` after a reload (`§6.2`) | users may expect files to survive a refresh; the UI must say so |

## 14. Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-03-1 | User and client ID prefixes: `USER-`/`CLIENT-` (this document, `04` A-04-1) or `USR-`/`CLI-` (the v0.1 prototype)? | `USER-`/`CLIENT-`, matching the spelled-out D13 prefixes; normalise the demo dataset and add migration `schemaVersion 1 → 2` that rewrites the old ids and every reference to them | Head of Leasing & Sales |
| Q-03-2 | Enum casing: `deal.type`/`deal.status` as the master prompt literals (`'Leasing'`, `'Open'`) or as lowercase keys? | Keep the master prompt literals (P11) and align the wording in `05_STATUSES_STAGES_AND_CONFIG.md §5.1`/`§6.1` and `07_CALCULATIONS_AND_KPI_RULES.md §1.2` (`dealMode` → `commercialMode`); a single sentence in each document, no code impact | Head of Leasing & Sales |
| Q-03-3 | Should `sites` appear in the UI in v0.1? | No. Ship the entity, hide the screen, revisit when a mandate covers a multi-plot complex (A-03-2) | Founder / product sponsor |
| Q-03-4 | Hard delete: should `founder_admin` be able to delete a record permanently? | No in v0.1. Soft archive plus replace-all import and "reset to demo data" cover every real need and keep history honest (`§54`) | Founder / product sponsor |
| Q-03-5 | `brand.history.rejectedProjectIds` / `rejectionReasons` are parallel arrays in `§18`. Convert to `[{projectId, reason, at}]`? | Yes, as a v0.2 migration; keep the `§18` shape in v0.1 so the master prompt schema is implemented literally and the change is one migration, not a review cycle | Head of Leasing & Sales |
| Q-03-6 | Does `unit.commercialMode` need to be narrowable below the project value (an office floor sold while the mall is leased)? | Yes — the field is per unit with the project value as the default; confirm that the team wants the mixed case in reporting (`07` §4) | Head of Leasing & Sales |
| Q-03-7 | Should the CASE OS adapter import `REFUSALS` into `brand.history.rejectedProjectIds`? | Not in v0.1 (the CASE OS structure is per object, not per brand); revisit after the first real adapter run | Head of Leasing & Sales |
