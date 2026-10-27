import { evaluatePR } from "../filters/prFilter.js";
import { addPR, getPRs, lookupAgent } from "../registry.js";

export async function handlePROpened(payload, octokit) {
  try {
    const login = payload.pull_request.user.login;
    const { owner, name: repoName } = payload.repository;
    const number = payload.pull_request.number;
    const agent = lookupAgent(login);
    const status = agent ? "Verified" : "Unknown";
    const agentName = agent?.name ?? "Unknown";
    const repository = `${owner.login}/${repoName}`;

    await octokit.rest.issues.addLabels({
      owner: owner.login,
      repo: repoName,
      issue_number: number,
      labels: [`agenttrust: ${status.toLowerCase()}`],
    });

    let pullRequest;
    let evaluation;
    try {
      const { data: changedFiles } = await octokit.rest.pulls.listFiles({
        owner: owner.login,
        repo: repoName,
        pull_number: number,
        per_page: 100,
      });
      const openPRsByAgent = getPRs().filter(
        (entry) => entry.agent === agentName && entry.outcome === "open",
      ).length;

      evaluation = evaluatePR({
        pr: payload.pull_request,
        files: changedFiles.map((file) => file.filename),
        agent,
        openPRsByAgent,
      });
      pullRequest = addPR({
        repo: repository,
        number,
        title: payload.pull_request.title,
        agent: agentName,
        status,
        lane: evaluation.lane,
        reasons: evaluation.reasons,
      });

      await octokit.rest.issues.addLabels({
        owner: owner.login,
        repo: repoName,
        issue_number: number,
        labels: [`agenttrust: lane-${evaluation.lane}`],
      });
    } catch (error) {
      console.error("Failed to evaluate opened pull request:", error);
      if (!pullRequest) {
        pullRequest = addPR({
          repo: repository,
          number,
          title: payload.pull_request.title,
          agent: agentName,
          status,
        });
      }
    }

    const identityComment = agent
      ? `AgentTrust: Verified agent ${agent.name}. Reputation score: ${agent.score}/100. ${agent.mergedPRs} PRs merged, ${agent.rejectedPRs} rejected.`
      : "AgentTrust: Unknown agent. No registered identity or history, so please review carefully.";
    const laneComment = evaluation
      ? `\n\nLane: ${evaluation.lane}\nReasons:\n${evaluation.reasons.map((reason) => `- ${reason}`).join("\n")}`
      : "";

    await octokit.rest.issues.createComment({
      owner: owner.login,
      repo: repoName,
      issue_number: number,
      body: `${identityComment}${laneComment}`,
    });

    return pullRequest;
  } catch (error) {
    console.error("Failed to handle opened pull request:", error);
    return null;
  }
}
