# Composition Gate — auf3-infra-compose-k8s

- HEAD_SHA: 4e822c75d57e0dbb899adeafd9e4fab20ab1e254
- Date: 2026-08-14
- Verdict: CLEAR
- Note: Cap at 40 services per file emits `console.warn` with kept/dropped counts (not silent).

## Event

Analyzer liest Compose-/K8s-Deskriptoren → `deploy-service` Facts → Graph-Service-Nodes (`metadata.env/ports/networks/source`) → Infrastructure-UI (Env-Chips + physische Topologie).

## Path (producer → hops → consumer)

1. `parseComposeDeployServices` / `parseK8sDeployServices` (ein Service → ein ParsedDeployService)
2. `extractDeployDescriptorFacts` (ein Fact, String-Metadaten)
3. `sanitizeFactMetadataForExport` (Allowlist: env/region/ports/networks/dependsOn; keine environment-Secrets)
4. `selectFactsPreservingPrismaModels` (bounded preserve, file+service key)
5. `buildSoftwareGraph` / `linkDeployServiceDependencies` (ein Node pro Fact; depends_on nur same-file)
6. `projectPhysicalTopology` + Env-Chips lesen dieselben Node-Felder

## Simulations

### N-actors

Zwei Compose-Dateien (`docker-compose.prod.yml`, `docker-compose.dev.yml`) erzeugen getrennte Node-IDs (`deploy:{fileSlug}:{service}`) und getrennte `metadata.env`. Kein Fan-out einer Env auf die andere.

### Invalid / missing

- Kein Deskriptor → keine deploy-Nodes; physische Ansicht bleibt disabled; nothing-found nennt gesuchte Muster.
- Region fehlt → kein Region-Chip (kein `eu-central-1`).
- Helm `{{` → Parser liefert [].
- depends_on auf unbekannten Service → keine Kante (Lookup miss).

### Two consumers / crash

Graph-Builder und UI lesen `metadata.source|env|ports|networks|dependsOn` derselben Nodes. UI erfindet keine zweite Quelle. Export-Sanitizer und Graph-Sanitize sind kompatible String-Felder.

## Cardinality

1 Compose-/K8s-Service = 1 Fact = 1 Graph-Node. 1 `depends_on`-Eintrag = 1 `external-dependency` Kante (same file).

## Findings

None.

## Notes

`infrastructure-resource-meters.ts` unverändert. Postgres/Redis `infra-service` (kind table) bleibt paralleler Pfad.
