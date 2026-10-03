/**
 * Bridge UIInteractionGraph → ScanFact/ScanEvidence (SDE-10).
 * Location: shared/scan-detector/application/ui-graph-to-scan-facts.ts
 */

import type { UiInteractionGraph } from "../../ui-interaction-graph.types.js";
import type { ScanEvidence, ScanFact, ScanKnowledgeStatus } from "../types.js";
import { redactEvidence, redactFact } from "../domain/evidence/redact.js";

export interface UiGraphFactBundle {
  facts: ScanFact[];
  evidence: ScanEvidence[];
}

function toScanStatus(status: string): ScanKnowledgeStatus {
  if (
    status === "detected" ||
    status === "inferred" ||
    status === "observed" ||
    status === "verified" ||
    status === "conflicted" ||
    status === "unknown"
  ) {
    return status;
  }
  return "unknown";
}

export function uiGraphToScanFacts(
  graph: UiInteractionGraph,
  detectorId = "web-ui-interaction-graph-v1",
): UiGraphFactBundle {
  const facts: ScanFact[] = [];
  const evidence: ScanEvidence[] = [];

  for (const item of graph.evidence) {
    evidence.push(
      redactEvidence({
        id: item.id,
        kind: item.kind,
        status: toScanStatus(item.status),
        confidence: item.confidence,
        provenance: {
          originKind: item.origin === "merged" ? "merged" : item.origin,
          detectorId,
        },
        payload: {
          summary: item.summary,
          filePath: item.filePath,
          line: item.line,
          attributes: item.attributes,
        },
      }),
    );
  }

  for (const surface of graph.surfaces) {
    facts.push(
      redactFact({
        id: `fact:ui:surface:${surface.id}`,
        kind: `ui.surface.${surface.kind}`,
        status: toScanStatus(surface.status),
        confidence: surface.confidence,
        provenance: {
          originKind: surface.attributes?.runtimeOnly === true ? "runtime" : "heuristic",
          detectorId,
        },
        subjectId: surface.id,
        evidenceIds: [...surface.evidenceIds],
        attributes: {
          label: surface.label,
          path: surface.path ?? null,
          stateKey: surface.stateKey ?? null,
          parentSurfaceId: surface.parentSurfaceId ?? null,
          runtimeOnly: surface.attributes?.runtimeOnly === true,
        },
      }),
    );
  }

  for (const transition of graph.transitions) {
    facts.push(
      redactFact({
        id: `fact:ui:transition:${transition.id}`,
        kind: `ui.transition.${transition.kind}`,
        status: toScanStatus(transition.status),
        confidence: transition.confidence,
        provenance: {
          originKind: "heuristic",
          detectorId,
        },
        subjectId: transition.fromSurfaceId,
        objectId: transition.toSurfaceId,
        evidenceIds: [...transition.evidenceIds],
        attributes: {
          transitionKind: transition.kind,
          targetPath: transition.targetPath ?? null,
        },
      }),
    );
  }

  return { facts, evidence };
}
