# Review Ticket — #300 AUF-3 Infra compose/k8s

- BASE_SHA: origin/main
- HEAD_SHA: 4e822c75d57e0dbb899adeafd9e4fab20ab1e254
- Date: 2026-08-14
- Verdict: ACCEPT
- AI review: DeepSeek V4 Pro ACCEPT 100 (`.qa/runs/ai-review-300-deepseek.md`)

## Scope vs acceptance

Diff bleibt in Analyzer-Parser, Fact-Export, Graph-Promotion, Infrastructure-UI. `infrastructure-resource-meters.ts` unberührt.

## Architecture

Parser ist indent-basiert (kein YAML-eval). Deploy-Services sind `kind: service` getrennt von Engine-Facts (`infra-service` → table). Physische Topologie ist eine zweite Projektion, nicht ein Fake-AWS-Layout.

## Security

- Compose `environment`/`env_file` werden nicht exportiert
- Ports/Namen gegen enge Muster
- Region nur Allowlist-Labels
- Generic CI YAML bleibt außerhalb des Walks

## Typed-strict

Keine `any` / `@ts-ignore` in touched files.

## Tests

Parser, export preserve, graph depends_on, physical projection, env-chip + physical topology UI, nothing-found copy.

## Findings

None blocking.
