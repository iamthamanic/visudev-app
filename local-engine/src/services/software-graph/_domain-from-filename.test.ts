/**
 * Unit tests for filename-stem domain detection (P0-14).
 * Location: local-engine/src/services/software-graph/_domain-from-filename.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  applyFilenameDomains,
  buildFilenameDomainIndex,
  extractFilenameStem,
  isFilenameDomainCandidate,
  MIN_FILES_PER_FILENAME_DOMAIN,
} from "./_domain-from-filename.js";
import { buildSegmentSpreadIndex } from "./_segment-spread.js";
import { createBuilderState, registerRootScope } from "./_state.js";
import { createApplicationScope, createOrganizationScope } from "./_scopes.js";
import { ensureFileContext } from "./_file-context.js";
import { addEdge, addNode } from "./_state.js";
import { createId } from "./_ids.js";

describe("extractFilenameStem", () => {
  it("strips .service and Controller suffixes", () => {
    expect(extractFilenameStem("server/src/services/album.service.ts")).toEqual({
      key: "album",
      label: "album",
    });
    expect(extractFilenameStem("app/controllers/topics_controller.rb")).toEqual({
      key: "topic",
      label: "topics",
    });
    expect(extractFilenameStem("app/controllers/LeavesController.rb")?.key).toBe("leave");
  });

  it("keeps compound stems after suffix strip", () => {
    expect(extractFilenameStem("app/services/user_profile.service.ts")).toEqual({
      key: "user-profile",
      label: "user-profile",
    });
  });

  it("rejects index and main", () => {
    expect(extractFilenameStem("src/index.ts")).toBeNull();
    expect(extractFilenameStem("cmd/main.go")).toBeNull();
  });
});

describe("buildFilenameDomainIndex", () => {
  it("stem across two layers becomes domain", () => {
    const index = buildFilenameDomainIndex([
      { path: "app/models/topic.rb", layer: "data" },
      { path: "app/controllers/topics_controller.rb", layer: "presentation" },
    ]);
    const entry = index.byKey.get("topic");
    expect(entry).toBeTruthy();
    expect(isFilenameDomainCandidate(entry!)).toBe(true);
    expect(entry!.label === "topic" || entry!.label === "topics").toBe(true);
  });

  it("does not treat unknown as a second layer", () => {
    const index = buildFilenameDomainIndex([
      { path: "app/models/topic.rb", layer: "data" },
      { path: "misc/topics_helper.rb", layer: "unknown" },
    ]);
    const entry = index.byKey.get("topic");
    expect(entry).toBeTruthy();
    expect(isFilenameDomainCandidate(entry!)).toBe(false);
  });

  it("single layer stem stays unassigned", () => {
    const index = buildFilenameDomainIndex([
      { path: "app/models/topic.rb", layer: "data" },
      { path: "app/models/topics.rb", layer: "data" },
    ]);
    const entry = index.byKey.get("topic");
    expect(entry).toBeTruthy();
    expect(isFilenameDomainCandidate(entry!)).toBe(false);
  });

  it("requires MIN_FILES_PER_FILENAME_DOMAIN", () => {
    expect(MIN_FILES_PER_FILENAME_DOMAIN).toBe(2);
    const index = buildFilenameDomainIndex([
      { path: "app/models/topic.rb", layer: "data" },
      { path: "app/controllers/orphan_controller.rb", layer: "unknown" },
    ]);
    // topic only one file → not a candidate even if somehow multi-layer
    const topic = index.byKey.get("topic");
    expect(topic?.filePaths.length).toBe(1);
    expect(isFilenameDomainCandidate(topic!)).toBe(false);
  });

  it("dedupes duplicate paths for the min-files threshold", () => {
    const index = buildFilenameDomainIndex([
      { path: "app/models/topic.rb", layer: "data" },
      { path: "app/models/topic.rb", layer: "data" },
      { path: "app/controllers/topics_controller.rb", layer: "presentation" },
    ]);
    // Duplicate path must not count as a second file by itself — still 2 unique paths.
    expect(index.byKey.get("topic")?.filePaths).toEqual([
      "app/models/topic.rb",
      "app/controllers/topics_controller.rb",
    ]);
  });
});

describe("applyFilenameDomains", () => {
  function seedState(paths: string[], spreadPaths?: string[]) {
    const projectId = "demo";
    const state = createBuilderState();
    const org = createOrganizationScope(projectId);
    const app = createApplicationScope(projectId);
    registerRootScope(state, org);
    registerRootScope(state, app);
    addNode(state, { id: org.id, kind: "organization", label: projectId, metadata: {} });
    addNode(state, {
      id: app.id,
      kind: "application",
      label: projectId,
      scopeId: org.id,
      metadata: {},
    });
    addEdge(state, {
      id: createId("edge", org.id, app.id),
      kind: "contains",
      sourceId: org.id,
      targetId: app.id,
      metadata: {},
    });
    state.segmentSpread = buildSegmentSpreadIndex(spreadPaths ?? paths);
    for (const path of paths) {
      ensureFileContext(path, projectId, state);
    }
    return { state, projectId };
  }

  it("path domain is never overwritten", () => {
    const paths = [
      "backend/app/modules/leaves/leaves.routes.ts",
      "backend/app/modules/leaves/leaves.service.ts",
      "backend/app/modules/auth/auth.routes.ts",
      "backend/app/modules/auth/auth.service.ts",
      "backend/app/modules/documents/documents.routes.ts",
    ];
    const { state, projectId } = seedState(paths);
    const before = [...state.nodes.values()]
      .filter((n) => n.kind === "file")
      .map((n) => ({
        path: n.filePath,
        source: n.metadata.domainSource,
        scopeId: n.scopeId,
      }));
    applyFilenameDomains(state, projectId);
    const after = [...state.nodes.values()]
      .filter((n) => n.kind === "file")
      .map((n) => ({
        path: n.filePath,
        source: n.metadata.domainSource,
        scopeId: n.scopeId,
      }));
    expect(after).toEqual(before);
    expect(after.every((f) => f.source === "path")).toBe(true);
  });

  it("remounts layer-first stems onto filename domains", () => {
    const topicPaths = [
      "app/models/topic.rb",
      "app/controllers/topics_controller.rb",
      "app/models/post.rb",
      "app/controllers/posts_controller.rb",
    ];
    // Inflate parent-spread so models/controllers are not path-domain candidates.
    const spreadNoise = [
      "a/models/x.rb",
      "b/models/y.rb",
      "c/models/z.rb",
      "a/controllers/x_controller.rb",
      "b/controllers/y_controller.rb",
      "c/controllers/z_controller.rb",
    ];
    const { state, projectId } = seedState(topicPaths, [...spreadNoise, ...topicPaths]);

    // Force Pass-1 "none" so this test isolates Pass-2 remount (spread may still
    // classify top-level folders as path domains in tiny fixtures).
    for (const file of [...state.nodes.values()].filter((n) => n.kind === "file")) {
      file.metadata.domainSource = "none";
    }

    applyFilenameDomains(state, projectId);
    const domains = [...state.nodes.values()].filter((n) => n.kind === "domain");
    expect(domains.some((d) => d.metadata.domainSource === "filename")).toBe(true);
    const files = [...state.nodes.values()].filter((n) => n.kind === "file");
    expect(files.some((f) => f.metadata.domainSource === "filename")).toBe(true);
    expect(
      files
        .filter((f) => String(f.filePath).includes("topic"))
        .every((f) => f.metadata.domainSource === "filename"),
    ).toBe(true);
  });
});
