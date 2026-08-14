import { describe, expect, it } from "vitest";
import { gitBranchDiffErrorStatus, readBranchDiff } from "./git-branch-diff.js";

const mockRunGit = (responses: Record<string, string>) => {
  return async (_repoPath: string, args: string[]): Promise<string> => {
    const key = args.join(" ");
    if (responses[key]) return responses[key];
    throw new Error(`unexpected git call: ${key}`);
  };
};

describe("readBranchDiff", () => {
  it("returns empty diff when base equals head", async () => {
    const runGit = mockRunGit({
      "for-each-ref -z --format=%(refname:short) refs/heads": "main\0feature-a\0",
    });
    const diff = await readBranchDiff("/repo", "main", "main", runGit);
    expect(diff.identical).toBe(true);
    expect(diff.changedFiles).toBe(0);
  });

  it("rejects invalid branch names", async () => {
    const runGit = mockRunGit({});
    await expect(readBranchDiff("/repo", "main; rm -rf /", "head", runGit)).rejects.toThrow(
      "Invalid branch name",
    );
    await expect(readBranchDiff("/repo", "-flag", "head", runGit)).rejects.toThrow(
      "Invalid branch name",
    );
  });

  it("rejects unknown branches", async () => {
    const runGit = mockRunGit({
      "for-each-ref -z --format=%(refname:short) refs/heads": "main\0",
    });
    await expect(readBranchDiff("/repo", "main", "missing", runGit)).rejects.toThrow(
      "Branch not found: missing",
    );
  });

  it("parses newline-separated branch lists as a fallback", async () => {
    const runGit = mockRunGit({
      "for-each-ref -z --format=%(refname:short) refs/heads": "main\nfeature-a\n",
    });
    const diff = await readBranchDiff("/repo", "main", "main", runGit);
    expect(diff.identical).toBe(true);
  });

  it("parses numstat output into file stats", async () => {
    const runGit = mockRunGit({
      "for-each-ref -z --format=%(refname:short) refs/heads": "main\0feature-a\0",
      "diff --numstat -z --no-color main...feature-a":
        "10\x002\x00src/a.ts\x005\x001\x00src/b.ts\x00",
    });
    const diff = await readBranchDiff("/repo", "main", "feature-a", runGit);
    expect(diff.changedFiles).toBe(2);
    expect(diff.addedLines).toBe(15);
    expect(diff.removedLines).toBe(3);
    expect(diff.files[0]).toEqual({ filePath: "src/a.ts", added: 10, removed: 2 });
  });
});

describe("gitBranchDiffErrorStatus", () => {
  it("maps validation failures to 400", () => {
    expect(gitBranchDiffErrorStatus(new Error("Invalid branch name"))).toBe(400);
    expect(gitBranchDiffErrorStatus(new Error("Branch not found: missing"))).toBe(400);
  });

  it("maps other errors to 500", () => {
    expect(gitBranchDiffErrorStatus(new Error("fatal: no merge base"))).toBe(500);
  });
});
