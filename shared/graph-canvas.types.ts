export interface GraphCanvasNode {
  id: string;
  label: string;
  kind: string;
  color?: string;
  /** Optional SemanticSystemModel v2 kind (Atlas / semantic projections). */
  semanticKind?: string;
  /** Optional KnowledgeStatus for epistemic UI chrome. */
  knowledgeStatus?: string;
  /** One-sentence purpose for product-domain Atlas cards (PU-07). */
  purpose?: string;
  /** ProductUnderstanding concept kind when projected from PU model. */
  productKind?: string;
}

export interface GraphCanvasEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: string;
}
