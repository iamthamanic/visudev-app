# P0-10 — Domänen aus Pfadstruktur

## Intent

Use P0-13 segment-spread candidates as the first path domain (no name lists). Production always passes a SegmentSpreadIndex; without index, legacy first-segment remains.

## Acceptance

- browo-hr ≥30 domains; leaves/auth/documents present; modules absent; payroll covered via payroll-\* modules when no bare payroll/ folder.
- discourse: no models/controllers domains; unassigned for layer-first app paths.
- erpnext: Fachbaum domains when paths are in the scan (accounts+…); fact-export path diversity is a known limit.
- domainSource path|none on domain nodes; no STRUCTURAL\_\* lists.
