# Atlas Guides — Coding Standards

**Version:** 1.1 | **Last ecosystem check:** 2026-06-17 | **Read by:** Builder, Fixer, Evaluator (when implementing), Deployer (for Terraform/Dockerfile sections)

This file has four tiers, each researched rather than memorized where it claims to be current, and re-verified periodically rather than trusted indefinitely:
- **Tier 1 — Python Ecosystem Defaults:** general-purpose Python tooling consensus (package manager, linter, type checker, test runner).
- **Tier 2 — Terraform/Dockerfile Ecosystem Defaults:** infra-code conventions, read by Deployer.
- **Tier 3 — Agentic Framework Conventions:** empty until `spec.md` names a framework; populated on first relevant Builder session.
- **Tier 4 — This Project's Decisions:** starts empty, grows append-only as Builder, Fixer, or Evaluator make real project-specific calls.

Later tiers win on conflict — a Tier 4 project decision beats a Tier 1/2/3 generic default, and a Tier 3 framework-specific convention beats a Tier 1 general one where they overlap.

Any code-writing role reads the tiers relevant to its work before writing code, and appends to Tier 4 when it makes a new convention decision that isn't already covered. Don't re-decide something Tier 4 already settled; don't silently violate an earlier tier without a Tier 4 entry explaining why.

---

## Re-Verification Rule

The "Last ecosystem check" date above is not a formality. Before relying on Tier 1 as current:

- If it's been more than ~3 months since that date, treat Tier 1 as possibly stale. Run a quick web search ("Python best practices [current year]", "Python linting tooling [current year]") before assuming it still holds, the same drift-check discipline Deployer already applies to cloud provider syntax.
- If a search turns up a real shift (a new tool has displaced the current default, a recommended version is now deprecated), update Tier 1 directly and bump the date and version at the top of this file. This is a Tier 1 edit, not a Tier 4 entry — Tier 1 is the ecosystem's state, not this project's choice.
- Don't re-verify on every single boot — that's wasted search calls for a layer that moves in months, not days. Check the date, decide if it's stale, search only if it might be.

---

## Tier 1: Python Ecosystem Defaults (researched 2026-06-17)

**Package management:** `uv` (Astral) is the current consensus default for new projects — significantly faster than pip-based workflows, manages virtual environments automatically, uses standard `pyproject.toml`. Use `uv add` / `uv sync` / `uv run` rather than raw `pip install`.

**Linting and formatting:** `ruff` (Astral) has consolidated most of the linting/formatting space — it implements the rules of Flake8 and many of its plugins (isort, pyupgrade, bandit) and replaces Black as a formatter, all in one fast tool. Run `ruff check --fix` for lint, `ruff format` for formatting. There's little reason to reach for the older Flake8+Black+isort combination on a new project; only keep that combination if an existing project already standardized on it (a Tier 4 decision would record that).

**Type checking:** Type hints are treated as standard practice on new code, not optional. Use `mypy` as the default type checker — `pyright` (which powers VS Code's Pylance) is a common and reasonable alternative, particularly if the human's editor is already VS Code. Don't enable `strict = true` retroactively on an existing codebase without a deliberate migration; start new code typed and tighten gradually.

**Testing:** `pytest` is the standard test runner — this matches what Builder's directive already assumes (`tests/test_xyz.py` naming, `pytest`-style fixtures).

**Pre-commit enforcement:** Use the `pre-commit` package with `ruff`'s own pre-commit hooks (`astral-sh/ruff-pre-commit`) to run lint/format checks before every commit, catching style drift before it reaches a Checker review. This is a recommendation, not a hard requirement — note in Tier 4 if the project skips it and why.

**Baseline new-project stack:** `uv` for packaging, `ruff` for lint+format, `mypy` or `pyright` for types, `pytest` for tests. This is the default Builder should reach for absent a Tier 4 override.

---

## Tier 2: Terraform / Dockerfile Ecosystem Defaults (researched 2026-06-17)

**Module structure:** Standard layout is `main.tf` (resources), `variables.tf` (inputs, each with both `type` and `description`), `outputs.tf` (outputs, each with a `description`), `versions.tf` (provider and Terraform version constraints), and a `README.md`. Keep provider blocks out of reusable modules — that's the caller's responsibility; modules only declare which providers/versions they're compatible with.

**Naming:** snake_case for resource labels, variables, and outputs (e.g. `aws_instance.web_server`, not `WebServer` or `web-server`). For a module's single instance of a resource type, the name `main` or `this` is conventional and avoids restating the obvious.

**Formatting:** Always run `terraform fmt` before committing — this is as close to mandatory as Terraform gets, the same way `gofmt` is non-negotiable in Go. Two-space indentation is standard.

**Don't hardcode environment-specific values** (project IDs, account IDs, region-specific settings) — these go in `.tfvars` per environment, matching `deploy-spec.md`'s Configuration Surface convention. Environment-independent defaults (e.g. a sensible default disk size) can have a `default` in `variables.tf`; environment-specific values (project ID, account) should have no default, forcing the caller to supply one deliberately.

**Dockerfile conventions:** multi-stage builds for compiled/build-step languages to keep final image size down; pin base image versions (avoid bare `latest`); run as a non-root user where the base image supports it; order layers so rarely-changing instructions (dependency installation) come before frequently-changing ones (application code copy) to maximize build cache effectiveness.

---

## Tier 3: Agentic Framework Conventions (populated from spec.md, not pre-filled)

This section is empty until a project's `spec.md` names a framework in its Architecture → Framework Choice field — discovery, not Builder, decides *which* framework, after researching current options (LangGraph, CrewAI, AutoGen-successors, vendor-native agent SDKs, or hand-rolled tool-calling). This section records *how to use* whatever was chosen, the same relationship Tier 1 has to Python generally.

**On first Builder session for a project with a named framework:** if this section is still empty, web-search the current idiomatic patterns for that specific framework and version (node/edge structuring if graph-based, state management conventions, tool-binding patterns, current major-version gotchas or deprecations) and populate it before writing the first agent. Don't build against a framework using memorized patterns that may predate the version actually in use — frameworks in this space version aggressively and break compatibility often.

```markdown
### [Framework name] — researched [date]
**Version in use:** [from spec.md / pyproject.toml]
**Structuring convention:** [how nodes/agents/chains are organized in this codebase]
**State management pattern:** [how state is passed/persisted between steps]
**Known gotchas for this version:** [anything version-specific worth flagging]
```

If the project is hand-rolled (no framework, per spec.md), note that here too — "No framework; direct tool-calling against [provider] API, see spec.md Architecture section for rationale" — so a future session doesn't assume a framework should have been chosen and go looking for one.

---

## Tier 4: This Project's Decisions

*(Empty at project start. Builder, Fixer, or Evaluator append an entry here whenever a real project-specific convention decision gets made — naming patterns not covered above, error-handling style, import organization, a deliberate deviation from an earlier tier's default. Format below.)*

```markdown
### [Decision name] — [date]
**Decided by:** [Builder / Fixer / Evaluator, story or fix reference if applicable]
**Decision:** [The actual rule, stated as a rule, not a discussion]
**Why:** [One sentence — what prompted this, especially if it deviates from an earlier tier]
```

---

## Constraints (Kernel-Compliant)

- This file is append-only for Tier 4, same discipline as `.build-context.md`. Don't rewrite or delete prior Tier 4 entries; if a decision is later reversed, append a new entry noting the reversal and why, rather than erasing the history.
- Tiers 1, 2, and 3 (the researched layers) may be edited directly when re-verification finds them stale — that's not a project decision, it's correcting a fact about the outside world.
- If Tier 4 ever directly contradicts an earlier tier without a stated reason, that's a gap — the next code-writing role to notice should add the missing "Why" rather than silently following whichever one it prefers.
