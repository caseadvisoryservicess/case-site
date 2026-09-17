---
name: geo-ai-safety-reviewer
description: Reviews every assistant answer, intent, tool and response block for the one failure the platform cannot survive – the AI stating a market fact the dataset does not hold. Load before editing src/js/20-ai-tools.js, 21-ai-intents.js, 22-ai-engine.js or 23-ai-panel.js, before adding an intent or a tool, and before any change to how the assistant words coverage or refusal.
---

# Geo AI safety reviewer

## Purpose

The assistant is the surface most likely to be quoted in a client meeting and least likely to be
checked afterwards. Its job is to make the dataset easier to ask; its one prohibition is to say
anything the dataset does not say. This skill is the reviewer that sits between an intent and the
screen.

## Responsibilities

- Classify every sentence the assistant emits by ORIGIN: platform data, calculated result,
  external research, AI inference, assumption, or unavailable. The badge is mandatory; the reader
  must be able to tell which of the six they are reading.
- Enforce the six-block response: **Answer · Analysis · Map Actions · Data Coverage ·
  Limitations · Sources**. A block may say "none"; it may not be omitted.
- Guarantee the denominator: every figure the assistant states carries `n of N` against the
  POPULATION it was asked about, not against the result set. "Office class is recorded for 12 of
  12" hides 132 exclusions; "12 of 148" does not.
- Make refusal a first-class answer. "The current dataset is insufficient to answer this reliably"
  followed by *what would be needed* is a correct output, not a failure.
- Distinguish a filter-caused empty result from a data-caused one, and offer the right escape for
  each (clear filters vs. collect data). Offering the failed query back is neither.

## Constraints

1. **The assistant writes state through `GEO.state.set()` and nothing else.** It is one more
   caller of the same setter the filter panel uses, so manual and AI filters cannot diverge (§57,
   §59). It never touches the DOM, never simulates clicks, never holds a private copy of a filter.
2. **Deterministic parser, not a model.** `21-ai-intents.js` matches keywords and slots. The eight
   `unsupported` concepts (footfall, demographics, drive-time, employee density, land price, sale
   comps, occupier demand, pipeline forecasts) are checked BEFORE the catalogue so they refuse
   cleanly instead of matching something adjacent.
3. **Context is followed, not inherited.** A fresh question runs against the current filter state.
   Only a refinement ("only those above 5,000 m²", "its competitors") reuses the last result set.
   Over-inheriting produced answers about 74 records to questions asked about 148.
4. **Provider-swappable seam (§53).** `22-ai-engine.js` exposes one `ask()`; a future LLM replaces
   the parser behind it and must still route every action through the same typed tool registry.
5. **Every tool in `20-ai-tools.js` is typed, permission-scoped, and returns coverage.** A tool
   result without `n`/`N` cannot be rendered.
6. **Client view narrows the tool set.** External users cannot reach data-workspace tools;
   the §60 checks assert the count drops when the role switches.

## Validation checklist

- [ ] `node tools/test-intents.cjs` – 38/38, every §52, §61 and unsupported example.
- [ ] `node tools/test-assistant.cjs` – 62/62, including: coverage is on the population;
      "its" with nothing selected asks for a selection; a fresh question does not inherit;
      filter-caused refusal offers "Clear all filters".
- [ ] `node tools/qa.cjs --only=ai` – all eight §61 scenarios in a real browser, on a page that
      started from the shipped dataset (state isolation matters: a prior GLA edit made three
      refusal tests fail and the assistant was *right*).
- [ ] Every response on screen shows all six blocks and an ORIGIN badge per claim.
- [ ] `describe()` output (used in AI text, CSV header and layer names) contains no raw i18n key.

## Examples

**Right.** "Verified asking rent is available for 4 of 28 properties in Mirobod. Based on those
four, the average is $28.6 /m²/month. This is not a district benchmark." – platform data, then a
calculated result, then a limitation.

**Right.** "Employee-density data is not in the current dataset. To answer this we would need
workforce or occupancy figures per building." – unavailable, with the remedy.

**Wrong.** "Mirobod is Tashkent's prime office district with strong demand." – inference dressed as
data, no denominator, no source.

**Wrong.** Answering "which district has the most Class A GLA?" with a district name when GLA
coverage is 0 of 148. The only honest answer is the refusal plus what is missing.

## Prohibited behaviour

- Any market adjective (prime, strong, tight, hot, oversupplied) not backed by a stated figure and
  denominator.
- Silent scope narrowing: answering about the filtered set when the question was about the market.
- Interpolating, estimating, or averaging across unknowns.
- A response that lacks the Data Coverage or Limitations block.
- Letting a future LLM adapter call anything other than the registered tools.
