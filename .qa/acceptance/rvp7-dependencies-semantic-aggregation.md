# Acceptance — RVP-7 Dependencies Semantic Aggregation (#323)

## Intent

Default Dependencies view projects BusinessDomains/Services/Components with aggregated, weighted edges and progressive drill-down to file level — no 1000+ node walls; Cytoscape never receives unresolved `var(--…)` colors.

## Preconditions

- RVP-1…RVP-4 / SemanticSystemModel available (`buildSemanticSystemModel`)
- #322 (RVP-6) merged on `main`

## Acceptance Criteria

### AC-1 — Density-capped semantic default

- Given a SoftwareGraph with hundreds of file/service nodes
- When `projectDependenciesSemanticGraph(..., { level: "semantic" })` runs
- Then node count ≤ `DEPENDENCIES_SEMANTIC_MAX_NODES` (80) and default view is not a 1000+ node wall

### AC-2 — Aggregated edges with weight, types, evidence backlinks

- Given multiple dependency edges between members of two semantic entities
- When semantic overview is projected
- Then the aggregate edge label includes type(s) and weight (`×N`)
- And `underlyingEdgeIdsByEdgeId` maps the aggregate edge id to underlying SoftwareGraph edge ids

### AC-3 — Progressive disclosure / file drill-down

- Given a semantic entity selected in the overview
- When level is `files` with `focusSemanticEntityId`
- Then projection shows member graph nodes for that entity (not the full repo wall)

### AC-4 — Orphans counted separately

- Given semantic entities with no visible inter-entity dependency edges
- When overview is projected
- Then those entity ids appear in `orphanNodeIds` and can be toggled via existing orphan filter

### AC-5 — Cytoscape color safety

- Given node `color: "var(--color-muted-foreground)"` (or any `var(--token)`)
- When `resolveCytoscapeColor` runs without a resolved CSS value
- Then it returns `undefined` (never passes raw `var(--…)` into Cytoscape paint)

## Non-goals

- No new AST / framework / source inference in the view
- No second analysis engine; reuse SemanticSystemModel + SoftwareGraph only

## Verification

- Unit: `project-dependencies-semantic.test.ts`, `_projection.test.ts`, `resolveCytoscapeColor`
- `npm run checks`
- Manual: Dependencies view default is readable; drill-down + back; browser console without Cytoscape color warnings
