# Atlas Guides — Persona Council Skill

**Version:** 1.3 | **Triggered by:** `/spec-debate [feature]` command, before Builder starts work on a feature.

This skill convenes the personas listed for a feature in `spec.md` and walks them through a debate on the spec. Output: a clean, sharpened spec the Builder can work from, or a redirect back to discovery if the council finds the spec is broken.

The council debates **what** to build. Builder owns **how** to build it. Council does not touch implementation.

---

## When the Council Convenes

- **Before Builder starts any feature** — mandatory at risk MED and HIGH, optional at LOW
- **Before re-starting a feature** that was sent back from the Evaluator due to a spec problem (root cause: Spec gap)
- **When a story's risk level changes mid-project** (rare, but if discovery missed something)

Council does NOT convene:
- Mid-build (Builder owns the how, no one re-debates it)
- After Checker findings (those go back to Builder, not the council)
- For style or refactor work (no spec change, no council)
- **After an Evaluator split.** Sub-stories produced by the Evaluator inherit the risk level and council coverage of the original story. The Evaluator already reviewed the spec. Do not re-run the council on sub-stories — send them straight to Builder.

---

## How to Run It

### Step 0a: Orient — Read the Whole Picture First

Before loading personas, before sizing, before any debate — orient on what exists and where this story fits. This takes 5 minutes and prevents the council from making recommendations that conflict with locked decisions, duplicate work already done, or pull the project away from its stated goal.

Read these sections, in this order:

**From `spec.md`:**

1. **Problem statement and success metrics** — one paragraph. Confirms the direction the project is moving. Every council recommendation should move toward these metrics, not away from them.

2. **Architecture summary, agent list, adapter list** — establishes the structural envelope. What agents exist? What tools does each own? What adapters are declared? The council cannot make valid structural recommendations without knowing this. Recommending a new adapter when one already exists, or a tool assignment that violates the declared agent boundaries, is wasted debate.

3. **Current phase goal and all stories in the phase** — shows the story in context. What is the phase trying to achieve? What other stories are in the same phase? A story that looks correct in isolation may duplicate work from a sibling story, or leave a gap the phase needs filled.

4. **Adjacent phases** — one phase before and one phase after (if they exist). What was the foundation laid in the previous phase? What depends on this phase being done correctly? A council that only sees the current phase can greenlight a story that breaks the next phase's assumptions.

**From `.build-context.md`:**

5. **Architectural Decisions section** — what's locked. The council works within these decisions, not around them. If a council recommendation conflicts with a locked architectural decision, the conflict must be named explicitly and either resolved or escalated — not silently carried into the spec.

6. **Recent Changes (last 3 entries)** — what was just built. Prevents recommending work that's already done, or missing a dependency that was just introduced.

7. **Open Bugs section** — anything unresolved. If there's a known bug in an area this story touches, the council should know before recommending how to extend it.

**Orient output (write before Step 0b):**

```markdown
## Council Orient — Story [X.Y] — [DATE]

**Project goal:** [One sentence from problem statement]
**Success metrics:** [List from spec.md]
**Phase goal:** [One sentence — what this phase is trying to achieve]
**Stories in this phase:** [List all story titles — not just the one being debated]
**Locked architectural decisions relevant to this story:** [List from .build-context.md — or "None identified"]
**Recent changes in adjacent areas:** [List from .build-context.md — or "None in last 3 entries"]
**Open bugs relevant to this story:** [List — or "None"]
**Fit check:** [One sentence — how does this story serve the project goal and phase goal?]
```

If the fit check reveals that this story doesn't clearly serve the project goal or phase goal, stop. That's a discovery problem, not a council problem. Flag it and send back to discovery before debating anything.

---

### Step 0b: Story Sizing Pre-Flight

After orienting, check the story's structure. This takes two minutes and prevents a council from sharpening a story that should be split.

Answer these four questions:

**1. AC count:** Does this story have more than 4 acceptance criteria?
- If yes: flag for split. More than 4 ACs usually means more than one story.

**2. AC compound check:** Does any single AC contain more than one "and" or "so that"?
- If yes: that AC is two ACs, and possibly two stories. Mark it.

**3. Domain count:** How many distinct technical layers does this story touch?
- Count independently: UI, state machine, adapter, config, schema, auth boundary, external API.
- More than 2–3 distinct layers in one story is a flag.

**4. Enumeration completeness:** If this story involves validation, rejection rules, or security screening — is the full rejection surface enumerated in the spec?
- "Bounded to X" without listing X is an enumeration gap.
- If the council cannot enumerate the complete rejection surface before debate starts, the story is not ready. Enumerate first, then debate.

**Pre-flight outcomes:**

- **All clear:** Proceed to Step 1. Note "Pre-flight: CLEAR" in council output.
- **AC issues found:** Fix the ACs before debate. Split compound ACs. Note the changes.
- **Domain count too high:** Output "SPLIT REQUIRED" with proposed split lines. The council's job on an oversized story is to split it, not to clarify it. Do not debate the existing story.
- **Enumeration gap:** Stop. List every input this story should reject. List every input it should preserve. List what is explicitly out of scope. Get human confirmation, then proceed to debate.

---

**1. Read the feature spec.** Open `spec.md`. Find the story or stories the council is reviewing. Note the listed personas in the story's "Personas for council" field.

**2. Load the persona cards.** From `personas/`, load only the listed personas. Don't load all 10. The point of declaring per-feature is to avoid council bloat.

**3. For each persona, apply their four questions — grounded in the orient output.** Each persona card has its identity, its lenses, and four standard questions they ask of any spec. Apply them to this feature. Persona takes must be consistent with the locked architectural decisions and the phase context surfaced in Step 0a. A persona concern that conflicts with a locked decision must name the conflict explicitly — it cannot silently recommend something the architecture already ruled out.

**4. Surface the disagreements.** Where do the personas disagree about what should be in scope, what should be out, what assumptions the spec makes? Disagreements are the highest-value output. A disagreement that touches a locked architectural decision is an escalation signal, not a debate point — name it and stop.

**5. Produce the council output** (format below).

**6. Human reviews the output.** You either:
   - Lock the spec as-is and proceed to Builder
   - Update the spec based on council findings, then proceed
   - Send the whole thing back to discovery if council found the spec is fundamentally broken

---

## Council Output Format

Write to `current-loop.md` under a Council section:

```markdown
## Spec Council — Story [X.Y] — [DATE]

**Personas convened:** [list, from spec.md]
**Story under review:** [story title]
**Phase:** [phase name and goal, one sentence]
**Fit check:** [one sentence — how this story serves the project goal]
**Pre-flight result:** [CLEAR / AC issues fixed / SPLIT REQUIRED / Enumeration gap resolved]

**Per-persona takes:**

### [Persona Name]
- Strongest concern: [one sentence, sharp]
- Question they want answered before Builder starts: [one sentence]
- What they're watching for in the build: [one sentence]
- Conflicts with locked decisions: [name any — or "None"]

[Repeat for each persona]

**Disagreements surfaced:**
- [Persona A] thinks [X]. [Persona B] thinks [Y]. Resolution path: [one sentence]
- [If no disagreements: "No material disagreements. Council aligned."]

**Conflicts with locked architectural decisions:**
- [Name any explicit conflicts found during debate — or "None"]

**Recommended spec changes:**
- [ ] [Specific change, if any]
- [ ] [Specific change, if any]
- [If no changes: "Spec stands as written."]

**Verdict:**
- [ ] PROCEED — spec is ready, Builder may start
- [ ] AMEND — make the changes above, then proceed
- [ ] REDISCOVER — spec is fundamentally broken, or story does not serve project/phase goal, return to discovery
```

---

## Council Size Heuristic

The number of personas should match the risk level. Discovery sets this in the spec, but if the spec under-personas a risky feature, the council can flag it.

| Risk Level | Typical Council Size | Always Include |
|------------|---------------------|----------------|
| LOW | 2–3 personas | At minimum: PM, Architect |
| MED | 3–4 personas | Above + one of: Skeptic, UX, or Operations |
| HIGH | 5+ personas | Above + Infosec, Red Team |

If a HIGH-risk story has only 3 personas listed, the first council action is to flag the under-coverage. Then proceed.

---

## What Council Is NOT Allowed to Do

- **Re-architect the system.** That happened at discovery. If council thinks the architecture is wrong, that's REDISCOVER, not "let's redesign in the council output."
- **Override locked architectural decisions.** If a decision in `.build-context.md` conflicts with a council recommendation, the conflict is named and escalated — not resolved by the council unilaterally.
- **Dictate implementation.** Council can say "this story needs to handle the case where the API returns 429." Council cannot say "Builder must use the tenacity library."
- **Block on perfectionism.** Three personas in a row saying "but what if..." with no concrete failure mode is rabbit-holing. The Skeptic persona is allowed to do this for one round; after that, ground the concerns or drop them.
- **Reconvene mid-build.** Once the spec is locked and Builder starts, the council is done for this feature. Even if you have new thoughts. Hold them for the next feature's council, or for the Evaluator.
- **Reconvene on Evaluator sub-stories.** Sub-stories produced by the Evaluator go straight to Builder. The Evaluator already did the spec work.

---

## Speed

A council should take 5–15 minutes of session time, not hours. Step 0a adds 5 minutes up front and saves multiples of that in avoided conflicts. The persona cards are short on purpose. The questions are sharp on purpose. If a council is running long, something is wrong — usually the story is too big, the spec is too vague, or a locked architectural decision is in conflict. Flag it. A council that is running long because of an enumeration gap should stop and resolve the enumeration, not keep debating.

---

## Special Case: Solo Council

If you're working alone and want a quick gut-check before building, you can run a one-persona council. Still run Step 0a — read the orient sections. Then load the Skeptic card. Read your spec. Answer their four questions. Decide if you're ready.

This is informal and doesn't produce a council output document. It's a sanity check on your own thinking. Don't skip it on MED/HIGH features. Always run both Step 0a and Step 0b even for solo councils — together they take under 10 minutes and have stopped more spirals than any persona debate.

---

*Atlas Guides — Persona Council Skill v1.3. Orient before debate. Debate the what. Builder owns the how. Recommendations must fit the whole picture, not just the story in isolation.*
