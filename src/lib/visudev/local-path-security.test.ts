import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveValidatedLocalPath } from "../../../shared/local-path-security.mjs";

const originalAllowedRoots = process.env.VISUDEV_ALLOWED_LOCAL_ROOTS;

afterEach(() => {
  if (originalAllowedRoots === undefined) {
    delete process.env.VISUDEV_ALLOWED_LOCAL_ROOTS;
  } else {
    process.env.VISUDEV_ALLOWED_LOCAL_ROOTS = originalAllowedRoots;
  }
});

describe("resolveValidatedLocalPath", () => {
  it("rejects relative paths", () => {
    const result = resolveValidatedLocalPath("relative/path");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("absolute");
  });

  it("accepts a directory under an explicit allowed root", () => {
    const root = mkdtempSync(join(homedir(), "visudev-local-path-root-"));
    const dir = join(root, "workspace");
    mkdirSync(dir);
    process.env.VISUDEV_ALLOWED_LOCAL_ROOTS = root;
    try {
      const result = resolveValidatedLocalPath(dir);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.path).toBeTruthy();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a home temp dir when not under allowed roots", () => {
    const dir = mkdtempSync(join(homedir(), "visudev-local-path-denied-"));
    process.env.VISUDEV_ALLOWED_LOCAL_ROOTS = join(homedir(), ".visudev");
    try {
      const result = resolveValidatedLocalPath(dir);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("outside allowed roots");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
