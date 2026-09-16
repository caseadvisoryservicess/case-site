# 11 — Coverage against the brief, section by section

Brief §65 step 11 asks for the implemented features, the known limitations and the next
improvements. This is that, written as an audit rather than a summary, so a requirement that was
deliberately not built is visible rather than quietly absent.

**Status key**

| | meaning |
|---|---|
| **BUILT** | implemented and verified — by the browser QA run, the self-test, or a named unit suite |
| **ARCH** | the seam, schema or interface exists and is documented; the feature is not enabled, and the UI never implies it is |
| **PARTIAL** | built, but the data cannot exercise it — the code path is correct and reports its own emptiness |
| **DEFERRED** | deliberately not built for this MVP; the reason is given |
| **N/A** | narrative, strategy or roadmap — nothing to implement |

Verification is cited as: `selftest` (123 assertions in-app), `qa` (the browser harness),
`filters` / `search` / `intents` / `assistant` (the Node suites), `oracle` (the independent Python
implementation), or `read` (checked by reading the code).

---

## §1–§4 Vision, principles, geography, asset type

| § | Requirement | Status | Note |
|---|---|---|---|
| §1 | Vision, two workflows (classical and AI-first) | N/A / BUILT | Both workflows exist: filters→map→property→analytics→compare, and ask→interpret→tools→map→explain. |
| §2.1 | Business question first | BUILT | Every field in the registry earns its place; the coverage chart exists because "what do we actually know" is the question this dataset answers best. |
| §2.2 | Never fabricate | BUILT | `selftest`, and D5 — no metro coordinates were invented even though the layer slot exists. |
| §2.3 | Provenance on every important field | BUILT | Per-field evidence with source, URL, method, confidence, collected, verified, computed next-refresh, QC status. `selftest` asserts the confidences are not inflated. |
| §2.4 | History-ready | ARCH | `_history` is reserved on every record and the refresh-class machinery is live; no time series is stored. |
| §2.5 | No 3D | BUILT | None. |
| §2.6 | Keep it simple | BUILT | Every contradiction in the brief was resolved toward fewer surfaces (D12). |
| §2.7 | Never hide uncertainty | BUILT | The headline count carries its own caveats; the staleness indicator states that it cannot discriminate. |
| §2.8 | AI distinguishes fact from inference | BUILT | `assistant` — six origin badges, `UNAVAILABLE` a first-class outcome. |
| §3 | Tashkent only, districts shown | BUILT | 12 real boundaries; other cities listed in the menu and disabled with a reason. |
| §4 | Business centres only | BUILT | Other asset types listed and disabled. 8 records flagged as probably not office buildings (D7). |

## §5 Data model

| § | Requirement | Status | Note |
|---|---|---|---|
| §5.1 | Identification | BUILT | id, name, altNames, status, address, districtKey, lat, lng. |
| §5.2 | Property attributes | BUILT (schema) / PARTIAL (data) | All 12 fields exist; 0 of 148 observed records carry any of them. |
| §5.3 | Commercial | BUILT (schema) / PARTIAL (data) | All 10 fields; only `askingRent` has values (16/148). |
| §5.4 | Tenants | BUILT (schema) / PARTIAL (data) | Typed list plus `tenantsStatus`, which distinguishes *not collected* from *confirmed empty* — a distinction §36 requires and an array alone cannot express. |
| §5.5 | Amenities | BUILT (schema) / PARTIAL (data) | 12-value enum plus `amenitiesStatus`. |
| §5.6 | Evidence / data quality | BUILT | Nine-method enum; provenance stored by reference to source profiles. |
| §5.7 | Future collection metadata | ARCH | collectorId, reviewer, qcStatus, nextRefreshAt present and populated where known; photos and GPS-of-collection are schema slots only. |

## §6–§7 Data and interface

| § | Requirement | Status | Note |
|---|---|---|---|
| §6 | Research real data; mark demo data clearly | BUILT | 148 real records from the existing CASE seed. External research was unavailable (network policy), so §6's demo-record permission was used for 8 clearly-marked records under a containment contract (D4). |
| §7 | Seven interface regions | BUILT | Thirteen regions; compare and the data workspace are modals rather than rail tabs, because tables need width (D12). |

## §8–§13 Header, map, layers, filters, list, detail

| § | Requirement | Status | Note |
|---|---|---|---|
| §8 | Header: name, city, type, search, analytics, AI, quality indicator, language, settings | BUILT | `qa` cross-cutting. The data chip reads `148 records · 2 sources · updated 19 Jul 2026 · 0 field-verified`. |
| §8 | Neutral working name, not ZAKY | BUILT | `GEO.PRODUCT.name` — one constant, a "WORKING TITLE" chip, and `qa` asserts ZAKY appears nowhere visible. |
| §9 | Map: zoom, pan, markers, clustering, hover, click, selection, fit, reset, fullscreen, filters and AI layers reflected, radius, district highlight, layer control | BUILT | `qa` boot. Markers are div-icons carrying the class letter, so identity never depends on colour. |
| §10 | Core layers | BUILT | Business centres + districts. |
| §10 | Context layers (metro, roads, landmarks) | DEFERRED | **No verified source exists and the OSM API is blocked here.** The slot is present, empty, states why, and accepts a GeoJSON import. Inventing coordinates would breach §2.2 (D5). |
| §11 | Filters, instant update, count, reset, collapse, "more filters", AI sync | BUILT | `filters` (18 cases), `qa`. Filters are generated from measured coverage: seven disable themselves with a visible reason. |
| §12 | Map / Map+List, useful card fields, click to select | BUILT | `qa`. |
| §13 | Detail card, all sections, five actions | BUILT | `read` + `qa`. "Open source" is disabled with "No source URL recorded" rather than being a dead link. |
| §13 | Image placeholder | DEFERRED | Zero photos exist and none are collectable here; an empty 16:9 box would push real data below the fold. `photos: []` remains in the schema. |

## §14–§19 Analytics, compare, location, competitors, search, quality

| § | Requirement | Status | Note |
|---|---|---|---|
| §14 | Nine metric cards | BUILT / PARTIAL | Four compute; five report `Insufficient verified data` with their 0-of-148 coverage under a "Not yet collected" heading. `selftest`, `oracle`. |
| §14 | Chart 1 by district | BUILT | Includes the two districts with zero records as visible zeros. |
| §14 | Chart 2 by class | BUILT | The 132-record "Not recorded" bar is drawn and hatched — the largest bar on the chart. |
| §14 | Chart 3 rent distribution | BUILT (adapted) | A strip plot of all 16 values below n=30; a histogram above it. 16 points across 7 bins would imply a distribution the data cannot support (D10). |
| §14 | Chart 4 GLA distribution | PARTIAL | Ships and renders its insufficient state; becomes live under demo mode or after an edit. |
| §14 | (added) Data coverage by field | BUILT | The chart this dataset genuinely supports, and the §37 argument made with evidence. |
| §14/§36 | Every metric states its denominator | BUILT | Structural: metrics come from one function that cannot return a value without `n` and `N`. `selftest`. |
| §15 | Compare 2–4, 13 rows, missing shown neutrally, no winner | BUILT | `qa`. Fields nobody has collected are grouped and collapsed rather than dropped. Differences are marked "Values differ", never better/worse. |
| §16 | Location analysis, 1/3/5 km, radius circles, incomplete-data statement | BUILT | `selftest`, `qa` — 7/74/114 around Trilliant, rent 31.24 over n=11, GLA withheld. |
| §17 | Suggested competitive set, manual add/remove, never definitive | BUILT | 9 qualified, 63 proximity-only — the unqualified are shown, not silently dropped. |
| §18 | Search name, address, district, tenant | BUILT | `search` (17 cases) — Cyrillic↔Latin folding, homoglyph handling, district aliases. Tenant search works; no tenant data exists to find. |
| §19 | Confidence levels, last verified, stale indicator, next verification | BUILT / PARTIAL | The engine is complete; all 148 records share one collection date, so staleness cannot yet separate them, and the UI says so (D8). |

## §20–§23 Data management, editing, collection, refresh

| § | Requirement | Status | Note |
|---|---|---|---|
| §20 | One structured source; swappable for a backend | BUILT | `GEO.data` is the only module that knows where records come from. |
| §21 | Add, edit, delete, coordinates, commercial, source, confidence, verified date | BUILT | Editor generated from the field registry. |
| §21 | localStorage, Export/Import JSON, Reset | BUILT | Diff-based persistence; import validates per row and commits all-or-nothing; two distinct resets plus an `#reset` boot escape hatch (D15). |
| §22 | Field-collection metadata | ARCH | Schema and the verification backlog exist; no collector app. |
| §23 | Per-field refresh cadence | BUILT | fast 60 / slow 365 / stable 1095 days, configurable. `nextRefreshAt` is computed, never stored. |

## §24–§30 Design, animation, responsive, language, no backend, deliverable, architecture

| § | Requirement | Status | Note |
|---|---|---|---|
| §24 | Professional, restrained, no gradient overload or glassmorphism | BUILT | One accent (CASE red) as the only data colour; the two gradient uses are hatch patterns and an offline graticule. |
| §25 | Subtle animations, `prefers-reduced-motion` | BUILT | Nothing over 220ms; `qa` asserts all transitions are removed under reduced motion. |
| §26 | Desktop-first, usable on tablet and mobile, panels become sheets | BUILT | `qa` — 23 checks across five breakpoints: no horizontal scroll, no overflow, no clipped text, no map-chrome overlap. |
| §27 | EN/RU/UZ architecture, English acceptable for MVP | BUILT | 1,069 keys, zero literals outside the table; RU/UZ scaffolded; the selector enables itself once a dictionary is filled. |
| §28 | No backend | BUILT | None. |
| §29 | Working HTML, every control real | BUILT | `qa` asserts no anonymous unwired control and that every disabled control gives a reason. |
| §30 | Seventeen conceptual modules kept separate | BUILT | 26 modules, mapped to the seventeen in the build contract §4. |

## §31–§37 Roadmap, business model, structure, users, scenarios, analytics rules, moat

| § | Requirement | Status | Note |
|---|---|---|---|
| §31 | Phases 2–7 | ARCH / N/A | Asset type and city are parameters, not assumptions; the tool registry is the LLM seam. |
| §32–33 | Business model, structure | N/A | Nothing to implement. Noted: the product name is a placeholder *because* the venture may need to stand alone. |
| §34 | Six user types | BUILT | The internal/external switch is a product-model test, explicitly not security. |
| §35 | Ten UX scenarios | BUILT | `qa` — 23 checks, all pass. |
| §36 | Five distinguish-rules | BUILT | `selftest` asserts all five mechanically, including free-rent-vs-missing-rent on a probe record, because no landlord in this dataset offers free rent. |
| §37 | Data moat visible from the start | BUILT | Provenance on every value, the coverage chart, the verification backlog, six issue queues. |

## §38–§64 The assistant

| § | Requirement | Status | Note |
|---|---|---|---|
| §38 | Integrated Geo AI, a control layer not a chatbot | BUILT | It calls typed tools; it has no path to the UI that the filter panel does not also read. |
| §39 | External and internal user groups | BUILT (model) / ARCH (enforcement) | Tools declare their access; there is no backend to enforce it and the UI says so. |
| §40 | AI workspace: panel, prompts, history, cards, apply to map | BUILT | |
| §41 | AI map control | BUILT | `intents` — every §41 example maps to an implemented intent. |
| §42 | AI analytical layers | BUILT / PARTIAL | Property and quality layers work; derived layers whose field has zero coverage refuse by name rather than rendering empty. |
| §43 | AI analytics builder | BUILT | District and class aggregation with tables, charts and highlighted districts. |
| §44 | Context awareness | BUILT | `assistant` — "its competitors" resolves to the selection, and errors clearly when nothing is selected. |
| §45 | Action-oriented, structured functions | BUILT | 20 tools; no simulated UI interaction anywhere. |
| §46 | Six-block response structure | BUILT | `assistant` asserts all six on every response, including refusals. |
| §47 | Must not hallucinate | BUILT | The coverage gate refuses before acting. This is the single most tested behaviour in the build. |
| §48 | External information distinguished | ARCH | The origin vocabulary includes `EXTERNAL RESEARCH`; no external source is wired. |
| §49 | Internal datasets | ARCH | |
| §50 | Data-collection assistant | BUILT (queue) / ARCH (tasks) | The ranked backlog is produced and exportable; creating tasks refuses, naming the missing backend. |
| §51 | Internal research assistant | PARTIAL | Coverage, quality, verification and cluster questions answer; the open-ended ones do not. |
| §52 | Custom analysis | PARTIAL | Composition is limited to the intent catalogue — the honest state of a deterministic parser. |
| §53 | Task planner with execution status | BUILT (adapted) | Replaced by a "How this was answered" disclosure. Staging fake progress for a 5 ms operation simulates latency that does not exist to imply intelligence that does not exist (D13). |
| §54 | Deterministic local engine, ten named intents | BUILT | `intents` — 38 cases including all ten, in English and Russian. |
| §55 | Provider-swappable architecture | BUILT | `interpret(utterance, context) -> Plan`; the registry is already the model's tool schema. |
| §56 | Tool registry | BUILT | All sixteen named functions plus four more. |
| §57 | AI layers panel | BUILT | Show/hide, rename, remove, inspect criteria, record count. |
| §58 | Session workspace | BUILT | `assistant` — refinements narrow the previous result; fresh questions follow the filters. |
| §59 | AI complements manual controls | BUILT | Structural: the assistant writes the same state object the filter panel renders from. |
| §60 | Internal vs external permissions | BUILT (model) | Mutating tools are registered, declared and refused. |
| §61 | Audit log | BUILT | Every state change with its source, action and summary; exportable. |
| §62 | Knowing when it cannot answer | BUILT | Eight named concepts refuse ahead of any intent match, so a nearby question is never answered in place of the one asked. |
| §63 | Eight AI test scenarios | BUILT | `qa` — 24 checks, all pass. |
| §64 | The strong future request | ARCH | Explicitly out of scope for this prototype. |

## §65–§69 Process and standard

| § | Requirement | Status | Note |
|---|---|---|---|
| §65 | The eleven-step sequence | BUILT | Steps 1–6 in `docs/01`–`06`; step 7 is `tools/build_seed.py`; steps 8–10 are the build and the QA run; step 11 is this document and the README. |
| §66 | The quality standard | BUILT | See the QA table in the README. |
| §67–§69 | Philosophy, priorities, reminder | N/A | |

---

## The honest summary

Nothing in the brief was dropped silently. Eleven items are **DEFERRED** or **ARCH**, each with a
reason stated above and in `docs/00-BUILD-CONTRACT.md`. Four features are **PARTIAL** — they are
correctly built and correctly report that the data cannot exercise them, which is the behaviour
§2.7 and §36 ask for rather than a shortfall against them.

The one requirement I declined outright is **§10's context layers**. A metro layer needs verified
station coordinates; none are in the repository and the OSM API is blocked in this environment.
Approximating them from memory would have been the single clearest breach of §2.2 available, and a
plausible-looking metro layer is more damaging than an absent one, because nobody checks a map pin
that looks right.
