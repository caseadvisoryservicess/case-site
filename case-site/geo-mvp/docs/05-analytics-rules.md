# 05 — ANALYTICS FORMULAS & MISSING-DATA RULES

Brief §65 Step 5. Normative expansion of `00-BUILD-CONTRACT.md` §7 (analytics contract) and §8 (the oracle).
Implements §14 (light analytics), §36 (analytics quality rules), §16 (location analysis), §17 (competitive set),
§19 (data-quality UX), §46/§47 (AI coverage disclosure).

**Authority.** `00-BUILD-CONTRACT.md` wins over this document; this document wins over `01-product-spec.md`,
`03-information-architecture.md` and `10-visual-system.md` on any numeric or arithmetic question.
Every number in §12 was computed from the shipped `data/seed.json` and cross-checked against
`tools/oracle.py` / `data/oracle.json`.

**Tags.** `[NOW]` = built in this prototype. `[ARCH]` = the seam exists, the code path is written or stubbed,
the feature is **not** enabled and must not be implied in the UI.

**Implementation target.** `src/js/08-analytics.js` (metrics), `src/js/09-geo.js` (distance, rings, competitive
set), `src/js/10-charts.js` (chart data shaping), `src/js/04-quality.js` (staleness, completeness, confidence),
`src/js/24-selftest.js` (the probes in §6.5 and the oracle values in §12).

---

## 1. Vocabulary — what n and N mean

| symbol | meaning | where it comes from |
|---|---|---|
| **`NAll`** | records in the **dataset under the current mode** — after the demo toggle and the duplicate-collapse rule, **before** filters and search | `GEO.analytics.scope(state).NAll` — 148 at seed, 156 with demo on |
| **`N`** | records in the **current analytics scope** — after filters, search and every other exclusion. The denominator of every metric. | `rows.length` |
| **`n`** | records in the scope that **contribute a verified value** to this metric | `known(rows, field).length` |
| **`nEx`** | `N − n` — records excluded from this metric because the value is not recorded | derived; always displayable |

`N` is **never** the whole dataset when filters are active, and `n` is **never** silently substituted for `N`.
Both travel with the value, in the same object, forever (§14: *"Every metric should make clear its denominator"*).

### 1.1 Scope construction (binding order)

```js
GEO.analytics.scope = function (state) {
  var rows = GEO.data.records();                       // 156 loaded records
  if (!state.ui.demoMode) rows = rows.filter(notDemo); // D4 — demo excluded by default  -> 148
  if (state.ui.excludeSuspected)                       // D7 — default OFF
    rows = rows.filter(function (r) { return r._meta.entityReview !== 'suspected_non_bc'; });
  rows = GEO.analytics.collapseDuplicates(rows);       // §11.5 — only verdict 'same_building' collapses
  var NAll = rows.length;                              // the dataset under the current mode
  var filtered = GEO.filters.apply(rows, state.filters, state.search);
  return { rows: filtered, N: filtered.length, NAll: NAll,
           filtersActive: filtered.length !== NAll || GEO.filters.anyActive(state.filters),
           demoOn: !!state.ui.demoMode };
};
```

Every metric, every chart, the results list, the map marker set, the AI tool layer and the export all consume
**this one object**. A panel that builds its own row set is a defect (it will disagree with the denominator line).

---

## 2. The canonical readers — no metric may touch a raw array

### 2.1 `known()` — the only permitted value reader (D2, §36)

```js
/**
 * The ONLY way any metric may read values out of records.
 * Returns the non-null, finite values for `field`. Never coerces, never defaults,
 * never substitutes 0. Order is the row order (callers that need order must sort).
 */
GEO.analytics.known = function (rows, field) {
  var out = [], i, v;
  for (i = 0; i < rows.length; i++) {
    v = rows[i][field];
    if (!GEO.util.isKnown(v)) continue;                 // null / undefined / '' / [] -> not a value
    if (typeof v === 'number' && !isFinite(v)) continue; // NaN / ±Infinity -> not a value
    out.push(v);
  }
  return out;
};

/** Same predicate, returns the RECORDS — for "which properties contributed?" popovers,
 *  for excluded-record lists, and for any metric that needs two fields from one row. */
GEO.analytics.knownRows = function (rows, field) { … };

/** Records in scope that did NOT contribute. Rendered in the metric popover (A-02). */
GEO.analytics.missingRows = function (rows, field) { … };
```

`GEO.util.isKnown` (already shipped, `src/js/00-core.js`) is the predicate: `0` and `false` **are** known;
`null`, `undefined`, `''`, `'   '`, `[]` and `NaN` are **not**.

### 2.2 Primitives

```js
GEO.analytics.sum      = function (vals) { return vals.length ? vals.reduce(add, 0) : null; };  // [] -> null, NOT 0
GEO.analytics.mean     = function (vals) { return vals.length ? sum(vals) / vals.length : null; };
GEO.analytics.median   = function (vals) {                                   // even n -> mean of the two central
  if (!vals.length) return null;
  var s = vals.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
GEO.analytics.quartiles = function (vals) {                                  // Tukey hinges; null below minN.quartiles
  if (vals.length < GEO.analytics.MIN_N.quartiles) return null;
  var s = vals.slice().sort(asc), h = s.length >> 1;
  return { q1: median(s.slice(0, h)), q3: median(s.slice(s.length % 2 ? h + 1 : h)) };
};
GEO.analytics.round2   = function (x) {                                      // assertion + storage boundary only
  return x === null ? null : Math.round((x + (x >= 0 ? 1e-12 : -1e-12)) * 100) / 100;
};
```

`sum([])` returning **`null`, not `0`,** is the single most important line in the module: it is what stops
*"Total known GLA: 0 m²"* from ever being printed (§36).

### 2.3 `metric()` — the object every card, chart, AI answer and export receives

```js
GEO.analytics.metric = function (rows, field, kind, opts) -> Metric
```

| property | type | meaning |
|---|---|---|
| `key` | string | stable metric id, e.g. `'rent.mean'` — used by i18n, selftest and the AI tool layer |
| `kind` | enum | `count · sum · mean · median · share · minmax · groupCount · groupMean · distribution · composite` |
| `field` | string\|string[] | source field(s) |
| `value` | number\|object\|null | full precision; `null` whenever `sufficient === false` |
| `n`, `N`, `NAll` | integer | §1 |
| `unit` | string\|null | `'USD/m²/month'`, `'m²'`, `'%'`, `null` for counts |
| `sufficient` | boolean | §4 |
| `reason` | enum\|null | `zero_coverage · below_min_n · field_not_collected · empty_scope` |
| `coverageText` | string | the §3 sentence — **always populated, including when sufficient** |
| `coverageBand` | enum | `full · high · partial · low · none` (§3.3) |
| `scopeText` | string\|null | the filter-scope sentence; `null` when no filters are active |
| `containsDemo` | boolean | a DEMO record contributed a value |
| `notes` | string[] | mandatory qualifiers (unit assumption, duplicate warning, derivation mix, …) |
| `extras` | object | kind-specific: `{min,max,q1,q3}`, `{buckets:[…]}`, `{derivedCount,measuredCount}` |

Rules: `value === null` ⟺ `sufficient === false`. `coverageText` is never empty. No consumer may re-derive
`n`/`N` from anything else.

---

## 3. The denominator doctrine (§14, §36, §47)

### 3.1 The sentence — exact strings

One function produces it everywhere. Canonical implementation is `GEO.fmt.coverage(n, N, noun)` (shipped in
`src/js/00-core.js`), which **must be refactored to delegate to** `t.coverage(n, N, fieldKey)` so no string is
built by concatenation (IA §9.3 rule 3). The output is identical.

| case | condition | string (EN) | i18n key |
|---|---|---|---|
| normal, plural | `n ≥ 1`, `N > 1` | `Based on 16 of 148 properties with verified asking rent.` | `metric.coverage.other` |
| normal, singular | `n ≥ 1`, `N === 1` | `Based on 1 of 1 property with verified asking rent.` | `metric.coverage.one` |
| **n = 0**, plural | `n === 0`, `N > 1` | `No properties in the current selection have verified asking rent.` | `metric.coverage.zero.other` |
| **n = 0**, singular | `n === 0`, `N === 1` | `The selected property has no verified asking rent.` | `metric.coverage.zero.one` |
| **N = 0** | `N === 0` | `No properties in the current selection.` | `metric.coverage.empty` |

**Plural agreement is with `N`, not `n`** — "1 of 148 property" is ungrammatical. `N === 1` is the only case
that takes the singular noun, and it forces `n ∈ {0, 1}`, so the contract's "`property` singular at n=1" and
this rule agree on every reachable input. The sentence **ends with a full stop**; it is a sentence, not a label.

`{field}` is the field's **coverage noun**, not its UI label. Add `covNoun` to the field registry
(`src/js/02-schema.js`):

| field | `covNoun` | field | `covNoun` |
|---|---|---|---|
| `askingRent` | `asking rent` | `vacancyPct` | `vacancy` |
| `officeClass` | `office class` | `occupancyPct` | `occupancy` |
| `gla` | `GLA` | `availableArea` | `available area` |
| `gba` | `GBA` | `parkingSpaces` | `parking` |
| `floors` | `floor count` | `yearOpened` | `year opened` |
| `status` | `status` | `serviceCharge` | `service charge` |
| `districtKey` | `district` | `address` | `address` |
| `tenants` | `tenant information` | `amenities` | `amenity information` |
| *composite: vacant area* | `available area` | *composite: weighted rent* | `asking rent and GLA together` |

Initialisms keep their case (`GLA`, `GBA`); everything else is lower case mid-sentence.

### 3.2 The scope sentence (second line, filters only)

Rendered under the coverage line **only when `N !== NAll`**:

```
Current filters cover 8 of 148 properties in the dataset.
```
`metric.scope.filtered` · `{N}`, `{NAll}`. With no filters the analytics panel's own scope line (A-01) carries
`All 148 properties in the dataset.` and, when demo is off, `8 demo records excluded.`

**The filter-collapse trap (mandatory).** A range filter on a nullable field excludes every unknown-value
record, so inside that scope `n === N` and the coverage line reads *"Based on 8 of 8 properties"* — which
implies complete coverage of a set that was itself selected for having data. Guard, both required:

1. every range filter on a nullable field is a **tri-state** — `Any` / `In range` / `Only unrecorded` —
   defaulting to *In range with unknowns excluded*, and the filter panel prints
   `132 properties excluded — asking rent not recorded` (`filters.excluded.<field>`);
2. when the metric's field is itself filtered, `notes` gains
   `This selection was filtered on asking rent, so every property in it has a recorded value.`
   (`metric.note.selfFiltered`).

### 3.3 Coverage bands — a caution chip, never a suppression

| band | condition | chip | tooltip |
|---|---|---|---|
| `full` | `n === N` | — | — |
| `high` | `n/N ≥ 0.60` | — | — |
| `partial` | `0.25 ≤ n/N < 0.60` | `Partial coverage` | `This figure is calculated from {n} of {N} properties.` |
| `low` | `0 < n/N < 0.25` | `Low coverage` | `Fewer than a quarter of the properties in this selection have a recorded value. Treat as indicative, not as a market benchmark.` |
| `none` | `n === 0` | — | the insufficient state replaces the value |

The 0.60 cut is taken from the brief's own published example (18 of 31 = 58 %, §14) — a figure the brief is
willing to print with nothing but its denominator. Anything at or above that needs no further caution.
Below 0.25 the value is a minority reading and the chip is mandatory. **Bands never hide a number.**

### 3.4 Placement (binding)

The coverage line is rendered **permanently** under the value on the card, under every chart, in the compare
table footer, in the location-analysis block, in every AI `dataCoverage` block, and in the CSV export header.
It is never hidden behind a tooltip, a popover or a disclosure. Typography: 11 px / `--text-3`
(`10-visual-system.md` §6).

---

## 4. The insufficient-data threshold (§14)

### 4.1 Rule

```js
GEO.analytics.MIN_N = { count: 0, share: 0, sum: 1, minmax: 1,
                        mean: 3, median: 3, groupMean: 3, distribution: 3,
                        quartiles: 8, histogram: 30 };
```

| metric kind | renders when | renders `Insufficient verified data` when | why |
|---|---|---|---|
| **count** over a *required* field (district) | always | `N === 0` only | a zero is a **recorded fact**: the district is in the dataset and holds no records |
| **count / group count** over a *nullable* field (class, status) | `n ≥ 1` | `n === 0` | with `n = 0` the buckets are all zero, and `Operating 0 · Pipeline 0` reads as a market fact when it is an absence |
| **sum** (total known GLA, vacant area) | `n ≥ 1` | `n === 0` | a sum of recorded values is a fact about records; it is *not* a market total, so it always carries the partial qualifier of §5.2 |
| **mean / median / group mean** | `n ≥ 3` | `n < 3` | a "district average rent" from one building is not an average; two priced records in Yashnobod would otherwise publish a two-point market benchmark |
| **distribution / histogram** | `n ≥ 3` | `n < 3` (the Unknown bucket still renders) | below 3 there is no shape to plot; individual values are shown instead (§7.1) |
| **quartiles / IQR** | `n ≥ 8` | suppressed silently, median still shown | hinges over fewer than 8 points are two individual values wearing a statistical name |
| **min / max** | `n ≥ 1` | `n === 0` | the highest recorded rent is a property of one record; label it `Highest recorded`, never `market high` |

### 4.2 No percentage-coverage gate — and why

A coverage floor was considered and **rejected**. At any floor above 10.8 % the headline asking-rent metric
(16 of 148) blanks out — and that is the single most commercially useful number this dataset contains.
§14 requires the figure *with its denominator*; §2.7 requires uncertainty to be *disclosed, not hidden*;
§36's own worked example publishes a mean from 12 of 30 (40 %) and §47's from 14 of 27 (52 %). Suppression
at low coverage would therefore contradict the brief in three places, and would teach users that a blank
card means "no data" when it actually means "data the tool declined to show".

**The threshold is on `n` only.** Coverage percentage drives the §3.3 caution chip instead. The two rules
combine: `n ≥ 3` makes the statistic computable; the band tells the reader how much of the selection it speaks
for.

### 4.3 The insufficient state — exact copy

```
Insufficient verified data                                  ← metric.insufficient (value slot)
No properties in the current selection have verified GLA.   ← the §3.1 coverage line (always)
GLA is not recorded for any property in this dataset.       ← metric.reason.* (one sentence, only when it adds)
```

| `reason` | condition | sentence |
|---|---|---|
| `empty_scope` | `N === 0` | — (the coverage line is the explanation) |
| `zero_coverage` | `n === 0`, but `coverage(allRows, field) > 0` | `{Field} is recorded for {nAll} properties in the dataset, none of them in this selection.` |
| `field_not_collected` | `n === 0` and `coverage(allRows, field) === 0` | `{Field} is not recorded for any property in this dataset.` |
| `below_min_n` | `0 < n < MIN_N[kind]` | `A {mean\|median\|distribution} needs at least {min} verified values; this selection has {n}.` |

The insufficient state is **not a link and not a button** (IA A-07). It never offers to "estimate anyway".

---

## 5. Metric catalogue (§14) — the nine cards

Notation: `rows` = `scope.rows`; `k(f)` = `known(rows, f)`; all display formatting via `GEO.fmt.*`.

### 5.1 M1 · Total business centres

| | |
|---|---|
| key / kind | `count.total` · `count` |
| eligibility | every row in scope (no field predicate) |
| formula | `value = rows.length` |
| unit / rounding | none · integer |
| min n | — (always sufficient unless `N === 0`) |
| coverage line | no filters: `All 148 properties in the dataset.` · filtered: `148 of 148 properties in the dataset match the current filters.` |
| notes | duplicate footnote (§11.5) when the scope holds an unresolved group; `8 demo records excluded.` when demo is off |
| label | `Business centres` |

### 5.2 M2 · Total known GLA

| | |
|---|---|
| key / kind | `gla.sum` · `sum` |
| eligibility | `isKnown(r.gla) && isFinite(r.gla)` |
| formula | `value = Σ k('gla')` |
| unit / rounding | `m²` · `round0`, thousands separators (`fmt.area`) |
| min n | 1 |
| coverage line | `Based on {n} of {N} properties with verified GLA.` |
| label | **`Total recorded GLA (partial)`** — the word *partial* is not optional |
| notes | always: `Covers {n} of {N} properties. This is the sum of recorded values, not an estimate of total market supply.` (`metric.note.partialSum`) |

A sum whose coverage band is `low` or `partial` must never be described as market supply anywhere in the UI,
the AI answers or the export.

### 5.3 M3 · Average asking rent

| | |
|---|---|
| key / kind | `rent.mean` · `mean` |
| eligibility | `isKnown(r.askingRent) && typeof r.askingRent === 'number' && isFinite(...)` |
| formula | `value = Σ k('askingRent') / n` |
| unit / rounding | `USD/m²/month` · value full precision; assertions at `round2`; **display 1 dp** (`fmt.rent` → `$32.2 /m²/month`) |
| min n | 3 |
| coverage line | `Based on {n} of {N} properties with verified asking rent.` |
| label | **`Average asking rent (per property, unweighted)`** |
| extras | `{min, max, q1, q3, median}` for the popover |
| notes | always: `Unit assumed USD/m²/month; not stated by the source.` (`rent.unitAssumed`) · always: `Headline asking rents from a directory listing. Service charge, VAT and achievability are unknown.` |

A rent of **0** is a legal recorded value (rent-free / turnover-only). It is `known`, it enters `n`, and it
enters the mean. `null` means *not recorded*; `"rent on request"` is recorded as `null` plus a note — **never**
as `0` (§36).

### 5.4 M4 · Median asking rent

Identical to M3 except: `kind = median`; `value = median(k('askingRent'))`; label `Median asking rent`.
**Even-count convention: the mean of the two central values** (contract §7). At `n = 16` the median is the mean
of the 8th and 9th sorted values. Mandatory note when `n` is even:
`Even sample (n = {n}): the median is the mean of the two central values ($29.8 and $34.8).`
(`metric.note.medianEven`).

### 5.5 M5 · Known vacant area (composite)

| | |
|---|---|
| key / kind | `vacantArea.sum` · `composite` (sum) |
| per-record value | **precedence, never mixed within one record:** `1. availableArea` if known → *measured*; `2.` else `gla × vacancyPct / 100` if **both** known → *derived*; `3.` else `null` |
| formula | `value = Σ perRecord`, `n = measuredCount + derivedCount` |
| unit / rounding | `m²` · `round0` |
| min n | 1 |
| coverage line | `Based on {n} of {N} properties with verified available area.` |
| notes | when `derivedCount > 0`: `{measured} measured from recorded available area, {derived} derived from GLA × vacancy.` (`metric.note.vacantMix`) |
| extras | `{measuredCount, derivedCount}` |
| label | `Known vacant area (partial)` |

`availableArea === 0` is a **measured zero** (a full building) and must be summed, not dropped —
`DEMO — Eta House` carries it precisely to test this. `vacancyPct === 0` likewise.

### 5.6 M6 · Average occupancy

| | |
|---|---|
| key / kind | `occupancy.mean` · `mean` |
| eligibility | `isKnown(r.occupancyPct)` |
| formula | `value = Σ k('occupancyPct') / n` |
| unit / rounding | `%` · display 1 dp for the aggregate (`fmt.pct(v, 1)`), 0 dp for a record's own value |
| min n | 3 |
| label | **`Average occupancy (per property, unweighted)`** |
| coverage line | `Based on {n} of {N} properties with verified occupancy.` |

**`occupancyPct` is never derived from `vacancyPct`, and vacancy is never derived from occupancy** —
the two are separately recorded fields with different definitions in practice (physically occupied vs marketed
vacant). Average vacancy is computed independently, with its own `n`, and appears in the same card's popover.
When both are recorded on one record and `|occupancy + vacancy − 100| > 1`, raise a data-quality consistency
flag (§11.6); **do not reconcile them.** `occupancyPct === 0` is a measured zero (`DEMO — Theta Offices`) and
must survive every filter and reducer.

### 5.7 M7 · Properties by class

| | |
|---|---|
| key / kind | `class.groupCount` · `groupCount` over `officeClass` |
| buckets | fixed ordinal `A+, A, B+, B, C` then `Unknown` — never sorted by count |
| formula | `bucket[c] = rows.filter(r => r.officeClass === c).length`; `Unknown = N − n` |
| shares | `share[c] = bucket[c] / N` (share **of the selection**, 1 dp). The popover additionally shows share of the classified subset, explicitly labelled `of the {n} classified` |
| min n | 1 (nullable dimension → `n === 0` ⇒ insufficient) |
| coverage line | `Based on {n} of {N} properties with verified office class.` |

`C = 0` while `n = 16` is a **fact about the 16 classified records** and is displayed as `0`. It is not the same
statement as `Unknown = 132`, and the chart must make that visually obvious (hatched Unknown, §7).

### 5.8 M8 · Properties by district

| | |
|---|---|
| key / kind | `district.groupCount` · `groupCount` over `districtKey` |
| buckets | all **12** districts from the seed envelope, always, including those with 0 records; `Unknown` bucket only if a record has a null `districtKey` (schema-required, so never at seed) |
| formula | `bucket[d] = rows.filter(r => r.districtKey === d).length` |
| sort | descending by count, ties alphabetical by display name |
| min n | — (required field: zeros are facts) |
| coverage line | `District is recorded for all {N} properties.` (`metric.coverage.complete`, used when `n === N`) |
| notes | `{z} of 12 districts contain no recorded business centres ({names}).` |

District comes from **point-in-polygon, not from the source label** (D1). The 10 records whose source label
disagrees are counted under the geometry result and listed in the Data Quality queue.

### 5.9 M9 · Operating vs pipeline

| status value | bucket |
|---|---|
| `Operating` | **Operating** |
| `Under construction`, `Planned` | **Pipeline** |
| `Renovation` | **Renovation** — shown as its own segment, never folded into either (a building under refurbishment is neither leasable stock now nor certain future supply) |
| `null` | **Not recorded** |

`kind = groupCount` over `status`, nullable ⇒ `n === 0` renders the insufficient state.
Coverage line `Based on {n} of {N} properties with verified status.` Display when sufficient:
`Operating {a} · Pipeline {b} · Renovation {c} · Not recorded {d}` plus a stacked bar in which the
`Not recorded` segment is hatched and present.

### 5.10 Group metrics used by the AI and by district drill-down

`GEO.analytics.groupMetric(rows, 'districtKey', 'askingRent', 'mean')` returns one `Metric` **per group**,
each with its own `n`, `N` (= group size) and coverage line. Rules:

- `MIN_N.groupMean = 3` is applied **per group**; a group below it renders
  `Insufficient verified data · n = 2` **in the table row** — it is never dropped from the table, because its
  absence would read as "no properties there";
- groups with `N > 0` but `n === 0` render `No priced records` and stay in the table;
- ranking ("which district has the most Class A supply?") is by count, ties reported **as ties** and broken
  alphabetically for display order only.

---

## 6. Never-treat-missing-as-zero: the code-level guards (§36)

### 6.1 The structural rule

> **G1.** `GEO.analytics.known()` / `knownRows()` are the **only** permitted readers of a data field inside any
> aggregation. A metric, chart, AI tool or export that reads `rows[i].field` directly inside a reducer,
> `map`, `sort` accumulator or comparison is a defect — not a style issue.

Everything below is a consequence of G1, listed because implementers reintroduce them one at a time.

### 6.2 Forbidden patterns

| # | forbidden | why it breaks | required |
|---|---|---|---|
| G2 | `rows.reduce((a, r) => a + r.gla, 0)` | `null` coerces to 0; the sum is wrong and the count is silently `N` | `sum(known(rows,'gla'))` |
| G3 | `r.gla \|\| 0`, `+r.gla`, `Number(r.gla)`, `parseFloat(r.gla)` | all map `null`/`''` to `0` or `NaN` | test `isKnown` first, then use the value as-is |
| G4 | `rows.filter(r => r.vacancyPct)` | drops the **measured zero** — a fully-let building disappears | `rows.filter(r => isKnown(r.vacancyPct))` |
| G5 | `if (r.occupancyPct) { … }` | 0 % occupancy is falsy; a fully-vacant building is treated as unknown | `if (isKnown(r.occupancyPct))` |
| G6 | `Math.max(...rows.map(r => r.askingRent))` | `null` → `NaN` poisons the max; empty → `−Infinity` | `Math.max.apply(null, known(rows,'askingRent'))` guarded by `n ≥ 1` |
| G7 | `total / rows.length` | divides a partial sum by the full denominator — the §36 headline error | `sum / n`, with `n > 0` asserted |
| G8 | `sum(values) \|\| 0` at display | turns `null` (no data) into `0` (measured zero) at the last moment | `sufficient === false` ⇒ render `Insufficient verified data` |
| G9 | `r.tenants.length === 0 ⇒ "empty building"` | "not collected" and "confirmed empty" become the same statement | read `r.tenantsStatus` (§6.4) |
| G10 | `occupancy = 100 − vacancy` (or the reverse) | fabricates a value the platform never recorded (§2.2) | leave the other field unknown |
| G11 | `sortBy(rows, r => r.gla)` with unknowns first/last unspecified | unknowns rank as 0 and appear as "smallest" | `GEO.util.sortBy` — unknowns sort **last in both directions** (already shipped) |
| G12 | metric object without `n`/`N` | the denominator cannot be published | `GEO.analytics.metric()` is the only constructor |

### 6.3 The five §36 traps, named

| trap | unknown | zero / recorded | enforcement |
|---|---|---|---|
| **vacancy** | `vacancyPct: null` | `vacancyPct: 0` = measured full occupancy | G4, G5; fixture `DEMO — Eta House` (`vacancyPct: 0`, `availableArea: 0`) |
| **GLA** | `gla: null` | `gla: 0` is invalid (schema `sanity.gla.min = 50`) and warns on save | G2, G8; `sum([]) === null` |
| **tenants** | `tenantsStatus: 'not_collected'` with `tenants: []` | `tenantsStatus: 'confirmed_empty'` with `tenants: []` | G9; fixtures `DEMO — Gamma` (not collected) vs `DEMO — Theta Offices` (confirmed empty) |
| **occupancy** | `occupancyPct: null` | `occupancyPct: 0` = measured 0 % | G5, G10; fixture `DEMO — Theta Offices` |
| **rent** | `askingRent: null` (incl. "rent on request") | `askingRent: 0` = rent-free / turnover-only, valid, warns on save | G3, G4 |

**Amenity and tenant logic (the asymmetry that must be coded).** A positive assertion is valid at any
collection status: `amenities` contains `gym` ⇒ the building has a gym. A **negative** assertion is only valid
at `amenitiesStatus === 'complete'`. Therefore the filter `Has gym` matches any record listing it, while
`Does not have gym` matches **only** records with `amenitiesStatus === 'complete'`, and the filter panel states
`{n} records excluded — amenities not fully collected.` Same rule for tenants.

### 6.4 Boundary normalisation (`src/js/03-data.js`, not analytics)

Analytics must never see a dirty value, so the repository normalises on load, import and editor save:
`''`, `'   '`, `'-'`, `'—'`, `'n/a'`, `'N/A'`, `'unknown'`, `'нет данных'` → `null`; numeric strings
(`"24.8"`) → `Number`, and a value that fails to parse → `null` **plus a rejection entry**, never `0`.
Clearing a field in the editor writes `null`, never `''`. Every record carries the full key set (D2), so a
metric can never be fooled by a missing key.

### 6.5 The selftest probes (`?selftest=1`) — the real enforcement

| id | probe | assertion |
|---|---|---|
| **P1 · null-injection** | append `K = 20` synthetic records with every data field `null` (valid coords, valid name) to the scope | every `mean`, `median`, `sum`, `min`, `max` is **unchanged**; every `n` is **unchanged**; every `N` grows by exactly 20; every share shrinks accordingly |
| **P2 · zero-vs-null** | take one record, set `askingRent: 0` (was `null`) | `n` increases by 1 **and** the mean changes — proving 0 is a value, not an absence |
| **P3 · falsy survival** | set one record `vacancyPct: 0`, `occupancyPct: 0`, `availableArea: 0`, `parkingSpaces: 0` | each field's `n` increases by 1; none of the four is filtered out of any list, chart bucket or export |
| **P4 · empty-sum** | scope with `n = 0` for `gla` | `metric.value === null`, `sufficient === false`, rendered text contains `Insufficient verified data` and **never** the substring `0 m²` |
| **P5 · denominator** | every metric produced anywhere in the app | `typeof n === 'number' && typeof N === 'number' && coverageText.length > 0` |
| **P6 · oracle** | all values in §12 | exact match at `round2` |

---

## 7. Charts (§14) — five charts

All are hand-rolled inline SVG, single series, `--data` fill, with a `Chart / Table` toggle (IA A-04) and a
permanent coverage line. Marks, colours and the hatched Unknown treatment are specified in
`10-visual-system.md` §5 and §7 and are not repeated here.

### 7.0 Rules common to every chart

1. **The Unknown bucket is rendered whenever the plotted field is nullable in the schema** — even at count 0,
   where it renders as a labelled zero-height bar `Unknown · 0`. It is *never* dropped, *never* merged into
   another category, and *never* included in an average. Required fields (`districtKey`) have no Unknown bucket;
   their coverage line says `District is recorded for all 148 properties.` instead.
2. **Shares are rounded independently to 1 dp and are not forced to sum to 100.** No chart displays a total of
   its percentages (the district shares at seed sum to 100.1 %).
3. **Clicking a bar applies the corresponding filter** (IA A-03). Clicking the **Unknown** bar applies that
   field's `Only unrecorded` tri-state — it must not clear the filter or select everything.
4. **Insufficient state**: the plot area is replaced by `Insufficient verified data` + the coverage line + the
   §4.3 reason sentence. The axis is not drawn; an empty axis implies a measured zero everywhere.
5. Every bar's tooltip carries `category · count · share of N · coverage caveat`.

### 7.1 Chart 3 form ladder (D10) — asking rent and GLA

| `n` | form | annotation |
|---|---|---|
| `0` | insufficient state | reason sentence |
| `1–2` | strip plot of the individual values, each directly labelled | `Individual recorded values — too few to show a distribution.` No median, no quartiles |
| `3–7` | strip plot | median tick + label |
| `8–29` | strip plot | median tick + Q1–Q3 band (Tukey hinges) |
| `≥ 30` | **histogram** with the fixed bins of §7.4 | median tick |

Justification (D10): a 7-bin histogram over 16 points is noise that implies a distribution the sample cannot
support; a strip plot shows exactly the 16 facts that exist. The Unknown block (`Unknown · 132`, hatched)
renders beside the plot in **every** form, including the strip plot.

### 7.2 Chart 1 · Business centres by district

| | |
|---|---|
| dimension / measure | `districtKey` (12 fixed categories) / count |
| form | horizontal bars |
| sort | count descending; ties alphabetical by display name; zero-count districts retained at the bottom |
| unknown | no bucket (required field); coverage line states completeness |
| insufficient | only when `N === 0` |
| coverage line | `District is recorded for all {N} properties.` |

### 7.3 Chart 2 · Business centres by class

| | |
|---|---|
| dimension / measure | `officeClass` / count |
| form | horizontal bars, ordinal ramp (`10-visual-system.md` §3) |
| sort | **fixed ordinal** `A+, A, B+, B, C`, then `Unknown` last. Never by count — class is ordinal, and re-ordering would destroy the ramp's meaning |
| unknown | always rendered, hatched `--unknown`, labelled `Unknown · 132` |
| insufficient | `n === 0` |
| coverage line | `Based on {n} of {N} properties with verified office class.` |

### 7.4 Chart 3 · Asking-rent distribution

| | |
|---|---|
| dimension / measure | `askingRent` binned / count of properties |
| form | §7.1 ladder (strip plot at `n = 16`) |
| bins | left-closed, right-open `[lo, hi)`; last bin open-ended |
| bin edges | `<20` · `20–25` · `25–30` · `30–35` · `35–40` · `40–45` · `45+`, then `Unknown` |
| sort | bin order ascending; `Unknown` always last |
| insufficient | `n < 3` per §7.1 |

**Justification against the real data.** The 16 known values span **19.9 – 44.7 USD/m²/month**. $5 bins give
six bins that are all populated (1 / 3 / 4 / 4 / 2 / 2) and read as round commercial numbers; $2.5 bins would
produce a comb of ones and twos, $10 bins would collapse the whole market into three bars. The empty `45+` bin
is **retained** so the axis does not imply that the sample maximum is a market ceiling. `<20` is open-ended
downward for the same reason. A value exactly on an edge falls in the **upper** bin (`45` → `45+`); the tooltip
states the rule as `≥ 40 and < 45`.

### 7.5 Chart 4 · GLA distribution

| | |
|---|---|
| dimension / measure | `gla` binned / count of properties |
| bin edges | `<2,000` · `2,000–5,000` · `5,000–10,000` · `10,000–20,000` · `20,000+` m², then `Unknown` |
| form / sort / unknown | as §7.4 |
| at seed | `n = 0 of 148` ⇒ **insufficient state**, `Unknown · 148` |

Justification: these are conventional office size bands (sub-2,000 m² converted/small; 2–5k small BC; 5–10k
mid-market; 10–20k large; 20k+ landmark), and they span the only values the prototype can produce
(demo range 2,100 – 30,000 m²). **Stated honestly:** with zero observed GLA values these edges cannot be
validated against the Tashkent market and are flagged `assumption — revisit when GLA coverage exists`
in the chart's info popover. The chart ships and renders its insufficient state (D11); it becomes live under
demo mode or after an editor entry — which is the UX-8 demonstration.

### 7.6 Chart 5 · Data coverage by field (D11, §37)

| | |
|---|---|
| dimension / measure | field (fixed list of 11) / `n` recorded, bar scaled to `N` |
| fields | the 8 critical fields + `name`, `address`, `districtKey` |
| sort | `n` descending; ties in field-registry order |
| labels | each bar directly labelled `{n} of {N}` and `{pct}%` |
| unknown | n/a — the chart *is* the unknown chart; the remainder of each bar is the hatched Unknown wash |
| insufficient | only when `N === 0` |

---

## 8. Weighted vs unweighted — stated, not assumed

| metric | MVP | label the user sees | why |
|---|---|---|---|
| **Average asking rent** | **unweighted, per property** | `Average asking rent (per property, unweighted)` | GLA coverage is **0 of 148** — a GLA-weighted mean is undefined for the observed set. Even with partial GLA it would be *worse*: weighting assigns the market's weight to whichever buildings happen to have a recorded GLA, so a weighted mean over 7 of 156 buildings is more misleading than an unweighted one, not less. |
| **Average occupancy** | **unweighted, per property** | `Average occupancy (per property, unweighted)` | identical argument; the area-weighted figure is the true market occupancy and needs GLA on the same records |
| **Known vacant area** | a **sum of areas**, not an average of rates | `Known vacant area (partial)` | it must never be divided by known GLA to produce a "market vacancy rate" unless both are known **on the same records** |

The qualifier is in the **label**, not a footnote, so that enabling weighting later cannot change the number
without changing the words next to it.

**[ARCH] weighted forms** (written, disabled, no UI entry point):

```js
GEO.analytics.meanWeighted = function (rows, valueField, weightField) {
  var pairs = rows.filter(function (r) { return isKnown(r[valueField]) && isKnown(r[weightField]) &&
                                                r[weightField] > 0; });
  if (!pairs.length) return null;
  var num = 0, den = 0;
  pairs.forEach(function (r) { num += r[valueField] * r[weightField]; den += r[weightField]; });
  return { value: num / den, n: pairs.length, weightField: weightField };
};
// Area-weighted occupancy:  Σ(gla × occupancyPct) / Σ(gla)   over records where BOTH are known.
```

Gate for enabling it: `weightCoverage ≥ 0.60` **and** `n_w ≥ 10`. Until then the toggle renders disabled with
the reason `GLA is recorded for 0 of 148 properties — a GLA-weighted average cannot be calculated.`
When enabled, the coverage line becomes
`Based on {n_w} of {N} properties with both verified asking rent and verified GLA.` — a **different and smaller**
denominator that must be published as such.

---

## 9. Location analysis (§16)

### 9.1 Distance

```js
GEO.geo.R_EARTH_M = 6371008.8;          // IUGG mean earth radius — stated in the panel footer

GEO.geo.distanceM = function (aLat, aLng, bLat, bLng) {
  var toRad = Math.PI / 180;
  var p1 = aLat * toRad, p2 = bLat * toRad;
  var dp = (bLat - aLat) * toRad, dl = (bLng - aLng) * toRad;
  var h = Math.sin(dp / 2) * Math.sin(dp / 2) +
          Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * GEO.geo.R_EARTH_M * Math.asin(Math.sqrt(h));   // metres
};
```

- **Never use `L.latLng().distanceTo()`** for analytics: Leaflet uses `R = 6371000 m`, a 0.0014 % difference
  (≈ 4 mm at 3 km). The panel count is authoritative; the drawn `L.circle` is illustrative. Both are fine here
  but only one may be counted, or the oracle and the app will disagree at the band edge.
- Band membership uses the **raw metres**, never the rounded display value.
- Display: `< 1000 m` → nearest 10 m (`540 m`) — single-point coordinate accuracy (`coordinate_accuracy:
  "single"`) does not justify metre precision; `≥ 1000 m` → km at 2 dp (`1.75 km`).
- A record without valid coordinates is excluded from **all** distance metrics and counted separately as
  `{x} properties could not be located and are excluded from these counts.` (Impossible at seed: `lat`/`lng`
  are schema-required.)

### 9.2 Rings — cumulative, subject excluded

| decision | rule | why |
|---|---|---|
| **bands** | **CUMULATIVE** — the 3 km count includes everything inside 1 km | the user's question is "how many competitors are within 3 km", not "how many sit in an annulus" |
| **membership** | `d <= km * 1000` — inclusive of the boundary | one rule, stated in the panel |
| **subject** | **EXCLUDED from its own counts, sums, means and class mix** | a property is not its own competitor; including it would inflate every band and drag the mean toward its own rent |
| exclusive counts | shown in the table as a derived column `in this band only` = `count(k) − count(k−1)` | free to compute, and it stops the cumulative figures being misread |
| subject's own values | displayed **beside** the band figures for comparison, never inside them, with the line `The subject property is not included in these figures.` (`location.subjectExcluded`) | §16 "clearly state when calculations are based on incomplete data" |

### 9.3 Per-band metrics

| metric | formula | min n | coverage line |
|---|---|---|---|
| Competing business centres | `band.length` | — | `{n} of {NAll} properties in the dataset are within {km} km.` |
| Average known rent | `mean(known(band,'askingRent'))` | 3 | `Based on {n} of {N} properties within {km} km with verified asking rent.` |
| Median known rent | `median(...)` | 3 | as above |
| Total known nearby GLA | `sum(known(band,'gla'))` | 1 | `Based on {n} of {N} properties within {km} km with verified GLA.` |
| Class distribution nearby | group count over `officeClass`, Unknown bucket always shown | 1 | `Based on {n} of {N} properties within {km} km with verified office class.` |

Panel-level caveat, always rendered (§16):
`Calculated from recorded values only. Straight-line distance, not travel time.`
plus, when a band metric is insufficient, the §4.3 reason sentence for that band.

`[ARCH]` drive-time isochrones, walking catchments, population within ring — §31 Phase 5. Not implied anywhere
in the MVP UI.

---

## 10. Competitive set (§17)

### 10.1 Selection

Inputs: subject record `S`, radius `R` (default **3,000 m**), scope rows.

```
candidates = rows where id ≠ S.id and distanceM(S, r) ≤ R
```

Default radius justification, from this dataset: at 1 km the subject `Trilliant` has 7 neighbours of which
only 3 are priced — too thin to review; at 5 km the set is 114 records, which is most of the central city and
stops being a competitive set; 3 km yields 74 nearby of which 9 qualify on class — a set a consultant can
actually read. The radius selector (1 / 3 / 5 km, IA P-10) re-runs everything.

**Status is not a filter by default.** Pipeline competitors are explicitly wanted (§64), and `status` coverage
is 0 of 148, so a status filter would drop the entire dataset. The set's status mix is *displayed* instead.

### 10.2 Bucketing — unknowns are neither silently included nor silently excluded

| bucket | condition | label |
|---|---|---|
| **Qualified** | class known **and** `abs(classIdx(r) − classIdx(S)) ≤ 1` **and** size not disqualifying (§10.3) | `Qualified` |
| **Proximity only** | `officeClass === null` | `Proximity only — class not recorded` |
| **Excluded by class** | class known and band distance `> 1` | counted and named in the footer, collapsed by default |
| **Excluded by size** | both GLA known and size-band distance `> 1` | as above |

`classIdx` indexes `['A+','A','B+','B','C']` (`S.enums.officeClass`). All three bucket **counts** are always
printed: `9 qualified · 63 proximity only · 2 excluded by class`. The user can add any record from any bucket
by hand (IA P-11), and every dependent figure recomputes.

### 10.3 Size handling

`sizeBand(gla)` uses the GLA bins of §7.5. Size is **assessed only when both** `S.gla` and `r.gla` are known:

| case | effect |
|---|---|
| both known, `abs(Δband) ≤ 1` | qualifies; `sizeScore = 1 − abs(Δband)/2` |
| both known, `abs(Δband) > 1` | excluded by size, and said so |
| either unknown | **neither qualifies nor disqualifies**: `sizeScore = 0.5` (neutral) and the row is tagged `size not assessed` |

At seed, GLA coverage is 0, so **every** row is `size not assessed` and the panel states
`Size could not be assessed: GLA is not recorded for any property in this selection.`

### 10.4 Score (transparent, not a black box)

```js
GEO.geo.COMPSET_WEIGHTS = { proximity: 0.60, cls: 0.25, size: 0.15 };  // one place, tunable, documented

proximityScore = 1 - d / R                       // 1 at the subject, 0 at the ring
classScore     = 1 - abs(Δband) / 2              // 1.0 same class, 0.5 one band away
sizeScore      = assessed ? 1 - abs(Δband) / 2 : 0.5
score          = 0.60*proximityScore + 0.25*classScore + 0.15*sizeScore   // 0..1
matchScore     = round(score * 100)              // 0..100, displayed as an integer
```

Ranking is by `score` descending, ties broken by distance ascending then name. The row shows the three
components, so a user can see *why* a building is in the set (§44: "the AI should explain why each property
was included"). **The weights are an assumption, not a market finding**, and the panel says so.

### 10.5 Display rules (mandatory)

- heading is exactly **`Suggested competitive set`** (§17);
- subtitle, non-dismissible: `Automatically suggested from proximity, office class and approximate size. Not a verified competitive set — review, add and remove before using it.` (`compset.disclaimer`);
- default shown: up to **12** qualified rows (all 9 fit at seed) plus the first 10 proximity-only rows with
  `Show all 63`. The **counts are always complete** even when the list is truncated — truncation may never
  change a number;
- every aggregate over the set (average rent, count, class mix) carries its own §3.1 coverage line computed
  over the **current, user-edited** set;
- `Save as layer` (IA P-12) stores the resulting record id list as an AI/analysis layer with
  `criteriaHuman` = the sentence above plus the radius and subject name.

---

## 11. Data-quality metrics (§19, §23)

The two axes are independent and must never be merged into one "quality score":
**completeness = how much is recorded** · **confidence = how well-evidenced what *is* recorded is.**

### 11.1 Staleness

```js
freshness(lastVerifiedAt, field, today) ->
  age  = daysBetween(lastVerifiedAt, today)
  span = refreshDays[fieldRefreshClass[field]]        // fast 60 · slow 365 · stable 1095
  age >  span            -> 'stale'
  age >= span * 0.7      -> 'ageing'
  else                   -> 'fresh'
  lastVerifiedAt unknown -> 'unknown'
```

- **Only known values can be stale.** A `null` field has nothing to re-verify; it is *missing*, which is the
  separate indicator in §11.3. `tenants: []` is not a value (`isKnown([]) === false`) and therefore never ages.
- **Record-level freshness = the worst state across the record's known fields.** Taking the best would let one
  stable coordinate launder a two-year-old rent.
- `nextRefreshAt` is always **computed** from `lastVerifiedAt`, never stored (D8), so it cannot drift.
- Display: `Last verified: 19 Jul 2026` on every property (§19) and, when not fresh,
  `Ageing — asking rent is due for re-verification in 1 day` / `Stale — asking rent was due 12 days ago`.

**Why 60 days for fast fields.** (1) Asking rents, availability and occupancy are re-quoted on a monthly-to-
quarterly cycle, so a 60-day ceiling keeps a published rent inside the quarter it was collected in.
(2) A field network can physically re-walk 148 records inside 60 days at ~3 verifications per working day, so
the threshold is operationally achievable rather than aspirational. (3) It puts the shipped dataset
(collected **2026-07-19**, 59 days old on 2026-09-16) exactly **one day** from due — so the indicator is
demonstrably alive during user testing instead of theoretical. The thresholds are exposed in Settings because
they are a product assumption, not a fact.

**Mandatory disclosure (D8).** All 148 observed records share one collection date, so staleness cannot rank
them today. The Data Quality panel prints:
`All 148 observed records were collected on 19 Jul 2026. Staleness cannot differentiate them until a second verification date exists — edit a record to see the indicator change.`

**QA hook:** `index.html?today=YYYY-MM-DD` overrides `GEO.date.today()` for the whole app, so the stale path is
testable without waiting. The oracle's `today` is `2026-09-16`.

### 11.2 Confidence (D3 — already implemented, referenced here)

`GEO.data.confidenceOf(rec, field)` resolves the field's evidence profile
(`2GIS-BASE` → Medium, `2GIS-CLASS` → Low, `2GIS-RENT` → Low, `GEOMETRY` → High);
`GEO.data.recordConfidence(rec)` = the **weakest** confidence among known critical fields plus
`name`/`lat`/`districtKey`. A field whose value is unknown contributes nothing (it returns `Unknown` and is
skipped, not counted as a low score).

Consequence that must be stated in the UI, because it looks like a bug and is not: a record carrying an
unverified class and rent claim reports **Low**, while a record carrying only name/address/coordinates reports
**Medium**. Confidence describes *the claims present*, not *how much* is present. The panel label is therefore
`Confidence in recorded values`, and completeness is shown next to it as the other axis.

### 11.3 Missing critical data

`criticalFields` (8, from the registry): `officeClass, status, gla, floors, askingRent, vacancyPct,
parkingSpaces, yearOpened`.

```js
criticalKnown(rec) = criticalFields.filter(f => isKnown(rec[f])).length     // 0..8
missingCritical(rec) = criticalKnown(rec) < 8
```

At seed this flags **148 of 148** observed records, so as a *filter* it is useless — the Data Quality queue
must therefore sort by `criticalKnown` ascending and expose the §11.4 bands, and the indicator on the property
card must name the missing fields (`Missing: GLA, floors, vacancy, parking, status, year opened`) rather than
just asserting incompleteness.

### 11.4 Completeness score — unweighted, displayed as count bands (D9)

```js
completeness(rec)   = criticalKnown(rec) / 8                    // 0..1, internal
band(criticalKnown) = 0 ? 'none' : ≤2 ? 'minimal' : ≤5 ? 'partial' : 'good'
coverageIndex(rows) = Σ criticalKnown(r) / (rows.length * 8)    // set-level, 0..1
```

**Unweighted, deliberately.** Weighting (e.g. rent ×3, parking ×0.5) encodes an unvalidated judgement about
which field matters most — and on this dataset it would change nothing, because every observed record holds
either 0 or exactly 2 of the 8 critical fields. An unfalsifiable parameter that cannot change any output is
not a model, it is decoration. If weights are added later they go in **one** place
(`S.completenessWeights`), default all-1, and the panel must state the weighting in words.

**Bands, not percentages** (D9): percentage bands (<40 / 40–79 / ≥80) collapse all 148 records into one bucket;
count bands discriminate 132 / 16 and read commercially — *"no commercial data recorded"* is something a
consultant can act on, *"25 % complete"* is not.

Fields count via `isKnown`, so `tenants: []` and `amenities: []` never count. `tenants`/`amenities` are
deliberately **not** critical fields: their collection state is carried by `tenantsStatus` / `amenitiesStatus`,
which is the correct instrument (§6.3).

### 11.5 Duplicates and supply counts (D6)

Possible duplicates are **never auto-merged**. Their effect on analytics is:

| verdict | effect on `count` and `sum` metrics |
|---|---|
| `undecided` (default, all 6 groups at seed) | **all records counted**, and every count/sum metric in the scope gains the note `Includes {r} records in {g} unresolved possible-duplicate groups — supply figures may double-count.` (`metric.note.duplicates`) |
| `same_building` | the group contributes **one** record: the survivor is the record with the highest `criticalKnown`, ties broken by lowest `id`. The note becomes `{g} duplicate groups collapsed to one record each.` |
| `different_buildings` | all records counted, no note |

Collapsing happens in `GEO.analytics.collapseDuplicates()` inside `scope()` (§1.1), so **every** consumer sees
the same set. At seed nothing collapses — but setting a verdict in the Data workspace visibly changes the
headline count, which is the UX-8 demonstration.

### 11.6 Consistency flags (raised, never auto-corrected)

| flag | condition | surfaced as |
|---|---|---|
| `occupancyVacancyMismatch` | both known and `abs(occ + vac − 100) > 1` | Data Quality queue + property card |
| `areaMismatch` | both known and `gla > gba` | as above |
| `availableExceedsGla` | both known and `availableArea > gla` | as above |
| `districtConflict` | source label ≠ polygon result (10 records at seed) | Data Quality queue (D1) |
| `rentOutOfRange` | outside `sanity.askingRent` 1–500 | warning on save, value still stored (§ schema) |

None of these alters a value. §2.2: the platform's job is to record the market, not to argue with it.

---

## 12. Worked example — the QA oracle at seed state

**Scope:** unfiltered, demo **off**, suspected-non-BC exclusion **off**, all duplicate verdicts `undecided`,
`today = 2026-09-16`. Therefore `NAll = 148`, `N = 148`. Every figure below was computed from
`data/seed.json`; `?selftest=1` must re-derive each one at runtime (never hard-code them).

Panel scope line (IA A-01): `Analytics reflect the current filters — all 148 properties in the dataset. 8 demo records excluded.`

### 12.1 The nine metric cards

| # | card | value shown | coverage line | extra lines |
|---|---|---|---|---|
| M1 | Business centres | **148** | `All 148 properties in the dataset.` | `Includes 12 records in 6 unresolved possible-duplicate groups — supply figures may double-count.` |
| M2 | Total recorded GLA (partial) | **Insufficient verified data** | `No properties in the current selection have verified GLA.` | `GLA is not recorded for any property in this dataset.` |
| M3 | Average asking rent (per property, unweighted) | **$32.2 /m²/month** | `Based on 16 of 148 properties with verified asking rent.` | chip `Low coverage` (10.8 %) · `Unit assumed USD/m²/month; not stated by the source.` |
| M4 | Median asking rent | **$32.3 /m²/month** | `Based on 16 of 148 properties with verified asking rent.` | `Even sample (n = 16): the median is the mean of the two central values ($29.8 and $34.8).` |
| M5 | Known vacant area (partial) | **Insufficient verified data** | `No properties in the current selection have verified available area.` | `Available area and vacancy are not recorded for any property in this dataset.` |
| M6 | Average occupancy (per property, unweighted) | **Insufficient verified data** | `No properties in the current selection have verified occupancy.` | `Occupancy is not recorded for any property in this dataset.` |
| M7 | Properties by class | **A+ 4 · A 8 · B+ 1 · B 3 · C 0 · Unknown 132** | `Based on 16 of 148 properties with verified office class.` | chip `Low coverage` |
| M8 | Properties by district | **12 bars, see 12.3** | `District is recorded for all 148 properties.` | `2 of 12 districts contain no recorded business centres (Bektemir, Yangihayot).` |
| M9 | Operating vs pipeline | **Insufficient verified data** | `No properties in the current selection have verified status.` | `Status is not recorded for any property in this dataset.` |

M3 popover: `n = 16 · N = 148 · min $19.9 · Q1 $27.3 · median $32.3 · Q3 $36.3 · max $44.7 · IQR $9.0`
(quartiles render because `n = 16 ≥ 8`). Exact mean before display rounding: **32.21875** → `round2` **32.22**
→ displayed **$32.2**. The selftest asserts `round2(value) === 32.22`.

The 16 known rents (the whole population of priced records):
`19.9, 24.8, 24.8, 24.8, 29.8, 29.8, 29.8, 29.8, 34.8, 34.8, 34.8, 34.8, 37.8, 39.7, 40.6, 44.7` — sum 515.5.

### 12.2 Chart 2 · by class

| bucket | count | share of 148 |
|---|---|---|
| A+ | 4 | 2.7 % |
| A | 8 | 5.4 % |
| B+ | 1 | 0.7 % |
| B | 3 | 2.0 % |
| C | **0** | 0.0 % |
| **Unknown** (hatched) | **132** | 89.2 % |

`C = 0` is a fact about the 16 classified records; `Unknown = 132` is an absence. Both render.
**The same 16 records carry both the class claim and the rent claim** (12 A/A+ priced, 4 B/B+ priced), which is
why `officeClass` and `askingRent` share an `n` of 16. They are still two independent coverage counts and must
never be computed from one another.
UX-1 (`class = A or A+`) selects **12** properties and the filter panel prints
`136 properties excluded — office class not recorded.`

### 12.3 Chart 1 · by district (sorted, geometry-authoritative)

| district | count | share of 148 |
|---|---|---|
| Mirobod | 28 | 18.9 % |
| Mirzo Ulugbek | 26 | 17.6 % |
| Yakkasaroy | 24 | 16.2 % |
| Yunusobod | 22 | 14.9 % |
| Yashnobod | 17 | 11.5 % |
| Chilonzor | 13 | 8.8 % |
| Shayxontohur | 10 | 6.8 % |
| Olmazor | 4 | 2.7 % |
| Sergeli | 3 | 2.0 % |
| Uchtepa | 1 | 0.7 % |
| Bektemir | 0 | 0.0 % |
| Yangihayot | 0 | 0.0 % |

Sum = 148. Shares sum to 100.1 % — correct behaviour, and no total is displayed (§7.0 rule 2).

### 12.4 Chart 3 · asking-rent distribution

`n = 16` ⇒ **strip plot** (D10), median tick at 32.3, Q1–Q3 band 27.3 – 36.3, and the hatched block
`Unknown · 132` beside it. Coverage line `Based on 16 of 148 properties with verified asking rent.`

Bin counts (table view, and the histogram form once `n ≥ 30`):

| bin | count |
|---|---|
| `<20` | 1 |
| `20–25` | 3 |
| `25–30` | 4 |
| `30–35` | 4 |
| `35–40` | 2 |
| `40–45` | 2 |
| `45+` | 0 |
| **Unknown** | **132** |

### 12.5 Chart 4 · GLA distribution

Insufficient state. Plot area replaced by:
`Insufficient verified data` / `No properties in the current selection have verified GLA.` /
`GLA is not recorded for any of the 148 properties in this dataset. This chart populates when GLA values are added in the Data workspace, or when demo records are enabled.`
`Unknown · 148` is still drawn.

### 12.6 Chart 5 · data coverage by field

| field | n of 148 | % |
|---|---|---|
| Property name | 148 | 100.0 |
| District | 148 | 100.0 |
| Address | 109 | 73.6 |
| Office class | 16 | 10.8 |
| Asking rent | 16 | 10.8 |
| Status | 0 | 0.0 |
| Year opened | 0 | 0.0 |
| Floors | 0 | 0.0 |
| GLA | 0 | 0.0 |
| Parking spaces | 0 | 0.0 |
| Vacancy | 0 | 0.0 |

### 12.7 Data-quality panel

| indicator | value at seed |
|---|---|
| Confidence in recorded values | **Medium 132 · Low 16 · High 0 · Unknown 0** |
| Record freshness (`today = 2026-09-16`) | **Fresh 132 · Ageing 16 · Stale 0** — the 16 are ageing because `askingRent` is a fast field at 59 of 60 days; on 2026-09-18 they become stale |
| Completeness bands (8 critical fields) | **none 132 · minimal 16 · partial 0 · good 0** |
| Set coverage index | `32 / 1184` = **2.7 %** of critical fields recorded |
| Missing critical data | **148 of 148** records miss at least one critical field |
| Possible duplicates | 12 records in 6 source-flagged groups, all `undecided`; 9 pairs under 30 m of which **3 are unflagged**; 1 duplicate name |
| District label conflicts | **10** |
| Dataset age | collected 19 Jul 2026 — **59 days**; fast-field interval 60 days → due in 1 day |

### 12.8 Location analysis — subject `Trilliant` (`BC-82f0eb0b80b7`, A+, $44.7, Yunusobod)

Source label said Mirzo-Ulugbek; geometry says Yunusobod (D1). Subject excluded from every figure below.

| band (cumulative) | properties | in this band only | avg known rent | median | rent coverage | total known GLA | class mix |
|---|---|---|---|---|---|---|---|
| **1 km** | **7** | 7 | **$33.1** | $29.8 | 3 of 7 | Insufficient (0 of 7) | A+ 1 · A 2 · Unknown 4 |
| **3 km** | **74** | 67 | **$31.2** | $29.8 | 11 of 74 | Insufficient (0 of 74) | A+ 2 · A 7 · B 2 · Unknown 63 |
| **5 km** | **114** | 40 | **$31.4** | $29.8 | 15 of 114 | Insufficient (0 of 114) | A+ 3 · A 8 · B+ 1 · B 3 · Unknown 99 |

Exact means before display rounding: 1 km **33.10**, 3 km **31.24**, 5 km **31.39** (selftest asserts these at
`round2`). 1 km renders because `n = 3 = MIN_N.mean`; had it been 2 the card would read *Insufficient verified
data · A mean needs at least 3 verified values; this selection has 2.*

Comparison line: `Subject asking rent $44.7 — above the 3 km average of $31.2 (based on 11 of 74 nearby properties). The subject property is not included in these figures.`

Boundary note for QA: the nearest records **outside** the 3 km ring are `Atlas` at **3,001.6 m** and
`Modera Towers` at **3,010.8 m**. The 3 km count of 74 is therefore sensitive to the earth-radius constant and
to `<=` vs `<`; both are fixed in §9.1 and must not be changed casually.

### 12.9 Suggested competitive set — `Trilliant`, 3 km

`9 qualified · 63 proximity only · 2 excluded by class (Panoramic B, Nova Minor B)` — 9 + 63 + 2 = 74. ✔

| rank | property | distance | class | rent | score | match |
|---|---|---|---|---|---|---|
| 1 | Forum Business Center | 875 m | A+ | $39.7 | 0.7501 | 75 |
| 2 | Orient | 535 m | A | $29.8 | 0.6931 | 69 |
| 3 | Nova Plaza | 695 m | A | $29.8 | 0.6610 | 66 |
| 4 | Infinity Business Сenter | 1.75 km | A | $34.8 | 0.4510 | 45 |
| 5 | Nest one | 2.62 km | A+ | $40.6 | 0.4003 | 40 |
| 6 | Gross Plaza | 2.08 km | A | $34.8 | 0.3850 | 39 |
| 7 | Kayan | 2.41 km | A | $29.8 | 0.3188 | 32 |
| 8 | Platform | 2.68 km | A | $24.8 | 0.2635 | 26 |
| 9 | Sapphire Business Center | 2.97 km | A | $34.8 | 0.2062 | 21 |

Distances are the exact great-circle metres the oracle asserts; the UI displays sub-kilometre distances
rounded to 10 m (`880 m`, `540 m`, `700 m` for rows 1–3) per §9.1. Every row is tagged `size not assessed`
(GLA coverage is 0). Set aggregates:
`Average asking rent across the suggested set: $33.2` · `Based on 9 of 9 properties with verified asking rent.`
(median $34.8). Note that the 3 km band's 11 priced records drop to 9 here — the two B-class priced records are
outside the ±1 class band and are named in the excluded footer, not silently dropped.

`Infinity Business Сenter` contains a Cyrillic `С`; it is reproduced exactly (never transliterated, T9).

### 12.10 Demo mode ON (`NAll = N = 156`) — the second oracle

Enabling demo records must change these and only these:

| metric | demo off | demo on |
|---|---|---|
| Business centres | 148 | **156** |
| Total recorded GLA | insufficient | **89,000 m²**, `Based on 7 of 156 properties with verified GLA.` |
| Average asking rent | $32.2 (n 16) | **$31.4** (`round2` 31.38), `Based on 21 of 156 properties with verified asking rent.` |
| Median asking rent | $32.3 | **$29.8** (n = 21, odd → the 11th value) |
| Known vacant area | insufficient | **13,830 m²**, `Based on 5 of 156 properties with verified available area.` · `5 measured from recorded available area, 0 derived from GLA × vacancy.` |
| Average occupancy | insufficient | **65.0 %**, `Based on 5 of 156 properties with verified occupancy.` (values 0, 55, 78, 92, 100 — the **0 must be included**, P3) |
| Operating vs pipeline | insufficient | **Operating 5 · Pipeline 2 · Renovation 1 · Not recorded 148** |
| GLA distribution | insufficient | `<2,000` 0 · `2,000–5,000` 1 · `5,000–10,000` 3 · `10,000–20,000` 1 · `20,000+` 2 · Unknown 149 |
| Rent bins | 1/3/4/4/2/2/0, Unknown 132 | 2/4/5/5/2/2/**1**, Unknown 135 (the `45+` bin is the $45.0 demo record — the on-edge case of §7.4) |
| Freshness | 132 fresh · 16 ageing · 0 stale | **136 fresh · 17 ageing · 3 stale** (demo records carry spread verification dates) |
| Completeness bands | none 132 · minimal 16 | none 132 · minimal **17** · partial 0 · good **7** |

A non-dismissible banner is shown, every affected metric sets `containsDemo = true`, and the demo chip appears
on each card (D4).

### 12.11 Filtered-scope spot checks

| scenario | expected |
|---|---|
| UX-1 `class ∈ {A, A+}` | `N = 12`; avg rent **$34.3** (`round2` 34.27) from `n = 12 of 12` — every classified record is also priced — with the note `This selection was filtered on office class.` Median $34.8 |
| UX-3 `rent < 30` | `N = 8`; the coverage line reads `Based on 8 of 8 properties with verified asking rent.` **and must** carry `This selection was filtered on asking rent, so every property in it has a recorded value.` plus `Current filters cover 8 of 148 properties in the dataset.` |
| `district = Yashnobod` | `N = 17`; avg rent **insufficient** (`n = 2 < 3`) with `A mean needs at least 3 verified values; this selection has 2.` |
| `district = Mirzo Ulugbek` | `N = 26`; avg rent insufficient, reason `zero_coverage`: `Asking rent is recorded for 16 properties in the dataset, none of them in this selection.` |
| `district = Bektemir` | `N = 0`; every card reads `No properties in the current selection.`; the results list shows E-03 (`recorded zero, not missing data`) |
| rent by district (AI-3) | Yunusobod n 5 mean **$33.8** · Mirobod n 4 **$28.6** · Yakkasaroy n 4 **$31.8** · Yashnobod n 2 **suppressed** · Shayxontohur n 1 **suppressed** · the other 7 districts `No priced records` — all 12 rows present |

(UX-1 check: the 12 A/A+ rents are 24.8, 29.8, 29.8, 29.8, 29.8, 34.8, 34.8, 34.8, 37.8, 39.7, 40.6, 44.7 →
sum 411.2, mean **34.27**, median **34.8**. The remaining 4 priced records are the B/B+ ones: Panoramic 19.9,
Ventum plaza 24.8, Nova Minor 24.8, Solid Premium 34.8.)

---

## 13. Open questions and reconciliations

| # | item | resolution taken here |
|---|---|---|
| R1 | `00-core.js` `F.coverage` builds the sentence by concatenation, which IA §9.3 rule 3 forbids | keep the exact output, refactor the body to call `t('metric.coverage.*', {n, m, field})`. The IA i18n entry must gain the **trailing full stop** to match the shipped string |
| R2 | Contract §7 says "`property` singular at n=1" | implemented as singular when **`N === 1`** (§3.1) — "1 of 148 property" is ungrammatical, and the two rules agree on every reachable input |
| R3 | IA A-02 specifies 9 metric cards; the rent min/max/quartiles and the mirror vacancy mean have no card | they live in the M3/M6 popovers, not as new cards |
| R4 | Header string `{verified} field-verified` (IA §9.1) is undefined | bind it to `coverageIndex` (§11.4) and reword to `2.7% of critical fields recorded`; confirm with the IA author |
| R5 | GLA bin edges cannot be validated (0 observed values) | shipped as a documented assumption, flagged in the chart popover, revisit at first real GLA coverage |
| R6 | Competitive-set weights `0.60 / 0.25 / 0.15` | an assumption, exposed in one constant and disclosed in the panel; not a market finding |
| R7 | Should `Renovation` count as operating stock? | **no** — shown as its own segment (§5.9). Flag for the CRE reviewer; it is a one-line change in the bucket map |
| R8 | Metro/transport proximity in the location analysis (§13 "nearby metro") | **not computed** — no verifiable dataset exists and Overpass is blocked (D5). The block states `No transport dataset is loaded.` rather than showing a blank field |
