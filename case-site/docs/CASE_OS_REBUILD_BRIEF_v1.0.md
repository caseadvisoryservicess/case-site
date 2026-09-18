# CASE OS / CASE Geo - Rebuild Brief v1.0

**Date:** 2026-09-15 · **Owner:** Humoyunmirzo Mirkamolov, Head of Advisory, CASE Advisory (Tashkent)
**Purpose:** single-file handoff. Everything decided, found and verified across the Cowork research sessions of 11-15 September 2026, in the form Code mode needs to start work.

> **Labelling discipline used throughout, per CASE house rules:**
> **[FACT]** = observed in a source, with the source named · **[ASSUMPTION]** = inferred, not verified · **[RECOMMENDATION]** = our judgement.
> Any line without a label is structural text, not a claim.

---

## 0. How to use this file

| If you want to… | Go to |
|---|---|
| Understand what CASE OS is today, before touching it | §2 |
| Know why CASE Geo exists and what it sells | §3 |
| See what we learned from competitor teardowns | §4 |
| Get the actual build spec (entities, fields, API) | §5 |
| Check security posture and what to fix | §6 |
| Check Uzbek legal constraints | §7 |
| See the phased plan and what to build first | §8 |
| See every open decision and missing input | §9, §10 |

Drop this file at the repo root. Reference it from `CLAUDE.md` so Code mode loads it as context.

**Repository:** `github.com/caseadvisoryservicess/case-site`
**Working branch at handoff:** `claude/case-os-data-migration-p4df5y`
**Version at handoff:** CASE OS v4.70.2

---

## 1. Context

CASE Advisory is a Tashkent real-estate advisory and brokerage firm. Two systems are in play:

- **CASE OS** - the internal platform in production at `caseadvisory.uz/os/`. Real, mature, v4.70.2, ~28 released versions documented. Runs leasing, commissions, feasibility, project files, geo studio.
- **CASE Geo** - the planned commercial-real-estate geoanalytics product for Uzbekistan. Researched and costed but **not built**.

The work of these sessions answered three questions: is CASE Geo worth building (§3), what should it look like (§4-5), and does it start from CASE OS or from zero (§2, §8).

**The answer to the third question, established 2026-09-15: CASE OS is the starting point, not a blank page.** It already contains `objects`, `units`, `brands`, `market_data_points`, `market_data_sources`, `gis_analysis_cache`, `benchmarks` and `data_quality_snapshots` tables. CASE Geo is an extension of this schema, not a replacement.

---

## 2. CASE OS as it exists today

All of §2 is **[FACT]** - read from the repository on 2026-09-15.

### 2.1 Stack

| Layer | Detail |
|---|---|
| Backend | Plain PHP 8, `declare(strict_types=1)`, **no framework**. 37 endpoint files, ~4,950 lines total. |
| DB access | PDO. MySQL or SQLite (driver switch in `cfg()`). `ATTR_ERRMODE => ERRMODE_EXCEPTION`, `FETCH_ASSOC` default. |
| Frontend | Static HTML + **4.0 MB of JavaScript**: `core.js` (1 MB) plus **32 versioned module files**. |
| Module loading | `os/index.html` declares `APP_VERSION='4.70.2'` and a `CASE_EXPECTED_MODULES` manifest pinning each module's version. Geo-studio modules live in an iframe and are excluded from that manifest. |
| Maps | **Leaflet** - `leaflet.case.js` (147 KB), `leaflet.case.css`, `leaflet.markercluster.js`. Server side: `gis_proxy.php`, `geo_collector.php`. |
| Server | Apache. `os/.htaccess` and `os/api/.htaccess` + `.user.ini`. |
| Config | `os/api/config.php` **gitignored**. Templates: `config.sample.php`, `config.production.example.php`, `config.local-xampp.php`. |
| Local dev | XAMPP on the Windows workstation (`C:\xampp`), confirmed by `config.local-xampp.php`. |

### 2.2 API surface - 37 endpoints in `os/api/`

| Group | Files |
|---|---|
| Core | `lib.php` (49 KB - DB, sessions, permissions, table registry), `state.php` (38 KB), `data.php`, `auth.php` (17 KB), `users.php`, `user_prefs.php`, `workspace_access.php` |
| Geo | `geo_collector.php` (26 KB), `gis_proxy.php` (21 KB), `geo_state.php` (13 KB), `geo_master_install.php` (13 KB), `geo_master.php`, `geo_seed_convert.php`, `geo_education_export.php` |
| Commercial | `commission_tiered.php`, `commissions.php`, `lease_commissions.php`, `supplier_commissions.php`, `sales.php`, `partners.php`, `brand_requests.php`, `investor_requests.php` |
| Assets & units | `units_batch.php`, `unit_patch.php`, `project_files.php`, `feasibility_models.php`, `market_data.php` |
| Ops | `backup.php`, `migrate.php`, `setup.php`, `health.php`, `diag.php`, `cron_critical_dates.php` |

### 2.3 Database - 24 migrations, `2026_07_01` → `2026_08_13`

Tables present in schema:

```
activity_log  agent_metrics  app_state  app_users  audit_log  benchmarks
brand_requests  brands  case_partners  commission_engine_settings
commission_ledger  commission_rules  contacts  control_dates
data_quality_snapshots  deal_actions  deal_stage_probabilities  deals
doc_templates  document_versions  documents  feasibility_model_versions
feasibility_models  geo_state_history  gis_analysis_cache  investor_requests
kp_counters  lease_commission_deals  lease_commission_ledger  login_codes
market_data_points  market_data_sources  objects  partner_referrals
refusals  registry_changes  roles  sales_assets  sales_buyers
sales_commission_ledger  supplier_categories  supplier_commission_deals
supplier_commission_ledger  suppliers  unit_comments  units
```

**This is the single most important finding for the rebuild.** `objects`, `units`, `brands`, `market_data_points`, `market_data_sources`, `benchmarks` and `data_quality_snapshots` already exist. CASE Geo's data model (§5) extends these rather than replacing them.

### 2.4 Existing documentation in-repo

- `HANDOFF_CASE_OS.md` - **126 KB**, the master handoff. **Read this first in Code mode.** This brief does not duplicate it.
- `BACKEND_PLAN.md` (14 KB)
- `docs/audit/v4.45.0/CASE_OS_v4.45.0_DEEP_AUDIT_RU.md` (23 KB) + regression comparison + staging checklist
- ~28 changelogs, `v4.51.0` → `v4.70.2`
- `docs/qa/`, `docs/ops/`, `docs/market/`, `docs/deliverables/samsung-bc/`

### 2.5 Structural assessment

| Observation | Consequence |
|---|---|
| 32 versioned JS modules, each release patching the last | Works, but every future change costs more. `geoanalytics-studio.html` has reached **814 KB** as a single file. This is the main maintainability risk. |
| Leaflet + raster tiles | Diverges from the MapLibre GL + MVT stack specified for CASE Geo (§5.6). A real decision, not a detail. |
| No framework, no build step | Low ceremony, fast to change, no dependency rot. Genuine advantages - do not discard casually. |
| PHP API is small and readable (~4,950 lines / 37 files) | The backend is **not** the problem. The frontend is. |

---

## 3. CASE Geo - the commercial decision

Established 2026-09-11, unchanged through all later work.

### 3.1 The decision

> **Yes** as a service-amplifying platform that productises what CASE already sells.
> **No** as a standalone subscription SaaS.

**[ASSUMPTION]** Realistic paying universe in Uzbekistan: ~95-180 accounts. ARR ceiling ~$0.2-1.1m. Subscription alone cannot carry the business.

### 3.2 Revenue order - sell in this sequence

| # | Product | Price **[ASSUMPTION]** |
|---|---|---|
| 1 | Building audit + certificate | $1,500-4,000 |
| 2 | Location report | $300-900 |
| 3 | Landlord cabinet | $50-100 / building / month |
| 4 | Leasing deals closed through the platform | 1 month's rent, or 6-8% of annual |
| 5 | Subscription | $40-300 / month - **secondary, not primary** |

All prices are unvalidated. They are tested by the 22-question survey (built, in `CASE_Geo_Sorovnoma_GoogleForms.gs`) and by 5 paid pilots.

### 3.3 Who pays

Mall and business-centre owners and management companies · retail chains with ≥10 stores · developers · banks.
**Brokers pay little and supply much** - design them as data contributors with access, not as a revenue line.

### 3.4 Market facts

| Fact | Source |
|---|---|
| Tashkent: 24 quality malls, 514,000 m² GLA, **18% vacancy** | CMWP 2025 |
| Tashkent offices: 591,000 m² GLA, **16% vacancy** | CMWP 2025 |
| 285 realtor organisations, 684 realtors; market 50bn UZS (2024) | Senate, 07.04.2026 |
| **ЗРУ-1163 in force 08.11.2026** - registry, SRO, multi-listing | Law text |

**[FACT]** No existing player combines a building database + audit + leasing workflow. Geointellect, 2GIS and Beeline each hold one piece.

### 3.5 Budget (from the built financial model)

| Phase | Cash | In-kind |
|---|---|---|
| 8-week pilot | $10,802 | $2,000 |
| First 12 months | $95,722 | $13,800 |
| Expansion (months 13-24) | $159,830 | $19,200 |

| Scenario | Y1 revenue | Y2 revenue | Y2 EBITDA | Peak funding need |
|---|---|---|---|---|
| Cautious | $44.5k | $203.5k | $9.9k | $71.9k |
| Base | $88.8k | $424.2k | $191.5k | $46.2k |
| Good | $174.1k | $796.3k | $497.2k | $35.6k |

**Investment required: $80-90k, staged.** The earlier $21k / $264k figures were never substantiated - this model supersedes them.

### 3.6 Go / no-go gates - 8 weeks, need ≥5 of 7

1. ≥15 interviews
2. ≥5 written agreements to join a paid pilot
3. ≥3 paid audits or reports delivered
4. ≥1 data partner with written terms
5. ≥30 buildings confirmed by their owners
6. Survey n≥40 with ≥30% at "$100+/month or $1,000+ audit"
7. No legal blocker

**Fallback if gates fail:** "CASE Retail Index" + audit service, with no map product.

---

## 4. Consolidated audit intelligence

Four read-only technical audits were performed and analysed. Full per-audit documents live in the claude.ai project (`claude/*_takeaways_*.md`). This section is the consolidated conclusion.

### 4.1 What each audit gave us

| Audit | Date | What it contributed |
|---|---|---|
| **Geointellect** (web.geointellect.com) | 12.09 | Layer taxonomy; tools→report→history→export flow; limits-per-tariff object; weighted location score; **Tashkent data assets worth licensing** |
| **DSHK / Shaffof Qurilish** (dshk.shaffofqurilish.uz) | 14.09 | **Master-plan zoning (genplan)** - the real "building plan for Tashkent"; construction pipeline; SOATO admin keys; confirms MapLibre+MVT stack |
| **Placer.ai** | 14.09 | **Metric contract** (observed vs derived); provenance-as-object; gating architecture = tariff engine; GBA/GLA as two fields; public gated pages + embeddable widgets |
| **Aino World** (app.aino.world) | 14.09 | **Versioned analysis pipeline** (Agent→Algorithm→Steps→Analysis→score); credit metering; tile versioning; column-scoped tiles; DXF/georeferenced floor plans |

### 4.2 The "building plan for Tashkent" question - settled

This came up three times. The precise answer:

- **City-scale plan (genplan / zoning): DSHK has it.** `/api/genplan`, MVT, ≥7,614 polygons in the Tashkent-city view, 25 attributes including `funksiya` (27 values incl. `Savdo_va_tijorat`, `Ishbilarmonlik_markazi`, `Aralash_foydalanish`), `hudud` (5), `strategiya` (Rekonstruksiya / Konservatsiya / Renovatsiya), `qavatlilik`, site coverage %, FAR, `seysmologik_zonasi`, district, `mahalla_id`, area. **[FACT]**
- **DSHK 3D buildings do NOT cover Tashkent.** Tiles empty for Tashkent city and region; only Nukus and Fergana have data, Nukus without storey or height. **[FACT]**
- **Placer.ai has nothing** - US-only.
- **Aino has no Tashkent master plan** - its Tashkent layers would be OSM + Overture + Microsoft footprints, outlines with no attributes. But Aino gives the *building-scale* answer: **DXF import and georeferenced raster with on-map edit handles**, which is how a mall floor plan becomes a map layer and units become polygons with area in m². **[FACT]**

**[RECOMMENDATION]** Use DSHK genplan for the city layer (licensed, not scraped) and the Aino floor-plan mechanism for unit-level vacancy. These are different problems with different solutions.

### 4.3 Strategic consequence - where the moat is

Zoning is now public via DSHK. Construction pipeline is public. POIs are commodity.

**Therefore the moat is exactly three things:**

1. **Verified rents** - transacted, not asking
2. **Verified vacancy** - counted by unit, not by listing
3. **The audit and certificate** - a field-verified, methodology-backed score

Everything else is context. Build accordingly.

This also reframes the ask to hokimiyat / Minstroy: not "give us data that doesn't exist" but **"license what you already publish"** - with a credible exchange, since they hold supply (construction) and we hold commercial demand (rents, vacancy, tenant activity).

### 4.4 Take / Avoid - consolidated

**TAKE**

| Pattern | From | Why |
|---|---|---|
| Versioned analysis pipeline: Analysis → Algorithm(version) → Steps(typed) → Result(score) | Aino | Makes methodology inspectable and re-runnable; the basis of certificate defensibility |
| Metric contract: observed + derived + method + period, always together | Placer | "Visits" is never shown without its basis |
| Provenance as an object, per field, not a label | Placer + Aino | Drives UI caveats and the staleness rule |
| Gating enforced server-side, teased in UI | Placer | This *is* the tariff engine |
| GBA and GLA as two separate verified fields | Placer | Fixes a chronic CASE problem (Sayhun, Silk Hub) |
| Tile version in the URL **path**; `cols=` column-scoped tiles | Aino | Free caching; enforces the free/paid split at the data layer |
| Access levels: Private / View only / **Run analysis** | Aino | Landlord delegates a report run to a broker without edit rights |
| Metered counters, paid external sources counted separately | Aino | Resale of Beeline/2GIS/geocoding never runs at a loss |
| Ingest contract: upload-url → register → **preview** → status | Aino | Landlord-submitted unit lists previewed before going live |
| DXF + georeferenced raster with edit handles | Aino | Floor plan → unit polygons → m² |
| SOATO as canonical admin key | DSHK | Joins stat.uz, cadastre, mahalla. Free. Do now. |
| MapLibre GL + MVT from own API | DSHK | Confirmed working at national scale by a government portal |
| QR passport per object; photo gallery grouped by inspection date | DSHK | Model for audit evidence and re-audit history |
| Registry table beside the map; stats panel recomputing under filters | DSHK | Proven UX for this exact data shape |
| Tools → named report → history → export (XLSX/DOCX/PPTX) | Geointellect | Matches how CASE already delivers |
| Limits object per tariff | Geointellect | `MAX_REQUEST_DAY`, `MAX_RADIUS`, `MAX_REPORT_MONTH`, quota |
| Public gated pages + embeddable widgets | Placer | The concrete Kun.uz partnership mechanic |
| Chain ↔ Venue axis + co-tenant analysis | Placer | CASE core competence - but **phase 2**, after 300 verified buildings |

**AVOID**

| Anti-pattern | Seen in |
|---|---|
| Long-lived tokens in JS-readable storage (90-day JWT in localStorage; non-HttpOnly cookies) | Placer, Aino, Geointellect |
| `CSP default-src * 'unsafe-inline' 'unsafe-eval'` | Placer |
| **PII in URL query strings** (user email to a third-party widget) | Placer - exactly the ЗРУ-547 failure mode |
| Public API returning personal data (owner email; contractor names; `created_user` inside tiles) | Aino, DSHK |
| Access tokens in tile URL query strings | Aino |
| Client-side `is_admin` / `devMode` flags; discoverable `/auth/impersonate` | Aino |
| Session recording (Hotjar / Sentry Replay / Mixpanel) on pages holding customer data | Aino, Placer |
| Duplicate derived layers with no lineage and no author field | Aino - 4× duplicate catchments in a 19-layer demo |
| Public pages ~13 months stale while the app shows current data | Placer |
| "Test mode" pages and debug logging in production | DSHK, Aino |
| Two ID systems for the same thing in one app | DSHK |
| Stats that don't reconcile (1,303+717+73 = 2,093 vs 2,090 shown) | DSHK |

### 4.5 Competitive note

**[FACT]** Aino World is English-only - no RU/UZ, no locale switcher - and hosted on Vercel/Supabase with EU error tracking. **AloqaVentures (Tashkent) invested in Aino in January 2026.**

**[ASSUMPTION]** Aino entering Uzbekistan is a live scenario, not hypothetical.

**[RECOMMENDATION]** Our defensible ground against them: UZ/RU interface, local hosting under ЗРУ-547, field-verified rent and vacancy, and the audit certificate. None of those are things Aino ships quickly. Do **not** compete on map features.

---

## 5. CASE Geo data model v0.2 - the build spec

This is the consolidated developer brief promised across all four audits.

### 5.1 Core principle

> **Three chains, never merged:** `verified` · `asking` · `modelled`.
> A number's chain travels with it to the UI, to the PDF and to the API. A modelled figure never renders in the same visual style as a verified one.

### 5.2 Entity list

```
Account ─┬─< Workspace ─┬─< Object (building)  ─< Unit ─< Offer
         │              ├─< Analysis ── Algorithm(version) ─< Step
         │              │      └──< AnalysisRun ─< RunLayer
         │              ├─< Report
         │              └─< Certificate
         ├──< User ── Role ── Permission
         └── Subscription ── Limits[]

Layer ─< Feature          (reference geodata: genplan, POI, population…)
Chain ─< Brand ─< Occupancy → Unit      (phase 2)
```

### 5.3 `Object` - the building

Extends the existing `objects` table.

| Field | Type | Source / note |
|---|---|---|
| `id`, `workspace_id` | PK, FK | existing |
| `name`, `address` | string | existing |
| `geom` | Polygon (WGS84) | footprint |
| `centroid` | Point | for search |
| `soato_region`, `soato_district` | string | **DSHK - canonical admin key** |
| `mahalla_id`, `mahalla_name` | string | DSHK |
| `gba_sqm` | numeric + provenance | **Placer - separate field** |
| `gla_sqm` | numeric + provenance | **Placer - separate field, own source, own verification date** |
| `floors_above`, `floors_below` | int | |
| `year_built`, `year_renovated` | int | |
| `asset_class` | enum | mall / BC / street retail / mixed / warehouse / hotel |
| `zone_funksiya` | enum(27) | **DSHK genplan** - `Savdo_va_tijorat`, `Ishbilarmonlik_markazi`, `Aralash_foydalanish`, `Logistika_markazlari`, `Rivojlanish_hududi`… |
| `zone_hudud` | enum(5) | DSHK |
| `zone_strategiya` | enum | DSHK - Rekonstruksiya / Konservatsiya / Renovatsiya |
| `zone_strategiya_turi` | enum | DSHK - H1-H4, M_Muhofaza, QSh, ML, Y_yol_yoni |
| `permitted_floors` | int | DSHK `qavatlilik` |
| `site_coverage_pct`, `far` | numeric | DSHK |
| `seismic_zone` | string | DSHK MSK-64 |
| `illegal_construction_flag` | bool | DSHK registry - due-diligence flag |
| `parking_spaces`, `power_kw` | numeric | field survey |
| `is_closed`, `operating_info`, `opening_hours` | | **Placer** - object lifecycle |
| `floorplan_asset_id` | FK | **Aino** - DXF or georeferenced raster |
| `created_at`, `updated_at` | | |

**Every commercial field carries a `Provenance` object (§5.5).**

### 5.4 `Unit` and `Offer` - the vacancy model

The critical rule, established in session 1 and never revised:

> **Vacancy is counted by Unit, not by Offer.** Four brokers listing the same shop is one vacant unit, not four.

**`Unit`** (extends existing `units`): `id`, `object_id`, `code` (floor + number), `floor`, `area_sqm` + provenance, `frontage_m`, `ceiling_h`, `status` ∈ {occupied, vacant, under_fit_out, held}, `status_as_of`, `permitted_use`, `geom` (polygon on the floor plan), `current_occupier_id` → Brand.

**`Offer`**: `id`, `unit_id`, `broker_id`, `authority_level` ∈ {owner, exclusive, open, unverified}, `asking_rent`, `asking_currency`, `rent_basis` ∈ {per_sqm_month, per_unit_month, turnover_pct}, `service_charge`, `valid_from`, `valid_to`, `source_url`, `provenance`.

`authority_level` ties to the ЗРУ-1163 Davaktiv registry from 08.11.2026 - an unverified broker's offer must render differently from an owner's.

### 5.5 `Provenance` - the object every number carries

Aino's `sourced_from` card, plus what Aino conspicuously lacks (it has **no author field at all** on datasets).

| Field | Required | Values / note |
|---|---|---|
| `source_name` | yes | |
| `source_type` | yes | `osm` \| `overture` \| `dshk` \| `geointellect` \| `beeline` \| `2gis` \| `field` \| `landlord` \| `registry` \| `calculated` |
| `based_on` | yes if derived | **FK to parent record - not free text.** This is what prevents Aino's duplicate-layer failure. |
| `method` | yes if derived | |
| `query`, `radius_m`, `travel_time_min`, `travel_mode` | if derived | reproducibility |
| `fetched_at` | yes | |
| `datasource_updated_at` | yes | |
| `licence`, `copyright`, `notice` | yes | ODbL / CC attribution compliance |
| **`verified_by`** | yes for commercial fields | user id - **CASE addition** |
| **`verified_at`** | yes | drives the certificate validity clock |
| **`verification_method`** | yes | `call` \| `site_visit` \| `document` \| `registry` |
| **`confidence`** | yes | `verified` \| `asking` \| `modelled` - **never blended** |

**Staleness rule:** commercial fields go amber at 90 days, red at 180. Staleness is always visible - never hidden to make the product look better.

### 5.6 `Analysis` - the methodology container

Taken from Aino, corrected for defensibility.

```
Analysis   { id, workspace_id, name, instructions, zone_type, zone_value,
             data_sources[], access_level, usage_stats{owner, public} }
Algorithm  { id, analysis_id, version, created_at }     -- immutable once run
Step       { id, algorithm_id, order, name, type, prompt, data_sources[] }
AnalysisRun{ id, algorithm_id, algorithm_version, point, score, label,
             status, created_at, created_by }
RunLayer   { id, run_id, name, geom_source, tiles{...}, provenance }
```

`Step.type` ∈ `open_data` · `db_query` · `web_search` · `score_calculation` · **`field_survey`** ← our only unique step type, and our only real moat in this structure.

**Zone controls - keep to two, exactly as Aino does:**
- Radius slider, 100-2,000 m
- Isochrone: walking 5/10/15 min · **driving 5/10/15/20/30 min**

**[FACT]** Aino has not shipped driving or cycling isochrones - both marked "SOON".
**[RECOMMENDATION]** In Tashkent, car access dominates retail catchments. Driving isochrones via Valhalla are a cheap and visible differentiator. Build them.

**Non-negotiable rule:**

> **The score is deterministic and rule-based. It is not LLM-generated.**
> A certificate that scores differently on re-run is worthless, and it destroys the conflict-of-interest defence. `algorithm_version` is printed on the certificate and on the QR verification page. AI writes the narrative, never the number.

### 5.7 Analysis templates - the CASE set

Replacing Aino's 11 (Urban Planning / Real Estate / Geo Marketing).

| Template | Default zone | Key steps | Output |
|---|---|---|---|
| Retail unit screening | 500 m + 10 min walk | population, competitors, footfall proxy, rent comps | Score + 2-page PDF |
| Mall anchor catchment | 10/20/30 min **driving** | population, income proxy, competing malls, road access | Score + catchment map |
| BC office location | 15 min driving | employment nodes, parking, transport, comparable rents | Score + comps table |
| Ground-floor retail (residential) | 300 m radius | resident count, frontage, footfall, permitted use | Score + unit list |
| QSR / drive-through | 5 min driving | traffic flow, turn access, competitors, visibility | Score + access note |
| **Building audit (certificate)** | object polygon | 8 blocks incl. **field_survey**, documents, engineering | 100-point certificate |

### 5.8 `Limits` - the tariff engine

From Aino's 15 counters and Geointellect's limits object. Shape: `{name, type: count|unlimited|config, total_amount, left_amount, period}`.

| Counter | Why separate |
|---|---|
| `analysis_run`, `report_export`, `certificate` | core products |
| `geocoding`, `beeline_query`, `2gis_query`, `geointellect_query` | **each paid external source metered separately so resale never runs at a loss** |
| `territory_km2` | **pricing axis - sell by district** |
| `dataset_size_mb`, `object_count`, `user_seats` | capacity |

**Tiers - keep to three plus one geographic axis at MVP. Do not over-engineer** (Placer runs 244 permission strings and 817 feature flags; that is not our problem yet).

| Tier | Geography | Notes |
|---|---|---|
| Free | 1 district | Public map, geometry + name only |
| Retail / Pro | Tashkent | Full attributes, exports |
| Enterprise | Regions + API | Custom |

**Enforce in the API with a 403. Tease in the UI - render locked widgets as teasers, do not hide them** (Placer's approach, and it works).

### 5.9 Public vs gated - the free/paid boundary

**[FACT]** Aino's public project view renders geometry but shows "PROPERTIES - 0 fields". The tiles carry `feature_id` and style columns only.

**[RECOMMENDATION]** Copy this exactly. It is our free/paid split, enforced at the data layer rather than in the UI:

| Public (no login) | Gated |
|---|---|
| Building footprint, name, asset class | Rent, service charge |
| District, zone function | Vacancy by unit |
| Aggregate counts | Owner and broker contacts |
| Certificate grade + QR verification | Full audit report |

**Column allowlist is computed server-side per access level. Never derived from a client-supplied `cols=` parameter.**

### 5.10 Tiles

```
/tiles/{workspace}/{layer_uuid}/{tiles_version}/{z}/{x}/{y}.mvt
```

- **Version in the path** → cache forever, bump to invalidate. Copy from Aino.
- **`cols=` column scoping** → one dataset serves both public and paid views from one pipeline. Copy from Aino.
- **Token NOT in the query string.** Aino puts a 43-char token in `?t=` - it leaks via logs, referrers and CDN caches. Use a signed path segment with short TTL, and exclude query strings from access logs.

### 5.11 Ingest

`upload-url → register → preview → status`, with `ingest_attempts` and `ingest_error` persisted.

Accepted: `.csv .xlsx .zip/.shp .kml .gpx .gpkg .geojson .json .dxf .jpg .png`

**The `preview` step is mandatory** - landlord-submitted unit lists are reviewed before they reach the live map. This is not optional politeness; it is how the verified chain stays verified.

### 5.12 Reports and certificates

**`Report`**: `id`, `analysis_run_id`, `title`, `created_by`, `created_at`, `last_viewed_at`, `shared_with[]`, `share_token`, `status`, `export_config`.

**Export config** (from Placer): cover page, theme colour, entity colours, export permissions as flags. CASE branding is the default; client branding is a paid feature.

**`Certificate`**: `id`, `object_id`, `algorithm_version`, `score`, `grade`, `blocks[8]`, `issued_at`, `valid_until` (issued + 12 months), `qr_token`, `auditor_id`, `reviewer_id`, `disclaimer_version`.

**Conflict-of-interest controls - these are product requirements, not policy documents:**

1. Role separation - the auditor is not the leasing agent on the same object
2. Four-eyes - `auditor_id` ≠ `reviewer_id`, enforced in the API
3. **Audit fee is never tied to the grade**
4. Paid-for advertising placement labelled "Reklama" (2022 advertising law)
5. Standing disclaimer: **a CASE certificate is not a state certificate and not a safety guarantee**

---

## 6. Security

### 6.1 What CASE OS already does correctly - verified 2026-09-15

This corrects an assumption made earlier in the session. The session/header weaknesses found in Aino, Placer and Geointellect are **already handled in CASE OS**:

| Item | CASE OS | Location |
|---|---|---|
| `httponly` on session cookie | ✅ true | `os/api/lib.php:26` |
| `samesite` | ✅ Lax | `lib.php:27` |
| `secure` | ✅ set from HTTPS | `lib.php:28` |
| Session lifetime | ✅ 12 h (not 13 months) | `lib.php:23` |
| `session.use_strict_mode`, `use_only_cookies` | ✅ both on | `lib.php:17-18` |
| Content-Security-Policy | ✅ present | `os/.htaccess:32` |
| X-Content-Type-Options, X-Frame-Options, Referrer-Policy | ✅ all set | `.htaccess:18-20`, `lib.php:59-61` |
| HSTS | ✅ max-age 31536000 | `.htaccess:24` |
| `display_errors` off in production, logged instead | ✅ | `lib.php:11-12` |
| SQL parameterisation | ✅ 84 `prepare()` vs 40 `query()`; raw calls are on table identifiers from an internal registry | `os/api/*.php` |

**CASE OS is a more disciplined codebase than the audit sequence led us to expect.** Do not rewrite what already works.

### 6.2 What to fix

| # | Issue | Location | Severity |
|---|---|---|---|
| 1 | **`secure` flag reads only `$_SERVER['HTTPS']`.** Behind a reverse proxy or CDN terminating TLS this evaluates false and the session cookie ships without `Secure`. Add an `X-Forwarded-Proto` check. | `lib.php:28` | **Medium - fix first, it is small and contained** |
| 2 | CSP carries `'unsafe-inline'` and `'unsafe-eval'` | `.htaccess:32` | Medium - removes most of the CSP's XSS value. Hard to fix while 4 MB of inline-era JS exists; schedule with the frontend work. |
| 3 | No third-party session recording is present today - **keep it that way on authenticated pages** | - | Compliance (§7) |

### 6.3 Baseline for anything new

- Session token never JS-readable
- Server-side CSRF validation returning 403 on replay (Placer does this correctly)
- No PII in URL query strings, ever - including to third-party widgets
- No secrets in client bundles
- Public endpoints return a **server-side allowlisted field set**, never a full row
- Role gating enforced in the API; the UI may tease but never authorise
- Tile tokens in signed paths, not query strings

---

## 7. Uzbek legal and compliance constraints

| Constraint | Consequence for build |
|---|---|
| **ЗРУ-547 Art. 27-1** - personal-data localisation | Personal data stored in Uzbekistan (UzCloud / PS Cloud). No third-party session recording on cabinet pages. No PII to foreign endpoints. Register in the State Register. |
| **ЗРУ-1163**, in force **08.11.2026** - realtor law | Registry, SRO, multi-listing. `Offer.authority_level` must map to the Davaktiv registry. |
| Advertising labelling law (2022) | Paid placement labelled "Reklama" |
| VAT 12%, e-faktura | Billing design |
| **Google Maps ToS §3.2.3(d)(iii), (e)** | **Do not use Google for listings/directory content or satellite imagery in PDFs.** This is why the stack is MapLibre + MapTiler/Mapbox Streets, not Google. |
| 2GIS and Yandex terms | **Forbid storing returned data.** Query-time only, never cached into our tables. |
| Mapbox print rights | Limited to Streets styles - matters because CASE deliverables are PDFs |
| OSM / ODbL | Attribution carried on our own map regardless of what upstream portals do |

**[RECOMMENDATION]** Never scrape a government portal. Request written licence terms from Minstroy/DSHK: licence scope, export or API access, update frequency, attribution wording. Until then, use manually and cite.

---

## 8. Rebuild plan

### 8.1 The three decisions that must be made before code

| # | Decision | Options | Note |
|---|---|---|---|
| 1 | **Leaflet or MapLibre** for the geo studio | (a) keep Leaflet, extend · (b) migrate the geo studio to MapLibre GL + MVT · (c) run both, new work on MapLibre | DSHK proves MapLibre+MVT works at national scale. **[RECOMMENDATION]** (c) then (b) - do not big-bang a working production map. |
| 2 | **Frontend module strategy** | (a) continue the versioned-file pattern · (b) introduce a build step for new modules only · (c) full rewrite | **[RECOMMENDATION]** (b). A full rewrite of 4 MB of working JS is the highest-risk, lowest-return option available. |
| 3 | **CASE Geo inside CASE OS, or separate** | (a) extend CASE OS schema and API · (b) separate service sharing auth | **[RECOMMENDATION]** (a) for MVP - `objects`, `units`, `brands`, `market_data_*` already exist. Split later if multi-tenancy for external customers demands it. |

### 8.2 Phasing

**Phase 0 - foundation (weeks 1-2). No new features.**

1. Fix the `Secure` cookie flag (§6.2 #1)
2. Add SOATO columns to `objects`; backfill from DSHK dictionaries (14 regions, 202 districts - free, available now)
3. Split `gba_sqm` / `gla_sqm` into two fields with independent provenance
4. Create the `provenance` table/embedded structure (§5.5) and attach it to rent, area and vacancy fields first
5. Add `confidence` ∈ {verified, asking, modelled} and render the three chains differently in the UI

**Phase 1 - the vacancy model (weeks 3-6)**

6. `Unit.status` + `status_as_of`; enforce vacancy counted by unit
7. `Offer` table with `authority_level`; multi-broker de-duplication onto one unit
8. Floor-plan asset: DXF + georeferenced raster with edit handles → unit polygons → area in m²
9. Ingest pipeline with the mandatory preview gate

**Phase 2 - the analysis pipeline (weeks 7-10)**

10. `Analysis` / `Algorithm` / `Step` / `AnalysisRun` tables
11. Convert the 8 audit blocks into deterministic weighted rules (**requires the current scoring sheet - §10**)
12. Driving isochrones via Valhalla
13. The 6 templates in §5.7
14. `Certificate` + QR verification page + four-eyes enforcement

**Phase 3 - commercial layer (weeks 11-12)**

15. `Limits` counters and the three tiers
16. Server-side column allowlist per access level; tile `cols=` scoping
17. Public gated pages + embeddable widget (the Kun.uz mechanic)
18. Export config with CASE branding default

**Phase 4 - deferred**

- Chain ↔ Brand axis and co-tenancy analysis - **only after 300 verified buildings exist**
- Customer PostgreSQL connections - credential-custody liability with no MVP revenue
- CSP hardening - with the frontend module work

### 8.3 The existing GIS toolkit - reuse candidate

**[FACT]** Found on the workstation at `Documents\Claude\Projects\Case Advsory - Production\GIS\`:

- **Scripts:** `catchment_tool.py` (15.5 KB), `transit_tool.py` (13.3 KB), `editable_heatmap.py`, `rebuild_maps.py`, `render_heatmap.py`, `render_static_map.py`, `merge_sources.py`, `case_brand.py`, `requirements.txt`
- **Methodology:** `SOP - Catchment Methodology.md`, `Methodology Reference - Catchment & Trade Area.md`, `README - Data Setup.md`
- **Base data:** Uzbekistan OSM extract (Geofabrik 2026-06-11) as `.gpkg` (570 MB), `.shp`, `.osm.pbf` (116 MB); WorldPop constrained 2020 raster `uzb_ppp_2020_constrained.tif`; Tashkent bus routes CSV; `UZ Statistics Pack.xlsx`
- **Delivered outputs:** Amir_Temur_110, Creative_Avenue, Margilan_City_Mall - each with `catchment_map.html`, `zones.geojson`, `pois.csv`, `transit.geojson`, `catchment_summary.xlsx`

**This is a working catchment engine that has produced three real project deliverables.** It is Python over OSM + WorldPop - exactly the stack specified for CASE Geo.

**[RECOMMENDATION]** Before writing any new catchment code, read these scripts and the SOP. Phase 2 step 10 should wrap this existing engine in the Analysis/Step structure, not reimplement it. **This has not yet been reviewed in detail - it is the highest-value unexamined asset we have.**

---

## 9. Decision log

| Decision | Why | Owner | Next step | Data needed |
|---|---|---|---|---|
| CASE Geo = service amplifier, not standalone SaaS | Paying universe ~95-180 accounts caps ARR at $0.2-1.1m | Founder | Run the 8-week gates | Survey n≥40 |
| Sell audit → report → cabinet → leasing; subscription last | Matches willingness to pay and CASE's existing delivery | Founder | 5 paid pilots | Pilot signatures |
| Build on CASE OS, do not start fresh | `objects`, `units`, `brands`, `market_data_*` already exist | Dev | Phase 0 | - |
| Score is deterministic, AI writes narrative only | Reproducibility; conflict-of-interest defence | Product | Convert 8 blocks to weighted rules | Current scoring sheet |
| Provenance object with `verified_by` / `verified_at` / `method` / `confidence` | Verification is what CASE sells; every audited competitor lacks an author field | Data lead | Phase 0 step 4 | - |
| Vacancy counted by Unit, never by Offer | Four brokers, one shop, one vacancy | Product | Phase 1 | - |
| GBA and GLA as two independently verified fields | Chronic error source (Sayhun, Silk Hub) | Data lead | Phase 0 step 3 | - |
| SOATO as canonical admin key | Joins stat.uz, cadastre, mahalla; free; available now | Data lead | Phase 0 step 2 | DSHK dictionaries |
| Tile version in path + server-side column allowlist | Free caching; free/paid split at the data layer | Dev | Phase 3 | - |
| Add driving isochrones (Valhalla) | Car-dominant catchments; Aino has not shipped this | Dev | Phase 2 step 12 | Road network extract |
| Licence DSHK genplan, never scrape | Government source; scraping destroys the partnership ask | Founder | Letter to Minstroy/DSHK | - |
| No Google basemap; MapLibre + MapTiler/Mapbox Streets | Google ToS §3.2.3(d)(iii),(e) - listings and PDF satellite | Dev | Confirm print rights in writing | MapTiler Flex terms |
| Never store 2GIS/Yandex returned data | Their terms forbid it | Dev | Query-time only | - |
| No third-party session recording on authenticated pages | ЗРУ-547 exposure | Compliance | Analytics policy note | - |
| Defer customer-Postgres connections | Credential custody risk, no MVP revenue | Dev | Revisit post-launch | - |
| Chains/co-tenancy is phase 2 | Needs 300 verified buildings first | Product | After phase 3 | Building count |
| Declined: accessing CoStar through the user's logged-in session | Would breach subscriber terms, contradict our own "licensed access only" rule, and undermine the clean-sourcing pitch to landlords/Minstroy/Beeline. CoStar has no Uzbekistan coverage regardless. | - | - | - |

---

## 10. Required inputs - still missing

Ranked by how much they block.

| # | Input | Blocks |
|---|---|---|
| 1 | **The 8 audit blocks with current point weights** as CASE applies them today | Phase 2 step 11 - turning the score into a deterministic algorithm |
| 2 | **One real mall floor plan** (DXF preferred, or scan) with written permission | Phase 1 step 8 - proving georeference → unit polygon → m² → vacancy |
| 3 | **Read of the existing GIS toolkit** (scripts + 3 methodology docs, ~90 KB) | Phase 2 - deciding wrap vs rewrite |
| 4 | **Read of `HANDOFF_CASE_OS.md`** (126 KB) and `BACKEND_PLAN.md` | All phases - working from actual architecture rather than inference |
| 5 | Written reuse terms from Minstroy / DSHK (licence, API, update frequency, attribution) | Genplan layer |
| 6 | Cost per call for each resold external source (Beeline, 2GIS, geocoding) | Phase 3 step 15 - counter pricing |
| 7 | MapTiler Flex vs self-hosted basemap decision, with **print/PDF rights in writing** | Deliverable production |
| 8 | Tariff tiers - exactly what each unlocks (features × geography) | Phase 3 |
| 9 | CASE category tree and its mapping to a standard classifier (NAICS/SIC or local) | Phase 2 |
| 10 | First-coverage Tashkent districts | `territory_km2` pricing |
| 11 | Beeline / Geointellect / 2GIS Uzbekistan price lists; OLX business tariffs; cadastre open-service terms | Data partnerships |
| 12 | 2026 census district/mahalla results | Population layer |
| 13 | Current text of ЗРУ-547 Art. 27-1 | Compliance sign-off |

**No data partnership exists yet.** Beeline, 2GIS, Geointellect, Minstroy/DSHK and Yandex are all drafted asks, not agreements. Nothing in this brief should be presented to an investor as an existing partnership.

---

## 11. Source register

| Source | Date | Type |
|---|---|---|
| CMWP Uzbekistan market report | 2025 | Published |
| Senate of Uzbekistan - realtor market figures | 07.04.2026 | Published |
| ЗРУ-1163 (realtor law, in force 08.11.2026) | 2026 | Law |
| ЗРУ-547 Art. 27-1 (personal data localisation) | - | Law |
| Geointellect read-only audit - web.geointellect.com | 12.09.2026 | Own audit |
| DSHK / Shaffof Qurilish read-only audit - dshk.shaffofqurilish.uz | 14.09.2026 | Own audit |
| Placer.ai read-only audit - placer.ai, analytics.placer.ai | 14.09.2026 | Own audit |
| Aino World read-only audit - app.aino.world | 14.09.2026 | Own audit |
| CASE OS repository inspection - `case-site` @ `claude/case-os-data-migration-p4df5y` | 15.09.2026 | Own inspection |
| CASE GIS toolkit inventory - workstation | 15.09.2026 | Own inspection |
| Aino pricing / funding (Sierra Technologies SL; AloqaVentures Jan 2026) | 11.09.2026 | Public sources |
| Google Maps Platform ToS §3.2.3 | - | Vendor terms |

**Not verified, and not to be claimed:** no paid demo of Placer.ai, CoStar, Geointellect or Aino was purchased or trialled. All product knowledge comes from public documentation, marketing material and read-only inspection of publicly reachable pages. No Uzbekistan coverage exists in Placer.ai or CoStar.

---

## 12. Companion materials already produced

Held in the claude.ai project **"Humoyunmirzo Mirkamolov"** (`claude/` prefix) and in earlier session outputs:

| Item | Form |
|---|---|
| `GeoPlatform_CASE_Geo_qaror_2026-09-11.md` | Decision summary (UZ) |
| `Geointellect_audit_takeaways_2026-09-12.md` | Audit takeaways |
| `DSHK_shaffofqurilish_takeaways_2026-09-14.md` | Audit takeaways |
| `Placer_ai_takeaways_2026-09-14.md` | Audit takeaways |
| `Aino_world_takeaways_2026-09-14.md` | Audit takeaways |
| `Kun_uz_hamkorlik_tahlili_2026-09-14.md` | Partnership analysis |
| `Yandex_Geoanalytics_javob_2026-09-12.md` | Drafted reply to Yandex |
| Full report, 30 pages | DOCX (UZ) |
| Investor deck, 10 slides | PPTX, sources in speaker notes |
| Financial model, 9 sheets, 4,939 formulas, 0 errors | XLSX |
| Team / sources / 12-week plan | DOCX (UZ) |
| Survey, 22 questions + Apps Script generator | DOCX + `.gs` |

---

*End of brief. Version 1.0, 2026-09-15.*
