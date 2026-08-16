import type {
  SoftwareGraphEdgeKind,
} from "../../../shared/software-graph.types.js";
import type {
  SemanticRelationKind,
} from "../../../shared/semantic-system-model.types.js";

const SEMANTIC_RELATION_KIND_BY_GRAPH_KIND: Partial<
  Record<SoftwareGraphEdgeKind, SemanticRelationKind>
> = {
  contains: "contains",
  references: "depends-on",
  implements: "depends-on",
  imports: "depends-on",
  calls: "calls",
  api: "communicates-with",
  event: "communicates-with",
  data: "accesses-data",
  "external-dependency": "depends-on",
  authenticates: "authenticates",
  validates: "validates",
};

export function resolveSemanticRelationKind(
  graphKind: SoftwareGraphEdgeKind,
): SemanticRelationKind | undefined {
  return SEMANTIC_RELATION_KIND_BY_GRAPH_KIND[graphKind];
}
