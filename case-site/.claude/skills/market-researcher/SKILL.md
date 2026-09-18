---
name: market-researcher
description: How the platform's Tashkent office evidence is turned into research output – supply by district, class mix, rent evidence, competitive sets – in CASE's report format with FACTS, ASSUMPTIONS and RECOMMENDATIONS kept apart, and with the coverage gap stated before the finding. Load when asked for a market overview, a district comparison, a competitive study, or any output that leaves the tool as a document.
---

# Market researcher

## Purpose

CASE's research method is source-registered, dated, and denominated. The platform is one source
in that register. This skill produces research output from it that a reader can audit line by
line – and that never claims more than 148 desk-collected records can support.

## Responsibilities

- Produce the standard sections from platform data: supply by district (geometry), class
  distribution with the unknown share stated first, rent evidence with `n of N`, competitive
  sets with the qualified / proximity-only split, data-quality summary (duplicates, entity
  flags, staleness).
- Write in the house format: A) key decisions · B) report-ready text · C) tables · D) risks
  and mitigations · E) required inputs. FACTS from the dataset; ASSUMPTIONS labelled;
  RECOMMENDATIONS separate.
- Cite the platform as a source with its own provenance: `SRC-2GIS-BC`, retrieved 2026-07-19,
  148 records, licence review required, single-source, not field-verified.
- Feed CASE's own methodology (`case-market-research`, `case-methodology`) with platform
  outputs rather than re-deriving catchment or capacity logic inside the map.

## Constraints

1. **Coverage before findings.** Every section opens with what the dataset holds for it.
   "Office class is recorded for 16 of 148" comes before any class-mix statement.
2. **Supply counts are by geometry**, and the ten label conflicts are disclosed because they
   move the ranking: Trilliant (A+, highest rent) sits in Yunusobod by boundary, not in
   Mirzo-Ulugbek as labelled.
3. **The 16 rent observations are evidence, not a benchmark.** Mean 32.22, median 32.30,
   range 19.9–44.7, unweighted, one date, one source. Wording carries all of that.
4. **Unresolved duplicates and suspected non-buildings are stated in the supply section**, with
   counts (12 in 6 groups; 8 flagged), because they change the headline.
5. **All 148 share one collection date.** Staleness cannot discriminate yet; freshness claims
   are not available until a second collection date exists.
6. **No external market commentary enters as fact.** Anything from outside the dataset is
   labelled *external research* with its own source, or *assumption*.
7. **En dash in all output.**

## Validation checklist

- [ ] Every figure in the document maps to an `oracle.py` line or a platform export with its
      `n of N`.
- [ ] The class-mix table lists *Not recorded: 132* as the first row.
- [ ] District supply table notes "by official 2024 boundary; 10 records differ from source
      label".
- [ ] The rent section names the unit, the basis (asking, unweighted), the date and the
      confidence.
- [ ] Section E lists the data the finding could not be made without.

## Examples

**Right.** "Supply by district (n = 148, by 2024 boundary): Mirobod 28, Mirzo-Ulugbek 26,
Yakkasaroy 24, Yunusobod 22 … Bektemir 0, Yangihayot 0. Twelve records sit in six unresolved
possible-duplicate groups; counts may fall by up to six on adjudication."

**Wrong.** "Class A stock is concentrated in the CBD" – class is unknown for 132 of 148.

## Prohibited behaviour

- Market-level claims from a 10.8% coverage field without the coverage in the same sentence.
- Blending platform facts with external commentary under one heading.
- Presenting demo records in any research output.
- Re-implementing CASE's catchment or capacity formulas inside the platform.
