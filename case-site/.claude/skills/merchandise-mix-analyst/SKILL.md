---
name: merchandise-mix-analyst
description: Implements LSP merchandise-mix logic in os/leasing/js/services.js and js/config.js: category and subcategory configuration (D15 defaults plus the CASECATS mapping table), target vs actual mix by GLA and by unit count, category gaps, vacant and pipeline area by category, the per-unit classes behind the Merchandise mix and Target vs Actual plan modes, and zoning of unit.targetUse in demo data. Use for "merchandise mix", "tenant mix", "target vs actual", "category gap", "zoning", "category mapping", "aggregateMerchandiseMix", "mix section of a report", or edits to merchandise categories in Settings.
---

# merchandise-mix-analyst

## Purpose

Answer, from unit and deal data alone, the questions "what is the current merchandise mix?" and
"how does actual tenant mix compare with target tenant mix?" (00_MASTER_PROMPT.md §2, §17), and
keep Target and Actual strictly separate. The skill owns the category configuration, the mix
calculations, the classification that colors the Merchandise mix and Target vs Actual plan modes,
and the zoning of demo units. No target-mix logic exists in CASE OS (verified: `os/core.js`,
`os/v417-master-plan.js`, `os/v4450-owner-report.js` carry only a unit `cat`/`sub` pair), so this
is new logic built on the LSP model.

## Responsibilities

- Category configuration in `DEFAULT_CONFIG` (`js/config.js`, schema per
  `05_STATUSES_STAGES_AND_CONFIG.md`): key, EN/RU label, color, textColor, pattern,
  subcategories; the D15 default list; editable in Settings (§17, §44) with rename-safe keys.
- The CASECATS -> D15 mapping table used by the CASE OS import adapter (editable; content below).
- Mix aggregation in `js/services.js` behind the `aggregateMerchandiseMix()` tool (§52):
  scope = project | floor | selected units; basis = `gla` | `units` (§17 switch); per category:
  `targetShare`, `actualShare`, `targetGlaM2`, `actualGlaM2`, `targetUnits`, `actualUnits`,
  gap in percentage points and m², over / under / on-target flag; plus `vacantAreaByCategory`
  (unit-based, by `targetUse.category`), `pipelineAreaByCategory` (deal-based, labeled),
  `unitsWithoutArea`, `unitsWithoutCategory` and the denominator used.
- Definition of ACTUAL: a unit contributes to the actual mix when its `commercialStatus` has
  `countsAs: 'leased'` or `'sold'` in config AND `actualUse.category` is set; leased/sold units
  without a category form a visible "Leased, category unknown" row. Reserved and pipeline units
  are never "actual"; they appear in `pipelineAreaByCategory`.
- Definition of TARGET: the project-level target table defined in `03_DATA_MODEL.md` when it
  exists; otherwise the aggregation of `units[].targetUse` (zoning). Every output states which
  basis was used.
- Per-unit classes consumed by `interactive-floorplan-engineer`: Merchandise mix mode shows
  `actualUse.category` for actual units and `targetUse.category` with the "planned" pattern for
  all others; Target vs Actual mode yields `match | deviation | target_only |
  actual_without_target | uncategorised`, each with its own legend entry and pattern.
- `categoryGap(projectId, category)` as the merchandise criterion for `suggestBrandsForUnit()` /
  `suggestUnitsForBrand()` (§39) — matching itself belongs to `brand-and-market-researcher`.
- Mix rows for the project dashboard, client dashboard (§35), client and internal reports (§37)
  — rendering belongs to `reporting-and-dashboard-analyst`; wording rules belong here.
- Demo zoning (D4, §47): `targetUse` (category, subcategory, `merchandiseRole`) on every demo
  unit and `actualUse` on leased/sold ones, so that at least two categories are under target and
  one over target in Demo City Mall; a demo target table labeled `demoRecord: true`.
- Data-hygiene inputs (§33, §40): "missing category" counts per project, handed to
  `data-quality-and-provenance`.

Hand-offs: unit records, areas and `unitNumber`s -> `property-and-unit-data-engineer`; field
names for the target table and `merchandiseRole` values -> `crm-data-modeler`
(`03_DATA_MODEL.md`); brand `classification.category` and matching -> `brand-and-market-
researcher`; deal-based pipeline area rules and stage threshold -> `leasing-pipeline-analyst` and
`commercial-real-estate-financial-analyst`; plan rendering, legends and patterns ->
`interactive-floorplan-engineer`; what the client may see -> `client-portal-permissions`;
KPI cards and report layout -> `reporting-and-dashboard-analyst`; tool registration ->
`ai-tool-designer`; tests -> `testing-and-qa`.

## Inputs

- `docs/leasing-platform/00_MASTER_PROMPT.md` §2, §5 items 10–11, §11 (`targetUse`,
  `actualUse`), §14.2, §14.3, §17, §33, §34, §35, §37, §39, §40, §44, §51, §52
  (`aggregateMerchandiseMix`), §64 flow 4, §65 "Calculations" (target/actual correct, missing
  values, denominators).
- `docs/leasing-platform/05_STATUSES_STAGES_AND_CONFIG.md` (category schema, `countsAs`),
  `07_CALCULATIONS_AND_KPI_RULES.md` (mix formulas and worked examples), `03_DATA_MODEL.md`
  (`targetUse` / `actualUse`, project target table), `06_FLOORPLAN_ARCHITECTURE.md` (mode
  contracts), `04_ROLES_AND_VISIBILITY.md` (client-visible mix), `08_PERSISTENCE_IMPORT_EXPORT.md`
  (CSV columns, import mapping), `10_QA_PLAN.md`.
- LSP source: `os/leasing/js/config.js`, `js/services.js`, `js/tools.js`, `js/views/settings.js`,
  `js/views/projects.js` (project dashboard mix widget), `js/views/reports.js`,
  `js/views/portal.js`, `data/demo.js`, `data/i18n.js`.
- CASE OS, read-only: `os/core.js` `CASECATS` (line 506, 17 Russian categories), `CATSUBS`,
  `catHex` / `CATPAL` (fuzzy substring palette — not to be ported), demo unit rows 338–342 whose
  categories (`'Еда и напитки'`, `'Торговля'`, `'Офис'`) are NOT in `CASECATS` (proof that the
  import must tolerate unknown labels); `os/v4450-owner-report.js` tabs `areas` / `brands`.
  `os/data/case_brands_base.xlsx` is proprietary and is never read into demo data.

## Outputs

- `DEFAULT_CONFIG` category/subcategory entries and the CASECATS mapping table in `js/config.js`.
- Pure functions in `js/services.js` (browser `window.LSP`, Node `module.exports`, D10):
  `aggregateMerchandiseMix`, `categoryGap`, per-unit mix classification, hygiene counts.
- Settings screen sections for categories, subcategories and the mapping table (with
  `frontend-ux-engineer`), EN/RU strings in `data/i18n.js`.
- `targetUse` / `actualUse` values and the demo target table in `data/demo.js`.
- Node fixtures for `testing-and-qa`: a 6-unit project with one unit without area, one leased
  unit without category, one unit with two open deals of different brand categories, and a
  target table that produces one under- and one over-represented category with known figures.
- A FACTS / ASSUMPTIONS / RECOMMENDATIONS note in the task response whenever a rule is missing
  from the planning documents (cite `00_MASTER_PROMPT.md §n` or the CASE OS file).

## Constraints

- D15 (assumption A-3, needs approval): default categories are Fashion, F&B, Services,
  Entertainment, Grocery, Beauty, Electronics, Office, Other, Home & Interior, Sports, Kids &
  Education, Health/Pharmacy, Anchor Supermarket — editable; never hard-code them in views.
- §17: Target and Actual are separate data; both bases (GLA and unit count) are supported and the
  UI can switch; categories and subcategories are editable.
- D6 / §6.4 / §34: each unit's GLA is counted once per side (target side, actual side); the
  denominator (computed project GLA from units, or leased GLA when explicitly chosen) is shown
  with every percentage; `pipelineAreaByCategory` is deal-based and labeled "deal-based; units
  with several prospects appear more than once"; a unit without area is excluded and counted in
  "n units without area"; missing values are never zero.
- D5: "actual" is decided by `countsAs` from config, never by comparing status label strings.
- Colors and patterns come from config; `#9E0000` is not a category color; category colors must
  remain distinguishable in light and dark themes and are not fuzzy-matched by name.
- No market benchmarks: target shares are project inputs entered by the team or the client; the
  skill never supplies "typical" shares as defaults, and demo targets are labeled demo.
- Client portal (§35, D7): category shares may be `client_visible`; prospect brand names per
  category are shown only when the deal's visibility allows it; rendering goes through
  `clientView(projectId)`.
- Default CASECATS -> D15 mapping (editable in Settings; unknown labels -> `uncategorised` with
  an import warning, never silently "Other"):
  | CASECATS | D15 category | Note |
  |---|---|---|
  | Мода и стиль | Fashion | |
  | Обувь и аксессуары | Fashion | subcategory Footwear & Accessories |
  | Услуги, киоски, спец. магазин | Services | |
  | Парфюмерия и косметика | Beauty | |
  | Игрушки, книги, канцтовары и хобби | Kids & Education | |
  | Ювелирные изделия, очки и бижутерия | Fashion | subcategory Jewellery & Optics |
  | Места общественного питания | F&B | |
  | Развлечение | Entertainment | |
  | Супермаркет / гипермаркет | Anchor Supermarket | Grocery for small formats — review |
  | Электроника, бытовая техника | Electronics | |
  | Мебель и товары для дома | Home & Interior | |
  | Склады / кладовки | Other | subcategory Storage; area treatment to review |
  | Автозапчасти и аксессуары | Other | subcategory Automotive |
  | Спортивная одежда и товары | Sports | |
  | Офисы | Office | |
  | Терраса | Other | subcategory Terrace; usually `area.terraceM2`, review |
  | Вспомогательные и тех. помещения | Other | subcategory Technical; usually non-GLA, review |
- Never modify CASE OS files or read the proprietary brand base; vocabulary is `category`,
  `subcategory`, `targetUse`, `actualUse`, `merchandiseRole`, `targetShare`, `actualShare`, gap.

## Validation checklist

- [ ] Sum of `actualGlaM2` over categories (plus "category unknown") equals leased + sold GLA of
      the scope; sum of `targetGlaM2` equals the target basis total; both totals are displayed.
- [ ] Shares sum to 100 % (±0.1 pp rounding) per side on the chosen basis; the denominator is
      visible next to the percentages.
- [ ] Switching GLA <-> unit count changes the figures, not the category list.
- [ ] A unit with several open deals of different brand categories inflates only
      `pipelineAreaByCategory` (with the deal-based label), never inventory rows.
- [ ] A unit without area is excluded and appears in "n units without area"; a leased unit
      without category appears in "Leased, category unknown", not in Other.
- [ ] Renaming a category in Settings updates plan legend, dashboard and reports without code
      changes; deleting a category in use is blocked with a message.
- [ ] Merchandise mix and Target vs Actual plan modes show legend entries only for classes
      present in config, each with a pattern (Flow 4).
- [ ] CASE OS import fixture with `'Еда и напитки'` produces an `uncategorised` unit plus a
      warning, not an "Other" unit.
- [ ] Client report mix section contains categories and shares only; no internal comments,
      proposed rents or non-visible brand names.
- [ ] Node run of `js/services.js` fixtures passes with the expected known figures.
- [ ] `git diff --stat` shows only `os/leasing/` and assigned docs/QA files.
- [ ] Task response separates FACTS (cited), ASSUMPTIONS (A-n) and RECOMMENDATIONS.

## Prohibited behavior

- Storing a merged "category" on a unit that mixes target and actual meaning.
- Counting a unit's GLA twice within one side of the mix, or counting Reserved / pipeline units
  as actual tenants.
- Treating a missing area or missing category as zero or as "Other".
- Inventing benchmark target shares, footfall or market data; embedding CASE methodology norms
  in code.
- Hard-coding category names, colors or the CASECATS mapping inside views or `floorplan.js`.
- Porting the CASE OS fuzzy `catHex` matching or reading `case_brands_base.xlsx`.
- Sending internal deal terms or non-visible brand names to the client portal or client report.
- Modifying `os/core.js` taxonomies, `CASECATS`, `CATSUBS` or any CASE OS file.

## Examples

1. Prompt: "Show which categories are below target in Demo City Mall." Expected: call
   `aggregateMerchandiseMix({projectId, basis: 'gla'})`, state the target basis (project target
   table) and denominator (computed GLA, with "n units without area"), list categories with
   negative gaps in pp and m², and note that `pipelineAreaByCategory` is deal-based; no
   recommendation is presented as guaranteed.
2. Prompt: "Add a 'Health/Pharmacy' subcategory 'Optics' and re-map the CASE OS jewellery
   category to it." Expected: edit only `DEFAULT_CONFIG` (subcategory under Health/Pharmacy,
   mapping row changed), add EN/RU labels, confirm the Settings screen shows the change, run the
   Node fixture to confirm figures are unchanged for unaffected categories, and record the
   mapping change as an ASSUMPTION for founder approval.
3. Prompt: "Zone the Demo Business Park plinth floor." Expected: set `targetUse` per demo unit
   (F&B at entrances, Services near the lobby, Office above) with `merchandiseRole` values from
   `03_DATA_MODEL.md`, set `actualUse` only on units whose status counts as leased, verify the
   Target vs Actual mode shows at least one `deviation` and one `target_only` unit, and hand the
   unit ids to `interactive-floorplan-engineer` for the demo SVG.
