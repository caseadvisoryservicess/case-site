# MVP Product Specification — Geoanalytics HTML Prototype

**Document:** `geo-mvp/docs/01-product-spec.md`
**Brief step:** §65 Step 1 ("Restate the MVP in a short product specification")
**Authoritative source:** `geoanalytics_html_mvp_master_prompt.md` (69 sections). Section references below are to that brief.
**Status:** binding for implementation. Where this document and the brief disagree, the disagreement is recorded in §8 (Conflicts) — it is never silently resolved.
**Owner of the direction:** Humyunmirzo Mirkamolov (§33).

---

## 0. Seed dataset facts (verified by inspection — all acceptance numbers derive from these)

Source file: `/home/user/case-site/case-site/os/data/geo_master/bc.json` — 148 records, collected 2026-07-19, provider 2GIS, single source each.
Source file: `/home/user/case-site/case-site/os/data/tashkent_districts.geojson` — 12 district MultiPolygons, `Toshkent shahar chegarasi (2024)`.

| Fact | Value |
|---|---|
| Records | 148 |
| Records with `class` | 16 (A 8, A+ 4, B 3, B+ 1) |
| Records with `rent` | 16 — **exactly the same 16 records** that have `class` |
| Rent values (USD/m²/month, unit not stated in source) | 19.9, 24.8×3, 29.8×4, 34.8×4, 37.8, 39.7, 40.6, 44.7 |
| Mean known rent | 32.2 (515.5 / 16) |
| Median known rent | 32.3 ((29.8+34.8)/2) |
| Records with `address` | 109 |
| Records with `gla`, `gba`, `floors`, `parking`, `year`, `status`, `avail`, `sale`, `website`, `phone`, `sourceUrl` | **0** |
| `data_confidence` | `"B"` for all 148 |
| `_verification` | `"online"` for all 148; `source_count` = 1; `coordinate_accuracy` = `"single"` |
| Duplicate-suspect records | 12 records in 6 coordinate-collision groups (`DUP-COORD-0022`…`0027`) |
| Coordinate bounds | lat 41.2207–41.3704, lng 69.1791–69.3623 |
| Districts represented | 10 of 12 (Yangihayot 0, Bektemir 0) |
| Known data defects | 1 exact duplicate name (`Infinity, компания консалтинга в сфере недвижимости` ×2); `Infinity Business Сenter` contains U+0421 Cyrillic ES; several records are not business centres (`Авто`, `Carvon, офис`, `Семург`, `Chilonzor`); 1 district value in Russian (`Алмазарский район`) |
| Metro / roads / landmark datasets | **do not exist** in the repo; Overpass/OSM API blocked by network policy |

Derived completeness distribution (weights in §5 of `03-data-schema.md`; scale 0–100): **39 records score 15, 93 score 25, 16 score 55.** Nothing scores ≥80.

---

## 1. Product definition and the single MVP use case

**Definition.** GEODESK is a browser-based location-intelligence workspace for commercial real estate in Uzbekistan. It puts a verified, provenance-tracked property dataset on a map, lets a professional filter, inspect, compare and run simple radius analysis against it, computes every statistic with an explicit denominator, and exposes the same capabilities through a natural-language assistant that calls structured platform functions rather than inventing answers (§1, §38, §47). The MVP is a **product-logic validation prototype**, not a product: no backend, no auth, no database, no hosting (§28).

**The single MVP use case (§3, §4):**

> A commercial real estate professional working on **Tashkent office space** opens the map, narrows 148 business centres down to a relevant set using district / class / rent / data-quality filters, opens one property, checks what is actually known about it and how reliable that is, sees who competes with it within 1/3/5 km, compares it against two or three alternatives, and reads market aggregates that never overstate their own coverage.

Nothing outside that sentence is in the MVP. One city, one asset class, one workflow, plus the AI interaction model layered over it (§67).

**Explicit non-goal:** the prototype must not read as "here are buildings on a map" (§67). Every screen states what is known, what is not known, and how confident the platform is — that disclosure *is* the product differentiator (§2.7, §19, §37).

---

## 2. Working product name

The name must be neutral, must not be **ZAKY** (§8 — under consideration, not approved), and must be replaceable in one edit.

| # | Candidate | For | Against |
|---|---|---|---|
| A | **GEODESK** | Reads immediately as a working tool label, not a brand claim; one word; transliterates cleanly (Геодеск / Geodesk); does not compete with the pending ZAKY decision; descriptive of "analyst's desk over geodata". | A `GeoDesk` OSM library exists — irrelevant for an internal prototype, relevant if it were ever adopted commercially. |
| B | **LOCUS** | Short, premium, Latin "place", strong typographic wordmark. | Reads as a *finished brand proposal* — it would compete with ZAKY politically, which §8 is explicitly trying to avoid. High trademark collision risk. |
| C | **CASE GEO** | Zero ambiguity about ownership; leverages existing brand equity. | §33 forbids designing this as "merely an internal CASE dashboard"; pre-commits the entity structure before the spin-out decision. |

**Selected: GEODESK.** It signals "working title" by its plainness, which is exactly what §8 asks for, and it is the only candidate that carries no political or structural pre-commitment.

**Replaceability requirement (mandatory, testable):**

```js
// geo-mvp/src/00-config.js — the ONLY place the product is named.
GEO.PRODUCT = {
  name:        'GEODESK',            // header wordmark + document.title
  short:       'GD',                 // favicon / compact chips
  tagline:     'Commercial real estate location intelligence',
  provisional: true                  // renders the "WORKING TITLE" chip in the header
};
GEO.STORAGE_PREFIX = 'geo.mvp.v1.';  // MUST NOT derive from PRODUCT.name — a rename must not orphan saved data
```

Rules: (a) no other file, string, CSS class, id or localStorage key may contain the literal `GEODESK`; (b) `document.title` and the header wordmark are assigned from `GEO.PRODUCT.name` at boot; (c) when `provisional === true` the header shows a small `WORKING TITLE` chip with the tooltip "Product name not final". QA check: `grep -ci geodesk` over the shipped `index.html` returns exactly the occurrences inside `GEO.PRODUCT` (expected: 1).

---

## 3. Scope

Every major capability of the brief appears in exactly one of the three tables below.

### 3.1 IN — built and working in this prototype

| # | Capability | § | Implementation note |
|---|---|---|---|
| 1 | Tashkent-only map, centred on the city, fit to data bounds | §3, §9 | Leaflet 1.9.4, vendored; OSM raster tiles; graceful offline degradation (grey canvas + "Tiles unavailable offline" notice, all vector/marker logic still works) |
| 2 | Business Centres as the only asset type | §4 | `assetType: 'office'` written on every record |
| 3 | 148 real records rendered from one structured dataset | §6, §20 | Inline `GEO.SEED.businessCenters`; no `fetch()` (must run from `file://`) |
| 4 | Full BC object model (identification / property / commercial / tenants / amenities / evidence) | §5.1–§5.6 | All fields exist in schema and render; most are empty in the seed and render as "Not recorded" |
| 5 | Property markers, hover, click-to-open, selected-state highlight | §9 | Marker styling encodes **office class** (A+/A/B+/B/C/not recorded), per §9 |
| 6 | Marker clustering | §9 | Leaflet.markercluster, vendored |
| 7 | Fit-to-results, reset map, fullscreen map | §9 | |
| 8 | District boundary layer + district highlighting | §9, §10 | From `tashkent_districts.geojson`, 12 polygons |
| 9 | Radius overlays (1/3/5 km) | §9, §16 | Circles drawn in map CRS, labelled with radius + count |
| 10 | Layer visibility control (Core layers) | §10 | Business Centres, Districts |
| 11 | Left filter panel: name search, district, class, status, GLA range, rent range, occupancy/vacancy, parking, amenities, data confidence | §11 | Coverage-aware (see §3.4 rule R2) |
| 12 | Live "X properties found" counter | §11 | Recomputed on every state change |
| 13 | Reset filters / Collapse filters / "More filters" disclosure | §11 | |
| 14 | Map ↔ Map+List view toggle; list cards; click list item selects on map | §12 | |
| 15 | Property detail drawer: Overview, Key metrics, Commercial, Tenants, Amenities, Location, Data quality | §13 | |
| 16 | Property actions: Compare, Analyze location, Ask AI about this property, Copy coordinates, Open source | §13 | "Open source" is disabled with the reason "No source URL recorded" when `sourceUrl` is empty (148/148 at seed) |
| 17 | Light analytics: 9 metric cards + 4 charts, filter-reactive | §14 | Hand-rolled inline SVG charts (no chart library) |
| 18 | Denominator disclosure on every statistic | §14, §36 | "Based on N of M properties with verified X" — always rendered, never optional |
| 19 | "Insufficient verified data" substitution | §14 | Replaces the value when coverage = 0 or n < 3 for mean/median |
| 20 | Compare 2–4 properties, 13-row table, neutral missing-data treatment, no winner | §15 | |
| 21 | Analyze Location: 1/3/5 km counts, nearby known rent, nearby known GLA, nearby class distribution | §16 | Haversine; subject property excluded from its own counts |
| 22 | Suggested competitive set, user-editable (add/remove) | §17 | Split into "qualified" and "class not recorded" groups — see §3.4 rule R5 |
| 23 | Global search: name, address, district (tenant when data exists) | §18 | Homoglyph + diacritic folding required (rule R6) |
| 24 | Data-quality UX: confidence badge, `Last verified: DD MMM YYYY`, stale indicator, missing-critical indicator, next-verification date | §19, §23 | |
| 25 | Admin / Data Editor: add, edit, delete, change coordinates, change commercial fields, add source, change confidence, change last-verified date | §21 | Prototype-only; no auth |
| 26 | localStorage persistence of all edits | §21 | Key prefix `geo.mvp.v1.` |
| 27 | Export JSON / Import JSON / Reset Demo Data | §21 | Round-trip lossless (UX-10) |
| 28 | Demo-record labelling mechanism | §6 | `provenance.isDemo` / `provenance.userAdded` → amber "Added locally — not verified" badge |
| 29 | AI panel: NL input, suggested prompts, session history, result cards, apply-to-map | §40, §54 | Deterministic local intent engine; no network, no LLM |
| 30 | AI intent coverage for the 10 §54 commands + the 8 §63 tests | §41, §54, §63 | See §5.2 |
| 31 | AI tool registry (16 structured functions) | §45, §56 | AI calls functions; never simulates clicks |
| 32 | AI Layers panel: show/hide, rename, remove, inspect criteria, record count | §57 | |
| 33 | AI session context (pronoun resolution + progressive narrowing) | §44, §58 | Stored in memory + mirrored to localStorage |
| 34 | AI↔manual filter synchronisation, both directions | §11, §59 | An AI-applied filter is visibly checked in the filter panel |
| 35 | AI structured response: Answer / Analysis / Map actions / Data coverage / Confidence & limitations / Sources | §46 | Every response renders all six blocks; empty blocks render "—", never hidden |
| 36 | AI refusal behaviour when data is insufficient | §47, §62 | Must name the missing field and the denominator |
| 37 | Execution status strip ("Understanding request → … → Preparing answer") | §53 | |
| 38 | Lightweight AI session log, exportable | §61 | timestamp, prompt, intent, tools called, layers created, records touched |
| 39 | Session role switch: Internal (default) / External (client preview) | §34, §39, §60 | Gates the Admin editor, internal notes and internal AI tools. Real product testing, not a permissions system |
| 40 | Modular source organisation (17 conceptual modules) | §30 | Separate files in `geo-mvp/src/`, inlined by a python assembler into one self-contained `index.html` |
| 41 | Centralised UI strings (i18n dictionary) | §27 | `GEO.I18N.en` complete; `ru` / `uz` dictionaries present but empty with EN fallback |
| 42 | Design system: CASE brand tokens, DM Serif Display + Inter, restrained palette | §24 | `--cream:#F5F3EF --white:#FFF --ink:#1A1714 --red:#B01F22` |
| 43 | Subtle animations + `prefers-reduced-motion` | §25 | ≤200 ms transitions; no animation on map pan/zoom |
| 44 | Responsive: desktop-first, tablet, mobile drawers/sheets | §26 | Panels become bottom sheets under 768 px |
| 45 | Header: product name, city selector, property-type selector, global search, Analytics, AI, data-quality indicator, language selector, settings | §8 | Single-option selectors list future options as **disabled with a reason**, never as fake choices |
| 46 | Data-quality / last-updated indicator in header | §8 | "148 records · 1 source · updated 19 Jul 2026 · 0 field-verified" |

### 3.2 ARCHITECTURE-ONLY — designed for, schema/interface present, not built

| # | Capability | § | What exists in the prototype |
|---|---|---|---|
| A1 | Other Uzbek cities (Samarkand, Bukhara, Fergana, Andijan, Namangan) and Central Asia | §3 | `GEO.CITIES` registry with one active entry; city selector lists the rest disabled with "Not in MVP" |
| A2 | Other asset types (retail, residential, hotel, warehouse, land, mixed-use, industrial) | §4, §31 P2 | `assetType` field + `GEO.ASSET_TYPES` registry; type selector lists the rest disabled |
| A3 | Tenant records | §5.4 | `tenants: []` array in schema, rendered section, searchable; **no tenant editor UI** — tenants enter via JSON import only |
| A4 | Field-level provenance for every field | §2.3, §5.6 | `evidence{}` map keyed by field name; populated for the seed's real fields, structurally ready for the rest |
| A5 | Historical value series | §2.4 | `history: []` on each record with `{field, value, from, to, source}` shape documented; never written by the MVP |
| A6 | Field-collection metadata (collector ID, GPS, photos, reviewer, QC status) | §5.7, §22 | Fields reserved in schema + documented; no collector app, no photo upload |
| A7 | Per-field refresh schedules (fast/slow/stable) | §23 | `GEO.REFRESH_POLICY` constant drives the stale computation; not user-editable |
| A8 | Context layers: metro stations, major roads, major landmarks | §10 | Layer slots exist in the layer panel, **disabled**, labelled "No verified dataset loaded". Populated by dropping a GeoJSON into `GEO.SEED.contextLayers`. See §8 Conflict C1 |
| A9 | Russian and Uzbek-Latin UI | §27 | Dictionaries + fallback chain; selector enables a locale only at ≥95% key coverage — at ship only `en` qualifies |
| A10 | LLM provider adapter | §55 | `GEO.AI.providers` interface (`parse`, `plan`, `explain`); `LocalIntentProvider` is the only implementation |
| A11 | AI task planner for multi-step compound requests | §52, §53, §64 | A plan is an ordered array of registry tool calls; the MVP only emits single-step and two-step plans |
| A12 | Internal/external AI permission model | §39, §49, §60 | Every registry tool declares `access: 'external' \| 'internal'`; the role switch enforces it client-side |
| A13 | AI-generated field-collection tasks | §50 | Read-only **verification queue** (ranked) is built; task creation returns "Requires confirmation and a backend — not available in the prototype" |
| A14 | AI access to CASE research / leasing / tenant / brand datasets | §49 | Documented join keys only |
| A15 | Derived analytical layers (office density, rent concentration, competitive intensity, clusters) | §42 | Layer type registered; the MVP refuses to build them and states which field is missing (§42 last line) |
| A16 | Production AI audit log | §61 | Session log has the production field shape; not persisted server-side |
| A17 | Roles, accounts, saved analyses | §31 P7, §39 | Role constant only |

### 3.3 OUT — not in this prototype in any form

| Capability | § | Reason |
|---|---|---|
| Node/Python backend, auth server, production DB, production API, cloud hosting | §28 | Explicitly forbidden |
| Payments, subscriptions, monetisation screens | §28, §32 | Explicitly forbidden |
| Real LLM calls / any network request other than map tiles | §54 | "keyword/intent parsing rather than a real LLM" |
| AI retrieval of external web information | §48 | Would require network + provenance rules not yet defined |
| Population, demographic, mobility, traffic, footfall, CCTV, mobile-phone heatmaps | §10, §31 P4 | Deferred |
| Drive-time isochrones, walking catchments, white-space analysis, site scoring | §10, §16, §31 P5 | "Do not add sophisticated drive-time isochrones yet" |
| Retail brand / chain / occupier database | §10, §31 P3 | Deferred |
| 3D buildings, extrusions, terrain | §2.5 | "3D is not required" |
| Shopping centres, street retail, residential, hotels, warehouses, land, mixed-use, industrial **data** | §4 | Only the type registry is architectural (A2) |
| Other cities' **data** | §3 | Only the city registry is architectural (A1) |
| Real historical time-series data | §2.4 | Schema only (A5) |
| Field-collector mobile application | §22 | "Do not build a complete collector application now" |
| Server-side permissions and security enforcement | §60, §69 | Post-approval stage |
| Build step / bundler / npm dependency tree | §29 | Must open from `file://` |
| Chart library, UI framework, CSS framework | §29 | "minimal external dependencies" |

### 3.4 Cross-cutting implementation rules (binding)

| ID | Rule | Source |
|---|---|---|
| **R1** | `hasValue(v)` is `false` for `null`, `undefined`, `''`, `[]`, `{}` and **`true` for `0`**. A 0 % vacancy, a 0-space parking count and a $0 rent are values; missing is not zero. Every aggregate iterates only over `hasValue` entries. | §36 |
| **R2** | A filter whose underlying field has **0 coverage in the current dataset** renders **disabled**, with the label "`0 of 148 records have this field`". It is not hidden (§11 requires it) and not clickable (§29 forbids fake controls). At seed this disables: GLA range, occupancy/vacancy, parking, amenities, status. | §11, §29, §2.7 |
| **R3** | Every displayed statistic carries a denominator line `Based on N of M properties with verified <field>`. If `N === 0`, or `N < 3` for a mean/median, the value is replaced by **"Insufficient verified data"** and the denominator line still renders. | §14, §36 |
| **R4** | A class/status filter **excludes** records whose class/status is not recorded, and the result header states how many were excluded for lack of data. Missing is never silently bucketed into a value. | §36 |
| **R5** | A suggested competitive set is returned in two labelled groups: **Qualified** (within radius AND class recorded AND within ±1 class band of the subject) and **Proximity only — class not recorded** (within radius, class missing, counted but explicitly not qualified as competitors). The panel header always reads "Suggested competitive set". | §17 |
| **R6** | Search and district matching normalise: lowercase, trim, strip diacritics, and fold Cyrillic↔Latin homoglyphs (`С→C`, `о→o`, `е→e`, `а→a`, `р→p`, `х→x`, `у→y`, `к→k`, `в→b`, `м→m`, `т→t`, `н→h`). Required: `Infinity Business Сenter` contains U+0421 and must be findable by typing `Infinity Business Center`. | §18 |
| **R7** | District identity is the geojson `name` (see mapping table below). `bc.json` spellings become aliases, not identities. | §3, §9 |
| **R8** | Confidence letter grades map: `A`→High, `B`→Medium, `C`→Low, empty→Unknown ("Not verified"). The badge text also discloses source depth: `Medium · 1 source · desk (map service) · 19 Jul 2026`. | §2.3, §19 |
| **R9** | The rent **unit** is not recorded in the source. It is stored as `rentCurrency:'USD'`, `rentUnit:'m2/month'`, `rentUnitAssumed:true`, and every rent display carries an asterisk footnote "Unit assumed USD/m²/month; not stated by the source". | §2.2, §2.8 |
| **R10** | Records that are evidently not business centres (`Авто`, `Carvon, офис`, `Семург`, `Chilonzor`, the two `Infinity, компания консалтинга…` rows) are **not deleted and not hidden**. They are flagged `qcFlags:['type_uncertain']`, surfaced in the verification queue, and counted in the 148. Deleting them silently would be an undisclosed editorial judgement. | §2.7, §19 |

**District identity mapping (R7):**

| `bc.json` district | Canonical `id` | Display (EN) | Display (RU) | Seed count |
|---|---|---|---|---|
| Mirabad | `mirobod` | Mirobod | Мирабад | 30 |
| Mirzo-Ulugbek | `mirzo-ulugbek` | Mirzo Ulugbek | Мирзо-Улугбек | 26 |
| Yakkasaray | `yakkasaroy` | Yakkasaroy | Яккасарай | 26 |
| Yunusabad | `yunusobod` | Yunusobod | Юнусабад | 21 |
| Yashnabad | `yashnobod` | Yashnobod | Яшнабад | 17 |
| Chilanzar | `chilonzor` | Chilonzor | Чиланзар | 12 |
| Shaykhantakhur | `shayxontohur` | Shayxontohur | Шайхантахур | 9 |
| Sergeli | `sergeli` | Sergeli | Сергели | 3 |
| Olmazor **+ Алмазарский район** | `olmazor` | Olmazor | Алмазар | 3 |
| Uchtepa | `uchtepa` | Uchtepa | Учтепа | 1 |
| — | `yangihayot` | Yangihayot | Янгихаёт | 0 |
| — | `bektemir` | Bektemir | Бектемир | 0 |
| | | | **Total** | **148** |

Districts with 0 business centres are displayed with a **true zero**, not as missing data (§36).

---

## 4. User types (§34) and what each can do in THIS prototype

| # | User type | Can do in the prototype | Cannot yet (and the UI says so) |
|---|---|---|---|
| 1 | **Developer / Investor** | See total office supply and its distribution across 12 districts; filter by class and known rent; run 1/3/5 km radius analysis around any candidate site (by selecting the nearest existing BC); read the suggested competitive set; see that pipeline data does not exist. | Pipeline analysis — `status` is recorded for 0 of 148 records, so "Operating vs pipeline" renders **Insufficient verified data**. No site scoring, no demand modelling (§31 P5, OUT). |
| 2 | **Corporate Occupier** | Filter by district + class + known asking rent; open a shortlist in Map+List; compare 2–4 buildings side by side; copy coordinates; read what is verified and what is not before contacting anyone. | Filter by available area or fit-out — `avail` is empty for all 148 (filter disabled per R2). No accessibility/commute analysis (no metro dataset — see C1). |
| 3 | **Broker / Consultant** | Use the full 148-record database as market evidence; search by name/address/district; filter on every populated field; export the filtered dataset as JSON; quote any figure with its denominator attached. | Export to XLSX/PDF, saved searches, client-branded output (not in MVP). Tenant evidence (0 tenant records). |
| 4 | **Asset Owner** | Select their own building; generate the suggested competitive set within 1/3/5 km; benchmark their asking rent against the 16 records with known rent (with the 16-of-148 coverage stated); watch the competitive set as a named AI layer. | Vacancy and occupancy benchmarking (0 coverage). Alerts, monitoring over time, historical comparison (A5). |
| 5 | **Chain / Expansion Manager** | **Effectively nothing** — honestly. §34 states this persona "will become important later when business/brand and retail datasets are added". The prototype must not pretend to serve them. They can browse the office map like any viewer. | Everything they actually need: brand database, catchment, footfall, retail supply (§31 P3/P4, OUT). This persona is validated in Phase 3, not now. |
| 6 | **Internal Geoanalytics User** (default role) | Everything above, plus: the Admin/Data Editor (add, edit, delete, re-coordinate, add sources, change confidence and last-verified date); the Data Quality view (confidence split, completeness grades, duplicate-suspect groups, missing-critical counts); the ranked verification queue; internal AI tools (`getDataCoverage`, `findDataAnomalies`, `getVerificationQueue`); the session log export; JSON import/export. | Creating field tasks, assigning collectors, QC sign-off workflow (A6, A13 — the AI answers "Requires confirmation and a backend"). |

The **role switch** (Internal ⇄ External) in Settings exists so these personas can be tested in one build: switching to External hides the Admin editor, internal notes (`_note`, `comment`), and any registry tool declaring `access:'internal'` (§60). It is a product-model test, not security.

---

## 5. Acceptance criteria — the QA checklist

Format: **Given / When / Then**, with the expected value at **seed state** (148 unedited records, localStorage cleared). Every "Then" clause is a single observable fact. A scenario passes only when every clause passes.

Numbers marked *(computed)* must equal the value the application itself computes from the live dataset — they are stated here as the expected seed-state result and must be re-derived, not hard-coded in the app.

### 5.1 UX scenarios (§35)

**UX-1 — "Show me all Class A and A+ office buildings in Tashkent."** (§35.1)
- Given the app is freshly loaded with no filters.
- When the user checks `A` and `A+` in the Office class filter.
- Then: (a) the results counter reads **12 properties found** *(computed: A 8 + A+ 4)*; (b) exactly 12 markers remain on the map (cluster counts sum to 12); (c) the result header states **"132 properties excluded — office class not recorded"** (R4); (d) the Analytics "Properties by class" chart shows A 8, A+ 4, B 0, B+ 0, C 0 and a separate "Not recorded 0" bar for the current selection; (e) no record without a class appears in the list.

**UX-2 — "Show business centers in a selected district."** (§35.2)
- Given no filters.
- When the user selects district **Mirobod**.
- Then: (a) counter reads **30 properties found** *(computed)*; (b) the Mirobod polygon is highlighted on the map and no other polygon is; (c) the map viewport fits the 30 markers; (d) selecting **Yangihayot** instead yields **0 properties found** with the message "No business centres recorded in this district" (a true zero, not "insufficient data").

**UX-3 — "Find offices with known asking rent below a selected level."** (§35.3)
- Given no filters.
- When the user sets the asking-rent maximum to **30**.
- Then: (a) counter reads **8 properties found** *(computed: 19.9, 24.8×3, 29.8×4)*; (b) the panel states **"Asking rent recorded for 16 of 148 properties. 132 properties without recorded rent are excluded from this filter."**; (c) every rent shown carries the R9 assumed-unit footnote; (d) setting the maximum back to its default restores 148.

**UX-4 — "Select one business center and see its nearby competitors."** (§35.4)
- Given the property **Trilliant** (`BC-82f0eb0b80b7`, Mirzo Ulugbek, class A+, rent 44.7) is selected.
- When the user clicks **Analyze location**.
- Then: (a) three circles are drawn at 1 / 3 / 5 km centred on Trilliant; (b) the panel reads **1 km: 7**, **3 km: 74**, **5 km: 114** *(computed, subject excluded)*; (c) "Average known rent within 3 km" reads **$31.2** with **"Based on 11 of 74 nearby properties with verified asking rent"** *(computed: 343.6/11)*; (d) "Total known GLA within 3 km" reads **Insufficient verified data — 0 of 74 properties have recorded GLA**; (e) the nearby class distribution reads A 7, A+ 2, B 2, B+ 0, C 0, Not recorded 63 *(computed)*; (f) the competitive-set panel is headed **"Suggested competitive set"** and shows **9 qualified** (class within ±1 band of A+: Orient, Nova Plaza, Forum Business Center, Infinity Business Сenter, Gross Plaza, Kayan, Nest one, Platform, Sapphire Business Center) and **63 proximity only — class not recorded** *(computed)*; (g) removing one qualified competitor drops the count to 8 and the analysis figures recompute.

**UX-5 — "Compare 3 business centers."** (§35.5)
- Given nothing is in the compare tray.
- When the user adds **Trilliant**, **Nest one**, **Forum Business Center**.
- Then: (a) the compare view opens with exactly 3 columns; (b) all 13 rows from §15 render (class, district, GLA, GBA, floors, rent, occupancy, vacancy, parking, amenities, status, last verified, confidence); (c) rows with no data for any property render the neutral token **"Not recorded"** in grey — not `0`, not `—`, not blank; (d) no cell, badge or caption declares a winner, a best value or a ranking; (e) attempting to add a 5th property is refused with "Compare supports 2–4 properties"; (f) removing down to 1 property shows "Select at least 2 properties to compare".

**UX-6 — "See office supply by district."** (§35.6)
- Given no filters.
- When the user opens Analytics.
- Then: (a) the "Business centres by district" chart shows **12 bars** — Mirobod 30, Mirzo Ulugbek 26, Yakkasaroy 26, Yunusobod 21, Yashnobod 17, Chilonzor 12, Shayxontohur 9, Sergeli 3, Olmazor 3, Uchtepa 1, Yangihayot 0, Bektemir 0 *(computed; `Алмазарский район` has been folded into Olmazor per R7)*; (b) the bar values sum to **148**; (c) the chart caption reads **"Based on 148 of 148 properties with recorded district"**; (d) clicking a bar applies that district filter and the map highlights the polygon.

**UX-7 — "Identify records that have stale or low-confidence data."** (§35.7)
- Given no filters.
- When the user opens the Data Quality view.
- Then: (a) the confidence split reads **High 0 · Medium 148 · Low 0 · Unknown 0** *(computed from `data_confidence:"B"`)*; (b) the completeness split reads **Complete (≥80) 0 · Partial (40–79) 16 · Sparse (<40) 132** *(computed)*; (c) the stale count reads **0 properties past their next verification date**, with the explanatory line "All 148 records were last verified 19 Jul 2026; the commercial-field refresh interval is 90 days"; (d) **12 properties in 6 groups** are listed as coordinate-duplicate suspects; (e) the "Missing critical data" count reads **148 of 148** with the top missing fields listed (GLA 148, status 148, floors 148, parking 148, year 148, class 132, rent 132, address 39); (f) filtering the map by "Sparse completeness" leaves **132** markers.

**UX-8 — "Edit a property and immediately see the analytics update."** (§35.8)
- Given Analytics shows "Total known GLA: **Insufficient verified data — 0 of 148 properties have recorded GLA**".
- When the user opens the Admin editor on **Gross Plaza**, sets GLA = `12000`, sets confidence = `Low`, sets last-verified = today, and saves.
- Then: (a) without a page reload, the Total known GLA card reads **12,000 m²** with **"Based on 1 of 148 properties with verified GLA"**; (b) the GLA range filter becomes **enabled** (coverage is no longer 0, per R2); (c) Gross Plaza's confidence badge changes to **Low** and its detail drawer's Data quality section shows source **"Manual edit (prototype)"** with today's date; (d) the record carries the amber **"Edited locally"** badge; (e) the edit survives a page reload (localStorage); (f) the average asking rent card is **unchanged** at $32.2 / 16 of 148 — editing GLA must not perturb an unrelated denominator.

**UX-9 — "Add a new business center using coordinates."** (§35.9)
- Given 148 records.
- When the user opens Admin → Add property, enters name `QA Test Tower`, lat `41.3000`, lng `69.2800`, district `Yunusobod`, and saves.
- Then: (a) the counter reads **149 properties found**; (b) a marker appears at 41.3000 / 69.2800 with the "class not recorded" marker style; (c) the record shows confidence **Unknown ("Not verified")** and the badge **"Added locally — not verified"**; (d) "Business centres by district" shows Yunusobod **22**; (e) average asking rent is still **$32.2 based on 16 of 149** — the new record does not enter a rent denominator; (f) invalid coordinates (outside lat 41.13–41.42 / lng 69.09–69.45) are rejected with "Coordinates outside Tashkent"; (g) deleting the record returns the counter to 148.

**UX-10 — "Export the current dataset and import it again."** (§35.10)
- Given the dataset contains 149 records (148 seed + `QA Test Tower` from UX-9).
- When the user clicks **Export JSON**, then **Reset Demo Data**, then **Import JSON** and selects the exported file.
- Then: (a) after Reset the counter reads **148** and `QA Test Tower` is absent; (b) after Import the counter reads **149** and `QA Test Tower` is present with every field byte-identical to the export; (c) the export file is valid JSON containing a `schemaVersion`, an `exportedAt` timestamp and a `records` array of length 149; (d) importing a file with a different `schemaVersion` shows a named error and changes nothing; (e) importing a malformed file shows "Import failed: invalid JSON" and changes nothing; (f) after import, Analytics figures equal the pre-export figures exactly.

### 5.2 AI scenarios (§63)

All AI responses must render the six §46 blocks. "States coverage" below means the **Data coverage** block contains the literal denominator.

**AI-1 — "Show Class A and A+ business centers."** (§63.1)
- Then: (a) parsed intent is `apply_filters{class:['A','A+']}`; (b) counter reads **12**; (c) the filter panel's `A` and `A+` checkboxes are **visibly checked** (§59); (d) an AI layer appears named "Class A / A+ offices" with **12 properties**; (e) Data coverage states **"Office class is recorded for 16 of 148 properties. 132 properties have no recorded class and are excluded."**; (f) Sources block lists "2GIS, collected 19 Jul 2026".

**AI-2a — "Only buildings above 5,000 m²."** (§63.2 — context retention under zero coverage)
- Given AI-1 has just run (12 selected).
- Then: (a) the AI **does not** create a layer and **does not** change the selection; (b) counter still reads **12**; (c) the response states **"GLA is recorded for 0 of the 12 currently selected properties, so this filter cannot be applied. The previous selection (Class A / A+, 12 properties) is unchanged."**; (d) the response offers at least one answerable alternative; (e) no fabricated size appears anywhere. *(This is the single most important anti-hallucination test in this dataset — §47, §62.)*

**AI-2b — "Only those with known rent above $30."** (§63.2 — context retention with real narrowing)
- Given AI-1 has just run (12 selected).
- Then: (a) counter narrows **12 → 7** *(computed: Gross Plaza 34.8, Sapphire 34.8, Trilliant 44.7, Nest one 40.6, Modera Towers 37.8, Infinity 34.8, Forum 39.7)*; (b) the class filter remains checked (context preserved, §58); (c) the rent filter now shows min = 30 in the panel; (d) coverage states **"Asking rent is recorded for 12 of the 12 selected properties."**; (e) the AI Layers panel shows the refined layer with 7 properties.

**AI-3a — "Which district has the most known Class A GLA?"** (§63.3 — refusal)
- Then: (a) no chart, table or highlighted district is produced; (b) the response states **"GLA is recorded for 0 of 148 properties, so Class A GLA cannot be ranked by district."**; (c) it names what would be required ("recorded GLA per building"); (d) it offers the answerable substitute ("rank districts by Class A/A+ property count" or "by known asking rent").

**AI-3b — "Which district has the most Class A and A+ offices?"** (§63.3 — the answerable form)
- Then: (a) a ranked table and a bar chart are produced; (b) the top row is a **tie: Mirobod 3 and Yunusobod 3** *(computed)*, rendered as a tie with the tie-break rule stated (alphabetical), not silently resolved; (c) both Mirobod and Yunusobod polygons are highlighted; (d) the full ranking reads Mirobod 3, Yunusobod 3, Yakkasaroy 2, Yashnobod 2, Mirzo Ulugbek 1, Shayxontohur 1, all others 0 *(computed)*; (e) Data coverage states **"Based on 12 of 148 properties with class A or A+ recorded; class is recorded for 16 of 148."**

**AI-4 — Property selected, "Show its competitors within 3 km."** (§63.4)
- Given **Trilliant** is open in the property drawer.
- Then: (a) the AI resolves "its" to Trilliant and names it in the Answer block (§44); (b) a 3 km circle is drawn; (c) an AI layer "Competitors within 3 km of Trilliant" is created with **74 properties** *(computed)*; (d) the result list separates **9 qualified** and **63 class not recorded** (R5); (e) the response explains the inclusion rule (distance + class band) and states that 63 records could not be qualified; (f) removing the layer removes the circle as well.

**AI-5 — "Show properties with poor data quality."** (§63.5)
- Then: (a) the response states **"No properties are graded Low or Unknown confidence — all 148 are Medium (single source, desk-verified from a map service)."**; (b) it pivots to completeness and creates a layer **"Sparse data (completeness < 40)"** with **132 properties** *(computed)*; (c) the data-confidence filter in the left panel reflects any applied confidence selection; (d) the layer criteria are inspectable in the AI Layers panel and read as a legible rule, not opaque text.

**AI-6 — "Which buildings need data verification?"** (§63.6)
- Then: (a) a ranked verification queue is produced, sorted descending by priority score; (b) the **12 coordinate-duplicate-suspect records** rank in the top band; (c) the response states **"0 properties are past their next verification date"** and **"148 of 148 are missing at least one critical field"**; (d) not one property attribute is invented in the output; (e) asking the AI to *create* field tasks returns **"Requires confirmation and a backend — not available in the prototype"** (A13); (f) *(time-travel check)* after editing one record's last-verified date to 2025-01-01 in the Admin editor, re-running the command reports **1 property past its next verification date** and that property ranks first.

**AI-7a — "Compare the three largest properties currently on the map."** (§63.7 — refusal)
- Then: (a) the compare view does **not** open with arbitrary picks; (b) the response states **"Building size (GLA/GBA) is recorded for 0 of the properties currently on the map, so 'largest' cannot be determined."**; (c) it offers substitutes ("the three highest known asking rents", or manual selection).

**AI-7b — "Compare the three highest known asking rents."** (§63.7 — the answerable form)
- Then: (a) the compare view opens with exactly **Trilliant (44.7), Nest one (40.6), Forum Business Center (39.7)** *(computed)*; (b) all three appear in the compare tray and are highlighted on the map; (c) coverage states **"Based on 16 of 148 properties with recorded asking rent."**; (d) the comparison declares no winner (§15).

**AI-8 — "Remove this analysis and return to all business centers."** (§63.8)
- Given AI-1 → AI-2b → AI-4 have run (filters applied, 2 layers, 1 radius, 1 competitive set, 1 selected property).
- Then: (a) the AI Layers panel reads **"No layers"**; (b) all radius circles are removed; (c) the filter panel shows every control at its default and the counter reads **148**; (d) the selected property is deselected and the detail drawer closes; (e) the map refits to all 148 markers; (f) the AI session context is reset — a subsequent "only those above $30" is answered as a fresh request against all 148, not against the previous 7; (g) the session log retains all prior entries (reset clears state, not history).

### 5.3 Additional mandatory checks (not from §35/§63 but required by other sections)

| ID | Check | § |
|---|---|---|
| X-1 | The file opens from `file://` with no server and no console errors. | §29, §66 |
| X-2 | With the network disabled, the map still renders markers, polygons, filters, analytics, compare and AI over a grey canvas, and shows "Map tiles unavailable offline". | §29 |
| X-3 | Every filter whose field has 0 coverage is disabled and labelled (R2) — verified for GLA, occupancy/vacancy, parking, amenities, status. | §11, §29 |
| X-4 | No control anywhere is inert: every button either acts or is disabled with a visible reason. Enumerate and verify. | §29 |
| X-5 | Searching `Infinity Business Center` (Latin C) finds `Infinity Business Сenter` (Cyrillic С). Searching `Мирабад` and `Mirobod` both resolve to the same district. | §18, R6 |
| X-6 | Two filters applied together intersect correctly: class `A` + district `Mirobod` = **3** *(computed: Gross Plaza, Platform, Sapphire)*. | §66 |
| X-7 | `prefers-reduced-motion: reduce` removes all transitions and animations. | §25 |
| X-8 | At 375 px width the filter panel, property drawer, analytics and AI panel become sheets; no horizontal page scroll; no clipped or overlapping text. | §26, §66 |
| X-9 | The role switch to **External** hides the Admin editor, the `_note`/`comment` internal fields and all `access:'internal'` AI tools; switching back restores them. | §60 |
| X-10 | Every rent figure in the app carries the R9 assumed-unit footnote. | §2.2 |
| X-11 | The header data indicator reads "148 records · 1 source · updated 19 Jul 2026 · 0 field-verified" and updates after a local edit. | §8, §19 |
| X-12 | `grep -ci geodesk index.html` returns 1 (the `GEO.PRODUCT` constant only). | §8 |

---

## 6. Build order (§68) mapped to deliverables

Build strictly in this order; do not start a step before the previous one passes its checks.

| § 68 priority | Deliverable | Files | Done when |
|---|---|---|---|
| 1. Reliable structured dataset | Normalise `bc.json` → 148 schema-conformant records (district canonicalisation R7, confidence mapping R8, rent unit R9, qc flags R10, homoglyph-safe search keys R6); embed `tashkent_districts.geojson`; emit as inline JS | `src/10-seed-bc.js`, `src/11-seed-districts.js`, `tools/build_seed.py` | Record count is 148; district counts match the §3.4 table; no `fetch()` anywhere |
| 2. Map and property interaction | Leaflet init, vendored libs, marker layer styled by class, clustering, hover, select, fit, reset, fullscreen, district polygons | `vendor/`, `src/20-map.js` | UX-2(b,c), X-1, X-2 |
| 3. Filters and search | Filter state model, coverage-aware controls (R2), counter, reset, collapse, More filters, global search with R6 folding | `src/30-filters.js`, `src/31-search.js` | UX-1, UX-2, UX-3, X-3, X-5, X-6 |
| 4. Property detail cards | Drawer with 7 sections, 5 actions, data-quality block, Map+List toggle and list cards | `src/40-property.js`, `src/41-list.js` | §13 sections all render; UX-5(c) missing-data token |
| 5. Analytics with denominator logic | `hasValue` (R1), aggregate helpers, 9 cards, 4 SVG charts, "Insufficient verified data" (R3) | `src/50-analytics.js`, `src/51-charts.js` | UX-6, UX-3(b), UX-8(a,f) |
| 6. Compare | Tray (2–4), 13-row table, neutral missing treatment | `src/60-compare.js` | UX-5 |
| 7. Location / radius analysis | Haversine, 1/3/5 km, circles, nearby aggregates, suggested competitive set (R5) | `src/70-location.js` | UX-4 |
| 8. AI interaction prototype | Intent parser, session context, execution-status strip, six-block response renderer, refusal logic | `src/80-ai-parser.js`, `src/81-ai-session.js`, `src/82-ai-ui.js` | AI-1, AI-2a, AI-2b, AI-3a, AI-3b, AI-7a, AI-7b |
| 9. AI-generated layers | Tool registry (16 tools, `access` flags), layer store, AI Layers panel, filter sync both ways | `src/83-ai-tools.js`, `src/84-ai-layers.js` | AI-4, AI-5, AI-6, AI-8, X-9 |
| 10. Local admin / data editor | Add / edit / delete, coordinate validation, source + confidence + last-verified editing, localStorage, Export / Import / Reset | `src/90-admin.js`, `src/91-storage.js` | UX-8, UX-9, UX-10, AI-6(f) |
| 11. Animations and visual polish | Brand tokens, type scale, transitions, `prefers-reduced-motion`, responsive sheets | `src/05-tokens.css`, `src/06-layout.css` | X-7, X-8 |

Cross-cutting from step 1 onward: the i18n dictionary (`src/01-i18n.js`) — no literal UI string may be written inline at any step (§27).

**Non-negotiable:** if time runs out, stop at a completed priority level. Never ship priority 11 polish over a failing priority 5 denominator (§68 closing line).

---

## 7. Definition of done

The prototype is done when **all** of the following hold. This is §66 verbatim (items 1–24) plus the additions this dataset and delivery format require (items 25–33).

| # | Criterion | Verified by |
|---|---|---|
| 1 | No JavaScript console errors or warnings on load or during any scenario | Manual, console open throughout QA |
| 2 | Map loads correctly | UX-2 |
| 3 | Mobile layout works | X-8 |
| 4 | No overlapping UI | X-8 |
| 5 | No clipped text | X-8 |
| 6 | Filters work together | X-6 |
| 7 | Reset works | UX-3(d), AI-8(c) |
| 8 | Search works | X-5 |
| 9 | Property selection works | UX-4 |
| 10 | Comparison works | UX-5 |
| 11 | Analytics recalculate correctly | UX-8(a) |
| 12 | Missing-data logic is correct | R1, R3, R4, UX-8(f) |
| 13 | Radius analysis works | UX-4 |
| 14 | AI command parsing works | AI-1 … AI-8 |
| 15 | AI-generated filters work | AI-1(c) |
| 16 | AI layers work | AI-4, AI-5 |
| 17 | AI session context works | AI-2b, AI-4(a) |
| 18 | Manual controls reflect AI-applied filters | AI-1(c), AI-2b(b,c) |
| 19 | Import/export works | UX-10 |
| 20 | localStorage works | UX-8(e) |
| 21 | Admin edits propagate to map and analytics | UX-8, UX-9 |
| 22 | Animations are smooth | X-7; no layout thrash at 60 fps on a 148-marker pan |
| 23 | Data source / confidence information is visible | X-11, UX-7 |
| 24 | No fake buttons | X-4 |
| 25 | All 10 §35 UX scenarios pass every clause | §5.1 |
| 26 | All 8 §63 AI scenarios pass every clause (including the three substitute forms AI-2b, AI-3b, AI-7b) | §5.2 |
| 27 | Opens from `file://` with no build step and no server | X-1 |
| 28 | Degrades gracefully with no network | X-2 |
| 29 | Shipped `index.html` is self-contained (vendored Leaflet + markercluster inlined or referenced relatively, seed data inline, no ES modules) | Open the file with the `src/` directory renamed — it still works |
| 30 | No fabricated value exists anywhere in the dataset or the UI: every displayed number traces to `bc.json`, to `tashkent_districts.geojson`, to a documented formula, or to a user's own local edit | Diff the normalised seed against `bc.json` field by field |
| 31 | The product name appears in exactly one constant | X-12 |
| 32 | Every §30 module is a separate source file; no function exceeds ~120 lines; no single god-function | Read `src/` |
| 33 | `docs/` contains this spec plus the schema, analytics-rules, AI-architecture, and delivery notes documents (§65 Step 11: implemented features, known limitations, data limitations, AI limitations, next improvements) | Directory listing |

---

## 8. Conflicts with the brief and open questions

Recorded here because §65 Step 2 forbids blind implementation. Full analysis belongs in `02-brief-critique.md`.

| ID | Issue | Resolution taken in this spec |
|---|---|---|
| **C1** | §10 lists metro stations / major roads / landmarks as context layers. No such dataset exists in the repo and the Overpass/OSM API is blocked by network policy (403). §2.2 forbids fabricating coordinates. | Context layers ship as **disabled, empty, clearly labelled slots** (A8). §13's "nearby metro" renders "No metro dataset loaded". Inventing metro coordinates is not an option. Needs a licensed or field-collected source before it can be enabled. |
| **C2** | §63 Test 2 expects "results narrow" from a 5,000 m² filter, but GLA coverage is **0 of 148** — it cannot narrow. | Split into AI-2a (honest refusal, the required behaviour under §47/§62) and AI-2b (an equivalent test that genuinely narrows using the rent field). Both must pass. |
| **C3** | §63 Test 3 expects a Class A **GLA** ranking; GLA coverage is 0. | Split into AI-3a (refusal) and AI-3b (count-based ranking, answerable). |
| **C4** | §63 Test 7 expects "the three largest properties"; size coverage is 0. | Split into AI-7a (refusal) and AI-7b (highest known rent). |
| **C5** | §11 requires GLA, occupancy/vacancy, parking and amenity filters; all four have 0 coverage. §29 forbids controls that do nothing. | Rule R2: render them, disabled, with the coverage count. They self-enable the moment data arrives (proved by UX-8(b)). |
| **C6** | §19 wants a stale-data indicator; with a 90-day commercial refresh and a 2026-07-19 collection date, **0 records are stale today**. | Report the honest 0 and disclose the arithmetic; make staleness testable through the Admin editor's last-verified field (AI-6(f)) rather than by bending the threshold. |
| **C7** | The rent **unit** is not recorded in the source; "USD/m²/month" is an external convention. | R9: stored as assumed, footnoted everywhere. **Open question for the data owner: confirm the unit and currency for the 16 rent records.** |
| **C8** | The seed contains records that are not business centres (`Авто`, `Carvon, офис`, `Семург`, `Chilonzor`, two rows of an `Infinity` consulting firm) and one exact duplicate name. | R10: flagged `type_uncertain`, surfaced in the verification queue, **not** silently deleted. **Open question: does CASE want a pre-publication cleaning pass that removes them, and on whose authority?** |
| **C9** | `data_confidence: "B"` for all 148 is a *collection* grade, not a §2.3 confidence level. | R8 maps B→Medium and the badge discloses the actual evidential depth ("1 source · desk"). **Open question: confirm the A/B/C grade definitions used by the collection process.** |
| **C10** | §33 requires the product not to look like an internal CASE dashboard, while §24's visual direction and this repo's brand tokens are CASE's. | Use CASE tokens as a neutral premium design system (ink / cream / one accent red), not CASE logos or CASE-specific chrome. The product is visually independent and could be rebranded by swapping `05-tokens.css` and `GEO.PRODUCT`. |
| **C11** | §8 requires a city selector and a property-type selector with exactly one valid option each. | Render both with the future options listed and **disabled with a reason** — communicates roadmap without a fake choice. |
