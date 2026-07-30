---
description: Run the mechanical safety/security scan
---

You are running the **safety-check skill** for the current story.

1. Read `safety-check.md` in full.
2. Read `current-loop.md` — identify the files Builder changed.
3. Run all 10 checks mechanically:
   - Check 1: Hardcoded secrets, keys, URLs, model strings
   - Check 2: Direct vendor imports outside `/adapters/`
   - Check 3: Dependency health (run `pip-audit` or `npm audit`)
   - Check 4: Deprecated API endpoints
   - Check 5: Trust boundary without validation
   - Check 6: Tool calls with dynamically constructed arguments
   - Check 7: Unbounded operations
   - Check 8: System prompt or instructions in error responses or logs
   - Check 9: `eval` / `exec` / `pickle` / shell calls on untrusted input
   - Check 10: Tools called outside the agent's declared TOOLS dict

For each check: scan the changed files, report PASS or list findings.

Append the result to `current-loop.md` using the format in `safety-check.md`:

```
## Safety Check — [DATE] — Story [X.Y]
**Result:** PASS / FAIL
**Checks run:** 10/10
**Findings:** [N]

[For each finding:]
**[CHECK N]: [Check name]** — [Severity]
- Location: [file:line]
- Pattern matched: [code]
- Fix: [directive]
```

Pattern matching, not judgment. Do not interpret findings — just report them. The Builder addresses them before closing the story.
