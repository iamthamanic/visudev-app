# P0-9 — Null Import- und Aufruf-Kanten: der Graph ist ein Baum, kein Graph

Label: `opus-fix`
Phase: 0, Welle A · **Nach P0-8** (ohne exportierte `ast-import`-Fakten gibt es nichts zu verbinden)
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

Die Dependencies-Ansicht ist im Original-Konzept mit der Aufgabe beschrieben:

> „Imports, Funktionsaufrufe, API-Zugriffe, DB-Zugriffe und Events"

Der Nutzer hat als wichtigste Frage an das Werkzeug bestätigt: *„Was hängt an
dieser Datei, wenn ich sie ändere?"* Diese Frage lässt sich ausschließlich über
Import- und Aufrufkanten beantworten. Ohne sie hat VisuDEV keinen
Anwendungsfall.

## 2. Problem

Im Graphen von `browo-hr` (SHA `24dd57cb`, Enrichment aus) sind **0 Kanten vom
Typ `imports` und 0 vom Typ `calls`** enthalten. Bei 2997 Kanten insgesamt sind
2498 vom Typ `contains` und der Rest `references`.

Der Graph ist mathematisch exakt ein Baum: 2498 `contains`-Kanten bei 2499
Knoten, eine Wurzel, keine einzige Querverbindung. Er bildet ausschließlich die
Verzeichnisstruktur ab — eine Information, die auch ein Dateibrowser liefert.

Die Datenlage würde etwas anderes hergeben: **6422 `import`-Anweisungen** im
Repository, davon **1441 im Backend**, davon **919 relativ und damit
auflösbar**.

Es gibt **drei voneinander unabhängige Ursachen**. Jede allein würde genügen,
um alle Kanten zu verhindern. Alle drei müssen behoben werden.

---

### Ursache 1 — Die Metadaten-Allowlist verwirft genau die benötigten Felder

Der Kantenbauer braucht `resolvedPath` beziehungsweise `targetFile`:

```41:49:local-engine/src/services/software-graph/_dependency-edges.ts
  if (fact.kind === "ast-import") {
    edgeKind = "imports";
    targetPath = readResolvedPath(metadata);
  } else if (fact.kind === "ast-call") {
    edgeKind = "calls";
    targetPath = readTargetFile(metadata);
  }

  if (!edgeKind || !targetPath) return;
```

Der Export filtert Metadaten gegen eine Allowlist, in der beide Felder fehlen:

```7:18:src/supabase/functions/visudev-analyzer/module/blueprint/internal/fact-metadata-sanitizer.ts
const ALLOWED_METADATA_KEYS = new Set([
  "method",
  "path",
  "framework",
  "table",
  "operation",
  "status",
  // visudev-gapclose P3-2b: infra-service promotion needs these after export sanitize
  "service",
  "source",
  "provider",
]);
```

Ergebnis: Alle 64 exportierten `ast-import`-Fakten haben `metadata: {}`. Zeile
49 in `_dependency-edges.ts` bricht bei jedem einzelnen ab. **Die Kante kann
strukturell nie entstehen.**

**Ein zweiter, bisher unbemerkter Defekt in derselben Datei:** Selbst nach
Aufnahme in die Allowlist würde der Pfad zerstört. Werte über 64 Zeichen
gelten als sensibel und werden durch `***` ersetzt:

```24:28:src/supabase/functions/visudev-analyzer/module/blueprint/internal/fact-metadata-sanitizer.ts
function looksSensitiveMetadataValue(value: string): boolean {
  if (value.length > MAX_METADATA_STRING_LEN) return true;
  return /@[a-z0-9.-]+\.[a-z]{2,}|\+?\d{10,}|[0-9a-f]{32,}|\d{3}-\d{2}-\d{4}/i
    .test(value);
}
```

`MAX_METADATA_STRING_LEN` ist 64. Ein Pfad wie
`src/supabase/functions/visudev-analyzer/module/blueprint/graph/import-resolver.ts`
hat 79 Zeichen und würde zu `"***"`. Danach schneidet Zeile 39 zusätzlich auf
64 Zeichen. Dateipfade brauchen deshalb eine eigene Behandlung.

---

### Ursache 2 — Der Import-Resolver kennt das TypeScript-NodeNext-Mapping nicht

```3:3:src/supabase/functions/visudev-analyzer/module/blueprint/graph/import-resolver.ts
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];
```

browo-hr verwendet durchgängig ESM-konforme Importe mit `.js`-Endung auf
`.ts`-Dateien — das ist bei `moduleResolution: NodeNext` vorgeschrieben:

```ts
import { LeavesController } from './leaves.controller.js';
```

Der Resolver bildet `base = ".../leaves.controller.js"` und probiert dann
`.../leaves.controller.js.ts`, `.js.tsx`, `.js.js`, `.js.jsx`, `/index.ts`,
`/index.tsx` und den Basispfad selbst. **Keiner dieser Kandidaten ist
`.../leaves.controller.ts`.**

Gemessen: 975 Import-Bindungen gefunden, **2 aufgelöst**.

Zusätzlich fehlen `/index.js`, `/index.jsx`, `.mts` und `.cts` in der Liste,
obwohl `isAstParsableFile` `.mts` und `.cts` als parsbar führt.

---

### Ursache 3 — Der AST-Parser verschluckt Fehler stumm

```65:73:src/supabase/functions/visudev-analyzer/module/blueprint/graph/ast-call-graph.ts
  let ast: AstNode;
  try {
    ast = Parser.parse(content, {
      ecmaVersion: "latest",
      sourceType: "module",
    }) as unknown as AstNode;
  } catch {
    return null;
  }
```

`return null` ohne Zähler, ohne Log, ohne Vermerk im Ergebnis.

Gemessen: **95 von 394 Dateien (24 %) werden nie geparst.** Darunter
`leaves.service.ts` und `auth.controller.ts` — zentrale Dateien. Nach außen
sehen sie aus, als hätten sie keine Abhängigkeiten. Der Unterschied zwischen
„hat keine Importe" und „konnte nicht gelesen werden" ist nirgends sichtbar.

Der Parser ist acorn mit `acorn-typescript`. Die Fehlerquote von 24 % deutet auf
Syntax hin, die das Plugin nicht abdeckt — Decorators, `satisfies`, neuere
Sprachmerkmale. Die Ursachen zu beheben ist **nicht** Teil dieses Issues; sie
sichtbar zu machen schon.

---

### Was ausdrücklich nicht schuld ist

`MAX_FILES = 40` in `call-graph.builder.ts:12` wird häufig als Ursache
vermutet. Die Konstante begrenzt ausschließlich `collectRelatedFiles`, das
keine Kanten erzeugt. Sie ist **nicht** Teil dieses Issues und wird nicht
angefasst.

### Auswirkung

- Die Frage „was hängt an dieser Datei?" ist nicht beantwortbar.
- Dependencies zeigt eine Struktur ohne Beziehungen.
- Der Fan-in, den der Atlas nach der Code-City-Empfehlung auf die Gebäudehöhe
  legen soll, ist für jeden Knoten null. Ohne dieses Issue kann der Atlas nicht
  kodieren.
- Execution kann keine Aufrufketten bilden.
- Blast-Radius bei Pull Requests, ein Kernversprechen des Konzepts, ist
  unmöglich.

## 3. Lösung

Drei getrennte, kleine Korrekturen.

**Zu Ursache 1:** `resolvedpath` und `targetfile` in die Allowlist aufnehmen —
in der **normalisierten**, kleingeschriebenen Form, weil die Prüfung gegen
`normalizeMetadataKey(key)` läuft. Zusätzlich pfadartige Schlüssel von der
Längen-Heuristik ausnehmen und ihnen eine eigene Obergrenze geben.

**Zu Ursache 2:** Vor dem Kandidatenaufbau eine `.js`-, `.jsx`-, `.mjs`- oder
`.cjs`-Endung abtrennen und die TypeScript-Varianten mitprobieren. Die
Endungsliste um die fehlenden Fälle ergänzen.

**Zu Ursache 3:** Parser-Fehler zählen und melden. Das Ergebnis trägt, wie
viele Dateien geparst wurden und wie viele nicht. Die Zahl wandert bis ins UI
(Teil von P0-1).

**Verworfene Alternative: die Allowlist durch eine Denylist ersetzen.** Die
Allowlist ist eine Sicherheitsmaßnahme gegen das versehentliche Ausleiten von
Daten. Sie bleibt.

**Verworfene Alternative: Kanten aus Dateinamen raten.** Widerspricht dem
Belegprinzip.

**Verworfene Alternative: einen anderen Parser einsetzen.** Ein Austausch von
acorn ist ein eigenes, größeres Vorhaben. Dieses Issue macht die Fehlerquote
zuerst sichtbar; ob sie einen Austausch rechtfertigt, entscheidet sich danach
mit Daten.

## 4. Architektur

| Schicht | Datei | Ursache | Änderung |
|---|---|---|---|
| Deno, Export | `internal/fact-metadata-sanitizer.ts` | 1 | Allowlist, Pfadbehandlung |
| Deno, Graph | `graph/import-resolver.ts` | 2 | Endungsauflösung |
| Deno, Graph | `graph/ast-call-graph.ts` | 3 | Fehlerzählung |
| Deno, DTO | `dto/blueprint/blueprint-document.dto.ts` | 3 | Feld `astParseReport` |
| shared | `shared/visudev-api.types.ts` | 3 | Bericht durchreichen |

`_dependency-edges.ts` auf der Node-Seite ist **korrekt** und wird nicht
geändert. Es liest die richtigen Felder; sie kamen nur nie an.

## 5. Edge Cases

- **Import ohne Endung** (`./leaves.controller`): Bisheriges Verhalten,
  funktioniert. Darf nicht brechen.
- **Datei heißt wirklich `foo.js`** und es gibt daneben `foo.ts`: Die
  `.js`-Datei hat Vorrang, weil ein exakter Treffer vor einer Umschreibung
  geprüft wird.
- **Import auf ein Verzeichnis** (`./handlers`): Über die `index`-Varianten
  abgedeckt, jetzt auch für `.js`.
- **Paket-Import** (`react`, `@prisma/client`): `resolveImport` gibt früh
  `null` zurück. Unverändert — externe Pakete sind keine Dateikanten. Sie
  könnten später `external`-Knoten werden, das ist nicht dieses Issue.
- **Pfad-Alias** (`@/lib/utils`): Wird nicht aufgelöst, weil `tsconfig.json`
  nicht gelesen wird. Bekannte Lücke. Im PR unter „Beobachtet, nicht behoben"
  vermerken, damit sie nicht verlorengeht.
- **Zirkulärer Import**: Erzeugt zwei Kanten in beide Richtungen. Korrekt und
  ein wertvoller Befund.
- **Selbstreferenz**: Wird bereits in `_dependency-edges.ts:52` abgefangen.
- **Pfad länger als 512 Zeichen**: Wird abgeschnitten. Der Kantenbauer findet
  die Zieldatei dann nicht und erzeugt keine Kante — kein falscher Nachweis.
- **Datei nicht parsbar**: Keine Kanten. Muss über den Bericht sichtbar sein,
  nicht als „keine Abhängigkeiten" erscheinen.
- **Enrichment ON**: Der Demo-Graph bringt eigene Kanten mit. Die Zahl der
  Kanten in Demo-Tests darf sich nicht ändern.

## 6. User Journey

**Vorher:** Der Nutzer will vor einer Änderung an `leaves.service.ts` wissen,
was daran hängt. Er klickt den Knoten an und sieht keine eingehende und keine
ausgehende Verbindung. Er schließt, die Datei sei isoliert. Tatsächlich wird
sie von 14 Stellen importiert.

**Nachher:** Er sieht die eingehenden und ausgehenden Abhängigkeiten mit Datei
und Zeile. Falls eine Datei nicht geparst werden konnte, steht das dort — nicht
„keine Abhängigkeiten".

## 7. Akzeptanzkriterien

- [ ] **Enrichment OFF auf browo-hr:** Mindestens 500 Kanten vom Typ `imports`.
      Vorher: 0.
- [ ] **Enrichment OFF auf browo-hr:** Der Anteil aufgelöster Importe an den
      gefundenen Bindungen liegt über 60 %. Vorher: 2 von 975.
- [ ] **Enrichment OFF auf browo-hr:** `leaves.service.ts` hat mindestens eine
      eingehende Kante.
- [ ] **Enrichment OFF auf browo-hr:** Kein `resolvedPath` im Export hat den
      Wert `"***"`.
- [ ] Der Export enthält `astParseReport` mit `filesAttempted`, `filesParsed`
      und `filesFailed`.
- [ ] Ein Import der Form `./x.js` auf eine Datei `x.ts` wird aufgelöst; es gibt
      einen Test dafür.
- [ ] Ein Import der Form `./x.js` auf eine tatsächlich vorhandene Datei `x.js`
      löst weiterhin auf `x.js` auf, nicht auf `x.ts`.
- [ ] Die Allowlist enthält keine Schlüssel außer den beiden neuen.
- [ ] `MAX_FILES` in `call-graph.builder.ts` ist unverändert.

## 8. Tests

**Neu** in `.../blueprint/graph/import-resolver.test.ts`:

- `"resolves .js specifier to .ts file"` — `./a.js`, bekannt ist `dir/a.ts` →
  `dir/a.ts`.
- `"prefers exact .js match over .ts rewrite"` — beide vorhanden → `dir/a.js`.
- `"resolves .js specifier to index.ts"` — `./handlers.js`, bekannt ist
  `dir/handlers/index.ts`.
- `"resolves .mjs and .cjs specifiers"`.
- `"returns null for package specifier"` — Gegenprobe.
- `"resolves extensionless specifier"` — bisheriges Verhalten bleibt.

**Neu** in `.../blueprint/internal/fact-metadata-sanitizer.test.ts`:

- `"keeps resolvedPath in exported metadata"`.
- `"keeps targetFile in exported metadata"`.
- `"does not redact a long file path"` — 120-Zeichen-Pfad bleibt vollständig.
- `"still redacts an email in a non-path value"` — die Sicherheitsmaßnahme
  bleibt wirksam.
- `"still drops keys outside the allowlist"`.

**Neu** in `.../blueprint/graph/ast-call-graph.test.ts`:

- `"reports parse failures instead of swallowing them"` — ungültige Datei →
  `filesFailed` ist 1.

**Neu** im Golden-Set aus P0-5: Kennzahl `importEdges` mit einem `min`, das der
Fixture-Struktur entspricht.

**Zu löschen:** Nichts.

## 9. Überprüfungen

```bash
cd Visudevfigma
deno test src/supabase/functions/visudev-analyzer/
npm run test:run
npm run golden-set
```

Lauf gegen browo-hr, Enrichment OFF. Der PR enthält:

1. Zahl der `imports`-Kanten vorher (0) und nachher.
2. Zahl der `calls`-Kanten vorher (0) und nachher.
3. Auflösungsquote vorher (2/975) und nachher.
4. `astParseReport` mit der Fehlerquote.
5. Screenshot der Dependencies-Ansicht vorher und nachher.

Mindestens drei weitere Repos gegenprüfen, darunter eines ohne `.js`-Endungen
in Importen, damit die Änderung dort nichts verschlechtert.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei | Was passiert |
|---|---|
| `.../blueprint/internal/fact-metadata-sanitizer.ts` | Allowlist + Pfadbehandlung |
| `.../blueprint/graph/import-resolver.ts` | Endungsauflösung |
| `.../blueprint/graph/ast-call-graph.ts` | Fehlerzählung |
| `.../blueprint/dto/blueprint-document.dto.ts` | `AstParseReport` |
| `shared/visudev-api.types.ts` | Bericht durchreichen |
| `scripts/golden-set/run.mjs` | Kennzahl `importEdges` |

### Neu anzulegen

Die drei Testdateien aus Abschnitt 8, sofern nicht vorhanden.

### Nicht anfassen

| Datei / Bereich | Grund |
|---|---|
| `local-engine/src/services/software-graph/_dependency-edges.ts` | Ist korrekt; liest die richtigen Felder |
| `call-graph.builder.ts` und `MAX_FILES` | Nicht die Ursache |
| Die Funktion `redactPiiInText` | Sicherheitsmaßnahme, bleibt wirksam |
| `graph-export-cap.ts` | Ist P0-8 |
| Der Parser-Austausch | Eigenes Vorhaben; hier wird nur gezählt |

## 11. Umsetzungsschritte

**Schritt 1 — Allowlist erweitern.** In `fact-metadata-sanitizer.ts` die zwei
Einträge aus Abschnitt 12.1 ergänzen. **In Kleinschreibung**, siehe
Abschnitt 14.

**Schritt 2 — Pfadartige Schlüssel gesondert behandeln** nach Abschnitt 12.2.

**Schritt 3 — Import-Resolver.** In `resolveImport` vor dem Kandidatenaufbau
(Zeile 40) die Endungsumschreibung nach Abschnitt 12.3 einfügen. Die
Reihenfolge ist entscheidend: exakter Treffer zuerst, Umschreibung danach.

**Schritt 4 — Endungsliste ergänzen** nach Abschnitt 12.4.

**Schritt 5 — Parser-Fehler zählen.** In `parseAstModuleGraph` den leeren
`catch`-Block (Zeile 71-73) so ändern, dass er einen übergebenen Zähler erhöht.
Der Zähler wird vom Aufrufer in `call-graph.builder.ts` bereitgestellt und
gesammelt.

**Schritt 6 — Bericht durchreichen** bis in `RawBlueprintScan`.

**Schritt 7 — Tests.**

**Schritt 8 — Golden-Set-Kennzahl.**

**Schritt 9 — Gegen browo-hr und drei weitere Repos messen.**

## 12. Exakte Vorgaben

### 12.1 Neue Allowlist-Einträge

```ts
  // P0-9: dependency edges need the resolved target path
  "resolvedpath",
  "targetfile",
```

Beide **kleingeschrieben und ohne Unterstrich**. Die Prüfung in Zeile 48 läuft
gegen `normalizeMetadataKey(key)`, das `resolvedPath` zu `resolvedpath` macht.
Ein Eintrag `"resolvedPath"` würde nie treffen.

### 12.2 Pfadbehandlung

```ts
const MAX_PATH_STRING_LEN = 512;

const PATH_LIKE_METADATA_KEYS = new Set(["resolvedpath", "targetfile"]);
```

In `sanitizeMetadataString`: Für pfadartige Schlüssel gilt
`MAX_PATH_STRING_LEN` statt `MAX_METADATA_STRING_LEN`, und die
**Längen**-Bedingung in `looksSensitiveMetadataValue` wird übersprungen. Die
Muster-Bedingung (E-Mail, Telefonnummer, Hash, Sozialversicherungsnummer)
bleibt aktiv, ebenso `redactPiiInText`.

### 12.3 Endungsumschreibung im Resolver

```ts
/** TypeScript NodeNext writes `./x.js` for a file that is actually `./x.ts`. */
const JS_TO_TS_REWRITE: ReadonlyArray<[RegExp, readonly string[]]> = [
  [/\.js$/, [".ts", ".tsx"]],
  [/\.jsx$/, [".tsx"]],
  [/\.mjs$/, [".mts"]],
  [/\.cjs$/, [".cts"]],
];
```

Die Kandidatenreihenfolge lautet:

1. `base` mit jeder Endung aus `EXTENSIONS`
2. `base` selbst — **der exakte Treffer**
3. die Umschreibungen aus `JS_TO_TS_REWRITE`

Punkt 2 muss vor Punkt 3 stehen, sonst gewinnt `x.ts` gegen ein tatsächlich
vorhandenes `x.js`.

### 12.4 Ergänzte Endungsliste

```ts
const EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts",
  "/index.ts", "/index.tsx", "/index.js", "/index.jsx",
];
```

### 12.5 Berichtstyp

```ts
export interface AstParseReport {
  filesAttempted: number;
  filesParsed: number;
  filesFailed: number;
  /** Repo-relative paths of files that failed to parse, capped at 50. */
  failedSamples: string[];
}
```

## 13. Verständlichkeit

**Leerzustand:** Wenn eine Datei keine Abhängigkeiten hat, muss der Inspector
unterscheiden. Zwei Texte, wörtlich:

| Fall | Text |
|---|---|
| geparst, keine Importe | `Keine Abhängigkeiten gefunden. Diese Datei importiert nichts und wird von nichts importiert.` |
| nicht geparst | `Diese Datei konnte nicht analysiert werden. Über ihre Abhängigkeiten ist nichts bekannt.` |

Diese Unterscheidung ist der Kern des Issues auf der Oberfläche. Ein „0" ohne
Angabe, ob gemessen oder nicht gemessen, ist eine Falschaussage.

**Erklärung:** Die Begriffe „Import", „Abhängigkeit" und „Fan-in" brauchen
Glossareinträge. Für „Fan-in": „Wie viele andere Teile dieses Teil benutzen.
Ein hoher Wert heißt: eine Änderung hier wirkt sich an vielen Stellen aus."

**Nachweis:** Screenshot der Dependencies-Ansicht mit Kanten, Screenshot beider
Leerzustände.

## 14. Häufige Fehlannahmen

**„Ich trage `resolvedPath` in die Allowlist ein."**
Das wirkt nicht. Zeile 48 prüft `ALLOWED_METADATA_KEYS.has(normalizedKey)`, und
`normalizeMetadataKey` schreibt alles klein. Der Eintrag muss `resolvedpath`
lauten. Dieser Fehler kostet sonst eine ganze Runde, weil die Änderung korrekt
aussieht und nichts bewirkt.

**„Allowlist erweitern reicht."**
Nein. Es sind drei unabhängige Ursachen. Nach der Allowlist würden die Pfade
über 64 Zeichen zu `"***"`, und selbst intakte Pfade zeigen wegen Ursache 2
meist auf nicht existierende `.js.ts`-Dateien. Wer nur eine Ursache behebt,
misst weiterhin null Kanten und hält den Fix für gescheitert.

**„`MAX_FILES = 40` ist doch offensichtlich das Problem."**
Nein. Diese Konstante begrenzt `collectRelatedFiles`, das keine Kanten erzeugt.
Sie wird nicht angefasst. Das steht so in Abschnitt 10.

**„Ich erhöhe einfach `MAX_METADATA_STRING_LEN` auf 512."**
Nein. Der Wert schützt alle Metadaten vor dem versehentlichen Ausleiten langer
Werte. Nur pfadartige Schlüssel bekommen die höhere Grenze, siehe 12.2.

**„24 % Parser-Fehler muss ich beheben."**
Nicht in diesem Issue. Hier werden sie gezählt und gemeldet. Ob und wie sie
behoben werden, entscheidet sich danach anhand der Fehlerliste — möglicherweise
mit einem anderen Parser, was ein eigenes Vorhaben ist.

**„Wenn `.js` jetzt auf `.ts` zeigt, breche ich Projekte mit echten
`.js`-Dateien."**
Nur wenn die Reihenfolge falsch ist. Der exakte Treffer wird vor der
Umschreibung geprüft (12.3, Punkt 2 vor Punkt 3), und es gibt einen Test dafür.

**„Die Kanten entstehen jetzt, also kann ich P0-8 überspringen."**
Nein. Ohne P0-8 kommen nur 64 `ast-import`-Fakten im Export an. Aus 64 Fakten
entstehen höchstens 64 Kanten — das Akzeptanzkriterium von 500 ist dann nicht
erreichbar.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma

# Allowlist-Einträge sind kleingeschrieben
rg -n '"resolvedpath"|"targetfile"' src/supabase/functions/visudev-analyzer/module/blueprint/internal/fact-metadata-sanitizer.ts
# erwartet: beide Treffer

# MAX_FILES unverändert
git diff src/supabase/functions/visudev-analyzer/module/blueprint/graph/call-graph.builder.ts
# erwartet: keine Ausgabe

# _dependency-edges.ts unverändert
git diff local-engine/src/services/software-graph/_dependency-edges.ts
# erwartet: keine Ausgabe

npm run typecheck        # erwartet: exit 0
deno check src/supabase/functions/visudev-analyzer/index.ts   # erwartet: exit 0
npm run test:run         # erwartet: exit 0
npm run golden-set       # erwartet: "golden-set: OK (...)"
npm run lint             # erwartet: exit 0
```

## Regeln für den Umsetzer

1. **Nur der beschriebene Scope.** Pfad-Aliase aus `tsconfig.json` sind
   ausdrücklich nicht Teil dieses Issues, sondern gehören in „Beobachtet, nicht
   behoben".
2. **Kein Test wird abgeschwächt.** Die PII-Redaktionstests bleiben unverändert
   gültig.
3. **Keine neuen Platzhalterwerte.** Ein nicht aufgelöster Import erzeugt keine
   Kante — er erzeugt keine geratene Kante.
4. **Keine repo-spezifischen Literale.** Die Endungsumschreibung ist eine
   allgemeine TypeScript-Regel, kein Sonderfall für browo-hr.
5. **Bei Unklarheit anhalten** und im PR als Frage vermerken.
