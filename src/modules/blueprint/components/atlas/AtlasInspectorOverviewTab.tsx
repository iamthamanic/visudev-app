/**
 * Übersicht tab content for Atlas Inspektor — rich cluster profile (Wave 4).
 */

import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { AtlasClusterActivityList } from "./AtlasClusterActivityList.js";
import { AtlasClusterMetricGrid } from "./AtlasClusterMetricGrid.js";
import { AtlasSemanticEvidenceSection } from "./AtlasSemanticEvidenceSection.js";
import { atlasKindLabel } from "./atlas-display.js";
import {
  clusterActivityItems,
  clusterOverviewMetrics,
  clusterStackLabel,
  clusterTechTags,
  clusterTopDependencies,
} from "./atlas-cluster-overview.js";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasInspectorOverviewTabProps {
  graph?: SoftwareGraph;
  node: SoftwareGraphNode | null;
  cluster: SoftwareGraphGroup | null;
  nodeGroups: SoftwareGraphGroup[];
  semanticEntity?: SemanticEntity | null;
}

export function AtlasInspectorOverviewTab({
  graph,
  node,
  cluster,
  nodeGroups,
  semanticEntity = null,
}: AtlasInspectorOverviewTabProps): JSX.Element {
  const label = semanticEntity?.label ?? cluster?.label ?? node?.label ?? "—";
  const purpose =
    typeof semanticEntity?.metadata?.purpose === "string"
      ? semanticEntity.metadata.purpose.trim()
      : "";
  const technicalRefs = Array.isArray(semanticEntity?.metadata?.technicalRefs)
    ? semanticEntity.metadata.technicalRefs.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  const topDependencies = clusterTopDependencies(graph, node, cluster);
  const typeLabel = semanticEntity
    ? atlasKindLabel(
        typeof semanticEntity.metadata?.productKind === "string"
          ? semanticEntity.metadata.productKind
          : semanticEntity.kind,
      )
    : atlasKindLabel(cluster?.kind ?? node?.kind ?? "—");

  return (
    <div className={styles.clusterOverview} data-testid="atlas-inspector-overview">
      <p className={styles.clusterStack}>{clusterStackLabel(label)}</p>
      <p className={styles.clusterHealth}>
        <span className={styles.clusterHealthDot} aria-hidden="true" />
        Gesund
      </p>

      <dl className={styles.detailList}>
        <div className={styles.detailRow}>
          <dt>Name</dt>
          <dd>{label}</dd>
        </div>
        <div className={styles.detailRow}>
          <dt>Typ</dt>
          <dd>{typeLabel}</dd>
        </div>
        {purpose ? (
          <div className={styles.detailRow}>
            <dt>Zweck</dt>
            <dd>{purpose}</dd>
          </div>
        ) : null}
        {cluster ? (
          <div className={styles.detailRow}>
            <dt>Knoten</dt>
            <dd>{cluster.nodeIds.length}</dd>
          </div>
        ) : null}
        {node && nodeGroups.length > 0 ? (
          <div className={styles.detailRow}>
            <dt>Cluster</dt>
            <dd>{nodeGroups.map((group) => group.label).join(", ")}</dd>
          </div>
        ) : null}
        {technicalRefs.length > 0 ? (
          <div className={styles.detailRow}>
            <dt>Technische Bezüge</dt>
            <dd data-testid="atlas-technical-refs">{technicalRefs.join(", ")}</dd>
          </div>
        ) : null}
      </dl>

      {semanticEntity ? <AtlasSemanticEvidenceSection entity={semanticEntity} /> : null}

      <AtlasClusterMetricGrid metrics={clusterOverviewMetrics(graph, cluster)} />

      {topDependencies.length > 0 ? (
        <section className={styles.overviewSection} data-testid="atlas-inspector-deps">
          <h4 className={styles.subSectionTitle}>Top Abhängigkeiten</h4>
          <ul className={styles.checklist}>
            {topDependencies.map((dependency) => (
              <li key={dependency}>{dependency}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={styles.overviewSection} data-testid="atlas-inspector-tech">
        <h4 className={styles.subSectionTitle}>Technologien</h4>
        <div className={styles.techTags}>
          {clusterTechTags(label).map((tech) => (
            <span key={tech} className={styles.techTag} data-testid="atlas-tech-chip">
              {tech}
            </span>
          ))}
        </div>
      </section>

      <AtlasClusterActivityList items={clusterActivityItems(graph)} />
    </div>
  );
}
