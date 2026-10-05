/**
 * Git commit-to-commit diff — validates real SHAs via rev-parse (never synthetic).
 * Location: local-engine/src/lib/git-commit-diff.ts
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitBranchDiff, GitBranchDiffFile } from "../../../shared/visudev-api.types.js";
import type { GitCommandRunner } from "./git-branch-diff.js";

const execFileAsync = promisify(execFile);
const MAX_DIFF_FILES = 500;
const MAX_REF_LEN = 64;

async function runGitDefault(repoPath: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

function emptyDiff(base: string, head: string): GitBranchDiff {
  return {
    base,
    head,
    files: [],
    addedLines: 0,
    removedLines: 0,
    changedFiles: 0,
    identical: true,
    truncated: false,
  };
}

function isSafeGitRef(name: string): boolean {
  if (!name || name.length > MAX_REF_LEN) return false;
  if (name.startsWith("-")) return false;
  return /^[a-zA-Z0-9._/-]+$/.test(name);
}

export function looksLikeCommitSha(value: string): boolean {
  return /^[0-9a-f]{7,40}$/i.test(value);
}

async function resolveCommitSha(
  repoPath: string,
  ref: string,
  runGit: GitCommandRunner,
): Promise<string> {
  if (!isSafeGitRef(ref) || !looksLikeCommitSha(ref)) {
    throw new Error("Invalid commit SHA");
  }
  try {
    const resolved = (await runGit(repoPath, ["rev-parse", "--verify", `${ref}^{commit}`])).trim();
    if (!/^[0-9a-f]{40}$/i.test(resolved)) {
      throw new Error(`Commit not found: ${ref}`);
    }
    return resolved.toLowerCase();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid commit")) throw error;
    throw new Error(`Commit not found: ${ref}`);
  }
}

function parseNumstatZ(raw: string): GitBranchDiffFile[] {
  if (!raw) return [];
  const records = raw.split("\0").filter((record) => record.length > 0);
  const files: GitBranchDiffFile[] = [];
  for (let index = 0; index + 2 < records.length && files.length < MAX_DIFF_FILES; index += 3) {
    const addedRaw = records[index];
    const removedRaw = records[index + 1];
    const filePath = records[index + 2];
    if (!filePath) continue;
    files.push({
      filePath,
      added: addedRaw === "-" ? 0 : Number(addedRaw) || 0,
      removed: removedRaw === "-" ? 0 : Number(removedRaw) || 0,
    });
  }
  return files;
}

export async function readCommitDiff(
  repoPath: string,
  base: string,
  head: string,
  runGit: GitCommandRunner = runGitDefault,
): Promise<GitBranchDiff> {
  const baseSha = await resolveCommitSha(repoPath, base, runGit);
  const headSha = await resolveCommitSha(repoPath, head, runGit);

  if (baseSha === headSha) {
    return emptyDiff(baseSha, headSha);
  }

  const raw = await runGit(repoPath, [
    "diff",
    "--numstat",
    "-z",
    "--no-color",
    `${baseSha}..${headSha}`,
  ]);
  const files = parseNumstatZ(raw);
  const addedLines = files.reduce((sum, file) => sum + file.added, 0);
  const removedLines = files.reduce((sum, file) => sum + file.removed, 0);

  return {
    base: baseSha,
    head: headSha,
    files,
    addedLines,
    removedLines,
    changedFiles: files.length,
    identical: files.length === 0,
    truncated: files.length >= MAX_DIFF_FILES,
  };
}

export function gitCommitDiffErrorStatus(error: unknown): number {
  if (error instanceof Error) {
    if (error.message === "Invalid commit SHA" || error.message.startsWith("Commit not found")) {
      return 400;
    }
  }
  return 500;
}
