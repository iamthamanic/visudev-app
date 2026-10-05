# Composition Gate — security-audit-critical-high (#420)

- HEAD_SHA: `4fa2c0986ef07e5f40153aa107e92b0b413dd189`
- Date: 2026-10-05
- Verdict: SKIPPED
- PR: https://github.com/iamthamanic/visudev-app/pull/420

## Skip reason

Tip commits after `af25f8b541bb136a63d033d17c096b6aede42357` are chore-only (`.qa/runs` composition-gate proof / HEAD_SHA alignment). Product hop chain was CLEAR-simulated at that SHA; no new multi-hop composition introduced by proof-file commits. Accept this SKIPPED for tip `4fa2c0986ef07e5f40153aa107e92b0b413dd189` so HEAD_SHA can match without an infinite proof-commit loop.

## Event (CLEAR product scope @ af25f8b5)

Ship Critical/High security remediations + local App Flow honesty (screens survive updateProject; Preview CTA for local paths).

## Hop chains

1. **Preview browse:** UI `LocalPathPicker` → local-engine `/api/local-path/browse` → preview-runner `/browse-local-path` → `pickNativeFolder` (existing startDir) → `resolveValidatedLocalPath`
2. **App Flow hydrate:** `getAppflowLatest` → `updateProject` (local) merges screens/flows into client state (engine metadata-only) → AppFlowPage cards / LiveFlowCanvas
3. **Preview start:** `hasPreviewSource(local)` → `startPreview(localPath)` → runner `/start` (token issued once) → iframe base URL

## Simulations

| Case | Intended | Composed | Result |
|------|----------|----------|--------|
| missing ~/Projects startDir | macOS dialog opens | fallback to $HOME; cancel ≠ OS error | pass |
| local updateProject after scan | screens kept in UI | merge client analysis fields over API metadata | pass |
| CI without ~/Projects | local paths under $HOME work | unset roots fall back to $HOME; explicit ENV fail-closed | pass |
| null ownerId Edge | deny | ownerId null/"" → 403 | pass |
| webhook without secret | reject | 503 fail-closed | pass |

## Flags

| Tag | Severity | Hops | Why local review missed it | Fix |
|-----|----------|------|----------------------------|-----|
| (none) | — | — | — | — |
