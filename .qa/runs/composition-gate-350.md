# Composition Gate — sde-15-legacy-retirement

- HEAD_SHA: WORKTREE
- Date: 2026-10-03
- Verdict: CLEAR

## Event

Blueprint / AppFlow / Data analysis resolve: consumer always receives engine-projection (or explicit legacy-fallback). Mode no longer changes render destination (shadow dual-path removed).

## Simulations

- N actors: Local enrich + Cloud cutover + AppFlow/Data adapters → same engine authority
- Invalid fallback: truncated/empty projection → legacy-fallback with reason (destination explicit)
- Concurrent consumers: no queue/outbox; sync resolve only

## Notes

Cloud applies engine graph to `document.graph` when source is engine-projection.
