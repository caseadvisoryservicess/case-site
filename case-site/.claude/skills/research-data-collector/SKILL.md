---
name: research-data-collector
description: How new observations enter the dataset – the source registry, the licence gate, the collector, the proposal, the human apply step. Load before running or editing tools/sources.py, tools/collect.py or tools/merge_incoming.py, before scraping anything, and before answering "can we use Google/Yandex/2GIS/Golden Pages data".
---

# Research data collector

## Purpose

Collection is where a careful dataset is most easily ruined: one adapter that writes straight into
`seed.json`, one scrape of a site whose terms were never read, one Google Places result stored
because the request was paid for. This skill is the procedure that lets collection happen without
that.

## Responsibilities

- Own `tools/sources.py`: every source with `endpoint`, `auth`, `licence`, `attribution`,
  `fields` and – the column that matters – `storage`.
- Own `tools/collect.py`: per-source adapters that write ONE observations file to
  `data/incoming/`, never to the dataset; `--from` replays a saved response for offline testing.
- Own the proposal path (`merge_incoming.py`) and the `--apply --reviewer NAME` gate.
- Record reachability and refusals as facts (`sources.py --check`), never as silence.

## Constraints

1. **`storage` decides, not reachability.**
   - `open` (ODbL – OpenStreetMap) may populate the dataset with attribution and share-alike.
   - `display` (Google Places, Yandex) may be queried and SHOWN – e.g. "their address disagrees
     with ours" – and may never be written into `seed.json`. Google Maps Platform terms prohibit
     storing Places content beyond `place_id`. A key does not change this.
   - `contract` (2GIS) waits for the licence reference to be recorded.
   - `unverified` (Golden Pages, Yellow Pages, Orginfo, data.egov.uz) waits for a named person
     to read robots.txt and the terms; `--i-have-checked-terms NAME` records who.
2. **Three refusals happen BEFORE any request**: missing key (no unauthenticated fallback –
   Google's returns an empty list that reads like "nothing found"), unverified terms, unreachable
   host. A failed fetch writes a failure record, not an empty file.
3. **Commercial fields are never imported from any source.** Rent, GLA, GBA, occupancy, vacancy,
   available area, service charge, class, tenants come from a broker, a landlord or a document.
4. **Four outcomes per field, decided by code; conflicts resolved by nobody but a person.**
5. **Directories describe companies; this dataset describes buildings.** Eight records are
   already flagged as probably a company. Directory sources add that failure mode unless every
   match is reviewed.
6. **User-Agent identifies the project and a contact.** Never impersonate a browser.
7. **Nothing is fabricated to cover a blocked source.** In this environment every geodata host is
   refused by the egress proxy; the record of that is the deliverable, not a plausible dataset.

## Validation checklist

- [ ] `python3 tools/sources.py --check` writes `data/incoming/source-reachability.json`.
- [ ] `python3 tools/test_merge.py` – 30/30: display-only proposes no fills but reports
      conflicts; `--apply` refuses display sources and refuses without a reviewer; an applied
      fill carries an `IMPORT-*` profile with `qcStatus: needs_check`.
- [ ] After any apply: `python3 tools/oracle.py && bash tools/verify.sh` – every denominator
      recomputed.
- [ ] Every observations file states `sourceId`, `licence`, `storage`, `mayPopulateDataset`,
      `retrievedAt`, `ok`/`error`.

## Examples

**Right.** OSM says Korea Uzbekistan Business Centre is at "Afrosiab, 41"; the record says
"Tashkent" → `conflict`, noted *incoming is more specific*, left for a person.

**Right.** `collect.py --source SRC-GOOGLE-PLACES` without `--key` → exits with the reason and
no request made.

**Wrong.** Storing Google's formatted address because "we paid for the API call".

**Wrong.** Scraping goldenpages.uz because the pages are publicly readable.

## Prohibited behaviour

- Any adapter that writes to `data/seed.json`.
- Any request to a `display`/`contract`/`unverified` source that ends in a stored value.
- Silent empty results; silent retries that mask a block.
- Priority by convenience: 2GIS (settles the open licence question on the existing 148 records)
  and OSM (the only storable source) come before every directory.
