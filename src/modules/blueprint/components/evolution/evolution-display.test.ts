/**
 * Display helper tests for Evolution snapshot/git formatting.
 */

import { describe, it, expect } from "vitest";
import type { SoftwareGraphSnapshot } from "../../types";
import {
  displayText,
  formatCommitSha,
  formatSnapshotDate,
  formatSnapshotOrigin,
  snapshotOriginHelp,
} from "./evolution-display.js";

const snapshot: SoftwareGraphSnapshot = {
  id: "snapshot:abc1234:2026-01-02T03:04:05.678Z",
  label: "fallback",
  ref: "abc1234",
  capturedAt: "2026-01-02T03:04:05.678Z",
  nodeIds: [],
};

describe("evolution-display", () => {
  it("formats valid snapshot dates", () => {
    expect(formatSnapshotDate("2026-01-02T00:00:00.000Z")).toBe("2026-01-02");
  });

  it("falls back for invalid snapshot dates", () => {
    expect(formatSnapshotDate("")).toBe("—");
    expect(formatSnapshotDate("bad")).toBe("—");
  });

  it("normalizes labels and commit shas", () => {
    expect(displayText("  hello  ")).toBe("hello");
    expect(displayText(undefined)).toBe("—");
    expect(formatCommitSha("abc")).toBe("—");
    expect(formatCommitSha("1234567890")).toBe("12345678");
  });

  it("formats all specified analysis origin states", () => {
    expect(
      formatSnapshotOrigin({
        ...snapshot,
        sourceKind: "git",
        commitSha: "abc1234",
        branch: "main",
        dirty: false,
      }),
    ).toBe("Commit abc1234 · Branch main");
    const dirtySnapshot = {
      ...snapshot,
      sourceKind: "git" as const,
      commitSha: "abc1234",
      branch: "main",
      dirty: true,
    };
    expect(formatSnapshotOrigin(dirtySnapshot)).toBe(
      "Commit abc1234 · Branch main · ungespeicherte Änderungen",
    );
    expect(snapshotOriginHelp(dirtySnapshot)).toBe(
      "Du hast Dateien geändert, aber noch nicht in Git gespeichert. Diese Analyse zeigt deinen aktuellen Stand, nicht den letzten Commit.",
    );
    expect(
      formatSnapshotOrigin({
        ...snapshot,
        sourceKind: "git",
        commitSha: "abc1234",
        dirty: false,
      }),
    ).toBe("Commit abc1234 · kein Branch");
    expect(
      formatSnapshotOrigin({
        ...snapshot,
        sourceKind: "filesystem",
        dirty: false,
      }),
    ).toBe("Kein Git-Repository · Stand 02.01.2026 03:04:05");
  });
});
