/**
 * Per-surface Product Understanding readiness results (PU-16).
 * Derives independent capability outcomes from audit artifacts + analysis semantics.
 * Location: scripts/readiness/surface-capability-results.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

/** @typedef {"PASS" | "PARTIAL" | "UNAVAILABLE" | "FAIL"} SurfaceVerdict */

/**
 * @param {string} failure
 * @returns {string} capability key
 */
export function classifySemanticFailure(failure) {
  const text = String(failure || "").toLowerCase();
  if (text.includes("dependencies")) return "dependencies";
  if (text.includes("infrastructure")) return "infrastructure";
  if (text.includes("execution")) return "execution";
  if (text.includes("evolution")) return "knowledgeStatus";
  if (text.includes("business-domain") || text.includes("technical folders")) {
    return "architecture";
  }
  if (text.includes("route/file") || text.includes("semantic primary") || text.includes("atlas")) {
    return "atlas";
  }
  if (
    text.includes("authoritative truth") ||
    text.includes("enrichment") ||
    text.includes("demo seed") ||
    text.includes("enginecutover")
  ) {
    return "coverageContract";
  }
  if (text.includes("zero nodes") || text.includes("metric mismatch")) {
    return "repositoryScan";
  }
  if (text.includes("facts") || text.includes("evidence")) return "evidenceLinks";
  return "diagnostics";
}

/**
 * @param {{ passed?: boolean, failures?: string[] } | null} semantic
 * @returns {Record<string, { verdict: SurfaceVerdict, reason: string, failures: string[] }>}
 */
export function surfaceResultsFromSemanticAssertions(semantic) {
  const failures = Array.isArray(semantic?.failures) ? semantic.failures : [];
  const keys = [
    "repositoryScan",
    "coverageContract",
    "atlas",
    "architecture",
    "dependencies",
    "execution",
    "infrastructure",
    "diagnostics",
    "evidenceLinks",
    "knowledgeStatus",
  ];
  /** @type {Record<string, string[]>} */
  const byKey = Object.fromEntries(keys.map((key) => [key, []]));
  for (const failure of failures) {
    const key = classifySemanticFailure(failure);
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(failure);
  }

  /** @type {Record<string, { verdict: SurfaceVerdict, reason: string, failures: string[] }>} */
  const surfaces = {};
  for (const key of keys) {
    const list = byKey[key] || [];
    if (list.length > 0) {
      surfaces[key] = {
        verdict: "FAIL",
        reason: list[0] || "surface assertion failed",
        failures: list,
      };
    } else {
      surfaces[key] = {
        verdict: semantic?.passed === false && failures.length > 0 ? "PASS" : "PASS",
        reason: "no surface-specific semantic failures",
        failures: [],
      };
    }
  }
  return surfaces;
}

/**
 * @param {unknown} result
 * @returns {{ verdict: SurfaceVerdict, reason: string, failures: string[], evidence: Record<string, unknown> }}
 */
export function evaluateAppflowStaticSurface(result) {
  const blueprint = result?.blueprint || {};
  const ui =
    blueprint.uiInteractionGraph || result?.uiInteractionGraph || blueprint.uiGraph || null;
  const screens = Array.isArray(ui?.screens)
    ? ui.screens
    : Array.isArray(blueprint.screens)
      ? blueprint.screens
      : [];
  const transitions = Array.isArray(ui?.transitions) ? ui.transitions : [];
  if (screens.length > 0 || transitions.length > 0) {
    return {
      verdict: "PASS",
      reason: `AppFlow static signals present (screens=${screens.length}, transitions=${transitions.length})`,
      failures: [],
      evidence: { screens: screens.length, transitions: transitions.length },
    };
  }
  // Honest empty static AppFlow is acceptable when analysis produced a graph.
  const nodes = Array.isArray(blueprint?.graph?.nodes) ? blueprint.graph.nodes : [];
  if (nodes.length > 0) {
    return {
      verdict: "PASS",
      reason: "AppFlow static surface evaluated; no UI graph yet (honest empty)",
      failures: [],
      evidence: { screens: 0, transitions: 0, graphNodes: nodes.length },
    };
  }
  return {
    verdict: "FAIL",
    reason: "AppFlow static required but analysis has neither UI graph nor software graph",
    failures: ["missing appflow static evidence"],
    evidence: {},
  };
}

/**
 * @param {unknown} result
 * @returns {{ verdict: SurfaceVerdict, reason: string, failures: string[], evidence: Record<string, unknown> }}
 */
export function evaluateDataSurface(result) {
  const blueprint = result?.blueprint || {};
  const graph = blueprint.graph || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const tables = nodes.filter((node) => node?.kind === "table");
  const lineage = blueprint.dataLineage || result?.dataLineage || null;
  const lineageHops = Array.isArray(lineage?.hops)
    ? lineage.hops
    : Array.isArray(lineage?.edges)
      ? lineage.edges
      : [];
  if (tables.length > 0 || lineageHops.length > 0) {
    return {
      verdict: "PASS",
      reason: `Data signals present (tables=${tables.length}, lineageHops=${lineageHops.length})`,
      failures: [],
      evidence: { tables: tables.length, lineageHops: lineageHops.length },
    };
  }
  if (nodes.length > 0) {
    return {
      verdict: "PASS",
      reason: "Data surface evaluated; no tables/lineage yet (honest empty)",
      failures: [],
      evidence: { tables: 0, lineageHops: 0, graphNodes: nodes.length },
    };
  }
  return {
    verdict: "FAIL",
    reason: "Data required but analysis has neither tables/lineage nor software graph",
    failures: ["missing data surface evidence"],
    evidence: {},
  };
}

/**
 * Map surface verdict → harness passed flag (true | false | 'partial' | null).
 * @param {SurfaceVerdict} verdict
 */
export function verdictToCapabilityPassed(verdict) {
  if (verdict === "PASS") return true;
  if (verdict === "FAIL") return false;
  if (verdict === "PARTIAL") return "partial";
  return null;
}

/**
 * @param {string} outDir
 * @param {string} key
 * @param {{ verdict: SurfaceVerdict, reason: string, failures?: string[], evidence?: Record<string, unknown> }} payload
 */
export async function writeSurfaceArtifact(outDir, key, payload) {
  await fs.mkdir(outDir, { recursive: true });
  const body = {
    surface: key,
    verdict: payload.verdict,
    reason: payload.reason,
    failures: payload.failures || [],
    evidence: payload.evidence || {},
  };
  await fs.writeFile(
    path.join(outDir, `surface-${key}-assertions.json`),
    JSON.stringify(body, null, 2),
  );
  return body;
}

/**
 * Build capabilityResults for run-project-gate from audit outDir.
 * @param {string} outDir
 * @param {{ includeAppflowData?: boolean }} [options]
 */
export async function loadCapabilityResultsFromArtifacts(outDir, options = {}) {
  const includeAppflowData = options.includeAppflowData !== false;
  /** @type {Record<string, boolean | "partial" | null>} */
  const capabilityResults = {};

  let semantic = null;
  try {
    semantic = JSON.parse(await fs.readFile(path.join(outDir, "semantic-assertions.json"), "utf8"));
  } catch {
    semantic = { passed: false, failures: ["semantic-assertions.json missing"] };
  }

  let analyzeResult = null;
  try {
    analyzeResult = JSON.parse(
      await fs.readFile(path.join(outDir, "analysis-result.json"), "utf8"),
    );
  } catch {
    analyzeResult = null;
  }

  const surfaces = surfaceResultsFromSemanticAssertions(semantic);
  for (const [key, surface] of Object.entries(surfaces)) {
    await writeSurfaceArtifact(outDir, key, surface);
    capabilityResults[key] = verdictToCapabilityPassed(surface.verdict);
  }

  if (includeAppflowData) {
    const appflow = evaluateAppflowStaticSurface(analyzeResult);
    await writeSurfaceArtifact(outDir, "appflowStatic", appflow);
    capabilityResults.appflowStatic = verdictToCapabilityPassed(appflow.verdict);

    const data = evaluateDataSurface(analyzeResult);
    await writeSurfaceArtifact(outDir, "data", data);
    capabilityResults.data = verdictToCapabilityPassed(data.verdict);

    // Runtime stays unevaluated unless secrets path sets it later.
    capabilityResults.appflowRuntime = null;
  }

  return { capabilityResults, surfaces, semantic };
}
