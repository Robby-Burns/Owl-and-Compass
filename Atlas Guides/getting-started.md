# Atlas Guides — Getting Started

**Who this is for:** you, the human running sessions day to day — typing `/builder`, watching Checker work, answering a council's questions, deciding what to do when something escalates. This doc assumes you've never read a directive file and don't need to. It's the mental model, not the reference manual.

If you're looking to edit the framework itself (kernel rules, personas, the sync script), that's a different document — see `README.md` instead. This one is about *using* Atlas Guides, not maintaining it.

---

## The one idea that explains everything else

**No AI session ever grades its own work.**

Every time something gets built, planned, or fixed, one session does the work and a *different* session checks it — working only from a written report, never by re-reading the first session's reasoning. That's it. Almost every rule in this framework is that idea applied to a different situation: building a feature, fixing a bug, changing infrastructure. Once you have that, the rest is mostly naming.

---

## The cast of roles

You won't use all of these on a given day. Think of them as hats one AI tool puts on depending on what you ask it to do.

| Role | Does | Never does |
|---|---|---|
| **Builder** | Implements one user story | Check its own work, redesign the spec mid-build |
| **Checker** | Tries to break what Builder built | Tell Builder *how* to fix it — only shows *what* breaks |
| **Evaluator** | Unblocks a story stuck after two Builder↔Checker rounds | Run a third round, add scope |
| **Fixer** | Triages and patches a bug | Approve its own patch |
| **Debugger** | Audits the Fixer's patch | Write the fix itself |
| **Deployer** | Plans and applies infrastructure changes | Approve its own destroy/replace |
| **Auditor** | Gates a destroy/replace before it happens | Touch the Terraform, run a full audit of routine changes |
| **Guide** | Walks you through your *first* deploy, phase by phase | Skip a phase because it "seems fine" |
| **Personas** (PM, Architect, Skeptic, Infosec, etc.) | Debate a spec *before* building starts | Touch code, re-debate mid-build |

Two pairs are doing the identical job in two different domains: **Fixer/Debugger** for code bugs, **Deployer/Auditor** for infrastructure changes. If you understand one pair, you understand the other.

---

## A story's life, start to finish

This is the path most work takes. Worth reading once end to end before you start.

**1. Discovery (once, at project start).** You paste a messy brain dump into `discovery-prompt.md` with a strong reasoning model. It interviews you in three phases — problem and users, architecture and risk, then phases and stories — and produces `spec.md`. This is your project's single source of truth: what's being built, in what order, at what risk level, reviewed by which personas.

**2. Spec council (`/spec-debate`), before any code.** For anything above trivial risk, the personas listed in that story's spec debate it — not the code, the *plan*. The Architect checks the structure holds together, Infosec checks the trust boundaries, the PM checks it actually serves a user, and so on. Output is a sharpened spec, or — if something's fundamentally wrong — a redirect back to discovery. You read the output and decide: proceed, amend, or send it back.

**3. Build (`/builder`).** Builder reads the story, sanity-checks its own size (a story with 5+ acceptance criteria gets flagged before any code is written — this catches "two stories wearing one story's clothing" early), and builds. Tests are written alongside, not after. When done, Builder writes a tight handoff to `current-loop.md` and stops. It does not pre-fix things it suspects Checker will find.

**4. Check (`/checker`).** A different session — ideally a different *tool*, so you're not trusting one model's blind spots twice — reads the handoff and tries to break it. Up to three demonstrated failures (five for HIGH-risk stories), each with an actual repro: a failing test or exact reproduction steps. A hunch isn't a finding. If Checker finds real problems, Builder gets one more loop to fix them.

**5. Safety check, if risk ≥ MED.** A mechanical scan — hardcoded secrets, vendor imports leaking outside `/adapters/`, unbounded loops, that kind of thing. Pattern matching, not judgment. Findings get fixed before close.

**6. Done, or escalate.** If Checker passes the story, it closes and `.build-context.md` gets updated. If Loop 2 *also* fails — or a HIGH-risk story comes back with five real problems in one pass — that's not a Loop 3. It's `/evaluator`, in a fresh chat with no prior context, making one decision (fix it directly, or in rare cases split it into two) and closing it out.

That's the whole loop. Discovery happens once. Council happens once per feature. Build→Check→(maybe loop)→Done happens once per story, over and over, for the life of the project.

---

## When something breaks in production

Different loop, same shape. `/fixer` triages, classifies severity, patches, and writes a Fixer Report — it does not declare itself done. `/debugger`, a separate session, audits that report across five lenses (does the root cause actually hold up, did Fixer miss part of the blast radius, does the patch follow the kernel's five rules, does it survive adversarial scenarios Fixer's own test wouldn't catch, is the regression rule actually enforceable). Two outcomes only: approved or rejected. One retry on rejection, then `/evaluator`.

One severity note worth knowing as the human in the loop: **HIGH-severity bugs are the one case where Fixer stops and asks you before touching anything.** Everything below that, Fixer fixes and reports — you're not a bottleneck for cosmetic or low-severity issues, only for the ones where a wrong autonomous call would actually hurt.

---

## When you're deploying infrastructure

Two different roles depending on where you are:

**First deploy ever → `/guide`.** Ten fixed phases, in order, from "does my spec exist" through "is this actually live and reachable by a real user." Guide stops and confirms after *every* phase, even the boring ones — version checks, billing confirmation, Docker daemon running — because those trivial-seeming phases are exactly where a wrong account ID silently breaks something three phases later. Guide will ask you directly whether it has real terminal access or needs to hand you commands to run yourself; don't assume it knows.

**Every deploy after that → `/deployer`.** Routine changes (adding a resource, an in-place update) go straight through, no gate. The moment a Terraform plan shows `destroy` or `forces replacement` on anything, Deployer stops automatically and produces a Plan Report for `/auditor` — a fast, narrow, three-question check (does the destroy match what you actually intended, is the data backed up, what else breaks because of this) rather than a full audit. That narrowness is deliberate: the point is to catch the irreversible mistake *before* it happens, fast enough that people don't route around the gate out of impatience.

---

## What you, the human, actually decide

The framework is opinionated about *how* AI sessions work, but it leaves real decisions to you, explicitly:

- **Council verdicts** — proceed, amend, or send back to discovery. The council surfaces disagreement; you resolve it.
- **HIGH-severity bug fixes** — Fixer stops and asks before acting.
- **Evaluator's fix-vs-split call** is made by Evaluator, but if the spec itself was the problem, that traces back to a decision you made at discovery.
- **Anything an Auditor rejects twice** — escalates to you directly, not just to another AI session.
- **Whether to act on Checker's optional hints.** Checker can suggest a direction; Builder (and ultimately you) decide whether to take it.

If you ever see "Loop cap reached" or "escalate to /evaluator," that's not a failure of the framework — it's the framework correctly refusing to spiral. Treat it as a signal that the story or the bug needs your judgment, not another automated pass.

---

## Quick reference: what to type, when

| You want to... | Type |
|---|---|
| See where the project stands | `/status` |
| Start a brand-new project | Run `discovery-prompt.md` in a fresh chat |
| Debate a feature's spec before building | `/spec-debate [feature]` |
| Build the next story | `/builder` |
| Review what Builder just built | `/checker` |
| Run the mechanical security/freshness scan | `/safety-check` |
| Unblock a story stuck at the loop cap | `/evaluator` (new chat, always) |
| Fix a production bug | `/fixer` |
| Audit a bug fix | `/debugger` |
| Do your very first deploy | `/guide` |
| Deploy a routine change after that | `/deployer` |

---

## One thing worth internalizing before you start

This framework was built by someone who'd already been burned by the alternative — the README is candid that an earlier, heavier version of this same idea produced 20-cycle continuation spirals and bureaucratic role gates that nobody actually followed. The loop cap, the narrow Auditor, the "Evaluator defaults to fix-in-place, not split" rule — these aren't arbitrary constraints. They're scar tissue. If a role ever seems frustratingly narrow (Auditor not doing a full audit, Checker capping at three scenarios, Evaluator refusing a third loop), that's very likely intentional discipline, not an oversight — the broader version was tried and didn't work.
