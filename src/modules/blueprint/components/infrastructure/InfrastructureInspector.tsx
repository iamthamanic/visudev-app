/**
 * Inspektor for InfrastructureView with overview, resource meters, and connections.
 */

import type { GraphCanvasEdge, GraphCanvasNode, SoftwareGraphNode } from "../../types";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import { StatusBadge } from "../ui/StatusBadge.js";
import { InfrastructureResourceMeters } from "./InfrastructureResourceMeters.js";
import { resourceMetersFromMetadata } from "./infrastructure-resource-meters.js";
import { ControlHint } from "../../../../components/ui/ControlHint.js";
import styles from "../../styles/InfrastructureView.module.css";

const KIND_LABELS: Record<string, string> = {
  runtime: "Laufzeit",
  service: "API Service",
  external: "External Service",
  table: "Datenbank",
  file: "Web App",
  route: "Route",
};

interface ConnectionEndpoint {
  edgeId: string;
  label: string;
}

function overviewFromGraphNode(graphNode: SoftwareGraphNode | null) {
  const metadata = graphNode?.metadata ?? {};
  const portValue = metadata.port;
  const portsValue = metadata.ports;
  const frameworkValue = metadata.framework;
  const instancesValue = metadata.instances;
  const portFromList =
    typeof portsValue === "string" && portsValue.trim() ? portsValue.trim() : null;

  return {
    port:
      typeof portValue === "number" || typeof portValue === "string"
        ? String(portValue)
        : portFromList,
    instances: typeof instancesValue === "string" ? instancesValue : null,
    version: typeof frameworkValue === "string" ? frameworkValue : null,
  };
}

function connectionEndpoints(
  nodeId: string,
  edges: GraphCanvasEdge[],
  nodes: GraphCanvasNode[],
): { incoming: ConnectionEndpoint[]; outgoing: ConnectionEndpoint[] } {
  const labelById = new Map(nodes.map((node) => [node.id, node.label]));
  const incoming = edges
    .filter((edge) => edge.target === nodeId)
    .map((edge) => ({
      edgeId: edge.id,
      label: labelById.get(edge.source) ?? edge.source,
    }));
  const outgoing = edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => ({
      edgeId: edge.id,
      label: labelById.get(edge.target) ?? edge.target,
    }));
  return { incoming, outgoing };
}

export interface InfrastructureInspectorProps {
  node: GraphCanvasNode | null;
  graphNode?: SoftwareGraphNode | null;
  edges?: GraphCanvasEdge[];
  nodes?: GraphCanvasNode[];
}

export function InfrastructureInspector({
  node,
  graphNode = null,
  edges = [],
  nodes = [],
}: InfrastructureInspectorProps): JSX.Element {
  if (!node) {
    return (
      <InspectorPanel
        title="Keine Auswahl"
        emptyMessage="Wähle einen Service, um Status und Ressourcen zu sehen."
      />
    );
  }

  const kindLabel = KIND_LABELS[node.kind] ?? node.kind;
  const overview = overviewFromGraphNode(graphNode);
  const meterValues = resourceMetersFromMetadata(graphNode?.metadata);
  const connections = connectionEndpoints(node.id, edges, nodes);

  const overviewRows: Array<{ term: string; value: string | null }> = [
    { term: "Port", value: overview.port },
    { term: "Instanzen", value: overview.instances },
    { term: "Version", value: overview.version },
  ].filter((row): row is { term: string; value: string } => row.value != null);

  return (
    <InspectorPanel
      title={node.label}
      subtitle={kindLabel}
      badges={<StatusBadge variant="running" label="RUNNING" />}
      sections={[
        {
          id: "overview",
          title: "Übersicht",
          content:
            overviewRows.length > 0 ? (
              <dl className={styles.overviewList}>
                {overviewRows.map((row) => (
                  <div className={styles.overviewRow} key={row.term}>
                    <dt>{row.term}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className={styles.emptyControls} data-testid="infra-overview-empty">
                Keine Laufzeit-Metadaten — gesucht nach Port, Instanzen, Version. Nichts davon liegt
                im aktuellen Scan.
              </p>
            ),
        },
        {
          id: "resources",
          title: "Ressourcen",
          content: meterValues ? (
            <InfrastructureResourceMeters values={meterValues} />
          ) : (
            <p className={styles.emptyControls} data-testid="infra-runtime-empty">
              Laufzeitdaten unbekannt — gesucht nach Runtime-Telemetrie (CPU, RAM, Netzwerk). Nichts
              davon liegt im aktuellen Scan.
            </p>
          ),
        },
        {
          id: "connections",
          title: "Verbindungen",
          content: (
            <div className={styles.connectionGroups}>
              <div>
                <p className={styles.connectionHeading}>Eingehend</p>
                {connections.incoming.length > 0 ? (
                  <ul className={styles.connectionList}>
                    {connections.incoming.map((endpoint) => (
                      <li key={`in-${endpoint.edgeId}`}>{endpoint.label}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyControls}>Keine eingehenden Verbindungen.</p>
                )}
              </div>
              <div>
                <p className={styles.connectionHeading}>Ausgehend</p>
                {connections.outgoing.length > 0 ? (
                  <ul className={styles.connectionList}>
                    {connections.outgoing.map((endpoint) => (
                      <li key={`out-${endpoint.edgeId}`}>{endpoint.label}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyControls}>Keine ausgehenden Verbindungen.</p>
                )}
              </div>
            </div>
          ),
        },
      ]}
    >
      <ControlHint reason="Öffnen-Integration (VS Code / VisuCODE) folgt.">
        <button type="button" className={styles.logsButton} disabled aria-disabled="true">
          Logs anzeigen
        </button>
      </ControlHint>
    </InspectorPanel>
  );
}
