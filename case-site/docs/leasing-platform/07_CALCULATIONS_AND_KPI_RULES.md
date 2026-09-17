# Dashboard formulas and anti-double-counting rules

**Purpose.** This document defines every number that the Leasing & Sales Platform (LSP, `os/leasing/`) shows on dashboards, floor plans, pipelines, merchandise-mix views, the client portal and reports, and the rules that prevent the same square metre from being counted twice. It is the implementation contract for `js/services.js` (pure functions, no DOM) and the source of the unit-test fixture reused by `10_QA_PLAN.md`. Facts are cited to `00_MASTER_PROMPT.md §n` or to CASE OS files; assumptions are labelled A-n; open questions Q-07-n carry a recommendation and an owner.

**Status: DRAFT for approval — 2026-09-17**

Related documents: `03_DATA_MODEL.md` (entity fields), `05_STATUSES_STAGES_AND_CONFIG.md` (status/stage config schema), `04_ROLES_AND_VISIBILITY.md` (client filtering), `06_FLOORPLAN_ARCHITECTURE.md` (polygon mapping), `10_QA_PLAN.md` (tests), `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (tool registry).

---

## 1. Notation and data sources

### 1.1 Principles (facts)

| Rule | Source |
|---|---|
| KPIs are calculated from unit and deal data; nothing is hard-coded | 00_MASTER_PROMPT.md §34 |
| Unit status and deal stage are separate fields | 00_MASTER_PROMPT.md §6.3, §12 |
| Inventory counts unit area once; pipeline counts deal areas by explicit rules | 00_MASTER_PROMPT.md §6.4, §6.5, §34 |
| Unknown values are never treated as zero; denominators are visible | 00_MASTER_PROMPT.md §65 "Calculations", §69 |
| Inventory and pipeline are visibly distinguished | 00_MASTER_PROMPT.md §34 |
| Client KPIs use approved visibility rules | 00_MASTER_PROMPT.md §35, §65 |

CASE OS today computes occupancy as `occArea = Σ area of units whose status ∈ OCCK = ['cd','cs','os']` and `occPct = occArea / obj.gla` (`os/core.js` lines 892–894), i.e. the denominator is the declared project GLA, not the unit sum, and "offer signed" counts as occupied. The owner report (`os/v4450-owner-report.js`, `buildSnapshot()`) sums unit areas per status, uses `gla = obj.gla || Σ unit.area`, and stores only `signedDelta`/`committedDelta` as change history. LSP keeps the "each unit in exactly one bucket" idea of the owner report but replaces the declared-GLA denominator (see 2.4) and stores a full snapshot (see 12).

### 1.2 Inputs

| Symbol | Source field | Notes |
|---|---|---|
| `U` | `appState.units` filtered by `projectId` (or portfolio) | Inventory base |
| `u.gla` | `unit.area.glaM2` | Number > 0, else "no area" |
| `u.status` | `unit.commercialStatus` | Inventory state only (D5) |
| `u.mode` | `unit.dealMode` ∈ `leasing` \| `sales` \| `both` | A-07-1, per 00_MASTER_PROMPT.md §23 |
| `D` | `appState.deals` | `type` ∈ `Leasing` \| `Sales` |
| `d.unitIds` | `deal.unitIds` | May contain several units (§6.5) |
| `d.areaOverrideM2` | `deal.areaOverrideM2` | Optional, D6 |
| `d.probability` | `deal.probability` (0–100) or null | Overrides stage default |
| `cfg.unitStatuses[key]` | `DEFAULT_CONFIG.unitStatuses` | `{key, label, kind, availabilityGroup, countsAs, color, textColor, pattern, clientStatus}` (D5) |
| `cfg.leasingStages[]`, `cfg.salesStages[]` | `DEFAULT_CONFIG` | `{key, label, rank, probability, pipelineGroup, requiresLostReason}`; `rank` = 1-based position in the list (schema owned by `05_STATUSES_STAGES_AND_CONFIG.md`) |
| `cfg.kpi.underNegotiationStage` | `{leasing:'Negotiation', sales:'Negotiation'}` | Threshold, resolved to rank at compute time (D6) |
| `cfg.kpi.mixDeviationPp` | default `5` | Over/under-representation threshold, percentage points |
| `cfg.staleRules` | see 9 | Thresholds in Settings (§41) |
| `ctx.today` | injected ISO date | Never `new Date()` inside services; tests pass a fixed date |

`countsAs` values (D5): `vacant` (Vacant, Available, Active Marketing, For Sale), `leased` (Contract Signed, Fit-out, Occupied), `sold` (Sold), `pipeline` (Reserved), `unavailable` (Temporarily Blocked, Not Available, Unknown). A status key missing from config is treated as Unknown and reported by the hygiene check (10).

`pipelineGroup` values required by this document: `pre_signature` (Lead … Contract Draft; sales Lead … Contract), `post_signature` (Contract Signed / Payment In Progress … Commission Received), `closed` (Closed Won, Closed Lost). Default stage probabilities are listed in 3.3 (A-07-2).

### 1.3 Definitions used everywhere

```text
hasArea(u)        = isFinite(u.area.glaM2) && u.area.glaM2 > 0
isOpen(d)         = d.status === 'Open' && stageCfg(d).pipelineGroup !== 'closed'
rank(d)           = stageCfg(d).rank           (stage list of d.type)
thresholdRank(t)  = rank of cfg.kpi.underNegotiationStage[t]
openDealsOf(u)    = D.filter(d => isOpen(d) && d.unitIds.includes(u.id))
qualifies(d)      = isOpen(d) && rank(d) >= thresholdRank(d.type)
derivedStage(u)   = max-rank stage among openDealsOf(u), or null   (D5, never stored)
```

Units, currencies and rounding:

| Item | Rule |
|---|---|
| Area | m², kept unrounded internally; displayed with 0 decimals (1 decimal in tables when < 100 m²) |
| Percent | computed from unrounded sums, displayed with 1 decimal, always next to its denominator ("30.0 % of 1 000 m²") |
| Money | stored to cents (`cents()` rounding, D20), displayed with 0 decimals and NBSP thousands separators; per-currency: values are never summed across currencies. Mixed currencies produce one line per currency and no total (A-07-3: no FX conversion in v0.1) |
| Rent unit | `leasingTerms.rentUnit`: `USD/m2/month` (default) → annual = rent × area × 12; `USD/m2/year` → rent × area; `USD/month` → rent × 12; `USD/year` → rent. Unknown unit → value n/a |
| Missing | any missing input makes the affected figure `null`, displayed "n/a", and increments a "n records without X" note; missing never becomes 0 |
| Dates | ISO `YYYY-MM-DD`; day differences are calendar days at local midnight |

### 1.4 Provenance on aggregates (D16)

Inputs that carry a `provenance` record (`unit.provenance.glaM2`, `unit.provenance.askingRent`, `deal.provenance.agreedRent`, `deal.provenance.agreedPrice`, `project.provenance.glaM2`) propagate into every aggregate built from them. Each aggregate result object carries:

```text
provenance: { conf: weakest(conf of inputs)            // modelled < asking < verified; missing record = 'none'
              composition: { verified:n, asking:n, modelled:n, none:n },
              oldestAt: min(at of inputs) | null,      // dates the aggregate
              staleness: 'ok' | 'amber' (> 90 days) | 'red' (> 180 days) | 'unknown' }
```

The order is `none` < `modelled` < `asking` < `verified`; an aggregate is therefore never stronger than its weakest input. Client-facing outputs (11) show the confidence mark and word ("≈ asking, 7 of 10 units verified"), never a bare number. This is the CASE OS v4.71.0 rule (`v4710-provenance.js`), applied unchanged.

---

## 2. Inventory bucket algorithm (unit-centric)

### 2.1 Buckets

Every unit with an area lands in exactly one of five buckets; units without area are counted separately and excluded from all m² sums (00_MASTER_PROMPT.md §34, §6.4; D6).

| Bucket | Membership rule | 00_MASTER_PROMPT.md |
|---|---|---|
| `leased` | `countsAs === 'leased'` | §34 "Leased GLA" |
| `sold` | `countsAs === 'sold'` | §33 |
| `underNegotiation` | `countsAs === 'pipeline'` (Reserved), or `countsAs === 'vacant'` and at least one qualifying open deal | §33 "GLA in negotiation" |
| `available` | `countsAs === 'vacant'` and no qualifying open deal | §34 "Vacant GLA" |
| `unavailable` | `countsAs === 'unavailable'` or unknown status key | §14.5 |

The bucket ignores deals below the threshold: a unit with a Lead is still Available (it is marketable), but the prospect appears in the pipeline (3) and in the unit drawer.

### 2.2 Pseudo-code

```text
function computeInventory(units, deals, cfg, ctx):
  out = { totalGLA:0, unitsWithArea:0, unitsWithoutArea:0, unitsWithoutAreaIds:[],
          leasedGLA:0, soldGLA:0, underNegotiationGLA:0, availableGLA:0, unavailableGLA:0,
          counts:{leased:0, sold:0, underNegotiation:0, available:0, unavailable:0, noArea:0},
          perUnit:{} }
  for u in units:
    st = cfg.unitStatuses[u.commercialStatus] ?? cfg.unitStatuses.Unknown
    bucket = switch st.countsAs:
      'leased'      -> 'leased'
      'sold'        -> 'sold'
      'pipeline'    -> 'underNegotiation'
      'unavailable' -> 'unavailable'
      'vacant'      -> openDealsOf(u).some(qualifies) ? 'underNegotiation' : 'available'
    out.perUnit[u.id] = { bucket, derivedStage: derivedStage(u), hasArea: hasArea(u) }
    if not hasArea(u):
      out.unitsWithoutArea++ ; out.unitsWithoutAreaIds.push(u.id) ; out.counts.noArea++ ; continue
    out.unitsWithArea++ ; out.totalGLA += u.area.glaM2
    out[bucket + 'GLA'] += u.area.glaM2 ; out.counts[bucket]++
  assert |leased+sold+underNegotiation+available+unavailable − totalGLA| < 0.01   // partition invariant
  return out
```

Portfolio KPIs (00_MASTER_PROMPT.md §33) call `computeInventory` per project and add the results; the partition invariant holds per project and for the sum. "Active projects" = projects with `status === 'Active'`.

### 2.3 Derived figures and denominators

| Figure | Formula | Denominator shown |
|---|---|---|
| `totalGLA` | Σ `glaM2` of units with area | — (this *is* the denominator) |
| `totalLeasingGLA` | Σ `glaM2`, units with `dealMode ∈ {leasing, both}` | — |
| `totalSalesGLA` | Σ `glaM2`, units with `dealMode ∈ {sales, both}` | — |
| `leasedPct` | `leasedGLA / totalGLA` | `totalGLA` |
| `soldPct`, `underNegotiationPct`, `availablePct`, `unavailablePct` | same pattern | `totalGLA` |
| `leasedOfLeasingPct` (report only) | `leasedGLA / totalLeasingGLA` | `totalLeasingGLA` |
| `committedGLA` | `leasedGLA + soldGLA` | `totalGLA` |
| `openGLA` | `availableGLA + underNegotiationGLA` | `totalGLA` |

When `totalGLA === 0` every percentage is `null` ("n/a"), never 0 %.

### 2.4 Declared project GLA

`project.areas.glaM2` (00_MASTER_PROMPT.md §9) is *declared* GLA. It is displayed as a separate card "Declared GLA 1 200 m² · measured from units 1 000 m² (5 of 6 units) · difference −200 m² (−16.7 %)" and is never substituted into a denominator. A difference above `max(50 m², 2 %)` raises hygiene warning H-12 (10). This mirrors the validation in `os/v4450-owner-report.js` line 53 but removes the silent `gla = obj.gla || Σ area` fallback.

---

## 3. Leasing pipeline metrics (deal-centric)

All figures in this section iterate over deals (`type === 'Leasing'`, `isOpen`), never over units. Every card, chart and table built from them carries the caption "Deal-based: units with several prospects appear in each deal" (00_MASTER_PROMPT.md §34).

### 3.1 Deal area

```text
function dealArea(d, units):
  if isFinite(d.areaOverrideM2) && d.areaOverrideM2 > 0:
      return { m2: d.areaOverrideM2, source:'override', unitsWithoutArea:0 }
  ids = unique(d.unitIds)                      // a unit listed twice counts once
  us  = ids.map(lookup)                        // missing unit id -> hygiene H-14
  if us.some(u => !hasArea(u)):
      return { m2:null, source:'n/a', unitsWithoutArea: count }   // never a partial sum
  return { m2: Σ u.area.glaM2, source:'units', unitsWithoutArea:0 }
```

A deal whose area is `null` is listed under "deals without area" and excluded from m² sums; its count is still shown.

### 3.2 Pipeline area

| Figure | Formula | Label in UI |
|---|---|---|
| `pipelineAreaByStage[stage]` | Σ `dealArea` of open pre-signature deals at that stage | "Deal-based" |
| `pipelineAreaTotal` | Σ over stages | "Deal-based" |
| `pipelineUniqueUnitArea` | Σ `glaM2` of the unique units linked to any open pre-signature deal (a unit counted once) | "Unique units in pipeline" |
| `pipelineAreaByManager[managerId]` | Σ `dealArea` by `ownership.responsibleManagerId` | "Deal-based" |
| `pipelineAreaByCategory[cat]` | Σ `dealArea` by the deal brand's `classification.category` (see 6.6) | "Deal-based" |
| `weightedPipelineArea` | Σ `dealArea × p(d)` | "Probability-weighted" |

`pipelineUniqueUnitArea` ≥ `underNegotiationGLA` is possible (Leads are in the pipeline but below the threshold); both are shown side by side so the difference is explained rather than hidden. Post-signature deals (Contract Signed … Commission Received) are reported in a separate "Signed, closing" table and are excluded from pipeline area and weighted value; their units are already `leased` in inventory.

### 3.3 Pipeline value

Value basis for a leasing deal, first non-null wins ("fallback chain"):

```text
rentBasis(d, units) =
  1. d.commercialTerms.agreedRent      -> source 'agreedRent',   estimated:false
  2. d.commercialTerms.proposedRent    -> source 'proposedRent', estimated:true
  3. d.commercialTerms.askingRent      -> source 'askingRent',   estimated:true
  4. per linked unit: unit.leasingTerms.askingRent  (area-weighted; all units must have rent AND area)
                                       -> source 'unit.askingRent', estimated:true
  5. otherwise                          -> value null, listed as "deal without value"
annualisedRent(d) = rent × dealArea × 12     (rentUnit 'USD/m2/month'; other units per 1.3)
                  = Σ_u (unit.askingRent_u × glaM2_u) × 12   for source 4 (override area ignored: A-07-4)
```

`estimated` is `true` for every source except `agreedRent`; the UI prints "≈" before estimated values and the report footnote states the share of estimated value ("62 % of pipeline value is estimated from proposed or asking rents"). Service charge, turnover rent and rent-free are not part of pipeline value (they are shown on the deal; effective-rent analysis is future scope, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`). Currency is taken from the source record; mixed currencies are not summed (1.3).

Probability precedence:

```text
p(d) = isFinite(d.probability) ? clamp(d.probability, 0, 100) / 100 : stageCfg(d).probability / 100
weightedValue(d) = annualisedRent(d) × p(d)
```

Default stage probabilities (A-07-2, editable in Settings; leasing / sales):

| Rank | Leasing stage | p % | Sales stage | p % |
|---|---|---|---|---|
| 1 | Lead | 5 | Lead | 5 |
| 2 | Contacted | 10 | Contacted | 10 |
| 3 | Qualified | 15 | Qualified Buyer | 15 |
| 4 | Requirement Confirmed | 20 | Requirement Confirmed | 20 |
| 5 | Property / Unit Offered | 25 | Property / Unit Offered | 25 |
| 6 | Viewing Scheduled | 30 | Viewing | 30 |
| 7 | Viewing Completed | 35 | Offer | 45 |
| 8 | Negotiation | 50 | Negotiation | 55 |
| 9 | LOI / Commercial Terms | 65 | Reservation / Deposit | 75 |
| 10 | Contract Draft | 80 | Contract | 90 |
| 11 | Contract Signed | 100 | Payment In Progress | 95 |
| 12 | Tenant Handover / Opening Preparation | 100 | Payment Completed | 100 |
| 13 | Commission Pending | 100 | Commission Pending | 100 |
| 14 | Commission Received | 100 | Commission Received | 100 |
| 15 | Closed Won | 100 | Closed Won | 100 |
| 16 | Closed Lost | 0 | Closed Lost | 0 |

Stage lists: 00_MASTER_PROMPT.md §22, §23. The CASE OS seed (`os/sql/schema_mysql.sql`: neg 20, off 40, res 35, os 65, cs 85, cd 100) is used only by the import adapter to pre-fill `deal.probability` on imported deals; it is not the LSP default.

### 3.4 Stage aging, conversion, attention lists

| Metric | Formula | Notes |
|---|---|---|
| `stageAgeDays(d)` | `days(ctx.today − d.dateEnteredStage)`; `null` if the date is missing | Shown per deal and as average / max per stage |
| `stageAgingByStage[stage]` | `{count, avgDays, maxDays, over: count with age > cfg.staleRules.stageAgeWarningDays[stage] ?? 30}` | Only deals with a date |
| `reached(d, s)` | `rank(d) ≥ rank(s)` or any `statusHistory` entry for `d` with `toStage` rank ≥ rank(s) | Skipped stages count as reached; Closed Won counts as reached for every stage; Closed Lost keeps the last real stage |
| `conversion(s → s+1)` | `count(reached(s+1)) / count(reached(s))` over deals created in the period | Denominator printed ("2 of 4") |
| `winRate` | `won / (won + lost)` for deals closed in the period | Same period rule |
| `signedDeals` | count of deals with `outcome.signedDate` in period, or stage rank ≥ Contract Signed and not lost | 00_MASTER_PROMPT.md §33 |
| `dealsWithoutNextAction` | open and (`!nextAction.text` or `!nextAction.dueDate`) | §27, §33 |
| `overdueFollowUps` | open and `nextAction.dueDate < ctx.today` | Tasks overdue are a separate card (`getOverdueTasks`) |
| `dueToday`, `next7Days` | `dueDate === today`; `today < dueDate ≤ today + 7` | §27 |
| `lastActivityDate(d)` | max(`activity.lastContactDate`, dates of activities with `dealId === d.id`, `dateEnteredStage`) | Edits (`updatedAt`) do not reset it |
| `staleDeals` | open and `days(today − lastActivityDate) ≥ cfg.staleRules.dealInactivityDays` (default 14) | 9 |
| `lostReasons[reason]` | count of Closed Lost deals by `outcome.lostReason` in period | Missing reason → hygiene H-09 |

Conversion and stage aging read `statusHistory` (entries written on every stage change, `05_STATUSES_STAGES_AND_CONFIG.md`); without history they fall back to current stages and say "current stages only".

---

## 4. Sales pipeline metrics

Same skeleton as 3 with `type === 'Sales'`, the sales stage list and these substitutions:

| Item | Sales rule |
|---|---|
| Value basis | `agreedPrice` → `offerPrice` → `askingPrice` (deal) → Σ `unit.salesTerms.askingPrice` → Σ (`unit.salesTerms.pricePerM2 × glaM2`) → `null`. `estimated = source !== 'agreedPrice'` |
| Value | total price (not annualised) |
| Weighted value | price × `p(d)` |
| Threshold | `cfg.kpi.underNegotiationStage.sales` (default Negotiation, rank 8; Q-07-1 proposes Offer) |
| Reserved units | `commercialStatus = Reserved` ⇒ inventory `underNegotiation`; a deal at Reservation / Deposit without a Reserved unit → hygiene H-07 |
| Sold | `soldGLA`, `soldUnits`, `soldValue = Σ agreedPrice of Closed Won sales deals` (per currency) |
| Available for sale | units with `dealMode ∈ {sales, both}` in bucket `available`; `availableSalesValue` = Σ `askingPrice` (units lacking a price counted in "n without price") |
| Sales progress | `soldGLA / totalSalesGLA`, denominator printed; "n units without area excluded" note |
| Offers / negotiations / contracts / payments | counts and value by stage group: Offer; Negotiation + Reservation / Deposit; Contract; Payment In Progress + Payment Completed (00_MASTER_PROMPT.md §37 "Sales") |
| Commission status | counts of deals by `outcome.commissionStatus` (Not Applicable / Pending / Received); amounts only for roles with finance rights (`04_ROLES_AND_VISIBILITY.md`) |

Leasing-only fields are never read for sales deals and vice versa (00_MASTER_PROMPT.md §23).

---

## 5. Multi-unit deals and multi-prospect units

### 5.1 Multi-unit deals (00_MASTER_PROMPT.md §6.5, Flow 8)

| Rule | Statement |
|---|---|
| Unique unit IDs | `deal.unitIds` is de-duplicated before any sum; the UI prevents adding the same unit twice |
| Deal area | 3.1: Σ `glaM2` of the unique linked units, or `areaOverrideM2` |
| Inventory | each linked unit keeps its own bucket; the deal contributes once per unit through `qualifies(d)`. A 350 m² deal over UNIT-001 (200) and UNIT-002 (150) puts 350 m² into `underNegotiation` only because those two units are there — the deal itself adds nothing |
| Partial unit | a deal for part of a unit (60 m² of 200 m²) sets `areaOverrideM2 = 60`; `dealArea = 60`; inventory still moves the whole unit (200 m²) to `underNegotiation`; hygiene H-15 flags `areaOverrideM2 > Σ unit areas` (error) and `< 50 %` of Σ (info: "consider splitting the unit"). Recommendation: split the unit in the unit database when the split is contractually agreed (Contract Draft or later), so inventory matches reality |
| Mixed area availability | one linked unit without area ⇒ `dealArea = null` (3.1); no partial totals |
| Won multi-unit deal | on Closed Won every linked unit is expected in `countsAs leased/sold`; a mismatch is hygiene H-05 |

### 5.2 Multi-prospect units (00_MASTER_PROMPT.md §6.4, Flow 7)

| View | Rule |
|---|---|
| Inventory | the unit's `glaM2` is counted once, in one bucket, regardless of the number of open deals |
| Derived stage / display status | highest-ranked open deal (D5); the drawer lists every prospect with its own stage |
| Pipeline | each deal carries its own `dealArea`; the same unit may appear in several deals |
| Required UI wording | next to every deal-based figure: "Deal-based: 650 m² across 3 deals · 350 m² of unique units · units with several prospects appear in each deal" |
| Merchandise mix pipeline | 6.6: by deal brand category, deal-based, same caption |
| Client portal | 11: number of active negotiations on the unit is shown; prospect names only for `client_visible` deals |

---

## 6. Merchandise mix (00_MASTER_PROMPT.md §17)

Categories come from `cfg.merchandiseCategories` (D15 defaults, editable) and are always passed through `normalizeCategory()` (aliases, D21) before grouping, so "F&B", "Food & Beverage" and the CASE OS "Места общественного питания" land in one row. Every mix table has two switches: **basis** (GLA | unit count) and **view** (actual | committed).

### 6.1 Actual mix

| View | Units included | Category taken from |
|---|---|---|
| `actual` (default) | bucket `leased` or `sold` | `unit.actualUse.category` (fallback: `brands[unit.actualUse.brandId].classification.category`; still missing → row "Uncategorised", hygiene H-10) |
| `committed` (optional) | `actual` plus units whose derived stage rank ≥ rank(Contract Draft) (leasing) / rank(Contract) (sales) | for the added units: category of the brand on the highest-ranked qualifying deal |

`actualShare[cat] = actualGLA[cat] / totalGLA` (denominator `totalGLA`, 2.3, so shares read "share of the project"); the remainder row "Not yet let / sold" = `openGLA + unavailableGLA`. A second denominator, `committedGLA` ("share of occupied GLA"), is available as a toggle and is printed with its own denominator. By unit count the same formulas use counts and the denominator is `unitsWithArea + unitsWithoutArea` (units without area *do* count as units, and are listed).

### 6.2 Target mix — source precedence

| Priority | Source | When used |
|---|---|---|
| 1 | `project.merchandiseMix.targets[] = [{category, subcategory?, targetSharePct?, targetGlaM2?, targetUnits?}]` (project-level concept plan, A-07-5; field to be confirmed in `03_DATA_MODEL.md`) | whenever the array is non-empty; `targetGlaM2 = targetSharePct × totalGLA` when only the share is given, and vice-versa (denominator `totalGLA`) |
| 2 | aggregation of `unit.targetUse.category` over all units of the scope: `targetGLA[cat] = Σ glaM2`, `targetUnits[cat] = count` | when no project-level targets exist; also always shown as the row "Planned allocation (from units)" so the two can be compared |

Floors use only source 2 (no floor-level targets in v0.1). Project-level targets whose categories sum to ≠ 100 % ± 1 pp raise hygiene H-11 and the table shows "targets sum to 94 %".

### 6.3 Gaps and thresholds

```text
gapGLA[cat]   = actualGLA[cat] − targetGLA[cat]           (m², committed view uses committedGLA)
gapPp[cat]    = actualShare[cat] − targetShare[cat]        (percentage points, same denominator)
status[cat]   = gapPp >  +cfg.kpi.mixDeviationPp ? 'over'
              : gapPp <  −cfg.kpi.mixDeviationPp ? 'under' : 'on target'
```

Default `mixDeviationPp = 5`. Categories present in targets but absent from actuals are `under` with `actual = 0` (a true zero, because the unit set is complete); categories with target `null` show "no target" and are never classified.

### 6.4 By unit count

Identical formulas on counts; a unit without area is counted here and flagged so a reader can reconcile the two bases ("Services: 1 unit, area unknown").

### 6.5 Open GLA by target category

`vacantGLAByCategory[cat]` = Σ `glaM2` of bucket `available` units grouped by `targetUse.category`; a second column `underNegotiationGLAByCategory[cat]` uses bucket `underNegotiation`. Both are unit-centric (each unit once). Units without a target category form the row "No target category" (hygiene H-10).

### 6.6 Pipeline GLA by category (deal-centric)

`pipelineAreaByCategory[cat]` = Σ `dealArea(d)` over open pre-signature deals grouped by the deal brand's `classification.category` (fallback `deal.requirement.category` via `REQ-`, then "Unknown"). Deal-based caption mandatory (5.2). The comparison table "Target · Actual · Committed · Open · Pipeline (deal-based)" is the basis of the Target vs Actual plan mode (`06_FLOORPLAN_ARCHITECTURE.md`): a unit's plan class is `on target` if `actual/committed category === targetUse.category`, `deviation` if both exist and differ, `open` if no actual, `no target` if `targetUse.category` is empty.

---

## 7. Brand-to-unit matching score (00_MASTER_PROMPT.md §39)

Deterministic, explainable, symmetric: `suggestBrandsForUnit(unitId)` scores every brand against one unit; `suggestUnitsForBrand(brandId)` scores every marketable unit against one brand with the same function `matchScore(brand, unit, ctx)`.

### 7.1 Hard filters (exclude, with reason string)

| # | Filter | Reason string |
|---|---|---|
| F1 | `brand.status ∈ {Refused, Inactive}` | "brand status: Refused" |
| F2 | unit not marketable: `countsAs ∉ {vacant}` (option `includeUnderNegotiation` adds `pipeline`/qualifying units, flagged "already under negotiation") | "unit is not marketable (Occupied)" |
| F3 | `brand.history.rejectedProjectIds` includes `unit.projectId` | "brand rejected this project: <reason>" |
| F4 | `expansionRequirements.targetCities` non-empty and `project.city` not in it (normalised) | "city not in target list" |
| F5 | area known on both sides and `glaM2 < minimumAreaM2 × 0.85` or `> maximumAreaM2 × 1.15` | "area 100 m² outside 150–300 m² (±15 %)" |
| F6 | an open deal already links this brand and this unit | "already in DEAL-004 (Contract Draft)" |
| F7 | `unit.dealMode = sales` and brand has no sales requirement (`commercialModel ≠ purchase`), or vice-versa | "unit is for sale; brand seeks a lease" |

### 7.2 Soft criteria (weights sum to 100)

| Criterion | Points | Rule | Explanation string |
|---|---|---|---|
| Category | 30 | `normalizeCategory(unit.targetUse.category) === normalizeCategory(brand.classification.category)`; unit without target → 0 | "category F&B matches target" / "unit has no target category" |
| Subcategory | 10 | only if category matched and both subcategories equal | "subcategory Café matches" |
| Area fit | 20 / 12 / 0 | within `preferredAreaM2 ± 20 %` → 20; within `[minimumAreaM2, maximumAreaM2]` → 12; area unknown on either side → 0 | "100 m² within preferred 90–120 m²" / "unit area unknown" |
| Floor | 10 / 5 / 0 | `floorPreference` matches `floor.floorNumber` → 10; no preference → 5; mismatch → 0 | "ground floor as preferred" |
| Rent budget | 15 / 8 / 0 | `unit.leasingTerms.askingRent ≤ targetRentRange.max` → 15; `≤ max × 1.1` → 8; else 0; missing → 0 (for sales: `askingPrice` vs budget) | "asking 28 within budget ≤ 30" |
| Frontage | 5 | `unit.geometry.frontageLengthM ≥ frontageRequirement` (both known) | "frontage 8 m ≥ 6 m required" |
| Location type / format | 5 | `preferredLocationType` ∈ `project.assetTypes` (normalised) | "prefers Retail; project is Retail" |
| Mix need | 5 | brand category is `under` in the project's actual mix (6.3) | "F&B is under-represented (−25 pp)" |

Parking, access and accessibility requirements (§39 "accessibility") have no structured unit field in v0.1; their text is appended to the explanation as "check: <accessRequirements>" and is not scored (Q-07-3).

### 7.3 Output

```text
{ brandId, unitId, score: 0–100, band: score ≥ 60 ? 'strong' : score ≥ 40 ? 'possible' : 'weak',
  matched: [strings], unmatched: [strings], excluded: false | reason, warnings: [strings] }
```

Sorted by `score` desc, then `brand.relationship.lastContactDate` desc, then `id` asc (deterministic). Default list shows `possible` and `strong` only; the heading reads "Rule-based suggestions — not a recommendation and not a guarantee" (00_MASTER_PROMPT.md §39). A previous Closed Lost deal between the same brand and unit/project is a warning ("previously lost: rent too high"), not an exclusion.

---

## 8. Completeness indicators (00_MASTER_PROMPT.md §40)

`score = round(100 × filled / applicable)`; `applicable` excludes checks that do not apply (e.g. next action on a closed deal). Bands: ≥ 80 complete, 50–79 partial, < 50 incomplete. Each result lists the missing field keys so the UI can deep-link to them.

| Entity | Check key | Filled when |
|---|---|---|
| Brand | `category` | `classification.category` non-empty |
| Brand | `contacts` | `contactIds.length ≥ 1` and each id exists |
| Brand | `requirements` | (`minimumAreaM2` or `preferredAreaM2`) and (`targetCities.length` or `preferredLocationType`) |
| Brand | `lastContact` | `relationship.lastContactDate` is a valid date |
| Brand | `owner` | `relationship.ownerId` exists in `users` |
| Unit | `area` | `hasArea(u)` |
| Unit | `status` | `commercialStatus` is a configured key other than Unknown |
| Unit | `category` | `targetUse.category`, or `actualUse.category` when bucket is leased/sold |
| Unit | `terms` | leasing/both: `leasingTerms.askingRent`; sales/both: `salesTerms.askingPrice` or `pricePerM2` (both required for `both`) |
| Unit | `polygon` | the current floor plan of `unit.floorId` has a `polygonMappings` entry with this `unitId` (`06_FLOORPLAN_ARCHITECTURE.md`) |
| Deal | `manager` | `ownership.responsibleManagerId` exists |
| Deal | `contact` | `contactIds.length ≥ 1` |
| Deal | `stage` | `stage` is a configured key of the deal's type |
| Deal | `nextAction` | `nextAction.text` and `nextAction.dueDate`; not applicable when closed |
| Deal | `links` | `projectId` exists and `unitIds.length ≥ 1` (a requirement-only opportunity before unit selection is `applicable:false` for units when `stage rank < rank(Property / Unit Offered)`) |
| Deal | `terms` | leasing: any of `agreedRent`, `proposedRent`, `askingRent` on the deal; sales: any of `agreedPrice`, `offerPrice`, `askingPrice`. The unit-level fallback of 3.3 does **not** count |

Project-level indicator: `avg(unit scores)`, plus counts per band; portfolio "missing documents" (00_MASTER_PROMPT.md §33) = deals at rank ≥ LOI / Contract Draft without a document of category LOI / Contract respectively (`document-and-file-registry` rules, `getVisibleDocuments`).

