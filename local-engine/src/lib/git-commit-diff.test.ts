/**
 * Tests for real commit SHA git diffs.
 * Location: local-engine/src/lib/git-commit-diff.test.ts
 */

import { describe, expect, it } from "vitest";
import { looksLikeCommitSha, readCommitDiff } from "./git-commit-diff.js";

describe("git-commit-diff", () => {
  it("accepts only hex SHAs", () => {
    expect(looksLikeCommitSha("abc1234")).toBe(true);
    expect(looksLikeCommitSha("main")).toBe(false);
    expect(looksLikeCommitSha("../evil")).toBe(false);
  });

  it("resolves commits via rev-parse and diffs without synthetic SHAs", async () => {
    const calls: string[][] = [];
    const runGit = async (_repo: string, args: string[]) => {
      calls.push(args);
      if (args[0] === "rev-parse") {
        const ref = String(args[2] || "").replace(/\^\{commit\}$/, "");
        if (ref === "aaaaaaaa") return "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";
        if (ref === "bbbbbbbb") return "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n";
        throw new Error("missing");
      }
      if (args[0] === "diff") {
        return ["1", "0", "src/a.ts", ""].join("\0");
      }
      throw new Error(`unexpected ${args.join(" ")}`);
    };

    const diff = await readCommitDiff("/repo", "aaaaaaaa", "bbbbbbbb", runGit);
    expect(diff.base).toHaveLength(40);
    expect(diff.head).toHaveLength(40);
    expect(diff.files).toEqual([{ filePath: "src/a.ts", added: 1, removed: 0 }]);
    expect(calls.some((args) => args[0] === "rev-parse")).toBe(true);
  });

  it("rejects unknown SHAs", async () => {
    await expect(
      readCommitDiff("/repo", "deadbeef", "cafebabe", async () => {
        throw new Error("fatal");
      }),
    ).rejects.toThrow(/Commit not found|Invalid commit/);
  });
});
