# Acceptance — SDE-11 AppFlow UIInteractionGraph cutover (#346)

## Intent

AppFlow consumes UIInteractionGraph projection in engine mode. Legacy Screen/state detection remains fallback until parity gates pass. Navigate/open/close/switch/menu transitions must not be lost.

## Acceptance

- [x] Engine mode renders AppFlow from UIInteractionGraph projection and keeps navigate/open/close/switch/menu transitions
- [x] Legacy-vs-engine golden cases show no loss of evidenced screens/states/transitions
- [x] AppFlow adds no new framework/AST inference
- [x] Partial/conflicted evidence shows status (not false verification)
- [x] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/appflow-cutover.test.ts`
- `npm run checks` — PASS

## Composition Gate

CLEAR — `.qa/runs/composition-gate-sde-11-appflow-cutover.md`

## Security Coverage

- Runtime screenshots/labels: status badges only; no new secret persistence
- Crawl actions remain SDE-09 policy-gated (no new click automation)
- F-03/B-01/B-04/B-07/B-08/B-09/P-04: N/A — projection/cutover only

## Implementation Notes

- Mode: `VISUDEV_APPFLOW_ANALYSIS_MODE` / `VITE_VISUDEV_APPFLOW_ANALYSIS_MODE` (default shadow)
- `resolveAppflowAnalysis` + `projectUiGraphToAppflow`
- LiveFlowCanvas / FlowGraphView consume resolve wrapper; conflicted surfaces badge as Konflikt
