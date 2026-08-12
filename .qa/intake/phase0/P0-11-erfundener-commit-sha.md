# P0-11 — Der Commit ist ein Hash des Ordnerpfads, und die Evolution-Timeline kann deshalb nie wachsen

Label: `opus-fix`
Phase: 0, Welle A · Keine Abhängigkeiten
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Die Evolution-Ansicht hat im Original-Konzept die Aufgabe:

> „Veränderungen zwischen Commits, Branches und Pull Requests"

Und weiter:

> „Änderungen werden pro Commit gespeichert und als Graph-Diff dargestellt."

Der Inspector sollte laut Konzept zu jedem Knoten „Commit und Branch" anzeigen.
Die Herkunftsangabe ist damit ein zugesagtes Kernmerkmal, nicht Beiwerk.

Lokale Analysen sind der Hauptweg, auf dem der Nutzer das Werkzeug verwendet —
`localhost:3000` gegen einen Ordner auf der Platte.

## 2. Problem

**Der angezeigte Commit existiert nicht.** Er ist ein SHA256 des
Verzeichnispfads, auf zwölf Zeichen gekürzt:

```397:399:preview-runner/lib/blueprint-local.js
function localCommitSha(localPath) {
  return createHash("sha256").update(localPath).digest("hex").slice(0, 12);
}
```

```526:526:preview-runner/lib/blueprint-local.js
    result.blueprint.commitSha = localCommitSha(localPath);
```

Zwölf Hexadezimalzeichen sind von einem echten Git-Kurz-SHA nicht zu
unterscheiden. Der Wert wandert in `ref`, `commitSha` und `label` des Snapshots
und erscheint im Log als „Analyzed commit: …". Ein Nutzer, der ihn sieht, hat
keinen Anlass zu zweifeln — und wird ihn nie in seiner Git-Historie finden.

### Der Folgeschaden ist größer als die Falschanzeige

Da der Pfad zwischen zwei Läufen konstant ist, ist auch der Hash konstant. Die
Snapshot-ID wird daraus gebildet:

```23:23:local-engine/src/services/software-graph/_snapshots.ts
  const snapshotId = `snapshot:${options.commitSha ?? options.ref}`;
```

Und beim Zusammenführen werden gleiche IDs entfernt:

```41:43:local-engine/src/services/software-graph/_snapshots.ts
  const existing = Array.isArray(previousSnapshots) ? previousSnapshots : [];
  const withoutDuplicate = existing.filter((snapshot) => snapshot.id !== nextSnapshot.id);
  return [...withoutDuplicate, nextSnapshot].slice(-MAX_SNAPSHOTS);
```

**Jeder erneute Scan desselben Ordners ersetzt den vorherigen Snapshot.** Die
Liste kann bis zu 20 Einträge halten, enthält für lokale Analysen aber immer
genau einen. Es gibt nie zwei Zeitpunkte zum Vergleichen.

Die Evolution-Ansicht ist damit nicht ungenau, sondern **strukturell
funktionslos für lokale Analysen** — also für den Hauptweg. Der Nutzer kann noch
so oft scannen, er wird nie einen Verlauf sehen.

Das erklärt zugleich, warum die Ansicht leer wirkt und warum die dortigen
Bedienelemente ohne Wirkung sind (P0-3): Es gab nie Daten, gegen die sie
arbeiten konnten.

### Auswirkung

- Der angezeigte Commit ist eine Falschaussage in einem Feld, dessen Format
  Vertrauen erzeugt.
- Die Evolution-Ansicht kann nie mehr als einen Zeitpunkt kennen.
- Der Graph-Diff, ein Kernversprechen, ist unerreichbar.
- Ein Nutzer, der den Commit kopiert und in `git show` einsetzt, bekommt einen
  Fehler und muss annehmen, seine Installation sei defekt.

## 3. Lösung

**Zwei Teile.**

**Teil 1 — Echten Commit verwenden, wenn es einen gibt.** Der lokale Ordner ist
in der Regel ein Git-Repository. `git-summary.ts` liest Commit und Branch
bereits. Diese Werte werden verwendet, statt einen Hash zu erfinden. Zusätzlich
wird vermerkt, ob der Arbeitsbaum Änderungen enthält — ein Scan mit
uncommitteten Änderungen entspricht nicht dem Commit.

**Teil 2 — Ohne Git keinen SHA behaupten.** Ist der Ordner kein
Git-Repository, wird `commitSha` **nicht gesetzt**. Die Herkunft wird als
Zeitstempel angegeben, und die Snapshot-ID gründet auf dem Zeitstempel. Damit
wächst die Timeline auch ohne Git, weil jeder Lauf eine eigene ID bekommt.

Für den Fall „Git vorhanden, Arbeitsbaum verändert" gilt dasselbe: Die
Snapshot-ID enthält den Zeitstempel, weil zwei Scans am gleichen Commit mit
unterschiedlichem Arbeitsbaum verschiedene Zustände sind. Genau dieser Fall ist
der häufigste beim Entwickeln und der einzige, in dem ein Verlauf beim Arbeiten
entsteht.

**Verworfene Alternative: den Hash beibehalten, aber im UI als „lokal"
kennzeichnen.** Eine gekennzeichnete Falschaussage bleibt falsch, und der
Folgeschaden an der Snapshot-ID bliebe bestehen.

**Verworfene Alternative: einen Zufallswert je Lauf verwenden.** Die Timeline
würde wachsen, aber jeder Eintrag trüge weiterhin ein commit-artiges Format
ohne Bezug zur Realität.

**Verworfene Alternative: den Inhalt aller Dateien hashen.** Ein
Inhalts-Hash wäre fachlich korrekt und würde bei unveränderten Dateien
zusammenfallen. Er kostet aber einen zusätzlichen Durchlauf über alle Dateien
und sieht wieder wie ein Commit aus. Zeitstempel plus echter Commit sind
einfacher und ehrlicher.

## 4. Architektur

| Schicht | Datei | Änderung |
|---|---|---|
| Preview-Runner | `preview-runner/lib/blueprint-local.js` | `localCommitSha` entfernen, Git-Daten verwenden |
| Node | `local-engine/src/services/analysis.service.ts` | Herkunft weitergeben, Log korrigieren |
| Node | `local-engine/src/services/software-graph/_snapshots.ts` | Snapshot-ID um Zeitstempel ergänzen |
| shared | `shared/software-graph.types.ts` | `SoftwareGraphSnapshot` um `sourceKind` und `dirty` |

`git-summary.ts` wird gelesen, aber nicht geändert.

## 5. Edge Cases

- **Ordner ist ein Git-Repository, Arbeitsbaum sauber**: Echter Commit, echter
  Branch, `dirty: false`. Snapshot-ID aus Commit **und** Zeitstempel, damit ein
  Wiederholungsscan die Timeline nicht ersetzt.
- **Arbeitsbaum verändert**: Echter Commit, `dirty: true`. Das UI muss den
  Unterschied zeigen — ein Verlauf, der uncommittete Zustände als Commits
  ausgibt, wäre der gleiche Fehler in neuer Form.
- **Kein Git-Repository**: `commitSha` bleibt undefiniert, `ref` ist der
  Zeitstempel. Kein erfundener Wert.
- **Git vorhanden, aber ohne Commits** (frisch initialisiert): Wie „kein Git".
- **Detached HEAD**: Commit vorhanden, Branch nicht. Branch bleibt undefiniert,
  nicht `"local"`.
- **Submodule**: Der Commit des äußeren Repositories gilt. Kein Sonderfall.
- **Zwei Scans in derselben Sekunde**: Der Zeitstempel muss Millisekunden
  enthalten, sonst kollidieren die IDs und der Fehler kehrt zurück.
- **`git` nicht installiert oder nicht im Pfad**: Wie „kein Git". Der Scan darf
  nicht scheitern.
- **Mehr als 20 Läufe**: `MAX_SNAPSHOTS = 20` greift und die ältesten fallen
  heraus. Bestehendes Verhalten, korrekt.
- **Enrichment ON**: Der Demo-Graph bringt eigene Snapshots mit. Die
  Demo-Timeline darf sich nicht ändern.

## 6. User Journey

**Vorher:** Der Nutzer scannt seinen Ordner, sieht „Commit `a3f2c81b9de4`",
kopiert ihn und führt `git show a3f2c81b9de4` aus. Git meldet, der Commit sei
unbekannt. Er scannt danach fünfmal weiter und die Evolution-Ansicht bleibt
leer.

**Nachher:** Er sieht den echten Commit seines Arbeitsverzeichnisses, den
Branch und den Hinweis, dass ungespeicherte Änderungen enthalten sind. Nach dem
zweiten Scan hat die Timeline zwei Einträge, und er sieht, was sich zwischen
ihnen verändert hat.

## 7. Akzeptanzkriterien

- [ ] Die Funktion `localCommitSha` existiert nicht mehr.
- [ ] **Lokaler Scan eines Git-Ordners:** Der angezeigte Commit ist mit
      `git rev-parse --short HEAD` identisch.
- [ ] **Lokaler Scan eines Git-Ordners:** Der angezeigte Branch ist mit
      `git branch --show-current` identisch, nicht `"local"`.
- [ ] **Lokaler Scan eines Ordners ohne Git:** `commitSha` ist undefiniert. Es
      wird keine hexadezimale Zeichenkette als Commit angezeigt.
- [ ] **Zwei aufeinanderfolgende Scans desselben Ordners:** Die Snapshot-Liste
      enthält danach **zwei** Einträge. Vorher: einen.
- [ ] Bei verändertem Arbeitsbaum ist `dirty` gesetzt und im UI sichtbar.
- [ ] Das Log gibt keinen erfundenen Commit aus.
- [ ] Kein Feld im UI zeigt eine 12-stellige Hexadezimal-Zeichenkette, die nicht
      aus Git kommt.

## 8. Tests

**Neu** in `local-engine/src/services/software-graph/_snapshots.test.ts`:

- `"two captures of the same commit produce two snapshots"` — zweimal
  `createGraphSnapshot` mit gleichem `commitSha`, aber verschiedenem
  `capturedAt`, danach `mergeGraphSnapshots` → zwei Einträge.
- `"snapshot id includes the timestamp"`.
- `"snapshot without commitSha still gets a unique id"`.
- `"captures in the same millisecond do not collide silently"` — identischer
  Zeitstempel und identischer Commit ergibt eine ID; das ist der einzige
  zulässige Kollisionsfall und muss bewusst zugesichert sein.

**Neu** in `preview-runner/lib/blueprint-local.test.js` (oder der bestehenden
Testdatei für dieses Modul):

- `"analysis of a non-git folder reports no commit sha"`.
- `"analysis of a git folder reports the real head commit"` — mit einem
  temporären Git-Repository im Test.

**Anzupassen:** Jeder Test, der einen 12-stelligen Hash als `commitSha` für
lokale Analysen erwartet.

**Zu löschen:** Tests, die `localCommitSha` direkt prüfen.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run test:run -- _snapshots
npm run test:run
```

Manuell, gegen browo-hr:

```bash
cd <browo-hr>
git rev-parse --short HEAD      # Vergleichswert
git branch --show-current       # Vergleichswert
```

Danach zweimal scannen und prüfen, dass die Evolution-Ansicht zwei Zeitpunkte
zeigt. Zusätzlich einen Ordner ohne Git anlegen und prüfen, dass dort kein
Commit erscheint.

Der PR enthält:
1. Screenshot der Evolution-Ansicht nach zwei Scans, mit zwei Einträgen.
2. Screenshot der Herkunftsangabe mit echtem Commit und Branch.
3. Screenshot eines Ordners ohne Git, ohne Commit-Anzeige.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei | Was passiert |
|---|---|
| `preview-runner/lib/blueprint-local.js` | `localCommitSha` entfernen, Git-Daten verwenden, `branch: "local"` ersetzen |
| `local-engine/src/services/analysis.service.ts` | Herkunft weitergeben, Log-Ausgabe korrigieren |
| `local-engine/src/services/software-graph/_snapshots.ts` | Snapshot-ID um Zeitstempel |
| `shared/software-graph.types.ts` | `sourceKind`, `dirty` in `SoftwareGraphSnapshot` |

### Neu anzulegen

| Datei | Zweck |
|---|---|
| `local-engine/src/services/software-graph/_snapshots.test.ts` | Tests, falls nicht vorhanden |

### Nicht anfassen

| Datei / Bereich | Grund |
|---|---|
| `git-summary.ts` | Liest Commit und Branch bereits korrekt; wird nur verwendet |
| `MAX_SNAPSHOTS` | Bleibt bei 20 |
| `mergeGraphSnapshots` — die Dedup-Logik | Ist korrekt. Der Fehler war die konstante ID, nicht das Entfernen von Duplikaten |
| `evolution-tabs.ts`, `EvolutionView.tsx` | Die toten Bedienelemente sind P0-3 |
| `shared/demo-graph-seed.ts` | Demo-Snapshots bleiben unverändert |

## 11. Umsetzungsschritte

**Schritt 1 — `localCommitSha` entfernen.** Funktion (Zeile 397-399) und
Aufruf (Zeile 526) löschen. Wird `createHash` danach nicht mehr verwendet, den
Import entfernen.

**Schritt 2 — Git-Daten beschaffen.** `git-summary.ts` liefert Commit und
Branch. Zusätzlich den Zustand des Arbeitsbaums ermitteln
(`git status --porcelain`, leere Ausgabe bedeutet sauber). Scheitert ein Aufruf
oder ist kein Git vorhanden, gelten alle drei Werte als nicht verfügbar — der
Scan läuft normal weiter.

**Schritt 3 — Herkunft bilden** nach Abschnitt 12.1.

**Schritt 4 — `branch: "local"` ersetzen.** Zeile 517 setzt den Branch fest auf
`"local"`. Künftig der echte Branch, sonst undefiniert.

**Schritt 5 — Snapshot-ID.** In `_snapshots.ts` Zeile 23 nach Abschnitt 12.2
ändern. Die Dedup-Logik in `mergeGraphSnapshots` bleibt unverändert.

**Schritt 6 — Log korrigieren.** Kein „Analyzed commit: <hash>" ohne echten
Commit. Formulierungen nach Abschnitt 12.3.

**Schritt 7 — Tests.**

**Schritt 8 — Manuell prüfen** nach Abschnitt 9, einschließlich des Falls ohne
Git.

## 12. Exakte Vorgaben

### 12.1 Herkunftstyp

```ts
export interface AnalysisOrigin {
  /** "git" when a real commit was read, "filesystem" otherwise. */
  sourceKind: "git" | "filesystem";
  /** Real short commit sha. Undefined when sourceKind is "filesystem". */
  commitSha?: string;
  /** Real branch name. Undefined on detached HEAD or without git. */
  branch?: string;
  /** True when the working tree has uncommitted changes. */
  dirty: boolean;
  /** ISO 8601 with milliseconds. Always set. */
  capturedAt: string;
}
```

`capturedAt` muss Millisekunden enthalten (`new Date().toISOString()` erfüllt
das). Ohne Millisekunden kollidieren zwei Scans in derselben Sekunde und der
behobene Fehler kehrt zurück.

### 12.2 Snapshot-ID

```ts
const snapshotId = `snapshot:${options.commitSha ?? "local"}:${options.capturedAt}`;
```

Der Zeitstempel ist Teil der ID, weil zwei Scans desselben Commits mit
unterschiedlichem Arbeitsbaum verschiedene Zustände sind.

### 12.3 Anzeige- und Logtexte

Wörtlich, deutsch:

| Fall | Herkunftsangabe im UI |
|---|---|
| Git, sauber | `Commit {sha} · Branch {branch}` |
| Git, verändert | `Commit {sha} · Branch {branch} · ungespeicherte Änderungen` |
| Git, detached HEAD | `Commit {sha} · kein Branch` |
| kein Git | `Kein Git-Repository · Stand {datum} {zeit}` |

Log-Ausgabe: `Analyzed commit {sha}` nur bei `sourceKind === "git"`. Sonst
`Analyzed local folder at {timestamp} (no git repository)`.

## 13. Verständlichkeit

**Leerzustand:** Nach dem ersten Scan hat die Timeline genau einen Eintrag. Das
ist kein Fehler, sieht aber wie einer aus. Erforderlicher Text, wörtlich:

> `Nur ein Zeitpunkt vorhanden. Für einen Vergleich braucht VisuDEV mindestens
> zwei Analysen. Scanne das Projekt später erneut, dann erscheint hier, was sich
> verändert hat.`

Das ist der wichtigste Teil dieses Issues für den Nutzer: Er muss erfahren, dass
der Verlauf durch wiederholtes Scannen entsteht. Ohne diesen Satz hält er die
Ansicht weiterhin für defekt.

**Erklärung:** „Commit", „Branch" und „ungespeicherte Änderungen" brauchen
Glossareinträge. Für „ungespeicherte Änderungen": „Du hast Dateien geändert,
aber noch nicht in Git gespeichert. Diese Analyse zeigt deinen aktuellen Stand,
nicht den letzten Commit."

**Nachweis:** Screenshot der Timeline mit einem Eintrag samt Hinweistext, mit
zwei Einträgen, sowie der Herkunftsangabe in allen vier Fällen aus 12.3.

## 14. Häufige Fehlannahmen

**„Ich lasse den Hash, kennzeichne ihn aber als lokal."**
Nein. Der schwerere Teil des Schadens ist die konstante Snapshot-ID, die
verhindert, dass die Timeline wächst. Eine Kennzeichnung ändert daran nichts.

**„`mergeGraphSnapshots` entfernt Duplikate, das ist der Fehler."**
Nein, das ist korrekt und bleibt. Der Fehler war, dass zwei verschiedene
Zustände dieselbe ID bekamen. Wer die Dedup-Logik entfernt, sammelt stattdessen
identische Einträge an.

**„Ein Zufalls-Wert je Lauf löst es einfacher."**
Die Timeline würde wachsen, aber die Einträge trügen wieder commit-artige
Werte ohne Bezug zur Realität — derselbe Fehler in neuer Form.

**„Ohne Git sollte ich wenigstens irgendeinen Hash zeigen, sonst sieht das Feld
leer aus."**
Ein leeres Feld mit dem Text „Kein Git-Repository" ist die richtige Antwort.
Ein Platzhalterwert ist durch die Grundregeln ausgeschlossen.

**„Ich hashe den Inhalt aller Dateien, das ist fachlich saubererer."**
Fachlich vertretbar, aber es kostet einen zusätzlichen Durchlauf über alle
Dateien und sieht wieder wie ein Commit aus. Echter Commit plus Zeitstempel
erfüllt den Zweck ohne beides.

**„Der Zeitstempel braucht keine Millisekunden."**
Zwei Scans in derselben Sekunde sind bei automatisierten Läufen normal. Ohne
Millisekunden kollidieren die IDs und der Fehler ist zurück. Das ist als Test
zugesichert.

**„Ich verdrahte gleich die Evolution-Bedienelemente mit."**
Nein, das ist P0-3. Dieses Issue liefert die Daten, gegen die sie arbeiten
können — vorher war es sinnlos, sie zu verdrahten.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma

# Die Funktion ist weg
rg -n "localCommitSha" preview-runner/ local-engine/ shared/
# erwartet: keine Treffer

# Kein fest verdrahteter Branch mehr
rg -n 'branch: "local"' preview-runner/
# erwartet: keine Treffer

# Snapshot-ID enthält den Zeitstempel
rg -n "snapshot:\$\{" local-engine/src/services/software-graph/_snapshots.ts
# erwartet: Treffer enthält capturedAt

npm run typecheck        # erwartet: exit 0
npm run test:run         # erwartet: exit 0
npm run golden-set       # erwartet: "golden-set: OK (...)"
npm run lint             # erwartet: exit 0
```

## Regeln für den Umsetzer

1. **Nur der beschriebene Scope.** Die Evolution-Bedienelemente gehören zu
   P0-3.
2. **Kein Test wird abgeschwächt.**
3. **Keine neuen Platzhalterwerte.** Ohne Git kein Commit — auch nicht
   `"unknown"` oder `"—"` in einem Feld, das ein Commit-Format erwartet.
4. **Keine repo-spezifischen Literale.**
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken.
