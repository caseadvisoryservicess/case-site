# CASE Geo — Geoanalytics MVP prototype

**Tashkent · Business centres · Working prototype, not a production system**

A single-file, no-backend HTML prototype for validating the product logic, workflow, data model,
analytics rules and AI interaction model of a location-intelligence platform for commercial real
estate. Built to the 69-section master brief; the deviations from it are listed in §6 below, each
with a reason.

---

## 1. Run it

```
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

No server, no build step, no install. It works offline — only the base-map tiles need a network,
and the app states plainly when they are unavailable and keeps working without them.

```
index.html?selftest=1    # runs the built-in assertion suite and prints a pass/fail table
index.html#reset         # clears all stored data BEFORE start-up — the escape hatch if a
                         # session gets into a bad state
```

**Known browser caveat.** `localStorage` on the `file://` origin is browser-dependent. Where it is
blocked, the app detects this at start-up, shows a notice, and runs with an in-memory store —
fully usable, but edits do not survive a reload. Use **Export JSON** to keep work. Serving the
folder over any static server (`python3 -m http.server`) removes the caveat entirely.

---

## 2. What the data actually is

This is the part to read before trusting any number on screen.

| | |
|---|---|
| **Records** | **148 real** business centres (`recordType: VERIFIED_SOURCE`) + **8 synthetic** (`DEMO`, off by default) |
| **Source** | 2GIS, via the CASE Tashkent Geo Master seed (`os/data/geo_master/bc.json`), retrieved **19 Jul 2026**. One source per record; licence review outstanding. |
| **Boundaries** | 12 Tashkent district polygons, *Toshkent shahar chegarasi (2024)*, simplified to ~9 m tolerance (268 KB → 34 KB, max area drift 0.076%) |
| **Strong coverage** | name 148/148 · coordinates 148/148 · district 148/148 · address 109/148 |
| **Weak coverage** | office class **16/148** · asking rent **16/148** (the same 16 records) |
| **Zero coverage** | GLA, GBA, floors, parking, year, status, occupancy, vacancy, available area, service charge, owner, operator, developer, tenants, amenities — **0/148** |

**The honest summary**: this dataset supports *geography* extremely well and *commercial
attributes* very poorly. The prototype is built to say so on every screen rather than to hide it.
That is not a limitation we worked around; it is the product's central claim — a buyer can see
precisely what a professional collection programme would be worth.

### Things found in the data that the brief did not anticipate

| Finding | Records | What the prototype does |
|---|---:|---|
| **Source district label contradicts the boundary polygon** | 10 | Geometry wins (it is reproducible from the coordinates); the source label is kept and the conflict is queued for review. This matters: `Trilliant` — the highest rent in the dataset at $44.7, class A+ — moves from Mirzo-Ulugbek to Yunusobod, which changes the top-ranked district for both class-A supply and average rent. |
| **Exact coordinate collisions flagged by the source** | 12 (6 groups) | Never auto-merged. A three-verdict review queue (*same building / different buildings / undecided*, default undecided). Counts disclose the unresolved pairs. |
| **Sub-30 m pairs the source did *not* flag** | 3 pairs | Same queue, found by recomputing distances rather than trusting the flag. |
| **Name duplicates, gated on proximity** | 3 pairs | Name similarity alone is not evidence — `Neus` and `NEXUS` are 8 km apart. Only similar names that are also close enough to be the same address are queued. |
| **Entities that are probably not business centres** | 8 | A consultancy listed twice, an association, a textile company, a coworking operator, and others whose *name states* they are a company. Flagged, never deleted, with a toggle that states its numeric effect. |
| **Generic placeholder names** | 6 | `Бизнес центр`, `Biznes sentr`, `Chilonzor` (a district name used as a building name), etc. Flagged for renaming, not removed. |
| **Degenerate quality fields** | 148 | Every record carries `data_confidence: "B"` and the same collection date, so neither can discriminate. Addressed in §4 below. |

---

## 3. What is built

Every item here works. Nothing is a mock-up.

**Map & data** — Leaflet with OSM tiles (vendored, offline-tolerant); 148 markers encoded by
office class, data confidence or completeness; the class letter is drawn inside the marker so
identity never depends on colour; district polygons with hover and highlight; clustering below
z13 only; radius rings; AI-generated layers; fit / reset / fullscreen.

**Filters & search** — filters generated from *measured coverage*, so a filter whose field has no
data disables itself with the reason visible rather than pretending to work. Search folds
Cyrillic↔Latin and handles the record whose name contains a Cyrillic `С` inside an otherwise Latin
word.

**Analytics** — metric cards, five charts, and a coverage line under every single figure. A metric
that cannot be computed says **Insufficient verified data** and names what is missing.

**Property detail** — full record with per-field provenance (source, method, confidence, collected,
last verified, computed next refresh, QC status), data-quality section, and the five §13 actions.

**Comparison** — 2–4 properties, all 13 rows, missing values shown neutrally, **no winner declared**.

**Location analysis** — 1/3/5 km cumulative bands, competitor counts, known rent and GLA with
denominators, class mix, and a *Suggested competitive set* that separates properties qualified on
class from those that could only be qualified on proximity.

**Data quality** — coverage by field, completeness bands, confidence split, freshness, six issue
queues, a duplicate-adjudication workspace, and a ranked verification backlog.

**Data editor** — add / edit / soft-delete with typed coercion, validation, 20-deep undo,
per-field provenance capture on every edit, local-change diff, JSON import with a per-row
validation report, CSV export, and two separate reset commands.

**Assistant** — a deterministic intent engine over a typed tool registry. Every response carries
all six §46 blocks; every figure carries an origin badge; anything it cannot answer from the data
is refused with the real numbers and an answerable alternative offered.

---

## 4. The fifteen decisions that shaped it

Full rationale in `docs/00-BUILD-CONTRACT.md`. The four that most affect the numbers:

**D1 — Geometry decides the district.** Ten source labels contradict the polygons. Charts drawn
from a label would visibly disagree with a map drawn from a polygon, and one of the ten is the
dataset's headline rent.

**D2 — Unknown is `null`, always, and is read only through `known()`.** Never `0`, never `""`,
never a missing key. A measured `0%` vacancy and an unrecorded vacancy are different facts and
render differently. This is enforced structurally, not by discipline.

**D3 — Per-field confidence, not a record-level constant.** All 148 records carry the same opaque
`"B"` grade. Mapping that to "Medium" and calling it confidence would invent a meaning. Instead:
name and coordinates from a single map listing are **Medium**; class and asking rent from that
same unverified listing are **Low** (they are the fields a CRE advisor must confirm with the
landlord); a district computed from geometry is **High**. The raw `B` is still shown, labelled as
the source's own grade.

**D4 — Demo records are contained, and off by default.** Eight synthetic records exist so that the
GLA / occupancy / tenants / parking / pipeline code paths are testable at all — §6 of the brief
explicitly permits this. Containment is structural: separate in-memory arrays, a required
`recordType` with no default, exclusion from every statistic unless demo mode is on, a
non-dismissible banner while it is, self-identifying exports, and **no promotion path** — nothing
in the UI, the importer or the assistant can turn a demo record into an observed one.

---

## 5. Repository layout

```
geo-mvp/
  index.html                     ← THE DELIVERABLE (self-contained; open it directly)
  build.py                       assembler: src/ → index.html   (`--check` verifies freshness)
  src/
    shell.html                   the DOM contract
    manifest.json                module order
    styles/  01–09               design tokens → print
    js/      00–99               26 modules, one concern each (brief §30)
  data/
    seed.json                    the shipped dataset envelope
    tashkent_districts.simplified.geojson
    oracle.json                  expected values, generated
  tools/
    build_seed.py                the ETL that produced seed.json from the CASE source data
    oracle.py                    independent Python implementation of every metric — the QA oracle
    qa.cjs                       headless-browser test harness (Playwright)
    etl_districts_check.py       point-in-polygon audit of the source district labels
    name_dupes.py                proximity-gated name-duplicate detector
  docs/
    00-BUILD-CONTRACT.md         ← binding decisions; read this first
    01-product-spec.md           scope, users, acceptance criteria
    02-brief-critique.md         critical review of the brief (§65 step 2)
    03-information-architecture.md
    04-data-schema.md  05-analytics-rules.md  06-ai-architecture.md
    10-visual-system.md          validated palette, marks, motion
  vendor/                        Leaflet 1.9.4 + markercluster (no CDN, works offline)
```

**Never edit `index.html` by hand** — it is generated. Edit `src/`, then:

```
python3 build.py            # rebuild
python3 build.py --check    # fail if index.html is stale
python3 tools/oracle.py     # recompute the expected values from the seed
node tools/qa.cjs           # drive the built file in real Chromium
```

---

## 6. Where this departs from the brief, and why

| Brief | What we did instead | Why |
|---|---|---|
| §10 context layers (metro, roads, landmarks) | The layer slot exists, is **empty**, states why, and accepts a GeoJSON import. | No verified metro dataset exists in the repo and the OSM/Overpass API is blocked by network policy here. §2.2 forbids inventing coordinates, so we did not. |
| §14 chart 3, rent histogram | A **strip plot** of all 16 individual values below n=30; a histogram above it. | 16 points across 7 bins is noise that implies a distribution the data cannot support. |
| §14 chart 4, GLA histogram | Ships, renders its insufficient-data state, and goes live under demo mode or after an edit. A fifth chart — **data coverage by field** — was added. | Keeps the requirement instead of dropping it, and adds the chart this dataset actually supports. |
| §53 AI progress stages | Replaced by a **"How this was answered"** disclosure listing the matched intent, the slots and every tool call. | The engine completes in under 5 ms. Staging fake progress simulates latency that does not exist to imply intelligence that does not exist — the presentational cousin of the fabrication §47 forbids. |
| §21 "Reset Demo Data" | Split into **Restore original dataset** and **Full reset**, separately confirmed, plus an `#reset` boot escape hatch. | The original name collides with the DEMO-record concept, and the brief offers no way out of a broken state — the most common user-testing event. |
| §27 three languages | English UI; **all 953 strings centralised**; RU/UZ tables scaffolded; the language selector is present and disabled with its reason, and re-enables itself automatically once a dictionary is filled. | §27 permits English-first. Adding a language is now data entry, not a refactor. |
| §8 city / property-type selectors | Real menus listing the roadmap, with every unavailable entry disabled and labelled. | §29 forbids controls that do nothing; a one-item dropdown teaches a tester nothing. |

Additional functions the brief does not mention but the prototype needs: undo, storage schema
versioning, two distinct resets, duplicate adjudication, cross-field validation, keyboard
accessibility, designed empty and error states, URL-shareable state, analysis export and print,
a local-change diff, typed input coercion, and dataset-level coverage transparency.

---

## 7. Limitations — read before showing this to a client

1. **It is a prototype.** No backend, no authentication, no permissions enforcement, no audit
   trail beyond the session. The internal/external role switch is a product-model test, **not**
   security.
2. **The data is desk-collected and unverified.** One source, one date, no field visits. Asking
   rents are advertised headline rates with unknown terms — not achieved rents, not landlord-
   confirmed.
3. **Commercial attributes are almost entirely absent.** Any question about size, vacancy,
   occupancy, tenants, parking or pipeline is refused rather than estimated. That is correct
   behaviour, and it is also most of what a client would want to ask.
4. **Staleness cannot yet discriminate.** All 148 records share one collection date, so no
   threshold separates them. The engine is built and correct; it becomes meaningful the moment a
   second date exists — which the editor lets a tester create.
5. **Seven suspected non-office entities and six placeholder names remain in the count** by
   default. Flagged, with a toggle; not removed, because removal is an unverified judgement.
6. **The assistant is not a language model.** It is a deterministic intent parser covering a fixed
   catalogue. It understands a narrow range of questions precisely rather than a wide range
   vaguely — which is what §54 asks for at this stage.
7. **Duplicate pairs are unresolved.** Up to 6 buildings may be double-counted in every supply
   statistic until someone works the review queue.

---

## 8. Recommended next steps

**Before the next build**
1. Resolve the 6 duplicate groups and the 10 district conflicts — a few hours of desk work that
   fixes the headline counts.
2. Confirm or reject the 8 suspected non-office entities and rename the 6 placeholder records.
3. Establish what the source's `A/B/C` confidence grade actually means, so it can be mapped
   honestly rather than displayed raw.

**The highest-value data investment**, in order: office class and asking rent for the 132 records
that have neither → GLA and floors → vacancy and available area → tenants. The verification
backlog in the Data workspace already ranks the individual properties.

**Then productionise**: PostGIS + a real API, authentication and roles, a field-collection app
feeding the same schema, historical time series (the `_history` shape is reserved), and an LLM
behind the existing `interpret()` seam — the tool registry is already the model's tool schema.
