/**
 * Pill sub-tabs for DiagnosticsView (Security default per Figma Diagnosen).
 * Location: src/modules/blueprint/components/diagnostics/DiagnosticsSubTabs.tsx
 */

import type { LucideIcon } from "lucide-react";
import { Layers, ListChecks, Network, Search, Shield } from "lucide-react";
import styles from "../../styles/DiagnosticsView.module.css";

export const DIAGNOSTICS_TABS = [
  { id: "security", label: "Security", Icon: Shield },
  { id: "architecture", label: "Architecture", Icon: Network },
  { id: "completeness", label: "Completeness", Icon: ListChecks },
  { id: "complexity", label: "Complexity", Icon: Layers },
  { id: "evidence", label: "Evidence", Icon: Search },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  Icon: LucideIcon;
}>;

export type DiagnosticsTabId = (typeof DIAGNOSTICS_TABS)[number]["id"];

interface DiagnosticsSubTabsProps {
  activeTab: DiagnosticsTabId;
  onSelectTab: (tab: DiagnosticsTabId) => void;
}

export function DiagnosticsSubTabs({
  activeTab,
  onSelectTab,
}: DiagnosticsSubTabsProps): JSX.Element {
  return (
    <div className={styles.subTabs} role="tablist" aria-label="Diagnose-Kategorien">
      {DIAGNOSTICS_TABS.map((tab) => {
        const Icon = tab.Icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.subTab} ${activeTab === tab.id ? styles.subTabActive : ""}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <Icon className={styles.subTabIcon} aria-hidden="true" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
