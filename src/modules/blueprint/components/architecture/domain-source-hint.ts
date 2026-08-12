/**
 * Architecture banner copy from file-node domainSource majority (P0-14).
 * Location: src/modules/blueprint/components/architecture/domain-source-hint.ts
 */

export type DomainSourceKind = "path" | "filename" | "none";

export const DOMAIN_SOURCE_HINT_FILENAME =
  "Fachbereiche wurden aus Dateinamen abgeleitet — dieses Projekt ist nach Schichten organisiert, nicht nach Ordner-Domänen.";

export const DOMAIN_SOURCE_HINT_NONE =
  "VisuDEV konnte keine Fachbereiche erkennen. Gruppierung folgt Schichten bzw. Verzeichnissen.";

export function majorityDomainSource(
  sources: readonly DomainSourceKind[],
): DomainSourceKind | null {
  if (sources.length === 0) return null;
  const counts: Record<DomainSourceKind, number> = {
    path: 0,
    filename: 0,
    none: 0,
  };
  for (const source of sources) {
    if (source in counts) counts[source] += 1;
  }
  let best: DomainSourceKind = "path";
  let bestCount = -1;
  for (const key of ["path", "filename", "none"] as const) {
    if (counts[key] > bestCount) {
      best = key;
      bestCount = counts[key];
    }
  }
  return best;
}

/** Returns UI hint text, or null when majority is path (no banner). */
export function domainSourceHintText(sources: readonly DomainSourceKind[]): string | null {
  const majority = majorityDomainSource(sources);
  if (majority === "filename") return DOMAIN_SOURCE_HINT_FILENAME;
  if (majority === "none") return DOMAIN_SOURCE_HINT_NONE;
  return null;
}

export function collectFileDomainSources(
  nodes: readonly { kind?: string; metadata?: Record<string, unknown> }[],
): DomainSourceKind[] {
  const out: DomainSourceKind[] = [];
  for (const node of nodes) {
    if (node.kind !== "file") continue;
    const raw = node.metadata?.domainSource;
    if (raw === "path" || raw === "filename" || raw === "none") {
      out.push(raw);
    }
  }
  return out;
}
