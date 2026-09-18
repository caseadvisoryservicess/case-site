# CASE platform integration contract v1

**Give this file to both chats** — the leasing chat and the geoanalytics chat. It is the
only agreement between them. Neither app needs to know how the other is built.

Two apps, one hosting, one shared database layer:

```
                 ┌──────────────────────────┐
                 │   shared: brands,        │
                 │   clients, projects      │   ← master data, owned by neither app
                 └────────┬────────┬────────┘
                          │        │
            ┌─────────────┘        └─────────────┐
            ▼                                     ▼
   ┌──────────────────┐                  ┌──────────────────┐
   │  CASE.leasing    │ ◄──messages──►   │  CASE.geo        │
   │  units, deals,   │                  │  catchment,      │
   │  plans, history  │                  │  footfall, maps  │
   └──────────────────┘                  └──────────────────┘
```

---

## 1. Ownership — who may write what

| Entity | Owner | Everyone else |
|---|---|---|
| Brand / retailer | **shared** | reads; stores `brandId` + display name |
| Client / company | **shared** | reads; stores `clientId` + name |
| Project / asset | **shared** | reads; `projectId` is stable and never renumbered |
| Unit, deal, status, history, floor plan | **leasing** | reads through the published API |
| Catchment, footfall, competition, isochrones, map layers | **geo** | reads through the published API |

Writing into another app's entities is the one thing that breaks integration. Don't.

---

## 2. Namespacing — non-negotiable, both apps

```js
window.CASE = window.CASE || {};
CASE.leasing = { version, store, api, … };
CASE.geo     = { version, store, api, … };
```

| | leasing | geo |
|---|---|---|
| Global | `CASE.leasing` | `CASE.geo` |
| localStorage | `case_ls_*` | `case_geo_*` |
| CSS custom props | `--case-*` shared tokens; app-specific prefixed `--ls-*` | `--geo-*` |
| CSS classes | `.ls-*` or one scoping root class | `.geo-*` |

Both apps share one origin. An unprefixed key like `projects` or `lang` will destroy real
data the first time both are loaded.

---

## 3. Stable IDs

```
projectId   string, stable forever        e.g. "creative-avenue"
unitId      string, unique within project e.g. "B1_001"
brandId     string, assigned by shared    null until the shared DB exists
clientId    string, assigned by shared    null until the shared DB exists
```

Until the shared database exists, both apps store the slot and leave it `null`:

```js
prospects: [ { id: null, name: 'OnePC' } ]
```

Accept both the old string form and the object form on load, so existing data keeps working.

---

## 4. Published read-only API

### `CASE.leasing.api`

```js
version            : '0.2.0'
listProjects()     -> [{ id, name, city, type }]
getProjectSummary(projectId)
                   -> { projectId, totalGla, signedGla, vacantGla, occupancyPct, unitCount, updatedAt }
listUnits(projectId)
                   -> [{ id, block, floor, area, category, subcategory, status }]
getUnit(unitId)    -> { id, projectId, block, floor, area, category, status, prospects[] }
openUnit(unitId)   -> void   // deep-link: geo can jump into leasing
openProject(id)    -> void
subscribe(fn)      -> unsubscribe
```

### `CASE.geo.api`

```js
version            : '…'
getCatchment(projectId, opts)
                   -> { projectId, radiusKm|isochroneMin, population, households, incomeIndex, source, asOf }
getFootfall(projectId, opts)
                   -> { projectId, daily, weekly, peakHours[], source, asOf }
getCompetition(projectId, radiusKm)
                   -> [{ name, type, gla, distanceKm, lat, lng, source }]
showProject(projectId)        -> void   // deep-link: leasing can jump into geo
highlightUnits(unitIds[])     -> void
subscribe(fn)                 -> unsubscribe
```

Rules for both:

- Return **plain data**, never internal objects or live references.
- Every figure carries `source` and `asOf`. A number with no provenance is not usable in a
  client report.
- Unknown is `null`, never `0`.
- **Leasing never publishes commission, fee or negotiation detail.** Not through the API,
  not through messages, not through exports meant for the shared layer.

---

## 5. Messaging envelope

While the apps are in separate frames or pages:

```js
{ source: 'case.leasing', v: 1, type: 'unit.selected', payload: { projectId, unitId } }
```

Always validate `event.origin` on receipt. Ignore anything without a known `source` and `v`.

| Emitted by leasing | Emitted by geo |
|---|---|
| `project.opened` | `catchment.ready` |
| `unit.selected` | `footfall.ready` |
| `status.changed` | `location.selected` |

| Accepted by leasing | Accepted by geo |
|---|---|
| `geo.showProject` | `leasing.showProject` |
| `geo.highlightUnits` | `leasing.highlightUnits` |

Unhandled types are no-ops, not errors. Either app must run perfectly alone.

---

## 6. Graceful absence

Neither app may assume the other is loaded.

```js
if (window.CASE && CASE.geo && CASE.geo.api) {
  const c = await CASE.geo.api.getCatchment(projectId);
  renderCatchmentCard(c);
}
// else: render nothing. Never a broken panel, never an error, never a dead button.
```

A feature that needs the other app is hidden when it is absent — not shown disabled, not
shown empty.

---

## 7. Exchange format

Both apps export the same envelope, so the shared layer can ingest either:

```json
{
  "app": "case_ls" | "case_geo",
  "version": 2,
  "exportedAt": "2026-09-18T10:00:00.000Z",
  "data": { }
}
```

`state-store.js` already produces this. The geo app should match it.

---

## 8. Decide before integration starts

These are open and must be agreed by CASE, not by either chat:

1. Where the shared database lives (same hosting, same origin? separate service?).
2. Whether `brandId` is assigned by import from the existing brand base or issued fresh.
3. Whether the two apps share one page (one global scope) or two frames (messaging).
4. Who owns `projectId` assignment when a new project is created.
5. Whether the shared layer is read-only for both apps in phase 1 (recommended) or writable.

Until these are answered, both apps keep their own local data and the contract above keeps
that from becoming a problem.
