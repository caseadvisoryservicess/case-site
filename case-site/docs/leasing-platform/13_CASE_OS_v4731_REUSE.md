# Reuse analysis of the live CASE OS v4.73.1 build

**Purpose.** The founder supplied the package that is actually running on `caseadvisory.uz/os/`. It is
**22 releases ahead of the repository** and it contains three things the Leasing & Sales Operating Platform
(LSP) needs and should not invent again: a working provenance model for commercial numbers, a deterministic
in-browser agent over a closed tool menu, and a set of hard deployment constraints (disk, CSP, manual upload)
that decide how LSP is packaged and installed. This document states what the live build is, what LSP reuses
from it and how, what LSP must not touch, and which planning documents change as a result. It is a reuse and
constraints analysis, not a CASE OS specification: nothing here asks for a change to CASE OS.

**Status: DRAFT for approval — 2026-09-17**

The sibling documents are `01_PRODUCT_SPEC.md` … `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` in this folder;
`00_MASTER_PROMPT.md` is the source requirement. Section 6 lists exactly which of 01–12 this document changes.

### Reading conventions

| Label | Meaning |
|---|---|
| **FACT** | Verified by reading the live package or the built prototype. The file, module version and line range are cited. |
| **A-13-n** | Assumption made for this analysis. It must be confirmed before it is relied on. |
| **RECOMMENDATION** | A proposal for the founder / engineers; not yet a decision. |
| **D16 … D22** | Decisions already taken in the context brief after the v4.73.1 review. |
| `00_MASTER_PROMPT.md §n` | Citation of the source requirement. |

Sources for every FACT below: the extracted package (`os/`, `hosting/`, five changelogs, `ЧИТАТЬ_ПЕРВЫМ.txt`),
the repository at `case-site/os/`, and the built prototype `case-site/os/leasing/index.html` (4 083 lines,
262 KB) with its `README.md`.

---

## 1. What the live build is and how it differs from the repository

### 1.1 Versions

| | Repository `main` | Live package |
|---|---|---|
| `APP_VERSION` (`os/index.html`) | `4.51.0` | `4.73.1` |
| Service-worker cache (`os/sw.js`) | `case-os-v4510` | `case-os-v4731` |
| `os/core.js` | 4 153 lines | 4 205 lines (~1 002 KB) |
| `os/api/lib.php` | 566 lines | 742 lines |
| `os/api/state.php` | — | 544 lines |
| Files in `SHA256SUMS_v4.73.1.txt` | n/a | 166 |
| `os/` on disk | 32 MB | 33 MB |

**FACT.** The repository is 22 releases behind. `core.js` itself grew by only ~52 lines (the `PROV` state key
and the aggregate/chip/dialog helpers); the substance of the 22 releases is in new deferred modules and in PHP.

### 1.2 New front-end modules (all deferred `os/v*.js`)

| Module | Version | What it does | Relevance to LSP |
|---|---|---|---|
| `v4530-geo-export.js` | 4.53.0 | geo export | none |
| `v4600-sun-wind.js` | 4.60.0 | sun, wind, qibla | none |
| `v4630-huff.js` | 4.63.0 | Huff market-share model | none |
| `v4660-uz-translit.js` | 4.66.0 | Uzbek Latin ↔ Cyrillic (617-line module, `toCyrl` L148, `toLatn` L198, `KEEP` list L55) | §3.8 — future UZ interface |
| `v4670-offer-pricing.js` | 4.67.0 | offer pricing chain, `deviations`, `cents()` | §3.3 — D20 |
| `v4680-project-directories.js` | 4.68.0 | project kind / work type with `aliases`, `normalizeKind` | §3.4 — D21 |
| `v4690-offer-cover.js` | 4.69.0 | deterministic cover image by document number | §3.7 |
| `v4710-provenance.js` | 4.71.0 | provenance of numbers (617 lines) | §3.1 — D16, the main reuse |
| `v4730-geo-agent.js` | 4.73.1 | deterministic geo agent, 17 tools (889 lines) | §3.2 — D17 |

### 1.3 New and changed backend files

| File | State | Note |
|---|---|---|
| `os/api/provenance.php` | new | atomic single-key write of one `PROV` entry; server sets `by`/`at` for `verified` |
| `os/api/llm_lib.php` | new | optional OpenAI-compatible translator: free phrase → closed command list |
| `os/api/llm.php` | new | GET endpoint for the above, login required, 20 phrases / 10 min per session |
| `os/api/osm_lib.php` | new | Overpass / Nominatim helpers for the geo agent |
| `os/api/lib.php` | changed | cookie `Secure` derivation (v4.70.3); `unit_finance_fields()` L596, `redact_units_for()` L608, `restore_unit_finance()` L624, `unit_can_change_structure()` L645, `prov_fields()` L657, `prov_parse_key()` L672, `prov_clean_record()` L693, `redact_prov_for()` L729, `restore_prov_finance()` L737 |
| `os/api/state.php` | changed | redaction on read (L43, L46), restore on save (L461, L467), `PROV` added to the saved key list and to four domain scopes |
| `os/api/unit_patch.php` | changed | redacts the single unit it returns (L96) |
| `os/api/units_batch.php`, `os/api/gis_proxy.php` | changed | structure rights; OSM proxy, geocoder, `mode=ping` diagnostics |
| `os/.htaccess` | changed | unconditional HSTS; `https://api-maps.yandex.ru` added to `script-src` |
| `os/sw.js` | changed | cache `case-os-v4731`, new modules in `ASSETS` |
| `os/sql/migrations/2026_08_13_role_dir.sql` | new | role `DIR` — all working rights, `admin=0` |

**FACT — no new SQL tables.** The only SQL change in 22 releases is the `DIR` role row. Changelog v4.71.0
records why: *"the tables `objects` and `units` exist in the schema but the platform never queries them — no SQL
statement in any of the 37 API files reads or writes them; all work goes through the JSON document `app_state`."*
Provenance therefore lives as a new key `PROV` inside the state blob, not in a new table.

**Consequence for LSP.** Any future fold-back of LSP into CASE OS means new keys in the state blob and
domain-scoped saves, in the shape `state.php` already uses — not a new normalised schema, unless a
re-architecture is separately approved. `03_DATA_MODEL.md §9` and `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §7`
must say this rather than promise MySQL tables.

### 1.4 Q-BRIEF-1 — the repository is 22 releases behind

**RECOMMENDATION.** Commit the live `os/` into the repository as a **separate change**, before or in parallel
with LSP work, **excluding `os/api/config.php`** (it holds database credentials and is deliberately absent from
the package). LSP does not depend on this — it adds `os/leasing/` and touches nothing else — but every future
CASE OS change made from `main` today would start from code that is not what is deployed. Owner: Founder /
product sponsor; executor: engineer. See Q-13-1.

---

## 2. Deployment constraints that bind LSP

### 2.1 The constraints

| # | Constraint (FACT, source) | What it forces on LSP |
|---|---|---|
| 1 | Installation is **manual folder replacement** in DirectAdmin: "put the `os/` folder into `domains/caseadvisory.uz/public_html`, replacing the previous one entirely" (`ЧИТАТЬ_ПЕРВЫМ.txt` §1). There is no autodeploy; the FTP workflow file in the repository is not used. | LSP ships as a folder that can be dropped in by a non-engineer, with a one-page note. D18. |
| 2 | **Hidden files must be uploaded**: `os/.htaccess`, `os/api/.htaccess`, `os/api/.user.ini` (all three exist in the package). The file manager must be set to show dotfiles. | LSP contains **no** dotfiles, so a partial upload cannot break it. Keep it that way. |
| 3 | **`os/api/config.php` is never in the package** and must survive the replacement. | The LSP add-on zip contains only `os/leasing/**` and therefore cannot touch `config.php`. |
| 4 | **Integrity is verified** with `sha256sum -c SHA256SUMS_v4.73.1.txt` from inside `os/` (166 entries). | The LSP zip ships its own `SHA256SUMS` over `os/leasing/**` and the same verification step. |
| 5 | **Disk is nearly full: 1.89 of 1.95 GB used.** "Free space before uploading, otherwise part of the files will not be written and sha256sum will show it" (`ЧИТАТЬ_ПЕРВЫМ.txt`). | Size budget ≤ 1.5 MB total (D18). Current prototype: 262 KB in one file. No fonts, no images, no raster plans. |
| 6 | **PHP 8.0 on the hosting**, code kept compatible with 7.2–8.4 so the panel switch is safe (v4.73.0). | LSP adds no PHP. If a production phase adds any, it must stay inside 7.2 syntax. |
| 7 | **CSP is enforced by `os/.htaccess` for everything under `/os/`**, including `/os/leasing/`. | No inline `onclick`, no external scripts, no external fonts. The prototype already complies (delegated listeners only). |
| 8 | **Service worker**: cache `case-os-v4731`, registered at scope `/os/`; navigation requests that fail fall back to the CASE OS `index.html`. | Offline, `/os/leasing/` can render CASE OS instead of LSP. See Q-13-7. LSP registers no service worker of its own. |
| 9 | Outbound HTTPS from PHP may be blocked by the host (the v4.73.0 "⇄ Связь" diagnostic exists for this). | Irrelevant to LSP v0.1: it makes no network call at all. |

### 2.2 The Content-Security-Policy as of v4.70.3

**FACT.** `os/.htaccess` sets one header for the whole `/os/` tree:

```
Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://api-maps.yandex.ru; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; connect-src 'self' https:; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' blob: data:; object-src 'self' data: blob:; worker-src 'self' blob:; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
```

The `script-src` allow-list is exactly: `'self'`, `'unsafe-inline'`, `'unsafe-eval'`,
`https://cdn.jsdelivr.net`, `https://api-maps.yandex.ru`. Two releases (v4.50.3 PPTX export, v4.70.3 Yandex
Maps) failed silently because a host the page actually loaded was missing from this list; the lesson recorded in
the changelog is that named hosts are added, never `https:` as a whole.

**Consequence.** LSP must load nothing from outside `/os/leasing/`. The prototype currently references **zero**
external hosts: the only absolute URLs in the file are the SVG namespace (`http://www.w3.org/2000/svg`,
L672 and L1900) and a `data:` favicon (L8). `--font` (L22) is a system-font stack, not Google Fonts, which
also removes the `fonts.googleapis.com` dependency implied by D14.

### 2.3 Installing the LSP add-on zip on top of v4.73.1 (D18)

`CASE_OS_LSP_v0.1.0.zip` contains `os/leasing/**`, `INSTALL.txt` (one page, Russian) and `SHA256SUMS_LSP_v0.1.0.txt`.
It never contains `.claude/`, `CLAUDE.md`, planning documents or anything outside `os/leasing/`.

1. **Confirm free disk space.** In the hosting panel, check that at least 50 MB is free (the package is ≤ 1.5 MB,
   but the zip is unpacked and the panel reported 1.89 of 1.95 GB used). If it is not, free space first.
2. **Back up.** Download the current `os/leasing/` if one exists (first install: nothing to back up). Do not
   touch `os/api/config.php`; nothing in this procedure reads or writes it.
3. **Unpack locally** and verify the archive before upload: `sha256sum -c SHA256SUMS_LSP_v0.1.0.txt`.
4. **Upload** the folder `leasing` into `domains/caseadvisory.uz/public_html/os/`, replacing it entirely if it
   is already there. No other folder is touched. No hidden files are involved.
5. **Do not touch** `os/index.html`, `os/core.js`, `os/sw.js`, `os/.htaccess`, `os/api/**`, `os/sql/**`,
   `os/SHA256SUMS_v4.73.1.txt`. The CASE OS `APP_VERSION` stays `4.73.1` and the SW cache stays `case-os-v4731`.
6. **Verify on the server**: from `os/leasing/` run `sha256sum -c SHA256SUMS_LSP_v0.1.0.txt`.
7. **Open** `https://caseadvisory.uz/os/leasing/` with Ctrl+Shift+R.

Checks after upload:

| Check | Expected |
|---|---|
| Header of the login screen | `v0.1.0` (`#vtag`, set at L4002) |
| Browser console | no errors; no CSP violation reports |
| Network tab | every request is same-origin under `/os/leasing/`; no request to `cdn.jsdelivr.net`, `fonts.googleapis.com` or any map host |
| CASE OS still loads | `https://caseadvisory.uz/os/` shows `v4.73.1` in the header and `CASE OS: все модули версии 4.73.1` in the console |
| CASE OS integrity | `sha256sum -c SHA256SUMS_v4.73.1.txt` from `os/` still passes — proof that nothing outside `leasing/` changed |
| Login → floor plan → click a unit | drawer opens, status change repaints plan, dashboard and pipeline |
| Reload the page | data survives (`caseos-lsp-state-v1`), session restored |
| Log in as the demo owner | portal only; no commissions, no internal notes |
| Reports → Client report → Print | print layout, no navigation chrome |

---

## 3. Patterns reused

### 3.1 (a) The provenance model — D16

**What it is (FACT).** `v4710-provenance.js`, version 4.71.0, 617 lines. One record per field per entity, held
in the state key `PROV` under the composite key `entity:id:field` (`key()` L106). Record shape (`make()` L122):
`{conf, src, name, at, by, how, basis, note}` — short field names deliberately, because the record travels
inside the whole-state JSON that is saved in full on every edit. Server side: `api/provenance.php` writes
exactly one key inside a transaction; `prov_parse_key()` (`lib.php` L672) accepts only a closed list of
entities and fields and anchors with `\z`, not `$` (a key ending in a newline used to pass and create a ghost
record); `prov_clean_record()` (L693) rejects a future observation date and, for `conf: 'verified'`, overwrites
`by` and `at` with the server's own values.

**Vocabulary — confidence** (`ORDER` L52, `KIND` L54; the array order *is* the strength order and must not be
permuted, because aggregation takes the minimum over it):

| Order | `conf` | Mark | Frame / fill | Word (LSP) | Meaning |
|---|---|---|---|---|---|
| — | *(absent)* | `?` | dotted | `no source` | weaker than any record: a number with no provenance |
| 1 (weakest) | `modelled` | `ƒ` | dashed frame | `Modelled` | computed from other values; an estimate, not an observation |
| 2 | `asking` | `≈` | solid frame, no fill | `Asking` | stated figure: listing, owner or broker; not confirmed by a deal |
| 3 (strongest) | `verified` | `✓` | solid frame, filled | `Verified` | deal, document, call or site visit; author and date recorded |

**Vocabulary — source** (`SOURCE` L72; closed list, because free text would turn "owner", "Owner" and "from the
owner" into three sources within six months and make "% verified" uncomputable):

| `src` | CASE OS label | LSP label | In LSP? |
|---|---|---|---|
| `landlord` | Собственник | Landlord | yes |
| `broker` | Брокер | Broker | yes |
| `tenant` | Арендатор | Tenant | yes |
| `deal` | Закрытая сделка | Closed deal | yes |
| `listing` | Объявление | Listing | yes |
| `field` | Выезд на объект | Site visit | yes |
| `registry` | Государственный реестр | Registry | yes |
| `document` | Документ | Document | yes |
| `osm` | OpenStreetMap | — | **no** (geo-only source) |
| `calculated` | Расчёт платформы | Platform calculation | yes |
| `other` | Иное | Other | yes |

**Vocabulary — method** (`METHOD` L88; only meaningful for `verified` — "a call to a broker" and "a signed
contract on the table" are different grounds, and nobody remembers the difference a year later):
`call`, `visit`, `document`, `registry`, `deal`.

**Rules (FACT).**

| Rule | Implementation | Why it cannot be weakened |
|---|---|---|
| An aggregate takes the **weakest** confidence of its inputs, never the best or the average, and shows the composition ("verified 3, asking 7"). | `weakest()` L213, `aggregate()` L224, `aggChip()` L312 | An average rent over three verified and seven advertised units is not a verified number. This is the defence against a conflict-of-interest claim when CASE both advises and values. |
| A **missing** record is weaker than any record. | `weakest()` returns `null` when any input has no record | A number with no provenance is not "modelled", it is unknown. |
| **Ageing is always visible**: ≥ 90 days amber, ≥ 180 days red, inclusive bounds. | `AMBER_DAYS`/`RED_DAYS` L96–97, `staleOf()` L196 | A rate verified 18 months ago is formally verified and practically from another market. |
| An aggregate's age is that of its **oldest** input, not the mean. | `aggregate()` L224 | A mean would hide one 18-month-old figure behind nine fresh ones. |
| Differences are **icon + frame + word**, never colour alone; print CSS forces white background and keeps the border style. | `CSS` L341–366 incl. `@media print` | CASE material goes to clients as PDF and is often printed in black and white; and amber/green is the most common colour-blind pair. |
| `verified` is an **action, not a menu item**: the confidence dropdown offers only `asking` and `modelled`; four buttons name the method, and the server stamps author and date. | `fieldRow()` L481, `confirm()` L153, `prov_clean_record()` L693 | Otherwise "verified" can be set in someone else's name and backdated by editing one field in DevTools. |
| One key per write, not the whole map. | `api/provenance.php` | Two people confirming different rates in the same minute would otherwise overwrite each other, and the one who lost the edit would be the one who notices. |

**How LSP adopts it — already implemented** in `os/leasing/index.html`:

| Element | Where | Note |
|---|---|---|
| `PROV_ORDER`, `PROV_KIND`, `PROV_SRC` | L518–526 | same vocabulary, English labels; `osm` omitted |
| `thresholds.provAmberDays: 90`, `provRedDays: 180` | L500 (inside `DEFAULT_CONFIG`) | editable in Settings (L3119) |
| `provOf(entity,id,field)`, `provAge(rec)`, `provWeakest(list)`, `provChip(rec,label)` | L1569–1592 | `provWeakest` returns `{conf, counts, at, n}` — the same composition idea as `aggregate()` |
| `.prov`, `.prov.verified/.asking/.modelled/.none`, `.prov.stale`, `.prov.old` | CSS L140–148 | icon + frame + word; fill only on `verified`; ageing as an inset underline |
| Inline record on the unit: `unit.provenance.<field>` | `mkUnit()` L822–845 (`provenance:{}`), demo samples L902–908 | fields used today: `glaM2`, `askingRent`, `agreedRent`, `askingPrice` |
| Chips in the unit drawer | L2601 (area), L2618 (asking rent), L2620 (agreed rent), L2626 (asking price) | |

**What remains to be done in LSP.**

1. Wire `provWeakest()` into the dashboard and report KPI cards (average rent, occupancy) so an aggregate shows
   the weakest confidence and its composition; today the helper exists but no aggregate uses it.
2. A "Data source…" editor in the unit and deal drawers: confidence (`asking` / `modelled` only), source,
   who exactly, observation date, note — plus four confirm buttons naming the method (`call`, `visit`,
   `document`, `deal`).
3. `by` and `at` for `verified` set by the platform from the session, never typed — the client-side analogue of
   the server rule. Label it plainly as a prototype convention, not as security (`00_MASTER_PROMPT.md §6.1`).
4. Provenance on deals (`proposedRent`, `agreedRent`, `agreedPrice`) and on project areas; D16 makes it
   **required** on `agreedRent` / `agreedPrice` when a deal reaches Contract Signed, with `src: 'deal'`,
   `how: 'document'`.
5. A `@media print` rule for `.prov` (CASE OS has one; the LSP print block L239–252 does not cover it yet).
6. A re-check queue ("oldest first") and a "% verified and fresh" figure, the LSP equivalent of `stale()` L385
   and `coverage()` L404, in the data-hygiene card.
7. Client-facing outputs (portal, client report) must carry the marks; `svcClientView()` L1595 does not emit
   provenance today.

**Import / export mapping (LSP inline ↔ CASE OS `PROV`).** LSP keeps the record on the entity
(`unit.provenance.glaM2 = {...}`) because LSP has no separate state map and a nested object is cheaper to
migrate; the adapter maps it 1:1 in both directions.

| LSP path | CASE OS `PROV` key | Notes |
|---|---|---|
| `unit.provenance.glaM2` | `unit:<caseOsUnitId>:area` | `externalIds.caseOsUnitCode` resolves the id |
| `unit.provenance.askingRent` | `unit:<id>:rate` | finance key: redacted server-side for roles without `finance` |
| `unit.provenance.agreedRent` | `unit:<id>:rate` | CASE OS has one rate field; on export, `agreedRent` wins over `askingRent` and the note records which |
| `unit.provenance.askingPrice` | `unit:<id>:budget` | finance key |
| `unit.provenance.commercialStatus` | `unit:<id>:status` | |
| `project.provenance.glaM2` | `object:<objId>:gla` | |
| `project.provenance.gbaM2` | `object:<objId>:gba` | |
| `deal.provenance.agreedRent` | *(no CASE OS counterpart)* | export drops it and says so in the report |
| record fields `conf`, `src`, `name`, `at`, `by`, `how`, `note` | identical | `basis` is not used by LSP; import preserves it verbatim in `note` if present |
| `src: 'osm'` on import | → `other` | with a warning line in the import preview |

**Deliberately not carried over.** The separate `PROV` map (LSP has no global state blob); the atomic
single-key endpoint (no backend in v0.1); server-side stamping of `by`/`at`; the `basis` field; the CASE OS
"Качество и источники данных" screen as a screen (LSP folds the same numbers into the existing data-hygiene
card, `00_MASTER_PROMPT.md §33`); the `osm` source; the Russian-only labels.

**Documents that change:** `03_DATA_MODEL.md` §4 (unit, deal, project entities) and §9 (adapter);
`05_STATUSES_STAGES_AND_CONFIG.md` §10 (thresholds) and §17 (`DEFAULT_CONFIG` skeleton);
`07_CALCULATIONS_AND_KPI_RULES.md` §1–3 (aggregates carry the weakest confidence);
`08_PERSISTENCE_IMPORT_EXPORT.md` §6–9; `10_QA_PLAN.md` §3 (boundary tests at 89/90/91 and 179/180/181 days,
non-colour distinguishability); `04_ROLES_AND_VISIBILITY.md` §4 (provenance of a rate is a finance field).

### 3.2 (b) The deterministic agent pattern — D17

**What it is (FACT).** `v4730-geo-agent.js`, version 4.73.1, 889 lines, entirely in the browser. The owner's
condition, recorded in changelog v4.73.0, is categorical: *"no paid models and no external AI services; the agent
must live inside the platform and be free for everyone"*. The v4.72.0 assistant built on an external paid model
was withdrawn in full, and a test asserts that no reference to an external model host remains in the code.

Architecture, which matches `00_MASTER_PROMPT.md §53` exactly:

```
user phrase
  → detectLang()            RU / UZ / EN                        (L587)
  → parse()                 regex intent grammar + dialog state (L605)
  → [optional] llm.php      only if parse() returned nothing    (L754)
  → TOOLS[name](input)      closed menu, 17 tools               (L343)
  → factHtml() + narrative() templated restatement, per tool    (L687)
```

Techniques worth porting:

| Technique | Where | Why it matters for LSP |
|---|---|---|
| **Multi-language regex with explicit look-arounds instead of `\b`** | `parse()` L605 and passim | `\b` in JavaScript does not see Cyrillic without the `u` flag: "готово", "отмена", "помощь" and "их" never matched and silently fell through to the fallback path. The changelog records this bug **twice in two releases**. LSP intents are EN + RU from day one and must use `(^|[^а-яa-z])…(?![а-яa-z])` or the `u` flag, never bare `\b`. |
| **Number + unit extraction** | `metersIn()` L596 — one global regex over value and unit, comma decimals, deduplication, ordering | LSP needs the same for areas (`м²`, `m2`, `кв.м`), money and days. |
| **Last-value memory** | `ST.lastRadius`, `ST.lastIntents`, `ST.lastLayer` (L44); "а 2 км?" repeats the previous counts with a new radius; "их" means the layer last *mentioned*, not last loaded | LSP equivalents: last project, last unit, last stage, last date range. "And for Demo Business Park?" must repeat the previous question against another project. |
| **A question mark with a number is a continuation, not a request for help** | L611 | "а 2 км?" was being answered with the help text. |
| **Clarifying questions as precondition errors** | `needSite()` L339 / `needZone()` L340 throw a message that *names the next action* ("press 📍 Point and click the map, type coordinates, or an address") | LSP: "which project?", "which unit?", "leasing or sales?" — each naming how to answer, not a bare "please specify". |
| **Templated restatement, never generated prose** | `narrative()` L687 | Every sentence is assembled from tool output. The agent cannot invent a number because it never writes one. |
| **Numbers always carry provenance** | `provChip()` L~695, `factHtml()` L~710 | Same alphabet as §3.1: population is always `ƒ` with the note "an order of magnitude, not a fact". |

**Tool contract shape (FACT).** `TOOLS` (L343) is a flat map `name → function(input) → Promise(result)`;
`run()` (L542) rejects an unknown name; every result is `{ok: true, …}` plus an optional
`provenance: {conf, source, method, at, note}`. Errors are thrown with a human sentence, caught per call, and
printed next to the facts — one failing tool does not cancel the rest (`execute()` L773).

**The optional local translator (FACT).** `api/llm_lib.php` is reached **only** when `parse()` returns nothing
(L754). `llm_menu()` is the closed command list, duplicated from the browser tool map; `llm_system_prompt()`
tells the model to answer with a JSON array of `{name, input}` and nothing else, and explicitly: *"do not invent
numbers: population and buildings are not in the commands, the platform computes them"*. Validation happens
**twice**: `llm_parse_calls()` on the server drops unknown names, nested objects, unexpected keys, over-long
strings and anything past 8 calls; the browser then re-checks each name against its own `TOOLS` and never runs
`help` or `ping` on the model's initiative. Endpoint and model come from `config.php`
(`llm_endpoint`, `llm_model`, `llm_key`); with nothing configured the endpoint answers `needs_llm` and the agent
says honestly that it did not understand. Rate limit: 20 phrases per 10 minutes per session (`llm.php`).

For LSP this is a **documented future extension only** (D17): identical shape, off by default, requires a server
that LSP v0.1 does not have. It is described in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md §4`, not built.

**The first 12 LSP intents.** All twelve are already implemented in the prototype's `INTENTS` array
(L3268–3285), matched in order, first match wins; `askRun()` (L3287) then calls `runTool()` (L3255), which
applies the permission gates and logs an audit entry. Every answer is labelled
*"platform data and calculations from this browser only"*.

| # | English phrase | Russian phrase | Tool called | `00_MASTER_PROMPT.md §52` | In `INTENTS`? |
|---|---|---|---|---|---|
| 1 | vacant area / available area | свободная площадь | `calculateVacantGLA` | `calculateVacantGLA()` | yes |
| 2 | leased area / occupancy | сданная площадь / заполняемость | `calculateLeasedGLA` | `calculateLeasedGLA()` | yes |
| 3 | pipeline value | стоимость воронки | `calculatePipelineValue` | `calculatePipelineValue()` | yes |
| 4 | pipeline (area) | воронка | `calculatePipelineGLA` | `calculatePipelineGLA()` | yes |
| 5 | deals without a next action | сделки без следующего шага | `getDealsWithoutNextAction` | `getDealsWithoutNextAction()` | yes |
| 6 | stale / stuck deals | застоявшиеся сделки, без движения | `getStaleDeals` | *(extension; §41 stale rules)* | yes |
| 7 | overdue tasks | просроченные задачи | `getOverdueTasks` | `getOverdueTasks()` | yes |
| 8 | merchandise mix / categories | структура категорий | `aggregateMerchandiseMix` | `aggregateMerchandiseMix()` | yes |
| 9 | brands that fit unit A-102 | какие бренды подходят помещению A-102 | `suggestBrandsForUnit` | `suggestBrandsForUnit()` | yes |
| 10 | data quality / completeness | качество данных, полнота | `getDataCompleteness` | `getDataCompleteness()` | yes |
| 11 | owner report | отчёт владельцу | `generateOwnerReport` | `generateOwnerReport()` | yes |
| 12 | units in A-1… | помещения A-1… | `searchUnits` | `searchUnits()` | yes |

The registry behind them (`TOOLS`, L3189–3240) holds 20 entries: 19 of the 26 names in
`00_MASTER_PROMPT.md §52` plus `getStaleDeals`. Missing from §52 and still to be added:
`searchCompanies`, `searchContacts`, `searchProjects`, `getProject`, `getFloor`, `getDeal`,
`getProjectChanges`.

**What remains to be done.** Dialog state (`ASK.lastProject`, `lastUnit`, `lastType`) and the "and for X?"
continuation; clarifying questions instead of the single fallback sentence; project- and unit-scoped parameters
parsed out of the phrase; the `u` flag / look-around audit on every Cyrillic pattern; a Russian restatement
template set (today one string in `askRun()` L3299 is Russian while the rest is English); a visible refusal when
the role may not see finance (the gate exists in `runTool()` L3258 but the palette does not explain it);
Uzbek later, with D3.

**Deliberately not carried over.** Any network call; the server translator; map, OSM and geometry tools; free
text ever reaching a model that can answer a user; `help`/`ping` as model-invocable commands.

**Documents that change:** `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §2 (tool contract shape, `provenance` in the
result envelope), §3 (the palette becomes a planned Phase 11 deliverable, not optional) and §4 (the local
translator described as the future extension); `09_IMPLEMENTATION_PLAN.md` §3 (Phase 11 definition of done);
`10_QA_PLAN.md` §3 (an intent test per row of the table above, in both languages).

### 3.3 (c) Offer-pricing deviations and money precision — D20

**What it is (FACT).** `v4670-offer-pricing.js`, 4.67.0. The stated customer rule is that the system shows a
standard rate and everything after that is adjusted by hand — so there is no number that cannot be overridden
and no override that passes unnoticed. The chain (module header, `calc()` L157):

```
listRate → rate (manual) → raw = area × rate → × complexity → base = max(adjusted, minFee)
→ − discount (% or absolute) → billable → + supervision + extra → total
```

Money is kept to cents: `cents()` L110, because `18 400 × 2.5 × 1.35` in a double is `62100.00000000001` and
that value would reach the database, the comparisons and one day the document. Thousands are separated with a
non-breaking space so `$46 000` does not break across lines in print (`usd()` L112). Complexity uplifts are
**additive, not multiplicative**: "+20% for a multi-level podium and +15% for mixed use" is explainable to a
client; `1.2 × 1.15 = 1.38` is not, and in a negotiation that works against us.

**Deviation record (FACT, L233–290).** Eight kinds are produced: `rate`, `complexity`, `complexity_floor`,
`discount`, `below_min`, `total`, `months_raised`, `unconfirmed_rate`. Shape: `{key, ru, from, to, detail}`.
`needsReason` (L334) is true when the deviation is one that a human chose (`rate`, `discount`, `total`,
`below_min`, `complexity`) — the UI then demands an explanation and the change log records it.

**How LSP adopts it.** Already in place: `cents()` (L341); `deal.termsHistory` on every deal
(`mkDeal()` L996, new deals L3483); the entry shape `{field, from, to, by, at, reason}`; demo entries on two
deals (L1022 anchor concession, L1037 volume of anchor package); a "Manual overrides" block in the deal drawer
(L2729–2732) showing field, from → to, who, when and why; `rentUnit: 'USD/m2/month'` and `currency: 'USD'` on
every unit and configurable in `DEFAULT_CONFIG.currency` (L505).

**What remains to be done.** There is no writer yet: `applyFieldAction()` (L3685) handles status, stage and
next action, but commercial terms are read-only in the drawer, so `termsHistory` is only ever seeded from demo
data. The work is (1) editable `askingRent` → `proposedRent` → `agreedRent` and the sales equivalents,
(2) an append to `termsHistory` on every change with a **mandatory** reason, in the spirit of `needsReason`,
(3) the same for commission overrides, (4) `termsHistory` is internal and must never enter `clientView()`,
(5) a deviation badge on the deal card when the agreed terms differ from asking.

**Deliberately not carried over.** The tariff table, complexity factors, split and payment-schedule allocation —
these belong to advisory offers, not to leasing deals. Uplift arithmetic. Document generation.

**Documents that change:** `03_DATA_MODEL.md` §4 (deal: `termsHistory` entry shape and mandatory `reason`);
`05_STATUSES_STAGES_AND_CONFIG.md` §11–12 (money, rent units, commission rules);
`07_CALCULATIONS_AND_KPI_RULES.md` §3–4 (value basis precedence and cent rounding);
`04_ROLES_AND_VISIBILITY.md` §4 (`termsHistory` is `internal`).

### 3.4 (d) Taxonomies with aliases and normalize — D21

**What it is (FACT).** `v4680-project-directories.js`, 4.68.0. Two independent dimensions — project kind
(`KINDS` L36, 20 canonical values) and work type (`WORK_TYPES` L80, 7 values) — and a third, segment, which is
**derived from the kind, never typed**. Each kind carries `aliases`: the spellings found in the real portfolio.
The reason is recorded plainly: 95 projects produced 26 spellings, with "Mixed-Use" and "Mixed-use", "Street
Retail" and "Street retail" living as separate categories, so a filter showed two entries with the same name.
`norm()` (L117) lower-cases and collapses whitespace; `normalizeKind()` (L118) matches `key`, `ru`, `en` and
then every alias, and returns `null` when nothing matches — it never guesses.

**How LSP adopts it.** Already in place: `DEFAULT_CONFIG.categories` (L460–473) — 13 categories, each with
`aliases` holding the CASE OS `CASECATS` Russian spellings ("Мода и стиль", "Места общественного питания",
"Супермаркет / гипермаркет", …); `catByAlias(name)` (L549–558), the LSP `normalizeKind`; the CASE OS import
preview counts unmapped categories and states that they will land in "Other" (`previewCaseOs()` L3816, the
"Unmapped categories" row).

**What remains to be done.** Aliases for brand formats, unit statuses and document types; the same
`aliases` + normalize pattern for project asset types; an editable alias list in Settings (today aliases are
code constants, which contradicts "the lists are edited, not coded"); the alias mapping table exposed in the
CSV import preview so the user can correct a mapping before the import runs.

**Deliberately not carried over.** The CASE OS kind/work-type catalogue itself (advisory project taxonomy, not a
leasing one) and the complexity hints attached to work types.

**Documents that change:** `05_STATUSES_STAGES_AND_CONFIG.md` §9 (categories with `aliases`, normalize
contract, "returns null, never guesses"); `08_PERSISTENCE_IMPORT_EXPORT.md` §8–9 (CSV and CASE OS mapping
preview); `03_DATA_MODEL.md` §9.

### 3.5 (e) Server-side finance redaction and restore — P0-SEC-01

**What it is (FACT).** An independent audit found that CASE OS masked rates on screen for roles without the
`finance` right while the server still returned them in full — in the `U` key of the state blob, in the CSV
export and through the atomic endpoints. The comment in `lib.php` states the principle: *"masking on screen is
not protection: the value is visible in DevTools, in the export and in a direct API request."* The fix:

| Function | `lib.php` | Behaviour |
|---|---|---|
| `unit_finance_fields()` | L596 | the single list: `rate, budget, budLand, factLand, capex, total, gap, commission, feeTotal`. Area and terrace are deliberately **not** in it — the architect needs geometry, and geometry is not a commercial secret. |
| `unit_can_see_finance()` | L601 | `finance` or `admin` |
| `redact_units_for()` | L608 | **deletes** the keys rather than zeroing them, so the client can tell "absent" from "zero"; also drops `offer` |
| `restore_unit_finance()` | L624 | on save, takes the finance fields of each unit from the server's own copy by id — otherwise a redacted client saving the whole state would wipe the rates for everyone |
| `redact_prov_for()` / `restore_prov_finance()` | L729 / L737 | the same for `PROV` keys whose field is a finance field: the record holds no figure but does hold a free-text "who exactly", where a colleague will happily type a price |
| `unit_can_change_structure()` | L645 | creating, deleting, bulk-loading, merging and renumbering units needs `admin`, `finance` or `plans`; the `edit` right alone is not enough |

Call sites: `state.php` L43 and L46 (read), L461 and L467 (save, recording `U.finance` / `PROV.finance` in
`rejectedKeys`); `unit_patch.php` L96.

**What the LSP prototype does today (client side only).** `CAP` (L1681) sets `finance: true` only for
`founder_admin` and `head_ls`; `canSeeFinance()` (L1691) gates the Commercial block of the unit drawer
(L2615), the value columns of the deal drawer, the commission block, and the tool layer — `unitBrief()` (L3241)
and `dealBrief()` (L3248) leave the finance keys **`undefined` rather than zero**, and `runTool()` (L3258)
refuses a tool marked `fin: true` with a message instead of returning a redacted number.

**What production must do server-side.** The prototype is explicitly not security
(`00_MASTER_PROMPT.md §6.1`, §55). A production LSP must, at minimum: (1) keep one list of finance fields on the
server and have every read path ask it; (2) delete, never zero, the keys before sending; (3) restore them from
the server copy on save so a redacted client cannot erase them; (4) apply the same rule to provenance records
whose field is a finance field; (5) separate "may edit a record" from "may change the inventory structure";
(6) return the same redaction in exports and in any tool/API response, not only on screen.

**Documents that change:** `04_ROLES_AND_VISIBILITY.md` §4 (field-level matrix gains the "deleted, not zeroed"
rule and the provenance-of-a-rate row) and §13 (negative assertions: the tool result must not contain the key
at all); `08_PERSISTENCE_IMPORT_EXPORT.md` §13; `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7–8 (the production
architecture section names redact/restore as a required pair, not as masking).

### 3.6 (f) The stored-XSS lesson and escaping — D19

**What it is (FACT).** v4.70.3, §3 of the changelog. `planSVG` inserted the unit code and the brand name into
SVG `<text>` raw. The rest of the core escaped everywhere — kanban, unit card, tables, dropdowns — the plans
were the single exception, which marks it as an oversight rather than a decision. Why it is worse than an
ordinary missing escape: the fields are filled by a colleague with the `edit` right (inline edit or CSV import),
the value travels into the shared state, and the markup is produced **in another user's session** — stored XSS,
executing with that user's rights. The CSP cannot stop it while `'unsafe-inline'` is present, and
`'unsafe-inline'` cannot be removed without rewriting the front end, so escaping is the only line of defence.

**How LSP adopts it.** The floor-plan engine writes **no** data-driven markup:

| Element | Where |
|---|---|
| `esc()` — the single HTML escaper | L331–332 |
| `<title>` tooltip written with `textContent` | `renderPlanInto()` L1917 |
| Unit labels created with `document.createElementNS(NS, 'text')` and filled with `textContent` | L1900 (namespace), L1935–1949, assignment at L1948 |
| `data-unit-code` in the generated demo plans escaped at build time | `buildPlanSVG()` L672–689 |
| Allow-list SVG sanitiser: tags `SVG_OK_TAGS` (L1856), `on*` attributes removed, non-fragment `href`/`xlink:href` removed, `javascript:` values removed, `style` containing `url(` removed, unknown elements dropped | `sanitizeSvg()` L1857–1871, called from `renderPlanInto()` L1892 |
| No inline `onclick` anywhere; one delegated `click` listener with `data-act` | L3877 onward |

**What remains to be done.** Sanitise on **import**, not only on render (the wizard stores the raw `svgText`
at L3852–3870 and sanitising happens later, so a stored plan is trusted until drawn); a size limit and an
element-count limit on an uploaded plan; the same escaping audit over CSV import values and client comments;
a QA test that pushes four payload shapes through the registry and opens the plan in a real browser, with a
deliberately **unescaped** control that must fire — otherwise the test proves nothing (the CASE OS test does
exactly this).

**Documents that change:** `06_FLOORPLAN_ARCHITECTURE.md` §12 (sanitiser contract, sanitise-on-import);
`08_PERSISTENCE_IMPORT_EXPORT.md` §7–8; `10_QA_PLAN.md` §3 (the XSS test with its control case).

### 3.7 (g) Deterministic document choices by number, never randomness

**What it is (FACT).** `v4690-offer-cover.js`, 4.69.0. The cover image is chosen by
`arr[hash(offerNumber) % arr.length]` (`hash()` L47, `pickStock()` L55). The header states the reasoning: an
offer is printed several times — draft, review version, final PDF, and again from the archive a month later —
and a random image would mean the same document looks different every time, so "the file we sent" would stop
existing. A positional hash is used because a plain character sum would collide on permutations ("0042" and
"0024"). When there are no images at all the cover falls back to a block of verified experience figures rather
than an empty frame.

**How LSP adopts it.** The same rule applies to every choice that reaches a printed client document: pick by a
stable identifier, never by `Math.random()` or by insertion time. Already deterministic in the prototype:
`managerColor()` (L1800) assigns colours by the manager's index in a stable list, so the same manager keeps the
same colour across renders; reports are assembled from current data with no sampling; demo IDs are sequential
(`nextId()` L364).

**What remains to be done.** When the report generator gains a cover or accent illustration, seed it from the
report id (`RPT-001`); add a QA check asserting that `Math.random` appears nowhere in `os/leasing/**`; make the
"changes since last report" snapshot key off the report id, not the render time.

**Documents that change:** `09_IMPLEMENTATION_PLAN.md` §5 (reports screen) and `10_QA_PLAN.md` §3 (the
no-randomness static check).

### 3.8 (h) Uzbek transliteration for the future UZ interface

**What it is (FACT).** `v4660-uz-translit.js`, 4.66.0. Not a translation — a deterministic script conversion,
and by the specification the only automatic change permitted in a document that goes to a client and carries
legal weight. Two hard properties: reversibility (`toLatn(toCyrl(x)) === x` over the whole corpus) and
inviolability — names, abbreviations, numbers, units, e-mail, links and `{{placeholders}}` are never touched.
Latin is the master; Cyrillic is derived and cached. The `KEEP` list (L55) is matched case-sensitively and by
whole word, multi-word entries first, and includes the terms LSP also uses: `GLA`, `GBA`, `NOI`, `IRR`, `USD`,
`F&B`, `Advisory`, `Leasing`, `catchment`, `rent-roll`, `tenant-mix`, `pre-opening`, `due diligence`.
The module documents where it deliberately departs from the letter of the table (`ts → ц` is not applied,
because "ketsa" would become "кеца"; `o‘`/`g‘` are parsed before `yo`).

**How LSP adopts it.** LSP ships EN (base) and RU today (`I18N` L372–386, `t()` L387; D3 / A-1). Uzbek is
later. When it comes: (1) UZ strings are authored in Latin and Cyrillic is derived, never maintained twice;
(2) the same `KEEP` principle protects the glossary of `00_MASTER_PROMPT.md §11`; (3) the transliterator is a
port of this module with attribution, not a new implementation; (4) reversibility is a test, not a claim.

**A-13-1.** The UZ interface is out of scope for v0.1 and the transliterator is ported only when a UZ
deliverable is approved. If UZ is required in v0.1, `09_IMPLEMENTATION_PLAN.md §8` and the i18n key coverage
estimate both grow.

**Documents that change:** `09_IMPLEMENTATION_PLAN.md` §8 (i18n plan gains the Latin-master rule);
`01_PRODUCT_SPEC.md` §11 (glossary terms that stay Latin in any script).

### 3.9 (i) Role DIR maps to `head_ls` — D22

**What it is (FACT).** `os/sql/migrations/2026_08_13_role_dir.sql` adds role `DIR`, "Директор (без
администрирования)", with `leasing=1, finance=1, edit=1, approve=1, plans=1, own_only=0, project_scope=0,
admin=0`. The comment states the intent: it differs from `ADM` in exactly one flag, and that is enough because
the "Access", "Modules" and "System" sections are closed in the client both in the menu and at render time.
The migration is idempotent and orders role before user because of the `fk_user_role` foreign key.

**How LSP adopts it.** `head_ls` in `CAP` (L1683) is `{view:'*', edit:true, finance:true, settings:'partial',
admin:false, portalPreview:true, commission:'company'}` — the same shape: everything operational, no access
administration. The full mapping the import adapter must use:

| CASE OS role | LSP role | Note |
|---|---|---|
| `ASH`, `ADM` | `founder_admin` | |
| **`DIR`** | **`head_ls`** | D22 |
| `BA` | `head_ls` | |
| `AG` | `manager` | |
| `HO` | `administrator` | |
| `AGX` | `external_agent` | `own_only` + `project_scope` carry over as scope flags |
| `CFO` | `head_ls` with `edit:false` | A-13-2: a finance-only reader is not in the D7 role list; recommend read-only `head_ls` until a finance role is approved |
| `BSH`, `HM`, `BRJ` | no LSP account in v0.1 | plans / read-only consulting / junior data roles have no LSP counterpart |
| *(new)* | `client` | CASE OS has no client login at all |

**Documents that change:** `04_ROLES_AND_VISIBILITY.md` §2 (role catalog gains the `DIR` row and the mapping
table above); `03_DATA_MODEL.md` §9 (adapter: user mapping).

---

## 4. Code fragments that may be ported versus patterns to reimplement

**Ownership.** Every module named here is CASE Advisory's own code in the same repository family; there is no
third-party licence question. The bundled third-party libraries in `os/` (`jszip.min.js`, `leaflet.case.js`,
`leaflet.markercluster.js`) are **not** used by LSP and must not be.

**Attribution note.** Any ported fragment carries a one-line comment immediately above it, in this exact form:

```javascript
/* ported from CASE OS v4.71.0, module v4710-provenance.js (weakest-confidence aggregation) */
```

The format is `ported from CASE OS vX, module Y` plus, in brackets, what was taken. It is a comment only: no
version string, no module name and no CASE OS identifier enters the LSP data model or the UI.

| Fragment | Source (module, lines) | Verdict | Why |
|---|---|---|---|
| `ORDER` / `KIND` / `SOURCE` / `METHOD` vocabularies | `v4710-provenance.js` L52–93 | **port** (values), translate labels | The vocabulary must be identical for the import/export mapping of §3.1 to be 1:1. |
| `weakest()` + `aggregate()` | same, L213–245 | **port**, ~30 lines | Pure functions, no dependencies. LSP already has the smaller `provWeakest()` (L1576); replace it with the full version so the composition and oldest-date logic match. |
| `daysSince()` / `staleOf()` | same, L185–207 | **reimplement** (3 lines) | LSP already has `daysAgo()` (L346) and inclusive threshold comparison in `provChip()` (L1587). Porting would duplicate. |
| `chipFor()` / `aggChip()` markup | same, L292–330 | **reimplement** | LSP markup, classes, tokens and language differ. Keep the *rule* (icon + frame + word, ageing overlaid, print-safe), not the strings. |
| `.prov` CSS incl. `@media print` | same, L341–366 | **port the print block** | The print rule (white background, forced border style, dashed/dotted preserved) is the part LSP is missing. |
| `prov_clean_record()` validation rules | `api/lib.php` L693 | **reimplement in JS** | Needed client-side in v0.1 (reject future dates, clamp lengths, closed lists) and server-side later. |
| `metersIn()` number+unit extraction | `v4730-geo-agent.js` L596 | **port as a template** | Change the unit table to m², money and days; keep the comma decimals and deduplication. |
| `detectLang()` | same, L587 | **port**, simplified | Drop the Uzbek branch until D3 says otherwise; keep the rule that bare digits do not switch language. |
| The Cyrillic look-around convention | same, throughout `parse()` | **reimplement, as a rule** | It is a coding convention for `09_IMPLEMENTATION_PLAN.md §2`, not a fragment: never `\b` next to Cyrillic. |
| `parse()` intent grammar | same, L605–685 | **reimplement** | Its intents are geographic. The *shape* (one pass, ordered calls, state-aware continuation) is what carries over. |
| `narrative()` templating | same, L687–720 | **reimplement** | Same reason; the rule "one template per tool, no free prose" carries over. |
| `run()` / `execute()` error isolation | same, L542, L773 | **port the behaviour** | One failing tool prints its error next to the facts and the rest still run. LSP `runTool()` (L3255) already returns `{ok:false,error}`; the palette must stop aborting the batch. |
| `llm_menu()` / `llm_parse_calls()` strict validation | `api/llm_lib.php` | **do not port now; document** | Future extension only (D17). When built, port the double validation verbatim. |
| `cents()` | `v4670-offer-pricing.js` L110 | **already ported** | Present at `index.html` L341. |
| `usd()` NBSP grouping | same, L112 | **reimplement** | LSP uses `toLocaleString` (`money()` L337); add the non-breaking space for print. |
| Deviation record construction | same, L233–290 | **reimplement** | LSP's `{field, from, to, by, at, reason}` is a better fit than `{key, ru, from, to, detail}`; keep `needsReason`. |
| `norm()` + `normalizeKind()` | `v4680-project-directories.js` L117–128 | **already ported** | `catByAlias()` (L549). Extend to other taxonomies. |
| `hash()` + `pickStock()` | `v4690-offer-cover.js` L47–61 | **port if a cover is added** | ~12 lines, no dependencies. |
| `toCyrl()` / `toLatn()` + `KEEP` | `v4660-uz-translit.js` L55, L148, L198 | **port wholesale when UZ is approved** | Reimplementation would repeat the mistakes the header documents. |
| `redact_units_for()` / `restore_unit_finance()` | `api/lib.php` L608, L624 | **port to the future backend** | Not applicable to v0.1 (no server). Named here so the production phase does not reinvent it. |
| `sanitizeSvg` allow-list | LSP L1857 (own) vs CASE OS `bindSvgPlan` | **keep LSP's** | The CASE OS binder matches by code and text label and has no sanitiser; LSP's allow-list is stricter and stays. |
| `parsePlanLabels()` text-label regex | CASE OS core | **reimplement, clearly labelled experimental** | D8 and `06_FLOORPLAN_ARCHITECTURE.md §8` already require the label. |

---

## 5. What LSP must not do because of the live build

### 5.1 Files that must not change

`os/index.html`, `os/core.js`, `os/sw.js`, `os/.htaccess`, `os/api/**`, `os/sql/**`, `os/assets/**`,
`os/data/**`, `os/SHA256SUMS_v4.73.1.txt`, and every `os/v*.js`. `APP_VERSION` stays `4.73.1`; the service-worker
cache name stays `case-os-v4731`; `core.js?v=` is not bumped. The proof is procedural: after the LSP upload,
`sha256sum -c SHA256SUMS_v4.73.1.txt` from `os/` must still pass (§2.3, step 7).

Consequences that follow: LSP is **not** in the service-worker `ASSETS` list, so it is not pre-cached and has no
offline guarantee; LSP is **not** in the CASE OS navigation catalogue (`v3520-workspaces.js`) in v0.1 — adding it
is a CASE OS release and a separate decision (Q-13-6); LSP registers no service worker of its own, because a
second registration inside the `/os/` scope would fight the CASE OS one.

### 5.2 localStorage keys — no collisions

LSP and CASE OS share the origin `caseadvisory.uz`, so they share one localStorage. Keys found by reading
`v4731/os/*.js` and `v4731/os/index.html`:

| CASE OS key or prefix | Module |
|---|---|
| `asaas-os-v4` | core (state root) |
| `asaas-os-demo-state-v7` | core (demo mode) |
| `asaas-os-search-hist`, `asaas-os-quiz-ui`, `asaas-os-mapkey` | core |
| `asaas-os-brand-draft-v35` | `v35-stable.js` |
| `asaas-os-v4-feasibility-records`, `asaasFeas.v4.autosave`, `asaasFeas.v4.scenarios`, `asaasFeas.v4.lang` | `v400-feasibility.js`, feasibility studio |
| `asaas-feasibility-*`, `asaas-geo-*` (context, ready, save, saved, saving, save-failed, `asaas-geo-v42`) | iframe message and handoff keys |
| `asaas35-count`, `asaas35-css`, `asaas35-gis`, `asaas35-pager`, `asaas35-results` | `v35-stable.js` |
| `asaas_geo_v1`, `asaas_geo_layer_colors`, `asaas_geo_layer_style`, `asaas_geo_retail_subtypes`, `asaas_saved_probes` | geo studio |
| `asaas-ux-collapsed-…` | `v4450-ux-system.js` |
| `caseos-v32-docdraft-…` | `v32-upgrade.js` |
| `caseos_export_cfg`, `caseos_lgdsize`, `caseos_panel`, `caseos_tbl_colw`, `caseos_tbl_colw::…` | core / UX |
| `caseos_grid_prefs_v4321::…`, `caseos_grid_prefs_v4322::…`, `caseos_brand_table_prefs::…`, `caseos_geo_table_prefs::…` | `v432-data-grid.js` |
| `caseos_geo_master_collapsed`, `case_os_geo_pending_v1`, `case_portfolio_data_version`, `geo_col_widths`, `caseos_bc_edits` | geo modules |

LSP keys (D9, `index.html` L326–327): `caseos-lsp-state-v1`, `caseos-lsp-backup-v1`, `caseos-lsp-session`,
`caseos-lsp-ui`.

**FACT: there is no collision.** No CASE OS key equals an LSP key, and no CASE OS prefix is a prefix of one —
the nearest neighbour is `caseos-v32-docdraft-`, which differs from `caseos-lsp-` at the eighth character.
LSP writes only its own four keys, removes only its own (`K_SESSION` at logout, L3957; `K_STATE` on reset,
L4059), and never enumerates `localStorage`. **Rule: any new LSP key must begin with `caseos-lsp-`.**
The shared quota is a real constraint — LSP warns above 4 MB of state (`viewIO()` L3176) — and the quota is
shared with the CASE OS state blob in the same browser; this belongs in the QA notes, not in a fix.

### 5.3 No new external hosts, no bundled assets

- The only hosts the CSP permits for scripts are `cdn.jsdelivr.net` and `api-maps.yandex.ru`; for styles,
  `fonts.googleapis.com`; for fonts, `fonts.gstatic.com`. **LSP uses none of them.** No chart library, no map
  library, no icon font, no CDN. Charts are inline SVG generated in code (D14).
- No bundled fonts: `--font` (L22) is `'Segoe UI', system-ui, -apple-system, Roboto, Arial, sans-serif`. This
  departs from D14's "Montserrat via Google Fonts" and is the correct departure: it removes a network
  dependency, works from `file://`, and survives a CSP change. **RECOMMENDATION:** record it as the decision and
  amend D14 in `01_PRODUCT_SPEC.md`.
- No bundled images: the favicon is a `data:` SVG (L8); the demo floor plans are generated by
  `buildPlanSVG()` (L667) from coordinate arrays, so four plans cost a few kilobytes instead of four files.
- `connect-src 'self' https:` would permit outbound calls; LSP makes none. There is no `fetch()`, no
  `XMLHttpRequest` and no `<script src>` to a foreign origin in the whole file.

### 5.4 Size budget

| Item | Size |
|---|---|
| `os/leasing/index.html` | 262 KB |
| `os/leasing/README.md` | 4.8 KB |
| **Total today** | **267 KB** |
| D18 budget | ≤ 1 500 KB |
| Headroom | ~1 230 KB |
| Hosting headroom | ~60 MB free of 1.95 GB |

The budget is not decorative: at 1.89 GB of 1.95 GB used, an oversized upload is written partially and
`sha256sum` is what reveals it. The main growth risks are uploaded SVG plans stored as text in state (browser
storage, not disk) and any future raster asset (disk). **Rule: no binary asset is added to `os/leasing/`
without an explicit size decision.**

---

## 6. Impact on documents 01–12

| # | Document and section | Change | Decision |
|---|---|---|---|
| 1 | `01_PRODUCT_SPEC.md` §8 (non-functional) | Add the deployment constraints of §2.1: manual upload, hidden files, SHA256SUMS, disk 1.89/1.95 GB, PHP 8.0, CSP, no autodeploy. | D18 |
| 2 | `01_PRODUCT_SPEC.md` §4, §11 | Provenance marks become part of the product promise ("every commercial number states where it came from"); glossary gains verified / asking / modelled. Amend the Montserrat line of D14 to the system-font stack. | D16 |
| 3 | `02_REQUIREMENTS_REVIEW.md` §3 (conflicts with CASE OS) | Rewrite against v4.73.1 instead of v4.51.0: CASE OS now has provenance and a deterministic agent; the conflicts that remain are `units.status` conflation, one-unit deals, no CRM, no client login. | — |
| 4 | `03_DATA_MODEL.md` §4 | `unit.provenance{}`, `deal.provenance{}`, `project.provenance{}` with the record shape and the closed vocabularies; `deal.termsHistory[]` entry shape with mandatory `reason`. | D16, D20 |
| 5 | `03_DATA_MODEL.md` §9 | Adapter gains: the `PROV` ↔ inline mapping table of §3.1; the role mapping table of §3.9 including `DIR → head_ls`; the statement that a fold-back means new state-blob keys, not new SQL tables. | D16, D22 |
| 6 | `04_ROLES_AND_VISIBILITY.md` §2 | Role catalog gains `DIR` and the full CASE OS → LSP mapping. | D22 |
| 7 | `04_ROLES_AND_VISIBILITY.md` §4, §13 | Finance fields are **deleted, not zeroed**; provenance of a rate is itself a finance field; negative tests assert the key is absent from tool results and exports, not merely masked. | P0-SEC-01 |
| 8 | `05_STATUSES_STAGES_AND_CONFIG.md` §9 | Categories carry `aliases`; the normalize contract returns `null` rather than guessing; aliases become editable in Settings. | D21 |
| 9 | `05_STATUSES_STAGES_AND_CONFIG.md` §10, §17 | `thresholds.provAmberDays: 90`, `provRedDays: 180` documented in the config schema and the skeleton. | D16 |
| 10 | `05_STATUSES_STAGES_AND_CONFIG.md` §11–12 | Money to cents, NBSP grouping in print, `rentUnit`/`currency`, deviation rules on term overrides. | D20 |
| 11 | `06_FLOORPLAN_ARCHITECTURE.md` §12 | Sanitise on import as well as on render; element and size limits; the escaping rule stated as the v4.70.3 lesson with the `textContent` / `createElementNS` requirement. | D19 |
| 12 | `07_CALCULATIONS_AND_KPI_RULES.md` §1–4 | Every aggregate that mixes sourced inputs reports the weakest confidence and the composition; the oldest input dates the aggregate; cent rounding in value basis. | D16, D20 |
| 13 | `08_PERSISTENCE_IMPORT_EXPORT.md` §6–9 | Export carries provenance; import validates the closed vocabularies and reports unmapped `src` values; CSV preview shows the alias mapping. | D16, D21 |
| 14 | `08_PERSISTENCE_IMPORT_EXPORT.md` §1, §12 | Add the CASE OS key inventory of §5.2 and the shared-quota note. | D9 |
| 15 | `09_IMPLEMENTATION_PLAN.md` §3 | Phase 11 (Ask palette) is a deliverable, not optional; a provenance phase is added covering the editor, aggregates and the re-check queue. | D16, D17 |
| 16 | `09_IMPLEMENTATION_PLAN.md` §2, §10 | Coding conventions gain: never `\b` beside Cyrillic; never `Math.random()` in anything printed; every ported fragment carries the attribution comment of §4. Release process gains the add-on zip and the install procedure of §2.3. | D17, D18 |
| 17 | `10_QA_PLAN.md` §3 | New tests: provenance boundaries 89/90/91 and 179/180/181; non-colour distinguishability; weakest-confidence aggregation; stored-XSS with an unescaped control; intent tests per row of §3.2 in EN and RU; static checks for external hosts, `Math.random`, key prefixes and package size. | D16, D17, D19 |
| 18 | `11_REPOSITORY_AUDIT.md` §5 | Record that the live build already answers two of the audited needs (provenance, deterministic agent) and that no external repository is adopted for either. | — |
| 19 | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §2–4 | Tool result envelope gains `provenance`; the palette is specified against the v4.73.0 pattern; the local OpenAI-compatible translator is described as the documented future extension with its double validation. | D17 |
| 20 | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7 | Production architecture: redact/restore as a pair, atomic per-key writes, state-blob keys rather than new tables. | P0-SEC-01 |

---

## 7. Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| **Q-13-1** | The repository `main` is 22 releases behind the live build. Should the v4.73.1 `os/` be committed to the repository? | Yes, as a separate change, without `api/config.php`, so future CASE OS work starts from what is deployed. LSP does not depend on it. | Founder / product sponsor |
| **Q-13-2** | D16 makes provenance **required** on `agreedRent` / `agreedPrice` at Contract Signed. Blocking or warning in v0.1? | Warning in v0.1 (the stage change still happens, the deal is flagged in data hygiene and in the report); blocking in production, where a server can enforce it. | Head of Leasing & Sales |
| **Q-13-3** | Should the LSP export write provenance back into CASE OS `PROV` keys, or only read them? | Read-only in v0.1: import maps `PROV` → inline records; export emits the mapping table as a report but does not produce a CASE OS state blob. Write-back needs the atomic endpoint and a merge policy. | Founder / product sponsor |
| **Q-13-4** | Does the deterministic "Ask" palette ship in v0.1 or wait for a later release? | Ship it, read-only, labelled prototype: the owner already works this way in the geo studio, and the registry it needs exists. Write tools (`createTask`, `addComment`) stay behind the edit right and an explicit confirmation. | Founder / product sponsor |
| **Q-13-5** | Is a local OpenAI-compatible translator (the `llm_lib.php` pattern) acceptable for LSP later? | Document it as a future extension only: off by default, requires a server LSP does not have, must keep the double validation and never answer a user or produce a number. Confirm that "no external AI service" also forbids a hosted OpenAI-compatible gateway. | Founder / product sponsor |
| **Q-13-6** | Should LSP appear in the CASE OS navigation (`v3520-workspaces.js` catalogue), and when? | Not in v0.1 — it would be a CASE OS change and a new release. Revisit after QA sign-off, as a separate one-line change with its own version bump. | Founder / product sponsor; engineer |
| **Q-13-7** | Offline, the CASE OS service worker answers a failed navigation to `/os/leasing/` with the CASE OS `index.html`. Accept or fix? | Accept for v0.1 and state it in the README and the QA limitations: LSP is not offline-capable. A fix means editing `os/sw.js`, which §5.1 forbids; if offline use is required, it becomes a CASE OS release. | Engineer; Founder decides priority |
| **Q-13-8** | How do CASE OS roles without an LSP counterpart map on import: `CFO`, `BSH`, `HM`, `BRJ`? | `DIR → head_ls` (D22), `AGX → external_agent`; `CFO` → read-only `head_ls` until a finance role is approved (A-13-2); `BSH`, `HM`, `BRJ` → no LSP account in v0.1, listed in the import report as skipped. | Head of Leasing & Sales |
| **Q-13-9** | Disk is at 1.89 of 1.95 GB. Who frees space and confirms it before the LSP upload? | The founder or the hosting administrator confirms at least 50 MB free immediately before upload; the engineer refuses to upload without that confirmation, because a partial write is silent until `sha256sum` is run. | Founder / product sponsor |

### Assumptions recorded in this document

| ID | Assumption |
|---|---|
| **A-13-1** | The Uzbek interface is out of scope for v0.1; `v4660-uz-translit.js` is ported only when a UZ deliverable is approved (§3.8). |
| **A-13-2** | CASE OS `CFO` maps to a read-only `head_ls` in LSP; the D7 role list has no finance-only reader (§3.9). |
| **A-13-3** | The live package at `/tmp/.../v4731/` is byte-identical to what is deployed; every FACT above is read from it and from `SHA256SUMS_v4.73.1.txt`, not from the server. |
| **A-13-4** | The system-font stack replaces Montserrat for LSP (§5.3); D14 is amended rather than the font added. |
