# Issue 260 — P0-5 CI Golden Set

## Golden-Set-Baseline

`node scripts/golden-set/run.mjs --report`

```text
golden-set: report (nodes=14 edges=21 routes=7 tables=2 files=10)
```

`npm run golden-set`

```text
golden-set: OK (nodes=14 edges=21 routes=7 tables=2 files=10)
```

Die Untergrenzen sind jeweils `floor(measured * 0.9)`: nodes 12, edges 18,
routes 6, tables 1, files 9.

## FILE_LIMIT-Regressionsnachweis

Der vertraglich geforderte Versuch mit `FILE_LIMIT = 10` wurde exakt
ausgeführt:

```text
> visudev@0.1.0 golden-set
> node scripts/golden-set/run.mjs

golden-set: OK (nodes=14 edges=21 routes=7 tables=2 files=10)
```

Der Lauf kann mit der exakt vorgegebenen Fixture-Struktur nicht fehlschlagen:
Sie enthält genau zehn vom Analyzer unterstützte Dateien (acht TypeScript-
Dateien, `schema.prisma` und `docker-compose.yml`). `package.json` und
`expected-metrics.json` sind keine unterstützten Analyzer-Eingaben. Zusätzlich
ist die files-Untergrenze bei zehn gemessenen Dateien gemäß 90%-Regel neun.

Als Kontrollnachweis wurde `FILE_LIMIT = 8` temporär gesetzt. Dann greift das
Golden-Set erwartungsgemäß:

```text
golden-set: nodes 5 < min 12
golden-set: edges 7 < min 18
golden-set: routes 3 < min 6
golden-set: files 8 < min 9
```

Beide temporären Änderungen wurden zurückgenommen.
`git diff --exit-code -- preview-runner/lib/blueprint-local.js` endet mit
Exit-Code 0.

## E2E-Bestandsaufnahme

Erster vollständiger Lauf: 45 bestanden, 3 fehlgeschlagen, 2 übersprungen.

- `wave2-evolution-viz.spec.ts`: repariert — veralteten Test-Selektor
  `evolution-commit-dot` auf den aktuellen Commit-Control-Vertrag
  `evolution-timeline-commit` aktualisiert.
- `wave3-evolution-git-timeline.spec.ts`: repariert — derselbe veraltete
  Commit-Selektor.
- `wave4-execution-fehlts.spec.ts`: repariert — Payload gezielt über die
  eindeutige Region `execution-payload` statt über einen zweimal vorkommenden
  Detail-Test-ID geprüft.
- `critical-paths.spec.ts`: repariert — deterministische Session/API-Mocks und
  eindeutige Navigationsrollen statt bedingter Skips.
- Bestehende bedingte `test.skip`-Pfade in den E2E-Helfern und
  Blueprint-Tests wurden durch harte Auth-Erwartungen ersetzt.
- Gelöscht: keine Tests; alle betroffenen Tests prüfen weiterhin gültiges
  Verhalten.

Abschlusslauf:

```text
50 passed (1.2m)
```

Im Verzeichnis `tests/e2e` gibt es keine `test.skip`-/`it.skip`-/`describe.skip`-
Vorkommen mehr.

## Weitere Checks

```text
npm run lint       # exit 0
npm run typecheck  # exit 0
npm run test:run   # 73 files, 335 tests passed
```

## FILE_LIMIT=10 regression (updated after fixture expansion)

Fixture now has 13 analyzable files. With `FILE_LIMIT = 10`:

```
golden-set: nodes 5 < min 16
golden-set: edges 7 < min 20
golden-set: routes 3 < min 8
golden-set: files 10 < min 11
```

exit=1. `preview-runner/lib/blueprint-local.js` restored (git diff clean).
Normal run: `golden-set: OK (nodes=18 edges=23 routes=9 tables=2 files=13)`

