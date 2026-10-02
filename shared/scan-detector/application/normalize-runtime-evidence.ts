/**
 * Normalize RuntimeObserverCrawlResult → ScanFact / ScanEvidence (SDE-09).
 * Runtime-only observations stay as candidates; mismatches become conflicted.
 * Location: shared/scan-detector/application/normalize-runtime-evidence.ts
 */

import type { ScanEvidence, ScanFact } from "../types.js";
import type { RuntimeObserverCrawlResult } from "../domain/runtime/crawl-result.js";
import { RUNTIME_OBSERVER_DETECTOR_ID } from "../domain/runtime/runtime-observer-port.js";
import { redactEvidence, redactFact } from "../domain/evidence/redact.js";

export interface NormalizeRuntimeEvidenceInput {
  crawl: RuntimeObserverCrawlResult;
  detectorId?: string;
  /** Optional static subject ids known before runtime (screen/route). */
  knownStaticSubjectIds?: ReadonlySet<string>;
}

export interface NormalizeRuntimeEvidenceResult {
  facts: ScanFact[];
  evidence: ScanEvidence[];
  conflictCount: number;
  runtimeOnlyCount: number;
}

function subjectForScreen(screenId: string): string {
  return `screen:${screenId}`;
}

function subjectForRoute(route: string): string {
  return `route:${route}`;
}

function producedAt(crawl: RuntimeObserverCrawlResult): string {
  return crawl.crawledAt || new Date().toISOString();
}

/**
 * Convert a crawl result into engine facts/evidence.
 * Does not silently overwrite static claims — mismatch issues → conflicted facts.
 */
export function normalizeRuntimeEvidence(
  input: NormalizeRuntimeEvidenceInput,
): NormalizeRuntimeEvidenceResult {
  const detectorId = input.detectorId ?? RUNTIME_OBSERVER_DETECTOR_ID;
  const known = input.knownStaticSubjectIds ?? new Set<string>();
  const crawl = input.crawl;
  const facts: ScanFact[] = [];
  const evidence: ScanEvidence[] = [];
  let conflictCount = 0;
  let runtimeOnlyCount = 0;
  const at = producedAt(crawl);

  crawl.snapshots.forEach((snapshot, index) => {
    const subjectId = subjectForScreen(snapshot.screenId);
    const evidenceId = `evidence:runtime:snapshot:${snapshot.screenId}:${index}`;
    const isKnown = known.has(subjectId) || known.has(snapshot.screenId);
    if (!isKnown) runtimeOnlyCount += 1;

    evidence.push(
      redactEvidence({
        id: evidenceId,
        kind: "runtime-snapshot",
        status: "observed",
        confidence: 0.85,
        provenance: {
          originKind: "runtime",
          detectorId,
          producedAt: at,
        },
        payload: {
          summary: `Runtime snapshot ${snapshot.route}`,
          attributes: {
            route: snapshot.route,
            title: snapshot.title ?? null,
            interactiveCount: snapshot.interactiveCount,
            containerCount: snapshot.containerCount,
            openContainerCount: snapshot.openContainerCount,
            runtimeOnly: !isKnown,
          },
        },
        factIds: [`fact:runtime:screen:${snapshot.screenId}`],
      }),
    );

    facts.push(
      redactFact({
        id: `fact:runtime:screen:${snapshot.screenId}`,
        kind: "runtime.screen.observed",
        status: "observed",
        confidence: 0.85,
        provenance: {
          originKind: "runtime",
          detectorId,
          producedAt: at,
        },
        subjectId,
        evidenceIds: [evidenceId],
        attributes: {
          route: snapshot.route,
          runtimeOnly: !isKnown,
        },
      }),
    );
  });

  crawl.verifiedEdges.forEach((edge, index) => {
    const evidenceId = `evidence:runtime:edge:${edge.fromScreenId}:${index}`;
    const factId = `fact:runtime:edge:${edge.fromScreenId}:${edge.toScreenId ?? edge.targetPath ?? index}`;
    const toSubject = edge.toScreenId ? subjectForScreen(edge.toScreenId) : undefined;
    const isKnownTarget =
      !toSubject || known.has(toSubject) || (edge.toScreenId ? known.has(edge.toScreenId) : false);
    if (toSubject && !isKnownTarget) runtimeOnlyCount += 1;

    evidence.push(
      redactEvidence({
        id: evidenceId,
        kind: edge.verification === "route-change" ? "runtime-navigation" : "runtime-state-change",
        status: "observed",
        confidence: 0.9,
        provenance: {
          originKind: "runtime",
          detectorId,
          producedAt: at,
        },
        payload: {
          summary: `Runtime verified ${edge.type}`,
          attributes: {
            sourceRoute: edge.sourceRoute,
            targetRoute: edge.targetRoute ?? null,
            targetPath: edge.targetPath ?? null,
            matchedBy: edge.matchedBy ?? null,
            triggerLabel: edge.trigger?.label ?? null,
            // Never persist raw screenshot bytes/tokens — URL presence only.
            hasScreenshot: Boolean(edge.screenshotUrl),
          },
        },
        factIds: [factId],
      }),
    );

    facts.push(
      redactFact({
        id: factId,
        kind: "runtime.transition.observed",
        status: "observed",
        confidence: 0.9,
        provenance: {
          originKind: "runtime",
          detectorId,
          producedAt: at,
        },
        subjectId: subjectForScreen(edge.fromScreenId),
        objectId: toSubject ?? (edge.targetPath ? subjectForRoute(edge.targetPath) : undefined),
        evidenceIds: [evidenceId],
        attributes: {
          edgeType: edge.type,
          verification: edge.verification,
          runtimeOnly: Boolean(toSubject && !isKnownTarget),
        },
      }),
    );
  });

  for (const issue of crawl.issues) {
    const isMismatch =
      issue.code === "graph_without_runtime_match" || issue.code === "dom_without_graph_match";
    if (!isMismatch) continue;
    conflictCount += 1;
    const subjectId = issue.screenId
      ? subjectForScreen(issue.screenId)
      : `issue:${issue.code}:${facts.length}`;
    const evidenceId = `evidence:runtime:conflict:${issue.code}:${conflictCount}`;
    const factId = `fact:runtime:conflict:${issue.code}:${conflictCount}`;

    evidence.push(
      redactEvidence({
        id: evidenceId,
        kind: "runtime-static-mismatch",
        status: "conflicted",
        confidence: 0.7,
        provenance: {
          originKind: "runtime",
          detectorId,
          producedAt: at,
        },
        payload: {
          summary: issue.message,
          attributes: {
            code: issue.code,
            severity: issue.severity,
            triggerLabel: issue.triggerLabel ?? null,
            targetScreenId: issue.targetScreenId ?? null,
          },
        },
        factIds: [factId],
      }),
    );

    facts.push(
      redactFact({
        id: factId,
        kind: "runtime.static.conflict",
        status: "conflicted",
        confidence: 0.7,
        provenance: {
          originKind: "runtime",
          detectorId,
          producedAt: at,
        },
        subjectId,
        objectId: issue.targetScreenId ? subjectForScreen(issue.targetScreenId) : undefined,
        evidenceIds: [evidenceId],
        attributes: {
          code: issue.code,
          severity: issue.severity,
        },
      }),
    );
  }

  return { facts, evidence, conflictCount, runtimeOnlyCount };
}
