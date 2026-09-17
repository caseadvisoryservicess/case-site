---
name: commercial-real-estate-financial-analyst
description: Rent, price and money rules for LSP (CASE OS Leasing & Sales Platform, os/leasing/): leasingTerms, salesTerms and commercialTerms fields, rentUnit and currency handling, annualised rent, value-basis precedence, weighted pipeline value = basis x stage probability, configurable commission rules and record, sensitivities, n/a-not-zero, visible denominators; never invents market rents, yields or FX rates. Use for tasks mentioning "annualised rent", "pipeline value", "weighted pipeline", "commission rule", "currency", "FX", "VAT", "rent-free", "effective rent", "sensitivity" or "price per m2".
---

## Purpose

Give engineering agents one consistent, source-cited way to turn LSP commercial fields into
monetary metrics (annualised rent, pipeline value, weighted pipeline, commission amounts and
status) that follow `00_MASTER_PROMPT.md` §6.6, §11, §24, §33–§34, §37–§38, §44 and brief decision
D6, while keeping every number traceable to platform data or a labeled assumption.

## Responsibilities

- Define the money fields and their meaning: `unit.leasingTerms` (askingRent, agreedRent, currency,
  rentUnit default `USD/m2/month`, serviceCharge, vatTreatment default `Unknown`, turnoverRent,
  rentFreePeriod, fitOutPeriod, deposit, leaseTerm, indexation, leaseStart, leaseExpiry),
  `unit.salesTerms` (askingPrice, pricePerM2, currentOffer, agreedPrice, paymentSchedule, deposit,
  plannedClosingDate) and `deal.commercialTerms` (§24: askingRent, proposedRent, agreedRent,
  serviceCharge, turnoverRent, deposit, rentFreePeriod, fitOutPeriod, leaseTerm, indexation,
  askingPrice, offerPrice, agreedPrice, paymentSchedule, plannedClosingDate).
- Annualisation: with `rentUnit = USD/m2/month`, monthly rent = rate × `area.glaM2` of the unit (or
  `dealArea` for a deal) and annualised rent = monthly × 12; other `rentUnit` values listed in config
  `units` (§44) convert explicitly; a rent whose unit is unknown is not annualised (n/a).
- Value basis per deal (RECOMMENDATION, record in `07_CALCULATIONS_AND_KPI_RULES.md`): leasing
  `agreedRent` > `proposedRent` > `askingRent`; sales `agreedPrice` > `offerPrice` > `askingPrice`;
  the chosen basis is returned with the number so the UI can label it.
- `calculatePipelineValue()` (§52) and weighted pipeline (D6): Σ over deals with `status: 'Open'` of
  (annualised rent or price basis) × probability / 100, where probability = `deal.probability` if
  set, else the stage default from `leasingStages` / `salesStages` config; deals without a basis or
  probability are excluded and counted ("n deals without value").
- Price per m2 for sales: price basis / `dealArea` or `area.glaM2`; derived, never stored as truth
  next to a stored `pricePerM2` without saying which one is shown.
- Commission model (§38): commission record fields grossCommission, invoiceDate,
  expectedPaymentDate, receivedAmount, receivedDate, status (Pending / Received), companyShare,
  managerShare, externalAgentShare, administratorShare, notes; `commissionRules` in config
  (§44): base method (one monthly rent, percent of annual rent, fixed, manual), default percent,
  share table that must sum to 100 % of gross, and the §6.6 flag "commission receipt required for
  Closed Won". Amount = f(base method, annualised rent or agreed price); shares = gross × share.
- Currency: USD is the working currency of the demo data; UZS or other currencies display through
  an FX rate stored in settings with date and source label, never a constant in code; sums never
  mix currencies without conversion; store raw values, round on display.
- VAT and service charge: `vatTreatment` is shown next to every rent figure (incl. / excl. /
  Unknown); VAT is never added or removed silently; service charge is reported separately from
  rent, not folded into annualised rent.
- Sensitivities (prototype only): what-if tables from platform data (rent ±10 %, probability shift,
  rent-free months against `leaseTerm`) labeled "scenario, not forecast"; effective rent over term is
  computed only when `leaseTerm` and `rentFreePeriod` are present.
- Hand-offs: which deals are open, stage ranks and default probabilities →
  `leasing-pipeline-analyst` / `sales-pipeline-analyst`; KPI card layout, charts (inline SVG, D14)
  and report sections → `reporting-and-dashboard-analyst`; schema placement of a commission record →
  `crm-data-modeler`; role gating of finance fields → `client-portal-permissions`; market data,
  benchmarks and brand rent budgets → `brand-and-market-researcher` with sources.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §6.6, §9 (`commercial`, `areas`), §11, §22 (financial completion), §24,
  §26 (rent / sale price ranges), §31 (client never sees commissions; head_ls sees permitted
  commissions), §33, §34, §37, §38, §44, §52, §65 "Calculations".
- `03_DATA_MODEL.md`, `04_ROLES_AND_VISIBILITY.md`, `05_STATUSES_STAGES_AND_CONFIG.md`
  (commission rules, currencies, units), `07_CALCULATIONS_AND_KPI_RULES.md`,
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md`.

LSP sources (`os/leasing/`, once they exist):
- `js/config.js` (`commissionRules`, `currencies`, `units`, stage probabilities), `js/services.js`
  (all money math lives here, pure, no DOM), `js/tools.js` (`calculatePipelineValue`),
  `js/views/pipeline.js` (Deal Detail commercial block), `js/views/units.js` (drawer Commercial),
  `js/views/reports.js`, `js/views/settings.js`, `data/demo.js`.

CASE OS read-only references (never edited, precedents only): `os/v326-commission-engines.js`
(`baseMethod` `manual | one_month | annual_percent | fixed`, `annualPercent` 8, `needsAshConfirmation`,
a stored `fxRate`), `os/v496-commissions.js`, `os/sql/schema_mysql.sql` (`lease_commission_deals`:
monthly_rent, annual_rent, term_months, commission_base, payment_status; `commission_rules`:
default_share, close_share, floor_share, building_share; `commission_ledger`: weighted_bonus,
lost_bonus), `os/core.js` `COMM_PROB`.

## Outputs

- Pure functions in `os/leasing/js/services.js` (browser `window.LSP`, Node `module.exports`):
  annualised rent, value basis, `calculatePipelineValue`, weighted pipeline, price per m2,
  commission amount and shares, currency conversion helper; every function returns `null` plus an
  exclusion count for missing inputs, never 0.
- `commissionRules`, `currencies`, `units` entries in `os/leasing/js/config.js`, editable in
  Settings.
- Money sections of `07_CALCULATIONS_AND_KPI_RULES.md`: formulas, precedence, worked examples from
  the demo dataset with denominators, missing-data behaviour.
- Demo commercial terms and commission records in `os/leasing/data/demo.js` (fictional, plausible
  only as round numbers, `demoRecord: true`; no real project rents).
- `LSP-QA-nnn` test vectors for `10_QA_PLAN.md` (handed to `testing-and-qa`).
- Chat answers structured as FACTS (cite `00_MASTER_PROMPT.md §n` or the CASE OS file) /
  ASSUMPTIONS (A-n) / RECOMMENDATIONS, open items as Q-n with owner.

## Constraints

- D6: weighted pipeline = Σ (annualised rent or agreed price) × stage probability; pipeline value is
  deal-centric and labeled; inventory GLA is not a money metric and stays unit-centric; missing
  values are never zero; denominators and the value basis are visible.
- §6.6: commission receipt as completion condition is a config flag; no permanent hard-coded rule.
- §38 / §31 / D7: commission amounts, shares, invoice and payment data, proposed and negotiated
  terms are `internal` or `restricted`; `clientView(projectId)` never carries them; `founder_admin`
  sees all, `head_ls` sees permitted commissions, other roles per `04_ROLES_AND_VISIBILITY.md`.
- §44: base method, percents, shares, currencies and units are config; rendering reads config only.
- No market data: no benchmark rents, cap rates, yields, absorption, price per m2 for any city, and
  no FX rate typed as a literal; CASE OS `BENCH` and the proprietary brand base are not imported in
  v0.1 (not in the D1 adapter list). Anything not in `appState` or the user's cited source is
  "unavailable information" (§53).
- No NPV, IRR, DCF, rent roll, NOI, budgets or arrears (§3.6, §50 future Asset Management); simple
  arithmetic scenarios only, labeled prototype.
- CASE OS precedents (v326 base methods, 25 / 20 / 15 / 5 / 5 share chips, `default_share` 30) are
  cited as facts about CASE OS, not adopted as LSP defaults without an ASSUMPTION label and owner
  (Founder / product sponsor for commission policy).
- D1 / D11 / D13: LSP only in `os/leasing/`; CASE OS untouched; IDs `DEAL-001`, `UNIT-001`, `AUD-001`.
- Exact vocabulary of the brief and master prompt; no production, backend, accounting or security
  claims; no model identifiers or session links in repository files.

## Validation checklist

- [ ] Annualised rent for a demo unit equals rate × glaM2 × 12 under `USD/m2/month`; a unit with
      another `rentUnit` converts explicitly or returns n/a with a note.
- [ ] Value basis precedence is implemented once in services and the returned label matches the
      field actually used.
- [ ] `calculatePipelineValue` covers Open deals only, uses `deal.probability` or the config stage
      default, excludes deals without basis or probability and returns their count.
- [ ] Weighted pipeline for the demo dataset reproduces the worked example in
      `07_CALCULATIONS_AND_KPI_RULES.md` to the cent.
- [ ] A multi-unit demo deal uses `dealArea`; a multi-prospect unit contributes its area to each
      deal's value but once to inventory.
- [ ] Commission amount follows the configured base method; shares sum to 100 %; changing rules in
      Settings changes results without code edits; §6.6 flag toggles Closed Won eligibility.
- [ ] Every rent figure in UI and reports shows currency, `rentUnit` and `vatTreatment`; service
      charge is separate.
- [ ] Mixed-currency sums are refused or converted through the stored FX rate with its date shown.
- [ ] Client portal and client report render no commission, share, proposed or negotiated value
      (negative test listed in `10_QA_PLAN.md`).
- [ ] No literal market figure, FX rate or benchmark appears in `services.js`, `config.js` or
      `demo.js` beyond fictional demo terms marked `demoRecord: true`.
- [ ] Node tests in `docs/qa/tools/lsp_*.js` cover §65 "pipeline value is correct", "missing values
      do not become zero", "denominators are visible".
- [ ] No CASE OS file changed.

## Prohibited behavior

- Inventing or "estimating" market rents, prices, yields, cap rates, occupancy norms, absorption or
  FX rates; presenting demo numbers as market evidence.
- Treating null rent, price, area or probability as 0; summing values across currencies or rent
  units without conversion; hiding the value basis or denominator.
- Folding service charge, VAT, turnover rent or deposits into annualised rent.
- Hard-coding commission percents, shares, base methods or the completion condition in views or
  services; auto-creating commission records on stage change.
- Exposing commission, share, invoice or negotiated-term data to `client` sessions, reports or
  `clientView` output.
- Building DCF, NPV, IRR, rent roll, arrears, invoicing or accounting logic in v0.1.
- Copying CASE OS commission engine values as LSP defaults without an ASSUMPTION label.
- Editing `os/core.js`, `os/v326-commission-engines.js`, `os/v496-commissions.js`, `os/sql/`,
  `os/api/`; adding backend, LLM or network calls.
- Deciding stage lists, stage ranks, offer/reservation workflow or KPI layout (sister skills).

## Examples

1. Prompt: "Implement calculatePipelineValue in services.js."
   Expected: a pure function taking `appState` and an optional filter, applying value-basis
   precedence, annualisation through `rentUnit`, `dealArea` for area-based rents, probability from
   deal or stage config, returning `{ total, weighted, currency, dealsCounted, dealsExcluded,
   basisBreakdown }`; Node assertions against the `07_CALCULATIONS_AND_KPI_RULES.md` worked example.
2. Prompt: "Set up commission rules so the founder can change the split without code."
   Expected: `commissionRules` in `config.js` (base method, percent, share table, completion flag),
   a Settings form, a services function producing the §38 record from a deal, the sum-to-100 %
   validation, `internal` visibility, and an ASSUMPTION note that default percents need the
   Founder's confirmation; CASE OS v326 cited only as precedent.
3. Prompt: "What is the effective rent if we give 3 months rent-free on a 5-year lease at 25
   USD/m2/month for Unit F1-012?"
   Expected: FACTS from the unit and deal record (area, rentUnit, vatTreatment), the arithmetic
   (annual rent, total rent over 60 months minus 3 months, effective monthly rate), labeled
   "scenario, not forecast", excl./incl. VAT stated, and no comparison to market rents unless the
   user supplies a cited source.
