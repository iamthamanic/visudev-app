/**
 * Tests for EvolutionBranchCompare — identical branches, graph node linking.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvolutionBranchCompare } from "./EvolutionBranchCompare";
import type { GitSummary, SoftwareGraphNode } from "../../types";

vi.mock("../../../../lib/visudev-api", () => ({
  isLocalVisuDevMode: () => true,
  getVisuDevClient: () => ({
    getGitBranchDiff: vi.fn().mockResolvedValue({
      base: "main",
      head: "feature-a",
      files: [
        { filePath: "src/a.ts", added: 10, removed: 2 },
        { filePath: "src/orphan.ts", added: 1, removed: 0 },
      ],
      addedLines: 11,
      removedLines: 2,
      changedFiles: 2,
      identical: false,
      truncated: false,
    }),
  }),
}));

const gitSummary: GitSummary = {
  initialized: true,
  shallow: false,
  commits: [],
  branches: [
    { name: "main", headSha: "aaa" },
    { name: "feature-a", headSha: "bbb" },
  ],
  workingTree: { modified: [], added: [], deleted: [] },
};

const graphNodes: SoftwareGraphNode[] = [
  { id: "n1", kind: "file", label: "a.ts", filePath: "src/a.ts", metadata: {} },
];

describe("EvolutionBranchCompare", () => {
  it("shows nothing-found when base and head are identical", async () => {
    render(
      <EvolutionBranchCompare projectId="p1" gitSummary={gitSummary} graphNodes={graphNodes} />,
    );
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "main" } });
    expect(await screen.findByTestId("branch-diff-empty")).toHaveTextContent("Keine Unterschiede");
  });

  it("links changed files to graph nodes or shows an honest hint", async () => {
    render(
      <EvolutionBranchCompare projectId="p1" gitSummary={gitSummary} graphNodes={graphNodes} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("branch-diff-result")).toBeInTheDocument();
    });
    const nodeHints = screen.getAllByTestId("branch-diff-nodes");
    expect(nodeHints[0]).toHaveTextContent("a.ts");
    expect(nodeHints[1]).toHaveTextContent("Kein Knoten für diese Datei");
  });
});
