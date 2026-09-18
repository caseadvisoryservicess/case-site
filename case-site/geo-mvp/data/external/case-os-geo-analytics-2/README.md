# CASE OS Geo Analytics 2 – two CASE-owned business centres

From the standalone page `CASE_OS_Geo_Analytics_2.html` (Russian UI, "Tashkent Office/BC
Benchmark"). Its embedded `BC` array is the prototype's 148 records plus **Botanica BC**
(Mirzo-Ulugbek) and **Taxtapul BC** (Shaykhontohur), provider `CASE (owner)` – projects CASE
itself is involved in. Coordinates and district only; no class, rent, GLA or year.

The page states two things worth keeping:
- The "benchmark" fields (class, floors, GLA, GBA, parking, year) are labelled *"заполняет
  команда CASE"* – to be entered by the CASE team. Their emptiness is pending work, not absence
  of the buildings' attributes.
- Listing prices from OLX / uybor were filtered on the word "office" and, where a board price
  was per object rather than per m², **disambiguated by plausibility of the rate ($2–60/m²)**.
  That heuristic is carried into the evidence note of every listing-class rent.

Ingested via `tools/collect.py --source SRC-CASE-OS-GEO2-BC --from <this file>`.

## `address_fills.json` – twenty addresses, withheld

The same page carries a street address for twenty buildings the prototype holds without one
(address coverage there is 129/150, here 109/148). All twenty are GoldenPages-sourced rows.
The archive's own `bc.json` – the origin of the 148 – holds those rows with `address` blank, so
this page is a **later collection state**, not a re-export.

The address text is directory content. CASE's own source register marks every GoldenPages entry
`license_review_required: Проверить` and clears none, so this file is registered as
`SRC-CASE-OS-GEO2-ADDR` with `storage: unverified`: the collector refuses, the proposal counts
all twenty as withheld, and one recorded terms check releases them.

```
python3 tools/collect.py --source SRC-CASE-OS-GEO2-ADDR \
        --from data/external/case-os-geo-analytics-2/address_fills.json \
        --i-have-checked-terms "Name of the person who read the terms"
```
