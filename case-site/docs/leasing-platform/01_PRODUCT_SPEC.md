# Product specification (MVP restated)

**Purpose.** This document restates the MVP of the Leasing & Sales Operating Platform (short name LSP) defined in `00_MASTER_PROMPT.md` as a short, implementable product specification: what is built and for whom, where every requirement lands (screen and implementation phase), what is explicitly out of scope, the non-functional constraints, and the acceptance criteria for "MVP complete". It is the entry point for the founder (product sponsor) and for the engineers who implement after approval. It does not repeat schemas, formulas, configuration tables or test procedures; those live in the sibling documents listed in section 10 and are referenced by exact file name. Facts cite `00_MASTER_PROMPT.md §n` or a CASE OS file; assumptions are labeled A-n; recommendations and open questions carry an ID (Q-01-n) with an owner.

Status: DRAFT for approval — 2026-09-17

| Field | Value |
|---|---|
| Document | `docs/leasing-platform/01_PRODUCT_SPEC.md` (item 1 of `00_MASTER_PROMPT.md §69`) |
| Product | CASE OS · Leasing & Sales Platform (LSP), `LSP_VERSION = '0.1.0'` |
| Location | `os/leasing/` beside CASE OS v4.51.0 (decision D1, needs approval) |
| Readers | Founder / product sponsor; Head of Leasing & Sales; implementing engineers |
| Related | `README.md` (index and decision log), `02_REQUIREMENTS_REVIEW.md` … `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |

---

## 1. Purpose and long-term vision

### 1.1 What is being built

- FACT (`00_MASTER_PROMPT.md §1`): a working HTML validation prototype of a commercial real estate Leasing & Sales Operating Platform, used first by the internal Leasing & Sales team and later by selected property owners and clients through a restricted client portal.
- FACT (`§1`): the first version explicitly excludes a production backend, production authentication, cloud infrastructure, enterprise security, a payment system and a full asset/facility-management system.
- FACT (`§2`): the product is not merely a CRM, a property database, a leasing tracker, a set of floor plans or a dashboard; it must become the daily operating system for commercial leasing and sales. Core model: CRM + Property Database + Brand Database + Interactive Floor Plans + Leasing Pipeline + Sales Pipeline + Documents + Tasks + Reporting + Client Portal.
- FACT (`§68`): Version 1 must build "extremely well": Leasing, Sales, CRM, Brand Database, Company and Contact Database, Project / Building / Unit Database, Interactive Floor Plans, Merchandise Mix, Client Portal, Reporting, Local Persistence. The floor plan is the spatial interface, the CRM is the relationship and deal engine, the brand database is the long-term commercial intelligence asset, the client portal is the transparency layer.

### 1.2 Ecosystem context

FACT (`§1`, `§4`, `§49`, `§50`): LSP is one module of a wider real estate operating ecosystem. The table states how each area relates to LSP v0.1 and where the extension point is documented.

| Ecosystem area (`§1`) | Relationship to LSP v0.1 | Documented in |
|---|---|---|
| Geoanalytics / Location Intelligence | Shares stable IDs (`externalIds.propertyId`, `geoMasterId`, coordinates, address, asset type). No data exchange in v0.1. | `03_DATA_MODEL.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Project Consulting | Existing CASE OS advisory workflow (CASE_TASKS, CASE_CLIENTS, CASE_OPPORTUNITIES in `os/v490-workflow.js`) stays where it is; LSP does not replace it. | `02_REQUIREMENTS_REVIEW.md` |
| Property and Building Check-up | Future; unit/building records carry `externalIds` so check-up data can attach later. | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Project Management | Future; LSP tasks are leasing/sales tasks only. | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Leasing and Sales | **This product.** | this document |
| Building OS / Digital Twin | The floor-plan layer (`floorPlans`, `polygonMappings`) is designed as a reusable spatial entity layer. | `06_FLOORPLAN_ARCHITECTURE.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Facility Management | Future; not implemented; architecture must not block it. | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Asset Management | Future (rent roll, NOI, budgets); not implemented. | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |

FACT (`§4`): the founder initially acts as curator and product/business sponsor; Nodir Mahmudxojizoda is the operational lead for Leasing & Sales; Building OS / Asset Management / Facility Management expansion will be developed with the relevant internal team including Beksulton Shaxriddinov; exact long-term role definitions can be formalized later. The software must reduce founder dependency by making processes visible, measurable, repeatable, assignable and auditable.

### 1.3 What "validation" means for v0.1

RECOMMENDATION. LSP v0.1 is successful when (a) the Leasing & Sales team can run one full week of daily work on the demo dataset without leaving the application for the tracked information (units, prospects, next actions, documents, comments); (b) the founder can judge, from the prototype, whether the master prompt's data model (unit inventory separate from deal pipeline, CRM separate from both, explicit client visibility) is the model CASE Advisory wants to take to production; (c) real CASE OS structures can be loaded locally through the import adapter (section 2.5) to test the model against real project shapes without touching production data. Validation does not require production security, multi-user concurrency or a backend (`§1`, `§55`).

---

## 2. Positioning decision D1 — NEEDS APPROVAL

### 2.1 What LSP is

DECISION D1 (see context brief; needs founder approval, Q-01-1):

- A new, self-contained module at **`os/leasing/`**, product name "CASE OS · Leasing & Sales Platform", short name **LSP**, `LSP_VERSION = '0.1.0'` in `os/leasing/index.html`.
- Its own clean data model (the master prompt's `appState`, `§8`), localStorage persistence (keys `caseos-lsp-state-v1`, `caseos-lsp-backup-v1`, `caseos-lsp-session`, `caseos-lsp-ui`, decision D9), fictional demo data (A-2), no backend, no build step, no external runtime dependencies (Google Fonts optional with system fallback, D14).
- Reachable at `https://caseadvisory.uz/os/leasing/` once the normal `os/` release zip is uploaded, and it also opens from disk (`file://`).
- Ships inside the normal `os/` release zip (D11); CASE OS `APP_VERSION`, `core.js`, `sw.js`, `index.html` and the PHP/MySQL backend are not modified.

### 2.2 What LSP is not

- Not a rewrite or refactor of `os/core.js` and not a change to any CASE OS screen, table or endpoint.
- Not linked into the CASE OS navigation in v0.1 (a catalog entry in `os/v3520-workspaces.js` is a later, separate change).
- Not a production system: prototype authentication only, local browser storage only, no server-side authorization, no secure file storage (`§6.1`, `§6.2`, `§55`).
- Not a backend, not an AI backend, not an ERP (`§5`, `§51`).

### 2.3 Relationship to CASE OS — why the model cannot be bolted onto core.js

FACTS verified in the repository (context brief section 1):

| CASE OS fact | Source | Conflict with the master prompt |
|---|---|---|
| `STAT` mixes inventory state and deal stage in one unit field (`vac, neg, off, os, cs, cd, res`) | `os/core.js` line 318 | `§6.3`: unit status and deal stage must be separate fields |
| One deal ↔ one unit (`deals.unit_id`, `unit_code`) | `os/sql/schema_mysql.sql` | `§6.5`: a deal may contain multiple units |
| Contacts exist only as document contacts (`contacts {name,title,phone,email}`, `DOC_CONTACTS`) | `os/sql/schema_mysql.sql`, `os/core.js` | `§20`: central contact database linked to brands, companies, deals, projects |
| No client/owner login; owners receive generated reports (`os/v4450-owner-report.js`) | `HANDOFF_CASE_OS.md` | `§35`: client portal with client login, comments, approved plans |
| No visibility levels on objects/fields | `os/core.js` | `§6.8`: Internal / Client-visible / Restricted / Public on every sensitive object |
| `core.js` is 4153 lines / ~976 KB of production code, deployed by manual zip upload | `HANDOFF_CASE_OS.md` | Refactoring in place puts the live platform at risk |
| CASE OS floor plans bind SVG through text labels (`parsePlanLabels`, `bindSvgPlan`); bundled `os/zarafshan-l2.svg` has no unit polygons with ids | `os/core.js` lines 2316, 2548 | `§13`, `§69`: the floor plan must contain real clickable unit polygons |

### 2.4 Alternatives considered

| Option | Description | Assessment | Status |
|---|---|---|---|
| **A. New module `os/leasing/`** (D1) | Clean model, no backend, ships in the `os/` zip, opens from disk; import adapter bridges CASE OS data | Lowest risk to production; matches `§62` (small clean file structure, no build); testable by the team on hosting and locally | **Recommended** |
| B. Extend CASE OS in place | Add companies/contacts/visibility/multi-unit deals to `core.js` and MySQL | Requires backend and schema changes forbidden by `§1`; touches 976 KB of live code; `units.status` split would need a data migration on production | Rejected for v0.1 |
| C. Prototype outside `os/` (e.g. `docs/standalone/`) | Same code, never deployed to hosting | Zero deployment risk; but the team then tests only from local files, and the CASE OS CSP compatibility is not exercised | Deferred; founder to weigh (Q-01-1) |

### 2.5 Bridge to "one source of truth"

FACT (`§3.1`): important data must not live in Excel files, chats, notebooks, isolated computers, separate floor plans or unconnected CRM lists. DECISION D1/D9: v0.1 ships an **import adapter** for `CASE_OS_backup_YYYY-MM-DD.json` (the `exportAllJSON()` state blob, `os/core.js` line 946) so the team can load real project structures locally:

| CASE OS source | LSP target | Rule |
|---|---|---|
| `OBJECTS` | `projects` (+ `externalIds.caseOsObjectId`) | one-to-one |
| `U` (units) | `units`, with `buildings` / `floors` derived from `floor`, `merged`, block prefix of `code` | `externalIds.caseOsUnitCode` = `code` |
| `STAT` value | `unit.commercialStatus` + one open deal where the CASE OS value is a deal stage | split rule in `03_DATA_MODEL.md` and `05_STATUSES_STAGES_AND_CONFIG.md` |
| `BRANDS` | `brands`; `companies` derived from `group` | CASECATS → merchandise categories via editable mapping (D15) |
| `DOC_CONTACTS` | `contacts` | |
| `PLANSVG` | `floorPlans` | text-label binding, marked experimental (`§6.7`) |

The fold-back path for the production phase (MySQL schema deltas, API endpoints, or PostgreSQL per `§57`) is documented in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`; details of the adapter in `08_PERSISTENCE_IMPORT_EXPORT.md`.

---

## 3. Users and roles (summary)

FACT (`§31`, `§32`): a prototype role system with real UI differences; demo users for founder/admin, head of leasing, leasing manager, administrator and at least two client users. DECISION D7 defines the LSP role keys and their mapping to CASE OS `ROLES` keys (`os/core.js` line 295). Full capability matrix, visibility levels and portal rules: `04_ROLES_AND_VISIBILITY.md`.

| LSP role key | Name (`§31`) | CASE OS key | Primary daily use in LSP | Demo user in v0.1 |
|---|---|---|---|---|
| `founder_admin` | Founder / Curator / Super Admin | ASH, ADM | All projects, all CRM, commissions, Settings, portal preview, prototype users | Yes (Founder/Admin) |
| `head_ls` | Head of Leasing & Sales | BA | Projects, teams, pipelines, assignments, reports, brands, owner reporting, permitted commissions | Yes |
| `manager` | Leasing / Sales Manager | AG | Assigned projects and units, leads, brands, activities, deal stages, notes, documents, tasks, next actions | Yes (Leasing Manager; Sales Manager optional, Q-01-3) |
| `administrator` | Leasing Administrator / CRM Coordinator | HO | CRM and project/unit data maintenance, documents, report preparation, completeness checks | Yes |
| `external_agent` | External Agent / Referral Partner | AGX | Future limited role: selected availability, assigned leads, assigned project information | No demo user; role defined in config only (Q-01-6) |
| `client` | Client / Property Owner | (none in CASE OS) | Assigned projects only: dashboard, approved plans/statuses/mix, approved documents and reports, comments | Yes, two client users |

Visibility levels on objects and fields (`§6.8`, D7): `internal`, `client_visible`, `restricted`, `public`. Client sessions are filtered by `clientId` → assigned projects → object visibility → field whitelist; the portal renders only from the `clientView(projectId)` service output. Commissions, internal notes, proposed/negotiated terms, internal contacts and staff performance never reach portal renderers (`§3.4`, `§35`, `§38`).

---

## 4. The connected operating model and product principles

### 4.1 Hierarchy and entities

FACT (`§3.2`, `§7`, `§68`): the core hierarchy and the commercial relationship chain are

```text
Client -> Project -> Site / Complex -> Building / Block -> Floor -> Unit
  -> Brand / Buyer -> Requirement -> Deal -> Activity -> Contract -> Commission / Result
```

Minimum hierarchy: `Client -> Project -> Building -> Floor -> Unit`. Commercial relationship: `Brand / Buyer -> Requirement -> Opportunity / Deal -> Unit(s)` (`§7`, `§21`). The `appState` collections (`§8`) and their ID prefixes (D13):

| Collection | ID prefix | Collection | ID prefix |
|---|---|---|---|
| `users` | (prototype users, see `03_DATA_MODEL.md`) | `requirements` | `REQ-001` |
| `clients` | (see `03_DATA_MODEL.md`) | `deals` | `DEAL-001` |
| `projects` | `PROJ-001` | `tasks` | `TASK-001` |
| `sites` | `SITE-001` | `activities` | `ACT-001` |
| `buildings` | `BLDG-001` | `comments` | `CMT-001` |
| `floors` | `FLOOR-001` | `documents` | `DOC-001` |
| `floorPlans` | `PLAN-001` | `reports` | `RPT-001` |
| `units` | `UNIT-001` | `statusHistory` | `SH-001` |
| `brands` | `BRAND-001` | `auditLog` | `AUD-001` |
| `companies` | `COMP-001` | `settings` | (single object) |
| `contacts` | `CONT-001` | `session` | (not persisted in the data key) |

Every project, building and unit carries `externalIds: {caseOsObjectId, caseOsUnitCode, propertyId, geoMasterId}` for the ecosystem (`§49`, D13).

### 4.2 Product principles as testable statements

Each principle from `00_MASTER_PROMPT.md §3` and the corrections in `§6` is restated as a statement that a test in `10_QA_PLAN.md` can pass or fail.

| ID | Principle (source) | Testable statement |
|---|---|---|
| P-1 | One source of truth (`§3.1`, `§8`, `§25`) | Every view renders from `appState`; no view keeps a second copy of business data. Changing a record through any screen changes what every other screen shows on its next render, without reload. |
| P-2 | Connect the business to the building (`§3.2`, `§15`) | Clicking a mapped polygon on 5 Interactive Floor Plan opens the unit drawer showing unit number, area, status, target category, actual category, brand/tenant, deal stage, responsible manager, commercial terms, next action, comments, documents and activity history for that unit. |
| P-3 | Visual management (`§3.3`, `§14`) | Every floor-plan mode has its own legend, text labels, tooltips and a non-color indicator (pattern/outline). The plan and the units table show the same state for every unit at all times. |
| P-4 | Internal and client views are different (`§3.4`, `§35`, `§38`) | The portal DOM never contains commissions, internal notes, proposed/negotiated terms, internal contacts, staff performance or records of other clients/projects. The internal unit drawer and the client unit drawer are different components. |
| P-5 | No hidden state (`§3.5`, `§54`) | Every unit status change writes a `statusHistory` record and an `auditLog` record; floor plan, units table, CRM, dashboard, reports and (where `client_visible`) portal reflect it immediately. |
| P-6 | Future expansion (`§3.6`, `§49`, `§50`) | IDs are stable strings; `externalIds` exist on project/building/unit; no module needed for AM/FM/Building OS is blocked by the schema (verified by review, not by a runtime test). |
| P-7 | Unit status ≠ deal stage (`§6.3`, `§12`, D5) | `unit.commercialStatus` holds only inventory states; deal stages are stored only on `deals`; the stage shown on a unit is derived from its open deals and is never written to the unit. |
| P-8 | Unit area counted once (`§6.4`, `§6.5`, `§34`, D6) | Inventory KPIs place each unit's `glaM2` in exactly one bucket. A unit with three prospects adds its area once to inventory; a deal with two units reports `dealArea` = sum of both units' GLA without changing inventory totals. |
| P-9 | Unknown is never zero (`§69`, D6) | A unit without area is excluded from sums and counted in an "n units without area" note; KPI cards show "n/a" when inputs are missing; denominators are shown next to percentages. |
| P-10 | No fake buttons (`§63`, `§69`) | Every navigation destination and every action button either works or is visibly labeled "future" and disabled. |
| P-11 | Configuration-driven (`§12`, `§44`, D5) | Statuses, stages, colors, categories, lost reasons, client mappings, stale thresholds and commission rules are read from `settings` (seeded by `js/config.js`); rendering code contains no business constant. |
| P-12 | Prototype honesty (`§6.1`, `§6.2`, `§6.7`, `§55`) | The login screen shows "Prototype authentication only. This does not provide production security."; documents are metadata + local URLs; any text-label plan matching is labeled experimental; no OCR/CV/CAD recognition is claimed. |

---

## 5. Scope: MVP items → screens → implementation phases

### 5.1 Phase names used across the plan

Phase numbering follows D2 and `09_IMPLEMENTATION_PLAN.md`; the definition of done for each phase is in that document.

| Phase | Name | Delivers |
|---|---|---|
| Phase 0 | Skeleton, state, config, demo, login | `index.html`, `css/lsp.css`, `js/state.js`, `js/config.js`, `data/demo.js`, `data/i18n.js`, login and session, role badge, save indicator |
| Phase 1 | Projects, buildings, floors, units | Project list/dashboard shell, structure editing, units table, unit drawer (non-plan), validation, `statusHistory` |
| Phase 2 | Floor plan engine | `js/floorplan.js`: polygons, modes, legends, tooltips, pan/zoom, mapping wizard, mobile fallback |
| Phase 3 | CRM | Brands, companies, contacts, requirements, duplicate warnings, matching |
| Phase 4 | Pipelines | Leasing and sales deals, Kanban/table/plan views, stage rules, lost reasons, commission block |
| Phase 5 | Tasks, activities, comments, documents, notifications | Tasks, activity timelines, internal notes, comments (Open/In Review/Resolved), document registry, notification list |
| Phase 6 | Dashboard, KPI, merchandise mix | Internal home dashboard, project dashboard, KPI services, merchandise-mix analytics, completeness and stale indicators |
| Phase 7 | Client portal | Client login path, client dashboard, client floor plan, client drawer, comments |
| Phase 8 | Reports, print | Client and internal report builders, changes since previous report, print stylesheet |
| Phase 9 | Persistence hardening, import/export, CASE OS adapter | Backup slot, migrations, recovery screen, JSON/CSV export, JSON/CSV import with preview, CASE OS backup adapter |
| Phase 10 | Settings UI | Editable statuses, stages, colors, categories, lost reasons, client mappings, thresholds, commission rules, currencies, notification rules, prototype users |
| Phase 11 | Search, AI registry, responsive polish | Global search, `js/tools.js` registry with permission checks, responsive/print polish, optional "Ask" palette |
| Phase 12 | QA and deliverables | Playwright-core and Node tests, QA report, README, as-built documentation updates |

### 5.2 The 35 MVP items (`00_MASTER_PROMPT.md §5`)

Screens are numbered as in `§63`. "Unit drawer" is the `§15` component hosted by screens 5 and 6.

| # | MVP item (`§5`) | Screen(s) (`§63`) | Phase | Notes / rule |
|---|---|---|---|---|
| 1 | Prototype login and session handling | 1 Login | Phase 0 | Enter submits; session in `caseos-lsp-session`; logout; warning text (`§32`, P-12) |
| 2 | Role simulation | 1 Login; all screens | Phase 0 (internal), Phase 7 (client) | Role badge; navigation and actions gated by role (`§31`, D7) |
| 3 | Internal dashboard | 2 Internal Home Dashboard | Phase 6 | Portfolio KPIs, today's work, pipeline snapshot, data hygiene (`§33`) |
| 4 | Project database | 3 Projects List; 4 Project Dashboard | Phase 1 | Schema `§9`; GLA/GBA only, no NLA/GFA |
| 5 | Building/block database | 4 Project Dashboard (structure); 5 selectors | Phase 1 | Schema `§10` |
| 6 | Floor database | 4 Project Dashboard (structure); 5 selectors | Phase 1 | Schema `§10` |
| 7 | Unit database | 6 Units Table; unit drawer | Phase 1 | Schema `§11`; unique `id` and unique `unitNumber` per project |
| 8 | Interactive floor plans | 5 Interactive Floor Plan | Phase 2 | Real clickable polygons; ≥2 demo SVG floors (`§13`, D8) |
| 9 | Unit status visualization | 5 (modes Leasing/Sales status, Availability) | Phase 2 | Colors from config; display status derived per D5 (`§14.1`, `§14.5`) |
| 10 | Merchandise-mix visualization | 5 (mode Merchandise mix) | Phase 2 | Category/subcategory colors from config (`§14.2`) |
| 11 | Target-versus-actual merchandise mix | 5 (mode Target vs Actual); 4 Project Dashboard | Phase 2 (mode), Phase 6 (analytics) | Gaps by GLA and by unit count (`§14.3`, `§17`) |
| 12 | Brand database | 10 Brand Database; 11 Brand Detail | Phase 3 | Schema `§18`; multiple contacts per brand |
| 13 | Company database | 12 Companies | Phase 3 | One company → many brands; no duplicate company per brand (`§19`) |
| 14 | Contact database | 13 Contacts | Phase 3 | Central; one contact ↔ many brands, one company, many deals/projects (`§20`) |
| 15 | Requirement records | 14 Requirements; 11 Brand Detail | Phase 3 | `Brand -> Requirement -> Deal -> Unit(s)` (`§21`) |
| 16 | Leasing pipeline | 7 Leasing Pipeline; 9 Deal Detail | Phase 4 | 16 configurable stages; Closed Lost requires reason (`§22`) |
| 17 | Sales pipeline | 8 Sales Pipeline; 9 Deal Detail | Phase 4 | Separate 16 stages; sales fields only on sales deals (`§23`) |
| 18 | Tasks and activities | 15 Tasks; 16 Activities | Phase 5 | Overdue / today / next 7 days / no next action views (`§27`, `§28`) |
| 19 | Activity timelines | 16 Activities; unit drawer; 9, 11 detail views | Phase 5 | Timelines for brands, companies, contacts, projects, units, deals (`§28`) |
| 20 | Documents/file registry | 18 Documents; unit drawer | Phase 5 | Metadata + local URL only; 13 document types; visibility (`§30`) |
| 21 | Internal notes | 4, 9, 11, unit drawer (notes panels) | Phase 5 | Visibility `internal`; never in `clientView` (`§29`) |
| 22 | Client-visible comments | 19, 20 (client side); 16, notifications (internal side) | Phase 5 (data, internal UI), Phase 7 (portal UI) | Author, timestamp, related object, visibility, status Open / In Review / Resolved (`§29`) |
| 23 | Client/owner portal | 19 Client Portal Dashboard; 20 Client Floor Plan | Phase 7 | Filtered by client ID, assigned projects, object and field visibility (`§35`) |
| 24 | Project dashboard | 4 Project Dashboard | Phase 6 | Project KPIs with denominators, mix, pipeline, documents, team (`§33`, `§34`) |
| 25 | Owner reporting | 17 Reports | Phase 8 | Client report content list `§37`; exclusions enforced by `clientView` |
| 26 | Print/PDF report workflow | 17 Reports | Phase 8 | Print stylesheet; browser Save as PDF; no clipping (`§37`, `§65`) |
| 27 | Import/export | 22 Import / Export | Phase 9 | JSON full backup, CSV per table, validated import with preview, CASE OS adapter (`§42`, D9) |
| 28 | LocalStorage persistence | header save indicator; 22 (reset/backup) | Phase 0 (basic), Phase 9 (backup slot, migrations, recovery) | Keys per D9; Saving / Saved / Unsaved; beforeunload guard (`§46`) |
| 29 | Data validation | all create/edit forms; 22 import preview | Phase 1 (project/unit), Phase 3 (CRM), Phase 4 (deal), Phase 9 (import) | Field-level messages; invalid import never replaces state (`§42`) |
| 30 | Duplicate warnings | 10, 12, 13 create forms; 2 data hygiene | Phase 3 | Name/phone/email similarity warnings, non-blocking (`§33`, `§65`) |
| 31 | Data completeness indicators | 6, 9, 11, unit drawer; 2 data hygiene | Phase 6 | Brand / unit / deal completeness per `§40` |
| 32 | Stale-data indicators | 2, 7, 8, 9, 11 | Phase 6 (indicators), Phase 10 (thresholds editable) | Rules and thresholds from `settings` (`§41`) |
| 33 | Future Geoanalytics integration model | project/unit `externalIds` fields (3, 4, 6) | Phase 1 (fields), Phase 11 (documentation) | No exchange in v0.1 (`§49`) |
| 34 | Future AI tool architecture | none (no screen); optional "Ask" palette | Phase 11 | `js/tools.js` registry over `js/services.js` with permission checks (`§52`, `§53`, D12) |
| 35 | Future Asset / FM / Building OS architecture | none (documentation) | Phase 11–12 | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (`§50`) |

All 22 screens of `§63` are covered by the table above; Settings (21) is Phase 10, Import / Export (22) is Phase 9.

---

## 6. Out of scope / future

Rule (`§63`, P-10): **no empty navigation destinations.** Anything in this table either has no navigation entry at all, or appears as a disabled item labeled "future" that opens nothing.

| Item | Source | Treatment in v0.1 |
|---|---|---|
| Asset Management: lease administration, rent roll, payments, arrears, NOI, budgets, CAPEX, forecasts, renewals | `§3.6`, `§50` | Not implemented; no navigation entry; extension points in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Facility Management: work orders, equipment, inspections, helpdesk, vendors, SLAs, incidents | `§3.6`, `§50` | Not implemented; no navigation entry |
| Building OS: technical systems, energy, digital twin | `§3.6`, `§50` | Not implemented; floor-plan layer designed to be reused |
| Geoanalytics data exchange (either direction), MapLibre/Leaflet maps | `§49`, `§57` | Only stable IDs and coordinates stored; no maps, no exchange |
| Automatic floor-plan recognition: OCR, CV, CAD/DWG, BIM/IFC, PDF detection | `§6.7`, `§16` | Not claimed; wizard accepts SVG/JSON polygons and manual mapping; text-label matching only as labeled experiment |
| Production authentication, server-side authorization, secure file storage, encryption, backups, secure APIs | `§1`, `§6.1`, `§6.2`, `§55` | Not implemented; warning text on login; documented in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| Production AI backend, LLM calls, any AI framework | `§51`, `§58` | Not implemented; only the deterministic tool registry (`§52`) |
| Future roles: Asset Manager, Facility Manager, Technical Manager, Property Manager, Finance, Owner Representative, Tenant Portal User, Field Inspector | `§31` | Not defined in config; listed as future in `04_ROLES_AND_VISIBILITY.md` |
| External Agent / Referral Partner as a usable login | `§31` | Role key `external_agent` exists in config; no demo user, no screens (Q-01-6) |
| Historical reporting beyond "changes since previous report" | `§3.6`, `§37` | Only report snapshots in `reports` and `statusHistory`; no time-series analytics |
| IndexedDB file storage | `§6.2`, `§46`, D9 | Not used; localStorage only with a 4 MB quota warning |
| Multi-user concurrency, shared server state | consequence of `§1` | Each browser holds its own state; teams exchange data through JSON export/import |
| CASE OS navigation entry, `APP_VERSION` bump, `sw.js` change, PHP/MySQL changes | D1, D11 | Not part of v0.1 |
| Uzbek UI dictionary | A-1 | EN and RU only in v0.1 |
| CSV import for deals, tasks, activities, comments, documents | `§42` ("where practical"), D9 | CSV import limited to brands, companies, contacts, units; CSV export for all major tables |
| Chart.js or any charting library | `§57`, D14 | Charts are inline SVG generated by code |
| Payments, invoicing, accounting | `§1` | Only commission status fields on deals (`§38`) |

---

## 7. Questions the platform must answer (`§2`) and where they are answered

| # | Question (`§2`) | Answered by (screen / feature) | Service (`js/services.js`, `§52`) |
|---|---|---|---|
| 1 | What projects are currently being leased or sold? | 3 Projects List (status, mandate type filters); 2 dashboard KPI "active projects" | `searchProjects`, `getProject` |
| 2 | Which units are vacant? | 6 Units Table filter on `commercialStatus`; 5 Availability mode; KPI "vacant GLA" | `filterUnits`, `calculateVacantGLA` |
| 3 | Which units are under negotiation? | 5 status mode (derived display status); 6 derived-stage column; KPI "GLA in negotiation" | `filterUnits`, `calculatePipelineGLA` |
| 4 | Which units are leased? | 6 filter (Contract Signed / Fit-out / Occupied); 5 status mode; KPI "leased GLA" | `calculateLeasedGLA` |
| 5 | Which units are sold? | 6 filter Sold; 5 status mode; project dashboard sales progress | `filterUnits` |
| 6 | Which brands are being negotiated for each unit? | Unit drawer "Deal" section listing all open deals (prospects); 7 Leasing Pipeline filtered by unit | `getUnit`, `getDealsByStage` |
| 7 | Which managers are responsible? | 5 Manager mode; 6 responsible column; 9 Deal Detail ownership; project team on 4 | `getUnit`, `getDeal` |
| 8 | What is the next action? | 9 Deal Detail `nextAction`; unit drawer; 2 "Today's work" | `getDeal`, `getDealsWithoutNextAction` |
| 9 | Which follow-ups are overdue? | 2 dashboard "overdue"; 15 Tasks overdue view; notifications | `getOverdueTasks` |
| 10 | Which brands match available units? | Unit drawer "Suggested brands"; 11 Brand Detail "Suggested units", with criteria explained (`§39`) | `suggestBrandsForUnit`, `suggestUnitsForBrand` |
| 11 | What is the current merchandise mix? | 5 Merchandise mix mode; 4 Project Dashboard mix table/chart (GLA and unit count) | `aggregateMerchandiseMix` |
| 12 | How does actual tenant mix compare with target? | 5 Target vs Actual mode; 4 gap table (over/under-represented) | `aggregateMerchandiseMix` |
| 13 | What percentage of GLA is leased? | 2, 4, 19 KPI cards with denominator shown | `calculateLeasedGLA` |
| 14 | What percentage is in active negotiation? | 2, 4, 19 KPI cards with denominator shown | `calculatePipelineGLA` |
| 15 | What is the leasing and sales pipeline by area and value? | 7 and 8 stage totals (deal-based, labeled); 2 pipeline snapshot; 17 internal reports | `calculatePipelineGLA`, `calculatePipelineValue` |
| 16 | Which contracts are signed? | 7/8 stage Contract Signed and later; 6 status Contract Signed; 17 "signed deals" | `getDealsByStage` |
| 17 | Which commissions are pending or received? | 9 Deal Detail commission block (`restricted`); 7/8 filter; 17 internal reports | `getDealsByStage` + commission filter |
| 18 | What should be reported to the owner? | 17 Reports → client report; 19 Client Portal Dashboard | `generateOwnerReport` |
| 19 | What changed since the previous report? | 17 "changes since previous report" (from `statusHistory` and `auditLog` since the previous `reports` record); 19 "recent changes" | `getProjectChanges` |
| 20 | Which client comments require a response? | 2 KPI and notifications; 16 Activities filter; comments with status Open | `getDataCompleteness` (hygiene block), comment queries |
| 21 | Which files belong to the project? | 18 Documents filtered by project; 4 Project Dashboard documents tab | `getVisibleDocuments` |
| 22 | Which floor-plan units require attention? | 5 attention overlay (unmapped polygons, units without polygon, missing area/category, stale); 2 data hygiene | `getDataCompleteness` |

---

## 8. Non-functional requirements

| ID | Requirement | Source | Acceptance |
|---|---|---|---|
| NFR-1 | Opens from disk: double-clicking `os/leasing/index.html` (`file://`) runs the full application | `§62`, D1, D2 | All local assets load through `<script src>`; the app never `fetch()`es local files; demo SVG plans are embedded as JS strings |
| NFR-2 | No build step, no package manager, no transpiler | `§62`, D2 | Plain ES2019+ files under `os/leasing/js/`; the README startup instruction is "open index.html" |
| NFR-3 | No backend: no XHR/fetch to any server; no PHP touched | `§1`, D1 | Static-server QA with 404 on `/api/*` passes; no request to `/api/` is made |
| NFR-4 | Local persistence in `localStorage` keys `caseos-lsp-state-v1`, `caseos-lsp-backup-v1`, `caseos-lsp-session`, `caseos-lsp-ui`; `meta.schemaVersion`; migrations; debounced save with Saving / Saved / Unsaved indicator; beforeunload guard; recovery screen on corrupted JSON | `§46`, D9 | `§64` Flow 12 and `§65` persistence checks; corrupted data never yields a blank app |
| NFR-5 | Runs under the CASE OS CSP in `os/.htaccess` (line 32): scripts from `'self'` (inline allowed), styles from `'self'` and `fonts.googleapis.com`, fonts from `fonts.gstatic.com`, images `data:`/`blob:` | context brief, `os/.htaccess` | No CSP violation in the console when served from `/os/leasing/`; no `eval`; no CDN scripts |
| NFR-6 | Runs inside the CASE OS service-worker scope `/os/` without registering its own service worker; offline use of LSP is not a v0.1 goal | `os/sw.js` (network-first, `cache:'no-store'`; offline navigation fallback is CASE OS `index.html`) | LSP files are always fetched fresh while online; README states that offline mode is unsupported |
| NFR-7 | No external runtime dependency; Montserrat via Google Fonts is optional with system fallback | D14, `§62` | Application renders correctly with fonts blocked |
| NFR-8 | Viewports: 1920×1080, 1440×900, 1366×768, 1024×768, tablet 820×1180, mobile 390×844; on narrow screens the floor plan is replaced by unit list + drawer; mobile supports quick lookup, comments, tasks and deal updates | `§48`, D8, D10 | `§65` responsive checks: navigation usable, drawers fit, tables do not break layout, no clipped text |
| NFR-9 | Print: dedicated print stylesheet; reports print without clipping; browser Save as PDF produces the report | `§37`, `§65` | `§64` Flow 11 step 4 |
| NFR-10 | i18n: every UI string through `t(key)`; dictionaries EN (base) and RU; default EN; header toggle persisted in `caseos-lsp-ui` | A-1, D3 | No hard-coded UI string in views; switching language re-renders without reload |
| NFR-11 | Accessibility basics: Enter submits login; Esc closes drawer/modal; visible focus; icon buttons have text labels or `aria-label`; floor-plan modes have non-color indicators; contrast of badges and plan labels readable in light and dark themes | `§14`, `§32`, `§48` | Manual check per `10_QA_PLAN.md`; automated check that every mode legend has a pattern/outline entry |
| NFR-12 | Light and dark theme through CSS variables; floor-plan colors remain readable in both; no gradients/glassmorphism; charts as inline SVG | `§48`, D14 | Screenshot sweep in both themes |
| NFR-13 | Performance on the demo dataset: first render ≤ 1 s on a 1366×768 laptop; floor plan with ≤ 200 polygons switches mode without visible lag; state save debounced (~500 ms) | RECOMMENDATION | Measured in the QA sweep; not a hard gate |
| NFR-14 | Browsers: current Chrome/Edge/Firefox/Safari (desktop and iOS); automated QA on Chromium only | A-01-4, D10 | Playwright-core run on the bundled Chromium |
| NFR-15 | Security and privacy honesty: no secrets, passwords, tokens or real client data in the repository; prototype warning visible; no production security claim anywhere in UI or docs | `§6.1`, `§55` | `§65` technical review; grep for secrets in the release zip |
| NFR-16 | Auditability: important changes (status, stage, assignment, visibility, import, reset, export) write `auditLog`; status changes write `statusHistory` | `§54`, D9 | `§65` "status history is created", "stage history is recorded" |
| NFR-17 | Code structure per D2; pure business logic in `js/services.js` with no DOM access, loadable in Node (`module.exports`) and in browsers (`window.LSP`) | D2, D10 | Node unit tests load `js/config.js` and `js/services.js` directly |
| NFR-18 | Versioning: `LSP_VERSION` in `os/leasing/index.html`; CASE OS `APP_VERSION`, `core.js`, `sw.js` untouched; `demoRecord: true` on every demo record; a visible "DEMO DATA" banner while demo data is loaded | D11, A-2, `§47` | Release checklist in `09_IMPLEMENTATION_PLAN.md` |

---

## 9. Acceptance criteria for "MVP complete"

### 9.1 Definition

The MVP is complete when (1) all twelve user flows of `00_MASTER_PROMPT.md §64` pass end-to-end on the demo dataset, (2) every check of `§65` passes or is recorded as a known limitation with the founder's acceptance, (3) the deliverables A–H of section 10 exist at the stated locations, and (4) the final QA report has been produced. `10_QA_PLAN.md` assigns concrete test names (`docs/qa/tools/lsp_*.js`, results in `docs/qa/lsp/*.json`); this document references flows by `§64` number and checks by `§65` group heading.

### 9.2 Required user flows (`§64`)

| Flow | Name | Screens exercised | Available after | Key assertion |
|---|---|---|---|---|
| 1 | Internal login | 1, 2 | Phase 0 | Enter submits; role badge and role-specific navigation |
| 2 | Open project | 3, 4, 5 | Phase 2 | KPIs render with denominators; floor switch shows another plan |
| 3 | Unit management | 5, unit drawer, 2 | Phase 6 | Status change, brand assignment, note, task; plan color and dashboard update; `statusHistory` row |
| 4 | Merchandise mix | 5 | Phase 2 (mode), Phase 6 (gap figures) | Category colors from config; Target vs Actual shows deviations |
| 5 | Brand CRM | 10, 11, 13, 14, 9 | Phase 4 | Search, profile, contacts, requirement, opportunity linked to project/unit, follow-up task |
| 6 | Leasing deal | 7, 9, 16, 18 | Phase 5 | Stage moves recorded; terms, activity, document; Contract Signed → Commission Pending → Commission Received |
| 7 | Multiple prospects | unit drawer, 7, 2/4 | Phase 6 | Three open deals on one unit; inventory GLA counts the unit once (P-8) |
| 8 | Multi-unit deal | 7 or 8, 9 | Phase 4 | `dealArea` = Σ GLA of distinct linked units; inventory unchanged |
| 9 | Client login | 1, 19, 20, 17, 18 | Phase 8 | Only assigned projects; client dashboard; client drawer; comment; print report; approved file only |
| 10 | Client comment | 20, notifications, 16 | Phase 7 | Comment appears internally; response; status Resolved |
| 11 | Reporting | 17 | Phase 8 | Current data; internal fields absent from client report; print view |
| 12 | Persistence | header indicator, 22 | Phase 9 | Refresh preserves; export JSON; reset demo; import JSON restores |

### 9.3 Check groups (`§65`)

| `§65` group | Number of checks | Primary owner phase | Verified by |
|---|---|---|---|
| Application checks | 9 | Phase 12 | All-views sweep (JS errors, blank screens, fake buttons, broken navigation, overlaps, duplicated handlers, invalid links, clipping) |
| Login and roles | 9 | Phase 0, 7 | Role-access test: client cannot see internal notes, commissions, other clients/projects; warning visible |
| Projects and units | 8 | Phase 1 | Create/edit, linkage, unique IDs, area validation, status history, totals, persistence |
| Floor plans | 13 | Phase 2 | Load, click, hover, modes, legends, floor switch, zoom/pan, color sync, plan = table, single click handler |
| CRM | 11 | Phase 3, 4 | Search, create/edit, companies ≠ brands, multi-brand contacts, duplicate warnings, requirements, opportunities, multi-unit, multi-prospect, next actions, timelines |
| Pipelines | 8 | Phase 4 | Both pipelines, Kanban ↔ table ↔ plan sync, configurable stages, required lost reason, stage history, filters |
| Calculations | 11 | Phase 6 | Node tests on `js/services.js` with worked examples from `07_CALCULATIONS_AND_KPI_RULES.md` |
| Tasks and activities | 8 | Phase 5 | Create, assign, due dates, overdue, complete, reschedule, dashboard update, timelines |
| Documents | 6 | Phase 5, 7 | Demo files, metadata, visibility, portal inclusion/exclusion, registration |
| Client portal | 8 | Phase 7 | Assigned projects only, simplified dashboard, plan, approved data, comments both ways, reports, downloads |
| Reports | 8 | Phase 8 | Internal and client reports, current data, changes since previous, exclusions, print, no clipping, Save as PDF |
| Persistence and import/export | 9 | Phase 9 | Persistence, refresh, reset, JSON/CSV, safe rejection of invalid import, corrupted data recovery, backup/restore |
| Responsive testing | 6 viewports × 6 confirmations | Phase 11 | Screenshot sweep at the NFR-8 viewports |
| Technical review | 11 | Phase 12 | No secrets, no security claims, no backend required, libraries documented, modules understandable, rules not duplicated, colors configurable, visibility explicit, stable IDs, Geoanalytics and Building OS extension points |

### 9.4 Exit checklist

- [ ] Flows 1–12 pass in the Playwright-core run and are recorded in `docs/qa/lsp/`.
- [ ] Every `§65` check has a PASS, or a FAIL with a listed known limitation accepted by the founder.
- [ ] Pure-logic tests for P-7, P-8 and P-9 pass in Node against `js/services.js`.
- [ ] No console errors on any screen for every demo role (internal and client) at 1366×768 and 390×844.
- [ ] `grep` of the release zip finds no secrets, no model identifiers, no real client names in demo data.
- [ ] `LSP_VERSION` set; CASE OS `APP_VERSION`, `core.js`, `sw.js`, `index.html` unchanged (diff empty).
- [ ] Deliverables A–H present at the locations in section 10.

---

## 10. Deliverables (`§66` A–H) and where each will live

| Deliverable (`§66`) | Content | Location | Produced in |
|---|---|---|---|
| A. Working HTML prototype | The application | `os/leasing/` (`index.html`, `css/`, `js/`, `data/`, `README.md`) | Phases 0–11 |
| B. Product summary | What is implemented and how the workflow operates | `os/leasing/README.md` (EN with short RU summary) and the as-built revision of this `01_PRODUCT_SPEC.md`; index in `docs/leasing-platform/README.md` | Phase 12 |
| C. Data model documentation | Entities, IDs, relationships, important fields, CASE OS mapping | `03_DATA_MODEL.md` (updated as-built) | Planning; revised Phase 12 |
| D. Role matrix | What each role can see and do; visibility levels; portal rules | `04_ROLES_AND_VISIBILITY.md` | Planning; revised Phase 12 |
| E. Configuration documentation | Statuses, stages, categories, colors, visibility, rules; `js/config.js` is the executable source | `05_STATUSES_STAGES_AND_CONFIG.md` | Planning; revised Phase 10 |
| F. Known limitations | Prototype limitations, unavailable features, known bugs, future functionality — separated | Section "Limitations" of `os/leasing/README.md`; full list in the QA report (H) | Phase 12 |
| G. Future production architecture | Migration to frontend/backend, PostgreSQL, PostGIS, secure storage, authentication, RBAC, client segregation, APIs, Geoanalytics, AI, AM/FM/Building OS | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` | Planning; revised Phase 12 |
| H. QA report | Tested workflows, remaining issues, implemented / partial / simulated features, data, security and AI limitations, next improvements | `docs/qa/lsp/` (JSON results per tool) plus a summary Markdown report whose exact file name is set in `10_QA_PLAN.md` | Phase 12 |

Supporting planning artifacts (not `§66` deliverables but required by `§69` and `§61`): `02_REQUIREMENTS_REVIEW.md`, `06_FLOORPLAN_ARCHITECTURE.md`, `07_CALCULATIONS_AND_KPI_RULES.md`, `08_PERSISTENCE_IMPORT_EXPORT.md`, `09_IMPLEMENTATION_PLAN.md`, `10_QA_PLAN.md`, `11_REPOSITORY_AUDIT.md`, and the 21 skills under `.claude/skills/` (`§56`).

---

## 11. Glossary

Terms are used with these meanings in every LSP document and in the UI dictionaries (`data/i18n.js`).

| Term | Meaning in LSP |
|---|---|
| GLA (Gross Leasable Area) | Area that can be leased or sold to occupiers, in m². Stored per unit as `area.glaM2`; project GLA for KPIs is the sum of unit GLA (the project-level `areas.glaM2` is shown separately as "declared GLA" and never substituted). `§9`: use GLA and GBA consistently; no NLA/GFA. |
| GBA (Gross Building Area) | Total constructed area of the building/project in m² (`areas.gbaM2`); informational, not used in leasing KPIs. |
| LOI (Letter of Intent) | Non-binding commercial terms agreed before a contract; leasing stage "LOI / Commercial Terms" and document type "LOI". |
| LCR | CASE OS term ("Leasing Control Register"): the unit registry `U` from which CASE OS generates its register from an immutable layout snapshot (`os/v417-master-plan.js`). LSP's equivalent is the `units` collection plus `statusHistory`; the term is used only when referring to CASE OS. |
| Tenant mix | The set of tenants (brands) actually occupying or contracted in a project; in LSP the **actual** merchandise mix by `actualUse.category`. |
| Merchandise mix | Distribution of GLA and unit count across merchandise categories/subcategories; **target** (planned, `targetUse`) versus **actual** (`actualUse`), compared by GLA and by unit count (`§17`). |
| Anchor | A large-format tenant (for example an anchor supermarket, cinema or department store) that drives footfall; a `targetUse.merchandiseRole` value on units (`§11`); on the brand side described by `classification.format` / `brandType` (`§18`). |
| Inline | A standard small or medium retail unit that is not an anchor; a `targetUse.merchandiseRole` value. |
| Turnover rent | Rent component calculated as a percentage of the tenant's sales turnover, usually in addition to or as a top-up over base rent; field `turnoverRent` on unit leasing terms and deal commercial terms. |
| Service charge | The occupier's contribution to common-area operating costs, quoted per m² per month; field `serviceCharge`. |
| Rent-free | Period at lease start during which no base rent is payable, typically covering fit-out; field `rentFreePeriod`. |
| Fit-out | Works by which the tenant prepares the shell unit for trading; `fitOutPeriod` on terms, `Fit-out` as a unit inventory status between Contract Signed and Occupied. |
| Mandate | The owner's instruction to CASE Advisory to lease and/or sell a project: `leasingMandateType`, `salesMandateType`, `mandateMode` (for example Exclusive), start and expiry dates (`§9`). |
| Commission | CASE Advisory's fee for a concluded lease or sale: gross amount, invoice and payment dates, received amount, status, internal shares (`§38`). Visibility `restricted`; never in client views. Commission receipt as a completion condition is configurable (`§6.6`). |
| Pipeline vs inventory | **Inventory** is unit-centric: every unit's GLA counted exactly once in one bucket (Leased / Sold / Under negotiation / Available / Unavailable). **Pipeline** is deal-centric: areas and values of open deals by stage; a unit with several prospects may appear in several deals, and the UI says so (`§6.4`, `§34`, D6). |
| Prospect | An open deal linked to a unit; a unit's list of prospects is its list of open deals (`§6.3`). |
| Requirement | A brand's or buyer's general need (area, category, city, budget) recorded before a specific opportunity exists (`§21`). |
| Deal / Opportunity | A tracked leasing or sales opportunity between one brand/buyer and one or more units, with stage, probability, terms, next action and outcome (`§24`). |
| Commercial status | `unit.commercialStatus`: the inventory/operational state of the space (Vacant, Available, Active Marketing, Reserved, Contract Signed, Fit-out, Occupied, For Sale, Sold, Temporarily Blocked, Not Available, Unknown), D5. |
| Display status | Derived label shown on plans and tables: the highest-ranked open deal stage when the unit is marketable and the deal is at or above the configured threshold, otherwise the commercial status. Never stored (D5). |
| Client-visible | Visibility level `client_visible`: the object or field may be rendered in the client portal and client report for the assigned client. |
| Demo record | Any record with `demoRecord: true`; fictional, labeled, removable by "reset demo data" (A-2, `§47`). |

---

## 12. Assumptions and open questions

### 12.1 Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | UI language: EN base dictionary, RU second; default EN; Uzbek later (D3). NEEDS APPROVAL. | Dictionary work order changes; no code impact because all strings go through `t()`. |
| A-2 | Demo data is fictional and clearly labeled; CASE Advisory's real clients, projects and brand base are not used in demo data (D4). | If real data is wanted for validation, it is loaded locally through the CASE OS import adapter, never committed. |
| A-3 | Default merchandise categories = master prompt list plus Home & Interior, Sports, Kids & Education, Health/Pharmacy, Anchor Supermarket; editable in Settings (D15). | Category list is configuration; changing it does not touch code. |
| A-01-4 | Users run current Chrome/Edge/Firefox/Safari; automated QA covers Chromium only. | Additional manual browser checks in `10_QA_PLAN.md`. |
| A-01-5 | Currencies: USD default with `rentUnit` "USD/m2/month" (`§11`); UZS available as a configured second currency; no exchange-rate conversion in v0.1. | If conversion is required, a rate table is added to `settings` and KPI value services take a currency parameter. |

### 12.2 Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-01-1 | Approve positioning D1: LSP at `os/leasing/` inside the `os/` release zip (option A) versus a prototype outside `os/` (option C)? | Option A: it validates CSP compatibility and lets the team test on hosting and from disk; no CASE OS file changes either way. | Founder / product sponsor |
| Q-01-2 | Default UI language EN (A-1) or RU, given that the team works in Russian and CASE OS is Russian-first? | Keep EN as base (matches the master prompt glossary and documents); ship RU complete from day one; persist the toggle per browser. | Founder; Head of Leasing & Sales |
| Q-01-3 | Is "Sales Manager" a separate demo user, or does one `manager` role cover leasing and sales deals? | One `manager` role; deal `type` decides which stage set and fields apply; add an optional demo user "Sales Manager" for role-simulation realism. | Head of Leasing & Sales |
| Q-01-4 | Default value of the configurable rule "commission received required before Closed Won" (`§6.6`, `§22`)? | Default `true` (the master prompt says deals are not financially complete until commission conditions are satisfied unless configured otherwise); editable in Settings. | Founder; Head of Leasing & Sales |
| Q-01-5 | Which CASE OS project backups (if any) should be imported locally through the adapter during validation? | Choose one operating mall and one mixed-use project; import on a team laptop only; never commit the JSON. | Head of Leasing & Sales |
| Q-01-6 | Should `external_agent` receive a demo user and a minimal availability screen in v0.1? | No: define the role key and visibility rules only; a usable external-agent experience is a separate scope item after v0.1. | Founder / product sponsor |
| Q-01-7 | Include the optional deterministic "Ask" command palette (D12) in v0.1? | Only at the end of Phase 11 if the Phase 12 budget is intact; it is a demonstration of the tool registry, not an acceptance criterion. | Founder / product sponsor |
| Q-01-8 | Under-negotiation threshold for inventory KPIs (D6 default: stage Negotiation and above)? | Keep Negotiation as default; expose in Settings; report both "Under negotiation (≥ threshold)" and "Has any open deal" counts on the project dashboard. | Head of Leasing & Sales |

Cross-references: decisions D1–D15 and assumptions A-1..A-3 are defined in the planning context brief and summarized in `docs/leasing-platform/README.md` (decision log and approval checklist). Contradictions and corrections to the master prompt are in `02_REQUIREMENTS_REVIEW.md`.
