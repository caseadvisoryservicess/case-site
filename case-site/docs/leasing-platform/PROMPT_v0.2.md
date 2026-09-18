# CASE Leasing & Sales — Project Control **v0.2**
### Build prompt for a new chat

> **How to use this.** Start a new chat. Attach the 6 files listed in §0.
> Paste this whole document as your first message. Nothing else is needed.

---

## 0. FILES TO ATTACH

| File | What it is | Status |
|---|---|---|
| `CASE_Leasing_Sales_Project_Control_v0.1.html` | Current build. Holds the real Creative Avenue data and 17 floor-plan images. | **required** |
| `plan-recognizer.js` | Reads unit codes, areas and outlines out of an SVG or vector PDF floor plan. | **tested, use as-is** |
| `state-store.js` | Editable state, autosave, undo, cross-section sync. | **tested, use as-is** |
| `i18n.js` | UZ/RU/EN runtime: Russian 3-form plurals, m²/м², dates, money. | **tested, use as-is** |
| `i18n.uz-ru-en.json` | 178 keys × 3 languages, 100 % coverage. | **tested, use as-is** |
| `sample-plan-zarafshan-l2.svg` + `test-fixture-zarafshan-l2.json` | A real CAD plan and the exact output the recognizer must produce from it. | regression test |
| `CASE_OS_MIGRATION.md` | How the live CASE OS stores data, its floor-plan subsystem, and the field mapping. **Read it before designing any structure.** | required reading |
| `INTEGRATION_CONTRACT.md` | The boundary with the geoanalytics platform being built in parallel. | required reading |

The four JS files and the JSON are **already written and verified against real project
data**. Do not rewrite them. Inline them into the single HTML file and build the interface
on top. If you think one has a bug, say so and show the failing case — do not silently
replace it.

---

## 1. ROLE

You are a senior product designer **and** front-end engineer building an internal operating
tool for **CASE Real Estate Advisory** (Tashkent). Users: 3–5 leasing brokers and one head
of leasing. Desktop every morning, phone during site visits. Uzbek and Russian speakers.

This is not a demo. Brokers will run their real deal list on it.

---

## 2. THE RULE THAT OVERRIDES EVERYTHING ELSE

**v0.2 must be small enough to test in two weeks.**

We ship v0.2 → three brokers use it on the real Creative Avenue list → we collect what
breaks → we change one thing at a time. We are deliberately not building the full system.

- Build **only** what §7 lists.
- Every other idea goes into a `<!-- BACKLOG -->` comment at the bottom of the file, unbuilt.
- The test for any feature: *would a broker use it before lunch on a normal Tuesday?*
  No → backlog.

v0.1 was too thin (read-only, nothing saves). A previous attempt was too thick (twenty
screens, nobody could find anything). v0.2 sits in the middle and **looks finished**.

---

## 3. THE FACTS YOU MUST NOT BREAK

Measured from v0.1. Your rebuild has to reproduce these exactly.

| Item | Value |
|---|---|
| Project | Creative Avenue, Tashkent, Mixed-use / Office Campus, code `CA`, USD |
| Source | `Creative Avenue - LCR.xlsx` |
| Units | 139 rows — 138 with an area, 1 with area = 0 (`active:false`) |
| **Total GLA** | **17 561.0 m²** (active units only) |
| Blocks | 1, 2, 3, 5, 6 · Floors −1 … 4 · 19 populated block/floor cells |
| Plans | 17 base64 PNGs: block 1 (5 floors), 2 (3), 5 (5), 6 (5). **Block 3 has none.** |
| Status split | Вакант 10 341.7 (58.9 %) · Контракт подписан 5 097.6 (29.0 %) · Переговоры 896.5 (5.1 %) · Контракт на подписании 853.9 (4.9 %) · Предложено 371.3 (2.1 %) |
| Prospects / brokers / comments / terraces | 31 / 28 / 4 / 12 units |
| Brokers | Нодир (24), Азиз (3), Бекзод (1) |
| Categories | Склад 46, Офис 30, Услуги 22, Киоск 17, Торговля 11, Еда и напитки 12 |
| `rejectionsCount` | 52 — present in the data, displayed nowhere today |
| Bad value | 1 unit has `avgRent: "#DIV/0!"` |

**Smoke test:** dashboard reads **17 561 m²**, **29 % signed**, **58.9 % vacant**.
If not, you broke the data.

---

## 4. WHAT IS WRONG WITH v0.1

1. **It is read-only.** A broker cannot change a status, add a prospect, or write a comment.
   Nothing they do is saved. This is the single biggest failure.
2. **No sync.** Even if it were editable, the dashboard, the table and the plan would not
   agree with each other.
3. **The floor plan is a dead picture.** 3.7 MB of real plans, no click, no zoom, no link
   to the table. And there is no way to upload a new plan.
4. **No motion.** Two `transition` rules, zero `@keyframes`. It feels like a spreadsheet
   export, not a product.
5. **No history.** Nothing records who changed what. Leasing is a follow-up business.
6. **`rejectionsCount: 52` is invisible.** 52 rejections is a real commercial signal.
7. Inline `onclick=` everywhere, `innerHTML` string concatenation.
8. Light theme only. No empty states, no save feedback, almost no keyboard support.
9. 11 table columns at every width — unusable on a phone.

---

## 5. HARD CONSTRAINTS

- **One self-contained `.html` file.** No build step, no npm, no bundler.
- **No network at runtime.** No CDN, no Google Fonts, no analytics, no AI API.
  It must work from `file://` with the network off.
- **No backend, no login, no cloud.** `localStorage` only.
- Keep the file under ~6 MB (plan images are ~3.7 MB of it). Do not re-encode them.
- Preserve the data object and every existing i18n key.
- No inline `onclick`. One delegated listener reading `data-action`.
- Never build markup for user data by concatenating strings. `textContent` /
  `createElement` only — the data has apostrophes and Cyrillic.
- Chrome, Safari, Edge, iOS Safari.

---

## 6. DESIGN REFERENCE — LEARN FROM THE ENTERPRISE CRE PLATFORMS

JLL runs its own stack for exactly this work and it is the right bar. Their public product
family includes **JLL Azara** (portfolio and lease analytics), **Corrigo** (property
operations) and **JLL GPT**. *(Names given as a research pointer from general knowledge —
verify current branding before quoting them to a client.)*

Do **not** copy their interface, brand or content. Borrow the patterns every mature CRE
platform converges on:

| Pattern | What it means here |
|---|---|
| **Portfolio → asset → unit** | Three levels, each one click deep, breadcrumb always visible. |
| **One number, one definition** | Every KPI shows its formula on hover. "Occupancy" means one thing everywhere. |
| **The plan is the interface** | Clicking a unit on the plan is a primary action, not decoration. Plan ↔ table ↔ drawer stay in sync. |
| **Movement, not just a status column** | Brokers think proposed → negotiating → signing → signed. Show the movement. |
| **Everything dated and attributed** | Who changed it, when, from what to what. Non-negotiable. |
| **Unknown ≠ zero** | Missing rent shows `—` and is excluded from averages, never counted as 0. |
| **Export is first-class** | Data must round-trip to Excel. `LCR.xlsx` is still the source of truth. |
| **Saved views** | Filter once to "my units, in negotiation", pin it. |
| **Dense but calm** | Information-dense and still quiet: one accent colour, generous line-height, restrained borders. |

Not copied: their AI assistant, benchmarking data, mobile app, permission system.

---

## 7. SCOPE OF v0.2 — BUILD EXACTLY THIS

### P0 — the tool becomes usable

1. **Editable + autosaving + synced.** Wire everything through `state-store.js` (§8).
2. **Plan upload and automatic reading.** SVG and vector PDF, via `plan-recognizer.js` (§9).
3. **Clickable plans** with zoom, pan and colour modes (§9.4).
4. **Pipeline board** — 5 columns, drag a card to change status.
5. **History per unit** — timestamp, user, field, old → new.
6. **Motion pass** (§10).
7. **Dark mode**, explicit toggle, persisted.
8. **Responsive**: table → cards under 900 px; sidebar → bottom bar under 600 px.
9. **Three perfect languages** (§11).
10. **CASE OS-compatible structures** — plan keying, and the three normalisations in
    `CASE_OS_MIGRATION.md` §5: `block` as a string, `floor` with both a number and a label,
    `prospects` as `{id:null,name}`. Free now, a migration later.

### P1 — in this order if time allows

11. Command palette, `Ctrl/Cmd + K` — unit code, prospect, broker.
12. Export CSV (filtered view) + JSON backup, and import the JSON back.
13. Saved views, max 6, pinned in the sidebar.
14. Rejections panel — surface the 52. One KPI card plus an appendable log.
15. Data quality card — the zero-area unit, the `#DIV/0!`, active status with no broker,
    prospect but status Вакант. Each row links to the unit. State the rule, not just a count.

### DEFERRED — do not build

Client portal · brand database · contacts & companies · documents · commissions ·
requirements · printed reports · real authentication · any AI feature · charts beyond
simple bars.

---

## 8. EDITING, SAVING AND CROSS-SECTION SYNC

**Use `state-store.js`. Do not write your own.** It is tested: persistence across reload,
undo, no-op detection, corrupt-save recovery from a backup slot, cross-tab sync.

### 8.1 Wire it up once

```js
var store = CaseStore.create({
  key: 'case_ls',
  version: 2,
  initial: { units: BASE_PROJECT.units, projects: [BASE_PROJECT], meta: {} },
  migrate: function (old, fromVersion) {        // v1 data must survive the upgrade
    return { units: old.units || [], projects: old.projects || [], meta: {} };
  }
});
```

### 8.2 Every change goes through one call

```js
store.edit('units', 'B1_001', { status: 'Переговоры', broker: 'Нодир' }, { by: currentUser });
```

That single call does all of this — which is why nothing may bypass it:

- writes the fields,
- stamps `updatedAt` / `updatedBy`,
- appends one `history` entry **per field**,
- skips no-op writes so the history stays clean,
- pushes an undo frame,
- debounced autosave (400 ms) with the previous good copy kept as a backup,
- emits three events so every section re-renders.

### 8.3 Cross-section sync — subscribe, never poll

```js
store.on('data:changed', function () {          // coarse: anything changed
  renderKpis(); renderStatusMix(); renderBlocks(); renderTable();
  renderPipeline(); renderPlanOverlay(); renderDataQuality();
});

store.on('units:status', function (e) {         // fine: one field
  flashRow(e.id);                               // the row that changed pulses once
  animateChipRecolour(e.id, e.from, e.to);
});

store.on('store:saveState', function (s) {      // 'pending' | 'saved' | 'error'
  setSaveIndicator(s);                          // always visible in the top bar
});
```

**Rule: no view holds its own copy of the data.** Every render reads from `store`. A
status changed on the pipeline board must be visible in the table, the KPI row, the status
mix, the plan colouring and the block cards *without a refresh*. Verify this explicitly.

### 8.4 What must be editable in v0.2

From the unit drawer **and** inline in the table: `status`, `prospects[]`, `broker`,
`comment`, `closeDate`, `rentFact`. Nothing else. Inline edits commit on blur or `Enter`,
revert on `Esc`.

### 8.5 Save feedback the user can trust

- A save indicator in the top bar: *Saving… / Saved HH:MM / Could not save*.
- `Ctrl/Cmd + Z` undoes the last edit and says what it undid.
- Quota exhausted (`store:saveFailed`) → a blocking banner offering a JSON export.
  **Never** fail silently, and never wipe the user's data to make room.

---

## 9. FLOOR PLANS — UPLOAD AND AUTOMATIC READING

This is the highest-value feature in v0.2.

### 9.1 Be honest about what is automatic

| Input | What happens | Confidence |
|---|---|---|
| **SVG from CAD/Revit/Inkscape** | Fully automatic: unit codes, printed areas, closed outlines, scale, matching to the inventory. | high |
| **Vector PDF** | Text and coordinates read automatically; outlines are not reconstructed — supply SVG or draw once. | medium |
| **Scanned / raster PDF or image** | **Nothing is automatic.** No text exists to read. Manual calibration only. | — |

**Never claim OCR or computer vision.** The recognizer is deterministic geometry and text
parsing. When a PDF is a scan, say so plainly and offer the two real options: export SVG
from the CAD file, or draw the outlines once.

### 9.2 What the recognizer actually does

Verified against `sample-plan-zarafshan-l2.svg`, a real CAD export from a previous CASE
project. `test-fixture-zarafshan-l2.json` holds the exact expected output:

```
Codes on plan: 17
Printed areas: 13 (10 paired to a code)
Closed outlines: 641 (17 contain a code)
Scale: 1 unit² = 7.001e-8 m², R² = 0.999982 from 10 samples
7 area(s) derived from the outline — marked derived, not measured
[error] L2_3    code appears 2 times on this plan
[warn]  L2_1, L2_7, L2_8  resolved to the SAME outline — draw them in calibration mode
[info]  3 printed areas not paired to a code (16.3, 27.6, 5.6 — toilets)
```

R² = 0.99998 means the outlines it picked reproduce the drawing's printed areas to within
0.002 %. It also **finds the drawing's own mistakes** — a duplicated code, three units
sharing one outline — instead of hiding them.

### 9.3 Wire it up

```js
// 1. read
const plan = PlanRecognizer.readSvg(svgText);

// 2. detect codes, printed areas, outlines
const det = PlanRecognizer.detectUnits(plan);

// 3. derive the scale from units that have BOTH an outline and a printed area
const cal = PlanRecognizer.calibrateScale(det);        // { scale, r2, samples }

// 4. fill the missing areas from the outline (marked 'derived', never 'measured')
PlanRecognizer.inferAreas(det, cal);

// 5. surface the drawing's problems to a human
const problems = PlanRecognizer.auditDetection(det);   // error | warn | info

// 6. match against the LCR rows
const match = PlanRecognizer.matchToInventory(det, store.collection('units'));

// 7. hotspots for the SVG overlay
const hot = PlanRecognizer.toHotspots(match, plan.viewBox);

// …or all seven in one call:
const r = PlanRecognizer.recognizeSvg(svgText, store.collection('units'));
console.log(r.report.join('\n'));
```

**Show the user the report before committing anything.** A recognition run is a proposal,
not a fact. The review screen lists: matched by code, matched by area, area mismatches,
inventory rows not on the plan, plan codes not in the inventory, and every audit line.
The user presses **Apply** or **Discard**. Nothing is written to the store until Apply.

Tune per project rather than hard-coding a client's drawing conventions:

```js
PlanRecognizer.recognizeSvg(svg, rows, {
  codePatterns: [/^[A-ZА-Я]{1,3}\d*[_\-]\d{1,4}[A-ZА-Я]?$/],  // B1_001, L2_11, TK-14
  areaTolerance: 0.03,        // 3 % before an area counts as a mismatch
  pairRadius: 0.06,           // how far a printed area may sit from its code
  bareNumberAreas: true       // some drawings print "282" with no unit marker
});
```

### 9.3b Match the CASE OS plan structures — they already exist

The live CASE OS has a tested floor-plan subsystem. Use its shape so v0.2 does not have to
be unpicked later. Full detail in `CASE_OS_MIGRATION.md` §4; the minimum:

```js
planKey(objId, block, floor) = block ? objId+'::'+block+'::'+floor : objId+'::'+floor

PLANSVG[key]              = { kind:'svg'|'img', data:'…' }
PLAN_CODES[key]           = [ { code:'L2_11', area:70.8 }, … ]
PLAN_LABELPOS[key]        = { 'L2_11': {x,y}, … }
PLAN_IGNORED_CODES[objId] = ['С/У', 'М/Р']
PLAN_STRUCT[objId]        = { blocks:['B1'], floors:{ 'B1':['-1 этаж','1 этаж'] } }
```

Two behaviours to copy exactly:

- **Renaming a block or floor is a migration.** Move `PLANSVG`, `PLAN_LABELPOS` and
  `PLAN_CODES` to the new key *and* update every unit's `block` / `floor`.
- **A block with units attached cannot be deleted.** Say how many units are blocking it.

And reuse the reconciliation banner the leasing team already reads:

> ⚠ Plans and register disagree: **3** new on the drawing · **5** missing from the drawing · **2** with a different area

`matchToInventory()` returns exactly those three sets (`unmatchedPlan`, `unmatchedRows`,
`areaMismatch`). CASE OS uses an absolute 0.5 m² tolerance, the recognizer defaults to a
relative 3 % — pick one, state which, do not run both.

### 9.4 The plan surface

- PNG (or the uploaded SVG) as the bottom layer; an inline `<svg>` overlay in the same
  coordinate space, `viewBox` from the image's natural size.
- Hotspot fill = status colour at opacity .18; hover .34 + 1.5 px stroke; click opens the
  unit drawer and highlights the matching table row and floor-list item. Hover works both
  ways: floor list ↔ polygon.
- **Zoom and pan**: wheel / pinch 0.5×–6× anchored at the cursor, drag to pan, `Fit`
  button, keys `+` `−` `0`. CSS `transform` on a wrapper — never re-render.
- **Colour modes**: by status (default) / category / broker / rent per m² / vacant only.
- **Coverage banner**: "12 of 19 units mapped". Never hide the gap. Unmapped units appear
  in the floor list tagged "not on the plan".
- **Block 3 has no plan** — a real empty state naming the block and offering the unit list.
- Skeleton shimmer while a base64 image decodes (130–270 KB each).

### 9.4b Uploaded files are untrusted

A floor plan is a file a third party emailed us, and SVG can carry script.

```js
host.innerHTML = PlanRecognizer.sanitizeSvg(uploadedText);   // never the raw text
```

Never inject an uploaded SVG without it. Reject a file that returns `''`.

### 9.5 Calibration mode (the fallback that always works)

For scans, and for outlines the recognizer could not separate:

1. Pick a unit from the floor list.
2. Click corners on the plan. `Enter` closes the polygon, `Backspace` removes the last
   vertex, `Esc` cancels.
3. Drawn units get a ✓ in the floor list so progress is visible.
4. Export all hotspots as JSON so the work is done once and shipped inside the file.

Label it plainly in the UI: **outlines are drawn by a person, not detected.**

---

## 10. MOTION — IMPLEMENT ALL OF IT

Motion is feedback, not decoration. Every animation answers "what just happened?"

```css
:root{
  --d1:120ms; --d2:200ms; --d3:320ms;
  --ease:cubic-bezier(.22,1,.36,1);
  --ease-io:cubic-bezier(.65,0,.35,1);
  --spring:cubic-bezier(.34,1.56,.64,1);
}
```

| # | Element | Motion | Timing |
|---|---|---|---|
| 1 | KPI values | count up from 0 via `requestAnimationFrame` | 600 ms `--ease` |
| 2 | KPI bars | width 0 → value, cards staggered 40 ms | `--d3` |
| 3 | Status-mix bars | grow left → right, staggered | `--d3` |
| 4 | Table rows | fade + `translateY(4px)`, stagger 15 ms, **capped at 12 rows** | `--d2` |
| 5 | Unit drawer | slide from right + backdrop fade | `--d3` / `--d2` |
| 6 | Tab switch | underline slides via `transform`, content cross-fades | `--d2` |
| 7 | Plan hotspot hover | fill opacity + stroke width | `--d1` |
| 8 | Plan hotspot click | one expanding ring pulse in the status colour | 450 ms |
| 9 | Pipeline drag | card lifts to `--e3`, scales 1.02, drop zone tints | `--d1` |
| 10 | Status change | chip cross-fades between colours, row flashes once | `--d2` / 700 ms |
| 11 | Toast | slide up + fade, auto-dismiss 3 s, max 3 stacked | `--d2` |
| 12 | Save indicator | dot pulses while pending, settles on saved | `--d2` |
| 13 | Sidebar project | left accent bar `scaleY(0→1)` from centre | `--d2` `--spring` |
| 14 | Filter chip added | scale .8 → 1 | `--d2` `--spring` |
| 15 | Theme switch | View Transitions API where supported, else 200 ms cross-fade | `--d2` |
| 16 | Plan image loading | skeleton shimmer, 1.4 s loop | linear |
| 17 | Recognition progress | determinate bar through the 7 stages, each stage named | `--d2` |

**Mandatory:**

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{
    animation-duration:.01ms!important; animation-iteration-count:1!important;
    transition-duration:.01ms!important; scroll-behavior:auto!important;
  }
}
```

**Animate only `transform` and `opacity`.** Never `width`, `height`, `top`, `left` or
`box-shadow` on anything that moves during a drag or a scroll. The pipeline board and the
plan must hold 60 fps with 139 units on a mid-range laptop.

---

## 11. LANGUAGES — ALL THREE MUST BE PERFECT

Use `i18n.js` + `i18n.uz-ru-en.json`. **178 keys, three languages, 100 % coverage,
already verified** — `audit()` returns `ok: true` with zero missing for uz, ru and en.

```js
var L = CaseI18n.create(I18N_DICT, store.uiGet('lang', 'uz'));

L.t('totalGla')                      // "Umumiy GLA" / "Общая GLA" / "Total GLA"
L.count(1, 'unit')                   // "1 помещение"
L.count(3, 'unit')                   // "3 помещения"
L.count(112, 'unit')                 // "112 помещений"     <- 3-form Russian plural
L.statusLabel('Контракт подписан')   // "Shartnoma imzolangan" / "Контракт подписан" / "Contract signed"
L.categoryLabel('Еда и Напитки')     // "Taom va ichimliklar"
L.area(17561)                        // "17 561 м²" (ru)  /  "17 561 m²" (uz, en)
L.money(3378.4)                      // "$3,378"
L.date('2026-09-18')                 // "18.09.2026" (ru, uz)  /  "18 Sept 2026" (en)
L.area(null)                         // "—"   <- unknown is never zero
L.applyStatic();                     // data-i18n / -title / -placeholder / -aria
```

Rules that are not negotiable:

- **Status keys stay Russian strings in the data** (`'Контракт подписан'`) — they are the
  join key with `LCR.xlsx`. Translate at display time only, via `L.statusLabel()`.
- **Russian plurals have three forms.** `n === 1 ? 'помещение' : 'помещения'` is wrong and
  reads as illiterate to a client. `L.count()` handles it.
- **Uzbek uses `oʻ` and `gʻ` with U+02BB**, not `'` or `'`. The dictionary already does.
- Area unit: `м²` in Russian, `m²` in Uzbek and English.
- Dates `DD.MM.YYYY` in RU and UZ, `DD MMM YYYY` in EN.
- Translate status labels, categories and subcategories — half the source data is Russian
  and brokers read UZ and RU.
- A missing string falls back to the **English wording**, never a raw key, never blank.
- Before delivering, run `L.audit('uz')`, `L.audit('ru')`, `L.audit('en')` and paste the
  results. All three must report `ok: true`. Any new key you add must ship in all three.

---

## 12. DESIGN SYSTEM — ONE LOOK ACROSS THREE PRODUCTS

The leasing tool, the geoanalytics tool and CASE OS must read as **one product**, not
three. These tokens come from the live CASE OS. Use the token names, never raw hex, so the
whole theme moves in one file when the three merge.

- Shared tokens stay unprefixed (`--brand`, `--signed`, `--r`, `--s4`).
- App-specific tokens get a prefix (`--ls-*` here, `--geo-*` there).
- **The same status colour means the same status in all three. Never recolour a status.**
- Same spacing scale, same radii, same elevation ramp, same motion durations.
- A component CASE OS already has — KPI card, status chip, data table, drawer — keeps its
  CASE OS shape. The leasing team should not learn it twice.
- Ship the `:root` block below verbatim. When the products merge it becomes the shared
  stylesheet and nothing else changes.
- Font: CASE OS uses Montserrat; a self-contained file cannot fetch Google Fonts, so v0.2
  ships the system stack. Flag this as an open decision, do not silently diverge.

```css
:root{
  --brand:#b5222b; --brand-hi:#d43a43; --brand-soft:#b5222b14;
  --bg:#f4f5f7; --surface:#fff; --surface-2:#fafbfc; --sunken:#eef0f3;
  --line:#e3e5e9; --line-strong:#d2d6dc;
  --text:#17191d; --text-2:#585e67; --muted:#6f747c;
  --sidebar:#141518; --sidebar-2:#1d1f23; --sidebar-text:#e8eaed;
  --signed:#1c8a5b; --signing:#c98910; --proposed:#356fe0;
  --negotiation:#7c55c7; --vacant:#9aa1aa; --reserved:#c84550;
  --ok:#1c8a5b; --warn:#c98910; --danger:#b5222b; --info:#356fe0;
  --r-sm:8px; --r:12px; --r-lg:16px; --r-full:999px;
  --e1:0 1px 2px rgba(18,20,24,.06),0 1px 3px rgba(18,20,24,.04);
  --e2:0 4px 12px rgba(18,20,24,.07),0 2px 4px rgba(18,20,24,.04);
  --e3:0 12px 32px rgba(18,20,24,.12),0 4px 8px rgba(18,20,24,.06);
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
}
:root[data-theme="dark"]{
  --bg:#0e0f12; --surface:#17191d; --surface-2:#1c1f24; --sunken:#111316;
  --line:#272b31; --line-strong:#343a42;
  --text:#e8eaed; --text-2:#a8aeb7; --muted:#7d848e;
  --sidebar:#0a0b0d; --sidebar-2:#141518; --brand-soft:#d43a4322;
  --e1:0 1px 2px rgba(0,0,0,.4); --e2:0 4px 12px rgba(0,0,0,.45);
  --e3:0 12px 32px rgba(0,0,0,.55);
}
```

- **Type**: system stack, no web fonts. `11 / 12 / 13 base / 15 / 18 / 24 / 32`,
  line-height 1.45 body, 1.2 headings. `font-variant-numeric: tabular-nums` on every
  number in a table or KPI so digits stop jumping.
- **Spacing**: only the `--s*` scale.
- **Status needs a second cue besides colour.** Every chip is `● dot + text`, and the dot
  differs by shape (filled = closed, ring = in progress, hollow = vacant). Two of our
  statuses are green and amber; 8 % of men cannot tell them apart.
- **Density toggle**: comfortable (40 px rows) / compact (32 px), persisted via `store.uiSet`.

---

## 13. QUALITY BAR

- `Tab` order follows visual order. `Esc` closes only the topmost layer. Drawer and modal
  trap focus and return it to the trigger. `Ctrl/Cmd+K` palette, `/` focuses search,
  arrow keys move between table rows.
- Visible `:focus-visible` ring everywhere — 2 px `--brand`, 2 px offset.
- Contrast ≥ 4.5:1 in **both** themes. Check `--muted` on `--surface-2` specifically.
- Touch targets ≥ 44 px on mobile.
- `aria-label` on icon-only buttons; `aria-live="polite"` on toasts; the pipeline board
  announces drops.
- No layout shift on load — reserve height for the KPI row and the plan stage.
- Zero console errors at every breakpoint.

---

## 14. ACCEPTANCE CHECKLIST — REPORT EACH LINE

**Data**
1. Total GLA reads **17 561 m²**, signed **29.0 %**, vacant **58.9 %**.
2. 139 units listed; the zero-area unit is excluded from GLA and appears in data quality.
3. The `#DIV/0!` value shows `—`, is excluded from every average, and is listed as an issue.

**Editing and sync**
4. Changing a status from the drawer, the table and the pipeline board gives the same result.
5. One status change updates KPIs, status mix, block cards, table, board and plan colour
   **at once**, with no refresh.
6. Every edit appears in that unit's history with user, timestamp and old → new.
7. Reload — all edits survive. Clear `localStorage` — it falls back to the shipped data
   without an error.
8. Corrupt the saved JSON by hand — the tool recovers from the backup and says so.
9. `Ctrl+Z` undoes the last edit.

**Plans**
10. All 17 existing plan images load; block 3 shows a proper empty state.
11. Upload `sample-plan-zarafshan-l2.svg` → the report matches
    `test-fixture-zarafshan-l2.json`: 17 codes, 13 printed areas, R² = 0.999982,
    7 derived areas, 1 error, 1 warning.
12. A scanned PDF produces the honest message, not a fake result.
13. At least one floor is calibrated with clickable hotspots as a worked example.
14. Zoom, pan and fit work with wheel, drag and keyboard.

**Languages**
15. `L.audit()` returns `ok: true` for uz, ru and en — paste all three results.
16. `112` renders as `112 помещений` in Russian, not `112 помещения`.
17. No English leaks into the UZ or RU interface.

**Structure**
18. `block` is a string, `floor` carries both a number and a label, `prospects` are
    `{id:null,name}` objects, and plan data is keyed `objId::block::floor`.
19. Uploaded SVG goes through `sanitizeSvg()` — verify with a file containing `<script>`.

**Presentation**
20. Dark mode: nothing unreadable, all status colours still distinguishable.
21. 375 / 768 / 1280 / 1920 px: no horizontal scroll, no clipped text.
22. `prefers-reduced-motion: reduce` — all animation stops, nothing breaks.
23. Opened from `file://` with the network off: fully functional.
24. Console clean. File under 6 MB.
25. Keyboard only: log an edit on a unit without touching the mouse.

---

## 15. DO NOT

- Do not rewrite the five attached modules — inline and use them.
- Do not rewrite the data or "clean" the Russian category names.
- Do not re-encode or replace the plan images.
- Do not add a chart library, an icon font, or any dependency. Inline SVG only.
- Do not add screens beyond §7, and no geo or brand-database features (§16.5).
- Do not invent numbers. Missing → `—`, counted as unknown, reported.
- Do not use colour as the only signal for status.
- Do not animate anything that is not `transform` or `opacity`.
- Do not claim OCR, computer vision or automatic recognition of a scan.
- Do not add a login screen that implies real security.
- Do not put commission or fee data into any view — and remember that hiding a column is
  not protection; the value is still in DevTools and in every export.
- Do not invent a data structure that CASE OS already has (`CASE_OS_MIGRATION.md` §2, §4).
- Do not inject an uploaded SVG without `sanitizeSvg()`.

---

## 16. INTEGRATION READINESS — THIS TOOL WILL NOT LIVE ALONE

A **geoanalytics platform** is being built in parallel. Both will sit on one hosting, and
the brand/client database will be **central and shared**, not owned by either one.

You are not building the integration in v0.2. You are making sure v0.2 does not have to be
torn apart to allow it. Four cheap rules now, instead of a rewrite later.

### 16.1 Namespace everything

```js
window.CASE = window.CASE || {};
CASE.leasing = {                       // one global, nothing else on window
  version: '0.2.0',
  store: store,
  i18n: L,
  recognizer: PlanRecognizer,
  api: { /* §16.3 */ }
};
```

Storage keys are namespaced the same way — `case_ls_*` for leasing, never a bare key like
`projects` or `lang`. The geo app will use `case_geo_*` on the same origin. A collision
would destroy real data.

CSS: prefix every custom property and class that is not already scoped
(`--case-brand`, `.case-kpi`), or scope the whole app under one root class. Two apps on
one host must not restyle each other.

### 16.2 Shared entities — do not fork them

| Entity | Owner | Leasing v0.2 does |
|---|---|---|
| **Brand / retailer** | shared database (future) | stores a `brandId` **and** the display name; never becomes the master |
| **Client / company** | shared database (future) | same: `clientId` + name |
| **Project / asset** | shared | keeps `projectId` stable and never renumbers it |
| **Unit** | **leasing owns this** | free to change; publishes read-only |
| **Deal / status / history** | **leasing owns this** | free to change; publishes read-only |
| **Catchment, footfall, competition, geo layers** | **geo owns these** | consumes, never computes |

Concretely, in v0.2 a prospect is a plain string (`"OnePC"`). Store it so it can gain an
ID without a migration:

```js
prospects: [ { id: null, name: 'OnePC' } ]   // id stays null until the shared DB exists
```

Keep a one-line `normalizeProspect()` that accepts both the old string form and the object
form, so v0.1 data still loads.

### 16.3 Publish a small, stable surface

Give the geo app something to call that will not change when your internals do:

```js
CASE.leasing.api = {
  version: '0.2.0',

  // read-only, no internal objects handed out
  listProjects: () => store.collection('projects').map(p => ({ id:p.id, name:p.name, city:p.city })),
  getProjectSummary: (id) => ({ projectId:id, totalGla:…, signedGla:…, vacantGla:…, occupancyPct:…, units:… }),
  listUnits: (projectId) => […],              // id, block, floor, area, category, status — no commercial terms
  getUnit: (unitId) => ({ … }),

  // navigation, so geo can deep-link into leasing
  openUnit: (unitId) => { … },
  openProject: (projectId) => { … },

  // change notification, so geo can stay in step
  subscribe: (fn) => store.on('data:changed', fn)
};
```

**Never publish commission, fee or negotiation detail through this surface.** Internal
commercial data does not leave the leasing app — that rule survives integration.

### 16.4 Cross-app messaging

Until both apps are in one page, talk over `postMessage` with a typed envelope, and
validate `event.origin` on receipt:

```js
{ source:'case.leasing', v:1, type:'unit.selected', payload:{ projectId, unitId } }
{ source:'case.geo',     v:1, type:'catchment.ready', payload:{ projectId, radiusKm, population } }
```

Types leasing should **emit** in v0.2 (cheap, and they make the integration demo possible):
`project.opened`, `unit.selected`, `status.changed`.
Types leasing should **accept**: `geo.showProject`, `geo.highlightUnits`.

If nothing is listening, these are no-ops. That is the point.

### 16.5 One design system

Covered in §12 and in `CASE_OS_MIGRATION.md` §8. The short version: both new tools and
CASE OS share one `:root` token block, and a status colour never changes meaning between
them. Visual unity is part of the integration, not a later polish pass.

### 16.6 What this means for scope

- **Do not build a brand database in leasing.** It belongs to the shared layer. v0.2 keeps
  prospects as free text plus the `id` slot above. This is already in the DEFERRED list —
  §16 is the reason why.
- **Do not build any geo feature** — no maps, no catchment, no footfall. If a screen would
  benefit, leave a labelled placeholder that calls `CASE.geo?.…` and degrades to nothing
  when the geo app is absent.
- **Do export cleanly.** The JSON backup from `state-store.js` is what the shared database
  will ingest first. Keep it complete and stable.

Add a short `<!-- INTEGRATION -->` comment at the bottom of the file listing every
assumption you made about the shared layer, so the geo chat can reconcile against it.

---

## 17. DELIVER

1. The single `.html` file.
2. A short change list: what you built, what you deliberately left out.
3. The §14 checklist with pass/fail against each of the 25 lines.
4. The `<!-- BACKLOG -->` list of ideas you did not build.
5. The `<!-- INTEGRATION -->` list of assumptions about the shared layer (§16).

**Start by restating in five lines what you understood the scope to be. Then build.**
