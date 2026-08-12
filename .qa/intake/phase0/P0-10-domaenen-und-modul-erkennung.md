# P0-10 — Domänen aus der Pfadstruktur: Streuung anwenden, keine Namensliste

Label: `opus-fix`
Phase: 0, Welle A · **Nach P0-7 und P0-13**
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Die Architecture-Ansicht soll Domains, Layer und Module zeigen. Der Atlas legt
Zugehörigkeit auf den Ort. Beides braucht echte Domänen-Labels.

Ausgangslage browo-hr (Enrichment OFF): **2 Domänen** (`backend`, `deployment`)
statt **45 Fachmodule** unter `backend/app/modules/`. Ursache:
`detectDomain` nimmt das erste Pfadsegment (`_heuristics.ts:23-34`).

Ein früherer Issue-Entwurf wollte das mit festen Segmentlisten lösen
(`backend`/`frontend` überspringen, `modules` durchstoßen). Gegen die
Test-Repos gerechnet: das funktioniert bei browo-hr und bricht bei
discourse, mastodon und immich — dort steckt die Domäne **nicht** im Pfad.
Deshalb wurde die Lösung gesplittet:

1. **P0-13** misst Segmentstreuung (layout-unabhängig).
2. **Dieses Issue** wendet die Messung nur auf **Pfad-Domänen** an.
3. **P0-14** ergänzt Domänen aus Dateinamen für schichtzuerst-Layouts.

## 2. Problem

```23:34:local-engine/src/services/software-graph/_heuristics.ts
export function detectDomain(filePath: string): string {
  const parts = normalizePath(filePath).split("/").filter(Boolean);
  // …
  return parts[0] || "root";
}
```

```66:73:local-engine/src/services/software-graph/_heuristics.ts
  if (parts[0] === "app") {
    const meaningful = firstMeaningfulSegment(parts.slice(1));
    return meaningful ?? "app";
  }
```

Für `backend/app/modules/leaves/leaves.routes.ts`: Domäne = `backend`, Modul =
`modules`. Keine Fachdomäne.

Zusätzlich: `detectDomain` und `detectModule` raten unabhängig. Die Next.js-
Regel existiert nur in `detectModule`. Deshalb laufen Domäne und Modul
auseinander.

**Auswirkung:** Architecture zeigt „DOMAIN backend" massenhaft. Atlas hat keine
Distrikte. VisuDEV wirkt architekturblind — obwohl der Analyzer die Dateien
sieht.

## 3. Lösung

**Genau eine Lösung:** Vor dem Bau der File-Contexts einmal
`buildSegmentSpreadIndex` (P0-13) über alle Dateipfade des Scans laufen lassen.
`detectDomain` / `detectModule` bekommen den Index als Parameter und wählen:

> Die Domäne ist das **erste** Pfadsegment (von der Wurzel zur Datei, Dateiname
> ausgenommen), für das `isDomainCandidate(entry)` wahr ist.

Das Modul ist das **nächste** Domänen-Kandidaten-Segment darunter; fehlt es,
ist Modul = Domäne.

Findet kein Segment einen Kandidaten:

- Rückgabe Domäne = Platzhalter `unassigned` (Label später „Nicht zugeordnet",
  siehe P0-7).
- Feld `domainSource: "none"` am Ergebnis (siehe 12.2), damit UI und P0-14
  wissen: Pfad hat nichts geliefert.

**Keine** Listen `STRUCTURAL_SEGMENTS` / `SURFACE_SEGMENTS` / `LAYER_SEGMENTS`.
**Kein** Sonderfall `backend/app/modules`.

Die bestehende Monorepo-Regel `apps|packages|ee` + Kind **bleibt als
Präfix-Hinweis**, wird aber **nicht** mehr automatisch zur Domäne: Unter dem
Präfix wird weiter nach dem ersten Domänen-Kandidaten gesucht. Liegt keiner
vor, ist die Domäne der Präfix `apps/<name>` (bisheriges Verhalten als
Rückfall, nicht als Behauptung einer Fachdomäne).

**Verworfene Alternative: Namenslisten.** Siehe Einleitung und P0-13.

**Verworfene Alternative: Frontend und Backend immer zusammenführen.** Das
setzt voraus, dass beide denselben Domänennamen im Pfad tragen. Wenn ja, liefert
die Streuungsregel dasselbe Label von allein. Wenn nein (discourse hat kein
getrenntes frontend-Modulverzeichnis), darf nichts erzwungen werden.

**Verworfene Alternative: Domäne konfigurierbar machen.** Widerspricht
„fremde Codebase ohne Vorbereitung". Später optional, nicht Ersatz.

## 4. Architektur

| Schicht | Datei                  | Änderung                                          |
| ------- | ---------------------- | ------------------------------------------------- |
| Node    | `_segment-spread.ts`   | nur nutzen (P0-13)                                |
| Node    | `_heuristics.ts`       | `detectDomain` / `detectModule` + Index-Parameter |
| Node    | `_file-context.ts`     | Index einmal bauen, an Heuristiken durchreichen   |
| Node    | Graph-Builder-Einstieg | Dateipfadliste vor `ensureFileContext`-Schleife   |

Vertrag: `detectDomain(filePath)` ohne Index bleibt für Tests möglich und
verhält sich wie bisher **oder** dokumentiert Breaking Change — **Entscheidung:
ohne Index → bisheriges Verhalten**, damit isolierte Unit-Tests nicht alle
brechen. Mit Index → neues Verhalten. Produktionspfad übergibt immer den Index.

## 5. Edge Cases

- **Nur schichtzuerst (discourse `app/`):** Kein Domänen-Kandidat →
  `unassigned` + `domainSource: "none"`. P0-14 darf später überschreiben.
  Domänenzahl darf gegenüber „alles = app" **sinken** — das ist hier erlaubt,
  weil „app" keine Fachdomäne war. Gegenkriterium: keine Fake-Domäne
  `models`/`controllers`.
- **browo-hr:** ≥ 30 Domänen-Labels; enthält `leaves`, `auth`,
  `documents`; enthält **nicht** `modules` als Domäne.
  **Payroll:** Im Repo oft nur `payroll-adjustments` / `payroll-collections` /
  `payroll-rules` — **kein** bare `payroll/`. Abnahme: mindestens ein
  Domänen-Label `payroll-*` (oder wörtlich `payroll`, falls Ordner existiert).
  Issues und Acceptance dürfen nicht „Domain = payroll“ verlangen, wenn der
  Baum nur hyphenierte Module hat.
- **erpnext:** Domänen wie `accounts`, `buying`, `crm` erscheinen (Streuung
  niedrig). `erpnext` als alleinige Domäne ist ein Fail. Softort nutzt den
  Walk-`pathCatalog` (nicht nur Fact-Export-Pfade), damit Fachmodule nicht
  durch dünne Fact-Selektion verhungern.
- **Monorepo ohne Fachordner darunter:** Domäne = `apps/web` (Präfix-Rückfall).
- **Leeres Repo:** Index leer, alle `unassigned`.
- **P0-7 noch nicht gemerged:** Dieses Issue blockiert — Duplikate verfälschen
  Streuung und Domänenknoten.
- **Enrichment ON:** Demo-Pfade durch denselben Pfad; Demo-Tests anpassen falls
  Labels sich ändern, Regel nicht zurückbiegen.

## 6. User Journey

**Vorher:** Architecture = 499× „DOMAIN backend".

**Nachher (domänenzuerst):** Distrikte `leaves`, `payroll-*` / `auth`, …  
**Nachher (schichtzuerst, vor P0-14):** ehrlicher Zustand „Nicht zugeordnet"
mit Banner (siehe 13), nicht eine Fake-Domäne `app`.

## 7. Akzeptanzkriterien

- [ ] Produktionspfad übergibt immer einen `SegmentSpreadIndex` an
      `detectDomain` / `detectModule`.
- [ ] **browo-hr, Enrichment OFF:** ≥ 30 distinct Domänen-Labels; enthält
      `leaves`, `auth`, `documents`; enthält nicht `modules` als
      Domänen-Label. Payroll: Domäne `payroll` **oder** mindestens ein
      `payroll-*` (browo hat oft keinen bare `payroll/`-Ordner).
- [ ] **discourse, Enrichment OFF:** Kein Domänen-Label `models`,
      `controllers`, `serializers` aus dem `app/`-Baum. Pfade unter `app/`
      ohne Plugin: überwiegend `unassigned` oder `domainSource: "none"`.
- [ ] **erpnext, Enrichment OFF:** Mindestens 5 Domänen-Labels aus dem
      Fachbaum (z. B. accounts/buying/crm/stock/…); nicht nur `erpnext`.
      `pathCatalog` aus dem Walk speist Segment-Spread (nicht nur Fact-Pfade).
- [ ] **immich, Enrichment OFF:** Keine Verschlechterung durch Fake-Domänen
      `controllers`/`services` als Domain-Kind. `domainSource: "none"` für
      typische `server/src/services/*.ts` ist akzeptabel bis P0-14.
- [ ] Keine `STRUCTURAL_SEGMENTS`-Liste in `_heuristics.ts`.
- [ ] `detectLayer` und `inferRuntime` unverändert.
- [ ] Graph-Knoten tragen Metadaten `domainSource: "path" | "none"` (siehe 12).

## 8. Tests

**Anpassen / neu** in `_heuristics.test.ts`:

- `"with spread index, nested module directory yields business domain"` —
  Index aus browo-ähnlichen Pfaden, Datei
  `backend/app/modules/leaves/x.ts` → Domäne `leaves`, `domainSource: "path"`.
- `"without index, legacy first-segment behavior remains"` — Regression.
- `"layer-first app tree yields none"` — discourse-ähnliche Pfade im Index,
  Datei `app/models/topic.rb` → Domäne `unassigned`, `domainSource: "none"`.
- `"erpnext accounts path yields accounts"` — mit Index.
- `"no STRUCTURAL list required"` — Meta: Datei enthält die Strings nicht.

**Golden-Set:** `distinctDomains` min für Fixture aus P0-5 anpassen, nachdem
das Fixture gemessen wurde.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run test:run -- _heuristics
npm run test:run -- _file-context
npm run golden-set
```

Tabelle im PR:

| Repo | Domänen vorher | nachher | domainSource path % | none % |
| ---- | -------------- | ------- | ------------------- | ------ |

Screenshots Architecture browo-hr vorher/nachher.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei                                                                          | Was                                 |
| ------------------------------------------------------------------------------ | ----------------------------------- |
| `local-engine/src/services/software-graph/_heuristics.ts`                      | Signatur + Logik Domain/Modul       |
| `local-engine/src/services/software-graph/_file-context.ts`                    | Index durchreichen                  |
| Graph-Builder-Orchestrierung (Datei, die `ensureFileContext` in Schleife ruft) | Index einmal vor der Schleife bauen |
| Tests / Golden-Set                                                             | siehe 8                             |

### Neu anzulegen

Keine (P0-13 liefert das Modul).

### Nicht anfassen

| Datei                           | Grund                                                                      |
| ------------------------------- | -------------------------------------------------------------------------- |
| `_segment-spread.ts` Konstanten | Kalibrierung ist P0-13; hier nur lesen                                     |
| Dateinamen-Parsing              | P0-14                                                                      |
| `detectLayer` / `inferRuntime`  | unverändert                                                                |
| UI-Banner-Implementierung       | Text aus 13 darf minimal in Architecture; volles Banner-Design ist Welle D |

## 11. Umsetzungsschritte

**Schritt 1 — Signatur erweitern** nach 12.1.

**Schritt 2 — Auswahlalgorithmus** nach 12.3 in `detectDomain` / `detectModule`.

**Schritt 3 — Builder:** vor der Dateischleife
`buildSegmentSpreadIndex(paths)` → an `ensureFileContext` → Heuristiken.

**Schritt 4 — Metadaten** `domainSource` am Domain-Knoten und optional am
File-Knoten setzen.

**Schritt 5 — Tests + Repo-Tabelle.**

## 12. Exakte Vorgaben

### 12.1 Signaturen

```ts
export type DomainSource = "path" | "none";

export interface DomainDetection {
  domain: string;
  module: string;
  domainSource: DomainSource;
}

export function detectDomain(filePath: string, spread?: SegmentSpreadIndex): string;

export function detectModule(filePath: string, domain: string, spread?: SegmentSpreadIndex): string;

/** Preferred entry for production. */
export function detectDomainAndModule(
  filePath: string,
  spread: SegmentSpreadIndex,
): DomainDetection;
```

`detectDomain` / `detectModule` ohne `spread`: **exakt bisheriges Verhalten**
(First-Segment / bestehende Modul-Logik). Mit Aufruf über
`detectDomainAndModule` im Produktionspfad.

### 12.2 Platzhalter

```ts
export const UNASSIGNED_DOMAIN = "unassigned";
```

UI-Label später: `Nicht zugeordnet`. Nie als Domäne verkaufen, die „gefunden"
wurde.

### 12.3 Algorithmus `detectDomainAndModule`

```
parts = normalizePath(filePath).split("/").filter(Boolean)
entferne Dateiname (letztes Segment)
optional: wenn parts[0] in {apps, packages, ee} und parts[1]:
  monorepoPrefix = parts[0]+"/"+parts[1]
  scanParts = parts.slice(2)
sonst:
  monorepoPrefix = null
  scanParts = parts

candidates = []
für jedes segment in scanParts:
  entry = spread.byKey.get(segment.toLowerCase())
  wenn entry und isDomainCandidate(entry): candidates.push(entry.label)

wenn candidates.length >= 1:
  return { domain: candidates[0], module: candidates[1] ?? candidates[0], domainSource: "path" }
wenn monorepoPrefix:
  return { domain: monorepoPrefix, module: monorepoPrefix, domainSource: "path" }
return { domain: UNASSIGNED_DOMAIN, module: UNASSIGNED_DOMAIN, domainSource: "none" }
```

## 13. Verständlichkeit

Wenn ≥ 30 % der Dateiknoten `domainSource: "none"` haben, zeigt Architecture
(oder Atlas) einen Hinweis, wörtlich:

> `In diesem Projekt stecken die Fachbereiche kaum in Ordnernamen. VisuDEV hat
sie deshalb noch nicht aus dem Pfad abgeleitet.`

Nach P0-14 darf der Text auf Dateinamen-Ableitung verweisen. In diesem Issue
reicht der obige Satz.

## 14. Häufige Fehlannahmen

**„Ich baue STRUCTURAL_SEGMENTS wieder ein, nur kürzer."**
Nein. P0-13 ersetzt das.

**„discourse muss genauso viele Domänen bekommen wie browo-hr."**
Nein. discourse ist schichtzuerst. Hier ist ehrliches `none` richtig; P0-14
kommt danach.

**„Frontend und Backend müssen immer dieselbe Domäne teilen."**
Nur wenn der Pfad denselben Kandidaten liefert. Nicht erzwingen.

**„Ohne Index das neue Verhalten."**
Nein. Ohne Index = Legacy, damit Tests und Call-Sites nicht still brechen.

**„Ich kalibriere Schwellen in diesem Issue neu."**
Nein. Schwellen kommen aus P0-13. Wenn sie falsch sind: P0-13 nachziehen, nicht
hier hardcoden.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma
rg -n "STRUCTURAL_SEGMENTS|SURFACE_SEGMENTS|LAYER_SEGMENTS" \
  local-engine/src/services/software-graph/_heuristics.ts
# erwartet: keine Treffer

git diff -- local-engine/src/services/software-graph/_heuristics.ts \
  | rg "detectLayer|inferRuntime"
# erwartet: keine inhaltliche Änderung an diesen Funktionen

npm run typecheck
npm run test:run
npm run golden-set
npm run lint
```

## Regeln für den Umsetzer

1. **Nur Pfad-Domänen.** Dateinamen = P0-14.
2. **Kein Test wird abgeschwächt**, außer Legacy-Erwartungen, die First-Segment
   als Fachdomäne festschrieben — einzeln im PR begründen.
3. **Keine Namenslisten.**
4. **Keine repo-spezifischen Literale** (`browo`, `backend/app/modules`).
5. **Bei Unklarheit anhalten.**
