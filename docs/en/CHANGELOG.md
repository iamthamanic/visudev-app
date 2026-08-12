# Changelog (Memory)

## 2026-08-12 — Phase 0 honest core

**Type:** feature · **Review:** needs-review

Domains from segment spread (path) and filename stems; import/call edges; fact cap; security only when analyzable; CI golden set without enrichment; commit SHA/snapshots; symlink jail.

**Users:** More credible Architecture/Atlas districts; fewer false security hits; banner by `domainSource`.  
**Developers:** `_segment-spread`, `_domain-from-filename`, `domainSource` path|filename|none.  
**Evidence:** [compare](https://github.com/iamthamanic/visudev-app/compare/1d130a00...5364a4b3), [PR #280](https://github.com/iamthamanic/visudev-app/pull/280).

## 2026-07-22 — Vertical-slice strangler

**Type:** architecture · **Review:** needs-review

Product slices behind public entries; facade reverse imports removed; boundary check in CI (#243–#250).

**Users:** No surface feature change.  
**Developers:** Slice boundaries enforced.  
**Evidence:** [compare](https://github.com/iamthamanic/visudev-app/compare/dc16f5dc...1d130a00), [PR #251](https://github.com/iamthamanic/visudev-app/pull/251).

## 2026-07-19 — Living memory bootstrap

**Type:** bootstrap · **Review:** needs-review

Initial living project documentation (`.project-memory/`, bilingual docs, viewer). Reflects state after Blueprint v2 and the access-control epic (abstract controls instead of RLS-as-universal requirement).

**Users:** Documentation/viewer only; no app runtime change.  
**Developers:** Use `@memory-live-doc` after material changes.  
**Evidence:** `README.md`, `.qa/design/blueprint-access-control.md`, `shared/access-control.types.ts`.
