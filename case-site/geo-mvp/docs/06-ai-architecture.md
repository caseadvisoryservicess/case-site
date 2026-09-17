# 06 – AI action / tool architecture

Brief §65 Step 6. Covers §38–§64 in full, plus the §45/§56 registries and the §63 QA scenarios.

**Precedence.** `00-BUILD-CONTRACT.md` wins over this document; this document wins over
`01-product-spec.md` §5.2 wherever the two disagree on an expected number (the contract already
states that spec figures computed from source district labels are superseded by its §8 oracle).
Every figure quoted below was re-derived from `data/seed.json` and matches `data/oracle.json`.

**Scope of "AI" in this build.** There is no model. `LocalIntentProvider` is a deterministic
keyword/pattern matcher (§54). Everything in this document is designed so that replacing it with
a real LLM is a provider registration, not a refactor (§55). Sections tagged **[ARCH]** are
designed and reachable in code but deliberately not built.

Implementation files (from contract §4):

| file | contains | §30 module |
|---|---|---|
| `src/js/20-ai-tools.js` | tool registry, typed args, access classes, tool runner | 13 |
| `src/js/21-ai-intents.js` | slot extractors, intent catalogue, matcher | 12 |
| `src/js/22-ai-engine.js` | provider adapter, planner, executor, session context, audit log | 11, 15 |
| `src/js/23-ai-panel.js` | prompt UI, six-block response renderer, AI Layers panel, session log | 11, 14 |

---

## 1. Layered architecture (§55)

### 1.1 The layers, and what each one is forbidden to touch

```
                 ┌─────────────────────────────────────────────┐
  User utterance │  23-ai-panel.js      PRESENTATION           │
        ─────────▶  renders Response; never parses, never       │
                 │  calls a tool, never writes GEO.state        │
                 └───────────────┬─────────────────────────────┘
                                 │ GEO.ai.ask(utterance) -> Promise<Response>
                 ┌───────────────▼─────────────────────────────┐
                 │  22-ai-engine.js     INTENT / PLANNING       │
                 │  provider.interpret() -> Plan                │
                 │  executes Plan.steps, assembles Response,    │
                 │  owns session context + audit log            │
                 └───────────────┬─────────────────────────────┘
                                 │ GEO.ai.tools.call(id, args, ctx)
                 ┌───────────────▼─────────────────────────────┐
                 │  20-ai-tools.js      TOOL / FUNCTION         │
                 │  typed args in, typed result out.            │
                 │  NO DOM. NO Leaflet. NO panel modules.       │
                 └───────────────┬─────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┬──────────────────┐
        ▼                        ▼                        ▼                  ▼
   GEO.data              GEO.analytics              GEO.geo            GEO.state.set
   (03-data)             (08-analytics)             (09-geo)           (05-state)
        └────────────────────────┴────────────────────────┴──────────────────┘
                              GEO DATA PLATFORM
```

**Binding import rules, enforced by a build lint (§7.4 below):**

| file | may reference | may **not** reference |
|---|---|---|
| `20-ai-tools.js` | `GEO.data`, `GEO.analytics`, `GEO.geo`, `GEO.schema`, `GEO.quality`, `GEO.filters`, `GEO.search`, `GEO.state.get`, `GEO.state.set` | `document`, `window.L`, `GEO.map`, `GEO.panels.*`, `GEO.charts` (DOM) |
| `21-ai-intents.js` | `GEO.schema`, `GEO.data.districts()`, `GEO.util` | `GEO.state.set`, `GEO.ai.tools.call`, `document`, `GEO.map` |
| `22-ai-engine.js` | `GEO.ai.tools`, `GEO.ai.intents`, `GEO.state`, `GEO.data` | `document`, `GEO.map`, `GEO.panels.*` |
| `23-ai-panel.js` | `GEO.ai.ask`, `GEO.state`, `GEO.charts`, `GEO.dom`, `GEO.i18n` | `GEO.ai.tools.call` (must go through `ask`), `GEO.ai.intents` |

The parser is pure (utterance + context in, Plan out). The tools are the only things that touch
data. Only the tool layer may call `GEO.state.set`. The panel only renders. This is what makes
§59 structural rather than aspirational.

### 1.2 Provider adapter (§55)

```js
/**
 * A provider turns an utterance into a Plan. It never executes anything and never
 * touches state – that is the engine's job. Two provider kinds are anticipated:
 * a synchronous local matcher (now) and an async model call (later).
 */
GEO.ai.providers.register({
  id:            'local',                 // unique
  label:         'Deterministic intent engine (prototype)',
  async:         false,                   // true => interpret() returns a Promise
  canPlanMultiStep: false,                // [ARCH] an LLM may emit >1 dependent step
  interpret:     function (utterance, context) { /* -> Plan | Promise<Plan> */ },
  describeTools: function (registry) { /* -> provider-specific tool schema; unused by local */ }
});

GEO.ai.providers.use('local');            // sets the active provider
GEO.ai.providers.active();                // -> provider object
GEO.ai.providers.list();                  // -> [{id,label,async}]

/** The engine's one call into the provider. Always normalised to a Promise. */
GEO.ai.interpret = function (utterance, context) {
  var p = GEO.ai.providers.active();
  return Promise.resolve(p.interpret(utterance, context));
};
```

`describeTools()` exists because a real LLM provider needs the registry rendered as a
function-calling schema. `20-ai-tools.js` exposes `GEO.ai.tools.schema()` which emits a
JSON-Schema-shaped description of every registered tool from its own `args` declaration – so the
schema can never drift from the implementation. The local provider ignores it. **[ARCH]**

### 1.3 The `Plan` object

```js
Plan = {
  intent:        'competitors.radius',     // intent id from the catalogue (§3), or 'fallback.*'
  matchScore:    0.92,                     // 0–1 parser match strength. NOT data confidence.
  slots:         { radiusKm: 3, subjectRef: 'pronoun' },
  resolved:      { subjectId: 'BC-82f0eb0b80b7' },   // slots resolved against session context
  unresolved:    [],                       // slot names the parser could not fill
  steps: [
    { id: 's1', tool: 'getProperty',        args: { id: { $: 'resolved.subjectId' } } },
    { id: 's2', tool: 'getNearbyProperties',args: { id: { $: 'resolved.subjectId' }, radiusKm: { $: 'slots.radiusKm' } } },
    { id: 's3', tool: 'getCompetitiveSet',  args: { id: { $: 'resolved.subjectId' }, radiusKm: { $: 'slots.radiusKm' } } },
    { id: 's4', tool: 'createRadius',       args: { id: { $: 'resolved.subjectId' }, bandsKm: [3] } },
    { id: 's5', tool: 'createMapLayer',     args: { name: '…', recordIds: { $: 's2.recordIds' }, /* … */ } }
  ],
  explain:       'Competitors within 3 km of the selected property.',
  responseTemplate: 'competitors.radius',  // key into the template table (§5.4)
  requiresConfirmation: false,
  scope:         'lastResult' | 'filtered' | 'all'   // which row set the plan runs against (§4.3)
};
```

**Argument binding.** Any arg value of the form `{ $: 'path' }` is resolved at execution time
against `{ slots, resolved, s1, s2, … }`, where `sN` is the `data` object returned by step `N`.
Resolution is a plain dotted-path lookup; an unresolvable path aborts the plan with
`code:'BAD_ARGS'` naming the path. This is the only dynamic mechanism in the executor – there is
no expression language, because an expression language in a plan produced by a model is an
injection surface.

**Why the UI must never depend on the engine implementation.** `23-ai-panel.js` knows exactly two
things: `GEO.ai.ask(utterance) -> Promise<Response>` and the shape of `Response` (§5). It does
not know whether a provider is synchronous, whether a plan had one step or nine, or whether the
intent came from a regex or a model. Three consequences follow, and all three are why the seam is
drawn here rather than lower:

1. `ask()` is always a Promise even though the local provider answers in under 5 ms. A panel that
   branched on sync/async would have to be rewritten the day a network provider is registered.
2. The panel renders only `Response`. Adding an intent, a tool or a whole provider adds no panel
   code.
3. Progress reporting is event-driven (`GEO.on('ai:stage', …)`, §9), not derived from knowing what
   the engine is doing. A provider that emits no stage events simply renders no strip.

### 1.4 `ask()` – the single entry point

```js
/**
 * @param  {string} utterance
 * @param  {object} [opts]  { role, dryRun:boolean, confirm:string }
 * @return {Promise<Response>}   NEVER rejects. Errors become Response.outcome === 'error'.
 */
GEO.ai.ask = function (utterance, opts) { … };
```

`ask()` never rejects. A thrown parser or tool error is caught, logged to the audit trail and
returned as a rendered `Response` with `outcome:'error'` – because in a single-file prototype an
uncaught rejection is an invisible failure during a user test, which is a lost finding (X-E12).

---

## 2. Tool registry (§45, §56)

### 2.1 Registration and invocation

```js
GEO.ai.tools.register({
  id:        'calculateAverageRent',
  label:     'Average asking rent',        // i18n key ai.tool.calculateAverageRent
  access:    'external',                   // 'external' | 'internal'   (§60)
  cls:       'read',                       // 'read' | 'view' | 'produce' | 'egress' | 'persist'
  mutates:   false,                        // true for cls 'view' | 'persist'
  confirm:   false,                        // true => requires ctx.confirmed before running
  tag:       'CALCULATED',                 // default provenance tag of its result (§6)
  args: {                                  // declarative; validated before run()
    recordIds: { type:'idList', required:false, of:'record' },
    filters:   { type:'filterPatch', required:false },
    groupBy:   { type:'enum', values:['district','class',null], default:null }
  },
  run: function (args, ctx) { /* -> ToolResult */ }
});

GEO.ai.tools.call(id, args, ctx);   // validates args, checks access, checks confirm, runs, times
GEO.ai.tools.get(id);
GEO.ai.tools.list(role);            // tools callable by that role
GEO.ai.tools.schema();              // [ARCH] function-calling schema for an LLM provider
```

`ctx` = `{ role, rows, state, turnId, confirmed:boolean, audit }`. `ctx.rows` is the working set
the engine resolved for this turn (§4.3) – a tool never calls `GEO.data.workingSet()` itself, so
demo-mode containment (D4) is decided once per turn, not per tool.

### 2.2 Result envelope (every tool, without exception)

```js
// success
{ ok:true,  tool:'…', data:{…},
  meta:{ inN:148, outN:12, ms:0.8, tag:'PLATFORM_DATA', datasets:['observed'],
         coverage:{ field:'officeClass', n:16, N:148 } | null,
         containsDemo:false } }

// failure – a first-class outcome, not an exception
{ ok:false, tool:'…', code:'INSUFFICIENT_DATA',
  message:'GLA is recorded for 0 of 148 properties.',
  detail:{ field:'gla', n:0, N:148, requires:'recorded GLA per building',
           alternatives:[{label:'…', utterance:'…'}] } }
```

**Error codes (closed set).**

| code | meaning | engine behaviour |
|---|---|---|
| `INSUFFICIENT_DATA` | coverage gate failed (§4.4) | `outcome:'refused'`, previous state untouched, alternatives offered |
| `NOT_FOUND` | id / district / property does not exist | `outcome:'clarify'`, names the nearest matches |
| `BAD_ARGS` | arg validation or `$`-path resolution failed | `outcome:'error'`, logs the arg name; never reaches the user as a stack trace |
| `FORBIDDEN` | `access:'internal'` called with `role:'external'` | `outcome:'refused'`, §8 message |
| `NEEDS_CONFIRMATION` | `confirm:true` and `ctx.confirmed !== tool.id` | `outcome:'confirm'`, renders the confirm chip row |
| `NOT_IN_PROTOTYPE` | `cls:'persist'` | `outcome:'refused'`, exact string A13 (§8.4) |
| `EMPTY_RESULT` | valid query, zero matching records | `outcome:'answered'` with the E-02/E-08 empty state – **not** an error |

`EMPTY_RESULT` is deliberately separated from `INSUFFICIENT_DATA`: "no building matches" is a
fact about the market, "the field is not recorded" is a fact about our data collection. Collapsing
them is the exact confusion §36 exists to prevent.

### 2.3 The registry – read tools

All read tools are pure: no `GEO.state.set`, no confirmation, callable by `external`.

| # | id (§56 name where applicable) | args | returns (`data`) |
|---|---|---|---|
| R1 | `searchProperties` | `{query:string, limit:int=20, fields:['name','address','districtKey','tenants']}` | `{matches:[{id,name,score,matchedOn,districtKey}], n}` – uses `GEO.search` (T9 transliteration both ways) |
| R2 | `filterProperties` | `{filters:FilterPatch, scope:'all'\|'filtered'\|'lastResult', mode:'replace'\|'merge'}` | `{recordIds:[], n, N, excluded:{classNotRecorded:int, …}, predicateHuman:string}` – **does not apply** the filter to state; that is `V1` |
| R3 | `getProperty` | `{id:string}` | `{record, evidence:{field:EvidenceObj}, recordConfidence, completeness:{count,band}, freshness:{field:state}, districtName}` |
| R4 | `getNearbyProperties` | `{id?:string, point?:{lat,lng}, radiusKm:number, excludeSelf:boolean=true, limit?:int, scope}` | `{origin, radiusKm, hits:[{id,name,distanceM,officeClass,askingRent}], recordIds:[], n}` |
| R5 | `calculateRadius` | `{id?:string, point?, bandsKm:[number]=[1,3,5], scope}` | `GEO.geo.locationAnalysis()` output verbatim: `{subject,bands:[{km,count,rent:Metric,gla:Metric,classMix}],cumulative:true,subjectExcluded:true,method,competitiveSet}` |
| R6 | `calculateAverageRent` | `{recordIds?, filters?, groupBy:'district'\|'class'\|null}` | `Metric` (ungrouped) or `{groups:[{key,label,metric:Metric}], suppressed:[{key,n,reason}]}` |
| R7 | `calculateMedianRent` | same as R6 | same as R6, `kind:'median'` |
| R8 | `calculateMetric` (§45 `calculate_metric`) | `{recordIds?, field:string, kind:'count'\|'sum'\|'mean'\|'median'\|'min'\|'max'}` | `Metric` – thin wrapper over `GEO.analytics.metric`, the generic form of R6/R7 |
| R9 | `aggregateByDistrict` | `{recordIds?, measure?:field, kind:'count'\|'sum'\|'mean'\|'median', includeEmpty:boolean=true}` | `{groups:[{key,label,count,metric}], unknown:{count}, order:'desc', ties:[[keys]]}` |
| R10 | `aggregateByClass` | `{recordIds?, measure?, kind}` | same shape, ordinal order `A+,A,B+,B,C` then `Class not recorded` |
| R11 | `rankProperties` | `{recordIds?, field:string, direction:'desc'\|'asc', limit:int}` | `{ranked:[{id,name,value}], n, N, ties:[], gate}` – **gated**: refuses when `n === 0` |
| R12 | `getCompetitiveSet` (§45 `show_competitors`) | `{id:string, radiusKm:number=GEO.geo.COMPETITIVE_BAND_KM (3), manualAdd:[], manualRemove:[]}` | `GEO.geo.competitiveSet()` output plus the band it used: `{title:'Suggested competitive set', bandKm, qualified:[{record,distanceM,reasons[]}], proximityOnly:[], excluded:[], caveat}`. The tool passes `radiusKm` through as `competitiveBandKm`, so the peer band is always the band the user named – never silently the widest band of a 1/3/5 analysis. |
| R13 | `getDataCoverage` | `{recordIds?, fields?:[string]}` | `{fields:[{field,label,n,N,pct,critical}], statement:string}` – `statement` is `GEO.analytics.coverageStatement()` |
| R14 | `getSources` | `{recordIds?}` | `{sources:[{id,name,method,retrievedAt,recordCount,url,note}], profilesUsed:[id], licenceNote}` – `licenceNote` is **internal-only** and stripped for `role:'external'` |
| R15 | `getDataQuality` (§45 `show_data_quality`) | `{recordIds?, aspect:'confidence'\|'completeness'\|'freshness'\|'duplicates'\|'conflicts'\|'entity'\|'all'}` | `{confidence:{High,Medium,Low,Unknown}, completeness:{none,minimal,partial,good}, freshness:{fresh,ageing,stale,unknown}, duplicates:{groups,records,unflaggedNearPairs}, conflicts:{districtConflict}, entity:{suspected_non_bc,name_quality,unreviewed}, buckets:{<key>:[recordIds]}}` – **internal** |
| R16 | `getVerificationQueue` | `{recordIds?, limit:int=25}` | `{queue:[{id,name,priority,reasons:[],missingCritical:int,lastVerifiedAt,nextRefreshAt,pastDue:boolean}], pastDueCount, formula}` – **internal** |

**Verification priority formula (R16), stated in the response so the ranking is auditable:**

```
priority = 10 × (missingCriticalFields)            // 0–80, from the 8 critical fields
         + 25 × (pastDue ? 1 : 0)                  // lastVerifiedAt + refreshDays(fast) < today
         + 20 × (_meta.districtConflict ? 1 : 0)
         + 15 × (_meta.possibleDuplicate ? 1 : 0)
         + 10 × (_meta.entityReview === 'suspected_non_bc' ? 1 : 0)
         +  5 × (confidence === 'Low' ? 1 : 0)
```

Ties break by `lastVerifiedAt` ascending, then `name` ascending. No weight is a judgement about a
building's market importance – the brief's §50 "importance of the property" and "client demand"
inputs do not exist in this dataset and are **not** approximated. The formula is printed under the
queue with that sentence.

### 2.4 The registry – view tools (mutate `GEO.state`)

Every one of these calls `GEO.state.set(patch, {source:'ai', action, tools, summary})` and nothing
else. None writes to the DOM or to Leaflet: the map and the filter panel re-render from state.

| # | id (§45 verb) | args | state written | returns |
|---|---|---|---|---|
| V1 | `applyFilters` (`apply_filters`) | `{patch:FilterPatch, mode:'replace'\|'merge'}` | `filters` | `{n, N, filters, changedKeys:[]}` |
| V2 | `clearFilters` (`clear_filters`) | `{keys?:[string]}` – omit for all | `filters` | `{n, cleared:[]}` |
| V3 | `selectProperty` (`select_property`) | `{id}` | `selectedId`, `rightTab:'property'`, `rightRail:'open'` | `{id, name}` |
| V4 | `zoomToProperty` (`zoom_to_property`) | `{id, zoom:int=16}` | `map.centre`, `map.zoom` | `{id, centre, zoom}` |
| V5 | `createRadius` (`create_radius`) | `{id, bandsKm:[number]}` | `radius:{id,km}` | `{radiusId, bandsKm, counts:{1:n,3:n,5:n}}` |
| V6 | `createMapLayer` (`create_layer`) | `{name, criteriaHuman, criteriaMachine, recordIds, style?, owns?}` | `aiLayers` (append) | `{layerId, count}` |
| V7 | `removeMapLayer` (`remove_layer`) | `{id?:string, all:boolean=false}` | `aiLayers`, `radius` (if owned) | `{removed:[layerId], radiusRemoved:boolean}` |
| V8 | `compareProperties` (`compare_properties`) | `{ids:[string]}` 2–4 | `compare`, `overlay:'compare'` | `{ids, n, dropped:[]}` |
| V9 | `clearAnalysis` | `{}` | calls `GEO.state.clearAnalysis()` | `{n:148, layersRemoved:int, radiiRemoved:int}` |

`compareProperties` silently truncates above 4 (the state invariant already does) but returns
`dropped` so the response can say so – a truncation the user is not told about is a fake result.

### 2.5 The registry – produce and egress tools

| # | id | cls | args | notes |
|---|---|---|---|---|
| P1 | `generateChart` (`generate_chart`) | produce | `{kind:'bar'\|'column'\|'strip', series:[{label,value,unknown?}], title, coverageText, valueFormat}` | Returns a chart **spec**, not DOM. `23-ai-panel.js` hands it to `GEO.charts.render()`. Encoding rules are fixed by `10-visual-system.md` §7 – the AI may not choose colours. |
| P2 | `generateTable` (`generate_table`) | produce | `{columns:[{key,label,align,format}], rows:[{…}], title, coverageText, footnote}` | Missing values render as `Not recorded`, never blank (§36). |
| E1 | `exportDataset` (`export_results`) | **egress**, `confirm:true` | `{recordIds, format:'json'\|'csv', fields?:[string], filename?}` | First call returns `NEEDS_CONFIRMATION` with a preview `{rows, fields, containsDemo, internalFieldsIncluded}`. Second call with `ctx.confirmed === 'exportDataset'` performs it via `GEO.data.exportEnvelope` / `toCsv`. For `role:'external'`, `_meta.internalNote`, `_meta.qcFlags`, `_meta.entityReviewNote` and `_meta.seedObjectId` are stripped and the response says which fields were removed. |

### 2.6 The registry – persist tools (declared, blocked) **[ARCH]**

Registered so the plan vocabulary and the permission model are complete and testable, and so the
refusal is a real code path rather than a missing feature.

| # | id | args | behaviour in the prototype |
|---|---|---|---|
| Z1 | `createFieldTasks` | `{recordIds, fields:[string], deadline, priority}` | `NOT_IN_PROTOTYPE` |
| Z2 | `updateRecord` | `{id, patch, source, confidence}` | `NOT_IN_PROTOTYPE` |
| Z3 | `createDraftRecord` | `{fields}` | `NOT_IN_PROTOTYPE` |

Exact returned message (string A13, i18n `ai.notInPrototype`):

> **Requires confirmation and a backend – not available in the prototype.** I can list the
> {n} properties this would cover and you can export that list, but writing tasks or records back
> to a dataset needs permissions and storage this prototype does not have.

### 2.7 Access, mutation and confirmation matrix (§60)

| class | tools | mutates | role required | confirmation | undo |
|---|---|---|---|---|---|
| `read` | R1–R14 | no | external | none | n/a |
| `read` (internal) | R15, R16 | no | **internal** | none | n/a |
| `view` | V1–V9 | `GEO.state` only | external | **none** – see rule below | `Undo this` (I-07), always |
| `produce` | P1, P2 | no | external | none | n/a |
| `egress` | E1 | no (writes a file) | external (fields filtered) | **yes, every call** | n/a |
| `persist` | Z1–Z3 | would write the dataset | internal | yes **and** blocked | n/a |

**The confirmation rule, stated exactly.** §60 requires confirmation for *permanent* changes.
View-class mutations are not permanent: they are reversible, they are mirrored in the manual
controls (§7), and every response carries `Undo this`. Requiring a click before every filter would
make the assistant slower than the filter panel and defeat §40. Therefore:

1. `read`, `view` and `produce` execute immediately.
2. `egress` requires an inline confirm chip stating row count, field count, whether demo records
   are included, and (for internal) the licence-review note.
3. `persist` requires confirmation **and** is refused with A13.
4. One additional gate on `view`: if a plan would **discard user-made manual work** – remove ≥1
   layer the user created manually, or clear ≥1 filter the user set by hand (`meta.source==='user'`
   on the last write to that key) – and the utterance did not explicitly name that destruction,
   the engine returns `outcome:'confirm'` with the chip
   `Clear {n} filters and {m} layers? [Clear] [Keep both]`. AI-8's utterance *does* explicitly name
   it ("Remove this analysis and return to all business centers"), so AI-8 executes directly.

---

## 3. Deterministic intent catalogue (§54)

### 3.1 Parse pipeline

```js
GEO.ai.intents.parse(utterance, context) -> Plan
```

1. **Normalise.** Lowercase; NFKD-strip diacritics; collapse whitespace; map curly quotes to
   straight; map `m2 | m² | кв.м | кв м | sqm | sq.m` → `m2`; map `$ | usd | долл | доллар` → `usd`.
2. **Homoglyph fold (mandatory).** Russian users type Cyrillic letters that look Latin. Apply
   **both directions** before class/name matching:
   `А↔A  В↔B  С↔C  Е↔E  К↔K  М↔M  Н↔H  О↔O  Р↔P  Т↔T  Х↔X  У↔Y`.
   Without this, `класс А` never matches class `A`, and the seed's own
   `Infinity Business Сenter` (Cyrillic С) is unfindable (T9).
3. **Detect refinement.** If the utterance begins with a refinement marker (§4.2), set
   `scope:'lastResult'` and `mode:'merge'`; otherwise `scope:'filtered'|'all'` per intent and
   `mode:'replace'`.
4. **Extract slots** with the extractors in §3.2. Extraction is independent of intent matching, so
   one extractor serves every intent.
5. **Score intents.** Each intent declares `patterns` (regex) and `keywords`. Score =
   `2 × (patterns matched) + 1 × (distinct keywords matched) + 0.5 × (slots the intent declares as required and that were filled)`.
   Highest score wins; `matchScore = min(1, score / intent.maxScore)`.
6. **Threshold.** `score < 2` → `fallback.unknown`. If the utterance matched an
   **unsupported-concept** keyword (§3.6) at any score, `fallback.unsupported` wins outright –
   answering a demographics question with a property filter is worse than refusing.
7. **Resolve references** against session context (§4).
8. **Emit Plan.**

### 3.2 Slot extractors (exact)

| slot | type | extractor | notes |
|---|---|---|---|
| `classes` | `['A+','A','B+','B','C']` | `/(?:class|класс[а-я]*|klass)\s*[:\-]?\s*((?:a\+|a|b\+|b|c)(?:\s*(?:,|\/|\||and|и|или|or)\s*(?:a\+|a|b\+|b|c))*)/i` plus bare `/\b(a\+|b\+)\b/i` | Run **after** the homoglyph fold. `A and A+`, `A/A+`, `класс А и А+` all parse. A bare single letter without the word "class" is **not** a class (it collides with property names) unless it is `A+`/`B+`. |
| `districtKeys` | district key list | Longest-match against the alias table (§3.3) | Matches in either script; multiple districts allowed (`Mirabad and Yunusabad`) |
| `glaMin/glaMax` | number, m² | `/(above|over|more than|larger than|bigger than|at least|greater than|>|больше|более|выше|свыше|от)\s*([\d\s.,]+)\s*(m2)/` and the `below|under|less than|smaller than|at most|<|меньше|менее|ниже|до` mirror | `5,000 m2`, `5 000 кв.м`, `10к м2` (the `к/k` suffix ×1000) |
| `rentMin/rentMax` | number, USD/m²/month | same comparator sets + `/(rent|rate|ставк|аренд|цена|цене)/` or a `$`/`usd` token | `$30`, `30 долларов`, `выше 30` |
| `radiusKm` | number | `/(?:within|in|radius|в радиусе|в пределах|вокруг)\s*([\d.,]+)\s*(km|км|m\b|м\b)/` | `m/м` values are divided by 1000; default **3** when the intent needs a radius and none is given, and the default is **stated in the answer** |
| `confidenceLevels` | `['High','Medium','Low','Unknown']` | `/(low|poor|weak|bad|unreliable|низк|плох|слаб|ненадёжн|сомнительн)/` → `['Low','Unknown']`; `/(high|reliable|высок|надёжн)/` → `['High']` | "poor data quality" also raises `qualityAspect:'all'` |
| `staleness` | `'stale'\|'ageing'\|'due'` | `/(not verified|unverified|stale|out of date|outdated|old data|need.*verif|recheck|re-?check|не провер|устарел|давно|требу.*провер|перепровер)/` | `/(more than|older than|больше чем)\s*(\d+)\s*(month|months|мес)/` fills `staleMonths` |
| `topN` | int | `/\b(top|three|3|two|2|four|4|five|5|largest|highest|lowest|biggest|топ|три|две|четыре|крупнейш|самы[ехй])\b/` | word numbers mapped; default 3 for "the largest/highest" |
| `metricField` | schema key | Match `aiName` from the field registry (`class, district, gla, gba, rent, vacancy, occupancy, available, parking, floors, year, status, amenities`) plus synonyms: `size\|area\|площад\|размер → gla`, `price\|ставка → askingRent`, `empty\|пуст → vacancyPct` | The registry is the vocabulary; a field added to `02-schema.js` becomes speakable with no parser change |
| `propertyName` | string | Quoted string, or the residual token run after removing all other matched spans, passed to `searchProperties` with a score floor of 0.6 | Never guesses: below the floor the intent becomes `fallback.unknown` with the top 3 near matches offered |
| `statuses` | status enum | `/(operating|под строит|under construction|planned|строящ|проект|renovation|реконструк|действующ)/` | |
| `amenities` | amenity enum | Direct match against `S.enums.amenity` + RU synonyms | |
| `groupBy` | `'district'\|'class'` | `/(by district|per district|по район|в разрезе район)/` → `district`; `/(by class|по класс)/` → `class` | |

### 3.3 District alias table (both scripts, both spellings)

Source labels in `bc.json` use one romanisation and the 2024 boundary file another (contract D1).
The parser accepts every form; the canonical key is always the polygon key.

| key | accepted aliases (case/diacritic-insensitive, after fold) |
|---|---|
| `mirobod` | mirobod, mirabad, mirobodskiy, мирабад, мирабадский, миробод |
| `yunusobod` | yunusobod, yunusabad, юнусабад, юнусабадский, юнусобод |
| `mirzo-ulugbek` | mirzo ulugbek, mirzo-ulugbek, мирзо улугбек, мирзо-улугбек, улугбекский |
| `yakkasaroy` | yakkasaroy, yakkasaray, яккасарай, яккасарайский |
| `yashnobod` | yashnobod, yashnabad, яшнабад, яшнабадский, яшнобод |
| `chilonzor` | chilonzor, chilanzar, чиланзар, чиланзарский, чилонзор |
| `shayxontohur` | shayxontohur, shaykhantakhur, shaykhantaur, шайхантахур, шайхантаурский |
| `olmazor` | olmazor, almazar, алмазар, алмазарский, олмазор |
| `sergeli` | sergeli, сергели, сергелийский |
| `uchtepa` | uchtepa, учтепа, учтепинский |
| `bektemir` | bektemir, бектемир, бектемирский |
| `yangihayot` | yangihayot, yangikhayot, янгихаёт, янгихает |

Built at boot from `GEO.data.districts()` plus this static alias list, so adding a city adds
aliases in data, not in the parser.

### 3.4 The intent catalogue

`scope` column: which rows the intent runs against by default (`all` = full working set,
`filtered` = current filter result, `last` = `aiSession.lastResultIds`).
`gate` column: the field whose coverage must pass §4.4 before the intent can act.

| id | example EN | example RU | patterns / keywords (beyond slot extractors) | slots used | tools emitted | scope | gate |
|---|---|---|---|---|---|---|---|
| `filter.class` | "Show Class A business centers" · "Show Class A and A+ business centers" | "Покажи бизнес-центры класса A" · "БЦ класса А и А+" | `show\|display\|find\|list\|покажи\|показать\|найди\|выведи` + `classes` slot filled | classes | `filterProperties` → `applyFilters` → `createMapLayer` | filtered | `officeClass` |
| `filter.district` | "Show offices in Mirabad" | "Офисы в Мирабаде" | `in\|within\|в\|по` + `districtKeys` filled | districtKeys | `filterProperties` → `applyFilters` → `createMapLayer` | filtered | `districtKey` (always passes, 148/148) |
| `filter.size` | "Show buildings larger than 5,000 m²" | "Здания больше 5 000 кв.м" | `glaMin\|glaMax` filled | glaMin, glaMax | `getDataCoverage` → **gate fails** → refusal | filtered | `gla` (0/148 ⇒ always refuses on observed data) |
| `filter.rent` | "Find offices with rent below $30" · "Only those with known rent above $30" | "Офисы со ставкой ниже 30" | `rentMin\|rentMax` filled | rentMin, rentMax | `filterProperties` → `applyFilters` → `createMapLayer` | filtered/last | `askingRent` |
| `filter.status` | "Show buildings under construction" | "Строящиеся здания" | `statuses` filled | statuses | gate → refusal on observed data | filtered | `status` (0/148) |
| `filter.availability` | "Only properties with more than 2,000 m² available" | "Где свободно больше 2 000 кв.м" | `available\|vacant\|свободн` + number | availMin | gate → refusal | filtered | `availableArea` (0/148) |
| `filter.vacancy` | "Show buildings with vacancy above 10%" | "Вакансия выше 10%" | `vacancy\|vacant\|вакан\|пуст` + `%` | vacancyMin/Max | gate → refusal | filtered | `vacancyPct` (0/148) |
| `filter.amenities` | "Show buildings with underground parking" | "С подземным паркингом" | `amenities` filled | amenities | gate → refusal | filtered | `amenities` (0/148) |
| `filter.name` | "Show me Trilliant" | "Покажи Trilliant" | `propertyName` above score floor, no other slot | propertyName | `searchProperties` → `selectProperty` → `zoomToProperty` | all | – |
| `quality.confidence` | "Show low-confidence properties" · "Show properties with poor data quality" | "Покажи объекты с низкой достоверностью" | `confidence\|quality\|достоверн\|качеств данн` | confidenceLevels, qualityAspect | `getDataQuality` → `applyFilters` → `createMapLayer` | all | – (quality always has full coverage) |
| `quality.stale` | "Show properties not verified recently" · "Which buildings need data verification?" | "Что нужно перепроверить?" | `staleness` filled, or `verif\|провер` | staleness, staleMonths | `getVerificationQueue` → `generateTable` → `createMapLayer` | all | – |
| `quality.missing` | "Which records have the weakest data coverage?" | "Где меньше всего данных?" | `missing\|incomplete\|coverage\|gaps\|не хватает\|неполн\|пробел` | metricField? | `getDataCoverage` → `getDataQuality` → `generateChart` | filtered | – |
| `quality.duplicates` | "Show possible duplicates" | "Покажи возможные дубли" | `duplicat\|dupe\|дубл\|повтор` | – | `getDataQuality{aspect:'duplicates'}` → `createMapLayer` | all | – |
| `quality.conflicts` | "Which records have a district conflict?" | "Где район не совпадает?" | `conflict\|mismatch\|конфликт\|не совпад\|расхожд` | – | `getDataQuality{aspect:'conflicts'}` → `generateTable` → `createMapLayer` | all | – |
| `competitors.radius` | "Show its competitors within 3 km" · "Find competitors around this building" | "Покажи конкурентов в радиусе 3 км" | `competitor\|rival\|конкурент\|соперник` | subjectRef, radiusKm | `getProperty` → `getNearbyProperties` → `getCompetitiveSet` → `createRadius` → `createMapLayer` | all | – |
| `location.analyse` | "Analyse this location" | "Проанализируй эту локацию" | `analy[sz]e\|location analysis\|анализ локац\|что вокруг\|окружен` | subjectRef, bandsKm | `getProperty` → `calculateRadius` → `createRadius` → `generateTable` | all | – |
| `aggregate.byDistrict` | "Show office supply by district" | "Предложение офисов по районам" | `supply\|distribution\|breakdown\|предложение\|распредел` + `groupBy:'district'` | groupBy, classes? | `aggregateByDistrict` → `generateChart` → `generateTable` | filtered | measure field if any |
| `aggregate.byClass` | "Show business centres by class" | "БЦ по классам" | `groupBy:'class'` | groupBy | `aggregateByClass` → `generateChart` | filtered | `officeClass` |
| `aggregate.rentByDistrict` | "Show average known rent by district" | "Средняя известная ставка по районам" | `average\|mean\|median\|средн\|медиан` + `groupBy:'district'` | groupBy, metricField | `calculateAverageRent{groupBy:'district'}` → `generateChart` → `generateTable` | filtered | `askingRent` |
| `rank.districtBy` | "Which district has the most known Class A GLA?" · "Which district has the most Class A offices?" | "В каком районе больше всего офисов класса А?" | `which\|where\|most\|highest\|top\|какой\|где больше\|самый` + `district` | metricField, classes, topN | `aggregateByDistrict` → `generateTable` → `generateChart` → `applyFilters` (district highlight) | filtered | `metricField` |
| `metric.value` | "What is the average rent for Class A offices?" | "Какая средняя ставка по классу А?" | `what is\|how much\|average\|median\|total\|сколько\|какая\|средн\|итого` | metricField, kind, classes, districtKeys | `filterProperties` → `calculateMetric` | filtered | `metricField` |
| `compare.explicit` | "Compare these properties" | "Сравни эти объекты" | `compare\|versus\|vs\|сравн` + `these\|them\|эти\|их` | – | `compareProperties{ids: compare tray or lastResult ≤4}` | last | – |
| `compare.topN` | "Compare the three largest properties on the map" · "Compare the three highest known asking rents" | "Сравни три самых дорогих" | `compare\|сравн` + `topN` + `metricField` | topN, metricField, direction | `rankProperties` → `compareProperties` | filtered | `metricField` |
| `clusters` | "Show the largest office clusters" | "Покажи крупнейшие скопления офисов" | `cluster\|concentration\|скоплен\|кластер\|концентрац` | cellKm | `getDataCoverage` → `GEO.geo.clusters` via `calculateMetric` → `generateTable` → `createMapLayer` | filtered | – (counts only; density surfaces refused, §3.6) |
| `layers.clear` | "Clear all layers" | "Убери все слои" | `clear\|remove\|delete\|hide` + `layer\|слой\|слои` | layerRef? | `removeMapLayer{all:true}` | – | – |
| `session.reset` | "Remove this analysis and return to all business centers" | "Убери анализ и покажи все БЦ" | `reset\|start over\|return to all\|show all\|clear everything\|сброс\|всё сначала\|покажи все` | – | `clearAnalysis` | – | – |
| `export.results` | "Export these results" | "Выгрузи результаты" | `export\|download\|csv\|json\|выгруз\|скачать\|экспорт` | format, scope | `exportDataset` (confirm-gated) | last/filtered | – |
| `coverage.explain` | "What data do you have?" · "What is missing?" | "Какие данные есть?" | `what data\|what do you know\|coverage\|какие данные\|что известно\|что есть` | – | `getDataCoverage` → `getSources` → `generateChart` | filtered | – |
| `help` | "What can you do?" | "Что ты умеешь?" | `help\|what can you\|commands\|помощь\|что умеешь\|команды` | – | none | – | – |
| `fallback.unsupported` | "Which office cluster has the highest employee density?" | "Где самая высокая плотность сотрудников?" | §3.6 keyword list | concept | `getDataCoverage` (to quote real denominators) | – | – |
| `fallback.unknown` | anything below threshold | – | – | – | `searchProperties` (to offer near matches) | – | – |

### 3.5 §54 and §63 coverage map (every required example, mapped)

| source | utterance | intent id | outcome on the real seed |
|---|---|---|---|
| §54.1 | "Show Class A business centers." | `filter.class` | answered – 8 properties (class A alone); with A+ → 12 |
| §54.2 | "Show offices in Mirabad." | `filter.district` | answered – 28 (polygon-resolved, D1) |
| §54.3 | "Show buildings larger than 5,000 m²." | `filter.size` | **refused** – `gla` 0/148 |
| §54.4 | "Show low-confidence properties." | `quality.confidence` | answered – 16 Low, 132 Medium (§10.3) |
| §54.5 | "Show properties not verified recently." | `quality.stale` | answered – 0 past due, 148 ageing at 59 days (D8) |
| §54.6 | "Compare these properties." | `compare.explicit` | answered if ≥2 in tray/last result, else `clarify` |
| §54.7 | "Find competitors around this building." | `competitors.radius` | answered when a property is selected, else `clarify` |
| §54.8 | "Show office supply by district." | `aggregate.byDistrict` | answered – 148 across 10 districts, 2 recorded zeros |
| §54.9 | "Show average known rent by district." | `aggregate.rentByDistrict` | answered – 3 districts publishable, 2 suppressed at n<3 |
| §54.10 | "Clear all layers." | `layers.clear` | answered |
| §63.1 / AI-1 | "Show Class A and A+ business centers." | `filter.class` | 12 |
| §63.2 / AI-2a | "Only buildings above 5,000 m²." | `filter.size` (refinement) | **refused**, selection untouched at 12 |
| §63.2 / AI-2b | "Only those with known rent above $30." | `filter.rent` (refinement) | 12 → 7 |
| §63.3 / AI-3a | "Which district has the most known Class A GLA?" | `rank.districtBy` | **refused** – `gla` 0/148 (worked trace, §10.2) |
| §63.3 / AI-3b | "Which district has the most Class A and A+ offices?" | `rank.districtBy` | Yunusobod 4 (§10.2) |
| §63.4 / AI-4 | "Show its competitors within 3 km." | `competitors.radius` | 74 within 3 km; 9 qualified (worked trace, §10.1) |
| §63.5 / AI-5 | "Show properties with poor data quality." | `quality.confidence` | 16 Low + 132 with 0 critical fields (§10.3) |
| §63.6 / AI-6 | "Which buildings need data verification?" | `quality.stale` | ranked queue; 0 past due today |
| §63.7 / AI-7a | "Compare the three largest properties currently on the map." | `compare.topN` | **refused** – `gla`/`gba` 0 |
| §63.7 / AI-7b | "Compare the three highest known asking rents." | `compare.topN` | Trilliant 44.7, Nest one 40.6, Forum 39.7 |
| §63.8 / AI-8 | "Remove this analysis and return to all business centers." | `session.reset` | full clear, session log retained |
| §41 | "Show business centers with rent above $30/m²." | `filter.rent` | 8 – of the 16 records with a recorded rent (7 of the 8 are class A/A+) |
| §41 | "Show business centers with low-confidence rent data." | `quality.confidence` | 16 (all priced records carry `2GIS-RENT` = Low) |
| §41 | "Show office buildings not verified for more than six months." | `quality.stale` (`staleMonths:6`) | 0 today; 1 after the AI-6(f) time-travel edit |
| §41 | "Create a 5 km competitor zone around this property." | `competitors.radius` (`radiusKm:5`) | 114 within 5 km of Trilliant |
| §41 | "Show only properties with more than 2,000 m² available." | `filter.availability` | **refused** – `availableArea` 0/148 |
| §43 | "Compare Class A office supply in Mirabad and Yunusabad." | `aggregate.byDistrict` (2 districts, class filter) | answered – Mirobod 3, Yunusobod 4 |
| §62 | "Which office cluster has the highest employee density?" | `fallback.unsupported` | **refused** with the §62 wording |

### 3.6 Unsupported-concept list (`fallback.unsupported`)

These match on keyword and **override** any other intent match, because each one is a question the
platform architecture anticipates (§31 Phases 4–5, §42) but the dataset cannot support. Answering
them with a proxy is exactly the fabrication §2.8/§47 forbids.

| concept keys | trigger keywords (EN / RU) | "what would be required" sentence |
|---|---|---|
| `employeeDensity` | employee density, workforce, headcount, staff per / плотность сотрудников, численность персонала | occupancy or workforce figures per building |
| `footfall` | footfall, foot traffic, pedestrian, visitors / трафик, проходимость, посетител | pedestrian counts or mobile-location data |
| `demographics` | population, demographic, catchment population, income, purchasing power / население, демограф, доходы, покупательная способность | a population and income grid for Tashkent |
| `driveTime` | drive time, isochrone, 15-minute, travel time / изохрон, время в пути, транспортная доступность | a routing engine and a road network |
| `metro` | metro, station, underground, subway / метро, станци | a verified metro-station dataset – none is loaded (D5) |
| `transactions` | deals, transactions, take-up, absorption, signed rents / сделки, поглощение, подписанные ставки | a transactions register; the dataset holds asking rents only |
| `ownership` | owner, landlord, who owns / собственник, владелец, кто владеет | owner records – 0 of 148 recorded |
| `tenants` | tenants, occupiers, who is in / арендатор, кто сидит, резидент | tenant records – `tenantsStatus` is `not_collected` for all 148 |
| `forecast` | forecast, predict, will be, next year, projection / прогноз, будет, спрогнозируй | a historical time series; this dataset has one collection date |
| `valuation` | valuation, worth, cap rate, yield, price per m² sale / оценка, стоимость, доходность, капитализация | sale evidence and yields; the dataset holds asking rents only |

### 3.7 Fallback behaviour (§62)

**`fallback.unsupported`** – `outcome:'refused'`. Renders all six blocks. Template:

> **The current dataset is insufficient to answer this reliably.**
> {Concept} data is not held in this platform. {Coverage sentence for the nearest real field, with
> its actual denominator.} To answer this we would need {requirement}.
> I can answer these instead: {2–3 clickable alternatives}.

Nothing on the map changes. No number is produced. This is a **success path**, counted as
`answered-by-refusal` in the session log, not an error.

**`fallback.unknown`** – `outcome:'clarify'`. The engine runs `searchProperties` on the residual
tokens; if anything scores above 0.4 it offers those as "Did you mean this property?". Otherwise
it lists the six intent families with one example each (`help` content), and states plainly:

> I did not understand that. I match a fixed set of commands in this prototype – there is no
> language model behind this panel. Here is what I can do:

That sentence is deliberate. A tester who believes they are talking to an LLM will report the
wrong UX finding (§54: "the objective is to validate the AI interaction model, not the language
model itself").

---

## 4. Session context (§44, §58)

### 4.1 What is remembered – the exact shape

`state.aiSession` as frozen in `05-state.js` carries `{turns, lastResultIds, lastIntent}`. That is
insufficient for the §58 workspace behaviour and for contract §9's "last layer". **Required
amendment to `src/js/05-state.js`** – replace the `aiSession` literal in `initial()`, and the two
literals in `State.clearAnalysis` and `State.clearSession`, with:

```js
aiSession: {
  turns:            [],      // Response objects, newest last, capped at 50
  turnSeq:          0,       // monotonic; turn ids are 'T' + turnSeq
  lastIntent:       null,    // intent id of the last non-fallback turn
  lastResultIds:    null,    // record ids of the last successful result set – the "those" referent
  lastResultLabel:  null,    // e.g. 'Class A / A+ offices' – used verbatim in narrowing sentences
  lastLayerId:      null,    // last layer the assistant created
  lastRadiusId:     null,    // subject id of the last radius the assistant drew
  lastFiltersApplied: null,  // the exact filter patch the assistant last wrote, for divergence checks
  contextId:        null,    // explicit pronoun referent pinned via I-04; null => follow selectedId
  contextPinned:    false
}
```

`State.set` already merges `aiSession` one level deep, so a tool may write one key without
clobbering the rest. `clearAnalysis` resets every key except `turns` and `turnSeq` (reset clears
state, not history – AI-8g). `clearSession` resets all of them including `turns`.

| remembered thing | field | written by | read by |
|---|---|---|---|
| selected property | `state.selectedId` (not in `aiSession`) | user click, `selectProperty` | pronoun resolution |
| pinned AI context | `aiSession.contextId` | I-04 chip | pronoun resolution (wins over `selectedId`) |
| active filters | `state.filters` | user, `applyFilters` | scope resolution, narrowing |
| last result set | `aiSession.lastResultIds` + `lastResultLabel` | engine, after any answered turn with a row set | "those/them/these", narrowing |
| last created layer | `aiSession.lastLayerId` | `createMapLayer` | "remove that layer", "add those to compare" |
| last radius | `aiSession.lastRadiusId` | `createRadius` | "make it 5 km instead" |
| what the AI last applied | `aiSession.lastFiltersApplied` | `applyFilters` | divergence detection (§7.3) |

### 4.2 Refinement – narrowing the previous result, not starting over (§58)

A turn is a **refinement** when its normalised utterance begins with one of:

`only | just | of those | from those | among those | narrow | and only | but only | now only | which of those`
RU: `только | лишь | из них | среди них | а теперь только | сузь | оставь только`

Refinement rules (all four apply together):

1. `scope = 'lastResult'` – the candidate row set is `aiSession.lastResultIds` (falling back to the
   current filtered set if null, and saying so in the answer).
2. `mode = 'merge'` – the new slots are merged into `state.filters`; previously set filter keys are
   **kept**. AI-2b keeps `classes:['A','A+']` and adds `rentMin:30`.
3. The coverage gate (§4.4) is evaluated against **the previous result set**, not the whole
   dataset. AI-2a's message must read "0 of the 12 currently selected properties", not "0 of 148" –
   the user asked about those 12.
4. On a gate failure, **nothing is written**: filters, layers, radius, selection and
   `lastResultIds` are all left exactly as they were, and the answer states the unchanged
   selection by name and count.

A non-refinement utterance sets `mode:'replace'` and resets the filter patch to defaults before
applying its own slots. This is the difference between "only those above $30" (narrow) and "show
offices above $30" (start again), and it is decided solely by the leading marker – no heuristics.

### 4.3 Pronoun and reference resolution (exact rules)

| reference | EN tokens | RU tokens | resolves to | error when unresolvable |
|---|---|---|---|---|
| **subject** | `it, its, this, this building, this property, here, the selected` | `он, его, этот, это здание, этот объект, здесь, выбранн` | `aiSession.contextId` if `contextPinned`, else `state.selectedId` | `outcome:'clarify'`, message S1 below |
| **set** | `those, them, these, the results, the list` | `их, эти, те, результаты, список` | `aiSession.lastResultIds`, else current filtered set (stated) | message S2 |
| **layer** | `that layer, the layer, this analysis` | `этот слой, слой, этот анализ` | `aiSession.lastLayerId`, else the only layer if exactly one exists | message S3 |
| **radius** | `the circle, the radius, the zone` | `круг, радиус, зона` | `aiSession.lastRadiusId` | message S3 |

**S1 (no property selected)** – exact copy, i18n `ai.clarify.noSubject`:

> I don't know which property you mean. Select a building on the map or in the results list first,
> or name it – for example *"competitors within 3 km of Trilliant"*. {If exactly one property is in
> the compare tray: "Did you mean {name}?" with a clickable chip.}

**S2 (no previous result)** – i18n `ai.clarify.noSet`:

> There is no previous result to narrow. I'll apply this to all {N} properties currently shown
> instead – {restated request}. [Run on all {N}] [Cancel]

S2 is a confirm chip, not an auto-run: silently widening a narrowing request is how an assistant
produces a number the user did not ask for.

**S3 (no layer/radius)** – i18n `ai.clarify.noLayer`:

> There are no analysis layers to act on. Layers are created when I answer a question that produces
> a set of properties, or from a saved competitive set.

**Name over pronoun.** If an utterance contains both a resolvable property name and a pronoun, the
**name wins** and the answer says so: *"Using Trilliant (named in your request) rather than the
currently selected Nest one."* Silent disagreement between what the user typed and what is
selected is the most likely source of a wrong answer in this design.

### 4.4 The coverage gate – one function, used by every intent

```js
/**
 * The single permission check for "may I compute this?".
 * @param rows   the candidate rows for this turn (post-scope resolution)
 * @param field  schema key
 * @param need   'any' (filter, rank, group) | 'stat' (mean, median, distribution)
 * @returns {ok, n, N, field, label, requires, message}
 */
GEO.ai.gate = function (rows, field, need) {
  var c = GEO.analytics.coverage(rows, field);     // {n, N}
  var min = need === 'stat' ? GEO.analytics.MIN_N : 1;   // MIN_N === 3
  return { ok: c.n >= min, n: c.n, N: c.N, field: field,
           label: GEO.schema.label(field), requires: REQUIRES[field], message: … };
};
```

Thresholds are inherited from the analytics contract, not re-invented here: filters and rankings
need `n ≥ 1`; means, medians and distributions need `n ≥ 3` (contract §7). `REQUIRES` is a static
map from field key to the phrase used in "to answer this we would need …" – e.g.
`gla → 'recorded GLA per building'`, `vacancyPct → 'a recorded vacancy or occupancy figure per building'`,
`availableArea → 'currently available area per building'`, `status → 'a recorded building status'`.

**No intent may read a field without passing through `gate()` first.** This is the same structural
rule as `GEO.analytics.known()` (contract D2), applied to the assistant.

---

## 5. Response structure (§46)

### 5.1 The object

```js
Response = {
  id:          'T7',
  at:          '2026-09-16T11:04:22.118Z',
  utterance:   'Show its competitors within 3 km',
  role:        'internal',
  intent:      'competitors.radius',
  matchScore:  0.92,
  slots:       { radiusKm: 3 },
  resolved:    { subjectId: 'BC-82f0eb0b80b7', subjectName: 'Trilliant' },
  outcome:     'answered',   // answered | refused | clarify | confirm | error

  /* --- the six mandatory §46 blocks. None is ever omitted. --- */
  answer:            { text: '…', tag: 'PLATFORM_DATA' },
  analysis:          { items: [Metric…], table: TableSpec|null, chart: ChartSpec|null, notes: [] },
  mapActions:        [ { kind, label, detail, layerId?, radiusId?, filterKeys? } ],
  dataCoverage:      { statements: ['…'], fields: [{field,label,n,N}] },
  limitations:       [ { text, tag } ],
  sources:           [ { id, name, method, retrievedAt, recordCount, note } ],

  /* --- supporting --- */
  resultIds:   ['BC-…'],            // becomes aiSession.lastResultIds when outcome === 'answered'
  resultLabel: 'Competitors within 3 km of Trilliant',
  alternatives:[ { label, utterance } ],   // clickable; mandatory when outcome === 'refused'
  proposal:    { filters, layers:[], radius },  // what this turn applied – drives Apply/Undo
  trace:       { stages:[{id,label,ms}], tools:[{tool,args,ok,code,inN,outN,ms}], elapsedMs },
  applied:     true
}
```

### 5.2 Rendering, block by block (`23-ai-panel.js`)

| block | required? | renders as | rules |
|---|---|---|---|
| `answer` | always | one paragraph, 13px Inter, `--text` | ≤ 3 sentences. Names the subject property or the filter in words. Carries one provenance pill top-right. |
| `analysis` | always; when empty, the literal `No figures were calculated for this request.` | metric rows (label · value · coverage line in 11px `--text-3`), then optional table (P2), then optional chart (P1) | Every number is a `Metric` object from `GEO.analytics.metric` – the panel never computes. A metric with `sufficient:false` renders `Insufficient verified data` plus its `reason`, never a blank. |
| `mapActions` | always; when empty, `Nothing was changed on the map.` | a list of one-line chips, each with a `×` that reverses **that** action | Written from `proposal`, not from intent – an action that was planned but failed must not be listed. |
| `dataCoverage` | always | `statements[]` as lines, then a compact `field n/N` grid | At least one statement containing a literal denominator. Generated by `GEO.fmt.coverage()` / `t.coverage()` – never hand-written. |
| `limitations` | always; when genuinely none, `No additional limitations beyond the coverage stated above.` | bulleted, `--text-2` | Always includes the single-source caveat while `sources.length === 1`. |
| `sources` | always; when none, `No source records are attached to the values used.` | source name · method · retrieved date · record count | From `getSources`; `licenceNote` internal-only. |

**Sequence and focus.** The six blocks always render in §46 order. The response container gets
`role="status"` + `aria-live="polite"`; focus does not move (a user mid-typing must not be
interrupted). `How this was answered` (I-05) renders collapsed below `sources`.

### 5.3 Provenance labelling (§2.8, §47, §48)

Six tags, closed set, defined in `20-ai-tools.js`:

| tag | display label | colour token | meaning | where it appears in the MVP |
|---|---|---|---|---|
| `PLATFORM_DATA` | **Platform data** | `--text-2` on `--surface-3` | A value stored in the dataset, shown as stored | Property values in answers, tables and layer inspectors; `getProperty`, `filterProperties`, `searchProperties` results |
| `CALCULATED` | **Calculated** | `--text-2` on `--surface-3` | Derived by the platform from platform data, reproducibly | Every `Metric`; distances; aggregations; completeness; priority scores |
| `EXTERNAL` | **External research** | `--text-2` on `--surface-3` | Retrieved from outside the platform | **Never emitted in the MVP.** The tag exists, the renderer handles it, and no code path produces it. §48 requires the distinction to exist before it is used. **[ARCH]** |
| `AI_INFERENCE` | **AI inference** | `--text-2` on `--surface-3` | The engine's own judgement, not a stored or computed fact | Competitive-set inclusion reasoning; the "poor data quality → completeness" pivot; any suggested alternative |
| `ASSUMPTION` | **Assumption** | `--status-warning` dot + label | A stated input the user did not supply and the data does not contain | Default radius of 3 km; rent unit assumed `USD/m²/month`; refresh intervals (60/365/1095 d); the ±1 class band |
| `UNAVAILABLE` | **Not available** | `--unknown` hollow dot | The requested thing is not in the dataset | Every refusal; every `Not recorded`; the empty context-layer slot |

**Placement rules (binding):**

1. One pill on the `answer` block = the response's **weakest** tag, using the order
   `UNAVAILABLE > ASSUMPTION > AI_INFERENCE > EXTERNAL > CALCULATED > PLATFORM_DATA`. A response
   containing one assumption is labelled as an assumption. Taking the strongest tag would let one
   stored fact launder an inference, which is the same error `D.recordConfidence` avoids.
2. Every row in `analysis.items` carries its own tag inline (11px, after the coverage line).
3. Every `ASSUMPTION` must be accompanied by a `limitations` entry naming the assumed value and
   how to change it – an unexplained assumption is worse than no label.
4. `UNAVAILABLE` on a refusal appears **both** on the answer block and against the named field in
   `dataCoverage`.
5. Tags are rendered as **dot + text**, never colour alone (visual system §4).

---

## 6. AI Layers (§57)

### 6.1 Layer object

```js
AiLayer = {
  id:            'LYR-3',
  name:          'Competitors within 3 km of Trilliant',   // editable inline (Y-07)
  createdBy:     'assistant',              // 'assistant' | 'manual'
  createdAt:     '2026-09-16T11:04:22.118Z',
  sourceTurnId:  'T7',                     // the Response that made it; null for manual

  criteriaHuman: 'Within 3 km of Trilliant (41.3159, 69.2824), excluding Trilliant itself. ' +
                 'Great-circle distance, cumulative band.',
  criteriaMachine: {                       // machine-readable, and re-evaluable
    type:   'radius',                      // 'filter' | 'radius' | 'set' | 'quality'
    origin: { id:'BC-82f0eb0b80b7', lat:41.315878, lng:69.28243 },
    radiusKm: 3, excludeSelf: true,
    scopeAtCreation: { demoMode:false, excludeSuspectedNonBc:false, filters:{…} }
  },

  recordIds:  ['BC-…', …],                 // FROZEN snapshot of the result
  count:      74,
  visible:    true,
  style:      { ring:'--case-red', dash:null, opacity:0.9, order:3 },
  owns:       { radiusSubjectId: 'BC-82f0eb0b80b7' },   // artefacts removed with the layer
  stale:      false,
  recompute:  null                         // set when stale; see §6.3
}
```

`criteriaMachine.type` values and their `predicate` payloads:

| type | payload | re-evaluable? |
|---|---|---|
| `filter` | `{ filters: FilterPatch }` – the exact `state.filters` patch | yes |
| `radius` | `{ origin, radiusKm, excludeSelf }` | yes |
| `quality` | `{ aspect:'confidence'\|'completeness'\|'freshness'\|'duplicates'\|'conflicts', buckets:[…] }` | yes |
| `set` | `{ ids:[…], derivedFrom:'competitiveSet'\|'manual', manualAdd:[], manualRemove:[] }` | no – an explicit list |

### 6.2 Operations (Y-06 … Y-11)

| operation | signature | behaviour |
|---|---|---|
| show / hide | `GEO.ai.layers.setVisible(id, bool)` | Map re-renders from `state.aiLayers`. Hidden layers keep their records and count. |
| rename | `GEO.ai.layers.rename(id, name)` | Name only; criteria are immutable – a renamed layer must still describe what it contains, so `criteriaHuman` is shown under the name in the inspector. |
| remove | `GEO.ai.layers.remove(id)` | Removes the layer **and every artefact it owns**: `owns.radiusSubjectId` clears `state.radius` if it matches (AI-4f). Toast with `Undo`. |
| inspect | `GEO.ai.layers.inspect(id)` | Y-09 disclosure: `criteriaHuman`, the `criteriaMachine` JSON, `count`, `createdBy`, `createdAt`, source turn, and the recompute banner if stale. |
| zoom to | `GEO.ai.layers.zoomTo(id)` | Fits to `GEO.geo.bounds(records)`; disabled at `count === 0`. |
| clear all | `GEO.ai.layers.clear()` | Y-11; confirm chip when any layer has `createdBy:'manual'`. |

Layers render above district polygons and below markers as a coloured ring on each member marker
plus an optional radius circle – they do **not** add a second marker, which would double-count
buildings visually.

### 6.3 A layer is not a filter

| | filter (`state.filters`) | layer (`state.aiLayers[n]`) |
|---|---|---|
| kind | live predicate | frozen result set + the rule that made it |
| how many | exactly one active set | many, simultaneously |
| re-evaluates | on every data or scope change | never automatically |
| affects | the record count, the results list, the analytics dashboard, the map's visible markers | map decoration only |
| survives | until changed or reset | until removed |
| visible in | the left filter rail (§11) | the Layers tab (§57) |

A filter answers *"what am I looking at?"*. A layer answers *"what did that question return, at that
moment?"*. Keeping the distinction is what allows a user to compare two AI answers side by side
while the filter shows something else entirely.

### 6.4 What happens to a layer when the underlying data is edited

On `GEO.on('data:changed')` – fired by every editor save, delete, import, demo-mode toggle and
reset – the layer store runs:

1. **Deletions apply immediately, always.** Ids no longer in `GEO.data` are dropped from
   `recordIds`, `count` is reduced, and the inspector shows `2 records were deleted since this
   layer was created`. A layer cannot draw a record that does not exist.
2. **Values never re-evaluate silently.** For `type ∈ {filter, radius, quality}` the store
   re-runs the predicate into a shadow set and compares:
   ```js
   layer.recompute = { wouldBe: 13, added: ['BC-…'], removed: [], at: '…' };
   layer.stale = true;
   ```
   The layer keeps its snapshot. The Layers tab shows an amber line:
   `Data changed – this layer would now contain 13 properties (was 12). [Refresh layer] [Keep snapshot]`
3. `Refresh layer` replaces `recordIds`, updates `count` and `createdAt`, clears `stale`, and
   appends an audit entry. `Keep snapshot` clears `stale` and records `snapshotKeptAt` so the
   inspector can say `Snapshot kept on 16 Sep 2026 although the data has since changed`.
4. `type:'set'` layers only ever apply rule 1. An explicit list is a decision, not a query.

Auto-refreshing would silently change a number the user has already read and possibly quoted;
silently keeping a stale snapshot would show a count that no longer matches the map. Disclosing
the divergence and asking is the only option consistent with §2.7.

---

## 7. AI ↔ manual control synchronisation (§59, §11)

### 7.1 The single source of truth

There is one filter object, `GEO.state.get().filters`, whose exact shape is frozen in
`05-state.js`. Both of these are true by construction:

- **AI → panel.** `applyFilters` calls `GEO.state.set({filters:…},{source:'ai'})`. The filter rail's
  `render(state)` reads `state.filters`. It cannot show anything else, because it holds no local
  copy of any control value – checkbox `checked`, slider positions and text inputs are all set from
  `state` on every render.
- **Panel → AI.** A user's change calls `GEO.state.set({filters:…},{source:'user'})`. The engine's
  next turn reads the same object as its starting point. There is no "AI filter set".

### 7.2 Why it is structurally impossible to violate

Four enforced properties, all checkable:

1. **One writer.** `State.set` is the only mutation path (contract §5.2). The re-entrancy guard
   already in `05-state.js` makes a subscriber-initiated write fail loudly instead of producing a
   half-rendered frame.
2. **No component state.** No module may cache a filter value in a closure or a DOM attribute
   (contract §5.1). A panel that did would be the only place where divergence could appear.
3. **No AI back door.** `20-ai-tools.js` cannot reach the map or the panels (§1.1 import rules), so
   the only way the assistant can change what is on screen is by writing the same state the user
   writes.
4. **Build lint** (`build.py --check`, fails the build):
   `grep -nE "document\.|window\.L|GEO\.map\.|GEO\.panels\." src/js/2[012]-ai-*.js` must return
   nothing, and `grep -c "GEO.state.set" src/js/23-ai-panel.js` must return `0`.

### 7.3 Divergence reporting (not prevention)

The user *may* change a filter after an AI answer – that is the point of §59. The engine detects it
by comparing `state.filters` with `aiSession.lastFiltersApplied` on every `state` change with
`meta.source === 'user'`:

- the last response's header gains the line `Filters changed manually since this answer.`
- its `Apply to map` button (I-06) becomes **enabled** and re-applies `proposal`
- its `Undo this` (I-07) stays available but warns
  `Your manual changes to {district, rent} will also be reverted.`

`Apply to map` is therefore never a fake control: it reads `Applied` (disabled) while the response's
proposal equals live state, and becomes an active *re-apply* the moment they diverge.

### 7.4 Round-trip acceptance test (add to `24-selftest.js`)

```
1. ask('Show Class A and A+ business centers')
   assert state.filters.classes deep-equals ['A','A+']
   assert panel checkbox[value="A"].checked === true       // read from the DOM, not from state
   assert resultCount === 12
2. user unchecks 'A+' in the panel
   assert state.filters.classes deep-equals ['A']
   assert resultCount === 8
   assert lastResponse.header shows 'Filters changed manually since this answer.'
   assert lastResponse.applyButton.disabled === false
3. ask('Only those with known rent above $30')
   assert state.filters.classes deep-equals ['A']          // the USER's edit is the baseline
   assert state.filters.rentMin === 30
```

Step 3 is the real test of §59: the assistant must continue from what the user did, not from what
it last did.

---

## 8. Permissions (§60) and audit log (§61)

### 8.1 Roles

`state.role ∈ {'internal','external'}`, default `'internal'` for prototype testing, switchable in
Settings with a persistent header chip `Role: External (restricted)` when external. This is a
**product model, not security** – the banner says so verbatim:

> Role switching in this prototype demonstrates the permission model. It is not authentication and
> provides no security. All data in this file is visible to anyone who opens it.

### 8.2 Tool access by role

| role | may call | may not call | data restrictions |
|---|---|---|---|
| `external` | R1–R14, V1–V9, P1, P2, E1 | R15 `getDataQuality`, R16 `getVerificationQueue`, Z1–Z3 | `_meta.internalNote`, `_meta.qcFlags`, `_meta.entityReviewNote`, `_meta.seedObjectId`, `sources[].licenceNote` stripped from every result and every export; the Data workspace overlay is force-closed by the existing `State.set` invariant |
| `internal` | everything except Z1–Z3 in practice (declared, blocked) | – | full access |

Intent-level enforcement: `quality.*` intents are removed from the matcher for `external`, so the
refusal is a clean capability message rather than a tool error:

> **Data quality inspection is an internal capability.** External accounts see each property's
> confidence and last-verified date on its detail card, but the QA queues, duplicate review and
> verification priorities are internal tools.

### 8.3 Audit log entry (§61)

Two tiers. Tier 1 already exists: every `State.set` appends `{t, source, action, tools, keys,
summary}` to the session log (contract §5.5). Tier 2 is the per-turn AI entry:

```js
GEO.ai.audit.push({
  seq:            7,
  turnId:         'T7',
  at:             '2026-09-16T11:04:22.118Z',
  user:           'prototype-local',           // no accounts exist; stated, not faked
  role:           'internal',
  prompt:         'Show its competitors within 3 km',
  intent:         'competitors.radius',
  matchScore:     0.92,
  slots:          { radiusKm: 3 },
  resolved:       { subjectId: 'BC-82f0eb0b80b7' },
  tools:          [ { tool:'getProperty', args:{…}, ok:true, inN:1,   outN:1,  ms:0.1 },
                    { tool:'getNearbyProperties', args:{…}, ok:true, inN:148, outN:74, ms:1.4 },
                    … ],
  datasetsAccessed: ['observed'],              // + 'demo' when demo mode is on
  filtersBefore:  {…}, filtersAfter: {…},
  layersCreated:  ['LYR-3'], layersRemoved: [], radiiCreated: ['BC-82f0eb0b80b7'],
  exports:        [],                          // {filename, rows, fields, containsDemo}
  permanentChanges: [],                        // always empty in the prototype
  outcome:        'answered',
  elapsedMs:      4.2
});

GEO.ai.audit.entries();     // ring buffer, cap 200
GEO.ai.audit.toJson();      // I-12 "Export session log"
GEO.ai.audit.clear();       // I-11 "New session" – clears turns, keeps nothing
```

**Not persisted to `localStorage`.** Rationale, stated in the UI: the log contains free-text
prompts, the storage budget is reserved for the data diff (T4), and a prototype opened from
`file://` shares its origin with every other local file. Export is the retention mechanism.
Production persistence, per-user attribution and retention policy are **[ARCH]**.

---

## 9. Execution status UI (§53)

### 9.1 Real stages, real timings

The pipeline is instrumented. Each stage emits `GEO.emit('ai:stage', {turnId, id, label, phase})`
with `phase ∈ {'start','end'}` and a real `performance.now()` reading.

| stage id | §53 label | runs when | real work |
|---|---|---|---|
| `understand` | Understanding request | always | normalise → fold → extract slots → score intents → resolve references |
| `analyse` | Analysing properties | a read tool over records runs | `filterProperties` / `getNearbyProperties` / `searchProperties` / gate checks |
| `layer` | Creating map layer | and only if `createMapLayer` or `createRadius` is in the plan | layer construction and state write |
| `metrics` | Calculating metrics | and only if a `calculate*` / `aggregate*` / `rank*` tool runs | `GEO.analytics` calls |
| `answer` | Preparing answer | always | response assembly, coverage sentences, source resolution |

### 9.2 The anti-theatre rules (binding, from contract D13)

1. **A stage is emitted only when it runs.** A plan with no layer never shows *Creating map layer*.
   A refusal shows `understand → analyse → answer` and nothing else.
2. **No timers, no `setTimeout`, no minimum durations, no artificial ordering.** Stage transitions
   are driven by the executor reaching them.
3. **The strip only paints if the work is actually slow.** The panel arms a
   `requestAnimationFrame` + 120 ms guard on `ask()`; if the Promise settles first, the strip is
   never inserted. With the local provider (<5 ms) the user sees the answer appear directly. This
   is the D13 behaviour, achieved by a rule rather than by deleting the feature.
4. **Retrospective display is mandatory.** `How this was answered` (I-05) always lists the stages
   that ran with their real elapsed milliseconds, plus the tools and record counts. The
   transparency §53 wants is delivered as evidence after the fact rather than as animation during.
5. **[ARCH]** An async provider drives the same strip live from the same events, with no panel
   change. If a stage exceeds 10 s the strip shows `Still working – {stage}` and a `Cancel` button
   that calls `provider.abort(turnId)`.

---

## 10. Worked traces

All figures below were re-derived from `data/seed.json` and match `data/oracle.json`.

### 10.1 §63 Test 4 (AI-4) – "Show its competitors within 3 km"

**Precondition.** `Trilliant` (`BC-82f0eb0b80b7`, A+, $44.7/m²/month, Yunusobod, 41.315878 /
69.28243) is open in the property drawer, so `state.selectedId === 'BC-82f0eb0b80b7'`.
`aiSession.contextId === null`, `contextPinned === false`. Demo mode off, no filters, role internal.

**Parse.**

```
normalised   : "show its competitors within 3 km"
refinement   : no leading marker -> scope 'all', mode 'replace' (irrelevant: no filter tools)
slots        : radiusKm = 3            (/within\s*([\d.,]+)\s*(km)/)
               subjectRef = 'pronoun'  ("its")
intent score : competitors.radius -> patterns 1×2 + keywords {competitor, within} 2×1 + required
               slot subjectRef 1×0.5 = 4.5 ; maxScore 5 -> matchScore 0.90
resolve      : contextPinned false -> state.selectedId -> 'BC-82f0eb0b80b7'
```

**Plan.**

```js
{ intent:'competitors.radius', matchScore:0.90,
  slots:{radiusKm:3}, resolved:{subjectId:'BC-82f0eb0b80b7', subjectName:'Trilliant'},
  scope:'all', responseTemplate:'competitors.radius', requiresConfirmation:false,
  steps:[
    {id:'s1', tool:'getProperty',          args:{id:'BC-82f0eb0b80b7'}},
    {id:'s2', tool:'getNearbyProperties',  args:{id:'BC-82f0eb0b80b7', radiusKm:3, excludeSelf:true}},
    {id:'s3', tool:'getCompetitiveSet',    args:{id:'BC-82f0eb0b80b7', radiusKm:3}},   // -> competitiveBandKm 3
    {id:'s4', tool:'calculateMetric',      args:{recordIds:{$:'s2.recordIds'}, field:'askingRent', kind:'mean'}},
    {id:'s5', tool:'aggregateByClass',     args:{recordIds:{$:'s2.recordIds'}}},
    {id:'s6', tool:'createRadius',         args:{id:'BC-82f0eb0b80b7', bandsKm:[3]}},
    {id:'s7', tool:'createMapLayer',       args:{name:'Competitors within 3 km of Trilliant',
                                                criteriaMachine:{type:'radius', origin:{…}, radiusKm:3, excludeSelf:true},
                                                criteriaHuman:'Within 3 km of Trilliant …',
                                                recordIds:{$:'s2.recordIds'},
                                                owns:{radiusSubjectId:'BC-82f0eb0b80b7'}}},
    {id:'s8', tool:'generateTable',        args:{title:'Suggested competitive set', columns:[…], rows:{$:'s3.qualified'}}}
  ]}
```

**Tool results (real values).**

| step | tool | in | out |
|---|---|---|---|
| s1 | `getProperty` | 1 | Trilliant; recordConfidence **Low** (office class and rent both carry the `2GIS-CLASS`/`2GIS-RENT` Low profile); completeness band `minimal` (2 of 8 critical fields) |
| s2 | `getNearbyProperties` | 148 | **74** within 3 km (cumulative, subject excluded) |
| s3 | `getCompetitiveSet` | 74 | `bandKm` **3** (the band the user named, not the widest); **9 qualified**, **63 proximity-only** (class not recorded), **2 excluded** (`Panoramic` B, `Nova Minor` B – more than one band from A+) |
| s4 | `calculateMetric` | 74 | mean asking rent **$31.24**, n **11** of 74 |
| s5 | `aggregateByClass` | 74 | A+ 2 · A 7 · B+ 0 · B 2 · C 0 · **Class not recorded 63** |
| s6 | `createRadius` | – | `state.radius = {id:'BC-82f0eb0b80b7', km:[3]}` |
| s7 | `createMapLayer` | 74 | `LYR-1`, count 74, `owns.radiusSubjectId` set |
| s8 | `generateTable` | 9 | 9 rows: name · class · distance · rent · why included |

The 9 qualified: Orient (A, 535 m) · Nova Plaza (A, 695 m) · Forum Business Center (A+, 875 m) ·
Infinity Business Сenter (A, 1 745 m) · Gross Plaza (A, 2 075 m) · Kayan (A, 2 406 m) ·
Nest one (A+, 2 624 m) · Platform (A, 2 683 m) · Sapphire Business Center (A, 2 969 m).

**State mutations** (all `{source:'ai', action:'ai:competitors', tools:[…]}`):

```js
{ radius: {id:'BC-82f0eb0b80b7', km:[3]},
  aiLayers: [ …, {id:'LYR-1', count:74, …} ],
  rightTab: 'ai',
  aiSession: { lastIntent:'competitors.radius', lastResultIds:[74 ids],
               lastResultLabel:'Competitors within 3 km of Trilliant',
               lastLayerId:'LYR-1', lastRadiusId:'BC-82f0eb0b80b7', turnSeq:1 } }
```

`state.filters` is **not** touched – a competitive set is a layer, not a filter (§6.3), so the
results list still shows all 148 and the left rail correctly shows no active filter.

**Rendered response.**

> **Answer** · *Platform data + AI inference*
> 74 business centres sit within 3 km of **Trilliant** (Yunusobod, class A+, asking $44.7/m²/month).
> Of those, 9 qualify as a suggested competitive set on distance and office class; 63 could not be
> qualified because their class is not recorded.
>
> **Analysis**
> · Within 3 km – **74 properties** · All 74 properties in the current selection. *Calculated*
> · Average known asking rent nearby – **$31.2 /m²/month** · Based on 11 of 74 properties with
>   verified asking rent. *Calculated*
> · Total known GLA nearby – **Insufficient verified data** · No properties in the current
>   selection have verified GLA. *Not available*
> · Class mix nearby – A+ 2 · A 7 · B+ 0 · B 2 · C 0 · **Class not recorded 63**. *Platform data*
> · **Suggested competitive set – 9 properties** (table, with a "why included" column). *AI inference*
>
> **Map actions**
> · Drew a 3 km circle around Trilliant  [×]
> · Created layer **"Competitors within 3 km of Trilliant"** – 74 properties  [×]
> · Filters unchanged – the results list still shows all 148 properties.
>
> **Data coverage**
> · Asking rent is recorded for 11 of the 74 properties within 3 km.
> · Office class is recorded for 11 of the 74 properties within 3 km.
> · GLA, vacancy, available area and building status are recorded for 0 of 74.
>
> **Confidence / limitations**
> · This is a *suggested* competitive set, not a definitive peer group. Add or remove properties to
>   reflect market knowledge.
> · 63 of the 74 nearby properties have no recorded office class and could not be qualified. They
>   are listed separately and are **not** counted as peers – the real peer group is likely larger
>   than 9.
> · Building size was not used: GLA is not recorded for Trilliant or for any nearby property.
> · *Assumption:* the class band is ±1 step (A+ therefore admits A+ and A). 2 properties
>   (Panoramic, Nova Minor – class B) were excluded on that rule alone.
> · *Assumption:* 3 km was taken from your request. Bands are cumulative and Trilliant is excluded
>   from its own counts. Great-circle distance, sphere radius 6 371 008.8 m.
> · Trilliant's own class and rent carry **Low** confidence – both are directory claims, not
>   landlord-confirmed.
>
> **Sources**
> · 2GIS (CASE Tashkent Geo Master seed) · map service · retrieved 19 Jul 2026 · 148 records ·
>   single source per record; commercial terms unverified.
> · Toshkent shahar chegarasi (2024) · public registry · 12 district polygons.

**Map.** 3 km circle centred on Trilliant (1 px `--line-strong` stroke, 6 % `--case-red` fill);
Trilliant keeps its selected treatment; the 74 layer members gain a `--case-red` ring; the 9
qualified members get a solid ring, the 63 proximity-only a dashed ring with the legend line
`dashed = class not recorded, could not be qualified`. Markers keep their class colours – the layer
never repaints the class encoding. Clusters below zoom 13 remain, with the layer ring drawn on the
cluster bubble as a partial arc proportional to members included.

**Acceptance mapping.** AI-4(a) subject named in the Answer ✓ · (b) 3 km circle ✓ · (c) layer with
74 ✓ · (d) 9 qualified / 63 unqualified listed separately ✓ · (e) inclusion rule explained and the
63 stated ✓ · (f) removing `LYR-1` removes the circle via `owns.radiusSubjectId` ✓.

### 10.2 §63 Test 3 (AI-3a) – "Which district has the most known Class A GLA?"

This is the key §47/§62 test: the sentence is well-formed, the intent is matched correctly, every
component exists – and the answer must still be a refusal, because **GLA is recorded for 0 of 148
observed records**.

**Parse.**

```
normalised   : "which district has the most known class a gla"
refinement   : none -> scope 'filtered' (no filters active -> all 148)
slots        : groupBy    = 'district'      (/district/)
               metricField= 'gla'           (aiName 'gla')
               classes    = ['A']           (/class\s*(a)/ after homoglyph fold)
               kind       = 'sum'           ("most" + a quantity field -> sum)
               direction  = 'desc'
intent       : rank.districtBy, matchScore 0.95
gate         : GEO.ai.gate(rows(classes=['A']), 'gla', 'any')
               -> rows 8 (class A), known gla 0 -> ok:false
```

**Executor behaviour on a gate failure.** The plan's remaining steps are **not run**. No
`aggregateByDistrict`, no `generateChart`, no `applyFilters`, no layer. `state` is written **not at
all** – not even `rightTab`. The only side effect is the audit entry and the appended turn.

Two coverage facts are fetched for the message (both read-only): `getDataCoverage({field:'gla'})`
over all 148 → 0/148, and over the class-A subset → 0/8. `aiSession.lastResultIds` is left
unchanged.

**Rendered response** (`outcome:'refused'`, answer pill **Not available**).

> **Answer** · *Not available*
> **The current dataset is insufficient to answer this reliably.** GLA is recorded for **0 of 148**
> properties – and for 0 of the 8 class A properties – so Class A GLA cannot be ranked by district.
> I have not produced a figure.
>
> **Analysis**
> No figures were calculated for this request. Producing a district ranking from the fields that do
> exist would answer a different question, so I have not substituted one silently.
>
> **Map actions**
> Nothing was changed on the map. The current selection (all 148 properties, no filters) is
> unchanged.
>
> **Data coverage**
> · GLA: recorded for **0 of 148** properties. · GBA: **0 of 148**. · Typical floor plate: **0 of 148**.
> · Office class: recorded for 16 of 148 (A+ 4 · A 8 · B+ 1 · B 3 · C 0; 132 not recorded).
> · The seed is a single desk collection from one map service on 19 Jul 2026. Building areas were
>   not part of that collection.
>
> **Confidence / limitations**
> · To answer this we would need **recorded GLA per building** – from a landlord or agent schedule
>   of areas, a technical passport, or a field survey. Floor count and floor plate would let GLA be
>   approximated, but both are also recorded for 0 of 148, and an approximation would not be market
>   evidence.
> · Even with GLA, a ranking over the 8 class A records would describe the *recorded* sample, not
>   Tashkent's class A stock. Class itself is recorded for only 16 of 148.
>
> **Sources**
> · 2GIS (CASE Tashkent Geo Master seed) · map service · retrieved 19 Jul 2026 · 148 records.
>
> **You could ask instead** *(clickable)*
> · "Which district has the most Class A and A+ offices?"  → answerable by count
> · "Show average known rent by district"                  → answerable for 3 districts
> · "Which buildings need data verification?"              → builds the GLA collection backlog

**The answerable substitute (AI-3b), traced.** `"Which district has the most Class A and A+
offices?"` → same intent, `metricField` unset, `kind:'count'`, `classes:['A','A+']`. Gate is run
against `officeClass` (16/148, ok). `aggregateByDistrict({recordIds: 12 class A/A+ ids, kind:'count'})`:

| rank | district | class A / A+ properties |
|---|---|---|
| 1 | **Yunusobod** | **4** |
| 2 | Mirobod | 3 |
| 3 | Yakkasaroy | 2 |
| 3 | Yashnobod | 2 |
| 5 | Shayxontohur | 1 |
| 6 | Mirzo Ulugbek, Chilonzor, Olmazor, Sergeli, Uchtepa | 0 |
| – | Bektemir, Yangihayot | 0 – no business centres recorded at all |

Actions: bar chart (P1, single series, `--data`), ranked table (P2), `applyFilters({classes:['A','A+'],
includeUnknownClass:false})` so the left rail mirrors the 12 (§59), district polygon highlight on
Yunusobod, layer `Class A / A+ offices` (12).

Coverage line, verbatim: *"Based on 12 of 148 properties with class A or A+ recorded; office class
is recorded for 16 of 148, so 132 properties are excluded from this ranking."*
Limitation, verbatim: *"A district with 0 here means no class A or A+ property is **recorded**
there – not that none exists. Bektemir and Yangihayot contain no recorded business centres of any
class."*

There is **no tie at the top**: Yunusobod has 4 outright, because `Trilliant` is assigned by polygon
to Yunusobod (contract D1), not to Mirzo-Ulugbek as its source label claims. The tie-break rule
(alphabetical, stated) still applies to the rank-3 pair Yakkasaroy / Yashnobod and is printed.

### 10.3 Supporting trace – §63 Test 5 (AI-5), because its expected copy changes

`"Show properties with poor data quality"` → `quality.confidence`, `confidenceLevels:['Low','Unknown']`,
`qualityAspect:'all'`. `getDataQuality` returns, computed from the seed under the D3 per-field model
(`D.recordConfidence` = weakest confidence among known critical fields plus name/lat/districtKey):

| bucket | count |
|---|---|
| confidence Low | **16** |
| confidence Medium | **132** |
| confidence High / Unknown | 0 / 0 |
| completeness `none` (0 of 8 critical fields) | **132** |
| completeness `minimal` (1–2) | **16** |
| past due for verification | **0** (all collected 19 Jul 2026 = 59 days; fast-field interval 60 d) |
| possible duplicates | 12 records in 6 flagged groups, plus 3 unflagged pairs under 30 m |
| district label conflicts | 10 |

Answer text must carry the genuine and counter-intuitive finding:

> 16 properties are graded **Low** confidence and 132 **Medium** – but the 16 are the *best
> covered* records, not the worst. They are Low precisely because they carry an office class and an
> asking rent, and both come from a directory listing rather than a landlord or a survey. The other
> 132 are Medium only because they contain nothing beyond a name, a coordinate and an address.
> By coverage, the weaker group is the 132: none of them has a single one of the 8 critical fields.

Two layers are created, and the answer says why there are two:
`Low-confidence values (16)` and `No critical fields recorded (132)`.
`applyFilters({confidence:['Low']})` mirrors the first in the left rail (AI-5c).

This supersedes `01-product-spec.md` AI-5(a) ("all 148 are Medium") and AI-5(b)
("completeness < 40"), both of which predate contract D3 and D9.

---

## 11. Built now vs architecture-ready

| # | Capability | Status |
|---|---|---|
| 1 | Provider adapter, `interpret() -> Plan`, plan executor, `$`-binding | **NOW** (one provider registered) |
| 2 | 28 registered tools with typed args, access classes, timing | **NOW** |
| 3 | ~30 intents, EN + RU patterns, homoglyph fold, district aliases | **NOW** |
| 4 | Coverage gate, refusal as a first-class outcome, alternatives | **NOW** |
| 5 | Six-block response, six provenance tags (five emitted) | **NOW** |
| 6 | AI Layers: create / show / hide / rename / remove / inspect / zoom, stale detection | **NOW** |
| 7 | AI ↔ manual filter sync, divergence reporting, build lint | **NOW** |
| 8 | Role model, per-tool access, field stripping for external, export confirmation | **NOW** |
| 9 | Per-turn audit log + export | **NOW** (in memory) |
| 10 | Stage instrumentation with the 120 ms paint guard | **NOW** |
| 11 | LLM provider (`describeTools`, async `interpret`, live stage strip, `abort`) | **[ARCH]** |
| 12 | Multi-step dependent planning, clarifying questions, plan repair | **[ARCH]** (`canPlanMultiStep` flag exists, unused) |
| 13 | `EXTERNAL` provenance tag – external retrieval, source display (§48) | **[ARCH]** (tag defined, renderer built, no producer) |
| 14 | Persist tools: field tasks, record edits, draft records (§50) | **[ARCH]** (registered, blocked with A13) |
| 15 | Internal dataset joins: leasing, tenants, brands, prior studies (§49) | **[ARCH]** (role gate exists; no datasets) |
| 16 | Derived layers: office density, rent concentration, competitive intensity (§42) | **[ARCH]** (in the layer-type registry, refused by naming the missing field) |
| 17 | Audit persistence, per-user attribution, retention (§61) | **[ARCH]** |
| 18 | Saved analyses / shareable workspaces (§39) | **[ARCH]** |
