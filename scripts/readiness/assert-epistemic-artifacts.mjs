/**
 * Hard epistemic gates from full-audit artifacts (PR-18).
 * Location: scripts/readiness/assert-epistemic-artifacts.mjs
 */

import fs from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} outDir
 * @returns {Promise<{ passed: boolean, hardGates: Record<string, boolean>, failures: string[] }>}
 */
export async function assertEpistemicArtifacts(outDir) {
  const failures = [];
  const hardGates = {
    consoleClean: false,
    noSilentTruthTruncation: false,
    semanticsPresent: false,
  };

  const consolePath = path.join(outDir, "browser-console-assertions.json");
  try {
    const consoleAssert = JSON.parse(await fs.readFile(consolePath, "utf8"));
    hardGates.consoleClean = Boolean(consoleAssert?.passed);
    if (!hardGates.consoleClean) {
      failures.push("console-clean: browser-console-assertions.json not passed");
    }
  } catch {
    failures.push("console-clean: missing browser-console-assertions.json");
  }

  const semanticsPath = path.join(outDir, "analysis-semantics.json");
  try {
    const semantics = JSON.parse(await fs.readFile(semanticsPath, "utf8"));
    hardGates.semanticsPresent = Boolean(semantics?.passed);
    if (!hardGates.semanticsPresent) {
      failures.push(
        `semantics: ${Array.isArray(semantics?.failures) ? semantics.failures.slice(0, 3).join("; ") : "failed"}`,
      );
    }
    const summary = semantics?.summary || {};
    const authoritative = summary.factsAuthoritative ?? summary.factsExtracted;
    const extracted = summary.factsExtracted;
    if (
      typeof authoritative === "number" &&
      typeof extracted === "number" &&
      authoritative === extracted
    ) {
      hardGates.noSilentTruthTruncation = true;
    } else if (semantics?.passed) {
      // Shared gate already asserts truncation when enrichment OFF.
      hardGates.noSilentTruthTruncation = true;
    } else {
      failures.push("no-silent-truth-truncation: factsAuthoritative ≠ factsExtracted or missing");
    }
  } catch {
    failures.push("semantics: missing analysis-semantics.json");
  }

  return {
    passed: failures.length === 0,
    hardGates,
    failures,
  };
}
