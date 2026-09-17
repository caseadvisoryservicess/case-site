# Requirements review: contradictions, risks, scope problems

**Purpose.** This document is the critical review demanded by `00_MASTER_PROMPT.md §6` and `§69 item 2`. It lists the contradictions found inside the master prompt, the conflicts between the master prompt and the existing CASE OS platform, the delivery risks, the features that are over-complex or premature for a validation prototype, the way each correction in §6.1–6.8 is applied in the design, and the decisions the founder must take before code is written. It is written for the founder (product sponsor) and for the engineers who implement the MVP: every contradiction ends in a resolution that the sibling documents (`03_DATA_MODEL.md`, `05_STATUSES_STAGES_AND_CONFIG.md`, `07_CALCULATIONS_AND_KPI_RULES.md`, …) follow, so an engineer can implement from this set without re-reading the master prompt.

Status: DRAFT for approval — 2026-09-17

Related documents: `README.md` (index, decision log), `01_PRODUCT_SPEC.md` (scope), `03_DATA_MODEL.md`, `04_ROLES_AND_VISIBILITY.md`, `05_STATUSES_STAGES_AND_CONFIG.md`, `06_FLOORPLAN_ARCHITECTURE.md`, `07_CALCULATIONS_AND_KPI_RULES.md`, `08_PERSISTENCE_IMPORT_EXPORT.md`, `09_IMPLEMENTATION_PLAN.md`, `10_QA_PLAN.md`, `11_REPOSITORY_AUDIT.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`.

---

## 1. Method

**Sources read in full.** `00_MASTER_PROMPT.md` (§1–§69, 3322 lines). CASE OS files used for verification: `os/core.js` (`STAT` at line 318, `SALESTAT` at line 2685, `CASECATS` at line 506, `ROLES` at line 295, `OBJECTS` demo at lines 308–311, `parsePlanLabels` at line 2548), `os/sql/schema_mysql.sql` (`deals` table lines 158–182, `deal_stage_probabilities`, `lease_commission_deals`, `UNIQUE KEY uq_unit (obj_id, code)`), `os/sw.js`, `os/.htaccess` (CSP), `HANDOFF_CASE_OS.md` (audit items P0-1, P1-3, deployment rules), `os/v417-master-plan.js`, `os/v4450-owner-report.js`, `docs/qa/tools/verify_full_qa.js`. The verified facts and the labeled decisions D1–D15 and assumptions A-1..A-3 are those of the context brief summarised in `README.md`.

**Classification used.**

| Prefix | Meaning | Where resolved |
|---|---|---|
| C-n | Contradiction or ambiguity inside the master prompt | Section 2 |
| X-n | Conflict between the master prompt and the existing CASE OS platform | Section 3 |
| R-n | Delivery, data or usage risk | Section 4 |
| T-n | Trim: feature reduced, made optional or deferred | Section 5 |
| D-n / A-n | Decision or assumption from the context brief (D1–D15, A-1..A-3) | `README.md` decision log |
| A-02-n | New assumption introduced by this document | Section 7.2 |
| Q-02-n | Open question raised by this document, with recommendation and owner | Section 7.3 |

**Scales.** Likelihood and impact: High / Medium / Low. Status values: *Resolved* (a decision D-n or a design rule in a sibling document settles it), *Proposed* (this document recommends a default that needs approval), *Open* (question Q-02-n).

**Reading rule for the master prompt.** Where two sections conflict, the section that states a principle (§3, §6, §34, §69) wins over the section that gives an example list (§12, §14.1, §36). Example lists are kept as vocabulary, not as data-model instructions.

**Owners.** Default decision owner: Founder / product sponsor. Operational owner: Head of Leasing & Sales. Technical owner: implementing engineer (referred to as "Engineering").

---

## 2. Contradictions inside the master prompt

| ID | Sections | Contradiction | Impact if implemented literally | Resolution adopted | Owner | Status |
|---|---|---|---|---|---|---|
| C-1 | §6.3, §12, §22, §23, §69 | §6.3 and §69 forbid one field for unit status and deal stage, but the §12 unit status list contains deal stages (Lead, Viewing, Negotiation, LOI, Contract Draft, Sale Negotiation) that also appear as pipeline stages in §22/§23. | The unit would store a stage, reproducing the CASE OS `STAT` conflation (X-1); multi-prospect units (§6.4) would be impossible to represent. | **D5.** `unit.commercialStatus` stores inventory states only (Vacant, Available, Active Marketing, Reserved, Contract Signed, Fit-out, Occupied, For Sale, Sold, Temporarily Blocked, Not Available, Unknown). The six stage-like values of §12 survive as config entries with `kind: 'derived'`: the display status shown on plans and tables is computed by `services` from the highest-ranked open deal when the unit is marketable and the deal is at or above the configured threshold. All 16 §12 labels remain visible; none is stored on the unit. Detailed in `05_STATUSES_STAGES_AND_CONFIG.md`. | Founder | Resolved (D5) |
| C-2 | §2, §5, §63, §67 | §2 says the product is "not merely a CRM", yet 10 of the 22 required screens (§63) and 8 of the 35 scope items (§5) are CRM screens. | The MVP drifts into a CRM with a floor plan attached; the plan (§13 "critical acceptance feature") becomes a secondary view. | The primary navigation axis is Project → Floor plan → Unit drawer (§3.2, §13); CRM screens are reached from the drawer and from the CRM menu. Build order follows §67 (data model, login, projects/units, floor plan, statuses, pipelines, then CRM). Acceptance for each phase in `09_IMPLEMENTATION_PLAN.md` starts from the plan, not from a list screen. | Founder | Resolved (design) |
| C-3 | §36, §6.3, §12 | The §36 client mapping is keyed on "Internal status" but mixes deal stages (Lead … Contract Draft) with unit statuses (Contract Signed, Available, Sold). | A single mapping keyed on one stored field cannot exist once stage and status are separate fields (C-1). | One mapping table over the config status entries (inventory + derived), i.e. over the **display status** of D5. Each entry carries `clientStatus` (Available, Interest, In Negotiation, Contracting, Leased, Sold, Not Available). The portal reads `clientStatus` of the display status; it never reads deal records. Editable in Settings. `05_STATUSES_STAGES_AND_CONFIG.md`, `04_ROLES_AND_VISIBILITY.md`. | Head of Leasing & Sales | Resolved (D5 + design) |
| C-4 | §22, §23, §6.6, §24, §38 | Commission state lives in three places: pipeline stages 13–14 (Commission Pending / Received), `deal.outcome.commissionStatus` (§24) and the commission record `status` (§38). §6.6 says completion must be configurable, §22 says a deal is not complete until commission conditions are met "unless configured otherwise". | Hidden state and double bookkeeping; a signed deal parked at stage 13 still counts as open pipeline, inflating pipeline GLA. | Stages stay as listed (configurable). Each stage carries `stageGroup: 'early' / 'active' / 'post_signing' / 'closed'`; post-signing stages are excluded from "under negotiation" metrics (D6). The commission record on the deal is the single source of commission status; `outcome.commissionStatus` is derived from it. Config `commission.completionRule` ∈ {`contract_signed`, `payment_completed`, `commission_received`} decides when the deal counts as financially complete; recommended default `commission_received` (Q-02-2). | Founder | Proposed default |
| C-5 | §27, §28, §15, §29, §30 | Activity types in §28 include "stage change", "status change", "task completed", "document uploaded", "client comment", "internal comment", which are already recorded by `statusHistory`, `tasks`, `documents` and `comments`. | Every event would be written twice; timelines would show duplicates or drift. | `activities` stores manually created interactions only (call, meeting, viewing, email note, messenger note, proposal sent, client decision) as §28 allows ("may be manually created"). The timeline (§15, §28) is a computed merge: activities + `statusHistory` + `comments` + `documents` + `tasks(completedAt)` + deal stage history, each item labeled with its source. One writer per event, in `js/services.js`. `03_DATA_MODEL.md`. | Engineering | Resolved (design) |
| C-6 | §7, §15, §21, §24, §64 Flow 5 | Four words for overlapping concepts: "requirement", "lead", "opportunity", "deal", plus the drawer action "add prospect" (§15). | Risk of four entities for one concept, or of a `prospects` table beside `deals`. | One entity `deals` (stage Lead … Closed). "Opportunity" = a deal at an early stage; "prospect" = a deal seen from a unit; "Add prospect" in the drawer creates a deal pre-filled with `unitIds: [unit.id]`. `requirements` is a separate, minimal record on a brand or company (T-6) describing what is sought before a unit exists (§21). "Create opportunity" in Flow 5 creates a deal. `03_DATA_MODEL.md`. | Engineering | Resolved (design) |
| C-7 | §62, §63, §8, §44 | §62 prefers "one main HTML file", while §63 requires 22 screens, §8 twenty entity collections and §44 fifteen configurable areas. CASE OS shows the cost of the single-file route (`core.js`, 976 KB). | A single file is unreviewable and untestable in Node; the CASE OS maintenance problem is repeated. | **D2.** A small clean file structure (§62 second option): `index.html` + `css/lsp.css` + `js/config.js, state.js, services.js, tools.js, ui.js, floorplan.js, views/*.js` + `data/demo.js, i18n.js`, loaded by `<script src>`, no build step. | Engineering | Resolved (D2) |
| C-8 | §47, §4, §51 | §47 requires demo data that is "clearly labeled" and not presented as real company or client data; §4 names real staff (Nodir Mahmudxojizoda, Beksulton Shaxriddinov) and §51 gives "Create a follow-up list for Nodir" as an example. | Demo users with real names attached to fictional deals produce screenshots and exports that look like real records. | **D4 / A-2.** Demo users are fictional and role-named; real staff are added in Settings by the team. Real names appear in planning documents only as role holders. | Founder | Proposed (A-2) |
| C-9 | §48, §14 | §48 supports light/dark mode "only if color-coded floor plans remain readable"; §14 requires legends and non-color indicators. | Two themes double the palette QA for five plan modes. | Dark mode changes the application chrome only; the plan canvas keeps a fixed light background and status colors are defined once in config (`color`, `textColor`, `pattern`) and validated for contrast against the plan background. If any status fails the contrast check in QA, dark mode ships with the plan canvas forced light (Q-02-7). `06_FLOORPLAN_ARCHITECTURE.md`, `10_QA_PLAN.md`. | Engineering | Resolved (design, fallback defined) |
| C-10 | §6.7, §16 | §16 says "do not fake this functionality" and, two paragraphs later, "if vector text extraction is feasible, it may suggest unit matches". CASE OS already binds plans by `<text>` labels. | Ambiguity about what recognition is allowed. | **D8.** Text-label matching is one wizard step labeled EXPERIMENTAL; it only *suggests* mappings that the user confirms per polygon. Raster, PDF, CAD and BIM detection are not offered; the wizard shows them as "future" without a button. No OCR/CV claim anywhere. | Engineering | Resolved (D8) |
| C-11 | §34, §12, §33 | §34 computes leased GLA from units "whose approved current status qualifies as leased", while §12 makes statuses editable in Settings, so a user can rename or add statuses and the meaning of "leased" is lost. | KPIs silently break after a Settings change. | **D5 / D6.** Every status entry carries `countsAs` (`vacant`, `leased`, `sold`, `unavailable`, `pipeline`) and `availabilityGroup`; formulas read these attributes, never labels or keys. Settings validation: every status has `countsAs`; at least one status counts as `leased`; a status in use cannot be deleted without reassignment. `07_CALCULATIONS_AND_KPI_RULES.md`. | Engineering | Resolved (D5, D6) |
| C-12 | §14, §14.1, §14.5 | §14 forbids mixing unrelated meanings in one color system, but §14.1 itself lists a mixed set (available, active marketing, in process, negotiation, signed/leased, sold, blocked) and D5's display status shows a deal stage on the unit. | Legends that mix stage and status hues; users cannot tell inventory from pipeline. | Rule: one mode = one attribute. Status mode colors the display status, with derived (stage) entries drawn in one hue family per `availabilityGroup` and a distinct pattern for "pipeline (from deals)". Availability mode (§14.5) colors `availabilityGroup` only (4 values). Merchandise mix colors category; Target vs Actual colors gap class; Manager colors `responsibleManagerId`. Legends are generated from config per mode. `06_FLOORPLAN_ARCHITECTURE.md`. | Engineering | Resolved (design) |
| C-13 | §42, §65 | §42 asks for CSV import "where practical" over 13 data areas; §65 accepts "CSV export works where implemented". | Open-ended import matrix for nested objects (deals with unit arrays, activities). | **D9.** CSV export for all major tables; CSV import for brands, companies, contacts and units only, with column mapping preview. All other areas through JSON import. `08_PERSISTENCE_IMPORT_EXPORT.md`. | Engineering | Resolved (D9) |
| C-14 | §9, §33, §34, §35 | The project schema stores declared `areas.glaM2`; §33–§35 compute total GLA from units. Two "total GLA" numbers can differ. | Percentages with an unclear denominator; client reports contradict internal reports. | **D6.** All percentages use GLA from units and show the denominator; the project field is displayed as "declared GLA" beside it and flagged when it differs by more than a configurable tolerance. Never substituted silently. | Engineering | Resolved (D6) |
| C-15 | §31, §38 | Head of Leasing & Sales sees "permitted commissions", the founder sees "financial and commission information", §38 has shares per manager/agent/administrator; "permitted" is undefined. | Either everyone internal sees all shares or the field is hidden from the person who needs it. | Config `commission.visibility` per role: `founder_admin` all fields; `head_ls` gross, company share and status; `manager` own `managerShare` and status; `administrator` status only; `client` nothing (§38). Proposed default, editable in Settings. `04_ROLES_AND_VISIBILITY.md`. | Founder | Proposed (Q-02-4) |
| C-16 | §7, §23, §24 | §7 speaks of "Brand / Buyer"; the deal schema (§24) has a single `brandId` and `companyId`. A sales buyer is often an individual or an investor company, not a brand. | Sales deals forced to carry a fake brand. | For `type: 'Sales'` the counterparty is `companyId` and/or `contactIds`; `brandId` is optional. `services.dealCounterpartyName(deal)` resolves brand → company → first contact. Validation: a deal needs at least one counterparty. `03_DATA_MODEL.md`. | Engineering | Resolved (design) |
| C-17 | §6.1, §32, §64 Flow 1 | §6.1 forbids real passwords; §32 and Flow 1 ask the user to "enter demo credentials" and press Enter. | Engineers add a password field with a fake password, which readers then mistake for security. | Login = choose or type a demo username; Enter submits; no password field; the exact §6.1 warning text is shown on the login screen, in the application footer and on the portal. `04_ROLES_AND_VISIBILITY.md`. | Engineering | Resolved (design) |
| C-18 | §24, §6.5, §9 | A deal has one `projectId` but `unitIds[]`; nothing prevents units of two projects in one deal. | Project dashboards attribute the same deal to two projects or to none. | Validation rule: all `unitIds` of a deal belong to `deal.projectId`; the UI filters unit pickers by project. Cross-project requirements are expressed through `requirements.targetProjects`, not through one deal. `03_DATA_MODEL.md`. | Engineering | Resolved (design) |

### 2.1 Rules that follow from C-1, C-3, C-4, C-5 and C-12

These rules are the normative reading of the contradictions above. `05_STATUSES_STAGES_AND_CONFIG.md` carries the full config schema; `07_CALCULATIONS_AND_KPI_RULES.md` carries the formulas.

**Display status (C-1).** Computed by `services`, never stored. `marketable` is a boolean attribute on each status entry added by this review (true for Available, Active Marketing, For Sale). Two thresholds exist because D5 (what the plan shows) and D6 (what counts as "under negotiation") answer different questions:

```text
displayStatus(unit):
  inv  = config.unitStatuses[unit.commercialStatus]
  if not inv.marketable: return inv                       // Vacant, Reserved, Contract Signed, Fit-out, Occupied,
                                                          // Sold, Temporarily Blocked, Not Available, Unknown
  open = deals where status == 'Open' and unit.id in unitIds
  best = the open deal with the highest stage rank in its pipeline
  if best is null: return inv
  if rank(best.stage) < config.pipeline[best.type].displayStageThreshold: return inv
  return config.unitStatuses[ stage.derivedStatus ]       // one of: Lead, Viewing, Negotiation, LOI,
                                                          // Contract Draft, Sale Negotiation
```

Default `derivedStatus` per stage: leasing Lead / Contacted / Qualified / Requirement Confirmed → `Lead`; Property / Unit Offered / Viewing Scheduled / Viewing Completed → `Viewing`; Negotiation → `Negotiation`; LOI / Commercial Terms → `LOI`; Contract Draft → `Contract Draft`; sales Property / Unit Offered / Viewing → `Viewing`; Offer / Negotiation / Reservation / Deposit → `Sale Negotiation`. Post-signing and closed stages have no derived status: a marketable unit with a deal at Contract Signed or later is reported under Data hygiene as "inconsistent unit status" (§33) instead of being recolored. Defaults: `displayStageThreshold` = Property / Unit Offered (both pipelines); `negotiationStageThreshold` = Negotiation (leasing), Offer (sales) — Q-02-1. D5 adds Reserved and Fit-out to the §12 inventory list; both are inventory states (Reserved counts as under negotiation, Fit-out counts as leased, D6).

**Stage groups (C-4).** Each stage carries `group`; only `active` stages feed "under negotiation" and the weighted pipeline value; `post_signing` stages feed "signed deals" and commission reports; `closed` stages are terminal.

| Pipeline | early | active | post_signing | closed |
|---|---|---|---|---|
| Leasing (§22) | Lead, Contacted, Qualified, Requirement Confirmed | Property / Unit Offered, Viewing Scheduled, Viewing Completed, Negotiation, LOI / Commercial Terms, Contract Draft | Contract Signed, Tenant Handover / Opening Preparation, Commission Pending, Commission Received | Closed Won, Closed Lost |
| Sales (§23) | Lead, Contacted, Qualified Buyer, Requirement Confirmed | Property / Unit Offered, Viewing, Offer, Negotiation, Reservation / Deposit | Contract, Payment In Progress, Payment Completed, Commission Pending, Commission Received | Closed Won, Closed Lost |

Closed Lost requires `outcome.lostReason` from the configurable list (§22); moving to Closed Won is allowed only when `services.isDealFinanciallyComplete(deal)` is true under `config.commission.completionRule`, or when `requiredForClosedWon` is false.

**Client status mapping defaults (C-3).** One table over the display-status entries; editable in Settings.

| Display status (kind) | clientStatus | Display status (kind) | clientStatus |
|---|---|---|---|
| Vacant (inventory) | Available | Sold (inventory) | Sold |
| Available (inventory) | Available | Temporarily Blocked (inventory) | Not Available |
| Active Marketing (inventory) | Available | Not Available (inventory) | Not Available |
| For Sale (inventory) | Available | Unknown (inventory) | Not Available |
| Reserved (inventory) | In Negotiation | Lead (derived) | Interest |
| Contract Signed (inventory) | Leased | Viewing (derived) | Interest |
| Fit-out (inventory) | Leased | Negotiation (derived) | In Negotiation |
| Occupied (inventory) | Leased | LOI (derived) | In Negotiation |
| — | — | Contract Draft (derived) | Contracting |
| — | — | Sale Negotiation (derived) | In Negotiation |

**Timeline composition (C-5).** `services.timeline(entityType, id)` merges, sorts by timestamp and labels the source; nothing is written twice.

| Source collection | Items shown | Written by |
|---|---|---|
| `activities` | call, meeting, viewing, email note, messenger note, proposal sent, client decision | user, through `services.addActivity()` |
| `statusHistory` | unit status changes and deal stage changes (`entityType: 'unit'` or `'deal'`) | `services.setUnitStatus()`, `services.setDealStage()` only |
| `comments` | internal notes, client-visible notes, client comments with response status | `services.addComment()` |
| `documents` | registration events (`uploadedAt`) and version changes | `services.registerDocument()` |
| `tasks` | creation and completion (`createdAt`, `completedAt`) | `services.createTask()`, `services.completeTask()` |

**One mode, one attribute (C-12).**

| Plan mode (§14) | Attribute colored | Legend source | Non-color indicator |
|---|---|---|---|
| Leasing / Sales status | display status | config status entries, grouped by `availabilityGroup`; derived entries under "Pipeline (from deals)" | `pattern` per entry; hatched outline for derived entries |
| Merchandise mix | `actualUse.category` (or `targetUse.category` when no tenant, drawn hatched) | config categories | category code label in the polygon |
| Target vs Actual | gap class: match, deviation, target only, actual only, no target | fixed 5-value legend | icon glyph per class |
| Manager | `responsibility.responsibleManagerId` | users with assigned units | initials label |
| Availability | `availabilityGroup` (available, in_process, occupied_or_sold, unavailable) | fixed 4-value legend | `pattern` per group |

---

## 3. Conflicts with the existing CASE OS

All resolutions in this section follow **D1**: LSP is a self-contained module under `os/leasing/` with its own data model, no change to CASE OS files, and an import adapter for `CASE_OS_backup_*.json`. The last column states what must be true when LSP is folded back into the production platform.

| ID | CASE OS fact (verified) | Master prompt requirement | Resolution under D1 (v0.1) | Must be true at fold-back |
|---|---|---|---|---|
| X-1 | `STAT` (`os/core.js` line 318) = vac / neg / off / os / cs / cd / res: one `units.status` field mixes inventory and stage. SQL `deals.stage` uses the same keys; `deal_stage_probabilities` seed neg 20, off 40, res 35, os 65, cs 85, cd 100. | §6.3, §12, §69: separate fields. | LSP model per D5. Import adapter split rule: `vac` → Vacant; `res` → Reserved; `neg` / `off` / `os` / `cs` → Available + one open deal at Negotiation / Property-Unit Offered / LOI / Contract Draft with the CASE OS `vars[0]` as brand; `cd` → Contract Signed + one deal at Contract Signed. Stage probabilities imported as deal `probability`. `03_DATA_MODEL.md`. | `units.status` restricted to inventory values; stage lives on `deals` only; a migration rewrites existing rows with the same split rule. Core refactor, out of MVP scope. |
| X-2 | SQL `deals.unit_id BIGINT NULL`, `unit_code VARCHAR(120)`: one deal, one unit. | §6.5: a deal may link several units. | `deal.unitIds[]` in LSP. Import: one CASE OS deal → one LSP deal with one unit. LSP multi-unit deals have no CASE OS representation. | Join table `deal_units (deal_id, unit_id)` and a `deals.area_override` column; `deal_actions` keep working per deal. |
| X-3 | `contacts` table holds document contacts only (`name, title, phone, email`); brand contact is inline (`BRANDS.person / phone / email`); holding company is a free-text `group`. | §19, §20: central company and contact databases. | LSP `companies` and `contacts` tables. Import: `BRANDS.person/phone/email` → one `CONT-` record linked to the brand; distinct `BRANDS.group` values → `COMP-` records; brands with the same `group` share the company. Duplicate warnings run after import. | New tables `companies`, `contacts`, `brand_contacts`, `company_brands`; `BRANDS.group` becomes a foreign key. |
| X-4 | `CASECATS` (`os/core.js` line 506): 17 Russian categories ('Мода и стиль', 'Места общественного питания', 'Супермаркет / гипермаркет', 'Офисы', …) plus `CATSUBS` and an admin-editable taxonomy. | §14.2, §17: English category list; categories editable. | **D15 / A-3.** LSP defaults = master prompt list + Home & Interior, Sports, Kids & Education, Health/Pharmacy, Anchor Supermarket. Import adapter maps CASECATS → LSP categories through an editable mapping table; unmapped values go to Other and are counted in the import preview. | One shared taxonomy with stable `code` and RU/EN/UZ labels used by both systems; either side's list is a label set over the same codes. |
| X-5 | UI is Russian-first (`LANG`, `t()`), RU/UZ/EN dictionaries; repository documents are in Russian. | Master prompt and glossary in English. | **D3 / A-1.** LSP `t()` from day one, EN base + RU shipped, Uzbek later (T-8); planning documents in English, README with RU summary. | Shared glossary of terms (GLA, GBA, LOI, Vacant = Вакант …); dictionary keys need not match. |
| X-6 | Manual deployment: the `os/` zip is uploaded by hand; the FTP workflow is not relied upon. CSP in `os/.htaccess`: `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src … https://fonts.gstatic.com; connect-src 'self' https:`. | §62: opens directly in a browser; §55: no secrets. | LSP uses no CDN and no runtime dependency (D1); Google Fonts with system fallback is the only external source and is already allowed. Inline scripts and styles are allowed by the CSP, so nothing blocks. LSP ships inside the normal `os/` zip (D11). | If the CSP is ever tightened (nonce-based), LSP must already avoid inline handlers; the plan is to use `addEventListener` only, never `onclick=` attributes (R-12). |
| X-7 | `os/sw.js`: scope `/os/`, cache `case-os-v4510`, network-first; for failed navigation requests it returns CASE OS `./index.html` (line 35) and caches any response under scope (line 31). | §62, §46: predictable local startup. | A browser that has visited CASE OS has a service worker controlling `/os/leasing/` too. Online: network-first, fresh LSP files load. Offline: navigation to `/os/leasing/` shows CASE OS instead of LSP. Accepted for v0.1 and documented in `README.md` (R-17). | Either add LSP files to the SW `ASSETS` list (offline support) or exclude `/os/leasing/` from the fetch handler; both are CASE OS changes, made with a normal CASE OS release. |
| X-8 | Audit item P1-3 (`HANDOFF_CASE_OS.md`): three parallel plan routes (`plans`, `project_layouts` / `leasing_layouts`, `plan_master`) confused users; consolidated in v4.35.0 / v4.37.0 into `plan_master` ("Версии планировок"). `bindSvgPlan()` binds by `id` = unit code or `<text>` labels; `os/zarafshan-l2.svg` has 994 `<path>`, 64 `<text>` and no unit polygons with ids. Layout versions carry an immutable snapshot (P0-1). | §13, §16: true clickable polygons, versioned plans, mapping wizard. | LSP adds its own SVG engine (`js/floorplan.js`) — a fourth plan implementation. Accepted only because LSP is not linked from CASE OS navigation and is labeled prototype. The LSP `floorPlans` record (versioned, `current`, `archived`, `polygonMappings` on the version) is designed to be compatible with the P0-1 immutable-snapshot idea. Import of `PLANSVG` uses text-label binding and is marked experimental. | One plan engine. Either `js/floorplan.js` replaces the binder in `v417-master-plan.js` or LSP is retired. Real CAD exports need polygon authoring: the wizard's manual polygon step is the migration tool. |
| X-9 | CASE OS demo `OBJECTS` are real projects with real terms: Creative Avenue (comm '2% сделка + 2% этаж + 2% здание'), Zarafshan Mall, Gulistan (Bukhara), Mega House; real broker names; `os/data/case_brands_base.xlsx` is the proprietary brand base. | §47: demo data must not be presented as real company or client data. | **D4.** LSP demo is fictional (Demo City Mall, Demo Business Park). The CASE OS import adapter is for local testing by the team with their own backup; a state that contains imported real data must never be committed or hosted as demo (R-4, A-02-3). | The CASE OS demo set is classified as real data and handled as such in every environment. |
| X-10 | Owner report `v4450-owner-report.js`: snapshot-based, profiles owner/internal, tabs summary / areas / brands / refusals / plan / quality / versions, print. No client login; owners receive generated files. | §35, §37: client portal with login, comments and a report generator with "changes since previous report". | LSP report builder in `js/services.js` computes the same section families from the LSP model and stores report snapshots (`RPT-`); "changes since previous report" = diff of stored snapshot vs current. Portal is the delivery channel. Two generators coexist in v0.1. | One report model: the portal delivers v4450-class reports; section builders shared; snapshots stored once. |
| X-11 | Commission engines `v326`, `v496`, SQL `lease_commission_deals` (tenant, area, rate, `signed_date`, `ash_confirmed`, agent splits, tiered rules, ledgers), finance-only visibility. | §38: configurable internal commission model with shares and status. | LSP commission = one minimal record per deal (§38 fields) with configurable completion rule and visibility (C-4, C-15). No ledgers, no tiered rules (T-12). | The LSP record maps onto `lease_commission_deals`; the CASE OS engine remains the finance source of truth; LSP never becomes a second ledger. |
| X-12 | IDs: `OBJECTS.id` short codes ('ca'), `U.id` 'u12', SQL BIGINT keys, unit codes unique per object (`uq_unit`). | §7, §49: stable prefixed IDs (`PROJ-001`, `UNIT-001`, future `PROP-UZ-TAS-000123`). | **D13.** LSP IDs with `externalIds: {caseOsObjectId, caseOsUnitCode, propertyId, geoMasterId}`. Import is idempotent on `externalIds` (re-import updates, never duplicates). | A `public_id` column per table or a mapping table; LSP IDs become the ecosystem IDs (§49). |
| X-13 | Roles ASH, ADM, BA, AG, AGX, HO, BSH, HM, CFO, BRJ with flags `leasing, finance, edit, approve, plans, own_only, project_scope, admin`; per-role workspaces. | §31: six roles including Client. | **D7.** ASH/ADM → `founder_admin`, BA → `head_ls`, AG → `manager`, HO → `administrator`, AGX → `external_agent` (stub, T-7), `client` new. BSH, HM, CFO, BRJ have no LSP counterpart in v0.1. | Every LSP capability is expressible as a CASE OS flag set; `client` becomes a new role with `project_scope` and a field whitelist enforced server-side. |
| X-14 | Both applications run on the same origin (`caseadvisory.uz`) and share one localStorage budget: CASE OS demo state `asaas-os-demo-state-v7` and LSP `caseos-lsp-state-v1` (+ backup slot). | §46: localStorage persistence. | **D9** quota guard (warn above 4 MB) measured on the LSP keys; README explains that CASE OS demo data on the same origin shares the budget (R-1, A-02-2). | Production storage is server-side; localStorage keeps UI preferences only. |
| X-15 | SCR sales module (`sales_assets`, `sales_buyers`, `investor_requests`, `SALESTAT` savail / sresv / sdeal / ssold) is separate from leasing units. | §23: leasing and sales on the same unit; a unit is leasing only, sales only or both. | LSP units carry `commercialMode` (leasing / sales / both); sales deals link the same units. SCR sales assets are not imported in v0.1 (Q-02-6). | Decide whether `sales_assets` fold into `units` with a mode flag or stay a separate registry mapped by `externalIds`. |

### 3.1 Import adapter split rule for `units.status` (X-1)

Applied by the `CASE_OS_backup_*.json` adapter (`08_PERSISTENCE_IMPORT_EXPORT.md`). The CASE OS candidate list `vars[0]` becomes the deal's brand (matched by name to the imported `BRANDS`, otherwise created). Probabilities come from the CASE OS `deal_stage_probabilities` seed.

| `STAT` key | CASE OS label | LSP `commercialStatus` | Open deal created | Deal stage | Probability | Note |
|---|---|---|---|---|---|---|
| `vac` | Вакант | Vacant | no | — | — | — |
| `neg` | Переговоры | Available | yes, if `vars` not empty | Negotiation | 20 | CASE OS ranks `neg` below `off`; LSP ranks Negotiation above Property / Unit Offered. The import preview lists these units for review. |
| `off` | Предложено | Available | yes | Property / Unit Offered | 40 | — |
| `os` | Предложение подписано | Available | yes | LOI / Commercial Terms | 65 | — |
| `cs` | Контракт на подписании | Available | yes | Contract Draft | 85 | — |
| `cd` | Контракт подписан | Contract Signed | yes, `status: 'Won'` | Contract Signed | 100 | `actualUse.tenantName` = `vars[0]` |
| `res` | Резерв | Reserved | yes, if `vars` not empty | Negotiation | 35 | Reserved counts as under negotiation (D6) |

Units with several candidates in `vars` produce one open deal per candidate (multi-prospect unit). `floor` and `merged` derive `FLOOR-` and multi-unit hints; `PLANSVG` keys `objId::block::floor` derive `BLDG-` and `PLAN-` records with text-label mappings marked experimental.

### 3.2 Fold-back checklist (what must be true before LSP data or code re-enters CASE OS)

1. Decision taken at the end of the validation window (A-02-4): extend CASE OS, continue LSP toward its own backend, or stop.
2. `units.status` split into inventory status and deal stage with a migration following the rule in 3.1 (X-1).
3. `deal_units` join table and `deals.area_override` exist (X-2).
4. `companies`, `contacts` and link tables exist; `BRANDS.group` becomes a foreign key (X-3).
5. One merchandise taxonomy with stable codes and RU/EN/UZ labels (X-4).
6. Roles: `client` role with project scope and a server-side field whitelist; LSP capabilities expressed as CASE OS flags (X-13).
7. One plan engine and one plan route; versioned plans keep the P0-1 immutable snapshot (X-8).
8. One report model delivered through the portal (X-10); commission records mapped to `lease_commission_deals` without a second ledger (X-11).
9. `public_id` or mapping table so LSP IDs become ecosystem IDs (X-12).
10. `os/sw.js` either lists LSP assets or excludes `/os/leasing/` (X-7); CSP unchanged or tightened with LSP already compliant (X-6).
11. CASE OS demo dataset reclassified as real data or replaced by fictional data (X-9).
12. Server-side authorization, session management and file storage replace the prototype login and object URLs (§55); no LSP localStorage state is migrated automatically.

---

## 4. Risk register

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Phase |
|---|---|---|---|---|---|---|
| R-1 | localStorage quota (typically 5–10 MB per origin, shared with CASE OS demo state, X-14). SVG plan text is the main size driver; one CAD export can exceed 1 MB. | High | High | D9 quota guard: warn above 4 MB, block the save with a clear message and an export offer above the browser limit. Embedded demo plans are referenced (`source: 'embedded'`), not copied into state. Imported SVG is sanitized and minified (comments, metadata, whitespace removed). IndexedDB deferred (T-4). Backup slot written before each successful save. | Engineering | state.js (phase 1) |
| R-2 | XSS through uploaded SVG plans: `<script>`, `on*` attributes, `<foreignObject>`, `<use>`/`<image>` with external or `javascript:` hrefs. The CSP allows `'unsafe-inline'`, so it does not protect. | Medium | High | Parse with `DOMParser` (`image/svg+xml`), allow-list elements (`svg g path polygon rect circle ellipse line polyline text tspan title desc defs clipPath`) and attributes (geometry, `id`, `class`, `data-*`, presentation attributes); drop everything else; allow `href` only when it starts with `#`. Store and render the sanitized text only. A malicious sample SVG is a named QA test. | Engineering | floorplan.js |
| R-3 | `file://` limits: no `fetch()`, no service worker, browser-specific localStorage behaviour (Firefox isolates file origins; Safari may block storage). | Medium | Medium | D2: all assets via `<script src>`, demo plans embedded as strings. README names Chrome/Edge as the file:// targets and hosting (or any static server) as the recommended path (A-02-1). Startup check shows a readable message if storage is unavailable instead of a blank app. | Engineering | phase 0 |
| R-4 | Prototype authentication misuse: a link to `/os/leasing/` with role picker and a client portal is treated as a secure client-facing product; real data is entered. | Medium | High | §6.1 warning on login, footer and portal; README; LSP not linked from CASE OS navigation (D1); no real client data in the hosted demo (D4, A-02-3); founder decides hosted vs local-only placement (Q-02-8). | Founder | phase 0, release |
| R-5 | Data divergence: the team starts recording real deals in LSP while CASE OS remains the production record — two sources of truth, the opposite of §3.1. | High | High | LSP labeled validation prototype; usage rule: operational data stays in CASE OS until the fold-back decision; CASE OS backup import is one-way and repeatable; validation window time-boxed with a decision gate (A-02-4, Q-02-5). | Founder, Head of Leasing & Sales | validation |
| R-6 | Scope creep toward ERP (rent roll, payments, FM, work orders, §3.6, §50). | High | Medium | Scope fence in `01_PRODUCT_SPEC.md`; change requests recorded in a backlog with §50 labels; extension points documented in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` without implementation. | Founder | all |
| R-7 | Mobile floor plan usability at 390 px: polygons too small, pan/zoom conflicts with page scroll. | High | Medium | §48 rule respected: narrow screens get the unit list + drawer (D8); the plan remains available read-only with pinch zoom behind a "show plan" action; QA at 390×844 and 820×1180 (D10). | Engineering | floorplan.js, ui.js |
| R-8 | Print fidelity: SVG plans and inline charts clipped, dark theme printed, page breaks inside tables. | Medium | Medium | Print stylesheet forces the light palette, hides navigation, sets plan width to page width, `break-inside: avoid` on cards and table rows; Playwright print-media screenshots per report in `10_QA_PLAN.md`. | Engineering | reports |
| R-9 | i18n effort: two dictionaries across 22 screens; config labels (statuses, stages, categories) are data, not dictionary keys. | Medium | Medium | `t()` from day one with a key convention (`view.element.text`); config entries carry `label` (EN) and optional `labelRu`; missing keys fall back to EN and are listed by a dev report; Uzbek later (T-8). | Engineering | ui.js, i18n.js |
| R-10 | Demo realism: fictional data that is too artificial gives no validation signal; too real violates §47. | Medium | Medium | Demo built from realistic ranges (unit areas 25–2,500 m², rents in USD/m²/month typical for Tashkent-type malls, categories per D15) and containing every required edge case (multi-prospect unit, multi-unit deal, overdue tasks, stale deals, unit without area, unmapped polygon). Reviewed by the Head of Leasing & Sales before release. | Head of Leasing & Sales | demo.js |
| R-11 | Team adoption and founder dependency (§4): only the founder tests; feedback never reaches the plan. | Medium | High | Role-based demo users; RU summary in README; a validation checklist per role derived from §64 flows; feedback captured as Q items in `README.md`; an onboarding session with the Head of Leasing & Sales. | Founder | validation |
| R-12 | CSP violations on hosting: something works from `file://` but is blocked under `os/.htaccess` (external script, `eval` in a library, inline handler under a future nonce policy). | Medium | Medium | No CDN, no library; `addEventListener` only; a QA script serves LSP with the production CSP header and asserts zero CSP console reports (`10_QA_PLAN.md`). | Engineering | QA |
| R-13 | Browser support: newer CSS/JS features (CSS nesting, `<dialog>`, `structuredClone`) fail on older browsers used by the team. | Low | Medium | Target last two versions of Chrome, Edge, Firefox, Safari; avoid CSS nesting and `<dialog>`; feature-check storage and `DOMParser`; README lists supported browsers. | Engineering | all |
| R-14 | Loss of local data: one browser profile, cleared site data, incognito, another device. | High | Medium | Backup slot, `beforeunload` guard, Saving / Saved / Unsaved indicator, dashboard reminder when the last export is older than 7 days, one-click JSON export (D9). Documented as a prototype limit. | Engineering | state.js |
| R-15 | Performance: re-parsing the SVG on every state change with 50+ units × 5 modes, plus tables and search. | Medium | Medium | Compute a per-unit view model once per render; mode switches update `fill`, `class` and `data-*` attributes in place; search debounced; budget: mode switch under 100 ms at 200 units, verified by a timed QA check. | Engineering | floorplan.js |
| R-16 | Duplicate detection false positives ("Nike" vs "Nike Kids", shared office phone numbers) annoy users or, worse, block entry. | Medium | Low | Warnings only, never blocking (§5 item 30); rules: normalized exact name, identical normalized phone or email; the user can mark "not a duplicate" (`duplicateChecks.dismissed[]` on the record); thresholds in config. | Engineering | services.js |
| R-17 | CASE OS service worker interference (X-7): offline navigation to `/os/leasing/` shows CASE OS; LSP files cached in the CASE OS cache. | Medium | Low | Network-first keeps online use correct; README documents the offline limit; fold-back adds LSP assets to `sw.js` or excludes the path. | Engineering | release |
| R-18 | Derived display status confusion (D5): users see "Negotiation" on the plan and look for it in the unit status dropdown. | High | Medium | Drawer shows two lines: "Status: Available" and "Pipeline: Negotiation (Brand A)"; the status dropdown lists inventory statuses only; legends group derived labels under "Pipeline (from deals)"; tooltip explains the source. | Engineering | ui.js, floorplan.js |
| R-19 | Unfinished screens presented as complete (§63 "no fake buttons"). | Medium | High | Definition of done per screen in `09_IMPLEMENTATION_PLAN.md`; unimplemented actions render disabled with a "future" tooltip; QA sweep for buttons without handlers. | Engineering | all |
| R-20 | Demo SVG authoring effort: ≥2 floors with true polygons for ~45 units drawn by hand. | Medium | Medium | Generate the demo plans with a small Node script (grid layout, corridor, anchors), commit the resulting SVG text into `data/demo.js`; no runtime generation. | Engineering | demo.js |
| R-21 | Stage and status history gaps: history written by the UI layer is skipped when a change is made through import or the tool registry. | Medium | High | Single writer: `services.setUnitStatus()` and `services.setDealStage()` write `statusHistory` and `auditLog`; UI, import and `LSP.runTool` all call these; a QA test changes status through each path and asserts one history row. | Engineering | services.js |

### 4.1 Early-warning signals for the highest-impact risks

| Risk | Signal that the risk is materialising | Response |
|---|---|---|
| R-1 quota | Saving indicator shows "Unsaved" after a plan import; state size in Settings > Storage above 3 MB | Minify or split plans; export; consider IndexedDB (T-4) |
| R-2 SVG XSS | A QA sanitizer test fails, or a plan renders content not present in the source drawing | Block the release; extend the allow-list tests |
| R-4 auth misuse | A client or external person receives the `/os/leasing/` link; real names appear in a hosted state | Reset hosted demo; move to local-only placement (Q-02-8) |
| R-5 divergence | Deals exist in LSP that do not exist in CASE OS after the first week | Enforce the usage rule (Q-02-5); re-import from CASE OS backup |
| R-11 adoption | No feedback items after the onboarding session; only one demo user ever logs in (audit log) | Founder review with the Head of Leasing & Sales; shorten the validation window |
| R-19 fake buttons | QA sweep finds controls without handlers or views without content | Mark as future with disabled state; do not ship the view |
| R-21 history gaps | A status or stage change without a `statusHistory` row (nightly QA assertion) | Route the writer through `services`; add the missing path to the test |

Risks accepted without further mitigation in v0.1: R-13 (browser support, evergreen browsers assumed), R-17 (offline behaviour under the CASE OS service worker).

---

## 5. Over-complex or premature features and the trim recommended

| ID | Feature (source) | Why it is premature for a validation prototype | Trim recommended | Phase |
|---|---|---|---|---|
| T-1 | Kanban drag/drop (§25) | Drag/drop with touch support, scroll containers and history recording is expensive; §25 already makes it conditional. | Primary stage control = "Move to stage" selector on the card and in Deal Detail; drag/drop optional in the last phase, only if it records stage history and has a keyboard/touch fallback. | late |
| T-2 | Notifications (§45) | A notification store needs read/unread state, delivery rules and cleanup. | Computed lists: the dashboard "Attention" panel and a header counter are recomputed by `services` on each render (overdue tasks, client comments open, stale deals, missing next action, mandate expiry). No stored notifications. | dashboard |
| T-3 | AI command palette (§51–§53, D12) | No LLM is allowed; a natural-language layer would be simulated. | The tool registry (`js/tools.js`, §52 functions, permission checker) is in scope. A deterministic "Ask" palette (regex intents → tools) is optional, last phase, labeled prototype (Q-02-3). | last |
| T-4 | IndexedDB (§46, §62) | Second storage engine, async API, migration complexity. | Deferred until the quota guard is hit in practice (D9). | deferred |
| T-5 | CSV import for 13 data areas (§42) | Nested arrays (deal units, contact brands) do not map to flat CSV. | CSV import for brands, companies, contacts, units with column mapping; JSON for everything else (D9, C-13). | importexport |
| T-6 | Requirement records (§21, §63 screen 14) | A full requirement workflow duplicates `brand.expansionRequirements`. | Minimal record: `{id, brandId or companyId, type, targetCities, targetProjects, areaMinM2, areaPreferredM2, areaMaxM2, categories, floorPreference, budget, timeline, status, notes}`; the Requirements screen is a filtered list with create/edit; matching (§39) uses the requirement when present, else `brand.expansionRequirements`. | crm |
| T-7 | External Agent / Referral Partner role (§31) | Marked "future limited role" by the prompt. | Role defined in config with its capability set and CASE OS mapping (AGX); no demo user; the login screen lists it as future. | settings |
| T-8 | Uzbek UI (D3) | Third dictionary before the base is stable. | Dictionary structure supports it; not shipped in v0.1. | later |
| T-9 | Manager view mode (§14.4 "optionally") | Low decision value compared with status and mix modes. | Implemented as a simple mode after the four mandatory ones; may slip without breaking acceptance. | late |
| T-10 | Geographic map (§57 Leaflet "only if needed") | Not needed to validate leasing workflow. | Coordinates stored on projects; no map component. | none |
| T-11 | Charting library (§57 Chart.js "if required") | External dependency, CSP surface, print issues. | Inline SVG charts generated by code: bar, stacked bar, donut only (D14). | reports |
| T-12 | Commission ledger, tiered rules (§38 vs CASE OS engines) | CASE OS already owns commission finance. | One minimal commission record per deal with configurable completion rule and visibility (C-4, C-15). | pipeline |
| T-13 | Brand-to-unit matching with tunable weights (§39) | A weights UI is a product in itself. | Deterministic score over the §39 criteria with an explanation list per match; weights in `config.js` only; "suggestions, not recommendations" label. | crm |
| T-14 | Document storage (§30, §6.2) | Browser cannot store files reliably. | Metadata records; `localUrl` is an object URL valid for the session only (`localUrlTransient: true`); demo documents have no bytes; no IndexedDB. | documents |
| T-15 | "Changes since previous report" (§37) | A generic diff engine is expensive. | Stored report snapshots (`RPT-`) with KPI values and unit status vector; changes = snapshot delta + `statusHistory` and deal stage history since the snapshot date. | reports |
| T-16 | Global search (§43) | Fuzzy search and ranking are not needed for ~500 records. | Normalized substring match over an indexed set of fields per entity; results show type and context. | ui.js |
| T-17 | Audit log (§54) | Recording every field edit bloats localStorage. | Append-only log of important changes: status, stage, visibility, delete, import, export, settings change, login as role (`AUD-` records). | state.js |

### 5.1 Kept in scope despite their cost

The following items are acceptance criteria of the master prompt and are not candidates for trimming, whatever the schedule pressure:

- true clickable SVG polygons on at least two demo floors (§13, §69);
- separate unit status and deal stage with derived display status (§6.3, D5);
- one unit with several open deals and one deal with several units, both counted correctly (§6.4, §6.5, Flows 7–8);
- a client session that sees only assigned projects, whitelisted fields and client-visible documents (§3.4, §35, Flow 9);
- status and stage history on every change through every path (§65 "status history is created", R-21);
- corrupted-data recovery screen and backup slot (§46, D9);
- print stylesheet for client and internal reports (§37);
- configuration-driven statuses, stages, categories and colors read only from `js/config.js` (§12, §44);
- the §6.1 warning text on every entry point.

---

## 6. Corrections §6.1–6.8 and how each is applied

| Correction | Requirement (00_MASTER_PROMPT.md) | Applied in the design | Verified by |
|---|---|---|---|
| §6.1 Prototype login is not security | Demo users, role simulation, the exact text "Prototype authentication only. This does not provide production security."; no real passwords or security claims. | Login screen = demo user picker or typed username, Enter submits, no password field (C-17). The exact sentence is rendered on the login screen, in the application footer and in the portal footer. Session stored in `caseos-lsp-session`. README and `01_PRODUCT_SPEC.md` repeat the limit. No word "secure" in UI copy. | `10_QA_PLAN.md`: "prototype authentication warning is visible" on login, internal and portal views. |
| §6.2 File handling is local prototype handling | Demo file records, local metadata, object URLs where reliable, IndexedDB only if necessary; document that production needs secure backend storage. | `documents` store metadata only (§30 schema); `localUrl` created by `URL.createObjectURL` at registration and flagged `localUrlTransient: true`; after reload the record shows "file not available in this session"; demo records have no bytes. No IndexedDB (T-4). README section "Production storage". | Documents tests: register, reload, metadata persists, download disabled with message. |
| §6.3 Unit status and deal stage are separate | One field must not serve both. | D5: `unit.commercialStatus` (inventory) and `deal.stage`; derived display status computed, never stored; status dropdown lists inventory statuses only (R-18). | Flow 3 and Flow 7 tests; a unit test asserts that no unit record contains a stage value. |
| §6.4 A unit may have multiple prospects | Inventory counts unit area once; pipeline counts deal areas by defined rules. | D6: inventory buckets partition unit GLA by `countsAs`; pipeline metrics are deal-centric and labeled "deal-based"; a unit with three open deals appears once in inventory and three times in pipeline-by-stage with the note shown. | Flow 7 test; `07_CALCULATIONS_AND_KPI_RULES.md` worked example. |
| §6.5 A deal may contain multiple units | Total deal area computed without duplicating inventory. | `deal.unitIds[]`; `dealArea = Σ GLA of unique linked units` unless `deal.areaOverrideM2`; all units must belong to `deal.projectId` (C-18); inventory untouched by deal links. | Flow 8 test; unit test with a two-unit deal. |
| §6.6 Commission completion is configurable | No hard-coded permanent financial rule. | `config.commission.completionRule` (default `commission_received`, Q-02-2) and `config.commission.requiredForClosedWon`; Settings edits both; `services.isDealFinanciallyComplete(deal)` reads config. | Settings test switches the rule and asserts the dashboard "signed deals" and "closed won" counts change accordingly. |
| §6.7 Automatic floor-plan recognition is future functionality | SVG/JSON polygons, manual mapping, optional experimental text extraction, labeled experimental. | D8 wizard: SVG (sanitized) or JSON polygons or raster background + manual polygon drawing; auto-match by `data-unit-id`/`id`; text-label suggestion step labeled EXPERIMENTAL and confirmed per polygon; raster/PDF/CAD/BIM recognition shown as future, no button. | Wizard tests with the demo SVG, a JSON polygon set and a raster image. |
| §6.8 Client visibility must be explicit | Conceptual levels Internal, Client-visible, Restricted, Public on every sensitive object or field. | `visibility` ∈ {`internal`, `client_visible`, `restricted`, `public`} on projects notes, units, deals, documents, comments, brands, contacts, reports; `config.portalFields` whitelist per entity; the portal renders only from `services.clientView(projectId, session)` (D7). Commissions, internal notes, proposed/negotiated terms, internal contacts, staff performance never enter the client view. | Flow 9–11 tests; a unit test serialises `clientView()` output and asserts that forbidden keys are absent. |

### 6.1 Configuration keys introduced by the corrections

Defaults live in `js/config.js` (`DEFAULT_CONFIG`) and are editable in Settings unless marked fixed. Shown here so that engineers can see how the eight corrections become data rather than code paths; the authoritative schema is in `05_STATUSES_STAGES_AND_CONFIG.md`.

```javascript
// §6.1 — fixed text, not editable
auth: { warningText: 'Prototype authentication only. This does not provide production security.' },

// §6.2 — documents are metadata; object URLs are session-only
documents: { storeBytes: false, transientObjectUrls: true,
             visibilityLevels: ['internal', 'client_visible', 'restricted'] },

// §6.3 / §6.8 — one status entry (inventory example and derived example)
unitStatuses: [
  { key: 'Available', label: 'Available', kind: 'inventory', marketable: true,
    availabilityGroup: 'available', countsAs: 'vacant',
    color: '#2E7D32', textColor: '#FFFFFF', pattern: 'none', clientStatus: 'Available' },
  { key: 'Negotiation', label: 'Negotiation', kind: 'derived',
    availabilityGroup: 'in_process', countsAs: 'pipeline',
    color: '#EF6C00', textColor: '#FFFFFF', pattern: 'hatch', clientStatus: 'In Negotiation' }
],

// §6.3 / §6.4 / §6.6 — stages with group, probability and derived status; thresholds per pipeline
pipeline: {
  leasing: { stages: [ { key: 'Negotiation', label: 'Negotiation', group: 'active',
                          probability: 50, derivedStatus: 'Negotiation' } /* ... */ ],
             displayStageThreshold: 'Property / Unit Offered',
             negotiationStageThreshold: 'Negotiation' },
  sales:   { stages: [ /* ... */ ], displayStageThreshold: 'Property / Unit Offered',
             negotiationStageThreshold: 'Offer' },
  lostReasons: ['Rent too high', 'Wrong location', 'Area too large', 'Area too small', 'Project timing',
                'Competitor selected', 'Internal brand decision', 'No response', 'Terms rejected', 'Other']
},

// §6.5 — deal area rule (fixed; the override is per deal, not per config)
dealArea: { rule: 'sum_unique_linked_units_unless_override' },

// §6.6 — commission completion and visibility
commission: { completionRule: 'commission_received',   // or 'contract_signed' | 'payment_completed'
              requiredForClosedWon: true,
              visibility: { founder_admin: ['gross', 'shares', 'status'],
                            head_ls: ['gross', 'companyShare', 'status'],
                            manager: ['ownShare', 'status'],
                            administrator: ['status'], external_agent: [], client: [] } },

// §6.7 — no recognition claims
floorPlans: { acceptedSources: ['svg', 'json_polygons', 'raster_manual'],
              experimentalTextMatching: true, recognition: 'none' },

// §6.8 — visibility levels and the portal field whitelist (never a blacklist)
visibility: { levels: ['internal', 'client_visible', 'restricted', 'public'],
              portalFields: {
                project: ['name', 'city', 'assetTypes', 'areas.glaM2', 'notes.clientVisible'],
                unit:    ['unitNumber', 'floorId', 'area.glaM2', 'clientStatus',
                          'targetUse.category', 'actualUse.category', 'actualUse.tenantName'],
                deal:    [],                       // deals are never sent to the portal
                document:['fileName', 'category', 'version', 'uploadedAt'] } }
```

Rendering code reads these keys through `services`; a status, stage or category that is absent from config renders as "Unknown" with a data-hygiene entry rather than throwing.

---

## 7. Decisions required before coding

### 7.1 Decision table

| ID | Decision | Recommendation | Alternatives | Consequence of delay | Owner |
|---|---|---|---|---|---|
| D1 | Positioning of LSP: new self-contained module under `os/leasing/` with its own model, no change to CASE OS. | Approve D1. | (a) Extend CASE OS in place: requires `units.status` split, `deal_units`, CRM tables, client role — a core and backend refactor with production risk; (b) place the prototype outside `os/` (see Q-02-8). | Nothing can be built; every sibling document depends on D1. | Founder |
| A-1 | UI language: English base + Russian, `t()` from day one, Uzbek later; planning documents in English. | Approve A-1. | Russian-first UI (matches CASE OS); English-only (fastest, weak adoption). | Dictionary structure must be fixed before the first screen. | Founder |
| A-2 | Demo data fully fictional; real staff added in Settings; CASE OS real projects not used. | Approve A-2. | Use anonymised CASE OS data (still recognisable); use real staff names for demo users (violates §47 spirit). | Demo dataset cannot be written. | Founder |
| A-3 | Merchandise categories: master prompt list + five additions (D15); CASECATS mapped through an editable table. | Approve A-3. | Adopt CASECATS (17 RU categories) as the LSP default; adopt the master prompt list only. | Config, demo data, merchandise-mix analytics and the import adapter all depend on it. | Head of Leasing & Sales |
| Q-02-1 | Stage thresholds (section 2.1): `displayStageThreshold` = lowest stage at which a marketable unit shows a derived stage on plans and tables (D5); `negotiationStageThreshold` = lowest stage at which a unit counts as "under negotiation" in KPIs (D6). | Display: `Property / Unit Offered` (both pipelines). Negotiation: `Negotiation` (leasing), `Offer` (sales). Both configurable in Settings. | Display at `Lead` (every linked deal recolors the plan; noisy); negotiation at `Property / Unit Offered` (earlier; more GLA appears in process) or `LOI / Commercial Terms` (later; conservative). | KPI definitions and legend colors cannot be fixed. | Head of Leasing & Sales |
| Q-02-2 | Commission-completion rule default (C-4, §6.6). | `commission_received` — matches §22's last paragraph; `requiredForClosedWon: true`. | `contract_signed` (simpler operational view); `payment_completed` (sales). | Dashboard "closed won" and "pending commissions" semantics undefined. | Founder |
| Q-02-3 | Include the deterministic "Ask" palette (T-3)? | Include as an optional last-phase item; drop first if time is short. The tool registry itself is not optional. | Exclude entirely; build it early as a demonstration. | None for the core plan. | Founder |
| Q-02-4 | Commission visibility per role (C-15). | Adopt the default of C-15. | All internal roles see all shares; only `founder_admin` sees commissions. | Role matrix incomplete; Deal Detail cannot be finished. | Founder |
| Q-02-5 | Usage rule during validation: may the team enter real operational deals into LSP? (R-5) | No real operational data in LSP; test with fictional demo or with a locally imported CASE OS backup; time-box 4–6 weeks then decide fold-back or stop (A-02-4). | Allow parallel entry (accepts two sources of truth); LSP becomes the record immediately (requires backend). | Silent divergence between LSP and CASE OS. | Founder, Head of Leasing & Sales |
| Q-02-6 | Import SCR sales assets from CASE OS backups (X-15)? | Not in v0.1; leasing units only. | Import `sales_assets` as units with `commercialMode: 'sales'`. | None for v0.1. | Head of Leasing & Sales |
| Q-02-7 | Dark mode fallback when plan contrast fails (C-9). | Accept "plan canvas always light" as the fallback. | Disable dark mode entirely; tune colors until both pass. | Palette QA cannot be closed. | Engineering |
| Q-02-8 | Placement: `os/leasing/` (deployed with the zip, reachable at `caseadvisory.uz/os/leasing/`) or outside `os/` (never deployed, local files only)? | `os/leasing/` so the team can test from any device; not linked from CASE OS navigation; prototype warning everywhere. | Outside `os/` (e.g. `docs/standalone/`): zero exposure, but testing from local files only (R-3). | Release packaging and README startup instructions undefined. | Founder |
| Q-02-9 | Default currency and rent unit. §11 uses USD and USD/m²/month; CASE OS shows sums by the CB rate. | USD and USD/m²/month as defaults; UZS available in `config.currencies`; no FX conversion in v0.1 (values are stored with their currency). | UZS default; dual display with a manual FX rate. | Demo data and KPI formatting undefined. | Head of Leasing & Sales |

### 7.2 New assumptions introduced by this document

| ID | Assumption | Used by |
|---|---|---|
| A-02-1 | The team tests LSP primarily in desktop Chrome or Edge, from hosting or a static server; `file://` use is a secondary path. | R-3, README |
| A-02-2 | The localStorage budget usable by LSP on `caseadvisory.uz` is at most about 5 MB, because the CASE OS demo state shares the origin. | R-1, D9 quota guard |
| A-02-3 | No real client, brand or deal data is stored in a hosted LSP instance during validation; CASE OS backup imports are done on the tester's own machine. | R-4, R-5, X-9 |
| A-02-4 | The validation window is 4–6 weeks after v0.1 release, ending with a fold-back decision (extend CASE OS, continue LSP toward a backend, or stop). | R-5, Q-02-5 |

### 7.3 Open questions summary

All open questions are listed in section 7.1 (Q-02-1 … Q-02-9) with recommendation and owner. Q-02-1, Q-02-2 and Q-02-4 have config defaults in `05_STATUSES_STAGES_AND_CONFIG.md`, so implementation can start on the recommended defaults if approval is delayed; Q-02-5 and Q-02-8 are usage and placement rules that do not block coding but must be settled before the first release zip.

### 7.4 Approval sequence

| Order | Decision(s) | Blocks | Can implementation start on the recommendation? |
|---|---|---|---|
| 1 | D1, Q-02-8 | Everything: folder, README, release packaging | No |
| 2 | A-1, A-3, Q-02-9 | `js/config.js`, `data/i18n.js`, `data/demo.js` | Yes, with rework risk limited to labels and demo values |
| 3 | A-2 | `data/demo.js` | Yes |
| 4 | Q-02-1, Q-02-2, Q-02-4 | `js/services.js` KPI and pipeline rules, Deal Detail | Yes (config defaults) |
| 5 | Q-02-5, Q-02-6, Q-02-7 | Validation rules, import adapter scope, palette QA | Yes |
| 6 | Q-02-3 | Last phase only | Yes |

---

## 8. Requirements traceability summary

Counting unit: one numbered item of the master prompt list concerned. "Covered" = fully addressed by the design documents and planned for v0.1; "Partial" = addressed with a documented reduction (see T-n); "Deferred / optional" = not in v0.1 by decision.

| Requirement group | Total | Covered | Partial | Deferred / optional | Covered by |
|---|---|---|---|---|---|
| §5 MVP scope items 1–35 | 35 | 32 | 3 (15 requirements T-6; 20 documents T-14; 27 import/export T-5) | 0 | `01_PRODUCT_SPEC.md`, `03_DATA_MODEL.md`, `08_PERSISTENCE_IMPORT_EXPORT.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| §6 corrections 6.1–6.8 | 8 | 8 | 0 | 0 | Section 6 of this document; `05_STATUSES_STAGES_AND_CONFIG.md`, `07_CALCULATIONS_AND_KPI_RULES.md` |
| §7 entity list (21 collections) with schemas in §8–§11, §18–§20, §24, §27, §30 | 21 | 21 | 0 | 0 | `03_DATA_MODEL.md` |
| §12, §22, §23, §36, §44 configuration areas | 5 lists, 15 §44 areas | 15 | 0 (user roles = manage prototype users and role assignment, not capability editing; notification rules = thresholds only) | 0 | `05_STATUSES_STAGES_AND_CONFIG.md` |
| §13–§16 floor plan (15 user actions, 5 modes, drawer, wizard) | 4 blocks | 4 | 0 | 0 (text-label matching experimental; recognition future by definition) | `06_FLOORPLAN_ARCHITECTURE.md` |
| §17, §33–§35, §37, §39–§41 calculations, dashboards, reports, matching, completeness, stale rules | 8 | 7 | 1 (§37 "changes since previous report" via snapshots, T-15) | 0 | `07_CALCULATIONS_AND_KPI_RULES.md` |
| §26 CRM filters | 22 filters | 22 | 0 | 0 | `01_PRODUCT_SPEC.md`, `09_IMPLEMENTATION_PLAN.md` |
| §31–§32 roles and login (6 roles, login requirements) | 2 | 2 | 0 (external agent as stub, T-7) | 0 | `04_ROLES_AND_VISIBILITY.md` |
| §42–§43, §46 import/export, search, persistence | 3 | 2 | 1 (CSV import subset) | IndexedDB (T-4) | `08_PERSISTENCE_IMPORT_EXPORT.md` |
| §45 notifications | 1 | 0 | 1 (computed lists, T-2) | 0 | `07_CALCULATIONS_AND_KPI_RULES.md` |
| §47 demo dataset (18 items) | 18 | 18 | 0 | 0 | `09_IMPLEMENTATION_PLAN.md` (demo.js), A-2 |
| §48 responsive and visual design (6 viewports) | 6 | 6 | 0 | 0 | `10_QA_PLAN.md`, D14 |
| §49–§54 future integration, AI registry (26 functions), audit | 6 | 6 | 0 (audit log limited to important changes, T-17; Ask palette optional, T-3) | 0 | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` |
| §56 skills (21) and §61 repository audit | 2 | 2 | 0 | 0 | `.claude/skills/*/SKILL.md`, `11_REPOSITORY_AUDIT.md` |
| §63 required screens | 22 | 20 | 2 (14 Requirements minimal; 21 Settings without capability-matrix editing) | 0 | `09_IMPLEMENTATION_PLAN.md` |
| §64 user flows | 12 | 12 | 0 | 0 | `10_QA_PLAN.md` (one named test per flow) |
| §65 check-up groups | 14 groups | 14 | 0 | 0 | `10_QA_PLAN.md` |
| §66 deliverables A–H | 8 | 8 (A after approval; B–G by this document set; H by the QA report) | 0 | 0 | `README.md` approval checklist |

**Explicitly deferred or optional in v0.1:** IndexedDB (T-4), Uzbek UI (T-8), Kanban drag/drop (T-1), external agent login (T-7), geographic map (T-10), SCR sales asset import (Q-02-6), deterministic Ask palette (T-3, Q-02-3), commission ledger and tiered rules (T-12), any OCR/CV/CAD/PDF plan recognition (§6.7, future by definition), CASE OS navigation entry for LSP (D1, separate later change), service-worker offline support for `/os/leasing/` (X-7).

**Net position.** Every master prompt requirement has an owner document; 13 items are delivered in reduced form and are listed above with their trim ID; no required screen or flow is dropped. The contradictions C-1 … C-18 are all resolved or carry a proposed default; the remaining approvals are D1, A-1, A-2, A-3 and Q-02-1 … Q-02-9.

### 8.1 Screen-by-screen traceability (§63)

| # | Screen | Status in v0.1 | Primary document | Note |
|---|---|---|---|---|
| 1 | Login | Covered | `04_ROLES_AND_VISIBILITY.md` | user picker, Enter submits, §6.1 warning |
| 2 | Internal Home Dashboard | Covered | `07_CALCULATIONS_AND_KPI_RULES.md` | KPIs, today's work, pipeline snapshot, data hygiene; notifications as computed lists (T-2) |
| 3 | Projects List | Covered | `03_DATA_MODEL.md` | create/edit where the role allows |
| 4 | Project Dashboard | Covered | `07_CALCULATIONS_AND_KPI_RULES.md` | unit-centric inventory, deal-centric pipeline, declared vs computed GLA |
| 5 | Interactive Floor Plan | Covered | `06_FLOORPLAN_ARCHITECTURE.md` | 5 modes, drawer, wizard, mobile fallback |
| 6 | Units Table | Covered | `03_DATA_MODEL.md` | same state as the plan; filters §26 |
| 7 | Leasing Pipeline | Covered | `05_STATUSES_STAGES_AND_CONFIG.md` | Kanban (move-to-stage control), table; drag/drop optional (T-1) |
| 8 | Sales Pipeline | Covered | `05_STATUSES_STAGES_AND_CONFIG.md` | separate stage list; no leasing-only fields |
| 9 | Deal Detail | Covered | `03_DATA_MODEL.md` | multi-unit, commercial terms by type, commission record, history |
| 10 | Brand Database | Covered | `03_DATA_MODEL.md` | search, duplicate warnings, completeness |
| 11 | Brand Detail | Covered | `03_DATA_MODEL.md` | contacts, requirements, history, suggested units |
| 12 | Companies | Covered | `03_DATA_MODEL.md` | separate from brands (§19) |
| 13 | Contacts | Covered | `03_DATA_MODEL.md` | multiple brand links (§20) |
| 14 | Requirements | Partial | `03_DATA_MODEL.md` | minimal record and list (T-6) |
| 15 | Tasks | Covered | `03_DATA_MODEL.md` | overdue / today / next 7 days, one-click complete and reschedule |
| 16 | Activities | Covered | `03_DATA_MODEL.md` | manual activities; timelines computed (C-5) |
| 17 | Reports | Covered | `07_CALCULATIONS_AND_KPI_RULES.md` | client and internal reports, snapshots, print |
| 18 | Documents | Covered | `08_PERSISTENCE_IMPORT_EXPORT.md` | metadata registry, session-only object URLs (T-14) |
| 19 | Client Portal Dashboard | Covered | `04_ROLES_AND_VISIBILITY.md` | rendered from `clientView()` only |
| 20 | Client Floor Plan | Covered | `06_FLOORPLAN_ARCHITECTURE.md` | client statuses, client drawer, comments |
| 21 | Settings | Partial | `05_STATUSES_STAGES_AND_CONFIG.md` | all §44 areas except capability-matrix editing; prototype users and role assignment |
| 22 | Import / Export | Covered | `08_PERSISTENCE_IMPORT_EXPORT.md` | JSON full, CSV export, CSV import subset (T-5), CASE OS adapter |

### 8.2 Flow-by-flow traceability (§64)

| Flow | Sections exercised | Review items that shape it | Test group in `10_QA_PLAN.md` |
|---|---|---|---|
| 1 Internal login | §6.1, §31, §32 | C-17 | Flow 1 |
| 2 Open project | §9, §13, §33, §34 | C-14 | Flow 2 |
| 3 Unit management | §11, §12, §15, §3.5 | C-1, C-5, R-18, R-21 | Flow 3 |
| 4 Merchandise mix | §14.2, §14.3, §17 | C-12, A-3 | Flow 4 |
| 5 Brand CRM | §18, §20, §21, §39 | C-6, T-6, T-13 | Flow 5 |
| 6 Leasing deal | §22, §24, §28, §30, §38 | C-4, C-15, T-12, Q-02-2 | Flow 6 |
| 7 Multiple prospects | §6.4, §34 | C-1, D6 | Flow 7 |
| 8 Multi-unit deal | §6.5, §24 | C-18, D6 | Flow 8 |
| 9 Client login | §3.4, §35, §36 | C-3, §6.8 | Flow 9 |
| 10 Client comment | §29, §45 | T-2 | Flow 10 |
| 11 Reporting | §37 | T-15, R-8 | Flow 11 |
| 12 Persistence | §42, §46 | D9, R-1, R-14 | Flow 12 |

### 8.3 Items delivered in reduced form

| Item | Master prompt reference | Reduction | ID |
|---|---|---|---|
| Requirement records | §5 item 15, §21, §63 screen 14 | minimal record, list screen | T-6 |
| Documents | §5 item 20, §30 | metadata only, session object URLs | T-14 |
| Import/export | §5 item 27, §42 | CSV import for four tables | T-5 |
| Settings | §44, §63 screen 21 | no capability-matrix editing; notification rules = thresholds | — |
| Notifications | §45 | computed lists, no store | T-2 |
| Changes since previous report | §37 | snapshot delta + history | T-15 |
| Kanban | §25 | move-to-stage control; drag/drop optional | T-1 |
| External agent role | §31 | config stub, no demo user | T-7 |
| Audit log | §54 | important changes only | T-17 |
| Search | §43 | substring, no fuzzy ranking | T-16 |
| Matching | §39 | fixed weights in config | T-13 |
| Commission | §38 | one record per deal, no ledger | T-12 |
| AI architecture | §51–§53 | registry in scope, palette optional | T-3 |
