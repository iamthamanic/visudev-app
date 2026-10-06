/**
 * Product Understanding module entry (PU-01 / #422).
 * Identity helpers + re-exports — no builders yet (PU-02+).
 * Location: shared/product-understanding/index.ts
 */

import {
  isAuthoritativeKnowledgeStatus,
  type KnowledgeStatus,
} from "../scan-detector/epistemic.js";
import type {
  ProductConceptKind,
  ProductEvidenceRef,
  ProductRelation,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import {
  PRODUCT_CONCEPT_KINDS,
  PRODUCT_UNDERSTANDING_MODEL_VERSION,
} from "../product-understanding.types.js";

export type {
  ProductConcept,
  ProductConceptKind,
  ProductDataMeaning,
  ProductEvidenceRef,
  ProductEvidenceSource,
  ProductExplanation,
  ProductExplanationLevel,
  ProductImpactHint,
  ProductRelation,
  ProductRelationKind,
  ProductStoryStep,
  ProductStoryStepRole,
  ProductUnderstandingModel,
  ProductUnderstandingModelVersion,
  ProductUserSystemStory,
} from "../product-understanding.types.js";

export { PRODUCT_CONCEPT_KINDS, PRODUCT_UNDERSTANDING_MODEL_VERSION };

const CONCEPT_KIND_SET = new Set<string>(PRODUCT_CONCEPT_KINDS);

/** Stable concept id: `pu:<kind>:<stableKey>` (deterministic, no UUID invent). */
export function buildProductConceptId(kind: ProductConceptKind, stableKey: string): string {
  const key = stableKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `pu:${kind}:${key || "unnamed"}`;
}

export function isProductConceptKind(value: unknown): value is ProductConceptKind {
  return typeof value === "string" && CONCEPT_KIND_SET.has(value);
}

/**
 * Name-only / empty-evidence relations are never authoritative.
 * Authoritative requires ≥1 evidence ref AND an authoritative KnowledgeStatus.
 */
export function isAuthoritativeProductRelation(relation: ProductRelation): boolean {
  if (!Array.isArray(relation.evidence) || relation.evidence.length === 0) {
    return false;
  }
  if (!relation.evidence.every(isProductEvidenceRefShape)) {
    return false;
  }
  return isAuthoritativeKnowledgeStatus(relation.knowledgeStatus);
}

function isProductEvidenceRefShape(ref: ProductEvidenceRef): boolean {
  return (
    typeof ref.refId === "string" &&
    ref.refId.trim().length > 0 &&
    typeof ref.source === "string" &&
    ref.source.length > 0
  );
}

/** Empty versioned model shell for tests / progressive builders. */
export function emptyProductUnderstandingModel(
  projectId: string,
  analyzedAt: string = new Date().toISOString(),
): ProductUnderstandingModel {
  return {
    version: PRODUCT_UNDERSTANDING_MODEL_VERSION,
    projectId,
    analyzedAt,
    concepts: [],
    relations: [],
    impacts: [],
    stories: [],
    dataMeanings: [],
    explanations: [],
  };
}

/** Coerce unknown kind to `unknown` — never invent a taxonomy member. */
export function coerceProductConceptKind(value: unknown): ProductConceptKind {
  if (isProductConceptKind(value)) return value;
  return "unknown";
}

export function assertInterpretedOrUnknownAllowed(status: KnowledgeStatus): boolean {
  return status === "INTERPRETED" || status === "UNKNOWN" || status === "CONFLICTED";
}

export {
  buildProductUnderstanding,
  type BuildProductUnderstandingInput,
} from "./build-product-understanding.js";

export {
  PRODUCT_UNDERSTANDING_INTERPRETER_PROMPT_VERSION,
  buildProductUnderstandingInterpreterInput,
  createNullProductUnderstandingInterpreter,
  isAmbiguousProductConcept,
  mergeProductUnderstandingInterpretations,
  type ProductUnderstandingAnnotation,
  type ProductUnderstandingInterpretationResult,
  type ProductUnderstandingInterpreterInput,
  type ProductUnderstandingInterpreterPort,
} from "./interpretation.js";

export {
  isProductUnderstandingInterpreterEnabled,
  runProductUnderstandingInterpretation,
} from "./run-interpretation.js";

export {
  presentProductConceptExplanation,
  knowledgeStatusLabelDe,
  type ExplanationBlock,
  type ProductConceptExplanationView,
} from "./explanation-presenter.js";

export {
  PU_SELECTION_QUERY_CONCEPT,
  PU_SELECTION_QUERY_EVIDENCE,
  PU_SELECTION_QUERY_VIEW,
  createProductConceptSelection,
  isProductConceptSelectionId,
  parseProductConceptSelection,
  productConceptSelectionFromSearchParams,
  productConceptSelectionToSearchParams,
  resolveProductConceptSelectionForView,
  serializeProductConceptSelection,
  type ProductConceptSelection,
} from "./selection.js";

export {
  buildProductConceptInspectorSections,
  type ProductConceptInspectorSectionData,
} from "./inspector-sections.js";

export {
  projectAtlasProductMap,
  ATLAS_PRODUCT_PRIMARY_KINDS,
  type AtlasProductMapProjection,
  type AtlasProductPrimaryKind,
  type ProjectAtlasProductMapOptions,
} from "./project-atlas-product-map.js";

export {
  projectArchitectureResponsibilities,
  type ArchitectureBoundaryState,
  type ArchitectureResponsibilityCard,
  type ArchitectureResponsibilityProjection,
} from "./project-architecture-responsibilities.js";

export {
  projectDependenciesImpactMap,
  IMPACT_MAX_DIRECT,
  IMPACT_MAX_TRANSITIVE,
  IMPACT_MAX_OVERVIEW_NODES,
  IMPACT_TRANSITIVE_DEPTH,
  type DependenciesImpactMapProjection,
  type ImpactHop,
  type ImpactRelationView,
  type ProjectDependenciesImpactMapOptions,
} from "./project-dependencies-impact-map.js";

export {
  buildProductUserSystemStories,
  projectExecutionStories,
  EXECUTION_STORY_MAX,
  type ExecutionStoriesProjection,
  type ExecutionStoryObservation,
  type ExecutionStoryStepView,
  type ExecutionStoryView,
} from "./project-execution-stories.js";

export {
  buildProductDataMeanings,
  projectDataInformationFlow,
  DATA_INFO_FLOW_MAX,
  type DataInformationFlowProjection,
  type InformationFlowCard,
  type InformationFlowHopView,
  type InformationFlowRole,
} from "./project-data-information-flow.js";

export {
  classifySystemTopologyRole,
  projectInfrastructureSystemTopology,
  INFRA_TOPOLOGY_MAX_PARTS,
  type InfrastructureSystemTopologyProjection,
  type ProjectInfrastructureSystemTopologyOptions,
  type SystemTopologyConnection,
  type SystemTopologyCoverage,
  type SystemTopologyPart,
  type SystemTopologyRole,
  type SystemTopologyTechnicalDetail,
} from "./project-infrastructure-topology.js";
