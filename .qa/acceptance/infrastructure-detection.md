# Feature: Tier-1 Infrastructure Detection (PR-14)

<!-- seeded for infrastructure-detection / issue 388 -->

## Intent

Infrastructure claims come only from Tier-1 evidence: Docker/Compose, deployment descriptors, package SDK deps, env _names_, ports, and datasource config. No invented runtime metrics or live cloud inventory. Secrets and connection-string values never land in artefacts.

## Preconditions

- Analyzer reads repository file entries (local or GitHub scan)
- Existing compose/k8s + Prisma datasource detectors remain available

## Happy Path

- [ ] `Dockerfile` (without compose) yields `deploy-service` with `source: dockerfile` and optional `ports` from `EXPOSE`
- [ ] Known `FROM` images (postgres/redis/mysql/mongo) yield `infra-service` with file evidence
- [ ] `package.json` deps (`pg`, `ioredis`, `mongodb`, …) yield `infra-service` with `source: package-sdk` (unused deps still count as evidence)
- [ ] `.env.example` well-known names (`REDIS_URL`, `POSTGRES_HOST`, …) yield `infra-service` with `source: env-name`; snippets are `NAME=***` only
- [ ] Compose/K8s deploy descriptors and Prisma datasource continue to emit infra/deploy facts
- [ ] Graph/semantic infrastructure entities carry evidence + KnowledgeStatus (SUPPORTED when graph-backed)

## Edge Cases

- [ ] `DATABASE_URL` alone does not invent PostgreSQL
- [ ] Live `.env` files are not scanned (examples/samples/templates only)
- [ ] Dockerfile without known engine image → deploy unit only, no fake DB
- [ ] Multiple DB SDKs → multiple infra-service facts (deduped by service label)
- [ ] Repo with no Tier-1 signals → no invented infra (NOT_DETECTED/ABSENT via coverage, not fake nodes)

## Regression

- [ ] Compose Postgres/Redis + deploy-service facts unchanged
- [ ] AUF-3 env/region chips still omit secret values
- [ ] Code-only services without physical source stay out of Infrastructure view

## Security Coverage

- **P-04**: Env values / connection strings never persisted — names and `***` snippets only
- **B-08**: No YAML/JSON eval beyond `JSON.parse` of package.json; Dockerfile line regex only
- **F-03**: UI/graph show only evidenced engines and deploy units

## Verify

```bash
cd Visudevfigma
deno test src/supabase/functions/visudev-analyzer/module/blueprint/facts/infra-tier1-descriptors.test.ts
deno test src/supabase/functions/visudev-analyzer/module/blueprint/facts/fact-extractors.test.ts
deno test src/supabase/functions/visudev-analyzer/module/blueprint/services/blueprint-pipeline.service.test.ts
npm test -- --run src/modules/blueprint/components/infrastructure/infrastructure-entities.test.ts
```
