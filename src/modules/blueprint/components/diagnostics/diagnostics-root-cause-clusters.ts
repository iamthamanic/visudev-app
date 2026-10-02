/**
 * RVP-10 Diagnostics root-cause clustering — group findings without inflating severity.
 * Location: src/modules/blueprint/components/diagnostics/diagnostics-root-cause-clusters.ts
 */

import type { BlueprintFinding, FindingSeverity, RouteBlueprint } from "../../types";
import { findingAreaLabel } from "./diagnostics-finding-area.js";

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface DiagnosticsFindingCluster {
  id: string;
  /** Stable root-cause key used for grouping. */
  rootCauseKey: string;
  ruleId: string;
  category: string;
  area: string;
  expectedState: string;
  actualState: string;
  /** Highest severity among cluster members — never raised past members. */
  severity: FindingSeverity;
  findingCount: number;
  routeCount: number;
  domainCount: number;
  componentCount: number;
  /** Mean confidence in [0,1]; not a certainty claim. */
  averageConfidence: number;
  /** Members with unknown/unclear epistemic state. */
  unknownCount: number;
  findingIds: string[];
  routeIds: string[];
  messageSample: string;
}

export interface ClusterFindingsInput {
  findings: readonly BlueprintFinding[];
  routes?: readonly RouteBlueprint[];
  /** Optional graph-node → domain label map for scope aggregation. */
  domainByNodeId?: ReadonlyMap<string, string>;
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase() || "unknown";
}

export function buildRootCauseKey(finding: BlueprintFinding): string {
  return [
    normalizeToken(finding.ruleId),
    normalizeToken(finding.category),
    normalizeToken(finding.expectedState),
    normalizeToken(finding.actualState),
  ].join("::");
}

export function isUnknownFindingState(finding: BlueprintFinding): boolean {
  const actual = normalizeToken(finding.actualState);
  const expected = normalizeToken(finding.expectedState);
  if (actual === "unknown" || expected === "unknown") return true;
  if (actual === "unverified" || expected === "unverified") return true;
  if (!Number.isFinite(finding.confidence) || finding.confidence < 0.4) return true;
  return false;
}

export function maxSeverity(severities: readonly FindingSeverity[]): FindingSeverity {
  let best: FindingSeverity = "info";
  for (const severity of severities) {
    if (SEVERITY_RANK[severity] > SEVERITY_RANK[best]) best = severity;
  }
  return best;
}

function scopeKind(
  scopeId: string,
  routesById: Map<string, RouteBlueprint>,
): "route" | "component" {
  if (routesById.has(scopeId)) return "route";
  if (scopeId.startsWith("route:") || scopeId.includes(" /") || scopeId.startsWith("GET ")) {
    return "route";
  }
  return "component";
}

/**
 * Cluster findings by rule + category + expected/actual state (root cause).
 * Severity = max of members only. Confidence stays an average; unknown counted separately.
 */
export function clusterFindingsByRootCause(
  input: ClusterFindingsInput,
): DiagnosticsFindingCluster[] {
  const findings = Array.isArray(input.findings) ? input.findings : [];
  const routesById = new Map((input.routes ?? []).map((route) => [route.id, route]));
  const domainByNodeId = input.domainByNodeId ?? new Map<string, string>();

  const buckets = new Map<string, BlueprintFinding[]>();
  for (const finding of findings) {
    const key = buildRootCauseKey(finding);
    const list = buckets.get(key) ?? [];
    list.push(finding);
    buckets.set(key, list);
  }

  const clusters: DiagnosticsFindingCluster[] = [];
  for (const [rootCauseKey, members] of buckets) {
    const first = members[0]!;
    const routeIds = new Set<string>();
    const componentIds = new Set<string>();
    const domainIds = new Set<string>();

    for (const member of members) {
      const scopeId = member.scopeId?.trim() || "";
      if (!scopeId) continue;
      if (scopeKind(scopeId, routesById) === "route") {
        routeIds.add(scopeId);
      } else {
        componentIds.add(scopeId);
      }
      const domain = domainByNodeId.get(scopeId);
      if (domain) domainIds.add(domain);
    }

    const confidenceSum = members.reduce((sum, member) => sum + (member.confidence || 0), 0);
    const unknownCount = members.filter(isUnknownFindingState).length;

    clusters.push({
      id: `cluster:${rootCauseKey}`,
      rootCauseKey,
      ruleId: first.ruleId,
      category: first.category,
      area: findingAreaLabel(first),
      expectedState: first.expectedState,
      actualState: first.actualState,
      severity: maxSeverity(members.map((member) => member.severity)),
      findingCount: members.length,
      routeCount: routeIds.size,
      domainCount: domainIds.size,
      componentCount: componentIds.size,
      averageConfidence: members.length > 0 ? confidenceSum / members.length : 0,
      unknownCount,
      findingIds: members.map((member) => member.id),
      routeIds: [...routeIds].sort((left, right) => left.localeCompare(right)),
      messageSample: first.message,
    });
  }

  return clusters.sort((left, right) => {
    const severityDelta = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (severityDelta !== 0) return severityDelta;
    if (right.findingCount !== left.findingCount) return right.findingCount - left.findingCount;
    return left.ruleId.localeCompare(right.ruleId);
  });
}

export function findingsForCluster(
  findings: readonly BlueprintFinding[],
  cluster: DiagnosticsFindingCluster | null,
): BlueprintFinding[] {
  if (!cluster) return [...findings];
  const ids = new Set(cluster.findingIds);
  return findings.filter((finding) => ids.has(finding.id));
}
