/**
 * Local Playwright storageState store for AppFlow test sessions (PR-11).
 * Cookie/token values never leave this module via public status APIs.
 * Location: preview-runner/lib/test-session-store.js
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function normalizeOrigin(urlOrOrigin) {
  try {
    const parsed = new URL(String(urlOrOrigin || "").trim());
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

export function opaqueSessionId(projectId, origin) {
  return createHash("sha256")
    .update(`${String(projectId)}\0${String(origin)}`)
    .digest("hex")
    .slice(0, 16);
}

function defaultRootDir() {
  return path.join(os.homedir(), ".visudev", "test-sessions");
}

export function createTestSessionStore(options = {}) {
  const rootDir = options.rootDir || defaultRootDir();

  function filePathFor(sessionId) {
    return path.join(rootDir, `${sessionId}.json`);
  }

  async function ensureRoot() {
    await mkdir(rootDir, { recursive: true });
  }

  /**
   * @returns {Promise<{ sessionId: string, status: string, projectId: string, origin: string, savedAt: string|null }>}
   */
  async function getStatus(projectId, originInput) {
    const origin = normalizeOrigin(originInput);
    if (!projectId || !origin) {
      return {
        sessionId: "",
        status: "missing",
        projectId: String(projectId || ""),
        origin: origin || "",
        savedAt: null,
      };
    }
    const sessionId = opaqueSessionId(projectId, origin);
    try {
      const raw = await readFile(filePathFor(sessionId), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.projectId !== projectId || parsed.origin !== origin) {
        return { sessionId, status: "invalid", projectId, origin, savedAt: null };
      }
      if (!parsed.storageState || typeof parsed.storageState !== "object") {
        return { sessionId, status: "invalid", projectId, origin, savedAt: null };
      }
      return {
        sessionId,
        status: "ready",
        projectId,
        origin,
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : null,
      };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { sessionId, status: "missing", projectId, origin, savedAt: null };
      }
      return { sessionId, status: "invalid", projectId, origin, savedAt: null };
    }
  }

  async function save(projectId, originInput, storageState) {
    const origin = normalizeOrigin(originInput);
    if (!projectId || !origin) {
      throw new Error("projectId and origin are required to save a test session.");
    }
    if (!storageState || typeof storageState !== "object") {
      throw new Error("storageState object is required.");
    }
    await ensureRoot();
    const sessionId = opaqueSessionId(projectId, origin);
    const savedAt = new Date().toISOString();
    const payload = {
      version: 1,
      sessionId,
      projectId,
      origin,
      savedAt,
      storageState,
    };
    await writeFile(filePathFor(sessionId), JSON.stringify(payload), "utf8");
    return {
      sessionId,
      status: "ready",
      projectId,
      origin,
      savedAt,
    };
  }

  /** Load storageState for crawl use only — never send to UI. */
  async function loadStorageState(projectId, originInput) {
    const origin = normalizeOrigin(originInput);
    if (!projectId || !origin) return { ok: false, reason: "missing", storageState: null };
    const sessionId = opaqueSessionId(projectId, origin);
    try {
      const raw = await readFile(filePathFor(sessionId), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed.projectId !== projectId || parsed.origin !== origin) {
        return { ok: false, reason: "wrong-origin", storageState: null };
      }
      if (!parsed.storageState || typeof parsed.storageState !== "object") {
        return { ok: false, reason: "corrupt", storageState: null };
      }
      return { ok: true, reason: "ready", storageState: parsed.storageState, sessionId };
    } catch (error) {
      if (error && error.code === "ENOENT") {
        return { ok: false, reason: "missing", storageState: null };
      }
      return { ok: false, reason: "corrupt", storageState: null };
    }
  }

  async function clear(projectId, originInput) {
    const origin = normalizeOrigin(originInput);
    if (!projectId || !origin) {
      return {
        sessionId: "",
        status: "missing",
        projectId: String(projectId || ""),
        origin: "",
        savedAt: null,
      };
    }
    const sessionId = opaqueSessionId(projectId, origin);
    try {
      await rm(filePathFor(sessionId), { force: true });
    } catch {
      // ignore
    }
    return { sessionId, status: "missing", projectId, origin, savedAt: null };
  }

  return { getStatus, save, loadStorageState, clear, rootDir };
}
