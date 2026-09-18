---
name: geospatial-data-engineer
description: Coordinates, projections, district geometry, distance, matching and the ETL that turns source files into data/seed.json. Load before editing tools/build_seed.py, tools/merge_incoming.py, src/js/09-geo.js, the district boundaries, or anything that computes a distance or a containment.
---

# Geospatial data engineer

## Purpose

Every location claim in the product – which district, how far, what is nearby, is this the same
building – rests on a handful of geometric decisions. Get one wrong and every marker looks like a
data error. This skill holds those decisions and their reasons.

## Responsibilities

- Own the ETL (`tools/build_seed.py`): source rows → canonical records, district resolution by
  geometry, duplicate detection, entity review flags, evidence profiles, the dataset envelope.
- Own geometry helpers (`09-geo.js`): haversine (`R = 6371008.8` m), point-in-polygon,
  `districtAt`, bounds, cumulative radius bands, Douglas–Peucker simplification (~9 m).
- Own the matching rules in `merge_incoming.py`: coordinates AND name, never either alone.
- Own CRS discipline: WGS84 storage, EPSG:3857 display, and the explicit refusal to mix.

## Constraints

1. **Geometry is authoritative.** `districtKey` = polygon containing the point. The source label
   is retained as `sourceDistrictLabel` and surfaced as a *conflict*, never overwritten and never
   used for counting. `etl_districts_check.py` re-audits; 10 of 148 disagree today.
2. **Coordinates are never invented, rounded to "the district centre", or geocoded from an
   address by this pipeline.** An observation without coordinates is `unmatchable`, not `new`.
3. **Matching**: `AUTO_MATCH_M = 40` with strong name similarity → matched; 40–150 m or weak
   name → review; two equally good candidates → ambiguous (a person decides). A business centre
   and the café in its lobby are 15 m apart and share nothing else.
4. **Name similarity strips the words every centre shares** ("бизнес центр", "business center",
   "tower", "plaza") so two unrelated towers do not match on them; containment handles
   "Trilliant" vs "Trilliant Business Center". Cyrillic and Latin spellings are NOT forced
   together automatically.
5. **Duplicates**: coordinate collisions (6 source-flagged groups) plus 3 unflagged sub-30 m
   pairs plus proximity-gated name pairs, all shipped `undecided`.
6. **Projection**: every provider here is EPSG:3857 except Yandex's basemap (EPSG:3395). At
   Tashkent's latitude an unreprojected Yandex tile sits a few hundred metres off the markers.
   The registry says so; the code refuses to pretend otherwise.
7. **Yandex Geosearch returns `[lon, lat]`**; the adapter asserts the order rather than assuming.
8. **Bounding box for every query**: south 41.16, west 69.12, north 41.40, east 69.42.
9. **Simplification is for rendering only**; analysis uses the unsimplified polygons.

## Validation checklist

- [ ] `python3 tools/build_seed.py` reproduces `data/seed.json` byte-for-byte (`verify.sh`).
- [ ] `python3 tools/etl_districts_check.py` – 0 outside boundary; conflicts listed by name.
- [ ] `python3 tools/name_dupes.py` – candidates listed with distance.
- [ ] `python3 tools/test_merge.py` – 0.01° latitude ≈ 1112 m; 3 m auto-matches; same point
      with unrelated name → review; 60 km → new; no coords → unmatchable.
- [ ] Self-test: Trilliant bands 7/74/114; districts 28/26/24/22/17/13/10/4/3/1/0/0.

## Examples

**Right.** Trilliant: source says Mirzo-Ulugbek, polygon says Yunusobod → `districtKey:
'yunusobod'`, `districtConflict: true`, both shown on the card with the explanation.

**Wrong.** Nudging a point 60 m so it falls inside the district its label names.

**Wrong.** Merging "Бизнес центр 2" into "Бизнес центр" because they are 148 m apart in the
same district – that is a review item, not a match.

## Prohibited behaviour

- Any geocoding, centroid substitution, or coordinate "cleanup" that moves a point.
- Counting by source label.
- Auto-merging on distance alone or name alone.
- Loading tiles in a projection the map does not use.
