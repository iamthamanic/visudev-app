/** Orchestrates VisuDevGraph export: coerce → sanitize → trim → validate. */

import type { VisuDevGraph } from "../../dto/graph/visudev-graph.dto.ts";
import type {
  CodeFact,
  FactSelectionReport,
} from "../../dto/blueprint/blueprint-document.dto.ts";
import {
  coerceVisuDevGraphInput,
  validateVisuDevGraphForExport,
} from "../../validators/visudev-graph.validator.ts";
import { repairGraphReferences } from "./graph-export-integrity.ts";
import { sanitizeGraphForExport } from "./graph-export-sanitize.ts";
import { trimGraphEvidence } from "./graph-export-trim.ts";

export const MAX_BLUEPRINT_FACTS = 500;

/** Lower index = higher priority. Facts of unlisted kinds rank last. */
export const FACT_EXPORT_PRIORITY: readonly string[] = [
  "auth-check",
  "validation-deny-400",
  "db-write",
  "db-read",
  "route",
  "ast-import",
  "ast-call",
  "infra-service",
];

/** visudev-gapclose P1-3: never first-N truncate prisma schema models. */
export function isPrismaSchemaModelFact(fact: CodeFact): boolean {
  return (
    fact.kind === "db-write" &&
    fact.metadata?.framework === "prisma" &&
    fact.metadata?.operation === "prisma-model"
  );
}

/** visudev-gapclose P3-2b: keep compose/datasource infra facts past soft fact cap. */
export function isInfraServiceExportFact(fact: CodeFact): boolean {
  return (
    fact.kind === "infra-service" &&
    typeof fact.metadata?.service === "string" &&
    fact.metadata.service.trim().length > 0
  );
}

/** Soft bound so malformed floods cannot unbounded-bypass MAX_BLUEPRINT_FACTS. */
export const MAX_PRESERVED_INFRA_SERVICE_FACTS = 16;

/**
 * P0-9: dependency facts must survive prisma-model soft-cap starvation, otherwise
 * SoftwareGraph never gets imports/calls edges. Caps match browo-hr/backend
 * measurement (≥500 resolved imports, ≥200 resolved calls) with a small buffer.
 */
export const MAX_PRESERVED_IMPORT_FACTS = 520;
export const MAX_PRESERVED_CALL_FACTS = 220;

export function isDependencyExportFact(fact: CodeFact): boolean {
  return fact.kind === "ast-import" || fact.kind === "ast-call";
}

function hasResolvedDependencyTarget(fact: CodeFact): boolean {
  if (fact.kind === "ast-import") {
    return typeof fact.metadata?.resolvedPath === "string" &&
      fact.metadata.resolvedPath.length > 0;
  }
  if (fact.kind === "ast-call") {
    return typeof fact.metadata?.targetFile === "string" &&
      fact.metadata.targetFile.length > 0;
  }
  return false;
}

/** Single pass partition + two bounded coverage selects (import then call). */
function selectDependencyFactsForExport(
  dependencies: readonly CodeFact[],
): CodeFact[] {
  const resolvedImports: CodeFact[] = [];
  const resolvedCalls: CodeFact[] = [];
  for (const fact of dependencies) {
    if (!hasResolvedDependencyTarget(fact)) continue;
    if (fact.kind === "ast-import") resolvedImports.push(fact);
    else if (fact.kind === "ast-call") resolvedCalls.push(fact);
  }
  return [
    ...selectRestFactsByPriorityAndCoverage(
      resolvedImports,
      MAX_PRESERVED_IMPORT_FACTS,
    ),
    ...selectRestFactsByPriorityAndCoverage(
      resolvedCalls,
      MAX_PRESERVED_CALL_FACTS,
    ),
  ];
}

function priorityRank(kind: string): number {
  const idx = FACT_EXPORT_PRIORITY.indexOf(kind);
  return idx >= 0 ? idx : FACT_EXPORT_PRIORITY.length;
}

function countFactsByKind(facts: readonly CodeFact[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fact of facts) {
    counts[fact.kind] = (counts[fact.kind] ?? 0) + 1;
  }
  return counts;
}

export function buildFactSelectionReport(
  extracted: readonly CodeFact[],
  selected: readonly CodeFact[],
): FactSelectionReport {
  const extractedByKind = countFactsByKind(extracted);
  const selectedByKind = countFactsByKind(selected);
  const kinds = new Set([
    ...Object.keys(extractedByKind),
    ...Object.keys(selectedByKind),
  ]);
  const byKind: FactSelectionReport["byKind"] = {};
  for (const kind of kinds) {
    byKind[kind] = {
      extracted: extractedByKind[kind] ?? 0,
      selected: selectedByKind[kind] ?? 0,
    };
  }
  const filesCovered = new Set(selected.map((fact) => fact.filePath)).size;
  return {
    extracted: extracted.length,
    selected: selected.length,
    filesCovered,
    byKind,
  };
}

/** Round-robin across files within each priority tier until budget is spent. */
export function selectRestFactsByPriorityAndCoverage(
  rest: readonly CodeFact[],
  budget: number,
): CodeFact[] {
  if (budget <= 0 || rest.length === 0) return [];

  const tiers = new Map<number, Map<string, CodeFact[]>>();
  for (const fact of rest) {
    const rank = priorityRank(fact.kind);
    if (!tiers.has(rank)) tiers.set(rank, new Map());
    const byFile = tiers.get(rank)!;
    if (!byFile.has(fact.filePath)) byFile.set(fact.filePath, []);
    byFile.get(fact.filePath)!.push(fact);
  }

  const selected: CodeFact[] = [];
  const sortedRanks = [...tiers.keys()].sort((a, b) => a - b);

  for (const rank of sortedRanks) {
    const byFile = tiers.get(rank)!;
    const filePaths = [...byFile.keys()].sort((a, b) => a.localeCompare(b));
    const nextIndex = new Map<string, number>();
    for (const filePath of filePaths) nextIndex.set(filePath, 0);

    let activeFiles = [...filePaths];
    while (activeFiles.length > 0 && selected.length < budget) {
      const stillActive: string[] = [];
      for (const filePath of activeFiles) {
        if (selected.length >= budget) break;
        const facts = byFile.get(filePath)!;
        const index = nextIndex.get(filePath) ?? 0;
        if (index < facts.length) {
          selected.push(facts[index]);
          const next = index + 1;
          nextIndex.set(filePath, next);
          if (next < facts.length) stillActive.push(filePath);
        }
      }
      activeFiles = stillActive;
    }
    if (selected.length >= budget) break;
  }

  return selected;
}

/**
 * Cap facts for export while keeping **all** prisma-model facts from parsed schemas
 * and a bounded set of infra-service engine facts (Postgres/Redis). Soft-cap may drop
 * other facts using priority + per-file coverage instead of positional slice.
 * P0-9 also keeps a bounded set of ast-import/ast-call facts past prisma starvation.
 */
export function selectFactsPreservingPrismaModels(
  facts: CodeFact[],
  limit: number = MAX_BLUEPRINT_FACTS,
): { facts: CodeFact[]; report: FactSelectionReport } {
  const models: CodeFact[] = [];
  const infra: CodeFact[] = [];
  const dependencies: CodeFact[] = [];
  const rest: CodeFact[] = [];
  const seenInfraServices = new Set<string>();
  for (const fact of facts) {
    if (isPrismaSchemaModelFact(fact)) {
      models.push(fact);
      continue;
    }
    if (isInfraServiceExportFact(fact)) {
      const service = String(fact.metadata?.service ?? "")
        .trim()
        .toLowerCase();
      if (
        service &&
        !seenInfraServices.has(service) &&
        infra.length < MAX_PRESERVED_INFRA_SERVICE_FACTS
      ) {
        seenInfraServices.add(service);
        infra.push(fact);
      }
      continue;
    }
    if (isDependencyExportFact(fact)) {
      dependencies.push(fact);
      continue;
    }
    rest.push(fact);
  }
  // Honesty: keep every model + bounded infra engines even if over limit.
  const preserved = [...models, ...infra];
  const remaining = Math.max(0, limit - preserved.length);
  const selectedRest = selectRestFactsByPriorityAndCoverage(rest, remaining);
  // P0-9: dependency edges need exported metadata — prefer resolved targets.
  const selectedDependencies = selectDependencyFactsForExport(dependencies);
  const selectedFacts = [
    ...preserved,
    ...selectedRest,
    ...selectedDependencies,
  ];
  return {
    facts: selectedFacts,
    report: buildFactSelectionReport(facts, selectedFacts),
  };
}

export function capGraphForExport(input: unknown): VisuDevGraph {
  const coerced = coerceVisuDevGraphInput(input);
  const sanitized = sanitizeGraphForExport(coerced);
  const capped = sanitized.evidence.length > MAX_BLUEPRINT_FACTS
    ? trimGraphEvidence(sanitized, MAX_BLUEPRINT_FACTS)
    : sanitized;
  const repaired = repairGraphReferences(capped);
  return validateVisuDevGraphForExport(repaired);
}
