import test from "node:test";
import assert from "node:assert";
import {
  createFounder,
  saveTouchpoint,
  getFounders,
  getFounderDetails,
  generatePrepBrief
} from "./actions";

test("Next.js Server Actions integration suite", async (t) => {
  await t.test("should retrieve default founders list", async () => {
    const list = await getFounders();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 2);
    assert.strictEqual(list[0].full_name, "Maya Lin");
  });

  await t.test("should create a new founder profile", async () => {
    const newFounder = await createFounder({
      fullName: "Test Founder",
      companyName: "Test Co",
      companyStage: "Pre-Seed",
      industry: "BioTech",
      techStack: "Python, AWS",
      bio: "Developing custom lab automation systems.",
    });

    assert.ok(newFounder);
    assert.ok(newFounder.id);
    assert.strictEqual(newFounder.full_name, "Test Founder");
    assert.strictEqual(newFounder.company_stage, "Pre-Seed");

    // Verify it is returned in the list
    const list = await getFounders();
    assert.ok(list.some((f) => f.id === newFounder.id));
  });

  await t.test("should log and save a touchpoint note", async () => {
    const list = await getFounders();
    const targetFounder = list[0];

    const touchpoint = await saveTouchpoint({
      founderId: targetFounder.id,
      content: "Discussed promise of vector indexing follow up",
      sourceType: "email",
    });

    assert.ok(touchpoint);
    assert.strictEqual(touchpoint.founder_id, targetFounder.id);
    assert.strictEqual(touchpoint.source_type, "email");

    // Verify details retrieval
    const details = await getFounderDetails(targetFounder.id);
    assert.strictEqual(details.founder?.id, targetFounder.id);
    assert.ok(details.touchpoints.length >= 1);
    assert.ok(details.timelineEvents.length >= 1);

    // Verify timeline simulated event creation with loops/promises
    const matchedEvent = details.timelineEvents.find((e) => e.founder_id === targetFounder.id);
    assert.ok(matchedEvent);
    assert.ok(matchedEvent.open_loops.length >= 1);
  });

  await t.test("should generate structured prep briefs", async () => {
    const list = await getFounders();
    const targetFounder = list[0];

    const brief = await generatePrepBrief(targetFounder.id);
    assert.ok(brief);
    assert.strictEqual(brief.founder_id, targetFounder.id);
    assert.ok(brief.observations.length >= 2);
    assert.ok(brief.suggested_questions.length >= 3);
    assert.ok(brief.linkedin_draft);
    assert.ok(brief.email_draft);
    assert.ok(brief.observations[0].evidence_urls.length >= 1);
  });
});
