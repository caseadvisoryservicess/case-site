---
name: testing-and-qa
description: How this project proves a claim – measure rather than eyeball, drive the real deliverable in a real browser, keep an independent oracle, and never trust a check that has not been seen to fail. Load before writing or changing anything under tools/, before declaring a feature done, and before every commit.
---

# Testing and QA

## Purpose

Every serious bug in this project was found by *looking at the rendered thing* or by *measuring
it* – not by reading the source. Drawers that never opened on any touch device passed every
screenshot because a closed drawer looks like a map. A metric count-up "worked" until a frame-by-
frame probe showed digits never moved. This skill is the discipline that replaces confidence with
evidence.

## Responsibilities

- Own `tools/qa.cjs` (headless Chromium against `index.html` from `file://`, offline), the Node
  suites (`test-filters`, `test-search`, `test-intents`, `test-assistant`), `tools/test_merge.py`,
  `tools/oracle.py`, `tools/check-i18n.cjs`, `tools/verify.sh`, and the in-app self-test.
- Keep the oracle independent: `oracle.py` re-implements every metric in Python and the self-test
  asserts the JS against it. Two witnesses, one truth.
- Keep tests honest about their own reach: a check that cannot fail proves nothing.

## Constraints

1. **Negative control before trusting a new check.** Re-introduce the fault, watch the check go
   red, restore, watch it go green. Record both in the commit. The first version of the marker-
   stacking check passed with the fault present because it sampled two fixed points.
2. **Measure, do not eyeball.** `getBoundingClientRect`, `scrollHeight` vs `clientHeight`,
   `elementFromPoint`, pane z-indices, `document.fonts.check`. A screenshot is corroboration,
   not proof.
3. **Test outputs, not names.** The i18n check drives the real enumerations through
   `valueLabel`, `availability`, `describe` and asserts nothing comes back shaped like a dotted
   key – so no key list has to be kept in step.
4. **Isolate state between groups.** `freshPage()` boots through the app's own `#reset` hatch.
   `localStorage` on `file://` is shared across pages; a UX group's edit once made three
   assistant refusals fail when the assistant was *right*.
5. **Sweep surfaces, not one screen.** The en-dash rule is checked across eight surfaces; the
   single-surface version missed the seed data.
6. **Functional, not structural, for navigation.** Click every tab-bar destination at every
   touch width and require the panel visible and in view.
7. **Whitelists come from registries, not hand-kept lists.** The tile-host exclusion parses
   `10b-basemaps.js`; adding a provider cannot blunt the asset check.
8. **`pointer-events: none` defeats `elementFromPoint`.** Assert structure (pane order) when the
   element is deliberately non-interactive.
9. **A check passing on the wrong state is a bug in the check.** `leftTab: 'list'` is not a tab;
   the cards were in the DOM anyway. Fixed the check, not the product.

## Validation checklist (the commit gate)

- [ ] `python3 build.py --check` – the built file is current.
- [ ] `bash tools/verify.sh --quick` – syntax, seed reproducibility, oracle, intents, filters,
      search, assistant, ingestion, i18n, districts.
- [ ] `node tools/qa.cjs` – 155/155 at time of writing: boot, self-test, §33 UX, §61 assistant,
      cross-cutting (§29 no dead controls, §8 naming, §60 roles, D4 demo, §10 basemaps, dashes,
      motion), responsive & motion (6 widths, header geometry, tab bar, print, reduced motion).
- [ ] Every new check has a recorded negative control.
- [ ] Console has no errors other than the designed offline tile fetch.

## Examples

**Right.** "Removing `isolation: isolate` makes the check report 6 covered markers; restoring it
reports 0." – the check has been seen to fail.

**Right.** Probing count-up frame by frame: `148 → 110 → 73 → 49 → 39 → 31 → 29 → 28`, and
`$32.2` set directly with no intermediate.

**Wrong.** "The mobile screenshot looks fine." It looked fine for three turns while nothing opened.

**Wrong.** Adding `carto.com` to a hand-kept host list in the QA file.

## Prohibited behaviour

- Skipping, disabling or quarantining a test to get green.
- Declaring a feature done from source reading alone.
- A check whose failure has never been observed.
- Widening an exclusion until a check catches nothing.
