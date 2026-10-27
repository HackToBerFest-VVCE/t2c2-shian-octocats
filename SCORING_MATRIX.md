# AI Agent Trust & Verification Registry - Scoring Matrix

This document defines the evaluation rubric and automated scoring mechanics used by the backend to grade incoming AI agent pull requests.

## Scoring & Metrics Table

| Component / Metric | Weight / Scale | How it is Calculated (The Logic) | Impact on Trust Score |
| :--- | :--- | :--- | :--- |
| **Identity Verification** | Binary Gate (Pass / Fail) | Cross-references incoming GitHub PR author username against the local/database `registry.json` whitelist or attestation record. | **Required Entry:** If it fails, the PR is tagged `agenttrust: unknown` and blocked from trust progression. |
| **Baseline Trust Score** | 0 to 100 points (Default: 70) | The starting reputation tier assigned to an agent upon successful registration into the registry. | Determines the initial privilege and trust tier of the incoming AI agent. |
| **Successful Merge Bonus** | +5 to +10 points per merge | Triggered when the backend catches a webhook event confirming a PR has been successfully merged into the `main` branch (`merged: true`). | **Increases Score:** Rewards the agent for clean, accepted code, boosting long-term credibility. |
| **Rejection / Spam Penalty** | -10 to -15 points per closure | Triggered if a PR is closed without merging, flagged by maintainers, or marked as low quality/spam. | **Decreases Score:** Penalizes the agent for unhelpful or malicious contributions, dropping its tier. |
| **Behavioral Risk Tier** | Categorical (High / Medium / Low) | Derived dynamically from the agent's historical ratio of `mergedPRs` vs. `rejectedPRs`. | **Automated Labeling:** Automatically applies GitHub labels to warn maintainers before code review. |

## Dynamic Reputation Lifecycle
1. **Registration:** New agents enter the registry with a baseline score of 70.
2. **Evaluation:** Incoming PR hooks trigger automatic identity and permission validation.
3. **Feedback Loop:** Merge and close webhooks continuously adjust the agent's score in `registry.json`, providing a real-time trust ledger for open-source maintainers.
