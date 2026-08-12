/**
 * Tests local Blueprint workspace coverage and honest Git provenance.
 * Location: preview-runner/lib/blueprint-local.test.js
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  FILE_LIMIT,
  SUPPORTED_EXT,
  analyzeLocalBlueprint,
  applyFileLimitWithSeeds,
  isCriticalWalkSeedPath,
  prioritizeBlueprintFiles,
  resolveWorkspaceRoot,
} from "./blueprint-local.js";

const temporaryDirectories = [];
const originalAllowedRoots = process.env.VISUDEV_ALLOWED_LOCAL_ROOTS;

afterEach(() => {
  if (originalAllowedRoots === undefined) {
    delete process.env.VISUDEV_ALLOWED_LOCAL_ROOTS;
  } else {
    process.env.VISUDEV_ALLOWED_LOCAL_ROOTS = originalAllowedRoots;
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createAnalyzableDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "visudev-blueprint-origin-"));
  temporaryDirectories.push(directory);
  process.env.VISUDEV_ALLOWED_LOCAL_ROOTS = directory;
  writeFileSync(join(directory, "route.ts"), 'export const route = "/health";\n');
  return directory;
}

describe("blueprint-local Softort coverage", () => {
  it("keeps workspace root at clone path (not preview web package)", () => {
    expect(resolveWorkspaceRoot("/repos/Rocket.Chat")).toBe("/repos/Rocket.Chat");
    expect(resolveWorkspaceRoot("/repos/plane")).toBe("/repos/plane");
  });

  it("supports python and prisma extensions", () => {
    expect(SUPPORTED_EXT.has("py")).toBe(true);
    expect(SUPPORTED_EXT.has("prisma")).toBe(true);
    expect(SUPPORTED_EXT.has("ts")).toBe(true);
  });

  it("prioritizes Django/Prisma/meteor over leaf UI packages", () => {
    const ranked = prioritizeBlueprintFiles([
      "packages/web-ui-registration/src/CMSPage.tsx",
      "apps/meteor/server/lib/roles/hasPermission.ts",
      "apps/api/plane/urls.py",
      "packages/database/schema.prisma",
      "apps/web/app/page.tsx",
    ]);
    expect(ranked[0]).toBe("packages/database/schema.prisma");
    expect(ranked[1]).toBe("apps/api/plane/urls.py");
    expect(ranked.indexOf("apps/meteor/server/lib/roles/hasPermission.ts")).toBeLessThan(
      ranked.indexOf("packages/web-ui-registration/src/CMSPage.tsx"),
    );
  });

  it("keeps specs/mocks/tests below app modules under soft-cap ranking", () => {
    // Mirrors Actual/Immich soft-cap bias (spec/mock domination).
    const ranked = prioritizeBlueprintFiles([
      "packages/sync-server/src/app/gocardless-service.spec.ts",
      "server/src/repositories/asset.repository.spec.ts",
      "server/src/repositories/asset.repository.mock.ts",
      "packages/sync-server/src/app/gocardless-service.ts",
      "server/src/repositories/asset.repository.ts",
      "apps/web/src/app/api/route.ts",
      "src/modules/leaves/leaves.routes.ts",
    ]);
    const top = ranked.slice(0, 4);
    expect(top.some((p) => /\.(spec|test|mock)\./.test(p))).toBe(false);
    expect(ranked.indexOf("src/modules/leaves/leaves.routes.ts")).toBeLessThan(
      ranked.indexOf("packages/sync-server/src/app/gocardless-service.spec.ts"),
    );
    expect(ranked.indexOf("server/src/repositories/asset.repository.ts")).toBeLessThan(
      ranked.indexOf("server/src/repositories/asset.repository.spec.ts"),
    );
  });

  it("prefers module-segment paths and canonical prisma over basename lottery", () => {
    const ranked = prioritizeBlueprintFiles([
      "HrKo_LeaveService.ts",
      "schema.prisma",
      "modules/hr/services/HrKo_LeaveService.ts",
      "modules/leaves/schema.prisma",
      "packages/database/schema.prisma",
      "src/modules/leaves/leave.controller.ts",
    ]);
    expect(ranked[0]).toBe("packages/database/schema.prisma");
    expect(ranked.indexOf("src/modules/leaves/leave.controller.ts")).toBeLessThan(
      ranked.indexOf("HrKo_LeaveService.ts"),
    );
    expect(ranked.indexOf("modules/hr/services/HrKo_LeaveService.ts")).toBeLessThan(
      ranked.indexOf("HrKo_LeaveService.ts"),
    );
  });

  it("tie-breaks module depth with normalized backslash paths", () => {
    // Segment bonus caps at 8 — deeper Windows path must still win via tie-break.
    const shallow = "a/b/c/d/e/f/g/h.ts";
    const deeperWin = "a\\b\\c\\d\\e\\f\\g\\h\\i.ts";
    const ranked = prioritizeBlueprintFiles([shallow, deeperWin]);
    expect(ranked[0]).toBe(deeperWin);
  });

  it("uses a Softort-friendly file limit (>=250)", () => {
    expect(FILE_LIMIT).toBeGreaterThanOrEqual(250);
  });

  it("identifies critical walk-seed paths (P1-1)", () => {
    expect(isCriticalWalkSeedPath("packages/database/schema.prisma")).toBe(true);
    expect(isCriticalWalkSeedPath("apps/meteor/server/methods/setRealName.ts")).toBe(true);
    expect(isCriticalWalkSeedPath("docker-compose.yml")).toBe(true);
    expect(isCriticalWalkSeedPath("apps/web/app/api/foo/route.ts")).toBe(false);
  });

  it("guarantees schema.prisma + meteor/server before FILE_LIMIT fill (P1-1)", () => {
    // route.ts scores higher than meteor/server — without seeds, Cap would drop meteor.
    const flood = Array.from({ length: 50 }, (_, i) => `apps/web/app/api/r${i}/route.ts`);
    const seeds = [
      "packages/database/schema.prisma",
      "apps/meteor/server/methods/setRealName.ts",
      "apps/meteor/server/models.ts",
    ];
    const ranked = prioritizeBlueprintFiles([...flood, ...seeds, "apps/web/page.tsx"]);
    const capped = applyFileLimitWithSeeds(ranked, seeds, 20);
    expect(capped).toContain("packages/database/schema.prisma");
    expect(capped).toContain("apps/meteor/server/methods/setRealName.ts");
    expect(capped).toContain("apps/meteor/server/models.ts");
    expect(capped.indexOf("packages/database/schema.prisma")).toBeLessThan(
      capped.indexOf("apps/web/app/api/r0/route.ts"),
    );
    expect(capped.length).toBeLessThanOrEqual(20);
    expect(capped.some((p) => /\.(spec|test|mock)\./.test(p))).toBe(false);
  });

  it("orders meteor method/model seeds ahead of generic meteor fill (P1-4)", () => {
    const seeds = [
      "apps/meteor/server/lib/utils.ts",
      "apps/meteor/server/meteor-methods/users/setRealName.ts",
      "apps/meteor/server/models.ts",
      "packages/database/schema.prisma",
    ];
    const capped = applyFileLimitWithSeeds(seeds, seeds, 10);
    expect(capped.indexOf("packages/database/schema.prisma")).toBe(0);
    expect(capped.indexOf("apps/meteor/server/meteor-methods/users/setRealName.ts")).toBeLessThan(
      capped.indexOf("apps/meteor/server/lib/utils.ts"),
    );
    expect(capped.indexOf("apps/meteor/server/models.ts")).toBeLessThan(
      capped.indexOf("apps/meteor/server/lib/utils.ts"),
    );
  });
});

describe("blueprint-local analysis origin", () => {
  it("analysis of a non-git folder reports no commit sha", async () => {
    const directory = createAnalyzableDirectory();

    const result = await analyzeLocalBlueprint({
      localPath: directory,
      projectId: "origin-no-git",
    });

    expect(result.blueprint.commitSha).toBeUndefined();
    expect(result.blueprint.branch).toBeUndefined();
    expect(result.origin).toMatchObject({
      sourceKind: "filesystem",
      dirty: false,
    });
  }, 30_000);

  it("analysis of a git folder reports the real head commit", async () => {
    const directory = createAnalyzableDirectory();
    execFileSync("git", ["init", "--quiet"], { cwd: directory });
    execFileSync("git", ["config", "user.email", "visudev-test@example.invalid"], {
      cwd: directory,
    });
    execFileSync("git", ["config", "user.name", "VisuDEV Test"], { cwd: directory });
    execFileSync("git", ["add", "route.ts"], { cwd: directory });
    execFileSync("git", ["commit", "--quiet", "-m", "fixture"], { cwd: directory });
    const expectedCommit = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: directory,
      encoding: "utf8",
    }).trim();
    const expectedBranch = execFileSync("git", ["branch", "--show-current"], {
      cwd: directory,
      encoding: "utf8",
    }).trim();

    const result = await analyzeLocalBlueprint({
      localPath: directory,
      projectId: "origin-git",
    });

    expect(result.blueprint.commitSha).toBe(expectedCommit);
    expect(result.blueprint.branch).toBe(expectedBranch);
    expect(result.origin).toMatchObject({
      sourceKind: "git",
      commitSha: expectedCommit,
      branch: expectedBranch,
      dirty: false,
    });
  }, 30_000);
});
