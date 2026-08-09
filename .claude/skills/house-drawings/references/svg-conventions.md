# SVG conventions for house drawings

Coordinate model: **1 SVG user unit = 1 cm**, origin top-left, +y down. All snippets below
assume that model. Compose the drawing in layers, in this order (later paints on top):

1. white sheet background
2. wall poché (filled shapes)
3. openings (white rects that punch gaps in walls, then door/window symbols)
4. fixtures & furniture
5. dimensions
6. text labels, north arrow, title block

## Line-weight hierarchy (at 1:50 nominal)

| Element | stroke-width | stroke | fill |
|---|---|---|---|
| Cut walls | 2.5 | black | `#d9d9d9` |
| Fixed fixtures (WC, sink, tub, kitchen counter) | 1.25 | black | white |
| Doors, windows, stairs | 1 | black | none/white |
| Furniture (optional) | 0.75 | `#555` | none |
| Dimension lines, ticks, extension lines | 0.75 | black | — |
| Text | — | — | black |

Font: `font-family="Helvetica, Arial, sans-serif"`. Sizes: room names 14, areas/dimensions 11,
title block 10–16. Doubling the nominal scale (1:100) → halve stroke widths and font sizes.

## Walls

Draw each wall run as a **closed filled polygon**. For a rectangular envelope, use one
path with `fill-rule="evenodd"` — outer rectangle then inner rectangle — so the wall band
renders as poché:

```svg
<path d="M -25 -25 H 1025 V 825 H -25 Z  M 0 0 V 800 H 1000 V 0 Z"
      fill="#d9d9d9" stroke="black" stroke-width="2.5" fill-rule="evenodd"/>
```

Interior partitions are thin filled rects (10 cm): `<rect x="400" y="0" width="10" height="300" …/>`.
Leave door gaps by splitting the rect into two rects, or by overpainting a white rect.

Thicknesses: exterior 25 (range 20–30), interior partition 10 (range 10–15), plumbing wall 15.

## Door with swing arc

A 90 cm door hinged at (x0, y0), opening leftward into the room below the wall:

```svg
<!-- 1. punch the gap through the wall band (wall spans y=400..425) -->
<rect x="60" y="400" width="90" height="25" fill="white"/>
<!-- 2. leaf: line from hinge, perpendicular to wall -->
<line x1="60" y1="400" x2="60" y2="310" stroke="black" stroke-width="1"/>
<!-- 3. quarter-circle swing arc from leaf tip to the far jamb -->
<path d="M 60 310 A 90 90 0 0 1 150 400" fill="none" stroke="black" stroke-width="1"/>
```

Arc command form: `A r r 0 0 sweep x y` — radius = door width both times, large-arc-flag 0,
sweep 1 or 0 to bow toward the opening side. The leaf may also be drawn as a thin rect
(`width="3"`) for a bolder read. Double doors: two mirrored leaves + arcs meeting at center.

## Window (triple-line symbol)

For a 120 cm window in a horizontal wall band spanning y = -25..0:

```svg
<rect x="200" y="-25" width="120" height="25" fill="white"/>
<g stroke="black" stroke-width="1">
  <line x1="200" y1="-25" x2="320" y2="-25"/>   <!-- outer face -->
  <line x1="200" y1="-12.5" x2="320" y2="-12.5"/> <!-- glazing line -->
  <line x1="200" y1="0" x2="320" y2="0"/>       <!-- inner face -->
</g>
```

Vertical walls: swap x/y roles. Sills, bays and sliders can stay out of plan drawings —
the triple line is the standard plan symbol.

## Dimension string

Convention: extension lines start 10 outside the measured face, dimension line sits 60–85
outside the wall, ticks are 45° strokes 10 long, text 5 above the line, meters with two
decimals (`6.50`) or feet-inches (`21'-4"`). Horizontal string measuring x = -25..625 at
dimension-line height y = -85:

```svg
<g stroke="black" stroke-width="0.75">
  <line x1="-25" y1="-60" x2="-25" y2="-95"/>   <!-- extension line, left -->
  <line x1="625" y1="-60" x2="625" y2="-95"/>   <!-- extension line, right -->
  <line x1="-25" y1="-85" x2="625" y2="-85"/>   <!-- dimension line -->
  <line x1="-30" y1="-80" x2="-20" y2="-90"/>   <!-- 45° tick, left -->
  <line x1="620" y1="-80" x2="630" y2="-90"/>   <!-- 45° tick, right -->
</g>
<text x="300" y="-92" font-size="11" text-anchor="middle">6.50</text>
```

Chain interior dimensions on the same line by adding intermediate extension lines + ticks.
For vertical strings rotate the text: `<text … transform="rotate(-90 cx cy)">`.
Give each side of the plan at least an overall string; add a second chained string for
room-by-room widths on the two primary sides.

## Stairs

Straight run, 100 wide, 10 treads of 25 going up northward from (x, y):

```svg
<g stroke="black" stroke-width="1" fill="none">
  <rect x="700" y="100" width="100" height="250"/>
  <!-- tread lines every 25 -->
  <line x1="700" y1="125" x2="800" y2="125"/> <!-- …repeat to y=325 -->
  <!-- direction arrow: shaft up the center, head at top -->
  <line x1="750" y1="340" x2="750" y2="115"/>
  <path d="M 744 127 L 750 112 L 756 127" fill="none"/>
</g>
<text x="750" y="365" font-size="9" text-anchor="middle">UP</text>
```

Cut the run with a 45° break line (`<line>` pair) when the stair passes the cut plane.

## Fixtures (simple outlines, stroke 1.25)

- **WC**: cistern rect 40×15 against wall + bowl ellipse `rx="18" ry="24"` in front.
- **Sink/basin**: rect or circle 45–55 wide inset in counter.
- **Bathtub**: rect 170×75 with inner rounded rect (`rx="12"`) and a drain circle.
- **Shower**: square 90×90 with an X (two diagonals) and small drain circle.
- **Kitchen counter**: 60-deep rect band along wall; sink + 4 burner circles (r=9) for hob.
- **Bed**: rect 90×200 (single) / 160×200 (double) with a pillow rect at the head.
- **Sofa/table/wardrobe**: plain rects at 0.75 stroke; keep furniture minimal.

## North arrow (top-right of sheet)

```svg
<g transform="translate(870 -120)" stroke="black" fill="none" stroke-width="1">
  <circle r="22"/>
  <path d="M 0 14 L 0 -14 M -6 -4 L 0 -14 L 6 -4" />
  <text y="-28" font-size="11" text-anchor="middle" stroke="none" fill="black">N</text>
</g>
```

Rotate the whole group (`transform="translate(…) rotate(a)"`) when north is not up.

## Title block (bottom-right)

```svg
<g font-size="10" transform="translate(600 640)">
  <rect width="350" height="90" fill="white" stroke="black" stroke-width="1"/>
  <line x1="0" y1="30" x2="350" y2="30" stroke="black" stroke-width="0.75"/>
  <line x1="0" y1="60" x2="350" y2="60" stroke="black" stroke-width="0.75"/>
  <text x="10" y="20" font-size="13" font-weight="bold">CASE ADVISORY SERVICES</text>
  <text x="10" y="50">Project: Villa Meadowbrook — Ground Floor Plan</text>
  <text x="10" y="80">Scale 1:50 (A3) · 2026-08-09 · Sheet A-101</text>
</g>
```

Adjust the translate to sit inside the sheet margin; never overlap dimensions.

## viewBox and margins

`viewBox = (plan minX − margin) (plan minY − margin) (plan width + 2·margin) (plan height + 2·margin)`
with margin ≈ 150 (room for two dimension strings + sheet furniture). Add
`width="100%"` only if embedding in HTML; leave it off for standalone files.

## Elevations

Same unit model, viewed from the side: ground line (heavy, stroke 2.5) → façade outline
(stroke 1.5) → openings as rects with a glazing cross or mullion lines (stroke 1) → roof
line with overhang → level markers (small triangle + text: `▽ FFL 0.00`, `▽ Ceiling 2.70`).
Vertical dimension string on one side for storey heights. Label `SOUTH ELEVATION · 1:100`.

## Simple site plan

Plot boundary: dash-dot line (`stroke-dasharray="20 6 4 6"`, stroke 1.5). House footprint:
filled light-gray rect with roof-plan lines. Setback dimensions from each boundary to the
footprint, driveway/paths at 0.75, north arrow mandatory. Scale 1:200 or 1:500.
