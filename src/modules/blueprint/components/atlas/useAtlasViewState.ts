/**
 * Atlas view state — search, selection, semantic projection, view mode, reduced-motion policy.
 */

import { useEffect, useMemo, useState } from "react";
import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { BlueprintData, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { useAtlasDefaultClusterSelection } from "../../hooks/useAtlasDefaultClusterSelection.js";
import { buildGraphSnapshotKey } from "../../services/graph-snapshot-key.js";
import { buildCityBlocks } from "./build-city-blocks.js";
import type { CityBlock } from "./build-city-blocks.js";
import { findGraphNode } from "./atlas-display.js";
import { projectAtlasGraph } from "./_projection.js";
import type { AtlasProjection } from "./_projection.js";
import type { AtlasViewMode } from "./atlas-view-mode.js";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion.js";

export interface AtlasViewState {
  searchQuery: string;
  viewMode: AtlasViewMode;
  threeDisabled: boolean;
  projection: AtlasProjection;
  visibleGroups: SoftwareGraphGroup[];
  cityBlocks: CityBlock[];
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  selectedSemanticEntity: SemanticEntity | null;
  selectedNode: SoftwareGraphNode | null;
  selectedCluster: SoftwareGraphGroup | null;
  setSearchQuery: (value: string) => void;
  handleSelectNode: (nodeId: string) => void;
  handleSelectGroup: (groupId: string) => void;
  handleSelectViewMode: (mode: AtlasViewMode) => void;
  resetSearch: () => void;
}

export function useAtlasViewState(graph: BlueprintData["graph"]): AtlasViewState {
  const [searchQuery, setSearchQuery] = useState("");
  const prefersReducedMotion = usePrefersReducedMotion();
  const threeDisabled = prefersReducedMotion;
  const [viewMode, setViewMode] = useState<AtlasViewMode>(() =>
    prefersReducedMotion ? "2d" : "3d",
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const graphSnapshotKey = buildGraphSnapshotKey(graph);

  const projection = useMemo<AtlasProjection>(() => {
    if (!graph) {
      return {
        nodes: [],
        edges: [],
        groups: [],
        inspectorGroups: [],
        semanticEntities: [],
        sourceGraphNodeIdBySemanticId: {},
        condensed: false,
        totalNodes: 0,
        visibleNodes: 0,
      };
    }
    return projectAtlasGraph(graph, { searchQuery });
  }, [graph, searchQuery]);

  const visibleGroups = projection.groups;

  const cityBlocks = useMemo(
    () => buildCityBlocks(projection.nodes, visibleGroups),
    [projection.nodes, visibleGroups],
  );

  const selectedSemanticEntity = useMemo(() => {
    if (!selectedNodeId) return null;
    return projection.semanticEntities.find((entity) => entity.id === selectedNodeId) ?? null;
  }, [projection.semanticEntities, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    const graphNodeId = projection.sourceGraphNodeIdBySemanticId[selectedNodeId];
    return graphNodeId ? findGraphNode(graph, graphNodeId) : null;
  }, [graph, projection.sourceGraphNodeIdBySemanticId, selectedNodeId]);

  const selectedCluster = useMemo(() => {
    if (!selectedGroupId) return null;
    return projection.inspectorGroups.find((group) => group.id === selectedGroupId) ?? null;
  }, [projection.inspectorGroups, selectedGroupId]);

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSelectedGroupId(null);
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedNodeId(null);
  };

  const handleSelectViewMode = (mode: AtlasViewMode) => {
    if (mode === "3d" && threeDisabled) return;
    setViewMode(mode);
  };

  useEffect(() => {
    setViewMode(threeDisabled ? "2d" : "3d");
  }, [threeDisabled]);

  useAtlasDefaultClusterSelection(
    graph,
    visibleGroups,
    selectedGroupId,
    selectedNodeId,
    setSelectedGroupId,
    setSelectedNodeId,
    graphSnapshotKey,
  );

  useEffect(() => {
    const visibleIds = new Set(projection.nodes.map((node) => node.id));
    if (selectedNodeId && !visibleIds.has(selectedNodeId)) setSelectedNodeId(null);
    if (selectedGroupId && !visibleGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [projection.nodes, selectedGroupId, selectedNodeId, visibleGroups]);

  return {
    searchQuery,
    viewMode,
    threeDisabled,
    projection,
    visibleGroups,
    cityBlocks,
    selectedNodeId,
    selectedGroupId,
    selectedSemanticEntity,
    selectedNode,
    selectedCluster,
    setSearchQuery,
    handleSelectNode,
    handleSelectGroup,
    handleSelectViewMode,
    resetSearch: () => setSearchQuery(""),
  };
}
