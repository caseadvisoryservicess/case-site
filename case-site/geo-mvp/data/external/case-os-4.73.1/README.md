# CASE OS bundle – price and market evidence (July 2026)

Extracted from `CASE_OS_v4.73.1_HOSTING_READY_20260916.zip`, file
`os/data/bundle_tashkent_realdata.json`, keys `prices` and `market`. CASE's own collection.

- `prices`: 32 business centres with asking rent (USD/m²/month), listed available area, sometimes
  a sale asking price and class. Each carries `psrc` – the listing platform (OLX, uybor.uz), the
  management company's owner rate (soffice.uz), or an Instagram advert – and the month.
- `market`: OLX / uybor aggregates (median, quartiles, n), by district, and a class table from
  soffice.uz (18 BCs, 220,000 m²). `ref` is "open market reviews, 2025" with no further source and
  is NOT ingested – shown only as external reference, never as platform data.

Ingested through `tools/collect.py --source SRC-CASE-OS-PRICES --from <this file>` and the
proposal path. A listing rent is one unit's asking price, not a building rate: it enters with
`confidence: Low` and the unit size in the note. Owner rates enter as `Medium`.
