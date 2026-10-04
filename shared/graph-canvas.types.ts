export interface GraphCanvasNode {
  id: string;
  label: string;
  kind: string;
  color?: string;
  /** Optional SemanticSystemModel v2 kind (Atlas / semantic projections). */
  semanticKind?: string;
  /** Optional KnowledgeStatus for epistemic UI chrome. */
  knowledgeStatus?: string;
}

export interface GraphCanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: string;
}
