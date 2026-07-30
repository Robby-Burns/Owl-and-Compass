# Atlas Guides — Debugger Examples

**Companion to:** `debugger-directive.md`. Load once for orientation. Not required reading on every boot.

---

## Worked Example: Auditing the Tax-Rate Fix

Continuing the Fixer Report from `fixer-examples.md` (the `tax_rate` None-fallback patch for legacy quotes). Here's how a Debugger audit of that exact patch would run through all five lenses.

**Lens 1 — Root Cause Verification:**
The Fixer's hypothesis: `tax_rate` is `None` on quotes created before the regional-tax migration, and multiplying against `None` produces NaN. Checked: read the migration script referenced, confirmed it only backfilled rates for quotes created *after* a certain date, leaving older rows null — hypothesis holds.
`ROOT: CONFIRMED`

**Lens 2 — Blast Radius Audit:**
Fixer listed `pdf_export.py`, `quote_service.py`, and ~340 affected rows. Independent check: grepped for other callers of `calculate_tax()` — found `invoice_service.py` also calls it and was not in the Fixer's list. Invoices for the same legacy quotes would hit the identical None-multiplication bug.
`BLAST: INCOMPLETE — invoice_service.py also calls calculate_tax() on the same legacy quote rows and was not patched or even checked`

**Lens 3 — Kernel Rule Compliance:**
Checked the diff against all five rules: no vendor imports introduced, no hardcoded config (the fallback rate is pulled from the existing region-config lookup, not hardcoded), `.build-context.md` was appended not overwritten, risk level unaffected, no dynamic tool construction.
`COMPLIANCE: PASS`

**Lens 4 — Adversarial Scenarios (3 minimum):**
```
Scenario 1: Region with no default rate configured
  Condition: Legacy quote in a region that was added after the migration and has no
             default tax rate entry at all (not just null on the quote — missing region-wide)
  Expected:  Some explicit error or a documented further-fallback, not another silent NaN
  Result:    FAIL — falls through to the same None-multiplication bug one level up;
             the patch fixed the quote-level null but didn't handle a missing region default

Scenario 2: Concurrent backfill flag write
  Condition: Two requests render the same legacy quote's PDF simultaneously
  Expected:  Both succeed, flag write is idempotent
  Result:    PASS — flag write is a simple field set, no race condition observed

Scenario 3: Second-order effect on invoice_service.py
  Condition: Given Lens 2's finding, does the same legacy-quote class break invoice generation?
  Expected:  Should be covered if blast radius were complete
  Result:    FAIL — confirms the Lens 2 finding; invoice generation for the same 340 rows
             still produces NaN, untouched by this patch
```

**Lens 5 — Regression Prevention:**
Fixer proposed a DB constraint or startup check flagging any `tax_rate IS NULL` row. That's specific enough to implement directly as a migration constraint or a CI-run data-integrity check.
`REGRESSION RULE: [Fixer's rule] — ENFORCEABLE: Yes, as a NOT NULL constraint with a default, or a startup assertion query. EXISTING COVERAGE GAP: Yes — no prior test asserted tax_rate is always populated post-migration, which is how 340 rows escaped notice for this long.`

**Verdict:**
```
VERDICT: REJECTED

Two scenario failures (Lens 4) plus an incomplete blast radius (Lens 2) that point at the
same underlying gap: this patch only fixed pdf_export's path to the bug, not the bug's
actual root surface (calculate_tax() returning unhandled None, called from at least two
places). Fixer should patch at the calculate_tax() level — handle the None there once —
rather than patching each caller individually, and must check for and handle the "region
has no default rate at all" case explicitly rather than letting it fall through to a
second silent failure.
```

**Why this is a good example of the discipline working:** The Fixer's patch passed its own reproduction test and looked complete from inside that one file. The Debugger's job — finding what the Fixer, invested in believing their fix worked, didn't go looking for — is exactly what surfaced the second caller and the deeper root cause. This is the whole reason the role split exists: a self-audit would have stopped at "the test I wrote passes."

---

## Calibration Note: What Counts as a Real Adversarial Finding

Lens 4's scenarios should produce genuine PASS/FAIL/UNKNOWN results, not theater. A scenario that's clearly going to pass and adds no information ("what if the input is a normal string" when the bug has nothing to do with string handling) is filler. Pick scenario types that actually relate to the bug's domain — the example above used Edge Input, Concurrency, and Second-Order Effect because those were the types plausible for a data-backfill bug; a concurrency bug would instead warrant deeper concurrency scenarios and might skip edge-input entirely if it's irrelevant.
