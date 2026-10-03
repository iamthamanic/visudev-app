# Acceptance — RVP-12 Real-Repo Golden Audit CI Gate (#328)

## Intent

Durable CI gate: real project (hrkoordinator) analyzed with both demo-enrichment flags OFF; seven Blueprint views + Engine cutover semantics asserted; artifacts uploaded. Local `dev-local` no longer enables demo enrichment by default.

## Acceptance

- [x] CI-Job with Enrichment OFF exists and is separated from Demo-E2E
- [x] All seven views checked after scan completed; screenshots + summary artifacts
- [x] Semantic assertions (domains, atlas, deps bound, infra, execution evidence, cross-view, evolution)
- [x] Engine cutover extras: enrichment OFF, capability/parity metadata when present
- [x] `scripts/dev-local.js` does not enable demo enrichment by default
- [x] Explicit demo start path documented
- [x] Touched files: zero type escape hatches

## Security Coverage

- No secrets in artifacts; public pinned target commit only
- Symlink/containment rules unchanged via Preview Runner

## Verification

- `npx vitest run scripts/checks/ci-config.test.ts scripts/checks/real-visual-audit-semantics.test.ts` — PASS
- `npm run checks` — PASS
- CI: Real Project Gate green + artifact upload (babysit)

## Implementation Notes

- Always-on `.github/workflows/real-visual-audit.yml` (no label gate); enrichment env forced false
- Pure gate in `scripts/real-visual-audit-semantics.mjs`; audit script waits for SCAN ABGESCHLOSSEN
- Local: `npm run dev` / `dev:local` enrichment OFF; `npm run dev:demo` for demo seed path

## Composition Gate

- HEAD_SHA: WORKTREE (pre-commit #328)
- Verdict: SKIPPED
- Reason: CI/scripts config only; no multi-hop producer→consumer business event path
