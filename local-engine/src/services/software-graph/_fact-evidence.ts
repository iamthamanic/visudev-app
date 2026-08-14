/**
 * Adds fact evidence and inferred nodes/edges to the graph state.
 */

import type { RawBlueprintFact } from "../../types/api.types.js";
import { classifyFactKind } from "./_classification.js";
import { createId, stableUniqueId } from "./_ids.js";
import { infraServiceNodeId, isInfraServiceFact } from "./_infra-services.js";
import { deployServiceNodeId, isDeployServiceFact } from "./_deploy-services.js";
import { isPrismaSchemaModelFact, prismaTableNodeId } from "./_prisma-models.js";
import { sanitizeExcerpt, sanitizeMetadata } from "./_sanitize.js";
import {
  addEdge,
  addEdgePrefer,
  addNode,
  addNodePrefer,
  type GraphBuilderState,
} from "./_state.js";

export function addFactEvidence(
  fact: RawBlueprintFact,
  fileId: string,
  state: GraphBuilderState,
): void {
  const evId = stableUniqueId(state.registry, "evidence", createId("ev", fact.id));
  state.evidence.push({
    id: evId,
    factId: fact.id,
    kind: fact.kind,
    filePath: fact.filePath,
    line: fact.line,
    excerpt: sanitizeExcerpt(fact.snippet),
  });

  const classification = classifyFactKind(fact.kind);
  if (!classification.nodeKind) return;

  const tableLabel =
    typeof fact.metadata?.table === "string" && fact.metadata.table.trim()
      ? fact.metadata.table.trim()
      : null;
  const infraService =
    typeof fact.metadata?.service === "string" && fact.metadata.service.trim()
      ? fact.metadata.service.trim()
      : null;
  const pathLabel =
    typeof fact.metadata?.path === "string" && fact.metadata.path.trim()
      ? String(fact.metadata.method ?? "ALL") + " " + fact.metadata.path.trim()
      : null;
  const inferredLabel = infraService ?? tableLabel ?? pathLabel ?? fact.kind;

  const preferCritical = isInfraServiceFact(fact) || isDeployServiceFact(fact);
  const inferredNodeId = stableUniqueId(
    state.registry,
    "node",
    infraService && isInfraServiceFact(fact)
      ? infraServiceNodeId(infraService)
      : infraService && isDeployServiceFact(fact)
        ? deployServiceNodeId(fact.filePath, infraService)
        : tableLabel && isPrismaSchemaModelFact(fact)
          ? prismaTableNodeId(tableLabel)
          : createId("inferred", fact.kind, fact.id),
  );
  const nodePayload = {
    id: inferredNodeId,
    kind: classification.nodeKind,
    label: inferredLabel,
    scopeId: fileId,
    filePath: fact.filePath,
    line: fact.line,
    metadata: sanitizeMetadata(fact.metadata ?? {}),
  };
  if (preferCritical) addNodePrefer(state, nodePayload);
  else addNode(state, nodePayload);

  const containsEdge = {
    id: stableUniqueId(state.registry, "edge", createId("edge", fileId, inferredNodeId)),
    kind: "contains" as const,
    sourceId: fileId,
    targetId: inferredNodeId,
    metadata: {},
  };
  if (preferCritical) addEdgePrefer(state, containsEdge);
  else addEdge(state, containsEdge);

  if (classification.edgeKind) {
    const typedEdge = {
      id: stableUniqueId(
        state.registry,
        "edge",
        createId("edge", fileId, inferredNodeId, classification.edgeKind),
      ),
      kind: classification.edgeKind,
      sourceId: fileId,
      targetId: inferredNodeId,
      metadata: { evidenceFactId: fact.id },
    };
    if (preferCritical) addEdgePrefer(state, typedEdge);
    else addEdge(state, typedEdge);
  }
}
