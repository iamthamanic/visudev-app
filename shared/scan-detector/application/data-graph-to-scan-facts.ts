/**
 * Bridge DataGraph → ScanFact / ScanEvidence (SDE-12).
 * Location: shared/scan-detector/application/data-graph-to-scan-facts.ts
 */

import type { DataGraph } from "../../data-graph.types.js";
import type { ScanEvidence, ScanFact, ScanKnowledgeStatus } from "../types.js";
import { redactEvidence, redactFact } from "../domain/evidence/redact.js";

export interface DataGraphFactBundle {
  facts: ScanFact[];
  evidence: ScanEvidence[];
}

function toStatus(status: string): ScanKnowledgeStatus {
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

export function dataGraphToScanFacts(
  graph: DataGraph,
  detectorId = "schema-data-detector-v1",
): DataGraphFactBundle {
  const facts: ScanFact[] = [];
  const evidence: ScanEvidence[] = [];

  for (const item of graph.evidence) {
    evidence.push(
      redactEvidence({
        id: item.id,
        kind: item.kind,
        status: toStatus(item.status),
        confidence: item.confidence,
        provenance: {
          originKind:
            item.origin === "live" || item.origin === "migration"
              ? "data"
              : item.origin === "heuristic"
                ? "heuristic"
                : item.origin === "merged"
                  ? "merged"
                  : "static",
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

  for (const table of graph.tables) {
    facts.push(
      redactFact({
        id: `fact:data-table:${table.id}`,
        kind: "data-table:entity",
        status: toStatus(table.status),
        confidence: table.confidence,
        provenance: { originKind: "data", detectorId },
        subjectId: table.id,
        evidenceIds: [...table.evidenceIds],
        attributes: {
          label: table.label,
          name: table.name,
          schemaId: table.schemaId,
          provenance: table.provenance,
        },
      }),
    );
  }

  for (const column of graph.columns) {
    facts.push(
      redactFact({
        id: `fact:data-column:${column.id}`,
        kind: "data-table:column",
        status: toStatus(column.status),
        confidence: column.confidence,
        provenance: { originKind: "data", detectorId },
        subjectId: column.id,
        objectId: column.tableId,
        evidenceIds: [...column.evidenceIds],
        attributes: {
          name: column.name,
          dataType: column.dataType ?? null,
          nullable: column.nullable ?? null,
        },
      }),
    );
  }

  for (const relation of graph.relations) {
    facts.push(
      redactFact({
        id: `fact:data-relation:${relation.id}`,
        kind: "data-relation:fk",
        status: toStatus(relation.status),
        confidence: relation.confidence,
        provenance: { originKind: "data", detectorId },
        subjectId: relation.fromTableId,
        objectId: relation.toTableId,
        evidenceIds: [...relation.evidenceIds],
        attributes: {
          fromColumn: relation.fromColumn ?? null,
          toColumn: relation.toColumn ?? null,
        },
      }),
    );
  }

  for (const policy of graph.policies) {
    facts.push(
      redactFact({
        id: `fact:data-policy:${policy.id}`,
        kind: "data-table:policy",
        status: toStatus(policy.status),
        confidence: policy.confidence,
        provenance: { originKind: "data", detectorId },
        subjectId: policy.id,
        objectId: policy.tableId,
        evidenceIds: [...policy.evidenceIds],
        attributes: {
          name: policy.name,
          hasExpression: policy.hasExpression,
        },
      }),
    );
  }

  return { facts, evidence };
}
