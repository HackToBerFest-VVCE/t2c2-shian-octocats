import { addPR, lookupAgent } from "../registry.js";

export async function handlePROpened(payload, octokit) {
  try {
    const login = payload.pull_request.user.login;
    const { owner, name: repoName } = payload.repository;
    const number = payload.pull_request.number;
    const agent = lookupAgent(login);
    const status = agent ? "Verified" : "Unknown";
    const agentName = agent?.name ?? "Unknown";

    // Record the identity decision before annotating the GitHub pull request.
    const pullRequest = addPR({
      repo: `${owner.login}/${repoName}`,
      number,
      title: payload.pull_request.title,
      agent: agentName,
      status,
    });

    await octokit.rest.issues.addLabels({
      owner: owner.login,
      repo: repoName,
      issue_number: number,
      labels: [`agenttrust: ${status.toLowerCase()}`],
    });

    await octokit.rest.issues.createComment({
      owner: owner.login,
      repo: repoName,
      issue_number: number,
      body: agent
        ? `AgentTrust: Verified agent ${agent.name}. Reputation score: ${agent.score}/100. ${agent.mergedPRs} PRs merged, ${agent.rejectedPRs} rejected.`
        : "AgentTrust: Unknown agent. No registered identity or history, so please review carefully.",
    });

    return pullRequest;
  } catch (error) {
    console.error("Failed to handle opened pull request:", error);
    return null;
  }
}
