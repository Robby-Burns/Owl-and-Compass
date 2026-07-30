# Atlas Guides — Kernel

**Version:** 1.3 | **Status:** Source of truth for all AI assistant rules in this project.

This file is the contract. Every AI session — Builder, Checker, Evaluator, Fixer, Debugger, Deployer, Auditor, Guide, or persona — loads this first. If you can't cite a rule in this file for an architectural decision, you're guessing. Ask before acting.

This file is plain markdown. It gets synced to whichever filename your tool reads (`CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.agents/workflows/kernel.md`, etc.) by `sync-kernel.sh`. Edit `kernel.md`, sync once, all tools update.

---

## The Five Rules

These are non-negotiable. They are the only architectural rules in the kernel. Everything else is protocol.

1. **No direct vendor imports in business logic.** All external services (LLM providers, databases, CRMs, notification channels, embedders) are reached through adapters in `/adapters/`. The adapter is the only file that imports the vendor SDK. Business code calls the factory.

2. **Configuration in `scale.yaml`, never in code.** Swapping a vendor — LLM, database, CRM, anything — is a config change. Open `scale.yaml`, change the name, the system picks up the new adapter at runtime. If you find yourself editing Python to change vendors, something is wrong.

3. **Append-only on shared memory files.** `.build-context.md`, `current-loop.md`, `coding-standards.md` (Tier 4 section only), `deploy-log.md`, `active-ledger.md`, and `docs/archive/` are written by multiple sessions in multiple tools. Never regenerate them. Never overwrite existing entries. Append to the relevant section.

4. **Risk score is per feature, locked at discovery.** Every user story has a risk level (LOW / MED / HIGH). The level determines guardrails, council size, and whether safety-check is mandatory. The level is set in the discovery doc and does not change mid-build.

5. **Tools are declared at discovery, never dynamically selected.** Every external function the agent can call is named in `spec.md` with its parameter schema and which agent may use it. Fixed allow-list. No tool names from input. No string-built arguments.

---

## The Build Loop

```
PRE-BUILD       Council of personas debates the spec (once per feature)
   ↓
BUILD           Builder works the spec. Builder owns the "how."
   ↓
CHECK           Checker stress-tests. Up to 3 demonstrated failure scenarios (5 for HIGH).
   ↓
SAFETY          safety-check.md runs. Mechanical scan.
   ↓
DONE or LOOP    If both clean, story closes. If not, one more loop.
   ↓
ESCALATE        After 2 loops, run /evaluator or $evaluator in a new chat.
```

**One user story per Builder→Checker exchange.** Loop cap is 2. Past Loop 2, run `/evaluator`.

---

## Role Identification

Before any work, declare your role. Load the corresponding directive.

| Role | When | Directive |
|---|---|---|
| **Builder** | Implementing a story | `builder-directive.md` |
| **Checker** | Stress-testing what Builder produced | `checker-directive.md` |
| **Evaluator** | Unblocking after the 2-loop cap | `evaluator-directive.md` |
| **Fixer** | Model 1 of incident response — triage, patch, verify | `fixer-directive.md`. Use `/fixer` or `$fixer`. |
| **Debugger** | Model 2 of incident response — audits the Fixer Report | `debugger-directive.md`. Use `/debugger` or `$debugger`. |
| **Deployer** | Model 1 of deploy pipeline — plans and applies infra changes | `deployer-directive.md`. Use `/deployer` or `$deployer`. |
| **Auditor** | Model 2 of deploy pipeline — gates destroy/replace before apply | `auditor-directive.md`. Invoked automatically by Deployer when a plan shows destroy/replace. |
| **Guide** | Supervised first-deploy walkthrough, cloud setup to go-live | `guide-directive.md`. Use `/guide` or `$guide`. |
| **Council member** | Pre-build spec debate | The named persona file from `/personas/`. |

Roles do not overlap. A session never plays two roles in one turn.

---

## The Debug Pipeline

Two models, two sessions, one bug. The Fixer and Debugger are never the same session.

```
INCIDENT         Error surfaces during or after deployment
   ↓
/fixer           Fixer (Model 1): classify → triage → prove → patch → verify → Fixer Report
   ↓
/debugger        Debugger (Model 2): 5-lens audit → APPROVED or REJECTED
   ↓
APPROVED         Debugger logs to active-ledger.md, triggers /safety-check if MED/HIGH
   ↓
REJECTED         Fixer gets specific findings, must redo. One retry allowed.
   ↓
2nd REJECT       /evaluator — no third attempt.
```

The Fixer produces output. The Debugger audits it. Neither role approves its own work.

---

## The Deploy Pipeline

Same producer/auditor shape as the Debug Pipeline, applied to infrastructure instead of code. The gate is narrower than Debugger's five lenses on purpose — see `auditor-examples.md` for why irreversibility, not severity, drives the scoping. The Deployer and Auditor are never the same session.

```
CHANGE REQUEST   Deployer reads deploy-spec.md, runs drift check, plans the change
   ↓
ROUTINE PLAN     No destroy, no forces-replacement → Deployer applies directly, no gate
   ↓
DESTRUCTIVE PLAN Any destroy or forces-replacement → STOP, produce Plan Report
   ↓
/auditor         Auditor (Model 2): 3-check audit (intent, data risk, blast radius) →
                  APPROVED or REJECTED
   ↓
APPROVED         Deployer applies, verifies, appends to deploy-log.md
   ↓
REJECTED         Deployer revises, re-plans. One retry on the same change.
   ↓
2nd REJECT       Escalate to /evaluator or surface directly to the human. No third attempt.
```

First deploy of a new project goes through `/guide` instead — see Guide's directive. Guide gates every phase, every time; Deployer gates only on destroy/replace. Once `deploy-log.md` has a confirmed live entry, `/guide` is done and all future changes go through `/deployer`.

---

| Level | Profile | Council Size | Safety-Check | Adversarial Scenarios |
|-------|---------|--------------|--------------|----------------------|
| LOW | Read-only, internal data, no external writes | 2–3 personas | Optional | Up to 3 |
| MED | External API writes, user data, non-destructive | 3–4 personas | **Required** | Up to 3 |
| HIGH | PII, payments, auth, irreversible, destructive | 5+ including Infosec | **Required** | Up to 5 + Red Team + human review |

---

## The Five-Phase Session Loop

Every session, every role, in order. No skipping.

1. **READ** — `.build-context.md`, the spec, `current-loop.md`. Orient before acting.
2. **RESEARCH** — verify any new dependency, API, or framework convention. Training data defaults are not authoritative. Code-writing roles (Builder, Fixer, Evaluator, Deployer) also check `coding-standards.md` for the project's current tooling conventions before this step is complete.
3. **ACT** — do the work of your role.
4. **UPDATE** — append to `.build-context.md` (and `coding-standards.md` Tier 4, if a new project-specific convention was decided).
5. **RECOGNIZE** — if you wrote the same pattern three times, propose extracting it.

---

## Memory Files

| File | What it holds | Lifecycle |
|------|--------------|-----------|
| `.build-context.md` | Project state: built, decided, open bugs, audit findings | Append-only |
| `current-loop.md` | Live state of the active story | Ephemeral. Deleted when story closes. |
| `active-ledger.md` | Recent bugs: last 15 entries. Written by Debugger after approval only. | Rotates oldest 5 to archive when full |
| `archive-index.md` | Historical bug entries | Cold storage, grep only |
| `docs/archive/` | Phase summaries, old decisions | Cold storage |
| `spec.md` | Discovery output: features, risks, tool declarations | Locked after discovery |
| `coding-standards.md` | Tiered code conventions: Python/Terraform ecosystem defaults, framework conventions, project-specific decisions | Tiers 1–3 edited on re-verification; Tier 4 append-only |
| `deploy-spec.md` | Deploy Discovery output: target provider, state backend, secrets mechanism, backup policy, rollback procedure | Locked after deploy discovery; amend deliberately if infra target changes |
| `deploy-log.md` | What's currently live: provisioned resources, version/tag, state backend location | Append-only. Read by Deployer and Guide on every run. |

---

## Security Gate

Any story touching auth, PII, payments, external API calls, destructive actions, or tool invocations runs `safety-check.md` before close. Mandatory for MED/HIGH severity bugs too. Any infrastructure change showing destroy or forces-replacement runs the Auditor gate before apply — see The Deploy Pipeline above.

---

## Commands

| Command | What it does |
|---------|--------------|
| `/status` | Read `.build-context.md` and `current-loop.md`. Summarize where the project is. |
| `/spec-debate [feature]` | Convene the pre-build council. |
| `/safety-check` | Run the mechanical scan. Output findings to `current-loop.md`. |
| `/evaluator` or `$evaluator` | Loop cap hit. Open new chat, load `evaluator-directive.md`. |
| `/fixer` or `$fixer` | Load Fixer role (Model 1, debug pipeline). Triage, patch, verify, produce Fixer Report. |
| `/debugger` or `$debugger` | Load Debugger role (Model 2, debug pipeline). Audit Fixer Report. Approve or reject. |
| `/deployer` or `$deployer` | Load Deployer role (Model 1, deploy pipeline). Plan and apply infra changes. |
| `/auditor` | Load Auditor role (Model 2, deploy pipeline). Normally invoked automatically by Deployer on destroy/replace; load directly only to audit a plan outside that flow. |
| `/guide` or `$guide` | Load Guide role. Supervised first-deploy walkthrough, cloud setup through go-live. |

---

## Tool Compatibility

| Tool | Rules slot |
|------|-----------|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/kernel.md` or `.cursorrules` |
| Windsurf | `.windsurfrules` |
| Aider | `CONVENTIONS.md` via `--read` |
| Gemini CLI / Antigravity | `.agents/workflows/kernel.md` |
| Codex | `$command` syntax — `$debugger`, `$fixer`, `$deployer`, `$guide`, `$evaluator` all work |

Edit `kernel.md`. Run `sync-kernel.sh`. All slots update.

---

*Atlas Guides — Kernel v1.3. Five rules, two loops, eight roles across two producer/auditor pipelines. Adds Deployer, Auditor, and Guide to Role Identification; adds coding-standards.md and deploy-spec.md/deploy-log.md to Memory Files; adds the Deploy Pipeline diagram alongside the existing Debug Pipeline.*
