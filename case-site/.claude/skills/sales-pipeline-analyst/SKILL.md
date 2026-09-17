---
name: sales-pipeline-analyst
description: Sales-pipeline rules for LSP (CASE OS Leasing & Sales Platform, os/leasing/): the 16 sales stages, deals with type Sales, sales-only fields (askingPrice, offerPrice, agreedPrice, paymentSchedule, plannedClosingDate, unit.salesTerms), offers, Reservation / Deposit with the Reserved unit status, Payment In Progress / Payment Completed, For Sale / Sold inventory, commissionStatus on sales deals and leasing-only / sales-only / both configuration. Use for tasks mentioning "sales pipeline", "buyer", "offer", "reservation", "deposit", "payment", "sold GLA", "sales-only" or deals with type Sales.
---

## Purpose

Keep the sales pipeline of LSP a separate, correctly modelled workflow beside the leasing pipeline,
as required by `00_MASTER_PROMPT.md` §23 ("Use a separate sales pipeline", "Do not force
leasing-only fields into sales deals"), so that sales deals, For Sale / Sold inventory, offers,
reservations, payments and commission status stay consistent across Kanban, table, floor plan,
dashboard, reports and the client portal without touching CASE OS.

## Responsibilities

- Define the sales stage list exactly as §23 (Lead, Contacted, Qualified Buyer, Requirement Confirmed,
  Property / Unit Offered, Viewing, Offer, Negotiation, Reservation / Deposit, Contract, Payment In
  Progress, Payment Completed, Commission Pending, Commission Received, Closed Won, Closed Lost) as
  `salesStages` config entries in `js/config.js` with rank, default probability, terminal flag and
  `requiresLostReason` (Closed Lost). Lost reasons reuse the shared §22 list.
- Specify which fields a deal with `type: 'Sales'` uses: `commercialTerms.askingPrice`,
  `offerPrice`, `agreedPrice`, `paymentSchedule`, `plannedClosingDate`, `deposit`;
  `outcome.paymentDate`, `outcome.signedDate`, `outcome.commissionStatus`. Leasing-only fields
  (`askingRent`, `proposedRent`, `agreedRent`, `serviceCharge`, `turnoverRent`, `rentFreePeriod`,
  `fitOutPeriod`, `leaseTerm`, `indexation`) stay null and hidden on sales deals.
- Specify the unit side: `unit.salesTerms` (§11: askingPrice, pricePerM2, currentOffer, agreedPrice,
  paymentSchedule, deposit, plannedClosingDate) and the inventory statuses that take part in sales
  (For Sale, Reserved, Sold; `countsAs: 'sold'` for Sold).
- Offers: an offer is a sales deal at stage Offer with `offerPrice`; several buyers on one unit are
  several open sales deals (multi-prospect rule, D6). Recommend deriving the best open offer for
  display instead of hand-maintaining `unit.salesTerms.currentOffer` (raise as Q-n to
  `crm-data-modeler`).
- Reservations: stage Reservation / Deposit with `commercialTerms.deposit`; the unit is set to
  `commercialStatus: 'Reserved'` by an explicit confirmed action; Reserved counts as "Under
  negotiation" in inventory (D6); reservation expiry is tracked as a task (`TASK-001`) with
  `dueDate`, not as a new field.
- Payments: stages Payment In Progress and Payment Completed; `paymentSchedule` is descriptive
  prototype data; `outcome.paymentDate` set at Payment Completed; the unit becomes `Sold` only by an
  explicit confirmed action that writes `statusHistory` and `auditLog`. No payment system, arrears
  or ledgers (§1, §50 future Asset Management).
- Commission status on sales deals: `outcome.commissionStatus` (Not Applicable by default per §24;
  Pending / Received per §38) must agree with stages Commission Pending / Commission Received; Closed
  Won honours the configurable completion condition (§6.6). Amounts and shares belong to
  `commercial-real-estate-financial-analyst`.
- Mode configuration (§23): projects and units can be leasing only, sales only, or leasing and
  sales; field placement is defined in `03_DATA_MODEL.md` (`crm-data-modeler`); this skill requires
  that the flag exists at project and unit level and that deal creation, filters and KPIs read it.
- Define the sales metrics of §33 and §37 (total sales GLA, sold GLA, available units for sale and
  their asking value, offers, negotiations, contracts, payments, commission status, sales pipeline
  by stage) as deal-centric or unit-centric per D6, and label each.
- Supply worked examples and named test cases for `07_CALCULATIONS_AND_KPI_RULES.md` and `10_QA_PLAN.md`.
- Hand-offs: leasing stages and shared stage-change mechanics → `leasing-pipeline-analyst` (reuse
  the same `setDealStage`-style service; do not fork it); pipeline value, price per m2 and commission
  amounts → `commercial-real-estate-financial-analyst`; KPI cards and reports →
  `reporting-and-dashboard-analyst`; status entry definitions (D5 fields) →
  `property-and-unit-data-engineer`; portal whitelist → `client-portal-permissions`.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §1 (no payment system), §6.3–§6.6, §11 (`salesTerms`), §12 (For Sale,
  Sale Negotiation, Sold), §23, §24, §25, §26 (sale price range, commission received/pending),
  §33, §34, §37 (Sales report), §38, §47 (sales deals in demo), §64 Flow 6 analogue, §65.
- `02_REQUIREMENTS_REVIEW.md`, `03_DATA_MODEL.md`, `05_STATUSES_STAGES_AND_CONFIG.md`,
  `07_CALCULATIONS_AND_KPI_RULES.md`, `09_IMPLEMENTATION_PLAN.md`, `10_QA_PLAN.md`,
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`.

LSP sources (`os/leasing/`, once they exist):
- `js/config.js` (`salesStages`, shared `lostReasons`, unit statuses For Sale / Reserved / Sold,
  `clientStatus` mapping), `js/state.js`, `js/services.js` (pure sales queries and metrics),
  `js/tools.js`, `js/views/pipeline.js` (sales tab / Kanban), `js/views/units.js`,
  `js/views/projects.js` (mode flag), `js/views/reports.js` (Sales section), `data/demo.js`
  ("Demo Business Park": leasing AND sales, about 6 sales deals, D4).

CASE OS read-only references (never edited): `os/v32-upgrade.js` (SCR sales module: `sales_assets`
stages `lead / nda / dd / offer / spa / closed / lost`, `investor_requests`), `os/sql/schema_mysql.sql`
(`sales_assets`, `sales_buyers`, `sales_commission_ledger` with `visibility 'own_private'`). This is a
whole-asset investment-sales workflow and is not in the D1 import adapter list; it is out of scope
for LSP v0.1 and mapped only as a future Q-n.

## Outputs

- Config entries in `os/leasing/js/config.js` (`salesStages`, sales participation of unit statuses)
  with no rule embedded in views.
- Pure functions in `os/leasing/js/services.js` (browser `window.LSP`, Node `module.exports`):
  sales pipeline by stage, sales GLA buckets (unit-centric), open offers per unit, reservations and
  payments in progress, commission status counts; names registered in
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` with `ai-tool-designer`.
- Sales demo deals in `os/leasing/data/demo.js`, every record `demoRecord: true`, fictional buyers
  and companies (D4), at least one unit with two competing offers.
- Sales section of `07_CALCULATIONS_AND_KPI_RULES.md` worked examples and `LSP-QA-nnn` test cases
  for `10_QA_PLAN.md` (handed to `testing-and-qa`).
- Chat answers structured as FACTS (cite `00_MASTER_PROMPT.md §n` or the CASE OS file) /
  ASSUMPTIONS (A-n) / RECOMMENDATIONS, with open items as Q-n and an owner.

## Constraints

- D5: sales stages live on `deal.stage`; `unit.commercialStatus` carries only For Sale, Reserved,
  Sold and the other inventory states. On the plan, a marketable unit (For Sale) with an open sales
  deal at or above the threshold shows the derived label; D5 names "Sale Negotiation" as the display
  label for the sales Negotiation stage (label text in config, not code).
- D6: sold GLA and available-for-sale GLA are unit-centric (each unit once); sales pipeline area and
  value are deal-centric and labeled; a unit with two offers is counted once in inventory; a
  multi-unit sales deal uses `dealArea` (unique `unitIds`, `areaOverrideM2`); missing price or area is
  "n/a", never zero, with the excluded count shown.
- §23: separate Kanban and filters for sales; never render leasing fields on a sales deal or sales
  fields on a leasing deal; a unit configured leasing-only cannot receive a sales deal (validate in
  services).
- §3.5 / §53: stage changes never silently change `unit.commercialStatus`, create commission
  records or close deals; confirmed explicit actions only, each written to `statusHistory` and
  `auditLog`.
- §1 / §50: no payment processing, invoicing, arrears, rent roll or accounting logic; payment stages
  are workflow markers with dates and descriptive schedules.
- D7: sales commissions, offer prices, negotiated prices and buyer contacts are `internal` unless
  explicitly `client_visible`; `clientView(projectId)` receives only the whitelisted sales progress
  (sold / reserved / available counts and GLA, approved key deals).
- D1 / D11 / D13: LSP only in `os/leasing/`; CASE OS files untouched; IDs `DEAL-001`, `UNIT-001`,
  `TASK-001`, `SH-001`, `AUD-001`.
- Default probabilities per sales stage are an ASSUMPTION (owner Head of Leasing & Sales), recorded
  in `05_STATUSES_STAGES_AND_CONFIG.md`; not copied from CASE OS.
- Exact vocabulary of the brief and master prompt; no production, backend or security claims.

## Validation checklist

- [ ] `config.js` lists all 16 §23 sales stages in order with rank, probability, terminal flag and
      `requiresLostReason`; Settings can edit them independently of leasing stages.
- [ ] Creating a sales deal on a leasing-only unit or project is rejected in services with a message.
- [ ] Sales deal forms and drawers show only sales fields; leasing fields remain null.
- [ ] Two open offers on one demo unit: inventory counts the unit once; sales pipeline shows two deals
      with the deal-based label; best open offer is displayed and explained.
- [ ] Reservation / Deposit stage plus confirmed "Mark unit Reserved" action produces one
      `statusHistory` entry on the unit and one on the deal; Reserved falls in "Under negotiation".
- [ ] Payment Completed sets `outcome.paymentDate`; marking the unit Sold is a separate confirmed
      action; sold GLA bucket updates on plan, table, dashboard, report and portal.
- [ ] Commission Pending / Commission Received stages agree with `outcome.commissionStatus`; Closed
      Won respects the configurable completion condition (§6.6).
- [ ] Closed Lost on a sales deal requires a lost reason (shared §22 list).
- [ ] §33 / §37 sales metrics show denominators and "n/a" for missing prices or areas.
- [ ] Client portal and client report show no offer prices, negotiated prices, commissions or buyer
      contacts (negative test in `10_QA_PLAN.md`).
- [ ] Node tests of `services.js` cover the sales analogue of Flow 6 and §65 "Pipelines" and
      "Calculations"; test ids `LSP-QA-nnn` registered.
- [ ] No CASE OS file changed; SCR sales module not imported or referenced at runtime.

## Prohibited behavior

- Merging sales stages into the leasing stage list or sharing one Kanban column set.
- Forcing rent fields onto sales deals or price fields onto leasing deals (§23).
- Storing stage, offers or "reserved" flags on the unit beyond `commercialStatus` and
  `salesTerms`; storing derived best-offer values without marking them derived.
- Building payment schedules that compute instalments, arrears, interest or invoices; calling the
  prototype a payment or accounting system.
- Silently setting units to Reserved or Sold, or creating commission records, on stage change.
- Counting a unit as both sold and under negotiation, or a unit with several offers more than once
  in inventory.
- Treating missing price, area or probability as zero; hiding denominators.
- Inventing price per m2, absorption or buyer benchmarks; presenting CASE OS SCR sales data or
  stages as LSP defaults.
- Editing `os/core.js`, `os/v32-upgrade.js`, `os/sql/`, `os/api/`; adding backend or network calls.

## Examples

1. Prompt: "Add the sales Kanban next to the leasing Kanban in views/pipeline.js."
   Expected: a second column set built from `config.salesStages`, filtered to `type: 'Sales'`,
   reusing the shared stage-change service and drag/drop history rule; sales-only fields on the
   card; §26 filters including sale price range and commission received/pending; no duplicate store.
2. Prompt: "A buyer paid the deposit for Unit B-104 in Demo Business Park; update the demo data."
   Expected: the matching demo deal moved to Reservation / Deposit with `deposit` and
   `dateEnteredStage`, a `statusHistory` entry, the unit set to Reserved through the explicit action
   with its own history entry, a reservation-expiry task, and a note that inventory now shows the
   unit under negotiation and portal shows the configured client status only.
3. Prompt: "Which sales KPIs belong on the project dashboard and how are they computed?"
   Expected: FACTS from §33 / §37 (sales GLA, sold GLA, available units and asking value, pipeline
   by stage, commission status), unit-centric vs deal-centric labels per D6, denominators, missing
   value behaviour, a hand-off to `commercial-real-estate-financial-analyst` for pipeline value and
   to `reporting-and-dashboard-analyst` for card layout, and Q-n items with owners.
