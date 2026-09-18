# 04 – Data Model & JSON Schema

**Document:** `/home/user/case-site/case-site/geo-mvp/docs/04-data-schema.md`
**Brief step:** §65 Step 4 ("Define the property JSON schema").
**Authoritative source:** `geoanalytics_html_mvp_master_prompt.md` (69 sections). All `§n` references are to that brief.
**Companion documents:** `01-product-spec.md` (scope, binding), `02-brief-critique.md` (defect analysis), `10-visual-system.md`.
**Status:** binding for implementation. An implementer builds from this document without re-reading the brief.

> **Cross-reference note.** `01-product-spec.md` §0 cites "§5 of `03-data-schema.md`" for the completeness weights.
> No `03-data-schema.md` exists; the data schema is this file (`04-`). The weights are in **§9.5 below** and they
> reproduce the distribution `01-product-spec.md` §0 states (39 × 15, 93 × 25, 16 × 55). Treat that citation as
> pointing here.

---

## 0. Scope, authority and conventions

### 0.1 What this document governs

| Governs | Does not govern |
|---|---|
| The `BusinessCentre` record, every field, type, unit and enum | Analytics formulas and denominators → doc `05-analytics.md` |
| The provenance / evidence model (§2.3, §5.6, §37) | AI tool registry and intent parsing → doc `06-ai-architecture.md` |
| History-readiness and refresh cadence (§2.4, §23) | Visual encoding of badges and chips → `10-visual-system.md` |
| The dataset envelope, export/import and localStorage (§20, §21) | Layout, panels, interaction (§7–§13) |
| Validation rules and the editor's block/warn behaviour (§21) | |
| The repository adapter seam (§20) | |

### 0.2 Legend

| Tag | Meaning |
|---|---|
| **NOW** | Implemented and working in this prototype. |
| **READY** | Field/interface exists in the schema and survives export/import round-trip, but nothing writes it in the MVP. Architecture-ready per §2.4, §5.7, §22, §23. |
| **DERIVED** | Computed at load, held in memory, **never stored, never exported**. |

### 0.3 Naming and type conventions

1. **camelCase** for every key. No abbreviations except the CRE-standard `gba`, `gla`, `vat`.
2. A **leading underscore** (`_meta`, `_evidence`, `_history`, `_collection`, `_derived`) marks a
   platform-managed container. Business fields never start with `_`. UI code reads business fields directly;
   it reads platform containers only through the accessor functions named in this document.
3. `_derived` is the only container stripped on export.
4. **`DateOnly`** = `"YYYY-MM-DD"`, no time, no timezone. Every provenance date uses this type.
5. **`Timestamp`** = ISO-8601 UTC with `Z`, e.g. `"2026-07-19T00:00:00Z"`. Used only by `_meta.createdAt`,
   `_meta.updatedAt` and the AI session log.
6. **Enum tokens are opaque machine tokens, never displayed raw.** Every enum has an i18n label map
   (`GEO.I18N[locale].enum.<enumName>[token]`) so §27 can add RU/UZ without touching data. Multi-word tokens are
   `snake_case`. Two exceptions, kept verbatim because they are identical in every language and are mandated by the
   brief: `officeClass` (`A+ A B+ B C`) and `confidence` (`High Medium Low Unknown`, §2.3).
7. Numbers are plain JSON numbers. Areas are **m²** (never ft²). Money is a number plus a separate `currency`.
   Percentages are `0–100` numbers, not `0–1` fractions. Coordinates are WGS-84 decimal degrees, 6 dp.

### 0.4 THE ONE RULE – how "unknown" is represented

§36 requires that unknown be distinguishable from zero. This is the single most important rule in the schema and it
has exactly one form. There are no alternatives and no per-field exceptions.

> **Every field defined in this document is ALWAYS present as a key, in memory and in every export.
> A scalar field whose value is not known is `null`. Never `""`, never `"–"`, never `"n/a"`, never `0`,
> never an absent key. `0` is a value. `false` is a value.**

| Situation | Stored as |
|---|---|
| Vacancy is not known | `"vacancyPct": null` |
| Vacancy is confirmed at zero | `"vacancyPct": 0` |
| Rent is not known | `"askingRent": null` |
| Rent is confirmed free / peppercorn | `"askingRent": 0` + a `leaseTerms` note |
| Tenant list has not been collected | `"tenants": []` **and** `"tenantsStatus": "not_collected"` |
| Building is confirmed vacant, no tenants | `"tenants": []` **and** `"tenantsStatus": "confirmed_empty"` |
| Amenities not surveyed | `"amenities": []` + `"amenitiesStatus": "not_collected"` |
| Amenities surveyed, building has none | `"amenities": []` + `"amenitiesStatus": "confirmed_empty"` |
| Office class not recorded | `"officeClass": null` – **not** `"Unknown"` |
| Status not recorded | `"status": null` – **not** `"Unknown"` |

**Consequences that are not negotiable:**

- §5.1 lists `Unknown` as a status value and §5.2 lists `Unknown` as an office class. **Neither is a stored value.**
  `null` is the stored form; the UI renders the word "Not recorded" (EN) from the i18n map. Storing `"Unknown"`
  alongside `null` would create two spellings of the same absence and break every `hasValue` test.
- An empty array is ambiguous on its own, so **every array field carries a companion `*Status` enum**
  (`tenantsStatus`, `amenitiesStatus`). `altNames` is the one exception: `[]` means "no alternative name recorded",
  and the distinction "confirmed to have none" carries no commercial meaning.
- The single predicate every aggregate must use (`01-product-spec.md` rule R1):

```js
// src/01-util.js – the most-called function in the application.
GEO.util.hasValue = function (v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string')  return v.trim() !== '';
  if (Array.isArray(v))       return v.length > 0;
  if (typeof v === 'number')  return Number.isFinite(v);   // 0 and 0.0 are TRUE
  if (typeof v === 'boolean') return true;                 // false is TRUE
  if (typeof v === 'object')  return Object.keys(v).length > 0;
  return true;
};
```

Ingest normalisation (`GEO.schema.normaliseRecord`) coerces `""`, `"  "`, `"–"`, `"n/a"`, `"N/A"`, `"-"`,
`"null"`, `"Да"`-style placeholders and `undefined` to `null` **before** the record reaches any consumer. The source
file `bc.json` uses `""` for missing; nothing downstream of ingest may ever see an empty string.

### 0.5 Measured source facts (corrections to the project briefing)

Verified by direct inspection of `/home/user/case-site/case-site/os/data/geo_master/bc.json` (n = 148) on
2026-09-16. Two of these contradict the briefing handed to the design team and **change the schema**.

| # | Fact | Consequence |
|---|---|---|
| 1 | **`psrc` / `provider` is not uniformly `2GIS`.** Measured: **2GIS 103, GoldenPages 26, Google Maps 19.** | Three source instruments, not one. The envelope `sources[]` must carry three entries and `_evidence` must attribute each record to its real provider. The currently generated `geo-mvp/data/seed.json` attributes all 148 records to 2GIS and contains **zero** occurrences of "GoldenPages" or "Google Maps" – a provenance falsification that §2.3 and §37 forbid. **Must fix (§11.1 R1).** |
| 2 | **`coordinate_accuracy` has two values, not one:** `"single"` (109) and the free-text Russian sentence `"Точка источника; не подтверждена полевым осмотром"` (39). The split correlates **exactly** with `address` presence and with `seed_object_id` presence (109 have both; 39 have neither). | Two collection batches exist. Normalise both to the enum `single` and preserve the real distinction in `_meta.seedBatch` (`primary` \| `supplementary`). Do not keep free text in an enum field. |
| 3 | `_verification`: `online` 136, `needs_review` 12. The 12 are exactly the coordinate-collision records. | `needs_review` is a **QC state**, not a verification mode. Map to `verificationMode: "desk"` + `_meta.qcStatus: "needs_check"` + `qcFlags: ["coord_collision"]`. |
| 4 | `possible_duplicate` = `"Да"` (Russian "yes") for 12 records; `duplicate_group_id` `DUP-COORD-0022`…`0027`, 6 groups of 2. | Boolean `true`; groups preserved; verdict defaults to `undecided` (§9.4). |
| 5 | All 16 records with `class` are exactly the 16 records with `rent`, and **all 16 come from 2GIS**. | Class and rent evidence profiles are 2GIS-only. Rent values: 19.9, 24.8×3, 29.8×4, 34.8×4, 37.8, 39.7, 40.6, 44.7. Classes: A×8, A+×4, B×3, B+×1. |
| 6 | `data_confidence` = `"B"` for all 148; `source_count` = 1 for all 148; `pdate` = `2026-07-19` for all 148; `comment` ≡ `_note`, one identical Russian string for all 148. | Degenerate fields. Retained as `_meta.sourceConfidenceLetter`, `sourceCount`, `collectedAt`, `sourceNote`; **none of them may drive a filter, a chip or a layer** (`02-brief-critique.md` D7/D8). |
| 7 | 0 non-empty values for `floors`, `gba`, `gla`, `parking`, `year`, `avail`, `sale`, `status`, `website`, `socials`, `phone`, `rating`, `reviews`, `sourceUrl`, `_checkedBy`, `_checkedAt`. `address` 109/148. | These fields exist in the schema and render as "Not recorded". Coverage-driven UI per rule R2. |
| 8 | `master_id` unique across 148. Coordinate bounds lat 41.220657–41.370403, lng 69.179090–69.362258; **0 records fall outside the 2024 city boundary**; 10 records' stored district string disagrees with the containing polygon. | `id` = `master_id`. Geometry is authoritative for district (§6). |

---

## 1. The four-layer model

```
DatasetEnvelope                      §7   one object; the unit of export/import/localStorage
 ├─ sources[]                        §3.3 catalogue of source instruments (licence, retrieval date, count)
 ├─ evidenceProfiles{}               §3.4 reusable Evidence templates, referenced by key
 ├─ districts[] + districtAliases{}  §6   district metadata + alias table (geometry by REFERENCE, not copy)
 ├─ fieldRefreshClass{} refreshDays{} §4  cadence policy
 ├─ completenessWeights{} criticalFields[] §9.5
 └─ records[]                        §2   BusinessCentre objects
      ├─ business fields                  the values themselves  (§2.2–§2.7)
      ├─ _evidence{ field -> ref|obj }    per-field provenance   (§3)
      ├─ _meta{}                          record-level provenance + QC (§2.8)
      ├─ _collection                      field-collection metadata, READY (§2.9)
      ├─ _history{ field -> entry[] }     time series           (§4.1)
      └─ _derived{}                       DERIVED, never stored (§2.10)
```

**Storage-cost rationale.** 148 records × 29 provenance-bearing fields × a 12-key evidence object would be
~51 000 objects and roughly 6 MB of JSON – over the typical 5 MB localStorage quota, for data that is identical
across every record. The three-layer provenance design in §3 stores the same information in 238 KB.

---

## 2. The BusinessCentre record

### 2.1 Complete annotated example – every field present

Only a **DEMO** record may legitimately have every field populated: no real Tashkent business centre in the
dataset has GLA, occupancy, tenants or parking, and inventing them is forbidden by §2.2. The example below is
`DEMO-001` from the shipped fixture set, extended to show the READY containers. It is the **canonical shape**: a
`VERIFIED_SOURCE` record has the same keys with `null` values.

Annotations use `//` and are **not valid JSON** – they are removed in the real file.

```jsonc
{
  // ── §5.1 IDENTIFICATION ────────────────────────────────────────────────────
  "id":            "DEMO-001",            // immutable primary key
  "recordType":    "DEMO",                // VERIFIED_SOURCE | DEMO – required, no default (§8)
  "name":          "DEMO – Alpha Tower",
  "altNames":      ["DEMO Alpha BC"],     // [] = none recorded
  "status":        "Operating",           // null = not recorded (never the string "Unknown")
  "address":       "Synthetic location – not a real address",
  "districtKey":   "yunusobod",           // canonical key, polygon-derived (§6)
  "lat":           41.342585,             // WGS-84, 6 dp
  "lng":           69.290187,

  // ── §5.2 PROPERTY ──────────────────────────────────────────────────────────
  "officeClass":       "A+",              // A+ | A | B+ | B | C ; null = not recorded
  "yearOpened":        2022,
  "yearRenovated":     null,
  "floors":            28,                // above-ground office floors
  "gba":               31000,             // m²
  "gla":               24500,             // m²  (must be <= gba)
  "typicalFloorPlate": 950,               // m² per floor
  "parkingSpaces":     420,               // integer count; 0 is a value
  "parkingRatio":      1.71,              // spaces per 100 m² GLA  (= 420 / 24500 * 100)
  "developer":         "DEMO Developer LLC",
  "owner":             "DEMO Holding",
  "operator":          "DEMO Property Management",

  // ── §5.3 COMMERCIAL ────────────────────────────────────────────────────────
  "askingRent":        45,                // number in `currency` per `rentUnit`
  "currency":          "USD",             // applies to askingRent AND serviceCharge
  "rentUnit":          "m2/month",        // m2/month | m2/year | unit/month
  "rentUnitAssumed":   false,             // TRUE for all 16 seed rents – the source never stated a unit (R9)
  "serviceCharge":     6.5,
  "serviceChargeUnit": "m2/month",
  "vatTreatment":      "vat_excluded",    // vat_excluded | vat_included | vat_exempt ; null = not known
  "occupancyPct":      92,                // 0–100 ; 0 is a value
  "vacancyPct":        8,                 // 0–100 ; must satisfy occ + vac = 100 when both known
  "availableArea":     1960,              // m² ; must be <= gla
  "minUnit":           120,               // m², smallest lettable unit
  "leaseTerms":        "5 years, 3-month rent free, annual USD indexation",   // free text in MVP
  "leaseTermsStruct":  null,              // READY – see §2.6

  // ── §5.4 TENANTS ───────────────────────────────────────────────────────────
  "tenants": [
    { "name": "DEMO Bank",       "industry": "financial_services",   "area": 4200, "floor": "3-6",
      "since": null, "leaseEnd": null, "sourceId": "SRC-DEMO" },
    { "name": "DEMO Consulting", "industry": "professional_services","area": 1800, "floor": "12",
      "since": null, "leaseEnd": null, "sourceId": "SRC-DEMO" }
  ],
  "tenantsStatus": "complete",            // not_collected | partial | complete | confirmed_empty

  // ── §5.5 AMENITIES ─────────────────────────────────────────────────────────
  "amenities": ["restaurant", "cafe", "gym", "conference_room", "reception",
                "security", "underground_parking", "ev_charging", "backup_generator"],
  "amenitiesStatus": "complete",          // not_collected | partial | complete | confirmed_empty

  // ── §5.6 EVIDENCE – per field. Value is a PROFILE KEY or an inline object ──
  "_evidence": {
    "name":        "DEMO-HIGH",           // string  -> expand from envelope.evidenceProfiles
    "lat":         "DEMO-HIGH",
    "lng":         "DEMO-HIGH",
    "districtKey": "DEMO-HIGH",
    "officeClass": "DEMO-HIGH",
    "gla":         "DEMO-HIGH",
    "askingRent": {                       // object  -> inline override, wins over any profile
      "sourceId":       "SRC-DEMO",
      "source":         "Synthetic demo record – not market data",
      "sourceUrl":      null,
      "method":         "other",
      "confidence":     "Low",            // a KNOWN value with LOW confidence – see §3.6
      "collectedAt":    "2026-09-10",
      "lastVerifiedAt": "2026-09-10",
      "collectorId":    null,
      "reviewer":       "CASE Geoanalytics (prototype)",
      "qcStatus":       "accepted",
      "note":           "Headline asking rent only. Achievable rent, incentives and service charge unverified.",
      "nextRefreshAt":  null              // null = derive from cadence policy (§4.3)
    }
  },

  // ── RECORD-LEVEL PROVENANCE + QC (§2.3 defaults, §5.7 collection metadata) ─
  "_meta": {
    "recordConfidence":      "High",      // High | Medium | Low | Unknown – see §3.8 for how it is set
    "sourceConfidenceLetter": null,       // the provider's own grade ("B"), displayed, never interpreted
    "sourceCount":           0,
    "sourceIds":             ["SRC-DEMO"],
    "coordinateAccuracy":    "synthetic", // field_gps | single | approximate | synthetic | unknown
    "verificationMode":      "synthetic", // desk | field | phone | document | synthetic | none
    "collectedAt":           "2026-09-10",
    "lastVerifiedAt":        "2026-09-10",
    "nextRefreshAt":         null,        // record-level override; null = derived (§4.3)
    "seedObjectId":          null,
    "seedBatch":             null,        // primary | supplementary | null
    "possibleDuplicate":     false,
    "duplicateGroupId":      null,
    "duplicateVerdict":      "undecided", // undecided | same_building | different_buildings
    "districtSourceLabel":   null,        // what the provider claimed, verbatim
    "districtSourceKey":     null,        // that claim, canonicalised
    "districtResolvedBy":    "synthetic", // polygon | source_label | manual | synthetic | outside
    "districtConflict":      false,       // TRUE when polygon != source claim (10 seed records)
    "entityReview":          "confirmed_bc",  // confirmed_bc | suspected_non_bc | unreviewed
    "qcStatus":              "accepted",  // draft | needs_check | in_review | accepted | rejected
    "qcFlags":               [],          // see §5.10
    "sourceNote":            "DEMO RECORD – fictional. Excluded from market analytics by default.",
    "internalNote":          null,        // hidden when the session role is External (§60)
    "demoPurpose":           "fully populated record – exercises every metric, chart and comparison row",
    "origin":                "seed",      // seed | user | import
    "editedLocally":         false,
    "createdAt":             "2026-09-10T00:00:00Z",
    "updatedAt":             "2026-09-10T00:00:00Z"
  },

  // ── §5.7 / §22 FIELD-COLLECTION METADATA – READY, null in the MVP ─────────
  "_collection": null,                    // shape in §2.9

  // ── §2.4 HISTORY – keyed by field name, ascending by observedAt ───────────
  "_history": {
    "askingRent": [
      { "value": 42, "observedAt": "2026-03-01", "recordedAt": "2026-03-04T09:00:00Z",
        "sourceId": "SRC-DEMO", "method": "other", "confidence": "Low",
        "collectorId": null, "note": "previous quoted rate", "supersededAt": "2026-09-10" }
    ]
  }
}
```

A real seed record, for contrast – same keys, honest emptiness (`Gross Plaza`, one of the 16 priced records):

```jsonc
{
  "id": "BC-f1fa83bd7153", "recordType": "VERIFIED_SOURCE",
  "name": "Gross Plaza", "altNames": [], "status": null,
  "address": "улица Тараса Шевченко, 21а, Tashkent",
  "districtKey": "mirobod", "lat": 41.297227, "lng": 69.281701,
  "officeClass": "A", "yearOpened": null, "yearRenovated": null, "floors": null,
  "gba": null, "gla": null, "typicalFloorPlate": null,
  "parkingSpaces": null, "parkingRatio": null,
  "developer": null, "owner": null, "operator": null,
  "askingRent": 34.8, "currency": "USD", "rentUnit": "m2/month", "rentUnitAssumed": true,
  "serviceCharge": null, "serviceChargeUnit": null, "vatTreatment": null,
  "occupancyPct": null, "vacancyPct": null, "availableArea": null, "minUnit": null,
  "leaseTerms": null, "leaseTermsStruct": null,
  "tenants": [], "tenantsStatus": "not_collected",
  "amenities": [], "amenitiesStatus": "not_collected",
  "_evidence": {
    "name": "2GIS-BASE", "lat": "2GIS-BASE", "lng": "2GIS-BASE", "address": "2GIS-BASE",
    "districtKey": "GEOMETRY", "officeClass": "2GIS-CLASS", "askingRent": "2GIS-RENT"
  },
  "_meta": {
    "recordConfidence": "Medium", "sourceConfidenceLetter": "B", "sourceCount": 1,
    "sourceIds": ["SRC-2GIS"], "coordinateAccuracy": "single", "verificationMode": "desk",
    "collectedAt": "2026-07-19", "lastVerifiedAt": "2026-07-19", "nextRefreshAt": null,
    "seedObjectId": "SEED000020", "seedBatch": "primary",
    "possibleDuplicate": false, "duplicateGroupId": null, "duplicateVerdict": "undecided",
    "districtSourceLabel": "Mirabad", "districtSourceKey": "mirobod",
    "districtResolvedBy": "polygon", "districtConflict": false,
    "entityReview": "unreviewed", "qcStatus": "needs_check", "qcFlags": ["rent_unit_assumed"],
    "sourceNote": "Уточнить адрес, GBA/GLA, этажность, vacancy, парковку, арендаторов и дату ввода.",
    "internalNote": null, "demoPurpose": null,
    "origin": "seed", "editedLocally": false,
    "createdAt": "2026-07-19T00:00:00Z", "updatedAt": "2026-07-19T00:00:00Z"
  },
  "_collection": null,
  "_history": {}
}
```

### 2.2 §5.1 Identification

| Field | Type | Unit | Required | Enum / pattern | Notes |
|---|---|---|---|---|---|
| `id` | string | – | **yes** | `^(BC\|DEMO\|LOC)-[A-Za-z0-9]+$` | Immutable. Seed uses `master_id` verbatim (`BC-xxxxxxxxxxxx`, 148 unique, verified). Demo uses `DEMO-NNN`. Records created in the editor use `LOC-` + 12 hex chars from `crypto.randomUUID()`. **The prefix is not the classifier – `recordType` is.** |
| `recordType` | enum | – | **yes** | `VERIFIED_SOURCE` \| `DEMO` | No default. A record without it is **rejected at load**, not defaulted (§8). Immutable after creation. |
| `name` | string | – | **yes** | non-empty after trim | 148/148. Display name as the source gave it; 12 are Cyrillic. Homoglyph folding on search only, never on the stored value (`01-product-spec.md` R6). |
| `altNames` | string[] | – | key required | – | `[]` = none recorded. Searched alongside `name`. |
| `status` | enum\|null | – | key required | `Operating` \| `Under construction` \| `Planned` \| `Renovation` | **0/148 in the seed.** `null` = not recorded; the UI renders "Not recorded". `Unknown` is never stored (§0.4). |
| `address` | string\|null | – | key required | – | 109/148. Free text; 100 of 109 are Cyrillic. No structured street/house split in the MVP. |
| `districtKey` | enum\|null | – | key required | one of the 12 keys in §6.1 | **Polygon-derived and authoritative** (§6.2). `null` only when the point falls outside all 12 polygons (0 seed records). |
| `lat` | number | deg WGS-84 | **yes** | −90…90; Tashkent gate 41.15–41.42 | 6 dp. 148/148. |
| `lng` | number | deg WGS-84 | **yes** | −180…180; Tashkent gate 69.10–69.45 | 6 dp. 148/148. |

### 2.3 §5.2 Property

| Field | Type | Unit | Required | Enum | Notes |
|---|---|---|---|---|---|
| `officeClass` | enum\|null | – | key required | `A+` `A` `B+` `B` `C` | 16/148 (A 8, A+ 4, B 3, B+ 1). §5.2: "do not force classification where evidence is insufficient" → `null`, never `C` as a fallback. Seed classes come from a directory listing, so their evidence confidence is `Low` (§3.4). |
| `yearOpened` | int\|null | year | key required | 1900 … currentYear+10 | 0/148. |
| `yearRenovated` | int\|null | year | key required | ≥ `yearOpened` | 0/148. |
| `floors` | int\|null | floors | key required | 1 … 120 | 0/148. Above-ground office floors; basements excluded. |
| `gba` | number\|null | m² | key required | > 0 | 0/148. Gross Building Area. |
| `gla` | number\|null | m² | key required | > 0, ≤ `gba` | 0/148. Gross Lettable Area. |
| `typicalFloorPlate` | number\|null | m² | key required | > 0 | 0/148. |
| `parkingSpaces` | int\|null | spaces | key required | ≥ 0 | 0/148. **`0` is a value** – a building with no parking. |
| `parkingRatio` | number\|null | spaces per **100 m² GLA** | key required | 0 … 20 | DERIVED when null and both `parkingSpaces` and `gla` are known: `parkingSpaces / gla * 100`. Stored only when the source states a ratio directly. |
| `developer` | string\|null | – | key required | – | 0/148. |
| `owner` | string\|null | – | key required | – | 0/148. Internal-only in External role (§60). |
| `operator` | string\|null | – | key required | – | 0/148. Management company. |

### 2.4 §5.3 Commercial

| Field | Type | Unit | Required | Enum | Notes |
|---|---|---|---|---|---|
| `askingRent` | number\|null | per `currency`+`rentUnit` | key required | ≥ 0 | 16/148, range 19.9–44.7. Headline asking rent, **not** achieved rent. `0` = confirmed free/peppercorn, `null` = unknown (§36). |
| `currency` | enum\|null | – | key required | `USD` `UZS` `EUR` | Applies to `askingRent` **and** `serviceCharge`. Non-null whenever either is non-null. |
| `rentUnit` | enum\|null | – | key required | `m2/month` `m2/year` `unit/month` | Non-null whenever `askingRent` is non-null. |
| `rentUnitAssumed` | boolean | – | key required | – | **`true` for all 16 seed rents.** The source never states currency or unit; USD/m²/month is an external convention. Every rent display carries the footnote "Unit assumed USD/m²/month; not stated by the source" (`01-product-spec.md` R9). Open question O-3. |
| `serviceCharge` | number\|null | per `currency`+`serviceChargeUnit` | key required | ≥ 0 | 0/148. |
| `serviceChargeUnit` | enum\|null | – | key required | same enum as `rentUnit` | Non-null whenever `serviceCharge` is non-null. |
| `vatTreatment` | enum\|null | – | key required | `vat_excluded` `vat_included` `vat_exempt` | 0/148. |
| `occupancyPct` | number\|null | % | key required | 0 … 100 | 0/148. `0` = confirmed empty building. |
| `vacancyPct` | number\|null | % | key required | 0 … 100 | 0/148. `0` = confirmed fully let. Cross-check V-C3 (§9.1). |
| `availableArea` | number\|null | m² | key required | ≥ 0, ≤ `gla` | 0/148. `0` = confirmed nothing available. |
| `minUnit` | number\|null | m² | key required | > 0, ≤ `availableArea` when both known | 0/148. Smallest lettable unit. |
| `leaseTerms` | string\|null | – | key required | – | 0/148. Free text in the MVP. |
| `leaseTermsStruct` | object\|null | – | key required | see §2.6 | **READY.** Always `null` in the MVP. |

### 2.5 §5.4 Tenants

`tenants` is an array of `Tenant` objects; `tenantsStatus` disambiguates the empty array.

| Tenant field | Type | Unit | Required | Enum | Notes |
|---|---|---|---|---|---|
| `name` | string | – | **yes** | non-empty | Searched by global search (§18). |
| `industry` | enum\|null | – | key required | §5.7 tenant industry enum | `null` = not categorised. |
| `area` | number\|null | m² | key required | > 0 | Occupied area. |
| `floor` | string\|null | – | key required | – | String, not int – real values are ranges (`"3-6"`) and mixed (`"G, 2"`). |
| `since` | DateOnly\|null | – | key required | – | **READY.** Lease commencement. |
| `leaseEnd` | DateOnly\|null | – | key required | – | **READY.** Lease expiry – the field that makes a future rent-roll / expiry-profile analysis possible. |
| `sourceId` | string\|null | – | key required | an `id` in `sources[]` | Per-tenant provenance. |

| `tenantsStatus` | Meaning | Analytics effect |
|---|---|---|
| `not_collected` | No one has looked. **Seed value for all 148.** | Record excluded from any tenant-count denominator. |
| `partial` | Some tenants known, list incomplete. | Counted in "records with any tenant data"; **excluded** from "total tenants" sums. |
| `complete` | List believed complete at `lastVerifiedAt`. | Included in tenant sums. |
| `confirmed_empty` | Surveyed; the building has no tenants. | `tenants.length === 0` is a **true zero** (§36). |

### 2.6 §5.5 Amenities, and the READY lease-terms object

`amenities` is an array of tokens from the §5.10 enum; `amenitiesStatus` uses the same four values as
`tenantsStatus`. Seed: `[]` + `not_collected` for all 148.

```jsonc
// leaseTermsStruct – READY, null in the MVP. Defined here so a future importer has a target shape.
{
  "minTermMonths":     60,
  "maxTermMonths":     120,
  "rentFreeMonths":    3,
  "fitOutContribution": null,          // currency per m2 GLA
  "indexationType":    "fixed_pct",    // fixed_pct | cpi | usd_peg | none
  "indexationPct":     3,
  "breakOptionMonths": 36,
  "depositMonths":     3,
  "notes":             null
}
```

### 2.7 `_evidence` – see §3

### 2.8 `_meta` – record-level provenance and QC

| Field | Type | Required | Enum | Notes |
|---|---|---|---|---|
| `recordConfidence` | enum | yes | `High` `Medium` `Low` `Unknown` | Roll-up, **derived at build** by the rule in §3.8, not hand-set. |
| `sourceConfidenceLetter` | string\|null | yes | – | The provider's own grade. `"B"` for all 148. **Displayed with its scheme named, never interpreted, never filtered on** (D7). |
| `sourceCount` | int | yes | ≥ 0 | 1 for all 148 seed records; 0 for demo. |
| `sourceIds` | string[] | yes | ids in `sources[]` | New in this spec – makes §0.5 fact 1 representable. `["SRC-2GIS"]` (103), `["SRC-GOLDENPAGES"]` (26), `["SRC-GOOGLEMAPS"]` (19). |
| `coordinateAccuracy` | enum | yes | `field_gps` `single` `approximate` `synthetic` `unknown` | 109 `single` + 39 `single` (normalised from free text, §0.5 fact 2). |
| `verificationMode` | enum | yes | `desk` `field` `phone` `document` `synthetic` `none` | 148 `desk` (from `online`). |
| `collectedAt` | DateOnly | yes | – | `2026-07-19` for all 148. |
| `lastVerifiedAt` | DateOnly\|null | yes | – | `null` = never verified → the §19 chip reads "Not verified". Seed: `2026-07-19` (desk-verified at collection). |
| `nextRefreshAt` | DateOnly\|null | yes | – | Record-level **override**. `null` = derive (§4.3). Nothing in the MVP writes it. |
| `seedObjectId` | string\|null | yes | – | 109 present, 39 `null`. |
| `seedBatch` | enum\|null | yes | `primary` `supplementary` | Preserves the real two-batch structure found in §0.5 fact 2. |
| `possibleDuplicate` | boolean | yes | – | `true` for 12. |
| `duplicateGroupId` | string\|null | yes | – | `DUP-COORD-0022`…`0027`. |
| `duplicateVerdict` | enum | yes | `undecided` `same_building` `different_buildings` | Defaults `undecided`. **Never auto-merge** (D9). |
| `districtSourceLabel` | string\|null | yes | – | The provider's claim verbatim, incl. `"Алмазарский район"`. |
| `districtSourceKey` | enum\|null | yes | 12 keys | That claim canonicalised via §6.1. |
| `districtResolvedBy` | enum | yes | `polygon` `source_label` `manual` `synthetic` `outside` | `polygon` for 148. |
| `districtConflict` | boolean | yes | – | `true` for the 10 records in §6.3. |
| `entityReview` | enum | yes | `confirmed_bc` `suspected_non_bc` `unreviewed` | Default `unreviewed`; 7 seed records pre-flagged `suspected_non_bc` (D10, §9.6). |
| `qcStatus` | enum | yes | `draft` `needs_check` `in_review` `accepted` `rejected` | Seed: `needs_check` (single source, desk-only, never field-verified). |
| `qcFlags` | string[] | yes | §5.10 | `[]` when clean. |
| `sourceNote` | string\|null | yes | – | The provider's note. Identical Russian string on all 148 → zero information; render once in the Data Quality section, not per field. |
| `internalNote` | string\|null | yes | – | Hidden in External role (§60). |
| `demoPurpose` | string\|null | yes | – | Non-null only on DEMO records; states which code path the fixture exercises. |
| `origin` | enum | yes | `seed` `user` `import` | `user` records show the amber "Added locally – not verified" badge (`01-product-spec.md` §3.1 item 28). |
| `editedLocally` | boolean | yes | – | `true` once any field is changed in the editor. Survives export. |
| `createdAt` | Timestamp | yes | – | |
| `updatedAt` | Timestamp | yes | – | Set on every successful `upsert`. |

### 2.9 `_collection` – field-collection metadata (§5.7, §22) – **READY**

`null` in every MVP record. Shape, so a future collector app and a future importer agree:

```jsonc
{
  "collectorId":   "COL-0031",
  "collectedAt":   "2026-11-04T08:41:00Z",
  "gps":           { "lat": 41.3117, "lng": 69.2802, "accuracyM": 6 },   // device GPS at capture
  "photos": [
    { "id": "PH-0001", "url": null, "caption": "Main entrance",
      "takenAt": "2026-11-04T08:42:11Z", "gps": { "lat": 41.3117, "lng": 69.2802 }, "hash": null }
  ],
  "deviceId":      "and-8831",
  "reviewer":      "REV-004",
  "reviewedAt":    "2026-11-06T10:02:00Z",
  "qcStatus":      "accepted",
  "qcNotes":       null,
  "fieldsVerified": ["askingRent", "vacancyPct", "parkingSpaces"],
  "taskId":        "TASK-2026-W45-012"
}
```

The MVP renders a Data-Quality line "Field collection: not started" whenever `_collection === null`, and the
verification queue (§50) produces the *ranked list* a future task generator would consume – but creating a task
returns "Requires confirmation and a backend – not available in the prototype".

### 2.10 `_derived` – **DERIVED**, never stored, never exported

Computed once per record by `GEO.schema.derive(record, ctx)` after load and after every `upsert`. Export calls
`GEO.dataset.strip(record)` which deletes `_derived`; the round-trip test in §7.6 fails if any `_derived` key
survives.

| Key | Type | Source |
|---|---|---|
| `isDemo` | boolean | `recordType === 'DEMO'` |
| `completeness` | int 0–100 | §9.5 |
| `completenessBand` | enum `minimal` `partial` `good` `strong` | §9.5 |
| `knownFieldCount` / `knownCriticalCount` | int | §9.5 |
| `missingCritical` | string[] | critical fields whose value is `null` |
| `verificationState` | enum `fresh` `due_soon` `stale` `never_verified` | §4.4 |
| `staleFields` / `dueSoonFields` | string[] | §4.4 |
| `nextRefreshByField` | `{field: DateOnly}` | §4.3 |
| `nextActionAt` / `nextActionType` | DateOnly / `collect` \| `verify` | §4.5 |
| `verificationPriority` | number 0–200 | §4.6 |
| `ageDays` | int | `today − _meta.collectedAt` |
| `districtName` | string | `districts[districtKey].name` |
| `searchKey` | string | folded `name + altNames + address + districtName + tenant names` (R6) |
| `hasRent` / `hasClass` / `hasGla` … | boolean | `hasValue()` per filterable field; feeds the coverage-driven filter panel (R2) |

---

## 3. Provenance and evidence model (§2.3, §5.6, §37)

### 3.1 The decision

**Three tiers, resolved by precedence. Per-field evidence is the semantic model; profile references are the
storage form.**

```
tier 3  record._evidence[field]  →  string (profile key)  OR  inline Evidence object   ← most specific, wins
tier 2  record._meta             →  record-level defaults (collectedAt, lastVerifiedAt, sourceIds, confidence…)
tier 1  envelope.sources[]       →  the source instrument itself (licence, retrieval date, record count)
```

### 3.2 Why this, and not the alternatives

| Option | Verdict |
|---|---|
| **Record-level source list only** | Rejected. §2.3 and §5.6 both specify provenance *per relevant field*, and §37 makes "source history" the data moat. Record-level cannot express the seed's actual situation: `name`/`lat`/`lng` are directory facts (Medium), `districtKey` is computed from an official 2024 boundary (High), `officeClass` and `askingRent` are advertising claims (Low). Collapsing those to one record confidence throws away the only interesting provenance the dataset has. |
| **Full Evidence object on every field** | Rejected on cost, not on principle. ~51 000 near-identical objects, ~6 MB, over the localStorage quota (§1). It also makes the Data Editor slower to reason about than the data justifies at 148 records. |
| **Three-tier hybrid (adopted)** | Full §2.3 semantics at record-level storage cost. The seed needs **8 profiles** to describe 148 records precisely. The editor upgrades a reference to an inline object the moment a human touches a field – which is exactly `02-brief-critique.md` C13's resolution, and exactly what §21 exists to test. |

### 3.3 `sources[]` – tier 1 (the source instrument)

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | yes | `SRC-*`. Referenced by `_meta.sourceIds`, `_evidence[*].sourceId`, `tenants[].sourceId`. |
| `name` | string | yes | Human-readable instrument name. |
| `method` | enum | yes | §5.4 collection-method enum. |
| `retrievedAt` | DateOnly | yes | |
| `recordCount` | int | yes | Records attributed to this source in this dataset. Must equal the count of records whose `_meta.sourceIds` contains this id – validation V-E2. |
| `url` | string\|null | yes | `null` for all seed sources – no per-record source URLs exist (0/148 `sourceUrl`). |
| `licenceReview` | enum | yes | `required` \| `cleared` \| `n_a`. `required` for every seed source: commercial redistribution of directory data is unresolved. Open question O-1. |
| `note` | string\|null | yes | |

**Required seed content (corrects the current artefact – §0.5 fact 1):**

| id | name | method | retrievedAt | recordCount | licenceReview |
|---|---|---|---|---|---|
| `SRC-2GIS` | 2GIS directory listing (CASE Tashkent Geo Master seed) | `map_service` | 2026-07-19 | **103** | `required` |
| `SRC-GOLDENPAGES` | GoldenPages directory listing (CASE Tashkent Geo Master seed) | `map_service` | 2026-07-19 | **26** | `required` |
| `SRC-GOOGLEMAPS` | Google Maps listing (CASE Tashkent Geo Master seed) | `map_service` | 2026-07-19 | **19** | `required` |
| `SRC-CITY-BOUNDARY` | Toshkent shahar chegarasi (2024) | `public_registry` | 2024-01-01 | 12 | `required` |
| `SRC-DEMO` | Synthetic demo record – not market data | `other` | 2026-09-10 | 8 | `n_a` |

### 3.4 `evidenceProfiles{}` – the reusable Evidence template

A profile is an Evidence object without `value` and without per-record dates that vary. Required seed profiles:

| Profile key | sourceId | method | confidence | qcStatus | Applies to | Records |
|---|---|---|---|---|---|---|
| `2GIS-BASE` | `SRC-2GIS` | `map_service` | `Medium` | `needs_check` | `name` `lat` `lng` `address` | 103 |
| `2GIS-CLASS` | `SRC-2GIS` | `map_service` | `Low` | `needs_check` | `officeClass` | 16 |
| `2GIS-RENT` | `SRC-2GIS` | `map_service` | `Low` | `needs_check` | `askingRent` | 16 |
| `GP-BASE` | `SRC-GOLDENPAGES` | `map_service` | `Medium` | `needs_check` | `name` `lat` `lng` `address` | 26 |
| `GM-BASE` | `SRC-GOOGLEMAPS` | `map_service` | `Medium` | `needs_check` | `name` `lat` `lng` `address` | 19 |
| `GEOMETRY` | `SRC-CITY-BOUNDARY` | `public_registry` | `High` | `accepted` | `districtKey` | 148 |
| `DEMO-HIGH` / `DEMO-MEDIUM` / `DEMO-LOW` / `DEMO-UNKNOWN` | `SRC-DEMO` | `other` | as named | `accepted` | any demo field | 8 |

`GEOMETRY` is `High` because the value is **reproducible from the record's own coordinates** against an official
boundary – it is a computation, not a third-party claim. That is the only `High` confidence in the real dataset,
and it is honest.

### 3.5 The Evidence object – full key table

Returned by `GEO.evidence.resolve(record, field)`. Every key in §2.3 and §5.6 is present.

| Key | Type | Required | Enum | Stored? | Notes |
|---|---|---|---|---|---|
| `value` | any | yes in the **resolved** object | – | **NO – projected** | Copied from `record[field]` at resolve time. Storing it inside `_evidence` too would create two copies that drift apart on the first edit. The record field is the single source of truth; the resolver completes the §2.3 contract. In `_history` entries `value` **is** stored – there the past value is the entire point. |
| `source` | string | yes | – | via profile | Human-readable instrument name. |
| `sourceId` | string\|null | yes | id in `sources[]` | yes | Machine link to tier 1. |
| `sourceUrl` | string\|null | yes | URL | yes | `null` for all 148 – the "Open source" action is disabled with the reason "No source URL recorded" (§13). |
| `collectedAt` | DateOnly\|null | yes | – | yes | Falls back to `_meta.collectedAt`. |
| `lastVerifiedAt` | DateOnly\|null | yes | – | yes | Falls back to `_meta.lastVerifiedAt`. `null` = never verified. |
| `method` | enum\|null | yes | §5.4 | yes | |
| `confidence` | enum | yes | `High` `Medium` `Low` `Unknown` | yes | §2.3 vocabulary, exactly four values. |
| `note` | string\|null | yes | – | yes | Why this value should or should not be trusted. |
| `collectorId` | string\|null | yes | – | yes | READY – `null` in the MVP. |
| `reviewer` | string\|null | yes | – | yes | READY – `null` on real records. |
| `qcStatus` | enum | yes | `draft` `needs_check` `in_review` `accepted` `rejected` | yes | |
| `nextRefreshAt` | DateOnly\|null | yes | – | optional override | `null` in storage = **derive** from the cadence policy (§4.3). The resolved object always carries a concrete date or `null` when the field has no value. |
| `_resolvedFrom` | enum | resolved only | `inline` `profile` `record_meta` `none` | no | Lets the UI say "inherited from record" honestly instead of implying a field-level check that never happened. |

### 3.6 Worked example A – a KNOWN value with LOW confidence

This is the single most common real case in the dataset: 16 records have an advertised asking rent that nobody has
verified with a landlord.

**Stored** (`Gross Plaza`, `askingRent`):

```jsonc
"askingRent": 34.8, "currency": "USD", "rentUnit": "m2/month", "rentUnitAssumed": true,
"_evidence": { "askingRent": "2GIS-RENT" }
```

**Resolved** by `GEO.evidence.resolve(rec, 'askingRent')`:

```jsonc
{
  "value": 34.8,
  "source": "2GIS directory listing (CASE Tashkent Geo Master seed)",
  "sourceId": "SRC-2GIS",
  "sourceUrl": null,
  "collectedAt": "2026-07-19",
  "lastVerifiedAt": "2026-07-19",
  "method": "map_service",
  "confidence": "Low",
  "note": "Advertised headline asking rent from a directory listing. Lease terms, service charge, VAT treatment and achievability are all unknown; not landlord-confirmed.",
  "collectorId": null,
  "reviewer": null,
  "qcStatus": "needs_check",
  "nextRefreshAt": "2026-10-17",
  "_resolvedFrom": "profile"
}
```

**How the UI must treat it.** The value is shown – `Low` confidence is not a reason to hide a value (§2.7: disclose,
do not hide). It is shown **with** a `Low` chip, the source name, the note on hover, and the assumed-unit footnote.
It **is** included in the mean/median rent (a Low-confidence value is still an observation), and doc `05` must expose
a confidence filter so a user can recompute over `High + Medium` only. It must **never** be silently upgraded.

### 3.7 Worked example B – a genuinely UNKNOWN value

```jsonc
"gla": null,
"_evidence": { /* NO "gla" key at all */ }
```

`GEO.evidence.resolve(rec, 'gla')` returns **`null`** – not an object with `value: null`.

**Rules, absolute:**

1. A field with no value has **no `_evidence` key**. Absence of evidence is represented by absence of the evidence
   entry, never by an evidence object asserting `confidence: "Unknown"` over a null value – that would be a claim
   about a non-existent observation.
2. A field with a value **must** have an `_evidence` key. The inverse is validation error **V-E1 (BLOCK)**.
3. The UI renders "Not recorded" and, in the Data Quality section, "No source – never collected".
4. Every aggregate skips it via `hasValue`. It contributes to the denominator `M` (all matching records) and never
   to the numerator `N` (records with a verified value) – §14, §36.
5. `confidence: "Unknown"` means something different and narrower: **a value exists but its reliability has not been
   assessed**. In the seed this occurs only on `DEMO-006`. Do not use it for missing data.

| Case | `record[field]` | `_evidence[field]` | `resolve()` | UI |
|---|---|---|---|---|
| Never collected | `null` | absent | `null` | "Not recorded" |
| Collected, reliability unknown | `12000` | present, `confidence: "Unknown"` | object | value + grey "Unknown" chip |
| Collected, low confidence | `34.8` | present, `confidence: "Low"` | object | value + amber "Low" chip |
| Confirmed zero | `0` | present, `confidence: "High"` | object | **"0"** + green chip – never "Not recorded" |
| Value present, evidence missing | `12000` | absent | synthesised from `_meta`, `confidence: "Unknown"`, `_resolvedFrom: "record_meta"` | value + "Source not recorded" – and V-E1 fires |

### 3.8 Resolution algorithm and the confidence roll-up

```js
// src/03-evidence.js
GEO.evidence.resolve = function (rec, field, env) {
  if (!GEO.util.hasValue(rec[field])) return null;                 // rule 1 of §3.7

  var raw = rec._evidence ? rec._evidence[field] : undefined;
  var base;
  if (raw && typeof raw === 'object')      base = Object.assign({}, raw,            { _resolvedFrom: 'inline'  });
  else if (typeof raw === 'string')        base = Object.assign({}, env.evidenceProfiles[raw] || {},
                                                                                    { _resolvedFrom: 'profile' });
  else                                     base = { confidence: 'Unknown', note: null, sourceId: null,
                                                    source: null, sourceUrl: null, method: null,
                                                    collectorId: null, reviewer: null, qcStatus: 'needs_check',
                                                    _resolvedFrom: 'record_meta' };   // V-E1 also fires

  var m = rec._meta;
  return {
    value:          rec[field],                                    // PROJECTED, never stored
    source:         base.source         != null ? base.source         : null,
    sourceId:       base.sourceId       != null ? base.sourceId       : (m.sourceIds[0] || null),
    sourceUrl:      base.sourceUrl      != null ? base.sourceUrl      : null,
    collectedAt:    base.collectedAt    != null ? base.collectedAt    : m.collectedAt,
    lastVerifiedAt: base.lastVerifiedAt != null ? base.lastVerifiedAt : m.lastVerifiedAt,
    method:         base.method         != null ? base.method         : null,
    confidence:     base.confidence     != null ? base.confidence     : 'Unknown',
    note:           base.note           != null ? base.note           : null,
    collectorId:    base.collectorId    != null ? base.collectorId    : null,
    reviewer:       base.reviewer       != null ? base.reviewer       : null,
    qcStatus:       base.qcStatus       != null ? base.qcStatus       : m.qcStatus,
    nextRefreshAt:  base.nextRefreshAt  != null ? base.nextRefreshAt
                                                : GEO.evidence.nextRefreshAt(rec, field, env),
    _resolvedFrom:  base._resolvedFrom
  };
};
```

**`_meta.recordConfidence` roll-up – computed, never hand-set:**

```js
// Weakest link across the CRITICAL fields that actually have a value.
// Rationale: a record whose rent is Low-confidence is a Low-confidence record for a rent question, and the
// headline chip must not be flattered by High-confidence geometry.
GEO.evidence.rollUp = function (rec, env) {
  var RANK = { High: 3, Medium: 2, Low: 1, Unknown: 0 };
  var vals = env.criticalFields
      .map(function (f) { var e = GEO.evidence.resolve(rec, f, env); return e && e.confidence; })
      .filter(Boolean);
  if (!vals.length) {                                   // no critical field has any value at all
    var base = GEO.evidence.resolve(rec, 'name', env);  // fall back to identification evidence
    return base ? base.confidence : 'Unknown';
  }
  return vals.reduce(function (a, b) { return RANK[a] <= RANK[b] ? a : b; });
};
```

At seed this yields `Medium` for the 132 records with no critical value (identification evidence) and **`Low`** for
the 16 records whose `officeClass` and `askingRent` are directory claims. That is a more honest and more *useful*
distribution than the constant `Medium` the current artefact emits – it gives the §11 confidence filter and the §42
confidence layer real variance for the first time, without inventing anything.

### 3.9 What the Data Editor writes on an edit (§21)

Editing a field performs exactly this patch. It is the mechanism that turns record-level provenance into
field-level provenance over time – the §37 data moat, in miniature.

```js
// src/13-editor.js – on save of one field
function applyFieldEdit(rec, field, newValue, form, env) {
  var prev = rec[field];

  // 1. history BEFORE overwrite, only when a real value is being replaced by a different real value
  if (GEO.util.hasValue(prev) && prev !== newValue) {
    var old = GEO.evidence.resolve(rec, field, env);
    (rec._history[field] = rec._history[field] || []).push({
      value: prev, observedAt: old.lastVerifiedAt || old.collectedAt,
      recordedAt: GEO.util.nowIso(), sourceId: old.sourceId, method: old.method,
      confidence: old.confidence, collectorId: old.collectorId, note: old.note,
      supersededAt: GEO.util.today()
    });
  }

  // 2. the value
  rec[field] = GEO.util.hasValue(newValue) ? newValue : null;      // "clear" writes null, never ""

  // 3. evidence: a profile REFERENCE is upgraded to an INLINE object. It is never edited in place –
  //    the profile is shared by up to 103 records.
  if (rec[field] === null) { delete rec._evidence[field]; }         // rule 1 of §3.7
  else {
    rec._evidence[field] = {
      source: form.source, sourceId: form.sourceId || null, sourceUrl: form.sourceUrl || null,
      method: form.method, confidence: form.confidence,             // the editor REQUIRES both
      collectedAt: form.collectedAt || GEO.util.today(),
      lastVerifiedAt: form.lastVerifiedAt || GEO.util.today(),
      collectorId: form.collectorId || null, reviewer: null,
      qcStatus: 'draft', note: form.note || null, nextRefreshAt: null
    };
  }

  // 4. record meta
  rec._meta.editedLocally = true;
  rec._meta.updatedAt     = GEO.util.nowIso();
  rec._meta.lastVerifiedAt = GEO.util.maxDate(rec._meta.lastVerifiedAt, form.lastVerifiedAt);
  rec._meta.recordConfidence = GEO.evidence.rollUp(rec, env);
  if (form.sourceId && rec._meta.sourceIds.indexOf(form.sourceId) < 0) {
    rec._meta.sourceIds.push(form.sourceId);
    rec._meta.sourceCount = rec._meta.sourceIds.length;
  }
}
```

**The editor may not save a value without `method` and `confidence`.** This is a BLOCK-level rule (V-E3) and it is
the single most important product-testing behaviour in §21: it makes the collection workflow's cost visible before
the backend is built.

---

## 4. History-readiness and refresh cadence (§2.4, §23)

### 4.1 `_history` shape

```jsonc
"_history": {
  "askingRent": [
    { "value": 29.8, "observedAt": "2025-11-02", "recordedAt": "2025-11-04T10:00:00Z",
      "sourceId": "SRC-2GIS", "method": "map_service", "confidence": "Low",
      "collectorId": null, "note": null, "supersededAt": "2026-07-19" },
    { "value": 34.8, "observedAt": "2026-07-19", "recordedAt": "2026-07-19T00:00:00Z",
      "sourceId": "SRC-2GIS", "method": "map_service", "confidence": "Low",
      "collectorId": null, "note": null, "supersededAt": null }
  ]
}
```

| Rule | |
|---|---|
| Container | Object keyed by field name. `{}` when no history. Only fields listed in §4.2 as `fast` or `slow` may have history; `stable` fields keep history too (a corrected coordinate matters) but are expected to be rare. |
| Ordering | Ascending by `observedAt`. Sorted on write, asserted on import. |
| Current value | Lives in the record field, **not** in `_history`. `_history` holds superseded observations only. An entry with `supersededAt: null` may exist as a mirror of the current value when a future importer writes full series; the MVP never writes one. |
| `value` | Stored here (unlike `_evidence`, §3.5) – the past value exists nowhere else. |
| `observedAt` vs `recordedAt` | `observedAt` = when the value was true / was quoted. `recordedAt` = when the platform learned it. They differ, and a future rent index needs both. |
| MVP behaviour | **NOW:** the editor appends one entry per overwritten non-null field (§3.9 step 1). **READY:** nothing else writes history; no chart reads it; no time-series UI exists. |
| Round-trip | `_history` exports and imports unchanged. |

> **Reconciliation.** `01-product-spec.md` §3.2 A5 describes `history: []` – a flat array, never written. This
> document supersedes it on both points: (a) the shape is a **field-keyed object**, which is what the already-built
> `data/seed.json` emits (`"_history": {}`) and what per-field cadence (§4.2) requires; (b) the editor **does**
> append on overwrite, because it costs eight lines, it makes §2.4 testable inside §21's workflow, and without it
> an edit destroys the previous observation irrecoverably. Recorded as decision **O-5**.

### 4.2 Refresh cadence classes (§23)

| Class | Interval | Rationale |
|---|---|---|
| `fast` | **90 days** | Commercial terms are re-quoted roughly quarterly in the Tashkent office market. |
| `slow` | **365 days** | Physical and classification attributes change on a build/refit cycle. |
| `stable` | **1095 days** (3 y) | Identity and geometry change only on redevelopment or a data correction. |
| `dueSoonDays` | **14 days** | Warning window before `nextRefreshAt`. |

> **Why 90 and not 60.** The currently generated `data/seed.json` sets `refreshDays.fast = 60`. With every seed
> record verified on 2026-07-19, a 60-day window makes all 16 priced records go stale on **2026-09-17** – the day
> after this document was written. Every QA number in `01-product-spec.md` would silently change overnight with no
> code change. 90 days moves the crossover to **2026-10-17**, matches the "90-day commercial refresh" that
> `01-product-spec.md` C6 already assumes, and is the defensible CRE answer. **Required change R2 (§11.1).**
> QA must still express staleness expectations *relative to `generatedAt`*, never as absolute counts (§4.7).

**Per-field class – complete table. Every field in the record is assigned.**

| Class | Fields |
|---|---|
| `stable` (1095 d) | `name` `altNames` `address` `lat` `lng` `districtKey` |
| `slow` (365 d) | `officeClass` `yearOpened` `yearRenovated` `floors` `gba` `gla` `typicalFloorPlate` `parkingSpaces` `parkingRatio` `developer` `owner` `operator` `amenities` `vatTreatment` |
| `fast` (90 d) | `status` `askingRent` `currency` `rentUnit` `serviceCharge` `serviceChargeUnit` `occupancyPct` `vacancyPct` `availableArea` `minUnit` `leaseTerms` `leaseTermsStruct` `tenants` |

`status` is `fast` deliberately: a building moves from `Under construction` to `Operating` on a date that matters
commercially more than any other single fact in the record.

### 4.3 `nextRefreshAt` – derived, not stored

```js
GEO.evidence.nextRefreshAt = function (rec, field, env) {
  if (!GEO.util.hasValue(rec[field])) return null;                       // nothing to refresh
  var ev   = rec._evidence && rec._evidence[field];
  if (ev && typeof ev === 'object' && ev.nextRefreshAt) return ev.nextRefreshAt;   // explicit override
  if (rec._meta.nextRefreshAt) return rec._meta.nextRefreshAt;                     // record override
  var base = (ev && typeof ev === 'object' && ev.lastVerifiedAt) || rec._meta.lastVerifiedAt;
  if (!base) return null;                                                // never verified -> no due date
  var cls  = env.fieldRefreshClass[field] || 'slow';                      // unknown field defaults to slow
  return GEO.util.addDays(base, env.refreshDays[cls]);                    // DateOnly arithmetic, UTC
};
```

### 4.4 The staleness predicate – exact

```js
GEO.quality.isFieldStale = function (rec, field, env, today) {
  var due = GEO.evidence.nextRefreshAt(rec, field, env);
  return due !== null && today > due;                                     // strict; due today is NOT stale
};

GEO.quality.recordStaleness = function (rec, env, today) {
  var valued = Object.keys(env.fieldRefreshClass).filter(function (f) { return GEO.util.hasValue(rec[f]); });

  if (!valued.length)                   return { state: 'never_verified', staleFields: [], dueSoonFields: [] };
  if (!rec._meta.lastVerifiedAt &&
      !valued.some(function (f) { var e = rec._evidence[f];
                                  return e && typeof e === 'object' && e.lastVerifiedAt; }))
                                        return { state: 'never_verified', staleFields: [], dueSoonFields: [] };

  var stale = valued.filter(function (f) { return GEO.quality.isFieldStale(rec, f, env, today); });
  var soon  = valued.filter(function (f) {
        var d = GEO.evidence.nextRefreshAt(rec, f, env);
        return d && today <= d && GEO.util.daysBetween(today, d) <= env.dueSoonDays;
      });

  return {
    state: stale.length ? 'stale' : (soon.length ? 'due_soon' : 'fresh'),
    staleFields: stale, dueSoonFields: soon,
    oldestDue: stale.length ? GEO.util.minDate(stale.map(function (f) {
                 return GEO.evidence.nextRefreshAt(rec, f, env); })) : null
  };
};
```

**In one sentence: a record is stale when at least one field that *has a value* is past that field's own
`lastVerifiedAt + refreshDays[class]`.** A record that is merely *empty* is **not** stale – it is *incomplete*,
which is a different indicator with a different fix (collect, not re-verify). Conflating the two would put all 148
records in the stale bucket permanently and teach a tester nothing (`02-brief-critique.md` D8).

### 4.5 `nextActionAt` / `nextActionType` – what the verification queue ranks on

```js
GEO.quality.nextAction = function (rec, env, today) {
  var d = GEO.schema.derive(rec, env);
  if (d.missingCritical.length > 0)                                       // needs COLLECTION, not re-verification
    return { at: GEO.util.addDays(rec._meta.lastVerifiedAt || rec._meta.collectedAt, env.refreshDays.fast),
             type: 'collect', reason: d.missingCritical };
  var s = GEO.quality.recordStaleness(rec, env, today);
  return { at: s.oldestDue || GEO.util.minDate(Object.values(d.nextRefreshByField)),
           type: 'verify', reason: s.staleFields };
};
```

All 148 seed records have ≥ 6 of 8 critical fields missing → `type: 'collect'`, `at: 2026-10-17`. This is the
correct and useful answer for §50: the Tashkent dataset does not need re-verification, it needs collection.

### 4.6 Verification priority (initial weights; doc `05` may tune)

```
priority = (100 − completeness)
         + 30 × (verificationState === 'stale')
         + 20 × (_meta.districtConflict)
         + 15 × (_meta.possibleDuplicate && duplicateVerdict === 'undecided')
         + 10 × (_meta.entityReview === 'suspected_non_bc')
         + { Unknown: 20, Low: 15, Medium: 5, High: 0 }[_meta.recordConfidence]
clamped to 0…200
```

### 4.7 Seed staleness – the exact, date-dependent truth

With `fast = 90`, all seed `lastVerifiedAt = 2026-07-19`, and **today = 2026-09-16**:

| Cohort | Fields with values | Due | State today |
|---|---|---|---|
| 132 VERIFIED_SOURCE without class/rent | `name` `lat` `lng` `districtKey` (+`address` for 93) – all `stable` | 2029-07-18 | `fresh` |
| 16 VERIFIED_SOURCE with class + rent | + `officeClass` (slow → 2027-07-19), `askingRent` (fast → **2026-10-17**) | 2026-10-17 | `fresh` |
| DEMO-004 (`lastVerifiedAt` 2025-11-02, has `occupancyPct`) | fast → 2026-01-31 | overdue | **`stale`** |
| DEMO-006 (`lastVerifiedAt` 2026-06-15, has `status: Planned`) | fast → 2026-09-13 | overdue | **`stale`** |
| DEMO-001/002/003/005/007/008 | – | future | `fresh` |

**0 of 148 real records are stale today, and that is the honest answer.** The UI legend must say so:
"All 148 records share one collection date (19 Jul 2026), so staleness cannot currently differentiate them. The
first real records become due on 17 Oct 2026." A tester creates staleness by editing a `lastVerifiedAt` in the Data
Editor – which is exactly how §21's workflow is supposed to be exercised. QA assertions are written as
`generatedAt + N days`, never as "2 stale records".

---

## 5. Enumerations

Every enum below is exhaustive. An unrecognised token on import is **not** silently dropped: it is coerced to
`null`, the original is preserved in `_meta.qcFlags` as `non_enum:<field>:<raw>`, and the import report lists it.

### 5.1 `recordType`

| Token | Meaning |
|---|---|
| `VERIFIED_SOURCE` | Purports to describe a real building; admissible as market evidence, subject to its own confidence. |
| `DEMO` | Fictional. Never market evidence, under any circumstance (§8). |

No third value. A record added by a user in the editor is `VERIFIED_SOURCE` with `_meta.origin: "user"` and
`_meta.qcStatus: "draft"` – see §8.2 for why that is safe.

### 5.2 `status` (§5.1)

| Token | Notes |
|---|---|
| `Operating` | Completed and in use. |
| `Under construction` | On site, not complete. |
| `Planned` | Announced / permitted, not started. |
| `Renovation` | Completed but out of service for refurbishment. |
| – | `null` = not recorded. **`Unknown` is never stored** (§0.4). |

Seed coverage: 0/148. Demo: `Operating` ×5, `Renovation` ×1, `Under construction` ×1, `Planned` ×1.

### 5.3 `officeClass` (§5.2)

`A+` · `A` · `B+` · `B` · `C` · `null` (= not recorded; the brief's "Unknown" is the *rendered* label, never the
stored value). Ordinal for "within ±1 class band" competitive-set logic: `A+`=5, `A`=4, `B+`=3, `B`=2, `C`=1,
`null`= no band (excluded from band comparison, reported separately per rule R5).

### 5.4 `confidence` (§2.3) and `method` (§5.6)

| `confidence` | Meaning |
|---|---|
| `High` | Verified against a primary or reproducible source (landlord, registry, own computation). |
| `Medium` | Credible secondary source, not independently confirmed. |
| `Low` | Advertised / claimed / inferred; plausible but unconfirmed. |
| `Unknown` | A value exists; its reliability has not been assessed. **Not** a synonym for missing (§3.7). |

"Not verified" from §19 is **not** a confidence level. It is the derived boolean
`lastVerifiedAt === null` and renders as its own chip. This resolves the §2.3 / §19 vocabulary clash
(`02-brief-critique.md` C4).

| `method` token | §5.6 wording |
|---|---|
| `public_website` | public website |
| `owner_developer` | owner/developer |
| `broker` | broker |
| `field_visit` | field visit |
| `phone_verification` | phone verification |
| `public_registry` | public registry |
| `map_service` | map service |
| `uploaded_document` | uploaded document |
| `other` | other |

### 5.5 `qcStatus`

`draft` → `needs_check` → `in_review` → `accepted` \| `rejected`. Seed: `needs_check` (148). Demo: `accepted`.
Editor-created: `draft`. `rejected` records stay in the dataset, are excluded from analytics, and are visible only
in the Data Quality view – deletion is a separate, explicit action.

### 5.6 `amenities` (§5.5) – storage tokens and the alias map

| Token | EN label | Alias accepted on import |
|---|---|---|
| `restaurant` | Restaurant | "restaurant" |
| `cafe` | Café | "cafe" |
| `retail` | Retail units | "retail" |
| `gym` | Gym / fitness | "gym" |
| `conference_room` | Conference room | "conference room" |
| `reception` | Manned reception | "reception" |
| `security` | 24/7 security | "security" |
| `underground_parking` | Underground parking | "underground parking" |
| `surface_parking` | Surface parking | "surface parking" |
| `ev_charging` | EV charging | "EV charging" |
| `bicycle_parking` | Bicycle parking | "bicycle parking" |
| `backup_generator` | Backup generator | "backup generator" |

Exactly the twelve tags in §5.5, no additions. New tags require a schema minor version, because an unrecognised tag
would otherwise silently disappear from every amenity filter.

### 5.7 `tenants[].industry`

| Token | EN label |
|---|---|
| `banking` | Banking |
| `financial_services` | Financial services (non-bank) |
| `it_software` | IT & software |
| `telecom` | Telecom |
| `professional_services` | Professional services (consulting, audit, legal) |
| `oil_gas_mining` | Oil, gas & mining |
| `energy_utilities` | Energy & utilities |
| `construction_real_estate` | Construction & real estate |
| `logistics_transport` | Logistics & transport |
| `manufacturing_industrial` | Manufacturing & industrial |
| `retail_wholesale` | Retail & wholesale trade |
| `fmcg_distribution` | FMCG & distribution |
| `pharma_healthcare` | Pharma & healthcare |
| `education_training` | Education & training |
| `media_marketing` | Media & marketing |
| `government_public` | Government & public sector |
| `international_ngo` | International organisation / NGO |
| `diplomatic` | Embassy & diplomatic |
| `hospitality_food` | Hospitality & F&B |
| `coworking_serviced` | Coworking & serviced office |
| `other` | Other |
| – | `null` = not categorised |

Chosen for the Tashkent office market specifically: banking and diplomatic/IFI occupiers are separated out because
they are the two largest identifiable prime-office demand segments in the city, and a future tenant-mix analysis
that buries them in "financial services" and "NGO" would be useless.

### 5.8 `districtKey`

The 12 keys in §6.1. No other value. `null` only for a point outside all polygons.

### 5.9 Structural enums

| Enum | Tokens |
|---|---|
| `tenantsStatus` / `amenitiesStatus` | `not_collected` `partial` `complete` `confirmed_empty` |
| `coordinateAccuracy` | `field_gps` `single` `approximate` `synthetic` `unknown` |
| `verificationMode` | `desk` `field` `phone` `document` `synthetic` `none` |
| `districtResolvedBy` | `polygon` `source_label` `manual` `synthetic` `outside` |
| `duplicateVerdict` | `undecided` `same_building` `different_buildings` |
| `entityReview` | `confirmed_bc` `suspected_non_bc` `unreviewed` |
| `origin` | `seed` `user` `import` |
| `currency` | `USD` `UZS` `EUR` |
| `rentUnit` / `serviceChargeUnit` | `m2/month` `m2/year` `unit/month` |
| `vatTreatment` | `vat_excluded` `vat_included` `vat_exempt` |
| `licenceReview` | `required` `cleared` `n_a` |
| `completenessBand` | `minimal` `partial` `good` `strong` |
| `verificationState` | `fresh` `due_soon` `stale` `never_verified` |

### 5.10 `qcFlags`

| Flag | Set when | Seed count |
|---|---|---|
| `coord_collision` | Another record sits within 30 m | **15** – the 12 the source flagged, plus `Afrosiab`, `Infinity, компания консалтинга…` and `Ventum plaza` (§9.4) |
| `duplicate_name` | Normalised name matches another record, at **any** distance | 2 |
| `district_conflict` | Polygon ≠ source claim | 10 |
| `type_uncertain` | Name suggests a non-office entity | 7 |
| `rent_unit_assumed` | `rentUnitAssumed === true` | 16 |
| `rent_outlier` | Rent outside 5–60 (warn band, §9.1) | 0 |
| `outside_boundary` | Point outside all 12 polygons | 0 |
| `geometry_inconsistent` | `gla > gba`, `availableArea > gla`, `occ+vac ≠ 100` | 0 |
| `non_enum:<field>:<raw>` | Import carried an unrecognised enum token | 0 |
| `no_source_for_value` | A field has a value and no `_evidence` entry (V-E1) | 0 |

---

## 6. District canonicalisation

### 6.1 The canonical table – all 12 districts, every known spelling

Identity is the GeoJSON `name` lower-cased with spaces → hyphens. `bc.json` spellings are **aliases, never
identities** (`01-product-spec.md` R7).

| `districtKey` | GeoJSON `name` | `nameRu` | `nameUz` | area ha | `bc.json` spelling(s) | Other aliases accepted on import | Records (polygon) | Records (source claim) |
|---|---|---|---|---|---|---:|---:|---:|
| `mirobod` | Mirobod | Мирабад | Миробод | 1653.14 | `Mirabad` | `Mirobod`, `Мирабад`, `Миробод`, `Мирабадский район`, `Mirobod tumani` | **28** | 30 |
| `mirzo-ulugbek` | Mirzo Ulugbek | Мирзо-Улугбек | Мирзо Улуғбек | 5939.67 | `Mirzo-Ulugbek` | `Mirzo Ulugbek`, `Mirzo Ulug'bek`, `Мирзо-Улугбек`, `Мирзо-Улугбекский район` | **26** | 26 |
| `yakkasaroy` | Yakkasaroy | Яккасарай | Яккасарой | 1422.80 | `Yakkasaray` | `Yakkasaroy`, `Яккасарай`, `Яккасарой`, `Яккасарайский район` | **24** | 26 |
| `yunusobod` | Yunusobod | Юнусабад | Юнусобод | 4107.61 | `Yunusabad` | `Yunusobod`, `Юнусабад`, `Юнусобод`, `Юнусабадский район` | **22** | 21 |
| `yashnobod` | Yashnobod | Яшнабад | Яшнобод | 5887.18 | `Yashnabad` | `Yashnobod`, `Яшнабад`, `Яшнобод`, `Яшнабадский район`, `Hamza` (pre-2018 name) | **17** | 17 |
| `chilonzor` | Chilonzor | Чиланзар | Чилонзор | 3052.94 | `Chilanzar` | `Chilonzor`, `Чиланзар`, `Чилонзор`, `Чиланзарский район` | **13** | 12 |
| `shayxontohur` | Shayxontohur | Шайхантахур | Шайҳонтохур | 2705.12 | `Shaykhantakhur` | `Shayxontohur`, `Shaykhantaur`, `Sheykhantaur`, `Шайхантахур`, `Шайхантаурский район` | **10** | 9 |
| `olmazor` | Olmazor | Алмазар | Олмазор | 3381.29 | `Olmazor`, **`Алмазарский район`** | `Almazar`, `Алмазар`, `Олмазор`, `Almazor` | **4** | 3 |
| `sergeli` | Sergeli | Сергели | Сергели | 5207.31 | `Sergeli` | `Сергели`, `Сергелийский район`, `Sergeli tumani` | **3** | 3 |
| `uchtepa` | Uchtepa | Учтепа | Учтепа | 2805.28 | `Uchtepa` | `Учтепа`, `Учтепинский район`, `Uchtepa tumani` | **1** | 1 |
| `yangihayot` | Yangihayot | Янгихаёт | Янгиҳаёт | 4423.58 | – (no records) | `Yangi Hayot`, `Yangihayot`, `Янгихаёт`, `Янгиҳаёт` | **0** | 0 |
| `bektemir` | Bektemir | Бектемир | Бектемир | 3260.43 | – (no records) | `Бектемир`, `Бектемирский район` | **0** | 0 |
| | | | | | | **Total** | **148** | **148** |

**`Алмазарский район` → `olmazor`** is the explicit requirement; it is one record, and it is why the matcher
must be an alias table rather than a string comparison.

`yangihayot` and `bektemir` hold a **true zero**, not missing data: they render as `0` in every district chart with
the note "No business centres recorded" (§36, `02-brief-critique.md` M7).

### 6.2 Resolution algorithm – geometry is authoritative

```js
GEO.district.canonical = function (label) {      // alias table lookup; NEVER fuzzy matching
  if (!GEO.util.hasValue(label)) return null;
  var k = String(label).trim().toLowerCase().replace(/\s+/g, ' ');
  return GEO.DISTRICT_ALIASES[k] || null;        // built at boot from the table above, all forms lower-cased
};

GEO.district.resolve = function (rec) {
  var geo = GEO.district.pointInPolygon(rec.lat, rec.lng);     // ray-cast over the 12 MultiPolygons
  var src = GEO.district.canonical(rec._meta.districtSourceLabel);
  rec._meta.districtSourceKey  = src;
  if (geo) { rec.districtKey = geo;  rec._meta.districtResolvedBy = 'polygon';
             rec._meta.districtConflict = !!(src && src !== geo); }
  else if (src) { rec.districtKey = src; rec._meta.districtResolvedBy = 'source_label';
                  rec._meta.districtConflict = false;
                  rec._meta.qcFlags.push('outside_boundary'); }
  else { rec.districtKey = null; rec._meta.districtResolvedBy = 'outside';
         rec._meta.qcFlags.push('outside_boundary'); }
  if (rec._meta.districtConflict) rec._meta.qcFlags.push('district_conflict');
};
```

Rationale: §14 charts by district, §43 compares districts and §9 highlights district polygons. If aggregation used
the source string while the map drew the polygons, **the chart and the map would visibly disagree**. Point-in-polygon
against the official 2024 boundary is reproducible from the record's own coordinates – hence its `High` evidence
confidence (§3.4). A manual override in the editor sets `districtResolvedBy: 'manual'` and is never overwritten by
a later re-derivation.

### 6.3 The 10 district conflicts (`districtConflict: true`)

| Record | Source claim | Polygon | Note |
|---|---|---|---|
| **Trilliant** | Mirzo-Ulugbek | `yunusobod` | **Highest-impact.** A+, $44.7 – the highest rent in the dataset and the *only* priced record in Mirzo-Ulugbek under the source claim. Reassignment leaves Mirzo-Ulugbek with no priced record at all. |
| NEXUS | Shaykhantakhur | `olmazor` | |
| SIMURG JSC | Yashnabad | `mirzo-ulugbek` | |
| TECHNOPLAZA | Yashnabad | `mirzo-ulugbek` | |
| Biznes sentr | Mirabad | `yashnobod` | |
| Boulevard Business Center | Yakkasaray | `shayxontohur` | |
| GetSpace | Yakkasaray | `chilonzor` | |
| Бизнес центр | Yunusabad | `shayxontohur` | |
| Бизнес центр 2 | Mirzo-Ulugbek | `yunusobod` | |
| Бизнес-центр Renaissance | Mirabad | `yashnobod` | |

All ten are listed in the Data Quality panel as a review queue with both values shown. None is silently corrected –
the polygon wins for computation, the claim is retained and displayed.

---

## 7. Dataset envelope

### 7.1 Shape

```jsonc
{
  "schemaVersion": "1.1.0",
  "generatedAt":   "2026-09-16",
  "generator":     "geo-mvp/tools/build_seed.py",
  "exportedAt":    "2026-09-16T14:02:11Z",        // set by export only; absent in the build artefact
  "exportedBy":    "GEODESK prototype (local)",

  "city":      { "key": "tashkent", "name": "Tashkent", "nameRu": "Ташкент",
                 "centre": [41.3111, 69.2797], "defaultZoom": 12,
                 "bbox": [41.15, 69.10, 41.42, 69.45] },
  "assetType": { "key": "business_centre", "name": "Business centres / office buildings" },

  "refreshDays":        { "fast": 90, "slow": 365, "stable": 1095 },
  "dueSoonDays":        14,
  "criticalFields":     ["officeClass","status","gla","floors","askingRent",
                         "vacancyPct","parkingSpaces","yearOpened"],
  "completenessWeights": { /* §9.5 – 13 entries summing to 100 */ },
  "fieldRefreshClass":   { /* §4.2 – every field, 33 entries */ },
  "evidenceProfiles":    { /* §3.4 – 10 profiles */ },

  "districts": [                                   // METADATA ONLY – geometry by reference, §7.3
    { "key": "yangihayot", "name": "Yangihayot", "nameRu": "Янгихаёт",
      "nameUz": "Янгиҳаёт", "areaHa": 4423.58 }
    /* … 12 entries … */
  ],
  "districtAliases": { "mirabad": "mirobod", "алмазарский район": "olmazor", /* … */ },
  "districtsGeometryRef": {
    "sourceId": "SRC-CITY-BOUNDARY",
    "file":     "data/tashkent_districts.simplified.geojson",
    "globalVar": "GEO.SEED.districtsGeoJson",
    "featureCount": 12,
    "simplifiedToleranceM": 9,
    "sha256": "<hex>"
  },

  "sources": [ /* §3.3 – 5 entries */ ],

  "counts": {
    "total": 156, "verifiedSource": 148, "demo": 8,
    "withAddress": 109, "withClass": 16, "withRent": 16,
    "districtConflicts": 10, "outsideCityBoundary": 0,
    "duplicateGroups": 6, "duplicateRecords": 12,
    "entityReviewSuspect": 7,
    "completenessBands": { "minimal": 39, "partial": 93, "good": 16, "strong": 0 }
  },

  "containsDemoRecords": true,
  "_WARNING": "This file contains 8 DEMO records (recordType=\"DEMO\"). They are fictional and must never be cited as market evidence.",

  "records": [ /* §2 */ ]
}
```

### 7.2 Envelope field table

| Field | Type | Required | Notes |
|---|---|---|---|
| `schemaVersion` | semver string | **yes** | Version of **this document's** schema, not of the app. Governs migration (§7.5). |
| `generatedAt` | DateOnly | **yes** | When the seed was built. QA expresses date-relative assertions against this. |
| `generator` | string | yes | Provenance of the file itself. |
| `exportedAt` / `exportedBy` | Timestamp / string | export only | Written by `GEO.dataset.export`; ignored on import. |
| `city` | object | **yes** | One entry. `bbox` is the hard coordinate gate (§9.1 V-G1). |
| `assetType` | object | **yes** | `business_centre` only (§4). |
| `refreshDays`, `dueSoonDays`, `criticalFields`, `completenessWeights`, `fieldRefreshClass` | policy | **yes** | Policy travels **with** the data so an export re-imported into a future build computes the same staleness and completeness it did when exported. Without this, round-trip is lossy in meaning even when lossless in bytes. |
| `evidenceProfiles` | object | **yes** | Referenced by `_evidence`. An unresolvable reference is import error V-E4 (BLOCK). |
| `districts` | array | **yes** | Metadata for all 12, including the two with zero records. |
| `districtAliases` | object | **yes** | Lower-cased alias → key. |
| `districtsGeometryRef` | object | **yes** | **Reference, not copy.** Geometry (≈34 KB simplified) is inlined once into the HTML as `GEO.SEED.districtsGeoJson` and is *not* duplicated into every export. An importer that lacks the geometry can still render, filter and aggregate by `districtKey`; it loses only polygon drawing and re-derivation, and the UI says so. |
| `sources` | array | **yes** | §3.3. |
| `counts` | object | **yes** | Integrity check, not a cache: `counts.total !== records.length` is import error V-D2 (BLOCK). All other counts are recomputed after load and a mismatch is a WARN listed in the import report. |
| `containsDemoRecords` | boolean | **yes** | `records.some(r => r.recordType === 'DEMO')`. Mismatch = BLOCK. |
| `_WARNING` | string | conditional | **Present iff `containsDemoRecords`.** Readable in a text editor without parsing – critique clause 7. |
| `records` | array | **yes** | May be empty. |

### 7.3 Where the data lives in the shipped file

| Global | Contents | Source file | Inlined by |
|---|---|---|---|
| `GEO.SEED.dataset` | The whole envelope incl. 156 records | `data/seed.json` | `build.py` `<!--@DATA:seed-->` |
| `GEO.SEED.districtsGeoJson` | 12 MultiPolygons | `data/tashkent_districts.simplified.geojson` | `build.py` `<!--@DATA:districts-->` |

`fetch()` is never used: the prototype must open from `file://`, where fetching a sibling JSON is blocked by CORS.

### 7.4 localStorage keys

Prefix `geo.mvp.v1.` – fixed in `GEO.STORAGE_PREFIX`, and it **must not** derive from the product name, so a rename
cannot orphan saved data (`01-product-spec.md` §2). The `v1` is the **storage-layout generation**, not
`schemaVersion`; it changes only if the key *layout* changes.

| Key | Contents | Written on |
|---|---|---|
| `geo.mvp.v1.schemaVersion` | The bare version string of the stored dataset | Every dataset write. **Written separately and first** so a corrupt or oversized dataset payload can still be version-detected and quarantined intelligibly. |
| `geo.mvp.v1.dataset` | Full envelope, `JSON.stringify`, `_derived` stripped | Any `upsert` / `remove` / import / reset |
| `geo.mvp.v1.prefs` | `{locale, role, viewMode, includeDemo, filters, markerEncoding, panelState}` | On change, debounced 400 ms |
| `geo.mvp.v1.ai` | AI session context + session log (§58, §61) | On each AI turn |
| `geo.mvp.v1.quarantine.<Timestamp>` | A payload that failed to load (§7.5) | Only on a failed migration |

**Quota.** The seed serialises to ~238 KB; the practical limit is ~5 MB per origin. Every write is wrapped:

```js
try { localStorage.setItem(k, v); }
catch (e) {                                              // QuotaExceededError, or blocked/private mode
  GEO.ui.banner('error',
    'Local changes could not be saved (browser storage full or blocked). Export your dataset now to avoid losing work.',
    { action: 'Export JSON' });
  GEO.state.persistenceDisabled = true;                  // the app keeps working in memory
}
```

Reads are equally defensive: a `localStorage` read that throws (private mode, blocked site data) is treated as
"no stored data" and the app boots from seed.

### 7.5 `schemaVersion` and the migration rule

Semver. **MAJOR** = a field was removed, renamed, or changed type/meaning. **MINOR** = a field or enum token was
added. **PATCH** = documentation/value corrections only.

```js
GEO.dataset.load = function (raw) {
  var app = GEO.SCHEMA_VERSION;                                     // e.g. "1.1.0"
  var got = (raw && raw.schemaVersion) || null;

  if (!got)                          return quarantine(raw, 'no schemaVersion – not a GEODESK dataset');
  if (major(got) !== major(app))     return quarantine(raw, 'incompatible schema ' + got + ' vs ' + app);
  if (cmp(got, app) > 0)             return quarantine(raw, 'saved by a newer version (' + got + ')');

  var payload = raw;
  for (var step = minor(got); step < minor(app); step++) {           // forward MINOR migrations, in order
    payload = GEO.MIGRATIONS['1.' + step + ' -> 1.' + (step + 1)](payload);
  }
  payload.schemaVersion = app;
  var report = GEO.schema.validateDataset(payload);                  // §9
  if (report.blocking.length) return quarantine(raw, report.blocking[0].message);
  return { dataset: GEO.schema.normaliseDataset(payload), report: report };
};
```

**`quarantine(payload, reason)` – the rule that prevents silent corruption (§21):**

1. Copy the offending payload to `geo.mvp.v1.quarantine.<Timestamp>` – **never delete the user's data.**
2. Delete `geo.mvp.v1.dataset` and `geo.mvp.v1.schemaVersion`.
3. Boot from `GEO.SEED.dataset`.
4. Show a **non-dismissible** banner: *"Saved local data could not be loaded (`<reason>`). It has been set aside and
   the original dataset has been restored."* with **Download quarantined data** and **Discard permanently**.
5. Log it to the session log.

There is no path in which a version mismatch silently coerces, partially loads, or merges. Partial load is the
failure mode that corrupts a dataset invisibly, which §21 exists to prevent.

`MIGRATIONS` is a registry of pure functions; each is a one-way MINOR upgrade, and each is unit-testable against the
previous version's export. The MVP ships `1.0 -> 1.1` (adds `sourceIds`, `rentUnitAssumed`, `serviceChargeUnit`,
`seedBatch`, `entityReview`, `qcFlags`, `origin`, `duplicateVerdict`, `_collection`; splits `sources[]` by provider;
changes `refreshDays.fast` 60→90; rewrites `rentUnit` `"USD/m2/month"`→`"m2/month"`; converts amenity, method and
industry tokens to snake_case; rescales `parkingRatio` ×100).

### 7.6 Import / export round-trip contract (§21)

| Rule | |
|---|---|
| Canonical form | Export emits every schema key, in the order of the tables in §2, with explicit `null`s, `_derived` stripped, 2-space indent, UTF-8, no BOM. |
| Round-trip identity | `normalise(parse(export(D)))` must **deep-equal** `normalise(D)`. Compared as parsed objects, not strings. This is acceptance test UX-10 and it must be an automated check, not a manual one. |
| Import is the same pipeline | `GEO.dataset.import` = `JSON.parse` → `GEO.dataset.load` (§7.5). Import cannot take a path the stored payload cannot. |
| Import report | Always shown before commit: records added / replaced / rejected, unknown enum tokens, count mismatches, demo records found. The user confirms; nothing is written until then. |
| Merge policy | Import **replaces** the whole dataset by default. A "merge by `id`" option exists; on conflict the imported record wins and the previous one is pushed to `_history` only if it differs – no silent field-level merge. |
| Demo safety | An import whose records would move an existing `id` from `DEMO` to `VERIFIED_SOURCE`, or the reverse, is **rejected** (§8.1 clause 6). |
| Reset | "Restore original dataset" re-reads `GEO.SEED.dataset` and clears `geo.mvp.v1.dataset`. It is **not** called "Reset Demo Data" (`02-brief-critique.md` C10) and it prompts, offering an export first. |

---

## 8. Record classification: `VERIFIED_SOURCE` vs `DEMO`

§6: "Never mix fictional records with verified real data without clear labels." The label is necessary but not
sufficient; segregation must be **structural**, so that mixing is impossible to do by accident.

### 8.1 The containment contract (binding, all clauses)

| # | Clause |
|---|---|
| 1 | **Separate arrays in memory.** `GEO.data.verified[]` and `GEO.data.demo[]` are populated at load by partitioning `records[]` on `recordType`. They meet at exactly one function, `GEO.data.getWorkingSet()` – the single auditable seam. No other code may concatenate them. |
| 2 | **Required discriminator, no default.** A record without `recordType` is rejected at load (V-R1, BLOCK). Not defaulted, not inferred from the `id` prefix. |
| 3 | **Off by default.** `prefs.includeDemo === false` on first run and after every reset. |
| 4 | **Only a human toggles it.** The toggle lives in Settings / Data Editor. It is **not** settable by an AI action, a URL parameter, an import file, or a keyboard shortcut. `GEO.ai` has no write access to `prefs.includeDemo` – enforced by the tool registry, which declares no such tool. |
| 5 | **Every metric knows.** Every metric object returned by `GEO.stats.*` carries `containsDemo: boolean` and `demoCount: int`. Every rendered number derived from a demo-inclusive set carries a `DEMO` chip. §46 "Data coverage" names the demo count separately: *"12 of 18 matching properties have rent data; 4 of 18 are DEMO records."* |
| 6 | **No promotion path, ever.** `recordType` is immutable. The editor does not expose it. Import rejects any record whose `id` exists with a different `recordType`. There is no JSON shape, UI control or AI action that converts one into the other. |
| 7 | **Exports self-identify.** `containsDemoRecords: true`, a top-level `_WARNING` string, and the filename suffix `-INCLUDES-DEMO`. Visible in a text editor without parsing. |
| 8 | **Unmistakable content.** Names begin `DEMO – `. `address` reads "Synthetic location – not a real address". `_meta.sourceIds: ["SRC-DEMO"]`, `sourceUrl: null`, `coordinateAccuracy: "synthetic"`. Coordinates are plausible (they must sit inside real districts for radius testing) but names can never be confused with a real building. |
| 9 | **Fully populated, deliberately.** Demo records fill every schema field. That is their entire purpose: they are the fixture set that exercises the GLA filter, the vacancy chart, tenant lists, parking, amenities and the pipeline split – 100 % of which are unreachable with real data. |
| 10 | **Fixed fixture matrix, not a fixed count.** The shipped set is 8 records and the *matrix* is what is load-bearing (§8.4). `02-brief-critique.md` clause 10 proposes 6; 8 is required to cover confirmed-zero-vacancy and confirmed-empty-tenants, both of which are §36 requirements. Recorded as decision **O-6**. |

### 8.2 Why user-added records are `VERIFIED_SOURCE`, and why that is safe

A record a tester adds in the editor is not fictional in *intent* – it describes a building the tester believes
exists – so classifying it `DEMO` would be wrong, and adding a third `recordType` would fork every analytics guard.
It is instead separated on a different axis:

`_meta.origin: "user"` + `_meta.qcStatus: "draft"` + `recordConfidence` derived from the evidence the user supplied
(§3.9 requires `method` and `confidence` on every value). The UI shows the amber badge **"Added locally – not
verified"**; the Data Quality panel counts them separately; every export carries the flag. They **are** included in
analytics, because §35 scenario 9 ("Add a new business center using coordinates") and scenario 8 ("edit and
immediately see the analytics update") require exactly that.

### 8.3 Analytics and visual segregation

| Surface | `includeDemo = false` (default) | `includeDemo = true` |
|---|---|---|
| Map markers | Demo hidden entirely | Hatched marker fill + separate legend entry "DEMO (fictional)" |
| Property count, all metrics, all charts | Verified only; denominators over 148 | Denominators over 156, every number carries a `DEMO` chip, `containsDemo: true` |
| Filters / search / list | Verified only | Demo included, each list card carries a `DEMO` chip |
| Compare | Demo not selectable | Selectable; the comparison header warns if any column is demo |
| Location analysis / competitive set | Demo excluded from counts and averages | Included, and the panel states "n of m are DEMO records" |
| AI answers | Demo invisible to every tool | Every §46 Data-coverage block names the demo count |
| Global chrome | – | Non-dismissible amber banner **"DEMO DATA ACTIVE – figures are not market evidence"** |
| Export | No demo records, no `_WARNING` | Demo records, `_WARNING`, `-INCLUDES-DEMO` filename suffix |

### 8.4 The fixture matrix (what each demo record must prove)

| id | Purpose – the code path no real record can reach |
|---|---|
| `DEMO-001` | Every field populated: exercises every metric, chart row and comparison row. |
| `DEMO-002` | `tenantsStatus: partial` vs `complete` – proves partial lists are excluded from tenant sums. |
| `DEMO-003` | Known rent, **unknown** occupancy – proves unknown occupancy is not read as 0 %. |
| `DEMO-004` | **Stale** (`lastVerifiedAt` 2025-11-02) with **unknown** rent – drives the stale indicator and proves missing rent is not free rent. |
| `DEMO-005` | `Under construction` – exercises the operating-vs-pipeline split (§14) which 0/148 real records can. |
| `DEMO-006` | Almost empty, `officeClass: null`, `Unknown` confidence – drives the missing-critical indicator and the `minimal` completeness band. |
| `DEMO-007` | **Confirmed `vacancyPct: 0`** and `availableArea: 0` – proves 0 renders as a real value, never as "Not recorded". |
| `DEMO-008` | **`tenantsStatus: confirmed_empty`** with `occupancyPct: 0` – proves "no tenants entered" differs from "confirmed empty" (§36). |

---

## 9. Validation rules

### 9.1 Rule table

**BLOCK** = the editor refuses to save and the importer rejects the record. **WARN** = saved, a `qcFlag` is set, the
record appears in the Data Quality panel, and the editor shows an inline caution the user must acknowledge once.

| ID | Rule | Severity | Message shown |
|---|---|---|---|
| V-R1 | `recordType` ∈ {`VERIFIED_SOURCE`,`DEMO`} | **BLOCK** | "Record type is required and cannot be inferred." |
| V-R2 | `id` present, matches the pattern, unique in the dataset | **BLOCK** | "Duplicate or malformed record id." |
| V-R3 | `name` non-empty after trim | **BLOCK** | "Property name is required." |
| V-G1 | `lat` ∈ [41.15, 41.42] **and** `lng` ∈ [69.10, 69.45] (`city.bbox`) | **BLOCK** | "Coordinates are outside Tashkent. This prototype covers Tashkent only (§3)." |
| V-G2 | Point falls inside one of the 12 district MultiPolygons | **WARN** `outside_boundary` | "Point is inside the Tashkent bounding box but outside the 2024 city boundary. District cannot be derived." |
| V-G3 | `lat`/`lng` are finite numbers with ≥ 4 decimal places | **WARN** | "Coordinate precision below ~10 m; location may be approximate." |
| V-C1 | `askingRent` ≥ 0 | **BLOCK** | "Rent cannot be negative." |
| V-C2 | `askingRent` ≤ 150 (in `USD` + `m2/month`) | **BLOCK** | "Rent above 150 USD/m²/month is implausible for Tashkent – check whether this is an annual figure or a different unit." |
| V-C3 | `askingRent` ∈ [5, 60] when currency `USD`, unit `m2/month` | **WARN** `rent_outlier` | "Outside the observed Tashkent range (19.9–44.7 in this dataset). Confirm the figure and its unit." |
| V-C4 | `askingRent === 0` | **WARN** | "0 is stored as a **confirmed free rent**, not as unknown. Use *Clear field* if the rent is simply not known." |
| V-C5 | `currency` and `rentUnit` non-null whenever `askingRent` non-null (same for `serviceCharge` / `serviceChargeUnit`) | **BLOCK** | "A rent must state its currency and unit." |
| V-P1 | `gla` ≤ `gba` when both known | **BLOCK** `geometry_inconsistent` | "GLA cannot exceed GBA." |
| V-P2 | `gla / gba` ∈ [0.50, 0.95] when both known | **WARN** | "Efficiency ratio of X % is outside the normal 50–95 % range." |
| V-P3 | `availableArea` ≤ `gla` when both known | **BLOCK** | "Available area cannot exceed GLA." |
| V-P4 | `minUnit` ≤ `availableArea` when both known | **WARN** | "Minimum unit is larger than the stated available area." |
| V-P5 | `typicalFloorPlate × floors` within ±30 % of `gba` when all three known | **WARN** | "Floor plate × floors does not reconcile with GBA." |
| V-P6 | `yearOpened` ∈ [1900, currentYear+10]; `yearRenovated ≥ yearOpened` | **BLOCK** | "Implausible year." |
| V-P7 | `parkingRatio` within ±20 % of `parkingSpaces / gla × 100` when all known | **WARN** | "Stated parking ratio does not match spaces ÷ GLA." |
| V-O1 | \|`occupancyPct` + `vacancyPct` − 100\| ≤ 0.5 when **both** known | **BLOCK** | "Occupancy and vacancy must sum to 100 %." |
| V-O2 | Each ∈ [0, 100] | **BLOCK** | "Percentage out of range." |
| V-O3 | One entered, other empty | **INFO** | Offers to auto-fill `100 − x`; the user must accept. Never silent. |
| V-O4 | `occupancyPct === 100` with `availableArea > 0` | **WARN** | "Fully occupied but available area is greater than zero." |
| V-S1 | `status` and `officeClass` are enum tokens or `null`; **never** the string `"Unknown"` | **BLOCK** | "Use *Clear field* for unknown; 'Unknown' is not a stored value." |
| V-E1 | Every field with a value has an `_evidence` entry | **WARN** `no_source_for_value` | "This value has no recorded source." |
| V-E2 | `sources[].recordCount` equals the actual attribution count | **WARN** (dataset-level) | "Source record counts do not match the data." |
| V-E3 | The editor requires `method` and `confidence` for any value it writes | **BLOCK** | "Every value needs a collection method and a confidence level." |
| V-E4 | Every `_evidence` string reference resolves in `evidenceProfiles` | **BLOCK** | "Unknown evidence profile '<key>'." |
| V-D1 | No other record within **30 m** (§9.4) | **WARN** `coord_collision` | "Another property is recorded 12 m away: <name>. Review as a possible duplicate." |
| V-D2 | `counts.total === records.length` | **BLOCK** (import) | "File is inconsistent: declared count does not match the records." |
| V-T1 | `tenants[].name` non-empty; `sum(tenants[].area) ≤ gla` when both known | **WARN** | "Tenant areas exceed GLA." |
| V-T2 | `tenantsStatus: confirmed_empty` with `tenants.length > 0` | **BLOCK** | "A confirmed-empty building cannot list tenants." |
| V-N1 | Unrecognised enum token on import | **WARN** | Coerced to `null`; original preserved as `non_enum:<field>:<raw>`; listed in the import report. |

### 9.2 Editor behaviour

- BLOCK violations disable **Save** and render inline under the offending field. The user's other edits are not
  discarded.
- WARN violations render an amber inline caution with a **"Save anyway"** affirmation. On save the `qcFlag` is
  written and the record joins the Data Quality review queue. Warnings are never suppressed silently.
- INFO offers an action; it never acts on its own.
- Validation runs on blur and again on save. Dataset-level rules (V-E2, V-D2) run on load and on import only.
- **Clearing a field** writes `null` and **removes** the `_evidence` entry (§3.9 step 3). There is no UI path that
  produces `""`.

### 9.3 Coordinate bounds – why two levels

| Level | Bounds | Behaviour |
|---|---|---|
| Hard gate (V-G1) | lat 41.15–41.42, lng 69.10–69.45 | BLOCK. Generous around the observed data (41.2207–41.3704, 69.1791–69.3623) and around the 12 polygons, so a genuine outlying Tashkent building is not rejected, while a transposed lat/lng or a Samarkand coordinate is caught immediately. |
| Soft gate (V-G2) | Inside one of the 12 MultiPolygons | WARN. The city boundary is the authority for *district assignment*, but a point just outside it is a plausible data-entry situation, not a lie. 0 of 148 seed records trip it. |

### 9.4 Duplicate detection

Never auto-merge (`02-brief-critique.md` D9). The 6 flagged pairs are exact coordinate collisions between
**differently named** entities – almost certainly two directory POIs at one address, i.e. either two centres in one
complex or a building plus a tenant firm. Merging destroys data; ignoring them double-counts buildings in every
district and radius statistic.

```js
GEO.quality.findDuplicates = function (records) {
  // O(n²) is fine at n = 156; a grid index is the READY optimisation for n > 2000.
  var out = [];
  for (var i = 0; i < records.length; i++)
    for (var j = i + 1; j < records.length; j++) {
      var d    = GEO.geo.haversineM(records[i], records[j]);
      var same = GEO.util.foldName(records[i].name) === GEO.util.foldName(records[j].name);   // R6 folding
      if (d <= 30)   out.push({ a: records[i].id, b: records[j].id, distanceM: Math.round(d),
                                reason: 'coord_collision', flag: 'coord_collision' });
      if (same)      out.push({ a: records[i].id, b: records[j].id, distanceM: Math.round(d),
                                reason: 'same_name', flag: 'duplicate_name' });   // ANY distance – see below
    }
  return out;
};
```

Name collisions are reported **at any distance**, because distance alone cannot tell a duplicated record from a
second branch. Measured in the seed (verified by Haversine over all 148 records, 9 pairs at ≤ 30 m):

| Finding | Distance | Records | Verdict default |
|---|---|---|---|
| 6 exact-coordinate pairs, source-flagged (`DUP-COORD-0022`…`0027`) – Econor/MAXAM, Falcom/REGENT, Status/G BUILD, Vega business center/SK MEDIA, Korea Uzbekistan Business Association/AMIR, UzOman tower/DIM TOWER | 0 m | 12 | `undecided` |
| 3 further sub-30 m pairs **not** flagged by the source: `Infinity, компания консалтинга…` ↔ `Ventum plaza` (19.3 m), `Afrosiab` ↔ `Econor` (27.2 m), `Afrosiab` ↔ `MAXAM` (27.2 m) – adding 3 records (`Afrosiab`, `Infinity…`, `Ventum plaza`) not already in the 12 | 19–27 m | 3 new | `undecided` |
| Exact duplicate name `Infinity, компания консалтинга в сфере недвижимости` ×2 (`BC-f4a7b568f29a` Yakkasaray, `BC-7d5998228cc1` Yashnabad) | **3 864 m** | 2 | `undecided` – almost certainly two branches of one consultancy, i.e. two records that are both `suspected_non_bc` rather than one duplicated building. The distance is shown so a reviewer can decide in one glance. |

`undecided` records are **counted normally** in every statistic and **visibly flagged** on the map and in the record.
The Duplicate review queue offers the three verdicts; `same_building` excludes the lower-completeness record from
analytics (it is not deleted) and states the effect on the count.

### 9.5 Completeness score – weights, bands, and the seed distribution

```js
GEO.quality.completeness = function (rec, env) {
  var score = 0;
  Object.keys(env.completenessWeights).forEach(function (f) {
    if (GEO.util.hasValue(rec[f])) score += env.completenessWeights[f];
  });
  return score;                                            // integer 0–100
};
```

| Field | Weight | Rationale |
|---|---:|---|
| `name` | 5 | Identity. |
| `lat` + `lng` (counted once, both required) | 5 | Without them the record cannot be mapped at all. |
| `districtKey` | 5 | Always derivable from coordinates. |
| `address` | 10 | The first thing a professional needs and the first thing missing (39 records). |
| `officeClass` | 15 | The primary market segmentation. |
| `askingRent` | 15 | The primary commercial fact. |
| `gla` | 10 | The primary size fact. |
| `status` | 5 | Operating vs pipeline. |
| `gba` | 5 | |
| `floors` | 5 | |
| `vacancyPct` | 5 | |
| `parkingSpaces` | 5 | |
| `yearOpened` | 5 | |
| `tenants` (non-empty **or** `tenantsStatus: confirmed_empty`) | 3 | |
| `amenities` (non-empty **or** `amenitiesStatus: confirmed_empty`) | 2 | |
| **Total** | **100** | |

| Band | Score | Seed |
|---|---|---:|
| `minimal` | 0–19 | **39** (the supplementary batch: no address) |
| `partial` | 20–49 | **93** (address, nothing commercial) |
| `good` | 50–79 | **16** (address + class + rent) |
| `strong` | 80–100 | **0** |

`39 × 15 + 93 × 25 + 16 × 55` – exactly the distribution `01-product-spec.md` §0 states. **Nothing in the real
dataset scores 80 or above, and the platform should say so on the Data Quality screen.**

`criticalFields` (8) is a different, narrower list – the fields whose absence triggers the §19 "missing critical
data" indicator: `officeClass` `status` `gla` `floors` `askingRent` `vacancyPct` `parkingSpaces` `yearOpened`.
Seed: every one of the 148 records is missing at least 6 of the 8.

### 9.6 `entityReview` pre-flags (D10)

Pre-set `_meta.entityReview: "suspected_non_bc"` + `qcFlags: ["type_uncertain"]` on these 7 seed records. They are
**not deleted and not hidden** – deletion would be an undisclosed editorial judgement (`01-product-spec.md` R10):

`Infinity, компания консалтинга в сфере недвижимости` (×2, a consultancy), `Korea Uzbekistan Business Association`,
`INTERNATIONAL BANK FINANCIAL CENTRE`, `Chilonzor` (a district name), `Авто`, `Семург`.
(`Бизнес центр`, `Бизнес центр 2`, `Biznes sentr` and `Carvon, офис` are generic or ambiguous names, not evidently
non-office entities – they stay `unreviewed` and surface in the review queue instead. `01-product-spec.md` R10 lists
`Carvon, офис` among the non-office records and omits `Korea Uzbekistan Business Association` and
`INTERNATIONAL BANK FINANCIAL CENTRE`; this document narrows "suspected" to entities whose names identify them as a
*firm or association* rather than a building, and widens it to the two that clearly are. Both lists are reviewable
in the UI, and the difference is 7 records either way.)

The analytics toggle **"Exclude suspected non-office records"** is default **off** and states its effect
(`148 → 141`) before it is applied. Turning it on is disclosed in every affected denominator.

---

## 10. The adapter seam (§20)

### 10.1 The rule

> **No module other than `src/12-repo.js` may touch `localStorage`, `GEO.SEED`, or the records array directly.**

Everything else – map, filters, analytics, compare, editor, AI tools – goes through `GEO.repo`. That single file is
what a PostGIS / Supabase / REST backend replaces. This is checkable: `grep -n "localStorage\|GEO.SEED" src/*.js`
must match only `12-repo.js` and `00-config.js`.

### 10.2 The interface – async-shaped from day one

Every method returns a Promise even though the MVP implementation is synchronous (`Promise.resolve(...)`). Callers
are written with `await` from the start, so swapping in a network backend changes no call site.

```js
/**
 * GEO.repo – the data access boundary. One implementation in the MVP: LocalStorageRepo.
 * Future implementations (SupabaseRepo, PostgisRepo, RestRepo) satisfy the same contract.
 */
GEO.repo = {
  /** @param {QuerySpec} [spec] @returns {Promise<{records: BusinessCentre[], total:number,
   *           matched:number, coverage:Object<string,{n:number,m:number}>, containsDemo:boolean}>} */
  async list(spec) {},

  /** @param {string} id @returns {Promise<BusinessCentre|null>} */
  async get(id) {},

  /** @param {BusinessCentre} record @param {{validate?:boolean, actor?:string}} [opts]
   *  @returns {Promise<{record: BusinessCentre, created: boolean,
   *                     report: {blocking: Issue[], warnings: Issue[]}}>}
   *  Rejects with ValidationError when report.blocking is non-empty. Sets _meta.updatedAt,
   *  editedLocally, recordConfidence; appends _history; persists. */
  async upsert(record, opts) {},

  /** @param {string} id @param {{reason?:string}} [opts] @returns {Promise<{removed:boolean}>}
   *  Hard delete. The MVP forbids deleting a seed record whose _meta.origin === 'seed' unless
   *  opts.reason is supplied, and always logs the removal to the session log. */
  async remove(id, opts) {},

  /** @param {AggregateSpec} spec @returns {Promise<{rows: Row[], meta: {n:number, m:number,
   *           denominatorField:string, insufficient:boolean, containsDemo:boolean}}>}
   *  The aggregation seam. In the MVP it runs in JS; in PostGIS it compiles to GROUP BY.
   *  meta.n / meta.m are the §14/§36 denominator pair and are NEVER optional. */
  async query(spec) {},

  /** @param {Array<{op:'upsert'|'remove', record?:BusinessCentre, id?:string}>} ops
   *  @returns {Promise<Array<Result>>}  All-or-nothing; used by import. */
  async bulk(ops) {},

  /** @returns {Promise<DatasetEnvelope>}  The envelope WITHOUT records – policy, sources,
   *  districts, counts. Cheap; safe to call on every render. */
  async meta() {},

  /** @param {function(GEO.repo): Promise<T>} fn @returns {Promise<T>}
   *  ARCHITECTURE-READY. The MVP runs fn inline and persists once at the end; a real backend
   *  wraps it in BEGIN/COMMIT. Exists so import and bulk edits are already written transactionally. */
  async transaction(fn) {}
};
```

### 10.3 `QuerySpec` – structured, never SQL, never a predicate function

A query must be **data**, not a closure, or it cannot cross a network boundary and the AI tool layer cannot
serialise it into the §61 audit log.

```jsonc
{
  "assetType":  "business_centre",
  "city":       "tashkent",
  "recordTypes": ["VERIFIED_SOURCE"],              // demo excluded unless prefs.includeDemo
  "where": [
    { "field": "officeClass",  "op": "in",       "value": ["A", "A+"] },
    { "field": "askingRent",   "op": "between",  "value": [20, 40] },
    { "field": "districtKey",  "op": "in",       "value": ["mirobod", "yunusobod"] },
    { "field": "askingRent",   "op": "has_value" },                       // §36: presence, not > 0
    { "field": "_derived.verificationState", "op": "eq", "value": "stale" }
  ],
  "within":  { "lat": 41.2995, "lng": 69.2401, "radiusM": 3000, "excludeId": "BC-f1fa83bd7153" },
  "search":  "infinity",                            // folded per R6 against _derived.searchKey
  "orderBy": [{ "field": "askingRent", "dir": "desc", "nullsLast": true }],
  "limit":   null,
  "offset":  0
}
```

**Operators:** `eq` `neq` `in` `not_in` `gt` `gte` `lt` `lte` `between` `has_value` `is_null` `contains` `starts_with`.

Two non-negotiable semantics:

1. **`null` never satisfies a comparison operator.** `askingRent < 30` excludes records with `askingRent: null`; it
   does not treat them as 0. The result header must state how many records were excluded for lack of data
   (`01-product-spec.md` R4).
2. **`has_value` is the only way to ask "is it known".** Never `!= null` written by hand, never `> 0`.

### 10.4 `AggregateSpec`

```jsonc
{
  "from":     { /* a QuerySpec */ },
  "groupBy":  "districtKey",                        // or "officeClass" | "status" | null
  "metrics": [
    { "name": "count",      "op": "count" },
    { "name": "knownRentN", "op": "count_known", "field": "askingRent" },
    { "name": "meanRent",   "op": "mean",        "field": "askingRent", "minN": 3 },
    { "name": "medianRent", "op": "median",      "field": "askingRent", "minN": 3 },
    { "name": "totalGla",   "op": "sum",         "field": "gla",        "minN": 1 }
  ]
}
```

`minN` is mandatory on every mean/median/sum. Below it, the metric returns
`{ value: null, insufficient: true, n, m }` and the UI renders **"Insufficient verified data"** with the denominator
still shown (rule R3, §14, §36). This is enforced in the repository layer, not in the UI, so an AI tool cannot route
around it. Full formulas belong to doc `05-analytics.md`; the *shape* is fixed here.

### 10.5 What a production backend replaces

| MVP | Production |
|---|---|
| `LocalStorageRepo` over an in-memory array | `PostgisRepo` / `SupabaseRepo` over `bc_record` |
| `where[]` evaluated in JS | Compiled to a parameterised `WHERE` |
| `within{}` via Haversine over all records | `ST_DWithin(geom::geography, ST_MakePoint(lng,lat)::geography, radiusM)` with a GiST index |
| `_evidence` profile expansion in JS | `bc_evidence` table, one row per (record, field), profiles as a `bc_evidence_profile` table |
| `_history` object | `bc_field_history` table, one row per observation, `(record_id, field, observed_at)` PK |
| `_derived` recomputed at load | Generated columns or a materialised view |
| Whole-dataset localStorage write | Per-row `UPDATE` inside a transaction |
| No auth | Row-level security on `recordType`, `internalNote`, `owner` per §60 |

Indicative DDL for the core table, so the JSON types are chosen with a target in mind:

```sql
CREATE TABLE bc_record (
  id              text PRIMARY KEY,
  record_type     text NOT NULL CHECK (record_type IN ('VERIFIED_SOURCE','DEMO')),
  city_key        text NOT NULL DEFAULT 'tashkent',
  asset_type      text NOT NULL DEFAULT 'business_centre',
  name            text NOT NULL,
  alt_names       text[] NOT NULL DEFAULT '{}',
  status          text,                          -- NULL = not recorded, never 'Unknown'
  address         text,
  district_key    text REFERENCES district(key),
  geom            geography(Point,4326) NOT NULL,
  office_class    text CHECK (office_class IN ('A+','A','B+','B','C')),
  gba             numeric(12,2) CHECK (gba > 0),
  gla             numeric(12,2) CHECK (gla > 0),
  CONSTRAINT gla_le_gba CHECK (gla IS NULL OR gba IS NULL OR gla <= gba),
  asking_rent     numeric(10,2) CHECK (asking_rent >= 0),
  currency        text CHECK (currency IN ('USD','UZS','EUR')),
  rent_unit       text CHECK (rent_unit IN ('m2/month','m2/year','unit/month')),
  rent_unit_assumed boolean NOT NULL DEFAULT false,
  occupancy_pct   numeric(5,2) CHECK (occupancy_pct BETWEEN 0 AND 100),
  vacancy_pct     numeric(5,2) CHECK (vacancy_pct BETWEEN 0 AND 100),
  CONSTRAINT occ_vac_sum CHECK (occupancy_pct IS NULL OR vacancy_pct IS NULL
                                OR abs(occupancy_pct + vacancy_pct - 100) <= 0.5),
  amenities       text[] NOT NULL DEFAULT '{}',
  amenities_status text NOT NULL DEFAULT 'not_collected',
  meta            jsonb NOT NULL,                -- _meta, until it earns its own columns
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bc_record_geom_gix ON bc_record USING gist (geom);
```

Every `CHECK` above is one of the §9.1 rules. The JSON validator and the future database enforce the same
invariants, which is the point of writing them down once.

---

## 11. Required changes and open questions

### 11.1 Required changes to the already-generated artefacts

`geo-mvp/data/seed.json` and `geo-mvp/tools/build_seed.py` exist and are close to this schema. These changes are
required for conformance; **R1 is a correctness defect, the rest are conformance.**

| # | Change | Severity |
|---|---|---|
| **R1** | **Split `sources[]` by real provider** – 2GIS 103, GoldenPages 26, Google Maps 19 (§0.5 fact 1). Add `GP-BASE` and `GM-BASE` evidence profiles; set `_meta.sourceIds` per record. The current artefact attributes all 148 records to 2GIS and contains zero mentions of the other two providers – a provenance falsification under §2.3 / §37. | **HIGH** |
| R2 | `refreshDays.fast` 60 → **90** (§4.2 rationale: at 60 the seed goes stale on 2026-09-17 and every QA number changes overnight). | HIGH |
| R3 | Normalise the 39 free-text `coordinateAccuracy` values to `single`; add `_meta.seedBatch` (`primary` 109 / `supplementary` 39). | HIGH |
| R4 | `_verification: needs_review` (12) → `verificationMode: "desk"` + `qcStatus: "needs_check"` + `qcFlags: ["coord_collision"]`. `needs_review` is not a verification mode. | HIGH |
| R5 | Add `rentUnitAssumed: true` on the 16 priced records; change `rentUnit` `"USD/m2/month"` → `"m2/month"` (currency already lives in `currency`); add `serviceChargeUnit`. | HIGH |
| R6 | Add `_meta.sourceIds`, `entityReview`, `qcFlags`, `qcStatus`, `origin`, `duplicateVerdict`, `seedBatch`, `internalNote`, `nextRefreshAt`; add `_collection: null`. | MED |
| R7 | Snake_case tokens: amenities (`conference room`→`conference_room`, `underground parking`→`underground_parking`, `EV charging`→`ev_charging`, `backup generator`→`backup_generator`), methods (`map service`→`map_service`, `public registry`→`public_registry`), tenant industries (`Financial services`→`financial_services`, `Energy`→`energy_utilities`, …). | MED |
| R8 | `parkingRatio` rescale to spaces per 100 m² GLA (`DEMO-001` 0.017 → 1.71). | MED |
| R9 | `createdAt` / `updatedAt` → ISO-8601 Timestamps. | LOW |
| R10 | `_meta.recordConfidence` recomputed by the §3.8 roll-up: **Medium** ×132, **Low** ×16 – replacing the constant `Medium` that gives the §11 confidence filter and the §42 confidence layer no variance at all. | MED |
| R11 | Envelope: add `districtAliases`, `districtsGeometryRef`, `completenessWeights`, `dueSoonDays`, `containsDemoRecords`, `_WARNING`, `generator`; extend `counts` with `withAddress` / `withClass` / `withRent` / `entityReviewSuspect` / `completenessBands`. | MED |
| R12 | Pre-flag the 7 `suspected_non_bc` records (§9.6) and the 3 unflagged sub-30 m duplicate pairs (§9.4). | MED |
| R13 | Bump `schemaVersion` to `1.1.0` and add the `1.0 -> 1.1` migration (§7.5). | LOW |

### 11.2 Open questions – need a human decision

| # | Question | Owner | Blocking? |
|---|---|---|---|
| **O-1** | **Licence.** All 148 records are third-party directory data (2GIS / GoldenPages / Google Maps). `licenceReview: "required"` on all three sources. Can this data be displayed to clients, exported, or redistributed in a commercial product? Google Maps' terms in particular restrict derivative datasets. This is a commercial risk that the schema can flag but not resolve. | CASE / Humyunmirzo Mirkamolov | Not for the prototype; **blocking for any client-facing use**. |
| **O-2** | `data_confidence = "B"` – what does the collection process's A/B/C scale actually mean? Until it is defined, `sourceConfidenceLetter` is displayed with its scheme named and drives nothing (D7). | Data owner | No |
| **O-3** | The currency and unit of the 16 rent values are **not stated by the source**. USD/m²/month is an assumption. Confirm, or the 16 headline rents are uninterpretable. | Data owner | No – but every rent display carries a footnote until answered. |
| **O-4** | The 10 district conflicts (§6.3): does the data owner accept geometry as authoritative? `Trilliant` alone moves the highest rent in the dataset (A+, $44.7) from Mirzo-Ulugbek to Yunusobod and leaves Mirzo-Ulugbek with no priced record. | Data owner | No – flagged and reversible either way. |
| **O-5** | This document supersedes `01-product-spec.md` A5 on two points: `_history` is a **field-keyed object**, not a flat array; and the editor **does** append to it on overwrite. Confirm. | Design lead | No |
| **O-6** | Demo fixture count: `02-brief-critique.md` clause 10 says 6, the built seed has 8, and 8 is needed to cover confirmed-zero-vacancy and confirmed-empty-tenants. Recommend adopting **8** and amending the critique. | Design lead | No |
| **O-7** | Does CASE want a pre-publication cleaning pass that **removes** the 7 suspected non-office records, and on whose authority? The schema's answer is "flag, never delete" – that is reversible, but it means the headline count stays 148 with a disclosed caveat. | CASE | No |
| **O-8** | `owner`, `developer` and `internalNote` are hidden in the External role. Confirm that `owner` is genuinely restricted – in some markets it is public registry data, in which case it should be visible to all roles. | CASE | No |
