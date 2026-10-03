# Issue #328 — RVP-12 real-repo golden audit CI gate

implement → verify PASS → composition SKIPPED → review ACCEPT → ecc-check READY → PR

## Diff scope

- Always-on Real Visual Audit workflow (enrichment OFF)
- `real-visual-audit-semantics.mjs` + unit tests
- Audit waits for SCAN ABGESCHLOSSEN + semantic gate
- `dev-local` default OFF; `npm run dev:demo`; README

## Gates

- test-gate / `npm run checks`: PASS
- composition-gate: SKIPPED (CI/scripts, no multi-hop event)
- review: ACCEPT
- ecc-check: READY
- UI verify: N/A (no UI paths)
