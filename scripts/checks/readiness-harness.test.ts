/**
 * Product Readiness harness tests (#375) — manifest, local identity, UNAVAILABLE rules.
 * Location: scripts/checks/readiness-harness.test.ts
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  aggregateProjectVerdict,
  buildCapabilityReport,
  resolveCapabilityStatus,
  resolveRuntimeExplorationStatus,
} from "../readiness/capability-status.mjs";
import { EXPECTED_IDS, loadReadinessManifest } from "../readiness/load-manifest.mjs";
import { resolveProjectSource } from "../readiness/resolve-project.mjs";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("readiness harness manifest", () => {
  it("loads exactly the five golden projects with pinned GitHub SHAs", () => {
    const manifest = loadReadinessManifest();
    expect(manifest.projects.map((project) => project.id)).toEqual(EXPECTED_IDS);

    const github = manifest.projects.filter((project) => project.source.kind === "github");
    expect(github).toHaveLength(4);
    for (const project of github) {
      expect(String(project.source.commitSha)).toMatch(/^[0-9a-f]{40}$/i);
      expect(project.source).not.toHaveProperty("pathEnv");
    }

    const haba = manifest.projects.find((project) => project.id === "hv123-mobile-haba");
    expect(haba?.source.kind).toBe("local");
    expect(haba?.source.localProjectKey).toBe("HV123-Mobile-HABA");
    expect(haba?.source.pathEnv).toBe("VISUDEV_READINESS_HABA_PATH");
    expect(haba?.source).not.toHaveProperty("repositoryUrl");
    expect(haba?.source).not.toHaveProperty("owner");
    expect(haba?.source).not.toHaveProperty("repo");
    expect(haba?.source).not.toHaveProperty("commitSha");

    const hrk = manifest.projects.find((project) => project.id === "hrkoordinator");
    expect(hrk?.gate.mode).toBe("full");
    expect(hrk?.source.commitSha).toBe("d34842f922d1fab330e4df7bb6ab99a4b2e1f905");
  });
});

describe("capability UNAVAILABLE contract", () => {
  it("never reports PASS when optional runtime secrets are missing", () => {
    expect(
      resolveRuntimeExplorationStatus({
        requirement: "optional",
        secretsPresent: false,
        executed: false,
      }),
    ).toBe("UNAVAILABLE");

    expect(
      resolveCapabilityStatus({
        requirement: "optional",
        available: false,
        passed: true,
      }),
    ).toBe("UNAVAILABLE");
  });

  it("aggregates missing optional local source as UNAVAILABLE not PASS", () => {
    const manifest = loadReadinessManifest();
    const haba = manifest.projects.find((project) => project.id === "hv123-mobile-haba");
    expect(haba).toBeTruthy();
    const rows = buildCapabilityReport(haba!, {
      sourceAvailable: false,
      runtimeSecretsPresent: false,
      runtimeExecuted: false,
    });
    const verdict = aggregateProjectVerdict(rows, {
      sourceAvailable: false,
      sourceRequired: false,
    });
    expect(verdict.verdict).toBe("UNAVAILABLE");
    expect(verdict.verdict).not.toBe("PASS");
    expect(rows.every((row) => row.status !== "PASS")).toBe(true);
  });
});

describe("private GitHub checkout honesty", () => {
  it("marks github source UNAVAILABLE when CI checkout flag is false", () => {
    const manifest = loadReadinessManifest();
    const screenator = manifest.projects.find((project) => project.id === "screenator")!;
    const missing = resolveProjectSource(screenator, {
      VISUDEV_READINESS_CHECKOUT_OK: "false",
    });
    expect(missing.available).toBe(false);
    expect(missing.reason).toMatch(/checkout unavailable/i);
    expect(screenator.gate.sourceRequiredInCi).toBe(false);
  });
});

describe("HV123-Mobile-HABA local identity", () => {
  it("accepts a valid local dogfood path and rejects invented remotes", () => {
    const manifest = loadReadinessManifest();
    const haba = manifest.projects.find((project) => project.id === "hv123-mobile-haba")!;
    const root = mkdtempSync(path.join(tmpdir(), "haba-"));
    tempDirs.push(root);
    const projectDir = path.join(root, "HV123-Mobile-HABA");
    mkdirSync(projectDir);
    writeFileSync(path.join(projectDir, "package.json"), '{"name":"hv123-mobile-haba"}\n');

    const ok = resolveProjectSource(haba, {
      VISUDEV_READINESS_HABA_PATH: projectDir,
    });
    expect(ok.available).toBe(true);
    expect(ok.kind).toBe("local");
    expect(ok.repositoryUrl).toBeNull();

    const missing = resolveProjectSource(haba, {});
    expect(missing.available).toBe(false);
    expect(missing.reason).toMatch(/UNAVAILABLE/i);
  });
});
