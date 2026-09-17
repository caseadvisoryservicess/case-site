# Project skills – Geoanalytics platform

Fourteen skills, one per role the master prompt names (§69). Each carries the rules this project
actually established – found by measurement, recorded with the reason – rather than generic advice.
Load the one that matches the surface being touched; several will usually apply.

| Skill | Load before touching |
|---|---|
| `geo-product-architect` | scope, the build contract, any "should we also…" |
| `data-provenance-and-quality` | `seed.json`, `build_seed.py`, `03-data.js`, `04-quality.js`, any value read |
| `geospatial-data-engineer` | coordinates, districts, distance, matching, `09-geo.js` |
| `research-data-collector` | `sources.py`, `collect.py`, `merge_incoming.py`, any external source |
| `commercial-real-estate-analyst` | any metric, comparison, competitive set or location output |
| `financial-modeling-analyst` | anything that looks like NOI, yield, value or a feasibility input |
| `market-researcher` | any document that leaves the tool |
| `analytics-and-visualization` | `08-analytics.js`, `10-charts.js`, `15-panel-analytics.js`, stat tiles |
| `geo-ai-tool-designer` | `20-ai-tools.js`, `21-ai-intents.js`, the LLM seam |
| `geo-ai-safety-reviewer` | every assistant answer, block and refusal |
| `map-frontend-engineer` | anything under `src/`, `build.py`, the manifest |
| `security-and-permissions` | roles, credentials, endpoints, data inlining |
| `testing-and-qa` | anything under `tools/`, every commit |
| `postgis-engineer` | the production schema (architecture-only in the MVP) |

## The rules that appear in more than one skill

They are repeated on purpose – each skill must stand alone when loaded alone.

- **Never fabricate** a property fact. Unknown is never zero; `0` and `false` are values.
- **Every figure carries `n of N`** against the population asked about. `MIN_N = 3`.
- **Provenance by reference**; `nextRefreshAt` computed; record confidence is the weakest field's.
- **Geometry is authoritative** over the source's district label.
- **Nothing merges, resolves or applies without a named human** (D6, `--reviewer`).
- **Licence decides storage**: `open` populates; `display` (Google, Yandex) is never stored.
- **The assistant writes only through `GEO.state.set()`** and answers in six blocks with ORIGIN.
- **Measure, don't eyeball; a check that has never failed proves nothing.**
- **En dash** in every user-visible string.

## Verifying rather than trusting

```
python3 build.py --check       # the built file is current
bash tools/verify.sh --quick   # syntax, seed, oracle, intents, filters, search, assistant, ingestion, i18n, districts
node tools/qa.cjs              # the built file in Chromium from file://
```
