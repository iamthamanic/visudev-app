import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const engineBase = process.env.VISUDEV_AUDIT_ENGINE_URL || "http://127.0.0.1:4317";
const appBase = process.env.VISUDEV_AUDIT_APP_URL || "http://127.0.0.1:3005";
const targetPath = path.resolve(process.env.VISUDEV_AUDIT_TARGET || "target-repo");
const targetName = process.env.VISUDEV_AUDIT_PROJECT_NAME || path.basename(targetPath);
const outDir = path.resolve(process.env.VISUDEV_AUDIT_OUT || "audit-output");
const timeoutMs = Number(process.env.VISUDEV_AUDIT_TIMEOUT_MS || 600000);

const views = [
  "atlas",
  "architecture",
  "dependencies",
  "execution",
  "infrastructure",
  "diagnostics",
  "evolution",
];

async function jsonRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${init.method || "GET"} ${url} returned non-JSON (${response.status}): ${text.slice(0, 500)}`);
  }
  if (!response.ok || (payload && payload.ok === false)) {
    const message = payload?.error?.message || payload?.error || text || `HTTP ${response.status}`;
    throw new Error(`${init.method || "GET"} ${url} failed: ${message}`);
  }
  return payload?.data ?? payload;
}

async function waitForHttp(url, deadlineMs = 120000) {
  const deadline = Date.now() + deadlineMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function summarizeGraph(result) {
  const blueprint = result?.blueprint || {};
  const graph = blueprint?.graph || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const byKind = {};
  for (const node of nodes) byKind[node?.kind || "unknown"] = (byKind[node?.kind || "unknown"] || 0) + 1;
  const edgesByKind = {};
  for (const edge of edges) edgesByKind[edge?.kind || "unknown"] = (edgesByKind[edge?.kind || "unknown"] || 0) + 1;
  return {
    status: result?.status,
    summary: result?.summary,
    graph: {
      nodes: nodes.length,
      edges: edges.length,
      condensed: Boolean(graph.condensed),
      nodeKinds: byKind,
      edgeKinds: edgesByKind,
      scopes: Array.isArray(graph.scopes) ? graph.scopes.length : 0,
      metrics: Array.isArray(graph.metrics) ? graph.metrics.length : 0,
      snapshots: Array.isArray(graph.snapshots) ? graph.snapshots.length : 0,
    },
    filesAnalyzed: result?.summary?.filesAnalyzed ?? blueprint?.filesAnalyzed ?? null,
    totalFiles: blueprint?.totalFiles ?? null,
    factSelection: blueprint?.factSelection ?? null,
    astParseReport: blueprint?.astParseReport ?? null,
  };
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await waitForHttp(`${engineBase}/health`);
  await waitForHttp(appBase);

  const existing = await jsonRequest(`${engineBase}/api/projects`);
  for (const project of Array.isArray(existing) ? existing : []) {
    await jsonRequest(`${engineBase}/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
  }

  const project = await jsonRequest(`${engineBase}/api/projects`, {
    method: "POST",
    body: JSON.stringify({
      name: targetName,
      localPath: targetPath,
      repositoryUrl: process.env.VISUDEV_AUDIT_REPOSITORY_URL || undefined,
      blueprintProviderId: "legacy-blueprint-runner",
    }),
  });

  await fs.writeFile(path.join(outDir, "project.json"), JSON.stringify(project, null, 2));

  const started = await jsonRequest(`${engineBase}/api/projects/${encodeURIComponent(project.id)}/analyze`, {
    method: "POST",
    body: JSON.stringify({ scanType: "blueprint", localPath: targetPath }),
  });
  await fs.writeFile(path.join(outDir, "analysis-start.json"), JSON.stringify(started, null, 2));

  const deadline = Date.now() + timeoutMs;
  let terminalStatus = null;
  while (Date.now() < deadline) {
    terminalStatus = await jsonRequest(
      `${engineBase}/api/projects/${encodeURIComponent(project.id)}/analyze/${encodeURIComponent(started.runId)}`,
    );
    await fs.writeFile(path.join(outDir, "analysis-status.json"), JSON.stringify(terminalStatus, null, 2));
    if (["success", "partial", "failed"].includes(terminalStatus.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!terminalStatus || !["success", "partial", "failed"].includes(terminalStatus.status)) {
    throw new Error(`Blueprint analysis did not finish within ${timeoutMs}ms.`);
  }
  if (terminalStatus.status === "failed") {
    throw new Error(`Blueprint analysis failed: ${terminalStatus.error?.message || JSON.stringify(terminalStatus.error)}`);
  }

  const result = await jsonRequest(
    `${engineBase}/api/projects/${encodeURIComponent(project.id)}/analyze/${encodeURIComponent(started.runId)}/result`,
  );
  await fs.writeFile(path.join(outDir, "analysis-result.json"), JSON.stringify(result, null, 2));
  await fs.writeFile(path.join(outDir, "analysis-summary.json"), JSON.stringify(summarizeGraph(result), null, 2));

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-webgl"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
  });
  const page = await context.newPage();
  const consoleLines = [];
  page.on("console", (message) => consoleLines.push(`[${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => consoleLines.push(`[pageerror] ${error.message}`));

  for (let index = 0; index < views.length; index += 1) {
    const view = views[index];
    const prefix = `${String(index + 1).padStart(2, "0")}-${view}`;
    const url = `${appBase}/blueprint/${view}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(view === "atlas" ? 7000 : 3500);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    await fs.writeFile(path.join(outDir, `${prefix}.txt`), bodyText);
    await fs.writeFile(path.join(outDir, `${prefix}.html`), await page.content());
    await page.screenshot({ path: path.join(outDir, `${prefix}.png`), fullPage: false });
    await page.screenshot({ path: path.join(outDir, `${prefix}-full.png`), fullPage: true });
  }

  await fs.writeFile(path.join(outDir, "browser-console.log"), consoleLines.join("\n"));
  await browser.close();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(
      path.join(outDir, "audit-error.txt"),
      error instanceof Error ? `${error.stack || error.message}\n` : `${String(error)}\n`,
    );
  } catch {
    // ignore secondary failures
  }
  process.exit(1);
});
