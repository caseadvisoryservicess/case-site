# AI-ready and ecosystem integration architecture

**Purpose.** This document specifies how the Leasing & Sales Platform (LSP, `os/leasing/`, decision D1) is made AI-ready without shipping any AI, how it will connect to the wider CASE ecosystem (Geoanalytics, Building OS, Asset Management, Facility Management), and what the production architecture behind the validation prototype should look like. It covers master prompt sections §49–§55 and §66 G, turns decisions D12 and D13 of the context brief into implementable specifications (tool registry, permission flow, audit format, identifier model), and lists the extension points that later modules must use instead of creating disconnected software (§68). It is written for the founder (product sponsor) and for the engineers who implement the MVP after approval.

Status: DRAFT for approval — 2026-09-17

Conventions: **FACT** = verified in `00_MASTER_PROMPT.md` or in a named CASE OS file; **A-n** = assumption; **RECOMMENDATION** = proposal that needs approval; **Q-12-n** = open question with owner. Entity, field, status, stage, role, path and ID names follow the context brief and `03_DATA_MODEL.md`; no parallel vocabulary is introduced here.

---

## 1. Principles

| # | Principle | Source | Consequence for LSP |
|---|---|---|---|
| P1 | Business logic is a set of reusable, DOM-free functions | 00_MASTER_PROMPT.md §51 | Every query, KPI, rule and report builder lives in `js/services.js`; views and tools call services, never each other. Services run in Node for tests (D10). |
| P2 | Future AI calls tools, not clicks | §52 | `js/tools.js` exposes `LSP.tools` (registry) and `LSP.runTool(name, params, session)`; the UI palette (section 3) and every future AI interface use only this entry point. |
| P3 | Five kinds of information must stay distinguishable: platform data, calculated results, external research, assumptions, unavailable information | §53 | Every tool result carries a `provenance` block (section 2.6). Missing inputs are returned as `missing[]`, never as `0` (§69). No tool returns external research or assumptions in v0.1; the enum values exist so the envelope does not change later. |
| P4 | Permanent edits require confirmation | §53 | Write tools (`readOnly:false`) return `needsConfirmation` with a preview unless `params.confirm === true`. Confirmation is a UI act, never an automatic retry. |
| P5 | AI must never access raw unrestricted database data | §55 | Tools never expose `appState`; services receive a session-scoped context and results pass a whitelist redaction step before leaving `runTool`. There is no "dump state" tool. |
| P6 | Client AI uses approved client data only | §51, §35 | A `client` session reaches only tools with `visibilityScope: 'session'` and their results go through `services.clientView` (field whitelist, D7). Tools with `visibilityScope: 'internal'` reject client sessions. |
| P7 | Important actions are auditable | §54 | `runTool` writes an `auditLog` entry (`AUD-001` format, section 2.7) for every write, report generation, export and every client-session call. |
| P8 | No LLM, no network, no provider dependency in the MVP | §51, §58, D12 | The registry metadata is provider-independent JSON; nothing in `os/leasing/` calls a model or an API. The MCP specification is referenced as the likely future transport only (section 4). |
| P9 | Same rules everywhere | §3.5, §25 | The palette, the views and the portal render from the same services, so an AI answer can never disagree with the screen. |

---

## 2. Tool registry specification (D12)

### 2.1 Placement and exports

FACT (D2, D10): `os/leasing/js/tools.js` loads after `js/config.js`, `js/state.js` and `js/services.js`. It attaches `window.LSP.tools` and `window.LSP.runTool` in browsers and `module.exports = { tools, runTool }` in Node. It must not touch the DOM.

```text
LSP.tools.registry      object keyed by tool name → ToolDefinition (section 2.2)
LSP.tools.describe()    JSON-serialisable list of ToolDefinition without the `handler`
                        (this is the payload a future MCP server or planner would publish)
LSP.tools.roleSets      { ALL, INT, LEAD, RPT } (section 2.3)
LSP.tools.permission    { check(tool, params, session) → {ok, error?} }
LSP.tools.trace         session-local ring buffer of the last 200 calls (not persisted)
LSP.runTool(name, params, session) → ResultEnvelope (section 2.6)
```

### 2.2 Registry metadata format

Each entry is a plain object; `params` uses a small JSON-Schema-compatible subset (`type`, `required`, `enum`, `items`, `format`, `description`, `default`) so it can be published unchanged later.

```javascript
{
  name: 'filterUnits',
  category: 'read',                       // 'search'|'read'|'calculate'|'suggest'|'report'|'write'
  description: 'Units matching structured filters, redacted for the session.',
  params: {
    projectId:   { type: 'string', format: 'id:PROJ', required: false },
    availabilityGroup: { type: 'string', enum: ['available','in_process','occupied_or_sold','unavailable'] },
    hasOpenDeals: { type: 'boolean' },
    limit:       { type: 'integer', default: 200, maximum: 1000 }
  },
  returns: 'UnitSummary[]',               // named shape documented in 03_DATA_MODEL.md
  readOnly: true,
  requiresConfirmation: false,            // true only for write tools
  requiredRole: 'ALL',                    // role-set key or explicit array of LSP role keys
  visibilityScope: 'session',             // 'session' | 'internal' | 'client_visible'
  service: 'services.filterUnits',        // the wrapped pure function
  audit: 'none',                          // 'none' | 'read' | 'write' | 'report' | 'export'
  handler: (params, ctx) => services.filterUnits(ctx, params)
}
```

`format: 'id:PROJ'` means the value must match `^PROJ-\d{3,}$` (D13 ID formats). `ctx` is `{ state, session, visibility }` where `visibility` is the filter object produced by `services.visibilityFor(session)` (04_ROLES_AND_VISIBILITY.md).

### 2.3 Role sets and visibility scopes

| Key | LSP roles (D7) | Notes |
|---|---|---|
| `ALL` | founder_admin, head_ls, manager, administrator, client | Result is always redacted per session. |
| `INT` | founder_admin, head_ls, manager, administrator | Internal staff. |
| `LEAD` | founder_admin, head_ls | Commission and portfolio-wide finance figures. |
| `RPT` | founder_admin, head_ls, administrator | Report preparation (§31: administrator "prepare reports"; manager list has no reports). |
| — | external_agent | Not in any set in v0.1: fail closed (§31 "future limited role"). |

| `visibilityScope` | Meaning |
|---|---|
| `session` | Internal session: fields allowed for the role (restricted objects only for `LEAD` or explicit assignment, per 04_ROLES_AND_VISIBILITY.md). Client session: `services.clientView` whitelist and only `assignedProjectIds`. |
| `internal` | Client sessions are rejected with `forbidden` before the service runs. |
| `client_visible` | Forces the client whitelist even for internal callers (portal preview, client report). |

### 2.4 Tool catalogue — identity and access (all 26 functions of §52)

| # | Tool | Cat. | readOnly | requiredRole | visibilityScope | Wraps (`js/services.js`) | audit |
|---|---|---|---|---|---|---|---|
| 1 | `searchBrands` | search | yes | INT | internal | `services.searchBrands` | none |
| 2 | `searchCompanies` | search | yes | INT | internal | `services.searchCompanies` | none |
| 3 | `searchContacts` | search | yes | INT | internal | `services.searchContacts` | none |
| 4 | `searchProjects` | search | yes | ALL | session | `services.searchProjects` | none |
| 5 | `searchUnits` | search | yes | ALL | session | `services.searchUnits` | none |
| 6 | `filterUnits` | read | yes | ALL | session | `services.filterUnits` | none |
| 7 | `getProject` | read | yes | ALL | session | `services.getProject` | none |
| 8 | `getFloor` | read | yes | ALL | session | `services.getFloor` | none |
| 9 | `getUnit` | read | yes | ALL | session | `services.getUnitDetail` | none |
| 10 | `getDeal` | read | yes | INT | internal | `services.getDeal` | none |
| 11 | `getDealsByStage` | read | yes | INT | internal | `services.dealsByStage` | none |
| 12 | `getDealsWithoutNextAction` | read | yes | INT | internal | `services.dealsWithoutNextAction` | none |
| 13 | `getOverdueTasks` | read | yes | INT | internal | `services.overdueTasks` | none |
| 14 | `calculateLeasedGLA` | calculate | yes | ALL | session | `services.kpi.leasedGla` | none |
| 15 | `calculateVacantGLA` | calculate | yes | ALL | session | `services.kpi.vacantGla` | none |
| 16 | `calculatePipelineGLA` | calculate | yes | ALL | session | `services.kpi.pipelineGla` | none |
| 17 | `calculatePipelineValue` | calculate | yes | INT | internal | `services.kpi.pipelineValue` | none |
| 18 | `aggregateMerchandiseMix` | calculate | yes | ALL | session | `services.merchandiseMix` | none |
| 19 | `suggestBrandsForUnit` | suggest | yes | INT | internal | `services.match.brandsForUnit` | none |
| 20 | `suggestUnitsForBrand` | suggest | yes | INT | internal | `services.match.unitsForBrand` | none |
| 21 | `generateOwnerReport` | report | no* | RPT | session | `services.reports.build` | report |
| 22 | `getProjectChanges` | read | yes | ALL | session | `services.changesSince` | none |
| 23 | `createTask` | write | no | INT | internal | `services.tasks.create` | write |
| 24 | `addComment` | write | no | ALL | session | `services.comments.add` | write |
| 25 | `getDataCompleteness` | read | yes | INT | internal | `services.completeness` | none |
| 26 | `getVisibleDocuments` | read | yes | ALL | session | `services.documents.visible` | none |

\* `generateOwnerReport` is read-only when `persist:false` (default: builds and returns the report object). With `persist:true` it appends a `reports[]` record (`RPT-001`) and therefore requires confirmation and an audit entry (§54 "reports generated").

Client sessions and `audit`: every call from a `client` session is audited regardless of the `audit` column (§54 "client-visible actions"). Internal read calls are only kept in `LSP.tools.trace` in v0.1 (Q-12-5).

### 2.5 Tool catalogue — signatures

Type notation: `ID<PROJ>` = string matching the D13 format; `ISODate` = `YYYY-MM-DD`; `?` = optional. Named return shapes are defined in `03_DATA_MODEL.md` (summaries are subsets of the entity, never extra fields). All list tools accept `limit?: integer` (default 200, max 1000) and return results sorted deterministically (name, then id).

| # | Tool | Params | Returns | Purpose / rules |
|---|---|---|---|---|
| 1 | `searchBrands` | `query?: string`, `category?: string`, `subcategory?: string`, `status?: 'Active'\|'Target'\|'Refused'`, `targetCity?: string`, `minAreaM2?: number`, `maxAreaM2?: number` | `BrandSummary[]` `{id, name, category, subcategory, status, companyId, completeness}` | Case-insensitive match on `name`, `legalName`, `alternative names`; `targetCity` matches `expansionRequirements.targetCities`. |
| 2 | `searchCompanies` | `query?: string`, `country?: string`, `industry?: string` | `CompanySummary[]` `{id, legalName, tradingName, country, brandIds}` | Companies are separate from brands (§19). |
| 3 | `searchContacts` | `query?: string`, `companyId?: ID<COMP>`, `brandId?: ID<BRAND>` | `ContactSummary[]` `{id, firstName, lastName, position, companyId, brandIds, phones, emails}` | Restricted contacts (`visibility: 'restricted'`) only for `LEAD` or assigned owner. |
| 4 | `searchProjects` | `query?: string`, `status?: string`, `city?: string`, `assetType?: string`, `clientId?: string`, `externalId?: string` | `ProjectSummary[]` `{id, name, city, assetTypes, status, areas, externalIds}` | `externalId` matches any value in `externalIds` (Geo → LSP entry point, section 5.4). |
| 5 | `searchUnits` | `query: string`, `projectId?: ID<PROJ>` | `UnitSummary[]` `{id, unitNumber, label, projectId, buildingId, floorId, glaM2, commercialStatus, displayStatus, targetCategory, actualBrandId}` | Matches `unitNumber`, `label`, tenant name; "204" resolves `F1-204` etc. by suffix. |
| 6 | `filterUnits` | `projectId?`, `buildingId?`, `floorId?`, `commercialStatus?: string[]`, `availabilityGroup?: enum`, `countsAs?: enum`, `category?`, `subcategory?`, `areaMinM2?`, `areaMaxM2?`, `responsibleManagerId?`, `hasOpenDeals?: boolean`, `missingArea?: boolean`, `missingCategory?: boolean`, `missingDocumentCategory?: string`, `sort?: string` | `UnitSummary[]` + `{total, unitsWithoutArea}` | Structured counterpart of `searchUnits`; `displayStatus` is derived (D5), never stored. |
| 7 | `getProject` | `projectId: ID<PROJ>`, `include?: ('buildings'\|'floors'\|'kpi'\|'team')[]` | `Project` (internal) or `ClientProjectView` (client) | KPI block reuses tools 14–18 with the same denominators. |
| 8 | `getFloor` | `floorId: ID<FLOOR>`, `include?: ('units'\|'plan')[]`, `includeSvg?: boolean` | `Floor` + `units[]` + `floorPlan` metadata (`PLAN-`, version, `current`) | SVG text is excluded unless `includeSvg:true` (size); mappings are returned as `polygonMappings` only. |
| 9 | `getUnit` | `unitId: ID<UNIT>`, `include?: ('deals'\|'activities'\|'documents'\|'comments'\|'history')[]` | `UnitDetail` (internal drawer payload) or `ClientUnitView` | Same payload the unit drawer renders (§15) — one source. |
| 10 | `getDeal` | `dealId: ID<DEAL>` | `Deal` incl. `dealArea`, `unitIds`, `stageHistory` | `commercialTerms` and `outcome.commissionStatus` only for roles allowed by 04_ROLES_AND_VISIBILITY.md. |
| 11 | `getDealsByStage` | `type?: 'Leasing'\|'Sales'`, `stage?: string`, `projectId?`, `managerId?`, `status?: 'Open'\|'Closed'` (default Open) | `{ stages: [{stage, count, dealAreaM2, weightedValue}], deals: DealSummary[] }` | Deal-centric (D6): units in several deals appear more than once and the result says so in `warnings[]`. |
| 12 | `getDealsWithoutNextAction` | `projectId?`, `managerId?` | `DealSummary[]` | `nextAction.text` empty or `nextAction.dueDate` null. |
| 13 | `getOverdueTasks` | `assigneeId?`, `projectId?`, `asOf?: ISODate` | `Task[]` | `status:'Open'` and `dueDate < asOf` (default today). |
| 14 | `calculateLeasedGLA` | `projectId: ID<PROJ>`, `asOf?: ISODate` | `KpiValue` `{valueM2, denominatorM2, unitCount, unitsWithoutArea, formulaRef}` | Unit-centric, `countsAs:'leased'` statuses only (D6). `formulaRef` cites 07_CALCULATIONS_AND_KPI_RULES.md. |
| 15 | `calculateVacantGLA` | `projectId`, `asOf?` | `KpiValue` | `availabilityGroup:'available'` and no qualifying open deal. |
| 16 | `calculatePipelineGLA` | `projectId`, `type?`, `stageThreshold?: string` | `{ unitBased: KpiValue, dealBased: {byStage[]}, note }` | Client sessions receive `unitBased` only ("GLA under negotiation", §35). |
| 17 | `calculatePipelineValue` | `projectId?`, `type?`, `managerId?` | `{ weighted, unweighted, currency, byStage[] }` | Σ (annualised rent or agreed price) × stage probability (D6). |
| 18 | `aggregateMerchandiseMix` | `projectId`, `floorId?`, `basis: 'gla'\|'units'` | `{ rows: [{category, subcategory?, targetShare, actualShare, targetGlaM2, actualGlaM2, targetUnits, actualUnits, gap}], vacantByCategory[], pipelineByCategory[] }` | Client sessions: category level, no `pipelineByCategory`. |
| 19 | `suggestBrandsForUnit` | `unitId`, `limit?` | `[{brandId, score, criteria: [{name, matched, detail}]}]` + `disclaimer` | Deterministic criteria of §39; result text always includes "not a guaranteed recommendation". |
| 20 | `suggestUnitsForBrand` | `brandId`, `projectIds?: ID<PROJ>[]`, `limit?` | `[{unitId, score, criteria[]}]` + `disclaimer` | Same engine, inverted. |
| 21 | `generateOwnerReport` | `projectId`, `profile: 'client'\|'internal'`, `periodFrom?: ISODate`, `periodTo?: ISODate`, `previousReportId?: ID<RPT>`, `persist?: boolean`, `confirm?: boolean` | `Report` (§37 sections) | `profile:'client'` runs through `services.clientView`; `persist:true` needs `confirm:true`. |
| 22 | `getProjectChanges` | `projectId`, `since: ISODate\|ID<RPT>`, `until?: ISODate` | `{ statusChanges[], stageChanges[], newDeals[], closedDeals[], documents[], comments[], tasksCompleted[] }` | Built from `statusHistory`, `activities`, `auditLog`; client sessions see client-visible changes only. |
| 23 | `createTask` | `title: string`, `projectId?`, `unitId?`, `brandId?`, `dealId?`, `assigneeId: string`, `dueDate: ISODate`, `priority?: 'Low'\|'Normal'\|'High'`, `confirm?: boolean` | `Task` (`TASK-001`) or `needsConfirmation` preview | Writes through `state.js` so autosave, history and audit run exactly as for the UI. |
| 24 | `addComment` | `objectType: 'project'\|'unit'\|'deal'\|'document'`, `objectId: string`, `text: string`, `visibility?: 'internal'\|'client_visible'`, `confirm?: boolean` | `Comment` (`CMT-001`, status `Open`) | Client sessions: `visibility` forced to `client_visible`, author = client user; internal notes only from `INT`. |
| 25 | `getDataCompleteness` | `scope: 'project'\|'unit'\|'brand'\|'deal'`, `id?: string`, `projectId?` | `{ score, missing: [{field, rule}], total }` | Rules of §40; used by the data-hygiene panel. |
| 26 | `getVisibleDocuments` | `objectType`, `objectId` or `projectId` | `DocumentMeta[]` `{id, fileName, category, version, visibility, uploadedAt, downloadable}` | `downloadable:true` and `localUrl` for client sessions only when `visibility:'client_visible'` (approved downloads, §35); never for `internal` or `restricted` documents. |

RECOMMENDATION — three additional tools that the §51 request list needs and §41/§27 already require as rules; they follow the same registration rules: `getStaleDeals(days?, stage?, projectId?, managerId?)` (INT, internal), `getClientCommentsAwaitingResponse(projectId?)` (INT, internal), `listTools()` (ALL; returns `describe()` filtered to the caller's role). They are not part of the §52 minimum and may be dropped if time is short.

### 2.6 `runTool(name, params, session)` flow

```text
runTool(name, params, session)
  1. resolve      registry[name]            → unknown → {ok:false, error:'unknown_tool'}
  2. validate     params vs tool.params     → type / required / enum / id-format errors
                                             → {ok:false, error:'invalid_params', details:[{param, reason}]}
  3. permission   LSP.tools.permission.check(tool, params, session)
       3a. session present, not expired (caseos-lsp-session)          else 'no_session'
       3b. session.role ∈ roleSet(tool.requiredRole)                  else 'forbidden'
       3c. client session and tool.visibilityScope === 'internal'     → 'forbidden'
       3d. client session: every projectId / object in params must resolve to
           an assigned project (clientId → assignedProjectIds)        else 'out_of_scope'
       3e. external_agent: always 'forbidden' in v0.1 (fail closed)
  4. confirmation (write tools only)
       params.confirm !== true → {ok:false, needsConfirmation:true, preview:{...}, permanent:true}
  5. execute      ctx = { state: appState, session, visibility: services.visibilityFor(session) }
                  data = tool.handler(params, ctx)          (pure; no DOM; may call state.js writers)
  6. redact       data = services.redactForSession(data, session, tool.visibilityScope)
                  (field whitelist; client → services.clientView shapes; never a blacklist)
  7. audit        if tool.audit !== 'none' or session.role === 'client' → state.audit.push(entry)
                  always: LSP.tools.trace.push({at, name, ok, ms})
  8. return       ResultEnvelope
```

Result envelope (identical for every tool):

```javascript
{
  ok: true,
  tool: 'calculateLeasedGLA',
  data: { valueM2: 4120, denominatorM2: 12850, unitCount: 14, unitsWithoutArea: 1, formulaRef: '07_CALCULATIONS_AND_KPI_RULES.md §3.1' },
  provenance: {
    kind: 'calculated',              // 'platform' | 'calculated' | 'external' | 'assumption' | 'unavailable'
    sources: ['units', 'deals'],     // appState keys read
    computedAt: '2026-09-17T09:30:00Z',
    schemaVersion: 1,                // meta.schemaVersion (D9)
    redactedFor: 'manager'           // session role the result was filtered for
  },
  warnings: ['1 unit without area excluded from sums'],
  missing: [{ id: 'UNIT-017', field: 'area.glaM2' }],
  error: null
}
```

Error codes: `unknown_tool`, `invalid_params`, `no_session`, `forbidden`, `out_of_scope`, `needs_confirmation` (as `needsConfirmation:true`), `not_found`, `service_error` (caught exception, message sanitised, stack only in `trace`). Errors never leak fields the caller may not see (a `not_found` is returned for out-of-scope objects when the caller could not know they exist).

### 2.7 Audit entry format (§54)

Written by `state.js` (`appState.auditLog`, ID `AUD-001`, same writer the UI uses). Fields follow §54 one-to-one; unused fields are `null`, not omitted, so the shape is stable for the SQL mapping in section 7.5.

| Field | Type | §54 item | Content |
|---|---|---|---|
| `id` | `ID<AUD>` | — | `AUD-000123` |
| `at` | ISO datetime | timestamp | UTC |
| `userId`, `userName`, `role` | string | user | From `session`; `clientId` added for client sessions |
| `channel` | enum | — | `'ui'` \| `'tool'` \| `'palette'` \| `'import'` \| `'export'` |
| `action` | string | action | `'tool.createTask'`, `'unit.statusChanged'`, `'report.generated'`, `'export.json'`, `'ecosystem.publish'` |
| `prompt` | string \| null | prompt | Palette text that triggered the call (section 3); `null` for UI actions |
| `toolsUsed` | string[] | tools used | `['searchUnits','suggestBrandsForUnit']` for a palette chain |
| `datasetsAccessed` | string[] | datasets accessed | appState keys read (`provenance.sources`) |
| `objectType`, `objectId` | string | — | Primary object touched |
| `fieldsChanged` | `[{field, from, to}]` | fields changed | Only for permanent changes; values truncated to 200 chars |
| `reportId`, `exportId` | string \| null | reports generated, exports produced | `RPT-…` / export file name |
| `clientVisible` | boolean | client-visible actions | true when the change is visible in the portal or made by a client |
| `permanent` | boolean | permanent changes | true for writes, false for reads and previews |
| `ok`, `error` | boolean, string \| null | — | Denied calls are recorded too (`ok:false`, `error:'forbidden'`) |

Prototype limit: the log lives in localStorage with the rest of the state (D9); it is not tamper-proof and is included in `LSP_backup_YYYY-MM-DD.json`. Production keeps an append-only table (section 7.4).

### 2.8 Tests (see 10_QA_PLAN.md)

`docs/qa/tools/lsp_tools.js` (Node, no browser): every registry entry has all metadata fields; `describe()` is JSON-serialisable and contains no functions; each of the 26 tools runs against the demo dataset for each role; client session cannot obtain commission, internal notes, restricted contacts, the `localUrl` of internal/restricted documents or another client's project through any tool (§65 "client cannot see…"); write tools without `confirm` do not change state; denied calls create audit entries; `calculateLeasedGLA` + `calculateVacantGLA` + under-negotiation + unavailable = project GLA from units (D6 partition).

---

## 3. Optional deterministic "Ask" palette

Status: OPTIONAL, decision D12; not on the critical path (09_IMPLEMENTATION_PLAN.md places it in the last phase; Q-12-1). Label in the UI: **"Ask (prototype) — deterministic commands, no AI"**. It exists to prove that P2 holds: a text request becomes a tool call through the same permission checker, with no model involved.

Mechanics: an input on the internal dashboard (`js/views/ask.js`, one optional file added to the D2 list; not rendered for `client` sessions). Text is lower-cased and trimmed, matched against an ordered intent table (first match wins), entities are extracted from the match (`unit number`, `project name`, `person name`, `category`, `days`) and resolved through the search tools (`searchUnits`, `searchProjects`, users by name); the resolved call runs through `LSP.runTool` with the live session; the result renders as a table or list under an "Executed: `toolName(params)`" line plus the provenance badge. Unmatched text shows the ten supported phrasings. No text generation, no ranking, English only in v0.1 (Russian intents are a later addition, A-12-8).

| # | §51 request | Intent regex (simplified) | Tool call | Result rendering |
|---|---|---|---|---|
| 1 | "Show all deals without follow-up for 7 days." | `deals? (without\|with no) (follow-?up\|next action)( for (\d+) days)?` | `getStaleDeals({days: n ?? config.stale.dealDays})`; without the number: `getDealsWithoutNextAction()` | Deal table with manager and last activity |
| 2 | "Which units have no active prospects?" | `units? .* no (active )?prospects?` | `filterUnits({availabilityGroup:'available', hasOpenDeals:false})` | Unit table, link to plan |
| 3 | "Prepare this week's owner report." | `(prepare\|generate) .*owner report` | `generateOwnerReport({projectId: currentProject, profile:'client', periodFrom: −7d, persist:false})` | Report preview; "Save" button calls again with `persist:true, confirm:true` |
| 4 | "Which brands fit Unit 204?" | `brands? .* (fit\|match\|suit) .*unit (\S+)` | `searchUnits({query})` → `suggestBrandsForUnit({unitId})` | Ranked list with criteria and disclaimer |
| 5 | "Show all F&B brands interested in Tashkent." | `(\S+) brands? .* (interested in\|targeting) (\S+)` | `searchBrands({category, targetCity})` | Brand table |
| 6 | "Which deals are stuck in negotiation?" | `deals? .* stuck in (\S+)` | `getStaleDeals({stage:'Negotiation'})` | Deal table with days in stage |
| 7 | "Show units leased but missing signed contracts." | `units? .* leased .* (missing\|without) .*contract` | `filterUnits({countsAs:'leased', missingDocumentCategory:'Contract'})` | Unit table with document column |
| 8 | "Summarize what changed in Project X this week." | `(summari[sz]e\|what) changed in (.+?)( this week\|since (.+))?` | `searchProjects({query})` → `getProjectChanges({projectId, since: −7d})` | Grouped change list (status, stage, documents, comments) |
| 9 | "Which merchandise categories are below target?" | `categor(y\|ies) .* (below\|under) target` | `aggregateMerchandiseMix({projectId: currentProject, basis:'gla'})` filtered `gap < 0` | Category table with target/actual/gap |
| 10 | "Create a follow-up list for Nodir." | `follow-?up list for (\S+)` | `getOverdueTasks({assigneeId})` + `getDealsWithoutNextAction({managerId})` | Two lists; **read-only** — creating tasks requires the explicit `createTask` confirmation |

Notes. Request 10 resolves the name against `users[]`; in the demo dataset the users are fictional (A-2), so the demo phrasing uses a demo user name. Requests 3 and 9 need a project context (current project or a project name in the text); otherwise the palette asks to pick one. Every palette call writes `prompt` and `toolsUsed` into the audit entry when the underlying tool is audited (section 2.7).

---

## 4. Future AI architecture

### 4.1 The §53 chain mapped onto LSP

```text
User request  →  AI interface  →  Intent parser / planner  →  Permission checker
             →  Structured tool registry  →  Application services  →  Data platform
```

| §53 layer | v0.1 (this plan) | Production (later, A-12-4) |
|---|---|---|
| User request | Ask palette text (section 3), UI actions | Internal chat/assistant surface; client assistant inside the portal |
| AI interface | none (no LLM) | Server-side gateway that holds provider keys, session, rate limits; the browser never calls a model provider directly |
| Intent parser / planner | Regex intent table, one tool per intent | Model-based planner that may only emit tool calls from `describe()`; free-text answers must cite the envelope `provenance` |
| Permission checker | `LSP.tools.permission` in the browser (prototype only) | Server-side authorization with the same role × capability matrix (04_ROLES_AND_VISIBILITY.md); the browser check remains as UX, never as security |
| Structured tool registry | `LSP.tools.registry`, `describe()` | The same names, params and `readOnly` flags exposed by a server (MCP transport, section 4.2) |
| Application services | `js/services.js` | Server-side services (PHP or SQL functions) implementing the same rule documents (05, 07) |
| Data platform | `appState` in localStorage (D9) | SQL database (section 7) |

### 4.2 MCP as the likely transport (reference only)

FACT (00_MASTER_PROMPT.md §58, §60 priority 2): the Model Context Protocol specification and reference servers are listed as official references; §58 also says "Do not add an AI framework to the MVP without a clear requirement." Accordingly nothing is adopted now; audit rows are in `11_REPOSITORY_AUDIT.md`.

Why the registry is shaped as it is: MCP servers publish a tool list (name, description, JSON-Schema input) and execute tool calls, and the specification defines tool annotations that express whether a tool is read-only or destructive. The `describe()` output (section 2.2) already contains the equivalent information (`params` as JSON-Schema subset, `readOnly`, `requiresConfirmation`), so a future MCP server can be a thin adapter over the same service layer without renaming a single tool. LangChain, LlamaIndex, PydanticAI, LiteLLM, AutoGen and the OpenAI Agents SDK (§58) are planner/orchestration candidates on the gateway side and are not evaluated in this phase.

### 4.3 Rules for the future AI layer (binding for the production design)

1. Tool-only access: the model receives `describe()` filtered to the session role; it never receives table dumps, SQL access or the state blob (§55).
2. Provenance discipline: every statement in an answer is tagged with the envelope kind; `unavailable` is shown as "not available", never as 0 or as an estimate (§53, §69).
3. Confirmation: any `readOnly:false` tool requires the user to confirm the preview in the UI; the model cannot set `confirm:true` itself. No autonomous multi-step writes.
4. Client assistants run with a `client` session and can reach `visibilityScope:'session'` tools only; their answers are limited to `services.clientView` output (§51 "Client AI must only use approved client data").
5. Untrusted content: comment text, document names, brand notes and imported CSV values are data, never instructions (prompt-injection defence); the planner sees them only inside tool results.
6. Logging: gateway writes the §54 entry with `prompt`, `toolsUsed`, `datasetsAccessed` for every request, including refused ones.
7. External research (web, market data) enters only as `provenance.kind:'external'` with a source list and is never written into platform records without a confirmed write tool.

---

## 5. Geoanalytics integration (§49)

### 5.1 What CASE OS already holds (FACTS)

| Component | File(s) | What it contains / does |
|---|---|---|
| Geoanalytics workspace | `os/v420-geoanalytics.js`, `os/v420-geo-studio.js`, `os/geoanalytics-studio.html` | Workspace module (iframe studio). Project rows come from `OBJECTS` (with `lat`, `lng`), `GEO_DATA.projects` and `CASE_PORTFOLIO_PROJECTS`. |
| Geo state | `os/api/geo_state.php`, `GEO_DATA` in the state blob | Shape `{version:2, status:'manual_review', updatedAt, updatedBy, projects:[profiles], datasets:{bc, medicine, pharmacies, population, districts, region, market, prices, metro, roads, + POI layers}}`; server-side validation of coordinates/URLs; `geo_state_history` table (50 snapshots, restore by admin). Access gate `asaas_workspace_can_view($u,'geoanalytics')`; edit `asaas_geo_can_edit` = `edit \|\| finance \|\| admin` (`os/api/lib.php`). |
| Geo master base | `os/api/geo_master.php`, `os/data/geo_master/` (`runtime.json`, `summary.json`, `master.csv`, `master.geojson`, `research_queue.csv`, `qa_issues.csv`, SQLite) | Integrated Tashkent base v4.8.1 (generated 2026-07-19): 3,292 objects — 148 business centres, 1,530 medicine, 1,027 pharmacies, 545 mahallas, 42 F&B; 3,156 records `needs_review`, 118 possible duplicates. Records carry `master_id` (e.g. `BC-75e17f93c6aa`), `seed_object_id` (`SEED000052`), `lat`/`lng`, `data_confidence` A/B/C, `possible_duplicate`, `duplicate_group_id`, `provider`. Full exports require edit/finance/admin. |
| GIS proxy | `os/api/gis_proxy.php` | Isochrones / POI / routes through external providers; keys stay server-side in `api/config.php`. |
| Collectors | `os/api/geo_collector.php`, `geo_education_export.php`, `geo_seed_convert.php` (CLI only) | Multi-source POI collection (OSM Overpass / Google Places / Yandex / 2GIS). |
| Market data | SQL `market_data_sources`, `market_data_points`, `gis_analysis_cache` (`os/sql/schema_mysql.sql` lines 733–790) | Macro indicators keyed by country/region/city; cached GIS analyses keyed by `object_id` + lat/lon. |
| Portfolio | `os/data/case_portfolio.geojson` | Reference projects with ids like `portfolio-001`, GBA/GLA, coordinates. |
| Demo-mode limit | `HANDOFF_CASE_OS.md` (v4.32.1 note) | The geo studio always calls the real `auth.php` + `workspace_access.php`; in demo mode it refuses. This is an intentional access guard. |

Consequence: Geoanalytics is a live CASE OS module with its own permission gate and identifier (`master_id`). LSP does not embed maps in v0.1 (no Leaflet/MapLibre, §57 "only if needed"; A-12-5); it links through identifiers and produces a publishable payload.

### 5.2 Shared identifier model (D13)

LSP internal IDs are the primary keys and never change. Ecosystem identifiers live in `externalIds` on projects, buildings and units (D13); the map is extensible (03_DATA_MODEL.md owns the field list).

| LSP entity | Internal ID | `externalIds` key | Value example | Source / owner |
|---|---|---|---|---|
| project | `PROJ-001` | `caseOsObjectId` | `'ca'` | CASE OS `OBJECTS.id`; set by the import adapter (D1) |
| project / site | `PROJ-001` / `SITE-001` | `propertyId` | `PROP-UZ-TAS-000123` | §49 unified Property ID; issued by the Geo registry (Q-12-3) |
| project | `PROJ-001` | `geoMasterId` | `BC-75e17f93c6aa` | `master_id` of the matching geo master record |
| building | `BLDG-001` | `propertyId` | `PROP-UZ-TAS-000123-B01` | RECOMMENDATION (A-12-6): property id + building suffix |
| floor | `FLOOR-001` | `propertyId` | `PROP-UZ-TAS-000123-B01-F02` | Derived, same rule |
| unit | `UNIT-001` | `caseOsUnitCode`, `propertyId` | `'B1_104'`, `PROP-UZ-TAS-000123-B01-F02-U0104` | CASE OS `U.code` (unique per `obj_id`); property-scoped unit id |
| brand | `BRAND-001` | — | — | Brand IDs are shared as-is (§49 "Brand ID"); Geo references LSP brand ids |
| company | `COMP-001` | — | — | Same |

Rules: (1) `propertyId` format is a working proposal — "the final format can change, but IDs must remain stable" (§49) — so LSP stores it as an opaque string and never parses it; (2) coordinates are WGS84 decimal degrees with 6 decimals on `project.latitude/longitude` (§9) and are the LSP source of truth for mandate projects; Geo may hold a verified pair, and a mismatch above 50 m is surfaced as a data-hygiene warning, not auto-corrected; (3) `assetTypes`, `address`, `city`, `country` use the same vocabulary as CASE OS `objects.type/city/country` via the import mapping table (03_DATA_MODEL.md).

### 5.3 Data classification for publication

Visibility levels (D7): `internal`, `client_visible`, `restricted`, `public`. Only `public` items may ever leave the platform towards the ecosystem; the classification is per field, not per object.

| Data item | LSP source | Default classification | May reach Geoanalytics? |
|---|---|---|---|
| Property existence, name, address, coordinates, asset type | `project.*` | `public` once `project.ecosystem.publishProfile ≠ 'none'` | Yes |
| Declared GBA / GLA | `project.areas.gbaM2/glaM2` | `client_visible` → `public` by project setting | Yes, when profile ≥ `presence` |
| Availability indicator (has available units; available GLA rounded; leased %) | derived from `calculateVacantGLA` / `calculateLeasedGLA` | `client_visible` → `public` by project setting | Yes, when profile ≥ `availability` |
| Tenant / brand presence (brand, category) for `Occupied` units | `unit.actualUse.brandId` | `client_visible` → `public` when the brand is not `restricted` | Yes, when profile = `tenants` |
| Unit-level statuses, unit list, plan | `units`, `floorPlans` | `internal` / `client_visible` | No (client portal only) |
| Asking / agreed rents, sale prices, deal stages, prospects | `unit.leasingTerms`, `deals` | `internal` | Never (§49 "Do not publish confidential leasing data automatically") |
| Commissions, internal notes, contacts, staff performance | various | `internal` / `restricted` | Never |

RECOMMENDATION (new field, for 03_DATA_MODEL.md): `project.ecosystem = { publishProfile: 'none' | 'presence' | 'availability' | 'tenants', lastPublishedAt, lastPublishedBy, propertyIdIssuedAt }`, default `'none'` (Q-12-4).

### 5.4 Flows

**Geoanalytics → LSP.** A user on the geo map selects a property and opens permitted leasing information (§49). Prototype implementation (cheap, recommended for v0.1): the LSP router accepts `#/lookup?externalId=PROP-UZ-TAS-000123` (or `?externalId=` on `os/leasing/index.html`), calls `searchProjects({externalId})` with the current session and opens the project dashboard or shows "not found / no access". The permission gate is the ordinary session check (3b–3d): a client or scoped user who is not assigned to the project receives `not_found`. No data crosses; only an identifier. Production: same link from the CASE OS geo studio; single sign-on is the CASE OS session (section 7.6 step 9).

**LSP → Geoanalytics.** Approved data may update property status, tenant presence, verified building data, availability indicators and market data (§49). Implementation: `services.ecosystem.buildPublication(projectId)` produces a payload strictly from `public`-classified fields per 5.3:

```javascript
{ propertyId, geoMasterId, caseOsObjectId, name, address, city, country, latitude, longitude,
  assetTypes, glaM2Declared, availability: { hasAvailableUnits, availableGlaM2Rounded, leasedPercent },
  tenants: [{ brandId, brandName, category }], asOf, classification: 'public',
  publishedBy, sourceSystem: 'LSP', schemaVersion }
```

Gate: only `LEAD` roles, explicit action "Publish to Geoanalytics", preview of exactly what leaves, then an audit entry `ecosystem.publish` (`clientVisible:true`, `permanent:true`, `exportId`). v0.1 downloads the payload as JSON (no network, D1); production POSTs it through a server-side endpoint that re-applies the classification (section 7.4). Nothing is published on save or on status change — publication is always a deliberate act.

### 5.5 How identifiers will link with the existing CASE OS geo data

1. Import adapter (D1, 08_PERSISTENCE_IMPORT_EXPORT.md) fills `externalIds.caseOsObjectId` and `caseOsUnitCode` for every imported project/unit.
2. `GEO_DATA.projects` profiles are keyed by CASE OS object id; when a profile references a geo master `master_id`, the adapter copies it into `externalIds.geoMasterId`; otherwise the field stays `null` and appears in the completeness check.
3. For projects without a link, a later "Suggest geo match" action may propose master records within 50 m and similar name, using `data_confidence`; the user confirms — suggestions only, never automatic (mirrors §39 wording). Not built in v0.1.
4. `propertyId` is issued by the Geo registry process (Q-12-3) and entered manually or via CSV import until an API exists.

---

## 6. Building OS / Asset Management / Facility Management extension points (§50)

### 6.1 The spatial entity layer

FACT (§50): "the interactive floor plan should evolve into a reusable spatial entity layer." In LSP the layer is `buildings` + `floors` + `floorPlans` + `units` (D8): units are stable spatial entities (`UNIT-001`, `geometry.polygonId`, `centroid`, `areaSource`), plans are versioned records whose `polygonMappings: [{polygonId, unitId}]` bind geometry to entities without ever renaming the entity. Every future module must reference `UNIT-`, `FLOOR-`, `BLDG-` ids, never polygon ids or plan versions.

Gaps the layer will need later (not built now): non-leasable spaces (corridors, plant rooms, parking, common areas) and equipment locations. They are planned as separate entity types so that `units` keeps meaning "commercial unit" and inventory KPIs (D6) never absorb technical spaces.

### 6.2 Planned state keys (reserved names — RECOMMENDATION)

Reserving the names now prevents collisions in `state.js` migrations (D9 `meta.schemaVersion`). None of these keys exist in v0.1; `settings.modules` carries flags (`assetManagement:false`, `facilityManagement:false`, `buildingOs:false`) so views can hide what is not built.

| Future module | Reserved appState key | ID prefix | Links to spatial layer | Core fields (indicative) |
|---|---|---|---|---|
| Lease administration (Building OS / AM) | `leases` | `LEASE-` | `unitIds[]`, `projectId` | `dealId` (origin), `tenantCompanyId`, `brandId`, `startDate`, `expiryDate`, rent schedule, `indexation`, options, `status` |
| Rent roll | derived from `leases` + `units` | — | — | Computed, never stored (same rule as derived pipeline stage) |
| Rent collection / arrears (AM) | `invoices`, `payments` | `INV-`, `PAY-` | via `leaseId` | amounts, due/paid dates, currency |
| Budget / forecast / NOI / plan vs actual (AM) | `budgets` | `BUD-` | `projectId`, `buildingId` | period, lines, actuals |
| CAPEX (AM / Building OS) | `capexItems` | `CAPEX-` | `buildingId`, `floorId`, `unitId?` | scope, amount, status |
| Spaces beyond units (Building OS) | `spaces` | `SPACE-` | `floorId`, `polygonId` on the plan version | type (common, technical, parking), area |
| Equipment / technical systems (Building OS / FM) | `equipment` | `EQ-` | `spaceId` or `unitId` | system, model, install date, warranty |
| Work orders / helpdesk (FM) | `workOrders` | `WO-` | `unitId` / `spaceId` / `equipmentId` | requester, priority, SLA, status |
| Inspections / incidents (FM / Building OS) | `inspections`, `incidents` | `INSP-`, `INC-` | any spatial id | date, findings, photos (document ids) |
| Vendors / SLAs (FM) | `vendors`, `slas` | `VEND-`, `SLA-` | `projectId` | contract, scope, KPIs |
| Energy / meters (Building OS) | `meters` | `MTR-` | `spaceId` / `buildingId` | readings series |

Roles reserved by §31 for these modules (Asset Manager, Facility Manager, Technical Manager, Property Manager, Finance, Owner Representative, Tenant Portal User, Field Inspector) are listed in 04_ROLES_AND_VISIBILITY.md as future roles with no capabilities in v0.1.

### 6.3 Interfaces that v0.1 must expose so later modules can plug in

| Interface | Where | Contract | Why |
|---|---|---|---|
| Spatial query API | `services.spatial` | `listBuildings(projectId)`, `listFloors(buildingId)`, `listUnits(floorId)`, `currentPlan(floorId)`, `resolvePolygon(unitId, planId?)`, `unitsByPolygonIds(planId, ids[])` | One way to go from entity to geometry and back |
| Plan mode registry | `js/floorplan.js` → `LSP.floorplan.registerMode({key, label, legend(), colorFor(unit, ctx), patternFor(unit, ctx), labelFor(unit, ctx), tooltipFor(unit, ctx)})` | The five D8 modes are registered through the same call; a future FM module registers "Open work orders per unit" without editing `floorplan.js` | Extension without modification |
| Event bus | `LSP.events.on(type, handler)` / `emit(type, payload)` in `state.js` | Event types: `unit.statusChanged`, `deal.stageChanged`, `deal.closedWon`, `plan.versionPublished`, `document.registered`, `comment.added` | Views re-render through it today; future modules subscribe (e.g. `deal.closedWon` → draft lease); production replaces it with an outbox/webhook |
| Lease handover mapping | documented in `03_DATA_MODEL.md` | `deal.commercialTerms.*` and `unit.leasingTerms.*` → future `leases` fields; `outcome.signedDate` → `lease.startDate` candidate | Prevents a second vocabulary for terms |
| Drawer sections | `js/views/units.js` unit drawer | Section registry (`registerDrawerSection({key, roles, render(unit, ctx)})`) | FM/AM add tabs (work orders, rent roll) without forking the drawer |
| Tool registry | section 2 | New modules register their own tools with the same metadata, role sets and audit rules | One AI surface for the whole ecosystem |

### 6.4 Explicitly not built in v0.1 (§50 "Do not implement these now")

No lease administration beyond `unit.leasingTerms` and `deal.commercialTerms`; no rent roll, rent collection, arrears, turnover, OPEX/NOI, budgets, forecasts, plan vs actual; no CAPEX register; no work orders, helpdesk, preventive maintenance, equipment, technical systems, incidents, inspections, energy, vendors, SLAs; no tenant portal; no IoT/BMS connectors; no BIM/IFC/CAD import (§16); no non-unit spaces on plans. Navigation contains no placeholders for them (§63 "no empty navigation destinations").

---

## 7. Future production architecture (§66 G)

### 7.1 Hosting reality (FACTS from `HANDOFF_CASE_OS.md`)

- Live site `https://caseadvisory.uz/os/` on DirectAdmin shared hosting (Apache + PHP + MySQL). Deployment is a manual ZIP upload of `os/`; there is no automatic deployment from GitHub and the owner does not want one. Release ZIPs exclude `api/config.php` and secrets.
- A production check on 27.07.2026 found PHP 7.2 in the terminal (EOL; upgrade to 8.1 recommended), a state blob of 5.1 MB of which `PLANSVG` is 3.1 MB, and cron to be configured by the owner. Database dumps were moved above `public_html` (`caseos_backups`) after an audit finding.
- The whole-blob `state.php` model silently rolled back keys a role could not write (`state_key_denied`, ~400 rejections in one production week) until v4.51 surfaced `rejected_keys`; `unit_patch.php` / `units_batch.php` are the per-entity endpoints that avoid it.
- The dev environment has PHP without a MySQL driver; server logic is checked with `php -l` and `docs/qa/tools/mock_backend.js`; real DB acceptance is done by the owner on staging (checklist A–J).
- CSP in `os/.htaccess`: `connect-src 'self' https:` (any HTTPS API host is reachable), `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net`.

### 7.2 Frontend: stays static JS

The LSP frontend does not change technology (no build step, D2). `js/state.js` gets a storage adapter interface so views and services stay untouched:

```text
StorageAdapter { load(): Promise<State>, save(patch: EntityPatch[]): Promise<Ack>, subscribe(onRemoteChange) }
  LocalStorageAdapter   v0.1 — keys caseos-lsp-state-v1 / caseos-lsp-backup-v1 (D9)
  ApiAdapter            production — per-entity REST calls, optimistic concurrency via updatedAt/revision
```

RECOMMENDATION: entity-level endpoints with revision checks, not one state blob — the CASE OS blob model produced the silent-rollback problem and a 5 MB payload; plan SVG text moves to file storage. The tool registry `params` schemas double as request validation schemas on the server.

### 7.3 Backend options

| Criterion | Option A — extend the existing PHP + MySQL API | Option B — PostgreSQL + PostGIS via PostgREST or Supabase |
|---|---|---|
| Fit with hosting (7.1) | Native: same DirectAdmin account, same `os/api/lib.php` sessions/roles, same manual ZIP deploy, `migrate.php` migrations | Needs a VPS or managed service outside DirectAdmin; second system to operate and back up |
| Team / process | Known to the team; owner tests on staging; no new deploy skills | New skills (PostgreSQL, RLS policies, PostgREST/Supabase auth); new deploy process |
| Client segregation, RBAC | Implemented in PHP code (`require_login`, role flags, `redact_shared_state`-style whitelists); no DB-level enforcement | Row-level security policies enforce client scope in the database; JWT roles |
| Geo | MySQL spatial types are basic; joins with `market_data_points` / `gis_analysis_cache` already exist | PostGIS (§57) for spatial joins, isochrone storage, geo master consolidation; `pgvector` later for semantic search |
| Files | `project_files.php` pattern (25 MiB, outside web root, index.json) | Supabase Storage or object storage with signed URLs |
| Risk | PHP 7.2 on the host; shared-hosting resource limits; hand-written authorization must be complete | Data residency of Uzbek client data on a foreign managed service (Q-12-2); vendor dependency; cost |
| Time to fold-back (7.6) | Shortest | Longer; duplicates CASE OS core tables during transition |

RECOMMENDATION (hybrid, Q-12-2): Phase 1 — fold LSP back into CASE OS with Option A (`os/api/lsp_*.php`, `lsp_*` tables in the same MySQL, CASE OS login), because one platform, one login and one deploy matter more than database features at this stage. Phase 2 — when Geoanalytics consolidation, PostGIS joins or a multi-client portal at scale require it, migrate the data platform to PostgreSQL + PostGIS on a controlled server (self-hosted PostgREST or Supabase), keeping the frontend and the tool registry unchanged (`ApiAdapter` swap). PHP 8.1 upgrade and a staging environment are prerequisites for Phase 1.

### 7.4 Production requirements (§55) and how each is met

| Requirement | Production design | Reuse from CASE OS |
|---|---|---|
| Role-based access | Server-side authorization table generated from the role × capability matrix (04_ROLES_AND_VISIBILITY.md); every endpoint checks role, project scope and ownership; browser checks remain UX only | `roles` table, rights flags, `asaas_workspace_hard_allowed` fail-closed pattern |
| Client segregation | `client_users` in a separate login realm; `client_project_access` join; every client query filtered by `clientId` server-side (RLS in Phase 2); no cross-client ids in responses | `redact_workflow_project_scope` idea, `sanitize_owner_report_snapshot` (whitelist generalised) |
| Private fields | `visibility` column on rows plus a per-role field whitelist applied server-side — the same JSON whitelist `services.clientView` uses in the browser, shipped as a shared config file | Owner-report sanitiser |
| Audit logs | Append-only `lsp_audit_log` with the §54 fields (section 2.7); no ring-buffer truncation; retention policy | CASE OS `audit_log` table (but not its 600-entry client ring) |
| Secure file storage | Files outside the web root, SHA-256, allow-listed types, signed time-limited download URLs checked against role and `visibility`; versions; optional malware scan | `project_files.php` (`data/case_files`, 25 MiB, index.json) |
| Server-side authorization | Every write validates against the same param schemas as the tool registry; denied calls audited | `unit_patch.php` 403 pattern |
| Session management | Server sessions, 12 h cookie lifetime with idle logout; separate client sessions; MFA/OTP for `founder_admin` | `login_codes` (email OTP), keepalive ping, `IDLE_LOGOUT_MIN` |
| Encryption | TLS + HSTS (exists); secrets only in `api/config.php` outside the repo; at-rest encryption per hosting capability; no secrets in localStorage | `.htaccess` HSTS, config exclusion from ZIPs |
| Backups | Nightly DB dump + file store to a location above `public_html`; restore drill each quarter; exports never contain secrets | `backup.php` → `caseos_backups` |
| Secure APIs | Versioned JSON REST `/os/api/lsp/v1/*`; schema validation; rate limits and login throttling; CORS limited to the site origin; CSP tightened (drop `unsafe-eval` once no module needs it) | `.htaccess` CSP |
| AI gateway | Section 4.3; the gateway is the only component with provider keys; tools only | — |

### 7.5 appState → SQL table mapping (outline)

String primary keys keep the LSP ID formats (`VARCHAR(24)`, e.g. `PROJ-001`) so JSON export/import round-trips and audit references stay readable. Nested objects that are never queried on their own stay JSON; anything joined or filtered becomes a column or a link table. Full column lists belong to 03_DATA_MODEL.md and the migration files.

| appState key | Table | PK | Notable columns / child tables |
|---|---|---|---|
| `users` | `lsp_users` (Phase 1: `app_users` + role mapping) | id | role key (LSP), CASE OS user link |
| `clients` | `lsp_clients`, `client_users`, `client_project_access` | id | client realm login; access join |
| `projects` | `lsp_projects` | `PROJ-` | `client_ids` JSON, `areas` JSON, `commercial` JSON, `team` JSON, `latitude`, `longitude`, `ecosystem` JSON, `visibility`; `external_ids` link table (`entity_type, entity_id, system, value`, UNIQUE) |
| `sites`, `buildings`, `floors` | `lsp_sites`, `lsp_buildings`, `lsp_floors` | `SITE-`, `BLDG-`, `FLOOR-` | parent ids, `status`, `floor_number` |
| `floorPlans` | `lsp_floor_plans` + `lsp_polygon_mappings` | `PLAN-` | `version`, `current`, `archived`, `effective_date`, `file_id` (SVG in file storage, not in the row); mappings `(plan_id, polygon_id, unit_id)` |
| `units` | `lsp_units` | `UNIT-` | `unit_number`, `commercial_status`, `gla_m2`, `target_use` JSON, `actual_use` JSON, `leasing_terms` JSON, `sales_terms` JSON, `responsible_manager_id`, `visibility`; UNIQUE (`project_id`, `unit_number`) |
| `brands`, `companies`, `contacts` | `lsp_brands`, `lsp_companies`, `lsp_contacts` + `contact_brands`, `contact_deals` | `BRAND-`, `COMP-`, `CONT-` | classification and expansion requirements as JSON with indexed columns for category, subcategory, min/max area, target cities |
| `requirements` | `lsp_requirements` | `REQ-` | brand/company/contact ids, structured needs |
| `deals` | `lsp_deals` + `deal_units` (`deal_id, unit_id`) + `deal_stage_history` | `DEAL-` | `type`, `stage`, `probability`, `status`, `commercial_terms` JSON (finance-flagged columns), `next_action_*`, `outcome_*`, `area_override_m2`, `visibility` |
| `tasks`, `activities`, `comments` | `lsp_tasks`, `lsp_activities`, `lsp_comments` | `TASK-`, `ACT-`, `CMT-` | object links, `visibility`, comment `response_status` |
| `documents` | `lsp_documents` + file store | `DOC-` | metadata; binary in file storage; `visibility` |
| `reports` | `lsp_reports` | `RPT-` | immutable snapshot JSON, `profile`, `period`, `generated_by` |
| `settings` | `lsp_settings` | key | JSON per config area (05_STATUSES_STAGES_AND_CONFIG.md), versioned |
| `statusHistory` | `lsp_status_history` | `SH-` | unit/deal, from, to, at, by, reason |
| `auditLog` | `lsp_audit_log` | `AUD-` | section 2.7 fields; append-only |

### 7.6 CASE OS fold-back sequence (Phase 1, schema deltas)

Each step = one migration file in `os/sql/migrations/YYYY_MM_DD_lsp_*.sql` (template `EXAMPLE_template.sql.txt`), `php -l`, a `mock_backend.js` test, then staging acceptance by the owner (HANDOFF checklist A–J). Existing CASE OS columns are kept during the parallel run; nothing is dropped before acceptance.

| Step | Delta | Purpose |
|---|---|---|
| 0 | Freeze the CASE OS ↔ LSP mapping table (03_DATA_MODEL.md) and the STAT → `commercialStatus` + open-deal split rule (D1) | Deterministic migration |
| 1 | `deals`: add `type`, `unit_ids` JSON and link table `deal_units(deal_id, unit_id)`; keep `unit_id`/`unit_code` for compatibility; extend `deal_stage_probabilities` with the LSP stage keys (05_STATUSES_STAGES_AND_CONFIG.md); add `area_override_m2`, `visibility` | Multi-unit deals (§6.5); stage vocabulary |
| 2 | New `companies` table; `brands.company_id`; backfill from `brands.group` with a review list | Companies separate from brands (§19) |
| 3 | `contacts`: add `first_name`, `last_name`, `position`, `company_id`, `phones` JSON, `emails` JSON, `messengers` JSON, `city`, `country`, `preferred_language`, `owner_id`, `last_contact`, `next_action`, `notes`, `visibility`; link tables `contact_brands`, `contact_deals`; migrate `DOC_CONTACTS` | Central contact database (§20) |
| 4 | `units`: add `commercial_status`, `target_use` JSON, `actual_use` JSON, `visibility`, `responsible_manager_id`; keep `status` (STAT) until the LCR screens read the new column | Status/stage separation (§6.3, D5) |
| 5 | `visibility VARCHAR(16) NOT NULL DEFAULT 'internal'` on `units`, `deals`, `documents`, `brands`, `contacts`, comments and notes tables; server whitelist function replacing ad-hoc `unset()` lists | Explicit visibility (§6.8) |
| 6 | `client_users`, `client_project_access`; role key `CLIENT` in `roles` with a fail-closed workspace list; separate login endpoint; portal endpoints serve `clientView` shapes only | Client / owner portal with real login (today owners only receive reports) |
| 7 | `lsp_status_history`, `lsp_audit_log`, `lsp_tasks`, `lsp_activities`, `lsp_comments` | History and audit as tables, not blob keys |
| 8 | `lsp_floor_plans` + `lsp_polygon_mappings`; SVG text moved from `PLANSVG` in the blob to file storage; one plan route (resolves audit item P1-3's three parallel routes) | Plan versioning (D8); blob shrinks by ~3 MB |
| 9 | Add LSP to the v3520 workspace catalog behind a per-role module flag; parallel run of LCR and LSP; retire LCR editing after acceptance; then CASE OS `APP_VERSION`, `sw.js` cache and `core.js?v=` bumps per HANDOFF rules | Controlled cut-over |

---

## 8. Security and privacy checklist (§55)

### 8.1 Prototype (must all be true before v0.1 is released inside the `os/` ZIP)

- [ ] No API keys, passwords, tokens or real credentials anywhere under `os/leasing/` or in `docs/leasing-platform/`.
- [ ] Login screen and `README.md` show "Prototype authentication only. This does not provide production security." (§6.1); demo users are selected by name with no real passwords.
- [ ] No UI text, README line or document claims security, encryption, OCR/CV recognition or backend features.
- [ ] Demo data is fictional (A-2) and every record has `demoRecord:true`; a "DEMO DATA" banner is visible.
- [ ] Client segregation is enforced in `services` (not in views) and covered by tests: a client session cannot obtain other clients' projects, internal notes, commissions, negotiation terms, restricted contacts or the `localUrl` of internal/restricted documents through any view, report, export or tool (§65).
- [ ] The portal renders only from `services.clientView` output; commission fields never appear in the portal DOM (test in 10_QA_PLAN.md).
- [ ] Uploaded SVG plans are sanitised (strip `<script>`, `<foreignObject>`, `on*` attributes, external references) before insertion; the app runs under the `os/.htaccess` CSP without changes.
- [ ] No `fetch()` and no external runtime dependency; the only external resource is Google Fonts with a system fallback (D14).
- [ ] `LSP.runTool` denies by default: unknown role, `external_agent`, unknown tool, missing session → denied and audited.
- [ ] Write tools cannot bypass confirmation; write paths go through `state.js` writers so `statusHistory` and `auditLog` are always written.
- [ ] JSON import validates schema and referential integrity before replacing state; a failed import leaves the previous state and the backup slot intact (D9).
- [ ] Exports (`LSP_backup_YYYY-MM-DD.json`, CSV) show a notice that they may contain internal data and must be stored on company devices only.
- [ ] Real CASE OS backups imported for testing (D1 adapter) stay in the browser's localStorage of the tester's device; testers use company devices and clear the state afterwards (A-12-7).
- [ ] `docs/qa/lsp/*.json` results contain no personal data from imported real backups.

### 8.2 Production (gate for any deployment that holds real client data or a client login)

- [ ] Server-side authorization on every endpoint with the same role × capability matrix; browser checks are UX only.
- [ ] Client realm: separate `client_users`, project access join, per-request `clientId` filtering (RLS in Phase 2); penetration test of the portal before the first client login.
- [ ] Field-level redaction executed on the server from one shared whitelist config; no blacklist-based stripping.
- [ ] Append-only audit log with the §54 fields, including refused calls, exports and publications; retention and access rules defined.
- [ ] Secrets only in `api/config.php` (outside the repo and outside ZIPs); rotation procedure; no secrets in logs or URLs.
- [ ] Files outside the web root, signed time-limited download URLs, type allow-list, size limits, checksum; backups of the file store.
- [ ] TLS + HSTS; CSP tightened (`unsafe-eval` removed once possible); security headers on API responses as in `geo_master.php`.
- [ ] Sessions: server-side, idle timeout, OTP/MFA for `founder_admin`, login throttling.
- [ ] Nightly backups above `public_html`, quarterly restore drill, documented recovery time.
- [ ] Personal data of contacts (names, phones, e-mails, messengers) handled under the applicable personal-data legislation: purpose, retention period, deletion on request; the contact database is `internal` by default and `restricted` where marked (Q-12-7).
- [ ] AI gateway: provider keys only on the server; tool-only access; confirmation for writes; prompt-injection handling for comment/document text; per-request audit; data-residency decision documented (Q-12-6).
- [ ] Ecosystem publication: only `public`-classified fields, only by `LEAD` roles, always audited; no automatic publication on data change.
- [ ] Third-party code adopted only after the §60 review; `11_REPOSITORY_AUDIT.md` kept current.

---

## 9. Assumptions, open questions, cross-references

### 9.1 Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | English base UI with Russian dictionary (brief D3) | Palette intents and tool descriptions are English in v0.1 |
| A-2 | Demo data is fictional (brief D4) | Palette example names refer to demo users |
| A-3 | Merchandise categories per brief D15 | `category` params use these keys |
| A-12-4 | Future AI runs server-side behind a gateway; the browser never holds provider keys | If a browser-side model were wanted, the permission checker would have to move server-side first |
| A-12-5 | Geoanalytics stays a CASE OS module (v420, geo master) in the medium term; LSP links by identifiers and does not embed maps in v0.1 | A map view in LSP would require MapLibre (§57) and a repository audit row |
| A-12-6 | The working Property ID format `PROP-<ISO2>-<CITY3>-<6 digits>` with `-Bnn / -Fnn / -Unnnn` suffixes is acceptable until the Geo registry fixes the final format | Only `externalIds` values change; internal IDs are unaffected |
| A-12-7 | Hosting stays DirectAdmin (PHP + MySQL) for the fold-back phase; testers use company devices for real-data imports | If hosting changes first, Option B becomes Phase 1 |
| A-12-8 | Russian palette intents are added after the English set is validated | None on architecture |

### 9.2 Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-12-1 | Include the optional Ask palette in v0.1? | Include only if the phases before it in 09_IMPLEMENTATION_PLAN.md are complete; otherwise v0.2. The tool registry itself is mandatory. | Founder / product sponsor |
| Q-12-2 | Backend: Option A, Option B or hybrid (7.3)? Data residency for a foreign managed service? | Hybrid: Option A for fold-back, PostgreSQL + PostGIS when geo/portal scale requires; residency decision before any managed service holds client data. | Founder + technical lead |
| Q-12-3 | Who issues `propertyId` values and keeps the registry? | Geo team issues; LSP stores as opaque string; CSV import until an API exists. | Founder / Geo lead |
| Q-12-4 | Default `project.ecosystem.publishProfile` and who may raise it? | Default `'none'`; `LEAD` roles may raise per project after client consent recorded in `notes.internal`. | Head of Leasing & Sales |
| Q-12-5 | Audit internal read tool calls in the MVP? | No (session ring buffer only); yes in production. | Founder |
| Q-12-6 | AI provider, gateway hosting and residency for the production AI layer? | Decide at the production phase; keep the registry provider-independent. | Founder |
| Q-12-7 | Retention and deletion rules for contact personal data and client comments? | Define before production; default retention aligned with mandate duration + 3 years. | Founder / legal |
| Q-12-8 | Should `getStaleDeals`, `getClientCommentsAwaitingResponse`, `listTools` be added to the mandatory tool set? | Yes; they cost little and the §51 request list needs them. | Head of Leasing & Sales |

### 9.3 Cross-references

| Document | What it owns that this document relies on |
|---|---|
| `01_PRODUCT_SPEC.md` | MVP scope; confirms AI tool architecture and ecosystem readiness as scope items 33–35 |
| `02_REQUIREMENTS_REVIEW.md` | Corrections §6.1–§6.8 applied here (prototype auth, visibility, status/stage) |
| `03_DATA_MODEL.md` | Entity fields, `externalIds`, result shapes (`UnitSummary` etc.), CASE OS mapping, new `project.ecosystem` field |
| `04_ROLES_AND_VISIBILITY.md` | Role × capability matrix used by `LSP.tools.permission`; `restricted` handling; portal whitelist |
| `05_STATUSES_STAGES_AND_CONFIG.md` | Status and stage keys used in tool params; stale thresholds; module flags |
| `06_FLOORPLAN_ARCHITECTURE.md` | Plan versioning and mode registry that the spatial layer (section 6) extends |
| `07_CALCULATIONS_AND_KPI_RULES.md` | Formulas behind tools 14–18 (`formulaRef`) |
| `08_PERSISTENCE_IMPORT_EXPORT.md` | Import adapter that fills `externalIds`; backup and export files |
| `09_IMPLEMENTATION_PLAN.md` | Phase in which `js/tools.js` and the optional palette are built |
| `10_QA_PLAN.md` | `lsp_tools.js` tests and client-segregation checks |
| `11_REPOSITORY_AUDIT.md` | Audit rows for MCP, PostgreSQL/PostGIS/PostgREST/Supabase/pgvector, MapLibre and AI frameworks |
| `README.md` | Decision log entries D12, D13 and the approval checklist |
