/**
 * Groups projected infrastructure nodes into topology tiers for the diagram.
 */

import type { GraphCanvasNode, SoftwareGraph } from "../../types";

export type TopologyTier =
  | "internet"
  | "loadBalancer"
  | "service"
  | "database"
  | "externalApi"
  | "monitoring";

export interface TopologyNodeRef {
  id: string;
  label: string;
  kind: string;
  tier: TopologyTier;
}

const MAX_LABEL_LENGTH = 80;
const MAX_ID_LENGTH = 200;

export const MAX_TOPOLOGY_NODES_PER_TIER = 12;

const MONITORING_LABELS = new Set(["prometheus", "grafana", "loki", "alertmanager"]);

function sanitizeLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "Unbenannt";
  return trimmed.length > MAX_LABEL_LENGTH ? `${trimmed.slice(0, MAX_LABEL_LENGTH - 1)}…` : trimmed;
}

function sanitizeNodeId(id: string): string | null {
  const trimmed = id.trim();
  if (!trimmed || trimmed.length > MAX_ID_LENGTH) return null;
  return trimmed;
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function isInternetNode(graphNode: GraphCanvasNode): boolean {
  return graphNode.kind === "runtime" && normalizeLabel(graphNode.label) === "internet";
}

function isLoadBalancerNode(graphNode: GraphCanvasNode): boolean {
  if (graphNode.kind !== "runtime") return false;
  const label = graphNode.label.toUpperCase();
  return label.includes("LOAD BALANCER") || label.includes("GATEWAY");
}

function isMonitoringNode(graphNode: GraphCanvasNode): boolean {
  if (graphNode.kind !== "external") return false;
  return MONITORING_LABELS.has(normalizeLabel(graphNode.label));
}

function isExternalApiNode(graphNode: GraphCanvasNode): boolean {
  if (graphNode.kind === "external") return !isMonitoringNode(graphNode);
  return graphNode.kind === "service" && normalizeLabel(graphNode.label).includes("email");
}

function isInfraServiceNode(graphNode: GraphCanvasNode): boolean {
  if (graphNode.kind === "route") return true;
  if (graphNode.kind === "service") return true;
  if (graphNode.kind === "runtime") {
    const label = normalizeLabel(graphNode.label);
    if (label === "internet") return false;
    if (label.includes("load balancer") || label.includes("gateway")) return false;
    // Softort: browser/server/edge runtimes from real scans → service tier
    return label === "browser" || label === "server" || label === "edge" || label === "shared";
  }
  return false;
}

/** Maps one projected graph node to a topology tier, or null when it is not shown in the diagram. */
export function classifyGraphNodeTopologyTier(graphNode: GraphCanvasNode): TopologyTier | null {
  if (isInternetNode(graphNode)) return "internet";
  if (isLoadBalancerNode(graphNode)) return "loadBalancer";
  if (isMonitoringNode(graphNode)) return "monitoring";
  if (isExternalApiNode(graphNode)) return "externalApi";
  if (graphNode.kind === "table") return "database";
  if (isInfraServiceNode(graphNode)) return "service";
  return null;
}

/** @deprecated Use classifyGraphNodeTopologyTier */
export const classifyTopologyTier = classifyGraphNodeTopologyTier;

/** Projects classified graph nodes into topology diagram refs (no synthetic/demo nodes). */
export function projectGraphNodesToTopologyRefs(
  projectedGraphNodes: GraphCanvasNode[],
): TopologyNodeRef[] {
  return projectedGraphNodes
    .map((projectedGraphNode) => {
      const nodeId = sanitizeNodeId(projectedGraphNode.id);
      const topologyTier = classifyGraphNodeTopologyTier(projectedGraphNode);
      if (!nodeId || !topologyTier) return null;
      return {
        id: nodeId,
        label: sanitizeLabel(projectedGraphNode.label),
        kind: projectedGraphNode.kind,
        tier: topologyTier,
      };
    })
    .filter((topologyRef): topologyRef is TopologyNodeRef => topologyRef != null);
}

export function buildTopologyNodes(projectedGraphNodes: GraphCanvasNode[]): TopologyNodeRef[] {
  return projectGraphNodesToTopologyRefs(projectedGraphNodes);
}

/** Applies env/region filters using graph node metadata; nodes without metadata stay visible. */
export function filterProjectedNodesByDeployment(
  projectedGraphNodes: GraphCanvasNode[],
  softwareGraph: SoftwareGraph,
  activeEnv: string | null,
  activeRegion: string | null,
): GraphCanvasNode[] {
  if (!activeEnv && !activeRegion) return projectedGraphNodes;

  const graphNodeById = new Map(softwareGraph.nodes.map((graphNode) => [graphNode.id, graphNode]));

  return projectedGraphNodes.filter((projectedGraphNode) => {
    const sourceGraphNode = graphNodeById.get(projectedGraphNode.id);
    if (!sourceGraphNode?.metadata) return true;

    const nodeEnv = sourceGraphNode.metadata.env;
    const nodeRegion = sourceGraphNode.metadata.region;

    if (activeEnv && nodeEnv !== activeEnv) {
      return false;
    }
    if (activeRegion && nodeRegion !== activeRegion) {
      return false;
    }
    return true;
  });
}

export const TOPOLOGY_ENV_FILTERS = ["Produktion", "Staging"] as const;
export const TOPOLOGY_REGION_FILTERS = ["eu-central-1", "us-east-1"] as const;
export const TOPOLOGY_VIEW_FILTERS = ["Logische Topologie", "Physische Topologie"] as const;

/**
 * Honest-Core P0-2: env/region filters are derived from real node metadata,
 * never a fixed list. Returns only the env/region values actually present in
 * the graph; an empty array means the filter group must not be rendered.
 */
export function deploymentFiltersFromGraph(softwareGraph: SoftwareGraph): {
  envs: string[];
  regions: string[];
} {
  const envs = new Set<string>();
  const regions = new Set<string>();
  for (const node of softwareGraph.nodes) {
    const env = node.metadata?.env;
    const region = node.metadata?.region;
    if (typeof env === "string" && env.trim()) envs.add(env.trim());
    if (typeof region === "string" && region.trim()) regions.add(region.trim());
  }
  return { envs: Array.from(envs).sort(), regions: Array.from(regions).sort() };
}

export type TopologyEnvFilter = (typeof TOPOLOGY_ENV_FILTERS)[number];
export type TopologyRegionFilter = (typeof TOPOLOGY_REGION_FILTERS)[number];
export type TopologyViewFilter = (typeof TOPOLOGY_VIEW_FILTERS)[number];
