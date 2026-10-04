import { useEffect, useMemo, useState } from "react";
import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { BlueprintData, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { useAtlasDefaultClusterSelection } from "../../hooks/useAtlasDefaultClusterSelection.js";
import { findGraphNode } from "./atlas-display.js";
import type { AtlasProjection } from "./_projection.js";

export interface AtlasSelectionState {
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  selectedSemanticEntity: SemanticEntity | null;
  selectedNode: SoftwareGraphNode | null;
  selectedCluster: SoftwareGraphGroup | null;
  handleSelectNode: (nodeId: string) => void;
  handleSelectGroup: (groupId: string) => void;
}

function useSelectionValidity(
  projection: AtlasProjection,
  selectedNodeId: string | null,
  selectedGroupId: string | null,
  setSelectedNodeId: (value: string | null) => void,
  setSelectedGroupId: (value: string | null) => void,
): void {
  useEffect(() => {
    const visibleIds = new Set(projection.nodes.map((node) => node.id));
    if (selectedNodeId && !visibleIds.has(selectedNodeId)) setSelectedNodeId(null);
    if (selectedGroupId && !projection.groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [projection, selectedGroupId, selectedNodeId, setSelectedGroupId, setSelectedNodeId]);
}

function useResolvedSelection(
  graph: BlueprintData["graph"],
  projection: AtlasProjection,
  selectedNodeId: string | null,
  selectedGroupId: string | null,
): Pick<AtlasSelectionState, "selectedSemanticEntity" | "selectedNode" | "selectedCluster"> {
  const selectedSemanticEntity = useMemo(() => {
    if (selectedNodeId) {
      return projection.semanticEntities.find((item) => item.id === selectedNodeId) ?? null;
    }
    if (!selectedGroupId) return null;
    const group =
      projection.groups.find((item) => item.id === selectedGroupId) ??
      projection.inspectorGroups.find((item) => item.id === selectedGroupId);
    if (!group) return null;
    for (const nodeId of group.nodeIds) {
      const entity = projection.semanticEntities.find((item) => item.id === nodeId);
      if (entity) return entity;
    }
    return null;
  }, [
    projection.groups,
    projection.inspectorGroups,
    projection.semanticEntities,
    selectedGroupId,
    selectedNodeId,
  ]);
  const selectedNode = useMemo(() => {
    const rawId = selectedNodeId && projection.sourceGraphNodeIdBySemanticId[selectedNodeId];
    return graph && rawId ? findGraphNode(graph, rawId) : null;
  }, [graph, projection.sourceGraphNodeIdBySemanticId, selectedNodeId]);
  const selectedCluster = useMemo(
    () => projection.inspectorGroups.find((group) => group.id === selectedGroupId) ?? null,
    [projection.inspectorGroups, selectedGroupId],
  );
  return { selectedSemanticEntity, selectedNode, selectedCluster };
}

export function useAtlasSelection(
  graph: BlueprintData["graph"],
  projection: AtlasProjection,
  graphSnapshotKey: string,
): AtlasSelectionState {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const resolved = useResolvedSelection(graph, projection, selectedNodeId, selectedGroupId);
  useAtlasDefaultClusterSelection(
    graph,
    projection.groups,
    selectedGroupId,
    selectedNodeId,
    setSelectedGroupId,
    setSelectedNodeId,
    graphSnapshotKey,
  );
  useSelectionValidity(
    projection,
    selectedNodeId,
    selectedGroupId,
    setSelectedNodeId,
    setSelectedGroupId,
  );
  const handleSelectNode = (nodeId: string): void => {
    const semantic = projection.semanticEntities.find((item) => item.id === nodeId);
    const districtGroup = projection.groups.find((group) => group.nodeIds.includes(nodeId));
    const preferCluster = semantic?.kind === "business-domain" || semantic?.kind === "capability";
    if (preferCluster && districtGroup) {
      setSelectedGroupId(districtGroup.id);
      setSelectedNodeId(null);
      return;
    }
    setSelectedGroupId(districtGroup?.id ?? null);
    setSelectedNodeId(nodeId);
  };
  const handleSelectGroup = (groupId: string): void => {
    setSelectedGroupId(groupId);
    setSelectedNodeId(null);
  };
  return {
    selectedNodeId,
    selectedGroupId,
    ...resolved,
    handleSelectNode,
    handleSelectGroup,
  };
}
