---
name: geo-ai-tool-designer
description: How to add or change an assistant capability the right way – as a typed tool in the registry, an intent that maps to it, and a response the safety reviewer can pass. Load when the ask is "make the AI able to…", when adding to src/js/20-ai-tools.js or 21-ai-intents.js, or when designing the future LLM adapter.
---

# Geo AI tool designer

## Purpose

Every assistant capability is three things, in order: a **tool** (a typed function over platform
data that returns coverage), an **intent** (a deterministic pattern that selects the tool and fills
its slots), and a **response** (six blocks, ORIGIN-badged). Designing any one without the other two
produces either a dead intent or an unreachable tool. This skill keeps the three in step.

## Responsibilities

- Define tools in `GEO.ai.tools` with: `id`, `description`, `params` (typed), `permission`
  (`external` | `internal`), `run(ctx, args) -> {ok, data, n, N, coverageText, mapActions[]}`.
- Define intents in `21-ai-intents.js` with: `id`, `patterns` (EN + RU, no `\b` around Cyrillic –
  JS `\b` is ASCII-only), `slots`, `tool`, `examples[]`, `needsSelection`.
- Keep the future adapter seam honest: an LLM may choose *which* registered tool and *which* args;
  it may never bypass the registry.

## Constraints

1. **A tool returns coverage or it does not exist.** `n` and `N` are required fields of every
   result. The response builder refuses to render a figure without them.
2. **Tools read via `known()` and `GEO.data.workingSet()` only.** No tool touches DEMO records
   unless demo mode is on; the containment seam is the one place observed and DEMO may meet.
3. **Tools write via `GEO.state.set()` only, with `source: 'assistant'`.** Filters, selection,
   radius, layers – all state. No DOM.
4. **Slots are parsed, never guessed.** "more than 2,000 m2 available" → `availableArea ≥ 2000`,
   checked after the unit token as well as before it. `A+` needs `(?!\w)` not `\b` – there is no
   word boundary after `+`. A trailing period is stripped before matching. District names resolve
   through `GEO.schema.districtAliases`, the one table every consumer shares.
5. **Refinement vs. fresh question is decided by the intent, not by default.** Only intents flagged
   `refines: true` read `aiSession.lastResultIds`.
6. **Unsupported concepts are intents too**, checked first, mapped to a refusal tool that names
   what data would be needed.
7. **A saved layer freezes its record ids.** A layer keeps the properties that matched when it was
   made; a filter is re-evaluated. Both are shown to the user; neither is confused with the other.

## Validation checklist

- [ ] New intent has ≥2 EN and ≥1 RU example in `examples[]`, and `node tools/test-intents.cjs`
      covers each.
- [ ] New tool has a `test-assistant.cjs` case asserting its `n`, `N` and coverage wording.
- [ ] `permission` is set; `node tools/qa.cjs --only=checks` shows the external tool count is
      lower than internal.
- [ ] The intent appears in the suggestion chips only if its example runs against the shipped data.
- [ ] `GEO.ai.tools` count in the self-test matches the registry length.

## Examples

**Right – a tool.**
```js
T.register({
  id: 'aggregateByDistrict',
  permission: 'external',
  params: { field: 'string', stat: 'count|mean|median|sum' },
  run: function (ctx, a) {
    var rows = ctx.rows, out = GEO.analytics.byDistrict(rows, a.field, a.stat);
    return { ok: true, data: out.rows, n: out.n, N: rows.length,
             coverageText: GEO.fmt.coverage(out.n, rows.length, a.field),
             mapActions: [{ type: 'highlightDistrict', key: out.top && out.top.key }] };
  }
});
```

**Right – an intent.** `patterns: [/by district/i, /по район/i]`, `tool: 'aggregateByDistrict'`,
`slots: { field: fieldFromText, stat: statFromText }`.

**Wrong.** An intent whose handler calls `document.querySelector('#fx-class-A').click()`.

**Wrong.** A tool that returns `{ average: 32.2 }` with no `n`/`N`.

## Prohibited behaviour

- Free-text answers assembled outside the six-block builder.
- Tools that compute over `null` as `0`.
- Intents that match on a bare noun ("rent") without an action or a comparison.
- Adding a provider SDK call anywhere except behind `22-ai-engine.js`'s `ask()` seam.
