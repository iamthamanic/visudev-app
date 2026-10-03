# Acceptance — SDE-13 Versionierte Snapshots, Cache, inkrementelle Analyse (#348)

## Intent

Scan-Ergebnisse werden nach Repo/Application-Scope, Commit/Ref/Dirty-Fingerprint und Engine-/Model-/Detector-Versionen versioniert. Unveränderte Detector-Inputs liefern Cache-Hits; Änderungen invalidieren nur betroffene Teilanalysen. #327 konsumiert historische Engine-Snapshots über einen stabilen Read-Contract.

## Preconditions

- #340, #341, #344, #345, #347 MERGED on `main`
- Canonical `ScanSnapshot` + `ScanVersionManifest` exist (SDE-02)
- Orchestrator + detector registry exist (SDE-03)

## Happy Path

1. Caller baut Snapshot-Key aus Scope + Ref/Commit + Dirty-Fingerprint + Versionsmanifest
2. Cache-Store liefert Hit wenn Key + Versions kompatibel und Detector-Input-Fingerprints unverändert
3. Bei partiellen Dateiänderungen: nur abhängige Detectoren rerun; Rest aus Cache
4. Historical Read liefert ≥2 Snapshots (verschiedene Commits) project-scoped
5. Inkompatible Engine/Model/Detector-Versionen → kein stiller Cache-Hit

## Edge Cases

- Dirty working tree → eigener Dirty-Fingerprint; kein Clean-Commit-Hit
- Detector-/Model-Version-Bump → invalidiert betroffene Cache-Einträge
- Rename/move/deleted files → Input-Fingerprint ändert sich → Miss
- Partial scan → `repo.partial` im Snapshot; Key bleibt scope-korrekt
- Corrupted / unreadable cache entry → treat as miss (kein throw an Caller)

## Acceptance

- [ ] Snapshot-Key enthält Repo/Application Scope, ref/commit/dirty fingerprint und Engine/Model/Detector-Versionen
- [ ] Unveränderte Inputs können cache-hit liefern; betroffene Änderungen invalidieren deterministisch
- [ ] Inkompatible Snapshot-Versionen werden nicht still wiederverwendet
- [ ] #327 kann mindestens zwei historische Engine-Snapshots über einen stabilen Read-Contract konsumieren
- [ ] Touched files: zero type escape hatches (typed-strict / Boy Scout)

## Out of Scope

- Evolution-UI (#327)
- Remote/distributed cache

## Security Coverage

| Item                        | Status                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| F-03 XSS                    | N/A — no UI                                                        |
| B-01 AuthZ                  | Project-scoped list/get; no cross-project key reuse                |
| B-04 Secrets in logs        | Cache entries use `redactFactsAndEvidence` before put              |
| B-07 Injection              | Keys are structured strings; FS adapter rejects `..` path segments |
| B-08 Sensitive data at rest | No raw DB samples/secrets in cached snapshots                      |
| B-09 IDOR                   | Historical read filters by `projectId`                             |
| P-04 Credential leakage     | Redaction on put; no tokens in fingerprints                        |

## Verification

- `npx vitest run shared/scan-detector/snapshot-cache.test.ts` — PASS
- `npm run checks` — PASS

## Composition Gate

CLEAR — `.qa/runs/composition-gate-sde-13-snapshots-incremental.md` (WORKTREE; refresh SHA after commit)

## Security Coverage (verify)

- Cache put redacts secrets; historical read project-scoped; no credential surfaces

## Implementation Notes

- `shared/scan-detector/domain/snapshot/*` — key, compatibility, invalidation
- `shared/scan-detector/domain/cache/cache-store.ts` — port
- `MemoryScanCacheStore` + `runWithCache` + `readHistoricalSnapshots` (shared)
- `LocalFsScanCacheStore` in `local-engine/src/scan-detector/` for Local persistence
- Cache `put` always redacts facts/evidence; historical read is project-scoped
- Tests: `shared/scan-detector/snapshot-cache.test.ts`
