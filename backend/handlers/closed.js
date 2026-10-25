import { recordOutcome } from "../registry.js";

export async function handlePRClosed(payload, octokit) {
  const { login } = payload.pull_request.user;
  const { owner, name } = payload.repository;
  const number = payload.pull_request.number;
  const outcome = payload.pull_request.merged ? "merged" : "rejected";

  const agent = recordOutcome({
    repo: `${owner.login}/${name}`,
    number,
    login,
    outcome
  });

  if (!agent) {
    return null;
  }

  await octokit.rest.issues.createComment({
    owner: owner.login,
    repo: name,
    issue_number: number,
    body: `AgentTrust: PR ${outcome}. ${agent.name}'s reputation score is now ${agent.score}/100`
  });

  return agent;
}
