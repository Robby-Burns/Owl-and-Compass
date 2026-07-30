# Atlas Guides — Checker Examples

**Companion to:** `checker-directive.md`. Load once for orientation. Not required reading on every boot.

---

## Worked Scenario Example

This is what a real finding looks like, in the format the directive requires:

```markdown
**SCENARIO 1: ShopVOX rate-limit causes silent stale write**
**Severity:** CRITICAL

**Setup:** Cached pricing snapshot is 6 hours old. CRM sync job runs.
**Trigger:** ShopVOX returns 429 on the first sync attempt.
**Sequence:**
  1. sync_pricing() catches 429 in adapter
  2. Adapter returns None to the service layer
  3. Service layer interprets None as "no update needed"
  4. Cached snapshot is kept and quote uses it without watermark
**Failure:** Quote is sent to homeowner as "live pricing" when it's actually 6 hours old.
**Why it matters:** Violates the estimate-only watermark guardrail in spec.md.
**Repro:** tests/test_sync_429.py — mocks ShopVOX returning 429, asserts watermark presence
**Hints (optional, non-binding):** The adapter's None return is the ambiguous signal — distinguishing "no update" from "update failed" at the return type level would remove the service layer's guessing.
```

That's a finding. Not "I'm worried about rate limits." Not "consider adding watermarks." A concrete failure path with a test that demonstrates it.

Notice what makes this work as a finding rather than a hunch: every field is concrete. "Setup" states an actual state, not a category of states. "Sequence" is a numbered trace through what the code does, not a description of what it might do. "Repro" names an actual test file. If you can't fill in a field this specifically, you don't have a finding yet — you have a suspicion, and suspicions don't go in the audit.

---

## Common Spec Drift Patterns

The Spec Alignment lens catches the most subtle category of problem because passing tests and clean code can both be true while Builder still built the wrong thing. Watch for these patterns:

- **Story said "handle ShopVOX 429s"** — Builder built generic retry, but it doesn't handle the specific 429-during-sync case the story actually named. The generic version looks like it covers the specific one; it often doesn't, because the specific case has a detail (like the stale-write scenario above) that a generic retry doesn't address.

- **Story said "watermark estimate-only outputs"** — Builder added a watermark, but it's hidden in a metadata field the homeowner never sees. Technically true (a watermark field exists), substantively false (no one looking at the output would know it's an estimate). The acceptance criterion's *intent* — the homeowner should know — wasn't met even though its *literal text* arguably was.

- **Story said "homeowner approval routes to dispatched state"** — Builder added the route, but didn't update the state machine, so the transition silently no-ops. This is the most dangerous drift pattern: the code added the surface-level thing asked for (a route) without the underlying thing that route was supposed to do (a real state transition). Looks done. Isn't.

- **Story added features the spec didn't ask for** — scope creep that wasn't in the discovery. Even a "better" addition is drift. If Builder added an email notification alongside the requested SMS notification because "why not, it's easy," flag it — not because email notifications are bad, but because nobody decided this was in scope, and now it's an undocumented behavior the next person has to reverse-engineer.

The common thread: drift is rarely Builder doing something obviously wrong. It's usually Builder satisfying the letter of an AC while missing what the AC was actually for. That's exactly why this lens deserves the emphasis the directive gives it — a naive pass/fail read of the acceptance criteria checkboxes won't catch any of these four examples, since in each case the checkbox could honestly be checked.
