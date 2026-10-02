# Acceptance — SDE-07 Canonical Projection / Query Layer (#342)

## Intent

Product slices must not consume engine internals or raw detectors. A stable Projection/Query layer delivers view-specific, evidence-preserving read models for Blueprint, AppFlow, and Data.

## Goal

New and existing visualizations can read from canonical models without embedding analysis or framework heuristics.

## Non-Goals

- No view redesign
- No new source detection

## Preconditions

- #341 (SDE-06 static detector) is merged into `main`
- `ScanSnapshot` + Fact/Evidence contracts exist under `shared/scan-detector/`

## Happy Path

1. Given a `ScanSnapshot` (and optional pre-built model hints that are already facts),
2. When a product slice queries Blueprint / AppFlow / Data via the projection API,
3. Then it receives a typed read model with evidence backlinks, confidence/status, and page metadata — without importing detector or orchestrator internals.

## Edge Cases

- Empty / partial snapshots → empty collections + honest page meta
- Large graphs → `limit` / `offset` / `hasMore` / `truncated`
- `unknown` / `conflicted` preserved (filterable, never rewritten)
- Project / application scope filters respect boundaries
- Redacted evidence payloads are not re-exposed

## Acceptance

- [ ] Blueprint / AppFlow / Data each have a typed read-model contract without importing engine internals
- [ ] Projection preserves evidence backlinks and confidence/status
- [ ] Projection performs no source/framework inference
- [ ] Large result sets support defined limits / progressive-disclosure metadata
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Security Coverage

- Evidence summaries exposed in read models go through redaction helpers (no secret re-exposure)
- Query scope requires matching `projectId`; optional `applicationId` / subject prefix bounds monorepo leakage
- Out of scope: auth endpoints, UGC storage, payment (no new HTTP surface)

## Verification

- `npx vitest run shared/scan-detector/projection.test.ts`
- `npm run checks`

## Composition Gate

- HEAD_SHA: WORKTREE (see `.qa/runs/composition-gate-sde-07-projection-query-layer.md`)
- Verdict: **SKIPPED** — single-hop pure projection; no producer→consumer side-effect path

## Implementation Notes

- Added `shared/scan-detector/domain/projection/{types,selectors}.ts` + `application/project-read-models.ts`
- Public exports via `shared/scan-detector/index.ts`; product port `src/lib/visudev-api/scan-projection.ts`
- Selectors match only documented kind prefixes — no framework/source inference
- Evidence links use redacted payloads; engine-private attribute keys stripped
- Pagination: default 200 / hard max 2000 with `hasMore` + `truncated`
