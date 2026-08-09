# Claude Code skills for this repository

Architectural / design skills for producing house drawings and related AEC work. They load
automatically in any Claude Code session opened in this repo.

| Skill | What it does | Origin |
|---|---|---|
| `house-drawings` | Dimensioned floor plans, elevations, site plans and room layouts as self-contained SVG, with optional editable draw.io export | First-party, written for this repo |
| `design-automation` | Rule-based layout, constraint satisfaction, space planning, drawing/sheet automation, code-compliance checking | Vendored from [Amanbh997/Claude-skills-for-Computational-Designers](https://github.com/Amanbh997/Claude-skills-for-Computational-Designers) (MIT, license included in folder) |
| `generative-design` | Evolutionary/multi-objective generation and evaluation of candidate layouts and massings | Same source as above (MIT, license included in folder) |

`../settings.json` additionally registers the **Architecture Studio** plugin
(`as@skills-for-architects` from
[AlpacaLabsLLC/skills-for-architects](https://github.com/AlpacaLabsLLC/skills-for-architects),
MIT): ~46 skills for site planning, zoning analysis, space programming, specifications,
sustainability/materials research and project records, invoked via `/as:tool-catalog` or
`/as:studio`. Claude Code will prompt to trust/install it on first session start; its
update-check hook is opt-in and performs no network calls unless enabled.

Vendored skills were security-reviewed before inclusion (hooks, scripts, and skill text
checked for injection/exfiltration patterns) on 2026-08-09.
