# Sortie

A locked, APCA-verified design system for shipping accessible product
interfaces. Sortie combines OKLCH tokens, Radix-based components, Carbon
icons, machine-enforced design rules, and agent guidance for Codex and Claude.

## Start a new project

```bash
./scripts/new-project.sh my-project
cd ~/sites/my-project
npm install
# Edit the active tokens/theme.css (brand colors in OKLCH, fonts)
npm run contrast-check
npm run build
```

The copy includes CLAUDE.md, AGENTS.md, RULES.md, skills, and scripts, so
Claude Code and Codex are constrained from the first prompt.

## Daily commands

| Command | What it does |
|---|---|
| `npm run design-check` | Machine check of all `[lint]` rules in RULES.md |
| `npm run contrast-check` | APCA verification of 46 rendered theme-brand pairs |
| `npm run verify-scales` | Verify the full rendered APCA matrix, parsed from primitives.css and semantic.css |
| `npm run build` | Production Next.js build (the repo is a runnable starter) |

## Add or change a rule

Edit `design-rules/RULES.md`, one line, next number in the right section.
It is immediately active in Claude Code, Codex, and the design-review skill.
If the rule is mechanically checkable, also add a matcher in
`scripts/design-check.mjs` and tag the rule `[lint]`.

## Add a component

Use the new-component skill in Claude Code ("add a Select component to the
design system"). It follows the gates: composition check, approval, build to
standard, verify, document in `components/ui/README.md`. Generally useful
components get copied back here so all future projects inherit them.

## Architecture summary

```
tokens/primitives.css   raw OKLCH values (APCA-verified) — never edited in projects
tokens/semantic.css     --color-* layer, light + dark — never edited in projects
tokens/theme.css        per-project brand — the ONLY file that varies
components/ui/          the library (inventory in its README.md)
components/icons.ts     Carbon icon barrel — the only icon import path
design-rules/RULES.md   all rules, single source of truth
.claude/skills/         design-review, new-component, a11y-audit
scripts/                design-check, contrast-check, new-project
tools/                  color scale generator with APCA verification
examples/               reference views showing correct composition
```

## APCA contrast tiers (what is verified, precisely)

| Tier | Min Lc | Verified against |
|---|---|---|
| Primary text | 90 | all six semantic surfaces, both modes |
| Body text (secondary, status text, links) | 75 | all six semantic surfaces; status text is also checked on its status background, both modes |
| Meta text (tertiary: hints, timestamps, placeholders) | 60 | four static surfaces only (canvas/surface/raised/sunken); NOT permitted on hover/active (rule A13) and never body copy |
| Non-text UI (icons, status indicators) | 45 | canvas + surface, both modes |
| Input/control borders (border-strong) | 30 | surface, both modes; borders are never the sole affordance (filled bg + visible label, rule N8) |
| Decorative uses of border-subtle | exempt | only when the border is non-essential and another visual affordance identifies the grouping; reported informationally |

`npm run verify-scales` runs the full 114-pair base matrix. It resolves the
rendered pairings from both `tokens/primitives.css` and `tokens/semantic.css`,
including duplicated semantic surfaces that currently share a primitive.
`npm run contrast-check` separately resolves the active `tokens/theme.css`
through the same semantic chain and checks the states consumed by buttons,
selected rows, and focus rings. Run both commands in CI or pre-commit.
