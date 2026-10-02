/**
 * Projection / Query port for product slices (SDE-07).
 * Re-exports typed read-model contracts so modules never import engine internals.
 * Location: src/lib/visudev-api/scan-projection.ts
 */

export {
  PROJECTION_DEFAULT_LIMIT,
  PROJECTION_HARD_MAX_LIMIT,
  projectAppFlowReadModel,
  projectBlueprintReadModel,
  projectDataReadModel,
  type AppFlowProjectionReadModel,
  type BlueprintProjectionReadModel,
  type DataProjectionReadModel,
  type ProjectReadModelInput,
  type ProjectionEntity,
  type ProjectionEvidenceLink,
  type ProjectionPageMeta,
  type ProjectionQueryOptions,
  type ProjectionQueryScope,
  type ProjectionReadModel,
  type ProjectionRelation,
  type ProjectionSlice,
} from "../../../shared/scan-detector/index.js";
