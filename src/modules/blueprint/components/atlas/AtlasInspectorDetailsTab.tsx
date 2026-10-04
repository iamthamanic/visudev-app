/**
 * Details tab content for Atlas Inspektor.
 */

import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { ATLAS_CLUSTER_MEMBER_LIMIT } from "./atlas-inspector-tabs.js";
import { AtlasSemanticEvidenceSection } from "./AtlasSemanticEvidenceSection.js";
import { resolveNodeLabels } from "./atlas-display.js";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasInspectorDetailsTabProps {
  graph: SoftwareGraph;
  node: SoftwareGraphNode | null;
  cluster: SoftwareGraphGroup | null;
  semanticEntity?: SemanticEntity | null;
}

export function AtlasInspectorDetailsTab({
  graph,
  node,
  cluster,
  semanticEntity = null,
}: AtlasInspectorDetailsTabProps): JSX.Element {
  if (cluster) {
    const { labels, omittedCount } = resolveNodeLabels(
      graph,
      cluster.nodeIds,
      ATLAS_CLUSTER_MEMBER_LIMIT,
    );
    if (labels.length === 0) {
      return <p className={styles.emptyControls}>Keine Knoten in diesem Cluster.</p>;
    }
    return (
      <>
        {semanticEntity ? <AtlasSemanticEvidenceSection entity={semanticEntity} /> : null}
        <ul className={styles.checklist}>
          {labels.map((member, index) => (
            <li key={`${cluster.nodeIds[index] ?? member}:${index}`}>{member}</li>
          ))}
        </ul>
        {omittedCount > 0 ? (
          <p className={styles.emptyControls}>
            {omittedCount} weitere Knoten ausgeblendet (Limit {ATLAS_CLUSTER_MEMBER_LIMIT}).
          </p>
        ) : null}
      </>
    );
  }

  if (node || semanticEntity) {
    return (
      <>
        {semanticEntity ? <AtlasSemanticEvidenceSection entity={semanticEntity} /> : null}
        {node ? (
          <dl className={styles.detailList}>
            <div className={styles.detailRow}>
              <dt>ID</dt>
              <dd>{node.id}</dd>
            </div>
            {node.filePath ? (
              <div className={styles.detailRow}>
                <dt>Datei</dt>
                <dd>
                  {node.filePath}
                  {node.line ? `:${node.line}` : ""}
                </dd>
              </div>
            ) : null}
            {node.scopeId ? (
              <div className={styles.detailRow}>
                <dt>Scope</dt>
                <dd>{node.scopeId}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </>
    );
  }

  return <p className={styles.emptyControls}>Keine Detaildaten.</p>;
}
