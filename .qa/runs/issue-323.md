# Issue #323 / order-03 — RVP-7 Dependencies semantic aggregation

## Phase log

- **setup:** resumed `feat/323-dependencies-semantic-aggregation` after #322 MERGED (`029a2610`)
- **implement:** `project-dependencies-semantic.ts` + DependenciesView wire-up + Cytoscape `resolveCytoscapeColor`
- **verify:** unit tests for density, aggregation/weight/types, drill-down, orphans, color resolver
- **acceptance:** `.qa/acceptance/rvp7-dependencies-semantic-aggregation.md`
- **checks:** `npm run checks` (local)

## Notes

- Default projection = BusinessDomain/Service/Component/DataStore with ≤80 nodes
- Aggregate edges: type label(s) + `×weight` + `underlyingEdgeIdsByEdgeId` evidence backlinks
- Drill-down via semantic node select; back control returns to overview
- Orphan color remains token `var(--color-muted-foreground)`; Cytoscape resolves via stylesheet
