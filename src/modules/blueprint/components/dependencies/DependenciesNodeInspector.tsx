/**
 * Node-focused inspector panel for DependenciesView.
 */

import type { SoftwareGraphNode } from "../../types";
import type { GraphCodeSelection } from "../../selection.js";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import { GraphCodeHighlight } from "../ui/GraphCodeHighlight.js";
import type { TopNodeDependency } from "./_projection.js";
import { RELATIONSHIP_LABELS, type DependencyEdgeKind } from "./_projection.constants.js";
import {
  formatDependencyAnalyzedAt,
  readDependencyNodeDescription,
  readDependencyNodeFilePath,
  readDependencyNodeModuleLabel,
  readDependencyOwner,
} from "./dependencies-node-display.js";
import styles from "../../styles/DependenciesView.module.css";

export interface DependenciesNodeInspectorProps {
  node: SoftwareGraphNode;
  analyzedAt: string;
  incomingCount: number;
  outgoingCount: number;
  neighbors: TopNodeDependency[];
  codeSelection: GraphCodeSelection | null;
  codeExcerpt: string | null;
  relatedNodes: { id: string; label: string }[];
  onSelectCodeNode: (nodeId: string | null) => void;
}

export function DependenciesNodeInspector({
  node,
  analyzedAt,
  incomingCount,
  outgoingCount,
  neighbors,
  codeSelection,
  codeExcerpt,
  relatedNodes,
  onSelectCodeNode,
}: DependenciesNodeInspectorProps): JSX.Element {
  return (
    <div data-testid="dependency-inspector">
      <InspectorPanel
        title={node.label}
        subtitle={readDependencyNodeModuleLabel(node)}
        sections={[
          {
            id: "code",
            title: "Code",
            content: (
              <GraphCodeHighlight
                filePath={codeSelection?.filePath ?? null}
                line={codeSelection?.line ?? null}
                hint={codeSelection?.hint ?? null}
                excerpt={codeExcerpt}
                relatedNodes={relatedNodes}
                selectedNodeId={node.id}
                onSelectNode={(nodeId) => onSelectCodeNode(nodeId)}
              />
            ),
          },
          {
            id: "description",
            title: "Beschreibung",
            content: (
              <p className={styles.inspectorDescription}>{readDependencyNodeDescription(node)}</p>
            ),
          },
          {
            id: "meta",
            title: "Metadaten",
            content: (
              <dl className={styles.metaList}>
                <div className={styles.metaRow}>
                  <dt>Modul</dt>
                  <dd>{node.label}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Verzeichnis</dt>
                  <dd>{readDependencyNodeFilePath(node)}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Verantwortlich</dt>
                  <dd>{readDependencyOwner(node)}</dd>
                </div>
                <div className={styles.metaRow}>
                  <dt>Letzte Änderung</dt>
                  <dd>{formatDependencyAnalyzedAt(analyzedAt)}</dd>
                </div>
              </dl>
            ),
          },
          {
            id: "counts",
            title: "Abhängigkeiten",
            content: (
              <p className={styles.depCounts}>
                <span>{incomingCount} eingehend</span>
                <span aria-hidden="true"> · </span>
                <span>{outgoingCount} ausgehend</span>
              </p>
            ),
          },
          {
            id: "top-node-deps",
            title: "Top-Abhängigkeiten",
            content:
              neighbors.length === 0 ? (
                <p className={styles.emptyControls}>Keine Abhängigkeiten für dieses Modul.</p>
              ) : (
                <ul className={styles.topDepsList}>
                  {neighbors.map((dependency) => (
                    <li key={dependency.edgeId} className={styles.topDepsItem}>
                      <span className={styles.topDepsKind} data-kind={dependency.kind}>
                        {RELATIONSHIP_LABELS[dependency.kind as DependencyEdgeKind]}
                      </span>
                      <span className={styles.topDepsLabel}>{dependency.label}</span>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </div>
  );
}
