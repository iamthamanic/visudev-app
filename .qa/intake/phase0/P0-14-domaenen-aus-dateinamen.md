# P0-14 — Domänen aus Dateinamen für schichtzuerst-Architekturen

Label: `opus-fix`
Phase: 0, Welle A · **Nach P0-13 und P0-10**
Vorlage: `.qa/intake/ISSUE-TEMPLATE.md`

---

# Teil A — Verständnis

## 1. Kontext

P0-10 liefert Domänen nur, wenn der **Pfad** Domänen-Kandidaten nach
Segmentstreuung (P0-13) enthält. Bei **schichtzuerst**-Layouts steckt die
Fachlichkeit im Dateinamen:

| Repo      | Beispiel                                                        | Domäne steckt in         |
| --------- | --------------------------------------------------------------- | ------------------------ |
| discourse | `app/models/topic.rb`, `app/controllers/topics_controller.rb`   | Stamm `topic` / `topics` |
| mastodon  | `app/services/follow_service.rb`                                | Stamm `follow`           |
| immich    | `server/src/services/album.service.ts`, `…/album.controller.ts` | Stamm `album`            |

Ohne dieses Issue bleiben diese Repos nach P0-10 bei `domainSource: "none"` —
ehrlich, aber Architecture und Atlas ohne Distrikte. Der Nutzer hat bestätigt:
VisuDEV muss mit **allen** Architekturarten klar kommen.

## 2. Problem

Nach P0-10:

- browo-hr / erpnext: Domänen aus dem Pfad ✓
- discourse / mastodon / immich (klassische Nest/Rails-Bäume): viele Dateien
  `domainSource: "none"` ✗ für die Produktfrage „welche Fachbereiche gibt es?"

Die Schicht-Erkennung `detectLayer` funktioniert bereits und benennt
presentation/data/application korrekt. Sie sagt aber nicht, **welcher**
Fachbereich gemeint ist.

Es gibt keine fertige Bibliothek, die „topic" aus drei Rails-Dateien
zusammenführt und die wir übernehmen könnten. Die Ableitung muss lokal,
deterministisch und erklärbar sein.

## 3. Lösung

**Genau eine Lösung:** Für Dateien mit `domainSource: "none"` (oder Domäne
`unassigned`) einen **Dateinamen-Stamm** ableiten und ihn **nur dann** als
Domäne setzen, wenn derselbe Stamm in **mindestens zwei verschiedenen
Schichten** (`detectLayer`) vorkommt.

Verfahren:

1. Dateiname ohne Extension.
2. Bekannte **Schicht-Suffixe** abtrennen (Liste unten — das ist erlaubt, weil
   sie Benennungskonventionen beschreibt, nicht Ordnerbedeutung behauptet).
3. Plural/Singular grob normalisieren (trailing `s` bei Länge > 3).
4. Über alle Dateien des Scans: Stamm → Set der Layer-Werte.
5. Stämme mit `|layers| >= 2` und mindestens `MIN_FILES_PER_FILENAME_DOMAIN`
   Dateien sind Domänen-Kandidaten.
6. Dateien mit `domainSource: "none"`, deren Stamm Kandidat ist, bekommen
   Domäne = Stamm-Label, `domainSource: "filename"`.
7. Dateien, deren Stamm **kein** Kandidat ist, bleiben `unassigned` /
   `domainSource: "none"`.

**Verworfene Alternative: jeder Dateiname = eigene Domäne.** Erzeugt
hunderte Ein-Datei-Domänen — schlimmer als eine.

**Verworfene Alternative: NLP / Embedding-Cluster.** Nicht deterministisch,
nicht Vercel-lokal, nicht erklärbar.

**Verworfene Alternative: Pfad-Domänen aus P0-10 überschreiben.** Nie.
`domainSource: "path"` hat Vorrang. Dateinamen nur als Ergänzung.

## 4. Architektur

| Schicht              | Datei                                              | Änderung                                    |
| -------------------- | -------------------------------------------------- | ------------------------------------------- |
| Node                 | neu: `_domain-from-filename.ts`                    | Stamm, Index, Apply                         |
| Node                 | `_heuristics.ts`                                   | `detectLayer` nur lesen                     |
| Node                 | Graph-Builder nach File-Contexts                   | zweiten Pass: Domänen für `none` nachziehen |
| shared / Graph-Typen | Metadaten `domainSource` um `"filename"` erweitern |

Zwei Pässe sind Pflicht: Pass 1 = P0-10 (Pfad). Pass 2 = dieses Issue
(Dateiname), weil die Kandidaten global über den Scan aggregiert werden.

## 5. Edge Cases

- **Pfad-Domäne bereits gesetzt:** unverändert lassen.
- **Stamm nur in einer Schicht** (`only models/topic.rb`): kein Domänen-Status.
- **`index.ts` / `mod.rs` / `main.go`:** keine Domäne aus generischen Namen —
  Blacklist kurzer generischer Stämme (12.3).
- **camelCase / kebab-case:** vor Suffix-Strip auf `lower` und `-`/`_` →
  Trennung; Stamm = letzter Token nach Strip, oder ganzer Name wenn ein Token.
  Konkret: `album.service` → Suffix `service` → `album`.
  `leavesController` → Suffix `controller` (casefold) → `leaves`.
- **discourse Plugins:** Wenn P0-10 für `plugins/discourse-chat/…` bereits
  `path`-Domäne geliefert hat, Pass 2 nicht anfassen.
- **Konflikt zwei Stämme:** eine Datei hat einen Stamm; kein Konflikt.
- **Sehr großes Repo:** Aggregation O(n); n = analysierte Dateien ≤ FILE_LIMIT.
  Kein Extra-Scan über das gesamte Filesystem.
- **Enrichment ON:** Demo darf `filename`-Domänen bekommen, wenn Pass 2 läuft.

## 6. User Journey

**Vorher (nach P0-10, discourse):** Banner „Fachbereiche kaum in Ordnernamen".

**Nachher:** Distrikte `topic`, `post`, `user`, … aus Dateinamen, mit
erklärtem `domainSource: "filename"`. Banner-Text wechselt (Abschnitt 13).

## 7. Akzeptanzkriterien

- [ ] Dateien mit `domainSource: "path"` ändern Domäne in diesem Issue **nie**.
- [ ] **discourse, Enrichment OFF:** Mindestens 10 Domänen mit
      `domainSource: "filename"`. Unter den Labels kommen fachliche Stämme vor
      (z. B. topic/post/user — keine festen Literale im Produktcode, aber im
      PR als Beleg nennen).
- [ ] **immich, Enrichment OFF:** Mindestens ein Stamm wie `album` erscheint als
      Domäne, wenn Controller+Service (oder Service+Repository) analysiert
      wurden.
- [ ] **browo-hr:** Domänen aus P0-10 bleiben `path`; Pass 2 darf sie nicht
      umbenennen. Domänenzahl sinkt nicht.
- [ ] Kein Stamm mit nur einer Schicht wird Domäne.
- [ ] Generische Stämme aus 12.3 werden nie Domäne.
- [ ] UI-Hinweis unterscheidet `path` vs `filename` vs `none` (Abschnitt 13).

## 8. Tests

**Neu** `_domain-from-filename.test.ts`:

- `"stem across two layers becomes domain"` —
  `app/models/topic.rb` + `app/controllers/topics_controller.rb` → Domäne
  `topic` (oder `topics` nach Normalisierung — festlegen: nach Strip+Singular,
  siehe 12.2).
- `"single layer stem stays unassigned"`.
- `"path domain is never overwritten"`.
- `"strips .service and Controller suffixes"`.
- `"rejects index and main"`.
- `"requires MIN_FILES_PER_FILENAME_DOMAIN"`.

## 9. Überprüfungen

```bash
cd Visudevfigma
npm run test:run -- _domain-from-filename
npm run test:run -- software-graph
```

PR-Tabelle:

| Repo | path-Domänen | filename-Domänen | none % |
| ---- | ------------ | ---------------- | ------ |

Screenshots Architecture discourse + browo-hr.

---

# Teil B — Umsetzungsvertrag

## 10. Dateien

### Zu ändern

| Datei                          | Was                                   |
| ------------------------------ | ------------------------------------- |
| Graph-Builder-Orchestrierung   | Pass 2 nach allen `ensureFileContext` |
| Domain-Knoten / File-Metadaten | `domainSource: "filename"`            |
| Architecture/Atlas-Hinweistext | Abschnitt 13                          |

### Neu anzulegen

| Datei                                                               | Zweck |
| ------------------------------------------------------------------- | ----- |
| `local-engine/src/services/software-graph/_domain-from-filename.ts` | Logik |
| `…/_domain-from-filename.test.ts`                                   | Tests |

### Nicht anfassen

| Datei                                | Grund        |
| ------------------------------------ | ------------ |
| `_segment-spread.ts` Schwellen       | P0-13        |
| Pfad-Algorithmus in `_heuristics.ts` | P0-10        |
| Import-Cluster                       | out of scope |

## 11. Umsetzungsschritte

**Schritt 1 — Suffix-Liste und `extractFilenameStem`** nach 12.1–12.2.

**Schritt 2 — `buildFilenameDomainIndex(files: {path, layer}[])`** → Map
Stamm → { layers, filePaths, label }.

**Schritt 3 — `applyFilenameDomains(state, index)`:** nur Knoten/Scopes mit
`domainSource === "none"` oder Domäne `unassigned` umhängen. Domänen-Knoten
für neue Labels anlegen (gleiche ID-Regeln wie P0-7: deterministisch,
`domain:${label}`).

**Schritt 4 — Orchestrierung Pass 2.**

**Schritt 5 — Hinweistext UI.**

**Schritt 6 — Tests + Repo-Tabelle.**

## 12. Exakte Vorgaben

### 12.1 Schicht-Suffixe (casefold, Reihenfolge: längere zuerst)

```ts
export const FILENAME_LAYER_SUFFIXES: readonly string[] = [
  "controller",
  "controllers",
  "presenter",
  "presenters",
  "serializer",
  "serializers",
  "repository",
  "repositories",
  "service",
  "services",
  "usecase",
  "use-case",
  "use_case",
  "handler",
  "handlers",
  "viewset",
  "viewsets",
  "policy",
  "policies",
  "job",
  "jobs",
  "worker",
  "workers",
  "mailer",
  "mailers",
  "helper",
  "helpers",
  "dto",
  "entity",
  "model",
  "models",
  "type",
  "types",
  "schema",
  "schemas",
  "component",
  "components",
  "page",
  "pages",
  "route",
  "routes",
];
```

Strip: Endung `.ts`/`.tsx`/`.js`/`.jsx`/`.rb`/`.py`/… entfernen; dann
wiederholt Suffix entfernen, wenn der Name auf `_suffix`, `-suffix`, `.suffix`
oder `Suffix` (camelCase) endet.

### 12.2 Normalisierung

```ts
function normalizeStem(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss")) {
    s = s.slice(0, -1);
  }
  return s;
}
```

Label = häufigste Original-Schreibweise des Stamms vor Lowercase (wie P0-13).

### 12.3 Generische Stämme (nie Domäne)

```ts
export const GENERIC_FILENAME_STEMS = new Set([
  "index",
  "main",
  "mod",
  "app",
  "init",
  "server",
  "client",
  "config",
  "settings",
  "utils",
  "util",
  "helpers",
  "helper",
  "types",
  "type",
  "constants",
  "constant",
  "test",
  "tests",
  "spec",
  "mock",
  "mocks",
  "fixture",
  "fixtures",
]);
```

### 12.4 Konstanten

```ts
/** A filename stem becomes a domain only if it appears in this many layers. */
export const MIN_LAYERS_FOR_FILENAME_DOMAIN = 2;

/** And at least this many files share the stem. */
export const MIN_FILES_PER_FILENAME_DOMAIN = 2;
```

### 12.5 DomainSource

```ts
export type DomainSource = "path" | "filename" | "none";
```

P0-10-Typ um `"filename"` erweitern.

## 13. Verständlichkeit

Hinweistexte wörtlich:

| Lage                | Text                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Mehrheit `path`     | (kein Extra-Banner nötig)                                                                                                   |
| Mehrheit `filename` | `Fachbereiche wurden aus Dateinamen abgeleitet — dieses Projekt ist nach Schichten organisiert, nicht nach Ordner-Domänen.` |
| Mehrheit `none`     | `VisuDEV konnte keine Fachbereiche erkennen. Gruppierung folgt Schichten bzw. Verzeichnissen.`                              |

Glossareintrag „Domäne" muss beide Quellen nennen (Ordner vs. Dateiname).

## 14. Häufige Fehlannahmen

**„Ein Dateiname reicht als Domäne."**
Nein. Mindestzwei Schichten — sonst Ein-Datei-Spam.

**„Ich überschreibe path-Domänen, wenn der Dateiname schöner wirkt."**
Nein. `path` hat Vorrang.

**„Die Suffix-Liste ist dasselbe wie STRUCTURAL_SEGMENTS."**
Nein. Suffixe beschreiben Dateibenennung (`FooService`), nicht Ordnerpolitik.
Ordnerbedeutung bleibt P0-13-Streuung.

**„Ich implementiere Pass 2 in ensureFileContext."**
Nein. Globaler Index braucht alle Dateien zuerst — zweiter Pass nach der
Schleife.

**„discourse muss dieselben Domänennamen wie browo-hr haben."**
Nein. Andere Architektur, andere Labels — Hauptsache belegbar und
`domainSource` ehrlich.

## 15. Fertig-Checkliste

```bash
cd Visudevfigma
rg -n 'domainSource: "path"' local-engine/src/services/software-graph/ \
  | head
# Pass-2 darf path nicht umschreiben — Test deckt das ab

npm run typecheck
npm run test:run -- _domain-from-filename
npm run test:run
npm run golden-set
npm run lint
```

## Regeln für den Umsetzer

1. **Nur Ergänzung für `none`.** Kein Pfad-Algorithmus umbauen.
2. **Kein Test wird abgeschwächt.**
3. **Keine repo-spezifischen Literale** (`topic`, `album` nur in Tests/PR).
4. **Keine NLP/Embeddings.**
5. **Bei Unklarheit anhalten.**
