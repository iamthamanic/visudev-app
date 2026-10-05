# Composition gate — data-lineage-model (PR-21)

**State:** SKIPPED  
**HEAD:** `771037b97d05ed89352ab5944a6360337a170bd6`
**Reason:** Single-hop pure builder (`buildDataLineage`) over existing IR. No producer→consumer side effects, queues, bulk fan-out, or destination override. Downstream UI (#396) not in this slice.
