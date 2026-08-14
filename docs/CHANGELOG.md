# Changelog (Memory)

## 2026-08-14 — Infrastruktur aus docker-compose / K8s

**Typ:** feature · **Review:** needs-review

Env-Chips und physische Topologie kommen aus echten Compose-/K8s-Deskriptoren. Keine geratenen Regionen.

**Nutzer:** Services, Ports, Netzwerke und Depends-on in der physischen Ansicht; Env aus Compose-Datei/Projekt oder K8s-Namespace.  
**Entwickler:** `deploy-service` Facts; Graph-Nodes `kind: service`; `infra-physical-topology` / `infra-env-chip`.

## 2026-08-12 — Blueprint-Views als nested Paths

**Typ:** feature · **Review:** needs-review

Canonical-URL ist `/blueprint/<view>` (z. B. `/blueprint/atlas`). Legacy `?view=` wird per `replaceState` umgeschrieben.

**Nutzer:** Tabs sind echte Pfade, nicht Query-Parameter.  
**Entwickler:** `blueprintViewPath` / `parseBlueprintViewFromLocation`; Shell parst nur das erste Path-Segment als Screen.

## 2026-08-12 — Memory-Viewer auf Pages + Status/Decisions nachgezogen

**Typ:** feature · **Review:** needs-review

GitHub Pages aktiv. Status-Tab hat „Kürzlich erledigt“. Decisions aus Design-Docs (Local-First, Graph-IR, Blueprint v2, Slices, Domänen-Pässe, ehrlicher Analyzer).

## 2026-08-12 — Phase 0 Honest Core

**Typ:** feature · **Review:** needs-review

Domänen aus Segmentstreuung (Pfad) und Dateinamen-Stämmen; Import/Call-Edges; Fact-Cap; Security nur bei Analysierbarkeit; CI Golden-Set ohne Enrichment; Commit-SHA/Snapshots; Symlink-Jail.

**Nutzer:** Glaubwürdigere Architecture/Atlas-Distrikte; weniger Fehl-Security; Banner nach `domainSource`.  
**Entwickler:** `_segment-spread`, `_domain-from-filename`, `domainSource` path|filename|none.  
**Evidence:** [compare](https://github.com/iamthamanic/visudev-app/compare/1d130a00...5364a4b3), [PR #280](https://github.com/iamthamanic/visudev-app/pull/280).

## 2026-07-22 — Vertical-Slice-Strangler

**Typ:** architecture · **Review:** needs-review

Product-Slices hinter Public Entries; Facade-Reverse-Imports entfernt; Boundary-Check in CI (#243–#250).

**Nutzer:** Keine Feature-Änderung der Surfaces.  
**Entwickler:** Slice-Grenzen enforced.  
**Evidence:** [compare](https://github.com/iamthamanic/visudev-app/compare/dc16f5dc...1d130a00), [PR #251](https://github.com/iamthamanic/visudev-app/pull/251).

## 2026-07-19 — Living Memory Bootstrap

**Typ:** bootstrap · **Review:** needs-review

Erstaufbau der lebenden Projektdokumentation (`.project-memory/`, bilingual Docs, Viewer). Reflektiert den Stand nach Blueprint v2 und dem Access-Control-Epic (abstrakte Controls statt RLS-als-Universalanforderung).

**Nutzer:** Dokumentation/Viewer; keine App-Laufzeitänderung.  
**Entwickler:** `@memory-live-doc` nach materialen Änderungen nutzen.  
**Evidence:** `README.md`, `.qa/design/blueprint-access-control.md`, `shared/access-control.types.ts`.
