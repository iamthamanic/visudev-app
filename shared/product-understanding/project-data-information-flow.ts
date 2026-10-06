/**
 * Business information flow projection from ProductUnderstanding + DataLineage (PU-11).
 * Origin → transformation → storage → consumers — evidence-backed hops only.
 * Location: shared/product-understanding/project-data-information-flow.ts
 */

import {
  isAuthoritativeKnowledgeStatus,
  type KnowledgeStatus,
} from "../scan-detector/epistemic.js";
import type { DataLineageGraph, DataLineageLayer, LineageHop } from "../data-lineage.types.js";
import type {
  ProductConcept,
  ProductDataMeaning,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";

export const DATA_INFO_FLOW_MAX = 40;

export type InformationFlowRole = "origin" | "transformation" | "storage" | "consumer";

export interface InformationFlowHopView {
  id: string;
  role: InformationFlowRole;
  label: string;
  layer: DataLineageLayer | "unknown";
  knowledgeStatus: KnowledgeStatus;
  evidenceCount: number;
  confirmed: boolean;
  joinRuleId: string | null;
}

export interface InformationFlowCard {
  id: string;
  conceptId: string;
  title: string;
  meaning: string;
  knowledgeStatus: KnowledgeStatus;
  confirmed: boolean;
  hops: InformationFlowHopView[];
  /** Matched ERD table id/label when storage evidence points at a table. */
  storageTableKey: string | null;
  pathStatus: "complete" | "partial" | "unresolved" | "empty";
  partialReason: string | null;
}

export interface DataInformationFlowProjection {
  cards: InformationFlowCard[];
  partial: boolean;
  partialReason: string | null;
}

const ROLE_LABEL_DE: Record<InformationFlowRole, string> = {
  origin: "Herkunft / Eingabe",
  transformation: "Verarbeitung",
  storage: "Speicherung",
  consumer: "Nutzung",
};

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ");
}

function roleForLayer(layer: DataLineageLayer, towardStorage: boolean): InformationFlowRole {
  if (layer === "data-entity") return "storage";
  if (layer === "ui-surface" || layer === "ui-interaction") {
    return towardStorage ? "origin" : "consumer";
  }
  return "transformation";
}

function hopMatchesConcept(hop: LineageHop, concept: ProductConcept): boolean {
  const needles = [
    normalize(concept.label),
    ...concept.evidence.map((item) => normalize(item.refId)),
    ...concept.evidence.map((item) => normalize(item.summary ?? "")),
  ].filter(Boolean);
  const haystacks = [
    normalize(hop.from.label),
    normalize(hop.to.label),
    normalize(hop.from.entityId),
    normalize(hop.to.entityId),
  ];
  return needles.some((needle) =>
    haystacks.some((hay) => hay === needle || (needle.length > 2 && hay.includes(needle))),
  );
}

function buildMeanings(model: ProductUnderstandingModel): ProductDataMeaning[] {
  return model.concepts
    .filter((concept) => concept.kind === "information")
    .map((concept) => ({
      id: `pu-meaning:${concept.id}`,
      conceptId: concept.id,
      businessMeaning:
        concept.summary?.trim() || `Fachliche Information „${concept.label}“ aus Scan-Signalen.`,
      knowledgeStatus: concept.knowledgeStatus,
      evidence: concept.evidence,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

/**
 * Fill ProductUnderstanding dataMeanings from information concepts.
 */
export function buildProductDataMeanings(
  model: Omit<ProductUnderstandingModel, "dataMeanings"> & {
    dataMeanings?: ProductDataMeaning[];
  },
): ProductDataMeaning[] {
  return buildMeanings(model as ProductUnderstandingModel);
}

function collectHopsForConcept(
  lineage: DataLineageGraph | null | undefined,
  concept: ProductConcept,
): {
  hops: LineageHop[];
  pathStatus: InformationFlowCard["pathStatus"];
  truncation: string | null;
} {
  if (!lineage || lineage.paths.length === 0) {
    return { hops: [], pathStatus: "empty", truncation: null };
  }
  const matched: LineageHop[] = [];
  let worst: InformationFlowCard["pathStatus"] = "complete";
  let truncation: string | null = null;
  for (const path of lineage.paths) {
    const hasMatch = path.hops.some((hop) => hopMatchesConcept(hop, concept));
    if (!hasMatch) continue;
    matched.push(...path.hops);
    if (path.status === "unresolved") worst = "unresolved";
    else if (path.status === "partial" && worst === "complete") worst = "partial";
    if (path.truncationReason) truncation = path.truncationReason;
  }
  if (matched.length === 0) return { hops: [], pathStatus: "empty", truncation: null };
  return { hops: matched, pathStatus: worst, truncation };
}

function toHopViews(hops: LineageHop[], conceptId: string): InformationFlowHopView[] {
  const views: InformationFlowHopView[] = [];
  const seen = new Set<string>();
  for (const hop of hops) {
    const storageIndex = hop.from.layer === "data-entity" || hop.to.layer === "data-entity";
    for (const endpoint of [hop.from, hop.to]) {
      const towardStorage =
        endpoint.layer !== "data-entity" && storageIndex
          ? endpoint === hop.from
          : endpoint.layer === "ui-surface" || endpoint.layer === "ui-interaction";
      const role = roleForLayer(endpoint.layer, towardStorage);
      const key = `${role}:${endpoint.entityId}:${endpoint.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const confirmed =
        isAuthoritativeKnowledgeStatus(hop.knowledgeStatus) && hop.evidence.length > 0;
      views.push({
        id: `${conceptId}:${key}`,
        role,
        label: `${ROLE_LABEL_DE[role]}: ${endpoint.label}`,
        layer: endpoint.layer,
        knowledgeStatus: hop.knowledgeStatus,
        evidenceCount: hop.evidence.length,
        confirmed,
        joinRuleId: hop.joinRuleId,
      });
    }
  }
  const order: InformationFlowRole[] = ["origin", "transformation", "storage", "consumer"];
  views.sort(
    (left, right) =>
      order.indexOf(left.role) - order.indexOf(right.role) || left.label.localeCompare(right.label),
  );
  return views.slice(0, 24);
}

function storageTableKey(hops: InformationFlowHopView[]): string | null {
  const storage = hops.find((hop) => hop.role === "storage");
  if (!storage) return null;
  const raw = storage.label.replace(/^Speicherung:\s*/i, "").trim();
  return raw || null;
}

/**
 * Project information concepts into business information-flow cards.
 */
export function projectDataInformationFlow(
  model: ProductUnderstandingModel,
  lineage: DataLineageGraph | null | undefined = null,
): DataInformationFlowProjection {
  const meanings =
    model.dataMeanings.length > 0 ? model.dataMeanings : buildProductDataMeanings(model);
  const meaningByConcept = new Map(meanings.map((item) => [item.conceptId, item]));
  const information = model.concepts.filter((concept) => concept.kind === "information");
  const cards: InformationFlowCard[] = [];

  for (const concept of information.slice(0, DATA_INFO_FLOW_MAX)) {
    const meaning =
      meaningByConcept.get(concept.id)?.businessMeaning ??
      concept.summary?.trim() ??
      `Information „${concept.label}“`;
    const collected = collectHopsForConcept(lineage, concept);
    const hops = toHopViews(collected.hops, concept.id);
    const confirmed =
      isAuthoritativeKnowledgeStatus(concept.knowledgeStatus) && concept.evidence.length > 0;
    let partialReason: string | null = null;
    if (collected.pathStatus === "empty") {
      partialReason = "Kein belegter Lineage-Pfad für diese Information.";
    } else if (collected.pathStatus === "partial" || collected.pathStatus === "unresolved") {
      partialReason = collected.truncation ?? "Lineage-Pfad teilweise / unvollständig belegt.";
    } else if (hops.some((hop) => !hop.confirmed)) {
      partialReason = "Enthält unbestätigte (UNKNOWN/INTERPRETED/CONFLICTED) Hops.";
    }

    cards.push({
      id: `info-flow:${concept.id}`,
      conceptId: concept.id,
      title: concept.label,
      meaning,
      knowledgeStatus: concept.knowledgeStatus,
      confirmed,
      hops,
      storageTableKey: storageTableKey(hops),
      pathStatus: collected.pathStatus,
      partialReason,
    });
  }

  cards.sort((left, right) => left.title.localeCompare(right.title));
  const partial =
    cards.length === 0 || cards.some((card) => card.partialReason != null || !card.confirmed);
  let partialReason: string | null = null;
  if (cards.length === 0) {
    partialReason = "Keine fachlichen Informationen aus Scan-Signalen ableitbar.";
  } else if (cards.some((card) => card.pathStatus === "empty")) {
    partialReason = "Einige Informationen ohne belegten Lineage-Pfad.";
  } else if (partial) {
    partialReason = "Darstellung enthält PARTIAL/UNKNOWN/CONFLICTED Zustände.";
  }

  return { cards, partial, partialReason };
}
