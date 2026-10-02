/**
 * Local Engine configuration and storage path resolution.
 * Location: local-engine/src/config.ts
 */

import os from "node:os";
import path from "node:path";

export const ENGINE_VERSION = "0.1.0";
export const DEFAULT_ENGINE_PORT = 4317;
export const DEFAULT_PREVIEW_RUNNER_URL = "http://127.0.0.1:4000";

const DEFAULT_ORIGINS = ["http://localhost:3005", "http://127.0.0.1:3005"];

export function resolveStorageDir(value?: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return path.join(os.homedir(), ".visudev");
  }
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed === "~" ? "" : trimmed.slice(2));
  }
  if (!path.isAbsolute(trimmed)) {
    throw new Error("VISUDEV_STORAGE_DIR must be absolute or start with ~/.");
  }
  return trimmed;
}

export function getEngineConfig() {
  const port = Number(process.env.VISUDEV_ENGINE_PORT) || DEFAULT_ENGINE_PORT;
  const host = process.env.VISUDEV_ENGINE_HOST?.trim() || "127.0.0.1";
  const storageDir = resolveStorageDir(process.env.VISUDEV_STORAGE_DIR);
  const previewRunnerUrl =
    process.env.VISUDEV_PREVIEW_RUNNER_URL?.trim() || DEFAULT_PREVIEW_RUNNER_URL;
  const allowedOrigins = (process.env.VISUDEV_ALLOWED_ORIGINS?.trim() || DEFAULT_ORIGINS.join(","))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const analysisProvider =
    process.env.VISUDEV_ANALYSIS_PROVIDER?.trim() || "legacy-blueprint-runner";
  const autoguideRoot = process.env.VISUDEV_AUTOGUIDE_ROOT?.trim() || "";
  const autoguideSourceDir = process.env.VISUDEV_AUTOGUIDE_SOURCE_DIR?.trim() || "src";
  const autoguideStub = process.env.VISUDEV_AUTOGUIDE_STUB === "1";
  const blueprintAnalysisMode = process.env.VISUDEV_BLUEPRINT_ANALYSIS_MODE?.trim() || "shadow";

  return {
    port,
    host,
    storageDir,
    previewRunnerUrl,
    allowedOrigins,
    analysisProvider,
    autoguideRoot: autoguideRoot || undefined,
    autoguideSourceDir,
    autoguideStub,
    blueprintAnalysisMode,
  };
}

export type EngineConfig = ReturnType<typeof getEngineConfig>;
