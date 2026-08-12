# Issue 262 — P0-11 Echter Commit-SHA

## Umsetzung

- Der Preview Runner liest für lokale Blueprint-Analysen den echten kurzen
  HEAD-Commit, den aktuellen Branch und `git status --porcelain`. Ohne
  vollständige Git-Herkunft entfernt er `commitSha` und `branch`.
- Der Local Engine verwendet den bestehenden `readGitSummary`-Reader und
  persistiert `AnalysisOrigin` mit `sourceKind`, `commitSha`, `branch`, `dirty`
  und millisekundengenauem `capturedAt`.
- Lokale Appflow- und Blueprint-Enrichment-Pfade erzeugen keine
  pfadabhängigen beziehungsweise `"local"`-Commit-Platzhalter mehr.
- Snapshot-IDs folgen
  `snapshot:${commitSha ?? "local"}:${capturedAt}`; die bestehende
  Deduplizierung und das Limit von 20 Snapshots bleiben unverändert.
- Die Evolution-Ansicht zeigt die vier deutschen Herkunftsvarianten, erklärt
  ungespeicherte Änderungen und weist bei genau einem Snapshot auf den
  erforderlichen zweiten Scan hin.
- `EvolutionView.tsx`, `evolution-tabs.ts` und die toten Bedienelemente aus P0-3
  wurden nicht verändert.

## Automatisierte Checks

```text
npm run test:run -- _snapshots
1 Datei, 7 Tests bestanden

npm run test:run -- preview-runner/lib/blueprint-local.test.js
1 Datei, 12 Tests bestanden

npm run test:run -- src/modules/blueprint/components/EvolutionView.test.tsx
1 Datei, 4 Tests bestanden

npm run test:run
74 Dateien, 350 Tests bestanden

npm run typecheck
exit 0

npm run lint
exit 0

npm run golden-set
golden-set: OK (nodes=18 edges=23 routes=9 tables=2 files=13 duplicateNodeIds=0)

npm run rules:check
exit 0

npm run build
exit 0

npm run build:engine
exit 0
```

Der gezielte Prettier-Check aller P0-11-Dateien besteht. `npm run checks`
stoppt ausschließlich im repository-weiten Format-Check an zwei bereits vor
diesem Ticket vorhandenen, fremden Working-Tree-Dateien:
`.qa/intake/visudev-phase0-honesty-issues.md` und `.qa/queue/state.json`. Diese
Änderungen wurden nicht angefasst.

## Reale Git-Herkunft

Der lokale browo-hr-Checkout wurde direkt analysiert:

```text
Analyzer: commitSha=d493b4e6
Git:      rev-parse --short HEAD=d493b4e6

Analyzer: branch=feature/authentik-oidc-e5
Git:      branch --show-current=feature/authentik-oidc-e5

sourceKind=git
dirty=true
capturedAt=2026-08-12T08:48:38.977Z
```

Der automatisierte Nicht-Git-Test bestätigt `commitSha === undefined`,
`branch === undefined`, `sourceKind === "filesystem"` und `dirty === false`.

## Scope- und Regressionsnachweise

- `localCommitSha` hat in `preview-runner/`, `local-engine/` und `shared/` keine
  Treffer mehr.
- `branch: "local"` hat im Preview Runner keine Treffer mehr.
- `git-summary.ts`, `MAX_SNAPSHOTS`, `mergeGraphSnapshots`,
  `shared/demo-graph-seed.ts`, `EvolutionView.tsx` und `evolution-tabs.ts`
  blieben unverändert.
- Die berührten TypeScript-Dateien enthalten keine Type-System-Escape-Hatches.

## Offene manuelle Evidenz

- Browser-Screenshots für einen und zwei Snapshots sowie die vier
  Herkunftsvarianten wurden in diesem Implementierungslauf nicht aufgenommen.
- Ein Commit wurde auf ausdrücklichen Auftrag nicht erstellt.
