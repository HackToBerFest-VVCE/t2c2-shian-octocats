# AgentTrust
AI coding agents now open pull requests on open-source repos, but maintainers can't tell which agent sent a change or whether it can be trusted.
AgentTrust is a GitHub App, built with GitHub Copilot, that identifies the agent behind each pull request and labels it Verified or Unknown with a reputation score.
When the maintainer merges or rejects the PR, the agent's score updates automatically.
A dashboard shows every agent, its score and its pull request history.