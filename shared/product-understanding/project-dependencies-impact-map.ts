/**
 * Dependencies impact map from ProductUnderstandingModel (PU-09).
 * Answers: if I change X, what can be affected and why?
 * Technical import/call edges stay in drill-down — not the primary layer.
 * Location: shared/product-understanding/project-dependencies-impact-map.ts
 */

import { isAuthoritativeKnowledgeStatus } from "../scan-detector/epistemic.js";
import { isStructuralDomainName } from "../semantic-domain-inference.js";
import type {
  ProductConcept,
  ProductRelation,
  ProductRelationKind,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import type { GraphCanvasEdge, GraphCanvasNode } from "../graph-canvas.types.js";

/** Hard caps — no unbounded transitive closure in the UI. */
export const IMPACT_MAX_DIRECT = 12;
export const IMPACT_MAX_TRANSITIVE = 8;
export const IMPACT_MAX_OVERVIEW_NODES = 40;
export const IMPACT_TRANSITIVE_DEPTH = 2;

export type ImpactHop = "direct" | "transitive";

export interface ImpactRelationView {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  hop: ImpactHop;
  kind: ProductRelationKind | "impact-hint";
  /** Plain-language relation meaning (DE). */
  meaning: string;
  knowledgeStatus: ProductRelation["knowledgeStatus"];
  /** True only when status is authoritative AND evidence exists. */
  confirmed: boolean;
  evidenceCount: number;
  whyItMatters: string;
}

export interface DependenciesImpactMapProjection {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  relations: ImpactRelationView[];
  focusConceptId: string | null;
  partial: boolean;
  partialReason: string | null;
  truncatedDirect: boolean;
  truncatedTransitive: boolean;
}

const PRIMARY_CONCEPT_KINDS = new Set([
  "application",
  "product-area",
  "capability",
  "system-part",
  "external-system",
  "information",
]);

const IMPACT_RELATION_KINDS = new Set<ProductRelationKind>([
  "uses",
  "enables",
  "impacts",
  "flows-to",
  "triggers",
  "belongs-to",
  "contains",
]);

const RELATION_MEANING_DE: Record<ProductRelationKind | "impact-hint", string> = {
  contains: "enthält",
  enables: "ermöglicht",
  uses: "nutzt",
  impacts: "beeinflusst",
  "flows-to": "fließt nach",
  "belongs-to": "gehört zu",
  triggers: "löst aus",
  "impact-hint": "mögliche Auswirkung",
};

function isProductFacing(concept: ProductConcept): boolean {
  if (!PRIMARY_CONCEPT_KINDS.has(concept.kind)) return false;
  const slug = concept.label
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return Boolean(slug) && !isStructuralDomainName(slug);
}

function meaningFor(kind: ProductRelationKind | "impact-hint"): string {
  return RELATION_MEANING_DE[kind] ?? "bezogen auf";
}

function whyFor(
  knowledgeStatus: ProductRelation["knowledgeStatus"],
  confirmed: boolean,
  hop: ImpactHop,
  summary?: string,
): string {
  if (!confirmed) {
    if (knowledgeStatus === "CONFLICTED") {
      return "Widersprüchliche Belege — Impact nicht bestätigt.";
    }
    if (knowledgeStatus === "UNKNOWN") {
      return "Bedeutung unbekannt — kein bestätigter Impact.";
    }
    return "Nur interpretiert — kein bestätigter Impact.";
  }
  if (hop === "transitive") {
    return "Indirekte Folge über eine Zwischenbeziehung (begrenzt).";
  }
  if (summary?.trim()) {
    return summary.trim().slice(0, 160);
  }
  return "Direkte fachliche Abhängigkeit mit Evidence.";
}

function canvasKind(concept: ProductConcept): string {
  switch (concept.kind) {
    case "application":
      return "application";
    case "product-area":
      return "domain";
    case "capability":
      return "module";
    case "external-system":
      return "external";
    case "information":
      return "table";
    default:
      return "service";
  }
}

interface DirectedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  kind: ProductRelationKind | "impact-hint";
  knowledgeStatus: ProductRelation["knowledgeStatus"];
  evidenceCount: number;
  summary?: string;
}

function collectDirectedEdges(model: ProductUnderstandingModel): DirectedEdge[] {
  const edges: DirectedEdge[] = [];
  for (const relation of model.relations) {
    if (!IMPACT_RELATION_KINDS.has(relation.kind)) continue;
    edges.push({
      id: relation.id,
      sourceId: relation.sourceConceptId,
      targetId: relation.targetConceptId,
      kind: relation.kind,
      knowledgeStatus: relation.knowledgeStatus,
      evidenceCount: relation.evidence.length,
    });
  }
  for (const impact of model.impacts) {
    edges.push({
      id: impact.id,
      sourceId: impact.fromConceptId,
      targetId: impact.toConceptId,
      kind: "impact-hint",
      knowledgeStatus: impact.knowledgeStatus,
      evidenceCount: impact.evidence.length,
      summary: impact.summary,
    });
  }
  return edges;
}

function toView(edge: DirectedEdge, hop: ImpactHop): ImpactRelationView {
  const confirmed = isAuthoritativeKnowledgeStatus(edge.knowledgeStatus) && edge.evidenceCount > 0;
  return {
    id: `${hop}:${edge.id}`,
    sourceConceptId: edge.sourceId,
    targetConceptId: edge.targetId,
    hop,
    kind: edge.kind,
    meaning: meaningFor(edge.kind),
    knowledgeStatus: edge.knowledgeStatus,
    confirmed,
    evidenceCount: edge.evidenceCount,
    whyItMatters: whyFor(edge.knowledgeStatus, confirmed, hop, edge.summary),
  };
}

export interface ProjectDependenciesImpactMapOptions {
  focusConceptId?: string | null;
  searchQuery?: string;
}

/**
 * Project Product Understanding into a bounded change-impact map.
 * Empty model → empty projection (honest unknown).
 */
export function projectDependenciesImpactMap(
  model: ProductUnderstandingModel,
  options: ProjectDependenciesImpactMapOptions = {},
): DependenciesImpactMapProjection {
  const concepts = model.concepts.filter(isProductFacing);
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const allEdges = collectDirectedEdges(model).filter(
    (edge) => byId.has(edge.sourceId) && byId.has(edge.targetId),
  );

  const search = (options.searchQuery ?? "").trim().toLowerCase();
  let focusId = options.focusConceptId ?? null;
  if (focusId && !byId.has(focusId)) focusId = null;

  // Outgoing adjacency for BFS impact ("if I change source, what is affected").
  const outgoing = new Map<string, DirectedEdge[]>();
  for (const edge of allEdges) {
    const list = outgoing.get(edge.sourceId) ?? [];
    list.push(edge);
    outgoing.set(edge.sourceId, list);
  }

  const relationViews: ImpactRelationView[] = [];
  const visibleConceptIds = new Set<string>();
  let truncatedDirect = false;
  let truncatedTransitive = false;

  if (focusId) {
    visibleConceptIds.add(focusId);
    const directEdges = (outgoing.get(focusId) ?? []).slice(0, IMPACT_MAX_DIRECT);
    truncatedDirect = (outgoing.get(focusId) ?? []).length > IMPACT_MAX_DIRECT;
    const transitiveCandidates: DirectedEdge[] = [];
    for (const edge of directEdges) {
      visibleConceptIds.add(edge.targetId);
      relationViews.push(toView(edge, "direct"));
      for (const next of outgoing.get(edge.targetId) ?? []) {
        if (next.targetId === focusId) continue; // skip trivial cycle back
        transitiveCandidates.push(next);
      }
    }
    const transitiveEdges = transitiveCandidates.slice(0, IMPACT_MAX_TRANSITIVE);
    truncatedTransitive = transitiveCandidates.length > IMPACT_MAX_TRANSITIVE;
    for (const edge of transitiveEdges) {
      visibleConceptIds.add(edge.targetId);
      relationViews.push(toView(edge, "transitive"));
    }
  } else {
    // Overview: densest product concepts by outgoing fan-out, then their direct edges.
    const ranked = [...concepts].sort((left, right) => {
      const leftOut = (outgoing.get(left.id) ?? []).length;
      const rightOut = (outgoing.get(right.id) ?? []).length;
      return rightOut - leftOut || left.label.localeCompare(right.label);
    });
    for (const concept of ranked.slice(0, IMPACT_MAX_OVERVIEW_NODES)) {
      visibleConceptIds.add(concept.id);
    }
    let edgeBudget = IMPACT_MAX_DIRECT + IMPACT_MAX_TRANSITIVE;
    for (const concept of ranked) {
      if (!visibleConceptIds.has(concept.id)) continue;
      for (const edge of outgoing.get(concept.id) ?? []) {
        if (edgeBudget <= 0) {
          truncatedDirect = true;
          break;
        }
        if (!visibleConceptIds.has(edge.targetId)) {
          if (visibleConceptIds.size >= IMPACT_MAX_OVERVIEW_NODES) continue;
          visibleConceptIds.add(edge.targetId);
        }
        relationViews.push(toView(edge, "direct"));
        edgeBudget -= 1;
      }
      if (edgeBudget <= 0) break;
    }
  }

  if (search) {
    for (const concept of concepts) {
      if (
        concept.label.toLowerCase().includes(search) ||
        (concept.summary ?? "").toLowerCase().includes(search)
      ) {
        visibleConceptIds.add(concept.id);
      }
    }
  }

  const nodes: GraphCanvasNode[] = [...visibleConceptIds]
    .map((id) => byId.get(id))
    .filter((concept): concept is ProductConcept => Boolean(concept))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((concept) => ({
      id: concept.id,
      label: concept.label,
      kind: canvasKind(concept),
      knowledgeStatus: concept.knowledgeStatus,
      productKind: concept.kind,
      purpose: concept.summary?.trim() || undefined,
    }));

  const edges: GraphCanvasEdge[] = relationViews.map((relation) => {
    const hopPrefix = relation.hop === "direct" ? "direkt" : "indirekt";
    const meaning = relation.confirmed ? relation.meaning : `${relation.meaning} (unbestätigt)`;
    return {
      id: relation.id,
      source: relation.sourceConceptId,
      target: relation.targetConceptId,
      kind: relation.hop === "direct" ? "depends-on" : "references",
      label: `${hopPrefix}: ${meaning}`,
    };
  });
  const partial =
    concepts.length === 0 ||
    relationViews.some((relation) => !relation.confirmed) ||
    truncatedDirect ||
    truncatedTransitive;

  let partialReason: string | null = null;
  if (concepts.length === 0) {
    partialReason = "Keine Produktkonzepte für Impact — Dependencies-Partial.";
  } else if (relationViews.length === 0) {
    partialReason = focusId
      ? "Keine ausgehenden fachlichen Auswirkungen für diese Auswahl."
      : "Keine belegten Impact-Beziehungen zwischen Produktkonzepten.";
  } else if (truncatedDirect || truncatedTransitive) {
    partialReason = "Impact-Darstellung begrenzt (Fan-out gekappt).";
  } else if (relationViews.some((relation) => !relation.confirmed)) {
    partialReason = "Enthält unbestätigte (UNKNOWN/INTERPRETED/CONFLICTED) Beziehungen.";
  }

  return {
    nodes,
    edges,
    relations: relationViews,
    focusConceptId: focusId,
    partial,
    partialReason,
    truncatedDirect,
    truncatedTransitive,
  };
}
