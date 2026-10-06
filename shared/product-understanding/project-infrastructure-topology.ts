/**
 * Purpose-first infrastructure system topology from ProductUnderstanding (PU-12).
 * Logical system parts + connection meanings; vendor/runtime only as optional detail.
 * Location: shared/product-understanding/project-infrastructure-topology.ts
 */

import {
  isAuthoritativeKnowledgeStatus,
  type KnowledgeStatus,
} from "../scan-detector/epistemic.js";
import { isSecurityControlLabel } from "../semantic-taxonomy-v2.js";
import type { SoftwareGraph, SoftwareGraphNode } from "../software-graph.types.js";
import type {
  ProductConcept,
  ProductConceptKind,
  ProductRelation,
  ProductRelationKind,
  ProductUnderstandingModel,
} from "../product-understanding.types.js";
import { presentProductConceptExplanation } from "./explanation-presenter.js";

export const INFRA_TOPOLOGY_MAX_PARTS = 48;

export type SystemTopologyRole =
  | "application"
  | "client"
  | "backend"
  | "auth"
  | "data"
  | "storage"
  | "ai"
  | "external"
  | "unknown";

export type SystemTopologyCoverage = "present" | "partial" | "absent" | "unsupported";

export interface SystemTopologyTechnicalDetail {
  runtime: string | null;
  provider: string | null;
  region: string | null;
  env: string | null;
}

export interface SystemTopologyPart {
  id: string;
  conceptId: string;
  label: string;
  role: SystemTopologyRole;
  roleLabel: string;
  purpose: string;
  knowledgeStatus: KnowledgeStatus;
  evidenceCount: number;
  confirmed: boolean;
  technical: SystemTopologyTechnicalDetail | null;
  graphNodeIds: string[];
}

export interface SystemTopologyConnection {
  id: string;
  sourcePartId: string;
  targetPartId: string;
  meaning: string;
  relationKind: ProductRelationKind;
  knowledgeStatus: KnowledgeStatus;
  evidenceCount: number;
  confirmed: boolean;
}

export interface InfrastructureSystemTopologyProjection {
  parts: SystemTopologyPart[];
  connections: SystemTopologyConnection[];
  partial: boolean;
  partialReason: string | null;
  coverage: SystemTopologyCoverage;
}

const TOPOLOGY_KINDS = new Set<ProductConceptKind>([
  "application",
  "system-part",
  "external-system",
]);

const ROLE_LABEL_DE: Record<SystemTopologyRole, string> = {
  application: "Anwendung",
  client: "Client",
  backend: "Backend",
  auth: "Auth",
  data: "Daten",
  storage: "Speicher",
  ai: "KI",
  external: "Extern",
  unknown: "Systemteil",
};

const RELATION_MEANING_DE: Record<ProductRelationKind, string> = {
  contains: "enthält",
  enables: "ermöglicht",
  uses: "nutzt",
  impacts: "beeinflusst",
  "flows-to": "leitet weiter an",
  "belongs-to": "gehört zu",
  triggers: "löst aus",
};

export interface ProjectInfrastructureSystemTopologyOptions {
  /** Optional graph for Level-2/3 technical descriptors (never secrets). */
  software?: SoftwareGraph | null;
  maxParts?: number;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ");
}

function purposeFor(model: ProductUnderstandingModel, concept: ProductConcept): string {
  if (concept.summary?.trim()) return concept.summary.trim().slice(0, 180);
  const view = presentProductConceptExplanation(model, concept.id);
  if (view?.level1?.body) return view.level1.body.slice(0, 180);
  return `${concept.label} — Zweck noch nicht belegt.`;
}

function graphNodeIdsFor(concept: ProductConcept): string[] {
  const ids = [
    ...(concept.technicalRefs ?? [])
      .filter((ref) => ref.source === "software-graph")
      .map((ref) => ref.refId),
    ...concept.evidence.filter((ref) => ref.source === "software-graph").map((ref) => ref.refId),
  ];
  return [...new Set(ids.filter(Boolean))];
}

/**
 * Role from concept kind + label signals already present on the concept.
 * Does not invent roles without a product concept.
 */
export function classifySystemTopologyRole(concept: ProductConcept): SystemTopologyRole {
  if (concept.kind === "application") return "application";
  if (concept.kind === "external-system") return "external";

  const label = concept.label;
  const hay = normalize(label);
  if (isSecurityControlLabel(label) || /\b(auth|oauth|jwt|login|identity|sso)\b/.test(hay)) {
    return "auth";
  }
  if (/\b(openai|anthropic|llm|embedding|ai|gpt|ml model|inference)\b/.test(hay)) {
    return "ai";
  }
  if (/\b(s3|blob|bucket|object storage|file storage|minio|storage)\b/.test(hay)) {
    return "storage";
  }
  if (/\b(postgres|mysql|mongo|redis|database|db|table|datastore|supabase)\b/.test(hay)) {
    return "data";
  }
  if (/\b(frontend|client|browser|web app|spa|mobile|ui)\b/.test(hay)) {
    return "client";
  }
  if (/\b(api|backend|server|service|gateway|worker|runtime)\b/.test(hay)) {
    return "backend";
  }
  return "unknown";
}

function meaningFor(
  relation: ProductRelation,
  sourceRole: SystemTopologyRole,
  targetRole: SystemTopologyRole,
): string {
  if (sourceRole === "auth" && (relation.kind === "enables" || relation.kind === "uses")) {
    return "authentifiziert";
  }
  if (
    (targetRole === "data" || targetRole === "storage") &&
    (relation.kind === "uses" || relation.kind === "flows-to")
  ) {
    return "speichert";
  }
  if (targetRole === "external" && (relation.kind === "uses" || relation.kind === "triggers")) {
    return "ruft auf";
  }
  return RELATION_MEANING_DE[relation.kind] ?? relation.kind;
}

function readTechnicalDetail(
  node: SoftwareGraphNode | undefined,
): SystemTopologyTechnicalDetail | null {
  if (!node?.metadata || typeof node.metadata !== "object") return null;
  const metadata = node.metadata as Record<string, unknown>;
  const asTrimmed = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;

  // Never surface secret-like keys — only known deployment descriptors.
  const runtime =
    asTrimmed(metadata.runtime) ??
    asTrimmed(metadata.framework) ??
    asTrimmed(metadata.language) ??
    null;
  const provider =
    asTrimmed(metadata.provider) ?? asTrimmed(metadata.cloud) ?? asTrimmed(metadata.vendor) ?? null;
  const region = asTrimmed(metadata.region) ?? null;
  const env = asTrimmed(metadata.env) ?? asTrimmed(metadata.environment) ?? null;

  if (!runtime && !provider && !region && !env) return null;
  return { runtime, provider, region, env };
}

function technicalForPart(
  concept: ProductConcept,
  software: SoftwareGraph | null | undefined,
): SystemTopologyTechnicalDetail | null {
  if (!software) return null;
  const byId = new Map(software.nodes.map((node) => [node.id, node]));
  for (const nodeId of graphNodeIdsFor(concept)) {
    const detail = readTechnicalDetail(byId.get(nodeId));
    if (detail) return detail;
  }
  return null;
}

/**
 * Project Product Understanding into a purpose-first infrastructure topology.
 */
export function projectInfrastructureSystemTopology(
  model: ProductUnderstandingModel,
  options: ProjectInfrastructureSystemTopologyOptions = {},
): InfrastructureSystemTopologyProjection {
  const maxParts = options.maxParts ?? INFRA_TOPOLOGY_MAX_PARTS;
  const concepts = model.concepts
    .filter((concept) => TOPOLOGY_KINDS.has(concept.kind))
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, maxParts);

  if (concepts.length === 0) {
    return {
      parts: [],
      connections: [],
      partial: true,
      partialReason:
        "Keine belegten Systemteile — Infrastructure ABSENT für Product Understanding.",
      coverage: "absent",
    };
  }

  const parts: SystemTopologyPart[] = concepts.map((concept) => {
    const role = classifySystemTopologyRole(concept);
    const evidenceCount = concept.evidence.length;
    return {
      id: concept.id,
      conceptId: concept.id,
      label: concept.label,
      role,
      roleLabel: ROLE_LABEL_DE[role],
      purpose: purposeFor(model, concept),
      knowledgeStatus: concept.knowledgeStatus,
      evidenceCount,
      confirmed: isAuthoritativeKnowledgeStatus(concept.knowledgeStatus) && evidenceCount > 0,
      technical: technicalForPart(concept, options.software),
      graphNodeIds: graphNodeIdsFor(concept),
    };
  });

  const partIds = new Set(parts.map((part) => part.id));
  const roleById = new Map(parts.map((part) => [part.id, part.role]));

  const connections: SystemTopologyConnection[] = model.relations
    .filter(
      (relation) => partIds.has(relation.sourceConceptId) && partIds.has(relation.targetConceptId),
    )
    .map((relation) => {
      const sourceRole = roleById.get(relation.sourceConceptId) ?? "unknown";
      const targetRole = roleById.get(relation.targetConceptId) ?? "unknown";
      const evidenceCount = relation.evidence.length;
      return {
        id: relation.id,
        sourcePartId: relation.sourceConceptId,
        targetPartId: relation.targetConceptId,
        meaning: meaningFor(relation, sourceRole, targetRole),
        relationKind: relation.kind,
        knowledgeStatus: relation.knowledgeStatus,
        evidenceCount,
        confirmed: isAuthoritativeKnowledgeStatus(relation.knowledgeStatus) && evidenceCount > 0,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  const weak = parts.some(
    (part) =>
      part.knowledgeStatus === "UNKNOWN" ||
      part.knowledgeStatus === "INTERPRETED" ||
      part.knowledgeStatus === "CONFLICTED" ||
      !part.confirmed,
  );
  const partial = weak || connections.length === 0;
  let partialReason: string | null = null;
  let coverage: SystemTopologyCoverage = "present";
  if (weak) {
    coverage = "partial";
    partialReason = "Teilweise belegte Systemtopologie (PARTIAL/UNKNOWN).";
  } else if (connections.length === 0) {
    coverage = "partial";
    partialReason = "Systemteile vorhanden, Verbindungen noch nicht belegt.";
  }

  return {
    parts,
    connections,
    partial,
    partialReason,
    coverage,
  };
}
