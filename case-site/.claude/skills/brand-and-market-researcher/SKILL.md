---
name: brand-and-market-researcher
description: Brand knowledge rules for LSP (os/leasing/) — brand records per master prompt §18 (classification, expansionRequirements, relationship.source, history), minimal requirement records (§21), deterministic brand-to-unit matching with per-criterion explanations (§39), provenance of every brand fact and market statement, fictional demo brands and the BRANDS-to-brands half of the CASE OS import. Use for "brand profile", "brand database", "expansion requirements", "requirement record", "suggested brands for unit", "suggested units for brand", "matching score", "brand source", "benchmark", "demo brands" or the brand screens in js/views/crm.js. Never fabricates brand facts.
---

## Purpose

The brand database is "a long-term proprietary company asset" (`00_MASTER_PROMPT.md` §18). This skill
keeps it trustworthy inside LSP: every brand record has structured requirements, a stated source and a
history; brand-to-unit matching is deterministic and explains itself (§39); nothing about a brand or a
market is asserted without a source. It also keeps demo brands fictional (brief D4) so that the prototype
never carries the firm's real brand base.

## Responsibilities

- Brand record semantics (§18): define what each field means and how it is filled —
  `classification.category` / `subcategory` from the merchandise categories in `js/config.js` (D15),
  `priceSegment`, `format`, `brandType`; `expansionRequirements.minimumAreaM2 / preferredAreaM2 /
  maximumAreaM2` in m², `targetRentRange` stored with currency and rent unit (Q-02-9), `targetCities`,
  `targetProjects` (project IDs), `floorPreference`, `frontageRequirement`, `fitOutRequirements`,
  `openingTimeline`; `relationship.ownerId` (internal user), `relationship.source`, `lastContactDate`,
  `nextFollowUpDate`; `history.*` arrays kept in sync with deals (rejected projects and reasons come from
  Closed Lost deals, written by the deal service owned by `leasing-pipeline-analyst`).
- Requirement records (§21; `02_REQUIREMENTS_REVIEW.md` T-6): a minimal `requirements` record (`REQ-001`)
  on a brand or company describing what is sought before a unit exists; matching uses the requirement when
  present, otherwise `brand.expansionRequirements`.
- Matching (§39, T-13): `suggestBrandsForUnit(unitId)` and `suggestUnitsForBrand(brandId)` in
  `js/services.js` — a deterministic score over the §39 criteria (category, subcategory, area, floor,
  frontage, project location / city, target merchandise mix, rent budget, format, accessibility); weights
  in `config.matching`; each result carries `explanations: [{criterion, result: 'match' | 'mismatch' |
  'unknown', detail}]`; every UI surface labels the output "Suggestions, not recommendations".
- Provenance of brand facts: a brand created from research has `relationship.source` filled and the source
  repeated in `notes.internal` or an activity; operating countries, formats, area needs and expansion
  plans are recorded as stated by the source, never inferred. Market statements in planning documents
  (rents, footfall, brand presence in Uzbekistan) cite a source or are labeled ASSUMPTION (A-n).
- Brand search (§43) and CRM filters (§26: brand, company, category, subcategory, source):
  `searchBrands()`, `searchCompanies()`, `searchContacts()` (§52 names) returning typed results such as
  "Name — Brand — context".
- CASE OS import, brand half (D1): the field mapping `BRANDS` → `brands` (plus `companies` derived from
  `group` and the inline `person / phone / email` → `contacts`), the `BRANDST` → brand status mapping,
  and use of the CASECATS → D15 category table owned by `merchandise-mix-analyst`; presented as a
  RECOMMENDATION table for `03_DATA_MODEL.md` until approved.
- Demo brands (D4, §47): about 24 fictional brands across at least 8 categories, about 10 companies (one
  company owning several brands), about 30 contacts (at least one contact linked to two brands), several
  requirement records; every record `demoRecord: true`.
- Brand completeness semantics (§40: category, contacts, expansion requirements, last contact, owner)
  handed to `data-quality-and-provenance`, which owns the rule engine.
- Hand-offs: `brands` / `companies` / `contacts` / `requirements` schemas, ID generation and referential
  integrity → `crm-data-modeler`; category taxonomy, `categoryGap()` and the CASECATS mapping table →
  `merchandise-mix-analyst`; duplicate warnings, completeness and stale rules →
  `data-quality-and-provenance`; rent budget vs asking rent arithmetic and currencies →
  `commercial-real-estate-financial-analyst`; what a client may see of a brand →
  `client-portal-permissions`; tool registration → `ai-tool-designer`; screens, chips, i18n →
  `frontend-ux-engineer`; import pipeline and CSV column mapping → `local-storage-and-import-export`;
  tests → `testing-and-qa`.

## Inputs

Planning documents (`docs/leasing-platform/`):
- `00_MASTER_PROMPT.md` §18–§21, §26, §39, §40, §43, §47, §51 (example requests), §52, §63 screens
  10–14, §64 Flow 5, §65 "CRM".
- `02_REQUIREMENTS_REVIEW.md` C-6 (requirement / lead / opportunity / deal / prospect vocabulary), C-16
  (sales counterparty), T-6, T-13, X-3, X-9, A-02-3; `03_DATA_MODEL.md` (brand, company, contact and
  requirement fields, CASE OS mapping); `05_STATUSES_STAGES_AND_CONFIG.md` (categories, brand status
  list, matching config); `07_CALCULATIONS_AND_KPI_RULES.md` (rent budget comparison);
  `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (tool names).

LSP sources (`os/leasing/`, once they exist):
- `js/config.js` (`merchandiseCategories`, `matching` weights, brand status list, price segments,
  formats), `js/services.js` (search and matching — the only place for matching logic),
  `js/views/crm.js` (Brand Database, Brand Detail, Companies, Contacts, Requirements), `data/demo.js`,
  `data/i18n.js`, `js/tools.js` (registration only).

CASE OS read-only references (never edited, never copied into demo data):
- `os/core.js`: `brand()` factory (line 489: `logo, shopfront, interior, founded, group, price, icsc,
  netPts, netCountries, uzOp, about, pos, concept, rec, contacts, owner, tier, lastContact, presence,
  areaVariants, reviewFlag, editedBy, editedAt, hist`), `BRANDS` (line 490 onward — real brands),
  `CASECATS` (line 506), `BRANDST` (line 2785: active, contacted, target, inactive, refused).
- `os/sql/schema_mysql.sql`: `brands`, `brand_requests` (a requirement-like table with `area_min,
  area_max, budget_max, preferences, stage, source, visibility`), `benchmarks`, `refusals`.
- `os/data/case_brands_base.xlsx` — proprietary; its existence is a fact, its content is never opened
  into LSP.
- Firm methodology skills, when loaded in the session (`case-leasing`, `case-market-research`), are a
  source for method, not for brand facts; cite them as such.

## Outputs

- `js/config.js` entries: `matching` (criteria with weight, unit and "unknown" handling), brand `status`
  values, `priceSegments`, `formats`, `brandTypes` — all editable in Settings (§44).
- Pure functions in `js/services.js` attached to `window.LSP` and `module.exports` (D10):
  `searchBrands`, `searchCompanies`, `searchContacts`, `suggestBrandsForUnit`, `suggestUnitsForBrand`
  (§52 names), plus a proposed helper `matchScore(source, unit, ctx)` returning
  `{score, maxScore, explanations}`.
- Demo brand, company, contact and requirement records in `data/demo.js` (D4).
- The `BRANDS` → `brands` mapping table (every CASE OS field → LSP field, or "dropped (reason)") and the
  `BRANDST` → brand status mapping for `03_DATA_MODEL.md`.
- Worked matching examples and named test cases `LSP-QA-nnn` for `10_QA_PLAN.md`.
- Chat answers structured as FACTS (cite `00_MASTER_PROMPT.md §n` or the CASE OS file) / ASSUMPTIONS
  (A-n) / RECOMMENDATIONS, with open items as Q-n and an owner.

## Constraints

- D4 / A-2, X-9: demo brands, companies and contacts are fictional. The CASE OS `BRANDS` array holds real
  brands with real claims (expansion notes, co-tenancy, contacts); neither names nor claims are copied into
  `os/leasing/` or into planning documents as examples.
- §39: matching is deterministic (same input → same order), rule-based, explained and never presented as
  a guarantee; no probabilistic model, no LLM, no network (D12).
- §69 / D6: a missing input is `unknown`, not a mismatch and not zero — a brand without an area range
  scores `unknown` on area and the explanation says so.
- D15 / A-3: categories are config; matching, filters and demo data read `config.merchandiseCategories`;
  no category names inside views.
- D7: `brand.visibility` defaults to `internal`; `notes.internal`, `contactIds` and
  `expansionRequirements` never reach `clientView(projectId)`; a client sees a brand name only on a
  client-approved key deal — decided by `client-portal-permissions`.
- §18 phone formatting: one normalisation function shared with contacts (digits with a leading `+`,
  default country code +998 — RECOMMENDATION, owner Head of Leasing & Sales); stored value normalised,
  display formatted.
- Brand `status`: §18 gives only `"Active"`; the full list is an open item (Q-n, owner Head of Leasing &
  Sales); the CASE OS `BRANDST` keys are the precedent to present, recorded in
  `05_STATUSES_STAGES_AND_CONFIG.md`.
- Market data: no rents, yields, footfall, catchment or brand-presence figures are invented; CASE OS
  `benchmarks` / `BENCH` are not imported in v0.1 unless approved (Q-n, owner Founder).
- D1 / D11 / D13: no CASE OS file is modified; LSP lives in `os/leasing/`; IDs are `BRAND-001`,
  `COMP-001`, `CONT-001`, `REQ-001`; UI strings go through `t(key)` in EN and RU (D3).
- No production, backend or security claims; the exact vocabulary of the brief and master prompt is used.

## Validation checklist

- [ ] Every demo brand has `demoRecord: true`, a fictional name and a `classification.category` present
      in `config.merchandiseCategories`; at least 8 categories are covered.
- [ ] Every filled `expansionRequirements` satisfies `minimumAreaM2 ≤ preferredAreaM2 ≤ maximumAreaM2`
      (m²); `targetRentRange` carries currency and rent unit.
- [ ] `suggestBrandsForUnit` / `suggestUnitsForBrand` return a sorted list with `score`, `maxScore` and
      `explanations`; two calls on the same state give the same order; `unknown` criteria are listed,
      not silently skipped.
- [ ] Matching weights exist only in `js/config.js`; views contain no numeric weights or category names.
- [ ] `searchBrands` finds by `name` and `legalName`; results show object type and context (§43).
- [ ] Flow 5 passes end to end: search → brand profile → contacts → requirements → create deal
      (opportunity) → link project/unit → follow-up task.
- [ ] Companies are separate from brands: one demo company owns ≥ 2 brands; no company is created per
      brand (§19); one demo contact is linked to ≥ 2 brands (§65).
- [ ] Every brand created from research has `relationship.source`; every market statement in a document
      cites a source or carries an A-n label.
- [ ] The `BRANDS` → `brands` mapping table covers all CASE OS brand fields; `BRANDST` values map to
      LSP brand statuses; unmapped fields state the reason.
- [ ] `git status` shows no change outside `os/leasing/`, `docs/leasing-platform/`, `docs/qa/lsp/`,
      `docs/qa/tools/lsp_*.js`, `.claude/skills/`; nothing from `case_brands_base.xlsx` appears anywhere.
- [ ] Node tests for matching and search are handed to `testing-and-qa` with `LSP-QA-nnn` ids.

## Prohibited behavior

- Inventing brand facts: expansion plans, area needs, rent budgets, formats, presence in Uzbekistan or
  any other market, decision makers, contact details.
- Copying real brand names, contacts or notes from `os/core.js` `BRANDS` or
  `os/data/case_brands_base.xlsx` into demo data, tests or documents.
- Presenting matching output as a recommendation, ranking with hidden weights, or hard-coding weights in
  views.
- Treating a missing requirement field as zero or as a mismatch; dropping brands with incomplete data from
  results without saying so.
- Storing matching results or scores in `appState` (they are derived).
- Creating a company per brand, or storing contact data inline on the brand (the CASE OS
  `person / phone / email` pattern).
- Network calls, external APIs, scraping or LLM calls from LSP.
- Writing entity schemas, duplicate detection, portal filtering or money arithmetic (sister skills own
  them).
- Editing `os/core.js`, `os/v*.js`, `os/sql/`, `os/api/`, `os/index.html`, `os/sw.js`.

## Examples

1. Prompt: "Implement suggestBrandsForUnit for UNIT-014 and show it in the unit drawer."
   Expected: `matchScore()` over `config.matching` criteria using the unit's `area.glaM2`, `floorId`,
   `targetUse.category`, project city and `leasingTerms.askingRent` against each brand's requirement (or
   `expansionRequirements`); returns sorted `{brandId, score, maxScore, explanations}`; a drawer section
   titled "Suggested brands (suggestions, not recommendations)" listing match / mismatch / unknown per
   criterion; a Node test with a brand lacking an area range that shows `unknown`.
2. Prompt: "Add six more F&B demo brands with contacts."
   Expected: fictional names, `demoRecord: true`, category from config, clearly invented but internally
   consistent requirements, companies reused where one group owns several brands,
   `relationship.source: 'demo'`, one contact shared with an existing brand; no real brand referenced;
   IDs generated through the `crm-data-modeler` rules.
3. Prompt: "Write the BRANDS → brands mapping section for 03_DATA_MODEL.md."
   Expected: FACTS listing the CASE OS fields with file and line; a mapping table (`amin / amax` →
   `minimumAreaM2 / maximumAreaM2`, `reqs` → `fitOutRequirements` text, `coten` → co-tenancy note in
   `notes.general`, `fr` → `brandType`, `group` → derived `companies`, `status` via the `BRANDST` table,
   `uzOp / net_pts / net_countries` → operating data with source "CASE OS import"); dropped fields with
   reasons; ASSUMPTIONS labeled A-n; a Q-n for the brand status list with its owner.
