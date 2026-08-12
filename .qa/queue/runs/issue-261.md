# Issue 261 — P0-7 Knoten-Duplikate

## Umsetzung

- Domänen-, Schicht-, Modul- und Datei-Container verwenden dieselben
  deterministischen IDs wie `_scopes.ts`.
- Leere Heuristikwerte fallen auf `unassigned` zurück.
- `registerKnownId` reserviert bekannte Container-IDs in `registry.nodes`, ohne
  `stableUniqueId` zu verändern.
- Das Golden Set misst `duplicateNodeIds` und unterstützt bestehende
  Mindestwerte sowie den neuen Höchstwert `0`.
- Sechs Regressionstests decken Wiederverwendung, Scope-Auflösung,
  unterschiedliche Domänen und gleichnamige Module ab.

## Automatisierte Checks

```text
npm run test:run -- local-engine/src/services/software-graph/_file-context.test.ts
1 Datei, 6 Tests bestanden

npm run test:run -- software-graph
8 Dateien, 62 Tests bestanden

npm run test:run
74 Dateien, 341 Tests bestanden

npm run typecheck
exit 0

npm run lint
exit 0

npm run build:engine
exit 0

npm run golden-set
golden-set: OK (nodes=18 edges=23 routes=9 tables=2 files=13 duplicateNodeIds=0)
```

`npm run checks` wurde zusätzlich ausgeführt, stoppt aber im
Repository-weiten Format-Check an zwei bereits vor diesem Ticket vorhandenen,
fremden Working-Tree-Dateien:
`.qa/intake/visudev-phase0-honesty-issues.md` und `.qa/queue/state.json`. Der
gezielte Prettier-Check aller P0-7-Dateien besteht. Die fremden Änderungen
wurden nicht angefasst.

Der Golden-Set-Bestand blieb bei 18 Knoten; das Fixture hatte bereits vor der
Korrektur keine Tilde-ID. Die neue Höchstwertprüfung schützt den Zustand
explizit.

## browo-hr — gepinnter Auditvergleich

Quelle: gespeicherter Rohscan unter
`visudev-test-repos/evidence/blueprint-truth-audit-2026-08-11/out-default/`,
zugeordnet zum browo-hr-Audit-Pin `24dd57cb0cfc`. Der Rohscan enthält 473
Routen, 483 Fakten und 400 analysierte Dateien.

Vorher, aus `blueprint-enriched.json`:

- 2499 Knoten
- 1945 Knoten-IDs mit `~`
- 372 Route-Knoten
- 500 Domain-Knoten bei zwei verschiedenen Domain-Labels
- 499 Datei-Knoten bei 45 eindeutigen Pfaden, also 454 Duplikate
- 1944 nicht auflösbare `scopeId`-Verweise
- `condensed: true`
- `wiki.routes.ts`, `workflows.routes.ts` und `permission.routes.ts` fehlen

Nachher, derselbe Rohscan durch den gebauten Node-Graph-Builder:

- 802 Knoten
- 0 Knoten-IDs mit `~`
- 493 Route-Knoten
- genau zwei Domain-Knoten: `backend`, `deployment`
- 80 Datei-Knoten bei 80 eindeutigen Pfaden
- 0 nicht auflösbare `scopeId`-Verweise
- `condensed: false`
- `wiki.routes.ts`, `workflows.routes.ts` und `permission.routes.ts` vorhanden

Die gespeicherte Ausgangsdatei misst 1945 Tilde-IDs statt der im Intake
genannten 1955; die Abweichung wurde nicht durch ein Abschwächen der
Akzeptanzprüfung kaschiert. Der Zielwert bleibt exakt 0.

## Weitere Real-Project-Smokes

- Formbricks, SHA `04511a58d52d`: 201 Knoten, 7 Route-Knoten, 27 eindeutige
  Datei-Knoten, 0 Tilde-IDs, 0 Datei-Duplikate, 0 fehlende Scope-Verweise,
  `condensed: false`.
- Plane, SHA `af1be50b48b1`: 354 Knoten, 240 Route-Knoten, 94 eindeutige
  Datei-Knoten, 0 Tilde-IDs, 0 Datei-Duplikate, 0 fehlende Scope-Verweise,
  `condensed: false`.
- Der aktuelle browo-hr-Checkout stand auf `d493b4e6da64` statt auf dem
  Audit-Pin. Ein zusätzlicher Live-Smoke dieses unveränderten Checkouts ergab
  ebenfalls 0 Tilde-IDs, 0 Datei-Duplikate, 0 fehlende Scope-Verweise und
  `condensed: false`.

`visudev-test-repos/evidence/REAL-PROJECTS-SUMMARY.md` enthält die aktualisierte
Kurzfassung.

## Scope-Guards

- `_ids.ts`: 22 hinzugefügte, 0 gelöschte Zeilen; `stableUniqueId` blieb
  unverändert.
- `_file-context.ts`: `stableUniqueId` wird nur noch für vier Kanten-IDs
  verwendet.
- `_heuristics.ts`, `_scopes.ts`, `graph-export-cap.ts` und
  `src/modules/blueprint/` haben keinen Ticket-Diff.
- Die berührten TypeScript-Dateien enthalten keine Type-System-Escape-Hatches.

## Offene manuelle Evidenz

- Vorher-/Nachher-Screenshots der Architecture-Ansicht wurden in diesem
  Node-Builder-Lauf nicht neu aufgenommen.
- Die UI-Darstellung von `unassigned` als „Nicht zugeordnet“ ist laut Auftrag
  ein späterer UI-Schritt.
