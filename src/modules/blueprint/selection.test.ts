import { describe, expect, it } from "vitest";
import type { SoftwareGraphNode } from "./types.js";
import {
  HINT_NO_FILE,
  HINT_NO_NODE,
  HINT_UNKNOWN_LINE,
  findNodeIdsByFilePath,
  selectionFromCode,
  selectionFromNode,
} from "./selection.js";

function node(
  partial: Partial<SoftwareGraphNode> & Pick<SoftwareGraphNode, "id">,
): SoftwareGraphNode {
  return {
    kind: "file",
    label: partial.id,
    metadata: {},
    ...partial,
  };
}

describe("graph ↔ code selection", () => {
  it("maps a node with filePath and line", () => {
    const auth = node({ id: "n-auth", filePath: "src/auth.ts", line: 12, label: "auth" });
    const selection = selectionFromNode(auth, [auth]);
    expect(selection).toMatchObject({
      nodeId: "n-auth",
      filePath: "src/auth.ts",
      line: 12,
      origin: "graph",
      relatedNodeIds: ["n-auth"],
      hint: null,
    });
  });

  it("uses Zeile unbekannt when the file has no line", () => {
    const auth = node({ id: "n-auth", filePath: "src/auth.ts", label: "auth" });
    expect(selectionFromNode(auth, [auth]).hint).toBe(HINT_UNKNOWN_LINE);
    expect(selectionFromNode(auth, [auth]).line).toBeNull();
  });

  it("uses Keine Datei — externer Service when filePath is missing", () => {
    const stripe = node({ id: "ext-stripe", kind: "external", label: "Stripe" });
    const selection = selectionFromNode(stripe, [stripe]);
    expect(selection.filePath).toBeNull();
    expect(selection.hint).toBe(HINT_NO_FILE);
    expect(selection.relatedNodeIds).toEqual(["ext-stripe"]);
  });

  it("marks every node that shares the same filePath", () => {
    const a = node({ id: "sym-a", filePath: "src/auth.ts", line: 4, label: "login" });
    const b = node({ id: "sym-b", filePath: "src/auth.ts", line: 40, label: "logout" });
    const other = node({ id: "sym-c", filePath: "src/db.ts", label: "db" });
    expect(findNodeIdsByFilePath([a, b, other], "src/auth.ts")).toEqual(["sym-a", "sym-b"]);
    expect(selectionFromNode(a, [a, b, other]).relatedNodeIds).toEqual(["sym-a", "sym-b"]);
  });

  it("focuses the matching node from a code click", () => {
    const a = node({ id: "sym-a", filePath: "src/auth.ts", line: 4, label: "login" });
    const b = node({ id: "sym-b", filePath: "src/auth.ts", line: 40, label: "logout" });
    const selection = selectionFromCode("src/auth.ts", 40, [a, b]);
    expect(selection.nodeId).toBe("sym-b");
    expect(selection.origin).toBe("code");
    expect(selection.relatedNodeIds).toEqual(["sym-a", "sym-b"]);
  });

  it("returns Kein Knoten für diese Datei when no graph node matches", () => {
    const selection = selectionFromCode("src/orphan.ts", 1, []);
    expect(selection.nodeId).toBeNull();
    expect(selection.hint).toBe(HINT_NO_NODE);
  });
});
