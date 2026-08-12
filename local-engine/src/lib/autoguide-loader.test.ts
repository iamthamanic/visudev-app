/**
 * Unit tests for AutoGuide package detection.
 * Location: local-engine/src/lib/autoguide-loader.test.ts
 */

import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectAutoGuidePackages } from "./autoguide-loader.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("detectAutoGuidePackages", () => {
  it("reports unavailable when root is missing", async () => {
    const status = await detectAutoGuidePackages("/tmp/visudev-autoguide-missing-root");
    expect(status.available).toBe(false);
    expect(status.packages.scanner).toBe(false);
    expect(status.message).toBeTruthy();
  });

  it("detects built packages from an explicit root when present", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "visudev-autoguide-"));
    tempRoots.push(root);
    const scannerEntry = path.join(root, "packages", "scanner", "dist");
    await mkdir(scannerEntry, { recursive: true });
    await writeFile(path.join(scannerEntry, "index.js"), "export default {};\n", "utf8");

    const status = await detectAutoGuidePackages(root);
    expect(status.root).toBe(root);
    expect(status.packages.scanner).toBe(true);
    expect(typeof status.packages.core).toBe("boolean");
  });
});
