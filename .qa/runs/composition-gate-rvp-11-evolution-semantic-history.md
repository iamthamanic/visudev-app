# Composition Gate — rvp-11-evolution-semantic-history

- HEAD_SHA: f3f16e28572ce136b4d47fde1595e2fb04479860
- Date: 2026-10-03
- Verdict: CLEAR

## Event

Historical engine ScanSnapshots (#348) become SemanticHistorySnapshots; Evolution diffs entity/relation signatures and renders metrics from snapshot data only.

## Hop chain

HistoricalSnapshotRecord / SoftwareGraph capture → semantic-history signatures → diffSemanticHistory / diffSnapshots → EvolutionMetricsRow / EvolutionChangesGrid → UI labels (Neu/Geändert/Entfernt)

## Simulations

| Case                | Intended                                                    | Composed                                | Result |
| ------------------- | ----------------------------------------------------------- | --------------------------------------- | ------ |
| 1 event, N actors   | One compare → one diff                                      | Pure functions; no fan-out              | pass   |
| invalid / missing   | <2 snapshots → honest empty, zeros for architecture metrics | hasSemanticHistoryCompare gates metrics | pass   |
| 2 consumers / crash | Two UI mounts same graph → same counts                      | Deterministic signature maps            | pass   |

## Flags

_(none)_

## Skip reason

n/a
