/**
 * Inspektor sub-tabs for AtlasView — Übersicht, Details, Abhängigkeiten, Deployments.
 */

import { useState } from "react";
import type { SemanticEntity } from "../../../../../shared/semantic-system-model.types.js";
import type { SoftwareGraph, SoftwareGraphGroup, SoftwareGraphNode } from "../../types";
import { findGroupsForNode } from "./atlas-display.js";
import { ATLAS_INSPECTOR_TABS, type AtlasInspectorTabId } from "./atlas-inspector-tabs.js";
import { AtlasInspectorDependenciesTab } from "./AtlasInspectorDependenciesTab.js";
import { AtlasInspectorDeploymentsTab } from "./AtlasInspectorDeploymentsTab.js";
import { AtlasInspectorDetailsTab } from "./AtlasInspectorDetailsTab.js";
import { AtlasInspectorOverviewTab } from "./AtlasInspectorOverviewTab.js";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasInspectorTabsProps {
  graph: SoftwareGraph;
  node: SoftwareGraphNode | null;
  cluster: SoftwareGraphGroup | null;
  semanticEntity?: SemanticEntity | null;
}

export function AtlasInspectorTabs({
  graph,
  node,
  cluster,
  semanticEntity = null,
}: AtlasInspectorTabsProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AtlasInspectorTabId>("overview");

  if (!node && !cluster && !semanticEntity) {
    return (
      <div className={styles.inspectorEmpty}>
        <p>Wähle einen Knoten oder Cluster auf der Karte.</p>
      </div>
    );
  }

  const nodeGroups = node ? findGroupsForNode(graph, node.id) : [];

  return (
    <div className={styles.inspectorTabs}>
      <div className={styles.tabList} role="tablist" aria-label="Atlas-Inspektor">
        {ATLAS_INSPECTOR_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.tabPanel} role="tabpanel">
        {activeTab === "overview" ? (
          <AtlasInspectorOverviewTab
            graph={graph}
            node={node}
            cluster={cluster}
            nodeGroups={nodeGroups}
            semanticEntity={semanticEntity}
          />
        ) : null}
        {activeTab === "details" ? (
          <AtlasInspectorDetailsTab
            graph={graph}
            node={node}
            cluster={cluster}
            semanticEntity={semanticEntity}
          />
        ) : null}
        {activeTab === "dependencies" ? (
          <AtlasInspectorDependenciesTab graph={graph} node={node} cluster={cluster} />
        ) : null}
        {activeTab === "deployments" ? (
          <AtlasInspectorDeploymentsTab graph={graph} node={node} cluster={cluster} />
        ) : null}
      </div>
    </div>
  );
}
