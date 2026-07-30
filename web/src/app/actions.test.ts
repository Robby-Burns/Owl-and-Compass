import test from "node:test";
import assert from "node:assert";
import {
  createFounder,
  saveTouchpoint,
  getFounders,
  getFounderDetails,
  generatePrepBrief,
  deleteFounder,
  discoverCandidates
} from "./actions";

test("Next.js Server Actions integration suite", async (t) => {
  await t.test("should retrieve default founders list", async () => {
    const list = await getFounders();
    assert.ok(Array.isArray(list));
    assert.ok(list.length >= 2);
    const maya = list.find((f) => f.id === "maya-lin-id");
    assert.ok(maya);
    assert.strictEqual(maya.full_name, "Maya Lin");
  });

  await t.test("should create a new founder profile with XSS protection", async () => {
    const maliciousPayload = "<svg onload=alert(1)> Test Name";
    const newFounder = await createFounder({
      fullName: maliciousPayload,
      companyName: "Test Co",
      companyStage: "Pre-Seed",
      industry: "BioTech",
      techStack: "Python, AWS",
      bio: "Developing custom lab automation systems.",
    });

    assert.ok(newFounder);
    assert.ok(newFounder.id);
    // Verify HTML characters got escaped, avoiding injection execution
    assert.strictEqual(newFounder.full_name, "&lt;svg onload&#x3D;alert(1)&gt; Test Name");
    assert.strictEqual(newFounder.company_stage, "Pre-Seed");
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
  });

  await t.test("should handle concurrent writes without race conditions", async () => {
    const list = await getFounders();
    const targetFounder = list[0];

    // Concurrently write three touchpoints
    const promises = [
      saveTouchpoint({
        founderId: targetFounder.id,
        content: "Concurrent touchpoint A",
        sourceType: "note",
      }),
      saveTouchpoint({
        founderId: targetFounder.id,
        content: "Concurrent touchpoint B",
        sourceType: "note",
      }),
      saveTouchpoint({
        founderId: targetFounder.id,
        content: "Concurrent touchpoint C",
        sourceType: "note",
      })
    ];

    const results = await Promise.all(promises);
    assert.ok(results.every((r) => r !== null));

    // Verify that all 3 writes exist in the list
    const details = await getFounderDetails(targetFounder.id);
    const contents = details.touchpoints.map((t) => t.content);
    assert.ok(contents.includes("Concurrent touchpoint A"));
    assert.ok(contents.includes("Concurrent touchpoint B"));
    assert.ok(contents.includes("Concurrent touchpoint C"));
  });

  await t.test("should generate structured prep briefs", async () => {
    const list = await getFounders();
    const targetFounder = list[0];

    const brief = await generatePrepBrief(targetFounder.id);
    assert.ok(brief);
    assert.strictEqual(brief.founder_id, targetFounder.id);
    assert.ok(brief.observations.length >= 2);
    assert.ok(brief.suggested_questions.length >= 3);
  });

  await t.test("should delete a founder profile cleanly", async () => {
    const created = await createFounder({
      fullName: "ToDelete Founder",
      companyName: "DeleteCo",
      companyStage: "Seed",
      industry: "Testing",
      bio: "Temporary founder to test deletion.",
    });

    assert.ok(created);
    const result = await deleteFounder(created.id);
    assert.strictEqual(result, true);

    const list = await getFounders();
    assert.strictEqual(list.some((f) => f.id === created.id), false);
  });

  await t.test("should discover founder candidates by criteria", async () => {
    const candidates = await discoverCandidates({ query: "AI" });
    assert.ok(Array.isArray(candidates));
    assert.ok(candidates.length >= 1);
    assert.ok(candidates[0].full_name);
  });

  await t.test("should trigger rate limiting on abuse", async () => {
    const list = await getFounders();
    const targetFounder = list[0];

    // Excessively call generatePrepBrief in a loop to trigger rate limiting
    let rateLimitTriggered = false;
    try {
      for (let i = 0; i < 40; i++) {
        await generatePrepBrief(targetFounder.id);
      }
    } catch (e: any) {
      if (e.message.includes("Rate limit exceeded")) {
        rateLimitTriggered = true;
      }
    }
    assert.ok(rateLimitTriggered, "Rate limiting was not triggered under excessive calls.");
  });
});
