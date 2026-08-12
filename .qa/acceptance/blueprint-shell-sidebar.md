# Acceptance — Blueprint shell sidebar (#86)

## Intent

German Blueprint sub-navigation in the shell sidebar; remove horizontal tabs; nested URL `/blueprint/<id>`.

## Criteria

- [x] Seven views reachable from sidebar with German labels
- [x] Horizontal tab bar removed from BlueprintViewShell
- [x] Default view is Diagnosen (diagnostics)
- [x] URL sync via `/blueprint/<id>` (legacy `?view=` redirects)
- [x] View header with project/branch breadcrumb
- [x] Vitest updated; npm run checks green
