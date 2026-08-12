# VisuDEV Issue-Satz — Index

Stand: 2026-08-12
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md` · **Alle Issues tragen das Label `opus-fix`**
Grundlagen: Konzept-Mockups · Code-Bestandsaufnahme · Live-Ist-Zustand ·
Wahrheits-Audit browo-hr · Prior Art · Code-City-Recherche · UX-Recherche ·
Layout-Familien-Check über Test-Repos (Domänenzuerst vs. Schichtzuerst)

---

## Das Leitbild in einem Satz

> Gleiche Codebase. Unterschiedliche Perspektiven. **Jede Aussage belegbar.**

## Der Ist-Zustand in einem Satz

> Was der Analyzer aus dem Code **liest**, stimmt fast perfekt.
> Was er daraus **ableitet**, ist überwiegend unwahr.
> Was die UI davon **zeigt**, ist ein Zehntel — aufgefüllt mit erfundenen Zahlen.

---

## Belegte Ausgangslage (browo-hr, Enrichment OFF, SHA 24dd57cb)

| Behauptet | Grundwahrheit | Urteil |
|---|---|---|
| 372 Routen | 490 Registrierungen | alle 372 **echt**, Datei+Zeile+Methode 372/372 exakt; 118 fehlen |
| 127 Tabellen | 125 Prisma-Modelle + 17 Enums | 125/125 **korrekt**, Enums richtig ausgeschlossen; 2 Infra-Dienste falsch einsortiert |
| 2499 Knoten | 544 echte Entitäten | **1955 Duplikate**; nur 45 verschiedene Dateien |
| 2997 Kanten | ≥ 919 auflösbare Imports | **0 `imports`, 0 `calls`** — der Graph ist ein reiner Enthaltensein-Baum |
| 427 Findings | — | **199 von 200 `missing-auth` widerlegbar** |
| 483 Facts | 6204 intern extrahiert | **92 % verworfen** vor dem Export |
| 400 Dateien | 1706 Quelldateien | Frontend (1128 Dateien) **vollständig** unanalysiert |
| 2 Domains | 45 Fachmodule | Domänen-Erkennung nimmt das erste Pfadsegment |

---

## Reihenfolge und Abhängigkeiten

```
P0-5  CI ─────────────────────────┐  (Tor; ohne das hält nichts)
                                  │
Welle A — Wahrheit der Daten      ▼
  P0-6  Falsche Sicherheitsbefunde      ← gefährlichster Einzeldefekt
  P0-7  Knoten-Duplikate                ← blockiert P0-8 / P0-13
  P0-8  Fakten-Deckel (MAX_BLUEPRINT_FACTS)  ← Voraussetzung für P0-6
  P0-9  Import- und Aufruf-Kanten
  P0-11 Erfundener Commit-SHA           ← unabhängig parallel möglich
  P0-13 Segmentstreuung messen          ← nach P0-7; keine Domänen noch
  P0-10 Domänen aus Pfadstruktur        ← nach P0-13; nur path
  P0-14 Domänen aus Dateinamen          ← nach P0-10; Schichtzuerst
                                  │
Welle B — Ehrlichkeit der UI      ▼
  P0-1  Analyse-Umfang und Coverage
  P0-2  Erfundene Anzeigewerte
  P0-3  Tote Bedienelemente
  P0-4  Execution-Timings und Live-Badge
  P0-12 Confidence-Einheitenfehler       ← eine Zeile, hoher Symbolwert
                                  │
Welle C — Sichtbarkeit            ▼
  P1-1  Projektionslücke Dependencies
  P1-2  Architecture gruppiert nicht    ← braucht P0-10/P0-14
                                  │
Welle D — Verständlichkeit        ▼
  P1-3  Begriffsregister + Erklärschicht
  P1-4  Leerzustände
  P1-5  Verknüpfte Hervorhebung Graph ↔ Code
  P1-6  Atlas-Bildsprache
```

**Begründung der Reihenfolge:** P0-8 muss vor P0-6, weil die Auth-Regel ohne
die 402 unterdrückten `auth-check`-Fakten gar nicht richtig entscheiden kann.
P0-7 vor P0-8 und vor P0-13, weil Duplikate Budget und Streuungsmessung
verfälschen. Domänen sind dreigeteilt: erst messen (P0-13), dann Pfad
anwenden (P0-10), dann Dateinamen für schichtzuerst (P0-14) — eine feste
Namensliste wurde verworfen, weil sie nur bei browo-hr passt.
Welle B nach Welle A, weil es sinnlos ist, falsche Daten ehrlich zu beschriften.
Welle C nach A, weil man erst zeigen sollte, was stimmt.

---

## Welle A — Wahrheit der Daten

### P0-6 · Sicherheitsbefunde prüfen keinen Code

**Problem:** 199 von 200 `missing-auth`-Findings sind widerlegbar; jede dieser
Routen hat einen expliziten Guard im Aufruf. Arithmetischer Beweis: es gibt
genau 208 mutierende Routen und genau 208 `missing-validation`-Findings, eins
zu eins, und auf keiner der 164 GET-Routen feuert eine Regel. Die Findings sind
eine Umbenennung der HTTP-Methode.

**Ursache:** `shared/blueprint-graph-inference.ts:143-159` — `resolveAuthState`
gibt bei fehlender Evidenz für mutierende Methoden `"missing"` zurück statt
`"unknown"`. „Keine Daten" wird als „nicht vorhanden" behandelt.

**Lösung:** Ohne Evidenz gilt `unknown`, nie `missing`. Ein Befund entsteht nur
aus positiver Evidenz der Abwesenheit. Zusätzlich: `missing-validation` muss
die 148 `validation-deny-400`-Fakten auswerten. Bei 67 von 208 gemeldeten
Modulen existiert nachweislich Validierung.

**Warum das oberste Priorität hat:** Das Werkzeug behauptet, deine Anwendung
sei unsicher, wo sie es nicht ist. Für den Anwendungsfall „fremde Codebase
bewerten" ist das geschäftsschädigend.

**Abhängig von:** P0-8 (Fakten müssen erst durchkommen).

---

### P0-7 · 78 % der Knoten sind Duplikate

**Problem:** 1955 von 2499 Knoten sind Kopien. Nur 45 verschiedene Dateipfade;
`schema.prisma` erscheint 126-mal, `learning.routes.ts` 38-mal. Das
Knotenbudget `DEFAULT_LIMITS.maxNodes = 2500` reißt, `condensed` schaltet auf
`true`, und **101 echte Routen fallen weg** — `wiki.routes.ts`,
`workflows.routes.ts` und `permission.routes.ts` vollständig.

**Ursache:** `_ids.ts:31-42` hängt bei Kollision einen Zähler an
(`domain:backend~1`). `_file-context.ts:37-48` prüft danach auf **genau diese
frisch erzeugte, garantiert neue** ID — die Prüfung kann nie greifen.

**Lösung:** Container-Knoten (domain, layer, module) über ihren fachlichen
Schlüssel nachschlagen, nicht über eine unique-erzeugte ID. `stableUniqueId`
bleibt für echte Entitäten.

**Wirkung:** 1955 Knoten verschwinden, das Budget wird frei, die 101 Routen
kommen zurück.

---

### P0-8 · 92 % der Evidenz wird vor dem Export verworfen

**Problem:** Der Analyzer gewinnt intern 6204 Fakten aus 335 Dateien.
Exportiert werden 483 aus 32 Dateien. Die Security-Matrix hat dadurch für 340
von 372 Routen keine Fakten — deshalb greift die Fehlregel aus P0-6.

**Ursache:** `graph-export-cap.ts:13` — `MAX_BLUEPRINT_FACTS = 500`.

**Lösung:** Deckel deutlich anheben oder durch Relevanz-Priorisierung
ersetzen. Die bestehende Prisma-Schutzregel (`graph-export-cap.ts:41-73`)
funktioniert nachweislich und ist das Muster dafür. Auf jeden Fall muss das
Greifen des Deckels gemeldet werden, statt still zu schneiden.

**Wirkung:** Voraussetzung für P0-6, P0-9 und eine belastbare Security-Matrix.

---

### P0-9 · Null Import- und Aufruf-Kanten

**Problem:** 6422 `import`-Anweisungen im Repo, 1441 im Backend, davon 919
relativ auflösbar. Im Graphen: 0 `imports`, 0 `calls`. Der Graph ist
mathematisch exakt ein Baum — 2498 `contains` bei 2499 Knoten, eine Wurzel,
keine Querverbindung.

**Drei unabhängige Ursachen, alle drei müssen behoben werden:**

1. `fact-metadata-sanitizer.ts:7-18` — `ALLOWED_METADATA_KEYS` enthält weder
   `resolvedPath` noch `targetFile`. Alle 64 exportierten `ast-import`-Fakten
   haben `metadata: {}`. `_dependency-edges.ts:41-49` braucht genau diese
   Felder, die Kante kann strukturell nie entstehen.
2. `import-resolver.ts:3` — kennt das TypeScript-NodeNext-Mapping nicht.
   browo-hr schreibt `import … from './leaves.controller.js'` auf eine
   `.ts`-Datei; der Resolver sucht `leaves.controller.js.ts`. Messung: 975
   Bindungen gefunden, **2 aufgelöst**.
3. `ast-call-graph.ts:71-73` — verschluckt Parser-Fehler stumm. **95 von 394
   Dateien (24 %)** werden nie geparst, darunter `leaves.service.ts` und
   `auth.controller.ts`. Nach außen sehen sie abhängigkeitsfrei aus.

**Hinweis:** `MAX_FILES = 40` in `call-graph.builder.ts:12` ist **nicht**
schuld — es begrenzt nur `collectRelatedFiles`, das keine Kanten erzeugt.

**Aufwand:** klein. Zwei Einträge in einer Allowlist, eine Zeile im Resolver,
ein Logging-Zähler. Die Datentypen existieren auf beiden Seiten bereits.

---

### P0-13 · Segmentstreuung messen (Grundlage Domänen)

**Problem:** Ob ein Ordnername Domäne oder Schicht ist, kann man einer
Einzeldatei nicht ansehen. Feste Namenslisten (`backend`, `modules`,
`models` …) passen nur zu einem Layout und versagen bei discourse/mastodon/
immich (schichtzuerst) bzw. nicht-englischen Bäumen.

**Lösung:** Elternstreuung und Geschwisterzahl pro Segmentnamen über den
analysierten Dateibaum messen. Kalibrierung gegen alle Test-Repos.
Noch **keine** Domänen-Labels — nur Index + Schwellenkonstanten.

**Datei:** `P0-13-segmentstreuung-messen.md`

---

### P0-10 · Domänen aus der Pfadstruktur

**Problem:** 2 Domain-Labels (`backend` 499×, `deployment` 1×) und Modul
`modules` 372× statt 45 Fachmodule. `detectDomain` = erstes Pfadsegment.

**Lösung:** Streuungsindex aus P0-13 anwenden: erstes Domänen-Kandidaten-
Segment im Pfad. Keine STRUCTURAL/SURFACE/LAYER-Listen. Wenn nichts
qualifiziert → `unassigned` + `domainSource: "none"` (ehrlich für
schichtzuerst; P0-14 ergänzt danach).

**Abhängig von:** P0-7, P0-13.

**Datei:** `P0-10-domaenen-und-modul-erkennung.md`

---

### P0-14 · Domänen aus Dateinamen (schichtzuerst)

**Problem:** Nach P0-10 bleiben Rails-/Nest-Bäume ohne Pfad-Domäne. Die
Fachlichkeit steckt in `topic.rb` / `album.service.ts`.

**Lösung:** Dateinamen-Stamm nur dann Domäne, wenn er in ≥ 2 Schichten
(`detectLayer`) vorkommt. `domainSource: "filename"`. Pfad-Domänen nie
überschreiben.

**Abhängig von:** P0-13, P0-10.

**Datei:** `P0-14-domaenen-aus-dateinamen.md`

---

### P0-11 · Erfundener Commit-SHA und Snapshot-Kollision

**Problem:** `blueprint-local.js:397-399` erzeugt den „Commit" als SHA256 des
**Ordnerpfads**, gekürzt auf 12 Zeichen — sieht aus wie ein Git-Commit. Über
`analysis.service.ts:595-605` landet er in `ref`, `commitSha` und `label` des
Snapshots und im Log als „Analyzed commit: …". Da der Pfad konstant ist, bildet
`_snapshots.ts:23` bei jedem Scan dieselbe Snapshot-ID (`snapshot:${commitSha}`)
— lokale Scans überschreiben sich gegenseitig statt eine Timeline zu bilden.

**Lösung:** Echten Git-Commit verwenden (`git-summary.ts` liest ihn bereits).
Ohne Git-Repository kein SHA anzeigen, sondern Zeitstempel — und die
Snapshot-ID darauf gründen, damit die Timeline wächst.

---

## Welle B — Ehrlichkeit der UI

### P0-1 · Analyse-Umfang und Coverage

Zwei Limits, beide unsichtbar: `FILE_LIMIT = 400`
(`blueprint-local.js:36`) und das Knotenbudget aus P0-7. Der Graph meldet
korrekt `condensed: true` und `nodeCount: 4538` als *versucht* — die UI wertet
es nicht aus. Die Coverage-Heuristik `modulesFromNodes / nodes.length`
(`atlas-stats.ts:35-41`) ist zudem invers: je schlechter die Analyse, desto
höher der Wert.

### P0-2 · Erfundene Anzeigewerte

Vollständige Liste aus dem Live-Ist-Zustand: Region „eu-central-1 Frankfurt",
Umgebung „Produktion/Staging", Uptime „99,5 %" (`build-topology.ts:148`,
`InfrastructureInspector.tsx:35`), CPU/RAM/Netz 42/68/31/24
(`infrastructure-resource-meters.ts:7-12`), Tech-Chips aus Namenstabelle
(`atlas-cluster-profiles.ts:6-27`), Footer „Keine kritischen Probleme"
(`BlueprintFooterStatusBar.tsx:39-42`) trotz 19 High-Findings.

**Neu aus dem Wahrheits-Audit:** „Web App" und „RUNNING" existieren **nicht in
den Daten**. `InfrastructureServiceCard.tsx:7-14` bildet `kind: file` auf das
Label „Web App" ab, und Zeile 40 setzt `<StatusBadge variant="running"
label="RUNNING" />` bedingungslos für jeden Knoten.

### P0-3 · Tote Bedienelemente

Evolution „Branch Compare" und „Working Tree" ohne Wirkung
(`evolution-tabs.ts:5-10`, `EvolutionView.tsx:30,77`), drei von vier
Diagnostics-Untertabs sind Platzhalter (`DiagnosticsView.tsx:155-182`),
Infrastruktur-Umschalter „Physische Topologie" wird nicht gelesen
(`InfrastructureView.tsx:35,100`). Working Tree wird verdrahtet, der Rest
entfernt.

### P0-4 · Execution-Timings und Live-Badge

`_projection.ts:193-198` — Fallback `(index + 1) * 12`. Bei realen Scans ist
`durationMs` nie gesetzt, der Fallback ist also der Normalfall. Das LIVE-Badge
leitet Laufzeit aus statischen Metadaten ab (`_projection.ts:286-312`).
`_projection.test.ts:176-188` schreibt dieses Verhalten als Spezifikation fest
und wird gelöscht.

### P0-12 · Confidence wird durch 100 geteilt

`FindingInspector.tsx:61` rendert „0,6 %" statt „60 %". Eine Zeile, aber
betroffen ist genau die Kennzahl, die das Konzept zum Kern erklärt.

---

## Welle C — Sichtbarkeit

### P1-1 · Dependencies zeigt ein Zehntel des Graphen

254 von 2499 Knoten, 127 von 2997 Kanten. Nur `data`-Kanten kommen an; 372
`references` und 2498 `contains` fallen weg. Sieben von acht Beziehungstyp-Chips
sind leer, während der Footer „372 Abhängigkeiten" behauptet.

### P1-2 · Architecture gruppiert nicht

Ein Knoten pro Datei statt Gruppierung — „DOMAIN backend" 499-mal. Hängt an
P0-7 (Duplikate), P0-10 (Pfad-Domänen) und P0-14 (Dateinamen für
schichtzuerst); ohne echte Domänen gibt es nichts zu gruppieren.

---

## Welle D — Verständlichkeit

Gilt querschnittlich, siehe Abschnitt 13 der Vorlage.

### P1-3 · Begriffsregister und Erklärschicht

Kein fertiger Datensatz einbindbar: Wappalyzer-Nachfolger GPL-3.0, MDN und
Stack Overflow CC BY-SA, CNCF-Beschreibungen Crunchbase-belastet. Nur
Simple Icons (CC0) ist übernehmbar. Rund 150 eigene Einträge als getippte
TypeScript-Module unter `src/lib/glossary/`, drei Ebenen (Tooltip · HoverCard
mit „warum in diesem Projekt" · Panel). Radix HoverCard und Popover sind
bereits Dependencies.

**Durchsetzung:** CI-Test, der den Analyzer über die Test-Repos laufen lässt,
alle Technologie- und Knotentyp-Labels einsammelt und rot wird, wenn eines
keinen Glossareintrag hat. Damit ist Erklärbarkeit eine Pipeline-Eigenschaft.

### P1-4 · Leerzustände

Sieben Zustände nach Vorlage 13.1, jeder mit Grund. `nothing-found` nennt die
gesuchten Muster. Gedimmte Geisterversion statt Illustration. **Keine
Beispieldaten** — in einem Analysewerkzeug hält der Nutzer die Attrappe für
seinen Befund.

### P1-5 · Verknüpfte Hervorhebung Graph ↔ Code

Keine fertige React-Bibliothek vorhanden. Shiki mit
`transformerMetaHighlight` und `transformerNotationFocus`, dazu **ein**
Fokus-Zustand mit `origin`-Feld, das die Rückkopplung zwischen den Panels
bricht, und die URL als Serialisierung. `useGraphCanvasNodeHighlight.ts` setzt
bereits eine `selected`-Klasse und ist der Ansatzpunkt.

### P1-6 · Atlas-Bildsprache

**Vier Kanäle, zwei bewusst frei:**

| Kanal | Information |
|---|---|
| Ort / Distrikt | Zugehörigkeit (Domain → Layer), mit Fallback-Kaskade |
| Höhe, 5 Klassen | Fan-in — „wie viele benutzen das?" |
| Grundfläche, 3 Klassen | Umfang (Zeilen) |
| Farbton + Silhouette | Rolle: Oberfläche · Logik · Daten · Zugang · Fremdsystem |
| Findings | additives Overlay (Dachschild + Bodenring), **nie** Fassadenfarbe |
| Sättigung / Helligkeit / Animation | **nichts** — gehört Shading und UI-Zustand |

Grau bedeutet ausschließlich „keine Daten". Container werden Distriktplatten,
keine Gebäude. Alle Größen quantisiert, nicht proportional. Label-Budget von
~20 Textelementen mit Prioritätsordnung und Einblend-Hysterese.
Sprache bekommt keinen eigenen Kanal, sondern einen Umschalter.

**Ursache des heutigen Graus:** `atlas-cluster-theme.ts` matcht hartkodierte
deutsche Cluster-Namen (`"WEB APP"`, `"DATEN"`), die in echten Projekten nicht
vorkommen; `KIND_HEIGHT` gibt allen Dateien dieselbe Höhe.

**Marktbefund:** Sourcetrail archiviert, CodeSee verschwunden, Structure101 in
Sonar aufgegangen — überlebt haben 2D-Karten. Der 2D-Atlas, die Findings-Liste
und die Suche sind deshalb gleichrangig, nicht nachrangig.

---

## Prozessregeln (gelten für jedes Issue)

1. Kein Schließen bei PARTIAL. Abnahme auf echtem Repo mit Enrichment OFF.
2. Keine repo-spezifischen Literale im Produktcode.
3. Keine Platzhalterwerte — stattdessen ein begründeter Leerzustand.
4. Kein Test wird abgeschwächt, um ihn grün zu bekommen.
5. Issues entlang der Beweiskette schneiden, nicht entlang der Schichten.
6. Rote CI ist ein Blocker, kein Hinweis.
