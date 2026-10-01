/**
 * Extract a semantic migration baseline fingerprint from analysis artifacts.
 * Additive / read-only — no detection logic, no UI consumer changes.
 * Location: shared/migration-baseline.ts
 */

import { buildSemanticSystemModel } from "./semantic-system-model.js";
import type { SemanticSystemModel } from "./semantic-system-model.types.js";
import type { SoftwareGraph } from "./software-graph.types.js";
import type {
  MigrationEnrichmentMode,
  SemanticBaselineFingerprint,
  ShadowParityFinding,
  ShadowParityResult,
} from "./migration-baseline.types.js";

export type {
  SemanticBaselineFingerprint,
  ShadowParityResult,
} from "./migration-baseline.types.js";

export interface MigrationBaselineInput {
  projectId: string;
  enrichment?: MigrationEnrichmentMode;
  allowedUnknownKeys?: string[];
  graph: SoftwareGraph | null | undefined;
  semanticModel?: SemanticSystemModel | null;
  routes?: ReadonlyArray<{ id?: string } | null> | null;
  /** AppFlow product slice screens (ids only). */
  screens?: ReadonlyArray<{ id?: string } | null> | null;
  /** AppFlow product slice flows (ids only). */
  flows?: ReadonlyArray<{ id?: string } | null> | null;
  /** Data/ERD tables when available beside graph table nodes. */
  dataTables?: ReadonlyArray<{ id?: string; label?: string; name?: string } | null> | null;
}

function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set([...values].filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function countByKey(keys: Iterable<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of keys) {
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function readIds(items: ReadonlyArray<{ id?: string } | null> | null | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return sortedUnique(
    items
      .map((item) => (item && typeof item.id === "string" ? item.id.trim() : ""))
      .filter(Boolean),
  );
}

/**
 * Build a deterministic semantic fingerprint for cutover/shadow comparisons.
 */
export function extractSemanticBaseline(
  input: MigrationBaselineInput,
): SemanticBaselineFingerprint {
  const graph = input.graph ?? null;
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];
  const semantic = input.semanticModel ?? (graph ? buildSemanticSystemModel(graph) : null);

  const tableNodeIds = sortedUnique(
    nodes.filter((node) => node.kind === "table").map((node) => node.id),
  );

  const dataTables = Array.isArray(input.dataTables) ? input.dataTables : [];
  const dataTableIds = sortedUnique(
    dataTables
      .map((table) => (table && typeof table.id === "string" ? table.id.trim() : ""))
      .filter(Boolean),
  );
  const dataTableLabels = sortedUnique(
    dataTables
      .map((table) => {
        if (!table) return "";
        if (typeof table.label === "string" && table.label.trim()) return table.label.trim();
        if (typeof table.name === "string" && table.name.trim()) return table.name.trim();
        return "";
      })
      .filter(Boolean),
  );

  // Prefer explicit Data slice tables; fall back to SoftwareGraph table nodes.
  const effectiveDataTableIds = dataTableIds.length > 0 ? dataTableIds : tableNodeIds;
  const effectiveDataLabels =
    dataTableLabels.length > 0
      ? dataTableLabels
      : sortedUnique(
          nodes.filter((node) => node.kind === "table").map((node) => node.label.trim()),
        );

  return {
    version: 1,
    projectId: input.projectId,
    enrichment: input.enrichment ?? "unknown",
    allowedUnknownKeys: sortedUnique(input.allowedUnknownKeys ?? []),
    blueprint: {
      nodeKindCounts: countByKey(nodes.map((node) => node.kind)),
      edgeKindCounts: countByKey(edges.map((edge) => edge.kind)),
      routeIds: readIds(input.routes),
      tableNodeIds,
    },
    semantic: {
      entityKindCounts: countByKey((semantic?.entities ?? []).map((entity) => entity.kind)),
      relationKindCounts: countByKey((semantic?.relations ?? []).map((relation) => relation.kind)),
      businessDomainLabels: sortedUnique(
        (semantic?.entities ?? [])
          .filter((entity) => entity.kind === "business-domain")
          .map((entity) => entity.label.trim()),
      ),
    },
    appflow: {
      screenIds: readIds(input.screens),
      flowIds: readIds(input.flows),
    },
    data: {
      tableIds: effectiveDataTableIds,
      tableLabels: effectiveDataLabels,
    },
  };
}

function pushMissing(findings: ShadowParityFinding[], path: string, expected: string): void {
  findings.push({ path, expected, actual: "<missing>" });
}

function pushUnexpected(findings: ShadowParityFinding[], path: string, actual: string): void {
  findings.push({ path, expected: "<absent>", actual });
}

function compareStringLists(
  path: string,
  expected: readonly string[],
  actual: readonly string[],
  missing: ShadowParityFinding[],
  unexpected: ShadowParityFinding[],
): void {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  for (const value of expectedSet) {
    if (!actualSet.has(value)) pushMissing(missing, path, value);
  }
  for (const value of actualSet) {
    if (!expectedSet.has(value)) pushUnexpected(unexpected, path, value);
  }
}

function compareCountMaps(
  path: string,
  expected: Record<string, number>,
  actual: Record<string, number>,
  conflicts: ShadowParityFinding[],
  missing: ShadowParityFinding[],
  unexpected: ShadowParityFinding[],
): void {
  const keys = sortedUnique([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    const left = expected[key];
    const right = actual[key];
    if (left == null && right != null) {
      pushUnexpected(unexpected, `${path}.${key}`, String(right));
      continue;
    }
    if (left != null && right == null) {
      pushMissing(missing, `${path}.${key}`, String(left));
      continue;
    }
    if (left !== right) {
      conflicts.push({
        path: `${path}.${key}`,
        expected: String(left),
        actual: String(right),
      });
    }
  }
}

/**
 * Compare legacy (expected) vs candidate (engine/shadow) fingerprints.
 * Does not switch UI consumers — pure comparison for migration gates.
 */
export function compareShadowParity(
  expected: SemanticBaselineFingerprint,
  actual: SemanticBaselineFingerprint,
): ShadowParityResult {
  const missing: ShadowParityFinding[] = [];
  const unexpected: ShadowParityFinding[] = [];
  const conflicts: ShadowParityFinding[] = [];

  if (expected.version !== actual.version) {
    conflicts.push({
      path: "version",
      expected: String(expected.version),
      actual: String(actual.version),
    });
  }

  compareCountMaps(
    "blueprint.nodeKindCounts",
    expected.blueprint.nodeKindCounts,
    actual.blueprint.nodeKindCounts,
    conflicts,
    missing,
    unexpected,
  );
  compareCountMaps(
    "blueprint.edgeKindCounts",
    expected.blueprint.edgeKindCounts,
    actual.blueprint.edgeKindCounts,
    conflicts,
    missing,
    unexpected,
  );
  compareStringLists(
    "blueprint.routeIds",
    expected.blueprint.routeIds,
    actual.blueprint.routeIds,
    missing,
    unexpected,
  );
  compareStringLists(
    "blueprint.tableNodeIds",
    expected.blueprint.tableNodeIds,
    actual.blueprint.tableNodeIds,
    missing,
    unexpected,
  );

  compareCountMaps(
    "semantic.entityKindCounts",
    expected.semantic.entityKindCounts,
    actual.semantic.entityKindCounts,
    conflicts,
    missing,
    unexpected,
  );
  compareCountMaps(
    "semantic.relationKindCounts",
    expected.semantic.relationKindCounts,
    actual.semantic.relationKindCounts,
    conflicts,
    missing,
    unexpected,
  );
  compareStringLists(
    "semantic.businessDomainLabels",
    expected.semantic.businessDomainLabels,
    actual.semantic.businessDomainLabels,
    missing,
    unexpected,
  );

  compareStringLists(
    "appflow.screenIds",
    expected.appflow.screenIds,
    actual.appflow.screenIds,
    missing,
    unexpected,
  );
  compareStringLists(
    "appflow.flowIds",
    expected.appflow.flowIds,
    actual.appflow.flowIds,
    missing,
    unexpected,
  );
  compareStringLists(
    "data.tableIds",
    expected.data.tableIds,
    actual.data.tableIds,
    missing,
    unexpected,
  );
  compareStringLists(
    "data.tableLabels",
    expected.data.tableLabels,
    actual.data.tableLabels,
    missing,
    unexpected,
  );

  return {
    status:
      missing.length === 0 && unexpected.length === 0 && conflicts.length === 0 ? "pass" : "fail",
    missing,
    unexpected,
    conflicts,
  };
}
