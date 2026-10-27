import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { setDataFile, lookupAgent } from "../registry.js";
import { handlePRClosed } from "./closed.js";

let temporaryDirectory;

function payload(number, login, merged) {
  return {
    repository: {
      owner: { login: "acme" },
      name: "app"
    },
    pull_request: {
      user: { login },
      number,
      merged
    }
  };
}

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "agenttrust-closed-test-"));
  setDataFile(join(temporaryDirectory, "registry.json"));
  await writeFile(
    join(temporaryDirectory, "registry.json"),
    JSON.stringify({
      agents: [
        {
          name: "ForgePilot",
          identifier: "agent-forgepilot",
          score: 50,
          totalPRs: 2,
          mergedPRs: 1,
          rejectedPRs: 1
        },
        {
          name: "NightlyCoder",
          identifier: "agent-nightlycoder",
          score: 50,
          totalPRs: 2,
          mergedPRs: 1,
          rejectedPRs: 1
        }
      ],
      pullRequests: [
        {
          repo: "acme/app",
          number: 101,
          title: "Merge feature",
          agent: "ForgePilot",
          status: "Verified",
          outcome: "open"
        },
        {
          repo: "acme/app",
          number: 102,
          title: "Reject feature",
          agent: "NightlyCoder",
          status: "Verified",
          outcome: "open"
        },
        {
          repo: "acme/app",
          number: 103,
          title: "Unknown feature",
          agent: "Unknown",
          status: "Unknown",
          outcome: "open"
        }
      ]
    }),
    "utf8"
  );
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

function fakeOctokit() {
  const comments = [];
  return {
    comments,
    octokit: {
      rest: {
        issues: {
          createComment: async (comment) => {
            comments.push(comment);
          }
        }
      }
    }
  };
}

describe("handlePRClosed", () => {
  it("raises the agent score and posts a merged comment", async () => {
    const fake = fakeOctokit();

    const agent = await handlePRClosed(
      payload(101, "AGENT-FORGEPILOT", true),
      fake.octokit
    );

    assert.equal(agent.score, 55);
    assert.equal(agent.mergedPRs, 2);
    assert.equal(fake.comments.length, 1);
    assert.equal(
      fake.comments[0].body,
      "AgentTrust: PR merged. ForgePilot's reputation score is now 55/100"
    );
    assert.equal(fake.comments[0].owner, "acme");
    assert.equal(fake.comments[0].repo, "app");
    assert.equal(fake.comments[0].issue_number, 101);
  });

  it("lowers the agent score and posts a rejected comment", async () => {
    const fake = fakeOctokit();

    const agent = await handlePRClosed(
      payload(102, "agent-nightlycoder", false),
      fake.octokit
    );

    assert.equal(agent.score, 40);
    assert.equal(agent.rejectedPRs, 2);
    assert.equal(fake.comments.length, 1);
    assert.equal(
      fake.comments[0].body,
      "AgentTrust: PR rejected. NightlyCoder's reputation score is now 40/100"
    );
  });

  it("returns null and posts nothing for an unknown agent", async () => {
    const fake = fakeOctokit();

    const agent = await handlePRClosed(
      payload(103, "agent-missing", false),
      fake.octokit
    );

    assert.equal(agent, null);
    assert.equal(fake.comments.length, 0);
    assert.equal(lookupAgent("agent-forgepilot").score, 50);
  });
});
