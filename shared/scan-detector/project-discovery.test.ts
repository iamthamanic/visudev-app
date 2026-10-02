/**
 * SDE-04 ProjectCapabilities discovery tests.
 */

import { describe, expect, it } from "vitest";
import { discoverProjectCapabilities } from "./application/discover-project-capabilities.js";
import { scopedSubjectId } from "./domain/project-capabilities.js";

describe("discoverProjectCapabilities", () => {
  it("scopes monorepo apps and keeps route identities distinct", () => {
    const caps = discoverProjectCapabilities({
      projectId: "mono",
      paths: [
        { path: "apps/web/src/app/page.tsx" },
        { path: "apps/web/next.config.ts" },
        { path: "apps/api/src/routes/users.ts" },
        { path: "apps/api/src/routes/users.ts" },
        { path: "packages/db/prisma/schema.prisma" },
        { path: "docker-compose.yml" },
        { path: "apps/legacy/app.rb" },
      ],
    });

    expect(caps.applications.map((app) => app.id).sort()).toEqual([
      "app:apps/api",
      "app:apps/legacy",
      "app:apps/web",
      "app:packages/db",
      "app:root",
    ]);
    expect(caps.frameworks.some((item) => item.id === "nextjs")).toBe(true);
    expect(caps.frameworks.some((item) => item.id === "prisma")).toBe(true);
    expect(caps.datastores.some((item) => item.kind === "prisma")).toBe(true);
    expect(caps.deploymentHints.some((item) => item.kind === "docker-compose")).toBe(true);
    expect(caps.unsupportedSourceInventory.some((item) => item.path.endsWith(".rb"))).toBe(true);
    expect(caps.languages.some((item) => item.id === "unknown")).toBe(true);

    const webUsers = scopedSubjectId("app:apps/web", "route:/api/users");
    const apiUsers = scopedSubjectId("app:apps/api", "route:/api/users");
    expect(webUsers).not.toEqual(apiUsers);
    expect(webUsers).toBe("app:apps/web::route:/api/users");
  });

  it("exposes detector capability ids for orchestrator selection", () => {
    const caps = discoverProjectCapabilities({
      projectId: "p",
      paths: [{ path: "src/index.ts" }, { path: "prisma/schema.prisma" }],
    });
    expect(caps.detectorCapabilityIds).toEqual(
      expect.arrayContaining(["lang:typescript", "framework:prisma", "datastore:prisma"]),
    );
  });
});
