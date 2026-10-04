/**
 * RVP-9 infrastructure entity classification — deployment/runtime/data/external only.
 * Location: src/modules/blueprint/components/infrastructure/infrastructure-entities.ts
 */

import type { SemanticSystemModel } from "../../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphNode } from "../../types";
import type { StatusBadgeVariant } from "../ui/StatusBadge.js";

const PHYSICAL_SOURCES = new Set(["docker-compose", "kubernetes", "dockerfile"]);
/** Softort / code-derived runtime labels that must not become infra services. */
const CODE_RUNTIME_LABELS = new Set(["browser", "server", "edge", "shared", "node", "deno", "bun"]);

export type InfrastructureRuntimeStatus = {
  variant: StatusBadgeVariant;
  label: string;
};

export function isPhysicalDeploymentNode(node: SoftwareGraphNode): boolean {
  if (node.kind !== "service" && node.kind !== "runtime") return false;
  const source = node.metadata?.source;
  return typeof source === "string" && PHYSICAL_SOURCES.has(source);
}

function hasFileEvidence(node: SoftwareGraphNode): boolean {
  return typeof node.filePath === "string" && node.filePath.trim().length > 0;
}

function hasRuntimeEvidence(node: SoftwareGraphNode): boolean {
  if (node.metadata?.runtimeObserved === true) return true;
  if (node.metadata?.runtimeStatus === "running") return true;
  if (node.metadata?.live === true) return true;
  return false;
}

/**
 * True when a SoftwareGraph node is a legitimate infrastructure entity.
 * Files and Routes are never infrastructure services.
 */
export function isInfrastructureEntity(node: SoftwareGraphNode): boolean {
  if (node.kind === "file" || node.kind === "route" || node.kind === "symbol") {
    return false;
  }
  if (node.kind === "module" || node.kind === "domain" || node.kind === "layer") {
    return false;
  }

  if (isPhysicalDeploymentNode(node)) return true;

  if (node.kind === "table" || node.kind === "repository") {
    return hasFileEvidence(node) || Boolean(node.metadata?.source) || hasRuntimeEvidence(node);
  }

  if (node.kind === "external") {
    return true;
  }

  if (node.kind === "runtime") {
    const label = node.label.trim().toLowerCase();
    if (label === "internet") return true;
    if (label.includes("load balancer") || label.includes("gateway")) return true;
    // Reject code-host softort runtimes synthesized from file metadata.
    if (CODE_RUNTIME_LABELS.has(label)) return false;
    return hasRuntimeEvidence(node) || isPhysicalDeploymentNode(node);
  }

  if (node.kind === "service") {
    // Code-level services (no compose/k8s/deployment metadata) stay out of Infrastructure.
    if (isPhysicalDeploymentNode(node)) return true;
    if (typeof node.metadata?.deploymentUnitId === "string") return true;
    if (node.metadata?.infrastructure === true) return true;
    return false;
  }

  return false;
}

/**
 * RUNNING only with real runtime evidence; otherwise neutral unknown / detected.
 */
export function resolveInfrastructureRuntimeStatus(
  node: SoftwareGraphNode | null | undefined,
): InfrastructureRuntimeStatus {
  if (!node) {
    return { variant: "unknown", label: "UNKNOWN" };
  }
  if (hasRuntimeEvidence(node)) {
    return { variant: "running", label: "RUNNING" };
  }
  if (isPhysicalDeploymentNode(node)) {
    return { variant: "confirmed", label: "DECLARED" };
  }
  if (node.kind === "external" || node.kind === "table" || node.kind === "repository") {
    // DETECTED only with file path, Tier-1 source, or runtime observation — never by kind alone.
    if (hasFileEvidence(node) || Boolean(node.metadata?.source) || hasRuntimeEvidence(node)) {
      return { variant: "confirmed", label: "DETECTED" };
    }
    return { variant: "unknown", label: "UNKNOWN" };
  }
  return { variant: "unknown", label: "UNKNOWN" };
}
/**
 * Graph node ids that SemanticSystemModel marks as deployment/data/external.
 */
export function semanticInfrastructureNodeIds(
  semantic: SemanticSystemModel | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!semantic) return ids;
  const allowedKinds = new Set(["deployment-unit", "data-store", "external-system", "service"]);
  const entityIds = new Set(
    semantic.entities.filter((entity) => allowedKinds.has(entity.kind)).map((entity) => entity.id),
  );
  for (const membership of semantic.memberships) {
    if (!entityIds.has(membership.semanticEntityId)) continue;
    // Only keep memberships that carry evidence backlinks.
    if (!Array.isArray(membership.evidence) || membership.evidence.length === 0) continue;
    ids.add(membership.graphNodeId);
  }
  return ids;
}

/**
 * Filter SoftwareGraph nodes to infrastructure entities, optionally unioned
 * with evidenced SemanticSystemModel memberships (still excluding file/route).
 */
export function selectInfrastructureNodes(
  graph: SoftwareGraph,
  semantic?: SemanticSystemModel | null,
): SoftwareGraphNode[] {
  const semanticIds = semanticInfrastructureNodeIds(semantic);
  return (Array.isArray(graph.nodes) ? graph.nodes : []).filter((node) => {
    if (node.kind === "file" || node.kind === "route" || node.kind === "symbol") return false;
    if (isInfrastructureEntity(node)) return true;
    // Semantic membership can promote a service that maps to a deployment-unit,
    // but never promotes files/routes.
    if (semanticIds.has(node.id) && (node.kind === "service" || node.kind === "runtime")) {
      return true;
    }
    return false;
  });
}
