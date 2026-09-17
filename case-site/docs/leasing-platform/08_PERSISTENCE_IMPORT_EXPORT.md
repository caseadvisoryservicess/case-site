# Local persistence, backup, import and export

**Purpose.** This document defines how the Leasing & Sales Platform (LSP, `os/leasing/`, `LSP_VERSION = '0.1.0'`) stores its data in the browser, how it protects that data against corruption and quota exhaustion, and how data enters and leaves the application (JSON backup, CSV per table, CSV import with column mapping, CASE OS backup adapter). It answers planning item 8 of 00_MASTER_PROMPT.md §69 and covers requirements §5 (items 27–28, 30), §6.2, §30, §42, §46, §47, §54, §55, §62, §64 Flow 12 and the "Persistence and import/export" block of §65. It is written so that `js/state.js` and `js/views/importexport.js` can be implemented from it without re-reading the master prompt. Entity, field, status, stage, role and ID vocabulary follows the context brief and 03_DATA_MODEL.md; configuration vocabulary follows 05_STATUSES_STAGES_AND_CONFIG.md.

**Status: DRAFT for approval — 2026-09-17**

Conventions: FACT = verified in 00_MASTER_PROMPT.md or a CASE OS file (cited). A-n = assumption (A-1..A-3 from the brief; new ones A-08-n). Q-08-n = open question with recommendation and owner. Everything else is the recommended design and is binding for the MVP once this document is approved.

---

## 0. Scope and non-goals

| In scope (v0.1) | Out of scope (documented as future) |
|---|---|
| localStorage persistence of the whole `appState` in one envelope (D9) | Backend, cloud sync, multi-user concurrency (00_MASTER_PROMPT.md §1, §55) |
| Debounced auto-save with Saving / Saved / Unsaved indicator (§46) | IndexedDB (deferred; §46 and §62 allow it "only if necessary") |
| Backup slot, corruption recovery screen, reset to demo data (§46) | Encrypted or "secure" storage claims (§6.2, §55) |
| JSON export/import with validation, preview, confirm/cancel (§42) | Merge/partial JSON import (replace-all only, D9) |
| CSV export for every §42 data area; CSV import for brands, companies, contacts, units (D9) | CSV import for deals, tasks, activities, comments, documents, floor plans |
| CASE OS `CASE_OS_backup_*.json` import adapter (D1), including `PROV` provenance (D16) | Fold-back export from LSP into the CASE OS state blob (`app_state`; FACT from the brief's v4.73.1 addendum: CASE OS does not use the SQL `objects`/`units` tables) — see 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md and 13_CASE_OS_v4731_REUSE.md |
| Document metadata registry with session-only object URLs (§6.2, §30) | File content storage of any kind |

FACT — CASE OS today: `os/core.js` writes its demo state to `asaas-os-demo-state-v7` on every `persist()`, drops `_HEAVY_LOCAL_KEYS` (`PLANSVG`, `PLANUP`, `PLAN_LABELPOS`, `PLAN_SNAPSHOT_SVGS`, `GEO_DATA`, `PROJECT_PPT`) on `QuotaExceededError`, exports the raw blob as `CASE_OS_backup_YYYY-MM-DD.json` (`exportAllJSON`) and restores it with `importAllJSON`, which writes the parsed file to localStorage **without validation** and reloads. LSP keeps the good parts (graceful degradation, dated backup file names) and fixes the missing validation. The live build v4.73.1 (22 releases ahead of the repository `main`; 13_CASE_OS_v4731_REUSE.md) keeps the same key layout, adds the `PROV` provenance key (D16) and redacts `rate`/`budget` server-side for roles without `finance` rights — both matter for the adapter (§9).

---

## 1. Storage keys and envelope (D9)

### 1.1 Keys

| Key | Content | Written by | Size class |
|---|---|---|---|
| `caseos-lsp-state-v1` | The data envelope (§1.2): everything in `appState` except `session` | debounced save (§2), import (§7–§9), reset (§5), recovery (§4) | large (SVG plan text dominates) |
| `caseos-lsp-backup-v1` | Raw string copy of the last successfully written `caseos-lsp-state-v1`, taken immediately before each new write (§3) | save, import, reset, migration | same as state |
| `caseos-lsp-session` | Prototype session `{userId, roleKey, clientId, loginAt}` (§11) | login / logout | tiny |
| `caseos-lsp-ui` | Per-browser UI preferences (§11) | UI, own small debounce | tiny |

Rules: no other localStorage keys are created by LSP (a fifth key requires a decision, see Q-08-1 on the corrupted-copy question). The `-v1` suffix is the **storage layout** version and changes only if the key semantics change; the **data schema** version lives inside the envelope (`meta.schemaVersion`) and is migrated in place. The prefix `caseos-lsp-` is chosen so the keys never collide with CASE OS keys (`asaas-os-*`, `caseos_tbl_colw`) on the shared origin `https://caseadvisory.uz` (see §12.1).

### 1.2 Envelope skeleton

```json
{
  "meta": {
    "schemaVersion": 1,
    "appVersion": "0.1.0",
    "savedAt": "2026-09-17T09:30:00.000Z",
    "createdAt": "2026-09-17T08:00:00.000Z",
    "origin": "demo",
    "idCounters": { "PROJ": 2, "UNIT": 45, "DEAL": 31, "AUD": 118 },
    "checksum": "a1b2c3d4",
    "export": null
  },
  "data": {
    "users": [], "clients": [], "projects": [], "sites": [], "buildings": [], "floors": [],
    "floorPlans": [], "units": [], "brands": [], "companies": [], "contacts": [],
    "requirements": [], "deals": [], "tasks": [], "activities": [], "comments": [],
    "documents": [], "reports": [],
    "settings": {},
    "statusHistory": [], "auditLog": []
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| `meta.schemaVersion` | integer ≥ 1 | Data schema version. `1` = the model in 03_DATA_MODEL.md at LSP 0.1.0. Bumped only when a migration is shipped (§4.3). |
| `meta.appVersion` | string | `LSP_VERSION` that wrote the envelope. Informational; never used for compatibility decisions. |
| `meta.savedAt` / `meta.createdAt` | ISO 8601 UTC | Last write / first creation of this state lineage. Shown in the Saved indicator and the Storage panel. |
| `meta.origin` | `demo` \| `import` \| `caseos-adapter` \| `recovery` \| `user` | How the current lineage started. `demo` drives the "DEMO DATA" banner together with `demoRecord` flags (D4). |
| `meta.idCounters` | object prefix → last number | Persisted ID counters (D13 formats `PROJ-001`, `UNIT-001`, `SH-001`, `AUD-001`, ...). On load each counter is set to `max(persisted, highest suffix found in data)` so IDs are never reused after deletion. |
| `meta.checksum` | 8-hex FNV-1a 32 of `JSON.stringify(data)` | Cheap truncation/tamper detector. Mismatch is a **warning** on load (data still usable) and an **error** on import. |
| `meta.export` | `null` or `{exportedAt, byUserId, byRoleKey, includesInternal: true}` | Present only in files produced by Export JSON (§6.1). Ignored on load. |
| `data.*` | arrays, `settings` object | The 21 collections of the central state (00_MASTER_PROMPT.md §8) minus `session`. `settings` holds the full effective configuration edited in Settings; sections missing from `settings` fall back to `DEFAULT_CONFIG` in `js/config.js` (deep merge by key, per 05_STATUSES_STAGES_AND_CONFIG.md). |

`appState.session` is never part of the envelope; it is rebuilt from `caseos-lsp-session` on boot (§11). Runtime-only fields (`documents[].localUrl`, computed caches, derived statuses) are stripped by the serializer (§10).

---

## 2. Save cycle

### 2.1 Mutation and scheduling

All state changes go through one entry point in `js/state.js`: `LSP.state.commit(mutator, auditMeta)`. `commit` applies the mutator to `appState`, sets `updatedAt` on touched records, appends the `statusHistory` / `auditLog` entries requested by `auditMeta`, marks the store **dirty**, notifies views, and schedules a save.

| Parameter | Value | Rationale |
|---|---|---|
| Debounce | 400 ms trailing | Keyboard-speed edits coalesce; drawer edits feel instant (matches CASE OS 350 ms table-prefs debounce order of magnitude). |
| Max wait | 2 000 ms | A continuous stream of edits (drag on Kanban, bulk status change) is still flushed every 2 s. |
| Immediate flush | on `visibilitychange → hidden`, `pagehide`, logout, before export, before import/reset | Avoids losing the trailing edit when the tab is closed or backgrounded on mobile. |
| Write path | `serialize()` → checksum → **backup slot copy** (§3) → `localStorage.setItem('caseos-lsp-state-v1', str)` | Synchronous; typical write of a 1 M-character state takes tens of milliseconds. |

### 2.2 Indicator states

The header shows one of the following (`data-testid="save-indicator"`, `data-state` attribute for tests):

| State | Shown when | Text (EN / RU via `t()`) |
|---|---|---|
| `saved` | store clean, last write succeeded | "Saved 09:31:12" / "Сохранено 09:31:12" |
| `unsaved` | dirty, save timer pending | "Unsaved changes" / "Есть несохранённые изменения" |
| `saving` | inside the write path | "Saving…" / "Сохранение…" |
| `error` | last write failed (§2.4) | "Not saved — storage full. Export now." / "Не сохранено — хранилище переполнено. Экспортируйте данные." (red, click opens Storage panel) |
| `stale` | another tab wrote the state key (§2.5) | "Data changed in another tab — reload" (banner, not only the indicator) |

Forms never have their own save button for persistence; "Save" in a drawer means "commit" and the indicator reports the outcome (00_MASTER_PROMPT.md §46: Saving / Saved / Unsaved changes).

### 2.3 beforeunload guard

If the store is dirty or in `error` state, a `beforeunload` listener calls `event.preventDefault()` and sets `event.returnValue = ''` so the browser shows its native "leave page?" dialog. The listener is registered once (00_MASTER_PROMPT.md §65: no duplicated event handlers) and is removed while the recovery screen is shown (nothing to lose there).

### 2.4 Failure handling

| Failure | Behaviour |
|---|---|
| `QuotaExceededError` (also Firefox `NS_ERROR_DOM_QUOTA_REACHED`, detected by `e.name` or `e.code === 22/1014`) | 1) Keep the in-memory state untouched. 2) Remove `caseos-lsp-backup-v1` and retry once; if this succeeds, indicator returns to `saved` and a warning toast says the backup slot was dropped to make room. 3) If the retry fails: indicator `error`, toast with action **Export JSON now**, Storage panel opens with the size breakdown (§12), audit entry `state.save_failed` is appended in memory. Every later `commit` retries the write. |
| `SecurityError` / storage disabled (private mode, blocked site data) | Detected once at boot by a probe write; app runs in **memory-only mode**: banner "Browser storage is unavailable — data will be lost on reload. Export JSON before closing." Indicator stays `error`. |
| Serialization error (circular reference, `BigInt`) | Programming error: `console.error`, indicator `error`, state kept in memory. Covered by QA (10_QA_PLAN.md). |

Silent data loss is never acceptable (00_MASTER_PROMPT.md §46); the app therefore never falls back to discarding data without telling the user, unlike CASE OS which silently drops heavy keys.

### 2.5 Multi-tab behaviour

FACT: localStorage is shared by all tabs of the origin. LSP listens to the `storage` event for `caseos-lsp-state-v1`. When another tab writes it, the receiving tab compares `meta.savedAt`; if the foreign write is newer, the tab enters `stale` mode: a banner offers **Reload** (discard local unsaved edits) or **Export my unsaved copy** (JSON of the in-memory state), and auto-save is suspended so the stale tab cannot overwrite the newer data. A `storage` event for `caseos-lsp-session` with a null value (logout elsewhere) returns the tab to the login screen. Concurrent editing by several people in one browser profile is not supported (A-08-7).

---

## 3. Backup slot semantics

| Rule | Detail |
|---|---|
| What it holds | The **raw string** that was in `caseos-lsp-state-v1` before the last successful write. It is copied with `setItem(BACKUP, getItem(STATE))`, never re-serialized, so it is byte-identical to a state that once loaded correctly. |
| When it is written | Before every state write (auto-save, import, reset) and before a migration is applied (§4.3). So it is always exactly one write behind, except after an import/reset/migration where it holds the pre-operation state. |
| What it protects against | Corrupted or truncated writes (browser crash mid-write, quota hit half-way), a failing migration after an app update, an import or reset the user regrets immediately, and the corruption fixtures in §14. |
| What it does not protect against | Undoing a chain of user edits (use JSON exports), browser "Clear site data", another origin's quota pressure. |
| Restore paths | Recovery screen (§4.4) and Settings → Storage → "Restore backup slot" (shows `savedAt`, `origin`, entity counts parsed from the slot; confirm; the current state goes into the slot first, so restore is reversible once). |
| Failure | If copying the slot throws `QuotaExceededError`, the slot is removed, the state write proceeds, and the Storage panel shows "backup slot unavailable (storage size)". The state write is never blocked by the slot. |
| Audit | `state.backup_restored` (with the slot's `savedAt`) when restored. |

Recommendation: the Settings → Storage panel also shows the slot's size so users understand that the slot doubles the storage footprint (§12).

---

## 4. Load algorithm and corruption recovery

### 4.1 Boot sequence

```text
boot()
  probe storage (write/read/remove a 1-byte key) → memoryOnly flag
  raw = getItem('caseos-lsp-state-v1')
  if raw == null            → first run: load demo dataset (§5), origin='demo', save, continue
  parsed = parse(raw)        → on failure: RECOVERY('parse', error)
  env   = validateEnvelope(parsed) → on failure: RECOVERY('envelope', report)
  if env.meta.schemaVersion > CURRENT → RECOVERY('newer-schema')
  if env.meta.schemaVersion < CURRENT → copy raw to backup slot; env = migrate(env) → on failure: RECOVERY('migration', error)
  report = repairIntegrity(env)          (never throws; never deletes records)
  applyState(env); rebuild idCounters; restore session (§11); render
  if report.issues.length → toast + Data hygiene entry + audit 'state.repair'
  if checksum mismatch    → warning toast (state still applied)
```

### 4.2 Envelope validation (`validateEnvelope`)

| Check | Error code | Result |
|---|---|---|
| top-level is a plain object with `meta` and `data` objects | `E-ENVELOPE` | recovery / import rejected |
| `meta.schemaVersion` is an integer ≥ 1 | `E-SCHEMA` | recovery / import rejected |
| every collection listed in §1.2 is present with the right type (array; `settings` object) | `E-KEY-MISSING` / `E-KEY-TYPE` | on load: missing arrays are created empty and reported (`W-KEY-ADDED`); on import: error |
| every record has a string `id` matching `^[A-Z]{2,5}-\d{3,}$` with the prefix expected for its collection (D13) | `E-ID-FORMAT` | on load: record kept, reported; on import: error |
| `id` unique within its collection | `E-ID-DUP` | on load: later duplicate gets a new ID and is reported; on import: error |

Field-level validation (types of `area.glaM2`, dates, enumerations) is performed by the record validators defined in 03_DATA_MODEL.md and reused by forms; on load their findings feed the Data hygiene widget rather than blocking the app.

### 4.3 Migrations by `schemaVersion`

`js/state.js` keeps `const CURRENT_SCHEMA_VERSION = 1` and an ordered map `MIGRATIONS = { 2: fn, 3: fn, ... }` where `fn(envelope) → envelope` upgrades from version `n-1` to `n`. Migrations are pure (no DOM, no storage access), idempotent where possible, and run sequentially. After each step `meta.schemaVersion` is set to the step's version. The pre-migration raw string is preserved in the backup slot, and the audit entry `state.migrated {from, to}` is appended to the migrated state. A state with `schemaVersion` greater than `CURRENT_SCHEMA_VERSION` is never migrated downwards; the recovery screen explains that a newer LSP version is required and offers download and reset only. At LSP 0.1.0 the map is empty; the pipeline is exercised with a test-only registered migration (§14).

### 4.4 Integrity repair (`repairIntegrity`)

Runs on every load, after migration. It never deletes a record and never blocks the app.

| Issue | Repair on load | Same issue on import (§7) |
|---|---|---|
| Missing `createdAt` / `updatedAt` / `demoRecord` | default `now` / `false`, reported | warning, same default |
| Optional reference to a missing record (e.g. `task.dealId`, `unit.actualUse.brandId`, `deal.contactIds[i]`) | set to `null` / removed from the array, reported per field | warning, same repair |
| Mandatory parent missing (`unit.projectId`, `unit.buildingId`, `unit.floorId`, `floor.buildingId`, `building.projectId`, `deal.projectId`) | record kept and flagged as **orphan** in Data hygiene ("n orphan records"), excluded from KPIs (07_CALCULATIONS_AND_KPI_RULES.md missing-value rule) | **error**, import rejected |
| `deal.unitIds` contains an unknown unit | unknown ID removed, reported | error |
| Status/stage key unknown in `settings` and `DEFAULT_CONFIG` | value kept, unit shown with the `Unknown` status colour, listed in Data hygiene "inconsistent unit status" | error `E-CONFIG-STATUS` / `E-CONFIG-STAGE` |
| Category/subcategory unknown | kept, listed as "missing category" | warning `W-CONFIG-CATEGORY` |
| Back-link arrays inconsistent (`project.unitIds`, `floor.unitIds`, `unit.dealIds`) | rebuilt from the forward references (forward reference wins) | rebuilt silently, counted in the preview |

The report `{issues: [{code, collection, id, field, action}], counts}` is shown as a toast ("Integrity repair: 3 issues fixed — details in Data hygiene") and written as one audit entry `state.repair` with the counts.

### 4.5 Corruption recovery screen

Shown instead of the app whenever step `RECOVERY(reason)` is reached (00_MASTER_PROMPT.md §65: "corrupted local data does not create a blank application"). `data-testid="recovery-screen"`; the corrupted raw string is held in memory for the lifetime of the screen.

| Option (`data-testid`) | Enabled when | Action | Audit entry written into the resulting state |
|---|---|---|---|
| Restore backup slot (`recovery-restore-backup`) | slot exists, parses and passes `validateEnvelope` (its `savedAt`, `origin` and entity counts are displayed) | slot string → state key → normal boot | `state.recovery.restored_backup {reason, slotSavedAt}` |
| Download raw data (`recovery-download-raw`) | always (also when the raw string is empty or `null`) | downloads `LSP_raw_state_YYYY-MM-DD.txt` (the exact string) | — (no state yet) |
| Import a JSON backup (`recovery-import-json`) | always | opens the import pipeline (§7); on success the imported state becomes current | `state.recovery.imported {reason, fileName}` |
| Reset to demo data (`recovery-reset-demo`) | after "Download raw data" was clicked **or** the checkbox "Discard the unreadable data without downloading" is ticked | §5 | `state.recovery.reset_demo {reason}` |

Wording (EN; RU in `data/i18n.js`): title "Stored data could not be loaded"; body "The data saved in this browser could not be read (reason: `<parse error / envelope check / migration to schema n / newer schema n>`). Nothing has been changed yet. Choose how to continue."; footnote "Prototype storage is the browser's localStorage. If this happens repeatedly, export JSON backups regularly." Each audit entry carries `details.reason` (first 200 characters of the error), `details.rawLength` and `details.checksumExpected`.

---

## 5. Reset to demo data

Available in Settings → Storage, on the Import / Export screen and on the recovery screen. Role: `founder_admin` only in the app (04_ROLES_AND_VISIBILITY.md action A19, footnote 12); unrestricted on the recovery screen because no session exists there.

1. Confirm dialog: "Reset replaces ALL data in this browser with the demo dataset. Your current data will be kept once in the backup slot. Export JSON first if you want to keep it." Two-step confirmation (checkbox "I understand" + button).
2. Flush pending save; copy the current state string to the backup slot (§3).
3. Build a fresh dataset with `LSP.demo.build()` from `data/demo.js` (a factory returning new objects, never the same references; every record `demoRecord: true`, D4/A-2), `meta.origin = 'demo'`, `meta.createdAt = now`, counters from the dataset.
4. First audit entry of the new state: `state.reset_demo {byUserId, previousOrigin, previousSavedAt}`.
5. Session: kept if `session.userId` exists in the demo `users` with the same `roleKey`; otherwise the session key is removed and the login screen is shown. `caseos-lsp-ui` is not touched.
6. Write, then render. The "DEMO DATA" banner is visible.

First run (no state key) uses steps 3–6 without confirmation and without the backup copy.

---

## 6. Export

Export is available on the Import / Export screen (00_MASTER_PROMPT.md §63 screen 22) and, for JSON, from the Storage panel and the recovery screen. Every export first flushes pending saves. Roles follow 04_ROLES_AND_VISIBILITY.md (actions A14–A16, footnote 11): JSON export is `founder_admin` only because the file contains restricted fields; CSV export is available to `founder_admin`, `head_ls`, `administrator` and, for own scope only, `manager`, always through the same field filter as the screens (commission columns only for `founder_admin`; no export contains a field the role cannot see on screen); `client` has no export.

### 6.1 JSON

| Item | Value |
|---|---|
| File name | `LSP_backup_YYYY-MM-DD.json` (local date; a second export on the same day appends `_HHMM`) |
| Content | The envelope of §1.2 exactly as stored, plus `meta.export = {exportedAt, byUserId, byRoleKey, includesInternal: true}`; `documents[].localUrl` is `null`; pretty-printed with 2 spaces (diff-friendly, ~15 % larger, acceptable) |
| Mechanism | `Blob` + `<a download>` + `URL.createObjectURL`, revoked after the click (same technique as CASE OS `exportAllJSON`; allowed by the `os/.htaccess` CSP which permits `blob:`) |
| Warning before download | "This file contains internal data: commissions, internal notes, contacts and negotiation terms. Store it only on company devices. It is not encrypted." (§13) |
| Audit | `export.json {fileName, bytes, counts}` appended after the download starts |

A JSON export is also the only supported way to move data between browsers or computers in v0.1.

### 6.2 CSV per table

One file per table, `LSP_<table>_YYYY-MM-DD.csv`. "Export all tables" triggers sequential downloads (browsers may ask permission for multiple downloads; the UI says so). No ZIP library is added (D2: no dependencies).

| Decision | Value | Rationale |
|---|---|---|
| Encoding | UTF-8 **with BOM** (`﻿`) | Excel needs the BOM to open Cyrillic UTF-8 correctly. CASE OS `downloadCSV` already does this. |
| Line ending | CRLF | Excel/Windows convention; matches CASE OS. |
| Delimiter | `;` (semicolon) | FACT: Excel opens CSV with the OS list separator; in Russian/Uzbek regional settings that is `;` because `,` is the decimal separator. A `,`-delimited file lands in one column when double-clicked. CASE OS exports use `;` and the team is used to it (A-08-5). Import auto-detects `;` / `,` / tab (§8.2). |
| Quoting | RFC 4180: fields containing the delimiter, `"`, CR or LF are quoted; `"` doubled | Standard. |
| Formula-injection guard | **string** cells starting with `=`, `+`, `-`, `@`, tab or CR are prefixed with `'` | Same as CASE OS; unlike CASE OS it is not applied to numeric cells, so negative numbers survive. |
| Numbers | No thousands separator; money is stored to cents (D20), so at most two decimals. Decimal separator per export option **Numbers for: Excel (comma) / Machine (point)**; default comma when UI language is RU, point when EN (D3/A-1) | With `;` as delimiter a comma decimal is unambiguous. Point decimals in RU Excel are coerced to dates for values like `12.5` (12 May). Q-08-2. |
| Empty / null | empty cell | Never `0`, never `null` text (00_MASTER_PROMPT.md §69 "never treat unknown values as zero"). |
| Booleans | `true` / `false` | |
| Dates | `YYYY-MM-DD`; timestamps ISO 8601 UTC (`2026-09-17T09:30:00Z`) | Excel recognises ISO dates in every locale; round-trip safe. |
| Arrays of scalars | joined with `\|`; an element containing `\|` is written `\\|` | e.g. `unitIds` = `UNIT-001\|UNIT-002` |
| Arrays of objects, nested notes, `polygonMappings`, `termsHistory` (D20) | not exported to CSV (JSON only); the column list says so | |
| Provenance (D16) | flattened as `provenance.<field>.conf`, `.src`, `.how`, `.at`, `.by`, `.name`, `.note` for the D16 fields of units, deals and projects | Confidence marks travel with the numbers; a value without a record is exported with empty provenance cells ("no source"), never with a default. |
| Column names | flattened JSON paths with dots: `area.glaM2`, `leasingTerms.askingRent`, `expansionRequirements.minimumAreaM2` | Deterministic, no second vocabulary; the same headers are the import contract (§8). |
| Header row | first row = column names; no `sep=;` hint line | The hint breaks non-Excel tools. |

Tables and columns (column order = order below; scalar fields per the 00_MASTER_PROMPT.md schemas cited; full field lists in 03_DATA_MODEL.md):

| Table | Columns (abridged; `…` = remaining scalar fields of the schema in the cited section) | Source |
|---|---|---|
| projects | `id, name, alternativeNames, demoRecord, clientIds, city, country, address, latitude, longitude, assetTypes, status, areas.gbaM2, areas.glaM2, areas.leasableAreaM2, areas.sellableAreaM2, areas.unitCount, areas.floorCount, commercial.*, team.*, buildingIds, floorIds, unitIds, documentIds, createdAt, updatedAt` | §9 |
| buildings | `id, projectId, name, blockCode, status, floorIds, externalIds.caseOsObjectId, createdAt, updatedAt` | §10 |
| floors | `id, projectId, buildingId, floorNumber, name, status, floorPlanIds, unitIds, createdAt, updatedAt` | §10 |
| units | `id, projectId, buildingId, floorId, unitNumber, label, commercialStatus, visibility, demoRecord, area.glaM2, area.grossUnitAreaM2, area.mezzanineM2, area.terraceM2, geometry.polygonId, geometry.frontageLengthM, geometry.areaSource, targetUse.category, targetUse.subcategory, targetUse.brandProfile, targetUse.merchandiseRole, targetUse.preferredUnitType, actualUse.brandId, actualUse.tenantName, actualUse.category, actualUse.subcategory, leasingTerms.* (15 fields), salesTerms.* (7 fields), responsibility.*, operational.nextAction, operational.nextActionDate, operational.lastActivityDate, dealIds, externalIds.caseOsUnitCode, createdAt, updatedAt` | §11 |
| brands | `id, name, legalName, website, countryOfOrigin, operatingCountries, status, visibility, demoRecord, classification.category, classification.subcategory, classification.priceSegment, classification.format, classification.brandType, companyId, contactIds, expansionRequirements.* (15 fields), relationship.ownerId, relationship.source, relationship.lastContactDate, relationship.nextFollowUpDate, relationship.relationshipStatus, history.projectIds, history.unitIds, history.dealIds, history.rejectedProjectIds, createdAt, updatedAt` | §18 |
| companies | `id, legalName, tradingName, country, website, industry, companyType, brandIds, contactIds, responsibleManagerId, demoRecord, createdAt, updatedAt` | §19 |
| contacts | `id, firstName, lastName, position, companyId, brandIds, phones, emails, messagingApps, city, country, preferredLanguage, relationshipOwnerId, lastContactDate, nextAction, nextActionDate, demoRecord, createdAt, updatedAt` | §20 |
| requirements | `id, brandId, companyId, contactIds, type, status, targetCities, targetProjects, minimumAreaM2, preferredAreaM2, maximumAreaM2, category, subcategory, budget fields…, createdAt, updatedAt` | §21, 03_DATA_MODEL.md |
| deals | `id, type, projectId, unitIds, brandId, companyId, contactIds, ownership.*, stage, probability, dateEnteredStage, status, commercialTerms.* (16 fields), nextAction.text, nextAction.ownerId, nextAction.dueDate, activity.lastContactDate, outcome.*, commission.* (exported for `founder_admin` only, 04_ROLES_AND_VISIBILITY.md footnote 11), visibility, demoRecord, createdAt, updatedAt` | §24, §38 |
| tasks | `id, title, projectId, unitId, brandId, dealId, assigneeId, dueDate, priority, status, comment, createdAt, completedAt` | §27 |
| activities | `id, type, at, authorId, projectId, unitId, brandId, companyId, contactId, dealId, summary, visibility, createdAt` | §28 |
| comments | `id, authorId, at, relatedType, relatedId, visibility, responseStatus, text, createdAt` | §29 |
| documents | `id, fileName, category, projectId, unitId, brandId, dealId, version, uploadedBy, uploadedAt, visibility, fileSize, comment` (no `localUrl`) | §30 |
| statusHistory, auditLog | `id, at, userId, entityType, entityId, from, to, reason` / `id, at, userId, roleKey, action, entityType, entityId, summary` | §54 |

Every CSV export writes one audit entry `export.csv {table, rows, fileName}`. The `client` role has no CSV export; client reports are printed from the portal (00_MASTER_PROMPT.md §37).

---

## 7. Import JSON

Replace-all import of an LSP envelope (00_MASTER_PROMPT.md §42: "Validate imports before replacement. Invalid imports must not corrupt the application."). Merge import is not in v0.1 (D9). Role: `founder_admin` only (04_ROLES_AND_VISIBILITY.md action A15, footnote 12).

### 7.1 Validation pipeline

The file is read with `FileReader.readAsText(file, 'utf-8')`; nothing is written until the last step.

| # | Step | Errors (block) | Warnings (allow) |
|---|---|---|---|
| 1 | Parse JSON (accept a leading BOM; max file size 50 MB, larger → `E-SIZE`) | `E-PARSE` with line/column from the exception message | — |
| 2 | Detect format: LSP envelope (`meta` + `data`) → continue; CASE OS blob (`OBJECTS` and `U` arrays, no `meta`) → hand over to the adapter (§9); anything else → `E-ENVELOPE` | `E-ENVELOPE` | — |
| 3 | Envelope checks of §4.2 | `E-SCHEMA`, `E-KEY-MISSING`, `E-KEY-TYPE`, `E-ID-FORMAT`, `E-ID-DUP` | `W-CHECKSUM` (mismatch is reported as error `E-CHECKSUM` unless the user ticks "file was edited manually — ignore checksum") |
| 4 | Schema compatibility: `schemaVersion` < current → run migrations on the copy (`W-MIGRATED from→to`); `>` current → `E-SCHEMA-NEWER` | `E-SCHEMA-NEWER`, `E-MIGRATION` | `W-MIGRATED` |
| 5 | Required keys / record fields per 03_DATA_MODEL.md validators (mandatory scalars such as `unit.unitNumber`, `deal.type`, `deal.stage`) | `E-FIELD` | `W-FIELD-DEFAULTED` |
| 6 | Reference resolution (§4.4 table, import column) | `E-REF-PARENT`, `E-REF-UNIT` | `W-REF-OPTIONAL` (nulled on apply) |
| 7 | Config compatibility: every `unit.commercialStatus`, `deal.stage` (per `deal.type`), `outcome.lostReason`, `visibility` value must exist in the incoming `settings` or in `DEFAULT_CONFIG`; incoming `settings` is validated against the config schema of 05_STATUSES_STAGES_AND_CONFIG.md and against the role/visibility guards G3–G8 of 04_ROLES_AND_VISIBILITY.md (a settings block that would unlock `founder_admin` capabilities or add a `restricted` field to a client whitelist is refused) | `E-CONFIG-STATUS`, `E-CONFIG-STAGE`, `E-CONFIG-SCHEMA`, `E-CONFIG-GUARD` | `W-CONFIG-CATEGORY`, `W-CONFIG-LOST-REASON`, `W-CONFIG-DIFFERS` (incoming settings differ from current) |
| 8 | `demoRecord` handling: count demo vs non-demo per collection; mixed file → `W-DEMO-MIXED`; option "Strip demo records" removes every `demoRecord: true` record, then step 6 is re-run (a real record pointing to a stripped demo record becomes `E-REF-PARENT`) | — | `W-DEMO-MIXED`, `W-DEMO-ALL` |
| 9 | Size estimate: serialized length vs thresholds of §12 | `E-QUOTA` if the estimate exceeds the hard limit measured by the probe | `W-QUOTA-LARGE` |

### 7.2 Preview (`data-testid="import-preview"`)

| Block | Content |
|---|---|
| Source | file name, size, `meta.appVersion`, `meta.schemaVersion` (→ migrated to), `meta.savedAt`, `meta.export.exportedAt/by` if present, `meta.origin` |
| Counts | table per collection: current count → incoming count (demo / real split), so the user sees what will disappear |
| Warnings | grouped by code with counts and up to 10 examples each (collection + id + field) |
| Errors | same grouping; if any error exists the **Confirm** button is disabled and the text says "Fix the file or choose another one" |
| Options | "Strip demo records", "Ignore checksum (file edited manually)", "Keep current session" (default on) |
| Buttons | **Confirm import — replace all data** (`import-confirm`, enabled only with zero errors, second click within a 3-second countdown is not required; a single explicit confirm dialog is) and **Cancel** (`import-cancel`) |

### 7.3 Apply (atomic)

1. Flush pending save; copy the current state string to the backup slot (§3).
2. Serialize the validated in-memory copy with `meta.origin = 'import'`, `meta.savedAt = now`, counters recomputed; `meta.export` set to `null`.
3. `setItem` once. If it throws (quota), nothing has changed: the in-memory state is still the old one, the backup slot equals the old state; error `E-QUOTA` is shown with the Storage panel.
4. Only after a successful write: replace `appState`, re-run session validation (§11: the session survives only if the user exists in the imported `users` with the same `roleKey`; otherwise logout), re-render.
5. Append audit entry `import.json.completed {fileName, bytes, counts, warningsByCode, strippedDemo, migratedFrom}` to the **new** state (this triggers a normal save). Rejected imports append `import.json.rejected {fileName, errorsByCode}` to the **current** state so that attempts are traceable (00_MASTER_PROMPT.md §54).

Cancel at any point leaves storage and memory untouched; the file content is discarded.

---

## 8. Import CSV

Additive import for four tables: **brands, companies, contacts, units** (D9). Deals, tasks, activities, comments, documents and plans are JSON-only in v0.1. Roles: `founder_admin`, `head_ls`, `administrator` (04_ROLES_AND_VISIBILITY.md action A17). Screen: Import / Export → "Import CSV" (`js/views/importexport.js`); logic in `js/state.js` (`LSP.csv.parse`, `LSP.csv.map`, `LSP.csv.validate`) so Node tests can run it (§14).

### 8.1 Modes

| Mode | Behaviour |
|---|---|
| Add new only (default) | Rows matching an existing record (by `id` or by the duplicate rules of §8.4) are skipped and listed as "existing". |
| Update matched | Rows matching by `id` (exact) or by the duplicate rules update the existing record; only columns present in the file are written; empty cells mean "no change". New rows are created. |

### 8.2 Parsing

Delimiter auto-detected from the header line by counting `;`, `,` and tab (the CASE OS `parseCSV` rule, extended with tab); BOM stripped; CRLF/LF accepted; RFC 4180 quoting; a leading `'` guard character is removed from string cells. Decimal comma is accepted whenever the delimiter is not `,`; otherwise only the point. Dates accepted: `YYYY-MM-DD`, `DD.MM.YYYY`, `DD/MM/YYYY` (converted to ISO; ambiguous `MM/DD` is not guessed — a warning asks the user to use ISO). Arrays split on unescaped `|`. Maximum 10 000 rows per file (`E-CSV-ROWS`).

### 8.3 Column mapping UI (`data-testid="csv-mapping-table"`)

| Element | Rule |
|---|---|
| Auto-mapping | exact header match to the export column names of §6.2 (case-insensitive), then the alias list in `data/i18n.js` (e.g. `name`/`Название`/`Бренд` → `name`; `Телефон`/`phone` → `phones`; `площадь`/`area`/`GLA` → `area.glaM2`; `код`/`code`/`unit` → `unitNumber`). |
| Manual mapping | one select per file column: target field or "skip"; a field can be mapped once; required fields must be mapped before Preview is enabled. |
| Required fields | brands: `name`. companies: `legalName` or `tradingName`. contacts: `firstName` or `lastName`, plus at least one of `phones`, `emails`. units: `projectId` (or project name), `unitNumber`; `buildingId`/`floorId` (or `building` block code + `floorNumber`) — if the project has exactly one building/floor they may be omitted and are filled in. |
| Reference columns | accept an ID (preferred) or the exact display name: `companyId` (company legal/trading name), `brandIds` (brand names), `projectId` (project name), `responsibleManagerId` (user display name). Unresolved → row error `E-ROW-REF`. |
| Config columns | `commercialStatus`, `classification.category`, `targetUse.category`, `classification.format` accept the config key, the current-language label or a registered alias, resolved by the D21 normalize function of the taxonomy; unknown status → row error; unknown category → row warning (kept as text, listed in Data hygiene). |
| Saved mappings | the last mapping per table is remembered in `caseos-lsp-ui` (`csvMappings[table]`). |

### 8.4 Duplicate detection (00_MASTER_PROMPT.md §5 item 30, §33 Data hygiene)

Normalisation: `norm(s)` = NFKC, lower-case, trim, collapse whitespace, remove punctuation and quotes, strip legal-form tokens for companies (`ООО, МЧЖ, ЧП, ЯТТ, LLC, Ltd, GmbH, JSC, АО`), transliteration is **not** attempted (A-08-8). `normPhone(p)` = digits only; 9 digits → prefixed `998` (Uzbekistan default); leading `8` followed by 10 digits → `7…`; result compared as full digit string. `normEmail(e)` = lower-case trim.

| Table | Match rule (any → duplicate) | Within-file duplicates |
|---|---|---|
| brands | `norm(name)` equal; or `website` host equal | second occurrence → row warning `W-ROW-DUP-FILE`, skipped |
| companies | `norm(legalName)` or `norm(tradingName)` equal to either name of an existing company; or website host equal | same |
| contacts | any `normPhone` equal; or any `normEmail` equal; or `norm(firstName+lastName)` equal **and** same resolved `companyId` | same |
| units | same `projectId` and `norm(unitNumber)` | `E-ROW-DUP-FILE` (error: unit numbers must be unique per project, 00_MASTER_PROMPT.md §65) |

The same rules power the live duplicate warnings in forms (services function, see 03_DATA_MODEL.md), so CSV import and manual entry behave identically.

### 8.5 Preview and partial import policy

Preview lists every row with a status: `new`, `update`, `existing (skipped)`, `warning`, `error`, with the message and the offending column. Summary counts per status. Row-level errors (`E-ROW-REQUIRED`, `E-ROW-REF`, `E-ROW-TYPE` e.g. non-numeric area, `E-ROW-STATUS`, `E-ROW-DUP-FILE`) do **not** block the import: valid rows are imported, error rows are skipped (partial import), and the user can download `LSP_import_errors_YYYY-MM-DD.csv` (original columns + `error` column). A file whose header cannot be mapped or that has more than 50 % error rows is rejected as a whole (`E-CSV-QUALITY`) to catch wrong-file mistakes. Apply is atomic per file (all accepted rows in one `commit`), preceded by the backup slot copy. Audit: `import.csv.completed {table, mode, fileName, created, updated, skipped, errors}`; new records get `demoRecord: false`, `createdAt = now`, and `statusHistory` gets an initial entry for imported units (`from: null, to: commercialStatus, reason: 'csv import'`). CSV import never fabricates provenance (D16): imported areas, rents and statuses carry no `provenance` record and therefore show the "no source" mark until a user sets one.

---

## 9. CASE OS backup adapter

Purpose: let the team test LSP with the real structure of their properties (D1 bridge). Role: `founder_admin` only (04_ROLES_AND_VISIBILITY.md action A18, footnote 12). It is an **import transformation**, not a synchronisation: after import the two systems diverge, and LSP records keep `externalIds.caseOsObjectId` / `externalIds.caseOsUnitCode` (D13) so a future fold-back can match them.

### 9.1 Detection and inputs

FACT (`os/core.js` `stateBlob()`): a CASE OS backup is a flat object with the keys `TAXO, OBJECTS, U, BRANDS, USERS, CHANGES, BENCH, REFUSALS, PLANUP, PLANSVG, PLAN_LABELPOS, PLAN_CODES, PLAN_SNAPSHOT_SVGS, PLAN_STRUCT, PLAN_IGNORED_CODES, DOCREG, DOC_CONTACTS, AGENTS, ROLES, KPSEQ, ACTLOG, AUDIT, MAPCFG, ... OWNER_REPORTS, CASE_CLIENTS, ..., CASE_LAYOUT_VERSIONS, ...` and no `meta`. Detection rule: `Array.isArray(obj.U) && Array.isArray(obj.OBJECTS) && !obj.meta`. The blob carries no version field; the adapter is written against the v4.73.1 key layout, which the brief's addendum verifies to be the v4.51.0 layout plus `PROV` (A-08-6), and reports unknown keys instead of failing. FACT (v4.73.1 `state.php`/`lib.php`): a backup produced by a CASE OS user without `finance` rights contains units without `rate`/`budget`; the adapter detects a blob whose units all lack `rate` and warns `W-CO-FINANCE-REDACTED` ("rates missing — export the backup as a finance-enabled user").

### 9.2 Mapping summary

The field-level mapping table is owned by 03_DATA_MODEL.md §9; this table fixes the adapter's behaviour and warnings.

| CASE OS source | LSP target | Rule | Warning codes |
|---|---|---|---|
| `OBJECTS[]` `{id, name, ru, country, city, type, gba, gla, cur, ...}` | `projects` | `externalIds.caseOsObjectId = id`; `alternativeNames = [ru]`; `assetTypes` from `type`; `areas.gbaM2/glaM2` (0 → `null`); currency from `cur` (contains "сум" → `UZS`, else `USD`); `comm` (commission config) is **not** imported | `W-CO-CURRENCY`, `W-CO-COMM-SKIPPED` |
| `PLAN_STRUCT[objId].blocks`, `U[].block`, `PLANSVG` keys `objId::block::floor` | `buildings` | one building per distinct block code per object; objects without blocks get one building "Main" (`blockCode: null`) | `W-CO-NO-BLOCKS` |
| `U[].floor` labels (`'1 этаж'`, `'2 этаж'`, `'Цоколь'`, …) | `floors` | one floor per (building, label); `floorNumber` = leading integer of the label, `Цоколь`/`Подвал` → `0`/`-1`, otherwise `null`; `name` = label | `W-CO-FLOOR-UNPARSED` |
| `U[]` `{id, code, area, terr, cat, sub, rate, total, status, broker, vars, dates, comment, merged, hist, budget}` | `units` | new `UNIT-nnn`; `unitNumber = code`; `externalIds.caseOsUnitCode = code`; `area.glaM2 = area` (0/empty → `null`); `area.terraceM2 = terr`; `targetUse.category/subcategory` via the CASECATS → LSP mapping table (D15 defaults plus D21 `aliases`, editable in the dry-run); `leasingTerms.askingRent = rate`, `rentUnit` per project currency; `responsibility.responsibleManagerId` from `broker` via the broker → user table (editable); `comment` → `operational.notes[0]`; `merged` → one unit, `label = codes.join(' + ')` (Q-08-7) | `W-CO-NO-AREA`, `W-CO-CATEGORY-UNMAPPED`, `W-CO-BROKER-UNMAPPED`, `W-CO-MERGED` |
| `U[].status` (`STAT`: `vac, neg, off, os, cs, cd, res`) | `unit.commercialStatus` + open `deals` | **split rule** (D5): `vac` → `Available`, no deal; `res` → `Reserved`, deals at `Negotiation`; `neg` → `Available` + deals at `Negotiation`; `off` → `Available` + deals at `Property / Unit Offered`; `os` → `Available` + deals at `LOI / Commercial Terms`; `cs` → `Available` + deals at `Contract Draft`; `cd` → `Contract Signed` + one open deal at `Contract Signed` for `vars[0]` (`actualUse.tenantName = vars[0]`). Unknown value → `Unknown` | `W-CO-STATUS-UNKNOWN` |
| `U[].vars` (candidate brand names) | `deals` (type Leasing) | one deal per name, `brandId` resolved by `norm(name)` against imported brands (else `brandId: null`, `W-CO-BRAND-UNRESOLVED`); stage per split rule; `vars[1..]` on `cd` units get `Lead`; probability from config; `dateEnteredStage = null`; `statusHistory` initial entry per unit (`reason: 'CASE OS import'`) | `W-CO-BRAND-UNRESOLVED` |
| `U[].dates` `[[label, date]]` | `tasks` | `title = label`, `dueDate = date`, `status = Open` if date ≥ today else `Done`, linked to project/unit | `W-CO-DATES` (count) |
| `U[].hist` `[[date, text]]` | `activities` (type "email note") linked to the unit | authorId `null` | — |
| `BRANDS[]` `{name, cat, sub, country, format, amin, amax, person, phone, email, site, ig, reqs, coten, status, notes, about, group, tier, price, ...}` | `brands` | classification via CASECATS mapping; `expansionRequirements.minimumAreaM2/maximumAreaM2 = amin/amax`; `fitOutRequirements = reqs`; `status active/target/refused` → `relationship.relationshipStatus`; `notes/about` → `notes.internal/general`; `site` → `website`; `ig`, `coten`, `tier`, `price`, `uz_op`, `net_*` → typed fields where 03_DATA_MODEL.md has them, else `notes.internal` | `W-CO-CATEGORY-UNMAPPED` |
| `BRANDS[].group` | `companies` | one company per distinct `norm(group)`; `brand.companyId` set; empty `group` → `companyId: null` (no company per brand, 00_MASTER_PROMPT.md §19) | — |
| `BRANDS[].person/phone/email` | `contacts` | one contact per brand having any of the three; `firstName/lastName` split on the first space; deduplicated by §8.4 rules; linked via `contactIds` and `brandIds` | `W-CO-CONTACT-DUP` |
| `DOC_CONTACTS[]` `{name, title, phone, email}` | `contacts` | same split/dedupe; `position = title`; no brand link | `W-CO-CONTACT-DUP` |
| `PROV[<entity>:<id>:<field>]` `{conf, src, name, at, by, how, basis, note}` (v4.71.0) | inline `provenance` records (D16) | FACT (`v4710-provenance.js` line 109, `core.js` call sites): key = `entity + ':' + id + ':' + field`, entity `'unit'` with the CASE OS unit **id** (`u12`, not the code), fields `'area'` and `'rate'` (plus `status` and object `gba`/`gla` per the brief's addendum). 1:1 mapping: `unit:<u.id>:area` → `unit.provenance.glaM2`, `unit:<u.id>:rate` → `unit.provenance.askingRent`, `unit:<u.id>:status` → `unit.provenance.commercialStatus`, `object:<id>:gba|gla` → `project.provenance.areas.gbaM2|glaM2`; the adapter resolves `<u.id>` through its in-memory `U[].id → UNIT-nnn` map (no extra `externalIds` field is persisted); remaining tokens documented in 13_CASE_OS_v4731_REUSE.md and 03_DATA_MODEL.md §9; `conf` (modelled/asking/verified), the closed `src`/`how` lists and `at/by/name/basis/note` are copied verbatim; keys whose entity or field has no LSP counterpart are counted and skipped; finance keys absent in a redacted backup stay absent (no default is invented). The mapping is symmetric so a future fold-back can write `PROV` keys | `W-CO-PROV-UNMAPPED` |
| `PLANSVG[key]` `{kind:'svg', data}` | `floorPlans` | `version 1, current: true`, `svgText = data` after sanitising (strip `<script>`, `<foreignObject>`, `on*` attributes, external `href`, per 06_FLOORPLAN_ARCHITECTURE.md); `polygonMappings` proposed by the **experimental** text-label matcher (`<text>` equal to a unit code, port of the `parsePlanLabels` idea) and stored as **suggestions** (`confirmed: false`) until confirmed in the mapping wizard (00_MASTER_PROMPT.md §6.7, §16) | `W-CO-PLAN-LABELS-ONLY`, `W-CO-PLAN-NO-MATCH` |
| `PLANSVG[key]` `{kind:'img', data}` (raster data URL) | `floorPlans` with `backgroundUrl` | **off by default** (size); if enabled, quota estimate shown per plan | `W-CO-PLAN-RASTER-SKIPPED` |
| `USERS[]`, `AGENTS[]` | `users` | role mapping per D7 and the CASE OS role mapping table in 04_ROLES_AND_VISIBILITY.md (`ASH/ADM/CFO → founder_admin`, `BA/DIR → head_ls` (D22), `AG → manager`, `HO/BSH/BRJ → administrator`, `AGX → external_agent`, `HM` → not imported, listed in the preview as "no LSP role"); `broker` names are matched to `displayName` and written to `ownership.responsibleManagerId` of the deals created from `vars` and to `responsibility.responsibleManagerId` of units; no passwords are read or written | `W-CO-ROLE-MAPPED`, `W-CO-USER-SKIPPED` |
| `AUDIT`, `ACTLOG`, `CHANGES` | not imported | LSP `auditLog` starts with the import entry | listed under "skipped" |
| `REFUSALS` | not imported in v0.1 (candidate: `brand.history.rejectedProjectIds`) | | listed under "skipped" |
| `CASE_LAYOUT_VERSIONS`, `PLAN_CODES`, `PLAN_SNAPSHOT_SVGS`, `PLAN_LABELPOS`, `PLAN_IGNORED_CODES`, `PLANUP` | not imported | LSP has its own plan versioning (06_FLOORPLAN_ARCHITECTURE.md) | `W-CO-LAYOUT-VERSIONS-SKIPPED` (count) |
| `DOCREG`, `CASE_TASKS`, `CASE_CLIENTS`, `CASE_OPPORTUNITIES`, `CASE_PROPOSALS`, `CASE_CONTRACTS`, commissions (`COMMCFG`, `COMMLOST`), `GEO_DATA`, `BENCH`, `KB`, `CHAT`, `QUIZ*`, `HRPROF`, `OWNER_REPORTS`, `CASE_PORTFOLIO_PROJECTS`, `TAXO`, `MAPCFG`, `TRASH`, everything else | skipped | consulting workflow, finance and knowledge data are outside LSP scope | each key with its record count |

### 9.3 Dry-run report and confirmation

The adapter always runs as a dry run first and shows, before anything is written:

1. **Counts** of LSP records that would be created per collection (projects, buildings, floors, units, deals, brands, companies, contacts, tasks, activities, floorPlans, users).
2. **Mapping tables** the user can edit inline and that are remembered in `caseos-lsp-ui`: CASECATS → LSP category (pre-filled from D15 defaults and D21 `aliases`; confirmed mappings are added to the category aliases so the next import needs no manual step), broker name → LSP user, `STAT` → status/stage split (read-only in v0.1, shown for transparency).
3. **Warnings** grouped by code with counts and examples (table above).
4. **Skipped keys** with record counts, so nothing disappears silently.
5. **Size estimate** of the resulting state and of the SVG plan text separately, against the §12 thresholds; a checkbox per plan to exclude it.
6. **Privacy warning** (mandatory checkbox): "This CASE OS backup contains real project, unit, brand and contact data. After import it is stored unencrypted in this browser profile. Use it only on a trusted company device and reset to demo data when you are done."

Confirm hands the generated envelope (`meta.origin = 'caseos-adapter'`, all records `demoRecord: false`) to the JSON import pipeline steps 3–9 and apply (§7.1, §7.3) — the same validation, atomicity and backup-slot rules apply. Audit: `import.caseos.completed {fileName, counts, warningsByCode, skippedKeys, mappingsUsed}`. The adapter is replace-all like any import; a merge of CASE OS data into an existing LSP dataset is not supported in v0.1.

---

## 10. Documents and files (00_MASTER_PROMPT.md §6.2, §30)

| Rule | Detail |
|---|---|
| What is stored | Only the `documents[]` metadata record (§30 schema: `fileName, category, projectId, unitId, brandId, dealId, version, uploadedBy, uploadedAt, visibility, fileSize, comment`). File **bytes are never stored** in localStorage, and IndexedDB is not used in v0.1 (Q-08-4). |
| `localUrl` | Runtime only. When a user attaches a file in the Documents screen, the app keeps `{blob, objectUrl}` in a runtime map `LSP.files` keyed by document ID and sets `documents[i].localUrl` in memory; the serializer writes `localUrl: null`. Object URLs are revoked on logout, on detach and on page unload. After a reload the record shows "File not attached in this session — re-attach to open" (not a fake button; the Open action is disabled with that tooltip). |
| Demo documents | `demoRecord: true` records have `localUrl: null` and `fileSize` set; their Open action renders a generated **document card** (metadata, version, visibility, linked objects, "file content is not part of the prototype") that can be printed. This keeps Flow 9 step 9 ("Open approved file") honest. |
| Size limits | Attaching is limited to 25 MiB per file with a warning (mirrors the CASE OS `project_files.php` upload limit so that the future backend does not surprise the team); it affects memory only. |
| Registration | "Register document" creates the metadata record with `uploadedBy = session.userId`, `uploadedAt = now`, `version = 1`; a new version of the same logical document is a new record with `version + 1` and the same `fileName`; audit `document.registered`. |
| Visibility | `Internal` / `Client-visible` / `Restricted` per §30; the portal receives records only through `clientView()` (D7). Export CSV includes the metadata of all visibility levels for internal roles. |
| No security claim | The README and the Documents screen state: "Prototype file registry. Files are not stored by the application; production storage requires secure backend storage." |

---

## 11. Session and UI preferences persistence

| Key | Shape | Rules |
|---|---|---|
| `caseos-lsp-session` | `{userId: 'USER-001', roleKey: 'manager', clientId: null \| 'CLIENT-001', loginAt: ISO}` | Written at login (00_MASTER_PROMPT.md §32: local session persistence), removed at logout. On boot the session is valid only if `userId` exists in `data.users` with the same `roleKey` and the role exists in config; otherwise the key is removed and the login screen appears. No password or token is stored (§6.1). A `storage` event with a null value logs out all tabs. The login screen shows the prototype-authentication warning. |
| `caseos-lsp-ui` | `{lang: 'en' \| 'ru', theme: 'light' \| 'dark' \| 'system', lastRoute, lastProjectId, lastBuildingId, lastFloorId, planMode, tables: {[tableId]: {cols, sort, widths}}, filters: {[view]: …}, sidebarCollapsed, csvMappings: {[table]: …}, adapterMappings: {…}, demoBannerDismissedAt}` | Per browser, never contains business data, never exported. Written with its own 300 ms debounce and never changes the save indicator. Any read/write failure falls back to defaults (`lang: 'en'` per D3/A-1). Survives reset and import. |

Both keys are read inside `try/catch`; a malformed value is discarded, not repaired.

---

## 12. Quota strategy and size monitoring

### 12.1 Facts and assumptions

FACT: localStorage stores strings as UTF-16; browsers cap the origin at roughly 5 MiB (Safari) to 10 MiB (Chromium, Firefox), i.e. about 2.5–5 million characters for all keys of the origin together (A-08-4). The backup slot doubles the LSP footprint. FACT: on `https://caseadvisory.uz` the `os/leasing/` app shares the origin with CASE OS, whose `persist()` writes `asaas-os-demo-state-v7` (and table/UI prefs) on the same origin even in backend mode, so the two applications compete for the same quota (Q-08-1). On `file://`, Chromium treats every local file as the same origin, so other local HTML tools share the quota too, and the multi-file build and the standalone `os/leasing/LSP_standalone.html` (D18) then read and write the **same** keys; Firefox scopes `file://` storage per directory, so there they do not. A hosted copy never shares storage with a copy opened from disk. The add-on size budget of D18 (≤ 1.5 MB) applies to the shipped files, not to localStorage.

### 12.2 Measurement and thresholds

`LSP.persistence.getStorageStats()` returns `{stateChars, backupChars, otherKeysChars (all non-LSP keys), estimatedMB: chars × 2 / 1 048 576, byCollection: {floorPlans: n, auditLog: n, …}, byPlan: [{planId, chars}]}`. It runs after every save (cheap: string lengths) and feeds the Storage panel and the notification rules.

| Level | Trigger (estimated MB of the state string alone) | Behaviour |
|---|---|---|
| ok | < 2 MB | — |
| notice | ≥ 2 MB | Storage panel badge; hint that the backup slot may fail on 5 MiB browsers |
| warning | ≥ 4 MB (D9) | persistent toast once per session; notification "Storage is large — export JSON and archive plans"; Import / CASE OS adapter previews show the estimate in red |
| error | write failed | §2.4 |

### 12.3 Reduction actions (Settings → Storage)

- Per-plan size list with "Drop SVG text of archived plan versions" (keeps the `floorPlans` record, `polygonMappings` and history; sets `svgDropped: true`; the plan can be re-uploaded). Current plans are never dropped automatically.
- "Compact audit log": export the log as CSV first (mandatory), then keep the last N = 2 000 entries (`config.persistence.auditKeep`, editable).
- "Compact activities older than …": not in v0.1 (activities are small).
- Show `otherKeysChars` with the note "other applications on this site are using n MB of the shared browser storage".

### 12.4 Design rules that keep the state small

SVG plan text is the main driver (D9). Demo plans are hand-authored and small (< 60 K characters each, 06_FLOORPLAN_ARCHITECTURE.md). Raster backgrounds (`backgroundUrl` data URLs) are discouraged and reported per plan. No file bytes, no report HTML (reports store their input snapshot, not rendered markup), no derived values are persisted. IndexedDB is introduced only if real plan sets exceed the warning level in adapter tests (Q-08-4).

---

## 13. Security and privacy notes

| Statement | Detail |
|---|---|
| No secrets | The state never contains passwords, tokens or API keys; demo login is a user picker (00_MASTER_PROMPT.md §6.1, §32, §55). The repository never contains real client data: demo data is fictional (A-2), and CASE OS backups used for adapter tests stay on the tester's machine and are not committed. |
| Local only | Nothing leaves the browser: no `fetch`, no analytics, no sync. Import and export use `FileReader` and `Blob` downloads only, compatible with the `os/.htaccess` CSP (`connect-src 'self'`, `blob:` allowed for downloads). |
| Imported text is data | Strings from JSON, CSV and CASE OS imports are rendered through `textContent`/`createElementNS`, never concatenated into markup or SVG (D19; lesson of the CASE OS v4.70.3 stored-XSS patch). The plan sanitizer (§9.2) covers uploaded SVG; escaping covers registry data. |
| Browser profile risk | localStorage is readable by anyone who can open the browser profile, by browser extensions with storage access, and by other pages of the same origin. It is wiped by "Clear site data" and by some privacy tools. Statement shown in README and Settings → Storage: "Prototype persistence. Data is stored unencrypted in this browser profile. Use company devices only. Export JSON backups regularly." |
| Export warning text | Shown before every JSON/CSV download by internal roles: "This export contains internal data (commissions, internal notes, contacts, negotiation terms). Do not send it to clients or partners. It is not encrypted." |
| Client role | No export, no import, no Storage panel; portal data comes from `clientView()` only (D7, 04_ROLES_AND_VISIBILITY.md). |
| Backup reminder | Recommended notification rule `notifications.backupReminderDays = 7`: if no `export.json` audit entry exists in the last 7 days, the dashboard notification list shows "No JSON backup for 7 days" (Q-08-6). |
| Not claimed | Static HTML plus localStorage provides no security, access control or durability guarantee; production needs the architecture of 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md (server-side authorization, secure file storage, backups). |

---

## 14. Test hooks

### 14.1 Programmatic API (`window.LSP.persistence`, also `module.exports` in Node with an injected storage)

| Function | Purpose in tests |
|---|---|
| `createStore(storageLike)` | Build the persistence layer over any `{getItem, setItem, removeItem, key, length}` object (a `Map` wrapper in Node) so `js/state.js` logic runs without a browser (D10). |
| `serialize()` / `parse(str)` | Envelope round-trip; checksum computed and verified. |
| `validateEnvelope(obj)` / `validateImport(obj, options)` | Return `{errors: [{code, collection, id, field, message}], warnings: […], counts, migratedFrom}` without side effects. |
| `migrate(envelope)` / `registerMigration(toVersion, fn)` / `resetMigrations()` | Exercise the migration pipeline with a test-only migration (the shipped map is empty at 0.1.0). |
| `repairIntegrity(envelope)` | Returns the repair report for fixtures. |
| `save()` / `load()` / `flush()` | Force the write path; `flush()` cancels the debounce and writes immediately. |
| `getStorageStats()` | Threshold tests. |
| `csv.parse(text)` / `csv.map(rows, mapping, table)` / `csv.validate(records, table, mode)` / `csv.serialize(table, records, options)` | CSV round-trip and duplicate-rule tests. |
| `adapter.detect(obj)` / `adapter.dryRun(obj, mappings)` / `adapter.transform(obj, mappings)` | CASE OS adapter tests on a synthetic blob. |
| `now()` | Overridable clock so `savedAt`, `dueDate` comparisons and file names are deterministic. |

Browser tests set state before navigation with `page.addInitScript(() => localStorage.setItem('caseos-lsp-state-v1', FIXTURE))`, then assert `data-testid` / `data-state` attributes (§2.2, §4.5, §7.2, §8.3). Screens expose `data-testid="storage-panel"`, `import-preview`, `import-confirm`, `import-cancel`, `csv-mapping-table`, `recovery-screen`, `recovery-*`, `save-indicator`.

### 14.2 Fixtures (`docs/qa/lsp/fixtures/`)

| File | Content | Expected outcome |
|---|---|---|
| `corrupt_truncated.json` | a valid envelope cut at 60 % | recovery screen, reason `parse`; backup restore works |
| `corrupt_wrong_type.json` | a JSON array | recovery, reason `envelope` (`E-ENVELOPE`) |
| `corrupt_no_meta.json` | `{"data": {...}}` | recovery, `E-ENVELOPE` |
| `corrupt_checksum.json` | valid envelope, wrong checksum | loads with warning toast; import rejected `E-CHECKSUM` unless ignored |
| `state_v1_minimal.json` | smallest valid envelope (empty collections, default settings) | loads, no repair issues |
| `state_missing_collection.json` | envelope without `requirements` | loads with `W-KEY-ADDED`; import → `E-KEY-MISSING` |
| `migration_v1_to_test.json` | `schemaVersion: 1` envelope used with `registerMigration(2, fn)` | migrated, backup slot holds the pre-migration string, audit `state.migrated` |
| `state_newer_schema.json` | `schemaVersion: 99` | recovery, reason `newer-schema`; import → `E-SCHEMA-NEWER` |
| `repair_dangling_refs.json` | task → missing deal; unit → missing floor; deal → unknown unit | load: optional ref nulled, orphan flagged, unit ID removed; import: errors `E-REF-PARENT`, `E-REF-UNIT` |
| `import_dup_ids.json` | two units `UNIT-007` | import `E-ID-DUP` |
| `import_bad_id_format.json` | `unit.id = 'u12'` | import `E-ID-FORMAT` |
| `import_unknown_status.json` | `commercialStatus: 'Leased'` (not in config) | import `E-CONFIG-STATUS` |
| `import_mixed_demo.json` | demo + real records, real deal referencing a demo unit | `W-DEMO-MIXED`; with "Strip demo records" → `E-REF-UNIT` |
| `import_large.json` | generated envelope above the warning threshold | `W-QUOTA-LARGE`; save failure path with a mocked `setItem` throwing `QuotaExceededError` |
| `caseos_backup_synthetic.json` | fictional CASE OS blob with the v4.51.0 key layout: 2 objects, blocks/floors, 12 units across all `STAT` values incl. one `merged`, 6 brands with `group`, `DOC_CONTACTS`, one `kind:'svg'` plan with text labels, one `kind:'img'` plan, `USERS` for every role key incl. `DIR`, `PROV` entries for unit area/rate/status and object GBA/GLA; plus a finance-redacted variant `caseos_backup_synthetic_redacted.json` (units without `rate`/`budget`) | adapter detection, split rule, company derivation, dedupe, provenance mapping, `DIR → head_ls`, warnings, skipped keys, raster excluded by default; `W-CO-FINANCE-REDACTED` on the redacted variant |
| `csv/brands_ok.csv`, `csv/brands_ru_headers.csv` | `;` + BOM + comma decimals; Russian headers | auto-mapping, decimal parsing |
| `csv/contacts_dupes.csv` | phone/email duplicates against demo data and within the file | `existing (skipped)` / `W-ROW-DUP-FILE` |
| `csv/units_bad_rows.csv` | missing `unitNumber`, non-numeric area, unknown project, duplicate unit number | partial import, error report download, `E-CSV-QUALITY` variant with > 50 % errors |
| `csv/units_comma_delim.csv` | `,` delimiter, point decimals | delimiter auto-detection |

Test scripts (`docs/qa/tools/lsp_persistence.js`, `lsp_import_export.js`, `lsp_caseos_adapter.js`, Node unit tests for `csv.*` and `validateImport`; the browser scripts run against the multi-file build and against `LSP_standalone.html` produced by `docs/qa/tools/lsp_bundle.js`, D18) and their mapping to 00_MASTER_PROMPT.md §64 Flow 12 and the §65 persistence checks are defined in 10_QA_PLAN.md; results go to `docs/qa/lsp/*.json` in the CASE OS `{test, status, info}` format (D10).

---

## 15. Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-1 | UI language default EN with RU toggle (brief D3) | CSV number-format default (§6.2) follows the UI language |
| A-2 | Demo data is fictional (brief D4) | Export warnings would need to cover demo files too |
| A-3 | Merchandise categories default list (brief D15) | CASECATS mapping table pre-fill |
| A-08-4 | Target browsers grant at least 5 MiB localStorage per origin, measured in UTF-16 | Thresholds in §12.2 must be lowered; IndexedDB earlier |
| A-08-5 | The team opens CSV exports mainly in Microsoft Excel with Russian regional settings (`;` list separator, `,` decimal) | Delimiter/decimal defaults change; auto-detection on import stays |
| A-08-6 | CASE OS backups used with the adapter are `stateBlob()` exports of the live v4.73.1 build or of v4.51.0 (same layout plus `PROV`); older layouts are not supported | Adapter reports unknown keys instead of mapping them |
| A-08-7 | One person uses one browser profile; several tabs are possible, concurrent multi-person editing of one profile is not | §2.5 minimal multi-tab handling is sufficient |
| A-08-8 | Duplicate detection without transliteration (Cyrillic vs Latin brand names are distinct) is acceptable for v0.1 | Port the CASE OS `v4660-uz-translit.js` Cyrillic↔Latin logic into `norm()` (reuse candidate, 13_CASE_OS_v4731_REUSE.md) |

## 16. Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-08-1 | `os/leasing/` shares the localStorage origin and quota with CASE OS on caseadvisory.uz (and with other local files on `file://`). Accept for the prototype, or host it outside `os/` as D1 alternatively proposes? Related: is a fifth key for a corrupted-copy safety net acceptable, or does the "Download raw data" gate (§4.5) suffice? | Accept for v0.1; show other-key usage in the Storage panel; no fifth key — the download gate suffices. | Founder / product sponsor |
| Q-08-2 | CSV numbers: comma decimals by default for RU UI (Excel-friendly) versus point decimals always (machine-friendly)? | Option in the export dialog, default by UI language, import accepts both (§6.2). | Head of Leasing & Sales |
| Q-08-3 | Which roles may export, import and reset? | Settled by 04_ROLES_AND_VISIBILITY.md actions A14–A19 and footnotes 11–12: JSON export, JSON import, CASE OS adapter and reset are `founder_admin` only; CSV export `founder_admin`, `head_ls`, `administrator` and `manager` (own scope) with role-filtered columns; CSV import `founder_admin`, `head_ls`, `administrator`; `client` none. This document follows it; closed unless 04 changes. | Founder / product sponsor (approval of 04_ROLES_AND_VISIBILITY.md) |
| Q-08-4 | When is IndexedDB introduced for plans or files? | Not in v0.1. Trigger: a real project's state exceeds the 4 MB warning in adapter tests, or the team needs file content offline. Design then: plans and file blobs in IndexedDB, metadata stays in the envelope. | Founder / product sponsor |
| Q-08-5 | Import CASE OS raster plans (`kind: 'img'` data URLs) by default? | No; opt-in per plan with a size estimate (§9.2). | Head of Leasing & Sales |
| Q-08-6 | Add the backup-reminder notification rule (7 days without JSON export)? | Yes, configurable in Settings → Notifications. | Head of Leasing & Sales |
| Q-08-7 | CASE OS `merged` units: import as one LSP unit (label `A + B`) or as several units linked by one deal? | One unit with a combined label and a warning; the team can split it manually. Final field rule in 03_DATA_MODEL.md §9. | Head of Leasing & Sales |
| Q-08-8 | Should rejected import attempts be written to the audit log of the current state (§7.3)? | Yes (traceability per 00_MASTER_PROMPT.md §54); entries are small. | Founder / product sponsor |

---

Cross-references: 00_MASTER_PROMPT.md (§6.2, §8, §30, §42, §46, §47, §54, §55, §62, §64 Flow 12, §65), README.md (decision log), 01_PRODUCT_SPEC.md, 03_DATA_MODEL.md (entities, validators, CASE OS field mapping §9), 04_ROLES_AND_VISIBILITY.md (export/import rights), 05_STATUSES_STAGES_AND_CONFIG.md (config schema used by compatibility checks), 06_FLOORPLAN_ARCHITECTURE.md (SVG sanitising, plan versions, mapping wizard), 07_CALCULATIONS_AND_KPI_RULES.md (orphan and missing-value handling), 09_IMPLEMENTATION_PLAN.md (`js/state.js`, `js/views/importexport.js`), 10_QA_PLAN.md (tests for §14), 12_AI_AND_ECOSYSTEM_ARCHITECTURE.md (production storage and fold-back to CASE OS), 13_CASE_OS_v4731_REUSE.md (live build facts, `PROV`, packaging D18, reusable CASE OS fragments).
