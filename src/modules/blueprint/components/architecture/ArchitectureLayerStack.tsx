/**
 * Vertical stack cards with Figma accent borders, tags, and glow selection.
 */

import type { CSSProperties } from "react";
import { ViewSectionTitle } from "../ui/ViewSectionTitle.js";
import { LAYER_TYPE_LABELS, layerTypeCssVar } from "./architecture-layer-accents.js";
import type { ArchitectureStackCard } from "./build-layer-stack.js";
import styles from "../../styles/ArchitectureView.module.css";

interface ArchitectureLayerStackProps {
  cards: ArchitectureStackCard[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  variant?: "sidebar" | "canvas";
  showTitle?: boolean;
  ariaLabel?: string;
}

const KIND_TAGS: Record<string, string> = {
  domain: "Domain",
  layer: "Layer",
  module: "Module",
};

export function ArchitectureLayerStack({
  cards,
  selectedNodeId,
  onSelectNode,
  variant = "sidebar",
  showTitle = true,
  ariaLabel = "Architektur-Stack",
}: ArchitectureLayerStackProps): JSX.Element {
  const isCanvas = variant === "canvas";

  return (
    <div
      className={`${styles.stackPanel} ${isCanvas ? styles.stackPanelCanvas : ""}`}
      aria-label={ariaLabel}
      data-testid="architecture-layer-stack"
    >
      {showTitle ? <ViewSectionTitle>Layer Stack</ViewSectionTitle> : null}
      {cards.length === 0 ? (
        <p className={styles.emptyControls}>Keine Einträge für diese Gruppierung.</p>
      ) : (
        <ul className={`${styles.stackList} ${isCanvas ? styles.stackListCanvas : ""}`}>
          {cards.map((card) => {
            const isSelected = card.id === selectedNodeId;
            const layerType = card.layerType !== "unknown" ? card.layerType : null;
            const accentVar = layerType ? layerTypeCssVar(layerType) : null;

            return (
              <li key={card.id}>
                <button
                  type="button"
                  className={`${styles.layerCard} ${isCanvas ? styles.layerCardCanvas : ""} ${isSelected ? styles.layerCardSelected : ""}`}
                  data-testid={card.kind === "domain" ? "domain-module" : "layer-card"}
                  data-path={card.filePath ?? undefined}
                  data-kind={card.kind}
                  data-layer-type={layerType ?? undefined}
                  style={
                    accentVar
                      ? ({
                          "--layer-accent": `var(${accentVar})`,
                        } as CSSProperties)
                      : undefined
                  }
                  aria-pressed={isSelected}
                  onClick={() => onSelectNode(card.id)}
                >
                  <span className={styles.layerCardHeader}>
                    <span className={styles.layerCardTitle}>{card.label}</span>
                    <span className={styles.layerCardTags}>
                      <span className={styles.kindTag}>{KIND_TAGS[card.kind] ?? card.kind}</span>
                      {layerType ? (
                        <span className={styles.layerTypeTag}>{LAYER_TYPE_LABELS[layerType]}</span>
                      ) : null}
                      {card.domainTag ? (
                        <span className={styles.domainTag}>{card.domainTag}</span>
                      ) : null}
                    </span>
                  </span>
                  {card.services.length > 0 ? (
                    <span className={styles.servicePills}>
                      {card.services.slice(0, isCanvas ? 6 : 4).map((service) => (
                        <span key={service} className={styles.servicePill}>
                          {service}
                        </span>
                      ))}
                      {card.services.length > (isCanvas ? 6 : 4) ? (
                        <span className={styles.servicePill}>
                          +{card.services.length - (isCanvas ? 6 : 4)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
