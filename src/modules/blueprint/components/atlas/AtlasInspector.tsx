/**
 * Right-hand Inspektor for AtlasView with sub-tabbed semantic/evidence details.
 */

import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import { atlasClusterProfile } from "./atlas-cluster-profiles.js";
import { atlasKindLabel } from "./atlas-display.js";
import { AtlasInspectorTabs } from "./AtlasInspectorTabs.js";

export interface AtlasInspectorProps {
  graph: SoftwareGraph;
  semanticEntity?: SemanticEntity | null;
  node: SoftwareGraphNode | null;
  cluster: SoftwareGraphGroup | null;
}

const SEMANTIC_KIND_LABELS: Record<SemanticEntity["kind"], string> = {
  application: "Anwendung",
  "business-domain": "Fachdomäne",
  service: "Service",
  component: "Komponente",
  "data-store": "Datenspeicher",
  "external-system": "Externes System",
  "use-case": "Use Case",
  "deployment-unit": "Deployment",
  "execution-flow": "Execution Flow",
};

export function AtlasInspector({
  graph,
  semanticEntity = null,
  node,
  cluster,
}: AtlasInspectorProps): JSX.Element {
  if (!semanticEntity && !node && !cluster) {
    return (
      <InspectorPanel
        title="Keine Auswahl"
        emptyMessage="Wähle einen Knoten oder Cluster, um Übersicht und Abhängigkeiten zu sehen."
      />
    );
  }

  const title = cluster?.label ?? semanticEntity?.label ?? node?.label ?? "—";
  const profile = atlasClusterProfile(title);
  const subtitle = cluster
    ? profile.stack
    : semanticEntity
      ? SEMANTIC_KIND_LABELS[semanticEntity.kind]
      : atlasKindLabel(node?.kind ?? "—");

  return (
    <InspectorPanel title={title} subtitle={subtitle} testId="atlas-inspector">
      <AtlasInspectorTabs graph={graph} node={node} cluster={cluster} />
    </InspectorPanel>
  );
}
