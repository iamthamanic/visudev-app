/**
 * Verifies deterministic, shared container nodes created by ensureFileContext.
 * Location: local-engine/src/services/software-graph/_file-context.test.ts
 */

import { describe, expect, it } from "vitest";
import { ensureFileContext } from "./_file-context.js";
import { createApplicationScope } from "./_scopes.js";
import { createBuilderState, registerRootScope, type GraphBuilderState } from "./_state.js";

const PROJECT_ID = "test-project";

function createFileContextState(): GraphBuilderState {
  const state = createBuilderState();
  registerRootScope(state, createApplicationScope(PROJECT_ID));
  return state;
}

describe("ensureFileContext", () => {
  it("same domain across many files yields exactly one domain node", () => {
    const state = createFileContextState();

    for (let index = 0; index < 50; index += 1) {
      ensureFileContext(`backend/routes/route-${index}.ts`, PROJECT_ID, state);
    }

    const domainNodes = [...state.nodes.values()].filter((node) => node.kind === "domain");
    expect(domainNodes).toHaveLength(1);
    expect(domainNodes[0]?.id).toBe("domain:backend");
  });

  it("same file path called twice yields one file node", () => {
    const state = createFileContextState();
    const filePath = "backend/routes/users.ts";

    ensureFileContext(filePath, PROJECT_ID, state);
    ensureFileContext(filePath, PROJECT_ID, state);

    const fileNodes = [...state.nodes.values()].filter((node) => node.kind === "file");
    expect(fileNodes).toHaveLength(1);
    expect(fileNodes[0]?.id).toBe(`file:${filePath}`);
  });

  it("returned ids contain no tilde suffix", () => {
    const state = createFileContextState();
    const first = ensureFileContext("backend/routes/users.ts", PROJECT_ID, state);
    const second = ensureFileContext("backend/routes/users.ts", PROJECT_ID, state);

    for (const id of [...Object.values(first), ...Object.values(second)]) {
      expect(id).not.toContain("~");
      expect(state.registry.nodes.has(id)).toBe(true);
    }
  });

  it("node scopeId always resolves to a registered scope", () => {
    const state = createFileContextState();

    for (let index = 0; index < 50; index += 1) {
      ensureFileContext(`backend/routes/route-${index}.ts`, PROJECT_ID, state);
    }

    for (const node of state.nodes.values()) {
      expect(node.scopeId).toBeDefined();
      if (node.scopeId === undefined) {
        throw new Error(`Node ${node.id} has no scopeId`);
      }
      expect(state.scopes.has(node.scopeId)).toBe(true);
    }
  });

  it("different domains yield different domain nodes", () => {
    const state = createFileContextState();

    ensureFileContext("backend/routes/users.ts", PROJECT_ID, state);
    ensureFileContext("frontend/routes/users.ts", PROJECT_ID, state);

    const domainIds = [...state.nodes.values()]
      .filter((node) => node.kind === "domain")
      .map((node) => node.id);
    expect(domainIds).toEqual(["domain:backend", "domain:frontend"]);
  });

  it("module with same name in two domains stays separate", () => {
    const state = createFileContextState();

    ensureFileContext("backend/auth/service.ts", PROJECT_ID, state);
    ensureFileContext("frontend/auth/service.ts", PROJECT_ID, state);

    const moduleIds = [...state.nodes.values()]
      .filter((node) => node.kind === "module")
      .map((node) => node.id);
    expect(moduleIds).toEqual(["module:backend:unknown:auth", "module:frontend:unknown:auth"]);
  });
});
