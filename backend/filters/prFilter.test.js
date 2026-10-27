import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePR } from "./prFilter.js";

const trustedAgent = { score: 80 };

function evaluate(overrides = {}) {
  return evaluatePR({
    pr: { additions: 20, deletions: 10, body: "A useful change", draft: false },
    files: ["src/app.js", "src/app.test.js"],
    agent: trustedAgent,
    openPRsByAgent: 1,
    ...overrides,
  });
}

describe("evaluatePR", () => {
  it("fast-tracks eligible changes", () => {
    assert.equal(evaluate().lane, "fast-track");
  });

  it("uses the standard lane when the agent does not meet fast-track score criteria", () => {
    assert.equal(evaluate({ agent: { score: 60 } }).lane, "standard");
  });

  it("uses the careful lane for an unknown agent", () => {
    const result = evaluate({ agent: null });

    assert.equal(result.lane, "careful");
    assert.ok(result.reasons.includes("The pull request author is not a registered agent."));
  });

  it("uses the careful lane for a sensitive file", () => {
    const result = evaluate({ files: [".github/workflows/release.yml"] });

    assert.equal(result.lane, "careful");
    assert.ok(result.reasons.includes("The pull request touches .github/workflows."));
  });

  it("holds a draft pull request", () => {
    const result = evaluate({
      pr: { additions: 20, deletions: 10, body: "Description", draft: true },
    });

    assert.equal(result.lane, "hold");
    assert.ok(result.reasons.includes("The pull request is a draft."));
  });

  it("holds agents below the score threshold", () => {
    const result = evaluate({ agent: { score: 39 } });

    assert.equal(result.lane, "hold");
    assert.ok(result.reasons.includes("The agent score is below 40."));
  });

  it("requires tests when non-test code changes for fast-track", () => {
    const result = evaluate({ files: ["src/app.js"] });

    assert.equal(result.lane, "standard");
  });

  it("routes changes over the careful size threshold to careful", () => {
    const result = evaluate({
      pr: { additions: 501, deletions: 0, body: "Description", draft: false },
    });

    assert.equal(result.lane, "careful");
    assert.ok(result.reasons.includes("The pull request changes more than 500 lines."));
  });

  it("holds when the agent has more than five open pull requests", () => {
    const result = evaluate({ openPRsByAgent: 6 });

    assert.equal(result.lane, "hold");
    assert.ok(result.reasons.includes("The agent has more than 5 open pull requests."));
  });

  it("recognizes lockfiles as sensitive regardless of path casing", () => {
    const result = evaluate({ files: ["config/Some.lock"] });

    assert.equal(result.lane, "careful");
    assert.ok(result.reasons.includes("The pull request changes sensitive files."));
  });
});
