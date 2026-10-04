# Issue 388 — PR-14 infrastructure-detection

## Implement

- Added `infra-tier1-descriptors.ts`: Dockerfile, package.json SDK, safe env examples
- Wired into `extractFactsFromFile` + `isSupportedBlueprintFile`
- Walk/priority: preview-runner + call-graph.builder
- Physical sources include `dockerfile`
- Compose image mapping extended (MySQL/Mongo via shared helper)
- Acceptance: `.qa/acceptance/infrastructure-detection.md`

## Verify

- Deno: infra-tier1 + fact-extractors + pipeline — PASS
- Vitest: infrastructure-entities, build-topology, InfrastructureView — PASS
- Composition-gate: CLEAR (see composition-gate-388-infrastructure-detection.md)

## Ship

- Pending commit / PR / babysit / merge
