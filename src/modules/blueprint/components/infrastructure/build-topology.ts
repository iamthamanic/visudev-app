/**
 * Groups projected infrastructure nodes into topology tiers for the diagram.
 */

import type { GraphCanvasNode, SoftwareGraph, SoftwareGraphNode } from "../../types";

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

export type TopologyViewFilter = (typeof TOPOLOGY_VIEW_FILTERS)[number];

const PHYSICAL_SOURCES = new Set(["docker-compose", "kubernetes"]);

export function isPhysicalDescriptorNode(node: SoftwareGraphNode): boolean {
  if (node.kind !== "service") return false;
  const source = node.metadata?.source;
  return typeof source === "string" && PHYSICAL_SOURCES.has(source);
}

export function graphHasPhysicalDescriptors(softwareGraph: SoftwareGraph): boolean {
  return softwareGraph.nodes.some(isPhysicalDescriptorNode);
}

function splitCsv(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function physicalSourceLabel(nodes: SoftwareGraphNode[]): string {
  const sources = new Set(
    nodes
      .map((node) => node.metadata?.source)
      .filter((source): source is string => typeof source === "string"),
  );
  const hasCompose = sources.has("docker-compose");
  const hasK8s = sources.has("kubernetes");
  if (hasCompose && hasK8s) return "Quelle: Docker Compose und Kubernetes";
  if (hasK8s) return "Quelle: Kubernetes";
  return "Quelle: Docker Compose";
}

export interface PhysicalNetworkGroup {
  name: string;
  nodeIds: string[];
}

export interface PhysicalDependency {
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
}

export interface PhysicalTopologyProjection {
  nodes: TopologyNodeRef[];
  networks: PhysicalNetworkGroup[];
  dependencies: PhysicalDependency[];
  sourceLabel: string;
}

export function projectPhysicalTopology(
  softwareGraph: SoftwareGraph,
  visibleNodeIds: Set<string>,
): PhysicalTopologyProjection | null {
  const descriptorNodes = softwareGraph.nodes.filter(
    (node) => isPhysicalDescriptorNode(node) && visibleNodeIds.has(node.id),
  );
  if (descriptorNodes.length === 0) return null;

  const nodes: TopologyNodeRef[] = [];
  for (const node of descriptorNodes) {
    const nodeId = sanitizeNodeId(node.id);
    if (!nodeId) continue;
    const ports = splitCsv(node.metadata.ports);
    nodes.push({
      id: nodeId,
      label:
        ports.length > 0
          ? `${sanitizeLabel(node.label)} (${ports.join(", ")})`
          : sanitizeLabel(node.label),
      kind: node.kind,
      tier: "service",
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const labelById = new Map(nodes.map((node) => [node.id, node.label]));
  const ungrouped: string[] = [];
  const networkMap = new Map<string, string[]>();
  for (const node of descriptorNodes) {
    if (!nodeIds.has(node.id)) continue;
    const networks = splitCsv(node.metadata.networks);
    if (networks.length === 0) {
      ungrouped.push(node.id);
      continue;
    }
    for (const network of networks) {
      const list = networkMap.get(network) ?? [];
      list.push(node.id);
      networkMap.set(network, list);
    }
  }
  const networks: PhysicalNetworkGroup[] = [...networkMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, groupedNodeIds]) => ({ name, nodeIds: groupedNodeIds }));
  if (ungrouped.length > 0) {
    networks.push({ name: "Ohne Netzwerk", nodeIds: ungrouped });
  }

  const dependencies: PhysicalDependency[] = [];
  for (const edge of softwareGraph.edges) {
    if (edge.kind !== "external-dependency") continue;
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) continue;
    dependencies.push({
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      sourceLabel: labelById.get(edge.sourceId) ?? edge.sourceId,
      targetLabel: labelById.get(edge.targetId) ?? edge.targetId,
    });
  }

  return {
    nodes,
    networks,
    dependencies,
    sourceLabel: physicalSourceLabel(descriptorNodes),
  };
}
