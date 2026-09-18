---
name: map-frontend-engineer
description: The rules for the single-file, offline-first, ES5 front end – module layout, the one state object, tokens-only styling, Leaflet's stacking model, base-map licensing, responsive drawers and the print sheet. Load before editing anything under src/, build.py, or the manifest.
---

# Map front-end engineer

## Purpose

The deliverable is one `index.html` that opens by double-click with no server and no network. It
is authored as 29 modules and 10 stylesheets and assembled by `build.py`; it is never hand-edited.
This skill keeps that shape, and the four architectural rules that make the rest of the product
enforceable rather than hoped for.

## Responsibilities

- Own `build.py` (markers `@CSS`, `@JS`, `@DATA`, `@FONT`, `@STAMP`; `--check` staleness gate;
  `js_safe()` escaping of `</script>` in inlined data).
- Own the module contract: ES5 classic scripts, one IIFE per module attaching to the `GEO`
  namespace, manifest order is load order, `99-boot.js` last.
- Own `05-state.js`: one state object, `set()` the only writer, re-entrancy guard, deep-freeze,
  invariants, session log. Every panel re-derives from `(state, rows, scope)`; nothing caches
  records.
- Own the map module (`11-map.js`) and the base-map registry (`10b-basemaps.js`).
- Own the stylesheets: `01-tokens.css` is the only file with colour or z-index literals.

## Constraints

1. **No colour literal and no z-index literal outside `01-tokens.css`.** QA greps for it.
2. **State is the single source of truth (§59).** The assistant, the filter panel, the tab bar,
   the map – all call the same `GEO.state.set()`. If the screen and the state disagree, the
   screen is wrong. The tab bar's "current" marker is derived on every render for this reason.
3. **`state.set()` from inside a subscriber is refused, correctly.** Do not store what is
   derivable: "the reader chose no tiles" *is* `state.basemap === 'none'`.
4. **Leaflet stacking**: panes are 200–700; `#map` has `isolation: isolate` so they never compete
   with app chrome. A stylesheet `z-index` cannot lift a marker (inline z from latitude); a label
   that must sit above markers gets its own pane at 640.
5. **`minmax(0, 1fr)` can collapse to zero.** The header's search track is floored at 140px; a
   `min-width` on the item cannot grow the track.
6. **Responsive bands are boundaries, not phone-ness.** The tab bar exists wherever rails are
   drawers (≤1023). Drawer/sheet CSS keys on `.app[data-left="open"]`, the attribute render()
   actually writes. Scope selectors and the provisional-name chip are header controls only ≥1280.
7. **The display face is embedded** (`@FONT`, OFL-1.1, licence shipped). The wordmark must not
   change shape per machine. `line-height: 1.35` is the first value that contains it.
8. **Base maps come from the registry only.** `open` ships active with attribution asserted;
   `licensed` (2GIS, Google, Yandex) ships visible, disabled, with the remedy and an endpoint
   field. Switching crossfades and retires the old layer on `load` OR first `tileerror` – offline,
   `load` never fires. `tiles = layer` must be assigned or the next switch leaks the previous.
9. **Every disabled control states why, adjacent, as text (§29).** No decorative buttons.
10. **Print**: three deliverables (card, compare, location), running header/footer from
    `data-print-*` set in `beforeprint`, denominators kept with their figures, demo banner prints
    only when `:not([hidden])`.
11. **Motion**: `GEO.motion.animates()` is the one answer; `data-motion` overrides the OS.
12. **House style: en dash**, checked on rendered text across eight surfaces.

## Validation checklist

- [ ] `python3 build.py --check` current; no `<script>` in inlined data unescaped.
- [ ] `node tools/qa.cjs` – header one line at 6 widths, no overlapping tracks, search ≥100px;
      every tab-bar destination opens at 375/768/834; layers panel fits its window and no marker
      draws over it; basemap registry self-consistent; print checks.
- [ ] `grep` for `#[0-9a-f]{6}` and `z-index:` outside `01-tokens.css` returns nothing.
- [ ] `document.fonts.check('400 22px "DM Serif Display"')` is true offline.

## Examples

**Right.** `wrap.dataset.tilesChosen = 'true'` from `setBasemap()` inside render, with the notice
reading `chosenNoTiles(state)` – DOM hook set, no state written.

**Wrong.** `setTiles(false)` from inside render – it calls `state.set()` and is refused.

**Wrong.** `.rail[data-open="true"]` – an attribute nothing writes; the drawers never opened on
any touch device for the life of the stylesheet.

## Prohibited behaviour

- Editing `index.html` directly; ES modules; `fetch()` of local files; a build step required to
  *run*.
- A private copy of any filter value in a panel.
- Hand-patching `vendor/leaflet.js` (the flag was removed via `setPrefix`).
- Shipping an unlicensed tile URL, or an active provider without attribution.
