/**
 * Deploy-service helpers (compose + Kubernetes descriptors) for graph promotion.
 * Location: local-engine/src/services/software-graph/_deploy-services.ts
 */

import type { RawBlueprintFact } from "../../types/api.types.js";
import { createId, stableUniqueId } from "./_ids.js";
import { addEdgePrefer, type GraphBuilderState } from "./_state.js";

export function isDeployServiceFact(fact: RawBlueprintFact): boolean {
  return (
    fact.kind === "deploy-service" &&
    typeof fact.metadata?.service === "string" &&
    fact.metadata.service.trim().length > 0
  );
}

function slugToken(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "service"
  );
}

export function deployServiceNodeId(filePath: string, service: string): string {
  const fileSlug = slugToken(filePath.replace(/\\/g, "/"));
  return `deploy:${fileSlug}:${slugToken(service)}`;
}

export function partitionDeployServiceFacts(facts: RawBlueprintFact[]): {
  deployServices: RawBlueprintFact[];
  other: RawBlueprintFact[];
} {
  const deployServices: RawBlueprintFact[] = [];
  const other: RawBlueprintFact[] = [];
  for (const fact of facts) {
    if (isDeployServiceFact(fact)) deployServices.push(fact);
    else other.push(fact);
  }
  return { deployServices, other };
}

function readServiceName(metadata: Record<string, unknown>): string | null {
  const service = metadata.service;
  if (typeof service !== "string" || !service.trim()) return null;
  return service.trim();
}

function splitCsv(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** Link compose depends_on names to deploy-service nodes in the same file. */
export function linkDeployServiceDependencies(state: GraphBuilderState): void {
  const deployNodes = [...state.nodes.values()].filter((node) => {
    const source = node.metadata.source;
    return (
      node.kind === "service" &&
      (source === "docker-compose" || source === "kubernetes") &&
      typeof node.filePath === "string"
    );
  });
  const byFileAndService = new Map<string, string>();
  for (const node of deployNodes) {
    const service = readServiceName(node.metadata);
    if (!service || !node.filePath) continue;
    byFileAndService.set(`${node.filePath}::${service}`, node.id);
  }

  for (const node of deployNodes) {
    if (!node.filePath) continue;
    for (const dependency of splitCsv(node.metadata.dependsOn)) {
      const targetId = byFileAndService.get(`${node.filePath}::${dependency}`);
      if (!targetId || targetId === node.id) continue;
      addEdgePrefer(state, {
        id: stableUniqueId(
          state.registry,
          "edge",
          createId("edge", node.id, targetId, "depends-on"),
        ),
        kind: "external-dependency",
        sourceId: node.id,
        targetId,
        metadata: { relation: "depends-on" },
      });
    }
  }
}
