# Feature: PU-03 · Operationalize semantic interpretation for ambiguous codebases

## Intent

Den SemanticInterpreter für mehrdeutige Codebases operationalisieren, ohne deterministische Truth/Product-Understanding Claims zu überschreiben.

## Happy Path

- [ ] Interpreter off → deterministic ProductUnderstandingModel unchanged (byte-stable).
- [ ] LLM-origin annotations are INTERPRETED or CONFLICTED with modelId/promptVersion/evidenceRefs.
- [ ] VERIFIED/SUPPORTED concepts are never overwritten or upgraded.
- [ ] Provider/parse errors → UNAVAILABLE; deterministic model intact.
- [ ] Redacted input only (labels/summaries/ids); no secrets/source payloads.

## Edge Cases

- [ ] Provider offline / throw
- [ ] Unknown concept IDs ignored
- [ ] No ambiguous concepts → skipped COMPLETE

## Security Coverage

- Redacted evidence only; interpreter optional; failure does not fake PASS.

## Implementation Notes

- `shared/product-understanding/interpretation.ts`
- `shared/product-understanding/run-interpretation.ts`
- Tests: `interpretation.test.ts`
