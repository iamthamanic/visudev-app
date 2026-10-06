/**
 * Load SoftwareGraph + AppFlow screens and build canonical DataLineage (PR-22).
 * Location: src/modules/data/hooks/useDataLineage.ts
 */

import { useEffect, useRef, useState } from "react";
import type { SoftwareGraph } from "../../../../shared/software-graph.types.js";
import type { DataLineageGraph } from "../../../lib/visudev-api/data-lineage";
import { getVisuDevClient } from "../../../lib/visudev-api";
import { normalizeBlueprintData } from "../../../lib/visudev/normalize-blueprint";
import { buildDataLineageFromProductInputs } from "../services/data-lineage-input.service";
import type { ERDData } from "../types";

export function useDataLineage(projectId: string | null, erd: ERDData | null) {
  const [software, setSoftware] = useState<SoftwareGraph | null>(null);
  const [screens, setScreens] = useState<unknown[] | null>(null);
  const [lineage, setLineage] = useState<DataLineageGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);

  useEffect(() => {
    const id = projectId;
    if (!id) {
      setSoftware(null);
      setScreens(null);
      setError(null);
      setLoading(false);
      return;
    }
    const token = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    const client = getVisuDevClient();
    void (async () => {
      try {
        const [blueprintLatest, appflowLatest] = await Promise.all([
          client.getBlueprintLatest(id),
          client.getAppflowLatest(id),
        ]);
        if (token !== requestGeneration.current) return;
        const normalized = blueprintLatest?.blueprint
          ? normalizeBlueprintData(blueprintLatest.blueprint as Record<string, unknown>)
          : null;
        setSoftware(normalized?.graph ?? null);
        setScreens(Array.isArray(appflowLatest?.screens) ? appflowLatest.screens : null);
      } catch (err) {
        if (token !== requestGeneration.current) return;
        setSoftware(null);
        setScreens(null);
        setError(
          err instanceof Error ? err.message : "Lineage-Daten konnten nicht geladen werden.",
        );
      } finally {
        if (token === requestGeneration.current) setLoading(false);
      }
    })();
    return () => {
      requestGeneration.current += 1;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !software) {
      setLineage(null);
      return;
    }
    setLineage(
      buildDataLineageFromProductInputs({
        projectId,
        software,
        erd,
        appflowScreens: screens,
        analyzedAt: software.analyzedAt,
      }),
    );
  }, [projectId, software, erd, screens]);

  return { lineage, loading, error, hasSoftwareGraph: Boolean(software), software };
}
