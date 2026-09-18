# Tashkent City Administrative, Demographic and GIS Research Database

**Research date:** 2026-09-18  
**Geographic scope:** Tashkent City, Uzbekistan  
**Administrative scope:** Tashkent City → District/Tuman → Mahalla/MFY  
**Primary purpose:** Commercial geoanalytics and GIS database preparation  
**Status:** Research compilation; several official source files still require direct download and validation.

---

## Important Data Qualification

This document distinguishes among:

- **A - Official and current**
- **B - Official but older**
- **C - Reliable secondary source**
- **D - Reconstructed or reported from multiple sources**
- **E - OSM/crowdsourced only**
- **F - Unverified or not directly extracted**

Values marked `NULL` were not verified and must not be estimated.

Search-result summaries and dataset leads are not treated as fully validated until the underlying official file, legal act, annex, or GIS download has been directly inspected.

---

# 1. Executive Summary

| Indicator | Result |
|---|---:|
| Current Tashkent City districts | 12 |
| Current mahalla total | Not independently verified |
| 2026 Tashkent City population reported | 3,212,200 |
| 2026 population reference date | 2026-07-01 |
| 2024 Tashkent City population | 3,040,800 |
| 2024 population reference date | 2024-01-01 |
| Complete current mahalla register extracted | No |
| Complete current mahalla polygon layer extracted | No |
| Mahalla-level 2026 population data extracted | No |
| Official GIS layer leads located | Yes |
| Yangihayot district creation verified | Yes, legal source located |
| Complete mahalla change history verified | No |

---

# 2. Current Tashkent City Districts

Tashkent City currently has 12 districts:

1. Bektemir
2. Chilonzor
3. Mirzo Ulug‘bek
4. Mirobod
5. Sergeli
6. Shayxontohur
7. Uchtepa
8. Olmazor
9. Yunusobod
10. Yashnobod
11. Yakkasaroy
12. Yangihayot

## TASHKENT_DISTRICTS

| district_id | district_name_uz_latin | district_name_uz_cyrillic | district_name_ru | district_name_en | official_name | alternative_names | former_names | administrative_code | SOATO_code | cadastre_code | parent_city | area_km2 | population_total | population_date | population_male | population_female | households | families | population_density_per_km2 | number_of_mahallas | district_center | latitude_centroid | longitude_centroid | official_boundary_available | boundary_source | boundary_source_url | boundary_date | legal_document_defining_boundary | legal_document_date | legal_document_url | last_verified_date | confidence | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---|---|---|---|---|---|---|---|---|---|
| TSH-01 | Bektemir | Бектемир тумани | Бектемирский район | Bektemir District | Bektemir tumani | Bektemir | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | Tashkent City Administration | https://tashkent.uz/en/districts | NULL | NULL | NULL | NULL | 2026-09-18 | B | Current district confirmed; metrics not extracted |
| TSH-02 | Chilonzor | Чилонзор тумани | Чиланзарский район | Chilanzar District | Chilonzor tumani | Chilanzar, Chilanzor | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 55* | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/ | 2024-10-24* | Tashkent City Council decision VI-109-174-14-0-K/24* | 2024-10-23* | https://opendata.tashkent.uz/ | 2026-09-18 | D | Mahalla count requires feature-level validation |
| TSH-03 | Mirzo Ulug‘bek | Мирзо Улуғбек тумани | Мирзо-Улукбекский район | Mirzo Ulugbek District | Mirzo Ulug‘bek tumani | Mirzo Ulugbek | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/data/139 | 2024-04-03* | Tashkent City Council decision VI-99-35-14-0-K/24* | 2024-04-02* | https://opendata.tashkent.uz/data/139 | 2026-09-18 | D | Official thematic-layer lead found |
| TSH-04 | Mirobod | Миробод тумани | Мирабадский район | Mirobod District | Mirobod tumani | Mirabad, Mirobod | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/ | 2023-11-24* | Tashkent City Council decision VI-93-256-14-0-K/23* | 2023-11-24* | https://opendata.tashkent.uz/ | 2026-09-18 | D | Layer lead found; legal annex not inspected |
| TSH-05 | Sergeli | Сергели тумани | Сергелийский район | Sergeli District | Sergeli tumani | Sergeli | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | Tashkent City Administration | https://tashkent.uz/en/districts | NULL | NULL | NULL | NULL | 2026-09-18 | B | Current district confirmed |
| TSH-06 | Shayxontohur | Шайхонтоҳур тумани | Шайхантахурский район | Shaykhantahur District | Shayxontohur tumani | Shaykhantahur, Shaikhontakhur | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 64* | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/ | NULL | NULL | NULL | https://opendata.tashkent.uz/ | 2026-09-18 | D | Count requires validation |
| TSH-07 | Uchtepa | Учтепа тумани | Учтепинский район | Uchtepa District | Uchtepa tumani | Uchtepa | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 60* | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/ | 2024-09-05* | Tashkent City Council decision VI-107-144-14-0-K/24* | 2024-09-04* | https://opendata.tashkent.uz/ | 2026-09-18 | D | Count requires validation |
| TSH-08 | Olmazor | Олмазор тумани | Алмазарский район | Almazar District | Olmazor tumani | Almazar, Olmazor | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 64* | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/ | 2024-07-31* | Tashkent City Council decision VI-105-114-14-0-K/24* | 2024-07-31* | https://opendata.tashkent.uz/ | 2026-09-18 | D | Count requires validation |
| TSH-09 | Yunusobod | Юнусобод тумани | Юнусабадский район | Yunusabad District | Yunusobod tumani | Yunusabad, Yunusobod | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | 64* | NULL | NULL | NULL | POSSIBLE | Open Data Tashkent | https://opendata.tashkent.uz/ | 2024-10-24* | Tashkent City Council decision VI-109-173-14-0-K/24* | 2024-10-23* | https://opendata.tashkent.uz/ | 2026-09-18 | D | Count requires validation |
| TSH-10 | Yakkasaroy | Яккасарой тумани | Яккасарайский район | Yakkasaray District | Yakkasaroy tumani | Yakkasaray | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | Tashkent City Administration | https://tashkent.uz/en/districts | NULL | NULL | NULL | NULL | 2026-09-18 | B | Current district confirmed |
| TSH-11 | Yashnobod | Яшнобод тумани | Яшнабадский район | Yashnabad District | Yashnobod tumani | Yashnabad | NULL | NULL | NULL | NULL | Tashkent City | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | NULL | Tashkent City Administration | https://tashkent.uz/en/districts | NULL | NULL | NULL | NULL | 2026-09-18 | B | Current district confirmed |
| TSH-12 | Yangihayot | Янгиҳаёт тумани | Янгиҳаётский район | Yangihayot District | Yangihayot tumani | Yangihayot | NULL | NULL | NULL | NULL | Tashkent City | 44.2* | NULL | NULL | NULL | NULL | NULL | NULL | 30* | NULL | NULL | NULL | OFFICIAL LEGAL BASIS | LexUZ / Presidential Resolution | https://lex.uz/docs/7564429 | 2020-11-11 | Presidential Resolution No. PQ-4888 | 2020-11-11 | https://lex.uz/docs/7564429 | 2026-09-18 | A/B | Area and mahalla count require direct legal-document verification |

`*` Reported in search results but not independently validated against the original downloadable file or legal annex.

---

# 3. Tashkent City Demographic Figures

## 3.1 Latest 2026 Figure

| indicator | value | unit | reference_date | publication_date | source_name | source_url | source_type | confidence | notes |
|---|---:|---|---|---|---|---|---|---|---|
| Tashkent City population | 3,212,200 | persons | 2026-07-01 | 2026 | National Statistics Committee | https://stat.uz/img/press-relizlar/q2_2026-en.pdf | Official demographic statistics | B | Latest figure located; underlying table should be downloaded and checked |
| Tashkent City male population | 1,630,000 approximately | persons | 2026-07-01 | 2026 | National Statistics Committee search summary | https://stat.uz/img/press-relizlar/q2_2026-en.pdf | Official source summary / derived estimate | D | Do not treat as exact until direct city table is verified |
| Tashkent City female population | 1,582,000 approximately | persons | 2026-07-01 | 2026 | National Statistics Committee search summary | https://stat.uz/img/press-relizlar/q2_2026-en.pdf | Official source summary / derived estimate | D | Do not treat as exact until direct city table is verified |
| Annual population growth | +2.1% | percent | 2025-2026 | 2026 | National Statistics Committee | https://stat.uz/img/press-relizlar/q2_2026-en.pdf | Official demographic statistics | B | Geographic detail requires verification |
| Births | NULL | persons | Jan-Jun 2026 | 2026 | National Statistics Committee | https://stat.uz/en/official-statistics/demography | Official statistics | F | City value not extracted |
| Deaths | NULL | persons | Jan-Jun 2026 | 2026 | National Statistics Committee | https://stat.uz/en/official-statistics/demography | Official statistics | F | City value not extracted |
| Migration in | NULL | persons | Jan-Jun 2026 | 2026 | National Statistics Committee | https://stat.uz/en/official-statistics/demography | Official statistics | F | City value not extracted |
| Migration out | NULL | persons | Jan-Jun 2026 | 2026 | National Statistics Committee | https://stat.uz/en/official-statistics/demography | Official statistics | F | City value not extracted |
| Households | NULL | households | 2026 | 2026 | 2026 Census portal | https://aholi.stat.uz/en/ | Official census source | F | No verified Tashkent table extracted |
| Age structure | NULL | persons/percent | 2026 | 2026 | 2026 Census portal | https://aholi.stat.uz/en/ | Official census source | F | No verified Tashkent table extracted |

## 3.2 Older Official Comparison Figure

| indicator | value | unit | reference_date | source_name | source_url | confidence |
|---|---:|---|---|---|---|---|
| Tashkent City resident population | 3,040,800 | persons | 2024-01-01 | National Statistics Committee | https://stat.uz/en/press-center/news-of-committee/49989-toshkent-shahri-doimiy-ah-olisi-sonining-taqsimlanishi-4 | B |
| Female population | 1,548,700 | persons | 2024-01-01 | National Statistics Committee | https://stat.uz/en/press-center/news-of-committee/49989-toshkent-shahri-doimiy-ah-olisi-sonining-taqsimlanishi-4 | B |
| Male population | 1,492,100 | persons | 2024-01-01 | National Statistics Committee | https://stat.uz/en/press-center/news-of-committee/49989-toshkent-shahri-doimiy-ah-olisi-sonining-taqsimlanishi-4 | B |

---

# 4. 2026 Census Information

| field | value | source | confidence | notes |
|---|---|---|---|---|
| Census | Population and Agricultural Census | https://gov.uz/en/pages/2026 | B | Official census program |
| Enumeration period | 2026-01-15 to 2026-02-28 | https://gov.uz/en/pages/2026 | B | Verify against official census notice |
| Preliminary-results publication date | 2026-06-30 | https://aholi.stat.uz/en/ | D | Search-result claim; verify on source page |
| Final detailed results | Expected after preliminary release; reported as 2027 | https://stat.uz/img/press-relizlar/q2_2026-en.pdf | D | Exact release date not verified |
| Mahalla-level data | Expected or potentially available through census/open-data systems | https://aholi.stat.uz/en/ | F | No verified downloadable mahalla table extracted |

---

# 5. District-Level 2026 Demography

No verified district-level 2026 population values were directly extracted in this research session.

The following fields remain `NULL` pending download and inspection of official files:

```text
population_total
population_reference_date
population_male
population_female
births
deaths
migration_in
migration_out
households
families
age structure
working-age population
elderly population
population density
```

Recommended sources:

- https://stat.uz/en/official-statistics/demography
- https://stat.uz/uz/open-data/demography
- https://aholi.stat.uz/en/
- https://opendata.tashkent.uz/eng/data/41

---

# 6. TASHKENT_MAHALLAS

A complete current list of all mahallas was not directly extracted from a single verified official register.

## Mahalla Register Status

| district | reported_mahalla_count | complete_names_extracted | official_current_register | confidence | notes |
|---|---:|---|---|---|---|
| Bektemir | NULL | No | No | F | Current registry required |
| Chilonzor | 55* | No | No | D | Official thematic-layer lead found |
| Mirzo Ulug‘bek | NULL | No | No | F | Thematic-layer lead found |
| Mirobod | NULL | No | No | F | Thematic-layer lead found |
| Sergeli | NULL | No | No | F | Current registry required |
| Shayxontohur | 64* | No | No | D | Count requires validation |
| Uchtepa | 60* | No | No | D | Count requires validation |
| Olmazor | 64* | No | No | D | Count requires validation |
| Yunusobod | 64* | No | No | D | Count requires validation |
| Yakkasaroy | NULL | No | No | F | Current registry required |
| Yashnobod | NULL | No | No | F | Current registry required |
| Yangihayot | 30* | No | No | D | Legal and district sources require validation |

## TASHKENT_MAHALLAS Schema

The following fields are required for every mahalla once the official register is obtained:

```text
mahalla_id
official_unique_code
mahalla_name_uz_latin
mahalla_name_uz_cyrillic
mahalla_name_ru
mahalla_name_en
official_full_name
short_name
alternative_spellings
former_names
mahalla_type
district_name
district_id
SOATO_code_if_available
TIN_STIR_if_available
official_registration_number
date_created
date_renamed
date_merged
date_boundary_changed
legal_document_number
legal_document_date
legal_document_url
mahalla_office_address
mahalla_center_latitude
mahalla_center_longitude
official_boundary_available
geometry_available
geometry_source
geometry_date
boundary_status
last_verified_date
notes
```

No mahalla names, codes, addresses, demographic values, or boundaries should be invented to fill this table.

---

# 7. TASHKENT_MAHALLA_DEMOGRAPHICS

No verified mahalla-level 2026 demographic observations were extracted.

## Required Demographic Schema

```text
mahalla_id
mahalla_name
district_id
district_name
population_total
population_reference_date
population_male
population_female
number_of_families
number_of_households
average_household_size
children_total
population_age_0_6
population_age_7_17
population_age_18_30
population_age_31_45
population_age_46_60
population_age_60_plus
working_age_population
elderly_population
registered_population
permanent_population
temporary_population
births
deaths
migration_in
migration_out
population_growth
area_km2
population_density_per_km2
value_unit
source_name
source_url
source_type
confidence_level
reference_date
last_verified_date
notes
```

For unavailable fields, use `NULL`.

---

# 8. TASHKENT_GIS_SOURCES

| entity_type | entity_name | district | geometry_status | geometry_format | coordinate_system | source_authority | source_name | source_url | download_url | api_url | reference_date | access_date | confidence | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| district | Tashkent City district territory | All districts | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | District territory area dataset | https://opendata.tashkent.uz/ | https://opendata-back.tashkent.uz/en/api/data/all/67/download | NULL | 2024-12-02* | 2026-09-18 | D | Download and inspect |
| mahalla | Yunusobod mahalla layer | Yunusobod | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/ | https://opendata-back.tashkent.uz/en/api/data/all/819/download | NULL | 2024-10-24* | 2026-09-18 | D | Dataset ID reported by search result |
| mahalla | Chilonzor mahalla layer | Chilonzor | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/ | https://opendata-back.tashkent.uz/en/api/data/all/291/download | NULL | 2024-10-24* | 2026-09-18 | D | Dataset ID reported by search result |
| mahalla | Uchtepa mahalla layer | Uchtepa | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/ | https://opendata-back.tashkent.uz/en/api/data/all/153/download | NULL | 2024-09-05* | 2026-09-18 | D | Dataset ID reported by search result |
| mahalla | Olmazor mahalla layer | Olmazor | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/ | https://opendata-back.tashkent.uz/en/api/data/all/197/download | NULL | 2024-07-31* | 2026-09-18 | D | Dataset ID reported by search result |
| mahalla | Mirzo Ulug‘bek mahalla layer | Mirzo Ulug‘bek | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/data/139 | https://opendata-back.tashkent.uz/en/api/data/all/346/download | NULL | 2024-04-03* | 2026-09-18 | D | Dataset ID reported by search result |
| mahalla | Shayxontohur mahalla layer | Shayxontohur | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/ | https://opendata-back.tashkent.uz/en/api/data/all/179/download | NULL | NULL | 2026-09-18 | D | Dataset ID reported by search result |
| mahalla | Mirobod mahalla layer | Mirobod | POSSIBLE_OFFICIAL | Unknown | Unknown | Tashkent City Administration | Mahalla boundary thematic layer | https://opendata.tashkent.uz/ | NULL | NULL | 2023-11-24* | 2026-09-18 | D | Download URL not located |
| district | Tashkent City districts | All districts | OSM_ONLY | GeoJSON | Likely EPSG:4326 | Community source | GeoJSON-Uzbekistan | https://github.com/akbartus/GeoJSON-Uzbekistan | Repository files | NULL | NULL | 2026-09-18 | E | OSM-derived; not official |

`*` Reported in search results and requiring direct file verification.

## GIS Validation Requirements

Before using any geometry commercially:

1. Download the source file.
2. Record file checksum.
3. Identify actual file format.
4. Inspect CRS metadata.
5. Count features.
6. Validate geometry.
7. Check for gaps and overlaps.
8. Compare boundary names with the current official register.
9. Record legal approval and publication date.
10. Reproject to EPSG:4326 only after confirming the source CRS.

---

# 9. Historical Administrative Changes

## TASHKENT_ADMIN_CHANGES

| change_date | entity_type | old_name | new_name | old_district | new_district | change_type | legal_document | source_url | description | confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 2020-11-11 | District | NULL | Yangihayot | Sergeli, Bektemir, Zangiota, Quyichirchiq, Yangiyol, O‘rtachirchiq | Yangihayot | District creation and territory transfer | Presidential Resolution No. PQ-4888 | https://lex.uz/docs/7564429 | Yangihayot was established from territories of Tashkent City and Tashkent Region districts | A/B |
| 2020-11-12* | District | NULL | Yangihayot | Same as above | Yangihayot | Effective date | Presidential Resolution No. PQ-4888 | https://lex.uz/docs/7564429 | Effective date reported in search result; verify in legal text | B |
| 2024-04-02* | Mahalla boundaries | Existing layer | Revised thematic layer | Mirzo Ulug‘bek | Mirzo Ulug‘bek | Boundary-layer approval/revision | Tashkent City Council decision VI-99-35-14-0-K/24 | https://opendata.tashkent.uz/data/139 | Reported legal basis for Mirzo Ulug‘bek thematic layer | D |
| 2024-07-31* | Mahalla boundaries | Existing layer | Revised thematic layer | Olmazor | Olmazor | Boundary-layer approval/revision | Tashkent City Council decision VI-105-114-14-0-K/24 | https://opendata.tashkent.uz/ | Reported legal basis; annex not inspected | D |
| 2024-09-04* | Mahalla boundaries | Existing layer | Revised thematic layer | Uchtepa | Uchtepa | Boundary-layer approval/revision | Tashkent City Council decision VI-107-144-14-0-K/24 | https://opendata.tashkent.uz/ | Reported legal basis; annex not inspected | D |
| 2024-10-23* | Mahalla boundaries | Existing layer | Revised thematic layer | Yunusobod | Yunusobod | Boundary-layer approval/revision | Tashkent City Council decision VI-109-173-14-0-K/24 | https://opendata.tashkent.uz/ | Reported legal basis; annex not inspected | D |
| 2024-10-23* | Mahalla boundaries | Existing layer | Revised thematic layer | Chilonzor | Chilonzor | Boundary-layer approval/revision | Tashkent City Council decision VI-109-174-14-0-K/24 | https://opendata.tashkent.uz/ | Reported legal basis; annex not inspected | D |
| 2023-11-24* | Mahalla boundaries | Existing layer | Revised thematic layer | Mirobod | Mirobod | Boundary-layer publication/revision | Tashkent City Council decision not identified | https://opendata.tashkent.uz/ | Thematic-layer date reported; legal act requires verification | D |

A complete history of mahalla creation, merger, renaming, abolition, and transfer was not established.

## Yangihayot Territory Information

The following territory transfers were reported:

| originating district | reported transferred area |
|---|---:|
| Sergeli | 1,864.2 hectares |
| Bektemir | 267.0 hectares |
| Zangiota | 492.0 hectares |
| Quyichirchiq | 128.7 hectares |
| Yangiyol | 264.4 hectares |
| O‘rtachirchiq | 1,403.3 hectares |
| **Total** | **approximately 4,420 hectares / 44.2 km²** |

Primary legal source:

- https://lex.uz/docs/7564429

The exact transferred mahalla list and legal boundary description must be extracted from the resolution annexes.

---

# 10. Source Register

## SOURCE_REGISTER

| SOURCE_ID | source_title | organization | source_type | publication_date | data_reference_date | URL | what_data_was_extracted | geographic_scope | official_or_secondary | confidence | comments |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SRC-001 | Distribution of the resident population in Tashkent City | National Statistics Committee | Official statistics | NULL | 2024-01-01 | https://stat.uz/en/press-center/news-of-committee/49989-toshkent-shahri-doimiy-ah-olisi-sonining-taqsimlanishi-4 | City population, male and female totals | Tashkent City | Official | B | District table not extracted |
| SRC-002 | Demographic situation in the Republic of Uzbekistan | National Statistics Committee | Official statistics PDF | 2026 | 2026-07-01 | https://stat.uz/img/press-relizlar/q2_2026-en.pdf | 2026 Tashkent City population figure and growth information | Uzbekistan/Tashkent | Official | B | File-level verification recommended |
| SRC-003 | Demography | National Statistics Committee | Official statistics portal | Current | 2026 | https://stat.uz/en/official-statistics/demography | Demographic data source | Uzbekistan | Official | B | District files require download |
| SRC-004 | Open demographic data | National Statistics Committee | Official open data | Current | 2026 | https://stat.uz/uz/open-data/demography | Demographic tables | Uzbekistan | Official | F | Exact files not extracted |
| SRC-005 | 2026 Census portal | National Statistics Committee | Official census portal | 2026 | 2026 | https://aholi.stat.uz/en/ | Census information | Uzbekistan | Official | F | Mahalla tables not extracted |
| SRC-006 | Tashkent City districts | Tashkent City Administration | Official administrative page | Current | Current | https://tashkent.uz/en/districts | Current district names | Tashkent City | Official | B | Does not expose all metrics |
| SRC-007 | Population of the capital | Tashkent Open Data | Official open data | 2024-04-14* | 2024* | https://opendata.tashkent.uz/eng/data/41 | District population dataset lead | Tashkent City | Official | D | Download and inspect |
| SRC-008 | District territory area dataset | Tashkent Open Data | Official open data | 2024-12-02* | 2024* | https://opendata.tashkent.uz/ | District area dataset lead | Tashkent City | Official | D | Dataset ID 67 reported |
| SRC-009 | Mahalla thematic layer - Mirzo Ulug‘bek | Tashkent Open Data | Official geospatial data | 2024-04-03* | 2024* | https://opendata.tashkent.uz/data/139 | Boundary-layer lead | Mirzo Ulug‘bek | Official | D | File and CRS not inspected |
| SRC-010 | Mahalla thematic layers | Tashkent Open Data | Official geospatial data | 2023-2024* | 2023-2024* | https://opendata.tashkent.uz/eng/?page=1&category__id=3 | District boundary-layer leads | Multiple districts | Official | D | Individual files require validation |
| SRC-011 | Yangihayot establishment resolution | President of Uzbekistan / LexUZ | Official legal act | 2020-11-11 | 2020-11-11 | https://lex.uz/docs/7564429 | District creation and territory transfers | Tashkent City and adjacent districts/regions | Official | A/B | Annexes require extraction |
| SRC-012 | UNFPA preliminary census summary | UNFPA Uzbekistan | Institutional secondary source | 2026 | 2026 | https://uzbekistan.unfpa.org/en/news/uzbekistan-presented-preliminary-results-population-and-agricultural-census | Preliminary census context | Uzbekistan | Institutional | C | Requires comparison with StatCom |
| SRC-013 | Digital Mahalla portal | Mahalla system | Official digital platform | Current | Current | https://mahalla.ijro.uz/ | Registry/API access lead | Uzbekistan | Official | F | Login/access controlled |
| SRC-014 | Online Mahalla | Mahalla system | Official digital platform | Current | Current | https://online-mahalla.uz/ | Registry access lead | Uzbekistan | Official | F | No public API verified |
| SRC-015 | GeoJSON-Uzbekistan | GitHub community repository | Community geodata | NULL | NULL | https://github.com/akbartus/GeoJSON-Uzbekistan | OSM-derived district geometry | Uzbekistan/Tashkent | Secondary/OSM | E | Not official |

---

# 11. TASHKENT_MISSING_DATA

| entity | missing_field | what_was_searched | best_source_found | why_data_is_still_missing | recommended_next_source | official_information_request_needed |
|---|---|---|---|---|---|---|
| All districts | Administrative codes | Tashkent administration, Open Data Tashkent, statistical sources | Tashkent administration and SIAT classifier | No verified code table extracted | National Statistics Committee classifier | Yes |
| All districts | SOATO codes | Statistical classifier sources | SIAT/stat.uz | Exact district records not extracted | SIAT classifier | Yes |
| All districts | Cadastral codes | Cadastral and city portals | Cadastre Agency lead | No verified public table found | Cadastre Agency | Yes |
| All districts | 2026 population | Stat.uz demographic portal | Q2 2026 demographic PDF | District rows not extracted | Stat.uz downloadable district tables | Possibly |
| All districts | Births and deaths | Stat.uz demographic portal | Stat.uz demography | District data not extracted | Monthly/quarterly demographic files | Possibly |
| All districts | Migration | Stat.uz demographic portal | Stat.uz demography | District data not extracted | Migration statistical tables | Possibly |
| All districts | Households and families | Census portal and Digital Mahalla | https://aholi.stat.uz/en/ | No verified downloadable city/district table extracted | Census Statistics Committee | Yes |
| All mahallas | Complete current names | District administration pages, open-data portals, Mahalla portals | District pages and Digital Mahalla | No consolidated current register found | Tashkent City Hokimiyat | Yes |
| All mahallas | Unique official codes | Digital Mahalla and open data | https://mahalla.ijro.uz/ | Registry appears access controlled | Mahalla Association / Digital Mahalla | Yes |
| All mahallas | Multilingual names | District pages and legal documents | District administration pages | No synchronized Latin/Cyrillic/Russian register | Official registry export | Yes |
| All mahallas | Current official polygons | Open Data Tashkent | District thematic layers | Some districts identified; completeness unverified | Open Data Tashkent / Cadastre Agency | Possibly |
| All mahallas | CRS and geometry metadata | GIS dataset pages | Open Data Tashkent | CRS not stated in search results | Inspect downloaded files | No |
| All mahallas | 2026 population | Census and Digital Mahalla portals | Census portal | No verified mahalla-level file extracted | National Statistics Committee | Yes |
| Yangihayot | Exact legal boundary | LexUZ | PQ-4888 | Annexes were not fully extracted | LexUZ annexes | No, if publicly accessible |
| All administrative changes | Mahalla merger/renaming history | LexUZ and district archives | Legal portal and district pages | Individual decisions not comprehensively indexed | LexUZ full-text search | Yes |
| GIS services | WMS/WFS/ArcGIS endpoints | Open Data Tashkent and Digital Mahalla | No verified endpoint | Network/API inspection not completed | Portal administrators / GIS office | Possibly |

---

# 12. Recommended Data-Acquisition Workflow

1. Download every official file from the Open Data Tashkent territory category.
2. Record:
   - Original URL
   - Dataset ID
   - Download date
   - Publication date
   - File checksum
   - File format
   - CRS
   - Feature count
   - Metadata
3. Extract all mahalla attributes.
4. Compare GIS features with district-hokimiyat mahalla lists.
5. Compare names in:
   - Uzbek Latin
   - Uzbek Cyrillic
   - Russian
   - English transliteration
6. Inspect all legal annexes for boundary descriptions and transferred territories.
7. Validate polygon topology.
8. Identify duplicates, missing features, overlaps, and gaps.
9. Match demographic records using official IDs wherever possible.
10. Request official registry and demographic exports for unresolved fields.
11. Do not publish reconstructed or OSM geometry as official.
12. Export validated data to:
   - CSV
   - XLSX
   - GeoJSON
   - PostGIS
   - Mapbox/MapLibre vector tiles

---

# 13. Suggested GIS Output Files

The following files should be produced after direct source-file validation:

```text
01_tashkent_districts.geojson
02_tashkent_mahallas.geojson
03_tashkent_districts.csv
04_tashkent_mahallas.csv
05_tashkent_mahalla_demographics.csv
06_tashkent_gis_sources.csv
07_tashkent_admin_changes.csv
08_tashkent_sources.csv
09_tashkent_missing_data.csv
```

Preferred final GeoJSON CRS:

```text
EPSG:4326 / WGS 84
```

The original CRS must always be retained in the source metadata.

---

# 14. 2026 Data Reliability Summary

## Officially usable after verification

- Current count of Tashkent City districts: **12**
- Tashkent City population reported for 2026-07-01: **3,212,200**
- Tashkent City population on 2024-01-01: **3,040,800**
- Yangihayot district legal creation: **Presidential Resolution No. PQ-4888 dated 2020-11-11**
- Official Open Data Tashkent GIS dataset leads: **Several districts**

## Not yet safe to use as final commercial data

- Male/female 2026 Tashkent figures without checking the underlying table
- All 2026 district population figures
- All 2026 mahalla population figures
- Current total number of mahallas
- Complete current mahalla names
- Mahalla codes
- Mahalla office addresses
- Complete official mahalla polygons
- CRS values for downloaded GIS files
- Complete mahalla merger, renaming, abolition, and transfer history

---

# 15. Final Assessment

The publicly identified sources provide a strong starting point for a current Tashkent City administrative GIS database, especially:

- National Statistics Committee
- 2026 Census portal
- Tashkent City Open Data
- Tashkent City Administration
- LexUZ
- Digital Mahalla systems
- Cadastre-related sources

However, a fully complete and commercially defensible dataset requires direct inspection of the original downloads and official registry exports. The most important outstanding tasks are:

1. Extract all current mahalla names and official IDs.
2. Download and validate all district-specific mahalla polygons.
3. Obtain verified 2026 district demographics.
4. Obtain verified 2026 mahalla demographics.
5. Extract the complete Yangihayot legal annexes.
6. Reconcile official registers with GIS feature attributes.
7. Obtain official data for districts and mahallas whose public records remain incomplete.

---
```