/**
 * Path-based heuristics used by the Software Graph builder.
 * Location: local-engine/src/services/software-graph/_heuristics.ts
 */

import { isDomainCandidate, type SegmentSpreadIndex } from "./_segment-spread.js";

export function normalizePath(filePath: string): string {
  return filePath.replace(/^\/+/, "");
}

export type DomainSource = "path" | "filename" | "none";

export interface DomainDetection {
  domain: string;
  module: string;
  domainSource: DomainSource;
}

/** Placeholder when no domain-candidate segment exists (UI: „Nicht zugeordnet”). */
export const UNASSIGNED_DOMAIN = "unassigned";

function isRouteGroupSegment(segment: string): boolean {
  return /^\([^)]+\)$/.test(segment);
}

function firstMeaningfulSegment(parts: string[]): string | null {
  for (const part of parts) {
    if (!part || part.includes(".")) continue;
    if (isRouteGroupSegment(part)) continue;
    if (part === "app") continue;
    return part;
  }
  return null;
}

function legacyDetectDomain(filePath: string): string {
  const parts = normalizePath(filePath).split("/").filter(Boolean);
  if (parts.length === 0) return "root";

  // Monorepo: apps/<name>/… → apps/<name>, packages/<name>/… → packages/<name>
  if ((parts[0] === "apps" || parts[0] === "packages" || parts[0] === "ee") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  if (parts.length >= 2 && parts[0] === "src") return parts[1] || "src";
  return parts[0] || "root";
}

function legacyDetectModule(filePath: string, domain: string): string {
  const normalized = normalizePath(filePath);

  if (normalized.startsWith("src/")) {
    const prefix = domain === "src" ? "src/" : `src/${domain}/`;
    const rest = normalized.startsWith(prefix)
      ? normalized.slice(prefix.length)
      : normalized.slice(4);
    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 0) return domain;
    if (parts.length === 1) {
      const only = parts[0];
      return only.includes(".") ? domain : only;
    }
    return parts[0];
  }

  const domainPrefix = `${domain}/`;
  const rest = normalized.startsWith(domainPrefix)
    ? normalized.slice(domainPrefix.length)
    : normalized;
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 0) {
    return domain.includes("/") ? domain.split("/")[1]! : domain;
  }
  if (parts.length === 1) {
    const only = parts[0]!;
    return only.includes(".") ? (domain.includes("/") ? domain.split("/")[1]! : domain) : only;
  }

  // Next App Router: skip `app/` and route groups like `(app)` / `(marketing)`
  if (parts[0] === "app") {
    const meaningful = firstMeaningfulSegment(parts.slice(1));
    return meaningful ?? "app";
  }

  const meaningful = firstMeaningfulSegment(parts);
  return meaningful ?? parts[0]!;
}

/**
 * Preferred production entry: first domain-candidate segment wins (P0-10).
 * Without candidates → monorepo prefix fallback → `unassigned` + source none.
 */
export function detectDomainAndModule(
  filePath: string,
  spread: SegmentSpreadIndex,
): DomainDetection {
  const parts = normalizePath(filePath).split("/").filter(Boolean);
  if (parts.length === 0) {
    return {
      domain: UNASSIGNED_DOMAIN,
      module: UNASSIGNED_DOMAIN,
      domainSource: "none",
    };
  }

  // Drop filename.
  const dirParts = parts.slice(0, -1);
  let monorepoPrefix: string | null = null;
  let scanParts = dirParts;

  if (
    (dirParts[0] === "apps" || dirParts[0] === "packages" || dirParts[0] === "ee") &&
    dirParts.length >= 2
  ) {
    monorepoPrefix = `${dirParts[0]}/${dirParts[1]}`;
    scanParts = dirParts.slice(2);
  }

  const candidates: string[] = [];
  for (const segment of scanParts) {
    const entry = spread.byKey.get(segment.toLowerCase());
    if (entry && isDomainCandidate(entry)) {
      candidates.push(entry.label);
    }
  }

  if (candidates.length >= 1) {
    return {
      domain: candidates[0]!,
      module: candidates[1] ?? candidates[0]!,
      domainSource: "path",
    };
  }
  if (monorepoPrefix) {
    return {
      domain: monorepoPrefix,
      module: monorepoPrefix,
      domainSource: "path",
    };
  }
  return {
    domain: UNASSIGNED_DOMAIN,
    module: UNASSIGNED_DOMAIN,
    domainSource: "none",
  };
}

export function detectDomain(filePath: string, spread?: SegmentSpreadIndex): string {
  if (!spread) return legacyDetectDomain(filePath);
  return detectDomainAndModule(filePath, spread).domain;
}

export function detectModule(
  filePath: string,
  domain: string,
  spread?: SegmentSpreadIndex,
): string {
  if (!spread) return legacyDetectModule(filePath, domain);
  const detected = detectDomainAndModule(filePath, spread);
  // Keep call-site domain when it already matches; otherwise trust spread module.
  if (detected.domain === domain) return detected.module;
  return detected.module;
}

export function detectLayer(filePath: string): string {
  const normalized = normalizePath(filePath).toLowerCase();

  if (/\.prisma$/.test(normalized) || /\/(prisma|database|db)\//.test(normalized)) {
    return "data";
  }
  if (/\.py$/.test(normalized)) {
    if (/(?:^|\/)(urls|views|viewsets|serializers)\.py$/.test(normalized)) {
      return "presentation";
    }
    if (
      /(?:^|\/)(models|migrations)\//.test(normalized) ||
      /(?:^|\/)models\.py$/.test(normalized)
    ) {
      return "data";
    }
    if (/(?:^|\/)(permissions|auth|middleware)\.py$/.test(normalized)) {
      return "application";
    }
    if (/(?:^|\/)(settings|manage)\.py$/.test(normalized)) return "config";
    if (normalized.includes("/apps/api/") || normalized.includes("/api/")) {
      return "application";
    }
  }

  // Rails / Nest structural folders before the broad Next.js `app/` rule —
  // otherwise `app/models/*` is misclassified as presentation (blocks P0-14).
  if (/\/(models|migrations|repositories|infra|database|db)\//.test(normalized)) {
    return "data";
  }
  if (/\/(controllers|serializers|viewsets|views|pages|screens)\//.test(normalized)) {
    return "presentation";
  }
  if (/\/(services|use-cases|application)\//.test(normalized)) return "application";

  // Next.js App Router + API routes
  if (/(?:^|\/)app\/api\//.test(normalized) || /(?:^|\/)pages\/api\//.test(normalized)) {
    return "presentation";
  }
  if (/(?:^|\/)app\//.test(normalized) || /(?:^|\/)route\.(tsx?|jsx?)$/.test(normalized)) {
    return "presentation";
  }

  if (/\/(routes)\//.test(normalized)) return "presentation";
  if (/\/(components|ui|modules)\//.test(normalized)) return "ui";
  if (/\/(hooks|composables)\//.test(normalized)) return "hooks";
  if (/\/(server)\//.test(normalized)) return "application";
  if (/\/(lib|utils|shared|common|helpers)\//.test(normalized)) return "shared";
  if (/\/(config|types)\//.test(normalized)) return "config";
  return "unknown";
}

export function inferRuntime(filePath: string): string {
  const normalized = normalizePath(filePath).toLowerCase();
  if (/\bsupabase\/functions\//.test(normalized)) return "edge";
  // API routes before generic app/ browser classification
  if (/(?:^|\/)app\/api\//.test(normalized) || /(?:^|\/)pages\/api\//.test(normalized)) {
    return "server";
  }
  if (
    /\.py$/.test(normalized) ||
    /\b(apps\/api|src\/server|src\/api|src\/backend)\//.test(normalized)
  ) {
    return "server";
  }
  if (/\b(src\/supabase|src\/server|src\/api|src\/backend)\//.test(normalized)) return "server";
  if (/(?:^|\/)app\//.test(normalized)) return "browser";
  if (
    /\b(src\/modules|src\/components|src\/pages|src\/app|apps\/web|apps\/meteor)\//.test(normalized)
  ) {
    return "browser";
  }
  return "shared";
}
