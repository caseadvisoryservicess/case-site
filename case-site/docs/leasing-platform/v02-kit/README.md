# v0.2 build kit — CASE Leasing & Sales, Project Control

Everything the next chat needs. Attach all of it together with
`CASE_Leasing_Sales_Project_Control_v0.1.html` and paste `../PROMPT_v0.2.md`.

| File | Purpose | Verified |
|---|---|---|
| `plan-recognizer.js` | Reads unit codes, printed areas and outlines out of an SVG or vector PDF floor plan; derives the scale; matches against the inventory. | ✅ against a real CAD export |
| `state-store.js` | Editable state, debounced autosave, undo, per-field history, cross-section and cross-tab sync, corrupt-save recovery, CSV/JSON export. | ✅ in a browser |
| `i18n.js` | UZ/RU/EN runtime: Russian 3-form plurals, `м²`/`m²`, dates, money, status and category labels, coverage audit. | ✅ |
| `i18n.uz-ru-en.json` | 178 keys × 3 languages. | ✅ 100 % coverage, all three |
| `sample-plan-zarafshan-l2.svg` | A real CAD-exported mall floor plan from a previous CASE project. | input fixture |
| `test-fixture-zarafshan-l2.json` | The exact output the recognizer produces from it. | regression target |
| `INTEGRATION_CONTRACT.md` | The boundary between the leasing app and the geoanalytics app. **Give this to both chats.** | — |

---

## What the recognizer was proven on

`sample-plan-zarafshan-l2.svg` — 227 KB, 994 paths, 64 text nodes, Inkscape/AutoCAD export
with broken UTF-8 encoding (the usual CAD mojibake).

```
Codes on plan: 17
Printed areas: 13 (10 paired to a code)
Closed outlines: 641 (17 contain a code)
Scale: 1 unit² = 7.001e-8 m², R² = 0.999982 from 10 samples
7 area(s) derived from the outline — marked derived, not measured
[error] L2_3    code appears 2 times on this plan
[warn]  L2_1, L2_7, L2_8  resolved to the SAME outline
[info]  3 printed areas not paired to a code (16.3, 27.6, 5.6 — toilets)
```

**R² = 0.999982** means the outlines it selected reproduce the drawing's own printed areas
to within 0.002 %. It also finds the drawing's mistakes — a duplicated code and three units
sharing one outline — rather than hiding them.

### Two readers, and which to use

| Function | Geometry source | Scale R² on the test plan | Use it for |
|---|---|---|---|
| `readSvg(text)` | exact path data, parsed | **0.999982** | areas and outlines — the default |
| `readSvgLive(svgEl)` | `getBBox()` + `getCTM()` on the live DOM | 0.5985 | text positions when transforms defeat the static parser |

`readSvgLive` returns **bounding boxes**, not contours, so its areas are wrong for any
L-shaped unit. It exists because Illustrator and most CAD exporters position `<text>` with
`transform="matrix(...)"`, where naive parsing puts every label at ~0,0. Take its text
positions, not its shapes.

Both numbers above are measured, not estimated — re-run `test_v2.js` to confirm.

### Security: uploaded SVG is untrusted

A floor plan is a file a third party sent us, and SVG can carry script.

```js
host.innerHTML = PlanRecognizer.sanitizeSvg(uploadedText);   // never the raw text
```

Strips `script`, `foreignObject`, `animate`, `iframe`, `object`, `embed`, every `on*`
attribute, `javascript:`/`data:text/html` hrefs and `expression()` styles. Returns `''`
when the file will not parse. Ported from CASE OS `core.js sanitizePlanSvgDom()`.

### What is and is not automatic

| Input | Result |
|---|---|
| SVG from CAD / Revit / Inkscape | Fully automatic. |
| Vector PDF | Text and coordinates automatic; outlines need one manual pass. |
| Scanned PDF or image | **Nothing automatic.** No text exists to read. Manual calibration only. |

No OCR. No computer vision. No ML. Deterministic geometry and text parsing, so the same
plan always gives the same answer and every gap is reported.

---

## Re-running the checks

```bash
# recognizer, against the real plan
node test_recog.js            # expect the numbers in test-fixture-zarafshan-l2.json

# store: persistence, undo, sync, corruption recovery
node test_store.js            # expect zero page errors

# translation coverage
node -e "const I=require('./i18n.js'),d=require('./i18n.uz-ru-en.json');
['uz','ru','en'].forEach(l=>console.log(l,JSON.stringify(I.create(d,l).audit(l))))"
# expect ok:true and missing:[] for all three
```

---

## Notes for whoever builds on this

- `state-store.js` is the only writer. If a view mutates data directly, history, autosave
  and sync all silently stop working.
- Status keys stay Russian strings in the data — they are the join key with `LCR.xlsx`.
  Translate at display time only.
- `i18n.js` `audit()` has a short allow-list of words that are genuinely identical across
  languages (GLA, broker, status, Nodir, kiosk), so it reports honestly instead of
  producing false positives forever.
- Unknown is never zero. `L.area(null)` returns `—`; `calibrateScale` returns
  `scale: null` with a reason rather than a guess.
