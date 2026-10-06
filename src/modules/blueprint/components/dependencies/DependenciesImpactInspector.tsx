/**
 * Impact-map inspector for Dependencies (PU-09): plain-language relations,
 * hop (direct/transitive), KnowledgeStatus, why-it-matters, never confirms UNKNOWN.
 * Location: src/modules/blueprint/components/dependencies/DependenciesImpactInspector.tsx
 */

import type {
  DependenciesImpactMapProjection,
  ImpactRelationView,
} from "../../../../../shared/product-understanding/index.js";
import type { GraphCanvasNode } from "../../types";
import { atlasKnowledgeStatusLabel, atlasKnowledgeTone } from "../atlas/atlas-knowledge-status.js";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import styles from "../../styles/DependenciesView.module.css";

export interface DependenciesImpactInspectorProps {
  projection: DependenciesImpactMapProjection;
  nodes: GraphCanvasNode[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onClearFocus: () => void;
  onSelectRelation: (relationId: string) => void;
}

function hopLabel(hop: ImpactRelationView["hop"]): string {
  return hop === "direct" ? "Direkt" : "Indirekt (begrenzt)";
}

function nodeLabel(nodes: GraphCanvasNode[], id: string): string {
  return nodes.find((node) => node.id === id)?.label ?? id;
}

function RelationCard({
  relation,
  nodes,
  selected,
  onSelect,
}: {
  relation: ImpactRelationView;
  nodes: GraphCanvasNode[];
  selected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const tone = atlasKnowledgeTone(relation.knowledgeStatus);
  return (
    <button
      type="button"
      className={`${styles.impactRelationCard} ${selected ? styles.impactRelationCardSelected : ""}`}
      data-testid="impact-relation-card"
      data-hop={relation.hop}
      data-confirmed={relation.confirmed ? "true" : "false"}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className={styles.impactRelationHead}>
        <span className={styles.impactHopBadge} data-hop={relation.hop}>
          {hopLabel(relation.hop)}
        </span>
        <span className={styles.impactMeaning}>{relation.meaning}</span>
      </div>
      <p className={styles.impactRelationPath}>
        {nodeLabel(nodes, relation.sourceConceptId)} → {nodeLabel(nodes, relation.targetConceptId)}
      </p>
      <p className={styles.impactWhy}>{relation.whyItMatters}</p>
      <dl className={styles.impactMeta}>
        <div>
          <dt>KnowledgeStatus</dt>
          <dd data-tone={tone}>
            {atlasKnowledgeStatusLabel(relation.knowledgeStatus)}
            {relation.confirmed ? "" : " — nicht bestätigt"}
          </dd>
        </div>
        <div>
          <dt>Evidence</dt>
          <dd>{relation.evidenceCount}</dd>
        </div>
      </dl>
    </button>
  );
}

export function DependenciesImpactInspector({
  projection,
  nodes,
  selectedNodeId,
  selectedEdgeId,
  onClearFocus,
  onSelectRelation,
}: DependenciesImpactInspectorProps): JSX.Element {
  const selectedNode = selectedNodeId
    ? (nodes.find((node) => node.id === selectedNodeId) ?? null)
    : null;
  const selectedRelation = selectedEdgeId
    ? (projection.relations.find((relation) => relation.id === selectedEdgeId) ?? null)
    : null;

  const related = selectedNodeId
    ? projection.relations.filter(
        (relation) =>
          relation.sourceConceptId === selectedNodeId ||
          relation.targetConceptId === selectedNodeId,
      )
    : projection.relations;

  const direct = related.filter((relation) => relation.hop === "direct");
  const transitive = related.filter((relation) => relation.hop === "transitive");

  if (selectedRelation) {
    return (
      <InspectorPanel
        title={selectedRelation.meaning}
        subtitle={`${hopLabel(selectedRelation.hop)} · ${nodeLabel(nodes, selectedRelation.sourceConceptId)} → ${nodeLabel(nodes, selectedRelation.targetConceptId)}`}
        testId="dependencies-impact-inspector"
        sections={[
          {
            id: "why",
            title: "Warum ist das wichtig?",
            content: <p>{selectedRelation.whyItMatters}</p>,
          },
          {
            id: "status",
            title: "Knowledge-Status",
            content: (
              <p data-tone={atlasKnowledgeTone(selectedRelation.knowledgeStatus)}>
                {atlasKnowledgeStatusLabel(selectedRelation.knowledgeStatus)}
                {selectedRelation.confirmed
                  ? " — belastbare Aussage."
                  : " — nicht als bestätigter Impact formulieren."}
              </p>
            ),
          },
          {
            id: "evidence",
            title: "Evidence",
            content: <p>{selectedRelation.evidenceCount} Beleg(e)</p>,
          },
        ]}
      />
    );
  }

  if (selectedNode) {
    return (
      <InspectorPanel
        title={selectedNode.label}
        subtitle={
          selectedNode.purpose?.trim() ||
          "Produktkonzept — Change Impact der ausgehenden Beziehungen"
        }
        testId="dependencies-impact-inspector"
        badges={
          selectedNode.knowledgeStatus ? (
            <span data-tone={atlasKnowledgeTone(selectedNode.knowledgeStatus)}>
              {atlasKnowledgeStatusLabel(selectedNode.knowledgeStatus)}
            </span>
          ) : null
        }
      >
        {projection.focusConceptId === selectedNode.id ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm mb-2"
            data-testid="impact-clear-focus"
            onClick={onClearFocus}
          >
            Impact-Übersicht
          </button>
        ) : null}
        {projection.partialReason ? (
          <p className={styles.impactPartial} data-testid="impact-partial-reason">
            {projection.partialReason}
          </p>
        ) : null}
        <section className={styles.impactSection}>
          <h3 className={styles.impactSectionTitle}>Direkter Impact</h3>
          {direct.length === 0 ? (
            <p className={styles.impactEmpty}>Keine direkten fachlichen Auswirkungen.</p>
          ) : (
            direct.map((relation) => (
              <RelationCard
                key={relation.id}
                relation={relation}
                nodes={nodes}
                selected={false}
                onSelect={() => onSelectRelation(relation.id)}
              />
            ))
          )}
        </section>
        <section className={styles.impactSection}>
          <h3 className={styles.impactSectionTitle}>Indirekter Impact (begrenzt)</h3>
          {transitive.length === 0 ? (
            <p className={styles.impactEmpty}>Keine begrenzten Folgeauswirkungen.</p>
          ) : (
            transitive.map((relation) => (
              <RelationCard
                key={relation.id}
                relation={relation}
                nodes={nodes}
                selected={false}
                onSelect={() => onSelectRelation(relation.id)}
              />
            ))
          )}
        </section>
      </InspectorPanel>
    );
  }

  return (
    <InspectorPanel
      title="Impact-Karte"
      subtitle="Wenn ich X ändere, was kann betroffen sein?"
      testId="dependencies-impact-inspector"
      emptyMessage={
        projection.nodes.length === 0
          ? "Noch keine Produktkonzepte für Impact ableitbar."
          : "Wähle ein Konzept, um direkten und begrenzten transitiven Impact zu sehen."
      }
    >
      {projection.partialReason ? (
        <p className={styles.impactPartial} data-testid="impact-partial-reason">
          {projection.partialReason}
        </p>
      ) : null}
      {related.slice(0, 8).map((relation) => (
        <RelationCard
          key={relation.id}
          relation={relation}
          nodes={nodes}
          selected={false}
          onSelect={() => onSelectRelation(relation.id)}
        />
      ))}
    </InspectorPanel>
  );
}
