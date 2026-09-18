# CASE OS data migration — what both chats must know

**Read this before designing any data structure.** CASE OS v4.73.1 is the live production
system. The leasing tool and the geoanalytics tool will eventually fold into it. Every
structure you invent now either matches what is already there, or becomes a migration
problem later.

Facts below are read from the v4.73.1 hosting build (`os/api/state.php`, `os/core.js`,
`os/sql/schema_mysql.sql`).

---

## 1. The single most important fact

**CASE OS does not use its relational tables for live data.**

The schema defines `objects`, `units`, `deals`, `brands`, `contacts`, `documents`,
`activity_log` and ~20 more. The running application reads and writes **none of them**.

All live data sits in one row:

```sql
CREATE TABLE app_state (
  id INT PRIMARY KEY, data LONGTEXT, updated_at DATETIME,
  updated_by VARCHAR(160), revision INT NOT NULL DEFAULT 0
);
-- SELECT data FROM app_state WHERE id=1  ->  one big JSON blob
```

`os/api/state.php` GETs and POSTs that blob whole. The comment in the source says it
plainly: modules *"keep their working data inside this shared state blob … instead of the
row-level-ACL'd data.php endpoints their DB tables were designed for."*

**What this means for you:** folding a new tool into CASE OS is **adding keys to a JSON
blob**, not creating tables. Design for that. A tool that assumes it will get its own
tables is designing for a migration that has not happened in 73 releases.

---

## 2. The authoritative key list

From `os/api/state.php → all_shared_state_keys()`. These 66 keys are the entire live data
model of CASE OS.

```
TAXO  OBJECTS  U  BRANDS  USERS  CHANGES  BENCH  REFUSALS
PLANUP  PLANSVG  PLAN_LABELPOS  PLAN_CODES  PLAN_STRUCT  PLAN_IGNORED_CODES
DOCREG  DOC_CONTACTS  AGENTS  ROLES  KPSEQ  ACTLOG  AUDIT
MAPCFG  PROJECT_PPT  QUIZLOG  QUIZSTATS  KB  KBPROG  HRPROF  CHAT  KPI_TARGETS
ROLE_WORKSPACES  USER_WORKSPACES  MODULE_FLAGS  GEO_DATA  TRASH  COMMCFG  COMMLOST
BRAND_REQUESTS  INVESTOR_REQUESTS  SALES_ASSETS  SALES_BUYERS  CASE_PARTNERS
PARTNER_REFERRALS  V32_NOTES
COMMISSION_ENGINE_CFG  LEASE_COMMISSION_DEALS  SUPPLIERS
SUPPLIER_COMMISSION_DEALS  SUPPLIER_COMMISSION_LEDGER
CASE_CLIENTS  CASE_OPPORTUNITIES  CASE_PROPOSALS  CASE_CONTRACTS  CASE_SCOPE_ITEMS
CASE_SCOPE_CHANGES  CASE_TASKS  CASE_DELIVERABLES  CASE_LAYOUT_VERSIONS  CASE_DECISIONS
CASE_DOCUMENT_TEMPLATES  CASE_WORKFLOW_SETTINGS  CASE_PORTFOLIO_PROJECTS
CASE_PROPOSAL_CATALOG  OWNER_REPORTS  PROV
```

### The ones that matter to leasing and geo

| Key | Holds | Your tool |
|---|---|---|
| `OBJECTS` | projects / assets | **map your `projects` onto this** |
| `U` | units — the leasing register | **map your `units` onto this** |
| `BRANDS` | the brand database | do not fork it; reference it |
| `REFUSALS` | rejections | **this is where `rejectionsCount: 52` belongs** |
| `CHANGES` | registry change log | your per-unit `history` maps here |
| `ACTLOG` / `AUDIT` | activity and audit trail | |
| `TAXO` | category taxonomy | your `category` / `subcategory` come from here |
| `PROV` | provenance: where each figure came from | |
| `GEO_DATA` | geoanalytics data | **the geo tool's home key** |
| `CASE_CLIENTS` | clients | shared entity |
| `LEASE_COMMISSION_DEALS` | commission deals | leasing must not duplicate this |
| `PLANSVG`, `PLAN_CODES`, `PLAN_STRUCT`, `PLAN_LABELPOS`, `PLAN_IGNORED_CODES` | **the whole floor-plan subsystem** | §4 — already solved, do not reinvent |
| `CASE_LAYOUT_VERSIONS` | frozen plan versions | §4.3 |

---

## 3. Two access rules that are enforced server-side

Both already exist in `state.php`. Anything you build must survive them.

1. **The client saves the whole blob every time.** A role that may not touch `GEO_DATA` still
   POSTs it. The server restores disallowed keys from the stored copy and returns
   `rejected_keys`. So: **never assume your POST was applied in full** — read the response.

2. **Redaction is server-side, not cosmetic.** For non-admin, non-finance users the server
   strips other brokers' rows and masks rates and budgets inside `U` and `PROV` before the
   blob is sent. The source comment is blunt: *"маскировка на экране защитой не является"* —
   masking on screen is not protection, the value is visible in DevTools and in exports.

   **Consequence for the leasing tool:** the rule "clients never see commission data" must
   hold at the data layer, not by hiding a column.

---

## 4. The floor-plan subsystem already exists — match it

This is the part the team said was *"already tested"*. It is, and its shape should be
reused rather than reinvented.

### 4.1 Keying

```js
planKey(objId, block, floor) = block ? objId+'::'+block+'::'+floor
                                     : objId+'::'+floor
// "creative-avenue::B1::1 этаж"
```

Every plan structure is keyed this way:

```js
PLANSVG[key]            = { kind:'svg'|'img', data:'<svg…>' | 'data:image/png;base64,…' }
PLAN_CODES[key]         = [ { code:'L2_11', area:70.8 }, … ]    // recognised labels
PLAN_LABELPOS[key]      = { 'L2_11': {x,y}, … }                 // manual label nudges
PLAN_IGNORED_CODES[objId] = ['С/У', 'М/Р', … ]                  // codes to stop reporting
PLAN_STRUCT[objId]      = { blocks:['B1','B2'], floors:{ 'B1':['-1 этаж','1 этаж'] } }
```

`PLAN_STRUCT` gives blocks and floors an explicit, reorderable, renameable identity
instead of deriving them from unit rows. Derived values are still merged in as extras.

**Adopt this keying in v0.2.** It costs nothing now and removes a migration later.

### 4.2 Rename and delete are migrations, not edits

`renamePlanBlock` / `renamePlanFloor` move `PLANSVG`, `PLAN_LABELPOS` and `PLAN_CODES` to
the new key **and** update every unit's `block` / `floor`. Deletion is guarded:

> *"Нельзя удалить блок «B1»: к нему привязано юнитов — 42."*

You cannot delete a block that still has units. Keep that guard.

### 4.3 Plan versions are frozen snapshots, not labels

`CASE_LAYOUT_VERSIONS` holds immutable snapshots:

```js
{ id, projectId, version:'план-3', type:'leasing', status:'working', active:true,
  snapshot:{ planCodes:{…}, struct:{…}, svgRefs:{key: svgHash}, checksum, plans, codes,
             frozenAt, frozenBy } }
```

The checksum is FNV-1a over a canonical JSON fingerprint of `PLAN_CODES` + `PLAN_STRUCT`.
**The LCR is generated strictly from the selected version's snapshot, never from the live
plan.** That is what makes a leasing register defensible months later.

Out of scope for v0.2 — but do not build anything that makes it impossible. Concretely:
keep `PLAN_CODES` separable per key and serialisable on its own.

### 4.4 The reconciliation the team already relies on

`planDiff(objId, block, floor, labels)` returns three lists:

```js
{ onlyOnPlan: [...],   // on the drawing, not in the register (minus ignored codes)
  onlyInReg:  [...],   // in the register, not on the drawing
  areaDiff:   [{ id, code, plan, reg }] }   // both, but areas differ by >= 0.5 m²
```

and a banner appears across the app whenever any of the three is non-empty:

> ⚠ Планировки и реестр расходятся: **3** нов. на чертеже · **5** нет на чертеже · **2** с разной площадью

`plan-recognizer.js → matchToInventory()` returns the same three sets under different
names (`unmatchedPlan`, `unmatchedRows`, `areaMismatch`). **Show the same banner.** The
leasing team already reads it.

Note the tolerance difference: CASE OS uses an absolute **0.5 m²**; the recognizer defaults
to a relative **3 %**. Pick one per project and say which — do not leave both running.

### 4.5 Lessons already paid for in CASE OS

| Lesson | Where it came from |
|---|---|
| CAD text arrives as UTF-8 read as Latin-1 (`Ð¼` for `м`). Repair before parsing or every Cyrillic label is lost. | `mtextClean()` |
| AutoCAD MTEXT carries formatting escapes (`\fMontserrat\|b0\|i0\|c204\|p2;`). Strip them. | `mtextClean()` |
| CAD prints thousands as `1 234`. De-group before parsing a number. | `degroup()` |
| Bare numeric codes are **off by default** — otherwise dimension strings get read as unit codes. | `parsePlanLabels(svg,{numeric:false})` |
| Illustrator positions `<text>` by `transform="matrix()"`; `getBBox()` alone puts every label at ~0,0. Use `getBBox()` + `getCTM()`. | `posOf()` |
| Use the **median nearest-neighbour distance between codes** as the pairing radius, not a fixed fraction. | `parsePlanLabels()` |
| Uploaded SVG is untrusted input — sanitise before injecting. | `sanitizePlanSvgDom()` |

All seven are implemented in `plan-recognizer.js`.

---

## 5. Field mapping — Creative Avenue v0.1 → CASE OS

`BASE_PROJECT` → `OBJECTS[]`, `BASE_PROJECT.units[]` → `U[]`.

| v0.1 unit field | CASE OS `U` | Note |
|---|---|---|
| `id` (`B1_001`) | `code` | CASE OS `U` rows also carry a numeric `id`; keep `code` as the human key |
| `block` | `block` | CASE OS stores a string (`'B1'`); v0.1 stores a number (`1`). **Normalise to string now.** |
| `floor` | `floor` | CASE OS uses labels (`'1 этаж'`, `'Цоколь'`); v0.1 uses numbers (`-1`…`4`). Keep the number **and** add a label. |
| `area` | `area` | m², same |
| `category` / `subcategory` | from `TAXO` | v0.1 free text; will need mapping to the taxonomy |
| `status` | `status` | Russian strings — **already aligned, do not translate in the data** |
| `prospects[]` | brand references | v0.1 free text; keep the `{id:null,name}` slot so `brandId` can be filled |
| `broker` | `broker` | names align (Нодир, Азиз, Бекзод) |
| `rentFact`, `rentMonthlyFact`, `serviceFact` | commercial fields | **subject to server-side redaction** (§3.2) |
| `comment` | `unit_comments` / `CHANGES` | |
| `history[]` (new in v0.2) | `CHANGES` | |
| `original{}` | plan-version snapshot | conceptually §4.3 |
| — | `REFUSALS` | `rejectionsCount: 52` belongs here, as rows not a counter |

### Three normalisations to do in v0.2, because they are free now

1. **`block` as a string.** `1` → `'1'`. A number and a string will not join later.
2. **`floor` keeps both forms.** `floor: -1` **and** `floorLabel: 'Цоколь'`.
3. **`prospects` as objects.** `['OnePC']` → `[{id:null, name:'OnePC'}]`, accepting both
   forms on load.

---

## 6. Export envelope

`state-store.js` already emits:

```json
{ "app":"case_ls", "version":2, "exportedAt":"…", "data":{ "units":[…], "projects":[…] } }
```

The CASE OS side expects `OBJECTS` and `U` at the top level of its blob. Keep a
`toCaseOsBlob()` shim rather than renaming your internals:

```js
function toCaseOsBlob(state){
  return {
    OBJECTS: state.projects.map(toObject),
    U:       state.units.map(toUnit),
    PLANSVG: state.plans,          // already keyed objId::block::floor
    PLAN_CODES: state.planCodes,
    PLAN_STRUCT: state.planStruct,
    REFUSALS: state.rejections,
    CHANGES: state.units.flatMap(u => (u.history||[]).map(h => ({unit:u.id, ...h})))
  };
}
```

One function to review at integration time, instead of a rename across the whole app.

---

## 7. Two known constraints of the live build

Carried over from the v4.73.1 analysis, so nobody rediscovers them:

1. **The CASE OS service worker (`os/sw.js`) controls all of `/os/`.** A separate app served
   from `/os/<something>/` will be answered by the cached CASE OS page when offline. Either
   host outside `/os/`, or `os/sw.js` must be edited — it cannot be fixed from inside the
   new app.
2. **CASE OS uses Montserrat.** A tool that ships system fonts will not look like part of
   it. If visual unity matters (it does — see §8), the font decision has to be made
   deliberately, and a self-contained file cannot fetch Google Fonts.

---

## 8. One design system across all three

The leasing tool, the geoanalytics tool and CASE OS must look like one product, not three.
CASE OS tokens, already in use:

```
brand red     #b5222b      (hover #d43a43)
dark chrome   #141518 / #1d1f23
status        signed #1c8a5b · signing #c98910 · proposed #356fe0
              negotiation #7c55c7 · vacant #9aa1aa · reserved #c84550
radius        12px cards, 8px controls
type          Montserrat in CASE OS; system stack in the standalone prototypes
```

Rules for both new tools:

- Use the token names, not raw hex, so one file changes the theme everywhere.
- Prefix app-specific tokens (`--ls-*`, `--geo-*`); leave shared ones unprefixed
  (`--brand`, `--signed`).
- The same status colour means the same status in all three. Never recolour a status.
- Same spacing scale (4 px), same radii, same elevation ramp, same motion durations.
- A component that exists in CASE OS (KPI card, status chip, data table, drawer) keeps its
  CASE OS shape — the leasing team should not have to learn it twice.

Ship the tokens as one `:root` block copied verbatim between the two projects. When they
merge, that block becomes the shared stylesheet and nothing else has to change.

---

## 9. Open decisions for CASE, not for either chat

1. Do the new tools fold into `app_state` as new keys, or does CASE OS finally migrate to
   its relational tables first?
2. Who assigns `projectId` — CASE OS `OBJECTS`, or the new tools?
3. Is `BRANDS` the master brand database, or is a new shared service being built?
4. Does the leasing tool inherit the CASE OS role model (`ROLES`, `ROLE_WORKSPACES`,
   `USER_WORKSPACES`) or keep its own?
5. Montserrat or system fonts in the standalone builds?

Until these are answered, keep local data local, keep the key names above, and keep
`toCaseOsBlob()` as the single seam.
