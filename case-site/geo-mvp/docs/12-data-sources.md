# 12. Additional data sources – what was built, what is blocked, what it needs

The ask was to collect from Golden Pages, Google Maps, Yandex Maps, Yellow Pages "and so on".
This document records what that actually requires, what it was possible to do here, and what it
was not.

---

## 12.1 The finding, first

**No external source can be collected from this environment, and one of the named sources could
not be stored even with a working network.** Those are two separate blockers and they need
separate decisions.

`python3 tools/sources.py --check` probes all eight and writes the result. At the time of
writing:

| Source | Reachable here | May its values be stored? | What it needs |
|---|---|---|---|
| OpenStreetMap (Overpass) | **no** – proxy 403 | **yes**, ODbL | network access |
| Google Places API | **yes** | **no** – see 12.2 | a key, and a decision about 12.2 |
| Yandex Places API | no – proxy 403 | **no** – terms restrict storage | a key + commercial terms |
| 2GIS Catalog API | no – proxy 403 | **only under contract** | the licence CASE may already hold |
| Golden Pages UZ | no – proxy 403 | **unverified** | robots.txt + terms read by a person |
| Yellow Pages UZ | no – proxy 403 | **unverified** | robots.txt + terms read by a person |
| Orginfo.uz | no – proxy 403 | **unverified** | robots.txt + terms read by a person |
| data.egov.uz | no – proxy 403 | **unverified** | per-dataset licence check |

The 403s are this container's egress policy, not the sources refusing. Google answers because
`maps.googleapis.com` is on the allowlist – and answers `REQUEST_DENIED`, because there is no key.

**Nothing was invented to fill the gap.** Producing a plausible set of "collected" records would
have been the single clearest breach of §2.2 available, and the least detectable: nobody audits a
building that looks real.

## 12.2 Google and Yandex cannot populate this dataset, key or no key

This is the finding most likely to be a surprise, so it is stated plainly.

Google Maps Platform's terms prohibit pre-fetching, caching, indexing or storing Places content,
with a narrow exception for `place_id` and limited short-lived caching for performance. Yandex's
API terms restrict storage and redistribution outside Yandex surfaces in the same spirit.

So the pipeline may **query** them and **show** you what they say – including that your recorded
address disagrees with theirs, which is genuinely useful – but writing their values into
`seed.json` would be a licence breach even though every request was properly authorised and paid
for. The registry marks this `storage: 'display'`, and `merge_incoming.py` enforces it: fills from
a display-only source are withheld and counted, never applied. Its conflicts still come through,
because that is the part you are actually allowed to use.

**If CASE wants Google or Yandex content inside the dataset, that is a commercial licensing
conversation with Google or Yandex, not an engineering task.** The engineering is done and waiting.

## 12.3 What was built

Three tools, each doing one thing, none of which writes to the dataset by itself.

```
tools/sources.py          the registry: endpoint, auth, licence, storage class
tools/collect.py          source -> data/incoming/<id>.observations.json
tools/merge_incoming.py   observations -> a PROPOSAL a person applies
tools/test_merge.py       30 assertions, offline, against the real seed
```

**`sources.py`** is the single place that decides what may be collected. Its important column is
not `endpoint`, it is `storage`: `open` (ODbL – may populate), `display` (query and show only),
`contract` (depends on an agreement), `unverified` (robots and terms unread → refuse).

**`collect.py`** has working adapters for Overpass, Google Places, Yandex Geosearch and the 2GIS
Catalog. It refuses before making a request when a key is missing, when terms are unverified, or
when the host is unreachable – and a failed fetch writes a *failure record*, not an empty
observations file. An empty file and a failed fetch look identical the next morning and mean the
opposite.

`--from` replays a saved API response instead of calling out. That is how the parsers are tested
offline, and how somebody with network access can hand a capture to somebody without it.

**`merge_incoming.py`** is where the care lives. Per field, exactly four outcomes:

| outcome | when | what happens |
|---|---|---|
| **fill** | recorded value is unknown, incoming has one | proposed |
| **corroborate** | both known and equal | noted; the value is never rewritten |
| **conflict** | both known and different | recorded, **never resolved here** |
| **ignore** | incoming is blank | nothing – absence is not evidence of absence |

Matching is coordinates **and** name, never either alone: a business centre and the café in its
lobby are 15 m apart and share nothing else. Auto-match is 40 m plus a strong name match;
40–150 m goes to a human. Two equally good candidates is `ambiguous`, which is a person's problem
– picking one silently is how the wrong building gets edited.

**Commercial figures are refused outright, from every source.** `askingRent`, `gla`, `gba`,
`occupancyPct`, `vacancyPct`, `availableArea`, `serviceCharge`, `officeClass` and `tenants` can
never be imported by any adapter at any confidence. No map service or business directory is an
acceptable source for a rent; those come from a broker, a landlord or a document. This is the
constraint that keeps the ingestion path from quietly undoing what the rest of the product is for.

`--apply` writes fills only from a storable source, only for `matched` items, only into fields
still unknown at apply time, and only with a named `--reviewer` recorded in the evidence profile
it creates. The profile ships `qcStatus: needs_check`: an import is a lead, not a verification.

## 12.4 Why a proposal and not a merge

The dataset already answers this shape of problem: duplicate groups ship `undecided` and nothing
collapses until a human adjudicates (D6). Ingestion is the same problem arriving from outside, so
it gets the same answer.

A second source **agreeing** is worth recording. A second source **disagreeing** is the most
valuable thing an ingest produces – it is how you learn which of your records is wrong. An
importer that picks a winner throws exactly that away, and does it silently.

## 12.5 What each source is actually worth here

Ranked by what it would add to a dataset whose coverage is 2 fields of 18:

1. **2GIS Catalog API** – the existing 148 records were desk-collected from 2GIS listings, with
   `licenceReview: required` still open against them. Going back through the API is the cheapest
   enrichment available *and* it settles that outstanding licence question. Start here.
2. **OpenStreetMap / Overpass** – the only source that can populate the dataset outright. Carries
   `building:levels`, `start_date` and `operator`, which are three of the zero-coverage fields.
   ODbL means attribution and share-alike on derived data.
3. **Orginfo.uz** – the only candidate that carries what no map service does: **who owns the
   building**. Ownership is 0/148 today. Matching is by company name, which is the hardest and
   most error-prone match of the set.
4. **Golden Pages / Yellow Pages** – weakest, and worth naming why: directories describe
   **companies**, this dataset describes **buildings**. Eight records are already flagged as
   probably a company rather than a building; these sources add more of exactly that failure mode
   unless every match is reviewed.
5. **Google / Yandex** – excellent for *checking* an address or a name, useless for populating,
   per 12.2.

## 12.6 To run it, once there is network

```bash
python3 tools/sources.py --check                      # what answers today
python3 tools/collect.py --source SRC-OSM-OVERPASS    # -> data/incoming/…observations.json
python3 tools/merge_incoming.py --in data/incoming/src-osm-overpass.observations.json
#   read the proposal, then:
python3 tools/merge_incoming.py --in <same file> --apply --reviewer "Your Name"
python3 tools/oracle.py && bash tools/verify.sh       # every figure recomputed
```

The last line is not optional. Every applied fill changes a denominator somewhere, and the oracle
is the only thing that recomputes all of them independently.
