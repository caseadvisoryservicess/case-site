# 13. Reference repositories – the §68 list reviewed under the §71 rules

The second master prompt names about forty repositories as reference sources and says: do not
install blindly; inspect README, licence, install scripts, network calls and key requirements
first; copy only relevant examples, schemas or workflows. This is that inspection, done from this
environment (READMEs and licence files fetched from `raw.githubusercontent.com`; nothing cloned,
nothing executed).

## 13.1 Verdict table – the skill and CRE repositories (§68.1, §68.7, §68.2 openmapstack)

| Repository | Licence file | Install surface | Keys | Verdict |
|---|---|---|---|---|
| `anthropics/skills` | Apache-2.0 for most skills; document skills source-available (per README) | plugin marketplace | none | **Use** – the format the fourteen project skills follow; nothing copied |
| `alirezarezvani/claude-skills` | MIT | 21 install commands, `.sh` setup scripts, symlink trees | 2 mentions | **Reference only** – 388 skills, 706 Python tools; a plugin marketplace this size is not something to enable wholesale in a client-data repo. Read `financial-analyst` and `market-research` for structure if wanted |
| `mariourquia/cre-skills-plugin` | Apache-2.0 | marketplace + DMG/EXE installers + MCP server | 1 mention | **Reference – strongly** – its `decision-grade` / `human gate` / "refuses to emit a final figure it cannot trace to your data" posture is exactly this project's D6 and denominator doctrine, arrived at independently. Institutional-underwriting oriented; nothing to copy for an HTML MVP, but its data-grade ladder (`docs/DATA_GRADES.md`) is worth reading for the production data layer |
| `cre-ai-skills/CRE-AI-Skills` | **none found** | drop-in SKILL.md folders, no deps, no keys | 1 mention | **Do not copy** – no licence means no right to reuse. Its skill *index* (rent-roll audit, T-12, PSA, ALTA, estoppel, lease-to-system) is a useful map of what a due-diligence layer would need later |
| `zubair-trabzada/ai-realestate-claude` | MIT | `curl … \| bash` one-line installer, `reportlab` auto-installed | none | **Do not run the installer.** Residential-investor scoring (cap rate, cash-on-cash) – out of scope and the wrong asset class. Nothing to take |
| `jaakla/openmapstack` | MIT | `npx skills add` | 1 mention | **Use as reference – the most relevant GIS repo**, as the prompt says. Its reproducible-project contract (pinned sources, explicit CRS, deterministic pipeline, machine-readable validation, surfaced provenance) is what `tools/build_seed.py` + `oracle.py` + `verify.sh` already are in miniature. For the production system, adopt its `project.yaml` idea |
| `VoltAgent/awesome-agent-skills` | MIT | 593 install commands in the README (it is a catalogue) | 28 mentions | **Catalogue only** – browse, never install from the list without the per-repo check |
| `affaan-m/everything-claude-code` | MIT | 29 install commands, hooks | 19 mentions | **Reference for hooks/subagent patterns**; its hooks execute shell – read each before enabling |
| `Imran-ml/claude-skills` | **none found** | 6 install commands | 9 mentions | **Do not copy** – unlicensed |
| `obviousworks/Claude-AI-skills-collection-2026` | **none found** | none | 4 mentions | **Do not copy** – unlicensed; catalogue only |
| `agentskillexchange/skills` | MIT | none | 5 mentions | Catalogue only |
| `gayu2k01/agent-ai` | Apache-2.0 | 1 | none | Example app; nothing applicable |

**Four of twelve carry no licence file.** Under §71 nothing is copied from them. A README that
says "drop these into your setup" is not a licence.

## 13.2 The libraries and infrastructure (§68.2–§68.6)

These are not skills and do not need a safety review; they are the well-known open stack. What
matters is *which stage of this project each belongs to*:

| Stage | Library | Status here |
|---|---|---|
| MVP (now) | **Leaflet** (BSD-2) | vendored, `vendor/leaflet.js`; attribution prefix set to drop the flag; markercluster alongside |
| MVP tooling | **Python stdlib** only | `build.py`, `build_seed.py`, `oracle.py`, `sources.py`, `collect.py`, `merge_incoming.py` – no GeoPandas/Shapely dependency so `verify.sh` runs anywhere |
| Production data | **PostgreSQL + PostGIS** | designed toward – `.claude/skills/postgis-engineer` maps every JS helper to its SQL |
| Production data | **PostgREST / Supabase** | candidates for the thin API behind `GEO.data.workingSet()` |
| Production geo | **GeoPandas, Shapely, GDAL** | for the ETL once it leaves stdlib; point-in-polygon and simplification are the first two calls to replace |
| Production map | **MapLibre GL JS**, later **deck.gl** | the prompt's own recommendation for v2; Leaflet stays for the single-file MVP |
| Phase 5 | **OSMnx, pgRouting** | walking catchments, drive-time – explicitly deferred |
| AI backend | **MCP spec + reference servers** | `mcp-builder` skill is enabled; the registry in `20-ai-tools.js` is already the tool list an MCP server would expose |
| AI backend | **LiteLLM / PydanticAI / LangChain / LlamaIndex** | provider-swap candidates behind the `22-ai-engine.js` seam; LiteLLM is the smallest fit for "multiple model providers" |
| RAG | **Chroma / Qdrant / Haystack** | for internal research over CASE documents (§47); not in scope |
| Analysis | **DuckDB, PySAL** | DuckDB is the right tool for the ingestion proposals once they exceed a few thousand rows |

## 13.3 What was actually taken

Nothing was copied. Two ideas were confirmed rather than imported:

- `mariourquia/cre-skills-plugin`'s *human gate before decision-grade output* and *refuse a figure
  you cannot trace* – already this project's D6 and the denominator doctrine.
- `jaakla/openmapstack`'s *reproducible project with pinned sources and surfaced provenance* –
  already `build_seed.py` → `seed.json` → `oracle.py` → `verify.sh`.

The fourteen project skills in `.claude/skills/` are written from this project's own decisions and
measurements, in the `anthropics/skills` SKILL.md format.

## 13.4 Reachability note

Only `raw.githubusercontent.com` is reachable from this container; `api.github.com` search is
scoped to the session's repository. Cloning or running any of the above was neither possible nor,
under §71, appropriate before a person has read the install scripts.
