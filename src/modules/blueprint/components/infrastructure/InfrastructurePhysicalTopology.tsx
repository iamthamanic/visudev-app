/**
 * Physical topology projection of Compose/K8s services, networks, and depends-on.
 * Location: src/modules/blueprint/components/infrastructure/InfrastructurePhysicalTopology.tsx
 */

import type { PhysicalTopologyProjection } from "./build-topology.js";
import styles from "../../styles/InfrastructureView.module.css";

interface InfrastructurePhysicalTopologyProps {
  projection: PhysicalTopologyProjection;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function InfrastructurePhysicalTopology({
  projection,
  selectedNodeId,
  onSelectNode,
}: InfrastructurePhysicalTopologyProps): JSX.Element {
  const nodeById = new Map(projection.nodes.map((node) => [node.id, node]));

  return (
    <div
      className={styles.physicalTopology}
      data-testid="infra-physical-topology"
      aria-label="Physische Topologie"
    >
      <p className={styles.physicalSource}>{projection.sourceLabel}</p>
      <div className={styles.physicalNetworks}>
        {projection.networks.map((network) => (
          <section key={network.name} className={styles.physicalNetwork} aria-label={network.name}>
            <span className={styles.topologyTierLabel}>{network.name}</span>
            <div className={styles.topologyTierNodes}>
              {network.nodeIds.map((nodeId) => {
                const node = nodeById.get(nodeId);
                if (!node) return null;
                const isSelected = selectedNodeId === node.id;
                return (
                  <button
                    key={`${network.name}:${node.id}`}
                    type="button"
                    className={`${styles.topologyNode} ${isSelected ? styles.topologyNodeSelected : ""}`}
                    data-testid="infra-topology-node"
                    data-selected={isSelected ? "true" : "false"}
                    data-kind={node.kind}
                    onClick={() => onSelectNode(node.id)}
                  >
                    {node.label}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {projection.dependencies.length > 0 ? (
        <ul className={styles.physicalDepends} aria-label="Abhängigkeiten">
          {projection.dependencies.map((dependency) => (
            <li key={`${dependency.sourceId}:${dependency.targetId}`}>
              {dependency.sourceLabel} → {dependency.targetLabel}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
