import cors from "cors";
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { App } from "octokit";

const app = new App({
  appId: process.env.APP_ID,
  privateKey: fs.readFileSync(process.env.PRIVATE_KEY_PATH, "utf8"),
  webhooks: { secret: process.env.WEBHOOK_SECRET },
});
const server = express();
const port = process.env.PORT || 3000;
const registryPath = join(dirname(fileURLToPath(import.meta.url)), "data", "registry.json");

server.use(cors());

// Resolve registry data relative to this module, regardless of the launch directory.
const readRegistry = () => JSON.parse(fs.readFileSync(registryPath, "utf8"));

app.webhooks.on("pull_request.opened", ({ payload }) => {
  console.log(
    `PR opened by ${payload.pull_request.user.login} in ${payload.repository.full_name} #${payload.pull_request.number}`,
  );
});

app.webhooks.on("pull_request.closed", ({ payload }) => {
  console.log(
    `PR closed by ${payload.pull_request.user.login}, merged: ${payload.pull_request.merged}`,
  );
});

server.get("/", (_request, response) => {
  response.json({ status: "AgentTrust backend is running" });
});

server.get("/api/agents", (_request, response) => {
  response.json(readRegistry().agents);
});

server.get("/api/prs", (_request, response) => {
  response.json(readRegistry().pullRequests);
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
