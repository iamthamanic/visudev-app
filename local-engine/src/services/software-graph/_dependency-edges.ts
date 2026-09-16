/**
 * Adds file-to-file dependency edges from AST import/call facts.
 */

import type { RawBlueprintFact } from "../../types/api.types.js";
import { ensureFileContext } from "./_file-context.js";
import { normalizePath } from "./_heuristics.js";
import { createId, stableUniqueId } from "./_ids.js";
import { sanitizeExcerpt } from "./_sanitize.js";
import { addEdge, type GraphBuilderState } from "./_state.js";

function readResolvedPath(metadata: Record<string, unknown>): string | undefined {
  const resolvedPath = metadata.resolvedPath;
  return typeof resolvedPath === "string" && resolvedPath.length > 0 ? resolvedPath : undefined;
}

function readTargetFile(metadata: Record<string, unknown>): string | undefined {
  const targetFile = metadata.targetFile;
  return typeof targetFile === "string" && targetFile.length > 0 ? targetFile : undefined;
}

function resolveTargetFileId(
  targetPath: string,
  projectId: string,
  state: GraphBuilderState,
): string | undefined {
  const { fileId } = ensureFileContext(targetPath, projectId, state);
  return state.nodes.has(fileId) ? fileId : undefined;
}

export function addDependencyFactEdge(
  fact: RawBlueprintFact,
  sourceFileId: string,
  projectId: string,
  state: GraphBuilderState,
): void {
  const metadata = fact.metadata ?? {};
  let edgeKind: "imports" | "calls" | undefined;
  let targetPath: string | undefined;

  if (fact.kind === "ast-import") {
    edgeKind = "imports";
    targetPath = readResolvedPath(metadata);
  } else if (fact.kind === "ast-call") {
    edgeKind = "calls";
    targetPath = readTargetFile(metadata);
  }

  if (!edgeKind || !targetPath) return;

  const targetFileId = resolveTargetFileId(targetPath, projectId, state);
  if (!targetFileId || targetFileId === sourceFileId) return;

  const edgeId = stableUniqueId(
    state.registry,
    "edge",
    createId("dep", edgeKind, sourceFileId, normalizePath(targetPath), fact.id),
  );

  addEdge(state, {
    id: edgeId,
    kind: edgeKind,
    sourceId: sourceFileId,
    targetId: targetFileId,
    metadata: {
      evidenceFactId: fact.id,
      excerpt: sanitizeExcerpt(fact.snippet),
      line: fact.line,
      selfReference: false,
      /** AST-resolved import/call edges are extracted; unresolved heuristics would be inferred. */
      evidenceKind: "extracted" as const,
    },
  });
}
