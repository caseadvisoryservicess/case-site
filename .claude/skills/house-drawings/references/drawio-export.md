# draw.io export for house drawings

When the user wants an **editable** file, emit draw.io XML (`.drawio`) built from the
floorplan stencil library that ships inside draw.io / diagrams.net (`mxgraph.floorplan.*`).
The file opens at app.diagrams.net or in the draw.io desktop app, where every wall, door
and furniture piece stays a movable object.

Scale convention: **1 px = 1 cm** — identical numbers to the SVG geometry table, so an SVG
plan converts to draw.io by transcribing x/y/w/h per element.

## File skeleton

```xml
<mxfile host="app.diagrams.net">
  <diagram id="plan-gf" name="Ground Floor">
    <mxGraphModel dx="800" dy="600" grid="1" gridSize="10" arrows="0" page="1"
                  pageWidth="1169" pageHeight="826">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <!-- content cells go here, parent="1" -->
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```

`pageWidth/pageHeight` 1169×826 = A4 landscape at ~1 px/cm of paper; use 1654×1169 for A3.
One `<diagram>` per storey for multi-storey houses.

## Content cell pattern

Every element is an `mxCell` with `vertex="1"` and an `mxGeometry`:

```xml
<mxCell id="wall-n" value="" parent="1" vertex="1"
        style="shape=mxgraph.floorplan.wall.horizontal;fillColor=#d9d9d9;strokeColor=#000000;">
  <mxGeometry x="0" y="0" width="650" height="25" as="geometry"/>
</mxCell>

<mxCell id="door-entry" value="" parent="1" vertex="1"
        style="shape=mxgraph.floorplan.doorRight;strokeColor=#000000;flipV=1;">
  <mxGeometry x="60" y="400" width="90" height="90" as="geometry"/>
</mxCell>

<mxCell id="label-living" value="LIVING ROOM&#10;21.5 m²" parent="1" vertex="1"
        style="text;html=1;align=center;verticalAlign=middle;fontSize=12;">
  <mxGeometry x="120" y="150" width="180" height="40" as="geometry"/>
</mxCell>
```

Rotate any shape with `rotation=90` (degrees, clockwise) in the style; mirror with
`flipH=1` / `flipV=1`. Dimensions are drawn as edge cells with
`style="endArrow=openThin;startArrow=openThin;"` plus a text cell for the number.

## Stencil catalog (`shape=mxgraph.floorplan.<name>`)

Shapes marked **(fill)** need an explicit `fillColor` in the style (use `#d9d9d9` for
walls, `none` for a room outline).

| Group | Shapes |
|---|---|
| Walls | `wall.horizontal` (fill), `wall.vertical` (fill), `wallCorner.cornerNE/.cornerNW/.cornerSE/.cornerSW` (fill), `wallU` (fill), `room` (fill), `opening` |
| Doors | `doorLeft`, `doorRight`, `doorDouble`, `doorDoubleAction`, `doorBifold`, `doorBypass`, `doorPocket`, `doorDoublePocket`, `doorSlidingGlass`, `doorAccordion`, `doorRevolving`, `doorOverhead`, `doorOpposing`, `doorUneven` |
| Windows | `window`, `windowBay`, `windowBow`, `windowGarden`, `windowGlider` |
| Stairs & vertical | `stairs.horizontal`, `stairs.vertical`, `spiral_stairs`, `stairsRest`, `elevator` |
| Bathroom | `bathtub`, `bathtub2`, `toilet`, `shower`, `shower2`, `sink_1`, `sink_2`, `sink_22`, `sink_double`, `sink_double2` |
| Kitchen / utility | `range_1`, `range_2`, `refrigerator`, `washing_machine`, `drying_machine`, `water_cooler` |
| Bedroom | `bed_single`, `bed_double`, `dresser`, `wardrobe` |
| Living / office | `couch`, `sofa`, `chair`, `office_chair`, `table`, `table_1`–`table_5`, `desk_corner`, `desk_corner_2`, `bookcase`, `workstation`, `piano`, `fireplace`, `flat_tv`, `crt_tv`, `floor_lamp`, `plant`, `laptop`, `printer`, `copier` |

Typical stencil footprints (w×h in cm at 1 px = 1 cm): doors 90×90 (the square holds the
swing arc), toilet 55×70, bathtub 75×170, shower 90×90, bed_double 160×200, couch 200×90,
stairs.vertical 100×250. Stretch stencils freely — they scale cleanly.

## Assembly order

1. Wall cells for the envelope (four `wall.*` runs + `wallCorner.*`, or one `room` per room).
2. Doors/windows **on top of** the wall cells at the gap positions.
3. Fixtures and furniture.
4. Text label cells (name + area), dimension edges.
5. A north-arrow: `style="shape=triangle;direction=north;"` with a small `text` cell "N".

Deliver as a `.drawio` file. The same XML inside a fenced ` ```drawio ` block renders
inline in Markdown viewers that support it.
