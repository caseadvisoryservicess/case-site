# Documentation index

The brief (§65) asks for the work to be done in a sequence – restate, critique, design, then build.
These are the outputs of that sequence, in the order they were produced.

| # | Document | What it settles |
|---|---|---|
| **00** | [`00-BUILD-CONTRACT.md`](00-BUILD-CONTRACT.md) | **Binding.** The fifteen decisions (D1–D15), the ten technical constraints (T1–T10), the module layout, the state architecture, the analytics contract, and the oracle table of expected values. **Where any other document here disagrees with this one, this one wins.** |
| 01 | [`01-product-spec.md`](01-product-spec.md) | §65 step 1 – scope in / architecture-only / out, the six user types, and the ten UX plus eight assistant scenarios rewritten as mechanically checkable pass/fail statements. |
| 02 | [`02-brief-critique.md`](02-brief-critique.md) | §65 step 2 – the critical review of the brief. Thirteen internal contradictions, the feature-by-feature verdict against the real data coverage, fifteen technical risks, features to defer, and fourteen functions the brief omits but the prototype needs. Read §6.3 if you read nothing else. |
| 03 | [`03-information-architecture.md`](03-information-architecture.md) | §65 step 3 – thirteen regions, the panel-collision rules, exact breakpoints and track widths, the z-index scale, the full interaction inventory, and the i18n architecture. |
| 04 | [`04-data-schema.md`](04-data-schema.md) | §65 step 4 – the record schema, the provenance model, history-readiness, enumerations, district canonicalisation, the dataset envelope, and the repository seam a future backend would replace. |
| 05 | [`05-analytics-rules.md`](05-analytics-rules.md) | §65 step 5 – the denominator doctrine, sufficiency thresholds, exact formulas, the never-treat-missing-as-zero guards, bin strategies, and the worked numbers. |
| 06 | [`06-ai-architecture.md`](06-ai-architecture.md) | §65 step 6 – the layered architecture and provider seam, the tool registry, the intent catalogue mapped to every §54 and §63 example, session context, the six-block response, layers, and the permission model. |
| 10 | [`10-visual-system.md`](10-visual-system.md) | Colour, type, marks and motion. The office-class ramp was derived from the CASE brand red in OKLCH and **validated** against the ordinal checks on both surfaces; the contrast figures are computed, not estimated. |
| **11** | [`11-coverage-vs-brief.md`](11-coverage-vs-brief.md) | §65 step 11 – every one of the brief's 69 sections audited: built, architecture-only, partial, deferred, with the verification cited for each. Written as an audit rather than a summary so a requirement that was deliberately not built is visible rather than quietly absent. |
| **12** | [`12-data-sources.md`](12-data-sources.md) | Additional sources – Golden Pages, Google, Yandex, Yellow Pages, 2GIS, OSM, Orginfo, data.egov.uz. What each needs, what may legally be **stored** versus only shown, the ingestion pipeline, and why Google and Yandex cannot populate the dataset even with a paid key. |
| **13** | [`13-reference-repos.md`](13-reference-repos.md) | The §68 reference repositories reviewed under the §71 safety rules – licence, install scripts, key requirements, verdict. Four of twelve carry no licence; nothing was copied from any of them. |
| **14** | [`14-checkup-report.md`](14-checkup-report.md) | The second master prompt's §73 check-up – all 25 required checks with the test that proves each, plus the final lists: implemented features, known limitations, data limitations, AI limitations, next improvements. Includes the scoped plan for the trilingual download request. |
| **15** | [`15-case-os-archive-review.md`](15-case-os-archive-review.md) | Review of the CASE OS v4.73.1 hosting archive: it is the origin of the 148 records, and its price bundle holds 12 asking rents and 15 available-area values the dataset lacks – proposal built, 0 conflicts. Also the source register (919 sources, none licence-cleared), the population grid's own "methodological layer" caveat, and a security sweep. |
| **16** | [`16-geo-analytics-page-review.md`](16-geo-analytics-page-review.md) | Review of the standalone CASE OS Geo Analytics 2 page under a business-centres-only scope: two CASE-owned buildings absent from the 148, twenty street addresses withheld pending a GoldenPages terms check, the listing-price disambiguation rule now carried in every rent’s evidence note, and a matcher defect the page exposed (a name of nothing but stop-words scored 0.0 against itself). Also what the page holds that this dataset will not take, and the layers set aside by the scope. |
| **17** | [`17-decisions-and-open-items.md`](17-decisions-and-open-items.md) | Every decision this project has made without further input, and every item still owed by CASE (a reviewer name, the GoldenPages terms check, the Yandex Geocoder run, the download report shape, font authority, the 2GIS contract), in one table with why it matters and what happens once it is given. Also the one security note from this session. |

## The project skills

Fourteen skills in `../../.claude/skills/`, one per role the second master prompt names (§69),
each written from this project's own decisions and measurements. See that folder's `README.md`
for which to load before touching what.

## What is deliberately not here

- **A dataset plan.** The dataset was built rather than planned: `tools/build_seed.py` is the ETL,
  and every decision it encodes is documented in its own comments and in `00-BUILD-CONTRACT.md`
  §2 and §6. A plan describing work already done would be a second source of truth, and a stale one.
- **Design-document audits.** Two were commissioned and abandoned once the build contract
  superseded the documents they would have audited. The implementation is verified directly
  instead, which is stronger evidence: `index.html?selftest=1` asserts the arithmetic against
  `tools/oracle.py`, an independent Python implementation, and `node tools/qa.cjs` drives the
  built file in real Chromium through every acceptance scenario.

## Verifying rather than trusting

```
python3 tools/oracle.py               # recompute every expected value from the seed
node    tools/test-intents.cjs        # 38 parser cases: every §54, §63, §41 and §62 example
node    tools/qa.cjs                  # the built file, in Chromium, from file://
python3 tools/etl_districts_check.py  # re-audit the source district labels against the boundaries
python3 tools/name_dupes.py           # re-run the proximity-gated duplicate detection
python3 build.py --check              # fail if index.html has drifted from src/
python3 tools/test_merge.py           # 56 ingestion assertions: matching, the four
                                      # per-field outcomes, the licence gate
python3 tools/sources.py --check      # probe every external source's reachability
python3 tools/geocode_check.py --dry-run  # the Yandex address check: what it would ask, no network
python3 tools/geocode_check_page.py && node tools/test_geocode_page.cjs
                                      # the browser version of that check, driven in Chromium
                                      # with Yandex mocked: 36 checks
```
