# Atlas Guides

A small, agnostic framework for building AI agent systems with two-LLM Builder/Checker discipline.

**Version:** 1.0 | **Replaces:** the 9-part / 14-skill framework that preceded it.

---

## What This Is

A set of plain markdown files that tell AI coding assistants (Claude Code, Cursor, Windsurf, Aider, Antigravity, anything that supports project rules) how to behave when building AI agent systems.

The whole framework is ~1,500 lines across the files listed below. It produces the same outcomes as the previous 5,000+ line framework, with the structural problems fixed.

---

## File Map

### Core (load every session)

- **`kernel.md`** — The five rules, the build loop, the role identifications. Synced to all tool-specific filenames via `sync-kernel.sh`. Read first, always.

### Role Directives (load based on your role this session)

- **`builder-directive.md`** — What Builder does and doesn't do. Includes the 7-step troubleshooting protocol, test discipline, handoff format.
- **`checker-directive.md`** — What Checker does and doesn't do. Adversarial mindset, five lenses, the three-scenario rule, severity tags.
- **`evaluator-directive.md`** — What Evaluator does and doesn't do. Decision protocol, Fix In Place vs Split, closing note format. Loaded only on escalation.
- **`fixer-directive.md`** — What Fixer does. Model 1 of incident response: classify, triage, prove, patch, verify, and write a Fixer Report.
- **`debugger-directive.md`** — What Debugger does. Model 2 of incident response: 5-lens audit of the Fixer Report. Approve or reject only.

### Skills (called on demand)

- **`skills/safety-check.md`** — Mechanical security/freshness scan. Ten checks mapped to OWASP LLM/Agentic Top 10. Automatic at MED/HIGH risk. (The slash command `commands/safety-check.md` loads this file.)
- **`persona-council.md`** — Pre-build spec debate ritual. Convenes personas listed in the story, produces a sharpened spec.

### Discovery

- **`discovery-prompt.md`** — Paste into a strong reasoning model with your brain dump. Produces `spec.md` (the single source of truth for what you're building).
- **`migration-prompt.md`** — If you're moving an existing project from the old framework, paste this into a strong reasoning model along with your existing `AgentSpec.md`, `personas.md`, `user-stories.md`, `BUILD.md`. Produces a new `spec.md` plus a `MIGRATION_PLAN.md`. *(File in progress — see Migrating an Existing Project below.)*

### Slash Commands (in `commands/`, deployed by sync script)

When you run `sync-kernel.sh`, these commands become available in any tool that supports custom slash commands (Claude Code, Cursor, Antigravity). Type the command to invoke the role.

- **`/builder`** — Load Builder role. Reads kernel + builder-directive + spec + context. Picks up the active story.
- **`/checker`** — Load Checker role. Reads kernel + checker-directive + Builder's handoff. Begins adversarial review.
- **`/spec-debate`** — Convene the persona council for a story. Loads only the personas declared in the spec.
- **`/safety-check`** — Run the 10-check mechanical safety scan on the current story's changes.
- **`/evaluator`** — Loop cap reached, or Checker found 5 CRITICAL/WARN on a HIGH-risk story. Open a new chat, load Evaluator role. Evaluator diagnoses, decides, implements, and closes. Also invoked as `$evaluator` in Codex and terminal-based tools.
- **`/fixer`** — Load Fixer role (Model 1). Triage, patch, verify, produce a Fixer Report. Also invoked as `$fixer` in Codex.
- **`/debugger`** — Load Debugger role (Model 2). Audits the Fixer Report. Approve or reject only. Also invoked as `$debugger` in Codex.
- **`/status`** — Where are we? Reads spec + context + current loop. Outputs concise status.

These commands eliminate the "load kernel.md, then load builder-directive.md, then read spec.md..." preamble every time you switch tools.

### Personas (loaded by persona-council based on per-feature list)

- **`personas/pm.md`** — Product perspective
- **`personas/architect.md`** — Technical structure perspective
- **`personas/skeptic.md`** — Devil's advocate perspective
- **`personas/infosec.md`** — Security defenses perspective
- **`personas/ux.md`** — User encounter perspective
- **`personas/compliance.md`** — Legal/regulatory perspective
- **`personas/operations.md`** — Cost/runtime/scale perspective
- **`personas/redteam.md`** — Attack paths perspective
- **`personas/data.md`** — Schema/data flow perspective
- **`personas/stakeholder.md`** — Business case perspective

### Scripts

- **`sync-kernel.sh`** — Copies `kernel.md` and all slash commands to whichever filenames each tool reads from. Also ensures `.build-context.md`, `current-loop.md`, and `docs/archive/` exist. Edit Atlas Guides files, run sync, all tools update.

---

## Setup (One Time, Per Project)

1. Drop the `atlas-guides/` folder into your project root.
2. `chmod +x atlas-guides/sync-kernel.sh` to make it executable.
3. Run `./atlas-guides/sync-kernel.sh`. The script will:
   - Copy `kernel.md` to all the tool-specific filenames
   - Copy all slash commands to each tool's command directory
   - Create empty `.build-context.md`, `current-loop.md`, and `docs/archive/` if they don't exist
4. Verify by opening your AI tool and typing `/status`. It should output the project status section.

---

## Starting a New Project

1. Open `discovery-prompt.md`. Copy everything below `--- BEGIN PROMPT ---`.
2. Paste into a fresh chat with a strong reasoning model.
3. Answer the questions across three phases.
4. Save the final output to `spec.md` in your project root.
5. Run `./atlas-guides/sync-kernel.sh` if you haven't yet — it creates the empty memory files.
6. Open your Builder tool (e.g. Codex/PyCharm, Claude Code). Type `/builder`. The tool loads everything and picks up Story 1.1.
7. When Builder hands off, switch to your Checker tool (e.g. Antigravity with Gemini Pro). Type `/checker`. The tool loads everything and reviews the handoff.

---

## Migrating an Existing Project

If you're moving a project from the old 9-part / 14-skill framework:

1. Snapshot first: `git commit -am "pre-atlas-migration"`.
2. Open `migration-prompt.md`. Copy everything below `--- BEGIN PROMPT ---`.
3. Paste into a fresh chat with a strong reasoning model. Attach your existing `AgentSpec.md`, `personas.md`, `user-stories.md`, `BUILD.md`, and a sample of `.build-context.md`.
4. Answer any clarifying questions the model asks.
5. Save the outputs: `spec.md` to project root, `MIGRATION_PLAN.md` to project root.
6. Follow the steps in `MIGRATION_PLAN.md` — including moving your old `.agent/` content to `.agent/_archive_pre_atlas/` before replacing.
7. Run `./atlas-guides/sync-kernel.sh` to deploy the new kernel and commands.
8. Pick the first story in `spec.md` that isn't marked DONE. Type `/builder`. Begin.

---

## The Five Rules (from the kernel — for quick reference)

1. No direct vendor imports in business logic. All external services through `/adapters/`.
2. Configuration in `scale.yaml`, never in code. Vendor swaps = config changes.
3. Append-only on `.build-context.md` and `current-loop.md`. Never regenerate.
4. Risk score per feature determines guardrails. Set at discovery, not negotiable mid-build.
5. Tools declared at discovery, never dynamically selected. Fixed allow-list per agent.

---

## The Build Loop (from the kernel — for quick reference)

```
Pre-build:  Persona council debates the spec
Build:      Builder works the story (Builder owns "how")
Check:      Checker stress-tests (up to 3 demonstrated failure scenarios)
Safety:     safety-check runs (mechanical scan, automatic at MED/HIGH)
Done:       Story closes, .build-context.md updated
Loop 2:     If FAIL, one more attempt
Escalate:   After Loop 2, run /evaluator or $evaluator in a new chat.
            Evaluator decides: Fix In Place or Split.
```

Maximum 2 loops per story. The cap is the single most important discipline — it stops the continuation spiral.

---

## What This Replaces

If you're migrating from the previous framework:

| Old File | New Location |
|----------|--------------|
| `agent.md` + `agent-extended.md` | `kernel.md` |
| `builder.md` | `builder-directive.md` |
| `checker.md` | `checker-directive.md` |
| 14 `GENERIC-XX-role-skill.md` files | `personas/*.md` (lighter, on-demand) |
| `GENERIC-ROLES-MASTER-GUIDE.md` | Folded into `persona-council.md` |
| `drift-detect.md` | Folded into `checker-directive.md` Spec Alignment lens |
| `mcp-proxy.md` | Folded into `safety-check.md` checks 6 and 10 |
| `00_START_HERE.md` through `09_AUDIT_AND_MAINTENANCE.md` | The patterns that survived live in `kernel.md` rules. Discarded: audit scheduler, citation law, debate protocol, deploy debug protocol. |
| `MASTER_AGENT_DISCOVERY_PROMPT.md` | `discovery-prompt.md` |
| `AgentSpec.md` + `personas.md` + `user-stories.md` + `BUILD.md` | One `spec.md`, produced by discovery |
| `LOOP_STATE.md` | `current-loop.md` (ephemeral, deleted when story closes) |
| `.bugs_tracker.md` | A section inside `.build-context.md` |
| `.audit-history.md` | A section inside `.build-context.md` |

---

## What Got Cut (and Why)

- **Citation Law** — performative. Real engineers cite reasoning, not document numbers.
- **0–17 risk scoring** — false precision. Three levels drive different behavior; numbers in between don't.
- **4-tier debate protocol** — auto-firing on every micro-decision. "Ask if uncertain" covers 95% of it.
- **14 role authority gates** — bureaucracy disguised as governance. Personas as thinking tools serve the same need with no overhead.
- **Builder self-fix round** (R4 in the old framework) — never produced anything Checker hadn't already caught.
- **5-loop cap with continuation builds** — produced 20-cycle spirals. 2-loop cap with mandatory escalation stops them.
- **The 9 numbered framework files** — most of their content was teaching the AI things any decent model already knows. The load-bearing rules live in the kernel now.

---

## Customization

This framework is meant to be adapted. Reasonable customizations:

- **Add more persona cards** in `personas/`. Keep them short (~40 lines), four questions max, follow the same format.
- **Tune `skills/safety-check.md`** for your stack. Add patterns specific to your tech. Update the deprecated-endpoint list as providers publish notices.
- **Extend `sync-kernel.sh`** when new tools come out. One line per destination.
- **Adjust risk thresholds** in the kernel if your domain calls for it (e.g. healthcare or finance might bump MED-risk behavior closer to HIGH).

Unreasonable customizations (these will rebuild the bloat problem):

- Adding gates between Builder and Checker.
- Adding more than 2 build loops per story.
- Adding a separate file per role/agent/persona that re-declares the kernel rules.
- Auto-loading personas at session start instead of per-feature.
- Adding "tier 1 sanity check" patterns that fire on every decision.

---

## Versioning

This is Atlas Guides. When you change a kernel rule, bump the kernel version. When you add or modify a persona, bump that file's version. Keep changes small and traceable — the audit trail is in `.build-context.md`.

---

*Five rules. One loop. Four roles. Ten persona cards summoned by name. Nothing else needed.*
