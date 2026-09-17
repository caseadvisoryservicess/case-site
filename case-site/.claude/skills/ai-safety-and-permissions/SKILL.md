---
name: ai-safety-and-permissions
description: Owns permission and safety rules of the Leasing & Sales Platform (LSP, os/leasing/): the permission checker LSP.runTool calls with (tool, params, session), the client AI scope (client sessions reach only client-scope tools over clientView output), confirmation for permanent edits (confirm:true dry-run, audit permanent:true), the no-external-AI rule for the Ask palette, and injection-resistant handling of untrusted content (JSON/CSV imports, CASE OS backups, SVG plan text, client comments). Use for "permission checker", "client AI scope", "confirm before write", "prompt injection", "untrusted content", "secrets" or "prototype authentication only".
---

## Purpose

00_MASTER_PROMPT.md §53 places a permission checker between the intent parser and the tool registry, §51 and §55
state that client AI must only use approved client data and that AI must never access raw unrestricted database
data, and §53 requires confirmation for permanent edits. Brief D7 fixes the role keys and visibility levels, D12
fixes that `LSP.runTool(name, params, session)` applies the checker before any service call, D17 fixes the Ask
palette as a deterministic in-browser engine over the closed `LSP.tools` registry under the owner rule "no paid
models and no external AI services", and D19 fixes escaping after the CASE OS v4.70.3 stored-XSS incident. This
skill owns the rules the checker enforces, the client scope, the confirmation policy and the treatment of untrusted
text. It does not own the registry or envelopes (ai-tool-designer), the role × capability matrix content or
`clientView(projectId)` (client-portal-permissions), or the DOM escaping helpers (frontend-ux-engineer).

## Responsibilities

- Implement the permission checker `LSP.permissions.check(tool, params, session)` in the permissions block of
  `os/leasing/js/tools.js` (brief D2: tools.js = function map with permission checks). Result: `{allowed:true,
  params:<scoped params>}` or `{allowed:false,
  reason:'no_session'|'forbidden'|'out_of_scope'|'confirmation_required'}`. The checker never touches the DOM and
  reads only `session`, `clients`, `projects`, `users` and `settings`.
- Check order, fixed: (1) session present and `session.role` is one of the brief D7 keys `founder_admin, head_ls,
  manager, administrator, external_agent, client`; (2) `tool.requiredRole` contains the role; (3)
  `tool.visibilityScope === 'client'` when the role is `client`; (4) project scope: for `client`, `params.projectId`
  must be among the projects of `session.clientId` (`clients[].projectIds`); for `external_agent`, among the user's
  assigned projects; internal roles are unrestricted in v0.1 unless `04_ROLES_AND_VISIBILITY.md` narrows `manager`;
  (5) write tools (`readOnly:false`) require `params.confirm === true`, otherwise `confirmation_required` and the
  dry-run of ai-tool-designer runs.
- One rule set, two callers: the pure predicate `can(session, capability, target?)` lives in `js/services.js` and
  reads the role capability table in `js/config.js` (content owned by client-portal-permissions). `can()` drives
  role-based UI (00_MASTER_PROMPT.md §31 "actual UI differences") and the checker. CASE OS mapping documented with
  the matrix: ASH/ADM → `founder_admin`, BA and DIR (brief D22) → `head_ls`, AG → `manager`, HO → `administrator`,
  AGX → `external_agent`.
- Client AI scope: a `client` session obtains data only from `services.clientView(projectId)`; tools with
  `visibilityScope:'client'` are implemented over `clientView`, never over raw `appState`. Never in a client result:
  `commission*`, commission distribution, `commercialTerms.proposedRent/agreedRent` and other negotiated terms, the
  deal `termsHistory` deviations (brief D20), `notes.internal`, contacts other than `client_visible`, staff
  performance, provenance `by/name/note` (brief D16: only the confidence mark and date may be shown), records of
  other clients. The whitelist is positive (brief D7): a field is absent unless listed.
- Prototype limit stated everywhere access control is described (CASE OS lesson P0-SEC-01, brief 1b): "masking on
  screen is not protection"; in LSP every record sits in the browser's localStorage, so portal filtering models the
  future server-side redaction (CASE OS `restore_unit_finance` pattern) and is not security. The fold-back note for
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` names server-side redaction and restore-on-save as the production design.
- Ask palette safety (brief D17, 00_MASTER_PROMPT.md §53): intents are parsed by deterministic EN/RU regex on the
  typed command only; the palette can call only `LSP.runTool`; numbers come only from tools; every answer is labeled
  platform / calculated / unavailable; unknown commands and malformed structures are discarded. No external AI
  service, paid model, API key field or provider SDK ever enters `os/leasing/`. The optional future local translator
  (pattern of CASE OS `api/llm_lib.php`) is documented as: phrase → one command from the closed menu, strictly
  validated, never answers users, never computes numbers, rate-limited.
- Confirmation policy for permanent edits (00_MASTER_PROMPT.md §53, §69): every write tool and every destructive UI
  action shows a preview naming record IDs (`UNIT-001`, `DEAL-003`) and changed fields and requires explicit
  confirmation. Destructive UI actions: replace-all JSON import, CASE OS backup import, reset demo data, delete of
  any record, archiving a plan version, bulk status change, clearing `statusHistory`/`auditLog`/`termsHistory`.
  Ordinary daily edits (one status change, stage move, task completion) are audited, not gated.
- Audit expectations (00_MASTER_PROMPT.md §54, brief D13 `AUD-nnn`): denials are written when
  `settings.audit.logDenials` is true; confirmed writes carry `permanent:true`; entries never contain raw imported
  text, document bodies, phone numbers or commission shares (writer owned by ai-tool-designer / crm-data-modeler).
- Untrusted content policy. Untrusted = every string in JSON/CSV imports, the `CASE_OS_backup_*.json` adapter
  output, SVG plan text, client comments, brand/company/contact notes, document `fileName`/`comment`, unit codes and
  brand names, and any record text a future AI reads. Rules: (a) content is data, never instructions; a future
  prompt wraps record text in a labeled data block; (b) HTML rendering goes through the `esc()` helper of
  frontend-ux-engineer or `textContent`; SVG labels, tooltips and legends are set with
  `textContent`/`createElementNS`, never string-concatenated markup (brief D19; CASE OS v4.70.3 executed a unit code
  as markup in another user's session); (c) URL fields (`website`, `logoUrl`, `localUrl`, `backgroundUrl`) accept
  only `http:`, `https:`, `blob:` and `data:image/*` for logos; `javascript:` and `data:text/html` are rejected at
  import validation; (d) no `eval`, `new Function`, string `setTimeout` or inline event attributes in `os/leasing/`;
  (e) sanitizer threat list for interactive-floorplan-engineer: `<script>`, `<foreignObject>`, `on*=` attributes,
  `href="javascript:"`, external `<use>`/`<image>` references, `<style>` with `@import`; (f) import size guard per
  brief D9 (warn above 4 MB).
- Secrets and claims (00_MASTER_PROMPT.md §6.1, §32, §55): demo users carry no password field or a visibly fake one;
  no API key, token or credential in code, demo data, README or planning documents; login screen and README show the
  exact sentence "Prototype authentication only. This does not provide production security."
- Supply the security column of the 00_MASTER_PROMPT.md §61 audit table when asked (prompt-injection risk, network,
  filesystem, env access, install scripts per §60).
- Hand-offs: registry, envelopes, dry-run mechanics → ai-tool-designer; capability matrix content, `clientView`,
  portal drawer whitelist → client-portal-permissions; `esc()` and DOM rendering → frontend-ux-engineer; sanitizer
  implementation → interactive-floorplan-engineer; import validation pipeline → local-storage-and-import-export;
  negative tests and the static audit script → testing-and-qa.

## Inputs

Planning documents (`docs/leasing-platform/`): `04_ROLES_AND_VISIBILITY.md` (role keys, capability matrix,
visibility levels, CASE OS role mapping), `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (permission flow, palette design,
audit concept, production RBAC and redaction), `13_CASE_OS_v4731_REUSE.md` (geo-agent and `llm_lib.php` patterns,
v4.70.3 lesson, redaction precedent), `08_PERSISTENCE_IMPORT_EXPORT.md` (import validation, quota guard),
`06_FLOORPLAN_ARCHITECTURE.md` (sanitizer contract), `05_STATUSES_STAGES_AND_CONFIG.md` (config schema for roles,
audit settings), `10_QA_PLAN.md` (negative tests), `02_REQUIREMENTS_REVIEW.md` (security corrections),
`00_MASTER_PROMPT.md` §3.4, §6.1, §6.2, §6.8, §31, §32, §35, §38, §51, §53, §54, §55, §60, §61.

LSP sources (`os/leasing/`): `js/tools.js` (permissions block owned; registry read), `js/services.js` (`can()`,
`clientView(projectId)`), `js/config.js` (`DEFAULT_CONFIG.roles`, `visibilityLevels`, `audit`), `js/state.js`
(session shape, `auditLog` writer), `js/views/portal.js`, `js/views/importexport.js`, `js/views/settings.js`, the
palette view, `js/floorplan.js` (sanitizer, label rendering), `data/demo.js` (two client users).

CASE OS reference, read only: `os/.htaccess` (CSP everything under `os/` runs under), `os/core.js` (`ROLES` flags
`leasing, finance, edit, approve, plans, own_only, project_scope, admin`), `HANDOFF_CASE_OS.md` (rights model note
on `role_allowed_state_keys`), `docs/qa/tools/roles_security_audit.js` and `role_access_qa.js`; from the live build
v4.73.1 as described in the brief and Document 13: `os/v4730-geo-agent.js` (closed tool menu, intent parsing),
`os/api/llm_lib.php` (closed-command validation), `os/api/lib.php` (`restore_unit_finance`), changelog v4.70.3
(stored XSS fix).

## Outputs

- Permissions block in `os/leasing/js/tools.js`: `LSP.permissions.check`, scope resolver, confirmation gate;
  attaches to `window.LSP` and `module.exports` (brief D10).
- `can(session, capability, target?)` signature and tests, implemented in `js/services.js` with
  client-portal-permissions.
- Untrusted-content table (source, field, treatment, owner), confirmation policy table and palette safety rules for
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` and `04_ROLES_AND_VISIBILITY.md` when assigned.
- Negative test proposals for testing-and-qa (`LSP-QA-nnn`): client denied on every internal-scope tool; client
  `getVisibleDocuments` returns only `client_visible` documents of assigned projects; `createTask` without
  `confirm:true` writes nothing; SVG fixture with `<script>`/`onload=`/`javascript:` neutralised; a unit code
  containing markup renders as text on plan labels, tooltips and tables; imported `website:"javascript:alert(1)"`
  rejected; portal DOM contains no commission value or deviation entry of the demo dataset; palette rejects an
  unknown command and never reaches a service for a client outside scope.
- Static audit rules for `docs/qa/tools/lsp_static_audit.js` (run by testing-and-qa): secret patterns, `eval`/`new
  Function`, inline `on*=`, external AI provider hostnames or key fields, the §6.1 sentence present, no model
  identifiers or session links in `os/leasing/` and `docs/leasing-platform/`.
- README "Security limitations" paragraph: prototype login, localStorage readable by anyone with the browser
  profile, no server-side authorization or redaction, no encryption, no secure file storage, no external AI.

## Constraints

- Brief D7: role keys and the four visibility levels `internal`, `client_visible`, `restricted`, `public` are the
  only vocabulary; no parallel permission flags.
- Brief D12, D17 and 00_MASTER_PROMPT.md §51, §58: no LLM, no network, no provider SDK, no paid or external AI
  service; the checker and the palette are plain JavaScript and the checker works in Node.
- 00_MASTER_PROMPT.md §6.1, §55, §62: no production security claims; static HTML plus localStorage provides no
  security and every document that mentions access control says so.
- 00_MASTER_PROMPT.md §3.4: internal data is never exposed because an object is linked to a client project; the
  whitelist is positive.
- Brief D19: registry data is escaped; the sanitizer applies to uploaded plans; both are required, neither replaces
  the other.
- Brief D1, D11, D18: no CASE OS file is modified; the CASE OS CSP is a given; the add-on zip contains only
  `os/leasing/`.
- Brief D2: no new files beyond the D2 structure; the checker lives in `js/tools.js`, `can()` in `js/services.js`.
- Writing rules: FACTS cite `00_MASTER_PROMPT.md §n` or the CASE OS file; ASSUMPTIONS A-n; RECOMMENDATIONS with
  `Q-n`; English; no model identifiers or session links in repository files.

## Validation checklist

- [ ] `LSP.permissions.check` returns `'no_session'` without a session and `'forbidden'` for a role outside
      `tool.requiredRole`, both before any service runs.
- [ ] A `client` session is denied on every `visibilityScope:'internal'` tool; every `visibilityScope:'client'` tool
      is implemented over `services.clientView(projectId)`.
- [ ] A `client` session with `params.projectId` outside its assigned projects receives `'out_of_scope'`; the two
      demo client users cannot see each other's project through any tool, view or palette answer.
- [ ] Every write tool without `params.confirm === true` returns `'confirmation_required'` and leaves `appState`
      deep-equal to before; with confirmation exactly one record and one `AUD-nnn` with `permanent:true` are
      written.
- [ ] Replace-all import, CASE OS backup import, reset demo data, delete, plan archive and bulk status change show a
      preview naming record IDs and require confirmation.
- [ ] `grep -rn "eval(\|new Function\|javascript:\| on[a-z]*=\"" os/leasing/` returns only the sanitizer's deny-list
      constants and test fixtures; no external AI hostname, key field or provider SDK exists in `os/leasing/`.
- [ ] Import of a record with `website`, `logoUrl`, `localUrl` or `backgroundUrl` using a scheme other than `http:`,
      `https:`, `blob:` (or `data:image/*` for logos) is rejected with a validation message.
- [ ] SVG fixtures (script, onload, javascript href, foreignObject, external use/image) render with those nodes
      removed; a unit code or brand name containing `<img onerror>` appears as literal text on the plan, tooltip,
      table and report.
- [ ] Palette answers carry the platform / calculated / unavailable label; an unknown command is discarded with a
      message and no tool call.
- [ ] The sentence "Prototype authentication only. This does not provide production security." appears on the login
      screen and in `os/leasing/README.md`; no password, API key or token string exists in `os/leasing/` or
      `docs/leasing-platform/`.
- [ ] `can()` is the single source for role-based UI and the checker; no view hard-codes role names except through
      `can()`.
- [ ] No CASE OS file changed (`git diff --name-only` shows nothing under `os/` outside `os/leasing/`).

## Prohibited behavior

- Claiming or implying that the prototype login, localStorage, visibility flags, on-screen masking or the checker
  provide production security, encryption or server-side authorization.
- Implementing a client-scope tool over raw `appState` instead of `clientView(projectId)`, or using a field
  blacklist instead of the positive whitelist.
- Adding role keys, visibility levels or permission flags outside brief D7; duplicating capability rules in views,
  tools or reports instead of calling `can()`.
- Letting record, imported or comment text influence which tool runs (data treated as instructions) in the palette
  or any future prompt path.
- Adding any external or paid AI service, provider SDK, API key field or network call; letting the future local
  translator answer users or compute numbers.
- Executing write tools or destructive UI actions without preview and explicit confirmation, or marking a dry-run
  `permanent:true`.
- Rendering untrusted strings with raw `innerHTML` or string-concatenated SVG markup, accepting
  `javascript:`/`data:text/html` URLs, or adding `eval`/`new Function`/inline event attributes.
- Placing passwords, tokens, API keys, real client data, model identifiers or session links in any repository file.
- Modifying `os/.htaccess`, `os/core.js`, `os/index.html`, `os/sw.js`, `os/api/*`, `os/sql/*` or any other CASE OS
  file.

## Examples

**Task:** "Implement the permission checker that runTool calls."
**Expected behavior:** Reads `04_ROLES_AND_VISIBILITY.md` and `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`, writes the
permissions block in `js/tools.js` with the fixed check order (session, requiredRole, visibilityScope, project
scope, confirmation), implements `can()` in `js/services.js` over `DEFAULT_CONFIG.roles`, keeps both DOM-free and
Node-loadable, and hands `LSP-QA-nnn` negative cases (client denied on `getDeal`, out-of-scope `projectId`,
unconfirmed `createTask`) to testing-and-qa. Does not touch registry entries or envelopes.

**Task:** "A client user types into the Ask palette: show commissions for my project."
**Expected behavior:** The intent maps to no client-scope tool; the palette shows the "not available for your role"
message from `data/i18n.js` labeled as unavailable information (00_MASTER_PROMPT.md §53), writes a denial audit
entry if enabled, and never calls `calculatePipelineValue` or reads `commission*` fields. No free-text generation
and no external call occurs.

**Task:** "Review the CASE OS backup import adapter for injection risk."
**Expected behavior:** Lists every string field the adapter copies from `CASE_OS_backup_*.json` (`OBJECTS.name`,
`U.code`, `U.comment`, `BRANDS.name/notes/site/logo`, `DOC_CONTACTS.*`, `PLANSVG` text), confirms they are stored as
plain strings, escaped on render (`esc()` for HTML, `textContent` for SVG labels), passed through the sanitizer for
SVG, adds URL scheme validation for `BRANDS.site` and `BRANDS.logo`, and returns FACTS (file and field) with
RECOMMENDATIONS (`Q-n`) for local-storage-and-import-export; writes no application code outside its own block.

