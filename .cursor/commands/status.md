---
description: Atlas Guides project status — where are we?
---

Read these files in order and produce a concise status report:

1. `spec.md` — what's being built
2. `.build-context.md` — what's been done, decided, open
3. `current-loop.md` — what's happening right now

Then output the status in this format:

```
## Project: [Name]
## Framework: Atlas Guides v1.0

### Current State
- Active phase: [Phase N — Name]
- Active story: [X.Y — Title, or "between stories"]
- Active loop: [1, 2, or "none"]
- Active role: [Builder, Checker, or "awaiting human"]

### Recent Activity
- Last 3 stories closed: [list]
- Last decisions made: [last 2-3 architectural decisions]
- Active bugs: [count, with severity breakdown]

### Next Up
- Next story in queue: [from spec.md]
- Risk level: [LOW / MED / HIGH]
- Personas for council: [list]

### Open Issues
- [Anything blocking, or "none"]
```

Keep it short. No filler. If `current-loop.md` is empty, that's the signal between stories — say so plainly.
