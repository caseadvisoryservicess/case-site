# TASHKENT CITY - ADMINISTRATIVE & GIS MASTER DATASET
**Prepared for:** CASE Real Estate Advisory - geoanalytics platform
**Access / verification date:** 2026-09-18
**CRS of all spatial outputs:** EPSG:4326 (WGS84), GeoJSON, CRS84 axis order (lon, lat)

---

## A) KEY DECISIONS / IMPLICATIONS

1. **An official mahalla polygon layer exists and is publicly queryable.** The Cadastre Agency's national geoportal (`open.ngis.uz`) is backed by an ArcGIS Enterprise service at `db.ngis.uz` whose **FeatureServer** allows `query`. Earlier assessments concluded mahalla polygons were unobtainable - that conclusion came from testing the **MapServer**, where query is disabled. This is the single most valuable finding here.
2. **585 mahallas is the confirmed current count**, matched independently by two sources: the Cadastre Agency's own MFY register and the 2023-2024 Tashkent City Kengash boundary decisions. Per-district counts agree exactly.
3. **402 of 585 mahallas (68.7%) now have official polygons**; the remaining 183 are simply not yet loaded - `create_at` timestamps run 2026-03-14 to 2026-08-27, i.e. loading was still in progress. **Re-run the refresh script monthly**; coverage should rise on its own.
4. **Official SOATO codes for all 12 districts are now fixed** (1726262 … 1726294) and the mahalla code is the district SOATO + a 3-digit suffix. This gives a clean, stable join key across every Uzbek government system.
5. **Do not use the service's `st_area_sh` field.** It is a Web-Mercator area and overstates true area by ~**1.772×** (= 1/cos²41.3°) - verified across all 12 districts (measured factors 1.767-1.779). All areas here were recomputed geodesically.
6. **Tashkent City's true area is 438.3-438.7 km²**, not the ~335 km² still widely cited. Most published per-district areas predate the 2021 city/region expansion and are materially too small - Mirzo Ulug'bek and Yashnobod are understated by ~70%.
7. **Mahalla-level population does not exist publicly - anywhere.** The deepest official population geography is the *tuman*. This is a publication-policy limit, not a search failure, and it is the main blocker for the platform. It needs a formal data request.
8. **The 2026 census is the key future unlock.** Uzbekistan's first post-Soviet census had a census moment of 2026-01-15; preliminary results (Tashkent City 3,224,838) were published 2026-07-07 but stop at city level. Monitor `aholi.stat.uz` for detailed tabulations.
9. **"Yangi Toshkent" is NOT a 13th district.** It is proposed and unenacted; every official source, including the cadastre district layer, returns exactly 12. Treat as pipeline risk, not current structure.
10. **Two high-value layers were located but not extracted**: `Hosted/TOSHKENT_NALOG_ZONE` (land-tax zones) and `Hosted/TOSHKENT_GENPLAN_3857` (master plan). Both are directly relevant to rent and land-value modelling and are the recommended next extraction.

---

## B) FILES

| File | Contents |
|---|---|
| `01_tashkent_districts.geojson` | 12 official district polygons + full attribute set |
| `02_tashkent_mahallas.geojson` | **402 official mahalla polygons** + full attribute set |
| `11_tashkent_mahalla_points.geojson` | 402 official mahalla centroids (point layer for labelling/joins) |
| `03_tashkent_districts.csv` | `TASHKENT_DISTRICTS` - one row per district |
| `04_tashkent_mahallas.csv` | `TASHKENT_MAHALLAS` - **all 585**, including the 183 without geometry |
| `05_tashkent_mahalla_demographics.csv` | `TASHKENT_MAHALLA_DEMOGRAPHICS` - long format, one row per entity × indicator × reference date |
| `06_tashkent_gis_sources.csv` | `TASHKENT_GIS_SOURCES` - every endpoint tested, including confirmed negatives |
| `07_tashkent_admin_changes.csv` | `TASHKENT_ADMIN_CHANGES` - 1992 → 2026, with legal act references |
| `08_tashkent_sources.csv` | `SOURCE_REGISTER` - every source, publication date vs data reference date |
| `09_tashkent_missing_data.csv` | `MISSING_DATA_AND_GAPS` - what is missing, what was searched, what to do next |
| `10_tashkent_mahalla_name_duplicates.csv` | Name-normalisation / disambiguation check |
| `refresh_tashkent_gis.py` | Standalone re-extraction at **full precision** |

---

## C) HOW THE DATA WAS OBTAINED, AND ITS LIMITS

**Extraction route.** The research container's egress policy blocks all `.uz` government hosts (and Overpass, HDX, geoBoundaries, Geofabrik). The cadastre services were therefore reached through the browser session, and the geometry was transferred into the workspace as polyline-encoded chunks. **Integrity was verified: 48,554 characters, checksum matched exactly - zero transcription error.**

**Simplification.** Because of that transfer route, the delivered polygons are simplified:

* districts - `maxAllowableOffset` 0.00003° (~3 m)
* mahallas - `maxAllowableOffset` 0.0001° (~9-11 m)

Measured effect, mahalla layer, against the server's own full-precision UTM areas:

| Check | Result |
|---|---|
| Mahallas cross-checked | 402 / 402 |
| Mean absolute area difference | **0.398 %** |
| Max absolute area difference | 2.876 % (1726290032) |
| Centroids | authoritative `returnCentroid` values used, not derived |
| Invalid geometries | **0** |
| Mahalla representative-points outside their own district | **0** |
| Sliver overlaps between neighbours | 158 pairs, total 0.0747 km² = **0.026 %** of mahalla area, median 293 m² |

The sliver overlaps are a pure artifact of simplification - adjacent polygons share a boundary in the source and drift apart by a few metres once generalised. Immaterial for catchment, density or tenant-mix analysis. **If you need topologically exact boundaries, run `refresh_tashkent_gis.py` from an Uzbek or unrestricted connection** - it applies no simplification at all.

**Independent decode validation.** District areas computed from the decoded geometry matched the server's UTM areas to 0.06-0.10 %. That residual is exactly the UTM scale-factor bias (0.9996² = 0.08 %), which confirms both the decoding and the projection handling are correct.

---

## D) CONFIDENCE GRADING

| Grade | Meaning | Applied to |
|---|---|---|
| **A** | Official and current | All geometry, all SOATO codes, the 585 register, 2025-10-01 and census populations, all cited legal acts |
| **B** | Official but older, or official with a caveat | SIAT 2026-Q1 populations (portal shows a TEST MODE banner, no stated licence) |
| **C** | Reliable secondary | Decision numbers sourced via Uzbek Wikipedia (counts independently re-confirmed), media reporting on boundary changes |
| **D** | Derived / reconstructed | Population density (computed, not published) |
| **E** | OSM / crowdsourced | Kontur, Geofabrik - listed in `06`, **not used** in any delivered value |
| **F** | Unverified | mc.uz master-plan service (returns a subscription error) |

`reference_date` and `publication_date` are kept strictly separate throughout - e.g. the Tashkent population figure published 2025-10-27 carries `reference_date = 2025-10-01`.

---

## E) RULES OBSERVED

* No value was fabricated or estimated. Unavailable data is `NULL` and is explained in `09`.
* Mahalla names are reproduced verbatim in Uzbek Latin as the official register publishes them. **Cyrillic and Russian forms were deliberately left `NULL` rather than machine-transliterated**, because several are proper nouns whose Russian forms differ from a letter-by-letter conversion (Olmazor / Алмазар, Sergeli / Сергели).
* Tashkent **City** (`1726`) is never mixed with Tashkent **Region** (`1727`); every query filtered on `soato_region='1726'`.
* Historical records are preserved alongside current ones, never overwritten.
* Reconstructed geometry is never presented as official. No OSM-derived geometry is included in any delivered layer.

---

## F) TWO DATA-INTEGRITY FLAGS FOR YOUR TEAM

1. **Ma'rifat / O'qchi-Olmazor (Yashnobod).** Decision 417/47-5 of 2019-01-12 renamed Ma'rifat to O'qchi-Olmazor, yet both `1726290048 Ma'rifat` and `1726290050 O'qchi Olmazor` are live in the 2026 register. Either the rename covered only part of the territory, or a new Ma'rifat was later created. Resolve against the Yashnobod 2024 boundary decision.
2. **"Surum" (Yangihayot).** Transferred into Yangihayot in 2020 from Quyichirchiq (128.7 ha) but absent from the current 30-mahalla register - probably merged or renamed between 2020 and 2024.

Only one duplicate mahalla name exists city-wide: **Mustaqillik**, in both Mirzo Ulug'bek (1726269040) and Olmazor (1726280001). These are distinct entities - do not merge. Always join on SOATO, never on name.
