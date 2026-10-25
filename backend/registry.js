import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultDataFile = fileURLToPath(new URL("./data/registry.json", import.meta.url));
let dataFile = defaultDataFile;

// Change the registry file used by subsequent reads and writes.
export function setDataFile(path) {
  dataFile = resolve(path);
}

// Read and return the complete registry object.
function readRegistry() {
  const registry = JSON.parse(readFileSync(dataFile, "utf8"));

  if (!Array.isArray(registry.agents) || !Array.isArray(registry.pullRequests)) {
    throw new Error("Registry data must contain agents and pullRequests arrays");
  }

  return registry;
}

// Persist the registry object, creating its parent directory when needed.
function saveRegistry(registry) {
  mkdirSync(dirname(dataFile), { recursive: true });
  writeFileSync(dataFile, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
}

// Return the registered agents list.
export function getAgents() {
  return readRegistry().agents;
}

// Return the recorded pull requests list.
export function getPRs() {
  return readRegistry().pullRequests;
}

// Find an agent by identifier without considering letter case.
export function lookupAgent(login) {
  const normalizedLogin = String(login).toLowerCase();
  return getAgents().find((agent) => String(agent.identifier).toLowerCase() === normalizedLogin) ?? null;
}

// Add an open pull request and save the updated registry.
export function addPR({ repo, number, title, agent, status }) {
  const registry = readRegistry();
  const pullRequest = { repo, number, title, agent, status, outcome: "open" };

  registry.pullRequests.push(pullRequest);
  saveRegistry(registry);
  return pullRequest;
}

// Record a PR outcome and update the registered agent's reputation.
export function recordOutcome({ repo, number, login, outcome }) {
  if (outcome !== "merged" && outcome !== "rejected") {
    throw new Error('Outcome must be "merged" or "rejected"');
  }

  const registry = readRegistry();
  const pullRequest = registry.pullRequests.find(
    (entry) => entry.repo === repo && String(entry.number) === String(number)
  );

  if (!pullRequest) {
    throw new Error(`Pull request not found: ${repo}#${number}`);
  }

  pullRequest.outcome = outcome;

  const agent = registry.agents.find(
    (entry) => String(entry.identifier).toLowerCase() === String(login).toLowerCase()
  );

  saveRegistry(registry);

  if (!agent) {
    return null;
  }

  agent.totalPRs += 1;
  if (outcome === "merged") {
    agent.mergedPRs += 1;
    agent.score = Math.min(100, agent.score + 5);
  } else {
    agent.rejectedPRs += 1;
    agent.score = Math.max(0, agent.score - 10);
  }

  saveRegistry(registry);
  return agent;
}
