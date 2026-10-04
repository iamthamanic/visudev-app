/**
 * SDE-02 contract tests — epistemic statuses, authority rules, import purity.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  isAuthoritativeEvidence,
  isScanKnowledgeStatus,
  type ScanEvidence,
  type ScanSnapshot,
} from "./index.js";

const SCAN_DETECTOR_DIR = dirname(fileURLToPath(import.meta.url));

describe("scan-detector contracts", () => {
  it("recognizes legacy and canonical knowledge statuses", () => {
    for (const status of [
      "detected",
      "inferred",
      "observed",
      "verified",
      "conflicted",
      "unknown",
      "VERIFIED",
      "SUPPORTED",
      "INTERPRETED",
      "UNKNOWN",
      "CONFLICTED",
    ] as const) {
      expect(isScanKnowledgeStatus(status)).toBe(true);
    }
    expect(isScanKnowledgeStatus("suggested")).toBe(false);
    expect(isScanKnowledgeStatus("INFERRED")).toBe(false);
  });

  it("treats LLM evidence as non-authoritative", () => {
    const llm: ScanEvidence = {
      id: "ev-llm",
      kind: "suggestion",
      status: "inferred",
      confidence: 0.4,
      provenance: {
        originKind: "llm",
        detectorId: "llm-helper",
        llmSuggested: true,
      },
      payload: { summary: "maybe a domain" },
    };
    expect(isAuthoritativeEvidence(llm)).toBe(false);

    const staticDetected: ScanEvidence = {
      id: "ev-static",
      kind: "ast-import",
      status: "detected",
      confidence: 1,
      provenance: { originKind: "static", detectorId: "static-imports-v1" },
      payload: { filePath: "src/a.ts", line: 1, summary: "import b" },
    };
    expect(isAuthoritativeEvidence(staticDetected)).toBe(true);
  });

  it("allows a versioned ScanSnapshot with capability manifest", () => {
    const snapshot: ScanSnapshot = {
      version: 1,
      projectId: "demo",
      analyzedAt: "2026-10-01T00:00:00.000Z",
      enrichment: "off",
      repo: { commitSha: "abc1234", branch: "main", dirty: false },
      versions: {
        engineVersion: "0.1.0-sde",
        modelVersions: {
          softwareGraph: "1",
          semanticSystemModel: "1",
        },
        detectorVersions: { "static-imports-v1": "1.0.0" },
      },
      capabilities: [
        {
          id: "static-imports-v1",
          label: "Static imports",
          family: "static-ast",
          version: "1.0.0",
          supports: ["typescript"],
        },
      ],
      facts: [
        {
          id: "fact-1",
          kind: "imports",
          status: "detected",
          confidence: 1,
          provenance: { originKind: "static", detectorId: "static-imports-v1" },
          subjectId: "file:a",
          objectId: "file:b",
          evidenceIds: ["ev-static"],
        },
      ],
      evidence: [],
    };
    expect(snapshot.capabilities).toHaveLength(1);
    expect(snapshot.versions.engineVersion).toContain("sde");
  });

  it("keeps scan-detector sources free of Node/Deno/DOM/React/Supabase imports", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
          files.push(full);
        }
      }
    };
    walk(SCAN_DETECTOR_DIR);
    expect(files.length).toBeGreaterThan(0);
    const banned = /from\s+["'](?:node:|deno:|react|react-dom|@supabase\/|fs|path|child_process)/;
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(banned);
    }
  });
});
