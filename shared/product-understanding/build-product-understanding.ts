/**
 * Multi-signal Product Understanding builder (PU-02 / #423).
 * Concepts require corroboration across Truth signals — never a single path segment.
 * Location: shared/product-understanding/build-product-understanding.ts
 */

import type { DataLineageGraph } from "../data-lineage.types.js";
import {
  coerceKnowledgeStatus,
  dominantCanonicalKnowledgeStatus,
  type KnowledgeStatus,
} from "../scan-detector/epistemic.js";
import {
  isStructuralDomainName,
  normalizeBusinessDomainCandidate,
} from "../semantic-domain-inference.js";
import type { SemanticEntity, SemanticSystemModel } from "../semantic-system-model.types.js";
import type { SoftwareGraph } from "../software-graph.types.js";
import type { UiInteractionGraph } from "../ui-interaction-graph.types.js";
import type {
  ProductConcept,
  ProductConceptKind,
  ProductEvidenceRef,
  ProductEvidenceSource,
  ProductRelation,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import { PRODUCT_UNDERSTANDING_MODEL_VERSION } from "../product-understanding.types.js";
import { buildProductUserSystemStories } from "./project-execution-stories.js";
import { buildProductDataMeanings } from "./project-data-information-flow.js";

export interface BuildProductUnderstandingInput {
  projectId: string;
  analyzedAt?: string;
  semantic?: SemanticSystemModel | null;
  ui?: UiInteractionGraph | null;
  lineage?: DataLineageGraph | null;
  software?: SoftwareGraph | null;
}

type SignalSource = ProductEvidenceSource;

interface CandidateSignal {
  source: SignalSource;
  refId: string;
  summary?: string;
  confidence: number;
  knowledgeStatus: KnowledgeStatus;
}

interface ConceptCandidate {
  key: string;
  kind: ProductConceptKind;
  label: string;
  signals: CandidateSignal[];
}

const SEMANTIC_KIND_TO_PRODUCT: Partial<Record<SemanticEntity["kind"], ProductConceptKind>> = {
  application: "application",
  "business-domain": "product-area",
  capability: "capability",
  "external-system": "external-system",
  service: "system-part",
  "technical-module": "system-part",
  "data-store": "information",
  endpoint: "system-part",
  resource: "information",
};

function buildConceptId(kind: ProductConceptKind, stableKey: string): string {
  const key = stableKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `pu:${kind}:${key || "unnamed"}`;
}

function emptyModel(projectId: string, analyzedAt: string): ProductUnderstandingModel {
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

function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSources(signals: readonly CandidateSignal[]): Set<SignalSource> {
  return new Set(signals.map((signal) => signal.source));
}

function pushSignal(
  map: Map<string, ConceptCandidate>,
  kind: ProductConceptKind,
  rawKey: string,
  label: string,
  signal: CandidateSignal,
): void {
  const key = normalizeBusinessDomainCandidate(rawKey) ?? normalizeLooseKey(rawKey);
  if (!key) return;
  const idKey = `${kind}:${key}`;
  const current = map.get(idKey) ?? {
    key,
    kind,
    label: label.trim() || key,
    signals: [],
  };
  if (
    !current.signals.some((entry) => entry.source === signal.source && entry.refId === signal.refId)
  ) {
    current.signals.push(signal);
  }
  if (label.trim().length > current.label.length) {
    current.label = label.trim();
  }
  map.set(idKey, current);
}

/** Loose key for UI/labels that are not business-domain shaped — still reject empties. */
function normalizeLooseKey(raw: string): string | null {
  const value = raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!value || value.length < 2) return null;
  // Structural folder / layer tokens are never product concepts (folder-name trap).
  if (isStructuralDomainName(value)) return null;
  if (/^(main)$/.test(value)) return null;
  return value;
}

function collectFromSemantic(
  map: Map<string, ConceptCandidate>,
  semantic: SemanticSystemModel,
): void {
  for (const entity of semantic.entities) {
    const kind = SEMANTIC_KIND_TO_PRODUCT[entity.kind];
    if (!kind) continue;
    const metadata = entity.metadata ?? {};
    const evidence = Array.isArray(entity.evidence) ? entity.evidence : [];
    const confidence = Number.isFinite(entity.confidence) ? entity.confidence : 0.3;
    const candidateKey =
      (typeof metadata.candidateKey === "string" && metadata.candidateKey) || entity.label;
    for (const item of evidence) {
      pushSignal(map, kind, candidateKey, entity.label, {
        source: "semantic-system-model",
        refId: entity.id,
        summary: `${entity.kind}:${item.refId}`,
        confidence,
        knowledgeStatus: coerceKnowledgeStatus(entity.knowledgeStatus),
      });
    }
    // Entity without evidence still records a weak semantic signal (never sole authority).
    if (evidence.length === 0) {
      pushSignal(map, kind, candidateKey, entity.label, {
        source: "semantic-system-model",
        refId: entity.id,
        summary: `${entity.kind}:no-evidence`,
        confidence: Math.min(confidence, 0.3),
        knowledgeStatus: "INTERPRETED",
      });
    }
  }
}

function collectFromUi(map: Map<string, ConceptCandidate>, ui: UiInteractionGraph): void {
  for (const surface of ui.surfaces) {
    pushSignal(map, "product-area", surface.label, surface.label, {
      source: "ui-interaction-graph",
      refId: surface.id,
      summary: `surface:${surface.kind}`,
      confidence: surface.confidence,
      knowledgeStatus: mapUiStatus(surface.status),
    });
  }
  for (const transition of ui.transitions) {
    const triggerLabel = transition.trigger?.label?.trim();
    if (!triggerLabel) continue;
    pushSignal(map, "user-action", triggerLabel, triggerLabel, {
      source: "ui-interaction-graph",
      refId: transition.id,
      summary: `transition:${transition.kind}`,
      confidence: transition.confidence,
      knowledgeStatus: mapUiStatus(transition.status),
    });
  }
}

function mapUiStatus(status: string): KnowledgeStatus {
  switch (status) {
    case "verified":
      return "VERIFIED";
    case "observed":
    case "detected":
      return "SUPPORTED";
    case "conflicted":
      return "CONFLICTED";
    case "inferred":
      return "INTERPRETED";
    default:
      return "UNKNOWN";
  }
}

function collectFromLineage(map: Map<string, ConceptCandidate>, lineage: DataLineageGraph): void {
  for (const path of lineage.paths) {
    for (const hop of path.hops) {
      for (const endpoint of [hop.from, hop.to]) {
        if (endpoint.layer === "data-entity") {
          pushSignal(map, "information", endpoint.label, endpoint.label, {
            source: "data-lineage",
            refId: endpoint.entityId,
            summary: `lineage:${hop.joinRuleId}`,
            confidence: hop.confidence,
            knowledgeStatus: coerceKnowledgeStatus(hop.knowledgeStatus),
          });
        }
        if (endpoint.layer === "ui-surface" || endpoint.layer === "ui-interaction") {
          pushSignal(map, "product-area", endpoint.label, endpoint.label, {
            source: "data-lineage",
            refId: endpoint.entityId,
            summary: `lineage-ui:${hop.joinRuleId}`,
            confidence: hop.confidence,
            knowledgeStatus: coerceKnowledgeStatus(hop.knowledgeStatus),
          });
        }
      }
    }
  }
}

function collectFromSoftware(map: Map<string, ConceptCandidate>, software: SoftwareGraph): void {
  for (const node of software.nodes) {
    if (node.kind === "application") {
      pushSignal(map, "application", node.label, node.label, {
        source: "software-graph",
        refId: node.id,
        summary: "application-node",
        confidence: 0.9,
        knowledgeStatus: "SUPPORTED",
      });
    }
    if (node.kind === "domain") {
      // Folder-layer domain nodes are never product areas (folder-name trap).
      if (isStructuralDomainName(node.label) || !normalizeBusinessDomainCandidate(node.label)) {
        continue;
      }
      pushSignal(map, "product-area", node.label, node.label, {
        source: "software-graph",
        refId: node.id,
        summary: "domain-node",
        confidence: 0.7,
        knowledgeStatus: "SUPPORTED",
      });
    }
    if (node.kind === "external") {
      pushSignal(map, "external-system", node.label, node.label, {
        source: "software-graph",
        refId: node.id,
        summary: "external-node",
        confidence: 0.8,
        knowledgeStatus: "SUPPORTED",
      });
    }
  }
}

/**
 * Accept a concept only with multi-signal corroboration on the shared key:
 * ≥2 distinct Truth sources across any kind with the same key (so UI "Invoices"
 * can corroborate a semantic capability:invoices).
 * Applications / external systems / UI user-actions may be single-source.
 */
function isCorroborated(
  candidate: ConceptCandidate,
  all: ReadonlyMap<string, ConceptCandidate>,
): boolean {
  if (candidate.kind === "application" || candidate.kind === "external-system") {
    return candidate.signals.length >= 1;
  }
  if (candidate.kind === "user-action") {
    return candidate.signals.some((signal) => signal.source === "ui-interaction-graph");
  }
  const relatedSignals = [...all.values()]
    .filter((entry) => entry.key === candidate.key)
    .flatMap((entry) => entry.signals);
  const sources = uniqueSources(relatedSignals);
  return sources.size >= 2;
}

function toConcept(
  candidate: ConceptCandidate,
  all: ReadonlyMap<string, ConceptCandidate>,
): ProductConcept {
  const relatedSignals = [...all.values()]
    .filter((entry) => entry.key === candidate.key)
    .flatMap((entry) => entry.signals);
  const evidence: ProductEvidenceRef[] = [];
  for (const signal of relatedSignals) {
    if (evidence.some((item) => item.source === signal.source && item.refId === signal.refId)) {
      continue;
    }
    evidence.push({
      source: signal.source,
      refId: signal.refId,
      summary: signal.summary,
    });
  }
  const statuses = relatedSignals.map((signal) => signal.knowledgeStatus);
  const knowledgeStatus = dominantCanonicalKnowledgeStatus(statuses);
  const confidence =
    relatedSignals.reduce((sum, signal) => sum + signal.confidence, 0) /
    Math.max(relatedSignals.length, 1);
  return {
    id: buildConceptId(candidate.kind, candidate.key),
    kind: candidate.kind,
    label: candidate.label,
    knowledgeStatus,
    confidence: Math.min(1, Number(confidence.toFixed(4))),
    evidence,
    technicalRefs: evidence,
  };
}

function buildRelations(
  concepts: readonly ProductConcept[],
  semantic: SemanticSystemModel | null | undefined,
): ProductRelation[] {
  if (!semantic || !Array.isArray(semantic.relations)) return [];
  const bySemanticId = new Map<string, ProductConcept>();
  for (const concept of concepts) {
    for (const ref of concept.evidence) {
      if (ref.source === "semantic-system-model") {
        bySemanticId.set(ref.refId, concept);
      }
    }
  }
  const relations: ProductRelation[] = [];
  for (const relation of semantic.relations) {
    const source = bySemanticId.get(relation.sourceId);
    const target = bySemanticId.get(relation.targetId);
    if (!source || !target || source.id === target.id) continue;
    if (relation.evidence.length === 0) continue;
    relations.push({
      id: `pu-rel:${relation.id}`,
      kind:
        relation.kind === "contains"
          ? "contains"
          : relation.kind === "depends-on"
            ? "uses"
            : "enables",
      sourceConceptId: source.id,
      targetConceptId: target.id,
      knowledgeStatus: coerceKnowledgeStatus(relation.knowledgeStatus),
      confidence: relation.confidence,
      evidence: relation.evidence.map((item) => ({
        source: "semantic-system-model" as const,
        refId: item.refId,
        summary: relation.kind,
      })),
    });
  }
  relations.sort((left, right) => compareId(left.id, right.id));
  return relations;
}

/**
 * Build a ProductUnderstandingModel from Truth inputs.
 * Single-signal / path-only hints are dropped — concepts need corroboration.
 */
export function buildProductUnderstanding(
  input: BuildProductUnderstandingInput,
): ProductUnderstandingModel {
  const analyzedAt = input.analyzedAt ?? new Date().toISOString();
  const base = emptyModel(input.projectId, analyzedAt);
  const candidates = new Map<string, ConceptCandidate>();

  if (input.semantic) collectFromSemantic(candidates, input.semantic);
  if (input.ui) collectFromUi(candidates, input.ui);
  if (input.lineage) collectFromLineage(candidates, input.lineage);
  if (input.software) collectFromSoftware(candidates, input.software);

  const concepts = [...candidates.values()]
    .filter((candidate) => isCorroborated(candidate, candidates))
    .map((candidate) => toConcept(candidate, candidates))
    .sort((left, right) => compareId(left.id, right.id));

  const relations = buildRelations(concepts, input.semantic);
  const partialModel = {
    ...base,
    concepts,
    relations,
  };
  return {
    ...partialModel,
    stories: buildProductUserSystemStories(partialModel),
    dataMeanings: buildProductDataMeanings(partialModel),
  };
}
