# 03 – Information architecture & interface specification

**Document:** `geo-mvp/docs/03-information-architecture.md`
**Brief step:** §65 Step 3 ("Propose the information architecture and major interface regions").
**Authoritative source:** `geoanalytics_html_mvp_master_prompt.md`. All `§` references are to that brief.
**Upstream documents this one obeys:** `01-product-spec.md` (binding scope, rules R1–R10, acceptance criteria),
`02-brief-critique.md` (resolutions C1–C13, M1–M14), `10-visual-system.md` (tokens, motion table, chart specs).
**Status:** binding. An implementer builds the shell from this document without re-reading the brief.

### Conventions used throughout

| Tag | Meaning |
|---|---|
| **[NOW]** | Built and fully working in this prototype. Covered by §29 "no fake buttons". |
| **[ARCH]** | Structure, slot, registry entry or interface exists; behaviour deliberately not built. Rendered **disabled with a stated reason** – never hidden, never inert-but-enabled. |
| **[OUT]** | Not present in any form. Listed only where an implementer might expect it. |

Every control ID in this document (`H-03`, `L-18`, `P-04`…) is stable and is the QA handle for §29/X-4
("enumerate every control; each must act or be disabled with a visible reason").

Seed-state numbers quoted here (148 records, 16 with class+rent, 132 without class, 12 districts, 6 duplicate
pairs, completeness 0 complete / 16 partial / 132 sparse) come from `01-product-spec.md §0` and must be
**computed at runtime**, never hard-coded in the UI.

---

## 1. Region map of the application shell (§7)

### 1.1 The governing decision

§7 lists seven surfaces: header, left filter panel, map, property drawer, AI assistant panel, analytics drawer,
AI layers panel. Rendered simultaneously on a 1440 px screen (≈300 px left + 2 × ≈400 px right) the map is left
under 400 px, which violates §24 ("large usable map", "avoid crowded dashboards"). `02-brief-critique.md` C9
resolves this and the resolution is binding here:

> **§7 is an inventory of surfaces, not a simultaneous layout.**
> One left rail (Filters / Results as tabs) + one right rail hosting **Property, Analytics, AI, Layers as four
> mutually exclusive tabs**. At most two panels are open at once. Compare and the Data workspace are modal
> overlays, not rails. This is also the only arrangement that degrades cleanly to the §26 mobile sheets.

The direct consequence, which answers the design question explicitly: **the AI panel and the property drawer can
never be open at the same time, at any viewport width, because they are two tabs of one rail.** Selection is not
lost when the user switches to the AI tab – the marker stays highlighted, the list row stays active, and the AI
tab shows a context chip `Context: <property name>` (§44). This is a feature, not a limitation: it makes the
"AI knows what you have selected" model visible rather than requiring two panels to be visually correlated.

### 1.2 Region inventory

| # | Region | Tag | Purpose | Default state | Opened by | Closed by | z-index | May coexist with |
|---|---|---|---|---|---|---|---|---|
| **R1** | Header | [NOW] | Identity, scope selectors, global search, workspace switches, data-quality indicator | Always visible | – | – (never closes; 52 px on XS) | 40 | Everything |
| **R2** | Left rail | [NOW] | Filters **and** the results list, as two tabs. Owns the "X properties found" counter (§11, §12) | Open, `Filters` tab, on ≥1280. Collapsed to a 52 px icon strip on 1024–1279. Closed (sheet) below 1024 | Rail tab, `F` / `L`, header search "see all results", collapse toggle | Collapse toggle, `Esc` (overlay/sheet modes only), opening the right rail at <1280 | 20 | Map, right rail (≥1280), compare tray |
| **R3** | Map canvas | [NOW] | The primary workspace. Never closes, never fully occluded above 768 px | Always visible, fitted to all records | – | – | 0 (own stacking context) | Everything |
| **R4** | Map control cluster | [NOW] | Zoom, fit, reset, fullscreen, layers, legend, scale, attribution – overlaid on R3 | Visible; legend collapsed on <1024 | – | – | 10 | Everything |
| **R5** | Right rail | [NOW] | Four tabs: **Property · Analytics · AI · Layers** (§13, §14, §40, §57) | Closed | Selecting a property, header Analytics/AI buttons, tab keys `1`–`4`, "Analyze location", AI "open layers" | Rail close button, `Esc`, deselecting | 20 | Map, left rail (≥1280), compare tray |
| **R6** | Compare tray | [NOW] | Persistent evidence that N properties are staged for comparison (§15) | Hidden while `compare.length === 0` | Adding a property to compare | "Clear" or removing the last item | 30 | Everything except modal overlays |
| **R7** | Compare overlay | [NOW] | The 2–4 column, 13-row comparison table (§15) | Closed | Tray "Compare (n)", `C`, AI `compare_properties` | Close button, `Esc`, backdrop click | 90 (backdrop 80) | Modal – rails are `inert` behind it |
| **R8** | Data workspace | [NOW] | Admin/data editor **and** data-quality home: Records · Coverage · Quality · Duplicates · Local changes · Import/Export (§19, §21, M4, M12, M14) | Closed | Header `Data`, header data chip, property `Edit`, AI "show data quality" | Close button, `Esc` (with unsaved-changes guard) | 90 (backdrop 80) | Modal – rails are `inert` behind it |
| **R9** | Dialogs | [NOW] | Confirm, import report, storage recovery, keyboard shortcuts, field provenance detail | Closed | Their triggers | Confirm/Cancel, `Esc`, backdrop click (except the storage-recovery dialog, which is non-dismissible) | 90 | Modal – stacks above R7/R8 |
| **R10** | Notice bar | [NOW] | Persistent non-blocking system state (storage unavailable, tiles offline, schema notice) | Hidden | System conditions only | Its own dismiss button, or the condition clearing | 95 | Everything |
| **R11** | Toasts | [NOW] | Transient confirmations with an inline undo (§ M1) | Hidden | Actions | Auto after 6 s, or dismiss | 100 | Everything |
| **R12** | Mobile tab bar | [NOW] | Bottom navigation below 768 px: Map · List · Analytics · AI · Data | Visible only <768 px | – | – | 40 | Sheets |
| **R13** | Boot/recovery screen | [NOW] | Pre-init failure surface (schema mismatch, corrupt storage) – M2/M3 | Hidden | Boot check failure | Its own action buttons | 110 | Nothing (blocks the app) |

`R9` regions that are *not* dialogs are never given `role="dialog"`. See §6.3 for the exact rule about when a rail
is a region and when it is a dialog – getting this wrong is the most common accessibility failure in this layout.

### 1.3 Per-region detail

**R1 Header** – full control list in §3. Height 56 px (≥768) / 52 px (<768). Never scrolls. Contains the only
`aria-live="polite"` node that announces dataset-level changes (`H-08`).

**R2 Left rail.** One surface, tab bar at the top with exactly two tabs:

| Tab | Label (EN) | Content | Notes |
|---|---|---|---|
| `filters` | `Filters` | §11 filter set: name search, district, class, status, GLA, rent, occupancy/vacancy, parking, amenities, confidence, completeness, duplicates, entity review; active-filter chips; result counter; Reset; More filters | Zero-coverage filters render **disabled with their count** (rule R2 of `01`) |
| `results` | `Results · 148` | Virtual-free list of result cards (§12) with a sort control and a compare checkbox per card | The count in the label is the §11 "X properties found" figure and is `aria-live="polite"` |

The tab selection **is** the §12 view mode: `filters` ⇒ view `map`, `results` ⇒ view `map+list`. There is no
second view-mode control anywhere (avoiding two controls for one state), except the mobile tab bar `R12`, which
writes the same state.

**R3 Map canvas.** Given `position: relative; z-index: 0; isolation: isolate` so that Leaflet's internal
z-indexes (panes 200–700, controls 800, popups 700) are confined to the map's own stacking context and can never
paint over app chrome. This single rule removes the entire class of "Leaflet control on top of my drawer" bugs.

**R4 Map control cluster.** Top-right stack (44 px square buttons, 8 px gap, 12 px inset): zoom in, zoom out,
fit to results, reset view, fullscreen, layers. Bottom-left: collapsible legend card (class ramp + confidence
scale + "not recorded" hatch, per `10-visual-system.md` §3–§5). Bottom-right: Leaflet scale bar and attribution.
The **Layers** button does not open its own popover – it opens the right rail `Layers` tab, so "layers" exists in
exactly one place (base layers and analysis layers in one list).

**R5 Right rail.** Tab bar with four tabs; a close button; a body that scrolls independently.

| Tab | Label | Opened automatically when | Empty state |
|---|---|---|---|
| `property` | `Property` | A property is selected (map marker, list card, search result, compare column, AI `select_property`) | "No property selected. Choose a building on the map or in the results list." |
| `analytics` | `Analytics` | Header `Analytics`, chart-driven AI results | Never empty – always shows cards with denominators (§14) |
| `ai` | `Assistant` | Header `AI`, property action "Ask AI about this property" | Suggested prompts (§40) |
| `layers` | `Layers` | Map layers button, AI layer creation, "Save as layer" | Base layers always listed; analysis layers section shows "No analysis layers" |

**R6 Compare tray.** 52 px bar docked bottom-centre of the map area (bottom-left of the sheet stack on mobile),
showing up to 4 chips + `Compare (n)` + `Clear`. It exists so the compare set is never invisible state.

**R7 Compare overlay.** Centred dialog, `min(1100px, 94vw)` × `min(760px, 90vh)`. Columns are horizontally
scrollable below 900 px; the row-label column is `position: sticky; left: 0`.

**R8 Data workspace.** Full-bleed overlay, `min(1320px, 96vw)` × `min(900px, 92vh)`, with a 200 px left sub-nav
(6 items) and a content area. On <1024 px the sub-nav becomes a horizontal scrolling tab strip. This is the
§34 "Internal Geoanalytics User" home screen and is hidden entirely in the External role (X-9).

### 1.4 Panel-collision rules (binding)

| ID | Rule |
|---|---|
| **P1** | The map canvas is never narrower than **560 px** at ≥1280, **520 px** at 1024–1279. Any state change that would break this must first collapse or close a rail. |
| **P2** | At **1024–1279 px**, opening the right rail collapses the left rail to its 52 px icon strip. The previous left-rail width is remembered and restored when the right rail closes. The user may re-expand the left rail manually; doing so at this width closes the right rail (the rails swap, they never squeeze). |
| **P3** | At **768–1023 px** both rails are **overlay drawers** over the map with a 40 % ink scrim. At most one is open. Opening one closes the other. |
| **P4** | Below **768 px** every panel is a **bottom sheet**; exactly one sheet is open at a time; opening a new sheet replaces the current one. `Esc` / backdrop / swipe-down returns to the bare map. |
| **P5** | Overlays (`R7`, `R8`, `R9`) are modal at every breakpoint. While one is open, `R1`, `R2`, `R4`, `R5`, `R6`, `R12` receive the `inert` attribute and `aria-hidden="true"`; they stay mounted so state and map viewport survive. |
| **P6** | Selecting a property always routes to the right rail `Property` tab; if the rail is closed it opens; on <768 it opens the property sheet at peek height (45 vh). Selecting never closes the left rail at ≥1280. |
| **P7** | When the assistant changes filter state while the left rail is collapsed/closed, the app **never auto-expands** the rail (jarring, and it hides the map). It shows a toast `Filters updated by the assistant` with a `View filters` action, and the left-rail tab shows a 6 px `--case-red` dot until the Filters tab is next viewed. This satisfies §59 ("manual controls reflect AI-applied filters") without stealing the viewport. |
| **P8** | `R7` and `R8` are mutually exclusive with each other; opening one closes the other. `R9` dialogs stack above both, maximum stack depth 2 (e.g. Data workspace → delete confirm). A third would indicate a design error. |
| **P9** | Fullscreen map (`M-08`) closes the right rail and collapses the left rail; exiting restores both to their prior state. |

**Worked answers to the collision questions posed by the brief's layout:**

- *1280 px, AI panel + property drawer simultaneously?* – No. They are tabs of `R5`; only one renders. Selection
  persists and is surfaced in the AI tab's context chip.
- *1280 px, filters + property drawer simultaneously?* – Yes. `300 + 560 + 420 = 1280` exactly meets P1.
- *1024 px, filters + analytics simultaneously?* – Only with the left rail collapsed to icons (P2):
  `52 + 572 + 400 = 1024`.
- *768 px, anything + anything?* – No. One overlay drawer at a time (P3).
- *480 px?* – One sheet at a time over a full-bleed map, with the bottom tab bar as the switcher (P4).

### 1.5 z-order scale (exact)

```css
:root{
  --z-map:0;          /* R3 – own stacking context; Leaflet's 200-800 is contained inside it */
  --z-map-chrome:10;  /* R4 map buttons, legend, scale */
  --z-rail:20;        /* R2, R5 when docked */
  --z-tray:30;        /* R6 */
  --z-header:40;      /* R1, R12 */
  --z-popover:50;     /* header menus, settings, provenance popovers, tooltips */
  --z-scrim:60;       /* overlay-rail and sheet backdrop */
  --z-sheet:70;       /* R2/R5 in overlay-drawer or sheet mode */
  --z-modal-scrim:80; /* R7, R8, R9 backdrop */
  --z-modal:90;       /* R7, R8, R9 */
  --z-notice:95;      /* R10 */
  --z-toast:100;      /* R11 */
  --z-boot:110;       /* R13 – blocks everything */
}
```

Nothing in the codebase may use a raw z-index literal; only these tokens. QA: `grep -n 'z-index: *[0-9]' src/`
returns only the token definitions.

---

## 2. Desktop layout and responsive structure (§26)

### 2.1 Shell structure

The shell is **one grid inside one grid**. No absolute positioning is used for layout (only for overlays).

```html
<a class="skiplink" href="#results">…</a>          <!-- H-14 -->
<div class="notice" role="status" hidden>…</div>   <!-- R10 -->
<div class="app" data-view="map" data-left="open" data-right="closed" data-bp="xl">
  <header class="app__header" role="banner">…</header>              <!-- R1 -->
  <div class="app__body">
    <aside class="rail rail--left"  role="region" aria-label="Filters and results">…</aside>   <!-- R2 -->
    <main class="mapwrap" role="main">                              <!-- R3 + R4 -->
      <div id="map" role="application" aria-label="Map of business centres"></div>
      <div class="mapchrome">…</div>
      <div class="tray" hidden>…</div>                              <!-- R6 -->
    </main>
    <aside class="rail rail--right" role="region" aria-label="Detail panel" hidden>…</aside>   <!-- R5 -->
  </div>
  <nav class="tabbar" aria-label="Sections">…</nav>                 <!-- R12, <768 only -->
</div>
<div class="overlays">…</div>                                       <!-- R7 R8 R9 R11 -->
```

```css
.app{
  display:grid;
  grid-template-rows:var(--header-h) 1fr;
  height:100dvh;                 /* dvh: mobile browser chrome must not create a scrollbar */
  overflow:hidden;               /* the page never scrolls; only panel bodies scroll */
}
.app__body{
  display:grid;
  grid-template-columns:var(--left-w) minmax(var(--map-min),1fr) var(--right-w);
  min-height:0;                  /* without this the grid children refuse to scroll */
  transition:grid-template-columns var(--dur-panel) var(--ease-panel);
}
.rail{min-height:0; overflow:hidden; display:flex; flex-direction:column;}
.rail__body{overflow-y:auto; overscroll-behavior:contain; flex:1; min-height:0;}
.mapwrap{position:relative; z-index:var(--z-map); isolation:isolate; min-width:0;}
```

Rail open/close is a **track-width animation** (`grid-template-columns` is animatable between fixed lengths), not
a transform – so the map resizes as the panel moves and Leaflet gets a single `invalidateSize()` call on
`transitionend` rather than 60 calls during the animation.

### 2.2 Breakpoints and exact track widths

| Breakpoint | Range | `--header-h` | `--left-w` open / collapsed | `--right-w` open | `--map-min` | Map width with both open |
|---|---|---|---|---|---|---|
| **XXL** | ≥1920 px | 56 px | 360 / 52 | 520 | 640 | 1040 px |
| **XL** | 1440–1919 px | 56 px | 320 / 52 | 440 | 560 | 680 px @1440 |
| **L** | 1280–1439 px | 56 px | 300 / 52 | 420 | 560 | **560 px @1280 (exactly at the floor)** |
| **M** | 1024–1279 px | 56 px | 280 / 52 | 400 | 520 | 572 px @1024 **with left collapsed (P2)** |
| **S** | 768–1023 px | 56 px | 320 (overlay) | 400 (overlay, max 86vw) | full width | full width (rails float) |
| **XS** | 481–767 px | 52 px | sheet | sheet | full width | full width |
| **XXS** | ≤480 px | 52 px | sheet | sheet | full width | full width |

```css
:root{ --header-h:56px; --left-w:320px; --left-w-collapsed:52px; --right-w:0px; --map-min:560px; --tabbar-h:0px; }
@media (min-width:1920px){ :root{ --left-w:360px; --map-min:640px; } .app[data-right="open"]{ --right-w:520px; } }
@media (min-width:1440px) and (max-width:1919px){ .app[data-right="open"]{ --right-w:440px; } }
@media (min-width:1280px) and (max-width:1439px){ :root{ --left-w:300px; } .app[data-right="open"]{ --right-w:420px; } }
@media (min-width:1024px) and (max-width:1279px){ :root{ --left-w:280px; --map-min:520px; } .app[data-right="open"]{ --right-w:400px; } }
.app[data-left="collapsed"]{ --left-w:var(--left-w-collapsed); }
.app[data-left="closed"]  { --left-w:0px; }

/* S – rails leave the grid and float over the map */
@media (max-width:1023px){
  .app__body{ grid-template-columns:1fr; }
  .rail{ position:fixed; top:var(--header-h); bottom:0; width:min(400px,86vw); z-index:var(--z-sheet);
         box-shadow:0 8px 24px rgba(26,23,20,.12); transform:translateX(-100%); }
  .rail--right{ right:0; left:auto; transform:translateX(100%); }
  .rail[data-open="true"]{ transform:none; }
}

/* XS/XXS – sheets + bottom tab bar; nothing is a narrow copy of the desktop panel */
@media (max-width:767px){
  :root{ --header-h:52px; --tabbar-h:56px; }
  .app{ grid-template-rows:var(--header-h) 1fr var(--tabbar-h); }
  .rail{ top:auto; left:0; right:0; width:100%; border-radius:12px 12px 0 0;
         height:var(--sheet-h,72dvh); transform:translateY(100%);
         padding-bottom:env(safe-area-inset-bottom); }
  .rail[data-open="true"]{ transform:none; }
}
```

### 2.3 The mobile transformation (§26 – "panels become drawers/sheets, not shrunken panels")

Below 768 px the interface is re-composed, not re-scaled:

| Desktop region | Mobile form | Snap points (`--sheet-h`) | Notes |
|---|---|---|---|
| Header (R1) | 52 px bar: wordmark, search icon (expands to full-width overlay search), data chip, settings | – | City/asset selectors move into the settings sheet; they carry one value each |
| Left rail · Filters | Bottom sheet, drag handle | 88 dvh only | Sticky footer holds `Show 148 results` (primary) + `Reset` |
| Left rail · Results | Bottom sheet, drag handle | 32 / 68 / 94 dvh | Peek height shows 2 cards so the map stays the hero; the map pans to the card under the finger on scroll-stop |
| Right rail · Property | Bottom sheet, drag handle | 45 / 92 dvh | Peek shows name, class, district, confidence, and the 5 action buttons |
| Right rail · Analytics | Full-height sheet | 100 dvh − header | Charts drop to one column, 260 px tall |
| Right rail · Assistant | Full-height sheet | 100 dvh − header | Input docked to the bottom above the keyboard (`interactive-widget=resizes-content` in the viewport meta) |
| Right rail · Layers | Bottom sheet | 60 dvh | |
| Compare tray (R6) | Pinned above the tab bar, 44 px | – | |
| Compare overlay (R7) | Full-screen; table scrolls horizontally, first column sticky | – | ≤480 px: property-per-page with a `1 / 3` pager instead of side-by-side |
| Data workspace (R8) | Full-screen; sub-nav becomes a horizontal scrolling strip | – | The Records table becomes a card list; the edit form is one column |
| Mobile tab bar (R12) | `Map · List · Analytics · AI · Data` | – | Writes the same state as the desktop rail tabs; `Map` closes all sheets |

Hard requirements at ≤480 px (X-8): no horizontal page scroll; no clipped text; minimum touch target 44 × 44 px;
sheets never cover more than 94 dvh so the map is always partly visible as an orientation anchor; every sheet has
a visible drag handle **and** a close button (drag is never the only way out).

### 2.4 Density and scroll rules

- The page itself never scrolls (`overflow:hidden` on `.app`). Only `.rail__body`, overlay bodies and the
  results list scroll, each with `overscroll-behavior: contain`.
- The results list renders all 148 cards with `content-visibility:auto; contain-intrinsic-size:0 92px` – no
  virtual scroller is needed at this dataset size, and none may be added (§2.6 clarity over machinery).
- Sticky within the left rail: tab bar (top), result counter + Reset (bottom, 48 px). Sticky within the right
  rail: tab bar (top), property action row (top of the Property tab body, below the title block).

---

## 3. Header (R1) contents (§8)

| ID | Control | Type | States | Behaviour (exact) |
|---|---|---|---|---|
| **H-14** | `Skip to results` | Link, first in DOM | Visually hidden until focused | Moves focus to the results list (`#results`); if the left rail is closed/collapsed it opens on the `results` tab first. [NOW] |
| **H-01** | Wordmark | Static text, `GEO.PRODUCT.name` | – | Not interactive, not focusable. DM Serif Display 20 px. Rendered from the single product-name constant (`01` §2). |
| **H-02** | `WORKING TITLE` chip | Static `<span role="note">` with `aria-label` and `title` | Renders only when `GEO.PRODUCT.provisional === true` | Not a button – no click behaviour, so §29 does not apply. Text: "Product name not final". |
| **H-03** | City selector | Menu button `Tashkent ▾` | Closed / open; `aria-expanded`, `aria-haspopup="menu"` | Opens a menu: **Tashkent** (`aria-checked="true"`), then Samarkand, Bukhara, Fergana, Andijan, Namangan each `disabled` with the trailing reason `Not in this version`. Footer note: "Additional cities are supported by the data model but not loaded in this prototype." [NOW menu / ARCH entries] (§3, `01` A1, C11) |
| **H-04** | Property-type selector | Menu button `Business Centers ▾` | as H-03 | Menu: **Business Centers** selected; Shopping Centres, Street Retail, Warehouse, Hotel, Land, Mixed-use each `disabled · Not in this version`. (§4, `01` A2) |
| **H-05** | Global search | `<input type="search" role="combobox">` 320 px, 420 px on focus | empty / typing / results / no-results | Debounce 120 ms; searches name, address, district, tenant over the folded index (rule R6: diacritic + Cyrillic↔Latin homoglyph folding). Renders a `listbox` of ≤8 options grouped `Properties` / `Districts`, each row showing name · district · class badge. ↑/↓ move, `Enter` activates, `Esc` closes then clears. Activating a property: selects it, opens the right rail Property tab, pans+zooms the map to z16 (§18). Activating a district: applies that district filter and fits the map to it. A `See all N results` row appears when N > 8 and switches the left rail to the `results` tab with the search term applied as the name filter. [NOW] |
| **H-06** | Search clear | Icon button inside H-05 | Present only when the field is non-empty | Clears the field and the derived name filter; returns focus to H-05. [NOW] |
| **H-07** | Search result row | `option` | hover / active-descendant | See H-05. [NOW] |
| **H-08** | Data-quality indicator | Chip button, `aria-live="polite"` | default / edited | Text at seed: `148 records · 1 source · updated 19 Jul 2026 · 0 field-verified`. Recomputed on every dataset mutation; after a local edit it appends ` · N locally edited` (X-11). Click opens the Data workspace on the **Coverage** tab. Tooltip gives the §19 definitions of the four counters. [NOW] |
| **H-09** | `Analytics` | Toggle button | pressed / unpressed (`aria-pressed`) | Opens the right rail on the `analytics` tab; pressing again closes the rail. Keyboard `2`. [NOW] (§14) |
| **H-10** | `Assistant` | Toggle button | pressed / unpressed | Opens the right rail on the `ai` tab; pressing again closes it. Keyboard `3`. Shows a `--case-red` dot when the last assistant response has not yet been viewed. [NOW] (§40) |
| **H-11** | `Data` | Button | enabled (Internal) / hidden (External) | Opens the Data workspace (R8) on its last-used sub-tab, default `Records`. Keyboard `D`. [NOW] (§21) |
| **H-12** | Language selector | Menu button `EN ▾` | open / closed | Menu lists `English` (selected), `Русский` and `Oʻzbekcha` **disabled** with the reason `Translation 0% – English only in this build`. The percentage is computed live from the i18n coverage function (§9.6), so the entries enable themselves the moment a dictionary is filled. [NOW control / ARCH locales] (§27, `01` A9) |
| **H-13** | Settings | Icon button → popover | open / closed | Popover contents S-01…S-08 below. [NOW] |

**Settings popover**

| ID | Control | Behaviour |
|---|---|---|
| **S-01** | Language | Mirrors H-12 (same state, same disabled logic). |
| **S-02** | Role: `Internal` / `External` | Segmented control. Switching to External hides H-11, the Data workspace, `_note`/internal comment fields, the property `Edit` action, and every AI tool whose registry entry declares `access:'internal'`. A banner reads `External (client preview) – internal data hidden`. Switching back restores everything. Product-model test only, not security (X-9, §60). [NOW] |
| **S-03** | Motion: `Match system` / `Reduce` / `Full` | Writes `data-motion` on `<html>`; `Match system` defers to `prefers-reduced-motion`. Persisted. (§25) [NOW] |
| **S-04** | Map marker encoding | Select: `Office class` (default) · `Data confidence` · `Completeness`. Re-renders markers and the legend. (critique C6a) [NOW] |
| **S-05** | `Restore original dataset` | Confirm dialog naming what is lost. Discards local record edits, keeps AI session and layers. (M3) [NOW] |
| **S-06** | `Full reset` | Confirm dialog. Clears every `geo.mvp.v1.*` key and reloads. (M3) [NOW] |
| **S-07** | `Keyboard shortcuts` | Opens the shortcuts dialog (`?`). [NOW] |
| **S-08** | About | Static block: product name, "Prototype – not a production system", dataset provenance line, schema version, assembler build hash. Not interactive. |

---

## 4. Navigation and view modes (§12)

### 4.1 There are exactly three navigation axes

1. **Left-rail tab** – `filters` \| `results`. This *is* the §12 view mode: `map` \| `map+list`.
2. **Right-rail tab** – `property` \| `analytics` \| `ai` \| `layers`, plus rail open/closed.
3. **Overlay** – `null` \| `compare` \| `data` \| `dialog:*`.

No other navigation exists. There are no routes, no pages, no wizard steps, no back-stack other than the overlay
stack and the browser hash (§4.4).

### 4.2 UI state object (single source of truth)

```js
GEO.state.ui = {
  bp:        'xl',                 // 'xxl'|'xl'|'l'|'m'|'s'|'xs'|'xxs' – set by one matchMedia observer
  left:      { state:'open', tab:'filters', restore:'open' },  // state: open|collapsed|closed
  right:     { state:'closed', tab:'property' },
  overlay:   null,                 // null | {type:'compare'|'data'|'confirm'|'import'|'shortcuts'|'provenance', props:{}}
  overlayStack: [],                // max depth 2 (P8)
  selectedId: null,                // master_id of the selected property
  hoverId:    null,
  compare:   [],                   // ordered master_ids, max 4
  mapFullscreen: false,
  motion:    'system',             // system|reduce|full
  role:      'internal',           // internal|external
  locale:    'en'
};
// derived, never stored:
GEO.state.view = () => GEO.state.ui.left.tab === 'results' ? 'map+list' : 'map';
```

All region visibility is a pure function of this object: `render()` writes `data-*` attributes on `.app` and CSS
does the rest. No region toggles its own `style.display`.

### 4.3 Movement between workspaces – the complete transition table

| From → To | Trigger | What happens |
|---|---|---|
| Map → Map+List | Left-rail `Results` tab, `L`, mobile tab bar `List`, search `See all N results` | Left rail opens on `results`; map unchanged; nothing is deselected |
| Map+List → Map | `Filters` tab, `L`, tab bar `Map` | Left rail returns to `filters` |
| Any → Property | Marker click, cluster leaf click, list card click, search result, compare column click, AI `select_property` | `selectedId` set; right rail opens on `property` (P6); map pans if the marker is outside the current viewport (never zooms if it is already visible); list scrolls the matching card into view and marks it `aria-current="true"` |
| Property → Analytics | Header `Analytics`, `2` | Right-rail tab switches; selection retained; analytics scope is the **filtered set**, not the selection – a scope line states this explicitly |
| Property → Assistant | `Ask AI about this property` (P-03), header `Assistant`, `3` | Right-rail tab switches; the AI input is pre-filled with nothing but the context chip `Context: <name>` is shown; P-03 additionally inserts the suggested prompt "Show competitors within 3 km of <name>" into the input **without sending it** (the user stays in control) |
| Any → Compare | Tray `Compare (n)`, `C`, AI `compare_properties` | Compare overlay opens if `compare.length ≥ 2`; with 1 item the tray button is disabled and reads `Add one more to compare` |
| Any → Data workspace | Header `Data`, header data chip, property `Edit`, AI `show_data_quality` | Overlay opens on the relevant sub-tab; rails go `inert` |
| Data workspace → Map | Close, `Esc` | Overlay closes; if a record was edited, the map, filters, counter and analytics recompute before the overlay unmounts (so the user sees the change land – UX-8) |
| Any → Fullscreen map | `M-08`, `F11`-independent | Right rail closes, left rail collapses, header remains; exiting restores (P9) |
| Anywhere → default | `AI-8` "remove this analysis…", or Reset filters + deselect | Filters default, selection cleared, analysis layers removed, radii removed, map refit to all records; AI session log retained |

### 4.4 URL hash state (M9) [NOW]

The prototype's purpose is user testing, so every view must be reproducible by a link that works from `file://`.

```
index.html#v=1&view=list&rt=analytics&sel=BC-82f0eb0b80b7&cmp=BC-a,BC-b&d=mirobod,yunusobod&cls=A,A%2B&rent=,30&z=13&c=41.3110,69.2800
```

| Key | Meaning | Omitted when |
|---|---|---|
| `v` | Hash schema version (`1`) | never |
| `view` | `map` \| `list` | default `map` |
| `rt` | Right-rail tab, or absent if closed | rail closed |
| `sel` | Selected `master_id` | none selected |
| `cmp` | Compare set, comma-separated | empty |
| `d`,`cls`,`st`,`rent`,`gla`,`conf`,`cmpl`,`q` | Filter state (empty value = unbounded end of a range) | at default |
| `z`,`c` | Map zoom and centre (4 dp) | – |
| `ai` | Analysis-layer definitions, base64url of the compact criteria JSON | no layers |

Rules: the hash is written on a 400 ms trailing debounce with `history.replaceState` (never `pushState` – the
browser Back button must not become a half-working undo); it is read once at boot **after** the storage recovery
check; an unparseable hash is ignored with a toast `Link state could not be restored` and the app boots to
defaults. `index.html#reset` is reserved: it clears storage *before* app init and never restores state (M3).

---

## 5. Interaction inventory – the §29 "no fake buttons" contract

Every clickable control in the prototype appears below. **If it is listed, it must work.** A control that cannot
work in this build appears with an explicit `disabled` state *and* a user-visible reason string – that is the only
permitted alternative to working. Nothing may be inert without a reason, and no control may be added to the build
that is not in this table (add it here first).

Legend for **State**: `d` = can be disabled with a reason, `t` = toggle with `aria-pressed`/`aria-checked`,
`m` = opens a menu/popover (`aria-expanded`), `x` = destructive (requires confirm).

### 5.1 Left rail – filters (§11)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| L-01 | Tab `Filters` | tab | t | Sets `left.tab='filters'` (view `map`). Clears the P7 "changed" dot. | [NOW] |
| L-02 | Tab `Results · N` | tab | t | Sets `left.tab='results'` (view `map+list`). N is the live filtered count, `aria-live="polite"`. | [NOW] |
| L-03 | Collapse rail | icon button | t | ≥1024: toggles `open ⇄ collapsed` (52 px icon strip showing filter/results icons + an active-filter count badge). <1024: closes the drawer/sheet. Shortcut `F`. | [NOW] |
| L-04 | Property name search | text input | – | 120 ms debounce; folded match (R6) against name + alt name. Mirrors and is mirrored by H-05's term. | [NOW] |
| L-05 | District | 12 checkboxes, each `Name (count)` | – | Multi-select OR within the group, AND across groups. Counts are computed against the *other* active filters (cross-filtering) and shown greyed at `(0)` rather than hidden. Districts with a true zero (Yangihayot, Bektemir at seed) render `(0)` and are still selectable – selecting one produces the empty state E-03, not "insufficient data". Selecting districts highlights their polygons. | [NOW] |
| L-06 | Office class | 6 checkboxes: `A+ (4)`, `A (8)`, `B+ (1)`, `B (3)`, `C (0)`, `Class not recorded (132)` | – | Rule R4: the five graded options exclude unrecorded records and the result header states `132 properties excluded – office class not recorded`. The sixth option exists so "missing" is explicitly findable and is never silently folded into a grade. | [NOW] |
| L-07 | Status | checkbox group | **d** | Disabled. Reason line: `0 of 148 records have a recorded status`. Self-enables when coverage > 0 (rule R2, proved by UX-8b). | [NOW-disabled] |
| L-08 | Asking rent | dual range slider + two numeric inputs (min, max) + unit note | – | Range over known values only. A permanently visible line reads `Asking rent recorded for 16 of 148 properties. 132 without recorded rent are excluded by this filter.` Every rent figure carries the R9 assumed-unit footnote marker. Slider and inputs are two views of one value; either updates the other on `change`. | [NOW] |
| L-09 | GLA | dual range slider | **d** | Disabled: `0 of 148 records have a recorded GLA`. | [NOW-disabled] |
| L-10 | Occupancy / vacancy | dual range slider | **d** | Disabled: `0 of 148 records have recorded occupancy or vacancy`. | [NOW-disabled] |
| L-11 | Parking | min-spaces number input | **d** | Disabled: `0 of 148 records have recorded parking`. | [NOW-disabled] |
| L-12 | Amenities | 12 checkboxes | **d** | Whole group disabled: `0 of 148 records have recorded amenities`. | [NOW-disabled] |
| L-13 | Data confidence | 4 checkboxes `High (0)`, `Medium (148)`, `Low (0)`, `Not verified (0)` | – | Enabled (coverage is non-zero even though it is single-valued). Zero-count options remain selectable and yield E-02. | [NOW] |
| L-14 | Completeness | 3 checkboxes `Complete ≥80 (0)`, `Partial 40–79 (16)`, `Sparse <40 (132)` | – | Filters on the derived completeness score (see `04-data-schema.md`). Drives UX-7f. | [NOW] |
| L-15 | `Only possible duplicates` | checkbox | t | Filters to the 12 records in 6 coordinate-collision groups; the results list groups them in pairs and offers `Review duplicates` → Data workspace (M4). | [NOW] |
| L-16 | `Exclude suspected non-office records` | checkbox | t | **Default OFF.** When on, hides the records flagged `entity_review` and the header states `6 records hidden – suspected non-office entity`. Default OFF because every acceptance number in `01` §5 is stated against 148 records; turning it on by default would silently change the headline count (see §11 open question Q-2). | [NOW] |
| L-17 | `More filters` | disclosure | t | Collapses L-09…L-16 behind one control. Open state persisted. Default: collapsed. §11 requires advanced filters to be hidden rather than overwhelming. | [NOW] |
| L-18 | `Reset filters` | button | d | Disabled when no filter deviates from default. Restores all filter state, keeps selection, keeps map viewport, keeps analysis layers. Announces `Filters reset – 148 properties` via the live region. | [NOW] |
| L-19 | Active filter chip `×` | button | – | One chip per active filter value, rendered above the counter. `×` removes only that value. Chips are the only place where an AI-applied filter is visually distinguished: AI-applied chips carry a small assistant glyph and the tooltip `Applied by the assistant`. | [NOW] |
| L-20 | Result counter | live text | – | `N properties found`, plus a second line when exclusions occurred (R4). Not a control; listed because it is the §11 required output. | [NOW] |

### 5.2 Left rail – results list (§12)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| L-21 | Sort | select | – | `Name A→Z` (default) · `Asking rent, high→low` · `Asking rent, low→high` · `Confidence` · `Completeness` · `Distance from selected` (enabled only when a property is selected; otherwise disabled with `Select a property to sort by distance`). Records with no value for the sort key always sort **last**, in a visually separated block headed `No recorded <field> (N)` – never interleaved as if they were zero (§36). | [NOW] |
| L-22 | Result card | button (whole card) | – | Click selects (see §4.3). Card shows name, class badge, district, GLA, rent, vacancy/occupancy, status, confidence dot + label (§12). Absent values render the neutral token `Not recorded`, never `0`, `–` or blank. Hovering previews the marker (raises + enlarges it) without selecting. | [NOW] |
| L-23 | Card compare checkbox | checkbox | d, t | Adds/removes from the compare tray. Disabled with `Compare supports 2–4 properties` once 4 are staged (existing checked boxes stay enabled so the user can swap). | [NOW] |
| L-24 | Card `Zoom to` | icon button (on hover/focus) | – | Pans and zooms the map to the record at z16 without changing selection. | [NOW] |
| L-25 | List empty-state action | button | – | Contextual: `Clear rent filter` / `Reset all filters` (see E-02). | [NOW] |

### 5.3 Map (§9, §10)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| M-01 | Marker | `divIcon`, click | – | Selects the property (§4.3). Selected marker gains the 3 px `--case-red` ring and is raised to the top pane. | [NOW] |
| M-02 | Marker hover | – | – | Tooltip: name · class · district · confidence. 120 ms in, 60 ms out. Also highlights the matching list card. No tooltip on touch devices (tap = select). | [NOW] |
| M-03 | Cluster bubble | click | – | Zooms to the cluster's bounds. Clustering is disabled above z13 and a cluster containing the current selection is force-expanded (critique C6b). | [NOW] |
| M-04 | District polygon | click | – | Toggles that district's filter (same state as L-05) and highlights the polygon. Hover raises the fill opacity and shows a label with the district name and its record count. | [NOW] |
| M-05 | Zoom in / Zoom out | 2 buttons | d | Standard; disabled at the zoom limits (z10 min, z18 max). | [NOW] |
| M-06 | `Fit to results` | button | d | Fits the viewport to the current filtered set with 48 px padding. Disabled when the result set is empty, reason `No results to fit`. | [NOW] |
| M-07 | `Reset view` | button | – | Returns to the Tashkent default view (fit to all 148 records) **without** touching filters or selection. Shortcut `R`. | [NOW] |
| M-08 | Fullscreen | button | t | Fullscreen API on `.mapwrap`; applies P9. Falls back to a CSS full-viewport mode when the API is unavailable (`file://` in some browsers) – the button never does nothing. | [NOW] |
| M-09 | `Layers` | button | – | Opens the right rail `Layers` tab (there is no second layer UI). | [NOW] |
| M-10 | Legend collapse | disclosure | t | Collapses the legend card to a 32 px chip. Default open ≥1024, collapsed below. | [NOW] |
| M-11 | Attribution link | external link | – | Real link to openstreetmap.org/copyright. Rendered greyed with `title="Requires an internet connection"` when the app is offline. | [NOW] |
| M-12 | Scale bar | – | – | Leaflet scale control, metric only. Not interactive. | [NOW] |
| M-13 | Map keyboard focus | container | – | The map container is a single tab stop (`tabindex="0"`, `role="application"`). Arrow keys pan, `+`/`-` zoom, `Esc` returns focus to the control that opened the map region. Individual markers are **not** tab stops (148 stops would make the keyboard path unusable); the results list is the accessible equivalent path to every record, announced by an `aria-describedby` note on the map container. | [NOW] |
| M-14 | Coordinate crosshair | mode | – | Only active while the Data workspace is in "Pick on map" mode (D-06): clicking the map writes lat/lng into the open record form, then returns to the workspace. `Esc` cancels. | [NOW] |

### 5.4 Right rail – Property tab (§13)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| R-01…R-04 | Tabs `Property`/`Analytics`/`Assistant`/`Layers` | tablist | t | Switch `right.tab`. Shortcuts `1`–`4`. | [NOW] |
| R-05 | Close rail | icon button | – | Closes the right rail; keeps `selectedId`; returns focus to the control that opened it. | [NOW] |
| P-01 | `Compare` | toggle button | d, t | Adds/removes the property from the tray; label flips to `In comparison`. Disabled at 4 items with the reason `Compare supports 2–4 properties`. (§15) | [NOW] |
| P-02 | `Analyze location` | button | – | Computes 1/3/5 km counts, draws the three circles, renders the results block inline in the Property tab, and creates the suggested competitive set (§16, §17, R5). Re-clicking recomputes (e.g. after an edit). | [NOW] |
| P-03 | `Ask AI about this property` | button | – | Switches to the `ai` tab, sets the AI context to this property, and pre-fills (does not send) `Show competitors within 3 km of <name>`. | [NOW] |
| P-04 | `Copy coordinates` | button | – | Copies `41.3110, 69.2800` (4 dp, comma-space) to the clipboard. Where `navigator.clipboard` is unavailable on `file://`, falls back to a selectable read-only input with the text pre-selected and the hint `Press Ctrl/Cmd+C`. Confirms with a toast. Never silently fails. | [NOW] |
| P-05 | `Open source` | link button | **d** | Opens `sourceUrl` in a new tab. Disabled for all 148 seed records with the reason `No source URL recorded`; the Data quality section still names the source (`2GIS · desk · 19 Jul 2026`). | [NOW-disabled] |
| P-06 | `Edit` | button | hidden in External role | Opens the Data workspace on `Records` with this record's form open. | [NOW] |
| P-07 | Section disclosures (Overview, Key metrics, Commercial, Tenants, Amenities, Location, Data quality) | 7 disclosures | t | Overview, Key metrics and Data quality open by default; the rest collapsed with their filled-field count in the header (e.g. `Tenants (0)`). Open/closed state persists per session. | [NOW] |
| P-08 | Field provenance `ⓘ` | icon button per field | – | Popover: value, source, source URL, collection date, last verified, method, confidence, note, and – for edited fields – the field-level provenance override (critique C13). (§2.3) | [NOW] |
| P-09 | `Zoom to` | icon button in the title block | – | Pans/zooms to the property without changing selection. | [NOW] |
| P-10 | Radius selector `1 / 3 / 5 km` | segmented, in the location-analysis block | t | Switches which circle is emphasised and which radius drives the nearby figures. All three counts always remain visible (§16). | [NOW] |
| P-11 | Competitor row `Remove` / `Add` | button per row | – | Edits the suggested competitive set; every dependent figure recomputes immediately (UX-4g). The two groups (`Qualified`, `Proximity only – class not recorded`) are always labelled (R5). | [NOW] |
| P-12 | `Save as layer` | button | d | Saves the current competitive set as a named analysis layer in the Layers tab, marked `source: manual`. Disabled when the set is empty. | [NOW] |
| P-13 | `Copy record ID` | small button in Data quality | – | Copies `master_id`. Same clipboard fallback as P-04. | [NOW] |
| P-14 | Photos | – | **[ARCH]** | No image placeholder is rendered (critique §4: an empty 16:9 box pushes real data below the fold). The `photos: []` slot exists in the schema and the Data quality section states `No photographs collected`. | [ARCH] |

### 5.5 Right rail – Analytics tab (§14)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| A-01 | Scope line | live text + link | – | `Analytics reflect the current filters – 148 of 148 properties`. The link `Clear filters` appears only when filters are active. | [NOW] |
| A-02 | Metric card | button | – | 9 cards (§14). Click opens a popover with the full denominator statement, the exact formula used, and the list of excluded-for-missing-data records. Every card renders its denominator line permanently (R3), not only in the popover. | [NOW] |
| A-03 | Chart bar / column | click target | – | Applies the corresponding filter (district, class, rent bin) and switches the left rail to `results`. Hovering shows the tooltip specified in `10-visual-system.md` §7. | [NOW] |
| A-04 | `Chart / Table` toggle | toggle per chart | t | Renders the same data as an accessible table. Required so no value is gated behind colour or hover. | [NOW] |
| A-05 | `Export CSV` | button | d | Exports the currently filtered set with a header comment block listing the active filters, the record count, the dataset collection date and the assumed rent unit. Disabled when the result set is empty. (M10) | [NOW] |
| A-06 | `Print` | button | – | Invokes `window.print()` with the print stylesheet: chrome hidden, the Analytics panel expanded to full page width, every denominator and the collection date printed on each page. (M10) | [NOW] |
| A-07 | `Insufficient verified data` state | – | – | Replaces a value when coverage is 0 or n < 3 for a mean/median; the denominator line still renders, and a one-sentence explanation names the missing field (R3). Not a control; listed because implementers keep turning it into a link. | [NOW] |

### 5.6 Right rail – Assistant tab (§40, §54)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| I-01 | Prompt input | textarea, auto-grow 1→5 rows | – | `Enter` sends, `Shift+Enter` newline, `Cmd/Ctrl+Enter` also sends. Empty input disables I-02. | [NOW] |
| I-02 | `Send` | button | d | Runs the deterministic intent engine and appends a response block. Disabled while the input is empty. | [NOW] |
| I-03 | Suggested prompt chip | button ×8 | – | Fills **and sends** the prompt. The eight chips are the §54 intents that this dataset can actually answer, plus one deliberate refusal case so testers see the honesty behaviour (§47/§62). | [NOW] |
| I-04 | Context chip `Context: <name>` `×` | chip + clear button | – | Shows the property the assistant will resolve "it/this" to (§44). `×` clears the AI context without deselecting the property. | [NOW] |
| I-05 | `How this was answered` | disclosure per response | t | Lists matched intent, the registry tools called with their arguments, the record counts in and out, and the elapsed time. This replaces the §53 progress theatre (critique §4): no simulated latency, full transparency. | [NOW] |
| I-06 | `Apply to map` | button per response | d | Applies the response's proposed filters/layers/radii. Disabled and labelled `Applied` once applied. | [NOW] |
| I-07 | `Undo this` | button per response | – | Reverts exactly the state this response changed (filters, layers, radii, selection), leaving later responses intact where possible; where not possible it states `Later steps depend on this and were also reverted`. | [NOW] |
| I-08 | `Create layer` | button per response | d | Turns the response's result set into a named analysis layer. Disabled when the result set is empty, reason `No matching properties`. | [NOW] |
| I-09 | `Compare these` | button per response | d | Opens the compare overlay with the response's top results (max 4). Disabled below 2 results. | [NOW] |
| I-10 | `Copy answer` | button per response | – | Copies the six §46 blocks as plain text including the coverage and limitation lines. | [NOW] |
| I-11 | `New session` | button | x | Clears the conversation, the AI context and the analysis layers created in it; keeps the dataset and the session log. Confirm required. (M11) | [NOW] |
| I-12 | `Export session log` | button | – | Downloads the §61 lightweight log as JSON: timestamp, prompt, intent, tools called, datasets accessed, filters/layers created, record counts. | [NOW] |
| I-13 | Response source pill (`Platform data` / `Calculated` / `Assumption` / `Unavailable`) | static pill | – | Not a control. Mandatory on every response per §2.8/§47; listed so it is not dropped. | [NOW] |
| I-14 | LLM provider selector | – | **[ARCH]** | Not rendered. `GEO.AI.providers` exists with `LocalIntentProvider` as the sole implementation (§55, `01` A10). A selector would be a fake control today. | [ARCH] |

### 5.7 Right rail – Layers tab (§10, §57)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| Y-01 | Base layer `Business Centres` | checkbox | t | Show/hide the marker layer. Shows the live record count. | [NOW] |
| Y-02 | Base layer `Tashkent districts` | checkbox | t | Show/hide the 12 polygons. | [NOW] |
| Y-03 | Base layer `District labels` | checkbox | t | Independent of Y-02. | [NOW] |
| Y-04 | Base layer `Radius rings` | checkbox | d, t | Show/hide the location-analysis circles. Disabled with `Run Analyze location first` when none exist. | [NOW] |
| Y-05 | Context layers `Metro stations` / `Major roads` / `Landmarks` | checkboxes | **d** | Disabled, each with the reason `No verified dataset loaded`. A footnote states: "Context layers require a licensed or field-collected source. This prototype does not approximate them." Populated by dropping GeoJSON into `GEO.SEED.contextLayers` – the control then enables itself. (§10, C1/`01` A8 – inventing metro coordinates is forbidden by §2.2) | [ARCH-disabled] |
| Y-06 | Analysis layer visibility | checkbox per layer | t | Show/hide. | [NOW] |
| Y-07 | Analysis layer rename | inline text edit | – | `Enter` commits, `Esc` cancels. | [NOW] |
| Y-08 | Analysis layer remove | icon button | – | Removes the layer and any circles it owns; toast with `Undo`. | [NOW] |
| Y-09 | Analysis layer `Inspect criteria` | disclosure | t | Shows the layer rule as a legible sentence plus the exact criteria JSON, its record count and its creator (`assistant` / `manual`). (§57) | [NOW] |
| Y-10 | Analysis layer `Zoom to` | icon button | d | Fits the map to the layer's records; disabled when the layer is empty. | [NOW] |
| Y-11 | `Clear all analysis layers` | button | d, x | Removes every analysis layer and its circles. Disabled when there are none. | [NOW] |
| Y-12 | Derived layers (office density, rent concentration, competitive intensity) | – | **[ARCH]** | Listed in the layer-type registry, not offered as controls; the assistant refuses them by naming the missing field (§42 last line, `01` A15). | [ARCH] |

### 5.8 Compare (§15)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| C-01 | Tray `Compare (n)` | button | d | Opens R7. Disabled at n = 1 with the label `Add one more to compare`. | [NOW] |
| C-02 | Tray chip `×` | button | – | Removes one property. | [NOW] |
| C-03 | Tray `Clear` | button | x | Empties the tray (confirm only when n ≥ 3). | [NOW] |
| C-04 | Overlay close | button | – | `Esc`, backdrop, or button. Focus returns to C-01. | [NOW] |
| C-05 | Column remove `×` | button | d | Removes a column; disabled at 2 columns with `Select at least 2 properties to compare`. | [NOW] |
| C-06 | `Add property` | search field inside the overlay | d | Folded search over the full dataset; disabled at 4 with `Compare supports 2–4 properties`. | [NOW] |
| C-07 | `Show only differing rows` | toggle | t | Hides rows where every column holds the same value. Rows where *all* columns are `Not recorded` count as identical and are hidden by this toggle; a footer line then states `N rows hidden – no recorded data for any selected property`. | [NOW] |
| C-08 | Column header property name | button | – | Closes the overlay and selects that property. | [NOW] |
| C-09 | `Export CSV` | button | – | The 13-row table with a provenance header block. | [NOW] |
| C-10 | `Print` | button | – | Print stylesheet; table fits one landscape page for up to 4 columns. | [NOW] |
| C-11 | Winner/ranking affordance | – | **[OUT]** | There is none, deliberately. §15: "Do not declare a winner." No cell may be bolded, coloured, arrow-marked or sorted as "best". | [OUT] |

### 5.9 Data workspace (§21, §19, M1–M4, M12–M14)

| ID | Control | Type | State | Behaviour | Tag |
|---|---|---|---|---|---|
| D-01 | Sub-nav (6 items) | tablist | t | `Records` · `Coverage` · `Quality` · `Duplicates` · `Local changes` · `Import / Export`. | [NOW] |
| D-02 | Records table row | button | – | Opens that record's edit form. | [NOW] |
| D-03 | `Add property` | button | – | Opens an empty form. Required fields: name, lat, lng, district. New records are created with confidence `Unknown` and the badge `Added locally – not verified`. (UX-9) | [NOW] |
| D-04 | Form fields | typed editors | d | Text, number-with-unit, enum select, date, tags, source rows. Numbers are parsed strictly (`34,8` and `$35/mo` are rejected with a named error, not silently coerced – M13). Coordinates outside lat 41.13–41.42 / lng 69.09–69.45 are rejected with `Coordinates outside Tashkent`. Fields the External role may not see are absent, not greyed. | [NOW] |
| D-05 | `Pick on map` | button | – | Collapses the workspace, enters M-14 crosshair mode, writes the clicked coordinates back into the form. `Esc` cancels. | [NOW] |
| D-06 | `Add source` | button | – | Appends a source row: source name, URL, method (enum from §5.6), collection date, confidence, note. | [NOW] |
| D-07 | `Confidence` | select | – | `High` / `Medium` / `Low` / `Not verified`. Changing it writes field-level provenance (`Manual edit (prototype)`, today's date, editor id) per C13. | [NOW] |
| D-08 | `Last verified` | date input | – | Editable; drives the stale calculation and therefore AI-6f. | [NOW] |
| D-09 | `Save` / `Cancel` | buttons | d | `Save` disabled while the form is invalid or unchanged. Saving recomputes map, filters, counter, analytics and the header chip **before** any dialog closes (UX-8). `Cancel` with unsaved changes asks for confirmation. | [NOW] |
| D-10 | `Delete` | button | x | Confirm dialog naming the record. Soft delete (`deleted_at`); the record moves to `Recently deleted` and is excluded from every count. (M1) | [NOW] |
| D-11 | `Restore` (recently deleted) | button | – | Undeletes. | [NOW] |
| D-12 | `Undo` / `Redo` | buttons | d | 20-deep stack covering edit, delete, coordinate change, add. Shortcuts `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`. Disabled at the ends of the stack. (M1) | [NOW] |
| D-13 | Coverage bar row | button | – | One row per schema field: `field · known / 148 · bar`. Click filters the map to the records missing that field. This view is the honest centre of the §37 data-moat story (M14). | [NOW] |
| D-14 | Quality queue row | button | – | Ranked verification queue (missing critical fields, confidence, duplicate suspicion, staleness). Opens the record. | [NOW] |
| D-15 | Quality queue `Create field tasks` | button | **d** | Disabled: `Requires confirmation and a backend – not available in the prototype`. (§50, `01` A13) | [ARCH-disabled] |
| D-16 | Duplicate pair verdict | 3 buttons `Same` / `Different` / `Undecided` | t | Records a verdict with provenance; default `Undecided`. **Never auto-merges.** Counts everywhere disclose `148 records (6 possible duplicate pairs unresolved)`. (M4) | [NOW] |
| D-17 | Local changes `Revert` | button per change | x | Reverts one field or one record to the shipped value, showing `before → after`. (M12) | [NOW] |
| D-18 | Local changes `Export change-set` | button | d | JSON of added/edited/deleted records. Disabled when there are no local changes. | [NOW] |
| D-19 | `Export JSON` | button | – | `{schemaVersion, exportedAt, source, records[]}`. Round-trip lossless (UX-10). | [NOW] |
| D-20 | `Import JSON` | file input | – | Parses → checks `schemaVersion` → validates every record → shows a per-row report (`142 imported, 6 rejected: BC-x missing lat…`) → `Commit` / `Cancel`. **All-or-nothing**: a partial import is never applied. (M8) | [NOW] |
| D-21 | `Restore original dataset` | button | x | Same as S-05. | [NOW] |
| D-22 | `Full reset` | button | x | Same as S-06. | [NOW] |
| D-23 | Tenant editor | – | **[ARCH]** | Not built. Tenants enter only via JSON import; the Tenants section states `No tenant records. Tenants can be supplied through JSON import.` (`01` A3) | [ARCH] |
| D-24 | Photo upload | – | **[ARCH]** | Not built; `photos: []` slot only (§5.7, §22). | [ARCH] |

### 5.10 Global

| ID | Control | Type | Behaviour | Tag |
|---|---|---|---|---|
| G-01 | Toast `Undo` | button | Reverts the action the toast describes; 6 s window; the toast pauses its timer on hover/focus. | [NOW] |
| G-02 | Toast dismiss | button | Closes the toast. | [NOW] |
| G-03 | Confirm dialog `Confirm` / `Cancel` | buttons | Destructive confirm always names the object (`Delete "Trilliant"?`) and states what cannot be undone. | [NOW] |
| G-04 | Notice bar action | button | Context-dependent (`Export my data`, `Retry tiles`, `Dismiss`). | [NOW] |
| G-05 | Shortcuts dialog | dialog | Opened by `?` or S-07; lists every binding in §6.1. | [NOW] |

**QA procedure for X-4:** walk this table top to bottom in the built prototype. Each row must either perform the
stated behaviour or render `disabled` with the stated reason visible on hover *and* as adjacent text (a tooltip
alone is not an accessible reason). Any control present in the build but absent from this table is a defect.

---

## 6. Keyboard, focus and accessibility baseline

The brief never mentions accessibility in 69 sections (critique M6). §24 nevertheless claims a professional tool,
and professional CRE users work from the keyboard. The following is the minimum bar.

### 6.1 Keyboard shortcuts [NOW]

| Key | Action | Scope |
|---|---|---|
| `/` | Focus global search (H-05) | Global |
| `Esc` | Close the **topmost** layer only, in this order: popover → dialog → overlay (R7/R8) → sheet/overlay-rail → right rail → deselect property. Never closes two layers with one press. | Global |
| `F` | Toggle the left rail | Global |
| `L` | Toggle view `map ⇄ map+list` (left-rail tab) | Global |
| `1` `2` `3` `4` | Right rail → Property / Analytics / Assistant / Layers (opens the rail if closed) | Global |
| `C` | Open the compare overlay (no-op with a toast when fewer than 2 are staged) | Global |
| `D` | Open the Data workspace (Internal role only) | Global |
| `R` | Reset map view (M-07) | Global |
| `?` | Keyboard shortcuts dialog | Global |
| `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z` | Undo / redo data edits | Global |
| `Ctrl/Cmd+Enter` | Send the AI prompt | Assistant input |
| `Enter` / `Shift+Enter` | Send / newline | Assistant input |
| `↑` `↓` | Move through the results list or a listbox | List / combobox |
| `Enter` / `Space` | Activate the focused list card | Results list |
| `←` `→` `↑` `↓` | Pan the map; `+` / `-` zoom | Map container focused |
| `Tab` / `Shift+Tab` | Standard order; **trapped** inside dialogs, overlays and mobile sheets only | Global |

Single-letter shortcuts are **suppressed** while focus is inside `input`, `textarea`, `select` or
`[contenteditable]`, and while any IME composition is active. `Esc` and the modifier combinations always work.

### 6.2 Focus management [NOW]

- Focus ring, on every interactive element, never removed. Two variants, because one colour cannot serve both
  surfaces (ratios computed, not estimated):

  | Control surface | Ring | Computed contrast |
  |---|---|---|
  | Anything on `--surface` / `--bg` (the default) | `outline:2px solid var(--case-red); outline-offset:2px` | `#B01F22` vs `#FFFFFF` **6.85:1**, vs `#F5F3EF` **6.18:1** – passes the 3:1 non-text floor |
  | Red-filled controls (primary buttons, the selected marker ring) | inset white ring **plus** an outer ink ring: `outline:2px solid #FFF; outline-offset:-2px; box-shadow:0 0 0 2px var(--ink)` | white vs `#B01F22` **6.85:1**; `#1A1714` vs `#F5F3EF` **16.11:1** |

  Do **not** use ink as the ring directly on red: `#1A1714` on `#B01F22` is **2.61:1** and fails.
  `:focus-visible` is used for pointer interactions; `:focus` styling is retained for keyboard and for
  programmatic focus.
- Opening a dialog/overlay/sheet: focus moves to its first heading (`tabindex="-1"`), not to its close button, so
  screen-reader users hear what opened.
- Closing any layer returns focus to the element that opened it. If that element no longer exists (e.g. the row
  was deleted), focus goes to the nearest surviving sibling, then to the region heading – never to `<body>`.
- Focus is trapped in R7/R8/R9 and in mobile sheets. It is **not** trapped in docked rails (they are part of the
  page; trapping them would break `Tab` navigation between panel and map).
- The results list uses **roving `tabindex`**: one tab stop for the list, arrows to move within it, so 148 cards
  do not create 148 tab stops.
- Skip link `H-14` is the first focusable element on the page.

### 6.3 ARIA roles – the docked-vs-overlay rule

| Region | Docked (≥1280 for rails) | Overlay drawer / sheet (<1024) |
|---|---|---|
| Left rail | `role="region" aria-label="Filters and results"`; tab bar `role="tablist"` | `role="dialog" aria-modal="true" aria-label="Filters"`, focus trapped |
| Right rail | `role="region" aria-label="Detail panel"`; `role="tablist"` + `tabpanel`s | `role="dialog" aria-modal="true"`, focus trapped |
| Compare / Data workspace / confirms | `role="dialog" aria-modal="true" aria-labelledby=…` at all widths | same |
| Header | `role="banner"` | same |
| Map | `role="application" aria-label="Map of business centres" aria-describedby="map-kbd-note"` | same |
| Notice bar | `role="status"` | same |
| Toasts | `role="status"` (`role="alert"` only for errors) | same |
| Result counter, AI response container | `aria-live="polite" aria-atomic="true"` | same |

Applying `aria-modal="true"` to a docked rail is a defect: it makes screen readers ignore the rest of the page
while the map is plainly visible and usable. The mode switch happens in one place, driven by `state.ui.bp`.

### 6.4 Contrast and non-colour encoding (against the CASE palette)

Values are computed in `10-visual-system.md` §2–§5 and are binding. The IA-level rules that follow from them:

- Body text uses `--text` (17.85:1 on white) or `--text-2` (7.35:1); the smallest permitted text colour is
  `--text-3` (5.65:1) at 11 px for coverage/denominator lines.
- `--line` (1.33:1) and `--line-strong` (1.65:1) are decorative: a control's boundary or state may never be
  conveyed by a border alone.
- Data confidence is **always dot + text label** – `Medium` (1.83:1) and `Low` (2.64:1) sit below 3:1 on purpose,
  and the label is the mitigation. A bare confidence dot is a defect.
- Office class on markers is **letter inside the circle**, not colour alone (§9 marker design,
  `10-visual-system.md` §3).
- "No data" is `--unknown` **plus a 45° hatch** plus the word `Unknown` – never colour alone, never an empty gap.
- Every chart has a `Chart / Table` toggle (A-04) so nothing is reachable only by hover or colour.
- Every map affordance has a non-map equivalent: everything reachable by clicking a marker is reachable from the
  results list, and district selection is available as checkboxes (L-05) as well as polygons (M-04).

### 6.5 Reduced motion

`prefers-reduced-motion: reduce`, or `data-motion="reduce"` from S-03, collapses every transition and animation to
`0.01ms`, disables Leaflet's `zoomAnimation`, `fadeAnimation` and `markerZoomAnimation`, disables marker-cluster
spiderfy animation, renders chart bars at their final size immediately, and makes sheets appear without sliding.
State changes still occur – they simply do not move (§25). See §8 for the per-animation table.

---

## 7. Empty, loading and error states

Every one of these is implemented through a single helper so the copy, structure and escape action are consistent:

```js
// src/03-a11y.js (shared UI primitives)
GEO.ui.emptyState({
  target,                 // Element to fill
  icon,                   // token name, or null
  titleKey,               // i18n key – required
  bodyKey,                // i18n key – required
  params,                 // {n, m, field, ...} interpolated into both
  action                  // {labelKey, onClick} | null  – always offers a way out where one exists
});
```

**Rule:** an empty state always names the *cause* and offers the *escape*. "No data" on its own is forbidden.
**Rule:** a true zero is never rendered as missing data, and missing data is never rendered as zero (§36).

| ID | Condition | Region | Copy (EN) | i18n key | Action |
|---|---|---|---|---|---|
| **E-01** | Boot, before first paint | Whole app | Centred wordmark, no spinner (init is synchronous and < 200 ms; a spinner would imply work that is not happening) | – | – |
| **E-02** | Filters match 0 records | Results list + map | `No properties match these filters.` / `The narrowest filter is <name>. 148 properties are in the dataset.` | `empty.results.title` / `.body` | `Clear <filter>` and `Reset all filters` |
| **E-03** | A selected district genuinely contains 0 records | Results list | `No business centres recorded in <district>.` / `This is a recorded zero, not missing data – the district is in the dataset and contains no records.` | `empty.district.*` | `Choose another district` |
| **E-04** | Search returns nothing | Search listbox | `No match for "<q>".` / `Search covers property name, address and district.` | `empty.search.*` | `Clear search` |
| **E-05** | No property selected | Property tab | `No property selected.` / `Choose a building on the map or in the results list.` | `empty.property.*` | `Open results list` |
| **E-06** | Metric has zero coverage, or n < 3 for a mean/median | Metric card / chart | `Insufficient verified data` + `Based on 0 of 148 properties with verified <field>` | `metric.insufficient` / `metric.coverage` | – (the denominator line is the explanation) |
| **E-07** | Compare tray has 1 item | Compare tray/overlay | `Select at least 2 properties to compare.` | `empty.compare.*` | `Open results list` |
| **E-08** | Analysis layer matched 0 records | Layers tab | `0 properties` + the criteria sentence | `empty.layer.*` | `Remove layer` |
| **E-09** | No analysis layers exist | Layers tab | `No analysis layers.` / `Layers are created from the assistant or from a saved competitive set.` | `empty.layers.*` | – |
| **E-10** | Assistant cannot answer from available data | AI response | `The current dataset is insufficient to answer this reliably.` + the field and denominator + what would be required + an answerable alternative (§62) | `ai.insufficient.*` | The alternative, as a clickable prompt |
| **E-11** | Tenants / amenities / photos absent | Property sections | `No tenant records.` / `No amenities recorded.` / `No photographs collected.` | `empty.tenants` etc. | – |
| **E-12** | Recently-deleted list empty | Data workspace | `Nothing deleted in this session.` | `empty.deleted` | – |
| **E-13** | No local changes | Data workspace | `No local changes. The dataset matches the version shipped with this prototype.` | `empty.changes` | – |

### 7.2 Loading states

The app has no asynchronous data loading – seed data is inline (it must run from `file://`, where `fetch()` of a
local JSON file is blocked). Therefore:

| ID | Condition | Treatment |
|---|---|---|
| **L-S1** | Map tiles fetching | Leaflet's own progressive tile fade. The map is usable (markers, polygons, clicks) before tiles arrive. |
| **L-S2** | Webfont loading | `font-display: swap`, with Georgia / system-ui as the fallback stack. First paint never waits on a font. |
| **L-S3** | Filter/analytics recompute | Synchronous, < 16 ms for 148 records. **No spinner, no skeleton** – a loading indicator for work that takes one frame is theatre. If a future dataset makes recompute exceed 100 ms, set `aria-busy="true"` on the affected region and dim it to 60 % opacity; do not block input. |
| **L-S4** | Assistant "thinking" | None. The local intent engine answers in < 5 ms; simulating latency to imply intelligence is the presentational cousin of the fabrication §47 forbids (critique §4). The `How this was answered` disclosure (I-05) carries the transparency instead. **[ARCH]** When an async LLM provider is registered, the same node becomes the §53 status strip (`Understanding request → … → Preparing answer`) driven by real provider events. |
| **L-S5** | Import parsing a large file | Progress text `Validating N of M records…`, cancellable. |

### 7.3 Error states

| ID | Condition | Detection | Region | Copy (EN) | Behaviour |
|---|---|---|---|---|---|
| **X-E1** | Map tiles unreachable (offline or blocked) | ≥ 8 Leaflet `tileerror` events within 5 s, or `navigator.onLine === false` at boot | Map + notice bar | `Map tiles unavailable – you appear to be offline.` / `All data, filters, analytics, comparison and the assistant still work.` | Basemap replaced by `--surface-3` with a 24 px `--line` grid; markers, polygons, radii and labels all still render (X-2). Notice bar offers `Retry`. Attribution link is greyed (M-11). Never blocks the app. |
| **X-E2** | `localStorage` unavailable (private mode, blocked storage, `file://` restrictions) | Feature probe at boot: write → read → delete a sentinel key inside `try/catch` | Notice bar | `Local saving is unavailable in this browser.` / `Your edits work in this session but will be lost when you reload.` | The storage adapter falls back to an in-memory store with the identical interface; every write path keeps working. Notice bar offers `Export JSON` so work is recoverable. Never throws into the UI. |
| **X-E3** | `localStorage` full (`QuotaExceededError`) | Caught on write | Dialog (R9) | `Could not save – browser storage is full.` / `Your change is applied in this session but is not saved.` | Offers `Export JSON`, `Remove local edits`, `Continue without saving`. The in-memory state keeps the edit, so nothing is lost silently. Subsequent writes retry once, then stop retrying for the session. |
| **X-E4** | Persisted schema version ≠ current | Boot check, before app init | Boot screen (R13) | `Saved data was created by an earlier version of this prototype.` | Non-dismissible: `Export my old data (JSON)` / `Discard and start clean`. **Never silently migrates and never white-screens** (M2). |
| **X-E5** | Import: malformed JSON | `JSON.parse` throws | Dialog | `Import failed: the file is not valid JSON.` | Nothing changes (UX-10e). |
| **X-E6** | Import: wrong `schemaVersion` | Field check | Dialog | `Import failed: file schema v<N>, this prototype expects v<M>.` | Nothing changes (UX-10d). |
| **X-E7** | Import: some records invalid | Per-record validation | Dialog | `142 of 148 records are valid. 6 rejected: BC-x missing lat; …` | All-or-nothing: `Import valid records only` **or** `Cancel`. A partial import is never applied silently (M8). |
| **X-E8** | Edit validation failure | On field blur and on save | Inline under the field | e.g. `Enter a number. "34,8" was not understood – use a full stop for decimals.` / `Coordinates outside Tashkent.` | Save stays disabled; the value is never coerced silently (M13). |
| **X-E9** | Clipboard API unavailable | `navigator.clipboard` missing or throws | Inline | `Copy is blocked in this browser. Select the text and press Ctrl/Cmd+C.` | Fallback read-only pre-selected input (P-04). |
| **X-E10** | Fullscreen API unavailable | `requestFullscreen` missing or rejects | – | – | Silent fallback to a CSS full-viewport mode. The control still does something (§29). |
| **X-E11** | Hash state unparseable | Boot | Toast | `Link state could not be restored – opened with default settings.` | App boots to defaults. |
| **X-E12** | Unexpected runtime error | `window.onerror` / `unhandledrejection` | Notice bar | `Something went wrong in <module>. The rest of the prototype still works.` | Logs to the session log with the module name; offers `Copy error details`. The app is a single file with no error reporting – a silent failure in a testing session is a lost finding. |

---

## 8. Animation inventory (§25)

Durations and easings come from `10-visual-system.md` §9 and are repeated here with their region triggers so an
implementer does not have to reconcile two lists. **Nothing animates longer than 220 ms.** No animation is
decorative; each one either explains a spatial relationship or confirms that an action landed.

| # | What | Property | Duration | Easing | Trigger | Under reduced motion |
|---|---|---|---|---|---|---|
| 1 | Rail open/close (docked) | `grid-template-columns` | 180 ms | `cubic-bezier(.2,.8,.2,1)` | L-03, R-05, tab keys, P2/P6 | Instant; one `invalidateSize()` after the state change |
| 2 | Rail overlay drawer (768–1023) | `transform: translateX` | 180 ms | same | P3 | Instant |
| 3 | Mobile sheet | `transform: translateY` | 180 ms | same | P4 | Instant (no slide) |
| 4 | Scrim | `opacity` 0→0.4 | 180 ms | `ease-out` | Any overlay/sheet | Instant |
| 5 | Modal (R7/R8/R9) enter | `opacity` + `translateY(8px)` | 160 ms | `cubic-bezier(.2,.8,.2,1)` | Compare, Data, dialogs | Opacity only, 0.01 ms |
| 6 | Property selection (marker) | `r`, `stroke-width` | 120 ms | `ease-out` | M-01, L-22, search, AI | Instant |
| 7 | Marker hover | `r`, `filter` | 100 ms | `ease-out` | M-02 | None |
| 8 | Filter result / counter update | `opacity` 0.6→1 on the counter | 140 ms | `ease-out` | Any filter change | Instant |
| 9 | Results list re-render | staggered `opacity` on the first 8 cards, 12 ms stagger | 140 ms | `ease-out` | Filter/sort change | Instant, no stagger |
| 10 | Chart bar growth | `width`/`height` from 0 | 220 ms | `cubic-bezier(.2,.8,.2,1)` | Analytics data change | Final size immediately |
| 11 | Chart/table swap | cross-fade | 140 ms | `ease-out` | A-04 | Instant |
| 12 | Tab underline | `transform: translateX` + `width` | 160 ms | `cubic-bezier(.2,.8,.2,1)` | Rail/workspace tab change | Instant |
| 13 | Card hover lift | `box-shadow` + `translateY(-1px)` | 100 ms | `ease-out` | Result/metric card hover | None |
| 14 | Analysis layer add/remove | marker `opacity` + ring `scale` | 200 ms | `ease-out` | I-08, Y-08, Y-11 | Instant |
| 15 | Radius circle draw | `stroke-dashoffset` sweep | 200 ms | `ease-out` | P-02, AI `create_radius` | Drawn immediately |
| 16 | AI response appearance | `opacity` + `translateY(6px)` | 160 ms | `ease-out` | I-02 | Instant |
| 17 | Compare tray in/out | `transform: translateY` + `opacity` | 160 ms | `cubic-bezier(.2,.8,.2,1)` | First add / last remove | Instant |
| 18 | Toast in/out | `transform: translateY(8px)` + `opacity` | 160 ms | `ease-out` | Any toast | Opacity only |
| 19 | Disclosure expand/collapse | `grid-template-rows: 0fr→1fr` | 160 ms | `ease-out` | P-07, L-17, Y-09, I-05 | Instant |
| 20 | Map pan/zoom to a target | Leaflet `flyTo`, 300 ms | 300 ms | Leaflet default | Search, `Zoom to`, fit | `setView` with `animate:false` |
| 21 | Popover open | `opacity` + `scale(.98→1)` | 120 ms | `ease-out` | Header menus, provenance | Instant |
| 22 | P7 "filters changed" dot | 2 pulses, 600 ms total | 300 ms each | `ease-in-out` | AI changed filters while the rail was collapsed | Static dot, no pulse |

Implementation: one CSS custom-property pair drives everything –

```css
:root{ --dur-panel:180ms; --dur-fast:120ms; --dur-chart:220ms; --ease-panel:cubic-bezier(.2,.8,.2,1); }
@media (prefers-reduced-motion: reduce){ :root:not([data-motion="full"]){ --dur-panel:.01ms; --dur-fast:.01ms; --dur-chart:.01ms; } }
:root[data-motion="reduce"]{ --dur-panel:.01ms; --dur-fast:.01ms; --dur-chart:.01ms; }
@media (prefers-reduced-motion: reduce){ :root:not([data-motion="full"]) *{ animation-duration:.01ms !important; transition-duration:.01ms !important; scroll-behavior:auto !important; } }
```

`GEO.motion.enabled()` returns the same decision to JavaScript so Leaflet options and the chart renderer agree
with the CSS. Performance beats decoration: no animation may run on more than 8 elements simultaneously, and
nothing animates `top`/`left`/`width` on the map layer (§25 last line).

---

## 9. i18n architecture (§27)

**Scope, stated honestly:** §27's localisation covers **UI chrome only**. The data is not translatable in this
prototype – 100 of 109 addresses and 12 names are Cyrillic, district values are Latin, and internal notes are
Russian (critique C12). A `name_i18n` / `address_i18n` slot exists in the schema and stays empty. **[ARCH]**

### 9.1 Shape – one flat table, dot-path keys

```js
// src/01-i18n.js
GEO.I18N = {
  defaultLocale: 'en',
  locale: 'en',
  fallbackChain: { ru:['en'], uz:['ru','en'], en:[] },
  strings: {
    en: {
      'header.search.placeholder':      'Search property, address or district',
      'header.data.summary':            '{records} records · {sources} source · updated {date} · {verified} field-verified',
      'filters.title':                  'Filters',
      'filters.reset':                  'Reset filters',
      'filters.results.count':          '{n} properties found',
      'filters.excluded.class':         '{n} properties excluded – office class not recorded',
      'filters.disabled.coverage':      '{n} of {m} records have this field',
      'metric.insufficient':            'Insufficient verified data',
      'metric.coverage':                'Based on {n} of {m} properties with verified {field}',
      'field.gla.label':                'GLA',
      'value.notRecorded':              'Not recorded',
      'rent.unitAssumed':               'Unit assumed USD/m²/month; not stated by the source',
      'compare.limit':                  'Compare supports 2–4 properties',
      'ai.context':                     'Context: {name}',
      'ai.insufficient.title':          'The current dataset is insufficient to answer this reliably.'
      /* … one entry per user-visible string … */
    },
    ru: { /* empty at ship – scaffolded, falls back to en */ },
    uz: { /* empty at ship – scaffolded, falls back to ru then en */ }
  }
};
```

Flat dot-paths, **not** nested objects: a flat map makes the coverage check, the missing-key lint and a
translator's spreadsheet export one-liners, and it removes any question of how a partially-filled nested branch
merges with its fallback.

**Key naming convention:** `<region>.<component>.<element>[.<state>]`, lower camel within a segment. Regions use
the names in §1.2 (`header`, `filters`, `results`, `map`, `property`, `analytics`, `ai`, `layers`, `compare`,
`data`, `empty`, `error`, `a11y`, `field`, `value`, `unit`, `metric`). `field.*` and `value.*` are reserved for
schema field labels and shared value tokens so one label is never defined twice.

### 9.2 Accessor

```js
/**
 * t('metric.coverage', {n:16, m:148, field:'asking rent'})
 *   -> 'Based on 16 of 148 properties with verified asking rent'
 * Missing key: returns the key wrapped for dev visibility and logs once.
 */
function t(key, params){ … }
t.has     = (key, locale) => boolean;
t.plural  = (key, n, params) => string;   // key + '.one' | '.other'  (ru adds '.few'; the rule table is per-locale)
t.num     = (value, opts) => string;      // Intl.NumberFormat(locale) – always tabular in the UI
t.date    = (isoString) => string;        // '19 Jul 2026'
t.coverage= (n, m, fieldKey) => string;   // the §14/§36 denominator sentence – one function, used everywhere
t.setLocale = (loc) => void;              // re-renders; writes GEO.state.ui.locale; persists
t.coverageOf = (loc) => number;           // 0..1, share of en keys present in loc  (drives H-12/S-01)
```

`t.coverage()` exists as a first-class accessor because the denominator sentence is the single most repeated and
most safety-critical string in the product (§14, §36, §46, §47). It must be impossible to write by hand.

### 9.3 Binding rules (binding, testable)

1. **No user-visible literal may appear outside `GEO.I18N.strings`.** This includes button labels, headings,
   placeholders, `aria-label`, `title`, `alt`, empty-state copy, error copy, toast copy, confirm copy, chart axis
   titles, units and the disabled-reason strings in §5.
2. Static markup uses `data-i18n="key"` (text), `data-i18n-attr="aria-label:key;title:key"` (attributes),
   resolved once at boot and again on `t.setLocale`.
3. Dynamic strings are built with `t(key, params)` – **never** by concatenation. `'Based on ' + n + ' of ' + m`
   is a defect: it cannot be reordered by a translator and it breaks RU grammar.
4. Numbers, dates and units always go through `t.num` / `t.date` / the unit tokens, never through raw
   `toLocaleString()` calls scattered in modules.
5. Data values are rendered as-is, in their source script. Never machine-transliterate a property name.
6. A locale is offered in H-12/S-01 only when `t.coverageOf(loc) >= 0.95`; below that it renders disabled with
   the live percentage. At ship `en` = 100 %, `ru` = 0 %, `uz` = 0 %.
7. Locale changes must not require a reload: `t.setLocale` triggers one full re-render from `GEO.state`.

**Lint (part of `build.py`, fails the build):** scan `src/*.js` for string literals inside `textContent`,
`innerHTML`, `insertAdjacentHTML`, `setAttribute('aria-label'…)`, `placeholder=` and `title=` assignments that are
not `t(...)` calls or `data-i18n` attributes; scan `src/*.html` for text nodes without a `data-i18n` ancestor.
Allow-list: numerals, `·`, `–`, `×`, `/`, `%`, `$`, the product-name constant, and `master_id` values.

### 9.4 RU/UZ readiness [ARCH]

Adding a language is a data task, not a code task: fill `strings.ru`, add the RU plural rule to the plural table,
verify the coverage gate flips the selector on. Two structural allowances are already made for it: (a) no string
is assembled by concatenation, so word order is translatable; (b) the left rail and right rail widths are set in
`px` with `min-width: 0` and text wraps rather than truncating, because RU labels run ~25 % longer than EN – no
label in the shell may rely on a fixed-width single line.

---

## 10. Region → source module map (§30)

Naming follows `01-product-spec.md` §6; modules added by this document are marked **+**.

| Region / concern | Module |
|---|---|
| Product constant, registries (cities, asset types, refresh policy) | `src/00-config.js` |
| i18n table + accessor + lint hooks | `src/01-i18n.js` |
| **+** UI state, render loop, breakpoint observer, hash state (§4.2, §4.4) | `src/02-ui-state.js` |
| **+** Focus trap, shortcuts, empty/error/toast primitives (§6, §7) | `src/03-a11y.js` |
| Tokens, type scale | `src/05-tokens.css` |
| Shell grid, rails, sheets, breakpoints (§2) | `src/06-layout.css` |
| **+** Components: buttons, chips, tabs, cards, tables, forms | `src/07-components.css` |
| **+** Print stylesheet (M10) | `src/08-print.css` |
| Seed data | `src/10-seed-bc.js`, `src/11-seed-districts.js` |
| Map, markers, clusters, polygons, radii, map chrome (R3, R4) | `src/20-map.js` |
| Filters (R2 · Filters) | `src/30-filters.js` |
| Search (H-05) | `src/31-search.js` |
| Property tab (R5 · Property) | `src/40-property.js` |
| Results list (R2 · Results) | `src/41-list.js` |
| Analytics tab | `src/50-analytics.js`, `src/51-charts.js` |
| Compare tray + overlay (R6, R7) | `src/60-compare.js` |
| Location analysis, competitive set | `src/70-location.js` |
| AI parser / session / UI / tools / layers | `src/80-…` – `src/84-…` |
| Data workspace (R8) | `src/90-admin.js` |
| Storage adapter, schema version, in-memory fallback | `src/91-storage.js` |
| **+** Coverage, quality queue, duplicates, local-changes diff | `src/92-quality.js` |
| **+** Boot sequence, recovery screen (R13), global error handlers | `src/99-boot.js` |

Boot order is fixed: storage probe → schema check (R13 if it fails) → `#reset` check → state init → i18n resolve
→ render shell → init map → apply hash state → first render. Nothing renders before the schema check.

---

## 11. Conflicts and open questions raised by this document

| ID | Issue | Position taken here | Needs a decision from |
|---|---|---|---|
| **Q-1** | `01-product-spec.md` item 37 requires the §53 execution-status strip; `02-brief-critique.md` §4 rejects it as simulated latency. | Ship the `How this was answered` disclosure (I-05) as the MVP behaviour; keep the same DOM node wired as the §53 status strip for a future async provider **[ARCH]**. No fake progress is rendered. | Product owner |
| **Q-2** | `01` R10 keeps suspected non-office records visible and counted in 148; `02` §6.1#6 recommends a default-on exclusion toggle. Default-on would change every acceptance number in `01` §5. | L-16 ships **default OFF**. If CASE wants it on by default, the acceptance numbers in `01` §5 must be restated first. | Humyunmirzo Mirkamolov |
| **Q-3** | `01` item 39 and X-9 require the Internal/External role switch; `02` §4 recommends deferring it. | Implemented as S-02 (`01` is binding). It gates UI only and the banner says so; it must never be described to a tester as a permission model. | Product owner |
| **Q-4** | Working product name: `01` §2 selects **GEODESK**; `02` §6.1#8 recommends **CASE Geo**. | This document is name-agnostic – the header renders `GEO.PRODUCT.name`. `01` governs until overruled; a change is one line. | Product owner (§8) |
| **Q-5** | §12 implies a visible Map / Map+List switch. This document makes the left-rail tab bar that switch and adds no separate header control (two controls for one state). | Left-rail tabs on desktop, bottom tab bar on mobile. | – (recorded, low risk) |
| **Q-6** | §7 lists the analytics drawer, AI panel and AI layers panel as separate regions; they are tabs of one rail here (C9). | Binding. Revisit only if user testing shows people need analytics and a property visible at once – the remedy would be a ≥1600 px dual-pane right rail, not three rails. | User testing |
| **Q-7** | §10 context layers cannot be populated (no dataset; Overpass/OSM blocked; §2.2 forbids invented coordinates). | Y-05 ships disabled with the reason and a footnote. **Explicitly reject** any later instruction to approximate metro locations. | Data owner |
| **Q-8** | Touch drag on mobile sheets competes with map panning at the sheet's peek height. | Drag is captured only by the 32 px handle strip and the sheet header; the sheet body scrolls; the map below is untouched. Every sheet also has a close button – drag is never the only exit. | – (recorded) |
| **Q-9** | Document numbering: `01-product-spec.md` §0 cites the schema document as `03-data-schema.md`, but `03` is this information-architecture document (§65 orders Step 3 IA before Step 4 schema). This document cites the schema as `04-data-schema.md`. | Schema document ships as **`04-data-schema.md`**; the stale reference in `01` §0 should be corrected in place. Analytics rules → `05`, AI architecture → `06`, delivery notes → `07`. | Author of `01` |
