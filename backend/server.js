import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import { App } from "octokit";
import { getAgents, getPRs } from "./registry.js";
import { handlePRClosed } from "./handlers/closed.js";
import { handlePROpened } from "./handlers/opened.js";

const app = new App({
  appId: process.env.APP_ID,
  privateKey: fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8"),
  webhooks: { secret: process.env.WEBHOOK_SECRET },
});
const server = express();
const port = process.env.PORT || 3000;

server.use(cors());

app.webhooks.on("pull_request.opened", async ({ payload, octokit }) => {
  console.log(
    `PR opened by ${payload.pull_request.user.login} in ${payload.repository.full_name} #${payload.pull_request.number}`,
  );
  await handlePROpened(payload, octokit);
});

app.webhooks.on("pull_request.closed", async ({ payload, octokit }) => {
  console.log(
    `PR closed by ${payload.pull_request.user.login}, merged: ${payload.pull_request.merged}`,
  );
  await handlePRClosed(payload, octokit);
});

server.get("/", (_request, response) => {
  response.json({ status: "AgentTrust backend is running" });
});

server.get("/api/agents", (_request, response) => {
  response.json(getAgents());
});

server.get("/api/prs", (_request, response) => {
  response.json(getPRs());
});

// Keep raw parsing scoped to the signed GitHub webhook payload.
server.post("/webhook", express.raw({ type: "application/json" }), async (request, response) => {
  try {
    await app.webhooks.verifyAndReceive({
      id: request.headers["x-github-delivery"],
      name: request.headers["x-github-event"],
      signature: request.headers["x-hub-signature-256"],
      payload: request.body.toString(),
    });
    response.sendStatus(200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.status(400).send(message);
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});