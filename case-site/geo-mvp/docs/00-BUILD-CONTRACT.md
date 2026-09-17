# 00 – BUILD CONTRACT (binding)

This is the integration document. Where any other document in `docs/` disagrees with this one,
**this one wins**. It records the decisions taken, the reason for each, and the exact interfaces
modules must implement. The data layer described here is already built and frozen
(`data/seed.json`, `tools/build_seed.py`, `tools/oracle.py`).

Read with: `02-brief-critique.md` (why these decisions), `10-visual-system.md` (exact colours,
marks, motion), `01-product-spec.md` (acceptance scenarios).

---

## 1. Product constants

```js
GEO.PRODUCT = {
  name:      'CASE Geo',        // working name ONLY – §8 forbids branding it "ZAKY"
  version:   '0.1.0-prototype',
  city:      'Tashkent',
  assetType: 'Business centres',
};
```

Changing the product name is a one-line edit to `GEO.PRODUCT.name`; the string appears nowhere
else. Noted for §33: the name is a placeholder *because* the venture may need to stand alone
later, so nothing in the UI hard-codes CASE branding beyond the visual tokens.

---

## 2. Frozen decisions

| # | Decision | Why | §/ref |
|---|---|---|---|
| **D1** | **Geometry is authoritative for district.** `districtKey` is computed by point-in-polygon against the official 2024 boundary. The source's label is retained as `_meta.districtSourceLabel`; the 10 disagreements are flagged `_meta.districtConflict` and surfaced as a Data Quality queue. Never silently corrected, never silently trusted. | 10 of 148 source labels contradict the polygons. `Trilliant` (A+, $44.7, the highest rent in the dataset) moves Mirzo-Ulugbek → Yunusobod, which changes the headline district rent finding. Charts drawn from the label would visibly disagree with the map drawn from the polygon. | §14, §43, D11 |
| **D2** | **Unknown is `null`. Always.** Never `0`, never `""`, never a missing key – every record carries the full key set. The **only** permitted way to read values for a metric is `GEO.analytics.known(rows, field)`. A metric that touches a raw array is a defect. | §36 is the product's central correctness claim. Enforced structurally, not by discipline. | §36, §2.2 |
| **D3** | **Per-field confidence, not a record-level constant.** All 148 source records carry `data_confidence:"B"` – a degenerate value in a vocabulary the brief does not define. We do **not** map `B → Medium` and call it confidence. Instead: name/coords/address = **Medium** (single map-service listing); `officeClass`/`askingRent` = **Low** (unverified commercial claims from a directory); `districtKey` = **High** where computed from geometry (reproducible). The raw `B` is displayed as `Source grade: B (2GIS collection grade)`. | Produces real variance, is honestly derived from the nature of each evidence item, and satisfies §2.3 without inventing a semantic. | §2.3, D7 |
| **D4** | **DEMO records: 8, contained, OFF by default.** Separate in-memory array, required `recordType` discriminator with no default (a record lacking it is rejected at load), `DEMO-` id prefix, excluded from all market statistics unless demo mode is on, non-dismissible banner when on, every metric carries `containsDemo`, exports self-identify, no promotion path. Each record exists to make one specific code path testable. | §6 explicitly permits clearly-marked demo records, and without them ~40% of the UI (GLA, occupancy, vacancy, tenants, parking, pipeline) is permanently unreachable – defeating §69. Containment is the mechanism that keeps §2.2 enforceable. | §6, §2.2 |
| **D5** | **No fabricated context layers.** No metro dataset exists in the repo and the OSM/Overpass API is blocked by network policy (verified: 403). The metro/roads/landmarks layer slot exists, is **empty**, states why, and accepts a GeoJSON import. Approximating station coordinates from memory is explicitly rejected. | §10 permits context layers only "if they can be implemented reliably"; §2.2 forbids fabricating coordinates. | §10, §2.2, C3 |
| **D6** | **Duplicates are never auto-merged.** 6 source-flagged exact-coordinate pairs + 3 unflagged sub-30 m pairs + 1 duplicate name. Review queue with three verdicts (*same building* / *different buildings* / *undecided*), default **undecided**, counted normally but flagged on the map and in headline counts. | Merging destroys data on an unverified judgement; ignoring double-counts buildings in every supply statistic. Both failure modes are worse than disclosure. | D9, M4 |
| **D7** | **Suspected non-office entities are flagged, not deleted.** `_meta.entityReview ∈ {unreviewed, confirmed_bc, suspected_non_bc, name_quality}`. Pre-flagged: a consultancy listed twice, an association, and four generic/placeholder names. A default-**off** analytics toggle "Exclude suspected non-office records" states its effect numerically. | §4 restricts the MVP to business centres, but a keyword scrape pulls in tenant firms. Deletion is unverified judgement; disclosure turns a data defect into a working QA workflow. | §4, D10 |
| **D8** | **Staleness engine ships with an honest disclosure.** Per-field refresh classes (fast 60 d / slow 365 d / stable 1095 d, user-editable). `nextRefreshAt` is always **computed** from `lastVerifiedAt`, never stored, so it cannot drift. The UI states plainly that all observed records share one collection date (2026-07-19, 59 days old – 1 day from the fast-field threshold), so staleness cannot yet differentiate them. | Any threshold under 59 days flags all 148; any over it flags none. The engine is correct and becomes meaningful the moment a second date exists – which the editor lets a tester create. | §19, §23, D8 |
| **D9** | **Completeness uses count bands, not percentage bands.** `none (0 critical fields) / minimal (1–2) / partial (3–5) / good (6–8)` over the 8 critical fields. | Percentage bands collapse all 148 records into one bucket. Count bands discriminate (132 / 16) and read commercially. | §19 |
| **D10** | **Rent chart adapts to n.** Strip plot of individual values when `n < 30`; histogram when `n ≥ 30`. | A 7-bin histogram over 16 points is noise that implies a distribution the data cannot support. Form follows the data's job. | §14 |
| **D11** | **The GLA histogram ships and renders its insufficient-data state** (0/148 observed), and becomes live under demo mode (7 records) or after an edit. A **Data coverage by field** chart is added as a fifth chart. | Keeps the §14 requirement instead of dropping it, while adding the chart this dataset genuinely supports – which is also the §37 moat argument made with evidence. | §14, §29, M14 |
| **D12** | **One left rail + one tabbed right rail + modal workspaces.** Left rail tabs: `filters` \| `results` (this *is* §12's map / map+list). Right rail tabs: `property` \| `analytics` \| `ai` \| `layers`. Compare (R7) and the Data workspace (R8) are **modal overlays**, not rail tabs – they need full width for tables. Location analysis lives inside the Property tab. Binding layout detail is `03-information-architecture.md` §1–§2, including the P1–P9 collision rules and the exact track widths; the map is never narrower than 560 px at ≥1280 or 520 px at 1024–1279. | §7 lists seven simultaneous regions; §24 forbids crowded dashboards and demands a large usable map. Tabs plus two modals resolve the contradiction without dropping any region. | §7, §24, C9 |
| **D13** | **No progress theatre for the AI.** The deterministic engine completes in <5 ms. Instead of staged fake progress, every answer carries a **"How this was answered"** disclosure: matched intent, slots extracted, tools called with arguments, record counts. | Simulating latency to imply intelligence is the presentational cousin of the fabrication §47 forbids, and it corrupts the UX finding §54 exists to gather. Same transparency goal, honest mechanism. | §53, §54 |
| **D14** | **English-only UI, 100 % of strings centralised.** `GEO.i18n.en` holds every user-visible string; RU/UZ tables are scaffolded and empty; the language selector is present and disabled with a reason. Zero string literals in markup or logic. | §27 explicitly permits English-first. Adding a language then becomes data entry, not a refactor. | §27 |
| **D15** | **Two distinct reset commands**, separately confirmed: *Restore original dataset* (drop local edits, keep session) and *Full reset* (clear all `geo.mvp.v1.*` keys and reload). Plus `index.html#reset`, handled **before** app init so a corrupted state is always recoverable without devtools. | §21's single ambiguous "Reset Demo Data" collides with the DEMO-record concept (D4) and offers no escape from a broken state – the most common user-testing event. | §21, C10, M3 |

---

## 3. Technical constraints (violating any of these breaks the deliverable)

| # | Constraint | Rule |
|---|---|---|
| **T1** | Runs from `file://` | No `fetch`, no `XMLHttpRequest`, no ES modules, no `import`/`export`. Classic `<script>` only. All data inlined by the assembler. |
| **T2** | **Leaflet default icons are broken here** | `leaflet.case.js` derives its image path from the `<script>` element's `src`; an **inlined** script has no `src`, so `L.Icon.Default` 404s every marker. Use **`L.divIcon` exclusively**. Never instantiate `L.Icon.Default`. Do not use `L.Control.Layers` (it loads `layers.png`) – ship the custom layer control. |
| **T3** | `localStorage` is opaque-origin on `file://` | Feature-detect with a real `setItem`/`getItem`/`removeItem` round-trip inside `try/catch`. On failure fall back to an in-memory store and show a persistent notice. The app must be fully functional read-only without storage. Namespace every key `geo.mvp.v1.*`. |
| **T4** | Storage quota | Persist a **diff against the shipped seed**, never a full copy. Cap undo at 20 entries. Handle `QuotaExceededError` explicitly with an export prompt. |
| **T5** | Encoding | `<meta charset="utf-8">` is the **first** element of `<head>`. The assembler writes UTF-8 without BOM and asserts it. The data is largely Cyrillic; there is no HTTP header to rescue a wrong guess on `file://`. |
| **T6** | Inline JSON safety | The assembler escapes `<` as `<` in every embedded JSON payload (a `</script>` sequence inside a scraped note would terminate the block) and strips U+2028/U+2029. |
| **T7** | Tiles may be unavailable | `tileerror` → neutral graticule background + one-line notice. Markers, polygons, filters, analytics, compare, radius and AI must all work with **zero tiles**. OSM attribution is mandatory and non-removable. |
| **T8** | Clustering | `disableClusteringAtZoom: 13`, `maxClusterRadius: 40`, `spiderfyOnMaxZoom: true`. Force-expand the cluster containing the selected record. Clusters are chrome: `--surface` fill, `--line-strong` border, ink text – never the data colour. |
| **T9** | Mixed-script search | 100 of 109 addresses are Cyrillic; 12 of 148 names are Cyrillic; district keys are Latin. Normalise query and target: lowercase, strip diacritics, apply an explicit RU↔Latin transliteration table **both ways**. Precompute a `_search` blob per record at boot. `Мирабад` and `Mirobod` must both find the same district; `Infinity Business Center` (Latin C) must find `Infinity Business Сenter` (Cyrillic С). |
| **T10** | Assembler drift | Never hand-edit `index.html`. `python3 build.py --check` must pass before delivery. |

---

## 4. Module layout

Authored as modules under `src/`, shipped as one file. `src/manifest.json` declares the order;
`build.py` inlines each into its own `<script>` tag so a syntax error names the real file.
Mapping to the §30 conceptual module list is given in the right column.

| file | responsibility | §30 module |
|---|---|---|
| `js/00-core.js` | `GEO` namespace, dom/util helpers, event bus, date maths, number formatting | – |
| `js/01-i18n.js` | flat string table + `t(key, vars)` | 10 |
| `js/02-schema.js` | field registry, enums, validation, unknown rules, record shape | 1 |
| `js/03-data.js` | repository: normalise, index, persist, demo seam, import/export | 1, 17 |
| `js/04-quality.js` | confidence, staleness, completeness, duplicates, conflicts | 16 |
| `js/05-state.js` | the single source of truth + subscribe/render | – |
| `js/06-filters.js` | filter model + predicate engine + coverage-driven availability | 3 |
| `js/07-search.js` | normalisation, transliteration, search index | 4 |
| `js/08-analytics.js` | `known()`, metrics, aggregations, coverage lines | 6 |
| `js/09-geo.js` | haversine, radius bands, competitive set, point-in-polygon | 8 |
| `js/10-charts.js` | inline-SVG chart primitives + table view | 6 |
| `js/11-map.js` | Leaflet, divIcons, district polygons, layers, radius circles | 2 |
| `js/12-panel-filters.js` … `js/18-panel-quality.js` | filter rail, list, detail drawer, analytics, compare, location, data quality | 3, 5, 6, 7, 8, 16 |
| `js/19-admin.js` | data editor, undo, import/export, resets | 9, 17 |
| `js/20-ai-tools.js` | tool registry (typed, read-only vs mutating) | 13 |
| `js/21-ai-intents.js` | deterministic intent catalogue + slot extraction | 12 |
| `js/22-ai-engine.js` | planner/executor + provider-adapter seam + session state + audit log | 11, 15 |
| `js/23-ai-panel.js` | AI UI, AI Layers panel, session log | 11, 14 |
| `js/24-selftest.js` | `?selftest=1` assertions against the oracle | – |
| `js/99-boot.js` | wiring and init | – |

---

## 5. State architecture – the §59 guarantee

§59 requires that anything the AI does is visible in the manual controls. Discipline will not
achieve this; structure will.

```js
GEO.state = {
  get(),                        // deep-frozen snapshot
  set(patch, meta),             // the ONLY mutation path; meta = {source:'user'|'ai'|'boot', action}
  subscribe(fn),                // fn(state, patch, meta)
};
```

Rules, binding on every module:

1. **One state object.** Filters, selection, compare tray, map view, active tab, AI layers, AI
   session, role and demo mode all live in `GEO.state`. Nothing is stored in a DOM attribute,
   a closure variable or a component instance.
2. **`set()` is the only writer.** No module mutates state directly.
3. **Every panel re-derives from state.** `render(state)` is pure with respect to its region.
   **No module may write to another module's DOM.**
4. **The AI is just another caller of `set()`**, with `meta.source = 'ai'`. It has no private
   path to the map or the filters. §59 then holds by construction: the filter panel renders from
   the same `state.filters` the AI wrote.
5. **Every `set()` is appended to the session log** with source, action, and the tools involved –
   which is the §61 audit log for the MVP.

---

## 6. Data model (built – see `data/seed.json`)

Envelope: `schemaVersion, generatedAt, city, assetType, refreshDays, criticalFields,
fieldRefreshClass, evidenceProfiles, districts[], sources[], counts, records[]`.

Record: flat value fields + `tenants[]` + `amenities[]` + `_evidence` + `_meta` + `_history`.
Flat (not nested groups) so that the AI tool layer, the filter engine, the editor form and the
completeness score can all address a field by a single name, and so the whole UI can be generated
from one field registry.

**Provenance by reference.** `_evidence[field]` is either a **profile id string** (e.g.
`"2GIS-RENT"`) or `{p: "<profileId>", ...overrides}` when one field diverges – which is what the
editor writes on re-verification. Profiles live once in `evidenceProfiles`. Dates default to the
record's `_meta.collectedAt` / `lastVerifiedAt`. `nextRefreshAt` is **computed**, never stored.
This cut the seed from 532 KB to 227 KB and removed a whole class of drift bug.

Status semantics that a naive implementation loses:

- `tenantsStatus ∈ {not_collected, partial, complete, confirmed_empty}` – §36 requires "no tenants
  entered" to be distinguishable from "confirmed empty building". `tenants: []` alone cannot say which.
- `amenitiesStatus` likewise.
- `vacancyPct: 0` is a **measured zero**; `vacancyPct: null` is unknown. `DEMO – Eta House`
  carries the measured zero specifically to test that the two never collapse.

---

## 7. Analytics contract

```js
GEO.analytics.known(rows, field)   // -> array of non-null values. THE ONLY READER.
GEO.analytics.metric(rows, field, kind, opts)
// -> { value, n, N, unit, sufficient, coverageText, containsDemo, reason }
```

- **Every** metric returns `n` (contributing records) and `N` (records in the current selection),
  and renders the coverage line `Based on {n} of {N} properties with verified {field}`
  (`property` singular at n=1; `No properties in the current selection have verified {field}` at n=0).
- **Sufficiency**: counts are always sufficient (a count of 0 is a fact). Mean/median require
  **n ≥ 3**; distributions require n ≥ 3. Below that, render **Insufficient verified data** with
  the actual n. Rationale: a "district average rent" computed from one building is not an average,
  and 2 priced records in Yashnobod would otherwise publish a two-point market benchmark.
- **Unweighted** per property, stated in the label (`Average asking rent (per property, unweighted)`).
  GLA-weighting is impossible here – GLA coverage is 0 % – and silently switching later would
  change the number without changing the label.
- **Median** of an even sample = mean of the two central values. Floating-point noise is removed at
  the display boundary only (`round(x + 1e-12, 2)`), never in the stored value.
- **Radius bands are cumulative** (3 km includes 1 km) and the subject is **excluded** from its own
  counts. Haversine with `R = 6371008.8 m`, stated in the panel.
- **Competitive set** = proximity + class band ±1. Records with unknown class are neither silently
  included nor silently dropped: they are returned in a separate `proximityOnly` bucket and counted
  in the label. The heading is exactly **"Suggested competitive set"** (§17).

---

## 8. The oracle – expected values at seed state

Computed by `tools/oracle.py` from `data/seed.json`. The app must **re-derive** every one of these
at runtime; none may be hard-coded. `?selftest=1` asserts them.

| quantity | value |
|---|---|
| records | 156 total = **148 observed** + 8 DEMO |
| coverage (observed) | name 148, districtKey 148, address 109, officeClass **16**, askingRent **16**, everything else **0** |
| by district (geometry) | Mirobod 28, Mirzo Ulugbek 26, Yakkasaroy 24, Yunusobod 22, Yashnobod 17, Chilonzor 13, Shayxontohur 10, Olmazor 4, Sergeli 3, Uchtepa 1, **Yangihayot 0, Bektemir 0** – sum 148 |
| by class | A+ 4, A 8, B+ 1, B 3, C 0, **Not recorded 132** |
| UX-1 class A + A+ | **12** properties (136 excluded, class not recorded) |
| asking rent | n **16** of 148 · mean **32.22** · median **32.30** · min 19.9 · max 44.7 |
| UX-3 rent < 30 | **8** properties |
| rent by district | yunusobod n=5 mean **33.76** · mirobod n=4 mean **28.58** · yakkasaroy n=4 mean **31.80** · yashnobod n=2 **suppressed** · shayxontohur n=1 **suppressed** |
| AI-3b districts by A/A+ count | **yunusobod 4** (outright top), mirobod 3, yakkasaroy 2, yashnobod 2, shayxontohur 1 |
| UX-4 radius around Trilliant | 1 km **7** · 3 km **74** · 5 km **114** (cumulative, subject excluded) |
| 3 km average known rent | **31.24**, n **11** of 74 |
| 3 km class mix | A+ 2, A 7, B+ 0, B 2, C 0, Not recorded 63 |
| competitive set (3 km, ±1 band of A+) | **9 qualified**, 63 proximity-only, 2 excluded by class |
| AI-7b three highest known rents | Trilliant 44.7, Nest one 40.6, Forum Business Center 39.7 |
| duplicates | 12 records in 6 source-flagged groups; **9 pairs under 30 m** (6 flagged, **3 unflagged**); 1 duplicate name |
| district label conflicts | **10** |
| record age | collected 2026-07-19 = **59 days**; fast-field interval 60 d → **due in 1 day** (ageing, not yet stale) |
| completeness (8 critical fields) | none 132 · minimal 16 · partial 0 · good 0 |
| with demo on | gla 0→7, gba 0→7, floors 0→7, occupancy 0→5, vacancy 0→5, parking 0→7, status 0→8, yearOpened 0→7; total demo GLA 89,000 m²; 6 demo records above 5,000 m² |

> **Note on `Trilliant`.** It is the dataset's highest rent (A+, $44.7) and D1 moves it from
> Mirzo-Ulugbek to Yunusobod. That single correction changes the top-ranked district for both
> class-A supply and average rent. Any expected value in another document computed from the source
> label is superseded by this table.

---

## 9. AI contract

```js
GEO.ai.tools.register({ id, access:'external'|'internal', mutates:boolean, args, run(args, ctx) })
GEO.ai.interpret(utterance, context) -> Plan      // swappable: local engine now, LLM later
Plan = { intent, slots, steps:[{tool, args}], explain }
```

- The UI depends only on `interpret()` + the registry. No provider specifics leak upward.
- Mutating tools require explicit user confirmation (§60); in the prototype, anything that would
  need a backend returns *"Requires confirmation and a backend – not available in the prototype"*.
- **Every response object carries all six §46 blocks**: `answer, analysis, mapActions,
  dataCoverage, limitations, sources`. A block is never omitted; when empty it says why.
- Every figure is tagged **PLATFORM DATA · CALCULATED · EXTERNAL · AI INFERENCE · ASSUMPTION ·
  UNAVAILABLE** (§2.8, §47).
- **`UNAVAILABLE` is a first-class success.** When a requested field has zero coverage the engine
  must refuse, name the missing field with its coverage, leave the previous selection untouched,
  and offer an answerable alternative (§62). `"Only buildings above 5,000 m²"` against the observed
  set is the canonical case and is an acceptance test, not an error path.
- Session context persists across turns: selected property, active filters, last result set, last
  layer. `"its competitors"` resolves to the selected property, or errors clearly if nothing is selected.
- AI layers: `{id, name, criteriaHuman, criteriaMachine, recordIds, count, style, visible, createdAt}`.
  A layer is a **saved result set**; a filter is a **live predicate**. Removing a layer removes its
  map artefacts (circles included).

---

## 10. Acceptance

`01-product-spec.md §5` holds the Given/When/Then scenarios (UX-1…10, AI-1…8, X-1…12).
Expected numbers there that were computed from source district labels are **superseded by §8 above**.

Definition of done: all UX and AI scenarios pass in a real browser · zero console errors ·
zero network requests other than OSM tiles · `build.py --check` clean · `?selftest=1` all-pass ·
no inert control anywhere (every button acts or is disabled with a visible reason) ·
375 px layout has no clipping, overlap or horizontal scroll · `prefers-reduced-motion` honoured.
