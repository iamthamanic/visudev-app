/**
 * Unit tests for AppFlow frontier explorer (PR-10).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createFrontier,
  decideTermination,
  enqueueFrontier,
  looksLikeAuthBarrier,
  normalizeStateKey,
} from "./frontier-explorer.js";

test("normalizeStateKey collapses numeric and uuid segments", () => {
  assert.equal(normalizeStateKey("/users/123/edit"), "/users/:id/edit");
  assert.equal(normalizeStateKey("/items/e9afc94b-b2e3-47a3-b24f-ac07284cb34f"), "/items/:uuid");
  assert.equal(normalizeStateKey("/users/1", { stateKey: "modal-a" }), "/users/:id::modal-a");
});

test("frontier deduplicates by normalized identity", () => {
  const { queue, seen } = createFrontier([
    { id: "a", path: "/users/1", name: "U1", type: "route" },
    { id: "b", path: "/users/2", name: "U2", type: "route" },
  ]);
  assert.equal(queue.length, 1);
  assert.equal(
    enqueueFrontier(queue, seen, {
      screenId: "c",
      path: "/users/9",
      label: "U9",
      type: "route",
    }),
    false,
  );
  assert.equal(
    enqueueFrontier(queue, seen, {
      screenId: "d",
      path: "/settings",
      label: "Settings",
      type: "route",
    }),
    true,
  );
  assert.equal(queue.length, 2);
});

test("decideTermination prefers barriers then budget then empty frontier", () => {
  assert.equal(
    decideTermination({
      queueLength: 3,
      visitCount: 1,
      visitBudget: 40,
      startedAtMs: Date.now(),
      timeoutMs: 120000,
      authBarrier: true,
      safetyBarrier: false,
    }),
    "auth-barrier",
  );
  assert.equal(
    decideTermination({
      queueLength: 3,
      visitCount: 40,
      visitBudget: 40,
      startedAtMs: Date.now(),
      timeoutMs: 120000,
      authBarrier: false,
      safetyBarrier: false,
    }),
    "budget",
  );
  assert.equal(
    decideTermination({
      queueLength: 0,
      visitCount: 2,
      visitBudget: 40,
      startedAtMs: Date.now(),
      timeoutMs: 120000,
      authBarrier: false,
      safetyBarrier: false,
    }),
    "frontier-exhausted",
  );
});

test("looksLikeAuthBarrier detects login routes", () => {
  assert.equal(looksLikeAuthBarrier("/login"), true);
  assert.equal(looksLikeAuthBarrier("/app/home", "Dashboard"), false);
});
