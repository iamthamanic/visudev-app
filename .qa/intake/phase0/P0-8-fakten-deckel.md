# P0-8 — 92 % der gewonnenen Evidenz wird vor dem Export weggeworfen

Label: `opus-fix`
Phase: 0, Welle A · **Nach P0-7** (sonst verpufft der Gewinn am Knotenbudget)
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Fakten (`CodeFact`) sind die Belegschicht von VisuDEV. Jede Aussage, die das
Werkzeug über eine Codebase trifft, soll sich auf einen Fakt mit Datei, Zeile
und Ausschnitt zurückführen lassen — das ist das Versprechen „jede Verbindung
mit Nachweis".

Fakten entstehen im Deno-Analyzer und werden über den Export an den
Node-Teil gereicht. Dort speisen sie die Security-Matrix, die
Abhängigkeitskanten, die Execution-Pipeline und die Infrastruktur-Erkennung.

Es gibt einen Deckel für den Export. Er existiert aus einem nachvollziehbaren
Grund: Die Antwort der Edge Function hat eine Größengrenze, und ein Projekt mit
Zehntausenden Fakten würde sie sprengen.

## 2. Problem

Der Analyzer gewinnt bei `browo-hr` intern **6204 Fakten aus 335 Dateien**.
Exportiert werden **483 Fakten aus 32 Dateien**. Verworfen werden 92 %.

Die Auswahl trifft die erste passende Position im Array. Es gibt keine
Priorisierung nach Nützlichkeit und keine Meldung darüber, dass geschnitten
wurde.

### Die verursachende Stelle

```13:13:src/supabase/functions/visudev-analyzer/module/blueprint/internal/graph-export-cap.ts
export const MAX_BLUEPRINT_FACTS = 500;
```

```70:73:src/supabase/functions/visudev-analyzer/module/blueprint/internal/graph-export-cap.ts
  // Honesty: keep every model + bounded infra engines even if over limit.
  const preserved = [...models, ...infra];
  const remaining = Math.max(0, limit - preserved.length);
  return [...preserved, ...rest.slice(0, remaining)];
```

`rest.slice(0, remaining)` ist ein Schnitt nach Array-Position. Bei browo-hr
werden 125 Prisma-Modelle und einige Infra-Fakten bewahrt; für alles Übrige
bleiben rund 350 Plätze bei 6000 Kandidaten.

### Was dadurch konkret verloren geht

| Fakt-Typ | intern extrahiert | exportiert | Folge |
|---|---|---|---|
| `auth-check` | 402 | ~8 | Security-Matrix kann Auth nicht bestätigen → P0-6 |
| `validation-deny-400` | 148 | wenige | dieselbe Wirkung für Validierung |
| `ast-import` | mehrere hundert | 64 | zu wenige Kandidaten für Abhängigkeitskanten → P0-9 |
| übrige | rund 5000 | Rest | Execution-Pipeline, Infrastruktur, Diagnostics |

**Für 340 von 372 Routen kommt gar keine Evidenz an.** Das ist der Grund, warum
die Security-Matrix überall raten muss — und warum die 19 inhaltlich
zutreffenden Tenant-Isolation-Befunde ausgerechnet nur die Leave-Routen
treffen: Das sind die einzigen, deren DB-Fakten den Schnitt überlebt haben.

### Der Deckel ist stumm

Es gibt keine Meldung, keinen Zähler und kein Feld im Export, das mitteilt,
dass 5721 Fakten verworfen wurden. Nach außen sieht ein beschnittener Export
identisch aus wie ein vollständiger. Das verletzt dieselbe Regel wie P0-6:
Nichtwissen wird unsichtbar gemacht.

### Was bereits richtig gelöst ist

Die Prisma-Schutzregel (Zeilen 41-73) ist das Vorbild für die Lösung. Sie
erkennt eine Fakt-Klasse als unverzichtbar und nimmt sie vom Schnitt aus.
Dasselbe gilt für die Infra-Dienste mit einer eigenen Obergrenze
(`MAX_PRESERVED_INFRA_SERVICE_FACTS = 16`). Beide Mechanismen funktionieren
nachweislich — alle 125 Prisma-Modelle kommen korrekt an.

Das Muster ist also vorhanden. Es wurde nur nie auf die
sicherheitsrelevanten Fakten angewendet.

## 3. Lösung

**Zwei Teile, beide notwendig.**

**Teil 1 — Priorisierung statt Positionsschnitt.** Der Rest wird nicht mehr
über `slice(0, n)` beschnitten, sondern nach einer Rangfolge ausgewählt. Die
Rangfolge richtet sich danach, welche Fakt-Typen von nachgelagerten Ableitungen
tatsächlich gebraucht werden. Innerhalb einer Rangstufe wird die Abdeckung
verteilt: erst ein Fakt je Datei, dann ein zweiter je Datei, und so fort. Damit
liefert der Export bei gleichem Budget Evidenz für 300 Dateien statt für 32.

**Teil 2 — Der Deckel meldet sich.** Der Export trägt künftig, wie viele Fakten
extrahiert und wie viele übernommen wurden, aufgeschlüsselt nach Typ. Diese
Zahl wandert bis ins UI (Teil von P0-1).

Das Anheben des Zahlenwerts allein ist **keine** Lösung. Bei 6204 Fakten würde
auch ein Deckel von 3000 noch die Hälfte verwerfen, und die Größengrenze der
Antwort bleibt real. Der Zahlenwert darf angehoben werden, wenn die
Antwortgröße es hergibt — aber die Priorisierung ist der eigentliche Fix.

**Verworfene Alternative: Deckel entfernen.** Die Größengrenze der Edge
Function ist echt. Ein Projekt mit 100.000 Fakten würde den Export brechen.

**Verworfene Alternative: Fakten komprimieren.** Löst das Problem für einen
Faktor 2 bis 3 und macht den Export undurchsichtig. Die Priorisierung ist
wirksamer und einfacher.

**Verworfene Alternative: mehrere Anfragen paginieren.** Erheblicher Umbau der
Schnittstelle für ein Problem, das mit Priorisierung erledigt ist.

## 4. Architektur

Die Änderung liegt vollständig im Deno-Export. Der Node-Teil sieht nur mehr und
besser verteilte Fakten sowie zwei neue Zählfelder.

| Schicht | Datei | Änderung |
|---|---|---|
| Deno, Export | `internal/graph-export-cap.ts` | Priorisierung, Abdeckungsverteilung, Zählung |
| Deno, DTO | `dto/blueprint/blueprint-document.dto.ts` | Feld `factSelection` mit den Zählern |
| shared | `shared/visudev-api.types.ts` | `factSelection` durchreichen |
| Node | `local-engine/src/providers/legacy-visudev-analysis.provider.ts` | `factSelection` nicht verwerfen |

## 5. Edge Cases

- **Weniger Fakten als der Deckel**: Keine Auswahl, keine Meldung über
  Verwerfen. `factSelection` wird trotzdem gesetzt, mit gleichen Zahlen für
  extrahiert und übernommen.
- **Alle Fakten sind Prisma-Modelle** (Schema-only-Repo): Die bestehende
  Schutzregel behält alle, auch über dem Deckel. Verhalten unverändert.
- **Mehr Prisma-Modelle als der Deckel**: Bereits heute möglich und bewusst so.
  `remaining` wird 0, der Rest fällt weg. Nach der Änderung muss das gemeldet
  werden.
- **Ein einziger Fakt-Typ dominiert** (10.000 `ast-import` in einem Monorepo):
  Die Abdeckungsverteilung verhindert, dass eine Datei alle Plätze belegt.
- **Datei mit sehr vielen Fakten** (`schema.prisma` mit 126): Nach der
  Verteilung bekommt sie in der ersten Runde einen Platz wie jede andere Datei.
  Die Prisma-Schutzregel greift davor und bleibt unberührt.
- **Null Fakten**: `factSelection` mit Nullen. Kein Sonderfall.
- **Enrichment ON**: Der Demo-Pfad läuft nicht durch diesen Export. Keine
  Auswirkung erwartet.

## 6. User Journey

**Vorher:** Der Nutzer öffnet Diagnostics und sieht, dass 340 von 372 Routen
keine Aussage tragen. Nichts erklärt warum. Die Ansicht wirkt kaputt, obwohl
der Analyzer die Daten hatte.

**Nachher:** Die Mehrheit der Routen trägt echte Evidenz. Wo Fakten fehlen,
steht die Zahl der verworfenen Fakten mit Begründung im Umfangs-Hinweis.

## 7. Akzeptanzkriterien

- [ ] **Enrichment OFF auf browo-hr:** Die Zahl der Dateien mit mindestens
      einem exportierten Fakt steigt von 32 auf über 250.
- [ ] **Enrichment OFF auf browo-hr:** Mindestens 250 der 372 Routen haben
      mindestens einen Fakt in ihrer Datei.
- [ ] **Enrichment OFF auf browo-hr:** Mindestens 150 `auth-check`-Fakten sind
      im Export enthalten. Vorher: rund 8.
- [ ] **Enrichment OFF auf browo-hr:** Alle 125 Prisma-Modell-Fakten sind
      weiterhin enthalten. Diese Zusicherung darf nicht schwächer werden.
- [ ] Der Export enthält `factSelection` mit `extracted`, `selected` und
      `byKind`.
- [ ] Kein `slice(0, n)` mehr auf einer unsortierten Fakten-Liste.
- [ ] Die Antwortgröße des Exports bleibt unter der Grenze der Edge Function.
      Der gemessene Wert steht im PR.

## 8. Tests

**Neu** in
`src/supabase/functions/visudev-analyzer/module/blueprint/internal/graph-export-cap.test.ts`:

- `"selection spreads across files before deepening"` — 100 Dateien mit je 20
  Fakten, Deckel 200 → jede Datei ist mit mindestens einem Fakt vertreten.
- `"auth-check outranks generic facts"` — Mischung aus 400 `auth-check` und
  4000 sonstigen, Deckel 500 → alle `auth-check` sind enthalten.
- `"all prisma model facts survive regardless of cap"` — bestehende Zusicherung,
  muss weiter gelten.
- `"factSelection reports extracted and selected counts"`.
- `"no cap means selected equals extracted"`.
- `"single file cannot consume the whole budget"` — eine Datei mit 5000 Fakten,
  99 weitere mit je einem → die 99 sind enthalten.

**Anzupassen:** Bestehende Tests in derselben Datei, die eine bestimmte
Reihenfolge oder Anzahl im Ergebnis erwarten.

**Zu löschen:** Nichts.

## 9. Überprüfungen

```bash
cd Visudevfigma
deno test src/supabase/functions/visudev-analyzer/
npm run test:run
npm run golden-set
```

Vollständiger Lauf gegen browo-hr, Enrichment OFF. Der PR enthält:

1. Zahl der exportierten Fakten vorher (483) und nachher.
2. Zahl der Dateien mit Fakten vorher (32) und nachher.
3. Zahl der `auth-check`-Fakten vorher und nachher.
4. Größe der Export-Antwort in Bytes, mit der geltenden Grenze daneben.
5. Bestätigung, dass alle 125 Prisma-Modelle enthalten sind.

Mindestens drei weitere Test-Repos gegenprüfen, insbesondere ein kleines, bei
dem der Deckel nicht greift.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei | Was passiert |
|---|---|
| `.../blueprint/internal/graph-export-cap.ts` | Priorisierung, Verteilung, Zählung |
| `.../blueprint/dto/blueprint-document.dto.ts` | Typ `FactSelectionReport` |
| `shared/visudev-api.types.ts` | `factSelection` in `RawBlueprintScan` |
| `local-engine/src/providers/legacy-visudev-analysis.provider.ts` | Feld durchreichen |

### Neu anzulegen

| Datei | Zweck |
|---|---|
| `.../blueprint/internal/graph-export-cap.test.ts` | Tests, falls nicht vorhanden |

### Nicht anfassen

| Datei / Bereich | Grund |
|---|---|
| `isPrismaSchemaModelFact`, `isInfraServiceExportFact` | Funktionieren nachweislich |
| `MAX_PRESERVED_INFRA_SERVICE_FACTS` | Unverändert bei 16 |
| `graph-export-trim.ts`, `graph-export-sanitize.ts` | Andere Aufgabe |
| `fact-metadata-sanitizer.ts` | Gehört zu P0-9 |
| `shared/blueprint-graph-inference.ts` | Gehört zu P0-6 |
| Alles unter `src/modules/` | Die Anzeige des Berichts ist P0-1 |

## 11. Umsetzungsschritte

**Schritt 1 — Rangfolge definieren** nach Abschnitt 12.1 als exportierte
Konstante, damit Tests sie prüfen können.

**Schritt 2 — Auswahl umbauen.** In `selectFactsPreservingPrismaModels` bleibt
die Aufteilung in `models`, `infra` und `rest` unverändert. Statt
`rest.slice(0, remaining)` wird `rest` nach Abschnitt 12.2 ausgewählt:
Rangstufe außen, Abdeckungsrunde innen.

**Schritt 3 — Zählung.** Die Funktion gibt zusätzlich einen
`FactSelectionReport` nach Abschnitt 12.3 zurück. Die Signatur ändert sich; alle
Aufrufer müssen angepasst werden.

**Schritt 4 — Bericht durchreichen** bis in `RawBlueprintScan`.

**Schritt 5 — Deckel prüfen.** Nach Umsetzung von Schritt 2 gegen browo-hr
messen, wie groß die Antwort bei `MAX_BLUEPRINT_FACTS = 500` und bei 1500 ist.
Wenn 1500 sicher unter der Grenze bleibt, den Wert anheben und die Messung im
PR belegen. Ohne Messung bleibt der Wert bei 500.

**Schritt 6 — Tests.**

**Schritt 7 — Gegen browo-hr und drei weitere Repos messen.**

## 12. Exakte Vorgaben

### 12.1 Rangfolge

```ts
/** Lower index = higher priority. Facts of unlisted kinds rank last. */
export const FACT_EXPORT_PRIORITY: readonly string[] = [
  "auth-check",
  "validation-deny-400",
  "db-write",
  "db-read",
  "route",
  "ast-import",
  "ast-call",
  "infra-service",
];
```

Begründung der Reihenfolge: Die ersten beiden speisen die Security-Matrix, die
ohne sie raten muss (P0-6). Datenbank- und Routen-Fakten tragen Execution und
Data. `ast-import` und `ast-call` tragen die Abhängigkeitskanten (P0-9).

### 12.2 Auswahlverfahren

```
für jede Rangstufe in FACT_EXPORT_PRIORITY, dann für unbekannte Typen:
    gruppiere die Fakten dieser Stufe nach filePath
    solange Budget übrig und noch Fakten in dieser Stufe:
        gehe die Dateien in stabiler Reihenfolge durch
        nimm von jeder Datei den nächsten Fakt
```

Die Reihenfolge der Dateien wird alphabetisch nach `filePath` festgelegt, damit
das Ergebnis zwischen zwei Läufen identisch ist.

### 12.3 Berichtstyp

```ts
export interface FactSelectionReport {
  /** Facts produced by the extractors before any cap. */
  extracted: number;
  /** Facts included in the export. */
  selected: number;
  /** Files with at least one selected fact. */
  filesCovered: number;
  /** Per kind: extracted vs selected. */
  byKind: Record<string, { extracted: number; selected: number }>;
}
```

### 12.4 Neue Signatur

```ts
export function selectFactsPreservingPrismaModels(
  facts: CodeFact[],
  limit: number = MAX_BLUEPRINT_FACTS,
): { facts: CodeFact[]; report: FactSelectionReport };
```

Der Rückgabetyp ändert sich von `CodeFact[]` auf ein Objekt. Alle Aufrufer
müssen angepasst werden.

## 13. Verständlichkeit

Dieses Issue erzeugt keine eigene Oberfläche. Es liefert die Daten, die P0-1
anzeigt.

**Erklärung:** Der Begriff „Fakt" braucht einen Glossareintrag. Für einen Laien
lautet die Erklärung: „Eine einzelne Beobachtung im Code — zum Beispiel: in
Datei X, Zeile Y wird die Datenbank geschrieben. Alles, was VisuDEV behauptet,
stützt sich auf solche Beobachtungen."

**Nachweis:** Kein Screenshot nötig. Stattdessen der Vorher-Nachher-Vergleich
der Zahlen aus Abschnitt 9 im PR.

## 14. Häufige Fehlannahmen

**„Ich setze `MAX_BLUEPRINT_FACTS` auf 10000, fertig."**
Nein. Bei 6204 Fakten wäre der Deckel dann wirkungslos — und genau das ist der
Punkt, an dem die Antwortgröße die Grenze der Edge Function reißt. Der Fix ist
die Priorisierung. Eine Anhebung ist nur mit belegter Messung zulässig
(Schritt 5).

**„Wenn ich nach Priorität sortiere, reicht ein `sort` und dann `slice`."**
Das löst die halbe Aufgabe. Ohne Verteilung über Dateien belegen die 402
`auth-check`-Fakten weiterhin ganze Verzeichnisse und lassen andere Dateien
komplett ohne Evidenz. Beide Achsen sind nötig: Rangstufe **und** Abdeckung.

**„Die Prisma-Sonderregel kann ich in die neue Rangfolge integrieren."**
Nein. Die Rangfolge wählt innerhalb eines Budgets aus. Die Prisma-Regel
**überschreitet** das Budget bewusst. Das sind zwei verschiedene Mechanismen,
und die bestehende Regel funktioniert. Sie bleibt unverändert davor stehen.

**„Ich sollte gleich die Metadaten-Allowlist erweitern, damit die
Import-Kanten funktionieren."**
Nein, das ist P0-9. Dieses Issue sorgt nur dafür, dass genug `ast-import`-Fakten
überhaupt exportiert werden. Ohne P0-9 entstehen daraus trotzdem keine Kanten.

**„92 % verworfen heißt, ich muss 92 % mehr exportieren."**
Nicht unbedingt. Der größere Gewinn liegt in der Verteilung: bei
unverändertem Budget von 500 lässt sich die Zahl der abgedeckten Dateien von
32 auf über 250 steigern, weil heute wenige Dateien alle Plätze belegen.

**„Ich messe die Antwortgröße später."**
Ohne die Messung darf `MAX_BLUEPRINT_FACTS` nicht angehoben werden. Ein
gerissenes Größenlimit auf Vercel bricht die Analyse vollständig — das wäre
schlimmer als der jetzige Zustand.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma

# Kein Positionsschnitt mehr auf unsortierten Fakten
rg -n "rest\.slice\(0" src/supabase/functions/visudev-analyzer/module/blueprint/internal/graph-export-cap.ts
# erwartet: keine Treffer

# Rangfolge ist exportiert und testbar
rg -n "FACT_EXPORT_PRIORITY" src/supabase/functions/visudev-analyzer/
# erwartet: Definition + Verwendung + Test

npm run typecheck        # erwartet: exit 0
deno check src/supabase/functions/visudev-analyzer/index.ts   # erwartet: exit 0
npm run test:run         # erwartet: exit 0
npm run golden-set       # erwartet: "golden-set: OK (...)"
npm run lint             # erwartet: exit 0
```

## Regeln für den Umsetzer

1. **Nur der beschriebene Scope.** Angrenzende Fehler im PR unter „Beobachtet,
   nicht behoben" notieren.
2. **Kein Test wird abgeschwächt.** Insbesondere die Zusicherung „alle
   Prisma-Modelle überleben" darf nicht gelockert werden.
3. **Keine neuen Platzhalterwerte.**
4. **Keine repo-spezifischen Literale.** Die Rangfolge nennt Fakt-Typen, keine
   Dateinamen und keine Frameworks.
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken.
