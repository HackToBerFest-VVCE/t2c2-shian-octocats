import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, it } from "node:test";
import {
  addPR,
  getAgents,
  getPRs,
  lookupAgent,
  recordOutcome,
  setDataFile
} from "./registry.js";

let temporaryDirectory;
let dataFile;

beforeEach(async () => {
  temporaryDirectory = await mkdtemp(join(tmpdir(), "agenttrust-registry-test-"));
  dataFile = join(temporaryDirectory, "registry.json");
  await writeFile(
    dataFile,
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
          repo: "acme/telemetry",
          number: 1,
          title: "Add retry budget",
          agent: "ForgePilot",
          status: "Verified",
          outcome: "open"
        },
        {
          repo: "acme/cli",
          number: 2,
          title: "Improve completion",
          agent: "NightlyCoder",
          status: "Verified",
          outcome: "open"
        }
      ]
    }),
    "utf8"
  );
  setDataFile(dataFile);
});

afterEach(async () => {
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("lookupAgent", () => {
  it("finds a known agent without case-sensitive matching", () => {
    assert.equal(lookupAgent("AGENT-FoRgEpIlOt")?.name, "ForgePilot");
  });

  it("returns null for an unknown agent", () => {
    assert.equal(lookupAgent("agent-missing"), null);
  });
});

describe("addPR", () => {
  it('adds a pull request with an "open" outcome', async () => {
    const pullRequest = addPR({
      repo: "acme/web",
      number: 3,
      title: "Replace navigation hooks",
      agent: "ForgePilot",
      status: "Verified"
    });

    assert.equal(pullRequest.outcome, "open");
    assert.equal(getPRs().at(-1).outcome, "open");
    assert.equal("lane" in pullRequest, false);
    assert.equal("reasons" in pullRequest, false);
    assert.equal(getPRs().length, 3);
    assert.match(await readFile(dataFile, "utf8"), /Replace navigation hooks/);
  });

  it("stores optional lane and reasons", () => {
    const reasons = ["The pull request is a draft."];
    const pullRequest = addPR({
      repo: "acme/web",
      number: 4,
      title: "Add draft support",
      agent: "ForgePilot",
      status: "Verified",
      lane: "hold",
      reasons
    });

    assert.equal(pullRequest.lane, "hold");
    assert.deepEqual(pullRequest.reasons, reasons);
    assert.equal(getPRs().at(-1).lane, "hold");
    assert.deepEqual(getPRs().at(-1).reasons, reasons);
  });
});

describe("recordOutcome", () => {
  it("raises the score by 5 and increases mergedPRs for a merge", () => {
    const agent = recordOutcome({
      repo: "acme/telemetry",
      number: 1,
      login: "AGENT-FORGEPILOT",
      outcome: "merged"
    });

    assert.equal(agent.score, 55);
    assert.equal(agent.mergedPRs, 2);
    assert.equal(agent.totalPRs, 3);
    assert.equal(getPRs()[0].outcome, "merged");
  });

  it("lowers the score by 10 and increases rejectedPRs for a rejection", () => {
    const agent = recordOutcome({
      repo: "acme/cli",
      number: 2,
      login: "agent-nightlycoder",
      outcome: "rejected"
    });

    assert.equal(agent.score, 40);
    assert.equal(agent.rejectedPRs, 2);
    assert.equal(agent.totalPRs, 3);
    assert.equal(getPRs()[1].outcome, "rejected");
  });

  it("does not allow scores above 100 or below 0", () => {
    for (let number = 3; number <= 13; number += 1) {
      addPR({
        repo: "acme/telemetry",
        number,
        title: `Merge ${number}`,
        agent: "ForgePilot",
        status: "Verified"
      });
      recordOutcome({
        repo: "acme/telemetry",
        number,
        login: "agent-forgepilot",
        outcome: "merged"
      });
    }

    for (let number = 14; number <= 19; number += 1) {
      addPR({
        repo: "acme/cli",
        number,
        title: `Reject ${number}`,
        agent: "NightlyCoder",
        status: "Verified"
      });
      recordOutcome({
        repo: "acme/cli",
        number,
        login: "agent-nightlycoder",
        outcome: "rejected"
      });
    }

    assert.equal(lookupAgent("agent-forgepilot").score, 100);
    assert.equal(lookupAgent("agent-nightlycoder").score, 0);
  });

  it("returns null for an unregistered agent", () => {
    addPR({
      repo: "open-data/ingest",
      number: 3,
      title: "Validate CSV input",
      agent: "Unknown",
      status: "Unknown"
    });

    assert.equal(
      recordOutcome({
        repo: "open-data/ingest",
        number: 3,
        login: "agent-missing",
        outcome: "rejected"
      }),
      null
    );
    assert.equal(getPRs().at(-1).outcome, "rejected");
  });
});
