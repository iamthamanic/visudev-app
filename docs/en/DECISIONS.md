# Decisions

## path-then-filename-domains (2026-08-12)

**Status:** accepted (claim: needs-review)

Domains first from path segment-spread (`domainSource: path`). Filename stems only as pass 2 for `none`, when a stem appears in ≥2 known layers and ≥2 files. Never overwrite path.

**Evidence:** `.qa/intake/phase0/P0-14-domaenen-aus-dateinamen.md`, [PR #280](https://github.com/iamthamanic/visudev-app/pull/280)

## honest-analyzer-ci (2026-08-12)

**Status:** accepted (claim: needs-review)

CI golden set without enrichment. Security findings only when code is analyzable. The graph must not look fuller than the evidence.

**Evidence:** [PR #269](https://github.com/iamthamanic/visudev-app/pull/269), [PR #275](https://github.com/iamthamanic/visudev-app/pull/275)

## vertical-slice-strangler (2026-07-22)

**Status:** accepted (claim: needs-review)

Product slices behind `index.ts`, no big-bang rename, boundary check in CI.

**Evidence:** `.qa/design/vertical-slice-strangler.md`

## access-control-stack-agnostic (2026-07-19)

**Status:** accepted (claim: needs-review)

Blueprint assesses abstract controls (AuthN/AuthZ/Scope/Tenant/Ownership). Mechanisms come from DB adapters. MariaDB without RLS ≠ automatic failure.

**Evidence:** `.qa/design/blueprint-access-control.md`

## blueprint-v2-one-world (2026-07-14)

**Status:** accepted (claim: needs-review)

One repo = one world map. Seven views project the same Software Graph. Path grouping first. Cytoscape 2D, Atlas 3D optional.

**Evidence:** `.qa/design/blueprint-v2.md`

## local-first-no-tauri (2026-07-08)

**Status:** accepted (claim: needs-review)

Browser + Local Engine, no Tauri. Supabase optional.

**Evidence:** `.qa/design/local-first-visudev.md`

## software-graph-ir (2026-07-08)

**Status:** accepted (claim: needs-review)

Neutral graph IR is source of truth for Blueprint views.

**Evidence:** `.qa/design/visudev-graph-ir.md`

## pluggable-blueprint-enrichment (2026-07-07)

**Status:** accepted (claim: needs-review)

Scanners supply raw data; VisuDEV enriches into the canonical Blueprint document.

**Evidence:** `.qa/design/blueprint-engine-pluggable.md`
