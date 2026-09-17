---
name: interactive-floorplan-engineer
description: Builds the LSP interactive floor-plan engine in os/leasing/js/floorplan.js: SVG parsing and sanitizing, polygon-to-unit binding via data-unit-id, versioned floorPlans with polygonMappings, the five visualization modes with config-driven legends and non-color patterns, pan/zoom, mobile fallback, the Plan Import / Mapping Wizard (with clearly experimental text-label matching) and hand-authored demo SVG plans. Use for "floor plan", "SVG plan", "polygon mapping", "mapping wizard", "plan legend", "status colors on the plan", "demo plan SVG", "plan version", or any change to floorplan.js or floor-plan CSS.
---

# interactive-floorplan-engineer

## Purpose

The floor plan is the critical acceptance feature of the MVP (00_MASTER_PROMPT.md §13) and the
spatial interface of the whole operating model (§68). This skill makes plan polygons real,
clickable, config-colored and synchronized with the unit table, CRM, dashboard and client portal
(§3.5), while never claiming recognition features that do not exist (§6.7, §16). It owns
`os/leasing/js/floorplan.js`, the floor-plan section of `css/lsp.css` and the demo SVG plans.

## Responsibilities

- Engine (`js/floorplan.js`): resolve the current `floorPlans` version for a project / building /
  floor, sanitize its SVG text, inline it into the plan host, bind polygons to units through
  `polygonMappings[{polygonId, unitId}]`, draw the overlay (labels, patterns, selection, hover),
  legend, tooltips, pan/zoom (wheel + drag + buttons + reset), mode switch and floor switch.
- Modes (D8, §14): Leasing/Sales status, Merchandise mix, Target vs Actual, Manager,
  Availability. Each mode has its own legend, text labels, tooltip and a non-color indicator
  (pattern fill or outline). The per-unit class comes from `js/services.js` (derived display
  status and `availabilityGroup` per `05_STATUSES_STAGES_AND_CONFIG.md`; mix classes from
  `merchandise-mix-analyst`); `floorplan.js` only maps a class key to the `color / textColor /
  pattern` entry in `DEFAULT_CONFIG` and never computes business state itself.
- Plan versioning (D8, §10): `floorPlans` records carry `version, current, archived,
  effectiveDate, fileName, format, backgroundUrl, polygonMappings`. Uploading a plan creates a
  new record with `current: true`, sets the previous one to `archived: true`, and leaves
  `units`, `deals`, `statusHistory` and `auditLog` untouched.
- Sanitizer (port of the CASE OS `sanitizePlanSvgDom` intent): parse with `DOMParser`
  (`image/svg+xml`), reject parse errors with a readable message, remove `<script>`,
  `<foreignObject>`, `<iframe>`, `<object>`, `<embed>`, every `on*` attribute, `javascript:`
  URLs and non-fragment `href` / `xlink:href` (external references), keep geometry, text and
  inline styles. The sanitized text is what gets stored on the plan version.
- Mapping wizard (§16 steps 1–8): choose or upload a plan (SVG read as text via `FileReader`,
  JSON polygons in the shape defined in `06_FLOORPLAN_ARCHITECTURE.md`, or PNG/JPG as
  `backgroundUrl` plus a manual polygon-drawing tool that emits synthetic `<polygon>` elements
  with generated `polygonId`s); identify project / building / floor; display; auto-match by
  `data-unit-id` == `unit.id`, then `id` / `data-code` == `unitNumber`; EXPERIMENTAL text-label
  matching (port of the `parsePlanLabels` idea: code regex `^[A-Za-zА-Яа-я]{1,4}[-_ ]?\d[\w-]*$`,
  `<tspan>` lines, mojibake clean-up as in `mtextClean`, transform-aware positions via
  `getBBox()` + `getCTM()`, nearest enclosing polygon) shown with an "Experimental" badge and
  always requiring human confirmation; manual assignment (click polygon, pick unit); save the
  mapping on the plan version; list unmapped polygons and unmapped units.
- Demo plans (D4, D8, §47): at least two hand-authored SVG floors with true clickable polygons
  embedded as JS strings in `data/demo.js` (or `data/demo-plans.js`), covering Demo City Mall
  (2 floors) and Demo Business Park (1 floor): every unit polygon has `data-unit-id="UNIT-0nn"`
  and an `id`; corridors, cores and voids have no `data-unit-id`; a simple `viewBox`
  (e.g. `0 0 1200 800`); no external fonts, images or scripts; polygon sizes plausible
  relative to `area.glaM2`.
- Client floor plan (§35, D7): the same engine rendered only from the `clientView(projectId)`
  output — approved plan version, `clientStatus` colors, client drawer, no Manager mode.
- Mobile fallback (D8, §48): below the breakpoint set in `css/lsp.css`, show the floor's unit
  list + drawer instead of the full plan, with an explicit "Open plan" action.
- Event handling: exactly one delegated `click` / `pointerover` / `keydown` listener per plan
  host using `data-action` and `data-unit-id`; overlay rebuilt idempotently; the parsed base SVG
  cached per plan version; re-render on the state-change event used by `js/ui.js`.
- Print: plan and legend fit one page in the print stylesheet (with `reporting-and-dashboard-
  analyst` and `frontend-ux-engineer`).

Hand-offs: drawer sections and actions (§15) -> `frontend-ux-engineer` (component in
`js/ui.js`) with domain content from the owning skills; status list, colors and client mapping
-> `05_STATUSES_STAGES_AND_CONFIG.md` via `crm-data-modeler`; mix classes ->
`merchandise-mix-analyst`; derived pipeline stage -> `leasing-pipeline-analyst`; area diffs and
"apply area from plan" -> `property-and-unit-data-engineer`; portal filtering and negative tests
-> `client-portal-permissions`; quota / IndexedDB decisions -> `local-storage-and-import-export`;
Playwright scripts -> `testing-and-qa`.

## Inputs

- `docs/leasing-platform/00_MASTER_PROMPT.md` §3.2, §3.3, §3.5, §6.7, §10, §11 (`geometry`),
  §13, §14, §15, §16, §35, §48, §63 items 5 and 20, §64 flows 2, 3, 4, 9, §65 "Floor plans",
  §67 items 4–5.
- `docs/leasing-platform/06_FLOORPLAN_ARCHITECTURE.md` (primary contract: module surface,
  JSON polygon format, wizard states), `05_STATUSES_STAGES_AND_CONFIG.md` (colors, patterns,
  `clientStatus`), `03_DATA_MODEL.md` (`floorPlans`, `units.geometry`),
  `04_ROLES_AND_VISIBILITY.md` (who sees which mode), `07_CALCULATIONS_AND_KPI_RULES.md`
  (what a label may show), `09_IMPLEMENTATION_PLAN.md`, `10_QA_PLAN.md`.
- LSP source: `os/leasing/js/floorplan.js`, `js/config.js`, `js/services.js`, `js/ui.js`,
  `css/lsp.css`, `js/views/projects.js` (host screen), `js/views/portal.js`, `data/demo.js` /
  `data/demo-plans.js`, `data/i18n.js`.
- CASE OS, read-only, as reference for what already works in production: `os/core.js`
  `bindSvgPlan` (line 2316: binding by `id` / `data-code`, text-label fallback, viewBox repair,
  adaptive label size), `parsePlanLabels` (line 2548), `sanitizePlanSvgDom`, `mtextClean`,
  `userCenterOf`, `unitFill` (line 2698 — its fuzzy `catHex` palette is NOT to be ported),
  `planKey` (line 2173); `os/v417-master-plan.js` (immutable layout snapshots, audit item P0-1).
- `os/zarafshan-l2.svg` only as a NEGATIVE test fixture: a CAD export with 994 `<path>`,
  64 `<text>`, 0 `<polygon>`, no unit ids and mojibake `<tspan>` labels. It belongs to a real
  client and is never copied into LSP demo data; it is the reason text matching is experimental.
- `os/.htaccess` CSP: inline SVG needs no external scripts; fonts only from Google Fonts.

## Outputs

- `js/floorplan.js` with the public surface named in `06_FLOORPLAN_ARCHITECTURE.md`
  (mount / render / set mode / select unit / destroy), the sanitizer and the wizard module.
- Floor-plan and wizard CSS in `css/lsp.css` using the design tokens only; readable in light
  and dark themes; print rules.
- Demo SVG strings, `floorPlans` records and `polygonMappings` in `data/demo.js`.
- EN + RU strings for mode names, legends, wizard steps and warnings in `data/i18n.js`.
- Test hooks for `testing-and-qa`: stable `data-unit-id`, `data-mode`, `data-legend-key`
  attributes and three fixtures (minimal valid SVG; SVG with `<script>`, `onload=`,
  `javascript:` href and `<foreignObject>`; CAD-like SVG with text but no polygons).
- A FACTS / ASSUMPTIONS / RECOMMENDATIONS note in the task response for any rule not covered
  by the planning documents.

## Constraints

- D8: polygons are `<path>`, `<polygon>` or `<rect>` carrying `data-unit-id` (preferred) or
  `id`; mappings live on the plan version, never on the SVG file alone and never on the unit as
  the only copy; a new plan never erases unit, deal or status history.
- D5: no hex color or pattern is hard-coded in `floorplan.js`; every mode reads `DEFAULT_CONFIG`
  (statuses, merchandise categories, managers palette) so Settings edits change the plan.
- §6.7 / §16: no OCR, CV, CAD, DWG, PDF, BIM or AI recognition claims; text-label matching is
  labeled "Experimental" in the UI and README and never auto-saves; raster plans use manual
  mapping only.
- D2: no `fetch()` of local files, no external runtime library (no d3, panzoom, Chart.js), no
  build step; must run from `file://` and under the `os/.htaccess` CSP.
- §65 "Floor plans": no duplicate click handlers; selected unit is correct; plan and table show
  the same state; legends match the classes in config; zoom/pan works; floor switching works.
- D7 / §35: the client plan renders from `clientView(projectId)` only; internal unit objects,
  manager names, proposed terms and internal comments never reach the portal renderer.
- D9: SVG text is the main quota driver — surface the 4 MB warning when a plan is saved; raster
  `backgroundUrl` data URLs respect the limit set in `08_PERSISTENCE_IMPORT_EXPORT.md`; no
  IndexedDB in v0.1.
- D14: no gradients, glassmorphism or decorative animation; `#9E0000` is an accent, never a
  status or category color; label `textColor` must contrast in both themes.
- Accessibility (§14): each mode carries a non-color indicator; polygons are focusable
  (`tabindex="0"`) and open the drawer on Enter.
- CASE OS files, its plan routes (`plans`, `project_layouts`, `plan_master`) and `PLANSVG` are
  never modified or linked; `PLANSVG` is read only through the import adapter.
- Vocabulary: `floorPlans`, `polygonMappings`, `polygonId`, `unitId`, `version` / `current` /
  `archived` / `effectiveDate`, mode names as in §14 and D8.

## Validation checklist

- [ ] Every demo floor loads; each unit polygon has `data-unit-id`; clicking it opens the drawer
      whose `unitNumber` matches the polygon's unit (Flow 3 step 1–2).
- [ ] Hover state and tooltip appear; focused polygon + Enter opens the drawer.
- [ ] All five modes switch; each legend lists exactly the class keys present in config and
      shows the pattern/outline indicator (Flow 4).
- [ ] Changing `commercialStatus` in the drawer recolors the polygon and updates the units table
      and dashboard without reload (Flow 3 steps 8–9).
- [ ] Hostile fixture renders with no `<script>`, `on*` attribute, `javascript:` URL or
      `<foreignObject>` left in the DOM; parse error shows a message, not a blank host.
- [ ] CAD-like fixture reports "0 polygons found" and offers experimental matches that require
      confirmation; nothing is saved without it.
- [ ] Uploading a new version archives the previous one; counts of `units`, `deals` and
      `statusHistory` are identical before and after.
- [ ] After five re-renders the host has one delegated listener set (test hook count).
- [ ] 390×844 shows the list fallback; 820×1180 and desktop viewports show the plan; zoom/pan
      and reset work.
- [ ] Client session sees the approved plan with `clientStatus` colors and no Manager mode.
- [ ] `grep -n "#[0-9a-fA-F]\{3,6\}" js/floorplan.js` returns nothing outside comments.
- [ ] State size after loading demo plans is reported and below 4 MB.
- [ ] Only `os/leasing/` (and assigned docs/QA) files changed; task response separates FACTS
      (cited) from ASSUMPTIONS (A-n) and RECOMMENDATIONS.

## Prohibited behavior

- Claiming or faking automatic unit detection, OCR, CV, CAD/DWG/PDF/BIM import.
- Inserting plan SVG via `innerHTML` without the sanitizer; executing plan scripts; loading
  external hrefs or images from a plan.
- Storing deal stage, color or KPI values on polygons or plan records; computing KPIs or stage
  logic inside `floorplan.js`.
- Attaching `addEventListener` per polygon inside render loops.
- Reusing `zarafshan-l2.svg`, any CASE OS `PLANSVG` content or real client names in demo data.
- Porting the fuzzy `catHex` substring color matching or any hard-coded palette.
- Adding Chart.js, d3, panzoom or any other runtime dependency.
- Overwriting `polygonMappings` of an archived version or deleting units when a plan is replaced.
- Building the client plan as a filtered copy of internal data inside the renderer instead of
  consuming `clientView` output.

## Examples

1. Prompt: "Add the Manager mode to the floor plan." Expected: read §14.4 and
   `06_FLOORPLAN_ARCHITECTURE.md`; add a mode entry that asks services for
   `responsibility.responsibleManagerId` per unit, takes the manager palette from
   `DEFAULT_CONFIG`, adds a legend with manager names plus an outline pattern for "unassigned",
   adds EN/RU strings, keeps the mode hidden for the `client` role, and hands a test id to
   `testing-and-qa`.
2. Prompt: "The team uploaded an Illustrator SVG for Demo Business Park floor 1; make the units
   clickable." Expected: run the wizard: sanitize, display, auto-match finds 0 `data-unit-id`
   polygons; experimental text matching proposes code -> nearest polygon pairs with confidence
   notes and an "Experimental" badge; the user confirms or reassigns manually; the mapping is
   saved as a new plan version; unmapped units are listed; no recognition is claimed.
3. Prompt: "Author the demo SVG for Demo City Mall level 2 (14 units and a food court)."
   Expected: a hand-written SVG string in `data/demo.js` with 14 `<path>`/`<rect>` polygons
   carrying `data-unit-id` for existing `UNIT-0nn` records (unit records come from
   `property-and-unit-data-engineer`), corridors without ids, a `floorPlans` record
   (`version: 1, current: true`) with 14 `polygonMappings`, and a Playwright check that every
   mapped polygon opens the right drawer.
