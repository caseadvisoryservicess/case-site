---
name: document-and-file-registry
description: Owns the LSP documents and file registry - document metadata records (DOC-001), the 13 document types, visibility keys (internal, client_visible, restricted, public), version increments, registration from unit/deal/brand/project drawers, the Documents screen and the getVisibleDocuments contract. Use for prompts like "register a file on this deal", "add a document type", "client can see an internal document", "new version of the LOI", "documents screen", "missing documents indicator", "file preview does not open after refresh". Prototype metadata only - it never claims secure storage.
---

## Purpose

Own the document and file registry of the Leasing & Sales Platform (LSP, `os/leasing/`, D1):
`appState.documents` records, their types, visibility, versions and links to projects, units, brands and
deals (00_MASTER_PROMPT.md §30), the Documents screen (§63 screen 18), the "register file" action in the
unit drawer (§15), and the `getVisibleDocuments()` service contract (§52). The registry stores metadata and
a best-effort local preview reference; it is explicitly not storage (§6.2: "Do not pretend that local file
metadata or browser object URLs are secure document storage").

## Responsibilities

### Document record (§30, D13)

- Schema fields: `id` (`DOC-nnn`), `fileName`, `category`, `projectId`, `unitId`, `brandId`, `dealId`,
  `version`, `uploadedBy`, `uploadedAt`, `visibility`, `fileSize`, `localUrl`, `comment`, `demoRecord`.
- RECOMMENDATION (confirm against 03_DATA_MODEL.md): add `companyId`, `contactId`, `mimeType`,
  `sourceKind: 'demo'|'registered'|'imported'`, `versionHistory: [{version, fileName, uploadedAt, uploadedBy}]`.
  Precedent: CASE OS `DOCREG` entries carry `ver` and `versions[]` (`os/core.js`, `const DOCREG=[]`) and SQL
  `documents` + `document_versions` (`os/sql/schema_mysql.sql`).
- Reverse links: push the id into `project.documentIds`, `unit.documentIds`, `deal.documentIds`,
  `brand.documentIds` (§9, §11, §18, §24) through one service function, never from a view.

### Document types (§30, §44)

- Default `DEFAULT_CONFIG.documentTypes`: floor plan, brochure, presentation, commercial terms, owner
  instruction, tenant proposal, LOI, contract, invoice, report, photo, technical document, other.
- Each type: `{key, label, defaultVisibility, requiredForStages?: []}`; editable in Settings.
- "Missing documents" (§33 KPI, §37 data quality) = a rule such as "deal at Contract Signed without a
  `contract` document"; the rule table lives in config, the check runs in the services owned by
  `data-quality-and-provenance`; this skill defines the rule shape and the demo cases.

### Visibility (§6.8, §30, D7)

- Stored keys: `internal` (default), `client_visible`, `restricted`, `public`; UI labels from `t(key)`
  ("Internal", "Client-visible", "Restricted", "Public").
- `getVisibleDocuments(session, filter)` returns only records the session may see: internal roles by role
  matrix (04_ROLES_AND_VISIBILITY.md); `client` sessions only `client_visible` (and `public`) documents of
  projects assigned to their `clientId`. The portal renders from `clientView(projectId).documents` only.
- `restricted` documents are visible to `founder_admin`, `head_ls` and the responsible manager of the
  linked deal (RECOMMENDATION; confirm in 04_ROLES_AND_VISIBILITY.md).
- Changing visibility writes an `auditLog` entry (`AUD-nnn`, action `document.visibility_changed`).

### Registration flow (§13 step 14, §15, §65 Documents)

- Entry points: unit drawer, deal detail, brand detail, project dashboard, Documents screen.
- Form: file picker (optional) or metadata-only entry; category; visibility; comment; linked objects
  pre-filled from context.
- On save: create `DOC-nnn`, create an activity `ACT-nnn` of type `document uploaded` (§28), update
  reverse links, mark state unsaved (persistence by `local-storage-and-import-export`).
- Re-registering a file on an existing record increments `version`, appends to `versionHistory` and never
  deletes the previous metadata.

### Local file handling (§6.2, §46)

- `localUrl` = `URL.createObjectURL(file)` for the current session only; it is not persisted and is
  restored as `null` after reload; the UI shows "Preview available until page reload" and a re-attach
  action. `fileSize`, `mimeType` and `fileName` are persisted.
- No file bytes in localStorage in v0.1; IndexedDB is not used (D9). Demo documents ship as metadata-only
  records with `demoRecord: true` and `localUrl: null`.
- SVG files chosen as "floor plan" documents are registry entries only; the operational plan is a
  `floorPlans` record created by `interactive-floorplan-engineer`'s mapping wizard.

### Hand-offs

| Topic | Owner | This skill |
|---|---|---|
| Session/role checks, `clientView` filter | `client-portal-permissions` | defines document visibility keys and `getVisibleDocuments` |
| Persistence, backup, export/import of `documents` | `local-storage-and-import-export` | supplies validation rules for the table |
| Missing/duplicate document checks | `data-quality-and-provenance` | supplies rule shape and demo cases |
| Floor-plan SVG sanitizing and `floorPlans` | `interactive-floorplan-engineer` | registry entry only |
| Drawer, table, filter chips, i18n | `frontend-ux-engineer` | document-specific fields |
| Tool registry entry `getVisibleDocuments` | `ai-tool-designer` | exposes the pure function |

## Inputs

Planning documents:

- `docs/leasing-platform/03_DATA_MODEL.md` - document entity, reverse links, ID format `DOC-`.
- `docs/leasing-platform/04_ROLES_AND_VISIBILITY.md` - role x capability matrix, visibility levels, portal rules.
- `docs/leasing-platform/05_STATUSES_STAGES_AND_CONFIG.md` - config schema (`documentTypes`, document visibility defaults).
- `docs/leasing-platform/08_PERSISTENCE_IMPORT_EXPORT.md` - what is persisted (`localUrl` is not).
- `docs/leasing-platform/02_REQUIREMENTS_REVIEW.md` - §6.2 correction and prototype limits.
- `docs/leasing-platform/10_QA_PLAN.md` - §65 Documents checks, Flow 6 step 8, Flow 9 step 9.
- `docs/leasing-platform/00_MASTER_PROMPT.md` §6.2, §6.8, §15, §28, §30, §31, §35, §44, §52, §55, §65.

LSP source files: `os/leasing/js/views/documents.js`, `os/leasing/js/services.js` (document queries,
`getVisibleDocuments`), `os/leasing/js/config.js` (`documentTypes`, visibility defaults),
`os/leasing/js/state.js` (writers for `documents`, `activities`, `auditLog`), `os/leasing/data/demo.js`
(demo document records), `os/leasing/js/views/units.js` and `os/leasing/js/views/pipeline.js`
(drawer "Documents" sections), `os/leasing/js/views/portal.js` (approved downloads).

CASE OS reference (read-only, for the production fold-back path only): `os/api/project_files.php`
(25 MiB limit, extension allow-list, MIME sniffing, SVG script/foreignObject/on*= rejection, SHA-256,
files under `data/case_files/`), `DOCREG` / `DOC_CONTACTS` in `os/core.js`, SQL `documents` and
`document_versions`. These are backend features; LSP v0.1 has none of them.

## Outputs

- Code in `os/leasing/js/views/documents.js`, document sections of the unit/deal/brand drawers, document
  functions in `os/leasing/js/services.js`, `documentTypes` in `os/leasing/js/config.js`, demo records in
  `os/leasing/data/demo.js`, EN/RU strings in `os/leasing/data/i18n.js`.
- Records: `DOC-nnn` in `appState.documents`, `ACT-nnn` (`document uploaded`) and `AUD-nnn` entries.
- README paragraph (English + short Russian) stating: metadata only, previews last until reload, no secure
  storage, production requires backend storage (§6.2, §55).
- For analysis requests: FACTS (cite `00_MASTER_PROMPT.md §n` or the file) / ASSUMPTIONS (A-n) /
  RECOMMENDATIONS, and a table document type -> default visibility -> linked objects -> demo count.

## Constraints

- §6.2 and §30 are binding: no claims of secure storage, encryption, retention or access control beyond
  prototype visibility filtering; every UI and README text says "prototype file registry".
- D7: field whitelist, never blacklist; the portal receives documents only through `clientView(projectId)`.
- D9: no file bytes in `caseos-lsp-state-v1`; `localUrl` excluded from export and never imported.
- D4: demo documents are fictional and `demoRecord: true`; no real CASE Advisory client files or names.
- D13: ids `DOC-nnn` from the central generator in `js/state.js`; never ad-hoc ids.
- §44: document types and default visibility are config, not literals in rendering code.
- Runs under the CASE OS CSP and from `file://`: object URLs and `data:` previews only; no `fetch()`, no upload endpoint.
- Do not modify CASE OS files (`os/core.js`, `os/api/project_files.php`, `os/sql/*`, `os/v*.js`).
- Vocabulary: `documents`, `documentIds`, `visibility` keys, `category` (document type key), `version`;
  do not introduce "attachments" or "files" as a second entity.

## Validation checklist

- [ ] Registering a document from the unit drawer creates `DOC-nnn`, an `ACT-nnn` of type `document uploaded`,
      updates `unit.documentIds` and (when linked) `deal.documentIds`; visible immediately in the Documents
      screen, the drawer timeline and the dashboard (§3.5).
- [ ] Every `category` value exists in `DEFAULT_CONFIG.documentTypes`; unknown keys are rejected with a message.
- [ ] `visibility` is one of `internal|client_visible|restricted|public`; default `internal`.
- [ ] `getVisibleDocuments` for a `client` session returns only `client_visible`/`public` documents of assigned
      projects; a negative test with an `internal` LOI on the same unit returns nothing (§65 Documents).
- [ ] Portal "download approved file" opens only documents from `clientView(projectId).documents`.
- [ ] After browser refresh: metadata persists, `localUrl` is `null`, the UI shows the re-attach hint, no JS error.
- [ ] Re-registering increments `version`, keeps `versionHistory`, and previous entries remain in the timeline.
- [ ] Export JSON contains documents without `localUrl`; import of a record with a `localUrl` drops it silently
      and reports it in the preview (coordinated with `local-storage-and-import-export`).
- [ ] Demo dataset has both internal and client-visible documents per project (§47) with `demoRecord: true`.
- [ ] Documents screen: filter by project, type, visibility, linked object; chips with remove and Reset All (§26).
- [ ] No text claims secure storage; README limitation paragraph present.
- [ ] Relevant `LSP-QA-nnn` ids from 10_QA_PLAN.md named for `testing-and-qa`.

## Prohibited behavior

- Persisting file bytes, base64 blobs or object URLs in localStorage; using IndexedDB in v0.1.
- Presenting a local preview as a stored, backed-up or shared file; using words like "secure", "encrypted",
  "vault" or "storage" for the registry.
- Filtering client documents by blacklist (removing internal ones) instead of selecting `client_visible`.
- Rendering documents in the portal from `appState.documents` directly.
- Creating a separate `files` or `attachments` array, or duplicating document metadata on units or deals
  beyond `documentIds`.
- Hard-coding document types or visibility labels in views.
- Silently overwriting a document on re-registration, or deleting metadata that a deal or report references.
- Replicating `project_files.php` behaviour (hashing, allow-lists) as if it existed in LSP, or editing it.
- Reading uploaded file content (including SVG) into the DOM without the sanitizer owned by
  `interactive-floorplan-engineer`.
- Writing model identifiers or session links into repository files.

## Examples

1. "Register the signed contract on DEAL-014 and make it visible to the owner."
   Expected: open the deal document section; create `DOC-nnn` with `category: 'contract'`,
   `visibility: 'client_visible'`, `dealId: 'DEAL-014'`, `unitId` from the deal, `projectId`; activity
   `document uploaded`; audit entry; confirm it appears in the portal for the client assigned to that project
   and not for the other demo client; state that the file preview lasts until reload.
2. "Add document type 'Fit-out drawings' with default visibility restricted."
   Expected: add `{key:'fit_out_drawings', label..., defaultVisibility:'restricted'}` to
   `DEFAULT_CONFIG.documentTypes`, EN/RU labels, Settings editor entry; verify the Documents filter and the
   registration form pick it up without code changes elsewhere; add one demo record.
3. "The client says the brochure link is broken after they refreshed."
   Expected: explain FACT (§6.2: object URLs are session-bound; `localUrl` is not persisted by design D9),
   show the re-attach hint in the portal and internal UI, and record in README/known limitations that
   downloadable files require backend storage in the production phase; no attempt to store bytes locally.
