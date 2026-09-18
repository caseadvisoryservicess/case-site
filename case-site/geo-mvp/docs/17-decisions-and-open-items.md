# 17. Decisions and open items – a single place to find what this session settled and what it needs back

Everything built and decided in this project lives in three places, none of them chat history:

| Where | What it holds |
|---|---|
| This git branch (`claude/new-session-a6js6b`, currently `5d60bb9`) | Every file, with a commit message explaining the change. Nothing here exists only in a conversation. |
| `docs/README.md` and `docs/00`–`docs/16` | The technical record – scope, schema, analytics rules, visual system, data sources, the §73 check-up, and the two archive reviews. |
| `.claude/skills/` (14 skills) | The role-specific rules a future contributor or AI session should load before touching a given part of the system. |

This document is the fourth piece: every decision this session made, and every input still owed
by CASE, gathered in one table so neither has to be found by re-reading the conversation.

## 17.1 Decisions already made – no input needed

| Decision | Where it is recorded |
|---|---|
| Scope is business centres only; population, medicine, pharmacies, roads and zone scoring are out | `16-geo-analytics-page-review.md` §16.5 |
| User-visible text uses the en dash, never the em dash | `10-visual-system.md` §11, enforced by `tools/qa.cjs` across 8 surfaces |
| Base map is switchable (OSM and five others); 2GIS/Google/Yandex ship present but disabled pending a licence | `10-visual-system.md` §12 |
| District is computed from geometry, not the source label, with the 10 disagreements flagged and reversible | `00-BUILD-CONTRACT.md` D1 |
| Brand colours and lockup match the live site (cream/ink/red, DM Serif Display + Inter) | `10-visual-system.md` §6.1 |
| A listing rent is unit-level evidence, not a building rate, and carries that caveat in its provenance note | `15-case-os-archive-review.md` §15.2; `16-geo-analytics-page-review.md` §16.2 |
| A source may only populate the dataset if its licence is `open`; Google and Yandex stay `display` (show, never store) even with a key | `12-data-sources.md` §12.2 |

## 17.2 Open items – what CASE still needs to provide

| # | Item | Why it matters | What happens once it's given |
|---|---|---|---|
| 1 | **A reviewer name**, to apply the 28 price fills (12 rent, 15 available area, 1 class) and the 2 new buildings (Botanica BC, Taxtapul BC) | These proposals are built and waiting; nothing merges without a named human per this project's rule (D6) | One command applies them, then the seed is rebuilt and re-verified; rent coverage goes from 16 to 28 of 148 |
| 2 | **Who has read the GoldenPages terms of use**, one name | Releases 20 street addresses already matched to existing buildings, currently withheld because the directory's licence is unread | One command with that name applied; the same clearance also unblocks 591 GoldenPages rows in CASE's own source register |
| 3 | **Yandex Geocoder run**: open `geocode-check.html` (sent earlier), paste the key, run both buttons, send back `yandex-geocoder-check.json` | Checks the 148 recorded addresses against Yandex and flags any that disagree with their pin | The mismatches become a short human queue; nothing is written to the dataset automatically |
| 4 | **Status of "API Поиска по организациям"** in the Yandex console – a screenshot of that product's own page | Confirms whether the organisation-search collector can run at all | Either the collector runs in show-only mode, or the free tier does not include it and the plan changes |
| 5 | **Report shape for the trilingual download button**: this dataset's CSV, or the CASE OS geo studio's XLSX/PDF | Two shapes already exist inside CASE; building a third without asking would be guessing | Locks the format before any translation work starts |
| 6 | **Russian and Uzbek reviewers** for the download's translation subset (~150–200 keys) | `I.ru` and `I.uz` are empty by design (D14); a half-translated interface is worse than an honest English one | Once reviewed, the export can offer EN/RU/UZ independent of the interface language |
| 7 | **Font and colour authority** – the live site (DM Serif Display + Inter, as built) vs the brand skill (Bebas Neue + Montserrat) vs CASE OS's own tools (Montserrat) | Three sources disagree; only CASE can say which one is current | Confirmed choice becomes a one-line token change, nothing structural |
| 8 | **2GIS contract reference** | 2GIS is licensed as `contract` class; the collector refuses until a contract is recorded, even though the existing 148 already came from 2GIS | Unlocks re-collecting through the API, the cheapest enrichment available and the one that settles the open licence question on the current 148 |
| 9 | **Confirm or rename** the placeholder product name "CASE Geo" | It is a single constant (`GEO.PRODUCT.name`), a one-line change either way | Nothing else depends on it |
| 10 | **District-label override policy** – accept geometry as authoritative for the 10 flagged buildings, or override any individually | Affects one headline figure: Trilliant (the dataset's highest rent) sits in Mirzo-Ulugbek by source label and Yunusobod by polygon | A written ruling closes the flag; today it is reversible either way |

## 17.3 Noted, not yet actioned

- **GLA and occupancy are 0 of 148.** Every analytic that needs them correctly reports
  insufficient data rather than guessing. Filling them is a CASE-team data-entry task, not an
  engineering one – the geo-analytics page's own card groups these fields under "заполняет
  команда CASE" (§16.6), which is the label this product should adopt too once that campaign starts.
- **Nine records carry only the word "Tashkent" as their address**, and are counted as
  "address known" today. Real street addresses are 100 of 148, not 109 (`12-data-sources.md`
  §12.8). Fixing the count is a one-line ETL change, held pending item 1 above so it ships in the
  same batch as the other seed changes.
- **Google Maps was skipped** for this round because a usable key needs a billing account. It
  can be added later; even with a key, Google's terms mean it stays a **display**-only source,
  never a storage one.

## 17.4 One security note from this session

The `api.zip` shared for the API-key search contained the production database password, a
backup token, and SMTP credentials for `caseadvisory.uz/os`. Nothing from it was committed to
this repository, but the file did leave your server into this chat. **Recommended: rotate that
database password and backup token.** Separately, the Yandex keys shared in chat
(`d66fad5a-…`, `73e320de-…`) are now visible in this conversation; the JavaScript key was
restricted to `caseadvisory.uz` and `localhost` during setup, which is sufficient. The Geocoder
key carries no restriction, which is normal for a key run from a laptop rather than a website,
but is worth knowing if it is ever reused elsewhere.

## 17.5 How to pull any of this later, without this chat

```bash
git clone <this repo> && cd case-site/geo-mvp
git log --oneline                 # every change, in order, with why
cat docs/README.md                # the index of every technical document
cat .claude/skills/README.md      # which skill governs which part of the system
python3 tools/oracle.py && bash tools/verify.sh   # proves the built file still matches the docs
```

Nothing described above depends on this conversation still existing.
