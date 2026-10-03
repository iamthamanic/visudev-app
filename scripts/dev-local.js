#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Local-first dev orchestrator: Vite UI + Local Engine + Preview Runner.
 * Demo enrichment is OFF by default (RVP-12). Use --demo or npm run dev:demo.
 * Location: scripts/dev-local.js
 */

const { spawn } = require("child_process");
const net = require("net");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const noRunner = process.argv.includes("--no-runner");
const demoMode = process.argv.includes("--demo");

const env = {
  ...process.env,
  VITE_VISUDEV_MODE: "local",
  VITE_VISUDEV_ENGINE_URL: "http://localhost:4317",
  VISUDEV_ENGINE_PORT: "4317",
  VISUDEV_PREVIEW_RUNNER_URL: "http://localhost:4000",
  // RVP-12: honest local default — never silently enable demo enrichment.
  VISUDEV_DEMO_ENRICHMENT: demoMode ? "true" : process.env.VISUDEV_DEMO_ENRICHMENT || "false",
  VITE_BLUEPRINT_DEMO_ENRICHMENT: demoMode
    ? "true"
    : process.env.VITE_BLUEPRINT_DEMO_ENRICHMENT || "false",
  PORT: "4000",
};

function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function assertPorts() {
  const checks = [
    { port: 3005, label: "Vite UI" },
    { port: 4317, label: "Local Engine" },
  ];
  if (!noRunner) {
    checks.push({ port: 4000, label: "Preview Runner" });
  }
  for (const check of checks) {
    const free = await checkPort(check.port);
    if (!free) {
      console.error(
        `[dev-local] Port ${check.port} (${check.label}) is already in use. Stop the existing process and retry.`,
      );
      process.exit(1);
    }
  }
}

function run(command, args, name) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev-local] ${name} stopped (${signal})`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[dev-local] ${name} exited with code ${code}`);
      shutdown(code ?? 1);
    }
  });
  return child;
}

const children = [];

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  await assertPorts();
  console.log(
    `[dev-local] Starting Local-First stack (demo enrichment ${demoMode ? "ON" : "OFF"}) …`,
  );
  if (!demoMode) {
    console.log(
      "[dev-local] For demo seed data: npm run dev:demo  (or: node scripts/dev-local.js --demo)",
    );
  }
  children.push(run("npm", ["run", "dev:app"], "ui"));
  children.push(run("npm", ["run", "dev:engine"], "engine"));
  if (!noRunner) {
    children.push(run("npm", ["run", "dev:runner"], "runner"));
  }
}

main().catch((error) => {
  console.error("[dev-local] Failed:", error);
  shutdown(1);
});
