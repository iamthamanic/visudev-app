/**
 * Inspektor for selected architecture node — semantic evidence + graph dependencies (PR-07).
 */

import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { ArchitectureResponsibilityCard } from "../../../../../shared/product-understanding/index.js";
import type { SoftwareGraph, SoftwareGraphNode } from "../../types";
import { formatConfidence } from "../../../../lib/format-confidence.js";
import { atlasKnowledgeStatusLabel, atlasKnowledgeTone } from "../atlas/atlas-knowledge-status.js";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import styles from "../../styles/ArchitectureView.module.css";

const KIND_LABELS: Record<string, string> = {
  domain: "Domain",
  layer: "Layer",
  module: "Module",
  route: "Route",
  service: "Service",
  repository: "Repository",
  table: "Table",
  "business-domain": "Fachdomäne",
  capability: "Capability",
  "technical-module": "Technisches Modul",
  resource: "Ressource",
  "data-store": "Datenspeicher",
};

const RESPONSIBILITIES: Record<string, string[]> = {
  domain: ["Fachlicher Kontext", "Modulgrenzen"],
  layer: ["Schicht-Verantwortung", "Enthaltene Services"],
  module: ["Code-Modul", "Implementierung"],
};

const LAYER_DESCRIPTIONS: Record<string, string> = {
  "experience layer": "UI, Routing und Nutzerinteraktion.",
  "application layer": "Anwendungslogik, Use Cases und Orchestrierung.",
  "domain layer": "Fachdomänen, Entitäten und Geschäftsregeln.",
  "integration layer": "Externe APIs, Adapter und Messaging.",
  "persistence layer": "Datenbanken, Repositories und Speicher.",
  "processing layer": "Hintergrundjobs, Queues und Batch-Verarbeitung.",
  "platform layer": "Infrastruktur, Auth, Observability und Deployment.",
};

interface ArchitectureInspectorProps {
  graph: SoftwareGraph;
  node: SoftwareGraphNode | null;
  semanticEntity?: SemanticEntity | null;
  responsibility?: ArchitectureResponsibilityCard | null;
}

interface ServiceRow {
  id: string;
  label: string;
  kind: string;
  moduleLabel: string;
  count: number;
}

function readDescription(node: SoftwareGraphNode): string {
  const fromMetadata =
    typeof node.metadata?.description === "string" ? node.metadata.description.trim() : "";
  if (fromMetadata.length > 0) return fromMetadata;
  if (node.kind === "layer") {
    return LAYER_DESCRIPTIONS[node.label.trim().toLowerCase()] ?? "Architektur-Ebene im System.";
  }
  return `${KIND_LABELS[node.kind] ?? node.kind}-Knoten im SoftwareGraph.`;
}

function listOutgoingDependencies(graph: SoftwareGraph, nodeId: string): string[] {
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  return edges
    .filter(
      (edge) => edge.sourceId === nodeId && edge.kind !== "contains" && nodeById.has(edge.targetId),
    )
    .map((edge) => {
      const target = nodeById.get(edge.targetId);
      return target ? target.label : edge.targetId;
    });
}

function listIncomingDependencies(graph: SoftwareGraph, nodeId: string): string[] {
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  return edges
    .filter(
      (edge) => edge.targetId === nodeId && edge.kind !== "contains" && nodeById.has(edge.sourceId),
    )
    .map((edge) => {
      const source = nodeById.get(edge.sourceId);
      return source ? source.label : edge.sourceId;
    });
}

function listContainedServices(graph: SoftwareGraph, nodeId: string): ServiceRow[] {
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodeById = new Map(nodes.map((entry) => [entry.id, entry]));

  const rows: ServiceRow[] = [];
  const seenChildIds = new Set<string>();
  const countByLabel = new Map<string, number>();

  for (const edge of edges) {
    if (edge.kind !== "contains" || edge.sourceId !== nodeId) continue;
    const child = nodeById.get(edge.targetId);
    if (!child) continue;
    const labelKey = child.label.trim().toLowerCase();
    countByLabel.set(labelKey, (countByLabel.get(labelKey) ?? 0) + 1);
    if (seenChildIds.has(child.id)) continue;
    seenChildIds.add(child.id);
    rows.push({
      id: child.id,
      label: child.label,
      kind: KIND_LABELS[child.kind] ?? child.kind,
      moduleLabel: child.kind === "module" ? child.label : "—",
      count: 0,
    });
  }

  return rows.map((row) => ({
    ...row,
    count: countByLabel.get(row.label.trim().toLowerCase()) ?? 1,
  }));
}

export function ArchitectureInspector({
  graph,
  node,
  semanticEntity = null,
  responsibility = null,
}: ArchitectureInspectorProps): JSX.Element {
  if (!node && !semanticEntity && !responsibility) {
    return (
      <div data-testid="architecture-inspector">
        <InspectorPanel
          title="Keine Auswahl"
          emptyMessage="Wähle einen Produktbereich oder eine Capability."
        />
      </div>
    );
  }

  if (responsibility) {
    const techNodes = responsibility.technicalRefIds
      .map((id) => graph.nodes.find((entry) => entry.id === id))
      .filter((entry): entry is SoftwareGraphNode => Boolean(entry));
    return (
      <div data-testid="architecture-inspector">
        <InspectorPanel
          title={responsibility.label}
          subtitle={
            responsibility.kind === "product-area"
              ? "Produktbereich"
              : responsibility.kind === "capability"
                ? "Capability"
                : "Application"
          }
          sections={[
            {
              id: "purpose",
              title: "Zweck",
              content: (
                <p className={styles.inspectorDescription} data-testid="architecture-purpose">
                  {responsibility.purpose}
                </p>
              ),
            },
            {
              id: "boundary",
              title: "Grenze",
              content: (
                <p
                  data-testid="architecture-boundary-detail"
                  data-boundary={responsibility.boundary}
                >
                  {responsibility.boundaryLabel}
                  {responsibility.boundary === "distributed"
                    ? " — Implementierung liegt über mehrere Systemteile."
                    : responsibility.boundary === "unclear"
                      ? " — Kein klarer technischer Owner belegt."
                      : " — Primäre technische Zuordnung belegt."}
                </p>
              ),
            },
            {
              id: "technical",
              title: "Technische Umsetzung",
              content:
                techNodes.length > 0 ? (
                  <ul className={styles.checklist} data-testid="architecture-tech-drilldown">
                    {techNodes.map((entry) => (
                      <li key={entry.id}>
                        {KIND_LABELS[entry.kind] ?? entry.kind}: {entry.label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p data-testid="architecture-tech-drilldown-empty">
                    Keine technischen Artefakte zugeordnet.
                  </p>
                ),
            },
          ]}
        />
      </div>
    );
  }

  const title = semanticEntity?.label ?? node?.label ?? "—";
  const subtitle = semanticEntity
    ? (KIND_LABELS[semanticEntity.kind] ?? semanticEntity.kind)
    : (KIND_LABELS[node?.kind ?? ""] ?? node?.kind ?? "—");
  const services = node ? listContainedServices(graph, node.id) : [];
  const outgoing = node ? listOutgoingDependencies(graph, node.id) : [];
  const incoming = node ? listIncomingDependencies(graph, node.id) : [];
  const responsibilities = RESPONSIBILITIES[node?.kind ?? ""] ?? ["Architektur-Knoten"];
  const description = node
    ? readDescription(node)
    : "Semantische Entity aus SemanticSystemModel v2.";
  const tone = semanticEntity ? atlasKnowledgeTone(semanticEntity.knowledgeStatus) : null;

  return (
    <div data-testid="architecture-inspector">
      <InspectorPanel
        title={title}
        subtitle={subtitle}
        sections={[
          {
            id: "description",
            title: "Beschreibung",
            content: <p className={styles.inspectorDescription}>{description}</p>,
          },
          ...(semanticEntity
            ? [
                {
                  id: "semantic",
                  title: "Semantik",
                  content: (
                    <div data-testid="architecture-semantic-evidence">
                      <dl className={styles.semanticDetailList}>
                        <div>
                          <dt>KnowledgeStatus</dt>
                          <dd>
                            <span
                              className={styles.knowledgeBadge}
                              data-tone={tone ?? "weak"}
                              data-status={semanticEntity.knowledgeStatus}
                              data-testid="architecture-knowledge-status"
                            >
                              {atlasKnowledgeStatusLabel(semanticEntity.knowledgeStatus)}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt>Confidence</dt>
                          <dd data-testid="architecture-confidence">
                            {formatConfidence(semanticEntity.confidence) ?? "unbekannt"}
                          </dd>
                        </div>
                      </dl>
                      {semanticEntity.evidence.length > 0 ? (
                        <ul className={styles.checklist} data-testid="architecture-evidence-list">
                          {semanticEntity.evidence.slice(0, 12).map((item) => (
                            <li key={`${item.source}:${item.refId}`}>
                              {item.source}: {item.refId}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={styles.emptyControls}>Keine Evidence-Refs.</p>
                      )}
                    </div>
                  ),
                },
              ]
            : []),
          {
            id: "responsibilities",
            title: "Verantwortlichkeiten",
            content: (
              <ul className={styles.checklist}>
                {responsibilities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          },
          {
            id: "services",
            title: "Enthaltene Services",
            content:
              services.length === 0 ? (
                <p className={styles.emptyControls}>Keine enthaltenen Services.</p>
              ) : (
                <table className={styles.servicesTable}>
                  <thead>
                    <tr>
                      <th scope="col">Service</th>
                      <th scope="col">Modul</th>
                      <th scope="col">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service) => (
                      <tr key={service.id}>
                        <td>{service.label}</td>
                        <td>{service.moduleLabel}</td>
                        <td>{service.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ),
          },
          {
            id: "dependencies",
            title: "Abhängigkeiten",
            content: (
              <div className={styles.dependencyGroups}>
                <div>
                  <p className={styles.dependencyHeading}>
                    <span className={styles.depDotOutgoing} aria-hidden="true" />
                    NUTZT
                  </p>
                  {outgoing.length === 0 ? (
                    <p className={styles.emptyControls}>Keine ausgehenden Abhängigkeiten.</p>
                  ) : (
                    <ul className={styles.checklist}>
                      {outgoing.map((dependency) => (
                        <li key={`out:${dependency}`}>{dependency}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <p className={styles.dependencyHeading}>
                    <span className={styles.depDotIncoming} aria-hidden="true" />
                    WIRD GENUTZT VON
                  </p>
                  {incoming.length === 0 ? (
                    <p className={styles.emptyControls}>Keine eingehenden Abhängigkeiten.</p>
                  ) : (
                    <ul className={styles.checklist}>
                      {incoming.map((dependency) => (
                        <li key={`in:${dependency}`}>{dependency}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
