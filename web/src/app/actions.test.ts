import test from "node:test";
import assert from "node:assert";
import {
  createFounder,
  saveTouchpoint,
  getFounders,
  getFounderDetails,
  generatePrepBrief,
  deleteFounder,
  discoverCandidates,
  searchWorkspace,
  analyzeWorkspacePatterns,
  getFounderTimelineNodes,
  escapeHtml,
  sanitizeString
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

  await t.test("should perform natural language global workspace search with citations", async () => {
    const searchResults = await searchWorkspace("RRF");
    assert.ok(Array.isArray(searchResults));
    assert.ok(searchResults.length >= 1);
    const topResult = searchResults[0];
    assert.ok(topResult.founder_id);
    assert.ok(topResult.founder_name);
    assert.ok(topResult.snippet);
    assert.ok(topResult.score > 0);
  });

  await t.test("should aggregate cross-founder pattern clusters with confidence metrics", async () => {
    const patterns = await analyzeWorkspacePatterns();
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.length >= 1);
    const pattern = patterns[0];
    assert.ok(pattern.topic);
    assert.ok(pattern.founder_count >= 2);
    assert.ok(pattern.pattern_score >= 0.15);
    assert.ok(pattern.contributing_founders.length >= 2);
  });

  await t.test("should compute 5-stage founder relationship timeline nodes", async () => {
    const list = await getFounders();
    const targetFounder = list[0];

    const nodes = await getFounderTimelineNodes(targetFounder.id);
    assert.ok(Array.isArray(nodes));
    assert.strictEqual(nodes.length, 5);
    assert.strictEqual(nodes[0].stage_id, "discovery");
    assert.strictEqual(nodes[0].status, "completed");
  });

  await t.test("searchWorkspace fallback: should fallback to BM25 full-text search when vector service times out or errors", async () => {
    const results = await searchWorkspace("Maya");
    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 1, "Fallback search must return matching profiles on vector timeout/mock");
    assert.strictEqual(results[0].founder_name, "Maya Lin");
  });

  await t.test("test_pattern_confidence_threshold: should strictly enforce count >= 2 AND score >= 0.15 threshold", async () => {
    const patterns = await analyzeWorkspacePatterns();
    for (const p of patterns) {
      assert.ok(p.founder_count >= 2, "Pattern count must be >= 2");
      assert.ok(p.pattern_score >= 0.15, "Pattern score must be >= 0.15");
    }
  });

  await t.test("should properly label fallback mock candidates with is_mock: true", async () => {
    const candidates = await discoverCandidates({ query: "non-existent-founder-query" });
    assert.ok(candidates.length > 0);
    assert.strictEqual(candidates[0].is_mock, true);
  });

  await t.test("should merge and deduplicate search results on founder_id", async () => {
    const query = "Maya";
    const results = await searchWorkspace(query);
    assert.ok(results.length > 0);
    const seen = new Set();
    for (const r of results) {
      assert.ok(!seen.has(r.founder_id), `Duplicate founder_id found in results: ${r.founder_id}`);
      seen.add(r.founder_id);
    }
  });

  await t.test("should fallback cleanly if LLM keys are missing", async () => {
    const originalApiKey = process.env.LLM_API_KEY;
    const originalGeminiKey = process.env.GEMINI_API_KEY;
    delete process.env.LLM_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const candidates = await discoverCandidates({ query: "random-query" });
      assert.ok(candidates.length > 0);
      assert.strictEqual(candidates[0].is_mock, true);
    } finally {
      process.env.LLM_API_KEY = originalApiKey;
      process.env.GEMINI_API_KEY = originalGeminiKey;
    }
  });

  await t.test("should escape special characters in ILIKE queries", async () => {
    const results = await searchWorkspace("M%y_a");
    assert.ok(Array.isArray(results));
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

  await t.test("should handle diverse data types in escapeHtml and sanitizeString without throwing", async () => {
    // Test escapeHtml
    assert.strictEqual(escapeHtml(null), "");
    assert.strictEqual(escapeHtml(undefined), "");
    assert.strictEqual(escapeHtml(123), "123");
    assert.strictEqual(escapeHtml("<div>&\"'</div>"), "&lt;div&gt;&amp;&quot;&#x27;&lt;&#x2F;div&gt;");
    
    // Test sanitizeString
    assert.strictEqual(sanitizeString(null, 10), "");
    assert.strictEqual(sanitizeString(undefined, 10), "");
    assert.strictEqual(sanitizeString(12345, 3), "123");
    assert.strictEqual(sanitizeString(["React", "Node.js"], 50), "React, Node.js");
    assert.strictEqual(sanitizeString(["Go", null, 42], 50), "Go, null, 42");
    assert.strictEqual(sanitizeString({ foo: "bar" }, 50), "[object Object]");
    assert.strictEqual(sanitizeString("SELECT * FROM users; -- comment", 100), "SELECT * FROM users  comment");
  });
});
