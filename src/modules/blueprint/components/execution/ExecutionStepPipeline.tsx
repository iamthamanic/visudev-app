/**
 * Horizontal StepCard pipeline with dotted connectors for ExecutionView.
 */

import type { StepTiming } from "./_projection.js";
import { observationLabel, type ExecutionObservationClass } from "./execution-observation.js";
import { StepCard } from "../ui/StepCard.js";
import type { StatusBadgeVariant } from "../ui/StatusBadge.js";
import type { SoftwareGraphNodeKind } from "../../types";
import styles from "../../styles/ExecutionView.module.css";

const STEP_KIND_LABELS: Partial<Record<SoftwareGraphNodeKind, string>> = {
  route: "Route",
  file: "Handler",
  service: "Service",
  repository: "Repository",
  table: "Database",
  external: "External",
};

export interface ExecutionStepPipelineProps {
  stepNodeIds: string[];
  stepLabels: Map<string, string>;
  stepKinds: Map<string, SoftwareGraphNodeKind>;
  stepTimings: StepTiming[];
  stepObservations: Map<string, ExecutionObservationClass>;
  selectedStepId: string | null;
  stepHasEvidence: Map<string, boolean>;
  cycleNodeId: string | null;
  onSelectStep: (nodeId: string) => void;
}

function resolveStatus(
  hasEvidence: boolean,
  isCycle: boolean,
  hasTiming: boolean,
  observation: ExecutionObservationClass,
): StatusBadgeVariant {
  if (isCycle) return "unknown";
  if (observation === "CONFLICTED") return "unknown";
  return hasEvidence || hasTiming ? "confirmed" : "missing";
}

export function ExecutionStepPipeline({
  stepNodeIds,
  stepLabels,
  stepKinds,
  stepTimings,
  stepObservations,
  selectedStepId,
  stepHasEvidence,
  cycleNodeId,
  onSelectStep,
}: ExecutionStepPipelineProps): JSX.Element {
  if (stepNodeIds.length === 0) {
    return <p className={styles.emptyControls}>Keine Ausführungsschritte für diese Route.</p>;
  }

  const durationByNodeId = new Map(stepTimings.map((timing) => [timing.nodeId, timing.durationMs]));

  return (
    <div className={styles.pipeline} aria-label="Ausführungs-Pipeline">
      {stepNodeIds.map((nodeId, index) => {
        const kind = stepKinds.get(nodeId) ?? "file";
        const kindLabel = STEP_KIND_LABELS[kind] ?? kind;
        const observation = stepObservations.get(nodeId) ?? "STATIC_MODEL";
        const observationText = observationLabel(observation);
        const isCycle = cycleNodeId === nodeId;
        const hasEvidence = stepHasEvidence.get(nodeId) ?? false;
        const durationMs = durationByNodeId.get(nodeId);
        const hasTiming =
          typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0;
        const subtitle = isCycle
          ? `${kindLabel} · Zyklus · ${observationText}`
          : `${kindLabel} · ${observationText}`;

        return (
          <div key={nodeId} className={styles.pipelineItem}>
            {index > 0 ? <span className={styles.pipelineConnector} aria-hidden="true" /> : null}
            <StepCard
              stepNumber={index + 1}
              title={stepLabels.get(nodeId) ?? nodeId}
              subtitle={subtitle}
              durationMs={durationMs}
              status={resolveStatus(hasEvidence, isCycle, hasTiming, observation)}
              selected={selectedStepId === nodeId}
              testId="execution-step-card"
              dataObservation={observation}
              onSelect={() => onSelectStep(nodeId)}
            />
          </div>
        );
      })}
    </div>
  );
}
