/**
 * Pure semantic assertions for RVP-12 real-repo / golden audit (enrichment OFF).
 * Location: scripts/real-visual-audit-semantics.mjs
 */

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

/** Soft upper bound for default Dependencies complexity (primary nodes). */
export const DEPENDENCIES_COMPLEXITY_MAX = 120;

/**
 * @param {unknown} result Analyze result payload (engine /result)
 * @param {{ enrichmentOff?: boolean }} [options]
 * @returns {{ passed: boolean, failures: string[], summary: Record<string, unknown> }}
 */
export function assertAnalysisSemantics(result, options = {}) {
  const failures = [];
  const blueprint = result?.blueprint || {};
  const graph = blueprint?.graph || {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const semantic = blueprint?.semanticSystemModel || result?.semanticSystemModel || null;
  const enrichmentOff = options.enrichmentOff !== false;

  if (enrichmentOff) {
    if (process.env.VISUDEV_DEMO_ENRICHMENT === "true") {
      failures.push("VISUDEV_DEMO_ENRICHMENT must be false/off for real-repo gate.");
    }
    if (process.env.VITE_BLUEPRINT_DEMO_ENRICHMENT === "true") {
      failures.push("VITE_BLUEPRINT_DEMO_ENRICHMENT must be false/off for real-repo gate.");
    }
  }

  if (nodes.length === 0) {
    failures.push("SoftwareGraph has zero nodes after analysis.");
  }

  // Architecture / domains: business-domain entities must not be only folder names
  const domainEntities = Array.isArray(semantic?.entities)
    ? semantic.entities.filter((entity) => entity?.kind === "business-domain")
    : [];
  const structuralDomains = domainEntities.filter((entity) =>
    STRUCTURAL_DOMAIN_LABELS.has(
      String(entity.label || "")
        .trim()
        .toLowerCase(),
    ),
  );
  if (domainEntities.length > 0 && structuralDomains.length === domainEntities.length) {
    failures.push(
      `All business-domain labels are technical folders: ${structuralDomains
        .map((entity) => entity.label)
        .slice(0, 8)
        .join(", ")}`,
    );
  }

  // Atlas-style: raw route/file must not dominate application/service nodes
  const routeOrFile = nodes.filter((node) => node?.kind === "route" || node?.kind === "file");
  const semanticPrimary = nodes.filter((node) =>
    ["application", "service", "domain", "module", "table", "external"].includes(node?.kind),
  );
  if (routeOrFile.length > 0 && semanticPrimary.length === 0) {
    failures.push("Graph has only route/file nodes — no semantic primary entities.");
  }

  // Dependencies complexity bound (non-file nodes as proxy for default view)
  const dependencyCandidates = nodes.filter((node) => node?.kind !== "file");
  if (dependencyCandidates.length > DEPENDENCIES_COMPLEXITY_MAX) {
    failures.push(
      `Dependencies complexity ${dependencyCandidates.length} exceeds max ${DEPENDENCIES_COMPLEXITY_MAX}.`,
    );
  }

  // Infrastructure honesty: running-service candidates should not be file/route
  const infraSuspects = nodes.filter(
    (node) =>
      (node?.kind === "file" || node?.kind === "route") &&
      typeof node?.metadata?.role === "string" &&
      /service|runtime|deploy/i.test(node.metadata.role),
  );
  if (infraSuspects.length > 0) {
    failures.push(
      `Infrastructure marks file/route as running service: ${infraSuspects
        .slice(0, 5)
        .map((node) => node.id)
        .join(", ")}`,
    );
  }

  // Execution: pipeline/route evidence when pipelines exist
  const routes = Array.isArray(blueprint.routes) ? blueprint.routes : [];
  const routesWithPipeline = routes.filter(
    (route) => Array.isArray(route.pipeline) && route.pipeline.length > 0,
  );
  if (routesWithPipeline.length > 0) {
    const withoutEvidence = routesWithPipeline.filter((route) => {
      const hasFactEvidence =
        Array.isArray(blueprint.facts) &&
        blueprint.facts.some(
          (fact) =>
            fact?.filePath === route.filePath ||
            (typeof fact?.metadata?.routeId === "string" && fact.metadata.routeId === route.id),
        );
      return !hasFactEvidence && !route.filePath;
    });
    if (withoutEvidence.length === routesWithPipeline.length) {
      failures.push("Execution pipelines present but none carry file/fact evidence.");
    }
  }

  // Cross-view metric consistency: graph node count vs summary
  const summaryNodes = result?.summary?.graph?.nodes;
  if (typeof summaryNodes === "number" && summaryNodes !== nodes.length) {
    failures.push(
      `Cross-view metric mismatch: summary.graph.nodes=${summaryNodes} vs graph.nodes=${nodes.length}`,
    );
  }

  // Evolution: when ≥2 snapshots, require a non-empty identity set
  const snapshots = Array.isArray(graph.snapshots) ? graph.snapshots : [];
  if (snapshots.length >= 2) {
    const [base, target] = [snapshots[0], snapshots[snapshots.length - 1]];
    const baseIds = new Set(base?.nodeIds || []);
    const targetIds = new Set(target?.nodeIds || []);
    let changed = baseIds.size !== targetIds.size;
    if (!changed) {
      for (const id of targetIds) {
        if (!baseIds.has(id)) {
          changed = true;
          break;
        }
        const bSig = base?.nodeSignatures?.[id];
        const tSig = target?.nodeSignatures?.[id];
        if (bSig && tSig && bSig !== tSig) {
          changed = true;
          break;
        }
      }
    }
    // Identical history is OK; only fail if signatures missing entirely
    if (
      Object.keys(base?.nodeSignatures || {}).length === 0 &&
      Object.keys(target?.nodeSignatures || {}).length === 0
    ) {
      failures.push("Evolution snapshots lack nodeSignatures for semantic compare.");
    }
  }

  // Engine cutover / enrichment honesty
  const cutover = blueprint.engineCutover;
  if (cutover && cutover.host === "cloud") {
    if (!Array.isArray(cutover.capabilitiesAbsent) || cutover.capabilitiesAbsent.length === 0) {
      failures.push("Cloud engineCutover must list capabilitiesAbsent explicitly.");
    }
  }

  // Demo seed markers should not appear when enrichment OFF
  if (enrichmentOff) {
    const demoLabels = nodes.filter((node) =>
      /hr[- ]?demo|demo[- ]seed|fixture[- ]demo/i.test(String(node?.label || "")),
    );
    if (demoLabels.length > 0) {
      failures.push(
        `Demo seed labels present with enrichment OFF: ${demoLabels
          .slice(0, 5)
          .map((node) => node.label)
          .join(", ")}`,
      );
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    summary: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      domainEntityCount: domainEntities.length,
      routeOrFileCount: routeOrFile.length,
      semanticPrimaryCount: semanticPrimary.length,
      dependencyCandidateCount: dependencyCandidates.length,
      snapshotCount: snapshots.length,
      routeCount: routes.length,
      hasEngineCutover: Boolean(cutover),
    },
  };
}

export function isStructuralDomainLabel(label) {
  return STRUCTURAL_DOMAIN_LABELS.has(
    String(label || "")
      .trim()
      .toLowerCase(),
  );
}

export function isRouteLabel(label) {
  return ROUTE_LABEL.test(String(label || ""));
}

export { STRUCTURAL_DOMAIN_LABELS, ROUTE_LABEL };
