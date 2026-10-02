/**
 * Unit tests for SDE-09 runtime safe-action policy + evidence normalization.
 */

import { describe, expect, it } from "vitest";
import {
  isDangerousRuntimeAction,
  isSafeRuntimeInteractionCandidate,
} from "./domain/runtime/safe-action-policy.js";
import { normalizeRuntimeEvidence } from "./application/normalize-runtime-evidence.js";
import type { RuntimeObserverCrawlResult } from "./domain/runtime/crawl-result.js";
import { createRuntimeObserverDetector } from "./application/create-runtime-observer-detector.js";
import { RUNTIME_OBSERVER_DETECTOR_ID } from "./domain/runtime/runtime-observer-port.js";

describe("safe-action-policy", () => {
  it("blocks destructive and payment labels", () => {
    expect(isDangerousRuntimeAction("Delete account")).toBe(true);
    expect(isDangerousRuntimeAction("Buy now")).toBe(true);
    expect(isDangerousRuntimeAction("Sign out")).toBe(true);
    expect(isDangerousRuntimeAction("Pay invoice")).toBe(true);
    expect(isDangerousRuntimeAction("Deploy release")).toBe(true);
    expect(isDangerousRuntimeAction("Open settings")).toBe(false);
  });

  it("rejects invisible, disabled, or dangerous candidates", () => {
    expect(
      isSafeRuntimeInteractionCandidate({
        label: "Save",
        visible: true,
        enabled: true,
      }),
    ).toBe(true);
    expect(
      isSafeRuntimeInteractionCandidate({
        label: "Delete row",
        visible: true,
        enabled: true,
      }),
    ).toBe(false);
    expect(
      isSafeRuntimeInteractionCandidate({
        label: "Save",
        visible: false,
        enabled: true,
      }),
    ).toBe(false);
  });
});

describe("normalizeRuntimeEvidence", () => {
  const crawl: RuntimeObserverCrawlResult = {
    baseUrl: "http://127.0.0.1:4173",
    crawledAt: "2026-10-02T12:00:00.000Z",
    summary: {
      visitedScreens: 1,
      attemptedClicks: 1,
      verifiedEdges: 1,
      stateCaptures: 0,
      mismatchCount: 1,
      issueCount: 1,
    },
    snapshots: [
      {
        screenId: "home",
        route: "/",
        interactiveCount: 3,
        containerCount: 0,
        openContainerCount: 0,
      },
      {
        screenId: "runtime-only-modal",
        route: "/",
        interactiveCount: 1,
        containerCount: 1,
        openContainerCount: 1,
      },
    ],
    verifiedEdges: [
      {
        fromScreenId: "home",
        toScreenId: "about",
        type: "navigate",
        targetPath: "/about",
        verification: "route-change",
        sourceRoute: "/",
        targetRoute: "/about",
        matchedBy: "path",
      },
    ],
    stateScreens: [],
    issues: [
      {
        code: "graph_without_runtime_match",
        severity: "warning",
        screenId: "home",
        message: "Navigation nach /mystery konnte keinem Screen zugeordnet werden.",
      },
    ],
  };

  it("emits runtime facts/evidence and keeps runtime-only candidates", () => {
    const known = new Set(["screen:home", "home"]);
    const result = normalizeRuntimeEvidence({ crawl, knownStaticSubjectIds: known });
    expect(result.facts.some((fact) => fact.kind === "runtime.screen.observed")).toBe(true);
    expect(result.runtimeOnlyCount).toBeGreaterThan(0);
    expect(
      result.facts.some(
        (fact) =>
          fact.subjectId === "screen:runtime-only-modal" && fact.attributes?.runtimeOnly === true,
      ),
    ).toBe(true);
  });

  it("marks static/runtime mismatch as conflicted (no silent overwrite)", () => {
    const result = normalizeRuntimeEvidence({ crawl });
    expect(result.conflictCount).toBe(1);
    const conflict = result.facts.find((fact) => fact.kind === "runtime.static.conflict");
    expect(conflict?.status).toBe("conflicted");
    expect(result.evidence.some((item) => item.status === "conflicted")).toBe(true);
  });
});

describe("createRuntimeObserverDetector", () => {
  it("runs provider through engine detector port", async () => {
    const crawl: RuntimeObserverCrawlResult = {
      baseUrl: "http://localhost",
      crawledAt: "2026-10-02T12:00:00.000Z",
      summary: {
        visitedScreens: 1,
        attemptedClicks: 0,
        verifiedEdges: 0,
        stateCaptures: 0,
        mismatchCount: 0,
        issueCount: 0,
      },
      snapshots: [
        {
          screenId: "a",
          route: "/",
          interactiveCount: 0,
          containerCount: 0,
          openContainerCount: 0,
        },
      ],
      verifiedEdges: [],
      stateScreens: [],
      issues: [],
    };

    const detector = createRuntimeObserverDetector({
      provider: {
        observe: async () => crawl,
      },
      resolveRequest: () => ({ baseUrl: "http://localhost", screens: [] }),
    });

    const result = await detector.run({
      projectId: "demo",
      enrichment: "off",
      requestedCapabilityIds: ["runtime-crawl"],
      budget: { timeoutMs: 5_000 },
    });

    expect(result.detectorId).toBe(RUNTIME_OBSERVER_DETECTOR_ID);
    expect(result.status).toBe("success");
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.evidence.every((item) => item.provenance.originKind === "runtime")).toBe(true);
  });
});
