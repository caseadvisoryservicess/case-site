# 10 — Visual system & data-visualisation tokens

Authoritative colour, type and mark specification for the prototype. Every value here was
**computed and validated**, not eyeballed. Implementers must use these exact hexes.
Brief references: §24 design direction, §25 animations, §14 charts, §9 marker design, §19 data-quality UX.

---

## 1. Why these colours

CASE's brand is `cream / ink / red` (from the public site `index.html`). §24 demands
"restrained use of colour". The system therefore uses **one accent — CASE red — as the only
data colour**, neutrals for everything else, and a fixed status scale for data confidence.
No categorical rainbow appears anywhere: every chart in §14 plots a **single series**
(counts or frequencies), so a multi-hue palette would spend the identity channel
re-encoding what bar length already shows.

Office class is **ordinal** (A+ > A > B+ > B > C), so it takes a **single-hue ramp with
monotone lightness** — the reader sees the order in the colour. It is *not* categorical.

---

## 2. Core tokens

```css
:root{
  /* brand */
  --case-red:#B01F22;        /* the one accent; also the single data-mark colour */
  --case-red-dark:#8E191B;   /* hover/active on red surfaces */
  --ink:#1A1714;
  --cream:#F5F3EF;

  /* surfaces */
  --bg:#F5F3EF;              /* app shell */
  --surface:#FFFFFF;         /* cards, panels, chart surface */
  --surface-2:#FAF9F7;       /* inset rows, table stripes */
  --surface-3:#EFEBE4;       /* pressed / selected row */

  /* lines */
  --line:#E3DFD8;            /* hairline dividers, gridlines */
  --line-strong:#CFC9BF;     /* input borders, card edges */

  /* text */
  --text:#1A1714;            /* 17.85:1 on white */
  --text-2:#5C554C;          /*  7.35:1 */
  --text-3:#6E665C;          /*  5.65:1 — smallest text still passes body contrast */

  /* data marks */
  --data:#B01F22;            /* 6.85:1 on white — single-series bars, histograms */
  --data-soft:#F0DEDD;       /* 10% wash / unselected state of a red mark */
  --unknown:#8A8178;         /* 3.82:1 — the "no data" bucket; ALWAYS hatched, see §5 */
}
```

### Contrast (computed, WCAG relative luminance)

| token | hex | vs `#FFF` | vs `#F5F3EF` | requirement | result |
|---|---|---|---|---|---|
| `--data` | `#B01F22` | 6.85:1 | 6.18:1 | mark ≥ 3:1 | PASS |
| `--unknown` | `#8A8178` | 3.82:1 | 3.45:1 | mark ≥ 3:1 | PASS |
| `--text` | `#1A1714` | 17.85:1 | 16.11:1 | body ≥ 4.5:1 | PASS |
| `--text-2` | `#5C554C` | 7.35:1 | 6.63:1 | body ≥ 4.5:1 | PASS |
| `--text-3` | `#6E665C` | 5.65:1 | 5.10:1 | body ≥ 4.5:1 | PASS |

`--line` (1.33:1) and `--line-strong` (1.65:1) are **decorative only** — they must never
carry information and never be the sole indicator of a control's boundary or state.

---

## 3. Office-class ordinal ramp (markers + the class chart)

Derived from CASE red in OKLCH (`L=0.491 C=0.180 H=26.2°`) by stepping lightness and
tapering chroma at the light end. **Validated with the data-viz ordinal checks against both
the white chart surface and the cream app surface — all four checks PASS in both**
(monotone lightness · adjacent ΔL ≥ 0.06 · light-end contrast ≥ 2:1 · single hue, spread 0°).

| class | hex | OKLCH L | vs `#FFF` | label colour on the fill |
|---|---|---|---|---|
| **A+** | `#74040c` | 0.354 | 11.90:1 | white |
| **A**  | `#a20615` | 0.451 |  8.16:1 | white |
| **B+** | `#bd3d39` | 0.544 |  5.40:1 | white |
| **B**  | `#d4665e` | 0.640 |  3.58:1 | ink `#1A1714` (4.98:1) |
| **C**  | `#e78d84` | 0.735 |  2.46:1 | ink `#1A1714` (7.26:1) |
| **Unknown** | `#8A8178` | — | 3.82:1 | white |

Label-colour rule (mechanical, no judgement): use white when
`contrast(fill, #FFFFFF) >= 4.5`, otherwise ink.

> **Unknown is NOT a step of the ramp.** It is the neutral, placed outside the ordinal
> sequence, because "we don't know the class" is not a position between B and C (§36).

### Marker design (§9 — "marker design should communicate at least one useful attribute")

Markers are circles filled from the ramp **with the class letter set inside them**
(`A+`, `A`, `B+`, `B`, `C`, `?`). The letter is the point: identity never depends on colour
alone, which keeps the map readable under colour-vision deficiency, in greyscale print and
at low zoom. Specification:

- radius 13px normal, 16px hovered, 19px selected; `--surface` 2px ring (the surface-ring
  spacer) so overlapping pins stay legible;
- selected marker adds a 3px `--case-red` outer ring and is raised to the top pane;
- a record flagged `possible_duplicate` carries a small notch/asterisk glyph;
- a `DEMO` record is drawn with a dashed 2px surface ring — visibly not real market data (§6);
- cluster bubbles: `--surface` fill, 2px `--line-strong` border, ink count text — clusters
  are *chrome*, not data, so they never wear the data colour.

---

## 4. Status scale — data confidence (§19, §2.3)

Reserved meaning; **never** reused as a series colour. Always rendered as
**dot + text label**, never colour alone.

| confidence | hex | role |
|---|---|---|
| High | `#0ca30c` | good |
| Medium | `#fab219` | warning |
| Low | `#ec835a` | serious |
| Unknown / Not verified | `#8A8178` | neutral — hollow dot (2px ring, no fill) |

`Medium` (1.83:1) and `Low` (2.64:1) sit below 3:1 on a light surface **by design** — the
mandatory text label is the mitigation. A confidence dot must never appear without its
label, and must never be the only cue that a value is unreliable (§2.7: never hide
uncertainty).

Stale-data indicator uses `--status-serious` plus the words `Stale — last verified DD MMM YYYY`.

---

## 5. The "no data" treatment — the most important visual rule

§36 forbids treating missing values as zero, and the *visual* corollary is that an unknown
bucket must never look like a measured value:

- fill `--unknown` **plus a 45° hatch pattern** (`<pattern>` with 1px `--surface` lines at
  4px pitch) so it is distinguishable in greyscale and by texture, not colour;
- always directly labelled with the count and the word **Unknown** (e.g. `Unknown · 132`);
- it is **shown, never dropped** — hiding it would misrepresent coverage;
- it is excluded from the metric it would distort, and the exclusion is stated in the
  coverage line under the chart.

---

## 6. Typography

| role | family | size / weight | tracking |
|---|---|---|---|
| Display (product name, panel titles) | `'DM Serif Display', Georgia, serif` | 20–28px / 400 | −0.01em |
| UI + data (everything else) | `'Inter', system-ui, -apple-system, sans-serif` | 13px base / 400–600 | 0 |
| Metric value (stat tile) | `'DM Serif Display'` | 30px / 400, proportional figures | −0.01em |
| Coverage / denominator line | Inter | 11px / 400, `--text-3` | +0.01em |
| Axis ticks, table numerals | Inter | 11–12px, `tabular-nums` | 0 |

**The display face is embedded, not fetched.** `DM Serif Display` ships base64-inlined in
the deliverable (the `@FONT` marker in `shell.html`, SIL OFL 1.1, licence at
`src/assets/dmserif-display-OFL.txt`). The prototype's normal home is `file://` with no
network, where an `@import` cannot resolve — so before this the brand face fell back to
Georgia, or on Linux to whichever generic serif the machine had. A wordmark whose shape
depends on the machine it is opened on is not a wordmark. 25 KB buys an identical lockup
everywhere. Inter stays an `@import`: a UI face degrading to `system-ui` costs the reader
nothing, and the identity does not degrade at all.

### 6.1 Departure: the metric value IS set in the display serif

The data-viz mark spec says a hero or metric number is **never** set in a display or serif
face, because "it reads as off-brand decoration". That rationale does not hold for this
brand, and applying the rule mechanically here would have produced the opposite of what it
is for: `caseadvisory.com` sets its own headline statistics in this exact face
(`.hstat-n { font-family: var(--serif); font-size: 42px }`). A sans metric is the
off-brand choice for CASE.

The rest of the rule is kept as written, because the rest of its reasoning does hold:

- Only the **stat tile and location-band values** take the serif — the single figure a
  reader is meant to take away. Chart axis ticks, table numerals and in-chart labels stay
  in the UI sans.
- Standalone display figures use **proportional** figures. `tabular-nums` gives every digit
  the width of a `0`, which at 30px makes `148` look gappy; tabular is kept for columns
  that must align vertically (tables, axis ticks).
- The unit is a separate line in the UI sans, not a serif suffix — it is a label, not a
  figure.

---

## 7. Chart specification (§14)

All four charts are hand-rolled inline SVG (no library), single series, `--data` fill.

| # | chart | form | encoding |
|---|---|---|---|
| 1 | Business centres by district | horizontal bar | magnitude; sorted descending by count |
| 2 | Business centres by class | horizontal bar | **ordinal ramp** (class is the dimension), fixed order A+, A, B+, B, C, Unknown |
| 3 | Asking-rent distribution | histogram (columns) | `--data`; + hatched Unknown column |
| 4 | GLA distribution | histogram (columns) | `--data`; + hatched Unknown column |

Mark specs (fixed, from the data-viz method):

- bar/column thickness **≤ 24px** — never fill the band; leftover space is air;
- **4px rounded data-end, square at the baseline**;
- **2px surface gap** between touching/adjacent bars;
- gridlines: **1px solid** `--line`, never dashed, recessive; baseline `--line-strong`;
- axis ticks rounded to clean numbers, thousands-comma'd, `tabular-nums`;
- **no legend** — every chart is single-series, so the title names what is plotted
  (chart 2's ramp is explained by the axis category labels themselves);
- direct labels are **selective**: value at the bar tip for the top bar and the Unknown
  bar only; the rest is carried by the axis and the hover tooltip;
- **text never wears the data colour** — all labels use `--text`/`--text-2`/`--text-3`;
- every chart carries a **coverage line** beneath it (§14/§36), e.g.
  `Based on 16 of 148 properties with verified asking rent`;
- hover tooltip on every bar (category, count, share, and the coverage caveat);
- when the metric fails the sufficiency threshold the chart area is replaced by the
  **Insufficient verified data** state plus a sentence naming exactly what is missing.

### Histogram bins

Rent bins are set against the **real observed range** (16 known values, 19.9–44.7
USD/m²/month): `<20, 20–25, 25–30, 30–35, 35–40, 40–45, 45+`, plus the hatched
`Unknown` column. 5-dollar bins keep every populated bin non-empty at n=16 and read as
round commercial numbers. GLA bins: `<2,000 / 2,000–5,000 / 5,000–10,000 / 10,000–20,000 /
20,000+ m²`, plus `Unknown` — noting that with the real dataset **GLA is unknown for all
148 records**, so this chart renders its insufficient-data state until demo or edited
records supply values. That is the correct, honest behaviour, not a bug.

---

## 8. Elevation, radius, spacing

- radius: 2px (chips/inputs), 4px (buttons, chart data-ends), 8px (cards/panels);
- shadow: `0 1px 2px rgba(26,23,20,.06)` (resting card), `0 8px 24px rgba(26,23,20,.12)`
  (drawer/overlay). Nothing heavier — §24 says *subtle* shadows;
- spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48px. Panel padding 16px, card padding 16px,
  section gap 24px;
- no gradients, no glassmorphism, no blur backdrops (§24 explicitly forbids them).

---

## 9. Motion (§25)

| what | duration | easing |
|---|---|---|
| panel / drawer open-close | 180ms | `cubic-bezier(.2,.8,.2,1)` |
| property selection, marker state | 120ms | `ease-out` |
| filter result / count update | 140ms | `ease-out` |
| chart bar growth on data change | 220ms | `cubic-bezier(.2,.8,.2,1)` |
| AI layer add / remove | 200ms | `ease-out` |
| card hover lift | 100ms | `ease-out` |

Nothing animates longer than 220ms. Under `@media (prefers-reduced-motion: reduce)` all
transition and animation durations collapse to `0.01ms` — state changes still happen,
they just do not move. Map pan/zoom easing is also disabled there.

---

## 10. Focus & accessibility baseline

- focus ring: `outline: 2px solid var(--case-red); outline-offset: 2px` — visible on every
  interactive element, never removed;
- all panels are `role="region"` with `aria-label`; the property drawer and modals are
  `role="dialog" aria-modal="true"` with focus trapped and returned on close;
- every chart is accompanied by a **table view toggle** so values are never gated behind
  colour or hover;
- hit targets ≥ 32×32px (≥ 44px on touch breakpoints);
- the map is not the only route to any information: everything reachable by clicking a
  marker is reachable from the list.
