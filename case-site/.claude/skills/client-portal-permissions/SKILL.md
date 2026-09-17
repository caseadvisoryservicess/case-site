---
name: client-portal-permissions
description: Roles and visibility rules for LSP (os/leasing/) — the six D7 role keys (founder_admin, head_ls, manager, administrator, external_agent, client), the §31 capability matrix, the four visibility levels (internal, client_visible, restricted, public), the whitelist view model clientView(projectId) behind the portal and the client report, client status mapping (§36), the prototype session (§32) and negative tests proving a client never sees internal data. Use for "role matrix", "who can see", "client portal", "clientView", "visibility level", "client status mapping", "portal shows internal data", "login as client", "role badge" or "negative test for client".
---

## Purpose

Guarantee `00_MASTER_PROMPT.md` §3.4 ("Internal and client views are different") and §35 in the
prototype through explicit, testable rules: role capabilities live in config, every sensitive object and
field carries a visibility level (§6.8), and one whitelist service — `clientView(projectId)` — stands
between `appState` and every client-facing renderer. The skill owns `04_ROLES_AND_VISIBILITY.md`.

## Responsibilities

- Role × capability matrix (§31): capabilities as rows (view / create / edit per entity, change unit
  status, move deal stage, assign managers, see commissions, manage Settings, manage prototype users,
  preview the portal, generate reports, register documents, resolve comments), the six D7 roles as
  columns; encoded as `config.roles[roleKey].capabilities` and checked by one service
  `can(session, capability, target)`; mapping to CASE OS keys documented (ASH / ADM → `founder_admin`,
  BA → `head_ls`, AG → `manager`, HO → `administrator`, AGX → `external_agent`, `client` → new).
- Visibility levels (§6.8, D7): `visibility` ∈ {`internal`, `client_visible`, `restricted`, `public`}
  on project notes, units, deals, documents, comments, brands and contacts; a meaning table; default
  `internal`; `public` reserved for ecosystem-approved data (`geoanalytics-integration-architect`).
- Client whitelist view model: `clientView(projectId, session)` applies the D7 chain — session
  `clientId` → projects whose `clientIds` include it → objects with `visibility: client_visible` (or
  `public`) → per-entity field whitelist from `config.clientFieldWhitelist` — and returns a plain,
  detached object: project header, approved KPIs (§35 list, computed by services on the filtered unit
  set), floors with the current plan and unit rows (unit number, area, `clientStatus`, approved category
  / tenant), client-approved key deals (§37) as brand name + unit numbers + `clientStatus`,
  client-visible documents, comments the client may see, changes since the previous report, last update
  date.
- Client status mapping (§36): the `clientStatus` attribute on every unit status and deal stage entry
  (D5), default table from §36, editable in Settings (§44); the portal, the client report and the client
  plan legend read only `clientStatus`.
- Client users and comments: `users[]` with `role: 'client'` and `clientId`; client comments (§29)
  created with author, timestamp, related object, `visibility: client_visible` and status
  `Open` → `In Review` → `Resolved`; internal replies reach the client only when marked
  `client_visible` (Flow 10).
- Prototype session (§32, §6.1): demo users (D4), Enter submits, role badge, logout, `caseos-lsp-session`
  key (D9); the text "Prototype authentication only. This does not provide production security." on the
  login screen, footer and portal.
- Real UI differences between internal roles (§31): `manager` edits only assigned projects,
  `administrator` sees no commissions, `head_ls` sees permitted commissions (Q-02-4), `founder_admin` has
  Settings, users and "Preview as client" rendering exactly the `clientView` output; `external_agent` is
  defined in config only, without a demo user (Q-01-6).
- Negative test catalogue for `10_QA_PLAN.md` (§65 "Login and roles", "Client portal", "Documents",
  "Reports"; Flows 9–11): a client cannot see internal notes, commissions, proposed / negotiated terms,
  other clients, other projects, restricted brand data, internal documents, staff performance or data
  hygiene; direct routes to unassigned projects are denied; global search for a client returns only
  whitelisted objects; tool calls with a client session are refused by the permission checker.
- Hand-offs: the permission checker in `js/tools.js`, client AI scope and confirmation policy →
  `ai-safety-and-permissions` (this skill supplies the matrix it reads); KPI formulas and report sections
  → `reporting-and-dashboard-analyst` (consumes `clientView`); document types and the internals of
  `getVisibleDocuments` → `document-and-file-registry`; client plan mode and drawer rendering →
  `interactive-floorplan-engineer` and `frontend-ux-engineer`; `users` / `clients` schemas and IDs →
  `crm-data-modeler`; Playwright role scripts → `testing-and-qa`.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §3.4, §6.1, §6.8, §9 (`clientIds`, `notes.internal` / `clientVisible`),
  §29–§32, §35–§38, §49 (data classification), §51 (client AI), §52 (`getVisibleDocuments`), §55, §63
  screens 1, 19, 20, §64 Flows 1, 9, 10, 11, §65 "Login and roles", "Client portal", "Documents",
  "Reports".
- `01_PRODUCT_SPEC.md` §3 (role table, Q-01-3, Q-01-6), `02_REQUIREMENTS_REVIEW.md` (R-4, R-5, Q-02-4,
  the §6.8 correction), `03_DATA_MODEL.md` (`users`, `clients`, `visibility` fields),
  `04_ROLES_AND_VISIBILITY.md` (owned), `05_STATUSES_STAGES_AND_CONFIG.md` (`clientStatus`),
  `10_QA_PLAN.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (permission flow).

LSP sources (`os/leasing/`, once they exist):
- `js/config.js` (`roles`, `visibilityLevels`, `clientFieldWhitelist`, `clientStatus` defaults),
  `js/services.js` (`clientView`, `can`, `visibleProjects`, `getVisibleDocuments`), `js/state.js`
  (session read/write), `js/views/portal.js`, `js/views/settings.js` (roles and users),
  `js/views/reports.js` (client report input), `js/tools.js` (`requiredRole`, `visibilityScope` per
  tool), `data/demo.js` (2 client organisations, 2 client users).

CASE OS read-only references (never edited):
- `os/core.js` `ROLES` (line 295: flags `leasing, finance, edit, approve, plans, admin, ownOnly,
  projectScoped, external`) and `serverRightChips` (line 1026) — the flag model LSP maps from but does
  not copy.
- `os/api/unit_patch.php` (server-side role gate) and `HANDOFF_CASE_OS.md` on `role_visible_state_keys`
  (the server strips state keys per role) — precedent that filtering happens at the source, not in the UI.
- `os/v4450-owner-report.js` `caseOwnerReportSave` (blanks `broker`, `rate`, `rent`, `comment` after
  building an internal snapshot) — a strip-after-build precedent that LSP replaces with
  whitelist-before-render.
- `docs/qa/tools/role_access_qa.js` — per-role login and forbidden-screen pattern to reuse in
  `docs/qa/tools/lsp_roles_qa.js`.

## Outputs

- `04_ROLES_AND_VISIBILITY.md`: role × capability matrix, CASE OS mapping, visibility level definitions,
  per-entity client field whitelist tables, client status mapping, session rules, negative test list.
- `js/config.js` entries: `roles`, `visibilityLevels`, `clientFieldWhitelist`, `clientStatus` defaults on
  status and stage entries.
- Pure functions in `js/services.js` attached to `window.LSP` and `module.exports` (D10):
  `clientView(projectId, session)`, `can(session, capability, target)`, `visibleProjects(session)`,
  `getVisibleDocuments(session, filters)` (§52 name; internals shared with
  `document-and-file-registry`).
- Demo records (D4): two client organisations with one client user each, `project.clientIds` set on Demo
  City Mall and Demo Business Park, client-visible and internal documents and comments in both states.
- Negative test cases `LSP-QA-nnn` for Flows 9–11 and an outline of `docs/qa/tools/lsp_roles_qa.js` for
  `testing-and-qa`.
- Chat answers structured as FACTS (cite `00_MASTER_PROMPT.md §n` or the CASE OS file) / ASSUMPTIONS
  (A-n) / RECOMMENDATIONS with Q-n and owner.

## Constraints

- Whitelist, never blacklist (D7): a field reaches a client renderer only if named in
  `config.clientFieldWhitelist`; a new field stays hidden until added; no renderer receives `appState`
  or record references.
- Never sent to a client under any configuration: commissions and shares (§38), `notes.internal`,
  proposed / negotiated terms, internal contacts and their phones or emails, staff performance, data
  hygiene, deals other than client-approved key deals, brands with `visibility: restricted`, documents
  other than `client_visible`.
- One filter implementation: the portal (§35), the client report (§37), the client plan drawer, global
  search for clients and client-scoped tools (§51) all consume `clientView` / `visibleProjects`; no
  second filter inside views.
- Three layers agree: navigation hides, the router denies and the service refuses; the service layer is
  authoritative and is tested in Node without DOM (D10).
- Config-driven (§44): capabilities, levels, whitelists and `clientStatus` are read from `config`; no
  role name or field list inside rendering code.
- §6.1 / §55: no real passwords, tokens or credentials; the session is a prototype; the warning is
  always visible; no security claims in code, README or documents.
- Role keys are exactly the six of D7; CASE OS flags (`leasing`, `finance`, ...) are a mapping source,
  not LSP roles; the future roles listed in §31 appear in `04_ROLES_AND_VISIBILITY.md` as future only.
- Open items are presented as Q-n with an owner: the ID prefix for `clients` is absent from D13 (owner
  `crm-data-modeler`); whether `manager` sees all projects read-only or only assigned ones (owner Head of
  Leasing & Sales); commission visibility per role (Q-02-4, owner Founder).
- D1 / D11 / D13: no CASE OS file is modified; LSP lives in `os/leasing/`; IDs `CMT-001`, `DOC-001`,
  `RPT-001`; UI strings go through `t(key)` (D3); the vocabulary of the brief and master prompt only.

## Validation checklist

- [ ] `config.roles` has exactly `founder_admin`, `head_ls`, `manager`, `administrator`,
      `external_agent`, `client` with capability lists; `04_ROLES_AND_VISIBILITY.md` shows the matrix
      and the CASE OS mapping.
- [ ] Every entity named in §6.8 / §30 carries `visibility` with default `internal`; the four levels are
      defined once in `config.visibilityLevels`.
- [ ] `clientView(projectId, session)` refuses a project whose `clientIds` does not include
      `session.clientId`; `visibleProjects(session)` lists only assigned projects.
- [ ] `JSON.stringify(clientView(...))` contains none of: `commission`, `notes.internal` content,
      `proposedRent`, `agreedRent`, `offerPrice`, `agreedPrice`, `deposit`, internal `contactIds`, phone
      or email values, hygiene fields (Node assertion).
- [ ] The client drawer and the internal drawer are different components with different field sets; no
      internal tab is rendered hidden in the client DOM.
- [ ] Plan legend, unit rows and KPIs in the portal use `clientStatus` only; every status and stage entry
      has a `clientStatus`; the mapping is editable in Settings.
- [ ] A client comment records author, timestamp, related object, visibility and status; it appears in
      internal notifications; the internal reply is visible to the client only when `client_visible`;
      `Resolved` is reflected on both sides (Flow 10).
- [ ] Portal documents equal `getVisibleDocuments(clientSession)`; an internal document never appears in
      the portal or the client report (§65).
- [ ] The client report is built from `clientView` output and passes the same negative assertion
      (Flow 11).
- [ ] Login: Enter submits, the role badge shows, logout clears `caseos-lsp-session`; the prototype
      warning is visible on login, footer and portal (§65).
- [ ] Direct navigation to an unassigned project route as a client shows a "not available" state with no
      data; global search returns only whitelisted objects.
- [ ] `founder_admin` "Preview as client" renders the same output as the client session for the same
      project.
- [ ] Tool calls with a client session on internal tools are refused (with
      `ai-safety-and-permissions`); `docs/qa/tools/lsp_roles_qa.js` logs in as every demo user and checks
      forbidden screens.
- [ ] `git status` shows no change outside `os/leasing/`, `docs/leasing-platform/`, `docs/qa/lsp/`,
      `docs/qa/tools/lsp_*.js`, `.claude/skills/`.

## Prohibited behavior

- Blacklist or strip-after-build filtering (removing known-sensitive fields from a full record);
  rendering the portal from `appState` or from internal view models.
- Hiding internal data with CSS, disabled controls or collapsed panels; relying on navigation alone as a
  control.
- Exposing commissions, negotiated terms, internal notes, internal contacts, staff performance or hygiene
  to a client under any configuration or "owner demo" mode.
- Adding, renaming or merging role keys; reusing CASE OS flags as LSP roles; hard-coding role names or
  field lists in views.
- Real passwords, credential storage, or claims that the prototype login, session or file handling is
  secure.
- Client accounts that span clients, or projects made visible through a linked brand, deal or document
  rather than through `project.clientIds`.
- Writing KPI formulas, document type lists, the tool permission checker or report layout (sister skills
  own them).
- Editing `os/core.js`, `os/v*.js`, `os/sql/`, `os/api/`, `os/index.html`, `os/sw.js`; adding a backend,
  real authentication or network calls.

## Examples

1. Prompt: "A client user sees 'Expected commission' on the Demo Business Park dashboard."
   Expected: FACTS (§38, D7 whitelist); locate the renderer that reads a KPI service directly instead of
   `clientView`; route it through `clientView`; add the field to the negative assertion and an
   `LSP-QA-nnn` case; no change to the KPI formula (owned by `reporting-and-dashboard-analyst`).
2. Prompt: "Write the role × capability matrix section of 04_ROLES_AND_VISIBILITY.md."
   Expected: the matrix from §31 with one row per capability and the six D7 roles; the CASE OS mapping
   table with `os/core.js` line references; ASSUMPTIONS labeled A-n where §31 is silent (for example
   manager project scope); Q-n rows with owners (commission visibility Q-02-4, `clients` ID prefix); the
   config shape that encodes the matrix.
3. Prompt: "Add negative tests for Flow 9."
   Expected: Node tests on `services.js` (`clientView` refusal for an unassigned project, the deny-list
   assertion on the serialized output, `getVisibleDocuments` returning only `client_visible`) plus a
   Playwright outline for `lsp_roles_qa.js` (login as each client user, project list count, unassigned
   route, unit drawer fields, document list, printed report), each with an `LSP-QA-nnn` id handed to
   `testing-and-qa`.
