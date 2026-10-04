# Composition Gate — dependencies-primary-topology (issue 382)

- HEAD_SHA: 3c29382d46372b7504713e6790aa7493879ff3e6
- Date: 2026-10-04
- Verdict: CLEAR

## Event

User opens Dependencies / toggles Security overlay → kind filter → semantic projection → inspector evidence.

## Hops

1. DEFAULT_VISIBLE_DEPENDENCY_KINDS (primary) + mergeVisibleKindsWithOverlays
2. projectDependenciesSemanticGraph filters/aggregates with full evidence ids
3. DependenciesInspector / edge inspector reads underlyingEdgeIdsByEdgeId

## Simulations

| Case                 | Expected                             | Observed    |
| -------------------- | ------------------------------------ | ----------- |
| Default + auth flood | Primary edges only                   | PASS (unit) |
| Security overlay on  | Auth+validation union primary        | PASS (unit) |
| Density cap          | Evidence ids preserved on kept edges | PASS (unit) |

## Cardinality / identity

- Overlays add kinds; never invent nodes or drop evidence for visible aggregates.

## Findings

None open.
