import { describe, expect, it } from "vitest";
import {
  detectDomain,
  detectDomainAndModule,
  detectLayer,
  detectModule,
  inferRuntime,
  normalizePath,
  UNASSIGNED_DOMAIN,
} from "./_heuristics.js";
import { buildSegmentSpreadIndex } from "./_segment-spread.js";

describe("software graph heuristics", () => {
  it("normalizes leading slashes", () => {
    expect(normalizePath("/src/routes/users.ts")).toBe("src/routes/users.ts");
  });

  it("detects domain from src path", () => {
    expect(detectDomain("src/modules/blueprint/page.tsx")).toBe("modules");
  });

  it("detects monorepo apps/packages domains", () => {
    expect(detectDomain("apps/web/app/page.tsx")).toBe("apps/web");
    expect(detectDomain("packages/database/schema.prisma")).toBe("packages/database");
    expect(detectDomain("apps/api/plane/urls.py")).toBe("apps/api");
  });

  it("detects module from path segments", () => {
    expect(detectModule("src/routes/users.ts", "routes")).toBe("routes");
    expect(detectModule("src/routes/internal/admin.ts", "routes")).toBe("internal");
  });

  it("detects presentation layer for routes folder", () => {
    expect(detectLayer("src/routes/users.ts")).toBe("presentation");
  });

  it("detects Next app router and prisma as real layers (Softort)", () => {
    expect(detectLayer("apps/web/app/health/route.ts")).toBe("presentation");
    expect(detectLayer("apps/web/app/(app)/page.tsx")).toBe("presentation");
    expect(detectLayer("packages/database/schema.prisma")).toBe("data");
    expect(detectLayer("apps/api/plane/urls.py")).toBe("presentation");
    expect(detectLayer("apps/api/plane/models.py")).toBe("data");
  });

  it("skips Next route groups in module names and classifies app/api as server", () => {
    expect(detectModule("apps/web/app/(app)/surveys/page.tsx", "apps/web")).toBe("surveys");
    expect(detectModule("apps/web/app/(app)/page.tsx", "apps/web")).toBe("app");
    expect(inferRuntime("apps/web/app/api/health/route.ts")).toBe("server");
    expect(inferRuntime("apps/web/app/(app)/page.tsx")).toBe("browser");
  });

  it("detects data layer for repositories folder", () => {
    expect(detectLayer("src/repositories/user-repo.ts")).toBe("data");
  });

  it("without index, legacy first-segment behavior remains", () => {
    expect(detectDomain("backend/app/modules/leaves/x.ts")).toBe("backend");
  });

  it("with spread index, nested module directory yields business domain", () => {
    const paths = [
      "backend/app/modules/leaves/a.ts",
      "backend/app/modules/leaves/b.ts",
      "backend/app/modules/payroll/c.ts",
      "backend/app/modules/auth/d.ts",
      "backend/app/modules/documents/e.ts",
    ];
    const spread = buildSegmentSpreadIndex(paths);
    const detected = detectDomainAndModule("backend/app/modules/leaves/x.ts", spread);
    expect(detected.domain).toBe("leaves");
    expect(detected.domainSource).toBe("path");
    expect(detected.domain).not.toBe("modules");
  });

  it("layer-first app tree yields none", () => {
    const paths = [
      "app/models/a.rb",
      "app/models/b.rb",
      "app/controllers/a.rb",
      "plugins/x/models/c.rb",
    ];
    const spread = buildSegmentSpreadIndex(paths);
    const detected = detectDomainAndModule("app/models/topic.rb", spread);
    expect(detected.domain).toBe(UNASSIGNED_DOMAIN);
    expect(detected.domainSource).toBe("none");
  });

  it("erpnext accounts path yields accounts", () => {
    const paths = [
      "apps/erpnext/erpnext/accounts/a.py",
      "apps/erpnext/erpnext/accounts/b.py",
      "apps/erpnext/erpnext/buying/c.py",
      "apps/erpnext/erpnext/crm/d.py",
      "apps/erpnext/erpnext/stock/e.py",
    ];
    const spread = buildSegmentSpreadIndex(paths);
    // Under monorepo prefix apps/erpnext, scan remaining for candidates.
    const detected = detectDomainAndModule("apps/erpnext/erpnext/accounts/gl.py", spread);
    expect(detected.domain).toBe("accounts");
    expect(detected.domainSource).toBe("path");
  });

  it("no STRUCTURAL list required", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./_heuristics.ts", import.meta.url), "utf8"),
    );
    expect(source.includes("STRUCTURAL_SEGMENTS")).toBe(false);
    expect(source.includes("SURFACE_SEGMENTS")).toBe(false);
    expect(source.includes("LAYER_SEGMENTS")).toBe(false);
  });
});
