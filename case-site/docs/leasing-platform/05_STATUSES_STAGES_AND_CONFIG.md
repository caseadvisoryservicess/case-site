# Unit statuses, pipeline stages and configuration schema

**Purpose.** This document defines the configuration layer of the CASE OS · Leasing & Sales Platform (LSP, `os/leasing/`): the unit commercial statuses, the derived pipeline stage / display status rule, the leasing and sales stage lists, transition guards, lost reasons, client status mapping, merchandise categories, stale rules, commission rules, currencies and units, notification rules, document types, activity types, comment and task vocabularies, the complete `DEFAULT_CONFIG` skeleton for `js/config.js`, and the Settings UI requirements. It is the implementation reference for `js/config.js`, the config-related parts of `js/services.js` and `js/state.js`, and the Settings screen (`js/views/settings.js`). It answers master prompt §69 item 5 ("Define unit statuses and leasing/sales stages") and the configuration parts of §12, §22, §23, §36, §38, §41, §44 and §45 of `00_MASTER_PROMPT.md`.

**Status: DRAFT for approval — 2026-09-17**

Sibling documents: `03_DATA_MODEL.md` (entity fields that these keys are stored in), `04_ROLES_AND_VISIBILITY.md` (who may edit Settings, who sees commissions), `06_FLOORPLAN_ARCHITECTURE.md` (how colors, patterns and legends are rendered), `07_CALCULATIONS_AND_KPI_RULES.md` (KPI buckets that consume `countsAs` and the negotiation threshold), `08_PERSISTENCE_IMPORT_EXPORT.md` (config migrations and the CASE OS import adapter), `09_IMPLEMENTATION_PLAN.md`, `10_QA_PLAN.md`, `02_REQUIREMENTS_REVIEW.md` (resolution of the §6.3 / §12 tension).

Conventions used below:

- **FACT** — sourced from `00_MASTER_PROMPT.md §n` or a named CASE OS file.
- **A-n** — assumption from the context brief (A-1 language, A-2 fictional demo data, A-3 merchandise categories). New assumptions introduced here are numbered **A-05-n**.
- **Q-05-n** — open question with a recommendation and an owner (default owner: Founder / product sponsor; operational owner: Head of Leasing & Sales).
- Keys are `snake_case` string constants; they are stored in data records, are immutable after creation and are never shown to users. Labels are shown to users and are editable (A-1: English base + Russian).

---

## 1. Principles

| # | Principle | Source | Consequence for implementation |
|---|---|---|---|
| P1 | Everything in this document is configuration, not code. It lives in `DEFAULT_CONFIG` (`js/config.js`) and, once the user edits it, in `appState.settings`. | `00_MASTER_PROMPT.md §44`, §62 ("configuration-driven statuses") | Rendering, services and reports read `appState.settings`; `DEFAULT_CONFIG` is only the seed and the "reset to defaults" source. |
| P2 | Editable in Settings. Every list in §2–§16 has a Settings section (see §18). | `00_MASTER_PROMPT.md §12, §22, §44` | No list is duplicated in a view file. Views call `cfg('unitStatuses')` style accessors from `js/services.js`. |
| P3 | Colors never live in rendering code. `js/floorplan.js`, `js/ui.js` and the print stylesheet obtain fill, text color, stroke and pattern from the status / category entry. | `00_MASTER_PROMPT.md §12` ("must not be hard-coded inside rendering logic"), §65 technical review | The only colors allowed in CSS are design tokens (D14) for chrome; data colors are injected as inline `style` / SVG attributes from config. A QA check greps `js/views/*.js` and `js/floorplan.js` for hex literals (`10_QA_PLAN.md`). |
| P4 | Semantics are expressed by flags, not by key names. KPI and legend logic reads `countsAs`, `availabilityGroup`, `marketable`, `kind`; stage logic reads `type`, `order`, `displayStatusKey`, `setsUnitStatusSuggestion`, `commissionRelevant`. | D5, D6 | Renaming or adding a status never breaks calculations: a new status with `countsAs: 'leased'` is counted as leased everywhere without code changes. |
| P5 | Unit status and deal stage are separate fields on separate entities (`unit.commercialStatus` vs `deal.stage`). The unit's pipeline stage is derived at read time and never stored. | `00_MASTER_PROMPT.md §6.3, §12`; D5 | `services.unitDisplayStatus()` is the single function that combines them (§3). CASE OS `STAT` (one mixed field, `os/core.js` line 318) is split by the import adapter (`08_PERSISTENCE_IMPORT_EXPORT.md`). |
| P6 | Keys are immutable and language-neutral; labels are per language. | A-1, D3 | Each entry carries `label: {en, ru}`; `t()` falls back to `en`. Stored records reference keys only. |
| P7 | Nothing here is deleted while in use. Entries have `active: true|false`; deleting an entry that is referenced by records requires reassignment (§18). | `00_MASTER_PROMPT.md §65` ("no lost state") | `services.configUsage(listName, key)` counts references before any delete. |
| P8 | Config is versioned (`configVersion`) and migrated on load together with the state schema. | D9 | `state.js` runs `migrateConfig()` after `migrateState()`; both are idempotent. |

---

## 2. Unit commercial statuses (inventory) — D5

FACT: `00_MASTER_PROMPT.md §12` lists sixteen "initial statuses" and requires that they be editable in Settings with configurable colors; `§6.3` forbids storing deal stage in the unit status field. D5 resolves this: `unit.commercialStatus` stores only the twelve **inventory** statuses below; the remaining six §12 values (Lead, Viewing, Negotiation, LOI, Contract Draft, Sale Negotiation) are **derived** display statuses produced by §3 and are listed in Table 2b so that the plan legend still shows the full §12 vocabulary.

Field definitions (one entry of `unitStatuses[]`):

| Field | Type | Meaning |
|---|---|---|
| `key` | string, immutable | Stored in `unit.commercialStatus` and in `statusHistory`. |
| `label` | `{en, ru}` | Display label. |
| `kind` | `'inventory'` \| `'derived'` | Only `inventory` keys may be stored on a unit; `derived` keys are produced by `unitDisplayStatus()` from a deal stage. |
| `availabilityGroup` | `'available'` \| `'in_process'` \| `'occupied_or_sold'` \| `'unavailable'` | Legend group of the Availability plan mode (`00_MASTER_PROMPT.md §14.5`). |
| `countsAs` | `'vacant'` \| `'leased'` \| `'sold'` \| `'unavailable'` \| `'pipeline'` | Inventory KPI bucket (D6; formulas in `07_CALCULATIONS_AND_KPI_RULES.md`). Derived statuses carry `'pipeline'` for legend purposes only; KPI buckets are computed from the stored inventory status plus deals, never from the derived key. |
| `marketable` | boolean | True when an open deal at or above the negotiation threshold may replace the label on the plan (§3). |
| `color` / `textColor` | hex | Fill and label color (light theme); `06_FLOORPLAN_ARCHITECTURE.md` applies `fill-opacity` and a darkened stroke; dark theme uses the same fill with adjusted opacity. |
| `pattern` | `'none'` \| `'dots'` \| `'diagonal'` \| `'crosshatch'` \| `'hatch'` \| `'dashed_outline'` | Non-color indicator (`00_MASTER_PROMPT.md §14`, accessibility). Rendered as SVG `<pattern>` defs. |
| `clientStatus` | key from `clientStatuses[]` | Portal mapping (§8). |
| `commercialModes` | subset of `['leasing','sales','leasing_and_sales']` | Where the status may be selected. The leasing / sales / both switch on project and unit is named `commercialMode` here (A-05-5); `00_MASTER_PROMPT.md §9 mandateMode: "Exclusive"` is a different field (exclusivity) and is owned by `03_DATA_MODEL.md`. |
| `description` | `{en, ru}` | Shown as help text in the status picker and in Settings. |
| `active`, `order` | boolean, integer | Settings housekeeping. |

### Table 2a — Inventory statuses (stored in `unit.commercialStatus`)

| key | Label EN | Label RU | availabilityGroup | countsAs | marketable | color | textColor | pattern | clientStatus | commercialModes | Description |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `vacant` | Vacant | Вакант | available | vacant | no | `#F3F4F6` | `#374151` | none | `available` | all | Physically empty, not yet released for marketing (before mandate start, awaiting owner decision or works). Counted as vacant GLA. |
| `available` | Available | Доступно | available | vacant | yes | `#DCFCE7` | `#14532D` | none | `available` | leasing, both | Released for leasing; may carry any number of open deals. Default status for imported CASE OS `vac` units. |
| `active_marketing` | Active Marketing | Активный маркетинг | available | vacant | yes | `#BBF7D0` | `#14532D` | dots | `available` | leasing, both | Available and included in a current marketing campaign / brochure. Same KPI behaviour as Available. |
| `reserved` | Reserved | Резерв | in_process | pipeline | no | `#EDE9FE` | `#4C1D95` | diagonal | `in_negotiation` | all | Held for one prospect by owner decision or deposit; other deals are paused. Counted in "Under negotiation" regardless of deal stage (D6). |
| `contract_signed` | Contract Signed | Договор подписан | occupied_or_sold | leased | no | `#DBEAFE` | `#1E3A8A` | none | `leased` | leasing, both | Lease signed, tenant not yet in possession. Set (after prompt) when a leasing deal reaches `contract_signed`. |
| `fit_out` | Fit-out | Отделка арендатора | occupied_or_sold | leased | no | `#BFDBFE` | `#1E3A8A` | crosshatch | `leased` | leasing, both | Tenant fit-out in progress. |
| `occupied` | Occupied | Занято | occupied_or_sold | leased | no | `#93C5FD` | `#0F172A` | none | `leased` | leasing, both | Tenant trading / in possession. |
| `for_sale` | For Sale | На продажу | available | vacant | yes | `#CCFBF1` | `#134E4A` | none | `available` | sales, both | Offered for sale. On `leasing_and_sales` units a second inventory status is not needed: For Sale is the sales-side "Available". |
| `sold` | Sold | Продано | occupied_or_sold | sold | no | `#14B8A6` | `#FFFFFF` | none | `sold` | sales, both | Sale contract signed (see Q-05-4). Counted as sold GLA. |
| `temporarily_blocked` | Temporarily Blocked | Временно заблокировано | unavailable | unavailable | no | `#F5F5F4` | `#57534E` | hatch | `not_available` | all | Withheld for a defined period (works, owner use, legal). `unit.operational.notes` should say why. |
| `not_available` | Not Available | Недоступно | unavailable | unavailable | no | `#D6D3D1` | `#292524` | hatch | `not_available` | all | Permanently outside the leasing/sales scope (technical, common area, owner-occupied). |
| `unknown` | Unknown | Не определено | unavailable | unavailable | no | `#FFFFFF` | `#6B7280` | dashed_outline | `not_available` | all | Status not yet verified. Default for imported units without a recognisable status. Reported in Data hygiene ("inconsistent unit status"). |

### Table 2b — Derived display statuses (never stored; produced by §3 from `stage.displayStatusKey`)

| key | Label EN | Label RU | availabilityGroup | countsAs (legend only) | color | textColor | pattern | clientStatus | Produced by stages |
|---|---|---|---|---|---|---|---|---|---|
| `lead` | Lead | Лид | in_process | pipeline | `#FEF9C3` | `#713F12` | none | `interest` | leasing `lead`…`unit_offered`; sales `lead`…`unit_offered` |
| `viewing` | Viewing | Просмотр | in_process | pipeline | `#FEF08A` | `#713F12` | dots | `interest` | leasing `viewing_scheduled`, `viewing_completed`; sales `viewing` |
| `negotiation` | Negotiation | Переговоры | in_process | pipeline | `#FDE68A` | `#78350F` | none | `in_negotiation` | leasing `negotiation` |
| `loi` | LOI | LOI | in_process | pipeline | `#FCD34D` | `#78350F` | diagonal | `in_negotiation` | leasing `loi_terms` |
| `contract_draft` | Contract Draft | Проект договора | in_process | pipeline | `#FDBA74` | `#7C2D12` | diagonal | `contracting` | leasing `contract_draft`; sales `contract` (only while the unit is still marketable, see §5) |
| `sale_negotiation` | Sale Negotiation | Переговоры о продаже | in_process | pipeline | `#99F6E4` | `#134E4A` | diagonal | `in_negotiation` | sales `offer`, `negotiation`, `reservation_deposit` |

Notes:

- Lead and Viewing appear in Table 2b because `00_MASTER_PROMPT.md §12` lists them, but with the default threshold (§3) they are shown on the plan only if the threshold is lowered in Settings; with defaults, sub-threshold prospects are shown as an "in process" marker on the inventory color (`00_MASTER_PROMPT.md §14.1` "in process").
- The palette above is a proposal (A-05-3): light fills for statuses that carry text labels, a saturated fill only for `sold`. Each pair was chosen to pass the §18 contrast check (≥ 4.5:1 between `color` and `textColor`).
- CASE OS keeps its own status colors in `pf()` (`os/core.js` line 2681: `vac #f0f0f0, neg #e4eefb, off #fdeaea, os #e0f2f1, cs #fff3e0, cd #e7f4e8, res #efe7fb`). They are not reused because CASE OS colors encode deal stage and inventory in one scale.

---

## 3. Derived pipeline stage and display status

### 3.1 Definitions (implemented in `js/services.js`, pure functions)

| Term | Definition |
|---|---|
| Open deal | `deal.status === 'open'` (see §6 for the status vocabulary) and the deal's stage has `type: 'open'`. |
| Deals of a unit | Open deals whose `unitIds` contains `unit.id`. A unit with n open deals has n prospects (`00_MASTER_PROMPT.md §6.4`). |
| Stage order | `order` of the stage inside its own pipeline (`leasingStages` for `deal.type === 'leasing'`, `salesStages` for `'sales'`). Orders are only compared within one pipeline. |
| Top deal | Among the unit's open deals: highest `order`; tie → highest `probability`; tie → latest `dateEnteredStage`; tie → smallest `id`. Deterministic so that plan, table and dashboard agree (`00_MASTER_PROMPT.md §3.5`). |
| Negotiation threshold | `pipeline.negotiationThresholdStage[dealType]` — a stage key per pipeline. Default `leasing: 'negotiation'`, `sales: 'negotiation'` (D6; see Q-05-2). A deal "qualifies" when `order(stage) >= order(threshold)`. |
| Derived pipeline stage | `unitPipelineStage(unit)` = stage of the top deal, or `null`. Never stored. |
| Display status | `unitDisplayStatus(unit)` = the status entry used for the plan color, the unit table badge, the drawer header and the client portal (after client mapping). |

### 3.2 Rule

```text
unitDisplayStatus(unit):
  inv   = unitStatuses[unit.commercialStatus]          // inventory entry; missing -> 'unknown'
  open  = openDealsOfUnit(unit)                        // may be empty
  top   = topDeal(open)                                // per 3.1
  if inv.marketable and top exists
     and order(top.stage) >= order(threshold[top.type])
     and stage(top).displayStatusKey exists:
        return { key: stage(top).displayStatusKey, source: 'derived', dealId: top.id,
                 prospects: open.length }
  return { key: inv.key, source: 'inventory', dealId: top ? top.id : null,
           prospects: open.length, inProcess: open.length > 0 }
```

- `inProcess: true` with `source: 'inventory'` renders the "in process" marker (a small count badge / outlined dot in the unit label, `06_FLOORPLAN_ARCHITECTURE.md`) without changing the fill color. This is how `00_MASTER_PROMPT.md §14.1` "in process" is shown.
- The KPI bucket "Under negotiation" uses the same threshold: a unit that is not leased/sold and has ≥ 1 open deal at or above the threshold, **or** whose inventory status has `countsAs: 'pipeline'` (Reserved), is in that bucket (`07_CALCULATIONS_AND_KPI_RULES.md`). Display status and KPI bucket therefore never disagree.
- A `leasing_and_sales` unit may have leasing and sales deals at the same time; the tie rules above apply across both lists, using each deal's own pipeline order and probability.
- Changing the threshold in Settings re-renders everything immediately (no stored value to migrate).

### 3.3 Worked examples

| # | Stored `unit.commercialStatus` | Open deals on the unit | Display status (source) | Plan rendering | Inventory KPI bucket (D6) | Client status |
|---|---|---|---|---|---|---|
| 1 | `available` | Brand A — leasing `viewing_completed` (order 7 < threshold 8) | `available` (inventory), `inProcess: true`, 1 prospect | Available fill + "in process" marker "1" | Available | Available |
| 2 | `available` | Brand A — `viewing_completed`; Brand B — leasing `loi_terms` (order 9 ≥ 8) | `loi` (derived from Brand B), 2 prospects | LOI fill, diagonal pattern, label "LOI · Brand B" | Under negotiation | In Negotiation |
| 3 | `contract_signed` | Brand B — leasing deal at `contract_signed` (status `won`); Brand A — still `viewing_completed` (data error) | `contract_signed` (inventory; not marketable) | Contract Signed fill | Leased | Leased |
| 4 | `temporarily_blocked` | Brand C — leasing `negotiation` (order 8) | `temporarily_blocked` (inventory; not marketable), `inProcess: true` | Blocked hatch + marker | Unavailable / Other | Not Available |
| 5 | `reserved` | Brand D — sales `reservation_deposit` | `reserved` (inventory) | Reserved fill, diagonal | Under negotiation (`countsAs: 'pipeline'`) | In Negotiation |

Example 3 and 4 also produce Data hygiene rows ("leased unit with open deals", "blocked unit with active negotiation"; `00_MASTER_PROMPT.md §33` "inconsistent unit status") so that the team either closes the stale deal or corrects the status. In example 2 the unit's GLA is counted once in "Under negotiation"; the two deals are counted separately in deal-centric pipeline metrics, which are labelled as such (D6).

---
## 4. Leasing stages (`leasingStages[]`)

FACT: `00_MASTER_PROMPT.md §22` lists sixteen initial leasing stages, requires them to be configurable, requires a reason on Closed Lost and forbids treating a deal as financially complete before the configured commission condition is met.

Field definitions (one entry of `leasingStages[]` / `salesStages[]`):

| Field | Meaning |
|---|---|
| `key`, `order`, `label {en, ru}`, `active` | As in §2. `order` is the rank used by §3 and by Kanban column order. |
| `type` | `'open'` (counts in the open pipeline) \| `'won'` (commercially won: signed) \| `'post-signing'` (administrative follow-through after signing; still "signed" for KPIs) \| `'lost'`. |
| `defaultProbability` | 0–100, seeded into `deal.probability` on entering the stage unless the user overrode probability manually (`deal.probabilityOverridden: true`). Used only for weighted pipeline value of `open` stages (`07_CALCULATIONS_AND_KPI_RULES.md`). |
| `displayStatusKey` | Derived status (§2 Table 2b) shown on marketable units when the stage is at or above the threshold; `null` for `won`/`post-signing`/`lost` stages because the unit's inventory status carries the meaning by then. |
| `requiresLostReason` | True only on Closed Lost. |
| `setsUnitStatusSuggestion` | Inventory status key proposed (never applied silently) for every linked unit when a deal enters the stage (§6). |
| `commissionRelevant` | True from the signing stage onward: the commission block becomes editable and its completeness is checked. |
| `clientStatus` | Portal mapping of the **deal** when it is listed as a client-approved key deal (§8); units use the status mapping. |
| `sets` | Side effects on `deal.outcome` / `deal.status` (§6). |

### Table 4 — Leasing stages (defaults)

| order | key | Label EN | Label RU | type | prob. | displayStatusKey | requiresLostReason | setsUnitStatusSuggestion | commissionRelevant | clientStatus |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `lead` | Lead | Лид | open | 5 | `lead` | no | — | no | `interest` |
| 2 | `contacted` | Contacted | Контакт установлен | open | 10 | `lead` | no | — | no | `interest` |
| 3 | `qualified` | Qualified | Квалифицирован | open | 15 | `lead` | no | — | no | `interest` |
| 4 | `requirement_confirmed` | Requirement Confirmed | Требование подтверждено | open | 20 | `lead` | no | — | no | `interest` |
| 5 | `unit_offered` | Property / Unit Offered | Помещение предложено | open | 30 | `lead` | no | — | no | `interest` |
| 6 | `viewing_scheduled` | Viewing Scheduled | Просмотр назначен | open | 35 | `viewing` | no | — | no | `interest` |
| 7 | `viewing_completed` | Viewing Completed | Просмотр проведён | open | 40 | `viewing` | no | — | no | `interest` |
| 8 | `negotiation` | Negotiation | Переговоры | open | 50 | `negotiation` | no | — | no | `in_negotiation` |
| 9 | `loi_terms` | LOI / Commercial Terms | LOI / коммерческие условия | open | 65 | `loi` | no | — | no | `in_negotiation` |
| 10 | `contract_draft` | Contract Draft | Проект договора | open | 80 | `contract_draft` | no | — | no | `contracting` |
| 11 | `contract_signed` | Contract Signed | Договор подписан | won | 100 | — | no | `contract_signed` | yes | `leased` |
| 12 | `tenant_handover` | Tenant Handover / Opening Preparation | Передача помещения / подготовка к открытию | post-signing | 100 | — | no | `fit_out` | yes | `leased` |
| 13 | `commission_pending` | Commission Pending | Комиссия ожидается | post-signing | 100 | — | no | — | yes | `leased` |
| 14 | `commission_received` | Commission Received | Комиссия получена | post-signing | 100 | — | no | — | yes | `leased` |
| 15 | `closed_won` | Closed Won | Закрыта (успех) | won | 100 | — | no | `occupied` | yes | `leased` |
| 16 | `closed_lost` | Closed Lost | Закрыта (отказ) | lost | 0 | — | **yes** | — | no | — |

Probability defaults are a proposal (Q-05-3). For reference, the CASE OS seed (`os/sql/schema_mysql.sql`, `deal_stage_probabilities`) is `neg 20, off 40, res 35, os 65, cs 85, cd 100`; its keys map to LSP stages as `off → unit_offered`, `neg → negotiation`, `os → loi_terms`, `cs → contract_draft`, `cd → contract_signed`, and `res` → unit status `reserved` with the deal left at `loi_terms` (import adapter rule, `08_PERSISTENCE_IMPORT_EXPORT.md`). CASE OS values are not adopted as defaults because in CASE OS `neg` is the first stage after vacancy, while in LSP `negotiation` is stage 8 of 16.

---

## 5. Sales stages (`salesStages[]`)

FACT: `00_MASTER_PROMPT.md §23` requires a separate sales pipeline with sixteen stages, forbids forcing leasing-only fields into sales deals, and requires that a project or unit can be configured as leasing only, sales only, or leasing and sales.

### Table 5 — Sales stages (defaults; same columns as Table 4)

| order | key | Label EN | Label RU | type | prob. | displayStatusKey | requiresLostReason | setsUnitStatusSuggestion | commissionRelevant | clientStatus |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `lead` | Lead | Лид | open | 5 | `lead` | no | — | no | `interest` |
| 2 | `contacted` | Contacted | Контакт установлен | open | 10 | `lead` | no | — | no | `interest` |
| 3 | `qualified_buyer` | Qualified Buyer | Квалифицированный покупатель | open | 15 | `lead` | no | — | no | `interest` |
| 4 | `requirement_confirmed` | Requirement Confirmed | Требование подтверждено | open | 20 | `lead` | no | — | no | `interest` |
| 5 | `unit_offered` | Property / Unit Offered | Помещение предложено | open | 30 | `lead` | no | — | no | `interest` |
| 6 | `viewing` | Viewing | Просмотр | open | 35 | `viewing` | no | — | no | `interest` |
| 7 | `offer` | Offer | Ценовое предложение | open | 45 | `sale_negotiation` | no | — | no | `in_negotiation` |
| 8 | `negotiation` | Negotiation | Переговоры | open | 55 | `sale_negotiation` | no | — | no | `in_negotiation` |
| 9 | `reservation_deposit` | Reservation / Deposit | Бронь / задаток | open | 70 | `sale_negotiation` | no | `reserved` | no | `in_negotiation` |
| 10 | `contract` | Contract | Договор купли-продажи | won | 100 | `contract_draft` | no | `sold` | yes | `contracting` |
| 11 | `payment_in_progress` | Payment In Progress | Оплата в процессе | post-signing | 100 | — | no | — | yes | `sold` |
| 12 | `payment_completed` | Payment Completed | Оплата завершена | post-signing | 100 | — | no | `sold` | yes | `sold` |
| 13 | `commission_pending` | Commission Pending | Комиссия ожидается | post-signing | 100 | — | no | — | yes | `sold` |
| 14 | `commission_received` | Commission Received | Комиссия получена | post-signing | 100 | — | no | — | yes | `sold` |
| 15 | `closed_won` | Closed Won | Закрыта (успех) | won | 100 | — | no | `sold` | yes | `sold` |
| 16 | `closed_lost` | Closed Lost | Закрыта (отказ) | lost | 0 | — | **yes** | — | no | — |

Stage keys are shared between the two lists where the meaning is the same (`lead`, `contacted`, `requirement_confirmed`, `unit_offered`, `negotiation`, `commission_pending`, `commission_received`, `closed_won`, `closed_lost`); a deal's `type` always says which list applies, and `order` is never compared across lists (§3.1). Q-05-4 asks the founder to confirm that a unit becomes `sold` at `contract` (recommended) rather than at `payment_completed`.

### 5.1 Fields by deal type (`00_MASTER_PROMPT.md §24`; field ownership in `03_DATA_MODEL.md`)

| Group | Leasing-only (`deal.type === 'leasing'`) | Sales-only (`deal.type === 'sales'`) | Both |
|---|---|---|---|
| `deal.commercialTerms` | `askingRent`, `proposedRent`, `agreedRent`, `serviceCharge`, `turnoverRent`, `rentFreePeriod`, `fitOutPeriod`, `leaseTerm`, `indexation`, `rentUnit` | `askingPrice`, `offerPrice`, `agreedPrice`, `paymentSchedule`, `plannedClosingDate`, `pricePerM2` | `deposit`, `currency`, `vatTreatment`, `termsHistory[]` (D20 deviations) |
| `deal.outcome` | `signedDate` (lease) | `signedDate` (sale contract), `paymentDate` | `won`, `lost`, `lostReason`, `lostReasonNote`, `commissionStatus` |
| Unit terms shown in the deal form | `unit.leasingTerms` | `unit.salesTerms` | `unit.area`, `unit.targetUse` |
| Value basis for pipeline value | annualised rent (`agreedRent` → `proposedRent` → `askingRent`, D20 precedence, `07_CALCULATIONS_AND_KPI_RULES.md`) | `agreedPrice` → `offerPrice` → `askingPrice` | stage probability |
| Completeness check (`00_MASTER_PROMPT.md §40`) | "commercial terms" = at least one rent figure with `rentUnit` and `currency` | "commercial terms" = at least one price figure with `currency` | responsible manager, contact, stage, next action, linked unit/project |

The deal form renders only the column that matches `deal.type`; `services.dealFieldSet(type)` returns the list so that the form, CSV export and completeness indicator agree. On a `leasing_and_sales` unit, the deal type is chosen at creation and cannot be changed after the first stage change (a new deal is created instead; history stays clean).

`commercialModes` (project and unit): `['leasing', 'sales', 'leasing_and_sales']` (A-05-5 for the field name). The "New deal" action offers only the types allowed by the unit's mode; the unit status picker offers only statuses whose `commercialModes` include the unit's mode (Table 2a).

---

## 6. Stage transition rules and guards

All rules are implemented in `services.moveDealToStage(dealId, toStageKey, ctx)` (pure; returns `{ok, blocked:[…], prompts:[…], effects:[…]}`) and executed by `state.js` writers; Kanban drag/drop, the deal detail form and the AI tool registry all call the same function (`00_MASTER_PROMPT.md §25` "never create separate duplicate data stores"; D12).

### 6.1 Deal status vocabulary

| `deal.status` | Set when | Meaning |
|---|---|---|
| `open` | creation; any move to a stage with `type: 'open'` | Counts in open pipeline, in §3 and in stale rules. |
| `won` | first entry into a `won` or `post-signing` stage (leasing `contract_signed`, sales `contract`) | `outcome.won = true`, `outcome.signedDate` defaults to today (editable). Counted as signed. |
| `lost` | entry into `closed_lost` | `outcome.lost = true`, `outcome.lostReason` required. |

`deal.outcome.complete` (boolean, derived, never stored) = status `won` **and** (`pipeline.dealCompleteRequiresCommissionReceived === false` **or** `commission.status ∈ {received, waived, not_applicable}`). Reports label deals as "signed" vs "complete" separately (`00_MASTER_PROMPT.md §22` last paragraph).

### 6.2 Rules

| # | Rule | Default / config key | Behaviour |
|---|---|---|---|
| T1 | Any forward or backward move between stages is allowed. | `pipeline.allowBackwardMoves: true` | Every move writes one `statusHistory` record (`SH-nnn`: `entityType: 'deal'`, `entityId`, `field: 'stage'`, `from`, `to`, `by`, `at`, `note`) and updates `deal.dateEnteredStage`. Backward moves may require a note (`pipeline.requireNoteOnBackwardMove`, default `false`). Skipping stages is allowed; the history shows the jump. |
| T2 | Closed Lost requires a reason. | stage `requiresLostReason` | The move dialog blocks until `lostReason` (a key from `lostReasons[]`) is chosen; `lostReasonNote` is required when the reason has `requiresNote: true`. An activity of type `client_decision` is written. |
| T3 | Entering the signing stage prompts unit status and actual use. | stage `setsUnitStatusSuggestion`; `pipeline.applyUnitStatusSuggestion: 'prompt'` | For each linked unit the dialog proposes: (a) `commercialStatus` → suggestion (`contract_signed` / `sold`), pre-checked; (b) `actualUse.brandId = deal.brandId`, `tenantName`, `category`, `subcategory` copied from the brand classification, pre-checked; (c) `leaseStart` / `openingDate` (leasing) or `plannedClosingDate` (sales) from the deal terms. Unchecked items are not applied. Applied items write their own `statusHistory` rows (`entityType: 'unit'`). Setting `'never'` disables the prompt; `'auto'` is not offered in v0.1 (silent side effects contradict `00_MASTER_PROMPT.md §3.5` audit expectations). |
| T4 | Competing prospects on the same unit are prompted, not closed silently. | `pipeline.competingProspectsOnWin: 'prompt'` | The signing dialog lists the unit's other open deals and offers "Close as lost — reason `other_prospect_selected`" per deal (default checked) or "Keep open" (e.g. a multi-unit deal that continues on its other units). |
| T5 | Provenance is required on agreed terms at signing (D16). | `provenance.requiredAtSigning: true` | `agreedRent` (leasing) or `agreedPrice` (sales) must have a `provenance` record with `conf: 'verified'`, `src: 'deal'`, `how: 'document'`; the dialog collects it. Missing provenance blocks the move unless the setting is `false`. |
| T6 | Commission stages validate the commission record. | stage `commissionRelevant` | `commission_pending`: warns (does not block) when `commission.grossCommission` is empty; sets `commission.status` to `pending` if it was `not_applicable`. `commission_received`: blocks unless `commission.receivedAmount` and `commission.receivedDate` are filled; sets `commission.status = 'received'` (or `partially_received` when `receivedAmount < grossCommission`, with a warning). |
| T7 | Closed Won honours the configurable completion rule (`00_MASTER_PROMPT.md §6.6`). | `pipeline.dealCompleteRequiresCommissionReceived: true` | With `true`: entry into `closed_won` is blocked unless `commission.status ∈ {received, waived, not_applicable}`; setting `waived` or `not_applicable` on a deal requires `head_ls` or `founder_admin` (`04_ROLES_AND_VISIBILITY.md`). With `false`: `closed_won` is always allowed and the report shows "commission outstanding" next to the deal. |
| T8 | Reopening. | `pipeline.reopen.fromLostRoles: ['manager','head_ls','founder_admin']`, `pipeline.reopen.fromWonRoles: ['head_ls','founder_admin']` | From `closed_lost` to any `open` stage: clears `outcome.lost`, keeps the previous `lostReason` in history, writes `statusHistory` with `note: 'reopened'`. From `won`/`post-signing` back to an `open` stage: allowed only for the listed roles; the dialog asks whether to revert the unit status (never automatic) and sets `deal.status = 'open'`, `outcome.won = false`. Commission records are never deleted by a reopen; `commission.status` is set to `pending` if it was `received` and the user confirms. |
| T9 | Stage aging. | `staleRules.dealStageAgingDays` | `dateEnteredStage` is the only input; a backward move resets it like any other move. |
| T10 | Kanban drag/drop uses the same function. | — | A drop that returns `blocked` snaps the card back and opens the dialog with the blocking reason (`00_MASTER_PROMPT.md §25`: drag/drop only if it "records history"). |
| T11 | Multi-unit deals. | — | T3 and T4 iterate over `deal.unitIds`; the dialog shows one row per unit. Removing a unit from a signed deal requires a note and writes history on both records. |
| T12 | Role guard. | `04_ROLES_AND_VISIBILITY.md` | `manager` may move only deals where they are responsible or supporting; `administrator` may move any deal except into `won`/`post-signing` stages without a responsible manager set; `client` never moves deals. |

Every guard produces a user-readable message from `data/i18n.js` (keys `pipeline.guard.*`); the AI tool `moveDealToStage` (future write tool) returns the same messages in its envelope.

---

## 7. Lost reasons (`lostReasons[]`)

FACT: `00_MASTER_PROMPT.md §22` lists ten "possible reasons". Two are added for the workflows in §6 (T4) and the sales pipeline; additions are marked.

| key | Label EN | Label RU | appliesTo | requiresNote | Source |
|---|---|---|---|---|---|
| `rent_too_high` | Rent too high | Ставка слишком высокая | leasing | no | §22 |
| `price_too_high` | Price too high | Цена слишком высокая | sales | no | added (sales analogue of the above) |
| `wrong_location` | Wrong location | Не подходит локация | leasing, sales | no | §22 |
| `area_too_large` | Area too large | Площадь слишком большая | leasing, sales | no | §22 |
| `area_too_small` | Area too small | Площадь слишком маленькая | leasing, sales | no | §22 |
| `project_timing` | Project timing | Сроки проекта | leasing, sales | no | §22 |
| `competitor_selected` | Competitor selected | Выбран конкурирующий объект | leasing, sales | no | §22 |
| `internal_brand_decision` | Internal brand decision | Внутреннее решение бренда | leasing, sales | no | §22 |
| `no_response` | No response | Нет ответа | leasing, sales | no | §22 |
| `terms_rejected` | Terms rejected | Условия отклонены | leasing, sales | no | §22 |
| `other_prospect_selected` | Another prospect selected for the unit | Помещение отдано другому арендатору / покупателю | leasing, sales | no | added (T4) |
| `other` | Other | Другое | leasing, sales | **yes** | §22 |

Rules: the lost-reason picker shows only reasons whose `appliesTo` includes `deal.type`; `other` cannot be deactivated (it is the fallback for imports); the "Lost reasons" internal report (`00_MASTER_PROMPT.md §37`) groups by key and shows notes for `other`. CASE OS refusal reasons are free text (`os/core.js` `CA_REFUS`, e.g. "не отвечает", "не интересует локация", "финансово не готовы"); the import adapter maps the recognisable ones (`не отвечает → no_response`, `локац → wrong_location`, `финанс → rent_too_high`) and the rest to `other` with the original text as `lostReasonNote`, using `aliases` on each reason entry (D21).

---

## 8. Client status mapping (`clientStatusMap`) — `00_MASTER_PROMPT.md §36`

Owners do not need the internal vocabulary, and several internal states must collapse into one word for them. The mapping is configurable and covers **both** inputs, because the client-facing status of a unit is produced by the same derivation as the internal display status (§3): first the deal stage of the highest-ranked open deal on a marketable unit, otherwise the inventory status.

### Table 8a — Inventory status → client status

| Inventory status | Client status | Note |
|---|---|---|
| `vacant`, `available`, `marketing` | Available | The owner does not distinguish marketing effort from raw vacancy. |
| `reserved` | In Negotiation | A deposit is commercially a negotiation, not a lease. |
| `contract`, `fitout`, `occupied` | Leased | One word for everything after signature. |
| `forsale` | For Sale | Sales mandate only. |
| `sold` | Sold | |
| `blocked`, `notavailable`, `unknown` | Not available | The reason is internal; the owner sees only that the unit is out of the market. |

### Table 8b — Deal stage → client status (applies only to marketable units)

| Leasing stages | Sales stages | Client status |
|---|---|---|
| `lead`, `contacted`, `qualified`, `requirement`, `offered`, `viewsched`, `viewdone` | `lead`, `contacted`, `qualified`, `requirement`, `offered`, `viewing` | Interest |
| `negotiation`, `loi` | `offer`, `negotiation`, `reservation` | In Negotiation |
| `draft` | `contract`, `payprog` | Contracting |
| `signed`, `handover`, `commpend`, `commrecv`, `won` | `paydone`, `commpend`, `commrecv`, `won` | Leased / Sold |
| `lost` | `lost` | falls back to the inventory status |

**Rules.** The client vocabulary is a closed list (`clientStatuses`): `Available`, `Interest`, `In Negotiation`, `Contracting`, `Leased`, `For Sale`, `Sold`, `Not available`. A commission stage must never reach the owner as the word "commission": `commpend` and `commrecv` map to `Leased` / `Sold` (the owner's interest ends at signature). The portal and the client report both read this mapping through `svcClientStatus()` — no renderer maps statuses on its own.

**A-05-4.** "Interest" is deliberately vague: telling an owner that three brands are at "Viewing Completed" invites pressure on a negotiation that is not ready. Q-05-6 asks whether the owner should instead see the count of interested brands per unit.

---

## 9. Merchandise categories and subcategories (`categories[]`, `subcategories{}`) — A-3, D15, D21

Defaults are the master prompt list (§14.2: Fashion, F&B, Services, Entertainment, Grocery, Beauty, Electronics, Office, Other) extended with the five categories that the CASE OS taxonomy proves are needed in this market: Home & Interior, Sports, Kids & Education, Health / Pharmacy, and a distinct Grocery / Anchor.

| Key | Label (EN) | Label (RU) | Default colour | CASE OS aliases mapped on import (D21) |
|---|---|---|---|---|
| `fashion` | Fashion | Мода и стиль | `#c86b8a` | Мода и стиль; Fashion & apparel |
| `fnb` | F&B | Общественное питание | `#e08a4b` | Места общественного питания; Еда и напитки |
| `services` | Services | Услуги | `#7aa6c2` | Услуги, киоски, спец. магазин; Услуги |
| `entertain` | Entertainment | Развлечения | `#9b7ec4` | Развлечение; Развлечения |
| `grocery` | Grocery / Anchor | Продукты / якорь | `#6aa84f` | Супермаркет / гипермаркет; Продукты |
| `beauty` | Beauty | Красота | `#d98cb3` | Парфюмерия и косметика; Красота и здоровье |
| `electronics` | Electronics | Электроника | `#5b8ec4` | Электроника, бытовая техника |
| `home` | Home & Interior | Дом и интерьер | `#b08968` | Мебель и товары для дома |
| `sports` | Sports | Спорт | `#4fae9c` | Спортивная одежда и товары |
| `kids` | Kids & Education | Дети и образование | `#e0b84b` | Игрушки, книги, канцтовары и хобби |
| `health` | Health / Pharmacy | Здоровье / аптека | `#78b6a4` | Аптека; Медицина |
| `office` | Office | Офисы | `#8d99ae` | Офисы; Офис |
| `other` | Other | Прочее | `#bdb7ae` | Прочее; Вспомогательные и тех. помещения |

**Alias resolution** (`catByAlias()`): exact key, then label, then any entry of `aliases[]`, all case-insensitive and trimmed. An unmatched value maps to `other` and the import preview reports it by name and count, so nothing is silently reclassified. Subcategories are a free list per category (`subcategories[categoryKey]`), used as suggestions rather than a constraint: a subcategory that a user types is kept even when it is not in the list, because the alternative is that people stop recording it.

**Colour rule.** Category colours must remain distinguishable from status colours in the plan legend. The merchandise-mix mode and the status mode are never shown together (§14 of the master prompt: "Do not mix unrelated meanings in one colour system"), which is why the same hue may legitimately appear in both palettes.

---

## 10. Stale rules and thresholds (`thresholds{}`) — `00_MASTER_PROMPT.md §41`

| Key | Default | Meaning | Consumer |
|---|---|---|---|
| `negotiationStage` | `negotiation` | Lowest stage rank at which a unit counts as "under negotiation" in inventory KPIs | `svcInventory()` (07 §2) |
| `displayStage` | `offered` | Lowest stage rank at which the plan shows the deal stage instead of the inventory status | `svcDisplayStatus()` (§3) |
| `staleDealDays` | 21 | Open deal with no activity for this many days is stale | dashboard, activity report |
| `staleBrandDays` | 60 | No contact with a brand for this many days | brand list, brand card |
| `staleTermsDays` | 120 | Unit commercial terms not updated for this many days | data hygiene |
| `mandateWarnDays` | 90 | Mandate expiry warning window | dashboard banner |
| `provAmberDays` | 90 | Provenance record turns amber (D16) | provenance chips |
| `provRedDays` | 180 | Provenance record turns red (D16) | provenance chips |

**FACT (`00_MASTER_PROMPT.md §41`).** Thresholds belong in Settings; none of them may be hard-coded in a renderer. **A-05-5.** 21 days for a stale deal is a working default for a leasing cycle in Tashkent, not a measured figure; the first month of use should replace it with the observed median gap between contacts.

**Two rules that keep staleness honest.** A deal with no recorded activity at all is stale from creation, not exempt. Changing a stage counts as activity only when it is accompanied by a contact date, because moving a card does not mean anyone spoke to the brand.

---

## 11. Commission rules (`commission{}`) — `00_MASTER_PROMPT.md §38`, §6.6

| Key | Default | Meaning |
|---|---|---|
| `leasePercentOfAnnualRent` | 8 | Default gross commission on a leasing deal |
| `salePercentOfPrice` | 2 | Default gross commission on a sale |
| `completionRule` | `commission_received` | What "financially complete" means: `contract_signed` \| `payment_completed` \| `commission_received` |
| `requiredForClosedWon` | `true` | Whether Closed Won is blocked until the completion rule is satisfied |
| `managerSeesOwnShare` | `false` | Whether a manager sees their own share (Q-04-3) |
| `shares` | company 60, manager 30, administrator 5, externalAgent 5 | Default distribution in per cent, must total 100 |

**FACT (`00_MASTER_PROMPT.md §6.6`).** Commission receipt may be a required completion condition, but it must be configurable — the platform must not hard-code one permanent financial rule. The default here is the master prompt's own §22 position (a deal is not financially complete until commission conditions are satisfied) expressed as a setting that the founder can change in one place.

**Visibility** is governed by `04_ROLES_AND_VISIBILITY.md`, not here: `founder_admin` sees gross and shares, `head_ls` sees gross and the company share, `manager` sees own share only when `managerSeesOwnShare` is true, `administrator` sees status only, and `external_agent` and `client` see nothing. The commission record itself is defined in `03_DATA_MODEL.md`.

**Validation.** Shares must sum to 100; the Settings screen refuses a distribution that does not, because a silently unbalanced split produces a report nobody can reconcile.

---

## 12. Currencies, areas, rents and VAT (`currency{}`, `units{}`)

| Key | Default | Allowed values |
|---|---|---|
| `currency.default` | `USD` | `USD`, `UZS`, `EUR` |
| `currency.rentUnit` | `USD/m2/month` | `USD/m2/month`, `USD/m2/year`, `UZS/m2/month` |
| `units.area` | `m2` | `m2` only in v0.1 |
| `vatTreatment` | `Unknown` | `Inclusive`, `On top`, `Exempt`, `Unknown` |

**No FX conversion in v0.1 (Q-02-9).** A value is stored with its currency and displayed in it. Mixing currencies in one total is refused rather than converted at an invented rate: the KPI shows the dominant currency and a note naming the excluded records. CASE OS shows sums "in soums at the Central Bank rate" for reporting; adopting that requires a dated rate table, which is a production feature.

**Money precision (D20).** All monetary values are rounded to cents on write (`cents()`), because `18 400 × 2.5 × 1.35` in double arithmetic yields `62100.00000000001`, and that value would otherwise reach a contract.

---

## 13. Notification rules (`notifications{}`) — `00_MASTER_PROMPT.md §45`

Notifications in the prototype are **computed lists, not stored messages**: every rule is a query over current data, so a notification cannot become stale or duplicated.

| Rule | Condition | Where it appears |
|---|---|---|
| Overdue tasks | `status ≠ Done` and `dueDate < today` | Dashboard, nav badge on Tasks |
| Due today | `dueDate = today` | Dashboard, nav badge |
| Client comments awaiting response | `authorType = client` and `status ≠ Resolved` | Dashboard, nav badge on Client portal |
| Stale deals | §10 `staleDealDays` | Dashboard, activity report |
| Deals without next action | open deal, `nextAction.text` empty | Dashboard, data hygiene |
| Mandate expiry | `mandateExpiryDate − today ≤ mandateWarnDays` | Dashboard banner, scoped to the selected project |
| Missing documents | deal at or beyond LOI / Contract without a document of that category | Data hygiene |
| Report due | configurable day of month per project (`reportDayOfMonth`, default 5) | Dashboard (v0.2) |

**A-05-6.** No email, push or browser notifications exist and none are simulated (§45: "Use local data only").

---

## 14. Document types and visibility defaults (`documentTypes[]`) — `00_MASTER_PROMPT.md §30`

Types: Floor plan, Brochure, Presentation, Commercial terms, Owner instruction, Tenant proposal, LOI, Contract, Invoice, Report, Photo, Technical document, Other.

| Type | Default visibility | Reason |
|---|---|---|
| Brochure, Presentation, Floor plan, Report, Photo | `client_visible` | Marketing and reporting material the owner is meant to have |
| Commercial terms, Tenant proposal, LOI, Contract, Technical document, Owner instruction, Other | `internal` | Negotiation material; sharing is a decision, not a default |
| Invoice | `restricted` | Commission and fee documents |

Defaults are editable per type in Settings and overridable per document. The registry stores metadata only; `08_PERSISTENCE_IMPORT_EXPORT.md` §10 states the storage limits and the prohibition on claiming secure storage.

---

## 15. Activity types and comment statuses — §28, §29

**Activity types** (`activityTypes[]`): Call, Meeting, Viewing, Email note, Messenger note, Proposal sent, Document uploaded, Stage change, Status change, Client comment, Internal comment, Task completed, Client decision.

Stage change, Status change, Document uploaded and Task completed are written by the system; the rest are entered by people. System-written activities are not editable, because an audit trail that can be rewritten is not an audit trail.

**Comment statuses** (`commentStatuses[]`): `Open` → `In Review` → `Resolved`. A client comment enters as `Open`; an internal reply moves it to `In Review`; only an internal user may set `Resolved`. Every comment carries author, timestamp, related object, visibility and status (§29).

**Note kinds.** `notes.internal[]` and `notes.clientVisible[]` are separate arrays on projects and units, never one field with a flag, so a rendering mistake cannot leak an internal note.

---

## 16. Tasks (`taskPriorities[]`, `taskStatuses[]`) — §27

Priorities: `Low`, `Normal`, `High`. Statuses: `Open`, `Done`. Tasks additionally carry `visibility` (`internal` by default, `client_visible` when the step is meant for the owner report).

**This field exists because of a defect found in testing.** The owner report listed open tasks for the project, one of which read "Issue commission invoice for Silverpoint Bank". An internal task title is internal wording; the client report now includes only tasks explicitly marked `client_visible`, and the Tasks screen labels those "shared with the owner" so the author knows.

---

## 17. `DEFAULT_CONFIG` skeleton (`js/config.js`)

```javascript
var DEFAULT_CONFIG = {
  unitStatuses:   [ /* §2: key, label, countsAs, availabilityGroup, color, ink, pattern, clientStatus, marketable */ ],
  leasingStages:  [ /* §4: key, rank, label, prob, type, color, clientStatus */ ],
  salesStages:    [ /* §5: same shape */ ],
  lostReasons:    [ /* §7: key, label, appliesTo, isFallback, aliases */ ],
  categories:     [ /* §9: key, label, color, aliases */ ],
  subcategories:  { /* §9: categoryKey -> [labels] */ },
  clientStatuses: ['Available','Interest','In Negotiation','Contracting','Leased','For Sale','Sold','Not available'],
  clientStatusMap:{ /* §8: statusKey -> clientStatus, stageKey -> clientStatus */ },
  thresholds: {
    negotiationStage:'negotiation', displayStage:'offered',
    staleDealDays:21, staleBrandDays:60, staleTermsDays:120,
    mandateWarnDays:90, provAmberDays:90, provRedDays:180
  },
  commission: {
    leasePercentOfAnnualRent:8, salePercentOfPrice:2,
    completionRule:'commission_received', requiredForClosedWon:true,
    managerSeesOwnShare:false,
    shares:{ company:60, manager:30, administrator:5, externalAgent:5 }
  },
  currency: { default:'USD', rentUnit:'USD/m2/month', list:['USD','UZS','EUR'] },
  documentTypes:  [ /* §14 */ ],
  activityTypes:  [ /* §15 */ ],
  commentStatuses:['Open','In Review','Resolved'],
  taskPriorities: ['Low','Normal','High'],
  taskStatuses:   ['Open','Done'],
  visibilityLevels:['internal','client_visible','restricted','public'],
  notifications:  { reportDayOfMonth:5 },
  configVersion: 1
};
```

`appState.settings` holds the working copy. `CONFIG()` returns `appState.settings` when it is populated and `DEFAULT_CONFIG` otherwise, so a state file written before a config key existed still renders. `configVersion` is migrated alongside `meta.schemaVersion` (`08_PERSISTENCE_IMPORT_EXPORT.md` §4).

---

## 18. Settings UI requirements and validation — `00_MASTER_PROMPT.md §44`

| Requirement | Rule |
|---|---|
| Keys are immutable | A key is stored in data records; renaming it would orphan every record that uses it. Labels and colours are editable, keys are not. |
| Nothing in use may be deleted | Deleting a status, stage or category that records reference is refused. The dialog shows the count and offers reassignment to another key first. |
| `countsAs` and `availabilityGroup` are not free text | They are chosen from the fixed vocabulary of §2, because KPI code branches on them. |
| Colour contrast | Label ink is computed from the chosen colour (`contrastInk()`), so a user cannot produce an unreadable label. A warning appears when two statuses are given near-identical colours. |
| Stage ranks stay ordered | Reordering rewrites `rank` in one transaction; duplicate ranks are refused, because "highest open stage" would become ambiguous. |
| Probability range | 0–100; a stage of type `lost` is forced to 0 and `won` to 100. |
| Commission shares | Must total 100 %. |
| Thresholds | Positive integers; `provAmberDays < provRedDays`; `displayStage` rank ≤ `negotiationStage` rank, otherwise the plan would show a stage the KPI does not count. |
| Reset | "Reset to defaults" restores `DEFAULT_CONFIG` and never touches data records. |
| Audit | Every change writes an `auditLog` entry with the key, the old and the new value. |
| Who may edit | `founder_admin` all sections; `head_ls` stages, lost reasons, categories, client status mapping, thresholds, notification rules; nobody else (`04_ROLES_AND_VISIBILITY.md`, Q-04-5). |

### 18.1 Divergences in the v0.1 prototype to reconcile

The built prototype (`os/leasing/index.html`) uses shorter keys in three places than the tables above. They are functionally identical but must be reconciled before any data is exchanged with another build.

| This document | Prototype v0.1 | Action |
|---|---|---|
| `competitor_selected` | `competitor` | Adopt the prototype key or add it as an alias (D21) |
| `internal_brand_decision` | `brand_decision` | As above |
| `other_prospect_selected` | not present | Add to the prototype in Phase 4 |
| `clientStatusMap` as a separate map | `clientStatus` field on each status and stage entry | Either is acceptable; the field form is simpler and is recommended as canonical |

### 18.2 Open questions

| id | Question | Recommendation | Owner |
|---|---|---|---|
| Q-05-5 | Should `reserved` count as "under negotiation" or as its own KPI bucket? | Under negotiation: a reservation without a signature is not committed area. | Head of Leasing & Sales |
| Q-05-6 | Should the owner see how many brands are interested in a unit? | Yes as a count, never as names, and only from `offered` upward. | Founder / product sponsor |
| Q-05-7 | Should `fitout` be a separate status or an attribute of `contract`? | Separate: the owner asks when a signed unit will open, and fit-out is the answer. | Head of Leasing & Sales |
| Q-05-8 | Default commission percentages (8 % leasing, 2 % sales) — confirm against the firm's fee model. | Confirm before the first internal report is shown to anyone outside the team. | Founder / product sponsor |

---

Cross-references: `00_MASTER_PROMPT.md` (§6.3, §6.6, §12, §14, §22, §23, §24, §27, §28, §29, §30, §36, §38, §41, §44, §45, §62), `02_REQUIREMENTS_REVIEW.md` (C-1 status vs stage, C-4 commission completion), `03_DATA_MODEL.md` (fields these keys are stored in), `04_ROLES_AND_VISIBILITY.md` (Settings rights, commission visibility), `06_FLOORPLAN_ARCHITECTURE.md` (colour and legend rendering), `07_CALCULATIONS_AND_KPI_RULES.md` (`countsAs`, thresholds), `08_PERSISTENCE_IMPORT_EXPORT.md` (config migration, alias mapping on import), `10_QA_PLAN.md` (configuration tests), `13_CASE_OS_v4731_REUSE.md` (provenance thresholds D16), and the implemented configuration in `os/leasing/index.html` (`DEFAULT_CONFIG`).
