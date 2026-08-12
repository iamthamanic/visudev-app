# P0-7 — 78 % der Knoten sind Duplikate, und dadurch fallen 101 echte Routen weg

Label: `opus-fix`
Phase: 0, Welle A · Keine Abhängigkeiten · **Blockiert P0-8**
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Der Software-Graph ist die gemeinsame Datenbasis aller sieben
Blueprint-Ansichten. Atlas gruppiert nach ihm, Architecture zeichnet ihn,
Dependencies projiziert ihn, Diagnostics leitet Befunde aus ihm ab. Ein Defekt
in der Knotenerzeugung wirkt sich deshalb auf jede Ansicht gleichzeitig aus.

Der Graph hat ein hartes Budget: `DEFAULT_LIMITS.maxNodes = 2500`. Wird es
überschritten, setzt der Builder `condensed: true` und verwirft Knoten. Das
Budget existiert aus einem guten Grund — der Browser muss den Graphen rendern.

Ein Wahrheits-Audit gegen `browo-hr` (SHA `24dd57cb`, Enrichment aus) hat den
ausgegebenen Graphen Knoten für Knoten gegen den Quellcode gehalten.

## 2. Problem

**1955 von 2499 Knoten sind Kopien.** Es gibt nur **544 echte Entitäten** und
nur **45 verschiedene Dateipfade** im gesamten Graphen. `schema.prisma`
erscheint 126-mal als eigener Knoten, `learning.routes.ts` 38-mal.

Die Folge ist nicht kosmetisch. Die Duplikate verbrauchen 78 % des
Knotenbudgets. Der Builder reißt die Grenze von 2500, schaltet auf
`condensed: true` und wirft echte Knoten weg. **101 tatsächlich existierende
Routen fallen dabei aus dem Graphen** — `wiki.routes.ts`,
`workflows.routes.ts` und `permission.routes.ts` fehlen vollständig, obwohl
der Analyzer sie korrekt gelesen hatte.

Das erklärt zugleich, warum die Architecture-Ansicht „DOMAIN backend" 499-mal
untereinander zeigt: Es sind wirklich 499 getrennte Domänen-Knoten.

### Die verursachende Stelle

`stableUniqueId` registriert eine ID **unbedingt**, auch wenn sie schon
vergeben war — dann eben unter einem neuen Namen mit Zähler-Suffix:

```31:43:local-engine/src/services/software-graph/_ids.ts
  if (!set.has(id)) {
    set.add(id);
    return id;
  }
  let counter = 1;
  let candidate = suffix(id, counter);
  while (set.has(candidate)) {
    counter += 1;
    candidate = suffix(id, counter);
  }
  set.add(candidate);
  return candidate;
```

Für echte Entitäten ist das richtig — zwei gleichnamige Funktionen in
verschiedenen Dateien sollen zwei Knoten sein.

`ensureFileContext` verwendet dieselbe Funktion aber für **Container**, die
per Definition geteilt werden sollen:

```37:44:local-engine/src/services/software-graph/_file-context.ts
  const domainId = stableUniqueId(state.registry, "scope", `domain:${domain}`);
  const layerId = stableUniqueId(state.registry, "scope", `layer:${domain}:${layerName}`);
  const moduleId = stableUniqueId(
    state.registry,
    "scope",
    `module:${domain}:${layerName}:${moduleName}`,
  );
  const fileId = stableUniqueId(state.registry, "scope", `file:${normalizePath(filePath)}`);
```

Direkt darunter steht die Prüfung, die das eigentlich verhindern sollte:

```46:48:local-engine/src/services/software-graph/_file-context.ts
  if (!state.scopes.has(domainId)) {
    addScope(state, createDomainScope(domain, projectId));
    addNode(state, { id: domainId, kind: "domain", label: domain, scopeId: appId, metadata: {} });
```

**Diese Prüfung kann strukturell nie greifen.** `domainId` ist bei jedem Aufruf
nach dem ersten eine **frisch erzeugte, garantiert noch nie verwendete** ID.
`state.scopes.has()` liefert deshalb immer `false`.

### Der Ablauf im Detail

| Aufruf | `stableUniqueId` liefert | `state.scopes.has(...)` | Ergebnis |
|---|---|---|---|
| 1. Datei | `domain:backend` | `false` | Scope `domain:backend` + Knoten `domain:backend` |
| 2. Datei | `domain:backend~1` | `false` | Scope `domain:backend` erneut + Knoten `domain:backend~1` |
| 3. Datei | `domain:backend~2` | `false` | Scope erneut + Knoten `domain:backend~2` |
| … | … | `false` | … |

Bei 499 verarbeiteten Dateien entstehen 499 Domänen-Knoten, 499
Schicht-Knoten und rund 499 Modul-Knoten. Zusammen etwa 1497 — plus die
Datei-Duplikate ergibt das die beobachteten 1955.

### Ein zweiter Schaden: der Scope-Baum ist zerrissen

`createDomainScope` erzeugt den Scope immer unter der **schlichten** ID:

```21:23:local-engine/src/services/software-graph/_scopes.ts
export function createDomainScope(domain: string, projectId: string): SoftwareGraphScope {
  return { level: "domain", id: `domain:${domain}`, label: domain, parentId: `app:${projectId}` };
}
```

Der Knoten bekommt dagegen `domain:backend~1`. Damit zeigt `node.scopeId` auf
eine Scope-ID, die nie registriert wurde. Dasselbe gilt für
`createFileScope(filePath, moduleId)` in Zeile 95, das den Suffix-behafteten
`moduleId` als `parentId` einträgt.

Jede Auswertung, die über `scopeId` gruppiert, findet deshalb für die meisten
Knoten keinen Elternteil. Das ist eine weitere Ursache dafür, dass die
Architecture-Ansicht nicht gruppiert.

### Auswirkung

- Architecture zeigt 499 identische „DOMAIN backend"-Kästen statt einer
  Gruppierung.
- Atlas kann keine Distrikte bilden, weil die Zugehörigkeit über kaputte
  `scopeId`-Verweise läuft.
- 101 echte Routen sind unsichtbar, obwohl korrekt extrahiert.
- Jede Knotenzahl im UI („2499 Knoten") ist um Faktor 4,6 aufgebläht.
- Das Knotenbudget ist zu 78 % mit Müll belegt, weshalb jede Erweiterung des
  Analyse-Umfangs sofort wieder abgeschnitten würde.

## 3. Lösung

**Container-Knoten werden über ihren fachlichen Schlüssel nachgeschlagen, nicht
über eine unique-erzeugte ID.**

Domäne, Schicht, Modul und Datei sind durch ihren Namen beziehungsweise Pfad
eindeutig bestimmt. Ihre IDs sind deterministisch und sollen es bleiben. Für
sie darf `stableUniqueId` nicht verwendet werden; stattdessen wird die
deterministische ID direkt gebildet und die bestehende
`state.scopes.has(...)`-Prüfung entscheidet, ob der Knoten neu angelegt wird.

`stableUniqueId` bleibt unverändert und weiterhin zuständig für echte
Entitäten — Funktionen, Routen, Komponenten —, wo Namenskollisionen legitim
sind.

Die deterministischen IDs müssen zusätzlich im `registry.nodes`-Set vermerkt
werden, damit andere Knotenerzeuger nicht versehentlich dieselbe ID belegen.

**Verworfene Alternative: `stableUniqueId` global so ändern, dass sie
bestehende IDs zurückgibt.** Das würde echte Entitäten mit gleichem Namen
stillschweigend zusammenlegen und wäre ein schwerer Datenverlust an anderer
Stelle.

**Verworfene Alternative: Duplikate nachträglich zusammenführen.** Ein
Aufräumschritt hinter der Erzeugung kaschiert die Ursache, kostet Laufzeit und
lässt die zerrissenen `scopeId`-Verweise bestehen.

**Verworfene Alternative: das Knotenbudget erhöhen.** Das Budget ist nicht das
Problem; 544 echte Entitäten passen mühelos hinein.

## 4. Architektur

Die Änderung liegt vollständig im Node-seitigen Graph-Builder. Deno ist nicht
betroffen. Es gibt keine Schnittstellenänderung nach außen — die ausgegebenen
Knoten-IDs werden lediglich korrekt statt suffigiert.

| Schicht | Datei | Änderung |
|---|---|---|
| Node, Graph-Builder | `_file-context.ts` | Deterministische IDs statt `stableUniqueId` |
| Node, Graph-Builder | `_ids.ts` | Neue Hilfsfunktion zum Registrieren einer bekannten ID |

**Wichtig:** Die IDs im Ausgabegraphen ändern sich (`domain:backend~1`
verschwindet). Snapshots und gespeicherte Auswahlzustände, die alte IDs
enthalten, laufen ins Leere. Das ist hinzunehmen — die alten IDs waren nicht
stabil, sie hingen von der Verarbeitungsreihenfolge der Dateien ab.

## 5. Edge Cases

- **Zwei Domänen mit gleichem Namen aus unterschiedlichen Quellen**: Nach
  Definition dieselbe Domäne. Zusammenlegen ist korrekt.
- **Ein Modulname kommt in zwei Domänen vor** (`auth` in `backend` und
  `frontend`): Die ID enthält bereits Domäne und Schicht
  (`module:backend:api:auth`), also getrennt. Kein Sonderfall.
- **Dateipfad mit Sonderzeichen**: `normalizePath` behandelt das bereits;
  Verhalten unverändert.
- **Derselbe Dateipfad in unterschiedlicher Schreibweise** (Groß/Klein auf
  macOS): Ergibt zwei Knoten. Bestehendes Verhalten, außerhalb dieses Issues.
  Im PR unter „Beobachtet, nicht behoben" vermerken.
- **Kollision zwischen einer Container-ID und einer Entitäts-ID**: Eine Funktion
  mit dem Namen `domain:backend` ist praktisch ausgeschlossen, da Entitäts-IDs
  andere Präfixe tragen. Durch das Registrieren im `nodes`-Set abgesichert.
- **Leerer Domänenname** (`detectDomain` liefert `""`): Ergibt die ID
  `domain:`. Muss auf einen expliziten Platzhalter abgebildet werden, damit
  nicht alle namenlosen Dateien in einem stummen Sammelbecken landen. Der
  Platzhalter muss im UI als „nicht zugeordnet" erkennbar sein — nicht als
  Domäne mit leerem Namen.
- **Enrichment ON**: Der Demo-Graph durchläuft denselben Builder nicht. Keine
  Auswirkung erwartet; falls Demo-Tests brechen, ist das ein Hinweis auf eine
  weitere Abhängigkeit und im PR zu begründen.

## 6. User Journey

**Vorher:** Der Nutzer öffnet Architecture für browo-hr und scrollt durch
499 identische Kästen „DOMAIN backend". Er sucht eine Route aus
`wiki.routes.ts` und findet sie nicht, obwohl sie existiert. Der Footer meldet
2499 Knoten — eine Zahl, die zu nichts passt, was er sieht.

**Nachher:** Er sieht eine Domäne mit ihren Schichten und Modulen. Die
Knotenzahl entspricht dem, was tatsächlich im Projekt existiert. Die zuvor
verschluckten Routen sind da.

## 7. Akzeptanzkriterien

- [ ] **Enrichment OFF auf browo-hr:** Keine Knoten-ID im Ausgabegraphen
      enthält das Zeichen `~`.
- [ ] **Enrichment OFF auf browo-hr:** Es existiert genau **ein** Knoten mit
      `kind: "domain"` pro erkannter Domäne. Bei unverändertem `_heuristics.ts`
      sind das zwei Knoten (`backend`, `deployment`).
- [ ] **Enrichment OFF auf browo-hr:** Es existiert höchstens ein Knoten pro
      Dateipfad, geprüft über `kind === "file"`.
- [ ] **Enrichment OFF auf browo-hr:** `graph.nodes.length` liegt unter 1000.
      Vorher: 2499.
- [ ] **Enrichment OFF auf browo-hr:** `condensed` ist `false`.
- [ ] **Enrichment OFF auf browo-hr:** Routen aus `wiki.routes.ts`,
      `workflows.routes.ts` und `permission.routes.ts` sind im Graphen
      vorhanden.
- [ ] **Enrichment OFF auf browo-hr:** Für jeden Knoten mit gesetzter `scopeId`
      existiert ein Scope mit dieser ID in `graph.scopes`.
- [ ] Die Anzahl der Routen-Knoten steigt gegenüber dem Vorher-Zustand. Sie darf
      nicht sinken.
- [ ] `stableUniqueId` in `_ids.ts` ist unverändert.

## 8. Tests

**Neu** in `local-engine/src/services/software-graph/_file-context.test.ts`
(Datei anlegen, falls nicht vorhanden):

- `"same domain across many files yields exactly one domain node"` — 50
  Dateipfade unter `backend/`, danach genau ein Knoten mit `kind: "domain"`.
- `"same file path called twice yields one file node"` — `ensureFileContext`
  zweimal mit identischem Pfad, danach ein Knoten mit `kind: "file"`.
- `"returned ids contain no tilde suffix"`.
- `"node scopeId always resolves to a registered scope"` — nach 50 Aufrufen für
  jeden erzeugten Knoten prüfen, dass `state.scopes.has(node.scopeId)` gilt.
- `"different domains yield different domain nodes"` — Gegenprobe, damit nicht
  versehentlich alles zusammengelegt wird.
- `"module with same name in two domains stays separate"`.

**Neu** im Golden-Set-Job aus P0-5: Kennzahl `duplicateNodeIds` mit `max: 0`,
gemessen als Anzahl der Knoten-IDs, die `~` enthalten.

**Anzupassen:** Bestehende Graph-Builder-Tests, die Knotenzahlen fest
zusichern. Die Zahlen sinken erwartungsgemäß.

**Zu löschen:** Jeder Test, der eine ID mit `~`-Suffix als korrektes Ergebnis
zusichert. Einzeln im PR begründen.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run test:run -- software-graph
npm run golden-set
```

Vollständiger Lauf gegen browo-hr mit Enrichment OFF. Der PR enthält:

1. `graph.nodes.length` vorher (2499) und nachher.
2. Anzahl Knoten mit `~` in der ID vorher und nachher (erwartet: 1955 → 0).
3. Anzahl Routen-Knoten vorher und nachher.
4. `condensed` vorher (`true`) und nachher (erwartet `false`).
5. Screenshot der Architecture-Ansicht vorher und nachher.

Zusätzlich mindestens zwei weitere Test-Repos aus `visudev-test-repos/`
gegenprüfen, damit die Änderung nicht nur für browo-hr passt.
`visudev-test-repos/evidence/REAL-PROJECTS-SUMMARY.md` aktualisieren.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei | Was passiert |
|---|---|
| `local-engine/src/services/software-graph/_file-context.ts` | Deterministische IDs statt `stableUniqueId` für alle vier Container |
| `local-engine/src/services/software-graph/_ids.ts` | Neue Funktion `registerKnownId` ergänzen. `stableUniqueId` bleibt unverändert |
| `scripts/golden-set/run.mjs` | Kennzahl `duplicateNodeIds` |
| `tests/fixtures/golden-repo/expected-metrics.json` | `duplicateNodeIds` mit `max: 0` |

### Neu anzulegen

| Datei | Zweck |
|---|---|
| `local-engine/src/services/software-graph/_file-context.test.ts` | Tests aus Abschnitt 8, falls die Datei noch nicht existiert |

### Nicht anfassen

| Datei / Bereich | Grund |
|---|---|
| `_heuristics.ts` | Dass es nur zwei Domänen gibt, ist P0-10. Dieses Issue behebt die Vervielfachung, nicht die Erkennung |
| `_scopes.ts` | Die Scope-Fabriken sind korrekt. Der Fehler liegt bei den Aufrufern |
| Die Funktion `stableUniqueId` selbst | Sie ist für echte Entitäten richtig |
| `graph-export-cap.ts` | Der Fakten-Deckel ist P0-8 |
| Alles unter `src/modules/blueprint/` | Die Änderung wirkt allein über die Daten |

## 11. Umsetzungsschritte

**Schritt 1 — Hilfsfunktion ergänzen.**
In `_ids.ts` unterhalb von `stableUniqueId` die Funktion `registerKnownId` nach
Abschnitt 12.1 hinzufügen. Sie trägt eine bekannte, deterministische ID in die
Registry ein und meldet zurück, ob sie neu war.

**Schritt 2 — IDs deterministisch bilden.**
In `_file-context.ts` die Zeilen 37-44 ersetzen. Die vier IDs werden direkt
gebildet, mit exakt denselben Zeichenketten, die die Scope-Fabriken in
`_scopes.ts` verwenden — sonst zerreißt der Scope-Baum erneut. Die exakten
Ausdrücke stehen in Abschnitt 12.2.

**Schritt 3 — IDs registrieren.**
Innerhalb der vier `if (!state.scopes.has(...))`-Blöcke, direkt vor `addNode`,
die ID über `registerKnownId(state.registry, "node", id)` eintragen. Damit
kann kein anderer Erzeuger dieselbe ID belegen.

Die `if`-Bedingungen selbst bleiben unverändert. Sie funktionieren, sobald die
IDs deterministisch sind.

**Schritt 4 — Leeren Domänennamen absichern.**
Falls `detectDomain` eine leere Zeichenkette liefert, den Platzhalter aus
Abschnitt 12.3 verwenden.

**Schritt 5 — Tests schreiben** nach Abschnitt 8.

**Schritt 6 — Golden-Set-Kennzahl ergänzen.**

**Schritt 7 — Gegen browo-hr und zwei weitere Repos laufen lassen**, Zahlen
für den PR dokumentieren.

## 12. Exakte Vorgaben

### 12.1 Neue Funktion in `_ids.ts`

```ts
/**
 * Registers a deterministic id that must not be renamed on collision.
 * Returns true when the id was newly registered.
 */
export function registerKnownId(
  registry: IdRegistry,
  kind: "node" | "edge" | "scope" | "evidence",
  id: string,
): boolean {
  const set =
    kind === "node"
      ? registry.nodes
      : kind === "edge"
        ? registry.edges
        : kind === "scope"
          ? registry.scopes
          : registry.evidence;
  if (set.has(id)) return false;
  set.add(id);
  return true;
}
```

### 12.2 Ersatz für `_file-context.ts` Zeile 37-44

```ts
const domainId = `domain:${domain}`;
const layerId = `layer:${domain}:${layerName}`;
const moduleId = `module:${domain}:${layerName}:${moduleName}`;
const fileId = `file:${normalizePath(filePath)}`;
```

Diese vier Zeichenketten müssen **zeichengenau** denen in `_scopes.ts`
entsprechen: Zeile 22, 28, 41 und 50. Weicht auch nur eine ab, zeigen die
Knoten wieder auf nicht existierende Scopes.

### 12.3 Platzhalter für fehlende Zuordnung

```ts
const UNASSIGNED = "unassigned";
```

Verwendet, wenn `detectDomain`, `detectLayer` oder `detectModule` eine leere
Zeichenkette liefert. Das UI-Label lautet `Nicht zugeordnet`, nicht
`unassigned` und nicht `Sonstige`.

### 12.4 Golden-Set-Kennzahl

```json
"duplicateNodeIds": { "measured": 0, "max": 0 }
```

Gemessen als `graph.nodes.filter(n => n.id.includes("~")).length`.

## 13. Verständlichkeit

Dieses Issue ändert keine sichtbaren Texte. Zwei Punkte gelten trotzdem:

**Leerzustand:** Wenn nach der Korrektur eine Ansicht leer wirkt, weil vorher
nur Duplikate darin standen, muss der zuständige Leerzustand nach Vorlage 13.1
greifen und den Grund nennen. Ein leerer Bereich ohne Erklärung ist kein
zulässiges Ergebnis dieses Issues.

**Nicht zugeordnet:** Der Platzhalter aus 12.3 darf nicht stumm bleiben. Wenn
Knoten dort landen, muss die Ansicht das mit Anzahl ausweisen — nach der
Code-City-Empfehlung als eigener Distrikt am Stadtrand mit Zähler im Label,
nicht im Zentrum und nicht unbeschriftet.

**Nachweis:** Screenshot der Architecture-Ansicht vorher und nachher.

## 14. Häufige Fehlannahmen

**„Ich mache `stableUniqueId` so, dass sie vorhandene IDs zurückgibt — das
löst es überall auf einmal."**
Nein, und das ist der gefährlichste Irrweg hier. Die Funktion wird auch für
echte Entitäten verwendet, bei denen zwei gleichnamige Elemente zwei Knoten
bleiben müssen. Eine globale Änderung würde stillschweigend echte Daten
zusammenlegen. `stableUniqueId` bleibt Zeichen für Zeichen unverändert.

**„Weniger Knoten heißt weniger Information."**
Das Gegenteil ist der Fall. Die verschwindenden Knoten sind Kopien; im
freiwerdenden Budget kommen 101 echte Routen zurück. Der Graph enthält nach der
Änderung mehr Information bei weniger Knoten.

**„Ich baue einen Dedup-Schritt am Ende des Builders."**
Nein. Das kaschiert die Ursache, kostet Laufzeit, und die zerrissenen
`scopeId`-Verweise blieben bestehen — die sind der zweite, weniger sichtbare
Teil des Schadens.

**„Ich sollte gleich `detectDomain` mitreparieren, damit endlich echte Domänen
erscheinen."**
Nein. Das ist P0-10 und wird getrennt abgenommen. Wer beides in einem PR
vermischt, kann nicht mehr zeigen, welche Änderung welche Wirkung hatte — und
genau das war einer der Prozessfehler, die zu diesem Zustand geführt haben.

**„Die IDs ändern sich, das ist ein Breaking Change, ich brauche eine
Migration."**
Die alten IDs hingen von der Reihenfolge der Dateiverarbeitung ab und waren
zwischen zwei Läufen nicht stabil. Es gibt nichts zu migrieren. Falls
gespeicherte Auswahlzustände ins Leere laufen, ist das die Korrektur eines
Defekts, nicht ein neuer.

**„Die `if (!state.scopes.has(...))`-Prüfungen sind falsch und müssen weg."**
Nein. Sie sind richtig und werden durch die deterministischen IDs erstmals
wirksam. Sie bleiben unverändert stehen.

**„`condensed: true` ist doch ein normaler Zustand für große Projekte."**
Bei browo-hr mit 544 echten Entitäten und einem Budget von 2500 ist es das
nicht. Wenn `condensed` nach der Änderung immer noch `true` ist, ist die
Umsetzung unvollständig.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma

# stableUniqueId ist unverändert
git diff local-engine/src/services/software-graph/_ids.ts | rg "^-" | rg -v "^---"
# erwartet: keine gelöschten Zeilen (nur Ergänzungen)

# Keine Suffix-IDs mehr in _file-context.ts
rg -n "stableUniqueId" local-engine/src/services/software-graph/_file-context.ts
# erwartet: nur noch Treffer in Kanten-IDs, keine für domain/layer/module/file

npm run typecheck        # erwartet: exit 0
npm run test:run         # erwartet: exit 0
npm run golden-set       # erwartet: "golden-set: OK (...)"
npm run lint             # erwartet: exit 0
```

Zusätzlich manuell gegen browo-hr, Enrichment OFF:

```
graph.nodes.filter(n => n.id.includes("~")).length   → erwartet 0
graph.nodes.length                                    → erwartet < 1000
graph.condensed                                       → erwartet false
graph.nodes.filter(n => n.kind === "domain").length   → erwartet 2
```

## Regeln für den Umsetzer

1. **Nur der beschriebene Scope.** Angrenzende Fehler im PR unter „Beobachtet,
   nicht behoben" notieren.
2. **Kein Test wird abgeschwächt, um ihn grün zu bekommen.** Sinkende
   Knotenzahlen in bestehenden Zusicherungen werden angepasst und einzeln
   begründet.
3. **Keine neuen Platzhalterwerte.** Der Platzhalter aus 12.3 ist die einzige
   Ausnahme und muss im UI sichtbar als „nicht zugeordnet" erscheinen.
4. **Keine repo-spezifischen Literale.** Kein Sonderfall für `backend/`.
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken.
