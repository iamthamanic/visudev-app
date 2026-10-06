/**
 * Evolution product-history projection from Product Understanding / snapshot signatures (PU-14).
 * Semantic concept changes first; commit/SHA/files remain evidence drill-down.
 * Location: shared/product-understanding/project-evolution-product-history.ts
 */

import type { SoftwareGraphSnapshot } from "../software-graph.types.js";
import { areSnapshotsComparable } from "../semantic-history.js";
import type {
  ProductConceptKind,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";

export const EVOLUTION_PRODUCT_HISTORY_MAX_ITEMS = 40;

export type EvolutionChangeKind =
  | "application"
  | "product-area"
  | "capability"
  | "system-part"
  | "external-system"
  | "information"
  | "relation"
  | "story"
  | "data-meaning"
  | "unknown";

export type EvolutionChangeAction = "added" | "removed" | "changed";

export interface ProductUnderstandingHistorySnapshot {
  key: string;
  conceptSignatures: Record<string, string>;
  relationSignatures: Record<string, string>;
  storySignatures: Record<string, string>;
  dataMeaningSignatures: Record<string, string>;
}

export interface EvolutionProductChangeItem {
  id: string;
  action: EvolutionChangeAction;
  changeKind: EvolutionChangeKind;
  label: string;
  summary: string;
  signatureBefore: string | null;
  signatureAfter: string | null;
}

export interface EvolutionProductChangeGroup {
  id: string;
  changeKind: EvolutionChangeKind;
  title: string;
  action: EvolutionChangeAction;
  items: EvolutionProductChangeItem[];
}

export interface EvolutionProductHistoryProjection {
  comparable: boolean;
  incompatibleReason: string | null;
  identical: boolean;
  condensed: boolean;
  groups: EvolutionProductChangeGroup[];
  /** Flat preview for timeline density (capped). */
  previewItems: EvolutionProductChangeItem[];
  totals: {
    added: number;
    removed: number;
    changed: number;
  };
  evidence: {
    baseSnapshotId: string;
    targetSnapshotId: string;
    baseRef: string | null;
    targetRef: string | null;
    baseCommitSha: string | null;
    targetCommitSha: string | null;
  };
}

const KIND_TITLE_DE: Record<EvolutionChangeKind, string> = {
  application: "Anwendungen",
  "product-area": "Produktbereiche",
  capability: "Fähigkeiten",
  "system-part": "Systemteile / Verantwortlichkeiten",
  "external-system": "Externe Systeme",
  information: "Informationen",
  relation: "Beziehungen",
  story: "Nutzer→System-Stories",
  "data-meaning": "Datenbedeutungen",
  unknown: "Sonstige Konzepte",
};

const ACTION_COPY_DE: Record<EvolutionChangeAction, string> = {
  added: "hinzugefügt",
  removed: "entfernt",
  changed: "geändert",
};

function sortedRecord(record: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(record).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    out[key] = record[key] ?? "";
  }
  return out;
}

function mapProductKind(kind: ProductConceptKind): EvolutionChangeKind {
  switch (kind) {
    case "application":
    case "product-area":
    case "capability":
    case "system-part":
    case "external-system":
    case "information":
      return kind;
    default:
      return "unknown";
  }
}

/** Map semantic / graph signature kinds onto product-history buckets. */
export function mapSignatureKindToEvolutionChangeKind(kindToken: string): EvolutionChangeKind {
  const kind = kindToken.trim().toLowerCase();
  if (kind === "application") return "application";
  if (kind === "business-domain" || kind === "product-area" || kind === "domain") {
    return "product-area";
  }
  if (kind === "capability") return "capability";
  if (
    kind === "service" ||
    kind === "technical-module" ||
    kind === "endpoint" ||
    kind === "system-part" ||
    kind === "module" ||
    kind === "runtime"
  ) {
    return "system-part";
  }
  if (kind === "external-system" || kind === "external") return "external-system";
  if (kind === "data-store" || kind === "resource" || kind === "information" || kind === "table") {
    return "information";
  }
  if (kind === "relation" || kind.includes("->")) return "relation";
  return "unknown";
}

function parseSignature(signature: string): { kind: string; label: string } {
  const sep = signature.indexOf(":");
  if (sep <= 0) return { kind: "unknown", label: signature || "unbenannt" };
  return {
    kind: signature.slice(0, sep),
    label: signature.slice(sep + 1) || signature.slice(0, sep),
  };
}

function diffSignatureMaps(
  base: Record<string, string>,
  target: Record<string, string>,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const baseIds = new Set(Object.keys(base));
  const targetIds = new Set(Object.keys(target));
  for (const id of targetIds) {
    if (!baseIds.has(id)) {
      added.push(id);
      continue;
    }
    if (base[id] !== target[id]) changed.push(id);
  }
  for (const id of baseIds) {
    if (!targetIds.has(id)) removed.push(id);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return { added, removed, changed };
}

function itemFromSignature(
  id: string,
  action: EvolutionChangeAction,
  changeKind: EvolutionChangeKind,
  before: string | null,
  after: string | null,
): EvolutionProductChangeItem {
  const active = after ?? before ?? id;
  const parsed = parseSignature(active);
  const label = parsed.label || id;
  return {
    id: `${action}:${changeKind}:${id}`,
    action,
    changeKind,
    label,
    summary: `${KIND_TITLE_DE[changeKind].replace(/ \/ .*$/, "")} „${label}“ ${ACTION_COPY_DE[action]}.`,
    signatureBefore: before,
    signatureAfter: after,
  };
}

/**
 * Deterministic Product Understanding signatures for history compare.
 */
export function signaturesFromProductUnderstanding(
  model: ProductUnderstandingModel,
  key = `${model.projectId}:${model.analyzedAt}`,
): ProductUnderstandingHistorySnapshot {
  const conceptSignatures: Record<string, string> = {};
  for (const concept of model.concepts) {
    conceptSignatures[concept.id] = `${concept.kind}:${concept.label}:${concept.knowledgeStatus}`;
  }
  const relationSignatures: Record<string, string> = {};
  for (const relation of model.relations) {
    relationSignatures[relation.id] =
      `${relation.kind}:${relation.sourceConceptId}->${relation.targetConceptId}`;
  }
  const storySignatures: Record<string, string> = {};
  for (const story of model.stories) {
    storySignatures[story.id] = `story:${story.title}:${story.steps.length}`;
  }
  const dataMeaningSignatures: Record<string, string> = {};
  for (const meaning of model.dataMeanings) {
    dataMeaningSignatures[meaning.id] =
      `meaning:${meaning.conceptId}:${meaning.businessMeaning.slice(0, 80)}`;
  }
  return {
    key,
    conceptSignatures: sortedRecord(conceptSignatures),
    relationSignatures: sortedRecord(relationSignatures),
    storySignatures: sortedRecord(storySignatures),
    dataMeaningSignatures: sortedRecord(dataMeaningSignatures),
  };
}

function collectItems(
  action: EvolutionChangeAction,
  ids: readonly string[],
  changeKind: EvolutionChangeKind,
  base: Record<string, string>,
  target: Record<string, string>,
): EvolutionProductChangeItem[] {
  return ids.map((id) =>
    itemFromSignature(id, action, changeKind, base[id] ?? null, target[id] ?? null),
  );
}

function groupItems(items: EvolutionProductChangeItem[]): EvolutionProductChangeGroup[] {
  const map = new Map<string, EvolutionProductChangeGroup>();
  for (const item of items) {
    const key = `${item.changeKind}:${item.action}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    map.set(key, {
      id: key,
      changeKind: item.changeKind,
      action: item.action,
      title: `${KIND_TITLE_DE[item.changeKind]} ${ACTION_COPY_DE[item.action]}`,
      items: [item],
    });
  }
  return [...map.values()].sort((left, right) => left.title.localeCompare(right.title, "de"));
}

/**
 * Diff two Product Understanding history snapshots into grouped human-readable changes.
 */
export function diffProductUnderstandingHistory(
  base: ProductUnderstandingHistorySnapshot,
  target: ProductUnderstandingHistorySnapshot,
  options: { maxItems?: number } = {},
): Omit<EvolutionProductHistoryProjection, "evidence" | "comparable" | "incompatibleReason"> {
  const maxItems = options.maxItems ?? EVOLUTION_PRODUCT_HISTORY_MAX_ITEMS;
  const conceptDiff = diffSignatureMaps(base.conceptSignatures, target.conceptSignatures);
  const relationDiff = diffSignatureMaps(base.relationSignatures, target.relationSignatures);
  const storyDiff = diffSignatureMaps(base.storySignatures, target.storySignatures);
  const meaningDiff = diffSignatureMaps(base.dataMeaningSignatures, target.dataMeaningSignatures);

  const conceptItems: EvolutionProductChangeItem[] = [];
  for (const id of conceptDiff.added) {
    const after = target.conceptSignatures[id] ?? "";
    const kind = mapProductKind(parseSignature(after).kind as ProductConceptKind);
    conceptItems.push(itemFromSignature(id, "added", kind, null, after));
  }
  for (const id of conceptDiff.removed) {
    const before = base.conceptSignatures[id] ?? "";
    const kind = mapProductKind(parseSignature(before).kind as ProductConceptKind);
    conceptItems.push(itemFromSignature(id, "removed", kind, before, null));
  }
  for (const id of conceptDiff.changed) {
    const before = base.conceptSignatures[id] ?? "";
    const after = target.conceptSignatures[id] ?? "";
    const kind = mapProductKind(parseSignature(after || before).kind as ProductConceptKind);
    conceptItems.push(itemFromSignature(id, "changed", kind, before, after));
  }

  const items = [
    ...conceptItems,
    ...collectItems(
      "added",
      relationDiff.added,
      "relation",
      base.relationSignatures,
      target.relationSignatures,
    ),
    ...collectItems(
      "removed",
      relationDiff.removed,
      "relation",
      base.relationSignatures,
      target.relationSignatures,
    ),
    ...collectItems(
      "changed",
      relationDiff.changed,
      "relation",
      base.relationSignatures,
      target.relationSignatures,
    ),
    ...collectItems(
      "added",
      storyDiff.added,
      "story",
      base.storySignatures,
      target.storySignatures,
    ),
    ...collectItems(
      "removed",
      storyDiff.removed,
      "story",
      base.storySignatures,
      target.storySignatures,
    ),
    ...collectItems(
      "changed",
      storyDiff.changed,
      "story",
      base.storySignatures,
      target.storySignatures,
    ),
    ...collectItems(
      "added",
      meaningDiff.added,
      "data-meaning",
      base.dataMeaningSignatures,
      target.dataMeaningSignatures,
    ),
    ...collectItems(
      "removed",
      meaningDiff.removed,
      "data-meaning",
      base.dataMeaningSignatures,
      target.dataMeaningSignatures,
    ),
    ...collectItems(
      "changed",
      meaningDiff.changed,
      "data-meaning",
      base.dataMeaningSignatures,
      target.dataMeaningSignatures,
    ),
  ];

  const totals = {
    added: items.filter((item) => item.action === "added").length,
    removed: items.filter((item) => item.action === "removed").length,
    changed: items.filter((item) => item.action === "changed").length,
  };
  const condensed = items.length > maxItems;
  const previewItems = condensed ? items.slice(0, maxItems) : items;

  return {
    identical: items.length === 0,
    condensed,
    groups: groupItems(previewItems),
    previewItems,
    totals,
  };
}

/**
 * Project graph snapshot signatures into Product Understanding-style history groups.
 * Uses entity/node + relation signatures already stored on SoftwareGraphSnapshot.
 */
export function projectEvolutionProductHistoryFromSnapshots(
  base: SoftwareGraphSnapshot,
  target: SoftwareGraphSnapshot,
  options: { maxItems?: number } = {},
): EvolutionProductHistoryProjection {
  const compatibility = areSnapshotsComparable(base, target);
  const evidence = {
    baseSnapshotId: base.id,
    targetSnapshotId: target.id,
    baseRef: base.ref ?? null,
    targetRef: target.ref ?? null,
    baseCommitSha: base.commitSha ?? null,
    targetCommitSha: target.commitSha ?? null,
  };

  if (!compatibility.comparable) {
    return {
      comparable: false,
      incompatibleReason:
        compatibility.reason ??
        "Snapshots sind inkompatibel und werden nicht als semantischer Produktvergleich ausgegeben.",
      identical: false,
      condensed: false,
      groups: [],
      previewItems: [],
      totals: { added: 0, removed: 0, changed: 0 },
      evidence,
    };
  }

  const baseConcepts = base.nodeSignatures ?? {};
  const targetConcepts = target.nodeSignatures ?? {};
  const hasSignatures =
    Object.keys(baseConcepts).length +
      Object.keys(targetConcepts).length +
      Object.keys(base.relationSignatures ?? {}).length +
      Object.keys(target.relationSignatures ?? {}).length >
    0;

  if (!hasSignatures) {
    return {
      comparable: false,
      incompatibleReason:
        "Unzureichende semantische Snapshot-Signaturen — kein Produktvergleich möglich (nur Git/Files als Evidence).",
      identical: false,
      condensed: false,
      groups: [],
      previewItems: [],
      totals: { added: 0, removed: 0, changed: 0 },
      evidence,
    };
  }

  const remappedBaseConcepts: Record<string, string> = {};
  for (const [id, signature] of Object.entries(baseConcepts)) {
    const parsed = parseSignature(signature);
    const kind = mapSignatureKindToEvolutionChangeKind(parsed.kind);
    remappedBaseConcepts[id] = `${kind}:${parsed.label}`;
  }
  const remappedTargetConcepts: Record<string, string> = {};
  for (const [id, signature] of Object.entries(targetConcepts)) {
    const parsed = parseSignature(signature);
    const kind = mapSignatureKindToEvolutionChangeKind(parsed.kind);
    remappedTargetConcepts[id] = `${kind}:${parsed.label}`;
  }

  const baseHistory: ProductUnderstandingHistorySnapshot = {
    key: base.id,
    conceptSignatures: sortedRecord(remappedBaseConcepts),
    relationSignatures: sortedRecord(base.relationSignatures ?? {}),
    storySignatures: {},
    dataMeaningSignatures: {},
  };
  const targetHistory: ProductUnderstandingHistorySnapshot = {
    key: target.id,
    conceptSignatures: sortedRecord(remappedTargetConcepts),
    relationSignatures: sortedRecord(target.relationSignatures ?? {}),
    storySignatures: {},
    dataMeaningSignatures: {},
  };

  const diffed = diffProductUnderstandingHistory(baseHistory, targetHistory, options);
  return {
    comparable: true,
    incompatibleReason: null,
    ...diffed,
    evidence,
  };
}

export function projectEvolutionProductHistoryFromModels(
  baseModel: ProductUnderstandingModel,
  targetModel: ProductUnderstandingModel,
  evidence: EvolutionProductHistoryProjection["evidence"],
  options: { maxItems?: number } = {},
): EvolutionProductHistoryProjection {
  const diffed = diffProductUnderstandingHistory(
    signaturesFromProductUnderstanding(baseModel, evidence.baseSnapshotId),
    signaturesFromProductUnderstanding(targetModel, evidence.targetSnapshotId),
    options,
  );
  return {
    comparable: true,
    incompatibleReason: null,
    ...diffed,
    evidence,
  };
}
