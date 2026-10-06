/** Evidence-driven business-domain inference shared by Local Engine and UI projections. */

import type { KnowledgeStatus } from "./scan-detector/epistemic.js";
import type { SoftwareGraph, SoftwareGraphNode } from "./software-graph.types.js";
import type { SemanticEntity, SemanticEvidenceRef } from "./semantic-system-model.types.js";
import {
  isResourceNotBusinessDomain,
  knowledgeStatusFromSignals,
  qualifiesAsBusinessDomain,
} from "./semantic-taxonomy-v2.js";

const STRUCTURAL_DOMAIN_NAMES = new Set([
  "api",
  "app",
  "backend",
  "browser",
  "client",
  "common",
  "component",
  "components",
  "config",
  "controller",
  "controllers",
  "edge",
  "feature",
  "features",
  "frontend",
  "hook",
  "hooks",
  "import",
  "imports",
  "index",
  "layout",
  "layouts",
  "lib",
  "libs",
  "model",
  "models",
  "module",
  "modules",
  "page",
  "pages",
  "repository",
  "repositories",
  "root",
  "route",
  "routes",
  "screen",
  "screens",
  "script",
  "scripts",
  "server",
  "service",
  "services",
  "shared",
  "src",
  "store",
  "stores",
  "type",
  "types",
  "unassigned",
  "unknown",
  "util",
  "utils",
  "view",
  "views",
  "web",
  "worker",
]);

/** True when a token is a technical folder / layer name, not a product domain. */
export function isStructuralDomainName(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value.length > 0 && STRUCTURAL_DOMAIN_NAMES.has(value);
}

const TECHNICAL_SUFFIX =
  /(?:[-_. ]?(?:services?|controllers?|repositor(?:y|ies)|screens?|pages?|stores?|hooks?|handlers?|models?|entit(?:y|ies)|routes?))$/i;
const NAMED_SEMANTIC_ARTIFACT_SUFFIX =
  /(?:services?|controllers?|repositor(?:y|ies)|handlers?|use[-_. ]?cases?)$/i;
const ROUTE_PREFIX = /^(?:api|rest|graphql|v\d+)$/i;

interface DomainCandidate {
  key: string;
  evidenceIds: Set<string>;
  sourceKinds: Set<string>;
  maxConfidence: number;
}

function singularize(value: string): string {
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
}

export function normalizeBusinessDomainCandidate(raw: string): string | null {
  let value = raw
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(TECHNICAL_SUFFIX, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!value || STRUCTURAL_DOMAIN_NAMES.has(value)) return null;
  if (isResourceNotBusinessDomain(value)) return null;
  value = singularize(value);
  if (!value || STRUCTURAL_DOMAIN_NAMES.has(value)) return null;
  if (isResourceNotBusinessDomain(value)) return null;
  return value;
}

function routeResource(node: SoftwareGraphNode): string | null {
  const path = node.metadata.path;
  if (typeof path !== "string") return null;
  return (
    path
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part && !part.startsWith(":"))
      .find((part) => !ROUTE_PREFIX.test(part)) ?? null
  );
}

function namedSemanticArtifact(node: SoftwareGraphNode): string | null {
  const label = node.label.trim();
  return NAMED_SEMANTIC_ARTIFACT_SUFFIX.test(label) ? label : null;
}

function addCandidate(
  candidates: Map<string, DomainCandidate>,
  raw: string | null,
  sourceKind: string,
  refId: string,
  confidence: number,
): void {
  if (!raw) return;
  const key = normalizeBusinessDomainCandidate(raw);
  if (!key) return;
  const current = candidates.get(key) ?? {
    key,
    evidenceIds: new Set<string>(),
    sourceKinds: new Set<string>(),
    maxConfidence: 0,
  };
  current.evidenceIds.add(refId);
  current.sourceKinds.add(sourceKind);
  current.maxConfidence = Math.max(current.maxConfidence, confidence);
  candidates.set(key, current);
}

function addCorroboratingGraphDomain(
  candidates: Map<string, DomainCandidate>,
  node: SoftwareGraphNode,
): void {
  const key = normalizeBusinessDomainCandidate(node.label);
  if (!key || !candidates.has(key)) return;
  addCandidate(candidates, node.label, "graph-domain", node.id, 0.65);
}

function displayLabel(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function candidateConfidence(candidate: DomainCandidate): number {
  const corroboration = Math.max(0, candidate.sourceKinds.size - 1) * 0.05;
  return Math.round(Math.min(0.98, candidate.maxConfidence + corroboration) * 100) / 100;
}

function candidateEvidence(candidate: DomainCandidate): SemanticEvidenceRef[] {
  return [...candidate.evidenceIds]
    .sort((left, right) => left.localeCompare(right))
    .map((refId): SemanticEvidenceRef => ({ source: "graph-node", refId }));
}

function candidateKnowledgeStatus(candidate: DomainCandidate): KnowledgeStatus {
  return knowledgeStatusFromSignals({
    sourceKindCount: candidate.sourceKinds.size,
    maxConfidence: candidateConfidence(candidate),
    origin: "static",
  });
}

/**
 * Infer business-domain entities (multi-signal) and weak route-only resources (INTERPRETED).
 */
export function inferBusinessDomainEntities(graph: SoftwareGraph): SemanticEntity[] {
  const candidates = new Map<string, DomainCandidate>();
  for (const node of graph.nodes) {
    if (node.kind === "route") {
      addCandidate(candidates, routeResource(node), "route", node.id, 0.9);
    } else if (node.kind === "table") {
      addCandidate(candidates, node.label, "table", node.id, 0.95);
    } else if (node.kind === "service" || node.kind === "repository") {
      addCandidate(candidates, namedSemanticArtifact(node), node.kind, node.id, 0.75);
    }
  }
  for (const node of graph.nodes) {
    if (node.kind === "domain") addCorroboratingGraphDomain(candidates, node);
  }

  const entities: SemanticEntity[] = [];
  for (const candidate of [...candidates.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const sourceKinds = [...candidate.sourceKinds].sort();
    const confidence = candidateConfidence(candidate);
    const evidence = candidateEvidence(candidate);

    if (qualifiesAsBusinessDomain(sourceKinds)) {
      entities.push({
        id: `semantic:business-domain:${candidate.key}`,
        kind: "business-domain",
        label: displayLabel(candidate.key),
        confidence,
        knowledgeStatus: candidateKnowledgeStatus(candidate),
        evidence,
        metadata: {
          candidateKey: candidate.key,
          sourceKinds,
          taxonomyVersion: 2,
        },
      });
      continue;
    }

    // Single path-segment / weak heuristic → resource INTERPRETED (not business-domain).
    if (sourceKinds.length === 1 && sourceKinds[0] === "route") {
      entities.push({
        id: `semantic:resource:${candidate.key}`,
        kind: "resource",
        label: displayLabel(candidate.key),
        confidence: Math.min(confidence, 0.7),
        knowledgeStatus: "INTERPRETED",
        evidence,
        metadata: {
          candidateKey: candidate.key,
          sourceKinds,
          taxonomyVersion: 2,
          reason: "single-path-segment",
        },
      });
    }
  }
  return entities.sort((left, right) => left.id.localeCompare(right.id));
}
