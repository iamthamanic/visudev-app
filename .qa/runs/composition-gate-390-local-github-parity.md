# Composition gate — #390 local-github-parity

**HEAD_SHA:** WORKTREE
**Verdict:** CLEAR

## Path

Shared cutover compare only — no outbox/webhook/side-effect hops.
Local fingerprint ↔ Cloud fingerprint under `static-blueprint` intersection;
capability deltas are informational.

## Simulations

| Case                          | Result                       |
| ----------------------------- | ---------------------------- |
| Same graph both hosts         | semantic pass                |
| Divergent table nodes         | semantic fail                |
| Local-only runtime capability | hostSpecific delta, not fail |

CLEAR.
