/**
 * Atlas primary projection from ProductUnderstandingModel (PU-07).
 * Only application / product-area / capability — technical artifacts stay in evidence drill-down.
 * Location: shared/product-understanding/project-atlas-product-map.ts
 */

import type { GraphCanvasEdge, GraphCanvasNode } from "../graph-canvas.types.js";
import type { SemanticEntity } from "../semantic-system-model.types.js";
import { isStructuralDomainName } from "../semantic-domain-inference.js";
import type {
  ProductConcept,
  ProductConceptKind,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import { presentProductConceptExplanation } from "./explanation-presenter.js";

export const ATLAS_PRODUCT_PRIMARY_KINDS = [
  "application",
  "product-area",
  "capability",
] as const satisfies readonly ProductConceptKind[];

export type AtlasProductPrimaryKind = (typeof ATLAS_PRODUCT_PRIMARY_KINDS)[number];

const PRIMARY_SET = new Set<string>(ATLAS_PRODUCT_PRIMARY_KINDS);

const KIND_TO_CANVAS: Record<AtlasProductPrimaryKind, string> = {
  application: "application",
  "product-area": "domain",
  capability: "module",
};

const KIND_TO_SEMANTIC: Record<AtlasProductPrimaryKind, SemanticEntity["kind"]> = {
  application: "application",
  "product-area": "business-domain",
  capability: "capability",
};

export interface AtlasProductMapGroup {
  id: string;
  kind: "domain";
  label: string;
  nodeIds: string[];
}

export interface AtlasProductMapProjection {
  nodes: GraphCanvasNode[];
  edges: GraphCanvasEdge[];
  groups: AtlasProductMapGroup[];
  /** Same groups — membership is already product-concept IDs (no raw graph flood). */
  inspectorGroups: AtlasProductMapGroup[];
  /** Adapter entities for existing Atlas inspector chrome. */
  semanticEntities: SemanticEntity[];
  concepts: ProductConcept[];
  sourceGraphNodeIdBySemanticId: Record<string, string>;
  condensed: boolean;
  totalNodes: number;
  visibleNodes: number;
}

export interface ProjectAtlasProductMapOptions {
  searchQuery?: string;
  maxNodes?: number;
}

function isPrimary(kind: ProductConceptKind): kind is AtlasProductPrimaryKind {
  return PRIMARY_SET.has(kind);
}

/** Reject folder-layer labels so Atlas never paints technical clusters as product areas. */
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
  if (concept.summary?.trim()) return concept.summary.trim().slice(0, 160);
  const view = presentProductConceptExplanation(model, concept.id);
  if (view?.level1?.body) return view.level1.body.slice(0, 160);
  return `${concept.label} — Zweck noch nicht belegt.`;
}

function toSemanticAdapter(
  model: ProductUnderstandingModel,
  concept: ProductConcept,
): SemanticEntity {
  const productKind = concept.kind as AtlasProductPrimaryKind;
  return {
    id: concept.id,
    kind: KIND_TO_SEMANTIC[productKind],
    label: concept.label,
    confidence: concept.confidence,
    knowledgeStatus: concept.knowledgeStatus,
    evidence: concept.evidence.map((ref) => ({
      source: "graph-evidence" as const,
      refId: ref.refId,
    })),
    metadata: {
      productKind: concept.kind,
      purpose: purposeFor(model, concept),
      technicalRefs: (concept.technicalRefs ?? []).map((ref) => ref.refId),
    },
  };
}

function firstGraphRef(concept: ProductConcept): string | undefined {
  for (const ref of concept.technicalRefs ?? []) {
    if (ref.source === "software-graph") return ref.refId;
  }
  for (const ref of concept.evidence) {
    if (ref.source === "software-graph" || ref.source === "semantic-system-model") {
      return ref.refId;
    }
  }
  return undefined;
}

/**
 * Project Product Understanding into Atlas canvas nodes/groups.
 * Does not invent concepts — empty model → empty projection.
 */
export function projectAtlasProductMap(
  model: ProductUnderstandingModel,
  options: ProjectAtlasProductMapOptions = {},
): AtlasProductMapProjection {
  const maxNodes = options.maxNodes ?? 40;
  const search = (options.searchQuery ?? "").trim().toLowerCase();
  const primary = model.concepts.filter(
    (concept) => isPrimary(concept.kind) && isProductFacingLabel(concept.label),
  );
  const filtered = search
    ? primary.filter(
        (concept) =>
          concept.label.toLowerCase().includes(search) ||
          (concept.summary ?? "").toLowerCase().includes(search),
      )
    : primary;

  const sorted = [...filtered].sort((left, right) => {
    const order = (kind: ProductConceptKind): number =>
      kind === "application" ? 0 : kind === "product-area" ? 1 : 2;
    return order(left.kind) - order(right.kind) || left.label.localeCompare(right.label);
  });
  const visible = sorted.slice(0, maxNodes);
  const visibleIds = new Set(visible.map((concept) => concept.id));

  const nodes: GraphCanvasNode[] = visible.map((concept) => {
    const productKind = concept.kind as AtlasProductPrimaryKind;
    return {
      id: concept.id,
      label: concept.label,
      kind: KIND_TO_CANVAS[productKind],
      semanticKind: KIND_TO_SEMANTIC[productKind],
      knowledgeStatus: concept.knowledgeStatus,
      purpose: purposeFor(model, concept),
      productKind,
    };
  });

  const edges: GraphCanvasEdge[] = model.relations
    .filter(
      (relation) =>
        visibleIds.has(relation.sourceConceptId) && visibleIds.has(relation.targetConceptId),
    )
    .slice(0, 80)
    .map((relation) => ({
      id: relation.id,
      source: relation.sourceConceptId,
      target: relation.targetConceptId,
      kind: relation.kind,
      label: relation.kind,
    }));

  const areas = visible.filter((concept) => concept.kind === "product-area");
  const groups: AtlasProductMapGroup[] = [];
  if (areas.length > 0) {
    for (const area of areas) {
      const memberIds = new Set<string>([area.id]);
      for (const relation of model.relations) {
        if (relation.sourceConceptId === area.id && visibleIds.has(relation.targetConceptId)) {
          memberIds.add(relation.targetConceptId);
        }
        if (relation.targetConceptId === area.id && visibleIds.has(relation.sourceConceptId)) {
          memberIds.add(relation.sourceConceptId);
        }
      }
      groups.push({
        id: `atlas-product-area:${area.id}`,
        kind: "domain",
        label: area.label,
        nodeIds: [...memberIds].sort(),
      });
    }
  } else {
    for (const concept of visible) {
      groups.push({
        id: `atlas-product:${concept.id}`,
        kind: "domain",
        label: concept.label,
        nodeIds: [concept.id],
      });
    }
  }

  const sourceGraphNodeIdBySemanticId: Record<string, string> = {};
  for (const concept of visible) {
    const ref = firstGraphRef(concept);
    if (ref) sourceGraphNodeIdBySemanticId[concept.id] = ref;
  }

  return {
    nodes,
    edges,
    groups,
    inspectorGroups: groups,
    semanticEntities: visible.map((concept) => toSemanticAdapter(model, concept)),
    concepts: visible,
    sourceGraphNodeIdBySemanticId,
    condensed: sorted.length > maxNodes,
    totalNodes: primary.length,
    visibleNodes: nodes.length,
  };
}
