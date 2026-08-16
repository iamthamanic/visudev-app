/** Atlas view state orchestration. */

import { useMemo, useState } from "react";
import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { BlueprintData, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { buildGraphSnapshotKey } from "../../services/graph-snapshot-key.js";
import { buildCityBlocks, type CityBlock } from "./build-city-blocks.js";
import type { AtlasProjection } from "./_projection.js";
import type { AtlasViewMode } from "./atlas-view-mode.js";
import { useAtlasProjection } from "./useAtlasProjection.js";
import { useAtlasSelection } from "./useAtlasSelection.js";
import { useAtlasViewModeState } from "./useAtlasViewModeState.js";

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
  const projection = useAtlasProjection(graph, searchQuery);
  const visibleGroups = projection.groups;
  const cityBlocks = useMemo(
    () => buildCityBlocks(projection.nodes, visibleGroups),
    [projection.nodes, visibleGroups],
  );
  const graphSnapshotKey = buildGraphSnapshotKey(graph);
  const selection = useAtlasSelection(graph, projection, graphSnapshotKey);
  const mode = useAtlasViewModeState();

  return {
    searchQuery,
    projection,
    visibleGroups,
    cityBlocks,
    ...selection,
    ...mode,
    setSearchQuery,
    resetSearch: () => setSearchQuery(""),
  };
}
