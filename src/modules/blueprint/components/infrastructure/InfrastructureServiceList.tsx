/** Selectable service index; drives Inspektor without Cytoscape node-click (not exposed on GraphCanvas). */

import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import type { GraphCanvasNode, SoftwareGraphNode } from "../../types";
import { InfrastructureServiceCard } from "./InfrastructureServiceCard.js";
import styles from "../../styles/InfrastructureView.module.css";

export interface InfrastructureServiceListProps {
  nodes: GraphCanvasNode[];
  graphNodesById?: Map<string, SoftwareGraphNode>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function InfrastructureServiceList({
  nodes,
  graphNodesById,
  selectedNodeId,
  onSelectNode,
}: InfrastructureServiceListProps): JSX.Element {
  return (
    <aside className={styles.controls} aria-label="Services">
      <ViewSectionTitle>Services</ViewSectionTitle>
      <div className={styles.serviceList}>
        {nodes.map((node) => (
          <InfrastructureServiceCard
            key={node.id}
            node={node}
            graphNode={graphNodesById?.get(node.id) ?? null}
            selected={selectedNodeId === node.id}
            onSelect={() => onSelectNode(node.id)}
          />
        ))}
      </div>
    </aside>
  );
}
