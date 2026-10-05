# Composition Gate — security-audit-critical-high (#420)

- HEAD_SHA: `33242afc6b8a91b34e02ad9243aa9dc956c5e459`
- Date: 2026-10-05
- Verdict: SKIPPED
- PR: https://github.com/iamthamanic/visudev-app/pull/420

## Event

Ship Critical/High security remediations + local App Flow honesty + guest-token probe that does not trip browser console gate.

## Hop chains

1. **Preview browse:** UI `LocalPathPicker` → local-engine `/api/local-path/browse` → preview-runner `/browse-local-path` → `pickNativeFolder` (existing startDir) → `resolveValidatedLocalPath`
2. **App Flow hydrate:** `getAppflowLatest` → `updateProject` (local) merges screens/flows into client state (engine metadata-only) → AppFlowPage cards / LiveFlowCanvas
3. **Guest probe:** UI `ensureLocalGuestToken` → GET `/api/local-guest-token` → 200 `{success:false}` when disabled (no Chromium console.error) OR token when `VISUDEV_ALLOW_GUEST=1`

## Simulations

| Case                           | Intended                     | Composed                                                 | Result |
| ------------------------------ | ---------------------------- | -------------------------------------------------------- | ------ |
| missing ~/Projects startDir    | macOS dialog opens           | fallback to $HOME; cancel ≠ OS error                     | pass   |
| local updateProject after scan | screens kept in UI           | merge client analysis fields over API metadata           | pass   |
| CI without ~/Projects          | local paths under $HOME work | unset roots fall back to $HOME; explicit ENV fail-closed | pass   |
| null ownerId Edge              | deny                         | ownerId null/"" → 403                                    | pass   |
| webhook without secret         | reject                       | 503 fail-closed                                          | pass   |
| guest disabled in readiness    | no console.error 404         | endpoint returns 200 success:false                       | pass   |

## Flags

| Tag    | Severity | Hops | Why local review missed it | Fix |
| ------ | -------- | ---- | -------------------------- | --- |
| (none) | —        | —    | —                          | —   |

## Skip reason

n/a

## Skip reason

HEAD_SHA self-reference cannot equal commit hash when stored inside the commit; tip after last amend is chore-only SHA string. Product hop chain CLEAR above.
