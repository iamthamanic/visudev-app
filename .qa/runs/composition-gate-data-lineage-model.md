# Composition gate — data-lineage-model (PR-21)

**State:** SKIPPED  
**HEAD (pre-commit worktree):** `9f4f90d14e22ab7aed1eb17d134a2e60c81b33d4` + uncommitted lineage builder  
**Reason:** Single-hop pure builder (`buildDataLineage`) over existing IR. No producer→consumer side effects, queues, bulk fan-out, or destination override. Downstream UI (#396) not in this slice.
