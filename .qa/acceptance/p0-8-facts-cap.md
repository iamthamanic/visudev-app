# P0-8 — Fact export prioritization (acceptance)

## Intent

Replace positional `slice(0, n)` fact export with priority + per-file coverage selection. Export `factSelection` report with extracted/selected counts.

## Preconditions

- [x] Issue #262 (P0-11) merged on main
- [x] Deno analyzer blueprint pipeline available

## Happy Path

- [ ] `FACT_EXPORT_PRIORITY` exported from `graph-export-cap.ts`
- [ ] `selectFactsPreservingPrismaModels` returns `{ facts, report }` — no `rest.slice(0, n)`
- [ ] Priority + round-robin coverage spreads facts across files
- [ ] All Prisma model facts preserved regardless of cap
- [ ] `factSelection` on `BlueprintDocument` and `RawBlueprintScan`
- [ ] Legacy provider passes `factSelection` through

## Edge Cases

- [ ] Fewer facts than cap → report shows extracted === selected
- [ ] Null/zero facts → report with zeros
- [ ] Single dominant file cannot consume entire budget

## Verification

```bash
cd Visudevfigma
deno test src/supabase/functions/visudev-analyzer/module/blueprint/internal/graph-export-cap.test.ts
npm run typecheck
npm run test:run
npm run golden-set
```
