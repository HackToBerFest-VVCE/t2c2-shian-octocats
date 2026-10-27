import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { getPRs, setDataFile } from "../registry.js";
import { handlePROpened } from "./opened.js";

let temporaryDirectory;

function payload(number, login) {
  return {
    repository: {
      owner: { login: "acme" },
      name: "app",
    },
    pull_request: {
      user: { login },
      number,
      title: "Add feature",
    },
  };
}

function fakeOctokit() {
  const labels = [];
  const comments = [];
  return {
    labels,
    comments,
    octokit: {
      rest: {
        issues: {
          addLabels: async (label) => labels.push(label),
          createComment: async (comment) => comments.push(comment),
        },
      },
    },
  };
}

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "agenttrust-opened-test-"));
  setDataFile(join(temporaryDirectory, "registry.json"));
  await writeFile(
    join(temporaryDirectory, "registry.json"),
    JSON.stringify({
      agents: [
        {
          name: "ForgePilot",
          identifier: "agent-forgepilot",
          score: 94,
          mergedPRs: 22,
          rejectedPRs: 1,
        },
      ],
      pullRequests: [],
    }),
    "utf8",
  );
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("handlePROpened", () => {
  it("records and labels a known agent and posts their reputation", async () => {
    const fake = fakeOctokit();

    const pullRequest = await handlePROpened(
      payload(101, "AGENT-FORGEPILOT"),
      fake.octokit,
    );

    assert.equal(pullRequest.agent, "ForgePilot");
    assert.equal(pullRequest.status, "Verified");
    assert.equal(getPRs().length, 1);
    assert.deepEqual(fake.labels[0].labels, ["agenttrust: verified"]);
    assert.equal(
      fake.comments[0].body,
      "AgentTrust: Verified agent ForgePilot. Reputation score: 94/100. 22 PRs merged, 1 rejected.",
    );
  });

  it("records and labels an unknown agent and posts the review warning", async () => {
    const fake = fakeOctokit();

    const pullRequest = await handlePROpened(
      payload(102, "agent-missing"),
      fake.octokit,
    );

    assert.equal(pullRequest.agent, "Unknown");
    assert.equal(pullRequest.status, "Unknown");
    assert.deepEqual(fake.labels[0].labels, ["agenttrust: unknown"]);
    assert.equal(
      fake.comments[0].body,
      "AgentTrust: Unknown agent. No registered identity or history, so please review carefully.",
    );
  });
});
