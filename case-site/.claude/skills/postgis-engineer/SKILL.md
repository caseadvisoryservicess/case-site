---
name: postgis-engineer
description: The production data layer this prototype is designed toward – PostGIS schema that preserves the flat record, the provenance-by-reference model, history tables, and the queries that replace the in-browser geometry. Architecture-only in the MVP (§4 forbids a backend); load when designing the production system, when a schema change must stay history-ready, or when a JS geometry helper needs its SQL equivalent named.
---

# PostGIS engineer

## Purpose

The MVP has no backend by design. But every schema decision in `data/seed.json` and every
geometry helper in `09-geo.js` was made so the production system can absorb them without a
rewrite. This skill names the target shape so nothing built now paints the future into a corner.

## Responsibilities

- Hold the target schema: `property` (the flat record as columns), `evidence_profile`,
  `property_field_evidence(property_id, field, profile_id)` – provenance by reference exactly as
  `_evidence` does today – `district` (geometry, EPSG:4326 stored, 3857 for display),
  `duplicate_group` / `duplicate_verdict`, `source`, `import_proposal`, `session_log`.
- Hold the history design (§3.4): `property_field_history(property_id, field, value,
  valid_from, valid_to, profile_id, changed_by)` – append-only; the current value is the row
  with `valid_to IS NULL`. Rent, vacancy, occupancy, availability, tenants, status, ownership,
  class, service charge are the fields the brief names.
- Map each JS helper to its SQL: `districtAt` → `ST_Contains(district.geom, ST_SetSRID(
  ST_Point(lng, lat), 4326))`; `haversine_m` → `ST_DistanceSphere`; radius bands →
  `ST_DWithin(geography, m)`; duplicate candidates → `ST_DWithin(..., 30)` self-join plus name
  similarity; bounds → `ST_Extent`.
- Keep `GEO.data.workingSet()` as the seam the repository replaces: same shape out, PostgREST
  or a thin API in.

## Constraints

1. **Unknown stays `NULL`.** No `NOT NULL DEFAULT 0` on any measured column. `0` is a value;
   `NULL` is absence; the check constraints must not conflate them.
2. **Provenance is a foreign key, not a JSON blob**, so a profile can be corrected once and
   every field that cites it follows.
3. **`district_key` is computed by geometry on write** (trigger or generated column) and the
   source label is kept in `source_district_label`. Disagreement is a queryable fact.
4. **Duplicates never merge in the database.** A `same_building` verdict creates a
   `merged_into` reference; both rows survive; supply views collapse on the verdict.
5. **`next_refresh_at` is a view expression** (`last_verified_at + refresh_interval`), never a
   stored column, so a change to the refresh class re-derives everywhere.
6. **Demo records are a `record_type` column and a row-level policy**, excluded from every
   market view unless the session opts in.
7. **Imports land in `import_proposal` first.** Applying is an explicit action by a named user,
   recorded with reviewer and timestamp; `display`-licensed sources are rejected at the
   constraint, not by convention.
8. **Coordinates are stored once in 4326**; display projections are derived. No 3395 anywhere.
9. **Do not build any of this in the MVP.** It is documented so the JS repository seam, the
   flat record and the evidence model are not undone by a convenient shortcut now.

## Validation checklist (for the design, not the prototype)

- [ ] Every `data/seed.json` field has a column, a type, and a nullability that preserves
      unknown.
- [ ] `oracle.py`'s figures can be reproduced by SQL views on the target schema (rent mean
      32.21875 over `askingRent IS NOT NULL`).
- [ ] The 10 district conflicts are reproducible as `district_key <> canon(source_district_label)`.
- [ ] Row-level security sketches exist for `client` vs `internal` matching §58.

## Examples

**Right.** `SELECT AVG(asking_rent) FILTER (WHERE asking_rent IS NOT NULL), COUNT(asking_rent),
COUNT(*) FROM property WHERE record_type = 'VERIFIED_SOURCE';` – value, n, N in one row.

**Wrong.** `COALESCE(asking_rent, 0)` anywhere in an aggregate.

**Wrong.** `UPDATE property SET district_key = source_district_label`.

## Prohibited behaviour

- Any backend, migration, or connection string in the MVP repository.
- Denormalising provenance into the property row.
- Deleting or overwriting on merge; storing derived refresh dates; defaulting measurements to 0.
