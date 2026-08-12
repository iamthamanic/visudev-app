# Issue #273 — Golden-set symlink jail

## Fixes
- Important: walkCodeFiles / seed schema walk / collectFileEntries skip symlinks and enforce realpath containment
- Minor: CI metatest asserts DEMO_ENRICHMENT only inside e2e-demo job

## Tests
- Unit: directory symlink outside workspace is not walked
- Unit: workflow-level DEMO_ENRICHMENT would fail metatest
