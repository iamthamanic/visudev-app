/**
 * Purple-accent pill tabs for EvolutionView modes (Timeline default).
 */

import { EVOLUTION_TABS, type EvolutionTabId } from "./evolution-tabs.js";
import styles from "../../styles/EvolutionView.module.css";

interface EvolutionSubTabsProps {
  activeTab: EvolutionTabId;
  onSelectTab: (tab: EvolutionTabId) => void;
}

export function EvolutionSubTabs({ activeTab, onSelectTab }: EvolutionSubTabsProps): JSX.Element {
  return (
    <div className={styles.subTabs} role="tablist" aria-label="Evolution-Modi">
      {EVOLUTION_TABS.map((tab) => {
        const disabled = tab.id === "working-tree";
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-disabled={disabled}
            disabled={disabled}
            tabIndex={disabled ? -1 : undefined}
            data-testid={`evolution-tab-${tab.id}`}
            className={`${styles.subTab} ${activeTab === tab.id ? styles.subTabActive : ""}`}
            onClick={() => {
              if (disabled) return;
              onSelectTab(tab.id);
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
