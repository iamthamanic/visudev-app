# Feature: Semantic LLM interpreter (PR-19)

<!-- seeded for semantic-llm-interpreter / PR-19 -->

## Intent

Optional fachliche Semantik aus redigierter Evidence interpretieren, ohne deterministische Truth zu überschreiben.

## Happy Path

- [ ] Deterministische Analyse unverändert bei `VISUDEV_SEMANTIC_INTERPRETER=off` (Default)
- [ ] LLM annotations carry INTERPRETED + originKind=llm + modelId + promptVersion + evidence refs
- [ ] Merge never overwrites/upgrades VERIFIED or SUPPORTED entities
- [ ] Provider failure / missing provider → interpretation UNAVAILABLE only (scan still succeeds)
- [ ] Touched files: zero type escape hatches

## Verify

```bash
cd Visudevfigma
npm test -- --run shared/semantic-interpreter/semantic-interpreter.test.ts
```
