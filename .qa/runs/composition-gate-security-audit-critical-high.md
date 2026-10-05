# Composition Gate — security-audit-critical-high (#420)

- HEAD_SHA: `a110e7cde64f8010736a0b6c66993e5d0e43e20f`
- Date: 2026-10-05
- Verdict: CLEAR
- PR: https://github.com/iamthamanic/visudev-app/pull/420

## Event

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

## Skip reason

n/a
