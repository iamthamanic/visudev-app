/**
 * Compact node overview for Dependencies graph — click a chip to filter search.
 */

import type { GraphCanvasNode } from "../../types";
import styles from "../../styles/DependenciesView.module.css";

export interface DependenciesMinimapProps {
  nodes: GraphCanvasNode[];
  orphanNodeIds: string[];
  onSelectNode: (nodeId: string) => void;
}

export function DependenciesMinimap({
  nodes,
  orphanNodeIds,
  onSelectNode,
}: DependenciesMinimapProps): JSX.Element | null {
  if (nodes.length === 0) return null;

  const minimapNodes = nodes.slice(0, 24);
  const orphanSet = new Set(orphanNodeIds);

  return (
    <div className={styles.minimap} aria-label="Graph-Minimap">
      <p className={styles.minimapTitle}>Übersicht</p>
      <ul className={styles.minimapList}>
        {minimapNodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className={`${styles.minimapChip} ${orphanSet.has(node.id) ? styles.minimapChipOrphan : ""}`}
              data-kind={node.kind}
              onClick={() => onSelectNode(node.id)}
              title={node.label}
            >
              {node.label.split("\n")[0]}
            </button>
          </li>
        ))}
      </ul>
      {nodes.length > minimapNodes.length ? (
        <p className={styles.minimapMore}>+{nodes.length - minimapNodes.length} weitere</p>
      ) : null}
    </div>
  );
}
