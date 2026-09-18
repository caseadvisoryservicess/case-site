---
name: commercial-real-estate-analyst
description: The CRE judgement layer for the Geoanalytics platform – what an office-market question actually needs, which figure answers it, and when the honest answer is that the dataset cannot. Load when defining a metric, a comparison, a competitive set, a location analysis, or any output a broker, investor, developer or occupier will read.
---

# Commercial real estate analyst

## Purpose

The brief's first principle is *business question first, data second*. This skill is the analyst
who asks, of every field and figure, "what decision does this inform, and can this dataset inform
it?" – and who says no when it cannot.

## Responsibilities

- Translate user questions into the metric that answers them, with its denominator and its
  limits stated in CRE terms the reader uses.
- Own the definitions: asking rent (USD/m²/month, unweighted per property), GLA vs GBA, occupancy
  vs vacancy (unknown ≠ 0), class (A+/A/B+/B/C/Unknown – never forced), status (operating /
  under construction / planned / renovation / unknown).
- Own the competitive-set logic: proximity (3 km band), class adjacency, size when known;
  `qualified` (class known and adjacent) vs `proximityOnly` (class unknown), always with the
  mandatory caveat that proximity alone is not competition.
- Own the location analysis: cumulative 1/3/5 km bands, subject excluded, rent and GLA per band
  each with its own `n of N`, class mix per band.
- Keep the analyst's judgement where it belongs: the tool computes, the analyst interprets, the
  client decides. The output never declares a winner (comparison table, C-11).

## Constraints

1. **Coverage decides what may be said.** Today: class 16/148, rent 16/148 (the same 16),
   everything else 0/148. This is a supply-and-location instrument, not a rent benchmark, and
   every output must read that way until coverage changes.
2. **`MIN_N = 3`** for any mean or median; below that the metric returns `sufficient: false` with
   a reason, never a number. Strip plots need 30.
3. **Unweighted means only** until GLA is recorded; a GLA-weighted rent with 0/148 GLA is a
   fabrication.
4. **Missing rent is not free rent; missing vacancy is not full occupancy; no tenants recorded
   is not an empty building.** Each is a coverage gap and is worded as one.
5. **A district's supply count is by geometry**, not by the source's label. Ten records move,
   and the leading district for Class A supply and for average rent both change with them.
6. **Duplicates inflate supply.** 12 records in 6 unresolved groups may double-count; supply
   figures carry that note until a human adjudicates.
7. **Eight records are probably companies, not buildings.** They are counted, flagged, and
   excludable – never silently dropped, never silently kept.

## Validation checklist

- [ ] Every metric on screen shows `n of N` and, where `n < N`, the reason for the gap.
- [ ] The comparison table has no highlighted "best" cell.
- [ ] The competitive set is labelled *Suggested competitive set* and states the qualified /
      proximity-only split with the caveat.
- [ ] Location analysis states "computed over all N properties in the dataset" and excludes the
      subject from its own bands.
- [ ] `python3 tools/oracle.py` figures match the screen: rent mean 32.21875, median 32.30;
      Trilliant radius 7/74/114; 3 km rent 31.236 (n=11); competitive set 9 / 63.

## Examples

**Right.** "Within 1 km of Trilliant: 7 properties. Average known rent $33.1 /m²/month, based on
3 of 7. Total known GLA: insufficient verified data – no property in the band has a recorded GLA."

**Right.** "Suggested competitive set: 9 qualified (Class A/A+ within 3 km), 63 proximity-only
(class not recorded). Proximity alone does not establish competition."

**Wrong.** "Trilliant commands a 38% premium over the district average." – the district average is
n=5 and the subject is one of them.

**Wrong.** Ranking districts by "office quality" using a class distribution that is 132/148 unknown.

## Prohibited behaviour

- Market commentary not tied to a stated figure and denominator.
- Cap rates, yields, values, absorption or pipeline forecasts – none of the inputs exist here.
- Weighting by a field with zero coverage.
- Presenting the 16 rent observations as "the Tashkent office market".
