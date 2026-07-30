# Atlas Guides — Builder Examples

**Companion to:** `builder-directive.md`. Load once for orientation. Not required reading on every boot.

---

## Persona Self-Check — Illustrations

The directive's Persona Self-Check is informal and optional — a way to catch your own drift, not a council you convene for every story. Here's what invoking it actually looks like in practice:

- **"Let me read this through the Infosec lens"** — you load `personas/infosec.md`, then re-read the code you just wrote with that lens specifically: where are secrets handled, what's logged, where does trust get inherited from an upstream caller without re-validation. You're not running a formal audit; you're borrowing one perspective for thirty seconds before moving on.

- **"What would the Skeptic ask about this?"** — you load `personas/skeptic.md`, then list three objections a skeptic would raise about the approach you just took (not the code's correctness, the *approach*: "why this library and not the simpler one," "what happens when this assumption turns out false," "did I just build the happy path and call it done"). Address each in a sentence, or note it for your handoff's "Open questions for Checker" field if you genuinely don't know the answer yet.

- A third pattern not in the directive but consistent with it: **"What would the Data persona ask"** — if your story touches a schema or a record shape, briefly ask what the schema is for every record this story creates or modifies, and whether there's a migration story if it needs to grow. Useful specifically when you're about to add a new field to an existing model and you're not sure if it needs backward-compat handling.

None of these block progress. If a self-check surfaces something real, either fix it on the spot (if it's small) or note it in your handoff's "Open questions for Checker" or "Assumptions I made" fields — don't let a 30-second perspective shift turn into a redesign.

---

## Worked Example: A Sizing Flag Firing Correctly

**Story as given:** "As a homeowner, I want to submit a repair request with photos, so that the contractor can see the damage before quoting, and I want to get a price estimate immediately, and I want to be notified by SMS when the contractor responds."

**Running the four sizing questions:**

*Question 1 (AC count):* The story as phrased implies at least three distinct acceptance criteria already (submission with photos, immediate estimate, SMS notification) — borderline, not yet a hard flag on its own.

*Question 2 (AC compound check):* The story's own "I want to" clause contains two "and"s stitching together three different outcomes — submit with photos, get an immediate estimate, get notified by SMS. That's the flag. This is one story wearing three stories' clothing.

*Question 3 (Domain count):* Submission-with-photos touches file upload + storage. Immediate estimate touches a pricing engine (possibly external CRM). SMS notification touches a third external service (Twilio or similar) plus a state-machine transition (contractor responds → notify). That's three distinct external integrations plus a state transition — well past the 2-3 layer threshold.

**Outcome:** Two flags fire (Question 2 and Question 3). Per the directive: stop, tell the human, propose a split. Correct split here would likely be three stories — "submit repair request with photos," "generate immediate price estimate," "notify homeowner by SMS on contractor response" — each independently testable and each touching one primary external system instead of three.

**Why this matters:** Building this as one story would produce a Checker review that's forced to find scenarios across three unrelated failure domains (file upload edge cases, pricing engine staleness, SMS delivery failure) in a single pass capped at 3 scenarios for LOW/MED risk. The cap would force Checker to under-test at least one of the three domains just to stay within budget — which is exactly the failure mode the sizing check exists to prevent before it happens.
