/**
 * Semantic Blueprint model derived from the neutral SoftwareGraph.
 *
 * This layer never replaces the SoftwareGraph. It gives Blueprint views a
 * stable semantic contract while retaining backlinks to the graph evidence
 * that justified every projected entity, membership and relation.
 */

export type SemanticEntityKind =
  | "application"
  | "business-domain"
  | "service"
  | "component"
  | "data-store"
  | "external-system"
  | "use-case"
  | "deployment-unit"
  | "execution-flow";

export type SemanticRelationKind =
  | "contains"
  | "depends-on"
  | "calls"
  | "accesses-data"
  | "communicates-with"
  | "authenticates"
  | "validates";

export type SemanticEvidenceSource = "graph-node" | "graph-edge" | "graph-evidence";

export interface SemanticEvidenceRef {
  source: SemanticEvidenceSource;
  refId: string;
}

export interface SemanticEntity {
  id: string;
  kind: SemanticEntityKind;
  label: string;
  confidence: number;
  evidence: SemanticEvidenceRef[];
  metadata: Record<string, unknown>;
}

/**
 * Connects a low-level graph node to one semantic level. A graph node may have
 * multiple memberships (for example a service entity and its business domain),
 * which keeps roll-up lossless while allowing each view to pick its level.
 */
export interface SemanticMembership {
  graphNodeId: string;
  semanticEntityId: string;
  confidence: number;
  evidence: SemanticEvidenceRef[];
}

export interface SemanticRelation {
  id: string;
  kind: SemanticRelationKind;
  sourceId: string;
  targetId: string;
  confidence: number;
  evidence: SemanticEvidenceRef[];
  metadata: Record<string, unknown>;
}

export interface SemanticSystemModel {
  version: 1;
  projectId: string;
  analyzedAt: string;
  entities: SemanticEntity[];
  memberships: SemanticMembership[];
  relations: SemanticRelation[];
}
