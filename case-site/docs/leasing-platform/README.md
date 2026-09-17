# CASE OS · Leasing & Sales Platform (LSP) — architecture and implementation plan

**Status: planning package v1 — awaiting sponsor approval (2026-09-17)**

---

## Кратко по-русски

**Что это.** Проект отдельной платформы отдела аренды и продаж: CRM, база проектов и
помещений, интерактивные планировки, воронки аренды и продаж, база брендов, задачи,
документы, портал собственника, отчёты. Здесь — архитектура, план работ и проверочный
прототип, который уже работает.

**Что уже можно потрогать.** `os/leasing/index.html` — рабочий прототип. Открывается
двойным щелчком с диска, живёт и на хостинге по адресу `/os/leasing/`. Ни один файл
действующей CASE OS не изменён. 98 автоматических проверок проходят.

**Главное решение, которое нужно от вас (D1).** Строить платформу как **отдельный модуль
рядом с CASE OS**, а не переделывать ядро. Причина фактическая: в CASE OS один статус
помещения совмещает состояние площади и этап сделки, сделка привязана к одному помещению,
нет базы компаний и контактов, нет входа для собственника. Переделка ядра на 976 КБ
рабочего кода при ручном обновлении сайта — риск для действующей системы.

**Три правила, на которых всё держится.** Статус помещения — это инвентарь, этап — это
сделка. Площадь помещения считается один раз, сколько бы претендентов на него ни было.
Неизвестное не равно нулю: помещение без площади исключается из сумм и показывается
отдельной строкой.

**Что дальше.** Утвердить шесть решений из раздела «Approval checklist» ниже — и работа
идёт по фазам из `09_IMPLEMENTATION_PLAN.md`. Остальные вопросы (их 81) уже снабжены
рекомендациями: если возражений нет, они принимаются по умолчанию.

**Важное замечание по хозяйству.** Репозиторий отстаёт от боевого сайта на 22 релиза
(в git v4.51.0, на сайте v4.73.1). Стоит отдельно положить рабочую папку `os/` в
репозиторий — без `api/config.php`. Диск хостинга занят на 1.89 из 1.95 ГБ.

---

## Executive summary

The Leasing & Sales Operating Platform is specified here as **LSP**, a self-contained
module at `os/leasing/` that ships beside CASE OS without modifying it. Twelve documents
cover the product scope, a critical review of the requirements, the data model, roles and
visibility, the configuration layer, the floor-plan architecture, the calculation rules,
persistence, the implementation plan, QA, a licence and security audit of every external
repository the brief named, and the AI and ecosystem architecture.

A working prototype exists and is committed: role-aware login, dashboard, projects and
units, interactive floor plans with real clickable polygons in five modes, leasing and
sales pipelines, brand and contact database, tasks, documents, merchandise mix, owner
reports with print, the client portal, settings, import and export, and a deterministic
tool registry. It opens from disk and runs under the existing Content-Security-Policy.

Three invariants are enforced in code rather than described in prose: unit status carries
inventory state while deal stage lives on deals; a unit's area is counted once however
many prospects compete for it; and a missing value is excluded and reported rather than
treated as zero. The automated suite proves each of them.

Two defects were found and fixed by that suite: the login form ignored the Enter key after
a user card was picked, and the owner report published internal task titles, one of which
named a commission invoice.

---

## Document index

| File | Purpose | Master prompt §69 item |
|---|---|---|
| `00_MASTER_PROMPT.md` | The source requirements, as supplied | — |
| `01_PRODUCT_SPEC.md` | The MVP restated as a product specification | 1 |
| `02_REQUIREMENTS_REVIEW.md` | Contradictions, conflicts with CASE OS, risks, scope trims | 2 |
| `03_DATA_MODEL.md` | Entities, IDs, relationships, integrity rules, CASE OS mapping | 3 |
| `04_ROLES_AND_VISIBILITY.md` | Role capability matrix, visibility levels, client view model | 4 |
| `05_STATUSES_STAGES_AND_CONFIG.md` | Unit statuses, pipeline stages, the whole configuration layer | 5 |
| `06_FLOORPLAN_ARCHITECTURE.md` | SVG model, versioning, modes, drawer, mapping wizard | 6 |
| `07_CALCULATIONS_AND_KPI_RULES.md` | Dashboard formulas and the anti-double-counting rules | 7 |
| `08_PERSISTENCE_IMPORT_EXPORT.md` | Local storage, migrations, recovery, JSON and CSV exchange | 8 |
| `09_IMPLEMENTATION_PLAN.md` | Module structure, thirteen phases, definition of done, gates | 9 |
| `10_QA_PLAN.md` | Test catalogue for every §64 flow and §65 check | 10 |
| `11_REPOSITORY_AUDIT.md` | Licence and security audit of all 27 referenced repositories | §61 |
| `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` | Tool registry, permissions, Geoanalytics and Building OS hooks | §66 G |

Working software: `os/leasing/` (prototype and its README). Tests:
`docs/qa/tools/lsp_e2e.js`, results in `docs/qa/lsp/`. Project skills:
`.claude/skills/` (21 skills named in §56).

---

## Decision log

| id | Decision | Why | Status |
|---|---|---|---|
| D1 | LSP is a separate module at `os/leasing/`, not a rewrite of CASE OS core | Status conflation, one-unit deals, no company or contact CRM, no client login; core.js is 976 KB of production code deployed by hand | **Needs approval** |
| D2 | Small clean file structure, no build step, no runtime dependencies | Must open from disk and run under the existing CSP | Adopted |
| D3 | English base with Russian shipped from day one | Planning glossary is English, the team works in Russian | **Needs approval (A-1)** |
| D4 | Demo data is fictional and flagged | Never present demo figures as client data | Adopted (A-2) |
| D5 | Unit status is inventory only; stage lives on deals; display status is derived | Resolves the contradiction between §6.3 and §12 | Adopted |
| D6 | Inventory counts each unit once; pipeline is deal-based and says so | §6.4, §6.5 | Adopted |
| D7 | Six roles and four visibility levels with a whitelist client view | §31, §35 | Adopted |
| D8 | Versioned SVG plans with polygon mappings, five modes | §13, §14, §16 | Adopted |
| D9 | Four local storage keys, schema version, backup slot, recovery screen | §46 | Adopted |
| D10 | QA follows CASE OS conventions (Playwright, results JSON) | Reuses what the team already runs | Adopted |
| D11 | LSP version is independent; CASE OS version untouched | Avoids forcing a CASE OS release | Adopted |
| D12 | Provider-independent tool registry with a permission check | §51–§53 | Adopted |
| D13 | Stable prefixed IDs plus `externalIds` for the ecosystem | §49 | Adopted |
| D14 | Dense professional UI, inline SVG charts, no external assets | §48 | Adopted |
| D15 | Master prompt categories extended with five the market needs | §14.2 | Adopted (A-3) |
| D16 | Provenance model ported from CASE OS v4.71.0 | Confidence never averaged upward; ageing always visible | Adopted |
| D17 | Ask palette is deterministic, over the closed tool registry | Owner rule: no external AI services | Adopted |
| D18 | Released as an add-on zip that drops into any CASE OS version | Hosting disk is nearly full; manual upload | **Needs approval** |
| D19 | All data-driven text set through `textContent` | The v4.70.3 stored-XSS lesson | Adopted |
| D20 | Money to cents; every manual override recorded with a reason | The v4.67.0 deviation pattern | Adopted |
| D21 | Taxonomies carry aliases and a normalise function | The v4.68.0 pattern; makes imports reliable | Adopted |
| D22 | CASE OS role DIR maps to `head_ls` | Same rights minus administration | Adopted |

Assumptions are labelled A-1 to A-3 (package-wide) and A-nn-n (per document). Open
questions are labelled Q-nn-n and carry a recommendation and an owner in each document.

---

## Approval checklist

These six decisions block the start of work. Everything else has a recommendation that is
adopted by default unless the sponsor objects.

- [ ] **Positioning (D1, Q-01-1, Q-02-8).** Build LSP at `os/leasing/`, shipped with the
      `os/` folder and reachable at `caseadvisory.uz/os/leasing/`, not linked from the CASE
      OS menu. Alternative: keep it outside `os/` so it is never deployed, at the cost of
      the team testing only from local files.
- [ ] **Data during validation (Q-02-5).** No real operational deals are entered into LSP.
      Testing uses fictional demo data or a CASE OS backup imported on one laptop. CASE OS
      remains the record of the business.
- [ ] **What happens to the prototype (Q-09-1).** The prototype is one file; the plan calls
      for a module structure. Recommendation: rebuild to that structure in Phase 0, keeping
      the prototype's demo data, plans and logic, so there is one source of truth.
- [ ] **Interface language (D3, Q-01-2).** English base with complete Russian, or Russian
      first to match CASE OS.
- [ ] **Commission model (Q-05-8, Q-02-2).** Confirm 8 % of annual rent and 2 % of sale
      price, and that a deal counts as complete only when commission is received. These
      defaults must match the firm's fee model before any internal report circulates.
- [ ] **Packaging and the repository gap (D18, Q-09-5, Q-09-7).** Release LSP as its own
      add-on zip, and commit the live CASE OS v4.73.1 `os/` folder to the repository first
      (without `api/config.php`), since git is 22 releases behind the live site.

The remaining 81 questions across the twelve documents are answered with a recommendation
each. They are listed in their own documents under "Open questions", grouped by owner:
Founder / product sponsor for scope, money and data governance; Head of Leasing & Sales
for operational definitions.

---

## Not built in v0.1

No backend, no production authentication, no cloud storage, no payments, no real file
storage, no automatic recognition of PDF, raster or CAD drawings, no language model, no
Asset Management, Facility Management or Building OS modules, and no external agent
workspace. The data model leaves room for each of them; the prototype claims none of them.

---

## Project skills

Twenty-one skills under `.claude/skills/`, one per role named in §56:
`leasing-product-architect`, `cre-operations-analyst`, `crm-data-modeler`,
`property-and-unit-data-engineer`, `interactive-floorplan-engineer`,
`merchandise-mix-analyst`, `leasing-pipeline-analyst`, `sales-pipeline-analyst`,
`commercial-real-estate-financial-analyst`, `brand-and-market-researcher`,
`data-quality-and-provenance`, `client-portal-permissions`,
`reporting-and-dashboard-analyst`, `document-and-file-registry`,
`local-storage-and-import-export`, `geoanalytics-integration-architect`,
`building-os-architecture`, `ai-tool-designer`, `ai-safety-and-permissions`,
`frontend-ux-engineer`, `testing-and-qa`.

Each states its purpose, inputs, outputs, constraints, a validation checklist, prohibited
behaviour and examples, and defers to its neighbours where responsibilities meet.

---

## Next step after approval

Phase 0 of `09_IMPLEMENTATION_PLAN.md` starts on the working branch. Progress is reported
per phase against the definition of done, with five formal gates. Every phase ends with the
test suite green; a phase that cannot pass its own checks is not finished.
