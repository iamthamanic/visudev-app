/**
 * Sequence/execution strip from execution groups — prefers observed edges when present.
 * Location: src/modules/blueprint/components/execution/ExecutionSequenceStrip.tsx
 */

import type { SoftwareGraph } from "../../types";
import { projectSequenceSteps } from "./execution-sequence-projection.js";

export interface ExecutionSequenceStripProps {
  graph: SoftwareGraph | null | undefined;
  routeNodeId?: string | null;
}

export function ExecutionSequenceStrip({
  graph,
  routeNodeId,
}: ExecutionSequenceStripProps): JSX.Element {
  const steps = projectSequenceSteps(graph, routeNodeId);
  if (steps.length === 0) {
    return (
      <p data-testid="execution-sequence-empty" role="status">
        Keine Sequenz — Execution-Gruppen fehlen oder sind leer.
      </p>
    );
  }
  return (
    <ol
      data-testid="execution-sequence"
      style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", listStyle: "none", padding: 0 }}
    >
      {steps.map((step, index) => (
        <li key={step.id} style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {index > 0 ? <span aria-hidden="true">→</span> : null}
          <span
            className={`badge ${step.observed ? "badge-success" : "badge-ghost"}`}
            title={step.observed ? "beobachtet" : "statisch"}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
