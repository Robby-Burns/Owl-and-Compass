# Atlas Guides — Fixer Examples

**Companion to:** `fixer-directive.md`. Load once for orientation. Not required reading on every boot — the directive contains every rule you need to act; this file just shows one of those rules applied end to end.

---

## Worked Example: COSMETIC → MED Triage and Report

**Scenario:** A user reports that the quote PDF export shows `$NaN` for the tax line on some quotes.

**Phase 0 output:**
```
SEVERITY: MED — Wrong dollar amount shown to a customer-facing document; not data loss or security, but a real user-facing defect with money implications.
```

**Phase 1 — Triage Spec:**
```
- Severity:      MED
- Memory Match:  None — checked active-ledger.md, no prior tax-calc entries
- Root Cause:    tax_rate field is None for quotes created before the regional-tax migration; multiplication against None raises in numpy, caught upstream and silently rendered as NaN
- Blast Radius:  pdf_export.py (render path), quote_service.py (tax calc), any quote created before 2026-03-01 migration (~340 rows per a quick DB count)
- Reproduction:  pytest tests/test_pdf_export.py::test_legacy_quote_tax_render -k legacy
- Rollback Plan: git revert <commit-sha-of-this-patch>
```

**Phase 2 — Execution:**
1. Prove: ran the reproduction command, confirmed `$NaN` appears in the rendered output for a pre-migration quote fixture.
2. Patch: added a fallback in `quote_service.py` — if `tax_rate` is `None`, fall back to the region's current default rate and flag the quote as `tax_rate_backfilled: true` rather than rendering NaN. Did not touch the PDF renderer itself; the bad data was the root cause, not the rendering.
3. Verify: re-ran the reproduction test — now passes, renders the backfilled rate correctly with the flag set.

**Fixer Report (abbreviated for this example — full version follows the template in the directive):**
```
=== FIXER REPORT ===
Severity: MED
Root Cause: tax_rate None on pre-migration quotes, multiplication silently coerced to NaN
Patch: quote_service.py — added None-fallback to region default rate, sets tax_rate_backfilled flag
Verification: PASS — tests/test_pdf_export.py::test_legacy_quote_tax_render
Known Gaps: Does not backfill the 340 existing rows in the DB — only fixes future renders. Backfill is a separate decision (data migration vs. on-the-fly fallback forever) that the human should make explicitly.
Regression Rule: Add a DB constraint or a startup check that flags any quote row with tax_rate IS NULL — should never happen post-migration, and silent NaN should never reach a render path again.
SAFETY-CHECK NEEDED: Yes — MED
=== END FIXER REPORT ===
```

**Why this is a good example of the discipline working:** Note the Known Gaps field — this fix is intentionally narrow per Phase 2 Rule 2 in the directive ("minimal fix only, no scope creep"). The Fixer didn't decide unilaterally whether to backfill the database; that's a real decision with tradeoffs (silent retroactive data change vs. permanent fallback logic) that belongs to the human, not buried inside a MED-severity patch. Flagging it as a Known Gap rather than just doing it is the correct call.

---

## Common Misclassification Patterns

A few patterns worth knowing before you classify, since severity drives the whole autonomy policy:

- **"It only happens sometimes" is not automatically LOW.** Intermittent bugs that touch money, auth, or data integrity are still MED/HIGH on the strength of *impact*, not frequency. A rare but real billing error is still MED.
- **"It's just a typo in a log message" is not automatically COSMETIC if the log is what an on-call engineer reads during an incident.** Ask what the blast radius of the *mistake itself* is, not just the surface symptom.
- **Don't downgrade severity to avoid the human gate.** HIGH's "ask the human" requirement exists because some classes of fix (auth, payments, irreversible deletes) genuinely warrant a pause. Classifying HIGH as MED to keep moving defeats the entire point of the autonomy table.
