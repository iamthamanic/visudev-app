/**
 * Injectable git/filesystem provenance reader for preview-runner local scans.
 * Location: preview-runner/lib/analysis-origin-git.js
 */

import { spawn } from "node:child_process";

const MAX_GIT_OUTPUT_BYTES = 2 * 1024 * 1024;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{4,40}$/i;
const BRANCH_NAME_PATTERN = /^[^\s\0]{1,255}$/;

function resolveGitTimeoutMs() {
  const raw = Number(process.env.BLUEPRINT_GIT_TIMEOUT_MS);
  if (!Number.isFinite(raw)) return 30_000;
  return Math.min(120_000, Math.max(5_000, raw));
}

function defaultOriginWarn(message, detail) {
  console.warn(detail ? `${message}: ${detail}` : message);
}

export function sanitizeOriginDetail(raw) {
  return String(raw)
    .replace(/(?:[A-Za-z]:)?(?:\\|\/)[^\s:;]+/g, "***")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export function runGitCommand(localPath, args, timeoutMs = resolveGitTimeoutMs()) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: localPath,
      stdio: ["ignore", "pipe", "ignore"],
      env: {
        ...process.env,
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    let stdout = "";
    let outputBytes = 0;
    let settled = false;
    let timeoutId;
    let killEscalationId;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (killEscalationId) clearTimeout(killEscalationId);
      child.stdout?.removeAllListeners();
      child.removeAllListeners();
    };

    const terminateChild = () => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* process may already be gone */
      }
      killEscalationId = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* ignore */
        }
      }, 1_000);
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    timeoutId = setTimeout(() => {
      terminateChild();
      finish(reject, new Error("Git command timed out"));
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      outputBytes += chunk.length;
      if (outputBytes > MAX_GIT_OUTPUT_BYTES) {
        terminateChild();
        finish(reject, new Error("Git output exceeded the local analysis limit"));
        return;
      }
      stdout += String(chunk);
    });
    child.on("error", (error) => finish(reject, error));
    child.on("close", (code) => {
      if (settled) return;
      if (code !== 0) {
        finish(reject, new Error(`Git exited with code ${code ?? "?"}`));
        return;
      }
      finish(resolve, stdout);
    });
  });
}

export async function readLocalAnalysisOrigin(localPath, deps = {}) {
  const runGit = deps.runGitCommand ?? runGitCommand;
  const logWarn = deps.logWarn ?? defaultOriginWarn;
  const provenanceBudgetMs = resolveGitTimeoutMs();
  const startedAt = Date.now();
  const remainingMs = () => Math.max(1_000, provenanceBudgetMs - (Date.now() - startedAt));
  const runGitWithinBudget = (args) => {
    if (deps.runGitCommand) {
      return runGit(localPath, args);
    }
    return runGitCommand(localPath, args, remainingMs());
  };

  const capturedAt = new Date().toISOString();
  try {
    const commitRaw = await runGitWithinBudget(["rev-parse", "--short", "HEAD"]);
    const commitSha = commitRaw.trim();
    if (!commitSha || !COMMIT_SHA_PATTERN.test(commitSha)) {
      throw new Error("Git returned invalid HEAD commit");
    }
    const normalizedSha = commitSha.slice(0, 7);

    const [branchResult, statusResult] = await Promise.allSettled([
      runGitWithinBudget(["branch", "--show-current"]),
      runGitWithinBudget(["status", "--porcelain"]),
    ]);

    let branch;
    if (branchResult.status === "fulfilled") {
      const branchName = branchResult.value.trim();
      branch = branchName && BRANCH_NAME_PATTERN.test(branchName) ? branchName : undefined;
    } else {
      const message =
        branchResult.reason instanceof Error
          ? branchResult.reason.message
          : String(branchResult.reason);
      logWarn(
        "[blueprint-local] Git branch read failed; continuing without branch",
        sanitizeOriginDetail(message),
      );
      branch = undefined;
    }

    let dirty = true;
    if (statusResult.status === "fulfilled") {
      dirty = statusResult.value.trim().length > 0;
    } else {
      const message =
        statusResult.reason instanceof Error
          ? statusResult.reason.message
          : String(statusResult.reason);
      logWarn(
        "[blueprint-local] Git status read failed; assuming uncommitted changes",
        sanitizeOriginDetail(message),
      );
      dirty = true;
    }

    return {
      sourceKind: "git",
      commitSha: normalizedSha,
      branch,
      dirty,
      capturedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn(
      "[blueprint-local] Git origin unavailable; using filesystem provenance",
      sanitizeOriginDetail(message),
    );
    return {
      sourceKind: "filesystem",
      dirty: false,
      capturedAt,
    };
  }
}
