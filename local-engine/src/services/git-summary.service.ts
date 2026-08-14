/**
 * Git summary service for local projects.
 */

import { assertRegisteredLocalProject } from "../lib/project-access.js";
import { readGitSummary } from "../lib/git-summary.js";
import { normalizeGitSummary } from "../../../shared/git-summary-normalize.js";
import type { ProjectService } from "./project.service.js";
import type { LocalVisuDevProject, GitSummary } from "../types/api.types.js";

export type GitSummaryReader = (repoPath: string) => Promise<GitSummary>;

export class GitSummaryService {
  constructor(
    private readonly projectService: ProjectService,
    private readonly readSummary: GitSummaryReader = readGitSummary,
  ) {}

  async getProjectGitSummary(projectId: string): Promise<GitSummary> {
    const project = await assertRegisteredLocalProject(this.projectService, projectId);
    if (!project.localPath) {
      return normalizeGitSummary({
        initialized: false,
        shallow: false,
        commits: [],
        branches: [],
        workingTree: { modified: [], added: [], deleted: [] },
        warnings: ["no_local_path"],
      });
    }
    const summary = await this.readSummary(project.localPath);
    return normalizeGitSummary(summary);
  }

  async getProjectSummary(projectId: string): Promise<LocalVisuDevProject> {
    return assertRegisteredLocalProject(this.projectService, projectId);
  }
}
