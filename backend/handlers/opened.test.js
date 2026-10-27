import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { addPR, getPRs, setDataFile } from "../registry.js";
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
      additions: 20,
      deletions: 10,
      changed_files: 2,
      body: "A useful change",
      draft: false,
    },
  };
}

function fakeOctokit() {
  const labels = [];
  const comments = [];
  const fileRequests = [];
  return {
    labels,
    comments,
    fileRequests,
    octokit: {
      rest: {
        issues: {
          addLabels: async (label) => labels.push(label),
          createComment: async (comment) => comments.push(comment),
        },
        pulls: {
          listFiles: async (request) => {
            fileRequests.push(request);
            return {
              data: [
                { filename: "src/app.js" },
                { filename: "src/app.test.js" },
              ],
            };
          },
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
    assert.equal(pullRequest.lane, "fast-track");
    assert.ok(Array.isArray(pullRequest.reasons));
    assert.equal(getPRs().length, 1);
    assert.deepEqual(fake.labels[0].labels, ["agenttrust: verified"]);
    assert.deepEqual(fake.labels[1].labels, ["agenttrust: lane-fast-track"]);
    assert.deepEqual(fake.fileRequests[0], {
      owner: "acme",
      repo: "app",
      pull_number: 101,
      per_page: 100,
    });
    assert.equal(
      fake.comments[0].body,
      "AgentTrust: Verified agent ForgePilot. Reputation score: 94/100. 22 PRs merged, 1 rejected.\n\nLane: fast-track\nReasons:\n- The agent, change size, files, description, and tests meet fast-track criteria.",
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
    assert.equal(pullRequest.lane, "careful");
    assert.deepEqual(fake.labels[0].labels, ["agenttrust: unknown"]);
    assert.deepEqual(fake.labels[1].labels, ["agenttrust: lane-careful"]);
    assert.equal(
      fake.comments[0].body,
      "AgentTrust: Unknown agent. No registered identity or history, so please review carefully.\n\nLane: careful\nReasons:\n- The pull request author is not a registered agent.",
    );
  });

  it("keeps the identity label when listing changed files fails", async () => {
    const fake = fakeOctokit();
    fake.octokit.rest.pulls.listFiles = async () => {
      throw new Error("GitHub API unavailable");
    };

    const pullRequest = await handlePROpened(
      payload(103, "AGENT-FORGEPILOT"),
      fake.octokit,
    );

    assert.equal(pullRequest.status, "Verified");
    assert.equal("lane" in pullRequest, false);
    assert.deepEqual(fake.labels, [
      {
        owner: "acme",
        repo: "app",
        issue_number: 103,
        labels: ["agenttrust: verified"],
      },
    ]);
    assert.match(fake.comments[0].body, /^AgentTrust: Verified agent ForgePilot\./);
    assert.doesNotMatch(fake.comments[0].body, /Lane:/);
  });

  it("holds an agent with more than five open registry pull requests", async () => {
    for (let number = 1; number <= 6; number += 1) {
      addPR({
        repo: "acme/other",
        number,
        title: `Existing PR ${number}`,
        agent: "ForgePilot",
        status: "Verified",
      });
    }

    const fake = fakeOctokit();
    const pullRequest = await handlePROpened(
      payload(104, "AGENT-FORGEPILOT"),
      fake.octokit,
    );

    assert.equal(pullRequest.lane, "hold");
    assert.ok(pullRequest.reasons.includes("The agent has more than 5 open pull requests."));
    assert.deepEqual(fake.labels[1].labels, ["agenttrust: lane-hold"]);
  });
});
