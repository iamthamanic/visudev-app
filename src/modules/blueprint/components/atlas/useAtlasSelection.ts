import { useEffect, useMemo, useState } from "react";
import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import { isProductConceptSelectionId } from "../../../../../shared/product-understanding/selection.js";
import type { BlueprintData, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { useAtlasDefaultClusterSelection } from "../../hooks/useAtlasDefaultClusterSelection.js";
import { useBlueprintProductSelection } from "../../context/useBlueprintProductSelection.js";
import { resolveCrossViewFocus } from "../../../../../shared/product-understanding/cross-view-selection.js";
import { findGraphNode } from "./atlas-display.js";
import type { AtlasProjection } from "./_projection.js";

export interface AtlasSelectionState {
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  selectedSemanticEntity: SemanticEntity | null;
  selectedNode: SoftwareGraphNode | null;
  selectedCluster: SoftwareGraphGroup | null;
  conceptMissingInView: boolean;
  handleSelectNode: (nodeId: string) => void;
  handleSelectGroup: (groupId: string) => void;
}

function useSelectionValidity(
  projection: AtlasProjection,
  selectedNodeId: string | null,
  selectedGroupId: string | null,
  setSelectedNodeId: (value: string | null) => void,
  setSelectedGroupId: (value: string | null) => void,
  persistentConceptId: string | null,
): void {
  useEffect(() => {
    const visibleIds = new Set(projection.nodes.map((node) => node.id));
    if (
      selectedNodeId &&
      !visibleIds.has(selectedNodeId) &&
      selectedNodeId !== persistentConceptId
    ) {
      setSelectedNodeId(null);
    }
    if (selectedGroupId && !projection.groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [
    persistentConceptId,
    projection,
    selectedGroupId,
    selectedNodeId,
    setSelectedGroupId,
    setSelectedNodeId,
  ]);
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
  const { selection, setSelection } = useBlueprintProductSelection();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const availableConceptIds = useMemo(
    () => projection.nodes.map((node) => node.id).filter((id) => isProductConceptSelectionId(id)),
    [projection.nodes],
  );
  const focus = useMemo(
    () => (selection ? resolveCrossViewFocus(selection, "atlas", availableConceptIds) : null),
    [availableConceptIds, selection],
  );

  useEffect(() => {
    if (!focus?.presentInView || !focus.viewLocalId) return;
    if (selectedNodeId === focus.viewLocalId) return;
    const districtGroup = projection.groups.find((group) =>
      group.nodeIds.includes(focus.viewLocalId!),
    );
    setSelectedGroupId(districtGroup?.id ?? null);
    setSelectedNodeId(focus.viewLocalId);
  }, [focus, projection.groups, selectedNodeId]);

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
    selection?.conceptId ?? null,
  );
  const handleSelectNode = (nodeId: string): void => {
    const semantic = projection.semanticEntities.find((item) => item.id === nodeId);
    const districtGroup = projection.groups.find((group) => group.nodeIds.includes(nodeId));
    const preferCluster = semantic?.kind === "business-domain" || semantic?.kind === "capability";
    if (isProductConceptSelectionId(nodeId)) {
      setSelection(nodeId, null, "atlas");
    }
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
    const group = projection.groups.find((item) => item.id === groupId);
    const firstConcept = group?.nodeIds.find((id) => isProductConceptSelectionId(id));
    if (firstConcept) setSelection(firstConcept, null, "atlas");
  };
  return {
    selectedNodeId,
    selectedGroupId,
    ...resolved,
    conceptMissingInView: Boolean(selection && focus && !focus.presentInView),
    handleSelectNode,
    handleSelectGroup,
  };
}
