/**
 * Git summary routes for local analysis.
 * IDOR: registered-project guard in GitSummaryService; rate-limited reads.
 */

import type { Hono } from "hono";
import type { GitSummaryService } from "../services/git-summary.service.js";
import { readBranchDiff } from "../lib/git-branch-diff.js";
import { checkRateLimit } from "../lib/simple-rate-limit.js";
import { fail, getErrorStatus, ok } from "./http.js";

const MAX_PROJECT_ID_LEN = 36;
const PROJECT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_HITS = 60;

function parseProjectId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_PROJECT_ID_LEN) return null;
  if (!PROJECT_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function rateLimitKey(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local"
  );
}

export function registerGitRoutes(app: Hono, gitSummaryService: GitSummaryService): void {
  app.get("/api/projects/:projectId/git/summary", async (c) => {
    try {
      if (!checkRateLimit(`git-summary:${rateLimitKey(c)}`, RATE_WINDOW_MS, RATE_MAX_HITS)) {
        return fail(c, "RATE_LIMITED", "Too many git summary requests", 429);
      }

      const projectId = parseProjectId(c.req.param("projectId"));
      if (!projectId) {
        return fail(c, "VALIDATION_ERROR", "Invalid projectId", 400);
      }
      const summary = await gitSummaryService.getProjectGitSummary(projectId);
      return ok(c, summary);
    } catch (error) {
      const status = getErrorStatus(error, 500);
      const message =
        status === 404
          ? "Project not found"
          : status === 429
            ? "Too many git summary requests"
            : "Failed to read git summary";
      return fail(c, "GIT_SUMMARY_FAILED", message, status);
    }
  });

  app.get("/api/projects/:projectId/git/diff", async (c) => {
    try {
      if (!checkRateLimit(`git-diff:${rateLimitKey(c)}`, RATE_WINDOW_MS, RATE_MAX_HITS)) {
        return fail(c, "RATE_LIMITED", "Too many git diff requests", 429);
      }

      const projectId = parseProjectId(c.req.param("projectId"));
      if (!projectId) {
        return fail(c, "VALIDATION_ERROR", "Invalid projectId", 400);
      }
      const base = c.req.query("base")?.trim();
      const head = c.req.query("head")?.trim();
      if (!base || !head) {
        return fail(c, "VALIDATION_ERROR", "base and head query params are required", 400);
      }

      const project = await gitSummaryService.getProjectSummary(projectId);
      if (!project.localPath) {
        return fail(c, "GIT_DIFF_FAILED", "Project has no local path", 400);
      }

      const diff = await readBranchDiff(project.localPath, base, head);
      return ok(c, diff);
    } catch (error) {
      const status = getErrorStatus(error, 500);
      const message =
        error instanceof Error && error.message.startsWith("Branch not found")
          ? error.message
          : error instanceof Error && error.message === "Invalid branch name"
            ? error.message
            : status === 404
              ? "Project not found"
              : status === 429
                ? "Too many git diff requests"
                : "Failed to compute git diff";
      return fail(c, "GIT_DIFF_FAILED", message, status);
    }
  });
}
