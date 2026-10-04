# Feature: AppFlow exploration coverage

<!-- auto-generated — issue 387 / PR-13 -->

## Intent

COMPLETE only when terminationReason is frontier-exhausted; otherwise PARTIAL with machine-readable reason. Distinguish static/runtime-verified/conflicted screens.

## Happy Path

- [x] COMPLETE only on frontier-exhausted
- [x] PARTIAL for budget/timeout/auth/safety
- [x] Coverage report includes frontier/barrier/verification counts
- [x] Toolbar shows COMPLETE/PARTIAL

## Implementation Notes

- appflow-coverage.ts + FlowAnalysisSummary.coverage + CanvasToolbar pill

## Composition Gate

CLEAR — runtime summary → coverage report → toolbar.

## Security Coverage

- No session secrets in coverage
