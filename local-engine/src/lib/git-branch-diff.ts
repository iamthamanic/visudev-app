/**
 * Git branch diff helper — runs a real `git diff` between two validated branches.
 * Location: local-engine/src/lib/git-branch-diff.ts
 *
 * Branch names are validated against `git for-each-ref` before any diff runs.
 * No shell injection: args are passed as an array to execFile.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitBranchDiff, GitBranchDiffFile } from "../../../shared/visudev-api.types.js";

const execFileAsync = promisify(execFile);
const MAX_DIFF_FILES = 500;
const MAX_BRANCH_NAME_LEN = 64;

export type GitCommandRunner = (repoPath: string, args: string[]) => Promise<string>;

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

function isValidBranchName(name: string): boolean {
  if (!name || name.length > MAX_BRANCH_NAME_LEN) return false;
  if (name.startsWith("-")) return false;
  // Allow alnum, dot, dash, slash, underscore — reject anything else.
  return /^[a-zA-Z0-9._/-]+$/.test(name);
}

async function listBranches(repoPath: string, runGit: GitCommandRunner): Promise<string[]> {
  const raw = await runGit(repoPath, ["for-each-ref", "--format=%(refname:short)", "refs/heads"]);
  return raw
    .split("\0")
    .map((branch) => branch.trim())
    .filter((branch) => branch.length > 0);
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

export async function readBranchDiff(
  repoPath: string,
  base: string,
  head: string,
  runGit: GitCommandRunner = runGitDefault,
): Promise<GitBranchDiff> {
  if (!isValidBranchName(base) || !isValidBranchName(head)) {
    throw new Error("Invalid branch name");
  }

  const branches = await listBranches(repoPath, runGit);
  if (!branches.includes(base)) {
    throw new Error(`Branch not found: ${base}`);
  }
  if (!branches.includes(head)) {
    throw new Error(`Branch not found: ${head}`);
  }

  if (base === head) {
    return emptyDiff(base, head);
  }

  const raw = await runGit(repoPath, [
    "diff",
    "--numstat",
    "-z",
    "--no-color",
    `${base}...${head}`,
  ]);

  const files = parseNumstatZ(raw);
  const addedLines = files.reduce((sum, file) => sum + file.added, 0);
  const removedLines = files.reduce((sum, file) => sum + file.removed, 0);

  return {
    base,
    head,
    files,
    addedLines,
    removedLines,
    changedFiles: files.length,
    identical: files.length === 0,
    truncated: files.length >= MAX_DIFF_FILES,
  };
}
