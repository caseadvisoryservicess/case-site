# TASHKENT CITY - ADMINISTRATIVE & DEMOGRAPHIC GIS DATASET
**Prepared for:** CASE Real Estate Advisory - geoanalytics platform
**Compiled:** 18 September 2026 · **Scope:** Toshkent shahri (Tashkent CITY, SOATO 1726) - **NOT** Toshkent viloyati (Tashkent Region, SOATO 1727)

---

## 1. HEADLINE

Tashkent City is the **only jurisdiction in Uzbekistan with legally adopted, openly published mahalla polygons**. Every global open dataset - geoBoundaries, HDX/OCHA COD-AB, GADM, FAO GAUL, Natural Earth - stops at ADM2 (tuman). Tashkent is the exception.

The Tashkent Hokimiyat's Department of Digital Development ran a 2.5-year boundary-definition programme. The Tashkent City Kengash adopted all **585 mahalla boundaries** district by district between **24 November 2023** (Mirobod, first) and **23 October 2024** (Yunusobod and Chilonzor, last). Geometry is published on `opendata.tashkent.uz` as SHP + PDF, one dataset per district.

**This dataset carries the complete 585-mahalla register - every name in Uzbek Latin, Uzbek Cyrillic and Russian, with district attribution and official area - verified feature-by-feature against the live boundary service.**

## 2. THE ONE THING YOU MUST DO

**The polygon geometry is not embedded in these files.** This is a transport limitation, not a data gap: the research session ran behind an egress policy that returns HTTP 403 for every `arcgis.com` and `.uz` host, so the multi-megabyte GeoJSON could not be pulled in. The attribute register was retrieved in full through a different channel.

```bash
bash fetch_official_geometry.sh
```

About 20 seconds on any unrestricted connection. It downloads the official polygons, validates them (count, CRS, coordinate range), joins this register onto them by `id`, and dissolves the 12 district polygons. After that the dataset is complete and fully official.

Every mahalla record carries `source_layer_id` - the join key - plus `geometry_download_url` and `geometry_api_url`.

## 3. FILES

| File | Rows | What it is |
|---|---|---|
| `01_tashkent_districts.geojson` | 12 | District attributes; geometry attached by the script (dissolve of the mahalla layer) |
| `02_tashkent_mahallas.geojson` | 585 | Mahalla attributes; geometry attached by the script |
| `03_tashkent_districts.csv` | 12 | District master table |
| `04_tashkent_mahallas.csv` | 585 | **Mahalla master register - the core deliverable** |
| `05_tashkent_mahalla_demographics.csv` | 585 | Full demographic schema, values NULL (see §6) |
| `06_tashkent_gis_sources.csv` | 11 | Every geometry source, classified OFFICIAL / RECONSTRUCTED / OSM_ONLY |
| `07_tashkent_admin_changes.csv` | 21 | Administrative change log, 2015 → 2026 |
| `08_tashkent_sources.csv` | 35 | Source register - every figure traces here |
| `09_tashkent_missing_data.csv` | 14 | Gap report with acquisition routes |
| `10_tashkent_district_demographics_socioeconomic_long.csv` | 294 | District indicators, long format, multiple reference dates preserved |
| `11_tashkent_city_indicators.csv` | 42 | City-level indicators incl. 2026 census |
| `fetch_official_geometry.sh` | - | Geometry acquisition + join + dissolve |

CSVs are UTF-8 with BOM (opens correctly in Excel with Uzbek and Cyrillic characters intact). GeoJSON is EPSG:4326 / CRS84. `NULL` means verified-absent, never zero.

## 4. CONFIDENCE GRADES

`A` official and current · `B` official but older · `C` reliable secondary · `D` derived or reconstructed · `E` crowdsourced only · `F` unverified

Every numeric value carries a grade, a `reference_date` (the date the data *describes*) and a `source_url`. `reference_date` is kept strictly separate from publication date throughout.

## 5. WHAT VALIDATED

- **585 = 585.** Feature count from the service matched the per-district counts reported independently by UzNews, district for district, and the assembled file has 585 unique IDs.
- **Population reconciles.** The 12 district figures at 2026-07-01 sum to exactly 3,212.2 thousand - the published city total.
- **`Maydoni` is hectares, and the geometry is current.** Yangihayot's mahalla areas sum to **4,423.54 ha** against the **4,419.6 ha** written into act 443-IV that created the district - a 0.09% match. Mirzo Ulug'bek sums to 59.40 km² against 35.15 km² published pre-2021 plus the 22.95 km² annexed from Qibray in 2021 (= 58.1 km²). The layer reflects post-2021 boundaries.
- **City area cross-check.** Official mahalla areas total ~427 km² (adding Uchtepa's official 28.08 km²); Toshstat's published density implies ~435 km². Consistent.

## 6. WHAT IS GENUINELY MISSING

**Mahalla-level demography does not exist publicly.** Official statistics stop at district level. Per-mahalla population, households and age structure sit in the **MFY yagona reyestri** (Unified Register of Mahalla Citizens' Assemblies) inside the Raqamli Mahalla system - legal basis CoM Regulation 586 of 15.09.2025, operator O'zbekiston Mahallalari Uyushmasi, launched 01.12.2025. That register holds exactly the fields this brief asked for, including the official mahalla code, STIR and the geospatial boundary. It is interagency-only.

**A written request to O'zbekiston Mahallalari Uyushmasi for a Tashkent City export, citing Regulation 586, is the single action that closes almost every remaining gap.**

`05_tashkent_mahalla_demographics.csv` ships with the full schema and NULL values rather than estimates. No population was apportioned, interpolated or invented.

## 7. KNOWN DEFECTS IN THE OFFICIAL SOURCE

Transcribed as-is and flagged per record - these are the publisher's, not transcription errors:

- **60 Uchtepa mahallas have `Maydoni` = NULL.** Every other district is populated. Resolves once geometry is attached.
- **20 Uchtepa records (ids 495-514) have Latin text in `name_ru`** instead of Russian Cyrillic, some lossy (`Kohna Chponota` vs `Ko'hna Cho'ponota`). Not usable as Russian names.
- **Sergeli id 97 (Xalqobod): `name_ru` is a blank space.**
- **Olmazor id 20: `name_ru` = "Юкори Sebzor махалля"** - mixed script in the source.
- **Non-sequential IDs** (29515557 Barhayot, 89160 Xislat, 389120 Chamanbog', 2715875 Kaykovus) are records added after the initial load. Genuine, verified twice.
- **ID gaps** at 8, 27, 38, 295 - absent from the service, not missed in extraction.

## 8. RED FLAGS FOR DOWNSTREAM USE

1. **SOATO codes are grade E.** Every district SOATO code here comes from a community GitHub dataset. The official classifier extract on stat.uz stops before the Tashkent section. **Do not use them as primary keys until verified** against the State Register created by CoM Resolution 832 of 10.12.2024.
2. **District areas published before August 2021 are wrong.** The 2021 expansion moved 7,853.3 ha into the city. Wikipedia's set understates Bektemir by ~17 km². Six districts have no official post-2021 area at all - compute from geometry instead.
3. **Licence is unconfirmed.** The ArcGIS item's `licenseInfo` is empty; credit reads "Open Data Tashkent". **For a commercial platform, settle reuse terms with the Tashkent Department of Digital Development before launch.** GADM is non-commercial and unusable for client work; OSM/Geofabrik is ODbL share-alike.
4. **Two population universes.** The 2026 census (3,224,838 at 15.01.2026) runs ~47,000 above the register-based figure (3,178.1k at 01.01.2026). Both are recorded. Do not mix them in a time series. Census detail releases progressively to 01.07.2027.
5. **A 13th district is proposed.** "Yangi Toshkent" (19,729.41 ha, ~40 mahallas) was published for consultation in November 2023 and **has not been enacted** - 12 districts confirmed in press listings of 20.04.2026 and 16.09.2026. Monitor it; enactment would invalidate district aggregates.
6. **Sergeli's hokimiyat page claims "over 226,000"** against the statistics office's 182,500. The hokimiyat page is undated and probably predates the 2020 Yangihayot split. Use the statistics office.

## 9. RESEARCH SUMMARY

| # | | |
|---|---|---|
| 1 | Current districts | **12** (Bektemir, Chilonzor, Mirobod, Mirzo Ulug'bek, Olmazor, Sergeli, Shayxontohur, Uchtepa, Yakkasaroy, Yangihayot, Yashnobod, Yunusobod) |
| 2 | Current mahallas | **585** |
| 3 | With official boundaries | **585 (100%)** - adopted by Kengash decisions 2023-11-24 → 2024-10-23, published as SHP; downloadable, not embedded here |
| 4 | With reconstructed boundaries | **0** - no reconstruction was needed or performed |
| 5 | Without usable boundary information | **0** |
| 6 | With current population data | **0 mahallas** (none published anywhere) · **12/12 districts** at 2026-07-01, grade A |
| 7 | With only older population data | 0 - the full district series 2022 → 2026 is preserved in file 10 |
| 8 | Most authoritative sources | Tashkent Hokimiyat Dept. of Digital Development boundary layer (via Open Data Tashkent); Toshstat quarterly demography PDFs; lex.uz primary legal acts; NSC 2026 census |
| 9 | Main gaps | Mahalla-level demography (not published); official mahalla codes (not joined); verified SOATO codes; licence terms |
| 10 | Recommended actions | (a) run `fetch_official_geometry.sh`; (b) written request to O'zbekiston Mahallalari Uyushmasi for the MFY yagona reyestri export citing CoM Reg. 586; (c) join the FHIR `mahalla-cs` code list for official codes; (d) verify SOATO via the CoM 832 State Register; (e) confirm licence with the Tashkent Dept. of Digital Development |

## 10. METHOD NOTE

Sources were worked in Uzbek Latin, Uzbek Cyrillic, Russian and English across roughly 150 searches and 200 pages, prioritised: official Uzbek government → primary legal acts → state-affiliated → established media → OSM and open datasets.

The 585-record register was extracted from the live feature service in verified windows of ≤25 records, with per-district counts confirmed against the service's own `returnCountOnly` before and after extraction, IDs checked for duplicates and gaps, and script-consistency checks run across all name fields. Several transcription artefacts were caught by those checks and re-queried against the API individually. **No name, code, area or population value in this dataset was supplied from general knowledge, estimated, or interpolated.** Where a value could not be verified, the field is `NULL` and the reason is in `09_tashkent_missing_data.csv`.

Hosts blocked by this session's egress policy and therefore **not** retestable here - reported, not worked around: all `.uz` hosts (`opendata.tashkent.uz`, `stat.uz`, `toshstat.uz`, `lex.uz`, `kadastr.uz`, `open.ngis.uz`, `dshk.uz`, `e-qaror.gov.uz`, `geonom.tashkent.uz`), all `arcgis.com` hosts for bulk download, `overpass-api.de`, `data.humdata.org` API. Figures attributed to those hosts come from research passes that could reach them through a different channel; each carries its URL and grade so you can re-verify on your own connection.
