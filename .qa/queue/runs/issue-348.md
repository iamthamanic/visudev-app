# Issue #348 — SDE-13 snapshots / cache / incremental

## Status

implement → verify → composition CLEAR → review ACCEPT → ecc-check READY → PR

## Summary

Versioned snapshot keys, ScanCacheStore port, Memory + Local FS adapters, incremental plan, historical read for #327.

## Verification

- vitest snapshot-cache.test.ts PASS
- npm run checks PASS
