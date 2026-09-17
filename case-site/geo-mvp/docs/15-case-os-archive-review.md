# 15. CASE OS v4.73.1 archive – what is in it, and what it gives this prototype

Reviewed `CASE_OS_v4.73.1_HOSTING_READY_20260916.zip` (186 files, 33 MB, no path traversal,
integrity clean). Extracted to a scratch folder; nothing from it was executed. This is the hosting
package for the CASE OS platform at `caseadvisory.uz/os` – PHP + MySQL, Russian-language UI –
and its `os/data/` folder is where the geo prototype's dataset came from.

## 15.1 The headline findings

1. **`bc.json` is this prototype's 148 records, exactly.** Same `master_id`s
   (`BC-75e17f93c6aa`…), same coverage (class 16, rent 16, everything else 0), same collection
   date (2026-07-19), same "Уточнить адрес, GBA/GLA…" note on every card. So the archive is the
   *origin* of the dataset, not an enrichment of it – with one exception, below.

2. **`bundle_tashkent_realdata.json → prices` holds rent evidence the dataset does not.**
   32 named business centres with asking rent, listed available area, sometimes a sale asking
   price and class, each with its source and month: OLX.uz, uybor.uz, soffice.uz (a management
   company's owner rates for 18 BCs), one Instagram advert. Matched against the 148 by name:

   | outcome | count | what it means |
   |---|---|---|
   | corroborations | 63 | 16 rents already in the dataset agree to the decimal – this is where they came from |
   | **proposed fills** | **28** | 12 asking rents, 15 available-area values, 1 class – none held today |
   | conflicts | 0 | no recorded value disagrees with the bundle |
   | review | 1 | "Business Park" scores 0.95 against "Park view" – not the same building; a person decides |
   | new | 1 | "Dream" (Class B, $35.6) is not in the 148 |

   Applied, rent coverage goes from **16 to 28 of 148** and available area from **0 to 15**.
   The listing rents are unit-level asking prices ("listed unit of 175 m²"), not building rates:
   they enter at **Low** confidence with the unit size in the note; owner rates enter at
   **Medium**. Every fill carries its own evidence profile per method. The proposal is built
   and waiting: `data/incoming/src-case-os-prices.proposal.json`.

3. **The source register shows the Golden Pages / Google / Yandex collection was already done
   – and never licence-cleared.** `sources.csv`: 919 sources – GoldenPages 591, 2GIS 55, Yandex
   Maps 41, Google Maps 23, TripAdvisor 12 – all retrieved 2026-07-19,
   `license_review_required`: "Проверить" 800, "Да" 119, cleared 0. This is the same open
   question `docs/12-data-sources.md` raises, already sitting in CASE's own register.

4. **The population grid is a methodological layer, not verified data – CASE says so itself.**
   `population_grid.csv` (1,014 cells, sum 2.70 M) and `_extended` (6,865 cells, 5.84 M) both
   carry `source: Bundled population grid` and `verification_status: "Методологический слой;
   проверить источник/единицу измерения"`. Usable as a demand *layer* only if labelled exactly
   that way; never as a fact about catchment population.

5. **The districts are identical to the prototype's.** Same twelve, same source (Toshkent shahar
   chegarasi 2024), areas agree to within 0.2%. No boundary conflict.

## 15.2 Inventory – what else is there

| Item | Size / count | Usable for the prototype? |
|---|---|---|
| `geo_master/master.csv` / `.geojson` | 3,292 POIs, 76 columns, RU/UZ/EN name fields | Context layers around a building (medicine 1,530, pharmacies 1,027, F&B 42) – the "what is nearby" §13 asks for. Business-centre rows carry only 2GIS coordinates; no Google/Yandex/OSM cross-check, no name_uz/name_en |
| `qa_issues.csv` | 1,279 issues | 148 = "incomplete business-centre card" (every one); 36 different objects on identical coordinates; 29 name duplicates; 26 zero coordinates. Overlaps the prototype's own quality queue |
| `research_queue.csv` | 463 items | Collection priorities – F&B, entertainment, retail, hotels, education. Not business centres. 395 still need geocoding |
| `taxonomy.csv` | 49 categories | Trilingual query synonyms (RU/UZ/EN) – a ready vocabulary for category labels in three languages |
| `mahallas.json` | 545 points | Mahalla committee *offices*, not boundaries. Not sub-district geometry |
| `case_portfolio.geojson` | 96 CASE projects, 7 countries | 4 business centres; the 3 in Tashkent have no GBA/GLA and `city_approximate` coordinates. Nothing to take |
| `market` (in the bundle) | OLX/uybor medians by district; soffice.uz class table; `ref` "open market reviews 2025" | `byClass` is the source of the 16 existing rents. `ref` (A rent 34.6, B 26.4, A vacancy 23.3%) has no source beyond "open reviews" – **not ingested**; shown only as external reference if at all |
| `CASE_Tashkent_Geo_Master_Integrated.sqlite` | 6.3 MB, one table (`build_metadata`, 13 rows) | A stub |
| `geo_collect_config.json` | 1.5 km grid cells; dedup at 20 / 50 / 100 m | CASE OS's own multi-source collector (`geo_collector.php`) – OSM + Google Places + others, server-side. Its thresholds sit close to this pipeline's 40 / 150 m |
| `geoanalytics-studio.html` + `v420-geo-studio.js`, `v4730-geo-agent.js`, `v4530-geo-export.js` | 0.8 MB + 370 KB | An existing geo studio: analysis point, Huff market share, sun/wind/qibla, **XLSX and PDF export**. Russian only. Its own rule-based agent, no external AI keys |
| `case_brands_base.xlsx`, `CASE_Tashkent_Geo_Admin.xlsx` | 615 KB, 686 KB | Not opened here (no `openpyxl` in this environment) |

## 15.3 Security check

Swept every `.js`, `.php`, `.json`, `.ini`, `.sql`, `.txt` for keys, passwords and tokens.
Three hits, all reading a value from configuration (`MAPCFG.apikey`, `$key` from `config.php`);
none hard-coded. `config.php` is deliberately excluded from the archive, as `ЧИТАТЬ_ПЕРВЫМ.txt`
says. Clean.

## 15.4 Two things this changes

**The download request.** CASE OS already has an XLSX/PDF export module for its geo studio
(`v4530-geo-export.js`). The prototype's download button should not reinvent that – the honest
next step is to look at whether the geo studio's export format is what clients receive today and
match it, in the three languages, rather than invent a second report shape.

**The ingestion rule.** The pipeline refused commercial fields from every source, because it was
written for map services and directories. This archive is a different evidence class – listings
and an owner's rate are exactly the broker / landlord / document sources those figures are allowed
to come from. So the rule now has one explicit exception: a source flagged `commercialEvidence`
may propose asking rent, available area and class – and still nothing else. GLA, GBA, occupancy,
vacancy, service charge and tenants stay refused from every source, because a listing does not
measure a building. Map sources still cannot propose a rent; that is asserted.

## 15.5 To apply the 28 fills

```
python3 tools/merge_incoming.py --in data/incoming/src-case-os-prices.observations.json \
        --apply --reviewer "Your Name"
python3 tools/build_seed.py      # NOT this – the seed is regenerated from source; see note
python3 tools/oracle.py && bash tools/verify.sh
```

Note on the second line: `verify.sh` fails if `seed.json` differs from what `build_seed.py`
produces, so applied fills must be carried into the ETL's inputs rather than into `seed.json`
alone. The clean route is to add `data/external/case-os-4.73.1/bundle_prices.json` as an input
of `build_seed.py` – one reviewer name recorded in the ETL – so the enrichment is reproducible
from source like everything else. That is a fifteen-minute change and is the next step once a
reviewer is named.
