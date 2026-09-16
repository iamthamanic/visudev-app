/**
 * Edge-focused inspector panel for DependenciesView evidence display.
 */

import type { SoftwareGraphEdge, SoftwareGraphEvidence } from "../../types";
import { InspectorPanel } from "../ui/InspectorPanel.js";
import styles from "../../styles/DependenciesView.module.css";

function evidenceKindLabel(edge: SoftwareGraphEdge): string | null {
  // Runtime observations must win over evidenceKind (often also "extracted").
  if (edge.metadata?.provenance === "observed") return "beobachtet";
  const kind = edge.metadata?.evidenceKind;
  if (kind === "extracted") return "aus Code";
  if (kind === "inferred") return "abgeleitet";
  return null;
}

export interface DependenciesEdgeInspectorProps {
  sourceLabel: string;
  targetLabel: string;
  edge: SoftwareGraphEdge;
  evidence: SoftwareGraphEvidence[];
}

export function DependenciesEdgeInspector({
  sourceLabel,
  targetLabel,
  edge,
  evidence,
}: DependenciesEdgeInspectorProps): JSX.Element {
  const honesty = evidenceKindLabel(edge);
  return (
    <div data-testid="dependency-inspector">
      <InspectorPanel
        title={`${sourceLabel} → ${targetLabel}`}
        subtitle={honesty ? `${edge.kind} · ${honesty}` : edge.kind}
        sections={[
          {
            id: "honesty",
            title: "Herkunft",
            content: (
              <p className={styles.emptyControls} data-testid="edge-evidence-kind">
                {honesty
                  ? honesty === "aus Code"
                    ? "Kante aus AST/Code extrahiert."
                    : honesty === "beobachtet"
                      ? "Kante aus Runtime-Crawl beobachtet."
                      : "Kante heuristisch abgeleitet."
                  : "Keine Herkunftsangabe."}
              </p>
            ),
          },
          {
            id: "evidence",
            title: "Evidence",
            content:
              evidence.length === 0 ? (
                <p className={styles.emptyControls}>Keine Evidence für diese Kante.</p>
              ) : (
                <ul className={styles.evidenceList}>
                  {evidence.map((item) => (
                    <li key={item.id} className={styles.evidenceItem}>
                      <p className={styles.evidenceMeta}>
                        {item.filePath}:{item.line} · {item.kind}
                      </p>
                      <pre className={styles.evidenceExcerpt}>{item.excerpt}</pre>
                    </li>
                  ))}
                </ul>
              ),
          },
        ]}
      />
    </div>
  );
}
