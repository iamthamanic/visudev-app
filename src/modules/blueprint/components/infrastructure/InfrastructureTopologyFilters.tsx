/**
 * Env/region/view filters and refresh control for infrastructure topology.
 * Honest-Core P0-2: env/region groups only render when the graph actually
 * carries that metadata (availableEnvs/availableRegions from real nodes).
 */

import { RefreshCw } from "lucide-react";
import { TOPOLOGY_VIEW_FILTERS, type TopologyViewFilter } from "./build-topology.js";
import { ControlHint } from "../../../../components/ui/ControlHint.js";
import styles from "../../styles/InfrastructureView.module.css";

interface InfrastructureTopologyFiltersProps {
  /** Env values present in the graph. Empty → group not rendered. */
  availableEnvs: string[];
  /** Region values present in the graph. Empty → group not rendered. */
  availableRegions: string[];
  activeEnv: string | null;
  activeRegion: string | null;
  activeView: TopologyViewFilter | null;
  onSelectEnv: (env: string | null) => void;
  onSelectRegion: (region: string | null) => void;
  onSelectView: (view: TopologyViewFilter | null) => void;
  onRefresh: () => void;
}

export function InfrastructureTopologyFilters({
  availableEnvs,
  availableRegions,
  activeEnv,
  activeRegion,
  activeView,
  onSelectEnv,
  onSelectRegion,
  onSelectView,
  onRefresh,
}: InfrastructureTopologyFiltersProps): JSX.Element {
  return (
    <div className={styles.filterBar} aria-label="Infrastruktur-Filter">
      {availableEnvs.length > 0 ? (
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Umgebung</span>
          <div className={styles.filterChips}>
            {availableEnvs.map((env) => (
              <button
                key={env}
                type="button"
                className={`${styles.filterChip} ${activeEnv === env ? styles.filterChipActive : ""}`}
                aria-pressed={activeEnv === env}
                onClick={() => onSelectEnv(activeEnv === env ? null : env)}
              >
                {env}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {availableRegions.length > 0 ? (
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Region</span>
          <div className={styles.filterChips}>
            {availableRegions.map((region) => (
              <button
                key={region}
                type="button"
                className={`${styles.filterChip} ${activeRegion === region ? styles.filterChipActive : ""}`}
                aria-pressed={activeRegion === region}
                onClick={() => onSelectRegion(activeRegion === region ? null : region)}
              >
                {region}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={styles.filterGroup}>
        <span className={styles.filterLabel}>Ansicht</span>
        <div className={styles.filterChips}>
          {TOPOLOGY_VIEW_FILTERS.map((view) => {
            const physicalUnbuilt = view === "Physische Topologie";
            const chip = (
              <button
                type="button"
                className={`${styles.filterChip} ${activeView === view ? styles.filterChipActive : ""}`}
                aria-pressed={activeView === view}
                disabled={physicalUnbuilt}
                aria-disabled={physicalUnbuilt}
                onClick={physicalUnbuilt ? undefined : () => onSelectView(view)}
              >
                {view}
              </button>
            );
            if (!physicalUnbuilt) return <span key={view}>{chip}</span>;
            return (
              <ControlHint
                key={view}
                reason="Physische Topologie folgt — gesucht nach Compose-/K8s-Deskriptoren."
              >
                {chip}
              </ControlHint>
            );
          })}
        </div>
      </div>
      <button type="button" className={styles.refreshButton} onClick={onRefresh}>
        <RefreshCw size={14} aria-hidden="true" />
        Aktualisieren
      </button>
    </div>
  );
}
