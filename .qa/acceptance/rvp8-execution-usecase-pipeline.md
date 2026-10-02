# Acceptance — RVP-8 Execution Use-Case Pipeline (#324)

## Intent

Execution shows evidenced semantic stations (Route → Validation → Auth → Handler → UseCase → Data → External), not raw graph neighborhood chains.

## Happy Path

Given a SoftwareGraph (+ optional SemanticSystemModel) with evidenced relations for a route, Execution projects a deduplicated pipeline of only evidenced stations; durations remain unknown without runtime telemetry.

## Acceptance

- [ ] Every projected step has evidence
- [ ] Order follows evidenced relations (not mere proximity)
- [ ] Repeated auth/file nodes are semantically deduplicated
- [ ] Missing stations omitted (never invented)
- [ ] Durations stay unknown without runtime telemetry
- [ ] Zero type escape hatches

## Verification

- `npx vitest run src/modules/blueprint/components/execution/execution-usecase-pipeline.test.ts`
- `npm run checks`

## Composition Gate

- Verdict: **CLEAR**

## Implementation Notes

- `execution-usecase-pipeline.ts` + wired into `projectExecutionGraph`
