/**
 * Maps visible Atlas nodes into 3D city blocks (district grid layout).
 * Color assignment is category-only; palette resolution happens in AtlasCityScene.
 */

import type { GraphCanvasNode } from "../../types";
import type { SoftwareGraphGroup } from "../../types";
import { resolveAtlasClusterCategory, type AtlasClusterCategory } from "./atlas-cluster-theme.js";

export interface CityBlock {
  id: string;
  label: string;
  kind: string;
  districtLabel: string;
  clusterCategory: AtlasClusterCategory;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color?: string;
}

const KIND_HEIGHT: Record<string, number> = {
  organization: 5,
  application: 4.5,
  domain: 4,
  module: 3,
  service: 3.5,
  route: 2.5,
  table: 2,
  external: 2.2,
  file: 1.8,
  runtime: 1.5,
};

const BLOCK_SIZE = 1.4; // ponytail: decorative footprint; legend marks Quelle: dekorativ
const DISTRICT_GAP = 8;
const GRID_GAP = 0.35;

function heightForKind(kind: string): number {
  // Honest-Core: height encodes node.kind, not LOC/fan-in (see atlas-visual-channels).
  return KIND_HEIGHT[kind] ?? 2;
}

function layoutDistrict(
  nodes: GraphCanvasNode[],
  districtLabel: string,
  districtKind: string | undefined,
  originX: number,
  originZ: number,
): CityBlock[] {
  if (nodes.length === 0) return [];
  const clusterCategory = resolveAtlasClusterCategory(districtLabel, districtKind);
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return nodes.map((node, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      districtLabel,
      clusterCategory,
      x: originX + column * (BLOCK_SIZE + GRID_GAP),
      z: originZ + row * (BLOCK_SIZE + GRID_GAP),
      width: BLOCK_SIZE,
      depth: BLOCK_SIZE,
      height: heightForKind(node.kind),
      color: node.color,
    };
  });
}

function groupNodesByDistrict(
  nodes: GraphCanvasNode[],
  groups: SoftwareGraphGroup[],
): { label: string; kind?: string; nodes: GraphCanvasNode[] }[] {
  if (groups.length === 0) {
    return [{ label: "System", nodes }];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const assigned = new Set<string>();
  const districts: { label: string; kind?: string; nodes: GraphCanvasNode[] }[] = [];

  for (const group of groups) {
    const districtNodes = group.nodeIds
      .map((nodeId) => nodeById.get(nodeId))
      .filter((node): node is GraphCanvasNode => Boolean(node));
    if (districtNodes.length === 0) continue;
    districtNodes.forEach((node) => assigned.add(node.id));
    districts.push({ label: group.label, kind: group.kind, nodes: districtNodes });
  }

  const ungrouped = nodes.filter((node) => !assigned.has(node.id));
  if (ungrouped.length > 0) {
    districts.push({ label: "Sonstige", nodes: ungrouped });
  }

  return districts.length > 0 ? districts : [{ label: "System", nodes }];
}

export function buildCityBlocks(
  nodes: GraphCanvasNode[],
  groups: SoftwareGraphGroup[],
): CityBlock[] {
  const districts = groupNodesByDistrict(nodes, groups);
  const blocks: CityBlock[] = [];
  const districtColumns = Math.max(1, Math.ceil(Math.sqrt(districts.length)));

  districts.forEach((district, districtIndex) => {
    const row = Math.floor(districtIndex / districtColumns);
    const column = districtIndex % districtColumns;
    const originX = column * DISTRICT_GAP;
    const originZ = row * DISTRICT_GAP;
    blocks.push(
      ...layoutDistrict(district.nodes, district.label, district.kind, originX, originZ),
    );
  });

  if (blocks.length === 0) return blocks;

  const avgX = blocks.reduce((sum, block) => sum + block.x, 0) / blocks.length;
  const avgZ = blocks.reduce((sum, block) => sum + block.z, 0) / blocks.length;
  return blocks.map((block) => ({
    ...block,
    x: block.x - avgX,
    z: block.z - avgZ,
  }));
}
