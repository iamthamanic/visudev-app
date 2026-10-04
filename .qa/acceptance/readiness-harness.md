# Feature: PR-01 · Establish the five-project Product Readiness harness

<!-- seeded by ecc-runner from issue #375 — refined by implement -->

## Intent

Den bestehenden Real Visual Audit zu einem wiederverwendbaren Fünf-Projekt-Gate ausbauen, damit VisuDev nicht auf ein einzelnes Repo überoptimiert wird.

## Happy Path

- [x] Manifest enthält exakt die fünf vereinbarten Golden-Projekte mit Source-Identity, Capability-Matrix und Runtime-Pflichtstatus.
- [x] GitHub-Projekte werden an echte Commit-SHAs gepinnt; HABA erhält einen eindeutigen lokalen Source-Identity-Contract ohne erfundenen Remote.
- [x] Bestehender hrkoordinator-Audit läuft über denselben Harness.
- [x] Fehlende optionale Runtime-Capability wird UNAVAILABLE, nicht PASS.
- [x] Touched files: zero type escape hatches (typed-strict / Boy Scout).

## Edge Cases

- [x] Missing `VISUDEV_READINESS_HABA_PATH` → UNAVAILABLE (exit 0 when source not required in CI)
- [x] Missing runtime secrets → runtimeExploration UNAVAILABLE

## Regression

- [x] Real Visual Audit workflow still always-on for PRs with enrichment OFF
- [x] `scripts/real-visual-audit.mjs` remains the full-audit delegate for hrkoordinator

## Assumptions

- V1 full certification covers hrkoordinator + sagadrive + scriptony-multihost; HABA/Screenator stay identity-resolve when optional sources are missing.

## Implementation Notes

- Manifest: `.qa/readiness/golden-projects.manifest.json`
- Local identity: `.qa/readiness/local-identities/hv123-mobile-haba.md`
- Harness: `scripts/readiness/*`
- Workflow matrix via `resolve-matrix.mjs` → `run-project-gate.mjs`

## Composition Gate

- TREE_SHA: 93c562ae81dda6dfbe382d01650edb5563256021
- Verdict: SKIPPED
- Reason: CI/scripts/config only
