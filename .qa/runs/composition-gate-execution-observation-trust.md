# Composition Gate — execution-observation-trust (issue 383)

- HEAD_SHA: pending-commit
- Date: 2026-10-04
- Verdict: CLEAR

## Event

User opens Execution route → step projection → ObservationClass + measured timings → UI.

## Hops

1. projectExecutionGraph selects step nodes
2. resolveExecutionObservationClass per node
3. computeStepTimings (measured only)
4. StepCard / Timeline / MetricsBar render honest labels

## Simulations

| Case            | Expected                   | Observed |
| --------------- | -------------------------- | -------- |
| Static only     | STATIC_MODEL, timings null | PASS     |
| runtimeObserved | OBSERVED_TRACE             | PASS     |
| conflict flag   | CONFLICTED                 | PASS     |
| no durationMs   | totalDurationMs null       | PASS     |

## Findings

None open.
