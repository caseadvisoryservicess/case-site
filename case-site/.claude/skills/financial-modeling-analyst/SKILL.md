---
name: financial-modeling-analyst
description: Where finance sits in the Geoanalytics platform – which figures the dataset can support today (asking rent per property), which it cannot (NOI, cap rate, value, absorption), and how a future feasibility layer must be fed. Load before adding any financial metric, before any "what is this worth" question, and when connecting the platform to CASE's feasibility work.
---

# Financial modelling analyst

## Purpose

The platform's job is to supply *evidence* to a feasibility model, not to be one. This skill
keeps the boundary sharp: what a location-intelligence dataset with 16 rent observations may
say, and what it must hand off to a proper model with proper inputs.

## Responsibilities

- Define the finance-adjacent fields and their units: `askingRent` USD/m²/month per property,
  `serviceCharge`, `vatTreatment` (inclusive / exclusive / unknown), `availableArea`,
  `minUnit`, `leaseTerms`. Asking is not achieved; headline is not effective.
- State what a feasibility model needs from this platform and in what form: rent evidence
  with `n`, `N`, date and confidence per observation; supply counts by district by geometry;
  competitive set with qualified / proximity-only split; coverage gaps named.
- Route real modelling to the tools built for it (CASE's feasibility method; the
  `creating-financial-models` skill for DCF, sensitivity, scenario work) with the platform's
  evidence attached – never inline it in the map.

## Constraints

1. **Nothing here is a valuation input without a stated basis.** 16 of 148 asking rents, one
   collection date, single source, unverified: that is a lead list, not a rent roll.
2. **No derived financials from missing inputs.** NOI needs income and opex; cap rate needs NOI
   and value; absorption needs take-up over time. None of these exist in the dataset. Any such
   figure would be a fabrication with two decimal places.
3. **Rent evidence is reported unweighted per property** until GLA is recorded. Weighting by
   size with 0/148 GLA is invention.
4. **VAT treatment is `unknown` until recorded.** A rent whose VAT basis is unknown cannot be
   compared with one whose basis is known; the comparison table must say so.
5. **Currency is USD as recorded; no FX conversion inside the platform.** UZS quotes are stored
   as quoted with their currency; conversion is the model's job with a dated rate.
6. **Sensitivity belongs in the model, not the map.** The platform can list what would change
   the answer (more rent observations, GLA, vacancy); it does not run the scenarios.
7. **Every number handed to a model carries its provenance profile.** The model's source
   register can then cite the platform record, its source and its date.

## Validation checklist

- [ ] Any rent figure on screen or in an export shows `n of N`, the collection date, and the
      unit `USD/m²/month`.
- [ ] No metric named NOI, yield, cap rate, value, absorption, or payback exists in
      `08-analytics.js`.
- [ ] Export headers state "asking rent, unweighted per property, single source, unverified".
- [ ] `docs/05-analytics-rules.md` lists the deferred financial metrics with their required
      inputs.

## Examples

**Right.** Handing a feasibility model: "Comparable asking rents within 3 km of the site:
$31.2 /m²/month unweighted, n = 11 of 74, collected 19 Jul 2026, single map-service source,
confidence Medium. VAT basis unknown for all 11."

**Wrong.** "Implied value at a 9% cap rate: $X" – there is no NOI to capitalise.

**Wrong.** Converting the 16 asking rents into an "effective rent index".

## Prohibited behaviour

- Any valuation, yield, or return figure computed inside the platform.
- Treating asking rent as achieved rent.
- Presenting a single-date, single-source sample as a market rent level.
- FX conversion without a dated, cited rate.
