/**
 * Unit tests for local AppFlow test-session store (PR-11).
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createTestSessionStore, normalizeOrigin, opaqueSessionId } from "./test-session-store.js";

test("normalizeOrigin strips path and query", () => {
  assert.equal(normalizeOrigin("http://localhost:4173/app?x=1"), "http://localhost:4173");
});

test("save/load/clear roundtrip keeps cookies out of status", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "visudev-session-"));
  const store = createTestSessionStore({ rootDir });
  try {
    const projectId = "proj-1";
    const origin = "http://localhost:4173";
    const storageState = {
      cookies: [{ name: "sid", value: "super-secret-token", domain: "localhost", path: "/" }],
      origins: [],
    };
    const saved = await store.save(projectId, origin, storageState);
    assert.equal(saved.status, "ready");
    assert.equal(saved.sessionId, opaqueSessionId(projectId, origin));
    assert.equal(JSON.stringify(saved).includes("super-secret-token"), false);

    const status = await store.getStatus(projectId, origin);
    assert.equal(status.status, "ready");
    assert.equal(JSON.stringify(status).includes("super-secret-token"), false);

    const loaded = await store.loadStorageState(projectId, `${origin}/dashboard`);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.storageState.cookies[0].value, "super-secret-token");

    const wrong = await store.loadStorageState(projectId, "http://127.0.0.1:4173");
    assert.equal(wrong.ok, false);

    const cleared = await store.clear(projectId, origin);
    assert.equal(cleared.status, "missing");
    const after = await store.getStatus(projectId, origin);
    assert.equal(after.status, "missing");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("corrupt file yields invalid status", async () => {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "visudev-session-"));
  const store = createTestSessionStore({ rootDir });
  try {
    const projectId = "proj-2";
    const origin = "http://localhost:5000";
    const sessionId = opaqueSessionId(projectId, origin);
    const { writeFile, mkdir } = await import("node:fs/promises");
    await mkdir(rootDir, { recursive: true });
    await writeFile(path.join(rootDir, `${sessionId}.json`), "{not-json", "utf8");
    const status = await store.getStatus(projectId, origin);
    assert.equal(status.status, "invalid");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
