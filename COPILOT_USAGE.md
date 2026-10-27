# Copilot Usage

## registry.js
- Prompt: Create `backend/registry.js` as an ES module (use import and export, no new dependencies). It reads and writes `backend/data/registry.json`, which holds an object with an "agents" list and a "pullRequests" list. Work out the default file path with import.meta.url (there is no __dirname in ES modules). Export these functions: setDataFile(path) to change which file is used (so tests can use a temporary file); getAgents() returns the agents list; getPRs() returns the pullRequests list; lookupAgent(login) finds the agent whose identifier matches login, ignoring capital letters, and returns the agent or null; addPR({repo, number, title, agent, status}) adds a pull request with outcome "open" and saves the file; recordOutcome({repo, number, login, outcome}) where outcome is "merged" or "rejected". It sets that pull request's outcome. If the agent is registered, it adds 1 to totalPRs and either mergedPRs (merged, score +5, maximum 100) or rejectedPRs (rejected, score -10, minimum 0), saves the file, and returns the updated agent. If the agent isn't registered, it returns null. Save the file after every change. Add short comments explaining each function.
- What Copilot produced: An ES-module registry service with configurable JSON storage, agent lookup, pull-request creation, outcome recording, score bounds, and persistence.
- What I checked or fixed: Verified all six exports, case-insensitive lookup, `+5`/`-10` score changes, 0–100 limits, JSON persistence, and `null` for unregistered agents.

## registry.test.js
- Prompt: Write `backend/registry.test.js` using node:test and node:assert. Before each test, create a temporary JSON file in the operating system's temp folder containing two sample agents and two sample pull requests, and call setDataFile with its path, so the real registry.json is never changed. Test: lookupAgent for a known agent (try different capital letters) and for an unknown one; addPR adds a pull request with outcome "open"; recordOutcome for merged raises the score by 5 and increases mergedPRs; recordOutcome for rejected lowers the score by 10 and increases rejectedPRs; the score never goes above 100 or below 0; and recordOutcome returns null for an unregistered agent.
- What Copilot produced: An isolated seven-test Node test suite using temporary registry files and coverage for lookup, PR creation, outcomes, score bounds, persistence, and unknown agents.
- What I checked or fixed: Ran `node --test`; all 7 tests passed with 0 failures, and confirmed the real `backend/data/registry.json` was not used by the tests.

## frontend dashboard API connection
- Prompt: Connect `frontend/script.js` to the real backend API with a mock-data flag, clear fallback errors, and unchanged agent and pull-request field names.
- What Copilot produced: Live `/api/agents` and `/api/prs` loading with mock fallback, followed by visibility-aware five-second refreshes that preserve selections.
- What I checked or fixed: Started the backend, verified both endpoints returned data, checked the dashboard rendered live values, tested a score change from 94 to 99, captured `docs/copilot-screenshots/dashboard-api-connect.png`, and restored `backend/data/registry.json`.

## frontend visual redesign
- Prompt: Redesign the frontend with a professional dark theme, then restore the previous color pattern when requested.
- What Copilot produced: A visual redesign pass followed by restoration of the cream, burgundy, mustard, and forest palette while preserving the existing layout and data behavior.
- What I checked or fixed: Reloaded the page, verified metrics, registry rows, pull-request activity, and mobile rendering, and captured `docs/copilot-screenshots/dashboard-visual-redesign.png`.

## frontend auto-refresh
- Prompt: Refetch live agents and pull requests every five seconds, preserve selections, stop while the page is hidden, test a registry score change, and restore the data file.
- What Copilot produced: Visibility-aware polling with immediate resume behavior and selection preservation across rerenders.
- What I checked or fixed: Changed ForgePilot from 94 to 99, observed the dashboard update within five seconds, captured the refreshed dashboard, and ran `git restore backend/data/registry.json`.

## frontend palette adjustment
- Prompt: Use the same color pattern as the previous dashboard.
- What Copilot produced: Restored the cream, burgundy, mustard, and forest palette without changing the new layout or data logic.
- What I checked or fixed: Reloaded the page, confirmed metrics and activity still rendered, captured `docs/copilot-screenshots/dashboard-visual-redesign.png`, and committed the palette-only change.

## frontend 3D depth
- Prompt: Add CSS and plain-JavaScript 3D depth, mouse-driven agent-card tilt, moving shadows, a layered hero grid, and reduced-motion support without breaking the dashboard.
- What Copilot produced: Perspective hover interactions for agent rows, a layered animated hero grid, and a `prefers-reduced-motion` override.
- What I checked or fixed: Verified hover rotation and shadow variables, confirmed five agent rows and eight pull requests, checked reduced-motion disables animations, and captured `docs/copilot-screenshots/dashboard-3d-after.png`.

## frontend score visuals
- Prompt: Show agent scores as animated green, yellow, or red circular progress rings, add Verified or Unknown pills, colored outcome tags, and loading/empty states.
- What Copilot produced: Animated score rings that update on refresh, status pills, open/merged/rejected outcome tags, and explicit loading and empty states.
- What I checked or fixed: Verified ring targets and color classes for all five agents, all eight PR tags, reduced-motion final values, and captured `docs/copilot-screenshots/dashboard-score-rings.png`.

## frontend judge story
- Prompt: Add a compact four-step “How AgentTrust works” section explaining the path from an agent PR to registry checks, labels and scores, and outcome-driven score updates.
- What Copilot produced: A responsive four-step explainer section placed below the hero using the existing panel styling.
- What I checked or fixed: Reloaded the page, confirmed all four steps, metrics, five score rings, five agents, and eight pull requests, and captured `docs/copilot-screenshots/dashboard-how-it-works.png`.

## Shaun: backend

### 1. Licence and project setup
- Prompt: "Create an MIT LICENSE file in the root of this repo for 2026... then add "type": "module" and a "start" script to backend/package.json."
- What Copilot produced: the LICENSE file and the package.json changes, in one run.
- What I checked: that the licence showed up in GitHub's sidebar, and I fixed the "license" field in package.json from ISC to MIT so it matches.

### 2. Express server and registry data
- Prompt: "Look at frontend/mock-data.json. Create backend/data/registry.json with the same agents and pullRequests, and create backend/server.js using Express with /api/agents and /api/prs..."
- What Copilot produced: server.js, registry.json, and it tested all three routes itself (21 steps).
- What I checked: I started the server and opened /api/agents and /api/prs in Chrome to see the real data.

### 3. GitHub App webhook listener
- Prompt: "In backend/server.js, add GitHub App webhook support with the octokit package... POST /webhook with signature verification..."
- What Copilot produced: the webhook route with raw-body parsing and the pull_request.opened and closed handlers.
- What I checked: I opened a test PR on a practice repo and saw "PR opened by shaun2352008" in my terminal. A secret mismatch gave me a signature error at first, which I fixed by making the secret in .env match the App settings.

### 4. PR labeling (opened.js)
- Prompt: "First read registry.js and closed.js... create handlers/opened.js that looks up the PR author, adds the label agenttrust: verified or agenttrust: unknown, and posts a comment with the score..."
- What Copilot produced: opened.js, plus opened.test.js with tests.
- What I checked: my PR got "agenttrust: verified" with a score comment, and my partner's PR got "agenttrust: unknown".

### 5. Wiring handlers into the server
- Prompt: "In backend/server.js, import handlePROpened and handlePRClosed and call them from the webhook events..."
- What Copilot produced: the wiring, with the /api routes now reading from registry.js, and 12 passing tests.
- What I checked: I merged a PR (score 70 to 75) and closed one without merging (score down to 65) and watched the dashboard update.
