# P0-5 — CI misst den Analyzer, nicht den Demo

Phase: 0 (Ehrlichkeit) · Reihenfolge: **zuerst, blockiert P0-1 bis P0-6**
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Dieses Issue verhindert, dass die gesamte Phase 0 in sechs Monaten unbemerkt
zurückgerollt wird.

Die VisuDEV-Oberfläche wurde gegen `shared/demo-graph-seed.ts` entwickelt —
einen handgeschriebenen Graphen, der den ursprünglichen Konzept-Mockups
nachempfunden ist. Solange die CI mit aktivierter Demo-Enrichment baut, prüft
sie diesen handgeschriebenen Graphen und nicht den Analyzer. Sie meldet grün,
während reale Repositories unvollständig oder falsch analysiert werden.

Genau das ist über mehrere Wellen hinweg passiert. Die Gapclose-Wellen mussten
ihre Ergebnisse manuell auf echten Repos nachweisen, weil die CI dazu nichts
sagen konnte. Nach jeder Welle wurde diese manuelle Prüfung einmal gemacht und
danach nicht mehr wiederholt — Regressionen fielen deshalb erst Wellen später
auf.

Parallel waren die E2E-Tests über mehrere Wellen dauerhaft rot und wurden als
Hintergrundrauschen behandelt. Merges erfolgten trotzdem. Damit gab es faktisch
kein Qualitätstor.

**Ohne dieses Issue hätte keines der übrigen Phase-0-Probleme so lange
überleben können.**

## 2. Problem

### 2.1 Es gibt genau einen Workflow, und der baut den Demo

`.github/workflows/e2e.yml` ist die einzige Datei in `.github/workflows/`.
Ihr Build-Schritt:

```33:37:.github/workflows/e2e.yml
      - name: Build
        run: npm run build
        env:
          VITE_BLUEPRINT_DEMO_ENRICHMENT: "true"
          VITE_ACCESS_CONTROL_V2: "true"
```

Die einzige automatisierte Prüfung des Projekts läuft also ausdrücklich gegen
den Demo-Graphen.

### 2.2 Lint, Typecheck und Unit-Tests laufen in der CI überhaupt nicht

`package.json` definiert `lint`, `typecheck`, `test:run` und `checks`. Keines
davon wird in `e2e.yml` aufgerufen. Diese Prüfungen laufen ausschließlich
lokal, und `scripts/checks/run.sh` ist zusätzlich diff-basiert — es prüft nur
geänderte Bereiche, nicht das Gesamtergebnis.

### 2.3 Die CI testet einen Modus, der nicht der Standard ist

```12:13:.github/workflows/e2e.yml
  # E2E tests mock Supabase edge functions; default app mode is local-first since Phase 1.
  VITE_VISUDEV_MODE: supabase
```

Der Kommentar sagt selbst, dass der Standardmodus seit Phase 1 local-first ist.
Getestet wird der andere.

### 2.4 Enrichment hat zwei Schalter

`.env.example:12-14`:

```
# Demo graph enrichment (opt-in; npm run dev sets both automatically)
# VISUDEV_DEMO_ENRICHMENT=true
# VITE_BLUEPRINT_DEMO_ENRICHMENT=true
```

Ein Schalter für die Node-Seite, einer für die Vite-Seite. Wenn sie
auseinanderlaufen, testet die Anwendung gegen eine andere Datenlage als der
Analyzer, und niemand bemerkt es.

### Auswirkung

Regressionen an realen Repositories sind für die CI unsichtbar. Jede
Verbesserung aus den Phasen 0 bis 5 kann verloren gehen, ohne dass ein Lauf
rot wird. Für den Nutzer bedeutet das: Die App wird wieder so hohl, wie sie
heute ist, nur langsamer.

## 3. Lösung

Ein neuer Workflow `.github/workflows/ci.yml` mit drei getrennten Jobs, und
eine Entscheidung über die bestehenden E2E-Tests.

**Job `quality`** — läuft ohne jede Enrichment-Variable: `npm run lint`,
`npm run typecheck`, `npm run test:run`.

**Job `e2e-demo`** — der bisherige E2E-Lauf, umbenannt und im Namen als
Demo-Pfad gekennzeichnet. Behält `VITE_BLUEPRINT_DEMO_ENRICHMENT: "true"`,
weil er genau diesen Pfad prüfen soll. `e2e.yml` wird gelöscht und geht in
`ci.yml` auf.

**Job `golden-set`** — analysiert ein echtes, im Repository eingefrorenes
Beispielprojekt mit `analyzeLocalBlueprint` **ohne** Enrichment und prüft
Untergrenzen für Knoten, Kanten, Routen und erkannte Tabellen.

**E2E-Entscheidung:** Jeder aktuell rote Test wird entweder repariert oder
gelöscht. Ein dauerhaft roter Test ist schädlicher als kein Test, weil er die
Aufmerksamkeit für echte Fehler zerstört.

### Warum ein Fixture-Repo und nicht Formbricks oder browo-hr

Ein Klon eines großen echten Repositories macht die CI langsam, netzabhängig
und nicht reproduzierbar. Deshalb wird ein kleines, aber **echtes** Projekt in
`tests/fixtures/golden-repo/` eingecheckt: echter Express-Code, echtes
Prisma-Schema, echte Imports. Der Analyzer parst tatsächlichen Quelltext.

Der Unterschied zum Demo-Graphen ist wesentlich und muss verstanden werden:
Beim Demo-Graphen wird das **Ergebnis** von Hand geschrieben. Beim Fixture-Repo
wird die **Eingabe** von Hand geschrieben und das Ergebnis vom Analyzer
erzeugt. Nur das zweite prüft den Analyzer.

Die großen Golden-Set-Repos (Formbricks, Plane, Rocket.Chat, browo-hr) bleiben
manuelles Abnahmekriterium in den einzelnen Issues. Der CI-Job ersetzt sie
nicht, er fängt nur grobe Regressionen früh.

### Verworfene Alternativen

**E2E als „bekannt instabil" markieren und weiterlaufen lassen.** Das ist der
Ist-Zustand und die Ursache des Problems.

**Enrichment aus dem E2E-Job entfernen.** Die bestehenden E2E-Tests erwarten
Demo-Daten. Sie würden alle rot, ohne dass ein echter Fehler vorliegt. Der
Demo-Pfad ist ein legitimer Pfad und darf geprüft werden — er darf nur nicht
der einzige sein.

**Golden-Set-Repos in CI klonen.** Zu langsam, netzabhängig, und Rocket.Chat
allein überschreitet jedes vernünftige CI-Zeitbudget.

## 4. Architektur

Keine Änderung an Produktcode. Betroffen sind ausschließlich CI-Konfiguration,
Testinfrastruktur und ein neues Fixture.

`shared/demo-graph-seed.ts` wird **nicht** gelöscht. Der Demo ist für
Präsentationen und für UI-Entwicklung ohne laufende Analyse nützlich. Er
verliert nur seinen Status als Standardpfad der CI.

Einstiegspunkt für den Golden-Set-Job ist die bereits exportierte Funktion
`analyzeLocalBlueprint` in `preview-runner/lib/blueprint-local.js:486`. Es
wird kein Server, kein Docker und kein Supabase benötigt.

## 5. Edge Cases

- **Fixture-Repo ändert sich unbeabsichtigt:** Es liegt im Repository und wird
  von der Fertig-Checkliste über einen Hash geprüft. Änderungen sind möglich,
  aber ein bewusster eigener Commit.
- **Kennzahlen schwanken leicht zwischen Läufen:** Deshalb Untergrenzen statt
  exakter Werte. Wird ein exakter Vergleich verwendet, wird der Job selbst zur
  Quelle roter Läufe und damit wertlos — genau das Muster, das dieses Issue
  beheben soll.
- **Kennzahlen verbessern sich:** Mehr erkannte Knoten sind kein Fehlschlag.
  Die Untergrenze wird im selben PR angehoben, in dem die Verbesserung
  entsteht.
- **`node_modules` im Fixture:** Nicht einchecken. Das Fixture enthält
  `package.json`, aber keine Abhängigkeiten. Der Analyzer parst Quelltext und
  braucht keine Installation.
- **Fixture wird vom eigenen Lint/Typecheck erfasst:** Es ist absichtlich
  eigenständiger Beispielcode und muss aus `tsconfig.json`, `eslint.config.*`
  und der Vitest-Konfiguration ausgeschlossen werden, sonst schlägt `quality`
  wegen des Fixtures fehl.
- **Windows-Zeilenenden:** Das Fixture erhält einen `.gitattributes`-Eintrag
  mit `* text eol=lf`, damit die Dateizählung plattformunabhängig ist.
- **Kein Netzwerk in der CI:** Der Golden-Set-Job darf nichts nachladen.

## 6. User Journey

Nutzer ist hier der Entwickler beziehungsweise der Agent im `ecc-runner-loop`.

**Vorher:** Ein PR wird grün gemeldet. Nach dem Merge stellt sich beim
manuellen Golden-Set-Lauf heraus, dass Formbricks weniger Tabellen erkennt als
zuvor. Es wird ein Folge-Issue geschrieben, und die Ursache liegt inzwischen
mehrere Commits zurück.

**Nachher:** Derselbe PR wird rot mit der Meldung
`golden-set: tables 8 < min 11`. Der Fehler wird vor dem Merge behoben, und
der Verursacher ist der PR selbst.

## 7. Akzeptanzkriterien

- [ ] `.github/workflows/ci.yml` existiert und enthält die Jobs `quality`,
      `e2e-demo` und `golden-set`.
- [ ] `.github/workflows/e2e.yml` existiert nicht mehr.
- [ ] Job `quality` führt `npm run lint`, `npm run typecheck` und
      `npm run test:run` aus und setzt **keine** Variable, deren Name
      `DEMO_ENRICHMENT` enthält.
- [ ] Job `golden-set` setzt **keine** Variable, deren Name
      `DEMO_ENRICHMENT` enthält.
- [ ] Job `e2e-demo` setzt `VITE_BLUEPRINT_DEMO_ENRICHMENT: "true"` und trägt
      diesen Zweck im `name`-Feld.
- [ ] `tests/fixtures/golden-repo/` existiert mit echtem Quelltext und ist aus
      `tsconfig.json`, `eslint.config.*` und der Vitest-Konfiguration
      ausgeschlossen.
- [ ] `tests/fixtures/golden-repo/expected-metrics.json` enthält Untergrenzen
      und die gemessenen Ausgangswerte als Kommentarfeld.
- [ ] `npm run golden-set` läuft lokal in unter 30 Sekunden und endet mit
      Exit-Code 0.
- [ ] Kein E2E-Test ist dauerhaft rot. Jeder zuvor rote Test ist grün oder
      gelöscht, mit Begründung je Test im PR.
- [ ] **Regressionsnachweis:** `FILE_LIMIT` in
      `preview-runner/lib/blueprint-local.js:36` wird temporär auf `10`
      gesetzt; `npm run golden-set` schlägt fehl. Die Ausgabe wird im PR
      dokumentiert, die Änderung anschließend zurückgenommen.

## 8. Tests

**Neu:**

- `scripts/golden-set/run.mjs` — der Job selbst. Lädt
  `analyzeLocalBlueprint`, analysiert das Fixture, vergleicht gegen
  `expected-metrics.json`, gibt bei Unterschreitung
  `golden-set: <metrik> <ist> < min <soll>` aus und beendet mit Exit-Code 1.
- `scripts/checks/ci-config.test.ts` — Metatest über die YAML-Datei:
  - `"quality job does not enable demo enrichment"` — der Job-Block `quality`
    enthält keinen String `DEMO_ENRICHMENT`.
  - `"golden-set job does not enable demo enrichment"` — analog.
  - `"e2e-demo job is explicitly named as demo path"` — das `name`-Feld des
    Jobs enthält den Teilstring `Demo`.

  Begründung: Ohne diesen Metatest kann die Einstellung in einem späteren PR
  unbemerkt zurückgedreht werden. Genau das ist der Fehler, den dieses Issue
  behebt.

**Anzupassen:** Tests, die implizit vom Demo-Graphen ausgehen, werden dem Job
`e2e-demo` zugeordnet. Umbau der Tests ist **nicht** Teil dieses Issues.

**Zu löschen:** Nur E2E-Tests, die dauerhaft rot sind und demo-spezifisches
Verhalten prüfen, das nicht mehr gilt. Jede Löschung wird im PR einzeln
begründet. Ein roter Test, der korrektes Verhalten prüft, wird repariert, nicht
gelöscht.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run lint
npm run typecheck
npm run test:run
npm run golden-set
npm run e2e
```

Der PR enthält:
1. Die Ausgabe von `npm run golden-set` im Normalfall.
2. Die Ausgabe von `npm run golden-set` mit `FILE_LIMIT = 10`.
3. Eine Liste aller zuvor roten E2E-Tests mit Entscheidung „repariert" oder
   „gelöscht" und Begründung.

Evidence-Datei `visudev-test-repos/evidence/REAL-PROJECTS-SUMMARY.md` erhält
einen neuen Abschnitt „CI Golden Set" mit den gewählten Untergrenzen und deren
Herleitung.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei | Was passiert |
|---|---|
| `package.json` | Neues Skript `golden-set` ergänzen |
| `tsconfig.json` | `tests/fixtures/**` in `exclude` aufnehmen |
| `eslint.config.js` (oder `.mjs`/`.cjs`, je nach Vorhandensein) | `tests/fixtures/**` ignorieren |
| `vitest.config.ts` | `tests/fixtures/**` aus dem Testlauf ausschließen |
| `.gitattributes` | Anlegen falls nicht vorhanden; `tests/fixtures/golden-repo/** text eol=lf` |

### Neu anzulegen

| Datei | Inhalt |
|---|---|
| `.github/workflows/ci.yml` | Drei Jobs, exakter Inhalt in Abschnitt 12 |
| `scripts/golden-set/run.mjs` | Analyse + Schwellwertvergleich |
| `scripts/checks/ci-config.test.ts` | Metatest über `ci.yml` |
| `tests/fixtures/golden-repo/` | Fixture-Projekt, Struktur in Abschnitt 12 |
| `tests/fixtures/golden-repo/expected-metrics.json` | Untergrenzen |

### Zu löschen

| Datei | Grund |
|---|---|
| `.github/workflows/e2e.yml` | Geht vollständig in `ci.yml` auf |

### Nicht anfassen

| Datei / Bereich | Grund |
|---|---|
| `shared/demo-graph-seed.ts` | Bleibt bestehen; nur sein CI-Status ändert sich |
| `preview-runner/lib/blueprint-local.js` | Wird nur gelesen. `FILE_LIMIT` gehört zu P0-1 |
| `src/modules/blueprint/**` | Kein Produktcode in diesem Issue |
| `local-engine/**` | Kein Produktcode in diesem Issue |
| `scripts/checks/run.sh` | Die Diff-Logik bleibt für den lokalen Gebrauch |
| `.env.example` | Die Zwei-Schalter-Frage wird hier nicht gelöst, nur in der CI umgangen |

## 11. Umsetzungsschritte

**Schritt 1 — Fixture anlegen.**
`tests/fixtures/golden-repo/` mit der Struktur aus Abschnitt 12.1 erstellen.
Kein `node_modules`, keine Lockfile.

**Schritt 2 — Fixture aus den Werkzeugen ausschließen.**
`tsconfig.json`, `eslint.config.*` und `vitest.config.ts` anpassen. Danach
`npm run lint && npm run typecheck && npm run test:run` ausführen. Alle drei
müssen so grün sein wie vor Schritt 1.

**Schritt 3 — Golden-Set-Skript schreiben.**
`scripts/golden-set/run.mjs` nach Vorlage in Abschnitt 12.2.
`expected-metrics.json` zunächst mit allen Untergrenzen auf `0` anlegen.

**Schritt 4 — Ausgangswerte messen.**
`node scripts/golden-set/run.mjs --report` ausführen. Das Skript gibt die
gemessenen Werte aus. Diese Werte in `expected-metrics.json` eintragen:
`measured` = gemessener Wert, `min` = `Math.floor(measured * 0.9)`.

Begründung für 90%: Untergrenze mit Puffer gegen geringfügige Schwankungen,
aber eng genug, um echte Regressionen zu fangen. Kein anderer Faktor.

**Schritt 5 — npm-Skript ergänzen.**
`"golden-set": "node scripts/golden-set/run.mjs"` in `package.json`.

**Schritt 6 — `ci.yml` anlegen** nach Abschnitt 12.3.

**Schritt 7 — `e2e.yml` löschen.**

**Schritt 8 — Metatest schreiben** nach Abschnitt 12.4.

**Schritt 9 — E2E-Bestandsaufnahme.**
`npm run e2e` ausführen und die Liste der fehlschlagenden Tests festhalten.
Für jeden Test genau eine der beiden Entscheidungen treffen:

- Der Test prüft Verhalten, das korrekt sein sollte → **reparieren**.
- Der Test prüft demo-spezifisches Verhalten, das nicht mehr gilt →
  **löschen**, mit Begründung im PR.

Es gibt keine dritte Option. Insbesondere darf keine Zusicherung
abgeschwächt, kein `test.skip` gesetzt und kein Timeout erhöht werden, um
einen Test grün zu bekommen.

**Schritt 10 — Regressionsnachweis.**
`FILE_LIMIT` in `preview-runner/lib/blueprint-local.js:36` temporär auf `10`
setzen, `npm run golden-set` ausführen, Ausgabe für den PR sichern, Änderung
zurücknehmen. `git diff` muss danach für diese Datei leer sein.

## 12. Exakte Vorgaben

### 12.1 Fixture-Struktur

```
tests/fixtures/golden-repo/
  package.json
  prisma/schema.prisma
  src/index.ts
  src/routes/users.route.ts
  src/routes/orders.route.ts
  src/services/user.service.ts
  src/services/order.service.ts
  src/repositories/user.repository.ts
  src/repositories/order.repository.ts
  src/middleware/auth.middleware.ts
  docker-compose.yml
```

Anforderungen an den Inhalt:

- **Echter, lauffähig aussehender Code.** Keine Stub-Dateien mit nur einem
  Kommentar. Jede Route registriert einen Express-Handler, jeder Service ruft
  ein Repository auf, jedes Repository verwendet den Prisma-Client.
- **Echte Importketten:** `index.ts` → `routes/*` → `services/*` →
  `repositories/*`. Die Ketten müssen über Datei- und Funktionsgrenzen
  verlaufen, damit der Call-Graph etwas zu finden hat.
- **`auth.middleware.ts` wird in `users.route.ts` verwendet, aber nicht in
  `orders.route.ts`.** Damit gibt es eine erkennbare Asymmetrie für die
  Security-Auswertung.
- **`prisma/schema.prisma` mit genau vier Modellen:** `User`, `Order`,
  `OrderItem`, `Session`, inklusive Relationen zwischen `User` und `Order`
  sowie `Order` und `OrderItem`.
- **`docker-compose.yml` mit zwei Diensten:** `postgres` und `redis`.

### 12.2 `scripts/golden-set/run.mjs`

Verhalten:

- Ohne Argument: Analyse ausführen, gegen `expected-metrics.json` prüfen.
- Mit `--report`: Analyse ausführen, gemessene Werte ausgeben, immer Exit 0.

Geprüfte Kennzahlen, exakt diese fünf Namen:

```
nodes, edges, routes, tables, files
```

Ausgabeformat bei Unterschreitung, exakt:

```
golden-set: <metrik> <ist> < min <soll>
```

Ausgabeformat bei Erfolg, exakt:

```
golden-set: OK (nodes=<n> edges=<n> routes=<n> tables=<n> files=<n>)
```

Exit-Code 1 bei mindestens einer Unterschreitung, sonst 0. Bei Unterschreitung
werden **alle** verletzten Kennzahlen ausgegeben, nicht nur die erste.

### 12.3 `expected-metrics.json`

```json
{
  "_comment": "min = floor(measured * 0.9). measured stammt aus dem Lauf in PR #<nummer>. Bei Verbesserungen wird min im selben PR angehoben.",
  "nodes": { "measured": 0, "min": 0 },
  "edges": { "measured": 0, "min": 0 },
  "routes": { "measured": 0, "min": 0 },
  "tables": { "measured": 0, "min": 0 },
  "files": { "measured": 0, "min": 0 }
}
```

### 12.4 `.github/workflows/ci.yml`

Job-Namen exakt: `quality`, `e2e-demo`, `golden-set`.
`name`-Felder exakt:

- `Quality (lint, typecheck, unit)`
- `E2E (Playwright, Demo-Enrichment)`
- `Golden Set (echter Analyzer, ohne Enrichment)`

Trigger identisch zur bisherigen `e2e.yml`: `push` auf `main` und
`pull_request` gegen `main`.

Die bisherigen globalen `env`-Einträge `VITE_SUPABASE_ANON_KEY` und
`VITE_VISUDEV_MODE` gelten **nur noch im Job `e2e-demo`**, nicht global. Die
Jobs `quality` und `golden-set` brauchen sie nicht.

Node-Version `20`, `cache: "npm"`, `npm ci` — wie bisher.
Der Playwright-Report-Upload bei Fehlschlag bleibt unverändert im Job
`e2e-demo`.

### 12.5 Metatest-Namen

Exakt diese drei `it`-Titel in `scripts/checks/ci-config.test.ts`:

```
quality job does not enable demo enrichment
golden-set job does not enable demo enrichment
e2e-demo job is explicitly named as demo path
```

## 13. Häufige Fehlannahmen

**„Der Demo-Graph ist das Problem und sollte gelöscht werden."**
Falsch. Der Demo ist ein legitimer Pfad für Präsentationen und für
UI-Entwicklung ohne laufende Analyse. Das Problem ist, dass er der *einzige*
war, den die CI geprüft hat. `shared/demo-graph-seed.ts` bleibt unverändert.

**„Das Fixture-Repo ist auch nur ein Demo."**
Falsch. Beim Demo-Graphen wird das Ergebnis von Hand geschrieben, beim Fixture
die Eingabe. Der Analyzer parst im Fixture echten Quelltext und erzeugt das
Ergebnis selbst. Deshalb muss das Fixture echter Code sein und darf nicht aus
Platzhalterdateien bestehen.

**„Man sollte die E2E-Tests auf Enrichment OFF umstellen."**
Falsch für dieses Issue. Die bestehenden Tests erwarten Demo-Daten und würden
sämtlich rot, ohne dass ein echter Fehler vorliegt. Sie bleiben im Job
`e2e-demo`. Ein Umbau auf echte Daten ist eine spätere, eigene Entscheidung.

**„`FILE_LIMIT` ist zu klein, das sollte man gleich mitkorrigieren."**
Nein. Das gehört zu P0-1 und dann zu Phase 2. In diesem Issue wird
`FILE_LIMIT` nur temporär für den Regressionsnachweis verändert und danach
zurückgesetzt.

**„Der Golden-Set-Job sollte exakte Werte vergleichen."**
Nein. Exakte Vergleiche machen den Job bei jeder harmlosen Verbesserung rot.
Ein Job, der ständig grundlos rot ist, wird ignoriert — und genau dieses
Muster behebt das Issue gerade.

**„`scripts/checks/run.sh` sollte in die CI."**
Nein. Das Skript ist diff-basiert und für den lokalen Gebrauch gedacht. In der
CI werden `lint`, `typecheck` und `test:run` direkt und vollständig
aufgerufen.

**„Ein fehlschlagender Test lässt sich mit `test.skip` entschärfen."**
Nein. Siehe Schritt 9: reparieren oder löschen, nichts dazwischen. `test.skip`
erzeugt genau den Zustand — sichtbar vorhanden, faktisch wirkungslos — den
Phase 0 überall beseitigt.

## 14. Fertig-Checkliste

```bash
cd Visudevfigma

# Fixture ist da und aus den Werkzeugen ausgeschlossen
ls tests/fixtures/golden-repo/prisma/schema.prisma   # erwartet: Pfad existiert
npm run lint                                          # erwartet: exit 0
npm run typecheck                                     # erwartet: exit 0
npm run test:run                                      # erwartet: exit 0

# Golden Set läuft und meldet OK
npm run golden-set                                    # erwartet: "golden-set: OK (...)" und exit 0

# Alte Workflow-Datei ist weg, neue ist da
test ! -f .github/workflows/e2e.yml && echo GONE      # erwartet: GONE
test -f .github/workflows/ci.yml && echo PRESENT      # erwartet: PRESENT

# Kein Enrichment in den falschen Jobs
node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8');const q=y.split('golden-set:')[0].split('quality:')[1]||'';console.log(q.includes('DEMO_ENRICHMENT')?'FAIL':'OK')"
# erwartet: OK

# E2E ist entschieden
npm run e2e                                           # erwartet: exit 0

# FILE_LIMIT wurde zurückgesetzt
git diff --exit-code preview-runner/lib/blueprint-local.js && echo CLEAN
# erwartet: CLEAN
```

## Regeln für den Umsetzer

1. **Nur der beschriebene Scope.** Angrenzende Fehler nicht beheben, sondern
   im PR unter „Beobachtet, nicht behoben" notieren.
2. **Kein Test wird abgeschwächt, um ihn grün zu bekommen.** Kein `test.skip`,
   keine erhöhten Timeouts, keine entfernten Zusicherungen.
3. **Keine neuen Platzhalterwerte.**
4. **Keine repo-spezifischen Literale** im Produktcode.
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken, statt zu raten.
