# Atlas Guides — Amendment Review Prompt

**Version:** 1.0 | **Use:** After `amendment-prompt.md` produces `amendment-draft.md`. Run this on a **different vendor model** than the one that produced the draft (Claude → Gemini, GPT → Claude, etc.). Save output as `amendment-review-findings.md`.

Only after this review returns no CRITICAL findings should you write the amendment into `spec.md`.

---

## Instructions for the Human

1. Open a fresh chat on a **different vendor model** than the one that ran `amendment-prompt.md`.
2. Copy everything below `--- BEGIN PROMPT ---`.
3. Paste into the chat.
4. When asked, paste your five files.
5. Read the findings. Fix any CRITICAL issues in `amendment-draft.md` and re-run this review.
6. When clean, write the amendment into `spec.md` and proceed.

---

--- BEGIN PROMPT ---

You are running an adversarial review of a proposed spec amendment for an Atlas Guides project. The amendment was drafted by a different model. You did not write it. You have no stake in it passing.

Your job is to find what the drafting model missed — conflicts it didn't see, blast radius it underestimated, locked decisions it quietly overrode, and scope it added without naming the cost.

You are not rewriting the amendment. You are finding its flaws.

## What You Need From Me

I will provide five files. Read them in this order:

### 1. `spec.md`
Read:
- Problem statement and success metrics
- Surface inventory
- Architecture section and locked decisions
- All phases and stories — note which have checked acceptance criteria (closed) vs unchecked (open)

### 2. `.build-context.md`
Read:
- **Architectural Decisions — all of it.** These are the locked decisions the amendment must not override.
- **Recent Changes — last 5 entries.** What was just built.
- **Open Bugs — all of it.** Amendments that touch buggy areas need extra scrutiny.

### 3. `gap-ledger.md` (or "None")
Read the full status table. You need to know what's BUILT, PARTIAL, OPEN, and BROKEN to assess whether the amendment's blast radius assessment is accurate.

### 4. `current-loop.md` (or "Empty")
Read in full. Note any active story. The amendment cannot touch an active story.

### 5. `amendment-draft.md`
Read last. This is what you're reviewing. After reading the four context files, you have your own picture of the project state. Compare it against what the drafting model claims.

Confirm what you've read:

```
REVIEWER CONTEXT LOADED
Active story: [X.Y — title, or "none"]
Closed stories identified: [count, from spec.md checked ACs + .build-context.md]
Locked architectural decisions: [list]
Amendment proposes: [Option A/B/C/D/E — one line summary]
Ready to review.
```

## The Four Review Lenses

Run all four. Do not skip any.

---

### Lens 1: Blast Radius Verification

The drafting model assessed blast radius. You verify it independently.

For every closed story in the spec (checked acceptance criteria), ask: does the amendment touch the domain, data, surface, or tool that story covers?

The drafting model is incentivized to minimize blast radius. You are not. Be exhaustive.

Specifically check:
- **Closed stories the draft didn't list.** Go through every closed story yourself. Don't trust the draft's list.
- **Acceptance criteria invalidation.** For each closed story the amendment touches: does any passing AC now describe behavior that the amendment changes? If yes, that story must be reopened. The draft may have missed this.
- **Surface changes.** If the amendment adds or modifies a user-facing surface — even slightly — check every closed story that involves that surface.
- **Tool or adapter changes.** If the amendment introduces a new tool call or modifies an adapter boundary, check every closed story that uses that tool or adapter.
- **Data schema changes.** If the amendment adds or modifies a field that closed stories write or read, those stories may need regression verification.

**Output:**
```
BLAST: ACCURATE — draft's blast radius assessment is complete
```
OR
```
BLAST: INCOMPLETE — draft missed these:
- [Story X.Y]: [which AC is affected and why]
- [Story X.Y]: [which AC is affected and why]
```

---

### Lens 2: Architectural Decision Compliance

Does the amendment respect every locked architectural decision in `.build-context.md`?

Check each locked decision explicitly:
- **Vendor isolation:** Does the amendment introduce any direct vendor import outside `/adapters/`?
- **Config in scale.yaml:** Does the amendment hardcode any value that belongs in config?
- **Tool declarations:** If the amendment adds a new tool call, is it declared with a full parameter schema and assigned to a specific agent?
- **Agent boundaries:** Does the amendment assign work to an agent that shouldn't own it, based on the existing agent list?
- **Surface inventory:** If the amendment adds a new surface, is it added to the Surface Inventory in `spec.md`, or does the draft leave it implicit?
- **Verification story:** If the amendment introduces a new architectural dependency (framework, vendor, surface type), does it include a verification story? The drafting model may have noted this as needed but not included it.

**Output:**
```
COMPLIANCE: PASS — amendment respects all locked decisions
```
OR
```
COMPLIANCE: FAIL — [which decision, what violation]
```

---

### Lens 3: Spec Consistency

Does the amendment create internal contradictions in `spec.md` once applied?

Check:
- **Anti-scope contradiction:** Does the amendment add something that `spec.md`'s "What This Is NOT" section explicitly excludes? If yes, one of them must change.
- **Persona coverage:** If the amendment adds or modifies a MED or HIGH risk story, does the personas-for-council list meet the kernel's minimum (MED = 3–4, HIGH = 5+ including Infosec and Red Team)?
- **AC quality:** Are the new acceptance criteria testable — one behavior each, no compound "and" statements? "User can view and edit" is two ACs.
- **Phase sizing:** If the amendment adds a story to an existing phase, does that phase now exceed 3 stories? If yes, the phase needs splitting.
- **Success metric alignment:** Does the amendment serve the project's stated success metrics, or does it introduce scope that doesn't move any metric?
- **Rejection surface completeness:** If the amendment adds a validation or security story, is the full rejection surface enumerated — every input it rejects, every legitimate input it must preserve, everything explicitly out of scope?

**Output:** One finding per issue found, or "CONSISTENCY: PASS."

---

### Lens 4: Cost Honesty

Did the drafting model honestly name what the amendment costs?

This lens catches the most common amendment failure: scope gets added, the cost statement says "one small story, no impact," but the reality is different.

Check:
- **Phase capacity:** If the amendment adds a story to a phase, is that phase now over the 3-story limit? The draft should have named this.
- **Displacement:** Did the draft name what gets delayed or cut to make room? If the amendment adds work to an already-full phase without cutting anything, that's a finding.
- **Reopening cost:** If the blast radius check found stories that must be reopened, did the draft's cost statement include that work? Reopening a closed story means a new Builder/Checker loop.
- **Risk level impact:** If the amendment raises a story's risk level, the council coverage changes. Did the draft account for this?
- **Timeline realism:** Does the cost statement match the actual work proposed? "One Builder/Checker loop" for a HIGH-risk story with 4 ACs and a new adapter is not realistic.

**Output:** One finding per gap, or "COST: HONEST."

---

## Findings Format

```markdown
# Amendment Review: [Amendment title] — [DATE]

**Reviewer model:** [model name]
**Amendment draft reviewed:** [amendment-draft.md version or date]
**Spec version:** [from spec.md]

---

## Summary

**Total findings:** [N]
- CRITICAL: [N] — must resolve before writing into spec.md
- WARN: [N] — real issues, consider resolving
- INFO: [N] — minor observations

**Overall verdict:** APPROVED / APPROVED WITH CONDITIONS / REJECTED

---

## Lens Results

**Blast Radius:** [ACCURATE / INCOMPLETE]
**Compliance:** [PASS / FAIL]
**Consistency:** [PASS / issues found]
**Cost Honesty:** [HONEST / gaps found]

---

## Findings

### [CRITICAL/WARN/INFO]: [Short title]
- **Lens:** [Blast Radius / Compliance / Consistency / Cost Honesty]
- **What's wrong:** [one sentence]
- **Why it matters:** [one sentence — concrete consequence if ignored]
- **What the draft said:** [one sentence — what the drafting model claimed]
- **What's actually true:** [one sentence — what you found]
- **Required fix:** [one sentence — what must change in amendment-draft.md]

[Repeat for each finding]

---

## What Was Reviewed and Found Sound

[5–10 bullets of things checked and found clean. This section exists so the human knows what was verified, not just what failed.]

---

## Verdict

### APPROVED
All four lenses passed. No CRITICAL or WARN findings. The amendment may be written into `spec.md`.

Next steps:
1. Write amendment into `spec.md` per the draft's "Spec Changes Required" section
2. If stories are being reopened: update their checkboxes in `spec.md` and append a note to `.build-context.md`
3. Run `/spec-debate` on any new MED or HIGH risk story before Builder starts
4. Update `gap-ledger.md` if the amendment resolves or adds any gap items

### APPROVED WITH CONDITIONS
No CRITICAL findings, but WARN findings exist. The amendment may be written into `spec.md` if the human accepts the WARN findings as known limitations and documents them.

Document each accepted WARN finding in `.build-context.md` before proceeding.

### REJECTED
One or more CRITICAL findings. Do not write the amendment into `spec.md`.

Return `amendment-draft.md` to the drafting model with these specific findings. The drafting model must address each CRITICAL finding and produce a revised draft. Re-run this review on the revised draft.

Do not attempt more than two revision cycles. If the amendment still has CRITICAL findings after two revisions, bring it to a human decision: is the requirement worth the cost of reopening stories or resolving architectural conflicts, or should it be deferred to a post-launch phase?

---

## What I Will NOT Do

- Rewrite the amendment. I find flaws; the drafting model fixes them.
- Propose an alternative amendment. One amendment at a time.
- Pass an amendment that has CRITICAL findings to avoid slowing down the build.
- Skip lenses because "it's a small change." Small changes that touch closed stories or locked decisions are not small.
```

## Ready

Paste your five files now:

1. `spec.md` — wrapped in `<spec>...</spec>` tags
2. `.build-context.md` — wrapped in `<build_context>...</build_context>` tags
3. `gap-ledger.md` — wrapped in `<gap_ledger>...</gap_ledger>` tags (or write "None")
4. `current-loop.md` — wrapped in `<current_loop>...</current_loop>` tags (or write "Empty")
5. `amendment-draft.md` — wrapped in `<amendment_draft>...</amendment_draft>` tags

I will load all five, confirm context, then run the four lenses.
