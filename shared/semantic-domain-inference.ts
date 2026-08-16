/** Evidence-driven business-domain inference shared by Local Engine and UI projections. */

import type { SoftwareGraph, SoftwareGraphNode } from "./software-graph.types.js";
import type { SemanticEntity, SemanticEvidenceRef } from "./semantic-system-model.types.js";

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

const TECHNICAL_SUFFIX =
  /(?:[-_. ]?(?:services?|controllers?|repositor(?:y|ies)|screens?|pages?|stores?|hooks?|handlers?|models?|entit(?:y|ies)|routes?))$/i;
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
  value = singularize(value);
  if (!value || STRUCTURAL_DOMAIN_NAMES.has(value)) return null;
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

export function inferBusinessDomainEntities(graph: SoftwareGraph): SemanticEntity[] {
  const candidates = new Map<string, DomainCandidate>();
  for (const node of graph.nodes) {
    if (node.kind === "route") {
      addCandidate(candidates, routeResource(node), "route", node.id, 0.9);
    } else if (node.kind === "table") {
      addCandidate(candidates, node.label, "table", node.id, 0.95);
    } else if (node.kind === "service" || node.kind === "repository") {
      addCandidate(candidates, node.label, node.kind, node.id, 0.75);
    }
  }
  for (const node of graph.nodes) {
    if (node.kind === "domain") addCorroboratingGraphDomain(candidates, node);
  }
  return [...candidates.values()]
    .map((candidate): SemanticEntity => ({
      id: `semantic:business-domain:${candidate.key}`,
      kind: "business-domain",
      label: displayLabel(candidate.key),
      confidence: candidateConfidence(candidate),
      evidence: candidateEvidence(candidate),
      metadata: {
        candidateKey: candidate.key,
        sourceKinds: [...candidate.sourceKinds].sort(),
      },
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
