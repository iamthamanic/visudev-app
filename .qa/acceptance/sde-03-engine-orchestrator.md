# Acceptance — SDE-03 Orchestrator + Registry (#338)

## Intent

Runtime-neutral orchestrator selects detectors via capability registry/priorities, isolates failures, and emits a versioned ScanSnapshot. Local Engine only implements ports.

## Acceptance

- [ ] Registry selects by declared capabilities + priority (stable id tie-break)
- [ ] Orchestrator returns per-detector success/partial/failed without aborting siblings
- [ ] Same inputs → deterministic detector order / result ids
- [ ] `shared/scan-detector/**` stays runtime-neutral; Local Engine hosts `runDetectorIsolated`
- [ ] Zero type escape hatches

## Verification

- `npx vitest run shared/scan-detector/orchestrator.test.ts shared/scan-detector/contracts.test.ts`
- `npm run checks`
