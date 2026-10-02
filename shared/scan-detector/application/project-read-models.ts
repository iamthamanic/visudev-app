/**
 * Canonical Projection / Query layer (SDE-07).
 * Builds view-specific read models from ScanSnapshot facts — no detection.
 * Location: shared/scan-detector/application/project-read-models.ts
 */

import { redactEvidence, redactFact } from "../domain/evidence/redact.js";
import {
  isAppFlowFlowFact,
  isAppFlowScreenFact,
  isAppFlowTransitionFact,
  isBlueprintEntityFact,
  isBlueprintRelationFact,
  isDataRelationFact,
  isDataTableFact,
} from "../domain/projection/selectors.js";
import type {
  AppFlowProjectionReadModel,
  BlueprintProjectionReadModel,
  DataProjectionReadModel,
  ProjectionEntity,
  ProjectionEvidenceLink,
  ProjectionPageMeta,
  ProjectionQueryOptions,
  ProjectionQueryScope,
  ProjectionRelation,
} from "../domain/projection/types.js";
import { PROJECTION_DEFAULT_LIMIT, PROJECTION_HARD_MAX_LIMIT } from "../domain/projection/types.js";
import type { ScanEvidence, ScanFact, ScanSnapshot } from "../types.js";

export interface ProjectReadModelInput {
  snapshot: ScanSnapshot;
  scope: ProjectionQueryScope;
  options?: ProjectionQueryOptions;
}

function normalizeLimit(limit: number | undefined): { limit: number; truncatedByCap: boolean } {
  const requested =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : PROJECTION_DEFAULT_LIMIT;
  if (requested > PROJECTION_HARD_MAX_LIMIT) {
    return { limit: PROJECTION_HARD_MAX_LIMIT, truncatedByCap: true };
  }
  return { limit: requested, truncatedByCap: false };
}

function normalizeOffset(offset: number | undefined): number {
  if (typeof offset !== "number" || !Number.isFinite(offset) || offset < 0) return 0;
  return Math.floor(offset);
}

function buildPageMeta(input: {
  total: number;
  returned: number;
  limit: number;
  offset: number;
  truncatedByCap: boolean;
}): ProjectionPageMeta {
  const { total, returned, limit, offset, truncatedByCap } = input;
  return {
    total,
    returned,
    limit,
    offset,
    hasMore: offset + returned < total,
    truncated: truncatedByCap || offset + returned < total,
  };
}

function passesStatusFilters(fact: ScanFact, options: ProjectionQueryOptions | undefined): boolean {
  const includeUnknown = options?.includeUnknown !== false;
  const includeConflicted = options?.includeConflicted !== false;
  if (!includeUnknown && fact.status === "unknown") return false;
  if (!includeConflicted && fact.status === "conflicted") return false;
  return true;
}

function passesScope(fact: ScanFact, scope: ProjectionQueryScope, projectId: string): boolean {
  if (scope.projectId !== projectId) return false;

  if (scope.applicationId) {
    const attrApp = fact.attributes?.applicationId;
    const matchesAttr = typeof attrApp === "string" && attrApp === scope.applicationId;
    const matchesSubject =
      fact.subjectId === scope.applicationId ||
      fact.subjectId.startsWith(`${scope.applicationId}/`) ||
      fact.subjectId.startsWith(`${scope.applicationId}:`);
    if (!matchesAttr && !matchesSubject) return false;
  }

  if (scope.subjectIdPrefix) {
    if (!fact.subjectId.startsWith(scope.subjectIdPrefix)) return false;
  }

  return true;
}

function evidenceIndex(evidence: readonly ScanEvidence[]): Map<string, ScanEvidence> {
  const map = new Map<string, ScanEvidence>();
  for (const item of evidence) {
    map.set(item.id, redactEvidence(item));
  }
  return map;
}

function toEvidenceLinks(
  fact: ScanFact,
  byId: Map<string, ScanEvidence>,
): ProjectionEvidenceLink[] {
  const links: ProjectionEvidenceLink[] = [];
  for (const evidenceId of fact.evidenceIds) {
    const item = byId.get(evidenceId);
    if (!item) {
      links.push({
        evidenceId,
        kind: "missing",
        status: "unknown",
        confidence: 0,
      });
      continue;
    }
    links.push({
      evidenceId: item.id,
      kind: item.kind,
      status: item.status,
      confidence: item.confidence,
      summary: item.payload.summary,
      filePath: item.payload.filePath,
      line: item.payload.line,
    });
  }
  return links;
}

function labelOf(fact: ScanFact): string {
  const label = fact.attributes?.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  const name = fact.attributes?.name;
  if (typeof name === "string" && name.trim()) return name.trim();
  return fact.subjectId;
}

function safeAttributes(
  fact: ScanFact,
): Record<string, string | number | boolean | null> | undefined {
  const redacted = redactFact(fact).attributes;
  if (!redacted) return undefined;
  // Drop engine-private keys that must not cross the projection boundary.
  const next: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(redacted)) {
    if (key.startsWith("_") || key.startsWith("engine:")) continue;
    next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function toEntity(fact: ScanFact, byId: Map<string, ScanEvidence>): ProjectionEntity {
  return {
    id: fact.id,
    kind: fact.kind,
    label: labelOf(fact),
    status: fact.status,
    confidence: fact.confidence,
    subjectId: fact.subjectId,
    factIds: [fact.id],
    evidence: toEvidenceLinks(fact, byId),
    attributes: safeAttributes(fact),
  };
}

function toRelation(fact: ScanFact, byId: Map<string, ScanEvidence>): ProjectionRelation | null {
  if (!fact.objectId) return null;
  return {
    id: fact.id,
    kind: fact.kind,
    sourceId: fact.subjectId,
    targetId: fact.objectId,
    status: fact.status,
    confidence: fact.confidence,
    factIds: [fact.id],
    evidence: toEvidenceLinks(fact, byId),
  };
}

function filterFacts(
  facts: readonly ScanFact[],
  predicate: (fact: ScanFact) => boolean,
  scope: ProjectionQueryScope,
  projectId: string,
  options: ProjectionQueryOptions | undefined,
): ScanFact[] {
  return facts.filter(
    (fact) =>
      predicate(fact) && passesScope(fact, scope, projectId) && passesStatusFilters(fact, options),
  );
}

function paginateEntities(
  entities: ProjectionEntity[],
  options: ProjectionQueryOptions | undefined,
): { items: ProjectionEntity[]; page: ProjectionPageMeta } {
  const { limit, truncatedByCap } = normalizeLimit(options?.limit);
  const offset = normalizeOffset(options?.offset);
  const items = entities.slice(offset, offset + limit);
  return {
    items,
    page: buildPageMeta({
      total: entities.length,
      returned: items.length,
      limit,
      offset,
      truncatedByCap,
    }),
  };
}

function assertScopeProject(snapshot: ScanSnapshot, scope: ProjectionQueryScope): void {
  if (scope.projectId !== snapshot.projectId) {
    throw new Error(
      `Projection scope projectId "${scope.projectId}" does not match snapshot "${snapshot.projectId}"`,
    );
  }
}

/** Project Blueprint read model from a ScanSnapshot (no detection). */
export function projectBlueprintReadModel(
  input: ProjectReadModelInput,
): BlueprintProjectionReadModel {
  const { snapshot, scope, options } = input;
  assertScopeProject(snapshot, scope);
  const byId = evidenceIndex(snapshot.evidence);
  const entityFacts = filterFacts(
    snapshot.facts,
    isBlueprintEntityFact,
    scope,
    snapshot.projectId,
    options,
  );
  const relationFacts = filterFacts(
    snapshot.facts,
    isBlueprintRelationFact,
    scope,
    snapshot.projectId,
    options,
  );

  const allEntities = entityFacts.map((fact) => toEntity(fact, byId));
  const { items: entities, page } = paginateEntities(allEntities, options);

  const entitySubjects = new Set(entities.map((entity) => entity.subjectId));
  const relations = relationFacts
    .map((fact) => toRelation(fact, byId))
    .filter((relation): relation is ProjectionRelation => relation !== null)
    .filter(
      (relation) =>
        // Progressive disclosure: only include edges touching returned entities
        // when the entity page is a partial window; otherwise keep all scoped edges.
        page.total <= page.limit ||
        entitySubjects.has(relation.sourceId) ||
        entitySubjects.has(relation.targetId),
    );

  return {
    version: 1,
    slice: "blueprint",
    projectId: snapshot.projectId,
    analyzedAt: snapshot.analyzedAt,
    scope: { ...scope },
    page,
    entities,
    relations,
  };
}

/** Project AppFlow read model from a ScanSnapshot (no detection). */
export function projectAppFlowReadModel(input: ProjectReadModelInput): AppFlowProjectionReadModel {
  const { snapshot, scope, options } = input;
  assertScopeProject(snapshot, scope);
  const byId = evidenceIndex(snapshot.evidence);

  const screens = filterFacts(
    snapshot.facts,
    isAppFlowScreenFact,
    scope,
    snapshot.projectId,
    options,
  ).map((fact) => toEntity(fact, byId));
  const flows = filterFacts(
    snapshot.facts,
    isAppFlowFlowFact,
    scope,
    snapshot.projectId,
    options,
  ).map((fact) => toEntity(fact, byId));

  // Paginate over combined primary entities (screens first, then flows).
  const combined = [...screens, ...flows];
  const { items, page } = paginateEntities(combined, options);
  const screenIds = new Set(screens.map((item) => item.id));
  const pagedScreens = items.filter((item) => screenIds.has(item.id));
  const pagedFlows = items.filter((item) => !screenIds.has(item.id));
  const visibleSubjects = new Set(items.map((item) => item.subjectId));

  const transitions = filterFacts(
    snapshot.facts,
    isAppFlowTransitionFact,
    scope,
    snapshot.projectId,
    options,
  )
    .map((fact) => toRelation(fact, byId))
    .filter((relation): relation is ProjectionRelation => relation !== null)
    .filter(
      (relation) =>
        page.total <= page.limit ||
        visibleSubjects.has(relation.sourceId) ||
        visibleSubjects.has(relation.targetId),
    );

  return {
    version: 1,
    slice: "appflow",
    projectId: snapshot.projectId,
    analyzedAt: snapshot.analyzedAt,
    scope: { ...scope },
    page,
    screens: pagedScreens,
    flows: pagedFlows,
    transitions,
  };
}

/** Project Data read model from a ScanSnapshot (no detection). */
export function projectDataReadModel(input: ProjectReadModelInput): DataProjectionReadModel {
  const { snapshot, scope, options } = input;
  assertScopeProject(snapshot, scope);
  const byId = evidenceIndex(snapshot.evidence);

  const tablesAll = filterFacts(
    snapshot.facts,
    isDataTableFact,
    scope,
    snapshot.projectId,
    options,
  ).map((fact) => toEntity(fact, byId));
  const { items: tables, page } = paginateEntities(tablesAll, options);
  const tableSubjects = new Set(tables.map((table) => table.subjectId));

  const relations = filterFacts(
    snapshot.facts,
    isDataRelationFact,
    scope,
    snapshot.projectId,
    options,
  )
    .map((fact) => toRelation(fact, byId))
    .filter((relation): relation is ProjectionRelation => relation !== null)
    .filter(
      (relation) =>
        page.total <= page.limit ||
        tableSubjects.has(relation.sourceId) ||
        tableSubjects.has(relation.targetId),
    );

  return {
    version: 1,
    slice: "data",
    projectId: snapshot.projectId,
    analyzedAt: snapshot.analyzedAt,
    scope: { ...scope },
    page,
    tables,
    relations,
  };
}
