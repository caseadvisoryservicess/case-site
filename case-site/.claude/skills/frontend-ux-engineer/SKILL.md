---
name: frontend-ux-engineer
description: Owns the shared front-end layer and UI conventions of the Leasing & Sales Platform (LSP, os/leasing/): index.html shell, css/lsp.css tokens (light/dark, CASE red accent only, print base), js/ui.js (hash router, drawer, modal, toast, table, filter chips, inline SVG charts, provenance marks, esc(), t() i18n) and data/i18n.js (EN base + RU), plus view-file rules: one delegated listener with data-action, render from appState, no inline onclick, no fake buttons, responsive at the D10 viewports. Use for "drawer", "table", "filter chips", "i18n key", "dark mode readability", "responsive", "print stylesheet", "design tokens", "empty state" or edits to ui.js, lsp.css, i18n.js.
---

## Purpose

00_MASTER_PROMPT.md §48 asks for a dense, professional operating UI (compact tables, badges, side drawers,
restrained color, no gradients or decorative animation) that works from 1920×1080 down to common mobile
widths, §3.5 requires every view to stay synchronized with `appState`, §63 and §69 forbid empty destinations
and fake buttons, and §65 lists the front-end checks (no duplicated event handlers, no overlapping panels,
no clipped content). Brief D2 places the shared layer in `js/ui.js`, `css/lsp.css`, `data/i18n.js` and the
`index.html` shell; D3 makes `t(key)` mandatory from day one; D14 fixes the visual direction; D16, D19 and
D20 add provenance marks, escaping and money formatting rules taken from the live CASE OS build; D18 sets a
1.5 MB size budget. This skill owns those files and the conventions every `js/views/*.js` file follows.
Domain content (which fields a drawer shows, KPI formulas, plan rendering) belongs to the owning skills.

## Responsibilities

- Shell `os/leasing/index.html`: login screen with the sentence "Prototype authentication only. This does
  not provide production security." (00_MASTER_PROMPT.md §6.1), the "DEMO DATA" banner (brief D4), app frame
  (header with project switcher, global search, EN/RU toggle, theme toggle, Saving / Saved / Unsaved
  indicator, role badge, logout), view containers, print root, `<script src>` tags in dependency order,
  `LSP_VERSION = '0.1.0'` (brief D11). No `fetch()` of local files; the app opens from `file://` (brief D2)
  and inlines cleanly into `LSP_standalone.html` (brief D18), so CSS and JS reference no relative asset
  URLs.
- Design tokens in `css/lsp.css` on `:root` (light) and `body.dark` (dark), mirroring the CASE OS names
  where sensible: `--bg --panel --card --ink --muted --soft --border --green --amber --blue --teal --purple`
  plus `--red:#9E0000` as accent only (reference: CASE OS `os/index.html` line 18 and `body.dark` at line
  286; values may differ, names stay). Montserrat via a Google Fonts `<link>` with a system stack fallback
  and `font-display: swap`; no fonts or images bundled (brief D18); icons as inline SVG symbols.
- Status and category colors are never CSS constants: rendering reads `color`, `textColor` and `pattern`
  from `js/config.js` entries (brief D5) and applies them per element (inline style or a generated `<style>`
  block regenerated when Settings change). Dark mode: every status fill keeps readable label text
  (`textColor` from config) and a non-color `pattern`/outline; a fill that fails in dark mode is fixed by a
  config value, not a CSS override.
- Provenance marks (brief D16, CASE OS `v4710-provenance.js` `provChip` precedent): `provMark(record,
  field)` renders confidence as icon + frame + word, never color alone: `modelled` ƒ dashed frame, `asking`
  ≈ frame without fill, `verified` ✓ filled, no source ? dotted; staleness text amber above 90 days and red
  above 180 days; aggregates show the composition ("verified 3, asking 7"). Used on unit area, asking/agreed
  rent, status and project GBA/GLA wherever the owning skill supplies a `provenance` record.
- Event handling: exactly one delegated `click` listener on the app root (plus `keydown`, `input`/`change`,
  `submit` where needed) dispatching on `data-action`, with targets in `data-id`, `data-entity`,
  `data-view`, `data-unit-id`. No inline `onclick=` attributes (CASE OS `os/core.js` has 183 of them; LSP
  departs from this so 00_MASTER_PROMPT.md §65 "no duplicated event handlers" is testable and no inline
  script is needed under the `os/.htaccess` CSP). Every `data-action` value has a registered handler; an
  unknown action logs a console warning in development.
- Render model: `js/views/*.js` export `render(state, params) → html string` and an `actions` map; every
  dynamic value passes through `esc()` from `js/ui.js`; SVG text (plan labels, chart labels, legends,
  tooltips) is set with `textContent`/`createElementNS`, never string-concatenated markup (brief D19); views
  subscribe to the single state-change event of `js/state.js` and re-render idempotently (no per-render
  listener attachment). Views keep no business data outside `appState` (00_MASTER_PROMPT.md §25).
- Router: `location.hash` routes `#/<view>/<id>?key=value` (works on `file://`, where path routing needs a
  server); unknown route → home dashboard; role-gated routes go through `can()` (rules from
  client-portal-permissions / ai-safety-and-permissions); the `client` role has its own route set (portal
  dashboard, client floor plan, documents, comments).
- Components in `js/ui.js`: `drawer` (right side, does not leave the plan, sections per 00_MASTER_PROMPT.md
  §15, Escape closes, width by viewport, mobile = full-width sheet), `modal` (confirmations with preview for
  the destructive actions listed by ai-safety-and-permissions), `toast`, `table` (compact rows, sortable
  columns, sticky header, horizontal scroll inside a viewport container so wide tables never break the
  page), `filters` (the §26 set as controls; active chips with individual remove and Reset All), `badge`,
  `kpiCard` (`n/a` with a reason when inputs are missing, denominator shown, brief D6), `emptyState`
  (explicit text, never a blank panel), `svgBar`/`svgStackedBar`/`svgDonut` inline SVG primitives (brief
  D14, no Chart.js), `provMark`, `esc()`, `fmtArea`/`fmtMoney`/`fmtDate`: money from cents with NBSP
  thousands separators, `rentUnit` and `currency` from the record or `js/config.js` (brief D20).
- i18n: `t(key)` with EN base and RU in `data/i18n.js` (brief D3); keys namespaced by screen (`units.title`,
  `drawer.commercial.askingRent`, `status.contract_signed`); missing key → EN value → key with a development
  warning; language persisted in `caseos-lsp-ui` (brief D9); no user-facing string hard-coded in views. CASE
  OS precedent: `const t=k=>(I18N[LANG][k]||I18N.ru[k]||k)` in `os/core.js` line 20; LSP keeps the call
  shape with EN as base. UZ strings later may reuse the `v4660-uz-translit.js` approach (Document 13).
- Responsive layout for the brief D10 viewports (1920×1080, 1440×900, 1366×768, 1024×768, 820×1180,
  390×844): collapsible navigation, drawer as sheet under the tablet breakpoint, tables scroll, floor plan
  replaced by unit list + drawer with an "Open plan" action on narrow screens (brief D8; the plan itself is
  owned by interactive-floorplan-engineer). Mobile keeps quick lookup, comments, tasks and deal updates
  usable (00_MASTER_PROMPT.md §48).
- Print base in `css/lsp.css` `@media print`: hide navigation, drawers, toasts and controls; expand table
  viewports; page-break rules; light tokens forced; provenance marks remain legible in monochrome.
  Report-specific print rules stay with reporting-and-dashboard-analyst; plan-and-legend-on-one-page with
  interactive-floorplan-engineer.
- Accessibility basics: real `<button>` elements, `aria-label` on icon-only controls, focus return after
  drawer/modal close, visible focus ring, keyboard access to primary actions, status conveyed by text and
  pattern as well as color.
- Hand-offs: floor-plan rendering, modes and legends → interactive-floorplan-engineer; KPI card content and
  report print rules → reporting-and-dashboard-analyst; portal content rules and client drawer whitelist →
  client-portal-permissions; untrusted-content rules behind `esc()` → ai-safety-and-permissions; entity
  field lists for drawers and tables → the owning data skills; standalone bundle script, Playwright checks
  and screenshots → testing-and-qa.

## Inputs

Planning documents (`docs/leasing-platform/`): `09_IMPLEMENTATION_PLAN.md` (file breakdown, phases,
definition of done), `01_PRODUCT_SPEC.md` (the 22 screens of 00_MASTER_PROMPT.md §63 and what "implemented"
means), `04_ROLES_AND_VISIBILITY.md` (role-based UI differences, client route set),
`05_STATUSES_STAGES_AND_CONFIG.md` (status entries with `color`, `textColor`, `pattern`; category colors),
`06_FLOORPLAN_ARCHITECTURE.md` (drawer contract, mobile fallback), `07_CALCULATIONS_AND_KPI_RULES.md` (which
KPI cards show denominators and `n/a`), `13_CASE_OS_v4731_REUSE.md` (provenance chip, `cents()`, translit
patterns portable with attribution; packaging limits), `10_QA_PLAN.md` (viewports, DOM hooks),
`00_MASTER_PROMPT.md` §3.5, §13, §15, §25, §26, §27, §32, §43, §46, §48, §62, §63, §65, §67.

LSP sources (`os/leasing/`): `index.html`, `css/lsp.css`, `js/ui.js`, `data/i18n.js` (owned);
`js/views/*.js` (conventions owned, content shared with owning skills); `js/state.js` (state-change event,
save indicator states, `caseos-lsp-ui`), `js/config.js` (status/category colors, currencies, units,
notification rules), `js/services.js` (read-only data for rendering), `js/floorplan.js` (drawer integration
point).

CASE OS reference, read only: `os/index.html` (tokens line 18, `body.dark` line 286, login/app container
layout), `os/core.js` (`t()`/`I18N` line 20, `toast()` line 136, `go()` router, inline `onclick=` pattern to
avoid), `os/v4450-owner-report.js` (`@media print` block), `os/.htaccess` (CSP: LSP loads no external
script); from the live build v4.73.1 via Document 13: `os/v4710-provenance.js` (`provChip`,
icon+frame+word), `os/v4670-offer-pricing.js` (`cents()`, NBSP separators).

## Outputs

- `os/leasing/index.html`, `css/lsp.css`, `js/ui.js`, `data/i18n.js`; view-file skeleton and conventions for
  `js/views/*.js`.
- UI conventions section for `09_IMPLEMENTATION_PLAN.md` (when assigned): component inventory, `data-action`
  naming table, route table, breakpoints, token list, print rules, size budget per file.
- DOM hooks for testing-and-qa: `data-view` on the active view root, `data-action` on every control,
  `data-id`/`data-entity` on rows and cards, `data-drawer` on the open drawer, `data-save-state` on the save
  indicator, `data-lang` and `data-theme` on `<body>`, `data-prov` on provenance marks,
  `data-unit-id`/`data-mode`/`data-legend-key` kept from interactive-floorplan-engineer.
- i18n key inventory (EN/RU) with the screen that uses each key; keys with missing RU marked for the team.
- Screenshot set per viewport for the change note (produced with the testing-and-qa sweep script).

## Constraints

- Brief D2, D18: no build step, no framework, no external runtime dependency, no bundled fonts or images;
  all assets via `<script src>`/`<link>`; the app runs from `file://`, as the standalone bundle, and under
  the `os/.htaccess` CSP; `os/leasing/` stays within 1.5 MB.
- Brief D14 and 00_MASTER_PROMPT.md §48: professional, dense-but-clean; no gradients, glassmorphism, gaming
  UI or decorative animation; subtle motion only for drawer/toast; CASE red as accent only.
- Brief D5, D16 and 00_MASTER_PROMPT.md §12, §44: status and category colors come from config; provenance
  and status are conveyed by icon, frame or pattern and word, never color alone.
- Brief D3: all strings through `t(key)`; EN base, RU shipped; default EN.
- 00_MASTER_PROMPT.md §63, §69: no fake buttons or empty destinations; unimplemented screens are labeled
  "future" with controls disabled and a reason.
- 00_MASTER_PROMPT.md §3.5, §25: one `appState`; all views re-render from it; no view-local business data.
- Brief D6, D20: KPI cards show `n/a` and the denominator, never `0` for missing input; money rendered from
  cents with the record's `currency`/`rentUnit`.
- Brief D19: `esc()` for HTML, `textContent`/`createElementNS` for SVG; no string-built markup from registry
  data.
- Brief D1, D11: no CASE OS file is modified; `LSP_VERSION` only in `os/leasing/index.html`; `APP_VERSION`
  and `sw.js` untouched.
- Writing rules: FACTS cite `00_MASTER_PROMPT.md §n` or the CASE OS file; ASSUMPTIONS A-n; RECOMMENDATIONS
  with `Q-n`; English; no model identifiers or session links in repository files.

## Validation checklist

- [ ] `grep -rc "onclick=" os/leasing` returns 0; `grep -rn "addEventListener('click'" os/leasing/js` shows
      the app-root listener (and the plan-host listener of interactive-floorplan-engineer) only.
- [ ] Every `data-action` value in `index.html` and `js/views/*.js` has a handler in the action map; an
      unknown action warns in the console; no control is inert.
- [ ] All user-facing strings in `js/views/*.js`, `js/ui.js` and `index.html` come from `t()`; switching
      EN/RU re-renders the current view and persists in `caseos-lsp-ui`.
- [ ] No CSS rule encodes a status or category color; changing a status color in Settings updates plan,
      table badges, legends and dashboard without reload.
- [ ] Light and dark: every status/category fill has readable label text and a non-color indicator;
      provenance marks show icon, frame and word; contrast checked on the demo dataset in both themes.
- [ ] Drawer opens from the plan and the units table without navigation, shows the §15 sections, closes on
      Escape, returns focus; internal and client drawers are different components.
- [ ] Filters render the §26 set, show active chips with individual remove and Reset All, and the URL hash
      reflects the filter state.
- [ ] Tables scroll horizontally inside their viewport container at 1024×768 and 390×844; no page-level
      horizontal scroll; no clipped text at any D10 viewport.
- [ ] Narrow screens show the unit list + drawer with an "Open plan" action instead of the full plan; nav
      collapses; quick actions (comment, task, deal update) reachable in two taps.
- [ ] `@media print` hides nav/drawer/toast/controls, tables expand, headings do not orphan; browser Save as
      PDF of the dashboard produces no clipping; marks legible in monochrome.
- [ ] Save indicator cycles Saving → Saved on edit and shows Unsaved with a `beforeunload` guard when a save
      is pending; the §6.1 sentence and the DEMO DATA banner are visible.
- [ ] A unit code or brand name containing `<b>x</b>` renders as literal text in tables, drawer, tooltips
      and SVG labels.
- [ ] Page opens from `file://` and as `LSP_standalone.html` with no console error and no failed local
      request; `du -sb os/leasing` is within the D18 budget; no CASE OS file changed.

## Prohibited behavior

- Adding a framework, bundler, CSS preprocessor, icon font CDN, Chart.js, bundled font or image files, or
  any external runtime dependency.
- Inline `onclick=`/`on*=` attributes, per-render `addEventListener` calls, or handlers duplicated across
  views.
- Hard-coding status or category colors, stage names, currencies or units in CSS or view code instead of
  reading `js/config.js`.
- Hard-coding user-facing strings, or shipping an RU-only or EN-only screen.
- Placeholder buttons, empty screens presented as complete, or "coming soon" destinations without the
  "future" label and disabled controls.
- Keeping filtered/sorted copies of business data in view modules instead of deriving them from `appState`
  on render.
- Showing `0` for missing values, hiding the denominator on KPI cards, or conveying provenance or status by
  color alone.
- Building SVG or HTML markup by string concatenation of registry data, or bypassing `esc()`.
- Gradients, glassmorphism, decorative animation, marketing-style cards or oversized whitespace that reduces
  rows per screen.
- Forcing the full desktop floor plan onto phone widths, or letting a table break the page layout.
- Modifying `os/index.html`, `os/core.js`, `os/sw.js`, `os/v*.js` or any other CASE OS file; changing
  `APP_VERSION`.

## Examples

**Task:** "Build the unit drawer component."
**Expected behavior:** Reads `06_FLOORPLAN_ARCHITECTURE.md` and `01_PRODUCT_SPEC.md`, implements
`drawer.open({entity:'unit', id})` in `js/ui.js` with the §15 sections Summary / Commercial / Deal /
Contacts / Documents / Activity timeline / Actions as tabs, each field list taken from the owning skills'
documents, `provMark` beside area and rents, actions as `data-action="unit.changeStatus"` wired to the
delegated listener, `esc()` on every value, Escape to close, sheet mode under the tablet breakpoint, and a
separate `clientDrawer` fed only by `clientView(projectId)`. Hands DOM hooks to testing-and-qa.

**Task:** "Status labels are unreadable on the plan in dark mode."
**Expected behavior:** Confirms the fill and `textColor` come from `js/config.js`, adjusts the dark-theme
`textColor`/`pattern` values in `DEFAULT_CONFIG` (not a CSS override), verifies legend, table badges and
dashboard use the same entry, re-checks contrast in both themes at 1440×900 and 390×844, and records the
changed config values as a `Q-n` for `05_STATUSES_STAGES_AND_CONFIG.md`.

**Task:** "Add the §26 filters to the Units table with chips."
**Expected behavior:** Implements the filter controls with the `filters` component, encodes the state in the
hash, renders active chips with individual remove and Reset All, derives rows via `js/services.js` query
functions on each render (no cached copy), adds `t()` keys for every label in EN and RU, checks 1024×768 and
390×844 layouts, and names the checks (`LSP-QA-nnn`) for testing-and-qa.

