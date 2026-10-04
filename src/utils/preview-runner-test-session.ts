/**
 * Opaque AppFlow test-session client for Preview Runner (PR-11).
 * Never reads or displays cookie/token values.
 * Location: src/utils/preview-runner-test-session.ts
 */

import { discoverRunnerUrl } from "./preview-runner-core";
import { getEffectiveRunnerUrl, localRunnerGuard } from "./preview-runner-mode";
import { parseRunnerJsonText } from "./preview-runner-parser";
import { runnerHeaders } from "./preview-runner-session";
import { sanitizeProjectId, sanitizeRunId } from "./preview-runner-validation";

export type OpaqueTestSessionStatus = {
  sessionId: string;
  status: "ready" | "missing" | "pending" | "invalid" | string;
  projectId: string;
  origin: string;
  savedAt: string | null;
  message?: string;
};

async function runnerBaseUrl(): Promise<string | null> {
  const guard = localRunnerGuard();
  if (!guard.ok) return null;
  await discoverRunnerUrl();
  return getEffectiveRunnerUrl();
}

function assertIds(projectId: string, runId: string): { projectId: string; runId: string } | null {
  const validProjectId = sanitizeProjectId(projectId);
  const validRunId = sanitizeRunId(runId);
  if (!validProjectId || !validRunId) return null;
  return { projectId: validProjectId, runId: validRunId };
}

async function sessionRequest(
  projectId: string,
  runId: string,
  pathSuffix: string,
  method: "GET" | "POST" | "DELETE",
): Promise<OpaqueTestSessionStatus | null> {
  const ids = assertIds(projectId, runId);
  const base = await runnerBaseUrl();
  if (!ids || !base) return null;

  const response = await fetch(`${base}/session/${encodeURIComponent(ids.runId)}${pathSuffix}`, {
    method,
    headers: runnerHeaders(ids.projectId, method !== "GET"),
  });
  const text = await response.text();
  const payload = parseRunnerJsonText(text, `session ${method}`);
  if (!response.ok || !payload || typeof payload !== "object") return null;
  const data = (payload as { data?: OpaqueTestSessionStatus }).data;
  if (!data || typeof data !== "object") return null;
  return {
    sessionId: String(data.sessionId || ""),
    status: String(data.status || "missing"),
    projectId: String(data.projectId || ids.projectId),
    origin: String(data.origin || ""),
    savedAt: typeof data.savedAt === "string" ? data.savedAt : null,
    message: typeof data.message === "string" ? data.message : undefined,
  };
}

export async function getTestSessionStatus(
  projectId: string,
  runId: string,
): Promise<OpaqueTestSessionStatus | null> {
  return sessionRequest(projectId, runId, "", "GET");
}

export async function openTestSessionLogin(
  projectId: string,
  runId: string,
): Promise<OpaqueTestSessionStatus | null> {
  return sessionRequest(projectId, runId, "/open-login", "POST");
}

export async function persistTestSession(
  projectId: string,
  runId: string,
): Promise<OpaqueTestSessionStatus | null> {
  return sessionRequest(projectId, runId, "/persist", "POST");
}

export async function clearTestSession(
  projectId: string,
  runId: string,
): Promise<OpaqueTestSessionStatus | null> {
  return sessionRequest(projectId, runId, "", "DELETE");
}
