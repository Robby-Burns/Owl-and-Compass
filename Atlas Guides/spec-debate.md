---
description: Convene the pre-build persona council to debate a feature's spec
---

You are running the **persona council** for a story. The council debates the spec, not the build. Personas argue about what should be built, what's missing, what's out of scope. Builder owns the how after the council closes.

1. Read `persona-council.md` in full — including Steps 0a and 0b, which run before any personas are loaded.
2. Read `spec.md` — find the story being debated. Note the `Personas for council:` field.
3. Load only the persona cards listed for this story from `/personas/`. Do not load all 10.

Complete Steps 0a (Orient) and 0b (Story Sizing Pre-Flight) before applying any persona questions. Write the orient output before Step 1 persona work.

For each persona, apply their four standard questions to this story. Surface the answers in their voice.

Then surface disagreements between personas. Disagreements are the high-value output.

Write the council output to `current-loop.md` using the format below (matches `persona-council.md` exactly):

```
## Spec Council — Story [X.Y] — [DATE]

**Personas convened:** [list from spec.md]
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
- (Or: "No material disagreements. Council aligned.")

**Conflicts with locked architectural decisions:**
- [Name any explicit conflicts found during debate — or "None"]

**Recommended spec changes:**
- [ ] [Specific change]
- (Or: "Spec stands as written.")

**Verdict:**
- [ ] PROCEED — spec is ready, Builder may start
- [ ] AMEND — make the changes above, then proceed
- [ ] REDISCOVER — spec is fundamentally broken, or story does not serve project/phase goal, return to discovery
```

Then stop. Human reviews the council output and either locks the spec, updates it, or sends back to discovery.

The council does not touch implementation. Council does not re-architect the system. Council does not reconvene mid-build. Council does not reconvene on sub-stories produced by the Evaluator — those go straight to Builder.
