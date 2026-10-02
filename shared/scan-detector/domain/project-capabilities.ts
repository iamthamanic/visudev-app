/**
 * ProjectCapabilities domain model for ScanDetector discovery (SDE-04).
 * Runtime-neutral — no Node/Deno/DOM imports.
 * Location: shared/scan-detector/domain/project-capabilities.ts
 */

import type { ScanKnowledgeStatus } from "../types.js";

export type DiscoveryLanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "unknown";

export type DiscoveryFrameworkId =
  | "nextjs"
  | "react"
  | "vue"
  | "django"
  | "express"
  | "prisma"
  | "unknown";

export type DeploymentHintKind = "docker-compose" | "kubernetes" | "dockerfile" | "other";

export interface ProjectApplicationScope {
  /** Stable scoped id, e.g. `app:apps/web`. */
  id: string;
  label: string;
  /** Repo-relative root path for this application/package. */
  rootPath: string;
  languageIds: DiscoveryLanguageId[];
  frameworkIds: DiscoveryFrameworkId[];
}

export interface DetectedLanguage {
  id: DiscoveryLanguageId;
  label: string;
  status: Extract<ScanKnowledgeStatus, "detected" | "unknown">;
  evidencePaths: string[];
}

export interface DetectedFramework {
  id: DiscoveryFrameworkId;
  label: string;
  status: Extract<ScanKnowledgeStatus, "detected" | "unknown">;
  applicationIds: string[];
  evidencePaths: string[];
}

export interface DetectedDatastore {
  id: string;
  label: string;
  kind: "prisma" | "sql" | "redis" | "postgres" | "mongodb" | "other";
  evidencePaths: string[];
}

export interface DeploymentHint {
  id: string;
  kind: DeploymentHintKind;
  path: string;
}

export interface UnsupportedSourceEntry {
  path: string;
  reason: "unknown-language" | "oversized" | "excluded-extension";
}

export interface ProjectCapabilities {
  version: 1;
  projectId: string;
  applications: ProjectApplicationScope[];
  languages: DetectedLanguage[];
  frameworks: DetectedFramework[];
  datastores: DetectedDatastore[];
  deploymentHints: DeploymentHint[];
  unsupportedSourceInventory: UnsupportedSourceEntry[];
  /** Capability ids detectors may subscribe to. */
  detectorCapabilityIds: string[];
}

/**
 * Scope a subject id under an application to avoid monorepo collisions.
 * Example: app:apps/web + route:/api/users → app:apps/web::route:/api/users
 */
export function scopedSubjectId(applicationId: string, localSubjectId: string): string {
  const app = applicationId.trim();
  const local = localSubjectId.trim();
  if (!app || !local) return local || app;
  if (local.startsWith(`${app}::`)) return local;
  return `${app}::${local}`;
}
