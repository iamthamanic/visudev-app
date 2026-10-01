/**
 * Migration baseline types for SDE-01 shadow/compatibility contracts.
 * Location: shared/migration-baseline.types.ts
 */

export type MigrationEnrichmentMode = "off" | "on" | "unknown";

export interface SemanticBaselineFingerprint {
  version: 1;
  projectId: string;
  enrichment: MigrationEnrichmentMode;
  /** Documented unknown / partial-scan markers that are allowed to remain. */
  allowedUnknownKeys: string[];
  blueprint: {
    nodeKindCounts: Record<string, number>;
    edgeKindCounts: Record<string, number>;
    routeIds: string[];
    tableNodeIds: string[];
  };
  semantic: {
    entityKindCounts: Record<string, number>;
    relationKindCounts: Record<string, number>;
    businessDomainLabels: string[];
  };
  appflow: {
    screenIds: string[];
    flowIds: string[];
  };
  data: {
    tableIds: string[];
    tableLabels: string[];
  };
}

export interface ShadowParityFinding {
  path: string;
  expected: string;
  actual: string;
}

export interface ShadowParityResult {
  status: "pass" | "fail";
  missing: ShadowParityFinding[];
  unexpected: ShadowParityFinding[];
  conflicts: ShadowParityFinding[];
}
