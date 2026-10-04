# Feature: V1 readiness certification (PR-18)

<!-- seeded for v1-readiness-certification / PR-18 -->

## Intent

V1 is defined by reproducible product quality on the five golden projects — gated by an aggregate certification report, not by closed tickets.

## Happy Path

- [ ] Manifest lists five golden projects; ≥3 run `gate.mode: full` with `rvp12-shared` assertions
- [ ] Full project gates write `readiness-project-report.json` with hardGates (console-clean, semantics, no silent truth truncation)
- [ ] Resolve/identity projects (HABA, Screenator) report UNAVAILABLE when sources missing — never fake PASS
- [ ] `aggregate-certification.mjs` fails CI unless all full projects PASS and identity matrix is complete
- [ ] Workflow job `v1-certification` downloads matrix artifacts and enforces the aggregate gate
- [ ] Touched files: zero type escape hatches

## Verify

```bash
cd Visudevfigma
npm test -- --run scripts/checks/readiness-harness.test.ts scripts/checks/ci-config.test.ts
node --check scripts/readiness/aggregate-certification.mjs
node --check scripts/readiness/assert-epistemic-artifacts.mjs
```
