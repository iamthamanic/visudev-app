/**
 * Architecture responsibility projection from ProductUnderstandingModel (PU-08).
 * Primary layer: Application → Product Area → Capability with boundary clarity.
 * Technical modules/services appear only as implementation refs (drill-down).
 * Location: shared/product-understanding/project-architecture-responsibilities.ts
 */

import { isStructuralDomainName } from "../semantic-domain-inference.js";
import type {
  ProductConcept,
  ProductConceptKind,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import { presentProductConceptExplanation } from "./explanation-presenter.js";

export type ArchitectureBoundaryState = "clear" | "distributed" | "unclear";

export interface ArchitectureResponsibilityCard {
  id: string;
  kind: ProductConceptKind;
  label: string;
  purpose: string;
  knowledgeStatus: ProductConcept["knowledgeStatus"];
  boundary: ArchitectureBoundaryState;
  boundaryLabel: string;
  parentId: string | null;
  technicalRefIds: string[];
  childIds: string[];
}

export interface ArchitectureResponsibilityProjection {
  cards: ArchitectureResponsibilityCard[];
  /** Product-area cards shown by default (density-reduced). */
  primaryAreaIds: string[];
  applications: ArchitectureResponsibilityCard[];
  partial: boolean;
  partialReason: string | null;
}

const PRIMARY_KINDS = new Set<ProductConceptKind>(["application", "product-area", "capability"]);

const BOUNDARY_LABEL: Record<ArchitectureBoundaryState, string> = {
  clear: "Grenze klar",
  distributed: "Verantwortung verteilt",
  unclear: "Grenze unklar",
};

function isProductFacingLabel(label: string): boolean {
  const slug = label
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return Boolean(slug) && !isStructuralDomainName(slug);
}

function purposeFor(model: ProductUnderstandingModel, concept: ProductConcept): string {
  if (concept.summary?.trim()) return concept.summary.trim().slice(0, 180);
  const view = presentProductConceptExplanation(model, concept.id);
  if (view?.level1?.body) return view.level1.body.slice(0, 180);
  return `${concept.label} — Verantwortung noch nicht belegt.`;
}

function technicalRefs(concept: ProductConcept): string[] {
  const fromTechnical = (concept.technicalRefs ?? [])
    .filter((ref) => ref.source === "software-graph")
    .map((ref) => ref.refId);
  if (fromTechnical.length > 0) return [...new Set(fromTechnical)];
  // Fall back to software-graph evidence only — semantic-only refs do not prove an owner.
  const fromEvidence = concept.evidence
    .filter((ref) => ref.source === "software-graph")
    .map((ref) => ref.refId);
  return [...new Set(fromEvidence)];
}

function boundaryFor(concept: ProductConcept, relatedTechCount: number): ArchitectureBoundaryState {
  if (concept.kind === "application" || concept.kind === "product-area") {
    return relatedTechCount >= 1 ? "clear" : "unclear";
  }
  if (relatedTechCount === 0) return "unclear";
  if (relatedTechCount >= 3) return "distributed";
  return "clear";
}

function childrenOf(
  model: ProductUnderstandingModel,
  parentId: string,
  kinds: readonly ProductConceptKind[],
): string[] {
  const kindSet = new Set(kinds);
  const ids = new Set<string>();
  for (const relation of model.relations) {
    if (relation.sourceConceptId === parentId) {
      const target = model.concepts.find((concept) => concept.id === relation.targetConceptId);
      if (target && kindSet.has(target.kind)) ids.add(target.id);
    }
    if (relation.targetConceptId === parentId) {
      const source = model.concepts.find((concept) => concept.id === relation.sourceConceptId);
      if (source && kindSet.has(source.kind)) ids.add(source.id);
    }
  }
  return [...ids].sort();
}

/**
 * Project Product Understanding into Architecture responsibility cards.
 * Empty / structural-only models → empty projection (honest unknown).
 */
export function projectArchitectureResponsibilities(
  model: ProductUnderstandingModel,
  options: { maxPrimaryAreas?: number } = {},
): ArchitectureResponsibilityProjection {
  const maxPrimaryAreas = options.maxPrimaryAreas ?? 8;
  const concepts = model.concepts.filter(
    (concept) => PRIMARY_KINDS.has(concept.kind) && isProductFacingLabel(concept.label),
  );
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));

  const cards: ArchitectureResponsibilityCard[] = concepts.map((concept) => {
    const tech = technicalRefs(concept);
    const childIds =
      concept.kind === "application"
        ? childrenOf(model, concept.id, ["product-area"])
        : concept.kind === "product-area"
          ? childrenOf(model, concept.id, ["capability"])
          : [];
    // Capabilities without relation still count sibling tech via own refs.
    const relatedTechCount =
      concept.kind === "capability"
        ? tech.length
        : childIds.reduce((sum, childId) => {
            const child = byId.get(childId);
            return sum + (child ? technicalRefs(child).length : 0);
          }, tech.length);
    const boundary = boundaryFor(concept, relatedTechCount);
    const parentRelation = model.relations.find(
      (relation) =>
        relation.targetConceptId === concept.id &&
        byId.has(relation.sourceConceptId) &&
        (concept.kind === "capability"
          ? byId.get(relation.sourceConceptId)?.kind === "product-area"
          : concept.kind === "product-area"
            ? byId.get(relation.sourceConceptId)?.kind === "application"
            : false),
    );
    return {
      id: concept.id,
      kind: concept.kind,
      label: concept.label,
      purpose: purposeFor(model, concept),
      knowledgeStatus: concept.knowledgeStatus,
      boundary,
      boundaryLabel: BOUNDARY_LABEL[boundary],
      parentId: parentRelation?.sourceConceptId ?? null,
      technicalRefIds: tech,
      childIds,
    };
  });

  const applications = cards.filter((card) => card.kind === "application");
  const areas = cards
    .filter((card) => card.kind === "product-area")
    .sort((left, right) => left.label.localeCompare(right.label));
  const primaryAreaIds = areas.slice(0, maxPrimaryAreas).map((card) => card.id);
  const partial =
    concepts.length === 0 ||
    areas.some((card) => card.boundary === "unclear") ||
    cards.some(
      (card) => card.knowledgeStatus === "UNKNOWN" || card.knowledgeStatus === "INTERPRETED",
    );

  let partialReason: string | null = null;
  if (concepts.length === 0) {
    partialReason = "Keine belegten Produktverantwortlichkeiten — Architektur-Partial.";
  } else if (areas.every((card) => card.boundary === "unclear") && areas.length > 0) {
    partialReason = "Produktgrenzen unklar — technische Zuordnung fehlt.";
  } else if (partial) {
    partialReason = "Teilweise belegte Verantwortlichkeiten (PARTIAL).";
  }

  return {
    cards,
    primaryAreaIds,
    applications,
    partial,
    partialReason,
  };
}
