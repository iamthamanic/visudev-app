# P0-10 — Domänen aus Pfadstruktur

## Intent

Use P0-13 segment-spread candidates as the first path domain (no name lists). Production always passes a SegmentSpreadIndex; without index, legacy first-segment remains.

## Acceptance

- browo-hr ≥30 domains; leaves/auth/documents present; modules absent.
  **Payroll wording:** browo often has no bare `payroll/` folder — accept
  `payroll-adjustments` / `payroll-collections` / `payroll-rules` (or similar
  `payroll-*`) as payroll coverage. Do not require a domain literally named
  `payroll` when the repo only has hyphenated modules.
- discourse: no models/controllers domains; unassigned for layer-first app paths.
- erpnext: Fachbaum domains when paths are in the scan (accounts+…); walk
  `pathCatalog` feeds segment-spread so buying/crm/stock are not starved by a
  thin fact-export file subset.
- domainSource path|none on domain nodes; no STRUCTURAL\_\* lists.
