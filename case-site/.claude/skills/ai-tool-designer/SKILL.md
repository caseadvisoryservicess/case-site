---
name: ai-tool-designer
description: Designs and implements the provider-independent AI tool registry of LSP (os/leasing/js/tools.js): LSP.tools entries with name, description, params schema, readOnly, requiredRole and visibilityScope; LSP.runTool(name, params, session) which validates, calls the permission checker, delegates to js/services.js and writes auditLog entries; result envelopes that label platform, calculated and unavailable data. Use when a task mentions tools.js, LSP.tools, runTool, tool registry, function contracts, the §52 function list, audit entries for tools, the "Ask" palette or "AI-ready architecture".
---

## Purpose

00_MASTER_PROMPT.md §51 to §54 require business logic to be reachable as structured functions so a
future AI layer calls tools instead of simulating clicks, with a permission checker in front and an
audit trail behind. Brief D12 fixes the shape: `js/tools.js` exposes `LSP.tools` and
`LSP.runTool(name, params, session)`; there is no LLM, no network and no provider SDK in v0.1. This
skill owns the registry, the function contracts and the runTool pipeline. It does not own the
permission rules themselves (ai-safety-and-permissions does).

## Responsibilities

- Implement `LSP.tools` in `os/leasing/js/tools.js` with exactly the 26 functions of
  00_MASTER_PROMPT.md §52: `searchBrands, searchCompanies, searchContacts, searchProjects,
  searchUnits, filterUnits, getProject, getFloor, getUnit, getDeal, getDealsByStage,
  getDealsWithoutNextAction, getOverdueTasks, calculateLeasedGLA, calculateVacantGLA,
  calculatePipelineGLA, calculatePipelineValue, aggregateMerchandiseMix, suggestBrandsForUnit,
  suggestUnitsForBrand, generateOwnerReport, getProjectChanges, createTask, addComment,
  getDataCompleteness, getVisibleDocuments`. Additional tools need a `Q-n`; none may be missing or renamed.
- Define one tool entry shape (brief D12):

| Key | Content |
|---|---|
| `name` | §52 name, unchanged |
| `description` | one sentence, what it returns |
| `params` | `{type:'object', properties, required}`; enums from `js/config.js` (stage keys, status keys) |
| `readOnly` | `true` for all except `createTask`, `addComment` |
| `requiredRole` | array of brief D7 keys: `founder_admin, head_ls, manager, administrator, external_agent, client` |
| `visibilityScope` | `'internal'` or `'client'` |
| `returns` | shape description |
| `service` | name of the backing export in `js/services.js` |

- Implement the `runTool` pipeline in this order:
  1. tool exists, else `{ok:false, error:'unknown_tool'}`;
  2. params validated against the schema, unknown params rejected (`invalid_params`);
  3. permission checker from ai-safety-and-permissions called with `(tool, params, session)`;
     denial returns `{ok:false, error:'forbidden'}` before any service runs;
  4. service call in `js/services.js` (tools never read DOM or write `appState` directly);
  5. result envelope built;
  6. `auditLog` entry for every write tool and, when configured, for read tools.
- Define the result envelope per 00_MASTER_PROMPT.md §53:
  `{ok, data, meta: {tool, at, sourceKind: 'platform'|'calculated', denominators, warnings: [], unavailable: []}}`.
  Missing inputs appear in `unavailable` and produce `null`, never `0` (brief D6); KPI tools return
  the denominator and the units-without-area count.
- Write tools (`createTask`, `addComment`) run as dry-run unless `params.confirm === true`: without
  confirmation they return the record preview and `meta.requiresConfirmation = true`. The
  confirmation policy and its UI wording belong to ai-safety-and-permissions.
- Define `auditLog` entries (`AUD-nnn`, brief D13) written through the `js/state.js` writer with the
  00_MASTER_PROMPT.md §54 fields: `{id, at, userId, role, action: 'tool:<name>', tool, params
  (sanitized), datasetsAccessed: [collection names], fieldsChanged: [{entity, id, field}],
  reportGenerated, exportProduced, clientVisible, permanent}`.
  - Sanitized means: free text truncated to a configured limit, no document content, no phone numbers.
  - CASE OS precedent, reference only: `audit(action, detail)` in `os/core.js` writes
    `{at, by, role, action, detail}` capped at 600 entries; SQL `audit_log {by_id, by_name, role_key, action, detail, at}`.
- Keep tools thin: every calculation lives in `js/services.js` and is the same function the UI uses.
  If a service is missing, request it from the owning skill instead of computing inside `tools.js`.
- Node testability (brief D10): `tools.js` attaches to `window.LSP` in browsers and `module.exports`
  in Node, depends only on `js/config.js`, `js/state.js`, `js/services.js`, and runs without DOM.
- Optional, late in the plan (brief D12): a deterministic "Ask" command palette in `js/views/*.js`
  mapping a small set of regex intents (00_MASTER_PROMPT.md §51 examples) to `LSP.runTool` calls,
  labeled prototype.
- Hand-offs:
  - permission checker, client AI scope, confirmation policy, injection-resistant handling of
    imported or untrusted text: ai-safety-and-permissions;
  - KPI and pipeline formulas: commercial-real-estate-financial-analyst, leasing-pipeline-analyst, sales-pipeline-analyst;
  - matching logic: brand-and-market-researcher, merchandise-mix-analyst;
  - report builders and `getProjectChanges`: reporting-and-dashboard-analyst;
  - completeness and stale rules: data-quality-and-provenance;
  - role matrix content: client-portal-permissions;
  - tests: testing-and-qa.

## Inputs

Planning documents under `docs/leasing-platform/`:
- `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` — registry, permission flow, audit concept.
- `04_ROLES_AND_VISIBILITY.md` — role keys, visibility levels, client whitelist.
- `07_CALCULATIONS_AND_KPI_RULES.md` — services behind the KPI tools, denominators, anti-double-counting.
- `03_DATA_MODEL.md` — entity fields returned by get/search tools, `AUD-nnn`.
- `05_STATUSES_STAGES_AND_CONFIG.md` — enums for params.
- `10_QA_PLAN.md` — Node test harness for pure logic.
- `09_IMPLEMENTATION_PLAN.md` — phase in which `tools.js` is built.
- `00_MASTER_PROMPT.md` §39, §51, §52, §53, §54, §55, §58 ("Do not add an AI framework to the MVP").

LSP sources under `os/leasing/`:
- `js/tools.js` — owned by this skill.
- `js/services.js` — called; never duplicated.
- `js/state.js` — `auditLog` writer, ID generation, session shape.
- `js/config.js` — roles, statuses, stages, visibility levels, audit settings.
- `js/views/settings.js` — if audit-on-read is made configurable.
- `data/demo.js` — fixtures for Node tests: the unit with 3 prospects, the deal spanning 2 units, both client users.

CASE OS reference, read only:
- `os/core.js` — `audit()`, `AUDIT`, `ACTLOG`, `AGENTS`.
- `os/sql/schema_mysql.sql` — `audit_log`, `activity_log`.
- `HANDOFF_CASE_OS.md` — audit volume issue with `role_visible_state_keys`; a reason to keep entries small and role-scoped.

## Outputs

- `os/leasing/js/tools.js`: registry, `runTool`, param validator, envelope builder, audit writer
  call, `window.LSP` / `module.exports` attachment.
- Tool contract table for `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (when assigned): tool, params,
  readOnly, requiredRole, visibilityScope, backing service, returns, audit behaviour; the runTool
  sequence as text; the envelope specification.
- Node test proposals for testing-and-qa (`docs/qa/tools/lsp_tools_*.js`, ids `LSP-QA-nnn`): every
  tool callable; unknown tool rejected; bad params rejected; client session denied on internal tools;
  `calculateLeasedGLA` equals the dashboard value; `createTask` dry-run creates nothing; confirmed
  `createTask` writes one `TASK-nnn` and one `AUD-nnn`.
- README paragraph stating what the tool layer is (a function registry) and is not (an AI assistant).

## Constraints

- Brief D12 and 00_MASTER_PROMPT.md §51, §58: no LLM, provider SDK, network, MCP server or agent
  framework in v0.1; the registry is provider-independent plain JavaScript.
- 00_MASTER_PROMPT.md §52: tool names are fixed. §53: results distinguish platform data, calculated
  results, assumptions and unavailable information. §53 and §69: permanent edits require confirmation.
- Brief D7 and 00_MASTER_PROMPT.md §51, §55: client sessions reach only tools with
  `visibilityScope: 'client'` and only through `clientView(projectId)` output; commissions, internal
  notes, negotiated terms, internal contacts and staff performance never appear in a client result;
  "AI must never access raw unrestricted database data".
- Brief D6: tools return the same unit-centric and deal-centric figures as the UI, with
  denominators; missing values are `null` with a warning.
- Brief D2: `tools.js` is one file; no DOM access; services stay pure.
- Brief D1 and D11: no CASE OS file is modified; `LSP_VERSION` lives only in `os/leasing/index.html`.
- Writing rules: FACTS cite `00_MASTER_PROMPT.md §n` or the CASE OS file; ASSUMPTIONS A-n;
  RECOMMENDATIONS with `Q-n`; English; no marketing language; no production security or AI claims;
  no model identifiers, provider names or session links in repository files.
- Vocabulary: tool params reuse entity keys (`projectId`, `unitId`, `stage`, `commercialStatus`);
  no parallel names.

## Validation checklist

- [ ] `Object.keys(LSP.tools)` equals the 26 names of 00_MASTER_PROMPT.md §52, spelled identically.
- [ ] Every entry has `name, description, params, readOnly, requiredRole, visibilityScope, returns,
      service`; `requiredRole` values are brief D7 keys; `service` names an existing export of `js/services.js`.
- [ ] `runTool` rejects unknown tools and invalid params before the permission checker, and calls
      the permission checker before any service.
- [ ] A `client` session calling `getDeal`, `calculatePipelineValue` or any internal-scope tool
      receives `{ok:false, error:'forbidden'}` with no side effect other than a denial audit entry (if configured).
- [ ] `createTask` and `addComment` without `confirm:true` change nothing in `appState`; with it they
      create exactly one record and one `AUD-nnn` entry with `permanent:true`.
- [ ] The four `calculate*` tools return the dashboard's numbers for the demo dataset and include
      denominators and the units-without-area count.
- [ ] Results for missing data contain `null` and an `unavailable` entry, never `0`.
- [ ] `tools.js` loads in Node after `config.js`, `state.js`, `services.js`; no DOM reference inside.
- [ ] `auditLog` entries never store document content, full comment bodies beyond the configured
      limit, or `clientVisible` flags that contradict the record's `visibility`.
- [ ] Documentation labels the layer as a function registry and the palette as prototype; no CASE OS file changed.

## Prohibited behavior

- Adding an LLM call, API key field, provider SDK, MCP server, LangChain / LlamaIndex / AutoGen or
  any §58 framework to `os/leasing/`.
- Implementing calculations, matching, report or completeness logic inside `tools.js`.
- Bypassing or re-implementing the permission checker inside `tools.js`, or hard-coding role checks
  against strings other than the brief D7 keys.
- Letting a tool read or write `appState` directly, touch the DOM, or simulate UI clicks.
- Returning `0` for unknown values, omitting denominators, or mixing inventory and pipeline figures in one number.
- Writing audit entries that contain raw imported text, document bodies, contact phone numbers or
  commission distributions in plain form.
- Renaming, dropping or extending the §52 list without a `Q-n`; inventing tool names outside the brief vocabulary.
- Describing the registry, the palette or any future assistant as working AI, as secure, or as a production API.
- Modifying `os/core.js`, `os/api/*.php`, `os/sql/*` or any CASE OS file.

## Examples

**Task:** "Implement the KPI tools in tools.js."
**Expected behavior:** Reads `07_CALCULATIONS_AND_KPI_RULES.md` and `js/services.js`; registers
`calculateLeasedGLA`, `calculateVacantGLA`, `calculatePipelineGLA`, `calculatePipelineValue` with
params `{projectId?, asOf?}`, `readOnly:true`, `requiredRole` internal roles plus `client` only
where `04_ROLES_AND_VISIBILITY.md` allows; maps each to the existing service; returns envelopes with
`meta.denominators` and `unavailable`; proposes Node tests comparing tool output to the dashboard for
"Demo City Mall". If a service is missing, requests it from commercial-real-estate-financial-analyst.

**Task:** "Make 'Which units have no active prospects?' work from the Ask palette."
**Expected behavior:** Maps the intent to `filterUnits({projectId, hasOpenDeals:false,
availabilityGroup:'available'})`; confirms the param exists in the `filterUnits` schema (or requests
it from crm-data-modeler / leasing-pipeline-analyst); renders the envelope's `data` as a unit list
with the `meta.sourceKind:'platform'` label; adds a regex intent entry marked prototype. No
natural-language generation is added.

**Task:** "Add createTask as a tool with audit."
**Expected behavior:** Registers `createTask` with the `TASK-nnn` schema of 00_MASTER_PROMPT.md §27
as params, `readOnly:false`, `requiredRole` internal roles only, dry-run without `confirm:true`,
service call through `js/state.js` writers on confirmation, and an `AUD-nnn` entry with
`action:'tool:createTask'`, `fieldsChanged`, `permanent:true`; asks ai-safety-and-permissions to
confirm the confirmation wording and testing-and-qa to add `LSP-QA-nnn` for both paths.
