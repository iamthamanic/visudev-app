/**
 * Adds route nodes and their edges to the graph state.
 */

import type { RawBlueprintRoute } from "../../types/api.types.js";
import { createId, stableUniqueId } from "./_ids.js";
import { addEdge, addNode, type GraphBuilderState } from "./_state.js";

export function addRouteNodes(
  route: RawBlueprintRoute,
  fileId: string,
  moduleId: string,
  state: GraphBuilderState,
): void {
  const routeNodeId = stableUniqueId(state.registry, "node", `route:${route.id}`);

  addNode(state, {
    id: routeNodeId,
    kind: "route",
    label: `${route.method} ${route.path}`,
    scopeId: fileId,
    filePath: route.filePath,
    line: route.line,
    metadata: {
      routeId: route.id,
      method: route.method,
      path: route.path,
      pipelineCount: route.pipeline?.length ?? 0,
      pipeline: Array.isArray(route.pipeline) ? route.pipeline : [],
    },
  });

  addEdge(state, {
    id: stableUniqueId(state.registry, "edge", createId("edge", fileId, routeNodeId)),
    kind: "contains",
    sourceId: fileId,
    targetId: routeNodeId,
    metadata: {},
  });
  addEdge(state, {
    id: stableUniqueId(
      state.registry,
      "edge",
      createId("edge", moduleId, routeNodeId, "references"),
    ),
    kind: "references",
    sourceId: moduleId,
    targetId: routeNodeId,
    metadata: {},
  });
}
