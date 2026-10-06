/**
 * Shared Product Concept explanation presenter (PU-04 / #425).
 * Three disclosure levels from ProductUnderstandingModel — no React, no inference.
 * Location: shared/product-understanding/explanation-presenter.ts
 */

import {
  isAuthoritativeKnowledgeStatus,
  type KnowledgeStatus,
} from "../scan-detector/epistemic.js";
import type {
  ProductConcept,
  ProductConceptKind,
  ProductEvidenceRef,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";

export interface ExplanationBlock {
  title: string;
  body: string;
}

export interface ProductConceptExplanationView {
  conceptId: string;
  label: string;
  kind: ProductConceptKind;
  knowledgeStatus: KnowledgeStatus;
  /** Honest German status label — never implies confirmed for weak statuses. */
  statusLabel: string;
  /** True only for VERIFIED / SUPPORTED. */
  isConfirmed: boolean;
  /** Level 1 — Was ist das? */
  level1: ExplanationBlock;
  /** Level 2 — Wie hängt es zusammen? */
  level2: ExplanationBlock;
  /** Level 3 — Technische Evidence */
  level3: ExplanationBlock & { evidence: ProductEvidenceRef[] };
  whyItMatters: string;
  impactSummary: string;
}

const KIND_LABEL_DE: Record<ProductConceptKind, string> = {
  application: "Anwendung",
  "product-area": "Produktbereich",
  capability: "Fähigkeit",
  information: "Information",
  "system-part": "Systemteil",
  "external-system": "Externes System",
  "user-action": "Benutzeraktion",
  unknown: "Unbekanntes Konzept",
};

export function knowledgeStatusLabelDe(status: KnowledgeStatus): string {
  switch (status) {
    case "VERIFIED":
      return "Bestätigt";
    case "SUPPORTED":
      return "Gestützt";
    case "INTERPRETED":
      return "Interpretiert (nicht bestätigt)";
    case "UNKNOWN":
      return "Ungeklärt";
    case "CONFLICTED":
      return "Widersprüchlich";
    default:
      return "Ungeklärt";
  }
}

function hedge(status: KnowledgeStatus, confirmedPhrase: string, openPhrase: string): string {
  return isAuthoritativeKnowledgeStatus(status) ? confirmedPhrase : openPhrase;
}

function findConcept(
  model: ProductUnderstandingModel,
  conceptId: string,
): ProductConcept | undefined {
  return model.concepts.find((concept) => concept.id === conceptId);
}

function levelTextFromModel(
  model: ProductUnderstandingModel,
  conceptId: string,
  level: "product" | "system" | "evidence",
): string | null {
  const match = model.explanations.find(
    (entry) => entry.conceptId === conceptId && entry.level === level,
  );
  return match?.text?.trim() || null;
}

function relatedLabels(model: ProductUnderstandingModel, conceptId: string): string[] {
  const labels: string[] = [];
  for (const relation of model.relations) {
    if (relation.sourceConceptId === conceptId) {
      const target = findConcept(model, relation.targetConceptId);
      if (target) labels.push(`${relation.kind} → ${target.label}`);
    }
    if (relation.targetConceptId === conceptId) {
      const source = findConcept(model, relation.sourceConceptId);
      if (source) labels.push(`${relation.kind} ← ${source.label}`);
    }
  }
  return labels;
}

function impactLines(model: ProductUnderstandingModel, conceptId: string): string[] {
  return model.impacts
    .filter((impact) => impact.fromConceptId === conceptId || impact.toConceptId === conceptId)
    .map((impact) => impact.summary.trim())
    .filter(Boolean);
}

/**
 * Present Level 1/2/3 explanations for a Product Concept.
 * Does not invent business meaning beyond model fields + hedge language.
 */
export function presentProductConceptExplanation(
  model: ProductUnderstandingModel,
  conceptId: string,
): ProductConceptExplanationView | null {
  const concept = findConcept(model, conceptId);
  if (!concept) return null;

  const kindLabel = KIND_LABEL_DE[concept.kind];
  const statusLabel = knowledgeStatusLabelDe(concept.knowledgeStatus);
  const isConfirmed = isAuthoritativeKnowledgeStatus(concept.knowledgeStatus);

  const level1FromModel = levelTextFromModel(model, conceptId, "product");
  const level2FromModel = levelTextFromModel(model, conceptId, "system");
  const level3FromModel = levelTextFromModel(model, conceptId, "evidence");

  const summary = concept.summary?.trim();
  const level1Body =
    level1FromModel ||
    hedge(
      concept.knowledgeStatus,
      `${kindLabel} „${concept.label}“${summary ? `: ${summary}` : "."}`,
      `${kindLabel} „${concept.label}“ — Status: ${statusLabel}.${summary ? ` Hinweis: ${summary}` : " Fachliche Bedeutung ist noch nicht bestätigt."}`,
    );

  const related = relatedLabels(model, conceptId);
  const level2Body =
    level2FromModel ||
    (related.length > 0
      ? hedge(
          concept.knowledgeStatus,
          `Zusammenhänge: ${related.join("; ")}.`,
          `Mögliche Zusammenhänge (nicht bestätigt): ${related.join("; ")}.`,
        )
      : hedge(
          concept.knowledgeStatus,
          "Keine dokumentierten Produktbeziehungen.",
          "Noch keine belastbaren Produktbeziehungen bekannt.",
        ));

  const evidence = concept.evidence.slice();
  const evidenceLines = evidence.map((item) => {
    const summaryText = item.summary?.trim();
    return summaryText
      ? `${item.source} · ${item.refId} — ${summaryText}`
      : `${item.source} · ${item.refId}`;
  });
  const level3Body =
    level3FromModel ||
    (evidenceLines.length > 0
      ? evidenceLines.join("\n")
      : "Keine technische Evidence referenziert.");

  const impacts = impactLines(model, conceptId);
  const impactSummary =
    impacts.length > 0
      ? hedge(
          concept.knowledgeStatus,
          impacts.join(" "),
          `Mögliche Auswirkungen (nicht bestätigt): ${impacts.join(" ")}`,
        )
      : hedge(
          concept.knowledgeStatus,
          "Keine Impact-Hinweise hinterlegt.",
          "Impact noch ungeklärt.",
        );

  const whyItMatters = hedge(
    concept.knowledgeStatus,
    `Relevant als ${kindLabel.toLowerCase()} im Produktverständnis.`,
    `Könnte als ${kindLabel.toLowerCase()} relevant sein — ${statusLabel}.`,
  );

  return {
    conceptId: concept.id,
    label: concept.label,
    kind: concept.kind,
    knowledgeStatus: concept.knowledgeStatus,
    statusLabel,
    isConfirmed,
    level1: { title: "Was ist das?", body: level1Body },
    level2: { title: "Wie hängt es zusammen?", body: level2Body },
    level3: { title: "Technische Evidence", body: level3Body, evidence },
    whyItMatters,
    impactSummary,
  };
}
