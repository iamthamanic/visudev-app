# VisuDev Product Readiness — Design (Epic #374)

## Purpose

Declarative five-project Product Readiness harness. Analyzer semantics stay in `shared/scan-detector`; this design covers gate identity, capability matrix, and CI orchestration only (#375).

## Golden projects

| id                    | Source                                   | Pin                            |
| --------------------- | ---------------------------------------- | ------------------------------ |
| `hrkoordinator`       | GitHub `iamthamanic/hrkoordinator`       | commit SHA                     |
| `sagadrive`           | GitHub `iamthamanic/sagadrive`           | commit SHA                     |
| `scriptony-multihost` | GitHub `iamthamanic/scriptony-multihost` | commit SHA                     |
| `hv123-mobile-haba`   | **Local only** `HV123-Mobile-HABA`       | path + local identity contract |
| `screenator`          | GitHub `iamthamanic/Screenator`          | commit SHA                     |

Never invent a GitHub remote for HABA. Identity: `localProjectKey`, `pathEnv`, accepted basenames — see `.qa/readiness/local-identities/hv123-mobile-haba.md`.

## Manifest

Canonical file: `.qa/readiness/golden-projects.manifest.json`

Per project:

- `source` (github SHA **or** local identity — mutually exclusive)
- `capabilities` map → `required` | `optional`
- `runtimeExploration` → `required` | `optional` | `unsupported`
- `gate.mode` → `full` (analyze + views + assertions) | `resolve` (identity + capability status)
- repo-specific `assertions.profile`

## Capability statuses (harness)

| Status        | Meaning                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------- |
| `PASS`        | Required/optional capability exercised and assertions passed                                |
| `FAIL`        | Required capability failed assertions                                                       |
| `UNAVAILABLE` | Optional capability cannot run (missing path, secrets, safety) — **never reported as PASS** |
| `SKIPPED`     | Not in scope for this gate mode                                                             |

## Engine → projection → UI

Harness consumes Engine analyze results and existing semantic gate helpers. No new inference in product slices.

## CI

Workflow `.github/workflows/real-visual-audit.yml` builds a matrix from the manifest. `hrkoordinator` keeps always-on full audit via the harness. Other projects participate per `gate.mode`; V1 certification (#392) tightens modes and golden assertions.

## Epistemic contract (#376)

Canonical `KnowledgeStatus` / `CoverageStatus` / `DetectionState` live in `shared/scan-detector/epistemic.ts`. Legacy SDE statuses map via `coerceKnowledgeStatus`. LLM origin → INTERPRETED only.

## Full-fidelity truth (#377)

Blueprint pipeline: sanitize all facts → assemble authoritative graph (no MAX_BLUEPRINT_FACTS trim) → engine cutover → cap transport `facts`/`graph`.
