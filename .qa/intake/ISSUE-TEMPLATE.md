# Issue-Vorlage (verbindlich)

Gültig für alle VisuDEV-Issues ab 2026-08-11.

## Pflicht-Label

Jedes nach dieser Vorlage geschriebene Issue trägt auf GitHub das Label
**`opus-fix`**. Daran ist erkennbar, dass es dem vollständigen
Umsetzungsvertrag folgt und ohne weitere Rückfragen abgearbeitet werden kann.

Issues ohne dieses Label sind ältere oder handschriftliche Tickets und
unterliegen diesen Regeln nicht.

## Zwei Leitfragen

**Verständlichkeit:**
> Versteht jemand, der dieses Projekt nicht kennt, in zwei Jahren allein aus
> diesem Issue, **warum** es geschrieben wurde, **was** genau falsch war und
> **woran** man erkennt, dass es behoben ist?

**Ausführbarkeit:**
> Kann ein schwächeres Modell (Composer, Sonnet, Haiku) dieses Issue umsetzen
> und dabei dasselbe Ergebnis liefern wie ein starkes Modell?

Beide müssen mit Ja beantwortbar sein.

## Das Grundprinzip

> **Jede Entscheidung, die das Issue offen lässt, wird falsch getroffen.**

Das Issue denkt für den Umsetzer mit. Es enthält keine Formulierungen wie
„je nach Situation", „sinnvoll wählen", „bei der Umsetzung entscheiden" oder
„gegebenenfalls". Wenn beim Schreiben des Issues eine Entscheidung nicht
getroffen werden kann, ist das Issue noch nicht schreibreif — dann fehlt eine
Recherche, und die gehört vor das Issue, nicht hinein.

Der Umsetzer soll **implementieren, nicht abwägen**. Abgewogen wurde beim
Schreiben.

---

# Teil A — Verständnis (Abschnitte 1–9)

Diese Abschnitte erklären das Warum. Sie richten sich an einen Menschen, der
in zwei Jahren wissen will, was hier passiert ist.

### 1. Kontext

Warum existiert dieses Issue? Welche Beobachtung, welcher Nutzerfrust, welche
Analyse hat dazu geführt? Historie nennen: Wenn ein früheres Issue das Problem
verursacht oder unvollständig gelöst hat, wird es verlinkt.

Hier gehört auch das Produktversprechen hin, gegen das gemessen wird —
konkret zitiert, nicht paraphrasiert.

### 2. Problem

Was ist konkret falsch? **Mit Code-Referenzen im Format `pfad/datei.ts:zeile`
und dem tatsächlichen Codeausschnitt als Codeblock.** Ein Zeilenverweis allein
reicht nicht: Zeilennummern verschieben sich, der Codeblock bleibt
wiedererkennbar.

Zusätzlich: Was ist die *Auswirkung*? Ein Problem ohne beschriebene Auswirkung
lässt sich nicht priorisieren.

### 3. Lösung

Was soll stattdessen passieren? **Genau eine Lösung**, nicht mehrere Optionen.
Verworfene Alternativen werden mit Begründung genannt, damit die Entscheidung
nicht in sechs Monaten erneut diskutiert wird — aber sie sind Kontext, keine
Auswahl.

### 4. Architektur

Welche Schichten sind betroffen (Deno-Analyzer / Node local-engine / shared /
Frontend-Slice / preview-runner)? Welche Verträge ändern sich? Welche Datei ist
die Quelle der Wahrheit?

**Regel:** Issues werden entlang der Beweiskette geschnitten, nicht entlang der
Schichten. Wenn ein Wert von Deno bis ins UI muss, gehören alle drei Schichten
in dasselbe Issue. Andernfalls fehlt hinterher die Brücke.

### 5. Edge Cases

Was passiert bei leerem Graph, bei fehlenden Metadaten, bei abgeschnittener
Analyse, bei Monorepos, bei Nicht-TypeScript-Repos, beim ersten Scan ohne
Vorgänger-Snapshot, bei Enrichment ON gegen OFF?

**Jeder Edge Case nennt das erwartete Verhalten**, nicht nur die Situation.
„Was passiert bei leerem Graph?" ist keine Angabe. „Bei leerem Graph wird
`null` zurückgegeben und die View zeigt `Keine Daten`" ist eine.

### 6. User Journey

Konkret: Nutzer öffnet X, klickt Y, erwartet Z. Vorher-Zustand und
Nachher-Zustand.

### 7. Akzeptanzkriterien

Überprüfbare Aussagen, keine Absichtserklärungen. Jedes Kriterium muss von
einer zweiten Person ohne Rückfrage entscheidbar sein.

**Mindestens ein Kriterium muss auf einem echten Repo mit Enrichment OFF
erfüllt sein.** Golden Set: Formbricks, Plane, Rocket.Chat, browo-hr.

### 8. Tests

Welche Tests entstehen neu — **mit Testnamen und der konkreten Zusicherung**,
nicht „Test für Funktion X". Welche bestehenden Tests werden angepasst oder
gelöscht, und warum. Wenn ein Test gelöscht wird, weil er falsches Verhalten
festschrieb, wird das explizit vermerkt.

### 9. Überprüfungen

Wie wird manuell verifiziert? Konkrete Befehle, konkretes Repo, konkreter
Screen. Welche Evidence-Datei wird aktualisiert
(`visudev-test-repos/evidence/`)?

---

# Teil B — Umsetzungsvertrag (Abschnitte 10–15)

Diese Abschnitte richten sich an den Umsetzer, auch an ein schwächeres Modell.
Sie lassen keinen Interpretationsspielraum.

### 10. Dateien

Drei Listen, vollständig:

**Zu ändern** — jede Datei mit einem Satz, was dort passiert.
**Neu anzulegen** — mit vollständigem Pfad.
**Nicht anfassen** — angrenzende Dateien, die naheliegend erscheinen, aber zu
einem anderen Issue gehören. Mit Angabe, zu welchem.

Die dritte Liste ist die wichtigste. Der häufigste Fehler schwächerer Modelle
ist nicht die falsche Änderung, sondern die zusätzliche.

### 11. Umsetzungsschritte

Nummerierte, atomare Schritte in Reihenfolge. Jeder Schritt nennt die Datei
und ist für sich abgeschlossen. Nach jedem Schritt muss der Code kompilieren.

Wenn ein Schritt eine Signatur ändert, listet er alle Aufrufstellen auf — der
Umsetzer soll sie nicht suchen müssen, weil er sonst eine übersieht.

### 12. Exakte Vorgaben

Alles, was sonst erfunden würde, wird hier wörtlich vorgegeben:

- **Typdefinitionen** als vollständiger TypeScript-Code, nicht als Skizze
- **Funktionssignaturen** inklusive Rückgabetyp
- **UI-Texte** wörtlich, in der Zielsprache, mit Platzhaltersyntax
- **`data-testid`-Werte**
- **Namen** von Dateien, Konstanten, Feldern, CSS-Klassen, Env-Variablen

Begründung: Zwei Modelle erfinden zwei verschiedene Texte. Dann weichen
Tests, Screenshots und Dokumentation voneinander ab, und niemand weiß, welche
Variante gemeint war.

### 13. Verständlichkeit

**Gilt für jedes Issue, das etwas im UI verändert. Keine Ausnahme.**

Zielgruppe ist ausdrücklich auch der technische Laie. Wer die Ansicht öffnet,
muss ohne Vorwissen verstehen, was er sieht.

#### 13.1 Leerzustand

Jedes UI-Element, das leer sein kann, benennt **genau einen** dieser sieben
Zustände. Der Grund wird immer genannt, nie nur die Abwesenheit:

| Zustand | Bedeutung | Muss zusätzlich nennen |
|---|---|---|
| `not-scanned` | Projekt wurde noch nie analysiert | Was der Scan tut, wie lange er dauert |
| `partial-scan` | Analysiert, aber abgeschnitten | Wo abgebrochen wurde, wie man den Umfang erweitert |
| `unsupported-stack` | Dieser Stack wird noch nicht gelesen | Welcher Stack erkannt wurde |
| `nothing-found` | Vollständig analysiert, es gibt wirklich nichts | **Wonach konkret gesucht wurde** |
| `filtered-out` | Daten vorhanden, aber Filter blenden sie aus | Aktive Filter und Trefferzahl („0 von 412") |
| `not-built-yet` | Funktion existiert noch nicht | Phase und Issue-Nummer |
| `analysis-failed` | Analyse ist fehlgeschlagen | Fehlergrund und nächster Schritt |

**`nothing-found` ist eine echte Aussage und darf nicht wie ein Fehler
aussehen.** „Dieses Projekt hat keine Worker" ist Information, kein Mangel.
Bei Diagnosen gilt zusätzlich: Ein leeres Ergebnis muss die Zahl der geprüften
**und** der nicht prüfbaren Regeln nennen, sonst liest ein Laie „keine
Befunde" als „alles sicher".

`nothing-found` nennt immer die gesuchten Muster. „Wir haben gesucht nach
`docker-compose.yml`, `Dockerfile`, `k8s/*.yaml` — nichts davon liegt im
Projekt" ist überprüfbar; „Keine Container gefunden" ist es nicht.

**Darstellung:** Eine gedimmte Geisterversion der echten Oberfläche, keine
Illustration und kein Maskottchen. Container mit `role="status"` und
`aria-live="polite"`, damit Screenreader nach einer Filterung nicht ins Leere
laufen. Genau eine primäre Aktion.

Verboten: eine leere Fläche, ein Bindestrich, „–", „N/A", „0" ohne
Begründung, ein stiller Fallback auf einen erfundenen Wert — und
**Beispieldaten**. In einem Analysewerkzeug hält der Nutzer die Attrappe für
seinen eigenen Befund. Genau dieser Fehler wird in Phase 0 gerade beseitigt.

#### 13.2 Erklärung

Jeder Fachbegriff, den das Element anzeigt, hat einen Eintrag im zentralen
Begriffsregister und ist im UI mit Hover-Erklärung verlinkt. Das gilt für
Technologien (Docker, Nginx, Redis, Prisma), für Konzepte (Layer, Fan-in,
Middleware, RLS) und für die Ansicht selbst.

Erklärungen werden **nicht** pro Komponente geschrieben. Steht ein Begriff
noch nicht im Register, wird er dort ergänzt — im selben PR.

**Drei Ebenen, klar getrennt:**

| Ebene | Auslöser | Inhalt | Baustein |
|---|---|---|---|
| 1 | Hover, 300 ms | Ein Satz: *was ist das* | Radix Tooltip |
| 2 | Hover, 500 ms, oder Klick | Was es tut, **warum es in diesem Projekt ist**, Beleg-Link | Radix HoverCard |
| 3 | Klick | Details, Code, Nachbarknoten, Diagnosen | Seitenpanel |

Ebene 2 ist die entscheidende. „Nginx verteilt Anfragen" ist Ebene 1. „…und
steht in diesem Projekt vor deinem API-Container" ist Ebene 2 und nur aus dem
Graphen ableitbar. Ohne diesen zweiten Halbsatz ist die Erklärung ein Lexikon,
kein Werkzeug.

**Pflichtregeln:**

- Ebene 1 enthält nichts Fokussierbares (`role="tooltip"`). Sobald ein Link
  hinein soll: Ebene 2.
- WCAG 2.2 / 1.4.13: überfahrbar, per Escape schließbar, kein
  Timer-Verschwinden.
- Touch: sichtbares Info-Symbol, das per Tap ein Popover mit Schließen öffnet.
  Hover existiert dort nicht.
- Beim Pan und Zoom auf der Leinwand werden Tooltips unterdrückt, sonst
  flackert die Oberfläche bei jeder Mausbewegung.
- Niemals `title`. Niemals wesentliche Information ausschließlich im Tooltip.
- Keine Erklärungen zur Laufzeit von einem Sprachmodell erzeugen: Latenz,
  Kosten pro Hover und nicht reproduzierbar.

**Legende:** Jede Ansicht mit eigener Bildsprache hat eine Legende, die jede
Form, Farbe, Linienart und **jede Abkürzung** erklärt. Prüffrage aus dem
C4-Modell: Versteht ein Fremder die Bedeutung aller verwendeten Linienarten
allein aus der Legende?

**Ansichtskopf:** Drei getrennte Angaben, nach dem Muster aus dem
Datenjournalismus — Titel als Kernaussage, Beschreibung („Was sehen wir hier
genau?"), und Herkunft der Daten. Dazu ein Satz, der sagt, **was hier nicht
drin ist**. Dieser dritte Satz verhindert die Hälfte aller
Fehlinterpretationen.

#### 13.3 Verknüpfte Hervorhebung

Wenn das Element eine Auswahl erlaubt: Was leuchtet sonst noch auf? Auswahl im
Graphen hebt die zugehörige Codestelle hervor und umgekehrt. Wenn das im
konkreten Issue nicht umsetzbar ist, wird begründet, warum, und auf welches
Issue es verschoben wird.

#### 13.4 Nachweis

Screenshot jedes Leerzustands, nicht nur des Erfolgsfalls. Ein Issue, das nur
den gefüllten Zustand zeigt, ist nicht abgenommen.

### 14. Häufige Fehlannahmen

Vorweggenommene falsche Abzweigungen. Format: „Man könnte annehmen, dass X.
Das ist falsch, weil Y. Richtig ist Z."

Hier gehören besonders hinein:
- Begriffe, die ähnlich klingen, aber Verschiedenes bedeuten
- Angrenzende Bugs, die auffallen werden, aber nicht Teil des Issues sind
- Vorhandener Code, der falsch aussieht, aber Absicht ist

### 15. Fertig-Checkliste

Rein mechanisch abarbeitbar: Befehle mit erwarteter Ausgabe. Keine Bewertung
nötig.

```bash
# Beispielform
rg -n "STATIC_PLACEHOLDER_METERS" src/    # erwartete Ausgabe: keine Treffer
npm run typecheck                          # erwartet: exit 0
```

---

## Regeln für den Umsetzer

Diese Regeln stehen in jedem Issue und gelten ohne Ausnahme.

1. **Nur der beschriebene Scope.** Wird ein angrenzender Fehler entdeckt, der
   nicht im Issue steht: nicht beheben. Stattdessen im PR unter „Beobachtet,
   nicht behoben" notieren.
2. **Kein Test wird abgeschwächt, um ihn grün zu bekommen.** Schlägt ein Test
   unerwartet fehl, ist entweder die Implementierung falsch oder der Test
   schrieb altes Verhalten fest. Der zweite Fall ist im Issue unter Abschnitt 8
   ausdrücklich benannt. Steht er dort nicht, ist es der erste Fall.
3. **Keine neuen Platzhalterwerte.** Fehlende Daten werden als fehlend
   angezeigt. Kein `?? 0`, kein `|| "Unbekannt"` als stiller Fallback auf einen
   erfundenen Wert. Stattdessen einer der fünf Leerzustände aus Abschnitt 13.1,
   immer mit Grund.
4. **Keine repo-spezifischen Literale** im Produktcode. Wenn ein Zielrepo eine
   Sonderregel zu brauchen scheint, ist die Abstraktion falsch — melden statt
   einbauen.
5. **Bei Unklarheit anhalten.** Wenn eine Vorgabe im Issue fehlt oder sich
   widerspricht: nicht raten. Im PR als Frage vermerken und den betroffenen
   Teilschritt auslassen. Ein unvollständiger, ehrlicher PR ist besser als ein
   vollständiger mit geratenen Entscheidungen.

---

## Definition of Done

1. Alle Akzeptanzkriterien erfüllt — **kein Schließen bei PARTIAL**.
2. Verifikation auf mindestens einem echten Repo mit **Enrichment OFF**
   dokumentiert.
3. Fertig-Checkliste vollständig abgearbeitet, Ausgaben im PR belegt.
4. Keine Datei aus der „Nicht anfassen"-Liste geändert.
5. CI grün. Rote CI ist ein Blocker, kein Hinweis.

---

## Anti-Muster (aus den Gapclose-Wellen gelernt)

| Anti-Muster | Warum es geschadet hat |
|---|---|
| „Fix X in Component Y" ohne Kontext | Nach sechs Monaten weiß niemand, was X war |
| Issue endet an der Schichtgrenze | Brücke Deno→Node→UI fehlt, Folge-Issue nötig |
| Akzeptanz gegen Demo-Graph | Grün, obwohl echte Repos kaputt sind |
| Repo-spezifische Regex als Lösung | Jedes neue Zielrepo kostet eine weitere Regel |
| Platzhalterwert, „bis echte Daten da sind" | Der Platzhalter bleibt und lügt |
| Schließen bei PARTIAL | Problem verschwindet aus dem Blick, nicht aus dem Code |
| „Entscheidung bei der Umsetzung" | Wird von jedem Umsetzer anders entschieden |
| Fehlende Scope-Grenze | Umsetzer repariert Angrenzendes mit, PR wird unprüfbar |
