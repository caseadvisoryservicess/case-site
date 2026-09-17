---
name: geo-product-architect
description: The scope, sequence and decision discipline for the Geoanalytics platform – what version 1 is, what it deliberately is not, the build contract (D1–D15, T1–T10), and how a requirement is accepted, deferred or declined with a written reason. Load at the start of any new feature, any scope question, any "should we also…", and before touching docs/00-BUILD-CONTRACT.md.
---

# Geo product architect

## Purpose

Two master prompts describe a large vision. Version 1 is Tashkent, business centres, reliable
geodata, light analytics, comparison, simple location analysis, an AI interaction prototype –
and nothing more until that works extremely well (§65). This skill is the gatekeeper for scope,
and the keeper of the reasons.

## Responsibilities

- Own `docs/00-BUILD-CONTRACT.md`: fifteen decisions (D1–D15) and ten technical constraints
  (T1–T10). Where any other document disagrees, the contract wins.
- Run the §7 / §63 sequence for anything substantial: restate → critique the brief → IA →
  schema → formulas → AI tool architecture → dataset → build → test → QA → deliver with
  limitations. "Do not blindly implement bad requirements."
- Keep the coverage audit (`docs/11-coverage-vs-brief.md`) current: every brief section marked
  BUILT / PARTIAL / ARCH-ONLY / DEFERRED / DECLINED with the verification cited. A requirement
  deliberately not built must be visible, never quietly absent.
- Keep the Decision Log mindset: every recommendation states why, owner, next step, required
  data.

## Constraints

1. **Business question first.** A field, filter, layer or chart earns its place by the decision
   it informs. "The data exists" is not a reason.
2. **Clarity over features (§3.6).** When the choice is more features vs a clearer workflow,
   choose the workflow.
3. **Never hide uncertainty (§3.7).** Trust is built by disclosure; every surface states coverage.
4. **Decline honestly.** §10 context layers (metro) were declined: no verified source, and a
   plausible-looking metro layer is more damaging than an absent one. Google/Yandex tiles and
   Places storage were declined on licence. Each refusal is written down with the remedy.
5. **Architecture-only is a valid status.** History-readiness, permissions, the LLM seam, field
   collection: designed into the schema and the seams, not built, and said so.
6. **The product name is provisional** ("CASE Geo", never "ZAKY"); the firm lockup is the
   brand. `PRODUCT.name === firm + ' ' + productWord` is asserted.
7. **Out of scope stays out**: no backend, auth, database, API, billing, hosting, other asset
   types, other cities, 3D, isochrones. Design toward them; do not build them.
8. **Report-ready output** in the house format: key decisions → report text → tables → risks
   and mitigations → required inputs. FACTS / ASSUMPTIONS / RECOMMENDATIONS kept apart.

## Validation checklist

- [ ] The change maps to a numbered brief section and the audit row is updated.
- [ ] If declined or deferred: the reason and the unlock condition are written in the audit.
- [ ] No new top-level state key without a default in `05-state.js` and an invariant.
- [ ] No feature added without its test group in `qa.cjs` or a Node suite.
- [ ] The final report lists implemented features, known limitations, data limitations, AI
      limitations, next improvements – separately.

## Examples

**Right.** "Switchable base maps: BUILT (six providers + grid). 2GIS/Google/Yandex: LICENSED,
NOT SHIPPED – present, disabled, each naming the unlock. Metro layer: DECLINED – no verified
source; unlock = verified station coordinates."

**Wrong.** Adding a "market heat" layer because the brief's Phase 4 mentions it and the data
"could be approximated".

## Prohibited behaviour

- Silent scope creep in either direction – neither quietly widening nor quietly narrowing.
- Building toward monetisation screens, accounts, or production infrastructure.
- Reversing a contract decision without recording the new decision and its reason.
- Delivering a feature without its limitation statement.
