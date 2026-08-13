/**
 * Graph-derived Diagnostics projections (Honest-Core AUF-1).
 * Location: src/modules/blueprint/components/diagnostics/_projection.ts
 *
 * Every tab renders real values or an honest nothing-found. No invented
 * metrics — LOC, fan-in, and complexity scores stay out when the graph has
 * no source for them.
 */

import type { BlueprintData, BlueprintFinding, CodeFact } from "../../types";
import type { SoftwareGraphEvidence } from "../../types";

export type DiagnosticsProjectionTabId =
  | "architecture"
  | "completeness"
  | "complexity"
  | "evidence";

export interface DiagnosticsListItem {
  id: string;
  label: string;
  detail?: string;
}

export interface DiagnosticsTabProjection {
  tab: DiagnosticsProjectionTabId;
  rows: DiagnosticsListItem[];
  partial: string | null;
}

export interface DiagnosticsProjectionsInput {
  blueprint: BlueprintData;
  findings: BlueprintFinding[];
  facts: CodeFact[];
}

function truncate(value: string, maxLen = 160): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

function truncateMiddle(value: string, maxLen = 120): string {
  if (value.length <= maxLen) return value;
  const head = value.slice(0, Math.floor(maxLen / 2) - 2);
  const tail = value.slice(-(Math.floor(maxLen / 2) - 1));
  return `${head}…${tail}`;
}

function projectEvidence({
  blueprint,
  findings,
  facts,
}: DiagnosticsProjectionsInput): DiagnosticsTabProjection {
  const rows: DiagnosticsListItem[] = [];
  const graphEvidence = blueprint.graph?.evidence ?? [];
  const seen = new Set<string>();
  const factById = new Map(facts.map((fact) => [fact.id, fact]));

  graphEvidence.forEach((evidence: SoftwareGraphEvidence) => {
    const key = `g:${evidence.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      id: key,
      label: truncateMiddle(`${evidence.filePath}:${evidence.line}`),
      detail: truncate(`${evidence.kind} · ${evidence.excerpt}`),
    });
  });

  findings.forEach((finding) => {
    finding.evidenceFactIds
      .map((factId) => factById.get(factId))
      .filter((fact): fact is CodeFact => fact != null)
      .forEach((fact) => {
        const key = `f:${finding.id}:${fact.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({
          id: key,
          label: truncateMiddle(`${fact.filePath}:${fact.line}`),
          detail: truncate(`${finding.ruleId} · ${fact.snippet}`),
        });
      });
  });

  return { tab: "evidence", rows, partial: null };
}

function projectCompleteness({ blueprint }: DiagnosticsProjectionsInput): DiagnosticsTabProjection {
  const graph = blueprint.graph;
  const totalFiles = blueprint.totalFiles ?? null;
  const filesAnalyzed = blueprint.filesAnalyzed ?? 0;
  const findingsCount = blueprint.findings?.length ?? 0;

  const hasCompletenessSignal =
    graph != null || totalFiles != null || filesAnalyzed > 0 || findingsCount > 0;
  if (!hasCompletenessSignal) {
    return { tab: "completeness", rows: [], partial: null };
  }

  const condensed = graph?.condensed === true;
  const partialByFiles = totalFiles != null && filesAnalyzed > 0 && filesAnalyzed < totalFiles;
  const partial =
    condensed || partialByFiles
      ? totalFiles != null
        ? `${filesAnalyzed} von ${totalFiles} Dateien analysiert`
        : `${filesAnalyzed} Dateien analysiert`
      : null;

  const rows: DiagnosticsListItem[] = [];
  if (graph) {
    rows.push(
      { id: "scope-nodes", label: "Knoten im Graph", detail: `${graph.nodes.length}` },
      { id: "scope-edges", label: "Kanten im Graph", detail: `${graph.edges.length}` },
      { id: "scope-evidence", label: "Evidence-Einträge", detail: `${graph.evidence.length}` },
      {
        id: "scope-condensed",
        label: "Kondensiert",
        detail: condensed ? "ja — Graph wurde am Limit gekürzt" : "nein",
      },
    );
  }
  rows.push({
    id: "scope-files",
    label: "Analysierte Dateien",
    detail: totalFiles != null ? `${filesAnalyzed} von ${totalFiles}` : `${filesAnalyzed}`,
  });
  rows.push({
    id: "scope-findings",
    label: "Findings",
    detail: `${findingsCount}`,
  });

  return { tab: "completeness", rows, partial };
}

function projectComplexity({ blueprint }: DiagnosticsProjectionsInput): DiagnosticsTabProjection {
  const graph = blueprint.graph;
  if (!graph || graph.edges.length === 0) {
    return { tab: "complexity", rows: [], partial: null };
  }
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const degree = new Map<string, { incoming: number; outgoing: number }>();
  graph.edges.forEach((edge) => {
    const source = degree.get(edge.sourceId) ?? { incoming: 0, outgoing: 0 };
    source.outgoing += 1;
    degree.set(edge.sourceId, source);
    const target = degree.get(edge.targetId) ?? { incoming: 0, outgoing: 0 };
    target.incoming += 1;
    degree.set(edge.targetId, target);
  });

  const rows = [...degree.entries()]
    .map(([nodeId, counts]) => ({
      nodeId,
      counts,
      total: counts.incoming + counts.outgoing,
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 12)
    .map(({ nodeId, counts }) => ({
      id: nodeId,
      label: truncateMiddle(nodeById.get(nodeId)?.label ?? nodeId, 40),
      detail: `${counts.incoming} eingehend · ${counts.outgoing} ausgehend`,
    }));

  return { tab: "complexity", rows, partial: null };
}

function projectArchitecture({ blueprint }: DiagnosticsProjectionsInput): DiagnosticsTabProjection {
  const graph = blueprint.graph;
  if (!graph || graph.groups.length === 0) {
    return { tab: "architecture", rows: [], partial: null };
  }

  const edgeCountByGroupId = new Map<string, { contains: number; internal: number }>();
  const groupIdByNodeId = new Map<string, string>();
  graph.groups.forEach((group) => {
    edgeCountByGroupId.set(group.id, { contains: 0, internal: 0 });
    group.nodeIds.forEach((nodeId) => {
      if (!groupIdByNodeId.has(nodeId)) groupIdByNodeId.set(nodeId, group.id);
    });
  });

  graph.edges.forEach((edge) => {
    const targetGroupId = groupIdByNodeId.get(edge.targetId);
    if (targetGroupId && edge.kind === "contains") {
      const counts = edgeCountByGroupId.get(targetGroupId);
      if (counts) counts.contains += 1;
    }
    const sourceGroupId = groupIdByNodeId.get(edge.sourceId);
    if (sourceGroupId && sourceGroupId === targetGroupId) {
      const counts = edgeCountByGroupId.get(sourceGroupId);
      if (counts) counts.internal += 1;
    }
  });

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const rows = graph.groups.slice(0, 12).map((group) => {
    const counts = edgeCountByGroupId.get(group.id) ?? { contains: 0, internal: 0 };
    const members = group.nodeIds
      .map((id) => truncateMiddle(nodeById.get(id)?.label ?? id, 40))
      .slice(0, 3)
      .join(", ");
    return {
      id: group.id,
      label: truncateMiddle(group.label, 40),
      detail: `${group.nodeIds.length} Knoten · ${counts.internal} interne Kanten · ${counts.contains} contains · ${members}`,
    };
  });
  return { tab: "architecture", rows, partial: null };
}

export function projectDiagnostics(
  tab: DiagnosticsProjectionTabId,
  input: DiagnosticsProjectionsInput,
): DiagnosticsTabProjection {
  switch (tab) {
    case "evidence":
      return projectEvidence(input);
    case "completeness":
      return projectCompleteness(input);
    case "complexity":
      return projectComplexity(input);
    case "architecture":
      return projectArchitecture(input);
  }
}

export const DIAGNOSTICS_NOTHING_FOUND: Record<DiagnosticsProjectionTabId, string> = {
  architecture:
    "Analyse abgeschlossen, keine Architektur-Daten. Gesucht nach: Graph-Gruppen und contains-Kanten.",
  completeness:
    "Analyse abgeschlossen, keine Vollständigkeits-Daten. Gesucht nach: Scan-Umfang, Datei- und Knoten-Zahlen.",
  complexity:
    "Analyse abgeschlossen, keine Komplexitäts-Daten. Gesucht nach: Abhängigkeitskanten zwischen Modulen.",
  evidence:
    "Analyse abgeschlossen, keine Evidence. Gesucht nach: Graph-Evidence und Finding-Fakten.",
};

export function readTabTitle(tab: DiagnosticsProjectionTabId): string {
  switch (tab) {
    case "architecture":
      return "Architektur";
    case "completeness":
      return "Vollständigkeit";
    case "complexity":
      return "Komplexität";
    case "evidence":
      return "Evidence";
  }
}
