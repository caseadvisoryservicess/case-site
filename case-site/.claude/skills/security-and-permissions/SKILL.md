---
name: security-and-permissions
description: What an external user may see and do versus an internal one, where credentials live, and what an inlined single-file app must never carry. Load before touching the role switch, the assistant's permission scoping, the data workspace, any credential or endpoint field, or the build's data inlining.
---

# Security and permissions

## Purpose

There is no auth server in the MVP – by design (§4). That makes permissions a matter of
architecture rather than login: the concepts must be built in now so the production system
inherits a shape, not a retrofit. This skill holds those concepts and the few real security
surfaces a `file://` app has.

## Responsibilities

- Own the role model: `state.role` ∈ `client` | `internal`. Client view hides the data
  workspace, the editor, the quality queue, and narrows the assistant's tool set (§58, §60).
- Own credential handling: licensed tile endpoints and future API keys are per-browser
  (`GEO.storage`), never in the dataset, never in an export, never in `seed.json`, never in git.
- Own the build's inlining safety: `js_safe()` escapes `<`, ` `, ` ` in inlined JSON so
  a `</script>` inside a scraped note cannot terminate the block.
- Own the audit trail: the state session log records every `set()` with `source` (`user` /
  `assistant` / `system`) and `action`; the assistant's tool calls are logged with arguments.

## Constraints

1. **Permission is on the tool, not on the UI.** Every registered assistant tool declares
   `permission`; the client role filters the registry. Hiding a button is not a permission.
2. **Local edits are marked local.** Every admin change carries `editedLocally` and is visibly
   flagged on the card, the list and the export header (§20, §72.14). `#reset` clears them.
3. **Demo records are excluded from client-facing statistics unless demo mode is on**, and then
   the banner is non-dismissible and prints.
4. **No secret ships in the file.** `grep` the built `index.html` for `key=`, `apikey`,
   `Bearer`, `sk-`, `AIza` before every commit.
5. **Endpoints must be `https`** and must be XYZ templates; anything else is refused with a
   reason, because a URL without `{x}{y}{z}` silently renders one tile everywhere.
6. **External data never becomes verified platform data silently** (§46). The three ORIGIN
   classes stay distinct end to end.
7. **Permanent changes require a named human** – `--apply --reviewer`, a duplicate verdict, an
   endpoint paste. The name is recorded.
8. **Third-party code is reviewed before adoption (§71)**: licence, install scripts, network
   calls, key requirements. Four of the twelve reference repos have no licence file; nothing is
   copied from them.

## Validation checklist

- [ ] `node tools/qa.cjs --only=checks` – §60: client view hides the data workspace; the
      assistant exposes fewer tools; switching back restores.
- [ ] `grep -iE "apikey|api_key|bearer|sk-[a-z0-9]{10}|AIza" index.html` returns nothing.
- [ ] Every export header names `exportedBy`, the role, and whether local edits are included.
- [ ] `build.py` refuses malformed seed JSON and escapes `<` in every inlined payload.
- [ ] `data/incoming/` is gitignored; `source-reachability.json` carries no credentials.

## Examples

**Right.** A licensed 2GIS endpoint pasted in Settings: stored under `basemap.endpoints` in
`localStorage`, shown as "unlocked", absent from every export.

**Wrong.** Committing `TWOGIS_API_KEY=…` into `tools/sources.py` "for convenience".

**Wrong.** Letting the client role reach `exportDataset` because the button is hidden anyway.

## Prohibited behaviour

- Credentials in source, in the seed, in exports, in commit messages, or in the built file.
- A tool without a `permission` field.
- Any unlabelled path from external research to a stored platform value.
- Executing an install script from a reference repo without reading it.
