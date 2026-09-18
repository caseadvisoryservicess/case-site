# 02 – Critical Review of the Master Build Prompt

**Scope:** Brief §65 Step 2 – identify contradictions, unnecessary features, technical risks and missing critical
functions before writing code. **Status:** review of the brief, not a spec. Implementable decisions land in docs 03–07.

**Method:** every claim below about the dataset was measured against
`/home/user/case-site/case-site/os/data/geo_master/bc.json` (148 records) and
`/home/user/case-site/case-site/os/data/tashkent_districts.geojson` (12 features, 12,177 vertices) in this session.
Nothing here is inferred from the brief alone.

---

## 0. Corrections to the project briefing I was handed

Three "verified facts" in my task context are wrong. They matter, so they are stated first.

| # | Briefing said | Measured reality | Why it matters |
|---|---|---|---|
| X1 | `coordinate_accuracy="single"` for all 148 | **109 = `"single"`, 39 = `"Точка источника; не подтверждена полевым осмотром"`** | The field mixes an enum with free-form Russian prose. Any code that switches on it, or any filter built over it, must not assume an enum. Needs normalisation to a real enum before use (§5.6). |
| X2 | `_verification="online"` for all 148 | **136 = `"online"`, 12 = `"needs_review"`** | The 12 `needs_review` records are exactly the 12 duplicate-flagged ones. There *is* a latent review-queue state in the data that the brief never accounts for (see M4). |
| X3 | 12 duplicate records in 6 pairs | 12 flagged, **plus 1 unflagged exact-name duplicate and 3 unflagged sub-30 m pairs** | True dedupe workload is larger than flagged. `Infinity, компания консалтинга в сфере недвижимости` appears **twice** with `possible_duplicate` empty on both. |

Two further measured facts that dominate everything in section 2:

- **The 16 records with `class` are the *same* 16 records with `rent`.** Coverage is not two independent 11% samples; it is one 11% sample. There is no record with rent but unknown class, or vice versa.
- **`data_confidence` is `"B"` on all 148 records** and `pdate` is `"2026-07-19"` on all 148. Both fields are constants. Every feature keyed to them is degenerate (see D7, D8).

---

## 1. Contradictions inside the brief

### C1 – §29 "one main HTML file / no build process" vs §9 "may use CDN libraries" vs `file://` delivery
**Problem.** §29 wants one file, minimal dependencies, no build, opens directly in a browser. §9 permits CDN
libraries. These pull in opposite directions: a CDN reference makes the "one file" a file that does not work
without network, and §29's own "open directly in browser" implies `file://`, where `fetch()` of a sibling JSON
file is blocked by CORS in every major browser (opaque origin).
**Impact.** Taken literally, a CDN build fails offline and a `fetch()`-based data loader fails always.
**Resolution.** Reject the CDN option. Vendor Leaflet 1.9.4 + markercluster 1.1.1 locally and inline them, inline all
seed data as JS literals, and author in `geo-mvp/src/` with a Python assembler that concatenates into
`geo-mvp/index.html`. Note the distinction the brief fails to make: **a build step to *author* is not a build step to
*run*.** §29's requirement is about the runtime, and is satisfied. Document the assembler in the deliverable notes
per §29 ("clearly document them").

### C2 – §6 / §65 Step 7 "research publicly available information" vs the build environment
**Problem.** §6 instructs the agent to research Tashkent business centres from official and developer websites.
Outbound research is unavailable here (Overpass/OSM returns 403 from the egress proxy; no browsing).
Simultaneously, the brief is unaware that the repository **already contains** a 148-record 2GIS-derived dataset.
**Impact.** Step 7 as written is unexecutable, and executing it badly (guessing) would violate §2.2.
**Resolution.** Treat §6's own escape hatch as the governing clause: use the existing repo dataset as the sole
observed-data source, declare its provenance honestly (single source, 2GIS, collected 2026-07-19,
`source_count: 1` for every record), and do **not** attempt substitute research. Record in the delivery notes
(§65 Step 11, "data limitations") that no independent verification was possible.

### C3 – §10 contextual layers vs §2.2 "never fabricate coordinates"
**Problem.** §10 asks for metro stations, major roads and major landmarks. No such dataset exists in the repo and
OSM is unreachable. §2.2 forbids inventing coordinates. §13 compounds this by putting "nearby metro" inside the
property detail card as a first-class field.
**Impact.** Any metro layer built now is fabricated data inside a product whose entire differentiator (§37) is
provenance. That is the single most damaging thing this prototype could ship.
**Resolution.** §10 already contains the release valve – "**only if they can be implemented reliably**". They
cannot. Ship the context layer group as a **declared-but-unpopulated** slot: visible in the layer control, disabled,
labelled `No verified dataset – import required`, with a working JSON import path so a real metro file can be
dropped in later without a code change. In §13, render `Nearby metro: no transit dataset loaded`. This satisfies
§2.7 (never hide uncertainty) and §29 (no fake buttons) simultaneously – the control is honest, not decorative.

### C4 – §2.3 vs §19: two different confidence vocabularies
**Problem.** §2.3 defines confidence as `High / Medium / Low / Unknown`. §19 defines the UX chips as
`High / Medium / Low / **Not verified**`. "Unknown" and "Not verified" are semantically different: unknown
confidence is an absence of assessment; not-verified is an assessed state. The data uses a third vocabulary
entirely (`"B"`).
**Impact.** Three vocabularies for one field; filters and layers will disagree with chips.
**Resolution.** Adopt one enum, `high | medium | low | unknown`, as the stored value; treat "Not verified" as a
*separate derived boolean* (`verified_at == null`), not a confidence level. Map the legacy `"B"` explicitly and
visibly (see D7).

### C5 – §14 (nine metric cards) vs §36 (denominators) vs §29 ("no decorative controls that do nothing")
**Problem.** §14 mandates cards for total known GLA, known vacant area and average occupancy. §36 forbids treating
missing as zero. With GLA, vacancy and occupancy at **0/148 coverage**, those cards can only ever render
"Insufficient verified data" – permanently, in every filter state, for every user. §29 forbids controls that do
nothing. A card that is structurally incapable of ever showing a number is such a control.
**Impact.** Three of nine headline cards are dead weight that make the dashboard look broken rather than honest.
**Resolution.** Distinguish *temporarily* empty from *structurally* empty. Render only metrics with ≥1 observed
value as cards. Move structurally-empty metrics into a separate, smaller **"Not yet collected"** block listing the
field names and their 0/148 coverage. This honours §36 and §2.7 (uncertainty disclosed) without nine grey boxes,
and it doubles as the data-collection backlog the brief wants in §50.

### C6 – §9 marker encoding vs §9 clustering vs 89% unknown class
**Problem (a).** §9: "marker design should communicate at least one useful property attribute. For example office
class." Class is known for 16/148 – **89% of markers would encode "Unknown"**, which is not a useful attribute.
**Problem (b).** §9 requires both marker clustering *and* "selected property clearly highlighted". A selected
marker swallowed by a collapsed cluster is not highlighted. The brief never resolves this.
**Impact.** The map's primary visual channel carries almost no signal, and selection can become invisible.
**Resolution.** (a) Encode class where known and render unknown-class as a deliberately neutral, visually recessive
marker – the map then legitimately *shows* that the market is 89% unclassified, which is a true and commercially
interesting finding. Offer a marker-encoding switcher (class / confidence / has-rent) rather than hard-coding one.
(b) 148 points do not need clustering (see T6): cluster only below z13, and always force-expand the cluster
containing the selected record.

### C7 – §11 filter list vs field coverage
**Problem.** §11 mandates filters for GLA range, occupancy/vacancy, parking and amenities. Coverage for all four is
**0/148**. A range slider over an empty field either returns everything (if nulls pass) or nothing (if they don't);
both are misleading, and §29 forbids fake controls.
**Impact.** Roughly half the filter panel is inert.
**Resolution.** Filters are generated from measured coverage at boot, not hard-coded. A filter whose field has zero
observed values renders disabled with its coverage shown (`GLA – 0 of 148 records`). This keeps §11's architecture
(the filter exists, is registered, will light up the moment data arrives) while refusing to pretend.

### C8 – §54 mandatory AI intent vs §63 AI Test 2 vs zero GLA data – *the sharpest contradiction in the brief*
**Problem.** §54 lists "Show buildings larger than 5,000 m2" among intents the prototype **must** understand.
§63 AI Test 2 specifies user input "Only buildings above 5,000 m2" with **"Expected: previous context remains and
results narrow."** GLA is 0/148. The only non-fabricating response is a refusal (§62: "the current dataset is
insufficient"). A refusal does not narrow results. **§63 Test 2 cannot pass as written without fabricating GLA.**
**Impact.** A stated QA acceptance criterion is unsatisfiable. Left unresolved, an implementer under delivery
pressure will invent GLA values to make the test green – exactly the failure §2.2 and §47 exist to prevent.
**Resolution.** Escalate to the brief owner (must-resolve, see §6 verdict). Two acceptable outcomes: **(i)** rewrite
Test 2's expectation to "AI declines, names the missing field, and offers the nearest supported alternative", which
makes §62 behaviour the *tested* behaviour – arguably a better product test than the original; or **(ii)** enable the
labelled DEMO subset (§2 below), where Test 2 passes over demo records only and the response is stamped
`DEMO DATA`. Recommend **(i) as the default and (ii) as an option**, never fabricated GLA on observed records.

### C9 – §7 seven simultaneous UI regions vs §24 "large usable map" and "avoid crowded dashboards"
**Problem.** §7 enumerates header + left filter panel + map + property drawer + AI panel + analytics drawer + AI
layers panel. On a 1440px screen, a left panel (~300px) plus two right surfaces (~380px each) leaves under 400px
of map. §24 demands a large usable map and explicitly warns against crowded dashboards. §26 then requires this to
work on mobile.
**Impact.** Literal implementation produces the crowded dashboard §24 forbids.
**Resolution.** Read §7 as an inventory of *surfaces*, not a simultaneous layout. One left rail (collapsible) and
**one** right rail hosting Property / Analytics / AI / Layers as mutually exclusive tabs. Maximum two panels open at
once. This is also the only version that degrades sanely to the mobile sheets §26 requires.

### C10 – §21 "Reset Demo Data" vs §6 "DEMO records" – colliding terminology
**Problem.** §6 uses "DEMO" to mean *fictional records*. §21 uses "Reset Demo Data" to mean *restore the seed
dataset*. Under §6's definition, a button labelled "Reset Demo Data" reads as "replace my data with fictional data".
**Impact.** A tester could reasonably believe the shipped 148 real records are fictional – destroying trust in the
one thing the product sells (§37).
**Resolution.** Reserve **DEMO** exclusively for §6's fictional-record meaning. Rename §21's control to
**"Restore original dataset"**, and split it into two distinct actions (see M3).

### C11 – §31 Phase 5 vs §16
**Problem.** §31 files "1/3/5 km" analysis under Phase 5 (future). §16 requires 1/3/5 km counts in the MVP now.
**Impact.** Trivial, but an implementer scoping from §31 would omit a required feature.
**Resolution.** §16 governs. Radius counts are MVP-NOW; drive-time isochrones and site scoring stay Phase 5.

### C12 – §27 localisation architecture vs untranslatable data
**Problem.** §27 centralises UI strings for EN/RU/UZ. It says nothing about **data** language. Measured: 100 of 109
addresses are Cyrillic, 12 names are Cyrillic, district values are Latin, and the `comment`/`_note` fields are
Russian. A Russian-language UI over Latin district labels, or an English UI over Cyrillic addresses, is unavoidable.
**Impact.** Localisation will look half-finished regardless of effort, and search breaks across scripts (T10).
**Resolution.** Scope §27 honestly to **UI chrome only**; state in the delivery notes that data localisation requires
a `name_i18n` / `address_i18n` structure and a translation pass that does not exist. Provide the schema slot, leave
it empty.

### C13 – §2.3 field-level provenance vs §5.6 / §20 record-level data
**Problem.** §2.3 requires provenance *per field* (value, source, date, confidence, collector, reviewer…). §5.6
repeats this. The actual data carries **record-level** provenance only: one `psrc`, one `pdate`, one
`data_confidence` for the whole record. The brief never says which granularity the MVP stores.
**Impact.** If the MVP stores record-level only, the §37 "data moat" narrative is unsupported by the schema; if it
stores field-level, 148 records × ~15 fields of mostly-null provenance bloats storage for no current benefit.
**Resolution.** Schema supports **both**: record-level defaults plus an optional per-field `provenance{}` override
map that is populated only when a field is individually edited or verified in the Data Editor (§21). MVP-NOW writes
field-level provenance for edited fields only; ARCHITECTURE-READY for the rest. This is the one place where the
field-level model earns its keep immediately, because §21's whole purpose is testing collection workflows.

---

## 2. Requirements that conflict with the available data

### 2.1 Measured coverage (n = 148)

| Field | Non-empty | Coverage | Consequence |
|---|---:|---:|---|
| `name`, `district`, `lat`, `lng` | 148 | 100% | Map, district aggregation, radius analysis all viable |
| `address` | 109 | 74% | Search and detail card partially viable |
| `class` | 16 | 10.8% | Class analytics viable only as "known subset" |
| `rent` | 16 | 10.8% | **Same 16 records as class** |
| `possible_duplicate` | 12 | 8.1% | Review queue exists but unhandled by brief |
| `floors`, `gba`, `gla`, `parking`, `year`, `avail`, `status`, `website`, `phone`, `sourceUrl`, `rating`, `reviews`, `sale`, `_checkedBy`, `_checkedAt` | **0** | **0%** | Structurally empty |
| `data_confidence` | 148 | 100% but **1 distinct value** (`"B"`) | Degenerate |
| `pdate` / `_sourceDate` | 148 | 100% but **1 distinct value** (`2026-07-19`) | Degenerate |
| `comment` / `_note` | 148 | 100% but **1 distinct value**, identical to each other | Zero information |

The 16 priced records: rents 19.9–44.7 USD/m²/month, classes A×8, A+×4, B×3, B+×1, spread over **6 of 11**
districts – Mirabad 4, Yakkasaray 4, Yunusabad 4, Yashnabad 2, Mirzo-Ulugbek **1**, Shaykhantakhur **1**.

### 2.2 Feature-by-feature verdict

| Brief § | Feature | Verdict | Non-fabricating mitigation |
|---|---|---|---|
| §12 | List cards: name, class, district, GLA, rent, vacancy, status, confidence | **3 of 8 fields ever populate** (name, district, + class/rent on 11%). Status/GLA/vacancy never; confidence constant. | Card shows name, district, address, and a **coverage meter** (`4 of 12 key fields known`). Class/rent shown as chips only when present. Drop the always-empty rows rather than render 5 dashes. |
| §14 | 9 metric cards | 4 computable (total BCs, by class, by district, rent mean/median over known). "Total known GLA", "known vacant area", "average occupancy", "operating vs pipeline" are **structurally impossible**. | Per C5: render the 4, move the rest to a "Not yet collected" block with 0/148 coverage stated. |
| §14 | Chart 3 "Asking rent distribution" | n=16. A histogram of 16 points across 5 bins is visual noise. | Render as a **dot/strip plot of all 16 values** with the denominator in the title. Honest, readable, and does not imply a distribution. |
| §14 | Chart 4 "GLA distribution" | **Impossible** (0/148). | Replace with **"Data coverage by field"** bar chart – the most genuinely useful chart this dataset supports, and it directly serves §19, §50 and the internal user in §34. |
| §15 | Comparison table, 13 rows | 6 rows computable (class, district, rent, last verified, confidence, status→unknown). GBA, GLA, floors, occupancy, vacancy, parking, amenities = **7 rows of "–" for every possible pair**. | Keep all 13 rows (§15 says "highlight missing information neutrally" – a comparison that shows what *nobody* knows is legitimate market intelligence). But sort known rows to the top and grey the block of universally-missing rows under a "No data for any selected property" subheading. |
| §16 | Location analysis: 1/3/5 km counts | **Fully viable** – coordinates are 100%. Best-supported analytical feature in the brief. | Ship as the flagship analysis. |
| §16 | "Average known rent of nearby competitors" | With 16 priced points citywide, most 1 km radii contain **0 or 1** priced record. | Compute only when n≥3 within the radius; otherwise "Insufficient verified data (n=1)". Always print n. Never show a 1-point "average". |
| §16 | "Total known nearby GLA" | **Impossible.** | Omit; list in the panel's "missing data" footer per §16's own "clearly state when calculations are based on incomplete data". |
| §17 | Competitive set from proximity + class + size | Size impossible; class unknown for 89%. The algorithm **degenerates to proximity-only**. | Implement proximity-only, and label it exactly that: **"Suggested competitive set – proximity only. Class and size unavailable for most records."** §17 already demands "never pretend the automated competitive set is definitive"; this is that clause taken seriously. Keep manual add/remove (fully viable). |
| §41–42 | AI layers: rent, GLA, vacancy, occupancy, availability, status, pipeline | Only **rent** has any data. | Register all layer types in the tool registry; each declares its required field. At boot, layers whose fields have 0 coverage are registered-but-unavailable, and the AI answers requests for them with §62's refusal naming the missing field. ARCHITECTURE-READY, not built-and-lying. |
| §42 | Quality layers: confidence / stale / missing / recently-verified | `data_confidence` and `pdate` are **constants** → "confidence" layer paints all 148 identically; "stale" layer selects all-or-nothing. | "Missing data" layer is genuinely useful (variance is real: 0–6 known fields per record) – build that one. Confidence and stale layers: see D7/D8. |
| §43 | "Average known rent by district" | Districts with priced records: 4,4,4,2,**1**,**1**. | Suppress district rent means below n≥3; show the count instead. Otherwise the AI will state a "Mirzo-Ulugbek average rent" that is one building. |
| §63 Test 5 | "Show properties with poor data quality" | Returns all 148 or 0. | Redefine "poor" against **field completeness** (measurable, variance exists) rather than `data_confidence` (constant). |
| §63 Test 6 | "Which buildings need verification?" | Single `pdate` → all or nothing. | Same: rank by missing-field count, not by age. |

### D7 – `data_confidence` is a constant, and it is not even in the brief's vocabulary
**Problem.** All 148 records carry `"B"`. The brief's enum is High/Medium/Low/Unknown (§2.3). `"B"` is an unexplained
letter grade from a different scheme. §11 (confidence filter), §19 (confidence chips), §42 (confidence layer) and
§63 Test 5 all key off this field.
**Impact.** Four features are inert, and the one shown value is meaningless to a user.
**Resolution – must-resolve with the data owner.** Do **not** silently map `B → Medium`; that invents a semantic.
Interim: display the raw value with its scheme named (`Source confidence: B (2GIS collection grade)`) and compute a
**separate, derived, honest** field the platform fully controls:

```
completeness = knownFieldCount / 12 key fields
verification_state = 'unverified'   // no record has _checkedBy / _checkedAt
```

Drive the §11 filter, §19 chips and §42 layer from `completeness` + `verification_state`, which have real variance,
and keep `data_confidence` as a displayed source attribute. This converts four dead features into working ones
without inventing a single value.

### D8 – `pdate` is a constant, so "stale" is undefined
**Problem.** §19 and §23 require stale-data indicators and next-verification dates. Every record was collected
2026-07-19 – 59 days before today (2026-09-16). Any threshold under 59 days flags all 148; any threshold over it
flags none.
**Impact.** The staleness feature cannot discriminate, so it teaches a tester nothing.
**Resolution.** Implement the staleness *engine* properly (per-field refresh classes per §23: fast/slow/stable), show
the real computed age (`Collected 59 days ago`), and state plainly in the UI legend that **all records share one
collection date, so staleness cannot currently differentiate records**. The engine becomes meaningful the moment a
second collection date exists – which is exactly what §21's editor lets a tester create, making this a *testable*
workflow rather than a dead indicator.

### D9 – The `possible_duplicate` flag does not mean what it appears to mean
**Measured.** The 6 flagged pairs are exact coordinate collisions between **differently-named** entities:
`Econor`/`MAXAM`, `Falcom`/`REGENT`, `Status`/`G BUILD`, `Vega business center`/`SK MEDIA`,
`Korea Uzbekistan Business Association`/`AMIR`, `UzOman tower`/`DIM TOWER`.
**Problem.** These are almost certainly **two 2GIS POIs at one address** – either two business centres in one
complex, or a building plus a tenant firm. They are *not* obviously the same record twice. Auto-merging them would
**destroy data**; ignoring them double-counts buildings in every district and radius statistic.
**Impact.** §14 counts, §16 radius counts and §43 district rankings are all affected by up to 6 records (4% of the
dataset) whose status is genuinely unknown. The brief never mentions duplicates at all.
**Resolution.** Never auto-merge. Ship a **Duplicate review queue** (M4) with three human verdicts – *same building
/ different buildings / undecided* – defaulting to **undecided**, counted normally but visibly flagged on the map
and in the record. Add the unflagged cases found here: the duplicated name `Infinity, компания консалтинга…` and the
three sub-30 m pairs (`Afrosiab`↔`Econor`/`MAXAM` at 27 m; `Infinity…`↔`Ventum plaza` at 19 m).

### D10 – The dataset contains entities that are not business centres
**Measured.** `Infinity, компания консалтинга в сфере недвижимости` (a real-estate consultancy, listed twice),
`Korea Uzbekistan Business Association`, `INTERNATIONAL BANK FINANCIAL CENTRE`, plus generic non-names
`Бизнес центр`, `Бизнес центр 2`, `Biznes sentr`, and one record simply named `Chilonzor` (a district name).
**Problem.** §4 restricts the MVP to business centres. A 2GIS keyword scrape pulls in tenant firms and associations
located *inside* offices. The brief assumes the dataset is clean; it is not.
**Impact.** Property counts (the single most prominent number in §14) are overstated by an unknown amount, and the
list is embarrassing to show a CRE professional.
**Resolution.** Do not delete them – deletion is unverified judgement. Add an `entity_review` flag
(`confirmed_bc | suspected_non_bc | unreviewed`), default `unreviewed`, pre-flag the seven above as
`suspected_non_bc`, and offer a default-on analytics toggle **"Exclude suspected non-office records"** that states
its effect (`148 → 141`). Transparent, reversible, and it turns a data defect into a working QA workflow for the
§34 internal user.

### D11 – Stored `district` disagrees with the district polygons for 10 records
**Measured** by point-in-polygon of all 148 records against the 12 authoritative MultiPolygons: **0 records fall
outside the city**, but **10 records' stored `district` string disagrees with the polygon containing them**:

| Record | Stored | Polygon says |
|---|---|---|
| **Trilliant** | Mirzo-Ulugbek | **Yunusobod** |
| NEXUS | Shaykhantakhur | Olmazor |
| SIMURG JSC | Yashnabad | Mirzo Ulugbek |
| TECHNOPLAZA | Yashnabad | Mirzo Ulugbek |
| Biznes sentr | Mirabad | Yashnobod |
| Boulevard Business Center | Yakkasaray | Shayxontohur |
| GetSpace | Yakkasaray | Chilonzor |
| Бизнес центр | Yunusabad | Shayxontohur |
| Бизнес центр 2 | Mirzo-Ulugbek | Yunusobod |
| Бизнес-центр Renaissance | Mirabad | Yashnobod |

**Problem.** §14 charts by district, §43 compares districts, §9 highlights districts – all from the string field,
while the map draws the polygons. **The chart and the map will visibly disagree.** Worse: `Trilliant` is one of only
16 priced records (A+, $44.7 – the highest rent in the dataset), and it is the **sole** priced record in
Mirzo-Ulugbek. Reassigning it to Yunusobod changes Mirzo-Ulugbek's "average rent" from $44.7 to *undefined* and
moves the top rent into a different district. A 10-record error silently rewrites the headline market finding.
**Impact.** Highest-severity data integrity issue found. The brief has no concept of cross-field validation.
**Resolution.** Make **geometry authoritative**: compute `district_geo` by point-in-polygon at boot, use it for all
aggregation and highlighting, retain `district_source` as the provider's claim, and flag the 10 conflicts in the
Data Quality panel as a review queue. Also normalise the 1 record with `"Алмазарский район"` → `Olmazor`, and
reconcile the Latin/Uzbek spelling pairs (Mirabad↔Mirobod, Yunusabad↔Yunusobod, Chilanzar↔Chilonzor,
Shaykhantakhur↔Shayxontohur, Yashnabad↔Yashnobod, Yakkasaray↔Yakkasaroy) via an explicit alias table, not fuzzy
matching. Note that **Yangihayot and Bektemir contain zero business centres** – a real finding that requires an
empty-state (M7), not a bug.

### 2.3 The DEMO record option (§6) – recommended, with a hard containment contract

§6 explicitly permits clearly-marked fictional records. This is the **only** non-fabricating way to exercise the
GLA / vacancy / occupancy / tenants / parking / status / pipeline code paths that 0% of real records can reach –
and without it, roughly 40% of the UI is untestable, which defeats §69's purpose (validating product logic).

**Recommendation: adopt it, tightly contained.** Containment is not a labelling nicety; it is the mechanism that
makes §2.2 and §47 enforceable rather than aspirational.

**Contract (all clauses mandatory):**

1. **Separate array, never concatenated.** Demo records live in `GEO.data.demoBusinessCenters`, never in
   `GEO.data.businessCenters`. They meet only at one function, `GEO.data.getWorkingSet()`, which is the single
   auditable seam in the codebase.
2. **Required discriminator, no default.** Every record carries `record_kind: 'observed' | 'demo'`. A record
   lacking `record_kind` is rejected at load, not defaulted. Demo IDs are prefixed `DEMO-`, never `BC-`.
3. **Off by default.** `demoMode = false` on first run and after every reset. Enabling it requires an explicit
   toggle in the Data Editor, never an AI action, never a URL parameter.
4. **Statistics are observed-only unless demo mode is on.** Every analytics function takes the working set and
   filters `record_kind === 'observed'` unless `demoMode`. When demo mode is on, **every** metric object carries
   `containsDemo: true` and **every** rendered number is prefixed with a `DEMO` chip. No exceptions, including
   AI-generated numbers (§46 Data Coverage must name the demo count separately: *"12 of 18 matching properties have
   rent data; 4 of 18 are DEMO records"*).
5. **Persistent visual state.** A non-dismissible amber banner – *"DEMO DATA ACTIVE – figures are not market
   evidence"* – spans the viewport whenever `demoMode` is true. Demo markers use a distinct hatched style and a
   separate legend entry.
6. **No promotion path, ever.** The editor cannot change `record_kind`. Import rejects any record that would move an
   ID from `demo` to `observed`. There is no UI, AI action or JSON shape that turns a demo record into an observed
   one.
7. **Exports are self-identifying.** Any export while demo mode is on gets filename suffix `-INCLUDES-DEMO`, a
   top-level `"contains_demo_records": true`, and a `_WARNING` string field. A downstream consumer who opens the
   file in a text editor sees it immediately.
8. **Unmistakable content.** Names are obviously fictional (`Demo Tower Alpha`, `Demo Plaza Beta`), `psrc: "DEMO"`,
   `sourceUrl: null`. Coordinates must be *plausible* (they need to sit in real districts for radius testing) but
   names must never be confusable with a real building.
9. **Fully populated, deliberately.** Demo records fill **every** schema field – that is their entire purpose: they
   are the fixture set that exercises GLA filters, vacancy charts, tenant lists, parking, amenities and pipeline
   status. A demo record with empty fields is useless.
10. **Small and fixed: 6 records.** Enough to exercise compare (2–4, §15), a competitive set, and both ends of every
    range filter. Large enough to look real is the failure mode to avoid.

---

## 3. Technical risks

| ID | Risk | Severity | Concrete mitigation |
|---|---|---|---|
| **T1** | `fetch()` of local JSON fails from `file://` (opaque origin, CORS). | Fatal | All seed data inlined as JS literals by the assembler. No `fetch`, no `XMLHttpRequest`, no ES modules (`import` also fails from `file://`). Classic scripts, one global `GEO` namespace. |
| **T2** | **Leaflet's default marker icons break from `file://`.** Measured: `leaflet.case.css` references `url(images/marker-icon.png)` and `url(images/layers-2x.png)`; `leaflet.case.js` calls `_detectIconPath()`, which derives the path from the `<script>` element's `src` – an **inlined** script has no `src`, so detection fails and every default marker 404s. | High | Use `L.divIcon` exclusively (wanted anyway for §9 class encoding); never instantiate `L.Icon.Default`. Replace `L.Control.Layers` with a custom layer control, or inline the two PNGs as `data:` URIs. Verify zero 404s in console per §66. |
| **T3** | `localStorage` from `file://`: the origin is `null`/opaque. Behaviour is browser-dependent – some browsers throw `SecurityError` on access, and where it works it is **shared across every `file://` page on that machine**, so another local prototype can collide. | High | Feature-detect with a `try { setItem; getItem; removeItem } catch`, never assume. On failure, fall back to an in-memory store and show a persistent notice ("edits will not survive reload"). Namespace every key `case.geo.v1.*`. The app must be fully functional read-only without storage. |
| **T4** | Quota. Seed JSON is 139 KB minified; `localStorage` stores UTF-16, so ~278 KB per saved copy. An undo stack (M1) or naive per-edit snapshots multiply this against a ~5 MB budget. | Medium | Persist a **diff against the shipped seed**, not a full copy – with 148 records and a handful of test edits this is <10 KB. Cap the undo stack at 20 entries. Handle `QuotaExceededError` explicitly with a user-visible message and an export prompt. |
| **T5** | **GeoJSON weight and render cost.** Measured: 268,012 bytes, **12,177 vertices** across 12 MultiPolygons, at 6-decimal precision (~0.1 m – absurd for district boundaries). As inline SVG paths this makes hover and pan visibly janky. | Medium-High | **Simplify.** Measured results: Douglas-Peucker at ~11 m tolerance + 5 dp → **1,402 vertices, 29 KB (89% smaller)**, visually identical at z11–z16 where this app lives. At ~5 m → 2,020 vertices / 41 KB. Recommend **~11 m / 29 KB**, precomputed by the assembler; keep the full-precision file in `geo-mvp/data/` for future server-side use. Render polygons with `L.canvas()`, not SVG. |
| **T6** | Marker clustering is probably a net negative at this scale. 148 markers is well within Leaflet's comfortable range, and clustering actively conflicts with §9's "selected property clearly highlighted" (C6b) and hides the 6 exact coordinate collisions (D9) that a reviewer most needs to see. | Medium | Keep markercluster vendored and wired, but enable it only below z13 with `disableClusteringAtZoom: 13`, `spiderfyOnMaxZoom: true`, `maxClusterRadius: 40`. Force-expand the cluster containing the selected record. Re-evaluate against measured frame rate, not assumption. |
| **T7** | OSM tiles: no network → blank grey map; the app looks broken. Also OSMF tile usage policy requires correct attribution and discourages heavy automated use. | Medium | `tileerror` handler → render a neutral graticule background plus a one-line notice ("Base map unavailable offline – data and analytics still work"). All markers, polygons, analytics, compare and radius analysis must remain fully functional with zero tiles. Keep the OSM attribution control mandatory and non-removable. |
| **T8** | No build step at runtime, but a Python assembler at author time → risk of `index.html` silently diverging from `src/`. | Medium | Assembler writes a build stamp comment (source file list + SHA-256 of each) into the output; a `--check` mode re-verifies. Never hand-edit `index.html`. |
| **T9** | No framework → manual DOM/state synchronisation. §59 explicitly requires AI-applied filters to be reflected in the manual filter panel; this is precisely the class of bug hand-rolled state management produces. | High | Single source of truth (`GEO.state`), all mutations through `GEO.state.set(patch)`, one `render()` that re-derives every panel from state. **No component may write to another component's DOM.** §59 then holds by construction rather than by discipline. |
| **T10** | **Mixed-script search.** Measured: 100 of 109 addresses are Cyrillic, 12 of 148 names are Cyrillic, district labels are Latin. A naive `indexOf` means typing "Mirabad" misses Cyrillic addresses and typing "Бизнес" misses Latin names. §18 requires search across name, address and district. | Medium-High | Normalise both query and target: lowercase, strip diacritics, and apply an explicit RU→Latin transliteration table both directions. Index a precomputed `_search` blob per record at boot. Test with both `Бизнес` and `Biznes`. |
| **T11** | **`rent` is stored as a string** (`"34.8"`, measured). A range filter or sort comparing strings gives `"9" > "40.6"` lexically. `lat`/`lng` are correctly floats. | High (silent) | Coerce once at load into a normalised model (`rent_value: number \| null`, `rent_currency`, `rent_unit`); never read raw strings in analytics. Empty string must become `null`, not `0` – §36's core rule. |
| **T12** | **Encoding.** Cyrillic data inlined into HTML served from `file://` with no charset declaration → the browser may guess a legacy codepage and render mojibake. There is no HTTP header to save you on `file://`. | High, trivially fixed | `<meta charset="utf-8">` as the first element of `<head>`; assembler writes UTF-8 without BOM and asserts it. |
| **T13** | Inline data inside `<script>`: any `</script>` sequence inside a string terminates the block; Cyrillic `_note` fields are free text from a scraper. | Medium | Assembler escapes `<` as `<` in all embedded JSON. Also strip U+2028/U+2029. |
| **T14** | Total page weight: ~192 KB vendored libs + ~99 KB slim BC data + ~29 KB simplified GeoJSON + app code ≈ **350–450 KB single file**. | Low | Acceptable for `file://` (no network). Worth stating in delivery notes. Drop the 15 always-empty fields from the inlined records (139 KB → 99 KB measured) and reconstruct them from the schema at load. |
| **T15** | No automated test harness; §66 lists 25 manual QA checks. | Medium | Ship a `?selftest=1` mode that runs assertions (record count, coverage numbers, denominator correctness, point-in-polygon agreement, no-NaN in every metric) and prints pass/fail. Cheap, and it makes §66 repeatable instead of aspirational. |

---

## 4. Features to defer deliberately

§68 already ranks priorities and §2.6 says choose clarity over features. These are the items whose cost exceeds
their validation value **for this MVP**, with the argument for each.

| Brief § | Feature | Argument for deferral | What to ship instead |
|---|---|---|---|
| §8 | City selector, property type selector | Each has exactly one option (§8 fixes Tashkent / Business Centers). §29 forbids controls that do nothing. A dropdown with one item teaches a tester nothing and invites "when can I pick Samarkand?" in a session meant to validate analytics. | Static labelled chips `Tashkent` / `Business Centers` with a tooltip "Additional cities and asset types in later versions". Architecture supports both (§3, §4). |
| §53 | AI task-planner status theatre ("Understanding request… Analyzing properties…") | The MVP engine is a deterministic keyword parser (§54) that completes in <5 ms. Staging fake progress **simulates latency that does not exist** to imply intelligence that does not exist – the presentational cousin of the fabrication §47 forbids. It also corrupts the UX finding: testers will report on perceived AI sophistication rather than on the interaction model §54 says we are actually validating. | Instant results, plus a **"How this was answered"** disclosure listing the matched intent, the tools called and the record count. Same transparency goal, honest mechanism, and it validates the tool-registry design (§56). |
| §27 | Three-language UI now | §27 itself permits English-only. Translating ~250 strings is real work that validates nothing about geoanalytics, and data stays untranslatable regardless (C12). | English UI, 100% of strings in `GEO.i18n.en`, zero literals in markup, language selector present but disabled. Adding RU later is then a data-entry task. |
| §13 | Image placeholder in the property card | Zero photos exist and none are collectable. An empty 16:9 box pushes the actual data below the fold. | Omit the box; keep `photos: []` in the schema (§5.7). |
| §5.5 / §11 | Amenities as a filter UI | 0/148 coverage. 12 checkboxes that match nothing. | Schema + detail-card rendering only; register the filter as unavailable (C7). |
| §5.4 / §18 | Tenant search | 0 tenant records. §18 already hedges ("if data exists"). | Schema only. |
| §61 | AI audit-log **panel** | §61 itself says the MVP needs only a lightweight session log. A UI for inspecting one's own 10-message session is a governance feature for enterprise buyers, not a validation feature. | In-memory session log, included in export. No panel. |
| §39 / §60 | Internal vs external AI permission modes | A role switcher invites testers to evaluate a permission model that has no backend to enforce it, and §28 defers all auth. It would produce confident feedback about a fiction. | Architecture note in doc 06; single implicit internal role. |
| §7 | Analytics as a *separate* drawer from the AI panel and AI-layers panel | Three right-hand surfaces guarantee the crowding §24 forbids (C9). | One right rail, four tabs. |
| §16 / §17 | "Analyze Location" and "Nearby Competitors" as separate features | They compute the same thing from the same input (a selected property + a radius) and differ only in presentation. Two buttons doing one job is the opposite of §2.6's clarity rule. | One **Location Analysis** panel: radius selector, counts at 1/3/5 km, and the competitive set as its editable result list (§17's manual add/remove preserved). |
| §9 | Fullscreen map | Keep – it is ~10 lines via the Fullscreen API and directly serves §24's "large usable map". Listed here only to record that it was considered and retained. | Ship it. |

---

## 5. Critical functions missing from the brief

The brief is thorough on *product* and near-silent on *operational safety*. None of the following appear anywhere in
69 sections, and every one of them is needed for the prototype to survive a user-testing session.

| ID | Missing function | Why the prototype needs it | MVP-NOW requirement |
|---|---|---|---|
| **M1** | **Undo for destructive edits.** §21 grants add/edit/delete and coordinate changes with no undo, no confirmation and no recovery. | A tester deletes a record, reloads, and the record is gone from `localStorage` forever. Confidence in the tool collapses mid-session. | Confirm dialog naming the record for delete; a 20-deep undo stack (Ctrl+Z) covering edit/delete/coordinate-move; soft delete (`deleted_at`) with a "Recently deleted" list and restore. |
| **M2** | **Schema versioning of `localStorage`.** Nothing in §20/§21 versions the persisted shape. | The assembler will ship v2 next week; a tester's browser holds v1; the app reads a field that no longer exists and white-screens – on `file://`, with no console open, unrecoverable for a non-technical user. | `SCHEMA_VERSION` constant written with every save. On mismatch: do not load, do not silently migrate. Show a recovery dialog offering *Export my old data* / *Discard and start clean*, with a registered migration path when one exists. |
| **M3** | **Return to a clean state – two distinct actions.** §21 offers only the ambiguous "Reset Demo Data" (C10). | "I broke it, how do I start over?" is the most common user-testing event. Also needed between testers. | Two separate, separately-confirmed commands: **Restore original dataset** (discard local edits, keep session/layers) and **Full reset** (clear all `case.geo.*` keys, reload). Plus a boot-time escape hatch `index.html#reset` that clears storage *before* app init, so a corrupt state is always recoverable without devtools. |
| **M4** | **Duplicate-record handling.** The brief never mentions duplicates; the data has 12 flagged (D9) plus 1 unflagged name duplicate and 3 sub-30 m pairs. | Duplicates inflate every count in §14, §16 and §43 – the numbers the whole product is judged on. | A **Duplicate review** queue: side-by-side comparison, three verdicts (*same / different / undecided*), default *undecided*, verdict persisted with provenance. Never auto-merge. Counts show `148 records (6 possible duplicate pairs unresolved)`. |
| **M5** | **Cross-field validation / conflict flags.** No section asks whether stored values agree with each other. | 10 records' district strings contradict the polygons (D11), including the dataset's highest rent. Charts and map will visibly disagree and nobody will know why. | Boot-time validators: point-in-polygon district check, coordinate bounds check, rent-range sanity, non-BC entity check (D10). Results surface in a **Data Quality** panel as a work queue, not as silent corrections. |
| **M6** | **Keyboard accessibility and focus management.** Not mentioned once in 69 sections. §24 claims a professional tool. | Drawers that trap nothing, cannot be closed with Esc, and return focus to `<body>` are unusable for keyboard users and feel cheap to everyone. Professional CRE users live on keyboards. | Esc closes the top-most panel; focus trap in drawers and modals; focus returns to the invoking control; visible focus rings (never `outline: none` without replacement); `role`/`aria-label` on panels; the property list is a real keyboard-navigable list so the map is not the only path to a record; skip-link to the list. |
| **M7** | **Empty and zero states.** §14 specifies "Insufficient verified data" for metrics and nothing else. | Measured: **Yangihayot and Bektemir contain zero business centres** – click them and the panel is blank. Zero filter results, empty comparison, empty AI layer and empty search all need designed states. | A single `renderEmptyState(context, reason, action)` helper used everywhere, always naming the cause and offering an escape ("No properties match. Clear rent filter?"). |
| **M8** | **Error states.** Only §66's "no console errors" gestures at this. | Tiles fail offline (T7); `localStorage` throws (T3); imported JSON is malformed – §21 requires Import with no validation spec at all. | Tile-failure notice; storage-unavailable banner; **import validation** that parses, checks `SCHEMA_VERSION`, validates each record, and returns a per-row report (`142 imported, 6 rejected: BC-x missing lat…`) with an all-or-nothing commit. Never partially apply a bad import. |
| **M9** | **URL-shareable state.** Never mentioned. | The core activity is user testing. "Open this exact view" is impossible without it, and every observation has to be reproduced by hand. Works fine on `file://` via the hash. | Serialise filters, selection, map view, active tab and AI layer definitions into `location.hash`; restore on load. Cheap, and it makes §35's ten scenarios reproducible as ten links. |
| **M10** | **Export/print of an analysis.** §45 lists `export_results` as an AI action, but §21 only exports the *dataset*. | A consultant's output is a document. Being unable to get an analysis out of the tool caps its perceived value at "nice demo". | CSV export of the current filtered set with active filters in a header comment; print stylesheet for the property card, comparison table and location analysis (hide chrome, expand panels, print denominators and the collection date on every page). |
| **M11** | **Session reset and session capture for testing.** §69 makes validation the entire purpose; §61 mentions only a conceptual log. | Between testers you must clear session state without clearing test data, and after a session you need to know what was actually tried. | "New session" (clears AI history, layers, selection, comparison; keeps data). Session log of every action with timestamps, exportable as JSON – the actual research output of this MVP. |
| **M12** | **Diff between shipped data and local edits.** §21's stated purpose is testing data-collection workflows. | Without a diff you cannot tell what a collector changed, which is the one thing the workflow test needs to produce. | "Local changes (N)" view listing added/edited/deleted records with before→after per field; exportable as a change-set. |
| **M13** | **Input validation and type coercion on edit.** §21 allows editing coordinates and commercial data with no constraints. | `rent` is already a string (T11); a tester typing `34,8` or `$35/mo` corrupts analytics silently. A mistyped coordinate moves a building to the Atlantic. | Typed field editors; numeric parse with explicit units; coordinate bounds check against the Tashkent envelope (lat 41.15–41.40, lng 69.10–69.45, derived from the measured data extent) with a warning, not a hard block; every edit writes field-level provenance (C13) and sets `_checkedBy`/`_checkedAt`. |
| **M14** | **Coverage transparency at the dataset level.** §14/§36 require denominators per metric; nothing requires a global honest summary. | The single most valuable screen for a CRE professional evaluating this product is "what do you actually know?". It is also the data-collection backlog (§50) and the §34 internal user's home screen. | A **Data Coverage** view: every field, known/total, as a ranked bar chart. This replaces the impossible GLA histogram (§14 chart 4) and is the honest heart of the §37 moat story. |

---

## 6. Final verdict

### 6.1 Must resolve before building – these need a human decision

Ranked by the cost of getting them wrong.

| # | Issue | § | Decision required |
|---|---|---|---|
| **1** | **District authority conflict.** 10 records' stored district contradicts the polygons, including `Trilliant` (A+, $44.7, the highest rent and the sole priced record in its stored district). | §3, §14, §43, D11 | Confirm **geometry is authoritative**. Until confirmed, do not publish any district-level rent figure. This one error silently rewrites the headline market finding. |
| **2** | **`data_confidence` is the constant `"B"`**, in a vocabulary the brief does not define. Four features (§11 filter, §19 chips, §42 layer, §63 Test 5) depend on it. | §2.3, §19, D7 | Confirm the meaning of the 2GIS `A/B/C` grade, or approve the proposed switch to a derived `completeness` + `verification_state` model. **Do not approve a silent `B → Medium` mapping.** |
| **3** | **§63 AI Test 2 is unsatisfiable without fabricating GLA** (0/148 coverage) while §54 lists the ">5,000 m²" intent as mandatory. | §54, §63, C8 | Choose: (i) rewrite the test's expected result to a §62-style refusal, or (ii) enable the DEMO subset. Recommend (i), optionally with (ii). **Recommend rejecting the requirement as written** – it is the one place the brief's own QA criteria push toward violating its own §2.2. |
| **4** | **DEMO record set: go / no-go.** Without it ~40% of the UI is unreachable; with it, containment must be absolute. | §6, §2.2, §2.3 | Approve the 10-clause containment contract and the fixed count of 6, or accept that GLA/vacancy/occupancy/tenant/parking/status UI ships permanently empty. |
| **5** | **Duplicate adjudication.** 6 exact coordinate pairs + 1 name duplicate + 3 sub-30 m pairs, affecting up to 4% of every count. | §14, §16, D9 | Confirm **no auto-merge**, review queue only, and that headline counts disclose unresolved duplicates. |
| **6** | **Non-office entities in the dataset** (consultancy listed twice, an association, a bank financial centre, three generic non-names, one district name). | §4, D10 | Approve the `entity_review` flag and the default-on "exclude suspected non-office" toggle, or accept that the property count is overstated. |
| **7** | **Context layers cannot be populated** (no metro dataset, OSM blocked). | §10, §13, C3 | Confirm the honest empty-slot approach. **Explicitly reject** any instruction to approximate metro locations. |
| **8** | **Working product name.** §8 forbids "ZAKY". | §8 | Supply a neutral name, or accept the placeholder. Recommend **"CASE Geo"** as a single `PRODUCT_NAME` constant, one line to change. |
| **9** | **Staleness is undefined** with a single collection date across all 148 records. | §19, §23, D8 | Approve shipping the engine with an explicit "all records share one collection date" disclosure, rather than a threshold that flags all or nothing. |

### 6.2 Note and proceed – resolved by implementation decisions recorded here

| # | Item | Decision taken |
|---|---|---|
| 10 | §29 vs §9 CDN vs `file://` | Vendor + inline; Python assembler at author time only (C1). |
| 11 | §65 Step 7 research | Skip; use repo dataset; declare provenance (C2). |
| 12 | §7 seven UI regions | One left rail + one tabbed right rail; max two panels open (C9). |
| 13 | §14 impossible metric cards | Render the 4 computable; move structurally-empty to "Not yet collected" (C5). |
| 14 | §14 chart 4 (GLA histogram) | Replaced by Data Coverage chart (M14). |
| 15 | §14 chart 3 (rent histogram, n=16) | Strip plot of all 16 values with denominator. |
| 16 | §17 competitive set | Proximity-only, labelled as such; manual add/remove retained. |
| 17 | §9 marker encoding | Switchable encoding; unknown-class deliberately recessive (C6a). |
| 18 | §9 clustering | Off above z13; force-expand cluster containing selection (C6b, T6). |
| 19 | §11 dead filters | Coverage-driven; zero-coverage filters render disabled with their count (C7). |
| 20 | §21 "Reset Demo Data" | Renamed and split into *Restore original dataset* / *Full reset* (C10, M3). |
| 21 | §27 languages | English-only UI, all strings centralised, selector disabled (C12). |
| 22 | §53 AI progress theatre | Replaced with instant results + "How this was answered" disclosure. |
| 23 | §2.3 vs §5.6 provenance granularity | Record-level defaults + per-field override on edit (C13). |
| 24 | §31 vs §16 radius scope | §16 governs; radius counts are MVP-NOW. |
| 25 | GeoJSON weight | Simplify to ~11 m / 1,402 vertices / 29 KB; canvas renderer (T5). |
| 26 | `rent` string type | Coerce to `rent_value: number \| null` at load; never read raw (T11). |
| 27 | Leaflet icons on `file://` | `divIcon` only; custom layer control; no `L.Icon.Default` (T2). |
| 28 | Encoding | `<meta charset="utf-8">` first; assembler asserts UTF-8 no BOM (T12). |
| 29 | Mixed-script search | Normalise + transliterate both directions; precomputed index (T10). |
| 30 | `localStorage` availability | Feature-detect, in-memory fallback, namespaced keys, diff-based persistence (T3, T4). |

### 6.3 The single most important judgement in this review

This dataset supports **geography extremely well** (148/148 coordinates, 12 authoritative polygons, 0 records
outside the city) and **commercial attributes very poorly** (10.8% class and rent, on the same 16 records; 0% for
everything else).

The brief was written as though the reverse were true – §14, §15 and §41–43 are largely commercial-attribute
features. Implemented literally, the prototype becomes a set of grey "insufficient data" boxes that makes the
dataset look worthless, when in fact its coordinate layer is genuinely strong.

**Recommendation: rebalance the MVP toward what the data actually supports** – location analysis (§16), district
distribution (§14 charts 1–2), proximity competitive sets (§17), and above all **data-coverage transparency**
(§19, §37, M14) – and demote the attribute-heavy analytics to clearly-labelled known-subset statistics with
visible denominators. This is not a retreat from §14; it is §2.1 ("business question first, data second") and
§2.7 ("never hide uncertainty") applied honestly to the data that exists.

Done this way, the prototype's weakest dimension – 89% missing commercial attributes – becomes its most
persuasive demonstration: it shows a buyer precisely what a professional collection programme would be worth,
which is the §37 data-moat argument made with evidence instead of assertion.
