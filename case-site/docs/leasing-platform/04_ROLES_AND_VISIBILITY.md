# Roles, permissions and visibility matrix

**Purpose.** This document defines who can see and do what in the Leasing & Sales Platform (LSP, `os/leasing/`, decision D1): the prototype session model, the six role keys and their mapping to CASE OS roles, the role × capability matrix for every screen and action in scope, the field-level visibility classes for each entity, the client portal filter pipeline, and the negative assertions that 10_QA_PLAN.md turns into automated tests. It is the single reference for the permission checker shared by the router (`js/ui.js`), the services layer (`js/services.js`) and the AI tool registry (`js/tools.js`, D12). Engineers implement from this document; 03_DATA_MODEL.md owns the entity field lists that are classified here, and 05_STATUSES_STAGES_AND_CONFIG.md owns the status, stage and client-status vocabulary that is mapped here.

Status: DRAFT for approval — 2026-09-17

Conventions: FACTS cite `00_MASTER_PROMPT.md §n` or a CASE OS file; decisions are cited as D1–D15 (README.md decision log); assumptions are labeled A-1…A-3 (shared) and A-04-n (new in this document); open questions are Q-04-n with a recommendation and an owner. Role columns are abbreviated FA = `founder_admin`, HL = `head_ls`, MG = `manager`, AD = `administrator`, XA = `external_agent`, CL = `client`.

---

## 1. Prototype authentication disclaimer and session model

### 1.1 Disclaimer (FACT, 00_MASTER_PROMPT.md §6.1, §32, §55)

The following text is shown verbatim on the Login screen, in Settings › Users and in `os/leasing/README.md`:

```text
Prototype authentication only. This does not provide production security.
```

Consequences that every document, screen and README must respect:

- No real passwords, secrets, tokens or authentication server exist (§6.1, §55). Nothing in LSP is a security control; everything in `localStorage` is readable by anyone with access to the browser profile.
- The role system produces real UI differences (§31) and real filtering in services, but it is a simulation for workflow validation. Production RBAC, client segregation and server-side authorization are future architecture (§55, §66 G) and are described in 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md.
- Any wording that implies protection ("secure", "authenticated", "protected area") is prohibited in the UI, README and reports.

### 1.2 Session model (D9)

| Item | Rule |
|---|---|
| Storage key | `caseos-lsp-session` (D9). Separate from the data key `caseos-lsp-state-v1`; resetting demo data does not delete the session key. |
| Session shape | `{ userId, roleKey, clientId, previewClientId, loginAt, lspVersion }`. `clientId` is non-null only for `client` sessions; `previewClientId` is non-null only while an internal user previews the portal (§1.4). |
| User record fields used by the session | `id`, `login`, `displayName`, `roleKey`, `clientId`, `projectIds`, `active`, `demoRecord` (final field list in 03_DATA_MODEL.md). |
| Login form | List of demo users (cards, click fills the field) + one text field labeled **Demo code** + button **Enter**. Pressing Enter in the field submits (§32, §64 Flow 1). |
| "Demo code" vs "password" | The demo code *is* the user's `login` handle (for example `founder`) and is printed on the user card itself. The word "password" never appears in the UI; no secret is stored, hashed or compared. Rationale: a fake password field invites people to type real passwords into a prototype and creates the impression of protection that §6.1 forbids. |
| Validation on submit | Unknown login → inline message "No demo user with this code"; `active: false` → "User is deactivated"; `client` user without `clientId` → "Client user has no client organisation" (never an empty portal). |
| Validation on load | Session with unknown `userId`, unknown `roleKey` or deactivated user → session removed, Login shown with a toast. |
| Role badge | Header shows `displayName · role label`, plus the client organisation name for `client` sessions; badge colour from `DEFAULT_CONFIG.roles[roleKey].color`. |
| Logout | Removes only `caseos-lsp-session`, returns to Login; data and UI preferences remain (§32 "logout"). |
| Role-based UI | Navigation, routes, drawer actions, buttons and tool calls are all derived from the same capability table (§3). A route the role may not open renders a "Not available for your role" screen — never a blank screen (§63, §65). |
| Audit | Login and logout write `auditLog` rows (`AUD-…`) with `userId`, `roleKey`, timestamp (§54). |

### 1.3 Demo users (D4, A-2)

All demo users are fictional (`demoRecord: true`); no CASE Advisory staff, clients or the CASE OS demo users (`aziz`, `admin`, `ba`, `nodir`, `extagent`, `hilola`, `beksulton`, `humoyun`, `cfo`, `junior` — FACT `os/core.js` `USERS`) are reused. Real staff are added by `founder_admin` in Settings › Users.

| `login` (demo code) | `displayName` | `roleKey` | `clientId` | Project scope | Note |
|---|---|---|---|---|---|
| `founder` | Demo Founder | `founder_admin` | — | all | curator / sponsor |
| `head` | Demo Head of Leasing & Sales | `head_ls` | — | all | operational lead |
| `manager.lease` | Demo Leasing Manager | `manager` | — | `PROJ-001`, `PROJ-002` via `project.team` | |
| `manager.sales` | Demo Sales Manager | `manager` | — | `PROJ-002` via `project.team` | optional per D4 |
| `admin.crm` | Demo Leasing Administrator | `administrator` | — | all | |
| `agent.ext` | Demo External Agent (stub) | `external_agent` | — | `PROJ-001` via `user.projectIds` | future role, stub only (A-04-3) |
| `client.a` | Demo Client A user | `client` | `CLIENT-001` | `PROJ-001` via `project.clientIds` | §32 "at least two client users" |
| `client.b` | Demo Client B user | `client` | `CLIENT-002` | `PROJ-002` via `project.clientIds` | |

A-04-1: user and client IDs follow the D13 pattern as `USER-001` and `CLIENT-001`; 03_DATA_MODEL.md confirms the prefixes. A-04-5: a client user belongs to exactly one `clientId`; a client organisation may have several users.

### 1.4 Portal preview by internal users

§31 gives the founder the right to "preview the client portal". Implementation: setting `session.previewClientId` makes the router render screens 19–20 through the same `clientView()` pipeline as a real client session (§6), with an effective session `{ roleKey: 'client', clientId: previewClientId }`. A persistent banner reads "Portal preview — internal session, viewing as <client name>". Preview is read-only: comment and download actions are disabled so that no internal author is recorded as a client. A-04-2 (recommendation): `head_ls` and `administrator` also get preview, because they prepare and approve owner reporting (§31) and must verify what the client will see; `manager` does not.

---

## 2. Role catalog

### 2.1 LSP roles (D7)

| `roleKey` | Label (EN) | Label (RU, for `data/i18n.js`) | CASE OS keys mapped (FACT `os/core.js` `ROLES`) | `reportsTo` | Scope type (§11) | Default landing screen |
|---|---|---|---|---|---|---|
| `founder_admin` | Founder / Curator / Super Admin | Учредитель / куратор / суперадмин | `ASH`, `ADM` (both `admin:true, finance:true`) | `null` | global | Internal Home Dashboard |
| `head_ls` | Head of Leasing & Sales | Руководитель отдела аренды и продаж | `BA` (`leasing, finance, edit`; `approve:false`) | `founder_admin` | global | Internal Home Dashboard |
| `manager` | Leasing / Sales Manager | Менеджер по аренде / продажам | `AG` (`leasing, edit`; `finance:false`) | `head_ls` | `project_scope` | Internal Home Dashboard (own scope) |
| `administrator` | Leasing Administrator / CRM Coordinator | Администратор аренды / координатор CRM | `HO` (`leasing, finance, edit`) | `head_ls` | global (data), no finance | Tasks |
| `external_agent` | External Agent / Referral Partner (future) | Внешний агент / партнёр (будущая роль) | `AGX` (`ownOnly, projectScoped, external`) | `head_ls` | `project_scope` AND `own_only` | Leasing Pipeline (own leads) |
| `client` | Client / Property Owner | Клиент / собственник | none in CASE OS (owners receive generated reports only — FACT `os/v4450-owner-report.js` profile `owner`) | `null` (belongs to a `clientId`, not to the org chart) | `clientId` → assigned projects | Client Portal Dashboard |

`reportsTo` mirrors the CASE OS convention (`ROLES[key].reportsTo`: `ADM→ASH`, `BA→ASH`, `AG→BA`, `AGX→BA`, `HO→BA`) and is informational in v0.1 (used for the org list in Settings and for future escalation rules); it grants no permission.

### 2.2 CASE OS role keys without a direct LSP equivalent

Relevant only to the CASE OS backup import adapter (D1, 08_PERSISTENCE_IMPORT_EXPORT.md). CASE OS stores rights as flags per role (`leasing, finance, edit, approve, plans, own_only, project_scope, admin` — FACT `os/sql/schema_mysql.sql` table `roles`); LSP stores capabilities per role in `DEFAULT_CONFIG.roles` and never stores flags on users.

| CASE OS key | CASE OS label / flags (FACT) | Import mapping | Reason |
|---|---|---|---|
| `CFO` | Финансовый директор; flags identical to `ADM` | `founder_admin` | same rights set as `ADM`; a separate Finance role is a future role (§31) |
| `BSH` | Архитектор; `plans:true, finance:false` | `administrator` | plan upload/mapping is an administrator capability in LSP (§3.3); no finance |
| `HM` | Менеджер по консалтингу; `edit:false` (read-only) | not imported; listed in the import preview as "no LSP role" | LSP v0.1 has no read-only internal role — Q-04-1 |
| `BRJ` | Младший администратор данных; `brandsOnly:true` | `administrator` | brand/CRM maintenance is administrator work; the "brands only" restriction is not modelled in v0.1 |

### 2.3 Future roles (FACT §31, not implemented)

Asset Manager, Facility Manager, Technical Manager, Property Manager, Finance, Owner Representative, Tenant Portal User, Field Inspector. Reserved keys for 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md: `asset_manager`, `facility_manager`, `technical_manager`, `property_manager`, `finance`, `owner_representative`, `tenant_portal_user`, `field_inspector`. They do not exist in `DEFAULT_CONFIG.roles`, are not selectable in Settings and have no demo users; the config schema (05_STATUSES_STAGES_AND_CONFIG.md) reserves the key namespace so they can be added without migration.

---

## 3. Capability matrix

Cell values: **F** = full (all objects the role can reach; create/edit/delete where the entity supports it); **O** = own/assigned scope (objects inside the user's assigned projects and/or assigned to the user — §11 says which applies per role); **R** = read only; **—** = none (navigation hidden, route denied, tool call refused). Superscripts refer to the footnotes in §3.4. Every cell is enforced in three places with one table: router (`js/ui.js`), services (`js/services.js` `can(session, capability, object)`), tool registry (`js/tools.js` `requiredRole`/`visibilityScope`, D12).

### 3.1 Capabilities listed in 00_MASTER_PROMPT.md §31

| # | Capability (§31 wording) | FA | HL | MG | AD | XA | CL |
|---|---|---|---|---|---|---|---|
| C01 | Access all projects | F | F | O¹ | F | O¹ | O⁵ |
| C02 | Access all CRM records (brands, companies, contacts, requirements) | F | F | F | F | O⁷ ⁸ | — |
| C03 | See internal notes (`notes.internal`, `operational.notes`, internal comments) | F | F | O¹ | F | — | — |
| C04 | See financial and commission information (§38 block, commission reports) | F | R¹⁵ | —¹⁵ | — | — | — |
| C05 | Manage settings (§44) | F | R¹⁴ | — | R | — | — |
| C06 | Preview the client portal | F | F⁶ | — | R⁶ | — | n/a |
| C07 | Access all reports (internal + client) | F | F | O¹ ¹³ | F¹³ | — | R⁵ |
| C08 | Manage prototype users (create, deactivate, assign role/projects/client) | F | R | — | — | — | — |
| C09 | Manage projects (create/edit project, buildings, floors, mandate, team) | F | F | O¹ (edit, no create) | F (data fields; team read) | — | — |
| C10 | Manage teams / assign managers (`project.team.*`, deal `ownership.*`) | F | F | — | — | — | — |
| C11 | Manage pipelines (stage config, stage moves on any deal) | F | F | O¹ ² | R³ | O | — |
| C12 | See reports (internal) | F | F | O¹ | F | — | — |
| C13 | Manage brands | F | F | F | F | R⁷ | — |
| C14 | Manage owner reporting (generate, approve, publish client reports) | F | F | — | F (prepare, no approve)¹³ | — | — |
| C15 | See permitted commissions | F | R¹⁵ | —¹⁵ | — | — | — |
| C16 | Manage assigned properties / units (status, terms, target use, plan mapping) | F | F | O¹ | F | — | — |
| C17 | Manage leads (create deal at stage Lead, link brand/unit) | F | F | O¹ | R³ | O (own leads, assigned projects) | — |
| C18 | Create activities | F | F | O¹ | F | O | — |
| C19 | Update deal stages | F | F | O¹ ² | —³ | O (Lead→Contacted→Qualified only) | — |
| C20 | Add notes (internal / client-visible) | F | F | O¹ | F | O (internal only on own deals) | — |
| C21 | Register documents | F | F | O¹ ⁹ | F⁹ | — | — |
| C22 | Create tasks | F | F | O¹ | F | O (own) | — |
| C23 | Update next actions | F | F | O¹ | F³ | O | — |
| C24 | Maintain CRM / project / unit data (data-quality edits, duplicates) | F | F | O¹ | F | — | — |
| C25 | Maintain documents (metadata, versions, visibility internal↔client_visible) | F | F | O¹ ⁹ | F⁹ | — | — |
| C26 | Prepare reports (generate drafts) | F | F | O¹ | F¹³ | — | — |
| C27 | Check completeness (§40 indicators, data hygiene) | F | F | O¹ | F | — | — |
| C28 | Manage activities (edit/delete any activity) | F | F | O¹ | F | O (own) | — |
| C29 | Availability (external agent subset) | F | F | O¹ | F | O⁴ | via portal |
| C30 | Assigned leads (external agent subset) | F | F | O¹ | R | O⁴ | — |
| C31 | Assigned project information (external agent subset) | F | F | O¹ | F | O⁴ | — |
| C32 | Client: view dashboard | preview⁶ | preview⁶ | — | preview⁶ | — | O⁵ |
| C33 | Client: view approved floor plans, statuses, progress, merchandise mix | preview⁶ | preview⁶ | — | preview⁶ | — | O⁵ |
| C34 | Client: download approved reports and files | F | F | — | F | — | O⁵ |
| C35 | Client: leave comments, review updates | F¹⁰ | F¹⁰ | O¹ ¹⁰ | F¹⁰ | O¹⁰ | O⁵ ¹⁰ |
| C36 | Client must not see: internal notes, commissions, sensitive negotiation comments, other clients, other projects, restricted brand data | n/a | n/a | n/a | n/a | n/a | — (enforced by §6) |

### 3.2 Screen access (00_MASTER_PROMPT.md §63)

| # | Screen | Route | FA | HL | MG | AD | XA | CL |
|---|---|---|---|---|---|---|---|---|
| 1 | Login | `#/login` | F | F | F | F | F | F |
| 2 | Internal Home Dashboard | `#/home` | F | F | O¹ | F | O⁴ (minimal: my leads, my tasks) | — |
| 3 | Projects List | `#/projects` | F | F | O¹ | F | R⁴ | — |
| 4 | Project Dashboard | `#/projects/:id` | F | F | O¹ | F | R⁴ | — |
| 5 | Interactive Floor Plan | `#/projects/:id/plan` | F | F | O¹ | F | R⁴ (Availability mode only) | — |
| 6 | Units Table | `#/units` | F | F | O¹ | F | R⁴ | — |
| 7 | Leasing Pipeline | `#/pipeline/leasing` | F | F | O¹ ² | R³ | O⁴ | — |
| 8 | Sales Pipeline | `#/pipeline/sales` | F | F | O¹ ² | R³ | O⁴ | — |
| 9 | Deal Detail | `#/deals/:id` | F | F | O¹ ² | R³ | O⁴ | — |
| 10 | Brand Database | `#/brands` | F | F | F | F | —⁷ | — |
| 11 | Brand Detail | `#/brands/:id` | F | F | F | F | R⁷ | — |
| 12 | Companies | `#/companies` | F | F | F | F | — | — |
| 13 | Contacts | `#/contacts` | F | F | F | F | O⁸ | — |
| 14 | Requirements | `#/requirements` | F | F | F | F | O | — |
| 15 | Tasks | `#/tasks` | F | F | O¹ | F | O | — |
| 16 | Activities | `#/activities` | F | F | O¹ | F | O | — |
| 17 | Reports | `#/reports` | F | F | O¹ ¹³ | F¹³ | — | — |
| 18 | Documents | `#/documents` | F | F | O¹ ⁹ | F⁹ | R⁹ | — |
| 19 | Client Portal Dashboard | `#/portal` | preview⁶ | preview⁶ | — | preview⁶ | — | F⁵ |
| 20 | Client Floor Plan | `#/portal/plan` | preview⁶ | preview⁶ | — | preview⁶ | — | F⁵ |
| 21 | Settings | `#/settings` | F | R¹⁴ | — | R | — | — |
| 22 | Import / Export | `#/importexport` | F | R¹¹ | — | R¹¹ | — | — |

Direct navigation to a denied route (typed URL, stale bookmark) renders the "Not available for your role" screen with a link to the role's landing screen; the route is logged to `auditLog` as `route_denied`. Client sessions are additionally hard-routed: any non-`#/portal*` route resolves to `#/portal`.

### 3.3 Actions (00_MASTER_PROMPT.md §15 drawer actions, §27 tasks, §42 import/export, §44 settings)

| # | Action | Source | FA | HL | MG | AD | XA | CL |
|---|---|---|---|---|---|---|---|---|
| A01 | Change unit status (`commercialStatus`, writes `statusHistory`) | §15 | F | F | O¹ | F | — | — |
| A02 | Assign brand (`actualUse.brandId` / `tenantName`) | §15 | F | F | O¹ | F | — | — |
| A03 | Create deal from unit | §15 | F | F | O¹ | — | O (Lead only) | — |
| A04 | Add prospect (link another open deal to the unit) | §15 | F | F | O¹ | — | — | — |
| A05 | Add task | §15/§27 | F | F | O¹ | F | O | — |
| A06 | Add comment (internal / client-visible) | §15/§29 | F | F | O¹ | F | O (internal only) | O⁵ (own projects) |
| A07 | Register file (document record + visibility) | §15/§30 | F | F | O¹ ⁹ | F⁹ | — | — |
| A08 | Open CRM record (brand/company/contact from drawer) | §15 | F | F | F | F | R⁷ | — |
| A09 | Compare with merchandise plan (target vs actual for the unit) | §15/§17 | F | F | O¹ | F | — | R⁵ (approved mix only) |
| A10 | Task: assign to another user | §27 | F | F | O¹ (team of assigned projects) | F | — | — |
| A11 | Task: one-click complete | §27 | F | F | O¹ | F | O | — |
| A12 | Task: reschedule (`dueDate`) | §27 | F | F | O¹ | F | O | — |
| A13 | Task: edit priority / delete | §27 | F | F | O¹ (own or created) | F | — | — |
| A14 | JSON export (full `LSP_backup_YYYY-MM-DD.json`) | §42 | F¹¹ | — | — | — | — | — |
| A15 | JSON import (replace-all, with preview/validation) | §42 | F¹² | — | — | — | — | — |
| A16 | CSV export (per table, role-filtered columns) | §42 | F | F¹¹ | O¹ ¹¹ | F¹¹ | — | — |
| A17 | CSV import (brands, companies, contacts, units; column mapping preview) | §42 | F | F | — | F | — | — |
| A18 | CASE OS backup import adapter (D1) | §42/D1 | F¹² | — | — | — | — | — |
| A19 | Reset demo data | §46 | F¹² | — | — | — | — | — |
| A20 | Settings: deal stages (leasing/sales), lost reasons | §44 | F | F¹⁴ | — | R | — | — |
| A21 | Settings: unit statuses, status colors, client status mappings | §44 | F | F¹⁴ (mapping) / R (statuses, colors) | — | R | — | — |
| A22 | Settings: merchandise categories, subcategories | §44 | F | F¹⁴ | — | R | — | — |
| A23 | Settings: commission rules | §44/§38 | F | R | — | — | — | — |
| A24 | Settings: user roles (capabilities, labels, `reportsTo`) and users | §44/§31 | F (guarded, §12) | R | — | — | — | — |
| A25 | Settings: report visibility (which report sections are client-visible by default) | §44 | F | F¹⁴ | — | R | — | — |
| A26 | Settings: document visibility defaults per document category | §44 | F | F¹⁴ | — | R | — | — |
| A27 | Settings: stale-deal thresholds, notification rules | §44/§41/§45 | F | F¹⁴ | — | R | — | — |
| A28 | Settings: currencies, units | §44 | F | R | — | R | — | — |
| A29 | Plan Import / Mapping Wizard (new plan version, polygon mapping) | §16 | F | F | O¹ | F | — | — |
| A30 | Resolve client comment (`Open → In Review → Resolved`) | §29 | F | F | O¹ | F | — | — |

### 3.4 Footnotes

1. `project_scope` (§11): objects whose `projectId` is in the user's assigned project set. Brands, companies, contacts and requirements are global CRM records and are not project-scoped for `manager`.
2. `manager` may move stages and edit terms on any deal in assigned projects; changing `ownership.responsibleManagerId` / `supportManagerId` is reserved to `head_ls` and `founder_admin` (C10). Ownership determines the "My work" widgets and the Manager plan mode, not read access.
3. `administrator` on deals: read `stage`, `probability`, `commercialTerms`; may edit `nextAction.*`, `contactIds`, `documentIds`, `activity.*` and create activities; may not change `stage` or `commercialTerms` (Q-04-2).
4. `external_agent` (stub, §11.3): only units whose display status maps to availability group `available` in `user.projectIds`, only the whitelisted fields, plan in Availability mode only; only deals where `ownership.referralPartnerId` or `ownership.responsibleManagerId` equals the user.
5. `client`: only through screens 19–20 and only through the `clientView()` view model (§6); no internal route ever renders for a client session.
6. Preview renders through `clientView()` with the effective client session, read-only, banner shown (§1.4, A-04-2).
7. `external_agent` sees a brand only when it is linked to one of the agent's own deals, and only `name`, `classification.category`, `classification.subcategory`, `logoUrl`.
8. `external_agent` sees contacts linked to own deals: `firstName`, `lastName`, `position`; phones, emails and messaging handles only for contacts the agent created.
9. Documents are filtered by document `visibility` (§5). `manager` and `administrator` may set `internal` ↔ `client_visible` on documents they can edit; `restricted` may be set or cleared only by `founder_admin`/`head_ls`.
10. Comment authors choose `internal` or `client_visible` at creation; `restricted` only by `founder_admin`/`head_ls`; comments authored by a `client` are `client_visible` by definition and carry `responseStatus`.
11. The full JSON export contains restricted fields (commissions, restricted contacts, internal notes) and is therefore `founder_admin` only. CSV exports pass through the same field filter as the screens: commission columns only for `founder_admin`; `manager` exports own scope; no export contains fields the role cannot see on screen.
12. Destructive operations (replace-all import, CASE OS adapter, reset demo data) are `founder_admin` only and require the confirm step of §42.
13. Internal reports: `manager` generates for assigned projects; `administrator` generates all internal reports and prepares (drafts) client reports; only `founder_admin`/`head_ls` approve/publish a client report (§9).
14. `head_ls` edits the operational configuration (stages, lost reasons, categories, client status mapping, report/document visibility defaults, stale thresholds, notifications) and reads the rest; users, roles, commission rules, currencies/units and unit status definitions stay with `founder_admin` (recommendation, Q-04-5).
15. Commission visibility is detailed in §10: `head_ls` reads all commission fields and edits payment tracking fields; `manager` sees nothing by default (config switch for own share, Q-04-3).

---

## 4. Field-level visibility matrix

### 4.1 Visibility classes (FACT §6.8, §30; keys per D7)

| Stored key | Label | Who sees (before scope filtering) | Typical content |
|---|---|---|---|
| `internal` | Internal | all internal roles (FA, HL, MG, AD) within their scope; XA only whitelisted fields in scope; never CL | default for every entity and field |
| `client_visible` | Client-visible | internal roles + CL of the assigned client(s) + XA in assigned projects — but only fields on the entity whitelist (§6) | approved statuses, approved documents, client-visible notes and comments, approved key deals |
| `restricted` | Restricted | FA and HL only, plus explicit exceptions listed per entity (author of a restricted comment; owner of a restricted contact) | commissions, sensitive negotiation comments, confidential brands and decision-maker contacts |
| `public` | Public / ecosystem-approved | everyone who can see the object, including CL and XA; additionally flagged as exportable to Geoanalytics/Building OS (§49) | verified building data, availability indicators; in v0.1 behaves like `client_visible` plus the export flag — nothing is published automatically (§49) |

Fields carry a class in `DEFAULT_CONFIG.visibility.fieldClass[entity][fieldPath]`; objects carry `visibility` (§9, §11, §18, §24, §30). A field class is a default: a field with class `client_visible` still reaches a client only if the object's own `visibility` allows it (§5).

### 4.2 Default field classes per entity

Field paths follow the schemas in 00_MASTER_PROMPT.md (§9–§11, §18–§20, §24, §27, §29, §30, §37, §38); 03_DATA_MODEL.md is authoritative for the complete list. Fields not listed default to `internal`.

| Entity | `public` by default | `client_visible` by default | `internal` by default | `restricted` by default |
|---|---|---|---|---|
| project (§9) | `id`, `name`, `city`, `country`, `assetTypes` | `alternativeNames`, `address`, `latitude`, `longitude`, `status`, `areas.*` (declared GBA/GLA/leasable/sellable, `unitCount`, `floorCount`), `commercial.targetOpeningDate`, `commercial.targetOccupancyPercent`, `team.projectLeadId` (rendered as display name only), `notes.clientVisible`, `buildingIds`, `floorIds`, `unitIds`, `updatedAt` | `clientIds` (never rendered to any client — other clients must not be inferable), `commercial.leasingMandateType`, `salesMandateType`, `mandateMode`, `mandateStartDate`, `mandateExpiryDate`, `pricingNotes`, `team.*` except `projectLeadId`, `notes.internal`, `documentIds` (filtered per document), `createdAt` | — |
| building / floor / floorPlan (§10) | `id`, `name`, `blockCode`, `floorNumber` | `status`, `floorIds`, `unitIds`, plan `version`, `current`, `effectiveDate`, plan SVG/polygons of the `current` version, `polygonMappings` | `notes`, `uploadedBy`, `archived` versions, `backgroundUrl` of archived versions | — |
| unit (§11) | `id`, `unitNumber`, `label`, `floorId`, `buildingId` | `geometry.polygonId`, `geometry.centroid`, `area.glaM2`, `targetUse.category`, `targetUse.subcategory`, `commercialStatus` (rendered only as mapped `clientStatus`), `actualUse.tenantName`/`category`/`subcategory` (rendered only when the unit `countsAs` leased or sold, A-04-4), `visibility`, `updatedAt` | `geometry.frontageLengthM`, `geometry.areaSource`, `area.grossUnitAreaM2`, `mezzanineM2`, `terraceM2`, `targetUse.brandProfile`, `merchandiseRole`, `preferredUnitType`, `actualUse.brandId` (id never leaves the internal side), `leasingTerms.*`, `salesTerms.*`, `responsibility.*`, `operational.*` (next action, last activity, notes), `dealIds`, `activityIds`, `statusHistoryIds`, `createdAt` | — (unit-level restriction is expressed by setting the unit `visibility` to `restricted`) |
| deal (§24) | — | only when `deal.visibility = client_visible` ("client-approved key deal"): `id`, `type`, `unitIds` (as unit labels), brand display name (or "Confidential tenant" if the brand is `restricted`), `stage` rendered as `clientStatus`, `status`, `dateEnteredStage`, `outcome.signedDate`, `outcome.won` | everything else: `probability`, `ownership.*`, `companyId`, `contactIds`, `commercialTerms.*` (asking/proposed/agreed rent, service charge, turnover rent, deposit, rent-free, fit-out, lease term, indexation, prices, payment schedule, planned closing), `nextAction.*`, `activity.*`, `documentIds` (filtered), `outcome.lost`, `outcome.lostReason`, `outcome.paymentDate`, `outcome.commissionStatus`, `createdAt`, `updatedAt` | `commission.*` (§38 block: `grossCommission`, `invoiceDate`, `expectedPaymentDate`, `receivedAmount`, `receivedDate`, `status`, `companyShare`, `managerShare`, `externalAgentShare`, `administratorShare`, `notes`) — always restricted, class not editable |
| brand (§18) | `id`, `name`, `logoUrl`, `website`, `countryOfOrigin`, `classification.category`, `classification.subcategory` (rendered to a client only through a signed unit or an approved deal) | `classification.priceSegment`, `classification.format`, `classification.brandType`, `operatingCountries`, `status` | `legalName`, `companyId`, `contactIds`, `expansionRequirements.*`, `relationship.*`, `history.*` (incl. `rejectedProjectIds`, `rejectionReasons`), `notes.general`, `documentIds`, `activityIds` | `notes.internal`; the whole brand when `brand.visibility = restricted` (NDA / confidential prospect): then even the tenant name on a signed unit renders as "Confidential tenant" until released |
| company (§19) | — | — | all fields (`legalName`, `tradingName`, `country`, `website`, `industry`, `companyType`, `brandIds`, `contactIds`, `responsibleManagerId`, `documents`, `activityHistory`) | `notes` |
| contact (§20) | — | — (contacts never appear in any client whitelist) | `firstName`, `lastName`, `position`, `companyId`, `brandIds`, `city`, `country`, `preferredLanguage`, `relationshipOwnerId`, `lastContact`, `nextAction` | `phones`, `emails`, `messagingApps`, `notes` (§3.4 "private contacts"); the whole contact when flagged `visibility = restricted` (decision makers, §37 "restricted contacts") |
| document (§30) | — | when `document.visibility = client_visible`: `id`, `fileName`, `category`, `version`, `uploadedAt`, `fileSize`, `localUrl` (download), `projectId`, `unitId` (as label) | `uploadedBy`, `comment`, `brandId`, `dealId`; every document with `visibility = internal` | every document with `visibility = restricted` (e.g. owner instruction with terms, signed contract scans) |
| comment (§29) | — | comments with `visibility = client_visible`: `id`, `authorId` (rendered as display name and role label "CASE team" / client user name), `createdAt`, `relatedObject` (type + label), `text`, `responseStatus`; all comments authored by a client user | comments with `visibility = internal` (internal notes on the same object) | comments with `visibility = restricted` ("sensitive negotiation comments", §31): FA, HL, the author, and the deal's `responsibleManagerId` |
| task (§27) | — | — (tasks never reach the portal; "next key actions" in the portal come from the approved client report, §9) | all fields | — |
| activity (§28) | — | — (client sees "recent changes" derived from `statusHistory` of visible units, not activities) | all fields | activities of type `client decision`, `proposal sent` when the deal is `restricted` |
| report (§37) | — | client reports with `approved = true` (A-04-6): `id`, `type = client`, `projectId`, `periodFrom`, `periodTo`, `generatedAt`, the frozen client snapshot | internal reports; draft client reports; `generatedBy` | internal report sections "pending commissions", "received commissions", "pipeline by manager", "conversion", "commission status" |

### 4.3 Who may change a visibility value

| Target | FA | HL | MG | AD | XA | CL |
|---|---|---|---|---|---|---|
| Object `visibility` on project, building, floor, floorPlan, unit | F | F | `internal` ↔ `client_visible` on units in scope; not `restricted`/`public` | `internal` ↔ `client_visible`; not `restricted`/`public` | — | — |
| Deal `visibility` (approve a key deal for the client) | F | F | — (may request approval via task) | — | — | — |
| Brand `visibility` (`restricted` for confidential brands) | F | F | — | — | — | — |
| Contact `visibility` (`restricted`) | F | F | own contacts (`relationshipOwnerId` = self) | — | — | — |
| Document `visibility` | F | F | `internal` ↔ `client_visible` on documents in scope⁹ | `internal` ↔ `client_visible`⁹ | — | — |
| Comment `visibility` at creation | any | any | `internal` / `client_visible` | `internal` / `client_visible` | `internal` only | fixed `client_visible` |
| Report approval (`approved`) | F | F | — | — | — | — |
| Field class defaults (`DEFAULT_CONFIG.visibility.fieldClass`) and client whitelist | F (Settings › Visibility; see §12) | R | — | R | — | — |

Every visibility change writes an `auditLog` row (`AUD-…`, action `visibility_changed`, old/new value, `userId`), because it is a client-visible action in the sense of §54.

---

## 5. Visibility levels: semantics and precedence

Precedence is evaluated top-down; the first rule that denies wins. There is no rule that can re-grant what a higher rule denied.

| Order | Level | Rule |
|---|---|---|
| P1 | Session | A `client` session resolves to exactly one `clientId`; internal sessions resolve to a scope (§11). No session → Login. |
| P2 | Project assignment | Client: `project.clientIds` includes `session.clientId`. Manager/external agent: project in assigned set. Otherwise the project and everything under it does not exist for the session (not "hidden": it is absent from every list, count, search result and report). |
| P3 | Object visibility | Object `visibility` must be allowed for the role (§4.1). For a client: `client_visible` or `public`. Children inherit denial: a unit under a `restricted` floorPlan version is still visible through the `current` version, but a unit with `visibility = internal` is absent from the client plan, table, KPIs and report (Q-04-4). |
| P4 | Field class | Only fields whose class is allowed for the role are copied; for clients and external agents the copy is a **whitelist** (`DEFAULT_CONFIG.visibility.clientWhitelist[entity]`, `externalAgentWhitelist[entity]`), never a blacklist (D7). Fields in the `restricted` class are never members of any whitelist and the Settings UI refuses to add them. |
| P5 | Value mapping | Some whitelisted fields are rendered through a mapping, never raw: `commercialStatus`/derived display status → `clientStatus` (§36, D5, 05_STATUSES_STAGES_AND_CONFIG.md); `deal.stage` → `clientStatus`; `actualUse.tenantName` → shown only when the unit `countsAs` leased/sold and the brand is not `restricted`; user IDs → display names; internal labels never fall through — an unmapped status renders as its `availabilityGroup` label (Available / In process / Occupied or sold / Unavailable). |
| P6 | Sub-object visibility | Documents, comments, notes and reports attached to a visible object are filtered individually by their own `visibility` (documents §30, comments §29, reports §37). A `client_visible` unit with ten documents may show none of them. |
| P7 | Aggregates | KPIs, counts and "recent changes" for a client are computed **after** P2–P6 from the filtered set, never from the internal totals (§8). Internal aggregates are computed on the full scope of the internal role. |

Note types (FACT §9, §29): `project.notes.internal[]` and `unit.operational.notes[]` are internal notes; `project.notes.clientVisible[]` are client-visible notes and are rendered in the portal project header and the client report "executive summary"; brand `notes.general[]` are internal (brand data is not client data), brand `notes.internal[]` are restricted. Client comments are a third type: created by client users, always `client_visible`, with `responseStatus` (`Open`, `In Review`, `Resolved`) and surfaced to internal users in Home › "client comments awaiting response" (§27, §33).

Precedence examples (used as test fixtures in 10_QA_PLAN.md): (a) a `client_visible` deal on an `internal` unit is not shown to the client (P3 before P6); (b) a `client_visible` document on a project the client is not assigned to is not shown (P2); (c) `leasingTerms.agreedRent` on a `client_visible` unit is not shown because the field class is `internal` (P4); (d) a unit in stage "LOI" shows "In Negotiation" (P5); (e) an `internal` comment on a `client_visible` unit is not shown (P6); (f) the client's "leased GLA" counts only visible units (P7).

---

## 6. Client filter pipeline

The portal is a projection of `appState`, computed by one service and rendered by `js/views/portal.js`. The pipeline has six stages; the same function serves the client dashboard, the client floor plan, the client unit drawer, the client report and the AI tool `getVisibleDocuments()`/`generateOwnerReport()` when called by a client session (D12).

```text
session.clientId
  -> projects where project.clientIds includes clientId          (P2)
  -> objects of those projects with visibility in {client_visible, public}   (P3)
  -> field WHITELIST per entity (DEFAULT_CONFIG.visibility.clientWhitelist)  (P4)
  -> value mapping: clientStatus, tenant display, display names             (P5)
  -> sub-object filtering: documents, comments, notes, reports              (P6)
  -> portal view model (plain JSON, no references into appState)            (P7)
```

Pseudo-code (services layer, pure, no DOM; final signatures in 09_IMPLEMENTATION_PLAN.md):

```js
// js/services.js
function clientView(projectId, session) {
  const clientId = session.previewClientId || session.clientId;                 // §1.4 preview uses the same path
  if (!clientId) return { denied: 'no_client' };
  const project = state.projects.find(p => p.id === projectId);
  if (!project || !project.clientIds.includes(clientId)) return { denied: 'not_assigned' };   // P2

  const cfg = state.settings.visibility;                                         // whitelist + fieldClass + clientStatus mapping
  const visible = o => o.visibility === 'client_visible' || o.visibility === 'public';       // P3
  const pick = (entity, o) => copyWhitelisted(cfg.clientWhitelist[entity], o);   // P4 — copies listed paths only

  const units = state.units
    .filter(u => u.projectId === projectId && visible(u))
    .map(u => ({
      ...pick('unit', u),
      clientStatus: clientStatusOf(u, cfg),                                      // P5 — mapped label, never raw
      tenant: tenantForClient(u),                                                // null unless countsAs leased/sold and brand not restricted
      documents: docsFor(u).filter(d => d.visibility === 'client_visible').map(d => pick('document', d)),   // P6
      comments: commentsFor(u).filter(c => c.visibility === 'client_visible').map(c => pick('comment', c))
    }));

  const deals = state.deals
    .filter(d => d.projectId === projectId && d.status === 'Open' && d.visibility === 'client_visible')
    .map(d => pick('deal', d));                                                  // "client-approved key deals"

  return {                                                                       // P7 — plain data only
    project:   pick('project', project),
    floors:    floorsFor(project).map(f => pick('floor', f)),
    plans:     currentPlansFor(project).map(p => pick('floorPlan', p)),
    units, deals,
    kpis:      clientKpis(units, deals, cfg),                                    // §8 — computed from the filtered set
    changes:   recentClientChanges(units, cfg),                                  // statusHistory of visible units, mapped
    documents: projectDocs(project).filter(d => d.visibility === 'client_visible').map(d => pick('document', d)),
    reports:   state.reports.filter(r => r.projectId === projectId && r.type === 'client' && r.approved).map(r => pick('report', r)),
    comments:  clientComments(projectId, clientId),
    generatedAt: nowIso()
  };
}
```

Invariants (each has a test in 10_QA_PLAN.md, §13 below):

1. **Portal renderers receive only the view model.** `js/views/portal.js` never reads `appState`, `state.*` or any services function other than `clientView()`, `portalProjects(session)` and the two write actions `addClientComment()` and `downloadDocument()`. Enforced by a static check in the QA tooling (grep for `appState`/`state.` in `portal.js`) and by review.
2. `copyWhitelisted` copies by explicit path list; unknown or newly added fields are absent until someone adds them to the whitelist (D7: whitelist, never blacklist).
3. The view model is serializable JSON with no object references; a stringified view model must not contain any key from the restricted set (`commission`, `commercialTerms`, `probability`, `ownership`, `responsibility`, `nextAction`, `lostReason`, `contactIds`, `companyId`, `clientIds`, `notes.internal`, `operational`, `phones`, `emails`).
4. `portalProjects(session)` is the only source of the client project switcher; a client assigned to one project sees no switcher.
5. Every client write action (`addClientComment`) re-validates P2 and P3 on the target object and writes `auditLog` (`client_comment_created`).
6. The same pipeline serves reports: `generateOwnerReport(projectId, session)` for a client type report calls `clientView()` and freezes its output as the report snapshot (§9).

The external agent uses the same mechanism with `externalAgentWhitelist` and the scope of §11.3; the internal roles use `fieldClass` filtering (restricted fields removed for MG/AD) rather than a whitelist.

---

## 7. Internal vs client unit drawer

Both drawers open from the plan and the unit table without leaving the plan (§15, §35). Sections in the internal drawer follow §15; the client drawer is a separate renderer fed by the `units[]` element of the view model.

| Section (§15) | Internal drawer (FA/HL/MG/AD; MG/AD without restricted fields) | Client drawer (CL, from `clientView`) |
|---|---|---|
| Summary | `unitNumber`, floor, `area.glaM2` (+ gross/mezzanine/terrace), `commercialStatus` + derived display status (D5), target category/subcategory, actual category/subcategory, tenant/brand (with link), responsible manager, supporting manager, referral partner, completeness indicator (§40), stale indicator (§41) | `unitNumber`, floor, `area.glaM2`, `clientStatus` badge with the approved colour, target category, actual category (only if leased/sold), tenant name (only if leased/sold and brand not restricted), "last updated" date |
| Commercial | asking rent / sale price, agreed terms, service charge, VAT treatment, rent-free, fit-out, deposit, lease term, indexation, commercial notes | absent (no section rendered; no "hidden" placeholder that reveals the existence of terms) |
| Deal | all open deals with stage, probability, next action and date, last activity, "add prospect"; closed deals collapsed | "Active negotiations: n" (count only) and the client-approved key deal(s) with `clientStatus` and stage-entry date; no brand names for non-approved deals |
| Contacts | brand contacts, decision makers, broker/referral contacts (restricted contacts only FA/HL) | absent |
| Documents | all documents the role may see with visibility badge; register file; change visibility (per §4.3) | documents with `visibility = client_visible` only, with download; no visibility badge (every listed item is by definition approved) |
| Activity timeline | calls, meetings, viewings, email/messenger notes, proposal sent, stage changes, status changes, comments, document uploads, tasks, client comments | "Recent changes": mapped status changes of this unit (from `statusHistory`), client-visible comments with response status, client-visible document additions; no calls/meetings/notes |
| Comments | internal, client-visible and restricted (per role) with filter chips | client-visible comments (own and CASE replies) + **Leave comment** form (author = client user, `visibility = client_visible`, `responseStatus = Open`) |
| Actions | change status, assign brand, create deal, add prospect, add task, add comment, register file, open CRM record, compare with merchandise plan (per §3.3) | leave comment; download approved document; nothing else — no disabled internal buttons are rendered (§65 "no fake buttons") |

Rendering rule: the client drawer never renders an empty section header for data that exists internally; sections are omitted, not greyed out, so the client cannot infer the presence of internal data.

---

## 8. Client-visible KPIs (00_MASTER_PROMPT.md §35) and excluded internal numbers

All client KPIs are computed by `clientKpis()` from the filtered unit and deal sets (P7) with the anti-double-counting rules of D6 and 07_CALCULATIONS_AND_KPI_RULES.md. Denominators are shown ("of 12 340 m² shown"); missing areas are reported as "n units without area", never as zero (§34, §65).

| §35 KPI | Source in the view model | Rule / note |
|---|---|---|
| Total GLA | Σ `area.glaM2` of visible units | client-visible unit set only (Q-04-4); declared `project.areas.glaM2` shown separately as "declared GLA" (D6) |
| Leased GLA | Σ GLA of visible units with `countsAs = leased` | unit-centric, each unit once |
| Vacant GLA | Σ GLA of visible units in availability group `available` | |
| GLA under negotiation | Σ GLA of visible units in bucket "Under negotiation" (D6) | unit-centric; a unit with three prospects counts once |
| Leased percentage / Available percentage | Leased GLA ÷ Total GLA; Vacant GLA ÷ Total GLA | denominator displayed |
| Signed deals | count of visible units whose status `countsAs` leased or sold + count of `client_visible` deals at Contract Signed or later | both numbers labeled; deal count is deal-based |
| Active negotiations | count of open deals on visible units at stage ≥ threshold (default Negotiation) | count only, no names, no values |
| Sales progress | Sold GLA and sold unit count ÷ sellable visible units | only for projects configured for sales |
| Recent changes | mapped status changes of visible units in the last N days (config) + client-visible document additions | labels are `clientStatus`, never internal |
| Merchandise mix | target vs actual by GLA and by unit count over visible units (§17) | category level; subcategory only if configured client-visible in Settings › Report visibility |
| Pipeline summary | counts of visible units per `clientStatus` group (Interest / In Negotiation / Contracting / Leased / Available / Sold) | no weighted value, no probability |
| Next key actions | `nextSteps` of the latest approved client report (§9) | never `deal.nextAction` or task lists |
| Last update date | max `updatedAt` over visible units, documents and comments; plus `generatedAt` of the latest approved report | |

Internal numbers that are excluded from every client view (dashboard, drawer, report, print, tool output): weighted pipeline value and probabilities; asking, proposed and agreed rents or prices; pipeline by manager, activities by manager, conversion, stage aging; commissions pending/received and shares; stale-deal counts, deals without next action, overdue tasks; data-hygiene and completeness counts; lost reasons and refusal analytics; names of prospect brands on non-approved deals; contacts; other clients' projects; declared vs measured area discrepancies flagged as hygiene items.

---

## 9. Reports visibility (00_MASTER_PROMPT.md §37)

| Aspect | Client report | Internal reports (Leasing, Sales, Activity, Data quality) |
|---|---|---|
| Generated by | FA, HL, AD (draft) for one project | FA, HL, AD; MG for assigned projects |
| Data source | `clientView(projectId, sessionOfClientOrPreview)` frozen as `report.snapshot` (§6 invariant 6) | services on the internal scope of the generating role, with `restricted` sections omitted for MG/AD (§4.2 report row) |
| Approval | `approved = true` set by FA or HL only (A-04-6); before approval the report is `internal` and absent from the portal | not applicable (internal reports are never in the portal) |
| Includes (FACT §37) | executive summary (from `project.notes.clientVisible` + KPIs), leasing and sales progress, leased / vacant / negotiating area, changes since previous approved report, floor/unit status (mapped), merchandise mix, client-approved key deals, decisions required, next steps, last updated timestamp | GLA by status; pipeline by stage; pipeline by manager; conversion; stage aging; signed deals; pending/received commissions (FA/HL only); lost reasons; brands by category; sales available units/value, pipeline value, offers, negotiations, contracts, payments, commission status (FA/HL only); overdue follow-ups; activities by manager; deals without next action; stale deals; units without area/category; brands without contacts; duplicate contacts; outdated commercial terms |
| Excludes (FACT §37) | internal commissions; internal staff notes; confidential negotiations (all non-approved deals, all terms); restricted contacts; plus everything in §8 "excluded" | nothing for FA/HL; commission and per-manager financial sections for MG/AD; restricted comments for MG/AD |
| "Changes since previous report" | diff between this snapshot and the previous **approved** client report of the same project (mapped statuses, visible documents, approved deals) | diff on the internal snapshot |
| Print / PDF | print stylesheet, no internal navigation, banner "Prototype report — generated from local data" | same, with "Internal — not for distribution" header |
| Where visible | portal Reports list (approved only), portal dashboard "latest report"; internal Reports screen (all versions) | internal Reports screen only |

Once approved, a client report snapshot is immutable (same principle as the CASE OS owner report snapshots, FACT `os/v4450-owner-report.js`: shared snapshots are forced to the `owner` profile and broker/rate/rent/comment are blanked before saving). A correction is a new report version.

---

## 10. Commission visibility (00_MASTER_PROMPT.md §38) and staff performance

The commission block lives on the deal (`deal.commission.*`, class `restricted`, not editable in Settings › Visibility). Commission rules (percentages, shares, "commission received required for Closed Won" §6.6/§22) live in `DEFAULT_CONFIG.commissions` and are edited by `founder_admin` only (A23).

| Item | FA | HL | MG | AD | XA | CL |
|---|---|---|---|---|---|---|
| `grossCommission`, `companyShare`, `managerShare`, `externalAgentShare`, `administratorShare`, `notes` | F | R | —¹ | — | — | — |
| `status` (Pending / Received / Not Applicable), `invoiceDate`, `expectedPaymentDate`, `receivedAmount`, `receivedDate` | F | F (payment tracking) | —¹ | — | — | — |
| Stage labels "Commission Pending" / "Commission Received" on a deal | visible | visible | visible (stage only, no amounts) | visible | — | rendered as "Leased"/"Sold" via `clientStatus` (§36) |
| Reports: pending/received commissions, commission status (§37) | F | F | — | — | — | — |
| Dashboard/CRM filter "commission received/pending" (§26) | F | F | — | — | — | — |
| Commission rules in Settings | F | R | — | — | — | — |
| Staff performance: pipeline by manager, conversion by manager, stage aging by manager | F | F | own row only | — | — | — |
| Staff performance: activities by manager, overdue follow-ups by manager | F | F | own row only | F (coordination view, no financial columns) | — | — |

¹ Q-04-3: CASE OS gives the leasing agent "own KPIs and commissions" (FACT `os/core.js` `ROLES.AG.rights`), while §31 lists no commission right for the manager. Recommendation: config switch `commissions.managerSeesOwnShare` (default `false`); when `true`, `manager` sees `managerShare` and `status` on deals where `ownership.responsibleManagerId` is the user, nothing else. CASE OS `HO` has `finance:true`; LSP `administrator` deliberately has no commission visibility (§31 lists none) — flagged in the import mapping preview.

Client users never see commission distribution (§38), and the word "commission" does not occur in the portal, the client report or the client CSV export; §13 asserts this with a text search.

---

## 11. `own_only` / `project_scope` semantics

CASE OS implements two flags (`own_only`, `project_scope` — FACT `os/sql/schema_mysql.sql`, `os/core.js` `serverRightChips`); in `core.js` `own_only` forces registry filters to the user's broker name and `project_scope` limits an external agent to `user.projects` (FACT `USERS[].projects`, e.g. `extagent` → `['ca']`). LSP keeps both concepts as scope attributes of the role config, not as user flags.

### 11.1 Definitions

| Attribute | Definition | Resolution (services `scopeOf(session)`) |
|---|---|---|
| `project_scope` | the user may reach only objects whose `projectId` is in the assigned project set | assigned set = `user.projectIds` ∪ projects where `project.team.curatorId / headId / projectLeadId / administratorId` = user or `leasingManagerIds` / `salesManagerIds` include the user; recomputed on every render (no cached copy) |
| `own_only` | within the reachable set, the user may reach only objects assigned to them | deals: `ownership.responsibleManagerId`, `supportManagerId` or `referralPartnerId` = user; tasks: `assigneeId` = user or `createdBy` = user; activities: `createdBy` = user; units: `responsibility.responsibleManagerId` / `supportingManagerId` / `referralPartnerId` = user; contacts: `relationshipOwnerId` = user or created by user |
| global | no project restriction | FA, HL, AD |

### 11.2 Manager (A-04-7)

`manager` = `project_scope` without `own_only`. Rationale: leasing teams share a project; a manager must see colleagues' deals on the same unit to avoid double offers (§6.4 multiple prospects) and to cover absences. Consequences:

- Read: every unit, deal, task, activity, document and comment of assigned projects (restricted fields/comments removed per §4).
- Write: units, deals (stage, terms, next action), tasks, activities, documents, comments in assigned projects; ownership changes reserved (footnote 2). Brands, companies, contacts, requirements: global read/write (CRM is shared, §18–§21).
- "Mine" views: Home › My work, Manager plan mode (§14.4), pipeline chip "My deals" use the `own_only` predicate as a filter, not as a permission.
- A manager with an empty assigned set sees the Home screen with the message "No projects assigned — ask the Head of Leasing & Sales" and the global CRM; nothing else.
- CASE OS import: `AG` users become `manager`; their CASE OS `broker` name is matched to `displayName` and written into `ownership.responsibleManagerId` of imported deals; project membership is derived from the projects of those deals and shown in the import preview for confirmation.

### 11.3 External agent stub (future role, §31)

`external_agent` = `project_scope` AND `own_only`. It exists in v0.1 only to prove that the permission checker and whitelists work for a limited partner role (A-04-3); no partner onboarding, no invitations, no commission split UI.

| Area | What the stub sees / does |
|---|---|
| Navigation | Home (my leads, my tasks), Availability (Units Table + plan in Availability mode), Leasing Pipeline (own), Sales Pipeline (own), Tasks (own), Documents (`client_visible`/`public` documents of assigned projects) |
| Units | only units in assigned projects whose display status is in availability group `available`; whitelist `externalAgentWhitelist.unit`: `unitNumber`, `label`, floor, `area.glaM2`, `targetUse.category`, `targetUse.subcategory`, availability label, `leasingTerms.askingRent` only if `DEFAULT_CONFIG.roles.external_agent.showAskingRent = true` (default `false`); no tenant, no prospects, no terms, no manager |
| Deals | own deals only; may create a deal at stage Lead in assigned projects with `ownership.referralPartnerId = self`; may move Lead → Contacted → Qualified; further stages by internal roles; sees no other prospects on the unit (mirrors CASE OS "brand variants hidden for external agents", FACT `os/core.js` comment near the refusals card) |
| Brands / contacts | per footnotes 7 and 8; no Brand Database screen, no refusal/rejection history, no expansion requirements |
| Comments / notes | internal notes on own deals; no client-visible comments (cannot speak to the client) |
| Reports, settings, import/export, commissions | none |

### 11.4 Client scope

`client` = `clientId` scope: projects where `project.clientIds` includes `session.clientId`; everything else is absent (§5 P2). Two client users of the same organisation see the same projection; a project with two clients (joint owners) shows each of them the same projection and neither sees the other's identity (`project.clientIds` is internal).

---

## 12. Settings that change permissions

Settings › Users and Settings › Roles are `founder_admin` screens (A24); `head_ls` reads them. All changes write `auditLog` rows (`user_created`, `user_updated`, `user_deactivated`, `role_updated`) and take effect on the next render for a logged-in user of that role (no re-login needed; the session stores `roleKey` only, capabilities are read from config at check time).

| Setting | Editable by | Effect | Guard |
|---|---|---|---|
| Create user (`login`, `displayName`, `roleKey`, `clientId`, `projectIds`, `active`) | FA | adds a demo-code login | `login` unique and non-empty; `client` role requires `clientId`; internal roles must have `clientId = null` |
| Change a user's role | FA | immediate | G1: the last active `founder_admin` cannot be demoted or deactivated (count of active `founder_admin` users must stay ≥ 1); G2: a user cannot change their own role while they are the only active `founder_admin` |
| Deactivate user | FA | user cannot log in; existing session is invalidated on next load (§1.2) | G1 |
| Assign projects / client to a user | FA (HL may assign projects to `manager` users via `project.team`, C10) | changes scope (§11) | a client user's `clientId` cannot be changed while they have open comments — reassign comments first (recommendation) |
| Role labels, colour, `reportsTo` | FA | cosmetic / org chart | `reportsTo` may not create a cycle |
| Role capability toggles (`DEFAULT_CONFIG.roles[roleKey].capabilities[C..]` = `full` / `own` / `read` / `none`) | FA | changes the matrix of §3 at runtime | G3: `founder_admin` capabilities C05 (manage settings) and C08 (manage users) are locked at `full` and cannot be edited; G4: `client` capabilities are a hard ceiling — only C32–C35 can be `own`, every other capability is forced to `none` regardless of config; G5: `external_agent` cannot receive `full` on anything or any capability in C03/C04/C05/C08/C10/C14; G6: no role other than `founder_admin`/`head_ls` can receive read access to `restricted` fields |
| Field class defaults and whitelists (Settings › Visibility) | FA | changes §4.2 / §6 whitelists | G7: fields of class `restricted` (`deal.commission.*`, `contact.phones/emails/messagingApps`, `brand.notes.internal`, `project.clientIds`) cannot be added to `clientWhitelist` or `externalAgentWhitelist`; G8: `project.clientIds` cannot be reclassified |
| Client status mapping, report visibility, document visibility defaults | FA, HL | changes P5 mapping and default `visibility` of new reports/documents | a document category default may be `internal` or `client_visible`, never `restricted` by default |
| Import of settings (JSON import replaces `settings` too) | FA | | validation refuses a settings block that violates G3–G8 and reports it in the import preview (08_PERSISTENCE_IMPORT_EXPORT.md) |

A "Reset roles to defaults" button restores `DEFAULT_CONFIG.roles` and `DEFAULT_CONFIG.visibility` without touching users or data.

---

## 13. QA hooks: negative assertions per role

10_QA_PLAN.md turns each row into a named test (`lsp_roles_*.js`, D10; results in `docs/qa/lsp/*.json`). "How" indicates the assertion type: **DOM** (text/element absent in the rendered page), **VM** (stringified `clientView()`/service output lacks a key or value), **ROUTE** (typed URL lands on the denied screen), **TOOL** (`LSP.runTool()` refuses or filters), **PRINT** (print view of a report), **STATIC** (source grep). Demo data carries canary strings so DOM/PRINT checks are deterministic: every internal note, restricted comment, commission note and contact phone in `data/demo.js` contains the token `CANARY-INTERNAL`, `CANARY-RESTRICTED`, `CANARY-COMMISSION` or `CANARY-CONTACT` respectively (A-04-8).

| ID | Role | Must NOT | How | Source |
|---|---|---|---|---|
| RV-01 | CL | see any project not in `project.clientIds` for its `clientId` (`client.a` never sees `PROJ-002`) | DOM + VM + TOOL (`getProject('PROJ-002')` refused) | §31, §64 Flow 9, §65 |
| RV-02 | CL | reach any internal route (`#/home`, `#/units`, `#/deals/:id`, `#/settings`, `#/importexport`, `#/brands`) | ROUTE (redirect to `#/portal`) | §35 |
| RV-03 | CL | find `CANARY-INTERNAL` anywhere in portal DOM, client drawer, client report DOM or print | DOM + PRINT | §3.4, §31, §65 |
| RV-04 | CL | find `CANARY-COMMISSION`, the word "commission", or any `deal.commission` key | DOM + VM + PRINT | §38, §65 |
| RV-05 | CL | find `CANARY-RESTRICTED` or any comment with `visibility = restricted` / `internal` | DOM + VM | §29, §31 |
| RV-06 | CL | see `commercialTerms`, `leasingTerms`, `salesTerms`, `probability`, `nextAction`, `lostReason`, `ownership`, `responsibility` keys | VM (key absent in stringified view model) | §3.4, D7 |
| RV-07 | CL | see the name of any brand on a non-approved deal (prospect names) or of a `restricted` brand on a signed unit | DOM + VM | §31 "restricted brand data" |
| RV-08 | CL | see any contact, phone, email or `CANARY-CONTACT` | DOM + VM | §37 "restricted contacts" |
| RV-09 | CL | see a document with `visibility` `internal` or `restricted`, or download it | DOM + VM + click | §30, §65 |
| RV-10 | CL | see a raw internal status/stage label ("LOI", "Contract Draft", "Active Marketing") instead of a `clientStatus` | DOM (labels ⊆ configured client statuses ∪ availability groups) | §36 |
| RV-11 | CL | see another client's identity (`project.clientIds`, other client users, their comments' organisation) | VM | §31 "other clients" |
| RV-12 | CL | see tasks, activities, staff performance, data-hygiene or stale counts, weighted pipeline value | DOM + VM | §33, §37 |
| RV-13 | CL | create anything other than a comment; comment must be `client_visible` with `responseStatus = Open` | TOOL (`createTask` refused; `addComment` forced visibility) + DOM (no other write controls) | §29, §64 Flow 10 |
| RV-14 | CL | see an unapproved (draft) client report or any internal report | DOM + VM | §37 |
| RV-15 | CL | count a hidden (`internal`) unit in Total/Leased/Vacant GLA | VM (numeric equality with fixture) | §35, §65 "client KPIs use approved visibility rules" |
| RV-16 | XA | see units outside `user.projectIds` or units not in availability group `available` | DOM + VM | §31 external agent |
| RV-17 | XA | see other prospects on a unit, any deal not own, any `commercialTerms`, tenant names, manager names | DOM + VM | §11.3 |
| RV-18 | XA | open Brand Database, Companies, Reports, Settings, Import/Export, portal | ROUTE | §3.2 |
| RV-19 | XA | see contact phones/emails of contacts it did not create; see `CANARY-CONTACT` | DOM + VM | footnote 8 |
| RV-20 | XA | move a deal beyond Qualified; change a unit status; create a client-visible comment | TOOL + DOM | §11.3 |
| RV-21 | MG | see objects of non-assigned projects (`manager.sales` never sees `PROJ-001` units/deals/tasks) | DOM + VM + TOOL | §31 "assigned" |
| RV-22 | MG | see `deal.commission.*`, commission reports, commission filter, `CANARY-COMMISSION` (with `managerSeesOwnShare = false`) | DOM + VM + PRINT | §31, §38 |
| RV-23 | MG | change `ownership.responsibleManagerId`, open Settings, Import/Export, Users; see other managers' performance rows | ROUTE + DOM + TOOL | footnote 2, §3.2 |
| RV-24 | MG | see `restricted` comments where not author/responsible; see `restricted` contacts' phones/emails | DOM + VM | §4.2 |
| RV-25 | AD | see `deal.commission.*`, commission report sections, `CANARY-COMMISSION`; change a deal stage or terms; approve a client report | DOM + VM + TOOL | §31, footnote 3 and 13 |
| RV-26 | AD | edit Settings (save button absent; `updateSettings` tool refused); run JSON export/import, reset demo | DOM + TOOL | §3.3 |
| RV-27 | HL | edit users/roles, commission rules, currencies/units; run JSON import/reset; export full JSON | DOM + TOOL | A24, footnotes 11, 12, 14 |
| RV-28 | HL | be blocked from anything an FA sees except the items in RV-27 (positive control: HL sees `CANARY-COMMISSION` in Deal Detail) | DOM | §31 "permitted commissions" |
| RV-29 | FA | demote/deactivate the last active `founder_admin`; add a `restricted` field to a client whitelist; grant `client` any capability outside C32–C35 | DOM + service error | §12 G1–G8 |
| RV-30 | any | log in with an unknown demo code, an inactive user, or a client user without `clientId` | DOM (inline error, still on Login) | §1.2 |
| RV-31 | any | reach a blank screen from a denied route (denied screen must render with a link) | ROUTE + DOM | §63, §65 |
| RV-32 | any | find the word "password" or a security claim ("secure", "protected") in Login, README, portal or reports; banner text of §1.1 must be present on Login | DOM + STATIC | §6.1, §55 |
| RV-33 | preview | write a comment or download while `previewClientId` is set; preview DOM must equal the DOM of the real client session for the same project (snapshot diff) | DOM | §1.4 |
| RV-34 | portal code | `js/views/portal.js` references `appState` or `state.` | STATIC | §6 invariant 1 |
| RV-35 | tools | `LSP.runTool()` with a client session returns only whitelisted output for `getUnit`, `getProject`, `getVisibleDocuments`, `generateOwnerReport`; refuses `getDeal`, `getDealsByStage`, `calculatePipelineValue`, `createTask`, `searchContacts` | TOOL | D12, §51 "client AI must only use approved client data" |
| RV-36 | export | CSV export for MG/AD contains no commission columns; client CSV does not exist | file content | footnote 11 |

Positive controls (one per role) are also required so that a broken render does not pass the negative checks: each role must see at least one role-specific canary (`CANARY-INTERNAL` for MG/AD/HL/FA in the internal drawer, `CANARY-COMMISSION` for HL/FA, the client-visible demo document for CL/XA).

---

## 14. Assumptions and open questions

### 14.1 Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | UI strings through `t(key)`; English base, Russian dictionary (D3) | role labels in §2.1 need Uzbek strings later |
| A-2 | Demo users, clients and staff are fictional (D4) | demo user table §1.3 would be replaced by real logins |
| A-3 | Merchandise categories per D15 | affects the portal merchandise mix labels only |
| A-04-1 | User and client IDs are `USER-001` / `CLIENT-001` (D13 pattern) | rename in session shape and demo data |
| A-04-2 | `head_ls` and `administrator` also receive read-only portal preview | remove from C06 / screens 19–20 |
| A-04-3 | One `external_agent` stub demo user ships so RV-16…RV-20 can run | tests RV-16…RV-20 become future |
| A-04-4 | Tenant name reaches the client only when the unit `countsAs` leased or sold; agreed terms stay `internal` after signing unless a deal is approved as a key deal | whitelist and P5 mapping change |
| A-04-5 | A client user belongs to exactly one `clientId` | session shape gains `clientIds[]`; P2 becomes a union |
| A-04-6 | Client reports carry `approved` (boolean) set by FA/HL; only approved reports reach the portal | report entity in 03_DATA_MODEL.md must carry the field |
| A-04-7 | `manager` is `project_scope` without `own_only` | pipeline and unit screens for managers would shrink to own deals; more reassignment work for `head_ls` |
| A-04-8 | Demo data carries canary tokens in internal/restricted/commission/contact fields | §13 DOM/PRINT checks would need fixture-specific strings |

### 14.2 Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-04-1 | Is a read-only internal role (CASE OS `HM`, consulting manager / QC) needed in v0.1? | Not in v0.1; add `viewer` (global read, no restricted fields) in v0.2 if the consulting team needs LSP access; import `HM` users as inactive with a preview note | Founder / product sponsor |
| Q-04-2 | May the `administrator` move deal stages and edit commercial terms (CASE OS `HO` has `edit:true`)? | No in v0.1: stage and terms are manager/head responsibility; administrator edits next action, contacts, documents, activities. Revisit after the first month of use | Head of Leasing & Sales |
| Q-04-3 | Should managers see their own commission share (CASE OS `AG` "own KPIs and commissions")? | Ship the switch `commissions.managerSeesOwnShare = false`; the founder decides per team | Founder / product sponsor |
| Q-04-4 | Should units with `visibility = internal` be excluded from client totals (current rule) or should every unit of a client project be forced `client_visible`? | Keep the exclusion rule but default all units of a project with a client to `client_visible`; show an internal hygiene warning "n units hidden from client" | Head of Leasing & Sales |
| Q-04-5 | Which Settings sections may `head_ls` edit? | Per footnote 14: stages, lost reasons, categories, client status mapping, report/document visibility defaults, stale thresholds, notifications; not users, roles, commission rules, currencies/units, unit status definitions | Founder / product sponsor |
| Q-04-6 | Should a client comment be visible to all users of that client organisation or only to its author? | All users of the same `clientId` (an owner team shares one view) | Founder / product sponsor |
| Q-04-7 | Should portal preview be read-only or allow the internal user to post a reply as "CASE team"? | Read-only preview; replies are posted from the internal comment view where the author is correctly recorded | Head of Leasing & Sales |

### 14.3 Cross-references

- 01_PRODUCT_SPEC.md — role list in the product summary; 02_REQUIREMENTS_REVIEW.md — §6.1/§6.8 corrections and the CASE OS role/flag mismatch.
- 03_DATA_MODEL.md — authoritative field lists, `visibility` fields, `users`/`clients` entities, `report.approved`.
- 05_STATUSES_STAGES_AND_CONFIG.md — `clientStatus` mapping table, `availabilityGroup`, `countsAs`, `DEFAULT_CONFIG.roles` and `DEFAULT_CONFIG.visibility` schema.
- 06_FLOORPLAN_ARCHITECTURE.md — Availability mode for the external agent, client floor plan renderer fed by the view model.
- 07_CALCULATIONS_AND_KPI_RULES.md — `clientKpis()` formulas and denominators.
- 08_PERSISTENCE_IMPORT_EXPORT.md — role-filtered exports, settings validation on import, CASE OS role mapping in the adapter.
- 09_IMPLEMENTATION_PLAN.md — `can()`, `scopeOf()`, `clientView()`, `copyWhitelisted()` placement and build order.
- 10_QA_PLAN.md — tests for RV-01…RV-36 and the positive controls.
- 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md — tool registry permission flow, reserved future role keys, production RBAC migration.
