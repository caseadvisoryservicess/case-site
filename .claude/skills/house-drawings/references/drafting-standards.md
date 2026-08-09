# Drafting standards for house drawings

## Scales

| Drawing | Metric | Imperial | Use |
|---|---|---|---|
| Site plan | 1:200, 1:500 | 1″ = 20′ | plot, setbacks, footprint |
| Floor plan | 1:50, 1:100 | 1/4″ = 1′-0″, 1/8″ = 1′-0″ | the default deliverable |
| Elevation / section | 1:50, 1:100 | 1/4″ = 1′-0″ | façades, storey heights |
| Room / detail plan | 1:20, 1:25 | 1/2″ = 1′-0″ | kitchens, bathrooms |

State the scale + intended paper size in the title block ("1:50 at A3"). Since output is
SVG, scale is nominal — it governs stroke weights and text sizes, not pixel math.

## Units and dimension text

- Metric plans: meters with two decimals (`3.60`) on dimension strings; mm only in detail
  callouts. Areas in m² with one decimal.
- Imperial plans: feet-inches (`12'-6"`); areas in sq ft, whole numbers.
- Never mix systems on one sheet; offer a conversion table in prose instead.

## Wall thickness conventions

| Wall | Metric | Notes |
|---|---|---|
| Exterior | 200–300 mm (default 250) | includes finish allowance |
| Interior partition | 100–150 mm (default 100) | |
| Plumbing/service wall | 150 mm | back-to-back wet rooms |
| Party wall (attached houses) | 250–300 mm | acoustic/fire separation |

## Room sizing guide (defaults when the brief lacks numbers)

| Room | Area m² | Min. clear dimension |
|---|---|---|
| Living room | 18–35 | 3.3 m |
| Kitchen | 7–15 | 2.4 m |
| Dining | 9–15 | 2.7 m |
| Master bedroom | 12–20 | 3.0 m |
| Secondary bedroom | 9–14 | 2.7 m |
| Bathroom | 3.5–8 | 1.5 m |
| Powder room / WC | 1.5–3 | 0.9 m wide |
| Entry / hall | 4–8 | 1.1 m wide |
| Corridor | — | 1.0–1.2 m wide |
| Stair run | — | 0.9–1.0 m wide, ~2.5–3.0 m long per storey (2.7 m rise) |
| Garage (1 car) | 18–20 | 3.0 × 6.0 m |

Planning rules of thumb: every habitable room touches an exterior wall (daylight); stack
or back wet rooms onto shared plumbing walls; entry should not open into a bedroom; no
habitable room used as the only corridor to another (living→dining excepted); door swings
should not collide or block circulation.

## Line-weight hierarchy (pen logic)

Heaviest → lightest: cut elements (walls at the cut plane) → fixed built-ins → doors,
windows, stairs → furniture → dimensions & annotation. In SVG at 1:50 this maps to stroke
2.5 / 1.25 / 1 / 0.75 / 0.75 (see svg-conventions.md). Consistency matters more than the
absolute values: a plan where everything is one weight reads as a diagram, not a drawing.

## Dimensioning rules

1. Outside the plan, never across rooms when avoidable.
2. First string: overall envelope, one per side. Second string (chained): room-by-room
   along the two primary sides. Interior strings only for rooms whose size is a client
   decision point.
3. Extension lines never touch the wall (10 cm gap); ticks at 45°, uniform direction.
4. Dimension the *structure* (wall faces), not furniture.
5. Every number on the sheet must equal the geometry table — no rounded-up "display" values.

## Sheet layout

Margins ≥ 10 mm paper-equivalent all round. North arrow top-right. Title block bottom-right
containing: firm name, project, drawing title, scale + paper, date, sheet number
(`A-101` floor plans, `A-201` elevations, `A-001` site). Revision letter when iterating
(`Rev B`), and a short legend if furniture symbols are used.

## Drawing an elevation from a plan

1. Project the plan's exterior wall x-extents down as the elevation's width.
2. Set levels: FFL 0.00, ceiling +2.70 (typ.), first-floor FFL +3.00, eaves, ridge
   (roof pitch 25–40° for pitched roofs; parapet +0.9 m for flat).
3. Place openings at plan positions; sill heights: windows +0.9 m (habitable), +1.5 m
   (bath), doors from FFL.
4. Ground line heaviest; add level markers (`▽ +2.70`) and one vertical dimension string.
5. Name by compass direction the façade *faces* (`SOUTH ELEVATION`).

## Site plan content checklist

Plot boundary (dash-dot) with lengths, house footprint (gray fill), setback dimensions to
every boundary, drive/paths/terraces (light), north arrow, plot area + footprint area +
coverage % in a small table, adjacent street name, scale note.

## Disclaimer

Drawings produced with this skill are illustrative planning/marketing documents. They are
not construction documents and are not a substitute for drawings prepared and stamped by a
licensed architect or engineer; local building codes govern. Include this note (one line)
on sheets shared externally: *"Indicative drawing for planning purposes — not for
construction."*
