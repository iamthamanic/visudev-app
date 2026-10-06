/**
 * Sidebar controls for AtlasView — product-domain search, clusters, node cards (PU-07).
 * 3D city toggle removed from primary Product-Understanding path.
 */

import type { SoftwareGraphGroup } from "../../types";
import { AtlasClusterChips } from "./AtlasClusterChips.js";
import { AtlasNodeList } from "./AtlasNodeList.js";
import type { AtlasViewMode } from "./atlas-view-mode.js";
import type { GraphCanvasNode } from "../../types";
import styles from "../../styles/AtlasView.module.css";

export interface AtlasControlsProps {
  searchQuery: string;
  totalNodes: number;
  visibleNodes: number;
  condensed: boolean;
  viewMode: AtlasViewMode;
  threeDisabled: boolean;
  nodes: GraphCanvasNode[];
  groups: SoftwareGraphGroup[];
  selectedNodeId: string | null;
  selectedGroupId: string | null;
  onSearchChange: (value: string) => void;
  onResetSearch: () => void;
  onSelectNode: (nodeId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectViewMode: (mode: AtlasViewMode) => void;
}

export function AtlasControls({
  searchQuery,
  totalNodes,
  visibleNodes,
  condensed,
  nodes,
  groups,
  selectedNodeId,
  selectedGroupId,
  onSearchChange,
  onResetSearch,
  onSelectNode,
  onSelectGroup,
}: AtlasControlsProps): JSX.Element {
  return (
    <aside className={styles.controls} aria-label="Atlas-Steuerung">
      <p className={styles.viewModeHint} role="status">
        Produktlandkarte · 2D
      </p>

      <div className={styles.searchBar}>
        <label className={styles.searchLabel}>
          <span className={styles.searchLabelText}>Atlas durchsuchen</span>
          <input
            className={styles.searchInput}
            type="search"
            value={searchQuery}
            placeholder="Produktbereich oder Fähigkeit…"
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </label>
        {searchQuery ? (
          <button type="button" className={styles.resetButton} onClick={onResetSearch}>
            Zurücksetzen
          </button>
        ) : null}
      </div>

      {condensed ? (
        <div className={styles.condensedBanner} role="status">
          <p className={styles.condensedBannerTitle}>Verdichtete Produktlandkarte</p>
          <p className={styles.condensedBannerText}>
            Atlas zeigt die wichtigsten Anwendungen, Produktbereiche und Fähigkeiten ({visibleNodes}{" "}
            von {totalNodes} sichtbar).
          </p>
        </div>
      ) : null}

      <p className={styles.stat}>
        {visibleNodes} von {totalNodes} Produktkonzepte sichtbar
      </p>

      <AtlasClusterChips
        groups={groups}
        selectedGroupId={selectedGroupId}
        onSelectGroup={onSelectGroup}
      />

      <AtlasNodeList nodes={nodes} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} />

      <p className={styles.modeHint}>
        Technische Module, Services und Dateien erscheinen im Inspektor unter Evidence — nicht auf
        der Primärkarte.
      </p>
    </aside>
  );
}
