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
  { id: "atlas", label: "Atlas" },
  { id: "architecture", label: "Architektur" },
  { id: "dependencies", label: "Abhängigkeiten" },
  { id: "execution", label: "Ausführung" },
  { id: "infrastructure", label: "Infrastruktur" },
  { id: "diagnostics", label: "Diagnosen" },
  { id: "evolution", label: "Evolution" },
];

const ROUTE_LABEL = /^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+\//i;
const STRUCTURAL_DOMAIN_LABELS = new Set([
  "components",
  "hooks",
  "screens",
  "scripts",
  "services",
  "stores",
  "utils",
  "types",
  "imports",
  "layouts",
  "config",
  "unassigned",
  "unknown",
]);

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
    throw new Error(
      `${init.method || "GET"} ${url} returned non-JSON (${response.status}): ${text.slice(0, 500)}`,
    );
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
  throw new Error(
    `Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

function summarizeGraph(result) {
  const blueprint = result?.blueprint || {};
  const graph = blueprint?.graph || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const byKind = {};
  for (const node of nodes) {
    const kind = node?.kind || "unknown";
    byKind[kind] = (byKind[kind] || 0) + 1;
  }
  const edgesByKind = {};
  for (const edge of edges) {
    const kind = edge?.kind || "unknown";
    edgesByKind[kind] = (edgesByKind[kind] || 0) + 1;
  }
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

async function assertAtlasSemanticOverview(page) {
  const controls = page.locator('aside[aria-label="Atlas-Steuerung"]');
  await controls.waitFor({ state: "visible", timeout: 30000 });

  const nodeCards = controls.locator('section[aria-label="Sichtbare Knoten"] button[data-kind]');
  const nodeCount = await nodeCards.count();
  const nodes = [];
  for (let index = 0; index < nodeCount; index += 1) {
    const card = nodeCards.nth(index);
    const kind = (await card.getAttribute("data-kind")) || "unknown";
    const text = (await card.innerText()).trim();
    const label = text.split("\n")[0]?.trim() || text;
    nodes.push({ kind, label });
  }

  const clusterLocator = page.getByTestId("atlas-cluster");
  const clusterCount = await clusterLocator.count();
  const clusterLabels = [];
  for (let index = 0; index < clusterCount; index += 1) {
    const text = (await clusterLocator.nth(index).innerText()).trim();
    clusterLabels.push(text.split("\n")[0]?.trim() || text);
  }

  const failures = [];
  if (nodeCount === 0) failures.push("Atlas has no visible semantic node cards.");
  if (nodeCount > 40) failures.push(`Atlas shows ${nodeCount} primary objects; expected at most 40.`);
  if (clusterCount === 0) failures.push("Atlas has no semantic clusters.");

  const rawKinds = nodes.filter((node) => node.kind === "route" || node.kind === "file");
  if (rawKinds.length > 0) {
    failures.push(`Raw route/file nodes promoted to primary Atlas: ${JSON.stringify(rawKinds.slice(0, 10))}`);
  }

  const routeNodes = nodes.filter((node) => ROUTE_LABEL.test(node.label));
  if (routeNodes.length > 0) {
    failures.push(`HTTP routes promoted to primary Atlas labels: ${JSON.stringify(routeNodes.slice(0, 10))}`);
  }

  const routeClusters = clusterLabels.filter((label) => ROUTE_LABEL.test(label));
  if (routeClusters.length > 0) {
    failures.push(`HTTP routes promoted to Atlas clusters: ${JSON.stringify(routeClusters.slice(0, 10))}`);
  }

  const structuralClusters = clusterLabels.filter((label) =>
    STRUCTURAL_DOMAIN_LABELS.has(label.trim().toLowerCase()),
  );
  if (structuralClusters.length > 0) {
    failures.push(
      `Technical folder names promoted to business clusters: ${JSON.stringify(structuralClusters.slice(0, 10))}`,
    );
  }

  let drilldown = { selectedCluster: null, detailText: "", hasRawMembers: false };
  if (clusterCount > 0) {
    const firstCluster = clusterLocator.first();
    const selectedCluster = clusterLabels[0] || "unknown";
    await firstCluster.click();
    await page.getByTestId("atlas-inspector").waitFor({ state: "visible", timeout: 15000 });
    const detailsTab = page.getByRole("tab", { name: "Details" });
    await detailsTab.click();
    const inspector = page.getByTestId("atlas-inspector");
    const detailText = (await inspector.innerText()).trim();
    const hasRawMembers = !detailText.includes("Keine Knoten in diesem Cluster.");
    drilldown = { selectedCluster, detailText: detailText.slice(0, 4000), hasRawMembers };
    if (!hasRawMembers) failures.push("Selected semantic cluster has no raw graph members in Details drill-down.");
  }

  const result = {
    passed: failures.length === 0,
    nodeCount,
    clusterCount,
    nodes,
    clusterLabels,
    drilldown,
    failures,
  };
  await fs.writeFile(
    path.join(outDir, "atlas-semantic-assertions.json"),
    JSON.stringify(result, null, 2),
  );

  if (failures.length > 0) {
    throw new Error(`Atlas semantic real-project gate failed:\n- ${failures.join("\n- ")}`);
  }
}

async function captureView(page, view, index) {
  const prefix = `${String(index + 1).padStart(2, "0")}-${view.id}`;
  const expectedPath = `/blueprint/${view.id}`;

  if (index > 0) {
    const navButton = page.locator(`button[data-nav-path="${expectedPath}"]`);
    await navButton.waitFor({ state: "visible", timeout: 30000 });
    await navButton.click();
    await page.waitForFunction((pathName) => window.location.pathname === pathName, expectedPath, {
      timeout: 30000,
    });
    await page.waitForTimeout(view.id === "atlas" ? 5000 : 2000);
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  await fs.writeFile(path.join(outDir, `${prefix}.txt`), bodyText);
  await fs.writeFile(path.join(outDir, `${prefix}.html`), await page.content());
  await page.screenshot({ path: path.join(outDir, `${prefix}.png`), fullPage: false });
  await page.screenshot({ path: path.join(outDir, `${prefix}-full.png`), fullPage: true });
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  await waitForHttp(`${engineBase}/health`);
  await waitForHttp(appBase);

  const existing = await jsonRequest(`${engineBase}/api/projects`);
  for (const project of Array.isArray(existing) ? existing : []) {
    await jsonRequest(`${engineBase}/api/projects/${encodeURIComponent(project.id)}`, {
      method: "DELETE",
    });
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

  const started = await jsonRequest(
    `${engineBase}/api/projects/${encodeURIComponent(project.id)}/analyze`,
    {
      method: "POST",
      body: JSON.stringify({ scanType: "blueprint", localPath: targetPath }),
    },
  );
  await fs.writeFile(path.join(outDir, "analysis-start.json"), JSON.stringify(started, null, 2));

  const deadline = Date.now() + timeoutMs;
  let terminalStatus = null;
  while (Date.now() < deadline) {
    terminalStatus = await jsonRequest(
      `${engineBase}/api/projects/${encodeURIComponent(project.id)}/analyze/${encodeURIComponent(started.runId)}`,
    );
    await fs.writeFile(
      path.join(outDir, "analysis-status.json"),
      JSON.stringify(terminalStatus, null, 2),
    );
    if (["success", "partial", "failed"].includes(terminalStatus.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  if (!terminalStatus || !["success", "partial", "failed"].includes(terminalStatus.status)) {
    throw new Error(`Blueprint analysis did not finish within ${timeoutMs}ms.`);
  }
  if (terminalStatus.status === "failed") {
    throw new Error(
      `Blueprint analysis failed: ${terminalStatus.error?.message || JSON.stringify(terminalStatus.error)}`,
    );
  }

  const result = await jsonRequest(
    `${engineBase}/api/projects/${encodeURIComponent(project.id)}/analyze/${encodeURIComponent(started.runId)}/result`,
  );
  await fs.writeFile(path.join(outDir, "analysis-result.json"), JSON.stringify(result, null, 2));
  await fs.writeFile(
    path.join(outDir, "analysis-summary.json"),
    JSON.stringify(summarizeGraph(result), null, 2),
  );

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

  await page.goto(`${appBase}/blueprint/atlas`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page
    .waitForFunction(
      () => {
        const text = document.body?.innerText || "";
        return !text.includes("Blueprint wird analysiert...") && !text.includes("ANALYSIERE…");
      },
      undefined,
      { timeout: 180000 },
    )
    .catch(() => {});
  await page.waitForTimeout(3000);

  await assertAtlasSemanticOverview(page);

  for (let index = 0; index < views.length; index += 1) {
    await captureView(page, views[index], index);
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
    // Ignore secondary failures while preserving the original gate failure.
  }
  process.exit(1);
});
