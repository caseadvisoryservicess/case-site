# 16. CASE OS Geo Analytics 2 – what the page holds, read under a business-centres-only scope

Reviewed `CASE_OS_Geo_Analytics_2.html` (605 KB, one file, Russian UI, Montserrat, dark theme,
title "CASE OS — Geo Analytics · Tashkent Office/BC Benchmark"). Nothing from it was executed.

The scope for this review is the one CASE set: **business centres only**. Everything the page
carries about population, medicine, pharmacies, road corridors and zone scoring is inventoried in
§16.5 and deliberately not ingested – recorded there so nobody has to open the file again to find
out what was skipped.

## 16.1 What the page is

Its embedded `BC` array holds **150 records: the prototype's 148, plus two**. Same coordinates,
same names, same district labels. So this page and `docs/15-case-os-archive-review.md`'s archive
describe one collection – but the page is a **later state of it**, which is where its value is.

| | |
|---|---|
| provider | 2GIS 103, GoldenPages 26, Google Maps 19, **CASE (owner) 2** |
| status | Draft 122, Needs review 26, Reviewed 2 – the page's own QC state, not a building status |
| filled | address 129, rating 46, reviews 47, class 16, rent 16; **GLA, GBA, floors, parking, year: 0** |

The page states its own rule for those empty columns, and it is this project's rule too:
"Класс/GLA/GBA/парковка непубличны в открытых источниках – поля пусты и заполняются командой
(принцип «пусто лучше выдуманного»)."

## 16.2 Three things worth taking

| Finding | Count | Where it went |
|---|---|---|
| Business centres CASE is itself involved in, absent from the 148 | **2** | `SRC-CASE-OS-GEO2-BC` – proposal built, both NEW |
| Street addresses the dataset does not hold | **20** | `SRC-CASE-OS-GEO2-ADDR` – proposal built, all 20 **withheld by licence** |
| The listing-price disambiguation rule | – | carried into the evidence note of every listing-class rent |

**1. Botanica BC and Taxtapul BC.** Mirzo-Ulugbek and Shaykhantakhur, provider `CASE (owner)`,
coordinates and district only. They match nothing in the 148 – nearest neighbours are kilometres
away – so they enter as NEW records through the proposal path, never by editing the seed.
The page's `status: Reviewed` on both is its QC state and is not imported.

**2. Twenty addresses.** Address coverage is 129/150 on the page against 109/148 here, and the
difference is exactly twenty buildings, all of them GoldenPages-sourced rows. The archive's
`bc.json` – the origin of the 148 – carries those same rows with `address` blank, so this is new
collection rather than something the ETL dropped. All twenty match an existing record **by
coordinates, to five decimal places**, and none conflicts with an address already recorded.

They are nevertheless **not applied**, and that is deliberate: the address text is directory
content, and CASE's own source register marks every GoldenPages row `license_review_required:
Проверить` with none cleared. Filing them as "CASE internal" because they arrived inside a CASE
file would launder that question rather than answer it. So the source is registered with
`storage: unverified`, the collector refuses, and the proposal counts all twenty as withheld.
One recorded terms check releases every one of them in a single command.

**3. The price heuristic.** The page documents how it read board prices: listings filtered on the
word "office", and where a price was per object rather than per m², **disambiguated by
plausibility of the implied rate ($2–60/m²)**. That is a judgement, not a measurement, so it now
travels with the data: every listing-class rent from the CASE OS bundle carries it in the evidence
note, with the listed unit size, for example "OLX 07.2026 – per-m² vs per-object disambiguated by
rate plausibility ($2–60/m²); listed unit of 2100 m², not a building rate".

## 16.3 What the page holds and this dataset will not take

| In the page | Why it stays there |
|---|---|
| 46 ratings, 47 review counts | Every one is on a 2GIS-provider row. Map-service content, and there is no rating field in the schema. Either reason is sufficient |
| 22 social-media links | Contact data about a company, not an attribute of a building |
| `status` (Draft / Needs review / Reviewed) | The page's editorial queue. This project's equivalent is `_meta.qcStatus`, which means something different and is not interchangeable |

One caveat worth recording rather than fixing: the page's note promises a marker,
"geo=2GIS-approx помечает приблизительную координату (проверить)", for the GoldenPages rows that
were geocoded from an address string rather than surveyed. **The embedded array carries no such
field.** So the coordinate accuracy of those 26 rows is unmarked in the data, and twenty of them
are precisely the addresses above. If the addresses are cleared for use, the same twenty
coordinates deserve a look.

## 16.4 A matcher defect this page exposed

One building in the 148 is called `THE TOWER`. Every token in that name is on the matcher's
stop-list – the list that stops "Бизнес центр Alpha" and "Бизнес центр Beta" scoring as near
identical – so the name reduced to nothing and scored **0.0 against itself**. The address
observation sitting on its exact coordinates went to human review for "the names do not agree".

Fixed: when the stop-list empties either side, the comparison falls back to the unstopped tokens.
The stop-list exists to stop shared words dominating a comparison, not to make a name unmatchable
against itself. Two regression tests were added, including the negative control that matters –
`THE TOWER` against `Business Center` still scores 0.0, and the Alpha/Beta pair is untouched.
`tools/name_dupes.py` has its own independent implementation and was not changed, which is the
point of it being independent.

## 16.5 Out of scope, inventoried so it need not be read again

| Layer in the page | Size | Status under the current scope |
|---|---|---|
| `KPOP` population hexes | 6,865 cells, Kontur H3 0.87 km², calibrated per district to Toshstat 01.01.2026 (3,160,671) | Not ingested |
| `MEDPTS` medicine | 1,530 points, OpenStreetMap + clinics.uz | Not ingested |
| `PHARM` pharmacies | 1,027 points | Not ingested |
| `ROADS` corridors | 5 named corridors with length and drive time | Not ingested |
| Zone scoring | business-format scores with a demand-weight slider, CSV export per grid | Not ingested |
| Radii and probe reports | per-point CSV report at arbitrary coordinates | Not ingested |

One line from that material is worth keeping anyway, because it is the standard this project's
sufficiency language should meet. The page compares its own calibrated population estimate against
WorldPop 2025, finds them diverging by up to **×1.6** at a 1.5 km radius, declines to call either
one true, and concludes: take a range, 20–32 thousand people. That is the honest form of an
answer, and it is the form `05-analytics-rules.md` asks for.

## 16.6 Three details worth borrowing, all inside the scope

**The card labels its empty group.** The page's edit card groups fields under
"Бенчмарк (заполняет команда CASE)" – class, floors, GLA, GBA, parking, year. Naming the group as
*pending team entry* rather than leaving six blanks is exactly the distinction this product makes
between "unknown" and "absent", stated in the UI rather than in a doc. The result card should
carry the same label when the GLA and occupancy campaign starts.

**It has the capture path already.** Cards are editable, edits are kept per browser, and
"Выгрузить базу" exports the whole base as CSV with those edits for the team. That is a working
answer to "how does a CASE analyst give us GLA for 148 buildings", and it needs no backend.

**And it settles a question about the download button.** This page exports **CSV only**; the
archive's geo studio (doc 15, §15.2) exports **XLSX and PDF**. Two report shapes already exist
inside CASE. The trilingual download button should match one of them rather than invent a third,
and which one is a decision for CASE, not for this prototype.

A fourth detail is a contrast rather than a borrowing: the page pulls **2GIS and Google tiles
straight from their tile endpoints**. This prototype lists both in its basemap registry and ships
them switched off pending a licence, which is a deliberate difference and is recorded in
`10-visual-system.md` §12.

## 16.7 The numbers, and the two commands that unlock them

| Source | matched | new | fills | withheld | conflicts |
|---|---|---|---|---|---|
| `SRC-CASE-OS-GEO2-BC` | 0 | **2** | 0 | 0 | 0 |
| `SRC-CASE-OS-GEO2-ADDR` | 20 | 0 | 0 | **20** | 0 |
| `SRC-CASE-OS-PRICES` (doc 15) | 30 | 1 | **28** | 0 | 0 |

```
# the two CASE-owned buildings, once a reviewer is named
python3 tools/merge_incoming.py --in data/incoming/src-case-os-geo2-bc.observations.json \
        --apply --reviewer "Name"

# the twenty addresses, once someone has read the GoldenPages terms
python3 tools/collect.py --source SRC-CASE-OS-GEO2-ADDR \
        --from data/external/case-os-geo-analytics-2/address_fills.json \
        --i-have-checked-terms "Name"
```

As in doc 15 §15.5, applied values must be carried into `build_seed.py`'s inputs rather than into
`seed.json` alone, or `verify.sh` will fail the seed against its own ETL – which is the check
doing its job.

## 16.8 What is needed from CASE

1. **A reviewer name** for the two new buildings and the 28 price fills. One name, recorded in the
   ETL, and both proposals apply.
2. **The GoldenPages terms check**, by anyone who reads it – it releases twenty addresses now and
   unblocks 591 rows in CASE's own register later.
3. **Which report shape** the download button should produce: this page's CSV, or the geo studio's
   XLSX and PDF.
4. **Confirmation on Montserrat.** This page and the CASE OS tools use it; the live site uses
   DM Serif Display and Inter, which is what the prototype ships. The conflict is open in
   `10-visual-system.md` §6.1 and only CASE can close it.
