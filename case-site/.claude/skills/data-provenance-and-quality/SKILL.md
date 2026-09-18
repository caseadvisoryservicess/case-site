---
name: data-provenance-and-quality
description: The rules every value in the Geoanalytics dataset must obey – never fabricate, unknown is never zero, every important field carries traceable provenance, nothing merges without a human verdict. Load before touching data/seed.json, tools/build_seed.py, tools/merge_incoming.py, src/js/03-data.js or 04-quality.js, or before any analytic that reads a record.
---

# Data provenance and quality

## Purpose

This dataset's entire claim is that every value can be traced to a source and that nothing was
invented. Every other feature is built on that claim. This skill is the rulebook that keeps it true.

## Responsibilities

- Decide what a record may contain and how a value earns its place.
- Keep absence visible: a missing value is a fact about coverage, not a blank to fill.
- Own the evidence model (`_evidence`, `evidenceProfiles`, `qcStatus`, `nextRefreshAt`).
- Own duplicate and entity review: what is a building, what is a company, what is the same thing twice.

## Constraints – these are the product, not style

1. **Never fabricate** rent, occupancy, vacancy, GLA, GBA, class, coordinates, tenants, owner,
   developer, operator, parking, service charge, year opened. Not as a placeholder, not as a
   "reasonable estimate", not as demo data without the `DEMO` label. A plausible-looking value is
   the worst outcome available, because nobody audits a building that looks real.
2. **Unknown is never zero.** `GEO.util.isKnown`: `0` and `false` are VALUES; `''`, `null`,
   `undefined`, `[]` are absences. A measured 0% vacancy and an unrecorded vacancy are different
   facts and must render, sort, filter and aggregate differently. `confirmed_empty` (a tenant list
   verified empty) is distinct from `not_collected`.
3. **Provenance is by reference.** `_evidence[field]` holds a profile id; the profile carries
   source, sourceId, sourceUrl, method, confidence, collectorId, reviewer, qcStatus, note.
   `nextRefreshAt` is always computed from `lastVerifiedAt` + the field's refresh class, never stored.
4. **Record confidence is the WEAKEST field's confidence**, never the strongest and never an average.
5. **Geometry is authoritative over labels.** `districtKey` comes from point-in-polygon against the
   official boundary; the source's district label is kept for reference and never silently
   "corrected". Ten of 148 records disagree with their label, including the highest-rent A+ building.
6. **Nothing collapses on its own (D6).** Duplicate groups ship `undecided`. Only a human
   `same_building` verdict lets `collapseDuplicates()` merge; the survivor is the record with the
   most recorded critical fields, ties by id.
7. **Demo records never mix with observed records without a label.** `recordType: 'DEMO'`,
   excluded from every market statistic unless demo mode is explicitly on, and then a
   non-dismissible banner says so – on screen and in print.
8. **Imports propose; people apply.** An external source produces a proposal with four outcomes
   per field – fill / corroborate / conflict / ignore. Conflicts are recorded and never resolved by
   code. Commercial figures (rent, GLA, GBA, occupancy, vacancy, available area, service charge,
   class, tenants) are refused from every external source at every confidence.
9. **A licence decides storage.** `open` may populate; `display` (Google, Yandex) may be shown and
   never stored; `contract` waits for the agreement; `unverified` waits for robots and terms to be
   read by a named person.

## Validation checklist

- [ ] `python3 tools/oracle.py` recomputes every headline figure independently and agrees.
- [ ] `python3 tools/test_merge.py` – 30/30, including: a recorded ZERO is a value so an incoming
      7 is a conflict, not a fill; an incoming blank never clears a recorded value.
- [ ] `python3 tools/etl_districts_check.py` – label/geometry disagreements listed, not hidden.
- [ ] `python3 tools/name_dupes.py` – proximity-gated duplicate candidates listed.
- [ ] Coverage is stated per field (`n of N`), never as a single completeness percentage in a
      headline (D9: count bands over the 8 critical fields).
- [ ] `index.html?selftest=1` – the "unknown≠0" and "§36" groups pass.
- [ ] Every `evidenceProfiles` entry has `source`, `method`, `confidence`, `qcStatus`.

## Examples

**Right.** "Average asking rent $32.2 /m²/month – based on 16 of 148 properties with verified
asking rent." The 132 without rent are not in the average and are named in the denominator.

**Right.** An OSM import says Trilliant has 12 floors; the record has none → `fill` proposed,
applied only by `--apply --reviewer NAME`, stamped `IMPORT-OSM-OVERPASS`, `qcStatus: needs_check`.

**Wrong.** Filling `floors: 10` because "most A+ towers in Tashkent have about ten". That is a
fabricated fact with a confident face.

**Wrong.** Treating the 132 properties with no rent as `$0` and reporting an average of `$3.48`.

## Prohibited behaviour

- Writing to `data/seed.json` by hand. It is generated by `tools/build_seed.py`; `verify.sh` fails
  if it drifts.
- Converting `null` to `0`, `''`, `'N/A'` or `'Unknown'` anywhere a number is expected.
- Raising a record's confidence because a second source *agreed*; corroboration raises
  `sourceCount`, never the confidence letter.
- Auto-merging duplicates, auto-resolving conflicts, or applying a `display`-licensed value.
- Estimating, extrapolating, or "typical value" reasoning for any property fact.
