---
name: house-drawings
description: Produces professional architectural drawings of houses and apartments as dimensioned, self-contained SVG — floor plans, elevations, simple site plans, and room layouts — with optional editable draw.io export. Use when asked for a floor plan, house drawing, architectural drawing, elevation, site plan, room layout, or to visualize a property's spatial arrangement for a client, listing, or feasibility study.
---

# House Drawings

Produce clean, dimensioned architectural drawings without CAD software. Primary output is
self-contained SVG (printable, embeddable in HTML artifacts and PDFs, renders anywhere).
Optional secondary output is draw.io XML for clients who want an editable file.

## Workflow

1. **Gather the brief.** Rooms and target sizes, adjacencies (what connects to what),
   storeys, overall footprint or plot constraints, metric or imperial. If sizes are missing,
   propose sensible ones from the room-sizing table in
   [references/drafting-standards.md](references/drafting-standards.md) and say so.
2. **Propose the layout.** Zone the plan (living/sleeping/service), place wet rooms on
   shared walls, give habitable rooms exterior-wall contact. Describe the arrangement in a
   sentence or two before drawing so the user can redirect early.
3. **Compute geometry to scale.** Work in a whole-plan coordinate model **(1 SVG user unit
   = 1 cm)** before writing any markup: exterior wall outline first, then interior
   partitions, then openings. Keep a running table of each room's x/y/w/h — every wall,
   dimension and label derives from it.
4. **Render the SVG** following [references/svg-conventions.md](references/svg-conventions.md):
   walls with gray poché, door swing arcs, window symbols, dimension strings on all sides,
   room labels with areas, north arrow, title block.
5. **Iterate.** Apply feedback by editing the geometry table and re-rendering — never by
   nudging raw coordinates ad hoc.
6. **Export on request.** Draw.io XML per [references/drawio-export.md](references/drawio-export.md);
   PDF via printing the SVG or embedding it in an HTML page.

## Coordinate model (memorize)

- 1 unit = 1 cm. A 4.0 m × 3.5 m bedroom is a 400 × 350 rect.
- Origin top-left, +x right, +y down (SVG native). North points up unless the brief says otherwise.
- `viewBox="minX minY width height"` with a ~150 unit margin around the plan for dimensions.
- Nominal print scale 1:50 or 1:100 (imperial 1/4″ = 1′-0″); state it in the title block.
- Snap wall faces to a 5 cm grid; round dimension text to the cm (imperial: nearest inch).

## Drawing conventions (summary)

- **Walls**: double lines filled `#d9d9d9`; exterior 25 cm thick, interior 10 cm. Heaviest
  line weight (stroke 2.5 at 1:50). Draw as closed filled polygons, not parallel strokes.
- **Doors**: 80–90 cm leaf; gap in wall, leaf line perpendicular to it, quarter-circle
  swing arc (`A r r 0 0 1 x y`), stroke 1.
- **Windows**: wall-gap with three parallel lines across it, stroke 1.
- **Dimensions**: extension lines + dimension line + 45° ticks + centered text (stroke 0.75,
  font ~11 units); at least one exterior string per side and interior strings for key rooms.
- **Labels**: room name upper-case + area beneath (`BEDROOM` / `14.0 m²`), sans-serif.
- **Furniture/fixtures** (optional): lightest weight (stroke 0.75), simple outlines only.
- **Sheet**: north arrow top-right, title block bottom-right (project, drawing title, scale,
  date, sheet number).

Full symbol markup, the line-weight table, elevation/site-plan method, and room-sizing
guidance live in the three reference files — read the relevant one before drawing.

## Worked example (abbreviated) — studio apartment 6.0 × 4.0 m

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-150 -150 950 750"
     font-family="Helvetica, Arial, sans-serif">
  <rect x="-150" y="-150" width="950" height="750" fill="white"/>
  <!-- exterior walls: outer 650x450 at (-25,-25), inner 600x400 at (0,0), 25cm thick -->
  <path d="M -25 -25 H 625 V 425 H -25 Z M 0 0 V 400 H 600 V 0 Z"
        fill="#d9d9d9" stroke="black" stroke-width="2.5" fill-rule="evenodd"/>
  <!-- bathroom partition (10cm) with 70cm door gap -->
  <rect x="430" y="150" width="10" height="250" fill="#d9d9d9" stroke="black" stroke-width="2.5"/>
  <rect x="440" y="150" width="90" height="10" fill="#d9d9d9" stroke="black" stroke-width="2.5"/>
  <!-- entry door: 90cm gap in south wall, leaf + swing arc -->
  <rect x="60" y="400" width="90" height="25" fill="white"/>
  <line x1="60" y1="400" x2="60" y2="310" stroke="black" stroke-width="1"/>
  <path d="M 60 310 A 90 90 0 0 1 150 400" fill="none" stroke="black" stroke-width="1"/>
  <!-- window: 120cm, three lines across north wall gap -->
  <rect x="200" y="-25" width="120" height="25" fill="white"/>
  <g stroke="black" stroke-width="1">
    <line x1="200" y1="-25" x2="320" y2="-25"/>
    <line x1="200" y1="-12.5" x2="320" y2="-12.5"/>
    <line x1="200" y1="0" x2="320" y2="0"/>
  </g>
  <!-- room labels -->
  <text x="215" y="200" font-size="14" text-anchor="middle">LIVING / SLEEPING</text>
  <text x="215" y="220" font-size="11" text-anchor="middle">21.5 m²</text>
  <text x="520" y="270" font-size="12" text-anchor="middle">BATH</text>
  <text x="520" y="288" font-size="11" text-anchor="middle">4.0 m²</text>
  <!-- overall dimension, north side -->
  <g stroke="black" stroke-width="0.75">
    <line x1="-25" y1="-60" x2="-25" y2="-95"/>
    <line x1="625" y1="-60" x2="625" y2="-95"/>
    <line x1="-25" y1="-85" x2="625" y2="-85"/>
    <line x1="-30" y1="-80" x2="-20" y2="-90"/>
    <line x1="620" y1="-80" x2="630" y2="-90"/>
  </g>
  <text x="300" y="-92" font-size="11" text-anchor="middle">6.50</text>
</svg>
```

The full example with all four dimension strings, fixtures, north arrow, and title block is
in [references/svg-conventions.md](references/svg-conventions.md).

## Quality checklist before delivering

- [ ] Walls read as filled double lines; openings actually interrupt the wall fill.
- [ ] Every door has a swing arc; every habitable room has a window.
- [ ] Overall + key interior dimensions present; numbers match the geometry table.
- [ ] Room labels with areas; areas match w × h of the geometry table.
- [ ] North arrow, scale note, title block present.
- [ ] Plan margins large enough that nothing is clipped by the viewBox.
