/**
 * Golden-set gate: real analyzer on fixture, plus P0-6 missing-auth upper bound.
 * Location: scripts/golden-set/run.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzeLocalBlueprint } from "../../preview-runner/lib/blueprint-local.js";

const METRIC_NAMES = [
  "nodes",
  "edges",
  "routes",
  "tables",
  "files",
  "duplicateNodeIds",
  "missingAuthFindings",
];
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const fixturePath = fileURLToPath(new URL("../../tests/fixtures/golden-repo/", import.meta.url));
const expectedMetricsPath = new URL(
  "../../tests/fixtures/golden-repo/expected-metrics.json",
  import.meta.url,
);

function collectGraphMetrics(result) {
  const graph = result.blueprint.graph;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];

  return {
    nodes: nodes.length,
    edges: Array.isArray(graph?.edges) ? graph.edges.length : 0,
    routes: Array.isArray(result.blueprint.routes) ? result.blueprint.routes.length : 0,
    tables: nodes.filter((node) => node.kind === "table").length,
    files: Number.isInteger(result.blueprint.filesAnalyzed) ? result.blueprint.filesAnalyzed : 0,
    duplicateNodeIds: nodes.filter((node) => node.id.includes("~")).length,
  };
}

function isNonNegInt(value) {
  return Number.isInteger(value) && value >= 0;
}

function parseExpectedMetrics(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("golden-set: expected-metrics.json is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("golden-set: expected-metrics.json must be an object");
  }
  for (const name of METRIC_NAMES) {
    const entry = parsed[name];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`golden-set: expected-metrics missing object for ${name}`);
    }
    if ("min" in entry && !isNonNegInt(entry.min)) {
      throw new Error(`golden-set: expected-metrics ${name}.min must be a non-negative integer`);
    }
    if ("max" in entry && !isNonNegInt(entry.max)) {
      throw new Error(`golden-set: expected-metrics ${name}.max must be a non-negative integer`);
    }
    if (!("min" in entry) && !("max" in entry)) {
      throw new Error(`golden-set: expected-metrics ${name} needs min and/or max`);
    }
  }
  return parsed;
}

function assertSecurityMatrix(value) {
  if (!Array.isArray(value)) {
    throw new Error("golden-set: enrichBlueprint must return securityMatrix array");
  }
  for (const [index, row] of value.entries()) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`golden-set: securityMatrix[${index}] must be an object`);
    }
    if (typeof row.method !== "string" || typeof row.routeId !== "string") {
      throw new Error(`golden-set: securityMatrix[${index}] needs string method/routeId`);
    }
    const authState = row.auth?.state;
    if (typeof authState !== "string" || authState.length === 0) {
      throw new Error(`golden-set: securityMatrix[${index}].auth.state must be a non-empty string`);
    }
  }
  return value;
}

async function countMissingAuthFindings(result) {
  // Shared inference (enrichment) — same path Local Engine uses with Enrichment OFF.
  const enrichmentUrl = pathToFileURL(
    fileURLToPath(
      new URL("../../local-engine/src/services/blueprint-enrichment.service.ts", import.meta.url),
    ),
  ).href;
  const enrichmentModule = await import(enrichmentUrl);
  if (typeof enrichmentModule.enrichBlueprint !== "function") {
    throw new Error("golden-set: enrichBlueprint export missing");
  }
  const bp = result.blueprint;
  if (!bp || typeof bp !== "object") {
    throw new Error("golden-set: analyzer result missing blueprint object");
  }
  const scan = {
    providerId: "legacy-blueprint-runner",
    projectId: "golden-set",
    localPath: fixturePath,
    analyzedAt: typeof bp.analyzedAt === "string" ? bp.analyzedAt : new Date().toISOString(),
    routes: (Array.isArray(bp.routes) ? bp.routes : []).map((route, index) => ({
      id: typeof route.id === "string" ? route.id : `r-${index}`,
      method: typeof route.method === "string" ? route.method : "GET",
      path: typeof route.path === "string" ? route.path : "/",
      filePath: typeof route.filePath === "string" ? route.filePath : "",
      line: typeof route.line === "number" ? route.line : 1,
      pipeline: Array.isArray(route.pipeline) ? route.pipeline : [],
      concepts: route.concepts && typeof route.concepts === "object" ? route.concepts : {},
    })),
    facts: Array.isArray(bp.facts) ? bp.facts : [],
    filesAnalyzed: Number.isInteger(bp.filesAnalyzed) ? bp.filesAnalyzed : 0,
  };
  const enriched = enrichmentModule.enrichBlueprint(scan);
  if (!enriched || typeof enriched !== "object" || Array.isArray(enriched)) {
    throw new Error("golden-set: enrichBlueprint must return an object");
  }
  const securityMatrix = assertSecurityMatrix(enriched.securityMatrix);
  // Upper bound: unguarded mutating routes from primary (non-inferred) scopes only.
  // Fixture orders.route.ts has one POST without requireAuth → measured 1.
  return securityMatrix.filter((row) => {
    const routeId = String(row.routeId ?? "");
    if (routeId.startsWith("inferred:")) return false;
    if (!MUTATING_METHODS.has(String(row.method ?? "").toUpperCase())) return false;
    return row.auth?.state === "missing";
  }).length;
}

function formatMetrics(metrics) {
  return METRIC_NAMES.map((name) => `${name}=${metrics[name]}`).join(" ");
}

const reportOnly = process.argv.slice(2).includes("--report");
const result = await analyzeLocalBlueprint({
  localPath: fixturePath,
  projectId: "golden-set",
});
const measured = {
  ...collectGraphMetrics(result),
  missingAuthFindings: await countMissingAuthFindings(result),
};

if (reportOnly) {
  console.log(`golden-set: report (${formatMetrics(measured)})`);
  process.exit(0);
}

const expected = parseExpectedMetrics(await readFile(expectedMetricsPath, "utf8"));
const failures = METRIC_NAMES.flatMap((name) => {
  const minimum = expected[name]?.min;
  const maximum = expected[name]?.max;
  return [
    ...(Number.isInteger(minimum) && measured[name] < minimum
      ? [`golden-set: ${name} ${measured[name]} < min ${minimum}`]
      : []),
    ...(Number.isInteger(maximum) && measured[name] > maximum
      ? [`golden-set: ${name} ${measured[name]} > max ${maximum}`]
      : []),
  ];
});

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`golden-set: OK (${formatMetrics(measured)})`);
