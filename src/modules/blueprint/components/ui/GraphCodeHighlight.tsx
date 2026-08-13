/**
 * File/line highlight for Graph ↔ Code selection (Honest-Core P1-5).
 * Location: src/modules/blueprint/components/ui/GraphCodeHighlight.tsx
 */

import styles from "./GraphCodeHighlight.module.css";

export interface GraphCodeRelatedNode {
  id: string;
  label: string;
}

export interface GraphCodeHighlightProps {
  filePath: string | null;
  line: number | null;
  hint: string | null;
  excerpt: string | null;
  relatedNodes: GraphCodeRelatedNode[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function GraphCodeHighlight({
  filePath,
  line,
  hint,
  excerpt,
  relatedNodes,
  selectedNodeId,
  onSelectNode,
}: GraphCodeHighlightProps): JSX.Element {
  const locationLabel = filePath == null ? null : line == null ? filePath : `${filePath}:${line}`;

  return (
    <div className={styles.root}>
      {filePath ? (
        <button
          type="button"
          className={styles.highlight}
          data-testid="code-highlight"
          title={hint ?? locationLabel ?? undefined}
          onClick={() => {
            const focusId = selectedNodeId ?? relatedNodes[0]?.id;
            if (focusId) onSelectNode(focusId);
          }}
        >
          <span className={styles.path}>{locationLabel}</span>
          {excerpt ? <pre className={styles.excerpt}>{excerpt}</pre> : null}
        </button>
      ) : (
        <p className={styles.hint} role="status">
          {hint}
        </p>
      )}
      {filePath && hint ? (
        <p className={styles.hint} role="status">
          {hint}
        </p>
      ) : null}
      {relatedNodes.length > 0 ? (
        <div className={styles.related} aria-label="Verknüpfte Knoten">
          {relatedNodes.map((node) => {
            const selected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                type="button"
                className="btn btn-sm btn-ghost"
                data-testid={selected ? "graph-node-selected" : "graph-node-related"}
                aria-pressed={selected}
                onClick={() => onSelectNode(node.id)}
              >
                {node.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
