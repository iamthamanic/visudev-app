/**
 * Injectable port for reading git/filesystem analysis provenance during local scans.
 * Location: local-engine/src/services/analysis-origin.service.ts
 */

import { readGitSummary } from "../lib/git-summary.js";
import type { GitSummary } from "../types/api.types.js";
import type { AnalysisOrigin } from "../../../shared/software-graph.types.js";

export type AnalysisOriginReader = (localPath: string) => Promise<AnalysisOrigin>;

const COMMIT_SHA_PATTERN = /^[0-9a-f]{4,40}$/i;
const BRANCH_NAME_PATTERN = /^[^\s\0]{1,255}$/;

function normalizeCommitSha(sha: string | undefined): string | undefined {
  if (!sha?.trim()) return undefined;
  const trimmed = sha.trim();
  if (!COMMIT_SHA_PATTERN.test(trimmed)) return undefined;
  return trimmed.slice(0, 7);
}

function normalizeBranch(branch: string | undefined): string | undefined {
  if (!branch?.trim()) return undefined;
  const trimmed = branch.trim();
  return BRANCH_NAME_PATTERN.test(trimmed) ? trimmed : undefined;
}

export function isAnalysisOrigin(value: unknown): value is AnalysisOrigin {
  if (!value || typeof value !== "object") return false;
  const origin = value as AnalysisOrigin;
  if (origin.sourceKind !== "git" && origin.sourceKind !== "filesystem") return false;
  if (typeof origin.capturedAt !== "string" || !Number.isFinite(Date.parse(origin.capturedAt))) {
    return false;
  }
  if (typeof origin.dirty !== "boolean") return false;
  if (origin.sourceKind === "git") {
    if (!origin.commitSha || !COMMIT_SHA_PATTERN.test(origin.commitSha)) return false;
    if (origin.branch !== undefined && !BRANCH_NAME_PATTERN.test(origin.branch)) return false;
    return true;
  }
  if (origin.commitSha !== undefined || origin.branch !== undefined) return false;
  return true;
}

export type OriginWarnFn = (message: string, detail?: string) => void;

export interface AnalysisOriginReaderDeps {
  readGitSummary?: (localPath: string) => Promise<GitSummary>;
  logWarn?: OriginWarnFn;
}

const defaultOriginWarn: OriginWarnFn = (message, detail) => {
  console.warn(detail ? `${message}: ${detail}` : message);
};

/** Keep only safe git status codes — no absolute paths or home dirs. */
function sanitizeOriginDetail(raw: string): string {
  return raw
    .replace(/(?:[A-Za-z]:)?(?:\\|\/)[^\s:;]+/g, "***")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function resolveShortCommitSha(summary: GitSummary): string | undefined {
  const currentSha = normalizeCommitSha(summary.currentSha);
  if (!currentSha) return undefined;
  const branchHeadSha = summary.currentRef
    ? normalizeCommitSha(
        summary.branches.find((branch) => branch.name === summary.currentRef)?.headSha,
      )
    : undefined;
  if (branchHeadSha) {
    const raw = summary.currentSha?.trim() ?? "";
    if (raw.startsWith(branchHeadSha) || branchHeadSha.startsWith(raw)) {
      return branchHeadSha.length <= raw.length ? branchHeadSha : currentSha;
    }
  }
  return currentSha;
}

function hasOriginReadFailure(summary: GitSummary): boolean {
  const blockingPrefixes = ["rev-parse:", "current-sha:", "working-tree:"];
  return (
    summary.warnings?.some((warning) =>
      blockingPrefixes.some((prefix) => warning.startsWith(prefix)),
    ) ?? false
  );
}

export function createAnalysisOriginReader(deps: AnalysisOriginReaderDeps = {}) {
  const readSummary = deps.readGitSummary ?? readGitSummary;
  const logWarn = deps.logWarn ?? defaultOriginWarn;

  return async function readAnalysisOrigin(localPath: string): Promise<AnalysisOrigin> {
    const capturedAt = new Date().toISOString();
    try {
      const summary = await readSummary(localPath);
      const commitSha = resolveShortCommitSha(summary);
      if (!summary.initialized || !commitSha || hasOriginReadFailure(summary)) {
        if (summary.warnings?.length) {
          logWarn(
            "[analysis] Git origin incomplete; using filesystem provenance",
            sanitizeOriginDetail(summary.warnings.join("; ")),
          );
        }
        return { sourceKind: "filesystem", dirty: false, capturedAt };
      }
      const dirty =
        summary.workingTree.modified.length +
          summary.workingTree.added.length +
          summary.workingTree.deleted.length >
        0;
      return {
        sourceKind: "git",
        commitSha,
        branch: normalizeBranch(summary.currentRef),
        dirty,
        capturedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logWarn(
        "[analysis] Git origin unavailable; using filesystem provenance",
        sanitizeOriginDetail(message),
      );
      return { sourceKind: "filesystem", dirty: false, capturedAt };
    }
  };
}

export const readAnalysisOrigin = createAnalysisOriginReader();
