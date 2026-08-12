# P0-6 — Sicherheitsbefunde prüfen keinen Code

Label: `opus-fix`
Phase: 0, Welle A · **Abhängig von P0-8** (Fakten müssen erst exportiert werden)
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Das Produktversprechen aus dem Original-Konzept lautet wörtlich:

> „Lückenlos — jede Verbindung mit Nachweis (Code oder Runtime)"

Der Nutzer hat als Anwendungsfälle unter anderem „fremde Codebase bewerten
(Audit, Übernahme, Kunde)" und „das System jemandem zeigen" bestätigt. In
beiden Fällen werden die Sicherheitsbefunde aus VisuDEV gegenüber Dritten
vertreten.

Ein Wahrheits-Audit gegen `browo-hr` (SHA `24dd57cb`, Enrichment nachweislich
aus) hat jede Behauptung des Analyzers gegen den Quellcode gehalten. Die
Routen- und Schema-Extraktion war dabei nahezu fehlerfrei — 372 von 372 Routen
exakt bei Datei, Zeile und Methode, 125 von 125 Prisma-Modellen korrekt. Die
Sicherheitsbefunde sind es nicht.

Historie: Der Kommentar im Dateikopf verweist auf `visudev-gapclose P0-4`
(„prefer authenticates/validates/data edges over snippet-only `?`"). Damals
wurde das Problem behandelt, dass zu viele Zellen `?` zeigten. Die Lösung
bestand darin, `?` durch eine Annahme zu ersetzen. Damit wurde ein sichtbares
Nichtwissen in eine unsichtbare Falschaussage umgewandelt.

## 2. Problem

**199 von 200 `missing-auth`-Findings sind widerlegbar.** Für jede der 200
gemeldeten Routen wurde der vollständige, klammerbalancierte
`router.<method>(...)`-Ausdruck aus der Quelle gelesen. 199 tragen einen
expliziten Guard im Aufruf selbst.

Beispiel `backend/app/modules/gamification/gamification.routes.ts:73`:

```ts
router.patch(
  "/achievements/:id",
  authorize("hr.admin.benefits.manage"),
  asyncHandler(controller.updateAchievement.bind(controller)),
);
```

VisuDEV meldet dazu: _„Route PATCH /api/gamification/achievements/:id appears
to lack an auth guard."_ In derselben Datei steht zusätzlich
`router.use(authMiddleware)`.

Die einzige Route ohne Guard ist `POST /2fa/verify`, und dort ist es Absicht —
sie läuft vor der Anmeldung.

**Der Beweis, dass hier nichts geprüft wird, ist arithmetisch.** Es gibt genau
208 mutierende Routen und genau 208 `missing-validation`-Findings. Eins zu
eins. Die `missing-auth`-Findings sind dieselben 208 minus die acht, für die
zufällig ein Fakt überlebt hat. Auf keiner einzigen der 164 GET-Routen feuert
eine der beiden Regeln. **Die Findings sind eine Umbenennung der
HTTP-Methode.**

### Die verursachende Stelle

```143:159:shared/blueprint-graph-inference.ts
function resolveAuthState(
  route: NormalizedRoute,
  hasAuthEvidence: boolean,
): ProjectedSecurityMatrixRow["auth"]["state"] {
  if (hasAuthEvidence) return "confirmed";
  if (MUTATING_METHODS.has(route.method)) return "missing";
  return "unknown";
}

function resolveValidationState(
  route: NormalizedRoute,
  hasValidationEvidence: boolean,
): ProjectedSecurityMatrixRow["validation"]["state"] {
  if (hasValidationEvidence) return "confirmed";
  if (MUTATING_METHODS.has(route.method)) return "missing";
  return "unknown";
}
```

Zeile 148 und Zeile 157 sind der Defekt. Ohne Evidenz und bei mutierender
Methode wird `missing` zurückgegeben. `missing` bedeutet in der Security-Matrix
„nachweislich nicht vorhanden". Tatsächlich bedeutet es hier ausschließlich
„wir haben keine Daten und die Methode ist nicht GET".

### Warum keine Evidenz vorliegt

Nicht weil es keine gibt. Der Analyzer extrahiert intern **402
`auth-check`-Fakten** und **148 `validation-deny-400`-Fakten**. Exportiert
werden insgesamt nur 483 von 6204 Fakten, weil `graph-export-cap.ts:13` bei
`MAX_BLUEPRINT_FACTS = 500` abschneidet. Für 340 von 372 Routen kommt deshalb
gar keine Evidenz an. Das ist P0-8 und deshalb Voraussetzung für dieses Issue.

### Nachgelagerter Defekt: die Evidenz-Erkennung ist zu grob

```13:18:shared/blueprint-graph-inference.ts
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AUTH_EVIDENCE_PATTERN = /auth|middleware|protect|guard|session|jwt|oauth|authorize/i;
const VALIDATION_EVIDENCE_PATTERN =
  /zod|joi|yup|validator|validate|schema|body\(|query\(|params\(|class-validator|IsString|IsEmail/i;
```

`AUTH_EVIDENCE_PATTERN` prüft, ob irgendwo im Snippet eines Fakts das Wort
„auth" oder „session" vorkommt. Ein Kommentar `// TODO: add auth` genügt für
`confirmed`. Die Regel liefert also in beide Richtungen falsche Ergebnisse.

Zusätzlich sind die beiden Regeln unterschiedlich weit gefasst, ohne dass das
begründet wäre: `inferAuthState` (Zeile 161-169) verwendet
verzeichnisbezogene Fakten, `inferValidationState` (Zeile 171-181) beschränkt
zusätzlich auf `fact.filePath === route.filePath`.

### Was korrekt ist und bleiben muss

Die 19 High-Findings (`access-control.tenant-isolation-missing`) sind
**inhaltlich zutreffend**: `model LeaveRequest` in `schema.prisma:965` hat
wirklich keine `organizationId`-Spalte und es gibt keine RLS. Sie sind nur
willkürlich ausgewählt — sie treffen ausschließlich die 19 Leave-Routen, weil
das die einzigen sind, für die DB-Fakten den Export überlebt haben. Rund 350
weitere Routen haben dasselbe Problem und werden nicht gemeldet.

### Auswirkung

Das Werkzeug behauptet, eine Anwendung sei unsicher, wo sie es nicht ist. Wer
den Befunden folgt, arbeitet 199 nicht existierende Lücken ab. Wer sie einmal
als falsch erkennt, glaubt danach auch den 19 richtigen nicht mehr. Beides
zerstört den Zweck der Diagnostics-Ansicht vollständig.

## 3. Lösung

**Grundregel: `missing` erfordert positive Evidenz der Abwesenheit. Fehlende
Daten ergeben `unknown`.**

Die Zustandsermittlung bekommt eine dritte Eingabe neben „Evidenz gefunden"
und „Methode": ob die Route überhaupt **prüfbar** war.

Eine Route ist prüfbar, wenn alle drei Bedingungen erfüllt sind:

1. Die definierende Datei wurde erfolgreich geparst (nicht an einem stillen
   Parser-Fehler gescheitert, siehe P0-9).
2. Der Registrierungsausdruck der Route wurde extrahiert.
3. Für die Datei liegen überhaupt Fakten vor.

Daraus ergibt sich:

| Evidenz | Prüfbar | Ergebnis    |
| ------- | ------- | ----------- |
| ja      | –       | `confirmed` |
| nein    | ja      | `missing`   |
| nein    | nein    | `unknown`   |

Die Methode (`POST` gegen `GET`) fließt **nicht mehr** in die Entscheidung ein.
Sie war nie ein Indiz für das Fehlen eines Guards, sondern nur ein Indiz dafür,
dass ein Guard wünschenswert wäre. Diese zweite Aussage gehört in die
Priorisierung eines Befunds, nicht in seine Feststellung.

Zusätzlich wird die Evidenz-Erkennung enger gefasst: Es zählt nur ein Fakt vom
Typ `auth-check` beziehungsweise `validation-deny-400`, nicht ein
Wortvorkommen in einem beliebigen Snippet. Die Fakt-Typen existieren bereits im
Analyzer.

**Verworfene Alternative: die Regex verschärfen.** Das Problem ist nicht die
Trefferquote des Musters, sondern dass bei null Treffern eine Behauptung
aufgestellt wird. Eine bessere Regex würde weiterhin 340 Routen ohne Daten als
`missing` melden.

**Verworfene Alternative: `missing` beibehalten und im UI als „vermutet"
kennzeichnen.** Eine gekennzeichnete Falschaussage bleibt eine Falschaussage,
und die Diagnostics-Liste wäre weiterhin zu 98 % Rauschen.

**Verworfene Alternative: die Regel ganz entfernen.** Dann verschwinden auch
die richtigen Befunde. Das Ziel ist eine Regel, die weniger, aber wahre
Aussagen macht.

## 4. Architektur

Betroffen ist die geteilte Inferenzschicht und ihre beiden Verbraucher — Deno
und Node nutzen dieselbe Datei.

| Schicht | Datei                                                       | Änderung                                                                 |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| shared  | `shared/blueprint-graph-inference.ts`                       | Zustandsermittlung, Prüfbarkeit, engere Evidenz                          |
| shared  | `shared/blueprint-graph-types.ts`                           | `ProjectedCodeFact` um `kind` erweitern, falls nicht vorhanden           |
| Deno    | `.../blueprint/internal/fact-extractors.ts`                 | Fakt-Typen `auth-check` / `validation-deny-400` unverändert durchreichen |
| Node    | `local-engine/src/services/blueprint-enrichment.service.ts` | Prüfbarkeits-Information an die Inferenz übergeben                       |

Quelle der Wahrheit für „prüfbar" ist der Analyzer, nicht die Inferenz. Die
Inferenz darf nicht raten, ob eine Datei geparst wurde.

## 5. Edge Cases

- **Route absichtlich ohne Guard** (Login, Health, Webhook mit
  Signaturprüfung): Wird korrekt als `missing` gemeldet. Das ist richtig — es
  ist ein Befund, keine Behauptung eines Fehlers. Der Befundtext darf nicht
  „Sicherheitslücke" lauten, sondern „kein Guard erkannt".
- **`router.use(authMiddleware)` auf Router-Ebene**: Gilt für alle Routen des
  Routers. Wird diese Form nicht erkannt, entstehen erneut Falsch-Positive.
  Solange sie nicht als Fakt vorliegt, ist die Route `unknown`, nicht
  `missing`.
- **Guard über einen Wrapper** (`asyncHandler(protect(handler))`): Verschachtelte
  Aufrufe. Wenn der Extraktor die Verschachtelung nicht auflöst, ist die Route
  `unknown`.
- **Datei nicht geparst** (95 von 394 bei browo-hr): Immer `unknown`. Nie
  `missing`.
- **Datei außerhalb des Analyse-Umfangs** (FILE_LIMIT): Die Route existiert
  dann gar nicht im Graphen. Kein Sonderfall, aber der Befundzähler darf nicht
  suggerieren, das Projekt sei vollständig geprüft.
- **GET-Route ohne Guard**: Bisher nie gemeldet. Nach der Änderung wird sie
  gemeldet, wenn sie prüfbar ist und keinen Guard hat. Das ist beabsichtigt —
  eine ungeschützte GET-Route auf personenbezogene Daten ist ein echter Befund.
  Die Severity darf niedriger sein als bei mutierenden Methoden.
- **Enrichment ON**: Der Demo-Graph liefert eigene Fakten. Das Verhalten dort
  darf sich ändern; die Demo-E2E-Tests werden entsprechend angepasst, nicht
  die Regel zurückgebogen.
- **Kein einziger Fakt im gesamten Projekt**: Die Matrix zeigt durchgehend
  `unknown` und einen Leerzustand nach Vorlage 13.1 mit dem Grund. Sie zeigt
  nicht 372 rote Zeilen.

## 6. User Journey

**Vorher:** Der Nutzer öffnet Diagnostics für browo-hr und sieht 200 Meldungen
„lacks an auth guard". Er prüft die erste, findet den Guard in der Zeile, prüft
die zweite, findet ihn wieder. Ab der dritten glaubt er dem Werkzeug nicht mehr
— auch nicht bei den 19 zutreffenden Tenant-Isolation-Befunden.

**Nachher:** Er sieht eine kurze Liste tatsächlich prüfbarer Befunde, jeder mit
Codestelle und Beleg. Daneben steht, für wie viele Routen keine Aussage möglich
war und warum. Er kann der Liste vertrauen, weil sie zugibt, was sie nicht
weiß.

## 7. Akzeptanzkriterien

- [ ] `resolveAuthState` und `resolveValidationState` geben `missing`
      ausschließlich zurück, wenn die Route prüfbar war und keine Evidenz
      gefunden wurde.
- [ ] Die HTTP-Methode beeinflusst die **Zustandsermittlung** nicht mehr. Eine
      Volltextsuche nach `MUTATING_METHODS` in `resolveAuthState` und
      `resolveValidationState` liefert keine Treffer.
- [ ] Evidenz wird über den Fakt-Typ bestimmt, nicht über ein Wortmuster im
      Snippet.
- [ ] **Enrichment OFF auf browo-hr:** Höchstens 5 `missing-auth`-Findings, und
      für jedes davon ist im PR die Codestelle zitiert, die belegt, dass dort
      wirklich kein Guard steht.
- [ ] **Enrichment OFF auf browo-hr:** `PATCH /api/gamification/achievements/:id`
      wird **nicht** als `missing-auth` gemeldet.
- [ ] **Enrichment OFF auf browo-hr:** `POST /api/organigram/settings-changes`
      wird **nicht** als `missing-validation` gemeldet
      (`organigram.controller.ts:320` validiert per `safeParse`).
- [ ] Die 19 `access-control.tenant-isolation-missing`-Findings bleiben
      erhalten.
- [ ] Die Anzahl der Routen mit Zustand `unknown` wird im UI genannt, nicht
      verschwiegen.
- [ ] Der Befundtext für einen fehlenden Guard lautet „kein Guard erkannt",
      nicht „Sicherheitslücke".

## 8. Tests

**Neu** in `shared/blueprint-graph-inference.test.ts`:

- `"mutating route without facts is unknown, not missing"` — Route `POST`,
  keine Fakten, Datei nicht prüfbar → `unknown`.
- `"mutating route in parsed file without auth fact is missing"` — Route `POST`,
  Datei geparst, Fakten vorhanden aber kein `auth-check` → `missing`.
- `"GET route in parsed file without auth fact is missing"` — belegt, dass die
  Methode keine Rolle mehr spielt.
- `"auth-check fact yields confirmed"`.
- `"comment mentioning auth does not yield confirmed"` — Fakt mit Snippet
  `// TODO: add auth` und Typ ungleich `auth-check` → nicht `confirmed`.
- `"validation state follows the same rules as auth state"` — dieselbe Matrix
  für `resolveValidationState`.

**Neu** als Regressionstest gegen echte Daten: In den Golden-Set-Job aus P0-5
kommt eine Obergrenze für `missing-auth`-Findings im Fixture-Repo. Das Fixture
hat laut P0-5 genau eine Route ohne Guard (`orders.route.ts` ohne
`auth.middleware.ts`); der Job prüft, dass genau eine gemeldet wird.

**Anzupassen:** Bestehende Tests, die für eine mutierende Route ohne Fakten
`missing` erwarten. Vermerk: Sie schrieben die Fehlregel als Spezifikation
fest.

**Zu löschen:** Nichts pauschal. Jeder betroffene Test wird einzeln geprüft und
im PR begründet.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run test:run -- blueprint-graph-inference
node scripts/golden-set/run.mjs
```

Danach vollständiger Lauf gegen browo-hr mit Enrichment OFF und Auszählung:

```bash
# Anzahl missing-auth vor und nach der Änderung
```

Der PR enthält:

1. Die Zahl der `missing-auth`-Findings vorher (200) und nachher.
2. Für jedes verbleibende Finding die zitierte Codestelle als Beleg.
3. Die Zahl der Routen mit Zustand `unknown` und die Begründung dafür.

Evidence-Datei `visudev-test-repos/evidence/REAL-PROJECTS-SUMMARY.md`
aktualisieren. Der Wahrheits-Audit unter
`visudev-test-repos/evidence/blueprint-truth-audit-2026-08-11/` ist die
Referenz für den Vorher-Zustand.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei                                                       | Was passiert                                                              |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `shared/blueprint-graph-inference.ts`                       | Kern der Änderung: Prüfbarkeit, Zustandsermittlung, Evidenz über Fakt-Typ |
| `shared/blueprint-graph-inference.test.ts`                  | Neue Tests, bestehende anpassen                                           |
| `local-engine/src/services/blueprint-enrichment.service.ts` | Prüfbarkeits-Information an die Inferenz durchreichen                     |
| `scripts/golden-set/run.mjs`                                | Obergrenze für `missing-auth` ergänzen                                    |
| `tests/fixtures/golden-repo/expected-metrics.json`          | Neue Kennzahl `missingAuthFindings` mit `max`                             |

### Neu anzulegen

Keine neuen Dateien.

### Nicht anfassen

| Datei / Bereich                                                         | Grund                                                                                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `graph-export-cap.ts`                                                   | Der Fakten-Deckel ist P0-8                                                                                                   |
| `ast-call-graph.ts`, `import-resolver.ts`, `fact-metadata-sanitizer.ts` | Gehören zu P0-9                                                                                                              |
| `_ids.ts`, `_file-context.ts`                                           | Knoten-Duplikate sind P0-7                                                                                                   |
| `_heuristics.ts`                                                        | Domänen-Erkennung ist P0-10                                                                                                  |
| Alle Dateien unter `src/modules/blueprint/components/`                  | Die UI-Darstellung der Matrix ist nicht Teil dieses Issues. Ausnahme: der Befundtext aus Abschnitt 12.4, falls er dort liegt |
| `shared/demo-graph-seed.ts`                                             | Der Demo bleibt unverändert                                                                                                  |

## 11. Umsetzungsschritte

**Schritt 1 — Prüfbarkeit als Datum einführen.**
In `shared/blueprint-graph-types.ts` prüfen, ob `ProjectedCodeFact` ein
`kind`-Feld hat. Falls nicht, ergänzen und in den Erzeugern befüllen. Ohne
Fakt-Typ ist Schritt 3 nicht umsetzbar.

**Schritt 2 — `RouteAnalyzability` ermitteln.**
In `buildRouteFactsIndexes` (`blueprint-graph-inference.ts:112-134`) zusätzlich
pro Route bestimmen, ob Fakten für ihre Datei vorliegen. Ergebnis als vierten
Eintrag in `RouteFactsIndexes` aufnehmen. Die Schnittstelle
`RouteFactsIndexes` ist in Zeile 22-27 definiert; alle Verwender müssen
angepasst werden — `buildRouteFactsIndex` (Zeile 136-141) ist der einzige
weitere Aufrufer in dieser Datei.

**Schritt 3 — Evidenz über Fakt-Typ.**
`inferAuthState` (Zeile 161-169) und `inferValidationState` (Zeile 171-181)
prüfen statt `AUTH_EVIDENCE_PATTERN.test(fact.snippet)` künftig
`fact.kind === "auth-check"` beziehungsweise
`fact.kind === "validation-deny-400"`.

Die Muster `AUTH_EVIDENCE_PATTERN` und `VALIDATION_EVIDENCE_PATTERN` (Zeile
14-16) bleiben zunächst als **Zweitprüfung** erhalten und dürfen nur greifen,
wenn kein typisierter Fakt vorliegt — sie führen dann aber zu `partial`, nicht
zu `confirmed`. `ROLE_EVIDENCE_PATTERN` (Zeile 17-18) bleibt unverändert.

**Schritt 4 — Zustandsermittlung umbauen.**
`resolveAuthState` und `resolveValidationState` (Zeile 143-159) auf die Signatur
und Logik aus Abschnitt 12.1 umstellen. `MUTATING_METHODS` bleibt als Konstante
bestehen, wird aber in diesen beiden Funktionen nicht mehr verwendet — es dient
weiterhin der Severity-Einstufung.

**Schritt 5 — Severity anpassen.**
Ein `missing` bei mutierender Methode behält die bisherige Severity. Ein
`missing` bei `GET` bekommt eine Stufe niedriger.

**Schritt 6 — Befundtext ändern** nach Abschnitt 12.4.

**Schritt 7 — Tests.**

**Schritt 8 — Golden-Set-Grenze ergänzen.**

**Schritt 9 — Gegen browo-hr laufen lassen** und die Zahlen für den PR
dokumentieren.

## 12. Exakte Vorgaben

### 12.1 Signaturen

```ts
type RouteAnalyzability = "analyzable" | "not-analyzable";

function resolveAuthState(
  hasAuthEvidence: boolean,
  analyzability: RouteAnalyzability,
): ProjectedSecurityMatrixRow["auth"]["state"] {
  if (hasAuthEvidence) return "confirmed";
  if (analyzability === "analyzable") return "missing";
  return "unknown";
}
```

`resolveValidationState` erhält dieselbe Form. Der Parameter `route` entfällt
in beiden Funktionen, weil die Methode keine Rolle mehr spielt.

### 12.2 Erweiterung von `RouteFactsIndexes`

```ts
export interface RouteFactsIndexes {
  routeFactsIndex: Map<string, ProjectedCodeFact[]>;
  factsByFilePath: Map<string, ProjectedCodeFact[]>;
  authByDirectory: Map<string, boolean>;
  validationByFile: Map<string, boolean>;
  /** "analyzable", wenn für die Datei der Route überhaupt Fakten vorliegen. */
  analyzabilityByRouteId: Map<string, RouteAnalyzability>;
}
```

### 12.3 Fakt-Typen

Exakt diese Zeichenketten, wie sie der Analyzer bereits erzeugt:

```
auth-check
validation-deny-400
```

### 12.4 Befundtexte

Wörtlich, deutsch:

| Zustand                | Titel                          | Beschreibung                                                                                                                                     |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `missing` (Auth)       | `Kein Auth-Guard erkannt`      | `In {file}:{line} wurde bei der Registrierung dieser Route kein Auth-Guard gefunden. Wenn die Route absichtlich offen ist, ist das kein Fehler.` |
| `missing` (Validation) | `Keine Eingabeprüfung erkannt` | `In {file}:{line} wurde keine Validierung der Eingabedaten gefunden.`                                                                            |
| `unknown`              | `Nicht prüfbar`                | `Für {file} liegen keine Analysedaten vor. Diese Route wurde nicht geprüft.`                                                                     |

Verboten sind die Wörter „Sicherheitslücke", „unsicher" und „vulnerable" in
Befunden, die aus dem Fehlen von Evidenz entstehen.

### 12.5 Golden-Set-Kennzahl

```json
"missingAuthFindings": { "measured": 1, "max": 1 }
```

Das Fixture aus P0-5 hat genau eine Route ohne Guard. Diese Kennzahl prüft eine
**Obergrenze**, nicht eine Untergrenze — anders als alle übrigen.

## 13. Verständlichkeit

**Leerzustand:** Wenn für kein einziges Route-Datei-Paar Fakten vorliegen,
zeigt die Security-Matrix den Zustand `not-analyzed` mit dem Text: „Für dieses
Projekt liegen keine Analysedaten zur Sicherheit vor. Geprüft wurden {n} von
{m} Dateien." Nicht 372 graue Zeilen.

Bei leerer Findings-Liste gilt Vorlage 13.1: Die Zahl der geprüften **und** der
nicht prüfbaren Regeln muss genannt werden, sonst liest ein Laie „keine
Befunde" als „alles sicher".

**Erklärung:** Die drei Zustände `confirmed`, `missing` und `unknown` brauchen
je einen Glossareintrag. Insbesondere muss der Unterschied zwischen „nicht
gefunden" und „nicht geprüft" für einen Laien in einem Satz erklärt sein. Ein
Fachbegriff wie „Guard" bekommt einen eigenen Eintrag.

**Verknüpfte Hervorhebung:** Ein Klick auf einen Befund soll die betroffene
Codezeile anzeigen. Falls P1-5 noch nicht umgesetzt ist, genügt in diesem Issue
die Anzeige von `{file}:{line}` als Text; die Verlinkung wird auf P1-5
verschoben.

**Nachweis:** Screenshot der Matrix mit Zuständen, Screenshot des
Leerzustands, Screenshot eines Befunds mit Codestelle.

## 14. Häufige Fehlannahmen

**„Weniger Findings ist ein Rückschritt."**
Falsch. Von 200 sind 199 unwahr. Fünf wahre Befunde sind wertvoller als 200
Meldungen, von denen keine geglaubt wird. Wenn nach der Änderung sehr wenige
Befunde übrig bleiben, ist das das korrekte Ergebnis und kein Grund, die Regel
aufzuweichen.

**„Eine mutierende Route ohne Guard ist doch offensichtlich ein Problem."**
Das stimmt — aber nur, wenn man weiß, dass sie keinen Guard hat. Der Defekt
ist nicht die Schlussfolgerung, sondern dass die Prämisse nie geprüft wurde.

**„Man könnte den Regex einfach besser machen."**
Nein. Das Problem tritt auf, wenn es **null** Fakten gibt, also nichts, worauf
ein Muster angewendet werden könnte. Ein besseres Muster ändert daran nichts.

**„`unknown` ist doch auch nur ein Fragezeichen — das wollte gapclose P0-4
gerade beseitigen."**
Ja, und genau das war der Fehler. Ein Fragezeichen ist eine wahre Aussage über
den Wissensstand. Die Lösung ist nicht, es durch eine Behauptung zu ersetzen,
sondern die Datenlage zu verbessern — das ist P0-8.

**„`ROLE_EVIDENCE_PATTERN` hat denselben Fehler, das fixe ich mit."**
Nein. Die Rollen-Ermittlung hat eine andere Struktur und ist nicht Teil dieses
Issues. Falls dort derselbe Defekt auffällt, im PR unter „Beobachtet, nicht
behoben" vermerken.

**„Die 19 High-Findings sind auch nur Rauschen."**
Nein. Sie sind inhaltlich zutreffend und müssen erhalten bleiben. Dass sie
willkürlich nur die Leave-Routen treffen, liegt an P0-8 und wird dort behoben.

**„Ich sollte gleich auch die fehlenden Fakten durchleiten."**
Nein. Das ist P0-8 und muss **vorher** gemerged sein. Ist es das nicht, kann
dieses Issue nicht abgenommen werden, weil die Akzeptanzkriterien auf echten
Fakten beruhen.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma

# Die Methode beeinflusst die Zustandsermittlung nicht mehr
node -e "const s=require('fs').readFileSync('shared/blueprint-graph-inference.ts','utf8');const f=s.slice(s.indexOf('function resolveAuthState'),s.indexOf('export function inferAuthState'));console.log(f.includes('MUTATING_METHODS')?'FAIL':'OK')"
# erwartet: OK

# Verbotene Wörter in Befundtexten
rg -n "Sicherheitslücke|vulnerable" shared/ local-engine/src/   # erwartet: keine Treffer

npm run typecheck                                # erwartet: exit 0
npm run test:run                                 # erwartet: exit 0
npm run golden-set                               # erwartet: "golden-set: OK (...)"
npm run lint                                     # erwartet: exit 0
```

## Regeln für den Umsetzer

1. **Nur der beschriebene Scope.** Angrenzende Fehler im PR unter „Beobachtet,
   nicht behoben" notieren.
2. **Kein Test wird abgeschwächt, um ihn grün zu bekommen.** Kein `test.skip`,
   keine entfernten Zusicherungen. Tests, die die Fehlregel festschreiben, sind
   in Abschnitt 8 benannt — steht ein Test dort nicht, ist die Implementierung
   falsch, nicht der Test.
3. **Keine neuen Platzhalterwerte.** Fehlende Daten ergeben `unknown` mit
   Begründung.
4. **Keine repo-spezifischen Literale.** Insbesondere keine Sonderregel für
   `authorize(` oder `authMiddleware`, weil browo-hr diese Namen verwendet.
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken.
