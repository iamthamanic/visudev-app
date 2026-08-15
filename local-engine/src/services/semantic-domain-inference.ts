/**
 * Evidence-driven business-domain inference for the SemanticSystemModel.
 *
 * The SoftwareGraph may contain structural `domain` nodes derived from folder
 * layout. This module deliberately treats those as only one weak signal and
 * combines them with stronger resource signals from routes, tables and named
 * services/repositories. Technical structure names are rejected.
 */

import type {
  SoftwareGraph,
  SoftwareGraphNode,
} from "../../../shared/software-graph.types.js";
import type {
  SemanticEntity,
  SemanticEvidenceRef,
} from "../../../shared/semantic-system-model.types.js";

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
  /(?:[-_. ]?(?:service|controller|repository|screen|page|store|hook|handler|model|entity|route|routes))$/i;

const ROUTE_PREFIX = /^(?:api|rest|graphql|v\d+)$/i;

interface DomainCandidate {
  key: string;
  evidence: SemanticEvidenceRef[];
  sourceKinds: Set<string>;
  maxConfidence: number;
}

function singularize(value: string): string {
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 3 && value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }
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
  const segment = path
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(":"))
    .find((part) => !ROUTE_PREFIX.test(part));
  return segment ?? null;
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
    evidence: [],
    sourceKinds: new Set<string>(),
    maxConfidence: 0,
  };
  const evidenceKey = `graph-node:${refId}`;
  if (!current.evidence.some((item) => `${item.source}:${item.refId}` === evidenceKey)) {
    current.evidence.push({ source: "graph-node", refId });
  }
  current.sourceKinds.add(sourceKind);
  current.maxConfidence = Math.max(current.maxConfidence, confidence);
  candidates.set(key, current);
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
  return Math.min(0.98, candidate.maxConfidence + corroboration);
}

export function inferBusinessDomainEntities(graph: SoftwareGraph): SemanticEntity[] {
  const candidates = new Map<string, DomainCandidate>();

  for (const node of graph.nodes) {
    if (node.kind === "route") {
      addCandidate(candidates, routeResource(node), "route", node.id, 0.9);
      continue;
    }
    if (node.kind === "table") {
      addCandidate(candidates, node.label, "table", node.id, 0.95);
      continue;
    }
    if (node.kind === "service" || node.kind === "repository") {
      addCandidate(candidates, node.label, node.kind, node.id, 0.75);
      continue;
    }
    if (node.kind === "domain") {
      addCandidate(candidates, node.label, "graph-domain", node.id, 0.65);
    }
  }

  return [...candidates.values()]
    .map((candidate): SemanticEntity => ({
      id: `semantic:business-domain:${candidate.key}`,
      kind: "business-domain",
      label: displayLabel(candidate.key),
      confidence: candidateConfidence(candidate),
      evidence: [...candidate.evidence].sort((left, right) => left.refId.localeCompare(right.refId)),
      metadata: {
        candidateKey: candidate.key,
        sourceKinds: [...candidate.sourceKinds].sort(),
      },
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}
