# Akzeptierte Trade-offs (AI-Review: keine Abzüge)

Diese Trade-offs sind bewusst eingegangen und dürfen in der AI-Review **nicht** als Verstöße gewertet werden, sofern der Code sie einhält und ggf. im Code/Kommentar erwähnt.

---

## Logger

- **Umsetzung:** Injizierte Funktion `logError(message, err?)`; Production loggt nur `message` und optional `err.message` (kein Stack, kein ganzes Objekt).
- **Bewertung:** Zählt als Dependency Inversion erfüllt und als ausreichend gegen Silent Fails.
- **Kein Abzug** für Data Leakage allein wegen `err.message`, solange keine PII/Secrets geloggt werden.

---

## Rate Limiting

- **Umsetzung:** Get-then-set (nicht atomar); im Code dokumentiert (z.B. Kommentar „get-then-set is not atomic“ / „Future: atomic increment when available“). Throttling für schreibende/heavy Endpunkte vorhanden. Read-Endpunkte (GET) ohne Throttling sind akzeptiert.
- **Kein Abzug**, solange im Code kommentiert und Throttling für Schreib-Endpunkte aktiv ist; kein Abzug für ungedrosselte GETs.

---

## Scans (Fire-and-forget + SRP)

- **Umsetzung:** Scans starten per setTimeout nach HTTP-Response; im Code/Kommentar erwähnt, dass Lifecycle/Cancellation später per Job-Queue kommen kann. Scans-Routen bündeln AuthZ, Rate-Limit, KV, Timer in einem Handler.
- **Kein Abzug** für Side Effects oder SRP, solange dokumentiert.

---

## Externe APIs (fetch / URL-Building)

- **Umsetzung:** Externe API-Aufrufe (fetch, URL-Building) in Route-Handlern (z.B. integrations.ts, scans.ts) sind erlaubt; optional später in injizierte Clients auslagern.
- **Kein Abzug** für Dependency Inversion nur wegen direktem fetch/URL-Building in diesen Handlern.

---

## Route-Handler (Validierung + Service-Call)

- **Umsetzung:** Param-Validierung + AuthZ + ein Service-Call in einer Handler-Funktion bewusst für Nachvollziehbarkeit; optional zukünftig Param-Middleware.
- **SRP-Abzug nur**, wenn eine Funktion klar **mehrere unabhängige** Verantwortlichkeiten bündelt (nicht schon bei „Validierung + ein Service-Call“).

---

## Module-Init (moduleDeps in base.service.ts)

- **Umsetzung:** Pro Edge-Function ein Modulzustand `moduleDeps`, einmal pro Request in `index.tsx` mit `initModuleServices(deps)` gesetzt. In Deno Deploy gibt es keine gemeinsame Laufzeit zwischen Requests; jeder Invoke bekommt frischen Kontext.
- **Bewertung:** Kein Cross-Request-State; Tests müssen `initModuleServices()` vor Nutzung aufrufen.
- **Kein Abzug** für Side Effects, solange dieses Muster (einmal init pro Request) eingehalten wird.

---

## Scripts (Tooling)

- **SRP (scripts-1):** `ai-code-review.sh` und `run-checks.sh` bündeln Diff, Prompt, Parse, Retry in einer Datei für einfache Nutzung in Hooks/CI. Bewusst ein Skript pro Tool.
- **Dependency Inversion (scripts-2):** Pfade wie `git`, `supabase`, `npx` sind für Hook-/CI-Kontext gewählt; Override über `PATH` möglich.
- **YAGNI (scripts-3):** Modi (diff, full, --until-95, --refactor) werden für CI und Refactor-Runs genutzt; kein Abzug.
- **Data Leakage (scripts-4):** Review-Artefakte in `.shimwrapper/reviews/` sind lokal, gitignored, nicht deployed; Redaction best-effort.
- **Silent Fails (scripts-5):** AI-Review-Skip bei fehlendem Codex ist optional; Push erfordert weiterhin AI-Review. Kein Abzug.
- **Side Effects (scripts-8):** `push-checked.sh` / `supabase-checked.sh` erzeugen bewusst Commit/Push nach bestandenen Checks; dokumentiert in AGENTS.md.
- **Kein Abzug** für die genannten Punkte, solange Verhalten wie beschrieben.

---

## Git provenance (preview-runner / local-engine)

- **Rate Limiting:** `readLocalAnalysisOrigin` läuft nur innerhalb von `analyzeLocalBlueprint`, das `MAX_CONCURRENT_ANALYZE` (Default 2) mit HTTP 429 durchsetzt. Git-Subprozesse sind damit an die bestehende Blueprint-Analyse-Concurrency gekoppelt, nicht unbegrenzt pro Request.
- **Dependency Inversion:** `spawn("git", …)` in `analysis-origin-git.js` ist der Preview-Runner-Port; Tests können `runGitCommand` injizieren. Local Engine nutzt `createAnalysisOriginReader` / `readGitSummary`.
- **Kein Abzug** für fehlenden separaten Git-Rate-Limiter oder direktes `spawn("git")` in diesem Modul, solange der Concurrency-Gate eingehalten wird.
