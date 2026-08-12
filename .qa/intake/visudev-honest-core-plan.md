# VisuDEV — Honest Core Plan

Status: Intake / verbindlich
Datum: 2026-08-11
Grundlage: Konzept-Mockups (2025) + Code-Bestandsaufnahme + Prior-Art-Recherche

---

## 1. Produktkern (bestätigt durch den Nutzer)

> Gleiche Codebase. Unterschiedliche Perspektiven.

Der Wert von VisuDEV liegt **nicht** in der Visualisierung, sondern in der
**Nachweisbarkeit**: Jede angezeigte Behauptung muss bis auf Datei und Zeile
prüfbar sein. Ein Diagramm, dem man nicht trauen kann, kostet mehr Zeit als es
spart, weil jede Aussage manuell gegengeprüft werden muss.

### Zielbild-Zitat aus dem Original-Mockup

- „Lückenlos — jede Verbindung mit Nachweis (Code oder Runtime)"
- Inspector: Datei + Zeilen, Commit + Branch, Beziehungsart,
  statisch-vs-beobachtet, Belege, Confidence, ein-/ausgehende Abhängigkeiten,
  Öffnen in GitHub/Editor

---

## 2. Anwendungsfälle (alle fünf bestätigt)

| Use Case | Anforderung an den Graphen |
|---|---|
| Eigenes gewachsenes Projekt wieder verstehen | vollständig + navigierbar über Ebenen |
| Blast Radius vor einer Änderung | kantenkorrekt + Provenance |
| Karte für Agenten/LLM statt blindem Suchen | maschinenlesbar + Confidence |
| Fremde Codebase bewerten (Audit/Übernahme) | stackbreit (nicht nur TS/JS) |
| System jemandem zeigen | ehrlich (keine Attrappen) |

**Konsequenz:** Alle fünf konsumieren dasselbe Artefakt. Es gibt keinen
Zielkonflikt. Der Graph ist das Produkt; die sieben Blueprint-Views sind Linsen.

---

## 3. Kernproblem des Ist-Zustands

> Die App unterscheidet nicht zwischen „das weiß ich" und
> „das sieht aus, als wüsste ich es".

Fehlende Daten sind von vorhandenen Daten nicht unterscheidbar. Das ist
schädlicher als fehlende Features, weil es die Vertrauensschleife bricht.

### Ursachenkette (drei Ebenen desselben Fehlers)

1. **Demo-Seed als Spezifikation** — UI wurde gegen `demo-graph-seed.ts`
   entwickelt; CI baute mit Demo-Enrichment und testete damit den Demo statt
   den Analyzer.
2. **Repo-spezifische Regex-Leiter** — `graph/call-graph.builder.ts` priorisiert
   Dateien über einkompilierte Literale (`/apps/meteor/server` → 87,
   `/leaves/` → +12). Jedes neue Zielrepo kostete eine weitere Regel.
3. **Mockups als Bilder umgesetzt** — wo der Analyzer nichts liefern konnte,
   wurde die Zahl aus dem Mockup einkompiliert, damit der Screen vollständig
   aussieht.

### Datenverlust in der Pipeline

Deno erzeugt einen reichen `VisuDevGraph` (Evidence, Findings, SecurityMatrix,
Pipeline, Concepts). `local-engine/src/providers/legacy-visudev-analysis.provider.ts`
reduziert ihn auf `RawBlueprintScan` (nur routes + facts), ersetzt stabile
Deno-Scope-IDs durch Positionsindizes (`legacy-route-${index+1}`), und Node baut
daraus einen zweiten, ärmeren Graphen neu. `shared/blueprint-graph-routes.ts`
setzt dabei `pipeline: []`.

**Folge:** Der Inspector kann die Konzept-Felder nicht zeigen, weil die Daten
drei Schichten vorher gelöscht wurden.

---

## 4. Attrappen-Register (Phase-0-Arbeitsliste)

Belegt durch Code-Bestandsaufnahme. Alle Einträge: UI existiert, Datenanbindung
fehlt.

| Ort | Beweis | Problem |
|---|---|---|
| Infrastruktur-Ressourcen-Meter | `infrastructure-resource-meters.ts:2-11` | Feste Werte 42/68/31/24 |
| Infrastruktur „Physische Topologie" | `InfrastructureView.tsx:35,100` | `activeView` steuert keinen Filter |
| Evolution „Branch Compare" | `evolution-tabs.ts:8`, `EvolutionView.tsx:30,77` | `activeTab` ohne Wirkung |
| Evolution „Working Tree" | Git-Daten vorhanden (`git-summary.ts:76-90`) | Tab ohne UI |
| Diagnostics-Subtabs | `DiagnosticsView.tsx:155-182` | Nur Security real, 3 Platzhalter |
| Blueprint-Footer „Keine kritischen Probleme" | `BlueprintFooterStatusBar.tsx:39-42` | Statischer String |
| Execution-Timings | `_projection.ts:193-198` | Fallback `(index+1)*12`; Code-Kommentar: „not live telemetry" |
| `isExecutionLive` | `_projection.ts:286-312` | Aus Metadaten abgeleitet, „active scan stub" |
| Atlas Coverage-% | `atlas-stats.ts:35-41` | Heuristik `modules/nodes` wenn keine echte Messung |
| Atlas Tech-Chips | `atlas-cluster-profiles.ts:6-27` | Hartkodierte Profile per Cluster-Name |
| FILE_LIMIT ~400 | Analyse-Pipeline | Abschneiden ist im UI unsichtbar |

**Entscheidung des Nutzers:** Attrappen werden entfernt, nicht markiert.
„Unbekannt" ist ein legitimer Anzeigezustand.

---

## 5. Was gegenüber den Mockups vollständig fehlt

- Codebase-Treemap (Mockup 4) — kein Code im Repo
- Sequenzdiagramm (Mockup 4) — kein Code im Repo
- Datenbank-ERD mit FK-Beziehungen — Introspection liest nur Spalten
- „Open in GitHub" / „Open in Editor" — kein `vscode://`, `cursor://`, kein Repo-Link
- Provenance-Flag statisch-vs-beobachtet in Blueprint-Views
- Confidence als Zahl an Knoten und Kanten (nur bei Diagnostics-Findings + AppFlow-Badges)
- PR Blast Radius
- Globale Overlays (Security, API-Calls, Events) über alle Views
- Ebenen-Navigation System → Domänen → Module → Komponenten → Dateien
- Logs-Auto-Ingestion (`logs-runner` ist ein `/health`-Stub)

---

## 6. Was besser ist als angenommen

- **AppFlow hat einen echten Runtime-Pfad.** Preview-Bridge-Script wird in die
  laufende Ziel-App injiziert (`preview-runner/index.js:282-284`), Navigation/
  DOM/Fehler kommen per postMessage (`usePreviewPostMessage.ts:47-87`),
  Playwright-Crawl erzeugt verifizierte Kanten, und `mergeRuntimeIntoAnalysis`
  (`runtime-crawl.ts:92-120`) führt Statik + Beobachtung zusammen.
  **Er endet an der Modulgrenze — der Blueprint-`SoftwareGraph` wird nie gemerged.**
  „Live im Blueprint" ist damit eine Verdrahtungsaufgabe, kein Neubau.
- **Evolution hat echte Git-Anbindung** (Commit-SHAs an Snapshots, Git-CLI-Summary,
  Snapshot-Diff mit added/changed/removed). Es fehlen Branch-Compare und Blast Radius.
- Die sieben Views, der 3D-Atlas und die Graph-IR sind solide gebaut.

---

## 7. Prior Art (aus 215 Stars gemined)

| Repo | Lizenz | Verwendung | Adressiert |
|---|---|---|---|
| [graphify](https://github.com/Graphify-Labs/graphify) | Apache-2.0 | inspirieren | Per-Edge `EXTRACTED`/`INFERRED` — billigster Weg zu ehrlicher Evidence |
| [skott](https://github.com/antoine-coulon/skott) | MIT | übernehmen | Entrypoint-getriebene Traversierung statt FILE_LIMIT |
| [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | MIT | inspirieren | Fertiges ELK-Layout-Design für große Graphen; config-getriebene Language-Registry |
| [CodeBoarding](https://github.com/CodeBoarding/CodeBoarding) | MIT | inspirieren | LSP-Server statt eigener Extraktoren (TS-Adapter = 52 Zeilen); Content-Hash-Inkrementalität |
| [mindwalk](https://github.com/cosmtrek/mindwalk) | MIT | inspirieren | Deterministisches Citymap-Layout; Evidence-zitierende Findings |

Lücke: Für Rails, Frappe und Meteor existiert keine Prior Art in den Stars —
das ist Eigenarbeit, idealerweise über den LSP-Weg.

Vollbericht: `~/.cursor/prior-art/visudev-codebase-visualization.md`

---

## 8. Phasenplan

### Phase 0 — Ehrlichkeit

Jede sichtbare Zahl bekommt eine Quelle oder verschwindet.

- Attrappen-Register (Abschnitt 4) abarbeiten
- Truncation sichtbar machen: wenn n von m Dateien analysiert wurden, steht das im UI
- „Unbekannt" als First-Class-Anzeigezustand einführen
- Demo-Enrichment aus CI-Builds entfernen; CI misst den Analyzer, nicht den Demo

**Abnahme:** Screenshot von browo/hr-tool mit Enrichment OFF, auf dem jede
sichtbare Zahl zu ihrer Quelle verfolgbar ist. Kein Wert ohne Herkunft.

### Phase 1 — Beweiskette

Der Deno-Graph wird nicht mehr weggeworfen.

- Adapter `VisuDevGraph → SoftwareGraph` statt Neubau aus Resten
- Stabile Scope-IDs, `lineStart`/`lineEnd`, Evidence, Confidence durchreichen
- Deno-`pipeline` in die Execution-View durchreichen (statt `pipeline: []`)
- Einheitlicher Inspector-Vertrag für alle sieben Views (Knoten **und** Kanten)
- „Im Editor öffnen" + „Auf GitHub öffnen"

**Abnahme:** Beliebiger Knoten und beliebige Kante in jeder View führen per
Klick zur belegenden Codestelle.

### Phase 2 — Vollständigkeit

- Entrypoint-getriebene Traversierung (skott-Muster); FILE_LIMIT wird zum
  Sicherheitsventil, das protokolliert, wenn es greift
- Repo-spezifische Regex-Leiter in `call-graph.builder.ts` entfernen
- ELK-Layout für große Graphen (Understand-Anything-Design)

**Abnahme:** Golden Set ohne repo-spezifische Regeln im Code.

### Phase 3 — Live

- `mergeRuntimeIntoAnalysis` auf den Blueprint-`SoftwareGraph` ausweiten
- Provenance dreistufig: `EXTRACTED` / `INFERRED` / `OBSERVED`
- Echte Execution-Timings aus dem Runtime-Crawl statt Schrittindex

**Abnahme:** „Runtime: LIVE" im Blueprint-Header ist eine Tatsachenbehauptung.

### Phase 4 — Entscheidung

- PR Blast Radius: welche Module, Screens und Abläufe eine Änderung trifft
- Branch Compare mit echtem Inhalt

### Phase 5 — Breite

- Weitere Stacks über LSP-Adapter (Audit-Fall bei fremdem Code)
- Datenbank-ERD mit FK-Kanten
- Treemap + Sequenzdiagramm aus den Mockups

**Nebenprodukt:** Sobald der Graph korrekt und belegt ist, ist der
Agenten-Export eine Serialisierung, kein eigenes Feature.

---

## 9. Prozessregeln für diese Wellen

Aus den Fehlern der Gapclose-Wellen abgeleitet:

1. Ein Issue gilt erst als erledigt, wenn die Abnahme **auf einem echten Repo
   mit Enrichment OFF** erfüllt ist. Kein Schließen bei PARTIAL.
2. Keine repo-spezifischen Literale im Produktcode. Wenn ein Zielrepo eine
   Sonderregel braucht, ist die Abstraktion falsch.
3. Rote CI ist ein Blocker, kein Hinweis. Wenn E2E historisch rot ist, wird das
   zuerst repariert oder die Tests werden gelöscht — aber nicht ignoriert.
4. Kein Platzhalterwert im Produktcode. Fehlende Daten werden als fehlend
   angezeigt.
5. Issues entlang der Beweiskette schneiden, nicht entlang der Schichten —
   sonst fehlt wieder die Brücke zwischen Deno, Node und UI.
