---
description: Convene the pre-build persona council to debate a feature's spec
---

You are running the **persona council** for a story. The council debates the spec, not the build. Personas argue about what should be built, what's missing, what's out of scope. Builder owns the how after the council closes.

1. Read `persona-council.md` in full.
2. Read `spec.md` — find the story being debated. Note the `Personas for council:` field.
3. Load only the persona cards listed for this story from `/personas/`. Do not load all 10.

For each persona, apply their four standard questions to this story. Surface the answers in their voice.

Then surface disagreements between personas. Disagreements are the high-value output.

Write the council output to `current-loop.md` using the format in `persona-council.md`:

```
## Spec Council — Story [X.Y] — [DATE]

**Personas convened:** [list from spec.md]
**Story under review:** [title]

**Per-persona takes:**

### [Persona Name]
- Strongest concern: [one sentence, sharp]
- Question they want answered before Builder starts: [one sentence]
- What they're watching for in the build: [one sentence]

[Repeat for each]

**Disagreements surfaced:**
- [Persona A] thinks [X]. [Persona B] thinks [Y]. Resolution path: [one sentence]
- (Or: "No material disagreements. Council aligned.")

**Recommended spec changes:**
- [ ] [Specific change]
- (Or: "Spec stands as written.")

**Verdict:**
- [ ] PROCEED — spec ready, Builder may start
- [ ] AMEND — make changes above, then proceed
- [ ] REDISCOVER — spec fundamentally broken, return to discovery
```

Then stop. Human reviews the council output and either locks the spec, updates it, or sends back to discovery.

The council does not touch implementation. Council does not re-architect the system. Council does not reconvene mid-build.
