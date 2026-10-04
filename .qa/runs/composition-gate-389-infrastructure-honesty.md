# Composition gate — #389 infrastructure-honesty

**HEAD_SHA:** WORKTREE
**Verdict:** CLEAR

## Path

UI-only honesty: Blueprint graph → Infrastructure projection → View/Inspector.
No producer→consumer side effects, no outbox/webhooks.

## Simulations

| Case                            | Result                                  |
| ------------------------------- | --------------------------------------- |
| Empty infra after complete scan | coverage empty with detection label     |
| Partial telemetry metadata      | only finite meters rendered             |
| Legend without matching edges   | legend omitted                          |
| Refresh control                 | remount only; hint says no live refresh |

Single-hop UI composition — CLEAR.
