---
name: leasing-pipeline-analyst
description: Leasing-pipeline rules for LSP (CASE OS Leasing & Sales Platform, os/leasing/): the 16 leasing stages with rank and probabilities in config, dateEnteredStage and statusHistory writes, mandatory lost reasons on Closed Lost, derived unit pipeline stage, deal-centric pipeline metrics (pipeline GLA by stage and manager, stage aging, conversion, stale deals) and anti-double-counting for multi-prospect units and multi-unit deals. Use for tasks mentioning "leasing pipeline", "deal stage", "Kanban", "stage history", "lost reason", "pipeline GLA", "stale deal", "conversion" or deals with type Leasing.
---

## Purpose

Make every engineering agent that touches leasing deals in LSP apply the same stage, history and
pipeline-metric rules, so that `os/leasing/js/services.js`, `js/config.js`, `data/demo.js` and the
pipeline views satisfy `00_MASTER_PROMPT.md` §6.3–§6.6, §21–§22, §24–§26, §33–§34, §41, §65 and the
brief decisions D5 (unit status vs deal stage) and D6 (anti-double-counting) without modifying CASE OS.

## Responsibilities

- Define the leasing stage list exactly as `00_MASTER_PROMPT.md` §22 (Lead, Contacted, Qualified,
  Requirement Confirmed, Property / Unit Offered, Viewing Scheduled, Viewing Completed, Negotiation,
  LOI / Commercial Terms, Contract Draft, Contract Signed, Tenant Handover / Opening Preparation,
  Commission Pending, Commission Received, Closed Won, Closed Lost) as config entries in `js/config.js`
  with rank, default probability, terminal flag and `requiresLostReason` (Closed Lost only).
- Specify stage-transition behaviour on `deals` with `type: 'Leasing'`: set `dateEnteredStage`, write a
  `statusHistory` entry (`SH-001` format, field names per `03_DATA_MODEL.md`) carrying previous stage,
  new stage, timestamp, acting user and `outcome.lostReason` when the new stage is Closed Lost; write an
  `auditLog` entry (`AUD-001`) for stage changes and lost/won outcomes.
- Enforce the lost-reason rule: Closed Lost requires one of the §22 reasons (rent too high, wrong
  location, area too large, area too small, project timing, competitor selected, internal brand
  decision, no response, terms rejected, other), editable in Settings (§44).
- Own the derived unit pipeline stage (D5): highest-ranked stage among OPEN deals linked to the unit,
  computed in services, never stored on `unit`.
- Own deal-centric pipeline metrics (D6): `dealArea` (sum of `area.glaM2` over the deal's unique
  `unitIds`, or `deal.areaOverrideM2` when set), `calculatePipelineGLA()`, `getDealsByStage()`,
  `getDealsWithoutNextAction()`, pipeline by responsible manager, stage aging from `dateEnteredStage`,
  stage-to-stage conversion from `statusHistory`, stale deals per `staleThresholds` in config.
- Define the Kanban / Table / Floor-plan views as three renderings of the same `appState.deals`
  (§25); Kanban drag/drop only if it records history.
- Define pipeline filters and chips from §26 (stage, deal type, responsible manager, next action date,
  overdue, lost reason, signed/unsigned, commission received/pending).
- Supply worked examples and test vectors for `07_CALCULATIONS_AND_KPI_RULES.md` and `10_QA_PLAN.md`.
- Hand-offs: sales stages, offers, reservations and payments → `sales-pipeline-analyst`; annualised
  rent, weighted pipeline value and commission amounts → `commercial-real-estate-financial-analyst`;
  inventory buckets `calculateLeasedGLA()` / `calculateVacantGLA()` and KPI cards →
  `reporting-and-dashboard-analyst`; deal/statusHistory schemas → `crm-data-modeler`; tool
  registration in `js/tools.js` → `ai-tool-designer`; Playwright scripts → `testing-and-qa`.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §6.3–§6.6, §21, §22, §24, §25, §26, §27, §33, §34, §37 (Leasing report),
  §40 (deal completeness), §41, §52, §64 Flows 6–8, §65 "Pipelines" and "Calculations".
- `02_REQUIREMENTS_REVIEW.md` (resolved contradictions), `03_DATA_MODEL.md` (deal, statusHistory,
  auditLog fields), `05_STATUSES_STAGES_AND_CONFIG.md` (stage config schema, threshold, lost reasons),
  `07_CALCULATIONS_AND_KPI_RULES.md` (formulas and worked examples), `09_IMPLEMENTATION_PLAN.md`,
  `10_QA_PLAN.md`, `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (tool names).

LSP sources (`os/leasing/`, once they exist):
- `js/config.js` (`DEFAULT_CONFIG` leasing stages, lost reasons, stale thresholds, negotiation
  threshold), `js/state.js` (ID generation, statusHistory and auditLog writers), `js/services.js`
  (pure functions; the only place for pipeline math), `js/tools.js`, `js/views/pipeline.js`,
  `js/views/dashboard.js`, `js/views/units.js` (derived stage display), `data/demo.js`.

CASE OS read-only references (never edited): `os/core.js` (`STAT`, `COMM_PROB` at the line
defining `neg:20,off:40,os:65,cs:85,res:50,cd:100`), `os/sql/schema_mysql.sql` (`deals`,
`deal_actions`, `deal_stage_probabilities` seed `neg 20 / off 40 / res 35 / os 65 / cs 85 / cd 100`).

## Outputs

- Pure functions in `os/leasing/js/services.js` attached to `window.LSP` in browsers and
  `module.exports` in Node (D10); the §52 names `getDealsByStage`, `getDealsWithoutNextAction`,
  `calculatePipelineGLA` are mandatory, helper names are proposals to be registered in
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`.
- Config entries in `os/leasing/js/config.js` (`leasingStages`, `lostReasons`, `staleThresholds`,
  negotiation threshold stage) with no business rule left inside rendering code.
- Demo leasing deals in `os/leasing/data/demo.js` (D4: about 25 leasing deals across stages, one unit
  with 3 prospects, one deal spanning 2 units, every record `demoRecord: true`).
- Worked examples (inputs, expected numbers, denominator) for `07_CALCULATIONS_AND_KPI_RULES.md` and
  named test cases `LSP-QA-nnn` for `10_QA_PLAN.md`; Node assertions handed to `testing-and-qa`.
- Chat answers structured as FACTS (cite `00_MASTER_PROMPT.md §n` or the CASE OS file) /
  ASSUMPTIONS (A-n) / RECOMMENDATIONS, with open items as Q-n and an owner.

## Constraints

- D5: `unit.commercialStatus` holds inventory states only (Vacant, Available, Active Marketing,
  Reserved, Contract Signed, Fit-out, Occupied, For Sale, Sold, Temporarily Blocked, Not Available,
  Unknown). Stage lives on `deal.stage`. Display status shows the derived stage label only when the
  unit is marketable (Available / Active Marketing / For Sale) and an open deal is at or above the
  configurable threshold (default Negotiation).
- D6: inventory metrics are unit-centric (each unit's GLA once); pipeline metrics are deal-centric and
  labeled "deal-based; units with several prospects appear more than once". Missing area is never
  zero: exclude the unit and report "n units without area". Multi-unit deals never inflate inventory.
- Only deals with `status: 'Open'` feed derived stage and pipeline area; Closed Won / Closed Lost are
  reported separately (signed deals, lost reasons). Post-signing stages (Contract Signed to Commission
  Received) never count as "under negotiation".
- §6.6 / §22: a deal is not financially complete until configured commission conditions are met;
  the condition is a config flag, never hard-coded. Stage Commission Pending / Commission Received must
  agree with `outcome.commissionStatus`.
- §3.5 no hidden state: a stage change never silently rewrites `unit.commercialStatus`; any coupling
  (e.g. Contract Signed → unit Contract Signed) is an explicit, confirmed, logged action. CASE OS
  auto-creating a commission deal on the `cd` transition (`os/core.js`) is a precedent NOT to copy.
- D7: `deal.visibility` defaults to `internal`; commissions, proposed/negotiated terms and internal
  notes never reach `clientView(projectId)`. Portal shows only the configured `clientStatus` mapping.
- D1 / D11: do not modify `os/core.js`, `os/index.html`, `os/sw.js`, PHP or SQL; LSP lives in
  `os/leasing/`, IDs follow D13 (`DEAL-001`, `SH-001`, `AUD-001`, `UNIT-001`).
- Default probabilities are not given by the master prompt: any default table is an ASSUMPTION to be
  confirmed by the Head of Leasing & Sales and recorded in `05_STATUSES_STAGES_AND_CONFIG.md`. The
  CASE OS seeds are a 7-stage model and are internally inconsistent (`res` 35 in SQL vs 50 in
  `core.js`), so they are not copied.
- CASE OS import (D1 split rule, stage side only; adapter implementation belongs to
  `property-and-unit-data-engineer` / `local-storage-and-import-export`): `vac` → Available, no deal;
  `neg` → open deal at Negotiation; `off` → LOI / Commercial Terms; `os` → Contract Draft; `cs` →
  Contract Draft; `cd` → unit Contract Signed + deal Contract Signed; `res` → unit Reserved + open
  deal at Negotiation; `vars[]` → additional prospects at Lead. Present as RECOMMENDATION until
  approved in `03_DATA_MODEL.md`.
- Use the exact vocabulary of the brief and master prompt; no production, backend or security claims.

## Validation checklist

- [ ] `config.js` lists all 16 §22 stages in order with rank, probability, terminal flag,
      `requiresLostReason`; Settings can edit stages and lost reasons (§44).
- [ ] Every stage change sets `dateEnteredStage`, appends a `statusHistory` entry and an `auditLog`
      entry; Kanban drag/drop, table edit and drawer edit all go through the same service function.
- [ ] Moving to Closed Lost without a lost reason is rejected in services (not only in the UI).
- [ ] Derived unit stage equals the highest-ranked OPEN deal stage; closing a deal updates it.
- [ ] `dealArea` deduplicates `unitIds`, honours `areaOverrideM2`, excludes units without area and
      returns the count of excluded units.
- [ ] Demo unit with 3 prospects: inventory counts its GLA once; pipeline-by-stage shows it up to 3
      times and the label says so.
- [ ] Demo deal spanning 2 units: `dealArea` equals the sum of both units; inventory buckets classify
      each unit individually.
- [ ] Pipeline GLA / counts / aging show "n/a" and a note when inputs are missing; never 0.
- [ ] `getDealsWithoutNextAction`, stale deals and overdue follow-ups use `staleThresholds` from
      config and appear on the dashboard (§27, §33).
- [ ] Filters and chips from §26 work on Kanban and Table; Reset All clears them.
- [ ] Node tests of `services.js` cover Flows 6–8 and §65 "Pipelines" and "Calculations"; test ids
      `LSP-QA-nnn` are listed in `10_QA_PLAN.md`.
- [ ] No CASE OS file changed (`git status` shows only `os/leasing/`, `docs/leasing-platform/`,
      `docs/qa/lsp/`, `docs/qa/tools/lsp_*.js`, `.claude/skills/`).

## Prohibited behavior

- Storing stage, probability or "under negotiation" flags on `unit`; reusing a single field for
  inventory state and deal stage (CASE OS `STAT` pattern).
- Summing deal areas into inventory KPIs, or unit areas per deal into "leased GLA".
- Treating missing area, probability or dates as zero.
- Hard-coding stage names, probabilities, colours or lost reasons inside views.
- Silently changing `unit.commercialStatus`, creating commission records or closing deals as a side
  effect of a stage change.
- Reporting Closed Won as pipeline, or post-signing stages as negotiation.
- Inventing default probabilities, conversion benchmarks or "typical" stage durations and presenting
  them as facts; copying CASE OS seeds without labeling them as a precedent.
- Editing `os/core.js`, `os/v*.js`, `os/sql/`, `os/api/`; adding backend, LLM or network calls.
- Writing sales-stage logic, money formulas or commission amounts (belongs to the sister skills).

## Examples

1. Prompt: "Implement stage changes for leasing deals in services.js with history."
   Expected: one `setDealStage(dealId, stageKey, ctx)` style service that validates the stage against
   `config.leasingStages`, rejects Closed Lost without `lostReason`, sets `dateEnteredStage`, appends
   `statusHistory` and `auditLog`, sets `outcome.won/lost`, and returns the updated deal; Kanban,
   table and drawer call it; Node assertions for the reject path and the history entry.
2. Prompt: "Pipeline GLA by stage looks too high on Demo City Mall."
   Expected: FACTS (deal-based metric per D6; unit with 3 prospects appears 3 times), check that the
   label is present, compare with the inventory "Under negotiation" bucket (unique units), report
   units without area, and propose no change to inventory math; open a Q-n only if a real defect.
3. Prompt: "Write the stage-aging and conversion section of 07_CALCULATIONS_AND_KPI_RULES.md."
   Expected: formulas (days in stage from `dateEnteredStage`; conversion = deals that reached stage k /
   deals that reached stage k-1, from `statusHistory`, per period), a worked example from the demo
   dataset with the denominator shown, missing-data behaviour, and an ASSUMPTION note for default
   probabilities with owner Head of Leasing & Sales.
