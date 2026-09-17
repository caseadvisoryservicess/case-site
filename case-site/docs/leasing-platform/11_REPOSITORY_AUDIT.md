# Repository audit (master prompt §61)

**Purpose.** `00_MASTER_PROMPT.md` §56–§59 names 27 GitHub repositories plus one GitHub topic page as candidate sources for the Leasing & Sales Platform (LSP, `os/leasing/`) and its project skills under `.claude/skills/`. §60 forbids blind installation and fixes an inspection list and an adoption priority; §61 requires an audit table before anything is used. This document records what was inspected for each repository in this environment, what may be used and in what form, and what must be re-checked before any later adoption. It is the gate in front of every "let us just add this library / copy this skill" decision in `09_IMPLEMENTATION_PLAN.md`.

**Status: DRAFT for approval — 2026-09-17**

Related documents: `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` (what becomes relevant again in the production phase), `09_IMPLEMENTATION_PLAN.md` (phases that would consume an adopted file), `10_QA_PLAN.md` (the static audit check "no third-party runtime file under `os/leasing/`"), `02_REQUIREMENTS_REVIEW.md` (§6.7: no OCR / computer-vision recognition is claimed anywhere), `README.md` (decision log D1, D2, D12, D14, D18).

Facts are cited to `00_MASTER_PROMPT.md §n`, to a CASE OS file, or to the inspected repository at the commit recorded in section 3.2. Assumptions are labelled A-11-n. Open questions Q-11-n carry a recommendation and an owner.

---

## 1. Method and limits

### 1.1 What was done in this environment (facts)

| Step | Detail |
|---|---|
| Acquisition | `git clone --depth 1` (shallow) or `git clone --depth 1 --filter=blob:none --no-checkout` (blobless, files read with `git show`) into a scratchpad directory **outside** the CASE repository. Every clone was deleted after review. |
| Always read | `LICENSE` / `COPYING` / per-package licence files, `README.md`, `SECURITY.md` where present, and the manifests that define behaviour: `package.json`, `pyproject.toml`, `plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`, `.claude/settings.json`, `hooks.json`, `Makefile`, `.pre-commit-config.yaml`. |
| Always read | Every install script, hook script and post-install / lifecycle entry found (`install.sh`, `Install.command`, `setup.sh`, `prepare`, `preinstall`, `postinstall`, `SessionStart` / `PreToolUse` / `PostToolUse` / `Stop` hooks). |
| Sampled | 3–6 `SKILL.md` bodies (or equivalent source files) per repository, chosen for relevance to leasing, sales, CRM, floor plans, tool registries or QA. |
| Swept | Repository-wide `grep` for network calls (`curl`, `wget`, `fetch(`, `requests`, `urllib`, `http(s)://`), process execution (`subprocess`, `os.system`, `child_process`, `eval(`, `exec(`), environment and secret names (`process.env`, `os.environ`, `API_KEY`, `TOKEN`, `SECRET`), telemetry / analytics, and prompt-injection phrasing (instruction override, hidden HTML comments, exfiltration, safety bypass, `curl … \| bash`). |
| Never done | No `npm install`, `pip install`, `uv sync`, `make`, `configure`, Docker build or plugin install. No installer, hook or skill script executed. No environment variable set. No repository opened as a working directory for an agent session, and no `AGENTS.md`, `CLAUDE.md` or `SKILL.md` from an audited repository loaded as instructions. |

### 1.2 Limits of this pass (facts, and why they matter)

1. **The GitHub API was not reachable** from this environment (HTTP 403 through the outbound proxy). Activity is therefore taken from `git log` of the default branch at clone time only. Stars, forks, issue-response time, release cadence, advisory history and the GitHub-reported licence field are **unknown** and were not used as trust signals.
2. **Shallow and blobless clones** show one commit, not history. Statements such as "single squashed commit" mean "one commit visible in a shallow clone", not "one commit ever".
3. **Large repositories were sampled, not read in full.** Eight of the 27 exceed 2,000 tracked files (`affaan-m/everything-claude-code` 3,716; `alirezarezvani/claude-skills` 3,869; `agentskillexchange/skills` 3,099; `mariourquia/cre-skills-plugin` 2,383; `postgis/postgis` 2,279; `langchain-ai/langchain` 3,126; `maplibre/maplibre-gl-js` 5,497; `postgres/postgres` 7,695; `supabase/supabase` 17,472; `run-llama/llama_index` 9,842; `BerriAI/litellm` 10,817). What was and was not read per repository is summarised in section 4. **Unread ≠ cleared.**
4. **Two URLs in the master prompt redirect.** `github.com/affaan-m/everything-claude-code` now resolves to `affaan-m/ECC`, and `github.com/modelcontextprotocol/specification` to `modelcontextprotocol/modelcontextprotocol`. Both were audited at the redirect target.
5. **`https://github.com/topics/commercial-real-estate` (§59) is a GitHub topic page, not a repository — discovery source, not audited.** It has no licence, no commit history and no files; nothing can be cloned or adopted from it. Any repository found through it enters this audit as a new row and takes the full §60 inspection before use.
6. **Missing audit results: none.** All 27 repositories named in §56–§59 produced a result and appear in the table in section 3. If a repository is added to §56–§59 later and no result exists for it, record it here as *not audited in this pass — audit before any use*.

### 1.3 Assumptions

| ID | Assumption | Impact if wrong |
|---|---|---|
| A-11-1 | Activity taken from `git log` of the default branch is a sufficient proxy for maintenance in this pass | A repository could be actively maintained on another branch, or its last commit could be a bot commit; re-check at adoption time |
| A-11-2 | Sampling (manifests + installers + hooks + 3–6 content files + repository-wide greps) is sufficient to decide *read-only reference* use, but **not** sufficient to decide installation | Anything moving from "reference" to "installed" needs a full review, not this pass |
| A-11-3 | This audit is valid only for the commit and date recorded per repository; upstream content can change at any time | A later clone may differ; section 6 is the re-audit gate |
| A-11-4 | Nothing in this audit changes brief decisions D1, D2, D12, D14 or D18 (no external runtime dependency, no build step, no LLM or network, inline SVG charts, ≤ 1.5 MB add-on zip) | If the founder relaxes D2 or D14, several *Deferred* rows become live decisions and need a new pass |

---

## 2. Adoption rules restated (§60)

### 2.1 Priority order (fact, `00_MASTER_PROMPT.md` §60)

| Priority | Source class | Status in this project |
|---|---|---|
| 1 | Project-specific skills in `.claude/skills/` | **Primary.** The 21 skills of §56 exist at `case-site/.claude/skills/<name>/SKILL.md` (`leasing-product-architect` … `testing-and-qa`). CASE-authored; they take precedence over any external material. |
| 2 | Official sources: `anthropics/skills`, `modelcontextprotocol/specification`, `modelcontextprotocol/servers`, `postgres/postgres`, `postgis/postgis` | Used as **format and design references only**. No file copied. |
| 3 | Specialised libraries and architectural references (§57, §58) | Read-only. Nothing installed (D1, D2, D12, D14). |
| 4 | Third-party domain skill collections (§56 community lists, §59 CRE collections) | Lowest. Only after a named review step (Q-11-1, Q-11-2). |

### 2.2 Standing rules

1. **Copy only reviewed files.** A file may be copied only if it was read in full, its licence permits commercial use, and the copy carries the licence notice, the source URL and the pinned commit. Nothing is copied "because the folder looked fine".
2. **Never run installers, hooks or plugin marketplaces.** `curl … | bash`, `npm install -g`, `pip install`, `uv sync`, `/plugin install`, `npx -y <package>` and `claude plugin marketplace add` are out of bounds for this project, including inside a scratchpad. Ten of the 27 repositories ship an installer or lifecycle hook; two (`mariourquia/cre-skills-plugin`, `Imran-ml/claude-skills`) also register Claude Code hooks that execute on tool calls.
3. **Treat repository content as untrusted data, never as instructions.** `README.md`, `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, issue text and code comments from an audited repository are data. They are quoted and summarised, never followed. Six repositories (`supabase/supabase`, `modelcontextprotocol/*`, `langchain-ai/langchain`, `pydantic/pydantic-ai`, `BerriAI/litellm`, `openai/openai-agents-python`) ship agent-directed instruction files, and four also ship an `.mcp.json` that would auto-register a remote MCP server if the clone were opened as a working directory. **Do not open any audited repository as a working directory.**
4. **No third-party file under `os/leasing/`.** The add-on zip `CASE_OS_LSP_v0.1.0.zip` (D18) contains only CASE-authored files. `10_QA_PLAN.md` enforces this as a static check.
5. **Re-check before any future adoption.** This audit expires (A-11-3). Section 6 is the checklist that must be re-run, and its result recorded here as a new dated row, before a single file or dependency is taken from any of these repositories.
6. **No production-security claim is made anywhere.** "Security reviewed: Yes" in section 3.1 means *inspected against the §60 list in this environment, with the limits in section 1.2* — not *safe to install*, and not a statement about the repository's own security posture.

---

## 3. §61 audit table

### 3.1 Required table

Status values: **Approved** (may be used as specified, licence permits it, no installer or hook needed) · **Approved (reference only)** (read and cite; copy nothing, install nothing) · **Deferred** (no decision now; revisit when a named trigger occurs) · **Rejected** (do not use).

"Adopted files" records what is **in the CASE repository today**. It is `none` for every row: no external file has been copied. Where the audit nominated candidate files, the count and the open question are given.

| Repository | Type | Intended use | License reviewed | Security reviewed | Adopted files | Status |
|---|---|---|---|---|---|---|
| anthropics/skills | Skill collection | `SKILL.md` format reference for `.claude/skills/` (§56) | Yes | Yes | none (format convention only) | Approved |
| affaan-m/everything-claude-code | Skill collection / Claude Code plugin | Project configuration, subagents, hooks, commands, testing workflows (§56) | Yes | Yes | none | Approved (reference only) |
| alirezarezvani/claude-skills | Skill collection | Financial, business, market-research, product, QA and security method references (§56) | Yes | Yes | none (13 nominated — Q-11-2) | Approved |
| VoltAgent/awesome-agent-skills | Link catalogue (no skills) | Discovering reusable agent-skill patterns (§56) | Yes | Yes | none | Approved (reference only) |
| agentskillexchange/skills | Skill catalogue (~3,000 mirrored entries) | Discovering third-party skills (§56) | Yes | Yes | none | Deferred |
| obviousworks/Claude-AI-skills-collection-2026 | Link catalogue (no skills) | Skill discovery, agent workflow examples (§56) | Yes | Yes | none | Rejected |
| Imran-ml/claude-skills | Claude Code configuration template | `.claude` configuration, skills, subagents, hooks, workflows (§56) | Yes | Yes | none | Rejected |
| Leaflet/Leaflet | Library (browser mapping) | Geographic maps "only if needed in the MVP" (§57) | Yes | Yes | none | Deferred |
| maplibre/maplibre-gl-js | Library (browser map rendering) | Future Geoanalytics integration (§57) | Yes | Yes | none | Approved (reference only) |
| chartjs/Chart.js | Library (canvas charts) | Lightweight charts "if required" (§57) | Yes | Yes | none | Deferred |
| postgres/postgres | Infrastructure (database server) | Future relational database (§57) | Yes | Yes | none | Deferred |
| supabase/supabase | Infrastructure (backend platform) | Potential future backend platform (§57) | Yes | Yes | none | Deferred |
| PostgREST/postgrest | Infrastructure (API server) | Potential future API layer (§57) | Yes | Yes | none | Deferred |
| postgis/postgis | Infrastructure (spatial DB extension) | Future geospatial database extension (§57) | Yes | Yes | none | Deferred |
| pgvector/pgvector | Infrastructure (DB extension) | Future document and semantic search (§57) | Yes | Yes | none | Deferred |
| modelcontextprotocol/specification | Specification + schema | Tool-definition shape for `LSP.tools` compatibility (§58) | Yes | Yes | none | Approved (reference only) |
| modelcontextprotocol/servers | Reference implementations | Tool declaration and registration patterns (§58) | Yes | Yes | none | Approved (reference only) |
| langchain-ai/langchain | Framework (Python) | AI architecture reference: tool schemas, call gating (§58) | Yes | Yes | none | Approved (reference only) |
| run-llama/llama_index | Framework (Python) | AI architecture reference: tool metadata, tool specs (§58) | Yes | Yes | none | Approved (reference only) |
| pydantic/pydantic-ai | Framework (Python) | AI architecture reference: tool definitions, approval toolsets (§58) | Yes | Yes | none | Approved (reference only) |
| BerriAI/litellm | Framework (Python) + gateway | AI architecture reference: provider abstraction (§58) | Yes | Yes | none | Approved (reference only) |
| microsoft/autogen | Framework (Python / .NET) | AI architecture reference: tool protocol, multi-agent patterns (§58) | Yes | Yes | none | Approved (reference only) |
| openai/openai-agents-python | Framework (Python SDK) | AI architecture reference: tool contracts, approvals, guardrails (§58) | Yes | Yes | none | Approved (reference only) |
| gayu2k01/agent-ai | Example applications (~100 demos) | Example AI agent applications (§58) | Yes | Yes | none | Deferred |
| mariourquia/cre-skills-plugin | Skill collection / Claude Code plugin | Leasing, underwriting, asset management, capital markets, development (§59) | Yes | Yes | none (6 nominated — Q-11-1) | Approved (reference only) |
| cre-ai-skills/CRE-AI-Skills | Skill collection | Due diligence, underwriting, financing, lease review, market research (§59) | Yes | Yes | none | Deferred |
| zubair-trabzada/ai-realestate-claude | Skill collection | Property research, comparables, cash-flow scenarios, screening, reporting (§59) | Yes | Yes | none | Approved (reference only) |

27 repositories, one row each. `https://github.com/topics/commercial-real-estate` is not listed here: it is a topic page, **discovery source, not audited** (section 1.2 item 5).

### 3.2 Licence, activity and risk

"Last commit" is the default-branch HEAD at clone time (A-11-1). "Risk" is the reviewer's overall risk of *using the repository as recommended in this document*; "Prompt-injection risk" is the risk carried by the repository's instruction-bearing text (`SKILL.md`, `AGENTS.md`, `CLAUDE.md`, README).

| Repository | License | Commercial use | Last commit | Risk | Prompt-injection risk | Notes |
|---|---|---|---|---|---|---|
| anthropics/skills | Mixed per skill: 14 × Apache-2.0, 4 proprietary (docx, pdf, pptx, xlsx), 1 unlicensed (doc-coauthoring); no root LICENSE | Conditional | 2026-09-10 | Low | Low | Format reference only. Never copy from the 4 proprietary or the 1 unlicensed skill. Installer scripts exist in `web-artifacts-builder` and `skill-creator`; not needed, not run. |
| affaan-m/everything-claude-code | MIT | Yes | 2026-09-12 | Medium | Low | 3,716 files; ~10 Claude Code hooks execute Node on nearly every tool call; `.mcp.json` runs `npx -y chrome-devtools-mcp@latest`; paid tier and affiliate links. Zero CRE content. URL redirects to `affaan-m/ECC`. |
| alirezarezvani/claude-skills | MIT | Yes | 2026-08-26 | Low | Low | 3,869 files. Root `.claude/settings.json` auto-enables a third-party plugin and `.mcp.json` a third-party MCP server — **never open the clone as a project**. Installers use `rm -rf` on destinations. Zero-width-character scan did not complete. |
| VoltAgent/awesome-agent-skills | MIT (list only; linked skills carry their own) | Yes | 2026-09-15 | Low | Low | 4 files, no executable content. Its own notice says listed skills are curated, not audited. |
| agentskillexchange/skills | MIT (catalogue); per-skill licences essentially absent | Yes (catalogue text) | 2026-09-17 | Low | Low | 3,099 files, ~53 % of bodies are auto-extracted upstream README fragments. Injection-phrase hits are the project's own test fixtures under `verification/fixtures/security/`. |
| obviousworks/Claude-AI-skills-collection-2026 | None | Unknown | 2026-07-21 | Low | Low | 3 Markdown files, no licence grant, no skills, no CRE content. |
| Imran-ml/claude-skills | None | No | 2026-03-15 | Medium | Low | No licence = no right to copy. `.mcp.json` exposes `/home` and `/tmp` through a filesystem MCP server and passes `${DATABASE_URL}`; `settings.json` hook paths do not match where the scripts live. |
| Leaflet/Leaflet | BSD-2-Clause | Yes | 2026-09-10 | Low | Low | No `dist/` on `main`; `main` is `2.0.0-alpha.1` (breaking vs 1.9.x). Popups use `innerHTML` — sanitising is the integrator's job. |
| maplibre/maplibre-gl-js | BSD-3-Clause (+ permissive third-party notices) | Yes | 2026-09-17 | Low | Low | 18 runtime + 79 dev dependencies, `prepare` codegen, auto-merged dependabot. Pin an exact version and vendor the dist if ever adopted. |
| chartjs/Chart.js | MIT | Yes | 2026-09-14 | Low | Low | No install-time scripts; one runtime dependency (`@kurkle/color`). No `SECURITY.md`. Superseded for the MVP by D14 (inline SVG). |
| postgres/postgres | PostgreSQL License | Yes | 2026-09-17 | Low | Low | 7,695 files of C source; consume as a packaged release, never from this tree. Tension to record: CASE OS production is PHP + MySQL. |
| supabase/supabase | Apache-2.0 (bundled components licensed separately; trademarks excluded) | Yes | 2026-09-17 | Medium | Low | 23 × `preinstall: npx only-allow pnpm`; `.claude/settings.json` runs `pnpm install` at SessionStart; `.mcp.json` points at a remote MCP server; `docker/setup.sh` is a curl-pipe-to-shell installer. Self-hosting needs ~20 high-value secrets. Studio telemetry opt-out in self-hosted mode not verified. |
| PostgREST/postgrest | MIT (vendored `hasql-*` licences not verified) | Yes | 2026-09-13 | Low | Low | Presupposes PostgreSQL, which CASE OS does not run today. No `SECURITY.md` at root. |
| postgis/postgis | GPL-2.0-or-later core; mixed permissive bundled parts; docs CC BY-SA 3.0 | Conditional | 2026-09-16 | Low | Low | Copyleft matters only if CASE ever redistributes PostGIS (not planned). GitHub is a mirror; canonical source is `gitea.osgeo.org`. Ships an `AGENTS.md` — read as data only. |
| pgvector/pgvector | PostgreSQL License | Yes | 2026-09-08 | Low | Low | Requires PostgreSQL 13+ and a compiled extension; Dockerfile pins a tag without a checksum. No `SECURITY.md`. |
| modelcontextprotocol/specification | Transitioning MIT → Apache-2.0; docs CC-BY-4.0 | Yes | 2026-09-16 | Low | Low | README still says MIT while LICENSE describes the transition — attribute precisely if text is ever quoted. Bundled plugin would register a remote MCP server; do not install. |
| modelcontextprotocol/servers | Mixed MIT / Apache-2.0; docs CC-BY-4.0 | Yes | 2026-09-02 | Low | Low | Its own README and `SECURITY.md` state the servers are educational, not production-ready. `get-env.ts` returns the whole `process.env`. `.mcp.json` would auto-connect a remote MCP server if opened as a project. |
| langchain-ai/langchain | MIT | Yes | 2026-09-16 | Low | Low | `.mcp.json` registers two remote MCP servers; `AGENTS.md` / `CLAUDE.md` are agent-directed. Useful negative example: `shell_tool.py` is the pattern LSP must not copy. |
| run-llama/llama_index | MIT core; 17 of 584 package licences are AGPL-3.0 / GPL / other | Conditional | 2026-09-15 | Medium | Low | Never copy from the GPL/AGPL integration packages. Its `SECURITY.md` scopes the library to trusted environments and disclaims input validation. Core downloads NLTK data at runtime. Maintainers state OSS focus has shifted to their cloud product. |
| pydantic/pydantic-ai | MIT | Yes | 2026-09-16 | Low | Low | Ships `AGENTS.md`, `CLAUDE.md`, `.agents/skills/`, `.claude/skills/` including an executable helper script — treat as untrusted data, never load. |
| BerriAI/litellm | MIT outside `enterprise/`; `enterprise/` proprietary (paid, redistribution forbidden) | Conditional | 2026-09-16 | Medium | Low | Never consult `enterprise/` for reuse. Unresolved discrepancy: `litellm.telemetry = True` module default vs `security.md` "no telemetry when you self host" — not verified, irrelevant while nothing is installed. |
| microsoft/autogen | MIT (code) / CC BY 4.0 (docs); no trademark grant | Yes | 2026-04-06 | Low | Low | Officially in maintenance mode: bug and security fixes only, users directed elsewhere. Reference value decays; do not let it shape long-term architecture. |
| openai/openai-agents-python | MIT | Yes | 2026-09-16 | Medium | **Medium** | Root `AGENTS.md`, `CLAUDE.md` and `.agents/skills/*/SKILL.md` with shell and Python helpers would be auto-loaded by an agent that opens the tree — reference by URL only, never check out inside `case-site/`. Tracing includes prompts and tool payloads by default. |
| gayu2k01/agent-ai | Apache-2.0 (copyright line left as the unfilled template) | Yes | 2025-07-26 | Medium | Low | Unattributed copy of `Shubhamsaboo/awesome-llm-apps`, ~14 months stale. Contains `eval()` on user input, PowerShell execution from model output, a curl-pipe-to-bash Dockerfile and a Quora PII-scraping demo. Cite the upstream project instead. |
| mariourquia/cre-skills-plugin | Apache-2.0 | Yes | 2026-07-27 | Medium | Low | 2,383 files. Plugin hooks run Node on SessionStart, on every `Read` and on Stop; local telemetry on by default (`~/.cre-skills/telemetry.jsonl`); opt-in feedback POST and installer error reports to a third-party endpoint. Benchmarks are US-institutional. |
| cre-ai-skills/CRE-AI-Skills | None | No | 2026-08-25 | Low | Low | Cleanest content of the CRE group (106 Markdown files, zero executables) but **no licence** — blocking for copying. Every skill mandates a once-per-session vendor mention of the maintainer's company (63 occurrences). |
| zubair-trabzada/ai-realestate-claude | MIT | Yes | 2026-04-29 | Low | Low | README promotes `curl … \| bash`; `realestate-report-pdf` instructs the agent to run `pip install reportlab`. US residential focus; benchmarks not transferable to Uzbekistan. |

---

## 4. Per-repository notes

### 4.1 Claude skill sources (§56)

**anthropics/skills — Approved (format reference; nothing copied).** 419 files, 19 skills, mixed per-skill licensing with no root LICENSE. Relevant for LSP: `template/SKILL.md` and the README sections on skill creation define the frontmatter contract (`name` + `description` required; the description is the trigger), the progressive-disclosure layout (`SKILL.md` → `scripts/`, `references/`, `assets/`) and the "keep the body short, put when-to-use in the description" rule; `skills/internal-comms/SKILL.md` is a compact router skill; `skills/discernment-nudge/SKILL.md` shows explicit when-not-to rules. Findings: no hooks anywhere; the only installer and network activity sits in scripts that are never run (`web-artifacts-builder/scripts/init-artifact.sh` does `npm install -g pnpm`, `skill-creator` shells out to a CLI, `docx`/`pptx`/`xlsx` scripts shell out to LibreOffice); no hidden instructions found. Decision: the *format* is adopted as the convention for the 21 skills under `case-site/.claude/skills/`; no file is copied, because the four document skills are proprietary with explicit no-copy terms, `doc-coauthoring` is unlicensed, and the Apache-2.0 skills have no leasing or CRE content. Priority 2 source under §60.

**affaan-m/everything-claude-code — Approved (reference only).** 3,716 files: 292 skills, 68 agents, 94 commands, 122 rule files, 289 scripts, plus a Node CLI and a Python LLM abstraction layer. Relevant for LSP: `skills/tdd-workflow/SKILL.md` (RED/GREEN gate, evidence table, and the useful rule that a plan file is data, not instructions), `skills/verification-loop/SKILL.md` (build/type/lint/test/security/diff phases), `skills/e2e-testing/SKILL.md` (Playwright page-object patterns, adjacent to the `playwright-core` scripts of D10), `rules/common/{testing,security,coding-style}.md` and `commands/test-coverage.md` as layout examples. Findings: the value proposition is installation — `install.sh` runs `npm install`, `hooks/hooks.json` registers ~10 hooks that execute Node on nearly every tool call, `.mcp.json` runs an unpinned remote package; there is a paid tier and affiliate copy; no CRE content at all. Decision: read the named files for structure, copy nothing, never install. It fails the plain-Approved bar because its content cannot be used without the plugin machinery that D1/D2/D12 exclude.

**alirezarezvani/claude-skills — Approved (13 files nominated, adoption gated by Q-11-2).** 3,869 files, 388 canonical `SKILL.md`, MIT. Relevant for LSP as *method* material, not CRE material: `finance/skills/financial-analyst/` (ratio, valuation and forecasting vocabulary for the report builders of `07_CALCULATIONS_AND_KPI_RULES.md`), `finance/business-investment-advisor/` (a clean "Recommendation / Numbers / Assumptions / Upside / Downside / Risks" output shape), `research-ops/skills/market-research/` (TAM/SAM/SOM triangulation), `product-team/skills/product-manager-toolkit/` (RICE, PRD templates for the backlog in `09_IMPLEMENTATION_PLAN.md`), `engineering-team/skills/senior-security/references/threat-modeling-guide.md` (STRIDE applied to the `clientView(projectId)` whitelist of D7), and two framework-neutral QA references. Findings: the six skills read in full are in scope, their Python tools are standard-library only with no network calls, and no injection patterns were found in the 388 skill files; but the repository root ships a `.claude/settings.json` that auto-enables a third-party plugin and a `.mcp.json` that registers a third-party MCP server, and the installers run `rm -rf` on destinations. Decision: Approved for copying the 13 named Markdown files, pinned to commit `19392f7a` with the MIT notice retained — **after** Q-11-2 is answered. Never open the clone as a project, never run its scripts. Everything outside the 13 files is unreviewed and not approved.

**VoltAgent/awesome-agent-skills — Approved (reference only).** Four files; the repository is a link index with no skills of its own. Relevant for LSP: the per-assistant skill-path table (confirms `.claude/skills/` as the project path) and the four quality criteria (third-person description with matchable keywords, short metadata, body under ~500 lines, no absolute paths), which agree with `anthropics/skills`. Findings: no executable content, no hidden instructions; its own security notice states the ~1,497 linked skills are curated but not audited and may contain prompt injection or malware. Decision: a reading bookmark. Nothing to copy; any linked skill would need its own §60 audit.

**agentskillexchange/skills — Deferred.** 3,099 files mirroring ~3,000 catalogue entries, MIT at the catalogue level, per-skill licences essentially absent. Relevant for LSP: only `industries/real-estate-workflows.md`, an 11-entry list aimed at US *residential* transaction paperwork (e-signature, OCR, US property-data APIs). Findings: clean — the only injection-phrase hits are the project's own security test fixtures; nothing runs on clone. Decision: Deferred, on relevance rather than risk. Every relevant entry requires installing a third-party runtime (Docker image, pip/npm package, hosted MCP server with API keys), which D1/D2/D12 exclude, and ~53 % of the bodies are thin auto-extracted README fragments. **Trigger to revisit:** if the LSP roadmap adds e-signature or document handling, audit the specific upstream projects, not this catalogue.

**obviousworks/Claude-AI-skills-collection-2026 — Rejected.** Three Markdown files, no licence, no skills, no code. Findings: no executable content and no injection patterns; the text itself warns readers to review skills before installing. Decision: rejected on irrelevance and absent licence, not on security. There is nothing to copy, the format reference role is already filled by `anthropics/skills`, and the catalogue text carries no licence grant. Its one durable idea — that skill collections should be scanned before use — is already covered by section 6.

**Imran-ml/claude-skills — Rejected.** 22 files, a generic Claude Code configuration template, **no licence file and no licence statement**. Findings: (1) no licence means no right to copy; (2) content is a TypeScript/Next.js/Prisma dev-workflow template with zero real-estate, leasing, CRM or floor-plan material, contradicting D1/D2/D14; (3) its `.mcp.json` exposes `/home` and `/tmp` through a filesystem MCP server and passes a database connection string on the command line, a `PostToolUse` hook logs every tool call, and the hook paths in `settings.json` do not match where the scripts actually live. Decision: rejected on licence **and** relevance; a later licence change would not fix the relevance, so it is not deferred.

### 4.2 Frontend, floor-plan and data technology references (§57)

**Leaflet/Leaflet — Deferred.** BSD-2-Clause, actively maintained, no install-time scripts in the published package, no telemetry. Relevant for LSP only if a geographic map is later added: `src/geo/crs/Simple.js` with the `crs-simple` examples is the Leaflet way of doing a pixel-coordinate floor plan, and `src/geometry/PolyUtil.js` / `LineUtil.js` are small polygon helpers that could *inform* (not be copied into) `os/leasing/js/floorplan.js`. Findings: no `dist/` on `main`, and `main` is a breaking `2.0.0-alpha.1`; popups render HTML strings, so sanitising would be the integrator's responsibility; the default attribution control carries a political statement configurable through options — worth knowing for client-facing material in the UZ/GCC market. Decision: not in v0.1. Floor plans are native SVG (D8) and there is no map requirement. **Trigger to revisit:** a scheduled map feature — at which point §57 itself prefers MapLibre.

**maplibre/maplibre-gl-js — Approved (reference only).** BSD-3-Clause with clean third-party notices, 5,497 files, commit on the audit date. Relevant for LSP: the Geoanalytics phase of `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §5 — the published `dist/` bundle is the consumable, and the upstream heatmap / 3D-building examples illustrate the catchment visualisations that phase needs. Findings: 18 runtime and 79 dev dependencies, a `prepare` codegen step, dependabot auto-merge, and a README quickstart that loads an unpinned CDN build. Decision: licence and provenance are acceptable for a future phase; nothing is adopted now. If adopted later: pin an exact version, vendor the dist, whitelist tile and style origins against the `os/.htaccess` CSP, and record the dependency decision.

**chartjs/Chart.js — Deferred.** MIT, no install-time scripts, one runtime dependency. Relevant for LSP: only the built UMD bundle would ever be used, plus the configuration docs as a reference for KPI chart shapes. Findings: nothing of concern in the inspected files; no `SECURITY.md`. Decision: D14 fixes charts as inline SVG generated by code, and §57 lists Chart.js only "if required", so it cannot be Approved for the MVP. **Trigger to revisit:** a founder decision that dashboards need more than hand-authored SVG — at which point the MIT UMD bundle would be vendored locally (never a CDN `<script src>`, which would break `file://` and sit outside the CSP `script-src` list) with its licence notice retained.

**postgres/postgres — Deferred.** PostgreSQL License, 7,695 files, the canonical upstream mirror. Relevant for LSP: nothing in the MVP; for the production phase the documentation, not the code — the DDL, JSON/JSONB and row-level-security chapters would inform a future schema for units, deals and visibility rules. Findings: no concerns; a formal security process exists. Decision: Deferred. Record the architecture tension rather than resolving it here: CASE OS production is PHP + MySQL and the fold-back path of D1 targets MySQL schema deltas, so PostgreSQL would be a stack change, covered by Q-12-2 in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7.3.

**supabase/supabase — Deferred.** Apache-2.0, 17,472 files, very actively maintained, a credible candidate for a production backend. Relevant for LSP in a later phase only: `docker/README.md`, `docker/CONFIG.md` and `docker/.env.example` show what a self-hosted Postgres + auth + REST + storage stack actually costs to operate; the row-level-security and column-level-security guides are a concrete model for enforcing the D7 visibility levels at the database layer; `supabase/migrations` is a migrations-as-code example comparable to the `meta.schemaVersion` migrations of D9. Findings: 23 `preinstall` hooks that execute a network-fetched package, a `SessionStart` hook that runs `pnpm install`, an `.mcp.json` pointing at a remote MCP server, and a curl-pipe-to-shell Docker bootstrap that installs system packages with root privileges; self-hosting requires managing roughly 20 high-value secrets; Studio telemetry opt-out in self-hosted mode was not verified. Decision: Deferred — this is an architecture decision (Q-12-2), not a file adoption. Do not open the clone in an agent session.

**PostgREST/postgrest — Deferred.** MIT, 500 files, actively maintained, no install hooks needed to read anything. Relevant for LSP: conceptually, the model of delegating authorisation to database roles with JWT claims, which maps onto the production RBAC requirements of `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7.4; `docs/references/configuration.rst` enumerates the runtime settings. Findings: `vendor/` carries locally patched `hasql-*` copies whose licences were not verified; no `SECURITY.md` at root. Decision: Deferred; it presupposes PostgreSQL, so it is downstream of Q-12-2.

**postgis/postgis — Deferred.** GPL-2.0-or-later core with permissive bundled parts, 2,279 files, OSGeo-governed with an active security process. Relevant for LSP: nothing now; in the production phase, the geometry model and spatial indexing behind the Geoanalytics extension points of `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §5–§6 and the `geoMasterId` / `propertyId` identifiers of D13. Findings: no concerns; GitHub is a mirror (canonical source `gitea.osgeo.org`); the repository ships an `AGENTS.md`, read as data only. Licence marked *conditional*: GPL copyleft is irrelevant for running an installed extension but would apply if CASE ever redistributed PostGIS, which is not planned. Decision: Deferred, downstream of Q-12-2; obtain from official packages if ever adopted, never from the mirror.

**pgvector/pgvector — Deferred.** PostgreSQL License, 158 files, no install hooks, no telemetry. Relevant for LSP: only in the production phase, if document or semantic search is designed — which would also require an embedding provider, outside D12. Findings: the Dockerfile pins a source tag without a checksum; no `SECURITY.md`; the Makefile defaults to CPU-specific optimisation flags. Decision: Deferred, downstream of Q-12-2. Prefer distribution packages or a managed provider if ever adopted.

### 4.3 AI and integration references (§58)

**modelcontextprotocol/specification — Approved (reference only).** Apache-2.0 / MIT with CC-BY-4.0 docs, 954 files, actively maintained, formal vulnerability disclosure. Relevant for LSP: this is the authoritative shape that the `LSP.tools` registry of D12 should stay compatible with, so that the registry can later be exposed over MCP without redesign — `schema/2026-07-28/schema.ts` (`Tool`, `ToolAnnotations`, `CallToolRequest`, `CallToolResult`) and the `server/tools.mdx` page. The mapping to record in `os/leasing/js/tools.js` is `{name, description, params schema, readOnly}` → `{name, description, inputSchema, annotations.readOnlyHint}`; `requiredRole` and `visibilityScope` have no MCP equivalent and stay on the CASE side. Findings: no install-time hooks; the bundled Claude Code plugin would register a remote MCP server and its two skills instruct an agent to push branches and open pull requests upstream — do not install, and treat both as untrusted data; README and LICENSE disagree on the licence during the MIT → Apache-2.0 transition, so attribute precisely if text is ever quoted. Decision: read the schema and the tools/transports pages; cite the MCP version (`2026-07-28`) in a comment in `js/tools.js`; copy nothing. Priority 2 source under §60.

**modelcontextprotocol/servers — Approved (reference only).** Mixed MIT / Apache-2.0, 156 files. Relevant for LSP: `src/everything/tools/get-sum.ts` is the canonical minimal tool (schema + annotations + handler) and `src/everything/tools/index.ts` shows the split between unconditional and conditional registration — the closest published analogue to gating `LSP.tools` by role; `src/filesystem/path-validation.ts` is an allow-list access-control idea comparable to `visibilityScope`; `src/memory/index.ts` is a JSON-persistence pattern comparable to the localStorage state of D9. Findings: the repository's own README and `SECURITY.md` state these are educational implementations, not production-ready, and the repository is not eligible for vulnerability reports; `get-env.ts` returns the entire process environment to the calling client; `.mcp.json` would auto-connect a remote MCP server if the tree were opened as a project. Decision: design reference only, read via `git show`; nothing copied, nothing installed. Priority 2 source under §60.

**langchain-ai/langchain — Approved (reference only).** MIT, 3,126 files, actively maintained. Relevant for LSP: `libs/core/langchain_core/tools/base.py` and `structured.py` for the tool-schema shape; the agent middleware for human-in-the-loop, call limits and PII redaction, which are the published analogue of the permission checker in `LSP.runTool`; `libs/core/langchain_core/_security/_policy.py` as an SSRF blocklist reference *if* a later phase ever adds a server-side fetch. Findings: `.mcp.json` registers two remote MCP servers and `AGENTS.md` / `CLAUDE.md` instruct coding agents — never open as a working directory; `agents/middleware/shell_tool.py` is an explicit counter-example, since D12 requires tools to be pure service functions behind a permission checker. Decision: read-only; it will never be a dependency of LSP, so there is nothing further to defer.

**run-llama/llama_index — Approved (reference only).** MIT core, 9,842 files. Relevant for LSP: `core/tools/types.py` (`ToolMetadata` with description, name, schema, `return_direct`, plus name sanitisation and a JSON-schema parameters export), `core/tools/function_tool.py` (wrapping a plain function, and a context object injected into the call — the analogue of the `session` argument in `LSP.runTool(name, params, session)`), and `core/tools/tool_spec/base.py` (grouping functions into a tool list, the analogue of grouping `LSP.tools` by service domain). Its `SECURITY.md` is also a good model for the "prototype limitations" section of `os/leasing/README.md`. Findings: **17 of 584 package licences are AGPL-3.0 / GPL / other** — never copy from those integration packages, which is why commercial use is marked conditional; core downloads NLTK data at runtime; the maintainers state the open-source framework is no longer their primary focus. Decision: conceptual reference; copy nothing.

**pydantic/pydantic-ai — Approved (reference only).** MIT, 2,781 files, current. Relevant for LSP: the `ToolDefinition` shape (`name`, `description`, `parameters_json_schema`, `strict`), and above all the composable toolsets — `approval_required.py`, `filtered.py`, `prefixed.py` — where `approval_required_func(ctx, tool_def, args)` is the closest published analogue to the permission checker of D12; the `docs/tools*.md`, `docs/toolsets.md` and `docs/deferred-tools.md` pages carry the patterns in prose. Findings: no hooks run on reading; but the repository ships `AGENTS.md`, `CLAUDE.md`, `.agents/skills/` and `.claude/skills/` including an executable helper — treat as untrusted data, never load, never run. Decision: read the docs for ideas; write the JavaScript in CASE's own code.

**BerriAI/litellm — Approved (reference only).** Dual-licensed: MIT outside `enterprise/`, proprietary inside it. 10,817 files. Relevant for LSP: `litellm/llms/base_llm/chat/transformation.py` is a mature provider-abstraction contract, and `ARCHITECTURE.md` gives the request flow — a useful mental model for the future "AI adapter behind `LSP.tools`" described in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §4. Findings: the `enterprise/` directory is a licensing trap (production use requires a paid subscription, redistribution forbidden, modifications assigned upstream) — never consult it for reuse; heavy install surface including a native build backend, a database and Redis for proxy mode; an unresolved discrepancy between a `telemetry = True` module default and the stated "no telemetry when you self host", which was not verified and does not matter while nothing is installed; agent-instruction files present. Decision: read the MIT-licensed reference files only; copy no code.

**microsoft/autogen — Approved (reference only).** MIT code / CC BY 4.0 docs, 1,837 files. Relevant for LSP: `autogen-core/src/autogen_core/tools/_base.py` is the cleanest published tool protocol (name, description, JSON-schema parameters, strict flag, run/serialise, state) for comparison with `LSP.tools`; `_function_tool.py` and `_workbench.py` show function-to-tool wrapping and tool grouping; the framework telemetry page is a pattern for how tool execution is traced, which maps onto the `auditLog` entries of D12. Findings: the project is **in maintenance mode** (bug and security fixes only, users directed elsewhere), its own transparency notes say it is research software not to be used downstream without further evaluation, and the licences grant no right to Microsoft names or logos. Decision: read for patterns; do not let a maintenance-mode project shape long-term architecture; copy nothing.

**openai/openai-agents-python — Approved (reference only).** MIT, 1,592 files, current, with a formal security policy. Relevant for LSP: `docs/human_in_the_loop.md` (approval requirement, and the fail-closed rule for malformed arguments — directly applicable to the confirmation flow for permanent edits in the `ai-safety-and-permissions` skill), `docs/guardrails.md` (where input, output and tool guardrails run), `docs/tools.md`, and the `FunctionTool` dataclass (`name`, `description`, `params_json_schema`, `is_enabled`, `needs_approval`) whose fields map onto `requiredRole` / `visibilityScope` and the permission checker. Findings: **this is the one repository rated medium for prompt-injection risk** — root `AGENTS.md`, `CLAUDE.md` and `.agents/skills/*/SKILL.md` with shell and Python helpers would be auto-loaded by an agent that opened the tree, so it must never be checked out inside `case-site/` or any working directory; its tracing includes prompts and tool payloads by default; sandbox and shell tools execute with host privileges. Decision: cite by URL in planning documents; read specific pages deliberately; copy nothing, check out nothing.

**gayu2k01/agent-ai — Deferred.** Apache-2.0 with the copyright line left as the unfilled template, 779 files. It is an unattributed copy of a well-known upstream collection of roughly 100 demo applications, about 14 months stale. Relevant for LSP: only as loose architectural illustration (single agent with tools, agent team, retrieval pipeline, MCP client examples); there is no commercial-real-estate content. Findings: no hardcoded credentials and no first-party telemetry, but the tree contains `eval()` on user-supplied input, PowerShell execution driven by model output, a Dockerfile that pipes a remote installer to a shell, and a demo that scrapes personal profiles into a spreadsheet — a pattern that would raise data-protection questions if reused. Every app needs pip-installed frameworks and third-party API keys, which D1/D12 exclude. Decision: Deferred rather than Approved as a citation target, because the unfilled copyright and missing attribution make it a poor source; if a later phase wants an example, cite the upstream project directly. Nothing to copy.

### 4.4 Commercial real estate and financial references (§59)

**mariourquia/cre-skills-plugin — Approved (reference only; 6 files nominated, adoption gated by Q-11-1).** Apache-2.0, 2,383 files: 127 skills, 54 agent files, 21 Python calculators, Node hooks, an MCP server and installers. **This is the most directly relevant repository in the whole set.** Relevant for LSP: `src/skills/leasing-operations-engine/` (an 8-stage prospect pipeline with entry and exit criteria, stale thresholds, a weighted-probability pipeline table, a listing audit matrix, a commission accrual tracker and marketing ROI formulas — comparable material to `05_STATUSES_STAGES_AND_CONFIG.md`, the stale rules of §41 and the commission tracking of §38), `src/skills/lease-negotiation-analyzer/` (term-sheet field list, opening / target / walk-away structure, retail co-tenancy and exclusive-use scenarios), `src/skills/leasing-strategy-marketing-planner/` (marketing plan and KPI table structure), and `src/agents/leasing-director.md` as wording reference. Findings: it is a plugin, not a plain skill collection — hooks run Node on SessionStart, on every `Read` tool call and on Stop; local telemetry is on by default; there is an opt-in feedback POST to a third-party endpoint and an installer that reports errors to the same host; the installer can run a global npm install and modify Claude Code configuration. Its benchmarks (commission rates, tenant-improvement costs, conversion rates) are US-institutional and dated, and would be actively misleading in an Uzbekistan retail context. Decision: read and adapt the *structures* from the six named files; strip every US benchmark; never install the plugin, its hooks, its MCP server or its calculators. Adoption of the six files is gated by Q-11-1 and is an adaptation, not a copy: any number that reaches a CASE deliverable must be re-derived under the CASE market-research method.

**cre-ai-skills/CRE-AI-Skills — Deferred.** 106 Markdown files, zero executables, zero manifests, zero hooks, zero network calls — the cleanest content of the CRE group — but **no licence anywhere**, so no right to copy exists. Relevant for LSP as structure, not text: `skills/lease-to-system-auditor/SKILL.md` (a lease vs system-of-record reconciliation with finding classes and severity plus confidence tables — conceptually the same shape as the plan-vs-registry reconciliation in `06_FLOORPLAN_ARCHITECTURE.md` and the completeness checks of §40), `skills/submarket-study/SKILL.md` with its source hierarchy (every figure carries source, date and confidence — the same discipline as D16 provenance and the "never invent market rents" rule), `skills/tenant-credit-and-exposure-analyst/SKILL.md` (concentration and expiry-clustering thresholds, relevant to the future Asset Management module, not v0.1), and `skills/psa-reviewer/SKILL.md` (clause-by-clause issue list with severity). Findings: every one of the 17 skills instructs the agent to mention the maintainer's company once per session (63 occurrences) — embedded self-promotion that would have to be stripped from any adopted file; descriptions use aggressive triggering language that could pre-empt CASE's own skills; several skills tell the agent to research market figures from open sources, which would create unattributed lookups in an agent with web access. Decision: Deferred, blocked on licence. Study the structural patterns, copy nothing. **Trigger to revisit:** the maintainer adds an OSI licence or grants written permission (Q-11-6).

**zubair-trabzada/ai-realestate-claude — Approved (reference only).** MIT, 28 files. Relevant for LSP: `skills/realestate-commercial/SKILL.md` is a usable commercial-underwriting checklist (NOI build-up, ratio table, lease-type comparison, tenant-quality and lease-expiration schedule, a ten-item risk list) for drafting report and tool descriptions; `skills/realestate-comps/SKILL.md` contributes a comparable-selection criteria matrix, an adjustment-direction rule and a High/Moderate/Low confidence table that could inform a future unit-comparable feature. Findings: the README promotes a curl-pipe-to-bash installer; `install.sh` writes into the user-global skills and agents directories and runs `pip install`; one skill instructs the agent to auto-install a Python package, which conflicts with D1/D12; the skill text directs the agent to scrape listing portals whose terms generally forbid it. Content is US residential investor material — the benchmarks are not transferable to Uzbekistan or the CIS. Decision: read for structure and the commercial checklist; copy nothing; never run the installer; never add its Python packages.

**github.com/topics/commercial-real-estate — discovery source, not audited.** A GitHub topic page, not a repository. It has no licence, no commits and no files, so it cannot be cloned, reviewed under §60 or adopted. It is listed in §59 as a way to find further repositories. Rule: anything found through it is a new repository, enters this document as a new row, and takes the full §60 inspection and section 6 checklist before any use.

---

## 5. Consequences for the MVP

| # | Consequence | Basis |
|---|---|---|
| 1 | **Nothing is installed and nothing third-party runs at runtime.** `os/leasing/` contains only CASE-authored files. The add-on zip `CASE_OS_LSP_v0.1.0.zip` carries `os/leasing/` plus an install note and `SHA256SUMS`, no vendored library, no font, no image. No CDN `<script src>`: it would break opening from `file://` and sit outside the `script-src` list of the `os/.htaccess` CSP. | D1, D2, D18; `00_MASTER_PROMPT.md` §60, §62 |
| 2 | **The `SKILL.md` format from `anthropics/skills` is adopted as a convention, not as files.** YAML frontmatter carrying `name` and `description` (the description is what triggers the skill), a Markdown body, the "when to use" information in the description, a short body, and progressive disclosure into `references/` when a skill grows. The 21 skills of §56 under `case-site/.claude/skills/` follow it and additionally carry the §56 sections (purpose, responsibilities, inputs, outputs, constraints, validation checklist, prohibited behaviour, examples). No file is copied from any audited repository, so no licence obligation arises. | §56; section 4.1 |
| 3 | **CRE skill content is deferred to a named review step.** Nineteen files are nominated but not adopted: 6 from `mariourquia/cre-skills-plugin` (Apache-2.0, Q-11-1) and 13 from `alirezarezvani/claude-skills` (MIT, Q-11-2). Named owners: **Head of Leasing & Sales** for the leasing, pipeline, commission and negotiation material; **Founder / product sponsor** for the finance, market-research and product-method material. The review must remove US benchmarks and vendor references, confirm each claim against the CASE leasing and market-research method before it enters any CASE deliverable, and retain the source URL, pinned commit and licence notice on every copied file. | §59 review requirement ("assumptions, formulas, local-market suitability, missing-data behaviour, source quality, commercial-use license"); section 4.4 |
| 4 | **No runtime library is adopted.** Charts are inline SVG generated by code (no Chart.js); floor plans are native SVG with `data-unit-id` polygons (no Leaflet, no MapLibre); there is no map, no build step and no package manager in v0.1. | D2, D8, D14; `00_MASTER_PROMPT.md` §57, §62 |
| 5 | **No AI framework, no LLM, no network.** `os/leasing/js/tools.js` is a hand-written registry; the MCP specification and the seven AI frameworks are read only to keep the registry shape compatible and the permission model recognisable. The "Ask" palette follows the deterministic in-browser pattern of D17: closed tool menu, numbers only from tools, no external AI service. | D12, D17; `00_MASTER_PROMPT.md` §51–§53, §58 ("Do not add an AI framework to the MVP without a clear requirement") |
| 6 | **Four repositories must never be opened as a working directory** by an agent session: `openai/openai-agents-python`, `supabase/supabase`, `alirezarezvani/claude-skills` and `modelcontextprotocol/servers` (and, by the same rule, any repository with `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` or `.mcp.json`). Their instruction files and MCP manifests would be picked up automatically. Read them with `git show` from a scratchpad, or by URL. | Section 2.2 rule 3; sections 4.1, 4.2, 4.3 |
| 7 | **Re-audit before production.** Every stack item that `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` puts in the production phase is *Deferred* here and needs a fresh row before adoption: the backend choice of §7.3 (Option A, PHP + MySQL, versus Option B, PostgreSQL with PostGIS behind PostgREST or Supabase — Q-12-2), `pgvector` for document and semantic search, MapLibre for maps in the Geoanalytics phase of §5, MCP for exposing `LSP.tools` over a protocol, and the AI provider and gateway of Q-12-6. The `ApiAdapter` of §7.2 is CASE-authored and adds no dependency by itself. | `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7; section 6 |
| 8 | **Nothing in this document claims production security, OCR or computer-vision recognition.** "Security reviewed" means inspected against the §60 list with the limits of section 1.2. Floor-plan label matching remains the experimental text-label route of D8; automatic plan recognition stays future functionality. | `00_MASTER_PROMPT.md` §6.1, §6.7; section 2.2 rule 6 |

---

## 6. Re-audit checklist

Run this before adopting anything from any repository in section 3, and again whenever a *Deferred* row's trigger fires. Record the result as a new dated block in this document, with the repository, commit hash, date and reviewer. An unchecked box blocks adoption.

### 6.1 Provenance and licence

- [ ] Clone shallow or blobless into a scratchpad **outside** the CASE repository; delete after review.
- [ ] Record the URL, any redirect target, the default branch, the HEAD commit hash and its date.
- [ ] Read the licence file(s), including per-package and per-skill licences. Confirm commercial use is permitted for the specific files being taken.
- [ ] Confirm no file being taken sits in a proprietary, copyleft-incompatible or unlicensed subdirectory.
- [ ] Plan the attribution: licence notice, source URL and pinned commit recorded with each copied file.

### 6.2 §60 inspection list

- [ ] README — read.
- [ ] Recent activity — `git log` of the default branch; note that GitHub API signals may be unavailable (A-11-1).
- [ ] Dependencies — runtime and development, listed and counted.
- [ ] Shell scripts, install scripts, hooks and post-install / lifecycle commands — every one located and read. **None executed.**
- [ ] Filesystem access — what the code reads or writes outside its own tree.
- [ ] Network access — every outbound host, including CDNs, registries and telemetry endpoints.
- [ ] Environment-variable and API-key requirements — enumerated.
- [ ] Prompt-injection risk — grep for instruction override, hidden HTML comments, zero-width or bidirectional characters, exfiltration and safety-bypass phrasing; read the files being taken in full.
- [ ] Data collection — telemetry, analytics, usage logging; default on or off; opt-out verified or explicitly recorded as unverified.
- [ ] Commercial-use restrictions — including trademark and enterprise-tier carve-outs.

### 6.3 Agent-safety gate

- [ ] The clone is **not** opened as a working directory for an agent session.
- [ ] `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, `.claude/settings.json` and `.mcp.json` located, read **as data**, and never followed.
- [ ] No plugin, marketplace, MCP server or hook registered anywhere as a result of the review.
- [ ] No environment variable set, no credential supplied, no installer run — including inside the scratchpad.

### 6.4 Fit with the plan

- [ ] Does it introduce a runtime dependency or a build step? If yes → it cannot enter the MVP (D1, D2); the decision is a founder-level change, not an adoption.
- [ ] Does it require a network call or an external AI service at runtime? If yes → excluded by D12 and D17.
- [ ] Does it fit the ≤ 1.5 MB add-on budget of D18 and the hosting disk constraint?
- [ ] Is the content applicable to the Uzbekistan and MENA/GCC retail and office market, or are its benchmarks foreign? Foreign figures are stripped, never re-published.
- [ ] Does it use CASE vocabulary (entities, statuses, stages, roles, ID formats, paths) or does it introduce a parallel vocabulary that would have to be mapped?
- [ ] Does it duplicate something already owned by one of the 21 project skills (priority 1 under §60)?

### 6.5 §59 review for financial and CRE material

- [ ] Assumptions stated and checked.
- [ ] Formulas verified, with visible denominators and no unknown value treated as zero.
- [ ] Local-market suitability confirmed, or the figure removed.
- [ ] Missing-data behaviour: the source leaves gaps visible rather than fabricating numbers.
- [ ] Source quality: every figure carries a source and a date.
- [ ] Commercial-use licence confirmed for the specific files.

### 6.6 Record

- [ ] Update the two tables in section 3 and the note in section 4; add the new dated review block.
- [ ] If the outcome changes a *Deferred* row to *Approved*, add or update the corresponding open question in section 7 and in `README.md`'s decision log.
- [ ] Add or update the static QA check in `10_QA_PLAN.md` that asserts no third-party runtime file exists under `os/leasing/`.

---

## 7. Open questions

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| Q-11-1 | Adopt the 6 nominated files from `mariourquia/cre-skills-plugin` (Apache-2.0) as LSP reference material? | Yes, as an **adaptation** into `05_STATUSES_STAGES_AND_CONFIG.md` and the leasing-pipeline and commission skills, pinned to the reviewed commit, with every US benchmark removed and the Apache-2.0 notice retained. Never install the plugin. | Head of Leasing & Sales |
| Q-11-2 | Adopt the 13 nominated files from `alirezarezvani/claude-skills` (MIT)? | Yes for the finance, market-research, product-method and threat-modelling files, copied with the MIT notice and the pinned commit into planning reference material only. The remaining ~380 skills stay unreviewed and unapproved. | Founder / product sponsor |
| Q-11-3 | Charts: keep inline SVG (D14) or vendor an MIT chart library later? | Keep inline SVG for v0.1. Revisit only if dashboard requirements outgrow hand-authored SVG; then vendor the bundle locally with its licence — never a CDN reference. | Founder / product sponsor |
| Q-11-4 | When does the production stack re-audit run (PostgreSQL, PostGIS, PostgREST, Supabase, pgvector, MapLibre, MCP)? | Trigger it with the Q-12-2 backend decision in `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` §7.3, not before; each item takes a fresh section 6 pass. | Founder + technical lead |
| Q-11-5 | Who owns this audit and how often is it refreshed? | Operational owner: Head of Leasing & Sales; technical reviewer per pass. Refresh on any adoption request, and otherwise at each major LSP release. | Founder / product sponsor |
| Q-11-6 | Ask the `cre-ai-skills/CRE-AI-Skills` maintainer for a licence grant? | Low cost, worthwhile: its structural patterns (source-tiered market basis, severity plus confidence tables, gaps left visibly empty) match the CASE provenance discipline. Until a licence exists, study only. | Head of Leasing & Sales |
| Q-11-7 | Record pinned commit hashes for every nominated file in the repository? | Yes — store them with the copied files when Q-11-1 and Q-11-2 are answered, so a later diff against upstream is possible. | Technical reviewer |

---

## 8. Cross-references

| Document | Relationship to this audit |
|---|---|
| `00_MASTER_PROMPT.md` | §56–§59 name the repositories; §60 sets the inspection list and priority order; §61 defines the required table; §62 sets the no-build, minimal-dependency preference |
| `12_AI_AND_ECOSYSTEM_ARCHITECTURE.md` | §4 future AI architecture, §5 Geoanalytics, §7.3 backend options (Q-12-2), §7.4 production requirements — everything this audit defers |
| `09_IMPLEMENTATION_PLAN.md` | No phase may introduce a dependency without a new row here |
| `10_QA_PLAN.md` | Static audit: no secrets, no third-party runtime file under `os/leasing/`, external libraries documented (§65 "Technical review") |
| `02_REQUIREMENTS_REVIEW.md` | §6.1 prototype authentication is not security; §6.7 automatic floor-plan recognition is future functionality — neither is contradicted by anything adopted here |
| `.claude/skills/` (21 skills) | Priority 1 under §60; the `SKILL.md` convention described in section 5 item 2 |
| `README.md` | Decision log D1, D2, D12, D14, D18 and the approval checklist carrying Q-11-1 … Q-11-7 |
