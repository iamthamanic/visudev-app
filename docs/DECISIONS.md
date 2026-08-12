# Entscheidungen

## path-then-filename-domains (2026-08-12)

**Status:** accepted (Claim: needs-review)

Domänen zuerst aus Pfad-Segmentstreuung (`domainSource: path`). Dateinamen-Stämme nur als Pass 2 für `none`, wenn Stamm in ≥2 bekannten Schichten und ≥2 Dateien. Path nie überschreiben.

**Evidence:** `.qa/intake/phase0/P0-14-domaenen-aus-dateinamen.md`, [PR #280](https://github.com/iamthamanic/visudev-app/pull/280)

## honest-analyzer-ci (2026-08-12)

**Status:** accepted (Claim: needs-review)

CI Golden-Set ohne Enrichment. Security-Findings nur bei analysierbarem Code. Graph darf nicht voller wirken als die Evidence.

**Evidence:** [PR #269](https://github.com/iamthamanic/visudev-app/pull/269), [PR #275](https://github.com/iamthamanic/visudev-app/pull/275)

## vertical-slice-strangler (2026-07-22)

**Status:** accepted (Claim: needs-review)

Product-Slices hinter `index.ts`, kein Big-Bang-Rename, Boundary-Check in CI.

**Evidence:** `.qa/design/vertical-slice-strangler.md`

## access-control-stack-agnostic (2026-07-19)

**Status:** accepted (Claim: needs-review)

Blueprint prüft abstrakte Controls (AuthN/AuthZ/Scope/Tenant/Ownership). Mechanismen kommen aus DB-Adaptern. MariaDB ohne RLS ≠ automatischer Fehler.

**Evidence:** `.qa/design/blueprint-access-control.md`

## blueprint-v2-one-world (2026-07-14)

**Status:** accepted (Claim: needs-review)

Ein Repo = eine Weltkarte. Sieben Views projizieren denselben Software Graph. Pfad-Gruppierung zuerst. Cytoscape 2D, Atlas-3D optional.

**Evidence:** `.qa/design/blueprint-v2.md`

## local-first-no-tauri (2026-07-08)

**Status:** accepted (Claim: needs-review)

Browser + Local Engine, kein Tauri. Supabase optional.

**Evidence:** `.qa/design/local-first-visudev.md`

## software-graph-ir (2026-07-08)

**Status:** accepted (Claim: needs-review)

Neutrales Graph-IR ist Source of Truth für Blueprint-Views.

**Evidence:** `.qa/design/visudev-graph-ir.md`

## pluggable-blueprint-enrichment (2026-07-07)

**Status:** accepted (Claim: needs-review)

Scanner liefern roh; VisuDEV enrich’t zur kanonischen Blueprint-Dokumentform.

**Evidence:** `.qa/design/blueprint-engine-pluggable.md`
