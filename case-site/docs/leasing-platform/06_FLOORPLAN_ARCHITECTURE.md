# Interactive floor plan architecture

**Purpose.** This document specifies the interactive floor-plan subsystem of the Leasing & Sales Platform (LSP, `os/leasing/`, `LSP_VERSION = '0.1.0'`): the versioned `floorPlans` record and its `polygonMappings`, the SVG authoring conventions, the sanitize → inject → bind → decorate → colorize pipeline in `js/floorplan.js`, the five visualization modes, the unit drawer as seen from the plan, the Plan Import / Mapping Wizard, synchronisation and performance rules, the demo plans, the CASE OS `PLANSVG` import path, security limits, the future recognition path and the QA hooks. It answers planning item 6 of `00_MASTER_PROMPT.md §69` and covers `§3.2`, `§3.3`, `§3.5`, `§6.7`, `§10`, `§11` (`geometry`), `§13`–`§16`, `§35` (client floor plan), `§48` (mobile), `§50` (spatial entity layer), `§63` screens 5 and 20, `§64` flows 2–4 and 9 and the "Floor plans" block of `§65`. It is written so that `js/floorplan.js`, the floor-plan part of `css/lsp.css` and `data/demo-plans.js` can be implemented from it without re-reading the master prompt. Vocabulary follows the context brief (D1–D15), `03_DATA_MODEL.md`, `04_ROLES_AND_VISIBILITY.md` and `05_STATUSES_STAGES_AND_CONFIG.md`; facts cite `00_MASTER_PROMPT.md §n` or a CASE OS file; assumptions are labeled A-n; open questions are Q-06-n with a recommendation and an owner.

Status: DRAFT for approval — 2026-09-17

Related documents: `README.md`, `01_PRODUCT_SPEC.md`, `02_REQUIREMENTS_REVIEW.md` (C-9, C-10, C-12, R-2, R-7, R-15, R-18, R-20), `03_DATA_MODEL.md`, `04_ROLES_AND_VISIBILITY.md` (§7 drawer table, `clientView()`), `05_STATUSES_STAGES_AND_CONFIG.md`, `07_CALCULATIONS_AND_KPI_RULES.md`, `08_PERSISTENCE_IMPORT_EXPORT.md` (§9.2 `PLANSVG` adapter, §12 quota), `09_IMPLEMENTATION_PLAN.md`, `10_QA_PLAN.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (§6 spatial entity layer, mode registry).

---

## 1. Goals and acceptance

FACT (`00_MASTER_PROMPT.md §13`): the floor plan is a critical acceptance feature; at least one sample plan must contain true clickable polygons; `§69` repeats "the floor plan must contain real clickable unit polygons". FACT (`§3.3`): the plan is an operational interface, not an uploaded image. FACT (`§3.5`): no hidden state — a status change must be visible on the plan, in the unit table, CRM, dashboard, analytics, reports, portal (where permitted) and status history.

### 1.1 The fifteen user actions of §13 and where they land

| # | `§13` action | Screen / component | Mechanism in this document |
|---|---|---|---|
| 1 | select a project | 3 Projects List → 4 Project Dashboard | router `#/projects/:id/plan` (`04_ROLES_AND_VISIBILITY.md` screen 5) |
| 2 | select a building/block | plan toolbar, building select | `services.spatial.listBuildings(projectId)`; a project with one building hides the select |
| 3 | select a floor | plan toolbar, floor select | `services.spatial.listFloors(buildingId)`; `setFloor(floorId)` §4.7 |
| 4 | see the floor plan | plan host | `services.spatial.currentPlan(floorId)` → pipeline §4 |
| 5 | see clickable units | polygons bound through `polygonMappings` | §2.3, §4.4 |
| 6 | switch visualization modes | mode segmented control | `setMode(key)` §5 |
| 7 | click a unit | delegated `click` on the host | §6.1 |
| 8 | open the unit drawer | `js/ui.js` drawer component | §7 |
| 9 | change status | drawer action | `services.setUnitStatus()` §7.3 |
| 10 | assign a brand | drawer action | `services.assignTenant()` §7.3 |
| 11 | open or create a deal | drawer Deal section | `services.createDeal()` §7.3 |
| 12 | add a comment | drawer action | `services.addComment()` §7.3 |
| 13 | create a task | drawer action | `services.createTask()` §7.3 |
| 14 | register a document | drawer action | `services.registerDocument()` §7.3 |
| 15 | see all updates immediately | event → `render()` | §9 |

### 1.2 Acceptance checklist (the `§65` "Floor plans" block, plus D8)

| `§65` check | Acceptance rule in this document | Test (see §14 and `10_QA_PLAN.md`) |
|---|---|---|
| sample floor plan loads | every demo plan version renders with `polygonCount` bound polygons and no console error | `lsp_plan_load` |
| units are clickable | every confirmed mapping yields an element with `data-unit-id`, `tabindex="0"`, `role="button"` | `lsp_plan_click_all` |
| selected unit is correct | drawer `unitNumber` equals the `unitNumber` of the clicked polygon's `unitId` | `lsp_plan_click_all` |
| hover state works | `pointerover` adds `.is-hover` and shows the tooltip | `lsp_plan_hover` |
| status / merchandise mix / Target vs Actual views work | modes `status`, `mix`, `target_actual` recolor in place; legends regenerate | `lsp_plan_modes` |
| legends are correct | legend keys = classes present in config for that mode; every class present on the floor appears | `lsp_plan_legend_keys` |
| floor switching works | `setFloor()` swaps plan version, keeps mode and zoom preference | `lsp_plan_floor_switch` |
| zoom/pan works | buttons, Ctrl-wheel, drag, touch pinch; `fit()` restores | `lsp_plan_zoom` |
| status changes update colors | drawer status change → polygon `data-status-key` and computed `fill` change without reload | `lsp_plan_status_sync` |
| plan and table show the same state | units table row badge = polygon class for the same unit | `lsp_plan_table_parity` |
| no duplicate click handlers | one delegated listener set per host; five re-renders leave `listenerCount() === 1` | `lsp_plan_single_listener` |
| D8: ≥ 2 hand-authored SVG floors with true polygons | §10: three demo floors, 45 unit polygons | `lsp_plan_demo_inventory` |

RECOMMENDATION: the plan screen is the first screen accepted in each build phase (`02_REQUIREMENTS_REVIEW.md` C-2); acceptance runs through the drawer, not through list screens.

---

## 2. Plan and polygon model

### 2.1 `floorPlans` record

FACT (`00_MASTER_PROMPT.md §10`): the master prompt defines `id, projectId, buildingId, floorId, version, fileName, format, effectiveDate, uploadedAt, uploadedBy, current, archived, backgroundUrl, notes, polygonMappings` and requires conceptual versioning: "a new plan must not silently erase historical unit, deal, or status records". D8 adds that mappings live on the plan version. The LSP record is the `§10` record plus the fields below (final schema and validators in `03_DATA_MODEL.md`).

| Field | Type | Rule |
|---|---|---|
| `id` | `PLAN-nnn` (D13) | stable, never reused |
| `projectId`, `buildingId`, `floorId` | ids | `floorId` is the binding target; one plan version belongs to exactly one floor |
| `version` | integer ≥ 1 | `max(version of the floor) + 1` on publish; never edited |
| `current` | boolean | exactly one `current: true` per `floorId` (invariant checked by `services.integrityReport()`) |
| `archived` | boolean | set when a newer version is published; archived versions are immutable (§2.4) |
| `effectiveDate` | ISO date or null | user-entered ("plan valid from"); default = publish date |
| `uploadedAt`, `uploadedBy` | ISO datetime, user id | written by services |
| `fileName` | string | original name or `manual-<floor>.svg` for drawn plans |
| `format` | `'SVG' \| 'JSON' \| 'RASTER'` | source of the geometry (§8.2); the stored geometry is always SVG text |
| `svgText` | string | sanitized, serialized SVG (§4.2); the only geometry store; `null` when `svgDropped` |
| `backgroundUrl` | string or null | `data:image/png;base64,…` or `data:image/jpeg;base64,…` only; used for `RASTER` plans (§8.2) |
| `viewBox` | `[x, y, w, h]` | cached from the sanitized SVG (repaired if missing, §4.2) |
| `polygonCount` | integer | cached count of candidate polygons (§2.2) after sanitizing; QA assertion input |
| `sourceHash` | string | 32-bit string hash of `svgText` (same idea as CASE OS `planHash`, `os/core.js` line 2189); memoization key §9.3 |
| `polygonMappings` | array of §2.3 entries | the binding; edited only through services |
| `ignoredPolygonIds` | array of polygon ids | candidate polygons the team marked as non-units (corridors, kiosks); excluded from validation reports (port of the CASE OS `PLAN_IGNORED_CODES` idea) |
| `svgDropped` | boolean | `08_PERSISTENCE_IMPORT_EXPORT.md` §12: SVG text of an archived version removed to save quota; record and mappings stay |
| `visibility` | `'internal' \| 'client_visible'` | `04_ROLES_AND_VISIBILITY.md` §4.1: the `current` version is what the client sees when `client_visible` |
| `notes` | string or null | free text |
| `demoRecord` | boolean | D4 |
| `externalIds` | `{ caseOsPlanKey: 'objId::block::floor' \| null }` | set by the CASE OS adapter (§11) |
| `createdAt`, `updatedAt` | ISO datetime | services |

### 2.2 Candidate polygon

A *candidate polygon* is any `<path>`, `<polygon>` or `<rect>` inside the sanitized SVG that (a) has an `id`, or (b) sits inside `g[data-layer="units"]`. Elements without an `id` that the wizard needs to reference receive a generated `id` (`lsp-poly-<n>`, unique within the version) at save time, so `svgText` is rewritten once and every polygon becomes addressable. `<circle>`, `<ellipse>` and `<g>` are not unit shapes in v0.1 (A-06-1).

### 2.3 `polygonMappings` entry

```javascript
{
  polygonId: "p-F1-001",       // the polygon's id attribute inside svgText of THIS version
  unitId: "UNIT-001",          // D13 unit id; the unit must belong to the same floorId
  bindingKind: "polygon",      // 'polygon' (default) | 'marker' (label-only imports, Q-06-2)
  source: "attribute",         // 'attribute' | 'id' | 'json' | 'drawn' | 'manual' | 'carried' | 'label_experimental'
  confirmed: true,             // false only for experimental suggestions; unconfirmed entries NEVER bind
  confidence: null,            // 0..1 for label_experimental, else null
  createdAt: "…", createdBy: "USER-…"
}
```

Rules: one `polygonId` maps to at most one unit (hard error `E-PLAN-DUP-POLYGON`); one unit may own several polygons (merged units, `08_PERSISTENCE_IMPORT_EXPORT.md` Q-08-7) with warning `W-PLAN-UNIT-MULTI-POLYGON` and the label drawn once on the largest polygon (A-06-2); `unitId` must exist and `unit.floorId` must equal the plan's `floorId`, otherwise the entry is dropped with `E-PLAN-UNIT-FLOOR`.

### 2.4 Version semantics

| Event | Effect |
|---|---|
| Publish (wizard save with new geometry) | new record `version = max + 1`, `current: true`, `archived: false`; previous current → `current: false, archived: true`; mappings carried over (§2.5); `auditLog` entry `plan.published`; event `plan.versionPublished` (`12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §6.3) |
| Correct mappings of the current version | allowed in place (mapping correction is not a geometry change); `auditLog` entry `plan.mappingsChanged` with before/after counts; no new version |
| Edit an archived version | refused by services; only `svgDropped` and `visibility` may change. FACT: CASE OS enforces the same idea for layout versions — an existing snapshot is immutable (`os/v417-master-plan.js` line 35, audit item P0-1 in `HANDOFF_CASE_OS.md`) |
| Restore an archived version | publish a copy as a new version (`source: 'carried'` for all mappings); flags are never flipped back, so history stays linear |
| Delete a plan version | not offered in v0.1; archived versions can only be `svgDropped` |
| Delete a floor | refused while any plan version or unit references it (`03_DATA_MODEL.md` integrity rules) |

Units, deals, `statusHistory`, `auditLog`, comments and documents are untouched by every row above (`§10`).

### 2.5 Carry-over on a new version

When a new version is published for a floor that already has a current version, services copy every confirmed mapping whose `polygonId` exists in the new `svgText` and whose unit still belongs to the floor, as `source: 'carried'`. The wizard report shows "carried over n · dropped m (polygon id missing) · dropped k (unit moved)". Authoring rule for teams: keep polygon ids stable between exports (§3), and re-uploads cost nothing.

### 2.6 Relation to units — the plan does not own unit data

- Units exist without a plan; `unit.floorId` is the authoritative floor assignment (`§11`), never the plan.
- `unit.geometry.polygonId` and `unit.geometry.centroid` (`§11`) are a **derived cache** of the current version's mapping, refreshed by `services.spatial.syncUnitGeometry(planId)` when a version becomes current or mappings change. Every other module references `UNIT-` ids, never polygon ids (`12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §6.1). `geometry.areaSource` is never written by the engine; "apply area from plan" belongs to `property-and-unit-data-engineer` and is not available for geometry without a metric scale (A-06-3).
- A unit of the floor without a confirmed mapping is listed in the "Not on plan" panel (§5.7) and counted in unit completeness (`§40` "polygon mapping").
- Replacing or dropping a plan never deletes a unit; the CASE OS rule "the registry is the base; the drawing can be re-uploaded without losing data" (`os/core.js` line 2364 comment) is kept.

---

## 3. SVG authoring conventions

These rules apply to the demo plans (§10) and to plans the team draws in Illustrator/Inkscape/Figma for real floors. The wizard reports deviations as warnings; it does not reject a plan that violates a RECOMMENDED rule.

| Rule | Level | Detail |
|---|---|---|
| `viewBox` present | REQUIRED (auto-repaired) | e.g. `viewBox="0 0 1200 800"`; y grows downward; no `width`/`height` needed (the engine sets `width="100%"`, removes `height`, `preserveAspectRatio="xMidYMid meet"` — same as CASE OS `bindSvgPlan`, `os/core.js` line 2320). Missing or non-overlapping viewBox is repaired from `getBBox()` with 6 % padding (CASE OS rule, lines 2327–2330) and reported `W-PLAN-NO-VIEWBOX` |
| Layer groups | RECOMMENDED | `<g data-layer="bg">` (floor slab, outline), `<g data-layer="walls">` (strokes, cores, stairs), `<g data-layer="units">` (one shape per unit), `<g data-layer="labels">` (optional static text). `data-layer` is used instead of `id` so two plans can coexist in one document (mobile overlay + list) |
| One shape per unit | REQUIRED for binding | `<path>`, `<polygon>` or `<rect>` with a stable `id` (= `polygonId`) and, preferably, `data-unit-id="UNIT-0nn"` (D8). Convention for ids: `p-<unitNumber>` (`p-F1-001`) |
| No `transform` on unit shapes or their ancestors | RECOMMENDED | the engine uses `getBBox()` + `getCTM()` (as CASE OS `parsePlanLabels`, `os/core.js` line 2548) so transformed shapes still work, but overlay clones and hit areas are simpler without; warning `W-PLAN-TRANSFORM-ON-UNIT` |
| Non-unit shapes have no `data-unit-id` | REQUIRED | corridors, cores, kiosks; give them an `id` only if the team wants to map them later (then mark them ignored in the wizard) |
| Text labels optional | RECOMMENDED: none in `units` | the engine draws its own labels (§4.5). Static `<text>` in `data-layer="labels"` is hidden while engine labels are on ("Show original labels" toggle) |
| Plain fills | RECOMMENDED | unit shapes may carry any `fill`; the colorizer overrides `fill`, `stroke`, `stroke-width` per mode and restores nothing (the stored `svgText` is never mutated by rendering) |
| No external resources | REQUIRED (sanitizer) | no `<image>`, `<script>`, `<style>` with `url()`, fonts via `@font-face`, external `href` (§12) |
| Size | REQUIRED | `svgText` ≤ 1 000 000 characters (`E-PLAN-SIZE`), warning above 250 000; demo plans < 60 000 each (`08_PERSISTENCE_IMPORT_EXPORT.md` §12) — A-06-4 |
| Ids unique | REQUIRED | duplicate ids → `E-PLAN-DUP-ID` with the list; the wizard offers "auto-suffix duplicates" |

Minimal valid example (also QA fixture `plan_minimal.svg`):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
  <g data-layer="bg"><rect x="0" y="0" width="600" height="400" fill="#f4f4f2"/></g>
  <g data-layer="walls"><path d="M20 20 H580 V380 H20 Z" fill="none" stroke="#333" stroke-width="3"/></g>
  <g data-layer="units">
    <rect id="p-F1-001" data-unit-id="UNIT-001" x="20" y="20" width="180" height="160"/>
    <path id="p-F1-002" data-unit-id="UNIT-002" d="M200 20 H400 V180 H200 Z"/>
  </g>
</svg>
```

---

## 4. Rendering pipeline

### 4.1 Public surface of `js/floorplan.js`

`LSP.floorplan.mount(hostEl, { projectId, buildingId, floorId, mode, variant: 'internal' | 'client', session })`, `render(reason)`, `setMode(key)`, `setFloor(floorId)`, `selectUnit(unitId | null)`, `fit()`, `zoom(factor)`, `setLabelScale(dir)`, `toggleLabels()`, `destroy()`, `registerMode(def)` (`12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §6.3), `openWizard(opts)` (§8), `sanitizeSvg(text) → { svgText, viewBox, polygonCount, report }`, `parsePolygonJson(text)` (§8.2), `extractLabels(svgDoc) → suggestions[]` (EXPERIMENTAL, §8.4). In Node the pure helpers (`parsePolygonJson`, JSON → SVG conversion, mapping validation) attach to `module.exports` (D10); DOM functions are tested in Playwright.

Everything the engine needs per unit comes from one services call, `services.planViewModel(floorId, mode, session)` → `{ planId, version, rows: [{ unitId, unitNumber, tenantLabel, areaLabel, statusKey, displayStatusKey, availabilityGroup, mixCategoryKey, mixIsTarget, targetActualClass, managerId, clientStatusKey, attention: [] }], notOnPlan: [unitId…] }` (memoized, §9.3). `floorplan.js` never computes business state; it maps a class key to a config entry (D5).

### 4.2 Stages

```text
svgText (string) ──► sanitize ──► parse cache ──► inject ──► bind ──► decorate ──► colorize(mode) ──► legend ──► tooltips
                     (§12)        (per sourceHash)  (host)    (§4.4)   (§4.5)       (§5)              (§5)      (§6.2)
```

| Stage | What it does | Runs when |
|---|---|---|
| sanitize | `DOMParser` (`image/svg+xml`); parse error → readable message in the host, never a blank; allow-list of elements and attributes (§12.1); strips `<script>`, `<foreignObject>`, `<image>`, `<iframe>`, `<object>`, `<embed>`, animation elements, all `on*` attributes, non-fragment `href`/`xlink:href`, `javascript:` and `data:text/html` URLs, `<style>` elements and `style` attributes containing `url(`, `@import`, `expression(` or `javascript:`; repairs viewBox; returns the serialized clean text. FACT: CASE OS does a narrower version of this in `sanitizePlanSvgDom` (`os/core.js` line 2429: removes `script, foreignObject, animate, animateTransform, set, handler, iframe, object, embed`, `on*`, `javascript:` hrefs, `expression(` styles); LSP moves to an allow-list (`02_REQUIREMENTS_REVIEW.md` R-2) | on save (result stored) and again on every inject (defense in depth; cheap) |
| parse cache | sanitized document cached by `planId + version + sourceHash`; cleared on `destroy()` | first render of a version |
| inject | `document.importNode(svgRoot, true)` into `hostEl > .lsp-plan-canvas`; engine `<defs>` with pattern definitions and the groups `data-layer="overlay"`, `"engine-labels"`, `"selection"` appended after the plan content | plan or version change, or `reason === 'geometry'` |
| bind | §4.4 | after inject, and when mappings change |
| decorate | §4.5 labels, `tabindex`, `role`, `aria-label`, `data-*` | after bind; labels re-laid on label-scale change |
| colorize | §5: sets `fill`, `stroke`, `stroke-width`, overlay pattern, `data-status-key` / `data-class-key` per polygon | every `render()` |
| legend | §5 | every `render()` (cheap: ≤ 20 rows) |
| tooltips | one shared tooltip element bound to hover/focus | once per mount |

### 4.3 Single entry point

`render(reason)` is the only function that touches the DOM after mount. `js/ui.js` calls it from the state-change subscription (`LSP.events.on('*')`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §6.3) with a reason chosen from the event type; views never poke polygons directly (`§3.5` "no hidden state"). Reasons: `geometry` (re-inject), `mappings` (re-bind), `data` (re-decorate + colorize), `mode` (colorize + legend), `labels` (decorate labels only), `selection` (selection layer only).

### 4.4 Bind order

1. **Confirmed mappings** (authoritative): for each `polygonMappings[i]` with `confirmed: true` and `bindingKind: 'polygon'`, locate `#<polygonId>` via `CSS.escape`; skip `<text>` elements; set `data-unit-id`, `data-polygon-id`, `tabindex="0"`, `role="button"`, `aria-label="<unitNumber>, <tenant or status>"`, class `lsp-unit`. `bindingKind: 'marker'` entries (Q-06-2) get a label chip at the element's `getBBox()` centre instead of a fill.
2. **Implicit binding** — only when the version has zero mappings (fresh import, JSON without ids resolved): match `data-unit-id === unit.id`, then `id` or `data-code` equal to `unitNumber` (case-insensitive, whitespace removed — CASE OS rule `os/core.js` line 2324), for units of the floor. Bound polygons carry `data-binding="implicit"`; a banner "Mapping not saved — open the wizard" links to §8; implicit bindings are never persisted by rendering.
3. **EXPERIMENTAL text-label match** — never at render time; wizard step only (§8.4).

Result: a `Map<unitId, SVGElement[]>` and `Map<polygonId, unitId>` kept on the mount instance and rebuilt idempotently (old `data-*`, classes and overlay clones removed first).

### 4.5 Decorate: labels

Each bound unit gets one engine label group (`<g class="lsp-label" data-unit-id>`, `pointer-events: none`) placed at the polygon centroid (bbox centre through `getCTM()`), lines depending on available space:

| Polygon bbox (in plan units, relative to font size `fs`) | Lines |
|---|---|
| height ≥ 4.6 × `fs` and width ≥ 9 × `fs` | unit number (bold) · tenant/brand or "—" · area (`123 m²`, from `area.glaM2`; "n/a" when null) · status short code |
| height ≥ 2.4 × `fs` | unit number · status short code |
| smaller | unit number only; if width < 3 × `fs`: no label (tooltip only) |

Font size follows the CASE OS adaptive rule (`os/core.js` lines 2336–2338): `fs = median nearest-neighbour distance between centroids × 0.13`, clamped to `[viewBox.width × 0.0035, viewBox.width × 0.012]`, multiplied by the user label scale (steps `0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6`, CASE OS `planLabelSize`, line 2409) stored in `caseos-lsp-ui`. Label text uses `textColor` of the class entry; a semi-opaque backing rect keeps contrast on patterned fills. Labels are not draggable in v0.1 (CASE OS `PLAN_LABELPOS` offsets are not ported, A-06-5). Status short codes come from `config.unitStatuses[].shortCode` (Q-06-1).

### 4.6 Mode colorizer

For each row of the view model: `entry = modeDef.entryFor(row)` (a config entry with `color`, `textColor`, `pattern`) → polygon `fill = entry.color`, `stroke = config.plan.unitStroke`, overlay clone with `fill = url(#lsp-pat-<pattern>)` when `pattern !== 'none'`, attributes `data-class-key = entry.key`, `data-status-key = row.displayStatusKey` (status mode). Unbound candidate polygons: `fill = config.plan.unmappedFill`, dashed outline, `data-class-key="unmapped"`. Selected unit: selection layer clone with a thick `config.plan.selectionStroke`. The engine contains no color literal; `grep` for hex values in `js/floorplan.js` must return nothing outside comments (skill checklist).

Patterns are five color-independent `<pattern>` defs in neutral ink at 35 % opacity: `hatch` (45°), `hatch_back` (135°), `dots`, `crosshatch`, `dashed_outline` (stroke-only, no fill overlay); `none` draws nothing. Config `pattern` values are limited to these keys (`05_STATUSES_STAGES_AND_CONFIG.md` validator).

### 4.7 Floor and version switching

`setFloor(floorId)` resolves `currentPlan(floorId)`; if none: the host shows "No plan for this floor" with the unit list of the floor (same component as the mobile fallback, §6.6) and, for roles with the wizard right, an "Import plan" button. Archived versions can be viewed read-only from a "Versions" popover (label "v2 · archived · effective 2026-05-01"); in that view no actions except "Publish copy as new version" are offered.

---

## 5. Visualization modes

FACT (`00_MASTER_PROMPT.md §14`): five modes, separate legends, text labels, tooltips, non-color indicators where practical; "do not mix unrelated meanings in one color system". Design rule from `02_REQUIREMENTS_REVIEW.md` C-12: one mode = one attribute. All colors, patterns and labels are config entries (`§12` "status colors must be configurable and must not be hard-coded inside rendering logic"); the tables below name the config path each mode reads (schema in `05_STATUSES_STAGES_AND_CONFIG.md`).

| Mode key | `§14` | Attribute colored (view-model field) | Config source | Legend entries | Label content (4th line) | Non-color indicator | Roles |
|---|---|---|---|---|---|---|---|
| `status` | 14.1 | `displayStatusKey` (D5: derived stage when a marketable unit has a qualifying open deal, else `commercialStatus`) | `config.unitStatuses[]` (`kind`, `availabilityGroup`, `color`, `textColor`, `pattern`, `shortCode`) | entries present in config, grouped by `availabilityGroup`; derived (`kind: 'derived'`) entries under the heading "Pipeline (from deals)" | status `shortCode` | `pattern` per entry; every derived entry uses `hatch` so a stage is never confused with an inventory state (R-18) | all internal; client sees the `clientStatus` variant (§5.6) |
| `mix` | 14.2 | `mixCategoryKey` = `actualUse.category` when a tenant exists, else `targetUse.category` with `mixIsTarget: true` | `config.merchandiseCategories[]` (`key`, `label`, `color`, `textColor`); subcategory shown in tooltip and legend sub-rows | one row per category present on the floor (+ "No category") | category code (e.g. `F&B`) | `mixIsTarget` units drawn with `hatch` ("planned, no tenant"); no-category units `dashed_outline` | all internal; client (category only) |
| `target_actual` | 14.3 | `targetActualClass` ∈ `match \| deviation \| target_only \| actual_without_target \| uncategorised` (from `merchandise-mix-analyst` services) | `config.plan.targetActualClasses[]` (`key`, `color`, `textColor`, `pattern`, `glyph`) | fixed five rows with counts and GLA | `glyph` + actual category | glyph per class (`=`, `≠`, `○`, `+`, `?`) in the label and `pattern` | internal; client only if `config.visibility.clientPlanModes` includes it (default off, Q-06-3) |
| `manager` | 14.4 | `managerId` = `responsibility.responsibleManagerId` | `config.plan.managerPalette[]` (≥ 8 colors) assigned by stable order of user ids with units in the project; `config.plan.unassigned` entry | one row per manager with units on the floor (+ "Unassigned") | manager initials | initials in the label; `dashed_outline` for unassigned | `founder_admin`, `head_ls`, `manager`, `administrator`; never client or `external_agent` |
| `availability` | 14.5 | `availabilityGroup` ∈ `available \| in_process \| occupied_or_sold \| unavailable` (config on each status) | `config.plan.availabilityGroups[]` (`key`, `label`, `color`, `textColor`, `pattern`) | fixed four rows with unit count and GLA | group short label | `pattern` per group (`none`, `hatch`, `crosshatch`, `dots`) | all internal; `external_agent` (only mode, `04_ROLES_AND_VISIBILITY.md` screen 5); client |

### 5.1 Legend

Generated per mode from config, not from hard-coded lists: `[{ key, label, color, pattern, count, glaM2 }]`, rendered as a list next to the plan (below it under 1024 px) with a swatch that repeats the pattern. A legend row is a filter: clicking it dims every polygon of other classes (`.is-dimmed`) and toggles back; the units table receives the same filter chip (`§26` chips, "Reset All"). `data-legend-key` on each row is the QA hook. Counts show the denominator: "Available · 6 units · 1 240 m² of 9 870 m²" (D6 visible denominators). Units without area are excluded from the m² sum and noted "(2 without area)".

### 5.2 Tooltips

One `<div role="tooltip" data-testid="plan-tooltip">` per mount, positioned near the pointer (flipped at viewport edges). Content per mode: unit number, tenant/brand, area, then the mode value with its source: status mode "Status: Available · Pipeline: Negotiation (DEAL-012, Brand A)" (R-18), mix mode "Actual: F&B / Café · Target: F&B", target_actual mode "Deviation: target Fashion, actual F&B", manager mode "Responsible: <name>", availability mode "In process (Negotiation)". Keyboard focus shows the same tooltip. Touch devices skip hover and open the drawer on tap.

### 5.3 Edge cases (all modes)

| Case | Behaviour |
|---|---|
| Status key not in config (after a Settings edit or import) | rendered with `config.plan.unknownClass` (grey, `crosshatch`), legend row "Unknown status (n)", data-hygiene item "unit status not in configuration" (`§33`) |
| Unit without `targetUse.category` and without tenant | mix: "No category" row, `dashed_outline`; target_actual: `uncategorised` |
| Unit without area | label shows "n/a"; legend excludes it from m² and counts it in the "(n without area)" note; never 0 (D6) |
| Unit without polygon | listed in the "Not on plan" panel (§5.7); counted in the legend totals of the floor with a footnote "incl. n units not on plan" |
| Polygon without unit (candidate, not ignored) | `unmapped` class; count badge on the toolbar "n unmapped polygons" opening the wizard for roles with the right |
| Two open deals at the same top stage on one unit | display status unchanged (stage label), tooltip lists both prospects |
| Deal stage beyond `Contract Draft` on a marketable unit | not recolored; data-hygiene "inconsistent unit status" (`02_REQUIREMENTS_REVIEW.md` §2 rule) |
| Dark theme | application chrome only; the plan canvas keeps `config.plan.canvasBackground` (light) so status colors are validated once (C-9, Q-02-7) |

### 5.4 Mode registry

The five modes are registered at load through `LSP.floorplan.registerMode({ key, label, legend(rows, cfg), entryFor(row, cfg), labelFor(row, cfg), tooltipFor(row, cfg), roles })` (`12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §6.3), so a future Building OS mode ("open work orders per unit") is added without editing the engine. Modes not allowed for the session role are omitted from the segmented control; the last used mode is remembered per browser in `caseos-lsp-ui`.

### 5.5 Attention overlay (optional layer, any mode)

A toggle "Attention" adds a small corner marker on units whose view-model `attention[]` is non-empty: missing area, missing category, no responsible manager, stale (thresholds in config, `§41`), overdue next action, open client comment. This answers `§2` "Which floor-plan units require attention?" without a sixth color system (markers are glyphs, not fills).

### 5.6 Client variant

The client floor plan (`§35`, screen 20) mounts the same engine with `variant: 'client'` and a view model built **only** from `clientView(projectId, session).plans[]` and `.units[]` (`04_ROLES_AND_VISIBILITY.md` §6). Modes offered: `status` rendered as `clientStatusKey` with `config.clientStatuses[].color/pattern`, `availability`, `mix` (category only); `manager` never; `target_actual` per Q-06-3. Labels: unit number, tenant only when the unit counts as leased/sold and the brand is not restricted, area, client status. No attention overlay, no wizard, no "Not on plan" internal notes (units with `visibility: internal` are simply absent, P3). Portal preview (`04_ROLES_AND_VISIBILITY.md` §1.4) uses the same path with the effective client session.

### 5.7 "Not on plan" panel

A collapsible panel under the legend lists every unit of the floor without a confirmed `polygon` mapping (marker-only units appear with a marker icon): swatch in the current mode's color, unit number, tenant, area, status. Rows open the drawer like a polygon click. The count is part of unit completeness and of the project dashboard data-hygiene block ("units without polygon: n").

---

## 6. Interaction

### 6.1 Pointer and keyboard

| Input | Behaviour |
|---|---|
| click / tap on a bound polygon | `selectUnit(unitId)` → drawer opens beside the plan (`§15` "without leaving the floor plan"); route becomes `#/projects/:id/plan?floor=…&unit=UNIT-001` so refresh and Back restore the state |
| click on empty canvas | clears selection, closes the tooltip; the drawer stays open until closed explicitly |
| hover (`pointerover` / `pointerout`, delegated) | `.is-hover` outline on the polygon and its label; tooltip §5.2; the units table row of the same unit gets `.is-hover` (two-way: hovering the table row highlights the polygon) |
| Tab / Shift+Tab | moves focus between polygons in document order (`tabindex="0"`); focus ring + tooltip |
| Enter / Space on a focused polygon | opens the drawer |
| Escape | closes tooltip, then drawer |
| Ctrl/⌘ + wheel over the canvas | zoom at cursor, factor 1.12 / 0.89 per notch (CASE OS values, `os/core.js` line 2313); plain wheel scrolls the page (no hijack) |
| drag with pointer (mouse or one finger) | pan (pointer capture); a drag under 4 px counts as a click |
| two-finger pinch | zoom (touch only; `touch-action: none` on the canvas) |
| toolbar buttons | zoom in, zoom out, fit (§6.3), labels A− / A+, labels on/off, attention on/off, mode control, building/floor selects, versions popover, "Import / map plan" (roles with the wizard right), "Not on plan (n)" |

Exactly one delegated listener set (`click`, `pointerover`, `pointerout`, `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `keydown`, `wheel`) is attached to the host at `mount()` and removed at `destroy()`; nothing is attached per polygon (`§65` "no duplicated event handlers"; CASE OS attaches a listener per element, line 2324, which LSP does not port).

### 6.2 Zoom and pan model

The plan SVG is never rescaled through its `viewBox`; a wrapper `<div class="lsp-plan-canvas">` receives `transform: translate(x, y) scale(s)` with `s ∈ [0.4, 6]` (CASE OS `planZoom` bounds, `os/core.js` line 2306). Zoom and pan are UI state on the mount instance, not application state; they survive `render()` and mode switches and reset on floor change unless "keep view" is on. Label font size is in plan units, so labels scale with the plan (readable when zoomed in).

### 6.3 Fit

`fit()` sets `s = 1, x = y = 0` and sizes the SVG to the host (`width: 100%`, `height: auto`, `max-height: calc(100vh − toolbar − legend)`); the plan is always fully visible after mount, floor switch and window resize (`ResizeObserver` on the host).

### 6.4 Label size control

A− / A+ step through the scale list of §4.5; persisted per browser (`caseos-lsp-ui.planLabelScale`); "Labels off" hides engine labels and shows original static labels if the plan has a `labels` layer.

### 6.5 Print

The print stylesheet prints the plan at `fit()` scale with the legend beneath it on one page (landscape hint), tooltips and toolbar hidden; used by reports (`07_CALCULATIONS_AND_KPI_RULES.md`, `§37` floor/unit status section).

### 6.6 Mobile fallback

FACT (`§48`): "do not force the full floor-plan desktop experience onto a small phone". Below 768 px viewport width (A-06-6): the plan host renders the **unit list of the floor** — rows with the current mode's swatch, unit number, tenant, area, status short code; mode control and floor select stay; tapping a row opens the drawer as a full-height sheet. A "Show plan" action opens the plan read-only in a full-screen overlay with pinch zoom, tap-to-open-drawer, no wizard and no attention overlay (`02_REQUIREMENTS_REVIEW.md` R-7). Between 768 px and 1024 px (tablet) the full plan is shown with the legend and drawer stacked below it. QA viewports: 390×844 (list), 820×1180 (plan), desktop widths (plan) — D10.

---

## 7. Unit drawer specification

FACT (`00_MASTER_PROMPT.md §15`): sections Summary, Commercial, Deal, Contacts, Documents, Activity timeline and nine actions; "actions must work in the prototype where feasible". The drawer is a `js/ui.js` component; content per section and role is defined in `04_ROLES_AND_VISIBILITY.md` §7 and is not repeated here. This section specifies what each **action** changes and which views re-render.

### 7.1 Header and sections (internal variant)

Header: `unitNumber`, floor / building, `area.glaM2`, status badge (`commercialStatus`) and, when present, a second badge "Pipeline: <derived stage> (<brand>)" (R-18), responsible manager, completeness and stale indicators (`§40`, `§41`). Sections in `§15` order, each collapsible, state remembered per browser. Section content: `04_ROLES_AND_VISIBILITY.md` §7 table (Summary, Commercial, Deal, Contacts, Documents, Activity timeline, Comments, Actions).

### 7.2 Client variant

Rendered by `js/views/portal.js` from the `units[]` element of `clientView()` (never from `appState`): Summary (client fields), "Active negotiations: n" and client-approved key deals, client-visible documents with download, recent changes, client-visible comments with the **Leave comment** form. Actions: leave comment, download approved document; no other button is rendered, not even disabled (`§65` "no fake buttons").

### 7.3 Actions — state change and re-render matrix

| `§15` action | Services call (all write `auditLog`; `updatedAt` refreshed) | Records written | Event → views re-rendered |
|---|---|---|---|
| change status | `setUnitStatus(unitId, statusKey, { note, session })` — the picker lists inventory statuses only (`kind: 'inventory'`, D5); a status not allowed for the unit's `commercialMode` (e.g. Sold on a leasing-only unit) is refused with a message | `unit.commercialStatus`, `statusHistory` (`SH-`), `activities` (`ACT-` type "status change") | `unit.statusChanged` → plan (`data`), units table, project dashboard, home dashboard, reports preview, portal (when `client_visible`), drawer header, timeline |
| assign brand (as tenant) | `assignTenant(unitId, brandId, { category, subcategory })` — dialog explains "tenant" vs "prospect" and offers "Add as prospect instead"; category defaults from `brand.classification` | `unit.actualUse.*`, `brand.history.unitIds`, activity | `unit.tenantChanged` → plan (`data`: labels, `mix`, `target_actual`), units table, merchandise-mix analytics, dashboards, brand detail |
| create deal / open deal | `createDeal({ type, projectId, unitIds: [unitId], brandId, stage: first stage, session })` or navigate to `#/pipeline/:type/:dealId` (opens Deal Detail as a second drawer layer over the plan) | `deals` (`DEAL-`), `unit.dealIds`, `statusHistory` (`entityType: 'deal'`), activity | `deal.created` / `deal.stageChanged` → plan (`data`: status mode if the derived stage crosses `displayStageThreshold`), Kanban, deal table, drawer Deal section, dashboards |
| add prospect | same as create deal with the brand picked inline; stage defaults to Lead; the Deal section lists every open deal of the unit ("Brand A — Viewing, Brand B — Negotiation", `§6.3`) | as above | as above; inventory KPIs unchanged (D6) |
| add task | `createTask({ title, unitId, projectId, dealId?, assigneeId, dueDate, priority })` | `tasks` (`TASK-`) | `task.created` → Tasks screen, home "Today's work", drawer timeline |
| add comment | `addComment({ entityType: 'unit', entityId, visibility, text, session })` — visibility choices per role (`04_ROLES_AND_VISIBILITY.md` §4.3) | `comments` (`CMT-`), activity | `comment.added` → drawer Comments and timeline, notifications, portal (only `client_visible`) |
| register file | `registerDocument({ fileName, category, projectId, unitId, dealId?, visibility, fileSize, localUrl, comment })` — local metadata only (`§6.2`) | `documents` (`DOC-`), activity ("document uploaded") | `document.registered` → Documents screen, drawer Documents, portal (only `client_visible`), missing-documents KPI |
| open CRM record | router navigation to `#/crm/brands/:brandId` (or company / contact); this is the one action that leaves the plan; the plan route with `unit=` is kept in history so Back returns with the drawer open | — | — |
| compare with merchandise plan | opens the panel of §7.4 inside the drawer; no writes | — | may call `setMode('target_actual')` + `selectUnit(unitId)` on request |

Every write goes through services; the drawer never mutates `appState` directly, and the plan re-renders through the event bus, never through a callback from the drawer (`§3.5`).

### 7.4 "Compare with merchandise plan" panel

Content (read-only, computed by `merchandise-mix-analyst` services): (1) the unit's `targetUse` (category, subcategory, `merchandiseRole`, `preferredUnitType`) beside `actualUse` (category, subcategory, tenant) with the `targetActualClass` glyph and label; (2) floor and project mix rows for the unit's target category and actual category: target share vs actual share by GLA and by unit count, gap in pp and m², over/under flag (`§17`); (3) "Suggested brands for this unit" — top five from `suggestBrandsForUnit(unitId)` with the matching criteria listed (`§39`: category, area, floor, rent budget, city, format) and the sentence "Suggestions are deterministic matches, not recommendations"; (4) buttons "Show on plan (Target vs Actual)" and "Open merchandise mix report". Client variant: not rendered.

---

## 8. Plan Import / Mapping Wizard

FACT (`00_MASTER_PROMPT.md §16`): eight steps — choose or upload a sample plan; identify project, building and floor; display; load supplied SVG/JSON polygons; map polygons to unit IDs; allow manual correction; save locally; make units clickable. Vector text extraction "may suggest unit matches"; raster files use manual mapping; any recognition feature is labeled experimental; "do not fake this functionality". D8 and `02_REQUIREMENTS_REVIEW.md` C-10 fix the interpretation: text-label matching is one EXPERIMENTAL step that only suggests; PDF, CAD/DWG, BIM/IFC and raster detection are shown as future without a button.

### 8.1 Step machine

```text
select_target ─► choose_source ─► preview ─► auto_match ─► experimental_labels ─► manual_assign ─► validate ─► save ─► done
      ▲               │              │  (parse error / size) ► choose_source                            │
      └───────────────┴──────────────┴──────────────── cancel (no writes) ◄─────────────────────────────┘
```

| State | Inputs | Outputs / rules |
|---|---|---|
| `select_target` | project, building, floor (prefilled from the current plan context); shows the current version (if any) and "new version will be v(n+1)" | refuses a floor with no units ("create units first" link to Units) unless the source is JSON with `unitNumber` hints |
| `choose_source` | **SVG file** (`FileReader.readAsText`, `.svg`, ≤ size limit) · **JSON polygons** (file or pasted text, §8.2) · **Raster** PNG/JPG (`FileReader.readAsDataURL`, becomes `backgroundUrl`, geometry drawn manually) · **Reuse current geometry** (edit mappings of the current version without new geometry) | future formats listed as text only: "PDF, DWG/DXF, IFC — future, not available in the prototype" (no button) |
| `preview` | sanitized plan in the engine host (read-only, zoom/pan) | parse report: elements kept/removed, candidate polygons found, `viewBox` (repaired?), size in characters, warnings §3; a plan with 0 candidate polygons shows "0 polygons found — draw polygons manually or upload SVG/JSON with unit shapes" |
| `auto_match` | runs automatically | table of proposals: `data-unit-id` == `unit.id` (source `attribute`), then `id`/`data-code` == `unitNumber` (source `id`), JSON `unitId`/`unitNumber` hints (source `json`), carried mappings from the previous version (source `carried`); each row: polygon id, unit, source, [accept ✓] (accepted by default for `attribute`, `id`, `json`, `carried`); side lists: unmatched polygons, units without polygon |
| `experimental_labels` | shown only if the SVG contains `<text>` and unmatched polygons exist; badge "EXPERIMENTAL" in the step title and on every row | suggestions §8.4 with confidence; **unchecked by default**; the user confirms each row; nothing here is saved unless confirmed; the step can be skipped |
| `manual_assign` | click a polygon → unit picker (search by unit number/tenant; units already mapped are marked); click a mapped polygon → unassign / reassign; "Ignore polygon" (adds to `ignoredPolygonIds`); **Draw polygon** tool §8.3 | conflict handling §8.5 |
| `validate` | none | report §8.6; "Save" disabled while any `E-` item exists |
| `save` | `effectiveDate`, `notes`, `visibility` | new version or in-place mapping update (§2.4); `auditLog`; the engine re-renders; quota estimate shown before confirming (`08_PERSISTENCE_IMPORT_EXPORT.md` §12) |
| cancel | any state | discards the draft; nothing was written (the draft lives in memory on the wizard instance only) |

Rights: `founder_admin`, `head_ls`, `administrator` full; `manager` in assigned projects (`04_ROLES_AND_VISIBILITY.md` A29); clients and `external_agent` never see the wizard.

### 8.2 Inputs and the JSON polygon format

**SVG**: text is sanitized (§12.1); the sanitized string becomes `svgText`. **Raster**: `backgroundUrl` = the data URL (PNG/JPEG only, checked by prefix and by decoding into an `Image`), `svgText` = a synthetic SVG `<svg viewBox="0 0 <naturalWidth> <naturalHeight>"><g data-layer="units"/></svg>`; the engine draws the background as an `<image>` it creates itself from `backgroundUrl` (uploaded SVGs may never contain `<image>`). **JSON polygons** — the LSP format, defined here and reused as the output contract of any future recognition service (§13):

```json
{
  "format": "lsp-polygons",
  "version": 1,
  "viewBox": [0, 0, 1200, 800],
  "polygons": [
    { "polygonId": "p-F1-001", "points": [[20, 20], [200, 20], [200, 180], [20, 180]], "unitId": "UNIT-001" },
    { "polygonId": "p-F1-002", "path": "M200 20 H400 V180 H200 Z", "unitNumber": "F1-002" },
    { "polygonId": "kiosk-1", "points": [[500, 300], [540, 300], [540, 340], [500, 340]], "ignore": true }
  ]
}
```

Rules: `format` and `version` required; `viewBox` required; each polygon needs `polygonId` (unique, `^[A-Za-z][\w-]*$`) and exactly one of `points` (≥ 3 pairs of finite numbers) or `path` (validated by parsing into a temporary `<path>`); `unitId` and `unitNumber` are optional hints for `auto_match`; `ignore: true` pre-fills `ignoredPolygonIds`. The converter produces `svgText` with `<g data-layer="units">` and one `<polygon>`/`<path>` per entry; limit 500 000 characters (`E-PLAN-SIZE`). A JSON file can also be combined with a raster background (choose raster first, then "Load JSON polygons over the image").

### 8.3 Manual polygon drawing

Available for raster plans and for SVG plans with no or too few candidate polygons (the migration tool for CAD exports, §11). Tool behaviour: click places a vertex (in plan coordinates via `getScreenCTM().inverse()`), rubber-band segment follows the pointer, click on the first vertex or Enter closes (minimum 3 vertices), Backspace removes the last vertex, Escape cancels, Shift constrains to 0/45/90° (RECOMMENDED, not required). A closed polygon gets `id = lsp-poly-<n>`, is appended to `g[data-layer="units"]` of the draft SVG and immediately opens the unit picker; unassigned drawn polygons remain candidates. Existing polygons can be deleted (drawn ones only; imported geometry is never edited in the wizard — replace the file instead). Vertex editing after closing is not in v0.1 (A-06-7).

### 8.4 EXPERIMENTAL label extraction

Port of the CASE OS `parsePlanLabels` idea (`os/core.js` line 2548), limited to suggestions: collect `<text>` (joining `<tspan>` lines), clean mojibake and MTEXT codes as `mtextClean` does (line 2415), compute the text position through `getBBox()` + `getCTM()`, and accept a string as a unit-code candidate when it matches `^[A-Za-zА-Яа-я]{1,4}[-_ ]?\d[\w-]*$` (the CASE OS default regex; the numeric-only variant is off, A-06-8). A candidate becomes a suggestion `{ polygonId, unitId, source: 'label_experimental', confirmed: false, confidence }` when (1) the cleaned text equals a `unitNumber` of the floor (case-insensitive, whitespace removed) and (2) the text centre lies inside an unmatched candidate polygon (`SVGGeometryElement.isPointInFill`) — confidence 0.9 — or, failing that, the nearest unmatched polygon centroid is closer than `2 × fs` — confidence 0.5. Texts that match no unit are listed as "labels without a unit in the registry: L2_19, L2_20…" (input for creating units, `property-and-unit-data-engineer`), never as mappings. Everything in this step carries the badge **EXPERIMENTAL — verify every suggestion**; unconfirmed suggestions are stored on the version with `confirmed: false` only if the user chooses "keep suggestions for later" (so the CASE OS adapter can pre-fill them, `08_PERSISTENCE_IMPORT_EXPORT.md` §9.2) and never bind at render time.

### 8.5 Conflict handling

| Conflict | Prompt | Resolution |
|---|---|---|
| polygon already mapped to another unit | "Polygon p-F1-004 is mapped to F1-004. Replace with F1-005?" | replace (F1-004 becomes "without polygon" and is listed) or cancel |
| unit already mapped to another polygon | "F1-005 is already mapped to p-F1-005. Move the mapping, or add this polygon as a second shape (merged unit)?" | move (old polygon becomes unmapped), add (A-06-2, warning `W-PLAN-UNIT-MULTI-POLYGON`), or cancel |
| unit belongs to another floor | not selectable in the picker; shown greyed with "floor 2" | change `unit.floorId` in Units first (never from the wizard) |
| experimental suggestion contradicts an accepted match | suggestion hidden with "polygon already matched by id" | — |
| duplicate `id` in the SVG | `E-PLAN-DUP-ID` | "Auto-suffix duplicates" rewrites `id` → `id-2`, `id-3` and reports the list; carry-over may drop them |

### 8.6 Validation report

| Code | Level | Meaning | Blocks save |
|---|---|---|---|
| `E-PLAN-PARSE` | error | SVG/JSON does not parse (message with line/column when available) | yes |
| `E-PLAN-SIZE` | error | above the size limit (§12.2) | yes |
| `E-PLAN-DUP-POLYGON` | error | a polygon id appears in two mappings | yes |
| `E-PLAN-UNIT-FLOOR` | error | a mapped unit is not on this floor | yes |
| `E-PLAN-DUP-ID` | error | duplicate element ids in the SVG (until auto-suffixed) | yes |
| `W-PLAN-UNMAPPED-POLYGON` | warning | candidate polygons without a unit (list; "ignore all" shortcut) | no |
| `W-PLAN-UNIT-NO-POLYGON` | warning | units of the floor without a polygon (list) | no |
| `W-PLAN-UNIT-MULTI-POLYGON` | warning | unit with several polygons | no |
| `W-PLAN-LABEL-UNCONFIRMED` | warning | experimental suggestions left unconfirmed (count) | no |
| `W-PLAN-SANITIZED` | info | n elements / m attributes removed by the sanitizer (list of tag names) | no |
| `W-PLAN-NO-VIEWBOX`, `W-PLAN-TRANSFORM-ON-UNIT` | info | authoring deviations (§3) | no |
| `W-PLAN-CARRY` | info | carry-over summary (§2.5) | no |
| `W-PLAN-QUOTA` | warning | estimated state size after save ≥ 4 MB (D9) | no (confirm dialog) |

The report is shown again on the plan toolbar as a badge after save ("2 unmapped polygons · 1 unit not on plan") until resolved.

---

## 9. Sync rules and performance

### 9.1 Event → render matrix

| Event (from `LSP.events`) | `render(reason)` | Work |
|---|---|---|
| `unit.statusChanged`, `deal.stageChanged`, `deal.created`, `deal.closedWon`, `unit.tenantChanged`, `unit.updated` | `data` | new view model; per polygon: `fill`, `stroke`, overlay pattern, `data-*`, label text; legend counts |
| `settings.changed` (statuses, categories, palettes, thresholds) | `data` | same as above plus legend labels/colors |
| `plan.versionPublished`, `plan.mappingsChanged` | `geometry` / `mappings` | re-inject or re-bind, then everything |
| `task.created`, `comment.added`, `document.registered` | `data` (attention overlay only when it is on) | markers |
| `ui.modeChanged` | `mode` | colorize + legend |
| `ui.labelScaleChanged`, `ui.labelsToggled` | `labels` | decorate labels |
| `ui.selectionChanged` | `selection` | selection layer, table row highlight |

The units table, project dashboard, Kanban and portal subscribe to the same events; none of them reads DOM state from the plan (`§3.5`). Parity test: after any write, `polygon.dataset.classKey === tableRow.dataset.classKey` for every unit of the floor (`lsp_plan_table_parity`).

### 9.2 Cost model

Target sizes: 50–200 candidate polygons per floor (a 30–50-unit demo floor has ≤ 20; a real mall floor 80–150), five modes, ≤ 10 legend rows per mode. DOM per bound unit: 1 polygon + 1 overlay clone + 1 label group (rect + up to 4 texts) ≈ 7 nodes → ≤ 1 400 engine nodes at 200 units; a CAD-derived background may add thousands of static paths, which are injected once and never touched. A `data` render is attribute-only (no node creation), so a mode switch or status change stays under 100 ms at 200 units on a 1366×768 laptop (`02_REQUIREMENTS_REVIEW.md` R-15, `01_PRODUCT_SPEC.md` NFR-13); `geometry` renders (re-inject) are allowed up to 500 ms and happen only on plan/version change. QA measures both with `performance.now()` around `render()` (`lsp_plan_perf`).

### 9.3 Memoization

- Sanitized/parsed SVG document per `planId + version + sourceHash` (engine cache, cleared on `destroy()` and when a version is dropped).
- `services.planViewModel(floorId, mode, session)` memoized on `state.meta.revision` (incremented by every `commit`, `08_PERSISTENCE_IMPORT_EXPORT.md`) plus `floorId`, `mode`, role and `clientId`; derived maps behind it — `unitsByFloor`, `openDealsByUnit`, `displayStatusByUnit`, `availabilityGroupByUnit`, `targetActualClassByUnit`, `managerByUnit` — are memoized once per revision and shared with the units table, dashboards and reports so all views compute the same class from the same map.
- Legend rows are derived from the view model in one pass (`O(units)`), never from the DOM.
- Centroids and bboxes per polygon are cached per version (they depend on geometry only); label layout re-runs only on `labels` and `geometry` reasons.

### 9.4 Persistence touch points

The engine writes nothing to `localStorage`; UI preferences (mode, label scale, labels on/off, keep-view) go through `js/ui.js` into `caseos-lsp-ui`; plan versions and mappings go through services into `caseos-lsp-state-v1` with the debounced save and the 4 MB warning (D9). Rendering is fully derivable from state: reloading the page and re-mounting reproduces the same plan (`§64` Flow 12).

---

## 10. Demo plans specification

D4/A-2: fictional projects; D8: at least two hand-authored SVG floors with true clickable polygons; `§47`: 30–50 units, 2 projects, one or more sample SVG plans. RECOMMENDATION (`02_REQUIREMENTS_REVIEW.md` R-20): the SVG strings are generated once by a small Node script kept with the QA tooling (`docs/qa/tools/lsp_gen_demo_plans.js`, D10 folder convention) and committed as JS strings in `data/demo-plans.js`; no runtime generation, no `fetch()` (D2). Final id allocation belongs to `03_DATA_MODEL.md` / `data/demo.js`; the ids below are the proposal this document and the QA counts rely on.

| Plan | Project / building / floor | Units (polygons) | Layout sketch | Edge cases included |
|---|---|---|---|---|
| `PLAN-001` v1 (`current`) | Demo City Mall · `BLDG-001` · `FLOOR-001` "Ground Floor" | 16 unit polygons `UNIT-001`…`UNIT-016`: anchor supermarket (≈ 2 400 m², right wing), 2 mini-anchors, 11 inline shops (60–250 m²), 2 F&B | `viewBox 0 0 1200 800`; central mall corridor left→right, main entrance bottom centre, anchor on the right third, inline units along both sides, core (lifts/WC) top centre | 1 kiosk polygon `kiosk-1` without a unit (unmapped candidate, ignored in the shipped mapping); `UNIT-016` is a storage unit without a polygon ("Not on plan"); one unit without area |
| `PLAN-002` v1 (`current`) | Demo City Mall · `BLDG-001` · `FLOOR-002` "First Floor" | 14 unit polygons `UNIT-017`…`UNIT-030`: food court cluster of 6 small F&B units around a seating void, entertainment unit (≈ 1 200 m²), 7 inline shops | same viewBox; food court top right around a void (no polygon), entertainment bottom right, corridor and inline shops left half, void over the ground-floor atrium centre | multi-prospect unit (3 open deals) and the 2-unit deal (`UNIT-019` + `UNIT-020`) sit here so Flow 7 and Flow 8 are visible on the plan |
| `PLAN-003` v1 (`current`) | Demo Business Park · `BLDG-002` · `FLOOR-003` "Ground Floor" | 15 unit polygons `UNIT-031`…`UNIT-045`: 5 plinth retail units (street side), 10 office suites (80–400 m²) around a lobby | `viewBox 0 0 1000 700`; street façade at the bottom with the 5 retail units, lobby centre, office suites in two rows above, service core left | `commercialMode` mix: retail units leasing only, offices leasing and sales (`For Sale`, `Sold`, `Reserved` statuses appear); one archived version `PLAN-004` v0 marked `archived: true, svgDropped: true` to demonstrate the versions popover |

Totals: 45 units, 45 candidate unit polygons + 1 kiosk, 3 current plan versions, 1 archived. Every polygon: `<path>` or `<rect>` in `g[data-layer="units"]`, `id="p-<unitNumber>"`, `data-unit-id="UNIT-0nn"`, no transforms, no text; walls and cores in `data-layer="walls"`; no fonts, images or scripts; each file < 60 000 characters. `polygonMappings` ship pre-populated (`source: 'attribute', confirmed: true`) so rendering never depends on implicit binding. Polygon sizes are plausible relative to `area.glaM2` (a 2 400 m² anchor is visibly larger than a 60 m² shop) so the labels rule of §4.5 exercises all three tiers. Unit numbering: `F1-001`…, `F2-001`…, `BP-101`… (`§11` example `F1-001`).

---

## 11. CASE OS `PLANSVG` import

FACT (`os/core.js`): CASE OS stores plans in `PLANSVG[objId::block::floor] = { kind: 'svg' | 'img', data, by, date }` (line 2463); `bindSvgPlan()` binds by element `id` == unit code or `[data-code]` (line 2324) and otherwise by `<text>` whose content equals a unit code, drawing draggable label boxes at the text position (lines 2340–2360); `parsePlanLabels()` extracts codes with the regex of §8.4; layout versions freeze an immutable snapshot with checksum (`os/v417-master-plan.js`). FACT (`os/zarafshan-l2.svg`, 228 KB): a CAD export with 994 `<path>`, 64 `<text>`, 0 `<polygon>`/`<rect>`, ids like `path1`, `text608`, `viewBox="-4171 -301602 369709 270592"`, text positioned by absolute coordinates with Arial styles — there are no closed unit shapes with ids, so CASE OS binds this plan through labels only. It belongs to a real client and is never copied into LSP demo data (D4).

| CASE OS input | What the adapter does (`08_PERSISTENCE_IMPORT_EXPORT.md` §9.2) | What works | What does not |
|---|---|---|---|
| `kind: 'svg'` | sanitize → `floorPlans` v1 `current`, `format: 'SVG'`, `externalIds.caseOsPlanKey`; `auto_match` by `id`/`data-code` == `unitNumber` (works for the few CASE OS plans that were authored with ids) | plans authored with element ids per unit bind directly | CAD exports: 0 candidate polygons → nothing to color |
| `<text>` labels equal to unit codes | `experimental_labels` suggestions, `confirmed: false`, `W-CO-PLAN-LABELS-ONLY` | label positions are found reliably (same regex and `getCTM()` logic as production CASE OS) | a label without an enclosing polygon cannot become a polygon mapping; with `bindingKind: 'marker'` (Q-06-2) it can at least become a clickable, colored chip — CASE OS parity |
| `kind: 'img'` | `backgroundUrl` + empty units layer; off by default (Q-08-5) | manual drawing over the image | any automatic detection |
| `PLAN_LABELPOS`, `PLAN_CODES`, `PLAN_IGNORED_CODES`, `PLAN_SNAPSHOT_SVGS`, `CASE_LAYOUT_VERSIONS` | not imported (`W-CO-LAYOUT-VERSIONS-SKIPPED`) | — | — |

Why the demo needs hand-authored polygons: `§13` requires true clickable polygons and `§6.7` forbids faking recognition; CASE OS's real plans are stroke-based CAD exports where rooms are not closed shapes, and its production binding is label-based. Turning a CAD export into a polygon plan is a drawing task, which is exactly what the wizard's manual polygon tool (§8.3) offers the team for real floors after v0.1; the demo cannot depend on it. The demo plans are therefore authored as polygon SVGs (§10) and the CASE OS adapter path is tested with a CAD-like fixture (§14) that must produce "0 polygons found" plus label suggestions, never a silent success.

---

## 12. Security and limits

Prototype statement (`§6.1`, `§55`): nothing in this section is production security; the sanitizer reduces the risk of a malicious plan file executing in a colleague's browser, it does not make the application secure. FACT (`os/.htaccess`): the CSP allows `'unsafe-inline'` scripts, so the CSP does not protect against script inside an injected SVG (`02_REQUIREMENTS_REVIEW.md` R-2); inline SVG, inline patterns and `data:` images are permitted by that CSP (`img-src 'self' data: blob: https:`), so the engine works unchanged on hosting.

### 12.1 Sanitizer allow-list

| Allowed elements | `svg g path polygon polyline rect circle ellipse line text tspan title desc defs clipPath symbol use style` (`style` kept only when free of `url(`, `@import`, `expression(`, `javascript:`) |
|---|---|
| Allowed attributes | `id class data-* viewBox preserveAspectRatio width height x y x1 y1 x2 y2 cx cy r rx ry points d transform fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-opacity opacity font-size font-family font-weight font-style text-anchor dominant-baseline letter-spacing clip-path clip-rule visibility display style xmlns xmlns:xlink xml:space href xlink:href` |
| `href` / `xlink:href` | kept only when the value starts with `#` (fragment); everything else removed |
| `style` attribute | removed when it contains `url(`, `expression(`, `javascript:`, `@import` (CASE OS checks only `expression(` and `javascript:`, line 2437) |
| Removed elements | everything not listed, including `script foreignObject image iframe object embed animate animateTransform animateMotion set handler a font font-face filter feImage` (text content of removed elements is dropped, not unwrapped) |
| Removed attributes | every `on*`, `xlink:actuate`, `externalResourcesRequired`, `filter`, `mask`, `marker-*`, anything not listed |
| Namespaces | non-SVG namespaced elements/attributes removed except `xlink:href` (fragment) |
| Storage | the serialized clean document (`XMLSerializer`) is what is stored and later injected; injection uses `importNode`, never `innerHTML` with raw input |

QA fixture `plan_hostile.svg` contains `<script>`, `onload=`, `onclick=`, `<a href="javascript:…">`, `<use href="https://…">`, `<image href="https://…">`, `<foreignObject>`, `<style>@import url(…)</style>` and `style="background:url(…)"`; after sanitizing, none of these strings remains in the stored text or the DOM (`lsp_plan_sanitizer`).

### 12.2 Limits

| Limit | Value | Behaviour |
|---|---|---|
| SVG text | 1 000 000 characters hard; warning above 250 000 | `E-PLAN-SIZE` / `W-PLAN-SIZE` (A-06-4) |
| JSON polygons | 500 000 characters | `E-PLAN-SIZE` |
| Raster `backgroundUrl` | 1 500 000 characters hard (≈ 1.1 MB file); warning above 500 000 | `E-PLAN-SIZE` / `W-PLAN-SIZE`; the wizard suggests resizing to ≤ 2 000 px on the long side (A-06-4) |
| Candidate polygons | soft limit 500 per version | above it, labels are drawn only when zoomed ≥ 2× and a warning is shown |
| State size | 4 MB warning (D9) | `W-PLAN-QUOTA` before save; Storage panel lists plans by size; archived versions can be `svgDropped` |
| Files | never read from the file system by path; only user-selected files through `<input type="file">` + `FileReader`; no `fetch()` of local files (D2, `file://`) | — |
| Raster content | prefix must be `data:image/png;base64,` or `data:image/jpeg;base64,` and must decode in an `Image`; otherwise rejected | `E-PLAN-RASTER` |

---

## 13. Future recognition path (out of scope)

FACT (`§16` vision): "upload floor plan → detect units → read labels → read areas → create polygons → connect units → request human verification" for PDF, SVG, PNG, JPG, CAD/DWG, BIM/IFC. FACT (`§6.7`): not to be claimed unless it works; the MVP uses supplied SVG/JSON polygons, manual mapping and optional experimental text extraction. No OCR, CV, CAD or AI recognition is implemented or simulated in v0.1, and the wizard shows those formats as future without a button.

How the v0.1 model already accommodates it, without changes to entities or ids:

| Vision step | Slot in v0.1 |
|---|---|
| detect units / create polygons | a detector (server-side or a future local module) emits the JSON polygon format of §8.2 with `polygonId`, optional `unitNumber` hints and `confidence`; the wizard consumes it through the existing "JSON polygons" source |
| read labels | `experimental_labels` step and `source: 'label_experimental'` / a future `source: 'recognition'` value on the mapping entry; `confirmed: false` + `confidence` already exist |
| read areas | `geometry.areaSource: 'Plan'` (`§11`) is reserved; a metric scale field on the plan version (`scaleM2PerUnit`, not in v0.1) would let `property-and-unit-data-engineer` compute `areaDiff` |
| connect units | `polygonMappings` on the version; unit ids never change |
| request human verification | the wizard's `auto_match` → `manual_assign` → `validate` states are the verification UI; `confirmed` is the flag |
| provenance / audit | `auditLog` entries `plan.published` / `plan.mappingsChanged` carry `source` counts per mapping; a future production pipeline adds the detector name and version to the same entry (`§54`) |

---

## 14. Test hooks for QA

Conventions for `10_QA_PLAN.md` (D10: `docs/qa/tools/lsp_*.js`, Playwright-core, static server with 404 on `/api/*`, result rows `{ test, status: 'PASS' | 'FAIL', info }` as in `docs/qa/tools/verify_full_qa.js`). FACT: CASE OS QA scripts use element ids and text, not `data-testid` (no occurrence in `os/`); LSP introduces `data-testid` because the plan DOM is generated and ids inside plans are user data.

| Hook | Where | Assertion examples |
|---|---|---|
| `data-testid="plan-host"`, `data-mode`, `data-plan-id`, `data-plan-version`, `data-floor-id`, `data-variant` | host element | mode switch sets `data-mode`; floor switch changes `data-plan-id` |
| `data-testid="plan-svg"` | injected `<svg>` | `querySelectorAll('[data-testid=plan-svg] [data-unit-id]').length === expected` (16 / 14 / 15 for the demo floors); `[data-class-key="unmapped"]` count = 1 on `PLAN-001` |
| `data-unit-id`, `data-polygon-id`, `data-class-key`, `data-status-key`, `data-binding` | bound polygons | after changing status in the drawer: `data-status-key` equals the new key and `getComputedStyle(el).fill` equals the config color of that key converted to `rgb(r, g, b)`; overlay clone `fill` starts with `url("#lsp-pat-` when the entry has a pattern |
| `tabindex`, `role="button"`, `aria-label` | bound polygons | keyboard test: focus first polygon, press Enter, drawer `data-unit-id` matches |
| `data-testid="plan-legend"`, rows `data-legend-key`, `data-count`, `data-gla` | legend | set of legend keys ⊆ config keys of the mode; every `data-class-key` present on the floor has a legend row; clicking a row dims other classes (`.is-dimmed` count) |
| `data-testid="plan-tooltip"` | tooltip | visible after `hover()` on a polygon; contains the unit number |
| `data-testid="plan-zoom-in" / "plan-zoom-out" / "plan-fit" / "plan-labels-up" / "plan-labels-down" / "plan-labels-toggle" / "plan-attention-toggle"` | toolbar | computed `transform` of `.lsp-plan-canvas` changes and `fit` restores `matrix(1, 0, 0, 1, 0, 0)` |
| `data-testid="plan-mode-<key>"`, `"plan-floor-select"`, `"plan-building-select"`, `"plan-versions"` | toolbar | role tests: `plan-mode-manager` absent for client; only `plan-mode-availability` for `external_agent` |
| `data-testid="plan-not-on-plan"`, rows `data-unit-id` | panel | `UNIT-016` listed on `PLAN-001`; clicking opens the drawer |
| `data-testid="unit-drawer"`, `data-unit-id`, sections `data-section="summary|commercial|deal|contacts|documents|timeline|comments|actions"`, actions `data-testid="drawer-action-<change-status|assign-brand|create-deal|add-prospect|add-task|add-comment|register-file|open-crm|compare-mix>"` | drawer | client variant: only `comments` and `documents` sections plus `drawer-action-leave-comment`; canary strings (`04_ROLES_AND_VISIBILITY.md` A-04-8) absent |
| `data-testid="plan-mobile-list"`, rows `data-unit-id`, `data-class-key`; `"plan-mobile-show-plan"` | mobile fallback | at 390×844 the list renders and `plan-svg` is absent until "Show plan" is tapped |
| `data-testid="wizard"`, `data-step="<state>"`, rows `data-polygon-id`, `data-source`, `data-confirmed`; `"wizard-save"`, `"wizard-cancel"`, `"wizard-report"` items `data-code` | wizard | hostile fixture: `wizard-report` has `W-PLAN-SANITIZED` and no forbidden strings in the preview DOM; CAD-like fixture: `polygonCount === 0`, `data-step="experimental_labels"` rows have `data-confirmed="false"` and `wizard-save` produces zero confirmed mappings unless a row is checked |
| `LSP.floorplan._debug` (present only when `window.LSP_TEST === true`, set by the QA harness) | `listenerCount()`, `renderCount()`, `lastRenderMs()`, `viewModel()` | `listenerCount() === 1` after five `render()` calls; `lastRenderMs() < 100` for a `data` render at 200 units (synthetic fixture `plan_200.svg`) |

Fixtures (kept under `docs/qa/fixtures/lsp/`): `plan_minimal.svg` (§3), `plan_hostile.svg` (§12.1), `plan_cadlike.svg` (paths and `<text>` codes, no polygons — authored synthetically, not derived from `zarafshan-l2.svg`), `plan_200.svg` (200 generated rects), `polygons_valid.json`, `polygons_invalid.json`, `raster_small.png`. Named tests: `lsp_plan_load`, `lsp_plan_click_all`, `lsp_plan_hover`, `lsp_plan_modes`, `lsp_plan_legend_keys`, `lsp_plan_floor_switch`, `lsp_plan_zoom`, `lsp_plan_status_sync`, `lsp_plan_table_parity`, `lsp_plan_single_listener`, `lsp_plan_demo_inventory`, `lsp_plan_sanitizer`, `lsp_plan_wizard_svg`, `lsp_plan_wizard_json`, `lsp_plan_wizard_raster`, `lsp_plan_wizard_cadlike`, `lsp_plan_version_publish` (record counts of `units`, `deals`, `statusHistory` identical before/after), `lsp_plan_client`, `lsp_plan_mobile`, `lsp_plan_perf`, `lsp_plan_no_hex` (static grep of `js/floorplan.js`).

---

## 15. Assumptions and open questions

### 15.1 Assumptions

| ID | Assumption | Consequence if wrong |
|---|---|---|
| A-2 | Demo data is fictional (context brief D4) | demo plans, unit numbers and tenants in §10 are invented |
| A-3 | Merchandise categories per D15 | `mix` legend keys and category codes follow D15 defaults |
| A-06-1 | `<circle>`, `<ellipse>` and `<g>` are not unit shapes in v0.1; teams export units as `<path>`, `<polygon>` or `<rect>` | if real plans use groups per unit, the wizard adds "use group's first shape" (small change) |
| A-06-2 | A unit may own several polygons (merged/split units) with a warning; one polygon never maps to two units | if merged units must be separate units, the CASE OS adapter rule Q-08-7 changes, not this engine |
| A-06-3 | Plan geometry carries no metric scale in v0.1; areas always come from `unit.area.glaM2`; "apply area from plan" is not available for polygon geometry | a `scaleM2PerUnit` field on the plan version would enable it later (§13) |
| A-06-4 | Size limits: SVG 1 000 000 characters, JSON 500 000, raster data URL 1 500 000; warnings at 250 000 / 500 000 | limits are constants in `config.plan.limits`; changing them is a Settings-level edit |
| A-06-5 | Labels are engine-positioned at the polygon centroid; no manual label dragging in v0.1 (CASE OS `PLAN_LABELPOS` not ported) | if the team needs label offsets for odd shapes, add `labelOffsets` on the plan version later |
| A-06-6 | Mobile fallback breakpoint 768 px; tablet (768–1024 px) shows the full plan | breakpoint is one CSS token in `css/lsp.css` |
| A-06-7 | Drawn polygons cannot be vertex-edited after closing in v0.1; delete and redraw instead | vertex editing is an additive wizard feature |
| A-06-8 | Experimental label regex = CASE OS default (`^[A-Za-zА-Яа-я]{1,4}[-_ ]?\d[\w-]*$`); numeric-only labels are not treated as codes | a "numeric labels" checkbox (CASE OS `numeric` option) can be added to the step |

### 15.2 Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-06-1 | Add `shortCode` (≤ 4 characters) to every entry of `config.unitStatuses` (and derived statuses) for plan labels, or derive codes from labels? | Add `shortCode` to the config schema in `05_STATUSES_STAGES_AND_CONFIG.md` with defaults (e.g. Available AV, Active Marketing MKT, Reserved RES, Contract Signed SGN, Fit-out FIT, Occupied OCC, For Sale SALE, Sold SOLD, Temporarily Blocked BLK, Not Available N/A, Unknown UNK; derived Lead LEAD, Viewing VIEW, Negotiation NEG, LOI LOI, Contract Draft DRFT, Sale Negotiation SNEG); editable in Settings; RU dictionary variants via `t()`. | Head of Leasing & Sales (labels); Engineering (schema) |
| Q-06-2 | Support `bindingKind: 'marker'` (clickable colored chip at a `<text>` position) so label-only CASE OS plans are usable in LSP without drawing polygons? | Include in v0.1: it reuses the label decorator, costs little, and gives the team CASE OS parity on real plans during validation; marker-only units are still listed as "not on plan" for completeness. | Founder / product sponsor |
| Q-06-3 | Which plan modes are offered to clients? | `status` (as `clientStatus`), `availability`, `mix` (category only); `target_actual` off by default and switchable per project in `config.visibility.clientPlanModes`; `manager` never. | Founder / product sponsor; Head of Leasing & Sales |
| Q-06-4 | Legend-row click filters the units table as well (shared filter chip) or only dims the plan? | Shared chip: the plan and the table must show the same state (`§65`), and one filter model avoids a hidden plan-only filter. | Engineering |
| Q-06-5 | Should the wizard allow editing mappings of the current version in place (no new version) or always create a version? | In place for mapping-only corrections with an audit entry; a new version whenever `svgText` or `backgroundUrl` changes (§2.4). This keeps the version list meaningful (geometry changes) while still auditable. | Head of Leasing & Sales |
| Q-06-6 | Who may see archived versions and drop their SVG text? | View: all internal roles; drop (`svgDropped`): `founder_admin`, `head_ls`, `administrator`; consistent with `04_ROLES_AND_VISIBILITY.md` A29. | Founder / product sponsor |

Cross-references: `00_MASTER_PROMPT.md` (§3.2, §3.3, §3.5, §6.7, §10, §11, §13, §14, §15, §16, §35, §40, §48, §50, §54, §63, §64, §65), `02_REQUIREMENTS_REVIEW.md` (C-9, C-10, C-12, R-2, R-7, R-15, R-18, R-20), `03_DATA_MODEL.md` (`floorPlans`, `units.geometry`, integrity rules, demo ids), `04_ROLES_AND_VISIBILITY.md` (§1.4 preview, §4 field classes, §6 `clientView()`, §7 drawer table, A29 wizard right), `05_STATUSES_STAGES_AND_CONFIG.md` (status entries, `availabilityGroup`, `clientStatus`, `config.plan.*`), `07_CALCULATIONS_AND_KPI_RULES.md` (legend totals, denominators), `08_PERSISTENCE_IMPORT_EXPORT.md` (§9.2 adapter, §12 quota, `svgDropped`), `09_IMPLEMENTATION_PLAN.md` (Phase 2 floor plan engine), `10_QA_PLAN.md` (tests named in §14), `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (§6 spatial entity layer, mode registry, event bus), CASE OS `os/core.js` (`bindSvgPlan` 2316, `parsePlanLabels` 2548, `mtextClean` 2415, `sanitizePlanSvgDom` 2429, `planZoom` 2306, `planLabelSize` 2409), `os/v417-master-plan.js`, `os/zarafshan-l2.svg`, `os/.htaccess`, `docs/qa/tools/verify_full_qa.js`.
