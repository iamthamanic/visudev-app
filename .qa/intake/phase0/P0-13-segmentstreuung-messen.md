# P0-13 — Segmentstreuung messen: Domäne oder Schicht ist pro Name belegbar

Label: `opus-fix`
Phase: 0, Welle A · **Nach P0-7** (sonst messen Duplikate die Hierarchie kaputt)
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

VisuDEV muss mit **allen** Projektlayouts klar kommen — nicht nur mit
Repositories, die Fachbereiche als Ordner unter `modules/` ablegen. In den
Test-Repos liegen mindestens zwei Familien:

| Familie | Beispiele | Domäne steckt in |
|---|---|---|
| **Domänenzuerst** | browo-hr, erpnext | Pfad (`modules/leaves/`, `erpnext/accounts/`) |
| **Schichtzuerst** | discourse, mastodon, immich | Dateiname (`topic.rb`, `album.service.ts`) |

Ein früherer Entwurf von P0-10 versuchte Domänen über eine **feste
Namensliste** zu finden (`STRUCTURAL_SEGMENTS`, `SURFACE_SEGMENTS`,
`LAYER_SEGMENTS`). Gegen die sieben Test-Repos gerechnet: die Regel
funktioniert bei zwei und versagt bei vier. browo-hr war ausgerechnet der
Fall, für den der Entwurf passte — derselbe Prozessfehler wie beim
Demo-Graphen: an einem Repo entworfen.

Die Architecture-Ansicht und der Atlas brauchen Zugehörigkeit als stärksten
visuellen Kanal. Ohne eine layout-unabhängige Messung bleibt jede Heuristik
eine Vermutung über englische Konventionsnamen.

## 2. Problem

Heute entscheidet `_heuristics.ts` **pro Datei isoliert**, ohne den Rest des
Baums zu kennen:

```23:34:local-engine/src/services/software-graph/_heuristics.ts
export function detectDomain(filePath: string): string {
  const parts = normalizePath(filePath).split("/").filter(Boolean);
  if (parts.length === 0) return "root";

  // Monorepo: apps/<name>/… → apps/<name>, packages/<name>/… → packages/<name>
  if ((parts[0] === "apps" || parts[0] === "packages" || parts[0] === "ee") && parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  if (parts.length >= 2 && parts[0] === "src") return parts[1] || "src";
  return parts[0] || "root";
}
```

Das erste Segment wird Domäne. Ob `backend`, `models` oder `accounts` fachlich
oder strukturell ist, kann eine Einzeldatei nicht wissen — das zeigt sich erst
an der **Wiederholung über den Baum**.

Belege aus den Test-Repos:

- In discourse erscheint `models` unter `app/`, unter `spec/` und unter jedem
  Plugin → hohe Streuung → Schicht.
- In erpnext erscheint `doctype` unter vielen Eltern, `accounts` unter genau
  einem → niedrige Streuung bei `accounts` → Domäne.
- In browo-hr erscheint `leaves` unter wenigen Eltern, `modules` unter vielen
  Geschwister-Domänen → `leaves` Domäne, `modules` strukturell.

**Ohne diese Messung** kann P0-10 keine Domäne aus dem Pfad ableiten und P0-14
keine Entscheidung treffen, wann der Dateiname ran muss. Dieses Issue liefert
nur die Kennzahl — noch keine Domänen-Labels.

## 3. Lösung

**Genau eine Lösung:** Für jedes Verzeichnissegment im analysierten Dateibaum
die **Elternstreuung** berechnen:

> Streuung(Name) = Anzahl verschiedener Elternverzeichnisse, unter denen dieses
> Segment als Kind vorkommt.

Zusätzlich pro Vorkommen die **Geschwisterzahl** (andere Kindverzeichnisse
unter demselben Elternverzeichnis).

Aus beiden Werten entsteht ein **Segmentprofil** pro Repo — reine Messung,
keine Domänenentscheidung. Die Schwellen (`maxSpreadForDomain`,
`minSiblingDomains`) werden in diesem Issue **kalibriert und festgeschrieben**,
aber die **Anwendung** der Schwellen auf `detectDomain` ist P0-10.

Dieses Issue liefert:

1. Eine Funktion `buildSegmentSpreadIndex(filePaths: string[]): SegmentSpreadIndex`
2. Eine Messtabelle gegen alle Repos unter `visudev-test-repos/`
3. Festgeschriebene Schwellenwerte im Code als benannte Konstanten mit Kommentar
   „kalibriert gegen Messtabelle vom Datum …"

**Verworfene Alternative: feste Namenslisten.** Versagt bei discourse, mastodon,
immich und bei nicht-englischen Ordnernamen. Genau der Fehler, der P0-10
ursprünglich kaputt gemacht hätte.

**Verworfene Alternative: Domänen aus Import-Clustern.** Abhängig von P0-9,
nicht deterministisch, nicht erklärbar. Später denkbar, nicht hier.

**Verworfene Alternative: Schwellen „bei der Umsetzung wählen".** Verboten durch
die Vorlage. Kalibrierung ist Teil dieses Issues; ohne Messtabelle ist das Issue
nicht abnehmbar.

## 4. Architektur

| Schicht | Datei | Änderung |
|---|---|---|
| Node, Graph-Builder | neu: `_segment-spread.ts` | Index + Konstanten |
| Node | `_heuristics.ts` | **nicht** ändern (P0-10) |
| Tests | `_segment-spread.test.ts` | Unit + Fixture |
| Evidence | `visudev-test-repos/evidence/segment-spread-calibration-YYYY-MM-DD.md` | Messtabelle |

Quelle der Wahrheit: der Index aus den **analysierten** Dateipfaden (dieselbe
Menge, die der Graph-Builder sieht), nicht aus einem kompletten `find` über das
Repo — sonst kalibriert man gegen Dateien, die der Analyzer nie sieht.

## 5. Edge Cases

- **Weniger als 20 Dateien:** Index wird trotzdem gebaut; Domänenentscheidung
  in P0-10 fällt dann oft auf Rückfall. Kein Crash.
- **Ein Segment nur einmal:** Streuung = 1. Kandidat für Domäne, wenn genug
  Geschwister mit Streuung ≤ Schwelle.
- **Monorepo:** Streuung wird über den gesamten analysierten Baum gemessen.
  `apps/web` und `apps/api` können beide niedrige Streuung haben — das ist
  korrekt und erlaubt Domänen pro App-Unterbaum in P0-10.
- **Segment mit Punkt** (`MyApp.Domain`): Wird als Segment gezählt, nicht als
  Datei. Die heutige Regel `part.includes(".")` in `firstMeaningfulSegment` ist
  **nicht** Teil dieses Issues und wird hier nicht nachgebaut.
- **Leere Pfade / absolute Pfade:** Über `normalizePath` wie bisher.
- **Groß/Klein:** Streuungsschlüssel ist kleingeschrieben; das Anzeige-Label
  behält die häufigste Originalschreibweise (Modus).
- **Enrichment ON / Demo:** Index wird aus Demo-Pfaden gebaut, falls der Builder
  läuft. Keine Sonderbehandlung nötig.

## 6. User Journey

Dieses Issue hat **keine eigene Oberfläche**. Der Nutzer merkt den Effekt erst
über P0-10 und P0-14 (Architecture/Atlas mit echten Domänen statt `backend`).

Für den Entwickler: Nach dem Merge existiert eine Evidence-Datei mit der
Kalibrierungstabelle. Wer die Schwellen später ändern will, muss die Tabelle
erneuern — nicht raten.

## 7. Akzeptanzkriterien

- [ ] `buildSegmentSpreadIndex` existiert und ist aus dem Graph-Builder
      importierbar, wird aber in diesem Issue **noch nicht** von
      `detectDomain` aufgerufen.
- [ ] Für jedes Repo unter `visudev-test-repos/` (außer `evidence/`,
      `_references/`) liegt in der Evidence-Datei eine Zeile mit:
      Top-10-Segmenten nach Dateianzahl, Streuung, Geschwister-Median.
- [ ] Die Konstanten `MAX_SPREAD_FOR_DOMAIN` und `MIN_SIBLING_DOMAINS` sind im
      Code fest und mit Datum + Verweis auf die Evidence-Datei kommentiert.
- [ ] Unit-Tests decken domänenzuerst- und schichtzuerst-Fixtures ab
      (Abschnitt 8).
- [ ] `_heuristics.ts` ist unverändert (`git diff` leer für diese Datei).
- [ ] Keine Namensliste von Domänen/Schichten in `_segment-spread.ts`.

## 8. Tests

**Neu** in
`local-engine/src/services/software-graph/_segment-spread.test.ts`:

- `"layer name under many parents has high spread"` — Fixture mit
  `app/models/a.rb`, `app/controllers/a.rb`, `plugins/x/models/b.rb` →
  Streuung von `models` ≥ 2.
- `"domain name under one parent has spread 1"` — Fixture wie
  `modules/leaves/x.ts`, `modules/payroll/y.ts` → `leaves` und `payroll`
  haben Streuung 1; `modules` hat Geschwister ≥ 2.
- `"case folding: Models and models share a key"` — gleiche Streuung.
- `"empty input yields empty index"`.
- `"index reports label mode for display"`.

**Kein Golden-Set in diesem Issue**, solange P0-5 den Job noch nicht hat. Die
Evidence-Tabelle ersetzt die Repo-Abnahme.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run test:run -- _segment-spread
npm run typecheck
```

Manuell: Script oder einmaliger Node-Aufruf, der für jedes Test-Repo die
analysierbaren Pfade einsammelt (dieselbe Priorisierung wie
`blueprint-local.js`, Enrichment OFF) und den Index schreibt. Ergebnis nach
`visudev-test-repos/evidence/segment-spread-calibration-2026-08-12.md`.

Der PR enthält die Messtabelle und die Begründung der gewählten Schwellen in
2–4 Sätzen.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

Keine bestehenden Produktionsdateien außer dem Export aus dem neuen Modul,
falls ein Barrel existiert. Bevorzugt: direkter Import ohne Barrel.

### Neu anzulegen

| Datei | Zweck |
|---|---|
| `local-engine/src/services/software-graph/_segment-spread.ts` | Index + Konstanten |
| `local-engine/src/services/software-graph/_segment-spread.test.ts` | Tests |
| `visudev-test-repos/evidence/segment-spread-calibration-2026-08-12.md` | Messtabelle |

### Nicht anfassen

| Datei / Bereich | Grund |
|---|---|
| `_heuristics.ts` | Anwendung der Messung ist P0-10 |
| `_file-context.ts` | P0-7 |
| UI / Atlas | Darstellung ist später |

## 11. Umsetzungsschritte

**Schritt 1 — Typen und Konstanten** nach Abschnitt 12.

**Schritt 2 — Index bauen.** Alle Dateipfade normalisieren, Segmente außer dem
Dateinamen (letztes Segment mit Dateiendung oder letztes Segment) sammeln.
Für jedes (Elternpfad, Kindname)-Paar zählen.

Elternstreuung = Anzahl distinct Elternpfade pro Kindname (casefold).
Geschwister = Anzahl anderer Kindverzeichnisse unter demselben Elternpfad;
pro Kindname den Median der Geschwisterzahlen speichern.

**Schritt 3 — Kalibrierung.** Gegen alle Test-Repos laufen. Schwellen so
wählen, dass:

- In browo-hr: `leaves`, `payroll`, `auth` als Kandidaten (Streuung ≤ Schwelle)
  und `modules`/`app`/`backend` als Nicht-Kandidaten **oder** klar getrennt
  über Geschwister-Muster erkennbar sind.
- In discourse `app/`: `models`/`controllers` hohe Streuung → Nicht-Kandidaten.
- In erpnext: `accounts`/`stock` Kandidaten.

Wenn keine Schwellen diese drei gleichzeitig erfüllen, die nächstbeste
Trennung wählen und im PR als bekannte Grenze dokumentieren — **nicht** eine
Namensliste einführen.

**Schritt 4 — Tests und Evidence-Datei.**

**Schritt 5 — PR mit Tabelle und Schwellenbegründung.**

## 12. Exakte Vorgaben

### 12.1 Typen

```ts
export interface SegmentSpreadEntry {
  /** Lowercase key used for aggregation. */
  key: string;
  /** Most frequent original spelling. */
  label: string;
  /** Number of distinct parent directories this segment appears under. */
  parentSpread: number;
  /** Median sibling directory count across those parents. */
  medianSiblings: number;
  /** How many files sit under a path that includes this segment. */
  fileCount: number;
}

export interface SegmentSpreadIndex {
  byKey: Map<string, SegmentSpreadEntry>;
  fileCount: number;
}

export function buildSegmentSpreadIndex(filePaths: readonly string[]): SegmentSpreadIndex;
```

### 12.2 Konstanten (Werte nach Kalibrierung einsetzen)

```ts
/**
 * Calibrated 2026-08-12 against
 * visudev-test-repos/evidence/segment-spread-calibration-2026-08-12.md
 */
export const MAX_SPREAD_FOR_DOMAIN = /* gemessener Integer */;
export const MIN_SIBLING_DOMAINS = /* gemessener Integer */;
```

Vorläufige Startwerte zum Kalibrieren (dürfen im PR abweichen, müssen aber
begründet werden): `MAX_SPREAD_FOR_DOMAIN = 2`, `MIN_SIBLING_DOMAINS = 3`.

### 12.3 Hilfsfunktion für P0-10 (nur Export, hier noch unbenutzt)

```ts
export function isDomainCandidate(
  entry: SegmentSpreadEntry,
  maxSpread: number = MAX_SPREAD_FOR_DOMAIN,
  minSiblings: number = MIN_SIBLING_DOMAINS,
): boolean {
  return entry.parentSpread <= maxSpread && entry.medianSiblings >= minSiblings - 1;
}
```

`minSiblings - 1`, weil „mindestens N Domänen-Geschwister" = N−1 andere plus
sich selbst; dokumentiere die Formel im Kommentar der Funktion.

## 13. Verständlichkeit

Kein UI. Im Evidence-Dokument einen Absatz für Laien:

> „Manche Ordnernamen wiederholen sich unter vielen Eltern — das sind meist
> Schichten (models, controllers). Andere erscheinen nur an einer Stelle neben
> vielen gleichartigen Ordnern — das sind meist Fachbereiche (Urlaub, Gehalt)."

## 14. Häufige Fehlannahmen

**„Ich trage `models` und `controllers` in eine Blacklist ein."**
Nein. Das ist wieder die Namensliste. Die Streuung muss das leisten.

**„Ich rufe `detectDomain` schon um."**
Nein. Dieses Issue misst nur. P0-10 wendet an.

**„Ich kalibriere nur gegen browo-hr."**
Verboten. Mindestens discourse (schichtzuerst) und erpnext (domänenzuerst)
müssen in der Tabelle stehen.

**„Schwellen lasse ich als Parameter offen."**
Nein. Feste Konstanten mit Evidence-Verweis.

**„Ich messe über `find .` alle Dateien im Repo."**
Nein. Nur die Pfade, die der Analyzer tatsächlich analysieren würde — sonst
stimmt die Kalibrierung nicht mit Produktion überein.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma
git diff -- local-engine/src/services/software-graph/_heuristics.ts
# erwartet: leer

rg -n "STRUCTURAL_SEGMENTS|LAYER_SEGMENTS|SURFACE_SEGMENTS" \
  local-engine/src/services/software-graph/_segment-spread.ts
# erwartet: keine Treffer

npm run typecheck
npm run test:run -- _segment-spread
npm run lint
```

Evidence-Datei existiert und nennt mindestens browo-hr, discourse, erpnext,
immich.

## Regeln für den Umsetzer

1. **Nur messen und kalibrieren.** Keine Domänen-IDs im Graphen ändern.
2. **Kein Test wird abgeschwächt.**
3. **Keine Namenslisten** für Domänen oder Schichten.
4. **Keine repo-spezifischen Literale.**
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken.
