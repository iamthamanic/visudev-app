/** Figma service card; left-border color maps graph node kind to runtime accent tokens. */

import type { GraphCanvasNode, SoftwareGraphNode } from "../../types";
import { StatusBadge } from "../ui/StatusBadge.js";
import { resolveInfrastructureRuntimeStatus } from "./infrastructure-entities.js";
import styles from "../../styles/InfrastructureView.module.css";

const KIND_LABELS: Record<string, string> = {
  runtime: "Laufzeit",
  service: "Deployment Service",
  external: "External System",
  table: "Datastore",
  repository: "Datastore",
};

export interface InfrastructureServiceCardProps {
  node: GraphCanvasNode;
  graphNode?: SoftwareGraphNode | null;
  selected: boolean;
  onSelect: () => void;
}

export function InfrastructureServiceCard({
  node,
  graphNode = null,
  selected,
  onSelect,
}: InfrastructureServiceCardProps): JSX.Element {
  const kindLabel = KIND_LABELS[node.kind] ?? node.kind;
  const status = resolveInfrastructureRuntimeStatus(graphNode);

  return (
    <button
      type="button"
      className={styles.serviceCard}
      data-selected={selected ? "true" : "false"}
      data-kind={node.kind}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className={styles.serviceCardHeader}>
        <span className={styles.serviceCardTitle}>{node.label}</span>
        <StatusBadge variant={status.variant} label={status.label} />
      </span>
      <span className={styles.serviceCardMeta}>{kindLabel}</span>
    </button>
  );
}
