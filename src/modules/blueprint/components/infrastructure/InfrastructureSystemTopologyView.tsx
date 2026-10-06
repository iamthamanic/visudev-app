/**
 * Purpose-first infrastructure system topology canvas (PU-12).
 * Location: src/modules/blueprint/components/infrastructure/InfrastructureSystemTopologyView.tsx
 */

import type {
  SystemTopologyConnection,
  SystemTopologyPart,
} from "../../../../../shared/product-understanding/index.js";
import { knowledgeStatusLabelDe } from "../../../../../shared/product-understanding/index.js";
import styles from "../../styles/InfrastructureView.module.css";

const STATUS_TONE: Record<string, "strong" | "weak" | "conflict"> = {
  VERIFIED: "strong",
  SUPPORTED: "strong",
  INTERPRETED: "weak",
  UNKNOWN: "weak",
  CONFLICTED: "conflict",
};

export interface InfrastructureSystemTopologyViewProps {
  parts: SystemTopologyPart[];
  connections: SystemTopologyConnection[];
  selectedId: string | null;
  partialReason: string | null;
  onSelect: (partId: string) => void;
  onOpenTechnik: () => void;
}

function connectionsFor(
  partId: string,
  connections: SystemTopologyConnection[],
  partsById: Map<string, SystemTopologyPart>,
): Array<{ meaning: string; otherLabel: string; direction: "out" | "in" }> {
  const rows: Array<{ meaning: string; otherLabel: string; direction: "out" | "in" }> = [];
  for (const connection of connections) {
    if (connection.sourcePartId === partId) {
      rows.push({
        meaning: connection.meaning,
        otherLabel: partsById.get(connection.targetPartId)?.label ?? connection.targetPartId,
        direction: "out",
      });
    } else if (connection.targetPartId === partId) {
      rows.push({
        meaning: connection.meaning,
        otherLabel: partsById.get(connection.sourcePartId)?.label ?? connection.sourcePartId,
        direction: "in",
      });
    }
  }
  return rows;
}

export function InfrastructureSystemTopologyView({
  parts,
  connections,
  selectedId,
  partialReason,
  onSelect,
  onOpenTechnik,
}: InfrastructureSystemTopologyViewProps): JSX.Element {
  const partsById = new Map(parts.map((part) => [part.id, part]));
  const selected = parts.find((part) => part.id === selectedId) ?? null;
  const selectedLinks = selected ? connectionsFor(selected.id, connections, partsById) : [];

  if (parts.length === 0) {
    return (
      <div className={styles.systemEmpty} data-testid="infra-system-empty">
        <p>
          Noch keine verständliche Systemtopologie ableitbar. Technische Runtime-/Deployment-Ansicht
          bleibt unter „Technik“ verfügbar.
        </p>
        {partialReason ? <p>{partialReason}</p> : null}
        <button type="button" className={styles.layerTab} onClick={onOpenTechnik}>
          Technik öffnen
        </button>
      </div>
    );
  }

  return (
    <div className={styles.systemLayout} data-testid="infra-system-topology">
      {partialReason ? (
        <p className={styles.systemPartial} data-testid="infra-system-partial" role="status">
          {partialReason}
        </p>
      ) : null}

      <div className={styles.systemGrid}>
        {parts.map((part) => (
          <button
            key={part.id}
            type="button"
            className={styles.systemCard}
            data-testid="infra-system-part"
            data-role={part.role}
            data-confirmed={part.confirmed ? "true" : "false"}
            data-selected={selectedId === part.id ? "true" : "false"}
            aria-pressed={selectedId === part.id}
            onClick={() => onSelect(part.id)}
          >
            <span className={styles.systemRole}>{part.roleLabel}</span>
            <strong className={styles.systemTitle}>{part.label}</strong>
            <span className={styles.systemPurpose}>{part.purpose}</span>
            <span data-tone={STATUS_TONE[part.knowledgeStatus] ?? "weak"}>
              {knowledgeStatusLabelDe(part.knowledgeStatus)}
              {part.confirmed ? "" : " — nicht bestätigt"}
            </span>
          </button>
        ))}
      </div>

      {selected ? (
        <aside
          className={styles.systemDetail}
          data-testid="infra-system-detail"
          aria-label={`Systemteil: ${selected.label}`}
        >
          <h2 className={styles.systemDetailTitle}>{selected.label}</h2>
          <p className={styles.systemPurpose}>{selected.purpose}</p>
          <p className={styles.topologyMeta}>
            Rolle: {selected.roleLabel} · Evidence: {selected.evidenceCount}
          </p>

          <h3 className={styles.systemDetailSubtitle}>Verbindungen</h3>
          {selectedLinks.length === 0 ? (
            <p className={styles.topologyMeta}>
              Keine belegten Verbindungen für dieses Systemteil.
            </p>
          ) : (
            <ul className={styles.systemLinkList}>
              {selectedLinks.map((link, index) => (
                <li key={`${link.direction}-${link.otherLabel}-${index}`}>
                  <strong>{link.meaning}</strong>
                  <span>
                    {link.direction === "out" ? " → " : " ← "}
                    {link.otherLabel}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className={styles.systemDetailSubtitle}>Technik (bei Evidence)</h3>
          {selected.technical ? (
            <ul className={styles.systemTechList} data-testid="infra-system-tech">
              {selected.technical.runtime ? <li>Runtime: {selected.technical.runtime}</li> : null}
              {selected.technical.provider ? (
                <li>Provider: {selected.technical.provider}</li>
              ) : null}
              {selected.technical.region ? <li>Region: {selected.technical.region}</li> : null}
              {selected.technical.env ? <li>Env: {selected.technical.env}</li> : null}
            </ul>
          ) : (
            <p className={styles.topologyMeta} data-testid="infra-system-tech-absent">
              Keine Runtime-/Provider-/Region-Evidence (ABSENT).
            </p>
          )}

          <button type="button" className={styles.layerTab} onClick={onOpenTechnik}>
            Zur technischen Topologie
          </button>
        </aside>
      ) : null}
    </div>
  );
}
