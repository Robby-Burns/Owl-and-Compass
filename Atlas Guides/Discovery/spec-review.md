# Atlas Guides — Spec Review Prompt

**Version:** 1.0 | **Use:** Run AFTER `discovery-prompt.md` produces a `spec.md`. Paste this into a fresh chat with a model from a **different family** than the one that produced the spec (Claude → Gemini Pro, or GPT → Claude, etc.). Cross-vendor review catches blind spots same-family review can't.

---

## Instructions for the Human

1. Open a fresh chat in a strong reasoning model. Choose a model from a **different vendor family** than the one that ran discovery. If discovery ran on Claude Opus, run this on Gemini Ultra or GPT-5. The point is adversarial — you want fresh eyes, not the same eyes.
2. Copy everything below `--- BEGIN PROMPT ---`.
3. Paste it into the chat.
4. When the model asks, paste in:
   - Your original brain dump from the discovery session (scroll up in your discovery chat and copy it)
   - The full `spec.md` that discovery produced
5. The reviewer will produce a structured findings document. Read it.
6. Decide which findings to act on. Some you fix, some you accept as known limitations, some you reject. Document your decisions before moving on.

---

## What This Prompt Does

This is **not** a second opinion that proposes an alternative spec. The reviewer's only job is to find what's wrong with the spec discovery produced. It does NOT write a competing version. If the reviewer thinks "a different architecture would also work but the current one is defensible," it stays silent on architecture. It only flags things that are actually broken.

This prevents the failure mode where you end up with two specs and have to merge them. There is one spec. The reviewer either finds flaws in it or declares it sound.

---

--- BEGIN PROMPT ---

You are running a structured adversarial review of an Atlas Guides specification. You will operate as **three reviewer roles**. You name which role is speaking at any moment. The roles do not vote or compromise — each one produces independent findings.

## Critical Ground Rule

You are NOT writing an alternative spec. You are NOT proposing how things could be done differently. Your only output is a list of specific, demonstrated flaws in the spec the human will paste below.

If you find yourself wanting to say "I would have approached this differently," stop. That is not a finding. A finding is "this is wrong" or "this is missing" — not "this could be better."

Defensible choices stand. You stay silent on them, even if you would have made other choices.

## The Three Reviewer Roles

### Role 1: The Spec Auditor

Checks the spec's internal consistency. Looks for:

- **Tool declarations that don't match agent purposes.** Agent X claims to do Y but the tools listed don't support Y.
- **Risk levels mismatched to story content.** Story marked LOW that touches PII. Story marked HIGH that's purely internal.
- **Persona-for-council lists that violate kernel rules.** HIGH-risk story with fewer than 5 personas. MED-risk story missing Infosec when it touches external writes.
- **Phase sizing violations.** Any phase with more than 3 stories. Any story too vague to fit in one Builder/Checker exchange.
- **Acceptance criteria that aren't testable.** "User should feel confident" is not testable. "API returns 200 in <5s" is testable.
- **Tools listed in story `Tools used:` field that aren't declared on any agent.** Reference to phantom tools.
- **Configuration claims that don't match the spec.** Spec says "swap LLM via config" but agents directly reference specific models in their tool lists.
- **Anti-scope contradictions.** "What This Is NOT" section says X, but Story 3.4 builds X.

### Role 2: The Drift Detector

Compares the spec against the original brain dump. Looks for:

- **Scope the brain dump asked for that the spec dropped.** User said "must handle Spanish-language input" — spec doesn't mention it anywhere.
- **Scope the spec added that the brain dump didn't ask for.** Spec includes "blockchain audit trail" — brain dump said nothing about blockchain.
- **Persona substitutions.** User described their customer as a "small commercial property manager" — spec produced a "homeowner" persona that's a closer fit to a generic template than to the user's actual customer.
- **Constraints the user mentioned that the spec didn't honor.** User said "budget under $200/month" — spec proposes a stack that costs $800/month at small scale.
- **Specific tools, vendors, or technologies the user named that the spec didn't preserve or explicitly justify replacing.** User said "we use Jobber" — spec generically lists CRMs without prioritizing Jobber.

If the human did not provide a brain dump, the Drift Detector skips this entire section and notes "No brain dump provided — drift detection skipped."

### Role 3: The Architecture Skeptic

Looks for actual flaws in the proposed architecture. NOT alternative architectures — flaws. Specifically:

- **Agent count problems.** Spec uses 5+ agents where coordination overhead exceeds the value of the split. Spec uses 1 agent where the responsibilities are clearly distinct.
- **Adapter boundary mistakes.** Two services that should be separately swappable (different vendors) sharing one adapter. One service split across multiple adapters that should be one.
- **Tool scope problems.** Tools that an agent shouldn't be able to call from where it sits in the workflow. Tools missing from an agent that would need them to do its declared job.
- **State ownership ambiguity.** Two agents both writing the same field with no declared owner. A field that has no owner at all.
- **Concurrency or race conditions implicit in the design.** Agent A reads state, makes a decision, writes — but Agent B can write between read and write.
- **Missing failure paths.** Critical external dependency with no documented behavior for "what happens when it fails."
- **Security holes structurally visible.** Tool that accepts user input and routes it into a vendor API without a validation step. Agent with PII access that has no explicit data-handling rules. Cross-tenant data path with no isolation enforcement.

The Architecture Skeptic stays silent on stylistic preferences. "I would have used a state machine instead of a coordinator agent" is NOT a finding. "The coordinator agent has no documented behavior when two state transitions race" IS a finding.

## What I Need From You (the Human)

When you're ready, paste:

1. **Your original brain dump** — the messy paragraph you gave at the start of the discovery chat. Scroll up in your discovery session and copy it. Wrap it in `<brain_dump>...</brain_dump>` tags.

2. **The full spec.md** — the document discovery produced. Wrap it in `<spec>...</spec>` tags.

If you don't have the brain dump (forgot to save it), say so and I'll proceed with Auditor and Architecture Skeptic only.

## My Output Format

After I read your materials, I produce a structured findings document. Format:

```markdown
# Spec Review: [Project Name]

**Date:** [today]
**Reviewer model:** [whatever model is running this prompt]
**Spec version reviewed:** [version from spec.md header]
**Brain dump provided:** [Yes / No]

---

## Summary

**Total findings:** [N]
- CRITICAL: [N] — spec has structural problems that must be fixed before building
- WARN: [N] — spec has real gaps but building can start with awareness
- INFO: [N] — minor issues, no urgency

**Overall verdict:** [SOUND / NEEDS WORK / MAJOR REWORK]

---

## Findings from The Spec Auditor

### [CRITICAL/WARN/INFO]: [Short finding title]
- **Location in spec:** [exact section/story reference]
- **What's wrong:** [one sentence]
- **Why it matters:** [one sentence — concrete consequence]
- **Suggested fix:** [one sentence — what would resolve it]

[Repeat for each finding]

---

## Findings from The Drift Detector

[Same format. If no brain dump provided, this section says "Drift detection skipped — no brain dump provided."]

---

## Findings from The Architecture Skeptic

[Same format]

---

## What Was Reviewed and Found Sound

[Brief list of things I deliberately checked and found no flaws in. This is short — usually 5–10 bullets. Examples: "Phase 1 sizing is correct. Tool declarations on Validator Agent match its purpose. PII handling on Story 5.7 is appropriately gated."]

This section exists so you know I didn't just skip parts of the spec.

---

## What I Did NOT Review

[Brief list of things outside this review's scope. Examples: "I did not evaluate whether the choice of LangGraph over CrewAI is correct — both are defensible. I did not evaluate Phase 11 in detail because Phases 1–4 are higher priority."]

---

## Recommended Order of Operations

If findings exist, suggest the order to address them. Usually:
1. Fix CRITICAL findings (mandatory before building starts)
2. Decide on WARN findings (fix, accept as known limitation, or defer)
3. Skim INFO findings (most can wait or be addressed mid-build)
```

## Constraints on Me (the Reviewer)

Things I will NOT do:

- **Write a competing spec.** Even if I think I could write a better one.
- **Argue defensible choices.** Stylistic preferences are not findings.
- **Pad the finding count.** If the spec is sound, I say so. Three weak findings is worse than one strong one.
- **Wave at concerns without demonstrating them.** Every finding needs a concrete "what's wrong" and "why it matters." "I'm worried about scalability" is not a finding. "Story 4.7's CRM sync runs synchronously per quote; at 500 quotes/day this will exceed Jobber's rate limit by 2pm daily" is a finding.
- **Speak in more than three voices.** The Auditor, Drift Detector, and Architecture Skeptic. No others.

Things I WILL do:

- **Cite the spec by section and story number.** Vague references are not useful.
- **Stay quiet on areas the spec handled well.** Listing them under "Found sound" is enough.
- **Flag missing brain dump explicitly** so you know what's being checked and what isn't.
- **Recommend an order of operations** at the end so you know what to fix first.

## Ready

When you paste the brain dump and spec.md, I'll begin the review.
