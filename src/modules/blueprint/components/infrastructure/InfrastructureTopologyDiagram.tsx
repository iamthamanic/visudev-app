/**
 * HTML topology diagram: Internet → LB → Services → Data → External APIs → Monitoring.
 */

import type { ReactNode } from "react";
import {
  MAX_TOPOLOGY_NODES_PER_TIER,
  type TopologyNodeRef,
  type TopologyTier,
} from "./build-topology.js";
import styles from "../../styles/InfrastructureView.module.css";

interface InfrastructureTopologyDiagramProps {
  nodes: TopologyNodeRef[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

interface TierColumnProps {
  title: string;
  testId?: string;
  children: ReactNode;
}

function TierColumn({ title, testId, children }: TierColumnProps): JSX.Element {
  return (
    <div className={styles.topologyTier} data-testid={testId}>
      <span className={styles.topologyTierLabel}>{title}</span>
      <div className={styles.topologyTierNodes}>{children}</div>
    </div>
  );
}

function TopologyNodeButton({
  node,
  isSelected,
  onSelectNode,
}: {
  node: TopologyNodeRef;
  isSelected: boolean;
  onSelectNode: (nodeId: string) => void;
}): JSX.Element {
  return (
    <button
      key={node.id}
      type="button"
      className={`${styles.topologyNode} ${isSelected ? styles.topologyNodeSelected : ""}`}
      data-testid="infra-topology-node"
      data-selected={isSelected ? "true" : "false"}
      data-kind={node.kind}
      data-tier={node.tier}
      aria-pressed={isSelected}
      onClick={() => onSelectNode(node.id)}
    >
      {node.label}
    </button>
  );
}

function renderTierNodes(
  tierNodes: TopologyNodeRef[],
  selectedNodeId: string | null,
  onSelectNode: (nodeId: string) => void,
  emptyLabel: string,
): JSX.Element {
  const visibleNodes = tierNodes.slice(0, MAX_TOPOLOGY_NODES_PER_TIER);
  const hiddenCount = Math.max(0, tierNodes.length - visibleNodes.length);

  if (tierNodes.length === 0) {
    return <p className={styles.emptyControls}>{emptyLabel}</p>;
  }

  return (
    <>
      {visibleNodes.map((node) => (
        <TopologyNodeButton
          key={node.id}
          node={node}
          isSelected={selectedNodeId === node.id}
          onSelectNode={onSelectNode}
        />
      ))}
      {hiddenCount > 0 ? (
        <p className={styles.emptyControls}>+{hiddenCount} weitere Knoten</p>
      ) : null}
    </>
  );
}

function nodesForTier(nodes: TopologyNodeRef[], tier: TopologyTier): TopologyNodeRef[] {
  return nodes.filter((node) => node.tier === tier);
}

export function InfrastructureTopologyDiagram({
  nodes,
  selectedNodeId,
  onSelectNode,
}: InfrastructureTopologyDiagramProps): JSX.Element {
  const internetNodes = nodesForTier(nodes, "internet");
  const loadBalancerNodes = nodesForTier(nodes, "loadBalancer");
  const serviceNodes = nodesForTier(nodes, "service");
  const databaseNodes = nodesForTier(nodes, "database");
  const externalApiNodes = nodesForTier(nodes, "externalApi");
  const monitoringNodes = nodesForTier(nodes, "monitoring");

  return (
    <div className={styles.topology} aria-label="Infrastruktur-Topologie">
      <div className={styles.topologyFlow}>
        <TierColumn title="Internet">
          {renderTierNodes(
            internetNodes,
            selectedNodeId,
            onSelectNode,
            "Kein Internet-Knoten im Scan (ABSENT).",
          )}
        </TierColumn>
        <span className={styles.topologyArrow} aria-hidden="true">
          ──►
        </span>

        <TierColumn title="Load Balancer">
          {renderTierNodes(
            loadBalancerNodes,
            selectedNodeId,
            onSelectNode,
            "Kein Gateway im Scan.",
          )}
        </TierColumn>

        <span className={styles.topologyArrow} aria-hidden="true">
          ──►
        </span>

        <TierColumn title="Services">
          {renderTierNodes(serviceNodes, selectedNodeId, onSelectNode, "Keine Services im Graph.")}
        </TierColumn>

        <span className={styles.topologyArrow} aria-hidden="true">
          ──►
        </span>

        <TierColumn title="Daten">
          {renderTierNodes(databaseNodes, selectedNodeId, onSelectNode, "Keine Datenbank-Knoten.")}
        </TierColumn>

        <span className={styles.topologyArrow} aria-hidden="true">
          ──►
        </span>

        <TierColumn title="External APIs" testId="infra-external-apis">
          {renderTierNodes(externalApiNodes, selectedNodeId, onSelectNode, "Keine externen APIs.")}
        </TierColumn>

        <span className={styles.topologyArrow} aria-hidden="true">
          ──►
        </span>

        <TierColumn title="Monitoring" testId="infra-monitoring-tier">
          {renderTierNodes(monitoringNodes, selectedNodeId, onSelectNode, "Kein Monitoring-Tier.")}
        </TierColumn>
      </div>
    </div>
  );
}
