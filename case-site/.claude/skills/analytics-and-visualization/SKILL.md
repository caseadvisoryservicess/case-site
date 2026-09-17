---
name: analytics-and-visualization
description: The denominator doctrine and the chart rules – how a figure is computed, when it may be shown, and how it is drawn so it reads as data rather than decoration. Load before editing src/js/08-analytics.js, 10-charts.js, 15-panel-analytics.js, any stat tile, or any chart.
---

# Analytics and visualization

## Purpose

A figure without its denominator is a rumour. A chart that hides its unknowns is a lie drawn
neatly. This skill owns both the arithmetic and the marks.

## Responsibilities

- Own `GEO.analytics.metric()` – every metric returns
  `{value, n, N, sufficient, reason, display, coverageText}` and nothing renders a bare number.
- Own `known(rows, field)`, the only permitted value reader.
- Own the four charts (by district, by class, rent distribution, GLA distribution), the stat
  tiles, the coverage chart, and the count-up animation on change.

## Constraints

1. **`MIN_N = 3`.** Mean/median below that: `sufficient: false`, reason on screen. Strip plot
   below 30: withheld. `RENT_BINS = [20,25,30,35,40,45]`.
2. **Unknown is its own bucket, always hatched, always labelled with the word "Not recorded",
   never a position in the ordinal sequence.** `--class-unknown` sits outside the A+→C ramp.
3. **Ordinal class ramp is one hue, monotone lightness, adjacent ΔL ≥ 0.06**, validated with the
   dataviz palette script on both surfaces. The letter inside the mark carries identity; colour
   never carries it alone (CVD, greyscale print).
4. **Stat tile values are set in the display serif** – a documented departure from the dataviz
   default because for CASE the serif *is* the brand (visual-system §6.1). Axis ticks and table
   numerals stay sans and tabular. Standalone figures are proportional.
5. **The unit is its own line**, never a wrapped suffix.
6. **Count-up never interpolates a formatted value.** `$32.2 → $28.6` is set directly; only plain
   integers tween, and the final frame is always the exact string. A number that never existed
   must never be on screen, even for 300 ms.
7. **Every chart has a table view**, direct labels on ≤4 series, one axis, no dual axes, no
   rainbow, and a hover layer.
8. **The headline count carries honest notes**: unresolved duplicates, suspected non-buildings,
   placeholder names.

## Validation checklist

- [ ] `python3 tools/oracle.py` – independent Python recomputation agrees with the screen.
- [ ] `index.html?selftest=1` – 138/138, including the §36 group (a measured 0 contributes to
      n; an unknown does not; sum over `[0, null]` is 0 not null).
- [ ] `node scripts/validate_palette.js` (dataviz skill) – ordinal ramp passes on light and dark.
- [ ] Every `.stat` shows `.stat__cov`; print keeps it attached to its figure.
- [ ] `node tools/qa.cjs --only=checks` – "a formatted value is never interpolated".

## Examples

**Right.** `metric(rows, 'askingRent', 'mean')` on Mirobod → `{value: 28.58, n: 4, N: 28,
sufficient: true, coverageText: 'Based on 4 of 28 properties with verified asking rent.'}`.

**Right.** Total known GLA → `{sufficient: false, reason: 'No property in the current selection
has a recorded GLA.'}` rendered as *Insufficient verified data*, tile kept, not hidden.

**Wrong.** A completeness "score" of 12% in a headline tile – D9 says count bands over 8 critical
fields, never a percentage that puts every record in one bucket.

**Wrong.** A stacked bar where "Unknown" is the top segment in grey but unhatched.

## Prohibited behaviour

- Computing over `null` as `0`; dividing by `N` when `n` is the denominator.
- Hiding a tile because it is insufficient – a hidden card reads as a question nobody asked.
- Dual-axis charts, cycled hues, a serif anywhere on an axis.
- Any figure whose `n`/`N` is not visible next to it.
