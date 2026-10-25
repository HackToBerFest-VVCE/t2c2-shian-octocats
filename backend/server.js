import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const registryPath = join(dirname(fileURLToPath(import.meta.url)), "data", "registry.json");

app.use(cors());

// Resolve registry data relative to this module, regardless of the launch directory.
const readRegistry = () => JSON.parse(readFileSync(registryPath, "utf8"));

app.get("/", (_request, response) => {
  response.json({ status: "AgentTrust backend is running" });
});

app.get("/api/agents", (_request, response) => {
  response.json(readRegistry().agents);
});

app.get("/api/prs", (_request, response) => {
  response.json(readRegistry().pullRequests);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
