# Issue #342 — SDE-07 Canonical Projection / Query Layer

## Status
ecc-check READY → commit-pr

## Implementation
- shared/scan-detector/domain/projection/*
- shared/scan-detector/application/project-read-models.ts
- src/lib/visudev-api/scan-projection.ts port

## Gates
- vitest projection.test.ts PASS
- npm run checks PASS
- composition-gate SKIPPED
- review ACCEPT
