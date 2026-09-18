# 14. Final check-up report – the §73 task, with evidence per item

The second master prompt ends with a 25-point check-up that must run before the prototype is
marked complete. This is that run, with the check that proves each item named beside it. Where the
evidence is a test, it is one that has been observed to fail when the fault is present.

Run on the built file `index.html` (1,684,553 bytes, sha `903e49fdd79f`), from `file://`, offline,
in headless Chromium: **155/155 checks**. `bash tools/verify.sh --quick`: everything passed.
In-app self-test against the Python oracle: 138/138.

## 14.1 The 25 items

| # | Required check | Evidence | Result |
|---|---|---|---|
| 1 | No JavaScript console errors | `qa` boot group: "no console errors"; the only excluded requests are tile hosts parsed from the basemap registry and the optional Inter webfont | ✓ |
| 2 | Map loads and centres on Tashkent | `qa` boot: map container present, centre `41.3111, 69.2797`, zoom 12 | ✓ |
| 3 | All markers appear and selection works | `qa` §35 UX-4/5; 148 observed markers, click selects, selected marker raised | ✓ |
| 4 | Search works for name, district, tenant | `test-search.cjs` 17/17 – script folding (Cyrillic/Latin), district aliases via the one shared table, tenant field indexed; tenant coverage is 0/148 so tenant hits are structurally supported and currently empty, and the empty state says so | ✓ (tenant: architecture, no data) |
| 5 | Filters update map and analytics immediately | `test-filters.cjs` 18/18; `qa` UX-1/2/3; analytics count-up on filter change measured frame by frame | ✓ |
| 6 | AI filters and manual filters stay synchronised | Structural: the assistant is one more caller of `GEO.state.set()`; `qa` AI-1 asserts the filter panel reflects an AI-applied class filter | ✓ |
| 7 | Property drawer shows correct data and provenance | `qa` UX-4; every field renders its evidence profile, `Last verified` date, confidence badge with label, district conflict disclosure | ✓ |
| 8 | Analytics show denominators and insufficient-data warnings | Self-test §36 group; every `.stat` carries `.stat__cov`; GLA/occupancy/vacancy tiles render *Insufficient verified data* and stay visible | ✓ |
| 9 | Comparison works for 2–4 properties | `qa` UX-5: 5th refused with a toast, 1 disabled with a reason; no winner cell (C-11) | ✓ |
| 10 | Location analysis draws radius overlays and competitor results | `qa` UX-4: bands 7/74/114, labels above markers in their own pane, competitive set 9 qualified / 63 proximity-only with caveat | ✓ |
| 11 | AI accepts natural-language commands and updates the map | `test-intents.cjs` 38/38; `qa` §63 AI-1…AI-8 in the browser | ✓ |
| 12 | AI layers can be shown, hidden, inspected, removed | `qa` AI-4 creates a layer; Layers tab lists count, criteria, visibility toggle, rename, remove; `map.layer.missing` reports records no longer in the dataset | ✓ |
| 13 | AI session context persists between commands | `qa` AI-2a/2b (refinement narrows the previous result), AI-4 ("its" resolves the selection); `test-assistant.cjs` asserts a *fresh* question does NOT inherit | ✓ |
| 14 | Admin/editor changes persist in localStorage | `qa` UX-8: GLA edit → analytics recompute → survives reload; `freshPage()` proves the isolation the other way | ✓ |
| 15 | Export JSON and import JSON work | `qa` UX-10 round-trip; `validateImport()` is all-or-nothing; export header carries role and local-edit flag | ✓ |
| 16 | Reset demo data works | `#reset` hatch clears storage before init; used by every QA group's `freshPage()` | ✓ |
| 17 | No duplicate or fake controls | `qa` §29: 47 controls, 1 disabled, every disabled one gives an adjacent reason; no anonymous unwired button | ✓ |
| 18 | Responsive layout on desktop, tablet, mobile | `qa` responsive: 6 widths incl. 834 iPad; header one line, no overlapping tracks, search ≥100px; **every tab-bar destination opens** at 375/768/834 (negative control: with the old selector all report CLOSED) | ✓ |
| 19 | Data quality and confidence indicators display correctly | `qa` UX-7; confidence dot never without its label; freshness bands; completeness as count not percentage (D9); result cards read "n of 8 key fields recorded" | ✓ |
| 20 | Missing-data logic never treats unknown as zero | Self-test: a measured 0 contributes to n, an unknown does not, sum over `[0, null]` is 0 not null; `test_merge.py`: a recorded zero is a value | ✓ |
| 21 | Demo data clearly labelled, never mixed with verified | `qa` D4: non-dismissible banner, 8 synthetic records added only with demo mode on, removed with it off; banner prints only when shown | ✓ |
| 22 | All buttons, controls and actions functional | §29 check above plus every §35 and §63 scenario driving real controls | ✓ |
| 23 | App stays within MVP scope – no backend/production features | No server, no fetch of local files, no auth, no DB; the ingestion tools are offline CLIs that write proposals; `docs/11-coverage-vs-brief.md` marks every deferred item | ✓ |
| 24 | Final output is a working prototype, not a mockup | Single `index.html`, opens from `file://`, all of the above runs against it | ✓ |
| 25 | QA report: features, limitations, data, AI, next steps | This document, §14.2–§14.6 | ✓ |

## 14.2 Implemented features

Map with clustering, class-encoded markers, district polygons (geometry-authoritative), radius
bands, six switchable base maps plus a grid; filters generated from measured coverage (seven
disable themselves with a visible reason); search with script folding; results list with
completeness meters; property card with per-field provenance; analytics with denominators and
four charts; comparison (2–4, no winner); location analysis (1/3/5 km cumulative, subject
excluded); suggested competitive set; data-quality workspace (duplicates, entity review,
freshness, coverage); admin editor with localStorage persistence, JSON/CSV export and
all-or-nothing import; assistant with 20 typed tools, deterministic parser, six-block responses
with ORIGIN badges, AI layers, session log; client/internal role switch; three print deliverables;
CASE identity with embedded display face; en-dash house style; motion with reduced-motion
respect; an offline ingestion pipeline with a licence gate; fourteen project skills.

## 14.3 Known limitations

- **Interface is English only.** The RU and UZ tables exist and are empty by design (D14: a
  half-translated interface is worse than an honest English one). The language menu offers only
  what is populated. See §14.7.
- 2GIS / Google / Yandex base maps are present, disabled, and need a licensed endpoint.
- Context layers (metro, roads, landmarks) are declined: no verified source.
- Rent, GLA, occupancy and vacancy analytics correctly report insufficiency at current coverage.
- No history store; the schema is history-ready (`_history`, `nextRefreshAt` computed).

## 14.4 Data limitations

148 observed records, one source (2GIS desk collection, licence review still open), one
collection date (19 Jul 2026), not field-verified. Coverage: class 16/148, rent 16/148 (same
16), everything else 0/148. Ten district labels contradict the boundary (geometry used).
Twelve records in six unresolved possible-duplicate groups; eight suspected non-buildings; six
placeholder names. No external source could be collected from this environment (egress policy);
Google and Yandex could not be *stored* even with a key (`docs/12-data-sources.md`).

## 14.5 AI limitations

Deterministic keyword/slot parser, not a language model – it validates the interaction model,
not language understanding. Eight unsupported concepts refuse by design. Context follows the
filter state; only refinements inherit the last result. No external retrieval. The provider seam
exists (`22-ai-engine.js`) and is unexercised by a real LLM.

## 14.6 Next recommended improvements

1. **Populate RU and UZ** – translation, not engineering (see §14.7 for the scoped path).
2. **Collect through the 2GIS API** – settles the open licence question on the existing 148 and
   is the cheapest enrichment; then OSM for floors / year / operator.
3. A second collection date, so freshness can discriminate.
4. GLA and occupancy for any records at all – four deferred analytics unlock on data alone.
5. Production schema per `.claude/skills/postgis-engineer`; LLM adapter behind the existing seam.

## 14.7 The download-in-three-languages request

Asked mid-run: a button to download the analytical data for a chosen project or location, in
Uzbek, Russian or English according to the chosen language.

**What exists.** One download primitive (`GEO.boot.download`) and exports on every analytical
surface – analytics, comparison, quality coverage and backlog, admin JSON/CSV, the assistant's
result export, and print for the property card, comparison and location analysis. Every label in
every export goes through `t()`, so the mechanism *already* follows the UI language.

**What blocks it.** `I.ru` and `I.uz` contain zero keys. A "Russian download" today is the
English download reached through the fallback chain. This is the same fact flagged in the first
delivery report and in §14.3; it is a translation task, not a build task.

**Recommended shape** (to build next, as its own unit with its own tests):

1. One **Download analysis** action on the property card and the location panel that bundles
   the record, its provenance, the 1/3/5 km bands, the competitive set and every coverage line
   into a single file (CSV + a printable HTML report), reusing the existing export code.
2. A **language choice on the download itself** – *EN / RU / UZ* – rather than tying it to the
   UI language. This keeps D14 intact: the interface stays honestly English while the document
   the client receives is in their language, and the export's key subset (roughly 150–200 keys:
   field labels, units, coverage sentences, section headings, the demo and local-edit notices)
   is a bounded translation that can be reviewed by a native speaker as one piece.
3. The translations are drafted, marked `machineDraft: true` in the table metadata, and the
   export footer says so until a named reviewer signs them off – the same rule as every other
   value in this product.

Required input: confirmation of (2) versus a UI-language-driven export, and a Russian and Uzbek
reviewer for the export subset.
