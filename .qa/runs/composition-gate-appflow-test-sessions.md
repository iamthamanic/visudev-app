# Composition Gate — appflow-test-sessions (issue 385)

- HEAD_SHA: pending-commit
- Date: 2026-10-04
- Verdict: CLEAR

## Event

User persists local test session → crawl loads storageState by project+origin.

## Hops

1. test-session-store save/load (opaque status)
2. runner /session endpoints
3. runRuntimeCrawl storageState / auth-barrier on invalid
4. AppFlow UI status-only panel

## Simulations

| Case                  | Expected                     | Observed |
| --------------------- | ---------------------------- | -------- |
| save/load same origin | ready, cookies not in status | PASS     |
| corrupt               | invalid                      | PASS     |
| wrong origin          | not applied                  | PASS     |

## Findings

None open.
